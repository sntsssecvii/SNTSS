# Analíticas de Bolsa de Trabajo — Diseño

## Contexto

La bolsa de trabajo maneja 8 tipos de listados sindicales (Nuevo Ingreso, Cambios de Turno/Adscripción, Cambios de Área, Cambios de Rama, Ampliaciones de Jornada, Cambios de Tipo de Plaza, Cambios de Residencia Destino/Origen). Cada quincena se cargan PDFs que generan registros individuales en Firestore con campos ricos: zona, categoría, tipo de contratación, posición en ranking, turno, adscripción, etc.

**Objetivo:** Dashboard analítico estratégico — no operacional. Gaby (BOLSA) y los admins ven patrones y tendencias por listado, no el estado de las cargas.

**¿Es big data?** No técnicamente (volumen ~2,000–4,000 registros/quincena). Es "datos significativos con valor analítico real" — perfectamente manejable con agregaciones en memoria en el API route.

---

## Decisiones de diseño

| Decisión                  | Elección                                | Razón                                                                                             |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Ubicación                 | Tab dentro de `/admin/bolsa-de-trabajo` | Mismo contexto de datos; deja espacio para futuras analíticas de escalafón en `/admin/analiticas` |
| Navegación entre listados | Cards overview + acordeón inline        | Los listados vacíos se muestran en gris; drill-down sin cambio de ruta                            |
| Granularidad de tiempo    | Por quincena                            | Es el período natural del sistema                                                                 |
| Librería de gráficas      | Recharts                                | Popular, TypeScript nativo, sin config extra, tree-shakeable                                      |
| Fetching                  | API route por quincena + tipo           | Agrega en memoria server-side; simple y suficiente para el volumen                                |

---

## Arquitectura

### Rutas y archivos

```
src/app/(main)/admin/bolsa-de-trabajo/page.tsx     MODIFICAR — agregar tabs
src/components/admin/bolsa/AnaliticasBolsa.tsx      CREAR — componente raíz analytics
src/components/admin/bolsa/analiticas/
  NuevoIngreso.tsx                                  CREAR
  CambiosTurnoAdscripcion.tsx                       CREAR
  CambiosArea.tsx                                   CREAR
  CambiosRama.tsx                                   CREAR
  AmpliacionesJornada.tsx                           CREAR
  CambiosTipoPlaza.tsx                              CREAR
  CambiosResidencia.tsx                             CREAR — reutilizable para destino/origen
src/app/api/admin/analiticas/bolsa/route.ts         CREAR — GET ?syncId=X&tipo=Y
```

### Instalación necesaria

```bash
npm install recharts
```

---

## UI — Vista de Analíticas

### Header de la página (modificado)

```
Bolsa de Trabajo                    [+ Cargar Quincena]
[ Quincenas ]  [ Analíticas ]
```

### Tab de Analíticas

```
Analíticas de Bolsa de Trabajo
Quincena: [ 1ª quincena / Abril 2026 ▾ ]    ← selector, default = más reciente publicada

┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Nuevo       │ │ Cambios     │ │ Cambios     │ │ Cambios     │
│ Ingreso     │ │ Turno/Adsc. │ │ Área        │ │ Rama        │
│  47 aspir.  │ │ 23 solic.   │ │ — sin datos │ │  8 solic.   │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘

┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Ampliación  │ │ Cambio Tipo │ │ Residencia  │ │ Residencia  │
│ Jornada     │ │ Plaza       │ │ Destino     │ │ Origen      │
│  5 solic.   │ │  3 solic.   │ │  6 solic.   │ │  4 solic.   │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘

▼ [Nuevo Ingreso expandido — acordeón inline]
┌──────────────────────────────────────────────────────────────┐
│ KPIs: Total | Con interinato | Eventuales | Base              │
│ [Donut: tipo contratación] [Bar: top categorías]              │
│ [Bar: por zona]            [Histograma: distribución rangos]  │
└──────────────────────────────────────────────────────────────┘
```

Cards vacíos (sin data esa quincena): gris, no clickeables.

