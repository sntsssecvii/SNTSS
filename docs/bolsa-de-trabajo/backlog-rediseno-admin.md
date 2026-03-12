# Backlog Técnico del Rediseño Admin

## Objetivo

Llevar la UI de bolsa de trabajo desde un modelo centrado en documentos a un modelo centrado en quincenas.

## Fase 1. Modelo y rutas

- Crear entidad o vista estable de `quincena` como primer nivel del admin.
- Definir la ruta base de detalle de quincena.
- Definir la ruta de detalle por tipo dentro de quincena.
- Separar el contexto de periodo del contexto de documento.

## Fase 2. Pantalla de Quincenas

- Reemplazar la pantalla principal actual por una lista de quincenas.
- Mostrar estado global del corte.
- Mostrar progreso `tipos cargados / 8`.
- Marcar la quincena oficial.
- Permitir crear una nueva quincena sin publicarla.

## Fase 3. Detalle de Quincena

- Renderizar los 8 tipos oficiales como checklist.
- Mostrar por tipo:
  - documento actual
  - total de registros
  - estado
  - acciones principales
- Quitar selector global de quincena en esta pantalla.

## Fase 4. Regla de reemplazo por tipo

- Impedir múltiples documentos activos del mismo tipo dentro de una misma quincena.
- Convertir la carga en:
  - `subir primer documento`
  - `reemplazar documento existente`
- Mantener historial interno si es necesario, pero no como paralelo visible ambiguo.

## Fase 5. Detalle del Tipo

- Mantener tabla y revisión de registros.
- Mostrar encabezado fijo:
  - periodo
  - tipo
  - estado
  - total de registros
- Añadir acción clara de reemplazo.

## Fase 6. Publicación

- Llevar la publicación a nivel quincena.
- Mostrar si el corte está listo o incompleto.
- Validar si los 8 tipos están presentes antes de publicar.
- Permitir quincenas en borrador o históricas sin activarlas.

## Fase 7. Limpieza de UX

- Eliminar duplicidad de controles de periodo.
- Ajustar el lenguaje visual:
  - `quincena`
  - `tipo`
  - `documento vigente`
  - `publicar corte`
- Evitar terminología de dashboard genérico.

## Orden recomendado de implementación

1. Formalizar rutas y jerarquía.
2. Construir pantalla de quincenas.
3. Construir detalle de quincena.
4. Convertir la carga en reemplazo por tipo.
5. Adaptar detalle del tipo.
6. Cerrar publicación a nivel corte.
