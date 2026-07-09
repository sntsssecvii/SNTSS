/**
 * Genera FAQs automáticas del contrato colectivo usando LLM.
 *
 * Lee cada chunk del índice, envía al LLM para generar Q&A pairs,
 * y guarda todo en un JSON que el chatbot usa para respuestas instantáneas.
 *
 * Uso:
 *   GROQ_API_KEY=xxx npx tsx scripts/ops/generate-contract-faqs.ts
 *
 * Flags:
 *   --resume    Continuar desde donde se quedó (si hay progreso parcial)
 *   --force     Regenerar todo desde cero
 */

import fs from "fs";
import path from "path";

import type { ContractIndex } from "@/lib/contract-chat/types";

const INDEX_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "contract-index-data.json",
);
const FAQ_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "contract-faqs.json",
);
const PROGRESS_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "faq-generation-progress.json",
);

const GROQ_MODEL = "llama-3.1-8b-instant";
const REQUESTS_PER_MINUTE = 25;
const DELAY_MS = Math.ceil(60_000 / REQUESTS_PER_MINUTE);

const forceFlag = process.argv.includes("--force");
const resumeFlag = process.argv.includes("--resume");

interface FaqEntry {
  question: string;
  answer: string;
  clauseNumber?: number;
  clauseTitle?: string;
  chapterTitle?: string;
  pageNumber: number;
  chunkId: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getGroqApiKey(): string {
  const key =
    process.env.GROQ_API_KEY ||
    (() => {
      for (const envFile of [".env.groq.local", ".env.local"]) {
        const p = path.join(process.cwd(), envFile);
        if (!fs.existsSync(p)) continue;
        const match = fs.readFileSync(p, "utf8").match(/^GROQ_API_KEY=(.+)$/m);
        if (match) return match[1].trim();
      }
      return null;
    })();
  if (!key) {
    console.error("Falta GROQ_API_KEY");
    process.exit(1);
  }
  return key;
}

async function generateFaqsForChunk(
  chunkText: string,
  clauseNumber: number | undefined,
  clauseTitle: string | undefined,
  pageNumber: number,
  apiKey: string,
): Promise<Array<{ question: string; answer: string }>> {
  const clauseInfo = clauseNumber
    ? `Cláusula ${clauseNumber}${clauseTitle ? ` - ${clauseTitle}` : ""}`
    : `Sección del contrato (página ${pageNumber})`;

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: `Eres un generador de preguntas frecuentes para trabajadores del IMSS sobre su contrato colectivo.

INSTRUCCIONES:
- Genera entre 2 y 5 preguntas que un trabajador haría sobre el texto proporcionado
- Las preguntas deben ser en lenguaje natural, como las haría un trabajador común
- Las respuestas deben ser concisas, precisas y basadas SOLO en el texto
- Incluye datos específicos: montos, plazos, porcentajes, requisitos
- Varía el estilo: preguntas con "¿Qué...?", "¿Cuánto...?", "¿Cuándo...?", "¿Quién...?", "¿Cómo...?", "¿Tengo derecho a...?"
- No inventes datos que no estén en el texto

FORMATO: Responde SOLO en JSON válido, sin markdown:
[{"question": "...", "answer": "..."}]`,
          },
          {
            role: "user",
            content: `${clauseInfo} (página ${pageNumber}):\n\n${chunkText.slice(0, 2000)}`,
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    throw new Error(`GROQ_HTTP_${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) return [];

  try {
    // Extract JSON from response (might have extra text)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      question: string;
      answer: string;
    }>;
    return parsed.filter(
      (item) =>
        item.question &&
        item.answer &&
        item.question.length > 10 &&
        item.answer.length > 10,
    );
  } catch {
    return [];
  }
}

async function main() {
  const apiKey = getGroqApiKey();

  if (!fs.existsSync(INDEX_PATH)) {
    console.error("No existe el índice del contrato.");
    process.exit(1);
  }

  const index: ContractIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));

  // Filter chunks worth generating FAQs for (skip very short or noisy ones)
  const usableChunks = index.chunks.filter(
    (c) =>
      c.text.length > 100 &&
      !c.text.match(/^(Índice|Contenido|A-Z|CONTRATO COLECTIVO DE TRABAJO)$/),
  );

  console.log(`Total chunks: ${index.chunkCount}`);
  console.log(`Chunks procesables: ${usableChunks.length}`);

  // Load progress if resuming
  let processedIds = new Set<string>();
  let allFaqs: FaqEntry[] = [];

  if (resumeFlag && !forceFlag && fs.existsSync(PROGRESS_PATH)) {
    const progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
    processedIds = new Set(progress.processedIds || []);
    allFaqs = progress.faqs || [];
    console.log(
      `Resumiendo: ${processedIds.size} chunks ya procesados, ${allFaqs.length} FAQs generadas`,
    );
  }

  const pending = usableChunks.filter((c) => !processedIds.has(c.id));
  console.log(`Pendientes: ${pending.length}`);
  console.log(`Modelo: ${GROQ_MODEL}`);
  console.log(`Rate: ~${REQUESTS_PER_MINUTE} req/min\n`);

  const t0 = Date.now();
  let generated = 0;
  let errors = 0;

  for (let i = 0; i < pending.length; i++) {
    const chunk = pending[i];

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const faqs = await generateFaqsForChunk(
          chunk.text,
          chunk.clauseNumber,
          chunk.clauseTitle,
          chunk.pageNumber,
          apiKey,
        );

        for (const faq of faqs) {
          allFaqs.push({
            question: faq.question,
            answer: faq.answer,
            clauseNumber: chunk.clauseNumber,
            clauseTitle: chunk.clauseTitle,
            chapterTitle: chunk.chapterTitle,
            pageNumber: chunk.pageNumber,
            chunkId: chunk.id,
          });
        }

        processedIds.add(chunk.id);
        generated += faqs.length;

        if ((i + 1) % 50 === 0 || i === pending.length - 1) {
          const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
          const pct = (((i + 1) / pending.length) * 100).toFixed(0);
          console.log(
            `  ${pct}% (${i + 1}/${pending.length}) — ${generated} FAQs — ${elapsed}min — ${errors} errores`,
          );

          // Save progress
          fs.writeFileSync(
            PROGRESS_PATH,
            JSON.stringify({
              processedIds: Array.from(processedIds),
              faqs: allFaqs,
            }),
          );
        }

        break;
      } catch (error: any) {
        if (error?.message === "RATE_LIMITED" && attempt < 2) {
          await sleep(30_000);
        } else {
          errors++;
          processedIds.add(chunk.id); // skip on failure
          break;
        }
      }
    }

    await sleep(DELAY_MS);
  }

  // Save final FAQ file
  const output = {
    generatedAt: new Date().toISOString(),
    model: GROQ_MODEL,
    totalChunksProcessed: processedIds.size,
    totalFaqs: allFaqs.length,
    errors,
    faqs: allFaqs,
  };

  fs.writeFileSync(FAQ_PATH, JSON.stringify(output, null, 2), "utf8");

  // Clean up progress file
  if (fs.existsSync(PROGRESS_PATH)) {
    fs.unlinkSync(PROGRESS_PATH);
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  const fileSize = (fs.statSync(FAQ_PATH).size / 1024 / 1024).toFixed(1);

  console.log(`\nListo en ${elapsed} minutos.`);
  console.log(`FAQs generadas: ${allFaqs.length}`);
  console.log(`Errores: ${errors}`);
  console.log(`Archivo: ${FAQ_PATH} (${fileSize} MB)`);
}

main().catch((e) => {
  console.error("Error fatal:", e.message);
  process.exit(1);
});
