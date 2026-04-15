# Security Hardening Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar 4 huecos de seguridad: eliminar ruta pública de bolsa de trabajo, agregar HTTP security headers, CORS explícito en APIs críticas, y validación de magic bytes en uploads de PDF/Excel.

**Architecture:** Enfoque híbrido — `requireUserRequest()` en server-auth.ts para proteger el endpoint de posición, `assertSameOrigin()` en cors.ts aplicado por-ruta, headers en next.config.mjs, y `validateFileMagicBytes()` en file-validation.ts aplicado antes del parsing.

**Tech Stack:** Next.js 14 App Router, Firebase Admin SDK, TypeScript, Vitest

---

## Mapa de archivos

| Archivo                                                            | Acción    | Responsabilidad                                    |
| ------------------------------------------------------------------ | --------- | -------------------------------------------------- |
| `src/lib/firebase/server-auth.ts`                                  | Modificar | Agregar `requireUserRequest()`                     |
| `src/lib/security/cors.ts`                                         | Crear     | `assertSameOrigin()` helper                        |
| `src/lib/security/file-validation.ts`                              | Crear     | `validateFileMagicBytes()` helper                  |
| `src/lib/security/__tests__/cors.test.ts`                          | Crear     | Tests de cors                                      |
| `src/lib/security/__tests__/file-validation.test.ts`               | Crear     | Tests de magic bytes                               |
| `src/app/api/trabajador/posicion/route.ts`                         | Modificar | Agregar auth + CORS, quitar matricula del query    |
| `src/app/api/trabajador/mis-tramites/route.ts`                     | Modificar | Agregar assertSameOrigin + CORS error handling     |
| `src/app/api/trabajador/mis-tramites/[documentoId]/route.ts`       | Modificar | Agregar assertSameOrigin + CORS error handling     |
| `src/app/api/registro/route.ts`                                    | Modificar | Agregar assertSameOrigin + CORS error handling     |
| `src/app/api/admin/lab/chat-contrato/route.ts`                     | Modificar | Agregar assertSameOrigin + CORS error handling     |
| `src/app/api/bolsa-de-trabajo/procesar/route.ts`                   | Modificar | Magic bytes antes del parsing                      |
| `next.config.mjs`                                                  | Modificar | Headers de seguridad + redirects de rutas públicas |
| `src/app/(public)/bolsa-de-trabajo/consulta/page.tsx`              | Eliminar  | Ruta pública innecesaria                           |
| `src/app/(public)/bolsa-de-trabajo/resultado/[matricula]/page.tsx` | Eliminar  | Ruta pública innecesaria                           |
| `.env.local`                                                       | Modificar | Agregar `NEXT_PUBLIC_APP_URL`                      |

---

## Task 1: requireUserRequest() en server-auth.ts

**Files:**

- Modify: `src/lib/firebase/server-auth.ts`

**Contexto:** `server-auth.ts` ya tiene `requireAdminRequest()` que verifica token + rol admin. Necesitamos `requireUserRequest()` que solo verifica token válido + cuenta activa + devuelve la matrícula del perfil. Esto elimina el IDOR en el endpoint de posición porque la matrícula viene de Firestore, no del cliente.

La función `getBearerToken` ya existe en el archivo — no duplicarla.

- [ ] **Step 1: Leer el archivo actual**

```bash
cat /Users/gerardoarroyo/Projects/SNTSS/src/lib/firebase/server-auth.ts
```

- [ ] **Step 2: Agregar `UserRequestContext` y `requireUserRequest` al final del archivo**

Agregar después de `requireSuperAdminRequest`:

```typescript
interface UserRequestContext {
  uid: string;
  email: string | null;
  matricula: string;
}

export async function requireUserRequest(
  request: NextRequest,
): Promise<UserRequestContext> {
  const idToken = getBearerToken(request);

  if (!idToken) {
    throw new Error("AUTH_REQUIRED");
  }

  const decodedToken = await adminAuth.verifyIdToken(idToken);
  const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();

  if (!userDoc.exists) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const userData = userDoc.data() as
    | {
        role?: string;
        status?: string;
        email?: string;
        matricula?: string;
      }
    | undefined;

  const status = userData?.status;

  if (status && status !== "active") {
    throw new Error("ACCOUNT_INACTIVE");
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || userData?.email || null,
    matricula: userData?.matricula?.trim().toUpperCase() || "",
  };
}
```

