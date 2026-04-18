# Spec: Rediseño Mobile-First del Flujo de Registro

**Fecha:** 2026-04-18
**Estado:** Aprobado
**Alcance:** `RegistroForm`, `StepInfo`, `StepDocs`, `StepSuccess`, `registro/page.tsx`

---

## Objetivo

Rediseñar el flujo de registro de trabajador para que sea premium, usable en móvil, completamente light (sin dark mode), y fluido. El diseño actual tiene clases dark mode, UI no adaptada a pantallas pequeñas, y poca jerarquía visual.

---

## Dirección Visual

**Estilo:** Bold branded — identidad institucional de SNTSS con rojo como color principal.

### Hero compacto (~64px)

- Gradiente rojo: `#CC1B1B → #7F0000` (dirección 135°)
- Altura fija ~64px — no crece ni encoge entre pasos
- Contenido: label "SNTSS · Sección VII" (blanco 60% opacidad), título del paso actual (blanco bold), barras de progreso delgadas (blancas, una por paso)
- Presente en ambos pasos — da identidad sin sacrificar espacio de contenido

### Paleta

- Fondo body: `#FFFFFF`
- Fondo inputs: `#F8FAFC`
- Bordes: `#E2E8F0`
- Texto primario: `#111827` / `#0F172A`
- Texto secundario: `#6B7280` / `#64748B`
- Acento: `#CC1B1B` (rojo SNTSS)
- Éxito: `#10B981` / `#059669`
- Error: `#EF4444`

### Tipografía y espaciado

- Font: `system-ui` (heredado del proyecto)
- Títulos de sección: 16-18px, weight 700-800
- Labels de campo: 12px, weight 600, `#64748B`
- Inputs: 15px, height 48px (touch-friendly), border-radius 10px
- Botón primario: height 48px, border-radius 12px, font-weight 700

### Sin dark mode

- Eliminar todas las clases `dark:` de los 4 componentes
- La página wrapper (`registro/page.tsx`) mantiene `bg-slate-50`

---

## Componentes

### RegistroForm

- Wrapper con hero compacto fijo arriba
- Anima la transición entre pasos con Framer Motion `x` slide (paso 1 sale por izquierda, paso 2 entra por derecha)
- El hero permanece estático durante la transición — solo cambia título y barras con `AnimatePresence`
- Sin scroll en el wrapper — cada paso maneja su propio scroll interno si es necesario

### StepInfo — Paso 1: Datos personales

**Campos (en orden):**

1. Nombre(s)
2. Apellido Paterno
3. Apellido Materno
4. Matrícula IMSS
5. Correo electrónico
6. Contraseña + confirmación

**Detalles UX:**

- Labels flotantes o labels arriba del campo (no placeholder-only)
- Campo activo: borde `#CC1B1B`, fondo `#FFF5F5`
- Error inline debajo del campo en rojo
- Contraseña: botón show/hide, barra de fortaleza (se conserva lógica existente)
- Confirmación de contraseña: validación en tiempo real con ✓/✗ visual
- Botón "Continuar →": ancho completo, 48px, rojo, fijo en la parte inferior (sticky bottom) con padding seguro para iOS notch

### StepDocs — Paso 2: Documentos requeridos

**Layout:** Lista vertical de 3 tarjetas numeradas.

**Estructura de cada tarjeta (estado vacío):**

```
┌─────────────────────────────────────────┐
│  [1]  Identificación Oficial (INE/IFE)  │
│       JPG, PNG, HEIC o PDF             │
│  [📷 Escanear con cámara] [📁 Archivo]  │
└─────────────────────────────────────────┘
```

- Número: círculo rojo 24px, blanco bold
- Nombre del doc: 14px bold
- Hint de formatos: 12px gris
- Botón "Escanear": primario rojo, ancho flexible
- Botón "Archivo": outline gris, ancho flexible
- Los dos botones en la misma fila, ancho igual

**Estado con archivo subido:**

```
┌─────────────────────────────────────────┐
│  [✓]  Identificación Oficial (INE/IFE)  │
│       ine_frente.jpg · 0.8 MB          │
│                              [Cambiar]  │
└─────────────────────────────────────────┘
```

- Borde verde `#10B981`, fondo `#F0FDF4`
- Número cambia a ✓ verde
- Muestra nombre del archivo y tamaño
- Botón "Cambiar" ghost pequeño (no rojo, no distrae)

**Estado procesando (compresión/conversión):**

- Spinner rojo en lugar del ✓
- Texto "Procesando..."
- Botones deshabilitados

**Botón "Finalizar registro":** ancho completo, 48px, rojo, sticky bottom — deshabilitado (gris) hasta que los 3 docs tengan archivo.

**DocumentScannerSheet:** sin cambios visuales — ya es fullscreen negro, es correcto para el scanner.

### StepSuccess — Paso 3: Éxito

- Fondo blanco, centrado verticalmente
- Animación: círculo verde con checkmark (Framer Motion scale 0→1 + spring)
- Título: "¡Registro enviado!"
- Subtítulo: "Tu solicitud está en revisión. Recibirás un correo cuando sea aprobada."
- Timeline del proceso (se conserva componente existente)
- Botón "Ir al inicio de sesión": rojo, ancho completo

---

## Flujo de estados

```
StepInfo (valid) → tap "Continuar" → StepDocs
StepDocs (3 docs listos) → tap "Finalizar" → loading → StepSuccess
StepSuccess → tap "Ir al login" → /login
```

**Manejo de errores:**

- Error de red/API en submit de docs: mensaje inline debajo del botón "Finalizar", no toast
- Error de cámara/OpenCV: ya manejado en DocumentScannerSheet
- Error de validación de campo: inline debajo del campo, aparece en blur o al intentar continuar

---

## Animaciones (Framer Motion)

| Elemento                   | Animación                                                      |
| -------------------------- | -------------------------------------------------------------- |
| Transición paso 1→2        | Slide X: paso 1 sale -40px opacity 0, paso 2 entra desde +40px |
| Tarjeta doc vacío→cargado  | Scale 0.98→1 + border-color transition                         |
| Botón Finalizar habilitado | opacity 0.4→1 + scale 0.99→1                                   |
| Checkmark éxito            | Scale 0→1.1→1 con spring                                       |
| Error inline               | y 4→0, opacity 0→1                                             |

---

## Restricciones técnicas

- Sin cambios en la lógica de validación, Firebase, o submit — solo UI
- Conservar `DocumentScannerSheet` intacto (fullscreen camera)
- Conservar `optimizeImage` y todo el pipeline de archivos
- `registro/page.tsx` no se toca (ya tiene el layout correcto)
- Compatibilidad iOS Safari — sin `backdrop-filter` en campos, safe-area-inset para sticky buttons

---

## Archivos a modificar

1. `src/components/registro/RegistroForm.tsx` — hero compacto, slide transition, eliminar dark:
2. `src/components/registro/StepInfo.tsx` — inputs touch-friendly, sticky CTA, eliminar dark:
3. `src/components/registro/StepDocs.tsx` — tarjetas numeradas con acciones visibles, eliminar dark:
4. `src/components/registro/StepSuccess.tsx` — limpiar dark:, ajustar spacing mobile

**No se crean archivos nuevos.**
