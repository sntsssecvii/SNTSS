/**
 * Detalles de fondo de la landing "Gaceta", tomados del mundo impreso y de los
 * documentos oficiales: guilloché, guías de columna, marcas de registro, trazo
 * fantasma de la VII y rótulo de cierre. Todos decorativos (aria-hidden) y de
 * muy baja opacidad.
 */

/** Curva de espirógrafo (hipotrocoide) cerrada, como en billetes y actas. */
function hipotrocoide(R: number, r: number, d: number, vueltas: number) {
  const pasos = 1400;
  const puntos: string[] = [];
  for (let i = 0; i <= pasos; i++) {
    const t = (i / pasos) * Math.PI * 2 * vueltas;
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    puntos.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${puntos.join("L")}Z`;
}

// R/r = 11/3 cierra en 3 vueltas; dos capas con distinta amplitud.
const ROSETA_A = hipotrocoide(220, 60, 95, 3);
const ROSETA_B = hipotrocoide(220, 60, 55, 3);

export function Guilloche({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="-320 -320 640 640"
      fill="none"
      className={`pointer-events-none absolute -z-10 ${className}`}
    >
      <g stroke="white" strokeWidth="0.8">
        <path d={ROSETA_A} strokeOpacity="0.16" />
        <path d={ROSETA_B} strokeOpacity="0.1" />
        <circle r="300" strokeOpacity="0.12" />
        <circle r="306" strokeOpacity="0.08" />
      </g>
    </svg>
  );
}

/** Retícula de columnas de periódico (4 columnas), solo en md+. */
export function GuiasColumnas({ oscuro = false }: { oscuro?: boolean }) {
  const linea = oscuro ? "rgb(242 238 230 / 0.06)" : "rgb(20 20 20 / 0.06)";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -z-10 left-5 right-5 hidden sm:left-8 sm:right-8 md:block"
      style={{
        backgroundImage: `linear-gradient(to right, ${linea} 1px, transparent 1px)`,
        backgroundSize: "25% 100%",
        boxShadow: `inset -1px 0 0 ${linea}`,
      }}
    />
  );
}

/** Marcas de corte de imprenta en las cuatro esquinas. */
export function MarcasRegistro({ oscuro = false }: { oscuro?: boolean }) {
  const c = oscuro ? "rgb(242 238 230 / 0.35)" : "rgb(20 20 20 / 0.3)";
  const esquina = "absolute h-4 w-4";
  const linea = { borderColor: c };
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-3 -z-10 hidden md:block"
    >
      <span
        className={`${esquina} left-0 top-0 border-l border-t`}
        style={linea}
      />
      <span
        className={`${esquina} right-0 top-0 border-r border-t`}
        style={linea}
      />
      <span
        className={`${esquina} bottom-0 left-0 border-b border-l`}
        style={linea}
      />
      <span
        className={`${esquina} bottom-0 right-0 border-b border-r`}
        style={linea}
      />
    </div>
  );
}

/** Barras de la VII en trazo fantasma, para fondos oscuros. */
export function VIIFantasma({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 600 700"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="#F2EEE6"
      strokeOpacity="0.07"
      strokeWidth="1.5"
      className={`pointer-events-none absolute -z-10 ${className}`}
    >
      <polygon points="300,0 420,0 230,700 110,700" />
      <polygon points="470,0 590,0 400,700 280,700" />
    </svg>
  );
}

/** Grano visible sobre fondos oscuros (el global usa multiply). */
export function GranoOscuro() {
  return <div aria-hidden className="gaceta-grano-oscuro -z-10" />;
}

/** Rótulo gigante en contorno, cortado al borde inferior. */
export function RotuloCierre({ texto }: { texto: string }) {
  return (
    <p
      aria-hidden
      className="pointer-events-none select-none overflow-hidden whitespace-nowrap px-5 text-center text-[clamp(4rem,17vw,16rem)] font-extrabold uppercase leading-[0.72] tracking-[-0.03em] text-transparent [-webkit-text-stroke:1px_rgb(242_238_230/0.14)] [font-family:var(--font-display)] sm:px-8"
    >
      {texto}
    </p>
  );
}
