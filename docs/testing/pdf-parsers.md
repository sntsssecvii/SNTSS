# PDF Parsers

## Objetivo

Definir una forma estable de probar y depurar el pipeline de extraccion PDF/Excel sin mezclar fixtures, codigo productivo y resultados temporales.

## Fuentes de verdad

- Codigo productivo:
  - `src/lib/pdf/`
  - `src/lib/excel/`
- Fixtures versionados:
  - `src/assets/PDFs/`
- Scripts manuales:
  - `scripts/tests/`
  - `scripts/debug/`
- Artefactos generados:
  - `artifacts/pdf-tests/`

## Comandos actuales

```bash
npm run pdf:test
npm run pdf:test:nuevo-ingreso
```

## Regla operativa

- Los PDFs/XLSX usados como fixtures pueden vivir versionados si forman parte del set de pruebas.
- Los resultados de comparacion, dumps JSON, resúmenes TXT y salidas experimentales no deben guardarse en `scripts/`.
- Si una prueba necesita inspeccion manual, debe escribir a `artifacts/pdf-tests/`.
- Los XLSX derivados de conversion o comparación deben ir a `artifacts/` o ignorarse; no deben considerarse fixtures fuente.

## Siguiente limpieza recomendada

- Mover resultados historicos versionados en `scripts/` hacia `artifacts/` o eliminarlos del control de version cuando ya no aporten valor.
- Separar `scripts/` por subcarpetas (`tests/`, `debug/`, `ops/`) cuando el flujo actual se estabilice.
- Crear fixtures reducidos para pruebas rapidas y dejar los archivos grandes como fixtures de integracion.
