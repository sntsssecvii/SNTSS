import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import { crearAsignacion, listAsignaciones } from "@/lib/firebase/asignaciones";
import { decrementarPartida } from "@/lib/firebase/requerimientos";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CrearSchema = z.object({
  propuestaId: z.string().min(1),
  requerimientoId: z.string().min(1),
  zona: z.string().min(1),
  categoria: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:asignaciones:list",
      limit: 60,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role))
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const asignaciones = await listAsignaciones();
    return NextResponse.json({ asignaciones });
  } catch (error: any) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:asignaciones:create",
      limit: 30,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role))
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const body = await request.json();
    const parsed = CrearSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    // Decrementar disponibilidad en transacción antes de crear asignación
    await decrementarPartida(
      parsed.data.requerimientoId,
      parsed.data.zona,
      parsed.data.categoria,
    );
    const id = await crearAsignacion({
      ...parsed.data,
      asignadoPor: adminUser.uid,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "SIN_DISPONIBILIDAD")
      return NextResponse.json(
        { error: "No hay disponibilidad para esa partida." },
        { status: 422 },
      );
    if (error?.message === "PARTIDA_NOT_FOUND")
      return NextResponse.json(
        { error: "Partida no encontrada." },
        { status: 404 },
      );
    return handleError(error);
  }
}

function handleError(error: any) {
  if (error instanceof RateLimitError)
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      { status: 429 },
    );
  if (error?.message === "AUTH_REQUIRED")
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (error?.message === "ADMIN_REQUIRED")
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  console.error("[api/asignaciones]", error);
  return NextResponse.json({ error: "Error interno." }, { status: 500 });
}
