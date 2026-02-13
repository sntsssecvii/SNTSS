import { NextRequest, NextResponse } from 'next/server'
import { parsePDF, detectarTipoDocumento } from '@/lib/pdf/parser'
import { createEscalafonDocumento, updateEscalafonDocumento, updateEstadoDocumento, guardarRegistrosEnSubcoleccion } from '@/lib/firebase/escalafon'
import { Timestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { app, storage } from '@/lib/firebase/server-config'

export async function POST(request: NextRequest) {
  try {
    // Obtener datos del formulario
    const formData = await request.formData()
    const file = formData.get('file') as File
    const tipo = formData.get('tipo') as string
    const userId = formData.get('userId') as string
    const userEmail = formData.get('userEmail') as string

    // Verificar autenticación básica
    // Nota: En producción, implementar verificación de token JWT de Firebase
    const authHeader = request.headers.get('authorization')
    if (!authHeader && !userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      )
    }

    // Validar que sea un PDF
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'El archivo debe ser un PDF' },
        { status: 400 }
      )
    }

    // Convertir archivo a buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Detectar tipo de documento si no se proporcionó
    let tipoDocumento = tipo as any
    if (!tipoDocumento) {
      tipoDocumento = detectarTipoDocumento(file.name)
      if (!tipoDocumento) {
        // Intentar detectar por contenido parseando una muestra
        try {
          const { PDFParse } = require('pdf-parse')
          const parser = new PDFParse({ data: buffer.slice(0, 10000) }) // Solo primeros 10KB para detectar
          const result = await parser.getText()
          await parser.destroy()
          tipoDocumento = detectarTipoDocumento(file.name, result.text)
        } catch (error) {
          console.warn('No se pudo detectar tipo por contenido:', error)
        }
      }
    }

    if (!tipoDocumento) {
      return NextResponse.json(
        { error: 'No se pudo detectar el tipo de documento. Por favor, selecciónalo manualmente.' },
        { status: 400 }
      )
    }

    // Crear documento inicial con estado PROCESANDO
    const ahora = new Date()
    const documentoId = await createEscalafonDocumento({
      tipo: tipoDocumento,
      fechaActualizacion: ahora,
      fechaCarga: ahora,
      subidoPor: userId,
      subidoPorEmail: userEmail,
      estado: 'PROCESANDO',
      urlArchivo: '', // Se actualizará después
      nombreArchivo: file.name,
      metadata: {},
      registros: [],
      errores: [],
      version: 1,
      totalRegistros: 0,
      registrosValidados: 0,
      registrosConErrores: 0,
    })

    // Subir archivo a Firebase Storage (opcional - continuar aunque falle)
    let urlArchivo = ''
    try {
      if (!storage) {
        console.warn('Firebase Storage no está disponible, continuando sin subir archivo')
        urlArchivo = '' // Continuar sin URL de Storage
      } else {
        const storageRef = ref(storage, `escalafon/${documentoId}/${file.name}`)
        const snapshot = await uploadBytes(storageRef, buffer)
        urlArchivo = await getDownloadURL(snapshot.ref)
      }
    } catch (error: any) {
      console.warn('Error subiendo archivo a Storage (continuando sin Storage):', error.message)
      // No fallar completamente, solo continuar sin URL de Storage
      urlArchivo = ''
    }

    // Procesar PDF
    let resultadoParse
    try {
      resultadoParse = await parsePDF(buffer, tipoDocumento, file.name)
    } catch (error: any) {
      console.error('Error parseando PDF:', error)
      await updateEstadoDocumento(documentoId, 'ERROR')
      return NextResponse.json(
        { error: `Error procesando PDF: ${error.message}` },
        { status: 500 }
      )
    }

    // Actualizar documento con resultados
    const registrosConErrores = resultadoParse.registros.filter((r) => r.necesitaValidacion).length

    // Log para debugging
    console.log('Resultado del parseo:', {
      totalRegistros: resultadoParse.registros.length,
      registrosConErrores,
      errores: resultadoParse.errores,
      primerosRegistros: resultadoParse.registros.slice(0, 3),
    })

    // Guardar registros en subcolección (evita límite de tamaño)
    await guardarRegistrosEnSubcoleccion(documentoId, resultadoParse.registros)

    // Actualizar documento principal (sin registros)
    await updateEscalafonDocumento(documentoId, {
      urlArchivo: urlArchivo || '',
      estado: resultadoParse.registros.length > 0 ? 'COMPLETADO' : 'VALIDANDO',
      metadata: resultadoParse.metadata || {},
      errores: resultadoParse.errores || [],
      totalRegistros: resultadoParse.registros.length,
      registrosConErrores,
    })

    return NextResponse.json({
      success: true,
      documentoId,
      totalRegistros: resultadoParse.registros.length,
      registrosConErrores,
      errores: resultadoParse.errores,
      advertencia: resultadoParse.registros.length === 0 ? 'No se extrajeron registros. Revisa los logs del servidor para más detalles.' : undefined,
    })
  } catch (error: any) {
    console.error('Error en procesamiento:', error)
    console.error('Stack trace:', error.stack)
    return NextResponse.json(
      {
        error: `Error interno del servidor: ${error.message}`,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
