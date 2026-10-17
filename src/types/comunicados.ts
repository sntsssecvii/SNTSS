import type { Timestamp } from "firebase-admin/firestore";

export type CategoriaComunicado = "aviso" | "negociacion" | "convocatoria";

export interface Comunicado {
  id: string;
  titulo: string;
  cuerpo: string;
  categoria: CategoriaComunicado;
  enlace?: string;
  fijado: boolean;
  publicado: boolean;
  /** Fecha visible del comunicado. Se fija al publicar por primera vez. */
  fechaPublicacion?: Timestamp;
  creadoEn: Timestamp;
  creadoPor: string;
  actualizadoEn?: Timestamp;
}

/** Forma serializable que se expone a la landing y al panel admin. */
export interface ComunicadoPublico {
  id: string;
  titulo: string;
  cuerpo: string;
  categoria: CategoriaComunicado;
  enlace?: string;
  fijado: boolean;
  /** ISO 8601 */
  fecha: string;
}

export interface ComunicadoAdmin extends ComunicadoPublico {
  publicado: boolean;
}
