Verifica que el proyecto esta listo para deploy a produccion.

## Pasos

1. Corre `npm run build` y verifica que compila sin errores.
2. Corre `npm run check` (typecheck + lint).
3. Si hay cambios pendientes en `firestore.rules` vs lo que esta en el ultimo commit, advierte que las reglas necesitan deploy separado con `firebase deploy --only firestore:rules`.
4. Revisa si hay archivos `.env` o secretos accidentalmente staged.
5. Verifica que no hay `console.log` de debug en archivos modificados (excluir scripts/).
6. Resume:
   - Estado del build
   - Validaciones pasadas
   - Advertencias de deploy (reglas Firebase, variables de entorno, etc.)
   - Checklist final antes de mergear a main
