# Escalafón MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a la encargada de escalafón subir PDFs del listado de condicionalidad (SIAP), parsearlos automáticamente y ver el listado de aspirantes ordenado por prelación.

**Architecture:** Parser vía pdfplumber (Python bridge ya existente) → Firestore (`escalafon_listados` + `escalafon_aspirantes`) → API Routes → UI espejo de bolsa de trabajo. TODO es nuevo — cero modificaciones a código de bolsa.

**Tech Stack:** Next.js 14 App Router, Firebase Admin SDK, Firestore, pdfplumber (Python bridge), TypeScript, Tailwind, Radix UI, Zod, Vitest.

**⚠️ RESTRICCIÓN CRÍTICA:** NO tocar ningún archivo de `bolsa-de-trabajo`. Solo modificaciones aditivas en `roles.ts` y `Sidebar.tsx`.

---

## Mapa de archivos

| Archivo                                                           | Acción              | Responsabilidad                                    |
| ----------------------------------------------------------------- | ------------------- | -------------------------------------------------- |
| `src/types/roles.ts`                                              | Modificar (aditivo) | Agregar rol ESCALAFON + 5 permisos                 |
| `src/types/escalafon.ts`                                          | Crear               | Tipos TypeScript del dominio                       |
| `src/lib/firebase/escalafon.ts`                                   | Crear               | Operaciones Firestore (CRUD listados y aspirantes) |
| `src/lib/pdf/parsers/escalafon-condicionalidad.ts`                | Crear               | Parser del PDF SIAP                                |
| `src/lib/pdf/parsers/__tests__/escalafon-condicionalidad.test.ts` | Crear               | Tests del parser                                   |
| `src/app/api/escalafon/procesar/route.ts`                         | Crear               | POST: recibe PDF, parsea, guarda                   |
| `src/app/api/escalafon/route.ts`                                  | Crear               | GET: lista todos los listados                      |
| `src/app/api/escalafon/[listadoId]/route.ts`                      | Crear               | GET: detalle de un listado                         |
| `src/app/(main)/admin/escalafon/page.tsx`                         | Crear               | Lista de listados agrupados por periodo            |
| `src/app/(main)/admin/escalafon/cargar/page.tsx`                  | Crear               | Upload + preview del PDF                           |
| `src/app/(main)/admin/escalafon/[listadoId]/page.tsx`             | Crear               | Detalle con tabla de aspirantes                    |
| `src/components/Sidebar.tsx`                                      | Modificar (aditivo) | Entrada "Escalafón" en nav                         |

---

## Task 1: Rol ESCALAFON y permisos

**Files:**

- Modify: `src/types/roles.ts`

- [ ] **Agregar rol y permisos en `src/types/roles.ts`**

Después de `BOLSA = "BOLSA",` en el enum ROLES, agregar:

```ts
ESCALAFON = "ESCALAFON",
```

Después de `EXPORTAR_BOLSA_TRABAJO = "EXPORTAR_BOLSA_TRABAJO",` en el enum PERMISOS, agregar:

```ts
// Escalafón
CARGAR_ESCALAFON = "CARGAR_ESCALAFON",
PROCESAR_ESCALAFON = "PROCESAR_ESCALAFON",
VER_ESCALAFON = "VER_ESCALAFON",
ELIMINAR_ESCALAFON = "ELIMINAR_ESCALAFON",
EXPORTAR_ESCALAFON = "EXPORTAR_ESCALAFON",
```

En `PERMISOS_POR_ROL`, en el bloque `[ROLES.ADMIN]`, agregar al final del array:

```ts
PERMISOS.CARGAR_ESCALAFON,
PERMISOS.PROCESAR_ESCALAFON,
PERMISOS.VER_ESCALAFON,
PERMISOS.ELIMINAR_ESCALAFON,
PERMISOS.EXPORTAR_ESCALAFON,
```

En `PERMISOS_POR_ROL`, en el bloque `[ROLES.REVISOR]`, agregar:

```ts
PERMISOS.VER_ESCALAFON,
PERMISOS.EXPORTAR_ESCALAFON,
```

En `PERMISOS_POR_ROL`, en el bloque `[ROLES.CONSULTA]`, agregar:

```ts
PERMISOS.VER_ESCALAFON,
```

Agregar nuevo bloque después de `[ROLES.BOLSA]`:

```ts
[ROLES.ESCALAFON]: [
  PERMISOS.CARGAR_ESCALAFON,
  PERMISOS.PROCESAR_ESCALAFON,
  PERMISOS.VER_ESCALAFON,
  PERMISOS.ELIMINAR_ESCALAFON,
  PERMISOS.EXPORTAR_ESCALAFON,
],
```

- [ ] **Verificar typecheck**

```bash
npm run typecheck
```

Expected: sin errores.

- [ ] **Commit**

```bash
git add src/types/roles.ts
git commit -m "feat(escalafon): agregar rol ESCALAFON y permisos"
```

---

## Task 2: Tipos TypeScript del dominio

**Files:**

- Create: `src/types/escalafon.ts`

- [ ] **Crear `src/types/escalafon.ts`**

```ts
export interface EscalafonPreferencia {
  delegacionSolicitada: string; // ej. "02 BAJA CALIFORNIA" o "Incondicional"
  zonaSolicitada: string; // ej. "7 TIJUANA" o "Incondicional"
  localidadSolicitada: string; // ej. "0205321 RIO TIJUANA" o "Incondicional"
  adscripcionCode: string; // ej. "02HA230000" o "Incondicional"
  adscripcionDesc: string; // ej. "HOSPITAL GENERAL REGIONAL 23" o "Incondicional"
  turnoNum: number | null; // ej. 1, 2, 3, null si Incondicional
  turnoDesc: string; // ej. "Matutino" o "Incondicional"
}

export interface EscalafonAspirante {
  id?: string;
  listadoId: string;
  lugar: number; // LUG. ESC.
  estatus: "Activo" | "PEI";
  matricula: string;
  nombre: string;
  delegacion: string; // DEL (ej. "02")
  fechaRegistro: string; // DD/MM/YYYY
  preferencias: EscalafonPreferencia[];
}

export interface EscalafonListado {
  id?: string;
  delegacion: string; // ej. "02 BAJA CALIFORNIA"
  numeroListado: string; // ej. "2026-1"
  sector: string; // ej. "01 ENFERMERIA"
  fechaEmision: string; // DD/MM/YYYY
  categoriaCode: string; // ej. "22210080"
  categoriaDesc: string; // ej. "ENFERMERA ESPECIALISTA 80"
  areaCode: string; // ej. "216"
  areaDesc: string; // ej. "QUIRURGICA"
  convocatoria: string; // ej. "E/16/2025"
  vigenciaInicio: string; // DD/MM/YYYY
  vigenciaFin: string; // DD/MM/YYYY
  periodoDecierre: string; // ej. "2026003" — usado como ID de quincena
  totalAspirantes: number; // del header del PDF
  aspirantesParsed: number; // los que se extrajeron efectivamente
  subidoPor: string; // uid del usuario
  creadoEn: string; // ISO string
}

export interface EscalafonParseResult {
  listado: Omit<
    EscalafonListado,
    "id" | "subidoPor" | "creadoEn" | "aspirantesParsed"
  >;
  aspirantes: Omit<EscalafonAspirante, "id" | "listadoId">[];
  errores: string[];
}
```

- [ ] **Commit**

```bash
git add src/types/escalafon.ts
git commit -m "feat(escalafon): tipos TypeScript del dominio"
```

---

## Task 3: Parser del PDF SIAP

**Files:**

- Create: `src/lib/pdf/parsers/escalafon-condicionalidad.ts`

El PDF SIAP tiene una tabla con estas columnas (índices 0-10):

```
0: LUG.ESC.  1: EST  2: MAT.  3: NOMBRE  4: DEL  5: FECHA REG.
6: DEL SOL.  7: ZONA SOL.  8: LOC SOL.  9: ADSC SOL.  10: TURNO SOL.
```

Un trabajador con múltiples preferencias aparece en múltiples filas con el mismo `lugar` y `matricula`. Hay que agruparlas.

- [ ] **Crear `src/lib/pdf/parsers/escalafon-condicionalidad.ts`**

