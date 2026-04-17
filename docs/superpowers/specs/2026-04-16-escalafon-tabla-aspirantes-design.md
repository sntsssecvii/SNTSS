# Escalafón — Tabla de Aspirantes Design Spec

## Objetivo

Reemplazar la tabla HTML básica de `/admin/escalafon/[loteId]/[listadoId]` con una interfaz de alta calidad idéntica en estructura y UX al detalle de documentos de bolsa de trabajo (`/admin/bolsa-de-trabajo/[id]`).

---

## Layout

Layout fijo full-screen replicando `bolsa-de-trabajo/[id]/page.tsx`:

```
┌──────────────────────────────────────────────────────────┐
│  HEADER sticky (back, título listado, stats, botones)    │
├─────────────┬────────────────────────────────────────────┤
│  SIDEBAR    │  TOOLBAR (search + filtros + paginación)   │
│  w-72       ├────────────────────────────────────────────┤
│  Tabs:      │  TABLE (scroll interno, sticky header)     │
│  • Zonas    │                                            │
│  • Estatus  │                                            │
└─────────────┴────────────────────────────────────────────┘
```

Clases base (idénticas a bolsa):

- Contenedor: `fixed inset-0 lg:left-64 top-14 bg-[#F8FAFC] dark:bg-[#020617] flex flex-col overflow-hidden z-20`
- Header: `bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shrink-0`
- Body: `flex-1 flex overflow-hidden min-h-0`
- Sidebar: `w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col`
- Main: `flex-1 flex flex-col min-w-0 bg-white dark:bg-[#020617] h-full overflow-hidden`

---

## Header

```tsx
// Fila 1: back button + título + badge estado
// Fila 2: stats inline (aspirantes totales, zona activa si hay)
// Fila 3 (acciones):
//   - Botón "Reemplazar" → /admin/escalafon/cargar?reemplazar=[listadoId] (solo lote ABIERTO)
//   - Botón "Exportar CSV" → descarga CSV de aspirantes filtrados (client-side)
```

**Título**: `listado.categoriaDesc`
**Subtítulo**: `listado.areaDesc · Sector: listado.sector · Periodo: listado.periodoDecierre`
**Breadcrumb**: `← Escalafón / {lote.nombre}` → `router.push(/admin/escalafon/${loteId})`

---

## Sidebar

Tabs idénticos a bolsa con `shadcn/ui Tabs`:

### Tab "Zonas"

- Lista de zonas extraídas de `listado.zonas[]`
- Cada zona muestra conteo de aspirantes que tienen `posicionesPorZona[zona] !== undefined`
- Click → activa filtro zona, ordena tabla por `posicionesPorZona[zona]` ASC
- Opción "Todas las Zonas" al tope (activa por defecto)
- Búsqueda interna de zonas (Input pill igual a bolsa)
- Conteos calculados via `useMemo` sobre el array completo de aspirantes

### Tab "Estatus"

- Dos opciones: "Activo" y "PEI"
- Con conteos de aspirantes en cada estatus
- Click → filtra tabla por `aspirante.estatus`
- Opción "Todos" al tope

---

## Toolbar

```tsx
// Mismo pill container bg-slate-50 rounded-2xl border
// Input search: busca nombre o matrícula (debounce 300ms)
// Separador vertical
// Paginación: ChevronLeft · "1 / N" · ChevronRight
```

50 aspirantes por página. Paginación client-side via `useMemo`:

```ts
const aspirantesFiltrados = useMemo(() => {
  let list = [...aspirantes];
  if (filtroEstatus !== "all")
    list = list.filter((a) => a.estatus === filtroEstatus);
  if (filtroZona !== "all")
    list = list.filter((a) => a.posicionesPorZona?.[filtroZona] !== undefined);
  if (busquedaDebounced) {
    const q = busquedaDebounced.toLowerCase();
    list = list.filter(
      (a) =>
        a.nombre.toLowerCase().includes(q) ||
        a.matricula.toLowerCase().includes(q),
    );
  }
  // Orden: zona activa → por posición en esa zona; sin zona → por lugar global
  if (filtroZona !== "all") {
    list.sort(
      (a, b) =>
        (a.posicionesPorZona?.[filtroZona] ?? 9999) -
        (b.posicionesPorZona?.[filtroZona] ?? 9999),
    );
  } else {
    list.sort((a, b) => a.lugar - b.lugar);
  }
  return list;
}, [aspirantes, filtroEstatus, filtroZona, busquedaDebounced]);

const pagina = aspirantesFiltrados.slice(
  (paginaActual - 1) * PAGE_SIZE,
  paginaActual * PAGE_SIZE,
);
```

