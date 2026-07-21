/**
 * Validates a contract index candidate before activation.
 *
 * Usage:
 *   npx tsx scripts/ops/validate-contract-index.ts [path-to-candidate]
 *
 * If no path given, validates the active index.
 *
 * Exit code 0 = valid, 1 = invalid.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";

import type { ContractIndex } from "@/lib/contract-chat/types";

const ACTIVE_INDEX_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "contract-index-data.json",
);
const PDF_PATH = path.join(
  process.cwd(),
  "artifacts",
  "contrato-colectivo-de-trabajo-2025-2027.pdf",
);

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: Record<string, unknown>;
}

function validateIndex(indexPath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: Record<string, unknown> = {};

  if (!fs.existsSync(indexPath)) {
    return {
      valid: false,
      errors: ["Index file not found: " + indexPath],
      warnings,
      stats,
    };
  }

  const raw = fs.readFileSync(indexPath, "utf8");
  let idx: ContractIndex;
  try {
    idx = JSON.parse(raw) as ContractIndex;
  } catch {
    return { valid: false, errors: ["Invalid JSON"], warnings, stats };
  }

  stats.chunkCount = idx.chunkCount;
  stats.schemaVersion = idx.schemaVersion;
  stats.hasEmbeddings = idx.hasEmbeddings;
  stats.builtAt = idx.builtAt;
  stats.status = idx.status;

  // Chunk count bounds
  if (!idx.chunks || idx.chunks.length === 0) {
    errors.push("No chunks in index");
  } else if (idx.chunks.length !== idx.chunkCount) {
    errors.push(
      `chunkCount mismatch: field=${idx.chunkCount} actual=${idx.chunks.length}`,
    );
  }
  if (idx.chunkCount < 1000 || idx.chunkCount > 3000) {
    warnings.push(`Unusual chunk count: ${idx.chunkCount}`);
  }

  // Source hash
  if (fs.existsSync(PDF_PATH)) {
    const pdfHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(PDF_PATH))
      .digest("hex");
    stats.sourceHash = idx.sourceHash?.slice(0, 16);
    stats.pdfHash = pdfHash.slice(0, 16);
    if (idx.sourceHash && idx.sourceHash !== pdfHash) {
      errors.push("sourceHash does not match current PDF");
    }
  }

  // Embeddings
  const withEmbedding = idx.chunks.filter(
    (c) => c.embedding && c.embedding.length > 0,
  );
  stats.chunksWithEmbeddings = withEmbedding.length;
  stats.embeddingCoverage = `${withEmbedding.length}/${idx.chunkCount}`;

  if (idx.hasEmbeddings && withEmbedding.length < idx.chunkCount * 0.95) {
    errors.push(
      `hasEmbeddings=true but only ${withEmbedding.length}/${idx.chunkCount} have embeddings`,
    );
  }

  // Embedding dimensions
  const wrongDim = withEmbedding.filter((c) => c.embedding!.length !== 1024);
  if (wrongDim.length > 0) {
    errors.push(`${wrongDim.length} chunks with wrong embedding dimension`);
  }

  // NaN/Infinity check (sample first 100)
  const sample = withEmbedding.slice(0, 100);
  const invalidValues = sample.filter((c) =>
    c.embedding!.some((v) => !Number.isFinite(v)),
  );
  if (invalidValues.length > 0) {
    errors.push(
      `${invalidValues.length} chunks with NaN/Infinity in embeddings (sampled 100)`,
    );
  }

  // Metadata completeness
  const contractChunks = idx.chunks.filter(
    (c) => c.documentType === "contrato" || c.documentType === "transitorias",
  );
  const withClause = contractChunks.filter((c) => c.clauseNumber);
  stats.contractChunksWithClause = `${withClause.length}/${contractChunks.length}`;
  if (
    contractChunks.length > 0 &&
    withClause.length < contractChunks.length * 0.8
  ) {
    warnings.push(
      `Low clause coverage in contract: ${withClause.length}/${contractChunks.length}`,
    );
  }

  const reglChunks = idx.chunks.filter(
    (c) => c.documentType === "reglamento" || c.documentType === "convenio",
  );
  const withArticle = reglChunks.filter((c) => c.articleNumber);
  stats.reglChunksWithArticle = `${withArticle.length}/${reglChunks.length}`;

  const withSection = idx.chunks.filter((c) => c.sectionTitle);
  stats.chunksWithSection = `${withSection.length}/${idx.chunkCount}`;
  if (withSection.length < idx.chunkCount * 0.9) {
    warnings.push(
      `Low section coverage: ${withSection.length}/${idx.chunkCount}`,
    );
  }

  const withContentType = idx.chunks.filter((c) => c.contentType);
  stats.chunksWithContentType = `${withContentType.length}/${idx.chunkCount}`;

  // Manifest fields
  if (!idx.schemaVersion) warnings.push("Missing schemaVersion");
  if (!idx.sourceHash) warnings.push("Missing sourceHash");
  if (!idx.embeddingModel) warnings.push("Missing embeddingModel");

  return { valid: errors.length === 0, errors, warnings, stats };
}

function main() {
  const targetPath = process.argv[2] || ACTIVE_INDEX_PATH;
  console.log(`=== Validación de índice: ${path.basename(targetPath)} ===\n`);

  const result = validateIndex(targetPath);

  console.log("Stats:", JSON.stringify(result.stats, null, 2));

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    result.warnings.forEach((w) => console.log("  ⚠", w));
  }

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    result.errors.forEach((e) => console.log("  ✗", e));
    console.log("\nResult: INVALID");
    process.exitCode = 1;
  } else {
    console.log("\nResult: VALID");
  }
}

main();
