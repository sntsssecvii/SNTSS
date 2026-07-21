import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock del módulo antes de importar cors
vi.mock("next/server", () => ({
  NextRequest: class {
    headers: { get: (key: string) => string | null };
    constructor(url: string, options?: { headers?: Record<string, string> }) {
      this.headers = {
        get: (key: string) => options?.headers?.[key.toLowerCase()] ?? null,
      };
    }
  },
}));

function makeMockRequest(origin: string | null) {
  return {
    headers: {
      get: (key: string) => (key === "origin" ? origin : null),
    },
  } as any;
}

describe("assertSameOrigin", () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://sntssvii.com";
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  });

  it("permite requests sin header Origin (server-to-server)", async () => {
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest(null);
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("permite el origen de producción configurado en NEXT_PUBLIC_APP_URL", async () => {
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest("https://sntssvii.com");
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("permite localhost en desarrollo", async () => {
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest("http://localhost:3000");
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("permite otros puertos locales en desarrollo", async () => {
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest("http://localhost:3002");
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("lanza CORS_FORBIDDEN para un origen externo desconocido", async () => {
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest("https://evil.com");
    expect(() => assertSameOrigin(request)).toThrow("CORS_FORBIDDEN");
  });

  it("lanza CORS_FORBIDDEN para subdominio no autorizado", async () => {
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest("https://sub.sntssvii.com");
    expect(() => assertSameOrigin(request)).toThrow("CORS_FORBIDDEN");
  });

  it("rechaza localhost cuando NODE_ENV es production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";
    vi.resetModules();
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest("http://localhost:3002");
    expect(() => assertSameOrigin(request)).toThrow("CORS_FORBIDDEN");
    (process.env as any).NODE_ENV = originalNodeEnv;
  });
});
