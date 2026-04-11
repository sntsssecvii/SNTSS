# User Management v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar el registro de agremiados, añadir reset de contraseña, normalización de nombres, nuevo rol BOLSA, y scripts de cuentas admin.

**Architecture:** Feature branch sobre main. Cambios cliente-servidor coordinados: schema Zod → componentes React → API routes. Scripts de utilidad corren con ts-node y el mismo service account de Firebase.

**Tech Stack:** Next.js 14 App Router, Firebase Admin SDK, Resend, Zod, React Hook Form, Vitest, TypeScript, ts-node.

**Spec:** `docs/superpowers/specs/2026-04-10-user-management-v2-design.md`

---

## Mapa de archivos

| Acción    | Archivo                                                     |
| --------- | ----------------------------------------------------------- |
| Crear     | `src/lib/utils/text.ts`                                     |
| Crear     | `src/lib/utils/__tests__/text.test.ts`                      |
| Modificar | `src/lib/schemas/registro.ts`                               |
| Modificar | `src/types/roles.ts`                                        |
| Modificar | `src/lib/firebase/users.ts`                                 |
| Modificar | `src/lib/auth/roles.ts`                                     |
| Modificar | `src/components/registro/StepInfo.tsx`                      |
| Modificar | `src/components/registro/StepDocs.tsx`                      |
| Modificar | `src/components/registro/RegistroForm.tsx`                  |
| Modificar | `src/app/api/registro/route.ts`                             |
| Modificar | `src/app/api/admin/validaciones/solicitudes/[uid]/route.ts` |
| Crear     | `src/app/(auth)/login/recuperar/page.tsx`                   |
| Crear     | `src/app/api/auth/reset-password/route.ts`                  |
| Modificar | `src/components/Sidebar.tsx`                                |
| Modificar | `src/app/(main)/layout.tsx`                                 |
| Modificar | `src/app/api/admin/global/usuarios/route.ts`                |
| Modificar | `src/app/api/admin/validaciones/solicitudes/route.ts`       |
| Crear     | `scripts/create-admin-users.ts`                             |
| Crear     | `scripts/normalize-nombres.ts`                              |

---

## Task 1: Crear rama feature

**Files:**

- (ninguno — solo git)

- [ ] **Step 1: Crear y posicionarse en la rama**

```bash
git checkout -b feat/user-management-v2
```

- [ ] **Step 2: Verificar rama activa**

```bash
git branch --show-current
```

Esperado: `feat/user-management-v2`

---

## Task 2: Utility `toTitleCase`

**Files:**

- Create: `src/lib/utils/text.ts`
- Create: `src/lib/utils/__tests__/text.test.ts`

- [ ] **Step 1: Escribir el test**

```ts
// src/lib/utils/__tests__/text.test.ts
import { describe, it, expect } from "vitest";
import { toTitleCase } from "@/lib/utils/text";

describe("toTitleCase", () => {
  it("capitaliza primera letra de cada palabra en mayúsculas", () => {
    expect(toTitleCase("JUAN CARLOS")).toBe("Juan Carlos");
  });

  it("capitaliza primera letra de cada palabra en minúsculas", () => {
    expect(toTitleCase("juan carlos")).toBe("Juan Carlos");
  });

  it('respeta partícula "de" entre palabras', () => {
    expect(toTitleCase("PEDRO DE LA ROSA")).toBe("Pedro de la Rosa");
  });

  it('respeta partícula "del" entre palabras', () => {
    expect(toTitleCase("ESPINOZA DEL CAMPO")).toBe("Espinoza del Campo");
  });

  it("siempre capitaliza la primera palabra aunque sea partícula", () => {
    expect(toTitleCase("del monte")).toBe("Del Monte");
  });

  it("hace trim de espacios al inicio y fin", () => {
    expect(toTitleCase("  JUAN CARLOS  ")).toBe("Juan Carlos");
  });

  it("colapsa espacios múltiples internos", () => {
    expect(toTitleCase("JUAN   CARLOS")).toBe("Juan Carlos");
  });

  it("devuelve string vacío sin cambios", () => {
    expect(toTitleCase("")).toBe("");
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npm test src/lib/utils/__tests__/text.test.ts
```

Esperado: FAIL — `Cannot find module '@/lib/utils/text'`

- [ ] **Step 3: Implementar `toTitleCase`**

```ts
// src/lib/utils/text.ts
const PARTICULAS = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "e",
  "o",
  "u",
]);

export function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .trim()
    .split(/\s+/)
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && PARTICULAS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npm test src/lib/utils/__tests__/text.test.ts
```

