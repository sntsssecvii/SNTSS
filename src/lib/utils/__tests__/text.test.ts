import { describe, it, expect } from "vitest";
import { toTitleCase } from "@/lib/utils/text";

describe("toTitleCase", () => {
  it("capitaliza primera letra de cada palabra en mayúsculas", () => {
    expect(toTitleCase("JUAN CARLOS")).toBe("Juan Carlos");
  });

  it("capitaliza primera letra de cada palabra en minúsculas", () => {
    expect(toTitleCase("juan carlos")).toBe("Juan Carlos");
  });

  it('respeta partícula "de" entre palabras', () => {
    expect(toTitleCase("PEDRO DE LA ROSA")).toBe("Pedro de la Rosa");
  });

  it('respeta partícula "del" entre palabras', () => {
    expect(toTitleCase("ESPINOZA DEL CAMPO")).toBe("Espinoza del Campo");
  });

  it("siempre capitaliza la primera palabra aunque sea partícula", () => {
    expect(toTitleCase("del monte")).toBe("Del Monte");
  });

  it("hace trim de espacios al inicio y fin", () => {
    expect(toTitleCase("  JUAN CARLOS  ")).toBe("Juan Carlos");
  });

  it("colapsa espacios múltiples internos", () => {
    expect(toTitleCase("JUAN   CARLOS")).toBe("Juan Carlos");
  });

  it("devuelve string vacío sin cambios", () => {
    expect(toTitleCase("")).toBe("");
  });
});
