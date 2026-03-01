import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getSessionCookieName, getSessionUserByToken } from "@/lib/auth";

type CreatePollPayload = {
  question?: string;
  options?: string[];
  allowAnonymousVotes?: boolean;
  collectVoterEmail?: boolean;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const user = await getSessionUserByToken(token);

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to create a poll." },
      { status: 401 },
    );
  }

  let body: CreatePollPayload;
  try {
    body = (await request.json()) as CreatePollPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  const question = body.question?.trim();
  const options = body.options?.map((option) => option.trim()).filter(Boolean) ?? [];
  if (
    typeof body.allowAnonymousVotes !== "undefined" &&
    typeof body.allowAnonymousVotes !== "boolean"
  ) {
    return NextResponse.json(
      { error: "allowAnonymousVotes must be a boolean." },
      { status: 400 },
    );
  }
  if (
    typeof body.collectVoterEmail !== "undefined" &&
    typeof body.collectVoterEmail !== "boolean"
  ) {
    return NextResponse.json(
      { error: "collectVoterEmail must be a boolean." },
      { status: 400 },
    );
  }
  const allowAnonymousVotes = body.allowAnonymousVotes ?? true;
  const collectVoterEmail = body.collectVoterEmail ?? false;

  if (!question || options.length < 2) {
    return NextResponse.json(
      { error: "Question and at least two options are required." },
      { status: 400 },
    );
  }

  const poll = await prisma.poll.create({
    data: {
      question,
      creatorId: user.id,
      allowAnonymousVotes,
      collectVoterEmail,
      options: {
        create: options.map((text, index) => ({
          text,
          order: index,
        })),
      },
    },
    include: {
      options: true,
    },
  });

  if (redis) {
    const pipeline = redis.multi();
    pipeline.set(`poll:${poll.id}:open`, "1");
    pipeline.set(`poll:${poll.id}:total`, "0");
    for (const option of poll.options) {
      pipeline.hset(`poll:${poll.id}:counts`, option.id, "0");
    }
    await pipeline.exec();
  }

  return NextResponse.json({ pollId: poll.id });
}
