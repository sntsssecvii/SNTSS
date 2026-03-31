import { describe, it, expect } from "vitest";
import { calcularPosiciones } from "../calculos";
import type { BolsaDeTrabajoRegistro } from "@/types/bolsa-de-trabajo";

const makeRegistro = (
  overrides: Partial<BolsaDeTrabajoRegistro> & { matricula: string },
): BolsaDeTrabajoRegistro =>
  ({
    id: overrides.matricula,
    tipoDocumento: "NUEVO_INGRESO",
    nombre: "Test",
    categoria: "A",
    zona: "1",
    numeroProg: "1",
    ...overrides,
  }) as BolsaDeTrabajoRegistro;

describe("calcularPosiciones", () => {
  it("deberia retornar null si no hay registros", () => {
    const result = calcularPosiciones([], "123", "NUEVO_INGRESO");
    expect(result).toBeNull();
  });

  it("deberia retornar null si la matricula no existe en los registros", () => {
    const registros = [makeRegistro({ matricula: "456" })];
    const result = calcularPosiciones(registros, "999", "NUEVO_INGRESO");
    expect(result).toBeNull();
  });

  it("deberia retornar resultado con posicionBase para matricula existente", () => {
    const registros = [
      makeRegistro({ matricula: "100", numeroProg: "1" }),
      makeRegistro({ matricula: "200", numeroProg: "2" }),
      makeRegistro({ matricula: "300", numeroProg: "3" }),
    ];
    const result = calcularPosiciones(registros, "200", "NUEVO_INGRESO");
    expect(result).not.toBeNull();
    expect(result!.posicionBase).toBeGreaterThan(0);
    expect(result!.totalEnCategoria).toBe(3);
  });

  it("deberia asignar posicion 1 al primer registro por numeroProg", () => {
    const registros = [
      makeRegistro({ matricula: "A", numeroProg: "10" }),
      makeRegistro({ matricula: "B", numeroProg: "1" }),
      makeRegistro({ matricula: "C", numeroProg: "5" }),
    ];
    const result = calcularPosiciones(registros, "B", "NUEVO_INGRESO");
    expect(result).not.toBeNull();
    expect(result!.posicionBase).toBe(1);
  });
});
