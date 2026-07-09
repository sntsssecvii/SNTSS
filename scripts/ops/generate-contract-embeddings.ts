/**
 * Genera embeddings para el índice del contrato colectivo usando Jina AI.
 *
 * Uso:
 *   JINA_API_KEY=xxx npx tsx scripts/ops/generate-contract-embeddings.ts
 *
 * Si el índice ya tiene embeddings, no hace nada (usar --force para regenerar).
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
const JINA_MODEL = "jina-embeddings-v3";
const BATCH_SIZE = 100;
const force = process.argv.includes("--force");

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
  const apiKey =
    process.env.JINA_API_KEY ||
    (() => {
      const envPath = path.join(process.cwd(), ".env.local");
      if (!fs.existsSync(envPath)) return null;
      const match = fs
        .readFileSync(envPath, "utf8")
        .match(/^JINA_API_KEY=(.+)$/m);
      return match?.[1]?.trim() || null;
    })();

  if (!apiKey) {
    console.error("Falta JINA_API_KEY en env.");
    process.exit(1);
  }

  if (!fs.existsSync(INDEX_PATH)) {
    console.error(
      "No existe el índice. Corre el chatbot primero para generar el índice base.",
    );
    process.exit(1);
  }

  const index: ContractIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));

  const withEmbeddings = index.chunks.filter((c) => c.embedding?.length).length;

  if (withEmbeddings === index.chunks.length && !force) {
    console.log(
      `Todos los ${index.chunks.length} chunks ya tienen embeddings. Usa --force para regenerar.`,
    );
    process.exit(0);
  }

  // Always regenerate all with Jina (different model = different dimensions)
  const pending = index.chunks.map((_, i) => i);
  const total = pending.length;
  const totalBatches = Math.ceil(total / BATCH_SIZE);

  console.log(`Total chunks: ${total}`);
  console.log(`Batches: ${totalBatches}`);
  console.log();

  let processed = 0;

  for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
    const batchIndices = pending.slice(batchStart, batchStart + BATCH_SIZE);
    const batchTexts = batchIndices.map((i) => index.chunks[i].text);
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const embeddings = await jinaEmbed(batchTexts, apiKey);
        for (let j = 0; j < batchIndices.length; j++) {
          index.chunks[batchIndices[j]].embedding = embeddings[j];
        }
        processed += batchIndices.length;
        console.log(
          `Batch ${batchNum}/${totalBatches} — ${processed}/${total} chunks`,
        );
        break;
      } catch (error: any) {
        if (error?.message?.includes("429") && attempt < 2) {
          console.log(`  Rate limited, esperando 60s...`);
          await new Promise((r) => setTimeout(r, 60_000));
        } else {
          throw error;
        }
      }
    }

    // Delay between batches to stay under 100K tokens/min
    if (batchStart + BATCH_SIZE < total) {
      await new Promise((r) => setTimeout(r, 15_000));
    }
  }

  index.hasEmbeddings = true;
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index), "utf8");

  const fileSize = (fs.statSync(INDEX_PATH).size / 1024 / 1024).toFixed(1);
  console.log(`\nListo. Index guardado (${fileSize} MB).`);
  console.log(
    `Chunks: ${index.chunkCount} | Embeddings: ${index.hasEmbeddings}`,
  );
  console.log(`Dimensión: ${index.chunks[0]?.embedding?.length || 0}`);
}

main().catch((e) => {
  console.error("Error fatal:", e.message);
  process.exit(1);
});
