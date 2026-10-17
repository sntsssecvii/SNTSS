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

// Nombres oficiales de las listas de bolsa (src/types/bolsa-de-trabajo.ts).
const listasBolsa = [
  "Nuevo Ingreso",
  "Cambios de Área",
  "Cambios de Rama",
  "Cambios de Residencia Origen",
  "Cambios de Residencia Destino",
  "Cambios de Tipo de Plaza",
  "Cambios de Turno y/o Adscripción",
  "Ampliaciones de Jornada",
];

const documentos = [
  "Identificación oficial (INE/IFE)",
  "Tarjetón de pago reciente",
  "Constancia de afiliación sindical",
];

const C = {
  tinta: "text-[#141414]",
  rojo: "text-[#D7261E]",
  regla: "border-[#141414]",
};

function Kicker({
  numero,
  children,
  claro = false,
}: {
  numero: string;
  children: React.ReactNode;
  claro?: boolean;
}) {
  return (
    <p
      className={`flex items-center gap-3 text-[13px] font-bold uppercase tracking-[0.2em] [font-family:var(--font-texto)] ${
        claro ? "text-white/70" : "text-[#141414]/60"
      }`}
    >
      <span className={claro ? "text-white" : C.rojo}>§ {numero}</span>
      <span aria-hidden className="h-px w-8 bg-current" />
      {children}
    </p>
  );
}

