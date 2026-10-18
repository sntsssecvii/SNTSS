import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { getEstadoMantenimiento } from "@/lib/firebase/mantenimiento";
import { tieneBypass } from "@/lib/mantenimiento-secreto";

/**
 * Gate del modo "solo consulta": con la plataforma en pausa (modo `consulta`
 * o `total`) muestra `aviso` en lugar del contenido. Se usa en las rutas de
 * administración y en el registro; el portal del trabajador queda abierto.
 * Las APIs se bloquean aparte, en `requireAdminRequest` y en `/api/registro`.
 * Quien trae la cookie de bypass queda exento (anti-lockout).
 */
export async function PausaGate({
  children,
  aviso,
}: {
  children: React.ReactNode;
  aviso: React.ReactNode;
}) {
  noStore();
  const { modo } = await getEstadoMantenimiento();
  if (modo !== "abierto" && !tieneBypass(cookies())) {
    return <>{aviso}</>;
  }
  return <>{children}</>;
}
