import type {
  ContractChunk,
  ContractIndex,
  ContractSearchResult,
} from "@/lib/contract-chat/types";
import { KEYWORD_WEIGHT, SEMANTIC_WEIGHT } from "@/lib/contract-chat/constants";
import {
  INDEX_MARKERS,
  normalizeText,
  tokenizeQuery,
} from "@/lib/contract-chat/query-processing";
import {
  cosineSimilarity,
  generateQueryEmbedding,
} from "@/lib/contract-chat/embeddings";
import { extractPageHints } from "@/lib/contract-chat/chunking";

// ---------------------------------------------------------------------------
// Excerpt creation
// ---------------------------------------------------------------------------

export function createExcerpt(text: string, tokens: string[]): string {
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

export function scoreChunkKeywords(
  chunk: ContractChunk,
  index: ContractIndex,
  normalizedQuery: string,
  tokens: string[],
  pageHints: number[],
): { score: number; matchedTerms: string[] } {
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

  // Penalize by contentType metadata when available
  if (chunk.contentType === "index" || chunk.contentType === "signatures") {
    score *= 0.3;
  } else if (chunk.contentType === "administrative") {
    score *= 0.8;
  }

  return { score, matchedTerms: Array.from(new Set(matchedTerms)) };
}

// ---------------------------------------------------------------------------
// Hybrid search
// ---------------------------------------------------------------------------

export async function hybridSearch(
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

    let combinedScore = hasEmbeddings
      ? SEMANTIC_WEIGHT * semanticScore + KEYWORD_WEIGHT * normalizedKeyword
      : normalizedKeyword;

    // Apply contentType penalty to combined score
    if (
      kr.chunk.contentType === "index" ||
      kr.chunk.contentType === "signatures"
    ) {
      combinedScore *= 0.3;
    } else if (kr.chunk.contentType === "administrative") {
      combinedScore *= 0.8;
    }

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
