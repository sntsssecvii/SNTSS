import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import {
  listarLotes,
  crearLote,
  obtenerLoteAbierto,
  obtenerLote,
  generarNombreLote,
} from "@/lib/firebase/escalafon-lotes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let ctx: { uid: string; email: string | null } | null = null;
  try {
    ctx = await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "escalafon-lotes-get",
      limit: 30,
      windowMs: 60_000,
    });
    void ctx;
    const lotes = await listarLotes();
    return NextResponse.json({ lotes });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[escalafon/lotes GET]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let ctx: { uid: string; email: string | null } | null = null;
  try {
    ctx = await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "escalafon-lotes-post",
      limit: 10,
      windowMs: 60_000,
    });

    // Verificar que no hay lote abierto
    const abierto = await obtenerLoteAbierto();
    if (abierto) {
      return NextResponse.json(
        { error: `Ya existe un lote abierto: "${abierto.nombre}"` },
        { status: 409 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { nombre?: string };
    const nombre = body.nombre?.trim() || generarNombreLote();

    const loteId = await crearLote(nombre, ctx!.uid);
    const lote = await obtenerLote(loteId);

    return NextResponse.json({ loteId, lote }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[escalafon/lotes POST]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
