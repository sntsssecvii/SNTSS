# Backlog Técnico del Motor de Posiciones

## Objetivo

Traducir el diseño del motor de posiciones a un plan de implementación incremental, con riesgo controlado y sin romper la funcionalidad ya resuelta en:

- `NUEVO_INGRESO`
- `CAMBIOS_TURNO_ADSCRIPCION`

## Principios de ejecución

- No rehacer extracción de PDF/Excel
- No rehacer persistencia
- No rehacer visualización ya resuelta
- Preservar el comportamiento actual de los tipos ya operativos
- Introducir el nuevo motor primero en paralelo y con pruebas

## Qué significa "contrato" en este contexto

Un contrato es una definición estable de entrada y salida entre partes del sistema.

En este proyecto, los contratos principales del motor serán:

- `NormalizedPositionRecord`
  - shape mínimo que necesita el motor para calcular
- `PositionResult`
  - shape estable que devuelve el motor
- `PositionStrategy`
  - interfaz que cada tipo debe implementar

El contrato evita que la lógica de negocio quede dispersa entre API, UI y helpers.

## Qué significa "backlog técnico"

Es la lista priorizada de tareas de ingeniería necesarias para llegar al objetivo.

No describe ideas generales. Describe trabajo ejecutable:

- crear interfaces
- escribir pruebas
- adaptar lógica existente
- introducir nuevas estrategias
- conectar API/UI al nuevo resultado

## Estado actual asumido

### Ya resuelto

- Conversión PDF/Excel
- Guardado en base de datos
- Visualización en frontend
- Cálculo operativo confiable en:
  - `NUEVO_INGRESO`
  - `CAMBIOS_TURNO_ADSCRIPCION`

### Pendiente

- Formalizar el motor
- Agregar lógica de posiciones a los demás tipos
- Hacer trazable el cálculo

## Backlog por fases

### Fase 1. Blindaje de lo que ya funciona

Objetivo: congelar el comportamiento actual para que el refactor no introduzca regresiones.

#### Tareas

1. Identificar inputs y outputs reales actuales de:
   - `NUEVO_INGRESO`
   - `CAMBIOS_TURNO_ADSCRIPCION`
2. Crear pruebas de regresión para esos dos tipos
3. Documentar ejemplos reales de cálculo esperado
4. Confirmar si hoy existe deduplicación por matrícula en ambos tipos y dejarlo explícito en pruebas

#### Resultado esperado

- Se puede refactorizar el motor sin miedo a romper lo ya validado

### Fase 2. Definir contratos del motor

Objetivo: fijar interfaces estables antes de mover lógica.

#### Tareas

1. Crear `NormalizedPositionRecord`
2. Crear `PositionResult`
3. Crear `PositionStrategy`
4. Definir si el consecutivo se representará como `numeroProg` o como `sortValue` derivado
5. Definir dónde vive la explicación del resultado

#### Resultado esperado

- Base tipada y estable para todas las estrategias

### Fase 3. Implementar engine común

Objetivo: centralizar la infraestructura compartida.

#### Responsabilidades del engine

- recibir registros normalizados
- construir grupos comparables
- ordenar por consecutivo
- deduplicar si aplica
- delegar reglas especiales
- devolver `PositionResult`

#### Tareas

1. Crear módulo `positionEngine`
2. Implementar ordenamiento común por consecutivo
3. Implementar deduplicación configurable
4. Implementar utilidades de agrupación
5. Implementar utilidades de explicación base

#### Resultado esperado

- Infraestructura común reutilizable

### Fase 4. Migrar tipos ya operativos al nuevo motor

Objetivo: convertir la lógica actual a estrategias formales sin cambiar comportamiento observable.

#### Tareas

1. Implementar `nuevoIngresoStrategy`
2. Implementar `cambiosTurnoAdscripcionStrategy`
3. Comparar salida nueva vs salida actual
4. Ajustar endpoint y consumidores para leer `PositionResult`
5. Verificar que UI y API sigan mostrando exactamente lo mismo

#### Resultado esperado

- `NUEVO_INGRESO` y `CAMBIOS_TURNO_ADSCRIPCION` funcionando sobre la nueva arquitectura

### Fase 5. Implementar tipos simples

Objetivo: incorporar rápido los tipos con menor complejidad de reglas.

#### Tipos incluidos

- `CAMBIOS_AREA`
- `CAMBIOS_TIPO_PLAZA`
- `CAMBIOS_RESIDENCIA_ORIGEN`
- `CAMBIOS_RESIDENCIA_DESTINO`

#### Tareas

1. Crear una estrategia por cada tipo
2. Agregar pruebas por grupo y orden
3. Validar resultados con ejemplos reales

#### Resultado esperado

- Cuatro tipos nuevos calculando con baja complejidad

### Fase 6. Implementar tipo intermedio restante

Objetivo: agregar `AMPLIACIONES_JORNADA`

#### Regla confirmada

- grupo: `jornadaNueva + adscripcionNueva + turnoNuevo`
- orden: `consecutivo`

#### Tareas

1. Implementar `ampliacionesJornadaStrategy`
2. Verificar que no se use la jornada actual para agrupar
3. Probar con fixtures reales

### Fase 7. Implementar tipo especial restante

Objetivo: agregar `CAMBIOS_RAMA`

#### Regla confirmada

- grupo base: `zona + categoria`
- orden: `consecutivo`
- prioridad especial para `zona incondicional`

#### Tareas

1. Modelar la prioridad de `incondicional`
2. Definir si esa prioridad altera el grupo, el orden o ambos
3. Implementar `cambiosRamaStrategy`
4. Validar con casos reales

#### Riesgo principal

- interpretar mal la prioridad de `incondicional`

### Fase 8. Trazabilidad y salida pública

Objetivo: hacer que el sistema no sólo calcule, sino que también explique.

#### Tareas

1. Agregar `grupoComparable` a la salida
2. Agregar `reglasAplicadas`
3. Agregar `explicacion`
4. Exponer esa información en la API pública
5. Mostrar la explicación en frontend si aporta valor

#### Resultado esperado

- Auditoría y mayor confianza del usuario final

## Riesgos a controlar

- Romper cálculo ya validado en `NUEVO_INGRESO`
- Romper cálculo ya validado en `CAMBIOS_TURNO_ADSCRIPCION`
- Meter lógica de negocio en UI en lugar de motor
- Mezclar campos de extracción con contratos de cálculo
- Implementar `CAMBIOS_RAMA` sin modelar bien `incondicional`

## Criterio de éxito

El motor estará bien implementado cuando:

- los dos tipos ya operativos sigan dando el mismo resultado
- los 8 tipos puedan calcular posiciones con una estrategia explícita
- la lógica quede centralizada
- la API pública pueda explicar por qué alguien está en cierta posición

## Siguiente paso recomendado

Arrancar Fase 1:

1. crear pruebas de regresión para `NUEVO_INGRESO`
2. crear pruebas de regresión para `CAMBIOS_TURNO_ADSCRIPCION`
3. diseñar los contratos reales del motor sobre el código actual
