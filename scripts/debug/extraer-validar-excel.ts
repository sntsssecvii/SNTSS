import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'

const PDFParse = require('pdf-parse')

interface FilaCruda {
  lineaOriginal: string
  numeroLinea: number
  tipoLinea: 'zona' | 'categoria' | 'registro' | 'desconocido'
  zona?: string
  categoria?: string
  numeroProg?: string
  nombre?: string
  matricula?: string
  fecha?: string
  datosExtra?: string
}

const ENCABEZADOS = [
  'NO. PROG', 'NOMBRE', 'MATRÍCULA', 'FECHA', 'GRUPO', 'CALIFICACIÓN',
  'TIPO CONTRATACIÓN', 'DÍAS LABORADOS', 'ESTATUS', 'OBSERVACIONES',
  'JORNADA ACTUAL', 'ADSCRIPCIÓN ACTUAL', 'TURNO ACTUAL', 'RESIDENCIA',
  'CAMBIO SOLICITADO', 'REGISTRO', 'CLAVE', 'SEXO', 'ÁREA', 'RAMA'
]

function esEncabezado(linea: string): boolean {
  const upper = linea.toUpperCase()
  return ENCABEZADOS.some(e => upper.includes(e))
}

function esZona(linea: string): boolean {
  return /^Zona\s+\d+/.test(linea.trim())
}

function esCategoria(linea: string): boolean {
  return /^\d{6}\s*-\s*/.test(linea.trim())
}

function esRegistro(linea: string): boolean {
  const trimmed = linea.trim()
  if (!trimmed) return false
  
  const tieneNumeroProg = /^\d+\s+/.test(trimmed)
  const tieneMatricula = /\b\d{7,10}\b/.test(trimmed)
  const tieneFecha = /\d{2}\/\d{2}\/\d{4}/.test(trimmed)
  
  return tieneNumeroProg && (tieneMatricula || tieneFecha)
}

function esRuido(linea: string): boolean {
  const t = linea.trim()
  return (
    t.startsWith('Página') ||
    t.startsWith('--') ||
    /^\d+\s+of\s+\d+$/.test(t) ||
    t.startsWith('IMSS-SIAP') ||
    t.startsWith('DIRECCIÓN') ||
    t.startsWith('LISTADO')
  )
}

async function extraerDatosCrudos(pdfBuffer: Buffer): Promise<FilaCruda[]> {
  const parser = new PDFParse({ data: pdfBuffer })
  const result = await parser.getText()
  const texto = result.text
  await parser.destroy()

  const lineas = texto.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)
  
  const filas: FilaCruda[] = []
  let zonaActual = ''
  let categoriaActual = ''

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]
    
    if (esZona(linea)) {
      zonaActual = linea.replace('Zona ', '').trim()
      filas.push({
        lineaOriginal: linea,
        numeroLinea: i + 1,
        tipoLinea: 'zona',
        zona: zonaActual
      })
      continue
    }

    if (esCategoria(linea)) {
      categoriaActual = linea.trim()
      filas.push({
        lineaOriginal: linea,
        numeroLinea: i + 1,
        tipoLinea: 'categoria',
        categoria: categoriaActual
      })
      continue
    }

    if (esRuido(linea) || esEncabezado(linea)) {
      continue
    }

    if (esRegistro(linea)) {
      const partes = linea.split(/\s+/).filter((p: string) => p.length > 0)
      
      let numeroProg = ''
      let nombre = ''
      let matricula = ''
      let fecha = ''
      let datosExtra = ''

      const numIdx = partes.findIndex((p: string) => /^\d+$/.test(p))
      if (numIdx >= 0) {
        numeroProg = partes[numIdx]
        nombre = partes.slice(numIdx + 1).join(' ')
      }

      const matMatch = linea.match(/\b(\d{7,10})\b/)
      if (matMatch) {
        matricula = matMatch[1]
      }

      const fechaMatch = linea.match(/(\d{2}\/\d{2}\/\d{4})/)
      if (fechaMatch) {
        fecha = fechaMatch[1]
      }

      const datosDespues = linea.replace(/^\d+\s+/, '').replace(/\b\d{7,10}\b/, '').replace(/\d{2}\/\d{2}\/\d{4}/, '').trim()
      if (datosDespues) {
        datosExtra = datosDespues
      }

      filas.push({
        lineaOriginal: linea,
        numeroLinea: i + 1,
        tipoLinea: 'registro',
        zona: zonaActual,
        categoria: categoriaActual,
        numeroProg,
        nombre,
        matricula,
        fecha,
        datosExtra
      })
      continue
    }

    filas.push({
      lineaOriginal: linea,
      numeroLinea: i + 1,
      tipoLinea: 'desconocido'
    })
  }

  return filas
}

