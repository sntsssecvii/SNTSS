/**
 * Migracion one-shot: materializar posiciones en cambios_registros existentes.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
 *     npx tsx scripts/migrations/materializar-cambios-posiciones.ts
 */
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  calcularPosicionesCambios,
  claveRegistro,
} from "../../src/lib/cambios-escalafon/position-engine";
import type { CambiosRegistro } from "../../src/types/cambios-escalafon";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serviceAccount = require(credPath) as ServiceAccount;
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  // 1. Obtener todos los listados
  const listadosSnap = await db.collection("cambios_listados").get();
  console.log(`Listados encontrados: ${listadosSnap.size}`);

  let totalActualizados = 0;

  for (const listadoDoc of listadosSnap.docs) {
    const listadoId = listadoDoc.id;
    const listado = listadoDoc.data();
    console.log(
      `\nProcesando: ${listado.categoriaDesc} (${listado.concepto || "sin concepto"}) — ${listadoId}`,
    );

    // 2. Obtener registros del listado
    const registrosSnap = await db
      .collection("cambios_registros")
      .where("listadoId", "==", listadoId)
      .get();

    if (registrosSnap.empty) {
      console.log("  Sin registros, skip.");
      continue;
    }

    const registros = registrosSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as CambiosRegistro,
    );

    // 3. Calcular posiciones
    const posiciones = calcularPosicionesCambios(registros);

    // 4. Mejor posicion por registro
    const mejorPorRegistro = new Map<
      string,
      { lugar: number; totalEnGrupo: number; unidad: string; turno: string }
    >();
    for (const p of posiciones) {
      const k = claveRegistro(p.registro);
      const prev = mejorPorRegistro.get(k);
      if (!prev || p.lugar < prev.lugar) {
        mejorPorRegistro.set(k, {
          lugar: p.lugar,
          totalEnGrupo: p.totalEnGrupo,
          unidad: p.unidad,
          turno: p.turno,
        });
      }
    }

    // 5. Actualizar en batches
    const BATCH_SIZE = 400;
    const docs = registros.filter((r) =>
      mejorPorRegistro.has(claveRegistro(r)),
    );

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const r of docs.slice(i, i + BATCH_SIZE)) {
        const best = mejorPorRegistro.get(claveRegistro(r))!;
        batch.update(db.collection("cambios_registros").doc(r.id!), {
          lugar: best.lugar,
          totalEnGrupo: best.totalEnGrupo,
          grupoUnidad: best.unidad,
          grupoTurno: best.turno,
        });
      }
      await batch.commit();
    }

    console.log(`  ${docs.length} registros actualizados.`);
    totalActualizados += docs.length;
  }

  console.log(`\nTotal registros actualizados: ${totalActualizados}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
