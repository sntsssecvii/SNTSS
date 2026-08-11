import type { CambiosRegistro } from "@/types/cambios-escalafon";

// ---------------------------------------------------------------------------
// Motor de posiciones de CAMBIOS DE ESCALAFÓN
// ---------------------------------------------------------------------------
// Reglas (confirmadas con la Subcomisión):
//  - Cada LISTADO es independiente (no se combinan 014 / 054 / sin concepto).
//  - Una solicitud a UNIDAD CONCRETA compite contra las que piden lo MISMO:
//      grupo = zona + unidad (adscripción) solicitada + turno solicitado.
//  - INCONDICIONAL (adscripción solicitada "0-INCONDICIONAL"): forma un grupo
//    SEPARADO e independiente. Los puros incondicionales de una zona compiten
//    SOLO entre ellos, sin mezclarse con las solicitudes a unidad concreta.
//      grupo = zona + adscripción solicitada INCONDICIONAL (cualquier turno).
//    Un incondicional pide "el municipio, la unidad que sea y el turno que sea",
//    así que no se subdivide por unidad ni por turno: todos los incondicionales
//    de la misma zona van juntos en una sola fila de competencia.
//  - Dentro de cualquier grupo, el orden (quién entra primero) es:
//      1) prelación por TIPO de cambio: TURNO → ÁREA → TIPO DE PLAZA →
//         ADSCRIPCIÓN → RESIDENCIA
//      2) a igual tipo, por fecha + hora de registro (más antiguo = lugar 1)
// ---------------------------------------------------------------------------

export interface CambiosPosicion {
  registro: CambiosRegistro;
  zona: string;
  unidad: string; // unidad del grupo donde se calculó el lugar
  turno: string;
  lugar: number;
  totalEnGrupo: number;
}

// Prelación dentro de un listado (menor = entra primero), confirmada con la
// Subcomisión. El tipo manda sobre la fecha; dentro de ADSCRIPCIÓN, quien YA
// percibe el concepto va antes que quien no percibe:
//   1 TURNO · 2 ÁREA · 3 TIPO DE PLAZA · 4 ADSCRIPCIÓN(percibe) ·
//   5 ADSCRIPCIÓN(no percibe) · 6 RESIDENCIA
const RANK_TIPO: Record<string, number> = {
  TURNO: 1,
  ÁREA: 2,
  AREA: 2,
  "TIPO DE PLAZA": 3,
  ADSCRIPCIÓN: 4,
  ADSCRIPCION: 4,
  RESIDENCIA: 6,
};

function percibeConcepto(r: { percibeConcepto?: string }): boolean {
  return (r.percibeConcepto ?? "").trim().toUpperCase().startsWith("S");
}

function rankPrelacion(r: CambiosRegistro): number {
  const base = RANK_TIPO[(r.tipo ?? "").toUpperCase().trim()] ?? 99;
  // Sólo la adscripción se subdivide por percibe (4 percibe / 5 no percibe).
  if (base === 4) return percibeConcepto(r) ? 4 : 5;
  return base;
}

// Unidad incondicional: "0-INCONDICIONAL", "0 INCONDICIONAL", "INCONDICIONAL".
export function esUnidadIncondicional(adscripcion: string): boolean {
  const norm = (adscripcion ?? "").replace(/\s/g, "").toUpperCase();
  return norm === "INCONDICIONAL" || /^\d{1,2}-?INCONDICIONAL$/.test(norm);
}

// Clave ordenable a partir de fecha (DD/MM/YYYY) + hora (HH:MM:SS).
function claveAntiguedad(r: CambiosRegistro): string {
  const partes = (r.fechaRegistro ?? "").split("/");
  const fecha =
    partes.length === 3
      ? `${partes[2]}${partes[1].padStart(2, "0")}${partes[0].padStart(2, "0")}`
      : "99999999";
  const hora = (r.horaRegistro ?? "")
    .replace(/[^0-9]/g, "")
    .padEnd(6, "0")
    .slice(0, 6);
  return fecha + hora;
}

const SEP = ":::";

