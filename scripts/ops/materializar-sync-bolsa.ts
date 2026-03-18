import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(process.cwd())

import type { PeriodoBolsa } from '@/types/bolsa-de-trabajo'

interface SyncData {
  anio: number
  mes: number
  quincena: 1 | 2
  esFuenteVerdad?: boolean
}

async function getSyncTarget(adminDb: { collection: (name: string) => any }, syncIdArg?: string) {
  if (syncIdArg) {
    const syncSnap = await adminDb.collection('sincronizaciones').doc(syncIdArg).get()
    if (!syncSnap.exists) {
      throw new Error(`SYNC_NOT_FOUND:${syncIdArg}`)
    }

    return {
      id: syncSnap.id,
      ...(syncSnap.data() as SyncData),
    }
  }

  const syncSnap = await adminDb
    .collection('sincronizaciones')
    .where('esFuenteVerdad', '==', true)
    .limit(1)
    .get()

  if (syncSnap.empty) {
    throw new Error('OFFICIAL_SYNC_NOT_FOUND')
  }

  return {
    id: syncSnap.docs[0].id,
    ...(syncSnap.docs[0].data() as SyncData),
  }
}

async function main() {
  const [{ adminDb }, { materializeSyncPositions }] = await Promise.all([
    import('@/lib/firebase/admin'),
    import('@/lib/bolsa-de-trabajo/materialize-sync-service'),
  ])
  const syncIdArg = process.argv[2]
  const sync = await getSyncTarget(adminDb, syncIdArg)

  const periodo: PeriodoBolsa = {
    anio: sync.anio,
    mes: sync.mes,
    quincena: sync.quincena,
  }

  console.log(`Materializando sync ${sync.id} (${periodo.quincena}ª quincena ${periodo.mes}/${periodo.anio})...`)

  const result = await materializeSyncPositions(sync.id, periodo)

  console.log(`OK: ${result.totalDocumentos} documentos procesados`)
  console.log(`OK: ${result.totalMaterializados} posiciones materializadas`)
}

main().catch((error) => {
  console.error('Error materializando sync de bolsa:', error)
  process.exit(1)
})
