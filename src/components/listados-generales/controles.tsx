"use client";

import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 100;

export function opcionesUnicas(valores: Array<string | null | undefined>) {
  return Array.from(new Set(valores.map((v) => v || "").filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, "es"),
  );
}

export function Filtro({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
      >
        {children}
      </select>
    </label>
  );
}

export function Segmentado<T extends string>({
  label,
  value,
  opciones,
  onChange,
}: {
  label: string;
  value: T;
  opciones: Array<{ valor: T; texto: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
      {label}
      <div className="flex h-10 gap-1">
        {opciones.map((o) => (
          <Button
            key={o.valor}
            type="button"
            size="sm"
            variant={value === o.valor ? "default" : "outline"}
            className="h-10 flex-1 rounded-xl text-[10px] font-black uppercase"
            onClick={() => onChange(o.valor)}
          >
            {o.texto}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function Paginador({
  pagina,
  total,
  onChange,
}: {
  pagina: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <footer className="flex items-center justify-between">
      <Button
        variant="outline"
        size="sm"
        disabled={pagina === 0}
        onClick={() => onChange(pagina - 1)}
      >
        Anterior
      </Button>
      <span className="text-xs font-bold text-slate-500">
        Página {pagina + 1} de {paginas}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={pagina + 1 >= paginas}
        onClick={() => onChange(pagina + 1)}
      >
        Siguiente
      </Button>
    </footer>
  );
}
