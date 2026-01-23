import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  redisUrl && redisUrl.length > 0
    ? (globalForRedis.redis ??
      new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
      }))
    : null;

if (process.env.NODE_ENV !== "production" && redis) {
  globalForRedis.redis = redis;
}
