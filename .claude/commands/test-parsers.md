Ejecuta la suite completa de validacion para el pipeline de parsing PDF/Excel.

## Pasos

1. Corre `npm run pdf:test` y reporta resultados.
2. Corre `npm run pdf:test:nuevo-ingreso` si el cambio toca parsers de nuevo ingreso.
3. Corre `npm run positions:test` si el cambio podria afectar el calculo de posiciones downstream.
4. Corre `npm run typecheck` para verificar que los tipos de salida del parser siguen siendo compatibles con `src/types/bolsa-de-trabajo.ts`.
5. Resume:
   - Parsers que pasaron
   - Parsers que fallaron con detalle del error
   - Si algun campo cambio de nombre o estructura, advierte sobre impacto downstream en ranking o API
