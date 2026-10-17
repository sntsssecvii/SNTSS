import Image from "next/image";
import Link from "next/link";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import logoSNTSS from "@/assets/logo-sntss.png";
import seccion7 from "@/assets/seccion7.png";
import { AtribucionZentry } from "@/components/AtribucionZentry";
import { ComunicadosLanding } from "@/components/ComunicadosLanding";
import { MAX_COMUNICADOS_LANDING } from "@/lib/comunicados";
import { getComunicadosPublicos } from "@/lib/firebase/comunicados";
import type { ComunicadoPublico } from "@/types/comunicados";

// ISR: los endpoints admin de comunicados revalidan "/" al publicar.
export const revalidate = 300;

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const texto = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-texto",
});

async function cargarComunicados(): Promise<ComunicadoPublico[]> {
  try {
    return await getComunicadosPublicos(MAX_COMUNICADOS_LANDING);
  } catch (err) {
    // La landing nunca debe caerse por los comunicados.
    console.error("[landing] no se pudieron cargar comunicados:", err);
    return [];
  }
}

const accesosRapidos = [
  { label: "Consultar mi posición en bolsa", href: "/login" },
  { label: "Ver mis trámites y movimientos", href: "/login" },
  { label: "Solicitar mi cuenta", href: "/registro" },
];

const servicios = [
  {
    titulo: "Bolsa de trabajo",
    texto:
      "Tu posición en la bolsa y en escalafón, con las listas que publica la sección en cada corte.",
  },
  {
    titulo: "Trámites y movimientos",
    texto:
      "El estado de tus solicitudes y los cambios registrados a tu nombre, en un solo lugar.",
  },
  {
    titulo: "Avisos y convocatorias",
    texto:
      "Comunicados oficiales de la Sección VII, publicados directamente por el comité.",
  },
];

const pasos = [
  {
    titulo: "Solicita tu cuenta",
    texto: "Con tu matrícula IMSS y una identificación oficial.",
  },
  {
    titulo: "La sección valida tu registro",
    texto: "Revisamos tus datos en 1 a 2 días hábiles.",
  },
  {
    titulo: "Entra con tu correo",
    texto: "Desde el celular o la computadora, cuando lo necesites.",
  },
];

/** Barras inclinadas de la "VII" de la sección, como motivo gráfico. */
function BarrasVII({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className}>
      <div className="flex h-full gap-[6%]">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-full w-[38%] bg-current"
            style={{ clipPath: "polygon(55% 0, 100% 0, 45% 100%, 0 100%)" }}
          />
        ))}
      </div>
    </div>
  );
}

