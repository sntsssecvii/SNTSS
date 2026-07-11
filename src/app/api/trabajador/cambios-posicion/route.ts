import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUserRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { RateLimitError } from "@/lib/security/rate-limit";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { nombreListadoConEspecialidad } from "@/lib/cambios-escalafon/especialidades-enfermeria";
import type {
  CambiosListado,
  CambiosRegistro,
} from "@/types/cambios-escalafon";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);

    await enforceRateLimitRedis(request, {
      bucket: "api:trabajador:cambios-posicion",
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

    // Buscar registros del trabajador que tengan posicion materializada
    const registrosSnap = await adminDb
      .collection("cambios_registros")
      .where("matricula", "==", matricula)
      .get();

    if (registrosSnap.empty) {
      return NextResponse.json({ success: true, data: [] });
    }

    const registros = registrosSnap.docs
      .map(
        (doc) =>
          ({ id: doc.id, ...doc.data() }) as CambiosRegistro & {
            lugar?: number;
            totalEnGrupo?: number;
            grupoUnidad?: string;
            grupoTurno?: string;
          },
      )
      .filter((r) => r.lugar != null); // solo materializados

    if (registros.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Traer listados correspondientes (deduplicados)
    const listadoIds = [...new Set(registros.map((r) => r.listadoId))];
    const listadosMap = new Map<string, CambiosListado>();

    await Promise.all(
      listadoIds.map(async (listadoId) => {
        const doc = await adminDb
          .collection("cambios_listados")
          .doc(listadoId)
          .get();
        if (doc.exists) {
          listadosMap.set(listadoId, {
            id: doc.id,
            ...doc.data(),
          } as CambiosListado);
        }
      }),
    );

    const data = registros
      .map((r) => {
        const listado = listadosMap.get(r.listadoId);
        if (!listado) return null;

        return {
          listadoId: r.listadoId,
          categoriaCode: listado.categoriaCode,
          categoriaDesc: nombreListadoConEspecialidad(
            listado.categoriaDesc,
            listado.area,
          ),
          concepto: listado.concepto,
          fechaEmision: listado.fechaEmision,
          tipo: r.tipo,
          zona: r.zona,
          adscripcionSolicitada: r.adscripcionSolicitada,
          turnoSolicitado: r.turnoSolicitado,
          lugar: r.lugar!,
          totalEnGrupo: r.totalEnGrupo!,
          grupoUnidad: r.grupoUnidad!,
          grupoTurno: r.grupoTurno!,
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

    console.error("[trabajador/cambios-posicion]", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
