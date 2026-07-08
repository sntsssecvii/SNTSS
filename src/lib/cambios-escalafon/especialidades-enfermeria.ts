// Especialidades de enfermería por código de área del SIAP.
//
// El SIAP no incluye la especialidad en el nombre de la categoría: todas las
// enfermeras especialistas salen como "ENFERMERA ESPECIALISTA 80" (categoría
// 22210080) y las jefas de piso como "ENFERMERA JEFE DE PISO 80" (23210080).
// Lo único que distingue la especialidad es el código de ÁREA. Este mapa lo
// traduce para nombrar los listados de forma legible.
//
// Confirmado con la Subcomisión (2026-07-08).
export const ESPECIALIDADES_ENFERMERIA: Record<number, string> = {
  200: "ENFERMERA JEFE DE PISO",
  204: "ENFERMERA ESPECIALISTA EN MEDICINA DE FAMILIA",
  216: "ENFERMERA ESPECIALISTA QUIRÚRGICA",
  226: "ENFERMERA ESPECIALISTA EN NEFROLOGÍA",
  232: "ENFERMERA ESPECIALISTA PEDIATRA",
  239: "ENFERMERA ESPECIALISTA EN GERIATRÍA",
  245: "ENFERMERA ESPECIALISTA EN ONCOLOGÍA",
  248: "ENFERMERA ESPECIALISTA EN CUIDADOS INTENSIVOS",
};

/**
 * Devuelve el nombre de la especialidad de enfermería para un código de área,
 * o null si el área no está mapeada.
 */
export function especialidadEnfermeria(
  area?: number | string | null,
): string | null {
  if (area == null || area === "") return null;
  const code = typeof area === "string" ? parseInt(area, 10) : area;
  if (!Number.isFinite(code)) return null;
  return ESPECIALIDADES_ENFERMERIA[code as number] ?? null;
}

/**
 * Nombre para mostrar de un listado: si es de enfermería y el área está
 * mapeada, devuelve la especialidad concreta; si no, el nombre original del
 * SIAP. Sólo aplica a categorías de enfermería (el nombre contiene "ENFERMER").
 */
export function nombreListadoConEspecialidad(
  categoriaDesc: string,
  area?: number | string | null,
): string {
  if (/ENFERMER/i.test(categoriaDesc)) {
    const esp = especialidadEnfermeria(area);
    if (esp) return esp;
  }
  return categoriaDesc;
}
