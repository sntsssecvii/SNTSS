const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const buffer = fs.readFileSync(path.join(process.cwd(), 'src/assets/PDFs/NUEVO INGRESO.xlsx'));
const wb = XLSX.read(buffer, { type: 'buffer' });

// Ver las primeras 20 filas de la HOJA 2 (la que tiene 1058 registros incorrectos)
var sheetName = wb.SheetNames[1]; // Table 2
var ws = wb.Sheets[sheetName];
var rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('=== HOJA 2: "' + sheetName + '" - Primeras 20 filas ===\n');
rows.slice(0, 20).forEach(function (row, i) {
    var col0 = String(row[0] || '').trim();
    var col1 = String(row[1] || '').trim();
    var col2 = String(row[2] || '').trim();
    var col0Display = col0.length > 100 ? col0.substring(0, 100) + '...' : col0;
    console.log('Fila ' + (i + 1) + ':');
    console.log('  col0 (' + col0.length + ' chars): "' + col0Display + '"');
    if (col1) console.log('  col1: "' + col1.substring(0, 50) + '"');
    if (col2) console.log('  col2: "' + col2.substring(0, 30) + '"');

    // Evaluar si pasaría los filtros ACTUALES (antes del fix)
    var col0Norm = col0.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    var isNumericNoProg = /^\d+$/.test(col0);
    var isAdminHeader = col0Norm.includes('DIRECCION DE') ||
        col0Norm.includes('UNIDAD DE') || col0Norm.includes('COORDINACION DE') ||
        col0Norm.includes('DIVISION DE') || col0Norm.includes('OFICINA DE') ||
        col0Norm.includes('LISTADO DE') || col0Norm.includes('CANDIDATOS DE') ||
        col0Norm.includes('ORGANO DE') || col0Norm.includes('PAGINA') ||
        col0Norm.includes('FECHA DE ACTUALIZACION') || col0Norm.includes('OPERACION:') ||
        col0Norm.includes('CATEGORIA:');

    var isZonePattern = /^\d{1,2}-\S/.test(col0) || col0Norm.startsWith('ZONA');
    var isCatFormat = /^\d{5,6}\s*-\s*\S/.test(col0);

    if (!isNumericNoProg && col0.length > 5 && !col1 && !col2 && !isAdminHeader && !isZonePattern) {
        if (!isCatFormat) {
            console.log('  ⚠️  ANTES DEL FIX: Se asignaría como categoriaActual = "' + col0.substring(0, 60) + '"');
        } else {
            console.log('  ✅  Categoría válida detectada');
        }
    }
    if (isCatFormat && !col1 && !col2) {
        console.log('  ✅  NUEVA LOGIC: Categoría detectada por formato "XXXXXX - NOMBRE"');
    }
    if (isZonePattern && !col1 && !col2) {
        console.log('  ✅  NUEVA LOGIC: Zona detectada');
    }
    console.log();
});

// Mostrar la zona y categorías detectadas con la NUEVA lógica
console.log('\n=== SIMULACIÓN CON NUEVA LÓGICA - HOJA 2 ===\n');
var zonaActual = 'Zona 1-San Luis Rio Col. Son.'; // heredada de hoja 1
var categoriaActual = '202100 - AUX DE ENFERMERIA GRAL'; // heredada de hoja 1
var hayErrores = false;

rows.slice(0, 50).forEach(function (row, i) {
    var col0 = String(row[0] || '').trim();
    var col1 = String(row[1] || '').trim();
    var col2 = String(row[2] || '').trim();

    // No. Prog numérico con datos = registro
    if (/^\d+$/.test(col0) && col1 && col2) {
        // Este es un registro válido
    }

    // Formato categoría
    if (/^\d{5,6}\s*-\s*\S/.test(col0) && !col1 && !col2) {
        console.log('Fila ' + (i + 1) + ': CATEGORÍA actualizada a "' + col0 + '"');
        categoriaActual = col0;
    }
});
