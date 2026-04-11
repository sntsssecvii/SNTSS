'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, FileSearch, Loader2, MessageSquareText, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/firebase/firebase-client'
import { isAdminRole } from '@/lib/auth/roles'

interface SourceItem {
  chunk: {
    id: string
    pageNumber: number
    text: string
  }
  score: number
  matchedTerms: string[]
  excerpt: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceItem[]
}

const SUGGESTED_QUESTIONS = [
  '¿Qué dice el contrato sobre vacaciones?',
  'Busca referencias a escalafón o promociones.',
  'Resume lo más relevante sobre permisos y licencias.',
  '¿En qué páginas aparecen temas de jubilación?',
]

export default function ChatContratoSandboxPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Sandbox listo. Esta primera versión consulta el contrato 2025-2027 con recuperación local y respuesta extractiva con citas por página. No usa credenciales nuevas ni escribe en producción.',
    },
  ])

  useEffect(() => {
    if (!loading && (!user || !isAdminRole(userData?.role))) {
      router.push('/login')
    }
  }, [loading, router, user, userData])

  const canSubmit = useMemo(() => query.trim().length > 0 && !submitting, [query, submitting])

  const handleSuggestedQuestion = (value: string) => {
    setQuery(value)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuery = query.trim()
    if (!trimmedQuery || submitting) return

    setSubmitting(true)
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmedQuery,
      },
    ])
    setQuery('')

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('No se pudo validar la sesión del administrador.')
      }

      const idToken = await currentUser.getIdToken()
      const response = await fetch('/api/admin/lab/chat-contrato', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ query: trimmedQuery }),
      })

      const payload = await response.json()
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || 'No se pudo consultar el contrato.')
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: payload.data.answer,
          sources: payload.data.sources,
        },
      ])
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error ? error.message : 'No se pudo consultar el contrato.'

      toast({
        title: 'Error en sandbox',
        description: message,
        variant: 'destructive',
      })

      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: `No pude completar la consulta: ${message}`,
        },
      ])
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !isAdminRole(userData?.role)) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 dark:bg-[#020617] sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/70 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.12),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.08),_transparent_35%)]" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <Badge variant="outline" className="w-fit border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                Laboratorio aislado
              </Badge>
              <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                  Sandbox de chat para el contrato colectivo
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                  Este entorno sirve para probar recuperación del PDF 2025-2027 sin tocar navegación principal, datos reales ni proveedores externos. La respuesta actual es extractiva y siempre te devuelve páginas de respaldo.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
                <CardContent className="flex items-center gap-3 p-4">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Aislamiento</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sin prod</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
                <CardContent className="flex items-center gap-3 p-4">
                  <FileSearch className="h-5 w-5 text-sky-600" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Motor</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Busqueda local</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
                <CardContent className="flex items-center gap-3 p-4">
                  <Bot className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Salida</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Citas por pagina</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          <Card className="border-slate-200/70 shadow-sm dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <MessageSquareText className="h-6 w-6 text-primary" />
                Conversacion de prueba
              </CardTitle>
              <CardDescription>
                Úsalo para validar la calidad de recuperación, la pertinencia de las citas y posibles huecos antes de integrar un modelo conversacional real.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[36rem] space-y-4 overflow-y-auto rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                  >
                    <div
                      className={
                        message.role === 'user'
                          ? 'max-w-3xl rounded-[1.5rem] rounded-br-md bg-primary px-4 py-3 text-sm text-white shadow-sm'
                          : 'max-w-3xl space-y-3 rounded-[1.5rem] rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                      }
                    >
                      <p className="whitespace-pre-wrap leading-6">{message.content}</p>

                      {message.sources && message.sources.length > 0 && (
                        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Fuentes recuperadas
                          </p>
                          {message.sources.slice(0, 3).map((source) => (
                            <div
                              key={source.chunk.id}
                              className="rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                            >
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                Pagina {source.chunk.pageNumber}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap">{source.excerpt}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {submitting && (
                  <div className="flex justify-start">
                    <div className="rounded-[1.5rem] rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Consultando el contrato y preparando citas...
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <Textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Escribe una pregunta sobre el contrato colectivo. Ejemplo: ¿Qué dice sobre permisos, vacaciones o jubilación?"
                  className="min-h-[120px] resize-none rounded-2xl border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Respuesta de laboratorio con recuperación local del PDF.
                  </p>
                  <Button type="submit" disabled={!canSubmit} className="sm:min-w-40">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Consultando
                      </>
                    ) : (
                      'Preguntar al sandbox'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200/70 shadow-sm dark:border-slate-800">
              <CardHeader>
                <CardTitle>Prompts de prueba</CardTitle>
                <CardDescription>
                  Te ayudan a validar temas comunes y medir si la recuperación alcanza el nivel esperado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {SUGGESTED_QUESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleSuggestedQuestion(item)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-primary/40 hover:bg-primary/5 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                  >
                    {item}
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-200/70 shadow-sm dark:border-slate-800">
              <CardHeader>
                <CardTitle>Notas de esta iteracion</CardTitle>
                <CardDescription>
                  Lo dejé acotado para que podamos aprender rápido sin mezclarlo con el producto principal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <p>Lee el PDF local desde la raíz del repo y lo indexa en memoria con caché de proceso.</p>
                <p>No crea colecciones nuevas, no escribe en Firestore y no añade proveedores LLM.</p>
                <p>La siguiente evolución natural sería embeddings, chunking por artículos y trazabilidad de respuestas.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