/** Ficha ilustrativa de lo que el trabajador ve en su portal. */
function FichaEjemplo({ corte }: { corte: CorteVigente | null }) {
  return (
    <figure className="relative">
      <div className="border-2 border-[#141414] bg-white shadow-[12px_12px_0_#D7261E]">
        <div className="flex items-center justify-between border-b-2 border-[#141414] px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-[0.18em]">
            Mis posiciones actuales
          </span>
          <span className="text-xs font-semibold text-[#141414]/60">
            {corte
              ? `Corte ${corte.quincena}ª Q ${corte.mes}/${corte.anio}`
              : "Corte quincenal"}
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
              Base
            </p>
            <p className="text-7xl font-extrabold leading-[0.8] tracking-tight [font-family:var(--font-display)]">
              47
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-[#141414]/15 text-sm">
          <div className="border-r border-[#141414]/15 px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#141414]/50">
              Promoción
            </p>
            <p className="mt-1 font-semibold">Pos. 12 · Mexicali</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#141414]/50">
              Cambio de escalafón
            </p>
            <p className="mt-1 font-semibold">Lugar 3 de 18</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-5 text-sm italic text-[#141414]/60 [font-family:var(--font-serif)]">
        Ejemplo ilustrativo de la ficha que ves en tu portal. Los datos son
        ficticios.
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

  const textoCorte = corte
    ? `Corte vigente: ${formatearCorte(corte)}`
    : "Listas actualizadas cada quincena";
  const cinta = [
    textoCorte,
    "Bolsa de trabajo",
    "Promoción de escalafón",
    "Cambios de escalafón",
    "Consulta con tu matrícula",
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
              <a href="#avisos" className="hidden underline-offset-4 hover:underline md:inline">
                Avisos
              </a>
            )}
            <a href="#bolsa" className="hidden underline-offset-4 hover:underline md:inline">
              Bolsa
            </a>
            <a href="#escalafon" className="hidden underline-offset-4 hover:underline md:inline">
              Escalafón
            </a>
            <a href="#acceso" className="hidden underline-offset-4 hover:underline md:inline">
              Acceso
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
        <section className="mx-auto grid max-w-[1320px] gap-14 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <Kicker numero="01">Portal del trabajador</Kicker>
            <h1 className="mt-6 text-[clamp(2.75rem,6.4vw,5.75rem)] font-medium leading-[0.98] tracking-[-0.025em] [font-family:var(--font-serif)]">
              Tu lugar en la lista,{" "}
              <em className="text-[#D7261E]">a la vista.</em>
            </h1>
            <p className="mt-8 max-w-[56ch] text-xl leading-relaxed text-[#141414]/80 [font-family:var(--font-serif)]">
              Consulta tu posición en la bolsa de trabajo y en escalafón con los
              cortes oficiales de la Sección VII. Solo tus datos, vinculados a
              tu matrícula, desde el celular o la computadora.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex min-h-14 items-center justify-center gap-2 bg-[#D7261E] px-8 text-lg font-bold text-white transition-colors hover:bg-[#B51E17] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#141414]"
              >
                Consultar mi posición
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/registro"
                className="inline-flex min-h-14 items-center justify-center border-2 border-[#141414] px-8 text-lg font-bold transition-colors hover:bg-[#141414] hover:text-white"
              >
                Solicitar mi cuenta
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 lg:pl-6">
            <FichaEjemplo corte={corte} />
          </div>
        </section>

        {/* ───────── Avisos ───────── */}
        <ComunicadosLanding comunicados={comunicados} />

        {/* ───────── Bolsa de trabajo ───────── */}
        <section
          id="bolsa"
          className="scroll-mt-6 border-t-2 border-[#141414] bg-[#141414] text-[#F2EEE6]"
        >
          <div className="mx-auto grid max-w-[1320px] gap-14 px-5 py-20 sm:px-8 md:py-28 lg:grid-cols-12 lg:gap-10">
            <div className="gaceta-aparece lg:col-span-5">
              <Kicker numero="02" claro>
                Bolsa de trabajo
              </Kicker>
              <h2 className="mt-6 text-[clamp(3rem,6vw,5.5rem)] font-extrabold uppercase leading-[0.88] tracking-tight [font-family:var(--font-display)]">
                Ocho listas.
                <br />
                <span className="text-[#D7261E]">Un corte</span> cada quincena.
              </h2>
              <p className="mt-8 max-w-[46ch] text-lg leading-relaxed text-[#F2EEE6]/75 [font-family:var(--font-serif)]">
                La bolsa de trabajo son las listas de prelación que publica la
                sección. En tu portal ves en cuáles apareces, con tu posición,
                categoría, zona y, cuando aplica, turno y adscripción.
              </p>
            </div>

            <ol className="gaceta-aparece border-t border-[#F2EEE6]/25 lg:col-span-7">
              {listasBolsa.map((nombre, i) => (
                <li
                  key={nombre}
                  className="group grid grid-cols-[3.5rem_1fr] items-baseline border-b border-[#F2EEE6]/25 py-4 sm:grid-cols-[5rem_1fr]"
                >
                  <span className="text-2xl font-bold text-[#D7261E] [font-family:var(--font-display)] sm:text-3xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-2xl leading-tight transition-colors [font-family:var(--font-serif)] group-hover:text-white sm:text-3xl">
                    {nombre}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ───────── Escalafón ───────── */}
        <section
          id="escalafon"
          className="mx-auto max-w-[1320px] scroll-mt-6 px-5 py-20 sm:px-8 md:py-28"
        >
          <div className="gaceta-aparece grid gap-6 border-b-2 border-[#141414] pb-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <Kicker numero="03">Escalafón</Kicker>
              <h2 className="mt-6 text-[clamp(3rem,6vw,5.5rem)] font-extrabold uppercase leading-[0.88] tracking-tight [font-family:var(--font-display)]">
                Promoción y cambios,
                <br />
                <span className="text-[#D7261E]">en claro.</span>
              </h2>
            </div>
            <p className="max-w-[44ch] text-lg leading-relaxed text-[#141414]/75 [font-family:var(--font-serif)] lg:col-span-5">
              Además de la bolsa, el portal te muestra dónde estás en los
              listados de escalafón que emite la sección.
            </p>
          </div>

          <div className="grid md:grid-cols-2">
            <article className="gaceta-aparece border-b border-[#141414]/20 py-10 md:border-b-0 md:border-r md:pr-10">
              <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#D7261E]">
                Promoción
              </p>
              <h3 className="mt-3 text-3xl font-medium leading-tight [font-family:var(--font-serif)] sm:text-4xl">
                Tu posición por categoría, área y zona.
              </h3>
              <p className="mt-4 max-w-[48ch] leading-relaxed text-[#141414]/75">
                Ves tu lugar en cada zona donde participas, comparado entre
                trabajadores activos o PEI según tu estatus, y el periodo de
                cierre del listado.
              </p>
            </article>
            <article className="gaceta-aparece py-10 md:pl-10">
              <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#D7261E]">
                Cambios de escalafón
              </p>
              <h3 className="mt-3 text-3xl font-medium leading-tight [font-family:var(--font-serif)] sm:text-4xl">
                Tu lugar dentro de tu grupo.
              </h3>
              <p className="mt-4 max-w-[48ch] leading-relaxed text-[#141414]/75">
                Para cambios de turno o de adscripción: en qué lugar estás de
                cuántos, por unidad y turno, con la fecha de emisión del
                listado.
              </p>
            </article>
          </div>
        </section>

        {/* ───────── Privacidad ───────── */}
        <section className="border-y-2 border-[#141414] bg-[#D7261E] text-white">
          <div className="gaceta-aparece mx-auto grid max-w-[1320px] gap-8 px-5 py-16 sm:px-8 md:py-20 lg:grid-cols-12 lg:items-center">
            <p className="text-[clamp(2.25rem,4.6vw,4rem)] font-medium leading-[1.05] tracking-[-0.02em] [font-family:var(--font-serif)] lg:col-span-8">
              “Solo ves tu información. Nadie más ve la tuya.”
            </p>
            <p className="max-w-[44ch] text-lg leading-relaxed text-white/85 lg:col-span-4">
              Tu cuenta se vincula a tu matrícula y la valida la sección. El
              portal no publica listas completas ni datos de otros compañeros.
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
              <Kicker numero="04">Acceso</Kicker>
              <h2 className="mt-6 text-[clamp(3rem,6vw,5.5rem)] font-extrabold uppercase leading-[0.88] tracking-tight [font-family:var(--font-display)]">
                Tu cuenta en
                <br />
                <span className="text-[#D7261E]">tres pasos.</span>
              </h2>
              <p className="mt-8 max-w-[44ch] text-lg leading-relaxed text-[#141414]/75 [font-family:var(--font-serif)]">
                Sin costo para las y los trabajadores sindicalizados de la
                Sección VII.
              </p>
              <Link
                href="/registro"
                className="mt-10 inline-flex min-h-14 items-center gap-2 bg-[#141414] px-8 text-lg font-bold text-white transition-colors hover:bg-[#D7261E] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#D7261E]"
              >
                Solicitar mi cuenta
                <ArrowUpRight className="h-5 w-5" />
              </Link>
            </div>

            <ol className="lg:col-span-7">
              <li className="gaceta-aparece grid grid-cols-[4.5rem_1fr] gap-4 border-t-2 border-[#141414] py-8 sm:grid-cols-[6rem_1fr]">
                <span className="text-7xl font-extrabold leading-[0.8] text-[#D7261E] [font-family:var(--font-display)] sm:text-8xl">
                  1
                </span>
                <div>
                  <h3 className="text-2xl font-semibold [font-family:var(--font-serif)]">
                    Llena tus datos
                  </h3>
                  <p className="mt-2 leading-relaxed text-[#141414]/75">
                    Nombre completo, tu matrícula IMSS, correo y una contraseña.
                  </p>
                </div>
              </li>
              <li className="gaceta-aparece grid grid-cols-[4.5rem_1fr] gap-4 border-t-2 border-[#141414] py-8 sm:grid-cols-[6rem_1fr]">
                <span className="text-7xl font-extrabold leading-[0.8] text-[#D7261E] [font-family:var(--font-display)] sm:text-8xl">
                  2
                </span>
                <div>
                  <h3 className="text-2xl font-semibold [font-family:var(--font-serif)]">
                    Sube tres documentos
                  </h3>
                  <ul className="mt-3 space-y-1.5">
                    {documentos.map((d) => (
                      <li key={d} className="flex gap-3 leading-relaxed">
                        <span
                          aria-hidden
                          className="mt-[0.6em] h-1.5 w-1.5 shrink-0 bg-[#D7261E]"
                        />
                        {d}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-[#141414]/60">
                    Foto con el celular, JPG, PNG, WEBP o PDF, hasta 5 MB cada
                    uno.
                  </p>
                </div>
              </li>
              <li className="gaceta-aparece grid grid-cols-[4.5rem_1fr] gap-4 border-y-2 border-[#141414] py-8 sm:grid-cols-[6rem_1fr]">
                <span className="text-7xl font-extrabold leading-[0.8] text-[#D7261E] [font-family:var(--font-display)] sm:text-8xl">
                  3
                </span>
                <div>
                  <h3 className="text-2xl font-semibold [font-family:var(--font-serif)]">
                    La sección valida tu registro
                  </h3>
                  <p className="mt-2 leading-relaxed text-[#141414]/75">
                    En 1 a 2 días hábiles. Te avisamos por correo cuando tu
                    cuenta esté activa.
                  </p>
                </div>
              </li>
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
