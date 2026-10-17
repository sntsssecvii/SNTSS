import { ArrowUpRight, Plus } from "lucide-react";
import { CATEGORIAS_COMUNICADO } from "@/lib/comunicados";
import type { ComunicadoPublico } from "@/types/comunicados";

const fechaCorta = (iso: string) => {
  const d = new Date(iso);
  const opts = { timeZone: "America/Tijuana" } as const;
  return {
    dia: d.toLocaleDateString("es-MX", { ...opts, day: "2-digit" }),
    mes: d
      .toLocaleDateString("es-MX", { ...opts, month: "short" })
      .replace(".", ""),
    anio: d.toLocaleDateString("es-MX", { ...opts, year: "numeric" }),
  };
};

/**
 * Sección pública de comunicados oficiales en la landing, en formato de
 * boletín. Server component: el cuerpo se renderiza como texto plano (sin
 * HTML) y se expande con <details>, sin JavaScript de cliente.
 * Usa las variables de fuente que define la landing (--font-display).
 */
export function ComunicadosLanding({
  comunicados,
}: {
  comunicados: ComunicadoPublico[];
}) {
  if (comunicados.length === 0) return null;

  return (
    <section
      id="avisos"
      className="mx-auto max-w-[1320px] scroll-mt-6 px-5 pb-24 sm:px-8"
    >
      <div className="flex flex-col justify-between gap-4 border-b-4 border-[#141414] pb-5 md:flex-row md:items-end">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#D7261E]">
            Avisos oficiales
          </p>
          <h2 className="mt-3 text-5xl font-extrabold uppercase leading-none tracking-tight [font-family:var(--font-display)] md:text-6xl">
            Lo último de la sección
          </h2>
        </div>
        <p className="max-w-sm text-[#141414]/70">
          Avisos, avances de negociación y convocatorias, publicados
          directamente por la Sección VII.
        </p>
      </div>

      <ul className="divide-y divide-[#141414]/15">
        {comunicados.map((c, i) => {
          const f = fechaCorta(c.fecha);
          return (
            <li key={c.id}>
              <details open={i === 0} className="group">
                <summary className="grid cursor-pointer list-none grid-cols-[64px_1fr_auto] items-start gap-4 py-6 sm:grid-cols-[88px_1fr_auto] sm:gap-8 [&::-webkit-details-marker]:hidden">
                  <time
                    dateTime={c.fecha}
                    className="leading-none [font-family:var(--font-display)]"
                  >
                    <span className="block text-4xl font-extrabold sm:text-5xl">
                      {f.dia}
                    </span>
                    <span className="mt-1 block text-sm font-bold uppercase tracking-wider text-[#141414]/60">
                      {f.mes} {f.anio}
                    </span>
                  </time>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]">
                      {c.fijado && (
                        <span className="bg-[#D7261E] px-2 py-1 text-white">
                          Importante
                        </span>
                      )}
                      <span className="border border-[#141414]/30 px-2 py-[3px] text-[#141414]/75">
                        {CATEGORIAS_COMUNICADO[c.categoria]}
                      </span>
                    </div>
                    <h3 className="mt-3 text-2xl font-medium leading-tight tracking-[-0.01em] transition-colors [font-family:var(--font-serif)] group-hover:text-[#D7261E] sm:text-[2rem]">
                      {c.titulo}
                    </h3>
                  </div>

                  <Plus
                    aria-hidden
                    className="mt-1 h-6 w-6 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                  />
                </summary>

                <div className="pb-8 pl-[80px] sm:pl-[120px]">
                  <p className="max-w-[68ch] whitespace-pre-line text-[17px] leading-relaxed text-[#141414]/85">
                    {c.cuerpo}
                  </p>
                  {c.enlace && (
                    <a
                      href={c.enlace}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-1.5 font-bold text-[#D7261E] underline underline-offset-4"
                    >
                      Ver documento
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
