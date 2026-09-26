import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireDeveloperRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { POSITION_LOOKUP_COLLECTION } from "@/lib/bolsa-de-trabajo/position-materialization";
import type { BolsaPosicionMaterializada } from "@/types/bolsa-de-trabajo";

export const dynamic = "force-dynamic";

/**
 * Listados generales por categoría (solo developer, por ahora).
 * Devuelve las posiciones materializadas de un documento de bolsa; el filtrado
 * (tipo, zona, categoría, base/interinato, etc.) se hace en el cliente.
 */
export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:bolsa:listados-generales",
      limit: 20,
      windowMs: 60_000,
    });
    await requireDeveloperRequest(request);

    const documentoId = request.nextUrl.searchParams.get("documentoId")?.trim();
    if (!documentoId) {
      return NextResponse.json({ error: "documentoId requerido." }, { status: 400 });
    }

    const snap = await adminDb
      .collection(POSITION_LOOKUP_COLLECTION)
      .where("documentoId", "==", documentoId)
      .get();

    const data = snap.docs.map((d) => {
      const p = d.data() as BolsaPosicionMaterializada;
      return {
        matricula: p.matricula,
        nombre: p.nombre,
        tipoDocumento: p.tipoDocumento,
        categoria: p.categoria,
        zona: p.zona,
        posicionBase: p.posicionBase,
        totalEnCategoria: p.totalEnCategoria,
        posicionInterinato: p.posicionInterinato ?? null,
        totalEventualesEnCategoria: p.totalEventualesEnCategoria ?? null,
        tipoContratacion: p.tipoContratacion ?? null,
        adscripcionNueva: p.adscripcionNueva ?? null,
        turnoNuevo: p.turnoNuevo ?? null,
        grupoComparable: p.grupoComparable ?? {},
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
    }
    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (
      ["ADMIN_REQUIRED", "SUPER_ADMIN_REQUIRED", "DEVELOPER_REQUIRED"].includes(error?.message)
    ) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json({ error: "Error al cargar listados." }, { status: 500 });
  }
}
