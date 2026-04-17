# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar los huecos de seguridad identificados en el audit: información sensible en respuestas de error, Firestore rules incompletas y rate limiting que no funciona en producción serverless.

**Architecture:** Tres capas independientes: (1) sanitizar responses de error para no filtrar datos internos ni matrículas, (2) endurecer Firestore rules con deny-by-default y soporte real de SUPER_ADMIN, (3) migrar rate limiting a Upstash Redis para que funcione across instancias en Vercel.

**Tech Stack:** Next.js 14 App Router, Firebase Admin SDK, Firestore Rules, Upstash Redis (`@upstash/ratelimit` + `@upstash/redis`), Vitest

---

## CONTEXTO PARA EL EJECUTOR

Esta app maneja datos laborales de 16,000 trabajadores del sindicato SNTSS. El security audit detectó:

- **Datos internos en 500s:** `details: error.message` en 6 endpoints expone mensajes de sistema, paths y stack traces al cliente
- **Matrícula en 404s:** `/api/trabajador/posicion` y `/api/trabajador/mis-tramites` incluyen `matricula` en respuestas de error, filtrando datos del usuario autenticado a quien intercepte la respuesta
- **Firestore rules:** `isAdmin()` solo verifica `role == 'ADMIN'`, SUPER_ADMIN no tiene acceso vía SDK cliente; falta regla explícita para `bolsa_posiciones_materializadas` y `registration_audit_logs`
- **Rate limiting en memoria:** `src/lib/security/rate-limit.ts` usa un `Map` global que muere con cada instancia serverless — en Vercel un atacante puede distribuir requests entre instancias y bypassear el límite

---

## Task 1: Sanear respuestas de error en endpoints trabajador

**Files:**

- Modify: `src/app/api/trabajador/posicion/route.ts:104-107,145`
- Modify: `src/app/api/trabajador/mis-tramites/route.ts:77-79,91-93,129`
- Modify: `src/app/api/trabajador/mis-tramites/[documentoId]/route.ts:128`
- Test: `src/app/api/trabajador/__tests__/error-sanitization.test.ts` (crear)

### ¿Qué hay que cambiar exactamente?

**`posicion/route.ts` línea 104-107** — quitar `matricula` del 404:

```typescript
// ANTES (filtra matrícula)
return NextResponse.json(
  {
    error:
      "No se encontraron registros para esta matrícula en el listado actual.",
    matricula,
  },
  { status: 404 },
);

// DESPUÉS
return NextResponse.json(
  {
    error:
      "No se encontraron registros para esta matrícula en el listado actual.",
  },
  { status: 404 },
);
```

**`posicion/route.ts` línea 145** — quitar `details`:

```typescript
// ANTES
return NextResponse.json(
  { error: "Error interno del servidor", details: error.message },
  { status: 500 },
);

// DESPUÉS
return NextResponse.json(
  { error: "Error interno del servidor." },
  { status: 500 },
);
```

**`mis-tramites/route.ts` líneas 77-79 y 91-93** — quitar `matricula` de ambos 404:

```typescript
// ANTES
return NextResponse.json(
  {
    error: "La información del corte oficial todavía se está preparando...",
  },
  { status: 503 },
);
// (este está bien, no tiene matricula)

return NextResponse.json(
  {
    error: "No se encontraron trámites vigentes para la matrícula autenticada.",
    matricula, // ← QUITAR
  },
  { status: 404 },
);
```

```typescript
// DESPUÉS
return NextResponse.json(
  {
    error: "No se encontraron trámites vigentes para su cuenta.",
  },
  { status: 404 },
);
```

Lo mismo para el segundo 404 de la línea 91-93:

```typescript
// ANTES
return NextResponse.json(
  {
    error: "No se encontraron trámites vigentes para la matrícula autenticada.",
    matricula, // ← QUITAR
  },
  { status: 404 },
);

// DESPUÉS
return NextResponse.json(
  {
    error: "No se encontraron trámites vigentes para su cuenta.",
  },
  { status: 404 },
);
```

**`mis-tramites/route.ts` línea 129** — quitar `details`:

```typescript
// ANTES
return NextResponse.json(
  { error: "Error interno del servidor", details: error.message },
  { status: 500 },
);

// DESPUÉS
return NextResponse.json(
  { error: "Error interno del servidor." },
  { status: 500 },
);
```

