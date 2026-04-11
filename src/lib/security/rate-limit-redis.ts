import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

import { RateLimitError, getClientIp } from "@/lib/security/rate-limit";

function buildRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = buildRedisClient();

const limiters: Record<string, Ratelimit> = {};

function getLimiter(limit: number, windowSeconds: number): Ratelimit {
  const key = `${limit}:${windowSeconds}`;
  if (!limiters[key]) {
    if (!redis)
      throw new Error("Redis no configurado para rate limiting distribuido");
    limiters[key] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      analytics: false,
    });
  }
  return limiters[key];
}

export async function enforceRateLimitRedis(
  request: NextRequest,
  options: {
    bucket: string;
    limit: number;
    windowMs: number;
    identifier?: string;
  },
): Promise<void> {
  if (!redis) {
    console.warn(
      "[rate-limit-redis] Redis no disponible, rate limit distribuido deshabilitado",
    );
    return;
  }

  const identifier = options.identifier || getClientIp(request);
  const windowSeconds = Math.ceil(options.windowMs / 1000);
  const limiter = getLimiter(options.limit, windowSeconds);
  const { success, reset } = await limiter.limit(
    `${options.bucket}:${identifier}`,
  );

  if (!success) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((reset - Date.now()) / 1000),
    );
    throw new RateLimitError(retryAfterSeconds);
  }
}
