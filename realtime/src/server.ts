import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import {
  isUniqueConstraintError,
  normalizeCounts,
  PollOption,
  sumCounts,
} from "./poll-utils";

const app = express();
const httpServer = createServer(app);
const globalForPrisma = globalThis as { prisma?: PrismaClient };
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, "");
const webOriginEnv = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const webOrigins = new Set(
  webOriginEnv
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin),
);
const isAllowedOrigin = (origin?: string | null) =>
  !origin || webOrigins.has(normalizeOrigin(origin));
const normalizeRedisUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "redis:" && parsed.hostname.endsWith("upstash.io")) {
      parsed.protocol = "rediss:";
      return parsed.toString();
    }
  } catch {
    return url;
  }
  return url;
};

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(normalizeRedisUrl(redisUrl), { maxRetriesPerRequest: 2 });
redis.on("error", (error) => {
  console.error("Redis error", error);
});

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  },
});

const getCountsFromDatabase = async (pollId: string, options: PollOption[]) => {
  const groupedVotes = await prisma.vote.groupBy({
    by: ["optionId"],
    where: { pollId },
    _count: {
      optionId: true,
    },
  });

  const rawCounts = groupedVotes.reduce<Record<string, string>>((acc, group) => {
    acc[group.optionId] = String(group._count.optionId);
    return acc;
  }, {});

  const counts = normalizeCounts(options, rawCounts);
  const totalVotes = sumCounts(counts);

  return { counts, totalVotes };
};

const syncRedisState = async (
  pollId: string,
  options: PollOption[],
  counts: Record<string, number>,
  totalVotes: number,
  isOpen: boolean,
) => {
  const pipeline = redis.multi();
  pipeline.set(`poll:${pollId}:open`, isOpen ? "1" : "0");
  pipeline.set(`poll:${pollId}:total`, String(totalVotes));
  for (const option of options) {
    pipeline.hset(`poll:${pollId}:counts`, option.id, String(counts[option.id] ?? 0));
  }
  await pipeline.exec();
};

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on("join_poll", async ({ pollId }) => {
    if (!pollId) {
      socket.emit("vote_error", { message: "Poll ID is required." });
      return;
    }
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        isOpen: true,
        allowAnonymousVotes: true,
        collectVoterEmail: true,
        options: {
          select: { id: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!poll) {
      socket.emit("vote_error", { message: "Poll not found." });
      return;
    }

    socket.join(`poll:${pollId}`);

    const [openState, rawCounts, totalRaw] = await Promise.all([
      redis.get(`poll:${pollId}:open`),
      redis.hgetall(`poll:${pollId}:counts`),
      redis.get(`poll:${pollId}:total`),
    ]);

    const hasRedisCounts = Object.keys(rawCounts).length > 0;
    let counts = normalizeCounts(poll.options, rawCounts);
    let totalVotes = totalRaw ? Number(totalRaw) || 0 : sumCounts(counts);

    if (!hasRedisCounts) {
      const dbCounts = await getCountsFromDatabase(pollId, poll.options);
      counts = dbCounts.counts;
      totalVotes = dbCounts.totalVotes;
      await syncRedisState(pollId, poll.options, counts, totalVotes, poll.isOpen);
    } else {
      const missingOptions = poll.options.filter((option) => !(option.id in rawCounts));
      if (
        openState !== (poll.isOpen ? "1" : "0") ||
        !totalRaw ||
        missingOptions.length > 0
      ) {
        const pipeline = redis.multi();
        pipeline.set(`poll:${pollId}:open`, poll.isOpen ? "1" : "0");
        if (!totalRaw) {
          pipeline.set(`poll:${pollId}:total`, String(totalVotes));
        }
        for (const option of missingOptions) {
          pipeline.hset(`poll:${pollId}:counts`, option.id, "0");
        }
        await pipeline.exec();
      }
    }

    socket.emit("poll_state", {
      pollId,
      isOpen: poll.isOpen,
      allowAnonymousVotes: poll.allowAnonymousVotes,
      collectVoterEmail: poll.collectVoterEmail,
      counts,
      totalVotes,
    });
  });

  socket.on(
    "cast_vote",
    async ({
      pollId,
      optionId,
      voterId,
      voterEmail,
    }: {
      pollId?: string;
      optionId?: string;
      voterId?: string;
      voterEmail?: string;
    }) => {
      if (!pollId || !optionId || !voterId) {
        socket.emit("vote_error", { message: "Invalid vote payload." });
        return;
      }

      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        select: {
          id: true,
          isOpen: true,
          allowAnonymousVotes: true,
          collectVoterEmail: true,
          options: {
            select: { id: true },
            orderBy: { order: "asc" },
          },
        },
      });

      if (!poll) {
        socket.emit("vote_error", { message: "Poll not found." });
        return;
      }

      if (!poll.options.some((option) => option.id === optionId)) {
        socket.emit("vote_error", { message: "Invalid poll option." });
        return;
      }

      if (!poll.isOpen) {
        await redis.set(`poll:${pollId}:open`, "0");
        socket.emit("vote_error", { message: "Poll is closed." });
        return;
      }

      const normalizedVoterEmail = voterEmail?.trim().toLowerCase();
      if (normalizedVoterEmail && !/^[^@]+@[^@]+\.[^@]+$/.test(normalizedVoterEmail)) {
        socket.emit("vote_error", { message: "Enter a valid email address." });
        return;
      }
      if (poll.collectVoterEmail && !poll.allowAnonymousVotes && !normalizedVoterEmail) {
        socket.emit("vote_error", { message: "Email is required for this poll." });
        return;
      }

      try {
        await prisma.vote.create({
          data: {
            pollId,
            optionId,
            voterId,
            voterEmail: poll.collectVoterEmail ? normalizedVoterEmail : null,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          socket.emit("vote_error", { message: "Vote already cast." });
          return;
        }
        socket.emit("vote_error", { message: "Unable to record vote." });
        return;
      }

      await redis
        .multi()
        .set(`poll:${pollId}:open`, "1")
        .hincrby(`poll:${pollId}:counts`, optionId, 1)
        .incr(`poll:${pollId}:total`)
        .exec();

      const [rawCounts, totalRaw] = await Promise.all([
        redis.hgetall(`poll:${pollId}:counts`),
        redis.get(`poll:${pollId}:total`),
      ]);

      let counts = normalizeCounts(poll.options, rawCounts);
      let totalVotes = totalRaw ? Number(totalRaw) || 0 : sumCounts(counts);

      if (!Object.keys(rawCounts).length) {
        const dbCounts = await getCountsFromDatabase(pollId, poll.options);
        counts = dbCounts.counts;
        totalVotes = dbCounts.totalVotes;
        await syncRedisState(pollId, poll.options, counts, totalVotes, poll.isOpen);
      }

      io.to(`poll:${pollId}`).emit("poll_update", {
        pollId,
        isOpen: poll.isOpen,
        allowAnonymousVotes: poll.allowAnonymousVotes,
        collectVoterEmail: poll.collectVoterEmail,
        counts,
        totalVotes,
      });
    },
  );

  socket.on("disconnect", () => {
    console.log("socket disconnected", socket.id);
  });
});

const port = Number(process.env.PORT ?? 4000);

httpServer.listen(port, () => {
  console.log(`realtime server listening on :${port}`);
});
