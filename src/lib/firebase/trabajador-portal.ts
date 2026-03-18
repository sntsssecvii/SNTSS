import { auth } from '@/lib/firebase/firebase-client'
import type { TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

export interface TrabajadorPeriodo {
  anio: number
  mes: number
  quincena: number
}

export interface TramitePortalResult {
  documentoId: string
  recordId?: string
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

interface MisTramitesResponse {
  success: boolean
  matricula: string
  data: TramitePortalResult[]
  periodo: TrabajadorPeriodo
}

interface MiTramiteDetalleResponse {
  success: boolean
  data: TramitePortalResult
  periodo: TrabajadorPeriodo
}

async function getAuthHeaders() {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error('No se pudo validar la sesión del usuario.')
  }

  const idToken = await currentUser.getIdToken()
  return {
    Authorization: `Bearer ${idToken}`,
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload?.error || 'Error al consultar información del trabajador.')
  }

  return payload as T
}

export async function getMisTramitesCliente(): Promise<{
  data: TramitePortalResult[]
  periodo: TrabajadorPeriodo
}> {
  const headers = await getAuthHeaders()
  const response = await fetch('/api/trabajador/mis-tramites', {
    method: 'GET',
    headers,
  })

  const payload = await parseJsonResponse<MisTramitesResponse>(response)
  return {
    data: payload.data || [],
    periodo: payload.periodo,
  }
}

export async function getMiTramiteDetalleCliente(documentoId: string, recordId?: string): Promise<{
  data: TramitePortalResult
  periodo: TrabajadorPeriodo
}> {
  const headers = await getAuthHeaders()
  const query = recordId ? `?recordId=${encodeURIComponent(recordId)}` : ''
  const response = await fetch(`/api/trabajador/mis-tramites/${documentoId}${query}`, {
    method: 'GET',
    headers,
  })

  const payload = await parseJsonResponse<MiTramiteDetalleResponse>(response)
  return {
    data: payload.data,
    periodo: payload.periodo,
  }
}