Esperado: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/text.ts src/lib/utils/__tests__/text.test.ts
git commit -m "feat(utils): agregar toTitleCase con soporte de partículas"
```

---

## Task 3: Schema — apellidoMaterno opcional

**Files:**

- Modify: `src/lib/schemas/registro.ts`

- [ ] **Step 1: Actualizar el schema**

Reemplazar la línea:

```ts
apellidoMaterno: z.string().min(2, 'El apellido materno es muy corto').max(50, 'El apellido materno es muy largo'),
```

Por:

```ts
apellidoMaterno: z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().max(50, 'El apellido materno es muy largo').optional()
),
```

- [ ] **Step 2: Verificar types**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/schemas/registro.ts
git commit -m "feat(registro): apellidoMaterno opcional en schema Zod"
```

---

## Task 4: Types — rol BOLSA e isDeveloper

**Files:**

- Modify: `src/types/roles.ts`
- Modify: `src/lib/firebase/users.ts`

- [ ] **Step 1: Agregar BOLSA al enum ROLES**

En `src/types/roles.ts`, en el enum `ROLES`, agregar después de `CONSULTA`:

```ts
BOLSA = 'BOLSA',
```

- [ ] **Step 2: Agregar permisos de BOLSA a PERMISOS_POR_ROL**

En `src/types/roles.ts`, agregar en el objeto `PERMISOS_POR_ROL` después de `[ROLES.CONSULTA]`:

```ts
[ROLES.BOLSA]: [
  PERMISOS.CARGAR_BOLSA_TRABAJO,
  PERMISOS.PROCESAR_BOLSA_TRABAJO,
  PERMISOS.VER_BOLSA_TRABAJO,
  PERMISOS.VALIDAR_BOLSA_TRABAJO,
  PERMISOS.ELIMINAR_BOLSA_TRABAJO,
  PERMISOS.EXPORTAR_BOLSA_TRABAJO,
],
```

- [ ] **Step 3: Actualizar UserData con isDeveloper y BOLSA**

En `src/lib/firebase/users.ts`, en `BaseUserData`, actualizar el campo `role` y agregar `isDeveloper`:

```ts
export interface BaseUserData {
  email: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  role:
    | "SUPER_ADMIN"
    | "ADMIN"
    | "REVISOR"
    | "CAPTURISTA"
    | "CONSULTA"
    | "BOLSA"
    | "user"
    | "admin"
    | "USER";
  status: "pending" | "active" | "rejected";
  matricula: string;
  curp?: string;
  isDeveloper?: boolean;
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/types/roles.ts src/lib/firebase/users.ts
git commit -m "feat(roles): agregar rol BOLSA e isDeveloper flag"
```

---

## Task 5: lib/auth/roles.ts — helpers BOLSA

**Files:**

- Modify: `src/lib/auth/roles.ts`

- [ ] **Step 1: Agregar isBolsaRole**

Agregar después de `isAdminRole`:

```ts
export function isBolsaRole(role?: string | null): boolean {
  return normalizeUserRole(role) === ROLES.BOLSA;
}
```

- [ ] **Step 2: Agregar BOLSA a getHomeRouteForRole**

En la función `getHomeRouteForRole`, agregar antes del `return null` final:

```ts
if (normalized === ROLES.BOLSA) {
  return "/admin/bolsa-de-trabajo";
}
```

- [ ] **Step 3: Agregar BOLSA a getRoleLabel**

En el switch de `getRoleLabel`, agregar antes del `default`:

```ts
case ROLES.BOLSA:
  return 'Bolsa de Trabajo'
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/roles.ts
git commit -m "feat(auth): helpers isBolsaRole, home route y label para BOLSA"
```

---

## Task 6: StepInfo — checkbox apellido materno + toTitleCase

**Files:**

- Modify: `src/components/registro/StepInfo.tsx`

- [ ] **Step 1: Actualizar imports**

Agregar al bloque de imports existente:

```ts
import { useState } from "react";
import { toTitleCase } from "@/lib/utils/text";
```

(El `useState` ya está importado — solo agregar `toTitleCase`)

- [ ] **Step 2: Actualizar el stepInfoSchema para apellidoMaterno opcional**

Reemplazar:

```ts
const stepInfoSchema = registroBaseSchema.pick({
    nombre: true,
    apellidoPaterno: true,
    apellidoMaterno: true,
```

Por — el schema base ya es opcional, así que el `.pick()` hereda eso. No cambia nada aquí. Continuar.

- [ ] **Step 3: Agregar estado sinApellidoMaterno y obtener setValue del form**

En el componente `StepInfo`, actualizar el destructuring del hook:

```ts
const {
  register,
  handleSubmit,
  watch,
  setValue,
  formState: { errors },
} = useForm<z.infer<typeof stepInfoSchema>>({
  resolver: zodResolver(stepInfoSchema),
  defaultValues: initialData,
});

const [sinApellidoMaterno, setSinApellidoMaterno] = useState(false);
```

- [ ] **Step 4: Reemplazar el bloque del campo apellidoMaterno**

Reemplazar el bloque `<div className="space-y-2">` que contiene el input `apellidoMaterno` por:

