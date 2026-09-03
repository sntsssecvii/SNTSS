import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetEstado, mockSetMantenimiento } = vi.hoisted(() => ({
  mockGetEstado: vi.fn(),
  mockSetMantenimiento: vi.fn(),
}));

vi.mock("@/lib/firebase/mantenimiento", () => ({
  getEstadoMantenimiento: mockGetEstado,
  setMantenimiento: mockSetMantenimiento,
}));

import { GET, POST } from "./route";

const SECRETO = "secreto-de-prueba-largo";

function getReq(query: string) {
  return new NextRequest(`http://localhost/api/z-control${query}`);
}

function postReq(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new NextRequest("http://localhost/api/z-control", {
    method: "POST",
    body,
  });
}

describe("/api/z-control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAINTENANCE_CONTROL_SECRET = SECRETO;
    mockGetEstado.mockResolvedValue({ activo: false });
  });

  it("GET sin secreto responde 404", async () => {
    const res = await GET(getReq(""));
    expect(res.status).toBe(404);
  });

  it("GET con secreto incorrecto responde 404", async () => {
    const res = await GET(getReq("?k=incorrecto"));
    expect(res.status).toBe(404);
  });

  it("GET con secreto correcto muestra el panel (estado OPERATIVA)", async () => {
    const res = await GET(getReq(`?k=${SECRETO}`));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("OPERATIVA");
    expect(html).toContain("SUSPENDER PLATAFORMA");
  });

  it("GET refleja estado suspendido", async () => {
    mockGetEstado.mockResolvedValue({
      activo: true,
      desde: "2026-08-13T00:00:00.000Z",
    });
    const res = await GET(getReq(`?k=${SECRETO}`));
    const html = await res.text();
    expect(html).toContain("SUSPENDIDA");
    expect(html).toContain("REACTIVAR PLATAFORMA");
  });

  it("POST sin secreto no togglea y responde 404", async () => {
    const res = await POST(postReq({ accion: "suspender" }));
    expect(res.status).toBe(404);
    expect(mockSetMantenimiento).not.toHaveBeenCalled();
  });

  it("POST con secreto + suspender activa el mantenimiento y redirige", async () => {
    const res = await POST(postReq({ k: SECRETO, accion: "suspender" }));
    expect(mockSetMantenimiento).toHaveBeenCalledWith(true, expect.any(String));
    expect(res.status).toBe(303);
  });

  it("POST con secreto + reactivar desactiva el mantenimiento", async () => {
    const res = await POST(postReq({ k: SECRETO, accion: "reactivar" }));
    expect(mockSetMantenimiento).toHaveBeenCalledWith(false);
    expect(res.status).toBe(303);
  });

  it("responde 404 si no hay secreto configurado en el entorno", async () => {
    delete process.env.MAINTENANCE_CONTROL_SECRET;
    const res = await GET(getReq(`?k=${SECRETO}`));
    expect(res.status).toBe(404);
  });
});
