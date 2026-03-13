# SNTSS

Aplicacion web en Next.js para flujos internos de SNTSS. El proyecto incluye autenticacion con Firebase, panel administrativo y herramientas para procesar PDF/Excel del modulo de bolsa de trabajo.

## Estado del proyecto

El repositorio contiene dos capas de trabajo:

- App principal: autenticacion, paneles, rutas publicas y API routes.
- Laboratorio operativo: scripts y utilidades para diagnostico, parsing y pruebas de extraccion.

La prioridad operativa es mantener estable la app mientras evoluciona el flujo de procesamiento documental.

## Requisitos

- Node.js 20+
- npm 10+

## Inicio rapido

1. Instala dependencias:

```bash
npm install
```

2. Crea tu archivo de entorno local:

```bash
cp .env.example .env.local
```

3. Completa las variables necesarias de Firebase y proveedores externos.

4. Inicia el entorno de desarrollo:

```bash
npm run dev
```

## Comandos principales

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run check
npm run pdf:test
```

Tambien puedes usar `make check`, `make dev` o `make pdf-test`.

## Estructura clave

- `src/app/`: rutas App Router, vistas publicas, admin y endpoints
- `src/components/`: componentes reutilizables y UI
- `src/contexts/`: contexto de autenticacion
- `src/lib/firebase/`: configuracion cliente y admin de Firebase
- `src/lib/pdf/`: extraccion, parsing y puentes con servicios/Python
- `src/lib/excel/`: conversion y parsing de Excel
- `src/types/`: tipos de dominio compartidos
- `scripts/ops/`: soporte operativo y Firebase
- `scripts/tests/`: pruebas manuales y regresion
- `scripts/debug/`: investigacion y debugging
- `artifacts/`: salidas generadas por pruebas, debugging y comparativas locales

## Variables de entorno

Las variables necesarias estan documentadas en `.env.example`. Las mas importantes son:

- `NEXT_PUBLIC_FIREBASE_*`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `ADOBE_CLIENT_ID`
- `ADOBE_CLIENT_SECRET`
- `ILOVEPDF_PUBLIC_KEY`
- `ILOVEPDF_SECRET_KEY`
- `RESEND_API_KEY`

## Documentacion relacionada

- `SETUP.md`
- `README-DEPLOY.md`
- `DEPLOY-VERCEL.md`
- `FIRESTORE_CHECKLIST.md`
- `PROYECTO_EXTRACCION_PDF.md`
- `docs/bolsa-de-trabajo/motor-posiciones.md`
- `docs/bolsa-de-trabajo/backlog-tecnico-motor-posiciones.md`
- `docs/bolsa-de-trabajo/rediseno-admin-quincenas.md`
- `docs/bolsa-de-trabajo/backlog-rediseno-admin.md`
- `docs/portal-trabajador/modelo-acceso-y-privacidad.md`
- `docs/portal-trabajador/migracion-consulta-publica-a-portal-privado.md`
- `docs/benchmark/seccion-v.md`
- `docs/portal/home-sntss-propuesta.md`
- `docs/portal/estado-landing-auth.md`
- `docs/testing/qa-bolsa-de-trabajo.md`
- `docs/git-workflow.md`
- `docs/agents/mcp-policy.md`
- `.codex/skills/sntss/`
- `AGENTS.md`

## Forma recomendada de trabajar

- Ejecuta `npm run check` antes de cerrar cambios.
- Si tocas parsing o extraccion, corre `npm run pdf:test`.
- Mantén scripts temporales y artefactos fuera de la raiz del repo.
- Las salidas generadas por pruebas deben ir a `artifacts/`, no a `scripts/`.
- No subas secretos a Git.
