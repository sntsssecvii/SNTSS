import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import type {
  BolsaDeTrabajoDocumento,
  Sincronizacion,
} from "@/types/bolsa-de-trabajo";

function convertirTimestamp(timestamp: any): Date {
  if (timestamp?.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date();
}

function convertirSincronizacion(doc: any): Sincronizacion {
  const data = doc.data();
  return {
    id: doc.id,
    anio: data.anio,
    mes: data.mes,
    quincena: data.quincena,
    estado: data.estado,
    fechaInicio: convertirTimestamp(data.fechaInicio),
    fechaFinalizacion: data.fechaFinalizacion
      ? convertirTimestamp(data.fechaFinalizacion)
      : undefined,
    archivosSubidos: data.archivosSubidos || [],
    esFuenteVerdad: data.esFuenteVerdad || false,
    subidoPor: data.subidoPor,
    subidoPorEmail: data.subidoPorEmail,
    syncAnteriorId: data.syncAnteriorId ?? null,
  };
}

function convertirDocumento(doc: any): BolsaDeTrabajoDocumento {
  const data = doc.data();
  return {
    id: doc.id,
    syncId: data.syncId,
    tipo: data.tipo,
    fechaActualizacion: convertirTimestamp(data.fechaActualizacion),
    fechaCarga: convertirTimestamp(data.fechaCarga),
    subidoPor: data.subidoPor,
    subidoPorEmail: data.subidoPorEmail,
    estado: data.estado,
    urlArchivo: data.urlArchivo,
    nombreArchivo: data.nombreArchivo,
    metadata: data.metadata || {},
    registros: [],
    errores: data.errores || [],
    version: data.version || 1,
    totalRegistros: data.totalRegistros || 0,
    registrosValidados: data.registrosValidados || 0,
    registrosConErrores: data.registrosConErrores || 0,
  };
}

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ syncId: string }> },
) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:bolsa:quincena-detalle",
      limit: 60,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const { syncId } = await params;
    const syncSnap = await adminDb
      .collection("sincronizaciones")
      .doc(syncId)
      .get();

    if (!syncSnap.exists) {
      return NextResponse.json(
        { error: "La quincena solicitada no existe." },
        { status: 404 },
      );
    }

    const docsSnap = await adminDb
      .collection("bolsa_de_trabajo_documentos")
      .where("syncId", "==", syncId)
      .orderBy("fechaCarga", "desc")
      .get();

    return NextResponse.json({
      success: true,
      data: {
        sync: convertirSincronizacion(syncSnap),
        documentos: docsSnap.docs.map(convertirDocumento),
      },
    });
  } catch (error: any) {
    console.error("Error obteniendo detalle de quincena de bolsa:", error);

    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }

    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (error?.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Perfil de administrador no encontrado." },
        { status: 404 },
      );
    }

    if (error?.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { error: "La cuenta no está activa." },
        { status: 403 },
      );
    }

    if (error?.message === "ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "Se requiere perfil de administrador." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        error: "No se pudo obtener el detalle de la quincena.",
        details: error?.message || "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}
