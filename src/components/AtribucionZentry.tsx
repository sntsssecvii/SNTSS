import { cn } from "@/lib/utils";

interface AtribucionZentryProps {
  className?: string;
}

/**
 * Atribución de autoría de Zentry Tech Group.
 * Fuente única de la marca en las vistas públicas (landing, login, público).
 * Discreta por diseño: no compite con el copyright del SNTSS.
 */
export function AtribucionZentry({ className }: AtribucionZentryProps) {
  return (
    <p className={cn("text-[11px] text-slate-400/80", className)}>
      Plataforma desarrollada por{" "}
      <span className="font-semibold text-slate-500">Zentry Tech Group</span>
    </p>
  );
}
