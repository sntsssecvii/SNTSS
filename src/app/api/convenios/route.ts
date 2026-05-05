import { NextRequest, NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { RateLimitError } from "@/lib/security/rate-limit";
import { getConveniosPublicos } from "@/lib/firebase/convenios";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:convenios",
      limit: 60,
      windowMs: 60_000,
    });
    await requireUserRequest(request);

    const convenios = await getConveniosPublicos();
    return NextResponse.json({
      success: true,
      data: convenios.map((c) => ({
        id: c.id,
        imageUrl: c.imageUrl,
        link: c.link,
        orden: c.orden,
      })),
    });
  } catch (error: any) {
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
    if (error?.message === "AUTH_REQUIRED")
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
