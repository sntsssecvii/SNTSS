import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { resolveUserSearch } from "@/lib/firebase/user-search";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type UserStatus = "pending" | "active" | "rejected";
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function isValidStatus(status: string | null): status is UserStatus {
  return status === "pending" || status === "active" || status === "rejected";
}

function clampLimit(rawLimit: string | null) {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(parsed));
}

function clampPage(rawPage: string | null) {
  const parsed = Number(rawPage);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function toCreatedAtMs(value: any) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:validaciones:solicitudes",
      limit: 60,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const status = request.nextUrl.searchParams.get("status");
    const scope = request.nextUrl.searchParams.get("scope"); // "workers" = solo role USER
    const limit = clampLimit(request.nextUrl.searchParams.get("limit"));
    const page = clampPage(request.nextUrl.searchParams.get("page"));
    const search = resolveUserSearch(request.nextUrl.searchParams.get("q"));
    const offset = (page - 1) * limit;

    if (!isValidStatus(status)) {
      return NextResponse.json(
        { error: "Estatus de validación no válido." },
        { status: 400 },
      );
    }

    let baseQuery = adminDb
      .collection("users")
      .where("status", "==", status) as FirebaseFirestore.Query;

    if (search) {
      if (search.fieldPath === "searchTokens") {
        // Búsqueda por token individual (nombre de pila o cualquier apellido)
        baseQuery = baseQuery
          .where("searchTokens", "array-contains", search.value)
          .orderBy(FieldPath.documentId(), "asc");
      } else {
        // Búsqueda por prefijo (matrícula, email, nombre completo multi-palabra)
        baseQuery = baseQuery
          .where(search.fieldPath, ">=", search.value)
          .where(search.fieldPath, "<=", `${search.value}\uf8ff`)
          .orderBy(search.fieldPath, "asc")
          .orderBy(FieldPath.documentId(), "asc");
      }
    } else {
      baseQuery = baseQuery
        .orderBy("createdAt", "desc")
        .orderBy(FieldPath.documentId(), "desc");
    }

    const [snapshot, totalSnapshot] = await Promise.all([
      baseQuery.offset(offset).limit(limit).get(),
      baseQuery.count().get(),
    ]);

    const total = totalSnapshot.data().count;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const requests = snapshot.docs
      .filter((doc) =>
        scope === "workers"
          ? doc.data().role === "USER" || doc.data().role === "user"
          : doc.data().role !== "SUPER_ADMIN",
      )
      .map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          nombre: data.nombre || "",
          apellidoPaterno: data.apellidoPaterno || "",
          apellidoMaterno: data.apellidoMaterno || "",
          matricula: data.matricula || "",
          email: data.email || "",
          curp: data.curp || "",
          status: data.status || status,
          rejectionReason: data.rejectionReason || "",
          documents: {
            identificacion: data.documents?.identificacion || "",
            tarjeton: data.documents?.tarjeton || "",
            constanciaAfiliacion: data.documents?.constanciaAfiliacion || "",
          },
          createdAtMs: toCreatedAtMs(data.createdAt),
          updatedAtMs: toCreatedAtMs(data.updatedAt),
        };
      });

    return NextResponse.json({
      success: true,
      data: {
        requests,
        pagination: {
          total,
          limit,
          page,
          totalPages,
          hasMore: page < totalPages,
        },
      },
    });
  } catch (error: any) {
    console.error("Error obteniendo solicitudes de validación:", error);

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
        error: "No se pudieron obtener las solicitudes.",
        details: error?.message || "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}
