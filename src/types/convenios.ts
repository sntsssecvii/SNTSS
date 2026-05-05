import type { Timestamp } from "firebase-admin/firestore";

export interface Convenio {
  id: string;
  imageUrl: string;
  titulo?: string;
  link?: string;
  orden: number;
  publicado: boolean;
  creadoEn: Timestamp;
  creadoPor: string;
}

export interface ConvenioPublico {
  id: string;
  imageUrl: string;
  link?: string;
  orden: number;
}
