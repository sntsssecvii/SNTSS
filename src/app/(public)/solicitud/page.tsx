// src/app/(public)/solicitud/page.tsx
import SolicitudForm from "@/components/propuestas/SolicitudForm";

export const metadata = { title: "Solicitud de Propuesta — SNTSS" };

export default function SolicitudPage() {
  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Solicitud de Propuesta Sindical
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          SNTSS — Sección VII Baja California
        </p>
      </div>
      <SolicitudForm />
    </main>
  );
}
