# Portal Del Trabajador: Modelo De Acceso Y Privacidad

## Objetivo

Definir como debe acceder un trabajador a su informacion de bolsa de trabajo sin exponer datos de terceros.

## Principio central

La matricula es la llave de vinculacion de datos del trabajador, pero no debe ser la llave de acceso por si sola en el producto final.

## Distincion importante

- `identidad`: quien es el usuario autenticado
- `vinculacion`: que registros de bolsa de trabajo le pertenecen

La matricula resuelve bien la vinculacion.
La autenticacion del usuario resuelve quien puede ver esos datos.

## Regla de seguridad

Queda prohibido que un trabajador autenticado pueda consultar matriculas ajenas desde el portal privado.

## Modelo final recomendado

1. El trabajador inicia sesion.
2. El sistema carga su documento `users/{uid}`.
3. De ese documento se obtiene la `matricula`.
4. El backend busca todos los registros vigentes de esa matricula en la sincronizacion oficial activa.
5. El sistema calcula posiciones por cada tramite encontrado.
6. El portal muestra solo los tramites del trabajador autenticado.

## Que puede ver el trabajador

- su nombre
- su matricula
- tipo de tramite
- posicion actual
- total del grupo comparable
- datos generales no sensibles del tramite
- periodo oficial publicado

## Que no debe ver

- nombres de otros trabajadores
- matriculas de terceros
- orden completo de la lista
- reglas internas de priorizacion detalladas si no agregan valor al usuario final
- datos administrativos o de validacion interna

## Multiples tramites

El portal final debe soportar varios tramites por la misma matricula dentro del mismo corte oficial.

Ejemplos:

- cambio de rama y cambio de residencia
- cambio de adscripcion y ampliacion de jornada
- nuevo ingreso y otro tramite futuro, si el negocio lo permite

El trabajador no debe recibir un solo resultado arbitrario si aparece en varios listados. Debe ver un resumen de todos sus tramites vigentes.

## Estado actual del sistema

Hoy existe una consulta publica/transitoria por matricula manual.

Limitaciones actuales:

- la matricula se captura manualmente
- el endpoint actual devuelve solo el primer tramite encontrado
- no existe aun una vista consolidada de multiples tramites por trabajador

## Decision de producto

Mantener la consulta manual actual solo como flujo transitorio o controlado mientras se define el portal privado final.

El diseño objetivo del portal del trabajador debe ser:

- autenticado
- automatico
- centrado en la matricula del usuario logeado
- cerrado a terceros
