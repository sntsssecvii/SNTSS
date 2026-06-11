import type {
  BolsaPosicionMaterializada,
  CasoRepresentativo,
} from "@/types/bolsa-de-trabajo";

export function sampleRepresentativeCases(
  allNewPositions: BolsaPosicionMaterializada[],
  previousPositions: BolsaPosicionMaterializada[],
  documentoId: string,
): CasoRepresentativo[] {
  const docPositions = allNewPositions.filter(
    (p) => p.documentoId === documentoId,
  );
  if (docPositions.length === 0) return [];

  // Lookup de posición anterior
  const prevLookup = new Map<string, number>();
  for (const pos of previousPositions) {
    prevLookup.set(`${pos.tipoDocumento}::${pos.matricula}`, pos.posicionBase);
  }

  const sorted = [...docPositions].sort(
    (a, b) => a.posicionBase - b.posicionBase,
  );
  const selected = new Set<string>();
  const cases: CasoRepresentativo[] = [];

  const addCase = (
    pos: BolsaPosicionMaterializada,
    etiqueta: CasoRepresentativo["etiqueta"],
  ) => {
    if (selected.has(pos.matricula)) return;
    selected.add(pos.matricula);
    const posAnterior =
      prevLookup.get(`${pos.tipoDocumento}::${pos.matricula}`) ?? null;
    cases.push({
      matricula: pos.matricula,
      nombre: pos.nombre,
      categoria: pos.categoria,
      zona: pos.zona,
      tipoDocumento: pos.tipoDocumento,
      posAnterior,
      posNueva: pos.posicionBase,
      delta: posAnterior !== null ? pos.posicionBase - posAnterior : null,
      etiqueta,
    });
  };

  // 1. Zona incondicional con menor posición
  const incondicional = sorted.find((p) =>
    (p.zona || "").toUpperCase().includes("INCONDICIONAL"),
  );
  if (incondicional) addCase(incondicional, "INCONDICIONAL");

  // 2. Primer lugar
  if (sorted[0]) addCase(sorted[0], "PRIMERO");

  // 3. Eventual (antes de medio para garantizar su inclusión)
  const eventual = docPositions.find((p) => p.tipoContratacion === "8");
  if (eventual) addCase(eventual, "EVENTUAL");

  // 4. Posición media
  const medio = sorted[Math.floor(sorted.length / 2)];
  if (medio) addCase(medio, "MEDIO");

  // 5. Caso aleatorio adicional
  const remaining = docPositions.filter((p) => !selected.has(p.matricula));
  if (remaining.length > 0) {
    addCase(remaining[Math.floor(remaining.length / 2)], "MUESTRA");
  }

  return cases;
}
