import path from "path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

export const TARGET_CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 120;

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------

export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
export const GROQ_MIN_INTERVAL_MS = 4_000; // 4s between calls to stay under TPM

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export const JINA_EMBEDDING_MODEL = "jina-embeddings-v3";
export const JINA_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Search weights — semantic dominates to avoid keyword false positives
// ---------------------------------------------------------------------------

export const SEMANTIC_WEIGHT = 0.8;
export const KEYWORD_WEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const MAX_CONVERSATION_HISTORY = 10;
export const MAX_CONTEXTUALIZATION_HISTORY = 6;
export const MAX_RETRIEVAL_TRACES = 50;
export const MAX_EVIDENCE_SOURCES = 8;
export const MAX_SELECTED_SOURCES = 12;
export const EVIDENCE_EXPANSION_ANCHORS = 5;
export const EVIDENCE_EXPANSION_RADIUS = 1;

// ---------------------------------------------------------------------------
// Prestaciones semantic matching
// ---------------------------------------------------------------------------

// Umbral mínimo de similitud coseno (Jina v3 asimétrico query/passage). Calibrado
// con casos reales: el match correcto suele ser 0.40–0.57 y dominar al resto.
export const PRESTACION_SEMANTIC_THRESHOLD = 0.38;
// Solo se añaden prestaciones adicionales si quedan MUY cerca del mejor match
// (evita arrastrar prestaciones vagamente relacionadas).
export const PRESTACION_SEMANTIC_GAP = 0.06;
