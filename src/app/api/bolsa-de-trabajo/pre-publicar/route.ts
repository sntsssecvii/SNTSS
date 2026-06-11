import { NextRequest, NextResponse } from "next/server";

import { analyzeRegression } from "@/lib/bolsa-de-trabajo/regression-analyzer";
import { sampleRepresentativeCases } from "@/lib/bolsa-de-trabajo/validation-sampler";
import { materializeDocumentPositions } from "@/lib/bolsa-de-trabajo/materialize-sync-positions";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import type {
  BolsaDeTrabajoRegistro,
  BolsaPosicionMaterializada,
  PeriodoBolsa,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";

export const dynamic = "force-dynamic";

const DOCS_COLLECTION = "bolsa_de_trabajo_documentos";
const SYNC_COLLECTION = "sincronizaciones";
const POSICIONES_COLLECTION = "bolsa_posiciones_materializadas";

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:bolsa:pre-publicar",
      limit: 10,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    void adminUser; // autenticado pero no necesitamos el uid en este endpoint

    const body = await request.json().catch(() => null);
    const syncId = typeof body?.syncId === "string" ? body.syncId.trim() : "";

    if (!syncId) {
      return NextResponse.json({ error: "syncId requerido." }, { status: 400 });
    }

    // 1. Cargar la sync
    const syncRef = adminDb.collection(SYNC_COLLECTION).doc(syncId);
    const syncSnap = await syncRef.get();

    if (!syncSnap.exists) {
      return NextResponse.json(
        { error: "La sincronización no existe." },
        { status: 404 },
      );
    }

    const syncData = syncSnap.data() as {
      anio: number;
      mes: number;
      quincena: 1 | 2;
      esFuenteVerdad?: boolean;
      syncAnteriorId?: string | null;
    };

    const periodo: PeriodoBolsa = {
      anio: syncData.anio,
      mes: syncData.mes,
      quincena: syncData.quincena,
    };

    // 2. Cargar documentos COMPLETADO de esta sync
    const docsSnap = await adminDb
      .collection(DOCS_COLLECTION)
      .where("syncId", "==", syncId)
      .where("estado", "==", "COMPLETADO")
      .get();

    if (docsSnap.empty) {
      return NextResponse.json(
        { error: "La sincronización no tiene documentos completados." },
        { status: 400 },
      );
    }

    // 3. Para cada documento, cargar registros y calcular posiciones en memoria
    const allNewPositions: BolsaPosicionMaterializada[] = [];
    const documentoIds: string[] = [];

    await Promise.all(
      docsSnap.docs.map(async (docSnap) => {
        const docData = docSnap.data() as { tipoDocumento: TipoBolsaDeTrabajo };
        const documentoId = docSnap.id;
        documentoIds.push(documentoId);

        const registrosSnap = await adminDb
          .collection(DOCS_COLLECTION)
          .doc(documentoId)
          .collection("registros")
          .get();

        const registros = registrosSnap.docs.map((r) => ({
          id: r.id,
          ...r.data(),
        })) as BolsaDeTrabajoRegistro[];

        const posiciones = materializeDocumentPositions({
          syncId,
          documentoId,
          tipoDocumento: docData.tipoDocumento,
          periodo,
          registros,
        });

        allNewPositions.push(...posiciones);
      }),
    );

    // 4. Buscar sync anterior
    let syncAnteriorId: string | null = syncData.syncAnteriorId ?? null;

    if (!syncAnteriorId) {
      const anteriorSnap = await adminDb
        .collection(SYNC_COLLECTION)
        .where("esFuenteVerdad", "==", true)
        .get();

      const anterior = anteriorSnap.docs.find((d) => d.id !== syncId);
      syncAnteriorId = anterior?.id ?? null;
    }

    // 5. Cargar posiciones anteriores si hay sync anterior
    let previousPositions: BolsaPosicionMaterializada[] = [];

    if (syncAnteriorId) {
      const prevPosSnap = await adminDb
        .collection(POSICIONES_COLLECTION)
        .where("syncId", "==", syncAnteriorId)
        .get();

      previousPositions = prevPosSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as BolsaPosicionMaterializada[];
    }

    // 6. Análisis de regresión
    const regresion = analyzeRegression({
      syncAnteriorId,
      newPositions: allNewPositions,
      previousPositions,
    });

    // 7. Muestras representativas por documento
    const muestras: Record<
      string,
      ReturnType<typeof sampleRepresentativeCases>
    > = {};
    for (const documentoId of documentoIds) {
      muestras[documentoId] = sampleRepresentativeCases(
        allNewPositions,
        previousPositions,
        documentoId,
      );
    }

    return NextResponse.json({
      success: true,
      regresion,
      muestras,
      documentos: documentoIds,
      syncAnteriorId,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; retryAfterSeconds?: number };
    console.error("Error en pre-publicar:", error);

    if (error instanceof RateLimitError || err?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              (error as RateLimitError).retryAfterSeconds || 60,
            ),
          },
        },
      );
    }

    if (err?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    if (err?.message === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: "No se pudo ejecutar el análisis previo a publicación.",
        details: err?.message || "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}
