import { NextRequest, NextResponse } from "next/server";
import { FieldPath, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { resolveUserSearch } from "@/lib/firebase/user-search";
import { requireSuperAdminRequest } from "@/lib/firebase/server-auth";
import { normalizeUserRole } from "@/lib/auth/roles";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function clampLimit(rawLimit: string | null) {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(parsed));
}

function toMillis(value: any) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function encodeCursor(cursor: {
  updatedAtMs?: number | null;
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
      updatedAtMs?: number;
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
      bucket: "api:admin:global:usuarios",
      limit: 60,
      windowMs: 60_000,
    });
    await requireSuperAdminRequest(request);

    const limit = clampLimit(request.nextUrl.searchParams.get("limit"));
    const cursor = decodeCursor(request.nextUrl.searchParams.get("cursor"));
    const statusFilter = request.nextUrl.searchParams.get("status");
    const roleFilter = request.nextUrl.searchParams.get("role");
    const search = resolveUserSearch(request.nextUrl.searchParams.get("q"));

    let query = adminDb.collection("users") as FirebaseFirestore.Query;
    let totalQuery = adminDb.collection("users") as FirebaseFirestore.Query;

    if (statusFilter && statusFilter !== "ALL") {
      query = query.where("status", "==", statusFilter);
      totalQuery = totalQuery.where("status", "==", statusFilter);
    }

    if (roleFilter && roleFilter !== "ALL") {
      const roleValues =
        roleFilter === "USER"
          ? ["USER", "user"]
          : roleFilter === "ADMIN"
            ? ["ADMIN", "admin"]
            : [roleFilter];

      query = query.where("role", "in", roleValues);
      totalQuery = totalQuery.where("role", "in", roleValues);
    }

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
        .orderBy("updatedAt", "desc")
        .orderBy(FieldPath.documentId(), "desc")
        .limit(limit + 1);
    }

    if (cursor) {
      query =
        search && cursor.primaryValue
          ? query.startAfter(cursor.primaryValue, cursor.uid)
          : cursor.updatedAtMs
            ? query.startAfter(
                Timestamp.fromMillis(cursor.updatedAtMs),
                cursor.uid,
              )
            : query;
    }

    const usersRef = adminDb.collection("users");
    const [snapshot, totalSnap, superAdminsSnap, activeSnap, pendingSnap] =
      await Promise.all([
        query.get(),
        totalQuery.count().get(),
        usersRef.where("role", "==", "SUPER_ADMIN").count().get(),
        usersRef.where("status", "==", "active").count().get(),
        usersRef.where("status", "==", "pending").count().get(),
      ]);

    const docs = snapshot.docs.slice(0, limit);

    const usuarios = docs
      .filter((doc) => doc.data().role !== "SUPER_ADMIN") // Las cuentas SUPER_ADMIN se excluyen intencionalmente
      .map((doc) => {
        const data = doc.data();

        return {
          uid: doc.id,
          email: data.email || "",
          nombre: data.nombre || "",
          apellidoPaterno: data.apellidoPaterno || "",
          apellidoMaterno: data.apellidoMaterno || "",
          matricula: data.matricula || "",
          curp: data.curp || "",
          role: normalizeUserRole(data.role),
          status: data.status || "pending",
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
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
                  updatedAtMs:
                    toMillis(lastDoc.data().updatedAt) ||
                    toMillis(lastDoc.data().createdAt),
                  uid: lastDoc.id,
                },
          )
        : null;

    return NextResponse.json({
      success: true,
      data: {
        usuarios,
        pagination: {
          total: totalSnap.data().count,
          limit,
          nextCursor,
          hasMore: Boolean(nextCursor),
        },
        summary: {
          total: totalSnap.data().count,
          superAdmins: superAdminsSnap.data().count,
          active: activeSnap.data().count,
          pending: pendingSnap.data().count,
        },
      },
    });
  } catch (error: any) {
    console.error("Error obteniendo usuarios globales:", error);

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
        { error: "Perfil no encontrado." },
        { status: 404 },
      );
    }

    if (error?.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { error: "La cuenta no está activa." },
        { status: 403 },
      );
    }

    if (error?.message === "SUPER_ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "Se requiere perfil de admin global." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        error: "No se pudieron obtener los usuarios.",
        details: error?.message || "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}
