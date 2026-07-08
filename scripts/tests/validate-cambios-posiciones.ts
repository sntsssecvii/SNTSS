// scripts/tests/validate-cambios-posiciones.ts
// Valida el motor de posiciones de CAMBIOS DE ESCALAFÓN contra datos reales.
// Jala todos los listados + registros de Firestore, corre calcularPosicionesCambios
// por listado y reporta:
//   - Grupos competidos (2+ solicitudes por unidad+turno) para inspección manual.
//   - Casos donde la prelación por TIPO decide (no sólo antigüedad).
//   - Incondicionales y cómo se reparten.
//   - Datos sospechosos (tipos fuera del ranking, turnos raros, fechas inválidas).
//
// Ejecutar:
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
//     npx ts-node -r tsconfig-paths/register scripts/tests/validate-cambios-posiciones.ts

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as nodePath from "node:path";
import * as nodeFs from "node:fs";
import {
  calcularPosicionesCambios,
} from "../../src/lib/cambios-escalafon/position-engine";
import type {
  CambiosListado,
  CambiosRegistro,
} from "../../src/types/cambios-escalafon";

const ROOT = process.cwd();

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  nodePath.join(
    process.env.HOME || "",
    ".config/firebase/sntss-service-account.json",
  );

if (!nodeFs.existsSync(serviceAccountPath)) {
  console.error(`Service account no encontrado: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(nodeFs.readFileSync(serviceAccountPath, "utf8"));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const COL_LISTADOS = "cambios_listados";
const COL_REGISTROS = "cambios_registros";

// Ranking canónico esperado (espejo del engine) para detectar tipos no mapeados.
const TIPOS_CONOCIDOS = new Set([
  "TURNO",
  "ÁREA",
  "AREA",
  "TIPO DE PLAZA",
  "ADSCRIPCIÓN",
  "ADSCRIPCION",
  "RESIDENCIA",
]);

const TURNOS_CONOCIDOS = new Set([
  "MATUTINO",
  "VESPERTINO",
  "NOCTURNO",
  "INCONDICIONAL",
  "JORNADA ACUMULADA",
  "",
]);

function fmtReg(r: CambiosRegistro): string {
  return `${r.matricula} ${r.nombre} · tipo=${r.tipo} · percibe=${r.percibeConcepto} · ${r.fechaRegistro} ${r.horaRegistro}`;
}

function fechaInvalida(r: CambiosRegistro): boolean {
  const p = (r.fechaRegistro ?? "").split("/");
  if (p.length !== 3) return true;
  const [d, m, y] = p.map((x) => parseInt(x, 10));
  return !(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2100);
}

async function main() {
  const listadosSnap = await db
    .collection(COL_LISTADOS)
    .orderBy("registrosParsed", "desc")
    .get();

  const listados = listadosSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<CambiosListado, "id">),
  }));

  console.log(`\n=== VALIDACIÓN MOTOR POSICIONES CAMBIOS ===`);
  console.log(`Listados: ${listados.length}\n`);

  // Acumuladores globales para el resumen final.
  const tiposDesconocidos = new Map<string, number>();
  const turnosDesconocidos = new Map<string, number>();
  let totalRegistros = 0;
  let totalGruposCompetidos = 0;
  let totalDecididosPorTipo = 0; // grupos donde la prelación por tipo cambió el orden vs. sólo-fecha
  let totalFechasInvalidas = 0;
  const casosDestacados: string[] = [];

  for (const listado of listados) {
    const regsSnap = await db
      .collection(COL_REGISTROS)
      .where("listadoId", "==", listado.id)
      .get();
    const registros: CambiosRegistro[] = regsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CambiosRegistro, "id">),
    }));
    totalRegistros += registros.length;

    // Higiene de datos.
    for (const r of registros) {
      const tipoU = (r.tipo ?? "").toUpperCase().trim();
      if (!TIPOS_CONOCIDOS.has(tipoU)) {
        tiposDesconocidos.set(tipoU, (tiposDesconocidos.get(tipoU) ?? 0) + 1);
      }
      const turnoU = (r.turnoSolicitado ?? "").toUpperCase().trim();
      if (!TURNOS_CONOCIDOS.has(turnoU)) {
        turnosDesconocidos.set(turnoU, (turnosDesconocidos.get(turnoU) ?? 0) + 1);
      }
      if (fechaInvalida(r)) totalFechasInvalidas++;
    }

    const posiciones = calcularPosicionesCambios(registros);

    // Agrupar posiciones por grupo (zona:::unidad:::turno).
    const porGrupo = new Map<
      string,
      { zona: string; unidad: string; turno: string; items: typeof posiciones }
    >();
    for (const p of posiciones) {
      const k = `${p.zona}:::${p.unidad}:::${p.turno}`;
      if (!porGrupo.has(k))
        porGrupo.set(k, { zona: p.zona, unidad: p.unidad, turno: p.turno, items: [] });
      porGrupo.get(k)!.items.push(p);
    }

    const gruposCompetidos = [...porGrupo.values()].filter(
      (g) => g.items.length > 1,
    );
    totalGruposCompetidos += gruposCompetidos.length;

    // ¿La prelación por tipo cambió el orden respecto a ordenar sólo por fecha?
    const decididosPorTipo = gruposCompetidos.filter((g) => {
      const tipos = new Set(g.items.map((it) => (it.registro.tipo ?? "").toUpperCase().trim()));
      const percibe = new Set(g.items.map((it) => (it.registro.percibeConcepto ?? "").trim().toUpperCase().startsWith("S")));
      // Sólo relevante si hay más de un tipo, o adscripciones con distinto percibe.
      return tipos.size > 1 || (tipos.has("ADSCRIPCIÓN") && percibe.size > 1) || (tipos.has("ADSCRIPCION") && percibe.size > 1);
    });
    totalDecididosPorTipo += decididosPorTipo.length;

    // Reportar por listado sólo si tiene algo interesante.
    if (gruposCompetidos.length === 0 && decididosPorTipo.length === 0) continue;

    const etiqueta = `${listado.categoriaDesc} [${listado.categoriaCode}${listado.concepto ? " · " + listado.concepto : ""}] (${registros.length} reg)`;
    console.log(`\n### ${etiqueta}`);
    console.log(
      `   grupos competidos: ${gruposCompetidos.length} · decididos por prelación de tipo/percibe: ${decididosPorTipo.length}`,
    );

    for (const g of decididosPorTipo.slice(0, 8)) {
      const orden = g.items.slice().sort((a, b) => a.lugar - b.lugar);
      console.log(`   • Grupo ${g.zona} / ${g.unidad} / ${g.turno} (${g.items.length}):`);
      for (const it of orden) {
        console.log(`       #${it.lugar}  ${fmtReg(it.registro)}`);
      }
      // Marcar como caso destacado (a revisar con Subcomisión).
      const tiposEnGrupo = [...new Set(orden.map((it) => it.registro.tipo))].join("+");
      casosDestacados.push(
        `${etiqueta} → ${g.unidad}/${g.turno}: ${orden.length} solicitudes, tipos [${tiposEnGrupo}]`,
      );
    }
  }

  // ---- Diagnóstico dirigido: ¿percibe subdivide dentro del MISMO tipo? ----
  // Re-recorremos para encontrar grupos con 2+ registros del mismo tipo y
  // distinto percibe (caso que probaría si la regla percibe aplica más allá de
  // ADSCRIPCIÓN). También listamos registros con turno "MOVIL".
  console.log(`\n\n=== DIAGNÓSTICO DIRIGIDO ===`);
  const mismoTipoDistintoPercibe: string[] = [];
  const registrosMovil: string[] = [];

  for (const listado of listados) {
    const regsSnap = await db
      .collection(COL_REGISTROS)
      .where("listadoId", "==", listado.id)
      .get();
    const registros: CambiosRegistro[] = regsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CambiosRegistro, "id">),
    }));

    for (const r of registros) {
      if ((r.turnoSolicitado ?? "").toUpperCase().trim() === "MOVIL") {
        registrosMovil.push(
          `${listado.categoriaDesc} → ${fmtReg(r)} · zona=${r.zona} · unidad=${r.adscripcionSolicitada}`,
        );
      }
    }

    const posiciones = calcularPosicionesCambios(registros);
    const porGrupo = new Map<string, typeof posiciones>();
    for (const p of posiciones) {
      const k = `${p.zona}:::${p.unidad}:::${p.turno}`;
      if (!porGrupo.has(k)) porGrupo.set(k, []);
      porGrupo.get(k)!.push(p);
    }
    for (const [k, items] of porGrupo) {
      // Agrupar por tipo dentro del grupo.
      const porTipo = new Map<string, typeof items>();
      for (const it of items) {
        const t = (it.registro.tipo ?? "").toUpperCase().trim();
        if (!porTipo.has(t)) porTipo.set(t, []);
        porTipo.get(t)!.push(it);
      }
      for (const [t, arr] of porTipo) {
        if (arr.length < 2) continue;
        const percibeVals = new Set(
          arr.map((it) => (it.registro.percibeConcepto ?? "").trim().toUpperCase().startsWith("S")),
        );
        if (percibeVals.size > 1) {
          const orden = arr.slice().sort((a, b) => a.lugar - b.lugar);
          mismoTipoDistintoPercibe.push(
            `${listado.categoriaDesc}${listado.concepto ? " " + listado.concepto : ""} · ${k.replace(/:::/g, " / ")} · tipo=${t}:\n` +
              orden.map((it) => `      #${it.lugar} percibe=${it.registro.percibeConcepto || "-"} ${it.registro.matricula} ${it.registro.fechaRegistro} ${it.registro.horaRegistro}`).join("\n"),
          );
        }
      }
    }
  }

  console.log(`\n-- Grupos con MISMO tipo y DISTINTO percibe (${mismoTipoDistintoPercibe.length}) --`);
  console.log(`   (si aquí el que percibe queda arriba aunque sea más nuevo, percibe SÍ subdivide ese tipo)`);
  if (mismoTipoDistintoPercibe.length === 0) console.log("   (ninguno en los datos reales)");
  for (const c of mismoTipoDistintoPercibe) console.log(`   • ${c}`);

  console.log(`\n-- Registros con turno "MOVIL" (${registrosMovil.length}) --`);
  for (const c of registrosMovil) console.log(`   • ${c}`);

  console.log(`\n\n=== RESUMEN GLOBAL ===`);
  console.log(`Registros totales:            ${totalRegistros}`);
  console.log(`Grupos competidos (2+):       ${totalGruposCompetidos}`);
  console.log(`Grupos decididos por tipo:    ${totalDecididosPorTipo}`);
  console.log(`Fechas de registro inválidas: ${totalFechasInvalidas}`);

  console.log(`\n-- Tipos de cambio NO mapeados en el ranking --`);
  if (tiposDesconocidos.size === 0) console.log("   (ninguno)");
  for (const [t, n] of [...tiposDesconocidos.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${n.toString().padStart(4)}  "${t}"`);
  }

  console.log(`\n-- Turnos NO reconocidos --`);
  if (turnosDesconocidos.size === 0) console.log("   (ninguno)");
  for (const [t, n] of [...turnosDesconocidos.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${n.toString().padStart(4)}  "${t}"`);
  }

  console.log(`\n-- Casos destacados a validar (${casosDestacados.length}) --`);
  for (const c of casosDestacados.slice(0, 40)) console.log(`   • ${c}`);
  if (casosDestacados.length > 40)
    console.log(`   ... y ${casosDestacados.length - 40} más`);

  console.log(`\n=== FIN ===\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