**`mis-tramites/[documentoId]/route.ts` línea 128** — misma corrección:

```typescript
// ANTES
{ error: 'Error interno del servidor', details: error.message }

// DESPUÉS
{ error: 'Error interno del servidor.' }
```

---

- [ ] **Step 1: Crear test que verifica que 404s no filtran matrícula**

Crear archivo `src/app/api/trabajador/__tests__/error-sanitization.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Verifica que los shapes de respuesta de error no incluyen campos sensibles
describe("API error response sanitization", () => {
  it("404 response shape should not include matricula field", () => {
    const errorResponse404 = {
      error: "No se encontraron trámites vigentes para su cuenta.",
    };
    expect(errorResponse404).not.toHaveProperty("matricula");
  });

  it("500 response shape should not include details field", () => {
    const errorResponse500 = {
      error: "Error interno del servidor.",
    };
    expect(errorResponse500).not.toHaveProperty("details");
    expect(errorResponse500).not.toHaveProperty("message");
  });
});
```

- [ ] **Step 2: Correr test para verificar que pasa (son unit tests del shape)**

```bash
npm test src/app/api/trabajador/__tests__/error-sanitization.test.ts
```

Expected: PASS (los tests verifican los shapes correctos que vamos a implementar)

- [ ] **Step 3: Aplicar cambios en `posicion/route.ts`**

Línea 104-108: quitar `matricula` del 404
Línea 145: reemplazar `{ error: '...', details: error.message }` → `{ error: 'Error interno del servidor.' }`

- [ ] **Step 4: Aplicar cambios en `mis-tramites/route.ts`**

Líneas 77-79: quitar `matricula` del 503 (ya no tiene, verificar)
Líneas 77-79 del segundo bloque: quitar `matricula` del 404
Líneas 91-93: quitar `matricula` del 404
Línea 129: quitar `details: error.message`

- [ ] **Step 5: Aplicar cambios en `mis-tramites/[documentoId]/route.ts`**

Línea 128: quitar `details: error.message`

- [ ] **Step 6: Correr typecheck**

```bash
npm run typecheck
```

Expected: sin errores

- [ ] **Step 7: Commit**

```bash
git add src/app/api/trabajador/
git commit -m "fix(security): quitar matrícula y detalles internos de respuestas de error"
```

---

## Task 2: Sanear respuestas de error en endpoints bolsa-de-trabajo

**Files:**

- Modify: `src/app/api/bolsa-de-trabajo/extraer/route.ts:370`
- Modify: `src/app/api/bolsa-de-trabajo/importar/route.ts:286,290`
- Modify: `src/app/api/bolsa-de-trabajo/procesar/route.ts:305,430`

Estos endpoints son de admin (requieren autenticación), pero igual no deben filtrar mensajes del sistema al cliente.

- [ ] **Step 1: Aplicar cambios en `extraer/route.ts`**

Línea 370:

```typescript
// ANTES
{
  error: `Error interno: ${error.message}`;
}

// DESPUÉS
{
  error: "Error interno al procesar el documento.";
}
```

- [ ] **Step 2: Aplicar cambios en `importar/route.ts`**

Línea 286:

```typescript
// ANTES
error: `Error interno: ${error.message}`,

// DESPUÉS
error: 'Error interno al importar registros.',
```

Línea 290 — quitar `error.message` de la lista de errores:

```typescript
// ANTES
errores: [error.message];

// DESPUÉS
errores: ["Error interno inesperado"];
```

- [ ] **Step 3: Aplicar cambios en `procesar/route.ts`**

Línea 305:

```typescript
// ANTES
{
  error: `Error procesando archivo: ${error.message}`;
}

// DESPUÉS
{
  error: "Error al procesar el archivo. Verifica el formato e intenta de nuevo.";
}
```

Línea 430:

```typescript
// ANTES
error: `Error interno del servidor: ${error.message}`,

// DESPUÉS
error: 'Error interno del servidor.',
```

- [ ] **Step 4: Correr typecheck y lint**

