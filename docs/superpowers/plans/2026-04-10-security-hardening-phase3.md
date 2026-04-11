# Security Hardening Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parchear CVE-2025-29927 en Next.js y el CVE de path traversal en jspdf, y cerrar los cinco gaps pendientes de Phase 2.

**Architecture:** Dos líneas independientes — dependency upgrades primero (next@14.2.35, jspdf@2.5.2), luego app-level fixes usando helpers de Phase 2 ya existentes (validateFileMagicBytes, enforceRateLimitRedis). Sin cambios de schema ni Firebase rules.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vitest, npm

---

## Mapa de archivos

| Archivo                                                      | Operación                                                 | Tarea  |
| ------------------------------------------------------------ | --------------------------------------------------------- | ------ |
| `package.json`                                               | Modificar — next 14.2.35, eslint-config-next 14.2.35      | Task 1 |
| `package.json`                                               | Modificar — jspdf 2.5.2                                   | Task 2 |
| `src/lib/security/cors.ts`                                   | Modificar — gate localhost en NODE_ENV=production         | Task 3 |
| `src/lib/security/__tests__/cors.test.ts`                    | Modificar — agregar test NODE_ENV=production              | Task 3 |
| `.env.example`                                               | Crear                                                     | Task 4 |
| `src/app/api/bolsa-de-trabajo/extraer/route.ts`              | Modificar — magic bytes después de buffer                 | Task 5 |
| `src/app/api/bolsa-de-trabajo/importar/route.ts`             | Modificar — magic bytes antes de XLSX.read                | Task 6 |
| `src/app/api/trabajador/mis-tramites/[documentoId]/route.ts` | Modificar — swap enforceRateLimit → enforceRateLimitRedis | Task 7 |
| `src/lib/firebase/__tests__/server-auth.test.ts`             | Crear — 5 tests para requireUserRequest                   | Task 8 |

---

## Task 1: Upgrade Next.js a 14.2.35

**Contexto:** CVE-2025-29927 — un atacante puede incluir el header `x-middleware-subrequest` en requests HTTP para saltarse el middleware de Next.js y acceder a rutas protegidas sin token. Parcheado en 14.2.30+. La versión actual es 14.2.15. También hay que actualizar `eslint-config-next` para que coincida con la versión de Next.js (actualmente ambas están en 14.2.15 en `package.json`).

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Instalar Next.js 14.2.35**

```bash
npm install next@14.2.35 eslint-config-next@14.2.35
```

Expected: `package.json` actualizado, `node_modules` instalados sin errores.

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: Build exitoso sin errores de compilación. Si hay errores de tipos o breaking changes, reportar antes de continuar.

- [ ] **Step 3: Verificar tipos y lint**

```bash
npm run check
```

Expected: Sin errores de TypeScript ni ESLint.

- [ ] **Step 4: Correr suite de tests**

```bash
npm test
```

Expected: Todos los tests pasan. Si algún test falla post-upgrade, investigar antes de continuar.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade next to 14.2.35 to patch CVE-2025-29927"
```

---

## Task 2: Upgrade jspdf a 2.5.2

**Contexto:** jspdf ^2.5.1 tiene un CVE de path traversal. La versión 2.5.2 es la última patch dentro de la rama 2.x — mínimo riesgo de breaking changes. jspdf se usa en el módulo de bolsa de trabajo para generación de PDFs.

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Instalar jspdf 2.5.2**

```bash
npm install jspdf@2.5.2
```

Expected: `package.json` actualizado (`"jspdf": "2.5.2"`).

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: Build exitoso. jspdf 2.5.2 no tiene breaking changes respecto a 2.5.1.

- [ ] **Step 3: Correr tests**

```bash
npm test
```

Expected: Suite completa pasa.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade jspdf to 2.5.2 to patch path traversal CVE"
```

---

## Task 3: Gate localhost en NODE_ENV=production (TDD)

**Contexto:** `getAllowedOrigins()` en `src/lib/security/cors.ts` siempre incluye `http://localhost:3000`, incluso en producción. Esto no es explotable directamente (CORS requiere browser), pero es una inconsistencia de configuración. El fix: incluir localhost solo cuando `NODE_ENV !== "production"`.

**Files:**

- Modify: `src/lib/security/cors.ts`
- Modify: `src/lib/security/__tests__/cors.test.ts`

- [ ] **Step 1: Escribir el test que debe fallar**

Abrir `src/lib/security/__tests__/cors.test.ts`. El archivo actual tiene 64 líneas. Agregar este test al final del `describe("assertSameOrigin", ...)`, antes del cierre `});`:

