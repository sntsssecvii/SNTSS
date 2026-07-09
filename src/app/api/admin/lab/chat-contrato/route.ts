import { NextRequest, NextResponse } from "next/server";

import {
  answerContractQuestion,
  getContractChatStatus,
} from "@/lib/contract-chat";
import { getCachedAnswer, setCachedAnswer } from "@/lib/firebase/chat-cache";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, {
      bucket: "api:admin:lab:chat-contrato:status",
      limit: 60,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    return NextResponse.json({
      success: true,
      data: await getContractChatStatus(),
    });
  } catch (error: any) {
    console.error("Error obteniendo estado del chat del contrato:", error);

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

    if (error?.message === "SUPER_ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "Se requiere acceso de Admin Global." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: error?.message || "No se pudo obtener el estado del chatbot." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, {
      bucket: "api:admin:lab:chat-contrato",
      limit: 20,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const body = (await request.json()) as {
      query?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };
    const query = body.query || "";
    const history = body.history || [];

    // Check cache first (only for queries without conversation context)
    if (history.length === 0 && query.trim().length >= 5) {
      const cached = await getCachedAnswer(query);
      if (cached) {
        return NextResponse.json({
          success: true,
          data: {
            answer: cached.answer,
            query,
            generatedAt: new Date().toISOString(),
            sourceCount: cached.sourceCount,
            answerMode: "cached",
            sources: cached.sources.map((s, i) => ({
              chunk: {
                id: `cached-${i}`,
                pageNumber: s.pageNumber,
                clauseNumber: s.clauseNumber,
                clauseTitle: s.clauseTitle,
                text: "",
              },
              score: s.score,
              semanticScore: 0,
              keywordScore: 0,
              matchedTerms: [],
              excerpt: s.excerpt,
            })),
            diagnostics: { cached: true },
          },
        });
      }
    }

    const answer = await answerContractQuestion(query, history);

    // Cache the answer for future queries (only fresh, non-conversational)
    if (
      history.length === 0 &&
      answer.sourceCount > 0 &&
      answer.answerMode === "groq"
    ) {
      setCachedAnswer(
        query,
        answer.answer,
        answer.sources.map((s) => ({
          pageNumber: s.chunk.pageNumber,
          clauseNumber: s.chunk.clauseNumber,
          clauseTitle: s.chunk.clauseTitle,
          excerpt: s.excerpt,
          score: s.score,
        })),
      ).catch((e) => console.error("Error caching answer:", e));
    }

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

    if (error?.message === "SUPER_ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "Se requiere acceso de Admin Global." },
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
