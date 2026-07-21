// ---------------------------------------------------------------------------
// Query processing — normalización, tokenización, clasificación y reescritura
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Stopwords & expansions
// ---------------------------------------------------------------------------

export const SPANISH_STOPWORDS = new Set([
  "al",
  "ante",
  "bajo",
  "cabe",
  "con",
  "contra",
  "contrato",
  "colectivo",
  "de",
  "del",
  "desde",
  "dice",
  "durante",
  "el",
  "ella",
  "ellas",
  "ellos",
  "en",
  "entre",
  "era",
  "eramos",
  "es",
  "esa",
  "ese",
  "eso",
  "esta",
  "este",
  "esto",
  "fue",
  "ha",
  "hacia",
  "hasta",
  "la",
  "las",
  "le",
  "les",
  "lo",
  "los",
  "mas",
  "mi",
  "mis",
  "muy",
  "o",
  "para",
  "parte",
  "pero",
  "por",
  "pregunta",
  "que",
  "se",
  "segun",
  "ser",
  "si",
  "sin",
  "sobre",
  "su",
  "sus",
  "te",
  "tu",
  "tus",
  "trabajo",
  "un",
  "una",
  "uno",
  "unos",
  "unas",
  "y",
  "ya",
]);

export const INDEX_MARKERS = ["indice", "tabla de contenido", "contenido"];

export const QUERY_EXPANSIONS: Record<string, string[]> = {
  aguinaldo: ["aguinaldo", "gratificacion"],
  antigüedad: ["antiguedad", "antiguedad", "anos", "servicio"],
  becas: ["becas", "beca", "estudios", "capacitacion"],
  cambio: ["cambio", "cambios", "traslado", "adscripcion"],
  confianza: ["confianza", "trabajador", "base"],
  // Coloquialismos para despido/separación
  correr: ["despido", "rescision", "separacion", "cese", "baja"],
  corran: ["despido", "rescision", "separacion", "cese", "baja"],
  descanso: ["vacaciones", "descanso", "descansos"],
  descansos: ["vacaciones", "descanso", "descansos"],
  despedir: ["despido", "rescision", "separacion", "cese"],
  despido: ["despido", "rescision", "separacion", "cese"],
  economico: ["permisos", "economicos", "licencias"],
  economicos: ["permisos", "economicos", "licencias"],
  embarazo: ["maternidad", "embarazo", "lactancia", "guarderia"],
  enfermedad: ["enfermedad", "incapacidad", "medica", "profesional"],
  escalafon: ["escalafon", "promocion", "promociones", "puesto", "puestos"],
  // Coloquialismos para extras/horas extra
  extras: ["horas", "extraordinarias", "jornada", "tiempo"],
  guarderia: ["guarderia", "guarderias", "infantil", "hijos"],
  habitacion: ["habitacion", "vivienda", "prestamo", "hipotecario", "fomento"],
  horario: ["horario", "jornada", "turno", "turnos"],
  // Coloquialismos para acoso
  hostigamiento: ["acoso", "violencia", "laboral", "sexual"],
  hostigar: ["acoso", "violencia", "laboral"],
  hostigando: ["acoso", "violencia", "laboral"],
  incapacidades: ["incapacidad", "licencias", "medica"],
  incapacidad: ["incapacidad", "licencias", "medica"],
  jornada: ["jornada", "horario", "turno", "horas"],
  jubilar: ["jubilacion", "jubilaciones", "pensiones"],
  jubilacion: ["jubilacion", "jubilaciones", "pensiones", "retiro"],
  jubilaciones: ["jubilacion", "jubilaciones", "pensiones"],
  lentes: ["anteojos", "lentes", "optica"],
  licencia: ["licencia", "licencias", "permisos"],
  licencias: ["licencia", "licencias", "permisos"],
  maternidad: ["maternidad", "embarazo", "lactancia", "parto"],
  nivelacion: [
    "nivelacion",
    "calificacion",
    "calificaciones",
    "antiguedad",
    "escalafon",
  ],
  pension: ["pension", "pensiones", "jubilacion"],
  pensiones: ["pension", "pensiones", "jubilacion"],
  permiso: ["permiso", "permisos", "licencias"],
  permisos: ["permiso", "permisos", "licencias"],
  prestamo: ["prestamo", "prestamos", "credito", "hipotecario"],
  promocion: ["promocion", "promociones", "escalafon"],
  promociones: ["promocion", "promociones", "escalafon"],
  rescision: ["rescision", "despido", "separacion"],
  ropa: ["ropa", "uniforme", "uniformes", "vestuario"],
  salario: ["salario", "salarios", "sueldo", "sueldos", "pago", "tabulador"],
  sueldo: ["salario", "salarios", "sueldo", "sueldos", "pago"],
  sueldos: ["salario", "salarios", "sueldo", "sueldos", "pago"],
  turno: ["turno", "turnos", "jornada", "horario"],
  vacacion: ["vacaciones", "vacacionales"],
  vacaciones: ["vacaciones", "vacacionales", "descanso"],
  vacacional: ["vacaciones", "vacacionales"],
  vacacionales: ["vacaciones", "vacacionales"],
  vivienda: ["vivienda", "habitacion", "prestamo", "hipotecario"],
  // Verbos laborales coloquiales → términos contractuales
  faltar: ["falta", "faltas", "ausencia", "permiso", "permisos", "licencia"],
  falte: ["falta", "faltas", "ausencia", "permiso", "licencia"],
  faltas: ["falta", "faltas", "ausencia", "permiso", "licencia"],
  descuenten: ["descuento", "descuentos", "goce", "sueldo", "pago"],
  descuento: ["descuento", "descuentos", "deduccion"],
  descuentos: ["descuento", "descuentos", "deduccion"],
  gano: ["sueldo", "sueldos", "salario", "tabulador", "pago"],
  gana: ["sueldo", "sueldos", "salario", "tabulador", "pago"],
  pagan: ["sueldo", "salario", "pago", "remuneracion", "prestacion"],
  cobro: ["sueldo", "salario", "pago", "tabulador"],
  ausencia: ["falta", "faltas", "ausencia", "permiso", "licencia"],
  muera: ["defuncion", "fallecimiento", "muerte", "licencia"],
  murio: ["defuncion", "fallecimiento", "muerte", "licencia"],
  muerte: ["defuncion", "fallecimiento", "muerte", "licencia"],
  bebe: ["maternidad", "embarazo", "parto", "lactancia"],
  hijo: ["hijo", "hijos", "guarderia", "maternidad"],
  hijos: ["hijo", "hijos", "guarderia", "guarderias"],
};

