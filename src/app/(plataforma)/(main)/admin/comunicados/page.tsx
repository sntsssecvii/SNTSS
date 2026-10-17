"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Megaphone,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Select } from "@/components/ui/select";
import { auth } from "@/lib/firebase/firebase-client";
import { useToast } from "@/components/ui/use-toast";
import {
  CATEGORIAS_COMUNICADO,
  MAX_COMUNICADOS_LANDING,
  formatearFechaComunicado,
} from "@/lib/comunicados";
import type { CategoriaComunicado, ComunicadoAdmin } from "@/types/comunicados";

interface Formulario {
  titulo: string;
  cuerpo: string;
  categoria: CategoriaComunicado;
  enlace: string;
  fijado: boolean;
  publicado: boolean;
}

const FORMULARIO_VACIO: Formulario = {
  titulo: "",
  cuerpo: "",
  categoria: "aviso",
  enlace: "",
  fijado: false,
  publicado: true,
};

export default function AdminComunicadosPage() {
  const { toast } = useToast();
  const [comunicados, setComunicados] = useState<ComunicadoAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [form, setForm] = useState<Formulario>(FORMULARIO_VACIO);
  const [porEliminar, setPorEliminar] = useState<ComunicadoAdmin | null>(null);

  const llamar = useCallback(async (url: string, init: RequestInit = {}) => {
    const token = (await auth.currentUser?.getIdToken()) ?? "";
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
    return json;
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const json = await llamar("/api/admin/comunicados");
      setComunicados(json.data ?? []);
    } catch (err) {
      console.error("[comunicados] Error al cargar:", err);
      toast({
        title: "No se pudieron cargar los comunicados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [llamar, toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirNuevo() {
    setEditandoId(null);
    setForm(FORMULARIO_VACIO);
    setDialogAbierto(true);
  }

  function abrirEdicion(c: ComunicadoAdmin) {
    setEditandoId(c.id);
    setForm({
      titulo: c.titulo,
      cuerpo: c.cuerpo,
      categoria: c.categoria,
      enlace: c.enlace ?? "",
      fijado: c.fijado,
      publicado: c.publicado,
    });
    setDialogAbierto(true);
  }

  async function guardar() {
    setSaving(true);
    try {
      if (editandoId) {
        await llamar(`/api/admin/comunicados/${editandoId}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
      } else {
        await llamar("/api/admin/comunicados", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      toast({
        title: editandoId ? "Comunicado actualizado" : "Comunicado creado",
      });
      setDialogAbierto(false);
      await cargar();
    } catch (err: any) {
      toast({
        title: "No se pudo guardar",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function alternar(c: ComunicadoAdmin, campo: "publicado" | "fijado") {
    try {
      await llamar(`/api/admin/comunicados/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [campo]: !c[campo] }),
      });
      await cargar();
    } catch (err: any) {
      toast({
        title: "No se pudo actualizar",
        description: err?.message,
        variant: "destructive",
      });
    }
  }

  async function eliminar() {
    if (!porEliminar) return;
    try {
      await llamar(`/api/admin/comunicados/${porEliminar.id}`, {
        method: "DELETE",
      });
      toast({ title: "Comunicado eliminado" });
      await cargar();
    } catch (err: any) {
      toast({
        title: "No se pudo eliminar",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setPorEliminar(null);
    }
  }

  const publicados = comunicados.filter((c) => c.publicado).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Megaphone className="h-6 w-6 text-red-700" />
            Comunicados oficiales
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Se muestran en la página pública de inicio. Los fijados aparecen
            primero; se muestran los {MAX_COMUNICADOS_LANDING} más recientes.
          </p>
        </div>
        <Button onClick={abrirNuevo} className="bg-red-700 hover:bg-red-800">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo comunicado
        </Button>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {publicados} publicado{publicados === 1 ? "" : "s"} ·{" "}
        {comunicados.length} en total
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : comunicados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          Aún no hay comunicados. Crea el primero para que aparezca en la página
          de inicio.
        </div>
      ) : (
        <div className="space-y-3">
          {comunicados.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${
                c.publicado
                  ? "border-slate-200"
                  : "border-dashed border-slate-300 opacity-70"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    c.publicado
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {c.publicado ? "PUBLICADO" : "BORRADOR"}
                </span>
                {c.fijado && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                    FIJADO
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                  {CATEGORIAS_COMUNICADO[c.categoria].toUpperCase()}
                </span>
                <span className="font-medium text-slate-400">
                  {formatearFechaComunicado(c.fecha)}
                </span>
              </div>
              <h2 className="mt-2 font-bold text-slate-900">{c.titulo}</h2>
              <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-500">
                {c.cuerpo}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => alternar(c, "publicado")}
                >
                  {c.publicado ? (
                    <>
                      <EyeOff className="mr-1.5 h-4 w-4" />
                      Ocultar
                    </>
                  ) : (
                    <>
                      <Eye className="mr-1.5 h-4 w-4" />
                      Publicar
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => alternar(c, "fijado")}
                >
                  {c.fijado ? (
                    <>
                      <PinOff className="mr-1.5 h-4 w-4" />
                      Desfijar
                    </>
                  ) : (
                    <>
                      <Pin className="mr-1.5 h-4 w-4" />
                      Fijar
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => abrirEdicion(c)}
                >
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setPorEliminar(c)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editandoId ? "Editar comunicado" : "Nuevo comunicado"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                maxLength={140}
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej. Avance en la negociación salarial 2026"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="categoria">Categoría</Label>
              <Select
                id="categoria"
                value={form.categoria}
                onChange={(e) =>
                  setForm({
                    ...form,
                    categoria: e.target.value as CategoriaComunicado,
                  })
                }
              >
                {Object.entries(CATEGORIAS_COMUNICADO).map(
                  ([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ),
                )}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cuerpo">Contenido</Label>
              <Textarea
                id="cuerpo"
                rows={8}
                maxLength={4000}
                value={form.cuerpo}
                onChange={(e) => setForm({ ...form, cuerpo: e.target.value })}
                placeholder="Texto del comunicado. Los saltos de línea se respetan."
              />
              <p className="text-right text-xs text-slate-400">
                {form.cuerpo.length}/4000
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="enlace">Enlace a documento (opcional)</Label>
              <Input
                id="enlace"
                value={form.enlace}
                onChange={(e) => setForm({ ...form, enlace: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.publicado}
                  onCheckedChange={(v) =>
                    setForm({ ...form, publicado: v === true })
                  }
                />
                Publicar en la página de inicio
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.fijado}
                  onCheckedChange={(v) =>
                    setForm({ ...form, fijado: v === true })
                  }
                />
                Fijar como importante
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              disabled={saving}
              className="bg-red-700 hover:bg-red-800"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={porEliminar !== null}
        onOpenChange={(abierto) => !abierto && setPorEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este comunicado?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{porEliminar?.titulo}&rdquo; se quitará de la página de
              inicio de forma permanente. Si solo quieres retirarlo, usa
              &ldquo;Ocultar&rdquo;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminar}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
