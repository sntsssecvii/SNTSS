/**
 * Evaluation suite for contract chat RESPONSE quality.
 * Separate from retrieval evaluation — measures final answer correctness.
 *
 * Usage: npx tsx scripts/tests/evaluate-contract-responses.ts
 */
import fs from "fs";
import path from "path";

import { answerContractQuestion } from "@/lib/contract-chat";
import type {
  ChatMessage,
  ContractChatAnswer,
} from "@/lib/contract-chat/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResponseCase {
  id: string;
  category: string;
  query: string;
  history?: ChatMessage[];
  /** Known facts the user provides in the query */
  userFacts?: string[];
  /** Facts needed to give a complete answer that the user didn't provide */
  missingFacts?: string[];
  /** What evidence the retrieval should find */
  expectedEvidence?: string[];
  /** Claims the response MUST contain (substring or semantic) */
  requiredClaims?: string[];
  /** Claims the response MUST NOT contain */
  forbiddenClaims?: string[];
  /** The response should ask for these missing data points */
  expectedClarifyingQuestions?: string[];
  /** Expected page/clause citations */
  expectedCitations?: string[];
  /** Should the system abstain from answering? */
  expectAbstention?: boolean;
  /** Notes for manual review */
  notes?: string;
  /** Is this a holdout case? (not used for tuning) */
  holdout?: boolean;
}

