# Contract Chat Index — Source of Truth

## Locations

| Role       | Path                                                       | Description                                                       |
| ---------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| **Active** | `src/lib/contract-chat/contract-index-data.json`           | Production index. Loaded by `getContractIndex()`.                 |
| Candidate  | `artifacts/contract-chat/contrato-2025-2027-index-v2.json` | Built by reindex script, not active until validated and promoted. |
| Backup     | `artifacts/contract-chat/contrato-2025-2027-index.json`    | Previous index snapshot for rollback.                             |
| PDF source | `artifacts/contrato-colectivo-de-trabajo-2025-2027.pdf`    | Source document. Hash verified against `sourceHash` in manifest.  |

## Commands

```bash
# Validate active index
npx tsx scripts/ops/validate-contract-index.ts

# Validate a candidate
npx tsx scripts/ops/validate-contract-index.ts artifacts/contract-chat/contrato-2025-2027-index-v2.json

# Rebuild index (generates candidate, replaces active — use with care)
npx tsx scripts/ops/reindex-contract-v2.ts

# Run retrieval evaluation (40 cases)
npx tsx scripts/tests/evaluate-contract-chat.ts

# Run unit tests
npx vitest run src/lib/contract-chat/index.test.ts
```

## Activation procedure

1. Generate candidate: `npx tsx scripts/ops/reindex-contract-v2.ts`
2. Validate candidate: `npx tsx scripts/ops/validate-contract-index.ts <candidate-path>`
3. Run evaluation against candidate (modify script to point at candidate)
4. If valid + no regression: copy candidate to `src/lib/contract-chat/contract-index-data.json`
5. Run `npm run check` + `npx vitest run src/lib/contract-chat/`

## Rollback

```bash
cp artifacts/contract-chat/contrato-2025-2027-index.json src/lib/contract-chat/contract-index-data.json
```

## Manifest (schema v2)

The active index includes:

- `schemaVersion: 2`
- `sourceHash` — SHA-256 of source PDF
- `embeddingProvider` / `embeddingModel` / `embeddingDimensions`
- `chunksWithEmbeddings` — must equal `chunkCount`
- `metadataEnriched` — structural metadata present
- `status` — "active" | "candidate" | "validated" | "backup"
- `hasEmbeddings` — explicitly computed, not inferred

## Guard rails

- `loadPersistedContractIndex()` validates chunk count and embedding coverage before accepting
- If `hasEmbeddings=true` but <90% chunks have embeddings, index is rejected
- Files in `artifacts/` are reports/backups — never loaded as active by the runtime
- The runtime only reads from `CONTRACT_INDEX_PATH` (`src/lib/contract-chat/contract-index-data.json`)
