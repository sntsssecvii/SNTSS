# Handoff — Chatbot CCT (2026-07-09)

Contexto para retomar el trabajo del chatbot del contrato colectivo, incluyendo
setup en una PC nueva.

## Dónde nos quedamos

Sesión larga sobre el chatbot (`/admin/lab/chat-contrato`, visible solo a
developers). Se resolvieron bugs, se rediseñó la UI y se activó la **búsqueda
semántica** (el hallazgo grande de la sesión).

### Ramas / PRs
- **PR #69** (`fix/chat-contrato-ui-y-sesiones`) — **MERGEADO** a main. Trae:
  rate-limit → fallback extractivo, log de usage Groq, guardado de sesiones
  (saneador de `undefined` + índice compuesto), enlace "Chatbot CCT" en sidebar,
  rediseño UI tipo ChatGPT con panel colapsable.
- **PR #70** (misma rama) — **PENDIENTE DE MERGE**. Trae los 3 commits del motor
  semántico que quedaron fuera del #69 porque se mergeó antes de subirlos:
  - `66c77cd` prestaciones estructuradas (keyword + sinónimos)
  - `aa2e7d7` routing semántico de prestaciones por embeddings
  - `0bc94b1` embeddings del contrato (1333 chunks) + prestaciones (22) + calibración
  - https://github.com/sntsssecvii/SNTSS/pull/70

## Pendientes para dejar prod correcto

1. **Mergear PR #70** → activa el motor semántico en prod.
2. **`JINA_API_KEY` en Vercel** (Settings → Environment Variables → *Production*),
   luego **redeploy** (las env vars solo aplican en el siguiente deploy). Sin ella
   el chatbot sigue en modo "palabras literales" y falla con sinónimos.
3. **Índice de Firestore** (arregla el 500 de `/sessions`; el guardado ya funciona,
   solo falla el listado). Crear el índice compuesto `chat_contrato_sessions`
   (`userId` ASC + `updatedAt` DESC). Opciones:
   - `firebase deploy --only firestore:indexes` (usa `firestore.indexes.json` del repo), o
   - Consola: https://console.firebase.google.com/project/sntss-f352c/firestore/indexes

## Setup en PC nueva

El repo trae todo el código y `contract-index-data.json` (19MB, con embeddings).
Lo que NO viaja por git y hay que reconfigurar:

1. **`.env.local`** (gitignored) — recrear con las variables. Las críticas para el
   chatbot: `GROQ_API_KEY` (LLM) y `JINA_API_KEY` (embeddings). Las demás vienen de
   `.env.example`. Firebase admin también.
2. **`contract-faqs-embeddings.json`** (22MB, gitignored) — opcional; es solo un
   *boost* de retrieval. Si se quiere: `JINA_API_KEY=xxx npx tsx scripts/ops/embed-faqs.ts`.
3. `npm install` y listo.

## Cómo funciona el retrieval (referencia rápida)

`src/lib/contract-chat/index.ts` → `searchContractSources`:
- Recupera fragmentos (hybrid: keyword + semántico con embeddings Jina).
- Inyecta datos estructurados: **tabulador de sueldos** (gate `isSalaryQuery`) y
  **prestaciones** (routing semántico `matchPrestacionesSemantic`, umbral 0.38 +
  gap 0.06, unido con keyword). Para agregar una prestación: editar
  `prestaciones-data.json` y re-correr `scripts/ops/embed-prestaciones.ts`.
- El LLM (Groq/Llama-3.3-70b) responde solo con el contexto recuperado.

Scripts de embeddings (requieren `JINA_API_KEY`):
- `scripts/ops/generate-contract-embeddings.ts --force` (contrato)
- `scripts/ops/embed-faqs.ts` (FAQs)
- `scripts/ops/embed-prestaciones.ts` (prestaciones)
- Validación: `scripts/tests/probe-contract-chat.ts`

## Próximos pasos sugeridos (no urgentes)

- Con el feedback 👍/👎 y las sesiones ya guardándose, en unas semanas habrá datos
  reales para decidir qué más estructurar (candidatos: jubilación/pensión con sus
  tablas de %, prima de antigüedad).
- El índice del contrato pesa 19MB (cold start). Si molesta, se puede reducir la
  dimensión de los embeddings de Jina.
