# Scripts

Este directorio contiene utilidades manuales y pruebas locales. No todo lo que vive aqui forma parte del flujo estable de la app.

## Estructura

- `ops/`: tareas operativas y soporte Firebase
- `tests/`: pruebas manuales o de regresion
- `debug/`: investigacion y debugging
- raiz de `scripts/`: documentacion local y artefactos legacy ignorados

## Ubicaciones principales

- Operacion:
  - `ops/diagnostico-completo.sh`
  - `ops/verificar-firestore-real.sh`
  - `ops/verificar-reglas-firestore.js`
  - `ops/verificar-usuario-firestore.js`
  - `ops/crear-documento-usuario.js`
  - `ops/crear-usuario-firestore.js`
  - `ops/solucionar-login.sh`
  - `ops/abrir-firebase-console.sh`
- Pruebas:
  - `tests/test-parsers.ts`
  - `tests/test-nuevo-ingreso.ts`
  - `tests/test-pdfplumber-bridge.ts`
  - `tests/test-pdfplumber-integrated.ts`
  - `tests/test_excel_parser.ts`
  - `tests/test_excel_parser.mjs`
  - `tests/test_real_excel.js`
  - `tests/test_posiciones.js`
  - `tests/validate_categories.js`
- Debug:
  - `debug/debug-pdf.js`
  - `debug/test-regex.js`
  - `debug/spike-table-extraction.ts`
  - `debug/inspect_excel.js`
  - `debug/inspect_hoja2.js`
  - `debug/analyze_excel.py`
  - `debug/analyze_layouts.py`
  - `debug/diagnose_pdf.py`
  - `debug/debug_extraction.js`
  - `debug/debug_regex.js`
  - `debug/tdd_cambios_area.mjs`
  - `debug/tdd_parsers_final.mjs`
  - `debug/extraer-validar-excel.ts`

## Convenciones

- Las salidas generadas deben ir a `artifacts/`, no a `scripts/`.
- Si un script escribe archivos, debe crear su carpeta de salida con `mkdir -p` o equivalente.
- Si agregas un script temporal, documenta aqui si es `debug`, `test`, `operativo` o `migration`.
- Evita usar scripts de este directorio como dependencia implicita del runtime de la app.

## Fixtures y artefactos

- Fixtures versionados de PDF viven en `src/assets/PDFs/`.
- Resultados locales, comparativas y dumps deben vivir en `artifacts/pdf-tests/`.
- Archivos efimeros o basura local deben vivir en `tmp/`.
