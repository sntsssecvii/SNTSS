# Checklist operativo: registro de 16,000 usuarios

## Objetivo

Reducir riesgo técnico y operativo antes de abrir una ventana de registro con volumen alto.

## Antes del lanzamiento

### Firebase y despliegue

- desplegar `firestore.rules`, `storage.rules` y `firestore.indexes.json`
- confirmar que el proyecto correcto de Firebase está enlazado
- validar que `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` y `NEXT_PUBLIC_FIREBASE_PROJECT_ID` correspondan al entorno productivo
- verificar que el bucket de Storage exista y acepte escrituras esperadas para `uploads/{userId}/...`

### Backfill e índices

- ejecutar `npm run users:backfill-search` antes de abrir el registro para que usuarios históricos sean buscables desde admin
- esperar a que Firestore termine de construir índices nuevos antes de la ventana pública
- probar búsquedas por matrícula, correo y nombre desde:
  - `admin/validaciones`
  - `admin/global`

### Proveedores y cuotas

- confirmar cuota operativa de Firebase Auth para creación de usuarios en la ventana esperada
- confirmar presupuesto/volumen de Firestore para escrituras de `users`, `notifications` y `registration_audit_logs`
- confirmar capacidad de Storage para uploads concurrentes
- confirmar cuota de Resend y comportamiento si el correo de confirmación se retrasa o falla

### Smoke tests

- registro exitoso con archivos válidos
- registro duplicado por correo
- rechazo por archivo > 5 MB
- rechazo por tipo de archivo no permitido
- respuesta `429` ante abuso básico
- aprobación y rechazo desde admin
- paginación y búsqueda en validaciones y administración global

## Durante la ventana

- monitorear tasa de errores 500 en `/api/registro`
- revisar crecimiento de `registration_audit_logs`
- revisar crecimiento de cuentas pendientes en `users`
- revisar latencia percibida en admin al validar usuarios
- vigilar saturación de correos o retrasos en confirmación

## Plan de contingencia

- si falla Resend:
  - mantener el registro abierto si el alta principal sigue entrando
  - comunicar que el correo puede retrasarse
- si faltan índices:
  - priorizar validaciones por matrícula/correo exacto
  - pausar consultas amplias de administración global hasta terminar el build de índices
- si el alta deja errores intermedios:
  - revisar `registration_audit_logs`
  - buscar cuentas huérfanas en Auth sin `users/{uid}`

## Después del lanzamiento

- exportar métricas de registros exitosos, fallidos y rate-limited
- revisar volumen de pendientes y tiempo promedio de validación
- documentar si el límite actual de rate limiting fue suficiente o necesita ajuste
- decidir si el siguiente paso es colas asíncronas para correo/notificaciones
