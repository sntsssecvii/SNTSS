import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BellRing, BriefcaseBusiness, Building2, FileText, LogIn, ShieldCheck, Sparkles, Users2, Waypoints } from 'lucide-react'

import logoSNTSS from '@/assets/logo-sntss.png'
import seccion7 from '@/assets/seccion7.png'
import { Button } from '@/components/ui/button'

const accesos = [
  {
    title: 'Mi portal sindical',
    description: 'Consulta tus trámites, tus movimientos y la información que el sindicato pone a tu disposición.',
    href: '/login',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Convocatorias y avisos',
    description: 'Enterate de avisos, convocatorias y publicaciones oficiales de interés para la base trabajadora.',
    href: '/login',
    icon: BellRing,
  },
  {
    title: 'Servicios y beneficios',
    description: 'Consulta apoyos, servicios y beneficios que el sindicato acerque a sus agremiados.',
    href: '/login',
    icon: FileText,
  },
]

const razones = [
  'Consulta tus trámites y movimientos en un solo lugar.',
  'Recibe información sindical de forma más clara y ordenada.',
  'Acércate a servicios y avisos oficiales sin depender de canales dispersos.',
]

const indicadores = [
  { value: '8', label: 'tipos de trámite integrados' },
  { value: '1', label: 'sitio central de consulta sindical' },
  { value: '24/7', label: 'acceso a información relevante' },
]

const experiencia = [
  {
    title: 'Consulta con más claridad',
    description: 'Menos vueltas y menos dudas para encontrar con rapidez lo que necesitas revisar.',
    icon: Sparkles,
  },
  {
    title: 'Seguimiento de tus movimientos',
    description: 'Tus trámites y cambios en un espacio más ordenado y más fácil de consultar.',
    icon: Waypoints,
  },
  {
    title: 'Comunicación oficial más cercana',
    description: 'Avisos, convocatorias y publicaciones del sindicato presentados con mayor claridad.',
    icon: BellRing,
  },
]

const momentos = [
  'Ingresas con tu cuenta sindical.',
  'Encuentras tus trámites, tus movimientos y la información que te corresponde consultar.',
  'Das seguimiento a publicaciones y avisos oficiales en un solo sitio.',
]

