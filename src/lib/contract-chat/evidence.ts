import { randomUUID } from "crypto";

import {
  EVIDENCE_EXPANSION_ANCHORS,
  EVIDENCE_EXPANSION_RADIUS,
  MAX_EVIDENCE_SOURCES,
  MAX_RETRIEVAL_TRACES,
} from "@/lib/contract-chat/constants";
import {
  normalizeText,
  tokenizeQuery,
} from "@/lib/contract-chat/query-processing";
import { createExcerpt } from "@/lib/contract-chat/search";
import type {
  ContractChunk,
  ContractIndex,
  ContractRetrievalTrace,
  ContractRetrievalTraceItem,
  ContractSearchResult,
} from "@/lib/contract-chat/types";

// ---------------------------------------------------------------------------
// State — recent traces in-memory ring buffer
// ---------------------------------------------------------------------------

export const recentRetrievalTraces: ContractRetrievalTrace[] = [];

// ---------------------------------------------------------------------------
// Internal helpers — CONTRACT_SECTIONS lives in query-processing
// ---------------------------------------------------------------------------

// Re-export getSectionForPage logic via a lazy import to avoid circular deps.
// We duplicate the lookup here against the imported CONTRACT_SECTIONS.
import { CONTRACT_SECTIONS } from "@/lib/contract-chat/query-processing";

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
// toTraceItem
// ---------------------------------------------------------------------------

export function toTraceItem(
  source: ContractSearchResult,
): ContractRetrievalTraceItem {
  return {
    chunkId: source.chunk.id,
    pageNumber: source.chunk.pageNumber,
    clauseNumber: source.chunk.clauseNumber,
    score: Number(source.score.toFixed(4)),
    semanticScore: Number(source.semanticScore.toFixed(4)),
    keywordScore: Number(source.keywordScore.toFixed(4)),
    matchedTerms: source.matchedTerms,
    excerpt: source.excerpt.slice(0, 500),
  };
}

// ---------------------------------------------------------------------------
// checkThematicCompatibility
// ---------------------------------------------------------------------------

/**
 * Thematic compatibility check: detects when evidence matches lexically
 * but the query intent is clearly outside the CCT domain.
 *
 * Returns a negative signal string if incompatible, null otherwise.
 */
export function checkThematicCompatibility(
  originalQuery: string,
  evidence: ContractSearchResult[],
): { compatible: boolean; reason: string } {
  if (evidence.length === 0) return { compatible: true, reason: "" };

  const nq = normalizeText(originalQuery);

  // Detect external entity references that indicate out-of-scope queries.
  // The check is: query mentions an external institution/concept AND
  // the evidence sections don't match that concept.
  const externalSignals = [
    {
      pattern:
        /\b(sat|servicio de administracion tributaria|situacion fiscal|rfc|declaracion anual)\b/,
      domain: "fiscal/SAT",
    },
    {
      pattern: /\b(infonavit|credito infonavit|puntos infonavit)\b/,
      domain: "Infonavit",
    },
    {
      pattern:
        /\b(imss como (paciente|derechohabiente)|clinica|consultorio|cita medica)\b/,
      domain: "servicios médicos IMSS",
    },
    { pattern: /\b(issste|fovissste)\b/, domain: "ISSSTE" },
    {
      pattern:
        /\b(clima|temperatura|lluvia|llover|llovera|pronostico|nublado|soleado)\b/,
      domain: "meteorología",
    },
    { pattern: /\b(receta|cocinar|ingredientes|platillo)\b/, domain: "cocina" },
  ];

  const matchedExternal = externalSignals.find((s) => s.pattern.test(nq));
  if (!matchedExternal) return { compatible: true, reason: "" };

  // If evidence is mostly from the contract/regulations and query is about
  // an external domain, flag incompatibility
  const evidenceText = normalizeText(
    evidence
      .slice(0, 4)
      .map((s) => s.chunk.text)
      .join(" "),
  );

  // Check if the external domain's key concept actually appears in evidence
  const domainInEvidence = matchedExternal.pattern.test(evidenceText);
  if (domainInEvidence) return { compatible: true, reason: "" };

  return {
    compatible: false,
    reason: `La consulta refiere a "${matchedExternal.domain}" pero la evidencia es del CCT sin relación directa.`,
  };
}

// ---------------------------------------------------------------------------
// buildRetrievalTrace
// ---------------------------------------------------------------------------