```tsx
<div className="space-y-2">
  <Label htmlFor="apellidoMaterno">Apellido Materno</Label>
  <Input
    id="apellidoMaterno"
    placeholder="Ej. López"
    disabled={sinApellidoMaterno}
    {...register("apellidoMaterno", {
      onBlur: (e) => {
        if (!sinApellidoMaterno && e.target.value) {
          setValue("apellidoMaterno", toTitleCase(e.target.value));
        }
      },
    })}
    className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
  />
  <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
    <input
      type="checkbox"
      checked={sinApellidoMaterno}
      onChange={(e) => {
        setSinApellidoMaterno(e.target.checked);
        if (e.target.checked) setValue("apellidoMaterno", "");
      }}
      className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
    />
    <span className="text-sm text-slate-600">No tengo apellido materno</span>
  </label>
  {errors.apellidoMaterno && (
    <p className="text-sm text-red-500">{errors.apellidoMaterno.message}</p>
  )}
</div>
```

- [ ] **Step 5: Agregar toTitleCase onBlur a nombre y apellidoPaterno**

Reemplazar el bloque `<div className="grid gap-6 md:grid-cols-2">` que contiene nombre y apellidoPaterno:

```tsx
<div className="grid gap-6 md:grid-cols-2">
  <div className="space-y-2">
    <Label htmlFor="nombre">Nombre(s)</Label>
    <Input
      id="nombre"
      placeholder="Ej. Juan Carlos"
      {...register("nombre", {
        onBlur: (e) => {
          if (e.target.value) setValue("nombre", toTitleCase(e.target.value));
        },
      })}
      className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
    />
    {errors.nombre && (
      <p className="text-sm text-red-500">{errors.nombre.message}</p>
    )}
  </div>
  <div className="space-y-2">
    <Label htmlFor="apellidoPaterno">Apellido Paterno</Label>
    <Input
      id="apellidoPaterno"
      placeholder="Ej. Pérez"
      {...register("apellidoPaterno", {
        onBlur: (e) => {
          if (e.target.value)
            setValue("apellidoPaterno", toTitleCase(e.target.value));
        },
      })}
      className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
    />
    {errors.apellidoPaterno && (
      <p className="text-sm text-red-500">{errors.apellidoPaterno.message}</p>
    )}
  </div>
</div>
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 7: Probar en navegador**

```bash
npm run dev
```

Navegar a `/registro`. Verificar:

- Escribir "JUAN CARLOS" en nombre → al hacer click fuera → "Juan Carlos"
- Activar checkbox → input apellido materno se deshabilita y limpia
- Desactivar checkbox → input se habilita de nuevo

- [ ] **Step 8: Commit**

```bash
git add src/components/registro/StepInfo.tsx
git commit -m "feat(registro): apellido materno opcional + normalización title-case onBlur"
```

---

## Task 7: StepDocs — constancia de afiliación

**Files:**

- Modify: `src/components/registro/StepDocs.tsx`

- [ ] **Step 1: Actualizar interfaz y estado**

Reemplazar la interfaz `StepDocsProps`:

```ts
interface StepDocsProps {
  onBack: () => void;
  onSubmit: (files: {
    identificacion: File;
    tarjeton: File;
    constanciaAfiliacion: File;
  }) => void;
  isSubmitting: boolean;
}
```

Agregar estado para el tercer documento (dentro del componente, junto a los otros estados):

```ts
const [constanciaAfiliacion, setConstanciaAfiliacion] = useState<File | null>(
  null,
);
const constanciaInputRef = useRef<HTMLInputElement>(null);
```

Actualizar el tipo de `errors`:

```ts
const [errors, setErrors] = useState<{
  identificacion?: string;
  tarjeton?: string;
  constanciaAfiliacion?: string;
}>({});
```

Actualizar `processing`:

```ts
const [processing, setProcessing] = useState<{ [key: string]: boolean }>({});
```

- [ ] **Step 2: Actualizar handleFileChange para aceptar constanciaAfiliacion**

Actualizar el tipo del parámetro `type`:

```ts
const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'identificacion' | 'tarjeton' | 'constanciaAfiliacion'
) => {
```

Agregar el setter dentro del `try`:

```ts
if (type === "identificacion") setIdentificacion(finalFile);
else if (type === "tarjeton") setTarjeton(finalFile);
else setConstanciaAfiliacion(finalFile);
```

- [ ] **Step 3: Actualizar handleSubmit para validar y enviar los 3 documentos**

Reemplazar `handleSubmit`:

```ts
const handleSubmit = () => {
  const newErrors: {
    identificacion?: string;
    tarjeton?: string;
    constanciaAfiliacion?: string;
  } = {};
  if (!identificacion)
    newErrors.identificacion = "Debes subir tu identificación";
  if (!tarjeton) newErrors.tarjeton = "Debes subir tu tarjetón de pago";
  if (!constanciaAfiliacion)
    newErrors.constanciaAfiliacion = "Debes subir tu constancia de afiliación";

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }

  if (identificacion && tarjeton && constanciaAfiliacion) {
    onSubmit({ identificacion, tarjeton, constanciaAfiliacion });
  }
};
```

- [ ] **Step 4: Actualizar el layout del JSX**

Reemplazar el bloque `<div className="grid gap-8 md:grid-cols-2">` y lo que sigue hasta el `<div className="flex flex-col-reverse...">` por:

```tsx
<div className="grid gap-8 md:grid-cols-2">
    <FileCard
        file={identificacion}
        type="identificacion"
        label="Identificación Oficial (INE/IFE)"
        inputRef={idInputRef}
        error={errors.identificacion}
        isProcessing={processing.identificacion || false}
    />
    <FileCard
        file={tarjeton}
        type="tarjeton"
        label="Tarjetón de Pago Reciente"
        inputRef={tarjetonInputRef}
        error={errors.tarjeton}
        isProcessing={processing.tarjeton || false}
    />
