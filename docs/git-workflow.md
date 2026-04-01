# Git Workflow

## Objetivo

Mantener `main` estable y hacer que los cambios sean faciles de revisar, probar y revertir.

## Ramas

- `main`: solo cambios estables listos para integrarse.
- `feat/*`: nuevas funciones o bloques grandes de trabajo.
- `fix/*`: correcciones puntuales.
- `chore/*`: tooling, docs, scripts, limpieza o mantenimiento.
- `docs/*`: cambios exclusivamente documentales.

## Regla base

No trabajar directo sobre `main` para cambios medianos o grandes. Crear una rama desde `main` o desde una rama base estable acordada.

## Convencion de commits

Usar Conventional Commits:

- `feat:`
- `fix:`
- `chore:`
- `docs:`
- `refactor:`
- `test:`

## Tamano recomendado

- Preferir commits pequenos y con una sola intencion.
- No mezclar extraccion, UI, refactor y debugging en el mismo commit.
- Si un cambio tiene varias capas, separarlo por bloques revisables.

## Validacion minima

Antes de abrir PR o mergear una rama:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run positions:test` si toca motor de posiciones
4. `npm run pdf:test` si toca parsing o extraccion

## Merge

- Preferir PR aun cuando el equipo sea pequeno.
- Describir claramente alcance, riesgo y pasos de validacion.
- Si hay cambios en Firebase, parsing o reglas de posicion, revisar con mas cuidado.
