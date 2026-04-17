# Escalafón — UI de Lotes (Estilo Bolsa) Design Spec

## Objetivo

Replicar la experiencia visual y de navegación de Bolsa de Trabajo en el módulo de Escalafón. El admin descarga 50-80 PDFs del SIAP por quincena y los sube a la plataforma; necesita una forma de agruparlos y consultarlos con la misma fluidez que usa en Bolsa.

## Contexto

- Bolsa: 8 tipos fijos por quincena → checklist explícito de tipos pendientes.
- Escalafón: 50-80 PDFs por "lote" de categorías variables → no hay checklist fijo, solo conteo de cuántos se subieron.
- Los listados de un mismo lote se identifican porque se suben el mismo día (o en días consecutivos para la misma quincena).

---

## Modelo de Datos

### Nueva colección: `escalafon_lotes`

```
escalafon_lotes/{loteId}
  nombre:          string       # "Abril 2026 · Q1" (auto-generado, editable)
  estado:          "ABIERTO" | "CERRADO"
  totalListados:   number       # contador incremental al guardar cada listado
  subidoPor:       string       # email del admin que creó el lote
  creadoEn:        Timestamp
  actualizadoEn:   Timestamp
```

**Estado ABIERTO:** acepta nuevos uploads. Solo puede existir un lote ABIERTO a la vez.
**Estado CERRADO:** bloqueado para uploads; solo lectura. El admin cierra manualmente cuando termina de subir todos los PDFs del periodo.

### Campo nuevo en `escalafon_listados`

```
loteId: string    # ID del lote al que pertenece
```

### Tipos TypeScript nuevos (`src/types/escalafon.ts`)

```ts
export interface EscalafonLote {
  id?: string;
  nombre: string;
  estado: "ABIERTO" | "CERRADO";
  totalListados: number;
  subidoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}
```

`EscalafonListado` recibe campo opcional para retrocompatibilidad:

```ts
loteId?: string;
```

### Índices Firestore

```json
{ "collectionGroup": "escalafon_lotes", "fields": [
    { "fieldPath": "estado", "order": "ASCENDING" },
    { "fieldPath": "creadoEn", "order": "DESCENDING" }
]},
{ "collectionGroup": "escalafon_listados", "fields": [
    { "fieldPath": "loteId", "order": "ASCENDING" },
    { "fieldPath": "creadoEn", "order": "DESCENDING" }
]}
```

---

## Rutas

| Ruta                                    | Descripción                                                     |
| --------------------------------------- | --------------------------------------------------------------- |
| `/admin/escalafon`                      | Lista de lotes (reemplaza lista plana actual)                   |
| `/admin/escalafon/[loteId]`             | Detalle del lote: tabla de listados con search                  |
| `/admin/escalafon/[loteId]/[listadoId]` | Detalle del listado (tabla de aspirantes — ya existe, se mueve) |
| `/admin/escalafon/cargar`               | Upload (ya existe, se adapta para lotes)                        |

El detalle actual en `/admin/escalafon/[listadoId]` se **mueve** a `/admin/escalafon/[loteId]/[listadoId]`. No hay redirección necesaria porque los listados existentes sin `loteId` se asignan a un lote "legacy" (ver Migración).

---

## API Routes

### `GET /api/escalafon/lotes`

Lista todos los lotes ordenados por `creadoEn` desc. Requiere rol admin/escalafón.

Respuesta:

```json
{ "lotes": [EscalafonLote] }
```

### `POST /api/escalafon/lotes`

Crea un lote nuevo. Solo permitido si no existe ya un lote `ABIERTO`.

Body: `{ nombre?: string }` — si se omite, se auto-genera con la fecha actual: `"Abril 2026 · Q1"` (Q1 = primera quincena del mes, Q2 = segunda).

Respuesta: `{ loteId: string, lote: EscalafonLote }`

### `GET /api/escalafon/lotes/[loteId]`

Detalle del lote + sus listados.

Respuesta:

```json
{
  "lote": EscalafonLote,
  "listados": [EscalafonListado]  // ordenados por creadoEn desc
}
```

### `PATCH /api/escalafon/lotes/[loteId]`

Actualiza nombre o cierra el lote.

Body: `{ nombre?: string, estado?: "CERRADO" }` — no permite reabrir un lote cerrado.

### `POST /api/escalafon/procesar` (modificación)

Acepta `loteId` opcional en el FormData.

Lógica:

1. Si `loteId` viene en el body, usar ese lote (debe estar ABIERTO).
2. Si no, buscar el lote ABIERTO activo.
3. Si no hay lote ABIERTO, crear uno automáticamente con nombre de fecha.
4. Guardar el listado con `loteId` en Firestore.
5. Incrementar `totalListados` en el lote (transacción atómica).

---

## UI — Página Principal `/admin/escalafon`

**Componentes:** `Card`, `CardContent`, `Badge`, `Button`, `Input` de shadcn. `lucide-react` para iconos. `cn()` de `@/lib/utils`. `auth` de `@/lib/firebase/firebase-client`. `useToast` de `@/components/ui/use-toast`.

**Reemplaza** la lista plana actual. El layout replica byte-a-byte el estilo de `bolsa-de-trabajo/page.tsx`:

**Header oscuro** — mismo `<header>` con `bg-slate-950`, gradiente `from-primary/10`, blob, título con `text-transparent bg-clip-text bg-gradient-to-r from-primary to-rose-500`:

```
Control de Lotes Escalafonarios                       [+ Cargar]
Escalafón de <Condicionalidad>
Plataforma de gestión de listados escalafonarios...
```

**Stats** — 2 cards idénticas a bolsa:

- `CalendarClock` + "Lotes Registrados" + total
- `FolderOpen` + "Lote Activo" + (nombre del lote ABIERTO o "Ninguno")

**Search** — pill `rounded-[2rem]` con `Search` icon, mismo estilo.

**Grid** — `grid gap-4 md:grid-cols-2 xl:grid-cols-3`. Cada card:

```tsx
// Mismo card que bolsa pero adaptado al lote:
// - Periodo label → "Lote"
// - formatPeriodo(sync) → lote.nombre
// - esFuenteVerdad (oficial) → lote.estado === "ABIERTO"
// - totalRegistros → lote.totalListados + " listados"
// - Texto contextual: "Abierto — acepta nuevos uploads." | "Cerrado."
// - Fecha: lote.actualizadoEn
```

**Badge de estado:**

```tsx
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
```

Click en card → `router.push(`/admin/escalafon/${lote.id}`)`.

---

## UI — Detalle del Lote `/admin/escalafon/[loteId]`

**Componentes:** mismos que bolsa quincena detail. Replica `quincenas/[syncId]/page.tsx` en estructura.

**Header compacto** — idéntico:

```tsx
// ArrowLeft button → router.push("/admin/escalafon")
// Título: lote.nombre ("Abril 2026 · Q2")
// Subtítulo: "Listado Escalafonario" + badge estado
// Stats inline (lg): "X Listados" | "Actualizado: fecha"
// Botón Cargar → router.push(`/admin/escalafon/cargar?loteId=${loteId}`)
// Botón "Cerrar lote" (solo ABIERTO) → PATCH /api/escalafon/lotes/[loteId]
```

