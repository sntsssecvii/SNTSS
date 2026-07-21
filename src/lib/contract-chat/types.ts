export type DocumentType =
  | "contrato"
  | "transitorias"
  | "reglamento"
  | "convenio"
  | "tabulador"
  | "profesiograma"
  | "indice";

export type ContentType =
  | "normative"
  | "definition"
  | "requirement"
  | "procedure"
  | "table"
  | "administrative"
  | "signatures"
  | "index";

export interface ContractChunk {
  id: string;
  pageNumber: number;
  clauseNumber?: number;
  clauseTitle?: string;
  chapterTitle?: string;
  articleNumber?: number;
  articleTitle?: string;
  sectionTitle?: string;
  sectionNumber?: number;
  documentType?: DocumentType;
  contentType?: ContentType;
  text: string;
  normalizedText: string;
  tokenCounts: Record<string, number>;
  embedding?: number[];
}

export interface ContractIndex {
  contractPath: string;
  sourceMtimeMs: number;
  builtAt: string;
  pageCount: number;
  chunkCount: number;
  vocabularySize: number;
  documentFrequencies: Record<string, number>;
  chunks: ContractChunk[];
  hasEmbeddings: boolean;
  // Manifest (schema v2+)
  schemaVersion?: number;
  documentVersion?: string;
  sourceHash?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  chunksWithEmbeddings?: number;
  metadataEnriched?: boolean;
  status?: "candidate" | "validated" | "active" | "backup";
}

export interface ContractSearchResult {
  chunk: ContractChunk;
  score: number;
  semanticScore: number;
  keywordScore: number;
  matchedTerms: string[];
  excerpt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ContractRetrievalTraceItem {
  chunkId: string;
  pageNumber: number;
  clauseNumber?: number;
  score: number;
  semanticScore: number;
  keywordScore: number;
  matchedTerms: string[];
  excerpt: string;
}

export interface ContractRetrievalTrace {
  traceId: string;
  createdAt: string;
  originalQuery: string;
  contextualizedQuery: string;
  contextualizationMode: "none" | "llm" | "fallback";
  retrievalQueries: string[];
  candidates: ContractRetrievalTraceItem[];
  selected: ContractRetrievalTraceItem[];
  evidence: ContractRetrievalTraceItem[];
  sufficiency: {
    status: "sufficient" | "insufficient";
    reason: string;
    topScore: number;
    evidenceCount: number;
  };
}

export interface ContractChatAnswer {
  answer: string;
  query: string;
  generatedAt: string;
  sourceCount: number;
  answerMode: "extractive" | "groq";
  sources: ContractSearchResult[];
  diagnostics: {
    contractPath: string;
    pageCount: number;
    chunkCount: number;
    model?: string;
    usedGroq: boolean;
    searchMode: "hybrid" | "keyword" | "semantic";
  };
}

// ---------------------------------------------------------------------------
// EvidencePack — structured pre-generation context
// ---------------------------------------------------------------------------

export interface EvidencePack {
  originalQuery: string;
  contextualizedQuery: string;
  intent: string;
  userFacts: string[];
  missingFacts: string[];
  sources: Array<{
    text: string;
    pageNumber: number;
    clauseNumber?: number;
    articleNumber?: number;
    sectionTitle?: string;
    contentType?: ContentType;
  }>;
  clauses: number[];
  articles: Array<{ number: number; section: string }>;
  tables: string[];
  exceptions: string[];
  contradictions: string[];
  sufficiency: "sufficient" | "insufficient";
  confidenceLevel: "high" | "medium" | "low";
}

// ---------------------------------------------------------------------------
// AnswerPlan — structured generation plan
// ---------------------------------------------------------------------------

export interface AnswerPlan {
  directAnswerPossible: boolean;
  dataThatMustBeRequested: string[];
  allowedClaims: string[];
  forbiddenClaims: string[];
  requiredSources: Array<{ page: number; clause?: number; article?: number }>;
  needsCombiningSources: boolean;
  needsAbstention: boolean;
  abstentionReason?: string;
  recommendedFormat:
    "direct" | "comparison" | "list" | "decision-tree" | "abstention";
}

export interface ContractChatStatus {
  pdf: {
    exists: boolean;
    fileName: string;
    path: string;
    mtimeMs?: number;
  };
  index: {
    exists: boolean;
    fresh: boolean;
    builtAt?: string;
    pageCount?: number;
    chunkCount?: number;
    vocabularySize?: number;
    hasEmbeddings?: boolean;
    sourceMtimeMs?: number;
    error?: string;
  };
  llm: {
    provider: "groq";
    configured: boolean;
    model: string;
  };
  ready: boolean;
}
