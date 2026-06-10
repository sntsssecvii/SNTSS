import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import {
  obtenerLoteCambios,
  listarListadosDelLoteCambios,
  actualizarLoteCambios,
  consolidarListadosEnLoteCambios,
} from "@/lib/firebase/cambios-escalafon-lotes";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { loteId: string } },
) {
  try {
    await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "cambios-lote-get",
      limit: 30,
      windowMs: 60_000,
    });

    const lote = await obtenerLoteCambios(params.loteId);
    if (!lote) {
      return NextResponse.json(
        { error: "Lote no encontrado" },
        { status: 404 },
      );
    }

    const listados = await listarListadosDelLoteCambios(params.loteId);
    const todosSnap = await adminDb.collection("cambios_listados").get();
    const listadosEnOtrosLotes = todosSnap.size - listados.length;

    return NextResponse.json({ lote, listados, listadosEnOtrosLotes });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[cambios-escalafon/lotes/[loteId] GET]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { loteId: string } },
) {
  try {
    await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "cambios-lote-patch",
      limit: 10,
      windowMs: 60_000,
    });

    const lote = await obtenerLoteCambios(params.loteId);
    if (!lote) {
      return NextResponse.json(
        { error: "Lote no encontrado" },
        { status: 404 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      nombre?: string;
      estado?: "CERRADO";
    };

    if (lote.estado === "CERRADO" && body.estado === "CERRADO") {
      return NextResponse.json({ ok: true });
    }
    if (lote.estado === "CERRADO" && body.estado) {
      return NextResponse.json(
        { error: "No se puede modificar el estado de un lote cerrado" },
        { status: 400 },
      );
    }

    const update: { nombre?: string; estado?: "CERRADO" } = {};
    if (body.nombre?.trim()) update.nombre = body.nombre.trim();
    if (body.estado === "CERRADO") update.estado = "CERRADO";

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    let consolidados = 0;
    if (update.estado === "CERRADO") {
      consolidados = await consolidarListadosEnLoteCambios(params.loteId);
    }
    await actualizarLoteCambios(params.loteId, update);
    return NextResponse.json({ ok: true, consolidados });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[cambios-escalafon/lotes/[loteId] PATCH]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
