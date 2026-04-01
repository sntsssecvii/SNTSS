import { NextRequest, NextResponse } from 'next/server'

import { adminDb } from '@/lib/firebase/admin'
import { requireAdminRequest } from '@/lib/firebase/server-auth'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'
import { TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

export const dynamic = 'force-dynamic'

const TIPOS: TipoBolsaDeTrabajo[] = [
  'NUEVO_INGRESO',
  'AMPLIACIONES_JORNADA',
  'CAMBIOS_TURNO_ADSCRIPCION',
  'CAMBIOS_AREA',
  'CAMBIOS_RAMA',
  'CAMBIOS_RESIDENCIA_DESTINO',
  'CAMBIOS_RESIDENCIA_ORIGEN',
  'CAMBIOS_TIPO_PLAZA',
]

function getCurrentQuincenaContext() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const quincena = now.getDate() <= 15 ? 1 : 2
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  return {
    month,
    year,
    quincena,
    quincenaLabel: `Q${quincena} ${meses[month - 1]}`,
  }
}

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, { bucket: 'api:admin:bolsa:grid-resumen', limit: 60, windowMs: 60_000 })
    await requireAdminRequest(request)

    const { month, year, quincena, quincenaLabel } = getCurrentQuincenaContext()

    const snapshot = await adminDb
      .collection('bolsa_de_trabajo_documentos')
      .where('metadata.anio', '==', year)
      .where('metadata.mes', '==', month)
      .where('metadata.quincena', '==', quincena)
      .get()

    const totals = Object.fromEntries(TIPOS.map((tipo) => [tipo, 0])) as Record<TipoBolsaDeTrabajo, number>

    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      const tipo = data.tipo as TipoBolsaDeTrabajo
      if (!TIPOS.includes(tipo)) return
      totals[tipo] += Number(data.totalRegistros || 0)
    })

    return NextResponse.json({
      success: true,
      data: {
        quincenaLabel,
        totals,
      },
    })
  } catch (error: any) {
    console.error('Error obteniendo resumen de bolsa para dashboard admin:', error)

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
      { error: 'No se pudo obtener el resumen de bolsa.', details: error?.message || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}