export default async function PublicHomePage() {
  const comunicados = await cargarComunicados();

  return (
    <main
      className={`${display.variable} ${texto.variable} min-h-screen bg-[#F4F1EC] text-[#141414] [font-family:var(--font-texto)] selection:bg-[#D7261E] selection:text-white`}
    >
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:font-semibold"
      >
        Saltar al contenido
      </a>

      {/* Franja institucional */}
      <div className="bg-[#141414] text-[13px] text-white/75">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2 sm:px-8">
          <span className="truncate">
            Sindicato Nacional de Trabajadores del Seguro Social
          </span>
          <span className="hidden shrink-0 sm:inline">
            Baja California y San Luis R.C., Son.
          </span>
        </div>
      </div>

      {/* Encabezado */}
      <header className="border-b border-[#141414]/10 bg-[#F4F1EC]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={logoSNTSS}
              alt="SNTSS"
              width={48}
              height={48}
              className="h-11 w-auto"
              priority
            />
            <span className="leading-none">
              <span className="block text-[26px] font-extrabold uppercase tracking-tight [font-family:var(--font-display)]">
                Sección VII
              </span>
              <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#141414]/60">
                Portal de sindicalizados
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-6 text-[15px] font-semibold">
            {comunicados.length > 0 && (
              <a
                href="#comunicados"
                className="hidden underline-offset-4 hover:underline md:inline"
              >
                Comunicados
              </a>
            )}
            <a
              href="#servicios"
              className="hidden underline-offset-4 hover:underline md:inline"
            >
              Servicios
            </a>
            <a
              href="#acceso"
              className="hidden underline-offset-4 hover:underline md:inline"
            >
              Cómo obtener acceso
            </a>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center bg-[#D7261E] px-5 font-bold text-white transition-colors hover:bg-[#B51E17] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#141414]"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <div id="contenido">
        {/* Portada */}
        <section className="relative overflow-hidden bg-[#D7261E] text-white">
          <BarrasVII className="pointer-events-none absolute -right-24 top-0 hidden h-full w-[520px] text-[#B51E17] lg:block" />

          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[1.25fr_1fr] lg:items-end">
            <div>
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-white/80">
                16,000 trabajadoras y trabajadores del IMSS
              </p>
              <h1 className="text-[clamp(3rem,8vw,6.25rem)] font-extrabold uppercase leading-[0.9] tracking-tight [font-family:var(--font-display)]">
                Tu información sindical, clara y a la mano.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/90">
                Consulta tu posición en la bolsa de trabajo, el avance de tus
                trámites y los avisos oficiales de la sección, sin filas ni
                intermediarios.
              </p>
            </div>

            <div className="bg-[#F4F1EC] p-6 text-[#141414] shadow-[10px_10px_0_#141414] sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#141414]/60">
                Accesos rápidos
              </p>
              <ul className="mt-4 divide-y divide-[#141414]/15 border-y border-[#141414]/15">
                {accesosRapidos.map((a) => (
                  <li key={a.label}>
                    <Link
                      href={a.href}
                      className="group flex min-h-14 items-center justify-between gap-4 py-3 text-lg font-semibold transition-colors hover:text-[#D7261E]"
                    >
                      {a.label}
                      <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-[#141414]/70">
                ¿Ya tienes cuenta?{" "}
                <Link
                  href="/login"
                  className="font-bold text-[#D7261E] underline underline-offset-4"
                >
                  Inicia sesión
                </Link>
              </p>
            </div>
          </div>
        </section>

        <ComunicadosLanding comunicados={comunicados} />

        {/* Servicios */}
        <section
          id="servicios"
          className="mx-auto max-w-6xl scroll-mt-6 px-5 py-20 sm:px-8"
        >
          <div className="flex flex-col justify-between gap-4 border-b-4 border-[#141414] pb-5 md:flex-row md:items-end">
            <h2 className="text-5xl font-extrabold uppercase leading-none tracking-tight [font-family:var(--font-display)] md:text-6xl">
              Qué puedes consultar
            </h2>
            <p className="max-w-sm text-[#141414]/70">
              Todo con tu cuenta del portal. La información es personal y solo
              la ves tú.
            </p>
          </div>

          <div className="grid md:grid-cols-3">
            {servicios.map((s, i) => (
              <article
                key={s.titulo}
                className="border-b border-[#141414]/15 py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
              >
                <span className="text-5xl font-extrabold text-[#D7261E] [font-family:var(--font-display)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-2xl font-bold uppercase tracking-tight [font-family:var(--font-display)]">
                  {s.titulo}
                </h3>
                <p className="mt-2 leading-relaxed text-[#141414]/75">
                  {s.texto}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Acceso */}
        <section
          id="acceso"
          className="scroll-mt-6 bg-[#141414] text-[#F4F1EC]"
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-5xl font-extrabold uppercase leading-none tracking-tight [font-family:var(--font-display)] md:text-6xl">
                ¿Aún no tienes cuenta?
              </h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-[#F4F1EC]/75">
                El acceso es gratuito para todas y todos los trabajadores
                sindicalizados de la sección.
              </p>
              <Link
                href="/registro"
                className="mt-8 inline-flex min-h-12 items-center gap-2 bg-[#D7261E] px-6 text-lg font-bold text-white transition-colors hover:bg-[#B51E17] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Solicitar mi cuenta
                <ArrowUpRight className="h-5 w-5" />
              </Link>
            </div>

            <ol className="grid gap-px bg-[#F4F1EC]/15 sm:grid-cols-3">
              {pasos.map((p, i) => (
                <li key={p.titulo} className="bg-[#141414] p-6">
                  <span className="block text-6xl font-extrabold leading-none text-[#D7261E] [font-family:var(--font-display)]">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-bold uppercase tracking-tight [font-family:var(--font-display)]">
                    {p.titulo}
                  </h3>
                  <p className="mt-2 text-[#F4F1EC]/70">{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      {/* Pie */}
      <footer className="border-t-[6px] border-[#D7261E] bg-[#F4F1EC]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src={seccion7}
              alt="Sección VII Baja California y San Luis R.C., Son."
              width={72}
              height={64}
              className="h-14 w-auto"
            />
            <div className="text-sm leading-snug text-[#141414]/70">
              <p className="font-bold text-[#141414]">SNTSS · Sección VII</p>
              <p>Baja California y San Luis R.C., Son.</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <Link href="/login" className="hover:text-[#D7261E]">
              Entrar al portal
            </Link>
            <Link href="/registro" className="hover:text-[#D7261E]">
              Solicitar cuenta
            </Link>
            <a
              href="mailto:admin@sntssvii.com"
              className="hover:text-[#D7261E]"
            >
              admin@sntssvii.com
            </a>
          </nav>
        </div>
        <div className="border-t border-[#141414]/10 py-5 text-center">
          <AtribucionZentry />
        </div>
      </footer>
    </main>
  );
}
