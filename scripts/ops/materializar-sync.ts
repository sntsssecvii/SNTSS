// scripts/ops/materializar-sync.ts
// Re-materializa las posiciones de una sincronización de bolsa de trabajo.
//
// Uso:
// GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
//   npx ts-node -r tsconfig-paths/register scripts/ops/materializar-sync.ts <syncId>

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SYNC_ID = process.argv[2];
if (!SYNC_ID) {
  console.error("Uso: materializar-sync.ts <syncId>");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS as string),
  });
}

// Configurar adminDb para que lo usen los módulos internos
import { adminDb } from "@/lib/firebase/admin";
import { materializeSyncPositions } from "@/lib/bolsa-de-trabajo/materialize-sync-service";
import type { PeriodoBolsa } from "@/types/bolsa-de-trabajo";

async function run() {
  console.log(`\n🔄 Materializando sync: ${SYNC_ID}\n`);

  const syncSnap = await adminDb
    .collection("sincronizaciones")
    .doc(SYNC_ID)
    .get();
  if (!syncSnap.exists) {
    console.error("❌ Sync no encontrada:", SYNC_ID);
    process.exit(1);
  }

  const syncData = syncSnap.data() as {
    anio: number;
    mes: number;
    quincena: 1 | 2;
  };
  const periodo: PeriodoBolsa = {
    anio: syncData.anio,
    mes: syncData.mes,
    quincena: syncData.quincena,
  };

  console.log(
    `   Período: ${syncData.anio}-${syncData.mes} Q${syncData.quincena}`,
  );

  const result = await materializeSyncPositions(SYNC_ID, periodo);

  console.log(`\n✅ Materialización completada:`);
  console.log(`   Documentos procesados: ${result.totalDocumentos}`);
  console.log(`   Registros materializados: ${result.totalMaterializados}`);
}

run().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
