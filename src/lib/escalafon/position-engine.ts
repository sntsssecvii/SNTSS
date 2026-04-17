import type { EscalafonAspirante } from "@/types/escalafon";

type AspiranteInput = Omit<
  EscalafonAspirante,
  "id" | "listadoId" | "posicionesPorZona"
>;
type AspiranteConPosicion = AspiranteInput & {
  posicionesPorZona: Record<string, number>;
};

function esIncondicional(zona: string): boolean {
  return zona.replace(/\s/g, "").toUpperCase() === "INCONDICIONAL";
}

export function calcularPosicionesPorZona(aspirantes: AspiranteInput[]): {
  aspirantesConPosicion: AspiranteConPosicion[];
  zonas: string[];
} {
  if (aspirantes.length === 0) {
    return { aspirantesConPosicion: [], zonas: [] };
  }

  // 1. Extraer zonas únicas (excluir INCONDICIONAL)
  const zonasSet = new Set<string>();
  for (const a of aspirantes) {
    for (const p of a.preferencias) {
      if (!esIncondicional(p.zonaSolicitada)) {
        zonasSet.add(p.zonaSolicitada);
      }
    }
  }
  const zonas = Array.from(zonasSet).sort();

  // 2. Inicializar mapa de posiciones vacío para cada aspirante
  const conPosicion: AspiranteConPosicion[] = aspirantes.map((a) => ({
    ...a,
    posicionesPorZona: {},
  }));

  // 3. Para cada zona, calcular posiciones
  for (const zona of zonas) {
    // Identificar aspirantes que califican para esta zona (en orden de lugar)
    const calificados = conPosicion.filter((a) =>
      a.preferencias.some(
        (p) => esIncondicional(p.zonaSolicitada) || p.zonaSolicitada === zona,
      ),
    );
    // Ordenar por lugar antes de asignar posición
    calificados.sort((a, b) => a.lugar - b.lugar);
    calificados.forEach((a, idx) => {
      a.posicionesPorZona[zona] = idx + 1;
    });
  }

  return { aspirantesConPosicion: conPosicion, zonas };
}
