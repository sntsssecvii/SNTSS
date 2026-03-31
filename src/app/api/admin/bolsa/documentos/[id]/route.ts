import { NextRequest, NextResponse } from 'next/server'

import { calcularPosiciones } from '@/lib/bolsa-de-trabajo/calculos'
import { normalizePositionRecord } from '@/lib/bolsa-de-trabajo/position-engine'
import { positionStrategies } from '@/lib/bolsa-de-trabajo/position-strategies'
import { adminDb } from '@/lib/firebase/admin'
import { requireAdminRequest } from '@/lib/firebase/server-auth'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'
import type { BolsaDeTrabajoDocumento, BolsaDeTrabajoRegistro } from '@/types/bolsa-de-trabajo'

function convertirTimestamp(timestamp: any): Date {
  if (timestamp?.toDate) return timestamp.toDate()
  if (timestamp instanceof Date) return timestamp
  return new Date()
}

function convertirDocumento(doc: any): BolsaDeTrabajoDocumento {
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
    registros: [],
    errores: data.errores || [],
    version: data.version || 1,
    totalRegistros: data.totalRegistros || 0,
    registrosValidados: data.registrosValidados || 0,
    registrosConErrores: data.registrosConErrores || 0,
  }
}

function convertirRegistro(doc: any): BolsaDeTrabajoRegistro {
  return {
    id: doc.id,
    ...doc.data(),
  } as BolsaDeTrabajoRegistro
}

function normalizarString(str: string | undefined): string {
  if (!str) return ''
  return str
    .normalize('NFD') // Remove accents
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Keep letters, numbers, spaces, and hyphens
    .replace(/\s+/g, ' ')
}

function getSearchableText(registro: BolsaDeTrabajoRegistro): string {
  // Solo los campos numéricos y de texto que un usuario probablemente buscaría.
  return [
    registro.numeroProg,
    registro.nombre,
    registro.matricula,
    registro.categoria,
    registro.subcategoria,
    registro.zona,
    registro.registro,
    registro.adscripcionNueva,
    registro.adscripcionNuevaNombre,
    registro.turnoNuevo,
    registro.delegacionDestino,
    registro.delegacionOrigen,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => normalizarString(String(value)))
    .join(' ')
}

function applyFilters(
  registros: BolsaDeTrabajoRegistro[],
  search: string,
  filtroValidacion: 'all' | 'pendientes',
  filtroCategoria: string,
  filtroZona: string
) {
  const normalizedSearchWords = normalizarString(search).split(' ').filter(Boolean)
  const normalizedCategoria = filtroCategoria !== 'all' ? normalizarString(filtroCategoria) : ''
  const normalizedZona = filtroZona !== 'all' ? normalizarString(filtroZona) : ''

  return registros.filter((registro) => {
    // Si hay parámetros de búsqueda por palabras, verificamos que TODAS las palabras se encuentren.
    if (normalizedSearchWords.length > 0) {
      const searchTarget = getSearchableText(registro)
      const allWordsMatch = normalizedSearchWords.every((word) => searchTarget.includes(word))
      if (!allWordsMatch) return false
    }

    if (filtroValidacion === 'pendientes' && registro.validado) return false
    if (normalizedCategoria && normalizarString(registro.categoria) !== normalizedCategoria) return false
    if (normalizedZona && normalizarString(registro.zona) !== normalizedZona) return false

    return true
  })
}

// === LRU-like memory cache para evitar saturar firestore en debounces ===
interface CacheEntry {
  time: number
  documento: BolsaDeTrabajoDocumento
  registros: BolsaDeTrabajoRegistro[]
}
const MEMORY_CACHE = new Map<string, CacheEntry>()
const MEMORY_CACHE_TTL_MS = 30_000 // 30 seconds

// Garbage Collection de items viejos
function cleanCache() {
  const now = Date.now()
  MEMORY_CACHE.forEach((value, key) => {
    if (now - value.time > MEMORY_CACHE_TTL_MS) MEMORY_CACHE.delete(key)
  })
}

function buildCategoryFacets(registros: BolsaDeTrabajoRegistro[]) {
  const normalizedToLabel = new Map<string, string>()
  const counts: Record<string, number> = {}

  registros.forEach((registro) => {
    if (!registro.categoria) return
    const label = registro.categoria.trim()
    const normalized = normalizarString(label)
    const currentLabel = normalizedToLabel.get(normalized)

    if (!currentLabel || label.length > currentLabel.length) {
      normalizedToLabel.set(normalized, label)
    }

    counts[label] = (counts[label] || 0) + 1
  })

  return {
    labels: Array.from(normalizedToLabel.values()).sort(),
    counts,
  }
}