```typescript
it("rechaza localhost cuando NODE_ENV es production", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "production";
  vi.resetModules();
  const { assertSameOrigin } = await import("@/lib/security/cors");
  const request = makeMockRequest("http://localhost:3000");
  expect(() => assertSameOrigin(request)).toThrow("CORS_FORBIDDEN");
  (process.env as any).NODE_ENV = originalNodeEnv;
});
```

El archivo completo debe quedar con 6 tests en total.

- [ ] **Step 2: Verificar que el test falla**

```bash
npm test -- --reporter=verbose src/lib/security/__tests__/cors.test.ts
```

Expected: 5 tests pasan, el nuevo test FALLA con `"Expected function to throw an error with message 'CORS_FORBIDDEN'"`.

- [ ] **Step 3: Implementar el fix en cors.ts**

El archivo actual `src/lib/security/cors.ts` es:

```typescript
import type { NextRequest } from "next/server";

function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sntssvii.com";
  return [appUrl, "http://localhost:3000"];
}

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");

  // Sin header Origin = server-to-server (curl, Postman, etc.) — permitir
  // CORS es una protección exclusiva del browser
  if (!origin) return;

  if (!getAllowedOrigins().includes(origin)) {
    throw new Error("CORS_FORBIDDEN");
  }
}
```

Reemplazarlo con:

```typescript
import type { NextRequest } from "next/server";

function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sntssvii.com";
  const origins = [appUrl];
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000");
  }
  return origins;
}

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");

  // Sin header Origin = server-to-server (curl, Postman, etc.) — permitir
  // CORS es una protección exclusiva del browser
  if (!origin) return;

  if (!getAllowedOrigins().includes(origin)) {
    throw new Error("CORS_FORBIDDEN");
  }
}
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
npm test -- --reporter=verbose src/lib/security/__tests__/cors.test.ts
```

Expected: 6 tests pasan. Verificar que el test "permite localhost en desarrollo" sigue pasando (en Vitest `NODE_ENV` es `"test"`, no `"production"`, por lo que localhost se incluye).

- [ ] **Step 5: Verificar suite completa**

```bash
npm test
```

Expected: Todos los tests pasan.

- [ ] **Step 6: Commit**

```bash
git add src/lib/security/cors.ts src/lib/security/__tests__/cors.test.ts
git commit -m "fix: gate localhost origin behind NODE_ENV !== production"
```

---

## Task 4: Crear .env.example

**Contexto:** `.env.example` no existe en el repo. Este archivo documenta las variables de entorno requeridas con valores placeholder para que nuevos desarrolladores sepan qué configurar. `NEXT_PUBLIC_APP_URL` ya existe en `.env.local` y en Vercel pero no está documentada.

**Files:**

- Create: `.env.example`

- [ ] **Step 1: Crear el archivo .env.example**

Crear `/.env.example` en la raíz del proyecto con este contenido exacto:

```bash
# ============================================================
# SNTSS — Variables de entorno requeridas
# Copiar a .env.local y completar con valores reales.
# NUNCA commitear .env.local al repositorio.
# ============================================================

# URL pública de la aplicación (usada para CORS y emails)
NEXT_PUBLIC_APP_URL=https://sntssvii.com

# Firebase (cliente) — obtener de Firebase Console > Project Settings
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin SDK (servidor) — obtener de service account JSON
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Upstash Redis — rate limiting distribuido (obtener de upstash.com)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Resend — envío de correos (obtener de resend.com)
RESEND_API_KEY=
RESEND_FROM=SNTSS Sección VII <notificaciones@sntssvii.com>

# Adobe PDF Services — conversión PDF (obtener de developer.adobe.com)
ADOBE_CLIENT_ID=
ADOBE_CLIENT_SECRET=

# iLovePDF — procesamiento PDF alternativo (obtener de ilovepdf.com)
ILOVEPDF_PUBLIC_KEY=
ILOVEPDF_SECRET_KEY=

# Groq — chat de contratos (obtener de console.groq.com)
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

- [ ] **Step 2: Verificar que .env.example no está en .gitignore**

```bash
git check-ignore -v .env.example
```

Expected: Sin output (el archivo NO está ignorado — debe commitearse al repo). Si aparece ignorado, ajustar `.gitignore` para excluir `.env.example` de las reglas de `.env*`.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add .env.example with all required environment variables"
```

---

## Task 5: Magic bytes en extraer/route.ts

