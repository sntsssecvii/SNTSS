import { NextRequest, NextResponse } from "next/server";
import { FieldPath, Timestamp } from "firebase-admin/firestore";

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

function toCreatedAtMs(value: any) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function encodeCursor(cursor: {
  createdAtMs?: number | null;
  primaryValue?: string;
  uid: string;
}) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(cursor: string | null) {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as {
      createdAtMs?: number;
      primaryValue?: string;
      uid?: string;
    };

    if (!parsed.uid) return null;

    return parsed;
  } catch {
    return null;
  }
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
    const limit = clampLimit(request.nextUrl.searchParams.get("limit"));
    const cursor = decodeCursor(request.nextUrl.searchParams.get("cursor"));
    const search = resolveUserSearch(request.nextUrl.searchParams.get("q"));

    if (!isValidStatus(status)) {
      return NextResponse.json(
        { error: "Estatus de validación no válido." },
        { status: 400 },
      );
    }

    let query = adminDb
      .collection("users")
      .where("status", "==", status) as FirebaseFirestore.Query;
    let totalQuery = adminDb
      .collection("users")
      .where("status", "==", status) as FirebaseFirestore.Query;

    if (search) {
      query = query
        .where(search.fieldPath, ">=", search.value)
        .where(search.fieldPath, "<=", `${search.value}\uf8ff`)
        .orderBy(search.fieldPath, "asc")
        .orderBy(FieldPath.documentId(), "asc")
        .limit(limit + 1);

      totalQuery = totalQuery
        .where(search.fieldPath, ">=", search.value)
        .where(search.fieldPath, "<=", `${search.value}\uf8ff`);
    } else {
      query = query
        .orderBy("createdAt", "desc")
        .orderBy(FieldPath.documentId(), "desc")
        .limit(limit + 1);
    }

    if (cursor) {
      query =
        search && cursor.primaryValue
          ? query.startAfter(cursor.primaryValue, cursor.uid)
          : cursor.createdAtMs
            ? query.startAfter(
                Timestamp.fromMillis(cursor.createdAtMs),
                cursor.uid,
              )
            : query;
    }

    const [snapshot, totalSnapshot] = await Promise.all([
      query.get(),
      totalQuery.count().get(),
    ]);

    const docs = snapshot.docs.slice(0, limit);

    const requests = docs
      .filter((doc) => doc.data().role !== "SUPER_ADMIN") // Las cuentas SUPER_ADMIN se excluyen intencionalmente
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

    const lastDoc = docs[docs.length - 1];
    const nextCursor =
      snapshot.docs.length > limit && lastDoc
        ? encodeCursor(
            search
              ? {
                  primaryValue: String(lastDoc.data()[search.fieldPath] || ""),
                  uid: lastDoc.id,
                }
              : {
                  createdAtMs: toCreatedAtMs(lastDoc.data().createdAt),
                  uid: lastDoc.id,
                },
          )
        : null;

    return NextResponse.json({
      success: true,
      data: {
        requests,
        pagination: {
          total: totalSnapshot.data().count,
          limit,
          nextCursor,
          hasMore: Boolean(nextCursor),
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
