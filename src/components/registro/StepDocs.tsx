'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Upload, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import { optimizeImage } from '@/lib/utils/image-optimization'
import { cn } from '@/lib/utils'

interface StepDocsProps {
    onBack: () => void
    onSubmit: (files: { identificacion: File, tarjeton: File }) => void
    isSubmitting: boolean
}

const MAX_REGISTRATION_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_REGISTRATION_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export default function StepDocs({ onBack, onSubmit, isSubmitting }: StepDocsProps) {
    const [identificacion, setIdentificacion] = useState<File | null>(null)
    const [tarjeton, setTarjeton] = useState<File | null>(null)
    const [errors, setErrors] = useState<{ identificacion?: string, tarjeton?: string }>({})
    const [processing, setProcessing] = useState<{ [key: string]: boolean }>({})

    const idInputRef = useRef<HTMLInputElement>(null)
    const tarjetonInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (
        e: React.ChangeEvent<HTMLInputElement>,
        type: 'identificacion' | 'tarjeton'
    ) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validar tipo
        if (!ALLOWED_REGISTRATION_FILE_TYPES.includes(file.type)) {
            setErrors(prev => ({ ...prev, [type]: 'Solo imágenes (JPG, PNG) o PDF son permitidos' }))
            return
        }

        if (file.size <= 0 || file.size > MAX_REGISTRATION_FILE_SIZE_BYTES) {
            setErrors(prev => ({ ...prev, [type]: 'El archivo debe pesar máximo 5 MB' }))
            return
        }

        setProcessing(prev => ({ ...prev, [type]: true }))
        setErrors(prev => ({ ...prev, [type]: undefined }))

        try {
            let finalFile = file
            // Optimizar si es imagen
            if (file.type.startsWith('image/')) {
                finalFile = await optimizeImage(file)
            }

            if (type === 'identificacion') setIdentificacion(finalFile)
            else setTarjeton(finalFile)
        } catch (error) {
            console.error("Error optimizando", error)
            setErrors(prev => ({ ...prev, [type]: 'Error al procesar el archivo' }))
        } finally {
            setProcessing(prev => ({ ...prev, [type]: false }))
        }
    }

    const handleSubmit = () => {
        const newErrors: { identificacion?: string, tarjeton?: string } = {}
        if (!identificacion) newErrors.identificacion = 'Debes subir tu identificación'
        if (!tarjeton) newErrors.tarjeton = 'Debes subir tu tarjetón de pago'

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            return
        }

        if (identificacion && tarjeton) {
            onSubmit({ identificacion, tarjeton })
        }
    }

    const FileCard = ({
        file,
        type,
        label,
        inputRef,
        error,
        isProcessing
    }: {
        file: File | null
        type: 'identificacion' | 'tarjeton'
        label: string
        inputRef: React.RefObject<HTMLInputElement>
        error?: string
        isProcessing: boolean
    }) => (
        <div className={cn(
            "border-2 border-dashed rounded-xl p-6 transition-all duration-300 relative group",
            error ? "border-red-300 bg-red-50/50" :
                file ? "border-green-500/50 bg-green-50/30" : "border-slate-200 hover:border-red-400 hover:bg-slate-50"
        )}>
            <input
                type="file"
                ref={inputRef}
                onChange={(e) => handleFileChange(e, type)}
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
            />

            <div className="flex flex-col items-center justify-center text-center space-y-3">
                {isProcessing ? (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full"
                    />
                ) : file ? (
                    <>
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-medium text-slate-900 line-clamp-1 max-w-[200px]">{file.name}</p>
                            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (type === 'identificacion') setIdentificacion(null)
                                else setTarjeton(null)
                                if (inputRef.current) inputRef.current.value = ''
                            }}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                            <X className="w-4 h-4 mr-1" /> Remover
                        </Button>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-medium text-slate-900">{label}</p>
                            <p className="text-xs text-slate-500 mt-1">JPG, PNG o PDF (Máx. 5MB)</p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => inputRef.current?.click()}
                            className="border-red-200 text-red-700 hover:bg-red-50"
                        >
                            Seleccionar Archivo
                        </Button>
                    </>
                )}
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-6 left-0 right-0 text-center"
                >
                    <span className="text-xs text-red-500 flex items-center justify-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {error}
                    </span>
                </motion.div>
            )}
        </div>
    )

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
        >
            <div className="space-y-2 text-center">
                <h3 className="text-lg font-semibold text-slate-900">Documentación Requerida</h3>
                <p className="text-sm text-slate-500">Sube tus documentos para validar tu identidad. Los archivos serán optimizados automáticamente.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                <FileCard
                    file={identificacion}
                    type="identificacion"
                    label="Identificación Oficial (INE/IFE)"
                    inputRef={idInputRef}
                    error={errors.identificacion}
                    isProcessing={processing.identificacion || false}
                />
                <FileCard
                    file={tarjeton}
                    type="tarjeton"
                    label="Tarjetón de Pago Reciente"
                    inputRef={tarjetonInputRef}
                    error={errors.tarjeton}
                    isProcessing={processing.tarjeton || false}
                />
            </div>

            <div className="flex flex-col-reverse md:flex-row justify-between gap-4 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    disabled={isSubmitting}
                >
                    Atrás
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || processing.identificacion || processing.tarjeton}
                    className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white shadow-lg relative overflow-hidden"
                >
                    {isSubmitting ? (
                        <>
                            <motion.div
                                className="absolute inset-0 bg-white/20"
                                initial={{ x: '-100%' }}
                                animate={{ x: '100%' }}
                                transition={{ repeat: Infinity, duration: 1 }}
                            />
                            Procesando Registro...
                        </>
                    ) : (
                        'Finalizar Registro'
                    )}
                </Button>
            </div>
        </motion.div>
    )
}