function generarExcel(filas: FilaCruda[], nombreArchivo: string, tipoDocumento: string) {
  const headers = [
    'Validado',
    'Tipo Línea',
    'Zona',
    'Categoría',
    'No. Prog',
    'Nombre',
    'Matrícula',
    'Fecha',
    'Datos Extra',
    'Línea Original',
    'No. Línea'
  ]

  const rows = filas.map(f => [
    '',
    f.tipoLinea,
    f.zona || '',
    f.categoria || '',
    f.numeroProg || '',
    f.nombre || '',
    f.matricula || '',
    f.fecha || '',
    f.datosExtra || '',
    f.lineaOriginal,
    f.numeroLinea.toString()
  ])

  const data = [headers, ...rows]

  const ws = XLSX.utils.aoa_to_sheet(data)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos crudos')

  const wsResumen = XLSX.utils.aoa_to_sheet([
    ['Tipo de Documento', tipoDocumento],
    ['Total Filas', filas.length.toString()],
    ['Registros', filas.filter(f => f.tipoLinea === 'registro').length.toString()],
    ['Zonas', filas.filter(f => f.tipoLinea === 'zona').length.toString()],
    ['Categorías', filas.filter(f => f.tipoLinea === 'categoria').length.toString()],
    ['Desconocidos', filas.filter(f => f.tipoLinea === 'desconocido').length.toString()]
  ])
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  const nombreSalida = nombreArchivo.replace('.pdf', '_validar.xlsx')
  XLSX.writeFile(wb, nombreSalida)
  console.log(`Excel generado: ${nombreSalida}`)
}

async function main() {
  const pdfDir = path.join(process.cwd(), 'pdfs')
  
  if (!fs.existsSync(pdfDir)) {
    console.log(`Creando directorio ${pdfDir}`)
    fs.mkdirSync(pdfDir, { recursive: true })
    console.log('Por favor coloca los PDFs en la carpeta pdfs/ y vuelve a ejecutar')
    return
  }

  const pdfs = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'))
  
  if (pdfs.length === 0) {
    console.log('No se encontraron PDFs en la carpeta pdfs/')
    return
  }

  console.log(`Encontrados ${pdfs.length} PDFs`)

  for (const pdfFile of pdfs) {
    console.log(`\nProcesando: ${pdfFile}`)
    const pdfPath = path.join(pdfDir, pdfFile)
    const pdfBuffer = fs.readFileSync(pdfPath)

    try {
      const filas = await extraerDatosCrudos(pdfBuffer)
      console.log(`  Extraídas ${filas.length} líneas`)
      console.log(`  - Registros: ${filas.filter(f => f.tipoLinea === 'registro').length}`)
      
      const tipo = pdfFile.toUpperCase().includes('NUEVO') ? 'NUEVO_INGRESO' :
                   pdfFile.toUpperCase().includes('AMPLIACIONES') ? 'AMPLIACIONES_JORNADA' :
                   pdfFile.toUpperCase().includes('AREA') ? 'CAMBIOS_AREA' :
                   pdfFile.toUpperCase().includes('RAMA') ? 'CAMBIOS_RAMA' :
                   pdfFile.toUpperCase().includes('RESIDENCIA') ? 'CAMBIOS_RESIDENCIA' :
                   pdfFile.toUpperCase().includes('PLAZA') ? 'CAMBIOS_TIPO_PLAZA' :
                   pdfFile.toUpperCase().includes('TURNO') ? 'CAMBIOS_TURNO_ADSCRIPCION' :
                   'DESCONOCIDO'

      generarExcel(filas, pdfFile, tipo)
    } catch (error: any) {
      console.error(`  Error: ${error.message}`)
    }
  }
}

main().catch(console.error)