- [ ] **Step 3: Correr typecheck**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run typecheck 2>&1 | tail -5
```

Expected: sin errores

- [ ] **Step 4: Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS
git add src/lib/firebase/server-auth.ts
git commit -m "feat(security): agregar requireUserRequest para endpoints de trabajador"
```

---

## Task 2: assertSameOrigin() en cors.ts

**Files:**

- Create: `src/lib/security/cors.ts`
- Create: `src/lib/security/__tests__/cors.test.ts`

**Contexto:** CORS protege contra scripts maliciosos en el browser que llaman tus APIs desde otro dominio. Si el header `Origin` está ausente (curl, Postman, server-to-server), se permite — CORS es browser-only. Si `Origin` está presente pero no es un origen permitido, lanzar `CORS_FORBIDDEN`. En prod se usa `NEXT_PUBLIC_APP_URL` con fallback a `https://sntssvii.com`.

- [ ] **Step 1: Crear el test**

Crear `src/lib/security/__tests__/cors.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock del módulo antes de importar cors
vi.mock("next/server", () => ({
  NextRequest: class {
    headers: { get: (key: string) => string | null };
    constructor(url: string, options?: { headers?: Record<string, string> }) {
      this.headers = {
        get: (key: string) => options?.headers?.[key.toLowerCase()] ?? null,
      };
    }
  },
}));

function makeMockRequest(origin: string | null) {
  return {
    headers: {
      get: (key: string) => (key === "origin" ? origin : null),
    },
  } as any;
}

describe("assertSameOrigin", () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://sntssvii.com";
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  });

  it("permite requests sin header Origin (server-to-server)", async () => {
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest(null);
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("permite el origen de producción configurado en NEXT_PUBLIC_APP_URL", async () => {
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest("https://sntssvii.com");
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("permite localhost en desarrollo", async () => {
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest("http://localhost:3000");
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("lanza CORS_FORBIDDEN para un origen externo desconocido", async () => {
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest("https://evil.com");
    expect(() => assertSameOrigin(request)).toThrow("CORS_FORBIDDEN");
  });

  it("lanza CORS_FORBIDDEN para subdominio no autorizado", async () => {
    const { assertSameOrigin } = await import("@/lib/security/cors");
    const request = makeMockRequest("https://sub.sntssvii.com");
    expect(() => assertSameOrigin(request)).toThrow("CORS_FORBIDDEN");
  });
});
```

- [ ] **Step 2: Correr test para verificar que FALLA**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm test src/lib/security/__tests__/cors.test.ts 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module @/lib/security/cors"

- [ ] **Step 3: Crear `src/lib/security/cors.ts`**

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

- [ ] **Step 4: Correr test para verificar que PASA**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm test src/lib/security/__tests__/cors.test.ts 2>&1 | tail -10
```

Expected: 5 passed (5)

- [ ] **Step 5: Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS
git add src/lib/security/cors.ts src/lib/security/__tests__/cors.test.ts
git commit -m "feat(security): agregar assertSameOrigin helper para CORS"
```

---

## Task 3: validateFileMagicBytes() en file-validation.ts

**Files:**

- Create: `src/lib/security/file-validation.ts`
- Create: `src/lib/security/__tests__/file-validation.test.ts`

**Contexto:** El endpoint de upload valida archivos por MIME type y extensión — ambos falsificables. Los magic bytes son los primeros bytes del archivo y no se pueden falsificar sin corromper el archivo. PDF empieza con `%PDF-`, XLSX con `PK\x03\x04` (es un ZIP), XLS con `\xD0\xCF\x11\xE0` (formato OLE2 de Microsoft).

- [ ] **Step 1: Crear el test**

