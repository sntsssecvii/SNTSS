import fs from "fs";
import path from "path";

import type {
  ChatMessage,
  ContractChatAnswer,
  ContractChatStatus,
  ContractChunk,
  ContractIndex,
  ContractRetrievalTrace,
  ContractSearchResult,
} from "@/lib/contract-chat/types";
import {
  CONTRACT_FILENAME,
  CONTRACT_INDEX_PATH,
  CONTRACT_PATH,
  MAX_SELECTED_SOURCES,
} from "@/lib/contract-chat/constants";
import {
  DOCUMENT_SECTIONS,
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
} from "@/lib/contract-chat/query-processing";
import {
  generateEmbeddings,
  generateQueryEmbedding,
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
  recordRetrievalTrace,
  rerankEvidenceByQuestionIntent,
} from "@/lib/contract-chat/evidence";
import {
  buildTabuladorContext,
  buildPrestacionesContext,
  faqSemanticSearch,
} from "@/lib/contract-chat/structured-data";
import {
  buildEvidencePack,
  buildAnswerPlan,
  buildPlannedAnswerText,
} from "@/lib/contract-chat/evidence-pack";
import {
  createGroqStream,
  generateGroqAnswer,
  getGroqApiKey,
  getGroqModel,
} from "@/lib/contract-chat/llm";

export { createGroqStream };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let contractIndexPromise: Promise<ContractIndex> | null = null;

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
