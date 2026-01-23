import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, getSessionUserByToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const user = await getSessionUserByToken(token);

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to view joined polls." },
      { status: 401 },
    );
  }

  const participations = await prisma.pollParticipation.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "desc" },
    include: {
      poll: {
        select: {
          id: true,
          question: true,
        },
      },
    },
  });

  return NextResponse.json({
    polls: participations.map((entry) => ({
      id: entry.poll.id,
      question: entry.poll.question,
      joinedAt: entry.joinedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const user = await getSessionUserByToken(token);

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to track joined polls." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as { pollId?: string };
  if (!body.pollId) {
    return NextResponse.json({ error: "Poll ID is required." }, { status: 400 });
  }

  const poll = await prisma.poll.findUnique({
    where: { id: body.pollId },
    select: { id: true },
  });

  if (!poll) {
    return NextResponse.json({ error: "Poll not found." }, { status: 404 });
  }

  await prisma.pollParticipation.upsert({
    where: {
      userId_pollId: {
        userId: user.id,
        pollId: body.pollId,
      },
    },
    update: {
      joinedAt: new Date(),
    },
    create: {
      userId: user.id,
      pollId: body.pollId,
    },
  });

  return NextResponse.json({ ok: true });
}
