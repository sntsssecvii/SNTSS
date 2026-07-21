import path from "path";

import {
  DEFAULT_GROQ_MODEL,
  GROQ_MIN_INTERVAL_MS,
  MAX_CONVERSATION_HISTORY,
} from "@/lib/contract-chat/constants";
import { readLocalEnvValue } from "@/lib/contract-chat/embeddings";
import { normalizeText } from "@/lib/contract-chat/query-processing";
import { orderSourcesForPrompt } from "@/lib/contract-chat/evidence";
import { buildAnswerText } from "@/lib/contract-chat/evidence-pack";
import { sanitizeConversationHistory } from "@/lib/contract-chat/contextualization";
import type {
  AnswerPlan,
  ChatMessage,
  ContractSearchResult,
} from "@/lib/contract-chat/types";
import { CONTRACT_SECTIONS } from "@/lib/contract-chat/query-processing";

// ---------------------------------------------------------------------------
// Groq config helpers
// ---------------------------------------------------------------------------

export function getGroqApiKeys(): string[] {
  const keys: string[] = [];
  const primary =
    process.env.GROQ_API_KEY ||
    readLocalEnvValue(
      path.join(process.cwd(), ".env.groq.local"),
      "GROQ_API_KEY",
    ) ||
    readLocalEnvValue(path.join(process.cwd(), ".env.local"), "GROQ_API_KEY");
  if (primary) keys.push(primary);

  const fallback =
    process.env.GROQ_API_KEY_FALLBACK ||
    readLocalEnvValue(
      path.join(process.cwd(), ".env.local"),
      "GROQ_API_KEY_FALLBACK",
    );
  if (fallback) keys.push(fallback);

  return keys;
}

export function getGroqApiKey() {
  return getGroqApiKeys()[0] || null;
}