export default function PublicHomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 selection:bg-red-200 selection:text-red-900">
      {/* Navbar flotante y minimalista */}
      <div className="fixed left-0 right-0 top-6 z-50 mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
        <nav className="flex items-center justify-between rounded-full border border-white/40 bg-white/60 px-6 py-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:bg-white/80 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="flex items-center gap-4">
            <Image src={logoSNTSS} alt="SNTSS" width={100} height={50} className="h-10 w-auto object-contain drop-shadow-sm" priority />
            <div className="hidden flex-col sm:flex">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-700">Sección VII</span>
              <span className="text-xs font-semibold text-slate-500">Portal Agremiados</span>
            </div>
          </div>

          <div className="hidden items-center gap-8 text-sm font-bold text-slate-600 md:flex">
            <span className="cursor-pointer transition-colors hover:text-red-700">Inicio</span>
            <span className="cursor-pointer transition-colors hover:text-red-700">Servicios</span>
            <span className="cursor-pointer transition-colors hover:text-red-700">Avisos</span>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="hidden h-10 rounded-full px-5 text-sm font-bold hover:bg-slate-100 sm:flex">
              <Link href="/registro">Solicitar acceso</Link>
            </Button>
            <Button asChild className="group h-10 rounded-full bg-red-700 px-5 text-sm font-bold text-white shadow-lg shadow-red-700/20 transition-all hover:scale-105 hover:bg-red-800 hover:shadow-red-700/40">
              <Link href="/login">
                Entrar
                <LogIn className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </nav>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-[85vh] overflow-hidden pt-32 lg:pt-40 pb-20">
        {/* Background Effects */}
        <div className="absolute inset-0 z-0">
          <div className="absolute -left-[10%] -top-[10%] h-[50rem] w-[50rem] animate-pulse rounded-full bg-red-300/20 blur-[120px]" style={{ animationDuration: '8s' }} />
          <div className="absolute -right-[10%] top-[20%] h-[40rem] w-[40rem] animate-pulse rounded-full bg-orange-300/20 blur-[120px]" style={{ animationDuration: '10s' }} />
          <div className="absolute bottom-0 left-[20%] h-[30rem] w-[50rem] rounded-full bg-rose-200/20 blur-[100px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_70%,transparent_100%)]" />
        </div>

        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col px-5 sm:px-8 lg:px-10">
          <div className="grid flex-1 items-center gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-8">

            {/* Left Content */}
            <div className="space-y-10">
              <div className="inline-flex animate-fade-in-up items-center gap-2 rounded-full border border-red-200/50 bg-white/50 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-red-700 shadow-sm backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
                Servicios en línea para trabajadores
              </div>

              <div className="space-y-6">
                <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-slate-900 sm:text-6xl md:text-7xl lg:text-[5rem]">
                  Servicios sindicales <br />
                  <span className="bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">más cerca de ti.</span>
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
                  Consulta tu información, tus trámites y los avisos oficiales del sindicato en un sitio más claro, más ágil y pensado para la base trabajadora.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" className="group h-14 rounded-full bg-slate-900 px-8 text-base font-bold shadow-xl shadow-slate-900/20 transition-all hover:-translate-y-1 hover:bg-slate-800 hover:shadow-2xl hover:shadow-slate-900/40">
                  <Link href="/login">
                    Ingresar al portal
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-slate-200 bg-white/50 px-8 text-base font-bold backdrop-blur-sm transition-all hover:bg-white hover:shadow-md">
                  <Link href="/registro">Solicitar mi cuenta</Link>
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-4">
                {indicadores.map((item, i) => (
                  <div key={item.label} className="group flex flex-col justify-center border-l-2 border-red-100 pl-4 transition-colors hover:border-red-500 delay-[${i * 100}ms]">
                    <span className="text-3xl font-black tracking-tighter text-slate-900 group-hover:text-red-700 transition-colors">{item.value}</span>
                    <span className="mt-1 text-xs font-semibold leading-snug text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Content / Glassmorphic Showcase */}
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <div className="absolute -inset-1 z-0 animate-pulse rounded-[3rem] bg-gradient-to-tr from-red-400/40 via-orange-300/40 to-rose-400/40 blur-2xl" style={{ animationDuration: '4s' }} />

              <div className="relative z-10 overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/60 p-8 shadow-[0_40px_100px_rgb(0,0,0,0.08)] backdrop-blur-2xl">
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg">
                      <BriefcaseBusiness className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Acceso Rápido</p>
                      <p className="text-lg font-black text-slate-800">Acceso sindical</p>
                    </div>
                  </div>
                  <Image src={seccion7} alt="Sección VII" width={48} height={48} className="h-12 w-12 opacity-80" />
                </div>

                <div className="space-y-4">
                  {razones.map((item, i) => (
                    <div key={i} className="group relative flex items-start gap-4 rounded-2xl border border-white/50 bg-white/40 p-4 transition-all hover:bg-white/80 hover:shadow-sm">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 transition-transform group-hover:scale-110">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-slate-600">{item}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-xl">
                  <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-2">Compromiso</p>
                  <p className="font-semibold leading-snug">&ldquo;Un servicio más claro y más cercano para las y los trabajadores.&rdquo;</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="relative z-20 mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="mb-16 flex flex-col gap-4 text-center items-center">
          <span className="inline-block rounded-full bg-red-100 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-red-700">Servicios disponibles</span>
          <h2 className="max-w-3xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
            Todo lo que necesitas, <span className="text-red-700">a un clic de distancia.</span>
          </h2>
          <p className="max-w-2xl text-lg text-slate-500">
            Accesos y servicios pensados para facilitar consultas frecuentes de la base trabajadora.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accesos.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white p-8 shadow-sm transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-red-900/5"
              >
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-red-50 transition-transform duration-500 group-hover:scale-[2.5]" />
                <div className="relative z-10">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/30 transition-transform group-hover:scale-110 group-hover:rotate-3">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-3 text-2xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-red-700">{item.title}</h3>
                  <p className="mb-8 flex-1 text-slate-500 leading-relaxed">{item.description}</p>
                  <div className="mt-auto flex items-center text-sm font-bold text-slate-900 transition-colors group-hover:text-red-700">
                    Conocer más
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-2" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Experience / Why Use It Section */}
      <section className="relative overflow-hidden bg-slate-900 py-24 text-white">
        <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(ellipse_at_top,#7f1d1d_0%,transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">

            <div>
              <span className="text-xs font-black uppercase tracking-widest text-red-400">Mejorando la comunicación</span>
              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Diseñado pensando en tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">facilidad.</span>
              </h2>
              <p className="mt-6 text-lg text-slate-400 max-w-xl">
                La intención principal es que el trabajador encuentre información útil con menos esfuerzo y con una navegación clara desde cualquier dispositivo.
              </p>

              <div className="mt-10 space-y-6">
                {experiencia.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="flex gap-5 group">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-red-400 transition-colors group-hover:bg-red-500 group-hover:text-white border border-white/5">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{item.title}</h3>
                        <p className="text-slate-400 mt-1 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="relative lg:pl-10">
              <div className="relative rounded-[2.5rem] border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl">
                <div className="absolute top-4 right-4 flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400/50" />
                  <div className="h-3 w-3 rounded-full bg-orange-400/50" />
                  <div className="h-3 w-3 rounded-full bg-green-400/50" />
                </div>
                <h3 className="text-2xl font-black mb-8 pt-4">¿Cómo funciona?</h3>
                <div className="space-y-4">
                  {momentos.map((item, index) => (
                    <div key={index} className="flex gap-4 items-center rounded-2xl bg-white/5 p-4 border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 font-black shadow-lg shadow-red-600/20">
                        {index + 1}
                      </div>
                      <p className="font-medium text-slate-200">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Call to Action Premium */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-red-700 via-red-800 to-slate-900 px-8 py-16 sm:px-16 text-center shadow-2xl shadow-red-900/20">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
            <div className="relative z-10 max-w-3xl mx-auto space-y-8">
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                Consulta tus servicios sindicales desde un solo lugar.
              </h2>
              <p className="text-xl text-red-100/80">
                Accede a tu cuenta y mantente al tanto de trámites, avisos y servicios que el sindicato pone a tu disposición.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="h-16 rounded-full bg-white px-10 text-lg font-black text-red-800 shadow-xl hover:bg-slate-50 hover:scale-105 transition-all">
                  <Link href="/login">
                    Iniciar Sesión
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-16 rounded-full border-white/30 bg-transparent px-10 text-lg font-black text-white hover:bg-white/10 transition-all">
                  <Link href="/registro">
                    Soy nuevo, registrarme
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-3 lg:px-10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3">
              <Image src={logoSNTSS} alt="SNTSS" width={50} height={50} className="w-10 opacity-80 grayscale" />
              <span className="font-black tracking-widest text-slate-800 uppercase text-xs">SNTSS Sección VII</span>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-slate-500 max-w-sm">
              Sitio institucional para acercar trámites, información y servicios a las y los trabajadores agremiados de forma clara y segura.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Navegación</h4>
            <Link href="/login" className="text-sm font-semibold text-slate-500 hover:text-red-700 transition-colors">Portal de Ingreso</Link>
            <Link href="/registro" className="text-sm font-semibold text-slate-500 hover:text-red-700 transition-colors">Solicitar Registro</Link>
            <Link href="#" className="text-sm font-semibold text-slate-500 hover:text-red-700 transition-colors">Convocatorias</Link>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Soporte</h4>
            <p className="text-sm text-slate-500">¿Tienes dudas con tu acceso?</p>
            <Link href="mailto:soporte@sntss-seccion7.mx" className="inline-flex items-center text-sm font-bold text-red-700 hover:underline">
              Contactar a soporte <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-100 py-6 text-center">
          <p className="text-xs text-slate-400 font-medium">© {new Date().getFullYear()} Sindicato Nacional de Trabajadores del Seguro Social. Sección VII.</p>
        </div>
      </footer>
    </main>
  )
}
