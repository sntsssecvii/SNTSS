// ---------------------------------------------------------------------------
// Chunking — extracción de texto, segmentación por sección/cláusula y
// clasificación de contenido del CCT IMSS-SNTSS.
// ---------------------------------------------------------------------------

import { spawn } from "child_process";
import fs from "fs";

import {
  CHUNK_OVERLAP,
  CONTRACT_PATH,
  LOCAL_PYTHON_PATH,
  TARGET_CHUNK_SIZE,
} from "@/lib/contract-chat/constants";
import { normalizeText } from "@/lib/contract-chat/query-processing";
import type {
  ContentType,
  ContractChunk,
  DocumentType,
} from "@/lib/contract-chat/types";

// ---------------------------------------------------------------------------
// Document structure — metadata by page ranges (33 secciones)
// ---------------------------------------------------------------------------

export interface DocumentSectionDef {
  startPage: number;
  endPage: number;
  documentType: DocumentType;
  sectionTitle: string;
  sectionNumber: number;
}

export const DOCUMENT_SECTIONS: DocumentSectionDef[] = [
  {
    startPage: 1,
    endPage: 8,
    documentType: "indice",
    sectionTitle: "Índice General",
    sectionNumber: 0,
  },
  {
    startPage: 9,
    endPage: 80,
    documentType: "contrato",
    sectionTitle: "Contrato Colectivo de Trabajo",
    sectionNumber: 1,
  },
  {
    startPage: 81,
    endPage: 88,
    documentType: "transitorias",
    sectionTitle: "Cláusulas Transitorias",
    sectionNumber: 2,
  },
  {
    startPage: 89,
    endPage: 110,
    documentType: "tabulador",
    sectionTitle: "Tabulador de Sueldos",
    sectionNumber: 3,
  },
  {
    startPage: 111,
    endPage: 276,
    documentType: "profesiograma",
    sectionTitle: "Profesiogramas",
    sectionNumber: 4,
  },
  {
    startPage: 277,
    endPage: 286,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Becas",
    sectionNumber: 5,
  },
  {
    startPage: 287,
    endPage: 296,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Bolsa de Trabajo",
    sectionNumber: 6,
  },
  {
    startPage: 297,
    endPage: 310,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Bolsa de Trabajo IMSS-Bienestar",
    sectionNumber: 7,
  },
  {
    startPage: 311,
    endPage: 317,
    documentType: "reglamento",
    sectionTitle: "Reglamento para Calificación de Puestos de Confianza B",
    sectionNumber: 8,
  },
  {
    startPage: 318,
    endPage: 332,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Capacitación y Adiestramiento",
    sectionNumber: 9,
  },
  {
    startPage: 333,
    endPage: 338,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Conductores de Vehículos",
    sectionNumber: 10,
  },
  {
    startPage: 339,
    endPage: 356,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Escalafón",
    sectionNumber: 11,
  },
  {
    startPage: 357,
    endPage: 363,
    documentType: "reglamento",
    sectionTitle: "Reglamento del Fondo de Retiro",
    sectionNumber: 12,
  },
  {
    startPage: 364,
    endPage: 372,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Guarderías",
    sectionNumber: 13,
  },
  {
    startPage: 373,
    endPage: 388,
    documentType: "reglamento",
    sectionTitle:
      "Reglamento de Infectocontagiosidad y Emanaciones Radiactivas",
    sectionNumber: 14,
  },
  {
    startPage: 389,
    endPage: 414,
    documentType: "reglamento",
    sectionTitle: "Reglamento Interior de Trabajo",
    sectionNumber: 15,
  },
  {
    startPage: 415,
    endPage: 425,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Jubilaciones y Pensiones",
    sectionNumber: 16,
  },
  {
    startPage: 426,
    endPage: 433,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Médicos Residentes",
    sectionNumber: 17,
  },
  {
    startPage: 434,
    endPage: 439,
    documentType: "reglamento",
    sectionTitle: "Reglamento para el Pago de Pasajes",
    sectionNumber: 18,
  },
  {
    startPage: 440,
    endPage: 445,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Protección al Salario",
    sectionNumber: 19,
  },
  {
    startPage: 446,
    endPage: 455,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Préstamos para la Habitación",
    sectionNumber: 20,
  },
  {
    startPage: 456,
    endPage: 460,
    documentType: "reglamento",
    sectionTitle: "Reglamento para Trabajadores IMSS-Bienestar",
    sectionNumber: 21,
  },
  {
    startPage: 461,
    endPage: 474,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Resguardo Patrimonial",
    sectionNumber: 22,
  },
  {
    startPage: 475,
    endPage: 481,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Revisión de Plantillas",
    sectionNumber: 23,
  },
  {
    startPage: 482,
    endPage: 508,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Ropa de Trabajo y Uniformes",
    sectionNumber: 24,
  },
  {
    startPage: 509,
    endPage: 511,
    documentType: "reglamento",
    sectionTitle: "Reglamento del Fondo de Ahorro",
    sectionNumber: 25,
  },
  {
    startPage: 512,
    endPage: 522,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Seguridad e Higiene",
    sectionNumber: 26,
  },
  {
    startPage: 523,
    endPage: 528,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Cambio de Rama",
    sectionNumber: 27,
  },
  {
    startPage: 529,
    endPage: 532,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Suministro de Alimentos",
    sectionNumber: 28,
  },
  {
    startPage: 533,
    endPage: 537,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Tiendas para Empleados",
    sectionNumber: 29,
  },
  {
    startPage: 538,
    endPage: 542,
    documentType: "reglamento",
    sectionTitle: "Reglamento de Viáticos para Chóferes",
    sectionNumber: 30,
  },
  {
    startPage: 543,
    endPage: 550,
    documentType: "convenio",
    sectionTitle: "Convenio Adicional de Jubilaciones Nuevo Ingreso",
    sectionNumber: 31,
  },
  {
    startPage: 551,
    endPage: 999,
    documentType: "indice",
    sectionTitle: "Índice Alfabético",
    sectionNumber: 32,
  },
];

