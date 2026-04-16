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

Reemplaza la lista plana actual de listados.

**Layout:**

```
[Header]
  Escalafón                              [+ Cargar]

[Stats row]
  X lotes · Y lote abierto

[Search]
  🔍 Buscar por nombre, estado...

[Grid de cards — 1-2-3 cols responsive]
```

**Card de lote:**

```
┌──────────────────────────────────────┐
│ Abril 2026 · Q1          [ABIERTO]   │
│ 23 listados · admin@sntss.mx         │
│ Última actualización: 16 Abr 2026    │
│                         [Ver lote →] │
└──────────────────────────────────────┘
```

Badge ABIERTO → `bg-yellow-100 text-yellow-800`
Badge CERRADO → `bg-green-100 text-green-800`

El card del lote ABIERTO muestra un botón adicional "Cerrar lote" (llama PATCH con `estado: "CERRADO"`).

---

## UI — Detalle del Lote `/admin/escalafon/[loteId]`

```
[← Escalafón]
Abril 2026 · Q1                    [ABIERTO] [Cerrar lote] [+ Cargar]

23 listados

[Search: 🔍 Buscar por categoría, área, sector...]

[Tabla]
Categoría                  Área          Sector  N° Listado  Aspirantes  Subido
ENFERMERA PEDIATRA         Enfermería    B-01    0001        47          16 Abr 2026
MÉDICO FAMILIAR            Medicina Gral B-02    0002        83          16 Abr 2026
...
```

- Search filtra en tiempo real sobre `categoriaDesc`, `areaDesc`, `sector`, `numeroListado`.
- Click en fila → `/admin/escalafon/[loteId]/[listadoId]`
- Sin paginación (50-80 filas con scroll son manejables).
- Si el lote está CERRADO: no aparece botón "Cerrar lote" ni "+ Cargar".

---

## UI — Upload `/admin/escalafon/cargar`

Cambios mínimos:

- Si hay lote ABIERTO: muestra banner "Subiendo al lote: Abril 2026 · Q1".
- Si no hay lote ABIERTO: muestra mensaje "Se creará un lote nuevo automáticamente".
- Al procesar exitosamente, redirige a `/admin/escalafon/[loteId]` (en lugar de `/admin/escalafon/[listadoId]`).

---

## UI — Detalle del Listado `/admin/escalafon/[loteId]/[listadoId]`

Igual al actual `/admin/escalafon/[listadoId]` (tabla de aspirantes, filtro por zona). Solo cambia el breadcrumb:

```
← Escalafón / Abril 2026 · Q1 / ENFERMERA PEDIATRA
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
