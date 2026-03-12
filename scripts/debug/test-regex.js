
function smartParse(linea) {
    const partes = linea.split(/\s+/).filter(p => p.length > 0);
    const fechaIdx = partes.findIndex(p => /\d{2}\/\d{2}\/\d{4}/.test(p));
    if (fechaIdx === -1) return null;

    const fecha = partes[fechaIdx];
    const rest = partes.slice(fechaIdx + 1);

    // El formato suele ser: Grupo, Calificación, [Tipo], Días, Estatus, [Obs]
    // Pero a veces falta Tipo o Días.

    let grupo = '';
    let calif = '';
    let tipo = '';
    let dias = '';
    let estatus = '';
    let obsArr = [];

    if (rest.length > 0) grupo = rest[0];
    if (rest.length > 1) calif = rest[1];

    // Encontrar el estatus: Suele ser una letra sola (A, B, C, S) al final de la parte de datos
    // Buscamos de derecha a izquierda un patrón de "Días Estatus"
    let diasIdx = -1;
    let estatusIdx = -1;

    for (let i = rest.length - 1; i >= 2; i--) {
        const p = rest[i];
        const prev = rest[i - 1];

        // Si p es una letra sola y prev es un número (o N/A)
        if (/^[A-Z]$/.test(p) && /^[\d,./NA-]+$/.test(prev)) {
            estatusIdx = i;
            diasIdx = i - 1;
            break;
        }
    }

    if (diasIdx !== -1) {
        dias = rest[diasIdx];
        estatus = rest[estatusIdx];
        // Lo que esté entre calif y dias es el tipo
        if (diasIdx > 2) {
            tipo = rest.slice(2, diasIdx).join(' ');
        }
        obsArr = rest.slice(estatusIdx + 1);
    } else {
        // Fallback: Asignación posicional
        tipo = rest[2] || '';
        dias = rest[3] || '';
        estatus = rest[4] || '';
        obsArr = rest.slice(5);
    }

    return { grupo, calif, tipo, dias, estatus, obs: obsArr.join(' ') };
}

const samples = [
    "27/11/2023 2023003 73.000 N/A 1-San Luis Rio Col. Son.",
    "21/06/2024 2024002 81.000 N/A 1-San Luis Rio Col. Son.",
    "27/11/2023 2023003 90.000 C 1,249 A Obs Test",
    "27/11/2023 2023003 70.000 500 A"
];

samples.forEach(s => {
    console.log(`\nLINE: ${s}`);
    console.log(smartParse(s));
});
