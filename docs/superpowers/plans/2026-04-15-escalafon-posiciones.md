# Escalafón — Motor de Posiciones por Zona — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calcular y materializar la posición efectiva de cada aspirante por zona al subir el PDF, y mostrarla en la tabla con filtro de zona.

**Architecture:** Función pura `calcularPosicionesPorZona` en `src/lib/escalafon/position-engine.ts` → llamada en el API route `/procesar` antes de guardar → campos `posicionesPorZona` (aspirante) y `zonas` (listado) en Firestore → UI con dropdown de zona + columna "Pos." en la tabla de detalle.

**Tech Stack:** TypeScript, Vitest, Next.js 14 App Router, Firebase Firestore, Tailwind CSS.

**⚠️ RESTRICCIÓN CRÍTICA:** NO tocar ningún archivo de bolsa de trabajo. Solo modificaciones aditivas en archivos de escalafón.

---

## Mapa de archivos

| Archivo                                               | Acción              | Responsabilidad                                                                    |
| ----------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `src/types/escalafon.ts`                              | Modificar (aditivo) | Agregar `posicionesPorZona?` a `EscalafonAspirante` y `zonas` a `EscalafonListado` |
| `src/lib/escalafon/position-engine.ts`                | Crear               | Función pura: calcula posiciones por zona                                          |
| `src/lib/escalafon/__tests__/position-engine.test.ts` | Crear               | Tests unitarios del motor                                                          |
| `src/app/api/escalafon/procesar/route.ts`             | Modificar           | Llamar motor antes de `guardarListado`                                             |
| `src/app/(main)/admin/escalafon/[listadoId]/page.tsx` | Modificar           | Dropdown de zona + columna Pos.                                                    |

---

## Task 1: Actualizar tipos TypeScript

**Files:**

- Modify: `src/types/escalafon.ts`

- [ ] **Agregar `posicionesPorZona` a `EscalafonAspirante` y `zonas` a `EscalafonListado`**

Reemplazar el contenido completo de `src/types/escalafon.ts` con:

```ts
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
  posicionesPorZona?: Record<string, number>; // calculado por position-engine al subir
}

export interface EscalafonListado {
  id?: string;
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
  zonas: string[]; // todas las zonas únicas del listado, calculado al subir
}

export interface EscalafonParseResult {
  listado: Omit<
    EscalafonListado,
    "id" | "subidoPor" | "creadoEn" | "aspirantesParsed" | "zonas"
  >;
  aspirantes: Omit<
    EscalafonAspirante,
    "id" | "listadoId" | "posicionesPorZona"
  >[];
  errores: string[];
}
```

- [ ] **Verificar typecheck**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run typecheck
```

Expected: sin errores.

- [ ] **Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && git add src/types/escalafon.ts && git commit -m "feat(escalafon): agregar posicionesPorZona y zonas a los tipos"
```

---

## Task 2: Motor de posiciones (TDD)

**Files:**

- Create: `src/lib/escalafon/__tests__/position-engine.test.ts`
- Create: `src/lib/escalafon/position-engine.ts`

### Paso 2a — Escribir los tests primero

