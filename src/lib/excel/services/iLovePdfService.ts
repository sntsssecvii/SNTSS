import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { callPythonExtractor } from '@/lib/pdf/pythonBridge';

export class ILovePdfService {
    /**
     * Convierte un PDF a Excel usando la API REST de iLovePDF directamente.
     * Retorna un Buffer con el contenido del archivo Excel.
     */
    static async convertPdfToExcel(pdfBuffer: Buffer, fileName: string): Promise<Buffer> {
        console.log(`[iLovePDF REST] Iniciando conversión para: ${fileName}`);

        try {
            const public_key = process.env.ILOVEPDF_PUBLIC_KEY;
            const secret_key = process.env.ILOVEPDF_SECRET_KEY;

            if (!public_key || !secret_key) {
                throw new Error('iLovePDF API keys are not configured');
            }
            // 1. Obtener Token de Autenticación
            const authResponse = await fetch('https://api.ilovepdf.com/v1/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_key })
            });

            if (!authResponse.ok) {
                const errorData = await authResponse.json();
                throw new Error(`Auth failed: ${JSON.stringify(errorData)}`);
            }

            const { token } = await authResponse.json();

            // 2. Iniciar Tarea
            const startResponse = await fetch('https://api.ilovepdf.com/v1/start/pdfexcel', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!startResponse.ok) {
                const errorData = await startResponse.json();
                throw new Error(`Start task failed: ${JSON.stringify(errorData)}`);
            }

            const { task, server } = await startResponse.json();

            // 3. Subir Archivo
            // Para subir archivos vía REST se recomienda multipart/form-data
            const formData = new FormData();
            const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
            formData.append('task', task);
            formData.append('file', blob, fileName);

            const uploadResponse = await fetch(`https://${server}/v1/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(`Upload failed: ${JSON.stringify(errorData)}`);
            }

            const { server_filename } = await uploadResponse.json();

            // 4. Procesar Tarea
            const processResponse = await fetch(`https://${server}/v1/process`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    task: task,
                    tool: 'pdfexcel',
                    files: [{
                        server_filename: server_filename,
                        filename: fileName
                    }]
                })
            });

            if (!processResponse.ok) {
                const errorData = await processResponse.json();
                throw new Error(`Process failed: ${JSON.stringify(errorData)}`);
            }

            // 5. Descargar Resultado
            const downloadResponse = await fetch(`https://${server}/v1/download/${task}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!downloadResponse.ok) {
                throw new Error(`Download failed with status ${downloadResponse.status}`);
            }

            const arrayBuffer = await downloadResponse.arrayBuffer();
            return Buffer.from(arrayBuffer);

        } catch (error: any) {
            console.error('[iLovePDF REST Error]:', error.message);

            // Fallback a pdfplumber si iLovePDF falla o no está configurado/disponible
            console.log(`[iLovePDF Fallback] Intentando conversión local con pdfplumber para: ${fileName}`);
            try {
                // Necesitamos guardar el buffer en un archivo temporal para que pdfplumber lo lea
                const tempDir = path.join(os.tmpdir(), 'sntss-fallback-' + Date.now());
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const tempPdfPath = path.join(tempDir, fileName);
                fs.writeFileSync(tempPdfPath, pdfBuffer);

                const extraction = await callPythonExtractor(tempPdfPath);

                // Limpiar
                try { fs.unlinkSync(tempPdfPath); fs.rmdirSync(tempDir); } catch (e) { }

                if (!extraction.pages || extraction.pages.length === 0) {
                    throw new Error('No se pudo extraer contenido del PDF con el fallback.');
                }

                // Generar Excel
                const workbook = XLSX.utils.book_new();
                let allRows: any[][] = [];

                for (const page of extraction.pages) {
                    if (page.tables && page.tables.length > 0) {
                        for (const table of page.tables) {
                            if (table) allRows = allRows.concat(table);
                        }
                    } else if (page.lines) {
                        allRows = allRows.concat(page.lines.map(l => [l]));
                    }
                }

                if (allRows.length === 0) {
                    throw new Error('El PDF no contiene tablas ni texto procesable en el fallback.');
                }

                const worksheet = XLSX.utils.aoa_to_sheet(allRows);
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Extracción');

                const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
                console.log(`[iLovePDF Fallback] Conversión local completada: ${allRows.length} filas.`);
                return excelBuffer;

            } catch (fallbackError: any) {
                console.error('[iLovePDF Fallback Error]:', fallbackError.message);
                throw new Error(`Error en conversión iLovePDF y fallo en el fallback: ${fallbackError.message}`);
            }
        }
    }
}