**Contexto:** `/api/bolsa-de-trabajo/extraer` acepta solo PDFs (ya tiene validación de tipo MIME en línea 320). Sin embargo, un cliente malicioso podría enviar un archivo con `Content-Type: application/pdf` pero con contenido diferente. La validación de magic bytes verifica los primeros bytes del contenido real. `validateFileMagicBytes` ya existe en `@/lib/security/file-validation` — solo hay que llamarla.

**Files:**

- Modify: `src/app/api/bolsa-de-trabajo/extraer/route.ts`

- [ ] **Step 1: Agregar el import de validateFileMagicBytes**

En `src/app/api/bolsa-de-trabajo/extraer/route.ts`, en la sección de imports (líneas 1-6), agregar:

```typescript
import { validateFileMagicBytes } from "@/lib/security/file-validation";
```

El bloque de imports completo queda:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { detectarTipoDocumento } from "@/lib/pdf/parser";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { validateFileMagicBytes } from "@/lib/security/file-validation";
import * as XLSX from "xlsx";
```

- [ ] **Step 2: Agregar validación después de crear el buffer**

En `src/app/api/bolsa-de-trabajo/extraer/route.ts`, localizar las líneas 327-328:

```typescript
const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);
```

Reemplazar con:

```typescript
const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

if (!validateFileMagicBytes(buffer, "pdf")) {
  return NextResponse.json(
    { error: "Formato de archivo no válido." },
    { status: 400 },
  );
}
```

- [ ] **Step 3: Verificar build y tests**

```bash
npm run check && npm test
```

Expected: Sin errores de tipos, lint ni tests.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bolsa-de-trabajo/extraer/route.ts
git commit -m "fix: add magic bytes validation to extraer endpoint"
```

---

## Task 6: Magic bytes en importar/route.ts

**Contexto:** `/api/bolsa-de-trabajo/importar` acepta archivos Excel (XLSX o XLS) cuando recibe `multipart/form-data`. El buffer se crea en línea 108. Hay que validar los magic bytes antes de pasarlo a `XLSX.read()`. Tanto OLE2 (`.xls` legacy) como ZIP (`.xlsx` y `.xls` moderno) son válidos — Excel moderno puede guardar `.xls` internamente como ZIP.

**Files:**

- Modify: `src/app/api/bolsa-de-trabajo/importar/route.ts`

- [ ] **Step 1: Agregar el import de validateFileMagicBytes**

En `src/app/api/bolsa-de-trabajo/importar/route.ts`, en la sección de imports (líneas 1-14), agregar:

```typescript
import { validateFileMagicBytes } from "@/lib/security/file-validation";
```

