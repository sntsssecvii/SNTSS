import {
    PDFServices,
    ServicePrincipalCredentials,
    ExportPDFJob,
    ExportPDFParams,
    ExportPDFTargetFormat,
    ExportPDFResult,
    Asset,
    MimeType,
    ClientConfig,
    SDKError,
    ServiceApiError,
    ServiceUsageError
} from '@adobe/pdfservices-node-sdk';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { callPythonExtractor } from '@/lib/pdf/pythonBridge';
import { Readable } from 'stream';

export class AdobePdfService {
    /**
     * Convierte un PDF a Excel usando Adobe PDF Services API.
     * Retorna un Buffer con el contenido del archivo Excel.
     */
    static async convertPdfToExcel(pdfBuffer: Buffer, fileName: string): Promise<Buffer> {
        console.log(`[Adobe PDF] Iniciando conversión para: ${fileName}`);

        try {
            const clientId = process.env.ADOBE_CLIENT_ID;
            const clientSecret = process.env.ADOBE_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
                throw new Error('Adobe PDF Services API keys are not configured');
            }

            // 1. Inicializar Credenciales
            const credentials = new ServicePrincipalCredentials({
                clientId,
                clientSecret
            });

            // 2. Inicializar SDK con un timeout mayor (60 segundos)
            const clientConfig = new ClientConfig({
                timeout: 60000
            });
            const pdfServices = new PDFServices({ credentials, clientConfig });

            // 3. Subir el buffer como un Asset
            // El SDK espera un Readable stream o una ruta de archivo.
            const stream = Readable.from(pdfBuffer);
            const inputAsset = await pdfServices.upload({
                readStream: stream,
                mimeType: MimeType.PDF
            });

            // 4. Crear los parámetros para Export PDF a Excel (XLSX)
            const params = new ExportPDFParams({
                targetFormat: ExportPDFTargetFormat.XLSX
            });

            // 5. Crear el Trabajo (Job)
            const job = new ExportPDFJob({
                inputAsset,
                params
            });

            // 6. Enviar el trabajo y esperar el resultado
            console.log(`[Adobe PDF] Enviando trabajo de conversión...`);
            const pollingURL = await pdfServices.submit({ job });
            const pdfServicesResponse = await pdfServices.getJobResult({
                pollingURL,
                resultType: ExportPDFResult
            });

            // 7. Descargar el Asset resultante (Excel)
            const resultAsset = pdfServicesResponse.result?.asset;
            if (!resultAsset) {
                throw new Error('No result asset returned from Adobe PDF Services');
            }

            const downloadResponse = await pdfServices.getContent({ asset: resultAsset });
            const chunks: Buffer[] = [];
            for await (const chunk of downloadResponse.readStream) {
                chunks.push(Buffer.from(chunk));
            }

            const excelBuffer = Buffer.concat(chunks);
            console.log(`[Adobe PDF] Conversión exitosa: ${(excelBuffer.length / 1024).toFixed(2)} KB`);

            return excelBuffer;

        } catch (error: any) {
            console.error('[Adobe PDF Error]:', error.message || error);
            throw error; // Rethrow to let the main caller handle fallbacks
        }
    }
}
