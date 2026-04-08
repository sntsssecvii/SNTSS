import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

import type {
  ContractChatAnswer,
  ContractChunk,
  ContractIndex,
  ContractSearchResult,
} from '@/lib/contract-chat/types'

const CONTRACT_FILENAME = 'contrato-colectivo-de-trabajo-2025-2027.pdf'
const CONTRACT_PATH = path.join(process.cwd(), CONTRACT_FILENAME)
const CONTRACT_INDEX_DIR = path.join(process.cwd(), 'artifacts', 'contract-chat')
const CONTRACT_INDEX_PATH = path.join(CONTRACT_INDEX_DIR, 'contrato-2025-2027-index.json')
const TARGET_CHUNK_SIZE = 1600
const CHUNK_OVERLAP = 240
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

const SPANISH_STOPWORDS = new Set([
  'al',
  'ante',
  'bajo',
  'cabe',
  'con',
  'contra',
  'contrato',
  'colectivo',
  'de',
  'del',
  'desde',
  'dice',
  'durante',
  'el',
  'ella',
  'ellas',
  'ellos',
  'en',
  'entre',
  'era',
  'eramos',
  'es',
  'esa',
  'ese',
  'eso',
  'esta',
  'este',
  'esto',
  'fue',
  'ha',
  'hacia',
  'hasta',
  'la',
  'las',
  'le',
  'les',
  'lo',
  'los',
  'mas',
  'mi',
  'mis',
  'muy',
  'o',
  'para',
  'parte',
  'pero',
  'por',
  'pregunta',
  'que',
  'se',
  'segun',
  'ser',
  'si',
  'sin',
  'sobre',
  'su',
  'sus',
  'te',
  'tu',
  'tus',
  'trabajo',
  'un',
  'una',
  'uno',
  'unos',
  'unas',
  'y',
  'ya',
])

const INDEX_MARKERS = ['indice', 'tabla de contenido', 'contenido']

let contractIndexPromise: Promise<ContractIndex> | null = null

interface ExtractedPage {
  pageNumber: number
  text: string
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeQuery(query: string) {
  return Array.from(
    new Set(
      tokenizeNormalizedText(normalizeText(query))
    )
  )
}

function tokenizeNormalizedText(value: string) {
  return value
    .split(' ')
    .filter((token) => token.length >= 3 && !SPANISH_STOPWORDS.has(token))
}

function countTokens(value: string) {
  return tokenizeNormalizedText(value).reduce<Record<string, number>>((accumulator, token) => {
    accumulator[token] = (accumulator[token] || 0) + 1
    return accumulator
  }, {})
}

function splitTextIntoChunks(text: string) {
  const compactText = text.replace(/\s+/g, ' ').trim()
  if (!compactText) return []
  if (compactText.length <= TARGET_CHUNK_SIZE) return [compactText]

  const chunks: string[] = []
  let start = 0

  while (start < compactText.length) {
    let end = Math.min(start + TARGET_CHUNK_SIZE, compactText.length)
    if (end < compactText.length) {
      const nextBreak = compactText.lastIndexOf('. ', end)
      if (nextBreak > start + 500) {
        end = nextBreak + 1
      }
    }

    chunks.push(compactText.slice(start, end).trim())
    if (end >= compactText.length) break
    start = Math.max(end - CHUNK_OVERLAP, start + 1)
  }

  return chunks
}

function createExcerpt(text: string, tokens: string[]) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  if (sentences.length === 0) {
    return text.slice(0, 260).trim()
  }

  const rankedSentences = sentences
    .map((sentence) => {
      const normalizedSentence = normalizeText(sentence)
      const score = tokens.reduce((sum, token) => {
        return sum + (normalizedSentence.includes(token) ? 1 : 0)
      }, 0)

      return { sentence, score }
    })
    .sort((a, b) => b.score - a.score)

  const selected = rankedSentences
    .filter((item) => item.score > 0)
    .slice(0, 2)
    .map((item) => item.sentence)

  if (selected.length > 0) {
    return selected.join(' ')
  }

  return sentences.slice(0, 2).join(' ')
}

function buildAnswerText(query: string, sources: ContractSearchResult[]) {
  if (sources.length === 0) {
    return [
      'No encontré un pasaje suficientemente claro para responder con confianza dentro del contrato indexado.',
      'Prueba con otra redacción, una frase textual del documento, o una referencia más concreta como capítulo, artículo o tema.',
    ].join('\n\n')
  }

  const topSources = sources.slice(0, 3)
  const summaryLines = topSources.map((source, index) => {
    return `${index + 1}. ${source.excerpt} (p. ${source.chunk.pageNumber})`
  })

  const matchedTerms = Array.from(
    new Set(topSources.flatMap((source) => source.matchedTerms))
  )

  const intro = matchedTerms.length > 0
    ? `Encontré pasajes relevantes del contrato para la consulta "${query}". Coinciden principalmente con: ${matchedTerms.join(', ')}.`
    : `Encontré pasajes relevantes del contrato para la consulta "${query}".`

  const outro = 'Respuesta generada en modo sandbox extractivo. Conviene validar el contexto completo en las páginas citadas antes de usarlo como criterio operativo.'

  return [intro, summaryLines.join('\n'), outro].join('\n\n')
}

