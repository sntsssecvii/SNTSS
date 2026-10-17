"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Ejemplo {
  pestana: string;
  etiqueta: string;
  titulo: string;
  detalle: string;
  lugar: number;
  total?: number;
}

// Datos ficticios: ilustran lo que el trabajador ve en cada módulo del portal.
const EJEMPLOS: Ejemplo[] = [
  {
    pestana: "Bolsa",
    etiqueta: "Nuevo Ingreso",
    titulo: "Auxiliar Universal de Oficinas",
    detalle: "Zona Mexicali",
    lugar: 3,
  },
  {
    pestana: "Escalafón",
    etiqueta: "Promoción",
    titulo: "Enfermera General",
    detalle: "Zona Tijuana · Cierre del listado: 30 de noviembre",
    lugar: 5,
  },
  {
    pestana: "Cambios",
    etiqueta: "Cambio de turno",
    titulo: "Turno vespertino",
    detalle: "Unidad de Medicina Familiar · Ensenada",
    lugar: 3,
    total: 18,
  },
];

const ROTACION_MS = 4500;
const CUENTA_DESDE = 15;

function prefiereMenosMovimiento() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Ficha de ejemplo interactiva de la landing: pestañas por módulo, número que
 * cuenta hacia abajo hasta el lugar, rotación automática (se detiene al
 * interactuar) e inclinación 3D con el mouse. Sin animaciones con
 * prefers-reduced-motion.
 */
export function FichaInteractiva({ corte }: { corte: string }) {
  const [activa, setActiva] = useState(0);
  const [numero, setNumero] = useState(EJEMPLOS[0].lugar);
  const [interactuo, setInteractuo] = useState(false);
  const [visible, setVisible] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);
  const cuadro = useRef<number>();

  const ejemplo = EJEMPLOS[activa];

  // Cuenta regresiva hasta el lugar del ejemplo activo.
  const contar = useCallback((hasta: number) => {
    if (cuadro.current) cancelAnimationFrame(cuadro.current);
    if (prefiereMenosMovimiento()) {
      setNumero(hasta);
      return;
    }
    const desde = hasta + CUENTA_DESDE;
    const inicio = performance.now();
    const duracion = 900;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion);
      const suave = 1 - Math.pow(1 - p, 3);
      setNumero(Math.round(desde - (desde - hasta) * suave));
      if (p < 1) cuadro.current = requestAnimationFrame(paso);
    };
    cuadro.current = requestAnimationFrame(paso);
  }, []);

  // Arranca cuando la ficha entra en pantalla.
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (visible) contar(ejemplo.lugar);
  }, [visible, activa, ejemplo.lugar, contar]);

  // Rotación automática hasta que el usuario interactúe.
  useEffect(() => {
    if (!visible || interactuo || prefiereMenosMovimiento()) return;
    const id = setInterval(
      () => setActiva((i) => (i + 1) % EJEMPLOS.length),
      ROTACION_MS,
    );
    return () => clearInterval(id);
  }, [visible, interactuo]);

  useEffect(
    () => () => {
      if (cuadro.current) cancelAnimationFrame(cuadro.current);
    },
    [],
  );

  function elegir(i: number) {
    setInteractuo(true);
    setActiva(i);
  }

  function alTeclear(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const sig =
      (i + (e.key === "ArrowRight" ? 1 : -1) + EJEMPLOS.length) %
      EJEMPLOS.length;
    elegir(sig);
    document.getElementById(`ficha-tab-${sig}`)?.focus();
  }

  // Inclinación 3D (solo mouse).
  function inclinar(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || prefiereMenosMovimiento()) return;
    const el = tarjeta.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
  }

  function soltar() {
    if (tarjeta.current) tarjeta.current.style.transform = "";
  }

  return (
    <div
      ref={raiz}
      onPointerEnter={() => setInteractuo(true)}
      onPointerMove={inclinar}
      onPointerLeave={soltar}
    >
      <div
        ref={tarjeta}
        className="border-2 border-[#141414] bg-white text-[#141414] shadow-[12px_12px_0_#D7261E] transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none"
      >
        <div className="flex items-center justify-between gap-4 border-b-2 border-[#141414] px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-[0.18em]">
            Mi lugar en las listas
          </span>
          <span className="text-right text-xs font-semibold text-[#141414]/60">
            {corte}
          </span>
        </div>

        <div
          id={`ficha-panel-${activa}`}
          role="tabpanel"
          aria-labelledby={`ficha-tab-${activa}`}
          aria-live="polite"
          className="grid min-h-[9.5rem] grid-cols-[1fr_auto] items-end gap-4 px-5 pb-5 pt-6"
        >
          <div key={activa} className="ficha-cambia">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D7261E]">
              {ejemplo.etiqueta}
            </p>
            <p className="mt-2 text-xl font-semibold leading-tight [font-family:var(--font-serif)]">
              {ejemplo.titulo}
            </p>
            <p className="mt-1 text-sm text-[#141414]/60">{ejemplo.detalle}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#141414]/50">
              Tu lugar
            </p>
            <p
              aria-label={
                ejemplo.total
                  ? `${ejemplo.lugar} de ${ejemplo.total}`
                  : String(ejemplo.lugar)
              }
              className="text-7xl font-extrabold leading-[0.8] tracking-tight tabular-nums [font-family:var(--font-display)]"
            >
              {numero}
              {ejemplo.total && (
                <span className="ml-1 text-lg font-bold text-[#141414]/50">
                  de {ejemplo.total}
                </span>
              )}
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Ejemplos del portal"
          className="grid grid-cols-3 border-t-2 border-[#141414]"
        >
          {EJEMPLOS.map((ej, i) => {
            const sel = i === activa;
            return (
              <button
                key={ej.pestana}
                id={`ficha-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={sel}
                aria-controls={`ficha-panel-${i}`}
                tabIndex={sel ? 0 : -1}
                onClick={() => elegir(i)}
                onKeyDown={(e) => alTeclear(e, i)}
                className={`relative min-h-12 cursor-pointer border-r border-[#141414]/15 px-2 text-xs font-bold uppercase tracking-[0.14em] transition-colors last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#D7261E] ${
                  sel
                    ? "bg-[#141414] text-white"
                    : "text-[#141414]/60 hover:bg-[#141414]/5 hover:text-[#141414]"
                }`}
              >
                {ej.pestana}
                {sel && !interactuo && (
                  <span
                    aria-hidden
                    key={`barra-${activa}`}
                    className="ficha-progreso absolute inset-x-0 bottom-0 h-[3px] origin-left bg-[#D7261E]"
                    style={{ animationDuration: `${ROTACION_MS}ms` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
