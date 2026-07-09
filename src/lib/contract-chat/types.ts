export interface ContractChunk {
  id: string;
  pageNumber: number;
  clauseNumber?: number;
  clauseTitle?: string;
  chapterTitle?: string;
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
