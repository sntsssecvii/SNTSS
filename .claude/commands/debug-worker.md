Diagnostica un problema reportado por un trabajador en el portal.

## Instrucciones

1. Pide al usuario la matricula o email del trabajador (si no lo proporcionó ya).
2. Usa el MCP de Firebase para buscar al usuario en Firestore (`users` collection) por matricula o email.
3. Verifica:
   - Status del usuario (pending/active/rejected)
   - Rol asignado
   - Si tiene documentos en `tramites/`
   - Si aparece en `bolsa_posiciones_materializadas/` (si aplica)
4. Si el problema es de posiciones/bolsa de trabajo:
   - Busca los documentos relevantes en `bolsa_de_trabajo_documentos/`
   - Verifica la sincronizacion mas reciente en `sincronizaciones/`
5. Resume:
   - Estado del usuario en el sistema
   - Datos encontrados relevantes al problema
   - Posible causa raiz
   - Siguiente paso recomendado
