import type { Timestamp } from "firebase/firestore";
import type { EstadoPropuesta, EstadoFase2, EventoHistorial } from "./workflow";

export type Parentesco = "Hijo" | "Hija" | "Cónyuge" | "Otro";

export interface Aspirante {
  nombreCompleto: string;
  curp: string;
  parentesco: Parentesco | null;
  telefono: string;
}

export interface WarningsPropuesta {
  propuestaActivaExistente: boolean;
  sinRequerimientoDisponible: boolean;
  curpDuplicado: boolean;
  categoriaIncompatible: boolean;
  documentoFaltante: boolean;
}

export interface Propuesta {
  id?: string;
  numeroCaso: string;
  folio: string | null;
  estado: EstadoPropuesta;
  estadoFase2: EstadoFase2 | null;
  motivoRechazo: string | null;
  matricula: string;
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
