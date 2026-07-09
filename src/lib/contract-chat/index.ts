import { spawn } from "child_process";
import fs from "fs";
import path from "path";

import type {
  ChatMessage,
  ContractChatAnswer,
  ContractChatStatus,
  ContractChunk,
  ContractIndex,
  ContractSearchResult,
} from "@/lib/contract-chat/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTRACT_FILENAME = "contrato-colectivo-de-trabajo-2025-2027.pdf";
const CONTRACT_PATH = path.join(process.cwd(), "artifacts", CONTRACT_FILENAME);
const LOCAL_PYTHON_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "pdf",
  "extractors",
  "venv",
  "bin",
  "python3",
);
const CONTRACT_INDEX_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "contract-index-data.json",
);

const PRESTACIONES_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "prestaciones-data.json",
);
const FAQ_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "contract-faqs.json",
);
const TABULADOR_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "tabulador-sueldos.json",
);

const TARGET_CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const JINA_EMBEDDING_MODEL = "jina-embeddings-v3";
const JINA_BATCH_SIZE = 100;
const MAX_CONVERSATION_HISTORY = 10;

// Weights for hybrid search — semantic dominates to avoid keyword false positives
const SEMANTIC_WEIGHT = 0.8;
const KEYWORD_WEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Stopwords & expansions
// ---------------------------------------------------------------------------

const SPANISH_STOPWORDS = new Set([
  "al",
  "ante",
  "bajo",
  "cabe",
  "con",
  "contra",
  "contrato",
  "colectivo",
  "de",
  "del",
  "desde",
  "dice",
  "durante",
  "el",
  "ella",
  "ellas",
  "ellos",
  "en",
  "entre",
  "era",
  "eramos",
  "es",
  "esa",
  "ese",
  "eso",
  "esta",
  "este",
  "esto",
  "fue",
  "ha",
  "hacia",
  "hasta",
  "la",
  "las",
  "le",
  "les",
  "lo",
  "los",
  "mas",
  "mi",
  "mis",
  "muy",
  "o",
  "para",
  "parte",
  "pero",
  "por",
  "pregunta",
  "que",
  "se",
  "segun",
  "ser",
  "si",
  "sin",
  "sobre",
  "su",
  "sus",
  "te",
  "tu",
  "tus",
  "trabajo",
  "un",
  "una",
  "uno",
  "unos",
  "unas",
  "y",
  "ya",
]);

const INDEX_MARKERS = ["indice", "tabla de contenido", "contenido"];

const QUERY_EXPANSIONS: Record<string, string[]> = {
  aguinaldo: ["aguinaldo", "gratificacion"],
  antigüedad: ["antiguedad", "antiguedad", "anos", "servicio"],
  becas: ["becas", "beca", "estudios", "capacitacion"],
  cambio: ["cambio", "cambios", "traslado", "adscripcion"],
  confianza: ["confianza", "trabajador", "base"],
  descanso: ["vacaciones", "descanso", "descansos"],
  descansos: ["vacaciones", "descanso", "descansos"],
  despido: ["despido", "rescision", "separacion", "cese"],
  economico: ["permisos", "economicos", "licencias"],
  economicos: ["permisos", "economicos", "licencias"],
  embarazo: ["maternidad", "embarazo", "lactancia", "guarderia"],
  enfermedad: ["enfermedad", "incapacidad", "medica", "profesional"],
  escalafon: ["escalafon", "promocion", "promociones", "puesto", "puestos"],
  guarderia: ["guarderia", "guarderias", "infantil", "hijos"],
  habitacion: ["habitacion", "vivienda", "prestamo", "hipotecario", "fomento"],
  horario: ["horario", "jornada", "turno", "turnos"],
  incapacidades: ["incapacidad", "licencias", "medica"],
  incapacidad: ["incapacidad", "licencias", "medica"],
  jornada: ["jornada", "horario", "turno", "horas"],
  jubilar: ["jubilacion", "jubilaciones", "pensiones"],
  jubilacion: ["jubilacion", "jubilaciones", "pensiones", "retiro"],
  jubilaciones: ["jubilacion", "jubilaciones", "pensiones"],
  lentes: ["anteojos", "lentes", "optica"],
  licencia: ["licencia", "licencias", "permisos"],
  licencias: ["licencia", "licencias", "permisos"],
  maternidad: ["maternidad", "embarazo", "lactancia", "parto"],
  nivelacion: [
    "nivelacion",
    "calificacion",
    "calificaciones",
    "antiguedad",
    "escalafon",
  ],
  pension: ["pension", "pensiones", "jubilacion"],
  pensiones: ["pension", "pensiones", "jubilacion"],
  permiso: ["permiso", "permisos", "licencias"],
  permisos: ["permiso", "permisos", "licencias"],
  prestamo: ["prestamo", "prestamos", "credito", "hipotecario"],
  promocion: ["promocion", "promociones", "escalafon"],
  promociones: ["promocion", "promociones", "escalafon"],
  rescision: ["rescision", "despido", "separacion"],
  ropa: ["ropa", "uniforme", "uniformes", "vestuario"],
  salario: ["salario", "salarios", "sueldo", "sueldos", "pago", "tabulador"],
  sueldo: ["salario", "salarios", "sueldo", "sueldos", "pago"],
  sueldos: ["salario", "salarios", "sueldo", "sueldos", "pago"],
  turno: ["turno", "turnos", "jornada", "horario"],
  vacacion: ["vacaciones", "vacacionales"],
  vacaciones: ["vacaciones", "vacacionales", "descanso"],
  vacacional: ["vacaciones", "vacacionales"],
  vacacionales: ["vacaciones", "vacacionales"],
  vivienda: ["vivienda", "habitacion", "prestamo", "hipotecario"],
};

