# Security Hardening Phase 3 — Design Spec

**Goal:** Parchear dos CVEs activos en dependencias directas y cerrar los cinco gaps pendientes de Phase 2 que quedaron fuera de scope.

**Architecture:** Dos líneas independientes — dependency upgrades (cero cambios de lógica) y app-level gap closures (reutilizando helpers ya existentes de Phase 2).

**Tech Stack:** Next.js 14 App Router, Firebase Admin SDK, TypeScript, Vitest

---

## Contexto

Esta es la tercera fase del security hardening del sistema SNTSS (16,000 trabajadores). Las fases anteriores cubrieron:

- **Phase 1:** Sanitización de error responses, Firestore rules, rate limiting distribuido con Upstash Redis
- **Phase 2:** IDOR fix en bolsa de trabajo, HTTP security headers, CORS explícito, magic bytes en `procesar`

### CVEs activos

| CVE            | Dependencia | Versión actual | Versión parcheada | Severidad                                           |
| -------------- | ----------- | -------------- | ----------------- | --------------------------------------------------- |
| CVE-2025-29927 | `next`      | 14.2.15        | 14.2.30+          | Crítica — auth bypass vía `x-middleware-subrequest` |
| Path traversal | `jspdf`     | ^2.5.1         | latest stable     | Media — generación de PDFs                          |

CVE-2025-29927 permite a un atacante incluir el header `x-middleware-subrequest` en requests HTTP para saltar completamente la lógica de protección de rutas del middleware de Next.js, accediendo a rutas protegidas sin token válido.

### Gaps de Phase 2

Identificados por el code reviewer al cerrar Phase 2, considerados no bloqueantes en ese momento pero pendientes:

1. Magic bytes sin validar en `extraer` e `importar` (admin-only, riesgo menor pero incompleto)
2. Rate limiter in-memory en `mis-tramites/[documentoId]` (inconsistente con el resto de endpoints que usan Redis)
3. `NEXT_PUBLIC_APP_URL` ausente en `.env.example`
4. Sin unit test para `requireUserRequest` (función crítica introducida en Phase 2)
5. `localhost` en `getAllowedOrigins` no está gateado por `NODE_ENV !== 'production'`

---

## Componentes

### Línea A: CVE Upgrades

#### A1. `package.json` — `next` upgrade

Actualizar `next` de `14.2.15` a `14.2.30` (o la última patch release estable disponible).

Post-upgrade gate:

- `npm run build` sin errores
- `npm run check` (typecheck + lint) sin errores
- `npm test` — suite completa sin regresiones

#### A2. `package.json` — `jspdf` upgrade

Actualizar `jspdf` de `^2.5.1` a la última versión estable con el CVE parcheado.

Verificar compatibilidad de API: el uso en este proyecto se limita a generación básica de PDFs en el módulo de bolsa de trabajo — es improbable que haya breaking changes en la API pública.

Post-upgrade gate: misma suite que A1.

---

### Línea B: Gaps de Phase 2

#### B1. `src/app/api/bolsa-de-trabajo/extraer/route.ts` — magic bytes

Agregar validación de magic bytes inmediatamente después de recibir el archivo y antes de pasarlo al parser. Reutilizar `validateFileMagicBytes` de `@/lib/security/file-validation`.

Patrón idéntico al implementado en `procesar/route.ts`:

```typescript
const buffer = Buffer.from(await file.arrayBuffer());

const isPDF = file.type === "application/pdf";
const isValidPdf = isPDF && validateFileMagicBytes(buffer, "pdf");
const isValidXlsx = !isPDF && validateFileMagicBytes(buffer, "xlsx");
const isValidXls = !isPDF && validateFileMagicBytes(buffer, "xls");

if (isPDF ? !isValidPdf : !(isValidXlsx || isValidXls)) {
  return NextResponse.json(
    { error: "Formato de archivo no válido." },
    { status: 400 },
  );
}
```

Nota: `.xls` acepta tanto OLE2 (`0xD0 0xCF 0x11 0xE0`) como ZIP (`0x50 0x4B 0x03 0x04`) — Excel moderno puede guardar `.xls` en formato XLSX internamente.

#### B2. `src/app/api/bolsa-de-trabajo/importar/route.ts` — magic bytes

Mismo patrón que B1. Aplicar en el mismo punto del flujo.

#### B3. `src/app/api/trabajador/mis-tramites/[documentoId]/route.ts` — rate limit Redis

