import Image from "next/image";

import logoSNTSS from "@/assets/logo-sntss.png";
import { AtribucionZentry } from "@/components/AtribucionZentry";
import { GuiasColumnas, MarcasRegistro } from "@/components/FondosGaceta";
import { fuentesGaceta } from "@/lib/fuentes-gaceta";

const retraso = (paso: number) => ({ "--d": paso }) as React.CSSProperties;

/** Ficha del portal "en pausa": misma tarjeta de la landing, sin datos. */
function FichaEnPausa() {
  return (
    <figure className="relative mx-auto w-full max-w-md">
      <span
        style={retraso(4)}
        className="gaceta-entrada absolute -top-10 right-4 sm:-top-5 z-10 rotate-[4deg] bg-[#FFD23F] px-4 py-2 text-lg font-extrabold uppercase tracking-tight text-[#141414] shadow-[4px_4px_0_#141414] [font-family:var(--font-display)] sm:-right-6"
      >
        En mantenimiento
      </span>
      <div
        aria-hidden
        className="border-2 border-[#141414] bg-white shadow-[12px_12px_0_#D7261E]"
      >
        <div className="flex items-center justify-between gap-4 border-b-2 border-[#141414] px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-[0.18em]">
            Mi lugar en las listas
          </span>
          <span className="h-2 w-24 bg-[#141414]/10" />
        </div>
        <div className="grid min-h-[9.5rem] grid-cols-[1fr_auto] items-end gap-4 px-5 pb-5 pt-6">
          <div className="space-y-3">
            <span className="block h-2.5 w-20 bg-[#D7261E]/25" />
            <span className="block h-4 w-48 max-w-full bg-[#141414]/10" />
            <span className="block h-3 w-32 bg-[#141414]/5" />
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#141414]/50">
              Tu lugar
            </p>
            <p className="text-7xl font-extrabold leading-[0.8] text-[#141414]/20 [font-family:var(--font-display)]">
              —
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 border-t-2 border-[#141414] bg-[repeating-linear-gradient(-45deg,transparent_0_10px,rgb(20_20_20/0.06)_10px_20px)]">
          {["Bolsa", "Escalafón", "Cambios"].map((t) => (
            <span
              key={t}
              className="flex min-h-12 items-center justify-center border-r border-[#141414]/15 text-xs font-bold uppercase tracking-[0.14em] text-[#141414]/40 last:border-r-0"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

/**
 * Pantalla de bloqueo del kill-switch de mantenimiento, con la identidad de la
 * landing. Server component sin dependencias de auth: se renderiza aunque el
 * resto de la plataforma esté cortada. Mensaje deliberadamente NEUTRAL: nunca
 * menciona pagos, motivos internos ni fechas de regreso. Sin enlaces a "/":
 * el gate también cubre la landing.
 */
export function MantenimientoScreen() {
  return (
    <main
      className={`${fuentesGaceta} gaceta-grano relative isolate flex min-h-screen flex-col overflow-x-clip bg-[#F2EEE6] text-[#141414] [font-family:var(--font-texto)] selection:bg-[#D7261E] selection:text-white`}
    >
      <GuiasColumnas />
      <MarcasRegistro />

      <header className="mx-auto w-full max-w-[1320px] px-5 pt-5 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-[#141414] pb-3 text-[12px] font-semibold uppercase tracking-[0.16em]">
          <span className="hidden sm:inline">
            Sindicato Nacional de Trabajadores del Seguro Social
          </span>
          <span className="sm:hidden">SNTSS</span>
          <span className="text-[#141414]/60">Aviso del portal</span>
        </div>
        <div
          style={retraso(0)}
          className="gaceta-entrada mt-6 inline-flex items-end gap-3"
        >
          <Image
            src={logoSNTSS}
            alt=""
            width={56}
            height={56}
            priority
            className="h-12 w-auto sm:h-14"
          />
          <span className="text-4xl font-extrabold uppercase leading-[0.8] tracking-[-0.02em] [font-family:var(--font-display)] sm:text-5xl">
            Sección <span className="text-[#D7261E]">VII</span>
          </span>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1320px] flex-1 items-center gap-16 px-5 py-16 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:py-20">
        <div className="lg:col-span-7">
          <p
            style={retraso(1)}
            className="gaceta-entrada flex items-center gap-3 text-[13px] font-bold uppercase tracking-[0.2em] text-[#141414]/60"
          >
            <span aria-hidden className="h-2.5 w-2.5 bg-[#D7261E]" />
            Portal del trabajador
          </p>
          <h1
            style={retraso(2)}
            className="gaceta-entrada mt-6 max-w-[16ch] text-[clamp(2.5rem,5.6vw,5.25rem)] font-medium leading-[0.98] tracking-[-0.03em] [font-family:var(--font-serif)]"
          >
            El portal está en <em className="text-[#D7261E]">mantenimiento.</em>
          </h1>
          <div
            style={retraso(3)}
            className="gaceta-entrada mt-8 max-w-[46ch] space-y-4 text-xl leading-relaxed text-[#141414]/80 [font-family:var(--font-serif)]"
          >
            <p>
              Por ahora no es posible consultar la información del portal. Tu
              cuenta y tus datos se conservan sin cambios.
            </p>
            <p>Te pedimos volver a intentarlo más tarde.</p>
          </div>
        </div>

        <div style={retraso(3)} className="gaceta-entrada lg:col-span-5">
          <FichaEnPausa />
        </div>
      </section>

      <footer className="mx-auto w-full max-w-[1320px] px-5 pb-8 sm:px-8">
        <div className="flex flex-col justify-between gap-3 border-t border-[#141414] pt-4 text-sm sm:flex-row sm:items-center">
          <p className="font-semibold text-[#141414]/70">
            Dudas sobre tu cuenta:{" "}
            <a
              href="mailto:admin@sntssvii.com"
              className="text-[#141414] underline underline-offset-4 hover:text-[#D7261E]"
            >
              admin@sntssvii.com
            </a>
          </p>
          <AtribucionZentry />
        </div>
      </footer>
    </main>
  );
}
