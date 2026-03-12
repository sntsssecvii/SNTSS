import { NextRequest, NextResponse } from 'next/server'
import { getFuenteVerdad } from '@/lib/firebase/sincronizaciones'
import { db } from '@/lib/firebase/server-config'
import { collection, query, where, getDocs, limit } from 'firebase/firestore'
import { calcularPosiciones } from '@/lib/bolsa-de-trabajo/calculos'
import { getComparisonRecordsForWorker } from '@/lib/bolsa-de-trabajo/comparison-groups'
import { BolsaDeTrabajoRegistro, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const matricula = searchParams.get('matricula')

    if (!matricula) {
        return NextResponse.json({ error: 'Matrícula requerida' }, { status: 400 })
    }

    try {
        // 1. Obtener la sincronización activa (Fuente de Verdad)
        const syncActiva = await getFuenteVerdad()
        if (!syncActiva) {
            return NextResponse.json({ error: 'No hay información oficial activa en este momento.' }, { status: 404 })
        }

        // 2. Obtener todos los documentos de esa sincronización
        const docsRef = collection(db, 'bolsa_de_trabajo_documentos')
        const qDocs = query(
            docsRef,
            where('syncId', '==', syncActiva.id)
        )
        const snapDocs = await getDocs(qDocs)

        if (snapDocs.empty) {
            return NextResponse.json({ error: 'No se encontraron listados para esta quincena.' }, { status: 404 })
        }

        // 3. Buscar al trabajador en los registros de CUALQUIER documento de esta sincronización
        let dataTrabajador: BolsaDeTrabajoRegistro | null = null
        let docIdEncontrado: string | null = null
        let tipoDocumento: TipoBolsaDeTrabajo | null = null

        for (const docSnap of snapDocs.docs) {
            const registrosRef = collection(db, 'bolsa_de_trabajo_documentos', docSnap.id, 'registros')
            const qTrabajador = query(registrosRef, where('matricula', '==', matricula), limit(1))
            const snapTrabajador = await getDocs(qTrabajador)

            if (!snapTrabajador.empty) {
                dataTrabajador = { id: snapTrabajador.docs[0].id, ...snapTrabajador.docs[0].data() } as BolsaDeTrabajoRegistro
                docIdEncontrado = docSnap.id
                tipoDocumento = docSnap.data().tipo as TipoBolsaDeTrabajo
                break // Encontrado
            }
        }

        if (!dataTrabajador || !docIdEncontrado || !tipoDocumento) {
            return NextResponse.json({
                error: 'No se encontraron registros para esta matrícula en el listado actual.',
                matricula
            }, { status: 404 })
        }

        // 4. Obtener todos los registros del documento encontrado y derivar el grupo comparable
        const registrosRef = collection(db, 'bolsa_de_trabajo_documentos', docIdEncontrado, 'registros')
        const snapComparacion = await getDocs(registrosRef)
        const registros = snapComparacion.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BolsaDeTrabajoRegistro[]
        const comparisonRecords = getComparisonRecordsForWorker(registros, dataTrabajador, tipoDocumento)

        // 5. Realizar cálculos
        const resultado = calcularPosiciones(comparisonRecords, matricula, tipoDocumento)

        if (!resultado) {
            return NextResponse.json({ error: 'Error al calcular posiciones.' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            data: {
                ...resultado,
                tipoDocumento
            },
            periodo: {
                anio: syncActiva.anio,
                mes: syncActiva.mes,
                quincena: syncActiva.quincena
            }
        })

    } catch (error: any) {
        console.error('Error en consulta de posición:', error)
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 })
    }
}
