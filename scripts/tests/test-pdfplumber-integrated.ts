import { parseWithPdfPlumber } from '../../src/lib/pdf/parsers/pdfPlumberParser'
import path from 'path'
import fs from 'fs'

async function main() {
    const pdfPath = 'src/assets/PDFs/NUEVO INGRESO.pdf'
    const absolutePath = path.join(process.cwd(), pdfPath)
    const outputDir = path.join(process.cwd(), 'artifacts', 'pdf-tests')

    console.log('--- Testing pdfPlumberParser ---')
    console.log('Path:', absolutePath)

    try {
        fs.mkdirSync(outputDir, { recursive: true })
        const startTime = Date.now()
        const result = await parseWithPdfPlumber(absolutePath)
        const endTime = Date.now()

        console.log('Extraction completed in:', (endTime - startTime) / 1000, 's')
        console.log('Status:', result.metadata.extraidoCon)
        console.log('Registros encontrados:', result.registros.length)
        console.log('Errores de validación:', result.errores.length)

        if (result.registros.length > 0) {
            console.log('\nPrimeros 5 registros:')
            result.registros.slice(0, 5).forEach(r => {
                console.log(`- [${r.numeroProg}] ${r.nombre} (Mat: ${r.matricula}, Fecha: ${r.fecha})`)
                console.log(`  Cat: ${r.categoria}`)
            })
        }

        if (result.errores.length > 0) {
            console.log('\nPrimeros 5 errores:')
            result.errores.slice(0, 5).forEach(e => console.log(`- ${e}`))
        }

        // Save results for inspection
        const outputPath = path.join(outputDir, 'comparison-pdfplumber.json')
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
        console.log(`\nFull results saved to ${outputPath}`)

    } catch (error) {
        console.error('Error during test:', error)
    }
}

main()
