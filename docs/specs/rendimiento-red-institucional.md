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