function readLocalEnvValue(filePath: string, key: string) {
  if (!fs.existsSync(filePath)) return null

  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (!trimmed.startsWith(`${key}=`)) continue
    return trimmed.slice(key.length + 1).trim()
  }

  return null
}

function getGroqApiKey() {
  return (
    process.env.GROQ_API_KEY ||
    readLocalEnvValue(path.join(process.cwd(), '.env.groq.local'), 'GROQ_API_KEY') ||
    readLocalEnvValue(path.join(process.cwd(), '.env.local'), 'GROQ_API_KEY') ||
    null
  )
}

function getGroqModel() {
  return (
    process.env.GROQ_MODEL ||
    readLocalEnvValue(path.join(process.cwd(), '.env.groq.local'), 'GROQ_MODEL') ||
    readLocalEnvValue(path.join(process.cwd(), '.env.local'), 'GROQ_MODEL') ||
    DEFAULT_GROQ_MODEL
  )
}

async function generateGroqAnswer(query: string, sources: ContractSearchResult[]) {
  const apiKey = getGroqApiKey()
  if (!apiKey || sources.length === 0) {
    return null
  }

  const model = getGroqModel()
  const context = sources
    .slice(0, 6)
    .map((source, index) => {
      return [
        `Fuente ${index + 1}`,
        `Pagina: ${source.chunk.pageNumber}`,
        `Coincidencias: ${source.matchedTerms.join(', ') || 'sin coincidencias explicitas'}`,
        `Texto: ${source.chunk.text}`,
      ].join('\n')
    })
    .join('\n\n')

  const systemPrompt = [
    'Eres un asistente para explorar un contrato colectivo del SNTSS.',
    'Responde solo con base en el contexto recuperado.',
    'Si el contexto no alcanza, dilo con claridad.',
    'Cita paginas entre parentesis al final de cada afirmacion importante, por ejemplo (p. 38).',
    'No inventes articulos, clausulas ni interpretaciones legales no respaldadas por el texto.',
    'Responde en espanol claro y directo.',
  ].join(' ')

  const userPrompt = [
    `Pregunta del usuario: ${query}`,
    'Contexto recuperado del contrato:',
    context,
  ].join('\n\n')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GROQ_HTTP_${response.status}: ${errorText.slice(0, 300)}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }

  const content = payload.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('GROQ_EMPTY_RESPONSE')
  }

  return {
    model,
    content,
  }
}

function scoreChunk(
  chunk: ContractChunk,
  index: ContractIndex,
  normalizedQuery: string,
  tokens: string[],
  pageHints: number[],
) {
  let score = 0
  const matchedTerms: string[] = []
  const isIndexChunk = INDEX_MARKERS.some((marker) => chunk.normalizedText.includes(marker))

  if (normalizedQuery && chunk.normalizedText.includes(normalizedQuery)) {
    score += 15
  }

  if (pageHints.includes(chunk.pageNumber)) {
    score += 20
  }

  const chunkTokenTotal = Object.values(chunk.tokenCounts).reduce((sum, count) => sum + count, 0) || 1

  for (const token of tokens) {
    const occurrences = chunk.tokenCounts[token] || 0
    if (occurrences === 0) continue
    const documentFrequency = index.documentFrequencies[token] || 1
    const inverseDocumentFrequency = Math.log((index.chunkCount + 1) / documentFrequency)
    const normalizedTermFrequency = occurrences / chunkTokenTotal
    score += normalizedTermFrequency * inverseDocumentFrequency * 100
    matchedTerms.push(token)
  }

  if (chunk.normalizedText.startsWith(normalizedQuery)) {
    score += 6
  }

  if (tokens.length > 0 && matchedTerms.length === 0) {
    score = 0
  }

  if (isIndexChunk) {
    score = Math.max(0, score - 10)
  }

  return {
    score,
    matchedTerms: Array.from(new Set(matchedTerms)),
  }
}

