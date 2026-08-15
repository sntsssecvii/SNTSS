import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { getEstadoMantenimiento } from "@/lib/firebase/mantenimiento";
import { MantenimientoScreen } from "@/components/MantenimientoScreen";
import {
  COOKIE_BYPASS,
  secretoMantenimientoValido,
} from "@/lib/mantenimiento-secreto";

/**
 * Gate server-side del kill-switch. Envuelve toda la app en el layout raíz.
 * Si el mantenimiento está activo, el servidor renderiza la pantalla de bloqueo
 * en lugar del árbol de la aplicación — imposible de saltar desde el cliente.
 *
 * El operador con la cookie de bypass válida queda exento (anti-lockout): sigue
 * viendo la app para poder reactivar. Todos los demás ven la pantalla.
 *
 * `noStore()` marca el render como dinámico para que el estado se lea fresco
 * (con el cache corto de `getEstadoMantenimiento`) y el corte propague en tiempo real.
 */
export async function MaintenanceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  noStore();
  const { activo } = await getEstadoMantenimiento();
  if (activo) {
    const bypass = cookies().get(COOKIE_BYPASS)?.value;
    if (!secretoMantenimientoValido(bypass)) {
      return <MantenimientoScreen />;
    }
  }
  return <>{children}</>;
}
