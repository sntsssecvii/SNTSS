import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import { getPropuestaById, aprobarPropuesta } from "@/lib/firebase/propuestas";
import { generarFolio } from "@/lib/firebase/contadores";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    enforceRateLimit(request, {
      bucket: "api:propuestas:aprobar",
      limit: 30,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role)) {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }

    const propuesta = await getPropuestaById(params.id);
    if (!propuesta)
      return NextResponse.json(
        { error: "Propuesta no encontrada." },
        { status: 404 },
      );
    if (propuesta.estado !== "PENDIENTE") {
      return NextResponse.json(
        { error: "Solo se pueden aprobar propuestas PENDIENTES." },
        { status: 422 },
      );
    }

    const folio = await generarFolio();
    await aprobarPropuesta(params.id, folio, adminUser.uid);

    return NextResponse.json({ folio });
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
    console.error("[aprobar]", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
