import { describe, it, expect } from "vitest";
import { sampleRepresentativeCases } from "../validation-sampler";
import type { BolsaPosicionMaterializada } from "@/types/bolsa-de-trabajo";

const makePos = (
  overrides: Partial<BolsaPosicionMaterializada> & {
    matricula: string;
    posicionBase: number;
  },
): BolsaPosicionMaterializada => ({
  id: overrides.matricula,
  syncId: "sync-new",
  tipoDocumento: "CAMBIOS_RAMA",
  documentoId: "doc-1",
  periodo: { anio: 2026, mes: 6, quincena: 1 },
  versionCalculo: "1",
  fechaMaterializacion: new Date(),
  nombre: `Trabajador ${overrides.matricula}`,
  categoria: "ENFERMERA GENERAL",
  zona: "1-Tijuana",
  totalEnCategoria: 10,
  ...overrides,
});

describe("sampleRepresentativeCases", () => {
  it("retorna array vacío si no hay posiciones para el documento", () => {
    const result = sampleRepresentativeCases([], [], "doc-1");
    expect(result).toHaveLength(0);
  });

  it("retorna hasta 5 casos sin duplicar matrícula", () => {
    const positions = Array.from({ length: 20 }, (_, i) =>
      makePos({ matricula: String(i), posicionBase: i + 1 }),
    );
    const result = sampleRepresentativeCases(positions, [], "doc-1");
    expect(result.length).toBeLessThanOrEqual(5);
    const matriculas = result.map((c) => c.matricula);
    expect(new Set(matriculas).size).toBe(matriculas.length);
  });

  it("incluye caso INCONDICIONAL si hay trabajador de zona incondicional", () => {
    const positions = [
      makePos({ matricula: "A", posicionBase: 1, zona: "0-Incondicional" }),
      makePos({ matricula: "B", posicionBase: 2 }),
    ];
    const result = sampleRepresentativeCases(positions, [], "doc-1");
    expect(result.some((c) => c.etiqueta === "INCONDICIONAL")).toBe(true);
  });

  it("calcula delta correctamente con posicion anterior", () => {
    const prev = [makePos({ matricula: "A", posicionBase: 3, syncId: "prev" })];
    const next = [makePos({ matricula: "A", posicionBase: 5 })];
    const result = sampleRepresentativeCases(next, prev, "doc-1");
    expect(result[0].delta).toBe(2); // 5 - 3 = empeoró 2 lugares
    expect(result[0].posAnterior).toBe(3);
  });

  it("delta es null si no había posición anterior", () => {
    const next = [makePos({ matricula: "NUEVO", posicionBase: 1 })];
    const result = sampleRepresentativeCases(next, [], "doc-1");
    expect(result[0].delta).toBeNull();
    expect(result[0].posAnterior).toBeNull();
  });

  it("incluye caso EVENTUAL si hay trabajador con tipoContratacion=8", () => {
    const positions = [
      makePos({ matricula: "BASE", posicionBase: 1, tipoContratacion: "1" }),
      makePos({ matricula: "EVT", posicionBase: 5, tipoContratacion: "8" }),
    ];
    const result = sampleRepresentativeCases(positions, [], "doc-1");
    expect(result.some((c) => c.etiqueta === "EVENTUAL")).toBe(true);
  });

  it("solo incluye posiciones del documentoId especificado", () => {
    const positions = [
      makePos({ matricula: "A", posicionBase: 1, documentoId: "doc-1" }),
      makePos({ matricula: "B", posicionBase: 2, documentoId: "doc-2" }),
    ];
    const result = sampleRepresentativeCases(positions, [], "doc-1");
    expect(result.every((c) => c.matricula !== "B")).toBe(true);
  });
});
