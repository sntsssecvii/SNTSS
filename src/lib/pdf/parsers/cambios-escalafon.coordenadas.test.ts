import { describe, it, expect } from "vitest";
import {
  detectarAnclaDeItem,
  detectarAnclasColumnas,
  columnaDe,
  construirRegistrosPorCoordenadas,
  type PaginaCoord,
} from "./cambios-escalafon";

// Coordenadas reales del layout SIAP "LISTADO GENERAL DE SOLICITUDES DE CAMBIO"
// (tomadas de un PDF real, pero con nombres/matrículas SINTÉTICOS — sin PII).
const cell = (x: number, y: number, text: string) => ({ x, y, text });

// Encabezado de columnas (dos renglones, como en el PDF real).
const headerRows = [
  {
    y: 444,
    items: [
      cell(18, 444, "FECHA"),
      cell(65, 444, "HORA"),
      cell(114, 444, "NO."),
      cell(160, 444, "MATRICULA - NOMBRE"),
      cell(324, 444, "ADSCRIPCION"),
      cell(402, 444, "PERCIBE"),
      cell(456, 444, "ZONA"),
      cell(525, 444, "ADSCRIPCION"),
      cell(595, 444, "ESPECIALIDAD"),
      cell(656, 444, "TIPO"),
      cell(705, 444, "TURNO"),
      cell(755, 444, "CON"),
    ],
  },
  {
    y: 436,
    items: [
      cell(13, 436, "REGISTRO"),
      cell(58, 436, "REGISTRO"),
      cell(102, 436, "SOLICITUD"),
      cell(331, 436, "ORIGEN"),
      cell(398, 436, "CONCEPTO"),
      cell(530, 436, "SOLCITADA"),
      cell(612, 436, "AREA"),
      cell(697, 436, "SOLICITADO"),
      cell(741, 436, "CONCEPTOS"),
    ],
  },
];

function paginaConFilas(filasDatos: PaginaCoord["rows"]): PaginaCoord[] {
  return [{ page_number: 1, rows: [...headerRows, ...filasDatos] }];
}

describe("detectarAnclaDeItem", () => {
  it("mapea cada encabezado a su columna", () => {
    expect(detectarAnclaDeItem("FECHA")).toBe("fecha");
    expect(detectarAnclaDeItem("MATRICULA - NOMBRE")).toBe("matriculaNombre");
    expect(detectarAnclaDeItem("ORIGEN")).toBe("adscripcionOrigen");
    expect(detectarAnclaDeItem("PERCIBE")).toBe("percibeConcepto");
    expect(detectarAnclaDeItem("ZONA")).toBe("zona");
    // SIAP escribe "SOLCITADA" (con errata) — debe reconocerse igual
    expect(detectarAnclaDeItem("SOLCITADA")).toBe("adscripcionSolicitada");
    expect(detectarAnclaDeItem("SOLICITADA")).toBe("adscripcionSolicitada");
    expect(detectarAnclaDeItem("AREA")).toBe("especialidadArea");
    expect(detectarAnclaDeItem("TIPO")).toBe("tipo");
    expect(detectarAnclaDeItem("TURNO")).toBe("turnoSolicitado");
    expect(detectarAnclaDeItem("CONCEPTOS")).toBe("conConceptos");
  });

  it("no confunde 'CONCEPTO' (percibe) con 'CONCEPTOS' (con conceptos)", () => {
    expect(detectarAnclaDeItem("CONCEPTO")).not.toBe("conConceptos");
  });
});

describe("columnaDe", () => {
  it("asigna x a la columna correcta según las anclas", () => {
    const anclas = detectarAnclasColumnas(paginaConFilas([]))!;
    expect(anclas).not.toBeNull();
    expect(columnaDe(9, anclas)).toBe("fecha");
    expect(columnaDe(181, anclas)).toBe("matriculaNombre"); // nombre
    expect(columnaDe(146, anclas)).toBe("matriculaNombre"); // matrícula
    expect(columnaDe(301, anclas)).toBe("adscripcionOrigen");
    expect(columnaDe(439, anclas)).toBe("zona");
    expect(columnaDe(511, anclas)).toBe("adscripcionSolicitada");
    expect(columnaDe(617, anclas)).toBe("especialidadArea"); // 216, no el "30"
    expect(columnaDe(641, anclas)).toBe("tipo");
    expect(columnaDe(696, anclas)).toBe("turnoSolicitado");
    expect(columnaDe(761, anclas)).toBe("conConceptos");
  });
});

