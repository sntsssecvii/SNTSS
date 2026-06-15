import { describe, it, expect } from "vitest";
import path from "path";
import {
  parsearListadoCondicionalidad,
  normalizarZona,
  esFilaEncabezadoColumnas,
} from "../escalafon-condicionalidad";

const FIXTURES = path.join(process.cwd(), "src/assets/PDFs/escalafon");

/**
 * Los PDFs de SIAP declaran un totalAspirantes que incluye aspirantes
 * dados de baja / eliminados cuyos números de lugar se omiten.
 * Los conteos reales extraíbles son menores al declarado.
 */

describe("parsearListadoCondicionalidad", () => {
  describe("quirúrgica (declara 108, tiene 93 extraíbles)", () => {
    it("extrae el header correctamente", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-quirurgica.pdf"),
      );
      expect(result.listado.totalAspirantes).toBe(108);
      expect(result.listado.areaDesc).toContain("QUIRURGICA");
      expect(result.listado.periodoDecierre).toBeTruthy();
      expect(result.listado.numeroListado).toBeTruthy();
    });

    it("extrae 93 aspirantes únicos presentes en el PDF", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-quirurgica.pdf"),
      );
      expect(result.aspirantes).toHaveLength(93);
    });

    it("agrupa preferencias múltiples del mismo aspirante", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-quirurgica.pdf"),
      );
      const conMultiples = result.aspirantes.filter(
        (a) => a.preferencias.length > 1,
      );
      expect(conMultiples.length).toBeGreaterThan(0);
    });

    it("emite advertencia por diferencia en conteo, sin errores críticos", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-quirurgica.pdf"),
      );
      // Solo advertencias de conteo, no errores de parseo
      const criticos = result.errores.filter(
        (e) => !e.startsWith("Advertencia"),
      );
      expect(criticos).toHaveLength(0);
      // Debe haber advertencia por 108 vs 93
      expect(
        result.errores.some((e) => e.includes("108") && e.includes("93")),
      ).toBe(true);
    });
  });

  describe("pediatría (declara 36, tiene 30 extraíbles)", () => {
    it("extrae 30 aspirantes únicos presentes en el PDF", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-pediatra.pdf"),
      );
      expect(result.aspirantes).toHaveLength(30);
    });

    it("el header tiene totalAspirantes 36", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-pediatra.pdf"),
      );
      expect(result.listado.totalAspirantes).toBe(36);
    });
  });

  describe("farmacia (declara 59, tiene 29 extraíbles)", () => {
    it("extrae 29 aspirantes únicos presentes en el PDF", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-farmacia.pdf"),
      );
      expect(result.aspirantes).toHaveLength(29);
    });

    it("totalAspirantes es 59", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-farmacia.pdf"),
      );
      expect(result.listado.totalAspirantes).toBe(59);
    });
  });

  describe("normalizarZona", () => {
    it("repara la zona incondicional truncada/multilínea del PDF", () => {
      expect(normalizarZona("0\r\nINCONDICIONA")).toBe("0 Incondicional");
      expect(normalizarZona("0 Incondicional")).toBe("0 Incondicional");
    });

    it("normaliza incondicional sin código numérico", () => {
      expect(normalizarZona("INCONDICIONAL")).toBe("Incondicional");
    });

    it("colapsa whitespace interno pero conserva zonas reales", () => {
      expect(normalizarZona("7 TIJUANA")).toBe("7 TIJUANA");
      expect(normalizarZona("1\r\nENSENADA")).toBe("1 ENSENADA");
    });

    it("devuelve Incondicional para celda vacía", () => {
      expect(normalizarZona("")).toBe("Incondicional");
      expect(normalizarZona("   ")).toBe("Incondicional");
    });
  });

  describe("esFilaEncabezadoColumnas", () => {
    it("detecta la fila de encabezado repetida del PDF", () => {
      const header = [
        "LUG. ESC",
        "ESTATUS",
        "MATRICULA",
        "NOMBRE",
        "DELEG",
        "FECHA",
        "DELEGACION SOLICITADA",
        "ZONA SOLICITADA",
        "LOCALIDAD SOLICITADA",
        "ADSCRIPCION SOLICITADA",
        "TURNO SOLICITADO",
      ];
      expect(esFilaEncabezadoColumnas(header)).toBe(true);
    });

    it("no marca una fila de datos real como encabezado", () => {
      const fila = [1, "Activo", "123", "PEREZ", "02", 45539, "02 BC", "7 TIJUANA"];
      expect(esFilaEncabezadoColumnas(fila)).toBe(false);
    });
  });
});
