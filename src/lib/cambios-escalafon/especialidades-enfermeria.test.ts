import { describe, it, expect } from "vitest";
import {
  especialidadEnfermeria,
  nombreListadoConEspecialidad,
} from "./especialidades-enfermeria";

describe("especialidadEnfermeria", () => {
  it("mapea los códigos de área conocidos", () => {
    expect(especialidadEnfermeria(216)).toBe("ENFERMERA ESPECIALISTA QUIRÚRGICA");
    expect(especialidadEnfermeria(232)).toBe("ENFERMERA ESPECIALISTA PEDIATRA");
    expect(especialidadEnfermeria(248)).toBe(
      "ENFERMERA ESPECIALISTA EN CUIDADOS INTENSIVOS",
    );
    expect(especialidadEnfermeria(200)).toBe("ENFERMERA JEFE DE PISO");
    expect(especialidadEnfermeria(226)).toBe(
      "ENFERMERA ESPECIALISTA EN NEFROLOGÍA",
    );
    expect(especialidadEnfermeria(239)).toBe(
      "ENFERMERA ESPECIALISTA EN GERIATRÍA",
    );
  });

  it("acepta el área como string", () => {
    expect(especialidadEnfermeria("216")).toBe(
      "ENFERMERA ESPECIALISTA QUIRÚRGICA",
    );
  });

  it("devuelve null para área no mapeada, 0 o vacío", () => {
    expect(especialidadEnfermeria(999)).toBeNull();
    expect(especialidadEnfermeria(0)).toBeNull();
    expect(especialidadEnfermeria("")).toBeNull();
    expect(especialidadEnfermeria(null)).toBeNull();
    expect(especialidadEnfermeria(undefined)).toBeNull();
  });
});

describe("nombreListadoConEspecialidad", () => {
  it("usa la especialidad cuando es enfermería y el área está mapeada", () => {
    expect(
      nombreListadoConEspecialidad("ENFERMERA ESPECIALISTA 80", 216),
    ).toBe("ENFERMERA ESPECIALISTA QUIRÚRGICA");
    expect(nombreListadoConEspecialidad("ENFERMERA JEFE DE PISO 80", 200)).toBe(
      "ENFERMERA JEFE DE PISO",
    );
  });

  it("conserva el nombre original si no es enfermería aunque el área coincida", () => {
    expect(nombreListadoConEspecialidad("AYUDANTE DE FARMACIA 80", 216)).toBe(
      "AYUDANTE DE FARMACIA 80",
    );
  });

  it("conserva el nombre original si el área no está mapeada", () => {
    expect(nombreListadoConEspecialidad("ENFERMERA ESPECIALISTA 80", 0)).toBe(
      "ENFERMERA ESPECIALISTA 80",
    );
  });
});
