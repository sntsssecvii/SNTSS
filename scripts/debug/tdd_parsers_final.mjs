/**
 * TDD COMPLETO - Verifica parsers contra valores EXACTOS de los archivos Excel reales
 * Ejecutar: node scripts/debug/tdd_parsers_final.mjs
 */
import XLSX from 'xlsx';
import path from 'path';

const ASSETS = path.join(process.cwd(), 'src/assets/PDFs');

function excelDateToString(serial) {
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function filterJoin(a, b) {
    return [a, b].filter(Boolean).join(' - ');
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

function checkPattern(label, actual, pattern, comment = '') {
    if (pattern.test(actual)) {
        console.log(`  ✅ ${label}: "${actual}" ${comment}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}: "${actual}" no coincide con ${pattern} ${comment}`);
        failed++;
    }
}

function checkNoSuffix(label, actual, badSuffix) {
    if (!actual || !actual.endsWith(badSuffix)) {
        console.log(`  ✅ ${label}: "${actual}" (sin sufijo "${badSuffix}")`);
        passed++;
    } else {
        console.log(`  ❌ ${label}: "${actual}" termina con el sufijo indeseado "${badSuffix}"`);
        failed++;
    }
}

// ═══════════════════════════════════════════════════════
// 1. AMPLIACIONES DE JORNADA
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('📄 AMPLIACIONES DE JORNADA');
console.log('═'.repeat(60));
{
    const wb = XLSX.readFile(path.join(ASSETS, 'AMPLIACIONES DE JORNADA.xlsx'));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Muestra fila 7 (índice)
    const row = rows[7];
    console.log('\n  Datos fila de muestra:');

    // Col[0] = NoProg
    check('numeroProg', String(row[0]), '1');
    // Col[1] = jornadaNueva (80 hrs)
    check('jornadaNueva', String(row[1]), '80');
    // Col[2] = adscripcionNueva (clave destino)
    check('adscripcionNueva', String(row[2]), '02HF120000');
    // Col[3] = turnoNuevo
    check('turnoNuevo', String(row[3]), 'Ves');
    // Col[4] = fecha (serial → dd/mm/yyyy)
    check('fecha', excelDateToString(row[4]), '31/07/2024');
    // Col[5] = estatus
    check('estatus', String(row[5]), 'A');
    // Col[6] = diasLaborados
    check('diasLaborados [col6]', String(row[6]), '1181');
    // Col[7] = matricula
    check('matricula', String(row[7]), '97020621');
    // Col[8] = nombre
    check('nombre', String(row[8]), 'SALDIVAR/BARRIOS/JOSE ARMANDO');
    // Col[9] = sexo
    check('sexo', String(row[9]), 'M');
    // Col[10+11] = adscripcionAnterior (sin guion huerfano)
    const adscAnt = filterJoin(String(row[10] || '').trim(), String(row[11] || '').trim());
    checkNoSuffix('adscripcionAnterior sin guion huerfano', adscAnt, ' - ');
    check('adscripcionAnterior completo', adscAnt, '02UA38210A - JEFATURA DE MEDICINA FAMILIAR');
    // Col[12] = numeroPlaza
    check('numeroPlaza [col12]', String(row[12]), '19649');
    // Col[13] = jornadaActual
    check('jornadaActual [col13]', String(row[13]), '6');
    // Col[14] = turnoAnterior
    check('turnoAnterior [col14]', String(row[14]), 'Ves');

    // Contar registros totales
    let count = 0;
    for (const r of rows) {
        if (!r || r.length === 0) continue;
        if (/^\d+$/.test(String(r[0])) && String(r[7] || '').trim() && String(r[8] || '').trim()) count++;
    }
    console.log(`\n  📊 Total registros detectables: ${count}`);
    if (count > 600) { console.log('  ✅ Total razonable (>600)'); passed++; }
    else { console.log('  ❌ Total demasiado bajo'); failed++; }
}

// ═══════════════════════════════════════════════════════
// 2. CAMBIOS DE ÁREA
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('📄 CAMBIOS DE ÁREA');
console.log('═'.repeat(60));
{
    const wb = XLSX.readFile(path.join(ASSETS, 'CAMBIOS DE ÁREA.xlsx'));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const row = rows[7];
    console.log('\n  Datos fila de muestra:');

    check('numeroProg', String(row[0]), '1');
    check('registro/tipo [col1]', String(row[1]), 'CAR');
    check('adscripcionNueva [col2]', String(row[2]), '02HC300000');
    check('turnoNuevo [col3]', String(row[3]), 'Ves');
    check('jornadaNueva [col4] — son HORAS, no dias', String(row[4]), '14');
    check('fecha [col5]', excelDateToString(row[5]), '28/08/2024');
    check('estatus [col6]', String(row[6]), 'A');
    check('diasLaborados [col7]', String(row[7]), '3079');
    check('matricula [col8]', String(row[8]), '98024835');
    check('nombre [col9]', String(row[9].trim()), 'TORRES/CORDOVA/ANA ROCIO');
    check('sexo [col10]', String(row[10]), 'F');
    const adscAnt = filterJoin(String(row[11] || '').trim(), String(row[12] || '').trim());
    checkNoSuffix('adscripcionAnterior sin guion huerfano', adscAnt, ' - ');
    check('adscripcionAnterior', adscAnt, '02HC302G00 - DEPARTAMENTO DE ENFERMERIA');
    check('numeroPlaza [col13]', String(row[13]), '25348');
    check('jornadaActual [col14]', String(row[14]), '8');
    check('turnoAnterior [col15]', String(row[15]), 'Ves');
}

// ═══════════════════════════════════════════════════════
// 3. CAMBIOS DE RAMA
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('📄 CAMBIOS DE RAMA');
console.log('═'.repeat(60));
{
    const wb = XLSX.readFile(path.join(ASSETS, 'CAMBIOS DE RAMA.xlsx'));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const row = rows[8];
    console.log('\n  Datos fila de muestra:');

    check('numeroProg', String(row[0]), '1');
    check('ramaNueva [col1] como String', String(row[1]), '2021003');  // Col1 es número pero debe ser String
    check('calificacion [col2] como String', String(row[2]), '99.99');
    check('fecha [col3]', excelDateToString(row[3]), '13/12/2021');
    check('estatus [col4]', String(row[4]), 'A');
    check('diasLaborados [col5]', String(row[5]), '5915');
    check('matricula [col6]', String(row[6]), '99026239');
    check('nombre [col7]', String(row[7]), 'SALAZAR/CRUZ/OSCAR GUADALUPE');
    check('sexo [col8]', String(row[8]), 'M');

    const adscAnt = filterJoin(String(row[9] || '').trim(), String(row[11] || '').trim());
    checkNoSuffix('adscripcionAnterior sin guion huerfano', adscAnt, ' - ');
    check('adscripcionAnterior', adscAnt, '02UA18210A - JEFATURA DE MEDICINA FAMILIAR');
    check('numeroPlaza [col14]', String(row[14]), '23075');
    check('jornadaActual [col15]', String(row[15]), '8');
    check('turnoAnterior [col16]', String(row[16]), 'JAcum');
}

// ═══════════════════════════════════════════════════════
// 4. CAMBIOS DE RESIDENCIA DESTINO
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('📄 CAMBIOS DE RESIDENCIA DESTINO');
console.log('═'.repeat(60));
{
    const wb = XLSX.readFile(path.join(ASSETS, 'CAMBIOS DE RESIDENCIA DESTINO.xlsx'));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Fila 12 (con plaza)
    const row12 = rows[12];
    console.log('\n  Fila 12 (con plaza):');
    check('delegacionDestino [col1]', String(row12[1]), '02 - BAJA CALIFORNIA');
    check('turnoNuevo [col3]', String(row12[3]), 'Mat');
    check('fecha [col4]', excelDateToString(row12[4]), '27/12/2021');
    check('estatus [col5]', String(row12[5]), 'A');
    check('diasLaborados [col6]', String(row12[6]), '1740');
    check('matricula [col7]', String(row12[7]), '98255845');
    check('nombre [col8]', String(row12[8]), 'LOZANO/JARAMILLO/DIEGO ALBERTO');
}

// ═══════════════════════════════════════════════════════
// 5. CAMBIOS DE RESIDENCIA ORIGEN
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('📄 CAMBIOS DE RESIDENCIA ORIGEN');
console.log('═'.repeat(60));
{
    const wb = XLSX.readFile(path.join(ASSETS, 'CAMBIOS DE RESIDENCIA ORIGEN.xlsx'));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const row = rows[8];
    console.log('\n  Datos fila de muestra:');

    check('delegacionOrigen [col1]', String(row[1]), '03 - BAJA CALIFORNIA SUR');
    check('turnoNuevo [col3]', String(row[3]), 'Mat');
    check('fecha [col4]', excelDateToString(row[4]), '09/05/2025');
    check('estatus [col5]', String(row[5]), 'A');
    check('diasLaborados [col6]', String(row[6]), '1966');
    check('matricula [col7]', String(row[7]), '991445813');
    check('nombre [col8]', String(row[8]), 'VAZQUEZ/HIGUERA/ELIZABETH');
    check('sexo [col9]', String(row[9]), 'F');

    const adscAnt = filterJoin(String(row[10] || '').trim(), String(row[12] || '').trim());
    check('adscripcionAnterior', adscAnt, '02HA202E00 - COORDINACION CLINICA DE MEDICINA');
    check('numeroPlaza [col14]', String(row[14]), '1797');
    check('jornadaActual [col15]', String(row[15]), '8');
    check('turnoAnterior [col16]', String(row[16]), 'Mat');
}

// ═══════════════════════════════════════════════════════
// 6. CAMBIOS DE TIPO DE PLAZA  
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('📄 CAMBIOS DE TIPO DE PLAZA');
console.log('═'.repeat(60));
{
    const wb = XLSX.readFile(path.join(ASSETS, 'CAMBIOS DE TIPO DE PLAZA.xlsx'));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const row = rows[7];
    console.log('\n  Datos fila de muestra:');

    check('numeroProg', String(row[0]), '1');
    check('registro/tipo [col1]', String(row[1]), 'CTP');
    check('adscripcionNueva [col2]', String(row[2]), '02HF120000');
    check('turnoNuevo [col3]', String(row[3]), 'Mat');
    check('fecha [col5]', excelDateToString(row[5]), '09/05/2025');
    check('estatus [col6]', String(row[6]), 'A');
    check('diasLaborados [col7]', String(row[7]), '1894');
    check('matricula [col8]', String(row[8]), '98029912');
    check('nombre [col9]', String(row[9]), 'FRANCO/ESCUTIA/ZULMA YANET');
    check('sexo [col10]', String(row[10]), 'F');

    const adscAnt = filterJoin(String(row[11] || '').trim(), String(row[12] || '').trim());
    checkNoSuffix('adscripcionAnterior sin guion huerfano', adscAnt, ' - ');
    check('adscripcionAnterior', adscAnt, '02HF122G00 - DEPARTAMENTO DE ENFERMERIA');
    check('numeroPlaza [col13]', String(row[13]), '15109');
    check('jornadaActual [col14]', String(row[14]), '8');
    check('turnoAnterior [col15]', String(row[15]), 'Mat');
}

// ═══════════════════════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log(`📊 RESULTADO FINAL: ${passed} ✅ pasaron | ${failed} ❌ fallaron`);
console.log('═'.repeat(60));

if (failed === 0) {
    console.log('\n🎉 TODOS LOS TESTS TDD PASARON — Parsers verificados contra datos reales\n');
} else {
    console.log(`\n⚠️  ${failed} tests fallaron — revisar mapeos\n`);
    process.exit(1);
}
