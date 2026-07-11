# Cambios de escalafon en portal del trabajador — Plan de implementacion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar al trabajador su posicion en listados de cambios de escalafon, integrado en la seccion "Mi Escalafon" del dashboard.

**Architecture:** Materializar posiciones al subir un listado (guardar `lugar`/`totalEnGrupo` en cada doc de `cambios_registros`). Endpoint del trabajador consulta por matricula. Dashboard unifica cards de promocion + cambios bajo "Mi Escalafon".

**Tech Stack:** Next.js 14 API Routes, Firebase Admin SDK (Firestore), React 18, Tailwind CSS, Framer Motion, Radix UI Dialog.

---

## File Structure

| Archivo                                                 | Responsabilidad                                      |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `src/types/cambios-escalafon.ts`                        | Tipo `CambiosPosicionResult` (response del endpoint) |
| `src/lib/firebase/cambios-escalafon.ts`                 | Nueva funcion `materializarPosicionesCambios()`      |
| `src/app/api/cambios-escalafon/procesar/route.ts`       | Llamar materializacion despues de guardar            |
| `src/app/api/trabajador/cambios-posicion/route.ts`      | Nuevo endpoint GET                                   |
| `src/lib/firebase/trabajador-portal.ts`                 | `getMisCambiosEscalafonCliente()`                    |
| `src/app/(main)/dashboard/page.tsx`                     | Fetch + cards + modal de cambios                     |
| `scripts/migrations/materializar-cambios-posiciones.ts` | Script one-shot para registros existentes            |

---

### Task 1: Tipo CambiosPosicionResult

**Files:**

- Modify: `src/types/cambios-escalafon.ts`

- [ ] **Step 1: Agregar tipo al final del archivo**

```ts
// En src/types/cambios-escalafon.ts, agregar al final:

export interface CambiosPosicionResult {
  listadoId: string;
  categoriaCode: string;
  categoriaDesc: string;
  concepto: string;
  fechaEmision: string;
  tipo: string;
  zona: string;
  adscripcionSolicitada: string;
  turnoSolicitado: string;
  lugar: number;
  totalEnGrupo: number;
  grupoUnidad: string;
  grupoTurno: string;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: PASS (tipo nuevo sin consumidores aun)

- [ ] **Step 3: Commit**

```bash
git add src/types/cambios-escalafon.ts
git commit -m "feat(cambios): add CambiosPosicionResult type for worker portal"
```

---

### Task 2: Materializacion de posiciones en cambios_registros

**Files:**

- Modify: `src/lib/firebase/cambios-escalafon.ts`
- Test: `src/lib/cambios-escalafon/position-engine.test.ts` (tests existentes validan el motor)

- [ ] **Step 1: Agregar funcion `materializarPosicionesCambios` en `cambios-escalafon.ts`**

Despues de la funcion `guardarListadoCambios`, agregar:

```ts
import {
  calcularPosicionesCambios,
  claveRegistro,
} from "@/lib/cambios-escalafon/position-engine";

/**
 * Corre el motor de posiciones sobre los registros de un listado y guarda
 * lugar/totalEnGrupo/grupoUnidad/grupoTurno en cada doc de cambios_registros.
 * Para incondicionales (multiples posiciones), guarda la mejor (lugar mas bajo).
 */
