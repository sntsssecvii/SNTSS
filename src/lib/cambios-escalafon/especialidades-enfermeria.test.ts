import { describe, it, expect } from "vitest";
import { nombreListadoConEspecialidad } from "./especialidades-enfermeria";

describe("nombreListadoConEspecialidad — ESPECIALISTA (22210080)", () => {
  it("resuelve la especialidad por área", () => {
    const base = "ENFERMERA ESPECIALISTA 80";
    expect(nombreListadoConEspecialidad(base, 216)).toBe(
      "ENFERMERA ESPECIALISTA QUIRÚRGICA",
    );
    expect(nombreListadoConEspecialidad(base, 232)).toBe(
      "ENFERMERA ESPECIALISTA PEDIATRA",
    );
    expect(nombreListadoConEspecialidad(base, 248)).toBe(
      "ENFERMERA ESPECIALISTA EN CUIDADOS INTENSIVOS",
    );
    expect(nombreListadoConEspecialidad(base, 204)).toBe(
      "ENFERMERA ESPECIALISTA EN MEDICINA DE FAMILIA",
    );
    expect(nombreListadoConEspecialidad(base, "226")).toBe(
      "ENFERMERA ESPECIALISTA EN NEFROLOGÍA",
    );
  });
});

describe("nombreListadoConEspecialidad — JEFE DE PISO (23210080)", () => {
  it("distingue jefe de piso por área, aunque comparta área con especialista", () => {
    const base = "ENFERMERA JEFE DE PISO 80";
    // Área 204 la comparten especialista y jefe de piso: el nombre base decide.
    expect(nombreListadoConEspecialidad(base, 204)).toBe(
      "ENFERMERA JEFE DE PISO MEDICINA DE FAMILIA",
    );
    // Área 284 es el jefe de piso genérico: conserva el nombre del SIAP.
    expect(nombreListadoConEspecialidad(base, 284)).toBe(
      "ENFERMERA JEFE DE PISO 80",
    );
  });

  it("no usa el mapa de especialista para un jefe de piso con área 204", () => {
    expect(nombreListadoConEspecialidad("ENFERMERA JEFE DE PISO 80", 204)).not.toBe(
      "ENFERMERA ESPECIALISTA EN MEDICINA DE FAMILIA",
    );
  });
});

describe("nombreListadoConEspecialidad — fallbacks", () => {
  it("conserva el nombre original si no es enfermería aunque el área coincida", () => {
    expect(nombreListadoConEspecialidad("AYUDANTE DE FARMACIA 80", 216)).toBe(
      "AYUDANTE DE FARMACIA 80",
    );
  });

  it("conserva el nombre original si el área no está mapeada o es 0/vacía", () => {
    expect(nombreListadoConEspecialidad("ENFERMERA ESPECIALISTA 80", 999)).toBe(
      "ENFERMERA ESPECIALISTA 80",
    );
    expect(nombreListadoConEspecialidad("ENFERMERA ESPECIALISTA 80", 0)).toBe(
      "ENFERMERA ESPECIALISTA 80",
    );
    expect(nombreListadoConEspecialidad("ENFERMERA JEFE DE PISO 80", null)).toBe(
      "ENFERMERA JEFE DE PISO 80",
    );
  });
});
