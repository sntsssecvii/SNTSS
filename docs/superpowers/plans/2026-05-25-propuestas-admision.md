# Propuestas Sindicales — Admisión y Cambios: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Digitalizar el flujo de propuestas sindicales para la Oficina de Admisión y Cambios — formulario público de solicitud, dashboard de revisión, asignación a requerimientos y PDF imprimible.

**Architecture:** Formulario público `/solicitud` (sin auth) crea docs en Firestore con warnings pre-calculados. Dashboard admin en `/admin/propuestas` con 3 pestañas. API Routes con Firebase Admin SDK para todas las mutaciones de estado. Warnings son informativos, nunca bloquean el registro.

**Tech Stack:** Next.js 14 App Router, Firebase Admin SDK (server), Firebase Client SDK (client), Vitest (tests), Tailwind + Radix UI (UI), Zod (validación).

---

## Mapa de archivos

| Acción     | Archivo                                               |
| ---------- | ----------------------------------------------------- |
| Reemplazar | `src/types/propuestas.ts`                             |
| Reemplazar | `src/types/workflow.ts`                               |
| Modificar  | `src/types/roles.ts`                                  |
| Modificar  | `src/lib/auth/roles.ts`                               |
| Reemplazar | `src/lib/firebase/propuestas.ts`                      |
| Crear      | `src/lib/firebase/contadores.ts`                      |
| Crear      | `src/lib/firebase/requerimientos.ts`                  |
| Crear      | `src/lib/firebase/asignaciones.ts`                    |
| Crear      | `src/lib/propuestas/warnings.ts`                      |
| Crear      | `src/lib/propuestas/__tests__/warnings.test.ts`       |
| Crear      | `src/app/(public)/layout.tsx`                         |
| Crear      | `src/app/(public)/solicitud/page.tsx`                 |
| Crear      | `src/app/api/propuestas/verificar-matricula/route.ts` |
| Crear      | `src/app/api/propuestas/route.ts`                     |
| Crear      | `src/app/api/propuestas/[id]/aprobar/route.ts`        |
| Crear      | `src/app/api/propuestas/[id]/rechazar/route.ts`       |
| Crear      | `src/app/api/requerimientos/route.ts`                 |
| Crear      | `src/app/api/asignaciones/route.ts`                   |
| Crear      | `src/app/(main)/admin/propuestas/page.tsx`            |
| Crear      | `src/app/(main)/admin/propuestas/[id]/page.tsx`       |
| Crear      | `src/app/(main)/admin/propuestas/[id]/print/page.tsx` |
| Crear      | `src/components/propuestas/SolicitudForm.tsx`         |
| Crear      | `src/components/propuestas/PropuestasDashboard.tsx`   |
| Crear      | `src/components/propuestas/CasoDetalle.tsx`           |
| Modificar  | `docs/firestore-schema.md`                            |

---

## Task 1: Tipos — propuestas, workflow, requerimientos, asignaciones

**Files:**

- Reemplazar: `src/types/propuestas.ts`
- Reemplazar: `src/types/workflow.ts`
- Crear: `src/types/requerimientos.ts`
- Crear: `src/types/asignaciones.ts`

- [ ] **Step 1: Reemplazar `src/types/workflow.ts`**

```typescript
// src/types/workflow.ts
import type { Timestamp } from "firebase/firestore";

export type EstadoPropuesta = "PENDIENTE" | "APROBADA" | "RECHAZADA";
export type EstadoFase2 = "SIN_ASIGNAR" | "ASIGNADA" | "DEVUELTA";
export type TipoEvento =
  | "CREADA"
  | "APROBADA"
  | "RECHAZADA"
  | "ASIGNADA"
  | "DEVUELTA";

export interface EventoHistorial {
  fecha: Timestamp;
  tipo: TipoEvento;
  usuarioId: string;
  nota: string | null;
}
```

- [ ] **Step 2: Reemplazar `src/types/propuestas.ts`**

```typescript
// src/types/propuestas.ts
import type { Timestamp } from "firebase/firestore";
import type { EstadoPropuesta, EstadoFase2, EventoHistorial } from "./workflow";

export type Parentesco = "Hijo" | "Hija" | "Cónyuge" | "Otro";

export interface Aspirante {
  nombreCompleto: string;
  curp: string;
  parentesco: Parentesco | null;
  telefono: string;
}

export interface WarningsPropuesta {
  propuestaActivaExistente: boolean;
  sinRequerimientoDisponible: boolean;
  curpDuplicado: boolean;
  categoriaIncompatible: boolean;
  documentoFaltante: boolean;
}

export interface Propuesta {
  id?: string;
  numeroCaso: string;
  folio: string | null;
  estado: EstadoPropuesta;
  estadoFase2: EstadoFase2 | null;
  motivoRechazo: string | null;
  matricula: string;
  sinFamiliar: boolean;
  aspirante: Aspirante | null;
  documentos: { ineUrl: string | null };
  warnings: WarningsPropuesta;
  historial: EventoHistorial[];
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

export const CATEGORIAS_PROPUESTA = [
  "Asistente Médica",
  "Aux. Admon en UM",
  "Aux. de Almacen",
  "Aux. de Farmacia",
  "Aux. de Laboratorio",
  "Aux. Serv. Grales UM",
  "Aux. Serv. Intenden.",
  "Aux. Serv. Admtvos.",
  "Aux. Trabajo Social",
  "Aux. Univ. De Ofna.",
  "Chofer",
  "Laboratorio",
  "Manejador de Alim.",
  "Mensajero",
  "Oficial de Puericultura",
  "Op. De Ambulancias",
  "Op. De Lavanderia",
  "Tec. Polivalente",
  "Tec. Radióloga",
  "Trabajo Social",
  "Nutricionista Dietista",
  "Estomatólogo",
  "Psicólogo",
  "Medico General",
  "Aux. Enf. Gral",
  "Enfermera Gral",
] as const;

export type CategoriaPropuesta = (typeof CATEGORIAS_PROPUESTA)[number];

export const validarCURP = (curp: string): boolean => {
  if (!curp) return false;
  const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;
  return curpRegex.test(curp.toUpperCase());
};

export const validarTelefono = (telefono: string): boolean => {
  if (!telefono) return false;
  return /^\d{10}$/.test(telefono.replace(/\D/g, ""));
};
```

- [ ] **Step 3: Crear `src/types/requerimientos.ts`**

```typescript
// src/types/requerimientos.ts
import type { Timestamp } from "firebase/firestore";

export interface Partida {
  zona: string;
  categoria: string;
  cantidadTotal: number;
  cantidadDisponible: number;
}

export interface Requerimiento {
  id?: string;
  numeroOficio: string;
  fechaCircular: Timestamp;
  estado: "ACTIVO" | "CERRADO";
  partidas: Partida[];
  creadoPor: string;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
```

- [ ] **Step 4: Crear `src/types/asignaciones.ts`**

```typescript
// src/types/asignaciones.ts
import type { Timestamp } from "firebase/firestore";

export interface Asignacion {
  id?: string;
  propuestaId: string;
  requerimientoId: string;
  zona: string;
  categoria: string;
  estado: "ACTIVA" | "DEVUELTA";
  asignadoPor: string;
  asignadoEn: Timestamp;
}
```

- [ ] **Step 5: Verificar tipos compilan**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run typecheck 2>&1 | head -40
```

Esperado: solo errores por imports de tipos viejos en archivos que aún no se han tocado (propuestas.ts lib). Ignorar por ahora.

- [ ] **Step 6: Commit**

```bash
git add src/types/propuestas.ts src/types/workflow.ts src/types/requerimientos.ts src/types/asignaciones.ts
git commit -m "feat(propuestas): tipos — Propuesta, Requerimiento, Asignacion, workflow"
```

---

## Task 2: RBAC — agregar rol ADMISION

**Files:**

- Modificar: `src/types/roles.ts`
- Modificar: `src/lib/auth/roles.ts`

- [ ] **Step 1: Agregar `ADMISION` al enum en `src/types/roles.ts`**

En el `enum ROLES` (línea ~1), agregar después de `ESCALAFON`:

```typescript
ADMISION = "ADMISION",
```

En `PERMISOS_POR_ROL` (línea ~62), agregar la entrada del rol antes de `[ROLES.USER]`:

```typescript
[ROLES.ADMISION]: [
  PERMISOS.CREAR_PROPUESTA,
  PERMISOS.VER_PROPUESTA,
  PERMISOS.APROBAR_PROPUESTA,
  PERMISOS.RECHAZAR_PROPUESTA,
],
```

- [ ] **Step 2: Actualizar `isAdminRole` en `src/lib/auth/roles.ts`**

En la función `isAdminRole` (línea ~11), agregar `ADMISION`:

```typescript
export function isAdminRole(role?: string | null): boolean {
  const normalized = normalizeUserRole(role);
  return (
    normalized === ROLES.ADMIN ||
    normalized === ROLES.SUPER_ADMIN ||
    normalized === ROLES.BOLSA ||
    normalized === ROLES.ESCALAFON ||
    normalized === ROLES.CAPTURISTA ||
    normalized === ROLES.ADMISION
  );
}
```

Agregar también `isAdmisionRole` al final del archivo:

```typescript
export function isAdmisionRole(role?: string | null): boolean {
  const normalized = normalizeUserRole(role);
  return (
    normalized === ROLES.ADMISION ||
    normalized === ROLES.ADMIN ||
    normalized === ROLES.SUPER_ADMIN
  );
}
```

Agregar en `getHomeRouteForRole` antes del `return null`:

```typescript
if (normalized === ROLES.ADMISION) {
  return "/admin/propuestas";
}
```

Agregar en `getRoleLabel`:

```typescript
case ROLES.ADMISION:
  return "Admisión y Cambios";
