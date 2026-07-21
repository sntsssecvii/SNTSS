import fs from "fs";
import path from "path";

import { searchContractSources } from "@/lib/contract-chat";
import type {
  ChatMessage,
  ContractRetrievalTrace,
  ContractRetrievalTraceItem,
} from "@/lib/contract-chat/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FailureCategory =
  | "contextualizacion-incorrecta"
  | "recuperacion-incorrecta"
  | "evidencia-incompleta"
  | "reranking-incorrecto"
  | "expansion-contexto-incorrecta"
  | "fragmentacion-documento"
  | "prompt-sintesis-final"
  | "pregunta-sin-informacion"
  | "respuesta-no-sustentada"
  | "fallo-infraestructura";

interface EvaluationCase {
  id: string;
  category: string;
  query: string;
  history?: ChatMessage[];
  /** Términos esperados en la evidencia recuperada */
  expectedTerms?: string[];
  /** "any" = al menos uno (default), "all" = todos deben aparecer */
  expectedTermsMode?: "any" | "all";
  /** Páginas esperadas en la evidencia top-8 */
  expectedPages?: number[];
  /** Cláusulas esperadas */
  expectedClauses?: number[];
  /** Se espera que la contextualización modifique la query */
  expectContext?: boolean;
  /** Se espera que el sistema marque evidencia insuficiente */
  expectInsufficient?: boolean;
  /** Descripción de la intención para el reporte */
  intent: string;
  /** Fuente esperada (descripción legible) */
  expectedSource: string;
}

interface EvaluationResult {
  id: string;
  category: string;
  query: string;
  intent: string;
  expectedSource: string;
  baseline: ModeResult;
  improved: ModeResult;
  passed: boolean;
  failureCategory?: FailureCategory;
  failureReason?: string;
}

