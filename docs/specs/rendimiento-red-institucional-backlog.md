# Technical Backlog

## Objetivo

Ejecutar la spec [rendimiento-red-institucional.md](/Users/gerardoarroyo/Desktop/SNTSS/docs/specs/rendimiento-red-institucional.md) por fases pequeñas, reversibles y medibles.

## Fases

### Fase 1

- Instrumentar y clasificar vistas críticas por riesgo:
  - portal trabajador
  - consulta pública de posición
  - admin dashboard/chips
  - validaciones admin
  - tablas de bolsa
- Documentar por vista:
  - cantidad de requests cliente
  - dependencias de Firestore cliente
  - uso de realtime
  - scans o `getDocs()` completos
  - peso visual o render reactivo costoso
- Definir presupuesto técnico por vista:
  - requests máximos iniciales
  - tamaño objetivo de payload
  - si requiere cache, materialización o paginación

### Fase 2

- Portal trabajador:
  - consolidar `dashboard` y detalle para usar sólo payloads backend especializados
  - eliminar caminos normales que dependan de fallback costoso
  - revisar consulta pública para evitar scan por matrícula
- Bolsa de trabajo:
  - completar materialización donde aún se use cálculo on-demand
  - formalizar backfill para syncs oficiales previas
- Introducir cache corta para sync activa y lookups repetidos en servidor

### Fase 3

- Admin:
  - reemplazar contadores y chips basados en múltiples `getDocs()` por documentos resumen o endpoints agregados
  - revisar `Sidebar` y validaciones para sustituir `onSnapshot` por fetch puntual o polling controlado
  - mover listados de bolsa grandes a APIs con paginación y filtros server-side
- Reducir dependencias de `src/lib/firebase/*` cliente para vistas admin pesadas

### Fase 4

- Frontend performance:
  - identificar pantallas con blur, motion o render reactivo costoso
  - simplificar decoración en formularios y pantallas críticas de red institucional
  - revisar tablas con muchos nodos montados y aplicar paginación/virtualización sólo donde haga falta
- Validar experiencia bajo throttling alto y hardware limitado

### Fase 5

- Operación y cierre:
  - preparar checklist de publicación/materialización para cortes oficiales
  - medir reducción de lecturas Firestore y tiempo percibido por vista
  - decidir qué fallbacks legacy pueden retirarse
  - registrar decisiones finales en la spec o nota de seguimiento

## Validaciones por fase

- fase 1:
  - inventario claro de vistas de riesgo y patrón de lectura actual
  - lista priorizada por impacto
- fase 2:
  - `npm run typecheck`
  - `npm run lint`
  - prueba manual de portal trabajador y consulta pública
  - comparación de lecturas antes/después
- fase 3:
  - validación manual de dashboard admin, validaciones y tablas
  - confirmar que no se cargan colecciones completas en cliente para casos normales
- fase 4:
  - validar que inputs y navegación no presenten lag visible
  - revisar experiencia con throttling alto
- fase 5:
  - evidencia de mejora operativa
  - pendientes explícitos y no mezclados

## Riesgos abiertos

- Persistencia de fallbacks caros que vuelvan a activarse en syncs sin materialización.
- Mezclar optimización de red con rediseños UI amplios en la misma fase.
- Dejar listeners realtime en admin por comodidad y no por necesidad.
- Mantener funciones cliente utilitarias que sigan siendo usadas por error en pantallas críticas.

## Cierre esperado

- Portal trabajador y consulta pública con caminos de lectura baratos y predecibles.
- Admin con tablas y métricas servidas por backend paginado o resúmenes materializados.
- Menos dependencia de Firestore cliente en redes institucionales lentas.
- Plan operativo claro para materialización y medición.
- Sin mezclar este frente con parsing, reglas de negocio nuevas o cambios visuales grandes no relacionados.
