# Technical Backlog

## Objetivo

Ejecutar la spec [estabilidad-tablas-bolsa-admin.md](/Users/gerardoarroyo/Desktop/SNTSS/docs/specs/estabilidad-tablas-bolsa-admin.md) en fases pequeñas y reversibles.

## Fase 1

- Definir un modelo explícito de estado para la tabla:
  - `idle`
  - `loading-initial`
  - `loading-refresh`
  - `success`
  - `empty`
  - `error`
- Sustituir `loading` y `streaming` ambiguos por ese estado.
- Mantener la última página válida visible durante `loading-refresh`.

## Fase 2

- Tratar cancelaciones y respuestas reemplazadas como eventos normales, no como error de usuario.
- Normalizar errores reales:
  - `404` documento inexistente
  - `429` rate limit real
  - `5xx` backend
- Mostrar mensajes inline sólo cuando el error es vigente y confirmado.

## Fase 3

- Instrumentación controlada:
  - agregar modo debug opt-in para la vista
  - opciones válidas:
    - query param tipo `?debugTable=1`
    - `localStorage`
    - panel oculto sólo para admin
- Registrar:
  - timestamp de request
  - filtros activos
  - página
  - duración
  - si fue abortada o reemplazada
  - status HTTP final
- No agregar `console.log` global permanente en producción.

## Fase 4

- Revisar el backend paginado del documento:
  - medir costo real por request
  - decidir si hace falta cursor real en subcolección
  - evaluar si algunas facetas deben materializarse por documento

## Validación por fase

- Fase 1:
  - no parpadea el vacío mientras una búsqueda sigue corriendo
  - la tabla conserva el último contenido válido durante refresh
- Fase 2:
  - no aparecen errores transitorios al usuario por abort/cancel
- Fase 3:
  - existe diagnóstico activable sin ensuciar consola global
- Fase 4:
  - evidencia de mejora o decisión documentada si el backend actual ya es suficiente

## Decisión recomendada

- No meter `logs` permanentes en consola del navegador para todos los usuarios en producción.
- Sí implementar un modo debug explícito y apagado por defecto.