```

- [ ] **Step 3: Verificar**

```bash
npm run typecheck 2>&1 | grep -i "admision\|ADMISION" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/types/roles.ts src/lib/auth/roles.ts
git commit -m "feat(rbac): agregar rol ADMISION con permisos de propuestas"
```

---

## Task 3: Data layer — contadores (transacciones folio/caso)

**Files:**

- Crear: `src/lib/firebase/contadores.ts`

- [ ] **Step 1: Crear `src/lib/firebase/contadores.ts`**

```typescript
// src/lib/firebase/contadores.ts
// Solo para uso en servidor (API Routes) — usa firebase-admin
import { adminDb } from "./admin";
import { FieldValue } from "firebase-admin/firestore";

const CONTADOR_DOC = "contadores/propuestas";

interface ContadorPropuestas {
  ultimoCaso: number;
  ultimoFolio: number;
  anio: number;
}

/**
 * Genera un numeroCaso único en formato "CASO-YYYY-NNNN".
 * Ejecuta en transacción para garantizar unicidad.
 */
export async function generarNumeroCaso(): Promise<string> {
  const anioActual = new Date().getFullYear();
  const ref = adminDb.doc(CONTADOR_DOC);

  const numero = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as ContadorPropuestas | undefined;
    const anioDoc = data?.anio ?? anioActual;
    const base = anioDoc === anioActual ? (data?.ultimoCaso ?? 0) : 0;
    const siguiente = base + 1;
    tx.set(ref, { ultimoCaso: siguiente, anio: anioActual }, { merge: true });
    return siguiente;
  });

  return `CASO-${anioActual}-${String(numero).padStart(4, "0")}`;
}

/**
 * Genera un folio oficial único en formato "YYYY-NNNN".
 * Solo llamar al APROBAR una propuesta.
 */
export async function generarFolio(): Promise<string> {
  const anioActual = new Date().getFullYear();
  const ref = adminDb.doc(CONTADOR_DOC);

  const numero = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as ContadorPropuestas | undefined;
    const anioDoc = data?.anio ?? anioActual;
    const base = anioDoc === anioActual ? (data?.ultimoFolio ?? 0) : 0;
    const siguiente = base + 1;
    tx.set(ref, { ultimoFolio: siguiente, anio: anioActual }, { merge: true });
    return siguiente;
  });

  return `${anioActual}-${String(numero).padStart(4, "0")}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/firebase/contadores.ts
git commit -m "feat(propuestas): contadores Firestore para numeroCaso y folio en transacción"
```

---

## Task 4: Data layer — propuestas lib (reemplazar)

**Files:**

- Reemplazar: `src/lib/firebase/propuestas.ts`

- [ ] **Step 1: Reemplazar `src/lib/firebase/propuestas.ts`**

```typescript
// src/lib/firebase/propuestas.ts
// Solo para uso en servidor (API Routes) — usa firebase-admin
import { adminDb } from "./admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type {
  Propuesta,
  WarningsPropuesta,
  Aspirante,
} from "@/types/propuestas";
import type {
  EstadoPropuesta,
  EstadoFase2,
  EventoHistorial,
} from "@/types/workflow";

const COL = "propuestas";

export async function createPropuesta(data: {
  numeroCaso: string;
  matricula: string;
  sinFamiliar: boolean;
  aspirante: Aspirante | null;
  ineUrl: string | null;
  warnings: WarningsPropuesta;
  usuarioId: string;
}): Promise<string> {
  const ahora = Timestamp.now();
  const evento: EventoHistorial = {
    fecha: ahora,
    tipo: "CREADA",
    usuarioId: data.usuarioId,
    nota: null,
  };
  const doc = {
    numeroCaso: data.numeroCaso,
    folio: null,
    estado: "PENDIENTE" as EstadoPropuesta,
    estadoFase2: null,
    motivoRechazo: null,
    matricula: data.matricula,
    sinFamiliar: data.sinFamiliar,
    aspirante: data.aspirante,
    documentos: { ineUrl: data.ineUrl },
    warnings: data.warnings,
    historial: [evento],
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
  const ref = await adminDb.collection(COL).add(doc);
  return ref.id;
}

export async function getPropuestaById(
  id: string,
): Promise<(Propuesta & { id: string }) | null> {
  const snap = await adminDb.collection(COL).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Propuesta) };
}

export interface FiltroPropuestas {
  estado?: EstadoPropuesta;
  limit?: number;
}

export async function listPropuestas(
  filtros: FiltroPropuestas = {},
): Promise<(Propuesta & { id: string })[]> {
  let q = adminDb
    .collection(COL)
    .orderBy("creadoEn", "desc") as FirebaseFirestore.Query;
  if (filtros.estado) {
    q = q.where("estado", "==", filtros.estado);
  }
  if (filtros.limit) {
    q = q.limit(filtros.limit);
  }
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Propuesta) }));
}

export async function aprobarPropuesta(
  id: string,
  folio: string,
  usuarioId: string,
): Promise<void> {
  const ahora = Timestamp.now();
  const evento: EventoHistorial = {
    fecha: ahora,
    tipo: "APROBADA",
    usuarioId,
    nota: null,
  };
  await adminDb
    .collection(COL)
    .doc(id)
    .update({
      estado: "APROBADA",
      folio,
      estadoFase2: "SIN_ASIGNAR",
      actualizadoEn: ahora,
      historial: FieldValue.arrayUnion(evento),
    });
}

export async function rechazarPropuesta(
  id: string,
  motivo: string,
  usuarioId: string,
): Promise<void> {
  const ahora = Timestamp.now();
  const evento: EventoHistorial = {
    fecha: ahora,
    tipo: "RECHAZADA",
    usuarioId,
    nota: motivo,
  };
  await adminDb
    .collection(COL)
    .doc(id)
    .update({
      estado: "RECHAZADA",
      motivoRechazo: motivo,
      actualizadoEn: ahora,
      historial: FieldValue.arrayUnion(evento),
    });
}

export async function propuestaActivaPorMatricula(
  matricula: string,
): Promise<(Propuesta & { id: string }) | null> {
  const snap = await adminDb
    .collection(COL)
    .where("matricula", "==", matricula)
    .where("estado", "in", ["PENDIENTE", "APROBADA"])
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Propuesta) };
}

export async function curpExisteEnPropuestasActivas(
  curp: string,
): Promise<boolean> {
  const snap = await adminDb
    .collection(COL)
    .where("aspirante.curp", "==", curp.toUpperCase())
    .where("estado", "in", ["PENDIENTE", "APROBADA"])
    .limit(1)
    .get();
  return !snap.empty;
}
```

- [ ] **Step 2: Verificar**

```bash
npm run typecheck 2>&1 | grep "propuestas" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase/propuestas.ts
git commit -m "feat(propuestas): reemplazar lib firebase/propuestas con nuevo modelo"
```

---

## Task 5: Data layer — requerimientos y asignaciones

**Files:**

- Crear: `src/lib/firebase/requerimientos.ts`
- Crear: `src/lib/firebase/asignaciones.ts`

- [ ] **Step 1: Crear `src/lib/firebase/requerimientos.ts`**

