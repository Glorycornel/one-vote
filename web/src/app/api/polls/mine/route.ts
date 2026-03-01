import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getSessionCookieName, getSessionUserByToken } from "@/lib/auth";

export const runtime = "nodejs";

const asDate = (raw: string | null, endOfDay = false) => {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }
  return parsed;
};

const compareNumbers = (a: number, b: number, order: "asc" | "desc") =>
  order === "asc" ? a - b : b - a;

const compareDates = (a: Date, b: Date, order: "asc" | "desc") =>
  order === "asc" ? a.getTime() - b.getTime() : b.getTime() - a.getTime();

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const user = await getSessionUserByToken(token);

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to view polls." },
      { status: 401 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const sort = searchParams.get("sort");
  const order = searchParams.get("order");
  const q = searchParams.get("q")?.trim();
  const minVotesRaw = searchParams.get("minVotes");
  const maxVotesRaw = searchParams.get("maxVotes");
  const from = asDate(searchParams.get("from"));
  const to = asDate(searchParams.get("to"), true);

  const minVotes = minVotesRaw ? Number(minVotesRaw) : null;
  const maxVotes = maxVotesRaw ? Number(maxVotesRaw) : null;
  const voteSortOrder: "asc" | "desc" = order === "asc" ? "asc" : "desc";
  const isVoteSort = sort === "totalVotes";

  const polls = await prisma.poll.findMany({
    where: {
      creatorId: user.id,
      ...(status === "open" ? { isOpen: true } : {}),
      ...(status === "closed" ? { isOpen: false } : {}),
      ...(q
        ? {
            question: {
              contains: q,
              mode: "insensitive",
            },
          }
        : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: isVoteSort ? { createdAt: "desc" } : { createdAt: voteSortOrder },
    include: {
      _count: {
        select: { votes: true },
      },
    },
  });

  const pollIds = polls.map((poll) => poll.id);
  let identifiedVotesMap = new Map<string, number>();
  let anonymousVotesMap = new Map<string, number>();

  if (pollIds.length > 0) {
    const [identifiedVotesByPoll, anonymousVotesByPoll] = await Promise.all([
      prisma.vote.groupBy({
        by: ["pollId"],
        where: {
          pollId: { in: pollIds },
          voterEmail: { not: null },
        },
        _count: { _all: true },
      }),
      prisma.vote.groupBy({
        by: ["pollId"],
        where: {
          pollId: { in: pollIds },
          voterEmail: null,
        },
        _count: { _all: true },
      }),
    ]);

    identifiedVotesMap = new Map(
      identifiedVotesByPoll.map((entry) => [entry.pollId, entry._count._all]),
    );
    anonymousVotesMap = new Map(
      anonymousVotesByPoll.map((entry) => [entry.pollId, entry._count._all]),
    );
  }

  let totalsFromRedis: Array<number | null> = [];
  if (polls.length > 0 && redis) {
    try {
      const totalsRaw = await redis.mget(polls.map((poll) => `poll:${poll.id}:total`));
      totalsFromRedis = totalsRaw.map((value) => (value ? Number(value) || 0 : null));
    } catch {
      totalsFromRedis = [];
    }
  }

  let responsePolls = polls.map((poll, index) => ({
    id: poll.id,
    question: poll.question,
    createdAt: poll.createdAt.toISOString(),
    totalVotes: totalsFromRedis[index] ?? poll._count.votes,
    isOpen: poll.isOpen,
    allowAnonymousVotes: poll.allowAnonymousVotes,
    collectVoterEmail: poll.collectVoterEmail,
    identifiedVotes: identifiedVotesMap.get(poll.id) ?? 0,
    anonymousVotes: anonymousVotesMap.get(poll.id) ?? 0,
  }));

  if (Number.isFinite(minVotes)) {
    responsePolls = responsePolls.filter((poll) => poll.totalVotes >= Number(minVotes));
  }
  if (Number.isFinite(maxVotes)) {
    responsePolls = responsePolls.filter((poll) => poll.totalVotes <= Number(maxVotes));
  }
  if (isVoteSort) {
    responsePolls.sort((a, b) =>
      compareNumbers(a.totalVotes, b.totalVotes, voteSortOrder),
    );
  } else {
    responsePolls.sort((a, b) =>
      compareDates(new Date(a.createdAt), new Date(b.createdAt), voteSortOrder),
    );
  }

  return NextResponse.json({ polls: responsePolls });
}
