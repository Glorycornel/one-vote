import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";

const isAuthorized = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$queryRaw`SELECT 1`;

  if (redis) {
    const now = new Date().toISOString();
    await redis
      .multi()
      .set("keepalive:last_ping", now, "EX", 60 * 60 * 24)
      .get("keepalive:last_ping")
      .exec();
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
