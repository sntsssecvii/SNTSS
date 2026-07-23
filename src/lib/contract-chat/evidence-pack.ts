import type {
  AnswerPlan,
  ChatMessage,
  ContractRetrievalTrace,
  ContractSearchResult,
  EvidencePack,
} from "@/lib/contract-chat/types";
import { normalizeText } from "@/lib/contract-chat/query-processing";
import { MAX_EVIDENCE_SOURCES } from "@/lib/contract-chat/constants";

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

export function buildEvidencePack(
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

export function buildAnswerPlan(pack: EvidencePack): AnswerPlan {
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

export function buildAnswerText(
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
export function buildPlannedAnswerText(
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
