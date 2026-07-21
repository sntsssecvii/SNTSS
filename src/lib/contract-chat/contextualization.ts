import { MAX_CONTEXTUALIZATION_HISTORY } from "@/lib/contract-chat/constants";
import { normalizeText } from "@/lib/contract-chat/query-processing";
import { getGroqApiKeys, getGroqModel } from "@/lib/contract-chat/llm";
import type {
  ChatMessage,
  ContractRetrievalTrace,
} from "@/lib/contract-chat/types";

// ---------------------------------------------------------------------------
// Conversation history sanitization
// ---------------------------------------------------------------------------

export function sanitizeConversationHistory(
  query: string,
  conversationHistory: ChatMessage[],
): ChatMessage[] {
  const normalizedCurrent = normalizeText(query);
  const cleaned = conversationHistory
    .filter(
      (message): message is ChatMessage =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1_200),
    }));

  const last = cleaned.at(-1);
  if (
    last?.role === "user" &&
    normalizeText(last.content) === normalizedCurrent
  ) {
    cleaned.pop();
  }

  return cleaned.slice(-MAX_CONTEXTUALIZATION_HISTORY);
}

// ---------------------------------------------------------------------------
// Local contextualization helpers
// ---------------------------------------------------------------------------

export function fallbackContextualQuery(
  query: string,
  history: ChatMessage[],
): string {
  const previousUserMessage = [...history]
    .reverse()
    .find((message) => message.role === "user")?.content;

  if (!previousUserMessage) return query;
  return `Tema previo: ${previousUserMessage}. Pregunta de seguimiento: ${query}`;
}

export function buildLocalContextualQuery(
  query: string,
  history: ChatMessage[],
): string | null {
  if (history.length === 0) return null;

  const normalizedQuery = normalizeText(query);
  const historyText = normalizeText(
    history.map((message) => message.content).join(" "),
  );
  const previousUserMessage = [...history]
    .reverse()
    .find((message) => message.role === "user")?.content;

  const activeTopics = [
    { pattern: /\b(beca|becas)\b/, label: "becas" },
    {
      pattern: /\b(jubil\w*|pension\w*|ley 73|ley 97|nuevo ingreso)\b/,
      label: "jubilación y pensiones",
    },
    {
      pattern: /\b(permiso|permisos|licencia|licencias)\b/,
      label: "permisos y licencias",
    },
    { pattern: /\b(vacacion|vacaciones)\b/, label: "vacaciones" },
    {
      pattern: /\b(escalafon|promocion|cambio de rama)\b/,
      label: "escalafón y promociones",
    },
  ]
    .filter((topic) => topic.pattern.test(historyText))
    .map((topic) => topic.label);

  const queryHasActiveTopic = activeTopics.some((topic) =>
    normalizeText(topic)
      .split(/\s+/)
      .some((token) => normalizedQuery.includes(token)),
  );
  const isFollowup =
    /\b(eso|esa|ese|estos|estas|aplica|aplicar|puedo|entonces|y si|en mi caso|extranjero|republica|requisitos|cuanto|cuantos|cuales|como|ley 73|ley 97)\b/.test(
      normalizedQuery,
    );

  if (activeTopics.length > 0 && (isFollowup || !queryHasActiveTopic)) {
    return `Tema activo: ${activeTopics.slice(0, 2).join(" y ")}. ${previousUserMessage ? `Contexto previo: ${previousUserMessage}. ` : ""}Pregunta actual: ${query}`;
  }

  if (isFollowup && previousUserMessage) {
    return fallbackContextualQuery(query, history);
  }

  return null;
}

// ---------------------------------------------------------------------------
// LLM-based standalone query generation
// ---------------------------------------------------------------------------

export async function generateStandaloneQuery(
  query: string,
  history: ChatMessage[],
): Promise<string | null> {
  const apiKeys = getGroqApiKeys();
  if (apiKeys.length === 0 || history.length === 0) return null;

  const transcript = history
    .map(
      (message) =>
        `${message.role === "user" ? "Usuario" : "Asistente"}: ${message.content}`,
    )
    .join("\n");

  for (const apiKey of apiKeys) {
    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: getGroqModel(),
            temperature: 0,
            max_tokens: 140,
            messages: [
              {
                role: "system",
                content:
                  "Convierte la última pregunta en una pregunta autónoma para buscar en el CCT IMSS-SNTSS 2025-2027. " +
                  "Resuelve referencias como 'eso', 'y en mi caso' o 'ley 73 o 97' usando el historial. " +
                  "Formula qué establece o distingue el CCT sobre el tema; no conviertas la consulta en una pregunta jurídica general. " +
                  "No respondas la pregunta, no agregues hechos del asistente y no inventes datos. " +
                  "Devuelve únicamente la pregunta autónoma en una sola línea. Si el historial no aporta contexto, conserva la pregunta original.",
              },
              {
                role: "user",
                content: `Historial reciente:\n${transcript}\n\nPregunta actual: ${query}`,
              },
            ],
          }),
        },
      );

      if (!response.ok) continue;
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const standalone = payload.choices?.[0]?.message?.content
        ?.trim()
        .replace(/^['"]|['"]$/g, "")
        .replace(/^pregunta aut[oó]noma:\s*/i, "")
        .trim();
      const refused = standalone
        ? /\b(no puedo|no es posible|lo siento|no puedo ayudarte)\b/i.test(
            standalone,
          )
        : false;
      if (standalone && standalone.length >= 3 && !refused) {
        return standalone.slice(0, 500);
      }
    } catch {
      // Try the next configured key, then use the local fallback.
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Query contextualization orchestrator
// ---------------------------------------------------------------------------

export async function contextualizeQuery(
  query: string,
  conversationHistory: ChatMessage[],
): Promise<{
  query: string;
  mode: ContractRetrievalTrace["contextualizationMode"];
  history: ChatMessage[];
}> {
  const history = sanitizeConversationHistory(query, conversationHistory);
  if (history.length === 0) return { query, mode: "none", history };

  const localQuery = buildLocalContextualQuery(query, history);
  if (localQuery) return { query: localQuery, mode: "fallback", history };

  if (process.env.CONTRACT_CHAT_LLM_CONTEXTUALIZATION !== "1") {
    return { query, mode: "none", history };
  }

  const standalone = await generateStandaloneQuery(query, history);
  if (standalone) return { query: standalone, mode: "llm", history };

  return {
    query: fallbackContextualQuery(query, history),
    mode: "fallback",
    history,
  };
}

// ---------------------------------------------------------------------------
// Topic reinforcement
// ---------------------------------------------------------------------------

export function reinforceContextualTopic(
  query: string,
  contextualizedQuery: string,
  history: ChatMessage[],
): string {
  if (history.length === 0) return contextualizedQuery;

  const normalizedHistory = normalizeText(
    history.map((message) => message.content).join(" "),
  );
  const normalizedCurrent = normalizeText(`${query} ${contextualizedQuery}`);
  const hasScholarshipTopic = /\b(beca|becas)\b/.test(normalizedHistory);
  const lostScholarshipTopic = !/\b(beca|becas)\b/.test(normalizedCurrent);
  const isStudyFollowup =
    /\b(estudiar|estudio|estudios|extranjero|republica|curso|cursos|maestria|doctorado|postgrado|posgrado|especializacion)\b/.test(
      normalizedCurrent,
    );

  if (hasScholarshipTopic && lostScholarshipTopic && isStudyFollowup) {
    return `${contextualizedQuery}. Tema activo: becas del Reglamento de Becas para la Capacitación de los Trabajadores del Seguro Social.`;
  }

  return contextualizedQuery;
}
