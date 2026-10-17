import { z } from "zod";
import type {
  CategoriaComunicado,
  ComunicadoPublico,
} from "@/types/comunicados";

/**
 * Helpers puros del módulo de comunicados oficiales (sin Firebase).
 * Seguros para usarse en cliente y servidor.
 */

export const CATEGORIAS_COMUNICADO: Record<CategoriaComunicado, string> = {
  aviso: "Aviso",
  negociacion: "Negociación",
  convocatoria: "Convocatoria",
};

export const MAX_COMUNICADOS_LANDING = 6;

const enlaceSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Enlace inválido.")
  .optional();

export const comunicadoInputSchema = z.object({
  titulo: z.string().trim().min(3, "Título muy corto.").max(140),
  cuerpo: z.string().trim().min(10, "Contenido muy corto.").max(4000),
  categoria: z.enum(["aviso", "negociacion", "convocatoria"]),
  enlace: enlaceSchema,
  fijado: z.boolean().default(false),
  publicado: z.boolean().default(false),
});

export const comunicadoPatchSchema = comunicadoInputSchema.partial();

export type ComunicadoInput = z.infer<typeof comunicadoInputSchema>;

/** Fijados primero; dentro de cada grupo, el más reciente primero. */
export function ordenarComunicados<
  T extends Pick<ComunicadoPublico, "fijado" | "fecha">,
>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (a.fijado !== b.fijado) return a.fijado ? -1 : 1;
    return b.fecha.localeCompare(a.fecha);
  });
}

export function formatearFechaComunicado(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Tijuana",
  });
}
