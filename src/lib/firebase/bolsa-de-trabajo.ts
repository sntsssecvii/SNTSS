import { db as clientDb } from './firebase-client'
import { db as serverDb } from './server-config'
const db = typeof window !== 'undefined' ? clientDb : serverDb
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
  startAfter,
  QueryDocumentSnapshot,
  writeBatch,
} from 'firebase/firestore'
import type {
  BolsaDeTrabajoDocumento,
  BolsaDeTrabajoRegistro,
  FiltrosBolsaDeTrabajo,
  EstadisticasBolsaDeTrabajo,
  TipoBolsaDeTrabajo,
  EstadoProcesamiento,
} from '@/types/bolsa-de-trabajo'

const COLECCION = 'bolsa_de_trabajo_documentos'
const SUBCOLECCION_REGISTROS = 'registros' // Para documentos grandes

// Convertir Firestore Timestamp a Date
const convertirTimestamp = (timestamp: any): Date => {
  if (timestamp?.toDate) {
    return timestamp.toDate()
  }
  if (timestamp instanceof Date) {
    return timestamp
  }
  return new Date()
}

// Convertir documento de Firestore a BolsaDeTrabajoDocumento
const convertirDocumento = (doc: any, incluirRegistros: boolean = false): BolsaDeTrabajoDocumento => {
  const data = doc.data()
  return {
    id: doc.id,
    syncId: data.syncId,
    tipo: data.tipo,
    fechaActualizacion: convertirTimestamp(data.fechaActualizacion),
    fechaCarga: convertirTimestamp(data.fechaCarga),
    subidoPor: data.subidoPor,
    subidoPorEmail: data.subidoPorEmail,
    estado: data.estado,
    urlArchivo: data.urlArchivo,
    nombreArchivo: data.nombreArchivo,
    metadata: data.metadata || {},
    registros: incluirRegistros ? (data.registros || []) : [], // Los registros se cargan desde subcolección
    errores: data.errores || [],
    version: data.version || 1,
    totalRegistros: data.totalRegistros || 0,
    registrosValidados: data.registrosValidados || 0,
    registrosConErrores: data.registrosConErrores || 0,
  }
}

// Crear nuevo documento de bolsa de trabajo
export const createBolsaDeTrabajoDocumento = async (
  documento: Omit<BolsaDeTrabajoDocumento, 'id'>
): Promise<string> => {
  try {
    const ahora = Timestamp.now()
    const nuevoDocumento = {
      ...documento,
      fechaCarga: documento.fechaCarga instanceof Date
        ? Timestamp.fromDate(documento.fechaCarga)
        : documento.fechaCarga,
      fechaActualizacion: documento.fechaActualizacion instanceof Date
        ? Timestamp.fromDate(documento.fechaActualizacion)
        : documento.fechaActualizacion,
    }

    const docRef = await addDoc(collection(db, COLECCION), nuevoDocumento)
    return docRef.id
  } catch (error) {
    console.error('Error creando documento de bolsa de trabajo:', error)
    throw error
  }
}

// Obtener registros de una subcolección
export const getRegistrosBolsaDeTrabajo = async (
  documentoId: string,
  limiteRegistros?: number
): Promise<BolsaDeTrabajoRegistro[]> => {
  try {
    const registrosRef = collection(db, COLECCION, documentoId, SUBCOLECCION_REGISTROS)
    const constraints: QueryConstraint[] = [orderBy('filaOriginal', 'asc')]

    if (limiteRegistros) {
      constraints.push(limit(limiteRegistros))
    }

    const q = query(registrosRef, ...constraints)
    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BolsaDeTrabajoRegistro[]
  } catch (error) {
    console.error('Error obteniendo registros de bolsa de trabajo:', error)
    throw error
  }
}

