/**
 * Genera embeddings para las preguntas FAQ del contrato.
 *
 * Uso:
 *   JINA_API_KEY=xxx npx tsx scripts/ops/embed-faqs.ts
 */

import fs from "fs";
import path from "path";

const FAQ_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "contract-faqs.json",
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "contract-faqs-embeddings.json",
);
const JINA_MODEL = "jina-embeddings-v3";
const BATCH_SIZE = 100;

function getJinaApiKey(): string {
  const key =
    process.env.JINA_API_KEY ||
    (() => {
      const p = path.join(process.cwd(), ".env.local");
      if (!fs.existsSync(p)) return null;
      const match = fs.readFileSync(p, "utf8").match(/^JINA_API_KEY=(.+)$/m);
      return match?.[1]?.trim() || null;
    })();
  if (!key) {
    console.error("Falta JINA_API_KEY");
    process.exit(1);
  }
  return key;
}

async function jinaEmbed(texts: string[], apiKey: string): Promise<number[][]> {
  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      input: texts,
      task: "retrieval.passage",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jina HTTP ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return payload.data.map((d) => d.embedding);
}

async function main() {
  const apiKey = getJinaApiKey();

  if (!fs.existsSync(FAQ_PATH)) {
    console.error(
      "No existe el archivo de FAQs. Corre generate-contract-faqs.ts primero.",
    );
    process.exit(1);
  }

  const faqData = JSON.parse(fs.readFileSync(FAQ_PATH, "utf8"));
  const faqs = faqData.faqs as Array<{
    question: string;
    answer: string;
    chunkId: string;
    pageNumber: number;
    clauseNumber?: number;
    clauseTitle?: string;
  }>;

  console.log(`FAQs a embeddear: ${faqs.length}`);

  const questions = faqs.map((f) => f.question);
  const allEmbeddings: number[][] = [];
  const totalBatches = Math.ceil(questions.length / BATCH_SIZE);

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const embeddings = await jinaEmbed(batch, apiKey);
        allEmbeddings.push(...embeddings);
        console.log(
          `Batch ${batchNum}/${totalBatches} — ${allEmbeddings.length}/${questions.length}`,
        );
        break;
      } catch (error: any) {
        if (error?.message?.includes("429") && attempt < 2) {
          console.log("  Rate limited, esperando 60s...");
          await new Promise((r) => setTimeout(r, 60_000));
        } else {
          throw error;
        }
      }
    }

    if (i + BATCH_SIZE < questions.length) {
      await new Promise((r) => setTimeout(r, 15_000));
    }
  }

  // Build output: FAQ entries with embeddings
  const output = {
    generatedAt: new Date().toISOString(),
    totalFaqs: faqs.length,
    embeddingDim: allEmbeddings[0]?.length || 0,
    entries: faqs.map((f, i) => ({
      question: f.question,
      answer: f.answer,
      chunkId: f.chunkId,
      pageNumber: f.pageNumber,
      clauseNumber: f.clauseNumber,
      clauseTitle: f.clauseTitle,
      embedding: allEmbeddings[i],
    })),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output), "utf8");

  const fileSize = (fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(1);
  console.log(`\nListo. ${faqs.length} FAQs embeddedas.`);
  console.log(`Dimensión: ${allEmbeddings[0]?.length || 0}`);
  console.log(`Archivo: ${OUTPUT_PATH} (${fileSize} MB)`);
}

main().catch((e) => {
  console.error("Error fatal:", e.message);
  process.exit(1);
});
