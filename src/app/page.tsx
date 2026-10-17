import Image from "next/image";
import Link from "next/link";
import { Barlow, Barlow_Condensed, Newsreader } from "next/font/google";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import logoSNTSS from "@/assets/logo-sntss.png";
import seccion7 from "@/assets/seccion7.png";
import { AtribucionZentry } from "@/components/AtribucionZentry";
import { ComunicadosLanding } from "@/components/ComunicadosLanding";
import { MAX_COMUNICADOS_LANDING } from "@/lib/comunicados";
import { getComunicadosPublicos } from "@/lib/firebase/comunicados";
import {
  formatearCorte,
  getCorteVigente,
  type CorteVigente,
} from "@/lib/firebase/corte-vigente";
import type { ComunicadoPublico } from "@/types/comunicados";

// ISR: los endpoints admin de comunicados revalidan "/" al publicar.
export const revalidate = 300;

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

const sans = Barlow({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-texto",
});

/** La landing nunca debe caerse por datos opcionales. */
async function seguro<T>(fn: () => Promise<T>, respaldo: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[landing] dato opcional no disponible:", err);
    return respaldo;
  }
}

const consultas = [
  {
    titulo: "Bolsa de trabajo",
    que: "Las listas que ordenan a quienes esperan ingresar o hacer un movimiento: cambiarse de área, de turno, de residencia o ampliar su jornada.",
    ves: [
      "Tu lugar en cada lista en la que estás inscrito",
      "La categoría y la zona de cada solicitud",
      "Turno y unidad, cuando aplica",
    ],
    cuando: "Se actualiza cada quincena.",
  },
  {
    titulo: "Escalafón",
    que: "El orden para ascender de categoría dentro del Instituto.",
    ves: [
      "Tu lugar en cada categoría y zona en la que participas",
      "La fecha de cierre de cada listado",
    ],
    cuando: "Se actualiza con cada listado que emite la sección.",
  },
  {
    titulo: "Cambios de turno y adscripción",
    que: "El orden de quienes solicitaron cambiarse de turno o de unidad.",
    ves: [
      "Tu lugar dentro de tu grupo, por ejemplo 3 de 18",
      "La unidad y el turno que solicitaste",
      "La fecha de emisión del listado",
    ],
    cuando: "Se actualiza con cada listado que emite la sección.",
  },
];

const pasos = [
  {
    titulo: "Regístrate con tu matrícula",
    texto: "Captura tu nombre, tu matrícula del IMSS y tu correo electrónico.",
  },
  {
    titulo: "Sube tus documentos",
    texto:
      "Tu identificación oficial, tu último talón de pago y tu constancia de afiliación sindical. Puedes tomarles foto con el celular.",
  },
  {
    titulo: "Validación de tu cuenta",
    texto:
      "La sección revisa tu registro en 1 a 2 días hábiles y te avisa por correo cuando tu cuenta esté activa.",
  },
];

const C = {
  tinta: "text-[#141414]",
  rojo: "text-[#D7261E]",
  regla: "border-[#141414]",
};

function Kicker({
  children,
  claro = false,
}: {
  children: React.ReactNode;
  claro?: boolean;
}) {
  return (
    <p
      className={`flex items-center gap-3 text-[13px] font-bold uppercase tracking-[0.2em] [font-family:var(--font-texto)] ${
        claro ? "text-white/70" : "text-[#141414]/60"
      }`}
    >
      <span aria-hidden className="h-2.5 w-2.5 bg-[#D7261E]" />
      {children}
    </p>
  );
}

