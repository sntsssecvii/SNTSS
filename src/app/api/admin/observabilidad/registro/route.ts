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

type EventStatus = "success" | "warning" | "error";
type EventSource = "registration" | "admin";

interface RecentEvent {
  id: string;
  source: EventSource;
  status: EventStatus;
  title: string;
  message: string;
  createdAt: string | null;
}

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

function clampLimit(raw: string | null, defaultVal = 25): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultVal;
  return Math.min(100, Math.floor(parsed));
}

function mapRegistrationEvent(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): RecentEvent {
  const data = doc.data() as {
    status?: string;
    email?: string;
    createdAt?: FirestoreDateLike;
    metadata?: { error?: string; emailWarning?: string | null };
  };

  const warning = data.metadata?.emailWarning || null;
  const createdAt = coerceDate(data.createdAt);
  const isError = data.status === "ERROR";

  return {
    id: doc.id,
    source: "registration",
    status: isError ? "error" : warning ? "warning" : "success",
    title: isError
      ? "Registro con error"
      : warning
        ? "Registro con advertencia"
        : "Registro exitoso",
    message: isError
      ? `${data.email || "Correo desconocido"} • ${data.metadata?.error || "Error no especificado"}`
      : `${data.email || "Correo desconocido"}${warning ? ` • ${warning}` : ""}`,
    createdAt: createdAt ? createdAt.toISOString() : null,
  };
}

function mapAdminEvent(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): RecentEvent | null {
  const data = doc.data() as {
    action?: string;
    status?: string;
    actorEmail?: string;
    targetId?: string;
    createdAt?: FirestoreDateLike;
    metadata?: { nextStatus?: string; error?: string };
  };

  if (data.action !== "USER_VALIDATION_UPDATED") return null;

  const createdAt = coerceDate(data.createdAt);
  const nextStatus = data.metadata?.nextStatus;
  const isError = data.status === "ERROR";
  const status: EventStatus = isError
    ? "error"
    : nextStatus === "rejected"
      ? "warning"
      : "success";

  return {
    id: doc.id,
    source: "admin",
    status,
    title: isError
      ? "Validación con error"
      : nextStatus === "active"
        ? "Solicitud aprobada"
        : "Solicitud rechazada",
    message: isError
      ? `${data.targetId || "Usuario desconocido"} • ${data.metadata?.error || "Error no especificado"}`
      : `${data.actorEmail || "Admin desconocido"} actualizó ${data.targetId || "usuario sin id"} a ${nextStatus || "estado desconocido"}`,
    createdAt: createdAt ? createdAt.toISOString() : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:observabilidad:registro",
      limit: 60,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const params = request.nextUrl.searchParams;
    const source = params.get("source") || "all"; // all | registration | admin
    const statusFilter = params.get("status") || "all"; // all | success | warning | error
    const limit = clampLimit(params.get("limit"));
    const page = Math.max(1, parseInt(params.get("page") || "1", 10));

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    // --- Overview (always computed) ---
    const [
      pendingUsersCountSnap,
      activeUsersCountSnap,
      registrationsLastHourSnap,
      registrationsTodaySnap,
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
          metadata?: { emailWarning?: string | null };
        };
        if (data.status === "SUCCESS") acc.success += 1;
        if (data.status === "ERROR") acc.error += 1;
        if (data.metadata?.emailWarning) acc.warning += 1;
        return acc;
      },
      { success: 0, error: 0, warning: 0 },
    );

    // --- Events ---
    const FETCH_LIMIT = 200; // load enough to filter in memory
    let allEvents: RecentEvent[] = [];

    const fetchPromises: Promise<void>[] = [];

    if (source === "all" || source === "registration") {
      fetchPromises.push(
        adminDb
          .collection("registration_audit_logs")
          .orderBy("createdAt", "desc")
          .limit(FETCH_LIMIT)
          .get()
          .then((snap) => {
            allEvents.push(...snap.docs.map(mapRegistrationEvent));
          }),
      );
    }

    if (source === "all" || source === "admin") {
      fetchPromises.push(
        adminDb
          .collection("admin_audit_logs")
          .orderBy("createdAt", "desc")
          .limit(FETCH_LIMIT)
          .get()
          .then((snap) => {
            const mapped = snap.docs
              .map(mapAdminEvent)
              .filter((e): e is RecentEvent => e !== null);
            allEvents.push(...mapped);
          }),
      );
    }

    // Admin approvals/rejections last hour (for overview)
    let approvalsLastHour = 0;
    let rejectionsLastHour = 0;
    fetchPromises.push(
      adminDb
        .collection("admin_audit_logs")
        .where("action", "==", "USER_VALIDATION_UPDATED")
        .where("createdAt", ">=", oneHourAgo)
        .get()
        .then((snap) => {
          snap.docs.forEach((doc) => {
            const data = doc.data() as {
              status?: string;
              metadata?: { nextStatus?: string };
            };
            if (data.status !== "SUCCESS") return;
            if (data.metadata?.nextStatus === "active") approvalsLastHour += 1;
            if (data.metadata?.nextStatus === "rejected")
              rejectionsLastHour += 1;
          });
        }),
    );

    await Promise.all(fetchPromises);

    // Sort merged events by date descending
    allEvents.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    // Filter by status
    if (statusFilter !== "all") {
      allEvents = allEvents.filter((e) => e.status === statusFilter);
    }

    // Paginate
    const total = allEvents.length;
    const startIdx = (page - 1) * limit;
    const pageEvents = allEvents.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < total;

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
          approvalsLastHour,
          rejectionsLastHour,
        },
        events: pageEvents,
        pagination: {
          total,
          page,
          limit,
          hasMore,
          totalPages: Math.ceil(total / limit),
        },
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
