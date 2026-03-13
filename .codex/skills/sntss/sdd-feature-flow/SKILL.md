---
name: sdd-feature-flow
description: Use this skill when a SNTSS task should be handled with specification-driven development. Covers writing the spec first, deriving a technical backlog, implementing in phases, validating against acceptance criteria, and documenting decisions discovered during real-world testing.
---

# SDD Feature Flow

Use this skill for any important change that should not start directly in code.

Typical cases:

- security hardening
- worker portal changes
- admin flow redesigns
- new bolsa de trabajo rules
- privacy or access-control changes
- multi-file features with non-trivial risk

## Goal

Drive work in this order:

1. spec
2. technical backlog
3. implementation
4. validation
5. decisions and follow-up notes

## Templates

Use these templates:

- feature spec: `docs/specs/templates/feature-spec.md`
- security spec: `docs/specs/templates/security-spec.md`
- ui spec: `docs/specs/templates/ui-spec.md`
- backlog template: `docs/specs/templates/technical-backlog.md`

If the task does not fit one of these exactly, start from the closest template and keep it short.

## Workflow

1. Choose the right template.
2. Create the spec in `docs/specs/` with a clear name.
3. Write only what is needed:
   - objective
   - scope
   - constraints
   - risks
   - acceptance criteria
4. Derive a technical backlog from the spec.
5. Implement in small phases.
6. Validate against the acceptance criteria, not only against “it compiles”.
7. If real data forces a rule change, update the spec or add a decision note before closing.

## Naming

Use names like:

- `docs/specs/security-hardening-bolsa.md`
- `docs/specs/portal-trabajador-mis-tramites.md`
- `docs/specs/admin-quincenas-v2.md`

For the derived backlog:

- `docs/specs/<same-name>-backlog.md`

## Guardrails

- Do not jump to implementation when business rules are still ambiguous.
- Do not leave acceptance criteria implicit.
- If validation with real data changes the rule, document that change.
- Prefer small specs over one giant planning document.
- Keep the backlog technical and executable.

## Done when

- the spec exists
- the backlog exists
- implementation follows the spec
- validations are recorded
- unresolved decisions are called out explicitly
