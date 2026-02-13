/**
 * Utilidades para validación de CURP
 */

// Validación básica del formato de CURP
export function validarFormatoCURP(curp: string): boolean {
    const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/
    return curpRegex.test(curp)
}

// Validar dígito verificador de CURP
export function validarDigitoVerificador(curp: string): boolean {
    if (curp.length !== 18) return false

    const diccionario = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"
    let suma = 0

    for (let i = 0; i < 17; i++) {
        suma += diccionario.indexOf(curp[i]) * (18 - i)
    }

    const digitoEsperado = (10 - (suma % 10)) % 10
    const digitoActual = parseInt(curp[17])

    return digitoEsperado === digitoActual
}

// Extraer información del CURP
export function extraerInfoCURP(curp: string) {
    if (!validarFormatoCURP(curp)) {
        return null
    }

    const año = parseInt(curp.substring(4, 6))
    const mes = parseInt(curp.substring(6, 8))
    const dia = parseInt(curp.substring(8, 10))
    const sexo = curp[10] === 'H' ? 'Hombre' : 'Mujer'
    const estado = obtenerEstado(curp.substring(11, 13))

    // Determinar el año completo (19xx o 20xx)
    const añoCompleto = año >= 0 && año <= 30 ? 2000 + año : 1900 + año

    return {
        fechaNacimiento: `${dia}/${mes}/${añoCompleto}`,
        sexo,
        estado,
        valido: validarDigitoVerificador(curp)
    }
}

// Mapeo de códigos de estado
function obtenerEstado(codigo: string): string {
    const estados: Record<string, string> = {
        'AS': 'Aguascalientes',
        'BC': 'Baja California',
        'BS': 'Baja California Sur',
        'CC': 'Campeche',
        'CL': 'Coahuila',
        'CM': 'Colima',
        'CS': 'Chiapas',
        'CH': 'Chihuahua',
        'DF': 'Ciudad de México',
        'DG': 'Durango',
        'GT': 'Guanajuato',
        'GR': 'Guerrero',
        'HG': 'Hidalgo',
        'JC': 'Jalisco',
        'MC': 'México',
        'MN': 'Michoacán',
        'MS': 'Morelos',
        'NT': 'Nayarit',
        'NL': 'Nuevo León',
        'OC': 'Oaxaca',
        'PL': 'Puebla',
        'QT': 'Querétaro',
        'QR': 'Quintana Roo',
        'SP': 'San Luis Potosí',
        'SL': 'Sinaloa',
        'SR': 'Sonora',
        'TC': 'Tabasco',
        'TS': 'Tamaulipas',
        'TL': 'Tlaxcala',
        'VZ': 'Veracruz',
        'YN': 'Yucatán',
        'ZS': 'Zacatecas',
        'NE': 'Nacido en el Extranjero'
    }

    return estados[codigo] || 'Desconocido'
}

// Validación completa de CURP
export async function validarCURP(curp: string): Promise<{
    valido: boolean
    mensaje: string
    info?: ReturnType<typeof extraerInfoCURP>
}> {
    // Convertir a mayúsculas
    const curpUpper = curp.toUpperCase().trim()

    // Validar longitud
    if (curpUpper.length !== 18) {
        return {
            valido: false,
            mensaje: 'El CURP debe tener exactamente 18 caracteres'
        }
    }

    // Validar formato
    if (!validarFormatoCURP(curpUpper)) {
        return {
            valido: false,
            mensaje: 'Formato de CURP inválido'
        }
    }

    // Validar dígito verificador
    if (!validarDigitoVerificador(curpUpper)) {
        return {
            valido: false,
            mensaje: 'El dígito verificador del CURP es incorrecto'
        }
    }

    // Extraer información
    const info = extraerInfoCURP(curpUpper)

    return {
        valido: true,
        mensaje: 'CURP válido',
        info
    }
}
