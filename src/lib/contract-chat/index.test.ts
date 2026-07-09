import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  answerContractQuestion,
  getContractChatStatus,
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
});
