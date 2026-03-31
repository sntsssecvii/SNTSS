Ejecuta el preflight completo antes de abrir o mergear un PR.

## Pasos

1. Corre `git status` y verifica que no hay archivos accidentales staged o untracked que no correspondan al cambio.
2. Corre `git diff --stat` para resumir el alcance del cambio.
3. Ejecuta las validaciones base:
   - `npm run typecheck`
   - `npm run lint`
4. Detecta si necesitas validaciones extra por area de impacto:
   - Si hay cambios en `src/lib/pdf/` o `src/lib/excel/`: corre `npm run pdf:test`
   - Si hay cambios en `src/lib/bolsa-de-trabajo/`: corre `npm run positions:test`
   - Si hay cambios en `firestore.rules`: advierte que requiere revision manual de reglas
5. Resume en formato PR:
   - Que cambio (por area: UI, API, parsing, posiciones, auth, etc.)
   - Que se valido y que paso
   - Riesgos residuales o cosas que no se pudieron validar localmente
   - Si toca Firebase, parsing o ranking, mencionalo explicitamente
