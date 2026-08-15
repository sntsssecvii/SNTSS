import { timingSafeEqual } from "crypto";

/**
 * Helpers compartidos del control de mantenimiento (secreto + cookie de bypass).
 * Solo para uso server-side (usa `crypto`). No importar en componentes cliente.
 */

/** Cookie que exime del gate a quien controla el kill-switch (anti-lockout). */
export const COOKIE_BYPASS = "mant_bypass";

/** Compara en tiempo constante el valor provisto contra el secreto del entorno. */
export function secretoMantenimientoValido(
  provisto: string | null | undefined,
): boolean {
  const esperado = process.env.MAINTENANCE_CONTROL_SECRET;
  if (!esperado || !provisto) return false;
  const a = Buffer.from(provisto);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