interface ModeResult {
  latencyMs: number;
  contextualizedQuery: string;
  contextualizationMode: ContractRetrievalTrace["contextualizationMode"];
  retrievalQueries: string[];
  pages: number[];
  clauses: (number | undefined)[];
  topScore: number;
  sufficiency: ContractRetrievalTrace["sufficiency"] | undefined;
  candidates: ContractRetrievalTraceItem[];
  selected: ContractRetrievalTraceItem[];
  evidence: ContractRetrievalTraceItem[];
  termHit: boolean;
  pageHit: boolean;
  clauseHit: boolean;
  evidenceHit: boolean;
  contextPreserved: boolean;
  abstentionCorrect: boolean;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// 35 Evaluation Cases
// ---------------------------------------------------------------------------

const CASES: EvaluationCase[] = [
  // --- PREGUNTAS DIRECTAS ---
  {
    id: "directa-vacaciones",
    category: "consulta directa",
    query: "¿Cuántos días de vacaciones me corresponden?",
    expectedTerms: ["vacaciones"],
    expectedPages: [37, 38, 39],
    intent: "Conocer días de vacaciones según antigüedad",
    expectedSource: "Cláusula 47 - Vacaciones (p.37)",
  },
  {
    id: "directa-aguinaldo",
    category: "consulta directa",
    query: "¿Cuánto es el aguinaldo?",
    expectedTerms: ["aguinaldo"],
    intent: "Monto y fecha de pago de aguinaldo",
    expectedSource: "Cláusula 61 - Aguinaldo",
  },
  {
    id: "directa-prima-vacacional",
    category: "consulta directa",
    query: "¿Cuánto es la prima vacacional?",
    expectedTerms: ["prima vacacional", "vacaciones"],
    intent: "Porcentaje de prima vacacional",
    expectedSource: "Cláusula 59 - Prima vacacional",
  },
  {
    id: "directa-jornada-trabajo",
    category: "consulta directa",
    query: "¿Cuántas horas dura la jornada de trabajo?",
    expectedTerms: ["jornada", "horas"],
    intent: "Duración de jornada laboral por turno",
    expectedSource: "Cláusula 28/29 - Jornada de trabajo",
  },
  // --- MISMA INTENCIÓN DISTINTAS PALABRAS ---
  {
    id: "parafrasis-vacaciones",
    category: "misma intencion",
    query: "¿Cuántos días libres pagados tengo al año?",
    expectedTerms: ["vacaciones", "descanso"],
    intent: "Vacaciones con lenguaje coloquial",
    expectedSource: "Cláusula 58 - Vacaciones",
  },
  {
    id: "parafrasis-licencia-maternidad",
    category: "misma intencion",
    query: "¿Cuánto tiempo me dan si voy a tener un bebé?",
    expectedTerms: ["maternidad", "embarazo", "licencia"],
    intent: "Licencia de maternidad",
    expectedSource: "Cláusula sobre licencia de maternidad",
  },
  {
    id: "parafrasis-despido",
    category: "misma intencion",
    query: "¿Me pueden correr sin motivo?",
    expectedTerms: ["separación", "rescisión", "despido"],
    intent: "Causales de despido/rescisión",
    expectedSource: "Cláusulas sobre terminación de relación laboral",
  },
  // --- ERRORES ORTOGRÁFICOS ---
  {
    id: "typo-vacaciones",
    category: "error ortografico",
    query: "¿Cuántos días de vacasiones me dan?",
    expectedTerms: ["vacaciones"],
    intent: "Vacaciones con typo",
    expectedSource: "Cláusula 58 - Vacaciones",
  },
  {
    id: "typo-jubilacion",
    category: "error ortografico",
    query: "¿Cuando me puedo jubilar en el imss?",
    expectedTerms: ["jubilación", "pensiones", "antigüedad"],
    intent: "Jubilación con typo y minúsculas",
    expectedSource: "Régimen de jubilaciones y pensiones",
  },
  {
    id: "typo-escalafon",
    category: "error ortografico",
    query: "como funciona el escalafon para subir de puesto",
    expectedTerms: ["escalafón", "promoción"],
    intent: "Escalafón con falta de acentos",
    expectedSource: "Cláusulas de escalafón",
  },
  // --- PREGUNTAS COLOQUIALES ---
  {
    id: "coloquial-horas-extra",
    category: "pregunta coloquial",
    query: "¿Me tienen que pagar doble si me quedo más tiempo?",
    expectedTerms: ["tiempo extra", "horas extra"],
    intent: "Pago de horas extra",
    expectedSource: "Cláusula sobre tiempo extraordinario",
  },
  {
    id: "coloquial-permisos",
    category: "pregunta coloquial",
    query: "¿Puedo faltar sin que me descuenten?",
    expectedTerms: ["permiso", "económico", "licencia"],
    intent: "Permisos con goce de sueldo",
    expectedSource: "Cláusulas de permisos y licencias",
  },
  {
    id: "coloquial-uniforme",
    category: "pregunta coloquial",
    query: "¿Me tienen que dar uniformes o qué?",
    expectedTerms: ["uniforme", "vestuario", "ropa"],
    intent: "Dotación de uniformes",
    expectedSource: "Cláusula sobre vestuario y uniformes",
  },
  // --- PREGUNTAS DE SEGUIMIENTO (2 turnos) ---
  {
    id: "seguimiento-becas-extranjero",
    category: "seguimiento 2 turnos",
    query: "¿Puedo estudiar en el extranjero?",
    history: [
      { role: "user", content: "¿Qué tipo de becas existen?" },
      {
        role: "assistant",
        content:
          "Existen becas íntegras, parciales, con goce de salario, sin goce de salario y de reducción de jornada.",
      },
      {
        role: "user",
        content: "¿Qué tipo de becas puedo aplicar como profesionista?",
      },
      {
        role: "assistant",
        content:
          "Para seguir estudiando habría que revisar el Reglamento de Becas.",
      },
    ],
    expectedTerms: ["becas", "extranjero"],
    expectedPages: [279, 280, 281, 282, 283],
    expectContext: true,
    intent: "Estudios en el extranjero con beca del CCT",
    expectedSource: "Reglamento de Becas - artículos sobre estudios foráneos",
  },
  {
    id: "seguimiento-jubilacion-ley",
    category: "seguimiento 2 turnos",
    query: "¿Ley 73 o Ley 97?",
    history: [
      {
        role: "user",
        content: "¿Cuántos años de servicio necesito para jubilarme?",
      },
      {
        role: "assistant",
        content:
          "El requisito depende del régimen aplicable y de la antigüedad reconocida.",
      },
    ],
    expectedTerms: ["jubilación", "pensiones"],
    expectContext: true,
    intent:
      "Distinción entre regímenes de jubilación — el CCT sí tiene info de pensiones",
    expectedSource:
      "Régimen de jubilaciones y pensiones / Convenio Nuevo Ingreso",
  },
  {
    id: "seguimiento-permisos-aplicacion",
    category: "seguimiento 2 turnos",
    query: "¿Y eso cómo aplica en mi caso?",
    history: [
      { role: "user", content: "¿Qué son los permisos económicos?" },
      {
        role: "assistant",
        content: "Son ausencias autorizadas sujetas a las reglas del contrato.",
      },
    ],
    expectedTerms: ["permiso", "económico"],
    expectContext: true,
    intent: "Aplicación práctica de permisos económicos",
    expectedSource: "Cláusula de permisos económicos",
  },
  // --- CONVERSACIONES DE 3-4 TURNOS ---
  {
    id: "conv-4turnos-jubilacion",
    category: "conversacion 4 turnos",
    query: "¿Y si entré después del 2007?",
    history: [
      { role: "user", content: "Quiero entender mi jubilación." },
      {
        role: "assistant",
        content: "Necesitamos revisar tu régimen y fecha de ingreso.",
      },
      {
        role: "user",
        content: "¿Qué aplica para trabajadores de base de nuevo ingreso?",
      },
      {
        role: "assistant",
        content:
          "El CCT incluye un convenio adicional específico para nuevo ingreso.",
      },
    ],
    expectedTerms: ["nuevo ingreso", "jubilación", "pensiones"],
    expectedPages: [543, 544, 545, 546, 547, 548, 549, 550],
    expectContext: true,
    intent: "Régimen de nuevo ingreso post-2007",
    expectedSource: "Convenio adicional de nuevo ingreso (p. 543+)",
  },
  {
    id: "conv-3turnos-becas-requisitos",
    category: "conversacion 3 turnos",
    query: "¿Qué documentos necesito?",
    history: [
      { role: "user", content: "¿Hay becas para estudiar una maestría?" },
      {
        role: "assistant",
        content:
          "Sí, el Reglamento de Becas contempla becas íntegras y parciales para postgrado.",
      },
      { role: "user", content: "¿Cuáles son los requisitos?" },
      {
        role: "assistant",
        content:
          "Necesitas antigüedad mínima, solicitud y dictamen de la comisión.",
      },
    ],
    expectedTerms: ["beca", "solicitud", "documentos", "requisitos"],
    expectedPages: [279, 280, 281, 282, 283, 284],
    expectContext: true,
    intent: "Documentos para solicitud de beca",
    expectedSource: "Reglamento de Becas - requisitos de solicitud",
  },
  {
    id: "conv-3turnos-licencia-sindical",
    category: "conversacion 3 turnos",
    query: "¿Me siguen pagando?",
    history: [
      { role: "user", content: "¿Qué licencias sindicales existen?" },
      {
        role: "assistant",
        content:
          "Hay licencias para comisiones sindicales con goce y sin goce.",
      },
      { role: "user", content: "¿Cuánto duran las de con goce?" },
      {
        role: "assistant",
        content: "Depende del tipo de comisión y la cláusula específica.",
      },
    ],
    expectedTerms: ["licencia", "sindical", "goce"],
    expectContext: true,
    intent: "Si licencia sindical es con goce de sueldo",
    expectedSource: "Cláusulas sobre licencias sindicales",
  },
  // --- PREGUNTAS QUE REQUIEREN COMBINAR VARIOS FRAGMENTOS ---
  {
    id: "multifragmento-incapacidad",
    category: "multifragmento",
    query:
      "¿Qué cambia entre una incapacidad por enfermedad general y una por riesgo de trabajo?",
    expectedTerms: ["enfermedad", "riesgo", "incapacidad"],
    intent: "Diferencias entre tipos de incapacidad",
    expectedSource:
      "Cláusulas de incapacidad por enfermedad vs riesgo de trabajo",
  },
  {
    id: "multifragmento-prestaciones-especie",
    category: "multifragmento",
    query:
      "¿Qué prestaciones en especie me dan además del sueldo? Vales, uniformes, equipo...",
    expectedTerms: ["prestaciones", "vestuario", "equipo"],
    intent: "Listado de prestaciones en especie",
    expectedSource: "Múltiples cláusulas de prestaciones",
  },
  {
    id: "multifragmento-becas-tipos-requisitos",
    category: "multifragmento",
    query:
      "Quiero saber las clases de becas que hay, los requisitos y quién decide",
    expectedTerms: ["becas", "clases", "requisitos", "comisión"],
    expectedPages: [279, 280, 281, 282, 283],
    intent: "Visión completa del sistema de becas",
    expectedSource: "Reglamento de Becas - arts. clases, requisitos, comisión",
  },
  // --- PREGUNTAS AMBIGUAS ---
  {
    id: "ambigua-cuanto-gano",
    category: "ambigua",
    query: "¿Cuánto gano?",
    expectedTerms: ["sueldo", "tabulador", "salario"],
    intent: "Pregunta sin categoría/nivel especificado",
    expectedSource: "Tabulador de sueldos (requiere categoría)",
  },
  {
    id: "ambigua-puedo-faltar",
    category: "ambigua",
    query: "¿Puedo faltar mañana?",
    expectedTerms: ["permiso", "falta", "licencia"],
    intent: "Pregunta sin tipo de permiso ni justificación",
    expectedSource: "Cláusulas de permisos/licencias",
  },
  // --- SIN RESPUESTA EN EL CCT ---
  {
    id: "sin-respuesta-wifi",
    category: "sin respuesta en CCT",
    query: "¿Cuál es la contraseña del wifi de la cafetería?",
    expectInsufficient: true,
    intent: "Pregunta no relacionada al CCT",
    expectedSource: "Ninguna — fuera del alcance del contrato",
  },
  {
    id: "sin-respuesta-sat",
    category: "sin respuesta en CCT",
    query: "¿Cómo saco mi constancia de situación fiscal del SAT?",
    expectInsufficient: true,
    intent: "Trámite externo no cubierto por CCT",
    expectedSource: "Ninguna — tema del SAT",
  },
  {
    id: "sin-respuesta-clima",
    category: "sin respuesta en CCT",
    query: "¿Qué clima va a hacer mañana en Mexicali?",
    expectInsufficient: true,
    intent: "Pregunta completamente fuera de contexto",
    expectedSource: "Ninguna",
  },
  // --- BECAS ---
  {
    id: "becas-clases",
    category: "becas",
    query: "¿Qué clases de becas hay en el reglamento?",
    expectedTerms: ["becas", "íntegras", "parciales"],
    expectedPages: [279, 280, 281],
    intent: "Clasificación de becas del reglamento",
    expectedSource: "Reglamento de Becas - artículo de clases",
  },
  {
    id: "becas-goce-salario",
    category: "becas",
    query: "¿Las becas son con goce de salario o sin goce?",
    expectedTerms: ["goce", "salario", "beca"],
    expectedPages: [279, 280, 281, 282],
    intent: "Modalidad salarial de becas",
    expectedSource: "Reglamento de Becas - condiciones económicas",
  },
  // --- VACACIONES ---
  {
    id: "vacaciones-antiguedad",
    category: "vacaciones",
    query: "¿Cuántos días de vacaciones me tocan con 15 años de antigüedad?",
    expectedTerms: ["vacaciones", "antigüedad"],
    intent: "Días de vacaciones por antigüedad específica",
    expectedSource: "Cláusula 58 - tabla de vacaciones por antigüedad",
  },
  // --- JUBILACIÓN ---
  {
    id: "jubilacion-requisitos",
    category: "jubilacion",
    query: "¿Cuáles son los requisitos para jubilarme?",
    expectedTerms: ["jubilación", "antigüedad", "años"],
    intent: "Requisitos generales de jubilación",
    expectedSource: "Régimen de jubilaciones y pensiones",
  },
  // --- LICENCIAS ---
  {
    id: "licencias-defuncion",
    category: "licencias",
    query: "¿Me dan días si se muere un familiar?",
    expectedTerms: ["defunción", "licencia", "familiar", "permiso"],
    intent: "Licencia por defunción de familiar",
    expectedSource: "Cláusula de licencias por defunción",
  },
  // --- PRESTACIONES ---
  {
    id: "prestaciones-canastilla",
    category: "prestaciones",
    query: "¿Qué es la canastilla de maternidad?",
    expectedTerms: ["canastilla", "maternidad"],
    intent: "Prestación de canastilla de maternidad",
    expectedSource: "Cláusula de canastilla de maternidad",
  },
  // --- PROCEDIMIENTOS ---
  {
    id: "procedimiento-acoso",
    category: "procedimientos",
    query: "¿Qué dice el contrato sobre acoso laboral?",
    expectedTerms: ["acoso", "violencia"],
    expectedPages: [11, 12, 15, 85],
    intent: "Definición y protocolo de acoso laboral",
    expectedSource:
      "Cláusula 1 (definición) y transitoria 39a (protocolo bilateral, p.85)",
  },
  // --- CLÁUSULAS Y ARTÍCULOS CONCRETOS ---
  {
    id: "clausula-especifica-40",
    category: "clausula concreta",
    query: "¿Qué dice la cláusula 40?",
    expectedTerms: [],
    expectedClauses: [40],
    intent: "Contenido literal de cláusula específica",
    expectedSource:
      "Cláusula 40 del CCT (Faltas justificadas con posterioridad)",
  },
  {
    id: "clausula-especifica-100",
    category: "clausula concreta",
    query: "¿Qué establece la cláusula 100 del contrato?",
    expectedTerms: [],
    expectedClauses: [100],
    intent: "Contenido literal de cláusula 100",
    expectedSource: "Cláusula 100 del CCT (Viáticos)",
  },
  // --- METADATOS: CLÁUSULAS MULTI-CHUNK ---
  {
    id: "clausula-multi-chunk-42",
    category: "clausula multi-chunk",
    query: "¿Qué dice la cláusula 42 completa?",
    expectedTerms: ["sindical", "licencia", "permiso", "comisión"],
    expectedClauses: [42],
    intent: "Cláusula larga dividida en múltiples chunks (permisos sindicales)",
    expectedSource: "Cláusula 42 (permisos sindicales, multi-chunk, 7 chunks)",
  },
  // --- METADATOS: ARTÍCULO DE REGLAMENTO ---
  {
    id: "articulo-becas-5",
    category: "articulo reglamento",
    query: "¿Qué dice el artículo 5 del reglamento de becas?",
    expectedTerms: ["beca", "programa", "capacitación"],
    expectedPages: [278, 279, 280],
    intent: "Artículo específico del reglamento de becas",
    expectedSource: "Art. 5 del Reglamento de Becas (p.278)",
  },
  // --- METADATOS: TABLA / TABULADOR ---
  {
    id: "tabla-tabulador-sueldos",
    category: "tabla",
    query: "¿Cuánto gana un auxiliar de enfermería según el tabulador?",
    expectedTerms: ["enfermería", "sueldo"],
    expectedPages: [
      89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105,
      106, 107, 108, 109, 110,
    ],
    intent: "Sueldo de categoría específica del tabulador",
    expectedSource: "Tabulador de sueldos",
  },
  // --- METADATOS: CONTENIDO ADMINISTRATIVO NO DEBERÍA DOMINAR ---
  {
    id: "firmas-no-domina",
    category: "filtro firmas",
    query: "¿Qué es la reducción de jornada en el reglamento de becas?",
    expectedTerms: ["reducción", "jornada", "beca"],
    expectedPages: [279, 280, 281, 282, 283, 284],
    intent: "Contenido sustantivo, no firmas del reglamento",
    expectedSource: "Reglamento de Becas - contenido normativo",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function inspectEvidence(
  sources: Awaited<ReturnType<typeof searchContractSources>>["sources"],
  testCase: EvaluationCase,
) {
  const evidenceText = normalize(
    sources
      .slice(0, 8)
      .map((source) => source.chunk.text)
      .join(" "),
  );
  const termHit =
    !testCase.expectedTerms?.length ||
    (testCase.expectedTermsMode === "all"
      ? testCase.expectedTerms.every((term) =>
          evidenceText.includes(normalize(term)),
        )
      : testCase.expectedTerms.some((term) =>
          evidenceText.includes(normalize(term)),
        ));
  const pageHit =
    !testCase.expectedPages?.length ||
    sources
      .slice(0, 8)
      .some((source) =>
        testCase.expectedPages?.includes(source.chunk.pageNumber),
      );
  const clauseHit =
    !testCase.expectedClauses?.length ||
    sources
      .slice(0, 8)
      .some((source) =>
        testCase.expectedClauses?.includes(source.chunk.clauseNumber || 0),
      );
  return {
    termHit,
    pageHit,
    clauseHit,
    evidenceHit: termHit && pageHit && clauseHit,
  };
}

async function evaluateMode(
  testCase: EvaluationCase,
  contextualize: boolean,
): Promise<ModeResult> {
  const startedAt = Date.now();
  const result = await searchContractSources(
    testCase.query,
    testCase.history || [],
    { contextualize },
  );
  const evidence = inspectEvidence(result.sources, testCase);
  const trace = result.trace;
  const contextPreserved = testCase.expectContext
    ? Boolean(
        trace &&
        normalize(trace.contextualizedQuery) !== normalize(testCase.query) &&
        evidence.termHit,
      )
    : true;
  const abstentionCorrect = testCase.expectInsufficient
    ? trace?.sufficiency.status === "insufficient"
    : true;

  return {
    latencyMs: Date.now() - startedAt,
    contextualizedQuery: trace?.contextualizedQuery || testCase.query,
    contextualizationMode: trace?.contextualizationMode || "none",
    retrievalQueries: trace?.retrievalQueries || [testCase.query],
    pages: result.sources.slice(0, 8).map((source) => source.chunk.pageNumber),
    clauses: result.sources
      .slice(0, 8)
      .map((source) => source.chunk.clauseNumber),
    topScore: trace?.sufficiency.topScore || 0,
    sufficiency: trace?.sufficiency,
    candidates: trace?.candidates || [],
    selected: trace?.selected || [],
    evidence: trace?.evidence || [],
    ...evidence,
    contextPreserved,
    abstentionCorrect,
    passed: evidence.evidenceHit && contextPreserved && abstentionCorrect,
  };
}

function classifyFailure(
  testCase: EvaluationCase,
  result: ModeResult,
): { category: FailureCategory; reason: string } | null {
  if (result.passed) return null;

  // Contextualización
  if (testCase.expectContext && !result.contextPreserved) {
    return {
      category: "contextualizacion-incorrecta",
      reason: `Query contextualizada no preservó el tema: "${result.contextualizedQuery}"`,
    };
  }

  // Abstención incorrecta
  if (testCase.expectInsufficient && !result.abstentionCorrect) {
    return {
      category: "pregunta-sin-informacion",
      reason: `Se esperaba sufficiency=insufficient pero fue ${result.sufficiency?.status} (score: ${result.topScore.toFixed(3)})`,
    };
  }

  // Sin candidatos
  if (result.candidates.length === 0) {
    return {
      category: "fallo-infraestructura",
      reason: "Búsqueda no retornó candidatos",
    };
  }

  // Cláusula específica no encontrada
  if (testCase.expectedClauses?.length && !result.clauseHit) {
    const foundClauses = result.clauses.filter(Boolean);
    return {
      category: "recuperacion-incorrecta",
      reason: `Esperaba cláusula(s) ${testCase.expectedClauses.join(",")} pero encontró: ${foundClauses.join(",") || "ninguna"}`,
    };
  }

  // Página esperada no en top-8
  if (testCase.expectedPages?.length && !result.pageHit) {
    return {
      category: "recuperacion-incorrecta",
      reason: `Esperaba páginas ${testCase.expectedPages.join(",")} pero top-8 tiene: ${result.pages.join(",")}`,
    };
  }

  // Término esperado no encontrado
  if (testCase.expectedTerms?.length && !result.termHit) {
    return {
      category: "evidencia-incompleta",
      reason: `Términos esperados no encontrados en evidencia: ${testCase.expectedTerms.join(", ")}`,
    };
  }

  // Fallback genérico
  return {
    category: "recuperacion-incorrecta",
    reason: "La evidencia no cumplió todos los criterios esperados",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `\n=== Evaluación del Chat Contrato (${CASES.length} casos) ===\n`,
  );
  const results: EvaluationResult[] = [];

  for (const testCase of CASES) {
    process.stdout.write(`  [${testCase.id}] ...`);
    const baseline = await evaluateMode(testCase, false);
    const improved = await evaluateMode(testCase, true);
    const failure = classifyFailure(testCase, improved);

    results.push({
      id: testCase.id,
      category: testCase.category,
      query: testCase.query,
      intent: testCase.intent,
      expectedSource: testCase.expectedSource,
      baseline,
      improved,
      passed: improved.passed,
      failureCategory: failure?.category,
      failureReason: failure?.reason,
    });

    const status = improved.passed ? "OK" : "FALLA";
    const delta =
      !baseline.passed && improved.passed
        ? " [MEJORADO]"
        : baseline.passed && !improved.passed
          ? " [REGRESION]"
          : "";
    process.stdout.write(` ${status}${delta}\n`);
  }

  // --- Resumen ---
  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;
  const baselinePassed = results.filter((r) => r.baseline.passed).length;

  const byCategory = new Map<string, { total: number; passed: number }>();
  for (const r of results) {
    const entry = byCategory.get(r.category) || { total: 0, passed: 0 };
    entry.total++;
    if (r.passed) entry.passed++;
    byCategory.set(r.category, entry);
  }

  const failuresByType = new Map<FailureCategory, EvaluationResult[]>();
  for (const r of results) {
    if (r.failureCategory) {
      const list = failuresByType.get(r.failureCategory) || [];
      list.push(r);
      failuresByType.set(r.failureCategory, list);
    }
  }

  // --- Report console ---
  console.log("\n--- RESUMEN ---");
  console.log(
    `Total: ${CASES.length} | Pasaron: ${totalPassed} | Fallaron: ${totalFailed}`,
  );
  console.log(
    `Tasa de éxito: ${((totalPassed / CASES.length) * 100).toFixed(1)}%`,
  );
  console.log(
    `Baseline (sin contextualización): ${baselinePassed}/${CASES.length} (${((baselinePassed / CASES.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Con mejoras: ${totalPassed}/${CASES.length} (${((totalPassed / CASES.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Delta: ${totalPassed - baselinePassed > 0 ? "+" : ""}${totalPassed - baselinePassed} casos`,
  );

  console.log("\n--- TASA POR CATEGORÍA ---");
  console.table(
    Array.from(byCategory.entries()).map(([cat, data]) => ({
      categoria: cat,
      total: data.total,
      pasaron: data.passed,
      tasa: `${((data.passed / data.total) * 100).toFixed(0)}%`,
    })),
  );

  console.log("\n--- FALLOS POR TIPO ---");
  if (failuresByType.size === 0) {
    console.log("  Sin fallos.");
  } else {
    console.table(
      Array.from(failuresByType.entries()).map(([type, cases]) => ({
        tipo: type,
        cantidad: cases.length,
        casos: cases.map((c) => c.id).join(", "),
      })),
    );
  }

  console.log("\n--- TOP 5 FALLOS ---");
  const topFailures = results.filter((r) => !r.passed).slice(0, 5);
  for (const f of topFailures) {
    console.log(`  ${f.id} [${f.failureCategory}]`);
    console.log(`    Query: ${f.query}`);
    console.log(`    Contextualizada: ${f.improved.contextualizedQuery}`);
    console.log(`    Score: ${f.improved.topScore.toFixed(3)}`);
    console.log(`    Páginas: ${f.improved.pages.join(", ")}`);
    console.log(`    Razón: ${f.failureReason}`);
    console.log("");
  }

  // --- Análisis de rerankEvidenceByQuestionIntent ---
  const rerankCases = results.filter((r) =>
    r.improved.selected.some((s) => s.matchedTerms.includes("intent-rerank")),
  );
  console.log("\n--- ANÁLISIS DE rerankEvidenceByQuestionIntent ---");
  console.log(
    `Casos donde intervino el reranking por intent: ${rerankCases.length}/${results.length}`,
  );
  if (rerankCases.length > 0) {
    const rerankHelped = rerankCases.filter(
      (r) => !r.baseline.passed && r.passed,
    );
    const rerankNeutral = rerankCases.filter(
      (r) => r.baseline.passed && r.passed,
    );
    const rerankHurt = rerankCases.filter(
      (r) => r.baseline.passed && !r.passed,
    );
    console.log(
      `  Ayudó: ${rerankHelped.length} | Neutral: ${rerankNeutral.length} | Perjudicó: ${rerankHurt.length}`,
    );
    for (const r of rerankCases) {
      const boosted = r.improved.selected
        .filter((s) => s.matchedTerms.includes("intent-rerank"))
        .map((s) => `p.${s.pageNumber} (${s.score.toFixed(3)})`);
      console.log(
        `  ${r.id}: boosted=[${boosted.join(", ")}] → ${r.passed ? "OK" : "FALLA"}`,
      );
    }
  }

  // --- JSON report ---
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalCases: CASES.length,
      baselinePassed,
      improvedPassed: totalPassed,
      delta: totalPassed - baselinePassed,
      successRate: Number(((totalPassed / CASES.length) * 100).toFixed(1)),
      baselineRate: Number(((baselinePassed / CASES.length) * 100).toFixed(1)),
    },
    byCategory: Object.fromEntries(
      Array.from(byCategory.entries()).map(([cat, data]) => [
        cat,
        {
          ...data,
          rate: Number(((data.passed / data.total) * 100).toFixed(1)),
        },
      ]),
    ),
    failuresByType: Object.fromEntries(
      Array.from(failuresByType.entries()).map(([type, cases]) => [
        type,
        cases.map((c) => ({ id: c.id, reason: c.failureReason })),
      ]),
    ),
    rerankAnalysis: {
      casesAffected: rerankCases.length,
      helped: rerankCases.filter((r) => !r.baseline.passed && r.passed).length,
      neutral: rerankCases.filter((r) => r.baseline.passed && r.passed).length,
      hurt: rerankCases.filter((r) => r.baseline.passed && !r.passed).length,
    },
    results: results.map((r) => ({
      id: r.id,
      category: r.category,
      query: r.query,
      intent: r.intent,
      expectedSource: r.expectedSource,
      contextualizedQuery: r.improved.contextualizedQuery,
      contextualizationMode: r.improved.contextualizationMode,
      pages: r.improved.pages,
      clauses: r.improved.clauses.filter(Boolean),
      topScore: r.improved.topScore,
      sufficiency: r.improved.sufficiency?.status,
      baselinePassed: r.baseline.passed,
      passed: r.passed,
      failureCategory: r.failureCategory || null,
      failureReason: r.failureReason || null,
      latencyMs: r.improved.latencyMs,
    })),
  };

  const outputPath = path.join(
    process.cwd(),
    "artifacts",
    "contract-chat-evaluation.json",
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nReporte completo: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
