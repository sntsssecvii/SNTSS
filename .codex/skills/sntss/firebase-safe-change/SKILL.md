---
name: firebase-safe-change
description: Use this skill when changing Firebase config, Firestore access, sync flows, admin credentials, or production-sensitive data paths in SNTSS. Focuses on safe changes, approval boundaries, and required validation.
---

# Firebase Safe Change

Use this skill for Firestore, Firebase Admin, sync metadata, or credential-sensitive work.

## Work area

- Firebase config: `src/lib/firebase/`
- Sync logic: `src/lib/firebase/sincronizaciones.ts`
- API routes touching Firestore: `src/app/api/`
- Operational scripts: `scripts/ops/`

## Rules

- Do not change production-sensitive paths, rules, or destructive scripts without explicit user confirmation.
- Never hardcode secrets, service-account values, or tokens.
- Prefer read-only inspection before write operations.
- If the task could touch real Firestore data, state that risk explicitly in the summary.

## Workflow

1. Identify whether the change is config, read path, write path, or operational script.
2. Read the target file and confirm whether it uses client or admin Firebase APIs.
3. Make the smallest possible change.
4. Run the lightest safe validation available:
   - `npm run typecheck`
   - `npm run lint`
   - targeted script only if needed

## Guardrails

- Preserve separation between client config and admin config.
- Changes to auth, sync source-of-truth, or Firestore structure need extra caution.
- If a change impacts production documents or synchronization state, call that out before finishing.

## Done when

- No secrets were added.
- Validation passed.
- Risky operational impact, if any, is clearly stated.
