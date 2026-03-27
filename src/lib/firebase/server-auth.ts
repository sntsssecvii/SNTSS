import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { RateLimitError } from "@/lib/security/rate-limit";

interface AdminRequestContext {
  uid: string;
  email: string | null;
  role: string;
  status?: string;
}

export function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

function normalizeRole(role?: string) {
  return (role || "").trim().toUpperCase();
}

export async function requireAdminRequest(
  request: NextRequest,
): Promise<AdminRequestContext> {
  const idToken = getBearerToken(request);

  if (!idToken) {
    throw new Error("AUTH_REQUIRED");
  }

  const decodedToken = await adminAuth.verifyIdToken(idToken);
  const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();

  if (!userDoc.exists) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const userData = userDoc.data() as
    | { role?: string; status?: string; email?: string }
    | undefined;
  const role = normalizeRole(userData?.role);
  const status = userData?.status;

  if (status && status !== "active") {
    throw new Error("ACCOUNT_INACTIVE");
  }

  if (role !== "ADMIN") {
    throw new Error("ADMIN_REQUIRED");
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || userData?.email || null,
    role,
    status,
  };
}

/**
 * Manejador centralizado de errores para rutas de admin.
 * Elimina el bloque copy-paste en cada route handler.
 */
export function handleAdminRouteError(
  error: unknown,
  fallbackMessage: string,
): NextResponse {
  const err = error as any;
  console.error(fallbackMessage, err);

  if (err instanceof RateLimitError || err?.message === "RATE_LIMITED") {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
      {
        status: 429,
        headers: { "Retry-After": String(err.retryAfterSeconds || 60) },
      },
    );
  }
  if (err?.message === "AUTH_REQUIRED") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (err?.message === "PROFILE_NOT_FOUND") {
    return NextResponse.json(
      { error: "Perfil de administrador no encontrado." },
      { status: 404 },
    );
  }
  if (err?.message === "ACCOUNT_INACTIVE") {
    return NextResponse.json(
      { error: "La cuenta no está activa." },
      { status: 403 },
    );
  }
  if (err?.message === "ADMIN_REQUIRED") {
    return NextResponse.json(
      { error: "Se requiere perfil de administrador." },
      { status: 403 },
    );
  }

  return NextResponse.json(
    { error: fallbackMessage, details: err?.message || "UNKNOWN_ERROR" },
    { status: 500 },
  );
}