El bloque de imports completo queda:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  createBolsaDeTrabajoDocumento,
  guardarRegistrosEnSubcoleccion,
  updateBolsaDeTrabajoDocumento,
} from "@/lib/firebase/bolsa-de-trabajo";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { validateFileMagicBytes } from "@/lib/security/file-validation";
import type {
  BolsaDeTrabajoRegistro,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";
import * as XLSX from "xlsx";
```

- [ ] **Step 2: Agregar validación después de crear el buffer**

En `src/app/api/bolsa-de-trabajo/importar/route.ts`, localizar las líneas 107-110:

```typescript
const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

const workbook = XLSX.read(buffer, { type: "buffer" });
```

Reemplazar con:

```typescript
const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

const isValidXlsx = validateFileMagicBytes(buffer, "xlsx");
const isValidXls = validateFileMagicBytes(buffer, "xls");
if (!isValidXlsx && !isValidXls) {
  return NextResponse.json(
    { error: "Formato de archivo no válido." },
    { status: 400 },
  );
}

const workbook = XLSX.read(buffer, { type: "buffer" });
```

Nota: se aceptan ambos (`xlsx` y `xls`) porque Excel moderno puede guardar archivos `.xls` usando el formato ZIP internamente.

- [ ] **Step 3: Verificar build y tests**

```bash
npm run check && npm test
```

Expected: Sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bolsa-de-trabajo/importar/route.ts
git commit -m "fix: add magic bytes validation to importar endpoint"
```

---

## Task 7: Switch rate limiter en [documentoId] a Redis

**Contexto:** `mis-tramites/[documentoId]/route.ts` usa `enforceRateLimit` (in-memory, se reinicia por instancia) mientras el resto de endpoints usan `enforceRateLimitRedis` (distribuido con Upstash). Esta inconsistencia significa que el rate limit de este endpoint no se comparte entre instancias del servidor. El bucket actual es `"api:trabajador:mi-tramite-detalle"` con `limit: 90, windowMs: 60_000`. `RateLimitError` se importa de `rate-limit` (no de `rate-limit-redis`) — mantener ese import.

**Files:**

- Modify: `src/app/api/trabajador/mis-tramites/[documentoId]/route.ts`

- [ ] **Step 1: Actualizar el import**

En `src/app/api/trabajador/mis-tramites/[documentoId]/route.ts`, cambiar línea 8:

```typescript
// Antes
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

// Después
import { RateLimitError } from "@/lib/security/rate-limit";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
```

- [ ] **Step 2: Cambiar la llamada al rate limiter**

Localizar las líneas 27-32 del handler GET:

```typescript
assertSameOrigin(request);
enforceRateLimit(request, {
  bucket: "api:trabajador:mi-tramite-detalle",
  limit: 90,
  windowMs: 60_000,
});
```

Reemplazar con:

```typescript
assertSameOrigin(request);
await enforceRateLimitRedis(request, {
  bucket: "api:trabajador:mi-tramite-detalle",
  limit: 90,
  windowMs: 60_000,
});
```

Nota: `enforceRateLimitRedis` es `async` — agregar `await`.

- [ ] **Step 3: Verificar build y tests**

```bash
npm run check && npm test
```

Expected: Sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/trabajador/mis-tramites/[documentoId]/route.ts
git commit -m "fix: switch [documentoId] rate limiter to distributed Redis"
```

---

## Task 8: Unit tests para requireUserRequest

**Contexto:** `requireUserRequest` se introdujo en Phase 2 y es la función que protege el endpoint crítico de posiciones del IDOR fix. No tiene tests propios. El directorio `src/lib/firebase/__tests__/` no existe — hay que crearlo. El mock de `@/lib/firebase/admin` sigue el mismo patrón de `vi.mock` usado en otros tests del proyecto.

**Files:**

- Create: `src/lib/firebase/__tests__/server-auth.test.ts`

- [ ] **Step 1: Crear el archivo de test**

Crear `src/lib/firebase/__tests__/server-auth.test.ts` con este contenido:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireUserRequest } from "@/lib/firebase/server-auth";

const mockVerifyIdToken = vi.fn();
const mockDocGet = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: { verifyIdToken: mockVerifyIdToken },
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ get: mockDocGet })),
    })),
  },
}));

function makeRequest(authHeader: string | null) {
  return {
    headers: {
      get: (key: string) => (key === "authorization" ? authHeader : null),
    },
  } as any;
}

describe("requireUserRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza AUTH_REQUIRED cuando no hay token Bearer", async () => {
    await expect(requireUserRequest(makeRequest(null))).rejects.toThrow(
      "AUTH_REQUIRED",
    );
  });

  it("propaga error de Firebase cuando el token es inválido", async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error("auth/invalid-id-token"));
    await expect(
      requireUserRequest(makeRequest("Bearer token-invalido")),
    ).rejects.toThrow("auth/invalid-id-token");
  });

  it("lanza PROFILE_NOT_FOUND cuando el perfil no existe en Firestore", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-test",
      email: "a@b.com",
    });
    mockDocGet.mockResolvedValueOnce({ exists: false });
    await expect(
      requireUserRequest(makeRequest("Bearer token-valido")),
    ).rejects.toThrow("PROFILE_NOT_FOUND");
  });

  it("lanza ACCOUNT_INACTIVE cuando status !== active", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-test",
      email: "a@b.com",
    });
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "pending", matricula: "97027534" }),
    });
    await expect(
      requireUserRequest(makeRequest("Bearer token-valido")),
    ).rejects.toThrow("ACCOUNT_INACTIVE");
  });

  it("retorna { uid, email, matricula } para usuario activo con token válido", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-test",
      email: "worker@sntss.com",
    });
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "active", matricula: "  97027534  " }),
    });
    const result = await requireUserRequest(makeRequest("Bearer token-valido"));
    expect(result).toEqual({
      uid: "uid-test",
      email: "worker@sntss.com",
      matricula: "97027534",
    });
  });
});
```

- [ ] **Step 2: Verificar que los 5 tests pasan**

```bash
npm test -- --reporter=verbose src/lib/firebase/__tests__/server-auth.test.ts
```

Expected: 5 tests pasan. Si alguno falla por un problema de mock, revisar que `vi.mock` esté al top level del archivo (antes de cualquier import que use `@/lib/firebase/admin`).

- [ ] **Step 3: Verificar suite completa**

```bash
npm test
```

Expected: Todos los tests pasan incluyendo los nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/lib/firebase/__tests__/server-auth.test.ts
git commit -m "test: add unit tests for requireUserRequest"
```
