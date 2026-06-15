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

  it("trata '0 Incondicional' (zona SIAP) igual que INCONDICIONAL", () => {
    const aspirantes = [
      aspirante(1, ["0 Incondicional"]),
      aspirante(2, ["7 TIJUANA"]),
    ];
    const { zonas, aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    expect(zonas).not.toContain("0 Incondicional");
    expect(zonas).toContain("7 TIJUANA");
    const a1 = aspirantesConPosicion[0];
    expect(a1.posicionesPorZona["7 TIJUANA"]).toBe(1);
    const a2 = aspirantesConPosicion[1];
    expect(a2.posicionesPorZona["7 TIJUANA"]).toBe(2);
  });

  it("calcula posiciones separadas por estatus — Activo y PEI no se mezclan", () => {
    const aspirantes = [
      aspirante(1, ["7 TIJUANA"], "Activo"),
      aspirante(2, ["7 TIJUANA"], "PEI"),
      aspirante(3, ["7 TIJUANA"], "Activo"),
      aspirante(4, ["7 TIJUANA"], "PEI"),
    ];
    const { aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    const [a1, pei2, a3, pei4] = aspirantesConPosicion;

    // Activo-only: lugar 1 → pos 1, lugar 3 → pos 2
    expect(a1.posicionesActivoPorZona["7 TIJUANA"]).toBe(1);
    expect(a3.posicionesActivoPorZona["7 TIJUANA"]).toBe(2);
    // Los PEI no tienen posición Activo
    expect(pei2.posicionesActivoPorZona["7 TIJUANA"]).toBeUndefined();
    expect(pei4.posicionesActivoPorZona["7 TIJUANA"]).toBeUndefined();

    // PEI-only: lugar 2 → pos 1, lugar 4 → pos 2
    expect(pei2.posicionesPeiPorZona["7 TIJUANA"]).toBe(1);
    expect(pei4.posicionesPeiPorZona["7 TIJUANA"]).toBe(2);
    // Los Activos no tienen posición PEI
    expect(a1.posicionesPeiPorZona["7 TIJUANA"]).toBeUndefined();
    expect(a3.posicionesPeiPorZona["7 TIJUANA"]).toBeUndefined();
  });

  it("un aspirante 0 Incondicional Activo aparece en posicionesActivoPorZona de todas las zonas", () => {
    const a = aspirante(5, ["0 Incondicional"], "Activo");
    const b = aspirante(10, ["7 TIJUANA"], "Activo");
    const { aspirantesConPosicion } = calcularPosicionesPorZona([a, b]);
    expect(aspirantesConPosicion[0].posicionesActivoPorZona["7 TIJUANA"]).toBe(1);
    expect(aspirantesConPosicion[1].posicionesActivoPorZona["7 TIJUANA"]).toBe(2);
  });

  it("un aspirante 0 Incondicional PEI aparece en posicionesPeiPorZona de todas las zonas", () => {
    const a = aspirante(5, ["0 Incondicional"], "PEI");
    const b = aspirante(10, ["7 TIJUANA"], "PEI");
    const { aspirantesConPosicion } = calcularPosicionesPorZona([a, b]);
    expect(aspirantesConPosicion[0].posicionesPeiPorZona["7 TIJUANA"]).toBe(1);
    expect(aspirantesConPosicion[1].posicionesPeiPorZona["7 TIJUANA"]).toBe(2);
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

  it("reconoce zona incondicional truncada/multilínea del PDF ('0\\r\\nINCONDICIONA')", () => {
    // Caso real (listado OF SOPORTE TEC INFORMAT): el PDF guarda la zona
    // incondicional como "0\r\nINCONDICIONA" (con salto de línea y sin la "L").
    // No debe contarse como zona propia y debe calificar para todas las zonas.
    const aspirantes = [
      aspirante(14, ["0\r\nINCONDICIONA"], "Activo"), // incondicional truncado
      aspirante(15, ["0\r\nINCONDICIONA"], "Activo"), // incondicional truncado
      aspirante(16, ["1 ENSENADA"], "Activo"), // Claudia
    ];
    const { zonas, aspirantesConPosicion } =
      calcularPosicionesPorZona(aspirantes);

    // La zona truncada NO debe aparecer como zona real
    expect(zonas).not.toContain("0\r\nINCONDICIONA");
    expect(zonas).toContain("1 ENSENADA");

    const map = Object.fromEntries(
      aspirantesConPosicion.map((a) => [
        a.lugar,
        a.posicionesActivoPorZona["1 ENSENADA"],
      ]),
    );
    // Los dos incondicionales (lugar 14, 15) están arriba; Claudia (16) es la #3
    expect(map[14]).toBe(1);
    expect(map[15]).toBe(2);
    expect(map[16]).toBe(3);
  });

  it("retorna arreglo vacío y zonas vacías si no hay aspirantes", () => {
    const { aspirantesConPosicion, zonas } = calcularPosicionesPorZona([]);
    expect(aspirantesConPosicion).toHaveLength(0);
    expect(zonas).toHaveLength(0);
  });
});
