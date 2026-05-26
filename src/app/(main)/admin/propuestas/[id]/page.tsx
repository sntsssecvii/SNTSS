"use client";
import CasoDetalle from "@/components/propuestas/CasoDetalle";

export default function CasoPage({ params }: { params: { id: string } }) {
  return <CasoDetalle id={params.id} />;
}
