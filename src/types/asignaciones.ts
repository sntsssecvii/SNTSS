import type { Timestamp } from "firebase/firestore";

export interface Asignacion {
  id?: string;
  propuestaId: string;
  requerimientoId: string;
  zona: string;
  categoria: string;
  estado: "ACTIVA" | "DEVUELTA";
  asignadoPor: string;
  asignadoEn: Timestamp;
}
