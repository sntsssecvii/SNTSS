# Convenios de Descuento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CMS de convenios en admin + carrusel en portal del trabajador (dashboard compacto + página dedicada).

**Architecture:** Firestore `convenios` collection con `publicado` como fuente de verdad. Admin gestiona con batch update. Portal lee vía `GET /api/convenios` (solo publicados). Drag & drop con `@dnd-kit` en admin desktop, flechas ↑↓ en mobile.

**Tech Stack:** Next.js 14 App Router, Firebase Firestore + Storage, @dnd-kit/core + @dnd-kit/sortable, Tailwind, Radix UI, Framer Motion.

**Spec:** `docs/superpowers/specs/2026-05-04-convenios-descuento-design.md`

---

### Task 1: Tipos y helpers de Firestore

**Files:**

- Create: `src/types/convenios.ts`
- Create: `src/lib/firebase/convenios.ts`

- [ ] **Step 1: Crear tipos**

```typescript
// src/types/convenios.ts
import type { Timestamp } from "firebase-admin/firestore";

export interface Convenio {
  id: string;
  imageUrl: string;
  titulo?: string;
  link?: string;
  orden: number;
  publicado: boolean;
  creadoEn: Timestamp;
  creadoPor: string;
}

export interface ConvenioPublico {
  id: string;
  imageUrl: string;
  link?: string;
  orden: number;
}
```

- [ ] **Step 2: Crear helpers de Firestore**

```typescript
// src/lib/firebase/convenios.ts
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import type { Convenio } from "@/types/convenios";
import type { WriteBatch } from "firebase-admin/firestore";

const COLLECTION = "convenios";

export async function getConveniosPublicos(): Promise<Convenio[]> {
  const snap = await adminDb
    .collection(COLLECTION)
    .where("publicado", "==", true)
    .orderBy("orden", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Convenio);
}

export async function getConveniosAdmin(): Promise<Convenio[]> {
  const snap = await adminDb
    .collection(COLLECTION)
    .orderBy("orden", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Convenio);
}

export async function createConvenio(
  data: Omit<Convenio, "id">,
): Promise<string> {
  const ref = await adminDb.collection(COLLECTION).add(data);
  return ref.id;
}

export async function updateConvenio(
  id: string,
  data: Partial<Omit<Convenio, "id">>,
): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).update(data);
}

export async function deleteConvenio(
  id: string,
  imageUrl: string,
): Promise<void> {
  // Extraer path del storage desde la URL
  const url = new URL(imageUrl);
  const pathEncoded = url.pathname.split("/o/")[1];
  if (pathEncoded) {
    const storagePath = decodeURIComponent(pathEncoded.split("?")[0]);
    try {
      await adminStorage.bucket().file(storagePath).delete();
    } catch {
      // Si el archivo no existe en Storage, continuar igual
    }
  }
  await adminDb.collection(COLLECTION).doc(id).delete();
}

export async function publishConvenios(
  ids: string[],
  todosIds: string[],
): Promise<void> {
  const batch: WriteBatch = adminDb.batch();
  for (const id of todosIds) {
    const ref = adminDb.collection(COLLECTION).doc(id);
    batch.update(ref, { publicado: ids.includes(id) });
  }
  await batch.commit();
}

export async function reorderConvenios(
  ordenado: Array<{ id: string; orden: number }>,
): Promise<void> {
  const batch: WriteBatch = adminDb.batch();
  for (const { id, orden } of ordenado) {
    batch.update(adminDb.collection(COLLECTION).doc(id), { orden });
  }
  await batch.commit();
}

export async function getMaxOrden(): Promise<number> {
  const snap = await adminDb
    .collection(COLLECTION)
    .orderBy("orden", "desc")
    .limit(1)
    .get();
  if (snap.empty) return 0;
  return (snap.docs[0].data().orden as number) + 1;
}
```

- [ ] **Step 3: Verificar que compila**

```bash
npm run typecheck
```

Esperado: sin errores en los nuevos archivos.

- [ ] **Step 4: Commit**

```bash
git checkout -b feat/convenios-descuento
git add src/types/convenios.ts src/lib/firebase/convenios.ts
git commit -m "feat(convenios): tipos y helpers Firestore/Storage"
```

---

### Task 2: API routes

**Files:**

