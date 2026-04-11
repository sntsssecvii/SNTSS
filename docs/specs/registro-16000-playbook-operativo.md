# Playbook operativo: registro 16,000

## Objetivo

Definir una respuesta operativa simple para la ventana de registro cuando el panel de observabilidad muestre señales de fricción o riesgo.

## Señales a vigilar

### Estado saludable

- errores de registro en la última hora: `0`
- advertencias de correo en la última hora: `0` a `2`
- pendientes por validar: sin crecimiento brusco
- aprobaciones de la última hora: acompañan el ritmo de entradas

### Estado de atención

- errores de registro en la última hora: `1` a `3`
- advertencias de correo en la última hora: `3` a `5`
- pendientes por validar: `50+`
- validaciones aprobadas por hora claramente debajo del ritmo de entrada

Acción:

- revisar eventos recientes en `/admin/estadisticas`
- revisar `/admin/validaciones`
- confirmar si el error se concentra en archivos, duplicados o correo
- validar si el cuello de botella es operativo o técnico

### Estado crítico

- errores de registro en la última hora: `4+`
- advertencias de correo en la última hora: `6+`
- pendientes por validar: `150+`
- varios eventos recientes con el mismo error técnico

Acción:

- revisar de inmediato `registration_audit_logs`
- confirmar si `/api/registro` sigue respondiendo correctamente
- verificar si Resend, Firebase Auth o Storage están degradados
- priorizar comunicación interna y triage por tipo de fallo

## Respuestas por tipo de incidente

### Si fallan correos de confirmación

- mantener registro abierto si el alta principal sigue entrando
- comunicar internamente que el correo es side effect no bloqueante
- validar que `users/{uid}` y `registration_audit_logs` sigan creciendo
- revisar configuración de `RESEND_API_KEY` y `RESEND_FROM`

### Si suben errores de registro

- revisar si el error dominante es:
  - archivo inválido
  - tamaño de archivo
  - duplicado por correo o matrícula
  - error inesperado de backend
- si es error inesperado repetido:
  - revisar deploy más reciente
  - revisar credenciales/configuración Firebase
  - revisar si hay patrón por tipo de archivo

### Si se acumulan pendientes

- aumentar ritmo de operación en `/admin/validaciones`
- priorizar búsqueda por matrícula o correo exacto
- revisar que admin no tenga fallos de correo confundiendo el resultado
- si hace falta, dividir validación por bloques operativos entre admins

## Verificación mínima durante incidente

1. Confirmar si el usuario existe en `users/{uid}`.
2. Confirmar si hay evento en `registration_audit_logs`.
3. Confirmar si hubo acción posterior en `admin_audit_logs`.
4. Revisar si el problema es técnico o solo de correo/notificación.

## Cierre del incidente

- documentar hora de inicio y fin
- anotar causa principal
- registrar si hubo impacto visible para usuarios
- decidir si hace falta ajustar rate limit, correo o staffing operativo