export async function materializarPosicionesCambios(
  listadoId: string,
): Promise<void> {
  const registros = await obtenerRegistros(listadoId);
  if (registros.length === 0) return;

  const posiciones = calcularPosicionesCambios(registros);

  // Para cada registro, tomar la mejor posicion (menor lugar).
  // Un incondicional puede aparecer en multiples grupos.
  const mejorPorRegistro = new Map<
    string,
    { lugar: number; totalEnGrupo: number; unidad: string; turno: string }
  >();

  for (const p of posiciones) {
    const k = claveRegistro(p.registro);
    const prev = mejorPorRegistro.get(k);
    if (!prev || p.lugar < prev.lugar) {
      mejorPorRegistro.set(k, {
        lugar: p.lugar,
        totalEnGrupo: p.totalEnGrupo,
        unidad: p.unidad,
        turno: p.turno,
      });
    }
  }

  // Actualizar docs en batches
  const BATCH_SIZE = 400;
  const docs = registros.filter((r) => mejorPorRegistro.has(claveRegistro(r)));
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    for (const r of docs.slice(i, i + BATCH_SIZE)) {
      const best = mejorPorRegistro.get(claveRegistro(r))!;
      batch.update(adminDb.collection(COL_REGISTROS).doc(r.id!), {
        lugar: best.lugar,
        totalEnGrupo: best.totalEnGrupo,
        grupoUnidad: best.unidad,
        grupoTurno: best.turno,
      });
    }
    await batch.commit();
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Verificar tests existentes del motor**

Run: `npx vitest run src/lib/cambios-escalafon/`
Expected: PASS (7+ tests)

- [ ] **Step 4: Commit**

```bash
git add src/lib/firebase/cambios-escalafon.ts
git commit -m "feat(cambios): add materializarPosicionesCambios function"
```

---

### Task 3: Llamar materializacion desde procesar/route.ts

**Files:**

- Modify: `src/app/api/cambios-escalafon/procesar/route.ts`

- [ ] **Step 1: Importar y llamar materializacion**

Agregar import:

```ts
import { materializarPosicionesCambios } from "@/lib/firebase/cambios-escalafon";
```

Despues de la linea `const listadoId = await guardarListadoCambios(...)` (linea 119-128) y antes del bloque `if (loteIdFinal)` (linea 130), agregar:

```ts
// Materializar posiciones para el portal del trabajador
await materializarPosicionesCambios(listadoId);
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cambios-escalafon/procesar/route.ts
git commit -m "feat(cambios): materialize positions on upload"
```

---

### Task 4: Endpoint GET /api/trabajador/cambios-posicion

**Files:**

- Create: `src/app/api/trabajador/cambios-posicion/route.ts`

- [ ] **Step 1: Crear el endpoint**

```ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUserRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { RateLimitError } from "@/lib/security/rate-limit";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { nombreListadoConEspecialidad } from "@/lib/cambios-escalafon/especialidades-enfermeria";
import type {
  CambiosListado,
  CambiosRegistro,
} from "@/types/cambios-escalafon";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);

    await enforceRateLimitRedis(request, {
      bucket: "api:trabajador:cambios-posicion",
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

    // Buscar registros del trabajador que tengan posicion materializada
    const registrosSnap = await adminDb
      .collection("cambios_registros")
      .where("matricula", "==", matricula)
      .get();

    if (registrosSnap.empty) {
      return NextResponse.json({ success: true, data: [] });
    }

    const registros = registrosSnap.docs
      .map(
        (doc) =>
          ({ id: doc.id, ...doc.data() }) as CambiosRegistro & {
            lugar?: number;
            totalEnGrupo?: number;
            grupoUnidad?: string;
            grupoTurno?: string;
          },
      )
      .filter((r) => r.lugar != null); // solo materializados

    if (registros.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Traer listados correspondientes (deduplicados)
    const listadoIds = [...new Set(registros.map((r) => r.listadoId))];
    const listadosMap = new Map<string, CambiosListado>();

    await Promise.all(
      listadoIds.map(async (listadoId) => {
        const doc = await adminDb
          .collection("cambios_listados")
          .doc(listadoId)
          .get();
        if (doc.exists) {
          listadosMap.set(listadoId, {
            id: doc.id,
            ...doc.data(),
          } as CambiosListado);
        }
      }),
    );

    const data = registros
      .map((r) => {
        const listado = listadosMap.get(r.listadoId);
        if (!listado) return null;

        return {
          listadoId: r.listadoId,
          categoriaCode: listado.categoriaCode,
          categoriaDesc: nombreListadoConEspecialidad(
            listado.categoriaDesc,
            listado.area,
          ),
          concepto: listado.concepto,
          fechaEmision: listado.fechaEmision,
          tipo: r.tipo,
          zona: r.zona,
          adscripcionSolicitada: r.adscripcionSolicitada,
          turnoSolicitado: r.turnoSolicitado,
          lugar: r.lugar!,
          totalEnGrupo: r.totalEnGrupo!,
          grupoUnidad: r.grupoUnidad!,
          grupoTurno: r.grupoTurno!,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const err = error as { message?: string };

    if (err?.message === "CORS_FORBIDDEN") {
      return NextResponse.json(
        { error: "Acceso no permitido." },
        { status: 403 },
      );
    }

    if (error instanceof RateLimitError || err?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              (error as RateLimitError).retryAfterSeconds || 60,
            ),
          },
        },
      );
    }

    if (err?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (err?.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Perfil de usuario no encontrado." },
        { status: 404 },
      );
    }

    if (err?.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { error: "La cuenta no está activa." },
        { status: 403 },
      );
    }

    console.error("[trabajador/cambios-posicion]", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/trabajador/cambios-posicion/route.ts
git commit -m "feat(cambios): add worker portal endpoint for cambios positions"
```

---

### Task 5: Cliente getMisCambiosEscalafonCliente

**Files:**

- Modify: `src/lib/firebase/trabajador-portal.ts`

- [ ] **Step 1: Agregar import del tipo y la funcion**

Al inicio del archivo, agregar el import:

```ts
import type { CambiosPosicionResult } from "@/types/cambios-escalafon";
```

Despues de la funcion `getMiEscalafonCliente()` (linea ~140), agregar:

```ts
export async function getMisCambiosEscalafonCliente(): Promise<{
  data: CambiosPosicionResult[];
}> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/trabajador/cambios-posicion", {
    method: "GET",
    headers,
  });

  const payload = await parseJsonResponse<{
    success: boolean;
    data: CambiosPosicionResult[];
  }>(response);
  return { data: payload.data || [] };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase/trabajador-portal.ts
git commit -m "feat(cambios): add getMisCambiosEscalafonCliente to worker portal"
```

---

### Task 6: Dashboard — integrar cards de cambios en Mi Escalafon

**Files:**

- Modify: `src/app/(main)/dashboard/page.tsx`

- [ ] **Step 1: Agregar imports y estado**

Agregar import:

```ts
import { getMisCambiosEscalafonCliente } from "@/lib/firebase/trabajador-portal";
import type { CambiosPosicionResult } from "@/types/cambios-escalafon";
```

Despues del estado `escalafon` (~linea 135), agregar:

```ts
const [cambiosEscalafon, setCambiosEscalafon] = useState<
  CambiosPosicionResult[]
>([]);
```

Agregar estado para modal de cambios, junto a los estados de modal de escalafon (~linea 149-151):

```ts
const [isCambiosModalOpen, setIsCambiosModalOpen] = useState(false);
const [cambiosDetalle, setCambiosDetalle] =
  useState<CambiosPosicionResult | null>(null);
```

- [ ] **Step 2: Agregar useEffect para fetch de cambios**

Junto al useEffect de escalafon (~linea 245-258), agregar un fetch paralelo dentro del mismo useEffect o uno nuevo:

```ts
useEffect(() => {
  if (!user || userData?.role?.toUpperCase() !== "USER") return;
  if (!userData?.matricula?.trim()) return;
  if (ESCALAFON_HABILITADO) {
    const fetchCambios = async () => {
      try {
        const result = await getMisCambiosEscalafonCliente();
        setCambiosEscalafon(result.data || []);
      } catch {
        // silencioso — cambios puede no estar disponible
      }
    };
    fetchCambios();
  }
}, [user, userData]);
```

- [ ] **Step 3: Actualizar contador del header de escalafon**

En la seccion "SECCION ESCALAFON" (~linea 646-647), cambiar la condicion y el contador:

Antes:

```tsx
{ESCALAFON_HABILITADO && escalafon.length > 0 && (
```

Despues:

```tsx
{ESCALAFON_HABILITADO && (escalafon.length + cambiosEscalafon.length) > 0 && (
```

Y el contador (~linea 658-660):
Antes:

```tsx
{
  escalafon.length;
}
```

Despues:

```tsx
{
  escalafon.length + cambiosEscalafon.length;
}
```

Tambien actualizar la logica del grid (~linea 666-673) para usar el total combinado:

```tsx
const totalEscalafon = escalafon.length + cambiosEscalafon.length;
```

Y reemplazar las referencias a `escalafon.length` en las clases del grid por `totalEscalafon`.

- [ ] **Step 4: Agregar badge "Promocion" a cards existentes de escalafon**

En la card existente (~linea 699), cambiar el texto del badge de "Escalafon" a "Promocion":

```tsx
<div className="inline-block px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">
  Promoción
</div>
```

- [ ] **Step 5: Agregar cards de cambios despues de las de promocion**

Despues del `.map()` de escalafon (~linea 765, antes del `</div>` que cierra el grid), agregar:

```tsx
{
  cambiosEscalafon.map((item, index) => (
    <motion.div
      key={`cambio-${item.listadoId}-${item.tipo}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * (escalafon.length + index) }}
      whileHover={{ y: -5 }}
      className="group relative"
    >
      <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm group-hover:shadow-2xl group-hover:shadow-primary/5 transition-all duration-500 border relative overflow-visible h-full flex flex-col">
        <div className="p-6 lg:p-7 space-y-6 flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-block px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                  Cambio
                </div>
                {item.concepto && (
                  <div className="inline-block px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    C-{item.concepto}
                  </div>
                )}
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight line-clamp-2">
                {item.categoriaDesc}
              </h3>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <div className="rounded-3xl bg-gradient-to-br from-amber-500/5 to-amber-500/[0.02] border border-amber-500/10 p-4 text-center min-w-[90px] shadow-inner relative group-hover:from-amber-500 group-hover:to-amber-600 transition-all duration-500">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 group-hover:text-white/80 transition-colors mb-0.5">
                  Lugar
                </p>
                <span className="text-3xl font-black text-slate-900 dark:text-white group-hover:text-white transition-colors">
                  {item.lugar}
                </span>
              </div>
            </div>
          </div>

          {/* Info Row */}
          <div className="flex flex-col gap-3 py-4 border-y border-slate-50 dark:border-slate-800/50 mt-auto">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                <Briefcase className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />
              </div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight truncate">
                {item.tipo}
              </span>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                <MapPin className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />
              </div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight truncate">
                {item.grupoUnidad} · {item.grupoTurno}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2">
            <Button
              onClick={() => {
                setCambiosDetalle(item);
                setIsCambiosModalOpen(true);
              }}
              className="w-full rounded-2xl h-12 px-6 font-black bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 dark:hover:text-white transition-all group/btn shadow-md hover:shadow-amber-500/20 text-xs uppercase tracking-widest border-none"
            >
              VER DETALLES
              <ArrowRight className="ml-2 h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  ));
}
```

- [ ] **Step 6: Agregar modal de cambios**

Despues del modal de escalafon existente (~linea 899, despues del cierre de `</Dialog>`), agregar:

```tsx
{
  /* MODAL CAMBIOS ESCALAFÓN */
}
{
  ESCALAFON_HABILITADO && (
    <Dialog
      open={isCambiosModalOpen}
      onOpenChange={(open) => {
        setIsCambiosModalOpen(open);
        if (!open) setCambiosDetalle(null);
      }}
    >
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[88vh] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-slate-200/50 dark:border-slate-800/50 rounded-[2rem] p-0 overflow-hidden shadow-2xl">
        <div className="overflow-y-auto max-h-[88vh]">
          <div className="relative p-5 sm:p-7">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />
            <div className="relative">
              <DialogHeader className="flex flex-row items-center justify-between mb-4">
                <div className="space-y-0.5 text-left min-w-0 flex-1 mr-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">
                    <ShieldCheck className="h-3 w-3" />
                    Cambio de Escalafón
                  </div>
                  {cambiosDetalle && (
                    <DialogTitle className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                      {cambiosDetalle.categoriaDesc}
                    </DialogTitle>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCambiosModalOpen(false)}
                  className="rounded-full h-9 w-9 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogHeader>

              {cambiosDetalle && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {/* Hero */}
                  <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-amber-600 to-amber-700 dark:from-amber-700 dark:to-amber-900 py-6 px-5 text-center shadow-lg">
                    <div className="absolute top-0 right-0 p-5 opacity-5">
                      <TrendingUp className="w-20 h-20" />
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-200 mb-0.5">
                      Tu posición
                    </p>
                    <p className="text-sm font-black uppercase tracking-widest text-white/80 mb-2">
                      {cambiosDetalle.grupoUnidad} · {cambiosDetalle.grupoTurno}
                    </p>
                    <span className="text-6xl sm:text-7xl font-black text-white tracking-tighter leading-none">
                      {cambiosDetalle.lugar}
                    </span>
                    <p className="text-sm font-bold text-amber-200 mt-2">
                      de {cambiosDetalle.totalEnGrupo}
                    </p>
                  </div>

                  {/* Detalles */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-0.5">
                      Detalles de la solicitud
                    </p>
                    <div className="grid gap-2">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-20 shrink-0">
                          Tipo
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                          {cambiosDetalle.tipo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-20 shrink-0">
                          Zona
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                          {cambiosDetalle.zona}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-20 shrink-0">
                          Unidad
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                          {cambiosDetalle.adscripcionSolicitada}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-20 shrink-0">
                          Turno
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                          {cambiosDetalle.turnoSolicitado}
                        </span>
                      </div>
                      {cambiosDetalle.concepto && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-20 shrink-0">
                            Concepto
                          </span>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                            C-{cambiosDetalle.concepto}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-20 shrink-0">
                          Emision
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {cambiosDetalle.fechaEmision}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => setIsCambiosModalOpen(false)}
                    className="w-full rounded-2xl h-11 font-black bg-slate-900 dark:bg-white dark:text-slate-900 hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-lg"
                  >
                    CERRAR
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7: Verificar tipos y lint**

Run: `npm run check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/(main)/dashboard/page.tsx
git commit -m "feat(cambios): integrate cambios cards and modal in worker dashboard"
```

---

### Task 7: Script de migracion para registros existentes

**Files:**

- Create: `scripts/migrations/materializar-cambios-posiciones.ts`

- [ ] **Step 1: Crear el script**

```ts
/**
 * Migracion one-shot: materializar posiciones en cambios_registros existentes.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
 *     npx tsx scripts/migrations/materializar-cambios-posiciones.ts
 */
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  calcularPosicionesCambios,
  claveRegistro,
} from "../../src/lib/cambios-escalafon/position-engine";
import type { CambiosRegistro } from "../../src/types/cambios-escalafon";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serviceAccount = require(credPath) as ServiceAccount;
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  // 1. Obtener todos los listados
  const listadosSnap = await db.collection("cambios_listados").get();
  console.log(`Listados encontrados: ${listadosSnap.size}`);

  let totalActualizados = 0;

  for (const listadoDoc of listadosSnap.docs) {
    const listadoId = listadoDoc.id;
    const listado = listadoDoc.data();
    console.log(
      `\nProcesando: ${listado.categoriaDesc} (${listado.concepto || "sin concepto"}) — ${listadoId}`,
    );

    // 2. Obtener registros del listado
    const registrosSnap = await db
      .collection("cambios_registros")
      .where("listadoId", "==", listadoId)
      .get();

    if (registrosSnap.empty) {
      console.log("  Sin registros, skip.");
      continue;
    }

    const registros = registrosSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as CambiosRegistro,
    );

    // 3. Calcular posiciones
    const posiciones = calcularPosicionesCambios(registros);

    // 4. Mejor posicion por registro
    const mejorPorRegistro = new Map<
      string,
      { lugar: number; totalEnGrupo: number; unidad: string; turno: string }
    >();
    for (const p of posiciones) {
      const k = claveRegistro(p.registro);
      const prev = mejorPorRegistro.get(k);
      if (!prev || p.lugar < prev.lugar) {
        mejorPorRegistro.set(k, {
          lugar: p.lugar,
          totalEnGrupo: p.totalEnGrupo,
          unidad: p.unidad,
          turno: p.turno,
        });
      }
    }

    // 5. Actualizar en batches
    const BATCH_SIZE = 400;
    const docs = registros.filter((r) =>
      mejorPorRegistro.has(claveRegistro(r)),
    );

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const r of docs.slice(i, i + BATCH_SIZE)) {
        const best = mejorPorRegistro.get(claveRegistro(r))!;
        batch.update(db.collection("cambios_registros").doc(r.id!), {
          lugar: best.lugar,
          totalEnGrupo: best.totalEnGrupo,
          grupoUnidad: best.unidad,
          grupoTurno: best.turno,
        });
      }
      await batch.commit();
    }

    console.log(`  ${docs.length} registros actualizados.`);
    totalActualizados += docs.length;
  }

  console.log(`\nTotal registros actualizados: ${totalActualizados}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrations/materializar-cambios-posiciones.ts
git commit -m "feat(cambios): add migration script for existing cambios positions"
```

---

### Task 8: Verificacion end-to-end

- [ ] **Step 1: Correr check completo**

Run: `npm run check`
Expected: PASS

- [ ] **Step 2: Correr tests del motor**

Run: `npx vitest run src/lib/cambios-escalafon/`
Expected: PASS (7+ tests)

- [ ] **Step 3: Correr migracion en produccion**

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
  npx tsx scripts/migrations/materializar-cambios-posiciones.ts
```

Expected: listados procesados con registros actualizados.

- [ ] **Step 4: Verificar en dev**

Run: `npm run dev`
Navegar al dashboard como trabajador con matricula que tenga registros de cambios.
Verificar que la seccion "Mi Escalafon" muestra cards de cambios con badge "Cambio".
Verificar que el modal muestra posicion, tipo, zona, unidad, turno.

- [ ] **Step 5: Commit final si hay ajustes**

```bash
git add -A
git commit -m "feat(cambios): portal trabajador — cambios de escalafon positions"
```
