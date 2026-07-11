import { auth } from "@/lib/firebase/firebase-client";
import type { TipoBolsaDeTrabajo } from "@/types/bolsa-de-trabajo";
import type { EscalafonPreferencia } from "@/types/escalafon";
import type { CambiosPosicionResult } from "@/types/cambios-escalafon";

export interface EscalafonPosicionResult {
  listadoId: string;
  categoriaCode: string;
  categoriaDesc: string;
  areaCode: string;
  areaDesc: string;
  vigenciaInicio: string;
  vigenciaFin: string;
  periodoDecierre: string;
  lugar: number;
  estatus: "Activo" | "PEI";
  preferencias: EscalafonPreferencia[];
  posicionesPorZona: Record<string, number>;
  posicionesActivoPorZona: Record<string, number>;
  posicionesPeiPorZona: Record<string, number>;
}

interface EscalafonPosicionResponse {
  success: boolean;
  data: EscalafonPosicionResult[];
}

export interface TrabajadorPeriodo {
  anio: number;
  mes: number;
  quincena: number;
}

export interface TramitePortalResult {
  documentoId: string;
  recordId?: string;
  matricula: string;
  nombre: string;
  categoria: string;
  zona: string;
  tipoDocumento: TipoBolsaDeTrabajo;
  tipoContratacion?: string;
  adscripcionNueva?: string;
  turnoNuevo?: string;
  registro?: string;
  posicionBase: number;
  posicionInterinato?: number;
  totalEnCategoria: number;
  totalEventualesEnCategoria?: number;
}

interface MisTramitesResponse {
  success: boolean;
  matricula: string;
  data: TramitePortalResult[];
  periodo: TrabajadorPeriodo;
}

interface MiTramiteDetalleResponse {
  success: boolean;
  data: TramitePortalResult;
  periodo: TrabajadorPeriodo;
}

async function getAuthHeaders() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No se pudo validar la sesión del usuario.");
  }

  const idToken = await currentUser.getIdToken();
  return {
    Authorization: `Bearer ${idToken}`,
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.error || "Error al consultar información del trabajador.",
    );
  }

  return payload as T;
}

export async function getMisTramitesCliente(): Promise<{
  data: TramitePortalResult[];
  periodo: TrabajadorPeriodo;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/trabajador/mis-tramites", {
    method: "GET",
    headers,
  });

  const payload = await parseJsonResponse<MisTramitesResponse>(response);
  return {
    data: payload.data || [],
    periodo: payload.periodo,
  };
}

export async function getMiTramiteDetalleCliente(
  documentoId: string,
  recordId?: string,
): Promise<{
  data: TramitePortalResult;
  periodo: TrabajadorPeriodo;
}> {
  const headers = await getAuthHeaders();
  const query = recordId ? `?recordId=${encodeURIComponent(recordId)}` : "";
  const response = await fetch(
    `/api/trabajador/mis-tramites/${documentoId}${query}`,
    {
      method: "GET",
      headers,
    },
  );

  const payload = await parseJsonResponse<MiTramiteDetalleResponse>(response);
  return {
    data: payload.data,
    periodo: payload.periodo,
  };
}

export async function getMiEscalafonCliente(): Promise<{
  data: EscalafonPosicionResult[];
}> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/trabajador/escalafon-posicion", {
    method: "GET",
    headers,
  });

  const payload = await parseJsonResponse<EscalafonPosicionResponse>(response);
  return { data: payload.data || [] };
}

export async function getMisCambiosEscalafonCliente(): Promise<{
  data: CambiosPosicionResult[];
}> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/trabajador/cambios-posicion", {
    method: "GET",
    headers,
  });

  const payload = await parseJsonResponse<{
    success: boolean;
    data: CambiosPosicionResult[];
  }>(response);
  return { data: payload.data || [] };
}
