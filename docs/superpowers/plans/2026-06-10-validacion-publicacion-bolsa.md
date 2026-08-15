# Validación y Seguridad en Publicación de Bolsa de Trabajo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un wizard de validación guiada de 4 pasos antes de publicar una quincena, análisis automático de regresión (>10% = alerta), y herramientas de emergencia post-publicación (ocultar portal + revertir a quincena anterior).

**Architecture:** Se agregan dos nuevos endpoints de solo lectura/acción (`/pre-publicar`, `/revertir`), se extiende `/publicar` para guardar el resumen de regresión, y se crean tres nuevos componentes React en el panel admin. La lógica de negocio vive en `regression-analyzer.ts` y `validation-sampler.ts`, desacoplados del transporte.

**Tech Stack:** Next.js 14 App Router, TypeScript, Firebase Admin SDK (Firestore), Vitest (tests), Tailwind CSS + Radix UI (frontend), Lucide React (iconos).

---

## File Map

### Nuevos archivos

| Archivo                                                          | Responsabilidad                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/lib/bolsa-de-trabajo/regression-analyzer.ts`                | Compara posiciones nueva sync vs anterior, detecta regresión >10% |
| `src/lib/bolsa-de-trabajo/validation-sampler.ts`                 | Selecciona hasta 5 casos representativos por documento            |
| `src/lib/bolsa-de-trabajo/__tests__/regression-analyzer.test.ts` | Tests del analizador                                              |
| `src/lib/bolsa-de-trabajo/__tests__/validation-sampler.test.ts`  | Tests del muestreador                                             |
| `src/app/api/bolsa-de-trabajo/pre-publicar/route.ts`             | POST endpoint: analiza sin modificar Firestore                    |
| `src/app/api/bolsa-de-trabajo/revertir/route.ts`                 | POST endpoint: ocultar/mostrar/revertir                           |
| `src/components/bolsa/PublicacionWizard.tsx`                     | Wizard 4 pasos pre-publicación                                    |
| `src/components/bolsa/ZonaPeligro.tsx`                           | Controles de emergencia post-publicación                          |
| `src/components/bolsa/MovimientosTab.tsx`                        | Vista diff histórico entre quincenas                              |

### Archivos modificados

| Archivo                                                             | Cambio                                                                                                                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/bolsa-de-trabajo.ts`                                     | Nuevos tipos: `RegressionAnalysis`, `TipoRegressionStats`, `CasoRepresentativo`, `ResumenRegresion`; `Sincronizacion` extendida con `oculto`, `syncAnteriorId`, `resumenRegresion` |
| `src/app/api/bolsa-de-trabajo/publicar/route.ts`                    | Acepta `regresion` en body, guarda `syncAnteriorId` + `resumenRegresion`                                                                                                           |
| `src/app/api/trabajador/posicion/route.ts`                          | Retorna 503 `SYNC_HIDDEN` si sync tiene `oculto: true`                                                                                                                             |
| `src/app/(main)/admin/bolsa-de-trabajo/quincenas/[syncId]/page.tsx` | Reemplaza botón Publicar por botón que abre wizard; agrega `ZonaPeligro` y `MovimientosTab`                                                                                        |

---

## Task 1: Tipos nuevos en bolsa-de-trabajo.ts

**Files:**

- Modify: `src/types/bolsa-de-trabajo.ts`

- [ ] **Step 1: Agregar tipos de regresión y actualizar Sincronizacion**

Abre `src/types/bolsa-de-trabajo.ts`. Después de la interfaz `BolsaPosicionMaterializada` (línea ~183), agregar:

```typescript
export interface TipoRegressionStats {
  total: number;
  avanzaron: number;
  retrocedieron: number;
  sinCambio: number;
  porcentajeRetroceso: number;
}

export interface RegressionAnalysis {
  sinComparacion: boolean;
  alertaDisparada: boolean;
  porTipo: Partial<Record<TipoBolsaDeTrabajo, TipoRegressionStats>>;
  syncAnteriorId: string | null;
}

export interface CasoRepresentativo {
  matricula: string;
  nombre: string;
  categoria: string;
  zona: string;
  tipoDocumento: TipoBolsaDeTrabajo;
  posAnterior: number | null;
  posNueva: number;
  delta: number | null;
  etiqueta: "INCONDICIONAL" | "PRIMERO" | "MEDIO" | "EVENTUAL" | "MUESTRA";
}

export interface ResumenRegresion {
  porTipo: Partial<Record<TipoBolsaDeTrabajo, TipoRegressionStats>>;
  alertaDisparada: boolean;
  sinComparacion: boolean;
  confirmadoPor: string;
  fechaConfirmacion: Timestamp | Date;
}
```

- [ ] **Step 2: Extender la interfaz Sincronizacion**

En `src/types/bolsa-de-trabajo.ts`, la interfaz `Sincronizacion` (línea ~138) debe quedar así:

```typescript
export interface Sincronizacion {
  id: string;
  anio: number;
  mes: number;
  quincena: 1 | 2;
  estado: EstadoSincronizacion;
  fechaInicio: Timestamp | Date;
  fechaFinalizacion?: Timestamp | Date;
  archivosSubidos: string[];
  esFuenteVerdad: boolean;
  subidoPor: string;
  subidoPorEmail?: string;
  oculto?: boolean;
  syncAnteriorId?: string | null;
  resumenRegresion?: ResumenRegresion | null;
}
```

- [ ] **Step 3: Verificar que no hay errores de compilación**

```bash
npm run typecheck
```

Esperado: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add src/types/bolsa-de-trabajo.ts
git commit -m "feat(bolsa): tipos para validación y regresión de publicación"
```

---

## Task 2: regression-analyzer.ts

**Files:**

- Create: `src/lib/bolsa-de-trabajo/regression-analyzer.ts`
- Create: `src/lib/bolsa-de-trabajo/__tests__/regression-analyzer.test.ts`

- [ ] **Step 1: Escribir el test primero**

Crear `src/lib/bolsa-de-trabajo/__tests__/regression-analyzer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { analyzeRegression } from "../regression-analyzer";
import type { BolsaPosicionMaterializada } from "@/types/bolsa-de-trabajo";

const makePos = (
  overrides: Partial<BolsaPosicionMaterializada> & {
    matricula: string;
    posicionBase: number;
  },
): BolsaPosicionMaterializada => ({
  id: overrides.matricula,
  syncId: "sync-new",
  matricula: overrides.matricula,
  tipoDocumento: "CAMBIOS_RAMA",
  documentoId: "doc-1",
  periodo: { anio: 2026, mes: 6, quincena: 1 },
  versionCalculo: "1",
  fechaMaterializacion: new Date(),
  nombre: "Test",
  categoria: "ENFERMERA GENERAL",
  zona: "1-Tijuana",
  posicionBase: overrides.posicionBase,
  totalEnCategoria: 10,
  ...overrides,
});