/** Sello circular de fuente oficial, al estilo de un sello documental. */
function SelloOficial() {
  return (
    <div className="relative mx-auto h-44 w-44 shrink-0 md:h-52 md:w-52">
      <svg
        viewBox="0 0 200 200"
        aria-hidden
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <path
            id="sello-arco"
            d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"
          />
        </defs>
        <circle
          cx="100"
          cy="100"
          r="97"
          fill="none"
          stroke="white"
          strokeWidth="3"
        />
        <circle
          cx="100"
          cy="100"
          r="62"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
        />
        <text
          fill="white"
          className="text-[14px] font-bold uppercase [font-family:var(--font-texto)]"
        >
          <textPath href="#sello-arco" textLength="486" lengthAdjust="spacing">
            Fuente oficial · Sección VII · Fuente oficial · Sección VII ·
          </textPath>
        </text>
      </svg>
      <div className="absolute inset-[23%] flex items-center justify-center rounded-full bg-white">
        <Image
          src={logoSNTSS}
          alt="Escudo del SNTSS"
          className="h-[78%] w-auto"
        />
      </div>
    </div>
  );
}

/** Ficha ilustrativa de lo que el trabajador ve en su portal. */
function FichaEjemplo({ corte }: { corte: CorteVigente | null }) {
  return (
    <figure className="relative mt-8 lg:mt-0">
      <span
        aria-hidden
        className="absolute -top-11 right-4 z-10 rotate-[4deg] bg-[#FFD23F] px-4 py-2 text-xl font-extrabold uppercase tracking-tight text-[#141414] shadow-[4px_4px_0_#141414] [font-family:var(--font-display)] sm:-right-6"
      >
        ¡Ya casi!
      </span>
      <div className="border-2 border-[#141414] bg-white text-[#141414] shadow-[12px_12px_0_#D7261E]">
        <div className="flex items-center justify-between border-b-2 border-[#141414] px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-[0.18em]">
            Mi lugar en las listas
          </span>
          <span className="text-xs font-semibold text-[#141414]/60">
            {corte ? formatearCorte(corte) : "Cada quincena"}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-4 px-5 pb-5 pt-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D7261E]">
              Nuevo Ingreso
            </p>
            <p className="mt-2 text-xl font-semibold leading-tight [font-family:var(--font-serif)]">
              Auxiliar Universal de Oficinas
            </p>
            <p className="mt-1 text-sm text-[#141414]/60">Zona Mexicali</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#141414]/50">
              Tu lugar
            </p>
            <p className="text-7xl font-extrabold leading-[0.8] tracking-tight [font-family:var(--font-display)]">
              3
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-[#141414]/15 text-sm">
          <div className="border-r border-[#141414]/15 px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#141414]/50">
              Para ascender
            </p>
            <p className="mt-1 font-semibold">Lugar 5</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#141414]/50">
              Cambio de turno
            </p>
            <p className="mt-1 font-semibold">Lugar 3 de 18</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-5 text-sm italic opacity-60 [font-family:var(--font-serif)]">
        Así se ve tu información en el portal. Ejemplo con datos ficticios.
      </figcaption>
    </figure>
  );
}

