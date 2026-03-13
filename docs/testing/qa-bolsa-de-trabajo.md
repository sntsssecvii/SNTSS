# QA Bolsa de Trabajo

Checklist manual corta para validar el flujo completo antes de publicar o mergear cambios relacionados con bolsa de trabajo.

## Estado actual de validación

- Validados con datos reales:
  - `NUEVO_INGRESO`
  - `AMPLIACIONES_JORNADA`
  - `CAMBIOS_RESIDENCIA_ORIGEN`
  - `CAMBIOS_RESIDENCIA_DESTINO`
- Pendientes de seguir validando:
  - `CAMBIOS_TURNO_ADSCRIPCION`
  - `CAMBIOS_AREA`
  - `CAMBIOS_TIPO_PLAZA`
  - `CAMBIOS_RAMA`
- Nota operativa:
  - En `CAMBIOS_TURNO_ADSCRIPCION`, por ahora el sistema toma `turno solicitado` también en casos `CAD` cuando el documento lo trae informado. Esta regla quedó activa y pendiente de confirmación sindical.

## Precondiciones

- Existe al menos una quincena oficial publicada.
- Existe al menos una quincena en borrador o histórica para prueba.
- Hay usuarios `USER` con:
  - matrícula vinculada y trámites vigentes
  - matrícula vinculada sin trámites vigentes
  - sin matrícula vinculada, si aplica
- `npm run lint`
- `npm run typecheck`
- `npm run positions:test`

## 1. Admin: Lista de quincenas

- Entrar a `/admin/bolsa-de-trabajo`
- Confirmar que cada periodo aparece una sola vez en la lista
- Confirmar que la quincena oficial se marque como `Oficial vigente`
- Confirmar que un corte histórico o incompleto no aparezca como oficial
- Confirmar que al abrir una quincena se entra al corte correcto

## 2. Admin: Detalle de quincena

- Abrir una quincena completa
- Confirmar que se vean los 8 tipos oficiales
- Confirmar que un tipo con documento abra directo su tabla al tocar la fila
- Confirmar que un tipo faltante lleve directo a carga al tocar la fila
- Confirmar que `Reemplazar` siga funcionando como acción secundaria
- Confirmar que no aparezca selector global de quincena dentro del detalle

## 3. Admin: Carga y reemplazo

- Entrar al flujo de carga desde una quincena existente
- Confirmar que la quincena de destino ya llegue preseleccionada
- Confirmar que el mensaje distinga:
  - quincena existente sin documentos
  - quincena existente con documentos
  - quincena nueva
- Cargar un tipo ya existente y validar que se reemplace, no que cree uno paralelo
- Cargar una quincena histórica y confirmar que no permita publicarla como oficial

## 4. Admin: Tabla por tipo

- Entrar a un documento desde la quincena
- Confirmar que el botón/regreso vuelva al paso anterior lógico
- Confirmar filtros por categoría y zona
- Confirmar paginación
- Confirmar exportación CSV

## 5. Posiciones por tipo

Validar al menos una matrícula real por tipo comparando contra el criterio sindical esperado.

- `NUEVO_INGRESO`
  - validar `Base`
  - validar `Interinato` si aplica
  - validar separación por `subcategoria`
- `CAMBIOS_TURNO_ADSCRIPCION`
- `AMPLIACIONES_JORNADA`
- `CAMBIOS_AREA`
- `CAMBIOS_TIPO_PLAZA`
- `CAMBIOS_RESIDENCIA_ORIGEN`
- `CAMBIOS_RESIDENCIA_DESTINO`
- `CAMBIOS_RAMA`
  - validar prioridad de `incondicional`

## 6. Portal del trabajador

- Iniciar sesión con un usuario `USER` con matrícula válida
- Entrar a `/dashboard`
- Confirmar que vea únicamente sus trámites
- Confirmar que si tiene varios trámites, se muestren todos
- Entrar al detalle de un trámite
- Confirmar que la posición coincida contra admin
- Confirmar que no se exponga información sensible de terceros

## 7. Casos borde del trabajador

- Usuario sin matrícula vinculada
- Usuario con matrícula válida pero sin trámites vigentes
- Sesión expirada o inválida
- Intento de abrir un trámite que no pertenece al usuario

## Criterio de salida

Se puede considerar listo para merge cuando:

- no hay duplicados visibles de quincena por periodo
- la navegación admin es directa y sin pasos redundantes
- las posiciones visibles en admin coinciden con el portal del trabajador
- las posiciones de los 8 tipos fueron validadas al menos con un caso real
- no hay errores en `lint`, `typecheck` ni `positions:test`
