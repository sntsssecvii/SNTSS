import { NextRequest } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getEstadoMantenimiento } from "@/lib/firebase/mantenimiento";
import { tieneBypass } from "@/lib/mantenimiento-secreto";
import {
  isAdminRole,
  isSuperAdminRole,
  normalizeUserRole,
} from "@/lib/auth/roles";

interface AdminRequestContext {
  uid: string;
  email: string | null;
  role: string;
  status?: string;
  isDeveloper?: boolean;
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
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
    | { role?: string; status?: string; email?: string; isDeveloper?: boolean }
    | undefined;
  const role = normalizeUserRole(userData?.role);
  const status = userData?.status;

  if (status && status !== "active") {
    throw new Error("ACCOUNT_INACTIVE");
  }

  if (!isAdminRole(role)) {
    throw new Error("ADMIN_REQUIRED");
  }

  // Con la plataforma en pausa (modo consulta o total) toda la administración,
  // incluida la carga de listados, queda bloqueada. El developer y quien trae
  // la cookie de bypass siguen operando (anti-lockout).
  if (userData?.isDeveloper !== true && !tieneBypass(request.cookies)) {
    const { modo } = await getEstadoMantenimiento();
    if (modo !== "abierto") {
      throw new Error("PLATAFORMA_EN_PAUSA");
    }
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || userData?.email || null,
    role,
    status,
    isDeveloper: userData?.isDeveloper === true,
  };
}

export async function requireSuperAdminRequest(
  request: NextRequest,
): Promise<AdminRequestContext> {
  const context = await requireAdminRequest(request);

  if (!isSuperAdminRole(context.role)) {
    throw new Error("SUPER_ADMIN_REQUIRED");
  }

  return context;
}

export async function requireDeveloperRequest(
  request: NextRequest,
): Promise<AdminRequestContext> {
  const context = await requireSuperAdminRequest(request);

  if (!context.isDeveloper) {
    throw new Error("DEVELOPER_REQUIRED");
  }

  return context;
}

interface UserRequestContext {
  uid: string;
  email: string | null;
  matricula: string;
}

export async function requireUserRequest(
  request: NextRequest,
): Promise<UserRequestContext> {
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
    | {
        role?: string;
        status?: string;
        email?: string;
        matricula?: string;
      }
    | undefined;

  const status = userData?.status;

  if (status && status !== "active") {
    throw new Error("ACCOUNT_INACTIVE");
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || userData?.email || null,
    matricula: userData?.matricula?.trim().toUpperCase() || "",
  };
}