```typescript
// src/lib/firebase/requerimientos.ts
import { adminDb } from "./admin";
import { Timestamp } from "firebase-admin/firestore";
import type { Requerimiento, Partida } from "@/types/requerimientos";

const COL = "requerimientos";

export async function createRequerimiento(data: {
  numeroOficio: string;
  fechaCircular: Date;
  partidas: Omit<Partida, "cantidadDisponible">[];
  creadoPor: string;
}): Promise<string> {
  const ahora = Timestamp.now();
  const partidas: Partida[] = data.partidas.map((p) => ({
    ...p,
    cantidadDisponible: p.cantidadTotal,
  }));
  const doc = {
    numeroOficio: data.numeroOficio,
    fechaCircular: Timestamp.fromDate(data.fechaCircular),
    estado: "ACTIVO" as const,
    partidas,
    creadoPor: data.creadoPor,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
  const ref = await adminDb.collection(COL).add(doc);
  return ref.id;
}

export async function listRequerimientos(): Promise<
  (Requerimiento & { id: string })[]
> {
  const snap = await adminDb.collection(COL).orderBy("creadoEn", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Requerimiento) }));
}

export async function getRequerimientosActivos(): Promise<
  (Requerimiento & { id: string })[]
> {
  const snap = await adminDb
    .collection(COL)
    .where("estado", "==", "ACTIVO")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Requerimiento) }));
}

/**
 * Decrementa cantidadDisponible en la partida indicada (por zona+categoria) en transacción.
 * Lanza error si no hay disponibilidad.
 */
export async function decrementarPartida(
  requerimientoId: string,
  zona: string,
  categoria: string,
): Promise<void> {
  const ref = adminDb.collection(COL).doc(requerimientoId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("REQUERIMIENTO_NOT_FOUND");
    const data = snap.data() as Requerimiento;
    const idx = data.partidas.findIndex(
      (p) => p.zona === zona && p.categoria === categoria,
    );
    if (idx === -1) throw new Error("PARTIDA_NOT_FOUND");
    if (data.partidas[idx].cantidadDisponible <= 0)
      throw new Error("SIN_DISPONIBILIDAD");
    const partidas = [...data.partidas];
    partidas[idx] = {
      ...partidas[idx],
      cantidadDisponible: partidas[idx].cantidadDisponible - 1,
    };
    tx.update(ref, { partidas, actualizadoEn: Timestamp.now() });
  });
}
```

- [ ] **Step 2: Crear `src/lib/firebase/asignaciones.ts`**

```typescript
// src/lib/firebase/asignaciones.ts
import { adminDb } from "./admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { Asignacion } from "@/types/asignaciones";
import type { EventoHistorial } from "@/types/workflow";

const COL_ASIG = "asignaciones";
const COL_PROP = "propuestas";

export async function crearAsignacion(data: {
  propuestaId: string;
  requerimientoId: string;
  zona: string;
  categoria: string;
  asignadoPor: string;
}): Promise<string> {
  const ahora = Timestamp.now();
  const doc: Omit<Asignacion, "id"> = {
    propuestaId: data.propuestaId,
    requerimientoId: data.requerimientoId,
    zona: data.zona,
    categoria: data.categoria,
    estado: "ACTIVA",
    asignadoPor: data.asignadoPor,
    asignadoEn: ahora,
  };
  const ref = await adminDb.collection(COL_ASIG).add(doc);

  // Actualizar estadoFase2 en la propuesta
  const evento: EventoHistorial = {
    fecha: ahora,
    tipo: "ASIGNADA",
    usuarioId: data.asignadoPor,
    nota: `Requerimiento: ${data.requerimientoId}`,
  };
  await adminDb
    .collection(COL_PROP)
    .doc(data.propuestaId)
    .update({
      estadoFase2: "ASIGNADA",
      actualizadoEn: ahora,
      historial: FieldValue.arrayUnion(evento),
    });

  return ref.id;
}

export async function listAsignaciones(): Promise<
  (Asignacion & { id: string })[]
> {
  const snap = await adminDb
    .collection(COL_ASIG)
    .orderBy("asignadoEn", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Asignacion) }));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase/requerimientos.ts src/lib/firebase/asignaciones.ts
git commit -m "feat(propuestas): data layer — requerimientos y asignaciones"
```

---

## Task 6: Warnings engine con tests

**Files:**

- Crear: `src/lib/propuestas/warnings.ts`
- Crear: `src/lib/propuestas/__tests__/warnings.test.ts`

- [ ] **Step 1: Escribir tests primero**

```typescript
// src/lib/propuestas/__tests__/warnings.test.ts
import { describe, it, expect } from "vitest";
import { calcularWarnings } from "../warnings";
import type { InputWarnings } from "../warnings";

const base: InputWarnings = {
  propuestaActivaExistente: false,
  curpExisteEnActivas: false,
  hayRequerimientoDisponible: true,
  ineSubida: true,
};

describe("calcularWarnings", () => {
  it("sin problemas — todos false excepto sinRequerimientoDisponible que invierte hayRequerimiento", () => {
    const result = calcularWarnings(base);
    expect(result.propuestaActivaExistente).toBe(false);
    expect(result.curpDuplicado).toBe(false);
    expect(result.sinRequerimientoDisponible).toBe(false);
    expect(result.documentoFaltante).toBe(false);
    expect(result.categoriaIncompatible).toBe(false);
  });

  it("propuesta activa existente", () => {
    const result = calcularWarnings({
      ...base,
      propuestaActivaExistente: true,
    });
    expect(result.propuestaActivaExistente).toBe(true);
  });

  it("curp duplicado en activas", () => {
    const result = calcularWarnings({ ...base, curpExisteEnActivas: true });
    expect(result.curpDuplicado).toBe(true);
  });

  it("sin requerimiento disponible", () => {
    const result = calcularWarnings({
      ...base,
      hayRequerimientoDisponible: false,
    });
    expect(result.sinRequerimientoDisponible).toBe(true);
  });

  it("documento faltante (INE no subida)", () => {
    const result = calcularWarnings({ ...base, ineSubida: false });
    expect(result.documentoFaltante).toBe(true);
  });

  it("puede tener múltiples warnings simultáneos", () => {
    const result = calcularWarnings({
      propuestaActivaExistente: true,
      curpExisteEnActivas: true,
      hayRequerimientoDisponible: false,
      ineSubida: false,
    });
    expect(result.propuestaActivaExistente).toBe(true);
    expect(result.curpDuplicado).toBe(true);
    expect(result.sinRequerimientoDisponible).toBe(true);
    expect(result.documentoFaltante).toBe(true);
  });

  it("tieneAlgunWarning — true si al menos uno activo", () => {
    const { tieneAlgunWarning } = calcularWarnings({
      ...base,
      propuestaActivaExistente: true,
    });
    expect(tieneAlgunWarning).toBe(true);
  });

  it("tieneAlgunWarning — false si ninguno activo", () => {
    const { tieneAlgunWarning } = calcularWarnings(base);
    expect(tieneAlgunWarning).toBe(false);
  });
});
```

- [ ] **Step 2: Correr test — verificar que falla**

```bash
npm test src/lib/propuestas/__tests__/warnings.test.ts 2>&1 | tail -15
```

Esperado: `Cannot find module '../warnings'`

- [ ] **Step 3: Implementar `src/lib/propuestas/warnings.ts`**

```typescript
// src/lib/propuestas/warnings.ts
import type { WarningsPropuesta } from "@/types/propuestas";

export interface InputWarnings {
  propuestaActivaExistente: boolean;
  curpExisteEnActivas: boolean;
  hayRequerimientoDisponible: boolean;
  ineSubida: boolean;
}

export function calcularWarnings(
  input: InputWarnings,
): WarningsPropuesta & { tieneAlgunWarning: boolean } {
  const warnings: WarningsPropuesta = {
    propuestaActivaExistente: input.propuestaActivaExistente,
    sinRequerimientoDisponible: !input.hayRequerimientoDisponible,
    curpDuplicado: input.curpExisteEnActivas,
    categoriaIncompatible: false, // reservado para lógica futura de zona/categoría
    documentoFaltante: !input.ineSubida,
  };
  const tieneAlgunWarning = Object.values(warnings).some(Boolean);
  return { ...warnings, tieneAlgunWarning };
}
```

- [ ] **Step 4: Correr tests — verificar que pasan**

```bash
npm test src/lib/propuestas/__tests__/warnings.test.ts 2>&1 | tail -15
```

