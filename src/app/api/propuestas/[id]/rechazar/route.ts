import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import { getPropuestaById, rechazarPropuesta } from "@/lib/firebase/propuestas";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({ motivo: z.string().min(10).max(500) });

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    enforceRateLimit(request, {
      bucket: "api:propuestas:rechazar",
      limit: 30,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role)) {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "El motivo es requerido (mín. 10 caracteres)." },
        { status: 400 },
      );
    }

    const propuesta = await getPropuestaById(params.id);
    if (!propuesta)
      return NextResponse.json(
        { error: "Propuesta no encontrada." },
        { status: 404 },
      );
    if (propuesta.estado !== "PENDIENTE") {
      return NextResponse.json(
        { error: "Solo se pueden rechazar propuestas PENDIENTES." },
        { status: 422 },
      );
    }

    await rechazarPropuesta(params.id, parsed.data.motivo, adminUser.uid);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof RateLimitError)
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        { status: 429 },
      );
    if (error?.message === "AUTH_REQUIRED")
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    if (error?.message === "ADMIN_REQUIRED")
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    console.error("[rechazar]", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
