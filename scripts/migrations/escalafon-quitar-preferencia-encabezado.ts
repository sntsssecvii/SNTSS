/**
 * Migración: eliminar preferencias espurias de "encabezado" y recalcular posiciones.
 *
 * Bug: el parser por columnas (Adobe) incluía la fila de encabezado repetida del
 * PDF como una preferencia más del último aspirante, produciendo preferencias
 * con zona "ZONA SOLICITADA" (y deleg "DELEGACION SOLICITADA", etc.). Esto crea
 * una "zona" fantasma en el listado y ensucia los filtros de la UI.
 *
 * Esta migración:
 *  1. Lee todos los escalafon_aspirantes por listado
 *  2. Elimina las preferencias cuya zona == "ZONA SOLICITADA"
 *  3. Recalcula posicionesPorZona / Activo / PEI con el motor
 *  4. Actualiza aspirantes y el campo `zonas` del listado
 *
 * Por defecto corre en DRY-RUN (no escribe). Para aplicar, pasar --apply.
 *
 * Uso:
 *   tsx scripts/migrations/escalafon-quitar-preferencia-encabezado.ts          # dry-run
 *   tsx scripts/migrations/escalafon-quitar-preferencia-encabezado.ts --apply  # escribe
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
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const COL_LISTADOS = "escalafon_listados";
const COL_ASPIRANTES = "escalafon_aspirantes";
const APPLY = process.argv.includes("--apply");

function esPreferenciaEncabezado(p: EscalafonPreferencia): boolean {
  return (p.zonaSolicitada ?? "").replace(/\s+/g, " ").trim().toUpperCase() ===
    "ZONA SOLICITADA";
}

async function main() {
  console.log(
    `\n=== Migración escalafon-quitar-preferencia-encabezado [${APPLY ? "APPLY" : "DRY-RUN"}] ===\n`,
  );

  const listadosSnap = await db.collection(COL_LISTADOS).get();
  if (listadosSnap.empty) {
    console.log("No hay listados. Nada que hacer.");
    return;
  }

  let totalListadosTocados = 0;
  let totalAspirantesTocados = 0;

  for (const listadoDoc of listadosSnap.docs) {
    const listadoId = listadoDoc.id;
    const listadoData = listadoDoc.data();

    const aspirantesSnap = await db
      .collection(COL_ASPIRANTES)
      .where("listadoId", "==", listadoId)
      .orderBy("lugar", "asc")
      .get();
    if (aspirantesSnap.empty) continue;

    type AspiranteInput = Omit<
      EscalafonAspirante,
      "id" | "listadoId" | "posicionesPorZona"
    >;
    const aspirantesParaMotor: AspiranteInput[] = [];
    const aspiranteIds: string[] = [];
    const ejemplos: string[] = [];
    let cambiosListado = 0;

    for (const aDoc of aspirantesSnap.docs) {
      const a = aDoc.data() as EscalafonAspirante;
      const original = a.preferencias ?? [];
      const limpias = original.filter((p) => !esPreferenciaEncabezado(p));
      if (limpias.length !== original.length) {
        cambiosListado++;
        if (ejemplos.length < 3) {
          ejemplos.push(
            `      #${a.lugar} ${a.nombre}: ${original.length} → ${limpias.length} preferencias`,
          );
        }
      }
      aspiranteIds.push(aDoc.id);
      aspirantesParaMotor.push({
        lugar: a.lugar,
        estatus: a.estatus,
        matricula: a.matricula,
        nombre: a.nombre,
        delegacion: a.delegacion,
        fechaRegistro: a.fechaRegistro,
        preferencias: limpias,
      });
    }

    if (cambiosListado === 0) continue;

    totalListadosTocados++;
    totalAspirantesTocados += cambiosListado;

    const { aspirantesConPosicion, zonas } =
      calcularPosicionesPorZona(aspirantesParaMotor);

    console.log(`─── ${listadoId} | ${listadoData.categoriaDesc ?? "?"} ───`);
    console.log(`  Aspirantes con preferencia espuria removida: ${cambiosListado}`);
    console.log(`  Zonas (antes): ${JSON.stringify(listadoData.zonas ?? [])}`);
    console.log(`  Zonas (después): ${JSON.stringify(zonas)}`);
    ejemplos.forEach((e) => console.log(e));

    if (APPLY) {
      const BATCH_SIZE = 490;
      for (let i = 0; i < aspiranteIds.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const slice = aspiranteIds.slice(i, i + BATCH_SIZE);
        const sliceData = aspirantesConPosicion.slice(i, i + BATCH_SIZE);
        for (let j = 0; j < slice.length; j++) {
          batch.update(db.collection(COL_ASPIRANTES).doc(slice[j]), {
            preferencias: sliceData[j].preferencias,
            posicionesPorZona: sliceData[j].posicionesPorZona,
            posicionesActivoPorZona: sliceData[j].posicionesActivoPorZona,
            posicionesPeiPorZona: sliceData[j].posicionesPeiPorZona,
          });
        }
        await batch.commit();
      }
      await db.collection(COL_LISTADOS).doc(listadoId).update({ zonas });
      console.log(`  ✅ Aplicado.`);
    }
    console.log("");
  }

  console.log("=== RESUMEN ===");
  console.log(`Listados a tocar: ${totalListadosTocados}`);
  console.log(`Aspirantes a corregir: ${totalAspirantesTocados}`);
  console.log(
    APPLY
      ? "Cambios APLICADOS en Firestore."
      : "DRY-RUN: no se escribió nada. Re-correr con --apply para aplicar.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error fatal:", e);
    process.exit(1);
  });
