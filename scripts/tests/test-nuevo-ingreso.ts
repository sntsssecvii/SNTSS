
import { parsePDF } from '../../src/lib/pdf/parser';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const filePath = path.join(process.cwd(), 'src/assets/PDFs/NUEVO INGRESO.pdf');
    const outputDir = path.join(process.cwd(), 'artifacts', 'pdf-tests');

    if (!fs.existsSync(filePath)) {
        console.error('El archivo PDF no existe:', filePath);
        process.exit(1);
    }

    fs.mkdirSync(outputDir, { recursive: true });

    console.log('Leyendo PDF:', filePath);
    const buffer = fs.readFileSync(filePath);

    console.log('Parseando las primeras 50 páginas...');
    const result = await parsePDF(buffer, 'NUEVO_INGRESO', 'NUEVO INGRESO.pdf', { maxPages: 50 });

    const summary = `
Registros encontrados: ${result.registros.length}
Errores: ${result.errores.length}
Primeros 50 registros:
${JSON.stringify(result.registros.slice(0, 50), null, 2)}
Primeros 3 errores:
${JSON.stringify(result.errores.slice(0, 3), null, 2)}
`;

    const summaryPath = path.join(outputDir, 'nuevo-ingreso-summary.txt');
    const resultsPath = path.join(outputDir, 'nuevo-ingreso-results.json');

    fs.writeFileSync(summaryPath, summary);
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2));

    console.log(`Summary written to ${summaryPath}`);
    console.log(`Results written to ${resultsPath}`);
}

main().catch(console.error);
