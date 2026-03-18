import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { calcularPosiciones } from '@/lib/bolsa-de-trabajo/calculos'
import { getComparisonRecordsForWorker } from '@/lib/bolsa-de-trabajo/comparison-groups'
import { getBolsaPosicionesMaterializadasPorMatricula } from '@/lib/firebase/bolsa-posiciones-materializadas'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'
import type { BolsaDeTrabajoRegistro, BolsaPosicionMaterializada, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const matricula = searchParams.get('matricula')

    if (!matricula) {
        return NextResponse.json({ error: 'Matrícula requerida' }, { status: 400 })
    }

    try {
        enforceRateLimit(request, { bucket: 'api:trabajador:posicion-publica', limit: 20, windowMs: 60_000 })
        // 1. Obtener la sincronización activa (Fuente de Verdad)
        const syncSnap = await adminDb
            .collection('sincronizaciones')
            .where('esFuenteVerdad', '==', true)
            .limit(1)
            .get()

        if (syncSnap.empty) {
            return NextResponse.json({ error: 'No hay información oficial activa en este momento.' }, { status: 404 })
        }

        const syncDoc = syncSnap.docs[0]
        const syncActiva = {
            id: syncDoc.id,
            ...syncDoc.data(),
        } as { id: string; anio: number; mes: number; quincena: number }

        // 2. Obtener todos los documentos de esa sincronización
        const snapDocs = await adminDb
            .collection('bolsa_de_trabajo_documentos')
            .where('syncId', '==', syncActiva.id)
            .get()

        if (snapDocs.empty) {
            return NextResponse.json({ error: 'No se encontraron listados para esta quincena.' }, { status: 404 })
        }

        const posiciones = await getBolsaPosicionesMaterializadasPorMatricula(syncActiva.id, matricula)

        if (posiciones.length === 0) {
            let dataTrabajador: BolsaDeTrabajoRegistro | null = null
            let docIdEncontrado: string | null = null
            let tipoDocumento: TipoBolsaDeTrabajo | null = null

            for (const docSnap of snapDocs.docs) {
                const snapTrabajador = await docSnap.ref
                    .collection('registros')
                    .where('matricula', '==', matricula)
                    .limit(1)
                    .get()

                if (!snapTrabajador.empty) {
                    dataTrabajador = { id: snapTrabajador.docs[0].id, ...snapTrabajador.docs[0].data() } as BolsaDeTrabajoRegistro
                    docIdEncontrado = docSnap.id
                    tipoDocumento = docSnap.data().tipo as TipoBolsaDeTrabajo
                    break
                }
            }

            if (!dataTrabajador || !docIdEncontrado || !tipoDocumento) {
                return NextResponse.json({
                    error: 'No se encontraron registros para esta matrícula en el listado actual.',
                    matricula
                }, { status: 404 })
            }

            const snapComparacion = await adminDb
                .collection('bolsa_de_trabajo_documentos')
                .doc(docIdEncontrado)
                .collection('registros')
                .get()
            const registros = snapComparacion.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BolsaDeTrabajoRegistro[]
            const comparisonRecords = getComparisonRecordsForWorker(registros, dataTrabajador, tipoDocumento)
            const resultadoFallback = calcularPosiciones(comparisonRecords, matricula, tipoDocumento)

            if (!resultadoFallback) {
                return NextResponse.json({ error: 'Error al calcular posiciones.' }, { status: 500 })
            }

            return NextResponse.json({
                success: true,
                data: {
                    ...resultadoFallback,
                    tipoDocumento
                },
                periodo: {
                    anio: syncActiva.anio,
                    mes: syncActiva.mes,
                    quincena: syncActiva.quincena
                }
            })
        }

        const orderedDocIds = snapDocs.docs.map((doc) => doc.id)
        const resultado = orderedDocIds
            .map((docId) => posiciones.find((item) => item.documentoId === docId))
            .find((item): item is BolsaPosicionMaterializada => Boolean(item))

        if (!resultado) {
            return NextResponse.json({ error: 'No se encontró una posición materializada para esta matrícula.' }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: {
                ...resultado,
                registro: resultado.grupoComparable?.registro,
            },
            periodo: {
                anio: syncActiva.anio,
                mes: syncActiva.mes,
                quincena: syncActiva.quincena
            }
        })

    } catch (error: any) {
        console.error('Error en consulta de posición:', error)

        if (error instanceof RateLimitError || error?.message === 'RATE_LIMITED') {
            return NextResponse.json(
                { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
                { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds || 60) } }
            )
        }
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 })
    }
}