export function getDocumentSectionForPage(
  pageNumber: number,
): DocumentSectionDef | undefined {
  return DOCUMENT_SECTIONS.find(
    (s) => pageNumber >= s.startPage && pageNumber <= s.endPage,
  );
}

// ---------------------------------------------------------------------------
// Content type classification (deterministic heuristics)
// ---------------------------------------------------------------------------

export const SIGNATURES_HEURISTICS = [
  /\bse firma el presente\b/i,
  /\bpor el instituto mexicano del seguro social\b/i,
  /\bpor el sindicato nacional de trabajadores\b/i,
  /\ben la ciudad de m[eé]xico\b.*\bd[ií]a\b/i,
  /\bsecretario general\b.*\btestigo\b/i,
  /\b(Lic|Dr|Mtro|Quím|C\.P)\.\s+[A-ZÁÉÍÓÚ][a-záéíóú]+\s+[A-ZÁÉÍÓÚ].*\b(Lic|Dr|Mtro|Quím|C\.P)\./,
];

export const DEFINITION_HEURISTICS = [/\bdefiniciones\b/i];

export const REQUIREMENT_HEURISTICS = [
  /\b(requisitos?|deber[áa]n?\s+(presentar|cumplir|acreditar))\b/i,
  /\b(condiciones?\s+(para|de)\s+(obtener|solicitar|acceder))\b/i,
  /\b(documentos?\s+(que|necesarios|requeridos))\b/i,
];

export const PROCEDURE_HEURISTICS = [
  /\b(procedimiento|se proceder[áa]|pasos a seguir)\b/i,
  /\b(proceso de (selección|calificación|evaluación))\b/i,
];

export const TABLE_HEURISTICS = [
  /tabulador de sueldos/i,
  /sueldo\s+hora-mes/i,
  /jor-?\s*nada\s+hora/i,
  /mes-pesos/i,
  /\bCATEGOR[IÍ]A\s+UNIFORMES\b/i,
  /\bEquivalencia en Horas\b/i,
];

export const INDEX_CONTENT_HEURISTICS = [
  /^[IÍ]NDICE\b/,
  /\bCl[áa]usula\s+P[áa]gina\b/i,
  /\b[IÍ]NDICE ALFAB[EÉ]TICO\b/i,
];