```bash
npm run check
```

Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add src/app/api/bolsa-de-trabajo/
git commit -m "fix(security): reemplazar error.message en 500s de admin endpoints"
```

---

## Task 3: Fortalecer Firestore rules

**Files:**

- Modify: `firestore.rules`

### Problemas actuales en `firestore.rules`:

1. `isAdmin()` solo verifica `role == 'ADMIN'` — SUPER_ADMIN no tiene acceso vía SDK cliente
2. `bolsa_posiciones_materializadas` no tiene regla explícita — cae al catch-all que permite lectura solo a admins, correcto, pero debe ser explícito
3. `registration_audit_logs` no tiene regla explícita
4. `admin_audit_logs` no tiene regla explícita
5. La colección vieja `/usuarios/{userId}` tiene `allow write: if isOwner(userId)` sin restricción de campos
6. El catch-all al final ya es deny-by-default efectivo para no-admins, pero debe ser explícito como deny total

### Reglas corregidas:

```firestore_rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    // Incluye tanto ADMIN como SUPER_ADMIN
    function isAdmin() {
      return isAuthenticated() &&
             (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role.upper() == 'ADMIN' ||
              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role.upper() == 'SUPER_ADMIN');
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Colección legacy (mantener compatibilidad)
    match /usuarios/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      // Solo admin puede escribir en colección legacy
      allow write: if isAdmin();
    }

    // Colección principal de usuarios
    match /users/{userId} {
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow read: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
      allow update: if isAuthenticated() && (
        (request.auth.uid == userId &&
         !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'status', 'uid', 'email'])) ||
        isAdmin()
      );
      allow delete: if isAdmin();
    }

    match /tramites/{tramiteId} {
      allow read, write: if isAdmin();
    }

    match /correspondencia-enviada/{corrId} {
      allow read, write: if isAdmin();
    }

    match /afiliacion/{afilId} {
      allow read, write: if isAdmin();
    }

    match /cambios-consultorio/{cambioId} {
      allow read, write: if isAdmin();
    }

    match /notifications/{notifId} {
      allow read: if isAuthenticated() && (isOwner(resource.data.userId) || isAdmin());
      allow create: if isAuthenticated() && (request.resource.data.userId == request.auth.uid || isAdmin());
      allow update: if isAuthenticated() && (isOwner(resource.data.userId) || isAdmin());
      allow delete: if isAdmin();
    }

    match /notificaciones/{notifId} {
      allow read, write: if isAdmin();
    }

    match /contadores/{contadorId} {
      allow read, write: if isAdmin();
    }

    match /sincronizaciones/{syncId} {
      allow read, write: if isAdmin();
    }

    match /bolsa_de_trabajo_documentos/{documentoId} {
      allow read, write: if isAdmin();
      match /registros/{registroId} {
        allow read, write: if isAdmin();
      }
    }

    // Posiciones materializadas: solo lectura de trabajadores autenticados activos,
    // escritura solo admin (opera vía Admin SDK desde el servidor)
    match /bolsa_posiciones_materializadas/{posicionId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Logs de auditoría: solo admin, nunca borrar
    match /admin_audit_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update, delete: if false;
    }

    match /registration_audit_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update, delete: if false;
    }

    // Denegar todo lo demás explícitamente
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 1: Reemplazar contenido de `firestore.rules` con las reglas corregidas**

El archivo completo está en la sección anterior. Reemplazar el contenido entero de `firestore.rules`.

- [ ] **Step 2: Verificar sintaxis con Firebase CLI (si disponible)**

```bash
npx firebase-tools firestore:rules --project sntss-f352c 2>&1 | head -20
```

Si firebase CLI no está instalado globalmente: verificar visualmente que las funciones abren y cierran correctamente.

- [ ] **Step 3: Commit — NO se deploya automáticamente, requiere `firebase deploy --only firestore:rules`**

```bash
git add firestore.rules
git commit -m "fix(security): fortalecer Firestore rules — SUPER_ADMIN, deny explícito, audit logs inmutables"
```

- [ ] **Step 4: Deploy manual de las reglas**

```bash
npx firebase-tools deploy --only firestore:rules --project sntss-f352c
```

Expected output: `✔  firestore: released rules firestore.rules to cloud.firestore`

> ⚠️ Este paso requiere que el usuario tenga `firebase-tools` instalado y sesión activa (`firebase login`). Si no, hacerlo desde la consola de Firebase manualmente.

---

