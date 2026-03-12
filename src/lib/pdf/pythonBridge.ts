import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export interface PDFExtractionResult {
    pages: {
        page_number: number
        tables: (string | null)[][][]
        lines: string[]
        text: string
    }[]
    status: 'success' | 'error'
    error?: string
}

export async function callPythonExtractor(pdfPath: string): Promise<PDFExtractionResult> {
    return new Promise((resolve, reject) => {
        const rootDir = process.cwd()
        const pythonPath = path.join(rootDir, 'src/lib/pdf/extractors/venv/bin/python3')
        const scriptPath = path.join(rootDir, 'src/lib/pdf/extractors/pdf_extractor.py')

        if (!fs.existsSync(pythonPath)) {
            const isVercel = process.env.VERCEL === '1'
            const message = isVercel
                ? `Python environment not found on Vercel. Please configure ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET for production PDF processing.`
                : `Python environment not found at ${pythonPath}. Please run setup first (npm run setup-python).`
            return reject(new Error(message))
        }

        if (!fs.existsSync(scriptPath)) {
            return reject(new Error(`Python script not found at ${scriptPath}`))
        }

        // Ensure pdfPath is absolute
        const absolutePdfPath = path.isAbsolute(pdfPath) ? pdfPath : path.join(rootDir, pdfPath)

        if (!fs.existsSync(absolutePdfPath)) {
            return reject(new Error(`PDF file not found at ${absolutePdfPath}`))
        }

        const pythonProcess = spawn(pythonPath, [scriptPath, absolutePdfPath])

        let stdoutData = ''
        let stderrData = ''

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString()
        })

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString()
        })

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('Python Extractor Error:', stderrData)
                return reject(new Error(`Python process exited with code ${code}: ${stderrData}`))
            }

            try {
                const result = JSON.parse(stdoutData) as PDFExtractionResult
                if (result.status === 'error') {
                    return reject(new Error(result.error || 'Unknown error in python script'))
                }
                resolve(result)
            } catch (e) {
                console.error('Failed to parse Python output:', stdoutData)
                reject(new Error(`Failed to parse Python output: ${e instanceof Error ? e.message : String(e)}`))
            }
        })
    })
}
