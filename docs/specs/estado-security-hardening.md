# Estado actual: Security Hardening

## Objetivo de este documento

Dejar registro del estado actual del endurecimiento de seguridad para poder retomar la siguiente fase sin perder contexto operativo ni decisiones ya tomadas.

## Alcance cubierto en esta sesión y sesiones recientes

El hardening ya avanzó sobre cinco frentes:

- autenticación y autorización real en rutas admin
- reglas de Firestore y Storage más estrictas
- eliminación de defaults inseguros de Firebase
- portal del trabajador movido detrás de API privada
- rate limiting y auditoría mínima en rutas sensibles

## Commits relevantes

- `79b8969` `feat: start security hardening flow`
- `e7cae1f` `fix: harden firebase config and auth logging`
- `354e099` `fix: move worker portal reads behind private api`
- `dfde9fa` `fix: harden storage rules and upload validation`
- `7103754` `feat: add rate limiting and admin audit logs`
- `4365713` `fix: make admin routes safe for production build`
- `ea3f9d9` `fix: read firebase public envs safely in client build`
- `912b93f` `fix: remove duplicate root app page`

## Qué ya quedó resuelto

### 1. Rutas admin de bolsa de trabajo

Ya exigen token válido de Firebase y rol `ADMIN`.

Rutas endurecidas:

- `src/app/api/bolsa-de-trabajo/procesar/route.ts`
- `src/app/api/bolsa-de-trabajo/importar/route.ts`
- `src/app/api/bolsa-de-trabajo/extraer/route.ts`

### 2. Configuración Firebase

Ya no se permite trabajar con defaults inseguros.

Archivos clave:

- `src/lib/firebase/config.ts`
- `src/lib/firebase/admin.ts`

### 3. Portal del trabajador

El portal privado ya no lee `bolsa_de_trabajo_documentos` ni `registros` directo desde cliente.

Ahora usa:

- `src/app/api/trabajador/mis-tramites/route.ts`
- `src/app/api/trabajador/mis-tramites/[documentoId]/route.ts`
- `src/lib/firebase/trabajador-portal.ts`

Además, la consulta transitoria por matrícula ya también lee server-side con Admin SDK:

- `src/app/api/trabajador/posicion/route.ts`

### 4. Reglas

Se endurecieron:

- `firestore.rules`
- `storage.rules`

Estado conceptual actual:

- `sincronizaciones` y `bolsa_de_trabajo_documentos` quedan cerradas a `ADMIN` en reglas
- `uploads/{userId}/...` permite lectura del dueño y del admin
- los uploads de registro aceptan sólo tipos permitidos y límite de tamaño

### 5. Validación de archivos

Ya existe validación explícita de tipo y tamaño en cliente y servidor.

Archivos relevantes:

- `src/app/api/bolsa-de-trabajo/procesar/route.ts`
- `src/components/bolsa-de-trabajo/BulkFileUpload.tsx`
- `src/components/bolsa-de-trabajo/FileUpload.tsx`
- `src/components/registro/StepDocs.tsx`

### 6. Defensa operativa

Ya existe rate limiting básico en rutas sensibles mediante:

- `src/lib/security/rate-limit.ts`

Y auditoría mínima admin mediante:

- `src/lib/firebase/admin-audit.ts`

Actualmente se registra auditoría en:

- procesar archivo
- importar registros
- extraer archivo

### 7. Despliegue y estabilidad de producción

Durante esta sesión también quedó resuelto el bloqueo de despliegue en Vercel.

Problemas corregidos:

- lectura dinámica de variables `NEXT_PUBLIC_FIREBASE_*` en cliente
- inicialización temprana de Firebase Admin durante build
- conflicto estructural por tener dos páginas resolviendo `/`

Correcciones aplicadas:

- `src/lib/firebase/config.ts`
- `src/lib/firebase/admin.ts`
- rutas API marcadas como dinámicas
- eliminación de `src/app/(main)/page.tsx`

Resultado:

- `npm run build` quedó verde
- el despliegue de producción pasó correctamente
- la aplicación quedó publicada y operativa en Vercel

## Qué falta

### 1. Operaciones admin aún directas desde cliente

Todavía hay operaciones admin que pasan directo por SDK cliente/Firestore y por eso no dejan auditoría completa ni control server-side fino.

La siguiente fase natural es mover esas operaciones a rutas API privadas.

### 2. Revisión final de colecciones

Conviene hacer una pasada final sobre:

- `users`
- `notifications`
- flujos de validación admin
- cualquier listener admin que todavía dependa de permisos demasiado amplios

### 3. Validación manual negativa

Falta una prueba operativa más explícita de abuso:

- confirmar `429` en rutas sensibles
- confirmar que un usuario no admin no puede operar bolsa
- confirmar que el portal del trabajador sigue estable después del endurecimiento

## Estado técnico al cierre

Validaciones técnicas recientes:

- `npm run typecheck`: verde
- `npm run lint`: verde
- `npm run build`: verde

Estado operativo:

- producción desplegada correctamente
- smoke test básico en producción reportado como estable
- bolsa de trabajo y portal del trabajador operativos en su flujo principal

## Recomendación para la siguiente sesión

Continuar con:

1. migrar operaciones admin directas a server-side
2. ampliar auditoría a más acciones críticas
3. revisar colecciones y listeners admin residuales
4. cerrar la spec con una checklist manual final de seguridad

## Punto de reanudación sugerido

Si se retoma la conversación después de archivar este chat, el mejor punto de entrada es:

1. asumir que el deploy ya está resuelto y producción está arriba
2. asumir que el hardening base ya quedó bastante avanzado
3. continuar con migración de operaciones admin directas a server-side
4. después retomar validación fina del motor de posiciones y QA por tipo
