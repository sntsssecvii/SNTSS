const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const buffer = fs.readFileSync(path.join(process.cwd(), 'src/assets/PDFs/NUEVO INGRESO.xlsx'));
const wb = XLSX.read(buffer, { type: 'buffer' });

console.log('Hojas totales:', wb.SheetNames.length);

wb.SheetNames.forEach(function (sheetName, sheetIdx) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    console.log('\n=== HOJA ' + (sheetIdx + 1) + ': "' + sheetName + '" (' + rows.length + ' filas) ===');

    let zonaEncontrada = false;
    let categoriaEncontrada = false;

    for (var i = 0; i < Math.min(rows.length, 20); i++) {
        var row = rows[i];
        var col0 = String(row[0] || '').trim();
        var col1 = String(row[1] || '').trim();
        var col2 = String(row[2] || '').trim();

        var col0Norm = col0.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

        // Zona
        if (!zonaEncontrada && (col0Norm.startsWith('ZONA') || /^\d{1,2}-\S/.test(col0)) && !col1 && !col2) {
            console.log('  ZONA fila ' + (i + 1) + ': "' + col0.substring(0, 80) + '"');
            zonaEncontrada = true;
        }
        // Categoria
        if (!categoriaEncontrada && /^\d{5,6}\s*-\s*\S/.test(col0) && !col1 && !col2) {
            console.log('  CAT  fila ' + (i + 1) + ': "' + col0.substring(0, 80) + '"');
            categoriaEncontrada = true;
        }
    }

    if (!zonaEncontrada) console.log('  -> NO tiene zona propia (hereda de hoja anterior)');
    if (!categoriaEncontrada) console.log('  -> NO tiene categoria propia (hereda o vacia)');

    // Contar registros
    var numRegistros = 0;
    rows.forEach(function (row) {
        var col0 = String(row[0] || '').trim();
        var col1 = String(row[1] || '').trim();
        var col2 = String(row[2] || '').trim();
        if (/^\d+$/.test(col0) && col1 && col2) numRegistros++;
    });
    console.log('  Registros: ' + numRegistros);
});
