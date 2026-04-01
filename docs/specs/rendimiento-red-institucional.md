# Feature Spec

## Objetivo

Reducir el tiempo de carga percibido y la sensibilidad a una red institucional lenta en las vistas críticas de SNTSS, moviendo trabajo del cliente al servidor y minimizando viajes de red, lecturas de Firestore y render costoso en frontend.

## Problema actual

- En redes institucionales de baja calidad, varias pantallas pueden tardar decenas de segundos en cargar o responder.
- Algunas vistas siguen dependiendo de múltiples lecturas, escaneos de colecciones, realtime innecesario o render pesado en cliente.
- El sistema hoy mezcla pantallas ya optimizadas con otras que aún dependen de Firestore cliente o de cálculo on-demand.

## Alcance

- Incluido:
  - auditoría técnica de rutas públicas, portal trabajador y admin con mayor riesgo en red lenta
  - definición de arquitectura objetivo para lecturas en red institucional
  - plan por fases para BFF, materialización, paginación y reducción de realtime
  - criterios de aceptación medibles para vistas críticas
- Fuera de alcance:
  - migración inmediata de todas las pantallas en esta fase documental
  - cambio de proveedor de base de datos
  - rediseño visual completo del portal o admin

## Usuarios afectados

- Trabajadores que consultan posiciones y trámites desde red institucional.
- Administradores que usan dashboards, validaciones y tablas de bolsa.
- Soporte técnico, porque una red lenta amplifica cualquier patrón ineficiente de lectura o render.

## Reglas o comportamiento esperado

- Las pantallas críticas deben cargar con uno o muy pocos requests desde el navegador.
- La UI no debe reconstruir tablas o posiciones a partir de múltiples consultas directas a Firestore cliente.
- Los datos oficiales, rankings y resúmenes deben servirse desde rutas backend propias o documentos materializados.
- Las tablas deben paginarse y filtrar del lado servidor.
- El realtime sólo debe mantenerse donde el valor operativo sea real y justificable.
- En una red lenta, el sistema debe degradar bien: primero mostrar estructura útil, luego datos esenciales, y evitar bloqueo por cargas masivas.

## Riesgos

- Riesgo: seguir usando Firestore cliente en pantallas de alto tráfico o tablas grandes.
  - Impacto: tiempos de carga extremos, múltiples RTT, mala experiencia en red institucional.
  - Mitigación: BFF en `src/app/api/`, payloads listos para UI y materialización de lecturas repetidas.
- Riesgo: depender de `onSnapshot` en admin para contadores o listados no críticos.
  - Impacto: conexiones persistentes costosas y comportamiento inestable en red restringida.
  - Mitigación: polling puntual, fetch bajo demanda o métricas materializadas.
- Riesgo: recalcular posiciones o métricas en request/cliente.
  - Impacto: más CPU, más lecturas, más latencia.
  - Mitigación: materialización y documentos resumen.
- Riesgo: mantener layouts pesados con blur/animación en pantallas donde el hardware o navegador institucional es limitado.
  - Impacto: input lag y paint lento.
  - Mitigación: reducir motion, blur y render reactivo en formularios y tablas críticas.

## Criterios de aceptacion

- Portal trabajador:
  - `dashboard` y detalle de trámite deben resolverse desde un solo payload por vista o desde un payload principal más un detalle puntual controlado.
  - no deben hacer scans de subcolecciones completas por navegación normal.
- Consulta pública y posiciones:
  - deben evitar escaneo completo de documentos por matrícula en el camino normal.
  - deben usar lookup materializado o endpoint resumido.
- Admin:
  - tablas grandes deben paginarse y filtrar en backend.
  - contadores y chips no deben depender de múltiples `getDocs()` completos ni de listeners permanentes salvo necesidad explícita.
- Frontend:
  - las pantallas críticas no deben presentar input lag visible por efectos decorativos o validaciones pesadas en tiempo real.
- Operación:
  - debe existir una estrategia explícita de backfill/materialización para sincronizaciones ya publicadas.

## Validacion

- Pruebas técnicas:
  - `npm run typecheck`
  - `npm run lint`
  - validaciones dirigidas por endpoint o flujo cuando cada fase entre a implementación
- Validación manual:
  - abrir portal trabajador en red lenta o throttling alto
  - medir apertura de dashboard, detalle de trámite, consulta pública y admin
  - verificar que filtros y paginación no bajen toda la colección
- Datos reales:
  - comparar consumo de lecturas Firestore antes y después por vista crítica
  - medir si la sync oficial publicada responde desde materializados

## Notas

- Hallazgos principales del audit actual:
  - [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/trabajador/posicion/route.ts) sigue haciendo búsqueda por sync activa, scan de documentos y lectura completa de subcolección para calcular posición pública.
  - [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/trabajador/mis-tramites/route.ts) y [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/trabajador/mis-tramites/[documentoId]/route.ts) ya mejoraron con materialización, pero aún conservan fallback costoso si no hay materializados válidos.
  - [analytics.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/lib/firebase/analytics.ts) usa múltiples `getDocs()` completos y ciclos por mes/estado; es de alto riesgo en red lenta.
  - [Sidebar.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/components/Sidebar.tsx), [AdminValidacion.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/components/admin/AdminValidacion.tsx) y [validaciones/page.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/app/(main)/admin/validaciones/page.tsx) mantienen `onSnapshot` para contadores/listados.
  - [bolsa-de-trabajo.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/lib/firebase/bolsa-de-trabajo.ts) todavía expone varias lecturas cliente con filtros y listados que pueden crecer mal.
  - El registro ya mostró un caso real donde efectos visuales y validación en tiempo real degradaban escritura; esto confirma que la optimización debe cubrir también render costoso, no sólo Firestore.
