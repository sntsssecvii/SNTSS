import { describe, expect, it } from "vitest";
import { createExcerpt } from "@/lib/contract-chat/search";

describe("search", () => {
  describe("createExcerpt", () => {
    it("genera excerpt con tokens", () => {
      const text =
        "Los trabajadores tendrán derecho a 20 días de vacaciones por año de servicio";
      const excerpt = createExcerpt(text, ["vacaciones", "dias"]);
      expect(excerpt.length).toBeGreaterThan(0);
      expect(excerpt.length).toBeLessThanOrEqual(300);
    });

    it("retorna inicio del texto si no hay match", () => {
      const text =
        "Este es un texto largo sin los términos buscados en ninguna parte visible";
      const excerpt = createExcerpt(text, ["inexistente"]);
      expect(excerpt.length).toBeGreaterThan(0);
    });
  });
});
