'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import RegistroForm from '@/components/registro/RegistroForm'
import logoSNTSS from '@/assets/logo-sntss.png'

export default function RegistroPage() {
    return (
        <div className="min-h-screen w-full relative overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">

            {/* Dynamic Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-red-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-red-800/10 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
            </div>

            <div className="container mx-auto px-4 py-8 relative z-10 flex-1 flex flex-col">
                {/* Header */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="flex justify-between items-center mb-12"
                >
                    <div className="flex items-center gap-4">
                        <Image
                            src={logoSNTSS}
                            alt="SNTSS Logo"
                            width={80}
                            height={40}
                            className="object-contain"
                        />
                        <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800" />
                        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                            Registro <span className="text-red-700">Sección VII</span>
                        </h1>
                    </div>
                </motion.header>

                {/* Main Content */}
                <div className="flex-1 flex items-center justify-center pb-12">
                    <div className="w-full">
                        <div className="text-center mb-10 space-y-4">
                            <motion.h2
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white"
                            >
                                Únete a la <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-900">Transformación Digital</span>
                            </motion.h2>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.4 }}
                                className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto"
                            >
                                Completa tu registro para acceder a todos los servicios digitales del SNTSS Sección VII.
                                Tus datos están protegidos con la más alta seguridad.
                            </motion.p>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.5, type: "spring", stiffness: 100 }}
                        >
                            <RegistroForm />
                        </motion.div>
                    </div>
                </div>

                {/* Footer */}
                <motion.footer
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-center text-slate-400 text-sm py-6"
                >
                    <p>© {new Date().getFullYear()} Sindicato Nacional de Trabajadores del Seguro Social - Sección VII</p>
                </motion.footer>
            </div>
        </div>
    )
}
