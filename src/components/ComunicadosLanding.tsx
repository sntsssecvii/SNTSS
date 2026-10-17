import { ArrowUpRight, ChevronDown, Megaphone, Pin } from "lucide-react";
import {
  CATEGORIAS_COMUNICADO,
  formatearFechaComunicado,
} from "@/lib/comunicados";
import type {
  CategoriaComunicado,
  ComunicadoPublico,
} from "@/types/comunicados";

const ESTILO_CATEGORIA: Record<CategoriaComunicado, string> = {
  aviso: "bg-slate-100 text-slate-700",
  negociacion: "bg-red-100 text-red-700",
  convocatoria: "bg-amber-100 text-amber-800",
};

/**
 * Sección pública de comunicados oficiales en la landing.
 * Server component: el cuerpo se renderiza como texto plano (sin HTML) y se
 * expande con <details>, sin JavaScript de cliente.
 */
export function ComunicadosLanding({
  comunicados,
}: {
  comunicados: ComunicadoPublico[];
}) {
  if (comunicados.length === 0) return null;

  return (
    <section
      id="comunicados"
      className="relative z-20 mx-auto w-full max-w-7xl scroll-mt-28 px-5 py-20 sm:px-8 lg:px-10"
    >
      <div className="mb-12 flex flex-col items-center gap-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-red-700">
          <Megaphone className="h-3.5 w-3.5" />
          Comunicados oficiales
        </span>
        <h2 className="max-w-3xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
          Información de primera mano,{" "}
          <span className="text-red-700">sin intermediarios.</span>
        </h2>
        <p className="max-w-2xl text-lg text-slate-500">
          Avisos, avances de negociación y convocatorias publicados directamente
          por la Sección VII.
        </p>
      </div>

      <div className="mx-auto grid max-w-4xl gap-4">
        {comunicados.map((c, i) => (
          <details
            key={c.id}
            open={i === 0}
            className={`group rounded-[1.75rem] border bg-white shadow-sm transition-shadow open:shadow-xl open:shadow-red-900/5 ${
              c.fijado ? "border-red-200" : "border-slate-200/60"
            }`}
          >
            <summary className="flex cursor-pointer list-none items-start gap-4 p-6 sm:p-7 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  {c.fijado && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 uppercase tracking-wider text-white">
                      <Pin className="h-3 w-3" />
                      Importante
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 uppercase tracking-wider ${ESTILO_CATEGORIA[c.categoria]}`}
                  >
                    {CATEGORIAS_COMUNICADO[c.categoria]}
                  </span>
                  <time dateTime={c.fecha} className="text-slate-400">
                    {formatearFechaComunicado(c.fecha)}
                  </time>
                </div>
                <h3 className="text-xl font-black leading-snug tracking-tight text-slate-900 sm:text-2xl">
                  {c.titulo}
                </h3>
              </div>
              <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="space-y-5 px-6 pb-7 sm:px-7">
              <p className="whitespace-pre-line leading-relaxed text-slate-600">
                {c.cuerpo}
              </p>
              {c.enlace && (
                <a
                  href={c.enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-red-700 hover:underline"
                >
                  Ver documento
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
