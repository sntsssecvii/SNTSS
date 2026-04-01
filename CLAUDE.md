# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aplicacion web Next.js 14 (App Router) + Firebase para flujos internos de SNTSS. Incluye autenticacion, panel admin, portal de trabajador y procesamiento de PDF/Excel para el modulo de bolsa de trabajo.

## Commands

```bash
npm run dev            # Servidor de desarrollo
npm run build          # Build de produccion
npm run typecheck      # Verificacion de tipos (tsc --noEmit)
npm run lint           # ESLint
npm run check          # typecheck + lint (correr antes de cerrar cambios)
npm test               # Vitest — tests unitarios e integracion
npm run test:watch     # Vitest en modo watch
npm run test:coverage  # Vitest con reporte de cobertura
npm run pdf:test       # Tests de parsers PDF (scripts manuales)
npm run pdf:test:nuevo-ingreso  # Test parser nuevo ingreso
npm run positions:test # Tests de regresion del motor de posiciones
```

Tambien disponible via `make check`, `make dev`, `make pdf-test`.

## Validacion minima antes de commit

1. `npm run check` (siempre)
2. `npm run pdf:test` si se toca parsing/extraccion
3. `npm run positions:test` si se toca motor de posiciones

## Architecture

### Tech Stack

- **Frontend:** Next.js 14.2, React 18, TypeScript 5, Tailwind CSS 3.4, Radix UI, Framer Motion
- **Backend:** Next.js API Routes (App Router), Firebase Admin SDK
- **Database:** Firebase Firestore (sin ORM, uso directo del SDK)
- **Auth:** Firebase Authentication (cliente + admin)
- **Email:** Resend
- **PDF:** Adobe PDF Services SDK, pdfjs-dist, pdf-parse, puente Python (pdfplumber)
- **Excel:** XLSX
- **Validacion:** Zod + React Hook Form

### Route Groups (App Router)

- `(auth)` — login, registro, recuperacion de contrasena (sin layout principal)
- `(main)` — rutas protegidas con sidebar/navbar (admin y dashboard del trabajador)
- `(public)` — consulta publica de bolsa de trabajo

### Auth & RBAC

- `AuthContext` (`src/contexts/AuthContext.tsx`) maneja estado de auth en cliente con Firebase listener
- Roles definidos en `src/types/roles.ts`: SUPER_ADMIN, ADMIN, REVISOR, CAPTURISTA, CONSULTA, USER
- 50+ permisos granulares con helpers `tienePermiso()`, `tieneAlgunPermiso()`, `tieneTodosPermisos()`
- Server-side: `requireAdminRequest()` en API routes para validar auth + permisos
- Rate limiting en todos los endpoints (`src/lib/security/rate-limit.ts`)

### Data Layer (Firestore)

No hay ORM. Las operaciones de datos estan en `src/lib/firebase/`:

- `users.ts` — perfiles de usuario
- `bolsa-de-trabajo.ts` — documentos de bolsa
- `propuestas.ts` — propuestas
- `sincronizaciones.ts` — tracking de sincronizaciones
- `bolsa-posiciones-materializadas.ts` — posiciones cacheadas/materializadas
- `trabajador-portal.ts` — datos del portal del trabajador
- `admin-audit.ts` — log de auditorias admin

### PDF/Excel Processing Pipeline

1. Upload a `/api/bolsa-de-trabajo/procesar`
2. Deteccion de tipo de documento (NUEVO_INGRESO, CAMBIOS_AREA, etc.)
3. Extraccion de texto (Adobe SDK / pdfjs-dist / pdf-parse / Python bridge)
4. Parsing con parsers especificos por tipo (`src/lib/pdf/parsers/`)
5. Validacion contra schemas Zod (`src/lib/pdf/schemas.ts`)
6. Almacenamiento en Firestore

### Position Engine

Motor de calculo de posiciones en `src/lib/bolsa-de-trabajo/`:

