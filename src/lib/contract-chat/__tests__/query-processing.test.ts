import { describe, expect, it } from "vitest";
import {
  normalizeText,
  tokenizeQuery,
  rewriteQueryLocal,
  isConversationalPrompt,
  isStructureQuery,
} from "@/lib/contract-chat/query-processing";

describe("query-processing", () => {
  describe("normalizeText", () => {
    it("quita acentos y pasa a minúsculas", () => {
      expect(normalizeText("Jubilación")).toBe("jubilacion");
    });
    it("quita caracteres especiales", () => {
      expect(normalizeText("¿Cuánto?")).toContain("cuanto");
    });
  });

  describe("rewriteQueryLocal", () => {
    it("expande abreviaciones IMSS", () => {
      const result = rewriteQueryLocal("sueldo de AUO");
      expect(result).toContain("auxiliar universal de oficinas");
    });
    it("corrige typos comunes", () => {
      const result = rewriteQueryLocal("vacasiones");
      expect(result).toContain("vacaciones");
    });
  });

  describe("isConversationalPrompt", () => {
    it("detecta saludos como conversación", () => {
      const normalized = normalizeText("Hola buenos días");
      const tokens = tokenizeQuery("Hola buenos días");
      expect(isConversationalPrompt(normalized, tokens)).toBe(true);
    });
    it("NO clasifica preguntas laborales como conversación", () => {
      const normalized = normalizeText("¿Puedo faltar mañana?");
      const tokens = tokenizeQuery("¿Puedo faltar mañana?");
      expect(isConversationalPrompt(normalized, tokens)).toBe(false);
    });
    it("NO clasifica preguntas de sueldo como conversación", () => {
      const normalized = normalizeText("¿Cuánto gano?");
      const tokens = tokenizeQuery("¿Cuánto gano?");
      expect(isConversationalPrompt(normalized, tokens)).toBe(false);
    });
    it("preguntas con verbos laborales NUNCA son conversacionales", () => {
      const cases = [
        "¿Puedo faltar?",
        "¿Me pueden despedir?",
        "¿Cuánto gano?",
        "quiero jubilarme",
        "necesito una beca",
        "mis vacaciones",
        "permiso económico",
      ];
      for (const q of cases) {
        const normalized = normalizeText(q);
        const tokens = tokenizeQuery(q);
        expect(
          isConversationalPrompt(normalized, tokens),
          `"${q}" fue clasificado como conversacional`,
        ).toBe(false);
      }
    });
  });

  describe("isStructureQuery", () => {
    it("detecta preguntas sobre estructura del contrato", () => {
      expect(
        isStructureQuery(normalizeText("¿Qué contiene el contrato?")),
      ).toBe(true);
    });
    it("NO detecta preguntas normales como estructura", () => {
      expect(isStructureQuery(normalizeText("¿Cuántas vacaciones?"))).toBe(
        false,
      );
    });
  });
});
