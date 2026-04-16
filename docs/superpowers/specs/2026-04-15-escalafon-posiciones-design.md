# Escalafón — Motor de Posiciones por Zona

**Fecha:** 2026-04-15
**Módulo:** Escalafón (Fase 2)
**Prerrequisito:** MVP de ingesta (Fase 1) completado

---

## Objetivo

Calcular y materializar la posición efectiva de cada aspirante por zona, de forma que la encargada pueda ver — en la tabla del listado — quién es el #1 para una plaza en Tijuana, Mexicali, Tecate, etc., sin trabajo manual.

---

## Contexto

El `LUG.ESC.` que viene del SIAP es el ranking global basado en calificación + antigüedad. No es la posición real para una plaza específica. La posición efectiva por zona depende de las preferencias declaradas por cada aspirante:

- **Incondicional (zona):** el aspirante acepta cualquier zona → compite en todas
- **Condicionado (zona):** el aspirante declaró zona(s) específica(s) → solo compite en esas

El motor toma el listado ya parseado, calcula posiciones por zona y las materializa en Firestore al momento de subir el PDF.

---

## Algoritmo

Al procesar el PDF (POST `/api/escalafon/procesar`), después del parsing y antes de guardar en Firestore:

1. **Extraer zonas únicas** — recorrer todas las preferencias de todos los aspirantes, recopilar valores de `zonaSolicitada` distintos de `"INCONDICIONAL"`
2. **Para cada zona Z**, identificar aspirantes calificados:
   - Aspirantes con alguna preferencia donde `zonaSolicitada === "INCONDICIONAL"`
   - Aspirantes con alguna preferencia donde `zonaSolicitada` coincide con Z
3. **Ordenar calificados por `lugar`** (LUG.ESC. ascendente — ya viene ordenado del SIAP)
4. **Asignar posición 1, 2, 3...** dentro de los calificados para esa zona
5. **Construir mapa** `posicionesPorZona` para cada aspirante

PEI y Activo compiten en la misma numeración. La columna `EST` en la tabla ya permite distinguirlos visualmente.

---

## Cambios en el modelo de datos

### `escalafon_aspirantes` — campo nuevo

```ts
posicionesPorZona: Record<string, number>;
// Ejemplo:
// { "7 TIJUANA": 3, "2 MEXICALI": 1, "6 TECATE": 5 }
// Incondicional → aparece en todas las zonas del listado
// Condicionado  → solo en las zonas que solicitó
```

### `escalafon_listados` — campo nuevo

```ts
zonas: string[]
// Ejemplo: ["7 TIJUANA", "2 MEXICALI", "6 TECATE", "4 SAN LUIS"]
// Todas las zonas únicas del listado (para poblar el filtro en UI sin leer aspirantes)
```

No se crean nuevas colecciones.

---

## Código nuevo

### `src/lib/escalafon/position-engine.ts` (nuevo archivo)

Función pura que recibe aspirantes y retorna aspirantes con `posicionesPorZona` calculado:

```ts
export function calcularPosicionesPorZona(
  aspirantes: Omit<EscalafonAspirante, "id" | "listadoId">[],
): {
  aspirantesConPosicion: Omit<EscalafonAspirante, "id" | "listadoId">[];
  zonas: string[];
};
```

- Sin side effects, sin llamadas externas — pura lógica de negocio
- Testeable de forma aislada
- Llamada desde el API route `/api/escalafon/procesar` antes de `guardarListado()`

### `src/lib/escalafon/__tests__/position-engine.test.ts` (nuevo archivo)

Tests unitarios con datos sintéticos: verificar conteos por zona, que incondicionales aparecen en todas, que condicionados solo en las suyas.

---

## Cambios en archivos existentes

### `src/types/escalafon.ts`

Agregar `posicionesPorZona` y actualizar `EscalafonListado` con `zonas`:

```ts
export interface EscalafonAspirante {
  // ... campos existentes ...
  posicionesPorZona: Record<string, number>; // nuevo
}

export interface EscalafonListado {
  // ... campos existentes ...
  zonas: string[]; // nuevo
}
```

### `src/lib/firebase/escalafon.ts`

`guardarListado()` recibe el campo `zonas` en el objeto listado — sin cambio de firma, solo se pasa el nuevo campo.

### `src/app/api/escalafon/procesar/route.ts`

Insertar llamada a `calcularPosicionesPorZona()` entre el parsing y el `guardarListado()`.

### `src/app/(main)/admin/escalafon/[listadoId]/page.tsx`

Agregar:

1. **Dropdown de zona** — poblado con `listado.zonas`, opción "Todas" por defecto
2. **Filtrado de aspirantes** — cuando hay zona activa, solo mostrar los que tienen `posicionesPorZona[zonaActiva]` definido
3. **Columna "Pos."** — muestra `posicionesPorZona[zonaActiva]` cuando hay zona seleccionada, `lugar` (LUG.ESC.) cuando es "Todas"
4. **Ordenar por posición** cuando hay zona activa

---

## Restricciones

- NO tocar ningún archivo de bolsa de trabajo
- Solo modificaciones aditivas en `roles.ts` (no aplica aquí — no hay permisos nuevos)
- Los campos nuevos en Firestore son aditivos — los listados ya subidos simplemente no tendrán `posicionesPorZona` (mostrar LUG.ESC. como fallback)

---

## Criterios de aceptación

- [ ] Al subir un PDF, cada aspirante tiene `posicionesPorZona` calculado en Firestore
- [ ] El listado tiene `zonas[]` con todas las zonas únicas
- [ ] Un aspirante INCONDICIONAL aparece en todas las zonas con posición válida
- [ ] Un aspirante condicionado aparece solo en sus zonas solicitadas
- [ ] La tabla filtra correctamente al seleccionar zona
- [ ] Los números de posición son consecutivos (1, 2, 3...) sin huecos por zona
- [ ] Tests unitarios del motor pasan con los 3 PDFs de muestra

---

## Fuera de alcance

- Fecha de generación de plaza vacante (se agrega en fase posterior)
- Colas a-g del Art. 27 (cambios de turno, área, adscripción, interinos)
- Notificación al trabajador
- Dictamen / nominación formal
