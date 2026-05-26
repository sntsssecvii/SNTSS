# Spec: Módulo de Propuestas Sindicales — Oficina de Admisión y Cambios

**Fecha:** 2026-05-25
**Estado:** Aprobado
**Rama objetivo:** `feat/propuestas-admision`

---

## Contexto

La Oficina de Admisión y Cambios recibe solicitudes de trabajadores del IMSS que quieren ingresar a un familiar al sindicato (o en casos excepcionales, sin familiar). Actualmente el flujo es manual vía Google Forms y hoja de cálculo. Este módulo lo digitaliza completamente.

El flujo tiene dos fases:

1. **Fase 1** — El trabajador solicita. La encargada revisa, aprueba o rechaza.
2. **Fase 2** — Los casos aprobados se asignan a un requerimiento (circular del sindicato nacional) que define las plazas disponibles por categoría y zona.

---

## Arquitectura

### Rutas

| Ruta                                  | Acceso                       | Descripción                                |
| ------------------------------------- | ---------------------------- | ------------------------------------------ |
| `/solicitud`                          | Público (sin auth)           | Formulario de solicitud para el trabajador |
| `/admin/propuestas`                   | ADMISION, ADMIN, SUPER_ADMIN | Dashboard con 3 pestañas                   |
| `/admin/propuestas/[id]`              | ADMISION, ADMIN, SUPER_ADMIN | Vista de caso detallado                    |
| `/admin/propuestas/[id]/print`        | ADMISION, ADMIN, SUPER_ADMIN | Página de impresión (CSS print)            |
| `/api/propuestas/verificar-matricula` | Público                      | Valida que matrícula existe en padrón      |
| `/api/propuestas`                     | Auth                         | CRUD de propuestas                         |
| `/api/propuestas/[id]/aprobar`        | Auth + permiso               | Aprueba caso y asigna folio                |
| `/api/propuestas/[id]/rechazar`       | Auth + permiso               | Rechaza caso con motivo                    |
| `/api/requerimientos`                 | Auth + permiso               | CRUD de requerimientos/circulares          |
| `/api/asignaciones`                   | Auth + permiso               | Asignar propuesta aprobada a requerimiento |

### Nuevo rol RBAC

`ADMISION` — rol específico para la Oficina de Admisión y Cambios. Tiene acceso completo al módulo de propuestas y requerimientos, sin acceso a bolsa de trabajo ni escalafón.

Agregar a `src/types/roles.ts` y a los helpers de permisos existentes.

---

## Modelo de datos (Firestore)

### `propuestas/{id}`

```typescript
{
  // Identificación
  numeroCaso: string;          // "CASO-2026-0041" — asignado al crear
  folio: string | null;        // "2026-0012" — solo al APROBAR

  // Estado
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  estadoFase2: 'SIN_ASIGNAR' | 'ASIGNADA' | 'DEVUELTA' | null;
  motivoRechazo: string | null;

  // Trabajador solicitante
  matricula: string;           // validada contra padrón, no se expone info adicional

  // Familiar / aspirante
  sinFamiliar: boolean;        // false por defecto; true = contratación directa excepcional
  aspirante: {
    nombreCompleto: string;
    curp: string;
    parentesco: 'Hijo' | 'Hija' | 'Cónyuge' | 'Otro' | null;
    telefono: string;
  } | null;                    // null si sinFamiliar = true

  // Documentos
  documentos: {
    ineUrl: string | null;     // Firebase Storage URL directo (no signed URL)
  };

  // Warnings (calculados al crear, no bloquean el registro)
  warnings: {
    propuestaActivaExistente: boolean;   // ya tiene PENDIENTE o APROBADA
    sinRequerimientoDisponible: boolean; // no hay plaza en esa categoría/zona
    curpDuplicado: boolean;              // el CURP del aspirante ya está en otra propuesta
    categoriaIncompatible: boolean;      // categoría no aplica para la zona del trabajador
    documentoFaltante: boolean;          // INE no subida
  };

  // Historial de eventos
  historial: Array<{
    fecha: Timestamp;
    tipo: 'CREADA' | 'APROBADA' | 'RECHAZADA' | 'ASIGNADA' | 'DEVUELTA';
    usuarioId: string;
    nota: string | null;
  }>;

  // Metadata
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
```

