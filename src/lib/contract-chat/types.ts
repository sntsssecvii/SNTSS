export interface ContractChunk {
  id: string
  pageNumber: number
  text: string
  normalizedText: string
  tokenCounts: Record<string, number>
}

export interface ContractIndex {
  contractPath: string
  sourceMtimeMs: number
  builtAt: string
  pageCount: number
  chunkCount: number
  vocabularySize: number
  documentFrequencies: Record<string, number>
  chunks: ContractChunk[]
}

export interface ContractSearchResult {
  chunk: ContractChunk
  score: number
  matchedTerms: string[]
  excerpt: string
}

export interface ContractChatAnswer {
  answer: string
  query: string
  generatedAt: string
  sourceCount: number
  answerMode: 'extractive' | 'groq'
  sources: ContractSearchResult[]
  diagnostics: {
    contractPath: string
    pageCount: number
    chunkCount: number
    model?: string
    usedGroq: boolean
  }
}