- Create: `src/app/api/convenios/route.ts`
- Create: `src/app/api/admin/convenios/route.ts`
- Create: `src/app/api/admin/convenios/[id]/route.ts`

- [ ] **Step 1: Crear GET público `/api/convenios`**

```typescript
// src/app/api/convenios/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { RateLimitError } from "@/lib/security/rate-limit";
import { getConveniosPublicos } from "@/lib/firebase/convenios";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:convenios",
      limit: 60,
      windowMs: 60_000,
    });
    await requireUserRequest(request);

    const convenios = await getConveniosPublicos();
    return NextResponse.json({
      success: true,
      data: convenios.map((c) => ({
        id: c.id,
        imageUrl: c.imageUrl,
        link: c.link,
        orden: c.orden,
      })),
    });
  } catch (error: any) {
    if (error?.message === "CORS_FORBIDDEN")
      return NextResponse.json(
        { error: "Acceso no permitido." },
        { status: 403 },
      );
    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED")
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        { status: 429 },
      );
    if (error?.message === "AUTH_REQUIRED")
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Crear API admin GET+POST `/api/admin/convenios`**

```typescript
// src/app/api/admin/convenios/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { RateLimitError } from "@/lib/security/rate-limit";
import {
  getConveniosAdmin,
  createConvenio,
  publishConvenios,
  reorderConvenios,
  getMaxOrden,
} from "@/lib/firebase/convenios";
import { adminStorage } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

function handleError(error: any) {
  if (error?.message === "CORS_FORBIDDEN")
    return NextResponse.json(
      { error: "Acceso no permitido." },
      { status: 403 },
    );
  if (error instanceof RateLimitError || error?.message === "RATE_LIMITED")
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      { status: 429 },
    );
  if (
    error?.message === "AUTH_REQUIRED" ||
    error?.message === "INSUFFICIENT_PERMISSIONS"
  )
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ error: "Error interno." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:convenios",
      limit: 60,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);
    const convenios = await getConveniosAdmin();
    return NextResponse.json({ success: true, data: convenios });
  } catch (error: any) {
    return handleError(error);
  }
}