Crear `src/lib/security/__tests__/file-validation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateFileMagicBytes } from "@/lib/security/file-validation";

describe("validateFileMagicBytes", () => {
  describe("PDF", () => {
    it("acepta buffer con firma PDF válida (%PDF-)", () => {
      const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      expect(validateFileMagicBytes(buf, "pdf")).toBe(true);
    });

    it("rechaza buffer que no empieza con %PDF-", () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      expect(validateFileMagicBytes(buf, "pdf")).toBe(false);
    });

    it("rechaza buffer demasiado corto para PDF", () => {
      const buf = Buffer.from([0x25, 0x50]);
      expect(validateFileMagicBytes(buf, "pdf")).toBe(false);
    });
  });

  describe("XLSX", () => {
    it("acepta buffer con firma ZIP/XLSX válida (PK\\x03\\x04)", () => {
      const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      expect(validateFileMagicBytes(buf, "xlsx")).toBe(true);
    });

    it("rechaza buffer sin firma ZIP", () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(validateFileMagicBytes(buf, "xlsx")).toBe(false);
    });
  });

  describe("XLS", () => {
    it("acepta buffer con firma OLE2 válida (D0 CF 11 E0)", () => {
      const buf = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]);
      expect(validateFileMagicBytes(buf, "xls")).toBe(true);
    });

    it("rechaza buffer sin firma OLE2", () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(validateFileMagicBytes(buf, "xls")).toBe(false);
    });
  });

  it("rechaza buffer vacío para cualquier tipo", () => {
    const empty = Buffer.alloc(0);
    expect(validateFileMagicBytes(empty, "pdf")).toBe(false);
    expect(validateFileMagicBytes(empty, "xlsx")).toBe(false);
    expect(validateFileMagicBytes(empty, "xls")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr test para verificar que FALLA**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm test src/lib/security/__tests__/file-validation.test.ts 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module @/lib/security/file-validation"

- [ ] **Step 3: Crear `src/lib/security/file-validation.ts`**

```typescript
const MAGIC_BYTES: Record<"pdf" | "xlsx" | "xls", number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  xlsx: [0x50, 0x4b, 0x03, 0x04], // PK\x03\x04 (ZIP — base de XLSX)
  xls: [0xd0, 0xcf, 0x11, 0xe0], // OLE2 — formato legacy de Excel
};

export function validateFileMagicBytes(
  buffer: Buffer,
  expectedType: "pdf" | "xlsx" | "xls",
): boolean {
  const signature = MAGIC_BYTES[expectedType];
  if (buffer.length < signature.length) return false;
  return signature.every((byte, i) => buffer[i] === byte);
}
```

- [ ] **Step 4: Correr test para verificar que PASA**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm test src/lib/security/__tests__/file-validation.test.ts 2>&1 | tail -10
```

Expected: 9 passed (9)

