import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'

import { adminDb } from '@/lib/firebase/admin'
import { requireAdminRequest } from '@/lib/firebase/server-auth'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'
import { EstadoPropuesta } from '@/types/workflow'

export const dynamic = 'force-dynamic'

const COLECCION = 'propuestas'

function buildMonthLabel(date: Date) {
  const nombreMes = date.toLocaleDateString('es-MX', { month: 'short' })
  return nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)
}

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, { bucket: 'api:admin:estadisticas:resumen', limit: 30, windowMs: 60_000 })
    await requireAdminRequest(request)

    const propuestasRef = adminDb.collection(COLECCION)
    const ahora = new Date()
    const inicioMesActual = Timestamp.fromDate(new Date(ahora.getFullYear(), ahora.getMonth(), 1))
    const finMesActual = Timestamp.fromDate(new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59))
    const hace30Dias = Timestamp.fromDate(new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000))

    const estados = Object.values(EstadoPropuesta)

    const [
      totalSnap,
      pendientesRevisionSnap,
      pendientesBorradorSnap,
      aprobadasSnap,
      rechazadasSnap,
      prioridadAltaSnap,
      actividadMesSnap,
      distribucionSnaps,
      propuestasPorMes,
      propuestasCerradasSnap,
      propuestasVencimientoSnap,
    ] = await Promise.all([
      propuestasRef.count().get(),
      propuestasRef.where('estado', '==', EstadoPropuesta.EN_REVISION).count().get(),
      propuestasRef.where('estado', '==', EstadoPropuesta.BORRADOR).count().get(),
      propuestasRef.where('estado', '==', EstadoPropuesta.APROBADA).count().get(),
      propuestasRef.where('estado', '==', EstadoPropuesta.RECHAZADA).count().get(),
      propuestasRef.where('prioridad', '==', 'ALTA').count().get(),
      propuestasRef.where('fechaCreacion', '>=', inicioMesActual).where('fechaCreacion', '<=', finMesActual).count().get(),
      Promise.all(estados.map((estado) => propuestasRef.where('estado', '==', estado).count().get())),
      Promise.all(
        Array.from({ length: 12 }, (_, offset) => {
          const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - (11 - offset), 1)
          const inicioMes = Timestamp.fromDate(fecha)
          const finMes = Timestamp.fromDate(new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59))

          return propuestasRef
            .where('fechaCreacion', '>=', inicioMes)
            .where('fechaCreacion', '<=', finMes)
            .count()
            .get()
          .then((snap) => ({
              mes: buildMonthLabel(fecha),
              cantidad: snap.data().count,
            }))
        })
      ),
      propuestasRef.where('estado', 'in', [EstadoPropuesta.APROBADA, EstadoPropuesta.COMPLETADA]).get(),
      propuestasRef.where('fechaVencimiento', '<', Timestamp.now()).get(),
    ])

    const distribucionPorEstado = estados.reduce<Record<string, number>>((acc, estado, index) => {
      acc[estado] = distribucionSnaps[index].data().count
      return acc
    }, {})

    const propuestasVencidas = propuestasVencimientoSnap.docs.filter((doc) => {
      const data = doc.data()
      return data.estado !== EstadoPropuesta.COMPLETADA && data.estado !== EstadoPropuesta.RECHAZADA
    }).length

    let aprobadasUltimos30Dias = 0
    const propuestasUltimos30DiasDocs = await propuestasRef.where('fechaActualizacion', '>=', hace30Dias).get()
    propuestasUltimos30DiasDocs.forEach((doc) => {
      if (doc.data().estado === EstadoPropuesta.APROBADA) {
        aprobadasUltimos30Dias += 1
      }
    })

    let totalDias = 0
    let totalProcesadas = 0
    propuestasCerradasSnap.forEach((doc) => {
      const data = doc.data()
      const fechaCreacion = data.fechaCreacion?.toDate?.()
      const fechaActualizacion = data.fechaActualizacion?.toDate?.()

      if (!fechaCreacion || !fechaActualizacion) return

      const dias = Math.ceil((fechaActualizacion.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24))
      totalDias += dias
      totalProcesadas += 1
    })

    const totalUltimos30Dias = propuestasUltimos30DiasDocs.size
    const tasaAprobacion = totalUltimos30Dias > 0 ? (aprobadasUltimos30Dias / totalUltimos30Dias) * 100 : 0
    const tiempoPromedioProcesamiento = totalProcesadas > 0 ? Math.round(totalDias / totalProcesadas) : 0

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalPropuestas: totalSnap.data().count,
          propuestasPendientes: pendientesRevisionSnap.data().count + pendientesBorradorSnap.data().count,
          propuestasAprobadas: aprobadasSnap.data().count,
          propuestasRechazadas: rechazadasSnap.data().count,
          propuestasRequierenAtencion: prioridadAltaSnap.data().count + propuestasVencidas,
          actividadDelMes: actividadMesSnap.data().count,
          tasaAprobacion,
          tiempoPromedioProcesamiento,
        },
        charts: {
          propuestasPorMes,
          distribucionPorEstado,
        },
      },
    })
  } catch (error: any) {
    console.error('Error obteniendo resumen de estadísticas admin:', error)

    if (error instanceof RateLimitError || error?.message === 'RATE_LIMITED') {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds || 60) } }
      )
    }

    if (error?.message === 'AUTH_REQUIRED') {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    if (error?.message === 'PROFILE_NOT_FOUND') {
      return NextResponse.json({ error: 'Perfil de administrador no encontrado.' }, { status: 404 })
    }

    if (error?.message === 'ACCOUNT_INACTIVE') {
      return NextResponse.json({ error: 'La cuenta no está activa.' }, { status: 403 })
    }

    if (error?.message === 'ADMIN_REQUIRED') {
      return NextResponse.json({ error: 'Se requiere perfil de administrador.' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'No se pudo obtener el resumen de estadísticas.', details: error?.message || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}