- `position-engine.ts` — logica principal de matching
- `position-materialization.ts` — materializacion de posiciones
- `position-strategies.ts` — estrategias de asignacion
- `position-contracts.ts` — contratos de posicion
- `calculos.ts` — calculos de posiciones

### Path Alias

`@/*` mapea a `./src/*` (tsconfig.json)

## Key Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`)
- **Ramas:** `feat/*`, `fix/*`, `chore/*`, `docs/*` — no trabajar directo en `main` para cambios medianos/grandes
- No mezclar refactor, debugging y cambios funcionales en la misma tarea
- No inventar variables de entorno, rutas de Firebase ni contratos de datos; usar los definidos en `src/lib` y `src/types`
- Archivos temporales van a `artifacts/` o `tmp/`, nunca a la raiz del repo
- Cambios grandes o riesgosos requieren spec primero (SDD): spec, backlog, implementacion, validacion
- Si una tarea toca Firebase rules, parsing, o reglas de posicion, requiere revision extra

## Slash Commands

Comandos personalizados en `.claude/commands/`:

| Comando           | Uso                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------- |
| `/pr-check`       | Preflight completo antes de abrir PR — detecta area de impacto y corre tests selectivos |
| `/spec`           | Iniciar specification-driven development con plantillas de `docs/specs/templates/`      |
| `/test-parsers`   | Suite de validacion PDF/Excel con reporte de resultados                                 |
| `/deploy-check`   | Verificar build, reglas Firebase y secretos antes de deploy                             |
| `/firebase-check` | Validar cambios Firebase con advertencias de riesgo                                     |
| `/position-rule`  | Guiar cambio de regla de ranking con tests de regresion                                 |
| `/debug-worker`   | Diagnosticar problema de un trabajador via Firestore MCP                                |
| `/quick-fix`      | Fix rapido con validacion y commit automatico                                           |
| `/new-component`  | Crear componente con convenciones de nombre correctas                                   |
| `/new-api`        | Crear API route con estructura estandar (auth, Zod, audit)                              |

## Testing

- **Vitest** para tests unitarios e integracion (`src/**/*.test.{ts,tsx}`)
- Tests existentes en `src/lib/bolsa-de-trabajo/__tests__/`
- Scripts manuales de regresion en `scripts/tests/` (parsers PDF, posiciones)
- Fixtures PDF/Excel en `src/assets/PDFs/`
- Cobertura: `npm run test:coverage`

## Naming Conventions

| Directorio           | Convencion          | Ejemplo                |
| -------------------- | ------------------- | ---------------------- |
| `src/components/`    | PascalCase          | `MiComponente.tsx`     |
| `src/components/ui/` | kebab-case (shadcn) | `mi-componente.tsx`    |
| `src/lib/`           | kebab-case          | `mi-utilidad.ts`       |
| `src/types/`         | kebab-case          | `mi-tipo.ts`           |
| `src/app/api/`       | kebab-case dirs     | `mi-endpoint/route.ts` |
| `src/app/` pages     | kebab-case dirs     | `mi-pagina/page.tsx`   |
| `src/contexts/`      | PascalCase          | `MiContext.tsx`        |

## Firestore Schema

Documentado en `docs/firestore-schema.md`. Actualizar cuando se agreguen campos o colecciones.

## MCP Servers

- **Firebase** (`@gannonh/firebase-mcp`) — inspeccionar Firestore, buscar usuarios, verificar documentos y sincronizaciones directamente desde Claude Code.
- **Context7** — documentacion actualizada de librerias y frameworks.
- **Vercel** — gestion de deployments y logs.

## Hooks Activos

- **Post-commit** — recordatorio de `/pr-check` antes de abrir PR
- **Pre-edit firestore.rules** — advertencia de deploy manual requerido
- **Pre-edit .env** — advertencia de archivos sensibles

## Environment

Variables documentadas en `.env.example`. Requiere Node.js 20+ y npm 10+.
Service account de Firebase en `~/.config/firebase/sntss-service-account.json` (fuera del repo).
