import fs from "fs";
import path from "path";

import {
  PRESTACIONES_EMB_PATH,
  PRESTACIONES_PATH,
  PRESTACION_SEMANTIC_GAP,
  PRESTACION_SEMANTIC_THRESHOLD,
  TABULADOR_PATH,
} from "@/lib/contract-chat/constants";
import { cosineSimilarity } from "@/lib/contract-chat/embeddings";
import { generateQueryEmbedding } from "@/lib/contract-chat/embeddings";
import { normalizeText } from "@/lib/contract-chat/query-processing";

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

export function buildTabuladorContext(query: string): string | null {
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

export function buildPrestacionesContext(
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

export async function faqSemanticSearch(
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
