import Image from "next/image";
import SolicitudForm from "@/components/propuestas/SolicitudForm";
import logoSNTSS from "@/assets/logo-sntss.png";
import seccion7 from "@/assets/seccion7.png";

export const metadata = { title: "Solicitud de Propuesta Sindical — SNTSS" };

export default function SolicitudPage() {
  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-slate-50 flex flex-col selection:bg-red-100 selection:text-red-900">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-gradient-to-br from-red-500/10 to-orange-400/5 rounded-full blur-[110px]" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[50%] h-[50%] bg-gradient-to-tr from-red-900/10 to-red-600/5 rounded-full blur-[90px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-10 relative z-10 flex-1 flex flex-col max-w-2xl">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/80 border border-slate-200 shadow-sm">
              <Image
                src={logoSNTSS}
                alt="SNTSS Logo"
                width={64}
                height={32}
                className="object-contain"
              />
            </div>
            <div className="hidden sm:block h-6 w-px bg-slate-200" />
            <div className="hidden sm:flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-700">
                Sección VII
              </span>
              <span className="text-xs font-bold text-slate-500">
                Baja California
              </span>
            </div>
          </div>
          <Image
            src={seccion7}
            alt="Sección VII"
            width={48}
            height={48}
            className="object-contain opacity-70"
          />
        </header>

        {/* Hero */}
        <div className="text-center mb-8 space-y-3">
          <span className="inline-block rounded-full bg-red-100 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-red-700 border border-red-200/50">
            Oficina de Admisión y Cambios
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-950 leading-[1.05]">
            Solicitud de{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-700 to-red-500">
              Propuesta Sindical
            </span>
          </h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Completa el formulario para registrar la solicitud de ingreso de un
            familiar al sindicato. La oficina revisará tu caso y te notificará
            el resultado.
          </p>
        </div>

        {/* Info box */}
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 mb-6 text-sm text-amber-800">
          <p className="font-bold mb-1">¿Qué necesitas?</p>
          <ul className="space-y-0.5 text-amber-700 font-medium">
            <li>· Tu matrícula IMSS</li>
            <li>· CURP del familiar aspirante</li>
            <li>· INE del familiar (JPG, PNG o PDF)</li>
          </ul>
        </div>

        {/* Form */}
        <SolicitudForm />
      </div>
    </div>
  );
}