export default async function PublicHomePage() {
  const [comunicados, corte] = await Promise.all([
    seguro<ComunicadoPublico[]>(
      () => getComunicadosPublicos(MAX_COMUNICADOS_LANDING),
      [],
    ),
    seguro<CorteVigente | null>(getCorteVigente, null),
  ]);

  const cinta = [
    "Sitio oficial · SNTSS Sección VII",
    corte
      ? `Información actualizada a la ${formatearCorte(corte)}`
      : "Información actualizada cada quincena",
    "Baja California y San Luis Río Colorado",
  ];

  return (
    <main
      className={`${display.variable} ${serif.variable} ${sans.variable} min-h-screen overflow-x-clip bg-[#F2EEE6] ${C.tinta} [font-family:var(--font-texto)] selection:bg-[#D7261E] selection:text-white`}
    >
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:font-semibold"
      >
        Saltar al contenido
      </a>

      {/* ───────── Cabecera de la gaceta ───────── */}
      <header className="mx-auto max-w-[1320px] px-5 pt-5 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-[#141414] pb-3 text-[12px] font-semibold uppercase tracking-[0.16em]">
          <span className="hidden sm:inline">
            Sindicato Nacional de Trabajadores del Seguro Social
          </span>
          <span className="sm:hidden">SNTSS</span>
          <span className="text-[#141414]/60">
            Baja California y San Luis R.C., Son.
          </span>
        </div>

        <div className="grid items-end gap-6 py-6 md:grid-cols-[1fr_auto] md:py-8">
          <Link href="/" aria-label="Sección VII — inicio" className="block">
            <span className="flex items-end gap-4 sm:gap-6">
              <Image
                src={logoSNTSS}
                alt=""
                width={96}
                height={96}
                priority
                className="h-[clamp(3.5rem,9vw,7.5rem)] w-auto"
              />
              <span className="flex h-[clamp(3.5rem,11vw,9.5rem)] items-end gap-[0.18em] text-[clamp(3.5rem,11vw,9.5rem)] font-extrabold uppercase leading-[0.78] tracking-[-0.02em] [font-family:var(--font-display)]">
                Sección <span className="text-[#D7261E]">VII</span>
              </span>
            </span>
          </Link>

          <nav
            aria-label="Secciones"
            className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px] font-semibold"
          >
            {comunicados.length > 0 && (
              <a
                href="#avisos"
                className="hidden underline-offset-4 hover:underline md:inline"
              >
                Avisos oficiales
              </a>
            )}
            <a
              href="#portal"
              className="hidden underline-offset-4 hover:underline md:inline"
            >
              Portal del trabajador
            </a>
            <a
              href="#acceso"
              className="hidden underline-offset-4 hover:underline md:inline"
            >
              Obtener cuenta
            </a>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center gap-2 bg-[#141414] px-5 font-bold text-white transition-colors hover:bg-[#D7261E] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#D7261E]"
            >
              Entrar al portal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Cinta del corte */}
      <div className="border-y-2 border-[#141414] bg-[#D7261E] py-2.5 text-white">
        <div className="gaceta-cinta flex w-max">
          {[0, 1].map((copia) => (
            <ul
              key={copia}
              aria-hidden={copia === 1}
              className="flex shrink-0 items-center text-[15px] font-bold uppercase tracking-[0.14em]"
            >
              {[...cinta, ...cinta].map((t, i) => (
                <li key={i} className="flex items-center">
                  <span className="px-6">{t}</span>
                  <span aria-hidden className="h-1.5 w-1.5 bg-white" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      <div id="contenido">
        {/* ───────── Portada ───────── */}
        <section className="relative mx-auto max-w-[1320px] px-5 py-16 sm:px-8 md:py-24">
          <Kicker>Bienvenida</Kicker>
          <h1 className="mt-6 max-w-[20ch] text-[clamp(2.75rem,6.2vw,6rem)] font-medium leading-[0.98] tracking-[-0.03em] [font-family:var(--font-serif)]">
            Te damos la bienvenida al{" "}
            <em className="text-[#D7261E]">
              portal oficial de la Sección VII.
            </em>
          </h1>

          <div className="mt-14 grid gap-10 border-t-2 border-[#141414] pt-10 lg:grid-cols-12">
            <p className="text-xl leading-relaxed text-[#141414]/80 [font-family:var(--font-serif)] lg:col-span-6">
              Aquí puedes consultar tu información de bolsa de trabajo y
              escalafón, y los avisos que publica la sección. Desde tu celular o
              computadora, cuando lo necesites.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row lg:col-span-6 lg:justify-end lg:self-end">
              <Link
                href="/login"
                className="inline-flex min-h-14 items-center justify-center gap-2 bg-[#D7261E] px-8 text-lg font-bold text-white transition-colors hover:bg-[#B51E17] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#141414]"
              >
                Entrar a mi portal
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/registro"
                className="inline-flex min-h-14 items-center justify-center border-2 border-[#141414] px-8 text-lg font-bold transition-colors hover:bg-[#141414] hover:text-white"
              >
                Abrir mi cuenta
              </Link>
            </div>
          </div>
        </section>

        {/* ───────── Sello de fuente oficial ───────── */}
        <section className="border-y-2 border-[#141414] bg-[#D7261E] text-white">
          <div className="gaceta-aparece mx-auto grid max-w-[1320px] items-center gap-10 px-5 py-14 sm:px-8 md:grid-cols-[auto_1fr] md:gap-14 md:py-16">
            <SelloOficial />
            <div>
              <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-white/80">
                Fuente oficial · Sección VII
              </p>
              <p className="mt-4 text-[clamp(2rem,4.4vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.02em] [font-family:var(--font-serif)]">
                {corte ? (
                  <>
                    Información actualizada a la{" "}
                    <span className="underline decoration-2 underline-offset-[0.18em]">
                      {formatearCorte(corte)}
                    </span>
                    .
                  </>
                ) : (
                  "Información actualizada cada quincena."
                )}
              </p>
              <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-white/85">
                Los datos del portal provienen de las listas oficiales que
                publica la sección.
              </p>
            </div>
          </div>
        </section>

        {/* ───────── Avisos ───────── */}
        <div className="pt-20">
          <ComunicadosLanding comunicados={comunicados} />
        </div>

        {/* ───────── Portal del trabajador ───────── */}
        <section
          id="portal"
          className="scroll-mt-6 bg-[#141414] text-[#F2EEE6]"
        >
          <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 md:py-28">
            <div className="gaceta-aparece grid gap-14 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-6">
                <Kicker claro>Portal del trabajador</Kicker>
                <h2 className="mt-6 text-[clamp(3rem,6vw,5.5rem)] font-extrabold uppercase leading-[0.88] tracking-tight [font-family:var(--font-display)]">
                  Tu información,
                  <br />
                  <span className="text-[#D7261E]">en tu celular.</span>
                </h2>
                <p className="mt-8 max-w-[46ch] text-lg leading-relaxed text-[#F2EEE6]/75 [font-family:var(--font-serif)]">
                  Con tu cuenta consultas tu lugar en la bolsa de trabajo, en
                  escalafón y en los cambios de turno y adscripción.
                </p>
              </div>
              <div className="lg:col-span-6 lg:pl-6">
                <FichaEjemplo corte={corte} />
              </div>
            </div>

            <div className="mt-20 grid gap-px bg-[#F2EEE6]/20 lg:grid-cols-3">
              {consultas.map((c) => (
                <article
                  key={c.titulo}
                  className="gaceta-aparece flex flex-col bg-[#141414] py-8 lg:px-8 lg:first:pl-0 lg:last:pr-0"
                >
                  <h3 className="text-3xl font-extrabold uppercase leading-none tracking-tight [font-family:var(--font-display)] sm:text-4xl">
                    {c.titulo}
                  </h3>
                  <p className="mt-4 text-lg leading-relaxed text-[#F2EEE6]/85 [font-family:var(--font-serif)]">
                    {c.que}
                  </p>
                  <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.2em] text-[#D7261E]">
                    En tu portal ves
                  </p>
                  <ul className="mt-3 space-y-2">
                    {c.ves.map((v) => (
                      <li
                        key={v}
                        className="flex gap-3 leading-relaxed text-[#F2EEE6]/75"
                      >
                        <span
                          aria-hidden
                          className="mt-[0.6em] h-1.5 w-1.5 shrink-0 bg-[#D7261E]"
                        />
                        {v}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-auto border-t border-[#F2EEE6]/15 pt-4 text-sm font-semibold text-[#F2EEE6]/60 [&:not(:first-child)]:mt-8">
                    {c.cuando}
                  </p>
                </article>
              ))}
            </div>

            <p className="gaceta-aparece mt-14 border-t border-[#F2EEE6]/20 pt-8 text-lg leading-relaxed text-[#F2EEE6]/75 [font-family:var(--font-serif)]">
              <span className="font-semibold text-[#F2EEE6]">
                Tu información es personal.
              </span>{" "}
              Solo tú la consultas, con tu propia cuenta.
            </p>
          </div>
        </section>

        {/* ───────── Acceso ───────── */}
        <section
          id="acceso"
          className="mx-auto max-w-[1320px] scroll-mt-6 px-5 py-20 sm:px-8 md:py-28"
        >
          <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
            <div className="gaceta-aparece lg:col-span-5">
              <Kicker>Cómo obtener tu cuenta</Kicker>
              <h2 className="mt-6 text-[clamp(3rem,6vw,5.5rem)] font-extrabold uppercase leading-[0.88] tracking-tight [font-family:var(--font-display)]">
                Tu cuenta,
                <br />
                <span className="text-[#D7261E]">en tres pasos.</span>
              </h2>
              <p className="mt-8 max-w-[44ch] text-lg leading-relaxed text-[#141414]/75 [font-family:var(--font-serif)]">
                Para trabajadoras y trabajadores sindicalizados de la Sección
                VII.
              </p>
              <Link
                href="/registro"
                className="mt-10 inline-flex min-h-14 items-center gap-2 bg-[#141414] px-8 text-lg font-bold text-white transition-colors hover:bg-[#D7261E] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#D7261E]"
              >
                Abrir mi cuenta
                <ArrowUpRight className="h-5 w-5" />
              </Link>
            </div>

            <ol className="lg:col-span-7">
              {pasos.map((p, i) => (
                <li
                  key={p.titulo}
                  className={`gaceta-aparece grid grid-cols-[4.5rem_1fr] gap-4 border-t-2 border-[#141414] py-8 sm:grid-cols-[6rem_1fr] ${
                    i === pasos.length - 1 ? "border-b-2" : ""
                  }`}
                >
                  <span className="text-7xl font-extrabold leading-[0.8] text-[#D7261E] [font-family:var(--font-display)] sm:text-8xl">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-2xl font-semibold [font-family:var(--font-serif)]">
                      {p.titulo}
                    </h3>
                    <p className="mt-2 leading-relaxed text-[#141414]/75">
                      {p.texto}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      {/* ───────── Colofón ───────── */}
      <footer className="bg-[#141414] text-[#F2EEE6]">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-12">
          <div className="flex items-center gap-5 md:col-span-6">
            <Image
              src={seccion7}
              alt="Sección VII Baja California y San Luis R.C., Son."
              width={96}
              height={86}
              className="h-20 w-auto"
            />
            <div className="leading-snug">
              <p className="text-2xl font-extrabold uppercase [font-family:var(--font-display)]">
                SNTSS · Sección VII
              </p>
              <p className="text-[#F2EEE6]/65">
                Baja California y San Luis R.C., Son.
              </p>
            </div>
          </div>
          <nav
            aria-label="Pie de página"
            className="flex flex-col gap-2 text-[15px] font-semibold md:col-span-3"
          >
            <Link href="/login" className="hover:text-[#D7261E]">
              Entrar al portal
            </Link>
            <Link href="/registro" className="hover:text-[#D7261E]">
              Solicitar cuenta
            </Link>
          </nav>
          <div className="text-[15px] md:col-span-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#F2EEE6]/50">
              Contacto
            </p>
            <a
              href="mailto:admin@sntssvii.com"
              className="mt-2 inline-block font-semibold hover:text-[#D7261E]"
            >
              admin@sntssvii.com
            </a>
          </div>
        </div>
        <div className="border-t border-[#F2EEE6]/15 py-5 text-center">
          <AtribucionZentry className="text-[#F2EEE6]/50 [&_span]:text-[#F2EEE6]/70" />
        </div>
      </footer>
    </main>
  );
}