</div>

<div className="grid gap-8 md:grid-cols-1 max-w-sm mx-auto w-full">
    <FileCard
        file={constanciaAfiliacion}
        type="constanciaAfiliacion"
        label="Constancia de Afiliación Sindical"
        inputRef={constanciaInputRef}
        error={errors.constanciaAfiliacion}
        isProcessing={processing.constanciaAfiliacion || false}
    />
</div>
```

También actualizar el botón deshabilitado para incluir el tercer archivo:

```tsx
disabled={isSubmitting || processing.identificacion || processing.tarjeton || processing.constanciaAfiliacion}
```

- [ ] **Step 5: Actualizar el remover dentro de FileCard**

En el `<Button>` de remover dentro de `FileCard`, actualizar la lógica para incluir `constanciaAfiliacion`:

```ts
onClick={() => {
    if (type === 'identificacion') setIdentificacion(null)
    else if (type === 'tarjeton') setTarjeton(null)
    else setConstanciaAfiliacion(null)
    if (inputRef.current) inputRef.current.value = ''
}}
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/registro/StepDocs.tsx
git commit -m "feat(registro): agregar constancia de afiliación como tercer documento"
```

---

## Task 8: RegistroForm — pasar constanciaAfiliacion

**Files:**

- Modify: `src/components/registro/RegistroForm.tsx`

- [ ] **Step 1: Actualizar handleDocsSubmit**

Reemplazar el parámetro y el `payload.set` de archivos:

```ts
const handleDocsSubmit = async (files: { identificacion: File, tarjeton: File, constanciaAfiliacion: File }) => {
    // ...validaciones existentes sin cambio...

    try {
        const payload = new FormData()
        payload.set('nombre', formData.nombre || '')
        payload.set('apellidoPaterno', formData.apellidoPaterno || '')
        payload.set('apellidoMaterno', formData.apellidoMaterno || '')
        payload.set('matricula', formData.matricula || '')
        payload.set('email', formData.email || '')
        payload.set('password', formData.password || '')
        payload.set('confirmPassword', formData.confirmPassword || '')
        payload.set('identificacion', files.identificacion)
        payload.set('tarjeton', files.tarjeton)
        payload.set('constanciaAfiliacion', files.constanciaAfiliacion)  // <-- agregar
        // resto igual...
    }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/registro/RegistroForm.tsx
git commit -m "feat(registro): enviar constanciaAfiliacion en FormData"
```

---

## Task 9: API registro — tercer documento + apellidoMaterno null

**Files:**

- Modify: `src/app/api/registro/route.ts`

- [ ] **Step 1: Actualizar tipo de uploadRegistrationFile**

Buscar la función `uploadRegistrationFile` y actualizar el tipo del parámetro `type`:

```ts
async function uploadRegistrationFile(
  userUid: string,
  file: File,
  type: "identificacion" | "tarjeton" | "constanciaAfiliacion",
);
```

- [ ] **Step 2: Actualizar extracción y validación del tercer archivo**

Después de las líneas `const identificacion = getFileField(...)` y `const tarjeton = getFileField(...)`, agregar:

```ts
const constanciaAfiliacion = getFileField(formData, "constanciaAfiliacion");
```

Después de `validateRegistrationFile(tarjeton, "tarjeton")`, agregar:

```ts
validateRegistrationFile(constanciaAfiliacion, "constanciaafiliacion");
const constanciaAfiliacionFile = constanciaAfiliacion as File;
```

- [ ] **Step 3: Actualizar el upload a Promise.all de 3 archivos**

Reemplazar el bloque `const [identificacionUpload, tarjetonUpload] = await Promise.all(...)` por:

```ts
const [identificacionUpload, tarjetonUpload, constanciaUpload] =
  await Promise.all([
    uploadRegistrationFile(authUser.uid, identificacionFile, "identificacion"),
    uploadRegistrationFile(authUser.uid, tarjetonFile, "tarjeton"),
    uploadRegistrationFile(
      authUser.uid,
      constanciaAfiliacionFile,
      "constanciaAfiliacion",
    ),
  ]);

uploadedPaths.push(
  identificacionUpload.path,
  tarjetonUpload.path,
  constanciaUpload.path,
);
```

- [ ] **Step 4: Actualizar el set de Firestore para guardar los 3 documentos y apellidoMaterno null**

En el `adminDb.collection('users').doc(authUser.uid).set({...})`, actualizar:

```ts
apellidoMaterno: parsed.data.apellidoMaterno ?? null,
// ...
documents: {
  identificacion: identificacionUpload.url,
  tarjeton: tarjetonUpload.url,
  constanciaAfiliacion: constanciaUpload.url,
},
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/registro/route.ts
git commit -m "feat(api/registro): tercer documento constanciaAfiliacion + apellidoMaterno nullable"
```

---

## Task 10: API validaciones — borrar documentos al aprobar

**Files:**

- Modify: `src/app/api/admin/validaciones/solicitudes/[uid]/route.ts`

- [ ] **Step 1: Agregar import de adminStorage**

Al inicio del archivo, en el bloque de imports de Firebase, agregar `adminStorage`:

```ts
import { adminDb, adminStorage } from "@/lib/firebase/admin";
```

(Verificar que `adminStorage` está exportado en `src/lib/firebase/admin.ts` — si no, ver Task 10 nota al final)

- [ ] **Step 2: Agregar borrado de documentos cuando nextStatus es 'active'**

En la función `POST`, después del bloque `await userRef.update({...})` (el que cambia el status), agregar el borrado condicional:

```ts
// Borrar documentos de Storage al aprobar (datos sensibles)
if (nextStatus === "active") {
  try {
    const bucket = adminStorage.bucket();
    const [storageFiles] = await bucket.getFiles({ prefix: `uploads/${uid}/` });

    await Promise.all(
      storageFiles.map((f) =>
        f.delete().catch((err) => {
          console.error(`[validaciones] Error borrando ${f.name}:`, err);
        }),
      ),
    );

    await userRef.update({
      documents: {
        identificacion: null,
        tarjeton: null,
        constanciaAfiliacion: null,
      },
      documentsDeletedAt: FieldValue.serverTimestamp(),
      validatedBy: actorUid,
      validatedAt: FieldValue.serverTimestamp(),
    });
  } catch (storageErr) {
    // El borrado no revierte la aprobación — solo loguear
    console.error("[validaciones] Error en cleanup de Storage:", storageErr);
  }
}
```

- [ ] **Nota sobre adminStorage:** Si `adminStorage` no está exportado en `src/lib/firebase/admin.ts`, abrir ese archivo y agregar:

```ts
import { getStorage } from "firebase-admin/storage";
// ...
export const adminStorage = getStorage();
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/validaciones/solicitudes/[uid]/route.ts src/lib/firebase/admin.ts
git commit -m "feat(validaciones): borrar documentos sensibles de Storage al aprobar usuario"
```

---

## Task 11: Reset de contraseña — endpoint + página

**Files:**

- Create: `src/app/api/auth/reset-password/route.ts`
- Create: `src/app/(auth)/login/recuperar/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx` (agregar link)

- [ ] **Step 1: Crear el endpoint**

```ts
// src/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { sendPasswordResetEmail } from "@/lib/email";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let email = "";

  try {
    const body = await request.json().catch(() => ({}));
    email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    // Rate limit por email (3 intentos / hora)
    if (email) {
      await enforceRateLimitRedis(request, {
        bucket: "api:auth:reset:email",
        limit: 3,
        windowMs: 60 * 60_000,
        identifier: email,
      });
    }

    // Anti-enumeration: procesamos en background y siempre respondemos 200
    if (email && email.includes("@")) {
      setImmediate(async () => {
        try {
          const resetLink = await adminAuth.generatePasswordResetLink(email, {
            url: `${process.env.NEXT_PUBLIC_APP_URL || "https://sntssvii.com"}/login`,
          });

          const userRecord = await adminAuth.getUserByEmail(email);
          const userDoc = await adminDb
            .collection("users")
            .doc(userRecord.uid)
            .get();
          const nombre = userDoc.exists
            ? userDoc.data()?.nombre || "Usuario"
            : "Usuario";

          await sendPasswordResetEmail(email, nombre, resetLink);
        } catch (err) {
          // No exponer — anti-enumeration
          console.error("[reset-password] Error generando/enviando link:", err);
        }
      });
    }

    // Siempre 200 — no confirmamos si el email existe
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }

    // Cualquier otro error → 200 (anti-enumeration)
    return NextResponse.json({ success: true });
  }
}
```

- [ ] **Step 2: Crear la página /login/recuperar**

```tsx
// src/app/(auth)/login/recuperar/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import logoSNTSS from "@/assets/logo-sntss.png";

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (res.status === 429) {
        setError("Demasiados intentos. Espera un momento e intenta de nuevo.");
        return;
      }

      setSent(true);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6"
        >
          <div className="flex items-center gap-3">
            <Image
              src={logoSNTSS}
              alt="SNTSS"
              width={48}
              height={24}
              className="object-contain"
            />
            <span className="text-xs font-black uppercase tracking-widest text-red-700">
              Sección VII
            </span>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="flex justify-center">
                <CheckCircle2 className="w-14 h-14 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Revisa tu correo
              </h2>
              <p className="text-slate-500 text-sm">
                Si existe una cuenta con ese correo, recibirás un enlace para
                restablecer tu contraseña en los próximos minutos.
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full mt-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al inicio de sesión
                </Button>
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-900">
                  Restablecer contraseña
                </h2>
                <p className="text-slate-500 text-sm">
                  Ingresa tu correo y te enviaremos un enlace para crear una
                  nueva contraseña.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nombre@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      disabled={isLoading}
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white"
                >
                  {isLoading ? "Enviando..." : "Enviar instrucciones"}
                </Button>
              </form>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-slate-500 hover:text-red-700 transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Actualizar link existente en LoginForm**

