import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { COOKIE_BYPASS } from "@/lib/mantenimiento-secreto";

const { mockGetEstado, mockSetModo } = vi.hoisted(() => ({
  mockGetEstado: vi.fn(),
  mockSetModo: vi.fn(),
}));

vi.mock("@/lib/firebase/mantenimiento", () => ({
  getEstadoMantenimiento: mockGetEstado,
  setModoPlataforma: mockSetModo,
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
    mockGetEstado.mockResolvedValue({ activo: false, modo: "abierto" });
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
    expect(html).toContain("SOLO CONSULTA");
    expect(html).toContain("SUSPENDER TODO");
    expect(res.cookies.get(COOKIE_BYPASS)?.value).toBe(SECRETO);
  });

  it("GET refleja estado suspendido", async () => {
    mockGetEstado.mockResolvedValue({
      activo: true,
      modo: "total",
      desde: "2026-08-13T00:00:00.000Z",
    });
    const res = await GET(getReq(`?k=${SECRETO}`));
    const html = await res.text();
    expect(html).toContain("SUSPENDIDA");
    expect(html).toContain("REACTIVAR TODO");
  });

  it("GET refleja el modo solo consulta", async () => {
    mockGetEstado.mockResolvedValue({ activo: false, modo: "consulta" });
    const res = await GET(getReq(`?k=${SECRETO}`));
    const html = await res.text();
    expect(html).toContain("SOLO CONSULTA");
    expect(html).toContain("REACTIVAR TODO");
    expect(html).toContain("SUSPENDER TODO");
  });

  it("POST sin secreto no togglea y responde 404", async () => {
    const res = await POST(postReq({ accion: "suspender" }));
    expect(res.status).toBe(404);
    expect(mockSetModo).not.toHaveBeenCalled();
  });

  it("POST con secreto + suspender activa el mantenimiento y redirige", async () => {
    const res = await POST(postReq({ k: SECRETO, accion: "suspender" }));
    expect(mockSetModo).toHaveBeenCalledWith("total", expect.any(String));
    expect(res.status).toBe(303);
  });

  it("POST con secreto + reactivar desactiva el mantenimiento", async () => {
    const res = await POST(postReq({ k: SECRETO, accion: "reactivar" }));
    expect(mockSetModo).toHaveBeenCalledWith("abierto", undefined);
    expect(res.status).toBe(303);
  });

  it("POST con secreto + consulta pone la plataforma en solo consulta", async () => {
    const res = await POST(postReq({ k: SECRETO, accion: "consulta" }));
    expect(mockSetModo).toHaveBeenCalledWith("consulta", expect.any(String));
    expect(res.status).toBe(303);
  });

  it("POST con acción desconocida no cambia nada", async () => {
    await POST(postReq({ k: SECRETO, accion: "otra" }));
    expect(mockSetModo).not.toHaveBeenCalled();
  });

  it("responde 404 si no hay secreto configurado en el entorno", async () => {
    delete process.env.MAINTENANCE_CONTROL_SECRET;
    const res = await GET(getReq(`?k=${SECRETO}`));
    expect(res.status).toBe(404);
  });
});
