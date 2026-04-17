# Escalafón — UI de Lotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replicar exactamente la UI de bolsa-de-trabajo en el módulo de escalafón, agrupando los 50-80 PDFs por quincena en "lotes" con gestión ABIERTO/CERRADO y soporte de reemplazo.

**Architecture:** Nueva colección Firestore `escalafon_lotes` + campo `loteId` en `escalafon_listados`. API routes de lotes + modificación del procesar existente. UI: 4 páginas que replican byte-a-byte el estilo visual de bolsa-de-trabajo.

**Tech Stack:** Next.js 14 App Router, Firebase Admin SDK, shadcn (Card, Badge, Button, Input), lucide-react, Tailwind CSS.

---

## File Map

| Acción  | Archivo                                                        |
| ------- | -------------------------------------------------------------- |
| Modify  | `src/types/escalafon.ts`                                       |
| Create  | `src/lib/firebase/escalafon-lotes.ts`                          |
| Create  | `src/lib/firebase/__tests__/escalafon-lotes.test.ts`           |
| Modify  | `firestore.indexes.json`                                       |
| Create  | `src/app/api/escalafon/lotes/route.ts`                         |
| Create  | `src/app/api/escalafon/lotes/[loteId]/route.ts`                |
| Modify  | `src/app/api/escalafon/procesar/route.ts`                      |
| Rewrite | `src/app/(main)/admin/escalafon/page.tsx`                      |
| Create  | `src/app/(main)/admin/escalafon/[loteId]/page.tsx`             |
| Create  | `src/app/(main)/admin/escalafon/[loteId]/[listadoId]/page.tsx` |
| Delete  | `src/app/(main)/admin/escalafon/[listadoId]/page.tsx`          |
| Rewrite | `src/app/(main)/admin/escalafon/cargar/page.tsx`               |
| Create  | `scripts/migrations/escalafon-lotes-migration.ts`              |

---

### Task 1: Types

**Files:**

- Modify: `src/types/escalafon.ts`

- [ ] **Step 1: Agregar `EscalafonLote` y `loteId` a `EscalafonListado`**

Abrir `src/types/escalafon.ts`. Agregar al final, y añadir `loteId?: string` en `EscalafonListado`:

```typescript
export interface EscalafonPreferencia {
  delegacionSolicitada: string;
  zonaSolicitada: string;
  localidadSolicitada: string;
  adscripcionCode: string;
  adscripcionDesc: string;
  turnoNum: number | null;
  turnoDesc: string;
}

export interface EscalafonAspirante {
  id?: string;
  listadoId: string;
  lugar: number;
  estatus: "Activo" | "PEI";
  matricula: string;
  nombre: string;
  delegacion: string;
  fechaRegistro: string;
  preferencias: EscalafonPreferencia[];
  posicionesPorZona?: Record<string, number>;
}

export interface EscalafonListado {
  id?: string;
  loteId?: string; // <-- NUEVO: campo opcional para retrocompatibilidad
  delegacion: string;
  numeroListado: string;
  sector: string;
  fechaEmision: string;
  categoriaCode: string;
  categoriaDesc: string;
  areaCode: string;
  areaDesc: string;
  convocatoria: string;
  vigenciaInicio: string;
  vigenciaFin: string;
  periodoDecierre: string;
  totalAspirantes: number;
  aspirantesParsed: number;
  subidoPor: string;
  creadoEn: string;
  zonas: string[];
}

export interface EscalafonParseResult {
  listado: Omit<
    EscalafonListado,
    "id" | "subidoPor" | "creadoEn" | "aspirantesParsed" | "zonas" | "loteId"
  >;
  aspirantes: Omit<
    EscalafonAspirante,
    "id" | "listadoId" | "posicionesPorZona"
  >[];
  errores: string[];
}

// NUEVO
export interface EscalafonLote {
  id?: string;
  nombre: string;
  estado: "ABIERTO" | "CERRADO";
  totalListados: number;
  subidoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/types/escalafon.ts
git commit -m "feat(escalafon): agregar EscalafonLote y loteId a EscalafonListado"
```

---

### Task 2: Capa de datos Firestore — lotes

**Files:**

- Create: `src/lib/firebase/escalafon-lotes.ts`
- Create: `src/lib/firebase/__tests__/escalafon-lotes.test.ts`

- [ ] **Step 1: Escribir el test de `generarNombreLote` (TDD)**

Crear `src/lib/firebase/__tests__/escalafon-lotes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generarNombreLote } from "../escalafon-lotes";

describe("generarNombreLote", () => {
  it("devuelve Q1 para día 1", () => {
    expect(generarNombreLote(new Date(2026, 3, 1))).toBe("Abril 2026 · Q1");
  });

  it("devuelve Q1 para día 15", () => {
    expect(generarNombreLote(new Date(2026, 3, 15))).toBe("Abril 2026 · Q1");
  });

  it("devuelve Q2 para día 16", () => {
    expect(generarNombreLote(new Date(2026, 3, 16))).toBe("Abril 2026 · Q2");
  });

  it("devuelve Q2 para día 31", () => {
    expect(generarNombreLote(new Date(2026, 2, 31))).toBe("Marzo 2026 · Q2");
  });

  it("mes de enero", () => {
    expect(generarNombreLote(new Date(2026, 0, 5))).toBe("Enero 2026 · Q1");
  });

  it("mes de diciembre", () => {
    expect(generarNombreLote(new Date(2026, 11, 20))).toBe(
      "Diciembre 2026 · Q2",
    );
  });
});
```

- [ ] **Step 2: Correr test — debe fallar**

```bash
npm test src/lib/firebase/__tests__/escalafon-lotes.test.ts
```

Expected: FAIL con "Cannot find module '../escalafon-lotes'"

- [ ] **Step 3: Implementar `src/lib/firebase/escalafon-lotes.ts`**

