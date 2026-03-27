import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import {
  requireAdminRequest,
  handleAdminRouteError,
} from "@/lib/firebase/server-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:dashboard-chips",
      limit: 60,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const usersRef = adminDb.collection("users");
    const documentsRef = adminDb.collection("bolsa_de_trabajo_documentos");

    const [
      usuariosActivosSnap,
      validacionesPendientesSnap,
      documentosProcesadosSnap,
    ] = await Promise.all([
      usersRef.where("status", "==", "active").count().get(),
      usersRef.where("status", "==", "pending").count().get(),
      documentsRef.count().get(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        usuariosActivos: usuariosActivosSnap.data().count,
        validacionesPendientes: validacionesPendientesSnap.data().count,
        documentosProcesados: documentosProcesadosSnap.data().count,
      },
    });
  } catch (error) {
    return handleAdminRouteError(
      error,
      "No se pudieron obtener las métricas del dashboard.",
    );
  }
}