```ts
import { callPythonExtractor } from "@/lib/pdf/pythonBridge";
import type {
  EscalafonParseResult,
  EscalafonAspirante,
  EscalafonPreferencia,
} from "@/types/escalafon";

// --- Helpers ---

function normalizarTexto(val: string | null | undefined): string {
  return (val ?? "").trim().toUpperCase();
}

function esFilaEncabezado(row: (string | null)[]): boolean {
  const cell0 = (row[0] ?? "").trim();
  return !cell0 || isNaN(Number(cell0));
}

function esFilaDato(row: (string | null)[]): boolean {
  const lugar = (row[0] ?? "").trim();
  const mat = (row[2] ?? "").trim();
  return /^\d+$/.test(lugar) && /^\d{7,10}$/.test(mat);
}

function parsearPreferencia(row: (string | null)[]): EscalafonPreferencia {
  const adscripcionRaw = normalizarTexto(row[9]);
  const turnoRaw = normalizarTexto(row[10]);

  // Adscripción puede ser "02HA230000 HOSPITAL GENERAL REGIONAL 23" o "INCONDICIONAL"
  let adscripcionCode = "Incondicional";
  let adscripcionDesc = "Incondicional";
  if (adscripcionRaw && adscripcionRaw !== "INCONDICIONAL") {
    const match = adscripcionRaw.match(/^(\w+)\s+(.+)$/);
    if (match) {
      adscripcionCode = match[1];
      adscripcionDesc = match[2];
    } else {
      adscripcionCode = adscripcionRaw;
      adscripcionDesc = adscripcionRaw;
    }
  }

  // Turno puede ser "1 MATUTINO", "INCONDICIONAL", etc.
  let turnoNum: number | null = null;
  let turnoDesc = "Incondicional";
  if (turnoRaw && turnoRaw !== "INCONDICIONAL") {
    const match = turnoRaw.match(/^(\d+)\s*(.*)$/);
    if (match) {
      turnoNum = Number(match[1]);
      turnoDesc = match[2] || `Turno ${match[1]}`;
    }
  }

  return {
    delegacionSolicitada: normalizarTexto(row[6]) || "Incondicional",
    zonaSolicitada: normalizarTexto(row[7]) || "Incondicional",
    localidadSolicitada: normalizarTexto(row[8]) || "Incondicional",
    adscripcionCode,
    adscripcionDesc,
    turnoNum,
    turnoDesc,
  };
}

// --- Header parser (de las líneas de texto de la página 1) ---

interface HeaderData {
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
}

function parsearHeader(lines: string[]): Partial<HeaderData> {
  const texto = lines.join(" ");
  const get = (pattern: RegExp) => (texto.match(pattern)?.[1] ?? "").trim();

  const totalMatch = texto.match(/NUMERO DE ASPIRANTES[:\s]+(\d+)/);
  const totalAspirantes = totalMatch ? Number(totalMatch[1]) : 0;

  // Categoría: código (8 dígitos) + descripción
  const catMatch = texto.match(/CATEGORIA[:\s]+(\d{8})\s+([A-Z\s]+?\d{2})/);
  const categoriaCode = catMatch?.[1] ?? "";
  const categoriaDesc = catMatch?.[2]?.trim() ?? "";

  // Area: código (3 dígitos) + descripción
  const areaMatch = texto.match(
    /AREA[:\s]+(\d{3})\s+([A-Z\s]+?)(?:\s+CONVOCATORIA|\s+PERIODO|\s*$)/,
  );
  const areaCode = areaMatch?.[1] ?? "";
  const areaDesc = areaMatch?.[2]?.trim() ?? "";

  // Fechas de vigencia: "01/02/2026 A: 31/01/2027"
  const vigMatch = texto.match(
    /VIGENCIA[:\s]+(\d{2}\/\d{2}\/\d{4})\s+A[:\s]+(\d{2}\/\d{2}\/\d{4})/,
  );

  return {
    delegacion: get(/DELEGACI[OÓ]N[:\s]+([A-Z\s]+?)(?:\s+NUMERO|\s+FECHA)/),
    numeroListado: get(/NUMERO DE LISTADO[:\s]+(\S+)/),
    sector: get(/SECTOR[:\s]+([A-Z0-9\s]+?)(?:\s+NUMERO|\s+CONVOCATORIA)/),
    fechaEmision: get(/FECHA DE EMISION[:\s]+(\d{2}\/\d{2}\/\d{4})/),
    categoriaCode,
    categoriaDesc,
    areaCode,
    areaDesc,
    convocatoria: get(/CONVOCATORIA[:\s]+(\S+)/),
    vigenciaInicio: vigMatch?.[1] ?? "",
    vigenciaFin: vigMatch?.[2] ?? "",
    periodoDecierre: get(/PERIODO DE CIERRE[:\s]+(\S+)/),
    totalAspirantes,
  };
}

// --- Función principal ---

export async function parsearListadoCondicionalidad(
  pdfPath: string,
): Promise<EscalafonParseResult> {
  const errores: string[] = [];
  // Map key: `${lugar}_${matricula}` para agrupar preferencias
  const aspirantesMap = new Map<
    string,
    Omit<EscalafonAspirante, "id" | "listadoId">
  >();
  let headerData: Partial<HeaderData> = {};

  try {
    const data = await callPythonExtractor(pdfPath);

    for (const page of data.pages) {
      // Parsear header solo en página 1
      if (page.page_number === 1 && page.lines?.length) {
        headerData = parsearHeader(page.lines);
      }

      if (!page.tables) continue;

      for (const table of page.tables) {
        if (!table) continue;

        for (const row of table) {
          if (!row || row.length < 11) continue;
          if (esFilaEncabezado(row)) continue;
          if (!esFilaDato(row)) continue;

          const lugar = Number((row[0] ?? "").trim());
          const estatus =
            normalizarTexto(row[1]) === "PEI"
              ? ("PEI" as const)
              : ("Activo" as const);
          const matricula = (row[2] ?? "").trim();
          const nombre = normalizarTexto(row[3]);
          const delegacion = (row[4] ?? "").trim();
          const fechaRegistro = (row[5] ?? "").trim();

          const key = `${lugar}_${matricula}`;
          const preferencia = parsearPreferencia(row);

          if (aspirantesMap.has(key)) {
            aspirantesMap.get(key)!.preferencias.push(preferencia);
          } else {
            aspirantesMap.set(key, {
              lugar,
              estatus,
              matricula,
              nombre,
              delegacion,
              fechaRegistro,
              preferencias: [preferencia],
            });
          }
        }
      }
    }
  } catch (error) {
    errores.push(
      `Error al procesar PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const aspirantes = Array.from(aspirantesMap.values()).sort(
    (a, b) => a.lugar - b.lugar,
  );
  const parsed = aspirantes.length;

  if (headerData.totalAspirantes && parsed !== headerData.totalAspirantes) {
    errores.push(
      `Advertencia: el PDF declara ${headerData.totalAspirantes} aspirantes pero se extrajeron ${parsed}.`,
    );
  }

  const listado = {
    delegacion: headerData.delegacion ?? "",
    numeroListado: headerData.numeroListado ?? "",
    sector: headerData.sector ?? "",
    fechaEmision: headerData.fechaEmision ?? "",
    categoriaCode: headerData.categoriaCode ?? "",
    categoriaDesc: headerData.categoriaDesc ?? "",
    areaCode: headerData.areaCode ?? "",
    areaDesc: headerData.areaDesc ?? "",
    convocatoria: headerData.convocatoria ?? "",
    vigenciaInicio: headerData.vigenciaInicio ?? "",
    vigenciaFin: headerData.vigenciaFin ?? "",
    periodoDecierre: headerData.periodoDecierre ?? "",
    totalAspirantes: headerData.totalAspirantes ?? 0,
  };

  return { listado, aspirantes, errores };
}
```

- [ ] **Commit**

```bash
git add src/lib/pdf/parsers/escalafon-condicionalidad.ts
git commit -m "feat(escalafon): parser PDF listado de condicionalidad SIAP"
```

---

## Task 4: Tests del parser

**Files:**

- Create: `src/lib/pdf/parsers/__tests__/escalafon-condicionalidad.test.ts`

Los PDFs de muestra deben copiarse a `src/assets/PDFs/escalafon/`:

- `listado-enf-quirurgica.pdf` (108 aspirantes)
- `listado-enf-pediatra.pdf` (36 aspirantes)
- `listado-farmacia.pdf` (59 aspirantes)

- [ ] **Copiar fixtures**

```bash
mkdir -p /Users/gerardoarroyo/Projects/SNTSS/src/assets/PDFs/escalafon
cp "/Users/gerardoarroyo/Downloads/listado enf, quirurgica.pdf" /Users/gerardoarroyo/Projects/SNTSS/src/assets/PDFs/escalafon/listado-enf-quirurgica.pdf
cp "/Users/gerardoarroyo/Downloads/listado enf, pediatra.pdf" /Users/gerardoarroyo/Projects/SNTSS/src/assets/PDFs/escalafon/listado-enf-pediatra.pdf
cp "/Users/gerardoarroyo/Downloads/listado farmacia.pdf" /Users/gerardoarroyo/Projects/SNTSS/src/assets/PDFs/escalafon/listado-farmacia.pdf
```

- [ ] **Crear `src/lib/pdf/parsers/__tests__/escalafon-condicionalidad.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import path from "path";
import { parsearListadoCondicionalidad } from "../escalafon-condicionalidad";