```typescript
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { EscalafonLote, EscalafonListado } from "@/types/escalafon";

const COL_LOTES = "escalafon_lotes";
const COL_LISTADOS = "escalafon_listados";

const NOMBRES_MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function generarNombreLote(fecha: Date = new Date()): string {
  const mes = NOMBRES_MESES[fecha.getMonth()];
  const anio = fecha.getFullYear();
  const quincena = fecha.getDate() <= 15 ? "Q1" : "Q2";
  return `${mes} ${anio} · ${quincena}`;
}

export async function crearLote(
  nombre: string,
  subidoPor: string,
): Promise<string> {
  const ref = adminDb.collection(COL_LOTES).doc();
  const now = Timestamp.now();
  await ref.set({
    nombre,
    estado: "ABIERTO",
    totalListados: 0,
    subidoPor,
    creadoEn: now,
    actualizadoEn: now,
  });
  return ref.id;
}

export async function obtenerLoteAbierto(): Promise<EscalafonLote | null> {
  const snap = await adminDb
    .collection(COL_LOTES)
    .where("estado", "==", "ABIERTO")
    .orderBy("creadoEn", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as EscalafonLote;
}

export async function listarLotes(): Promise<EscalafonLote[]> {
  const snap = await adminDb
    .collection(COL_LOTES)
    .orderBy("creadoEn", "desc")
    .get();
  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as EscalafonLote,
  );
}

export async function obtenerLote(
  loteId: string,
): Promise<EscalafonLote | null> {
  const doc = await adminDb.collection(COL_LOTES).doc(loteId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as EscalafonLote;
}

export async function listarListadosDelLote(
  loteId: string,
): Promise<EscalafonListado[]> {
  const snap = await adminDb
    .collection(COL_LISTADOS)
    .where("loteId", "==", loteId)
    .orderBy("creadoEn", "desc")
    .get();
  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as EscalafonListado,
  );
}

export async function actualizarLote(
  loteId: string,
  data: { nombre?: string; estado?: "CERRADO" },
): Promise<void> {
  await adminDb
    .collection(COL_LOTES)
    .doc(loteId)
    .update({
      ...data,
      actualizadoEn: Timestamp.now(),
    });
}

export async function incrementarTotalListados(loteId: string): Promise<void> {
  await adminDb
    .collection(COL_LOTES)
    .doc(loteId)
    .update({
      totalListados: FieldValue.increment(1),
      actualizadoEn: Timestamp.now(),
    });
}

export async function decrementarTotalListados(loteId: string): Promise<void> {
  await adminDb
    .collection(COL_LOTES)
    .doc(loteId)
    .update({
      totalListados: FieldValue.increment(-1),
      actualizadoEn: Timestamp.now(),
    });
}
```

- [ ] **Step 4: Correr test — debe pasar**

```bash
npm test src/lib/firebase/__tests__/escalafon-lotes.test.ts
```

Expected: 6 tests passing.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/firebase/escalafon-lotes.ts src/lib/firebase/__tests__/escalafon-lotes.test.ts
git commit -m "feat(escalafon): capa de datos Firestore para lotes"
```

---

### Task 3: Índices Firestore

**Files:**

- Modify: `firestore.indexes.json`

- [ ] **Step 1: Agregar los 2 índices nuevos**

En `firestore.indexes.json`, agregar en el array `indexes` antes del cierre `]`:

```json
{
  "collectionGroup": "escalafon_lotes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "estado", "order": "ASCENDING" },
    { "fieldPath": "creadoEn", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "escalafon_listados",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "loteId", "order": "ASCENDING" },
    { "fieldPath": "creadoEn", "order": "DESCENDING" }
  ]
}
```

- [ ] **Step 2: Verificar JSON válido**

```bash
node -e "require('./firestore.indexes.json'); console.log('OK')"
```

Expected: OK

- [ ] **Step 3: Commit**

```bash
git add firestore.indexes.json
git commit -m "feat(escalafon): índices Firestore para escalafon_lotes y loteId"
```

---

### Task 4: API — GET/POST /api/escalafon/lotes

**Files:**

- Create: `src/app/api/escalafon/lotes/route.ts`

- [ ] **Step 1: Crear el route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import {
  listarLotes,
  crearLote,
  obtenerLoteAbierto,
  generarNombreLote,
} from "@/lib/firebase/escalafon-lotes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let ctx: { uid: string; email: string | null } | null = null;
  try {
    ctx = await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "escalafon-lotes-get",
      limit: 30,
      windowMs: 60_000,
    });
    void ctx;
    const lotes = await listarLotes();
    return NextResponse.json({ lotes });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[escalafon/lotes GET]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let ctx: { uid: string; email: string | null } | null = null;
  try {
    ctx = await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "escalafon-lotes-post",
      limit: 10,
      windowMs: 60_000,
    });

    // Verificar que no hay lote abierto
    const abierto = await obtenerLoteAbierto();
    if (abierto) {
      return NextResponse.json(
        { error: `Ya existe un lote abierto: "${abierto.nombre}"` },
        { status: 409 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { nombre?: string };
    const nombre = body.nombre?.trim() || generarNombreLote();

    const loteId = await crearLote(nombre, ctx!.uid);
    const lote = await import("@/lib/firebase/escalafon-lotes").then((m) =>
      m.obtenerLote(loteId),
    );

    return NextResponse.json({ loteId, lote }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[escalafon/lotes POST]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/escalafon/lotes/route.ts
git commit -m "feat(escalafon): API GET/POST /api/escalafon/lotes"
```

---

### Task 5: API — GET/PATCH /api/escalafon/lotes/[loteId]

**Files:**

- Create: `src/app/api/escalafon/lotes/[loteId]/route.ts`

