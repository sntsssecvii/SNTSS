export interface EscalafonPreferencia {
  delegacionSolicitada: string; // ej. "02 BAJA CALIFORNIA" o "Incondicional"
  zonaSolicitada: string; // ej. "7 TIJUANA" o "Incondicional"
  localidadSolicitada: string; // ej. "0205321 RIO TIJUANA" o "Incondicional"
  adscripcionCode: string; // ej. "02HA230000" o "Incondicional"
  adscripcionDesc: string; // ej. "HOSPITAL GENERAL REGIONAL 23" o "Incondicional"
  turnoNum: number | null; // ej. 1, 2, 3, null si Incondicional
  turnoDesc: string; // ej. "Matutino" o "Incondicional"
}

export interface EscalafonAspirante {
  id?: string;
  listadoId: string;
  lugar: number; // LUG. ESC.
  estatus: "Activo" | "PEI";
  matricula: string;
  nombre: string;
  delegacion: string; // DEL (ej. "02")
  fechaRegistro: string; // DD/MM/YYYY
  preferencias: EscalafonPreferencia[];
}

export interface EscalafonListado {
  id?: string;
  delegacion: string; // ej. "02 BAJA CALIFORNIA"
  numeroListado: string; // ej. "2026-1"
  sector: string; // ej. "01 ENFERMERIA"
  fechaEmision: string; // DD/MM/YYYY
  categoriaCode: string; // ej. "22210080"
  categoriaDesc: string; // ej. "ENFERMERA ESPECIALISTA 80"
  areaCode: string; // ej. "216"
  areaDesc: string; // ej. "QUIRURGICA"
  convocatoria: string; // ej. "E/16/2025"
  vigenciaInicio: string; // DD/MM/YYYY
  vigenciaFin: string; // DD/MM/YYYY
  periodoDecierre: string; // ej. "2026003" — usado como ID de quincena
  totalAspirantes: number; // del header del PDF
  aspirantesParsed: number; // los que se extrajeron efectivamente
  subidoPor: string; // uid del usuario
  creadoEn: string; // ISO string
}

export interface EscalafonParseResult {
  listado: Omit<
    EscalafonListado,
    "id" | "subidoPor" | "creadoEn" | "aspirantesParsed"
  >;
  aspirantes: Omit<EscalafonAspirante, "id" | "listadoId">[];
  errores: string[];
}
