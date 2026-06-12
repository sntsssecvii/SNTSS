import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const SYNC_COLLECTION = "sincronizaciones";
const POSICIONES_COLLECTION = "bolsa_posiciones_materializadas";

const ACCIONES_VALIDAS = ["OCULTAR", "MOSTRAR", "REVERTIR"] as const;
type Accion = (typeof ACCIONES_VALIDAS)[number];

export async function POST(request: NextRequest) {
  let adminUser: Awaited<ReturnType<typeof requireAdminRequest>> | null = null;

  try {
    enforceRateLimit(request, {
      bucket: "api:bolsa:revertir",
      limit: 10,
      windowMs: 60_000,
    });
    adminUser = await requireAdminRequest(request);

    const body = await request.json().catch(() => null);
    const syncId = typeof body?.syncId === "string" ? body.syncId.trim() : "";
    const accion: string =
      typeof body?.accion === "string" ? body.accion.trim() : "";

    if (!syncId || !accion) {
      return NextResponse.json(
        { error: "syncId y accion son requeridos." },
        { status: 400 },
      );
    }

    if (!(ACCIONES_VALIDAS as readonly string[]).includes(accion)) {
      return NextResponse.json(
        { error: "accion debe ser OCULTAR, MOSTRAR o REVERTIR." },
        { status: 400 },
      );
    }

    const syncRef = adminDb.collection(SYNC_COLLECTION).doc(syncId);
    const syncSnap = await syncRef.get();

    if (!syncSnap.exists) {
      return NextResponse.json(
        { error: "La sincronización no existe." },
        { status: 404 },
      );
    }

    const syncData = syncSnap.data() as {
      syncAnteriorId?: string;
      esFuenteVerdad?: boolean;
      oculto?: boolean;
    };

    // ── OCULTAR ──────────────────────────────────────────────────────────────
    if (accion === "OCULTAR") {
      await syncRef.update({ oculto: true });

      await writeAdminAuditLog({
        action: "BOLSA_OCULTAR_SYNC",
        actorUid: adminUser.uid,
        actorEmail: adminUser.email || "",
        targetType: "sincronizacion",
        targetId: syncId,
        status: "SUCCESS",
        metadata: { accion: "OCULTAR" },
      });

      return NextResponse.json({ success: true, syncId, accion: "OCULTAR" });
    }

    // ── MOSTRAR ───────────────────────────────────────────────────────────────
    if (accion === "MOSTRAR") {
      await syncRef.update({ oculto: false });

      await writeAdminAuditLog({
        action: "BOLSA_OCULTAR_SYNC",
        actorUid: adminUser.uid,
        actorEmail: adminUser.email || "",
        targetType: "sincronizacion",
        targetId: syncId,
        status: "SUCCESS",
        metadata: { accion: "MOSTRAR" },
      });

      return NextResponse.json({ success: true, syncId, accion: "MOSTRAR" });
    }

    // ── REVERTIR ──────────────────────────────────────────────────────────────
    const syncAnteriorId = syncData.syncAnteriorId;
    if (!syncAnteriorId) {
      return NextResponse.json(
        { error: "No hay quincena anterior." },
        { status: 400 },
      );
    }

    const posicionesSnap = await adminDb
      .collection(POSICIONES_COLLECTION)
      .where("syncId", "==", syncAnteriorId)
      .limit(1)
      .get();

    if (posicionesSnap.empty) {
      return NextResponse.json(
        { error: "La quincena anterior no tiene posiciones materializadas." },
        { status: 400 },
      );
    }

    const syncAnteriorRef = adminDb
      .collection(SYNC_COLLECTION)
      .doc(syncAnteriorId);

    const batch = adminDb.batch();
    batch.update(syncRef, { esFuenteVerdad: false });
    batch.update(syncAnteriorRef, {
      esFuenteVerdad: true,
      fechaReactivacion: Timestamp.now(),
    });
    await batch.commit();

    await writeAdminAuditLog({
      action: "BOLSA_REVERTIR_SYNC",
      actorUid: adminUser.uid,
      actorEmail: adminUser.email || "",
      targetType: "sincronizacion",
      targetId: syncId,
      status: "SUCCESS",
      metadata: { syncAnteriorId, accion: "REVERTIR" },
    });

    return NextResponse.json({
      success: true,
      syncId,
      syncAnteriorId,
      accion: "REVERTIR",
    });
  } catch (error: any) {
    console.error("Error revirtiendo sincronización de bolsa:", error);

    if (adminUser) {
      try {
        await writeAdminAuditLog({
          action: "BOLSA_REVERTIR_SYNC",
          actorUid: adminUser.uid,
          actorEmail: adminUser.email || "",
          targetType: "sincronizacion",
          status: "ERROR",
          metadata: { error: error?.message || "UNKNOWN_ERROR" },
        });
      } catch (auditError) {
        console.error("Error registrando auditoría de reversión:", auditError);
      }
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
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    if (error?.message === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: "No se pudo completar la operación.",
        details: error?.message || "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}
