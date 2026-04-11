# Design Doc: User Management v2

**Fecha:** 2026-04-10
**Estado:** Aprobado
**Contexto:** Feedback de reunión con Miguel Espinoza (inge). Cambios a implementar en rama feature separada de main (main tiene cambios de seguridad en curso).

---

## Resumen

Siete mejoras al sistema de registro, validación y gestión de usuarios del portal SNTSS. Agrupadas en cinco áreas de trabajo.

---

## Área 1 — Mejoras al Formulario de Registro

### 1.1 Apellido materno opcional

**Motivación:** Hay personas que no tienen apellido materno legalmente.

**Cambios:**

- `src/lib/schemas/registro.ts`: `apellidoMaterno` cambia de `z.string().min(2)` a `z.string().optional()`
- `src/components/registro/StepInfo.tsx`: agregar `<Checkbox>` debajo del campo con label "No tengo apellido materno". Al activarlo: input se deshabilita y limpia
- `src/app/api/registro/route.ts`: aceptar `apellidoMaterno` vacío/null, guardarlo como `null` en Firestore (no string vacío)
- `displayName` en Firebase Auth: construirlo filtrando campos vacíos (ya lo hace con `.filter(Boolean)`)

### 1.2 Tercer documento: Constancia de Afiliación

**Motivación:** Miguel solicitó verificar afiliación sindical en el registro.

**Cambios:**

- `StepDocs.tsx`: nueva `FileCard` para `constanciaAfiliacion`, layout: 2 arriba + 1 centrado abajo en desktop, columna en móvil
- Interfaz `{ identificacion, tarjeton }` → `{ identificacion, tarjeton, constanciaAfiliacion }`
- `RegistroForm.tsx`: pasar `constanciaAfiliacion` en el submit
- `route.ts`: validar y subir el tercer archivo a `uploads/${uid}/constanciaAfiliacion_${timestamp}.ext`
- Firestore: `documents.constanciaAfiliacion: string` (URL)

### 1.3 Normalización de nombres en tiempo real

**Motivación:** Usuarios se registran con nombres en mayúsculas, minúsculas o inconsistentes.

**Cambios:**

- `src/lib/utils/text.ts`: función `toTitleCase(str: string): string` — trim + capitaliza primera letra de cada palabra, respeta partículas comunes (de, del, la, las, los)
- `StepInfo.tsx`: `onBlur` en campos `nombre`, `apellidoPaterno`, `apellidoMaterno` → aplica `toTitleCase`
- No se normaliza mientras el usuario escribe, solo al salir del campo

---

## Área 2 — Borrado de Documentos al Validar

**Motivación:** Los tarjetones de pago contienen información financiera sensible. Miguel solicitó explícitamente que se eliminen después de la validación.

**Flujo al aprobar usuario (status: pending → active):**

1. Eliminar los 3 archivos de Firebase Storage (`uploads/${uid}/`)
2. En Firestore del usuario: `documents = { identificacion: null, tarjeton: null, constanciaAfiliacion: null }`
3. Agregar campos de auditoría: `documentsDeletedAt: Timestamp`, `validatedBy: adminUid`, `validatedAt: Timestamp`

**Manejo de errores:**

- Si el borrado de Storage falla (archivo ya no existe, error de red): se loguea el error pero la aprobación **no se revierte**. La aprobación no puede fallar por cleanup.
- El log de error queda en la auditoría del documento

**Archivos afectados:** `src/app/api/admin/validaciones/solicitudes/route.ts` (el PUT/PATCH que cambia status) y `src/app/api/admin/validaciones/solicitudes/[uid]/route.ts`.

---

## Área 3 — Restablecimiento de Contraseña con Resend

**Motivación:** No existe flujo de recuperación de contraseña actualmente.

### Arquitectura

```
Usuario → /login/recuperar → POST /api/auth/reset-password
                                      ↓
                          adminAuth.generatePasswordResetLink()
                                      ↓
                              Resend (email custom)
                                      ↓
                          Usuario recibe link de Firebase
```

**Componentes:**

- `src/app/(auth)/login/recuperar/page.tsx`: página con input de email y botón "Enviar instrucciones"
- `src/app/api/auth/reset-password/route.ts`: endpoint POST
  - Rate limit Redis: 3 intentos / hora por email (bucket: `api:auth:reset:email`)
  - Llama `adminAuth.generatePasswordResetLink(email, actionCodeSettings)`
  - `actionCodeSettings.url`: `https://sntssvii.com/login` (continueUrl post-reset)
  - Envía email con Resend usando plantilla personalizada (logo SNTSS, español, link incluido)
  - Respuesta: siempre `200 OK` con mensaje genérico — no confirma si el email existe (**anti-enumeration**)
- Template de email: HTML con logo SNTSS, texto en español, botón con el link

**Nota:** La página de acción del link (`/api/action?mode=resetPassword&oobCode=...`) la sirve Firebase. El `continueUrl` devuelve al usuario a `/login` después de cambiar la contraseña.

---

## Área 4 — Roles y Cuentas de Administración

### 4.1 Nuevo rol `BOLSA`

**Motivación:** El usuario de bolsa de trabajo (Gabriela Chapital) solo debe operar esa sección.

**Cambios en `src/types/roles.ts`:**