### `requerimientos/{id}`

```typescript
{
  numeroOficio: string; // número del circular
  fechaCircular: Timestamp;
  estado: "ACTIVO" | "CERRADO";

  partidas: Array<{
    zona: string;
    categoria: string;
    cantidadTotal: number;
    cantidadDisponible: number; // decrementado en transacción al asignar
  }>;

  creadoPor: string; // usuarioId
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
```

### `asignaciones/{id}`

```typescript
{
  propuestaId: string;
  requerimientoId: string;
  zona: string;
  categoria: string;
  estado: "ACTIVA" | "DEVUELTA";

  asignadoPor: string;
  asignadoEn: Timestamp;
}
```

### `contadores/propuestas` (doc especial)

```typescript
{
  ultimoCaso: number; // incrementado al crear propuesta
  ultimoFolio: number; // incrementado al aprobar
  anio: number; // para detectar reset de año
}
```

Ambos contadores se actualizan en **transacción Firestore** para garantizar unicidad.

---

## Formulario público (`/solicitud`)

### Paso 1: Validación de matrícula

- Campo matrícula + botón "Verificar"
- API `/api/propuestas/verificar-matricula`:
  1. Busca matrícula en padrón (colección `usuarios`)
  2. Verifica que no exista propuesta activa (PENDIENTE o APROBADA) para esa matrícula
  3. Respuesta exitosa: `{ valida: true }` — **no se devuelve nombre ni datos del trabajador**
  4. Si ya tiene propuesta activa: mensaje con el número de caso
- Si pasa validación → muestra Paso 2

### Paso 2: Datos de la solicitud

- Checkbox "Sin familiar (caso excepcional)" — visible pero no prominente
- Si `sinFamiliar = false` (default):
  - Nombre completo del aspirante
  - Parentesco (select: Hijo / Hija / Cónyuge / Otro)
  - CURP del aspirante
  - Teléfono de contacto
  - Upload INE (imagen JPG/PNG o PDF, máx 5MB) → Firebase Storage
- Si `sinFamiliar = true`: sección de familiar se oculta

### Paso 3: Confirmación

- Al enviar:
  1. Sube INE a Storage (si aplica)
  2. Calcula warnings
  3. Crea doc en `propuestas/` con estado PENDIENTE y número de caso
  4. Muestra número de caso al solicitante para seguimiento
- Los warnings **nunca bloquean** el envío — son solo para uso interno del admin

---

## Dashboard del admin (`/admin/propuestas`)

### Pestaña 1: Solicitudes (Fase 1)

Tabla con columnas:

- `# Caso` · `Matrícula` · `Nombre familiar` · `Categoría` · `Fecha` · `Warnings` · `Estado`

Filtros: estado (PENDIENTE / APROBADA / RECHAZADA), categoría, rango de fechas.

Indicadores visuales:

- Badge naranja en columna Warnings si hay alguno activo
- Badge especial "Sin familiar" si `sinFamiliar = true`

Click en fila → `/admin/propuestas/[id]`

### Pestaña 2: Requerimientos (Circulares)

Tabla: `Oficio` · `Fecha circular` · `Partidas` (resumen) · `Disponibles` · `Estado`

Botón "Subir circular" → modal con:

- Número de oficio
- Fecha del circular
- Tabla de partidas editable (agregar/quitar filas): Zona · Categoría · Cantidad total

### Pestaña 3: Asignaciones (Fase 2)

Solo casos APROBADOS. Tabla: `Folio` · `Aspirante` · `Categoría` · `Requerimiento asignado` · `Estado asignación`

---

## Vista de caso detallado (`/admin/propuestas/[id]`)

Layout dos columnas:

**Columna izquierda — datos**

- Encabezado: # Caso, estado (badge), fecha de ingreso
- Matrícula del trabajador
- Datos del aspirante (o badge "Sin familiar")
- INE: preview con botón de descarga
- Si hay warnings → sección colapsable naranja con descripción de cada warning activo

