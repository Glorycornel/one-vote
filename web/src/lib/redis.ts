import Redis from "ioredis";

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

const redisUrl = process.env.REDIS_URL;

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  redisUrl && redisUrl.length > 0
    ? (globalForRedis.redis ??
      new Redis(normalizeRedisUrl(redisUrl), {
        maxRetriesPerRequest: 2,
      }))
    : null;

if (redis) {
  redis.on("error", (error) => {
    console.error("Redis error", error);
  });
}

if (process.env.NODE_ENV !== "production" && redis) {
  globalForRedis.redis = redis;
}
