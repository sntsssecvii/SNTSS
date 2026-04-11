import { rebuildContractIndex } from '@/lib/contract-chat'

async function main() {
  const index = await rebuildContractIndex()

  console.log('Indice del contrato reconstruido.')
  console.log(`PDF: ${index.contractPath}`)
  console.log(`Paginas: ${index.pageCount}`)
  console.log(`Chunks: ${index.chunkCount}`)
  console.log(`Vocabulario: ${index.vocabularySize}`)
  console.log(`Generado: ${index.builtAt}`)
}

main().catch((error) => {
  console.error('No se pudo reconstruir el indice del contrato.', error)
  process.exitCode = 1
})
