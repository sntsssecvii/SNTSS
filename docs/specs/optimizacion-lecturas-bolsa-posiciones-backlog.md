# Technical Backlog

## Objetivo

Implementar la spec `docs/specs/optimizacion-lecturas-bolsa-posiciones.md` en fases pequeñas, reversibles y sin cambiar reglas funcionales del motor en la primera entrega.

## Fases

### Fase 1

- Documentar el flujo actual de cálculo on-demand y confirmar hotspots de lectura por endpoint.
- Diseñar el contrato mínimo del resultado materializado por matrícula.
- Diseñar la colección o estructura derivada para lookup rápido por `syncId + matricula`.
- Definir metadata de control: `syncId`, `tipoDocumento`, `versionCalculo`, `fechaMaterializacion`.
- Mantener el motor actual como implementación única de cálculo.
- Estado: completada.

### Fase 2

- Implementar materialización de resultados usando el motor vigente.
- Ejecutar la materialización al final del procesamiento o en una fase explícita de publicación de quincena.
- Guardar sólo los campos necesarios para consulta de trabajador y auditoría básica.
- Agregar validación dual opcional para comparar materializado vs cálculo on-demand.
- Registrar errores de materialización sin bloquear rollback manual.
- Estado: completada con materialización automática al publicar y endpoint operativo de backfill.

### Fase 3

- Refactorizar `GET /api/trabajador/posicion` para usar lectura directa del índice materializado.
- Refactorizar `GET /api/trabajador/mis-tramites` para usar lookup directo por matrícula.
- Revisar `GET /api/trabajador/mis-tramites/[documentoId]` para que evite scans completos si el dato ya existe materializado.
- Mantener fallback controlado al flujo anterior sólo mientras dure el rollout.
- Estado: completada con fallback temporal habilitado.

### Fase 4

- Medir reducción real de lecturas y tiempos de respuesta.
- Eliminar o desactivar paths on-demand que ya no sean necesarios en producción.
- Documentar operación: regeneración de materializados, invalidación por nueva quincena y manejo de inconsistencias.
- Evaluar optimización adicional de analytics y contadores fuera del flujo de posiciones.
- Estado: pendiente.

## Validaciones por fase

- fase 1:
- revisar coherencia de diseño con el motor vigente y confirmar que no introduce cambio de regla

- fase 2:
- comparar una muestra de posiciones materializadas contra resultados del motor actual
- `npm run typecheck`
- `npm run lint`

- fase 3:
- validar consulta pública y autenticada contra una quincena real
- verificar que la lectura por request disminuye respecto al flujo actual
- `npm run typecheck`
- `npm run lint`

- fase 4:
- confirmar reducción sostenida de lecturas en Firebase Usage
- documentar decisiones finales y pendientes

## Riesgos abiertos

- Elegir una estructura derivada que quede corta para futuros cambios de UI o auditoría.
- Ejecutar la materialización en un punto del flujo que complique reintentos o rollback.
- Mantener doble camino por demasiado tiempo y reintroducir inconsistencias.

## Cierre esperado

- La consulta de posiciones del trabajador debe resolverse por lookup directo y no por escaneo de la quincena.
- El motor actual debe seguir siendo la fuente de cálculo, pero ya no ejecutarse por cada consulta pública o autenticada.
- No debe mezclarse en esta iniciativa el cambio de reglas del motor, parser documental o rediseño general del portal.

## Nota operativa

- Mientras existan syncs antiguas sin materializar, el sistema puede caer al path legacy de cálculo.
- El cierre definitivo de la iniciativa requiere materializar los periodos vigentes o relevantes y después retirar el fallback.
