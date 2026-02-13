'use client'

import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export function LoadingScreen({ message = "Cargando sistema..." }: { message?: string }) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center space-y-4"
            >
                <div className="relative">
                    <motion.div
                        className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 0.8, 0.5],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                    <div className="relative rounded-xl bg-card p-4 shadow-lg ring-1 ring-border">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                </div>

                <div className="space-y-2 text-center">
                    <h3 className="text-xl font-semibold tracking-tight text-foreground">
                        SNTSS
                    </h3>
                    <p className="text-sm text-muted-foreground animate-pulse">
                        {message}
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