// Guardar registros en subcolección (en lotes de 500)
export const guardarRegistrosEnSubcoleccion = async (
  documentoId: string,
  registros: BolsaDeTrabajoRegistro[]
): Promise<void> => {
  try {
    const registrosRef = collection(db, COLECCION, documentoId, SUBCOLECCION_REGISTROS)
    const BATCH_SIZE = 500 // Límite de Firestore por batch

    // Limpiar registros: eliminar campos undefined
    const registrosLimpios = registros.map(reg => {
      const registroLimpio: any = {}
      for (const [key, value] of Object.entries(reg)) {
        if (value !== undefined) {
          registroLimpio[key] = value
        }
      }
      return registroLimpio
    })

    // Guardar en lotes
    for (let i = 0; i < registrosLimpios.length; i += BATCH_SIZE) {
      const batch = writeBatch(db)
      const lote = registrosLimpios.slice(i, i + BATCH_SIZE)

      lote.forEach((registro) => {
        const docRef = doc(registrosRef, registro.id)
        batch.set(docRef, registro)
      })

      await batch.commit()
      console.log(`Guardados ${Math.min(i + BATCH_SIZE, registrosLimpios.length)}/${registrosLimpios.length} registros`)
    }
  } catch (error) {
    console.error('Error guardando registros en subcolección:', error)
    throw error
  }
}

export const reemplazarRegistrosEnSubcoleccion = async (
  documentoId: string,
  registros: BolsaDeTrabajoRegistro[]
): Promise<void> => {
  try {
    const registrosRef = collection(db, COLECCION, documentoId, SUBCOLECCION_REGISTROS)
    const existentes = await getDocs(registrosRef)

    if (!existentes.empty) {
      const BATCH_SIZE = 500
      const docs = existentes.docs

      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        const lote = docs.slice(i, i + BATCH_SIZE)
        lote.forEach((docSnap) => batch.delete(docSnap.ref))
        await batch.commit()
      }
    }

    await guardarRegistrosEnSubcoleccion(documentoId, registros)
  } catch (error) {
    console.error('Error reemplazando registros en subcolección:', error)
    throw error
  }
}

// Obtener documento por ID (con registros opcionales)
export const getBolsaDeTrabajoDocumentoById = async (
  id: string,
  incluirRegistros: boolean = true
): Promise<BolsaDeTrabajoDocumento | null> => {
  try {
    const docRef = doc(db, COLECCION, id)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    const documento = convertirDocumento(docSnap, false)

    // Cargar registros desde subcolección si se solicita
    if (incluirRegistros) {
      documento.registros = await getRegistrosBolsaDeTrabajo(id)
    }

    return documento
  } catch (error) {
    console.error('Error obteniendo documento de bolsa de trabajo:', error)
    throw error
  }
}

export const getBolsaDeTrabajoDocumentoHead = async (
  id: string
): Promise<BolsaDeTrabajoDocumento | null> => {
  try {
    const docRef = doc(db, COLECCION, id)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    return convertirDocumento(docSnap, false)
  } catch (error) {
    console.error('Error obteniendo encabezado de documento:', error)
    throw error
  }
}

// Obtener todos los documentos con filtros opcionales
export const getBolsaDeTrabajoDocumentos = async (
  filtros?: FiltrosBolsaDeTrabajo,
  limite?: number,
  ultimoDoc?: QueryDocumentSnapshot
): Promise<{ documentos: BolsaDeTrabajoDocumento[]; ultimoDoc?: QueryDocumentSnapshot }> => {
  try {
    const constraints: QueryConstraint[] = [orderBy('fechaCarga', 'desc')]

    if (filtros?.tipo && filtros.tipo.length > 0) {
      constraints.push(where('tipo', 'in', filtros.tipo))
    }

    if (filtros?.estado && filtros.estado.length > 0) {
      constraints.push(where('estado', 'in', filtros.estado))
    }

    if (filtros?.zona && filtros.zona.length > 0) {
      constraints.push(where('metadata.zona', 'in', filtros.zona))
    }

    if (filtros?.fechaDesde) {
      constraints.push(where('fechaActualizacion', '>=', Timestamp.fromDate(filtros.fechaDesde)))
    }

    if (filtros?.fechaHasta) {
      constraints.push(where('fechaActualizacion', '<=', Timestamp.fromDate(filtros.fechaHasta)))
    }

    if (filtros?.anio) {
      constraints.push(where('metadata.anio', '==', filtros.anio))
    }

    if (filtros?.mes) {
      constraints.push(where('metadata.mes', '==', filtros.mes))
    }

    if (filtros?.quincena) {
      constraints.push(where('metadata.quincena', '==', filtros.quincena))
    }

    if (limite) {
      constraints.push(limit(limite))
    }

    if (ultimoDoc) {
      constraints.push(startAfter(ultimoDoc))
    }

    const q = query(collection(db, COLECCION), ...constraints)
    const querySnapshot = await getDocs(q)

    const documentos = querySnapshot.docs.map(doc => convertirDocumento(doc))
    const ultimoDocumento = querySnapshot.docs[querySnapshot.docs.length - 1]

    return {
      documentos,
      ultimoDoc: ultimoDocumento,
    }
  } catch (error) {
    console.error('Error obteniendo documentos de bolsa de trabajo:', error)
    throw error
  }
}

