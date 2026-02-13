'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from '@/components/ui/use-toast'
import { getAuth, sendPasswordResetEmail } from 'firebase/auth'
import { Loader2, ArrowLeft } from 'lucide-react'
import logoSNTSS from '@/assets/logo-sntss.png'
import seccion7 from '@/assets/seccion7.png'

export default function RecuperarPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const { toast } = useToast()
    const auth = getAuth()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await sendPasswordResetEmail(auth, email)
            setSent(true)
            toast({
                title: "Correo enviado",
                description: "Se ha enviado un correo para restablecer tu contraseña.",
            })
        } catch (error: any) {
            console.error('Error reset password:', error)
            toast({
                title: "Error",
                description: "No se pudo enviar el correo. Verifica que el correo sea correcto.",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen w-full bg-background font-sans overflow-hidden">
            {/* Narrative Section (Left) */}
            <div className="hidden lg:flex lg:w-5/12 relative flex-col justify-between bg-gradient-to-br from-red-950 via-red-900 to-red-800 text-white p-8 lg:p-12 min-h-screen overflow-hidden">
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-900/30 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                </div>
                <div className="relative z-10">
                    <Image src={logoSNTSS} alt="SNTSS Logo" width={120} height={60} className="object-contain" priority />
                </div>
                <div className="relative z-10 flex-1 flex items-center max-w-lg">
                    <div>
                        <h1 className="text-5xl font-bold tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-red-100 to-red-200">
                            Recuperar Acceso
                        </h1>
                        <p className="text-lg text-red-100 leading-relaxed font-light">
                            No te preocupes, te ayudaremos a recuperar tu contraseña para que sigas gestionando tus trámites.
                        </p>
                    </div>
                </div>
            </div>

            {/* Form Section (Right) */}
            <div className="w-full lg:w-7/12 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 bg-white dark:bg-background min-h-screen">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="w-full max-w-md space-y-8"
                >
                    <div className="flex justify-center lg:justify-start">
                        <Link href="/login" className="flex items-center text-sm text-slate-500 hover:text-red-600 transition-colors">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver al inicio de sesión
                        </Link>
                    </div>

                    <div className="text-center lg:text-left space-y-2">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground">
                            ¿Olvidaste tu contraseña?
                        </h2>
                        <p className="text-sm sm:text-base text-slate-500 dark:text-muted-foreground">
                            Ingresa tu correo electrónico y te enviaremos las instrucciones para restablecerla.
                        </p>
                    </div>

                    {!sent ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="correo@ejemplo.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-11"
                                    disabled={loading}
                                />
                            </div>
                            <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    'Enviar instrucciones'
                                )}
                            </Button>
                        </form>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-green-50 dark:bg-green-900/20 p-6 rounded-2xl border border-green-100 dark:border-green-900/30 text-center space-y-4"
                        >
                            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                                <ArrowLeft className="h-6 w-6 rotate-90" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-green-900 dark:text-green-400">¡Correo enviado!</h3>
                                <p className="text-sm text-green-800 dark:text-green-500">
                                    Revisa tu bandeja de entrada. Si no lo encuentras, revisa tu carpeta de spam.
                                </p>
                            </div>
                            <Button asChild variant="outline" className="w-full">
                                <Link href="/login">Regresar al login</Link>
                            </Button>
                        </motion.div>
                    )}

                    <div className="text-center text-xs text-slate-400 dark:text-muted-foreground">
                        <p>&copy; {new Date().getFullYear()} Sección VII - SNTSS. Todos los derechos reservados.</p>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
