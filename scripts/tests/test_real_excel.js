/**
 * Script de prueba COMPLETO con el archivo real NUEVO INGRESO.xlsx
 * Simula exactamente la lógica del parser actualizado
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const buffer = fs.readFileSync(path.join(process.cwd(), 'src/assets/PDFs/NUEVO INGRESO.xlsx'));
const wb = XLSX.read(buffer, { type: 'buffer' });

// ── Lógica del parser (NUEVA versión) ─────────────────────────────────────────

function parseNuevoIngreso(workbook) {
    const registros = [];
    const errores = [];

    let zonaActual = '';
    let categoriaActual = '';

    workbook.SheetNames.forEach(function (sheetName) {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // AMBAS variables persisten entre hojas

        rows.forEach(function (row, index) {
            if (!row || row.length === 0) return;

            const firstColRaw = String(row[0] || '').trim();
            if (!firstColRaw) return;

            const firstColNorm = firstColRaw
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase();

            const col1 = String(row[1] || '').trim();
            const col2 = String(row[2] || '').trim();

            // 1. Zona
            const isZonePattern =
                /^\d{1,2}-\S/.test(firstColRaw) ||
                firstColNorm.startsWith('ZONA');

            if (isZonePattern && !col1 && !col2) {
                zonaActual = firstColRaw.replace(/^zona:?\s*/i, '').trim();
                return;
            }

            // 2. Registro
            const isNumericNoProg = /^\d+$/.test(firstColRaw);
            if (isNumericNoProg && row.length >= 3 && col1 && col2) {
                registros.push({
                    numeroProg: firstColRaw,
                    nombre: col1,
                    matricula: col2,
                    zona: zonaActual,
                    categoria: categoriaActual,
                    hoja: sheetName,
                    fila: index + 1,
                });
                return;
            }

            // 3. Categoría (SOLO formato: XXXXXX - NOMBRE)
            if (/^\d{5,6}\s*-\s*\S/.test(firstColRaw) && !col1 && !col2) {
                categoriaActual = firstColRaw;
                return;
            }

            // Todo lo demás → ignorar
        });
    });

    return { registros, errores };
}

// ── Ejecutar y analizar resultados ─────────────────────────────────────────────

console.log('Procesando archivo: NUEVO INGRESO.xlsx');
console.log('Hojas:', wb.SheetNames.join(', '));
console.log('');

const { registros, errores } = parseNuevoIngreso(wb);

console.log('Total registros extraídos:', registros.length);
console.log('');

// Analizar categorías
const catCount = {};
registros.forEach(function (r) {
    catCount[r.categoria] = (catCount[r.categoria] || 0) + 1;
});

// Detectar categorías incorrectas (texto de encabezado)
const incorrectas = Object.keys(catCount).filter(function (cat) {
    return cat.includes('DIRECCIÓN') ||
        cat.includes('COORDINACIÓN') ||
        cat.includes('DIVISION') ||
        cat.includes('LISTADO') ||
        cat.includes('OFICINA') ||
        cat.toLowerCase() === 'todas' ||
        cat.length > 150;
});

if (incorrectas.length === 0) {
    console.log('✅ NINGUNA CATEGORÍA INCORRECTA encontrada!');
} else {
    console.log('❌ CATEGORÍAS INCORRECTAS:');
    incorrectas.forEach(function (cat) {
        console.log('   [' + catCount[cat] + ' registros] "' + cat.substring(0, 80) + '"');
    });
}

// Registros sin categoría
const sinCategoria = registros.filter(function (r) { return !r.categoria; });
console.log('\nRegistros sin categoría:', sinCategoria.length);

// Top categorías
console.log('\n═══ TOP 15 CATEGORÍAS ═══');
Object.entries(catCount)
    .sort(function (a, b) { return b[1] - a[1]; })
    .slice(0, 15)
    .forEach(function (entry) {
        const cat = entry[0];
        const count = entry[1];
        const display = cat.length > 60 ? cat.substring(0, 57) + '...' : cat;
        const marker = incorrectas.includes(cat) ? '❌' : '✅';
        console.log(marker + ' [' + count + '] "' + (display || '(vacía)') + '"');
    });

// Estadísticas por zona
const zonaCount = {};
registros.forEach(function (r) {
    zonaCount[r.zona] = (zonaCount[r.zona] || 0) + 1;
});
console.log('\n═══ ZONAS DETECTADAS ═══');
Object.entries(zonaCount)
    .sort(function (a, b) { return b[1] - a[1]; })
    .forEach(function (entry) {
        console.log('  [' + entry[1] + '] "' + (entry[0] || '(sin zona)') + '"');
    });

console.log('\n═══ REGISTROS POR HOJA ═══');
const hojaCount = {};
registros.forEach(function (r) {
    hojaCount[r.hoja] = (hojaCount[r.hoja] || 0) + 1;
});
Object.entries(hojaCount).forEach(function (entry) {
    console.log('  ' + entry[0] + ': ' + entry[1] + ' registros');
});
