import type { Timestamp } from "firebase/firestore";

export interface Partida {
  zona: string;
  categoria: string;
  cantidadTotal: number;
  cantidadDisponible: number;
}

export interface Requerimiento {
  id?: string;
  numeroOficio: string;
  fechaCircular: Timestamp;
  estado: "ACTIVO" | "CERRADO";
  partidas: Partida[];
  creadoPor: string;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
