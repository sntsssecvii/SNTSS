---
name: pdf-parser-update
description: Use this skill when changing PDF or Excel extraction/parsing for SNTSS bolsa de trabajo. Covers Adobe-based extraction flow, parser updates, fixtures, and safe validation steps without mixing parser work with ranking logic.
---

# PDF Parser Update

Use this skill for extraction, normalization, and parser changes.

## Work area

- Parsing entry points: `src/lib/pdf/`
- Excel conversion/parsing: `src/lib/excel/`
- Import/extract API routes: `src/app/api/bolsa-de-trabajo/extraer/`, `src/app/api/bolsa-de-trabajo/importar/`
- Test scripts: `scripts/tests/test-parsers.ts`, `scripts/tests/test-nuevo-ingreso.ts`
- Parser notes: `docs/testing/pdf-parsers.md`

## Rules

- Do not mix parser changes with ranking-engine changes in one task unless the user explicitly wants both.
- Treat Adobe extraction as the primary production path.
- Keep artifacts and generated outputs out of the repo root; use `artifacts/` if you generate local outputs.
- Do not remove fixtures in `src/assets/PDFs/` without confirming they are not required.

## Workflow

1. Identify whether the bug is in extraction, normalization, or parser mapping.
2. Inspect the parser/schema file for the affected document type.
3. Update only the relevant parser path.
4. If field names change, verify downstream type definitions in `src/types/bolsa-de-trabajo.ts`.
5. Run:
   - `npm run pdf:test`
   - `npm run typecheck`
   - `npm run lint`

## Guardrails

- Keep parser output stable for already-working document types.
- Prefer targeted fixtures and explicit assertions over ad hoc console debugging.
- If a parser field feeds ranking logic, note the impact but avoid changing ranking in the same patch unless required.

## Done when

- The parser produces the expected normalized fields.
- Parsing tests pass.
- Any changed field mapping is reflected in shared types or docs.