interface ResponseEvaluation {
  id: string;
  category: string;
  query: string;
  // Raw output
  answer: string;
  answerMode: string;
  sourceCount: number;
  latencyMs: number;
  // Structured evaluation
  scores: {
    factualAccuracy: number; // 0-1: claims backed by evidence
    completeness: number; // 0-1: required claims present
    evidenceUsage: number; // 0-1: uses provided sources
    clarifyingQuestions: number; // 0-1: asks for missing data when needed
    abstention: number; // 0-1: correctly abstains or doesn't
    noHallucination: number; // 0-1: no forbidden claims
    citationAccuracy: number; // 0-1: cites correct pages/clauses
    clarity: number; // 0-1: concise, direct, in Spanish
  };
  overallScore: number;
  passed: boolean;
  // Details
  foundClaims: string[];
  missingClaims: string[];
  forbiddenFound: string[];
  citationsFound: string[];
  askedForData: boolean;
  abstained: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// 30 Response Evaluation Cases
// ---------------------------------------------------------------------------

const CASES: ResponseCase[] = [
  // === PRESTACIONES DIRECTAS ===
  {
    id: "resp-aguinaldo",
    category: "prestaciones directas",
    query: "¿Cuánto es el aguinaldo?",
    requiredClaims: ["aguinaldo"],
    expectedCitations: ["p."],
    notes: "Debe mencionar montos o referencia al tabulador",
  },
  {
    id: "resp-prima-vacacional",
    category: "prestaciones directas",
    query: "¿Cuánto es la prima vacacional?",
    requiredClaims: ["prima vacacional", "25"],
    expectedCitations: ["p."],
  },
  {
    id: "resp-canastilla",
    category: "prestaciones directas",
    query: "¿Qué incluye la canastilla de maternidad?",
    requiredClaims: ["canastilla", "maternidad"],
    expectedCitations: ["p."],
  },
  // === VACACIONES POR ANTIGÜEDAD ===
  {
    id: "resp-vacaciones-5-anos",
    category: "vacaciones por antiguedad",
    query: "Tengo 5 años de antigüedad, ¿cuántos días de vacaciones me tocan?",
    userFacts: ["5 años de antigüedad"],
    requiredClaims: ["vacaciones", "días"],
    expectedCitations: ["p."],
    notes: "Debe dar número concreto de días para 5 años",
  },
  {
    id: "resp-vacaciones-sin-antiguedad",
    category: "vacaciones por antiguedad",
    query: "¿Cuántos días de vacaciones me tocan?",
    missingFacts: ["antigüedad"],
    requiredClaims: ["vacaciones"],
    expectedClarifyingQuestions: ["antigüedad"],
    notes: "Sin antigüedad, debe pedir el dato o mostrar tabla completa",
  },
  // === PERMISOS Y FALTAS ===
  {
    id: "resp-permisos-economicos",
    category: "permisos y faltas",
    query: "¿Cuántos permisos económicos me dan al año?",
    requiredClaims: ["permiso", "económico"],
    expectedCitations: ["p."],
  },
  {
    id: "resp-faltar-sin-descuento",
    category: "permisos y faltas",
    query: "¿Puedo faltar sin que me descuenten?",
    requiredClaims: ["permiso", "falta"],
    notes: "Debe mencionar condiciones (justificación, permisos económicos)",
  },
  {
    id: "resp-licencia-defuncion",
    category: "permisos y faltas",
    query: "Se murió mi papá, ¿me dan días?",
    userFacts: ["fallecimiento de padre"],
    requiredClaims: ["defunción", "licencia"],
    expectedCitations: ["p."],
    notes: "Debe mencionar días y condiciones de licencia por defunción",
  },
  // === SUELDO Y TABULADORES ===
  {
    id: "resp-cuanto-gano",
    category: "sueldo y tabuladores",
    query: "¿Cuánto gano?",
    missingFacts: ["categoría", "nivel"],
    expectedClarifyingQuestions: ["categoría"],
    forbiddenClaims: ["ganas $"],
    notes: "Sin categoría no puede dar monto exacto, debe pedir ese dato",
  },
  {
    id: "resp-sueldo-enfermera",
    category: "sueldo y tabuladores",
    query: "¿Cuánto gana una enfermera general?",
    userFacts: ["categoría: enfermera general"],
    requiredClaims: ["sueldo", "tabular"],
    notes: "Debe dar cifra del tabulador o indicar dónde buscarla",
  },
  // === JUBILACIONES ===
  {
    id: "resp-jubilacion-requisitos",
    category: "jubilaciones",
    query: "¿Cuántos años necesito para jubilarme?",
    missingFacts: ["fecha de ingreso", "régimen"],
    requiredClaims: ["jubilación", "años", "antigüedad"],
    expectedCitations: ["p."],
    notes: "Debe distinguir entre regímenes o pedir fecha de ingreso",
  },
  {
    id: "resp-jubilacion-nuevo-ingreso",
    category: "jubilaciones",
    query: "Entré al IMSS en 2010, ¿cómo es mi jubilación?",
    userFacts: ["ingresó en 2010"],
    requiredClaims: ["nuevo ingreso"],
    expectedCitations: ["p. 54"],
    notes: "Debe referir al convenio de nuevo ingreso (p.543+)",
  },
  // === BECAS ===
  {
    id: "resp-becas-tipos",
    category: "becas",
    query: "¿Qué tipos de becas hay?",
    requiredClaims: ["beca"],
    expectedCitations: ["p."],
    notes: "Debe listar tipos: íntegras, parciales, con/sin goce, reducción",
  },
  {
    id: "resp-becas-requisitos",
    category: "becas",
    query: "¿Cuáles son los requisitos para una beca?",
    requiredClaims: ["requisito", "beca"],
    expectedCitations: ["p."],
  },
  {
    id: "resp-becas-extranjero",
    category: "becas",
    query: "¿Puedo estudiar en el extranjero con beca del IMSS?",
    requiredClaims: ["beca"],
    expectedCitations: ["p."],
    notes: "Debe indicar si el reglamento menciona estudios en el extranjero",
  },
  // === PROCEDIMIENTOS ===
  {
    id: "resp-acoso-laboral",
    category: "procedimientos",
    query: "¿Qué hago si me acosan en el trabajo?",
    requiredClaims: ["acoso", "protocolo"],
    expectedCitations: ["p."],
    notes: "Debe mencionar la transitoria 39a o la definición en cláusula 1",
  },
  {
    id: "resp-escalafon-subir",
    category: "procedimientos",
    query: "¿Cómo subo de puesto por escalafón?",
    requiredClaims: ["escalafón", "promoción"],
    expectedCitations: ["p."],
  },
  // === ARTÍCULOS Y CLÁUSULAS ESPECÍFICAS ===
  {
    id: "resp-clausula-40",
    category: "clausulas especificas",
    query: "¿Qué dice la cláusula 40?",
    requiredClaims: ["cláusula 40", "falta"],
    expectedCitations: ["p."],
    notes: "Cláusula 40 = Faltas justificadas con posterioridad",
  },
  {
    id: "resp-clausula-100",
    category: "clausulas especificas",
    query: "¿Qué establece la cláusula 100?",
    requiredClaims: ["viáticos"],
    expectedCitations: ["p."],
  },
  // === PREGUNTAS AMBIGUAS ===
  {
    id: "resp-ambigua-aplica",
    category: "ambiguas",
    query: "¿Eso aplica para mí?",
    history: [
      { role: "user", content: "¿Cuántos días de vacaciones me dan?" },
      {
        role: "assistant",
        content:
          "Depende de tu antigüedad. Con 1-5 años son 20 días, con 5-10 son 22.",
      },
    ],
    missingFacts: ["antigüedad exacta"],
    expectedClarifyingQuestions: ["antigüedad"],
    notes: "Debe pedir antigüedad para dar respuesta personalizada",
  },
  {
    id: "resp-ambigua-y-si",
    category: "ambiguas",
    query: "¿Y si ya tengo más de 28 años?",
    history: [
      { role: "user", content: "¿Cuántos años para jubilarme?" },
      {
        role: "assistant",
        content:
          "El régimen indica 28 años de servicio para jubilación ordinaria.",
      },
    ],
    userFacts: ["más de 28 años de servicio"],
    requiredClaims: ["jubil"],
    notes: "Debe confirmar que cumple requisito y orientar sobre el trámite",
  },
  // === PREGUNTAS MULTI-TURNO ===
  {
    id: "resp-multi-becas-docs",
    category: "multi-turno",
    query: "¿Qué documentos necesito?",
    history: [
      { role: "user", content: "¿Hay becas para maestría?" },
      {
        role: "assistant",
        content: "Sí, el Reglamento de Becas contempla becas para postgrado.",
      },
      { role: "user", content: "¿Cuáles son los requisitos?" },
      {
        role: "assistant",
        content:
          "Antigüedad mínima, solicitud formal y dictamen de la comisión.",
      },
    ],
    requiredClaims: ["beca", "solicitud"],
    notes: "Debe entender que pregunta por documentos para beca de maestría",
  },
  {
    id: "resp-multi-jubilacion-ley",
    category: "multi-turno",
    query: "¿Cuál me conviene más?",
    history: [
      { role: "user", content: "¿Cuántos años para jubilarme?" },
      {
        role: "assistant",
        content: "Hay distintos regímenes según tu fecha de ingreso.",
      },
      { role: "user", content: "Entré en 1998." },
      {
        role: "assistant",
        content:
          "Con ingreso antes de 2008 aplica el régimen original del CCT.",
      },
    ],
    userFacts: ["ingresó en 1998"],
    requiredClaims: ["jubil"],
    notes: "Debe orientar sobre el régimen que le aplica",
  },
  // === COMBINAR VARIAS FUENTES ===
  {
    id: "resp-combinar-incapacidad",
    category: "combinar fuentes",
    query:
      "¿Qué diferencia hay entre incapacidad por enfermedad y por riesgo de trabajo?",
    requiredClaims: ["enfermedad", "riesgo"],
    expectedCitations: ["p."],
    notes: "Debe comparar ambos tipos con datos concretos",
  },
  {
    id: "resp-combinar-prestaciones",
    category: "combinar fuentes",
    query: "Además del sueldo, ¿qué otras prestaciones tengo?",
    requiredClaims: ["prestacion"],
    notes: "Debe listar varias prestaciones del CCT",
  },
  // === FUERA DEL ALCANCE ===
  {
    id: "resp-fuera-sat",
    category: "fuera del alcance",
    query: "¿Cómo saco mi constancia de situación fiscal?",
    expectAbstention: true,
    forbiddenClaims: ["cláusula", "artículo", "contrato establece"],
    notes: "Es trámite del SAT, no del CCT",
  },
  {
    id: "resp-fuera-clima",
    category: "fuera del alcance",
    query: "¿Va a llover mañana?",
    expectAbstention: true,
    forbiddenClaims: ["cláusula", "artículo"],
  },
  // === DOCUMENTO INCOMPLETO ===
  {
    id: "resp-protocolo-incompleto",
    category: "documento incompleto",
    query: "¿Cuál es el procedimiento completo para denunciar acoso?",
    requiredClaims: ["acoso", "protocolo"],
    notes:
      "El CCT solo dice que se creará un protocolo (transitoria 39a), no lo detalla. Debe indicarlo.",
    holdout: true,
  },
  {
    id: "resp-tramite-jubilacion-pasos",
    category: "documento incompleto",
    query: "¿Cuáles son los pasos exactos para tramitar mi jubilación?",
    requiredClaims: ["jubilación"],
    notes:
      "El CCT define requisitos pero no un procedimiento paso a paso. Debe indicar lo que sí dice.",
    holdout: true,
  },
  // === HOLDOUT CASES (not used for tuning) ===
  {
    id: "hold-guarderia-horario",
    category: "prestaciones directas",
    query: "¿Cuál es el horario de la guardería?",
    requiredClaims: ["guardería", "horario"],
    holdout: true,
  },
  {
    id: "hold-ropa-trabajo",
    category: "prestaciones directas",
    query: "¿Cada cuánto me dan uniformes?",
    requiredClaims: ["uniforme", "ropa"],
    holdout: true,
  },
  {
    id: "hold-fondo-retiro",
    category: "jubilaciones",
    query: "¿Qué es el fondo de retiro?",
    requiredClaims: ["fondo", "retiro"],
    holdout: true,
  },
  {
    id: "hold-permuta",
    category: "procedimientos",
    query: "¿Puedo hacer permuta con un compañero de otra delegación?",
    requiredClaims: ["permuta"],
    holdout: true,
  },
  {
    id: "hold-tiempo-extra",
    category: "sueldo y tabuladores",
    query: "¿Cuánto me pagan las horas extras?",
    requiredClaims: ["extra", "doble"],
    holdout: true,
  },
  {
    id: "hold-dias-descanso",
    category: "permisos y faltas",
    query: "¿Cuáles son los días de descanso obligatorio?",
    requiredClaims: ["descanso", "obligatorio"],
    holdout: true,
  },
  {
    id: "hold-prestamo-vivienda",
    category: "prestaciones directas",
    query: "¿Cómo solicito un préstamo para vivienda?",
    requiredClaims: ["préstamo", "vivienda"],
    holdout: true,
  },
  {
    id: "hold-multi-seguimiento",
    category: "multi-turno",
    query: "¿Y cuánto me toca de prima?",
    history: [
      { role: "user", content: "Tengo 10 años, ¿cuántos días de vacaciones?" },
      {
        role: "assistant",
        content: "Con 10 años te corresponden 22 días de vacaciones.",
      },
    ],
    requiredClaims: ["prima vacacional"],
    holdout: true,
  },
];

// ---------------------------------------------------------------------------
// Deterministic evaluator
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function evaluateResponse(
  testCase: ResponseCase,
  result: ContractChatAnswer,
  latencyMs: number,
): ResponseEvaluation {
  const answer = result.answer;
  const normalizedAnswer = normalize(answer);
  const errors: string[] = [];

  // --- Required claims ---
  const foundClaims: string[] = [];
  const missingClaims: string[] = [];
  if (testCase.requiredClaims) {
    for (const claim of testCase.requiredClaims) {
      if (normalizedAnswer.includes(normalize(claim))) {
        foundClaims.push(claim);
      } else {
        missingClaims.push(claim);
      }
    }
  }
  const completeness =
    testCase.requiredClaims && testCase.requiredClaims.length > 0
      ? foundClaims.length / testCase.requiredClaims.length
      : 1;

  // --- Forbidden claims ---
  const forbiddenFound: string[] = [];
  if (testCase.forbiddenClaims) {
    for (const claim of testCase.forbiddenClaims) {
      if (normalizedAnswer.includes(normalize(claim))) {
        forbiddenFound.push(claim);
      }
    }
  }
  const noHallucination =
    testCase.forbiddenClaims && testCase.forbiddenClaims.length > 0
      ? 1 - forbiddenFound.length / testCase.forbiddenClaims.length
      : 1;

  // --- Citations ---
  const citationsFound: string[] = [];
  const citationPattern =
    /p[áa]gina[s]?\s*(?:de\s+referencia)?[:\s]*p?\.?\s*\d+|p\.\s*\d+/gi;
  const matches = answer.match(citationPattern) || [];
  citationsFound.push(...matches);
  const citationAccuracy =
    testCase.expectedCitations && testCase.expectedCitations.length > 0
      ? testCase.expectedCitations.some((c) =>
          normalizedAnswer.includes(normalize(c)),
        )
        ? 1
        : 0
      : citationsFound.length > 0
        ? 1
        : 0.5;

  // --- Clarifying questions ---
  const askedForData = testCase.expectedClarifyingQuestions
    ? testCase.expectedClarifyingQuestions.some((q) =>
        normalizedAnswer.includes(normalize(q)),
      )
    : false;
  const clarifyingQuestions =
    testCase.expectedClarifyingQuestions &&
    testCase.expectedClarifyingQuestions.length > 0
      ? askedForData
        ? 1
        : 0
      : 1;

  // --- Abstention ---
  const abstentionIndicators = [
    "no esta en el contrato",
    "no es algo que cubra el contrato",
    "fuera del alcance",
    "no encuentro informacion",
    "no tengo informacion sobre eso",
    "no es un tema del contrato",
    "no puedo ayudarte con eso",
    "estoy para consultas del contrato",
    "recuerdale amablemente",
  ];
  const abstained =
    abstentionIndicators.some((ind) =>
      normalizedAnswer.includes(normalize(ind)),
    ) || result.sourceCount === 0;
  const abstentionScore = testCase.expectAbstention
    ? abstained
      ? 1
      : 0
    : !abstained
      ? 1
      : 0.5;

  // --- Evidence usage ---
  const evidenceUsage =
    result.sourceCount > 0 && !testCase.expectAbstention
      ? 1
      : testCase.expectAbstention
        ? 1
        : 0;

  // --- Factual accuracy (simplified: if uses Groq + has sources = likely grounded) ---
  const factualAccuracy =
    result.answerMode === "groq" && result.sourceCount > 0
      ? noHallucination
      : result.answerMode === "extractive"
        ? 0.8
        : 0.5;

  // --- Clarity (heuristic: length, no lawyer phrases, Spanish) ---
  const lawyerPhrases = [
    "cabe mencionar",
    "es importante señalar",
    "en relación a lo anterior",
    "resulta pertinente",
  ];
  const hasLawyerPhrase = lawyerPhrases.some((p) =>
    normalizedAnswer.includes(normalize(p)),
  );
  const tooLong = answer.length > 2000;
  const clarity = hasLawyerPhrase ? 0.5 : tooLong ? 0.7 : 1;

  // --- Overall ---
  const scores = {
    factualAccuracy,
    completeness,
    evidenceUsage,
    clarifyingQuestions,
    abstention: abstentionScore,
    noHallucination,
    citationAccuracy,
    clarity,
  };
  const weights = {
    factualAccuracy: 0.2,
    completeness: 0.2,
    evidenceUsage: 0.1,
    clarifyingQuestions: 0.1,
    abstention: 0.15,
    noHallucination: 0.1,
    citationAccuracy: 0.1,
    clarity: 0.05,
  };
  const overallScore = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + scores[key as keyof typeof scores] * weight,
    0,
  );
  const passed =
    overallScore >= 0.7 && noHallucination >= 0.5 && completeness >= 0.5;

