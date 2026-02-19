/**
 * Script de test de regresión para los 8 parsers PDF.
 * Ejecuta cada parser contra su PDF correspondiente y valida:
 *   - Que se extraigan registros (count > 0)
 *   - Que los campos clave estén presentes en cada registro
 *   - Resumen de confianza y errores
 *
 * Uso: npx tsx scripts/test-parsers.ts
 */

import fs from 'fs'
import path from 'path'
import { parsePDF } from '../src/lib/pdf/parser'
import { SCHEMAS, validateRegistro } from '../src/lib/pdf/schemas'
import type { TipoBolsaDeTrabajo, BolsaDeTrabajoRegistro } from '../src/types/bolsa-de-trabajo'

const PDF_DIR = path.join(__dirname, '..', 'src', 'assets', 'PDFs')

interface TestConfig {
  file: string
  tipo: TipoBolsaDeTrabajo
  requiredFields: (keyof BolsaDeTrabajoRegistro)[]
  minRegistros: number
}

const TESTS: TestConfig[] = [
  {
    file: 'NUEVO INGRESO.pdf',
    tipo: 'NUEVO_INGRESO',
    requiredFields: ['nombre', 'matricula', 'fecha'],
    minRegistros: 5,
  },
  {
    file: 'AMPLIACIONES DE JORNADA.pdf',
    tipo: 'AMPLIACIONES_JORNADA',
    requiredFields: ['nombre', 'matricula', 'fecha', 'jornadaActual'],
    minRegistros: 5,
  },
  {
    file: 'CAMBIOS DE ÁREA.pdf',
    tipo: 'CAMBIOS_AREA',
    requiredFields: ['nombre', 'matricula', 'fecha'],
    minRegistros: 3,
  },
  {
    file: 'CAMBIOS DE RAMA.pdf',
    tipo: 'CAMBIOS_RAMA',
    requiredFields: ['nombre', 'matricula', 'fecha'],
    minRegistros: 3,
  },
  {
    file: 'CAMBIOS DE RESIDENCIA DESTINO.pdf',
    tipo: 'CAMBIOS_RESIDENCIA_DESTINO',
    requiredFields: ['nombre', 'matricula', 'fecha'],
    minRegistros: 1,
  },
  {
    file: 'CAMBIOS DE RESIDENCIA ORIGEN.pdf',
    tipo: 'CAMBIOS_RESIDENCIA_ORIGEN',
    requiredFields: ['nombre', 'matricula', 'fecha'],
    minRegistros: 1,
  },
  {
    file: 'CAMBIOS DE TIPO DE PLAZA.pdf',
    tipo: 'CAMBIOS_TIPO_PLAZA',
    requiredFields: ['nombre', 'matricula', 'fecha'],
    minRegistros: 1,
  },
  {
    file: 'CAMBIOS DE TURNO Y-O ADSCRIPCIÓN.pdf',
    tipo: 'CAMBIOS_TURNO_ADSCRIPCION',
    requiredFields: ['nombre', 'matricula', 'fecha'],
    minRegistros: 3,
  },
]

interface TestResult {
  tipo: TipoBolsaDeTrabajo
  status: 'PASS' | 'WARN' | 'FAIL' | 'SKIP' | 'ERROR'
  registros?: number
  errores?: number
  confianzaPromedio?: string
  necesitanValidacion?: number
  schemaErrors?: number
  issues: string[]
  firstRecord?: { nombre?: string; matricula?: string; fecha?: string } | null
  message?: string
}

async function runTest(testConfig: TestConfig): Promise<TestResult> {
  const { file, tipo, requiredFields, minRegistros } = testConfig
  const pdfPath = path.join(PDF_DIR, file)

  if (!fs.existsSync(pdfPath)) {
    return { tipo, status: 'SKIP', issues: [], message: `Archivo no encontrado: ${file}` }
  }

  const buffer = Buffer.from(fs.readFileSync(pdfPath))
  const parseResult = await parsePDF(buffer, tipo, file)
  const { registros, errores } = parseResult
  const issues: string[] = []

  if (registros.length === 0) {
    return {
      tipo,
      status: 'FAIL',
      registros: 0,
      errores: errores.length,
      issues: ['No se extrajeron registros'],
      message: errores.join('; '),
    }
  }

  if (registros.length < minRegistros) {
    issues.push(`Solo ${registros.length} registros (min esperado: ${minRegistros})`)
  }

  let missingFieldCount = 0
  for (const reg of registros) {
    for (const field of requiredFields) {
      const val = reg[field]
      if (!val || val === '' || val === '00000000') {
        missingFieldCount++
      }
    }
  }

  if (missingFieldCount > 0) {
    issues.push(`${missingFieldCount} campos requeridos vacios/invalidos en total`)
  }

  // Schema validation
  const schema = SCHEMAS[tipo]
  let schemaErrorCount = 0
  for (const reg of registros) {
    const schemaErrors = validateRegistro(reg, schema)
    schemaErrorCount += schemaErrors.length
  }
  if (schemaErrorCount > 0) {
    issues.push(`${schemaErrorCount} errores de validacion de schema`)
  }

  const confidences = registros.map(r => r.confianza || 0)
  const avgConfianza = confidences.length > 0
    ? (confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(2)
    : 'N/A'

  const needsValidation = registros.filter(r => r.necesitaValidacion).length

  return {
    tipo,
    status: issues.length === 0 ? 'PASS' : 'WARN',
    registros: registros.length,
    errores: errores.length,
    confianzaPromedio: avgConfianza,
    necesitanValidacion: needsValidation,
    schemaErrors: schemaErrorCount,
    issues,
    firstRecord: registros[0] ? {
      nombre: registros[0].nombre,
      matricula: registros[0].matricula,
      fecha: registros[0].fecha,
    } : null,
  }
}

async function main() {
  console.log('=== TEST DE REGRESION DE PARSERS PDF ===\n')

  const results: TestResult[] = []
  for (const test of TESTS) {
    try {
      const result = await runTest(test)
      results.push(result)
    } catch (err: any) {
      results.push({
        tipo: test.tipo,
        status: 'ERROR',
        issues: [],
        message: err.message,
      })
    }
  }

  let passCount = 0
  let warnCount = 0
  let failCount = 0

  for (const r of results) {
    const icon = r.status === 'PASS' ? 'OK' : r.status === 'WARN' ? '!!' : 'XX'
    console.log(`[${icon}] ${r.tipo}`)

    if (r.status === 'ERROR' || r.status === 'SKIP') {
      console.log(`      ${r.message}`)
    } else {
      console.log(`      Registros: ${r.registros} | Errores parse: ${r.errores} | Schema errors: ${r.schemaErrors}`)
      console.log(`      Confianza promedio: ${r.confianzaPromedio} | Necesitan validacion: ${r.necesitanValidacion}`)
      if (r.firstRecord) {
        console.log(`      1er reg: ${r.firstRecord.nombre} | Mat: ${r.firstRecord.matricula} | Fecha: ${r.firstRecord.fecha}`)
      }
      if (r.issues.length > 0) {
        for (const issue of r.issues) {
          console.log(`      ! ${issue}`)
        }
      }
    }
    console.log('')

    if (r.status === 'PASS') passCount++
    else if (r.status === 'WARN') warnCount++
    else failCount++
  }

  console.log('=== RESUMEN ===')
  console.log(`  PASS: ${passCount} | WARN: ${warnCount} | FAIL/ERROR: ${failCount}`)
  console.log(`  Total: ${results.length} tipos probados`)

  process.exit(failCount > 0 ? 1 : 0)
}

main()
