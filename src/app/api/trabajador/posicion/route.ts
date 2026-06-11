import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { calcularPosiciones } from "@/lib/bolsa-de-trabajo/calculos";
import { getComparisonRecordsForWorker } from "@/lib/bolsa-de-trabajo/comparison-groups";
import { getBolsaPosicionesMaterializadasPorMatricula } from "@/lib/firebase/bolsa-posiciones-materializadas";
import { requireUserRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { RateLimitError } from "@/lib/security/rate-limit";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import type {
  BolsaDeTrabajoRegistro,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";

export const dynamic = "force-dynamic";

function hasUsableMaterializedRecord(record: { recordId?: string | null }) {
  return Boolean(record.recordId?.trim());
}

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);

    await enforceRateLimitRedis(request, {
      bucket: "api:trabajador:posicion",
      limit: 20,
      windowMs: 60_000,
    });

    const context = await requireUserRequest(request);
    const matricula = context.matricula;

    if (!matricula) {
      return NextResponse.json(
        { error: "El usuario autenticado no tiene matrícula vinculada." },
        { status: 400 },
      );
    }

    // 1. Obtener la sincronización activa (Fuente de Verdad)
    const syncSnap = await adminDb
      .collection("sincronizaciones")
      .where("esFuenteVerdad", "==", true)
      .limit(1)
      .get();

    if (syncSnap.empty) {
      return NextResponse.json(
        { error: "No hay información oficial activa en este momento." },
        { status: 404 },
      );
    }

    const syncDoc = syncSnap.docs[0];
    const syncActiva = {
      id: syncDoc.id,
      ...syncDoc.data(),
    } as {
      id: string;
      anio: number;
      mes: number;
      quincena: number;
      oculto?: boolean;
    };

    if (syncActiva.oculto) {
      return NextResponse.json(
        {
          error:
            "El listado está en proceso de actualización. Intenta de nuevo en breve.",
          code: "SYNC_HIDDEN",
        },
        { status: 503 },
      );
    }

    const posicionesMaterializadas = (
      await getBolsaPosicionesMaterializadasPorMatricula(
        syncActiva.id,
        matricula,
      )
    )
      .filter(hasUsableMaterializedRecord)
      .sort(
        (a, b) =>
          a.tipoDocumento.localeCompare(b.tipoDocumento) ||
          a.documentoId.localeCompare(b.documentoId) ||
          (a.recordId || "").localeCompare(b.recordId || ""),
      );

    if (posicionesMaterializadas.length > 0) {
      const resultado = posicionesMaterializadas[0];

      return NextResponse.json({
        success: true,
        data: {
          ...resultado,
          tipoDocumento: resultado.tipoDocumento,
          registro: resultado.grupoComparable?.registro,
        },
        periodo: {
          anio: syncActiva.anio,
          mes: syncActiva.mes,
          quincena: syncActiva.quincena,
        },
      });
    }

    // 2. Obtener todos los documentos de esa sincronización
    const snapDocs = await adminDb
      .collection("bolsa_de_trabajo_documentos")
      .where("syncId", "==", syncActiva.id)
      .get();

    if (snapDocs.empty) {
      return NextResponse.json(
        { error: "No se encontraron listados para esta quincena." },
        { status: 404 },
      );
    }

    let dataTrabajador: BolsaDeTrabajoRegistro | null = null;
    let docIdEncontrado: string | null = null;
    let tipoDocumento: TipoBolsaDeTrabajo | null = null;

    for (const docSnap of snapDocs.docs) {
      const snapTrabajador = await docSnap.ref
        .collection("registros")
        .where("matricula", "==", matricula)
        .limit(1)
        .get();

      if (!snapTrabajador.empty) {
        dataTrabajador = {
          id: snapTrabajador.docs[0].id,
          ...snapTrabajador.docs[0].data(),
        } as BolsaDeTrabajoRegistro;
        docIdEncontrado = docSnap.id;
        tipoDocumento = docSnap.data().tipo as TipoBolsaDeTrabajo;
        break;
      }
    }

    if (!dataTrabajador || !docIdEncontrado || !tipoDocumento) {
      return NextResponse.json(
        {
          error:
            "No se encontraron registros para esta matrícula en el listado actual.",
        },
        { status: 404 },
      );
    }

    const snapComparacion = await adminDb
      .collection("bolsa_de_trabajo_documentos")
      .doc(docIdEncontrado)
      .collection("registros")
      .get();
    const registros = snapComparacion.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BolsaDeTrabajoRegistro[];
    const comparisonRecords = getComparisonRecordsForWorker(
      registros,
      dataTrabajador,
      tipoDocumento,
    );
    const resultado = calcularPosiciones(
      comparisonRecords,
      matricula,
      tipoDocumento,
    );

    if (!resultado) {
      return NextResponse.json(
        { error: "Error al calcular posiciones." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...resultado,
        tipoDocumento,
      },
      periodo: {
        anio: syncActiva.anio,
        mes: syncActiva.mes,
        quincena: syncActiva.quincena,
      },
    });
  } catch (error: any) {
    console.error("Error en consulta de posición:", error);

    if (error?.message === "CORS_FORBIDDEN") {
      return NextResponse.json(
        { error: "Acceso no permitido." },
        { status: 403 },
      );
    }

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
        { error: "Perfil de usuario no encontrado." },
        { status: 404 },
      );
    }

    if (error?.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { error: "La cuenta no está activa." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
