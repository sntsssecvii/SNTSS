import type { NextRequest } from "next/server";

function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sntssvii.com";
  return [appUrl, "http://localhost:3000"];
}

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");

  // Sin header Origin = server-to-server (curl, Postman, etc.) — permitir
  // CORS es una protección exclusiva del browser
  if (!origin) return;

  if (!getAllowedOrigins().includes(origin)) {
    throw new Error("CORS_FORBIDDEN");
  }
}
