import { NextRequest, NextResponse } from "next/server";

import { submitFeedback } from "@/lib/firebase/chat-cache";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, {
      bucket: "api:admin:lab:chat-contrato:feedback",
      limit: 30,
      windowMs: 60_000,
    });
    const ctx = await requireAdminRequest(request);

    const body = (await request.json()) as {
      query?: string;
      answer?: string;
      rating?: number;
    };

    if (!body.query || !body.answer || !body.rating) {
      return NextResponse.json(
        { error: "Faltan campos requeridos." },
        { status: 400 },
      );
    }

    const rating = body.rating === 1 ? 1 : -1;
    await submitFeedback(ctx.uid, body.query, body.answer, rating);

    return NextResponse.json({ success: true });
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
      { error: error?.message || "Error guardando feedback." },
      { status: 500 },
    );
  }
}