- [ ] **Crear `src/lib/escalafon/__tests__/position-engine.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { calcularPosicionesPorZona } from "../position-engine";
import type { EscalafonAspirante } from "@/types/escalafon";

// Helper para construir aspirantes de prueba sin id/listadoId/posicionesPorZona
type AspiranteInput = Omit<
  EscalafonAspirante,
  "id" | "listadoId" | "posicionesPorZona"
>;

function aspirante(
  lugar: number,
  zonas: string[], // "INCONDICIONAL" o nombre de zona
  estatus: "Activo" | "PEI" = "Activo",
): AspiranteInput {
  return {
    lugar,
    estatus,
    matricula: `MAT${lugar}`,
    nombre: `ASPIRANTE ${lugar}`,
    delegacion: "02",
    fechaRegistro: "01/01/2026",
    preferencias: zonas.map((z) => ({
      delegacionSolicitada: "02 BAJA CALIFORNIA",
      zonaSolicitada: z,
      localidadSolicitada: "INCONDICIONAL",
      adscripcionCode: "INCONDICIONAL",
      adscripcionDesc: "INCONDICIONAL",
      turnoNum: null,
      turnoDesc: "INCONDICIONAL",
    })),
  };
}

describe("calcularPosicionesPorZona", () => {
  it("extrae las zonas únicas correctamente", () => {
    const aspirantes = [
      aspirante(1, ["7 TIJUANA"]),
      aspirante(2, ["2 MEXICALI"]),
      aspirante(3, ["7 TIJUANA", "6 TECATE"]),
    ];
    const { zonas } = calcularPosicionesPorZona(aspirantes);
    expect(zonas.sort()).toEqual(
      ["2 MEXICALI", "6 TECATE", "7 TIJUANA"].sort(),
    );
  });

  it("no incluye INCONDICIONAL en la lista de zonas", () => {
    const aspirantes = [
      aspirante(1, ["INCONDICIONAL"]),
      aspirante(2, ["7 TIJUANA"]),
    ];
    const { zonas } = calcularPosicionesPorZona(aspirantes);
    expect(zonas).not.toContain("INCONDICIONAL");
    expect(zonas).toContain("7 TIJUANA");
  });

  it("un aspirante condicionado solo aparece en su zona", () => {
    const aspirantes = [
      aspirante(1, ["7 TIJUANA"]),
      aspirante(2, ["2 MEXICALI"]),
    ];
    const { aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    const a1 = aspirantesConPosicion[0];
    expect(a1.posicionesPorZona["7 TIJUANA"]).toBe(1);
    expect(a1.posicionesPorZona["2 MEXICALI"]).toBeUndefined();
  });

  it("un aspirante INCONDICIONAL aparece en todas las zonas", () => {
    const aspirantes = [
      aspirante(1, ["7 TIJUANA"]),
      aspirante(2, ["INCONDICIONAL"]),
      aspirante(3, ["2 MEXICALI"]),
    ];
    const { aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    const incondicional = aspirantesConPosicion.find(
      (a) => a.matricula === "MAT2",
    )!;
    expect(incondicional.posicionesPorZona["7 TIJUANA"]).toBeDefined();
    expect(incondicional.posicionesPorZona["2 MEXICALI"]).toBeDefined();
  });

  it("las posiciones son consecutivas sin huecos por zona", () => {
    const aspirantes = [
      aspirante(1, ["7 TIJUANA"]),
      aspirante(3, ["7 TIJUANA"]),
      aspirante(5, ["7 TIJUANA"]),
    ];
    const { aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    const posiciones = aspirantesConPosicion
      .map((a) => a.posicionesPorZona["7 TIJUANA"])
      .sort((a, b) => a - b);
    expect(posiciones).toEqual([1, 2, 3]);
  });

  it("respeta el orden de LUG.ESC. al asignar posiciones", () => {
    const aspirantes = [
      aspirante(10, ["7 TIJUANA"]),
      aspirante(3, ["INCONDICIONAL"]),
      aspirante(7, ["7 TIJUANA"]),
    ];
    const { aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    // En Tijuana deben estar los 3: lugar 3 (incondicional), 7, 10
    // Posición 1 → lugar 3, posición 2 → lugar 7, posición 3 → lugar 10
    const map = Object.fromEntries(
      aspirantesConPosicion.map((a) => [
        a.lugar,
        a.posicionesPorZona["7 TIJUANA"],
      ]),
    );
    expect(map[3]).toBe(1);
    expect(map[7]).toBe(2);
    expect(map[10]).toBe(3);
  });

  it("aspirante con múltiples zonas condicionadas aparece en cada una", () => {
    const aspirantes = [
      aspirante(1, ["7 TIJUANA", "2 MEXICALI"]),
      aspirante(2, ["7 TIJUANA"]),
    ];
    const { aspirantesConPosicion } = calcularPosicionesPorZona(aspirantes);
    const a1 = aspirantesConPosicion.find((a) => a.lugar === 1)!;
    expect(a1.posicionesPorZona["7 TIJUANA"]).toBe(1);
    expect(a1.posicionesPorZona["2 MEXICALI"]).toBe(1);
  });

  it("retorna arreglo vacío y zonas vacías si no hay aspirantes", () => {
    const { aspirantesConPosicion, zonas } = calcularPosicionesPorZona([]);
    expect(aspirantesConPosicion).toHaveLength(0);
    expect(zonas).toHaveLength(0);
  });
});
```

- [ ] **Correr tests (deben fallar — el archivo no existe)**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm test -- src/lib/escalafon/__tests__/position-engine.test.ts 2>&1 | head -20
```

Expected: FAIL con "Cannot find module '../position-engine'"

### Paso 2b — Implementar el motor

- [ ] **Crear `src/lib/escalafon/position-engine.ts`**

```ts
import type { EscalafonAspirante } from "@/types/escalafon";

type AspiranteInput = Omit<
  EscalafonAspirante,
  "id" | "listadoId" | "posicionesPorZona"
>;
type AspiranteConPosicion = AspiranteInput & {
  posicionesPorZona: Record<string, number>;
};

function esIncondicional(zona: string): boolean {
  return zona.replace(/\s/g, "").toUpperCase() === "INCONDICIONAL";
}

