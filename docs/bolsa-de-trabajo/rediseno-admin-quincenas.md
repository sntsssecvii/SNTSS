# Rediseño Admin de Bolsa de Trabajo

## Objetivo

Reorganizar la experiencia administrativa de bolsa de trabajo para que el modelo mental sea claro:

- el admin trabaja sobre una `quincena`
- cada quincena contiene `8 tipos oficiales`
- cada tipo tiene `1 documento activo`
- la publicación oficial ocurre a nivel `quincena`, no a nivel archivo

La UI actual mezcla periodo, tipo, documento y publicación en la misma capa. Eso genera confusión operativa.

## Problemas actuales

- Se percibe como un gestor de archivos, no como un gestor de quincenas.
- Permite interpretar que pueden coexistir múltiples archivos válidos para un mismo tipo en una misma quincena.
- El selector de quincena aparece en pantallas donde ya no debería cambiar el contexto.
- La publicación oficial no está presentada como cierre de un corte completo.
- La navegación no deja claro en qué nivel está el usuario:
  - lista general
  - tipo
  - documento
  - corte oficial

## Modelo mental correcto

El usuario admin debe pensar así:

1. Selecciono o creo una quincena.
2. Dentro de esa quincena reviso los 8 tipos oficiales.
3. En cada tipo existe un solo documento activo.
4. Si necesito cambiarlo, lo reemplazo.
5. Cuando la quincena está completa y validada, la publico como oficial.

## Estructura propuesta

### 1. Pantalla: Quincenas

Ruta conceptual:

- `/admin/bolsa-de-trabajo`

Responsabilidad:

- listar cortes quincenales
- permitir crear un nuevo corte
- mostrar cuál es el corte oficial
- abrir un corte específico

Cada tarjeta o fila de quincena debe mostrar:

- periodo
- estado general
- tipos cargados de 8
- última actualización
- quién subió o actualizó
- si es oficial o no

Estados sugeridos:

- `BORRADOR`
- `INCOMPLETA`
- `LISTA`
- `PUBLICADA`
- `CON_ERROR`

### 2. Pantalla: Detalle de Quincena

Ruta conceptual:

- `/admin/bolsa-de-trabajo/quincenas/[quincenaId]`

Responsabilidad:

- operar un corte específico
- mostrar checklist de los 8 tipos
- permitir carga o reemplazo por tipo
- mostrar si el corte está listo para publicar

Aquí ya no debe aparecer selector global de quincena.

Cada bloque de tipo debe mostrar:

- nombre del tipo
- documento cargado o pendiente
- total de registros
- estado de procesamiento
- fecha de actualización
- acciones:
  - subir documento
  - reemplazar documento
  - ver detalle
  - eliminar documento

Regla principal:

- `1 tipo + 1 quincena = 1 documento activo`

### 3. Pantalla: Detalle del Tipo

Ruta conceptual:

- `/admin/bolsa-de-trabajo/quincenas/[quincenaId]/tipos/[tipo]`

Responsabilidad:

- inspeccionar el documento vigente de ese tipo dentro de esa quincena
- ver la tabla de registros
- revisar posiciones y datos
- exportar
- reemplazar documento

Aquí tampoco debe aparecer selector de quincena.

## Reglas de producto

### Regla 1. Una quincena no tiene que ser oficial para existir

Debe ser posible:

- cargar quincenas anteriores
- cargar una quincena en borrador
- revisar una quincena sin publicarla

### Regla 2. Sólo una quincena puede ser oficial

La fuente oficial vigente debe ser única.

### Regla 3. Un documento activo por tipo dentro de la quincena

No debe permitirse un set ambiguo de múltiples documentos activos del mismo tipo.

Lo correcto es:

- subir
- reemplazar
- versionar internamente si hace falta auditoría

### Regla 4. La publicación ocurre a nivel quincena

No se publica un archivo individual como oficial.
Se publica el corte completo.

## Navegación propuesta

Jerarquía correcta:

1. `Quincenas`
2. `Detalle de Quincena`
3. `Detalle del Tipo`

## Decisiones UX clave

- El selector de quincena sólo vive en la lista de quincenas.
- El botón principal debe decir `Crear quincena` o `Abrir quincena`, no `Subir archivo`.
- Dentro de una quincena, el lenguaje debe ser de checklist operativo.
- Dentro de un tipo, el lenguaje debe ser de revisión y reemplazo.
- La publicación debe verse como un cierre del corte.

## Beneficios esperados

- menos confusión operativa
- menos errores al subir archivos
- mejor soporte para quincenas históricas
- mejor trazabilidad del estado del corte
- menos mezcla entre contexto de periodo y detalle de documento
