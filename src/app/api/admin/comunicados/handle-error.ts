import { NextResponse } from "next/server";
import { RateLimitError } from "@/lib/security/rate-limit";

export function handleError(error: any) {
  if (error?.message === "CORS_FORBIDDEN")
    return NextResponse.json(
      { error: "Acceso no permitido." },
      { status: 403 },
    );
  if (error instanceof RateLimitError || error?.message === "RATE_LIMITED")
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      { status: 429 },
    );
  if (
    error?.message === "AUTH_REQUIRED" ||
    error?.message === "ADMIN_REQUIRED" ||
    error?.message === "ACCOUNT_INACTIVE" ||
    error?.message === "PROFILE_NOT_FOUND"
  )
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  console.error("[comunicados] Error:", error);
  return NextResponse.json({ error: "Error interno." }, { status: 500 });
}
