# Chat Contrato Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactorizar el monolito de 3,697 líneas del chatbot del CCT en módulos testeables, resolver fallos de calidad, agregar feedback persistido y observabilidad, estabilizar infra, y pulir UX para producción interna (5-20 admins).

**Architecture:** Bottom-up — primero extraer módulos del monolito con tests unitarios (sin cambiar comportamiento), luego resolver fallos de retrieval y anti-alucinación sobre los módulos limpios, luego agregar feedback/observabilidad/cache/UX.

**Tech Stack:** Next.js 14 App Router, Groq (Llama 3.3 70B free tier), Jina Embeddings v3, Firestore, Vitest

**Spec:** `docs/superpowers/specs/2026-07-20-chat-contrato-polish-design.md`

---

## File Structure

### Nuevos archivos (Fase 1 — Refactor)

| Archivo                                                     | Responsabilidad                                                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/contract-chat/constants.ts`                        | Paths, pesos, límites, modelos, regex compartidos                                                                          |
| `src/lib/contract-chat/query-processing.ts`                 | normalizeText, tokenizeQuery, rewriteQueryLocal, ABBREVIATIONS, TYPO_CORRECTIONS, QUERY_EXPANSIONS, isConversationalPrompt |
| `src/lib/contract-chat/chunking.ts`                         | DOCUMENT_SECTIONS, classifyContentType, splitPagesIntoSections, splitSectionIntoChunks                                     |
| `src/lib/contract-chat/embeddings.ts`                       | Jina API, fetchEmbeddings, cosineSimilarity, generateQueryEmbedding                                                        |
| `src/lib/contract-chat/search.ts`                           | scoreChunkKeywords, hybridSearch, createExcerpt                                                                            |
| `src/lib/contract-chat/contextualization.ts`                | contextualizeQuery, buildLocalContextualQuery, generateStandaloneQuery, sanitizeConversationHistory                        |
| `src/lib/contract-chat/evidence.ts`                         | expandEvidenceSources, rerankEvidenceByQuestionIntent, checkThematicCompatibility, retrieval trace                         |
| `src/lib/contract-chat/structured-data.ts`                  | Tabulador, prestaciones (keyword + semántica), FAQs                                                                        |
| `src/lib/contract-chat/evidence-pack.ts`                    | detectQueryIntent, detectUserFacts, detectMissingFacts, buildEvidencePack, buildAnswerPlan, buildPlannedAnswerText         |
| `src/lib/contract-chat/llm.ts`                              | Groq API keys, round-robin, buildPromptMessages, generateGroqAnswer, createGroqStream, SYSTEM_PROMPT                       |
| `src/lib/contract-chat/__tests__/query-processing.test.ts`  | Tests de normalización, expansiones, detección conversacional                                                              |
| `src/lib/contract-chat/__tests__/evidence.test.ts`          | Tests de expansion, reranking, thematic compatibility                                                                      |
| `src/lib/contract-chat/__tests__/contextualization.test.ts` | Tests de follow-ups, standalone query                                                                                      |
| `src/lib/contract-chat/__tests__/search.test.ts`            | Tests de scoring, penalizaciones                                                                                           |
| `src/lib/contract-chat/__tests__/chunking.test.ts`          | Tests de chunking, metadatos                                                                                               |

### Archivos modificados

| Archivo                                                 | Cambio                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `src/lib/contract-chat/index.ts`                        | Reducir a orquestación (~300 líneas), importar módulos        |
| `src/lib/contract-chat/types.ts`                        | Sin cambios (ya está limpio)                                  |
| `src/lib/contract-chat/index.test.ts`                   | Se mantiene como integration test, sin cambios                |
| `src/lib/firebase/chat-cache.ts`                        | Agregar campo `comment`, `sessionId`, `sources[]` al feedback |
| `src/app/api/admin/lab/chat-contrato/feedback/route.ts` | Aceptar `comment`, `sources` en el body                       |
| `src/app/api/admin/lab/chat-contrato/stream/route.ts`   | Logs estructurados, rate limit por usuario                    |
| `src/app/(main)/admin/lab/chat-contrato/page.tsx`       | Indicadores de estado, campo comentario en feedback, UX chips |

### Archivos eliminados

| Archivo                                                      | Razón                                    |
| ------------------------------------------------------------ | ---------------------------------------- |
| `src/app/api/admin/lab/chat-contrato/sessions/route.ts`      | Código muerto (da 500)                   |
| `src/app/api/admin/lab/chat-contrato/sessions/[id]/route.ts` | Código muerto                            |
| `src/lib/firebase/chat-sessions.ts`                          | Ya no se usa sin el endpoint de sessions |

---

## Task 1: Extraer `constants.ts`

**Files:**

- Create: `src/lib/contract-chat/constants.ts`
- Modify: `src/lib/contract-chat/index.ts`

- [ ] **Step 1: Crear `constants.ts` con todas las constantes compartidas**

```ts
// src/lib/contract-chat/constants.ts
import path from "path";

// --- Paths ---
export const CONTRACT_FILENAME = "contrato-colectivo-de-trabajo-2025-2027.pdf";
export const CONTRACT_PATH = path.join(
  process.cwd(),
  "artifacts",
  CONTRACT_FILENAME,
);
export const LOCAL_PYTHON_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "pdf",
  "extractors",
  "venv",
  "bin",
  "python3",
);
export const CONTRACT_INDEX_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "contract-index-data.json",
);
export const PRESTACIONES_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "prestaciones-data.json",
);
export const FAQ_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "contract-faqs.json",
);
export const TABULADOR_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "tabulador-sueldos.json",
);
export const PRESTACIONES_EMB_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "prestaciones-embeddings.json",
);

// --- Chunking ---
export const TARGET_CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 120;

// --- LLM ---
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
export const GROQ_MIN_INTERVAL_MS = 4_000;

// --- Embeddings ---
export const JINA_EMBEDDING_MODEL = "jina-embeddings-v3";
export const JINA_BATCH_SIZE = 100;

// --- Search ---
export const SEMANTIC_WEIGHT = 0.8;
export const KEYWORD_WEIGHT = 0.2;

// --- Limits ---
export const MAX_CONVERSATION_HISTORY = 10;
export const MAX_CONTEXTUALIZATION_HISTORY = 6;
export const MAX_RETRIEVAL_TRACES = 50;
export const MAX_EVIDENCE_SOURCES = 8;
export const MAX_SELECTED_SOURCES = 12;
export const EVIDENCE_EXPANSION_ANCHORS = 5;
export const EVIDENCE_EXPANSION_RADIUS = 1;

