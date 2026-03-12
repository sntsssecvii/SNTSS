# Migracion: Consulta Publica A Portal Privado

## Objetivo

Migrar del flujo actual de consulta manual por matricula a un portal privado del trabajador basado en usuario autenticado + matricula vinculada.

## Punto de partida actual

### Lo que ya existe

- registro de usuarios con `matricula`
- autenticacion con Firebase
- carga de `users/{uid}` en `AuthContext`
- consulta publica por matricula
- endpoint de posicion para un tramite encontrado
- vista publica de resultado

### Limitaciones

- el usuario escribe la matricula manualmente
- el endpoint actual devuelve solo el primer documento que coincide
- no hay agregacion de multiples tramites
- no hay separacion final entre modo publico/transitorio y modo privado

## Meta funcional

Cuando un trabajador inicie sesion, debe entrar a una seccion donde el sistema obtenga su matricula automaticamente y le muestre todos sus tramites vigentes del corte oficial actual, sin permitir consultar informacion de otras personas.

## Arquitectura objetivo

### Fuente de identidad

- Firebase Auth
- documento `users/{uid}`

### Fuente de vinculacion

- campo `matricula` del documento `users/{uid}`

### Fuente de verdad de bolsa

- sincronizacion oficial activa
- documentos de `bolsa_de_trabajo_documentos`
- subcolecciones `registros`

## Cambio principal de backend

El backend debe evolucionar de:

- `GET /api/trabajador/posicion?matricula=...`

a algo equivalente a:

- `GET /api/trabajador/mis-tramites`

Ese endpoint deberia:

1. identificar al usuario autenticado
2. leer su `matricula` desde `users/{uid}`
3. buscar todos los documentos de la sincronizacion activa donde exista esa matricula
4. calcular la posicion para cada tramite encontrado
5. devolver una lista de resultados

## Cambio principal de frontend

El portal del trabajador debe evolucionar de:

- formulario manual de matricula
- una pantalla de resultado unico

a:

- dashboard privado del trabajador
- resumen de tramites activos
- una tarjeta por tramite
- acceso a detalle por tramite si hace falta

## Fases recomendadas

### Fase 1

Documentar modelo final y restricciones de privacidad.

### Fase 2

Crear endpoint interno para `mis-tramites` sin retirar aun la consulta manual existente.

### Fase 3

Crear vista privada del trabajador autenticado usando la matricula del perfil.

### Fase 4

Soportar multiples tramites en una sola pantalla.

### Fase 5

Decidir si la consulta manual queda:

- eliminada
- limitada a modo transitorio
- reservada para soporte interno

## Riesgos a controlar

- usuarios sin matricula vinculada en `users/{uid}`
- matriculas mal capturadas o duplicadas
- multiples coincidencias inesperadas
- confusion entre consulta publica y portal privado
- exponer datos de terceros por un endpoint demasiado abierto

## Regla de implementacion

No mezclar en la misma tarea:

- autenticacion
- migracion completa del portal
- cambios grandes del motor de posiciones

La migracion debe hacerse por capas, preservando el flujo actual mientras el portal privado queda listo.
