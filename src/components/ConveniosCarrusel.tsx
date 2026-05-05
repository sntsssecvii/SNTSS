"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Tag } from "lucide-react";
import Link from "next/link";
import type { ConvenioPublico } from "@/types/convenios";

interface Props {
  convenios: ConvenioPublico[];
}

export function ConveniosCarrusel({ convenios }: Props) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % convenios.length);
  }, [convenios.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + convenios.length) % convenios.length);
  }, [convenios.length]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(next, 4000);
  }, [next]);

  useEffect(() => {
    if (convenios.length <= 1) return;
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [convenios.length, resetTimer]);

  if (convenios.length === 0) return null;

  const convenio = convenios[current];

  function handleUserInteraction(action: () => void) {
    action();
    resetTimer();
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <Tag className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
          Convenios de Descuento
        </span>
      </div>

      {/* Imagen */}
      <div
        className="relative w-full cursor-pointer"
        onClick={() =>
          convenio.link &&
          window.open(convenio.link, "_blank", "noopener,noreferrer")
        }
      >
        <img
          src={convenio.imageUrl}
          alt="Convenio de descuento"
          className="w-full h-40 object-cover"
        />

        {/* Flechas */}
        {convenios.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUserInteraction(prev);
              }}
              aria-label="Convenio anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-1"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUserInteraction(next);
              }}
              aria-label="Convenio siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-1"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Footer: dots + ver todos */}
      <div className="flex items-center justify-between px-4 py-2">
        {convenios.length > 1 ? (
          <div className="flex gap-1">
            {convenios.map((_, i) => (
              <button
                key={i}
                onClick={() => handleUserInteraction(() => setCurrent(i))}
                aria-label={`Convenio ${i + 1}`}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === current ? "bg-amber-500" : "bg-amber-200"
                }`}
              />
            ))}
          </div>
        ) : (
          <div />
        )}
        <Link
          href="/dashboard/convenios"
          className="text-[11px] font-bold text-amber-600 hover:text-amber-800"
        >
          Ver todos →
        </Link>
      </div>
    </div>
  );
}