// --- Prestaciones semantic ---
export const PRESTACION_SEMANTIC_THRESHOLD = 0.38;
export const PRESTACION_SEMANTIC_GAP = 0.06;
```

- [ ] **Step 2: Reemplazar constantes en `index.ts` con imports de `constants.ts`**

En `index.ts`, eliminar todas las declaraciones de constantes listadas arriba (líneas 25-78, 81-82, y las constantes de prestaciones en ~2008-2011) y reemplazar con:

```ts
import {
  CONTRACT_FILENAME,
  CONTRACT_PATH,
  LOCAL_PYTHON_PATH,
  CONTRACT_INDEX_PATH,
  PRESTACIONES_PATH,
  FAQ_PATH,
  TABULADOR_PATH,
  PRESTACIONES_EMB_PATH,
  TARGET_CHUNK_SIZE,
  CHUNK_OVERLAP,
  DEFAULT_GROQ_MODEL,
  GROQ_MIN_INTERVAL_MS,
  JINA_EMBEDDING_MODEL,
  JINA_BATCH_SIZE,
  SEMANTIC_WEIGHT,
  KEYWORD_WEIGHT,
  MAX_CONVERSATION_HISTORY,
  MAX_CONTEXTUALIZATION_HISTORY,
  MAX_RETRIEVAL_TRACES,
  MAX_EVIDENCE_SOURCES,
  MAX_SELECTED_SOURCES,
  EVIDENCE_EXPANSION_ANCHORS,
  EVIDENCE_EXPANSION_RADIUS,
  PRESTACION_SEMANTIC_THRESHOLD,
  PRESTACION_SEMANTIC_GAP,
} from "@/lib/contract-chat/constants";
```

- [ ] **Step 3: Correr tests de integración para verificar que nada se rompió**

Run: `npm test -- --run src/lib/contract-chat/index.test.ts`
Expected: Todos los tests pasan

- [ ] **Step 4: Correr typecheck**

Run: `npm run check`
Expected: Sin errores nuevos

- [ ] **Step 5: Commit**

```bash
git add src/lib/contract-chat/constants.ts src/lib/contract-chat/index.ts
git commit -m "refactor(chat-contrato): extraer constants.ts del monolito"
```

---

## Task 2: Extraer `query-processing.ts`

**Files:**

- Create: `src/lib/contract-chat/query-processing.ts`
- Create: `src/lib/contract-chat/__tests__/query-processing.test.ts`
- Modify: `src/lib/contract-chat/index.ts`

- [ ] **Step 1: Crear `query-processing.ts`**

Mover desde `index.ts`:

- `SPANISH_STOPWORDS` (línea ~161)
- `INDEX_MARKERS` (línea ~232)
- `QUERY_EXPANSIONS` (líneas ~234-315)
- `CONVERSATIONAL_PATTERNS` (líneas ~316-327)
- `normalizeText()` (línea ~340)
- `tokenizeQuery()` (línea ~350)
- `tokenizeNormalizedText()` (línea ~360)
- `countTokens()` (línea ~366)
- `isConversationalPrompt()` (línea ~1162)
- `STRUCTURE_PATTERNS` (línea ~1167)
- `isStructureQuery()` (línea ~1181)
- `buildStructureAnswer()` (línea ~1185) — necesita `CONTRACT_SECTIONS`
- `buildConversationalAnswer()` (línea ~1199)
- `ABBREVIATIONS` (línea ~1667)
- `TYPO_CORRECTIONS` (línea ~1684)
- `rewriteQueryLocal()` (línea ~1710)

El módulo debe importar `CONTRACT_SECTIONS` como parámetro o importarlo de `constants.ts` (mover `CONTRACT_SECTIONS` a `constants.ts` si es necesario).

Exportar todas las funciones como named exports.

- [ ] **Step 2: Escribir tests unitarios**

```ts
// src/lib/contract-chat/__tests__/query-processing.test.ts
import { describe, expect, it } from "vitest";

import {
  normalizeText,
  tokenizeQuery,
  rewriteQueryLocal,
  isConversationalPrompt,
  isStructureQuery,
} from "@/lib/contract-chat/query-processing";

describe("query-processing", () => {
  describe("normalizeText", () => {
    it("quita acentos y pasa a minúsculas", () => {
      expect(normalizeText("Jubilación")).toBe("jubilacion");
    });

    it("quita caracteres especiales", () => {
      expect(normalizeText("¿Cuánto?")).toContain("cuanto");
    });
  });

  describe("rewriteQueryLocal", () => {
    it("expande abreviaciones IMSS", () => {
      const result = rewriteQueryLocal("sueldo de AUO");
      expect(result).toContain("auxiliar universal de oficinas");
    });

    it("corrige typos comunes", () => {
      const result = rewriteQueryLocal("vacasiones");
      expect(result).toContain("vacaciones");
    });
  });

  describe("isConversationalPrompt", () => {
    it("detecta saludos como conversación", () => {
      const normalized = normalizeText("Hola buenos días");
      const tokens = tokenizeQuery("Hola buenos días");
      expect(isConversationalPrompt(normalized, tokens)).toBe(true);
    });

    it("NO clasifica preguntas laborales como conversación", () => {
      const normalized = normalizeText("¿Puedo faltar mañana?");
      const tokens = tokenizeQuery("¿Puedo faltar mañana?");
      expect(isConversationalPrompt(normalized, tokens)).toBe(false);
    });

    it("NO clasifica preguntas de sueldo como conversación", () => {
      const normalized = normalizeText("¿Cuánto gano?");
      const tokens = tokenizeQuery("¿Cuánto gano?");
      expect(isConversationalPrompt(normalized, tokens)).toBe(false);
    });
  });

  describe("isStructureQuery", () => {
    it("detecta preguntas sobre estructura del contrato", () => {
      expect(
        isStructureQuery(normalizeText("¿Qué contiene el contrato?")),
      ).toBe(true);
    });

    it("NO detecta preguntas normales como estructura", () => {
      expect(isStructureQuery(normalizeText("¿Cuántas vacaciones?"))).toBe(
        false,
      );
    });
  });
});
```

- [ ] **Step 3: Correr tests unitarios**

Run: `npm test -- --run src/lib/contract-chat/__tests__/query-processing.test.ts`
Expected: PASS

- [ ] **Step 4: Actualizar imports en `index.ts`**

Reemplazar las funciones movidas con imports:

```ts
import {
  normalizeText,
  tokenizeQuery,
  tokenizeNormalizedText,
  countTokens,
  rewriteQueryLocal,
  isConversationalPrompt,
  isStructureQuery,
  buildStructureAnswer,
  buildConversationalAnswer,
  QUERY_EXPANSIONS,
  SPANISH_STOPWORDS,
  INDEX_MARKERS,
} from "@/lib/contract-chat/query-processing";
```

- [ ] **Step 5: Correr todos los tests**

Run: `npm test -- --run src/lib/contract-chat/`
Expected: Todos pasan (unitarios + integración)

- [ ] **Step 6: Correr typecheck**

Run: `npm run check`
Expected: Sin errores nuevos

- [ ] **Step 7: Commit**

```bash
git add src/lib/contract-chat/query-processing.ts src/lib/contract-chat/__tests__/query-processing.test.ts src/lib/contract-chat/index.ts
git commit -m "refactor(chat-contrato): extraer query-processing.ts con tests unitarios"
```

---

## Task 3: Extraer `chunking.ts`

**Files:**

- Create: `src/lib/contract-chat/chunking.ts`
- Create: `src/lib/contract-chat/__tests__/chunking.test.ts`
- Modify: `src/lib/contract-chat/index.ts`

- [ ] **Step 1: Crear `chunking.ts`**

Mover desde `index.ts`:

- `DocumentSectionDef` interface y `DOCUMENT_SECTIONS` array (líneas ~377-632)
- `getDocumentSectionForPage()` (línea ~623)
- `SIGNATURES_HEURISTICS`, `DEFINITION_HEURISTICS`, `REQUIREMENT_HEURISTICS`, `PROCEDURE_HEURISTICS`, `TABLE_HEURISTICS`, `INDEX_CONTENT_HEURISTICS` (líneas ~635-670)
- `classifyContentType()` (línea ~672)
- `CLAUSE_REGEX`, `ARTICLE_REGEX`, `CHAPTER_REGEX` (líneas ~694-696)
- `ExtractedPage` interface y `RawSection` interface (líneas ~331-709)
- `splitPagesIntoSections()` (línea ~711)
- `TABULAR_PATTERNS`, `isTabularContent()` (líneas ~800-810)
- `buildChunkId()` (línea ~812)
- `splitSectionIntoChunks()` (línea ~822)

Importar `normalizeText` de `query-processing.ts`, constantes de `constants.ts`, tipos de `types.ts`.

- [ ] **Step 2: Escribir tests unitarios**

```ts
// src/lib/contract-chat/__tests__/chunking.test.ts
import { describe, expect, it } from "vitest";

