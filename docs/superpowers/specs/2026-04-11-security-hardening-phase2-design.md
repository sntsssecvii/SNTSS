# Security Hardening Phase 2 — Design Spec

**Goal:** Cerrar los huecos de seguridad restantes: eliminar acceso público a datos de bolsa de trabajo, agregar HTTP security headers, CORS explícito en APIs críticas, y validación de magic bytes en uploads.

**Architecture:** Enfoque híbrido — middleware para bloqueo de rutas, `next.config.mjs` para headers globales, helpers por-ruta para CORS y validación de archivos.

**Tech Stack:** Next.js 14 App Router, Firebase Admin SDK, TypeScript

---

## Contexto

Esta es la segunda fase del security hardening del sistema SNTSS (16,000 trabajadores, datos laborales sensibles). La fase 1 cubrió: sanitización de error responses, Firestore rules, rate limiting distribuido con Upstash Redis.

Vulnerabilidades que cierra esta fase:

1. **Ruta pública de bolsa de trabajo** — cualquier persona con una matrícula podía ver la posición de otro trabajador sin autenticarse
2. **Sin HTTP security headers** — expuesto a clickjacking, MIME sniffing, XSS reflejado
3. **CORS permisivo** — cualquier dominio puede llamar las APIs desde el browser
4. **Validación de uploads solo por MIME/extensión** — falsificable por el cliente

---

## Componentes

### 1. `src/lib/firebase/server-auth.ts` (modificar)

Agregar función `requireUserRequest()` — similar a `requireAdminRequest()` pero sin verificar rol de admin. Solo verifica que el token sea válido y el usuario esté activo. Devuelve `UserRequestContext` con `uid`, `email`, y `matricula` del perfil del usuario en Firestore.

```typescript
interface UserRequestContext {
  uid: string;
  email: string | null;
  matricula: string;
}

export async function requireUserRequest(
  request: NextRequest,
): Promise<UserRequestContext>;
```

Errores que lanza: `AUTH_REQUIRED`, `PROFILE_NOT_FOUND`, `ACCOUNT_INACTIVE`.

### 2. `src/app/api/trabajador/posicion/route.ts` (modificar)

- Agregar `requireUserRequest()` al inicio del handler
- Eliminar `const matriculaParam = searchParams.get("matricula")` — la matrícula ahora viene del contexto autenticado
- Pasar `context.matricula` a todas las queries de Firestore en lugar del param del cliente
- Eliminar el bucket `"api:trabajador:posicion-publica"` — reemplazar por `"api:trabajador:posicion"` (ya es autenticado)

### 3. `src/app/(public)/bolsa-de-trabajo/` (eliminar)

Eliminar los dos archivos de la ruta pública:

- `src/app/(public)/bolsa-de-trabajo/consulta/page.tsx`
- `src/app/(public)/bolsa-de-trabajo/resultado/[matricula]/page.tsx`

Si el directorio `(public)` queda vacío, eliminarlo también.

### 4. `next.config.mjs` (modificar)

Agregar `async headers()` con los siguientes headers aplicados a todas las rutas (`source: '/(.*)'`):

| Header                      | Valor                                      | Propósito                   |
| --------------------------- | ------------------------------------------ | --------------------------- |
| `X-Frame-Options`           | `DENY`                                     | Bloquea clickjacking        |
| `X-Content-Type-Options`    | `nosniff`                                  | Bloquea MIME sniffing       |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`          | Limita info en referer      |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()` | Deshabilita APIs sensibles  |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains`      | Fuerza HTTPS (2 años)       |
| `Content-Security-Policy`   | ver abajo                                  | Restringe recursos externos |

CSP (permisiva para compatibilidad con Next.js inline scripts):

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
connect-src 'self' *.googleapis.com *.firebaseio.com *.firebaseapp.com *.upstash.io;
font-src 'self';
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
```

También agregar redirects permanentes para URLs públicas antiguas:

```
/bolsa-de-trabajo/consulta → /auth/login  (permanent: true)
/bolsa-de-trabajo/resultado/:matricula → /auth/login  (permanent: true)
```