export const getBolsaDeTrabajoDocumentosBySyncId = async (
  syncId: string
): Promise<BolsaDeTrabajoDocumento[]> => {
  try {
    const q = query(
      collection(db, COLECCION),
      where('syncId', '==', syncId),
      orderBy('fechaCarga', 'desc')
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => convertirDocumento(doc))
  } catch (error) {
    console.error('Error obteniendo documentos por sincronización:', error)
    throw error
  }
}

export const getBolsaDeTrabajoDocumentosBySyncIds = async (
  syncIds: string[]
): Promise<BolsaDeTrabajoDocumento[]> => {
  if (syncIds.length === 0) return []
  try {
    // Firestore 'in' limit is 10 items. We process in chunks of 10.
    const CHUNK_SIZE = 10
    const results: BolsaDeTrabajoDocumento[] = []
    
    for (let i = 0; i < syncIds.length; i += CHUNK_SIZE) {
      const chunk = syncIds.slice(i, i + CHUNK_SIZE)
      const q = query(
        collection(db, COLECCION),
        where('syncId', 'in', chunk),
        orderBy('fechaCarga', 'desc')
      )
      const querySnapshot = await getDocs(q)
      const chunkDocs = querySnapshot.docs.map(doc => convertirDocumento(doc))
      results.push(...chunkDocs)
    }
    
    return results
  } catch (error) {
    console.error('Error obteniendo documentos por múltiples sincronizaciones:', error)
    throw error
  }
}

export const getBolsaDeTrabajoDocumentoBySyncAndTipo = async (
  syncId: string,
  tipo: TipoBolsaDeTrabajo
): Promise<BolsaDeTrabajoDocumento | null> => {
  try {
    const q = query(
      collection(db, COLECCION),
      where('syncId', '==', syncId),
      where('tipo', '==', tipo),
      limit(1)
    )
    const querySnapshot = await getDocs(q)
    if (querySnapshot.empty) return null
    return convertirDocumento(querySnapshot.docs[0])
  } catch (error) {
    console.error('Error obteniendo documento por sincronización y tipo:', error)
    throw error
  }
}

// Función helper para eliminar campos undefined recursivamente
const eliminarUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null
  }

  if (Array.isArray(obj)) {
    return obj.map(eliminarUndefined).filter(item => item !== null && item !== undefined)
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const cleaned: any = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        const cleanedValue = eliminarUndefined(value)
        if (cleanedValue !== null && cleanedValue !== undefined) {
          cleaned[key] = cleanedValue
        }
      }
    }
    return cleaned
  }

  return obj
}

// Actualizar documento (sin incluir registros - se guardan en subcolección)
export const updateBolsaDeTrabajoDocumento = async (
  id: string,
  actualizaciones: Partial<Omit<BolsaDeTrabajoDocumento, 'registros'>>
): Promise<void> => {
  try {
    const docRef = doc(db, COLECCION, id)
    const datosActualizados: any = { ...actualizaciones }

    // Convertir fechas a Timestamp si es necesario
    if (actualizaciones.fechaCarga instanceof Date) {
      datosActualizados.fechaCarga = Timestamp.fromDate(actualizaciones.fechaCarga)
    }
    if (actualizaciones.fechaActualizacion instanceof Date) {
      datosActualizados.fechaActualizacion = Timestamp.fromDate(actualizaciones.fechaActualizacion)
    }

    // Remover id si está presente
    delete datosActualizados.id
    // NO incluir registros aquí - se guardan en subcolección
    delete datosActualizados.registros

    // Eliminar campos undefined antes de guardar
    const datosLimpios = eliminarUndefined(datosActualizados)

    await updateDoc(docRef, datosLimpios)
  } catch (error) {
    console.error('Error actualizando documento de bolsa de trabajo:', error)
    throw error
  }
}

