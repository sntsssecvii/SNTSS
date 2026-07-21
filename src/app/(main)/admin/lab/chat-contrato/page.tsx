"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  FileText,
  Loader2,
  Send,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminRole, isSuperAdminRole } from "@/lib/auth/roles";
import { auth } from "@/lib/firebase/firebase-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceItem {
  chunk: { id: string; pageNumber: number; text: string };
  score: number;
  matchedTerms: string[];
  excerpt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGESTED_QUESTIONS = [
  { label: "Vacaciones", question: "¿Cuántos días de vacaciones me tocan?" },
  {
    label: "Salarios",
    question: "¿Cuánto gana una enfermera según el tabulador?",
  },
  {
    label: "Prestaciones",
    question: "¿Qué prestaciones tengo como trabajador de base?",
  },
  {
    label: "Jubilación",
    question: "¿Cuáles son los requisitos para jubilarme?",
  },
  {
    label: "Guarderías",
    question: "¿Qué dice sobre el servicio de guarderías?",
  },
  {
    label: "Créditos",
    question: "¿Qué créditos hipotecarios ofrece el contrato?",
  },
];

const INITIAL_MESSAGE =
  "Hola. Pregúntame algo del contrato y te respondo directo, con las páginas exactas de referencia.";

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function formatPageList(sources: SourceItem[]) {
  const pages = Array.from(
    new Set(sources.map((s) => s.chunk.pageNumber)),
  ).slice(0, 4);
  return pages.length > 0
    ? pages.map((p) => `p. ${p}`).join(" · ")
    : "Sin páginas";
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-primary/60"
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function StreamingCursor() {
  return (
    <motion.span
      className="ml-0.5 inline-block h-4 w-0.5 bg-primary"
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
    />
  );
}

function RichText({ text }: { text: string }) {
  // Render **bold**, (Cláusula X, p. Y) as badges, and $amounts highlighted
  const parts = text.split(
    /(\*\*[^*]+\*\*|\(Cláusula\s+\d+[^)]*\)|\(Cl\.\s+\d+[^)]*\)|\$[\d,]+(?:\.\d{2})?)/g,
  );
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong
              key={i}
              className="font-semibold text-slate-900 dark:text-white"
            >
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (/^\(Cl(á|a)usula/.test(part) || /^\(Cl\./.test(part)) {
          return (
            <span
              key={i}
              className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
            >
              {part}
            </span>
          );
        }
        if (part.startsWith("$")) {
          return (
            <span
              key={i}
              className="font-semibold text-emerald-700 dark:text-emerald-400"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function FormattedAnswer({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0 && isStreaming) {
    return <TypingDots />;
  }

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const bullet = line.match(/^[-•*]\s+(.+)/);
        const numbered = line.match(/^\d+[.)]\s+(.+)/);
        const isLast = i === lines.length - 1;
        const pageRef = /^P[aá]ginas?\s+de\s+referencia/i.test(line);

        if (pageRef) {
          return (
            <p
              key={`${line}-${i}`}
              className="mt-1 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              <RichText text={line} />
            </p>
          );
        }

        if (bullet || numbered) {
          return (
            <div key={`${line}-${i}`} className="flex gap-2 text-sm leading-6">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <p>
                <RichText text={bullet?.[1] ?? numbered?.[1] ?? ""} />
                {isLast && isStreaming && <StreamingCursor />}
              </p>
            </div>
          );
        }
        return (
          <p key={`${line}-${i}`} className="text-sm leading-6">
            <RichText text={line} />
            {isLast && isStreaming && <StreamingCursor />}
          </p>
        );
      })}
    </div>
  );
}

