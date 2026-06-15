/**
 * Captura el Excel que Adobe produce para los PDFs fixture del test del parser
 * de escalafón, y lo congela como fixture binario determinista. Esto permite
 * que el test unitario (escalafon-condicionalidad.test.ts) mockee Adobe y sea
 * estable, sin depender del servicio en vivo.
 *
 * Re-correr solo si cambian los PDFs fixture o el contrato de salida de Adobe:
 *   tsx scripts/tests/capturar-fixtures-adobe-escalafon.ts
 *
 * Requiere credenciales Adobe (ADOBE_CLIENT_ID / ADOBE_CLIENT_SECRET) en .env.local.
 */
import fs from "fs";
import path from "path";
import { AdobePdfService } from "../../src/lib/excel/services/adobePdfService";

// Cargar .env.local para credenciales Adobe
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const PDF_DIR = path.join(process.cwd(), "src/assets/PDFs/escalafon");
const OUT_DIR = path.join(
  process.cwd(),
  "src/lib/pdf/parsers/__tests__/fixtures",
);

const PDFS = [
  "listado-enf-quirurgica.pdf",
  "listado-enf-pediatra.pdf",
  "listado-farmacia.pdf",
];

async function main() {
  if (!process.env.ADOBE_CLIENT_ID || !process.env.ADOBE_CLIENT_SECRET) {
    throw new Error(
      "Faltan credenciales Adobe (ADOBE_CLIENT_ID / ADOBE_CLIENT_SECRET) en .env.local",
    );
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const pdf of PDFS) {
    const buffer = fs.readFileSync(path.join(PDF_DIR, pdf));
    console.log(`\nConvirtiendo ${pdf} ...`);
    const excel = await AdobePdfService.convertPdfToExcel(buffer, pdf);
    const outName = pdf.replace(/\.pdf$/, ".adobe.xlsx");
    fs.writeFileSync(path.join(OUT_DIR, outName), excel);
    console.log(`  → ${outName} (${(excel.length / 1024).toFixed(1)} KB)`);
  }
  console.log("\nFixtures capturados en", OUT_DIR);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
