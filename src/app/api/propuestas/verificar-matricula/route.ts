import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { propuestaActivaPorMatricula } from "@/lib/firebase/propuestas";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:propuestas:verificar",
      limit: 20,
      windowMs: 60_000,
    });

    const body = await request.json();
    const matricula = String(body?.matricula || "")
      .trim()
      .toUpperCase();

    if (!matricula || matricula.length < 4) {
      return NextResponse.json(
        { error: "Matrícula inválida." },
        { status: 400 },
      );
    }

    // Verificar que existe en padrón (colección users)
    const usersSnap = await adminDb
      .collection("users")
      .where("matricula", "==", matricula)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (usersSnap.empty) {
      return NextResponse.json({
        valida: false,
        razon: "matricula_no_encontrada",
      });
    }

    // Verificar que no tiene propuesta activa
    const propuestaActiva = await propuestaActivaPorMatricula(matricula);
    if (propuestaActiva) {
      return NextResponse.json({
        valida: false,
        razon: "propuesta_activa",
        numeroCaso: propuestaActiva.numeroCaso,
      });
    }

    return NextResponse.json({ valida: true });
  } catch (error: any) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }
    console.error("[verificar-matricula]", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
