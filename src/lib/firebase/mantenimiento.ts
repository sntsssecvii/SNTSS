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
export interface EstadoMantenimiento {
  activo: boolean;
  motivo?: string;
  desde?: string;
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
    const estado: EstadoMantenimiento = {
      activo: Boolean(data?.mantenimientoActivo),
      motivo: (data?.mantenimientoMotivo as string) ?? undefined,
      desde: (data?.mantenimientoDesde as string) ?? undefined,
    };
    cache = { estado, expira: ahora + TTL_MS };
    return estado;
  } catch (err) {
    // Fail-open deliberado: si Firestore falla NO tumbamos la plataforma;
    // asumimos operativa (mejor caer del lado de "el servicio funciona").
    console.error("[mantenimiento] no se pudo leer el estado:", err);
    return cache?.estado ?? { activo: false };
  }
}

export async function setMantenimiento(
  activo: boolean,
  motivo?: string,
): Promise<void> {
  await docRef().set(
    {
      mantenimientoActivo: activo,
      mantenimientoMotivo: motivo ?? null,
      mantenimientoDesde: activo ? new Date().toISOString() : null,
    },
    { merge: true },
  );
  cache = null; // invalidar para que el próximo lector vea el cambio de inmediato
}
