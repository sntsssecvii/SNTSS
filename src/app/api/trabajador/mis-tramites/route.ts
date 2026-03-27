import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getBearerToken } from "@/lib/firebase/server-auth";
import {
  getBolsaPosicionesMaterializadasPorMatricula,
  hasBolsaPosicionesMaterializadasForSync,
} from "@/lib/firebase/bolsa-posiciones-materializadas";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import type { Sincronizacion } from "@/types/bolsa-de-trabajo";

export const dynamic = "force-dynamic";

function hasUsableMaterializedRecord(record: { recordId?: string | null }) {
  return Boolean(record.recordId?.trim());
}

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:trabajador:mis-tramites",
      limit: 60,
      windowMs: 60_000,
    });
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userDoc = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Perfil de usuario no encontrado." },
        { status: 404 },
      );
    }

    const userData = userDoc.data() as
      | { matricula?: string; status?: string }
      | undefined;
    const matricula = userData?.matricula?.trim().toUpperCase();

    if (!matricula) {
      return NextResponse.json(
        { error: "El usuario autenticado no tiene matrícula vinculada." },
        { status: 400 },
      );
    }

    if (userData?.status && userData.status !== "active") {
      return NextResponse.json(
        { error: "La cuenta no está activa para consultar información." },
        { status: 403 },
      );
    }

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

    const syncActiva = {
      id: syncSnap.docs[0].id,
      ...syncSnap.docs[0].data(),
    } as Sincronizacion;

    const tramitesMaterializados = (
      await getBolsaPosicionesMaterializadasPorMatricula(
        syncActiva.id,
        matricula,
      )
    ).filter(hasUsableMaterializedRecord);

    if (tramitesMaterializados.length === 0) {
      const syncMaterialized = await hasBolsaPosicionesMaterializadasForSync(
        syncActiva.id,
      );

      if (!syncMaterialized) {
        return NextResponse.json(
          {
            error:
              "La información del corte oficial todavía se está preparando. Intenta nuevamente en unos minutos.",
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          error:
            "No se encontraron trámites vigentes para la matrícula autenticada.",
          matricula,
        },
        { status: 404 },
      );
    }

    const tramites = tramitesMaterializados
      .map((item) => ({
        ...item,
        registro: item.grupoComparable?.registro,
      }))
      .sort((a, b) => a.tipoDocumento.localeCompare(b.tipoDocumento));

    if (tramites.length === 0) {
      return NextResponse.json(
        {
          error:
            "No se encontraron trámites vigentes para la matrícula autenticada.",
          matricula,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      matricula,
      data: tramites,
      periodo: {
        anio: syncActiva.anio,
        mes: syncActiva.mes,
        quincena: syncActiva.quincena,
      },
    });
  } catch (error: any) {
    console.error("Error en mis tramites:", error);

    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }

    if (
      error?.code === "auth/id-token-expired" ||
      error?.code === "auth/argument-error"
    ) {
      return NextResponse.json(
        { error: "La sesión expiró. Vuelve a iniciar sesión." },
        { status: 401 },
      );
    }

    if (error?.code === "auth/invalid-id-token") {
      return NextResponse.json(
        { error: "La sesión no es válida. Vuelve a iniciar sesión." },
        { status: 401 },
      );
    }

    if (error?.code === 14 || error?.message === "DEADLINE_EXCEEDED") {
      return NextResponse.json(
        { error: "La consulta tardó demasiado. Intenta de nuevo." },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor", details: error.message },
      { status: 500 },
    );
  }
}
