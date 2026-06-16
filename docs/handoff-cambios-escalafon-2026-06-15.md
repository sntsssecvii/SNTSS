# Handoff — Cambios de escalafón, posiciones y reactivación de escalafón (2026-06-15)

Contexto completo de la sesión para retomar el trabajo (incluyendo desde otra máquina).

## Resumen ejecutivo

Sesión enfocada en el módulo **cambios de escalafón** (distinto del escalafón de listados): se arregló la extracción del PDF, se construyó el **motor de posiciones** con su UI, se corrigió la **identidad de listado por área** (se perdían personas), y se **reactivó escalafón** en el portal del trabajador.

Resultado: **4 PRs abiertos** (ver más abajo). Nada mergeado aún al momento de cerrar.

---

## 1. Parser de cambios — reescritura por coordenadas (PR #50)

**Problema:** el parser viejo (Adobe → patrones de valor) producía datos mal extraídos: área = número de zona/hospital, adscripción solicitada vacía (perdía `0-INCONDICIONAL`), nombre pegado con adscripción origen, No. Solicitud metido en el campo hora.

**Solución:** extracción por **coordenadas x/y con pdfjs** en `src/lib/pdf/parsers/cambios-escalafon.ts`:

- `construirRegistrosPorCoordenadas` / `detectarAnclasColumnas` / `columnaDe`: asignan cada item de texto a su columna por posición x; las anclas se derivan del encabezado (generaliza a cualquier listado SIAP). Fusiona celdas multilínea por columna; separa matrícula/nombre dentro de su banda.
- `META_RE` anclado para no descartar filas cuya adscripción contiene `SUBDELEGACION` / `DELEGACION REGIONAL` / `HOSPITAL DE ESPECIALIDADES`.
- Ancla de No. Solicitud con `\bSOLICITUD\b` para no matchear `SOLICITUDES` del título.
- Es el **camino primario**; Adobe/texto quedan de fallback.

**Carga de pdfjs (crítico para Next/Vercel):**

- `next.config.mjs`: `experimental.serverComponentsExternalPackages: ["pdfjs-dist"]` (la clave `serverExternalPackages` es de Next 15 y en Next 14 se ignoraba en silencio → pdfjs se empaquetaba y fallaba en runtime, cayendo al parser viejo de Adobe).
- pdfjs se carga con el **build legacy** (`pdfjs-dist/legacy/build/pdf.mjs`) y **sin setear `workerSrc`** (fake worker en el hilo principal). El `require.resolve` del worker `.mjs` rompía `next build` al externalizar — mismo arreglo aplicado en `escalafon-condicionalidad.ts`.

**Validación:** 31 listados reales, 100% por coordenadas, 0 fallbacks. `npm run build` OK. Tests del parser (8) en `cambios-escalafon.coordenadas.test.ts`.

---

## 2. Motor de posiciones de cambios (PR #51)

`src/lib/cambios-escalafon/position-engine.ts` — `calcularPosicionesCambios`.

**Reglas confirmadas con la Subcomisión:**

- **Cada listado es independiente** (no se combinan 014 / 054 / sin concepto; cada uno da su propio lugar).
- **Grupo de competencia** = `zona + unidad (adscripción) solicitada + turno solicitado`. El turno se compara **exacto** (INCONDICIONAL es su propio turno).
- **Orden dentro del grupo** (todos los tipos compiten en UN ranking; el tipo manda sobre la fecha):
  `1 TURNO · 2 ÁREA · 3 TIPO DE PLAZA · 4 ADSCRIPCIÓN(percibe concepto) · 5 ADSCRIPCIÓN(no percibe) · 6 RESIDENCIA`.
  A igual rango, por **fecha + hora de registro** (más antiguo = lugar 1).
- **Incondicional** (`0-INCONDICIONAL`) cuenta en **cada unidad concreta** de la zona, conservando su turno.

**Caso de validación real:** listado 054 ENF. ESP. QUIRÚRGICA, zona Ensenada, mat **99025086** (GÓMEZ/ROJAS/PATRICIA, cambio de turno nocturno a HGZ C/MF 08, registrada 04/01/2023) = **lugar #1** (compite solo con la otra solicitud de turno nocturno a la 8).

**UI (igual que escalafón):** en `src/app/(main)/admin/escalafon/cambios/[loteId]/[listadoId]/page.tsx`:

- Columna **"Lugar"** (#N de M) + campo en el modal.
- Sección **"Quiénes están arriba"** por grupo (unidad · turno).
- Se calcula **al vuelo** en `GET /api/cambios-escalafon/[listadoId]` (NO se materializa → no requiere re-subir).

**Asunción pendiente de confirmar:** que el turno NO se subdivide por "percibe" (solo la adscripción). Derivado del ejemplo; validar con más casos.

Tests (6) en `position-engine.test.ts`.

---

## 3. Fix de identidad de listado por ÁREA (PR #52)

**Problema reportado:** "no aparecen todas las personas". Varias especialidades comparten la misma `categoriaCode` y se distinguen solo por el **área**:

| categoriaCode + concepto | Listados que colisionan | Áreas |
| --- | --- | --- |
| `22210080` + `""` | CUIDADOS INTENSIVOS, PEDIATRÍA, QUIRÚRGICA | 248, 232, 216 |
| `22210080` + `014` | CUIDADOS INTENSIVOS, PEDIATRÍA | 248, 232 |
| `23210080` + `""` | JEFE DE PISO HOSPITAL, MEDICINA FAMILIA | 284, 204 |

El **auto-reemplazo** borraba por `categoriaCode + concepto` → al subir varias especialidades solo sobrevivía la última → personas perdidas y posiciones incompletas.

**Solución:**

- `CambiosListado.area` (derivada de los registros; uniforme por listado; 0 si no se determina).
- `obtenerListadoVigenteCambios(categoriaCode, concepto, area)`: reemplaza por `cat + concepto + área`; un doc legacy sin área se reemplaza al re-subir (migra el colapsado).
- Badge **"Área NNN"** en la lista de listados (`[loteId]/page.tsx`) para distinguir especialidades.

**Pendiente operativo:** tras desplegar, **re-subir** los listados de ENF. ESP. y JEFE DE PISO que ya colapsaron.

> Nota: el PDF NO se almacena (se procesa en tmp y se borra). Firebase guarda solo data parseada (`cambios_listados`, `cambios_registros`). Para corregir un listado hay que re-subir el PDF.

---

## 4. Reactivación de escalafón en el portal del trabajador (PR #54)

- Estuvo apagado esta quincena porque los trabajadores veían **posiciones incorrectas** (no se contemplaban los incondicionales).
- Se corrigió en el motor de escalafón (PR #47, migraciones aplicadas); las posiciones materializadas que lee `/api/trabajador/escalafon-posicion` (`posicionesActivoPorZona`/`posicionesPeiPorZona`) ya están validadas.
- Cambio: `ESCALAFON_HABILITADO = true` en `src/app/(main)/dashboard/page.tsx` (gatea fetch + 2 bloques de render).
- **Cambios (cambios-escalafón) sigue OFF para el trabajador** a propósito: no hay endpoint ni UI de trabajador que lo consuma. Sus posiciones son solo admin.

---

## PRs y orden de merge

| PR | Rama | Qué | Depende de |
| --- | --- | --- | --- |
| #54 | `chore/habilitar-escalafon-trabajador` | Encender escalafón (trabajador) | nada |
| #50 | `fix/cambios-pdfjs-loader` | Parser cambios + fixes de build pdfjs | nada |
| #51 | `feat/cambios-posiciones` | Motor de posiciones + UI admin | #50 |
| #52 | `fix/cambios-reemplazo-por-area` | Fix de área (no perder personas) | #50 |

**Orden sugerido:** #54 (urgente, independiente) → #50 → #51 y #52.
Tras desplegar #50/#52: **re-subir** listados de ENF. ESP. y JEFE DE PISO.

Rama local `integ/cambios-local` integra #50+#51+#52 para pruebas (no se empuja; recrear si hace falta con merges de las 3 ramas).

---

## Pendientes / próximos pasos

1. Mergear PRs en el orden de arriba y desplegar.
2. Re-subir los listados de cambios que colapsaron (ENF. ESP., JEFE DE PISO) para separarlos por especialidad.
3. Confirmar la asunción del motor: ¿el turno se subdivide por "percibe" o no?
4. (Opcional) Quitar cosméticamente el sufijo " 80" del título mostrado de las categorías (viene del SIAP; es el sufijo del código de categoría, no un error).
5. (Opcional) Mostrar el área/especialidad también en el detalle del listado, no solo en la lista.

## Archivos clave

- Parser: `src/lib/pdf/parsers/cambios-escalafon.ts`
- Motor posiciones: `src/lib/cambios-escalafon/position-engine.ts`
- Firebase cambios: `src/lib/firebase/cambios-escalafon.ts`
- API admin: `src/app/api/cambios-escalafon/[listadoId]/route.ts` (GET, calcula lugares) y `procesar/route.ts` (auto-reemplazo por área)
- UI admin: `src/app/(main)/admin/escalafon/cambios/[loteId]/page.tsx` (lista) y `[loteId]/[listadoId]/page.tsx` (detalle)
- Tipos: `src/types/cambios-escalafon.ts`
- Trabajador escalafón: `src/app/(main)/dashboard/page.tsx` (flag) y `src/app/api/trabajador/escalafon-posicion/route.ts`
