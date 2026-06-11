import { describe, it, expect } from "vitest";
import { analyzeRegression } from "../regression-analyzer";
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
  nombre: "Test",
  categoria: "ENFERMERA GENERAL",
  zona: "1-Tijuana",
  totalEnCategoria: 10,
  ...overrides,
});

describe("analyzeRegression", () => {
  it("retorna sinComparacion=true si no hay syncAnteriorId", () => {
    const result = analyzeRegression({
      syncAnteriorId: null,
      newPositions: [makePos({ matricula: "A", posicionBase: 1 })],
      previousPositions: [],
    });
    expect(result.sinComparacion).toBe(true);
    expect(result.alertaDisparada).toBe(false);
  });

  it("retorna sinComparacion=true si previousPositions está vacío", () => {
    const result = analyzeRegression({
      syncAnteriorId: "sync-anterior",
      newPositions: [makePos({ matricula: "A", posicionBase: 1 })],
      previousPositions: [],
    });
    expect(result.sinComparacion).toBe(true);
  });

  it("detecta avances y retrocesos correctamente", () => {
    const prev = [
      makePos({ matricula: "A", posicionBase: 3, syncId: "sync-ant" }),
      makePos({ matricula: "B", posicionBase: 1, syncId: "sync-ant" }),
      makePos({ matricula: "C", posicionBase: 5, syncId: "sync-ant" }),
    ];
    const next = [
      makePos({ matricula: "A", posicionBase: 1 }), // avanzó (3 → 1)
      makePos({ matricula: "B", posicionBase: 4 }), // retrocedió (1 → 4)
      makePos({ matricula: "C", posicionBase: 5 }), // sin cambio
    ];
    const result = analyzeRegression({
      syncAnteriorId: "sync-ant",
      newPositions: next,
      previousPositions: prev,
    });
    expect(result.sinComparacion).toBe(false);
    const stats = result.porTipo["CAMBIOS_RAMA"]!;
    expect(stats.avanzaron).toBe(1);
    expect(stats.retrocedieron).toBe(1);
    expect(stats.sinCambio).toBe(1);
    expect(stats.total).toBe(3);
  });

  it("no dispara alerta si retroceso ≤ 10%", () => {
    // 10 trabajadores, 1 retrocede = 10% — no alerta (estrictamente > 10)
    const prev = Array.from({ length: 10 }, (_, i) =>
      makePos({
        matricula: String(i),
        posicionBase: i + 1,
        syncId: "sync-ant",
      }),
    );
    const next = prev.map((p, i) =>
      makePos({ matricula: p.matricula, posicionBase: i === 0 ? 10 : i + 1 }),
    );
    const result = analyzeRegression({
      syncAnteriorId: "sync-ant",
      newPositions: next,
      previousPositions: prev,
    });
    expect(result.alertaDisparada).toBe(false);
  });

  it("dispara alerta si retroceso > 10%", () => {
    // 10 trabajadores, 2 retroceden = 20%
    const prev = Array.from({ length: 10 }, (_, i) =>
      makePos({
        matricula: String(i),
        posicionBase: i + 1,
        syncId: "sync-ant",
      }),
    );
    const next = prev.map((p, i) =>
      makePos({ matricula: p.matricula, posicionBase: i < 2 ? 10 : i + 1 }),
    );
    const result = analyzeRegression({
      syncAnteriorId: "sync-ant",
      newPositions: next,
      previousPositions: prev,
    });
    expect(result.alertaDisparada).toBe(true);
  });

  it("cuenta como sinCambio a trabajadores nuevos sin posicion anterior", () => {
    const prev = [
      makePos({ matricula: "A", posicionBase: 1, syncId: "sync-ant" }),
    ];
    const next = [
      makePos({ matricula: "A", posicionBase: 1 }),
      makePos({ matricula: "NUEVO", posicionBase: 5 }), // no existía antes
    ];
    const result = analyzeRegression({
      syncAnteriorId: "sync-ant",
      newPositions: next,
      previousPositions: prev,
    });
    const stats = result.porTipo["CAMBIOS_RAMA"]!;
    expect(stats.sinCambio).toBe(2); // A sin cambio + NUEVO sin anterior
    expect(stats.retrocedieron).toBe(0);
  });

  it("agrupa stats por tipoDocumento independientemente", () => {
    const prev = [
      makePos({
        matricula: "A",
        posicionBase: 1,
        syncId: "sync-ant",
        tipoDocumento: "CAMBIOS_RAMA",
      }),
      makePos({
        matricula: "B",
        posicionBase: 1,
        syncId: "sync-ant",
        tipoDocumento: "NUEVO_INGRESO",
      }),
    ];
    const next = [
      makePos({
        matricula: "A",
        posicionBase: 5,
        tipoDocumento: "CAMBIOS_RAMA",
      }), // retrocedió
      makePos({
        matricula: "B",
        posicionBase: 1,
        tipoDocumento: "NUEVO_INGRESO",
      }), // sin cambio
    ];
    const result = analyzeRegression({
      syncAnteriorId: "sync-ant",
      newPositions: next,
      previousPositions: prev,
    });
    expect(result.porTipo["CAMBIOS_RAMA"]!.retrocedieron).toBe(1);
    expect(result.porTipo["NUEVO_INGRESO"]!.retrocedieron).toBe(0);
  });
});
