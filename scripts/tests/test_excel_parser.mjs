/**
 * Script de diagnóstico para verificar la lógica del parser de Excel
 * Simula las condiciones exactas del bug (múltiples hojas con encabezados largos)
 * 
 * Uso: node scripts/tests/test_excel_parser.mjs
 */

import * as XLSX from 'xlsx';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Lógica del parser (copia del excelParser.ts refactorizado) ───────────────

function parseNuevoIngresoExcel_NUEVA_LOGICA(workbook) {
    const registros = [];
    const errores = [];

    let zonaActual = '';
    let categoriaActual = '';

    workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // ✅ RESETEAR categoría al iniciar cada nueva hoja
        categoriaActual = '';
        let zonaEncontradaEnHoja = false;

        rows.forEach((row, index) => {
            if (!row || row.length === 0) return;

            const firstColRaw = String(row[0] || '').trim();
            if (!firstColRaw) return;

            const firstColNorm = firstColRaw
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase();

            const col1 = String(row[1] || '').trim();
            const col2 = String(row[2] || '').trim();

            // 1. Detectar ZONA
            const isZonePattern =
                /^\d{1,2}-\S/.test(firstColRaw) ||
                firstColNorm.startsWith('ZONA');

            if (isZonePattern && !col1 && !col2) {
                const zonaExtraida = firstColRaw.replace(/^zona:?\s*/i, '').trim();
                zonaActual = zonaExtraida;
                zonaEncontradaEnHoja = true;
                console.log(`  [ZONA detectada en hoja "${sheetName}", fila ${index + 1}]: "${zonaExtraida}"`);
                return;
            }

            // 2. Detectar REGISTRO
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

            // 3. Detectar CATEGORÍA (único formato: "XXXXXX - NOMBRE")
            if (/^\d{5,6}\s*-\s*\S/.test(firstColRaw) && !col1 && !col2) {
                categoriaActual = firstColRaw;
                console.log(`  [CATEGORÍA detectada en hoja "${sheetName}", fila ${index + 1}]: "${firstColRaw}"`);
                return;
            }

            // Ignorar todo lo demás
        });

        void zonaEncontradaEnHoja;
    });

    return { registros, errores };
}

// ─── Tests con datos simulados ─────────────────────────────────────────────────

function crearWorkbookSimulado() {
    const wb = XLSX.utils.book_new();

    // Hoja 1: Zona "1-SAN LUIS RIO COL. SON." con categoría "203601 - OFTALMOLOGIA"
    const hoja1 = [
        // Encabezado largo de la institución (en una sola celda)
        ['DIRECCIÓN DE ADMINISTRACIÓN UNIDAD DE PERSONAL COORDINACIÓN DE GESTIÓN DE RECURSOS HUMANOS DIVISIÓN DE DOTACIÓN DE RECURSOS HUMANOS OFICINA DE DOTACIÓN DE RECURSOS HUMANOS LISTADO DE CANDIDATOS DE NUEVO INGRESO ÓRGANO DE 02 - BAJA CALIFORNIA TODAS OPERACIÓN: CATEGORÍA: TODAS FECHA DE ACTUALIZACIÓN: 01/01/1980 A 09/06/2025'],
        // Zona
        ['1-SAN LUIS RIO COL. SON.'],
        // Categoría válida
        ['203601 - OFTALMOLOGIA'],
        // Headers de columnas
        ['No. Prog', 'Nombre', 'Matrícula', 'Fecha', 'Grupo', 'Cal', 'Tipo', 'Días', 'Estatus', 'Obs'],
        // Registros
        ['1', 'JUAN PÉREZ GARCIA', 'A123456', '01/01/2024', 'A', '95', 'BASE', '365', 'ACTIVO', ''],
        ['2', 'MARIA LOPEZ RUIZ', 'B789012', '15/03/2024', 'B', '88', 'CONFIANZA', '180', 'ACTIVO', ''],
    ];

    // Hoja 2: Nueva zona "3-TIJUANA B.C." con otra categoría
    const hoja2 = [
        // Otro encabezado largo (esto era el bug - se asignaba como categoría)
        ['DIRECCIÓN DE ADMINISTRACIÓN UNIDAD DE PERSONAL COORDINACIÓN DE GESTIÓN DE RECURSOS HUMANOS DIVISIÓN DE DOTACIÓN DE RECURSOS HUMANOS OFICINA DE DOTACIÓN DE RECURSOS HUMANOS LISTADO DE CANDIDATOS DE NUEVO INGRESO ÓRGANO DE 02 - BAJA CALIFORNIA TODAS OPERACIÓN: CATEGORÍA: TODAS FECHA DE ACTUALIZACIÓN: 01/01/1980 A 09/06/2025'],
        // Zona diferente
        ['3-TIJUANA B.C.'],
        // Categoría diferente
        ['301501 - MEDICINA GENERAL'],
        // Headers
        ['No. Prog', 'Nombre', 'Matrícula', 'Fecha', 'Grupo', 'Cal', 'Tipo', 'Días', 'Estatus', 'Obs'],
        // Registros
        ['1', 'CARLOS SANCHEZ MORA', 'C345678', '20/05/2024', 'A', '92', 'BASE', '400', 'ACTIVO', ''],
    ];

    // Hoja 3: Sin zona propia (debería usar la última zona de hoja 2)
    //         pero con nueva categoría
    const hoja3 = [
        ['DIRECCIÓN DE ADMINISTRACIÓN UNIDAD DE PERSONAL COORDINACIÓN DE GESTIÓN DE RECURSOS HUMANOS'],
        // Sin zona (hereda la última)
        ['408901 - ENFERMERIA GENERAL'],
        ['No. Prog', 'Nombre', 'Matrícula', 'Fecha', 'Grupo', 'Cal', 'Tipo', 'Días', 'Estatus', 'Obs'],
        ['1', 'ANA MARTINEZ VEGA', 'D901234', '10/06/2024', 'C', '78', 'BASE', '200', 'ACTIVO', ''],
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hoja1), 'Zona 1');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hoja2), 'Zona 3');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hoja3), 'Zona 3b');

    return wb;
}

