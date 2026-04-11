# Feature Spec

## Objetivo

Habilitar un rol `SUPER_ADMIN` funcional que conserve acceso total al panel administrativo y agregue una interfaz propia para gestionar usuarios, roles y estatus operativos.

## Problema actual

- El esquema y los tipos ya contemplan `SUPER_ADMIN`, pero el flujo real solo reconoce `ADMIN`.
- No existe una interfaz segura para administrar roles internos sin tocar Firestore manualmente.

## Alcance

- aceptar `SUPER_ADMIN` en login, navegación, guards cliente y guards backend de admin
- agregar un módulo exclusivo de Admin Global
- permitir listar usuarios y actualizar `role`/`status` desde interfaz protegida
- registrar cambios sensibles en auditoría administrativa
- fuera de alcance: creación masiva de cuentas, custom claims, rediseño total del panel admin

## Usuarios afectados

- super administradores que necesitan gobernanza operativa
- administradores actuales que no deben perder acceso existente
- usuarios finales que podrían verse afectados por cambios de rol o estatus

## Reglas o comportamiento esperado

- `SUPER_ADMIN` puede entrar a todas las rutas y APIs que hoy permiten `ADMIN`
- solo `SUPER_ADMIN` puede cambiar roles o estatus desde el módulo global
- el sistema no debe permitir que un `SUPER_ADMIN` se quite a sí mismo el acceso crítico por error
- cada cambio sensible debe dejar rastro en `admin_audit_logs`

## Riesgos

- cambio accidental de privilegios
- bloqueo de la única cuenta global
- regresiones en rutas admin existentes

## Criterios de aceptacion

- un usuario con rol `SUPER_ADMIN` puede iniciar sesión y navegar el panel admin
- existe una vista de Admin Global accesible solo a `SUPER_ADMIN`
- la vista permite consultar usuarios y actualizar rol/estatus con validaciones mínimas
- las acciones quedan auditadas

## Validacion

- `npm run typecheck`
- `npm run lint`
- validación manual con cuentas `ADMIN` y `SUPER_ADMIN`

## Notas

- esta primera versión usa `users/{uid}.role` como fuente de verdad, alineado al esquema actual
- se deja la puerta abierta para endurecer seguridad con claims si el proyecto lo necesita después

