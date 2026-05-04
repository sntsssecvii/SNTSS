/**
 * Migración: corregir zonaSolicitada y recalcular posicionesPorZona.
 *
 * Bug: el parser capturaba "1 ENSENADA Incondicional" como zona en vez de "1 ENSENADA"
 * porque el regex greedy incluía la localidad "Incondicional" en el nombre de zona.
 *
 * Esta migración:
 *  1. Lee todos los escalafon_aspirantes por listado
 *  2. Corrige zonaSolicitada quitando el sufijo " Incondicional" donde aplique
 *  3. Recalcula posicionesPorZona con el motor
 *  4. Actualiza aspirantes y el campo zonas del listado
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
 *   npx ts-node --project tsconfig.scripts.json scripts/migrations/escalafon-fix-zonas.ts
 *
 * Correr UNA SOLA VEZ.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { calcularPosicionesPorZona } from "../../src/lib/escalafon/position-engine";
import type {
  EscalafonAspirante,
  EscalafonPreferencia,
} from "../../src/types/escalafon";

const serviceAccount = require(
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    `${process.env.HOME}/.config/firebase/sntss-service-account.json`,
);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

const COL_LISTADOS = "escalafon_listados";
const COL_ASPIRANTES = "escalafon_aspirantes";

function esIncondicionalZona(zona: string): boolean {
  const norm = zona.replace(/\s/g, "").toUpperCase();
  return norm === "INCONDICIONAL" || /^\d{1,2}INCONDICIONAL$/.test(norm);
}

function fixZonaSolicitada(zona: string): string {
  // Ya es incondicional reconocido — no tocar
  if (esIncondicionalZona(zona)) return zona;
  // Número solo (ej. "0") = zona incondicional que quedó truncada en un backfill previo
  if (/^\d{1,2}$/.test(zona.trim())) return "0 Incondicional";
  // Quitar sufijo " Incondicional" (localidad capturada incorrectamente en zona)
  const stripped = zona.replace(/\s+Incondicional$/i, "").trim();
  // Si al quitar quedó solo un número, también es incondicional
  if (/^\d{1,2}$/.test(stripped)) return "0 Incondicional";
  return stripped;
}

function fixPreferencias(
  prefs: EscalafonPreferencia[],
): { prefs: EscalafonPreferencia[]; changed: boolean } {
  let changed = false;
  const fixed = prefs.map((p) => {
    const zonaFixed = fixZonaSolicitada(p.zonaSolicitada);
    if (zonaFixed !== p.zonaSolicitada) {
      changed = true;
      return { ...p, zonaSolicitada: zonaFixed };
    }
    return p;
  });
  return { prefs: fixed, changed };
}

async function main() {
  console.log("=== Iniciando migración escalafon-fix-zonas ===\n");

  const listadosSnap = await db
    .collection(COL_LISTADOS)
    .orderBy("creadoEn", "asc")
    .get();

  if (listadosSnap.empty) {
    console.log("No hay listados en Firestore. Nada que hacer.");
    return;
  }

  console.log(`Listados encontrados: ${listadosSnap.size}\n`);

  for (const listadoDoc of listadosSnap.docs) {
    const listadoId = listadoDoc.id;
    const listadoData = listadoDoc.data();
    console.log(
      `─── Listado: ${listadoId} | ${listadoData.categoriaDesc ?? "?"} ───`,
    );

    const aspirantesSnap = await db
      .collection(COL_ASPIRANTES)
      .where("listadoId", "==", listadoId)
      .orderBy("lugar", "asc")
      .get();

    if (aspirantesSnap.empty) {
      console.log("  Sin aspirantes. Saltando.\n");
      continue;
    }

    console.log(`  Aspirantes: ${aspirantesSnap.size}`);

    // Construir lista de aspirantes con preferencias corregidas
    type AspiranteInput = Omit<
      EscalafonAspirante,
      "id" | "listadoId" | "posicionesPorZona"
    >;

    const aspirantesParaMotor: AspiranteInput[] = [];
    const aspiranteIds: string[] = [];
    let totalCambios = 0;

    for (const aDoc of aspirantesSnap.docs) {
      const a = aDoc.data() as EscalafonAspirante;
      const { prefs: prefsFixed, changed } = fixPreferencias(
        a.preferencias ?? [],
      );
      if (changed) totalCambios++;

      aspiranteIds.push(aDoc.id);
      aspirantesParaMotor.push({
        lugar: a.lugar,
        estatus: a.estatus,
        matricula: a.matricula,
        nombre: a.nombre,
        delegacion: a.delegacion,
        fechaRegistro: a.fechaRegistro,
        preferencias: prefsFixed,
      });
    }

    console.log(`  Aspirantes con zona corregida: ${totalCambios}`);

    // Recalcular posiciones
    const { aspirantesConPosicion, zonas } =
      calcularPosicionesPorZona(aspirantesParaMotor);

    console.log(`  Zonas recalculadas: ${zonas.join(", ")}`);

    // Escribir en batch (máx 500 ops por batch)
    const BATCH_SIZE = 490;
    for (let i = 0; i < aspiranteIds.length; i += BATCH_SIZE) {
      const batch = db.batch();

      const slice = aspiranteIds.slice(i, i + BATCH_SIZE);
      const sliceData = aspirantesConPosicion.slice(i, i + BATCH_SIZE);

      for (let j = 0; j < slice.length; j++) {
        const ref = db.collection(COL_ASPIRANTES).doc(slice[j]);
        batch.update(ref, {
          preferencias: sliceData[j].preferencias,
          posicionesPorZona: sliceData[j].posicionesPorZona,
          posicionesActivoPorZona: sliceData[j].posicionesActivoPorZona,
          posicionesPeiPorZona: sliceData[j].posicionesPeiPorZona,
        });
      }

      await batch.commit();
      console.log(
        `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${slice.length} aspirantes actualizados`,
      );
    }

    // Actualizar zonas en el listado
    await db
      .collection(COL_LISTADOS)
      .doc(listadoId)
      .update({ zonas });

    console.log(`  Listado actualizado con ${zonas.length} zonas.\n`);
  }

  console.log("=== Migración completada ===");
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
