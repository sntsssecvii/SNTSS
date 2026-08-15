# Módulo de Convenios de Descuento — Design Spec

**Fecha:** 2026-05-04
**Estado:** Aprobado — listo para implementación
**Autor:** Gerardo Arroyo + Emma

---

## Objetivo

Permitir al admin subir imágenes de convenios de descuento y publicarlas selectivamente. Los trabajadores las ven en un carrusel en su dashboard y en una página dedicada.

---

## Modelo de datos

### Firestore: colección `convenios`

```typescript
{
  id: string            // auto (Firestore)
  imageUrl: string      // URL directa Firebase Storage (no signed URL)
  titulo?: string       // nombre interno para el admin (ej. "OXXO Q2 2026")
  link?: string         // URL opcional — al hacer clic abre nueva pestaña
  orden: number         // define el orden del carrusel (menor = primero)
  publicado: boolean    // true = visible para trabajadores
  creadoEn: Timestamp
  creadoPor: string     // uid del admin que subió la imagen
}
```

### Firebase Storage

Path: `convenios/{timestamp}_{filename}`
Acceso: URL directa pública (mismo patrón que documentos de registro).

---

## Panel admin: `/admin/convenios`

### Acceso

Roles: `ADMIN`, `SUPER_ADMIN`.

### Vista general

Lista de tarjetas, una por convenio. Cada tarjeta muestra:

- Thumbnail de la imagen
- Título interno (editable inline)
- Link opcional (editable inline)
- Checkbox de selección (indica si está publicado)
- Botón eliminar (⚠️ borra Storage + Firestore, pide confirmación)
- Handle de arrastre (icono ≡) — visible solo en desktop

### Controles globales (barra superior)

| Control                | Acción                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| **Agregar convenio**   | Abre file picker → sube a Storage → crea doc en Firestore con `publicado: false`                |
| **Seleccionar todo**   | Marca todos los checkboxes                                                                      |
| **Deseleccionar todo** | Desmarca todos los checkboxes                                                                   |
| **Publicar selección** | Batch update en Firestore: `publicado: true` para marcados, `publicado: false` para desmarcados |

### Comportamiento de selección

- Al abrir el panel, los checkboxes reflejan el estado actual de `publicado` en Firestore.
- La selección es local (no se guarda) hasta dar clic en "Publicar selección".
- Badge en el botón de publicar muestra cuántos cambios hay pendientes.

### Reordenamiento

- **Desktop:** drag & drop con `@dnd-kit/core`. Al soltar, guarda el nuevo orden en Firestore (batch update de campo `orden`).
- **Mobile:** botones ↑ ↓ en cada tarjeta. Cada clic actualiza el `orden` inmediatamente.

### Empty state

Si no hay convenios subidos: mensaje "Aún no hay convenios. Agrega el primero con el botón de arriba."

---

## Portal del trabajador

### Carrusel compacto en dashboard (`/dashboard`)

- Aparece **entre el card de saludo y la sección "Mis Posiciones Actuales"**.
- Solo se renderiza si hay al menos un convenio con `publicado: true`.
- Si no hay convenios publicados: la sección **no aparece** (sin empty state).
- Muestra una imagen a la vez con:
  - **Autoplay** cada 4 segundos (pausa si el usuario interactúa)
  - **Swipe** en touch
  - **Flechas** ← → visibles
  - **Dots** indicadores de posición
- Al hacer clic en la imagen → abre `link` en nueva pestaña (si existe). Si no hay link, no pasa nada.
- Botón "Ver todos →" en la esquina inferior derecha → navega a `/dashboard/convenios`.

### Página de convenios (`/dashboard/convenios`)

- Link en sidebar del trabajador (ícono: `Tag` o similar).
- **Si hay convenios publicados:** carrusel grande en la parte superior + grid de thumbnails abajo. Clic en cualquier imagen abre el link en nueva pestaña.
- **Si no hay convenios publicados:** empty state — "Próximamente convenios de descuento para ti."
- La página siempre es accesible desde el sidebar (no se oculta), para que el trabajador pueda entrar aunque no haya contenido aún.

---

## API

### `GET /api/convenios`

- Autenticación: requiere token de usuario activo (`requireUserRequest`).
- Devuelve convenios con `publicado: true`, ordenados por `orden` ascendente.
- Respuesta:

```typescript
{
  success: true,
  data: Array<{
    id: string
    imageUrl: string
    link?: string
    orden: number
  }>
}
```

No expone `titulo`, `creadoPor`, ni campos internos del admin.

### Admin

Las operaciones de admin (subir, reordenar, publicar, eliminar) usan Firebase Admin SDK directamente desde API routes protegidas con `requireAdminRequest()`, igual que el resto del panel.

---

## Flujo de publicación

```
Admin sube imagen
  → Storage: convenios/{ts}_{file}
  → Firestore: { publicado: false, orden: max+1, ... }
  → Aparece en panel con checkbox desmarcado

Admin selecciona imágenes + clic "Publicar selección"
  → Firestore batch: publicado=true para marcados, publicado=false para desmarcados
  → Trabajadores ven los cambios en su próxima carga

Admin elimina imagen
  → Confirmación modal
  → Delete Storage + Delete Firestore doc
  → Desaparece del panel y del portal
```

---

## Dependencias nuevas

| Paquete             | Uso                  | Tamaño aprox |
| ------------------- | -------------------- | ------------ |
| `@dnd-kit/core`     | Drag & drop en admin | ~30kb        |
| `@dnd-kit/sortable` | Sortable list helper | ~10kb        |

---

## Out of scope

- Fechas de vigencia por convenio (el admin controla visibilidad manualmente).
- Notificaciones push al publicar nuevos convenios.
- Analytics de clics por convenio.
- Múltiples imágenes por convenio / PDF adjunto.

---

## Archivos a crear/modificar

| Archivo                                       | Acción                                          |
| --------------------------------------------- | ----------------------------------------------- |
| `src/app/(main)/admin/convenios/page.tsx`     | Crear — panel CMS admin                         |
| `src/app/(main)/dashboard/convenios/page.tsx` | Crear — página trabajador                       |
| `src/app/(main)/dashboard/page.tsx`           | Modificar — agregar carrusel compacto           |
| `src/components/Sidebar.tsx`                  | Modificar — agregar link convenios (trabajador) |
| `src/components/admin/Sidebar.tsx` (o equiv)  | Modificar — agregar link admin                  |
| `src/app/api/convenios/route.ts`              | Crear — GET público autenticado                 |
| `src/app/api/admin/convenios/route.ts`        | Crear — CRUD admin                              |
| `src/app/api/admin/convenios/[id]/route.ts`   | Crear — update/delete por ID                    |
| `src/lib/firebase/convenios.ts`               | Crear — helpers Firestore/Storage               |
| `src/types/convenios.ts`                      | Crear — tipos TypeScript                        |