  return {
    id: testCase.id,
    category: testCase.category,
    query: testCase.query,
    answer,
    answerMode: result.answerMode,
    sourceCount: result.sourceCount,
    latencyMs,
    scores,
    overallScore,
    passed,
    foundClaims,
    missingClaims,
    forbiddenFound,
    citationsFound,
    askedForData,
    abstained,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const BASE_THROTTLE_MS = Number(process.env.EVAL_THROTTLE_MS) || 35_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`\n=== Evaluación de Respuestas (${CASES.length} casos) ===`);
  console.log(
    `Throttle base: ${BASE_THROTTLE_MS}ms (backoff exponencial en 429)\n`,
  );

  const results: ResponseEvaluation[] = [];
  const holdoutResults: ResponseEvaluation[] = [];
  let consecutiveRateLimits = 0;

  for (let ci = 0; ci < CASES.length; ci++) {
    const testCase = CASES[ci];
    if (ci > 0) {
      // Exponential backoff: base * 2^consecutive429s, capped at 120s
      const backoff = Math.min(
        BASE_THROTTLE_MS * Math.pow(2, consecutiveRateLimits),
        120_000,
      );
      await sleep(backoff);
    }
    process.stdout.write(`  [${ci + 1}/${CASES.length}] ${testCase.id} ...`);
    const start = Date.now();

    try {
      const result = await answerContractQuestion(
        testCase.query,
        testCase.history || [],
      );
      const latency = Date.now() - start;
      const evaluation = evaluateResponse(testCase, result, latency);

      if (testCase.holdout) {
        holdoutResults.push(evaluation);
      } else {
        results.push(evaluation);
      }

      // Track rate limits for backoff
      if (result.answerMode === "extractive" && result.sourceCount > 0) {
        consecutiveRateLimits++;
      } else {
        consecutiveRateLimits = 0;
      }

      const mode = result.answerMode === "groq" ? "LLM" : "ext";
      const status = evaluation.passed ? "OK" : "FALLA";
      process.stdout.write(
        ` ${status} (${evaluation.overallScore.toFixed(2)}) [${mode}] ${latency}ms\n`,
      );
    } catch (error) {
      const latency = Date.now() - start;
      const evaluation: ResponseEvaluation = {
        id: testCase.id,
        category: testCase.category,
        query: testCase.query,
        answer: "",
        answerMode: "error",
        sourceCount: 0,
        latencyMs: latency,
        scores: {
          factualAccuracy: 0,
          completeness: 0,
          evidenceUsage: 0,
          clarifyingQuestions: 0,
          abstention: 0,
          noHallucination: 1,
          citationAccuracy: 0,
          clarity: 0,
        },
        overallScore: 0,
        passed: false,
        foundClaims: [],
        missingClaims: testCase.requiredClaims || [],
        forbiddenFound: [],
        citationsFound: [],
        askedForData: false,
        abstained: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
      if (testCase.holdout) holdoutResults.push(evaluation);
      else results.push(evaluation);
      process.stdout.write(` ERROR ${latency}ms\n`);
    }
  }

  // --- Summary ---
  const mainPassed = results.filter((r) => r.passed).length;
  const holdoutPassed = holdoutResults.filter((r) => r.passed).length;

  console.log("\n--- RESUMEN (casos principales) ---");
  console.log(
    `Total: ${results.length} | Pasaron: ${mainPassed} | Fallaron: ${results.length - mainPassed}`,
  );
  console.log(`Tasa: ${((mainPassed / results.length) * 100).toFixed(1)}%`);
  console.log(
    `\nHoldout: ${holdoutResults.length} | Pasaron: ${holdoutPassed}`,
  );

  // By category
  const byCategory = new Map<
    string,
    { total: number; passed: number; avgScore: number }
  >();
  for (const r of results) {
    const entry = byCategory.get(r.category) || {
      total: 0,
      passed: 0,
      avgScore: 0,
    };
    entry.total++;
    if (r.passed) entry.passed++;
    entry.avgScore += r.overallScore;
    byCategory.set(r.category, entry);
  }
  console.log("\n--- POR CATEGORÍA ---");
  console.table(
    Array.from(byCategory.entries()).map(([cat, data]) => ({
      categoria: cat,
      total: data.total,
      pasaron: data.passed,
      avgScore: (data.avgScore / data.total).toFixed(2),
    })),
  );

  // Mode breakdown
  const all = [...results, ...holdoutResults];
  const groqCount = all.filter((r) => r.answerMode === "groq").length;
  const extractiveCount = all.filter(
    (r) => r.answerMode === "extractive",
  ).length;
  const errorCount = all.filter((r) => r.answerMode === "error").length;
  console.log("\n--- MODO DE RESPUESTA ---");
  console.log(`  Groq (LLM): ${groqCount}/${all.length}`);
  console.log(`  Extractive (fallback): ${extractiveCount}/${all.length}`);
  if (errorCount > 0) console.log(`  Error: ${errorCount}/${all.length}`);

  // Groq vs extractive scores
  const groqResults = results.filter((r) => r.answerMode === "groq");
  const extractiveResults = results.filter(
    (r) => r.answerMode === "extractive",
  );
  if (groqResults.length > 0 && extractiveResults.length > 0) {
    const avgGroq =
      groqResults.reduce((s, r) => s + r.overallScore, 0) / groqResults.length;
    const avgExtr =
      extractiveResults.reduce((s, r) => s + r.overallScore, 0) /
      extractiveResults.length;
    console.log(`\n--- GROQ vs EXTRACTIVE ---`);
    console.log(
      `  Groq avg score: ${avgGroq.toFixed(3)} (${groqResults.length} casos)`,
    );
    console.log(
      `  Extractive avg score: ${avgExtr.toFixed(3)} (${extractiveResults.length} casos)`,
    );
    console.log(
      `  Delta: ${avgGroq - avgExtr > 0 ? "+" : ""}${(avgGroq - avgExtr).toFixed(3)}`,
    );
  }

  // Failures
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log("\n--- FALLOS ---");
    for (const f of failures.slice(0, 10)) {
      console.log(`\n  ${f.id} [score: ${f.overallScore.toFixed(2)}]`);
      console.log(`    Query: ${f.query}`);
      console.log(`    Mode: ${f.answerMode} | Sources: ${f.sourceCount}`);
      if (f.missingClaims.length > 0)
        console.log(`    Missing: ${f.missingClaims.join(", ")}`);
      if (f.forbiddenFound.length > 0)
        console.log(`    Forbidden found: ${f.forbiddenFound.join(", ")}`);
      if (f.errors.length > 0)
        console.log(`    Errors: ${f.errors.join(", ")}`);
      console.log(`    Answer (first 200): ${f.answer.slice(0, 200)}`);
    }
  }

