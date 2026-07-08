import { describe, it, expect } from "vitest";
import {
  calcularPosicionesCambios,
  esUnidadIncondicional,
} from "./position-engine";
import type { CambiosRegistro } from "@/types/cambios-escalafon";

// Helper: registro con valores por defecto (datos sintéticos, sin PII).
function reg(p: Partial<CambiosRegistro>): CambiosRegistro {
  return {
    listadoId: "L1",
    fechaRegistro: "01/01/2025",
    horaRegistro: "10:00:00",
    noSolicitud: "E000000001",
    matricula: "90000000",
    nombre: "APELLIDO/APELLIDO/NOMBRE",
    adscripcionOrigen: "HOSPITAL X",
    percibeConcepto: "NO",
    zona: "1-ENSENADA",
    adscripcionSolicitada: "HOSPITAL Y",
    especialidadArea: 216,
    tipo: "TURNO",
    turnoSolicitado: "MATUTINO",
    conConceptos: "NO",
    ...p,
  };
}

describe("esUnidadIncondicional", () => {
  it("reconoce las variantes incondicionales", () => {
    expect(esUnidadIncondicional("0-INCONDICIONAL")).toBe(true);
    expect(esUnidadIncondicional("INCONDICIONAL")).toBe(true);
    expect(esUnidadIncondicional("HOSPITAL GENERAL DE ZONA C/MF 08")).toBe(
      false,
    );
  });
});

