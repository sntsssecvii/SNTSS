/**
 * Reindexación del CCT con metadatos estructurales (v2).
 *
 * Genera un nuevo índice en artifacts/contract-chat/contrato-2025-2027-index-v2.json
 * y ejecuta validaciones sin sobrescribir el índice vigente.
 *
 * Uso: npx tsx scripts/ops/reindex-contract-v2.ts
 */
import fs from "fs";
import path from "path";

// The live index is at src/lib/contract-chat/contract-index-data.json
const CONTRACT_INDEX_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-chat",
  "contract-index-data.json",
);
const V2_INDEX_PATH = path.join(
  process.cwd(),
  "artifacts",
  "contract-chat",
  "contrato-2025-2027-index-v2.json",
);

async function main() {
  console.log("=== Reindexación del CCT con metadatos v2 ===\n");

  // Temporarily rename current index so buildContractIndex runs fresh
  const backupPath = CONTRACT_INDEX_PATH + ".bak";
  const hadExisting = fs.existsSync(CONTRACT_INDEX_PATH);
  if (hadExisting) {
    fs.renameSync(CONTRACT_INDEX_PATH, backupPath);
  }

  try {
    // Dynamic import and force rebuild
    const mod = await import("@/lib/contract-chat");
    console.log("Forzando reconstrucción del índice...");
    await mod.rebuildContractIndex();

    // Read the freshly built index
    if (!fs.existsSync(CONTRACT_INDEX_PATH)) {
      console.error("ERROR: No se generó el índice nuevo.");
      return;
    }

    const newIndex = JSON.parse(fs.readFileSync(CONTRACT_INDEX_PATH, "utf8"));

    // Copy to v2 path
    fs.writeFileSync(V2_INDEX_PATH, JSON.stringify(newIndex), "utf8");
    console.log(`\nÍndice v2 guardado en: ${V2_INDEX_PATH}`);

    // --- Validations ---
    console.log("\n=== VALIDACIONES ===\n");

    // 1. Chunk count
    console.log(`Total chunks: ${newIndex.chunkCount}`);

    // 2. Clauses detected
    const clauseChunks = newIndex.chunks.filter(
      (c: { clauseNumber?: number }) => c.clauseNumber,
    );
    const uniqueClauses = [
      ...new Set(
        clauseChunks.map((c: { clauseNumber: number }) => c.clauseNumber),
      ),
    ].sort((a, b) => (a as number) - (b as number));
    console.log(`Cláusulas detectadas: ${uniqueClauses.length}`);
    console.log(
      `  Rango: ${uniqueClauses[0]} - ${uniqueClauses[uniqueClauses.length - 1]}`,
    );

    // 3. Articles detected
    const articleChunks = newIndex.chunks.filter(
      (c: { articleNumber?: number }) => c.articleNumber,
    );
    const uniqueArticles = [
      ...new Set(
        articleChunks.map(
          (c: { articleNumber: number; sectionNumber: number }) =>
            `s${c.sectionNumber}-art${c.articleNumber}`,
        ),
      ),
    ];
    console.log(`Artículos detectados: ${uniqueArticles.length}`);

    // 4. Clause continuity — check multi-chunk clauses
    const clauseGroups = new Map<number, number>();
    for (const c of clauseChunks) {
      clauseGroups.set(
        c.clauseNumber,
        (clauseGroups.get(c.clauseNumber) || 0) + 1,
      );
    }
    const multiChunkClauses = [...clauseGroups.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);
    console.log(`Cláusulas con múltiples chunks: ${multiChunkClauses.length}`);
    console.log(
      `  Top 5: ${multiChunkClauses
        .slice(0, 5)
        .map(([clause, count]) => `cl.${clause}(${count})`)
        .join(", ")}`,
    );

    // 5. Sections detected
    const sectionTitles = [
      ...new Set(
        newIndex.chunks
          .filter((c: { sectionTitle?: string }) => c.sectionTitle)
          .map((c: { sectionTitle: string }) => c.sectionTitle),
      ),
    ];
    console.log(`Secciones: ${sectionTitles.length}`);
    for (const title of sectionTitles) {
      const count = newIndex.chunks.filter(
        (c: { sectionTitle?: string }) => c.sectionTitle === title,
      ).length;
      console.log(`  ${title}: ${count} chunks`);
    }

    // 6. Chunks without metadata
    const noMeta = newIndex.chunks.filter(
      (c: {
        clauseNumber?: number;
        articleNumber?: number;
        documentType?: string;
      }) => !c.clauseNumber && !c.articleNumber && !c.documentType,
    );
    console.log(`Chunks sin metadatos: ${noMeta.length}`);

    // 7. Content types
    const contentTypes = new Map<string, number>();
    for (const c of newIndex.chunks) {
      const ct = c.contentType || "unclassified";
      contentTypes.set(ct, (contentTypes.get(ct) || 0) + 1);
    }
    console.log(`\nDistribución de contentType:`);
    for (const [type, count] of [...contentTypes.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(
        `  ${type}: ${count} (${((count / newIndex.chunkCount) * 100).toFixed(1)}%)`,
      );
    }

    // 8. Check for clause contamination (clause N appearing in wrong page range)
    let contamination = 0;
    for (const c of clauseChunks) {
      if (c.clauseNumber <= 157 && c.pageNumber > 88) {
        contamination++;
      }
    }
    console.log(
      `\nContaminación cláusula/página: ${contamination} chunks con cláusula 1-157 fuera de p.9-88`,
    );

    // Compare with old index
    if (hadExisting) {
      const oldIndex = JSON.parse(fs.readFileSync(backupPath, "utf8"));
      const oldChunks = oldIndex.chunkCount;
      const diff = newIndex.chunkCount - oldChunks;
      console.log(
        `\nComparación con índice anterior: ${oldChunks} → ${newIndex.chunkCount} (${diff > 0 ? "+" : ""}${diff})`,
      );
    }

    console.log("\n=== Validación completa ===");
  } finally {
    // Restore original index
    if (hadExisting && fs.existsSync(backupPath)) {
      // Remove the freshly built one, restore backup
      if (fs.existsSync(CONTRACT_INDEX_PATH)) {
        fs.unlinkSync(CONTRACT_INDEX_PATH);
      }
      fs.renameSync(backupPath, CONTRACT_INDEX_PATH);
      console.log("\nÍndice original restaurado.");
    }
  }
}

main().catch((error) => {
  console.error(error);
  // Restore backup if it exists
  const backupPath = CONTRACT_INDEX_PATH + ".bak";
  if (fs.existsSync(backupPath) && !fs.existsSync(CONTRACT_INDEX_PATH)) {
    fs.renameSync(backupPath, CONTRACT_INDEX_PATH);
  }
  process.exitCode = 1;
});
