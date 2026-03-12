function extraerCamposRest(tokens, grupoExistente = '') {
    let grupo = grupoExistente.trim()
    let calificacion = ''
    let tipoContratacion = ''
    let diasLaborados = ''
    let estatus = ''
    let observations = []

    const activeTokens = tokens.map(t => (t || '').trim()).filter(Boolean)
    let i = 0

    console.log("Input Grupo:", grupo);
    console.log("Tokens:", activeTokens);

    if (grupo && grupo.length === 6 && activeTokens[i] && /^\d$/.test(activeTokens[i])) {
        console.log("Join triggered!");
        grupo += activeTokens[i++]
    }

    if (!grupo && activeTokens[i] && /^\d{6,8}$/.test(activeTokens[i])) {
        grupo = activeTokens[i++]
    }

    if (activeTokens[i] && /^\d+\.\d+$/.test(activeTokens[i])) {
        calificacion = activeTokens[i++]
    }

    if (activeTokens[i] && /^\d{1,2}$/.test(activeTokens[i])) {
        tipoContratacion = activeTokens[i++]
    }

    if (activeTokens[i] && (/^[\d,.]+$/.test(activeTokens[i]) || activeTokens[i].toUpperCase() === 'N/A') && !/^[A-Z]$/.test(activeTokens[i])) {
        diasLaborados = activeTokens[i++].replace(/,/g, '')
    }

    if (activeTokens[i] && /^[A-Z]$/.test(activeTokens[i])) {
        estatus = activeTokens[i++]
    }

    observations = activeTokens.slice(i)

    return { grupo, calificacion, tipoContratacion, diasLaborados, estatus, observations }
}

const res = extraerCamposRest(["1", "4.000", "8", "3,938", "A"], "201800");
console.log(JSON.stringify(res, null, 2));
