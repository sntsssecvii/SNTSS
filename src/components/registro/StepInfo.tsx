'use client'

import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { registroBaseSchema, type RegistroFormData } from '@/lib/schemas/registro'
import { validarCURP } from '@/lib/utils/curp'
import { evaluarFortalezaPassword, passwordsCoinciden } from '@/lib/utils/password'
import { Eye, EyeOff, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'

interface StepInfoProps {
    onNext: (data: Partial<RegistroFormData>) => void
    initialData?: Partial<RegistroFormData>
}

// Separate schema for this step to validate only these fields before moving on
const stepInfoSchema = registroBaseSchema.pick({
    nombre: true,
    apellidoPaterno: true,
    apellidoMaterno: true,
    matricula: true,
    email: true,
    curp: true,
    password: true,
    confirmPassword: true,
}).refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
})

export default function StepInfo({ onNext, initialData }: StepInfoProps) {
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<z.infer<typeof stepInfoSchema>>({
        resolver: zodResolver(stepInfoSchema),
        defaultValues: initialData,
    })

    // Estados para funcionalidades mejoradas
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [curpValidation, setCurpValidation] = useState<{
        validando: boolean
        valido: boolean | null
        mensaje: string
        info?: any
    }>({
        validando: false,
        valido: null,
        mensaje: ''
    })

    // Watch para validaciones en tiempo real
    const password = watch('password')
    const confirmPassword = watch('confirmPassword')
    const curp = watch('curp')

    // Evaluar fortaleza de contraseña
    const passwordStrength = password ? evaluarFortalezaPassword(password) : null

    // Validar coincidencia de contraseñas
    const passwordMatch = confirmPassword && password ? passwordsCoinciden(password, confirmPassword) : null

    // Validar CURP en tiempo real
    useEffect(() => {
        if (curp && curp.length === 18) {
            setCurpValidation({ validando: true, valido: null, mensaje: '' })

            const timer = setTimeout(async () => {
                const resultado = await validarCURP(curp)
                setCurpValidation({
                    validando: false,
                    valido: resultado.valido,
                    mensaje: resultado.mensaje,
                    info: resultado.info
                })
            }, 500) // Debounce de 500ms

            return () => clearTimeout(timer)
        } else {
            setCurpValidation({ validando: false, valido: null, mensaje: '' })
        }
    }, [curp])

    const onSubmit = (data: z.infer<typeof stepInfoSchema>) => {
        onNext(data)
    }

    return (
        <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
            onSubmit={handleSubmit(onSubmit)}
        >
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre(s)</Label>
                    <Input
                        id="nombre"
                        placeholder="Ej. Juan Carlos"
                        {...register('nombre')}
                        className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                    {errors.nombre && <p className="text-sm text-red-500">{errors.nombre.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="apellidoPaterno">Apellido Paterno</Label>
                    <Input
                        id="apellidoPaterno"
                        placeholder="Ej. Pérez"
                        {...register('apellidoPaterno')}
                        className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                    {errors.apellidoPaterno && <p className="text-sm text-red-500">{errors.apellidoPaterno.message}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="apellidoMaterno">Apellido Materno</Label>
                <Input
                    id="apellidoMaterno"
                    placeholder="Ej. López"
                    {...register('apellidoMaterno')}
                    className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                {errors.apellidoMaterno && <p className="text-sm text-red-500">{errors.apellidoMaterno.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="matricula">Matrícula</Label>
                <Input
                    id="matricula"
                    placeholder="Máximo 10 dígitos numéricos"
                    maxLength={10}
                    {...register('matricula')}
                    className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                {errors.matricula && <p className="text-sm text-red-500">{errors.matricula.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico Institucional / Personal</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="nombre@ejemplo.com"
                    {...register('email')}
                    className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>

            {/* CURP con validación en tiempo real */}
            <div className="space-y-2">
                <Label htmlFor="curp">CURP</Label>
                <div className="relative">
                    <Input
                        id="curp"
                        placeholder="Clave Única de Registro de Población"
                        maxLength={18}
                        className="uppercase transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500 pr-10"
                        {...register('curp')}
                    />
                    {curpValidation.validando && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-slate-400" />
                    )}
                    {!curpValidation.validando && curpValidation.valido === true && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                    )}
                    {!curpValidation.validando && curpValidation.valido === false && (
                        <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                    )}
                </div>
                {errors.curp && <p className="text-sm text-red-500">{errors.curp.message}</p>}
                {curpValidation.valido === true && curpValidation.info && (
                    <div className="text-xs text-green-600 bg-green-50 p-2 rounded-md space-y-1">
                        <p>✓ CURP válido</p>
                        <p>• Fecha de nacimiento: {curpValidation.info.fechaNacimiento}</p>
                        <p>• Sexo: {curpValidation.info.sexo}</p>
                        <p>• Estado: {curpValidation.info.estado}</p>
                    </div>
                )}
                {curpValidation.valido === false && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {curpValidation.mensaje}
                    </p>
                )}
            </div>

            {/* Contraseñas mejoradas */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Mínimo 6 caracteres"
                            {...register('password')}
                            className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500 pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                    {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}

                    {/* Indicador de fortaleza */}
                    {passwordStrength && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(passwordStrength.score + 1) * 25}%` }}
                                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                                    />
                                </div>
                                <span className="text-xs font-medium text-slate-600">
                                    {passwordStrength.label}
                                </span>
                            </div>
                            {passwordStrength.suggestions.length > 0 && (
                                <div className="text-xs text-slate-500 space-y-1">
                                    {passwordStrength.suggestions.map((suggestion, idx) => (
                                        <p key={idx}>• {suggestion}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Repite tu contraseña"
                            {...register('confirmPassword')}
                            className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500 pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                    {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}

                    {/* Indicador de coincidencia */}
                    {confirmPassword && (
                        <div className={`text-xs flex items-center gap-1 ${passwordMatch ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordMatch ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Las contraseñas coinciden
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-4 h-4" />
                                    Las contraseñas no coinciden
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="pt-4 flex justify-end">
                <Button
                    type="submit"
                    className="w-full md:w-auto bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white shadow-lg transform active:scale-95 transition-all"
                >
                    Siguiente: Documentación
                </Button>
            </div>
        </motion.form>
    )
}
