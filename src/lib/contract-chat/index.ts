import fs from "fs";
import path from "path";

import type {
  AnswerPlan,
  ChatMessage,
  ContractChatAnswer,
  ContractChatStatus,
  ContractChunk,
  ContractIndex,
  ContractRetrievalTrace,
  ContractSearchResult,
  EvidencePack,
} from "@/lib/contract-chat/types";
import {
  CONTRACT_FILENAME,
  CONTRACT_INDEX_PATH,
  CONTRACT_PATH,
  DEFAULT_GROQ_MODEL,
  FAQ_PATH,
  GROQ_MIN_INTERVAL_MS,
  MAX_CONVERSATION_HISTORY,
  MAX_EVIDENCE_SOURCES,
  MAX_SELECTED_SOURCES,
  PRESTACIONES_EMB_PATH,
  PRESTACIONES_PATH,
  PRESTACION_SEMANTIC_GAP,
  PRESTACION_SEMANTIC_THRESHOLD,
  TABULADOR_PATH,
} from "@/lib/contract-chat/constants";
import {
  DOCUMENT_SECTIONS,
  extractPageHints,
  extractPagesFromPdf,
  splitPagesIntoSections,
  splitSectionIntoChunks,
} from "@/lib/contract-chat/chunking";
import {
  normalizeText,
  tokenizeQuery,
  countTokens,
  rewriteQueryLocal,
  isConversationalPrompt,
  isStructureQuery,
  buildStructureAnswer,
  buildConversationalAnswer,
  CONTRACT_SECTIONS,
} from "@/lib/contract-chat/query-processing";
import {
  cosineSimilarity,
  generateEmbeddings,
  generateQueryEmbedding,
  readLocalEnvValue,
} from "@/lib/contract-chat/embeddings";
import { createExcerpt, hybridSearch } from "@/lib/contract-chat/search";
import {
  sanitizeConversationHistory,
  contextualizeQuery,
  reinforceContextualTopic,
} from "@/lib/contract-chat/contextualization";
import {
  buildRetrievalTrace,
  checkThematicCompatibility,
  expandEvidenceSources,
  getRecentContractRetrievalTraces,
  orderSourcesForPrompt,
  recordRetrievalTrace,
  rerankEvidenceByQuestionIntent,
} from "@/lib/contract-chat/evidence";

// ---------------------------------------------------------------------------
// Helpers using imported CONTRACT_SECTIONS
// ---------------------------------------------------------------------------

