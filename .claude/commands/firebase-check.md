Valida cambios relacionados con Firebase antes de aplicarlos.

## Pasos

1. Identifica si el cambio toca config (`src/lib/firebase/config.ts`), rutas de lectura, rutas de escritura, o scripts operativos (`scripts/ops/`).
2. Verifica si usa Firebase client SDK o Admin SDK — no deben mezclarse en el mismo archivo.
3. Corre `npm run typecheck` y `npm run lint`.
4. Si el cambio toca `firestore.rules`, muestra un diff y advierte que requiere deploy manual.
5. Si el cambio escribe datos en Firestore (no solo lectura), advierte explicitamente y pide confirmacion.
6. Resume:
   - Tipo de cambio (config / lectura / escritura / reglas / script operativo)
   - Si toca datos de produccion: riesgo y mitigacion
   - Si se agregaron secretos accidentalmente
