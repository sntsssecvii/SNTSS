"use client";

import LoginForm from "@/components/LoginForm";
import Image from "next/image";
import { motion } from "framer-motion";
import logoSNTSS from "@/assets/logo-sntss.png";
import seccion7 from "@/assets/seccion7.png";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans overflow-hidden selection:bg-red-100 selection:text-red-900">
      {/* Narrative Section (Left) - Institutional & Ultra Modern */}
      <div className="hidden lg:flex lg:w-5/12 relative flex-col justify-between bg-slate-950 text-white p-8 lg:p-12 min-h-screen overflow-hidden">
        {/* Abstract Background Patterns - High-end Aura */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute -top-[10%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-red-600/25 to-orange-500/10 rounded-full blur-[120px]" />
          <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] bg-red-900/15 rounded-full blur-[100px]" />

          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        {/* Content Container */}
        <motion.div
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col min-h-full justify-between py-6"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1, delayChildren: 0.2 },
            },
          }}
        >
          {/* Header Content */}
          <motion.div
            variants={{
              hidden: { y: -20, opacity: 0 },
              visible: { y: 0, opacity: 1 },
            }}
            className="flex items-center gap-4 flex-shrink-0"
          >
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xl">
              <Image
                src={logoSNTSS}
                alt="SNTSS Logo"
                width={100}
                height={50}
                className="object-contain"
                priority
              />
            </div>
          </motion.div>

          {/* Main Content - Centered */}
          <div className="flex-1 flex items-center max-w-lg">
            <div className="space-y-8">
              <div className="space-y-4">
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-red-400"
                >
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Acceso institucional
                </motion.div>
                <motion.h1
                  variants={{
                    hidden: { y: 30, opacity: 0 },
                    visible: { y: 0, opacity: 1 },
                  }}
                  className="text-6xl font-black tracking-tighter leading-[0.9] text-white"
                >
                  Acceso <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
                    seguro.
                  </span>
                </motion.h1>
              </div>
              <motion.p
                variants={{
                  hidden: { y: 20, opacity: 0 },
                  visible: { y: 0, opacity: 1 },
                }}
                className="text-xl text-slate-300 leading-relaxed font-medium"
              >
                Bienvenido al acceso institucional de la Sección VII. Ingresa a
                tu cuenta para consultar la información y los servicios
                disponibles para la base trabajadora.
              </motion.p>
            </div>
          </div>

          {/* Footer Content */}
          <motion.div
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1 },
            }}
            className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex-shrink-0"
          >
            <div className="w-10 h-[1px] bg-white/10" />
            SNTSS Sección VII · Acceso institucional
          </motion.div>
        </motion.div>
      </div>

      {/* Login Section (Right) */}
      <div className="w-full lg:w-7/12 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 bg-white min-h-screen overflow-y-auto">
        <div className="absolute top-0 right-0 w-full h-[30vh] bg-gradient-to-b from-red-50/50 to-transparent pointer-events-none lg:hidden" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md space-y-10 relative z-10"
        >
          {/* Header section with Logo */}
          <div className="flex flex-col items-center lg:items-start space-y-6">
            <Image
              src={seccion7}
              alt="Sección VII SNTSS"
              width={80}
              height={80}
              className="object-contain drop-shadow-md lg:hidden"
            />
            <div className="hidden lg:block relative">
              <div className="absolute -inset-4 bg-red-100 rounded-full blur-2xl opacity-40 animate-pulse" />
              <Image
                src={seccion7}
                alt="Sección VII SNTSS"
                width={70}
                height={70}
                className="relative object-contain"
              />
            </div>

            <div className="space-y-2 text-center lg:text-left">
              <h2 className="text-3xl font-black tracking-tight text-slate-900">
                Iniciar Sesión
              </h2>
              <p className="text-slate-500 font-medium">
                Ingresa con tus datos para consultar tus servicios y tu
                información.
              </p>
            </div>
          </div>

          {/* Login Form Container - Premium Minimalist */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-600/20 to-orange-500/20 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative bg-white lg:bg-slate-50/50 border border-slate-200/60 rounded-[1.5rem] p-1 shadow-sm group-focus-within:border-red-200 transition-colors">
              <LoginForm />
            </div>
          </div>

          <div className="text-center lg:text-left text-xs text-slate-400 font-medium">
            <p>
              &copy; {new Date().getFullYear()} Sindicato Nacional de
              Trabajadores del Seguro Social. <br className="lg:hidden" /> Todos
              los derechos reservados.
            </p>
            <p className="mt-1.5 text-[11px] text-slate-400/80">
              Plataforma desarrollada por{" "}
              <a
                href="https://zentrymx.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-500 hover:text-red-500 transition-colors"
              >
                Zentry Tech Group
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