export function classifyContentType(
  text: string,
  pageNumber: number,
): ContentType {
  const docSection = getDocumentSectionForPage(pageNumber);
  if (docSection?.documentType === "indice") return "index";
  if (INDEX_CONTENT_HEURISTICS.some((p) => p.test(text))) return "index";
  if (SIGNATURES_HEURISTICS.filter((p) => p.test(text)).length >= 2)
    return "signatures";
  if (TABLE_HEURISTICS.some((p) => p.test(text))) return "table";
  if (docSection?.documentType === "profesiograma") return "table";
  if (
    DEFINITION_HEURISTICS.some((p) => p.test(text)) &&
    /:\s+(Es|Son|Se entiende|Trato|Forma|Conjunto)/m.test(text)
  )
    return "definition";
  if (REQUIREMENT_HEURISTICS.some((p) => p.test(text))) return "requirement";
  if (PROCEDURE_HEURISTICS.some((p) => p.test(text))) return "procedure";
  return "normative";
}

// ---------------------------------------------------------------------------
// Smart chunking — split by clause/article boundaries
// ---------------------------------------------------------------------------

export const CLAUSE_REGEX = /^Cláusula\s+(\d+(?:\s*Bis)?)\s*[\.\-–]\s*(.+)/im;
export const ARTICLE_REGEX = /^Art[ií]culo\s+(\d+)\b\.?\s*(.*)/im;
export const CHAPTER_REGEX =
  /^Capítulo\s+([IVXLC]+(?:\.\d+)?)\s*[\.\-–]\s*(.+)/im;

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface RawSection {
  clauseNumber?: number;
  clauseTitle?: string;
  chapterTitle?: string;
  articleNumber?: number;
  articleTitle?: string;
  sectionTitle?: string;
  sectionNumber?: number;
  documentType?: DocumentType;
  pageNumber: number;
  text: string;
}

export function splitPagesIntoSections(pages: ExtractedPage[]): RawSection[] {
  const sections: RawSection[] = [];
  let currentChapter = "";
  let currentClause: { number?: number; title?: string } = {};
  let currentArticle: { number?: number; title?: string } = {};
  let currentText = "";
  let currentPage = 1;

  function flushSection() {
    const trimmed = currentText.trim();
    if (trimmed.length > 30) {
      const docSection = getDocumentSectionForPage(currentPage);
      sections.push({
        clauseNumber: currentClause.number,
        clauseTitle: currentClause.title,
        chapterTitle: currentChapter || undefined,
        articleNumber: currentArticle.number,
        articleTitle: currentArticle.title,
        sectionTitle: docSection?.sectionTitle,
        sectionNumber: docSection?.sectionNumber,
        documentType: docSection?.documentType,
        pageNumber: currentPage,
        text: trimmed,
      });
    }
    currentText = "";
  }

  for (const page of pages) {
    const lines = page.text.split(/\r?\n/);

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Skip header/footer noise
      if (/^CONTRATO COLECTIVO DE TRABAJO$/i.test(trimmedLine)) continue;
      if (/^REGLAMENTOS?$/i.test(trimmedLine)) continue;
      if (/^PROFESIOGRAMAS?$/i.test(trimmedLine)) continue;
      if (/^(Índice|Contenido|A-Z)\s*$/i.test(trimmedLine)) continue;
      if (/^\d+$/.test(trimmedLine)) continue; // page numbers

      const chapterMatch = trimmedLine.match(CHAPTER_REGEX);
      if (chapterMatch) {
        flushSection();
        currentChapter = `Capítulo ${chapterMatch[1]}.- ${chapterMatch[2]}`;
        currentPage = page.pageNumber;
        continue;
      }

      const clauseMatch = trimmedLine.match(CLAUSE_REGEX);
      if (clauseMatch) {
        flushSection();
        const num = parseInt(clauseMatch[1], 10);
        currentClause = {
          number: Number.isFinite(num) ? num : undefined,
          title: clauseMatch[2].trim(),
        };
        currentArticle = {};
        currentPage = page.pageNumber;
        currentText = trimmedLine + "\n";
        continue;
      }

      const articleMatch = trimmedLine.match(ARTICLE_REGEX);
      if (articleMatch) {
        flushSection();
        const num = parseInt(articleMatch[1], 10);
        currentArticle = {
          number: Number.isFinite(num) ? num : undefined,
          title: articleMatch[2]?.trim() || undefined,
        };
        currentClause = {};
        currentPage = page.pageNumber;
        currentText = trimmedLine + "\n";
        continue;
      }

      currentText += trimmedLine + "\n";
      if (!currentClause.number && !currentArticle.number) {
        currentPage = page.pageNumber;
      }
    }
  }

  flushSection();
  return sections;
}

