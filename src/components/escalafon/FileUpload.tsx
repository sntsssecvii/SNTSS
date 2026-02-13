'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, File, X, FileText, Scan, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/firebase/firebase-client'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import type { TipoEscalafon } from '@/types/escalafon'
import { NOMBRES_TIPOS } from '@/types/escalafon'
import { Select } from '@/components/ui/select'

interface FileUploadProps {
  onUploadSuccess?: (documentoId: string) => void
}

export function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [tipo, setTipo] = useState<TipoEscalafon | ''>('')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [phase, setPhase] = useState<'upload' | 'process' | 'done'>('upload')
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
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile)
    } else {
      toast({
        title: 'Error',
        description: 'Por favor, selecciona un archivo PDF',
        variant: 'destructive',
      })
    }
  }, [toast])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
    } else {
      toast({
        title: 'Error',
        description: 'Por favor, selecciona un archivo PDF',
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

      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('Usuario no autenticado')
      }

      const token = await currentUser.getIdToken()

      // Usar XMLHttpRequest para progreso real de subida
      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const url = '/api/escalafon/procesar'

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
  }, [file, tipo, user, toast, onUploadSuccess])

  const tiposDisponibles: TipoEscalafon[] = [
    'AMPLIACIONES_JORNADA',
    'CAMBIOS_AREA',
    'CAMBIOS_RAMA',
    'CAMBIOS_RESIDENCIA_DESTINO',
    'CAMBIOS_RESIDENCIA_ORIGEN',
    'CAMBIOS_TIPO_PLAZA',
    'CAMBIOS_TURNO_ADSCRIPCION',
    'NUEVO_INGRESO',
  ]

  return (
    <div className="space-y-4 relative">
      {/* Overlay de procesamiento con animación simplificada y dinámica */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-lg bg-background/80 backdrop-blur-md border-2 border-primary/20"
          >
            <div className="relative flex flex-col items-center gap-8 z-10 w-full max-w-sm px-6">
              {/* Contenedor del Icono con Glow sutil */}
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

                        {/* Escáner mejorado: haz de luz */}
                        <motion.div
                          className="absolute -inset-x-2 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_15px_rgba(var(--primary),0.5)]"
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

                  {/* Partículas sutiles orbitando (solo 2, más lentas) */}
                  {phase !== 'done' && [0, 1].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1.5 h-1.5 rounded-full bg-primary/40"
                      animate={{
                        rotate: 360,
                        scale: [1, 1.5, 1],
                      }}
                      transition={{
                        rotate: { duration: 8, repeat: Infinity, ease: "linear", delay: i * 4 },
                        scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                      }}
                      style={{
                        transformOrigin: 'center center',
                        width: '120px',
                        height: '120px',
                        left: 'calc(50% - 60px)',
                        top: 'calc(50% - 60px)',
                        padding: '10px',
                      }}
                    >
                      <div className="w-full h-full rounded-full border border-dashed border-primary/10" />
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              {/* Texto y Progreso */}
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
                      phase === 'process' ? 'Extrayendo información del escalafón' : 'Todo listo para continuar'}
                  </p>
                </div>

                {/* Barra de progreso minimalista */}
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                    <span>Progreso</span>
                    <span className="tabular-nums text-primary">{uploadProgress}%</span>
                  </div>
                  <div className="relative h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute left-0 top-0 h-full bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                      initial={{ width: '0%' }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-6 pt-2">
                  <div className={`flex flex-col items-center gap-1 transition-opacity duration-300 ${phase === 'upload' ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-2 h-2 rounded-full ${phase === 'upload' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Subida</span>
                  </div>
                  <div className="w-8 h-px bg-border" />
                  <div className={`flex flex-col items-center gap-1 transition-opacity duration-300 ${phase === 'process' ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-2 h-2 rounded-full ${phase === 'process' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Proceso</span>
                  </div>
                  <div className="w-8 h-px bg-border" />
                  <div className={`flex flex-col items-center gap-1 transition-opacity duration-300 ${phase === 'done' ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-2 h-2 rounded-full ${phase === 'done' ? 'bg-green-500' : 'bg-muted'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Fin</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selector de tipo */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Tipo de Documento
        </label>
        <Select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoEscalafon)}
        >
          <option value="">Selecciona el tipo de documento</option>
          {tiposDisponibles.map((tipoItem) => (
            <option key={tipoItem} value={tipoItem}>
              {NOMBRES_TIPOS[tipoItem]}
            </option>
          ))}
        </Select>
      </div>

      {/* Área de carga */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors overflow-hidden
          ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'}
          ${file ? 'border-green-500 bg-green-50' : ''}
        `}
        animate={isDragging ? { scale: 1.01 } : { scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <File className="h-8 w-8 text-green-600" />
              <div className="text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFile(null)}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="h-12 w-12 mx-auto text-gray-400" />
            <div>
              <p className="text-lg font-medium mb-1">
                Arrastra y suelta tu archivo PDF aquí
              </p>
              <p className="text-sm text-gray-500 mb-4">o</p>
              <label htmlFor="file-upload">
                <Button asChild variant="outline">
                  <span>Seleccionar archivo</span>
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </motion.div>

      {/* Botón de subir */}
      {file && tipo && (
        <motion.div
          whileHover={{ scale: isUploading ? 1 : 1.02 }}
          whileTap={{ scale: isUploading ? 1 : 0.98 }}
        >
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full"
            size="lg"
          >
            {!isUploading && (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Procesar PDF
              </>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  )
}