  // Latency
  const latencies = [...results, ...holdoutResults].map((r) => r.latencyMs);
  console.log("\n--- LATENCIA ---");
  console.log(
    `  Promedio: ${Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)}ms`,
  );
  console.log(
    `  P95: ${latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]}ms`,
  );

  // Score dimensions
  const avgScores: Record<string, number> = {};
  const dims = Object.keys(results[0]?.scores || {});
  for (const dim of dims) {
    avgScores[dim] =
      results.reduce(
        (sum, r) => sum + r.scores[dim as keyof typeof r.scores],
        0,
      ) / results.length;
  }
  console.log("\n--- SCORES PROMEDIO ---");
  console.table(
    Object.entries(avgScores).map(([dim, avg]) => ({
      dimension: dim,
      promedio: avg.toFixed(3),
    })),
  );

  // Save report
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      mainCases: results.length,
      mainPassed: mainPassed,
      mainRate: Number(((mainPassed / results.length) * 100).toFixed(1)),
      holdoutCases: holdoutResults.length,
      holdoutPassed,
      avgOverallScore: Number(
        (
          results.reduce((s, r) => s + r.overallScore, 0) / results.length
        ).toFixed(3),
      ),
    },
    avgScores,
    results: results.map((r) => ({
      ...r,
      answer: r.answer.slice(0, 500),
    })),
    holdout: holdoutResults.map((r) => ({
      ...r,
      answer: r.answer.slice(0, 500),
    })),
  };
  const outputPath = path.join(
    process.cwd(),
    "artifacts",
    "contract-response-evaluation.json",
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nReporte: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
