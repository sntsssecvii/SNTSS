import type { EscalafonAspirante } from "@/types/escalafon";

type AspiranteInput = Omit<
  EscalafonAspirante,
  | "id"
  | "listadoId"
  | "posicionesPorZona"
  | "posicionesActivoPorZona"
  | "posicionesPeiPorZona"
>;
type AspiranteConPosicion = AspiranteInput & {
  posicionesPorZona: Record<string, number>;       // global — membresía en zona
  posicionesActivoPorZona: Record<string, number>; // rank entre Activos
  posicionesPeiPorZona: Record<string, number>;    // rank entre PEI
};

// "INCONDICIONAL" exacto O "0 Incondicional", "1 Incondicional", etc.
// SIAP usa zona 0 para representar zona incondicional.
//
// El replace(/\s/g) elimina TODO whitespace, incluidos los \r\n que el PDF
// (pdfplumber / Adobe) inserta dentro de la celda: "0\r\nINCONDICIONA" → "0INCONDICIONA".
// Se matchea por la raíz "INCONDICION" porque el parser a veces trunca la "L"
// final ("INCONDICIONA"). Ninguna zona real empieza con dígitos + "INCONDICION",
// así que no hay falsos positivos.
function esIncondicional(zona: string): boolean {
  const norm = zona.replace(/\s/g, "").toUpperCase();
  return /^\d{0,2}INCONDICION/.test(norm);
}

export function calcularPosicionesPorZona(aspirantes: AspiranteInput[]): {
  aspirantesConPosicion: AspiranteConPosicion[];
  zonas: string[];
} {
  if (aspirantes.length === 0) {
    return { aspirantesConPosicion: [], zonas: [] };
  }

  // 1. Zonas únicas — excluir toda forma de incondicional
  const zonasSet = new Set<string>();
  for (const a of aspirantes) {
    for (const p of a.preferencias) {
      if (!esIncondicional(p.zonaSolicitada)) {
        zonasSet.add(p.zonaSolicitada);
      }
    }
  }
  const zonas = Array.from(zonasSet).sort();

  // 2. Inicializar posiciones vacías
  const conPosicion: AspiranteConPosicion[] = aspirantes.map((a) => ({
    ...a,
    posicionesPorZona: {},
    posicionesActivoPorZona: {},
    posicionesPeiPorZona: {},
  }));

  // 3. Por zona: global (membresía) + rank Activo-solo + rank PEI-solo
  for (const zona of zonas) {
    const calificados = conPosicion.filter((a) =>
      a.preferencias.some(
        (p) => esIncondicional(p.zonaSolicitada) || p.zonaSolicitada === zona,
      ),
    );
    calificados.sort((a, b) => a.lugar - b.lugar);

    // Global — solo para saber si el aspirante está en esta zona (para filtros de UI)
    calificados.forEach((a, idx) => {
      a.posicionesPorZona[zona] = idx + 1;
    });

    // Activos-only (para promoción escalafonaria)
    const activos = calificados.filter((a) => a.estatus === "Activo");
    activos.forEach((a, idx) => {
      a.posicionesActivoPorZona[zona] = idx + 1;
    });

    // PEI-only (para nominación a definitiva)
    const peis = calificados.filter((a) => a.estatus === "PEI");
    peis.forEach((a, idx) => {
      a.posicionesPeiPorZona[zona] = idx + 1;
    });
  }

  return { aspirantesConPosicion: conPosicion, zonas };
}
