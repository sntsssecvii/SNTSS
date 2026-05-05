import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { RateLimitError } from "@/lib/security/rate-limit";
import { updateConvenio, deleteConvenio } from "@/lib/firebase/convenios";

export const dynamic = "force-dynamic";

function handleError(error: any) {
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
    error?.message === "INSUFFICIENT_PERMISSIONS"
  )
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ error: "Error interno." }, { status: 500 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:convenios",
      limit: 30,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);
    const body = await request.json();
    await updateConvenio(params.id, {
      ...(body.titulo !== undefined && { titulo: body.titulo }),
      ...(body.link !== undefined && { link: body.link || undefined }),
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:convenios",
      limit: 20,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);
    const body = await request.json();
    if (!body.imageUrl)
      return NextResponse.json(
        { error: "imageUrl requerida." },
        { status: 400 },
      );
    await deleteConvenio(params.id, body.imageUrl);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return handleError(error);
  }
}