// POST /api/admin/convenios — sube imagen y crea convenio
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:convenios",
      limit: 20,
      windowMs: 60_000,
    });
    const context = await requireAdminRequest(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const titulo = formData.get("titulo") as string | undefined;
    const link = formData.get("link") as string | undefined;

    if (!file)
      return NextResponse.json(
        { error: "Archivo requerido." },
        { status: 400 },
      );

    const ext = file.name.split(".").pop();
    const storagePath = `convenios/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fileRef.save(buffer, { contentType: file.type, public: true });
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const orden = await getMaxOrden();
    const id = await createConvenio({
      imageUrl,
      titulo: titulo || undefined,
      link: link || undefined,
      orden,
      publicado: false,
      creadoEn: FieldValue.serverTimestamp() as any,
      creadoPor: context.uid,
    });

    return NextResponse.json({ success: true, id, imageUrl });
  } catch (error: any) {
    return handleError(error);
  }
}

// PATCH /api/admin/convenios — publicar selección o reordenar
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:convenios",
      limit: 30,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const body = await request.json();

    if (body.action === "publish") {
      // body.publicadosIds: string[], body.todosIds: string[]
      await publishConvenios(body.publicadosIds, body.todosIds);
      return NextResponse.json({ success: true });
    }

    if (body.action === "reorder") {
      // body.orden: Array<{ id: string; orden: number }>
      await reorderConvenios(body.orden);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error: any) {
    return handleError(error);
  }
}
```

- [ ] **Step 3: Crear API admin PATCH+DELETE `/api/admin/convenios/[id]`**

```typescript
// src/app/api/admin/convenios/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { RateLimitError } from "@/lib/security/rate-limit";
import { updateConvenio, deleteConvenio } from "@/lib/firebase/convenios";

export const dynamic = "force-dynamic";

function handleError(error: any) {
  if (error?.message === "CORS_FORBIDDEN")
    return NextResponse.json(
      { error: "Acceso no permitido." },
      { status: 403 },
    );
  if (error instanceof RateLimitError || error?.message === "RATE_LIMITED")
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      { status: 429 },
    );
  if (
    error?.message === "AUTH_REQUIRED" ||
    error?.message === "INSUFFICIENT_PERMISSIONS"
  )
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ error: "Error interno." }, { status: 500 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:convenios",
      limit: 30,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);
    const body = await request.json();
    await updateConvenio(params.id, {
      ...(body.titulo !== undefined && { titulo: body.titulo }),
      ...(body.link !== undefined && { link: body.link || undefined }),
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:convenios",
      limit: 20,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);
    const body = await request.json();
    if (!body.imageUrl)
      return NextResponse.json(
        { error: "imageUrl requerida." },
        { status: 400 },
      );
    await deleteConvenio(params.id, body.imageUrl);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return handleError(error);
  }
}
```

- [ ] **Step 4: Verificar que compila**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/convenios/ src/app/api/admin/convenios/
git commit -m "feat(convenios): API routes GET público + admin CRUD"
```

---

### Task 3: Instalar @dnd-kit

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Instalar**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Verificar instalación**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: instalar @dnd-kit para drag & drop en convenios"
```

---

### Task 4: Panel admin de convenios

**Files:**

- Create: `src/app/(main)/admin/convenios/page.tsx`

- [ ] **Step 1: Crear la página**

```typescript
// src/app/(main)/admin/convenios/page.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { GripVertical, Trash2, Upload, ChevronUp, ChevronDown, Loader2, ExternalLink } from 'lucide-react'
import type { Convenio } from '@/types/convenios'

interface ConvenioLocal extends Convenio {
  seleccionado: boolean
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
  convenio: ConvenioLocal
  onToggle: (id: string) => void
  onDelete: (convenio: ConvenioLocal) => void
  onUpdate: (id: string, campo: 'titulo' | 'link', valor: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  isFirst: boolean
  isLast: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: convenio.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

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
      <img
        src={convenio.imageUrl}
        alt={convenio.titulo || 'Convenio'}
        className="w-20 h-20 object-cover rounded-lg shrink-0"
      />

      {/* Campos */}
      <div className="flex-1 min-w-0 space-y-2">
        <Input
          placeholder="Título interno (opcional)"
          value={convenio.titulo || ''}
          onChange={e => onUpdate(convenio.id, 'titulo', e.target.value)}
          className="text-sm h-8"
        />
        <div className="flex items-center gap-1">
          <Input
            placeholder="Link al hacer clic (opcional)"
            value={convenio.link || ''}
            onChange={e => onUpdate(convenio.id, 'link', e.target.value)}
            className="text-sm h-8"
          />
          {convenio.link && (
            <a href={convenio.link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-700">
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
  )
}

export default function AdminConveniosPage() {
  const [convenios, setConvenios] = useState<ConvenioLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ConvenioLocal | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, { titulo?: string; link?: string }>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchConvenios = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/convenios')
    const json = await res.json()
    if (json.success) {
      setConvenios(json.data.map((c: Convenio) => ({ ...c, seleccionado: c.publicado })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchConvenios() }, [fetchConvenios])

  const pendientesCount = convenios.filter(c => c.seleccionado !== c.publicado).length

  function handleToggle(id: string) {
    setConvenios(prev => prev.map(c => c.id === id ? { ...c, seleccionado: !c.seleccionado } : c))
  }

  function handleSelectAll() {
    setConvenios(prev => prev.map(c => ({ ...c, seleccionado: true })))
  }

  function handleDeselectAll() {
    setConvenios(prev => prev.map(c => ({ ...c, seleccionado: false })))
  }

  function handleUpdate(id: string, campo: 'titulo' | 'link', valor: string) {
    setConvenios(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor || undefined } : c))
    setPendingUpdates(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }))
  }

  function handleMoveUp(id: string) {
    setConvenios(prev => {
      const idx = prev.findIndex(c => c.id === id)
      if (idx <= 0) return prev
      const next = arrayMove(prev, idx, idx - 1)
      saveReorder(next)
      return next
    })
  }

  function handleMoveDown(id: string) {
    setConvenios(prev => {
      const idx = prev.findIndex(c => c.id === id)
      if (idx >= prev.length - 1) return prev
      const next = arrayMove(prev, idx, idx + 1)
      saveReorder(next)
      return next
    })
  }

  async function saveReorder(lista: ConvenioLocal[]) {
    await fetch('/api/admin/convenios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reorder',
        orden: lista.map((c, i) => ({ id: c.id, orden: i })),
      }),
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setConvenios(prev => {
      const oldIdx = prev.findIndex(c => c.id === active.id)
      const newIdx = prev.findIndex(c => c.id === over.id)
      const next = arrayMove(prev, oldIdx, newIdx)
      saveReorder(next)
      return next
    })
  }

  async function handlePublish() {
    setSaving(true)
    // Guardar cambios de título/link pendientes
    for (const [id, cambios] of Object.entries(pendingUpdates)) {
      await fetch(`/api/admin/convenios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      })
    }
    // Publicar selección
    await fetch('/api/admin/convenios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'publish',
        publicadosIds: convenios.filter(c => c.seleccionado).map(c => c.id),
        todosIds: convenios.map(c => c.id),
      }),
    })
    setPendingUpdates({})
    await fetchConvenios()
    setSaving(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    await fetch('/api/admin/convenios', { method: 'POST', body: formData })
    await fetchConvenios()
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await fetch(`/api/admin/convenios/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: deleteTarget.imageUrl }),
    })
    setDeleteTarget(null)
    await fetchConvenios()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Convenios de Descuento</h1>
          <p className="text-sm text-slate-500 mt-1">
            Selecciona los convenios que verán los trabajadores y da clic en Publicar.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>Seleccionar todo</Button>
          <Button variant="outline" size="sm" onClick={handleDeselectAll}>Deseleccionar todo</Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant="outline"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            Agregar
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
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
          <p className="text-sm mt-1">Agrega el primero con el botón de arriba.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={convenios.map(c => c.id)} strategy={verticalListSortingStrategy}>
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

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar convenio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará la imagen permanentemente de Storage y Firestore. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/admin/convenios/
git commit -m "feat(convenios): panel admin CMS con drag&drop y publicación por selección"
```

---

### Task 5: Link en sidebar admin

**Files:**

- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Agregar item en la sección admin**

Busca la sección donde están los items de admin (cerca de `/admin/bolsa-de-trabajo` y `/admin/escalafon`). Agrega:

```typescript
// Agregar junto a los otros items admin (alrededor de línea 87)
{
  label: 'Convenios',
  href: '/admin/convenios',
  icon: Tag,  // import Tag from 'lucide-react'
},
```

Agrega `Tag` al import de lucide-react existente.

- [ ] **Step 2: Typecheck + verificar visual**

```bash
npm run typecheck && npm run dev
```

Navega a `/admin/convenios` y verifica que el link aparece en el sidebar.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(convenios): agregar link admin en sidebar"
```

---

### Task 6: Carrusel compacto en dashboard del trabajador

**Files:**

- Create: `src/components/ConveniosCarrusel.tsx`
- Modify: `src/app/(main)/dashboard/page.tsx`

- [ ] **Step 1: Crear componente carrusel**

```typescript
// src/components/ConveniosCarrusel.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Tag } from 'lucide-react'
import Link from 'next/link'
import type { ConvenioPublico } from '@/types/convenios'

interface Props {
  convenios: ConvenioPublico[]
}

export function ConveniosCarrusel({ convenios }: Props) {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const next = useCallback(() => {
    setCurrent(prev => (prev + 1) % convenios.length)
  }, [convenios.length])

  const prev = useCallback(() => {
    setCurrent(prev => (prev - 1 + convenios.length) % convenios.length)
  }, [convenios.length])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(next, 4000)
  }, [next])

  useEffect(() => {
    if (convenios.length <= 1) return
    resetTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [convenios.length, resetTimer])

  if (convenios.length === 0) return null

  const convenio = convenios[current]

  function handleUserInteraction(action: () => void) {
    action()
    resetTimer()
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
        onClick={() => convenio.link && window.open(convenio.link, '_blank', 'noopener,noreferrer')}
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
              onClick={e => { e.stopPropagation(); handleUserInteraction(prev) }}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-1"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleUserInteraction(next) }}
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
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === current ? 'bg-amber-500' : 'bg-amber-200'
                }`}
              />
            ))}
          </div>
        ) : <div />}
        <Link
          href="/dashboard/convenios"
          className="text-[11px] font-bold text-amber-600 hover:text-amber-800"
        >
          Ver todos →
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Integrar en dashboard**

En `src/app/(main)/dashboard/page.tsx`, agregar el fetch de convenios y renderizar el carrusel después del card de saludo.

Agrega el import y el estado:

```typescript
import { ConveniosCarrusel } from "@/components/ConveniosCarrusel";
import type { ConvenioPublico } from "@/types/convenios";

// Dentro del componente, junto a los otros estados:
const [convenios, setConvenios] = useState<ConvenioPublico[]>([]);
```

Agrega el fetch de convenios dentro del `useEffect` de carga (o en uno separado):

```typescript
useEffect(() => {
  if (!user) return;
  const fetchConvenios = async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/convenios", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setConvenios(json.data);
    } catch {
      // silencioso — convenios no son críticos
    }
  };
  fetchConvenios();
}, [user]);
```

Ubica el bloque del card de saludo (busca el `motion.section` inicial) y agrega el carrusel justo después de él, antes de la sección de posiciones:

```tsx
{
  convenios.length > 0 && (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="px-4 md:px-8"
    >
      <ConveniosCarrusel convenios={convenios} />
    </motion.div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ConveniosCarrusel.tsx src/app/\(main\)/dashboard/page.tsx
git commit -m "feat(convenios): carrusel compacto en dashboard del trabajador"
```

---

### Task 7: Página completa del trabajador

**Files:**

- Create: `src/app/(main)/dashboard/convenios/page.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Crear página**

```typescript
// src/app/(main)/dashboard/convenios/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ConveniosCarrusel } from '@/components/ConveniosCarrusel'
import { Tag } from 'lucide-react'
import type { ConvenioPublico } from '@/types/convenios'

export default function ConveniosPage() {
  const { user } = useAuth()
  const [convenios, setConvenios] = useState<ConvenioPublico[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetch_ = async () => {
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/convenios', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (json.success) setConvenios(json.data)
      } finally {
        setLoading(false)
      }
    }
    fetch_()
  }, [user])

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Tag className="h-5 w-5 text-amber-600" />
        <h1 className="text-2xl font-black text-slate-900">Convenios de Descuento</h1>
      </div>

      {loading ? (
        <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
      ) : convenios.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
          <Tag className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Próximamente convenios de descuento para ti</p>
        </div>
      ) : (
        <>
          <ConveniosCarrusel convenios={convenios} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {convenios.map(c => (
              <button
                key={c.id}
                onClick={() => c.link && window.open(c.link, '_blank', 'noopener,noreferrer')}
                className="rounded-xl overflow-hidden border border-slate-100 hover:border-amber-300 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <img
                  src={c.imageUrl}
                  alt="Convenio"
                  className="w-full aspect-video object-cover"
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Agregar link en sidebar del trabajador**

En `src/components/Sidebar.tsx`, busca los items del portal del trabajador (los que apuntan a `/dashboard/*`) y agrega:

```typescript
// Agregar junto a los links del trabajador
{
  label: 'Convenios',
  href: '/dashboard/convenios',
  icon: Tag,  // import Tag from 'lucide-react' si no está
},
```

- [ ] **Step 3: Typecheck + smoke test**

```bash
npm run typecheck
npm run dev
```

Verifica:

- Navegar a `/dashboard/convenios` muestra empty state si no hay convenios publicados
- El link aparece en el sidebar del trabajador
- Con convenios publicados: carrusel grande + grid de thumbnails

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/dashboard/convenios/ src/components/Sidebar.tsx
git commit -m "feat(convenios): página completa del trabajador + link sidebar"
```

---

### Task 8: Smoke test manual + PR

- [ ] **Step 1: Build de producción**

```bash
npm run build
```

Esperado: sin errores de compilación.

- [ ] **Step 2: Smoke test manual**

Con `npm run dev`:

1. **Admin:** ir a `/admin/convenios` → subir una imagen → verificar que aparece desmarcada → seleccionarla → clic "Publicar selección" → verificar que el badge desaparece
2. **Reordenar:** drag en desktop / flechas en mobile → verificar que persiste al recargar
3. **Eliminar:** borrar un convenio → verificar confirmación → verificar que desaparece
4. **Portal:** ir a `/dashboard` → verificar carrusel compacto después del saludo → clic "Ver todos" → verificar página completa
5. **Sin convenios:** desmarcar todos y publicar → verificar que la sección del carrusel desaparece del dashboard

- [ ] **Step 3: Abrir PR**

```bash
git push origin feat/convenios-descuento
```

Abrir PR en GitHub hacia `main`.
