/**
 * Pantalla de bloqueo del kill-switch de mantenimiento.
 *
 * Server component sin dependencias de auth: se renderiza aunque el resto
 * de la plataforma esté cortada. Mensaje deliberadamente NEUTRAL — nunca
 * menciona pagos ni motivos internos.
 */
export function MantenimientoScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-slate-50 text-slate-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.png"
        alt="SNTSS"
        width={88}
        height={88}
        className="opacity-90"
      />
      <h1 className="text-2xl font-semibold tracking-tight">
        Plataforma en mantenimiento
      </h1>
      <p className="max-w-md text-slate-500 leading-relaxed">
        Estamos realizando tareas de mantenimiento programado. El servicio
        estará disponible en breve. Agradecemos su comprensión.
      </p>
      <span className="text-xs text-slate-400 mt-4">Zentry Tech Group</span>
    </div>
  );
}
