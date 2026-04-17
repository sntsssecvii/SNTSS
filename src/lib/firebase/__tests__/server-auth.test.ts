import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockVerifyIdToken, mockDocGet } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockDocGet: vi.fn(),
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: { verifyIdToken: mockVerifyIdToken },
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ get: mockDocGet })),
    })),
  },
}));

import { requireUserRequest } from "@/lib/firebase/server-auth";

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