export function getGroqModel() {
  return (
    process.env.GROQ_MODEL ||
    readLocalEnvValue(
      path.join(process.cwd(), ".env.groq.local"),
      "GROQ_MODEL",
    ) ||
    readLocalEnvValue(path.join(process.cwd(), ".env.local"), "GROQ_MODEL") ||
    DEFAULT_GROQ_MODEL
  );
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `Eres un asesor sindical experimentado del SNTSS que conoce a fondo el contrato colectivo IMSS-SNTSS 2025-2027. Hablas como compañero de trabajo — claro, directo, con confianza. Tu objetivo es que el trabajador ENTIENDA sus derechos, no solo que sepa la cláusula.

CÓMO RESPONDER:
1. Primero responde la pregunta en palabras sencillas, como se lo explicarías a un compañero en el pasillo.
2. Luego da el detalle concreto (montos, plazos, requisitos) que esté en las fuentes.
3. Al final menciona dónde encontrarlo: sección, cláusula y página.
4. Si las fuentes no cubren todo, dilo: "De lo que tengo a la mano solo me aparece X, pero el detalle completo lo encuentras en tal sección."
5. Si el usuario pide opciones, tipos, requisitos o aplicabilidad, responde en formato de decisión: "puedes revisar/aplicar a", "depende de", "no aplica si", y "dato que falta". No sustituyas la respuesta con una frase genérica como "consulta los requisitos específicos".

ESTRUCTURA DEL CONTRATO (para orientar al trabajador):
1. Contrato Colectivo (p.9-88) — las 157 cláusulas principales: derechos, obligaciones, prestaciones.
2. Tabulador de Sueldos (p.89-104) — cuánto gana cada categoría.
3. Profesiogramas (p.105-262) — qué hace cada puesto y qué requisitos pide.
4. Catálogos (p.263-272) — lista de categorías y ramas.
5. Reglamentos (p.273-542) — reglas detalladas de: becas, bolsas de trabajo, escalafón (p.339), fondo de retiro (p.357), guarderías (p.364), uniformes (p.374), reglamento interior (p.389), préstamos de vivienda (p.446), entre otros.
6. Convenio de Jubilaciones Nuevo Ingreso (p.543-550) — régimen especial para los de nuevo ingreso.
7. Índice (p.551+).

REGLAS:
- Solo usa datos que estén en las fuentes proporcionadas. No inventes cláusulas, páginas ni montos.
- Las citas de cláusula y página SOLO sácalas del campo "Ubicación" de cada fuente.
- Si mencionas sueldos, aclara que es "sueldo base tabular" y que hay prestaciones adicionales.
- Antes de redactar, comprueba que cada conclusión esté explícitamente respaldada por una fuente. No completes huecos con conocimiento general.
- Si falta un dato personal decisivo, como fecha de ingreso, antigüedad o tipo de contratación, explica las opciones respaldadas y pide ese dato. No afirmes qué régimen aplica todavía.
- Si la pregunta compara leyes o reglas que las fuentes no nombran, dilo claramente en vez de deducir una equivalencia.
- Si hay artículos consecutivos del mismo reglamento en las fuentes, intégralos: definición, clases, derechos, requisitos, autoridad que decide y límites. No trates cada fuente como una respuesta aislada.

ESTILO:
- Español coloquial mexicano. Nada de "cabe mencionar", "es importante señalar" ni frases de abogado.
- Ve al grano. Frases cortas. Usa bullets para listas.
- NO empieces con "Según el contrato..." — di directo lo que pasa.
- Si es pregunta de seguimiento, usa el contexto previo. No repitas lo que ya dijiste.
- Si ya existe historial de conversación, NO saludes otra vez. Continúa directo con la respuesta.
- Máximo 8-10 líneas. Si pide más detalle, entonces sí amplía.
- Al final: "Páginas de referencia: p. X, p. Y"`;

// ---------------------------------------------------------------------------
// Helper: section lookup for page number
// ---------------------------------------------------------------------------

function getSectionForPage(
  pageNumber: number,
): (typeof CONTRACT_SECTIONS)[number] | null {
  for (const section of CONTRACT_SECTIONS) {
    if (pageNumber >= section.startPage && pageNumber <= section.endPage) {
      return section;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Build Groq messages
// ---------------------------------------------------------------------------

export function buildGroqMessages(
  query: string,
  sources: ContractSearchResult[],
  conversationHistory: ChatMessage[],
  tabuladorContext?: string,
  plan?: AnswerPlan,
): Array<{ role: string; content: string }> {
  const promptSources = orderSourcesForPrompt(sources);
  const context = promptSources
    .map((source, i) => {
      const section = getSectionForPage(source.chunk.pageNumber);
      const sectionInfo = section
        ? `[${section.number}. ${section.title}]`
        : "";
      const clauseInfo = source.chunk.clauseNumber
        ? `Cláusula ${source.chunk.clauseNumber}${source.chunk.clauseTitle ? ` - ${source.chunk.clauseTitle}` : ""}`
        : `Sección general`;
      const chapterInfo = source.chunk.chapterTitle
        ? ` | ${source.chunk.chapterTitle}`
        : "";
      const textLimit = i < 4 ? 1_400 : 700;
      return [
        `--- Fuente ${i + 1} ---`,
        `Ubicación: ${sectionInfo} ${clauseInfo}${chapterInfo} | Página ${source.chunk.pageNumber}`,
        `Texto: ${source.chunk.text.slice(0, textLimit)}`,
      ].join("\n");
    })
    .join("\n\n");

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  const recentHistory = sanitizeConversationHistory(
    query,
    conversationHistory,
  ).slice(-MAX_CONVERSATION_HISTORY);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  const validPages = Array.from(
    new Set(promptSources.map((s) => s.chunk.pageNumber)),
  ).sort((a, b) => a - b);
  const validClauses = promptSources
    .filter((s) => s.chunk.clauseNumber)
    .map((s) => `Cláusula ${s.chunk.clauseNumber} (p. ${s.chunk.pageNumber})`)
    .filter((v, i, a) => a.indexOf(v) === i);
  const hasRelativeReference = /\b(antes|despues|eso|esa|ese|mi caso)\b/.test(
    normalizeText(query),
  );
  const hasHistory = recentHistory.length > 0;

  messages.push({
    role: "user",
    content: [
      `Pregunta: ${query}`,
      "",
      hasHistory
        ? "Esta es una continuación de una conversación activa: no saludes ni reinicies la conversación; responde directo usando el contexto previo."
        : null,
      hasHistory ? "" : null,
      tabuladorContext ? tabuladorContext : null,
      tabuladorContext ? "" : null,
      context ? "Contexto recuperado del contrato:" : null,
      context || null,
      "",
      validPages.length > 0
        ? `PÁGINAS VÁLIDAS que puedes citar: ${validPages.map((p) => `p. ${p}`).join(", ")}`
        : null,
      validClauses.length > 0
        ? `CLÁUSULAS VÁLIDAS: ${validClauses.join(", ")}`
        : null,
      hasRelativeReference
        ? "La pregunta contiene una referencia relativa. No supongas una fecha, condición personal o régimen: presenta únicamente las alternativas explícitas en las fuentes y pide el dato que falte."
        : null,
      plan?.dataThatMustBeRequested && plan.dataThatMustBeRequested.length > 0
        ? `DATOS FALTANTES: El usuario no proporcionó: ${plan.dataThatMustBeRequested.join(", ")}. Presenta las opciones disponibles y pide esos datos al final.`
        : null,
      plan?.needsCombiningSources
        ? "Las fuentes provienen de secciones distintas del contrato. Integra la información de forma coherente — no trates cada fuente como una respuesta aislada."
        : null,
      "IMPORTANTE: NO cites ninguna página o cláusula que no esté en las listas anteriores. Los datos del tabulador de sueldos son EXACTOS — cítalos textualmente.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return messages;
}

// ---------------------------------------------------------------------------
// Generate a complete (non-streaming) answer from Groq
// ---------------------------------------------------------------------------

export async function generateGroqAnswer(
  query: string,
  sources: ContractSearchResult[],
  conversationHistory: ChatMessage[],
  tabuladorContext?: string,
  plan?: AnswerPlan,
) {
  const apiKey = getGroqApiKey();
  if (!apiKey || sources.length === 0) return null;

  const model = getGroqModel();
  const messages = buildGroqMessages(
    query,
    sources,
    conversationHistory,
    tabuladorContext,
    plan,
  );

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1024,
        messages,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GROQ_HTTP_${response.status}: ${errorText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("GROQ_EMPTY_RESPONSE");

  return { model, content };
}

// ---------------------------------------------------------------------------
// Throttle state and round-robin key rotation
// ---------------------------------------------------------------------------

// Simple throttle — Groq free tier has ~6000 TPM org-level limit
export let lastGroqCallMs = 0;

// Round-robin key rotation: alternate keys proactively to spread TPM load
export let nextKeyIndex = 0;

// ---------------------------------------------------------------------------
// Extractive fallback when Groq is unavailable
// ---------------------------------------------------------------------------

export function enqueueExtractiveFallback(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  sources: ContractSearchResult[],
) {
  const body =
    sources.length > 0
      ? buildAnswerText(sources, {
          prefix:
            "El LLM se saturó por límite de uso, pero sí recuperé evidencia del contrato. Te dejo la respuesta corta con respaldo:",
        })
      : "El LLM se saturó por límite de uso. Intenta de nuevo en un minuto.";
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({ text: body })}\n\n`),
  );
  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
  controller.close();
}

// ---------------------------------------------------------------------------
// Streaming answer from Groq (SSE)
// ---------------------------------------------------------------------------

export function createGroqStream(
  query: string,
  sources: ContractSearchResult[],
  conversationHistory: ChatMessage[],
  tabuladorContext?: string,
): ReadableStream<Uint8Array> | null {
  const allKeys = getGroqApiKeys();
  if (allKeys.length === 0) return null;

  // Round-robin: start with a different key each request
  const startIndex = nextKeyIndex % allKeys.length;
  nextKeyIndex++;
  const apiKeys = [
    ...allKeys.slice(startIndex),
    ...allKeys.slice(0, startIndex),
  ];

  const model = getGroqModel();

  // For conversational (no sources), use a lighter prompt
  const messages =
    sources.length > 0 || tabuladorContext
      ? buildGroqMessages(query, sources, conversationHistory, tabuladorContext)
      : [
          {
            role: "system" as const,
            content:
              "Eres el asistente del contrato colectivo IMSS-SNTSS 2025-2027. " +
              "Responde de forma natural, amigable y breve. Puedes saludar, despedirte, o guiar al usuario. " +
              "Si ya hay historial de conversación, no saludes otra vez: continúa directo. " +
              "Si te preguntan algo que no es del contrato, recuérdale amablemente que estás para consultas del contrato. " +
              "Responde en español, máximo 3-4 líneas.",
          },
          ...sanitizeConversationHistory(query, conversationHistory)
            .slice(-6)
            .map((m) => ({
              role: m.role as string,
              content: m.content,
            })),
          { role: "user" as const, content: query },
        ];

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Throttle to stay under Groq TPM limits
        const now = Date.now();
        const elapsed = now - lastGroqCallMs;
        if (elapsed < GROQ_MIN_INTERVAL_MS && lastGroqCallMs > 0) {
          await new Promise((r) =>
            setTimeout(r, GROQ_MIN_INTERVAL_MS - elapsed),
          );
        }
        lastGroqCallMs = Date.now();

        // Try each key directly with streaming
        let response: Response | null = null;
        for (let ki = 0; ki < apiKeys.length; ki++) {
          const key = apiKeys[ki];
          const attempt = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({
                model,
                temperature: 0,
                max_tokens: 1024,
                stream: true,
                stream_options: { include_usage: true },
                messages,
              }),
            },
          );

          if (attempt.ok && attempt.body) {
            // Read first chunk to check for rate limit in stream body
            const peekReader = attempt.body.getReader();
            const firstChunk = await peekReader.read();
            const firstText = firstChunk.value
              ? new TextDecoder().decode(firstChunk.value)
              : "";

            if (
              firstText.includes("Rate limit") ||
              firstText.includes("rate_limit")
            ) {
              peekReader.cancel();
              if (ki < apiKeys.length - 1) {
                console.log(
                  "[chat] Key",
                  ki + 1,
                  "rate limited in stream body, trying next...",
                );
                continue;
              }
              console.error("[chat] Rate limit en body con la última key");
              enqueueExtractiveFallback(controller, encoder, sources);
              return;
            }

            // Key works — replay first chunk then pipe the rest via the same reader
            response = new Response(
              new ReadableStream({
                start(c) {
                  if (firstChunk.value) c.enqueue(firstChunk.value);
                },
                async pull(c) {
                  try {
                    const { done, value } = await peekReader.read();
                    if (done) {
                      c.close();
                      return;
                    }
                    c.enqueue(value);
                  } catch {
                    c.close();
                  }
                },
              }),
            );
            break;
          }

          // HTTP error — try next key
          if (ki < apiKeys.length - 1) {
            console.log(
              "[chat] Key",
              ki + 1,
              "failed (status " + attempt.status + "), trying next...",
            );
            continue;
          }

          const errorText = await attempt.text();
          console.error(
            "[chat] Groq falló con la última key:",
            attempt.status,
            errorText.slice(0, 200),
          );
          // Con sources disponibles preferimos el fallback extractivo antes que
          // mostrar un error crudo al usuario.
          if (sources.length > 0) {
            enqueueExtractiveFallback(controller, encoder, sources);
            return;
          }
          const isRateLimit =
            attempt.status === 429 || errorText.includes("Rate limit");
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: isRateLimit
                  ? "Límite de uso alcanzado. Espera un minuto e intenta de nuevo."
                  : errorText.slice(0, 200),
              })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        if (!response || !response.body) {
          console.error("[chat] Todas las keys en rate limit");
          enqueueExtractiveFallback(controller, encoder, sources);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (!trimmed.startsWith("data: ")) continue;

            try {
              const json = JSON.parse(trimmed.slice(6));
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ text: delta })}\n\n`,
                  ),
                );
              }
              // Groq envía el usage en el chunk final (include_usage)
              if (json.usage) {
                const u = json.usage;
                console.log(
                  `[chat] Groq usage — modelo: ${model} | prompt: ${u.prompt_tokens} | completion: ${u.completion_tokens} | total: ${u.total_tokens} tokens`,
                );
                // Reenviar el usage al cliente para poder mostrarlo en la UI
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ usage: u })}\n\n`),
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Stream error" })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });
}
