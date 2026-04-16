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
  posicionesPorZona?: Record<string, number>; // calculado por position-engine al subir
}

export interface EscalafonListado {
  id?: string;
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
  zonas: string[]; // todas las zonas únicas del listado, calculado al subir
}

export interface EscalafonParseResult {
  listado: Omit<
    EscalafonListado,
    "id" | "subidoPor" | "creadoEn" | "aspirantesParsed" | "zonas"
  >;
  aspirantes: Omit<
    EscalafonAspirante,
    "id" | "listadoId" | "posicionesPorZona"
  >[];
  errores: string[];
}
