/**
 * Spike: comparar métodos de extracción de tablas PDF.
 *
 * 1. pdf-parse getText() (actual) - texto plano
 * 2. pdf-parse getTable() - tablas nativas
 * 3. pdfjs-dist getTextContent() - texto con coordenadas
 *
 * Uso: npx tsx scripts/debug/spike-table-extraction.ts
 */

import fs from 'fs'
import path from 'path'

const PDF_PATH = path.join(__dirname, '..', '..', 'src', 'assets', 'PDFs', 'CAMBIOS DE ÁREA.pdf')

async function testPdfParseGetText() {
  console.log('\n=== 1. pdf-parse getText() (actual) ===')
  const { PDFParse } = require('pdf-parse')
  const buf = fs.readFileSync(PDF_PATH)
  const parser = new PDFParse({ data: buf })

  const start = Date.now()
  const result = await parser.getText()
  const elapsed = Date.now() - start

  const lines = result.text.split('\n').filter((l: string) => l.trim())
  const dataLines = lines.filter((l: string) => /\b\d{7,10}\b/.test(l) && /\d{2}\/\d{2}\/\d{4}/.test(l))

  console.log(`  Tiempo: ${elapsed}ms`)
  console.log(`  Total líneas: ${lines.length}`)
  console.log(`  Líneas con datos (matrícula+fecha): ${dataLines.length}`)
  console.log(`  Ejemplo línea:`, dataLines[0]?.substring(0, 120))

  await parser.destroy()
}

async function testPdfParseGetTable() {
  console.log('\n=== 2. pdf-parse getTable() ===')
  const { PDFParse } = require('pdf-parse')
  const buf = fs.readFileSync(PDF_PATH)
  const parser = new PDFParse({ data: buf })

  const start = Date.now()
  const result = await parser.getTable()
  const elapsed = Date.now() - start

  let totalRows = 0
  let dataRows = 0
  const allDataRows: string[][] = []

  for (const page of result.pages) {
    for (const table of page.tables) {
      for (const row of table) {
        totalRows++
        // Data rows: first cell is a number, second cell has content
        if (row.length >= 2 && /^\d+$/.test(row[0].trim()) && row[1].length > 10) {
          dataRows++
          allDataRows.push(row)
        }
      }
    }
  }

  console.log(`  Tiempo: ${elapsed}ms`)
  console.log(`  Total páginas: ${result.pages.length}`)
  console.log(`  Total filas: ${totalRows}`)
  console.log(`  Filas con datos: ${dataRows}`)
  if (allDataRows.length > 0) {
    console.log(`  Ejemplo fila (${allDataRows[0].length} celdas):`)
    for (let c = 0; c < allDataRows[0].length; c++) {
      console.log(`    Celda ${c}: "${allDataRows[0][c].substring(0, 80)}"`)
    }
  }

  await parser.destroy()
}

async function testPdfjsDistTextContent() {
  console.log('\n=== 3. pdfjs-dist getTextContent() ===')

  let pdfjsLib: any
  try {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  } catch {
    try {
      pdfjsLib = await import('pdfjs-dist')
    } catch (e: any) {
      console.log(`  SKIP: pdfjs-dist no se pudo importar: ${e.message}`)
      console.log(`  Para probarlo, ejecutar: npm install pdfjs-dist@latest`)
      return
    }
  }

  const buf = new Uint8Array(fs.readFileSync(PDF_PATH))

  let doc: any, page: any, textContent: any
  const start = Date.now()
  try {
    doc = await pdfjsLib.getDocument({ data: buf, disableWorker: true }).promise
    page = await doc.getPage(1)
    textContent = await page.getTextContent()
  } catch (e: any) {
    const elapsed = Date.now() - start
    console.log(`  ERROR (${elapsed}ms): ${e.message}`)
    console.log(`  Para resolver, ejecutar: npm install pdfjs-dist@latest`)
    return
  }
  const elapsed = Date.now() - start

  console.log(`  Tiempo: ${elapsed}ms`)
  console.log(`  Items en página 1: ${textContent.items.length}`)

  // Group by Y coordinate (within tolerance)
  const rows = new Map<number, Array<{ x: number; text: string }>>()
  const Y_TOLERANCE = 3

  for (const item of textContent.items) {
    if (!item.str || item.str.trim() === '') continue
    const y = Math.round(item.transform[5] / Y_TOLERANCE) * Y_TOLERANCE
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y)!.push({ x: item.transform[4], text: item.str })
  }

  // Sort rows by Y (descending = top to bottom in PDF)
  const sortedRows = Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0])

  console.log(`  Filas agrupadas por Y: ${sortedRows.length}`)

  // Show first 10 rows
  let shown = 0
  for (const [y, cells] of sortedRows) {
    if (shown >= 10) break
    cells.sort((a, b) => a.x - b.x)
    const row = cells.map(c => c.text).join(' | ')
    if (row.length > 5) {
      console.log(`  Y=${y}: ${row.substring(0, 130)}`)
      shown++
    }
  }

  // Check if we can identify data rows with matrícula
  let dataRowCount = 0
  for (const [_y, cells] of sortedRows) {
    const fullText = cells.map(c => c.text).join(' ')
    if (/\b\d{7,10}\b/.test(fullText) && /\d{2}\/\d{2}\/\d{4}/.test(fullText)) {
      dataRowCount++
    }
  }
  console.log(`  Filas con datos (matrícula+fecha): ${dataRowCount}`)

  await doc.destroy()
}

async function main() {
  console.log('=== SPIKE: Comparación de métodos de extracción ===')
  console.log(`PDF: ${path.basename(PDF_PATH)}`)

  await testPdfParseGetText()
  await testPdfParseGetTable()
  await testPdfjsDistTextContent()

  console.log('\n=== CONCLUSIÓN ===')
  console.log('  getText(): Texto plano, rápido, pero sin estructura.')
  console.log('  getTable(): Tablas nativas con celdas, pero la celda central')
  console.log('              contiene todo el dato sin separar columnas.')
  console.log('  pdfjs-dist: Coordenadas exactas, permite reconstruir celdas')
  console.log('              agrupando por Y/X, pero requiere más código.')
}

main().catch(console.error)