const FIXTURES = path.join(process.cwd(), "src/assets/PDFs/escalafon");

describe("parsearListadoCondicionalidad", () => {
  describe("quirúrgica (108 aspirantes)", () => {
    it("extrae el header correctamente", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-quirurgica.pdf"),
      );
      expect(result.listado.categoriaCode).toBe("22210080");
      expect(result.listado.areaDesc).toContain("QUIRURGICA");
      expect(result.listado.totalAspirantes).toBe(108);
      expect(result.listado.periodoDecierre).toBe("2026003");
      expect(result.listado.numeroListado).toBe("2026-1");
    });

    it("extrae 108 aspirantes únicos", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-quirurgica.pdf"),
      );
      expect(result.aspirantes).toHaveLength(108);
    });

    it("el primer aspirante tiene lugar 1 y estatus PEI", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-quirurgica.pdf"),
      );
      const primero = result.aspirantes[0];
      expect(primero.lugar).toBe(1);
      expect(primero.estatus).toBe("PEI");
      expect(primero.matricula).toBe("99080828");
    });

    it("agrupa preferencias múltiples del mismo aspirante", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-quirurgica.pdf"),
      );
      // RUELAS MUÑOZ CLARA ELISA (lugar 2) tiene 3 preferencias
      const ruelas = result.aspirantes.find((a) => a.lugar === 2);
      expect(ruelas).toBeDefined();
      expect(ruelas!.preferencias.length).toBeGreaterThanOrEqual(2);
    });

    it("no tiene errores críticos de parseo", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-quirurgica.pdf"),
      );
      const criticos = result.errores.filter(
        (e) => !e.startsWith("Advertencia"),
      );
      expect(criticos).toHaveLength(0);
    });
  });

  describe("pediatría (36 aspirantes)", () => {
    it("extrae 36 aspirantes únicos", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-pediatra.pdf"),
      );
      expect(result.aspirantes).toHaveLength(36);
    });

    it("el header tiene area PEDIATRIA", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-enf-pediatra.pdf"),
      );
      expect(result.listado.areaDesc).toContain("PEDIATRIA");
      expect(result.listado.totalAspirantes).toBe(36);
    });
  });

  describe("farmacia (59 aspirantes)", () => {
    it("extrae 59 aspirantes únicos", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-farmacia.pdf"),
      );
      expect(result.aspirantes).toHaveLength(59);
    });

    it("sector es FARMACIA", async () => {
      const result = await parsearListadoCondicionalidad(
        path.join(FIXTURES, "listado-farmacia.pdf"),
      );
      expect(result.listado.sector).toContain("FARMACIA");
    });
  });
});
```

- [ ] **Correr tests (esperando fallo inicial — el parser puede necesitar ajuste)**

```bash
npm test -- src/lib/pdf/parsers/__tests__/escalafon-condicionalidad.test.ts
```

Si fallan porque el parseo de la tabla no coincide exactamente con los índices de columna, ajustar `parsearPreferencia` y `esFilaDato` en `escalafon-condicionalidad.ts` hasta que pasen.

- [ ] **Commit cuando los tests pasen**

```bash
git add src/lib/pdf/parsers/__tests__/escalafon-condicionalidad.test.ts src/assets/PDFs/escalafon/
git commit -m "test(escalafon): tests del parser con fixtures reales"
```

---

## Task 5: Capa de datos Firestore

**Files:**

- Create: `src/lib/firebase/escalafon.ts`

- [ ] **Crear `src/lib/firebase/escalafon.ts`**

```ts
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import type { EscalafonListado, EscalafonAspirante } from "@/types/escalafon";

