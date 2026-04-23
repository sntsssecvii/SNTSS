type UserSearchInput = {
  email?: string | null;
  matricula?: string | null;
  nombre?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
};

export type UserSearchFields = {
  emailLowercase: string;
  matriculaNormalized: string;
  nombreCompletoLowercase: string;
  searchTokens: string[];
};

export type UserSearchMode =
  | "matriculaNormalized"
  | "emailLowercase"
  | "nombreCompletoLowercase"
  | "searchTokens";

export function normalizeSearchText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeMatricula(value?: string | null) {
  return (value || "").trim().toUpperCase();
}

export function buildUserSearchFields(
  input: UserSearchInput,
): UserSearchFields {
  // Apellidos primero para que la búsqueda por prefijo funcione buscando por apellido
  // (uso típico en SNTSS: buscar "Aldana" encuentra "Aldana Castro Hugo Alberto")
  const nombreCompleto = [
    input.apellidoPaterno,
    input.apellidoMaterno,
    input.nombre,
  ]
    .filter(Boolean)
    .join(" ");

  // Tokens individuales normalizados para búsqueda por cualquier parte del nombre
  // (permite buscar por nombre de pila, apellido materno, etc.)
  const searchTokens = [
    input.nombre,
    input.apellidoPaterno,
    input.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .map((w) => normalizeSearchText(w))
    .filter((w) => w.length >= 2);

  return {
    emailLowercase: (input.email || "").trim().toLowerCase(),
    matriculaNormalized: normalizeMatricula(input.matricula),
    nombreCompletoLowercase: normalizeSearchText(nombreCompleto),
    searchTokens,
  };
}

export function resolveUserSearch(
  rawQuery?: string | null,
): { fieldPath: UserSearchMode; value: string } | null {
  const trimmed = (rawQuery || "").trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    return {
      fieldPath: "matriculaNormalized",
      value: normalizeMatricula(trimmed),
    };
  }

  if (trimmed.includes("@")) {
    return {
      fieldPath: "emailLowercase",
      value: trimmed.toLowerCase(),
    };
  }

  const normalized = normalizeSearchText(trimmed);
  if (normalized.length < 2) return null;

  // Si la búsqueda es una sola palabra, usar array-contains en searchTokens
  // para encontrar cualquier parte del nombre (nombre, apellido paterno o materno).
  // Si es multi-palabra, seguir usando prefijo en nombreCompletoLowercase para
  // búsquedas del tipo "Lopez Beltran" que ya funcionan correctamente.
  if (!normalized.includes(" ")) {
    return {
      fieldPath: "searchTokens",
      value: normalized,
    };
  }

  return {
    fieldPath: "nombreCompletoLowercase",
    value: normalized,
  };
}
