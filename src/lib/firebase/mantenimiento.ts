import { adminDb } from "@/lib/firebase/admin";

/**
 * Kill-switch de mantenimiento de la plataforma.
 *
 * El estado vive en el doc Firestore `config/plataforma`. Ese doc queda
 * blindado por el catch-all de `firestore.rules` (ningún cliente puede
 * leerlo ni escribirlo); solo el Admin SDK lo toca desde el servidor.
 *
 * El control se acciona desde `/api/z-control` (protegido por secreto).
 * El gate del layout raíz lee el estado en cada render con un cache corto
 * en memoria para no pegarle a Firestore en cada request.
 */
/**
 * Modos de operación de la plataforma:
 * - `abierto`: todo operativo.
 * - `consulta`: los trabajadores entran y consultan; el panel admin, las APIs
 *   de administración (carga de listados) y el registro de cuentas quedan en pausa.
 * - `total`: todo el portal muestra la pantalla de mantenimiento (la landing sigue).
 */
export type ModoPlataforma = "abierto" | "consulta" | "total";

export const MODOS_PLATAFORMA: readonly ModoPlataforma[] = [
  "abierto",
  "consulta",
  "total",
];

export interface EstadoMantenimiento {
  /** Bloqueo total del portal (modo `total`). */
  activo: boolean;
  modo: ModoPlataforma;
  motivo?: string;
  desde?: string;
}

/** Docs anteriores al modo `consulta` solo tienen `mantenimientoActivo`. */
function modoDesdeDoc(
  data: Record<string, unknown> | undefined,
): ModoPlataforma {
  if (!data?.mantenimientoActivo) return "abierto";
  return data.mantenimientoModo === "consulta" ? "consulta" : "total";
}

const COLLECTION = "config";
const DOC_ID = "plataforma";

/** Tiempo de vida del cache. Marca la latencia máxima de propagación al prender/apagar. */
const TTL_MS = 30_000;

let cache: { estado: EstadoMantenimiento; expira: number } | null = null;

function docRef() {
  return adminDb.collection(COLLECTION).doc(DOC_ID);
}

export async function getEstadoMantenimiento(): Promise<EstadoMantenimiento> {
  const ahora = Date.now();
  if (cache && cache.expira > ahora) {
    return cache.estado;
  }

  try {
    const snap = await docRef().get();
    const data = snap.exists
      ? (snap.data() as Record<string, unknown>)
      : undefined;
    const modo = modoDesdeDoc(data);
    const estado: EstadoMantenimiento = {
      activo: modo === "total",
      modo,
      motivo: (data?.mantenimientoMotivo as string) ?? undefined,
      desde: (data?.mantenimientoDesde as string) ?? undefined,
    };
    cache = { estado, expira: ahora + TTL_MS };
    return estado;
  } catch (err) {
    // Fail-open deliberado: si Firestore falla NO tumbamos la plataforma;
    // asumimos operativa (mejor caer del lado de "el servicio funciona").
    console.error("[mantenimiento] no se pudo leer el estado:", err);
    return cache?.estado ?? { activo: false, modo: "abierto" };
  }
}

export async function setModoPlataforma(
  modo: ModoPlataforma,
  motivo?: string,
): Promise<void> {
  const restringido = modo !== "abierto";
  await docRef().set(
    {
      mantenimientoActivo: restringido,
      mantenimientoModo: restringido ? modo : null,
      mantenimientoMotivo: restringido ? (motivo ?? null) : null,
      mantenimientoDesde: restringido ? new Date().toISOString() : null,
    },
    { merge: true },
  );
  cache = null; // invalidar para que el próximo lector vea el cambio de inmediato
}

/** Compatibilidad: encender/apagar el bloqueo total. */
export async function setMantenimiento(
  activo: boolean,
  motivo?: string,
): Promise<void> {
  await setModoPlataforma(activo ? "total" : "abierto", motivo);
}