`src/components/LoginForm.tsx` ya tiene en la línea ~160 un link a `/recuperar-password`. Actualizar el href:

```tsx
// src/components/LoginForm.tsx  — buscar y reemplazar
// Antes:
href = "/recuperar-password";
// Después:
href = "/login/recuperar";
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 5: Probar en navegador**

```bash
npm run dev
```

Navegar a `/login/recuperar`. Verificar:

- Form se muestra correctamente
- Al enviar email válido → aparece pantalla de confirmación
- Link "Volver al inicio de sesión" funciona

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/reset-password/route.ts src/app/(auth)/login/recuperar/page.tsx src/app/(auth)/login/
git commit -m "feat(auth): reset de contraseña con Resend — endpoint + página /login/recuperar"
```

---

## Task 12: Sidebar + guard de rutas para BOLSA

**Files:**

- Modify: `src/components/Sidebar.tsx`
- Modify: `src/app/(main)/layout.tsx`

- [ ] **Step 1: Agregar nav items para BOLSA en el Sidebar**

En la función `getNavItems`, agregar después del bloque `if (roleUpper === 'SUPER_ADMIN')`:

```ts
if (roleUpper === "BOLSA") {
  baseItems.push({
    title: "Bolsa de Trabajo",
    href: "/admin/bolsa-de-trabajo",
    icon: Users,
  });
}
```