const COL_LISTADOS = "escalafon_listados";
const COL_ASPIRANTES = "escalafon_aspirantes";

// Verifica si ya existe un listado para esa categoría y periodo
export async function listadoExiste(
  categoriaCode: string,
  periodoDecierre: string,
): Promise<boolean> {
  const snap = await adminDb
    .collection(COL_LISTADOS)
    .where("categoriaCode", "==", categoriaCode)
    .where("periodoDecierre", "==", periodoDecierre)
    .limit(1)
    .get();
  return !snap.empty;
}

// Guarda un listado y sus aspirantes en batch
export async function guardarListado(
  listado: Omit<EscalafonListado, "id">,
  aspirantes: Omit<EscalafonAspirante, "id">[],
): Promise<string> {
  const listadoRef = adminDb.collection(COL_LISTADOS).doc();
  const listadoId = listadoRef.id;

  const batch = adminDb.batch();

  batch.set(listadoRef, {
    ...listado,
    creadoEn: Timestamp.now(),
  });

  for (const aspirante of aspirantes) {
    const aspiranteRef = adminDb.collection(COL_ASPIRANTES).doc();
    batch.set(aspiranteRef, { ...aspirante, listadoId });
  }

  await batch.commit();
  return listadoId;
}

// Lista todos los listados ordenados por fecha de creación
export async function listarListados(): Promise<EscalafonListado[]> {
  const snap = await adminDb
    .collection(COL_LISTADOS)
    .orderBy("creadoEn", "desc")
    .get();

  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as EscalafonListado,
  );
}