function getSectionForPage(
  pageNumber: number,
): (typeof CONTRACT_SECTIONS)[number] | null {
  for (const section of CONTRACT_SECTIONS) {
    if (pageNumber >= section.startPage && pageNumber <= section.endPage) {
      return section;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let contractIndexPromise: Promise<ContractIndex> | null = null;

// ---------------------------------------------------------------------------
// LLM — Groq (Llama 3.3 70B)
// ---------------------------------------------------------------------------

function getGroqApiKeys(): string[] {
  const keys: string[] = [];
  const primary =
    process.env.GROQ_API_KEY ||
    readLocalEnvValue(
      path.join(process.cwd(), ".env.groq.local"),
      "GROQ_API_KEY",
    ) ||
    readLocalEnvValue(path.join(process.cwd(), ".env.local"), "GROQ_API_KEY");
  if (primary) keys.push(primary);

  const fallback =
    process.env.GROQ_API_KEY_FALLBACK ||
    readLocalEnvValue(
      path.join(process.cwd(), ".env.local"),
      "GROQ_API_KEY_FALLBACK",
    );
  if (fallback) keys.push(fallback);

  return keys;
}

function getGroqApiKey() {
  return getGroqApiKeys()[0] || null;
}

function getGroqModel() {
  return (
    process.env.GROQ_MODEL ||
    readLocalEnvValue(
      path.join(process.cwd(), ".env.groq.local"),
      "GROQ_MODEL",
    ) ||
    readLocalEnvValue(path.join(process.cwd(), ".env.local"), "GROQ_MODEL") ||
    DEFAULT_GROQ_MODEL
  );
}

const SYSTEM_PROMPT = `Eres un asesor sindical experimentado del SNTSS que conoce a fondo el contrato colectivo IMSS-SNTSS 2025-2027. Hablas como compañero de trabajo — claro, directo, con confianza. Tu objetivo es que el trabajador ENTIENDA sus derechos, no solo que sepa la cláusula.

CÓMO RESPONDER:
1. Primero responde la pregunta en palabras sencillas, como se lo explicarías a un compañero en el pasillo.
2. Luego da el detalle concreto (montos, plazos, requisitos) que esté en las fuentes.
3. Al final menciona dónde encontrarlo: sección, cláusula y página.
4. Si las fuentes no cubren todo, dilo: "De lo que tengo a la mano solo me aparece X, pero el detalle completo lo encuentras en tal sección."
5. Si el usuario pide opciones, tipos, requisitos o aplicabilidad, responde en formato de decisión: "puedes revisar/aplicar a", "depende de", "no aplica si", y "dato que falta". No sustituyas la respuesta con una frase genérica como "consulta los requisitos específicos".

ESTRUCTURA DEL CONTRATO (para orientar al trabajador):
1. Contrato Colectivo (p.9-88) — las 157 cláusulas principales: derechos, obligaciones, prestaciones.
2. Tabulador de Sueldos (p.89-104) — cuánto gana cada categoría.
3. Profesiogramas (p.105-262) — qué hace cada puesto y qué requisitos pide.
4. Catálogos (p.263-272) — lista de categorías y ramas.
5. Reglamentos (p.273-542) — reglas detalladas de: becas, bolsas de trabajo, escalafón (p.339), fondo de retiro (p.357), guarderías (p.364), uniformes (p.374), reglamento interior (p.389), préstamos de vivienda (p.446), entre otros.
6. Convenio de Jubilaciones Nuevo Ingreso (p.543-550) — régimen especial para los de nuevo ingreso.
7. Índice (p.551+).

REGLAS:
- Solo usa datos que estén en las fuentes proporcionadas. No inventes cláusulas, páginas ni montos.
- Las citas de cláusula y página SOLO sácalas del campo "Ubicación" de cada fuente.
- Si mencionas sueldos, aclara que es "sueldo base tabular" y que hay prestaciones adicionales.
- Antes de redactar, comprueba que cada conclusión esté explícitamente respaldada por una fuente. No completes huecos con conocimiento general.
- Si falta un dato personal decisivo, como fecha de ingreso, antigüedad o tipo de contratación, explica las opciones respaldadas y pide ese dato. No afirmes qué régimen aplica todavía.
- Si la pregunta compara leyes o reglas que las fuentes no nombran, dilo claramente en vez de deducir una equivalencia.
- Si hay artículos consecutivos del mismo reglamento en las fuentes, intégralos: definición, clases, derechos, requisitos, autoridad que decide y límites. No trates cada fuente como una respuesta aislada.

ESTILO:
- Español coloquial mexicano. Nada de "cabe mencionar", "es importante señalar" ni frases de abogado.
- Ve al grano. Frases cortas. Usa bullets para listas.
- NO empieces con "Según el contrato..." — di directo lo que pasa.
- Si es pregunta de seguimiento, usa el contexto previo. No repitas lo que ya dijiste.
- Si ya existe historial de conversación, NO saludes otra vez. Continúa directo con la respuesta.
- Máximo 8-10 líneas. Si pide más detalle, entonces sí amplía.
- Al final: "Páginas de referencia: p. X, p. Y"`;

async function generateGroqAnswer(
  query: string,
  sources: ContractSearchResult[],
  conversationHistory: ChatMessage[],
  tabuladorContext?: string,
  plan?: AnswerPlan,
) {
  const apiKey = getGroqApiKey();
  if (!apiKey || sources.length === 0) return null;

  const model = getGroqModel();
  const messages = buildGroqMessages(
    query,
    sources,
    conversationHistory,
    tabuladorContext,
    plan,
  );

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1024,
        messages,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GROQ_HTTP_${response.status}: ${errorText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("GROQ_EMPTY_RESPONSE");

  return { model, content };
}

function buildGroqMessages(
  query: string,
  sources: ContractSearchResult[],
  conversationHistory: ChatMessage[],
  tabuladorContext?: string,
  plan?: AnswerPlan,
): Array<{ role: string; content: string }> {
  const promptSources = orderSourcesForPrompt(sources);
  const context = promptSources
    .map((source, i) => {
      const section = getSectionForPage(source.chunk.pageNumber);
      const sectionInfo = section
        ? `[${section.number}. ${section.title}]`
        : "";
      const clauseInfo = source.chunk.clauseNumber
        ? `Cláusula ${source.chunk.clauseNumber}${source.chunk.clauseTitle ? ` - ${source.chunk.clauseTitle}` : ""}`
        : `Sección general`;
      const chapterInfo = source.chunk.chapterTitle
        ? ` | ${source.chunk.chapterTitle}`
        : "";
      const textLimit = i < 4 ? 1_400 : 700;
      return [
        `--- Fuente ${i + 1} ---`,
        `Ubicación: ${sectionInfo} ${clauseInfo}${chapterInfo} | Página ${source.chunk.pageNumber}`,
        `Texto: ${source.chunk.text.slice(0, textLimit)}`,
      ].join("\n");
    })
    .join("\n\n");

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  const recentHistory = sanitizeConversationHistory(
    query,
    conversationHistory,
  ).slice(-MAX_CONVERSATION_HISTORY);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  const validPages = Array.from(
    new Set(promptSources.map((s) => s.chunk.pageNumber)),
  ).sort((a, b) => a - b);
  const validClauses = promptSources
    .filter((s) => s.chunk.clauseNumber)
    .map((s) => `Cláusula ${s.chunk.clauseNumber} (p. ${s.chunk.pageNumber})`)
    .filter((v, i, a) => a.indexOf(v) === i);
  const hasRelativeReference = /\b(antes|despues|eso|esa|ese|mi caso)\b/.test(
    normalizeText(query),
  );
  const hasHistory = recentHistory.length > 0;

  messages.push({
    role: "user",
    content: [
      `Pregunta: ${query}`,
      "",
      hasHistory
        ? "Esta es una continuación de una conversación activa: no saludes ni reinicies la conversación; responde directo usando el contexto previo."
        : null,
      hasHistory ? "" : null,
      tabuladorContext ? tabuladorContext : null,
      tabuladorContext ? "" : null,
      context ? "Contexto recuperado del contrato:" : null,
      context || null,
      "",
      validPages.length > 0
        ? `PÁGINAS VÁLIDAS que puedes citar: ${validPages.map((p) => `p. ${p}`).join(", ")}`
        : null,
      validClauses.length > 0
        ? `CLÁUSULAS VÁLIDAS: ${validClauses.join(", ")}`
        : null,
      hasRelativeReference
        ? "La pregunta contiene una referencia relativa. No supongas una fecha, condición personal o régimen: presenta únicamente las alternativas explícitas en las fuentes y pide el dato que falte."
        : null,
      plan?.dataThatMustBeRequested && plan.dataThatMustBeRequested.length > 0
        ? `DATOS FALTANTES: El usuario no proporcionó: ${plan.dataThatMustBeRequested.join(", ")}. Presenta las opciones disponibles y pide esos datos al final.`
        : null,
      plan?.needsCombiningSources
        ? "Las fuentes provienen de secciones distintas del contrato. Integra la información de forma coherente — no trates cada fuente como una respuesta aislada."
        : null,
      "IMPORTANTE: NO cites ninguna página o cláusula que no esté en las listas anteriores. Los datos del tabulador de sueldos son EXACTOS — cítalos textualmente.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return messages;
}

// ---------------------------------------------------------------------------
// Tabulador de sueldos — structured salary data
// ---------------------------------------------------------------------------

interface TabuladorEntry {
  categoria: string;
  sector: string;
  jornada: number | null;
  sueldoHoraMes: number | null;
  sueldoMesPesos: number | null;
  escalafon: number | string;
  pagina: number;
}

interface TabuladorData {
  totalCategorias: number;
  categorias: TabuladorEntry[];
}

let tabuladorCache: TabuladorData | null = null;

function loadTabulador(): TabuladorData | null {
  if (tabuladorCache) return tabuladorCache;
  if (!fs.existsSync(TABULADOR_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(TABULADOR_PATH, "utf8"));
    tabuladorCache = data as TabuladorData;
    return tabuladorCache;
  } catch {
    return null;
  }
}

const SALARY_PATTERNS = [
  /\b(salario|sueldo|sueldos|tabulador|gana|ganan|pagan|cobr[ao]|cuanto.*gana|cuanto.*pagan)\b/i,
  /\b(mayor salario|mejor pagad|mas gana|top salario|salario mas alto)\b/i,
  /\b(categoria|categorias|profesiograma)\b/i,
];

function isSalaryQuery(query: string): boolean {
  const normalized = normalizeText(query);
  return SALARY_PATTERNS.some((p) => p.test(normalized) || p.test(query));
}

function buildTabuladorContext(query: string): string | null {
  const tabulador = loadTabulador();
  if (!tabulador) return null;

  // Solo inyectar el tabulador si la pregunta es realmente de sueldos. Sin este
  // filtro, el stem-matching contra 55 categorías engancha casi cualquier palabra.
  if (!isSalaryQuery(query)) return null;

  const normalized = normalizeText(query);
  const entries = tabulador.categorias;

  // Check if asking for highest/lowest salary
  if (/\b(mayor|mas alto|mejor pagad|top|maximo)\b/i.test(query)) {
    const sorted = [...entries]
      .filter((e) => e.sueldoMesPesos)
      .sort((a, b) => (b.sueldoMesPesos || 0) - (a.sueldoMesPesos || 0));
    const top10 = sorted.slice(0, 10);
    return [
      "DATOS DEL TABULADOR DE SUELDOS BASE (Top 10 salarios más altos):",
      ...top10.map(
        (e, i) =>
          `${i + 1}. ${e.categoria} (${e.sector}) — $${e.sueldoMesPesos?.toLocaleString("es-MX")} mes / Jornada ${e.jornada}h / Esc. ${e.escalafon} / p. ${e.pagina}`,
      ),
      `Total categorías en tabulador: ${tabulador.totalCategorias}`,
    ].join("\n");
  }

  if (/\b(menor|mas bajo|peor pagad|minimo|bottom)\b/i.test(query)) {
    const sorted = [...entries]
      .filter((e) => e.sueldoMesPesos && e.sueldoMesPesos > 0)
      .sort((a, b) => (a.sueldoMesPesos || 0) - (b.sueldoMesPesos || 0));
    const bottom10 = sorted.slice(0, 10);
    return [
      "DATOS DEL TABULADOR DE SUELDOS BASE (10 salarios más bajos):",
      ...bottom10.map(
        (e, i) =>
          `${i + 1}. ${e.categoria} (${e.sector}) — $${e.sueldoMesPesos?.toLocaleString("es-MX")} mes / Jornada ${e.jornada}h / Esc. ${e.escalafon} / p. ${e.pagina}`,
      ),
      `Total categorías en tabulador: ${tabulador.totalCategorias}`,
    ].join("\n");
  }

  // Search for specific category — use prefix matching (stem-like)
  // "enfermeras" matches "enfermeria", "coordinador" matches "coordinadora", etc.
  const queryWords = normalized
    .split(" ")
    .filter((w) => w.length >= 4)
    .map((w) => w.slice(0, Math.max(5, w.length - 2))); // stem: drop last 2 chars, min 5

  const matchingEntries = entries.filter((e) => {
    const catNorm = normalizeText(e.categoria);
    const secNorm = normalizeText(e.sector);
    const combined = catNorm + " " + secNorm;
    return queryWords.some((stem) => combined.includes(stem));
  });

  if (matchingEntries.length > 0) {
    const limited = matchingEntries.slice(0, 20);
    return [
      `DATOS DEL TABULADOR DE SUELDOS BASE (${limited.length} categorías encontradas${matchingEntries.length > 20 ? ` de ${matchingEntries.length} total` : ""}):`,
      `NOTA: Estos son SUELDOS BASE TABULARES. Algunas categorías reciben compensaciones adicionales (sobresueldos) según las cláusulas del contrato. Por ejemplo, enfermería recibe +31% (Cláusula 151), psicología +3% (Cláusula 153), etc. El sueldo real = sueldo base + compensaciones + prestaciones.`,
      ...limited.map(
        (e) =>
          `- ${e.categoria} (${e.sector}) — Sueldo base: $${e.sueldoMesPesos?.toLocaleString("es-MX")}/mes / Jornada ${e.jornada}h / Esc. ${e.escalafon} / p. ${e.pagina}`,
      ),
      `Total categorías en tabulador: ${tabulador.totalCategorias}`,
    ].join("\n");
  }

  // If it's a general salary question, give summary
  if (isSalaryQuery(query)) {
    const sorted = [...entries]
      .filter((e) => e.sueldoMesPesos)
      .sort((a, b) => (b.sueldoMesPesos || 0) - (a.sueldoMesPesos || 0));
    return [
      `RESUMEN DEL TABULADOR DE SUELDOS BASE:`,
      `Total categorías: ${tabulador.totalCategorias}`,
      `Salario más alto: $${sorted[0]?.sueldoMesPesos?.toLocaleString("es-MX")} (${sorted[0]?.categoria})`,
      `Salario más bajo: $${sorted[sorted.length - 1]?.sueldoMesPesos?.toLocaleString("es-MX")} (${sorted[sorted.length - 1]?.categoria})`,
      `Usa preguntas específicas como "salario de enfermera" o "cuánto gana un coordinador" para datos exactos.`,
    ].join("\n");
  }

  return null;
}

// ---------------------------------------------------------------------------
// Prestaciones structured data
// ---------------------------------------------------------------------------

interface PrestacionEntry {
  nombre: string;
  clausula: string;
  pagina: number | string;
  descripcion: string;
  montos: Record<string, unknown>;
  aplica: string;
}

let prestacionesCache: PrestacionEntry[] | null = null;

function loadPrestaciones(): PrestacionEntry[] {
  if (prestacionesCache) return prestacionesCache;
  if (!fs.existsSync(PRESTACIONES_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(PRESTACIONES_PATH, "utf8"));
    prestacionesCache = data.prestaciones as PrestacionEntry[];
    return prestacionesCache;
  } catch {
    return [];
  }
}

// Términos coloquiales del trabajador → prestación (solo para palabras que NO
// aparecen literalmente en el nombre; el resto se engancha automáticamente).
const PRESTACION_SINONIMOS: Array<{ nombre: string; terminos: string[] }> = [
  { nombre: "Anteojos", terminos: ["lentes", "gafas", "vista"] },
  {
    nombre: "Ayuda para Renta de Casa-Habitación",
    terminos: ["renta", "vivienda", "habitacion", "casa"],
  },
  {
    nombre: "Adquisición de Vehículos Automotores",
    terminos: ["auto", "coche", "carro", "automovil"],
  },
  { nombre: "Guarderías Infantiles", terminos: ["guarderia", "estancia"] },
  { nombre: "Ropa de Trabajo y Uniformes", terminos: ["uniforme", "bata"] },
  { nombre: "Fondo de Ahorro", terminos: ["ahorro"] },
  { nombre: "Programas Educativos", terminos: ["beca", "becas", "estudios"] },
  {
    nombre: "Descuento Balnearios y Campamentos",
    terminos: ["balneario", "campamento", "malinche"],
  },
  { nombre: "Prima Dominical", terminos: ["domingo", "dominical"] },
  {
    nombre: "Asistencia Médica, Dental y Farmacéutica",
    terminos: ["dentista", "dental", "medicamento", "farmacia"],
  },
  {
    nombre: "Ayuda para Actividades Culturales y Recreativas",
    terminos: ["cultural", "recreativa", "quinquenio"],
  },
  {
    nombre: "Préstamos para Fomento a la Habitación",
    terminos: ["prestamo", "credito"],
  },
];

// Tokens genéricos del nombre que causarían falsos positivos.
const PRESTACION_STOPWORDS = new Set([
  "ayuda",
  "para",
  "personal",
  "trabajo",
  "social",
  "reconocimiento",
  "clinica",
  "festivales",
  "prima",
]);

// Palabras significativas del nombre + sinónimos → disparadores de cada prestación.
function prestacionKeywords(p: PrestacionEntry): string[] {
  const fromName = normalizeText(p.nombre)
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length >= 5 && !PRESTACION_STOPWORDS.has(w));
  const syn =
    PRESTACION_SINONIMOS.find((s) => s.nombre === p.nombre)?.terminos ?? [];
  return Array.from(
    new Set([...fromName, ...syn.map((t) => normalizeText(t))]),
  );
}

const PRESTACIONES_GENERAL_PATTERNS = [
  /\b(prestacion|prestaciones|beneficio|beneficios)\b/i,
  /\b(que.*(incluye|recib|dan|otorg|compone))\b/i,
  /\b(ingreso.*total|ingreso.*real|cuanto.*realmente|ademas.*sueldo)\b/i,
];

function isGeneralPrestacionesQuery(query: string): boolean {
  return PRESTACIONES_GENERAL_PATTERNS.some((p) => p.test(query));
}

function matchPrestaciones(query: string): PrestacionEntry[] {
  const normalized = normalizeText(query);
  const qTokens = normalized.split(/[^a-z0-9]+/i).filter((w) => w.length >= 4);

  // Enlaza si el keyword aparece literal, o comparte raíz con un token de la
  // consulta (tolera plural/singular: "estacionamiento" ~ "estacionamientos").
  const matches = (kw: string) =>
    normalized.includes(kw) ||
    qTokens.some((t) => {
      const [short, long] = kw.length <= t.length ? [kw, t] : [t, kw];
      return short.length >= 5 && long.startsWith(short);
    });

  return loadPrestaciones().filter((p) => prestacionKeywords(p).some(matches));
}

function formatMontos(montos: Record<string, unknown>): string {
  if (!montos || Object.keys(montos).length === 0) return "";
  return ` Datos: ${JSON.stringify(montos)}.`;
}

// --- Enganche SEMÁNTICO de prestaciones (por significado, no por palabras) ---
// Requiere prestaciones-embeddings.json (generado con embed-prestaciones.ts).
// Sin ese archivo o sin Jina, matchPrestacionesSemantic devuelve [] y solo
// opera el enganche por keywords.
interface PrestacionEmbeddingEntry {
  nombre: string;
  embedding: number[];
}

let prestacionesEmbCache: PrestacionEmbeddingEntry[] | null = null;

function loadPrestacionesEmbeddings(): PrestacionEmbeddingEntry[] | null {
  if (prestacionesEmbCache) return prestacionesEmbCache;
  if (!fs.existsSync(PRESTACIONES_EMB_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(PRESTACIONES_EMB_PATH, "utf8"));
    prestacionesEmbCache = data.entries as PrestacionEmbeddingEntry[];
    return prestacionesEmbCache;
  } catch {
    return null;
  }
}

function matchPrestacionesSemantic(
  queryEmbedding: number[] | undefined,
): PrestacionEntry[] {
  if (!queryEmbedding || queryEmbedding.length === 0) return [];
  const embeddings = loadPrestacionesEmbeddings();
  if (!embeddings) return [];

  const scored = embeddings
    .map((e) => ({
      nombre: e.nombre,
      score: e.embedding?.length
        ? cosineSimilarity(queryEmbedding, e.embedding)
        : 0,
    }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 || scored[0].score < PRESTACION_SEMANTIC_THRESHOLD) {
    return [];
  }

  const topScore = scored[0].score;
  const byName = new Map(loadPrestaciones().map((p) => [p.nombre, p]));
  return scored
    .filter(
      (e) =>
        e.score >= PRESTACION_SEMANTIC_THRESHOLD &&
        topScore - e.score <= PRESTACION_SEMANTIC_GAP,
    )
    .slice(0, 3)
    .map((e) => byName.get(e.nombre))
    .filter((p): p is PrestacionEntry => Boolean(p));
}

function buildPrestacionesContext(
  query: string,
  queryEmbedding?: number[],
): string | null {
  const prestaciones = loadPrestaciones();
  if (prestaciones.length === 0) return null;

  // Unión: enganche semántico (por significado) + por keywords (refuerzo).
  const seen = new Set<string>();
  const matching: PrestacionEntry[] = [];
  for (const p of [
    ...matchPrestacionesSemantic(queryEmbedding),
    ...matchPrestaciones(query),
  ]) {
    if (!seen.has(p.nombre)) {
      seen.add(p.nombre);
      matching.push(p);
    }
  }

  // Match específico (1-5) → contexto detallado con montos estructurados
  if (matching.length > 0 && matching.length <= 5) {
    return [
      "DATOS ESTRUCTURADOS DE PRESTACIONES DEL CONTRATO. Usa estas cifras exactas; " +
        "si la pregunta pide un cálculo por antigüedad y los datos dan la fórmula (p. ej. días base + incremento por año), calcula el resultado y explícalo:",
      ...matching.map(
        (p) =>
          `- ${p.nombre} (Cláusula ${p.clausula}, p. ${p.pagina}): ${p.descripcion} Aplica a: ${p.aplica}.${formatMontos(p.montos)}`,
      ),
    ].join("\n");
  }

  // Pregunta general de prestaciones → resumen completo
  if (isGeneralPrestacionesQuery(query) || matching.length > 5) {
    return [
      "RESUMEN DE PRESTACIONES DEL CONTRATO (además del sueldo base tabular):",
      ...prestaciones
        .slice(0, 15)
        .map(
          (p) =>
            `- ${p.nombre} (Cl. ${p.clausula}, p. ${p.pagina}): ${p.descripcion.slice(0, 120)}`,
        ),
      `Total: ${prestaciones.length} prestaciones documentadas.`,
      "El sueldo real de un trabajador = sueldo base tabular + sobresueldos por rama + ayuda renta (82.15%) + fondo de ahorro + prima vacacional + demás prestaciones.",
    ].join("\n");
  }

  return null;
}

// ---------------------------------------------------------------------------
// FAQ semantic index — accelerates retrieval, not direct answers
// ---------------------------------------------------------------------------

interface FaqEmbeddedEntry {
  question: string;
  answer: string;
  chunkId: string;
  pageNumber: number;
  clauseNumber?: number;
  embedding: number[];
}

interface FaqIndex {
  totalFaqs: number;
  entries: FaqEmbeddedEntry[];
}

let faqIndexCache: FaqIndex | null = null;
const FAQ_EMBEDDINGS_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "contract-faqs-embeddings.json",
);

function loadFaqIndex(): FaqIndex | null {
  if (faqIndexCache) return faqIndexCache;
  if (!fs.existsSync(FAQ_EMBEDDINGS_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(FAQ_EMBEDDINGS_PATH, "utf8"));
    faqIndexCache = data as FaqIndex;
    return faqIndexCache;
  } catch {
    return null;
  }
}

async function faqSemanticSearch(
  query: string,
  precomputedEmbedding?: number[],
): Promise<{
  matchedChunkIds: string[];
  bestFaq: { question: string; answer: string; score: number } | null;
}> {
  const faqIndex = loadFaqIndex();
  if (!faqIndex || faqIndex.entries.length === 0) {
    return { matchedChunkIds: [], bestFaq: null };
  }

  // Reutiliza el embedding ya generado en searchContractSources si existe.
  let queryEmbedding = precomputedEmbedding;
  if (!queryEmbedding || queryEmbedding.length === 0) {
    try {
      queryEmbedding = await generateQueryEmbedding(query);
    } catch {
      return { matchedChunkIds: [], bestFaq: null };
    }
  }

  if (queryEmbedding.length === 0) {
    return { matchedChunkIds: [], bestFaq: null };
  }

  // Score all FAQ questions against user query
  const scored = faqIndex.entries
    .map((entry) => ({
      ...entry,
      score: entry.embedding?.length
        ? cosineSimilarity(queryEmbedding, entry.embedding)
        : 0,
    }))
    .filter((e) => e.score > 0.7)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { matchedChunkIds: [], bestFaq: null };
  }

  // Collect unique chunk IDs from top matching FAQs
  const matchedChunkIds = Array.from(
    new Set(scored.slice(0, 10).map((s) => s.chunkId)),
  );

  const best = scored[0];
  return {
    matchedChunkIds,
    bestFaq:
      best.score > 0.85
        ? { question: best.question, answer: best.answer, score: best.score }
        : null,
  };
}

export async function searchContractSources(
  query: string,
  conversationHistory: ChatMessage[] = [],
  options: { contextualize?: boolean } = {},
): Promise<{
  sources: ContractSearchResult[];
  isConversational: boolean;
  structureAnswer?: string;
  tabuladorContext?: string;
  trace?: ContractRetrievalTrace;
}> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) throw new Error("QUERY_REQUIRED");

  const index = await getContractIndex();
  const tokens = tokenizeQuery(trimmedQuery);
  const normalizedQuery = normalizeText(trimmedQuery);

  // Preguntas sobre la estructura/organización del contrato
  if (isStructureQuery(normalizedQuery)) {
    return {
      sources: [],
      isConversational: false,
      structureAnswer: buildStructureAnswer(),
    };
  }

  if (isConversationalPrompt(normalizedQuery, tokens)) {
    return { sources: [], isConversational: true };
  }

  // Direct clause/article resolution by metadata
  const clauseMatch = normalizedQuery.match(/\bcl[aá]usula\s+(\d+)\b/);
  const articleMatch = normalizedQuery.match(/\bart[ií]culo\s+(\d+)\b/);
  if (clauseMatch || articleMatch) {
    const targetNumber = Number(clauseMatch?.[1] || articleMatch?.[1]);
    const isClause = Boolean(clauseMatch);
    const directHits = index.chunks.filter((c) =>
      isClause
        ? c.clauseNumber === targetNumber
        : c.articleNumber === targetNumber,
    );
    if (directHits.length > 0) {
      // If article query mentions a specific reglamento, filter further
      const sectionHint = normalizedQuery.match(
        /\b(beca|bolsa|escalafon|retiro|guarderia|ropa|uniformes|pasajes|habitacion|capacitacion|conductores|infectocontagio|interior|jubilaci|residentes|salario|plantillas|higiene|rama|alimentos|tiendas|viaticos|ahorro|resguardo|bienestar)\b/,
      );
      let filteredHits = directHits;
      if (sectionHint && !isClause) {
        const keyword = sectionHint[1];
        const matchingSection = DOCUMENT_SECTIONS.find((s) =>
          normalizeText(s.sectionTitle).includes(keyword),
        );
        if (matchingSection) {
          const sectionFiltered = directHits.filter(
            (c) => c.sectionNumber === matchingSection.sectionNumber,
          );
          if (sectionFiltered.length > 0) filteredHits = sectionFiltered;
        }
      }
      const directSources: ContractSearchResult[] = filteredHits
        .slice(0, MAX_SELECTED_SOURCES)
        .map((chunk) => ({
          chunk,
          score: 1.0,
          semanticScore: 1.0,
          keywordScore: 1.0,
          matchedTerms: ["direct-metadata-match"],
          excerpt: chunk.text.slice(0, 300),
        }));
      const trace = buildRetrievalTrace(
        trimmedQuery,
        trimmedQuery,
        "none",
        [trimmedQuery],
        directSources,
        directSources,
      );
      recordRetrievalTrace(trace);
      return {
        sources: directSources,
        isConversational: false,
        trace,
      };
    }
  }

  const contextualized =
    options.contextualize === false
      ? { query: trimmedQuery, mode: "none" as const, history: [] }
      : await contextualizeQuery(trimmedQuery, conversationHistory);
  const contextualizedQuery = reinforceContextualTopic(
    trimmedQuery,
    contextualized.query,
    contextualized.history,
  );

  // Local query rewriting — typos, abbreviations (no LLM call, saves tokens)
  const rewrittenQuery = rewriteQueryLocal(contextualizedQuery);
  const searchQuery =
    rewrittenQuery !== contextualizedQuery.toLowerCase()
      ? rewrittenQuery
      : contextualizedQuery;
  const retrievalQueries = Array.from(
    new Set([searchQuery].map((value) => value.trim()).filter(Boolean)),
  );

  // Genera el embedding de la consulta UNA vez y lo comparte entre el buscador
  // de FAQs y el enganche semántico de prestaciones (evita llamadas de más).
  let queryEmbedding: number[] = [];
  try {
    queryEmbedding = await generateQueryEmbedding(searchQuery);
  } catch {
    queryEmbedding = [];
  }

  // FAQ semantic search — find relevant chunk IDs from pre-generated FAQs
  const { matchedChunkIds } = await faqSemanticSearch(
    searchQuery,
    queryEmbedding,
  );

  // Search with both original and rewritten query, merge results
  const sources = await hybridSearch(searchQuery, index, 10);

  // Boost chunks that FAQ matched — add them if not already in results
  if (matchedChunkIds.length > 0) {
    const existingIds = new Set(sources.map((s) => s.chunk.id));
    for (const chunkId of matchedChunkIds) {
      if (existingIds.has(chunkId)) {
        // Boost existing source's score
        const existing = sources.find((s) => s.chunk.id === chunkId);
        if (existing) existing.score *= 1.3;
      } else {
        // Add the chunk directly from index
        const chunk = index.chunks.find((c) => c.id === chunkId);
        if (chunk) {
          sources.push({
            chunk,
            score: 0.5,
            semanticScore: 0.5,
            keywordScore: 0,
            matchedTerms: ["faq-match"],
            excerpt: createExcerpt(chunk.text, tokenizeQuery(trimmedQuery)),
          });
        }
      }
    }
    sources.sort((a, b) => b.score - a.score);
  }

  // Sort by score (FAQ-boosted chunks will be higher)
  sources.sort((a, b) => b.score - a.score);
  const explicitIndexQuery = /\bindice\b/.test(normalizedQuery);
  const evidenceSources = explicitIndexQuery
    ? sources
    : sources.filter(
        (source) =>
          source.chunk.contentType !== "index" &&
          source.chunk.contentType !== "signatures" &&
          source.chunk.pageNumber < 551,
      );
  const candidates = rerankEvidenceByQuestionIntent(
    expandEvidenceSources(evidenceSources.slice(0, 20), index, searchQuery),
    searchQuery,
  ).slice(0, 20);
  const reranked = candidates.slice(0, MAX_SELECTED_SOURCES);

  // Check if structured data is relevant. Prestaciones usa la consulta
  // reescrita (typos/abreviaciones corregidos) para enganchar mejor.
  const tabuladorContext =
    buildTabuladorContext(contextualizedQuery) || undefined;
  const prestacionesContext =
    buildPrestacionesContext(
      `${contextualizedQuery} ${searchQuery}`,
      queryEmbedding,
    ) || undefined;

  // Merge structured contexts
  const structuredContext =
    [tabuladorContext, prestacionesContext].filter(Boolean).join("\n\n") ||
    undefined;

  const trace = buildRetrievalTrace(
    trimmedQuery,
    contextualizedQuery,
    contextualized.mode,
    retrievalQueries,
    candidates,
    reranked,
  );
  recordRetrievalTrace(trace);

  return {
    sources: reranked.slice(0, MAX_SELECTED_SOURCES),
    isConversational: false,
    tabuladorContext: structuredContext,
    trace,
  };
}

// Simple throttle — Groq free tier has ~6000 TPM org-level limit
let lastGroqCallMs = 0;

// Round-robin key rotation: alternate keys proactively to spread TPM load
let nextKeyIndex = 0;

// When Groq is unavailable (rate limit u otro fallo), emitimos el fallback
// extractivo con las referencias del contrato en vez de un error crudo.
function enqueueExtractiveFallback(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  sources: ContractSearchResult[],
) {
  const body =
    sources.length > 0
      ? buildAnswerText(sources, {
          prefix:
            "El LLM se saturó por límite de uso, pero sí recuperé evidencia del contrato. Te dejo la respuesta corta con respaldo:",
        })
      : "El LLM se saturó por límite de uso. Intenta de nuevo en un minuto.";
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({ text: body })}\n\n`),
  );
  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
  controller.close();
}

export function createGroqStream(
  query: string,
  sources: ContractSearchResult[],
  conversationHistory: ChatMessage[],
  tabuladorContext?: string,
): ReadableStream<Uint8Array> | null {
  const allKeys = getGroqApiKeys();
  if (allKeys.length === 0) return null;

  // Round-robin: start with a different key each request
  const startIndex = nextKeyIndex % allKeys.length;
  nextKeyIndex++;
  const apiKeys = [
    ...allKeys.slice(startIndex),
    ...allKeys.slice(0, startIndex),
  ];

  const model = getGroqModel();

  // For conversational (no sources), use a lighter prompt
  const messages =
    sources.length > 0 || tabuladorContext
      ? buildGroqMessages(query, sources, conversationHistory, tabuladorContext)
      : [
          {
            role: "system" as const,
            content:
              "Eres el asistente del contrato colectivo IMSS-SNTSS 2025-2027. " +
              "Responde de forma natural, amigable y breve. Puedes saludar, despedirte, o guiar al usuario. " +
              "Si ya hay historial de conversación, no saludes otra vez: continúa directo. " +
              "Si te preguntan algo que no es del contrato, recuérdale amablemente que estás para consultas del contrato. " +
              "Responde en español, máximo 3-4 líneas.",
          },
          ...sanitizeConversationHistory(query, conversationHistory)
            .slice(-6)
            .map((m) => ({
              role: m.role as string,
              content: m.content,
            })),
          { role: "user" as const, content: query },
        ];

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Throttle to stay under Groq TPM limits
        const now = Date.now();
        const elapsed = now - lastGroqCallMs;
        if (elapsed < GROQ_MIN_INTERVAL_MS && lastGroqCallMs > 0) {
          await new Promise((r) =>
            setTimeout(r, GROQ_MIN_INTERVAL_MS - elapsed),
          );
        }
        lastGroqCallMs = Date.now();

        // Try each key directly with streaming
        let response: Response | null = null;
        for (let ki = 0; ki < apiKeys.length; ki++) {
          const key = apiKeys[ki];
          const attempt = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({
                model,
                temperature: 0,
                max_tokens: 1024,
                stream: true,
                stream_options: { include_usage: true },
                messages,
              }),
            },
          );

          if (attempt.ok && attempt.body) {
            // Read first chunk to check for rate limit in stream body
            const peekReader = attempt.body.getReader();
            const firstChunk = await peekReader.read();
            const firstText = firstChunk.value
              ? new TextDecoder().decode(firstChunk.value)
              : "";

            if (
              firstText.includes("Rate limit") ||
              firstText.includes("rate_limit")
            ) {
              peekReader.cancel();
              if (ki < apiKeys.length - 1) {
                console.log(
                  "[chat] Key",
                  ki + 1,
                  "rate limited in stream body, trying next...",
                );
                continue;
              }
              console.error("[chat] Rate limit en body con la última key");
              enqueueExtractiveFallback(controller, encoder, sources);
              return;
            }

            // Key works — replay first chunk then pipe the rest via the same reader
            response = new Response(
              new ReadableStream({
                start(c) {
                  if (firstChunk.value) c.enqueue(firstChunk.value);
                },
                async pull(c) {
                  try {
                    const { done, value } = await peekReader.read();
                    if (done) {
                      c.close();
                      return;
                    }
                    c.enqueue(value);
                  } catch {
                    c.close();
                  }
                },
              }),
            );
            break;
          }

          // HTTP error — try next key
          if (ki < apiKeys.length - 1) {
            console.log(
              "[chat] Key",
              ki + 1,
              "failed (status " + attempt.status + "), trying next...",
            );
            continue;
          }

          const errorText = await attempt.text();
          console.error(
            "[chat] Groq falló con la última key:",
            attempt.status,
            errorText.slice(0, 200),
          );
          // Con sources disponibles preferimos el fallback extractivo antes que
          // mostrar un error crudo al usuario.
          if (sources.length > 0) {
            enqueueExtractiveFallback(controller, encoder, sources);
            return;
          }
          const isRateLimit =
            attempt.status === 429 || errorText.includes("Rate limit");
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: isRateLimit
                  ? "Límite de uso alcanzado. Espera un minuto e intenta de nuevo."
                  : errorText.slice(0, 200),
              })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        if (!response || !response.body) {
          console.error("[chat] Todas las keys en rate limit");
          enqueueExtractiveFallback(controller, encoder, sources);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (!trimmed.startsWith("data: ")) continue;

            try {
              const json = JSON.parse(trimmed.slice(6));
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ text: delta })}\n\n`,
                  ),
                );
              }
              // Groq envía el usage en el chunk final (include_usage)
              if (json.usage) {
                const u = json.usage;
                console.log(
                  `[chat] Groq usage — modelo: ${model} | prompt: ${u.prompt_tokens} | completion: ${u.completion_tokens} | total: ${u.total_tokens} tokens`,
                );
                // Reenviar el usage al cliente para poder mostrarlo en la UI
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ usage: u })}\n\n`),
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Stream error" })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });
}

// ---------------------------------------------------------------------------
// EvidencePack & AnswerPlan — structured pre-generation layer
// ---------------------------------------------------------------------------

function detectQueryIntent(query: string): string {
  const nq = normalizeText(query);
  if (/\bcuanto (gano|gana|pagan|cobro|sueldo|salario)\b/.test(nq))
    return "consulta-sueldo";
  if (/\b(vacacion|dias libres|descanso)\b/.test(nq))
    return "consulta-vacaciones";
  if (/\b(jubil|pension|retiro|jubilarme)\b/.test(nq))
    return "consulta-jubilacion";
  if (/\b(beca|estudiar|maestria|postgrado)\b/.test(nq))
    return "consulta-becas";
  if (/\b(permiso|faltar|falta|ausencia|licencia)\b/.test(nq))
    return "consulta-permisos";
  if (/\b(acoso|hostigamiento|violencia|denuncia)\b/.test(nq))
    return "consulta-procedimiento";
  if (/\b(clausula|articulo)\s+\d+\b/.test(nq))
    return "consulta-clausula-especifica";
  if (/\b(diferencia|comparar|cambio entre|versus)\b/.test(nq))
    return "consulta-comparacion";
  if (/\b(que (prestaciones|beneficios|derechos))\b/.test(nq))
    return "consulta-listado";
  if (/\b(como|procedimiento|tramite|pasos|requisitos)\b/.test(nq))
    return "consulta-procedimiento";
  return "consulta-general";
}

function detectUserFacts(query: string, history: ChatMessage[]): string[] {
  const facts: string[] = [];
  const all = [
    ...history.filter((m) => m.role === "user").map((m) => m.content),
    query,
  ].join(" ");
  const nAll = normalizeText(all);

  const yearMatch = nAll.match(
    /\b(entre|ingrese|entre al imss|entro|entre en)\b.*?\b(19\d{2}|20[0-2]\d)\b/,
  );
  if (yearMatch) facts.push(`ingreso: ${yearMatch[2]}`);

  const antiguedadMatch = nAll.match(
    /\b(\d+)\s*(anos?|años?)\s*(de\s+)?(antiguedad|servicio|trabajando)\b/,
  );
  if (antiguedadMatch) facts.push(`antigüedad: ${antiguedadMatch[1]} años`);

  const categoriaMatch = nAll.match(
    /\b(soy|como)\s+(enfermera|medico|auxiliar|coordinador|chofer|laboratorista|trabajador social|jefe de grupo)/,
  );
  if (categoriaMatch) facts.push(`categoría: ${categoriaMatch[2]}`);

  return facts;
}

function detectMissingFacts(intent: string, userFacts: string[]): string[] {
  const missing: string[] = [];
  const factsStr = userFacts.join(" ").toLowerCase();

  if (intent === "consulta-sueldo" && !factsStr.includes("categoría")) {
    missing.push("categoría/puesto");
  }
  if (intent === "consulta-vacaciones" && !factsStr.includes("antigüedad")) {
    missing.push("antigüedad");
  }
  if (
    intent === "consulta-jubilacion" &&
    !factsStr.includes("ingreso") &&
    !factsStr.includes("antigüedad")
  ) {
    missing.push("fecha de ingreso o antigüedad");
  }
  return missing;
}

function buildEvidencePack(
  originalQuery: string,
  contextualizedQuery: string,
  sources: ContractSearchResult[],
  conversationHistory: ChatMessage[],
  trace?: ContractRetrievalTrace,
): EvidencePack {
  const intent = detectQueryIntent(originalQuery);
  const userFacts = detectUserFacts(originalQuery, conversationHistory);
  const missingFacts = detectMissingFacts(intent, userFacts);

  const clauses = Array.from(
    new Set(
      sources
        .filter((s) => s.chunk.clauseNumber)
        .map((s) => s.chunk.clauseNumber!),
    ),
  ).sort((a, b) => a - b);

  const articles: EvidencePack["articles"] = [];
  const seenArticles = new Set<string>();
  for (const s of sources) {
    if (s.chunk.articleNumber && s.chunk.sectionTitle) {
      const key = `${s.chunk.sectionNumber}-${s.chunk.articleNumber}`;
      if (!seenArticles.has(key)) {
        seenArticles.add(key);
        articles.push({
          number: s.chunk.articleNumber,
          section: s.chunk.sectionTitle,
        });
      }
    }
  }

  const tables = sources
    .filter((s) => s.chunk.contentType === "table")
    .map((s) => s.chunk.text.slice(0, 200));

  const sufficiency =
    trace?.sufficiency.status ||
    (sources.length > 0 ? "sufficient" : "insufficient");
  const topScore = trace?.sufficiency.topScore || 0;
  const confidenceLevel: EvidencePack["confidenceLevel"] =
    topScore >= 0.7 && sources.length >= 3
      ? "high"
      : topScore >= 0.4 && sources.length >= 1
        ? "medium"
        : "low";

  return {
    originalQuery,
    contextualizedQuery,
    intent,
    userFacts,
    missingFacts,
    sources: sources.slice(0, MAX_EVIDENCE_SOURCES).map((s) => ({
      text: s.chunk.text,
      pageNumber: s.chunk.pageNumber,
      clauseNumber: s.chunk.clauseNumber,
      articleNumber: s.chunk.articleNumber,
      sectionTitle: s.chunk.sectionTitle,
      contentType: s.chunk.contentType,
    })),
    clauses,
    articles,
    tables,
    exceptions: [],
    contradictions: [],
    sufficiency,
    confidenceLevel,
  };
}

function buildAnswerPlan(pack: EvidencePack): AnswerPlan {
  // Abstention: only when no evidence at all.
  // Thematic incompatibility (SAT, clima, etc.) is handled by checkThematicCompatibility
  // in the retrieval trace — if it flagged insufficient there, the retrieval already
  // returned sources but the trace records it. The AnswerPlan does NOT re-check;
  // it trusts that sources.length > 0 means the retrieval decided to serve them.
  if (pack.sources.length === 0) {
    return {
      directAnswerPossible: false,
      dataThatMustBeRequested: [],
      allowedClaims: [],
      forbiddenClaims: [],
      requiredSources: [],
      needsCombiningSources: false,
      needsAbstention: true,
      abstentionReason:
        "No encontré información relevante sobre eso en el contrato. Estoy para consultas del contrato colectivo IMSS-SNTSS.",
      recommendedFormat: "abstention",
    };
  }

  // Required sources
  const requiredSources = pack.sources
    .slice(0, MAX_EVIDENCE_SOURCES)
    .map((s) => ({
      page: s.pageNumber,
      clause: s.clauseNumber,
      article: s.articleNumber,
    }));

  // Allowed claims: only pages and clauses/articles in evidence
  const allowedClaims = [
    ...pack.clauses.map((c) => `Cláusula ${c}`),
    ...pack.articles.map((a) => `Artículo ${a.number} (${a.section})`),
  ];

  // Forbidden: pages/clauses NOT in evidence
  const forbiddenClaims: string[] = [];

  // Data that must be requested
  const dataThatMustBeRequested = [...pack.missingFacts];

  // Format
  let recommendedFormat: AnswerPlan["recommendedFormat"] = "direct";
  if (pack.intent === "consulta-comparacion") recommendedFormat = "comparison";
  if (pack.intent === "consulta-listado") recommendedFormat = "list";
  if (dataThatMustBeRequested.length > 0 && pack.confidenceLevel !== "high") {
    recommendedFormat = "decision-tree";
  }

  // Combining sources
  const uniqueSections = new Set(
    pack.sources.map((s) => s.sectionTitle).filter(Boolean),
  );
  const needsCombiningSources =
    uniqueSections.size > 1 || pack.sources.length > 3;

  const directAnswerPossible =
    dataThatMustBeRequested.length === 0 && pack.confidenceLevel !== "low";

  return {
    directAnswerPossible,
    dataThatMustBeRequested,
    allowedClaims,
    forbiddenClaims,
    requiredSources,
    needsCombiningSources,
    needsAbstention: false,
    recommendedFormat,
  };
}

// ---------------------------------------------------------------------------
// Extractive fallback answer
// ---------------------------------------------------------------------------

function buildAnswerText(
  sources: ContractSearchResult[],
  options: { prefix?: string } = {},
) {
  if (sources.length === 0) {
    return "No encontré información relevante sobre eso en el contrato. Intenta reformular tu pregunta con términos más específicos — por ejemplo, mencionando la cláusula, prestación o tema concreto que buscas.";
  }

  const topSources = sources.slice(0, 4);
  const lines = topSources.map((s) => {
    const label = s.chunk.clauseNumber
      ? `Cláusula ${s.chunk.clauseNumber}${s.chunk.clauseTitle ? ` (${s.chunk.clauseTitle})` : ""}`
      : `Página ${s.chunk.pageNumber}`;
    const excerpt = s.excerpt.replace(/\s+/g, " ").trim().slice(0, 420);
    return `- ${label}: ${excerpt}${s.excerpt.length > 420 ? "..." : ""}`;
  });
  const pages = Array.from(
    new Set(topSources.map((s) => s.chunk.pageNumber)),
  ).join(", ");

  return [
    options.prefix || "Encontré estas referencias relevantes en el contrato:",
    "",
    ...lines,
    "",
    `Páginas de referencia: p. ${pages.replace(/, /g, ", p. ")}`,
  ].join("\n");
}

/**
 * Improved extractive fallback that uses AnswerPlan to select better excerpts.
 */
function buildPlannedAnswerText(
  sources: ContractSearchResult[],
  plan: AnswerPlan,
  pack: EvidencePack,
): string {
  if (plan.needsAbstention) {
    return (
      plan.abstentionReason ||
      "No encontré información relevante sobre eso en el contrato."
    );
  }

  if (sources.length === 0) {
    return "No encontré información relevante sobre eso en el contrato. Intenta reformular tu pregunta con términos más específicos.";
  }

  const topSources = sources.slice(0, 4);
  const lines = topSources.map((s) => {
    const label = s.chunk.clauseNumber
      ? `Cláusula ${s.chunk.clauseNumber}${s.chunk.clauseTitle ? ` (${s.chunk.clauseTitle})` : ""}`
      : s.chunk.articleNumber && s.chunk.sectionTitle
        ? `Art. ${s.chunk.articleNumber} — ${s.chunk.sectionTitle}`
        : `Página ${s.chunk.pageNumber}`;
    // Use longer excerpts from the actual chunk text, not keyword-matched sentences
    const excerpt = s.chunk.text.replace(/\s+/g, " ").trim().slice(0, 420);
    return `- ${label}: ${excerpt}${s.chunk.text.length > 420 ? "..." : ""}`;
  });

  const pages = Array.from(
    new Set(topSources.map((s) => s.chunk.pageNumber)),
  ).join(", ");

  const parts: string[] = [];
  parts.push("Encontré estas referencias relevantes en el contrato:");
  parts.push("");
  parts.push(...lines);

  if (plan.dataThatMustBeRequested.length > 0) {
    parts.push("");
    parts.push(
      `Para darte una respuesta más precisa, necesito saber: ${plan.dataThatMustBeRequested.join(", ")}.`,
    );
  }

  parts.push("");
  parts.push(`Páginas de referencia: p. ${pages.replace(/, /g, ", p. ")}`);

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Index building
// ---------------------------------------------------------------------------

async function buildContractIndex(): Promise<ContractIndex> {
  if (!fs.existsSync(CONTRACT_PATH)) {
    throw new Error(
      `No se encontró el contrato base en ${CONTRACT_PATH}. Coloca el PDF en artifacts/ para usar el sandbox.`,
    );
  }

  const contractStats = await fs.promises.stat(CONTRACT_PATH);
  const pages = await extractPagesFromPdf(CONTRACT_PATH);

  // Smart chunking by clause/section
  const sections = splitPagesIntoSections(pages);
  const documentFrequencies: Record<string, number> = {};

  const chunks: ContractChunk[] = sections.flatMap((section) => {
    return splitSectionIntoChunks(section).map((raw) => {
      const normalizedText = normalizeText(raw.text);
      const tokenCounts = countTokens(normalizedText);
      for (const token of Object.keys(tokenCounts)) {
        documentFrequencies[token] = (documentFrequencies[token] || 0) + 1;
      }
      return { ...raw, normalizedText, tokenCounts };
    });
  });

  // Generate embeddings
  let hasEmbeddings = false;
  try {
    console.log(`Generando embeddings para ${chunks.length} chunks...`);
    const texts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(texts);
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
    }
    hasEmbeddings = true;
    console.log(`Embeddings generados exitosamente.`);
  } catch (error) {
    console.error(
      "No se pudieron generar embeddings, el índice funcionará solo con keywords:",
      error,
    );
  }

  return {
    contractPath: CONTRACT_PATH,
    sourceMtimeMs: contractStats.mtimeMs,
    builtAt: new Date().toISOString(),
    pageCount: pages.length,
    chunkCount: chunks.length,
    vocabularySize: Object.keys(documentFrequencies).length,
    documentFrequencies,
    chunks,
    hasEmbeddings,
  };
}

// ---------------------------------------------------------------------------
// Index persistence
// ---------------------------------------------------------------------------

async function saveContractIndex(index: ContractIndex) {
  await fs.promises.mkdir(path.dirname(CONTRACT_INDEX_PATH), {
    recursive: true,
  });
  await fs.promises.writeFile(
    CONTRACT_INDEX_PATH,
    JSON.stringify(index),
    "utf8",
  );
}

async function loadPersistedContractIndex() {
  if (!fs.existsSync(CONTRACT_INDEX_PATH)) return null;

  const rawIndex = await fs.promises.readFile(CONTRACT_INDEX_PATH, "utf8");
  const parsedIndex = JSON.parse(rawIndex) as ContractIndex;

  // Basic integrity: chunk array must match declared count
  if (
    !parsedIndex.chunks ||
    parsedIndex.chunks.length !== parsedIndex.chunkCount
  ) {
    console.error(
      "[contract-chat] Index integrity error: chunk count mismatch",
    );
    return null;
  }

  // If index declares hasEmbeddings, verify actual coverage
  if (parsedIndex.hasEmbeddings) {
    const embCount = parsedIndex.chunks.filter(
      (c) => c.embedding && c.embedding.length > 0,
    ).length;
    if (embCount < parsedIndex.chunkCount * 0.9) {
      console.error(
        `[contract-chat] Index integrity error: hasEmbeddings=true but only ${embCount}/${parsedIndex.chunkCount} have embeddings`,
      );
      return null;
    }
  }

  if (fs.existsSync(CONTRACT_PATH)) {
    const contractStats = await fs.promises.stat(CONTRACT_PATH);
    if (parsedIndex.sourceMtimeMs !== contractStats.mtimeMs) {
      const relocatedSemanticIndex =
        path.basename(parsedIndex.contractPath) === CONTRACT_FILENAME &&
        path.resolve(parsedIndex.contractPath) !==
          path.resolve(CONTRACT_PATH) &&
        parsedIndex.hasEmbeddings &&
        parsedIndex.chunks.filter((chunk) => chunk.embedding?.length).length >=
          parsedIndex.chunkCount * 0.9;
      if (!relocatedSemanticIndex) return null;

      return {
        ...parsedIndex,
        contractPath: CONTRACT_PATH,
        sourceMtimeMs: contractStats.mtimeMs,
      };
    }
  }

  return parsedIndex;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getContractChatStatus(): Promise<ContractChatStatus> {
  const pdfExists = fs.existsSync(CONTRACT_PATH);
  const pdfStats = pdfExists ? await fs.promises.stat(CONTRACT_PATH) : null;
  const indexExists = fs.existsSync(CONTRACT_INDEX_PATH);
  const status: ContractChatStatus = {
    pdf: {
      exists: pdfExists,
      fileName: CONTRACT_FILENAME,
      path: CONTRACT_PATH,
      mtimeMs: pdfStats?.mtimeMs,
    },
    index: { exists: indexExists, fresh: false },
    llm: {
      provider: "groq",
      configured: Boolean(getGroqApiKey()),
      model: getGroqModel(),
    },
    ready: false,
  };

  if (!indexExists) return status;

  try {
    const rawIndex = await fs.promises.readFile(CONTRACT_INDEX_PATH, "utf8");
    const parsedIndex = JSON.parse(rawIndex) as ContractIndex;
    const relocatedSemanticIndex = Boolean(
      pdfStats &&
      path.basename(parsedIndex.contractPath) === CONTRACT_FILENAME &&
      path.resolve(parsedIndex.contractPath) !== path.resolve(CONTRACT_PATH) &&
      parsedIndex.hasEmbeddings &&
      parsedIndex.chunks.filter((chunk) => chunk.embedding?.length).length >=
        parsedIndex.chunkCount * 0.9,
    );
    const fresh = Boolean(
      pdfStats &&
      (parsedIndex.sourceMtimeMs === pdfStats.mtimeMs ||
        relocatedSemanticIndex),
    );

    status.index = {
      exists: true,
      fresh,
      builtAt: parsedIndex.builtAt,
      pageCount: parsedIndex.pageCount,
      chunkCount: parsedIndex.chunkCount,
      vocabularySize: parsedIndex.vocabularySize,
      hasEmbeddings: parsedIndex.hasEmbeddings,
      sourceMtimeMs: parsedIndex.sourceMtimeMs,
    };
    status.ready = pdfExists && fresh && parsedIndex.chunkCount > 0;
  } catch (error) {
    status.index = {
      exists: true,
      fresh: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return status;
}

export async function getContractIndex() {
  if (!contractIndexPromise) {
    contractIndexPromise = (async () => {
      const persistedIndex = await loadPersistedContractIndex();
      if (persistedIndex) return persistedIndex;

      const rebuiltIndex = await buildContractIndex();
      await saveContractIndex(rebuiltIndex);
      return rebuiltIndex;
    })();
  }
  return contractIndexPromise;
}

export async function rebuildContractIndex() {
  const rebuiltIndex = await buildContractIndex();
  await saveContractIndex(rebuiltIndex);
  contractIndexPromise = Promise.resolve(rebuiltIndex);
  return rebuiltIndex;
}

export async function answerContractQuestion(
  query: string,
  conversationHistory: ChatMessage[] = [],
): Promise<ContractChatAnswer> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) throw new Error("QUERY_REQUIRED");

  const index = await getContractIndex();
  const tokens = tokenizeQuery(trimmedQuery);
  const normalizedQuery = normalizeText(trimmedQuery);

  if (isConversationalPrompt(normalizedQuery, tokens)) {
    return {
      answer: buildConversationalAnswer(),
      query: trimmedQuery,
      generatedAt: new Date().toISOString(),
      sourceCount: 0,
      answerMode: "extractive",
      sources: [],
      diagnostics: {
        contractPath: index.contractPath,
        pageCount: index.pageCount,
        chunkCount: index.chunkCount,
        usedGroq: false,
        searchMode: "keyword",
      },
    };
  }

  const retrieval = await searchContractSources(
    trimmedQuery,
    conversationHistory,
  );
  const rankedSources = retrieval.sources;

  if (retrieval.structureAnswer) {
    return {
      answer: retrieval.structureAnswer,
      query: trimmedQuery,
      generatedAt: new Date().toISOString(),
      sourceCount: 0,
      answerMode: "extractive",
      sources: [],
      diagnostics: {
        contractPath: index.contractPath,
        pageCount: index.pageCount,
        chunkCount: index.chunkCount,
        usedGroq: false,
        searchMode: index.hasEmbeddings ? "hybrid" : "keyword",
      },
    };
  }

  // Build structured evidence pack and answer plan
  const evidencePack = buildEvidencePack(
    trimmedQuery,
    retrieval.trace?.contextualizedQuery || trimmedQuery,
    rankedSources,
    conversationHistory,
    retrieval.trace,
  );
  const answerPlan = buildAnswerPlan(evidencePack);

  // Thematic incompatibility: retrieval returned sources but they don't match the query domain
  const thematicAbstain =
    retrieval.trace?.sufficiency.status === "insufficient" &&
    checkThematicCompatibility(trimmedQuery, rankedSources).compatible ===
      false;

  // If plan says abstain OR thematic check fails, return early
  if (answerPlan.needsAbstention || thematicAbstain) {
    return {
      answer:
        answerPlan.abstentionReason ||
        "No encontré información relevante sobre eso en el contrato. Estoy para consultas del contrato colectivo IMSS-SNTSS.",
      query: trimmedQuery,
      generatedAt: new Date().toISOString(),
      sourceCount: 0,
      answerMode: "extractive",
      sources: [],
      diagnostics: {
        contractPath: index.contractPath,
        pageCount: index.pageCount,
        chunkCount: index.chunkCount,
        usedGroq: false,
        searchMode: index.hasEmbeddings ? "hybrid" : "keyword",
      },
    };
  }

  let answer = buildPlannedAnswerText(rankedSources, answerPlan, evidencePack);
  let answerMode: ContractChatAnswer["answerMode"] = "extractive";
  let groqModel: string | undefined;
  let usedGroq = false;
  const searchMode = index.hasEmbeddings ? "hybrid" : "keyword";

  try {
    const groqResponse = await generateGroqAnswer(
      trimmedQuery,
      rankedSources,
      conversationHistory,
      retrieval.tabuladorContext,
      answerPlan,
    );
    if (groqResponse) {
      answer = groqResponse.content;
      answerMode = "groq";
      groqModel = groqResponse.model;
      usedGroq = true;
    }
  } catch (error) {
    console.error("Groq no disponible, usando fallback extractivo:", error);
  }

  return {
    answer,
    query: trimmedQuery,
    generatedAt: new Date().toISOString(),
    sourceCount: rankedSources.length,
    answerMode,
    sources: rankedSources,
    diagnostics: {
      contractPath: index.contractPath,
      pageCount: index.pageCount,
      chunkCount: index.chunkCount,
      model: groqModel,
      usedGroq,
      searchMode,
    },
  };
}
