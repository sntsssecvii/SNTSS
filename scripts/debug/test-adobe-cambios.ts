import { readFile } from 'fs/promises';
import * as XLSX from 'xlsx';
import { AdobePdfService } from '@/lib/excel/services/adobePdfService';

async function main() {
  // Load env vars
  const envContent = await readFile('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }

  const pdfPath = 'src/assets/PDFs/CAMBIOS DE TURNO Y-O ADSCRIPCIÓN.pdf';
  console.log('Convirtiendo:', pdfPath);

  const buffer = await readFile(pdfPath);
  const excelBuffer = await AdobePdfService.convertPdfToExcel(buffer, 'cambios.pdf');

  const workbook = XLSX.read(excelBuffer);
  console.log('Sheets:', workbook.SheetNames);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: null });
    console.log(`\n=== Sheet: ${sheetName} (${rows.length} filas) ===`);
    rows.slice(0, 25).forEach((row, i) => {
      const nonNull = row.filter(c => c !== null);
      if (nonNull.length > 0) {
        console.log(`[${i}] (${nonNull.length} nonNull):`, JSON.stringify(row).slice(0, 600));
      }
    });
    const dataRows = rows.filter(r => r.filter(c => c !== null).length > 4);
    console.log(`\n--- PRIMERAS 5 DATA ROWS ---`);
    dataRows.slice(0, 5).forEach((row, i) => {
      console.log(`[d${i}]:`, JSON.stringify(row).slice(0, 600));
    });
  }
}

main().catch(console.error);
