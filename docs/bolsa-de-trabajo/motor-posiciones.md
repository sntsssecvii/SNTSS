# Motor de Posiciones

## Objetivo

Definir la base funcional y técnica para calcular posiciones de bolsa de trabajo de forma consistente, trazable y extensible para los 8 tipos de documento ya soportados por el sistema.

Este documento es un contrato de implementación. La extracción y visualización ya se consideran resueltas. El trabajo pendiente se concentra en la lógica de cálculo de posiciones por tipo.

## Alcance actual

### Ya resuelto

- Extracción automática confiable de los 8 tipos de documento
- Persistencia y visualización de registros en tablas del frontend
- Cálculo operativo en al menos:
  - `NUEVO_INGRESO`
  - `CAMBIOS_TURNO_ADSCRIPCION`

### Pendiente principal

- Formalizar y unificar el motor de cálculo de posiciones
- Implementar la lógica de posiciones faltante para los demás tipos
- Hacer trazable la razón de una posición para auditoría y consulta pública

## Principio de diseño

El sistema no debe tener 8 motores distintos. Debe tener:

- un `engine` común para calcular posiciones
- una `strategy` por tipo de documento para definir reglas particulares

## Flujo conceptual

1. Obtener registros ya extraídos y normalizados
2. Determinar el grupo comparable para un trabajador
3. Ordenar el grupo por el consecutivo oficial
4. Eliminar duplicados si aplica
5. Aplicar reglas especiales del tipo
6. Calcular posición final
7. Generar salida trazable para UI, API y auditoría

## Regla general común

En todos los tipos, la base del cálculo es el orden oficial del listado.

- El orden principal es el `consecutivo`
- El cálculo nunca debe depender del orden de carga al sistema
- El grupo comparable cambia por tipo de documento

## Catálogo de reglas por tipo

### 1. NUEVO_INGRESO

- Grupo comparable: `zona + categoria`
- Orden: `consecutivo`
- Regla especial:
  - calcula `posicionBase` sobre todas las matrículas únicas del grupo
  - si `tipoContratacion === 8`, calcula además `posicionInterinato`
  - `posicionInterinato` sólo considera a los eventuales del mismo grupo
- Salida esperada:
  - `posicionBase`
  - `posicionInterinato` si aplica
  - `totalEnGrupo`
  - `totalEventualesEnGrupo`

### 2. CAMBIOS_TURNO_ADSCRIPCION

- Grupo comparable base: `zona + categoria + registro + adscripcion`
- Si `registro === CAT`, agregar `turno`
- Orden: `consecutivo`
- Regla especial:
  - `CAT` y `CAD` no compiten juntos
  - si es `CAT`, el turno solicitado forma parte del grupo
- Salida esperada:
  - `posicionBase`
  - `totalEnGrupo`

### 3. CAMBIOS_RAMA

- Grupo comparable base: `zona + categoria`
- Orden: `consecutivo`
- Regla especial:
  - existe la `zona incondicional`
  - los trabajadores en `incondicional` tienen prioridad sobre quienes esperan por una zona específica cuando se libera una plaza
- Implicación técnica:
  - además del grupo, este tipo necesita una regla de prioridad adicional
- Salida esperada:
  - `posicionBase`
  - `totalEnGrupo`
  - indicador o explicación de prioridad aplicada si interviene `incondicional`

### 4. CAMBIOS_RESIDENCIA_ORIGEN

- Grupo comparable: `zona + turno`
- Orden: `consecutivo`
- Salida esperada:
  - `posicionBase`
  - `totalEnGrupo`

### 5. CAMBIOS_RESIDENCIA_DESTINO

- Grupo comparable: `zona + turno`
- Orden: `consecutivo`
- Salida esperada:
  - `posicionBase`
  - `totalEnGrupo`

### 6. AMPLIACIONES_JORNADA

- Grupo comparable: `jornadaNueva + adscripcionNueva + turnoNuevo`
- Orden: `consecutivo`
- Aclaración funcional:
  - la jornada usada para agrupar es la solicitada, no la actual
- Salida esperada:
  - `posicionBase`
  - `totalEnGrupo`

### 7. CAMBIOS_AREA

- Grupo comparable: `zona + categoria`
- Orden: `consecutivo`
- Salida esperada:
  - `posicionBase`
  - `totalEnGrupo`

### 8. CAMBIOS_TIPO_PLAZA

- Grupo comparable: `zona + categoria`
- Orden: `consecutivo`
- Salida esperada:
  - `posicionBase`
  - `totalEnGrupo`

## Clasificación de complejidad

### Tipos simples

- `CAMBIOS_AREA`
- `CAMBIOS_TIPO_PLAZA`
- `CAMBIOS_RESIDENCIA_ORIGEN`
- `CAMBIOS_RESIDENCIA_DESTINO`

