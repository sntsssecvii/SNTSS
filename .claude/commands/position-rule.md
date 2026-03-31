Guia el cambio de una regla de posicion/ranking en bolsa de trabajo.

## Pasos

1. Lee `docs/bolsa-de-trabajo/motor-posiciones.md` para entender la regla actual.
2. Inspecciona la estrategia relevante en `src/lib/bolsa-de-trabajo/position-strategies.ts`.
3. Si la regla cambia, actualiza solo la estrategia del tipo de documento afectado — no crecer condicionales en archivos no relacionados.
4. Actualiza o agrega el caso en `scripts/tests/test-position-regression.ts`.
5. Si el output del trabajador cambia, verifica la vista publica en `src/app/(public)/bolsa-de-trabajo/resultado/`.
6. Corre:
   - `npm run positions:test`
   - `npm run typecheck`
   - `npm run lint`
7. Si la regla de negocio cambio, actualiza `docs/bolsa-de-trabajo/motor-posiciones.md`.
8. Resume que regla cambio, que tipos de documento se ven afectados, y si los tests de regresion pasaron.