const CONVERSATIONAL_PATTERNS = [
  /\b(hola|buenos dias|buenas tardes|buenas noches|hey|ayuda)\b/,
  /\b(que puedes hacer|como funcionas|como te uso|en que me ayudas)\b/,
  /\b(gracias|ok|vale|entendido|perfecto)\b/,
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let contractIndexPromise: Promise<ContractIndex> | null = null;

interface ExtractedPage {
  pageNumber: number;
  text: string;
}

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(query: string) {
  const normalizedQuery = normalizeText(query);
  const baseTokens = tokenizeNormalizedText(normalizedQuery);
  const expandedTokens = baseTokens.flatMap((token) => [
    token,
    ...(QUERY_EXPANSIONS[token] || []),
  ]);
  return Array.from(new Set(expandedTokens));
}

function tokenizeNormalizedText(value: string) {
  return value
    .split(" ")
    .filter((token) => token.length >= 3 && !SPANISH_STOPWORDS.has(token));
}

function countTokens(value: string) {
  return tokenizeNormalizedText(value).reduce<Record<string, number>>(
    (accumulator, token) => {
      accumulator[token] = (accumulator[token] || 0) + 1;
      return accumulator;
    },
    {},
  );
}

// ---------------------------------------------------------------------------
// Smart chunking — split by clause/article boundaries
// ---------------------------------------------------------------------------

const CLAUSE_REGEX = /^Cláusula\s+(\d+(?:\s*Bis)?)\s*[\.\-–]\s*(.+)/im;
const CHAPTER_REGEX = /^Capítulo\s+([IVXLC]+(?:\.\d+)?)\s*[\.\-–]\s*(.+)/im;

interface RawSection {
  clauseNumber?: number;
  clauseTitle?: string;
  chapterTitle?: string;
  pageNumber: number;
  text: string;
}

function splitPagesIntoSections(pages: ExtractedPage[]): RawSection[] {
  const sections: RawSection[] = [];
  let currentChapter = "";
  let currentClause: { number?: number; title?: string } = {};
  let currentText = "";
  let currentPage = 1;

  function flushSection() {
    const trimmed = currentText.trim();
    if (trimmed.length > 30) {
      sections.push({
        clauseNumber: currentClause.number,
        clauseTitle: currentClause.title,
        chapterTitle: currentChapter || undefined,
        pageNumber: currentPage,
        text: trimmed,
      });
    }
    currentText = "";
  }

  for (const page of pages) {
    const lines = page.text.split(/\r?\n/);

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Skip header/footer noise
      if (/^CONTRATO COLECTIVO DE TRABAJO$/i.test(trimmedLine)) continue;
      if (/^(Índice|Contenido|A-Z)\s*$/i.test(trimmedLine)) continue;
      if (/^\d+$/.test(trimmedLine)) continue; // page numbers

      const chapterMatch = trimmedLine.match(CHAPTER_REGEX);
      if (chapterMatch) {
        flushSection();
        currentChapter = `Capítulo ${chapterMatch[1]}.- ${chapterMatch[2]}`;
        currentPage = page.pageNumber;
        continue;
      }

      const clauseMatch = trimmedLine.match(CLAUSE_REGEX);
      if (clauseMatch) {
        flushSection();
        const num = parseInt(clauseMatch[1], 10);
        currentClause = {
          number: Number.isFinite(num) ? num : undefined,
          title: clauseMatch[2].trim(),
        };
        currentPage = page.pageNumber;
        currentText = trimmedLine + "\n";
        continue;
      }

      currentText += trimmedLine + "\n";
      if (!currentClause.number) {
        currentPage = page.pageNumber;
      }
    }
  }

  flushSection();
  return sections;
}

