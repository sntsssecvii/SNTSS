import { describe, it, expect } from "vitest";
import { calcularPosicionesPorZona } from "../position-engine";
import type { EscalafonAspirante } from "@/types/escalafon";

// Helper para construir aspirantes de prueba sin id/listadoId/posicionesPorZona
type AspiranteInput = Omit<
  EscalafonAspirante,
  "id" | "listadoId" | "posicionesPorZona"
>;

function aspirante(
  lugar: number,
  zonas: string[], // "INCONDICIONAL" o nombre de zona
  estatus: "Activo" | "PEI" = "Activo",
): AspiranteInput {
  return {
    lugar,
    estatus,
    matricula: `MAT${lugar}`,
    nombre: `ASPIRANTE ${lugar}`,
    delegacion: "02",
    fechaRegistro: "01/01/2026",
    preferencias: zonas.map((z) => ({
      delegacionSolicitada: "02 BAJA CALIFORNIA",
      zonaSolicitada: z,
      localidadSolicitada: "INCONDICIONAL",
      adscripcionCode: "INCONDICIONAL",
      adscripcionDesc: "INCONDICIONAL",
      turnoNum: null,
      turnoDesc: "INCONDICIONAL",
    })),
  };
}

describe("calcularPosicionesPorZona", () => {
  it("extrae las zonas únicas correctamente", () => {
    const aspirantes = [
      aspirante(1, ["7 TIJUANA"]),
      aspirante(2, ["2 MEXICALI"]),
      aspirante(3, ["7 TIJUANA", "6 TECATE"]),
    ];
    const { zonas } = calcularPosicionesPorZona(aspirantes);
    expect(zonas.sort()).toEqual(
      ["2 MEXICALI", "6 TECATE", "7 TIJUANA"].sort(),
    );
  });

  it("no incluye INCONDICIONAL en la lista de zonas", () => {
    const aspirantes = [
      aspirante(1, ["INCONDICIONAL"]),
      aspirante(2, ["7 TIJUANA"]),
    ];
    const { zonas } = calcularPosicionesPorZona(aspirantes);
    expect(zonas).not.toContain("INCONDICIONAL");
    expect(zonas).toContain("7 TIJUANA");
  });

  it("un aspirante condicionado solo aparece en su zona", () => {
    const aspirantes = [
      aspirante(1, ["7 TIJUANA"]),
      aspirante(2, ["2 MEXICALI"]),
    ];
    const { aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    const a1 = aspirantesConPosicion[0];
    expect(a1.posicionesPorZona["7 TIJUANA"]).toBe(1);
    expect(a1.posicionesPorZona["2 MEXICALI"]).toBeUndefined();
  });

  it("un aspirante INCONDICIONAL aparece en todas las zonas", () => {
    const aspirantes = [
      aspirante(1, ["7 TIJUANA"]),
      aspirante(2, ["INCONDICIONAL"]),
      aspirante(3, ["2 MEXICALI"]),
    ];
    const { aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    const incondicional = aspirantesConPosicion.find(
      (a) => a.matricula === "MAT2",
    )!;
    expect(incondicional.posicionesPorZona["7 TIJUANA"]).toBeDefined();
    expect(incondicional.posicionesPorZona["2 MEXICALI"]).toBeDefined();
  });

  it("las posiciones son consecutivas sin huecos por zona", () => {
    const aspirantes = [
      aspirante(1, ["7 TIJUANA"]),
      aspirante(3, ["7 TIJUANA"]),
      aspirante(5, ["7 TIJUANA"]),
    ];
    const { aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    const posiciones = aspirantesConPosicion
      .map((a) => a.posicionesPorZona["7 TIJUANA"])
      .sort((a, b) => a - b);
    expect(posiciones).toEqual([1, 2, 3]);
  });

  it("respeta el orden de LUG.ESC. al asignar posiciones", () => {
    const aspirantes = [
      aspirante(10, ["7 TIJUANA"]),
      aspirante(3, ["INCONDICIONAL"]),
      aspirante(7, ["7 TIJUANA"]),
    ];
    const { aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    // En Tijuana deben estar los 3: lugar 3 (incondicional), 7, 10
    // Posición 1 → lugar 3, posición 2 → lugar 7, posición 3 → lugar 10
    const map = Object.fromEntries(
      aspirantesConPosicion.map((a) => [
        a.lugar,
        a.posicionesPorZona["7 TIJUANA"],
      ]),
    );
    expect(map[3]).toBe(1);
    expect(map[7]).toBe(2);
    expect(map[10]).toBe(3);
  });

  it("aspirante con múltiples zonas condicionadas aparece en cada una", () => {
    const aspirantes = [
      aspirante(1, ["7 TIJUANA", "2 MEXICALI"]),
      aspirante(2, ["7 TIJUANA"]),
    ];
    const { aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    const a1 = aspirantesConPosicion.find((a) => a.lugar === 1)!;
    expect(a1.posicionesPorZona["7 TIJUANA"]).toBe(1);
    expect(a1.posicionesPorZona["2 MEXICALI"]).toBe(1);
  });

  it("retorna arreglo vacío y zonas vacías si no hay aspirantes", () => {
    const { aspirantesConPosicion, zonas } = calcularPosicionesPorZona([]);
    expect(aspirantesConPosicion).toHaveLength(0);
    expect(zonas).toHaveLength(0);
  });
});
