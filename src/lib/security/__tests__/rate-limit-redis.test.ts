import { describe, it, expect, vi } from "vitest";

describe("rate-limit-redis", () => {
  it("falls back gracefully when Redis is not configured", async () => {
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    vi.resetModules();
    const { enforceRateLimitRedis } =
      await import("@/lib/security/rate-limit-redis");

    const mockRequest = {
      headers: { get: () => null },
      url: "http://localhost/api/test",
      ip: undefined,
    } as any;

    await expect(
      enforceRateLimitRedis(mockRequest, {
        bucket: "test",
        limit: 10,
        windowMs: 60_000,
      }),
    ).resolves.not.toThrow();

    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });
});
