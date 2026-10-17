
'use server'

import { parseWithPdfPlumber } from '@/lib/pdf/parsers/pdfPlumberParser'
import { parseExcel } from '@/lib/excel/parsers/excelParser'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'
import { detectarTipoDocumento } from '@/lib/pdf/parser'

export async function processTestPDF(formData: FormData) {
    const file = formData.get('file') as File
    if (!file) {
        return { error: 'No se subió ningún archivo' }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = file.name
    const extension = path.extname(fileName).toLowerCase()

    // Detectar tipo de documento (Nuevo Ingreso, etc)
    const tipo = detectarTipoDocumento(fileName) || 'NUEVO_INGRESO'

    try {
        if (extension === '.xlsx' || extension === '.xls') {
            const result = await parseExcel(buffer, tipo, fileName)
            return {
                success: true,
                registros: result.registros,
                metadata: result.metadata,
                errores: result.errores
            }
        }

        // Caso PDF
        // Si las llaves de Adobe están configuradas, las usamos para máxima precisión
        if (process.env.ADOBE_CLIENT_ID && process.env.ADOBE_CLIENT_SECRET) {
            try {
                const { AdobePdfService } = await import('@/lib/excel/services/adobePdfService')
                const excelBuffer = await AdobePdfService.convertPdfToExcel(buffer, fileName)
                const result = await parseExcel(excelBuffer, tipo, fileName.replace(/\.pdf$/i, '.xlsx'))
                return {
                    success: true,
                    registros: result.registros,
                    metadata: {
                        ...result.metadata,
                        extraidoCon: 'EXCEL'
                    },
                    errores: result.errores
                }
            } catch (convError) {
                console.warn('Error en Adobe PDF, reintentando con pdfplumber:', convError)
            }
        }

        const tempPath = path.join(os.tmpdir(), `${uuidv4()}.pdf`)
        await writeFile(tempPath, buffer)

        try {
            const result = await parseWithPdfPlumber(tempPath)
            return {
                success: true,
                registros: result.registros,
                metadata: result.metadata,
                errores: result.errores
            }
        } finally {
            if (tempPath) {
                try { await unlink(tempPath) } catch (e) { }
            }
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }
    }
}