export function calcularPosicionesPorZona(aspirantes: AspiranteInput[]): {
  aspirantesConPosicion: AspiranteConPosicion[];
  zonas: string[];
} {
  if (aspirantes.length === 0) {
    return { aspirantesConPosicion: [], zonas: [] };
  }

  // 1. Extraer zonas únicas (excluir INCONDICIONAL)
  const zonasSet = new Set<string>();
  for (const a of aspirantes) {
    for (const p of a.preferencias) {
      if (!esIncondicional(p.zonaSolicitada)) {
        zonasSet.add(p.zonaSolicitada);
      }
    }
  }
  const zonas = Array.from(zonasSet).sort();

  // 2. Inicializar mapa de posiciones vacío para cada aspirante
  const conPosicion: AspiranteConPosicion[] = aspirantes.map((a) => ({
    ...a,
    posicionesPorZona: {},
  }));

  // 3. Para cada zona, calcular posiciones
  for (const zona of zonas) {
    // Identificar aspirantes que califican para esta zona (en orden de lugar)
    const calificados = conPosicion.filter((a) =>
      a.preferencias.some(
        (p) => esIncondicional(p.zonaSolicitada) || p.zonaSolicitada === zona,
      ),
    );
    // Ya vienen ordenados por lugar desde el parser — asignar posición
    calificados.forEach((a, idx) => {
      a.posicionesPorZona[zona] = idx + 1;
    });
  }

  return { aspirantesConPosicion: conPosicion, zonas };
}
```

- [ ] **Correr tests (deben pasar)**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm test -- src/lib/escalafon/__tests__/position-engine.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: todos en PASS.

- [ ] **Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && git add src/lib/escalafon/ && git commit -m "feat(escalafon): motor de posiciones por zona con tests"
```

---

## Task 3: Integrar motor en el API route `/procesar`

**Files:**

- Modify: `src/app/api/escalafon/procesar/route.ts`

El route actual llama `guardarListado(listado, aspirantes)` después del parsing. Hay que insertar `calcularPosicionesPorZona` en medio.

- [ ] **Modificar `src/app/api/escalafon/procesar/route.ts`**

Agregar el import al inicio del archivo (después de los imports existentes):

```ts
import { calcularPosicionesPorZona } from "@/lib/escalafon/position-engine";
```

Reemplazar el bloque que llama a `guardarListado` (líneas ~98-106 actuales):

```ts
// ANTES (eliminar):
const listadoId = await guardarListado(
  {
    ...listado,
    aspirantesParsed: aspirantes.length,
    subidoPor: ctx.uid,
    creadoEn: new Date().toISOString(),
  },
  aspirantes.map((a) => ({ ...a, listadoId: "" })),
);

// DESPUÉS (reemplazar con):
const { aspirantesConPosicion, zonas } = calcularPosicionesPorZona(aspirantes);

const listadoId = await guardarListado(
  {
    ...listado,
    aspirantesParsed: aspirantes.length,
    subidoPor: ctx.uid,
    creadoEn: new Date().toISOString(),
    zonas,
  },
  aspirantesConPosicion.map((a) => ({ ...a, listadoId: "" })),
);
```

- [ ] **Typecheck**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run typecheck
```

Expected: sin errores.

- [ ] **Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && git add src/app/api/escalafon/procesar/route.ts && git commit -m "feat(escalafon): calcular posiciones por zona al procesar PDF"
```

---

## Task 4: UI — Filtro de zona y columna Posición

**Files:**

- Modify: `src/app/(main)/admin/escalafon/[listadoId]/page.tsx`

- [ ] **Reemplazar el contenido completo de la página de detalle**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import React from "react";
import type { EscalafonListado, EscalafonAspirante } from "@/types/escalafon";

export default function DetalleListadoPage() {
  const { listadoId } = useParams<{ listadoId: string }>();
  const [listado, setListado] = useState<EscalafonListado | null>(null);
  const [aspirantes, setAspirantes] = useState<EscalafonAspirante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [zonaActiva, setZonaActiva] = useState<string>("");

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

  // Filtrar y ordenar según zona activa
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

- [ ] **Typecheck + lint**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run check
```

Expected: sin errores ni warnings.

- [ ] **Commit**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && git add "src/app/(main)/admin/escalafon/[listadoId]/page.tsx" && git commit -m "feat(escalafon): filtro por zona y posición efectiva en tabla"
```

---

## Task 5: Validación final

- [ ] **Correr todos los tests**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm test 2>&1 | tail -15
```

Expected: todos pasan, incluyendo los 8 tests del parser y los 8 nuevos del motor.

- [ ] **Build completo**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && npm run build 2>&1 | tail -15
```

Expected: sin errores.

- [ ] **Push al remoto**

```bash
cd /Users/gerardoarroyo/Projects/SNTSS && git push origin feat/user-management-v2
```

- [ ] **Verificación manual (requiere re-subir un PDF)**

  Dado que los listados ya en Firestore no tienen `posicionesPorZona` ni `zonas`, para ver la funcionalidad hay que subir uno de los PDFs de muestra de nuevo (primero eliminar el duplicado si existe). Al cargar el PDF:
  1. El listado guardado debe tener `zonas: ["2 MEXICALI", "4 SAN LUIS", ...]`
  2. Cada aspirante debe tener `posicionesPorZona: { "7 TIJUANA": N, ... }`
  3. En la página de detalle debe aparecer el dropdown de zona
  4. Al seleccionar una zona, la tabla se filtra y la columna cambia a "Pos."
  5. Los números de posición deben ser consecutivos (1, 2, 3...)
  6. Un aspirante con INCONDICIONAL debe aparecer en todas las zonas
