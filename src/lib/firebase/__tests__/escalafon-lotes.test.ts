import { describe, it, expect } from "vitest";
import { generarNombreLote } from "../escalafon-lotes";

describe("generarNombreLote", () => {
  it("devuelve Q1 para día 1", () => {
    expect(generarNombreLote(new Date(2026, 3, 1))).toBe("Abril 2026 · Q1");
  });

  it("devuelve Q1 para día 15", () => {
    expect(generarNombreLote(new Date(2026, 3, 15))).toBe("Abril 2026 · Q1");
  });

  it("devuelve Q2 para día 16", () => {
    expect(generarNombreLote(new Date(2026, 3, 16))).toBe("Abril 2026 · Q2");
  });

  it("devuelve Q2 para día 31", () => {
    expect(generarNombreLote(new Date(2026, 2, 31))).toBe("Marzo 2026 · Q2");
  });

  it("mes de enero", () => {
    expect(generarNombreLote(new Date(2026, 0, 5))).toBe("Enero 2026 · Q1");
  });

  it("mes de diciembre", () => {
    expect(generarNombreLote(new Date(2026, 11, 20))).toBe(
      "Diciembre 2026 · Q2",
    );
  });
});
