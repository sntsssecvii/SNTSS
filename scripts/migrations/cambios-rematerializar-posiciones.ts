// scripts/migrations/cambios-rematerializar-posiciones.ts
// Re-materializa el campo `lugar`/`totalEnGrupo`/`grupoUnidad`/`grupoTurno` en
// cambios_registros con el motor de posiciones ACTUAL. Necesario cuando cambia
// la regla del motor: la vista de admin calcula al vuelo, pero el portal del
// trabajador lee la posición materializada al subir el PDF.
//
// Dry-run por defecto (solo reporta diferencias). Para escribir: --apply
//
// Ejecutar:
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
//     TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
//     npx ts-node --transpile-only -r tsconfig-paths/register \
//     scripts/migrations/cambios-rematerializar-posiciones.ts [--apply]

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as nodePath from "node:path";
import * as nodeFs from "node:fs";
import {
  calcularPosicionesCambios,
  claveRegistro,
} from "../../src/lib/cambios-escalafon/position-engine";
import type {
  CambiosListado,
  CambiosRegistro,
} from "../../src/types/cambios-escalafon";

const APPLY = process.argv.includes("--apply");
const COL_LISTADOS = "cambios_listados";
const COL_REGISTROS = "cambios_registros";

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  nodePath.join(process.env.HOME || "", ".config/firebase/sntss-service-account.json");
const serviceAccount = JSON.parse(nodeFs.readFileSync(serviceAccountPath, "utf8"));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

interface Mejor {
  lugar: number;
  totalEnGrupo: number;
  unidad: string;
  turno: string;
}

// Misma lógica que materializarPosicionesCambios: mejor lugar por registro.
function mejorPorRegistro(registros: CambiosRegistro[]): Map<string, Mejor> {
  const posiciones = calcularPosicionesCambios(registros);
  const mejor = new Map<string, Mejor>();
  for (const p of posiciones) {
    const k = claveRegistro(p.registro);
    const prev = mejor.get(k);
    if (!prev || p.lugar < prev.lugar) {
      mejor.set(k, {
        lugar: p.lugar,
        totalEnGrupo: p.totalEnGrupo,
        unidad: p.unidad,
        turno: p.turno,
      });
    }
  }
  return mejor;
}

async function main() {
  console.log(`\n=== RE-MATERIALIZAR POSICIONES CAMBIOS ${APPLY ? "(APPLY)" : "(dry-run)"} ===\n`);

  const listadosSnap = await db.collection(COL_LISTADOS).get();
  const listados = listadosSnap.docs.map((d) => ({ id: d.id, ...(d.data() as CambiosListado) }));

  let totalDocs = 0;
  let totalCambios = 0;
  let cambiosDeLugar = 0; // cambió el NÚMERO de lugar (posición distinta)
  let listadosConCambios = 0;
  let escritos = 0;

  for (const l of listados) {
    const regsSnap = await db.collection(COL_REGISTROS).where("listadoId", "==", l.id).get();
    const registros = regsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as CambiosRegistro) }));
    if (registros.length === 0) continue;

    const mejor = mejorPorRegistro(registros);

    const diffs: string[] = [];
    const updates: { id: string; best: Mejor }[] = [];
    for (const r of registros) {
      totalDocs++;
      const best = mejor.get(claveRegistro(r));
      if (!best) continue;
      const cur = r as unknown as {
        lugar?: number;
        totalEnGrupo?: number;
        grupoUnidad?: string;
        grupoTurno?: string;
      };
      const cambio =
        cur.lugar !== best.lugar ||
        cur.totalEnGrupo !== best.totalEnGrupo ||
        cur.grupoUnidad !== best.unidad ||
        cur.grupoTurno !== best.turno;
      if (cambio) {
        totalCambios++;
        updates.push({ id: r.id!, best });
        const lugarCambio = cur.lugar !== best.lugar;
        if (lugarCambio) cambiosDeLugar++;
        // Solo listar en detalle los que cambian de NÚMERO de lugar (lo que
        // el trabajador percibe como "subí/bajé"); el resto solo ajusta "de X".
        if (lugarCambio) {
          diffs.push(
            `    ${r.matricula} ${r.nombre}: #${cur.lugar ?? "∅"}→#${best.lugar} ` +
              `(de ${cur.totalEnGrupo ?? "∅"}→${best.totalEnGrupo}) · ` +
              `grupo "${cur.grupoUnidad ?? "∅"}/${cur.grupoTurno ?? "∅"}"→"${best.unidad}/${best.turno}"`,
          );
        }
      }
    }

    if (updates.length > 0) {
      listadosConCambios++;
      const etiqueta = l.concepto ? `${l.categoriaCode} · ${l.concepto}` : l.categoriaCode;
      console.log(
        `▸ ${l.id} [${etiqueta}] area=${l.area} "${l.categoriaDesc}" — ${updates.length}/${registros.length} docs (${diffs.length} cambian de lugar)`,
      );
      for (const d of diffs) console.log(d);

      if (APPLY) {
        const BATCH = 400;
        for (let i = 0; i < updates.length; i += BATCH) {
          const batch = db.batch();
          for (const u of updates.slice(i, i + BATCH)) {
            batch.update(db.collection(COL_REGISTROS).doc(u.id), {
              lugar: u.best.lugar,
              totalEnGrupo: u.best.totalEnGrupo,
              grupoUnidad: u.best.unidad,
              grupoTurno: u.best.turno,
            });
            escritos++;
          }
          await batch.commit();
        }
      }
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`Listados:              ${listados.length}`);
  console.log(`Listados con cambios:  ${listadosConCambios}`);
  console.log(`Registros revisados:   ${totalDocs}`);
  console.log(`Docs a actualizar:     ${totalCambios} (lugar y/o "de X")`);
  console.log(`  · cambian de LUGAR:   ${cambiosDeLugar}`);
  console.log(`  · solo cambia "de X": ${totalCambios - cambiosDeLugar}`);
  if (APPLY) console.log(`Registros escritos:    ${escritos}`);
  else console.log(`(dry-run: no se escribió nada. Usa --apply para materializar)`);
  console.log(`=== FIN ===\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
