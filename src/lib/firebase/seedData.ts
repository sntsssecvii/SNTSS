// TODO(feat/propuestas-admision): reescribir seedData para el nuevo schema de propuestas de admisión sindical
// El schema viejo (TrabajadorActivo, Aspirante como objeto inline, CategoriaPropuesta enum) ya no existe.

/**
 * Placeholder — sin operación hasta que se implemente el nuevo data layer de propuestas.
 */
export const seedPropuestas = async (
  _userId: string,
  _userEmail?: string,
): Promise<number> => {
  console.warn(
    "seedPropuestas: no implementado para el nuevo módulo de admisión",
  );
  return 0;
};
