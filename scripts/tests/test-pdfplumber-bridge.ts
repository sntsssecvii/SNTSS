import { callPythonExtractor } from '../../src/lib/pdf/pythonBridge'
import path from 'path'
import fs from 'fs'

async function main() {
    const pdfPath = 'src/assets/PDFs/NUEVO INGRESO.pdf'
    const absolutePath = path.join(process.cwd(), pdfPath)
    const outputDir = path.join(process.cwd(), 'artifacts', 'pdf-tests')

    console.log('Testing PDF Extractor with:', absolutePath)

    try {
        fs.mkdirSync(outputDir, { recursive: true })
        const result = await callPythonExtractor(absolutePath)
        console.log('Status:', result.status)
        console.log('Number of pages:', result.pages.length)

        // Save output to a file for manual inspection
        const outputPath = path.join(outputDir, 'python-extractor-output.json')
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
        console.log(`Full output saved to ${outputPath}`)

        // Print a sample from the first page table
        if (result.pages.length > 0 && result.pages[0].tables && result.pages[0].tables.length > 0) {
            console.log('First table sample (first 3 rows):')
            console.table(result.pages[0].tables[0].slice(0, 3))
        } else {
            console.log('No tables found on the first page.')
        }

    } catch (error) {
        console.error('Error during test:', error)
    }
}

main()
