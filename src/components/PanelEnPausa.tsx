import { formatearCorte, getCorteVigente } from "@/lib/firebase/corte-vigente";
import { fuentesGaceta } from "@/lib/fuentes-gaceta";

async function corteVigente() {
  try {
    const corte = await getCorteVigente();
    return corte ? formatearCorte(corte) : null;
  } catch {
    return null;
  }
}

/**
 * Aviso del panel de administración en modo "solo consulta". Se renderiza
 * dentro del shell del panel (sidebar y navbar). Mensaje NEUTRAL: nunca
 * menciona pagos ni motivos; remite al administrador de la plataforma.
 */
export async function PanelEnPausa() {
  const corte = await corteVigente();

  return (
    <div
      className={`${fuentesGaceta} mx-auto flex min-h-[70vh] max-w-3xl items-center [font-family:var(--font-texto)]`}
    >
      <section className="relative w-full border-2 border-[#141414] bg-[#F2EEE6] p-8 text-[#141414] shadow-[10px_10px_0_#D7261E] sm:p-12">
        <span className="absolute -top-5 right-6 rotate-[3deg] bg-[#FFD23F] px-4 py-1.5 text-lg font-extrabold uppercase tracking-tight shadow-[4px_4px_0_#141414] [font-family:var(--font-display)]">
          En pausa
        </span>
        <p className="flex items-center gap-3 text-[13px] font-bold uppercase tracking-[0.2em] text-[#141414]/60">
          <span aria-hidden className="h-2.5 w-2.5 bg-[#D7261E]" />
          Panel de administración
        </p>
        <h1 className="mt-5 text-[clamp(2.25rem,4.5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.02em] [font-family:var(--font-serif)]">
          Carga de listados <em className="text-[#D7261E]">en pausa.</em>
        </h1>
        <div className="mt-6 space-y-4 text-lg leading-relaxed text-[#141414]/80 [font-family:var(--font-serif)]">
          <p>
            La actualización de listados y la administración del portal están
            suspendidas temporalmente.
          </p>
          <p>
            Los trabajadores pueden seguir consultando su información con el
            último corte publicado.
          </p>
        </div>
        {corte && (
          <p className="mt-6 border-t border-[#141414]/20 pt-4 text-sm font-semibold text-[#141414]/70">
            Último corte publicado:{" "}
            <span className="text-[#141414]">{corte}</span>
          </p>
        )}
        <p className="mt-4 text-sm text-[#141414]/70">
          Para más información, comunícate con el administrador de la
          plataforma.
        </p>
      </section>
    </div>
  );
}
