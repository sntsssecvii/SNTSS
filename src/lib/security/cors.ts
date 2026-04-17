import type { NextRequest } from "next/server";

function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sntssvii.com";
  const origins = [appUrl];

  // Agregar variante www/no-www automáticamente
  if (appUrl.includes("://www.")) {
    origins.push(appUrl.replace("://www.", "://"));
  } else if (appUrl.startsWith("https://") || appUrl.startsWith("http://")) {
    const [scheme, host] = appUrl.split("://");
    origins.push(`${scheme}://www.${host}`);
  }

  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000");
  }
  return origins;
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