// Eliminar documento y sus registros en subcolección
export const deleteBolsaDeTrabajoDocumento = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLECCION, id)

    // 1. Obtener y eliminar todos los registros de la subcolección
    const registrosRef = collection(db, COLECCION, id, SUBCOLECCION_REGISTROS)
    const querySnapshot = await getDocs(registrosRef)

    if (!querySnapshot.empty) {
      const BATCH_SIZE = 500
      const docs = querySnapshot.docs

      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        const lote = docs.slice(i, i + BATCH_SIZE)
        lote.forEach((d) => batch.delete(d.ref))
        await batch.commit()
      }
      console.log(`Eliminados ${docs.length} registros de la subcolección para el documento ${id}`)
    }

    // 2. Eliminar el documento principal
    await deleteDoc(docRef)
  } catch (error) {
    console.error('Error eliminando documento de bolsa de trabajo:', error)
    throw error
  }
}

// Actualizar estado de un documento
export const updateEstadoDocumento = async (
  id: string,
  estado: EstadoProcesamiento
): Promise<void> => {
  try {
    await updateBolsaDeTrabajoDocumento(id, { estado })
  } catch (error) {
    console.error('Error actualizando estado del documento:', error)
    throw error
  }
}

// Validar un registro
export const validarRegistro = async (
  documentoId: string,
  registroId: string,
  validadoPor: string
): Promise<void> => {
  try {
    const documento = await getBolsaDeTrabajoDocumentoById(documentoId, true)
    if (!documento) {
      throw new Error('Documento no encontrado')
    }

    // Actualizar el registro en la subcolección
    const registroRef = doc(db, COLECCION, documentoId, SUBCOLECCION_REGISTROS, registroId)
    await updateDoc(registroRef, {
      validado: true,
      validadoPor,
      fechaValidacion: Timestamp.now(),
      necesitaValidacion: false,
    })

    // Actualizar contador de registros validados en el documento principal
    const registros = await getRegistrosBolsaDeTrabajo(documentoId)
    const registrosValidados = registros.filter((r) => r.validado).length

    await updateBolsaDeTrabajoDocumento(documentoId, {
      registrosValidados,
    })
  } catch (error) {
    console.error('Error validando registro:', error)
    throw error
  }
}

// Obtener estadísticas
export const getEstadisticasBolsaDeTrabajo = async (): Promise<EstadisticasBolsaDeTrabajo> => {
  try {
    const todosLosDocumentos = await getBolsaDeTrabajoDocumentos()
    const documentos = todosLosDocumentos.documentos

    const documentosPorTipo: Record<TipoBolsaDeTrabajo, number> = {
      AMPLIACIONES_JORNADA: 0,
      CAMBIOS_AREA: 0,
      CAMBIOS_RAMA: 0,
      CAMBIOS_RESIDENCIA_DESTINO: 0,
      CAMBIOS_RESIDENCIA_ORIGEN: 0,
      CAMBIOS_TIPO_PLAZA: 0,
      CAMBIOS_TURNO_ADSCRIPCION: 0,
      NUEVO_INGRESO: 0,
    }

    const documentosPorEstado: Record<EstadoProcesamiento, number> = {
      PROCESANDO: 0,
      COMPLETADO: 0,
      ERROR: 0,
      VALIDANDO: 0,
    }

    let totalRegistros = 0
    let registrosValidados = 0
    let registrosPendientes = 0

    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)
    let documentosUltimos30Dias = 0

    documentos.forEach((doc) => {
      documentosPorTipo[doc.tipo]++
      documentosPorEstado[doc.estado]++
      totalRegistros += doc.totalRegistros || 0
      registrosValidados += doc.registrosValidados || 0
      registrosPendientes += (doc.totalRegistros || 0) - (doc.registrosValidados || 0)

      const fechaCarga = convertirTimestamp(doc.fechaCarga)
      if (fechaCarga >= hace30Dias) {
        documentosUltimos30Dias++
      }
    })

    return {
      totalDocumentos: documentos.length,
      documentosPorTipo,
      documentosPorEstado,
      totalRegistros,
      registrosValidados,
      registrosPendientes,
      documentosUltimos30Dias,
    }
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error)
    throw error
  }
}
