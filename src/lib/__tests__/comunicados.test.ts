import { describe, it, expect } from "vitest";
import {
  comunicadoInputSchema,
  comunicadoPatchSchema,
  ordenarComunicados,
} from "@/lib/comunicados";

const base = {
  titulo: "Avance en la negociación",
  cuerpo: "Se reanudó la mesa con el Instituto.",
  categoria: "negociacion" as const,
};

describe("comunicadoInputSchema", () => {
  it("acepta un comunicado válido y aplica defaults", () => {
    const r = comunicadoInputSchema.parse(base);
    expect(r.fijado).toBe(false);
    expect(r.publicado).toBe(false);
  });

  it("rechaza enlaces que no son http(s)", () => {
    expect(
      comunicadoInputSchema.safeParse({
        ...base,
        enlace: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("acepta enlace vacío o https", () => {
    expect(
      comunicadoInputSchema.safeParse({ ...base, enlace: "" }).success,
    ).toBe(true);
    expect(
      comunicadoInputSchema.safeParse({ ...base, enlace: "https://x.mx/a.pdf" })
        .success,
    ).toBe(true);
  });

  it("rechaza categoría desconocida", () => {
    expect(
      comunicadoInputSchema.safeParse({ ...base, categoria: "otra" }).success,
    ).toBe(false);
  });
});

describe("comunicadoPatchSchema", () => {
  it("no inyecta defaults en un patch parcial", () => {
    expect(comunicadoPatchSchema.parse({ fijado: true })).toEqual({
      fijado: true,
    });
  });
});

describe("ordenarComunicados", () => {
  it("pone fijados primero y luego por fecha descendente", () => {
    const lista = [
      { id: "a", fijado: false, fecha: "2026-10-01T00:00:00.000Z" },
      { id: "b", fijado: true, fecha: "2026-09-01T00:00:00.000Z" },
      { id: "c", fijado: false, fecha: "2026-10-15T00:00:00.000Z" },
    ];
    expect(ordenarComunicados(lista).map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
});
