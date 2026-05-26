// TODO(feat/propuestas-admision): reimplementar generación de PDF para el nuevo schema de Propuesta
// El schema viejo (trabajadorActivo, aspirante con nombre/domicilio/rfc) ya no existe.

import type { Propuesta } from "@/types/propuestas";

/**
 * Placeholder — sin operación hasta que se implemente el generador de PDF
 * para el nuevo módulo de admisión sindical.
 */
export const descargarPropuestaPDF = async (
  _propuesta: Propuesta,
): Promise<void> => {
  console.warn(
    "descargarPropuestaPDF: no implementado para el nuevo módulo de admisión",
  );
};
