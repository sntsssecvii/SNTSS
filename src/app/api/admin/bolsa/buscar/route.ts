import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { POSITION_LOOKUP_COLLECTION } from "@/lib/bolsa-de-trabajo/position-materialization";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { NOMBRES_TIPOS } from "@/types/bolsa-de-trabajo";
import type {
  BolsaPosicionMaterializada,
  Sincronizacion,
} from "@/types/bolsa-de-trabajo";

function convertirTimestamp(timestamp: any): Date {
  if (timestamp?.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date();
}

const NOMBRES_MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatPeriodo(sync: Sincronizacion) {
  const mesNombre = NOMBRES_MESES[sync.mes - 1] || String(sync.mes);
  return `${sync.quincena}ª quincena / ${mesNombre} ${sync.anio}`;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:bolsa:buscar",
      limit: 60,
      windowMs: 60_000,
    });

    await requireAdminRequest(request);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ data: { resultados: [], periodo: null } });
    }

    // Obtener la sincronización activa
    const syncSnap = await adminDb
      .collection("sincronizaciones")
      .where("esFuenteVerdad", "==", true)
      .limit(1)
      .get();

    if (syncSnap.empty) {
      return NextResponse.json({
        data: { resultados: [], periodo: null, sinQuincenaActiva: true },
      });
    }

    const syncDoc = syncSnap.docs[0];
    const syncData = syncDoc.data();
    const sync: Sincronizacion = {
      id: syncDoc.id,
      anio: syncData.anio,
      mes: syncData.mes,
      quincena: syncData.quincena,
      estado: syncData.estado,
      fechaInicio: convertirTimestamp(syncData.fechaInicio),
      fechaFinalizacion: syncData.fechaFinalizacion
        ? convertirTimestamp(syncData.fechaFinalizacion)
        : undefined,
      archivosSubidos: syncData.archivosSubidos || [],
      esFuenteVerdad: true,
      subidoPor: syncData.subidoPor,
      subidoPorEmail: syncData.subidoPorEmail,
    };

    // Búsqueda por prefijo usando el ID del documento: syncId__MATRICULA__...
    // No requiere índice compuesto porque usa FieldPath.documentId()
    const matriculaNorm = q.toUpperCase();
    const prefixStart = `${sync.id}__${matriculaNorm}`;
    const prefixEnd = `${sync.id}__${matriculaNorm}\uf8ff`;

    const snapshot = await adminDb
      .collection(POSITION_LOOKUP_COLLECTION)
      .where(FieldPath.documentId(), ">=", prefixStart)
      .where(FieldPath.documentId(), "<=", prefixEnd)
      .limit(20)
      .get();

    const posiciones = snapshot.docs.map(
      (doc) => doc.data() as BolsaPosicionMaterializada,
    );

    const resultados = posiciones.map((pos) => ({
      nombre: pos.nombre,
      matricula: pos.matricula,
      tipoDocumento: pos.tipoDocumento,
      tipoLabel: NOMBRES_TIPOS[pos.tipoDocumento],
      posicionBase: pos.posicionBase,
      posicionInterinato: pos.posicionInterinato ?? null,
      categoria: pos.categoria,
      zona: pos.zona,
      adscripcionNueva: pos.adscripcionNueva ?? null,
      turnoNuevo: pos.turnoNuevo ?? null,
    }));

    return NextResponse.json({
      data: {
        resultados,
        periodo: formatPeriodo(sync),
        syncId: sync.id,
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas consultas. Intenta en un momento." },
        { status: 429 },
      );
    }
    if (error instanceof Error) {
      if (
        error.message === "AUTH_REQUIRED" ||
        error.message === "ADMIN_REQUIRED" ||
        error.message === "PROFILE_NOT_FOUND" ||
        error.message === "ACCOUNT_INACTIVE"
      ) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
    }
    console.error("[buscar-bolsa] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