```ts
BOLSA = "BOLSA";

// Permisos:
PERMISOS_POR_ROL[ROLES.BOLSA] = [
  PERMISOS.CARGAR_BOLSA_TRABAJO,
  PERMISOS.PROCESAR_BOLSA_TRABAJO,
  PERMISOS.VER_BOLSA_TRABAJO,
  PERMISOS.VALIDAR_BOLSA_TRABAJO,
  PERMISOS.ELIMINAR_BOLSA_TRABAJO,
  PERMISOS.EXPORTAR_BOLSA_TRABAJO,
];
```

**Restricción de rutas:** El guard de rutas admin redirige a `/admin/bolsa-de-trabajo` si el rol es `BOLSA` y la ruta solicitada no pertenece a esa sección. Aplica en `src/app/(main)/layout.tsx` que ya maneja auth.

### 4.2 Flag `isDeveloper`

**Motivación:** Gerardo necesita acceso a secciones técnicas (logs, monitoreo) que el admin del sindicato no debe ver.

**Implementación:**

- Campo `isDeveloper: boolean` en el documento de usuario en Firestore
- **No es un permiso RBAC** — es un feature flag independiente
- El layout/guards de secciones técnicas checa `user.isDeveloper === true`
- Solo un SUPER_ADMIN puede modificarlo en el futuro (por ahora solo vía Firestore directo o script)

### 4.3 SUPER_ADMIN ocultos en lista de usuarios

**Motivación:** Las cuentas técnicas no deben aparecer mezcladas con los agremiados.

**Implementación:** Todas las queries de la colección `users` en el panel admin agregan:

```ts
.where('role', 'not-in', ['SUPER_ADMIN'])
// Comentario: Las cuentas SUPER_ADMIN se excluyen intencionalmente de esta vista.
```

Los SUPER_ADMIN existen en Firestore y Firebase Auth pero son invisibles en el panel.

### 4.4 Script de creación de cuentas admin

**Archivo:** `scripts/create-admin-users.ts`
**Ejecución:** `ts-node scripts/create-admin-users.ts` (una sola vez, idempotente)

**Cuentas que crea:**

| Nombre                       | Email                     | Rol         | isDeveloper |
| ---------------------------- | ------------------------- | ----------- | ----------- |
| Gerardo Arroyo               | gerardoyx@gmail.com       | SUPER_ADMIN | true        |
| Juan Miguel Espinoza Aguilar | admin@sntssvii.com        | SUPER_ADMIN | false       |
| Gabriela Chapital            | gaby.chapital@hotmail.com | BOLSA       | false       |

**Contraseña inicial:** `123456` (hardcodeada en script con comentario `// CAMBIAR INMEDIATAMENTE`)
**Comportamiento:** Si el usuario ya existe en Auth → actualiza el doc en Firestore en lugar de fallar.
**Output:** Log en consola de lo que creó/actualizó.

---

## Área 5 — Normalización de Nombres Existentes

**Archivo:** `scripts/normalize-nombres.ts`
**Ejecución:** `ts-node scripts/normalize-nombres.ts` (one-shot, idempotente)

**Flujo:**

1. Itera todos los docs en colección `users` excluyendo SUPER_ADMIN
2. Aplica `toTitleCase()` a `nombre`, `apellidoPaterno`, `apellidoMaterno`
3. Si hubo cambio: actualiza Firestore + `displayName` en Firebase Auth
4. Genera log `artifacts/normalize-nombres-2026-04-10.json` con `{ uid, antes, después }` por cada cambio

**Seguridad:** No toca contraseñas, emails, matrícula ni roles. Solo campos de nombre.

---

## Rama de trabajo

Crear rama `feat/user-management-v2` desde `main` actual. No mezclar con los cambios de seguridad que están en progreso en `main`. Al terminar, PR hacia `main`.

---

## Orden de implementación sugerido

1. `src/lib/utils/text.ts` — `toTitleCase` (base para todo lo demás)
2. Schema + `StepInfo` — apellido materno opcional + normalización
3. `StepDocs` + API registro — tercer documento
4. `src/types/roles.ts` — rol `BOLSA`
5. API validación — borrado de documentos al aprobar
6. `/login/recuperar` + `/api/auth/reset-password` — reset de contraseña
7. Guard de rutas para rol `BOLSA`
8. SUPER_ADMIN filtrados en queries del admin
9. `scripts/create-admin-users.ts`
10. `scripts/normalize-nombres.ts`

---

## Archivos principales a tocar

| Archivo                                                     | Cambio                           |
| ----------------------------------------------------------- | -------------------------------- |
| `src/lib/schemas/registro.ts`                               | apellidoMaterno opcional         |
| `src/lib/utils/text.ts`                                     | nueva función toTitleCase        |
| `src/components/registro/StepInfo.tsx`                      | checkbox + normalización onBlur  |
| `src/components/registro/StepDocs.tsx`                      | tercer documento                 |
| `src/components/registro/RegistroForm.tsx`                  | pasar constanciaAfiliacion       |
| `src/app/api/registro/route.ts`                             | tercer documento + apellido null |
| `src/app/api/admin/validaciones/solicitudes/route.ts`       | borrado de docs al aprobar       |
| `src/app/api/admin/validaciones/solicitudes/[uid]/route.ts` | borrado de docs al aprobar       |
| `src/app/(auth)/login/recuperar/page.tsx`                   | nueva página                     |
| `src/app/api/auth/reset-password/route.ts`                  | nuevo endpoint                   |
| `src/types/roles.ts`                                        | rol BOLSA + isDeveloper          |
| `src/app/(main)/layout.tsx`                                 | guard rol BOLSA (redirect)       |
| `scripts/create-admin-users.ts`                             | nuevo script                     |
| `scripts/normalize-nombres.ts`                              | nuevo script                     |
