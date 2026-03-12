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
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    writeBatch,
    doc as firestoreDoc,
} from 'firebase/firestore'
import type { Sincronizacion, EstadoSincronizacion } from '@/types/bolsa-de-trabajo'

const COLECCION = 'sincronizaciones'

const convertirTimestamp = (timestamp: any): Date => {
    if (timestamp?.toDate) {
        return timestamp.toDate()
    }
    if (timestamp instanceof Date) {
        return timestamp
    }
    return new Date()
}

const convertirSincronizacion = (doc: any): Sincronizacion => {
    const data = doc.data()
    return {
        id: doc.id,
        anio: data.anio,
        mes: data.mes,
        quincena: data.quincena,
        estado: data.estado,
        fechaInicio: convertirTimestamp(data.fechaInicio),
        fechaFinalizacion: data.fechaFinalizacion ? convertirTimestamp(data.fechaFinalizacion) : undefined,
        archivosSubidos: data.archivosSubidos || [],
        esFuenteVerdad: data.esFuenteVerdad || false,
        subidoPor: data.subidoPor,
        subidoPorEmail: data.subidoPorEmail,
    }
}

export const createSincronizacion = async (
    sync: Omit<Sincronizacion, 'id' | 'fechaInicio' | 'estado' | 'esFuenteVerdad'>
): Promise<string> => {
    try {
        const nuevaSync = {
            ...sync,
            estado: 'BORRADOR' as EstadoSincronizacion,
            fechaInicio: Timestamp.now(),
            esFuenteVerdad: false,
            archivosSubidos: [],
        }
        const docRef = await addDoc(collection(db, COLECCION), nuevaSync)
        return docRef.id
    } catch (error) {
        console.error('Error creando sincronización:', error)
        throw error
    }
}

export const getSincronizacionById = async (id: string): Promise<Sincronizacion | null> => {
    try {
        const docRef = doc(db, COLECCION, id)
        const docSnap = await getDoc(docRef)
        if (!docSnap.exists()) return null
        return convertirSincronizacion(docSnap)
    } catch (error) {
        console.error('Error obteniendo sincronización:', error)
        throw error
    }
}

export const getSincronizacionPorPeriodo = async (
    anio: number,
    mes: number,
    quincena: 1 | 2
): Promise<Sincronizacion | null> => {
    try {
        const q = query(
            collection(db, COLECCION),
            where('anio', '==', anio),
            where('mes', '==', mes),
            where('quincena', '==', quincena),
            limit(1)
        )
        const querySnapshot = await getDocs(q)
        if (querySnapshot.empty) return null
        return convertirSincronizacion(querySnapshot.docs[0])
    } catch (error) {
        console.error('Error obteniendo sincronización por periodo:', error)
        throw error
    }
}

export const getFuenteVerdad = async (): Promise<Sincronizacion | null> => {
    try {
        const q = query(
            collection(db, COLECCION),
            where('esFuenteVerdad', '==', true),
            limit(1)
        )
        const querySnapshot = await getDocs(q)
        if (querySnapshot.empty) return null
        return convertirSincronizacion(querySnapshot.docs[0])
    } catch (error) {
        console.error('Error obteniendo fuente de verdad:', error)
        throw error
    }
}

export const establecerFuenteVerdad = async (syncId: string): Promise<void> => {
    try {
        const batch = writeBatch(db)

        // 1. Desactivar fuente de verdad actual
        const q = query(collection(db, COLECCION), where('esFuenteVerdad', '==', true))
        const snapshots = await getDocs(q)
        snapshots.forEach((d) => {
            batch.update(d.ref, { esFuenteVerdad: false })
        })

        // 2. Activar la nueva
        const newRef = doc(db, COLECCION, syncId)
        batch.update(newRef, {
            esFuenteVerdad: true,
            estado: 'COMPLETADO',
            fechaFinalizacion: Timestamp.now()
        })

        await batch.commit()
    } catch (error) {
        console.error('Error estableciendo fuente de verdad:', error)
        throw error
    }
}

export const getSincronizaciones = async (limite: number = 20): Promise<Sincronizacion[]> => {
    try {
        const q = query(
            collection(db, COLECCION),
            orderBy('fechaInicio', 'desc'),
            limit(limite)
        )
        const querySnapshot = await getDocs(q)
        return querySnapshot.docs.map(convertirSincronizacion)
    } catch (error) {
        console.error('Error obteniendo sincronizaciones:', error)
        throw error
    }
}

export const updateSincronizacion = async (
    id: string,
    actualizaciones: Partial<Sincronizacion>
): Promise<void> => {
    try {
        const docRef = doc(db, COLECCION, id)
        const data: any = { ...actualizaciones }

        if (actualizaciones.fechaInicio instanceof Date) {
            data.fechaInicio = Timestamp.fromDate(actualizaciones.fechaInicio)
        }
        if (actualizaciones.fechaFinalizacion instanceof Date) {
            data.fechaFinalizacion = Timestamp.fromDate(actualizaciones.fechaFinalizacion)
        }

        delete data.id
        await updateDoc(docRef, data)
    } catch (error) {
        console.error('Error actualizando sincronización:', error)
        throw error
    }
}
