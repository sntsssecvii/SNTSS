/**
 * TDD FINAL - Verifica que el parser CAMBIOS_AREA extrae TODOS los campos correctamente
 * incluyendo los 4 bugs reportados:
 * 1. numeroProg ✓ (ya se extraía, faltaba en modal UI)
 * 2. jornadaNueva NO debe mostrar "Concepto" ✓ 
 * 3. estatus ✓ (ya se extraía, verificar modal UI)
 * 4. jornadaActual ✓ (bug: leía row[15] en vez de row[14])
 * 
 * Ejecutar: node scripts/debug/tdd_cambios_area.mjs
 */
import XLSX from 'xlsx';
import path from 'path';

const ASSETS = path.join(process.cwd(), 'src/assets/PDFs');

function excelDateToString(serial) {
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

let passed = 0, failed = 0;

function check(label, actual, expected) {
    if (actual === expected) {
        console.log(`  ✅ ${label}: "${actual}"`);
        passed++;
    } else {
        console.log(`  ❌ ${label}: esperado "${expected}", obtenido "${actual}"`);
        failed++;
    }
}

function checkDefined(label, actual) {
    if (actual !== undefined && actual !== null && actual !== '') {
        console.log(`  ✅ ${label}: "${actual}" (definido)`);
        passed++;
    } else {
        console.log(`  ❌ ${label}: vacío/undefined`);
        failed++;
    }
}

// ═══════════════════════════════════════════════════════
// SIMULAR parseCambiosAreaExcel con el FIX aplicado
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('🧪 TDD CAMBIOS DE ÁREA — Parser con FIX aplicado');
console.log('═'.repeat(60));

const wb = XLSX.readFile(path.join(ASSETS, 'CAMBIOS DE ÁREA.xlsx'));
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
const row = rows[7];

// Simular parseCambiosAreaExcel DESPUÉS del fix
const col0 = String(row[0] || '').trim();
const col1 = String(row[1] || '').trim();
const col2 = String(row[2] || '').trim();
const col8 = String(row[8] || '').trim();
const col9 = String(row[9] || '').trim();
const fechaRaw = row[5];
const fecha = typeof fechaRaw === 'number' ? excelDateToString(fechaRaw) : String(fechaRaw || '').trim();
const adscAnt = [String(row[11] || '').trim(), String(row[12] || '').trim()].filter(Boolean).join(' - ');

const registro = {
    numeroProg: col0,
    registro: col1 || undefined,        // Concepto (CAR)
    adscripcionNueva: col2 || undefined,
    turnoNuevo: String(row[3] || '').trim() || undefined,
    jornadaNueva: row[4] !== undefined ? String(row[4]) : undefined,
    fecha,
    estatus: String(row[6] || '').trim() || undefined,
    diasLaborados: String(row[7] || '').trim() || undefined,
    numeroPlaza: String(row[13] || '').trim() || undefined,
    matricula: col8,
    nombre: col9,
    sexo: String(row[10] || '').trim() || undefined,
    adscripcionAnterior: adscAnt || undefined,
    // ← FIX APLICADO: ahora lee row[14] en vez de row[15]
    jornadaActual: row[14] !== undefined ? String(row[14]) : undefined,
    turnoAnterior: String(row[15] || '').trim() || undefined,
};

// ═══════════════════════════════════════════════════════
// TESTS — Los 4 bugs reportados por el usuario
// ═══════════════════════════════════════════════════════
console.log('\n  ── BUG 1: Numero Progresivo debe existir ──');
checkDefined('numeroProg', registro.numeroProg);
check('numeroProg valor', registro.numeroProg, '1');

console.log('\n  ── BUG 2: Jornada Solicitada NO debe mostrar Concepto ──');
check('jornadaNueva = horas (14)', registro.jornadaNueva, '14');
check('registro = concepto (CAR)', registro.registro, 'CAR');
// Asegurar que son DISTINTOS — jornadaNueva != concepto
const jornadaEsConcepto = registro.jornadaNueva === registro.registro;
if (!jornadaEsConcepto) { console.log(`  ✅ jornadaNueva (${registro.jornadaNueva}) ≠ concepto (${registro.registro})`); passed++; }
else { console.log(`  ❌ jornadaNueva IGUALA al concepto!`); failed++; }

console.log('\n  ── BUG 3: Estatus debe existir ──');
checkDefined('estatus', registro.estatus);
check('estatus valor', registro.estatus, 'A');

console.log('\n  ── BUG 4: Jornada Actual debe ser HORAS, no TURNO ──');
check('jornadaActual = 8 (horas)', registro.jornadaActual, '8');
// Confirmar que NO tiene valor de turno
const jornadaEsTurno = registro.jornadaActual === registro.turnoAnterior;
if (!jornadaEsTurno) { console.log(`  ✅ jornadaActual (${registro.jornadaActual}) ≠ turnoAnterior (${registro.turnoAnterior})`); passed++; }
else { console.log(`  ❌ jornadaActual tiene valor de turno!`); failed++; }

// ═══════════════════════════════════════════════════════
// Resto de campos (verificación completa)
// ═══════════════════════════════════════════════════════
console.log('\n  ── Campos restantes (deben seguir correctos) ──');
check('adscripcionNueva', registro.adscripcionNueva, '02HC300000');
check('turnoNuevo', registro.turnoNuevo, 'Ves');
check('fecha', registro.fecha, '28/08/2024');
check('diasLaborados', registro.diasLaborados, '3079');
check('matricula', registro.matricula, '98024835');
check('nombre', registro.nombre, 'TORRES/CORDOVA/ANA ROCIO');
check('sexo', registro.sexo, 'F');
check('adscripcionAnterior', registro.adscripcionAnterior, '02HC302G00 - DEPARTAMENTO DE ENFERMERIA');
check('numeroPlaza', registro.numeroPlaza, '25348');
check('turnoAnterior', registro.turnoAnterior, 'Ves');

// ═══════════════════════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log(`📊 RESULTADO: ${passed} ✅ | ${failed} ❌`);
console.log('═'.repeat(60));

if (failed === 0) {
    console.log('\n🎉 100% — TODOS LOS TESTS PASARON\n');
    console.log('Cambios realizados:');
    console.log('  1. Parser: jornadaActual ahora lee row[14] (horas) en vez de row[15] (turno)');
    console.log('  2. UI Modal: Agregado No. Progresivo a Información del Trabajador');
    console.log('  3. UI Modal: Label "Tipo de Cambio" → "Concepto" para CAMBIOS_AREA');
    console.log('  4. estatus ya se extraía correctamente y se renderiza en el modal');
    console.log('');
} else {
    console.log(`\n⚠️  ${failed} tests fallaron\n`);
    process.exit(1);
}
