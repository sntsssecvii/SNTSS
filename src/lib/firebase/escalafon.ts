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
  EscalafonDocumento,
  EscalafonRegistro,
  FiltrosEscalafon,
  EstadisticasEscalafon,
  TipoEscalafon,
  EstadoProcesamiento,
} from '@/types/escalafon'

const COLECCION = 'escalafon_documentos'
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

// Convertir documento de Firestore a EscalafonDocumento
const convertirDocumento = (doc: any, incluirRegistros: boolean = false): EscalafonDocumento => {
  const data = doc.data()
  return {
    id: doc.id,
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

// Crear nuevo documento de escalafón
export const createEscalafonDocumento = async (
  documento: Omit<EscalafonDocumento, 'id'>
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
    console.error('Error creando documento de escalafón:', error)
    throw error
  }
}

// Obtener registros de una subcolección
export const getRegistrosEscalafon = async (
  documentoId: string,
  limiteRegistros?: number
): Promise<EscalafonRegistro[]> => {
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
    })) as EscalafonRegistro[]
  } catch (error) {
    console.error('Error obteniendo registros de escalafón:', error)
    throw error
  }
}

// Guardar registros en subcolección (en lotes de 500)
export const guardarRegistrosEnSubcoleccion = async (
  documentoId: string,
  registros: EscalafonRegistro[]
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

// Obtener documento por ID (con registros opcionales)
export const getEscalafonDocumentoById = async (
  id: string,
  incluirRegistros: boolean = true
): Promise<EscalafonDocumento | null> => {
  try {
    const docRef = doc(db, COLECCION, id)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    const documento = convertirDocumento(docSnap, false)

    // Cargar registros desde subcolección si se solicita
    if (incluirRegistros) {
      documento.registros = await getRegistrosEscalafon(id)
    }

    return documento
  } catch (error) {
    console.error('Error obteniendo documento de escalafón:', error)
    throw error
  }
}

// Obtener todos los documentos con filtros opcionales
export const getEscalafonDocumentos = async (
  filtros?: FiltrosEscalafon,
  limite?: number,
  ultimoDoc?: QueryDocumentSnapshot
): Promise<{ documentos: EscalafonDocumento[]; ultimoDoc?: QueryDocumentSnapshot }> => {
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
    console.error('Error obteniendo documentos de escalafón:', error)
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
export const updateEscalafonDocumento = async (
  id: string,
  actualizaciones: Partial<Omit<EscalafonDocumento, 'registros'>>
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
    console.error('Error actualizando documento de escalafón:', error)
    throw error
  }
}

// Eliminar documento y sus registros en subcolección
export const deleteEscalafonDocumento = async (id: string): Promise<void> => {
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
    console.error('Error eliminando documento de escalafón:', error)
    throw error
  }
}

// Actualizar estado de un documento
export const updateEstadoDocumento = async (
  id: string,
  estado: EstadoProcesamiento
): Promise<void> => {
  try {
    await updateEscalafonDocumento(id, { estado })
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
    const documento = await getEscalafonDocumentoById(documentoId, true)
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
    const registros = await getRegistrosEscalafon(documentoId)
    const registrosValidados = registros.filter((r) => r.validado).length

    await updateEscalafonDocumento(documentoId, {
      registrosValidados,
    })
  } catch (error) {
    console.error('Error validando registro:', error)
    throw error
  }
}

// Obtener estadísticas
export const getEstadisticasEscalafon = async (): Promise<EstadisticasEscalafon> => {
  try {
    const todosLosDocumentos = await getEscalafonDocumentos()
    const documentos = todosLosDocumentos.documentos

    const documentosPorTipo: Record<TipoEscalafon, number> = {
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