### Tipos intermedios

- `AMPLIACIONES_JORNADA`
- `CAMBIOS_TURNO_ADSCRIPCION`

### Tipos especiales

- `NUEVO_INGRESO`
- `CAMBIOS_RAMA`

## Modelo de salida recomendado

El resultado del cálculo debe exponer, como mínimo:

- `tipoDocumento`
- `matricula`
- `grupoComparable`
- `sortValue`
- `posicionBase`
- `totalEnGrupo`
- `metricasSecundarias`
- `reglasAplicadas`
- `explicacion`

### Ejemplo conceptual

```ts
interface PositionResult {
  tipoDocumento: string
  matricula: string
  grupoComparable: Record<string, string>
  sortValue: number
  posicionBase: number
  totalEnGrupo: number
  metricasSecundarias?: Record<string, number>
  reglasAplicadas: string[]
  explicacion: string
}
```

## Arquitectura propuesta

### 1. Normalización

Convierte registros extraídos en un shape estable para cálculo.

Responsabilidades:

- homologar nombres de campos
- resolver vacíos y formatos
- asegurar disponibilidad del consecutivo oficial

### 2. Estrategias por tipo

Cada tipo debe implementar una estrategia de cálculo.

Responsabilidades:

- validar si el registro tiene lo necesario para calcular
- construir el grupo comparable
- definir el valor de orden
- aplicar reglas especiales
- producir explicación del resultado

### 3. Engine común

Responsabilidades:

- agrupar registros
- ordenar por consecutivo
- deduplicar si aplica
- invocar reglas especiales
- calcular posición
- devolver salida estandarizada

## Interfaz conceptual de estrategia

```ts
interface PositionStrategy {
  tipo: string
  buildGroupKey(registro: RegistroNormalizado): string
  buildGroupInfo(registro: RegistroNormalizado): Record<string, string>
  getSortValue(registro: RegistroNormalizado): number
  shouldDeduplicateByMatricula(): boolean
  applyPriorityRules?(grupo: RegistroNormalizado[], trabajador: RegistroNormalizado): RegistroNormalizado[]
  computeSecondaryMetrics?(grupo: RegistroNormalizado[], trabajador: RegistroNormalizado): Record<string, number>
  explain(result: PositionResult, trabajador: RegistroNormalizado): string
}
```

## Reglas técnicas obligatorias

- El consecutivo oficial debe ser la única fuente primaria de orden
- El cálculo debe ser determinístico
- La UI no debe recalcular lógica de negocio
- La API pública debe devolver no sólo la posición, sino la explicación de cómo se obtuvo
- Las reglas especiales deben vivir en estrategias, no en condicionales dispersos por la UI

## Estrategia de pruebas

Cada tipo debe tener:

- fixture real
- caso feliz
- caso borde
- caso con duplicado de matrícula si aplica
- salida esperada documentada

### Cobertura mínima por tipo

- construye correctamente el grupo comparable
- ordena correctamente por consecutivo
- calcula la posición correcta
- no mezcla grupos incompatibles
- aplica reglas especiales cuando existan

### Casos especiales que deben probarse

- `NUEVO_INGRESO`:
  - eventual
  - no eventual
  - duplicado de matrícula
- `CAMBIOS_TURNO_ADSCRIPCION`:
  - `CAT` con turno
  - `CAD` sin turno
- `CAMBIOS_RAMA`:
  - interacción entre zona específica e `incondicional`

## Fases recomendadas

### Fase 1

Formalizar el engine con los tipos ya operativos:

- `NUEVO_INGRESO`
- `CAMBIOS_TURNO_ADSCRIPCION`

### Fase 2

Incorporar tipos simples:

- `CAMBIOS_AREA`
- `CAMBIOS_TIPO_PLAZA`
- `CAMBIOS_RESIDENCIA_ORIGEN`
- `CAMBIOS_RESIDENCIA_DESTINO`

### Fase 3

Incorporar tipo intermedio restante:

- `AMPLIACIONES_JORNADA`

### Fase 4

Incorporar tipo especial restante:

- `CAMBIOS_RAMA`

### Fase 5

Agregar trazabilidad pública y validación operativa:

- explicación visible de la posición
- auditoría de reglas aplicadas
- validaciones manuales si se requieren

## Decisiones ya confirmadas

- La extracción ya se considera resuelta para los 8 tipos
- La visualización en frontend ya se considera resuelta
- La prioridad actual del proyecto es el cálculo de posiciones
- La lógica de posiciones no es igual entre todos los tipos
- El motor debe compartir infraestructura, pero no forzar una sola regla de agrupación

## Próximo paso

Tomar este documento y convertirlo en:

1. un contrato técnico del motor
2. un backlog por fase
3. una implementación incremental empezando por los tipos ya funcionales
