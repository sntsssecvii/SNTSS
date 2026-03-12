import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/firebase-client'
import { getFuenteVerdad } from '@/lib/firebase/sincronizaciones'
import { calcularPosiciones } from '@/lib/bolsa-de-trabajo/calculos'
import { getComparisonRecordsForWorker } from '@/lib/bolsa-de-trabajo/comparison-groups'
import type { BolsaDeTrabajoRegistro, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

export interface TrabajadorPeriodo {
  anio: number
  mes: number
  quincena: number
}

export interface TramitePortalResult {
  documentoId: string
  matricula: string
  nombre: string
  categoria: string
  zona: string
  tipoDocumento: TipoBolsaDeTrabajo
  tipoContratacion?: string
  adscripcionNueva?: string
  turnoNuevo?: string
  registro?: string
  posicionBase: number
  posicionInterinato?: number
  totalEnCategoria: number
  totalEventualesEnCategoria?: number
}

async function getActiveSyncPeriod() {
  const syncActiva = await getFuenteVerdad()
  if (!syncActiva) {
    throw new Error('No hay información oficial activa en este momento.')
  }

  return syncActiva
}

export async function getMisTramitesCliente(matricula: string): Promise<{
  data: TramitePortalResult[]
  periodo: TrabajadorPeriodo
}> {
  const normalizedMatricula = matricula.trim().toUpperCase()
  if (!normalizedMatricula) {
    throw new Error('El usuario autenticado no tiene matrícula vinculada.')
  }

  const syncActiva = await getActiveSyncPeriod()
  const docsSnap = await getDocs(query(
    collection(db, 'bolsa_de_trabajo_documentos'),
    where('syncId', '==', syncActiva.id)
  ))

  if (docsSnap.empty) {
    throw new Error('No se encontraron listados para esta quincena.')
  }

  const tramites: TramitePortalResult[] = []

  for (const docSnap of docsSnap.docs) {
    const tipoDocumento = docSnap.data().tipo as TipoBolsaDeTrabajo
    const registrosRef = collection(db, 'bolsa_de_trabajo_documentos', docSnap.id, 'registros')
    const registroSnap = await getDocs(query(
      registrosRef,
      where('matricula', '==', normalizedMatricula),
      limit(1)
    ))

    if (registroSnap.empty) continue

    const allRegistrosSnap = await getDocs(registrosRef)
    const registros = allRegistrosSnap.docs.map((registroDoc) => ({
      id: registroDoc.id,
      ...registroDoc.data(),
    })) as BolsaDeTrabajoRegistro[]

    const targetRegistro = registroSnap.docs[0]
    const workerRecord = {
      id: targetRegistro.id,
      ...targetRegistro.data(),
    } as BolsaDeTrabajoRegistro
    const comparisonRecords = getComparisonRecordsForWorker(registros, workerRecord, tipoDocumento)
    const resultado = calcularPosiciones(comparisonRecords, normalizedMatricula, tipoDocumento)
    if (!resultado) continue

    tramites.push({
      ...resultado,
      tipoDocumento,
      documentoId: docSnap.id,
    })
  }

  return {
    data: tramites.sort((a, b) => a.tipoDocumento.localeCompare(b.tipoDocumento)),
    periodo: {
      anio: syncActiva.anio,
      mes: syncActiva.mes,
      quincena: syncActiva.quincena,
    },
  }
}

export async function getMiTramiteDetalleCliente(matricula: string, documentoId: string): Promise<{
  data: TramitePortalResult
  periodo: TrabajadorPeriodo
}> {
  const normalizedMatricula = matricula.trim().toUpperCase()
  if (!normalizedMatricula) {
    throw new Error('El usuario autenticado no tiene matrícula vinculada.')
  }

  const syncActiva = await getActiveSyncPeriod()
  const documentoSnap = await getDoc(doc(db, 'bolsa_de_trabajo_documentos', documentoId))

  if (!documentoSnap.exists()) {
    throw new Error('Trámite no encontrado.')
  }

  if (documentoSnap.data().syncId !== syncActiva.id) {
    throw new Error('El trámite no pertenece al corte oficial vigente.')
  }

  const tipoDocumento = documentoSnap.data().tipo as TipoBolsaDeTrabajo
  const registrosRef = collection(db, 'bolsa_de_trabajo_documentos', documentoId, 'registros')
  const registroSnap = await getDocs(query(
    registrosRef,
    where('matricula', '==', normalizedMatricula),
    limit(1)
  ))

  if (registroSnap.empty) {
    throw new Error('El trámite solicitado no pertenece al usuario autenticado.')
  }

  const allRegistrosSnap = await getDocs(registrosRef)
  const registros = allRegistrosSnap.docs.map((registroDoc) => ({
    id: registroDoc.id,
    ...registroDoc.data(),
  })) as BolsaDeTrabajoRegistro[]

  const workerRecord = {
    id: registroSnap.docs[0].id,
    ...registroSnap.docs[0].data(),
  } as BolsaDeTrabajoRegistro
  const comparisonRecords = getComparisonRecordsForWorker(registros, workerRecord, tipoDocumento)
  const resultado = calcularPosiciones(comparisonRecords, normalizedMatricula, tipoDocumento)
  if (!resultado) {
    throw new Error('No se pudo calcular el detalle del trámite.')
  }

  return {
    data: {
      ...resultado,
      tipoDocumento,
      documentoId,
    },
    periodo: {
      anio: syncActiva.anio,
      mes: syncActiva.mes,
      quincena: syncActiva.quincena,
    },
  }
}
