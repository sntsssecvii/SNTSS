import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { secretoMantenimientoValido } from "@/lib/mantenimiento-secreto";

const SECRETO = "un-secreto-suficientemente-largo";

describe("secretoMantenimientoValido", () => {
  beforeEach(() => {
    process.env.MAINTENANCE_CONTROL_SECRET = SECRETO;
  });
  afterEach(() => {
    delete process.env.MAINTENANCE_CONTROL_SECRET;
  });

  it("acepta el secreto correcto", () => {
    expect(secretoMantenimientoValido(SECRETO)).toBe(true);
  });

  it("rechaza un secreto incorrecto de igual longitud", () => {
    expect(secretoMantenimientoValido("x".repeat(SECRETO.length))).toBe(false);
  });

  it("rechaza un secreto de distinta longitud", () => {
    expect(secretoMantenimientoValido("corto")).toBe(false);
  });

  it("rechaza null/undefined", () => {
    expect(secretoMantenimientoValido(null)).toBe(false);
    expect(secretoMantenimientoValido(undefined)).toBe(false);
  });

  it("rechaza si no hay secreto configurado en el entorno", () => {
    delete process.env.MAINTENANCE_CONTROL_SECRET;
    expect(secretoMantenimientoValido(SECRETO)).toBe(false);
  });
});
