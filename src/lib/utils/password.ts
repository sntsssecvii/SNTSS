/**
 * Utilidades para validación de contraseñas
 */

export interface PasswordStrength {
    score: number // 0-4
    label: string
    color: string
    suggestions: string[]
}

export function evaluarFortalezaPassword(password: string): PasswordStrength {
    let score = 0
    const suggestions: string[] = []

    // Longitud
    if (password.length >= 8) score++
    else suggestions.push('Usa al menos 8 caracteres')

    if (password.length >= 12) score++

    // Mayúsculas
    if (/[A-Z]/.test(password)) score++
    else suggestions.push('Incluye al menos una mayúscula')

    // Minúsculas
    if (/[a-z]/.test(password)) score++
    else suggestions.push('Incluye al menos una minúscula')

    // Números
    if (/\d/.test(password)) score++
    else suggestions.push('Incluye al menos un número')

    // Caracteres especiales
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++
    else suggestions.push('Incluye al menos un carácter especial (!@#$%...)')

    // Normalizar score a 0-4
    const normalizedScore = Math.min(Math.floor(score / 1.5), 4)

    // Determinar label y color
    let label = ''
    let color = ''

    switch (normalizedScore) {
        case 0:
        case 1:
            label = 'Muy débil'
            color = 'bg-red-500'
            break
        case 2:
            label = 'Débil'
            color = 'bg-orange-500'
            break
        case 3:
            label = 'Buena'
            color = 'bg-yellow-500'
            break
        case 4:
            label = 'Fuerte'
            color = 'bg-green-500'
            break
    }

    return {
        score: normalizedScore,
        label,
        color,
        suggestions: suggestions.slice(0, 3) // Máximo 3 sugerencias
    }
}

export function passwordsCoinciden(password: string, confirmPassword: string): boolean {
    return password === confirmPassword && password.length > 0
}
