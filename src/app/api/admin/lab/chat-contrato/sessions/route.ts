import { NextRequest, NextResponse } from "next/server";

import {
  createChatSession,
  listChatSessions,
} from "@/lib/firebase/chat-sessions";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, {
      bucket: "api:admin:lab:chat-contrato:sessions",
      limit: 30,
      windowMs: 60_000,
    });
    const ctx = await requireAdminRequest(request);

    const sessions = await listChatSessions(ctx.uid);
    return NextResponse.json({ success: true, data: sessions });
  } catch (error: any) {
    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: error?.message || "Error listando sesiones." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, {
      bucket: "api:admin:lab:chat-contrato:sessions:create",
      limit: 20,
      windowMs: 60_000,
    });
    const ctx = await requireAdminRequest(request);

    const body = (await request.json()) as {
      title?: string;
      messages?: Array<{
        role: "user" | "assistant";
        content: string;
        sources?: any[];
        createdAt?: string;
      }>;
    };

    const title = body.title || "Nueva conversación";
    const messages = (body.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
      sources: m.sources?.map((s: any) => ({
        pageNumber: s.chunk?.pageNumber || s.pageNumber,
        clauseNumber: s.chunk?.clauseNumber || s.clauseNumber,
        clauseTitle: s.chunk?.clauseTitle || s.clauseTitle,
        excerpt: s.excerpt || "",
      })),
      createdAt: m.createdAt || new Date().toISOString(),
    }));

    const sessionId = await createChatSession(ctx.uid, title, messages);
    return NextResponse.json({ success: true, data: { id: sessionId } });
  } catch (error: any) {
    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: error?.message || "Error creando sesión." },
      { status: 500 },
    );
  }
}