describe("construirRegistrosPorCoordenadas", () => {
  it("extrae un registro de adscripción incondicional con continuación multilínea", () => {
    const pages = paginaConFilas([
      {
        y: 424,
        items: [
          cell(9, 424, "25/06/2025"),
          cell(64, 424, "10:22:20"),
          cell(103, 424, "E250200394"),
          cell(146, 424, "99000001"),
          cell(181, 424, "PEREZ/LOPEZ/JUANA"),
          cell(301, 424, "HOSPITAL GENERAL DE ZONA"),
          cell(439, 424, "1-ENSENADA"),
          cell(511, 424, "0-INCONDICIONAL"),
          cell(617, 424, "216"),
          cell(641, 424, "ADSCRIPCIÓN"),
          cell(696, 424, "INCONDICIONAL"),
          cell(761, 424, "NO"),
        ],
      },
      // continuación: apellido sobrante + "30" del hospital de origen
      {
        y: 415,
        items: [cell(181, 415, "MARIA"), cell(301, 415, "30")],
      },
    ]);

    const regs = construirRegistrosPorCoordenadas(pages);
    expect(regs).toHaveLength(1);
    const r = regs[0];
    expect(r.fechaRegistro).toBe("25/06/2025");
    expect(r.horaRegistro).toBe("10:22:20");
    expect(r.noSolicitud).toBe("E250200394");
    expect(r.matricula).toBe("99000001");
    // nombre separado del origen, con la continuación fusionada
    expect(r.nombre).toBe("PEREZ/LOPEZ/JUANA MARIA");
    expect(r.adscripcionOrigen).toBe("HOSPITAL GENERAL DE ZONA 30");
    expect(r.zona).toBe("1-ENSENADA");
    // la adscripción "0-INCONDICIONAL" NO se pierde
    expect(r.adscripcionSolicitada).toBe("0-INCONDICIONAL");
    // área siempre 216, nunca el número de hospital (30)
    expect(r.especialidadArea).toBe(216);
    expect(r.tipo).toBe("ADSCRIPCIÓN");
    expect(r.turnoSolicitado).toBe("INCONDICIONAL");
    expect(r.percibeConcepto).toBe("");
    expect(r.conConceptos).toBe("NO");
  });

  it("fusiona adscripción solicitada partida en dos renglones", () => {
    const pages = paginaConFilas([
      {
        y: 352,
        items: [
          cell(9, 352, "15/01/2026"),
          cell(64, 352, "16:52:33"),
          cell(103, 352, "E260200036"),
          cell(146, 352, "99000002"),
          cell(181, 352, "GOMEZ/RUIZ/ANA"),
          cell(301, 352, "HOSPITAL GENERAL DE ZONA"),
          cell(439, 352, "1-ENSENADA"),
          cell(511, 352, "HOSPITAL GENERAL"),
          cell(617, 352, "216"),
          cell(641, 352, "ADSCRIPCIÓN"),
          cell(706, 352, "MATUTINO"),
          cell(761, 352, "NO"),
        ],
      },
      {
        y: 343,
        items: [cell(301, 343, "C/MF 08"), cell(511, 343, "REGIONAL 23")],
      },
    ]);

    const regs = construirRegistrosPorCoordenadas(pages);
    expect(regs).toHaveLength(1);
    expect(regs[0].adscripcionOrigen).toBe("HOSPITAL GENERAL DE ZONA C/MF 08");
    expect(regs[0].adscripcionSolicitada).toBe("HOSPITAL GENERAL REGIONAL 23");
    expect(regs[0].tipo).toBe("ADSCRIPCIÓN");
    expect(regs[0].turnoSolicitado).toBe("MATUTINO");
  });

  it("separa dos registros consecutivos por la fecha de la fila base", () => {
    const fila = (y: number, fecha: string, mat: string, nombre: string) => ({
      y,
      items: [
        cell(9, y, fecha),
        cell(64, y, "09:00:00"),
        cell(103, y, "E260200100"),
        cell(146, y, mat),
        cell(181, y, nombre),
        cell(301, y, "HOSPITAL GENERAL DE ZONA"),
        cell(439, y, "7-TIJUANA"),
        cell(511, y, "0-INCONDICIONAL"),
        cell(617, y, "216"),
        cell(641, y, "ADSCRIPCIÓN"),
        cell(696, y, "INCONDICIONAL"),
        cell(761, y, "NO"),
      ],
    });

    const pages = paginaConFilas([
      fila(300, "05/03/2026", "99000010", "UNO/UNO/UNO"),
      fila(280, "10/03/2026", "99000011", "DOS/DOS/DOS"),
    ]);

    const regs = construirRegistrosPorCoordenadas(pages);
    expect(regs).toHaveLength(2);
    expect(regs[0].matricula).toBe("99000010");
    expect(regs[1].matricula).toBe("99000011");
  });
});