---

## Analíticas por listado

### NUEVO_INGRESO

- **KPIs:** Total aspirantes · Con interinato (`tipoContratacion = '8'`) · Eventuales · Base
- **Donut:** Distribución por tipo de contratación
- **Bar horizontal:** Top 10 categorías por número de aspirantes
- **Bar:** Distribución por zona
- **Histograma:** Rangos de posición en ranking (1–10, 11–25, 26–50, 51–100, 100+)
- **Stat:** Promedio de días laborados (si disponible)

### CAMBIOS_TURNO_ADSCRIPCION

- **KPIs:** Total solicitudes · Cambios de turno · Cambios de adscripción · Ambos
- **Grouped bar:** De turno actual → turno nuevo (MAT/VES/NOC)
- **Bar horizontal:** Top 10 adscripciones más solicitadas como destino
- **Bar:** Por categoría

### CAMBIOS_AREA

- **KPIs:** Total solicitudes
- **Bar horizontal:** Top 10 adscripciones destino más frecuentes
- **Bar horizontal:** Top 10 adscripciones origen más frecuentes
- **Bar:** Por zona

### CAMBIOS_RAMA

- **KPIs:** Total solicitudes
- **Bar horizontal:** Ramas más solicitadas
- **Bar:** Por zona y categoría

### AMPLIACIONES_JORNADA

- **KPIs:** Total solicitudes
- **Grouped bar:** Jornada actual → jornada nueva
- **Bar:** Por categoría y zona

### CAMBIOS_TIPO_PLAZA

- **KPIs:** Total solicitudes
- **Grouped bar:** Tipo plaza anterior → tipo nuevo
- **Bar:** Por categoría

### CAMBIOS_RESIDENCIA_DESTINO y CAMBIOS_RESIDENCIA_ORIGEN

- Mismo componente `CambiosResidencia.tsx`, prop `modo: 'destino' | 'origen'`
- **KPIs:** Total solicitudes
- **Bar horizontal:** Top destinos/orígenes más frecuentes
- **Bar:** Por zona y categoría

---

## API Endpoint

```
GET /api/admin/analiticas/bolsa?syncId=X&tipo=Y
```

- Requiere `requireAdminRequest` (ADMIN, SUPER_ADMIN, BOLSA)
- Obtiene todos los documentos del `syncId`
- Encuentra el documento de tipo `Y`
- Lee sus registros (subcollección)
- Agrega en memoria y devuelve estructura lista para las gráficas
- Si no hay documento de ese tipo para el syncId → `{ data: null }`

### Respuesta por tipo

Para `NUEVO_INGRESO`:

```json
{
  "data": {
    "total": 47,
    "porTipoContratacion": { "8": 12, "2": 20, "1": 15 },
    "porCategoria": [{ "categoria": "ENF GRAL", "total": 15 }, ...],
    "porZona": [{ "zona": "01", "total": 22 }, ...],
    "rangosRanking": { "1-10": 10, "11-25": 15, "26-50": 12, "51-100": 8, "100+": 2 },
    "promedioDiasLaborados": 487
  }
}
```

Estructura análoga para los demás tipos.

---

## Acceso por rol

| Rol         | Acceso                             |
| ----------- | ---------------------------------- |
| BOLSA       | ✅ Tab visible, todos los listados |
| ADMIN       | ✅ Tab visible, todos los listados |
| SUPER_ADMIN | ✅ Tab visible, todos los listados |
| USER        | ❌ No aplica                       |

El endpoint usa `requireAdminRequest` que ya incluye BOLSA.

---

## Pendiente para la sesión de implementación

- [ ] Confirmar campos exactos de `tipoContratacion` en registros reales (usar Firebase MCP para inspeccionar un doc de NUEVO_INGRESO)
- [ ] Confirmar si `registros` subcollection tiene campo `syncId` o se filtra solo por documentoId
- [ ] Decidir si el accordion permite expandir múltiples listados simultáneamente o solo uno (sugerencia: solo uno, más limpio)