function buildZoneFacets(registros: BolsaDeTrabajoRegistro[]) {
  const zones = new Set<string>()
  const counts: Record<string, number> = {}

  registros.forEach((registro) => {
    if (!registro.zona) return
    const zone = registro.zona.trim()
    zones.add(zone)
    counts[zone] = (counts[zone] || 0) + 1
  })

  return {
    labels: Array.from(zones).sort(),
    counts,
  }
}

function buildGroupedRecords(
  documento: BolsaDeTrabajoDocumento,
  registros: BolsaDeTrabajoRegistro[]
) {
  const groups = new Map<string, BolsaDeTrabajoRegistro[]>()
  const strategy = positionStrategies[documento.tipo]

  registros.forEach((registro) => {
    const normalized = normalizePositionRecord(registro)
    const key = normalized && strategy
      ? strategy.buildGroupKey(normalized)
      : `${registro.categoria || ''}-${registro.subcategoria || ''}-${registro.zona || ''}`

    const existing = groups.get(key) || []
    existing.push(registro)
    groups.set(key, existing)
  })

  return groups
}

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdminRequest(request)
    enforceRateLimit(request, {
      bucket: 'api:admin:bolsa:documento-detalle',
      limit: 900,
      windowMs: 60_000,
      identifier: adminUser.uid,
    })

    const { id } = await params
    const page = Math.max(Number(request.nextUrl.searchParams.get('page') || '1'), 1)
    const pageSize = Math.min(Math.max(Number(request.nextUrl.searchParams.get('pageSize') || '50'), 10), 100)
    const search = request.nextUrl.searchParams.get('search') || ''
    const filtroValidacion = (request.nextUrl.searchParams.get('filtroValidacion') || 'all') as 'all' | 'pendientes'
    const filtroCategoria = request.nextUrl.searchParams.get('filtroCategoria') || 'all'
    const filtroZona = request.nextUrl.searchParams.get('filtroZona') || 'all'
    const format = request.nextUrl.searchParams.get('format') || 'json'

    cleanCache() // Clean up old memory caches randomly to prevent leaks
    
    let documento: BolsaDeTrabajoDocumento
    let registros: BolsaDeTrabajoRegistro[]
    const now = Date.now()
    const cached = MEMORY_CACHE.get(id)

    if (cached && now - cached.time < MEMORY_CACHE_TTL_MS) {
      documento = cached.documento
      registros = cached.registros
    } else {
      const docRef = adminDb.collection('bolsa_de_trabajo_documentos').doc(id)
      const docSnap = await docRef.get()

      if (!docSnap.exists) {
        return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 })
      }

      documento = convertirDocumento(docSnap)
      const registrosSnap = await docRef.collection('registros').orderBy('filaOriginal', 'asc').get()
      registros = registrosSnap.docs.map(convertirRegistro)
      
      MEMORY_CACHE.set(id, { time: now, documento, registros })
    }

    const filtrados = applyFilters(registros, search, filtroValidacion, filtroCategoria, filtroZona)

    if (format === 'csv') {
      const headers = Object.keys(filtrados[0] || {}).filter((key) => key !== 'id')
      const rows = filtrados.map((registro) =>
        headers.map((header) => `"${(registro as any)[header] || ''}"`).join(',')
      )
      const csv = [headers.join(','), ...rows].join('\n')

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${documento.nombreArchivo || 'export'}.csv"`,
        },
      })
    }

    const total = filtrados.length
    const totalPages = Math.max(Math.ceil(total / pageSize), 1)
    const safePage = Math.min(page, totalPages)
    const pageStart = (safePage - 1) * pageSize
    const pagina = filtrados.slice(pageStart, pageStart + pageSize)

    const groupedRecords = buildGroupedRecords(documento, registros)
    const registrosConPosicion = pagina.map((registro) => {
      const strategy = positionStrategies[documento.tipo]
      const normalized = normalizePositionRecord(registro)
      const key = normalized && strategy
        ? strategy.buildGroupKey(normalized)
        : `${registro.categoria || ''}-${registro.subcategoria || ''}-${registro.zona || ''}`
      const grupo = groupedRecords.get(key) || [registro]

      return {
        ...registro,
        _posCalculada: calcularPosiciones(grupo, registro.matricula || '', documento.tipo),
      }
    })

    const categorias = buildCategoryFacets(registros)
    const zonas = buildZoneFacets(registros)

    return NextResponse.json({
      success: true,
      data: {
        documento,
        registros: registrosConPosicion,
        pagination: {
          page: safePage,
          pageSize,
          total,
          totalPages,
        },
        facetas: {
          categorias: categorias.labels,
          categoriasCount: categorias.counts,
          zonas: zonas.labels,
          zonasCount: zonas.counts,
        },
      },
    })
  } catch (error: any) {
    console.error('Error obteniendo detalle de documento de bolsa:', error)

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
      { error: 'No se pudo obtener el documento.', details: error?.message || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}
