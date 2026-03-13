# Technical Backlog

## Objetivo

Implementar la spec `docs/specs/security-hardening-bolsa.md` en fases pequeñas, con validación técnica y manual.

## Fases

### Fase 1

- crear helper de autorización reutilizable para rutas API administrativas
- cerrar `src/app/api/bolsa-de-trabajo/procesar/route.ts` con token y rol admin
- dejar de confiar en `userId` y `userEmail` enviados por cliente
- validar que el flujo admin de carga siga funcionando

### Fase 2

- revisar y cerrar `src/app/api/bolsa-de-trabajo/importar/route.ts`
- revisar y cerrar `src/app/api/bolsa-de-trabajo/extraer/route.ts`
- verificar consistencia con rutas privadas del trabajador ya basadas en token

### Fase 3

- endurecer `firestore.rules` por colección
- restringir colecciones con permisos amplios a `owner/admin` o `admin-only`
- revisar `storage.rules` en línea con el modelo final

### Fase 4

- eliminar defaults inseguros en `src/lib/firebase/config.ts`
- endurecer inicialización de admin SDK en `src/lib/firebase/admin.ts`
- limpiar logs excesivos en `src/contexts/AuthContext.tsx`

### Fase 5

- documentar modelo de seguridad final
- actualizar checklist de validación
- registrar riesgos o decisiones pendientes

## Validaciones por fase

- fase 1:
  - `npm run typecheck`
  - `npm run lint`
  - prueba admin de carga/reemplazo
- fase 2:
  - `npm run typecheck`
  - `npm run lint`
  - prueba negativa sin permisos
- fase 3:
  - revisión manual de reglas
  - prueba user vs admin
- fase 4:
  - `npm run typecheck`
  - `npm run lint`
  - prueba de login/dashboard
- fase 5:
  - revisión documental
  - confirmación de criterio de salida

## Riesgos abiertos

- romper operación admin por endurecer autorización demasiado pronto
- bloquear lecturas necesarias del portal del trabajador
- dejar scripts operativos fuera del nuevo modelo de seguridad

## Cierre esperado

- rutas admin protegidas por token + rol
- reglas más estrictas en Firestore/Storage
- configuración Firebase sin defaults inseguros
- documentación suficiente para continuar endureciendo seguridad sin improvisar