Cuando filters cambian → `setPaginaActual(1)`.

---

## Tabla

Usa componente shadcn `Table` con `border-separate border-spacing-0 min-w-[900px]`.

### Columnas

| Col                 | Campo                                       | Notas                                              |
| ------------------- | ------------------------------------------- | -------------------------------------------------- |
| Lugar               | `aspirante.lugar`                           | Ranking global; monospace, badge número            |
| Pos. Zona           | `posicionesPorZona[filtroZona]`             | Solo visible cuando hay zona activa; badge emerald |
| Estatus             | `aspirante.estatus`                         | Badge: Activo=emerald, PEI=amber                   |
| Matrícula           | `aspirante.matricula`                       | Monospace bold                                     |
| Nombre / Delegación | `aspirante.nombre` + `aspirante.delegacion` | Dos líneas                                         |
| Fecha Registro      | `aspirante.fechaRegistro`                   | Formato corto                                      |
| 👁                  | —                                           | Botón ghost `Eye` → abre modal                     |

Cuando no hay zona activa, la columna "Pos. Zona" se oculta.

### Filas

Zebra striping igual a bolsa: `i % 2 === 0 ? "bg-white" : "bg-slate-50/30"`.
`group` hover con `group-hover:text-primary` en nombre.

### Empty state

Igual a bolsa: ícono `Search` grande centrado + textos.

---

## Modal de Detalle (Eye)

`Dialog` shadcn. Abre al click del ícono ojo.

```tsx
// Header del modal:
// - Nombre (h2 font-black)
// - Matrícula · Delegación
// - Badge estatus

// Sección 1 — Datos generales (grid 2 cols):
// - Lugar global: número en badge primario
// - Fecha registro
// - Posiciones por zona (si tiene): lista de chips "Zona X: pos N"

// Sección 2 — Preferencias:
// Tabla con columnas: # | Delegación Sol. | Zona | Localidad | Adscripción | Turno
// Cada fila = una EscalafonPreferencia
// Si no hay preferencias: texto "Sin preferencias registradas"
```

---

## API

Sin cambios. Carga única al montar:

```ts
GET /api/escalafon/${listadoId}
→ { listado: EscalafonListado, aspirantes: EscalafonAspirante[] }
```

La página también necesita saber si el lote está ABIERTO para mostrar "Reemplazar":

```ts
GET /api/escalafon/lotes/${loteId}  // endpoint ya existente
→ { lote: EscalafonLote }
```

Ambas requests en paralelo al montar con `Promise.all`.

---

## Export CSV

Genera CSV client-side de los aspirantes **filtrados** (no todos):

```ts
function exportarCSV(
  aspirantes: EscalafonAspirante[],
  listado: EscalafonListado,
) {
  const rows = aspirantes.map((a) => [
    a.lugar,
    a.estatus,
    a.matricula,
    a.nombre,
    a.delegacion,
    a.fechaRegistro,
    a.preferencias
      .map((p) => `${p.delegacionSolicitada}/${p.zonaSolicitada}`)
      .join(" | "),
  ]);
  // Construir CSV string y descargar via blob URL
}
```

Botón "Exportar" en el header, ícono `Download`.

---

## Componentes a Crear

- `src/app/(main)/admin/escalafon/[loteId]/[listadoId]/page.tsx` — rewrite completo

No se crean componentes adicionales. Todo va en el page file (igual que bolsa `[id]/page.tsx` que también es monolítico).

---

## Archivos a Modificar

- `src/app/(main)/admin/escalafon/[loteId]/[listadoId]/page.tsx` — rewrite completo

No se tocan APIs ni tipos — todo lo necesario ya existe.

---

## Estado de Carga

```
loading-initial → skeleton / spinner centrado
success         → tabla con datos
empty           → empty state con ícono Search
error           → mensaje de error con botón Volver
```

---

## Notas Técnicas

- **No server-side pagination**: máx ~200 aspirantes por listado → client-side es suficiente
- **No AbortController**: carga única al montar, no hay requests concurrentes
- **Framer Motion**: `motion.div` con `initial={{ opacity: 0 }} animate={{ opacity: 1 }}` igual que bolsa
- **Sidebar oculto en mobile**: `hidden lg:flex` para el aside, la tabla ocupa full width en móvil