- [ ] **Step 2: Agregar guard de rutas en el layout principal**

Actualizar `src/app/(main)/layout.tsx` para agregar protección de rutas para el rol BOLSA:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { CommandPalette } from "@/components/CommandPalette";
import { useAuth } from "@/contexts/AuthContext";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userData } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (userData?.role?.toUpperCase() === "BOLSA") {
      if (!pathname.startsWith("/admin/bolsa-de-trabajo")) {
        router.replace("/admin/bolsa-de-trabajo");
      }
    }
  }, [userData, pathname, router]);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-64">
        <Navbar />
        <main className="flex-1 p-3 sm:p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/app/(main)/layout.tsx
git commit -m "feat(nav): nav items BOLSA + guard de rutas en layout principal"
```

---

## Task 13: Filtrar SUPER_ADMIN en queries de usuarios

**Files:**

- Modify: `src/app/api/admin/global/usuarios/route.ts`
- Modify: `src/app/api/admin/validaciones/solicitudes/route.ts`

- [ ] **Step 1: Filtrar SUPER_ADMIN en /admin/global/usuarios**

En `src/app/api/admin/global/usuarios/route.ts`, en la función `GET`, localizar el bloque donde se hace `.map()` sobre `docs`:

```ts
const usuarios = docs
  .map((doc) => {
```

Agregar un `.filter()` antes del `.map()`:

```ts
const usuarios = docs
  .filter((doc) => doc.data().role !== 'SUPER_ADMIN') // Las cuentas SUPER_ADMIN se excluyen intencionalmente
  .map((doc) => {
```

- [ ] **Step 2: Filtrar SUPER_ADMIN en /admin/validaciones/solicitudes**

Abrir `src/app/api/admin/validaciones/solicitudes/route.ts`. Localizar el bloque donde se hace `.map()` sobre los documentos del snapshot. Agregar el mismo `.filter()` antes del `.map()`:

```ts
const requests = snapshot.docs
  .filter((doc) => doc.data().role !== 'SUPER_ADMIN') // Las cuentas SUPER_ADMIN se excluyen intencionalmente
  .map((doc) => {
```

La variable se llama `requests` en ese archivo (línea ~103). Mantener el resto del `.map()` sin cambios.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/global/usuarios/route.ts src/app/api/admin/validaciones/solicitudes/route.ts
git commit -m "feat(admin): ocultar SUPER_ADMIN de listas de usuarios y validaciones"
```

---

## Task 14: Script — crear cuentas admin

**Files:**

- Create: `scripts/create-admin-users.ts`

- [ ] **Step 1: Verificar que ts-node está disponible**

```bash
npx ts-node --version
```

Si falla: `npm install --save-dev ts-node tsconfig-paths`

- [ ] **Step 2: Crear el script**

```ts
// scripts/create-admin-users.ts
// Ejecutar con:
// GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
//   npx ts-node -r tsconfig-paths/register scripts/create-admin-users.ts

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// Cargar service account
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(
    process.env.HOME || "",
    ".config/firebase/sntss-service-account.json",
  );

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account no encontrado: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: serviceAccount.project_id + ".appspot.com",
  });
}

const auth = admin.auth();
const db = admin.firestore();

interface AdminUserSpec {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  email: string;
  password: string; // CAMBIAR INMEDIATAMENTE DESPUÉS DE CREAR
  role: "SUPER_ADMIN" | "BOLSA";
  isDeveloper: boolean;
}

const ADMIN_USERS: AdminUserSpec[] = [
  {
    nombre: "Gerardo",
    apellidoPaterno: "Arroyo",
    email: "gerardoyx@gmail.com",
    password: "123456", // CAMBIAR INMEDIATAMENTE
    role: "SUPER_ADMIN",
    isDeveloper: true,
  },
  {
    nombre: "Juan Miguel",
    apellidoPaterno: "Espinoza",
    apellidoMaterno: "Aguilar",
    email: "admin@sntssvii.com",
    password: "123456", // CAMBIAR INMEDIATAMENTE
    role: "SUPER_ADMIN",
    isDeveloper: false,
  },
  {
    nombre: "Gabriela",
    apellidoPaterno: "Chapital",
    email: "gaby.chapital@hotmail.com",
    password: "123456", // CAMBIAR INMEDIATAMENTE
    role: "BOLSA",
    isDeveloper: false,
  },
];

async function createOrUpdateUser(spec: AdminUserSpec): Promise<void> {
  const displayName = [spec.nombre, spec.apellidoPaterno, spec.apellidoMaterno]
    .filter(Boolean)
    .join(" ");

  let uid: string;
  let action: "CREADO" | "ACTUALIZADO";

  try {
    const existing = await auth.getUserByEmail(spec.email);
    uid = existing.uid;
    action = "ACTUALIZADO";
  } catch {
    const created = await auth.createUser({
      email: spec.email,
      password: spec.password,
      displayName,
    });
    uid = created.uid;
    action = "CREADO";
  }

  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        uid,
        nombre: spec.nombre,
        apellidoPaterno: spec.apellidoPaterno,
        apellidoMaterno: spec.apellidoMaterno ?? null,
        email: spec.email,
        role: spec.role,
        status: "active",
        isDeveloper: spec.isDeveloper,
        matricula: "",
        documents: {
          identificacion: null,
          tarjeton: null,
          constanciaAfiliacion: null,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  console.log(
    `[${action}] ${spec.email} — rol: ${spec.role}, isDeveloper: ${spec.isDeveloper}, uid: ${uid}`,
  );
}

async function main() {
  console.log("=== create-admin-users ===\n");
  for (const user of ADMIN_USERS) {
    await createOrUpdateUser(user);
  }
  console.log("\n✓ Listo. RECUERDA CAMBIAR LAS CONTRASEÑAS INMEDIATAMENTE.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Ejecutar el script**

```bash
npx ts-node -r tsconfig-paths/register scripts/create-admin-users.ts
```

Esperado en consola:

```
=== create-admin-users ===

[CREADO] gerardoyx@gmail.com — rol: SUPER_ADMIN, isDeveloper: true, uid: ...
[CREADO] admin@sntssvii.com — rol: SUPER_ADMIN, isDeveloper: false, uid: ...
[CREADO] gaby.chapital@hotmail.com — rol: BOLSA, isDeveloper: false, uid: ...

✓ Listo. RECUERDA CAMBIAR LAS CONTRASEÑAS INMEDIATAMENTE.
```

- [ ] **Step 4: Verificar en Firebase Console**

Abrir Firebase Console → Authentication → Users y confirmar que los 3 usuarios existen. Luego Firestore → colección `users` y verificar los documentos.

- [ ] **Step 5: Commit**

```bash
git add scripts/create-admin-users.ts
git commit -m "feat(scripts): create-admin-users — 3 cuentas admin iniciales"
```

---

## Task 15: Script — normalizar nombres existentes

**Files:**

- Create: `scripts/normalize-nombres.ts`

- [ ] **Step 1: Crear el script**

```ts
// scripts/normalize-nombres.ts
// Ejecutar con:
// GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
//   npx ts-node -r tsconfig-paths/register scripts/normalize-nombres.ts

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// Cargar service account
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(
    process.env.HOME || "",
    ".config/firebase/sntss-service-account.json",
  );

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account no encontrado: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

// Partículas que NO se capitalizan (excepto al inicio de la cadena)
const PARTICULAS = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "e",
  "o",
  "u",
]);

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .trim()
    .split(/\s+/)
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && PARTICULAS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

interface ChangeLog {
  uid: string;
  email: string;
  antes: {
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  };
  despues: {
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  };
}

async function main() {
  console.log("=== normalize-nombres ===\n");

  const snapshot = await db
    .collection("users")
    .where("role", "!=", "SUPER_ADMIN")
    .get();

  console.log(
    `Total usuarios a revisar (excl. SUPER_ADMIN): ${snapshot.size}\n`,
  );

  const changes: ChangeLog[] = [];
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const uid = docSnap.id;

    const nombreOriginal = data.nombre || "";
    const apellidoPaternoOriginal = data.apellidoPaterno || "";
    const apellidoMaternoOriginal = data.apellidoMaterno || "";

    const nombreNormalizado = toTitleCase(nombreOriginal);
    const apellidoPaternoNormalizado = toTitleCase(apellidoPaternoOriginal);
    const apellidoMaternoNormalizado = apellidoMaternoOriginal
      ? toTitleCase(apellidoMaternoOriginal)
      : apellidoMaternoOriginal;

    const changed =
      nombreNormalizado !== nombreOriginal ||
      apellidoPaternoNormalizado !== apellidoPaternoOriginal ||
      apellidoMaternoNormalizado !== apellidoMaternoOriginal;

    if (!changed) {
      skipped++;
      continue;
    }

    // Actualizar Firestore
    await docSnap.ref.update({
      nombre: nombreNormalizado,
      apellidoPaterno: apellidoPaternoNormalizado,
      apellidoMaterno: apellidoMaternoNormalizado,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Actualizar displayName en Firebase Auth
    const displayName = [
      nombreNormalizado,
      apellidoPaternoNormalizado,
      apellidoMaternoNormalizado,
    ]
      .filter(Boolean)
      .join(" ");

    try {
      await auth.updateUser(uid, { displayName });
    } catch (err) {
      console.warn(
        `  ⚠ No se pudo actualizar Auth displayName para ${uid}:`,
        err,
      );
    }

    changes.push({
      uid,
      email: data.email || "",
      antes: {
        nombre: nombreOriginal,
        apellidoPaterno: apellidoPaternoOriginal,
        apellidoMaterno: apellidoMaternoOriginal,
      },
      despues: {
        nombre: nombreNormalizado,
        apellidoPaterno: apellidoPaternoNormalizado,
        apellidoMaterno: apellidoMaternoNormalizado,
      },
    });

    updated++;
    console.log(
      `  ✓ ${data.email}: "${nombreOriginal}" → "${nombreNormalizado}"`,
    );
  }

  // Guardar log
  const logDir = path.join(process.cwd(), "artifacts");
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(
    logDir,
    `normalize-nombres-${new Date().toISOString().slice(0, 10)}.json`,
  );
  fs.writeFileSync(logPath, JSON.stringify(changes, null, 2), "utf-8");

  console.log(`\n✓ Actualizados: ${updated} | Sin cambios: ${skipped}`);
  console.log(`✓ Log guardado en: ${logPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Ejecutar el script**

```bash
npx ts-node -r tsconfig-paths/register scripts/normalize-nombres.ts
```

Esperado: log en consola con los usuarios modificados y archivo `artifacts/normalize-nombres-YYYY-MM-DD.json`.

- [ ] **Step 3: Verificar el log**

```bash
cat artifacts/normalize-nombres-*.json | head -50
```

Revisar que los cambios son correctos antes de confirmar.

- [ ] **Step 4: Commit**

```bash
git add scripts/normalize-nombres.ts artifacts/.gitkeep
git commit -m "feat(scripts): normalize-nombres — title-case one-shot para usuarios existentes"
```

---

## Task 16: Validación final + check completo

**Files:**

- (ninguno — solo comandos)

- [ ] **Step 1: Correr check completo**

```bash
npm run check
```

Esperado: typecheck + lint sin errores.

- [ ] **Step 2: Correr tests**

```bash
npm test
```

Esperado: todos los tests pasan, incluyendo el nuevo `text.test.ts`.

- [ ] **Step 3: Build de producción**

```bash
npm run build
```

Esperado: build exitoso sin errores.

- [ ] **Step 4: Commit final si hay ajustes menores**

```bash
git add -A
git commit -m "chore: ajustes finales user-management-v2"
```

- [ ] **Step 5: Abrir PR hacia main**

```bash
gh pr create \
  --title "feat: user-management-v2 — registro, roles, reset, normalización" \
  --body "Ver spec: docs/superpowers/specs/2026-04-10-user-management-v2-design.md"
```

---

## Notas de ejecución

- **Rama:** `feat/user-management-v2` — NO mezclar con cambios de seguridad en `main`
- **Scripts:** Requieren `GOOGLE_APPLICATION_CREDENTIALS` apuntando al service account en `~/.config/firebase/sntss-service-account.json`
- **Contraseñas:** Los 3 usuarios admin se crean con `123456` — cambiar inmediatamente después de Task 14
- **Task 10 nota:** Verificar que `adminStorage` está exportado en `src/lib/firebase/admin.ts` antes de modificar el route de validaciones