export const CONVERSATIONAL_PATTERNS = [
  /\b(hola|buenos dias|buenas tardes|buenas noches|hey)\b/,
  // "ayuda" sola NO va aquí: es parte de prestaciones (ayuda de renta, etc.).
  // Solo las formas de saludo/meta.
  /\b(me puedes ayudar|puedes ayudarme|ayudame|necesito ayuda|que puedes hacer|como funcionas|como te uso|en que me ayudas)\b/,
  /\b(gracias|ok|vale|entendido|perfecto)\b/,
];

// ---------------------------------------------------------------------------
// 7 secciones principales del CCT (tabla de contenido oficial)
// ---------------------------------------------------------------------------

export const CONTRACT_SECTIONS = [
  {
    number: 1,
    title: "Contrato Colectivo de Trabajo",
    startPage: 9,
    endPage: 88,
    description:
      "157 cláusulas que regulan la relación laboral entre el IMSS y el SNTSS: contratación, jornadas, permisos, salarios, prestaciones, jubilaciones, escalafón y más.",
  },
  {
    number: 2,
    title: "Tabulador de Sueldos Base",
    startPage: 89,
    endPage: 104,
    description:
      "Tablas de sueldos por categoría, jornada y escalafón para todas las ramas del Instituto.",
  },
  {
    number: 3,
    title: "Profesiogramas",
    startPage: 105,
    endPage: 262,
    description:
      "Perfil de cada categoría: funciones, requisitos, escolaridad y actividades específicas del puesto.",
  },
  {
    number: 4,
    title: "Catálogos",
    startPage: 263,
    endPage: 272,
    description: "Catálogos de categorías, ramas y puestos del Instituto.",
  },
  {
    number: 5,
    title: "Reglamentos",
    startPage: 273,
    endPage: 542,
    description:
      "Reglamentos internos: becas, bolsas de trabajo, escalafón, fondo de retiro, guarderías, ropa de trabajo, capacitación, vehículos, viáticos y más.",
  },
  {
    number: 6,
    title:
      "Convenio Adicional para las Jubilaciones y Pensiones de los Trabajadores de Base de Nuevo Ingreso",
    startPage: 543,
    endPage: 550,
    description:
      "Régimen especial de jubilación y pensión para trabajadores de base que ingresaron después de cierta fecha.",
  },
  {
    number: 7,
    title: "Índice",
    startPage: 551,
    endPage: 999,
    description: "Índice general del contrato colectivo.",
  },
];

// ---------------------------------------------------------------------------
// Common IMSS abbreviations and typo corrections — no LLM call needed
// ---------------------------------------------------------------------------

export const ABBREVIATIONS: Record<string, string> = {
  auo: "auxiliar universal de oficinas",
  cst: "coordinador de servicios tecnicos",
  jgst: "jefe de grupo de servicios tecnicos",
  est: "especialista de servicios tecnicos",
  ost: "oficial de servicios tecnicos",
  egc: "enfermera general clinica",
  ejp: "enfermera jefe de piso",
  cct: "contrato colectivo de trabajo",
  imss: "instituto mexicano del seguro social",
  sntss: "sindicato nacional de trabajadores del seguro social",
  rh: "recursos humanos",
  umf: "unidad de medicina familiar",
  hgz: "hospital general de zona",
  umae: "unidad medica de alta especialidad",
};

