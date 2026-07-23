import { describe, expect, it } from "vitest";

import { checkThematicCompatibility } from "@/lib/contract-chat/evidence";
import type { ContractSearchResult } from "@/lib/contract-chat/types";

describe("evidence", () => {
  describe("checkThematicCompatibility", () => {
    it("marca incompatible cuando no hay overlap temático", () => {
      const sources: ContractSearchResult[] = [
        {
          chunk: {
            id: "test-1",
            pageNumber: 50,
            text: "vacaciones y días de descanso",
            normalizedText: "vacaciones y dias de descanso",
            tokenCounts: {},
          },
          score: 0.3,
          semanticScore: 0.3,
          keywordScore: 0.1,
          matchedTerms: ["vacaciones"],
          excerpt: "vacaciones...",
        },
      ];
      const result = checkThematicCompatibility(
        "¿Cómo saco mi constancia del SAT?",
        sources,
      );
      expect(result.compatible).toBe(false);
    });

    it("marca compatible cuando hay overlap", () => {
      const sources: ContractSearchResult[] = [
        {
          chunk: {
            id: "test-2",
            pageNumber: 30,
            text: "Los permisos económicos se otorgan",
            normalizedText: "los permisos economicos se otorgan",
            tokenCounts: {},
          },
          score: 0.7,
          semanticScore: 0.7,
          keywordScore: 0.5,
          matchedTerms: ["permisos", "economicos"],
          excerpt: "permisos...",
        },
      ];
      const result = checkThematicCompatibility(
        "¿Cuántos permisos económicos?",
        sources,
      );
      expect(result.compatible).toBe(true);
    });

    it("retorna compatible cuando no hay evidencia", () => {
      const result = checkThematicCompatibility("cualquier query", []);
      expect(result.compatible).toBe(true);
      expect(result.reason).toBe("");
    });

    it("marca incompatible para queries de meteorología", () => {
      const sources: ContractSearchResult[] = [
        {
          chunk: {
            id: "test-3",
            pageNumber: 100,
            text: "Las cláusulas del contrato se aplican",
            normalizedText: "las clausulas del contrato se aplican",
            tokenCounts: {},
          },
          score: 0.3,
          semanticScore: 0.3,
          keywordScore: 0.1,
          matchedTerms: ["contrato"],
          excerpt: "contrato...",
        },
      ];
      const result = checkThematicCompatibility(
        "¿Va a llover mañana en Mexicali?",
        sources,
      );
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain("meteorología");
    });

    it("marca insufficient cuando query no tiene relación temática con sources", () => {
      const sources: ContractSearchResult[] = [
        {
          chunk: {
            id: "noise-1",
            pageNumber: 100,
            text: "El tabulador establece categorías y sueldos base",
            normalizedText: "el tabulador establece categorias y sueldos base",
            tokenCounts: {},
          },
          score: 0.25,
          semanticScore: 0.2,
          keywordScore: 0.1,
          matchedTerms: [],
          excerpt: "tabulador...",
        },
      ];
      const result = checkThematicCompatibility(
        "¿Cómo saco mi constancia de situación fiscal del SAT?",
        sources,
      );
      expect(result.compatible).toBe(false);
    });

    it("incluye la razón cuando es incompatible", () => {
      const sources: ContractSearchResult[] = [
        {
          chunk: {
            id: "test-4",
            pageNumber: 200,
            text: "El trabajador tiene derecho a vacaciones",
            normalizedText: "el trabajador tiene derecho a vacaciones",
            tokenCounts: {},
          },
          score: 0.4,
          semanticScore: 0.4,
          keywordScore: 0.2,
          matchedTerms: ["trabajador"],
          excerpt: "trabajador...",
        },
      ];
      const result = checkThematicCompatibility(
        "¿Cuántos puntos de Infonavit tengo?",
        sources,
      );
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain("Infonavit");
    });
  });
});
