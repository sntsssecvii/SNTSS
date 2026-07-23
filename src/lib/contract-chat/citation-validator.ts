import type { ContractSearchResult } from "@/lib/contract-chat/types";

interface CitationValidation {
  cleanedText: string;
  removedCitations: string[];
  validCitations: string[];
}

/**
 * Extrae citas del texto generado por el LLM y las cruza contra las fuentes reales.
 * Elimina citas que no están respaldadas por las fuentes del retrieval.
 */
export function validateCitations(
  generatedText: string,
  sources: ContractSearchResult[],
): CitationValidation {
  const validPages = new Set(sources.map((s) => s.chunk.pageNumber));
  const validClauses = new Set(
    sources
      .filter((s) => s.chunk.clauseNumber)
      .map((s) => s.chunk.clauseNumber!),
  );
  const validArticles = new Set(
    sources
      .filter((s) => s.chunk.articleNumber)
      .map((s) => s.chunk.articleNumber!),
  );

  const removedCitations: string[] = [];
  const validCitations: string[] = [];

  let cleaned = generatedText;

  // Validar citas de cláusulas: "Cláusula 24", "cláusula 24"
  cleaned = cleaned.replace(/[Cc]l[aá]usula\s+(\d+)/g, (match, num) => {
    const n = parseInt(num, 10);
    if (validClauses.has(n)) {
      validCitations.push(match);
      return match;
    }
    removedCitations.push(match);
    return "";
  });

  // Validar citas de artículos: "Artículo 20", "artículo 20"
  cleaned = cleaned.replace(/[Aa]rt[ií]culo\s+(\d+)/g, (match, num) => {
    const n = parseInt(num, 10);
    if (validArticles.has(n)) {
      validCitations.push(match);
      return match;
    }
    removedCitations.push(match);
    return "";
  });

  // Validar citas de páginas: "p. 281", "página 281", "p.281"
  cleaned = cleaned.replace(
    /(?:p[aá]gina|p\.?\s*)(\d{1,3})/gi,
    (match, num) => {
      const n = parseInt(num, 10);
      if (validPages.has(n)) {
        validCitations.push(match);
        return match;
      }
      removedCitations.push(match);
      return "";
    },
  );

  // Limpiar espacios dobles y comas huérfanas
  cleaned = cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();

  return { cleanedText: cleaned, removedCitations, validCitations };
}
