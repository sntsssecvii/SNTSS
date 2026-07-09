/**
 * Genera embeddings semánticos para cada prestación del contrato.
 * Permite enganchar la data estructurada por SIGNIFICADO en vez de por
 * palabras clave (evita mantener listas de sinónimos/typos).
 *
 * Uso:
 *   JINA_API_KEY=xxx npx tsx scripts/ops/embed-prestaciones.ts
 */

import fs from "fs";
import path from "path";

const PRESTACIONES_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "prestaciones-data.json",
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "prestaciones-embeddings.json",
);
const JINA_MODEL = "jina-embeddings-v3";

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

interface PrestacionEntry {
  nombre: string;
  clausula: string;
  pagina: number | string;
  descripcion: string;
  aplica: string;
}

async function main() {
  const apiKey = getJinaApiKey();

  if (!fs.existsSync(PRESTACIONES_PATH)) {
    console.error("No existe prestaciones-data.json");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(PRESTACIONES_PATH, "utf8"));
  const prestaciones = data.prestaciones as PrestacionEntry[];

  console.log(`Prestaciones a embeddear: ${prestaciones.length}`);

  // Texto rico por prestación: nombre + descripción + a quién aplica.
  // Así el vector captura el significado completo, no solo el título.
  const texts = prestaciones.map(
    (p) => `${p.nombre}. ${p.descripcion} Aplica a: ${p.aplica}.`,
  );

  const embeddings = await jinaEmbed(texts, apiKey);

  const output = {
    generatedAt: new Date().toISOString(),
    total: prestaciones.length,
    embeddingDim: embeddings[0]?.length || 0,
    entries: prestaciones.map((p, i) => ({
      nombre: p.nombre,
      embedding: embeddings[i],
    })),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output), "utf8");

  const fileSize = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(0);
  console.log(`\nListo. ${prestaciones.length} prestaciones embeddedas.`);
  console.log(`Dimensión: ${embeddings[0]?.length || 0}`);
  console.log(`Archivo: ${OUTPUT_PATH} (${fileSize} KB)`);
}

main().catch((e) => {
  console.error("Error fatal:", e.message);
  process.exit(1);
});