import {
  classifyContentType,
  getDocumentSectionForPage,
} from "@/lib/contract-chat/chunking";

describe("chunking", () => {
  describe("getDocumentSectionForPage", () => {
    it("página 10 es contrato", () => {
      const section = getDocumentSectionForPage(10);
      expect(section?.documentType).toBe("contrato");
    });

    it("página 1 es indice", () => {
      const section = getDocumentSectionForPage(1);
      expect(section?.documentType).toBe("indice");
    });

    it("página 95 es tabulador", () => {
      const section = getDocumentSectionForPage(95);
      expect(section?.documentType).toBe("tabulador");
    });
  });

  describe("classifyContentType", () => {
    it("detecta firmas", () => {
      expect(
        classifyContentType("POR EL INSTITUTO firma representante", 80),
      ).toBe("signatures");
    });

    it("detecta tablas", () => {
      expect(
        classifyContentType("tabulador de sueldos base hora-mes categoría", 90),
      ).toBe("table");
    });

    it("texto normativo por defecto", () => {
      expect(
        classifyContentType(
          "Los trabajadores tendrán derecho a vacaciones",
          20,
        ),
      ).toBe("normative");
    });
  });
});
```

- [ ] **Step 3: Correr tests y verificar**

Run: `npm test -- --run src/lib/contract-chat/__tests__/chunking.test.ts`
Expected: PASS

- [ ] **Step 4: Actualizar imports en `index.ts`**

- [ ] **Step 5: Correr todos los tests + typecheck**

Run: `npm test -- --run src/lib/contract-chat/ && npm run check`
Expected: Todo pasa

- [ ] **Step 6: Commit**

```bash
git add src/lib/contract-chat/chunking.ts src/lib/contract-chat/__tests__/chunking.test.ts src/lib/contract-chat/index.ts
git commit -m "refactor(chat-contrato): extraer chunking.ts con tests unitarios"
```

---

## Task 4: Extraer `embeddings.ts`

**Files:**

- Create: `src/lib/contract-chat/embeddings.ts`
- Modify: `src/lib/contract-chat/index.ts`

- [ ] **Step 1: Crear `embeddings.ts`**

Mover desde `index.ts`:

- `getJinaApiKey()` (línea ~897)
- `jinaEmbed()` (línea ~905)
- `generateEmbeddings()` (línea ~934)
- `generateQueryEmbedding()` (línea ~960)
- `cosineSimilarity()` (línea ~968)

Importar `JINA_EMBEDDING_MODEL`, `JINA_BATCH_SIZE` de `constants.ts`.

- [ ] **Step 2: Actualizar imports en `index.ts`**

```ts
import {
  cosineSimilarity,
  generateEmbeddings,
  generateQueryEmbedding,
} from "@/lib/contract-chat/embeddings";
```

- [ ] **Step 3: Correr tests + typecheck**

Run: `npm test -- --run src/lib/contract-chat/ && npm run check`
Expected: Todo pasa

- [ ] **Step 4: Commit**

```bash
git add src/lib/contract-chat/embeddings.ts src/lib/contract-chat/index.ts
git commit -m "refactor(chat-contrato): extraer embeddings.ts"
```

---

## Task 5: Extraer `search.ts`

**Files:**

- Create: `src/lib/contract-chat/search.ts`
- Create: `src/lib/contract-chat/__tests__/search.test.ts`
- Modify: `src/lib/contract-chat/index.ts`

- [ ] **Step 1: Crear `search.ts`**

Mover desde `index.ts`:

- `createExcerpt()` (línea ~986)
- `scoreChunkKeywords()` (línea ~1019)
- `hybridSearch()` (línea ~1079)

Importar de otros módulos: `normalizeText`, `tokenizeQuery`, `tokenizeNormalizedText`, `countTokens`, `QUERY_EXPANSIONS` de `query-processing.ts`; `cosineSimilarity`, `generateQueryEmbedding` de `embeddings.ts`; constantes de `constants.ts`; tipos de `types.ts`.

- [ ] **Step 2: Escribir tests unitarios**

```ts
// src/lib/contract-chat/__tests__/search.test.ts
import { describe, expect, it } from "vitest";

import { createExcerpt } from "@/lib/contract-chat/search";