- Arquitectura objetivo recomendada:
  - cliente con pocos requests
  - rutas backend como BFF
  - documentos resumen/materializados para dashboards y tablas
  - paginación por cursor
  - filtros server-side
  - realtime sólo donde aporte valor operativo real

## Clasificacion inicial de vistas y rutas

### Prioridad alta

- [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/trabajador/posicion/route.ts)
  - riesgo: muy alto
  - patrón actual: busca sync activa, escanea documentos de la sync, hace búsquedas por matrícula y carga subcolección completa para cálculo
  - motivo: consulta pública sensible a latencia y con patrón de scans
- [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/trabajador/mis-tramites/route.ts)
  - riesgo: alto
  - patrón actual: ya usa materializados, pero conserva fallback caro que escanea documentos y subcolecciones si faltan lookups
  - motivo: portal trabajador es de alto impacto y uso frecuente
- [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/trabajador/mis-tramites/[documentoId]/route.ts)
  - riesgo: alto
  - patrón actual: lookup materializado con fallback costoso por documento
  - motivo: detalle puntual del trabajador y dependencia de materialización consistente
- [analytics.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/lib/firebase/analytics.ts)
  - riesgo: muy alto
  - patrón actual: múltiples `getDocs()` completos, ciclos por mes/estado y conteos reconstruidos en cliente
  - motivo: dashboards y métricas pueden explotar latencia y lecturas
- [DashboardChips.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/components/admin/DashboardChips.tsx)
  - riesgo: alto
  - patrón actual: consultas cliente directas a Firestore para conteos al entrar al admin
  - motivo: admin landing debe cargar rápido y hoy depende de lecturas remotas

### Prioridad media

- [Sidebar.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/components/Sidebar.tsx)
  - riesgo: medio-alto
  - patrón actual: `onSnapshot` para pendientes
  - motivo: listener persistente en navegación global
- [AdminValidacion.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/components/admin/AdminValidacion.tsx)
  - riesgo: medio-alto
  - patrón actual: `onSnapshot` y filtros cliente sobre colección de usuarios
  - motivo: pantalla crítica de admin, pero no tan frecuente como dashboard trabajador
- [validaciones/page.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/app/(main)/admin/validaciones/page.tsx)
  - riesgo: medio-alto
  - patrón actual: varios listeners para contadores por estado
  - motivo: puede degradar mucho en red institucional con conexiones largas
- [bolsa-de-trabajo.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/lib/firebase/bolsa-de-trabajo.ts)
  - riesgo: medio-alto
  - patrón actual: listados y filtros cliente con `getDocs()`, lecturas de subcolección y agregación en cliente
  - motivo: tablas grandes y carga administrativa
- [page.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/app/(main)/admin/page.tsx)
  - riesgo: medio
  - patrón actual: depende de componentes hijo que leen métricas y grids en cliente
  - motivo: landing admin con posibilidad de mejora rápida vía endpoint agregado

### Prioridad baja

- [page.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/app/(auth)/registro/page.tsx)
  - riesgo: bajo tras ajustes recientes
  - patrón actual: costo visual reducido y sin validación pesada de CURP
  - motivo: problema principal era render, no lecturas de datos masivos
- [page.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/app/(main)/dashboard/page.tsx)
  - riesgo: bajo-medio
  - patrón actual: depende de API propia y modal de detalle
  - motivo: el riesgo quedó más concentrado en sus endpoints que en la vista
- [page.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/app/(public)/bolsa-de-trabajo/resultado/[matricula]/page.tsx)
  - riesgo: medio por endpoint asociado, no por render propio
  - motivo: el problema real vive en la API pública de posición

## Avance implementado

### Fase 2 parcial completada

- Portal trabajador:
  - [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/trabajador/posicion/route.ts) ahora prioriza lookup materializado por matrícula y sólo cae al camino legacy cuando no hay materializados válidos.
  - [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/trabajador/mis-tramites/route.ts) y [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/trabajador/mis-tramites/[documentoId]/route.ts) dejaron de hacer fallback caro; ahora fallan rápido si la sync oficial aún no está materializada.
- Admin dashboard:
  - [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/admin/dashboard-chips/route.ts) centraliza chips del landing admin en una sola API protegida.
  - [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/admin/estadisticas/resumen/route.ts) concentra métricas y gráficos en backend para evitar múltiples lecturas desde cliente.
  - [DashboardChips.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/components/admin/DashboardChips.tsx), [DashboardStats.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/components/admin/estadisticas/DashboardStats.tsx) y [DashboardCharts.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/components/admin/estadisticas/DashboardCharts.tsx) ya consumen endpoints backend en vez de Firestore cliente.
- Validaciones admin:
  - [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/admin/validaciones/resumen/route.ts), [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/admin/validaciones/solicitudes/route.ts) y [route.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/app/api/admin/validaciones/solicitudes/[uid]/route.ts) sustituyen listeners y escrituras directas desde navegador.
  - [Sidebar.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/components/Sidebar.tsx), [AdminValidacion.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/components/admin/AdminValidacion.tsx) y [page.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/app/(main)/admin/validaciones/page.tsx) ahora usan fetch autenticado con polling controlado.

### Pendientes abiertos de la fase

- Revisar si [analytics.ts](/Users/gerardoarroyo/Desktop/SNTSS/src/lib/firebase/analytics.ts) todavía conserva caminos cliente no cubiertos por los nuevos endpoints admin.
- Confirmar si tablas grandes de bolsa requieren ya paginación server-side o si pueden esperar a la siguiente fase.
- Medir en uso real de Firebase si la caída de listeners/lecturas en admin y portal se refleja en la red institucional objetivo.
