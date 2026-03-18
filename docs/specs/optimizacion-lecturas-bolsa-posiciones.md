# Feature Spec

## Objetivo

Reducir de forma drástica las lecturas de Firestore generadas por las consultas de bolsa de trabajo sin cambiar la lógica funcional vigente del motor de posiciones. La primera meta es pasar de cálculo on-demand por request a lectura directa de resultados precalculados o indexados por matrícula.

## Problema actual

- Las rutas públicas y autenticadas recalculan posiciones en cada consulta.
- Para responder una sola matrícula, el sistema recorre documentos de la quincena, consulta subcolecciones y en varios casos descarga conjuntos completos de registros para volver a calcular.
- El consumo de Firestore ya está concentrado en lecturas y crece demasiado rápido para el patrón de uso esperado.
- Este patrón afecta costo, límites operativos y tiempo de respuesta.

## Alcance

- Documentar y ejecutar una estrategia de optimización centrada en lecturas del módulo de bolsa de trabajo.
- Diseñar persistencia derivada para consulta rápida por matrícula y tipo de trámite.
- Cambiar las APIs de consulta del trabajador para leer resultados materializados o indexados.
- Mantener el motor de posiciones actual como fuente de verdad lógica durante la transición.
- Fuera de alcance en esta fase:
- Cambiar reglas de negocio del motor de posiciones.
- Rehacer el parser PDF/Excel.
- Modificar reglas de seguridad de Firebase salvo que sea estrictamente necesario y aprobado.
- Optimizar otros módulos no relacionados con bolsa de trabajo.

## Usuarios afectados

- Trabajadores que consultan su posición pública o sus trámites autenticados.
- Administradores que cargan y publican quincenas.
- Operación técnica responsable de costos, límites y estabilidad de Firestore.
- Puede haber regresión si el precálculo no replica exactamente el resultado actual del motor.

## Reglas o comportamiento esperado

- La posición mostrada al trabajador debe seguir siendo la misma que hoy produce el motor vigente para el mismo conjunto de datos.
- El cálculo oficial debe seguir basándose en el motor compartido y sus estrategias por tipo.
- La consulta pública no debe escanear todos los documentos o todos los registros de la quincena para resolver una sola matrícula.
- La consulta autenticada de trámites no debe recalcular todas las posiciones en cada apertura de página.
- La sincronización oficial activa debe poder resolverse con un acceso barato o cacheado.
- Debe existir una forma trazable de saber con qué sync y con qué versión de cálculo se materializó cada resultado.
- La transición debe permitir rollback al flujo actual si se detecta una desviación funcional.

## Riesgos

- Riesgo: divergencia entre el valor precalculado y el valor calculado on-demand.
- Impacto: posiciones incorrectas visibles al trabajador.
- Mitigación: validación dual contra el motor actual en fase de rollout y muestreo de resultados reales.

- Riesgo: duplicar datos y aumentar escrituras o almacenamiento.
- Impacto: mayor costo de escritura y complejidad de mantenimiento.
- Mitigación: materializar sólo campos mínimos de consulta y versionar el snapshot derivado.

- Riesgo: recalcular demasiado durante la carga de quincena.
- Impacto: tiempos de procesamiento mayores al publicar o importar.
- Mitigación: mover el cálculo a una fase explícita y medible, con lotes y puntos de reanudación.

- Riesgo: mezclar en una sola implementación optimización, cambio de reglas y rediseño de datos.
- Impacto: regresiones difíciles de aislar.
- Mitigación: separar la iniciativa en fases pequeñas y reversibles.

## Criterios de aceptacion

- Existe una fuente derivada o índice por matrícula para consultar la posición sin escanear la quincena completa.
- `GET /api/trabajador/posicion` deja de iterar por todos los documentos y de descargar subcolecciones completas para resolver una matrícula.
- `GET /api/trabajador/mis-tramites` deja de recalcular posiciones completas on-demand para cada apertura.
- El resultado funcional para una muestra representativa coincide con el motor actual.
- La documentación deja explícito cuándo se calcula, dónde se persiste y cómo se invalida o regenera.
- El rollout se puede activar por fase sin romper el flujo de carga o consulta actual.

## Validacion

- Comparar resultados precalculados vs cálculo vigente con casos reales de varios tipos de documento.
- Medir lecturas de Firestore antes y después en las rutas de trabajador.
- `npm run typecheck`
- `npm run lint`
- Validación manual de consulta pública y consulta autenticada sobre una quincena activa.

## Notas

- Hotspots actuales identificados:
- `src/app/api/trabajador/posicion/route.ts`
- `src/app/api/trabajador/mis-tramites/route.ts`
- `src/app/api/trabajador/mis-tramites/[documentoId]/route.ts`

- Dirección propuesta:
- mantener el motor actual para calcular
- materializar resultados al cargar o publicar
- consultar por índice de matrícula en vez de escanear registros

- Decisiones pendientes:
- si la materialización debe ocurrir al procesar documento, al cerrar sincronización o al activar fuente de verdad
- forma exacta del índice derivado
- estrategia de rollback durante el rollout

## Estado actual

- Implementado un índice derivado `bolsa_posiciones_materializadas` por `syncId + matricula + tipoDocumento`.
- La publicación oficial de una quincena materializa primero las posiciones y sólo después marca la sync como fuente de verdad.
- Las rutas `GET /api/trabajador/posicion`, `GET /api/trabajador/mis-tramites` y `GET /api/trabajador/mis-tramites/[documentoId]` ya consumen el índice materializado.
- Se dejó fallback temporal al cálculo on-demand cuando una sync todavía no tiene materializados.
- Se agregó un endpoint operativo interno para materializar syncs históricas sin republicarlas.
- Se materializó la sync oficial `Hk1sMbMUBBUHBQtHcIIV` correspondiente a la `2ª quincena 3/2026`.
