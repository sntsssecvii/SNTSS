'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, File, X, FileText, Scan, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/firebase/firebase-client'
import type { TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'
import { NOMBRES_TIPOS } from '@/types/bolsa-de-trabajo'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onUploadSuccess?: (documentoId: string) => void
}

const MAX_BOLSA_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024
const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]

export function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [tipo, setTipo] = useState<TipoBolsaDeTrabajo | ''>('')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [phase, setPhase] = useState<'upload' | 'process' | 'done'>('upload')
  const [anio, setAnio] = useState<number>(new Date().getFullYear())
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1)
  const [quincena, setQuincena] = useState<1 | 2>(new Date().getDate() <= 15 ? 1 : 2)
  const { user } = useAuth()
  const { toast } = useToast()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    const normalizedName = droppedFile?.name.toLowerCase() || ''
    const isPDF = droppedFile && (droppedFile.type === 'application/pdf' || normalizedName.endsWith('.pdf'))
    const isExcel = droppedFile && (EXCEL_MIME_TYPES.includes(droppedFile.type) || normalizedName.endsWith('.xlsx') || normalizedName.endsWith('.xls'))

    if (droppedFile && droppedFile.size > 0 && droppedFile.size <= MAX_BOLSA_UPLOAD_SIZE_BYTES && (isPDF || isExcel)) {
      setFile(droppedFile)
    } else {
      toast({
        title: 'Error',
        description: 'Por favor, selecciona un archivo PDF o Excel (.xlsx o .xls) de hasta 25 MB.',
        variant: 'destructive',
      })
    }
  }, [toast])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    const normalizedName = selectedFile?.name.toLowerCase() || ''
    const isPDF = selectedFile && (selectedFile.type === 'application/pdf' || normalizedName.endsWith('.pdf'))
    const isExcel = selectedFile && (EXCEL_MIME_TYPES.includes(selectedFile.type) || normalizedName.endsWith('.xlsx') || normalizedName.endsWith('.xls'))

    if (selectedFile && selectedFile.size > 0 && selectedFile.size <= MAX_BOLSA_UPLOAD_SIZE_BYTES && (isPDF || isExcel)) {
      setFile(selectedFile)
    } else {
      toast({
        title: 'Error',
        description: 'Por favor, selecciona un archivo PDF o Excel (.xlsx o .xls) de hasta 25 MB.',
        variant: 'destructive',
      })
    }
  }, [toast])

  const handleUpload = useCallback(async () => {
    if (!file) {
      toast({
        title: 'Error',
        description: 'Por favor, selecciona un archivo',
        variant: 'destructive',
      })
      return
    }

    if (!tipo) {
      toast({
        title: 'Error',
        description: 'Por favor, selecciona el tipo de documento',
        variant: 'destructive',
      })
      return
    }

    if (!user?.uid) {
      toast({
        title: 'Error',
        description: 'Debes estar autenticado para subir archivos',
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setPhase('upload')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('tipo', tipo)
      formData.append('userId', user.uid)
      formData.append('userEmail', user.email || '')
      formData.append('anio', anio.toString())
      formData.append('mes', mes.toString())
      formData.append('quincena', quincena.toString())

      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('Usuario no autenticado')
      }

      const token = await currentUser.getIdToken()

      // Usar XMLHttpRequest para progreso real de subida
      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const url = '/api/bolsa-de-trabajo/procesar'

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 85)
            setUploadProgress(percent)
          }
        })

        xhr.addEventListener('load', () => {
          setPhase('process')
          setUploadProgress(95)
          try {
            const contentType = xhr.getResponseHeader('content-type')
            if (contentType && contentType.includes('application/json')) {
              const parsed = JSON.parse(xhr.responseText)
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(parsed)
              } else {
                reject(new Error(parsed.error || parsed.message || `Error ${xhr.status}`))
              }
            } else {
              reject(new Error(`Error del servidor: ${xhr.status} ${xhr.statusText}`))
            }
          } catch (e) {
            reject(e instanceof Error ? e : new Error('Respuesta inválida del servidor'))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Error de red')))
        xhr.addEventListener('abort', () => reject(new Error('Solicitud cancelada')))

        xhr.open('POST', url)
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.send(formData)
      })

      setPhase('done')
      setUploadProgress(100)

      if (data.error && !data.documentoId) {
        throw new Error(data.error)
      }

      // Breve pausa para mostrar el estado completado
      await new Promise((r) => setTimeout(r, 800))

      if (data.totalRegistros === 0) {
        const advertenciaMsg = typeof data.advertencia === 'string'
          ? data.advertencia
          : 'El archivo se procesó pero no se extrajeron registros. Revisa los logs del servidor.'
        toast({
          title: 'Advertencia',
          description: advertenciaMsg,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Éxito',
          description: `Archivo procesado correctamente. ${data.totalRegistros} registros extraídos.`,
        })
      }

      if (data.errores && data.errores.length > 0) {
        console.warn('Errores durante el procesamiento:', data.errores)
      }

      setFile(null)
      setTipo('')

      if (onUploadSuccess && data.documentoId && typeof data.documentoId === 'string') {
        onUploadSuccess(data.documentoId)
      }
    } catch (error: any) {
      console.error('Error al subir archivo:', error)
      // Asegurarse de que description sea siempre un string
      let errorMessage = 'Error al procesar el archivo'
      if (error) {
        if (typeof error === 'string') {
          errorMessage = error
        } else if (error.message) {
          errorMessage = String(error.message)
        } else if (error.error) {
          errorMessage = String(error.error)
        } else {
          errorMessage = JSON.stringify(error)
        }
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }, [file, tipo, user, toast, onUploadSuccess, anio, mes, quincena])

  const tiposDisponibles: TipoBolsaDeTrabajo[] = [
    'AMPLIACIONES_JORNADA',
    'CAMBIOS_AREA',
    'CAMBIOS_RAMA',
    'CAMBIOS_RESIDENCIA_DESTINO',
    'CAMBIOS_RESIDENCIA_ORIGEN',
    'CAMBIOS_TIPO_PLAZA',
    'CAMBIOS_TURNO_ADSCRIPCION',
    'NUEVO_INGRESO',
  ]

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  return (
    <div className="space-y-6 relative">
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-[-24px] inset-y-[-24px] z-50 flex flex-col items-center justify-center rounded-lg bg-background/80 backdrop-blur-md border-2 border-primary/20"
          >
            <div className="relative flex flex-col items-center gap-8 z-10 w-full max-w-sm px-6">
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-full bg-primary/10 blur-3xl"
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                />

                <motion.div
                  className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-card border border-primary/20 shadow-2xl"
                  animate={phase === 'done' ? { scale: [1, 1.05, 1], borderColor: 'rgb(34 197 94 / 0.5)' } : { y: [0, -4, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <AnimatePresence mode="wait">
                    {phase === 'done' ? (
                      <motion.div
                        key="done"
                        initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        className="text-green-500"
                      >
                        <CheckCircle2 className="h-12 w-12" strokeWidth={2} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="relative"
                      >
                        <FileText className="h-12 w-12 text-primary" strokeWidth={1.5} />

                        <motion.div
                          className="absolute -inset-x-2 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                          style={{ boxShadow: '0 0 15px hsla(var(--primary) / 0.5)' }}
                          animate={{
                            top: ['10%', '90%', '10%'],
                            opacity: [0, 1, 1, 0]
                          }}
                          transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.2, 0.8, 1]
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              <div className="w-full space-y-6 text-center">
                <div className="space-y-1">
                  <motion.h3
                    className="text-xl font-bold tracking-tight"
                    key={phase}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {phase === 'done' ? (
                      <span className="text-green-600">Procesamiento Completado</span>
                    ) : (
                      <span className="text-foreground">
                        {phase === 'upload' ? 'Subiendo Documento' : 'Analizando Datos'}
                      </span>
                    )}
                  </motion.h3>
                  <p className="text-sm text-muted-foreground">
                    {phase === 'upload' ? 'Estamos enviando tu archivo de forma segura' :
                      phase === 'process' ? 'Extrayendo información del bolsa de trabajo' : 'Todo listo para continuar'}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                    <span>Progreso</span>
                    <span className="tabular-nums text-primary">{uploadProgress}%</span>
                  </div>
                  <div className="relative h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute left-0 top-0 h-full bg-primary rounded-full"
                      style={{ boxShadow: '0 0 10px hsla(var(--primary) / 0.3)' }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500">
            Tipo de Documento
          </label>
          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoBolsaDeTrabajo)}
            className="w-full h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-primary font-bold transition-all px-4"
          >
            <option value="">Selecciona el tipo</option>
            {tiposDisponibles.map((tipoItem) => (
              <option key={tipoItem} value={tipoItem}>
                {NOMBRES_TIPOS[tipoItem]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500">
            Periodo del Documento
          </label>
          <div className="flex gap-2">
            <Select
              value={anio}
              onChange={(e) => setAnio(parseInt(e.target.value))}
              className="flex-1 h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-primary font-bold px-2"
            >
              {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
            </Select>
            <Select
              value={mes}
              onChange={(e) => setMes(parseInt(e.target.value))}
              className="flex-1 h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-primary font-bold px-2"
            >
              {meses.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
            <Select
              value={quincena}
              onChange={(e) => setQuincena(parseInt(e.target.value) as 1 | 2)}
              className="flex-1 h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-primary font-bold px-2"
            >
              <option value={1}>1ra Qna</option>
              <option value={2}>2da Qna</option>
            </Select>
          </div>
        </div>
      </div>

      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 overflow-hidden group hover:border-primary/50",
          isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950",
          file ? "border-emerald-500 bg-emerald-50/10" : ""
        )}
      >
        {file ? (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600">
              <FileText className="h-12 w-12" />
            </div>
            <div className="space-y-1">
              <p className="font-extrabold text-slate-900 dark:text-white">{file.name}</p>
              <p className="text-xs font-black text-slate-500 uppercase tracking-tighter">
                {(file.size / 1024 / 1024).toFixed(2)} MB • Listo para procesar
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFile(null)}
              disabled={isUploading}
              className="rounded-xl border-2 font-black hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all font-sans"
            >
              <X className="mr-2 h-4 w-4" /> CAMBIAR ARCHIVO
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
              <div className="relative w-24 h-24 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                <Upload className="h-10 w-10 text-primary" strokeWidth={1.5} />
              </div>
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Arrastra tu PDF o Excel aquí
              </p>
              <p className="text-sm font-bold text-slate-500 mt-1">
                Sube el PDF original o el Excel ya extraído
              </p>
              <div className="flex items-center justify-center gap-4 mt-8">
                <div className="h-px w-8 bg-slate-200 dark:bg-slate-800" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">o selecciona uno</span>
                <div className="h-px w-8 bg-slate-200 dark:bg-slate-800" />
              </div>
              <label htmlFor="file-upload" className="mt-4 block">
                <Button asChild variant="secondary" className="rounded-xl font-black px-8 py-6 h-auto shadow-lg hover:shadow-xl transition-all cursor-pointer">
                  <span>Explorar Archivos</span>
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </motion.div>

      {file && tipo && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 transition-all active:scale-95"
          >
            {!isUploading && (
              <>
                <Scan className="mr-3 h-6 w-6" />
                Sincronizar con Bolsa de Trabajo
              </>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  )
}