function SourcesDisclosure({ sources }: { sources: SourceItem[] }) {
  if (sources.length === 0) return null;
  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition hover:text-primary dark:text-slate-200">
        <span className="inline-flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" />
          Fuentes: {formatPageList(sources)}
        </span>
      </summary>
      <div className="space-y-2 border-t border-slate-200 p-3 dark:border-slate-800">
        {sources.slice(0, 4).map((source) => (
          <details
            key={source.chunk.id}
            className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition hover:text-primary dark:text-slate-100">
              Página {source.chunk.pageNumber}
            </summary>
            <p className="border-t border-slate-100 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
              {source.excerpt}
            </p>
          </details>
        ))}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ChatContratoSandboxPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  type LoadingPhase = "idle" | "searching" | "generating" | "done";
  const [query, setQuery] = useState("");
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: INITIAL_MESSAGE },
  ]);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 1 | -1>>(
    {},
  );
  const [feedbackComments, setFeedbackComments] = useState<
    Record<string, string>
  >({});
  const [streamingId, setStreamingId] = useState<string | null>(null);

  // Refs para acceder a los valores más recientes dentro de callbacks memoizados
  const messagesRef = useRef<ChatMessage[]>(messages);
  const feedbackGivenRef = useRef<Record<string, 1 | -1>>({});

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    feedbackGivenRef.current = feedbackGiven;
  }, [feedbackGiven]);

  const sendFeedback = useCallback(
    async (
      messageId: string,
      query: string,
      answer: string,
      rating: 1 | -1,
      comment?: string,
    ) => {
      setFeedbackGiven((prev) => ({ ...prev, [messageId]: rating }));
      try {
        const idToken = await auth.currentUser!.getIdToken();
        await fetch("/api/admin/lab/chat-contrato/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            query,
            answer,
            rating,
            ...(comment ? { comment } : {}),
          }),
        });
      } catch (e) {
        console.error(e);
      }
    },
    [],
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingPhase]);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!loading && user && userData) {
      if (!isAdminRole(userData.role) && !isSuperAdminRole(userData.role)) {
        router.push("/dashboard");
      }
    }
  }, [loading, router, user, userData]);

  const isAdmin =
    userData && (isAdminRole(userData.role) || isSuperAdminRole(userData.role));

  // New chat
  const startNewChat = useCallback(() => {
    setMessages([
      { id: "welcome", role: "assistant", content: INITIAL_MESSAGE },
    ]);
    setFeedbackGiven({});
    setQuery("");
  }, []);

  // Enviar una pregunta sugerida
  const submitSuggestion = useCallback((question: string) => {
    setQuery(question);
    setTimeout(() => {
      document
        .querySelector<HTMLFormElement>("[data-chat-form]")
        ?.requestSubmit();
    }, 50);
  }, []);

  // Submit question
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || loadingPhase !== "idle") return;

    setLoadingPhase("searching");
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedQuery,
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setQuery("");

    const assistantId = `assistant-${Date.now()}`;

    try {
      const idToken = await auth.currentUser!.getIdToken();
      const response = await fetch("/api/admin/lab/chat-contrato/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          query: trimmedQuery,
          history: messages
            .filter((m) => m.id !== "welcome")
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo consultar el contrato.");
      }

      // Add empty assistant message that we'll fill via streaming
      let streamedContent = "";
      let streamedSources: SourceItem[] = [];

      setMessages((current) => [
        ...current,
        { id: assistantId, role: "assistant", content: "", sources: [] },
      ]);
      setStreamingId(assistantId);
      // Phase stays "searching" until first SSE event with sources arrives

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
          if (!trimmedLine.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmedLine.slice(6));

            // Sources metadata
            if (json.sources) {
              setLoadingPhase("generating");
              streamedSources = json.sources.map((s: any, i: number) => ({
                chunk: {
                  id: `stream-${i}`,
                  pageNumber: s.pageNumber,
                  text: "",
                },
                score: s.score || 0,
                matchedTerms: [],
                excerpt: s.excerpt || "",
              }));
              setMessages((current) =>
                current.map((m) =>
                  m.id === assistantId ? { ...m, sources: streamedSources } : m,
                ),
              );
            }

            // Text chunk
            if (json.text) {
              streamedContent += json.text;
              const contentSnapshot = streamedContent;
              setMessages((current) =>
                current.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: contentSnapshot,
                        sources: streamedSources,
                      }
                    : m,
                ),
              );
            }

            if (json.error) {
              throw new Error(json.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      setStreamingId(null);
      setLoadingPhase("idle");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo consultar el contrato.";
      toast({
        title: "No se pudo responder",
        description: message,
        variant: "destructive",
      });
      setMessages((current) => {
        // Remove empty streaming message if it exists
        const filtered = current.filter(
          (m) => m.id !== assistantId || m.content.length > 0,
        );
        return [
          ...filtered,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `No pude completar la consulta: ${message}`,
          },
        ];
      });
      setStreamingId(null);
      setLoadingPhase("idle");
    }
  }

  const canSubmit = useMemo(
    () => query.trim().length > 0 && loadingPhase === "idle",
    [query, loadingPhase],
  );
  const visibleMessages = useMemo(
    () => messages.filter((m) => m.id !== "welcome"),
    [messages],
  );
  const isEmptyChat = visibleMessages.length === 0 && loadingPhase === "idle";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Redirigiendo...
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-6.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Chat principal */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            Asistente del Contrato Colectivo
          </h1>
          <button
            type="button"
            onClick={startNewChat}
            className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Nueva conversación
          </button>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto">
          {isEmptyChat ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bot className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                ¿Qué quieres consultar del contrato?
              </h2>
              <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                Pregunta en lenguaje natural. Te respondo directo y con las
                cláusulas y páginas de referencia.
              </p>
              <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTED_QUESTIONS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => submitSuggestion(item.question)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50"
                  >
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {item.question}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
              <AnimatePresence initial={false}>
                {visibleMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={
                      message.role === "user"
                        ? "flex justify-end"
                        : "flex justify-start gap-3"
                    }
                  >
                    {message.role === "assistant" && (
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Bot className="h-5 w-5" />
                      </div>
                    )}
                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-6 text-white shadow-sm"
                          : "min-w-0 flex-1 text-slate-700 dark:text-slate-200"
                      }
                    >
                      {message.role === "assistant" ? (
                        <>
                          <FormattedAnswer
                            content={message.content}
                            isStreaming={streamingId === message.id}
                          />
                          {streamingId !== message.id && (
                            <SourcesDisclosure
                              sources={message.sources ?? []}
                            />
                          )}
                          {!message.id.startsWith("err-") &&
                            streamingId !== message.id && (
                              <div className="mt-2">
                                <div className="flex items-center gap-1">
                                  {feedbackGiven[message.id] && (
                                    <span className="mr-1 text-xs text-slate-400">
                                      {feedbackGiven[message.id] === 1
                                        ? "Gracias"
                                        : "Anotado"}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const prevUser = messages
                                        .slice(0, messages.indexOf(message))
                                        .reverse()
                                        .find((m) => m.role === "user");
                                      sendFeedback(
                                        message.id,
                                        prevUser?.content || "",
                                        message.content,
                                        1,
                                      );
                                    }}
                                    disabled={!!feedbackGiven[message.id]}
                                    className={`rounded p-1 transition ${
                                      feedbackGiven[message.id] === 1
                                        ? "text-emerald-600"
                                        : "text-slate-300 hover:text-emerald-600 dark:text-slate-600"
                                    }`}
                                    aria-label="Respuesta útil"
                                  >
                                    <ThumbsUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const prevUser = messages
                                        .slice(0, messages.indexOf(message))
                                        .reverse()
                                        .find((m) => m.role === "user");
                                      sendFeedback(
                                        message.id,
                                        prevUser?.content || "",
                                        message.content,
                                        -1,
                                      );
                                    }}
                                    disabled={!!feedbackGiven[message.id]}
                                    className={`rounded p-1 transition ${
                                      feedbackGiven[message.id] === -1
                                        ? "text-red-500"
                                        : "text-slate-300 hover:text-red-500 dark:text-slate-600"
                                    }`}
                                    aria-label="Respuesta no útil"
                                  >
                                    <ThumbsDown className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                {feedbackGiven[message.id] === -1 && (
                                  <div className="mt-2">
                                    <input
                                      type="text"
                                      placeholder="¿Qué estuvo mal? (opcional, Enter para enviar)"
                                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                      defaultValue={
                                        feedbackComments[message.id] ?? ""
                                      }
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" &&
                                          e.currentTarget.value.trim()
                                        ) {
                                          const comment =
                                            e.currentTarget.value.trim();
                                          e.currentTarget.value = "";
                                          setFeedbackComments((prev) => ({
                                            ...prev,
                                            [message.id]: comment,
                                          }));
                                          const prevUser = messages
                                            .slice(0, messages.indexOf(message))
                                            .reverse()
                                            .find((m) => m.role === "user");
                                          sendFeedback(
                                            message.id,
                                            prevUser?.content || "",
                                            message.content,
                                            -1,
                                            comment,
                                          );
                                        }
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <AnimatePresence>
                {loadingPhase === "searching" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-start gap-3"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buscando en el contrato...
                    </div>
                  </motion.div>
                )}
                {loadingPhase === "generating" && streamingId === null && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-start gap-3"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generando respuesta...
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <form
            data-chat-form
            onSubmit={handleSubmit}
            className="mx-auto max-w-3xl"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 dark:border-slate-700 dark:bg-slate-950">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canSubmit) {
                      e.currentTarget.closest("form")?.requestSubmit();
                    }
                  }
                }}
                placeholder="Escribe tu pregunta sobre el contrato..."
                className="max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
                rows={1}
              />
              <Button
                type="submit"
                disabled={!canSubmit}
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                aria-label="Enviar"
              >
                {loadingPhase !== "idle" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-slate-400">
              Respuestas basadas en el Contrato Colectivo IMSS-SNTSS 2025-2027.
              Verifica siempre las cláusulas citadas.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
