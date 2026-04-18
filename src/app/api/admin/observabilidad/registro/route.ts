import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type FirestoreDateLike =
  | {
      toDate?: () => Date;
    }
  | Date
  | string
  | null
  | undefined;

function coerceDate(value: FirestoreDateLike) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate();
  }
  return null;
}

function buildRegistrationEventTitle(status: string, warning: string | null) {
  if (status === "ERROR") return "Registro con error";
  if (warning) return "Registro con advertencia";
  return "Registro exitoso";
}

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:observabilidad:registro",
      limit: 30,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const [
      pendingUsersCountSnap,
      activeUsersCountSnap,
      registrationsLastHourSnap,
      registrationsTodaySnap,
      registrationRecentSnap,
      adminRecentSnap,
    ] = await Promise.all([
      adminDb
        .collection("users")
        .where("status", "==", "pending")
        .count()
        .get(),
      adminDb.collection("users").where("status", "==", "active").count().get(),
      adminDb
        .collection("registration_audit_logs")
        .where("createdAt", ">=", oneHourAgo)
        .get(),
      adminDb
        .collection("registration_audit_logs")
        .where("createdAt", ">=", todayStart)
        .get(),
      adminDb
        .collection("registration_audit_logs")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get(),
      adminDb
        .collection("admin_audit_logs")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get(),
    ]);

    const registrationToday = registrationsTodaySnap.docs.reduce(
      (acc, doc) => {
        const data = doc.data() as { status?: string };
        if (data.status === "SUCCESS") acc.success += 1;
        if (data.status === "ERROR") acc.error += 1;
        return acc;
      },
      { success: 0, error: 0 },
    );

    const registrationLastHour = registrationsLastHourSnap.docs.reduce(
      (acc, doc) => {
        const data = doc.data() as {
          status?: string;
          metadata?: {
            emailWarning?: string | null;
          };
        };

        if (data.status === "SUCCESS") acc.success += 1;
        if (data.status === "ERROR") acc.error += 1;
        if (data.metadata?.emailWarning) acc.warning += 1;
        return acc;
      },
      { success: 0, error: 0, warning: 0 },
    );

    const adminLastHour = adminRecentSnap.docs.reduce(
      (acc, doc) => {
        const data = doc.data() as {
          action?: string;
          status?: string;
          createdAt?: FirestoreDateLike;
          metadata?: {
            nextStatus?: string;
          };
        };

        const createdAt = coerceDate(data.createdAt);
        if (!createdAt || createdAt < oneHourAgo || data.status !== "SUCCESS") {
          return acc;
        }

        if (
          data.action === "USER_VALIDATION_UPDATED" &&
          data.metadata?.nextStatus === "active"
        ) {
          acc.approved += 1;
        }

        if (
          data.action === "USER_VALIDATION_UPDATED" &&
          data.metadata?.nextStatus === "rejected"
        ) {
          acc.rejected += 1;
        }

        return acc;
      },
      { approved: 0, rejected: 0 },
    );

    const registrationEvents = registrationRecentSnap.docs.map((doc) => {
      const data = doc.data() as {
        status?: string;
        email?: string;
        createdAt?: FirestoreDateLike;
        metadata?: {
          error?: string;
          emailWarning?: string | null;
        };
      };

      const warning = data.metadata?.emailWarning || null;
      const createdAt = coerceDate(data.createdAt);

      return {
        id: doc.id,
        source: "registration",
        status:
          data.status === "ERROR" ? "error" : warning ? "warning" : "success",
        title: buildRegistrationEventTitle(data.status || "UNKNOWN", warning),
        message:
          data.status === "ERROR"
            ? `${data.email || "Correo desconocido"} • ${data.metadata?.error || "Error no especificado"}`
            : `${data.email || "Correo desconocido"}${warning ? ` • ${warning}` : ""}`,
        createdAt: createdAt ? createdAt.toISOString() : null,
      };
    });

    const adminEvents = adminRecentSnap.docs
      .map((doc) => {
        const data = doc.data() as {
          action?: string;
          status?: string;
          actorEmail?: string;
          targetId?: string;
          createdAt?: FirestoreDateLike;
          metadata?: {
            nextStatus?: string;
            error?: string;
          };
        };

        if (data.action !== "USER_VALIDATION_UPDATED") {
          return null;
        }

        const createdAt = coerceDate(data.createdAt);
        const nextStatus = data.metadata?.nextStatus;
        const status =
          data.status === "ERROR"
            ? "error"
            : nextStatus === "rejected"
              ? "warning"
              : "success";
        const title =
          data.status === "ERROR"
            ? "Validación con error"
            : nextStatus === "active"
              ? "Solicitud aprobada"
              : "Solicitud rechazada";

        const message =
          data.status === "ERROR"
            ? `${data.targetId || "Usuario desconocido"} • ${data.metadata?.error || "Error no especificado"}`
            : `${data.actorEmail || "Admin desconocido"} actualizó ${data.targetId || "usuario sin id"} a ${nextStatus || "estado desconocido"}`;

        return {
          id: doc.id,
          source: "admin",
          status,
          title,
          message,
          createdAt: createdAt ? createdAt.toISOString() : null,
        };
      })
      .filter(Boolean);

    const recentEvents = [...registrationEvents, ...adminEvents]
      .sort((a, b) => {
        const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 12);

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          pendingValidations: pendingUsersCountSnap.data().count,
          activeUsers: activeUsersCountSnap.data().count,
          registrationsToday: registrationToday.success,
          registrationErrorsToday: registrationToday.error,
          registrationsLastHour: registrationLastHour.success,
          registrationErrorsLastHour: registrationLastHour.error,
          registrationWarningsLastHour: registrationLastHour.warning,
          approvalsLastHour: adminLastHour.approved,
          rejectionsLastHour: adminLastHour.rejected,
        },
        recentEvents,
      },
    });
  } catch (error: any) {
    console.error("Error obteniendo observabilidad de registro:", error);

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
        error: "No se pudo obtener la observabilidad de registro.",
        details: error?.message || "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}
