import type { Timestamp } from "firebase/firestore";
import type { EstadoPropuesta, EstadoFase2, EventoHistorial } from "./workflow";

export type Parentesco =
  | "PADRE/MADRE"
  | "ESPOSO/A"
  | "HERMANO/A"
  | "HIJO/A"
  | "OTRO"
  | "SIN FAMILIAR";

export interface Aspirante {
  nombreCompleto: string;
  parentesco: Parentesco | null;
  matriculaFamiliar: string;
  telefono: string;
  tipoContratacion: string;
  correo: string;
  antiguedad: string; // "xx años xx qnas xx dias"
  fechaIngreso: string; // YYYY-MM-DD
  unidadAdscripcion: string;
}

export const MUNICIPIOS_BC = [
  "Mexicali",
  "Tijuana",
  "Ensenada",
  "Tecate",
  "Rosarito",
  "San Felipe",
  "San Quintín",
  "San Luis Rio Colorado",
] as const;

export const ESCOLARIDAD_OPTIONS = [
  "Primaria",
  "Secundaria",
  "Preparatoria / Bachillerato",
  "Técnico / Tecnológico",
  "Licenciatura",
  "Especialidad",
  "Maestría",
  "Doctorado",
] as const;

export const ZONAS_BC = [
  "01= San Luis RCS",
  "02= Mexicali",
  "03= Tijuana",
  "04= Ensenada",
  "05= Tecate",
  "06= Valle de Ensenada",
  "07= Valle de Mexicali",
  "08= Valle de San Luis RCS",
  "09= San Felipe",
] as const;

export type ZonaBC = (typeof ZONAS_BC)[number];

export interface DatosSolicitante {
  nombreCompleto: string;
  correo: string;
  domicilioCalle: string;
  domicilioNumero: string;
  domicilioColonia: string;
  domicilioMunicipio: string; // includes "Otro: <texto>" for custom
  domicilioEstado: string;
  codigoPostal: string;
  telefono: string;
  escolaridad: string;
  fechaNacimiento: string; // YYYY-MM-DD
  edad: number;
  estadoNacimiento: string;
  rfc: string; // 13 chars: AAAA######AAA
}

export interface WarningsPropuesta {
  propuestaActivaExistente: boolean;
  sinRequerimientoDisponible: boolean;
  curpDuplicado: boolean;
  categoriaIncompatible: boolean;
  documentoFaltante: boolean;
}

export interface DatosPropuesta {
  categoriaSolicitada: string;
  zona: string;
}

export interface Propuesta {
  id?: string;
  numeroCaso: string;
  folio: string | null;
  estado: EstadoPropuesta;
  estadoFase2: EstadoFase2 | null;
  motivoRechazo: string | null;
  matricula: string;
  solicitante: DatosSolicitante | null;
  datosPropuesta: DatosPropuesta | null;
  sinFamiliar: boolean;
  aspirante: Aspirante | null;
  documentos: { ineUrl: string | null };
  warnings: WarningsPropuesta;
  historial: EventoHistorial[];
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

export const CATEGORIAS_PROPUESTA = [
  "Asistente Médica",
  "Aux. Admon en UM",
  "Aux. de Almacen",
  "Aux. de Farmacia",
  "Aux. de Laboratorio",
  "Aux. Serv. Grales UM",
  "Aux. Serv. Intenden.",
  "Aux. Serv. Admtvos.",
  "Aux. Trabajo Social",
  "Aux. Univ. De Ofna.",
  "Chofer",
  "Laboratorio",
  "Manejador de Alim.",
  "Mensajero",
  "Oficial de Puericultura",
  "Op. De Ambulancias",
  "Op. De Lavanderia",
  "Tec. Polivalente",
  "Tec. Radióloga",
  "Trabajo Social",
  "Nutricionista Dietista",
  "Estomatólogo",
  "Psicólogo",
  "Medico General",
  "Aux. Enf. Gral",
  "Enfermera Gral",
] as const;

export type CategoriaPropuesta = (typeof CATEGORIAS_PROPUESTA)[number];

export const validarCURP = (curp: string): boolean => {
  if (!curp) return false;
  const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;
  return curpRegex.test(curp.toUpperCase());
};

export const validarTelefono = (telefono: string): boolean => {
  if (!telefono) return false;
  return /^\d{10}$/.test(telefono.replace(/\D/g, ""));
};