**Columna derecha — acciones e historial**

Acciones según estado:

- `PENDIENTE` → botón "Aprobar" (verde) + botón "Rechazar" (rojo)
- `APROBADA` → folio generado + botón "Asignar requerimiento" (abre modal de selección)
- `RECHAZADA` → motivo de rechazo visible

Flujo de rechazo: modal con textarea obligatorio para el motivo. Motivo queda en historial.

Flujo de aprobación: transacción Firestore — asigna folio (`YYYY-XXXX`) y cambia estado.

Historial: lista cronológica de eventos con tipo, fecha, usuario y nota.

---

## PDF imprimible (`/admin/propuestas/[id]/print`)

Página Next.js con CSS `@media print`. No usa Adobe SDK — el SDK existente es solo para parsear, no generar.

Contenido (replica formato oficial SNTSS):

- Encabezado con logo SNTSS, número de oficio, fecha
- Datos del trabajador (matrícula)
- Datos del familiar/aspirante
- Categoría solicitada
- Folio (solo si estado = APROBADA; si PENDIENTE imprime sin folio)
- Espacio para firmas

Botón "Generar PDF" disponible en cualquier estado desde la vista de detalle.

---

## Lógica de requerimientos y disponibilidad

Al asignar propuesta aprobada a un requerimiento:

1. Se crea doc en `asignaciones/{id}`
2. Transacción Firestore decrementa `cantidadDisponible` en la partida correspondiente
3. Si `cantidadDisponible === 0` → esa partida no aparece como opción al asignar

El warning `sinRequerimientoDisponible` se recalcula al momento de crear la propuesta comparando categoría/zona del trabajador contra partidas disponibles en requerimientos activos.

---

## Archivos a crear / modificar

### Nuevos

- `src/types/propuestas.ts` — reemplaza el existente (colección vacía en prod, rediseño seguro)
- `src/types/workflow.ts` — reemplaza el existente
- `src/lib/firebase/propuestas.ts` — reemplaza el existente
- `src/lib/firebase/requerimientos.ts`
- `src/lib/firebase/asignaciones.ts`
- `src/lib/firebase/contadores.ts` — helpers para transacciones de contadores
- `src/lib/propuestas/warnings.ts` — lógica de cálculo de warnings
- `src/app/(public)/solicitud/page.tsx`
- `src/app/(main)/admin/propuestas/page.tsx`
- `src/app/(main)/admin/propuestas/[id]/page.tsx`
- `src/app/(main)/admin/propuestas/[id]/print/page.tsx`
- `src/app/api/propuestas/verificar-matricula/route.ts`
- `src/app/api/propuestas/route.ts`
- `src/app/api/propuestas/[id]/aprobar/route.ts`
- `src/app/api/propuestas/[id]/rechazar/route.ts`
- `src/app/api/requerimientos/route.ts`
- `src/app/api/asignaciones/route.ts`

### Modificados

- `src/types/roles.ts` — agregar `ADMISION`
- `src/lib/security/permissions.ts` — permisos del rol ADMISION
- `docs/firestore-schema.md` — documentar nuevas colecciones

---

## Decisiones de diseño

- **Warnings no bloquean registro** — son información para el admin, no gates para el solicitante. El admin tiene contexto completo para decidir.
- **Sin familiar es excepcional** — mismo flujo de validación, solo omite datos del aspirante. Badge informativo en tabla.
- **Matrícula validada sin exponer datos** — API solo devuelve `{ valida: boolean }`, nunca nombre ni datos del trabajador.
- **Folio solo al aprobar** — número de caso se asigna al crear (para seguimiento), folio oficial solo al APROBAR.
- **PDF con CSS print** — más simple que Adobe SDK para generación; el SDK existente solo parsea.
- **Firebase Storage URL directa** — consistente con el patrón existente del proyecto (no signed URLs).
- **Transacciones Firestore para contadores** — garantiza unicidad de folios y números de caso sin colisiones concurrentes.
