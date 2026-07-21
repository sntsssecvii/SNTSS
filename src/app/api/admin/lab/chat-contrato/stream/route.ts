import { NextRequest, NextResponse } from "next/server";

import { createGroqStream, searchContractSources } from "@/lib/contract-chat";
import { getCachedAnswer, setCachedAnswer } from "@/lib/firebase/chat-cache";
import { requireSuperAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const startMs = Date.now();
    assertSameOrigin(request);
    enforceRateLimit(request, {
      bucket: "api:admin:lab:chat-contrato:stream",
      limit: 30,
      windowMs: 60_000,
    });
    const ctx = await requireSuperAdminRequest(request);
    enforceRateLimit(request, {
      bucket: `api:chat-contrato:user:${ctx.uid}`,
      limit: 10,
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      query?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    const query = (body.query || "").trim();
    if (!query) {
      return NextResponse.json(
        { error: "Escribe una pregunta." },
        { status: 400 },
      );
    }

    const history = (body.history || [])
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0,
      )
      .slice(-10);
    if (
      history.at(-1)?.role === "user" &&
      history.at(-1)?.content.trim().toLowerCase() === query.toLowerCase()
    ) {
      history.pop();
    }

    // Check cache for non-conversational queries
    if (history.length === 0 && query.length >= 5) {
      const cached = await getCachedAnswer(query);
      if (cached) {
        // Return cached answer as a single SSE event
        const encoder = new TextEncoder();
        const cacheStream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  sources: cached.sources,
                  cached: true,
                })}\n\n`,
              ),
            );
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: cached.answer })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });

        console.log(
          JSON.stringify({
            event: "chat-contrato-query",
            query: query.slice(0, 100),
            totalMs: Date.now() - startMs,
            retrievalMs: 0,
            sourceCount: 0,
            isConversational: false,
            hasStructureAnswer: false,
            cached: true,
          }),
        );
        return new Response(cacheStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
    }

    // Search for sources
    const { sources, isConversational, structureAnswer, tabuladorContext } =
      await searchContractSources(query, history);
    const retrievalMs = Date.now() - startMs;

    // Respuesta directa sobre estructura del contrato (sin LLM)
    if (structureAnswer) {
      const encoder = new TextEncoder();
      const structStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ sources: [] })}\n\n`),
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ text: structureAnswer })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      console.log(
        JSON.stringify({
          event: "chat-contrato-query",
          query: query.slice(0, 100),
          totalMs: Date.now() - startMs,
          retrievalMs: 0,
          sourceCount: 0,
          isConversational: false,
          hasStructureAnswer: true,
          cached: false,
        }),
      );
      return new Response(structStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    if (isConversational) {
      // Use LLM for conversational responses too — feels natural
      const convStream = createGroqStream(
        query,
        [], // no sources needed
        history,
      );

      if (convStream) {
        const encoder = new TextEncoder();
        const wrappedStream = new ReadableStream({
          async start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ sources: [], conversational: true })}\n\n`,
              ),
            );
            const reader = convStream.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
            } finally {
              reader.releaseLock();
            }
            controller.close();
          },
        });

        console.log(
          JSON.stringify({
            event: "chat-contrato-query",
            query: query.slice(0, 100),
            totalMs: Date.now() - startMs,
            retrievalMs,
            sourceCount: 0,
            isConversational: true,
            hasStructureAnswer: false,
            cached: false,
          }),
        );
        return new Response(wrappedStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
    }

    // Send sources first, then stream the LLM response
    const groqStream = createGroqStream(
      query,
      sources,
      history,
      tabuladorContext,
    );

    if (!groqStream) {
      return NextResponse.json(
        { error: "LLM no disponible." },
        { status: 503 },
      );
    }

    // Prepend sources metadata to the stream
    const encoder = new TextEncoder();
    const sourceMeta = sources.map((s) => ({
      pageNumber: s.chunk.pageNumber,
      clauseNumber: s.chunk.clauseNumber,
      clauseTitle: s.chunk.clauseTitle,
      excerpt: s.excerpt,
      score: s.score,
    }));

    const combinedStream = new ReadableStream({
      async start(controller) {
        // Send sources first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ sources: sourceMeta })}\n\n`,
          ),
        );

        // Pipe Groq stream
        const reader = groqStream.getReader();
        let fullAnswer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Capture text for caching
            const text = new TextDecoder().decode(value);
            const textMatch = text.match(/"text":"([^"]*)"/g);
            if (textMatch) {
              for (const m of textMatch) {
                const parsed = JSON.parse(`{${m}}`);
                fullAnswer += parsed.text;
              }
            }

            controller.enqueue(value);
          }
        } finally {
          reader.releaseLock();
        }

        // Cache the answer
        if (
          history.length === 0 &&
          fullAnswer.length > 20 &&
          sources.length > 0
        ) {
          setCachedAnswer(query, fullAnswer, sourceMeta).catch((e) =>
            console.error("Error caching streamed answer:", e),
          );
        }

        controller.close();
      },
    });

    console.log(
      JSON.stringify({
        event: "chat-contrato-query",
        query: query.slice(0, 100),
        totalMs: Date.now() - startMs,
        retrievalMs,
        sourceCount: sources?.length ?? 0,
        isConversational,
        hasStructureAnswer: false,
        cached: false,
      }),
    );
    return new Response(combinedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: error?.message || "Error en streaming." },
      { status: 500 },
    );
  }
}
