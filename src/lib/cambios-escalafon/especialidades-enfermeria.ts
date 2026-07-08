// Nombres de listados de enfermería a partir del código de área del SIAP.
//
// El SIAP no incluye la especialidad en el nombre de la categoría: todas las
// enfermeras especialistas salen como "ENFERMERA ESPECIALISTA 80" (categoría
// 22210080) y las jefas de piso como "ENFERMERA JEFE DE PISO 80" (23210080).
// El código de ÁREA identifica la especialidad, PERO no es único entre bases:
// el área 204 (Medicina de Familia) existe tanto para ESPECIALISTA como para
// JEFE DE PISO. Por eso el nombre depende de DOS cosas: la categoría base (que
// sí distingue el nombre del SIAP: "ESPECIALISTA" vs "JEFE DE PISO") y el área.
//
// Confirmado con la Subcomisión (2026-07-08) y verificado contra datos reales.

// Base ENFERMERA ESPECIALISTA (categoría 22210080): área → nombre completo.
export const ESPECIALISTA_POR_AREA: Record<number, string> = {
  204: "ENFERMERA ESPECIALISTA EN MEDICINA DE FAMILIA",
  216: "ENFERMERA ESPECIALISTA QUIRÚRGICA",
  226: "ENFERMERA ESPECIALISTA EN NEFROLOGÍA",
  232: "ENFERMERA ESPECIALISTA PEDIATRA",
  239: "ENFERMERA ESPECIALISTA EN GERIATRÍA",
  245: "ENFERMERA ESPECIALISTA EN ONCOLOGÍA",
  248: "ENFERMERA ESPECIALISTA EN CUIDADOS INTENSIVOS",
};

// Base ENFERMERA JEFE DE PISO (categoría 23210080): área → nombre completo.
// El área 284 es el jefe de piso "genérico": conserva el nombre del SIAP
// ("ENFERMERA JEFE DE PISO 80"), por eso no se mapea aquí. Sólo el 204 lleva
// el distintivo de Medicina de Familia.
export const JEFE_PISO_POR_AREA: Record<number, string> = {
  204: "ENFERMERA JEFE DE PISO MEDICINA DE FAMILIA",
};

function parseArea(area?: number | string | null): number | null {
  if (area == null || area === "") return null;
  const code = typeof area === "string" ? parseInt(area, 10) : area;
  return Number.isFinite(code) ? (code as number) : null;
}

/**
 * Nombre para mostrar de un listado. Para enfermería usa el área para resolver
 * la especialidad concreta, distinguiendo la base por el nombre del SIAP
 * (JEFE DE PISO vs ESPECIALISTA). Si no es enfermería o el área no está mapeada,
 * conserva el nombre original del SIAP.
 */
export function nombreListadoConEspecialidad(
  categoriaDesc: string,
  area?: number | string | null,
): string {
  const desc = (categoriaDesc || "").toUpperCase();
  const code = parseArea(area);
  if (code == null) return categoriaDesc;

  if (desc.includes("JEFE DE PISO")) {
    return JEFE_PISO_POR_AREA[code] ?? categoriaDesc;
  }
  // "ENFERMERA ESPECIALISTA 80" y demás variantes de especialista.
  if (desc.includes("ENFERMER")) {
    return ESPECIALISTA_POR_AREA[code] ?? categoriaDesc;
  }
  return categoriaDesc;
}