export function buildRetrievalTrace(
  originalQuery: string,
  contextualizedQuery: string,
  contextualizationMode: ContractRetrievalTrace["contextualizationMode"],
  retrievalQueries: string[],
  candidates: ContractSearchResult[],
  selected: ContractSearchResult[],
): ContractRetrievalTrace {
  const evidence = selected.slice(0, MAX_EVIDENCE_SOURCES);
  const topScore = evidence[0]?.score || 0;
  const evidenceText = normalizeText(
    evidence.map((source) => source.chunk.text).join(" "),
  );
  const queryTokens = tokenizeQuery(contextualizedQuery);
  const coveredTokens = queryTokens.filter((token) =>
    evidenceText.includes(normalizeText(token)),
  );
  const tokenCoverage =
    queryTokens.length > 0 ? coveredTokens.length / queryTokens.length : 0;
  const strongEvidence = evidence.filter(
    (source) => source.score >= Math.max(0.42, topScore * 0.72),
  );

  // Base sufficiency
  let sufficient =
    topScore >= 0.55 && strongEvidence.length >= 2 && tokenCoverage >= 0.5;

  // Thematic compatibility override
  const thematic = checkThematicCompatibility(originalQuery, evidence);
  if (sufficient && !thematic.compatible) {
    sufficient = false;
  }

  const reason =
    !sufficient && !thematic.compatible
      ? thematic.reason
      : sufficient
        ? `${strongEvidence.length} fragmentos superaron el umbral relativo y cubren ${coveredTokens.length}/${queryTokens.length} términos de la consulta.`
        : evidence.length === 0
          ? "La recuperación no encontró fragmentos candidatos."
          : `La evidencia fue débil, aislada o incompleta: mejor puntuación ${topScore.toFixed(3)}, ${strongEvidence.length} fragmentos sobre el umbral y cobertura ${coveredTokens.length}/${queryTokens.length}.`;

  return {
    traceId: randomUUID(),
    createdAt: new Date().toISOString(),
    originalQuery,
    contextualizedQuery,
    contextualizationMode,
    retrievalQueries,
    candidates: candidates.slice(0, 20).map(toTraceItem),
    selected: selected.map(toTraceItem),
    evidence: evidence.map(toTraceItem),
    sufficiency: {
      status: sufficient ? "sufficient" : "insufficient",
      reason,
      topScore: Number(topScore.toFixed(4)),
      evidenceCount: evidence.length,
    },
  };
}

// ---------------------------------------------------------------------------
// recordRetrievalTrace
// ---------------------------------------------------------------------------

export function recordRetrievalTrace(trace: ContractRetrievalTrace): void {
  recentRetrievalTraces.unshift(trace);
  if (recentRetrievalTraces.length > MAX_RETRIEVAL_TRACES) {
    recentRetrievalTraces.length = MAX_RETRIEVAL_TRACES;
  }

  if (process.env.CONTRACT_CHAT_TRACE === "1") {
    console.info("[contract-chat:retrieval]", JSON.stringify(trace));
  }
}

// ---------------------------------------------------------------------------
// getRecentContractRetrievalTraces (public export)
// ---------------------------------------------------------------------------

export function getRecentContractRetrievalTraces(): ContractRetrievalTrace[] {
  return recentRetrievalTraces.map((trace) => structuredClone(trace));
}

// ---------------------------------------------------------------------------
// expandEvidenceSources
// ---------------------------------------------------------------------------

export function expandEvidenceSources(
  candidates: ContractSearchResult[],
  index: ContractIndex,
  query: string,
): ContractSearchResult[] {
  const expanded = new Map<string, ContractSearchResult>();
  const tokens = tokenizeQuery(query);

  for (const candidate of candidates) {
    expanded.set(candidate.chunk.id, candidate);
  }

  for (const anchor of candidates.slice(0, EVIDENCE_EXPANSION_ANCHORS)) {
    const anchorSection = getSectionForPage(anchor.chunk.pageNumber);
    const minPage = anchor.chunk.pageNumber - EVIDENCE_EXPANSION_RADIUS;
    const maxPage = anchor.chunk.pageNumber + EVIDENCE_EXPANSION_RADIUS;

    for (const chunk of index.chunks) {
      if (chunk.pageNumber < minPage || chunk.pageNumber > maxPage) continue;
      if (chunk.pageNumber >= 551) continue;
      if (expanded.has(chunk.id)) continue;

      const chunkSection = getSectionForPage(chunk.pageNumber);
      if (anchorSection?.number !== chunkSection?.number) continue;

      const distance = Math.abs(chunk.pageNumber - anchor.chunk.pageNumber);
      const relation =
        distance === 0 ? "same-page-context" : "neighbor-page-context";
      const scoreMultiplier = distance === 0 ? 0.94 : 0.82;

      expanded.set(chunk.id, {
        chunk,
        score: anchor.score * scoreMultiplier,
        semanticScore: anchor.semanticScore * scoreMultiplier,
        keywordScore: 0,
        matchedTerms: Array.from(new Set([...anchor.matchedTerms, relation])),
        excerpt: createExcerpt(chunk.text, tokens),
      });
    }
  }

  return Array.from(expanded.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chunk.pageNumber - b.chunk.pageNumber;
  });
}

