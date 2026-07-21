# Chat Contrato Polish — Spec de Diseño

**Fecha:** 2026-07-20
**Branch base:** main (post-merge PR #76)
**Objetivo:** Llevar el chatbot del CCT IMSS-SNTSS de lab/experimental a producción interna (5-20 admins)
**Enfoque:** Bottom-up — refactorizar primero, luego mejorar calidad, luego features
**Timeline:** Sin prisa, que quede bien

## Contexto

El chatbot del contrato colectivo está funcional en `/admin/lab/chat-contrato`. Usa búsqueda híbrida (semántica Jina + keyword TF-IDF), generación con Groq (Llama 3.3 70B free tier), datos estructurados (tabulador, prestaciones, FAQs), y contextualización de follow-ups.

**Estado actual:**

- Retrieval accuracy: 85% (34/40 casos)
- Benchmark de respuestas: 30 casos definidos, nunca ejecutados
- Archivo principal: 3,697 líneas monolíticas en `index.ts`
- Infra: Groq free tier, 2 keys en la misma org (~6,000 TPM compartido)
- Feedback: thumbs up/down en UI pero no se persisten
- 6 fallos residuales en retrieval
- Alucinaciones observadas (citas inventadas de cláusulas/artículos)

**Restricciones:**

- Sin presupuesto para LLM — seguir en free tier
- Target: 5-20 usuarios admin, no producción masiva
- No hay prisa — calidad sobre velocidad

---

## Fase 1: Refactor del monolito

### Objetivo

Partir `src/lib/contract-chat/index.ts` (3,697 líneas) en módulos con responsabilidades claras para facilitar testing, mantenimiento y las mejoras de fases posteriores.

### Módulos

| Módulo                 | Responsabilidad                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants.ts`         | Constantes compartidas: paths, pesos, límites, modelos                                                                                                         |
| `query-processing.ts`  | normalizeText, tokenizeQuery, rewriteQueryLocal, ABBREVIATIONS, TYPO_CORRECTIONS, QUERY_EXPANSIONS, isConversationalPrompt, CONVERSATIONAL_PATTERNS            |
| `chunking.ts`          | DOCUMENT_SECTIONS, getDocumentSectionForPage, classifyContentType, buildChunkId, splitPagesIntoSections, splitSectionIntoChunks                                |
| `embeddings.ts`        | getJinaApiKey, fetchEmbeddings, cosineSimilarity, batch embedding                                                                                              |
| `search.ts`            | Búsqueda keyword (TF-IDF), búsqueda semántica, búsqueda híbrida, scoring, penalizaciones por contentType                                                       |
| `contextualization.ts` | contextualizeQuery, buildLocalContextualQuery, generateStandaloneQuery, fallbackContextualQuery, reinforceContextualTopic, sanitizeConversationHistory         |
| `evidence.ts`          | expandEvidenceSources, rerankEvidenceByQuestionIntent, orderSourcesForPrompt, checkThematicCompatibility, retrieval trace (build, record, getRecent)           |
| `structured-data.ts`   | Tabulador (load, buildContext, salary patterns), prestaciones (load, match keyword, match semántica, buildContext), FAQs (load, boost)                         |
| `evidence-pack.ts`     | detectQueryIntent, detectUserFacts, detectMissingFacts, buildEvidencePack, buildAnswerPlan, buildPlannedAnswerText                                             |
| `llm.ts`               | getGroqApiKeys, round-robin, buildPromptMessages, generateGroqAnswer, createGroqStream, extractive fallback, SYSTEM_PROMPT                                     |
| `index.ts`             | Public API: answerContractQuestion, searchContractSources, getContractIndex, rebuildContractIndex, getContractChatStatus, createGroqStream. Solo orquestación. |

### Reglas

- Cada módulo exporta funciones puras o casi puras
- `index.ts` orquesta, no tiene lógica propia
- Tests existentes (`index.test.ts`) se mantienen como integration tests
- No se cambia comportamiento — solo se mueve código
- Un commit por módulo extraído para facilitar review

---

## Fase 2: Resolver fallos de calidad

### 2a. 6 fallos residuales del benchmark de retrieval

| Fallo                                         | Problema                                                                   | Fix                                                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coloquial-permisos` / `ambigua-puedo-faltar` | Detección conversacional clasifica preguntas laborales cortas como saludos | Si query tiene verbos laborales (faltar, permiso, ganar, jubilar, beca, vacaciones), nunca es conversacional sin importar longitud                |
| `ambigua-cuanto-gano`                         | Keyword no conecta "gano" con tabulador                                    | Verificar que la expansión `gano->sueldo,salario,tabulador` ya agregada funcione en el benchmark                                                  |
| `sin-respuesta-sat`                           | Sufficiency marca "sufficient" incorrectamente                             | Ajustar `checkThematicCompatibility`: si ningún source tiene score > umbral Y los términos clave no aparecen en ningún chunk, marcar insufficient |
| `clausula-multi-chunk-42`                     | Chunk incompleto en el índice                                              | Regenerar índice con `reindex-contract-v2` y validar con `validate-contract-index`                                                                |
| `articulo-becas-5`                            | Resolución artículo+sección necesita mejorar                               | Buscar por `articleNumber` + `sectionNumber` combinados, no solo por número de artículo                                                           |

**Meta:** 95%+ en benchmark de retrieval (38/40 mínimo).

### 2b. Anti-alucinación

Problema observado: el LLM inventa citas de cláusulas/artículos/páginas que no están en las fuentes recuperadas.

**Soluciones:**

1. **Post-procesador de citas:** Regex que extrae citas del texto generado (ej. "Cláusula 24", "p. 281", "Artículo 20") y las cruza contra las fuentes reales del retrieval. Si hay mismatch: eliminar la cita falsa o agregar disclaimer "[cita no verificada]".
2. **Prompt reforzado:** Ajustar system prompt para que siempre cite página desde el primer turno, no solo cuando el usuario insiste. Agregar instrucción explícita: "SOLO cita cláusulas, artículos y páginas que aparezcan en el contexto proporcionado."
3. **Lista de páginas válidas ya existe** en `buildPromptMessages` — reforzar que el LLM la respete con instrucción más agresiva.

### 2c. Benchmark de respuestas

Correr los 30 casos de `evaluate-contract-responses.ts`. Evaluar 8 dimensiones:

- factualAccuracy, completeness, evidenceUsage, clarifyingQuestions
- abstention, noHallucination, citationAccuracy, clarity

**Meta:** 80%+ promedio en las 8 dimensiones. Iterar sobre fallos hasta alcanzar el threshold.

---

## Fase 3: Feedback loop + observabilidad

### 3a. Feedback persistido en Firestore

- Colección: `chat-contrato-feedback`
- Documento: `{ query, answer, sources[], rating: "up"|"down", comment?: string, userId, sessionId, timestamp }`
- API route: `POST /api/admin/lab/chat-contrato/feedback`
- UI: campo de texto opcional al dar thumbs down ("Que estuvo mal?")

### 3b. Logs estructurados

No dashboard complejo. Logs en console buscables en Vercel logs.

**Por request:**

```
[chat-contrato] { event: "query", latency: 1200, retrievalMs: 400, llmMs: 800, tokens: 850, sources: 5, mode: "hybrid", sufficiency: "sufficient" }
```

**Datos loggeados:**

- Latencia total, retrieval, LLM
- Tokens usados (prompt + completion)
- Modelo, modo de búsqueda, sources encontradas, sufficiency
- Modo de contextualización (none/local/llm/fallback)
- Rate limits, timeouts, fallbacks activados

### 3c. Dashboard de feedback

Vista en `/admin/lab/chat-contrato/feedback`:

- Lista de queries con rating negativo (tabla con filtros)
- Ratio up/down últimos 7 días
- Queries más frecuentes
- Sin gráficas — tabla simple

---

## Fase 4: Infra y estabilidad

### 4a. Segunda cuenta Groq

- Crear cuenta Groq con email diferente -> org diferente -> TPM independiente
- Agregar key como `GROQ_API_KEY_2` en `.env.local`
- Round-robin existente ya alterna keys — solo asegurar que la nueva key sea de org diferente
- Capacidad total: ~12,000 TPM (suficiente para 5-20 usuarios)

### 4b. Fallback extractivo mejorado

Hoy el fallback pega snippets crudos del contrato. Mejorar:

- Usar `AnswerPlan` + `EvidencePack` para construir respuesta estructurada sin LLM (bullets con citas)
- Badge en la UI: "Respuesta basada en extractos del contrato" cuando es fallback

### 4c. Rate limiting por usuario

- Rate limit por `userId`: 10 req/min por usuario
- Rate limit global: 30 req/min
- Mensaje amigable: "Estoy procesando mucha informacion, dame unos segundos"

### 4d. Cache inteligente

- Normalización pre-cache: quitar acentos, lowercase, trim antes de buscar/guardar cache
- TTL: 7 días (el contrato no cambia)
- Invalidación: al regenerar índice, limpiar cache

---

## Fase 5: UX polish

### 5a. Citación siempre visible

- Cada respuesta muestra fuentes como chips clickeables: `p. 281 | Clausula 24 | Art. 20`
- Click en chip expande el extracto relevante
- Asegurar que aparezca desde el primer turno, no solo cuando el usuario insiste

### 5b. Respuestas del primer turno

- Citar páginas y cláusulas desde la primera respuesta
- Si faltan datos (antigüedad, categoría), pedir al final de la respuesta, no como respuesta completa vacía

### 5c. Indicadores de estado

- "Buscando en el contrato..." durante retrieval
- "Generando respuesta..." durante LLM
- Badge de fallback extractivo si aplica
- Indicador sutil de cache hit

### 5d. Limpieza de código muerto

- Eliminar endpoint de sessions (`GET/POST /api/admin/lab/chat-contrato/sessions`) que da 500
- Quitar código relacionado en frontend

---

## Fase 6: Testing y validación final

### 6a. Unit tests por módulo

Al extraer cada módulo en Fase 1, agregar tests:

- `chunking.test.ts` — tamaño de chunks, overlap, metadatos
- `query-processing.test.ts` — expansiones, typos, abreviaciones, detección conversacional
- `contextualization.test.ts` — follow-ups, standalone query, fallback
- `evidence.test.ts` — expansion, reranking, thematic compatibility
- `search.test.ts` — scoring, penalizaciones por contentType

Tests de `index.test.ts` se mantienen como integration tests.

### 6b. Benchmarks como script manual

- Script `npm run bench:chat` que corre benchmark retrieval (40 casos) + respuesta (30 casos)
- Threshold: 95% retrieval, 80% respuesta
- Se corre manual antes de cada merge a main (no en CI — es lento y usa APIs externas)

### 6c. Validación con usuarios reales

- Pedir a 2-3 admins que usen el chatbot una semana
- Revisar feedback negativo en Firestore
- Iterar sobre fallos reales reportados

---

## Orden de ejecución

```
Fase 1 (Refactor) -> Fase 2 (Calidad) -> Fase 6a (Unit tests, en paralelo con Fase 2)
                                       -> Fase 3 (Feedback)
                                       -> Fase 4 (Infra)
                                       -> Fase 5 (UX)
                                       -> Fase 6b-c (Benchmarks + validación)
```

## Criterios de "listo"

- [ ] `index.ts` < 400 líneas (solo orquestación)
- [ ] Benchmark retrieval >= 95% (38/40)
- [ ] Benchmark respuesta >= 80% promedio en 8 dimensiones
- [ ] 0 alucinaciones de citas en los 30 casos de benchmark
- [ ] Feedback persistido y visible en dashboard
- [ ] Segunda cuenta Groq activa con org diferente
- [ ] Cache normalizado con TTL 7 días
- [ ] Rate limit por usuario funcionando
- [ ] Unit tests para cada módulo extraído
- [ ] Código muerto de sessions eliminado
- [ ] 1 semana de uso por admins sin fallos críticos
