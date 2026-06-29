# Handoff: Revisión de posiciones con Gaby — 2026-06-29

## Contexto

Se subieron los 8 listados de 1Q Julio 2026 al sistema (ocultos del portal).
Al comparar posiciones 1Q Jun vs 2Q Jun se detectaron problemas que se fueron resolviendo en esta sesión.

## Bugs corregidos (ya en rama `feat/movimientos-tab-rediseno`)

### 1. syncAnteriorId no se devolvía en el endpoint

**Archivo:** `src/app/api/admin/bolsa/quincenas/[syncId]/route.ts`
**Problema:** `convertirSincronizacion()` no incluía `syncAnteriorId`, entonces MovimientosTab nunca cargaba posiciones anteriores. Todas las columnas POS. ANT. y DELTA mostraban "—".
**Fix:** Agregar `syncAnteriorId: data.syncAnteriorId ?? null` + fallback para buscar la sync `esFuenteVerdad`.

### 2. Key collision en regression-analyzer — falsos positivos masivos

**Archivos:** `src/lib/bolsa-de-trabajo/regression-analyzer.ts`, `src/components/bolsa/MovimientosTab.tsx`
**Problema:** La key del lookup usaba `tipoDocumento::matricula`. Un trabajador con múltiples posiciones en el mismo tipo (ej. CAMBIOS_RAMA con 2 categorías diferentes) sobrescribía en el Map y comparaba posiciones de categorías distintas.
**Ejemplo real:** DORANTES CORIA (97023847) mostraba delta +71 (pos 3→74). En realidad tenía pos 3→3 en Tecate/ENF GENERAL y pos 75→74 en Tijuana/ENF GRAL CLINICA. El Map guardó pos=3 (Tecate) y comparó contra pos=74 (Tijuana).
**Fix progresivo:**

- Primer intento: key `tipo::matricula::categoria::zona` → bajó de 634 a 595 falsos positivos
- Fix definitivo: key usa `grupoComparable` completo serializado (incluye zona, categoría, subcategoría, turno, adscripción, jornada) → bajó a 106 retrocesos reales

### 3. Rediseño de MovimientosTab

**Archivo:** `src/components/bolsa/MovimientosTab.tsx`
**Cambios:**

- Alerta global roja/verde/amarilla según retrocesos
- Pestañas por tipo de listado con indicador de retrocesos
- Cards de stats clickeables (avanzaron/retrocedieron/sin cambio)
- Filas con fondo rojo para retrocesos
- Columna de grupo visible

## Hallazgo pendiente: posiciones por zona vs incondicionales

### El problema

CAMBIOS_RAMA mezcla trabajadores de zona incondicional con los de zona específica en `selectComparableRecords`. Esto hace que la posición en el portal NO coincida con el PDF del Instituto.

**Caso concreto — GUZMAN SANCHEZ NERSSY YANNET (96020083):**

- En el PDF: Zona 5-Tecate / LABORATORISTA → es la UNICA, posición 1
- En el sistema: posición 5, porque hay 4 LABORATORISTAS incondicionales por delante
- Quincena pasada era posición 4 → ahora 5 (entró un incondicional nuevo)

### Confirmación de Gaby

Gaby confirmó por WhatsApp (28/jun/2026 21:09):

> "Porque si esta mal como lo lee. Si le debe dar su lugar por zona"

**Decisión: Opción A — la posición debe ser por zona, como aparece en el PDF.**

### Fix necesario (NO aplicado aún)

En `src/lib/bolsa-de-trabajo/position-strategies.ts`, la estrategia `cambiosRamaStrategy`:

```typescript
// ACTUAL (mezcla incondicionales):
selectComparableRecords(records, target) {
    const mismaCategoria = records.filter((record) =>
      record.categoria === target.categoria &&
      (record.subcategoria || '') === (target.subcategoria || '')
    )
    if (isZonaIncondicional(target.zona)) {
      return mismaCategoria.filter((record) => isZonaIncondicional(record.zona))
    }
    return mismaCategoria.filter((record) =>
      record.zona === target.zona || isZonaIncondicional(record.zona)
    )
},
applyPriorityRules(records, target) {
    if (isZonaIncondicional(target.zona)) return records
    const prioritarios = records.filter((record) => isZonaIncondicional(record.zona))
    const mismaZona = records.filter((record) => record.zona === target.zona)
    return [...prioritarios, ...mismaZona]
},
```

Debe cambiar a solo filtrar por misma zona (sin mezclar incondicionales para zonas específicas). Verificar con Gaby en la reunión antes de aplicar.

**IMPORTANTE:** Este cambio afecta `npm run positions:test` — el test "CAMBIOS_RAMA prioriza incondicional sobre la zona especifica" deberá actualizarse.

## Hallazgo: el Instituto reordena por días laborados

### Descubrimiento

En NUEVO_INGRESO, los retrocesos NO son por gente nueva — el total del grupo no cambia. El Instituto reordena el PDF por días laborados (antigüedad) cada quincena.

**Caso concreto — Ensenada / ENF GRAL CLINICA:**

HERRERA/CERVANTES/MARISOL (96020623):

- 1Q Jun: numeroProg 21, diasLaborados 230
- 2Q Jun: numeroProg 19, diasLaborados 244

AGUILAR/MARIN/MARIA FERNANDA (96020048):

- 1Q Jun: numeroProg 19, diasLaborados 231
- 2Q Jun: numeroProg 20, diasLaborados 242

En 1Q Jun, AGUILAR tenía más días (231 > 230) → estaba arriba.
En 2Q Jun, HERRERA tiene más días (244 > 242) → pasó arriba.

**Conclusión:** El Instituto ordena por antigüedad, no es FIFO. Los 37 retrocesos de Nuevo Ingreso y los 20 de Ampliaciones son reordenamientos legítimos del Instituto. El sistema refleja fielmente el PDF.

## Resumen de los 106 retrocesos reales (2Q Jun vs 1Q Jun)

| Tipo          | Retrocesos | Causa                                                      |
| ------------- | ---------- | ---------------------------------------------------------- |
| Rama          | 48         | Incondicionales mezclados (FIX PENDIENTE) + reordenamiento |
| Nuevo Ingreso | 37         | Reordenamiento por días laborados                          |
| Ampliaciones  | 20         | Reordenamiento por días laborados                          |
| Tipo Plaza    | 1          | Reordenamiento por días laborados                          |

## Syncs en Firestore

- 1Q Junio 2026: `U2YDS8Qd0cV7Oks8yUsU` (esFuenteVerdad: false)
- 2Q Junio 2026: `wzER70ILmJw2c8leGZuA` (esFuenteVerdad: true, oculto: true)
- 1Q Julio 2026: pendiente de publicar (oculto)

## Agenda reunión con Gaby (29 junio)

1. Mostrarle el caso de GUZMAN SANCHEZ en Cambios de Rama → confirmar que posición debe ser por zona
2. Aplicar fix de `selectComparableRecords` si confirma
3. Re-materializar posiciones de 2Q Jun y 1Q Jul con el fix
4. Verificar que los retrocesos de Rama bajan significativamente
5. Revisar juntos los retrocesos restantes (Nuevo Ingreso / Ampliaciones) → explicar que es reordenamiento del Instituto
6. Si todo está bien, hacer visibles los listados de julio en el portal

## Rama de trabajo

`feat/movimientos-tab-rediseno` — 3 commits pusheados, PR pendiente de crear (gh auth es zentry-app, no sntsssecvii).

Link para crear PR: https://github.com/sntsssecvii/SNTSS/pull/new/feat/movimientos-tab-rediseno
