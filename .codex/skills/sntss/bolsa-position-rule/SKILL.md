---
name: bolsa-position-rule
description: Use this skill when adding, changing, reviewing, or debugging position-calculation logic for SNTSS bolsa de trabajo. Covers the shared position engine, strategy-per-document-type pattern, regression tests, and required docs updates.
---

# Bolsa Position Rule

Use this skill for any task that changes ranking logic in bolsa de trabajo.

## Work area

- Engine and contracts: `src/lib/bolsa-de-trabajo/`
- Worker lookup endpoint: `src/app/api/trabajador/posicion/route.ts`
- Admin pre-calculation view: `src/app/(main)/admin/bolsa-de-trabajo/[id]/page.tsx`
- Regression tests: `scripts/tests/test-position-regression.ts`
- Business docs: `docs/bolsa-de-trabajo/motor-posiciones.md`

## Rules

- Do not rewrite extraction or Firestore flow when the task is only about positions.
- Keep the architecture as `contracts + engine + strategies + regression tests`.
- Preserve current behavior for working types unless the user explicitly changes business rules.
- Add or update one strategy per document type instead of growing conditionals in unrelated files.

## Workflow

1. Read `docs/bolsa-de-trabajo/motor-posiciones.md` if the rule is not obvious.
2. Inspect the relevant strategy in `src/lib/bolsa-de-trabajo/position-strategies.ts`.
3. Update contracts only if the current engine cannot express the new rule.
4. Update `scripts/tests/test-position-regression.ts` with the exact case being changed.
5. If the worker-facing output changes, verify `src/app/(public)/bolsa-de-trabajo/resultado/[matricula]/page.tsx`.
6. Run:
   - `npm run positions:test`
   - `npm run typecheck`
   - `npm run lint`

## Implementation guardrails

- Group definition is the real business rule. Confirm grouping before touching sort logic.
- Prefer deterministic ranking from normalized fields.
- Use `applyPriorityRules` only for special cases such as `CAMBIOS_RAMA`.
- Use `computeSecondaryMetrics` for parallel rankings such as interinato in `NUEVO_INGRESO`.

## Done when

- Strategy and tests match the business rule.
- Existing regression tests still pass.
- Relevant docs are updated if the rule changed.
