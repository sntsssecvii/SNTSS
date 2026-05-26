import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import {
  createRequerimiento,
  listRequerimientos,
} from "@/lib/firebase/requerimientos";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PartidaSchema = z.object({
  zona: z.string().min(1),
  categoria: z.string().min(1),
  cantidadTotal: z.number().int().positive(),
});

const CrearSchema = z.object({
  numeroOficio: z.string().min(1).max(80),
  fechaCircular: z.string().datetime(),
  partidas: z.array(PartidaSchema).min(1),
});

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:requerimientos:list",
      limit: 60,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role))
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const requerimientos = await listRequerimientos();
    return NextResponse.json({ requerimientos });
  } catch (error: any) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:requerimientos:create",
      limit: 20,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role))
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const body = await request.json();
    const parsed = CrearSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Datos inválidos.", detalles: parsed.error.flatten() },
        { status: 400 },
      );
    const id = await createRequerimiento({
      ...parsed.data,
      fechaCircular: new Date(parsed.data.fechaCircular),
      creadoPor: adminUser.uid,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error: any) {
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
  console.error("[api/requerimientos]", error);
  return NextResponse.json({ error: "Error interno." }, { status: 500 });
}
