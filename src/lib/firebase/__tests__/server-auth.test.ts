import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockVerifyIdToken, mockDocGet, mockGetEstado } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockDocGet: vi.fn(),
  mockGetEstado: vi.fn(),
}));

vi.mock("@/lib/firebase/mantenimiento", () => ({
  getEstadoMantenimiento: mockGetEstado,
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: { verifyIdToken: mockVerifyIdToken },
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ get: mockDocGet })),
    })),
  },
}));

import {
  requireAdminRequest,
  requireUserRequest,
} from "@/lib/firebase/server-auth";
import { COOKIE_BYPASS } from "@/lib/mantenimiento-secreto";

function makeRequest(authHeader: string | null) {
  return {
    headers: {
      get: (key: string) => (key === "authorization" ? authHeader : null),
    },
  } as any;
}

describe("requireUserRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza AUTH_REQUIRED cuando no hay token Bearer", async () => {
    await expect(requireUserRequest(makeRequest(null))).rejects.toThrow(
      "AUTH_REQUIRED",
    );
  });

  it("propaga error de Firebase cuando el token es inválido", async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error("auth/invalid-id-token"));
    await expect(
      requireUserRequest(makeRequest("Bearer token-invalido")),
    ).rejects.toThrow("auth/invalid-id-token");
  });

  it("lanza PROFILE_NOT_FOUND cuando el perfil no existe en Firestore", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-test",
      email: "a@b.com",
    });
    mockDocGet.mockResolvedValueOnce({ exists: false });
    await expect(
      requireUserRequest(makeRequest("Bearer token-valido")),
    ).rejects.toThrow("PROFILE_NOT_FOUND");
  });

  it("lanza ACCOUNT_INACTIVE cuando status !== active", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-test",
      email: "a@b.com",
    });
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "pending", matricula: "97027534" }),
    });
    await expect(
      requireUserRequest(makeRequest("Bearer token-valido")),
    ).rejects.toThrow("ACCOUNT_INACTIVE");
  });

  it("retorna { uid, email, matricula } para usuario activo con token válido", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-test",
      email: "worker@sntss.com",
    });
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "active", matricula: "  97027534  " }),
    });
    const result = await requireUserRequest(makeRequest("Bearer token-valido"));
    expect(result).toEqual({
      uid: "uid-test",
      email: "worker@sntss.com",
      matricula: "97027534",
    });
  });
});

describe("requireAdminRequest con la plataforma en pausa", () => {
  const SECRETO = "secreto-de-prueba-largo";

  function adminReq(bypass?: string) {
    return {
      headers: {
        get: (key: string) =>
          key === "authorization" ? "Bearer token-valido" : null,
      },
      cookies: {
        get: (nombre: string) =>
          nombre === COOKIE_BYPASS && bypass ? { value: bypass } : undefined,
      },
    } as any;
  }

  function perfil(extra: Record<string, unknown> = {}) {
    mockVerifyIdToken.mockResolvedValueOnce({ uid: "uid-admin", email: null });
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "active", role: "ADMIN", ...extra }),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAINTENANCE_CONTROL_SECRET = SECRETO;
  });

  it("deja pasar al admin con la plataforma abierta", async () => {
    mockGetEstado.mockResolvedValue({ activo: false, modo: "abierto" });
    perfil();
    await expect(requireAdminRequest(adminReq())).resolves.toMatchObject({
      uid: "uid-admin",
    });
  });

  it("bloquea al admin en modo consulta", async () => {
    mockGetEstado.mockResolvedValue({ activo: false, modo: "consulta" });
    perfil();
    await expect(requireAdminRequest(adminReq())).rejects.toThrow(
      "PLATAFORMA_EN_PAUSA",
    );
  });

  it("bloquea al admin en suspensión total", async () => {
    mockGetEstado.mockResolvedValue({ activo: true, modo: "total" });
    perfil();
    await expect(requireAdminRequest(adminReq())).rejects.toThrow(
      "PLATAFORMA_EN_PAUSA",
    );
  });

  it("exenta al developer en modo consulta", async () => {
    mockGetEstado.mockResolvedValue({ activo: false, modo: "consulta" });
    perfil({ role: "SUPER_ADMIN", isDeveloper: true });
    await expect(requireAdminRequest(adminReq())).resolves.toMatchObject({
      isDeveloper: true,
    });
  });

  it("exenta a quien trae la cookie de bypass válida", async () => {
    mockGetEstado.mockResolvedValue({ activo: false, modo: "consulta" });
    perfil();
    await expect(requireAdminRequest(adminReq(SECRETO))).resolves.toBeTruthy();
  });

  it("no exenta con una cookie de bypass incorrecta", async () => {
    mockGetEstado.mockResolvedValue({ activo: false, modo: "consulta" });
    perfil();
    await expect(requireAdminRequest(adminReq("otra"))).rejects.toThrow(
      "PLATAFORMA_EN_PAUSA",
    );
  });
});
