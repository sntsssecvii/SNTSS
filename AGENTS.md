# AGENTS.md

## Objetivo
Mantener una base estable para SNTSS mientras se sigue desarrollando el flujo de autenticacion, panel administrativo y procesamiento de PDF/Excel para bolsa de trabajo.

## Reglas operativas
- Lee primero `README.md` y los documentos de operacion relacionados antes de hacer cambios amplios.
- No mezcles refactor, debugging y cambios funcionales en la misma tarea.
- Conserva cambios pequenos y reversibles.
- No muevas ni elimines archivos binarios o scripts de investigacion sin revisar si estan siendo usados en el flujo actual.
- No inventes variables de entorno, rutas de Firebase ni contratos de datos; usa los definidos en `src/lib` y `src/types`.

## Rutas criticas
- `src/app/`: rutas Next.js App Router
- `src/app/api/`: endpoints y acciones del backend web
- `src/components/`: UI reutilizable
- `src/lib/firebase/`: configuracion cliente/admin de Firebase
- `src/lib/pdf/`: extraccion, parsing y puentes con Python/servicios externos
- `src/lib/excel/`: conversion y parsing de hojas de calculo
- `src/types/`: contratos compartidos
- `scripts/ops/`: utilidades operativas y soporte Firebase
- `scripts/tests/`: pruebas manuales y regresion
- `scripts/debug/`: scripts de investigacion o debugging
- `artifacts/`: salidas temporales generadas por pruebas o diagnostico

## Cambios que requieren cuidado extra
- Reglas o credenciales de Firebase
- Procesamiento de PDF/Excel
- Variables de entorno
- Cambios en rutas publicas o admin
- Scripts que escriben datos reales en Firestore

## Validacion minima antes de cerrar una tarea
1. `npm run typecheck`
2. `npm run lint`
3. Si la tarea toca parsing o extraccion: `npm run pdf:test`

## Cuando pedir confirmacion antes de seguir
- Migraciones de estructura grandes
- Eliminacion o renombre masivo de scripts
- Cambio de proveedor externo
- Modificaciones de despliegue o reglas de seguridad

## Convenciones recomendadas
- Usa commits pequenos con Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Usa ramas por intencion (`feat/*`, `fix/*`, `chore/*`, `docs/*`) y evita trabajar directo en `main` para cambios medianos o grandes.
- Si agregas scripts temporales, nombrarlos claramente y documentar si son diagnostico, fixture o prueba manual.
- Los artefactos temporales deben ir a `tmp/` o `artifacts/`, no a `scripts/` ni a la raiz del repo.
