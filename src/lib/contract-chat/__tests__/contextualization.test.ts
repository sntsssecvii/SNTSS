import { describe, expect, it } from "vitest";

import {
  buildLocalContextualQuery,
  sanitizeConversationHistory,
} from "@/lib/contract-chat/contextualization";

describe("contextualization", () => {
  describe("sanitizeConversationHistory", () => {
    it("elimina último mensaje si es igual al query actual", () => {
      const history = [
        { role: "user" as const, content: "¿Qué son las becas?" },
        { role: "assistant" as const, content: "Las becas son..." },
        { role: "user" as const, content: "requisitos" },
      ];
      const cleaned = sanitizeConversationHistory("requisitos", history);
      expect(cleaned.at(-1)?.content).not.toBe("requisitos");
    });
    it("trunca contenido largo a 1200 chars", () => {
      const history = [{ role: "user" as const, content: "a".repeat(2000) }];
      const cleaned = sanitizeConversationHistory("nueva pregunta", history);
      expect(cleaned[0].content.length).toBeLessThanOrEqual(1200);
    });
  });

  describe("buildLocalContextualQuery", () => {
    it("detecta tema activo de becas en historial", () => {
      const history = [
        { role: "user" as const, content: "¿Qué becas hay?" },
        {
          role: "assistant" as const,
          content: "Hay becas íntegras y parciales.",
        },
      ];
      const result = buildLocalContextualQuery("¿Y los requisitos?", history);
      expect(result).not.toBeNull();
      expect(result).toContain("beca");
    });
    it("retorna null sin historial", () => {
      expect(buildLocalContextualQuery("hola", [])).toBeNull();
    });
  });
});
