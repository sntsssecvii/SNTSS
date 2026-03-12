# Fixtures PDF/XLSX

## Objetivo

Esta carpeta contiene fixtures usados para probar extracción y parsing.

## Qué sí debe vivir aquí

- PDFs fuente usados en pruebas
- XLSX fuente entregados como insumo real cuando forman parte del set de prueba

## Qué no debe considerarse fixture fuente

- `*_CONVERTED.xlsx`
- `*_ADOBE.xlsx`
- `*_PLUMBER.xlsx`
- `*_RESULT.xlsx`

Esos archivos son salidas derivadas o comparativas. Deben ir a `artifacts/` o mantenerse ignorados por Git.

## Regla práctica

Si un archivo puede regenerarse desde otro insumo, no pertenece como fixture estable en esta carpeta.
