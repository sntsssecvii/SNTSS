'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserCircle, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'

export default function ConsultaTrabajadorPage() {
    const [matricula, setMatricula] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (!matricula.trim()) return

        setLoading(true)
        // Pequeña pausa para efecto dramático/premium
        setTimeout(() => {
            router.push(`/bolsa-de-trabajo/resultado/${matricula.trim().toUpperCase()}`)
        }, 800)
    }

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Luces de fondo decorativas */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-md z-10"
            >
                <div className="flex flex-col items-center text-center space-y-6">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
                        className="w-20 h-20 bg-gradient-to-br from-primary to-primary/50 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-primary/40 relative group"
                    >
                        <UserCircle className="w-10 h-10 text-white" />
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 rounded-lg flex items-center justify-center animate-bounce shadow-lg">
                            <Sparkles className="w-3 h-3 text-amber-900" />
                        </div>
                    </motion.div>

                    <div className="space-y-2">
                        <h1 className="text-4xl font-black text-white tracking-tight">MI POSICIÓN</h1>
                        <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.3em]">Bolsa de Trabajo SNTSS</p>
                    </div>

                    <form onSubmit={handleSearch} className="w-full space-y-4">
                        <div className="relative group">
                            <Input
                                placeholder="Ingresa tu Matrícula"
                                value={matricula}
                                onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                                className="h-16 bg-white/5 border-white/10 text-white placeholder:text-slate-600 rounded-2xl text-center text-xl font-black tracking-widest focus:ring-primary/50 transition-all group-hover:bg-white/10"
                                disabled={loading}
                                autoFocus
                            />
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 pointer-events-none group-focus-within:text-primary transition-colors" />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading || !matricula}
                            className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black text-lg rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? (
                                <div className="flex items-center gap-3">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    CONSULTANDO...
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    VER MI PROGRESO <ArrowRight className="w-6 h-6" />
                                </div>
                            )}
                        </Button>
                    </form>

                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-8">
                        Información oficial de la quincena actual
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