export const TABULAR_PATTERNS = [
  /tabulador de sueldos/i,
  /sueldo\s+hora-mes/i,
  /jor-?\s*nada\s+hora/i,
  /mes-pesos/i,
  /profesiogramas?\s+categor/i,
];

export function isTabularContent(text: string): boolean {
  return TABULAR_PATTERNS.some((p) => p.test(text));
}

export function buildChunkId(section: RawSection, chunkIndex: number): string {
  if (section.clauseNumber) {
    return `clause-${section.clauseNumber}-chunk-${chunkIndex}`;
  }
  if (section.articleNumber && section.sectionNumber !== undefined) {
    return `s${section.sectionNumber}-art-${section.articleNumber}-chunk-${chunkIndex}`;
  }
  return `page-${section.pageNumber}-chunk-${chunkIndex}`;
}

export function splitSectionIntoChunks(
  section: RawSection,
): Omit<ContractChunk, "normalizedText" | "tokenCounts">[] {
  const text = section.text.replace(/\s+/g, " ").trim();

  // Tabular content (tabuladores, profesiogramas index) — use larger chunks to avoid cutting tables
  const maxSize = isTabularContent(text) ? 2400 : TARGET_CHUNK_SIZE;

  const baseMetadata = {
    pageNumber: section.pageNumber,
    clauseNumber: section.clauseNumber,
    clauseTitle: section.clauseTitle,
    chapterTitle: section.chapterTitle,
    articleNumber: section.articleNumber,
    articleTitle: section.articleTitle,
    sectionTitle: section.sectionTitle,
    sectionNumber: section.sectionNumber,
    documentType: section.documentType,
  };

  if (text.length <= maxSize) {
    return [
      {
        id: buildChunkId(section, 1),
        ...baseMetadata,
        contentType: classifyContentType(text, section.pageNumber),
        text,
      },
    ];
  }

  const chunks: Omit<ContractChunk, "normalizedText" | "tokenCounts">[] = [];
  let start = 0;
  let chunkIndex = 1;

  while (start < text.length) {
    let end = Math.min(start + maxSize, text.length);
    if (end < text.length) {
      const breakPoint = text.lastIndexOf(". ", end);
      if (breakPoint > start + 300) {
        end = breakPoint + 1;
      }
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 20) {
      // Prepend clause/article context to each chunk for better retrieval
      const prefix = section.clauseNumber
        ? `Cláusula ${section.clauseNumber}.- ${section.clauseTitle || ""}: `
        : section.articleNumber
          ? `Artículo ${section.articleNumber}. ${section.articleTitle || ""}: `
          : "";
      const fullText =
        chunkIndex > 1 && prefix ? prefix + chunkText : chunkText;

      chunks.push({
        id: buildChunkId(section, chunkIndex),
        ...baseMetadata,
        contentType: classifyContentType(fullText, section.pageNumber),
        text: fullText,
      });
      chunkIndex++;
    }

    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Page hint extraction
// ---------------------------------------------------------------------------

export function extractPageHints(query: string): number[] {
  const matches = query.match(/\b(?:pagina|pag|p)\.?\s*(\d{1,3})\b/gi) || [];
  return matches
    .map((m) => Number(m.replace(/[^\d]/g, "")))
    .filter((v) => Number.isFinite(v) && v > 0);
}

// ---------------------------------------------------------------------------
// PDF extraction
// ---------------------------------------------------------------------------

export function getPythonExecutable(): string {
  return fs.existsSync(LOCAL_PYTHON_PATH) ? LOCAL_PYTHON_PATH : "python3";
}

export async function extractPagesFromPdf(
  pdfPath: string,
): Promise<ExtractedPage[]> {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import json
import sys
import pdfplumber

pdf_path = sys.argv[1]
pages = []

with pdfplumber.open(pdf_path) as pdf:
    for index, page in enumerate(pdf.pages, start=1):
        text = page.extract_text(layout=True) or page.extract_text() or ""
        pages.append({
            "pageNumber": index,
            "text": text
        })

print(json.dumps({"pages": pages}, ensure_ascii=False))
`.trim();

    const child = spawn(getPythonExecutable(), ["-c", pythonScript, pdfPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python terminó con código ${code}`));
        return;
      }
      try {
        const payload = JSON.parse(stdout) as { pages?: ExtractedPage[] };
        resolve(payload.pages || []);
      } catch (error) {
        reject(
          new Error(
            `No se pudo interpretar la salida del extractor: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });
  });
}
