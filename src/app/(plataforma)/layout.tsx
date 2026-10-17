import { MaintenanceGate } from "@/components/MaintenanceGate";

/**
 * Grupo que agrupa todas las rutas operativas de la plataforma (auth, portal,
 * admin, solicitud pública). El kill-switch vive aquí y no en el layout raíz
 * para que la landing (`/`) siga visible durante una suspensión.
 *
 * Al ser un layout distinto al de la landing, navegar de `/` hacia cualquier
 * ruta de este grupo lo renderiza en servidor y re-evalúa el gate: no hay
 * forma de brincar el bloqueo entrando por la landing.
 */
export default function PlataformaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MaintenanceGate>{children}</MaintenanceGate>;
}
