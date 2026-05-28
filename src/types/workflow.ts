import type { Timestamp } from "firebase/firestore";

export type EstadoPropuesta = "PENDIENTE" | "APROBADA" | "RECHAZADA";
export type EstadoFase2 = "SIN_ASIGNAR" | "ASIGNADA" | "DEVUELTA";
export type TipoEvento =
  | "CREADA"
  | "APROBADA"
  | "RECHAZADA"
  | "ASIGNADA"
  | "DEVUELTA";

export interface EventoHistorial {
  fecha: Timestamp;
  tipo: TipoEvento;
  usuarioId: string;
  nota: string | null;
}
