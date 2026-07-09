import { NextRequest, NextResponse } from "next/server";

import {
  deleteChatSession,
  getChatSession,
  updateChatSession,
} from "@/lib/firebase/chat-sessions";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, {
      bucket: "api:admin:lab:chat-contrato:sessions:get",
      limit: 30,
      windowMs: 60_000,
    });
    const ctx = await requireAdminRequest(request);

    const session = await getChatSession(params.id, ctx.uid);
    if (!session) {
      return NextResponse.json(
        { error: "Sesión no encontrada." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: session });
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
      { error: error?.message || "Error obteniendo sesión." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, {
      bucket: "api:admin:lab:chat-contrato:sessions:update",
      limit: 30,
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

    await updateChatSession(params.id, ctx.uid, messages, body.title);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (error?.message === "SESSION_NOT_FOUND") {
      return NextResponse.json(
        { error: "Sesión no encontrada." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: error?.message || "Error actualizando sesión." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, {
      bucket: "api:admin:lab:chat-contrato:sessions:delete",
      limit: 10,
      windowMs: 60_000,
    });
    const ctx = await requireAdminRequest(request);

    await deleteChatSession(params.id, ctx.uid);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (error?.message === "SESSION_NOT_FOUND") {
      return NextResponse.json(
        { error: "Sesión no encontrada." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: error?.message || "Error eliminando sesión." },
      { status: 500 },
    );
  }
}