// ---------------------------------------------------------------------------
// rerankEvidenceByQuestionIntent
// ---------------------------------------------------------------------------

export function rerankEvidenceByQuestionIntent(
  sources: ContractSearchResult[],
  query: string,
): ContractSearchResult[] {
  const normalizedQuery = normalizeText(query);
  const asksForEligibility =
    /\b(aplica|aplicar|puedo|solicitar|requisito|requisitos|elegible|obtener)\b/.test(
      normalizedQuery,
    );
  const asksForTypes =
    /\b(tipo|tipos|clase|clases|opcion|opciones|cuales|cuáles)\b/.test(
      normalizedQuery,
    );
  const asksForStudies =
    /\b(estudio|estudios|carrera|carreras|maestria|maestría|postgrado|posgrado|doctorado|especializacion|especialización|capacitacion|capacitación)\b/.test(
      normalizedQuery,
    );
  const activeScholarshipRegulation =
    /\b(reglamento de becas|beca|becas)\b/.test(normalizedQuery);
  const explicitlyMedicalResident =
    /\b(medico residente|médico residente|medicos residentes|médicos residentes|residencia|residentes)\b/.test(
      normalizedQuery,
    );

  return sources
    .map((source) => {
      let boost = 0;
      const text = source.chunk.normalizedText;

      if (activeScholarshipRegulation) {
        if (source.chunk.pageNumber >= 278 && source.chunk.pageNumber <= 286) {
          boost += 0.2;
          if (
            /\b(se firma el presente reglamento|por el instituto mexicano del seguro social|por el sindicato nacional de trabajadores)\b/.test(
              text,
            )
          ) {
            boost -= 0.18;
          }
        } else if (
          !explicitlyMedicalResident &&
          /\bmedicos residentes|médicos residentes|residentes en periodo de adiestramiento|residentes en período de adiestramiento\b/.test(
            text,
          )
        ) {
          boost -= 0.25;
        }
      }

      if (
        asksForEligibility &&
        /\b(requisitos|obtener|solicitud|solicitudes|interesados|deberan|deberán|documentos|dictaminar)\b/.test(
          text,
        )
      ) {
        boost += 0.14;
      }

      if (
        asksForTypes &&
        /\b(clases de becas|becas integras|becas íntegras|becas parciales|goce de salario|sin goce de salario|reduccion de jornada|reducción de jornada)\b/.test(
          text,
        )
      ) {
        boost += 0.12;
      }

      if (
        asksForStudies &&
        /\b(formacion tecnica|formación técnica|profesional|postgrado|posgrado|perfeccionamiento|universitarias|politecnico|politécnico|tecnicas|técnicas|especializacion|especialización|educacion media superior|educación media superior|interes particular|interés particular|necesidades del instituto|seguridad social)\b/.test(
          text,
        )
      ) {
        boost += 0.14;
      }

      if (boost === 0) return source;
      return {
        ...source,
        score: source.score + boost,
        matchedTerms: Array.from(
          new Set([...source.matchedTerms, "intent-rerank"]),
        ),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.chunk.pageNumber - b.chunk.pageNumber;
    });
}

// ---------------------------------------------------------------------------
// getChunkOrder / orderSourcesForPrompt
// ---------------------------------------------------------------------------

export function getChunkOrder(chunk: ContractChunk): number {
  const match = chunk.id.match(/chunk-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function orderSourcesForPrompt(
  sources: ContractSearchResult[],
): ContractSearchResult[] {
  const limited = sources.slice(0, MAX_EVIDENCE_SOURCES);
  if (limited.length <= 1) return limited;

  const sections = new Set(
    limited
      .map((source) => getSectionForPage(source.chunk.pageNumber)?.number)
      .filter(Boolean),
  );
  const pages = limited.map((source) => source.chunk.pageNumber);
  const pageSpan = Math.max(...pages) - Math.min(...pages);

  if (sections.size === 1 && pageSpan <= 12) {
    return limited.slice().sort((a, b) => {
      if (a.chunk.pageNumber !== b.chunk.pageNumber) {
        return a.chunk.pageNumber - b.chunk.pageNumber;
      }
      return getChunkOrder(a.chunk) - getChunkOrder(b.chunk);
    });
  }

  return limited;
}
