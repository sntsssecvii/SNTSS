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
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageSquareText,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

interface ContractChatStatus {
  pdf: { exists: boolean; fileName: string; path: string };
  index: {
    exists: boolean;
    fresh: boolean;
    builtAt?: string;
    pageCount?: number;
    chunkCount?: number;
    vocabularySize?: number;
    error?: string;
  };
  llm: { provider: "groq"; configured: boolean; model: string };
  ready: boolean;
}

interface SessionSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGESTED_QUESTIONS = [
  {
    label: "Vacaciones",
    question: "¿Qué dice el contrato colectivo sobre vacaciones?",
  },
  {
    label: "Permisos",
    question: "Resume lo más relevante sobre permisos y licencias.",
  },
  {
    label: "Jubilación",
    question: "¿Cuáles son los requisitos para jubilación?",
  },
  {
    label: "Escalafón",
    question: "Busca referencias a escalafón o promociones.",
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
        if (bullet || numbered) {
          return (
            <div key={`${line}-${i}`} className="flex gap-2 text-sm leading-6">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <p>
                {bullet?.[1] ?? numbered?.[1]}
                {isLast && isStreaming && <StreamingCursor />}
              </p>
            </div>
          );
        }
        return (
          <p key={`${line}-${i}`} className="text-sm leading-6">
            {line}
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

  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<ContractChatStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: INITIAL_MESSAGE },
  ]);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 1 | -1>>(
    {},
  );
  const [streamingId, setStreamingId] = useState<string | null>(null);

  const sendFeedback = useCallback(
    async (
      messageId: string,
      query: string,
      answer: string,
      rating: 1 | -1,
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
          body: JSON.stringify({ query, answer, rating }),
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
  }, [messages, submitting]);

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

  // Load status
  useEffect(() => {
    if (loading || !user || !isAdmin) return;
    let cancelled = false;
    async function loadStatus() {
      setStatusLoading(true);
      try {
        const idToken = await auth.currentUser!.getIdToken();
        const res = await fetch("/api/admin/lab/chat-contrato", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        const payload = await res.json();
        if (!cancelled && res.ok && payload?.data) setStatus(payload.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [loading, user, isAdmin]);

  // Load sessions list
  const loadSessions = useCallback(async () => {
    if (!auth.currentUser) return;
    setSessionsLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/lab/chat-contrato/sessions", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const payload = await res.json();
      if (res.ok && payload?.data) setSessions(payload.data);
    } catch (e) {
      console.error(e);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && user && isAdmin) loadSessions();
  }, [loading, user, isAdmin, loadSessions]);

  // Save session (create or update)
  const saveSession = useCallback(
    async (allMessages: ChatMessage[], currentSessionId: string | null) => {
      const realMessages = allMessages.filter((m) => m.id !== "welcome");
      if (realMessages.length < 2) return currentSessionId;

      const idToken = await auth.currentUser!.getIdToken();
      const title =
        realMessages.find((m) => m.role === "user")?.content.slice(0, 80) ||
        "Chat";
      const body = {
        title,
        messages: realMessages.map((m) => ({
          role: m.role,
          content: m.content,
          sources: m.sources?.map((s) => ({
            pageNumber: s.chunk.pageNumber,
            excerpt: s.excerpt,
          })),
          createdAt: new Date().toISOString(),
        })),
      };

      if (currentSessionId) {
        await fetch(
          `/api/admin/lab/chat-contrato/sessions/${currentSessionId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(body),
          },
        );
        return currentSessionId;
      }

      const res = await fetch("/api/admin/lab/chat-contrato/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (res.ok && payload?.data?.id) {
        loadSessions();
        return payload.data.id as string;
      }
      return null;
    },
    [loadSessions],
  );

  // Load a session
  const loadSession = useCallback(async (id: string) => {
    try {
      const idToken = await auth.currentUser!.getIdToken();
      const res = await fetch(`/api/admin/lab/chat-contrato/sessions/${id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const payload = await res.json();
      if (!res.ok || !payload?.data) return;

      const loaded: ChatMessage[] = [
        { id: "welcome", role: "assistant", content: INITIAL_MESSAGE },
        ...payload.data.messages.map((m: any, i: number) => ({
          id: `loaded-${i}`,
          role: m.role,
          content: m.content,
          sources: m.sources?.map((s: any, j: number) => ({
            chunk: { id: `src-${i}-${j}`, pageNumber: s.pageNumber, text: "" },
            score: 0,
            matchedTerms: [],
            excerpt: s.excerpt || "",
          })),
        })),
      ];
      setMessages(loaded);
      setSessionId(id);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Delete session
  const deleteSession = useCallback(
    async (id: string) => {
      try {
        const idToken = await auth.currentUser!.getIdToken();
        await fetch(`/api/admin/lab/chat-contrato/sessions/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (sessionId === id) {
          setSessionId(null);
          setMessages([
            { id: "welcome", role: "assistant", content: INITIAL_MESSAGE },
          ]);
        }
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } catch (e) {
        console.error(e);
      }
    },
    [sessionId],
  );

  // New chat
  const startNewChat = useCallback(() => {
    setSessionId(null);
    setMessages([
      { id: "welcome", role: "assistant", content: INITIAL_MESSAGE },
    ]);
    setQuery("");
  }, []);

  // Submit question
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || submitting) return;

    setSubmitting(true);
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
          history: updatedMessages
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
      setSubmitting(false);

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

      // Auto-save after stream completes
      const finalMessages = updatedMessages.concat({
        id: assistantId,
        role: "assistant",
        content: streamedContent,
        sources: streamedSources,
      });
      const newId = await saveSession(finalMessages, sessionId);
      if (newId) setSessionId(newId);
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
      setSubmitting(false);
    }
  }

  const canSubmit = useMemo(
    () => query.trim().length > 0 && !submitting,
    [query, submitting],
  );
  const latestSources = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.sources?.length)?.sources ??
      [],
    [messages],
  );
  const documentSummary =
    status?.index.exists && status.index.fresh
      ? `${status.index.pageCount ?? 0} páginas · ${status.index.chunkCount ?? 0} fragmentos`
      : "Preparación pendiente";

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
    <main className="min-h-screen bg-slate-50 px-4 py-4 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                Admin
              </Badge>
              <Badge
                variant="outline"
                className="border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                {statusLoading
                  ? "Verificando documento"
                  : status?.ready
                    ? "Documento listo"
                    : "Revisar documento"}
              </Badge>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Asistente del Contrato Colectivo
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Pregunta en lenguaje natural. Te respondo resumido y con páginas
                de respaldo.
              </p>
            </div>
          </div>
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:min-w-72">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">
                Documento
              </span>
              <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                {status?.pdf.exists ? status.pdf.fileName : "No encontrado"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Índice</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {documentSummary}
              </span>
            </div>
          </div>
        </header>

        {/* Main grid */}
        <div className="grid min-h-[calc(100vh-11rem)] gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* Chat area */}
          <section className="flex min-h-[34rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">
                    ¿Qué necesitas consultar?
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Puedes preguntar por artículos, derechos, requisitos, plazos
                    o páginas específicas.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setQuery(item.question)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 px-4 py-4 dark:bg-slate-950/40">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.3,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                    className={
                      message.role === "user"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <div
                      className={
                        message.role === "user"
                          ? "max-w-2xl rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-white shadow-md"
                          : "max-w-2xl rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
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
                          {message.id !== "welcome" &&
                            !message.id.startsWith("err-") &&
                            streamingId !== message.id && (
                              <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
                                <span className="mr-1 text-xs text-slate-400">
                                  {feedbackGiven[message.id] === 1
                                    ? "Gracias"
                                    : feedbackGiven[message.id] === -1
                                      ? "Anotado"
                                      : ""}
                                </span>
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
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-6">
                          {message.content}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <AnimatePresence>
                {submitting && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex justify-start"
                  >
                    <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                      <div className="flex items-center gap-3">
                        <TypingDots />
                        <span className="text-xs text-slate-400">
                          Buscando en el contrato...
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-without-motion focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 dark:border-slate-700 dark:bg-slate-950">
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Escribe tu pregunta..."
                  className="min-h-16 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-2 pt-2 dark:border-slate-800">
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="gap-2 sm:min-w-28"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Enviando
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> Enviar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Chat sessions */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Conversaciones</h2>
                </div>
                <button
                  type="button"
                  onClick={startNewChat}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                {sessionsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                ) : sessions.length > 0 ? (
                  sessions.slice(0, 10).map((s) => (
                    <div
                      key={s.id}
                      className={`group flex items-start gap-2 rounded-lg px-3 py-2 text-sm transition cursor-pointer ${
                        sessionId === s.id
                          ? "bg-primary/10 text-primary"
                          : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-950"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => loadSession(s.id)}
                      >
                        <p className="truncate font-medium">{s.title}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {s.messageCount} mensajes
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(s.id);
                        }}
                        className="mt-0.5 shrink-0 opacity-0 transition group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    Tus conversaciones guardadas aparecerán aquí.
                  </p>
                )}
              </div>
            </section>

            {/* Sources */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Fuentes de la respuesta</h2>
              </div>
              <div className="mt-3 space-y-2">
                {latestSources.length > 0 ? (
                  latestSources.slice(0, 4).map((source) => (
                    <details
                      key={source.chunk.id}
                      className="rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <summary className="cursor-pointer list-none px-3 py-2 font-semibold text-slate-900 outline-none transition hover:text-primary dark:text-slate-100">
                        Página {source.chunk.pageNumber}
                      </summary>
                      <p className="border-t border-slate-100 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                        {source.excerpt}
                      </p>
                    </details>
                  ))
                ) : (
                  <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    Aquí aparecerán las páginas citadas después de cada
                    respuesta.
                  </p>
                )}
              </div>
            </section>

            {/* Document status */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {statusLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : status?.ready ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <h2 className="font-semibold">Documento</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {status?.ready
                      ? "Contrato listo para consultas con citas."
                      : "Falta revisar el PDF o regenerar el índice."}
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
