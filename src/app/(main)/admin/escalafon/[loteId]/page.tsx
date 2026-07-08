"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderOpen,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { EscalafonLote, EscalafonListado } from "@/types/escalafon";

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

export default function DetalleLotePage() {
  const params = useParams<{ loteId: string }>();
  const loteId = String(params.loteId || "");
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [lote, setLote] = useState<EscalafonLote | null>(null);
  const [listados, setListados] = useState<EscalafonListado[]>([]);
  const [listadosEnOtrosLotes, setListadosEnOtrosLotes] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [listadoAEliminar, setListadoAEliminar] =
    useState<EscalafonListado | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser)
        throw new Error("No se pudo validar la sesión del administrador.");

      const idToken = await currentUser.getIdToken();
      const res = await fetch(`/api/escalafon/lotes/${loteId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      const data = (await res.json()) as {
        lote?: EscalafonLote;
        listados?: EscalafonListado[];
        listadosEnOtrosLotes?: number;
        error?: string;
      };

      if (res.status === 404 || !data.lote) {
        toast({
          title: "No encontrado",
          description: "El lote solicitado no existe.",
          variant: "destructive",
        });
        router.push("/admin/escalafon");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Error al cargar el lote");

      setLote(data.lote);
      setListados(data.listados ?? []);
      setListadosEnOtrosLotes(data.listadosEnOtrosLotes ?? 0);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "No se pudo cargar el detalle del lote.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [loteId, router, toast]);

  useEffect(() => {
    if (loteId) cargarDatos();
  }, [loteId, cargarDatos]);

  const cerrarLote = async () => {
    setCerrando(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Sesión no válida");
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`/api/escalafon/lotes/${loteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ estado: "CERRADO" }),
      });
      if (!res.ok) throw new Error("Error al cerrar el lote");
      const data = (await res.json()) as { consolidados?: number };
      await cargarDatos();
      toast({
        title: "Lote cerrado",
        description:
          data.consolidados && data.consolidados > 0
            ? `${data.consolidados} listados de lotes anteriores incorporados.`
            : "Snapshot completo guardado.",
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cerrar el lote.",
        variant: "destructive",
      });
    } finally {
      setCerrando(false);
    }
  };

  const eliminarListado = async () => {
    if (!listadoAEliminar?.id) return;
    setEliminando(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Sesión no válida");
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`/api/escalafon/${listadoAEliminar.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Error al eliminar el listado");
      }
      setListadoAEliminar(null);
      await cargarDatos();
      toast({
        title: "Listado eliminado",
        description: "El listado y sus aspirantes se borraron.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el listado.",
        variant: "destructive",
      });
    } finally {
      setEliminando(false);
    }
  };

  const listadosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return listados;
    return listados.filter(
      (l) =>
        l.categoriaDesc.toLowerCase().includes(q) ||
        l.areaDesc.toLowerCase().includes(q) ||
        l.sector.toLowerCase().includes(q),
    );
  }, [busqueda, listados]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#020617]">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">
          Cargando lote...
        </p>
      </div>
    );
  }

  if (!lote) return null;

  return (
    <div className="min-h-full bg-[#F8FAFC] dark:bg-[#020617] flex flex-col p-4 sm:p-6 lg:p-8 gap-6">
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-6">
        {/* Header compacto */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/admin/escalafon")}
              className="h-10 w-10 rounded-xl text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-0.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
                {lote.nombre}
              </h1>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-primary/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Listado Escalafonario
                </div>
                <Badge
                  variant={lote.estado === "ABIERTO" ? "warning" : "success"}
                  className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                >
                  {lote.estado}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto sm:ml-0">
            <div className="hidden lg:flex items-center gap-6 px-4 py-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 mr-2">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Listados
                </p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5">
                  {lote.totalListados}
                </p>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Actualizado
                </p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5">
                  {formatFecha(lote.actualizadoEn)}
                </p>
              </div>
            </div>
            {lote.estado === "ABIERTO" && (
              <Button
                variant="outline"
                size="lg"
                onClick={cerrarLote}
                disabled={cerrando}
                className="h-12 rounded-2xl px-5 font-black border-slate-300 text-slate-700 hover:bg-slate-100 transition-all"
              >
                {cerrando
                  ? "Consolidando..."
                  : listadosEnOtrosLotes > 0
                    ? `Cerrar y consolidar ${listadosEnOtrosLotes} listados`
                    : "Cerrar lote"}
              </Button>
            )}
            <Button
              size="lg"
              onClick={() =>
                router.push(`/admin/escalafon/cargar?loteId=${loteId}`)
              }
              className="h-12 rounded-2xl px-6 font-black bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:shadow-[0_0_20px_-5px_rgba(225,29,72,0.4)] transition-all"
            >
              <Plus className="mr-2 h-5 w-5" />
              Cargar
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="group rounded-[2rem] border border-slate-200/50 bg-white/40 p-1.5 shadow-sm backdrop-blur-xl transition-all hover:border-primary/20 hover:shadow-md dark:border-slate-800/50 dark:bg-slate-900/40">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-primary" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por categoría, área o sector..."
              className="h-14 rounded-2xl border-none bg-transparent pl-11 text-sm font-bold tracking-tight text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Grid de listados */}
        <section className="flex flex-col justify-start lg:flex-1 lg:min-h-0 lg:justify-center">
          {listadosFiltrados.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-900/50">
              <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
                <FolderOpen className="h-10 w-10 text-slate-300" />
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {listados.length === 0
                    ? "No hay listados en este lote"
                    : "Sin resultados para la búsqueda"}
                </h2>
                <p className="max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
                  {listados.length === 0 && lote.estado === "ABIERTO"
                    ? "Sube el primer PDF para comenzar."
                    : ""}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {listadosFiltrados.map((listado) => (
                <div
                  key={listado.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    router.push(`/admin/escalafon/${loteId}/${listado.id}`)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/admin/escalafon/${loteId}/${listado.id}`);
                    }
                  }}
                  className="text-left w-full cursor-pointer"
                >
                  <Card className="group rounded-[2rem] transition-all duration-500 ease-out border-none relative overflow-hidden flex flex-col shadow-sm bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 hover:shadow-2xl hover:ring-primary/20">
                    <CardContent className="p-6 flex flex-col space-y-4">
                      <div className="flex items-start justify-between min-h-[4.5rem]">
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-[1.1] line-clamp-3">
                          {listado.categoriaDesc}
                        </h3>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            title="Eliminar listado"
                            aria-label="Eliminar listado"
                            onClick={(e) => {
                              e.stopPropagation();
                              setListadoAEliminar(listado);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 animate-in fade-in zoom-in duration-500">
                            <Check className="h-4 w-4 stroke-[3px]" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 mt-auto">
                        <div className="flex items-end justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                              Registros
                            </span>
                            <span className="text-2xl font-black text-primary tracking-tighter mt-1">
                              {listado.aspirantesParsed.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                              Estatus
                            </span>
                            <div className="mt-1">
                              <Badge
                                variant="success"
                                className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                              >
                                Listo
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 line-clamp-1 italic px-1">
                          {listado.areaDesc}
                        </p>
                      </div>

                      <div className="pt-2 mt-auto flex flex-col gap-2">
                        <div className="w-full h-12 flex items-center justify-between px-6 rounded-2xl transition-all duration-300 bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white group-hover:shadow-[0_10px_20px_-5px_rgba(225,29,72,0.3)]">
                          <span className="text-xs font-black uppercase tracking-[0.2em]">
                            Ver
                          </span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                        {lote.estado === "ABIERTO" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/admin/escalafon/cargar?reemplazar=${listado.id}`,
                              );
                            }}
                            className="w-full h-10 flex items-center justify-center px-6 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                          >
                            Reemplazar
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AlertDialog
        open={listadoAEliminar !== null}
        onOpenChange={(open) => {
          if (!open && !eliminando) setListadoAEliminar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este listado?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará{" "}
              <span className="font-bold">
                {listadoAEliminar?.categoriaDesc}
              </span>{" "}
              y sus {listadoAEliminar?.aspirantesParsed ?? 0} aspirantes. Esta
              acción no se puede deshacer; para recuperarlo hay que volver a
              subir el PDF.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminando}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                eliminarListado();
              }}
              disabled={eliminando}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {eliminando ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
