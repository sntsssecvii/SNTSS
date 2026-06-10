import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import {
  obtenerListadoCambios,
  obtenerRegistros,
} from "@/lib/firebase/cambios-escalafon";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { listadoId: string } },
) {
  try {
    await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "cambios-listado-get",
      limit: 30,
      windowMs: 60_000,
    });

    const listado = await obtenerListadoCambios(params.listadoId);
    if (!listado) {
      return NextResponse.json(
        { error: "Listado no encontrado" },
        { status: 404 },
      );
    }

    const registros = await obtenerRegistros(params.listadoId);
    return NextResponse.json({ listado, registros });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[cambios-escalafon/[listadoId] GET]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
