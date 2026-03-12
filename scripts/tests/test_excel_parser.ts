
import * as fs from 'fs';
import * as path from 'path';
import { parseExcel } from '../../src/lib/excel/parsers/excelParser';

async function test() {
    const filePath = path.join(__dirname, '../../src/assets/PDFs/NUEVO INGRESO.xlsx');

    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        process.exit(1);
    }

    const buffer = fs.readFileSync(filePath);
    console.log('Parsing Excel...');

    const result = await parseExcel(buffer, 'NUEVO_INGRESO', 'NUEVO INGRESO.xlsx');

    console.log('Results summary:');
    console.log('- Total records:', result.registros.length);
    console.log('- Errors:', result.errores.length);

    if (result.registros.length > 0) {
        console.log('\nSample record (first one):');
        console.log(JSON.stringify(result.registros[0], null, 2));

        console.log('\nSample record (middle one):');
        console.log(JSON.stringify(result.registros[Math.floor(result.registros.length / 2)], null, 2));
    }

    if (result.errores.length > 0) {
        console.log('\nFirst 5 errors:');
        result.errores.slice(0, 5).forEach(e => console.log(' -', e));
    }

    const zeroDiasRecords = result.registros.filter(r => r.diasLaborados === '0');
    console.log('\n- Records with 0 diasLaborados:', zeroDiasRecords.length);
    if (zeroDiasRecords.length > 0) {
        console.log('Sample zero dias record:', JSON.stringify(zeroDiasRecords[0], null, 2));
    }

    const missingCategoryRecords = result.registros.filter(r => !r.categoria);
    console.log('\n- Records with missing category:', missingCategoryRecords.length);
    if (missingCategoryRecords.length > 0) {
        console.log('Sample missing category record:', JSON.stringify(missingCategoryRecords[0], null, 2));
    }
}

test().catch(console.error);
