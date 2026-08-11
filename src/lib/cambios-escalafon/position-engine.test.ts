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

  it("los incondicionales van en grupo separado por zona, NO mezclados con las unidades concretas", () => {
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
    // El incondicional cae en UN solo grupo (zona + INCONDICIONAL), no en las
    // unidades concretas.
    const delIncond = pos.filter((p) => p.registro.matricula === "INCOND");
    expect(delIncond).toHaveLength(1);
    expect(delIncond[0].unidad).toBe("0-INCONDICIONAL");
    expect(delIncond[0].turno).toBe("INCONDICIONAL");
    expect(delIncond[0].lugar).toBe(1);
    expect(delIncond[0].totalEnGrupo).toBe(1);
    // Las concretas quedan solas (#1 de su grupo), sin el incondicional dentro.
    const c1 = pos.find((p) => p.registro.matricula === "CONCRETA1")!;
    expect(c1.totalEnGrupo).toBe(1);
    const c2 = pos.find((p) => p.registro.matricula === "CONCRETA2")!;
    expect(c2.totalEnGrupo).toBe(1);
  });

  it("los incondicionales de una zona compiten SOLO entre ellos, por antigüedad (caso Tijuana)", () => {
    const registros = [
      // Concretas ya en Tijuana pidiendo cambio interno: grupo aparte.
      reg({
        matricula: "INTERNA",
        zona: "7-TIJUANA",
        adscripcionSolicitada: "HGR 20",
        turnoSolicitado: "VESPERTINO",
        tipo: "ÁREA",
        fechaRegistro: "29/10/2025",
      }),
      // Incondicionales a Tijuana: rankean entre sí por fecha de registro.
      reg({
        matricula: "TIRADO",
        zona: "7-TIJUANA",
        adscripcionSolicitada: "0-INCONDICIONAL",
        turnoSolicitado: "INCONDICIONAL",
        tipo: "ADSCRIPCIÓN",
        fechaRegistro: "10/03/2026",
        horaRegistro: "11:11:19",
      }),
      reg({
        matricula: "PALAFOX",
        zona: "7-TIJUANA",
        adscripcionSolicitada: "0-INCONDICIONAL",
        turnoSolicitado: "INCONDICIONAL",
        tipo: "ADSCRIPCIÓN",
        fechaRegistro: "17/07/2026",
        horaRegistro: "14:19:10",
      }),
      reg({
        matricula: "MENDOZA",
        zona: "7-TIJUANA",
        adscripcionSolicitada: "0-INCONDICIONAL",
        turnoSolicitado: "INCONDICIONAL",
        tipo: "ADSCRIPCIÓN",
        fechaRegistro: "05/08/2026",
        horaRegistro: "09:10:56",
      }),
    ];
    const pos = calcularPosicionesCambios(registros);
    const incond = pos.filter(
      (p) => p.unidad === "0-INCONDICIONAL" && p.zona === "7-TIJUANA",
    );
    const porMat = Object.fromEntries(
      incond.map((p) => [p.registro.matricula, p.lugar]),
    );
    expect(porMat["TIRADO"]).toBe(1);
    expect(porMat["PALAFOX"]).toBe(2);
    expect(porMat["MENDOZA"]).toBe(3);
    expect(incond).toHaveLength(3); // la concreta NO entra a este grupo
    // La concreta interna queda en su propio grupo, sin incondicionales.
    const interna = pos.find((p) => p.registro.matricula === "INTERNA")!;
    expect(interna.unidad).toBe("HGR 20");
    expect(interna.totalEnGrupo).toBe(1);
  });
});
