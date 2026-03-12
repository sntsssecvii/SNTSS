---
name: pr-preflight
description: Use this skill before creating or merging a pull request in SNTSS. It standardizes final validation, git hygiene, risk review, and the summary expected for a clean PR.
---

# PR Preflight

Use this skill before opening, updating, or reviewing a PR.

## Workflow

1. Check `git status` and confirm unrelated files are not accidentally included.
2. Review changed areas by intent, not only by file count.
3. Run the needed validations:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run positions:test` if bolsa position logic changed
   - `npm run pdf:test` if parsing/extraction changed
4. Summarize:
   - what changed
   - what was validated
   - residual risks

## Guardrails

- Do not open a PR with mixed unrelated work if it can be separated.
- Call out Firebase, parsing, and ranking changes explicitly.
- If a test could not be run, say so directly.

## Done when

- Working tree is intentional.
- Validations are documented.
- The PR summary is clear enough for a second reviewer to understand the risk.
