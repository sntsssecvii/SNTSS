'use client'

import AdminValidacion from '@/components/admin/AdminValidacion'
import { motion } from 'framer-motion'
import { ShieldCheck, Users, Clock, UserX } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/firebase-client'
import { Badge } from '@/components/ui/badge'

export default function ValidacionesPage() {
    const [counts, setCounts] = useState({ pending: 0, active: 0, rejected: 0 })

    useEffect(() => {
        const createQuery = (status: string) => query(collection(db, 'users'), where('status', '==', status))

        const unsubPending = onSnapshot(createQuery('pending'), s => setCounts(prev => ({ ...prev, pending: s.size })))
        const unsubActive = onSnapshot(createQuery('active'), s => setCounts(prev => ({ ...prev, active: s.size })))
        const unsubRejected = onSnapshot(createQuery('rejected'), s => setCounts(prev => ({ ...prev, rejected: s.size })))

        return () => {
            unsubPending()
            unsubActive()
            unsubRejected()
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

            <Tabs defaultValue="pending" className="w-full">
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
                        <AdminValidacion filterStatus="pending" />
                    </motion.div>
                </TabsContent>

                <TabsContent value="active">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <AdminValidacion filterStatus="active" />
                    </motion.div>
                </TabsContent>

                <TabsContent value="rejected">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <AdminValidacion filterStatus="rejected" />
                    </motion.div>
                </TabsContent>
            </Tabs>
        </main>
    )
}