Esperado: 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/propuestas/warnings.ts src/lib/propuestas/__tests__/warnings.test.ts
git commit -m "feat(propuestas): warnings engine con tests — 7 casos cubiertos"
```

---

## Task 7: API — verificar-matricula (pública)

**Files:**

- Crear: `src/app/api/propuestas/verificar-matricula/route.ts`

- [ ] **Step 1: Crear el route**

```typescript
// src/app/api/propuestas/verificar-matricula/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { propuestaActivaPorMatricula } from "@/lib/firebase/propuestas";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:propuestas:verificar",
      limit: 20,
      windowMs: 60_000,
    });

    const body = await request.json();
    const matricula = String(body?.matricula || "")
      .trim()
      .toUpperCase();

    if (!matricula || matricula.length < 4) {
      return NextResponse.json(
        { error: "Matrícula inválida." },
        { status: 400 },
      );
    }

    // Verificar que existe en padrón (colección users)
    const usersSnap = await adminDb
      .collection("users")
      .where("matricula", "==", matricula)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (usersSnap.empty) {
      return NextResponse.json({
        valida: false,
        razon: "matricula_no_encontrada",
      });
    }

    // Verificar que no tiene propuesta activa
    const propuestaActiva = await propuestaActivaPorMatricula(matricula);
    if (propuestaActiva) {
      return NextResponse.json({
        valida: false,
        razon: "propuesta_activa",
        numeroCaso: propuestaActiva.numeroCaso,
      });
    }

    return NextResponse.json({ valida: true });
  } catch (error: any) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }
    console.error("[verificar-matricula]", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/propuestas/verificar-matricula/route.ts
git commit -m "feat(propuestas): api verificar-matricula — valida padrón sin exponer datos"
```

---

## Task 8: API — propuestas GET y POST

**Files:**

- Crear: `src/app/api/propuestas/route.ts`

- [ ] **Step 1: Crear route**

```typescript
// src/app/api/propuestas/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import { adminStorage } from "@/lib/firebase/admin";
import {
  createPropuesta,
  listPropuestas,
  propuestaActivaPorMatricula,
  curpExisteEnPropuestasActivas,
} from "@/lib/firebase/propuestas";
import { getRequerimientosActivos } from "@/lib/firebase/requerimientos";
import { generarNumeroCaso } from "@/lib/firebase/contadores";
import { calcularWarnings } from "@/lib/propuestas/warnings";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { z } from "zod";
import type { EstadoPropuesta } from "@/types/workflow";

export const dynamic = "force-dynamic";

const MAX_INE_BYTES = 5 * 1024 * 1024;

// GET — listar propuestas (solo admin/admision)
export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:propuestas:list",
      limit: 60,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role)) {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }
    const url = new URL(request.url);
    const estado = url.searchParams.get("estado") as EstadoPropuesta | null;
    const propuestas = await listPropuestas(estado ? { estado } : {});
    return NextResponse.json({ propuestas });
  } catch (error: any) {
    return handleError(error);
  }
}

// POST — crear propuesta desde formulario público (sin auth)
const CrearSchema = z.object({
  matricula: z.string().min(4).max(20),
  sinFamiliar: z.boolean().default(false),
  aspirante: z
    .object({
      nombreCompleto: z.string().min(2).max(120),
      curp: z.string().length(18),
      parentesco: z.enum(["Hijo", "Hija", "Cónyuge", "Otro"]).nullable(),
      telefono: z.string().regex(/^\d{10}$/),
    })
    .nullable(),
});

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:propuestas:create",
      limit: 5,
      windowMs: 60_000,
    });

    const formData = await request.formData();
    const raw = {
      matricula: formData.get("matricula"),
      sinFamiliar: formData.get("sinFamiliar") === "true",
      aspirante: formData.get("aspirante")
        ? JSON.parse(String(formData.get("aspirante")))
        : null,
    };
    const parsed = CrearSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos.", detalles: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { matricula, sinFamiliar, aspirante } = parsed.data;

    // Subir INE si viene
    let ineUrl: string | null = null;
    const ineFile = formData.get("ine") as File | null;
    if (ineFile && ineFile.size > 0) {
      if (ineFile.size > MAX_INE_BYTES) {
        return NextResponse.json(
          { error: "El archivo INE excede 5 MB." },
          { status: 400 },
        );
      }
      const buffer = Buffer.from(await ineFile.arrayBuffer());
      const destination = `propuestas/ine/${matricula}-${Date.now()}-${ineFile.name}`;
      const fileRef = adminStorage.bucket().file(destination);
      await fileRef.save(buffer, { metadata: { contentType: ineFile.type } });
      await fileRef.makePublic();
      ineUrl = `https://storage.googleapis.com/${adminStorage.bucket().name}/${destination}`;
    }

    // Calcular warnings
    const propuestaActiva = await propuestaActivaPorMatricula(matricula);
    const curpDuplicado = aspirante?.curp
      ? await curpExisteEnPropuestasActivas(aspirante.curp)
      : false;
    const requerimientos = await getRequerimientosActivos();
    const hayRequerimiento = requerimientos.some((r) =>
      r.partidas.some((p) => p.cantidadDisponible > 0),
    );

    const warnings = calcularWarnings({
      propuestaActivaExistente: Boolean(propuestaActiva),
      curpExisteEnActivas: curpDuplicado,
      hayRequerimientoDisponible: hayRequerimiento,
      ineSubida: Boolean(ineUrl) || sinFamiliar,
    });

    const numeroCaso = await generarNumeroCaso();
    const id = await createPropuesta({
      numeroCaso,
      matricula,
      sinFamiliar,
      aspirante,
      ineUrl,
      warnings,
      usuarioId: "publico",
    });

    return NextResponse.json({ id, numeroCaso }, { status: 201 });
  } catch (error: any) {
    return handleError(error);
  }
}

function handleError(error: any) {
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      {
        status: 429,
        headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
      },
    );
  }
  if (error?.message === "AUTH_REQUIRED")
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (error?.message === "ADMIN_REQUIRED")
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  console.error("[api/propuestas]", error);
  return NextResponse.json({ error: "Error interno." }, { status: 500 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/propuestas/route.ts
git commit -m "feat(propuestas): api propuestas GET+POST con warnings y upload INE"
```

---

## Task 9: API — aprobar y rechazar

**Files:**

- Crear: `src/app/api/propuestas/[id]/aprobar/route.ts`
- Crear: `src/app/api/propuestas/[id]/rechazar/route.ts`

- [ ] **Step 1: Crear route de aprobar**

```typescript
// src/app/api/propuestas/[id]/aprobar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import { getPropuestaById, aprobarPropuesta } from "@/lib/firebase/propuestas";
import { generarFolio } from "@/lib/firebase/contadores";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    enforceRateLimit(request, {
      bucket: "api:propuestas:aprobar",
      limit: 30,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role)) {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }

    const propuesta = await getPropuestaById(params.id);
    if (!propuesta)
      return NextResponse.json(
        { error: "Propuesta no encontrada." },
        { status: 404 },
      );
    if (propuesta.estado !== "PENDIENTE") {
      return NextResponse.json(
        { error: "Solo se pueden aprobar propuestas PENDIENTES." },
        { status: 422 },
      );
    }

    const folio = await generarFolio();
    await aprobarPropuesta(params.id, folio, adminUser.uid);

    return NextResponse.json({ folio });
  } catch (error: any) {
    if (error instanceof RateLimitError)
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        { status: 429 },
      );
    if (error?.message === "AUTH_REQUIRED")
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    if (error?.message === "ADMIN_REQUIRED")
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    console.error("[aprobar]", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Crear route de rechazar**

```typescript
// src/app/api/propuestas/[id]/rechazar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import { getPropuestaById, rechazarPropuesta } from "@/lib/firebase/propuestas";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({ motivo: z.string().min(10).max(500) });

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    enforceRateLimit(request, {
      bucket: "api:propuestas:rechazar",
      limit: 30,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role)) {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "El motivo es requerido (mín. 10 caracteres)." },
        { status: 400 },
      );
    }

    const propuesta = await getPropuestaById(params.id);
    if (!propuesta)
      return NextResponse.json(
        { error: "Propuesta no encontrada." },
        { status: 404 },
      );
    if (propuesta.estado !== "PENDIENTE") {
      return NextResponse.json(
        { error: "Solo se pueden rechazar propuestas PENDIENTES." },
        { status: 422 },
      );
    }

    await rechazarPropuesta(params.id, parsed.data.motivo, adminUser.uid);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof RateLimitError)
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        { status: 429 },
      );
    if (error?.message === "AUTH_REQUIRED")
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    if (error?.message === "ADMIN_REQUIRED")
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    console.error("[rechazar]", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/propuestas/[id]/aprobar/route.ts src/app/api/propuestas/[id]/rechazar/route.ts
git commit -m "feat(propuestas): api aprobar y rechazar con folio en transacción"
```

---

## Task 10: API — requerimientos y asignaciones

**Files:**

- Crear: `src/app/api/requerimientos/route.ts`
- Crear: `src/app/api/asignaciones/route.ts`

- [ ] **Step 1: Crear `src/app/api/requerimientos/route.ts`**

```typescript
// src/app/api/requerimientos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import {
  createRequerimiento,
  listRequerimientos,
} from "@/lib/firebase/requerimientos";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PartidaSchema = z.object({
  zona: z.string().min(1),
  categoria: z.string().min(1),
  cantidadTotal: z.number().int().positive(),
});

const CrearSchema = z.object({
  numeroOficio: z.string().min(1).max(80),
  fechaCircular: z.string().datetime(),
  partidas: z.array(PartidaSchema).min(1),
});

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:requerimientos:list",
      limit: 60,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role))
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const requerimientos = await listRequerimientos();
    return NextResponse.json({ requerimientos });
  } catch (error: any) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:requerimientos:create",
      limit: 20,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role))
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const body = await request.json();
    const parsed = CrearSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Datos inválidos.", detalles: parsed.error.flatten() },
        { status: 400 },
      );
    const id = await createRequerimiento({
      ...parsed.data,
      fechaCircular: new Date(parsed.data.fechaCircular),
      creadoPor: adminUser.uid,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error: any) {
    return handleError(error);
  }
}

function handleError(error: any) {
  if (error instanceof RateLimitError)
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      { status: 429 },
    );
  if (error?.message === "AUTH_REQUIRED")
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (error?.message === "ADMIN_REQUIRED")
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  console.error("[api/requerimientos]", error);
  return NextResponse.json({ error: "Error interno." }, { status: 500 });
}
```

- [ ] **Step 2: Crear `src/app/api/asignaciones/route.ts`**

```typescript
// src/app/api/asignaciones/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import { crearAsignacion, listAsignaciones } from "@/lib/firebase/asignaciones";
import { decrementarPartida } from "@/lib/firebase/requerimientos";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CrearSchema = z.object({
  propuestaId: z.string().min(1),
  requerimientoId: z.string().min(1),
  zona: z.string().min(1),
  categoria: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:asignaciones:list",
      limit: 60,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role))
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const asignaciones = await listAsignaciones();
    return NextResponse.json({ asignaciones });
  } catch (error: any) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:asignaciones:create",
      limit: 30,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role))
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const body = await request.json();
    const parsed = CrearSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    // Decrementar disponibilidad en transacción antes de crear asignación
    await decrementarPartida(
      parsed.data.requerimientoId,
      parsed.data.zona,
      parsed.data.categoria,
    );
    const id = await crearAsignacion({
      ...parsed.data,
      asignadoPor: adminUser.uid,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "SIN_DISPONIBILIDAD")
      return NextResponse.json(
        { error: "No hay disponibilidad para esa partida." },
        { status: 422 },
      );
    if (error?.message === "PARTIDA_NOT_FOUND")
      return NextResponse.json(
        { error: "Partida no encontrada." },
        { status: 404 },
      );
    return handleError(error);
  }
}

function handleError(error: any) {
  if (error instanceof RateLimitError)
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      { status: 429 },
    );
  if (error?.message === "AUTH_REQUIRED")
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (error?.message === "ADMIN_REQUIRED")
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  console.error("[api/asignaciones]", error);
  return NextResponse.json({ error: "Error interno." }, { status: 500 });
}
```

- [ ] **Step 3: Correr typecheck**

```bash
npm run typecheck 2>&1 | grep -v "node_modules" | head -30
```

Resolver cualquier error de tipos antes de continuar.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/requerimientos/route.ts src/app/api/asignaciones/route.ts
git commit -m "feat(propuestas): api requerimientos y asignaciones con decremento en transacción"
```

---

## Task 11: UI — Layout público y formulario /solicitud

**Files:**

- Crear: `src/app/(public)/layout.tsx`
- Crear: `src/app/(public)/solicitud/page.tsx`
- Crear: `src/components/propuestas/SolicitudForm.tsx`

- [ ] **Step 1: Crear layout para grupo (public)**

```typescript
// src/app/(public)/layout.tsx
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50">{children}</div>
}
```

- [ ] **Step 2: Crear page**

```typescript
// src/app/(public)/solicitud/page.tsx
import SolicitudForm from '@/components/propuestas/SolicitudForm'

export const metadata = { title: 'Solicitud de Propuesta — SNTSS' }

export default function SolicitudPage() {
  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Solicitud de Propuesta Sindical</h1>
        <p className="mt-2 text-sm text-gray-500">SNTSS — Sección VII Baja California</p>
      </div>
      <SolicitudForm />
    </main>
  )
}
```

- [ ] **Step 3: Crear `src/components/propuestas/SolicitudForm.tsx`**

Este componente tiene 3 pasos: validar matrícula → datos del familiar → confirmación.

```typescript
'use client'

