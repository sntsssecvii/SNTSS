// src/lib/propuestas/warnings.ts
import type { WarningsPropuesta } from "@/types/propuestas";

export interface InputWarnings {
  propuestaActivaExistente: boolean;
  curpExisteEnActivas: boolean;
  hayRequerimientoDisponible: boolean;
  ineSubida: boolean;
}

export function calcularWarnings(
  input: InputWarnings,
): WarningsPropuesta & { tieneAlgunWarning: boolean } {
  const warnings: WarningsPropuesta = {
    propuestaActivaExistente: input.propuestaActivaExistente,
    sinRequerimientoDisponible: !input.hayRequerimientoDisponible,
    curpDuplicado: input.curpExisteEnActivas,
    categoriaIncompatible: false, // reservado para lógica futura de zona/categoría
    documentoFaltante: !input.ineSubida,
  };
  const tieneAlgunWarning = Object.values(warnings).some(Boolean);
  return { ...warnings, tieneAlgunWarning };
}
