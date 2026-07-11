export interface CambiosRegistro {
  id?: string;
  listadoId: string;
  fechaRegistro: string; // DD/MM/YYYY
  horaRegistro: string; // HH:MM:SS
  noSolicitud: string; // E260200066
  matricula: string;
  nombre: string; // APELLIDO1/APELLIDO2/NOMBRE
  adscripcionOrigen: string;
  percibeConcepto: string; // "SI" | "NO" | ""
  zona: string; // "1-ENSENADA" | "2-MEXICALLI" | ...
  adscripcionSolicitada: string;
  especialidadArea: number; // 185, 248, etc.
  tipo: string; // "TURNO" | "ADSCRIPCIÓN"
  turnoSolicitado: string; // "MATUTINO" | "VESPERTINO" | "NOCTURNO" | "INCONDICIONAL"
  conConceptos: string; // "SI" | "NO"
}

export interface CambiosListado {
  id?: string;
  loteId?: string;
  delegacion: string; // "02-BAJA CALIFORNIA"
  sectorCode: string; // "02"
  sectorDesc: string; // "FARMACIA"
  categoriaCode: string; // "22230080"
  categoriaDesc: string; // "AYUDANTE DE FARMACIA 80"
  area: number; // especialidad/área del listado (216, 232, 248...). Distingue
  // especialidades que comparten categoriaCode (p.ej. ENF. ESP. QUIRÚRGICA vs
  // PEDIATRÍA). 0 si no se pudo determinar.
  concepto: string; // "" | "014" | "054"
  fechaEmision: string; // "29/05/2026"
  totalRegistros: number;
  registrosParsed: number;
  subidoPor: string;
  creadoEn: string;
}

export interface CambiosParseResult {
  listado: Omit<
    CambiosListado,
    "id" | "subidoPor" | "creadoEn" | "registrosParsed" | "loteId"
  >;
  registros: Omit<CambiosRegistro, "id" | "listadoId">[];
  errores: string[];
}

export interface CambiosLote {
  id?: string;
  nombre: string;
  estado: "ABIERTO" | "CERRADO";
  totalListados: number;
  subidoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CambiosPosicionResult {
  listadoId: string;
  categoriaCode: string;
  categoriaDesc: string;
  concepto: string;
  fechaEmision: string;
  tipo: string;
  zona: string;
  adscripcionSolicitada: string;
  turnoSolicitado: string;
  lugar: number;
  totalEnGrupo: number;
  grupoUnidad: string;
  grupoTurno: string;
}
