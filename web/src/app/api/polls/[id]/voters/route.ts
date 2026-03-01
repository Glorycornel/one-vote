import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, getSessionUserByToken } from "@/lib/auth";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: Params) {
  const { id: pollId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const user = await getSessionUserByToken(token);

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to view voters." },
      { status: 401 },
    );
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: {
      id: true,
      question: true,
      creatorId: true,
      collectVoterEmail: true,
    },
  });

  if (!poll) {
    return NextResponse.json({ error: "Poll not found." }, { status: 404 });
  }

  if (poll.creatorId !== user.id) {
    return NextResponse.json(
      { error: "Only the poll creator can view voter details." },
      { status: 403 },
    );
  }

  if (!poll.collectVoterEmail) {
    return NextResponse.json(
      { error: "This poll does not collect voter emails." },
      { status: 400 },
    );
  }

  const votes = await prisma.vote.findMany({
    where: {
      pollId,
      voterEmail: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      voterEmail: true,
      createdAt: true,
      option: {
        select: {
          text: true,
        },
      },
    },
  });

  return NextResponse.json({
    pollId: poll.id,
    question: poll.question,
    voters: votes.map((vote) => ({
      email: vote.voterEmail,
      optionText: vote.option.text,
      votedAt: vote.createdAt.toISOString(),
    })),
  });
}
