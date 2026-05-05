"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import {
  GripVertical,
  Trash2,
  Upload,
  ChevronUp,
  ChevronDown,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { Convenio } from "@/types/convenios";
import { auth } from "@/lib/firebase/firebase-client";

interface ConvenioLocal extends Convenio {
  seleccionado: boolean;
}

function SortableItem({
  convenio,
  onToggle,
  onDelete,
  onUpdate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  convenio: ConvenioLocal;
  onToggle: (id: string) => void;
  onDelete: (convenio: ConvenioLocal) => void;
  onUpdate: (id: string, campo: "titulo" | "link", valor: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: convenio.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
    >
      {/* Handle drag — solo visible en md+ */}
      <button
        className="hidden md:flex items-center text-slate-300 hover:text-slate-500 cursor-grab mt-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Flechas mobile */}
      <div className="flex md:hidden flex-col gap-1">
        <button
          onClick={() => onMoveUp(convenio.id)}
          disabled={isFirst}
          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          onClick={() => onMoveDown(convenio.id)}
          disabled={isLast}
          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Checkbox publicado */}
      <Checkbox
        checked={convenio.seleccionado}
        onCheckedChange={() => onToggle(convenio.id)}
        className="mt-1"
      />

      {/* Imagen */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={convenio.imageUrl}
        alt={convenio.titulo || "Convenio"}
        className="w-20 h-20 object-cover rounded-lg shrink-0"
      />

      {/* Campos */}
      <div className="flex-1 min-w-0 space-y-2">
        <Input
          placeholder="Título interno (opcional)"
          value={convenio.titulo || ""}
          onChange={(e) => onUpdate(convenio.id, "titulo", e.target.value)}
          className="text-sm h-8"
        />
        <div className="flex items-center gap-1">
          <Input
            placeholder="Link al hacer clic (opcional)"
            value={convenio.link || ""}
            onChange={(e) => onUpdate(convenio.id, "link", e.target.value)}
            className="text-sm h-8"
          />
          {convenio.link && (
            <a
              href={convenio.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-700"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Eliminar */}
      <button
        onClick={() => onDelete(convenio)}
        className="text-red-400 hover:text-red-600 mt-1 shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function AdminConveniosPage() {
  const [convenios, setConvenios] = useState<ConvenioLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConvenioLocal | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<
    Record<string, { titulo?: string; link?: string }>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const getToken = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return "";
    return currentUser.getIdToken();
  }, []);

  const fetchConvenios = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    const res = await fetch("/api/admin/convenios", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = await res.json();
    if (json.success) {
      setConvenios(
        json.data.map((c: Convenio) => ({ ...c, seleccionado: c.publicado })),
      );
    }
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    fetchConvenios();
  }, [fetchConvenios]);

  const pendientesCount = convenios.filter(
    (c) => c.seleccionado !== c.publicado,
  ).length;

  function handleToggle(id: string) {
    setConvenios((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, seleccionado: !c.seleccionado } : c,
      ),
    );
  }

  function handleSelectAll() {
    setConvenios((prev) => prev.map((c) => ({ ...c, seleccionado: true })));
  }

  function handleDeselectAll() {
    setConvenios((prev) => prev.map((c) => ({ ...c, seleccionado: false })));
  }

  function handleUpdate(id: string, campo: "titulo" | "link", valor: string) {
    setConvenios((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, [campo]: valor || undefined } : c,
      ),
    );
    setPendingUpdates((prev) => ({
      ...prev,
      [id]: { ...prev[id], [campo]: valor },
    }));
  }

  async function saveReorder(lista: ConvenioLocal[]) {
    const token = await getToken();
    await fetch("/api/admin/convenios", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "reorder",
        orden: lista.map((c, i) => ({ id: c.id, orden: i })),
      }),
    });
  }

  function handleMoveUp(id: string) {
    setConvenios((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx <= 0) return prev;
      const next = arrayMove(prev, idx, idx - 1);
      void saveReorder(next);
      return next;
    });
  }

  function handleMoveDown(id: string) {
    setConvenios((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx >= prev.length - 1) return prev;
      const next = arrayMove(prev, idx, idx + 1);
      void saveReorder(next);
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setConvenios((prev) => {
      const oldIdx = prev.findIndex((c) => c.id === active.id);
      const newIdx = prev.findIndex((c) => c.id === over.id);
      const next = arrayMove(prev, oldIdx, newIdx);
      void saveReorder(next);
      return next;
    });
  }

  async function handlePublish() {
    setSaving(true);
    const token = await getToken();
    for (const [id, cambios] of Object.entries(pendingUpdates)) {
      await fetch(`/api/admin/convenios/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(cambios),
      });
    }
    await fetch("/api/admin/convenios", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "publish",
        publicadosIds: convenios.filter((c) => c.seleccionado).map((c) => c.id),
        todosIds: convenios.map((c) => c.id),
      }),
    });
    setPendingUpdates({});
    await fetchConvenios();
    setSaving(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const token = await getToken();
    const formData = new FormData();
    formData.append("file", file);
    await fetch("/api/admin/convenios", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    await fetchConvenios();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const token = await getToken();
    await fetch(`/api/admin/convenios/${deleteTarget.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setDeleteTarget(null);
    await fetchConvenios();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Convenios de Descuento
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Selecciona los convenios que verán los trabajadores y da clic en
            Publicar.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            Seleccionar todo
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeselectAll}>
            Deseleccionar todo
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant="outline"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            Agregar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={saving || pendientesCount === 0}
            className="relative"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Publicar selección
            {pendientesCount > 0 && (
              <span className="ml-1.5 bg-white text-primary text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {pendientesCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {convenios.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="font-semibold">Aún no hay convenios.</p>
          <p className="text-sm mt-1">
            Agrega el primero con el botón de arriba.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={convenios.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {convenios.map((c, idx) => (
                <SortableItem
                  key={c.id}
                  convenio={c}
                  onToggle={handleToggle}
                  onDelete={setDeleteTarget}
                  onUpdate={handleUpdate}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  isFirst={idx === 0}
                  isLast={idx === convenios.length - 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar convenio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará la imagen permanentemente de Storage y Firestore. Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
