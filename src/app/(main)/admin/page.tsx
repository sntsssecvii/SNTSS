'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import DashboardChips from '@/components/admin/DashboardChips'
import BolsaDeTrabajoGrid from '@/components/admin/BolsaDeTrabajoGrid'
import { isAdminRole, isSuperAdminRole } from '@/lib/auth/roles'

export default function AdminPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()
  const [greetingInfo, setGreetingInfo] = useState({ greeting: 'Hola', dayMessage: '' })

  useEffect(() => {
    // Normalizamos el rol a mayúsculas para la comparación
    const userRole = userData?.role

    if (!loading && (!user || !isAdminRole(userRole))) {
      router.push('/login')
    }
  }, [user, userData, loading, router])

  useEffect(() => {
    // Generar saludo dinámico
    const hour = new Date().getHours()
    let newGreeting = 'Buenas noches'
    if (hour >= 5 && hour < 12) newGreeting = 'Buenos días'
    else if (hour >= 12 && hour < 19) newGreeting = 'Buenas tardes'

    // Generar mensaje del día
    const days = [
      '¡Feliz Domingo! ☀️',
      '¡Excelente Lunes! 🚀',
      '¡Gran Martes! ⚡️',
      '¡Feliz Miércoles! 🐪',
      '¡Casi Viernes! Jueves 💪',
      '¡Por fin es Viernes! 🎉',
      '¡Gran Sábado! 🍻',
    ]
    const dayIndex = new Date().getDay()
    
    setGreetingInfo({
      greeting: newGreeting,
      dayMessage: days[dayIndex]
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user || !isAdminRole(userData?.role)) {
    return null
  }

  return (
    <main className="container mx-auto p-4 md:p-8 min-h-[calc(100vh-4rem)] flex flex-col justify-center">
      <div className="max-w-7xl w-full mx-auto my-8 md:my-12">
        {/* HERO HEADER */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 shadow-sm">
            <Sparkles className="h-4 w-4" />
            SNTSS Sección VII • {greetingInfo.dayMessage}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent mb-4 tracking-tight">
            {greetingInfo.greeting}, <span className="text-primary">{userData?.nombre?.split(' ')[0]}</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium mb-8">
            Bienvenido al Panel de Control. Selecciona un módulo para comenzar a gestionar la plataforma operativa.
          </p>

          <DashboardChips />
        </motion.div>

        {/* MAIN LAYOUT SPLIT */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-8">
          
          {/* LEFT COLUMN: QUICK ACCESS CARDS */}
          <div className="xl:col-span-4 flex flex-col h-full gap-4 sm:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 h-8 sm:h-10">
              <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                Accesos Rápidos
              </h3>
            </div>

            <div className="flex flex-col gap-5 sm:gap-6 flex-1">
              {/* Módulo Bolsa de Trabajo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex-1"
              >
                <Link href="/admin/bolsa-de-trabajo" className="block h-full group">
                  <div className="relative h-full bg-white dark:bg-slate-900 rounded-[2rem] p-6 lg:p-8 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 flex flex-col justify-center gap-4">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                      <Users className="w-40 h-40" />
                    </div>
                    
                    <div className="relative z-10 flex items-center justify-between gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner shrink-0">
                        <Users className="h-8 w-8" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white leading-tight mb-2">
                          Bolsa de Trabajo
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs lg:text-sm leading-relaxed line-clamp-2 font-medium">
                          Gestión administrativa de los módulos y formatos quincenales oficiales.
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-primary/5 text-primary flex items-center justify-center shrink-0 transition-transform transform group-hover:translate-x-1 group-hover:bg-primary group-hover:text-white">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>

              {/* Módulo Validaciones */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex-1"
              >
                <Link href="/admin/validaciones" className="block h-full group">
                  <div className="relative h-full bg-white dark:bg-slate-900 rounded-[2rem] p-6 lg:p-8 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 hover:border-emerald-500/30 flex flex-col justify-center gap-4">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                      <ShieldCheck className="w-40 h-40" />
                    </div>
                    
                    <div className="relative z-10 flex items-center justify-between gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner shrink-0">
                        <ShieldCheck className="h-8 w-8" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white leading-tight mb-2">
                          Validaciones
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs lg:text-sm leading-relaxed line-clamp-2 font-medium">
                          Aprobar nuevas cuentas delegacionales y asignar privilegios.
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-emerald-500/5 text-emerald-600 flex items-center justify-center shrink-0 transition-transform transform group-hover:translate-x-1 group-hover:bg-emerald-500 group-hover:text-white">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>

              {isSuperAdminRole(userData?.role) ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="flex-1"
                >
                  <Link href="/admin/global" className="block h-full group">
                    <div className="relative h-full bg-white dark:bg-slate-900 rounded-[2rem] p-6 lg:p-8 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 hover:border-amber-500/30 flex flex-col justify-center gap-4">
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                        <ShieldCheck className="w-40 h-40" />
                      </div>

                      <div className="relative z-10 flex items-center justify-between gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner shrink-0">
                          <ShieldCheck className="h-8 w-8" />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white leading-tight mb-2">
                            Admin Global
                          </h2>
                          <p className="text-slate-500 dark:text-slate-400 text-xs lg:text-sm leading-relaxed line-clamp-2 font-medium">
                            Gestiona roles, estatus y gobierno operativo de usuarios internos.
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-amber-500/5 text-amber-600 flex items-center justify-center shrink-0 transition-transform transform group-hover:translate-x-1 group-hover:bg-amber-500 group-hover:text-white">
                          <ArrowRight className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ) : null}
            </div>
          </div>

          {/* RIGHT COLUMN: DETAILED STATS GRID */}
          <div className="xl:col-span-8 flex flex-col">
            <BolsaDeTrabajoGrid />
          </div>
        </div>
      </div>
    </main>
  )
}
