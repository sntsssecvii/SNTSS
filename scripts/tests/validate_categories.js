const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const buffer = fs.readFileSync(path.join(process.cwd(), 'src/assets/PDFs/NUEVO INGRESO.xlsx'));
const wb = XLSX.read(buffer, { type: 'buffer' });

function parseNuevoIngreso(workbook) {
    const registros = [];
    let zonaActual = '';
    let categoriaActual = '';
    workbook.SheetNames.forEach(function (sheetName) {
        const ws = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        rows.forEach(function (row, index) {
            if (!row || row.length === 0) return;
            const c0 = String(row[0] || '').trim();
            if (!c0) return;
            const c0n = c0.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            const c1 = String(row[1] || '').trim();
            const c2 = String(row[2] || '').trim();
            const isZone = /^\d{1,2}-\S/.test(c0) || c0n.startsWith('ZONA');
            if (isZone && !c1 && !c2) { zonaActual = c0.replace(/^zona:?\s*/i, '').trim(); return; }
            if (/^\d+$/.test(c0) && row.length >= 3 && c1 && c2) {
                registros.push({ zona: zonaActual, categoria: categoriaActual, hoja: sheetName });
                return;
            }
            if (/^\d{5,6}\s*-\s*\S/.test(c0) && !c1 && !c2) { categoriaActual = c0; return; }
        });
    });
    return registros;
}

const recs = parseNuevoIngreso(wb);
console.log('Total registros:', recs.length);

// Verificar que NINGUNA categoria contiene texto de encabezado
var problemas = recs.filter(function (r) {
    return r.categoria.length > 120 ||
        r.categoria.includes('No. Prog') ||
        r.categoria.includes('DIRECCI') ||
        r.categoria.includes('COORDINACI');
});
console.log('Registros con categoria tipo-encabezado:', problemas.length);

// Categorias con formato valido vs invalido
var validos = 0, invalidos = 0;
var cats = {};
recs.forEach(function (r) {
    var esOk = /^\d{5,6}\s*-\s*\S/.test(r.categoria) || r.categoria === '';
    if (esOk) validos++; else invalidos++;
    cats[r.categoria] = (cats[r.categoria] || 0) + 1;
});
console.log('Formato valido XXXXXX-NOMBRE:', validos);
console.log('Formato INVALIDO:', invalidos);

var catList = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; });
console.log('\nTotal categorias unicas:', catList.length);
catList.forEach(function (cat) {
    var display = cat.length > 70 ? cat.substring(0, 67) + '...' : cat;
    console.log('  [' + cats[cat] + '] ' + (display || '(vacia)'));
});
