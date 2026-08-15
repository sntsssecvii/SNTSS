import { unstable_noStore as noStore } from "next/cache";
import { getEstadoMantenimiento } from "@/lib/firebase/mantenimiento";
import { MantenimientoScreen } from "@/components/MantenimientoScreen";

/**
 * Gate server-side del kill-switch. Envuelve toda la app en el layout raíz.
 * Si el mantenimiento está activo, el servidor renderiza la pantalla de bloqueo
 * en lugar del árbol de la aplicación — imposible de saltar desde el cliente.
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
    return <MantenimientoScreen />;
  }
  return <>{children}</>;
}