### 5. `src/lib/security/cors.ts` (crear)

Helper que verifica que el `Origin` del request coincida con el origen permitido de la app.

```typescript
export function assertSameOrigin(request: NextRequest): void;
```

- En producción: permite `process.env.NEXT_PUBLIC_APP_URL` con fallback a `https://sntssvii.com`
- En desarrollo: permite `http://localhost:3000`
- **Nota de implementación:** agregar `NEXT_PUBLIC_APP_URL=https://sntssvii.com` a `.env.local` y a Vercel env vars
- Si el header `Origin` está ausente (requests server-to-server como curl/Postman): permitir (CORS es una protección browser-only)
- Si `Origin` está presente pero no coincide: lanzar error `CORS_FORBIDDEN`

Rutas donde se aplica:

- `src/app/api/trabajador/posicion/route.ts`
- `src/app/api/trabajador/mis-tramites/route.ts`
- `src/app/api/trabajador/mis-tramites/[documentoId]/route.ts`
- `src/app/api/registro/route.ts`
- `src/app/api/admin/lab/chat-contrato/route.ts`

### 6. `src/lib/security/file-validation.ts` (crear)

Función que verifica magic bytes del archivo antes de procesarlo:

```typescript
export function validateFileMagicBytes(
  buffer: Buffer,
  expectedType: "pdf" | "xlsx" | "xls",
): boolean;
```

Firmas:

- PDF: `25 50 44 46 2D` (`%PDF-`)
- XLSX: `50 4B 03 04` (ZIP — formato Office Open XML)
- XLS: `D0 CF 11 E0` (OLE2 — formato legacy)

Se aplica en `src/app/api/bolsa-de-trabajo/procesar/route.ts` inmediatamente después de recibir el archivo y antes de pasarlo al parser. Si los magic bytes no coinciden: responder 400 con `"Formato de archivo no válido."`.

---

## Flujo de datos — posicion autenticada

```
Worker browser
  → GET /api/trabajador/posicion
    Authorization: Bearer <firebase-id-token>
  → requireUserRequest()
    → verifyIdToken(token) → uid
    → adminDb.users.doc(uid).get() → { matricula, status }
    → validar status === 'active'
    → return { uid, email, matricula }
  → consultar Firestore con matricula del contexto (no del cliente)
  → return posicion
```

---

## Manejo de errores — nuevos casos

| Error                 | Causa                         | HTTP Status |
| --------------------- | ----------------------------- | ----------- |
| `AUTH_REQUIRED`       | No hay Bearer token           | 401         |
| `PROFILE_NOT_FOUND`   | uid no tiene perfil en /users | 404         |
| `ACCOUNT_INACTIVE`    | status !== 'active'           | 403         |
| `CORS_FORBIDDEN`      | Origin no permitido           | 403         |
| Magic bytes inválidos | Archivo no es lo que dice ser | 400         |

---

## Testing

- Unit test para `validateFileMagicBytes` con buffers válidos e inválidos de PDF/XLSX/XLS
- Unit test para `assertSameOrigin` con origins permitidos y denegados
- Unit test para `requireUserRequest` (mock de adminAuth y adminDb)
- Verificación manual: acceder a `/bolsa-de-trabajo/consulta` sin auth → redirect a `/auth/login`
- Verificación manual: `curl /api/trabajador/posicion` sin token → 401
- Verificación manual: `curl /api/trabajador/posicion` con header `Origin: https://evil.com` → 403

---

## Notas de implementación

- `requireUserRequest` NO verifica rol — cualquier usuario activo puede usarlo
- Los errores `AUTH_REQUIRED`, `PROFILE_NOT_FOUND`, `ACCOUNT_INACTIVE` ya tienen manejo en los route handlers existentes — reutilizar los mismos bloques catch
- El `NEXT_PUBLIC_APP_URL` ya debe existir en `.env.local` y Vercel — verificar antes de implementar
- La eliminación de las páginas públicas puede dejar el directorio `src/app/(public)/` vacío si no hay otras rutas — en ese caso eliminarlo también para no dejar estructura muerta
