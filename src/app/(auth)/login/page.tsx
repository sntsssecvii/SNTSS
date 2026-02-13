'use client'

import LoginForm from '@/components/LoginForm'
import Image from 'next/image'
import { motion } from 'framer-motion'
import logoSNTSS from '@/assets/logo-sntss.png'
import seccion7 from '@/assets/seccion7.png'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full bg-background font-sans overflow-hidden">
      {/* Narrative Section (Left) - Institutional & Modern */}
      <div className="hidden lg:flex lg:w-5/12 relative flex-col justify-between bg-gradient-to-br from-red-950 via-red-900 to-red-800 text-white p-8 lg:p-12 min-h-screen overflow-hidden">

        {/* Abstract Background Patterns - Animated */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-900/30 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"
          />
          <motion.div
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
            className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-red-800/30 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"
          />

          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
        </div>

        {/* Content Container with Stagger */}
        <motion.div
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col min-h-full justify-between py-8"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.15, delayChildren: 0.3 }
            }
          }}
        >
          {/* Header Content */}
          <motion.div
            variants={{
              hidden: { y: -20, opacity: 0 },
              visible: { y: 0, opacity: 1 }
            }}
            className="flex items-center gap-4 flex-shrink-0"
          >
            <Image
              src={logoSNTSS}
              alt="SNTSS Logo"
              width={120}
              height={60}
              className="object-contain"
              priority
            />
          </motion.div>

          {/* Main Content - Centered */}
          <div className="flex-1 flex items-center max-w-lg">
            <div>
              <motion.h1
                variants={{
                  hidden: { y: 20, opacity: 0 },
                  visible: { y: 0, opacity: 1 }
                }}
                className="text-5xl font-bold tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-red-100 to-red-200"
              >
                Sección VII<br />SNTSS
              </motion.h1>
              <motion.p
                variants={{
                  hidden: { y: 20, opacity: 0 },
                  visible: { y: 0, opacity: 1 }
                }}
                className="text-lg text-red-100 leading-relaxed font-light"
              >
                Sistema de gestión integral para la administración eficiente, segura y conectada de la Sección VII del SNTSS.
              </motion.p>
            </div>
          </div>

          {/* Footer Content */}
          <motion.div
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1 }
            }}
            className="flex items-center gap-4 text-xs font-medium text-red-200 uppercase tracking-widest flex-shrink-0"
          >
            <div className="w-8 h-[1px] bg-red-700" />
            Sección VII - SNTSS
          </motion.div>
        </motion.div>
      </div>

      {/* Login Section (Right) */}
      <div className="w-full lg:w-7/12 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 bg-white dark:bg-background min-h-screen overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="w-full max-w-md space-y-6 sm:space-y-8 lg:space-y-10 py-4 sm:py-6"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center justify-center mb-4 sm:mb-6 gap-3 sm:gap-4">
            <Image
              src={logoSNTSS}
              alt="SNTSS Logo"
              width={120}
              height={60}
              className="object-contain sm:w-[150px] sm:h-[75px]"
              priority
            />
            <Image
              src={seccion7}
              alt="Sección VII SNTSS"
              width={100}
              height={100}
              className="object-contain sm:w-[120px] sm:h-[120px]"
            />
            <span className="font-bold text-lg sm:text-xl text-red-600 dark:text-red-500 text-center">Sección VII - SNTSS</span>
          </div>

          {/* Desktop Logo Sección VII */}
          <div className="hidden lg:flex justify-center mb-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Image
                src={seccion7}
                alt="Sección VII SNTSS"
                width={150}
                height={150}
                className="object-contain"
              />
            </motion.div>
          </div>

          <div className="space-y-2 sm:space-y-3 lg:space-y-4 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground">
              Bienvenido de nuevo
            </h2>
            <p className="text-sm sm:text-base text-slate-500 dark:text-muted-foreground">
              Ingresa tus credenciales para acceder al sistema de la Sección VII del SNTSS.
            </p>
          </div>

          {/* Login Form Container - Minimalist */}
          <div className="bg-white dark:bg-card p-0 lg:p-0 rounded-2xl border dark:border-border">
            <LoginForm />
          </div>

          <div className="pt-4 sm:pt-6 lg:pt-8 text-center text-xs sm:text-sm text-slate-400 dark:text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Sección VII - SNTSS. Todos los derechos reservados.</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
