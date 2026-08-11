import { describe, it, expect } from "vitest";
import {
  detectarTipoDocumentoPorNombre,
  type TipoBolsaDeTrabajo,
} from "../bolsa-de-trabajo";

describe("detectarTipoDocumentoPorNombre", () => {
  // Nombres reales del corte quincenal (SIAP) en SINGULAR — corte 11 AGO 2026.
  // Regresión: antes solo detectaba NUEVO INGRESO (1/8).
  const singular: Array<[string, TipoBolsaDeTrabajo]> = [
    ["AMPLIACION DE JORNADA.pdf", "AMPLIACIONES_JORNADA"],
    ["CAMBIO DE AREA.pdf", "CAMBIOS_AREA"],
    ["CAMBIO DE RAMA.pdf", "CAMBIOS_RAMA"],
    ["CAMBIO DE RESIDENCIA DESTINO.pdf", "CAMBIOS_RESIDENCIA_DESTINO"],
    ["CAMBIO DE RESIDENCIA ORIGEN.pdf", "CAMBIOS_RESIDENCIA_ORIGEN"],
    ["CAMBIO DE TURNO ADSCRIPCION.pdf", "CAMBIOS_TURNO_ADSCRIPCION"],
    ["CAMBIO TIPO DE PLAZA.pdf", "CAMBIOS_TIPO_PLAZA"],
    ["NUEVO INGRESO.pdf", "NUEVO_INGRESO"],
  ];

  it.each(singular)("detecta nombre singular %s", (nombre, esperado) => {
    expect(detectarTipoDocumentoPorNombre(nombre)).toBe(esperado);
  });

  // Formato plural histórico — no debe romperse.
  const plural: Array<[string, TipoBolsaDeTrabajo]> = [
    ["AMPLIACIONES DE JORNADA.pdf", "AMPLIACIONES_JORNADA"],
    ["CAMBIOS DE ÁREA.pdf", "CAMBIOS_AREA"],
    ["CAMBIOS DE RAMA.pdf", "CAMBIOS_RAMA"],
    ["CAMBIOS DE RESIDENCIA DESTINO.pdf", "CAMBIOS_RESIDENCIA_DESTINO"],
    ["CAMBIOS DE RESIDENCIA ORIGEN.pdf", "CAMBIOS_RESIDENCIA_ORIGEN"],
    ["CAMBIOS DE TURNO Y-O ADSCRIPCIÓN.pdf", "CAMBIOS_TURNO_ADSCRIPCION"],
    ["CAMBIOS DE TIPO DE PLAZA.pdf", "CAMBIOS_TIPO_PLAZA"],
    ["NUEVO INGRESO.pdf", "NUEVO_INGRESO"],
  ];

  it.each(plural)("detecta nombre plural %s", (nombre, esperado) => {
    expect(detectarTipoDocumentoPorNombre(nombre)).toBe(esperado);
  });

  it("devuelve null para nombre sin coincidencia", () => {
    expect(
      detectarTipoDocumentoPorNombre("documento cualquiera.pdf"),
    ).toBeNull();
    expect(detectarTipoDocumentoPorNombre("")).toBeNull();
    expect(detectarTipoDocumentoPorNombre(undefined)).toBeNull();
  });
});