import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

type Paso = 'matricula' | 'datos' | 'confirmado'

const AspiranteSchema = z.object({
  nombreCompleto: z.string().min(2, 'Nombre requerido'),
  curp: z.string().length(18, 'CURP debe tener 18 caracteres'),
  parentesco: z.enum(['Hijo', 'Hija', 'Cónyuge', 'Otro']),
  telefono: z.string().regex(/^\d{10}$/, 'Teléfono debe tener 10 dígitos'),
})

type AspiranteForm = z.infer<typeof AspiranteSchema>

export default function SolicitudForm() {
  const [paso, setPaso] = useState<Paso>('matricula')
  const [matricula, setMatricula] = useState('')
  const [matriculaInput, setMatriculaInput] = useState('')
  const [sinFamiliar, setSinFamiliar] = useState(false)
  const [ineFile, setIneFile] = useState<File | null>(null)
  const [numeroCaso, setNumeroCaso] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState('')

  const form = useForm<AspiranteForm>({ resolver: zodResolver(AspiranteSchema) })

  async function verificarMatricula() {
    setVerificando(true)
    setErrorGeneral('')
    try {
      const res = await fetch('/api/propuestas/verificar-matricula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula: matriculaInput }),
      })
      const data = await res.json()
      if (data.valida) {
        setMatricula(matriculaInput.trim().toUpperCase())
        setPaso('datos')
      } else if (data.razon === 'propuesta_activa') {
        setErrorGeneral(`Ya tienes una solicitud en proceso: ${data.numeroCaso}`)
      } else {
        setErrorGeneral('Matrícula no encontrada en el padrón activo.')
      }
    } catch {
      setErrorGeneral('Error de conexión. Intenta de nuevo.')
    } finally {
      setVerificando(false)
    }
  }

  async function enviarSolicitud(aspiranteData: AspiranteForm | null) {
    setEnviando(true)
    setErrorGeneral('')
    try {
      const fd = new FormData()
      fd.append('matricula', matricula)
      fd.append('sinFamiliar', String(sinFamiliar))
      if (!sinFamiliar && aspiranteData) {
        fd.append('aspirante', JSON.stringify(aspiranteData))
      } else {
        fd.append('aspirante', 'null')
      }
      if (ineFile) fd.append('ine', ineFile)

      const res = await fetch('/api/propuestas', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setErrorGeneral(data.error || 'Error al enviar la solicitud.')
        return
      }
      setNumeroCaso(data.numeroCaso)
      setPaso('confirmado')
    } catch {
      setErrorGeneral('Error de conexión. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (paso === 'confirmado') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-xl font-bold text-green-800 mb-2">Solicitud registrada</h2>
        <p className="text-gray-600 mb-4">Guarda tu número de caso para seguimiento:</p>
        <div className="text-2xl font-mono font-bold text-green-700 bg-white border border-green-200 rounded-lg px-6 py-3 inline-block">
          {numeroCaso}
        </div>
      </div>
    )
  }

  if (paso === 'matricula') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Paso 1 — Verificar matrícula</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Matrícula IMSS
          </label>
          <input
            type="text"
            value={matriculaInput}
            onChange={(e) => setMatriculaInput(e.target.value.toUpperCase())}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ej. 12345678"
            onKeyDown={(e) => e.key === 'Enter' && verificarMatricula()}
          />
        </div>
        {errorGeneral && <p className="text-sm text-red-600">{errorGeneral}</p>}
        <button
          onClick={verificarMatricula}
          disabled={verificando || matriculaInput.length < 4}
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {verificando ? 'Verificando...' : 'Verificar'}
        </button>
      </div>
    )
  }

  // Paso 'datos'
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Paso 2 — Datos de la solicitud</h2>
        <span className="text-xs text-gray-500 font-mono">{matricula}</span>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={sinFamiliar}
          onChange={(e) => setSinFamiliar(e.target.checked)}
          className="rounded"
        />
        Sin familiar (caso excepcional)
      </label>

      {!sinFamiliar && (
        <form onSubmit={form.handleSubmit((d) => enviarSolicitud(d))} className="space-y-4">
          <Field label="Nombre completo del aspirante" error={form.formState.errors.nombreCompleto?.message}>
            <input
              {...form.register('nombreCompleto')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Nombre completo"
            />
          </Field>

          <Field label="Parentesco" error={form.formState.errors.parentesco?.message}>
            <select {...form.register('parentesco')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Seleccionar...</option>
              {(['Hijo', 'Hija', 'Cónyuge', 'Otro'] as const).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>

          <Field label="CURP del aspirante" error={form.formState.errors.curp?.message}>
            <input
              {...form.register('curp')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase"
              placeholder="18 caracteres"
              maxLength={18}
            />
          </Field>

          <Field label="Teléfono de contacto" error={form.formState.errors.telefono?.message}>
            <input
              {...form.register('telefono')}
              type="tel"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="10 dígitos"
              maxLength={10}
            />
          </Field>

          <Field label="INE del aspirante (JPG, PNG o PDF, máx 5 MB)">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => setIneFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600"
            />
          </Field>

          {errorGeneral && <p className="text-sm text-red-600">{errorGeneral}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>
      )}

      {sinFamiliar && (
        <div className="space-y-4">
          {errorGeneral && <p className="text-sm text-red-600">{errorGeneral}</p>}
          <button
            onClick={() => enviarSolicitud(null)}
            disabled={enviando}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : 'Enviar solicitud (sin familiar)'}
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Verificar**

```bash
npm run typecheck 2>&1 | grep -v "node_modules" | grep "solicitud\|SolicitudForm" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(public)/layout.tsx src/app/(public)/solicitud/page.tsx src/components/propuestas/SolicitudForm.tsx
git commit -m "feat(propuestas): formulario público /solicitud — 3 pasos con validación"
```

---

## Task 12: UI — Dashboard admin /admin/propuestas

**Files:**

- Crear: `src/app/(main)/admin/propuestas/page.tsx`
- Crear: `src/components/propuestas/PropuestasDashboard.tsx`

- [ ] **Step 1: Crear page**

```typescript
// src/app/(main)/admin/propuestas/page.tsx
'use client'
import PropuestasDashboard from '@/components/propuestas/PropuestasDashboard'

export default function PropuestasPage() {
  return <PropuestasDashboard />
}
```

- [ ] **Step 2: Crear `src/components/propuestas/PropuestasDashboard.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Propuesta } from '@/types/propuestas'
import type { Requerimiento } from '@/types/requerimientos'
import type { Asignacion } from '@/types/asignaciones'
import type { EstadoPropuesta } from '@/types/workflow'

type Tab = 'solicitudes' | 'requerimientos' | 'asignaciones'

const ESTADO_LABELS: Record<EstadoPropuesta, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
}

const ESTADO_COLORS: Record<EstadoPropuesta, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  APROBADA: 'bg-green-100 text-green-800',
  RECHAZADA: 'bg-red-100 text-red-800',
}

export default function PropuestasDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('solicitudes')
  const [propuestas, setPropuestas] = useState<(Propuesta & { id: string })[]>([])
  const [requerimientos, setRequerimientos] = useState<(Requerimiento & { id: string })[]>([])
  const [asignaciones, setAsignaciones] = useState<(Asignacion & { id: string })[]>([])
  const [filtroEstado, setFiltroEstado] = useState<EstadoPropuesta | ''>('')
  const [cargando, setCargando] = useState(false)
  const [modalRequerimiento, setModalRequerimiento] = useState(false)

  async function getToken() {
    return user ? await (user as any).getIdToken() : ''
  }

  async function cargarPropuestas() {
    setCargando(true)
    try {
      const token = await getToken()
      const url = filtroEstado ? `/api/propuestas?estado=${filtroEstado}` : '/api/propuestas'
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setPropuestas(data.propuestas ?? [])
    } finally {
      setCargando(false)
    }
  }

  async function cargarRequerimientos() {
    const token = await getToken()
    const res = await fetch('/api/requerimientos', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    setRequerimientos(data.requerimientos ?? [])
  }

  async function cargarAsignaciones() {
    const token = await getToken()
    const res = await fetch('/api/asignaciones', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    setAsignaciones(data.asignaciones ?? [])
  }

  useEffect(() => {
    if (tab === 'solicitudes') cargarPropuestas()
    if (tab === 'requerimientos') cargarRequerimientos()
    if (tab === 'asignaciones') cargarAsignaciones()
  }, [tab, filtroEstado])

  const tieneWarnings = (p: Propuesta) => Object.values(p.warnings).some(Boolean)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Propuestas Sindicales</h1>
        <p className="text-sm text-gray-500 mt-1">Oficina de Admisión y Cambios</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {([
          ['solicitudes', 'Solicitudes'],
          ['requerimientos', 'Requerimientos'],
          ['asignaciones', 'Asignaciones'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Solicitudes */}
      {tab === 'solicitudes' && (
        <div>
          <div className="flex gap-2 mb-4">
            {(['', 'PENDIENTE', 'APROBADA', 'RECHAZADA'] as const).map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e as EstadoPropuesta | '')}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filtroEstado === e
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {e === '' ? 'Todos' : ESTADO_LABELS[e as EstadoPropuesta]}
              </button>
            ))}
          </div>

          {cargando ? (
            <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left"># Caso</th>
                    <th className="px-4 py-3 text-left">Matrícula</th>
                    <th className="px-4 py-3 text-left">Aspirante</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-center">Alerts</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {propuestas.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin solicitudes</td></tr>
                  )}
                  {propuestas.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => window.location.href = `/admin/propuestas/${p.id}`}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.numeroCaso}</td>
                      <td className="px-4 py-3 font-medium">{p.matricula}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.sinFamiliar
                          ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Sin familiar</span>
                          : p.aspirante?.nombreCompleto ?? '—'
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {p.creadoEn ? new Date((p.creadoEn as any).seconds * 1000).toLocaleDateString('es-MX') : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tieneWarnings(p) && (
                          <span className="inline-block w-2 h-2 bg-orange-400 rounded-full" title="Tiene alertas" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[p.estado]}`}>
                          {ESTADO_LABELS[p.estado]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Requerimientos */}
      {tab === 'requerimientos' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setModalRequerimiento(true)}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + Subir circular
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Oficio</th>
                  <th className="px-4 py-3 text-left">Fecha circular</th>
                  <th className="px-4 py-3 text-left">Partidas</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requerimientos.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin requerimientos</td></tr>
                )}
                {requerimientos.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">{r.numeroOficio}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.fechaCircular ? new Date((r.fechaCircular as any).seconds * 1000).toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.partidas.length} partida{r.partidas.length !== 1 ? 's' : ''} —{' '}
                      {r.partidas.reduce((acc, p) => acc + p.cantidadDisponible, 0)} disponibles
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.estado === 'ACTIVO' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {r.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {modalRequerimiento && (
            <ModalRequerimiento
              onClose={() => setModalRequerimiento(false)}
              onCreado={() => { setModalRequerimiento(false); cargarRequerimientos() }}
              getToken={getToken}
            />
          )}
        </div>
      )}

      {/* Tab: Asignaciones */}
      {tab === 'asignaciones' && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Propuesta ID</th>
                <th className="px-4 py-3 text-left">Zona</th>
                <th className="px-4 py-3 text-left">Categoría</th>
                <th className="px-4 py-3 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {asignaciones.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin asignaciones</td></tr>
              )}
              {asignaciones.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-mono text-xs">{a.propuestaId}</td>
                  <td className="px-4 py-3">{a.zona}</td>
                  <td className="px-4 py-3">{a.categoria}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.estado === 'ACTIVA' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                      {a.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ModalRequerimiento({
  onClose, onCreado, getToken,
}: { onClose: () => void; onCreado: () => void; getToken: () => Promise<string> }) {
  const [numeroOficio, setNumeroOficio] = useState('')
  const [fechaCircular, setFechaCircular] = useState('')
  const [partidas, setPartidas] = useState([{ zona: '', categoria: '', cantidadTotal: 1 }])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  function agregarPartida() {
    setPartidas([...partidas, { zona: '', categoria: '', cantidadTotal: 1 }])
  }

  function actualizarPartida(idx: number, campo: string, valor: string | number) {
    const copia = [...partidas]
    copia[idx] = { ...copia[idx], [campo]: valor }
    setPartidas(copia)
  }

  async function enviar() {
    setEnviando(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/requerimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          numeroOficio,
          fechaCircular: new Date(fechaCircular).toISOString(),
          partidas: partidas.map((p) => ({ ...p, cantidadTotal: Number(p.cantidadTotal) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al crear'); return }
      onCreado()
    } catch { setError('Error de conexión.') } finally { setEnviando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Subir circular</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de oficio</label>
            <input value={numeroOficio} onChange={(e) => setNumeroOficio(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del circular</label>
            <input type="date" value={fechaCircular} onChange={(e) => setFechaCircular(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Partidas</label>
              <button onClick={agregarPartida} className="text-xs text-blue-600 hover:text-blue-800">+ Agregar</button>
            </div>
            {partidas.map((p, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                <input placeholder="Zona" value={p.zona} onChange={(e) => actualizarPartida(i, 'zona', e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                <input placeholder="Categoría" value={p.categoria} onChange={(e) => actualizarPartida(i, 'categoria', e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                <input type="number" min={1} placeholder="Cantidad" value={p.cantidadTotal} onChange={(e) => actualizarPartida(i, 'cantidadTotal', e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm" />
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={enviar} disabled={enviando} className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {enviando ? 'Guardando...' : 'Guardar circular'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/admin/propuestas/page.tsx src/components/propuestas/PropuestasDashboard.tsx
git commit -m "feat(propuestas): dashboard admin — 3 pestañas solicitudes/requerimientos/asignaciones"
```

---

## Task 13: UI — Caso detallado /admin/propuestas/[id]

**Files:**

- Crear: `src/app/(main)/admin/propuestas/[id]/page.tsx`
- Crear: `src/components/propuestas/CasoDetalle.tsx`

- [ ] **Step 1: Crear page**

```typescript
// src/app/(main)/admin/propuestas/[id]/page.tsx
'use client'
import CasoDetalle from '@/components/propuestas/CasoDetalle'

export default function CasoPage({ params }: { params: { id: string } }) {
  return <CasoDetalle id={params.id} />
}
```

- [ ] **Step 2: Crear `src/components/propuestas/CasoDetalle.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import type { Propuesta } from '@/types/propuestas'
import type { Requerimiento } from '@/types/requerimientos'

const WARNING_LABELS: Record<string, string> = {
  propuestaActivaExistente: 'El trabajador ya tiene una propuesta activa',
  sinRequerimientoDisponible: 'No hay requerimiento disponible para esta categoría/zona',
  curpDuplicado: 'El CURP del aspirante ya existe en otra propuesta activa',
  categoriaIncompatible: 'Categoría posiblemente incompatible con la zona',
  documentoFaltante: 'INE no subida',
}

export default function CasoDetalle({ id }: { id: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const [propuesta, setPropuesta] = useState<(Propuesta & { id: string }) | null>(null)
  const [requerimientos, setRequerimientos] = useState<(Requerimiento & { id: string })[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalRechazo, setModalRechazo] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [modalAsignar, setModalAsignar] = useState(false)
  const [asignacion, setAsignacion] = useState({ requerimientoId: '', zona: '', categoria: '' })
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  async function getToken() { return user ? await (user as any).getIdToken() : '' }

  async function cargar() {
    setCargando(true)
    try {
      const token = await getToken()
      const [resProp, resReq] = await Promise.all([
        fetch(`/api/propuestas?id=${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/requerimientos', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      // Filtramos de la lista hasta tener endpoint GET /[id]
      const propData = await resProp.json()
      const propEncontrada = propData.propuestas?.find((p: any) => p.id === id) ?? null
      setPropuesta(propEncontrada)
      const reqData = await resReq.json()
      setRequerimientos(reqData.requerimientos ?? [])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  async function aprobar() {
    setProcesando(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/propuestas/${id}/aprobar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      await cargar()
    } finally { setProcesando(false) }
  }

  async function rechazar() {
    if (motivoRechazo.trim().length < 10) { setError('El motivo debe tener al menos 10 caracteres.'); return }
    setProcesando(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/propuestas/${id}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ motivo: motivoRechazo }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setModalRechazo(false)
      await cargar()
    } finally { setProcesando(false) }
  }

  async function asignar() {
    if (!asignacion.requerimientoId || !asignacion.zona || !asignacion.categoria) {
      setError('Completa todos los campos de asignación.'); return
    }
    setProcesando(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/asignaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ propuestaId: id, ...asignacion }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setModalAsignar(false)
      await cargar()
    } finally { setProcesando(false) }
  }

  if (cargando) return <div className="p-6 text-sm text-gray-400">Cargando...</div>
  if (!propuesta) return <div className="p-6 text-sm text-red-500">Caso no encontrado.</div>

  const warnings = propuesta.warnings
  const warningsActivos = Object.entries(warnings).filter(([, v]) => v === true)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => router.push('/admin/propuestas')} className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1">
        ← Volver
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">{propuesta.numeroCaso}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${propuesta.estado === 'APROBADA' ? 'bg-green-100 text-green-800' : propuesta.estado === 'RECHAZADA' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {propuesta.estado}
        </span>
        {propuesta.sinFamiliar && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Sin familiar</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Columna izquierda */}
        <div className="space-y-4">
          <Card title="Datos del trabajador">
            <Field label="Matrícula">{propuesta.matricula}</Field>
          </Card>

          {!propuesta.sinFamiliar && propuesta.aspirante && (
            <Card title="Datos del aspirante">
              <Field label="Nombre">{propuesta.aspirante.nombreCompleto}</Field>
              <Field label="CURP">{propuesta.aspirante.curp}</Field>
              <Field label="Parentesco">{propuesta.aspirante.parentesco ?? '—'}</Field>
              <Field label="Teléfono">{propuesta.aspirante.telefono}</Field>
            </Card>
          )}

          {propuesta.documentos.ineUrl && (
            <Card title="INE">
              <a href={propuesta.documentos.ineUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline">
                Ver / Descargar INE
              </a>
            </Card>
          )}

          {warningsActivos.length > 0 && (
            <details className="rounded-xl border border-orange-200 bg-orange-50">
              <summary className="px-4 py-3 text-sm font-medium text-orange-800 cursor-pointer">
                ⚠ {warningsActivos.length} alerta{warningsActivos.length !== 1 ? 's' : ''}
              </summary>
              <ul className="px-4 pb-3 space-y-1">
                {warningsActivos.map(([key]) => (
                  <li key={key} className="text-sm text-orange-700">• {WARNING_LABELS[key] ?? key}</li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          <Card title="Acciones">
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            {propuesta.estado === 'PENDIENTE' && (
              <div className="flex gap-3">
                <button onClick={aprobar} disabled={procesando}
                  className="flex-1 bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  Aprobar
                </button>
                <button onClick={() => { setError(''); setModalRechazo(true) }} disabled={procesando}
                  className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  Rechazar
                </button>
              </div>
            )}

            {propuesta.estado === 'APROBADA' && (
              <div className="space-y-3">
                <Field label="Folio oficial">
                  <span className="font-mono font-bold text-green-700">{propuesta.folio}</span>
                </Field>
                {propuesta.estadoFase2 === 'SIN_ASIGNAR' && (
                  <button onClick={() => { setError(''); setModalAsignar(true) }}
                    className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">
                    Asignar requerimiento
                  </button>
                )}
                {propuesta.estadoFase2 === 'ASIGNADA' && (
                  <p className="text-sm text-green-700 font-medium">✓ Requerimiento asignado</p>
                )}
                <a href={`/admin/propuestas/${id}/print`} target="_blank"
                  className="block text-center text-sm text-blue-600 hover:underline">
                  Generar PDF
                </a>
              </div>
            )}

            {propuesta.estado === 'RECHAZADA' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Motivo de rechazo:</p>
                <p className="text-sm text-gray-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {propuesta.motivoRechazo}
                </p>
                <a href={`/admin/propuestas/${id}/print`} target="_blank"
                  className="block text-center text-sm text-blue-600 hover:underline">
                  Generar PDF
                </a>
              </div>
            )}
          </Card>

          <Card title="Historial">
            <ol className="space-y-3">
              {[...(propuesta.historial ?? [])].reverse().map((evento, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-gray-800">{evento.tipo}</p>
                    {evento.nota && <p className="text-gray-500 text-xs">{evento.nota}</p>}
                    <p className="text-gray-400 text-xs">
                      {evento.fecha ? new Date((evento.fecha as any).seconds * 1000).toLocaleString('es-MX') : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {/* Modal rechazo */}
      {modalRechazo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Motivo de rechazo</h3>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={4}
              placeholder="Describe el motivo del rechazo (mínimo 10 caracteres)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setModalRechazo(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg px-4 py-2 text-sm">
                Cancelar
              </button>
              <button onClick={rechazar} disabled={procesando}
                className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {procesando ? 'Procesando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignación */}
      {modalAsignar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Asignar requerimiento</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requerimiento</label>
              <select
                value={asignacion.requerimientoId}
                onChange={(e) => setAsignacion({ ...asignacion, requerimientoId: e.target.value, zona: '', categoria: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Seleccionar...</option>
                {requerimientos.filter((r) => r.estado === 'ACTIVO').map((r) => (
                  <option key={r.id} value={r.id}>{r.numeroOficio}</option>
                ))}
              </select>
            </div>
            {asignacion.requerimientoId && (() => {
              const req = requerimientos.find((r) => r.id === asignacion.requerimientoId)
              const partidasDisponibles = req?.partidas.filter((p) => p.cantidadDisponible > 0) ?? []
              return (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partida disponible</label>
                  <select
                    value={`${asignacion.zona}|||${asignacion.categoria}`}
                    onChange={(e) => {
                      const [zona, categoria] = e.target.value.split('|||')
                      setAsignacion({ ...asignacion, zona, categoria })
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Seleccionar partida...</option>
                    {partidasDisponibles.map((p, i) => (
                      <option key={i} value={`${p.zona}|||${p.categoria}`}>
                        {p.zona} — {p.categoria} ({p.cantidadDisponible} disponibles)
                      </option>
                    ))}
                  </select>
                </div>
              )
            })()}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setModalAsignar(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg px-4 py-2 text-sm">
                Cancelar
              </button>
              <button onClick={asignar} disabled={procesando}
                className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {procesando ? 'Asignando...' : 'Confirmar asignación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm py-1">
      <span className="text-gray-400 w-24 shrink-0">{label}</span>
      <span className="text-gray-900">{children}</span>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/admin/propuestas/[id]/page.tsx src/components/propuestas/CasoDetalle.tsx
git commit -m "feat(propuestas): vista de caso detallado — aprobar, rechazar, asignar, historial"
```

---

## Task 14: UI — Print page

**Files:**

- Crear: `src/app/(main)/admin/propuestas/[id]/print/page.tsx`

- [ ] **Step 1: Crear page de impresión**

```typescript
// src/app/(main)/admin/propuestas/[id]/print/page.tsx
// Nota: esta página obtiene datos en cliente para simplificar.
// Si se necesita SSR en el futuro, mover a un Server Component con fetch desde adminDb.
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Propuesta } from '@/types/propuestas'

export default function PrintPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const [propuesta, setPropuesta] = useState<(Propuesta & { id: string }) | null>(null)

  useEffect(() => {
    async function cargar() {
      const token = user ? await (user as any).getIdToken() : ''
      const res = await fetch(`/api/propuestas`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const p = data.propuestas?.find((p: any) => p.id === params.id) ?? null
      setPropuesta(p)
    }
    if (user) cargar()
  }, [user, params.id])

  if (!propuesta) return <div className="p-8 text-gray-400 text-sm">Cargando...</div>

  const fecha = propuesta.creadoEn
    ? new Date((propuesta.creadoEn as any).seconds * 1000).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-family: Arial, sans-serif; font-size: 12pt; }
        }
      `}</style>

      <div className="no-print p-4 bg-gray-100 flex justify-between items-center print:hidden">
        <span className="text-sm text-gray-600">Vista previa de impresión</span>
        <button onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-8 bg-white min-h-screen">
        {/* Encabezado */}
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <p className="font-bold text-lg">SINDICATO NACIONAL DE TRABAJADORES DEL SEGURO SOCIAL</p>
          <p className="text-sm">SECCIÓN VII — BAJA CALIFORNIA</p>
          <p className="text-sm mt-1">OFICINA DE ADMISIÓN Y CAMBIOS</p>
        </div>

        <div className="text-center mb-6">
          <p className="text-sm">PROPUESTA SINDICAL</p>
          {propuesta.folio && (
            <p className="font-bold text-lg mt-1">FOLIO: {propuesta.folio}</p>
          )}
          <p className="text-sm text-gray-500 mt-1"># Caso: {propuesta.numeroCaso}</p>
        </div>

        {/* Datos trabajador */}
        <div className="border border-gray-300 rounded p-4 mb-4">
          <p className="font-bold text-sm mb-2">DATOS DEL TRABAJADOR</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-500">Matrícula:</span> <span className="font-medium">{propuesta.matricula}</span></div>
            <div><span className="text-gray-500">Fecha:</span> <span>{fecha}</span></div>
          </div>
        </div>

        {/* Datos aspirante */}
        {!propuesta.sinFamiliar && propuesta.aspirante && (
          <div className="border border-gray-300 rounded p-4 mb-4">
            <p className="font-bold text-sm mb-2">DATOS DEL ASPIRANTE</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="col-span-2"><span className="text-gray-500">Nombre:</span> <span className="font-medium">{propuesta.aspirante.nombreCompleto}</span></div>
              <div><span className="text-gray-500">CURP:</span> <span>{propuesta.aspirante.curp}</span></div>
              <div><span className="text-gray-500">Parentesco:</span> <span>{propuesta.aspirante.parentesco}</span></div>
              <div><span className="text-gray-500">Teléfono:</span> <span>{propuesta.aspirante.telefono}</span></div>
            </div>
          </div>
        )}

        {propuesta.sinFamiliar && (
          <div className="border border-gray-300 rounded p-4 mb-4 text-sm">
            <p className="font-bold mb-1">CASO SIN FAMILIAR</p>
            <p className="text-gray-500">Contratación directa (caso excepcional)</p>
          </div>
        )}

        {/* Estado */}
        <div className="border border-gray-300 rounded p-4 mb-8">
          <p className="font-bold text-sm mb-2">ESTADO DE LA SOLICITUD</p>
          <p className="text-sm font-medium">{propuesta.estado}</p>
          {propuesta.motivoRechazo && (
            <p className="text-sm text-gray-600 mt-1">Motivo: {propuesta.motivoRechazo}</p>
          )}
        </div>

        {/* Firmas */}
        <div className="grid grid-cols-2 gap-8 mt-12">
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="text-sm">Firma del Trabajador</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="text-sm">Firma y Sello — Oficina de Admisión</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(main)/admin/propuestas/[id]/print/page.tsx
git commit -m "feat(propuestas): página de impresión con formato oficial SNTSS"
```

---

## Task 15: Docs y validación final

**Files:**

- Modificar: `docs/firestore-schema.md`

- [ ] **Step 1: Agregar sección de propuestas al schema doc**

Abrir `docs/firestore-schema.md` y agregar al final:

```markdown
## Módulo: Propuestas Sindicales (Admisión y Cambios)

### `propuestas/{id}`

Solicitudes de ingreso al sindicato.

- `numeroCaso` string — formato "CASO-YYYY-NNNN", asignado al crear
- `folio` string|null — formato "YYYY-NNNN", asignado al APROBAR
- `estado` 'PENDIENTE'|'APROBADA'|'RECHAZADA'
- `estadoFase2` 'SIN_ASIGNAR'|'ASIGNADA'|'DEVUELTA'|null
- `motivoRechazo` string|null
- `matricula` string — matrícula IMSS del trabajador solicitante
- `sinFamiliar` boolean — true para casos excepcionales sin familiar
- `aspirante` object|null — { nombreCompleto, curp, parentesco, telefono }
- `documentos.ineUrl` string|null — URL pública Firebase Storage
- `warnings` object — 5 booleans, informativos, no bloquean el registro
- `historial` array — eventos { fecha, tipo, usuarioId, nota }

### `requerimientos/{id}`

Circulares del sindicato nacional con plazas disponibles.

- `numeroOficio` string
- `fechaCircular` Timestamp
- `estado` 'ACTIVO'|'CERRADO'
- `partidas` array — { zona, categoria, cantidadTotal, cantidadDisponible }
- `creadoPor` string — uid del admin

### `asignaciones/{id}`

Relación entre propuesta aprobada y partida de requerimiento.

- `propuestaId` string
- `requerimientoId` string
- `zona` string
- `categoria` string
- `estado` 'ACTIVA'|'DEVUELTA'
- `asignadoPor` string — uid del admin

### `contadores/propuestas` (documento especial)

- `ultimoCaso` number — contador de numeroCaso, incrementa en transacción
- `ultimoFolio` number — contador de folio oficial, incrementa en transacción
- `anio` number — año vigente para reseteo de contadores
```

- [ ] **Step 2: Correr check completo**

```bash
npm run check 2>&1 | tail -30
```

Resolver cualquier error de tipos o lint antes de continuar.

- [ ] **Step 3: Correr tests**

```bash
npm test 2>&1 | tail -20
```

Esperado: al menos los 7 tests de warnings pasan.

- [ ] **Step 4: Commit final**

```bash
git add docs/firestore-schema.md
git commit -m "docs: agregar schema Firestore — propuestas, requerimientos, asignaciones, contadores"
```

---

## Verificación manual (UAT)

Antes de mergear, verificar estos flujos en el entorno de desarrollo:

1. **Formulario público** — ir a `/solicitud`, ingresar matrícula inválida → debe mostrar error. Matrícula válida → debe pasar al paso 2.
2. **Registro** — llenar datos de aspirante, subir INE, enviar → debe mostrar número de caso.
3. **Dashboard** — entrar a `/admin/propuestas` como usuario con rol ADMISION → debe ver tabla de solicitudes.
4. **Aprobar** — abrir un caso PENDIENTE, aprobar → debe mostrar folio generado.
5. **Rechazar** — intentar rechazar sin motivo → debe mostrar error. Con motivo válido → debe cambiar estado.
6. **Circular** — crear requerimiento desde pestaña Requerimientos → debe aparecer en tabla.
7. **Asignar** — desde caso APROBADO, asignar a requerimiento → debe decrementar disponibles.
8. **PDF** — abrir link "Generar PDF" → debe mostrar página con datos del caso y espacio para firmas.

---

## Notas para el ejecutor

- Las API routes usan `adminDb` (Firebase Admin SDK) — solo disponible en servidor, nunca importar en componentes cliente.
- El formulario `/solicitud` es público (sin auth). El rate limit en `api:propuestas:create` es 5/min para prevenir spam.
- Los warnings se calculan al crear la propuesta con datos disponibles en ese momento. No se recalculan automáticamente después.
- El endpoint GET `/api/propuestas` devuelve todas las propuestas — para escalar, agregar paginación en el futuro.
- El campo `usuarioId: 'publico'` en el historial de creación es intencional — el formulario no requiere auth.
