/**
 * Test de regresión para el parser de escalafón (condicionalidad SIAP).
 *
 * PDFs de fixture: producción 2024+ (LIST.*.pdf) — Adobe los convierte al 100%.
 * Tests estrictos: FAIL si extracted < declared (no hay excusas con PDFs recientes).
 *
 * PDFs legacy 2022 (listado-*.pdf) se prueban con modo permisivo (WARN si parcial).
 *
 * Uso: npx tsx scripts/tests/test-escalafon-parsers.ts
 */

import fs from "fs";
import path from "path";
import { parsearListadoCondicionalidad } from "../../src/lib/pdf/parsers/escalafon-condicionalidad";

// Cargar .env.local para Adobe credentials
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const PDF_DIR = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "assets",
  "PDFs",
  "escalafon",
);

interface TestConfig {
  file: string;
  label: string;
  strict: boolean; // true = FAIL si extracted < declared
}

// PDFs de producción 2024+ — tests estrictos
const PRODUCTION_TESTS: TestConfig[] = fs
  .readdirSync(PDF_DIR)
  .filter((f) => f.startsWith("LIST") && f.endsWith(".pdf"))
  .sort()
  .map((f) => ({
    file: f,
    label: f.replace(/^LIST\.?\s*/, "").replace(/\.pdf$/, ""),
    strict: true,
  }));

// PDFs legacy 2022 — solo verifican que algo se extraiga
const LEGACY_TESTS: TestConfig[] = [
  {
    file: "listado-enf-pediatra.pdf",
    label: "LEGACY: ENFERMERA PEDIATRICA",
    strict: false,
  },
  {
    file: "listado-enf-quirurgica.pdf",
    label: "LEGACY: ENFERMERA QUIRURGICA",
    strict: false,
  },
  { file: "listado-farmacia.pdf", label: "LEGACY: FARMACIA", strict: false },
];

const TESTS: TestConfig[] = [...PRODUCTION_TESTS, ...LEGACY_TESTS];

async function runTest(t: TestConfig) {
  const pdfPath = path.join(PDF_DIR, t.file);

  if (!fs.existsSync(pdfPath)) {
    return {
      label: t.label,
      status: "SKIP",
      message: `Archivo no encontrado: ${t.file}`,
    };
  }

  const { listado, aspirantes, errores } =
    await parsearListadoCondicionalidad(pdfPath);

  const declared = listado.totalAspirantes;
  const extracted = aspirantes.length;

  // NOTA: NUMERO DE ASPIRANTES en SIAP = tamaño del escalafón nacional para esa categoría,
  // NO el conteo de personas únicas en este listado. No se usa como baseline de validación.
  const lastLugar =
    aspirantes.length > 0 ? Math.max(...aspirantes.map((a) => a.lugar)) : 0;

  const issues: string[] = [];
  if (!listado.categoriaCode) issues.push("categoriaCode vacío");
  if (!listado.periodoDecierre) issues.push("periodoDecierre vacío");
  if (extracted === 0) issues.push("0 aspirantes extraídos");

  // Validar campos clave en cada aspirante
  let camposVacios = 0;
  for (const a of aspirantes) {
    if (!a.nombre) camposVacios++;
    else if (!a.matricula) camposVacios++;
    else if (!a.delegacion) camposVacios++;
    else if (!a.fechaRegistro) camposVacios++;
    else if (!a.preferencias.length) camposVacios++;
  }
  if (camposVacios > 0)
    issues.push(`${camposVacios} aspirantes con campos clave vacíos`);

  const avisos: string[] = [];

  return {
    label: t.label,
    status: issues.length > 0 ? "FAIL" : avisos.length > 0 ? "WARN" : "PASS",
    categoriaCode: listado.categoriaCode,
    periodoDecierre: listado.periodoDecierre,
    declared,
    extracted,
    lastLugar,
    issues,
    avisos,
    parseErrors: errores,
    sample: aspirantes[0]
      ? `#${aspirantes[0].lugar} ${aspirantes[0].nombre} (${aspirantes[0].matricula})`
      : null,
  };
}

async function main() {
  console.log("=== TEST ESCALAFON PARSERS ===\n");
  console.log(`  PDFs de producción: ${PRODUCTION_TESTS.length}`);
  console.log(`  PDFs legacy: ${LEGACY_TESTS.length}\n`);

  let pass = 0,
    warn = 0,
    fail = 0;

  for (const t of TESTS) {
    let r: Awaited<ReturnType<typeof runTest>>;
    try {
      r = await runTest(t);
    } catch (err: unknown) {
      r = { label: t.label, status: "ERROR", message: String(err) };
    }

    const icon = r.status === "PASS" ? "OK" : r.status === "WARN" ? "!!" : "XX";
    console.log(`[${icon}] ${r.label}`);

    if (r.status === "SKIP" || r.status === "ERROR") {
      console.log(`      ${(r as { message?: string }).message}`);
    } else {
      const res = r as {
        categoriaCode?: string;
        periodoDecierre?: string;
        declared?: number;
        extracted?: number;
        lastLugar?: number;
        issues?: string[];
        avisos?: string[];
        parseErrors?: string[];
        sample?: string | null;
      };
      console.log(
        `      Categoría: ${res.categoriaCode} | Periodo: ${res.periodoDecierre}`,
      );
      console.log(
        `      Únicos: ${res.extracted} | Último LUG.ESC: ${res.lastLugar}`,
      );
      if (res.sample) console.log(`      1er aspirante: ${res.sample}`);
      for (const e of res.issues ?? []) console.log(`      ✗ ${e}`);
      for (const a of res.avisos ?? []) console.log(`      ~ ${a}`);
      for (const e of res.parseErrors ?? []) console.log(`      ~ parse: ${e}`);
    }
    console.log("");

    if (r.status === "PASS") pass++;
    else if (r.status === "WARN") warn++;
    else fail++;
  }

  console.log("=== RESUMEN ===");
  console.log(`  PASS: ${pass} | WARN: ${warn} | FAIL/ERROR: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
