import type { NextRequest } from "next/server";

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowMs: number;
  identifier?: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __sntssRateLimitStore__: Map<string, RateLimitEntry> | undefined;
}

const rateLimitStore =
  globalThis.__sntssRateLimitStore__ ?? new Map<string, RateLimitEntry>();

if (!globalThis.__sntssRateLimitStore__) {
  globalThis.__sntssRateLimitStore__ = rateLimitStore;
}

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("RATE_LIMITED");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function enforceRateLimit(
  request: NextRequest,
  options: RateLimitOptions,
) {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const identifier = options.identifier || getClientIp(request);
  const key = `${options.bucket}:${identifier}`;
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return;
  }

  if (current.count >= options.limit) {
    throw new RateLimitError(
      Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    );
  }

  rateLimitStore.set(key, {
    ...current,
    count: current.count + 1,
  });
}
