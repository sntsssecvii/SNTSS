import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import {
  obtenerListadoCambios,
  obtenerRegistros,
  eliminarListadoCambios,
} from "@/lib/firebase/cambios-escalafon";
import { decrementarTotalListadosCambios } from "@/lib/firebase/cambios-escalafon-lotes";
import {
  calcularLugaresPorRegistro,
  claveRegistro,
} from "@/lib/cambios-escalafon/position-engine";

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

    // Posiciones calculadas al vuelo (cada listado es independiente).
    const lugares = calcularLugaresPorRegistro(registros);
    const registrosConLugar = registros.map((r) => {
      const l = lugares.get(claveRegistro(r));
      return {
        ...r,
        lugar: l?.lugar ?? null,
        totalEnGrupo: l?.totalEnGrupo ?? null,
        grupoUnidad: l?.unidad ?? null,
        grupoTurno: l?.turno ?? null,
      };
    });

    return NextResponse.json({ listado, registros: registrosConLugar });
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { listadoId: string } },
) {
  let ctx: { uid: string; email: string | null } | null = null;
  try {
    ctx = await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "cambios-listado-delete",
      limit: 20,
      windowMs: 60_000,
    });

    const listado = await obtenerListadoCambios(params.listadoId);
    if (!listado) {
      return NextResponse.json(
        { error: "Listado no encontrado" },
        { status: 404 },
      );
    }

    // Elimina el listado y todos sus registros (batch en la capa de Firebase).
    await eliminarListadoCambios(params.listadoId);

    if (listado.loteId) {
      await decrementarTotalListadosCambios(listado.loteId);
    }

    await writeAdminAuditLog({
      action: "CAMBIOS_LISTADO_ELIMINADO",
      actorUid: ctx!.uid,
      actorEmail: ctx!.email ?? undefined,
      targetType: "cambios_listado",
      targetId: params.listadoId,
      status: "SUCCESS",
      metadata: {
        categoria: listado.categoriaCode,
        concepto: listado.concepto,
        area: listado.area,
        loteId: listado.loteId ?? null,
        registrosParsed: listado.registrosParsed,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[cambios-escalafon/[listadoId] DELETE]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