Reemplazar `enforceRateLimit` (in-memory) por `enforceRateLimitRedis` para consistencia con el resto de endpoints autenticados.

```typescript
// Antes
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
enforceRateLimit(request, {
  bucket: "api:trabajador:mi-tramite-detalle",
  limit: 90,
  windowMs: 60_000,
});

// Después
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { RateLimitError } from "@/lib/security/rate-limit";
await enforceRateLimitRedis(request, {
  bucket: "api:trabajador:mi-tramite-detalle",
  limit: 90,
  windowMs: 60_000,
});
```

Si `enforceRateLimit` no se usa en ningún otro lugar de este archivo después del cambio, eliminar el import.

#### B4. `.env.example` — `NEXT_PUBLIC_APP_URL`

Agregar línea:

```
NEXT_PUBLIC_APP_URL=https://sntssvii.com
```

Ubicarla junto a las demás variables de configuración de la app (no junto a secrets).

#### B5. `src/lib/security/cors.ts` — gate localhost

```typescript
// Antes
function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sntssvii.com";
  return [appUrl, "http://localhost:3000"];
}

// Después
function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sntssvii.com";
  const origins = [appUrl];
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000");
  }
  return origins;
}
```

Actualizar el test existente `cors.test.ts` para cubrir el caso `NODE_ENV=production` (localhost debe ser rechazado).

---

## Tests

### Nuevos tests

#### `src/lib/firebase/__tests__/server-auth.test.ts` (crear)

Unit tests para `requireUserRequest` con mocks de `adminAuth` y `adminDb`:

| Test                 | Setup                                     | Expected                            |
| -------------------- | ----------------------------------------- | ----------------------------------- |
| Sin token Bearer     | Authorization header ausente              | Lanza `AUTH_REQUIRED`               |
| Token inválido       | `verifyIdToken` rechaza                   | Propaga error de Firebase           |
| Perfil no encontrado | `userDoc.exists === false`                | Lanza `PROFILE_NOT_FOUND`           |
| Cuenta inactiva      | `userData.status === "pending"`           | Lanza `ACCOUNT_INACTIVE`            |
| Happy path           | Token válido, perfil activo con matrícula | Retorna `{ uid, email, matricula }` |

#### `src/lib/security/__tests__/cors.test.ts` (modificar)

Agregar caso:

| Test                              | Setup                                                  | Expected               |
| --------------------------------- | ------------------------------------------------------ | ---------------------- |
| localhost rechazado en producción | `NODE_ENV=production`, Origin: `http://localhost:3000` | Lanza `CORS_FORBIDDEN` |

### Tests existentes que deben seguir pasando

- `src/lib/security/__tests__/cors.test.ts` — 5 tests existentes
- `src/lib/security/__tests__/file-validation.test.ts` — 8 tests existentes
- Suite completa `npm test`

---

## Manejo de errores

| Caso                                     | Respuesta HTTP      | Mensaje                                         |
| ---------------------------------------- | ------------------- | ----------------------------------------------- |
| Magic bytes inválidos (extraer/importar) | 400                 | `"Formato de archivo no válido."`               |
| Rate limit en [documentoId]              | 429 + `Retry-After` | `"Demasiadas solicitudes."`                     |
| localhost en prod                        | 403                 | `"Acceso no permitido."` (via `CORS_FORBIDDEN`) |
| Build roto post-upgrade                  | —                   | Revertir `package.json`, investigar changelog   |

---

## Orden de ejecución

1. **CVE upgrades primero** — independientes del código de app, gate de build inmediato
2. **B5 (cors.ts localhost gate)** — un solo archivo, bajo riesgo
3. **B4 (.env.example)** — trivial
4. **B1 + B2 (magic bytes extraer/importar)** — reutilización directa de `validateFileMagicBytes`
5. **B3 (rate limit Redis [documentoId])** — swap de función
6. **Tests requireUserRequest** — al final, mock-heavy, no bloquea nada anterior

---

## Notas de implementación

- No hay cambios de schema en Firestore
- No hay cambios en Firebase rules (no requieren deploy manual)
- `NEXT_PUBLIC_APP_URL` ya existe en `.env.local` y en Vercel — solo falta en `.env.example` para documentación
- El upgrade de `next` puede requerir revisar el changelog de 14.2.15 → 14.2.30 por breaking changes en App Router — esperamos que sean solo patches de seguridad
- `jspdf` se usa únicamente para generación de PDFs en el módulo de bolsa de trabajo — verificar import paths después del upgrade
