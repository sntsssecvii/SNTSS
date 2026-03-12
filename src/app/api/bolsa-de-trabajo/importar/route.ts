import { NextRequest, NextResponse } from 'next/server'
import { createBolsaDeTrabajoDocumento, guardarRegistrosEnSubcoleccion, updateBolsaDeTrabajoDocumento } from '@/lib/firebase/bolsa-de-trabajo'
import type { BolsaDeTrabajoRegistro, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'
import * as XLSX from 'xlsx'

export interface ImportarRequest {
  tipoDocumento: TipoBolsaDeTrabajo
  nombreArchivo: string
  userId: string
  userEmail: string
  registros: FilaValidada[]
  validarTodos?: boolean
}

export interface FilaValidada {
  id?: string
  numeroProg?: string
  nombre?: string
  matricula?: string
  fecha?: string
  zona?: string
  categoria?: string
  subcategoria?: string
  grupo?: string
  calificacion?: string
  tipoContratacion?: string
  diasLaborados?: string
  estatus?: string
  observaciones?: string
  datosExtra?: string
  validado: boolean
  confianza: number
}

export interface ImportarResponse {
  success: boolean
  documentoId?: string
  totalRegistros: number
  registrosValidados: number
  errores: string[]
}

function parseXLSX(file: File): FilaValidada[] {
  return []
}

function mapearFilaARegistro(fila: FilaValidada, tipo: TipoBolsaDeTrabajo): BolsaDeTrabajoRegistro {
  const id = `importado_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const registroBase: BolsaDeTrabajoRegistro = {
    id,
    tipoDocumento: tipo,
    validado: fila.validado,
    confianza: fila.confianza,
    zona: fila.zona,
    categoria: fila.categoria,
    subcategoria: fila.subcategoria,
    numeroProg: fila.numeroProg,
    nombre: fila.nombre,
    matricula: fila.matricula,
    fecha: fila.fecha,
    grupo: fila.grupo,
    calificacion: fila.calificacion,
    tipoContratacion: fila.tipoContratacion,
    diasLaborados: fila.diasLaborados,
    estatus: fila.estatus,
    observaciones: fila.observaciones || fila.datosExtra,
    necesitaValidacion: !fila.validado,
  }

  return registroBase
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    let body: ImportarRequest

    if (contentType.includes('application/json')) {
      body = await request.json()
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File
      
      if (file) {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]
        
        const headers = data[0]?.map((h: string) => h?.toString().toLowerCase().trim()) || []
        
        const registros: FilaValidada[] = []
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i]
          if (!row || row.length === 0) continue
          
          const getValue = (colName: string): string => {
            const colIdx = headers.indexOf(colName)
            return colIdx >= 0 && row[colIdx] ? String(row[colIdx]) : ''
          }
          
          const validadoStr = getValue('validado')
          const validado = validadoStr.toLowerCase() === 'sí' || validadoStr.toLowerCase() === 'si' || validadoStr.toLowerCase() === 'yes' || validadoStr === '1'
          
          const confianza = validado ? 1.0 : 0.5
          
          const fila: FilaValidada = {
            numeroProg: getValue('no. prog'),
            nombre: getValue('nombre'),
            matricula: getValue('matrícula'),
            fecha: getValue('fecha'),
            zona: getValue('zona'),
            categoria: getValue('categoría'),
            subcategoria: getValue('subcategoría') || getValue('subcategoria'),
            grupo: getValue('grupo'),
            calificacion: getValue('calificación'),
            tipoContratacion: getValue('tipo contratación'),
            diasLaborados: getValue('días laborados'),
            estatus: getValue('estatus'),
            observaciones: getValue('observaciones'),
            datosExtra: getValue('datos extra'),
            validado,
            confianza
          }
          
          if (fila.nombre || fila.matricula || fila.numeroProg) {
            registros.push(fila)
          }
        }
        
        const tipo = formData.get('tipoDocumento') as TipoBolsaDeTrabajo
        const nombreArchivo = formData.get('nombreArchivo') as string || file.name
        const userId = formData.get('userId') as string || 'sistema'
        const userEmail = formData.get('userEmail') as string || 'sistema@sntss.gob.mx'
        
        body = {
          tipoDocumento: tipo || 'NUEVO_INGRESO',
          nombreArchivo,
          userId,
          userEmail,
          registros
        }
      } else {
        return NextResponse.json(
          { error: 'No se proporcionó archivo ni datos JSON' },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Tipo de contenido no soportado' },
        { status: 400 }
      )
    }

    const { tipoDocumento, nombreArchivo, userId, userEmail, registros, validarTodos } = body

    if (!registros || registros.length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron registros para importar' },
        { status: 400 }
      )
    }

    const ahora = new Date()
    
    const documentoId = await createBolsaDeTrabajoDocumento({
      tipo: tipoDocumento,
      fechaActualizacion: ahora,
      fechaCarga: ahora,
      subidoPor: userId,
      subidoPorEmail: userEmail,
      estado: 'COMPLETADO',
      urlArchivo: '',
      nombreArchivo: nombreArchivo || 'importado.xlsx',
      metadata: {},
      registros: [],
      errores: [],
      version: 1,
      totalRegistros: registros.length,
      registrosValidados: registros.filter(r => r.validado).length,
      registrosConErrores: 0,
    })

    const registrosConvertidos = registros.map((fila, index) => 
      mapearFilaARegistro(fila, tipoDocumento)
    )

    await guardarRegistrosEnSubcoleccion(documentoId, registrosConvertidos)

    await updateBolsaDeTrabajoDocumento(documentoId, {
      estado: 'COMPLETADO',
      metadata: {
        totalRegistros: registros.length,
      },
      registrosValidados: registros.filter(r => r.validado).length,
    })

    const response: ImportarResponse = {
      success: true,
      documentoId,
      totalRegistros: registros.length,
      registrosValidados: registros.filter(r => r.validado).length,
      errores: []
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error importando datos:', error)
    return NextResponse.json(
      { 
        error: `Error interno: ${error.message}`,
        success: false,
        totalRegistros: 0,
        registrosValidados: 0,
        errores: [error.message]
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API de importación de datos validados a Firebase',
    metodos: {
      POST: {
        descripcion: 'Importar registros validados desde JSON o Excel',
        json: {
          tipoDocumento: 'Tipo de documento (NUEVO_INGRESO, AMPLIACIONES_JORNADA, etc.)',
          nombreArchivo: 'Nombre del archivo original',
          userId: 'ID del usuario que importa',
          userEmail: 'Email del usuario',
          registros: 'Array de registros validados'
        },
        formData: {
          file: 'Archivo Excel (.xlsx) con los datos validados',
          tipoDocumento: 'Tipo de documento (opcional)',
          nombreArchivo: 'Nombre del archivo (opcional)',
          userId: 'ID del usuario (opcional)',
          userEmail: 'Email del usuario (opcional)'
        }
      }
    },
    ejemploJson: {
      tipoDocumento: 'NUEVO_INGRESO',
      nombreArchivo: 'validado.xlsx',
      userId: 'user123',
      userEmail: 'user@sntss.gob.mx',
      registros: [
        {
          numeroProg: '1',
          nombre: 'DIAZ/RODRIGUEZ/VALERIA GUADALUPE',
          matricula: '97027534',
          fecha: '27/11/2023',
          zona: '1-San Luis Rio Col. Son.',
          categoria: '202100 - AUX DE ENFERMERIA GRAL',
          subcategoria: '16 CIRUGIA GENERAL',
          grupo: '2023003',
          calificacion: '73.000',
          tipoContratacion: '2',
          diasLaborados: '497',
          estatus: 'A',
          validado: true,
          confianza: 1.0
        }
      ]
    }
  })
}
