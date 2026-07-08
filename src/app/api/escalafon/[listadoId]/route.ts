import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import {
  obtenerListado,
  obtenerAspirantes,
  eliminarListado,
} from "@/lib/firebase/escalafon";
import { decrementarTotalListados } from "@/lib/firebase/escalafon-lotes";

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
    const listado = await obtenerListado(params.listadoId);
    if (!listado) {
      return NextResponse.json(
        { error: "Listado no encontrado" },
        { status: 404 },
      );
    }

    const aspirantes = await obtenerAspirantes(params.listadoId);
    return NextResponse.json({ listado, aspirantes });
  } catch (error) {
    console.error("[escalafon/listadoId]", error);
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
      bucket: "escalafon-listado-delete",
      limit: 20,
      windowMs: 60_000,
    });

    const listado = await obtenerListado(params.listadoId);
    if (!listado) {
      return NextResponse.json(
        { error: "Listado no encontrado" },
        { status: 404 },
      );
    }

    // Borra el listado y todos sus aspirantes (batch en la capa de Firebase).
    await eliminarListado(params.listadoId);

    if (listado.loteId) {
      await decrementarTotalListados(listado.loteId);
    }

    await writeAdminAuditLog({
      action: "ESCALAFON_LISTADO_ELIMINADO",
      actorUid: ctx!.uid,
      actorEmail: ctx!.email ?? undefined,
      targetType: "escalafon_listado",
      targetId: params.listadoId,
      status: "SUCCESS",
      metadata: {
        categoria: listado.categoriaDesc,
        area: listado.areaCode,
        loteId: listado.loteId ?? null,
        aspirantesParsed: listado.aspirantesParsed,
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
    console.error("[escalafon/listadoId DELETE]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
