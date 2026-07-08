# Handoff — Cambios de escalafón: parser en producción, posiciones y naming (2026-07-08)

Contexto completo de la sesión para retomar desde otra máquina. Continúa el
handoff del [15-jun](./handoff-cambios-escalafon-2026-06-15.md).

## Resumen ejecutivo

Al subir listados de enfermería (Enf. Especialista 80) aparecieron datos mal
extraídos en producción. Se encontró la **causa raíz** (pdfjs fallaba en el
runtime de Vercel y caía al parser viejo de Adobe), se corrigió, y de paso se
ajustó la **regla de incondicionales** del motor, se agregó una **herramienta
para eliminar listados** desde la UI y el **nombrado de listados de enfermería
por área**.

Resultado: **3 PRs mergeados a `main`** (#64, #65, #66), desplegados.

---

## 1. Defecto raíz — parser caía al fallback de Adobe en producción (PR #64)

**Síntomas** (listado subido hoy, guardado con basura): `especialidadArea` = el
dígito de la zona (1, 2, 6, 7…) en vez de 216; incondicionales con
`adscripcionSolicitada: ""` (perdían `0-INCONDICIONAL`); nombre pegado con la
adscripción de origen cuando ésta era de dos líneas; header vacío
(`delegacion`, `concepto`, `fechaEmision` = "").

**Diagnóstico:** correr el parser localmente daba resultado **perfecto** (62
registros, área 216, incondicionales OK). Es decir, el **código del parser
estaba bien**; el problema era de runtime. Los logs de producción (Vercel)
mostraron:

```
[cambios] coordenadas falló, probando Adobe/texto: Error: Setting up fake worker failed:
"Cannot find module '/var/task/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'".
```

pdfjs v4 (build legacy) importa **dinámicamente** su worker `pdf.worker.mjs`.
Al externalizar pdfjs (`serverComponentsExternalPackages`), el file-tracing de
Vercel (`@vercel/nft`) **no detectaba ese import dinámico** y el `.mjs` quedaba
fuera del Lambda → pdfjs tronaba → caía al fallback de Adobe → extracción mala.
Localmente el archivo existe, por eso sólo fallaba en producción.

**Fix** (`next.config.mjs`): `experimental.outputFileTracingIncludes` fuerza a
empaquetar `pdf.worker.mjs` en las rutas que procesan PDF:

```js
outputFileTracingIncludes: {
  "/api/cambios-escalafon/procesar": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  "/api/escalafon/procesar": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
}
```

**Validación:** `npm run build` OK; el worker aparece en los
`route.js.nft.json` de ambas rutas. Post-deploy: los listados re-subidos hoy
salen limpios (área 216/284/204, header completo).

---

## 2. Regla del motor — incondicional compite en todos los turnos (PR #64)

**Antes:** un incondicional (`0-INCONDICIONAL`, turno "INCONDICIONAL") conservaba
su turno y sólo rankeaba contra otros incondicionales → quedaba siempre #1 en su
propio grupo aislado.

**Ahora:** un incondicional acepta cualquier turno, así que compite en **cada
unidad de su zona y en cada turno solicitado en esa unidad**, contra las
solicitudes concretas, ordenado por prelación (TIPO) + antigüedad.

**Caso de validación (EVODIA, HGR 01 vespertino, 10/03 12:03):** con dos
incondicionales previos (05/03 y 10/03 09:09) queda **#3**, como en el PDF.
Confirmado con la Subcomisión. Verificado además con datos reales del listado
de Quirúrgica (incondicionales de Tijuana compitiendo en HGR 20 en los tres
turnos).

Archivo: `src/lib/cambios-escalafon/position-engine.ts`
(`calcularPosicionesCambios`, distribución de incondicionales por
`turnosPorUnidad`). Tests en `position-engine.test.ts` (7, incluye caso EVODIA).

---

## 3. Eliminar listado con confirmación (PR #65)

Antes sólo se podía reemplazar un listado re-subiendo el PDF (auto-reemplazo por
`categoría + concepto + área`). Si un listado quedaba con metadata mala (área o
concepto incorrectos), el re-subir no lo pisaba y quedaba huérfano, sin forma de
borrarlo desde la UI.

- **API:** `DELETE` en `/api/cambios-escalafon/[listadoId]` y
  `/api/escalafon/[listadoId]` (auth admin, rate-limit, auditoría). Borra el
  listado + sus registros/aspirantes y decrementa el total del lote.
- **UI:** botón de basura en cada tarjeta con `AlertDialog` de confirmación
  (muestra categoría, concepto y # de registros). La tarjeta pasó de `<button>`
  a `<div role="button">` para HTML válido (permite el botón anidado).

---

## 4. Nombrado de listados de enfermería por área (PR #65 + #66)

El SIAP no incluye la especialidad en el nombre de la categoría: todas las
especialistas salen como "ENFERMERA ESPECIALISTA 80" (22210080) y las jefas de
piso como "ENFERMERA JEFE DE PISO 80" (23210080). El **código de área** las
distingue, pero **no es único entre bases** (el área 204 = Medicina de Familia
existe para especialista y para jefe de piso). Por eso el nombre depende de la
**base** (nombre del SIAP) **y** el área. Dos mapas en
`src/lib/cambios-escalafon/especialidades-enfermeria.ts`:

**ENFERMERA ESPECIALISTA (22210080):**

| Área | Nombre |
| --- | --- |
| 204 | ENFERMERA ESPECIALISTA EN MEDICINA DE FAMILIA |
| 216 | ENFERMERA ESPECIALISTA QUIRÚRGICA |
| 226 | ENFERMERA ESPECIALISTA EN NEFROLOGÍA |
| 232 | ENFERMERA ESPECIALISTA PEDIATRA |
| 239 | ENFERMERA ESPECIALISTA EN GERIATRÍA |
| 245 | ENFERMERA ESPECIALISTA EN ONCOLOGÍA |
| 248 | ENFERMERA ESPECIALISTA EN CUIDADOS INTENSIVOS |

**ENFERMERA JEFE DE PISO (23210080):**

| Área | Nombre |
| --- | --- |
| 204 | ENFERMERA JEFE DE PISO MEDICINA DE FAMILIA |
| 284 | ENFERMERA JEFE DE PISO 80 *(nombre del SIAP, sin cambio)* |

Notas: el área **200 no existe** (se descartó). El **284** es el jefe de piso
genérico: no se mapea, conserva el nombre del SIAP. Sólo aplica a categorías de
enfermería; si el área no está mapeada, conserva el nombre original. Se muestra
en la tarjeta del lote y el header del detalle. Tests (5).

---

## PRs de la sesión

| PR | Qué | Estado |
| --- | --- | --- |
| #64 | Worker pdfjs en trace de Vercel + regla incondicional + scripts | Merged |
| #65 | Eliminar listado con confirmación + naming enfermería | Merged |
| #66 | Distinguir especialista vs jefe de piso (área 204/284) | Merged |

> Nota operativa: el #64 se mergeó con sólo 3 commits; las features de eliminar
> listado y naming (que se habían empujado después) se re-abrieron como #65.

---

## Estado y pendientes

**Verificado:** extracción limpia en producción (Quirúrgica 216, Jefe de Piso
284/204), regla de incondicionales con datos reales, naming enfermería.

**Pendiente:**
1. **Verificar caso EVODIA (#3):** su matrícula `99029340` aún no tiene registros
   (su listado —otra especialidad— no se ha re-subido). Al subirlo, validar #3.
2. **Naming de enfermería en escalafón (listados):** sólo se aplicó en cambios.
   Escalafón usa `areaCode`/`areaDesc` (modelo distinto); replicar si se quiere.
3. Re-subir el resto de especialidades de enfermería que hayan quedado por subir.

---

## Archivos clave

- Config Vercel/pdfjs: `next.config.mjs`
- Parser cambios: `src/lib/pdf/parsers/cambios-escalafon.ts`
- Motor posiciones: `src/lib/cambios-escalafon/position-engine.ts` (+ `.test.ts`)
- Naming enfermería: `src/lib/cambios-escalafon/especialidades-enfermeria.ts` (+ `.test.ts`)
- API cambios: `src/app/api/cambios-escalafon/[listadoId]/route.ts` (GET + DELETE),
  `procesar/route.ts`
- API escalafón: `src/app/api/escalafon/[listadoId]/route.ts` (GET + DELETE)
- UI cambios: `src/app/(main)/admin/escalafon/cambios/[loteId]/page.tsx` (lista + borrar + naming),
  `[loteId]/[listadoId]/page.tsx` (detalle + naming)
- UI escalafón: `src/app/(main)/admin/escalafon/[loteId]/page.tsx` (lista + borrar)
- Scripts: `scripts/tests/validate-cambios-posiciones.ts` (valida el motor sobre
  datos reales de Firestore), `scripts/tests/run-parser-cambios.ts` (corre el
  parser sobre un PDF y muestra qué camino tomó).

## Cómo re-validar

```bash
npm run check                                   # typecheck + lint
npx vitest run src/lib/cambios-escalafon/       # tests del motor y naming
# validar posiciones sobre datos reales de Firestore:
GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
  npx tsx scripts/tests/validate-cambios-posiciones.ts
# correr el parser sobre un PDF concreto:
npx tsx scripts/tests/run-parser-cambios.ts "<ruta-al-pdf>"
```