describe("analyzeRegression", () => {
  it("retorna sinComparacion=true si no hay syncAnteriorId", () => {
    const result = analyzeRegression({
      syncAnteriorId: null,
      newPositions: [makePos({ matricula: "A", posicionBase: 1 })],
      previousPositions: [],
    });
    expect(result.sinComparacion).toBe(true);
    expect(result.alertaDisparada).toBe(false);
  });

  it("retorna sinComparacion=true si previousPositions está vacío", () => {
    const result = analyzeRegression({
      syncAnteriorId: "sync-anterior",
      newPositions: [makePos({ matricula: "A", posicionBase: 1 })],
      previousPositions: [],
    });
    expect(result.sinComparacion).toBe(true);
  });

  it("detecta avances y retrocesos correctamente", () => {
    const prev = [
      makePos({ matricula: "A", posicionBase: 3, syncId: "sync-ant" }),
      makePos({ matricula: "B", posicionBase: 1, syncId: "sync-ant" }),
      makePos({ matricula: "C", posicionBase: 5, syncId: "sync-ant" }),
    ];
    const next = [
      makePos({ matricula: "A", posicionBase: 1 }), // avanzó (3 → 1)
      makePos({ matricula: "B", posicionBase: 4 }), // retrocedió (1 → 4)
      makePos({ matricula: "C", posicionBase: 5 }), // sin cambio
    ];
    const result = analyzeRegression({
      syncAnteriorId: "sync-ant",
      newPositions: next,
      previousPositions: prev,
    });
    expect(result.sinComparacion).toBe(false);
    const stats = result.porTipo["CAMBIOS_RAMA"]!;
    expect(stats.avanzaron).toBe(1);
    expect(stats.retrocedieron).toBe(1);
    expect(stats.sinCambio).toBe(1);
    expect(stats.total).toBe(3);
  });

  it("no dispara alerta si retroceso ≤ 10%", () => {
    // 10 trabajadores, 1 retrocede = 10% — no alerta (estrictamente > 10)
    const prev = Array.from({ length: 10 }, (_, i) =>
      makePos({
        matricula: String(i),
        posicionBase: i + 1,
        syncId: "sync-ant",
      }),
    );
    const next = prev.map((p, i) =>
      makePos({ matricula: p.matricula, posicionBase: i === 0 ? 10 : i + 1 }),
    );
    const result = analyzeRegression({
      syncAnteriorId: "sync-ant",
      newPositions: next,
      previousPositions: prev,
    });
    expect(result.alertaDisparada).toBe(false);
  });

  it("dispara alerta si retroceso > 10%", () => {
    // 10 trabajadores, 2 retroceden = 20%
    const prev = Array.from({ length: 10 }, (_, i) =>
      makePos({
        matricula: String(i),
        posicionBase: i + 1,
        syncId: "sync-ant",
      }),
    );
    const next = prev.map((p, i) =>
      makePos({ matricula: p.matricula, posicionBase: i < 2 ? 10 : i + 1 }),
    );
    const result = analyzeRegression({
      syncAnteriorId: "sync-ant",
      newPositions: next,
      previousPositions: prev,
    });
    expect(result.alertaDisparada).toBe(true);
  });

  it("cuenta como sinCambio a trabajadores nuevos sin posicion anterior", () => {
    const prev = [
      makePos({ matricula: "A", posicionBase: 1, syncId: "sync-ant" }),
    ];
    const next = [
      makePos({ matricula: "A", posicionBase: 1 }),
      makePos({ matricula: "NUEVO", posicionBase: 5 }), // no existía antes
    ];
    const result = analyzeRegression({
      syncAnteriorId: "sync-ant",
      newPositions: next,
      previousPositions: prev,
    });
    const stats = result.porTipo["CAMBIOS_RAMA"]!;
    expect(stats.sinCambio).toBe(2); // A sin cambio + NUEVO sin anterior
    expect(stats.retrocedieron).toBe(0);
  });

  it("agrupa stats por tipoDocumento independientemente", () => {
    const prev = [
      makePos({
        matricula: "A",
        posicionBase: 1,
        syncId: "sync-ant",
        tipoDocumento: "CAMBIOS_RAMA",
      }),
      makePos({
        matricula: "B",
        posicionBase: 1,
        syncId: "sync-ant",
        tipoDocumento: "NUEVO_INGRESO",
      }),
    ];
    const next = [
      makePos({
        matricula: "A",
        posicionBase: 5,
        tipoDocumento: "CAMBIOS_RAMA",
      }), // retrocedió
      makePos({
        matricula: "B",
        posicionBase: 1,
        tipoDocumento: "NUEVO_INGRESO",
      }), // sin cambio
    ];
    const result = analyzeRegression({
      syncAnteriorId: "sync-ant",
      newPositions: next,
      previousPositions: prev,
    });
    expect(result.porTipo["CAMBIOS_RAMA"]!.retrocedieron).toBe(1);
    expect(result.porTipo["NUEVO_INGRESO"]!.retrocedieron).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar test para verificar que falla**

```bash
npm test -- regression-analyzer --run
```

Esperado: falla con `Cannot find module '../regression-analyzer'`.

- [ ] **Step 3: Implementar regression-analyzer.ts**

Crear `src/lib/bolsa-de-trabajo/regression-analyzer.ts`:

```typescript
import type {
  BolsaPosicionMaterializada,
  RegressionAnalysis,
  TipoRegressionStats,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";

interface AnalyzeRegressionParams {
  syncAnteriorId: string | null;
  newPositions: BolsaPosicionMaterializada[];
  previousPositions: BolsaPosicionMaterializada[];
}

export function analyzeRegression({
  syncAnteriorId,
  newPositions,
  previousPositions,
}: AnalyzeRegressionParams): RegressionAnalysis {
  if (!syncAnteriorId || previousPositions.length === 0) {
    return {
      sinComparacion: true,
      alertaDisparada: false,
      porTipo: {},
      syncAnteriorId: null,
    };
  }

  // Lookup de posición anterior: tipoDocumento::matricula → posicionBase
  const prevLookup = new Map<string, number>();
  for (const pos of previousPositions) {
    prevLookup.set(`${pos.tipoDocumento}::${pos.matricula}`, pos.posicionBase);
  }

  // Agrupar nuevas posiciones por tipo
  const byTipo = new Map<TipoBolsaDeTrabajo, BolsaPosicionMaterializada[]>();
  for (const pos of newPositions) {
    const arr = byTipo.get(pos.tipoDocumento) ?? [];
    arr.push(pos);
    byTipo.set(pos.tipoDocumento, arr);
  }

  const porTipo: Partial<Record<TipoBolsaDeTrabajo, TipoRegressionStats>> = {};
  let alertaDisparada = false;

  for (const [tipo, positions] of byTipo) {
    let avanzaron = 0;
    let retrocedieron = 0;
    let sinCambio = 0;

    for (const pos of positions) {
      const prevPos = prevLookup.get(`${pos.tipoDocumento}::${pos.matricula}`);
      if (prevPos === undefined) {
        sinCambio++;
      } else if (pos.posicionBase < prevPos) {
        avanzaron++;
      } else if (pos.posicionBase > prevPos) {
        retrocedieron++;
      } else {
        sinCambio++;
      }
    }

    const total = positions.length;
    const porcentajeRetroceso =
      total > 0 ? Math.round((retrocedieron / total) * 100) : 0;

    porTipo[tipo] = {
      total,
      avanzaron,
      retrocedieron,
      sinCambio,
      porcentajeRetroceso,
    };

    if (porcentajeRetroceso > 10) {
      alertaDisparada = true;
    }
  }

  return {
    sinComparacion: false,
    alertaDisparada,
    porTipo,
    syncAnteriorId,
  };
}
```

- [ ] **Step 4: Ejecutar tests para verificar que pasan**

```bash
npm test -- regression-analyzer --run
```

Esperado: todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bolsa-de-trabajo/regression-analyzer.ts src/lib/bolsa-de-trabajo/__tests__/regression-analyzer.test.ts
git commit -m "feat(bolsa): regression-analyzer — detecta retrocesos entre quincenas"
```

---

## Task 3: validation-sampler.ts

**Files:**

- Create: `src/lib/bolsa-de-trabajo/validation-sampler.ts`
- Create: `src/lib/bolsa-de-trabajo/__tests__/validation-sampler.test.ts`

- [ ] **Step 1: Escribir el test primero**

Crear `src/lib/bolsa-de-trabajo/__tests__/validation-sampler.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sampleRepresentativeCases } from "../validation-sampler";
import type { BolsaPosicionMaterializada } from "@/types/bolsa-de-trabajo";

const makePos = (
  overrides: Partial<BolsaPosicionMaterializada> & {
    matricula: string;
    posicionBase: number;
  },
): BolsaPosicionMaterializada => ({
  id: overrides.matricula,
  syncId: "sync-new",
  matricula: overrides.matricula,
  tipoDocumento: "CAMBIOS_RAMA",
  documentoId: "doc-1",
  periodo: { anio: 2026, mes: 6, quincena: 1 },
  versionCalculo: "1",
  fechaMaterializacion: new Date(),
  nombre: `Trabajador ${overrides.matricula}`,
  categoria: "ENFERMERA GENERAL",
  zona: "1-Tijuana",
  posicionBase: overrides.posicionBase,
  totalEnCategoria: 10,
  ...overrides,
});

describe("sampleRepresentativeCases", () => {
  it("retorna array vacío si no hay posiciones para el documento", () => {
    const result = sampleRepresentativeCases([], [], "doc-1");
    expect(result).toHaveLength(0);
  });

  it("retorna hasta 5 casos sin duplicar matrícula", () => {
    const positions = Array.from({ length: 20 }, (_, i) =>
      makePos({ matricula: String(i), posicionBase: i + 1 }),
    );
    const result = sampleRepresentativeCases(positions, [], "doc-1");
    expect(result.length).toBeLessThanOrEqual(5);
    const matriculas = result.map((c) => c.matricula);
    expect(new Set(matriculas).size).toBe(matriculas.length);
  });

  it("incluye caso INCONDICIONAL si hay trabajador de zona incondicional", () => {
    const positions = [
      makePos({ matricula: "A", posicionBase: 1, zona: "0-Incondicional" }),
      makePos({ matricula: "B", posicionBase: 2 }),
    ];
    const result = sampleRepresentativeCases(positions, [], "doc-1");
    expect(result.some((c) => c.etiqueta === "INCONDICIONAL")).toBe(true);
  });

  it("calcula delta correctamente con posicion anterior", () => {
    const prev = [makePos({ matricula: "A", posicionBase: 3, syncId: "prev" })];
    const next = [makePos({ matricula: "A", posicionBase: 5 })];
    const result = sampleRepresentativeCases(next, prev, "doc-1");
    expect(result[0].delta).toBe(2); // 5 - 3 = empeoró 2 lugares
    expect(result[0].posAnterior).toBe(3);
  });

  it("delta es null si no había posición anterior", () => {
    const next = [makePos({ matricula: "NUEVO", posicionBase: 1 })];
    const result = sampleRepresentativeCases(next, [], "doc-1");
    expect(result[0].delta).toBeNull();
    expect(result[0].posAnterior).toBeNull();
  });

  it("incluye caso EVENTUAL si hay trabajador con tipoContratacion=8", () => {
    const positions = [
      makePos({ matricula: "BASE", posicionBase: 1, tipoContratacion: "1" }),
      makePos({ matricula: "EVT", posicionBase: 5, tipoContratacion: "8" }),
    ];
    const result = sampleRepresentativeCases(positions, [], "doc-1");
    expect(result.some((c) => c.etiqueta === "EVENTUAL")).toBe(true);
  });

  it("solo incluye posiciones del documentoId especificado", () => {
    const positions = [
      makePos({ matricula: "A", posicionBase: 1, documentoId: "doc-1" }),
      makePos({ matricula: "B", posicionBase: 2, documentoId: "doc-2" }),
    ];
    const result = sampleRepresentativeCases(positions, [], "doc-1");
    expect(result.every((c) => c.matricula !== "B")).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar test para verificar que falla**

```bash
npm test -- validation-sampler --run
```

Esperado: falla con `Cannot find module '../validation-sampler'`.

- [ ] **Step 3: Implementar validation-sampler.ts**

Crear `src/lib/bolsa-de-trabajo/validation-sampler.ts`:

```typescript
import type {
  BolsaPosicionMaterializada,
  CasoRepresentativo,
} from "@/types/bolsa-de-trabajo";

export function sampleRepresentativeCases(
  allNewPositions: BolsaPosicionMaterializada[],
  previousPositions: BolsaPosicionMaterializada[],
  documentoId: string,
): CasoRepresentativo[] {
  const docPositions = allNewPositions.filter(
    (p) => p.documentoId === documentoId,
  );
  if (docPositions.length === 0) return [];

  // Lookup de posición anterior
  const prevLookup = new Map<string, number>();
  for (const pos of previousPositions) {
    prevLookup.set(`${pos.tipoDocumento}::${pos.matricula}`, pos.posicionBase);
  }

  const sorted = [...docPositions].sort(
    (a, b) => a.posicionBase - b.posicionBase,
  );
  const selected = new Set<string>();
  const cases: CasoRepresentativo[] = [];

  const addCase = (
    pos: BolsaPosicionMaterializada,
    etiqueta: CasoRepresentativo["etiqueta"],
  ) => {
    if (selected.has(pos.matricula)) return;
    selected.add(pos.matricula);
    const posAnterior =
      prevLookup.get(`${pos.tipoDocumento}::${pos.matricula}`) ?? null;
    cases.push({
      matricula: pos.matricula,
      nombre: pos.nombre,
      categoria: pos.categoria,
      zona: pos.zona,
      tipoDocumento: pos.tipoDocumento,
      posAnterior,
      posNueva: pos.posicionBase,
      delta: posAnterior !== null ? pos.posicionBase - posAnterior : null,
      etiqueta,
    });
  };

  // 1. Zona incondicional con menor posición
  const incondicional = sorted.find((p) =>
    (p.zona || "").toUpperCase().includes("INCONDICIONAL"),
  );
  if (incondicional) addCase(incondicional, "INCONDICIONAL");

  // 2. Primer lugar
  if (sorted[0]) addCase(sorted[0], "PRIMERO");

  // 3. Posición media
  const medio = sorted[Math.floor(sorted.length / 2)];
  if (medio) addCase(medio, "MEDIO");

  // 4. Eventual
  const eventual = docPositions.find((p) => p.tipoContratacion === "8");
  if (eventual) addCase(eventual, "EVENTUAL");

  // 5. Caso aleatorio adicional
  const remaining = docPositions.filter((p) => !selected.has(p.matricula));
  if (remaining.length > 0) {
    addCase(remaining[Math.floor(remaining.length / 2)], "MUESTRA");
  }

  return cases;
}
```

- [ ] **Step 4: Ejecutar tests**

```bash
npm test -- validation-sampler --run
```

Esperado: todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bolsa-de-trabajo/validation-sampler.ts src/lib/bolsa-de-trabajo/__tests__/validation-sampler.test.ts
git commit -m "feat(bolsa): validation-sampler — selecciona casos representativos por documento"
```

---

## Task 4: POST /api/bolsa-de-trabajo/pre-publicar

**Files:**

- Create: `src/app/api/bolsa-de-trabajo/pre-publicar/route.ts`

- [ ] **Step 1: Crear el endpoint**

Crear `src/app/api/bolsa-de-trabajo/pre-publicar/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { materializeDocumentPositions } from "@/lib/bolsa-de-trabajo/materialize-sync-positions";
import { analyzeRegression } from "@/lib/bolsa-de-trabajo/regression-analyzer";
import { sampleRepresentativeCases } from "@/lib/bolsa-de-trabajo/validation-sampler";
import type {
  BolsaDeTrabajoRegistro,
  BolsaPosicionMaterializada,
  CasoRepresentativo,
  PeriodoBolsa,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";

export const dynamic = "force-dynamic";

const DOC_COLLECTION = "bolsa_de_trabajo_documentos";
const SYNC_COLLECTION = "sincronizaciones";
const POSITION_COLLECTION = "bolsa_posiciones_materializadas";

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:bolsa:pre-publicar",
      limit: 10,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const body = await request.json().catch(() => null);
    const syncId = typeof body?.syncId === "string" ? body.syncId.trim() : "";

    if (!syncId) {
      return NextResponse.json({ error: "syncId requerido." }, { status: 400 });
    }

    // 1. Cargar sync
    const syncSnap = await adminDb
      .collection(SYNC_COLLECTION)
      .doc(syncId)
      .get();
    if (!syncSnap.exists) {
      return NextResponse.json(
        { error: "La sincronización no existe." },
        { status: 404 },
      );
    }

    const syncData = syncSnap.data() as {
      anio: number;
      mes: number;
      quincena: 1 | 2;
      syncAnteriorId?: string | null;
    };

    const periodo: PeriodoBolsa = {
      anio: syncData.anio,
      mes: syncData.mes,
      quincena: syncData.quincena,
    };

    // 2. Cargar documentos COMPLETADO
    const docsSnap = await adminDb
      .collection(DOC_COLLECTION)
      .where("syncId", "==", syncId)
      .where("estado", "==", "COMPLETADO")
      .get();

    if (docsSnap.empty) {
      return NextResponse.json(
        { error: "No hay documentos completados en esta sincronización." },
        { status: 400 },
      );
    }

    const documentosMeta: Array<{
      id: string;
      tipo: TipoBolsaDeTrabajo;
      totalRegistros: number;
      nombreArchivo?: string;
    }> = [];

    // 3. Calcular posiciones en memoria por cada documento
    const allNewPositions: BolsaPosicionMaterializada[] = [];

    for (const docSnap of docsSnap.docs) {
      const tipo = docSnap.get("tipo") as TipoBolsaDeTrabajo;
      const nombreArchivo = docSnap.get("nombreArchivo") as string | undefined;

      const registrosSnap = await adminDb
        .collection(DOC_COLLECTION)
        .doc(docSnap.id)
        .collection("registros")
        .get();

      const registros = registrosSnap.docs.map((r) => ({
        id: r.id,
        ...r.data(),
      })) as BolsaDeTrabajoRegistro[];

      const lookups = materializeDocumentPositions({
        syncId,
        documentoId: docSnap.id,
        tipoDocumento: tipo,
        periodo,
        registros,
      });

      allNewPositions.push(...lookups);
      documentosMeta.push({
        id: docSnap.id,
        tipo,
        totalRegistros: registros.length,
        nombreArchivo,
      });
    }

    // 4. Cargar posiciones de la sync anterior (si existe)
    const syncAnteriorId = syncData.syncAnteriorId ?? null;
    let previousPositions: BolsaPosicionMaterializada[] = [];

    if (syncAnteriorId) {
      const prevSnap = await adminDb
        .collection(POSITION_COLLECTION)
        .where("syncId", "==", syncAnteriorId)
        .get();
      previousPositions = prevSnap.docs.map(
        (d) => d.data() as BolsaPosicionMaterializada,
      );
    } else {
      // Buscar la sync con esFuenteVerdad=true (si no hay syncAnteriorId guardado)
      const activeSnap = await adminDb
        .collection(SYNC_COLLECTION)
        .where("esFuenteVerdad", "==", true)
        .limit(1)
        .get();

      if (!activeSnap.empty && activeSnap.docs[0].id !== syncId) {
        const activeSyncId = activeSnap.docs[0].id;
        const prevSnap = await adminDb
          .collection(POSITION_COLLECTION)
          .where("syncId", "==", activeSyncId)
          .get();
        previousPositions = prevSnap.docs.map(
          (d) => d.data() as BolsaPosicionMaterializada,
        );
      }
    }

    // 5. Análisis de regresión
    const regresion = analyzeRegression({
      syncAnteriorId,
      newPositions: allNewPositions,
      previousPositions,
    });

    // 6. Muestras representativas por documento
    const muestras: Record<string, CasoRepresentativo[]> = {};
    for (const doc of documentosMeta) {
      muestras[doc.id] = sampleRepresentativeCases(
        allNewPositions,
        previousPositions,
        doc.id,
      );
    }

    return NextResponse.json({
      success: true,
      regresion,
      muestras,
      documentos: documentosMeta,
      syncAnteriorId,
    });
  } catch (error: any) {
    console.error("Error en pre-publicar:", error);

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
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (error?.message === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Error al analizar la sincronización." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verificar types**

```bash
npm run typecheck
```

Esperado: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bolsa-de-trabajo/pre-publicar/route.ts
git commit -m "feat(bolsa): endpoint POST /pre-publicar — análisis en memoria sin modificar estado"
```

---

## Task 5: POST /api/bolsa-de-trabajo/revertir

**Files:**

- Create: `src/app/api/bolsa-de-trabajo/revertir/route.ts`

- [ ] **Step 1: Crear el endpoint**

Crear `src/app/api/bolsa-de-trabajo/revertir/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";

export const dynamic = "force-dynamic";

const SYNC_COLLECTION = "sincronizaciones";
const POSITION_COLLECTION = "bolsa_posiciones_materializadas";

export async function POST(request: NextRequest) {
  let adminUser: Awaited<ReturnType<typeof requireAdminRequest>> | null = null;

  try {
    enforceRateLimit(request, {
      bucket: "api:bolsa:revertir",
      limit: 10,
      windowMs: 60_000,
    });
    adminUser = await requireAdminRequest(request);

    const body = await request.json().catch(() => null);
    const syncId = typeof body?.syncId === "string" ? body.syncId.trim() : "";
    const accion = body?.accion as
      | "OCULTAR"
      | "MOSTRAR"
      | "REVERTIR"
      | undefined;

    if (
      !syncId ||
      !accion ||
      !["OCULTAR", "MOSTRAR", "REVERTIR"].includes(accion)
    ) {
      return NextResponse.json(
        { error: "syncId y accion (OCULTAR | MOSTRAR | REVERTIR) requeridos." },
        { status: 400 },
      );
    }

    const syncRef = adminDb.collection(SYNC_COLLECTION).doc(syncId);
    const syncSnap = await syncRef.get();

    if (!syncSnap.exists) {
      return NextResponse.json(
        { error: "La sincronización no existe." },
        { status: 404 },
      );
    }

    if (accion === "OCULTAR") {
      await syncRef.update({ oculto: true });
      await writeAdminAuditLog({
        action: "BOLSA_OCULTAR_SYNC",
        actorUid: adminUser.uid,
        actorEmail: adminUser.email || "",
        targetType: "sincronizacion",
        targetId: syncId,
        status: "SUCCESS",
        metadata: { accion: "OCULTAR" },
      });
      return NextResponse.json({ success: true, accion: "OCULTAR" });
    }

    if (accion === "MOSTRAR") {
      await syncRef.update({ oculto: false });
      await writeAdminAuditLog({
        action: "BOLSA_OCULTAR_SYNC",
        actorUid: adminUser.uid,
        actorEmail: adminUser.email || "",
        targetType: "sincronizacion",
        targetId: syncId,
        status: "SUCCESS",
        metadata: { accion: "MOSTRAR" },
      });
      return NextResponse.json({ success: true, accion: "MOSTRAR" });
    }

    // REVERTIR
    const syncData = syncSnap.data() as { syncAnteriorId?: string | null };
    const syncAnteriorId = syncData.syncAnteriorId;

    if (!syncAnteriorId) {
      return NextResponse.json(
        { error: "No hay quincena anterior registrada para revertir." },
        { status: 400 },
      );
    }

    // Verificar que la sync anterior tiene posiciones materializadas
    const prevPosSnap = await adminDb
      .collection(POSITION_COLLECTION)
      .where("syncId", "==", syncAnteriorId)
      .limit(1)
      .get();

    if (prevPosSnap.empty) {
      return NextResponse.json(
        {
          error:
            "La quincena anterior no tiene posiciones materializadas. No se puede revertir.",
        },
        { status: 400 },
      );
    }

    const batch = adminDb.batch();
    batch.update(syncRef, { esFuenteVerdad: false });
    batch.update(adminDb.collection(SYNC_COLLECTION).doc(syncAnteriorId), {
      esFuenteVerdad: true,
      fechaReactivacion: Timestamp.now(),
    });
    await batch.commit();

    await writeAdminAuditLog({
      action: "BOLSA_REVERTIR_SYNC",
      actorUid: adminUser.uid,
      actorEmail: adminUser.email || "",
      targetType: "sincronizacion",
      targetId: syncId,
      status: "SUCCESS",
      metadata: { syncAnteriorId, accion: "REVERTIR" },
    });

    return NextResponse.json({
      success: true,
      accion: "REVERTIR",
      syncAnteriorId,
    });
  } catch (error: any) {
    console.error("Error en revertir:", error);

    if (adminUser) {
      await writeAdminAuditLog({
        action: "BOLSA_REVERTIR_SYNC",
        actorUid: adminUser.uid,
        actorEmail: adminUser.email || "",
        targetType: "sincronizacion",
        targetId: "",
        status: "ERROR",
        metadata: { error: error?.message || "UNKNOWN_ERROR" },
      }).catch(() => {});
    }

    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }
    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (error?.message === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Error al ejecutar la acción." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verificar types**

```bash
npm run typecheck
```

Esperado: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bolsa-de-trabajo/revertir/route.ts
git commit -m "feat(bolsa): endpoint POST /revertir — ocultar portal y rollback a quincena anterior"
```

---

## Task 6: Modificar publicar/route.ts

**Files:**

- Modify: `src/app/api/bolsa-de-trabajo/publicar/route.ts`

- [ ] **Step 1: Leer el archivo actual**

Abrir `src/app/api/bolsa-de-trabajo/publicar/route.ts` y localizar la función `POST`.

- [ ] **Step 2: Extender el body y guardar syncAnteriorId + resumenRegresion**

Reemplazar el bloque de la función `POST` a partir de `const body = await request.json()...` (línea ~21) hasta antes de `const { totalDocumentos, totalMaterializados } = await materializeSyncPositions...`:

```typescript
const body = await request.json().catch(() => null);
const syncId = typeof body?.syncId === "string" ? body.syncId.trim() : "";
const regresionDelWizard = body?.regresion ?? null;

if (!syncId) {
  return NextResponse.json({ error: "syncId requerido." }, { status: 400 });
}

const syncRef = adminDb.collection(SYNC_COLLECTION).doc(syncId);
const syncSnap = await syncRef.get();

if (!syncSnap.exists) {
  return NextResponse.json(
    { error: "La sincronización no existe." },
    { status: 404 },
  );
}

const syncData = syncSnap.data() as {
  anio: number;
  mes: number;
  quincena: 1 | 2;
  esFuenteVerdad?: boolean;
};

const periodo: PeriodoBolsa = {
  anio: syncData.anio,
  mes: syncData.mes,
  quincena: syncData.quincena,
};

const { totalDocumentos, totalMaterializados } = await materializeSyncPositions(
  syncId,
  periodo,
);

// Encontrar sync anterior (la que tenía esFuenteVerdad=true)
const batch = adminDb.batch();
const oficialesActuales = await adminDb
  .collection(SYNC_COLLECTION)
  .where("esFuenteVerdad", "==", true)
  .get();

let syncAnteriorId: string | null = null;

oficialesActuales.forEach((doc) => {
  if (doc.id !== syncId) {
    syncAnteriorId = doc.id;
    batch.update(doc.ref, { esFuenteVerdad: false });
  }
});

const resumenRegresion = regresionDelWizard
  ? {
      ...regresionDelWizard,
      confirmadoPor: adminUser!.uid,
      fechaConfirmacion: Timestamp.now(),
    }
  : null;

batch.update(syncRef, {
  esFuenteVerdad: true,
  estado: "COMPLETADO",
  fechaFinalizacion: Timestamp.now(),
  syncAnteriorId,
  resumenRegresion,
});

await batch.commit();
```

- [ ] **Step 3: Actualizar el audit log para incluir syncAnteriorId**

En el llamado a `writeAdminAuditLog` de success (línea ~70), agregar al `metadata`:

```typescript
metadata: {
  totalDocumentos,
  totalMaterializados,
  syncAnteriorId,
},
```

- [ ] **Step 4: Actualizar el return para incluir syncAnteriorId**

```typescript
return NextResponse.json({
  success: true,
  syncId,
  totalDocumentos,
  totalMaterializados,
  yaEraOficial: Boolean(syncData.esFuenteVerdad),
  syncAnteriorId,
});
```

- [ ] **Step 5: Verificar types**

```bash
npm run typecheck
```

Esperado: 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/bolsa-de-trabajo/publicar/route.ts
git commit -m "feat(bolsa): publicar guarda syncAnteriorId y resumenRegresion al activar quincena"
```

---

## Task 7: Manejo de oculto en portal del trabajador

**Files:**

- Modify: `src/app/api/trabajador/posicion/route.ts`

- [ ] **Step 1: Agregar chequeo de oculto después de cargar syncDoc**

En `src/app/api/trabajador/posicion/route.ts`, después de obtener `syncDoc` (línea ~55-59), agregar:

```typescript
const syncActiva = {
  id: syncDoc.id,
  ...syncDoc.data(),
} as {
  id: string;
  anio: number;
  mes: number;
  quincena: number;
  oculto?: boolean;
};

if (syncActiva.oculto) {
  return NextResponse.json(
    {
      error:
        "El listado está en proceso de actualización. Intenta de nuevo en breve.",
      code: "SYNC_HIDDEN",
    },
    { status: 503 },
  );
}
```

- [ ] **Step 2: Verificar types**

```bash
npm run typecheck
```

Esperado: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/trabajador/posicion/route.ts
git commit -m "feat(bolsa): portal retorna 503 SYNC_HIDDEN cuando la quincena está oculta"
```

---

## Task 8: Componente PublicacionWizard

**Files:**

- Create: `src/components/bolsa/PublicacionWizard.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/bolsa/PublicacionWizard.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import {
  Check,
  ChevronRight,
  AlertTriangle,
  FileText,
  BarChart3,
  Eye,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NOMBRES_TIPOS } from "@/types/bolsa-de-trabajo";
import type {
  RegressionAnalysis,
  CasoRepresentativo,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";

interface DocumentoMeta {
  id: string;
  tipo: TipoBolsaDeTrabajo;
  totalRegistros: number;
  nombreArchivo?: string;
}

interface PrePublicarData {
  regresion: RegressionAnalysis;
  muestras: Record<string, CasoRepresentativo[]>;
  documentos: DocumentoMeta[];
  syncAnteriorId: string | null;
}

interface PublicacionWizardProps {
  syncId: string;
  idToken: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const PASOS = [
  { id: 1, label: "Documentos", icon: FileText },
  { id: 2, label: "Movimientos", icon: BarChart3 },
  { id: 3, label: "Muestras", icon: Eye },
  { id: 4, label: "Confirmar", icon: Rocket },
];

export function PublicacionWizard({
  syncId,
  idToken,
  onSuccess,
  onCancel,
}: PublicacionWizardProps) {
  const [paso, setPaso] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PrePublicarData | null>(null);
  const [checkDoc, setCheckDoc] = useState(false);
  const [checkConfirm, setCheckConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [publicando, setPublicando] = useState(false);

  const cargarAnalisis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bolsa-de-trabajo/pre-publicar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ syncId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Error al analizar");
      setData(payload);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [syncId, idToken]);

  // Cargar al montar
  useState(() => {
    cargarAnalisis();
  });

  const handlePublicar = async () => {
    if (!data) return;
    setPublicando(true);
    try {
      const res = await fetch("/api/bolsa-de-trabajo/publicar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ syncId, regresion: data.regresion }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Error al publicar");
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setPublicando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
          Analizando quincena...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive font-bold">{error}</p>
        <Button variant="outline" onClick={cargarAnalisis}>
          Reintentar
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const canPublish = data.regresion.alertaDisparada
    ? confirmText === "CONFIRMAR" && checkConfirm
    : checkConfirm;

  return (
    <div className="flex flex-col gap-8">
      {/* Barra de progreso */}
      <div className="flex items-center gap-0">
        {PASOS.map((p, idx) => {
          const Icon = p.icon;
          const done = paso > p.id;
          const active = paso === p.id;
          return (
            <div key={p.id} className="flex items-center flex-1">
              <div
                className={cn(
                  "flex items-center gap-2 py-2 px-3 rounded-xl transition-all",
                  active && "bg-primary/10",
                  done && "opacity-60",
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all",
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-primary text-white"
                        : "bg-slate-200 text-slate-500",
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5 stroke-[3px]" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-black uppercase tracking-widest hidden sm:block",
                    active ? "text-primary" : "text-slate-400",
                  )}
                >
                  {p.label}
                </span>
              </div>
              {idx < PASOS.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 mx-1 transition-all",
                    paso > p.id ? "bg-emerald-400" : "bg-slate-200",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Paso 1 — Documentos */}
      {paso === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Documentos incluidos
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Verifica que estos son los listados correctos para esta quincena.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {data.documentos.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 ring-1 ring-slate-200/50 dark:ring-slate-800/50"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {NOMBRES_TIPOS[doc.tipo]}
                  </span>
                  {doc.nombreArchivo && (
                    <span className="text-xs text-slate-400 italic">
                      {doc.nombreArchivo}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Registros
                  </span>
                  <p className="text-lg font-black text-primary">
                    {doc.totalRegistros.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checkDoc}
              onChange={(e) => setCheckDoc(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              He verificado que estos son los listados correctos para esta
              quincena.
            </span>
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button disabled={!checkDoc} onClick={() => setPaso(2)}>
              Siguiente <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Paso 2 — Análisis de movimiento */}
      {paso === 2 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Análisis de movimiento
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Comparación con la quincena anterior.
            </p>
          </div>

          {data.regresion.sinComparacion ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 ring-1 ring-slate-200">
              <p className="text-sm font-bold text-slate-500">
                Primera publicación — sin datos de comparación disponibles.
              </p>
            </div>
          ) : (
            <>
              {data.regresion.alertaDisparada && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">
                    Detectamos movimiento inusual en uno o más listados (&gt;10%
                    de trabajadores retroceden). Revisa las muestras antes de
                    continuar.
                  </p>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-2 pr-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Tipo
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Total
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        Avanzaron
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-red-500">
                        Retrocedieron
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Sin cambio
                      </th>
                      <th className="text-right py-2 pl-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        % Retroceso
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      Object.entries(data.regresion.porTipo) as [
                        TipoBolsaDeTrabajo,
                        {
                          total: number;
                          avanzaron: number;
                          retrocedieron: number;
                          sinCambio: number;
                          porcentajeRetroceso: number;
                        },
                      ][]
                    ).map(([tipo, stats]) => (
                      <tr
                        key={tipo}
                        className="border-b border-slate-100 dark:border-slate-800/50"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                stats.porcentajeRetroceso > 10
                                  ? "bg-red-500"
                                  : "bg-emerald-500",
                              )}
                            />
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {NOMBRES_TIPOS[tipo]}
                            </span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 font-bold text-slate-600">
                          {stats.total}
                        </td>
                        <td className="text-right py-3 px-2 font-bold text-emerald-600">
                          {stats.avanzaron}
                        </td>
                        <td className="text-right py-3 px-2 font-bold text-red-500">
                          {stats.retrocedieron}
                        </td>
                        <td className="text-right py-3 px-2 font-bold text-slate-400">
                          {stats.sinCambio}
                        </td>
                        <td className="text-right py-3 pl-2">
                          <Badge
                            variant={
                              stats.porcentajeRetroceso > 10
                                ? "destructive"
                                : "success"
                            }
                            className="text-[10px] font-black"
                          >
                            {stats.porcentajeRetroceso}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setPaso(1)}>
              Atrás
            </Button>
            <Button onClick={() => setPaso(3)}>
              Siguiente <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Paso 3 — Muestras */}
      {paso === 3 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Revisión de muestras
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Casos representativos por listado para verificar que las
              posiciones se ven correctas.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {data.documentos.map((doc) => {
              const casos = data.muestras[doc.id] ?? [];
              return (
                <details
                  key={doc.id}
                  className="group rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 bg-white/40 dark:bg-slate-900/40 overflow-hidden"
                >
                  <summary className="flex items-center justify-between p-4 cursor-pointer select-none">
                    <span className="font-black text-slate-800 dark:text-white text-sm">
                      {NOMBRES_TIPOS[doc.tipo]}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900">
                          <th className="text-left p-3 font-black uppercase tracking-widest text-slate-400">
                            Matrícula
                          </th>
                          <th className="text-left p-3 font-black uppercase tracking-widest text-slate-400">
                            Nombre
                          </th>
                          <th className="text-left p-3 font-black uppercase tracking-widest text-slate-400">
                            Zona
                          </th>
                          <th className="text-right p-3 font-black uppercase tracking-widest text-slate-400">
                            Pos. ant.
                          </th>
                          <th className="text-right p-3 font-black uppercase tracking-widest text-slate-400">
                            Pos. nueva
                          </th>
                          <th className="text-right p-3 font-black uppercase tracking-widest text-slate-400">
                            Delta
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {casos.map((c) => (
                          <tr
                            key={c.matricula}
                            className="border-t border-slate-100 dark:border-slate-800"
                          >
                            <td className="p-3 font-bold text-slate-600">
                              {c.matricula}
                            </td>
                            <td className="p-3 text-slate-700 dark:text-slate-300">
                              {c.nombre}
                            </td>
                            <td className="p-3 text-slate-500">{c.zona}</td>
                            <td className="p-3 text-right text-slate-400">
                              {c.posAnterior ?? "—"}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-800 dark:text-white">
                              {c.posNueva}
                            </td>
                            <td className="p-3 text-right font-black">
                              {c.delta === null ? (
                                <span className="text-slate-400">—</span>
                              ) : c.delta < 0 ? (
                                <span className="text-emerald-600">
                                  ↑{Math.abs(c.delta)}
                                </span>
                              ) : c.delta > 0 ? (
                                <span className="text-red-500">↓{c.delta}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {casos.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="p-4 text-center text-slate-400 text-xs"
                            >
                              Sin muestras disponibles.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setPaso(2)}>
              Atrás
            </Button>
            <Button onClick={() => setPaso(4)}>
              Siguiente <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Paso 4 — Confirmación final */}
      {paso === 4 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Confirmación final
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Revisa el resumen y autoriza la publicación.
            </p>
          </div>

          {/* Resumen compacto */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 ring-1 ring-slate-200/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Listados
              </p>
              <p className="text-2xl font-black text-primary">
                {data.documentos.length}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 ring-1 ring-slate-200/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Trabajadores
              </p>
              <p className="text-2xl font-black text-primary">
                {Object.values(data.regresion.porTipo)
                  .reduce((a, s) => a + s.total, 0)
                  .toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 ring-1 ring-slate-200/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Alerta
              </p>
              <p
                className={cn(
                  "text-sm font-black mt-1",
                  data.regresion.alertaDisparada
                    ? "text-red-500"
                    : "text-emerald-600",
                )}
              >
                {data.regresion.alertaDisparada
                  ? "Sí — confirmar"
                  : "Sin alertas"}
              </p>
            </div>
          </div>

          {data.regresion.alertaDisparada && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-red-700 dark:text-red-400">
                Hay movimiento inusual detectado. Escribe{" "}
                <code className="bg-red-100 dark:bg-red-950 px-1 rounded">
                  CONFIRMAR
                </code>{" "}
                para continuar:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Escribe CONFIRMAR"
                className="h-10 px-4 rounded-xl border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 text-sm font-bold text-red-700 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checkConfirm}
              onChange={(e) => setCheckConfirm(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-primary"
            />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Confirmo que he revisado los datos y autorizo la publicación de
              esta quincena.
            </span>
          </label>

          {error && (
            <p className="text-sm text-destructive font-bold">{error}</p>
          )}

          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setPaso(3)}
              disabled={publicando}
            >
              Atrás
            </Button>
            <Button
              disabled={!canPublish || publicando}
              onClick={handlePublicar}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black"
            >
              {publicando ? "Publicando..." : "Publicar quincena"}
              {!publicando && <Rocket className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar types**

```bash
npm run typecheck
```

Esperado: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/bolsa/PublicacionWizard.tsx
git commit -m "feat(bolsa): wizard de publicación de 4 pasos con análisis de regresión"
```

---

## Task 9: Componente ZonaPeligro

**Files:**

- Create: `src/components/bolsa/ZonaPeligro.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/bolsa/ZonaPeligro.tsx`:

```tsx
"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ZonaPeligroProps {
  syncId: string;
  idToken: string;
  oculto: boolean;
  syncAnteriorId?: string | null;
  periodoAnteriorLabel?: string;
  onOcultarChange: (oculto: boolean) => void;
  onRevertir: () => void;
}

export function ZonaPeligro({
  syncId,
  idToken,
  oculto,
  syncAnteriorId,
  periodoAnteriorLabel,
  onOcultarChange,
  onRevertir,
}: ZonaPeligroProps) {
  const [open, setOpen] = useState(false);
  const [revertirText, setRevertirText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callRevertir = async (accion: "OCULTAR" | "MOSTRAR" | "REVERTIR") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bolsa-de-trabajo/revertir", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ syncId, accion }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Error");
      if (accion === "OCULTAR") onOcultarChange(true);
      if (accion === "MOSTRAR") onOcultarChange(false);
      if (accion === "REVERTIR") onRevertir();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl ring-1 ring-red-200 dark:ring-red-900/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-black text-red-700 dark:text-red-400 uppercase tracking-widest">
            Acciones de emergencia
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-red-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="p-6 flex flex-col gap-6 bg-white/60 dark:bg-slate-950/40">
          {/* Ocultar / Mostrar */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">
              Portal del trabajador
            </h3>
            {oculto ? (
              <>
                <p className="text-xs text-slate-500">
                  El portal está{" "}
                  <strong className="text-red-500">oculto</strong>. Los
                  trabajadores ven "El listado está en proceso de
                  actualización".
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => callRevertir("MOSTRAR")}
                  className="w-fit"
                >
                  Reactivar portal
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Oculta temporalmente el portal mientras investigas. Los
                  trabajadores verán un mensaje de mantenimiento.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => callRevertir("OCULTAR")}
                  className="w-fit border-red-300 text-red-600 hover:bg-red-50"
                >
                  Ocultar portal temporalmente
                </Button>
              </>
            )}
          </div>

          {/* Revertir */}
          {syncAnteriorId && (
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-800 dark:text-white">
                Revertir a quincena anterior
              </h3>
              <p className="text-xs text-slate-500">
                Desactiva esta quincena y reactiva{" "}
                <strong>
                  {periodoAnteriorLabel ?? "la quincena anterior"}
                </strong>
                . Los trabajadores volverán a ver las posiciones anteriores.
              </p>
              <input
                type="text"
                value={revertirText}
                onChange={(e) => setRevertirText(e.target.value)}
                placeholder="Escribe REVERTIR para confirmar"
                className="h-10 px-4 rounded-xl border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 text-sm font-bold text-red-700 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <Button
                size="sm"
                disabled={revertirText !== "REVERTIR" || loading}
                onClick={() => callRevertir("REVERTIR")}
                className="w-fit bg-red-600 hover:bg-red-700 text-white font-black"
              >
                Revertir quincena
              </Button>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive font-bold">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar types**

```bash
npm run typecheck
```

Esperado: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/bolsa/ZonaPeligro.tsx
git commit -m "feat(bolsa): ZonaPeligro — ocultar portal y revertir quincena desde panel admin"
```

---

## Task 10: Componente MovimientosTab

**Files:**

- Create: `src/components/bolsa/MovimientosTab.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/bolsa/MovimientosTab.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOMBRES_TIPOS } from "@/types/bolsa-de-trabajo";
import type {
  BolsaPosicionMaterializada,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";
import { cn } from "@/lib/utils";

interface MovimientoRow {
  matricula: string;
  nombre: string;
  tipo: TipoBolsaDeTrabajo;
  grupo: string;
  posAnterior: number | null;
  posNueva: number;
  delta: number | null;
}

interface MovimientosTabProps {
  syncId: string;
  syncAnteriorId: string | null;
  idToken: string;
}

export function MovimientosTab({
  syncId,
  syncAnteriorId,
  idToken,
}: MovimientosTabProps) {
  const [rows, setRows] = useState<MovimientoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<TipoBolsaDeTrabajo | "TODOS">(
    "TODOS",
  );
  const [filtroMovimiento, setFiltroMovimiento] = useState<
    "TODOS" | "RETROCESO" | "AVANCE"
  >("TODOS");
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar posiciones de la sync actual
      const resActual = await fetch(
        `/api/admin/bolsa/posiciones?syncId=${syncId}`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
        },
      );
      const dataActual = await resActual.json();
      const posActuales: BolsaPosicionMaterializada[] = dataActual.data ?? [];

      // Cargar posiciones de la sync anterior (si existe)
      let prevLookup = new Map<string, number>();
      if (syncAnteriorId) {
        const resAnterior = await fetch(
          `/api/admin/bolsa/posiciones?syncId=${syncAnteriorId}`,
          {
            headers: { Authorization: `Bearer ${idToken}` },
          },
        );
        const dataAnterior = await resAnterior.json();
        const posAnteriores: BolsaPosicionMaterializada[] =
          dataAnterior.data ?? [];
        for (const p of posAnteriores) {
          prevLookup.set(`${p.tipoDocumento}::${p.matricula}`, p.posicionBase);
        }
      }

      const movimientos: MovimientoRow[] = posActuales.map((p) => {
        const posAnterior =
          prevLookup.get(`${p.tipoDocumento}::${p.matricula}`) ?? null;
        const grupo = [p.grupoComparable?.zona, p.grupoComparable?.categoria]
          .filter(Boolean)
          .join(" / ");
        return {
          matricula: p.matricula,
          nombre: p.nombre,
          tipo: p.tipoDocumento,
          grupo,
          posAnterior,
          posNueva: p.posicionBase,
          delta: posAnterior !== null ? p.posicionBase - posAnterior : null,
        };
      });

      movimientos.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
      setRows(movimientos);
    } catch (err) {
      console.error("Error cargando movimientos:", err);
    } finally {
      setLoading(false);
    }
  }, [syncId, syncAnteriorId, idToken]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const rowsFiltradas = rows.filter((r) => {
    if (filtroTipo !== "TODOS" && r.tipo !== filtroTipo) return false;
    if (filtroMovimiento === "RETROCESO" && (r.delta === null || r.delta <= 0))
      return false;
    if (filtroMovimiento === "AVANCE" && (r.delta === null || r.delta >= 0))
      return false;
    if (
      busqueda &&
      !r.matricula.includes(busqueda.toUpperCase()) &&
      !r.nombre.toLowerCase().includes(busqueda.toLowerCase())
    )
      return false;
    return true;
  });

  const exportCSV = () => {
    const header = "Matricula,Nombre,Tipo,Grupo,Pos.Anterior,Pos.Nueva,Delta";
    const lines = rowsFiltradas.map(
      (r) =>
        `${r.matricula},"${r.nombre}","${NOMBRES_TIPOS[r.tipo]}","${r.grupo}",${r.posAnterior ?? ""},${r.posNueva},${r.delta ?? ""}`,
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos-${syncId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tipos = [...new Set(rows.map((r) => r.tipo))] as TipoBolsaDeTrabajo[];

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar matrícula o nombre..."
            className="h-9 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={(e) =>
            setFiltroTipo(e.target.value as TipoBolsaDeTrabajo | "TODOS")
          }
          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
        >
          <option value="TODOS">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {NOMBRES_TIPOS[t]}
            </option>
          ))}
        </select>
        <select
          value={filtroMovimiento}
          onChange={(e) =>
            setFiltroMovimiento(
              e.target.value as "TODOS" | "RETROCESO" | "AVANCE",
            )
          }
          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
        >
          <option value="TODOS">Todos</option>
          <option value="RETROCESO">Solo retrocesos</option>
          <option value="AVANCE">Solo avances</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          className="ml-auto"
        >
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <p className="text-xs text-slate-400 font-bold">
        {rowsFiltradas.length.toLocaleString()} registros
      </p>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Matrícula
              </th>
              <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Nombre
              </th>
              <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Tipo
              </th>
              <th className="text-right p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Pos. ant.
              </th>
              <th className="text-right p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Pos. nueva
              </th>
              <th className="text-right p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Delta
              </th>
            </tr>
          </thead>
          <tbody>
            {rowsFiltradas.slice(0, 200).map((r, i) => (
              <tr
                key={`${r.tipo}-${r.matricula}-${i}`}
                className="border-t border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
              >
                <td className="p-3 font-bold text-slate-600">{r.matricula}</td>
                <td className="p-3 text-slate-700 dark:text-slate-300">
                  {r.nombre}
                </td>
                <td className="p-3 text-slate-500 text-xs">
                  {NOMBRES_TIPOS[r.tipo]}
                </td>
                <td className="p-3 text-right text-slate-400">
                  {r.posAnterior ?? "—"}
                </td>
                <td className="p-3 text-right font-bold text-slate-800 dark:text-white">
                  {r.posNueva}
                </td>
                <td className="p-3 text-right font-black">
                  {r.delta === null ? (
                    <span className="text-slate-400">—</span>
                  ) : r.delta < 0 ? (
                    <span className="text-emerald-600">
                      ↑{Math.abs(r.delta)}
                    </span>
                  ) : r.delta > 0 ? (
                    <span className="text-red-500">↓{r.delta}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rowsFiltradas.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-slate-400 text-sm"
                >
                  No hay registros con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {rowsFiltradas.length > 200 && (
          <p className="p-3 text-center text-xs text-slate-400">
            Mostrando 200 de {rowsFiltradas.length.toLocaleString()} — usa los
            filtros para acotar.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar types**

```bash
npm run typecheck
```

Esperado: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/bolsa/MovimientosTab.tsx
git commit -m "feat(bolsa): MovimientosTab — diff histórico de posiciones entre quincenas con export CSV"
```

---

## Task 11: Endpoint GET /api/admin/bolsa/posiciones

El `MovimientosTab` hace fetch a `/api/admin/bolsa/posiciones?syncId=...`. Crear este endpoint.

**Files:**

- Create: `src/app/api/admin/bolsa/posiciones/route.ts`

- [ ] **Step 1: Crear el endpoint**

Crear `src/app/api/admin/bolsa/posiciones/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import type { BolsaPosicionMaterializada } from "@/types/bolsa-de-trabajo";

export const dynamic = "force-dynamic";

const POSITION_COLLECTION = "bolsa_posiciones_materializadas";

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:bolsa:posiciones",
      limit: 20,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const syncId = request.nextUrl.searchParams.get("syncId")?.trim();
    if (!syncId) {
      return NextResponse.json({ error: "syncId requerido." }, { status: 400 });
    }

    const snap = await adminDb
      .collection(POSITION_COLLECTION)
      .where("syncId", "==", syncId)
      .get();

    const data = snap.docs.map((d) => d.data() as BolsaPosicionMaterializada);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        { status: 429 },
      );
    }
    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (error?.message === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Error al cargar posiciones." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verificar types**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/bolsa/posiciones/route.ts
git commit -m "feat(bolsa): GET /api/admin/bolsa/posiciones — consulta posiciones materializadas por syncId"
```

---

## Task 12: Wire-up en quincenas/[syncId]/page.tsx

**Files:**

- Modify: `src/app/(main)/admin/bolsa-de-trabajo/quincenas/[syncId]/page.tsx`

- [ ] **Step 1: Agregar imports**

Al inicio de `quincenas/[syncId]/page.tsx`, agregar:

```typescript
import { PublicacionWizard } from "@/components/bolsa/PublicacionWizard";
import { ZonaPeligro } from "@/components/bolsa/ZonaPeligro";
import { MovimientosTab } from "@/components/bolsa/MovimientosTab";
```

- [ ] **Step 2: Agregar estado para el wizard, pestaña activa y datos de sync extendidos**

En el componente `DetalleQuincenaPage`, agregar nuevo estado después de `const [documentos, setDocumentos] = useState...`:

```typescript
const [wizardAbierto, setWizardAbierto] = useState(false);
const [idToken, setIdToken] = useState<string>("");
const [tabActiva, setTabActiva] = useState<"documentos" | "movimientos">(
  "documentos",
);
```

- [ ] **Step 3: Capturar idToken al cargar datos**

En `cargarDatos`, después de `const idToken = await currentUser.getIdToken()`, agregar:

```typescript
setIdToken(idToken);
```

- [ ] **Step 4: Agregar botón Publicar en el header**

En el header (junto al botón "Cargar", línea ~237), agregar antes del botón Cargar:

```tsx
{
  !sync.esFuenteVerdad && (
    <Button
      size="lg"
      onClick={() => setWizardAbierto(true)}
      className="h-12 rounded-2xl px-6 font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
    >
      <Rocket className="mr-2 h-5 w-5" />
      Publicar
    </Button>
  );
}
```

Agregar `Rocket` a los imports de `lucide-react`.

- [ ] **Step 5: Agregar pestañas si la sync tiene syncAnteriorId o resumenRegresion**

Después del header y antes del grid de documentos, agregar las pestañas:

```tsx
{
  (sync.esFuenteVerdad || sync.resumenRegresion) && (
    <div className="flex gap-1 p-1 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 w-fit">
      <button
        type="button"
        onClick={() => setTabActiva("documentos")}
        className={cn(
          "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
          tabActiva === "documentos"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
            : "text-slate-400 hover:text-slate-600",
        )}
      >
        Documentos
      </button>
      <button
        type="button"
        onClick={() => setTabActiva("movimientos")}
        className={cn(
          "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
          tabActiva === "movimientos"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
            : "text-slate-400 hover:text-slate-600",
        )}
      >
        Movimientos
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Renderizar contenido según pestaña activa**

Envolver el grid de documentos existente en una condición, y agregar `MovimientosTab`:

```tsx
{
  tabActiva === "documentos" && (
    <section className="flex flex-col justify-start lg:flex-1 lg:min-h-0 lg:justify-center">
      {/* ...grid existente de checklistTipos... */}
    </section>
  );
}

{
  tabActiva === "movimientos" && idToken && (
    <MovimientosTab
      syncId={syncId}
      syncAnteriorId={(sync as any).syncAnteriorId ?? null}
      idToken={idToken}
    />
  );
}
```

- [ ] **Step 7: Agregar ZonaPeligro debajo del contenido si la sync es oficial**

Al final del div principal (antes del cierre del `div.mx-auto`), agregar:

```tsx
{
  sync.esFuenteVerdad && idToken && (
    <ZonaPeligro
      syncId={syncId}
      idToken={idToken}
      oculto={(sync as any).oculto ?? false}
      syncAnteriorId={(sync as any).syncAnteriorId ?? null}
      onOcultarChange={(val) =>
        setSync((prev) => (prev ? ({ ...prev, oculto: val } as any) : prev))
      }
      onRevertir={() => router.push("/admin/bolsa-de-trabajo")}
    />
  );
}
```

- [ ] **Step 8: Agregar modal/overlay del wizard**

Al final del componente, antes del cierre del JSX raíz, agregar:

```tsx
{
  wizardAbierto && idToken && (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-950 rounded-3xl p-8 my-auto shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
            Publicar quincena
          </h1>
          <button
            type="button"
            onClick={() => setWizardAbierto(false)}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none font-bold"
          >
            ×
          </button>
        </div>
        <PublicacionWizard
          syncId={syncId}
          idToken={idToken}
          onSuccess={() => {
            setWizardAbierto(false);
            cargarDatos();
          }}
          onCancel={() => setWizardAbierto(false)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Verificar types**

```bash
npm run typecheck
```

Esperado: 0 errores.

- [ ] **Step 10: Correr todos los tests**

```bash
npm test --run
```

Esperado: todos los tests pasan.

- [ ] **Step 11: Commit final**

```bash
git add src/app/(main)/admin/bolsa-de-trabajo/quincenas/[syncId]/page.tsx
git commit -m "feat(bolsa): wizard de publicación, zona de peligro y tab de movimientos en detalle de quincena"
```

---

## Verificación end-to-end

- [ ] Correr `npm run dev` y navegar a `/admin/bolsa-de-trabajo/quincenas/[algún-syncId]`
- [ ] Verificar que aparece el botón "Publicar" si la sync no es oficial
- [ ] Hacer clic en "Publicar" → abre wizard → paso 1 carga documentos
- [ ] Completar los 4 pasos sin errores en consola
- [ ] Verificar que al publicar, en Firestore `sincronizaciones/{syncId}` tiene `syncAnteriorId` y `resumenRegresion`
- [ ] Verificar que la pestaña "Movimientos" carga y muestra la tabla
- [ ] Verificar que la zona de peligro aparece cuando `esFuenteVerdad = true`
- [ ] Verificar que "Ocultar portal" setea `oculto: true` y el portal retorna 503

- [ ] **Commit de verificación**

```bash
npm run check
git add -A
git commit -m "feat(bolsa): sistema de validación y seguridad en publicación — completo"
```
