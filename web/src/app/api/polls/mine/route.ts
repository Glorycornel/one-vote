import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getSessionCookieName, getSessionUserByToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const user = await getSessionUserByToken(token);

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to view polls." },
      { status: 401 },
    );
  }

  const polls = await prisma.poll.findMany({
    where: { creatorId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { votes: true },
      },
    },
  });

  let totalsFromRedis: Array<number | null> = [];
  if (polls.length > 0 && redis) {
    try {
      const totalsRaw = await redis.mget(polls.map((poll) => `poll:${poll.id}:total`));
      totalsFromRedis = totalsRaw.map((value) => (value ? Number(value) || 0 : null));
    } catch {
      totalsFromRedis = [];
    }
  }

  return NextResponse.json({
    polls: polls.map((poll, index) => ({
      id: poll.id,
      question: poll.question,
      createdAt: poll.createdAt.toISOString(),
      totalVotes: totalsFromRedis[index] ?? poll._count.votes,
      isOpen: poll.isOpen,
    })),
  });
}
