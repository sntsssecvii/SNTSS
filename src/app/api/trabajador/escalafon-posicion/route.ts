import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUserRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { RateLimitError } from "@/lib/security/rate-limit";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import type { EscalafonAspirante, EscalafonListado } from "@/types/escalafon";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);

    await enforceRateLimitRedis(request, {
      bucket: "api:trabajador:escalafon-posicion",
      limit: 20,
      windowMs: 60_000,
    });

    const context = await requireUserRequest(request);
    const matricula = context.matricula;

    if (!matricula) {
      return NextResponse.json(
        { error: "El usuario autenticado no tiene matrícula vinculada." },
        { status: 400 },
      );
    }

    // Buscar todos los registros del aspirante en escalafón_aspirantes
    const aspirantesSnap = await adminDb
      .collection("escalafon_aspirantes")
      .where("matricula", "==", matricula)
      .get();

    if (aspirantesSnap.empty) {
      return NextResponse.json(
        {
          error: "No se encontró tu matrícula en ningún listado de escalafón.",
        },
        { status: 404 },
      );
    }

    const aspirantes = aspirantesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EscalafonAspirante[];

    // Obtener los listados correspondientes (deduplicados por listadoId)
    const listadoIds = [...new Set(aspirantes.map((a) => a.listadoId))];
    const listadosMap = new Map<string, EscalafonListado>();

    await Promise.all(
      listadoIds.map(async (listadoId) => {
        const doc = await adminDb
          .collection("escalafon_listados")
          .doc(listadoId)
          .get();
        if (doc.exists) {
          listadosMap.set(listadoId, {
            id: doc.id,
            ...doc.data(),
          } as EscalafonListado);
        }
      }),
    );

    // Construir respuesta: uno por listado (tomar el primer registro del aspirante en ese listado)
    const data = listadoIds
      .map((listadoId) => {
        const listado = listadosMap.get(listadoId);
        if (!listado) return null;

        // Un aspirante puede tener múltiples registros en el mismo listado (por preferencias duplicadas)
        // Tomamos el único con lugar válido
        const aspirante = aspirantes.find((a) => a.listadoId === listadoId);
        if (!aspirante) return null;

        return {
          listadoId,
          categoriaCode: listado.categoriaCode,
          categoriaDesc: listado.categoriaDesc,
          areaCode: listado.areaCode,
          areaDesc: listado.areaDesc,
          vigenciaInicio: listado.vigenciaInicio,
          vigenciaFin: listado.vigenciaFin,
          periodoDecierre: listado.periodoDecierre,
          lugar: aspirante.lugar,
          estatus: aspirante.estatus,
          preferencias: aspirante.preferencias,
          posicionesPorZona: aspirante.posicionesPorZona ?? {},
          posicionesActivoPorZona: aspirante.posicionesActivoPorZona ?? {},
          posicionesPeiPorZona: aspirante.posicionesPeiPorZona ?? {},
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const err = error as { message?: string };

    if (err?.message === "CORS_FORBIDDEN") {
      return NextResponse.json(
        { error: "Acceso no permitido." },
        { status: 403 },
      );
    }

    if (error instanceof RateLimitError || err?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              (error as RateLimitError).retryAfterSeconds || 60,
            ),
          },
        },
      );
    }

    if (err?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (err?.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Perfil de usuario no encontrado." },
        { status: 404 },
      );
    }

    if (err?.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { error: "La cuenta no está activa." },
        { status: 403 },
      );
    }

    console.error("[trabajador/escalafon-posicion]", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