**Cuerpo — grid de cards de listados** (misma sección `<section>` con mismo grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`):

Cada card replica el card de tipo de bolsa pero representa un listado:

```tsx
// h3 → listado.categoriaDesc (font-black tracking-tighter leading-[1.1] line-clamp-3)
// Registros → listado.aspirantesParsed
// Estado → siempre "LISTO" (verde checkmark) — un listado subido ya está procesado
// Nombre archivo no disponible → mostrar listado.areaDesc
// CTA bar → "Ver" + ArrowRight (igual que "Revisar" en bolsa)
// Si lote ABIERTO: segunda acción "Reemplazar" en el card (botón secundario debajo del CTA)
```

Click en card (o botón "Ver") → `/admin/escalafon/${loteId}/${listado.id}`.

**Nota de adaptación:** con 50-80 listados el grid de 4 cols es perfectamente manejable (similar a tener 50-80 categorías en múltiples páginas de bolsa). No se usa tabla — se mantiene el grid de cards idéntico al de bolsa.

**Search** — pill `rounded-[2rem]` sobre el grid. Filtra en tiempo real sobre `categoriaDesc`, `areaDesc`, `sector`. `useMemo` con búsqueda lowercase.

---

## UI — Upload `/admin/escalafon/cargar`

Replica `bolsa-de-trabajo/cargar/page.tsx` en estructura y estilo:

```tsx
// ArrowLeft + "Volver" → router.back()
// Icono: FileUp (lucide) en bg-primary/10 rounded-2xl
// Título: "Cargar Listado"
// Descripción: "Carga el PDF del listado escalafonario de condicionalidad."
```

**Banner de lote activo** (encima del input de archivo):

```tsx
// Si lote ABIERTO:
<div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
  <FolderOpen className="text-amber-600" />
  <div>
    <p className="font-black text-amber-900">Subiendo al lote: {lote.nombre}</p>
    <p className="text-xs text-amber-700">Este listado se añadirá al lote activo.</p>
  </div>
</div>
// Si no hay lote ABIERTO:
<div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
  <p className="font-black text-slate-700">Se creará un lote nuevo automáticamente.</p>
</div>
```

**Modo reemplazar** (`?reemplazar=[listadoId]`):

```tsx
// Banner: "bg-orange-50 border-orange-200"
// Texto: "Reemplazando: [listado.categoriaDesc]"
// Subtexto: "El listado anterior será eliminado al confirmar."
// FormData incluye: reemplazarId=[listadoId]
```

El input de archivo y botón "Procesar PDF" son los mismos que el `cargar/page.tsx` actual de escalafón (no BulkFileUpload, ya que es un solo PDF).

Al procesar exitosamente → `router.push(`/admin/escalafon/${loteId}`)`.

**El API route** `/api/escalafon/procesar` detecta `reemplazarId`:

1. Obtiene el listado a reemplazar para saber su `loteId`.
2. Llama `eliminarListado(reemplazarId)`.
3. Decrementa `totalListados` en el lote.
4. Guarda el nuevo listado con el mismo `loteId`, salta detección de duplicados.
5. Incrementa `totalListados` en el lote.

---

## UI — Detalle del Listado `/admin/escalafon/[loteId]/[listadoId]`

El archivo actual `src/app/(main)/admin/escalafon/[listadoId]/page.tsx` se **mueve** a `[loteId]/[listadoId]/page.tsx`.

Header adapta el back button:

```tsx
// ArrowLeft → router.push(`/admin/escalafon/${loteId}`)
// Breadcrumb: "← Escalafón / {lote.nombre}"
// Título: listado.categoriaDesc
// Mismo layout de tabla de aspirantes + filtro por zona (sin cambios)
```

Botón "Reemplazar" en el header (si lote ABIERTO):

```tsx
<Button
  variant="outline"
  onClick={() => router.push(`/admin/escalafon/cargar?reemplazar=${listadoId}`)}
>
  Reemplazar
</Button>
```

---

## Migración de Datos Existentes

Los listados subidos antes de esta feature no tienen `loteId`. Al desplegar:

1. Crear un lote "Importaciones previas" con estado CERRADO en Firestore (script de migración en `scripts/migrations/`).
2. Actualizar todos los `escalafon_listados` sin `loteId` para asignarles ese loteId.
3. El script se corre una sola vez manualmente.

---

## Firestore — Capa de Datos (`src/lib/firebase/escalafon.ts`)

Funciones nuevas:

- `crearLote(nombre: string, subidoPor: string): Promise<string>` — crea lote ABIERTO
- `obtenerLoteAbierto(): Promise<EscalafonLote | null>` — busca lote con estado ABIERTO
- `listarLotes(): Promise<EscalafonLote[]>` — todos los lotes desc
- `obtenerLote(loteId: string): Promise<EscalafonLote | null>`
- `listarListadosDelLote(loteId: string): Promise<EscalafonListado[]>`
- `actualizarLote(loteId: string, data: Partial<EscalafonLote>): Promise<void>`
- `incrementarTotalListados(loteId: string): Promise<void>` — transacción atómica

Funciones modificadas:

- `guardarListado()` acepta `loteId` adicional y lo guarda en el documento.

---

## Consideraciones Técnicas

- **Un solo lote ABIERTO:** `obtenerLoteAbierto()` usa `where("estado", "==", "ABIERTO").limit(1)`. Si hay más de uno (inconsistencia), toma el más reciente.
- **Auto-nombre:** formato `"Mes Año · Q1/Q2"` donde Q1 = días 1-15, Q2 = días 16-31. Ej: upload el 16 Abr → "Abril 2026 · Q2".
- **No hay validación de duplicados por lote:** el sistema ya detecta duplicados por `categoriaCode + periodoDecierre`. Si el admin sube el mismo PDF en dos lotes distintos, el segundo falla con el error de duplicado existente.
- **Permisos:** mismas reglas que hoy — rol `ESCALAFON` o `ADMIN`/`SUPER_ADMIN`.
- **Script de migración** corre fuera del app (Node.js con Firebase Admin SDK), no es un API route.