- [ ] **Step 5: Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS
git add src/lib/security/file-validation.ts src/lib/security/__tests__/file-validation.test.ts
git commit -m "feat(security): agregar validateFileMagicBytes para verificación de uploads"
```

---

## Task 4: Proteger /api/trabajador/posicion con auth + CORS

**Files:**

- Modify: `src/app/api/trabajador/posicion/route.ts`

**Contexto:** Este endpoint actualmente no requiere autenticación y acepta la matrícula como query param del cliente — cualquiera puede consultar la posición de otro trabajador. Después de este task: requiere token Bearer válido, la matrícula se extrae del perfil en Firestore (no del cliente), y solo permite requests desde origenes autorizados.

- [ ] **Step 1: Leer el archivo actual**

```bash
cat /Users/gerardoarroyo/Projects/SNTSS/src/app/api/trabajador/posicion/route.ts
```

- [ ] **Step 2: Reemplazar el contenido completo del archivo**

El archivo después de los cambios debe quedar así:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { calcularPosiciones } from "@/lib/bolsa-de-trabajo/calculos";
import { getComparisonRecordsForWorker } from "@/lib/bolsa-de-trabajo/comparison-groups";
import { getBolsaPosicionesMaterializadasPorMatricula } from "@/lib/firebase/bolsa-posiciones-materializadas";
import { requireUserRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { RateLimitError } from "@/lib/security/rate-limit";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import type {
  BolsaDeTrabajoRegistro,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";

export const dynamic = "force-dynamic";

function hasUsableMaterializedRecord(record: { recordId?: string | null }) {
  return Boolean(record.recordId?.trim());
}

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);

    await enforceRateLimitRedis(request, {
      bucket: "api:trabajador:posicion",
      limit: 20,
      windowMs: 60_000,
    });

    const context = await requireUserRequest(request);
    const matricula = context.matricula;

    if (!matricula) {
      return NextResponse.json(
        { error: "El usuario autenticado no tiene matrícula vinculada." },
        { status: 400 },
      );
    }

    // 1. Obtener la sincronización activa (Fuente de Verdad)
    const syncSnap = await adminDb
      .collection("sincronizaciones")
      .where("esFuenteVerdad", "==", true)
      .limit(1)
      .get();

    if (syncSnap.empty) {
      return NextResponse.json(
        { error: "No hay información oficial activa en este momento." },
        { status: 404 },
      );
    }

    const syncDoc = syncSnap.docs[0];
    const syncActiva = {
      id: syncDoc.id,
      ...syncDoc.data(),
    } as { id: string; anio: number; mes: number; quincena: number };

    const posicionesMaterializadas = (
      await getBolsaPosicionesMaterializadasPorMatricula(
        syncActiva.id,
        matricula,
      )
    )
      .filter(hasUsableMaterializedRecord)
      .sort(
        (a, b) =>
          a.tipoDocumento.localeCompare(b.tipoDocumento) ||
          a.documentoId.localeCompare(b.documentoId) ||
          (a.recordId || "").localeCompare(b.recordId || ""),
      );

    if (posicionesMaterializadas.length > 0) {
      const resultado = posicionesMaterializadas[0];

      return NextResponse.json({
        success: true,
        data: {
          ...resultado,
          tipoDocumento: resultado.tipoDocumento,
          registro: resultado.grupoComparable?.registro,
        },
        periodo: {
          anio: syncActiva.anio,
          mes: syncActiva.mes,
          quincena: syncActiva.quincena,
        },
      });
    }

    // 2. Obtener todos los documentos de esa sincronización
    const snapDocs = await adminDb
      .collection("bolsa_de_trabajo_documentos")
      .where("syncId", "==", syncActiva.id)
      .get();

    if (snapDocs.empty) {
      return NextResponse.json(
        { error: "No se encontraron listados para esta quincena." },
        { status: 404 },
      );
    }

    let dataTrabajador: BolsaDeTrabajoRegistro | null = null;
    let docIdEncontrado: string | null = null;
    let tipoDocumento: TipoBolsaDeTrabajo | null = null;

    for (const docSnap of snapDocs.docs) {
      const snapTrabajador = await docSnap.ref
        .collection("registros")
        .where("matricula", "==", matricula)
        .limit(1)
        .get();

      if (!snapTrabajador.empty) {
        dataTrabajador = {
          id: snapTrabajador.docs[0].id,
          ...snapTrabajador.docs[0].data(),
        } as BolsaDeTrabajoRegistro;
        docIdEncontrado = docSnap.id;
        tipoDocumento = docSnap.data().tipo as TipoBolsaDeTrabajo;
        break;
      }
    }

    if (!dataTrabajador || !docIdEncontrado || !tipoDocumento) {
      return NextResponse.json(
        {
          error:
            "No se encontraron registros para esta matrícula en el listado actual.",
        },
        { status: 404 },
      );
    }

    const snapComparacion = await adminDb
      .collection("bolsa_de_trabajo_documentos")
      .doc(docIdEncontrado)
      .collection("registros")
      .get();
    const registros = snapComparacion.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BolsaDeTrabajoRegistro[];
    const comparisonRecords = getComparisonRecordsForWorker(
      registros,
      dataTrabajador,
      tipoDocumento,
    );
    const resultado = calcularPosiciones(
      comparisonRecords,
      matricula,
      tipoDocumento,
    );

    if (!resultado) {
      return NextResponse.json(
        { error: "Error al calcular posiciones." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...resultado,
        tipoDocumento,
      },
      periodo: {
        anio: syncActiva.anio,
        mes: syncActiva.mes,
        quincena: syncActiva.quincena,
      },
    });
  } catch (error: any) {
    console.error("Error en consulta de posición:", error);

    if (error?.message === "CORS_FORBIDDEN") {
      return NextResponse.json(
        { error: "Acceso no permitido." },
        { status: 403 },
      );
    }

    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }

    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (error?.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Perfil de usuario no encontrado." },
        { status: 404 },
      );
    }

    if (error?.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { error: "La cuenta no está activa." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Correr typecheck**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run typecheck 2>&1 | tail -5
```