- [ ] **Step 1: Crear el route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import {
  obtenerLote,
  listarListadosDelLote,
  actualizarLote,
} from "@/lib/firebase/escalafon-lotes";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { loteId: string } },
) {
  try {
    await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "escalafon-lote-get",
      limit: 30,
      windowMs: 60_000,
    });

    const lote = await obtenerLote(params.loteId);
    if (!lote) {
      return NextResponse.json(
        { error: "Lote no encontrado" },
        { status: 404 },
      );
    }

    const listados = await listarListadosDelLote(params.loteId);
    return NextResponse.json({ lote, listados });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[escalafon/lotes/[loteId] GET]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { loteId: string } },
) {
  try {
    await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "escalafon-lote-patch",
      limit: 10,
      windowMs: 60_000,
    });

    const lote = await obtenerLote(params.loteId);
    if (!lote) {
      return NextResponse.json(
        { error: "Lote no encontrado" },
        { status: 404 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      nombre?: string;
      estado?: "CERRADO";
    };

    // No se puede reabrir un lote cerrado
    if (lote.estado === "CERRADO" && body.estado) {
      return NextResponse.json(
        { error: "No se puede modificar el estado de un lote cerrado" },
        { status: 400 },
      );
    }

    const update: { nombre?: string; estado?: "CERRADO" } = {};
    if (body.nombre?.trim()) update.nombre = body.nombre.trim();
    if (body.estado === "CERRADO") update.estado = "CERRADO";

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    await actualizarLote(params.loteId, update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[escalafon/lotes/[loteId] PATCH]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/escalafon/lotes/[loteId]/route.ts
git commit -m "feat(escalafon): API GET/PATCH /api/escalafon/lotes/[loteId]"
```

---

### Task 6: Modificar /api/escalafon/procesar para lotes

**Files:**

- Modify: `src/app/api/escalafon/procesar/route.ts`

La lógica nueva:

1. Leer `loteId` y `reemplazarId` del FormData.
2. Si `reemplazarId`: obtener su lote, eliminar listado + aspirantes, decrementar totalListados. Saltar verificación de duplicados.
3. Si no `reemplazarId`: verificar duplicado como hoy.
4. Determinar `loteId` activo: parámetro > lote abierto > crear nuevo.
5. Guardar listado con `loteId`.
6. Incrementar `totalListados`.

- [ ] **Step 1: Reemplazar el contenido de `route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { validateFileMagicBytes } from "@/lib/security/file-validation";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { parsearListadoCondicionalidad } from "@/lib/pdf/parsers/escalafon-condicionalidad";
import {
  listadoExiste,
  guardarListado,
  eliminarListado,
  obtenerListado,
} from "@/lib/firebase/escalafon";
import {
  obtenerLoteAbierto,
  crearLote,
  generarNombreLote,
  incrementarTotalListados,
  decrementarTotalListados,
} from "@/lib/firebase/escalafon-lotes";
import { calcularPosicionesPorZona } from "@/lib/escalafon/position-engine";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const MAX_SIZE = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let ctx: { uid: string; email: string | null } | null = null;

  try {
    ctx = await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "escalafon-procesar",
      limit: 10,
      windowMs: 60_000,
    });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const reemplazarId =
      (formData.get("reemplazarId") as string | null) || null;
    const loteIdParam = (formData.get("loteId") as string | null) || null;

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió archivo" },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Archivo demasiado grande (máx. 25 MB)" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateFileMagicBytes(buffer, "pdf")) {
      return NextResponse.json(
        { error: "Archivo no es un PDF válido" },
        { status: 400 },
      );
    }

    const tmpPath = join(tmpdir(), `escalafon-${randomUUID()}.pdf`);
    await writeFile(tmpPath, buffer);

    let parseResult: Awaited<ReturnType<typeof parsearListadoCondicionalidad>>;
    try {
      parseResult = await parsearListadoCondicionalidad(tmpPath);
    } finally {
      await unlink(tmpPath).catch(() => {});
    }

    const { listado, aspirantes, errores } = parseResult;

    if (!listado.categoriaCode || !listado.periodoDecierre) {
      return NextResponse.json(
        {
          error:
            "No se pudo extraer la metadata del PDF. Verifica que sea un listado de condicionalidad SIAP.",
          errores,
        },
        { status: 422 },
      );
    }

    // --- Determinar loteId ---
    let loteIdFinal: string;
    let loteIdDeReemplazo: string | null = null;

    if (reemplazarId) {
      // Modo reemplazo: usar el lote del listado que se reemplaza
      const listadoAnterior = await obtenerListado(reemplazarId);
      if (!listadoAnterior) {
        return NextResponse.json(
          { error: "Listado a reemplazar no encontrado" },
          { status: 404 },
        );
      }
      loteIdFinal = listadoAnterior.loteId ?? "";
      loteIdDeReemplazo = reemplazarId;

      // Eliminar listado anterior
      await eliminarListado(reemplazarId);
      if (loteIdFinal) {
        await decrementarTotalListados(loteIdFinal);
      }
    } else {
      // Verificar duplicado
      const existe = await listadoExiste(
        listado.categoriaCode,
        listado.periodoDecierre,
      );
      if (existe) {
        return NextResponse.json(
          {
            error: `Ya existe un listado para la categoría ${listado.categoriaCode} en el periodo ${listado.periodoDecierre}.`,
          },
          { status: 409 },
        );
      }

      // Resolver lote: parámetro > abierto > crear nuevo
      if (loteIdParam) {
        loteIdFinal = loteIdParam;
      } else {
        const loteAbierto = await obtenerLoteAbierto();
        if (loteAbierto?.id) {
          loteIdFinal = loteAbierto.id;
        } else {
          loteIdFinal = await crearLote(generarNombreLote(), ctx!.uid);
        }
      }
    }

    const { aspirantesConPosicion, zonas } =
      calcularPosicionesPorZona(aspirantes);

    const listadoId = await guardarListado(
      {
        ...listado,
        loteId: loteIdFinal || undefined,
        aspirantesParsed: aspirantes.length,
        subidoPor: ctx!.uid,
        creadoEn: new Date().toISOString(),
        zonas,
      },
      aspirantesConPosicion.map((a) => ({ ...a, listadoId: "" })),
    );

    if (loteIdFinal) {
      await incrementarTotalListados(loteIdFinal);
    }

    await writeAdminAuditLog({
      action: reemplazarId
        ? "ESCALAFON_LISTADO_REEMPLAZADO"
        : "ESCALAFON_LISTADO_SUBIDO",
      actorUid: ctx!.uid,
      actorEmail: ctx!.email ?? undefined,
      targetType: "escalafon_listado",
      targetId: listadoId,
      status: "SUCCESS",
      metadata: {
        categoria: listado.categoriaCode,
        periodo: listado.periodoDecierre,
        aspirantesParsed: aspirantes.length,
        loteId: loteIdFinal || null,
        reemplazarId: loteIdDeReemplazo,
      },
    });

    return NextResponse.json({
      listadoId,
      loteId: loteIdFinal || null,
      aspirantesParsed: aspirantes.length,
      errores,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[escalafon/procesar]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/escalafon/procesar/route.ts
git commit -m "feat(escalafon): soportar loteId y reemplazarId en /api/escalafon/procesar"
```

---

### Task 7: Main page — lista de lotes

**Files:**

- Rewrite: `src/app/(main)/admin/escalafon/page.tsx`

Replica byte-a-byte el estilo de `bolsa-de-trabajo/page.tsx` adaptado para lotes.

- [ ] **Step 1: Reescribir `page.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import {
  ArrowRight,
  CalendarClock,
  FolderOpen,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { EscalafonLote } from "@/types/escalafon";

function formatFecha(value?: string) {
  if (!value) return "Sin fecha";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "Sin fecha"
    : d.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

function EstadoBadge({ estado }: { estado: "ABIERTO" | "CERRADO" }) {
  return (
    <Badge
      variant={estado === "ABIERTO" ? "warning" : "success"}
      className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
    >
      {estado}
    </Badge>
  );
}

export default function EscalafonPage() {
  const [lotes, setLotes] = useState<EscalafonLote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        const currentUser = auth.currentUser;
        if (!currentUser)
          throw new Error("No se pudo validar la sesión del administrador.");

        const idToken = await currentUser.getIdToken();
        const res = await fetch("/api/escalafon/lotes", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        const data = (await res.json()) as {
          lotes?: EscalafonLote[];
          error?: string;
        };

        if (!res.ok) throw new Error(data.error ?? "Error al cargar lotes");
        setLotes(data.lotes ?? []);
      } catch (error) {
        console.error(error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los lotes escalafonarios.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [toast]);

  const loteAbierto = useMemo(
    () => lotes.find((l) => l.estado === "ABIERTO") ?? null,
    [lotes],
  );

  const lotesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lotes;
    return lotes.filter(
      (l) =>
        l.nombre.toLowerCase().includes(q) ||
        l.estado.toLowerCase().includes(q),
    );
  }, [busqueda, lotes]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 dark:bg-[#020617] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 border border-slate-900 p-8 sm:p-12 mb-8 isolate shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-60" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary border border-primary/20 backdrop-blur-md">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Control de Lotes Escalafonarios
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:leading-[1.1]">
                Escalafón de{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-rose-500">
                  Condicionalidad
                </span>
              </h1>
              <p className="max-w-xl text-sm font-medium text-slate-400 sm:text-base leading-relaxed">
                Plataforma de gestión de listados escalafonarios. Agrupa y
                consulta los PDFs del SIAP por periodo de carga.
              </p>
            </div>

            <Button
              size="lg"
              onClick={() => router.push("/admin/escalafon/cargar")}
              className="h-14 rounded-2xl px-8 text-sm font-black sm:text-base bg-primary hover:bg-primary/90 text-white shadow-[0_0_40px_-10px_rgba(225,29,72,0.4)] transition-all"
            >
              <Plus className="mr-2 h-5 w-5" />
              Cargar
            </Button>
          </div>
        </header>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 mb-8">
          <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 flex items-center gap-6 shadow-sm hover:shadow-md transition-all">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <CalendarClock className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Lotes Registrados
              </p>
              <p className="text-4xl font-black text-slate-900 dark:text-white">
                {lotes.length}
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 flex items-center gap-6 shadow-sm hover:shadow-md transition-all">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <FolderOpen className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Lote Activo
              </p>
              <p className="text-xl font-black text-slate-900 dark:text-white truncate max-w-[16rem]">
                {loteAbierto?.nombre ?? "Ninguno"}
              </p>
            </div>
          </div>
        </section>

        {/* Search */}
        <div className="group rounded-[2rem] border border-slate-200/50 bg-white/40 p-1.5 shadow-sm backdrop-blur-xl transition-all hover:border-primary/20 hover:shadow-md dark:border-slate-800/50 dark:bg-slate-900/40">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-primary" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o estado..."
              className="h-14 rounded-2xl border-none bg-transparent pl-11 text-sm font-bold tracking-tight text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">
              Cargando lotes...
            </p>
          </div>
        ) : lotesFiltrados.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-900/50">
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
              <FolderOpen className="h-10 w-10 text-slate-300" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                No hay lotes para mostrar
              </h2>
              <p className="max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
                Sube un PDF para crear el primer lote automáticamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lotesFiltrados.map((lote) => (
              <button
                key={lote.id}
                onClick={() => router.push(`/admin/escalafon/${lote.id}`)}
                className="text-left"
              >
                <Card
                  className={cn(
                    "group h-full rounded-[2.5rem] transition-all duration-500 ease-out border-none relative overflow-hidden",
                    lote.estado === "ABIERTO"
                      ? "bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent ring-[1.5px] ring-primary/30 shadow-[0_20px_50px_-12px_rgba(225,29,72,0.15)]"
                      : "bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-primary/5 hover:ring-primary/20",
                  )}
                >
                  {lote.estado === "ABIERTO" && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-primary/20 transition-colors" />
                  )}

                  <CardContent className="flex flex-col h-full p-8 sm:p-10 space-y-8 relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p
                            className={cn(
                              "text-[10px] font-black uppercase tracking-[0.2em]",
                              lote.estado === "ABIERTO"
                                ? "text-primary"
                                : "text-slate-400",
                            )}
                          >
                            Lote {lote.estado === "ABIERTO" && "• Activo"}
                          </p>
                          {lote.estado === "ABIERTO" && (
                            <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                          {lote.nombre}
                        </h2>
                      </div>
                      <EstadoBadge estado={lote.estado} />
                    </div>

                    <div
                      className={cn(
                        "rounded-[2rem] p-6 flex flex-col gap-1 transition-all duration-300",
                        lote.estado === "ABIERTO"
                          ? "bg-white/50 dark:bg-slate-950/40 shadow-inner-white border border-primary/10"
                          : "bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100/50 dark:border-slate-800/50 group-hover:bg-white/80 group-hover:border-primary/10",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-[0.2em]",
                            lote.estado === "ABIERTO"
                              ? "text-primary/70"
                              : "text-slate-500",
                          )}
                        >
                          Listados Subidos
                        </span>
                        <span
                          className={cn(
                            "text-3xl font-black tracking-tighter",
                            lote.estado === "ABIERTO"
                              ? "text-primary"
                              : "text-slate-900 dark:text-white",
                          )}
                        >
                          {lote.totalListados}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-[12px] font-medium leading-relaxed mt-4 opacity-70",
                          lote.estado === "ABIERTO"
                            ? "text-primary/80"
                            : "text-slate-600 dark:text-slate-400",
                        )}
                      >
                        {lote.estado === "ABIERTO"
                          ? "Abierto — acepta nuevos uploads."
                          : "Cerrado."}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-4 pt-6">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Actualizado
                        </p>
                        <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">
                          {formatFecha(lote.actualizadoEn)}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "inline-flex shrink-0 w-12 h-12 items-center justify-center rounded-2xl transition-all duration-300 transform group-hover:-rotate-12",
                          lote.estado === "ABIERTO"
                            ? "bg-primary text-white shadow-[0_10px_20px_-5px_rgba(225,29,72,0.4)]"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-primary group-hover:text-white group-hover:shadow-lg",
                        )}
                      >
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/admin/escalafon/page.tsx
git commit -m "feat(escalafon): página principal de lotes estilo bolsa-de-trabajo"
```

---

### Task 8: Detalle de lote

**Files:**

- Create: `src/app/(main)/admin/escalafon/[loteId]/page.tsx`

Replica `quincenas/[syncId]/page.tsx` adaptado: grid de cards de listados (ya procesados = siempre LISTO).

- [ ] **Step 1: Crear el directorio y el archivo**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderOpen,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { EscalafonLote, EscalafonListado } from "@/types/escalafon";

function formatFecha(value?: string) {
  if (!value) return "Sin fecha";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "Sin fecha"
    : d.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

export default function DetalleLotePage() {
  const params = useParams<{ loteId: string }>();
  const loteId = String(params.loteId || "");
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [lote, setLote] = useState<EscalafonLote | null>(null);
  const [listados, setListados] = useState<EscalafonListado[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser)
        throw new Error("No se pudo validar la sesión del administrador.");

      const idToken = await currentUser.getIdToken();
      const res = await fetch(`/api/escalafon/lotes/${loteId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      const data = (await res.json()) as {
        lote?: EscalafonLote;
        listados?: EscalafonListado[];
        error?: string;
      };

      if (res.status === 404 || !data.lote) {
        toast({
          title: "No encontrado",
          description: "El lote solicitado no existe.",
          variant: "destructive",
        });
        router.push("/admin/escalafon");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Error al cargar el lote");

      setLote(data.lote);
      setListados(data.listados ?? []);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "No se pudo cargar el detalle del lote.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [loteId, router, toast]);

  useEffect(() => {
    if (loteId) cargarDatos();
  }, [loteId, cargarDatos]);

  const cerrarLote = async () => {
    setCerrando(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/escalafon/lotes/${loteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ estado: "CERRADO" }),
      });
      if (!res.ok) throw new Error("Error al cerrar el lote");
      await cargarDatos();
      toast({
        title: "Lote cerrado",
        description: "Ya no acepta nuevos uploads.",
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cerrar el lote.",
        variant: "destructive",
      });
    } finally {
      setCerrando(false);
    }
  };

  const listadosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return listados;
    return listados.filter(
      (l) =>
        l.categoriaDesc.toLowerCase().includes(q) ||
        l.areaDesc.toLowerCase().includes(q) ||
        l.sector.toLowerCase().includes(q),
    );
  }, [busqueda, listados]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#020617]">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">
          Cargando lote...
        </p>
      </div>
    );
  }

  if (!lote) return null;

  return (
    <div className="min-h-full bg-[#F8FAFC] dark:bg-[#020617] flex flex-col p-4 sm:p-6 lg:p-8 gap-6">
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-6">
        {/* Header compacto */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/admin/escalafon")}
              className="h-10 w-10 rounded-xl text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-0.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
                {lote.nombre}
              </h1>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-primary/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Listado Escalafonario
                </div>
                <Badge
                  variant={lote.estado === "ABIERTO" ? "warning" : "success"}
                  className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                >
                  {lote.estado}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto sm:ml-0">
            <div className="hidden lg:flex items-center gap-6 px-4 py-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 mr-2">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Listados
                </p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5">
                  {lote.totalListados}
                </p>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Actualizado
                </p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5">
                  {formatFecha(lote.actualizadoEn)}
                </p>
              </div>
            </div>
            {lote.estado === "ABIERTO" && (
              <Button
                variant="outline"
                size="lg"
                onClick={cerrarLote}
                disabled={cerrando}
                className="h-12 rounded-2xl px-5 font-black border-slate-300 text-slate-700 hover:bg-slate-100 transition-all"
              >
                {cerrando ? "Cerrando..." : "Cerrar lote"}
              </Button>
            )}
            <Button
              size="lg"
              onClick={() =>
                router.push(`/admin/escalafon/cargar?loteId=${loteId}`)
              }
              className="h-12 rounded-2xl px-6 font-black bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:shadow-[0_0_20px_-5px_rgba(225,29,72,0.4)] transition-all"
            >
              <Plus className="mr-2 h-5 w-5" />
              Cargar
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="group rounded-[2rem] border border-slate-200/50 bg-white/40 p-1.5 shadow-sm backdrop-blur-xl transition-all hover:border-primary/20 hover:shadow-md dark:border-slate-800/50 dark:bg-slate-900/40">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-primary" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por categoría, área o sector..."
              className="h-14 rounded-2xl border-none bg-transparent pl-11 text-sm font-bold tracking-tight text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Grid de listados */}
        <section className="flex flex-col justify-start lg:flex-1 lg:min-h-0 lg:justify-center">
          {listadosFiltrados.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-900/50">
              <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
                <FolderOpen className="h-10 w-10 text-slate-300" />
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {listados.length === 0
                    ? "No hay listados en este lote"
                    : "Sin resultados para la búsqueda"}
                </h2>
                <p className="max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
                  {listados.length === 0 && lote.estado === "ABIERTO"
                    ? "Sube el primer PDF para comenzar."
                    : ""}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {listadosFiltrados.map((listado) => (
                <Card
                  key={listado.id}
                  onClick={() =>
                    router.push(`/admin/escalafon/${loteId}/${listado.id}`)
                  }
                  className="group rounded-[2rem] transition-all duration-500 ease-out border-none relative overflow-hidden cursor-pointer flex flex-col shadow-sm bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 hover:shadow-2xl hover:ring-primary/20"
                >
                  <CardContent className="p-6 flex flex-col space-y-4">
                    <div className="flex items-start justify-between min-h-[4.5rem]">
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-[1.1] line-clamp-3">
                        {listado.categoriaDesc}
                      </h3>
                      <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 animate-in fade-in zoom-in duration-500">
                        <Check className="h-4 w-4 stroke-[3px]" />
                      </div>
                    </div>

                    <div className="space-y-4 mt-auto">
                      <div className="flex items-end justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            Registros
                          </span>
                          <span className="text-2xl font-black text-primary tracking-tighter mt-1">
                            {listado.aspirantesParsed.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            Estatus
                          </span>
                          <div className="mt-1">
                            <Badge
                              variant="success"
                              className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                            >
                              Listo
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 line-clamp-1 italic px-1">
                        {listado.areaDesc}
                      </p>
                    </div>

                    <div className="pt-2 mt-auto flex flex-col gap-2">
                      <div className="w-full h-12 flex items-center justify-between px-6 rounded-2xl transition-all duration-300 bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white group-hover:shadow-[0_10px_20px_-5px_rgba(225,29,72,0.3)]">
                        <span className="text-xs font-black uppercase tracking-[0.2em]">
                          Ver
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                      {lote.estado === "ABIERTO" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/admin/escalafon/cargar?reemplazar=${listado.id}`,
                            );
                          }}
                          className="w-full h-10 flex items-center justify-center px-6 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                        >
                          Reemplazar
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/admin/escalafon/[loteId]/page.tsx
git commit -m "feat(escalafon): página de detalle de lote estilo bolsa-de-trabajo"
```

---

### Task 9: Detalle de listado (mover a [loteId]/[listadoId])

**Files:**

- Create: `src/app/(main)/admin/escalafon/[loteId]/[listadoId]/page.tsx`
- Delete: `src/app/(main)/admin/escalafon/[listadoId]/page.tsx`

La tabla de aspirantes es idéntica al archivo actual. Solo cambia: back button navega a `/admin/escalafon/${loteId}` y se agrega botón "Reemplazar" en el header.

- [ ] **Step 1: Crear `[loteId]/[listadoId]/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import { auth } from "@/lib/firebase/firebase-client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EscalafonListado, EscalafonAspirante } from "@/types/escalafon";

export default function DetalleListadoPage() {
  const params = useParams<{ loteId: string; listadoId: string }>();
  const loteId = String(params.loteId || "");
  const listadoId = String(params.listadoId || "");
  const router = useRouter();

  const [listado, setListado] = useState<EscalafonListado | null>(null);
  const [aspirantes, setAspirantes] = useState<EscalafonAspirante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [zonaActiva, setZonaActiva] = useState<string>("");

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    currentUser.getIdToken().then((idToken) =>
      fetch(`/api/escalafon/${listadoId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      })
        .then(async (res) => {
          const text = await res.text();
          let data: {
            error?: string;
            listado?: EscalafonListado;
            aspirantes?: EscalafonAspirante[];
          };
          try {
            data = JSON.parse(text);
          } catch {
            console.error("[detalle] respuesta no-JSON:", text);
            throw new Error(`Error del servidor (${res.status})`);
          }
          if (data.error) throw new Error(data.error);
          if (data.listado) setListado(data.listado);
          if (data.aspirantes) setAspirantes(data.aspirantes);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    );
  }, [listadoId]);

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!listado) return null;

  const aspirantesFiltrados = zonaActiva
    ? aspirantes
        .filter((a) => a.posicionesPorZona?.[zonaActiva] !== undefined)
        .sort(
          (a, b) =>
            (a.posicionesPorZona?.[zonaActiva] ?? 9999) -
            (b.posicionesPorZona?.[zonaActiva] ?? 9999),
        )
    : [...aspirantes].sort((a, b) => a.lugar - b.lugar);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push(`/admin/escalafon/${loteId}`)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Escalafón / {loteId}
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {listado.categoriaDesc}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
            <span>
              Área: <strong>{listado.areaDesc}</strong>
            </span>
            <span>
              Sector: <strong>{listado.sector}</strong>
            </span>
            <span>
              Listado: <strong>{listado.numeroListado}</strong>
            </span>
            <span>
              Conv: <strong>{listado.convocatoria}</strong>
            </span>
            <span>
              Vigencia:{" "}
              <strong>
                {listado.vigenciaInicio} — {listado.vigenciaFin}
              </strong>
            </span>
            <span>
              Aspirantes: <strong>{listado.aspirantesParsed}</strong>
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/admin/escalafon/cargar?reemplazar=${listadoId}`)
          }
        >
          Reemplazar
        </Button>
      </div>

      {/* Filtro de zona */}
      {listado.zonas?.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            Filtrar por zona:
          </label>
          <select
            value={zonaActiva}
            onChange={(e) => {
              setZonaActiva(e.target.value);
              setExpandido(null);
            }}
            className="text-sm border rounded-md px-3 py-1.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas ({aspirantes.length})</option>
            {listado.zonas.map((z) => {
              const count = aspirantes.filter(
                (a) => a.posicionesPorZona?.[z] !== undefined,
              ).length;
              return (
                <option key={z} value={z}>
                  {z} ({count})
                </option>
              );
            })}
          </select>
          {zonaActiva && (
            <span className="text-xs text-gray-400">
              {aspirantesFiltrados.length} aspirantes califican
            </span>
          )}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left w-12">
                {zonaActiva ? "Pos." : "Lugar"}
              </th>
              <th className="px-3 py-2 text-left w-16">Est.</th>
              <th className="px-3 py-2 text-left w-28">Matrícula</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left w-24">Fecha Reg.</th>
              <th className="px-3 py-2 text-left w-28">Preferencias</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {aspirantesFiltrados.map((a) => (
              <React.Fragment key={a.matricula}>
                <tr
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    setExpandido(expandido === a.matricula ? null : a.matricula)
                  }
                >
                  <td className="px-3 py-2 font-mono font-semibold">
                    {zonaActiva
                      ? (a.posicionesPorZona?.[zonaActiva] ?? "—")
                      : a.lugar}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                        a.estatus === "PEI"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {a.estatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-600">
                    {a.matricula}
                  </td>
                  <td className="px-3 py-2 font-medium">{a.nombre}</td>
                  <td className="px-3 py-2 text-gray-500">{a.fechaRegistro}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">
                    {a.preferencias.length === 1 &&
                    a.preferencias[0].zonaSolicitada
                      .replace(/\s/g, "")
                      .toUpperCase() === "INCONDICIONAL"
                      ? "Incondicional"
                      : `${a.preferencias.length} pref.`}
                  </td>
                </tr>
                {expandido === a.matricula && (
                  <tr className="bg-blue-50">
                    <td colSpan={6} className="px-6 py-3">
                      <div className="space-y-1">
                        {a.preferencias.map((p, i) => (
                          <div
                            key={i}
                            className="text-xs text-gray-600 flex gap-4"
                          >
                            <span>{p.zonaSolicitada}</span>
                            <span>{p.localidadSolicitada}</span>
                            <span>{p.adscripcionDesc}</span>
                            <span>{p.turnoDesc}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Eliminar el archivo viejo**

```bash
rm src/app/\(main\)/admin/escalafon/\[listadoId\]/page.tsx
rmdir src/app/\(main\)/admin/escalafon/\[listadoId\]
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/admin/escalafon/\[loteId\]/\[listadoId\]/page.tsx
git rm src/app/\(main\)/admin/escalafon/\[listadoId\]/page.tsx
git commit -m "feat(escalafon): mover detalle de listado a [loteId]/[listadoId], agregar botón Reemplazar"
```

---

### Task 10: Cargar page — banner de lote + modo reemplazar

**Files:**

- Rewrite: `src/app/(main)/admin/escalafon/cargar/page.tsx`

Replica `bolsa-de-trabajo/cargar/page.tsx` en estructura y estilo. Detecta `?loteId` y `?reemplazar`.

- [ ] **Step 1: Reescribir el archivo**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import { ArrowLeft, FileUp, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EscalafonLote, EscalafonListado } from "@/types/escalafon";

export default function CargarEscalafonPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reemplazarId = searchParams.get("reemplazar");
  const loteIdParam = searchParams.get("loteId");

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advertencias, setAdvertencias] = useState<string[]>([]);

  const [loteAbierto, setLoteAbierto] = useState<EscalafonLote | null>(null);
  const [listadoAReemplazar, setListadoAReemplazar] =
    useState<EscalafonListado | null>(null);
  const [cargandoMeta, setCargandoMeta] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      setCargandoMeta(true);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const headers = idToken ? { Authorization: `Bearer ${idToken}` } : {};

        if (reemplazarId) {
          // Obtener info del listado a reemplazar
          const res = await fetch(`/api/escalafon/${reemplazarId}`, {
            headers,
          });
          const data = (await res.json()) as { listado?: EscalafonListado };
          setListadoAReemplazar(data.listado ?? null);
        } else {
          // Obtener lote abierto actual
          const res = await fetch("/api/escalafon/lotes", {
            headers,
            cache: "no-store",
          });
          const data = (await res.json()) as { lotes?: EscalafonLote[] };
          const abierto =
            data.lotes?.find((l) => l.estado === "ABIERTO") ?? null;
          setLoteAbierto(abierto);
        }
      } catch {
        // No crítico — el API de procesar maneja la lógica
      } finally {
        setCargandoMeta(false);
      }
    };
    cargar();
  }, [reemplazarId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setAdvertencias([]);

    const formData = new FormData();
    formData.append("file", file);
    if (reemplazarId) formData.append("reemplazarId", reemplazarId);
    if (loteIdParam) formData.append("loteId", loteIdParam);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/escalafon/procesar", {
        method: "POST",
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        body: formData,
      });
      const text = await res.text();
      let data: {
        error?: string;
        errores?: string[];
        listadoId?: string;
        loteId?: string;
      };
      try {
        data = JSON.parse(text);
      } catch {
        console.error("[cargar] respuesta no-JSON:", text);
        setError(`Error del servidor (${res.status}): respuesta inesperada`);
        return;
      }

      if (!res.ok) {
        setError((data.error as string) ?? "Error al procesar el archivo");
        return;
      }

      if (data.errores?.length) {
        setAdvertencias(data.errores);
      }

      // Redirigir al lote si hay loteId, si no a la lista
      if (data.loteId) {
        router.push(`/admin/escalafon/${data.loteId}`);
      } else {
        router.push("/admin/escalafon");
      }
    } catch {
      setError("Error de red al subir el archivo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-1 text-slate-500 hover:text-primary px-0 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>

          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileUp className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                Cargar Listado
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Carga el PDF del listado escalafonario de condicionalidad.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Banner de modo */}
          {!cargandoMeta && (
            <>
              {reemplazarId ? (
                <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4 flex items-center gap-3">
                  <FolderOpen className="text-orange-600 shrink-0" />
                  <div>
                    <p className="font-black text-orange-900">
                      Reemplazando:{" "}
                      {listadoAReemplazar?.categoriaDesc ?? reemplazarId}
                    </p>
                    <p className="text-xs text-orange-700">
                      El listado anterior será eliminado al confirmar.
                    </p>
                  </div>
                </div>
              ) : loteAbierto ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
                  <FolderOpen className="text-amber-600 shrink-0" />
                  <div>
                    <p className="font-black text-amber-900">
                      Subiendo al lote: {loteAbierto.nombre}
                    </p>
                    <p className="text-xs text-amber-700">
                      Este listado se añadirá al lote activo.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <p className="font-black text-slate-700">
                    Se creará un lote nuevo automáticamente.
                  </p>
                </div>
              )}
            </>
          )}

          {/* File input */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            {file ? (
              <div>
                <p className="font-medium text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500">
                  Haz clic para seleccionar un PDF
                </p>
                <p className="text-xs text-gray-400 mt-1">Máx. 25 MB</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {advertencias.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800 space-y-1">
              {advertencias.map((a, i) => (
                <p key={i}>{a}</p>
              ))}
            </div>
          )}

          <Button
            type="submit"
            disabled={!file || loading}
            className="w-full h-12 rounded-2xl font-black text-base bg-primary hover:bg-primary/90 text-white"
          >
            {loading ? "Procesando..." : "Procesar PDF"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/admin/escalafon/cargar/page.tsx
git commit -m "feat(escalafon): página de carga con banner de lote activo y modo reemplazar"
```

---

### Task 11: Script de migración

**Files:**

- Create: `scripts/migrations/escalafon-lotes-migration.ts`

Script Node.js con Firebase Admin SDK. Crea un lote "Importaciones previas" (CERRADO) y asigna todos los listados sin `loteId` a ese lote.

- [ ] **Step 1: Crear el script**

```typescript
/**
 * Migración: asignar loteId a escalafon_listados existentes sin loteId.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
 *   npx ts-node --project tsconfig.scripts.json scripts/migrations/escalafon-lotes-migration.ts
 *
 * Correr UNA SOLA VEZ en producción.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const serviceAccount = require(
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    `${process.env.HOME}/.config/firebase/sntss-service-account.json`,
);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function run() {
  console.log("Iniciando migración de lotes escalafonarios...");

  // 1. Crear lote "Importaciones previas" en estado CERRADO
  const loteRef = db.collection("escalafon_lotes").doc();
  const now = Timestamp.now();
  await loteRef.set({
    nombre: "Importaciones previas",
    estado: "CERRADO",
    totalListados: 0,
    subidoPor: "migration-script",
    creadoEn: now,
    actualizadoEn: now,
  });
  const loteId = loteRef.id;
  console.log(`Lote creado: ${loteId}`);

  // 2. Buscar listados sin loteId
  const snap = await db.collection("escalafon_listados").get();
  const sinLote = snap.docs.filter((doc) => !doc.data().loteId);
  console.log(`Listados sin loteId: ${sinLote.length}`);

  if (sinLote.length === 0) {
    console.log("Nada que migrar. Eliminando lote creado...");
    await loteRef.delete();
    return;
  }

  // 3. Actualizar en batches de 500
  const BATCH_SIZE = 500;
  let count = 0;
  for (let i = 0; i < sinLote.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = sinLote.slice(i, i + BATCH_SIZE);
    chunk.forEach((doc) => {
      batch.update(doc.ref, { loteId });
    });
    await batch.commit();
    count += chunk.length;
    console.log(`  Migrados: ${count}/${sinLote.length}`);
  }

  // 4. Actualizar totalListados en el lote
  await loteRef.update({
    totalListados: FieldValue.increment(sinLote.length),
    actualizadoEn: Timestamp.now(),
  });

  console.log(
    `Migración completa. ${sinLote.length} listados asignados al lote "${loteId}".`,
  );
}

run().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck
```

Expected: sin errores (el script no afecta el build de Next.js).

- [ ] **Step 3: Commit**

```bash
git add scripts/migrations/escalafon-lotes-migration.ts
git commit -m "feat(escalafon): script de migración para asignar loteId a listados existentes"
```

---

## Self-Review

### Cobertura del spec

| Requisito                                                                                                                              | Tarea   |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `EscalafonLote` type + `loteId?` en listado                                                                                            | Task 1  |
| `generarNombreLote` Q1/Q2                                                                                                              | Task 2  |
| `crearLote`, `obtenerLoteAbierto`, `listarLotes`, `obtenerLote`, `listarListadosDelLote`, `actualizarLote`, `incrementarTotalListados` | Task 2  |
| Índices Firestore                                                                                                                      | Task 3  |
| GET/POST `/api/escalafon/lotes`                                                                                                        | Task 4  |
| GET/PATCH `/api/escalafon/lotes/[loteId]`                                                                                              | Task 5  |
| `procesar` acepta `loteId` + `reemplazarId`                                                                                            | Task 6  |
| Main page lotes (estilo bolsa)                                                                                                         | Task 7  |
| Detalle lote (estilo quincena) + botones Reemplazar por card                                                                           | Task 8  |
| Detalle listado en `[loteId]/[listadoId]`                                                                                              | Task 9  |
| `[listadoId]/page.tsx` eliminado                                                                                                       | Task 9  |
| Cargar con banner lote activo / modo reemplazar                                                                                        | Task 10 |
| Script migración                                                                                                                       | Task 11 |

### Consistencia de tipos

- `EscalafonLote.id?: string` — usado correctamente en todas las tareas.
- `guardarListado` recibe `Omit<EscalafonListado, "id">` — el campo `loteId` está en `EscalafonListado` así que se pasa correctamente en Task 6.
- `decrementarTotalListados` exportada de `escalafon-lotes.ts` e importada en `procesar/route.ts` — consistente.
- `obtenerListado` importada de `escalafon.ts` (ya existe) — consistente.

### Sin placeholders

Revisado — todo el código es completo y ejecutable.
