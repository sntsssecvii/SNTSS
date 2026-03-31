# Feature Spec

## Objetivo

Eliminar de forma definitiva los parpadeos, estados engañosos de carga y errores transitorios en las tablas grandes de bolsa de trabajo del panel admin, especialmente en el detalle de documento.

## Problema actual

- La vista [page.tsx](/Users/gerardoarroyo/Desktop/SNTSS/src/app/(main)/admin/bolsa-de-trabajo/[id]/page.tsx) ya migró a backend paginado, pero todavía presenta:
  - indicadores de carga que se sienten nerviosos o redundantes
  - respuestas fuera de orden que afectan la percepción visual
  - transiciones inconsistentes entre “cargando”, “sin resultados” y “tabla con datos”
  - errores transitorios que no siempre distinguen entre cancelación, rate limit o falla real
- En red institucional lenta, estos defectos de interacción se perciben como “la tabla sigue rota” aunque el backend ya haya mejorado.

## Alcance

- Incluido:
  - estabilizar el flujo de carga de la tabla grande de detalle de documento
  - separar claramente estados de búsqueda, carga de página, vacío real y error real
  - instrumentación controlada para diagnóstico en producción sin llenar la consola del usuario final
  - reducir requests redundantes y carreras entre respuestas
- Fuera de alcance:
  - rediseño visual total de la pantalla
  - cambio de proveedor de datos
  - reescritura del motor de posiciones

## Usuarios afectados

- Administradores que revisan documentos grandes de bolsa de trabajo.
- Soporte técnico que necesita distinguir problema real de backend vs problema de interacción.

## Reglas o comportamiento esperado

- La tabla no debe vaciarse mientras una nueva búsqueda o página sigue en progreso.
- El estado de carga debe ser discreto, estable y no intermitente.
- “Sin registros que coincidan” sólo debe aparecer cuando la respuesta final ya confirmó cero resultados.
- Los errores por request abortada, request reemplazada o retry interno no deben mostrarse como falla del documento.
- Los errores reales deben mostrarse inline, no como ruido global.
- La instrumentación en producción debe ser opt-in o controlada por flag, no `console.log` permanente para todos.

## Riesgos

- Riesgo: mantener logs permanentes en consola de producción.
  - Impacto: ruido para usuarios, exposición innecesaria de estados internos, difícil soporte.
  - Mitigación: usar modo debug controlado por query param, localStorage o endpoint de telemetría interna.
- Riesgo: seguir mezclando estado visual con estado de red.
  - Impacto: parpadeos aunque el backend responda bien.
  - Mitigación: modelo explícito de estados de tabla.
- Riesgo: endpoint paginado todavía hace lectura completa del documento por request.
  - Impacto: buen frontend pero latencia residual en documentos muy grandes.
  - Mitigación: segunda fase de cursor real o índice auxiliar por filtros.

## Criterios de aceptación

- Al escribir una matrícula inexistente:
  - la tabla mantiene el contenido previo mientras la búsqueda está en curso
  - no aparece “sin resultados” antes de tiempo
  - al finalizar, el vacío real se muestra sin parpadeo
- Al cambiar filtros o página:
  - no deben verse múltiples transiciones rápidas de carga/vacío/datos
  - no deben aparecer errores transitorios visibles al usuario
- En documentos grandes:
  - la tabla debe responder con estados visuales estables aun si la red es lenta
- Instrumentación:
  - debe existir una forma controlada de inspeccionar requests/latencias en producción sin ensuciar la consola para todos los usuarios

## Validación

- `npm run typecheck`
- `npm run lint`
- prueba manual con:
  - búsqueda existente
  - búsqueda inexistente
  - cambios rápidos de filtros
  - paginación rápida
  - documento de `1000+` registros

## Nota de diseño

- Este problema ya no debe atacarse con “otro parche visual” aislado.
- La solución robusta requiere:
  - máquina de estados simple para la tabla
  - distinción entre request activa, respuesta vigente y resultado confirmado
  - estrategia de diagnóstico opt-in en producción
