# Handoff — Fix de posiciones de escalafón (2026-06-15)

Estado del trabajo sobre bugs de posiciones en el módulo de escalafón.
Rama: `fix/escalafon-zona-incondicional-truncada` · PR: **#47**

## Contexto

Se reportó que las posiciones de escalafón estaban mal: aspirantes que piden una
zona específica aparecían mejor rankeados de lo que les corresponde, porque los
**incondicionales** con mejor lugar no se contaban en el ranking de esa zona.

Caso real verificado: **LIERA RIVERA CLAUDIA RAFAELA** (mat 98021014, lugar 16,
Activo) salía **#1** en Ensenada cuando debía ser **#3** — dos incondicionales
Activos (lugar 14 y 15) con mejor lugar también cubren Ensenada.

## Bugs corregidos (3 commits en PR #47)

### 1. Zona incondicional truncada/multilínea — `ac5dc16`
El parser por columnas (Adobe) guardaba la zona como `"0\r\nINCONDICIONA"`
(salto de línea + truncada sin la "L"). `esIncondicional()` exigía el texto
completo → no la reconocía → esos aspirantes no calificaban para ninguna zona.

- `src/lib/escalafon/position-engine.ts` — `esIncondicional()` ahora matchea la
  raíz `INCONDICION` con dígitos opcionales (tolerante a `\r\n` y truncados)
- `src/lib/pdf/parsers/escalafon-condicionalidad.ts` — `normalizarZona()` limpia
  la celda al extraer de columnas
- test de regresión con el caso real (Claudia → #3)
- migración `scripts/migrations/escalafon-fix-zonas-incondicional.ts`

### 2. Fila de encabezado como preferencia espuria — `b9b7ffc`
El parser agregaba la fila de encabezado que el PDF repite por página como una
preferencia extra del último aspirante → zona fantasma `"ZONA SOLICITADA"`.

- `escalafon-condicionalidad.ts` — `esFilaEncabezadoColumnas()` detecta y salta
  la fila de encabezado
- tests unitarios de `normalizarZona()` y `esFilaEncabezadoColumnas()`
- migración `scripts/migrations/escalafon-quitar-preferencia-encabezado.ts`

### 3. Estabilización del test del parser — `fc6a6fc`
El test dependía de Adobe en vivo (no determinista) y esperaba una advertencia
de conteo que no existía.

- fixtures Excel congelados en `src/lib/pdf/parsers/__tests__/fixtures/*.adobe.xlsx`
  + mock de `AdobePdfService.convertPdfToExcel` (test ~18s → ~1.3s, determinista)
- `agregarAdvertenciaConteo()` implementada en ambas rutas (Adobe + fallback)
- script para regenerar fixtures: `scripts/tests/capturar-fixtures-adobe-escalafon.ts`

## Datos de producción ya migrados

Ambas migraciones se aplicaron a Firestore de producción (corren en dry-run por
defecto; se aplicaron con `--apply`):

| Migración | Aspirantes | Listados |
|-----------|-----------|----------|
| Zona incondicional truncada | 80 | 16 |
| Preferencia encabezado espuria | 52 | 19 |

Verificación post-migración: `0` zonas `"ZONA SOLICITADA"`, `0` con `\r\n`,
`0` incondicionales truncadas. Caso de Claudia confirmado:
`posicionesActivoPorZona["1 ENSENADA"] = 3`.

## Validación

- `npm run check` (typecheck + lint) limpio
- Tests del motor: 13/13 · Tests del parser: 14/14 (determinista)
- `npm run pdf:test:escalafon`: 35/35 PASS

## ⏳ Pendiente para continuar

### Bug preexistente: `generarNombreLote` (6 tests rotos)
`src/lib/firebase/__tests__/escalafon-lotes.test.ts` falla con **6 tests**.
Es **preexistente en `main`** (vino del merge de las ramas de escalafón), no de
este trabajo. Conflicto de formato:

- **Implementación actual** (`src/lib/firebase/escalafon-lotes.ts:23`):
  `"1 Abr 2026"` (fecha simple)
- **Test espera:** `"Abril 2026 · Q1"` (con quincena: días 1-15 = Q1, 16-31 = Q2)

**Decisión de producto pendiente:** ¿los lotes se nombran por quincena o por
fecha simple? El test sugiere que la intención era quincenas. Hay también
`generarNombreLoteCambios()` en `cambios-escalafon-lotes.ts:23` — revisar si
debe quedar consistente.

**Siguiente paso:** decidir formato, alinear implementación ↔ test, y fix aparte.

### Otras notas
- `npm run dev` corre en :3001 (el :3000 estaba ocupado en la sesión)
- Warning no crítico en `next.config.mjs`: `serverExternalPackages` no
  reconocido en Next 14 (va como `experimental.serverComponentsExternalPackages`)
