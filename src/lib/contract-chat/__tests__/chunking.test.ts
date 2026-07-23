import { describe, expect, it } from "vitest";

import {
  classifyContentType,
  getDocumentSectionForPage,
} from "@/lib/contract-chat/chunking";

describe("chunking", () => {
  describe("getDocumentSectionForPage", () => {
    it("página 10 es contrato", () => {
      const section = getDocumentSectionForPage(10);
      expect(section?.documentType).toBe("contrato");
    });
    it("página 1 es indice", () => {
      const section = getDocumentSectionForPage(1);
      expect(section?.documentType).toBe("indice");
    });
    it("página 95 es tabulador", () => {
      const section = getDocumentSectionForPage(95);
      expect(section?.documentType).toBe("tabulador");
    });
  });

  describe("classifyContentType", () => {
    it("detecta firmas", () => {
      expect(
        classifyContentType(
          "POR EL INSTITUTO MEXICANO DEL SEGURO SOCIAL se firma el presente contrato colectivo",
          80,
        ),
      ).toBe("signatures");
    });
    it("detecta tablas", () => {
      expect(
        classifyContentType("tabulador de sueldos base hora-mes categoría", 90),
      ).toBe("table");
    });
    it("texto normativo por defecto", () => {
      expect(
        classifyContentType(
          "Los trabajadores tendrán derecho a vacaciones",
          20,
        ),
      ).toBe("normative");
    });
  });
});
