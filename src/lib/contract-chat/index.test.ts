import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  answerContractQuestion,
  getContractChatStatus,
  searchContractSources,
} from "@/lib/contract-chat";

describe("contract-chat", { timeout: 120_000 }, () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        text: async () => "rate limited in test",
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rechaza preguntas vacías con error controlado", async () => {
    await expect(answerContractQuestion("   ")).rejects.toThrow(
      "QUERY_REQUIRED",
    );
  });

  it("expone diagnóstico del PDF, índice y modo de respuesta", async () => {
    const status = await getContractChatStatus();

    expect(status.pdf.fileName).toBe(
      "contrato-colectivo-de-trabajo-2025-2027.pdf",
    );
    expect(typeof status.pdf.exists).toBe("boolean");
    expect(typeof status.index.exists).toBe("boolean");
    expect(status.llm.provider).toBe("groq");
    expect(typeof status.llm.configured).toBe("boolean");
    expect(typeof status.ready).toBe("boolean");
  });

  it("responde saludos con orientación en vez de buscar en el PDF", async () => {
    const answer = await answerContractQuestion("hola");

    expect(answer.sourceCount).toBe(0);
    expect(answer.answer).toContain("asistente");
    expect(answer.answer).toContain("vacaciones");
  });

  it("recupera fuentes para preguntas naturales sobre vacaciones", async () => {
    const answer = await answerContractQuestion(
      "¿Cuántos días de vacaciones me tocan?",
    );

    expect(answer.sourceCount).toBeGreaterThan(0);
    expect(
      answer.sources.some((source) =>
        source.matchedTerms.includes("vacaciones"),
      ),
    ).toBe(true);
  });

  it("acepta historial conversacional sin errores", async () => {
    const answer = await answerContractQuestion(
      "¿Y sobre permisos económicos?",
      [
        { role: "user", content: "¿Qué dice sobre vacaciones?" },
        { role: "assistant", content: "El contrato establece..." },
      ],
    );

    expect(answer.query).toBe("¿Y sobre permisos económicos?");
    expect(answer.diagnostics.chunkCount).toBeGreaterThan(0);
  });

  describe("detección conversacional vs contractual", () => {
    it("clasifica saludos como conversación (0 sources)", async () => {
      const r = await searchContractSources("Hola, buenos días");
      expect(r.isConversational).toBe(true);
      expect(r.sources.length).toBe(0);
    });

    it("clasifica agradecimientos como conversación", async () => {
      const r = await searchContractSources("Gracias, muy amable");
      expect(r.isConversational).toBe(true);
    });

    it("consulta laboral corta NO es conversación", async () => {
      const r = await searchContractSources("¿Puedo faltar mañana?");
      expect(r.isConversational).toBe(false);
      expect(r.sources.length).toBeGreaterThan(0);
    });

    it("consulta laboral ambigua NO es conversación", async () => {
      const r = await searchContractSources(
        "¿Puedo faltar sin que me descuenten?",
      );
      expect(r.isConversational).toBe(false);
      expect(r.sources.length).toBeGreaterThan(0);
    });

    it("consulta corta de sueldo NO es conversación", async () => {
      const r = await searchContractSources("¿Cuánto gano?");
      expect(r.isConversational).toBe(false);
      expect(r.sources.length).toBeGreaterThan(0);
    });

    it("pregunta externa al CCT marca evidencia insufficient", async () => {
      const r = await searchContractSources(
        "¿Cómo saco mi constancia de situación fiscal del SAT?",
      );
      expect(r.trace?.sufficiency.status).toBe("insufficient");
    });
  });

  it("contextualiza un seguimiento antes de recuperar evidencia", async () => {
    const result = await searchContractSources("¿Ley 73 o Ley 97?", [
      {
        role: "user",
        content: "¿Cuántos años necesito para jubilarme del IMSS?",
      },
      {
        role: "assistant",
        content: "Hay que revisar el régimen aplicable.",
      },
    ]);

    expect(result.trace?.originalQuery).toBe("¿Ley 73 o Ley 97?");
    expect(result.trace?.contextualizationMode).toBe("fallback");
    expect(result.trace?.contextualizedQuery).toContain("jubilarme");
    expect(result.trace?.candidates.length).toBeGreaterThan(0);
    expect(result.trace?.selected.length).toBeGreaterThan(0);
    expect(result.trace?.evidence.length).toBeGreaterThan(0);
    expect(result.trace?.sufficiency.reason.length).toBeGreaterThan(10);
  });
});
