import { NextRequest, NextResponse } from "next/server";

import { answerContractQuestion } from "@/lib/contract-chat";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, {
      bucket: "api:admin:lab:chat-contrato",
      limit: 20,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const body = (await request.json()) as { query?: string };
    const answer = await answerContractQuestion(body.query || "");

    return NextResponse.json({
      success: true,
      data: answer,
    });
  } catch (error: any) {
    console.error("Error en sandbox de chat del contrato:", error);

    if (error?.message === "CORS_FORBIDDEN") {
      return NextResponse.json(
        { error: "Acceso no permitido." },
        { status: 403 },
      );
    }

    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }

    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (error?.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Perfil de administrador no encontrado." },
        { status: 404 },
      );
    }

    if (error?.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { error: "La cuenta no está activa." },
        { status: 403 },
      );
    }

    if (error?.message === "ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "Se requiere perfil de administrador." },
        { status: 403 },
      );
    }

    if (error?.message === "QUERY_REQUIRED") {
      return NextResponse.json(
        { error: "Escribe una pregunta para consultar el contrato." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message || "No se pudo resolver la consulta del contrato.",
      },
      { status: 500 },
    );
  }
}