Expected: sin errores

- [ ] **Step 4: Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS
git add src/app/api/trabajador/posicion/route.ts
git commit -m "fix(security): proteger endpoint posicion con auth obligatoria y CORS"
```

---

## Task 5: Aplicar assertSameOrigin a las 4 rutas restantes

**Files:**

- Modify: `src/app/api/trabajador/mis-tramites/route.ts`
- Modify: `src/app/api/trabajador/mis-tramites/[documentoId]/route.ts`
- Modify: `src/app/api/registro/route.ts`
- Modify: `src/app/api/admin/lab/chat-contrato/route.ts`

**Contexto:** Estos endpoints ya tienen autenticación, solo falta el check de CORS. El patrón es idéntico en los 4: (1) agregar `import { assertSameOrigin } from "@/lib/security/cors"`, (2) llamar `assertSameOrigin(request)` como primera línea del try block, (3) agregar el catch para `CORS_FORBIDDEN`.

**Instrucciones por archivo:**

### mis-tramites/route.ts

- [ ] **Step 1: Leer el archivo**

```bash
head -15 /Users/gerardoarroyo/Projects/SNTSS/src/app/api/trabajador/mis-tramites/route.ts
```

- [ ] **Step 2: Agregar import de assertSameOrigin**

En la sección de imports, agregar:

```typescript
import { assertSameOrigin } from "@/lib/security/cors";
```

- [ ] **Step 3: Agregar llamada al inicio del try block**

El try block empieza con `await enforceRateLimitRedis(...)`. Agregar `assertSameOrigin(request);` como primera línea, antes del rate limit:

```typescript
  try {
    assertSameOrigin(request);  // ← AGREGAR ESTA LÍNEA
    await enforceRateLimitRedis(request, {
```

- [ ] **Step 4: Agregar handler de CORS_FORBIDDEN en el catch**

El catch block tiene varios `if (error?.code === ...)`. Agregar al principio del catch, antes de los demás checks:

```typescript
if (error?.message === "CORS_FORBIDDEN") {
  return NextResponse.json({ error: "Acceso no permitido." }, { status: 403 });
}
```

### mis-tramites/[documentoId]/route.ts

- [ ] **Step 5: Leer el archivo**

```bash
head -30 "/Users/gerardoarroyo/Projects/SNTSS/src/app/api/trabajador/mis-tramites/[documentoId]/route.ts"
```

- [ ] **Step 6: Aplicar el mismo patrón (import + llamada + catch handler)**

Mismo proceso: agregar `import { assertSameOrigin }`, llamar `assertSameOrigin(request)` al inicio del try, agregar catch handler para `CORS_FORBIDDEN`.

### registro/route.ts

- [ ] **Step 7: Aplicar el mismo patrón**

Agregar `import { assertSameOrigin }`, llamar `assertSameOrigin(request)` al inicio del try block del POST handler, agregar catch handler para `CORS_FORBIDDEN`.

### chat-contrato/route.ts

- [ ] **Step 8: Aplicar el mismo patrón**

```bash
cat /Users/gerardoarroyo/Projects/SNTSS/src/app/api/admin/lab/chat-contrato/route.ts
```

Agregar `import { assertSameOrigin }`, llamar `assertSameOrigin(request)` al inicio del try, agregar catch handler para `CORS_FORBIDDEN` antes del handler de `RateLimitError`.

- [ ] **Step 9: Correr typecheck**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run typecheck 2>&1 | tail -5
```

Expected: sin errores

- [ ] **Step 10: Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS
git add src/app/api/trabajador/mis-tramites/ src/app/api/registro/route.ts src/app/api/admin/
git commit -m "fix(security): aplicar assertSameOrigin a endpoints críticos"
```

---

## Task 6: Magic bytes en procesar/route.ts

**Files:**

- Modify: `src/app/api/bolsa-de-trabajo/procesar/route.ts`

**Contexto:** El archivo recibe el archivo en la línea ~210 y lo convierte a buffer en la línea ~211. La validación de magic bytes se inserta inmediatamente después de `const buffer = Buffer.from(arrayBuffer)` y antes de `let tipoDocumento = tipo as any`. Si los bytes no coinciden con el tipo declarado (PDF o Excel), se rechaza con 400.

- [ ] **Step 1: Verificar las líneas exactas**

```bash
grep -n "isPDF\|isExcel\|arrayBuffer\|Buffer.from\|tipoDocumento\|validateFile" /Users/gerardoarroyo/Projects/SNTSS/src/app/api/bolsa-de-trabajo/procesar/route.ts | head -15
```

Identificar la línea donde está `const buffer = Buffer.from(arrayBuffer)`.

- [ ] **Step 2: Agregar import de validateFileMagicBytes**

En la sección de imports del archivo, agregar:

```typescript
import { validateFileMagicBytes } from "@/lib/security/file-validation";
```

- [ ] **Step 3: Agregar validación de magic bytes después de crear el buffer**

Después de la línea `const buffer = Buffer.from(arrayBuffer);`, agregar:

```typescript
// Verificar magic bytes — MIME type y extensión son falsificables por el cliente
const expectedMagicType = isPDF
  ? "pdf"
  : normalizedName.endsWith(".xlsx")
    ? "xlsx"
    : "xls";
if (!validateFileMagicBytes(buffer, expectedMagicType)) {
  return NextResponse.json(
    { error: "Formato de archivo no válido." },
    { status: 400 },
  );
}
```

- [ ] **Step 4: Correr typecheck**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run typecheck 2>&1 | tail -5
```

Expected: sin errores

- [ ] **Step 5: Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS
git add src/app/api/bolsa-de-trabajo/procesar/route.ts
git commit -m "fix(security): validar magic bytes en uploads de PDF/Excel"
```

---

## Task 7: Security headers + redirects en next.config.mjs + env var

**Files:**

- Modify: `next.config.mjs`
- Modify: `.env.local`

**Contexto:** `next.config.mjs` solo tiene `transpilePackages` y `serverActions`. Agregar `headers()` con los 6 headers de seguridad aplicados a todas las rutas, y `redirects()` para redirigir las URLs públicas antiguas al login. También agregar `NEXT_PUBLIC_APP_URL` al `.env.local` — lo necesita el `cors.ts` que ya creamos.

**⚠️ Nota sobre CSP:** Next.js 14 inyecta scripts inline en el HTML que rompen una CSP estricta. Se usa `'unsafe-inline'` y `'unsafe-eval'` en `script-src` para compatibilidad. Esto es intencional y documentado.

- [ ] **Step 1: Agregar NEXT_PUBLIC_APP_URL al .env.local**

Abrir `src/app/(public)/bolsa-de-trabajo/.env.local` y agregar al final:

```
NEXT_PUBLIC_APP_URL=https://sntssvii.com
```

**También agregar en Vercel:** Settings → Environment Variables → `NEXT_PUBLIC_APP_URL` = `https://sntssvii.com` (Production + Preview).

- [ ] **Step 2: Reemplazar el contenido de next.config.mjs**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["framer-motion"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            // unsafe-inline y unsafe-eval son requeridos por Next.js 14 para sus scripts internos
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "connect-src 'self' *.googleapis.com *.firebaseio.com *.firebaseapp.com *.upstash.io",
              "font-src 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/bolsa-de-trabajo/consulta",
        destination: "/auth/login",
        permanent: true,
      },
      {
        source: "/bolsa-de-trabajo/resultado/:matricula",
        destination: "/auth/login",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 3: Correr typecheck**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run typecheck 2>&1 | tail -5
```

Expected: sin errores

- [ ] **Step 4: Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS
git add next.config.mjs .env.local
git commit -m "feat(security): agregar HTTP security headers y redirects en next.config.mjs"
```

---

## Task 8: Eliminar páginas públicas de bolsa de trabajo

**Files:**

- Delete: `src/app/(public)/bolsa-de-trabajo/consulta/page.tsx`
- Delete: `src/app/(public)/bolsa-de-trabajo/resultado/[matricula]/page.tsx`
- Delete: `src/app/(public)/` (directorio completo — solo tiene estas 2 páginas)

**Contexto:** El directorio `(public)` solo contiene las 2 páginas de bolsa de trabajo que estamos eliminando. Una vez eliminadas, el directorio queda vacío y también se elimina.

- [ ] **Step 1: Verificar que no hay otros archivos en (public)**

```bash
find "/Users/gerardoarroyo/Projects/SNTSS/src/app/(public)" -type f
```

Expected: solo los 2 archivos de bolsa-de-trabajo. Si hay otros archivos, NO eliminar el directorio raíz.

- [ ] **Step 2: Eliminar los archivos y el directorio**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS
git rm "src/app/(public)/bolsa-de-trabajo/consulta/page.tsx"
git rm "src/app/(public)/bolsa-de-trabajo/resultado/[matricula]/page.tsx"
```

Los directorios vacíos se eliminan automáticamente.

- [ ] **Step 3: Correr typecheck y lint**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run check 2>&1 | tail -10
```

Expected: sin errores. Si hay referencias a las páginas eliminadas en algún archivo, corregirlas.

- [ ] **Step 4: Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS
git commit -m "fix(security): eliminar ruta pública de bolsa de trabajo — requiere autenticación"
```

---

## Task 9: Validación final y push

**Files:** ninguno — solo validación

- [ ] **Step 1: Correr todos los tests**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm test 2>&1 | tail -15
```

Expected: todos los tests pasan. Si alguno falla, corregir antes de continuar.

- [ ] **Step 2: Correr check completo (typecheck + lint)**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run check 2>&1 | tail -5
```

Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 3: Verificar que los redirects están en next.config.mjs**

```bash
grep -A5 "redirects" /Users/gerardoarroyo/Projects/SNTSS/next.config.mjs
```

Expected: los 2 redirects de bolsa-de-trabajo → /auth/login.

- [ ] **Step 4: Push**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && git push
```

- [ ] **Step 5: Smoke tests manuales en producción (después del deploy)**

1. Visitar `https://sntssvii.com/bolsa-de-trabajo/consulta` → debe redirigir a `/auth/login`
2. `curl -s https://sntssvii.com/api/trabajador/posicion | jq .` → debe devolver `{"error":"No autorizado."}` con status 401
3. `curl -s -H "Origin: https://evil.com" https://sntssvii.com/api/trabajador/posicion | jq .` → debe devolver `{"error":"Acceso no permitido."}` con status 403
4. Inspeccionar cualquier respuesta con DevTools → debe tener `X-Frame-Options: DENY` en los response headers

---

## Notas importantes para el ejecutor

- **`NEXT_PUBLIC_APP_URL` en Vercel:** debe agregarse manualmente en el dashboard de Vercel (Settings → Environment Variables) además de en `.env.local`. Sin esta var, `cors.ts` usa el fallback `https://sntssvii.com` — funciona, pero es mejor tenerla explícita.
- **El `(public)` directory:** solo tiene las 2 páginas de bolsa. Verificar con `find` antes de eliminar.
- **`mis-tramites/[documentoId]/route.ts`:** usa `enforceRateLimit` (in-memory, no Redis). Solo agregar CORS — no cambiar el rate limiter en este plan (scope de otra tarea).
- **Orden de los tasks:** Tasks 1, 2, 3 son independientes entre sí. Tasks 4 y 5 dependen de Tasks 1 y 2. Task 6 depende de Task 3. Task 7 y 8 son independientes. Task 9 siempre al final.