function extractPageHints(query: string) {
  const matches = query.match(/\b(?:pagina|pag|p)\.?\s*(\d{1,3})\b/gi) || []
  return matches
    .map((match) => Number(match.replace(/[^\d]/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0)
}

async function extractPagesFromPdf(pdfPath: string): Promise<ExtractedPage[]> {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import json
import sys
import pdfplumber

pdf_path = sys.argv[1]
pages = []

with pdfplumber.open(pdf_path) as pdf:
    for index, page in enumerate(pdf.pages, start=1):
        text = page.extract_text(layout=True) or page.extract_text() or ""
        pages.append({
            "pageNumber": index,
            "text": text
        })

print(json.dumps({"pages": pages}, ensure_ascii=False))
`.trim()

    const child = spawn('python3', ['-c', pythonScript, pdfPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python terminó con código ${code}`))
        return
      }

      try {
        const payload = JSON.parse(stdout) as { pages?: ExtractedPage[] }
        resolve(payload.pages || [])
      } catch (error) {
        reject(
          new Error(
            `No se pudo interpretar la salida del extractor de contrato: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        )
      }
    })
  })
}

async function buildContractIndex(): Promise<ContractIndex> {
  if (!fs.existsSync(CONTRACT_PATH)) {
    throw new Error(
      `No se encontró el contrato base en ${CONTRACT_PATH}. Coloca el PDF en la raíz del proyecto para usar el sandbox.`
    )
  }

  const contractStats = await fs.promises.stat(CONTRACT_PATH)
  const pages = await extractPagesFromPdf(CONTRACT_PATH)
  const documentFrequencies: Record<string, number> = {}

  const chunks = pages.flatMap((page) => {
    return splitTextIntoChunks(page.text).map((chunkText, index) => {
      const normalizedText = normalizeText(chunkText)
      const tokenCounts = countTokens(normalizedText)
      for (const token of Object.keys(tokenCounts)) {
        documentFrequencies[token] = (documentFrequencies[token] || 0) + 1
      }

      return {
        id: `page-${page.pageNumber}-chunk-${index + 1}`,
        pageNumber: page.pageNumber,
        text: chunkText,
        normalizedText,
        tokenCounts,
      }
    })
  })

  return {
    contractPath: CONTRACT_PATH,
    sourceMtimeMs: contractStats.mtimeMs,
    builtAt: new Date().toISOString(),
    pageCount: pages.length,
    chunkCount: chunks.length,
    vocabularySize: Object.keys(documentFrequencies).length,
    documentFrequencies,
    chunks,
  }
}

async function saveContractIndex(index: ContractIndex) {
  await fs.promises.mkdir(CONTRACT_INDEX_DIR, { recursive: true })
  await fs.promises.writeFile(CONTRACT_INDEX_PATH, JSON.stringify(index), 'utf8')
}

async function loadPersistedContractIndex() {
  if (!fs.existsSync(CONTRACT_INDEX_PATH) || !fs.existsSync(CONTRACT_PATH)) {
    return null
  }

  const [rawIndex, contractStats] = await Promise.all([
    fs.promises.readFile(CONTRACT_INDEX_PATH, 'utf8'),
    fs.promises.stat(CONTRACT_PATH),
  ])

  const parsedIndex = JSON.parse(rawIndex) as ContractIndex
  if (parsedIndex.sourceMtimeMs !== contractStats.mtimeMs) {
    return null
  }

  return parsedIndex
}

export async function getContractIndex() {
  if (!contractIndexPromise) {
    contractIndexPromise = (async () => {
      const persistedIndex = await loadPersistedContractIndex()
      if (persistedIndex) {
        return persistedIndex
      }

      const rebuiltIndex = await buildContractIndex()
      await saveContractIndex(rebuiltIndex)
      return rebuiltIndex
    })()
  }

  return contractIndexPromise
}

export async function rebuildContractIndex() {
  const rebuiltIndex = await buildContractIndex()
  await saveContractIndex(rebuiltIndex)
  contractIndexPromise = Promise.resolve(rebuiltIndex)
  return rebuiltIndex
}

export async function answerContractQuestion(query: string): Promise<ContractChatAnswer> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    throw new Error('QUERY_REQUIRED')
  }

  const index = await getContractIndex()
  const tokens = tokenizeQuery(trimmedQuery)
  const normalizedQuery = normalizeText(trimmedQuery)
  const pageHints = extractPageHints(trimmedQuery)

  const rankedSources = index.chunks
    .map((chunk) => {
      const { score, matchedTerms } = scoreChunk(
        chunk,
        index,
        normalizedQuery,
        tokens,
        pageHints
      )

      return {
        chunk,
        score,
        matchedTerms,
        excerpt: createExcerpt(chunk.text, tokens),
      }
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.pageNumber - b.chunk.pageNumber)
    .slice(0, 6)

  let answer = buildAnswerText(trimmedQuery, rankedSources)
  let answerMode: ContractChatAnswer['answerMode'] = 'extractive'
  let groqModel: string | undefined
  let usedGroq = false

  try {
    const groqResponse = await generateGroqAnswer(trimmedQuery, rankedSources)
    if (groqResponse) {
      answer = groqResponse.content
      answerMode = 'groq'
      groqModel = groqResponse.model
      usedGroq = true
    }
  } catch (error) {
    console.error('Groq no disponible para sandbox de contrato, usando fallback extractivo:', error)
  }

  return {
    answer,
    query: trimmedQuery,
    generatedAt: new Date().toISOString(),
    sourceCount: rankedSources.length,
    answerMode,
    sources: rankedSources,
    diagnostics: {
      contractPath: index.contractPath,
      pageCount: index.pageCount,
      chunkCount: index.chunkCount,
      model: groqModel,
      usedGroq,
    },
  }
}
