import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { COOKIE_BYPASS } from "@/lib/mantenimiento-secreto";

const { mockRequireDev, mockGetEstado, mockSet } = vi.hoisted(() => ({
  mockRequireDev: vi.fn(),
  mockGetEstado: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock("@/lib/firebase/server-auth", () => ({
  requireDeveloperRequest: mockRequireDev,
}));
vi.mock("@/lib/firebase/mantenimiento", () => ({
  getEstadoMantenimiento: mockGetEstado,
  setMantenimiento: mockSet,
}));

import { GET, POST } from "./route";

const SECRETO = "secreto-de-prueba-largo";
const URL = "http://localhost/api/admin/mantenimiento";

function getReq() {
  return new NextRequest(URL, { headers: { authorization: "Bearer tok" } });
}
function postReq(body: unknown) {
  return new NextRequest(URL, {
    method: "POST",
    headers: {
      authorization: "Bearer tok",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/mantenimiento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAINTENANCE_CONTROL_SECRET = SECRETO;
    mockGetEstado.mockResolvedValue({ activo: false });
  });

  it("GET sin developer responde 403", async () => {
    mockRequireDev.mockRejectedValue(new Error("DEVELOPER_REQUIRED"));
    const res = await GET(getReq());
    expect(res.status).toBe(403);
  });

  it("GET con developer devuelve estado y siembra la cookie de bypass", async () => {
    mockRequireDev.mockResolvedValue({ uid: "gera" });
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ activo: false });
    expect(res.cookies.get(COOKIE_BYPASS)?.value).toBe(SECRETO);
  });

  it("POST activar=true suspende la plataforma", async () => {
    mockRequireDev.mockResolvedValue({ uid: "gera" });
    mockGetEstado.mockResolvedValue({ activo: true });
    const res = await POST(postReq({ activar: true }));
    expect(mockSet).toHaveBeenCalledWith(true, expect.any(String));
    expect(await res.json()).toMatchObject({ activo: true });
  });

  it("POST activar=false reactiva la plataforma", async () => {
    mockRequireDev.mockResolvedValue({ uid: "gera" });
    const res = await POST(postReq({ activar: false }));
    expect(mockSet).toHaveBeenCalledWith(false, undefined);
    expect(res.status).toBe(200);
  });

  it("POST sin developer responde 403 y no togglea", async () => {
    mockRequireDev.mockRejectedValue(new Error("DEVELOPER_REQUIRED"));
    const res = await POST(postReq({ activar: true }));
    expect(res.status).toBe(403);
    expect(mockSet).not.toHaveBeenCalled();
  });
});
