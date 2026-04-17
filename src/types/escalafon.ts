export interface EscalafonPreferencia {
  delegacionSolicitada: string;
  zonaSolicitada: string;
  localidadSolicitada: string;
  adscripcionCode: string;
  adscripcionDesc: string;
  turnoNum: number | null;
  turnoDesc: string;
}

export interface EscalafonAspirante {
  id?: string;
  listadoId: string;
  lugar: number;
  estatus: "Activo" | "PEI";
  matricula: string;
  nombre: string;
  delegacion: string;
  fechaRegistro: string;
  preferencias: EscalafonPreferencia[];
  posicionesPorZona?: Record<string, number>;
}

export interface EscalafonListado {
  id?: string;
  loteId?: string; // campo opcional para retrocompatibilidad
  delegacion: string;
  numeroListado: string;
  sector: string;
  fechaEmision: string;
  categoriaCode: string;
  categoriaDesc: string;
  areaCode: string;
  areaDesc: string;
  convocatoria: string;
  vigenciaInicio: string;
  vigenciaFin: string;
  periodoDecierre: string;
  totalAspirantes: number;
  aspirantesParsed: number;
  subidoPor: string;
  creadoEn: string;
  zonas: string[];
}

export interface EscalafonParseResult {
  listado: Omit<
    EscalafonListado,
    "id" | "subidoPor" | "creadoEn" | "aspirantesParsed" | "zonas" | "loteId"
  >;
  aspirantes: Omit<
    EscalafonAspirante,
    "id" | "listadoId" | "posicionesPorZona"
  >[];
  errores: string[];
}

// NUEVO
export interface EscalafonLote {
  id?: string;
  nombre: string;
  estado: "ABIERTO" | "CERRADO";
  totalListados: number;
  subidoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}
