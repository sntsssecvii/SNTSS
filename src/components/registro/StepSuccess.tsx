"use client"

import { motion } from 'framer-motion'
import { CheckCircle2, Mail, ShieldCheck, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function StepSuccess() {
    const router = useRouter()

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8 py-4"
        >
            {/* Ícono Principal Animado */}
            <div className="relative flex justify-center">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                    className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center relative z-10"
                >
                    <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                </motion.div>

                {/* Ondas decorativas */}
                <motion.div
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-green-400/20 rounded-full"
                />
            </div>

            <div className="space-y-3">
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    ¡Registro Recibido!
                </h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Tu solicitud ha sido enviada con éxito al sistema de validación del SNTSS.
                </p>
            </div>

            {/* Timeline del proceso técnico */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 text-left space-y-6 border border-slate-100 dark:border-slate-700">
                <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Validación de Identidad</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Nuestro equipo administrativo verificará tus documentos y matrícula.</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Notificación por Email</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Recibirás un correo electrónico en cuanto tu cuenta sea activada.</p>
                    </div>
                </div>
            </div>

            <div className="pt-4">
                <Button
                    onClick={() => router.push('/login')}
                    className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white py-6 rounded-xl text-lg font-semibold shadow-lg shadow-red-500/20 group"
                >
                    Entendido, ir al Login
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
            </div>

            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
                Sindicato Nacional de Trabajadores del Seguro Social
            </p>
        </motion.div>
    )
}
