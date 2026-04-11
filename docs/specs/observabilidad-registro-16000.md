# Observabilidad Operativa Registro 16,000

## Objetivo

Dar visibilidad operativa al flujo de registro y validación admin durante la ventana de alta demanda, sin introducir una plataforma nueva ni depender de consultas manuales a Firestore para el monitoreo básico.

## Problema actual

- El sistema ya registra auditoría de registro y acciones admin, pero no existe un resumen operativo visible desde el panel.
- La página de estadísticas actual está orientada a propuestas y no al flujo crítico de altas/validaciones.
- El panel de notificaciones de estadísticas es sintético y no sirve para operación real.

## Alcance de esta fase

- Exponer un endpoint admin con métricas operativas del registro.
- Mostrar un panel en `/admin/estadisticas` con:
  - pendientes actuales de validación
  - usuarios activos actuales
  - registros exitosos de la última hora
  - errores de registro de la última hora
  - advertencias de correo de la última hora
  - aprobaciones y rechazos de la última hora
  - eventos recientes de registro y validación
- Mantener el costo técnico bajo evitando nuevos proveedores o pipelines de métricas.

## No alcance

- No se agrega Sentry, DataDog ni herramienta externa de observabilidad.
- No se construyen series históricas materializadas ni agregados persistentes.
- No se implementa monitoreo automático por alertas push o correo.

## Decisiones

### 1. Endpoint dedicado y separado del dashboard de propuestas

Se agrega una ruta admin específica para operación de registro en vez de recargar el endpoint de estadísticas de propuestas.

### 2. Consultas livianas y sin índices nuevos

Para evitar otra ronda de despliegue de índices, esta fase usa:

- `count()` en `users` para estados actuales
- consultas por `createdAt` para auditoría reciente
- filtrado en memoria para clasificar eventos de registro/validación

Esto es suficiente para la última hora y eventos recientes, que es el horizonte operativo más útil durante el lanzamiento.

### 3. Reemplazo del panel sintético

La vista de estadísticas deja de depender del panel de notificaciones demo y pasa a mostrar señales reales del sistema.

## Resultado esperado

- El equipo operativo puede detectar desde admin si:
  - suben los errores de registro
  - se acumulan pendientes
  - el correo empieza a fallar
  - el equipo está aprobando o rechazando solicitudes
- La verificación del lanzamiento requiere menos navegación a Firebase Console.