const TABULAR_PATTERNS = [
  /tabulador de sueldos/i,
  /sueldo\s+hora-mes/i,
  /jor-?\s*nada\s+hora/i,
  /mes-pesos/i,
  /profesiogramas?\s+categor/i,
];

function isTabularContent(text: string): boolean {
  return TABULAR_PATTERNS.some((p) => p.test(text));
}

function splitSectionIntoChunks(
  section: RawSection,
): Omit<ContractChunk, "normalizedText" | "tokenCounts">[] {
  const text = section.text.replace(/\s+/g, " ").trim();

  // Tabular content (tabuladores, profesiogramas index) — use larger chunks to avoid cutting tables
  const maxSize = isTabularContent(text) ? 2400 : TARGET_CHUNK_SIZE;

  if (text.length <= maxSize) {
    return [
      {
        id: section.clauseNumber
          ? `clause-${section.clauseNumber}-chunk-1`
          : `page-${section.pageNumber}-chunk-1`,
        pageNumber: section.pageNumber,
        clauseNumber: section.clauseNumber,
        clauseTitle: section.clauseTitle,
        chapterTitle: section.chapterTitle,
        text,
      },
    ];
  }

  const chunks: Omit<ContractChunk, "normalizedText" | "tokenCounts">[] = [];
  let start = 0;
  let chunkIndex = 1;

  while (start < text.length) {
    let end = Math.min(start + maxSize, text.length);
    if (end < text.length) {
      const breakPoint = text.lastIndexOf(". ", end);
      if (breakPoint > start + 300) {
        end = breakPoint + 1;
      }
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 20) {
      // Prepend clause context to each chunk for better retrieval
      const prefix = section.clauseNumber
        ? `Cláusula ${section.clauseNumber}.- ${section.clauseTitle || ""}: `
        : "";
      const fullText =
        chunkIndex > 1 && prefix ? prefix + chunkText : chunkText;

      chunks.push({
        id: section.clauseNumber
          ? `clause-${section.clauseNumber}-chunk-${chunkIndex}`
          : `page-${section.pageNumber}-chunk-${chunkIndex}`,
        pageNumber: section.pageNumber,
        clauseNumber: section.clauseNumber,
        clauseTitle: section.clauseTitle,
        chapterTitle: section.chapterTitle,
        text: fullText,
      });
      chunkIndex++;
    }

    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Embeddings — Jina AI (jina-embeddings-v3)
// ---------------------------------------------------------------------------

function getJinaApiKey() {
  return (
    process.env.JINA_API_KEY ||
    readLocalEnvValue(path.join(process.cwd(), ".env.local"), "JINA_API_KEY") ||
    null
  );
}

async function jinaEmbed(
  texts: string[],
  task: "retrieval.passage" | "retrieval.query",
  apiKey: string,
): Promise<number[][]> {
  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JINA_EMBEDDING_MODEL,
      input: texts,
      task,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jina HTTP ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return payload.data.map((d) => d.embedding);
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = getJinaApiKey();
  if (!apiKey) {
    throw new Error(
      "JINA_API_KEY no configurada. Se requiere para generar embeddings.",
    );
  }

  const allEmbeddings: number[][] = [];
  const totalBatches = Math.ceil(texts.length / JINA_BATCH_SIZE);

  for (let i = 0; i < texts.length; i += JINA_BATCH_SIZE) {
    const batch = texts.slice(i, i + JINA_BATCH_SIZE);
    const batchNum = Math.floor(i / JINA_BATCH_SIZE) + 1;

    const embeddings = await jinaEmbed(batch, "retrieval.passage", apiKey);
    allEmbeddings.push(...embeddings);

    if (batchNum % 5 === 0 || batchNum === totalBatches) {
      console.log(`  Embeddings: ${batchNum}/${totalBatches} batches`);
    }
  }

  return allEmbeddings;
}

async function generateQueryEmbedding(query: string): Promise<number[]> {
  const apiKey = getJinaApiKey();
  if (!apiKey) return [];

  const [embedding] = await jinaEmbed([query], "retrieval.query", apiKey);
  return embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Excerpt creation
// ---------------------------------------------------------------------------

function createExcerpt(text: string, tokens: string[]) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return text.slice(0, 300).trim();

  const ranked = sentences
    .map((sentence) => {
      const norm = normalizeText(sentence);
      const score = tokens.reduce(
        (sum, t) => sum + (norm.includes(t) ? 1 : 0),
        0,
      );
      return { sentence, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected = ranked
    .filter((r) => r.score > 0)
    .slice(0, 2)
    .map((r) => r.sentence);

  return selected.length > 0
    ? selected.join(" ")
    : sentences.slice(0, 2).join(" ");
}

// ---------------------------------------------------------------------------
// Keyword scoring (TF-IDF)
// ---------------------------------------------------------------------------

function scoreChunkKeywords(
  chunk: ContractChunk,
  index: ContractIndex,
  normalizedQuery: string,
  tokens: string[],
  pageHints: number[],
) {
  let score = 0;
  const matchedTerms: string[] = [];
  const isIndexChunk = INDEX_MARKERS.some((m) =>
    chunk.normalizedText.includes(m),
  );

  if (normalizedQuery && chunk.normalizedText.includes(normalizedQuery)) {
    score += 15;
  }

  if (pageHints.includes(chunk.pageNumber)) {
    score += 20;
  }

  const chunkTokenTotal =
    Object.values(chunk.tokenCounts).reduce((sum, c) => sum + c, 0) || 1;

  for (const token of tokens) {
    const occurrences = chunk.tokenCounts[token] || 0;
    if (occurrences === 0) continue;
    const df = index.documentFrequencies[token] || 1;
    const idf = Math.log((index.chunkCount + 1) / df);
    const tf = occurrences / chunkTokenTotal;
    score += tf * idf * 100;
    matchedTerms.push(token);
  }

  if (chunk.normalizedText.startsWith(normalizedQuery)) {
    score += 6;
  }

  if (tokens.length > 0 && matchedTerms.length === 0) {
    score = 0;
  }

  if (isIndexChunk) {
    score = Math.max(0, score - 10);
  }

  return { score, matchedTerms: Array.from(new Set(matchedTerms)) };
}

// ---------------------------------------------------------------------------
// Hybrid search
// ---------------------------------------------------------------------------

async function hybridSearch(
  query: string,
  index: ContractIndex,
  topK: number = 8,
): Promise<ContractSearchResult[]> {
  const normalizedQuery = normalizeText(query);
  const tokens = tokenizeQuery(query);
  const pageHints = extractPageHints(query);

  // Keyword scores
  const keywordResults = index.chunks.map((chunk) => {
    const { score, matchedTerms } = scoreChunkKeywords(
      chunk,
      index,
      normalizedQuery,
      tokens,
      pageHints,
    );
    return { chunk, keywordScore: score, matchedTerms };
  });

  // Normalize keyword scores to 0-1
  const maxKeyword = Math.max(...keywordResults.map((r) => r.keywordScore), 1);

  // Semantic scores
  let queryEmbedding: number[] = [];
  const embeddingCount = index.chunks.filter((c) => c.embedding?.length).length;
  let hasEmbeddings = index.hasEmbeddings && embeddingCount > 0;

  if (hasEmbeddings) {
    try {
      queryEmbedding = await generateQueryEmbedding(query);
    } catch (error) {
      console.error(
        "Error generando embedding de query, usando solo keyword:",
        error,
      );
      hasEmbeddings = false;
    }
  }

  const results: ContractSearchResult[] = keywordResults.map((kr) => {
    const semanticScore =
      hasEmbeddings && queryEmbedding.length > 0 && kr.chunk.embedding?.length
        ? cosineSimilarity(queryEmbedding, kr.chunk.embedding)
        : 0;

    const normalizedKeyword = kr.keywordScore / maxKeyword;

    const combinedScore = hasEmbeddings
      ? SEMANTIC_WEIGHT * semanticScore + KEYWORD_WEIGHT * normalizedKeyword
      : normalizedKeyword;

    return {
      chunk: kr.chunk,
      score: combinedScore,
      semanticScore,
      keywordScore: kr.keywordScore,
      matchedTerms: kr.matchedTerms,
      excerpt: createExcerpt(kr.chunk.text, tokens),
    };
  });

  return results
    .filter((r) => r.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ---------------------------------------------------------------------------
// Conversational detection
// ---------------------------------------------------------------------------

function isConversationalPrompt(normalizedQuery: string, tokens: string[]) {
  if (tokens.length === 0) return true;
  return CONVERSATIONAL_PATTERNS.some((p) => p.test(normalizedQuery));
}

function buildConversationalAnswer() {
  return [
    "Soy tu asistente del contrato colectivo IMSS-SNTSS 2025-2027.",
    "",
    "Puedes preguntarme cosas como:",
    "- ¿Cuántos días de vacaciones me tocan con 5 años de antigüedad?",
    "- ¿Qué dice sobre permisos económicos?",
    "- ¿Cuáles son los requisitos para jubilación?",
    "- ¿Qué cláusula habla de guarderías?",
    "- ¿Qué prestamos de vivienda hay?",
    "",
    "Pregunta lo que necesites — te respondo directo con las páginas exactas del contrato.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// LLM — Groq (Llama 3.3 70B)
// ---------------------------------------------------------------------------

function readLocalEnvValue(filePath: string, key: string) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!trimmed.startsWith(`${key}=`)) continue;
    return trimmed.slice(key.length + 1).trim();
  }
  return null;
}

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

const SYSTEM_PROMPT = `Eres el asistente virtual del contrato colectivo de trabajo IMSS-SNTSS 2025-2027. Tu rol es ayudar a trabajadores sindicalizados a entender sus derechos y prestaciones.

REGLAS ABSOLUTAS — ROMPER CUALQUIERA ES INACEPTABLE:
1. Responde ÚNICAMENTE con información que aparezca TEXTUALMENTE en las fuentes proporcionadas abajo. Si no está en las fuentes, di "No encontré esa información en las cláusulas que tengo disponibles."
2. JAMÁS inventes números de cláusula, páginas, montos, plazos, porcentajes ni requisitos. Si no aparece el dato exacto en las fuentes, NO lo menciones.
3. Los números de cláusula y página SOLO puedes tomarlos de los campos "Ubicación" y "Página" de cada fuente. NUNCA generes un número de cláusula o página que no esté explícitamente en las fuentes.
4. Cuando cites, usa EXACTAMENTE el número de cláusula y página de la fuente. Ejemplo: si la fuente dice "Cláusula 81 | Página 53", cita así: (Cláusula 81, p. 53).
5. Si las fuentes tienen información parcial, dilo honestamente: "Las fuentes que recuperé mencionan X, pero no incluyen el detalle completo."

SOBRE SALARIOS:
- Cuando menciones sueldos del tabulador, SIEMPRE aclara que es el "sueldo base tabular".
- Si hay sobresueldos o compensaciones adicionales en las fuentes (como el 31% de enfermería), calcula el sueldo real y muéstralo: "Sueldo base: $X + 31% sobresueldo = $Y real".
- Recuerda que además del sueldo base hay prestaciones: aguinaldo, fondo de ahorro, vales, etc.

ESTILO:
- Español claro, directo y conversacional — como un asesor sindical con paciencia.
- Frases cortas. No repitas la pregunta del usuario.
- NO empieces con "Según el contrato colectivo..." ni frases genéricas. Ve directo al grano.
- Estructura respuestas largas con bullets.
- Si el usuario pregunta algo de seguimiento, usa el contexto de la conversación para dar respuestas coherentes. NO repitas datos que ya diste — responde lo que se preguntó.
- Máximo 8-10 líneas útiles a menos que pida más detalle.
- Al final de tu respuesta, lista las páginas de referencia en formato: "Páginas de referencia: p. X, p. Y"`;

async function generateGroqAnswer(
  query: string,
  sources: ContractSearchResult[],
  conversationHistory: ChatMessage[],
) {
  const apiKey = getGroqApiKey();
  if (!apiKey || sources.length === 0) return null;

  const model = getGroqModel();
  const messages = buildGroqMessages(query, sources, conversationHistory);

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
        temperature: 0.15,
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
): Array<{ role: string; content: string }> {
  const context = sources
    .slice(0, 4)
    .map((source, i) => {
      const clauseInfo = source.chunk.clauseNumber
        ? `Cláusula ${source.chunk.clauseNumber}${source.chunk.clauseTitle ? ` - ${source.chunk.clauseTitle}` : ""}`
        : `Sección general`;
      const chapterInfo = source.chunk.chapterTitle
        ? ` | ${source.chunk.chapterTitle}`
        : "";
      return [
        `--- Fuente ${i + 1} ---`,
        `Ubicación: ${clauseInfo}${chapterInfo} | Página ${source.chunk.pageNumber}`,
        `Texto: ${source.chunk.text.slice(0, 600)}`,
      ].join("\n");
    })
    .join("\n\n");

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  const recentHistory = conversationHistory.slice(-MAX_CONVERSATION_HISTORY);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  const validPages = Array.from(
    new Set(sources.slice(0, 4).map((s) => s.chunk.pageNumber)),
  ).sort((a, b) => a - b);
  const validClauses = sources
    .slice(0, 4)
    .filter((s) => s.chunk.clauseNumber)
    .map((s) => `Cláusula ${s.chunk.clauseNumber} (p. ${s.chunk.pageNumber})`)
    .filter((v, i, a) => a.indexOf(v) === i);

  messages.push({
    role: "user",
    content: [
      `Pregunta: ${query}`,
      "",
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
      "IMPORTANTE: NO cites ninguna página o cláusula que no esté en las listas anteriores. Los datos del tabulador de sueldos son EXACTOS — cítalos textualmente.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return messages;
}

// Common IMSS abbreviations and typo corrections — no LLM call needed
const ABBREVIATIONS: Record<string, string> = {
  auo: "auxiliar universal de oficinas",
  cst: "coordinador de servicios tecnicos",
  jgst: "jefe de grupo de servicios tecnicos",
  est: "especialista de servicios tecnicos",
  ost: "oficial de servicios tecnicos",
  egc: "enfermera general clinica",
  ejp: "enfermera jefe de piso",
  cct: "contrato colectivo de trabajo",
  imss: "instituto mexicano del seguro social",
  sntss: "sindicato nacional de trabajadores del seguro social",
  rh: "recursos humanos",
  umf: "unidad de medicina familiar",
  hgz: "hospital general de zona",
  umae: "unidad medica de alta especialidad",
};

const TYPO_CORRECTIONS: Record<string, string> = {
  hipotecrio: "hipotecario",
  hipotecria: "hipotecario",
  hipotecarios: "hipotecario",
  jubilacion: "jubilación",
  vacasiones: "vacaciones",
  bacaciones: "vacaciones",
  bacacione: "vacaciones",
  vaciones: "vacaciones",
  vacacione: "vacaciones",
  bacaciónes: "vacaciones",
  prestaiones: "prestaciones",
  prestacioes: "prestaciones",
  escalafn: "escalafón",
  escalafo: "escalafón",
  tabuladro: "tabulador",
  profesiograma: "profesiograma",
  profesiogram: "profesiograma",
  incapaciad: "incapacidad",
  aguinlado: "aguinaldo",
  aguilnaldo: "aguinaldo",
  guareria: "guardería",
  guarderia: "guardería",
  guarderias: "guarderías",
};

function rewriteQueryLocal(query: string): string {
  let result = query.toLowerCase();

  // Expand abbreviations
  for (const [abbr, expansion] of Object.entries(ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    result = result.replace(regex, expansion);
  }

  // Fix common typos
  for (const [typo, correction] of Object.entries(TYPO_CORRECTIONS)) {
    const regex = new RegExp(`\\b${typo}\\b`, "gi");
    result = result.replace(regex, correction);
  }

  return result;
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
  const qTokens = normalized
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length >= 4);

  // Enlaza si el keyword aparece literal, o comparte raíz con un token de la
  // consulta (tolera plural/singular: "estacionamiento" ~ "estacionamientos").
  const matches = (kw: string) =>
    normalized.includes(kw) ||
    qTokens.some((t) => {
      const [short, long] = kw.length <= t.length ? [kw, t] : [t, kw];
      return short.length >= 5 && long.startsWith(short);
    });

  return loadPrestaciones().filter((p) =>
    prestacionKeywords(p).some(matches),
  );
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
const PRESTACIONES_EMB_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "prestaciones-embeddings.json",
);

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

// Umbral de similitud coseno (Jina v3 asimétrico query/passage).
const PRESTACION_SEMANTIC_THRESHOLD = 0.55;

function matchPrestacionesSemantic(
  queryEmbedding: number[] | undefined,
): PrestacionEntry[] {
  if (!queryEmbedding || queryEmbedding.length === 0) return [];
  const embeddings = loadPrestacionesEmbeddings();
  if (!embeddings) return [];

  const byName = new Map(loadPrestaciones().map((p) => [p.nombre, p]));
  return embeddings
    .map((e) => ({
      nombre: e.nombre,
      score: e.embedding?.length
        ? cosineSimilarity(queryEmbedding, e.embedding)
        : 0,
    }))
    .filter((e) => e.score >= PRESTACION_SEMANTIC_THRESHOLD)
    .sort((a, b) => b.score - a.score)
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

export async function searchContractSources(query: string): Promise<{
  sources: ContractSearchResult[];
  isConversational: boolean;
  tabuladorContext?: string;
}> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) throw new Error("QUERY_REQUIRED");

  const index = await getContractIndex();
  const tokens = tokenizeQuery(trimmedQuery);
  const normalizedQuery = normalizeText(trimmedQuery);

  if (isConversationalPrompt(normalizedQuery, tokens)) {
    return { sources: [], isConversational: true };
  }

  // Local query rewriting — typos, abbreviations (no LLM call, saves tokens)
  const rewrittenQuery = rewriteQueryLocal(trimmedQuery);
  const searchQuery =
    rewrittenQuery !== trimmedQuery.toLowerCase()
      ? rewrittenQuery
      : trimmedQuery;

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

  // If rewritten, also search with original and merge
  if (searchQuery !== trimmedQuery) {
    const originalSources = await hybridSearch(trimmedQuery, index, 6);
    const existingIds = new Set(sources.map((s) => s.chunk.id));
    for (const s of originalSources) {
      if (!existingIds.has(s.chunk.id)) {
        sources.push(s);
      }
    }
  }

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
  const reranked = sources.slice(0, 8);

  // Check if structured data is relevant. Prestaciones usa la consulta
  // reescrita (typos/abreviaciones corregidos) para enganchar mejor.
  const tabuladorContext = buildTabuladorContext(trimmedQuery) || undefined;
  const prestacionesContext =
    buildPrestacionesContext(`${trimmedQuery} ${searchQuery}`, queryEmbedding) ||
    undefined;

  // Merge structured contexts
  const structuredContext =
    [tabuladorContext, prestacionesContext].filter(Boolean).join("\n\n") ||
    undefined;

  return {
    sources: reranked.slice(0, 8),
    isConversational: false,
    tabuladorContext: structuredContext,
  };
}

// Simple throttle — Groq free tier has ~6000 TPM org-level limit
let lastGroqCallMs = 0;
const GROQ_MIN_INTERVAL_MS = 4_000; // 4s between calls to stay under TPM

// Round-robin key rotation: alternate keys proactively to spread TPM load
let nextKeyIndex = 0;

// When Groq is unavailable (rate limit u otro fallo), emitimos el fallback
// extractivo con las referencias del contrato en vez de un error crudo.
function enqueueExtractiveFallback(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  sources: ContractSearchResult[],
) {
  const note =
    "⚠️ El asistente de IA está temporalmente saturado (límite de uso). " +
    "Mientras tanto, aquí tienes las referencias directas del contrato:\n\n";
  const body =
    sources.length > 0
      ? note + buildAnswerText(sources)
      : "⚠️ El asistente de IA está temporalmente saturado (límite de uso). Intenta de nuevo en un minuto.";
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
              "Si te preguntan algo que no es del contrato, recuérdale amablemente que estás para consultas del contrato. " +
              "Responde en español, máximo 3-4 líneas.",
          },
          ...conversationHistory.slice(-6).map((m) => ({
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
                temperature: 0.15,
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
                  encoder.encode(
                    `data: ${JSON.stringify({ usage: u })}\n\n`,
                  ),
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
// Extractive fallback answer
// ---------------------------------------------------------------------------

function buildAnswerText(sources: ContractSearchResult[]) {
  if (sources.length === 0) {
    return "No encontré información relevante sobre eso en el contrato. Intenta reformular tu pregunta con términos más específicos — por ejemplo, mencionando la cláusula, prestación o tema concreto que buscas.";
  }

  const topSources = sources.slice(0, 4);
  const lines = topSources.map((s) => {
    const label = s.chunk.clauseNumber
      ? `Cláusula ${s.chunk.clauseNumber}${s.chunk.clauseTitle ? ` (${s.chunk.clauseTitle})` : ""}`
      : `Página ${s.chunk.pageNumber}`;
    return `- ${label}: ${s.excerpt}`;
  });

  return [
    "Encontré estas referencias relevantes en el contrato:",
    "",
    ...lines,
    "",
    `Revisa las páginas ${topSources.map((s) => s.chunk.pageNumber).join(", ")} para el detalle completo.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Page hint extraction
// ---------------------------------------------------------------------------

function extractPageHints(query: string) {
  const matches = query.match(/\b(?:pagina|pag|p)\.?\s*(\d{1,3})\b/gi) || [];
  return matches
    .map((m) => Number(m.replace(/[^\d]/g, "")))
    .filter((v) => Number.isFinite(v) && v > 0);
}

// ---------------------------------------------------------------------------
// PDF extraction
// ---------------------------------------------------------------------------

function getPythonExecutable() {
  return fs.existsSync(LOCAL_PYTHON_PATH) ? LOCAL_PYTHON_PATH : "python3";
}

async function extractPagesFromPdf(pdfPath: string): Promise<ExtractedPage[]> {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import json
import sys
import pdfplumber

pdf_path = sys.argv[1]
pages = []

with pdfplumber.open(pdf_path) as pdf:
    for index, page in enumerate(pdf.pages, start=1):
        text = page.extract_text(layout=True) or page.extract_text() or ""
        pages.append({
            "pageNumber": index,
            "text": text
        })

print(json.dumps({"pages": pages}, ensure_ascii=False))
`.trim();

    const child = spawn(getPythonExecutable(), ["-c", pythonScript, pdfPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python terminó con código ${code}`));
        return;
      }
      try {
        const payload = JSON.parse(stdout) as { pages?: ExtractedPage[] };
        resolve(payload.pages || []);
      } catch (error) {
        reject(
          new Error(
            `No se pudo interpretar la salida del extractor: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });
  });
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

  if (fs.existsSync(CONTRACT_PATH)) {
    const contractStats = await fs.promises.stat(CONTRACT_PATH);
    if (parsedIndex.sourceMtimeMs !== contractStats.mtimeMs) {
      return null;
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
    const fresh = Boolean(
      pdfStats && parsedIndex.sourceMtimeMs === pdfStats.mtimeMs,
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

  // Hybrid search
  const rankedSources = await hybridSearch(trimmedQuery, index, 8);

  let answer = buildAnswerText(rankedSources);
  let answerMode: ContractChatAnswer["answerMode"] = "extractive";
  let groqModel: string | undefined;
  let usedGroq = false;
  const searchMode = index.hasEmbeddings ? "hybrid" : "keyword";

  try {
    const groqResponse = await generateGroqAnswer(
      trimmedQuery,
      rankedSources,
      conversationHistory,
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
