'use client'

import AdminValidacion from '@/components/admin/AdminValidacion'
import { motion } from 'framer-motion'
import { ShieldCheck, Users, Clock, UserX } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { auth } from '@/lib/firebase/firebase-client'

interface ValidationSummaryResponse {
    data?: {
        pending?: number
        active?: number
        rejected?: number
    }
    error?: string
}

export default function ValidacionesPage() {
    const [counts, setCounts] = useState({ pending: 0, active: 0, rejected: 0 })
    const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'rejected'>('pending')

    const loadCounts = async () => {
        const currentUser = auth.currentUser
        if (!currentUser) return

        const idToken = await currentUser.getIdToken()
        const response = await fetch('/api/admin/validaciones/resumen', {
            headers: { Authorization: `Bearer ${idToken}` },
            cache: 'no-store',
        })
        const payload = await response.json() as ValidationSummaryResponse

        if (!response.ok) {
            throw new Error(payload.error || `HTTP_${response.status}`)
        }

        setCounts({
            pending: payload.data?.pending ?? 0,
            active: payload.data?.active ?? 0,
            rejected: payload.data?.rejected ?? 0,
        })
    }

    useEffect(() => {
        let cancelled = false

        const syncCounts = async () => {
            try {
                await loadCounts()
            } catch (error) {
                if (!cancelled) {
                    console.error('Error loading validation counts:', error)
                }
            }
        }

        syncCounts()
        const intervalId = window.setInterval(syncCounts, 45_000)

        return () => {
            cancelled = true
            window.clearInterval(intervalId)
        }
    }, [])

    return (
        <main className="container mx-auto py-6 space-y-8">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6"
            >
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                        Validación de Usuarios
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                        Revisa y aprueba las solicitudes de registro de nuevos trabajadores.
                    </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-full border border-red-100">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-sm font-semibold">Panel de Control Administrador</span>
                </div>
            </motion.div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pending' | 'active' | 'rejected')} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-8">
                    <TabsTrigger value="pending" className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Pendientes</span>
                        {counts.pending > 0 && (
                            <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[20px] justify-center">
                                {counts.pending}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="active" className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>Activos</span>
                        {counts.active > 0 && (
                            <Badge variant="outline" className="ml-1 h-5 px-1.5 min-w-[20px] justify-center bg-green-50 text-green-700 border-green-200">
                                {counts.active}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="rejected" className="flex items-center gap-2">
                        <UserX className="w-4 h-4" />
                        <span>Rechazados</span>
                        {counts.rejected > 0 && (
                            <Badge variant="outline" className="ml-1 h-5 px-1.5 min-w-[20px] justify-center bg-red-50 text-red-700 border-red-200">
                                {counts.rejected}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        {activeTab === 'pending' ? <AdminValidacion filterStatus="pending" onDataChanged={loadCounts} /> : null}
                    </motion.div>
                </TabsContent>

                <TabsContent value="active">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        {activeTab === 'active' ? <AdminValidacion filterStatus="active" onDataChanged={loadCounts} /> : null}
                    </motion.div>
                </TabsContent>

                <TabsContent value="rejected">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        {activeTab === 'rejected' ? <AdminValidacion filterStatus="rejected" onDataChanged={loadCounts} /> : null}
                    </motion.div>
                </TabsContent>
            </Tabs>
        </main>
    )
}
