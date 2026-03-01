import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getSessionCookieName, getSessionUserByToken } from "@/lib/auth";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: NextRequest, { params }: Params) {
  const { id: pollId } = await params;

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!poll) {
    return NextResponse.json({ error: "Poll not found." }, { status: 404 });
  }

  let counts: Record<string, number> = {};
  let totalVotes = 0;

  if (redis) {
    const rawCounts = await redis.hgetall(`poll:${pollId}:counts`);
    counts = Object.entries(rawCounts).reduce<Record<string, number>>(
      (acc, [key, value]) => {
        acc[key] = Number(value) || 0;
        return acc;
      },
      {},
    );

    const totalRaw = await redis.get(`poll:${pollId}:total`);
    totalVotes = totalRaw ? Number(totalRaw) || 0 : 0;
  }

  if (!Object.keys(counts).length) {
    const groupedVotes = await prisma.vote.groupBy({
      by: ["optionId"],
      where: { pollId },
      _count: {
        optionId: true,
      },
    });

    counts = groupedVotes.reduce<Record<string, number>>((acc, group) => {
      acc[group.optionId] = group._count.optionId;
      return acc;
    }, {});
    totalVotes = Object.values(counts).reduce((sum, value) => sum + value, 0);
  }

  return NextResponse.json({
    pollId: poll.id,
    question: poll.question,
    isOpen: poll.isOpen,
    allowAnonymousVotes: poll.allowAnonymousVotes,
    collectVoterEmail: poll.collectVoterEmail,
    options: poll.options.map((option) => ({
      id: option.id,
      text: option.text,
    })),
    counts,
    totalVotes,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: pollId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const user = await getSessionUserByToken(token);

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to update a poll." },
      { status: 401 },
    );
  }

  let body: { isOpen?: boolean };
  try {
    body = (await request.json()) as { isOpen?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (typeof body.isOpen !== "boolean") {
    return NextResponse.json({ error: "Poll status must be provided." }, { status: 400 });
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { id: true, creatorId: true },
  });

  if (!poll) {
    return NextResponse.json({ error: "Poll not found." }, { status: 404 });
  }

  if (poll.creatorId !== user.id) {
    return NextResponse.json(
      { error: "Only the poll creator can update this poll." },
      { status: 403 },
    );
  }

  const updated = await prisma.poll.update({
    where: { id: pollId },
    data: { isOpen: body.isOpen },
  });

  if (redis) {
    await redis.set(`poll:${pollId}:open`, updated.isOpen ? "1" : "0");
  }

  return NextResponse.json({ pollId, isOpen: updated.isOpen });
}