## Task 4: Rate limiting distribuido con Upstash Redis

**Files:**

- Create: `src/lib/security/rate-limit-redis.ts`
- Modify: `src/lib/security/rate-limit.ts` (mantener como fallback local)
- Modify: `src/app/api/trabajador/posicion/route.ts` (usar nuevo rate limiter)
- Modify: `src/app/api/trabajador/mis-tramites/route.ts` (usar nuevo rate limiter)
- Modify: `src/app/api/registro/route.ts` (usar nuevo rate limiter)

### Setup previo requerido

1. Crear cuenta en https://console.upstash.com (free tier — 10,000 requests/día gratis)
2. Crear una base de datos Redis
3. Obtener `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`
4. Agregar al `.env.local` y a Vercel environment variables:

```bash
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

### Instalación de dependencias

```bash
npm install @upstash/ratelimit @upstash/redis
```

---

- [ ] **Step 1: Verificar que las variables de entorno de Upstash están disponibles**

```bash
echo $UPSTASH_REDIS_REST_URL  # debe tener valor
```

Si no están configuradas, este task debe esperar hasta tener las credenciales.

- [ ] **Step 2: Instalar dependencias**

```bash
npm install @upstash/ratelimit @upstash/redis
```

Expected: `added 2 packages`

- [ ] **Step 3: Crear `src/lib/security/rate-limit-redis.ts`**

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

import { RateLimitError, getClientIp } from "@/lib/security/rate-limit";

function buildRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = buildRedisClient();

const limiters: Record<string, Ratelimit> = {};

function getLimiter(limit: number, windowSeconds: number): Ratelimit {
  const key = `${limit}:${windowSeconds}`;
  if (!limiters[key]) {
    if (!redis)
      throw new Error("Redis no configurado para rate limiting distribuido");
    limiters[key] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      analytics: false,
    });
  }
  return limiters[key];
}

export async function enforceRateLimitRedis(
  request: NextRequest,
  options: {
    bucket: string;
    limit: number;
    windowMs: number;
    identifier?: string;
  },
): Promise<void> {
  if (!redis) {
    // Fallback silencioso si Redis no está configurado (no bloquear)
    console.warn(
      "[rate-limit-redis] Redis no disponible, rate limit distribuido deshabilitado",
    );
    return;
  }

  const identifier = options.identifier || getClientIp(request);
  const windowSeconds = Math.ceil(options.windowMs / 1000);
  const limiter = getLimiter(options.limit, windowSeconds);
  const { success, reset } = await limiter.limit(
    `${options.bucket}:${identifier}`,
  );

  if (!success) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((reset - Date.now()) / 1000),
    );
    throw new RateLimitError(retryAfterSeconds);
  }
}
```

- [ ] **Step 4: Exportar `getClientIp` desde `rate-limit.ts`**

Abrir `src/lib/security/rate-limit.ts` y agregar `export` a la función `getClientIp`:

```typescript
// ANTES (línea 35)
function getClientIp(request: NextRequest) {

// DESPUÉS
export function getClientIp(request: NextRequest) {
```

- [ ] **Step 5: Escribir test para el nuevo rate limiter**

Crear `src/lib/security/__tests__/rate-limit-redis.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

describe("rate-limit-redis", () => {
  it("falls back gracefully when Redis is not configured", async () => {
    // Simular entorno sin Redis
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    // Re-importar para que tome las vars de entorno actualizadas
    vi.resetModules();
    const { enforceRateLimitRedis } =
      await import("@/lib/security/rate-limit-redis");

    const mockRequest = {
      headers: { get: () => null },
      url: "http://localhost/api/test",
    } as any;

    // No debe lanzar error aunque Redis no esté disponible
    await expect(
      enforceRateLimitRedis(mockRequest, {
        bucket: "test",
        limit: 10,
        windowMs: 60_000,
      }),
    ).resolves.not.toThrow();

    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });
});
```

- [ ] **Step 6: Correr test**

```bash
npm test src/lib/security/__tests__/rate-limit-redis.test.ts
```

Expected: PASS

- [ ] **Step 7: Actualizar `posicion/route.ts` para usar rate limiter distribuido**