describe("search", () => {
  describe("createExcerpt", () => {
    it("genera excerpt con tokens resaltados", () => {
      const text =
        "Los trabajadores tendrán derecho a 20 días de vacaciones por año de servicio";
      const excerpt = createExcerpt(text, ["vacaciones", "dias"]);
      expect(excerpt.length).toBeGreaterThan(0);
      expect(excerpt.length).toBeLessThanOrEqual(300);
    });

    it("retorna inicio del texto si no hay match", () => {
      const text =
        "Este es un texto largo sin los términos buscados en ninguna parte visible";
      const excerpt = createExcerpt(text, ["inexistente"]);
      expect(excerpt.length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 3: Correr tests + typecheck**

Run: `npm test -- --run src/lib/contract-chat/ && npm run check`
Expected: Todo pasa

- [ ] **Step 4: Commit**

```bash
git add src/lib/contract-chat/search.ts src/lib/contract-chat/__tests__/search.test.ts src/lib/contract-chat/index.ts
git commit -m "refactor(chat-contrato): extraer search.ts con tests unitarios"
```

---

## Task 6: Extraer `contextualization.ts`

**Files:**

- Create: `src/lib/contract-chat/contextualization.ts`
- Create: `src/lib/contract-chat/__tests__/contextualization.test.ts`
- Modify: `src/lib/contract-chat/index.ts`

- [ ] **Step 1: Crear `contextualization.ts`**

Mover desde `index.ts`:

- `sanitizeConversationHistory()` (línea ~1269)
- `fallbackContextualQuery()` (línea ~1297)
- `buildLocalContextualQuery()` (línea ~1309)
- `generateStandaloneQuery()` (línea ~1363)
- `contextualizeQuery()` (línea ~1435)
- `reinforceContextualTopic()` (línea ~1463)

Importar `normalizeText` de `query-processing.ts`, constantes de `constants.ts`, tipos de `types.ts`.

- [ ] **Step 2: Escribir tests unitarios**

```ts
// src/lib/contract-chat/__tests__/contextualization.test.ts
import { describe, expect, it } from "vitest";

import {
  buildLocalContextualQuery,
  sanitizeConversationHistory,
} from "@/lib/contract-chat/contextualization";

describe("contextualization", () => {
  describe("sanitizeConversationHistory", () => {
    it("elimina último mensaje si es igual al query actual", () => {
      const history = [
        { role: "user" as const, content: "¿Qué son las becas?" },
        { role: "assistant" as const, content: "Las becas son..." },
        { role: "user" as const, content: "requisitos" },
      ];
      const cleaned = sanitizeConversationHistory("requisitos", history);
      expect(cleaned.at(-1)?.content).not.toBe("requisitos");
    });

    it("trunca contenido largo a 1200 chars", () => {
      const history = [{ role: "user" as const, content: "a".repeat(2000) }];
      const cleaned = sanitizeConversationHistory("nueva pregunta", history);
      expect(cleaned[0].content.length).toBeLessThanOrEqual(1200);
    });
  });

  describe("buildLocalContextualQuery", () => {
    it("detecta tema activo de becas en historial", () => {
      const history = [
        { role: "user" as const, content: "¿Qué becas hay?" },
        {
          role: "assistant" as const,
          content: "Hay becas íntegras y parciales.",
        },
      ];
      const result = buildLocalContextualQuery("¿Y los requisitos?", history);
      expect(result).not.toBeNull();
      expect(result).toContain("beca");
    });

    it("retorna null sin historial", () => {
      expect(buildLocalContextualQuery("hola", [])).toBeNull();
    });
  });
});
```

- [ ] **Step 3: Correr tests + typecheck**

Run: `npm test -- --run src/lib/contract-chat/ && npm run check`
Expected: Todo pasa

- [ ] **Step 4: Commit**

```bash
git add src/lib/contract-chat/contextualization.ts src/lib/contract-chat/__tests__/contextualization.test.ts src/lib/contract-chat/index.ts
git commit -m "refactor(chat-contrato): extraer contextualization.ts con tests unitarios"
```

---

## Task 7: Extraer `evidence.ts`

**Files:**

- Create: `src/lib/contract-chat/evidence.ts`
- Create: `src/lib/contract-chat/__tests__/evidence.test.ts`
- Modify: `src/lib/contract-chat/index.ts`

- [ ] **Step 1: Crear `evidence.ts`**

Mover desde `index.ts`:

- `toTraceItem()` (línea ~2191)
- `checkThematicCompatibility()` (línea ~2210)
- `buildRetrievalTrace()` (línea ~2267)
- `recordRetrievalTrace()` (línea ~2328)
- `getRecentContractRetrievalTraces()` (línea ~2339)
- `recentRetrievalTraces` array (línea ~329)
- `expandEvidenceSources()` (línea ~2343)
- `rerankEvidenceByQuestionIntent()` (línea ~2390)
- `getChunkOrder()` (línea ~2481)
- `orderSourcesForPrompt()` (línea ~2486)

- [ ] **Step 2: Escribir tests unitarios**

```ts
// src/lib/contract-chat/__tests__/evidence.test.ts
import { describe, expect, it } from "vitest";

import { checkThematicCompatibility } from "@/lib/contract-chat/evidence";
import type { ContractSearchResult } from "@/lib/contract-chat/types";

describe("evidence", () => {
  describe("checkThematicCompatibility", () => {
    it("marca incompatible cuando no hay overlap temático", () => {
      const sources: ContractSearchResult[] = [
        {
          chunk: {
            id: "test-1",
            pageNumber: 50,
            text: "vacaciones y días de descanso",
            normalizedText: "vacaciones y dias de descanso",
            tokenCounts: {},
          },
          score: 0.3,
          semanticScore: 0.3,
          keywordScore: 0.1,
          matchedTerms: ["vacaciones"],
          excerpt: "vacaciones...",
        },
      ];
      const result = checkThematicCompatibility(
        "¿Cómo saco mi constancia del SAT?",
        sources,
      );
      expect(result.compatible).toBe(false);
    });

    it("marca compatible cuando hay overlap", () => {
      const sources: ContractSearchResult[] = [
        {
          chunk: {
            id: "test-2",
            pageNumber: 30,
            text: "Los permisos económicos se otorgan",
            normalizedText: "los permisos economicos se otorgan",
            tokenCounts: {},
          },
          score: 0.7,
          semanticScore: 0.7,
          keywordScore: 0.5,
          matchedTerms: ["permisos", "economicos"],
          excerpt: "permisos...",
        },
      ];
      const result = checkThematicCompatibility(
        "¿Cuántos permisos económicos?",
        sources,
      );
      expect(result.compatible).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Correr tests + typecheck**

Run: `npm test -- --run src/lib/contract-chat/ && npm run check`
Expected: Todo pasa

- [ ] **Step 4: Commit**

```bash
git add src/lib/contract-chat/evidence.ts src/lib/contract-chat/__tests__/evidence.test.ts src/lib/contract-chat/index.ts
git commit -m "refactor(chat-contrato): extraer evidence.ts con tests unitarios"
```

---

## Task 8: Extraer `structured-data.ts`

**Files:**

- Create: `src/lib/contract-chat/structured-data.ts`
- Modify: `src/lib/contract-chat/index.ts`

- [ ] **Step 1: Crear `structured-data.ts`**

Mover desde `index.ts`:

- Todo el bloque de tabulador: `TabuladorEntry`, `TabuladorData`, `loadTabulador()`, `SALARY_PATTERNS`, `isSalaryQuery()`, `buildTabuladorContext()` (líneas ~1732-1856)
- Todo el bloque de prestaciones: `PrestacionEntry`, `loadPrestaciones()`, `PRESTACION_SINONIMOS`, `PRESTACION_STOPWORDS`, `prestacionKeywords()`, `PRESTACIONES_GENERAL_PATTERNS`, `isGeneralPrestacionesQuery()`, `matchPrestaciones()`, `formatMontos()`, `PrestacionEmbeddingEntry`, `loadPrestacionesEmbeddings()`, `matchPrestacionesSemantic()`, `buildPrestacionesContext()` (líneas ~1862-2094)
- Todo el bloque de FAQs: `FaqIndex`, `loadFaqIndex()`, `faqSemanticSearch()` (líneas ~2098-2188)

- [ ] **Step 2: Actualizar imports en `index.ts`**

```ts
import {
  buildTabuladorContext,
  buildPrestacionesContext,
  faqSemanticSearch,
} from "@/lib/contract-chat/structured-data";
```

- [ ] **Step 3: Correr tests + typecheck**

Run: `npm test -- --run src/lib/contract-chat/ && npm run check`
Expected: Todo pasa

- [ ] **Step 4: Commit**

```bash
git add src/lib/contract-chat/structured-data.ts src/lib/contract-chat/index.ts
git commit -m "refactor(chat-contrato): extraer structured-data.ts"
```

---

## Task 9: Extraer `evidence-pack.ts`

**Files:**

- Create: `src/lib/contract-chat/evidence-pack.ts`
- Modify: `src/lib/contract-chat/index.ts`

- [ ] **Step 1: Crear `evidence-pack.ts`**

Mover desde `index.ts`:

- `detectQueryIntent()` (línea ~2975)
- `detectUserFacts()` (línea ~3000)
- `detectMissingFacts()` (línea ~3026)
- `buildEvidencePack()` (línea ~3046)
- `buildAnswerPlan()` (línea ~3119)
- `buildAnswerText()` (línea ~3195)
- `buildPlannedAnswerText()` (línea ~3227)

- [ ] **Step 2: Actualizar imports en `index.ts`**

- [ ] **Step 3: Correr tests + typecheck**

Run: `npm test -- --run src/lib/contract-chat/ && npm run check`
Expected: Todo pasa

- [ ] **Step 4: Commit**

```bash
git add src/lib/contract-chat/evidence-pack.ts src/lib/contract-chat/index.ts
git commit -m "refactor(chat-contrato): extraer evidence-pack.ts"
```

---

## Task 10: Extraer `llm.ts`

**Files:**

- Create: `src/lib/contract-chat/llm.ts`
- Modify: `src/lib/contract-chat/index.ts`

- [ ] **Step 1: Crear `llm.ts`**

Mover desde `index.ts`:

- `readLocalEnvValue()` (línea ~1219)
- `getGroqApiKeys()` (línea ~1231)
- `getGroqApiKey()` (línea ~1253)
- `getGroqModel()` (línea ~1257)
- `SYSTEM_PROMPT` (dentro de `buildGroqMessages`, línea ~1575)
- `buildGroqMessages()` (línea ~1575) — renombrar a `buildPromptMessages()`
- `generateGroqAnswer()` (línea ~1524)
- `lastGroqCallMs`, `nextKeyIndex`, `GROQ_MIN_INTERVAL_MS` (líneas ~2714-2718)
- `enqueueExtractiveFallback()` (línea ~2722)
- `createGroqStream()` (línea ~2741) — esta función se re-exporta desde `index.ts`

- [ ] **Step 2: Actualizar imports en `index.ts`**

```ts
import {
  getGroqApiKey,
  getGroqModel,
  generateGroqAnswer,
  createGroqStream,
  getGroqApiKeys,
} from "@/lib/contract-chat/llm";
```

- [ ] **Step 3: Correr tests + typecheck**

Run: `npm test -- --run src/lib/contract-chat/ && npm run check`
Expected: Todo pasa

- [ ] **Step 4: Commit**

```bash
git add src/lib/contract-chat/llm.ts src/lib/contract-chat/index.ts
git commit -m "refactor(chat-contrato): extraer llm.ts"
```

---

## Task 11: Limpiar `index.ts` — solo orquestación

**Files:**

- Modify: `src/lib/contract-chat/index.ts`

- [ ] **Step 1: Verificar que `index.ts` solo contiene orquestación**

Después de Tasks 1-10, `index.ts` debería tener solo:

- Imports de todos los módulos
- `extractPageHints()` (línea ~3281) — mover a `chunking.ts` si no se movió
- `getPythonExecutable()` (línea ~3292) — mover a `chunking.ts`
- `extractPagesFromPdf()` (línea ~3296) — mover a `chunking.ts`
- `buildContractIndex()` (línea ~3357) — mover a `chunking.ts` o dejar aquí como orquestación
- `saveContractIndex()` / `loadPersistedContractIndex()` — dejar aquí (persistence)
- `getContractChatStatus()` — dejar (public API)
- `getContractIndex()` / `rebuildContractIndex()` — dejar (public API)
- `searchContractSources()` — dejar (public API, orquesta módulos)
- `answerContractQuestion()` — dejar (public API, orquesta módulos)
- Re-export de `createGroqStream` desde `llm.ts`

- [ ] **Step 2: Contar líneas**

Run: `wc -l src/lib/contract-chat/index.ts`
Expected: < 500 líneas (idealmente ~300-400)

- [ ] **Step 3: Correr TODOS los tests**

Run: `npm test -- --run src/lib/contract-chat/`
Expected: Todos pasan (unitarios + integración)

- [ ] **Step 4: Correr typecheck + lint**

Run: `npm run check`
Expected: Sin errores nuevos

- [ ] **Step 5: Commit**

```bash
git add src/lib/contract-chat/
git commit -m "refactor(chat-contrato): index.ts reducido a orquestación (~300 líneas)"
```

---

## Task 12: Resolver fallos de retrieval — detección conversacional

**Files:**

- Modify: `src/lib/contract-chat/query-processing.ts`
- Modify: `src/lib/contract-chat/__tests__/query-processing.test.ts`

- [ ] **Step 1: Agregar test que falla**

```ts
// En query-processing.test.ts, agregar:
it("preguntas con verbos laborales NUNCA son conversacionales", () => {
  const cases = [
    "¿Puedo faltar?",
    "¿Me pueden despedir?",
    "¿Cuánto gano?",
    "quiero jubilarme",
    "necesito una beca",
    "mis vacaciones",
    "permiso económico",
  ];
  for (const q of cases) {
    const normalized = normalizeText(q);
    const tokens = tokenizeQuery(q);
    expect(
      isConversationalPrompt(normalized, tokens),
      `"${q}" fue clasificado como conversacional`,
    ).toBe(false);
  }
});
```

- [ ] **Step 2: Correr test para verificar que falla**

Run: `npm test -- --run src/lib/contract-chat/__tests__/query-processing.test.ts`
Expected: FAIL en al menos "¿Puedo faltar?" y "¿Cuánto gano?"

- [ ] **Step 3: Implementar fix en `isConversationalPrompt`**

```ts
// En query-processing.ts, agregar lista de verbos/sustantivos laborales:
const LABOR_KEYWORDS =
  /\b(faltar|falta|faltas|permiso|permisos|licencia|gano|gana|pagan|cobro|sueldo|salario|jubil|pension|retiro|beca|becas|vacacion|vacaciones|despido|despedir|incapacidad|guarderia|escalafon|contrato|clausula|articulo|prestacion|aguinaldo|prima|turno|adscripcion|antiguedad)\b/;

export function isConversationalPrompt(
  normalizedQuery: string,
  tokens: string[],
) {
  if (tokens.length === 0) return true;
  // Si tiene keywords laborales, NUNCA es conversacional
  if (LABOR_KEYWORDS.test(normalizedQuery)) return false;
  return CONVERSATIONAL_PATTERNS.some((p) => p.test(normalizedQuery));
}
```

- [ ] **Step 4: Correr test para verificar que pasa**

Run: `npm test -- --run src/lib/contract-chat/__tests__/query-processing.test.ts`
Expected: PASS

- [ ] **Step 5: Correr integration tests**

Run: `npm test -- --run src/lib/contract-chat/index.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/contract-chat/query-processing.ts src/lib/contract-chat/__tests__/query-processing.test.ts
git commit -m "fix(chat-contrato): preguntas con verbos laborales nunca son conversacionales"
```

---

## Task 13: Resolver fallos de retrieval — sufficiency y artículos

**Files:**

- Modify: `src/lib/contract-chat/evidence.ts`
- Modify: `src/lib/contract-chat/__tests__/evidence.test.ts`
- Modify: `src/lib/contract-chat/search.ts` (lookup directo artículo+sección)

- [ ] **Step 1: Agregar test para sufficiency falsa del SAT**

```ts
// En evidence.test.ts, agregar:
it("marca insufficient cuando query no tiene relación temática con sources", () => {
  const sources: ContractSearchResult[] = [
    {
      chunk: {
        id: "noise-1",
        pageNumber: 100,
        text: "El tabulador establece categorías y sueldos base",
        normalizedText: "el tabulador establece categorias y sueldos base",
        tokenCounts: {},
      },
      score: 0.25,
      semanticScore: 0.2,
      keywordScore: 0.1,
      matchedTerms: [],
      excerpt: "tabulador...",
    },
  ];
  const result = checkThematicCompatibility(
    "¿Cómo saco mi constancia de situación fiscal del SAT?",
    sources,
  );
  expect(result.compatible).toBe(false);
});
```

- [ ] **Step 2: Correr test para verificar que falla**

Run: `npm test -- --run src/lib/contract-chat/__tests__/evidence.test.ts`
Expected: FAIL si actualmente marca compatible

- [ ] **Step 3: Ajustar `checkThematicCompatibility`**

Reforzar: si el top score es < 0.35 Y ningún `matchedTerms` tiene overlap con los tokens significativos de la query, marcar `compatible: false`.

- [ ] **Step 4: Correr tests**

Run: `npm test -- --run src/lib/contract-chat/`
Expected: Todo pasa

- [ ] **Step 5: Commit**

```bash
git add src/lib/contract-chat/evidence.ts src/lib/contract-chat/__tests__/evidence.test.ts
git commit -m "fix(chat-contrato): sufficiency más estricta para queries sin relación temática"
```

---

## Task 14: Regenerar índice y correr benchmark de retrieval

**Files:**

- Modify: `scripts/tests/evaluate-contract-chat.ts` (si hay ajustes)

- [ ] **Step 1: Regenerar índice**

Run: `npx tsx scripts/ops/reindex-contract-v2.ts`
Expected: Índice regenerado con chunks completos

- [ ] **Step 2: Validar índice**

Run: `npx tsx scripts/ops/validate-contract-index.ts`
Expected: Sin errores de integridad

- [ ] **Step 3: Correr benchmark de retrieval**

Run: `npx tsx scripts/tests/evaluate-contract-chat.ts`
Expected: >= 95% (38/40 mínimo)

- [ ] **Step 4: Si hay fallos, iterar sobre los fixes**

Analizar cada fallo, ajustar el módulo correspondiente, re-correr benchmark.

- [ ] **Step 5: Commit índice actualizado si cambió**

```bash
git add src/lib/contract-chat/contract-index-data.json
git commit -m "chore(chat-contrato): regenerar índice con chunks completos"
```

---

## Task 15: Anti-alucinación — post-procesador de citas

**Files:**

- Create: `src/lib/contract-chat/citation-validator.ts`
- Modify: `src/lib/contract-chat/llm.ts`

- [ ] **Step 1: Crear `citation-validator.ts`**

```ts
// src/lib/contract-chat/citation-validator.ts
import type { ContractSearchResult } from "@/lib/contract-chat/types";

interface CitationValidation {
  cleanedText: string;
  removedCitations: string[];
  validCitations: string[];
}

/**
 * Extrae citas del texto generado por el LLM y las cruza contra las fuentes reales.
 * Elimina o marca citas que no están respaldadas por las fuentes del retrieval.
 */
export function validateCitations(
  generatedText: string,
  sources: ContractSearchResult[],
): CitationValidation {
  const validPages = new Set(sources.map((s) => s.chunk.pageNumber));
  const validClauses = new Set(
    sources
      .filter((s) => s.chunk.clauseNumber)
      .map((s) => s.chunk.clauseNumber!),
  );
  const validArticles = new Set(
    sources
      .filter((s) => s.chunk.articleNumber)
      .map((s) => s.chunk.articleNumber!),
  );

  const removedCitations: string[] = [];
  const validCitations: string[] = [];

  let cleaned = generatedText;

  // Validar citas de cláusulas: "Cláusula 24", "cláusula 24"
  cleaned = cleaned.replace(/[Cc]l[aá]usula\s+(\d+)/g, (match, num) => {
    const n = parseInt(num, 10);
    if (validClauses.has(n)) {
      validCitations.push(match);
      return match;
    }
    removedCitations.push(match);
    return ""; // Eliminar cita falsa
  });

  // Validar citas de artículos: "Artículo 20", "artículo 20"
  cleaned = cleaned.replace(/[Aa]rt[ií]culo\s+(\d+)/g, (match, num) => {
    const n = parseInt(num, 10);
    if (validArticles.has(n)) {
      validCitations.push(match);
      return match;
    }
    removedCitations.push(match);
    return "";
  });

  // Validar citas de páginas: "p. 281", "página 281", "p.281"
  cleaned = cleaned.replace(
    /(?:p[aá]gina|p\.?\s*)(\d{1,3})/gi,
    (match, num) => {
      const n = parseInt(num, 10);
      if (validPages.has(n)) {
        validCitations.push(match);
        return match;
      }
      removedCitations.push(match);
      return "";
    },
  );

  // Limpiar espacios dobles y comas huérfanas
  cleaned = cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();

  return { cleanedText: cleaned, removedCitations, validCitations };
}
```

- [ ] **Step 2: Integrar en el flujo de generación**

En `llm.ts`, después de recibir la respuesta de Groq en `generateGroqAnswer()`, pasar por `validateCitations()` antes de retornar. Si `removedCitations.length > 0`, loggear warning.

- [ ] **Step 3: Reforzar prompt**

En `buildPromptMessages()` dentro de `llm.ts`, agregar al system prompt:

```
REGLA ABSOLUTA: SOLO puedes citar cláusulas, artículos y páginas que aparezcan TEXTUALMENTE en el contexto proporcionado. Si no encuentras el dato en las fuentes, NO inventes una referencia — di "según el contrato" sin número específico.
```

- [ ] **Step 4: Correr tests**

Run: `npm test -- --run src/lib/contract-chat/`
Expected: Todo pasa

- [ ] **Step 5: Commit**

```bash
git add src/lib/contract-chat/citation-validator.ts src/lib/contract-chat/llm.ts
git commit -m "feat(chat-contrato): post-procesador de citas anti-alucinación"
```

---

## Task 16: Correr y validar benchmark de respuestas

**Files:**

- Modify: `scripts/tests/evaluate-contract-responses.ts` (ajustes si es necesario)

- [ ] **Step 1: Correr benchmark de respuestas**

Run: `npx tsx scripts/tests/evaluate-contract-responses.ts`
Expected: Resultados con scores en 8 dimensiones

- [ ] **Step 2: Analizar resultados**

Revisar cada caso que falle en alguna dimensión. Priorizar:

1. `noHallucination` < 1.0 → fix urgente
2. `citationAccuracy` < 0.8 → ajustar prompt/validador
3. `completeness` < 0.7 → mejorar retrieval o prompt

- [ ] **Step 3: Iterar fixes basados en resultados**

Aplicar fixes en los módulos correspondientes y re-correr benchmark.

- [ ] **Step 4: Verificar meta: 80%+ promedio**

- [ ] **Step 5: Commit ajustes**

```bash
git add -A
git commit -m "feat(chat-contrato): benchmark de respuestas pasando 80%+ promedio"
```

---

## Task 17: Feedback mejorado — Firestore + API

**Files:**

- Modify: `src/lib/firebase/chat-cache.ts`
- Modify: `src/app/api/admin/lab/chat-contrato/feedback/route.ts`

- [ ] **Step 1: Agregar campos a `submitFeedback`**

En `src/lib/firebase/chat-cache.ts`, modificar `submitFeedback`:

```ts
export async function submitFeedback(
  userId: string,
  query: string,
  answer: string,
  rating: 1 | -1,
  comment?: string,
  sources?: Array<{
    pageNumber: number;
    clauseNumber?: number;
    excerpt?: string;
  }>,
) {
  const normalized = normalizeQueryForCache(query);

  await adminDb.collection(FEEDBACK_COLLECTION).add({
    userId,
    query,
    normalizedQuery: normalized,
    answer: answer.slice(0, 500),
    rating,
    comment: comment?.slice(0, 500) || null,
    sources: sources?.slice(0, 10) || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update cache feedbackScore if exists
  const cacheSnapshot = await adminDb
    .collection(CACHE_COLLECTION)
    .where("normalizedQuery", "==", normalized)
    .limit(1)
    .get();

  if (!cacheSnapshot.empty) {
    await cacheSnapshot.docs[0].ref.update({
      feedbackScore: admin.firestore.FieldValue.increment(rating),
    });
  }
}
```

- [ ] **Step 2: Actualizar API route para aceptar nuevos campos**

En `src/app/api/admin/lab/chat-contrato/feedback/route.ts`, agregar `comment` y `sources` al body:

```ts
const body = (await request.json()) as {
  query?: string;
  answer?: string;
  rating?: number;
  comment?: string;
  sources?: Array<{
    pageNumber: number;
    clauseNumber?: number;
    excerpt?: string;
  }>;
};

// ... validación existente ...

const rating = body.rating === 1 ? 1 : -1;
await submitFeedback(
  ctx.uid,
  body.query,
  body.answer,
  rating,
  body.comment,
  body.sources,
);
```

- [ ] **Step 3: Correr typecheck**

Run: `npm run check`
Expected: Sin errores

- [ ] **Step 4: Commit**

```bash
git add src/lib/firebase/chat-cache.ts src/app/api/admin/lab/chat-contrato/feedback/route.ts
git commit -m "feat(chat-contrato): feedback con comment y sources en Firestore"
```

---

## Task 18: Logs estructurados en el endpoint de stream

**Files:**

- Modify: `src/app/api/admin/lab/chat-contrato/stream/route.ts`

- [ ] **Step 1: Agregar timing y logs estructurados**

Al inicio del POST handler, agregar:

```ts
const startMs = Date.now();
```

Después de `searchContractSources`, agregar:

```ts
const retrievalMs = Date.now() - startMs;
```

Al final, antes de retornar la respuesta, agregar log:

```ts
const totalMs = Date.now() - startMs;
console.log(
  JSON.stringify({
    event: "chat-contrato-query",
    query: query.slice(0, 100),
    totalMs,
    retrievalMs,
    llmMs: totalMs - retrievalMs,
    sourceCount: sources.length,
    isConversational,
    hasStructureAnswer: Boolean(structureAnswer),
    hasTabulador: Boolean(tabuladorContext),
    userId: ctx?.uid?.slice(0, 8),
  }),
);
```

- [ ] **Step 2: Correr typecheck**

Run: `npm run check`
Expected: Sin errores

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/lab/chat-contrato/stream/route.ts
git commit -m "feat(chat-contrato): logs estructurados por request en stream endpoint"
```

---

## Task 19: Eliminar código muerto de sessions

**Files:**

- Delete: `src/app/api/admin/lab/chat-contrato/sessions/route.ts`
- Delete: `src/app/api/admin/lab/chat-contrato/sessions/[id]/route.ts`
- Delete: `src/lib/firebase/chat-sessions.ts`
- Modify: `src/app/(main)/admin/lab/chat-contrato/page.tsx` (quitar referencias a sessions)

- [ ] **Step 1: Verificar que nada más importa chat-sessions**

Run: `grep -r "chat-sessions" src/ --include="*.ts" --include="*.tsx" -l`
Expected: Solo los archivos que vamos a eliminar

- [ ] **Step 2: Verificar que el frontend no llama al endpoint de sessions**

Run: `grep -r "sessions" src/app/\(main\)/admin/lab/chat-contrato/page.tsx`
Si hay llamadas fetch a `/sessions`, eliminarlas junto con el estado relacionado (`SessionSummary`, etc.)

- [ ] **Step 3: Eliminar archivos**

```bash
rm src/app/api/admin/lab/chat-contrato/sessions/route.ts
rm src/app/api/admin/lab/chat-contrato/sessions/\[id\]/route.ts
rm -r src/app/api/admin/lab/chat-contrato/sessions/
rm src/lib/firebase/chat-sessions.ts
```

- [ ] **Step 4: Limpiar imports y referencias en page.tsx**

Eliminar `SessionSummary` interface si ya no se usa, y cualquier estado/efecto relacionado con sessions.

- [ ] **Step 5: Correr typecheck**

Run: `npm run check`
Expected: Sin errores

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(chat-contrato): eliminar código muerto de sessions"
```

---

## Task 20: Cache normalizado con TTL

**Files:**

- Modify: `src/lib/firebase/chat-cache.ts`

- [ ] **Step 1: Mejorar normalización pre-cache**

La función `normalizeQueryForCache` ya existe. Verificar que quita acentos, lowercase, y trim. Si no, mejorar:

```ts
export function normalizeQueryForCache(query: string): string {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 2: Agregar TTL de 7 días**

En `getCachedAnswer`, agregar check de TTL:

```ts
const doc = cacheSnapshot.docs[0];
const data = doc.data();
const createdAt = data.createdAt?.toDate?.();
if (createdAt) {
  const ageMs = Date.now() - createdAt.getTime();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  if (ageMs > SEVEN_DAYS_MS) {
    // Cache expired — delete and return null
    await doc.ref.delete();
    return null;
  }
}
```

- [ ] **Step 3: Correr typecheck**

Run: `npm run check`
Expected: Sin errores

- [ ] **Step 4: Commit**

```bash
git add src/lib/firebase/chat-cache.ts
git commit -m "feat(chat-contrato): cache normalizado con TTL 7 días"
```

---

## Task 21: Rate limit por usuario

**Files:**

- Modify: `src/app/api/admin/lab/chat-contrato/stream/route.ts`

- [ ] **Step 1: Agregar rate limit por userId**

Después de `requireSuperAdminRequest`, agregar rate limit por usuario:

```ts
const ctx = await requireSuperAdminRequest(request);

// Rate limit per user (10 req/min)
enforceRateLimit(request, {
  bucket: `api:chat-contrato:user:${ctx.uid}`,
  limit: 10,
  windowMs: 60_000,
});
```

Mantener el rate limit global existente (cambiar de 20 a 30 req/min):

```ts
enforceRateLimit(request, {
  bucket: "api:admin:lab:chat-contrato:stream",
  limit: 30,
  windowMs: 60_000,
});
```

- [ ] **Step 2: Correr typecheck**

Run: `npm run check`
Expected: Sin errores

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/lab/chat-contrato/stream/route.ts
git commit -m "feat(chat-contrato): rate limit por usuario (10 req/min) + global (30 req/min)"
```

---

## Task 22: UX — indicadores de estado en el frontend

**Files:**

- Modify: `src/app/(main)/admin/lab/chat-contrato/page.tsx`

- [ ] **Step 1: Agregar estados de loading granulares**

Cambiar el estado de loading simple por estados granulares:

```tsx
type LoadingPhase = "idle" | "searching" | "generating" | "done";
const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");
```

En el handler de submit:

- Antes de fetch: `setLoadingPhase("searching")`
- Al recibir el primer SSE con sources: `setLoadingPhase("generating")`
- Al recibir `[DONE]`: `setLoadingPhase("done")` → `"idle"`

- [ ] **Step 2: Mostrar texto según fase**

```tsx
{
  loadingPhase === "searching" && (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Buscando en el contrato...
    </div>
  );
}
{
  loadingPhase === "generating" && (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Generando respuesta...
    </div>
  );
}
```

- [ ] **Step 3: Agregar campo de comentario al dar thumbs down**

Cuando el usuario da thumbs down, mostrar un input de texto opcional:

```tsx
{
  feedbackGiven[msg.id] === "down" && (
    <div className="mt-2 flex gap-2">
      <input
        type="text"
        placeholder="¿Qué estuvo mal? (opcional)"
        className="flex-1 rounded border px-2 py-1 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.currentTarget.value.trim()) {
            submitFeedbackComment(msg.id, e.currentTarget.value.trim());
            e.currentTarget.value = "";
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Correr typecheck**

Run: `npm run check`
Expected: Sin errores (warnings preexistentes OK)

- [ ] **Step 5: Commit**

```bash
git add src/app/\(main\)/admin/lab/chat-contrato/page.tsx
git commit -m "feat(chat-contrato): indicadores de fase (buscando/generando) + comentario en feedback"
```

---

## Task 23: Script `npm run bench:chat`

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Agregar script en package.json**

```json
{
  "scripts": {
    "bench:chat": "tsx scripts/tests/evaluate-contract-chat.ts && tsx scripts/tests/evaluate-contract-responses.ts"
  }
}
```

- [ ] **Step 2: Verificar que corre**

Run: `npm run bench:chat`
Expected: Ejecuta ambos benchmarks secuencialmente

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(chat-contrato): agregar npm run bench:chat"
```

---

## Task 24: Validación final y PR

- [ ] **Step 1: Correr todos los tests**

Run: `npm test -- --run`
Expected: Todos pasan

- [ ] **Step 2: Correr typecheck + lint**

Run: `npm run check`
Expected: Sin errores nuevos

- [ ] **Step 3: Verificar tamaño de index.ts**

Run: `wc -l src/lib/contract-chat/index.ts`
Expected: < 500 líneas

- [ ] **Step 4: Correr benchmark de retrieval**

Run: `npx tsx scripts/tests/evaluate-contract-chat.ts`
Expected: >= 95%

- [ ] **Step 5: Hacer push y crear PR**

```bash
git push origin feat/chat-contrato-polish
gh pr create --title "feat(chat-contrato): polish para producción interna" --base main
```
