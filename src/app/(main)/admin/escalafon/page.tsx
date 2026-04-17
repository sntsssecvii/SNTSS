"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import {
  ArrowRight,
  CalendarClock,
  FolderOpen,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { EscalafonLote } from "@/types/escalafon";

function formatFecha(value?: string) {
  if (!value) return "Sin fecha";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "Sin fecha"
    : d.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

function EstadoBadge({ estado }: { estado: "ABIERTO" | "CERRADO" }) {
  return (
    <Badge
      variant={estado === "ABIERTO" ? "warning" : "success"}
      className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
    >
      {estado}
    </Badge>
  );
}

export default function EscalafonPage() {
  const [lotes, setLotes] = useState<EscalafonLote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        const currentUser = auth.currentUser;
        if (!currentUser)
          throw new Error("No se pudo validar la sesión del administrador.");

        const idToken = await currentUser.getIdToken();
        const res = await fetch("/api/escalafon/lotes", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        const data = (await res.json()) as {
          lotes?: EscalafonLote[];
          error?: string;
        };

        if (!res.ok) throw new Error(data.error ?? "Error al cargar lotes");
        setLotes(data.lotes ?? []);
      } catch (error) {
        console.error(error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los lotes escalafonarios.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [toast]);

  const loteAbierto = useMemo(
    () => lotes.find((l) => l.estado === "ABIERTO") ?? null,
    [lotes],
  );

  const lotesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lotes;
    return lotes.filter(
      (l) =>
        l.nombre.toLowerCase().includes(q) ||
        l.estado.toLowerCase().includes(q),
    );
  }, [busqueda, lotes]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 dark:bg-[#020617] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 border border-slate-900 p-8 sm:p-12 mb-8 isolate shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-60" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary border border-primary/20 backdrop-blur-md">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Control de Lotes Escalafonarios
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:leading-[1.1]">
                Escalafón de{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-rose-500">
                  Condicionalidad
                </span>
              </h1>
              <p className="max-w-xl text-sm font-medium text-slate-400 sm:text-base leading-relaxed">
                Plataforma de gestión de listados escalafonarios. Agrupa y
                consulta los PDFs del SIAP por periodo de carga.
              </p>
            </div>

            <Button
              size="lg"
              onClick={() => router.push("/admin/escalafon/cargar")}
              className="h-14 rounded-2xl px-8 text-sm font-black sm:text-base bg-primary hover:bg-primary/90 text-white shadow-[0_0_40px_-10px_rgba(225,29,72,0.4)] transition-all"
            >
              <Plus className="mr-2 h-5 w-5" />
              Cargar
            </Button>
          </div>
        </header>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 mb-8">
          <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 flex items-center gap-6 shadow-sm hover:shadow-md transition-all">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <CalendarClock className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Lotes Registrados
              </p>
              <p className="text-4xl font-black text-slate-900 dark:text-white">
                {lotes.length}
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 flex items-center gap-6 shadow-sm hover:shadow-md transition-all">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <FolderOpen className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Lote Activo
              </p>
              <p className="text-xl font-black text-slate-900 dark:text-white truncate max-w-[16rem]">
                {loteAbierto?.nombre ?? "Ninguno"}
              </p>
            </div>
          </div>
        </section>

        {/* Search */}
        <div className="group rounded-[2rem] border border-slate-200/50 bg-white/40 p-1.5 shadow-sm backdrop-blur-xl transition-all hover:border-primary/20 hover:shadow-md dark:border-slate-800/50 dark:bg-slate-900/40">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-primary" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o estado..."
              className="h-14 rounded-2xl border-none bg-transparent pl-11 text-sm font-bold tracking-tight text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">
              Cargando lotes...
            </p>
          </div>
        ) : lotesFiltrados.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-900/50">
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
              <FolderOpen className="h-10 w-10 text-slate-300" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                No hay lotes para mostrar
              </h2>
              <p className="max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
                Sube un PDF para crear el primer lote automáticamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lotesFiltrados.map((lote) => (
              <button
                key={lote.id}
                onClick={() => router.push(`/admin/escalafon/${lote.id}`)}
                className="text-left"
              >
                <Card
                  className={cn(
                    "group h-full rounded-[2.5rem] transition-all duration-500 ease-out border-none relative overflow-hidden",
                    lote.estado === "ABIERTO"
                      ? "bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent ring-[1.5px] ring-primary/30 shadow-[0_20px_50px_-12px_rgba(225,29,72,0.15)]"
                      : "bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-primary/5 hover:ring-primary/20",
                  )}
                >
                  {lote.estado === "ABIERTO" && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-primary/20 transition-colors" />
                  )}

                  <CardContent className="flex flex-col h-full p-8 sm:p-10 space-y-8 relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p
                            className={cn(
                              "text-[10px] font-black uppercase tracking-[0.2em]",
                              lote.estado === "ABIERTO"
                                ? "text-primary"
                                : "text-slate-400",
                            )}
                          >
                            Lote {lote.estado === "ABIERTO" && "• Activo"}
                          </p>
                          {lote.estado === "ABIERTO" && (
                            <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                          {lote.nombre}
                        </h2>
                      </div>
                      <EstadoBadge estado={lote.estado} />
                    </div>

                    <div
                      className={cn(
                        "rounded-[2rem] p-6 flex flex-col gap-1 transition-all duration-300",
                        lote.estado === "ABIERTO"
                          ? "bg-white/50 dark:bg-slate-950/40 shadow-inner-white border border-primary/10"
                          : "bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100/50 dark:border-slate-800/50 group-hover:bg-white/80 group-hover:border-primary/10",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-[0.2em]",
                            lote.estado === "ABIERTO"
                              ? "text-primary/70"
                              : "text-slate-500",
                          )}
                        >
                          Listados Subidos
                        </span>
                        <span
                          className={cn(
                            "text-3xl font-black tracking-tighter",
                            lote.estado === "ABIERTO"
                              ? "text-primary"
                              : "text-slate-900 dark:text-white",
                          )}
                        >
                          {lote.totalListados}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-[12px] font-medium leading-relaxed mt-4 opacity-70",
                          lote.estado === "ABIERTO"
                            ? "text-primary/80"
                            : "text-slate-600 dark:text-slate-400",
                        )}
                      >
                        {lote.estado === "ABIERTO"
                          ? "Abierto — acepta nuevos uploads."
                          : "Cerrado."}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-4 pt-6">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Actualizado
                        </p>
                        <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">
                          {formatFecha(lote.actualizadoEn)}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "inline-flex shrink-0 w-12 h-12 items-center justify-center rounded-2xl transition-all duration-300 transform group-hover:-rotate-12",
                          lote.estado === "ABIERTO"
                            ? "bg-primary text-white shadow-[0_10px_20px_-5px_rgba(225,29,72,0.4)]"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-primary group-hover:text-white group-hover:shadow-lg",
                        )}
                      >
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