describe("calcularPosicionesCambios", () => {
  it("ordena por fecha de registro dentro del mismo turno (caso Gómez/Bórquez)", () => {
    const registros = [
      reg({
        matricula: "B2026",
        zona: "1-ENSENADA",
        adscripcionSolicitada: "HGZ 08",
        tipo: "TURNO",
        turnoSolicitado: "NOCTURNO",
        fechaRegistro: "04/02/2026",
        horaRegistro: "13:18:36",
      }),
      reg({
        matricula: "G2023",
        zona: "1-ENSENADA",
        adscripcionSolicitada: "HGZ 08",
        tipo: "TURNO",
        turnoSolicitado: "NOCTURNO",
        fechaRegistro: "04/01/2023",
        horaRegistro: "13:57:24",
      }),
    ];

    const pos = calcularPosicionesCambios(registros);
    const nocturno = pos.filter((p) => p.turno === "NOCTURNO");
    expect(nocturno).toHaveLength(2);
    const g = nocturno.find((p) => p.registro.matricula === "G2023")!;
    const b = nocturno.find((p) => p.registro.matricula === "B2026")!;
    expect(g.lugar).toBe(1); // registrada en 2023 → primero
    expect(b.lugar).toBe(2);
    expect(g.totalEnGrupo).toBe(2);
  });

  it("no mezcla turnos distintos: cada quien compite con su mismo turno", () => {
    const registros = [
      reg({
        matricula: "NOC",
        adscripcionSolicitada: "HGZ 08",
        turnoSolicitado: "NOCTURNO",
      }),
      reg({
        matricula: "MAT",
        adscripcionSolicitada: "HGZ 08",
        turnoSolicitado: "MATUTINO",
      }),
    ];
    const pos = calcularPosicionesCambios(registros);
    // Cada uno es #1 de su propio grupo (turno distinto)
    for (const p of pos) {
      expect(p.lugar).toBe(1);
      expect(p.totalEnGrupo).toBe(1);
    }
  });

  it("prioriza TURNO sobre ADSCRIPCIÓN en el mismo grupo (unidad + turno)", () => {
    const registros = [
      reg({
        matricula: "ADS",
        adscripcionSolicitada: "HGZ 08",
        turnoSolicitado: "NOCTURNO",
        tipo: "ADSCRIPCIÓN",
        fechaRegistro: "01/01/2020", // más antigua, pero adscripción
      }),
      reg({
        matricula: "TUR",
        adscripcionSolicitada: "HGZ 08",
        turnoSolicitado: "NOCTURNO",
        tipo: "TURNO",
        fechaRegistro: "01/01/2025", // más reciente, pero turno
      }),
    ];
    const pos = calcularPosicionesCambios(registros);
    const tur = pos.find((p) => p.registro.matricula === "TUR")!;
    const ads = pos.find((p) => p.registro.matricula === "ADS")!;
    expect(tur.lugar).toBe(1); // turno entra primero aunque sea más reciente
    expect(ads.lugar).toBe(2);
  });

  it("prelación completa: turno → área → adscripción percibe → adscripción no percibe (sin importar fecha)", () => {
    const base = {
      adscripcionSolicitada: "HGR 23",
      turnoSolicitado: "MATUTINO",
    };
    const registros = [
      reg({
        matricula: "ADS_NO",
        ...base,
        tipo: "ADSCRIPCIÓN",
        percibeConcepto: "NO",
        fechaRegistro: "01/01/2019",
      }),
      reg({
        matricula: "ADS_SI",
        ...base,
        tipo: "ADSCRIPCIÓN",
        percibeConcepto: "SI",
        fechaRegistro: "01/01/2020",
      }),
      reg({
        matricula: "AREA",
        ...base,
        tipo: "ÁREA",
        fechaRegistro: "01/01/2021",
      }),
      reg({
        matricula: "TURNO",
        ...base,
        tipo: "TURNO",
        fechaRegistro: "01/01/2026", // la más reciente, pero turno entra primero
      }),
    ];
    const pos = calcularPosicionesCambios(registros);
    const porMat = Object.fromEntries(
      pos.map((p) => [p.registro.matricula, p.lugar]),
    );
    expect(porMat["TURNO"]).toBe(1);
    expect(porMat["AREA"]).toBe(2);
    expect(porMat["ADS_SI"]).toBe(3); // adscripción que percibe
    expect(porMat["ADS_NO"]).toBe(4); // adscripción que no percibe
  });

  it("reparte un incondicional en cada unidad de la zona, tomando el turno solicitado en esa unidad", () => {
    const registros = [
      reg({
        matricula: "CONCRETA1",
        adscripcionSolicitada: "HGZ 08",
        turnoSolicitado: "NOCTURNO",
        tipo: "TURNO",
      }),
      reg({
        matricula: "CONCRETA2",
        adscripcionSolicitada: "HGR 23",
        turnoSolicitado: "MATUTINO",
        tipo: "TURNO",
      }),
      reg({
        matricula: "INCOND",
        adscripcionSolicitada: "0-INCONDICIONAL",
        turnoSolicitado: "INCONDICIONAL",
        tipo: "ADSCRIPCIÓN",
      }),
    ];
    const pos = calcularPosicionesCambios(registros);
    const delIncond = pos.filter((p) => p.registro.matricula === "INCOND");
    // Aparece en las dos unidades concretas, adoptando el turno de cada una
    // (acepta cualquier turno), no un turno "INCONDICIONAL" aislado.
    const grupos = new Set(delIncond.map((p) => `${p.unidad}/${p.turno}`));
    expect(grupos).toEqual(new Set(["HGZ 08/NOCTURNO", "HGR 23/MATUTINO"]));
  });

  it("un incondicional compite contra las concretas de la unidad y rankea por antigüedad (caso EVODIA)", () => {
    const registros = [
      // Concreta vespertino en HGR 01, registrada al mediodía.
      reg({
        matricula: "EVODIA",
        adscripcionSolicitada: "HGR 01",
        turnoSolicitado: "VESPERTINO",
        tipo: "ADSCRIPCIÓN",
        fechaRegistro: "10/03/2026",
        horaRegistro: "12:03:00",
      }),
      // Incondicional registrada 5 días antes → debe quedar arriba.
      reg({
        matricula: "TAPIA",
        adscripcionSolicitada: "0-INCONDICIONAL",
        turnoSolicitado: "INCONDICIONAL",
        tipo: "ADSCRIPCIÓN",
        fechaRegistro: "05/03/2026",
        horaRegistro: "11:04:18",
      }),
      // Incondicional el mismo día pero más temprano → también arriba.
      reg({
        matricula: "LIZARRAGA",
        adscripcionSolicitada: "0-INCONDICIONAL",
        turnoSolicitado: "INCONDICIONAL",
        tipo: "ADSCRIPCIÓN",
        fechaRegistro: "10/03/2026",
        horaRegistro: "09:09:31",
      }),
    ];
    const pos = calcularPosicionesCambios(registros);
    // Los incondicionales entran al grupo HGR 01 / VESPERTINO de EVODIA.
    const grupo = pos.filter(
      (p) => p.unidad === "HGR 01" && p.turno === "VESPERTINO",
    );
    const porMat = Object.fromEntries(
      grupo.map((p) => [p.registro.matricula, p.lugar]),
    );
    expect(porMat["TAPIA"]).toBe(1); // más antiguo
    expect(porMat["LIZARRAGA"]).toBe(2); // mismo día, más temprano
    expect(porMat["EVODIA"]).toBe(3); // registrada al mediodía
    expect(grupo.find((p) => p.registro.matricula === "EVODIA")!.totalEnGrupo).toBe(3);
  });
});