// ─── Ejecutar pruebas ──────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════');
console.log('  TEST DEL PARSER DE EXCEL - Verificando fix de categoría');
console.log('═══════════════════════════════════════════════════════════\n');

const wb = crearWorkbookSimulado();
const { registros, errores } = parseNuevoIngresoExcel_NUEVA_LOGICA(wb);

console.log('\n─── RESULTADOS ────────────────────────────────────────────\n');

let hayErrores = false;
registros.forEach((r, i) => {
    const categoriaCorrecta = !r.categoria.includes('DIRECCIÓN') &&
        !r.categoria.includes('COORDINACIÓN') &&
        !r.categoria.includes('TODAS');

    const estado = categoriaCorrecta ? '✅' : '❌ ERROR';
    if (!categoriaCorrecta) hayErrores = true;

    console.log(`${estado} Registro ${i + 1} (Hoja: ${r.hoja}, Fila: ${r.fila})`);
    console.log(`   Nombre: ${r.nombre}`);
    console.log(`   Zona: "${r.zona}"`);
    console.log(`   Categoría: "${r.categoria}"`);
    console.log();
});

console.log(`\nTotal registros: ${registros.length}`);
console.log(`Errores de parseo: ${errores.length}`);

if (!hayErrores) {
    console.log('\n✅ ¡TODOS LOS REGISTROS TIENEN CATEGORÍA CORRECTA!');
    console.log('   El encabezado largo del documento NO se asignó como categoría.');
} else {
    console.log('\n❌ HAY REGISTROS CON CATEGORÍA INCORRECTA - Revisar lógica');
}

// ─── Test también con archivo real si existe ───────────────────────────────────

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
let archivosExcel = [];
try {
    archivosExcel = readdirSync(uploadsDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
} catch (_) { }

if (archivosExcel.length > 0) {
    console.log('\n─── PRUEBA CON ARCHIVO REAL ────────────────────────────────\n');
    const archivoReal = path.join(uploadsDir, archivosExcel[0]);
    const buffer = readFileSync(archivoReal);
    const wbReal = XLSX.read(buffer, { type: 'buffer' });

    console.log(`Procesando: ${archivosExcel[0]}`);
    console.log(`Hojas: ${wbReal.SheetNames.join(', ')}`);

    const resultReal = parseNuevoIngresoExcel_NUEVA_LOGICA(wbReal);

    // Buscar registros con categoría incorrecta (que contienen texto de encabezado)
    const incorrectos = resultReal.registros.filter(r =>
        r.categoria.includes('DIRECCIÓN') ||
        r.categoria.includes('COORDINACIÓN') ||
        r.categoria.includes('LISTADO') ||
        r.categoria.includes('TODAS') ||
        r.categoria.length > 100
    );

    console.log(`\nTotal registros: ${resultReal.registros.length}`);
    console.log(`Registros con categoría incorrecta: ${incorrectos.length}`);

    if (incorrectos.length === 0) {
        console.log('✅ ¡Ningún registro con categoría incorrecta en el archivo real!');
    } else {
        console.log('❌ Registros problemáticos:');
        incorrectos.slice(0, 5).forEach(r => {
            console.log(`   Hoja: ${r.hoja}, Fila: ${r.fila}`);
            console.log(`   Categoría: "${r.categoria.substring(0, 80)}..."`);
        });
    }

    // Estadísticas de categorías
    const categorias = {};
    resultReal.registros.forEach(r => {
        categorias[r.categoria] = (categorias[r.categoria] || 0) + 1;
    });

    console.log('\nTop 10 categorías encontradas:');
    Object.entries(categorias)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([cat, count]) => {
            const display = cat.length > 60 ? cat.substring(0, 57) + '...' : cat;
            console.log(`   [${count}] ${display || '(vacía)'}`);
        });
}
