import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import {
  obtenerLote,
  listarListadosDelLote,
  actualizarLote,
} from "@/lib/firebase/escalafon-lotes";

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
      bucket: "escalafon-lote-get",
      limit: 30,
      windowMs: 60_000,
    });

    const lote = await obtenerLote(params.loteId);
    if (!lote) {
      return NextResponse.json(
        { error: "Lote no encontrado" },
        { status: 404 },
      );
    }

    const listados = await listarListadosDelLote(params.loteId);
    return NextResponse.json({ lote, listados });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[escalafon/lotes/[loteId] GET]", error);
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
      bucket: "escalafon-lote-patch",
      limit: 10,
      windowMs: 60_000,
    });

    const lote = await obtenerLote(params.loteId);
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

    // Si ya está cerrado y se pide cerrarlo, responder ok (idempotente)
    if (lote.estado === "CERRADO" && body.estado === "CERRADO") {
      return NextResponse.json({ ok: true });
    }
    // No se puede reabrir un lote cerrado
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

    await actualizarLote(params.loteId, update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[escalafon/lotes/[loteId] PATCH]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
