# Estado actual: Hardening del registro y preparación para 16,000 usuarios

## Objetivo de este documento

Dejar registro del punto de partida, las decisiones tomadas y la primera fase aplicada para poder continuar el endurecimiento del registro sin mezclarlo con otros frentes.

## Hallazgos base

- El registro público hoy corre mayormente desde cliente.
- No existe un endpoint dedicado de registro con rate limiting durable.
- El flujo puede dejar cuentas huérfanas en Auth si falla una etapa intermedia.
- El login almacenaba contraseña de admin en `sessionStorage`.
- El backoffice de usuarios y validaciones todavía escala mal para 16,000 registros.

## Decisiones tomadas

### 1. Separar el trabajo en fases

No mezclar en una sola entrega:

- migración completa del registro a backend
- paginación del backoffice
- cambios visuales
- cambios de reglas de negocio

### 2. Atacar primero riesgos críticos y reversibles

La primera fase se enfoca en:

- quitar persistencia de contraseñas admin del navegador
- endurecer la política real de contraseña del registro
- dejar especificación y backlog cerrados

### 3. Migración server-side como siguiente frente principal

La siguiente fase debe crear un endpoint de registro propio y mover ahí:

- validación
- creación de usuario
- escritura de perfil
- side effects operativos

## Avance implementado en esta sesión

- spec creada:
  - `docs/specs/security-hardening-registro-16000.md`
- backlog creado:
  - `docs/specs/security-hardening-registro-16000-backlog.md`
- nota de estado creada:
  - `docs/specs/estado-security-hardening-registro-16000.md`
- fase 1 aplicada en código:
  - se elimina almacenamiento de contraseña admin en `sessionStorage`
  - se sube la contraseña mínima del registro a 8 caracteres y se alinea el copy visible
- fase 2 iniciada en código:
  - se crea `src/app/api/registro/route.ts` como entrada backend del alta pública
  - `src/components/registro/RegistroForm.tsx` deja de crear cuentas, subir archivos y escribir Firestore directamente desde cliente
  - la ruta nueva valida datos y archivos, crea usuario con Admin SDK, guarda `users/{uid}`, hace rollback básico y trata el correo como side effect tolerante a fallo
- fase 3 parcial aplicada:
  - `src/app/api/admin/validaciones/solicitudes/route.ts` ahora responde páginas con cursor y total agregado
  - `src/app/api/admin/global/usuarios/route.ts` ahora filtra por rol/estatus en backend y responde páginas con cursor
  - `src/components/admin/AdminValidacion.tsx` y `src/components/admin/AdminGlobalManager.tsx` ya navegan resultados paginados
  - `src/app/api/registro/route.ts` deja auditoría mínima de intentos exitosos y fallidos
  - se agregan campos normalizados de búsqueda para `users` y script de backfill operativo
  - se documenta checklist de salida para la ventana de 16,000 usuarios

## Riesgos que siguen abiertos

- el registro ya entra por backend, pero aún falta endurecer observabilidad, auditoría e idempotencia fina
- siguen faltando rate limit durable y auditoría de registro más rica
- validaciones admin y administración global ya están paginadas, pero falta pulir búsqueda server-side y confirmar índices/cuotas
- falta revisar cuotas operativas antes de una convocatoria fuerte

## Punto de reanudación sugerido

Continuar con:

1. reforzar `POST /api/registro` con auditoría e idempotencia fina
2. idempotencia y compensación reforzada para altas incompletas
3. búsqueda server-side e índices para validaciones/admin global
4. checklist de lanzamiento para ventana de 16,000 usuarios
