import fs from "fs";
import path from "path";

import {
  JINA_BATCH_SIZE,
  JINA_EMBEDDING_MODEL,
} from "@/lib/contract-chat/constants";

// ---------------------------------------------------------------------------
// Local env helper
// ---------------------------------------------------------------------------

export function readLocalEnvValue(filePath: string, key: string) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!trimmed.startsWith(`${key}=`)) continue;
    return trimmed.slice(key.length + 1).trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Embeddings — Jina AI (jina-embeddings-v3)
// ---------------------------------------------------------------------------

function getJinaApiKey() {
  return (
    process.env.JINA_API_KEY ||
    readLocalEnvValue(path.join(process.cwd(), ".env.local"), "JINA_API_KEY") ||
    null
  );
}

async function jinaEmbed(
  texts: string[],
  task: "retrieval.passage" | "retrieval.query",
  apiKey: string,
): Promise<number[][]> {
  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JINA_EMBEDDING_MODEL,
      input: texts,
      task,
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

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = getJinaApiKey();
  if (!apiKey) {
    throw new Error(
      "JINA_API_KEY no configurada. Se requiere para generar embeddings.",
    );
  }

  const allEmbeddings: number[][] = [];
  const totalBatches = Math.ceil(texts.length / JINA_BATCH_SIZE);

  for (let i = 0; i < texts.length; i += JINA_BATCH_SIZE) {
    const batch = texts.slice(i, i + JINA_BATCH_SIZE);
    const batchNum = Math.floor(i / JINA_BATCH_SIZE) + 1;

    const embeddings = await jinaEmbed(batch, "retrieval.passage", apiKey);
    allEmbeddings.push(...embeddings);

    if (batchNum % 5 === 0 || batchNum === totalBatches) {
      console.log(`  Embeddings: ${batchNum}/${totalBatches} batches`);
    }
  }

  return allEmbeddings;
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const apiKey = getJinaApiKey();
  if (!apiKey) return [];

  const [embedding] = await jinaEmbed([query], "retrieval.query", apiKey);
  return embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
