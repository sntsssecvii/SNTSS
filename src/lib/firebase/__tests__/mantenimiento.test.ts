import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
    })),
  },
}));

function docSnap(data: Record<string, unknown> | null) {
  return { exists: data != null, data: () => data };
}

describe("mantenimiento flag store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useRealTimers();
  });

  it("lee el estado de Firestore (activo=true)", async () => {
    mockGet.mockResolvedValue(
      docSnap({ mantenimientoActivo: true, mantenimientoMotivo: "corte" }),
    );
    const { getEstadoMantenimiento } = await import("../mantenimiento");
    const estado = await getEstadoMantenimiento();
    expect(estado.activo).toBe(true);
    expect(estado.motivo).toBe("corte");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("trata doc inexistente como operativo (activo=false)", async () => {
    mockGet.mockResolvedValue(docSnap(null));
    const { getEstadoMantenimiento } = await import("../mantenimiento");
    const estado = await getEstadoMantenimiento();
    expect(estado.activo).toBe(false);
  });

  it("usa cache dentro del TTL (no vuelve a leer Firestore)", async () => {
    mockGet.mockResolvedValue(docSnap({ mantenimientoActivo: false }));
    const { getEstadoMantenimiento } = await import("../mantenimiento");
    await getEstadoMantenimiento();
    await getEstadoMantenimiento();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("vuelve a leer después de expirar el TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mockGet.mockResolvedValue(docSnap({ mantenimientoActivo: false }));
    const { getEstadoMantenimiento } = await import("../mantenimiento");
    await getEstadoMantenimiento();
    vi.setSystemTime(31_000);
    await getEstadoMantenimiento();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("setMantenimiento escribe e invalida el cache", async () => {
    mockGet.mockResolvedValue(docSnap({ mantenimientoActivo: false }));
    const mod = await import("../mantenimiento");
    await mod.getEstadoMantenimiento(); // cachea activo=false
    await mod.setMantenimiento(true, "pago pendiente");
    expect(mockSet).toHaveBeenCalledTimes(1);
    // el cache se invalidó → vuelve a leer; ahora Firestore reporta activo=true
    mockGet.mockResolvedValue(docSnap({ mantenimientoActivo: true }));
    const estado = await mod.getEstadoMantenimiento();
    expect(estado.activo).toBe(true);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("ante error de Firestore no tumba la app (default operativo)", async () => {
    mockGet.mockRejectedValue(new Error("firestore down"));
    const { getEstadoMantenimiento } = await import("../mantenimiento");
    const estado = await getEstadoMantenimiento();
    expect(estado.activo).toBe(false);
  });
});