export const TYPO_CORRECTIONS: Record<string, string> = {
  hipotecrio: "hipotecario",
  hipotecria: "hipotecario",
  hipotecarios: "hipotecario",
  jubilacion: "jubilación",
  vacasiones: "vacaciones",
  bacaciones: "vacaciones",
  bacacione: "vacaciones",
  vaciones: "vacaciones",
  vacacione: "vacaciones",
  bacaciónes: "vacaciones",
  prestaiones: "prestaciones",
  prestacioes: "prestaciones",
  escalafn: "escalafón",
  escalafo: "escalafón",
  tabuladro: "tabulador",
  profesiograma: "profesiograma",
  profesiogram: "profesiograma",
  incapaciad: "incapacidad",
  aguinlado: "aguinaldo",
  aguilnaldo: "aguinaldo",
  guareria: "guardería",
  guarderia: "guardería",
  guarderias: "guarderías",
};

// ---------------------------------------------------------------------------
// Structure patterns
// ---------------------------------------------------------------------------

export const STRUCTURE_PATTERNS = [
  /\b(que (contiene|incluye|tiene|trae)|de que (trata|se compone|consta))\b.*\b(contrato|cct)\b/,
  /\b(contrato|cct)\b.*\b(que (contiene|incluye|tiene|trae)|de que (trata|se compone|consta))\b/,
  /\b(estructura|secciones|partes|indice|contenido|organizacion)\b.*\b(contrato|cct)\b/,
  /\b(contrato|cct)\b.*\b(estructura|secciones|partes|indice|contenido|organizacion)\b/,
  /\b(cuantas secciones|cuantas partes|como esta (dividido|organizado|estructurado))\b/,
  /\b(que secciones|que partes)\b/,
  // Preguntas cortas / follow-up que son claramente sobre el contrato
  /^de que trata\??$/,
  /^que (contiene|incluye|tiene|trae)\??$/,
  /^que es el (contrato|cct)\??$/,
  /^para que (sirve|es)\??$/,
];

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeNormalizedText(value: string) {
  return value
    .split(" ")
    .filter((token) => token.length >= 3 && !SPANISH_STOPWORDS.has(token));
}

export function tokenizeQuery(query: string) {
  const normalizedQuery = normalizeText(query);
  const baseTokens = tokenizeNormalizedText(normalizedQuery);
  const expandedTokens = baseTokens.flatMap((token) => [
    token,
    ...(QUERY_EXPANSIONS[token] || []),
  ]);
  return Array.from(new Set(expandedTokens));
}

export function countTokens(value: string) {
  return tokenizeNormalizedText(value).reduce<Record<string, number>>(
    (accumulator, token) => {
      accumulator[token] = (accumulator[token] || 0) + 1;
      return accumulator;
    },
    {},
  );
}

// ---------------------------------------------------------------------------
// Conversational detection
// ---------------------------------------------------------------------------

export function isConversationalPrompt(
  normalizedQuery: string,
  tokens: string[],
) {
  if (tokens.length === 0) return true;
  return CONVERSATIONAL_PATTERNS.some((p) => p.test(normalizedQuery));
}

// ---------------------------------------------------------------------------
// Structure query detection
// ---------------------------------------------------------------------------

export function isStructureQuery(normalizedQuery: string): boolean {
  return STRUCTURE_PATTERNS.some((p) => p.test(normalizedQuery));
}

export function buildStructureAnswer(): string {
  const lines = [
    "El Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027 se divide en **7 secciones**:",
    "",
    ...CONTRACT_SECTIONS.map(
      (s) =>
        `**${s.number}. ${s.title}** (p. ${s.startPage}–${s.endPage === 999 ? "fin" : s.endPage})\n${s.description}`,
    ),
    "",
    "Pregúntame sobre cualquier tema y te digo exactamente en qué sección y página encontrarlo.",
  ];
  return lines.join("\n");
}

export function buildConversationalAnswer() {
  return [
    "Soy tu asistente del contrato colectivo IMSS-SNTSS 2025-2027.",
    "",
    "Puedes preguntarme cosas como:",
    "- ¿Cuántos días de vacaciones me tocan con 5 años de antigüedad?",
    "- ¿Qué dice sobre permisos económicos?",
    "- ¿Cuáles son los requisitos para jubilación?",
    "- ¿Qué cláusula habla de guarderías?",
    "- ¿Qué prestamos de vivienda hay?",
    "- ¿Cómo está organizado el contrato?",
    "",
    "Pregunta lo que necesites — te respondo directo con las páginas exactas del contrato.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Query rewriting — local (no LLM)
// ---------------------------------------------------------------------------

export function rewriteQueryLocal(query: string): string {
  let result = query.toLowerCase();

  // Expand abbreviations
  for (const [abbr, expansion] of Object.entries(ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    result = result.replace(regex, expansion);
  }

  // Fix common typos
  for (const [typo, correction] of Object.entries(TYPO_CORRECTIONS)) {
    const regex = new RegExp(`\\b${typo}\\b`, "gi");
    result = result.replace(regex, correction);
  }

  return result;
}
