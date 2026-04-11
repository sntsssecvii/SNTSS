# Technical Backlog

## Objetivo

Implementar la spec `docs/specs/admin-global-super-admin.md` sin romper el flujo actual de administradores.

## Fases

### Fase 1

- centralizar helpers de rol
- aceptar `SUPER_ADMIN` en auth, redirects y navegación existente
- habilitar guards backend admin para `SUPER_ADMIN`

### Fase 2

- crear API protegida para listar usuarios
- crear API protegida para actualizar `role` y `status`
- registrar auditoría y validar autoprotecciones

### Fase 3

- construir página de Admin Global
- conectar filtros, edición y feedback visual
- enlazar el módulo desde sidebar, dashboard y command palette

## Validaciones por fase

- fase 1: login y acceso admin siguen funcionando para `ADMIN`
- fase 2: solo `SUPER_ADMIN` puede mutar roles/estatus
- fase 3: la UI carga, filtra y guarda cambios sin errores de lint o tipos

## Riesgos abiertos

- índices de Firestore si la consulta de usuarios crece
- necesidad futura de separar mejor permisos entre `ADMIN` y `SUPER_ADMIN`

## Cierre esperado

- `SUPER_ADMIN` queda operativo de punta a punta
- no se mezclan cambios de parsing, Firebase rules o migraciones externas en esta tarea
