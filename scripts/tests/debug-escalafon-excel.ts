/**
 * Debug: muestra la estructura cruda del Excel de Adobe para un PDF de escalafón.
 * Uso: npx tsx scripts/tests/debug-escalafon-excel.ts
 */

import { readFile } from "fs/promises";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { AdobePdfService } from "../../src/lib/excel/services/adobePdfService";

// Cargar .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const PDF_FILE = process.argv[2] ?? "listado-farmacia.pdf";
const pdfPath = path.join("src/assets/PDFs/escalafon", PDF_FILE);

async function main() {
  const buffer = await readFile(pdfPath);
  const excelBuffer = await AdobePdfService.convertPdfToExcel(buffer, PDF_FILE);

  const workbook = XLSX.read(excelBuffer);
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n=== Sheet: ${sheetName} ===`);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
    });
    console.log(`Total rows: ${rows.length}`);

    const MAX = rows.length;
    for (let i = 0; i < MAX; i++) {
      const nonNull = rows[i].filter((c) => c !== null);
      if (nonNull.length === 0) {
        console.log(`  [${i}] (vacío)`);
        continue;
      }
      const c0 = JSON.stringify(rows[i][0]);
      const c1 = JSON.stringify(rows[i][1]);
      const c2 = JSON.stringify(rows[i][2]);
      const c3 = String(rows[i][3] ?? "").slice(0, 20);
      const c6 = JSON.stringify(rows[i][6]);
      const len = rows[i].length;
      console.log(
        `  [${i}] [${c0}, ${c1}, ${c2}, "${c3}"...] col6=${c6} cols=${len}`,
      );
    }
  }
}

main();
