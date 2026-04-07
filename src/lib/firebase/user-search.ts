type UserSearchInput = {
  email?: string | null
  matricula?: string | null
  nombre?: string | null
  apellidoPaterno?: string | null
  apellidoMaterno?: string | null
}

export type UserSearchFields = {
  emailLowercase: string
  matriculaNormalized: string
  nombreCompletoLowercase: string
}

export type UserSearchMode = 'matriculaNormalized' | 'emailLowercase' | 'nombreCompletoLowercase'

export function normalizeSearchText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function normalizeMatricula(value?: string | null) {
  return (value || '').trim().toUpperCase()
}

export function buildUserSearchFields(input: UserSearchInput): UserSearchFields {
  const nombreCompleto = [
    input.nombre,
    input.apellidoPaterno,
    input.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    emailLowercase: (input.email || '').trim().toLowerCase(),
    matriculaNormalized: normalizeMatricula(input.matricula),
    nombreCompletoLowercase: normalizeSearchText(nombreCompleto),
  }
}

export function resolveUserSearch(rawQuery?: string | null): { fieldPath: UserSearchMode; value: string } | null {
  const trimmed = (rawQuery || '').trim()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) {
    return {
      fieldPath: 'matriculaNormalized',
      value: normalizeMatricula(trimmed),
    }
  }

  if (trimmed.includes('@')) {
    return {
      fieldPath: 'emailLowercase',
      value: trimmed.toLowerCase(),
    }
  }

  const normalized = normalizeSearchText(trimmed)
  if (normalized.length < 2) return null

  return {
    fieldPath: 'nombreCompletoLowercase',
    value: normalized,
  }
}
