// src/lib/propuestas/__tests__/warnings.test.ts
import { describe, it, expect } from "vitest";
import { calcularWarnings } from "../warnings";
import type { InputWarnings } from "../warnings";

const base: InputWarnings = {
  propuestaActivaExistente: false,
  curpExisteEnActivas: false,
  hayRequerimientoDisponible: true,
  ineSubida: true,
};

describe("calcularWarnings", () => {
  it("sin problemas — todos false excepto sinRequerimientoDisponible que invierte hayRequerimiento", () => {
    const result = calcularWarnings(base);
    expect(result.propuestaActivaExistente).toBe(false);
    expect(result.curpDuplicado).toBe(false);
    expect(result.sinRequerimientoDisponible).toBe(false);
    expect(result.documentoFaltante).toBe(false);
    expect(result.categoriaIncompatible).toBe(false);
  });

  it("propuesta activa existente", () => {
    const result = calcularWarnings({
      ...base,
      propuestaActivaExistente: true,
    });
    expect(result.propuestaActivaExistente).toBe(true);
  });

  it("curp duplicado en activas", () => {
    const result = calcularWarnings({ ...base, curpExisteEnActivas: true });
    expect(result.curpDuplicado).toBe(true);
  });

  it("sin requerimiento disponible", () => {
    const result = calcularWarnings({
      ...base,
      hayRequerimientoDisponible: false,
    });
    expect(result.sinRequerimientoDisponible).toBe(true);
  });

  it("documento faltante (INE no subida)", () => {
    const result = calcularWarnings({ ...base, ineSubida: false });
    expect(result.documentoFaltante).toBe(true);
  });

  it("puede tener múltiples warnings simultáneos", () => {
    const result = calcularWarnings({
      propuestaActivaExistente: true,
      curpExisteEnActivas: true,
      hayRequerimientoDisponible: false,
      ineSubida: false,
    });
    expect(result.propuestaActivaExistente).toBe(true);
    expect(result.curpDuplicado).toBe(true);
    expect(result.sinRequerimientoDisponible).toBe(true);
    expect(result.documentoFaltante).toBe(true);
  });

  it("tieneAlgunWarning — true si al menos uno activo", () => {
    const { tieneAlgunWarning } = calcularWarnings({
      ...base,
      propuestaActivaExistente: true,
    });
    expect(tieneAlgunWarning).toBe(true);
  });

  it("tieneAlgunWarning — false si ninguno activo", () => {
    const { tieneAlgunWarning } = calcularWarnings(base);
    expect(tieneAlgunWarning).toBe(false);
  });
});