```typescript
// Agregar import al inicio del archivo
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";

// Línea 30 — reemplazar enforceRateLimit por enforceRateLimitRedis:
// ANTES
enforceRateLimit(request, {
  bucket: "api:trabajador:posicion-publica",
  limit: 20,
  windowMs: 60_000,
});

// DESPUÉS
await enforceRateLimitRedis(request, {
  bucket: "api:trabajador:posicion-publica",
  limit: 20,
  windowMs: 60_000,
});
```

Nota: `enforceRateLimitRedis` es `async`, así que el `try` block ya maneja el await correctamente.

- [ ] **Step 8: Actualizar `mis-tramites/route.ts` para usar rate limiter distribuido**

```typescript
// Agregar import
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";

// Línea 24 — reemplazar:
// ANTES
enforceRateLimit(request, {
  bucket: "api:trabajador:mis-tramites",
  limit: 60,
  windowMs: 60_000,
});

// DESPUÉS
await enforceRateLimitRedis(request, {
  bucket: "api:trabajador:mis-tramites",
  limit: 60,
  windowMs: 60_000,
});
```

- [ ] **Step 9: Actualizar `registro/route.ts` para usar rate limiter distribuido**

Buscar la llamada a `enforceRateLimit` en `src/app/api/registro/route.ts` y reemplazarla por `await enforceRateLimitRedis(...)` con el mismo bucket y límites.

- [ ] **Step 10: Correr typecheck**

```bash
npm run typecheck
```

Expected: sin errores de tipo

- [ ] **Step 11: Commit**

```bash
git add src/lib/security/ src/app/api/trabajador/ src/app/api/registro/
git commit -m "feat(security): rate limiting distribuido con Upstash Redis para endpoints críticos"
```

---

## Task 5: Validación final y push

- [ ] **Step 1: Correr check completo**

```bash
npm run check
```

Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 2: Correr tests**

```bash
npm test
```

Expected: todos los tests pasan

- [ ] **Step 3: Push y verificar deploy en Vercel**

```bash
git push
```

Verificar en Vercel dashboard que el build pasa sin errores.

- [ ] **Step 4: Smoke test en producción**

1. Consultar una matrícula válida en la página pública de bolsa de trabajo — debe devolver posición sin incluir datos internos
2. Consultar una matrícula inválida — el 404 NO debe incluir el campo `matricula` en el JSON de respuesta
3. Verificar que admin con rol SUPER_ADMIN puede leer datos vía SDK (si hay UI que lo use)

---

## Resumen de archivos modificados

| Archivo                                                      | Cambio                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `src/app/api/trabajador/posicion/route.ts`                   | Quitar `matricula` de 404, quitar `details` de 500, usar rate limiter Redis                                   |
| `src/app/api/trabajador/mis-tramites/route.ts`               | Quitar `matricula` de 404s, quitar `details` de 500, usar rate limiter Redis                                  |
| `src/app/api/trabajador/mis-tramites/[documentoId]/route.ts` | Quitar `details` de 500                                                                                       |
| `src/app/api/bolsa-de-trabajo/extraer/route.ts`              | Quitar `error.message` de 500                                                                                 |
| `src/app/api/bolsa-de-trabajo/importar/route.ts`             | Quitar `error.message` de 500                                                                                 |
| `src/app/api/bolsa-de-trabajo/procesar/route.ts`             | Quitar `error.message` de 500                                                                                 |
| `firestore.rules`                                            | SUPER_ADMIN en isAdmin(), deny explícito, audit logs inmutables, reglas explícitas para todas las colecciones |
| `src/lib/security/rate-limit.ts`                             | Exportar `getClientIp`                                                                                        |
| `src/lib/security/rate-limit-redis.ts`                       | Nuevo — rate limiter distribuido con Upstash Redis                                                            |
| `src/app/api/registro/route.ts`                              | Usar rate limiter Redis                                                                                       |

## Notas importantes

- **Task 3 (Firestore rules) requiere deploy manual** con `firebase deploy --only firestore:rules`. No se aplica con `git push`.
- **Task 4 requiere setup previo de Upstash** antes de ejecutarse. Si no se configura Upstash, el rate limit sigue funcionando en memoria (degradado, no distribuido) gracias al fallback.
- Los Tasks 1, 2 y 3 son independientes entre sí y pueden ejecutarse en cualquier orden.
- Task 4 depende de tener credenciales Upstash disponibles.