// Etiquetas canónicas para el grupo independiente de incondicionales.
const UNIDAD_INCONDICIONAL = "0-INCONDICIONAL";
const TURNO_INCONDICIONAL = "INCONDICIONAL";

/**
 * Calcula el lugar de cada registro dentro de su grupo de competencia.
 * Cada registro cae en UN solo grupo:
 *   - unidad concreta → grupo (zona + unidad + turno) con las demás concretas.
 *   - incondicional   → grupo (zona + INCONDICIONAL) con los demás incondicionales
 *                       de esa zona, cualquier turno, separado de las concretas.
 */
export function calcularPosicionesCambios(
  registros: CambiosRegistro[],
): CambiosPosicion[] {
  if (registros.length === 0) return [];

  // Repartir cada registro en su grupo de competencia.
  const grupos = new Map<
    string,
    { zona: string; unidad: string; turno: string; regs: CambiosRegistro[] }
  >();
  const agregar = (
    key: string,
    zona: string,
    unidad: string,
    turno: string,
    r: CambiosRegistro,
  ) => {
    if (!grupos.has(key)) grupos.set(key, { zona, unidad, turno, regs: [] });
    grupos.get(key)!.regs.push(r);
  };

  for (const r of registros) {
    if (esUnidadIncondicional(r.adscripcionSolicitada)) {
      // Grupo separado por zona: todos los incondicionales de esa zona juntos,
      // sin subdividir por unidad ni por turno (aceptan cualquiera).
      agregar(
        `${r.zona}${SEP}__INCONDICIONAL__`,
        r.zona,
        UNIDAD_INCONDICIONAL,
        TURNO_INCONDICIONAL,
        r,
      );
    } else {
      agregar(
        `${r.zona}${SEP}${r.adscripcionSolicitada}${SEP}${r.turnoSolicitado}`,
        r.zona,
        r.adscripcionSolicitada,
        r.turnoSolicitado,
        r,
      );
    }
  }

  // Ordenar cada grupo y asignar lugar.
  const resultado: CambiosPosicion[] = [];
  for (const g of grupos.values()) {
    const ordenados = g.regs.slice().sort((a, b) => {
      const dt = rankPrelacion(a) - rankPrelacion(b);
      if (dt !== 0) return dt;
      return claveAntiguedad(a).localeCompare(claveAntiguedad(b));
    });
    ordenados.forEach((r, i) => {
      resultado.push({
        registro: r,
        zona: g.zona,
        unidad: g.unidad,
        turno: g.turno,
        lugar: i + 1,
        totalEnGrupo: ordenados.length,
      });
    });
  }

  return resultado;
}

// Clave estable para identificar un registro (id de Firestore, o matrícula+folio).
export function claveRegistro(r: CambiosRegistro): string {
  return r.id ?? `${r.matricula}${SEP}${r.noSolicitud}`;
}

export interface LugarDeRegistro {
  lugar: number;
  totalEnGrupo: number;
  unidad: string;
  turno: string;
}

/**
 * Devuelve el lugar por registro (para mostrar en tabla). Cada registro cae en
 * un solo grupo; si por datos duplicados hubiera más de uno, se toma el más
 * competido (mayor total, menor lugar).
 */
export function calcularLugaresPorRegistro(
  registros: CambiosRegistro[],
): Map<string, LugarDeRegistro> {
  const posiciones = calcularPosicionesCambios(registros);
  const porRegistro = new Map<string, CambiosPosicion[]>();
  for (const p of posiciones) {
    const k = claveRegistro(p.registro);
    if (!porRegistro.has(k)) porRegistro.set(k, []);
    porRegistro.get(k)!.push(p);
  }

  const repr = new Map<string, LugarDeRegistro>();
  for (const [k, lista] of porRegistro) {
    lista.sort((a, b) => b.totalEnGrupo - a.totalEnGrupo || a.lugar - b.lugar);
    const best = lista[0];
    repr.set(k, {
      lugar: best.lugar,
      totalEnGrupo: best.totalEnGrupo,
      unidad: best.unidad,
      turno: best.turno,
    });
  }
  return repr;
}
