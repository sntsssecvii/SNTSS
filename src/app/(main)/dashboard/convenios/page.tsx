"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase/firebase-client";
import { ConveniosCarrusel } from "@/components/ConveniosCarrusel";
import { Tag } from "lucide-react";
import type { ConvenioPublico } from "@/types/convenios";

export default function ConveniosPage() {
  const { user } = useAuth();
  const [convenios, setConvenios] = useState<ConvenioPublico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchConvenios = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/convenios", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) setConvenios(json.data);
      } finally {
        setLoading(false);
      }
    };
    fetchConvenios();
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Tag className="h-5 w-5 text-amber-600" />
        <h1 className="text-2xl font-black text-slate-900">
          Convenios de Descuento
        </h1>
      </div>

      {loading ? (
        <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
      ) : convenios.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
          <Tag className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">
            Próximamente convenios de descuento para ti
          </p>
        </div>
      ) : (
        <>
          <ConveniosCarrusel convenios={convenios} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {convenios.map((c) => (
              <button
                key={c.id}
                onClick={() =>
                  window.open(
                    c.link || c.imageUrl,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                aria-label={`Ver convenio${c.link ? " (abre enlace)" : ""}`}
                className="rounded-xl overflow-hidden border border-slate-100 hover:border-amber-300 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <img
                  src={c.imageUrl}
                  alt="Convenio de descuento"
                  className="w-full h-auto"
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
