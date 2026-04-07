# Technical Backlog

## Objetivo

Implementar la spec [security-hardening-registro-16000.md](/Users/gerardoarroyo/Projects/SNTSS/docs/specs/security-hardening-registro-16000.md) en fases pequeñas, reversibles y medibles.

## Fases

### Fase 1

- eliminar persistencia de contraseña admin en navegador
- endurecer contraseña mínima real del registro
- documentar spec, backlog y nota de decisiones
- validar que login y registro sigan operando

### Fase 2

- crear endpoint `POST /api/registro`
- mover validación server-side del payload y archivos
- centralizar rate limiting y respuesta de errores del registro
- registrar auditoría mínima de intentos

### Fase 3

- mover creación de usuario, escritura de `users` y side effects a flujo idempotente
- definir compensación para cuentas huérfanas y uploads parciales
- aislar correo/notificaciones como side effects tolerantes a fallo

### Fase 4

- paginar `admin/validaciones` por cursor y filtro server-side
- paginar administración global de usuarios
- reducir polling y tamaño de payloads en backoffice

### Fase 5

- revisar cuotas y operación esperada para campaña de 16,000 usuarios
- preparar checklist de lanzamiento y smoke tests
- documentar límites, métricas y rollback operativo

## Validaciones por fase

- fase 1:
  - `npm run typecheck`
  - `npm run lint`
  - prueba manual de login y registro
- fase 2:
  - `npm run typecheck`
  - `npm run lint`
  - prueba negativa de abuso y archivos inválidos
- fase 3:
  - prueba manual de fallos intermedios
  - verificación de no dejar cuentas huérfanas sin estrategia
- fase 4:
  - prueba manual de validaciones admin con dataset grande
  - confirmar que el camino normal no trae la colección completa
- fase 5:
  - checklist de despliegue
  - validación operativa con cifras y riesgos explícitos

## Riesgos abiertos

- romper el flujo público si se cambia el registro completo en una sola entrega
- dejar contratos mixtos cliente/servidor coexistiendo demasiado tiempo
- no validar cuotas reales de Firebase/Resend antes de una campaña concentrada
- que la UI admin siga degradándose si la paginación se pospone demasiado

## Cierre esperado

- registro público endurecido y gobernado por backend
- credenciales sensibles fuera del navegador
- panel admin utilizable con crecimiento real de usuarios
- ruta operativa clara para soportar una campaña de 16,000 registros sin improvisación