// Obtiene un listado por ID
export async function obtenerListado(
  listadoId: string,
): Promise<EscalafonListado | null> {
  const doc = await adminDb.collection(COL_LISTADOS).doc(listadoId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as EscalafonListado;
}

// Obtiene los aspirantes de un listado ordenados por lugar
export async function obtenerAspirantes(
  listadoId: string,
): Promise<EscalafonAspirante[]> {
  const snap = await adminDb
    .collection(COL_ASPIRANTES)
    .where("listadoId", "==", listadoId)
    .orderBy("lugar", "asc")
    .get();

  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as EscalafonAspirante,
  );
}

// Elimina un listado y sus aspirantes
export async function eliminarListado(listadoId: string): Promise<void> {
  const aspirantesSnap = await adminDb
    .collection(COL_ASPIRANTES)
    .where("listadoId", "==", listadoId)
    .get();

  const batch = adminDb.batch();
  aspirantesSnap.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(adminDb.collection(COL_LISTADOS).doc(listadoId));
  await batch.commit();
}
```

- [ ] **Typecheck**

```bash
npm run typecheck
```

- [ ] **Commit**

```bash
git add src/lib/firebase/escalafon.ts
git commit -m "feat(escalafon): capa de datos Firestore"
```

---

## Task 6: API Route — procesar PDF

**Files:**

- Create: `src/app/api/escalafon/procesar/route.ts`

- [ ] **Crear `src/app/api/escalafon/procesar/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { validateFileMagicBytes } from "@/lib/security/file-validation";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { parsearListadoCondicionalidad } from "@/lib/pdf/parsers/escalafon-condicionalidad";
import { listadoExiste, guardarListado } from "@/lib/firebase/escalafon";
import { PERMISOS } from "@/types/roles";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminRequest(
      req,
      PERMISOS.PROCESAR_ESCALAFON,
    );
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    await enforceRateLimit(req, "escalafon-procesar", {
      max: 10,
      windowMs: 60_000,
    });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

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

    const magicResult = validateFileMagicBytes(buffer, "pdf");
    if (!magicResult.valid) {
      return NextResponse.json(
        { error: "Archivo no es un PDF válido" },
        { status: 400 },
      );
    }

    // Guardar temporalmente para que pdfplumber pueda leerlo
    const tmpPath = join(tmpdir(), `escalafon-${randomUUID()}.pdf`);
    await writeFile(tmpPath, buffer);

    let parseResult;
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

    const listadoId = await guardarListado(
      {
        ...listado,
        aspirantesParsed: aspirantes.length,
        subidoPor: authResult.uid!,
        creadoEn: new Date().toISOString(),
      },
      aspirantes.map((a) => ({ ...a, listadoId: "" })), // listadoId se asigna en guardarListado
    );

    await writeAdminAuditLog({
      action: "ESCALAFON_LISTADO_SUBIDO",
      uid: authResult.uid!,
      details: {
        listadoId,
        categoria: listado.categoriaCode,
        periodo: listado.periodoDecierre,
      },
    });

    return NextResponse.json({
      listadoId,
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

- [ ] **Typecheck**

```bash
npm run typecheck
```

- [ ] **Commit**

```bash
git add src/app/api/escalafon/procesar/route.ts
git commit -m "feat(escalafon): API route POST /api/escalafon/procesar"
```

---

## Task 7: API Routes — listados y detalle

**Files:**

- Create: `src/app/api/escalafon/route.ts`
- Create: `src/app/api/escalafon/[listadoId]/route.ts`

- [ ] **Crear `src/app/api/escalafon/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { listarListados } from "@/lib/firebase/escalafon";
import { PERMISOS } from "@/types/roles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await requireAdminRequest(req, PERMISOS.VER_ESCALAFON);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const listados = await listarListados();
  return NextResponse.json({ listados });
}
```

- [ ] **Crear `src/app/api/escalafon/[listadoId]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { obtenerListado, obtenerAspirantes } from "@/lib/firebase/escalafon";
import { PERMISOS } from "@/types/roles";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { listadoId: string } },
) {
  const authResult = await requireAdminRequest(req, PERMISOS.VER_ESCALAFON);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const listado = await obtenerListado(params.listadoId);
  if (!listado) {
    return NextResponse.json(
      { error: "Listado no encontrado" },
      { status: 404 },
    );
  }

  const aspirantes = await obtenerAspirantes(params.listadoId);
  return NextResponse.json({ listado, aspirantes });
}
```

- [ ] **Typecheck**

```bash
npm run typecheck
```

- [ ] **Commit**

```bash
git add src/app/api/escalafon/
git commit -m "feat(escalafon): API routes GET listados y detalle"
```

---

## Task 8: UI — Página principal (lista de listados)

**Files:**

- Create: `src/app/(main)/admin/escalafon/page.tsx`

- [ ] **Crear `src/app/(main)/admin/escalafon/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { EscalafonListado } from "@/types/escalafon";

export default function EscalafonPage() {
  const router = useRouter();
  const [listados, setListados] = useState<EscalafonListado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/escalafon")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setListados(data.listados);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Agrupar por periodoDecierre
  const grupos = listados.reduce<Record<string, EscalafonListado[]>>(
    (acc, l) => {
      const key = l.periodoDecierre || "Sin periodo";
      if (!acc[key]) acc[key] = [];
      acc[key].push(l);
      return acc;
    },
    {},
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escalafón</h1>
          <p className="text-sm text-gray-500 mt-1">
            Listados escalafonarios de condicionalidad
          </p>
        </div>
        <Link
          href="/admin/escalafon/cargar"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          + Cargar listado
        </Link>
      </div>

      {loading && <p className="text-gray-500">Cargando...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && Object.keys(grupos).length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No hay listados cargados.</p>
          <p className="text-sm mt-1">
            Usa "Cargar listado" para subir el primer PDF.
          </p>
        </div>
      )}

      {Object.entries(grupos).map(([periodo, items]) => (
        <div key={periodo}>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Periodo {periodo}
          </h2>
          <div className="border rounded-lg divide-y overflow-hidden">
            {items.map((listado) => (
              <Link
                key={listado.id}
                href={`/admin/escalafon/${listado.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {listado.categoriaDesc}
                  </p>
                  <p className="text-xs text-gray-500">
                    Área: {listado.areaDesc} · {listado.sector} · Conv.{" "}
                    {listado.convocatoria}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">
                    {listado.aspirantesParsed} aspirantes
                  </p>
                  <p className="text-xs text-gray-400">
                    Listado {listado.numeroListado}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add src/app/\(main\)/admin/escalafon/page.tsx
git commit -m "feat(escalafon): página principal con lista de listados"
```

---

## Task 9: UI — Cargar PDF

**Files:**

- Create: `src/app/(main)/admin/escalafon/cargar/page.tsx`

- [ ] **Crear `src/app/(main)/admin/escalafon/cargar/page.tsx`**

```tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CargarEscalafonPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advertencias, setAdvertencias] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setAdvertencias([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/escalafon/procesar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al procesar el archivo");
        return;
      }

      if (data.errores?.length) {
        setAdvertencias(data.errores);
      }

      router.push(`/admin/escalafon/${data.listadoId}`);
    } catch {
      setError("Error de red al subir el archivo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/escalafon"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Escalafón
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          Cargar listado
        </h1>
        <p className="text-sm text-gray-500">
          Sube el PDF del listado escalafonario de condicionalidad generado por
          el SIAP.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
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
              <p className="text-gray-500">Haz clic para seleccionar un PDF</p>
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

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Procesando..." : "Procesar PDF"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add src/app/\(main\)/admin/escalafon/cargar/page.tsx
git commit -m "feat(escalafon): página cargar PDF"
```

---

## Task 10: UI — Detalle del listado

**Files:**

- Create: `src/app/(main)/admin/escalafon/[listadoId]/page.tsx`

- [ ] **Crear `src/app/(main)/admin/escalafon/[listadoId]/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { EscalafonListado, EscalafonAspirante } from "@/types/escalafon";

export default function DetalleListadoPage() {
  const { listadoId } = useParams<{ listadoId: string }>();
  const [listado, setListado] = useState<EscalafonListado | null>(null);
  const [aspirantes, setAspirantes] = useState<EscalafonAspirante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/escalafon/${listadoId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setListado(data.listado);
        setAspirantes(data.aspirantes);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [listadoId]);

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!listado) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/escalafon"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Escalafón
        </Link>
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

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left w-12">Lugar</th>
              <th className="px-3 py-2 text-left w-16">Est.</th>
              <th className="px-3 py-2 text-left w-28">Matrícula</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left w-24">Fecha Reg.</th>
              <th className="px-3 py-2 text-left w-28">Preferencias</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {aspirantes.map((a) => (
              <>
                <tr
                  key={a.matricula}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    setExpandido(expandido === a.matricula ? null : a.matricula)
                  }
                >
                  <td className="px-3 py-2 font-mono font-semibold">
                    {a.lugar}
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
                    a.preferencias[0].zonaSolicitada === "INCONDICIONAL"
                      ? "Incondicional"
                      : `${a.preferencias.length} pref.`}
                  </td>
                </tr>
                {expandido === a.matricula && (
                  <tr key={`${a.matricula}-exp`} className="bg-blue-50">
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
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add src/app/\(main\)/admin/escalafon/\[listadoId\]/page.tsx
git commit -m "feat(escalafon): página detalle de listado con tabla de aspirantes"
```

---

## Task 11: Sidebar

**Files:**

- Modify: `src/components/Sidebar.tsx` (solo aditivo)

- [ ] **Agregar entrada de Escalafón en `src/components/Sidebar.tsx`**

Buscar el bloque que agrega "Bolsa de Trabajo" para ADMIN/SUPER_ADMIN (~línea 66) e inmediatamente después, agregar:

```ts
{
  title: "Escalafón",
  href: "/admin/escalafon",
  icon: Users, // mismo icono o importar ListOrdered de lucide-react
},
```

Buscar el bloque `if (roleUpper === "BOLSA")` (~línea 106) y después del cierre de ese bloque, agregar:

```ts
if (roleUpper === "ESCALAFON") {
  baseItems.push({
    title: "Escalafón",
    href: "/admin/escalafon",
    icon: Users,
  });
}
```

- [ ] **Typecheck + lint**

```bash
npm run check
```

- [ ] **Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(escalafon): entrada de Escalafón en sidebar"
```

---

## Task 12: Validación final

- [ ] **Build completo**

```bash
npm run build
```

Expected: sin errores.

- [ ] **Flujo manual completo:**
  1. Login con rol ESCALAFON
  2. Navegar a `/admin/escalafon` — ver página vacía con botón "Cargar listado"
  3. Ir a `/admin/escalafon/cargar` — subir `listado-enf-quirurgica.pdf`
  4. Confirmar redirect a detalle — ver 108 aspirantes
  5. Verificar que lugar 2 (RUELAS MUÑOZ) tiene múltiples preferencias expandibles
  6. Intentar subir el mismo PDF — debe rechazar con error 409
  7. Verificar que ADMIN también ve el módulo en sidebar

- [ ] **Correr todos los tests**

```bash
npm test
```

- [ ] **Commit final si todo ok**

```bash
git commit --allow-empty -m "chore(escalafon): MVP completo y validado"
```
