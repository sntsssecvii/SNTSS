'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import RegistroForm from '@/components/registro/RegistroForm'
import logoSNTSS from '@/assets/logo-sntss.png'

export default function RegistroPage() {
    return (
        <div className="min-h-screen w-full relative overflow-hidden bg-slate-50 flex flex-col selection:bg-red-100 selection:text-red-900">

            {/* Background optimizado: evitar animaciones infinitas y blur excesivo durante escritura */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-gradient-to-br from-red-500/10 to-orange-400/5 rounded-full blur-[110px]" />
                <div className="absolute bottom-[-15%] right-[-5%] w-[50%] h-[50%] bg-gradient-to-tr from-red-900/10 to-red-600/5 rounded-full blur-[90px]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
            </div>

            <div className="container mx-auto px-4 py-10 relative z-10 flex-1 flex flex-col max-w-7xl">
                {/* Superior Header */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="flex justify-between items-center mb-16"
                >
                    <Link href="/" className="flex items-center gap-4 group">
                        <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200 shadow-sm transition-transform group-hover:scale-105 group-hover:rotate-1">
                            <Image
                                src={logoSNTSS}
                                alt="SNTSS Logo"
                                width={80}
                                height={40}
                                className="object-contain"
                            />
                        </div>
                        <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-700">Sección VII</span>
                            <span className="text-xs font-bold text-slate-500">Acceso para agremiados</span>
                        </div>
                    </Link>

                    <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-red-700 transition-colors">
                        ¿Ya tienes cuenta? <span className="text-red-700 font-black ml-1">Ingresar</span>
                    </Link>
                </motion.header>

                {/* Main Body */}
                <div className="flex-1 flex flex-col items-center justify-center pb-20">
                    <div className="w-full max-w-3xl space-y-12">

                        <div className="text-center space-y-6">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.6 }}
                                className="inline-block"
                            >
                                <span className="rounded-full bg-red-100 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-red-700 border border-red-200/50">
                                    Registro de Agremiados
                                </span>
                                <h2 className="mt-6 text-5xl md:text-6xl font-black tracking-tighter text-slate-950 leading-[0.95]">
                                    Solicita tu acceso <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-500">al portal sindical.</span>
                                </h2>
                            </motion.div>

                            <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="text-lg text-slate-500 max-w-xl mx-auto font-medium"
                            >
                                Registra tus datos para solicitar acceso a los servicios, trámites e información oficial que el sindicato pone a disposición de sus agremiados.
                            </motion.p>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="relative group"
                        >
                            <div className="absolute -inset-2 bg-gradient-to-br from-red-500/10 via-transparent to-orange-500/10 rounded-[3rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <div className="relative bg-white/95 border border-white/60 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] p-px">
                                <div className="overflow-hidden rounded-[2.5rem]">
                                    <RegistroForm />
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto pt-6"
                        >
                            {['Seguridad', 'Transparencia', 'Rapidez', 'Oficial'].map((tag) => (
                                <div key={tag} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-100/50 border border-slate-200/40">
                                    <ShieldCheck className="h-4 w-4 text-red-600" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tag}</span>
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </div>

                {/* Professional Footer */}
                <motion.footer
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-center text-slate-400 text-xs font-medium py-8 border-t border-slate-200/60"
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-6">
                            <span className="hover:text-red-700 cursor-pointer transition-colors">Aviso de Privacidad</span>
                            <span className="hover:text-red-700 cursor-pointer transition-colors">Términos de Uso</span>
                            <span className="hover:text-red-700 cursor-pointer transition-colors">Soporte Tecnológico</span>
                        </div>
                        <p>© {new Date().getFullYear()} Sindicato Nacional de Trabajadores del Seguro Social · Sección VII</p>
                    </div>
                </motion.footer>
            </div>
        </div>
    )
}
