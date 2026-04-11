import { NextRequest, NextResponse } from "next/server";
import { parsePDF, detectarTipoDocumento } from "@/lib/pdf/parser";
import { parseExcel } from "@/lib/excel/parsers/excelParser";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { validateFileMagicBytes } from "@/lib/security/file-validation";
import type {
  BolsaDeTrabajoDocumento,
  BolsaDeTrabajoRegistro,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";
import { Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const PDF_MIME = "application/pdf";
const COLECCION = "bolsa_de_trabajo_documentos";
const SUBCOLECCION_REGISTROS = "registros";
const EXCEL_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

function toAdminTimestamp(value: Date | unknown) {
  return value instanceof Date ? Timestamp.fromDate(value) : value;
}

async function getDocumentoExistentePorSyncYTipo(
  syncId: string,
  tipo: TipoBolsaDeTrabajo,
): Promise<BolsaDeTrabajoDocumento | null> {
  const snapshot = await adminDb
    .collection(COLECCION)
    .where("syncId", "==", syncId)
    .where("tipo", "==", tipo)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data() as BolsaDeTrabajoDocumento;
  return {
    ...data,
    id: doc.id,
    registros: [],
  };
}

async function createDocumentoAdmin(
  documento: Omit<BolsaDeTrabajoDocumento, "id">,
): Promise<string> {
  const docRef = await adminDb.collection(COLECCION).add({
    ...documento,
    fechaCarga: toAdminTimestamp(documento.fechaCarga),
    fechaActualizacion: toAdminTimestamp(documento.fechaActualizacion),
  });

  return docRef.id;
}

async function updateDocumentoAdmin(
  id: string,
  actualizaciones: Partial<Omit<BolsaDeTrabajoDocumento, "registros">>,
): Promise<void> {
  const datosActualizados: Record<string, unknown> = { ...actualizaciones };

  if (actualizaciones.fechaCarga instanceof Date) {
    datosActualizados.fechaCarga = Timestamp.fromDate(
      actualizaciones.fechaCarga,
    );
  }
  if (actualizaciones.fechaActualizacion instanceof Date) {
    datosActualizados.fechaActualizacion = Timestamp.fromDate(
      actualizaciones.fechaActualizacion,
    );
  }

  delete datosActualizados.id;
  delete datosActualizados.registros;

  await adminDb.collection(COLECCION).doc(id).update(datosActualizados);
}

async function updateEstadoDocumentoAdmin(
  id: string,
  estado: BolsaDeTrabajoDocumento["estado"],
): Promise<void> {
  await updateDocumentoAdmin(id, { estado });
}

async function guardarRegistrosAdmin(
  documentoId: string,
  registros: BolsaDeTrabajoRegistro[],
): Promise<void> {
  const BATCH_SIZE = 500;
  const registrosRef = adminDb
    .collection(COLECCION)
    .doc(documentoId)
    .collection(SUBCOLECCION_REGISTROS);

  for (let i = 0; i < registros.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    const lote = registros.slice(i, i + BATCH_SIZE);

    lote.forEach((registro) => {
      const registroLimpio = Object.fromEntries(
        Object.entries(registro).filter(([, value]) => value !== undefined),
      );
      batch.set(registrosRef.doc(registro.id), registroLimpio);
    });

    await batch.commit();
  }
}

async function reemplazarRegistrosAdmin(
  documentoId: string,
  registros: BolsaDeTrabajoRegistro[],
): Promise<void> {
  const registrosRef = adminDb
    .collection(COLECCION)
    .doc(documentoId)
    .collection(SUBCOLECCION_REGISTROS);
  const existentes = await registrosRef.get();

  if (!existentes.empty) {
    const BATCH_SIZE = 500;
    const docs = existentes.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      docs
        .slice(i, i + BATCH_SIZE)
        .forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }
  }

  await guardarRegistrosAdmin(documentoId, registros);
}

export async function POST(request: NextRequest) {
  let adminUser: Awaited<ReturnType<typeof requireAdminRequest>> | null = null;
  try {
    enforceRateLimit(request, {
      bucket: "api:bolsa:procesar",
      limit: 12,
      windowMs: 60_000,
    });
    adminUser = await requireAdminRequest(request);

    // Obtener datos del formulario
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const tipo = formData.get("tipo") as string;
    const anio = parseInt(
      (formData.get("anio") as string) || new Date().getFullYear().toString(),
    );
    const mes = parseInt(
      (formData.get("mes") as string) || (new Date().getMonth() + 1).toString(),
    );
    const quincena = parseInt(
      (formData.get("quincena") as string) ||
        (new Date().getDate() <= 15 ? 1 : 2).toString(),
    ) as 1 | 2;
    const syncId = (formData.get("syncId") as string) || undefined;

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo" },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "El archivo está vacío." },
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: "El archivo excede el tamaño máximo permitido de 25 MB." },
        { status: 400 },
      );
    }

    // Validar que sea un PDF o Excel
    const normalizedName = file.name.toLowerCase();
    const isPDF = file.type === PDF_MIME || normalizedName.endsWith(".pdf");
    const isExcel =
      EXCEL_MIME_TYPES.includes(file.type) ||
      normalizedName.endsWith(".xlsx") ||
      normalizedName.endsWith(".xls");

    if (!isPDF && !isExcel) {
      return NextResponse.json(
        { error: "El archivo debe ser un PDF o un Excel (.xlsx o .xls)." },
        { status: 400 },
      );
    }

    // Convertir archivo a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Verificar magic bytes — MIME type y extensión son falsificables por el cliente
    const expectedMagicType = isPDF
      ? "pdf"
      : normalizedName.endsWith(".xlsx")
        ? "xlsx"
        : "xls";
    if (!validateFileMagicBytes(buffer, expectedMagicType)) {
      return NextResponse.json(
        { error: "Formato de archivo no válido." },
        { status: 400 },
      );
    }

    // Detectar tipo de documento si no se proporcionó
    let tipoDocumento = tipo as any;
    if (!tipoDocumento) {
      tipoDocumento = detectarTipoDocumento(file.name);
      if (!tipoDocumento) {
        // Intentar detectar por contenido parseando una muestra
        try {
          // Usar pdfplumber para extraer texto para detección
          const { parsePDF } = await import("@/lib/pdf/parser");
          const data = await parsePDF(buffer, "NUEVO_INGRESO", file.name); // Tipo dummy para extraer texto
          // Intentar detectar
          const detected = detectarTipoDocumento(file.name, data.texto); // Usamos el texto crudo extraído
          if (detected) tipoDocumento = detected;
        } catch (error) {
          console.warn("No se pudo detectar tipo por contenido:", error);
        }
      }
    }

    if (!tipoDocumento) {
      return NextResponse.json(
        {
          error:
            "No se pudo detectar el tipo de documento. Por favor, selecciónalo manualmente.",
        },
        { status: 400 },
      );
    }

    // Crear o reutilizar documento inicial con estado PROCESANDO
    const ahora = new Date();
    const documentoExistente = syncId
      ? await getDocumentoExistentePorSyncYTipo(syncId, tipoDocumento)
      : null;

    const documentoId =
      documentoExistente?.id ||
      (await createDocumentoAdmin({
        tipo: tipoDocumento,
        syncId,
        fechaActualizacion: ahora,
        fechaCarga: ahora,
        subidoPor: adminUser.uid,
        subidoPorEmail: adminUser.email || "",
        estado: "PROCESANDO",
        urlArchivo: "", // Se actualizará después
        nombreArchivo: file.name,
        metadata: {
          anio,
          mes,
          quincena,
        },
        registros: [],
        errores: [],
        version: 1,
        totalRegistros: 0,
        registrosValidados: 0,
        registrosConErrores: 0,
      }));

    if (documentoExistente?.id) {
      await updateDocumentoAdmin(documentoId, {
        fechaActualizacion: ahora,
        fechaCarga: ahora,
        subidoPor: adminUser.uid,
        subidoPorEmail: adminUser.email || "",
        estado: "PROCESANDO",
        urlArchivo: "",
        nombreArchivo: file.name,
        metadata: {
          anio,
          mes,
          quincena,
        },
        errores: [],
        totalRegistros: 0,
        registrosConErrores: 0,
        version: (documentoExistente.version || 1) + 1,
      });
    }

    // Subir archivo a Firebase Storage (opcional - continuar aunque falle)
    let urlArchivo = "";
    try {
      const { adminStorage } = await import("@/lib/firebase/admin");
      const bucket = adminStorage.bucket();
      const destination = `bolsa_de_trabajo/${documentoId}/${file.name}`;
      const fileRef = bucket.file(destination);

      await fileRef.save(buffer, {
        metadata: {
          contentType: isPDF
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });

      // Hacer el archivo público o generar una URL firmada
      // Por simplicidad, generamos una URL de descarga que expira en 10 años
      const [downloadUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });
      urlArchivo = downloadUrl;
    } catch (error: any) {
      console.warn(
        "Error subiendo archivo a Storage (continuando sin Storage):",
        error.message,
      );
      urlArchivo = "";
    }

    // Procesar Archivo
    let resultadoParse: any;
    try {
      if (isExcel) {
        console.log("Procesando archivo como Excel directamente");
        resultadoParse = await parseExcel(buffer, tipoDocumento, file.name);
      } else if (isPDF) {
        // Priorizar Adobe PDF Services para conversión de alta calidad si las llaves están configuradas
        if (process.env.ADOBE_CLIENT_ID && process.env.ADOBE_CLIENT_SECRET) {
          try {
            const { AdobePdfService } =
              await import("@/lib/excel/services/adobePdfService");
            console.log(
              `Usando Adobe PDF Services para conversión de ${tipoDocumento}`,
            );
            const excelBuffer = await AdobePdfService.convertPdfToExcel(
              buffer,
              file.name,
            );
            resultadoParse = await parseExcel(
              excelBuffer,
              tipoDocumento,
              file.name.replace(/\.pdf$/i, ".xlsx"),
            );

            if (resultadoParse.metadata) {
              resultadoParse.metadata.extraidoCon = "EXCEL";
            }
          } catch (convError) {
            console.warn(
              "Error en Adobe PDF Services, cayendo a parser estándar:",
              convError,
            );
            resultadoParse = await parsePDF(buffer, tipoDocumento, file.name);
          }
        } else {
          // Fallback a parser local de texto si no hay Adobe
          resultadoParse = await parsePDF(buffer, tipoDocumento, file.name);
        }
      }
    } catch (error: any) {
      console.error("Error parseando archivo:", error);
      await updateEstadoDocumentoAdmin(documentoId, "ERROR");
      return NextResponse.json(
        {
          error:
            "Error al procesar el archivo. Verifica el formato e intenta de nuevo.",
        },
        { status: 500 },
      );
    }

    // Asegurar que la metadata del periodo esté presente
    if (!resultadoParse.metadata) resultadoParse.metadata = {};
    resultadoParse.metadata.anio = anio;
    resultadoParse.metadata.mes = mes;
    resultadoParse.metadata.quincena = quincena;

    // Actualizar documento con resultados
    const registrosConErrores = resultadoParse.registros.filter(
      (r: any) => r.necesitaValidacion,
    ).length;

    // Log para debugging
    console.log("Resultado del parseo:", {
      totalRegistros: resultadoParse.registros.length,
      registrosConErrores,
      errores: resultadoParse.errores,
      primerosRegistros: resultadoParse.registros.slice(0, 3),
    });

    // Guardar o reemplazar registros en subcolección (evita límite de tamaño)
    if (documentoExistente?.id) {
      await reemplazarRegistrosAdmin(documentoId, resultadoParse.registros);
    } else {
      await guardarRegistrosAdmin(documentoId, resultadoParse.registros);
    }

    // Actualizar documento principal (sin registros)
    await updateDocumentoAdmin(documentoId, {
      urlArchivo: urlArchivo || "",
      estado: resultadoParse.registros.length > 0 ? "COMPLETADO" : "VALIDANDO",
      metadata: {
        ...(resultadoParse.metadata || {}),
        anio,
        mes,
        quincena,
      },
      errores: resultadoParse.errores || [],
      totalRegistros: resultadoParse.registros.length,
      registrosConErrores,
    });

    await writeAdminAuditLog({
      action: "BOLSA_PROCESAR_ARCHIVO",
      actorUid: adminUser.uid,
      actorEmail: adminUser.email || "",
      targetType: "bolsa_documento",
      targetId: documentoId,
      status: "SUCCESS",
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        undefined,
      userAgent: request.headers.get("user-agent") || undefined,
      metadata: {
        tipoDocumento,
        syncId: syncId || null,
        nombreArchivo: file.name,
        reemplazado: Boolean(documentoExistente?.id),
        totalRegistros: resultadoParse.registros.length,
      },
    });

    return NextResponse.json({
      success: true,
      documentoId,
      reemplazado: Boolean(documentoExistente?.id),
      totalRegistros: resultadoParse.registros.length,
      registrosConErrores,
      errores: resultadoParse.errores,
      advertencia:
        resultadoParse.registros.length === 0
          ? "No se extrajeron registros. Revisa los logs del servidor para más detalles."
          : undefined,
    });
  } catch (error: any) {
    console.error("Error en procesamiento:", error);
    console.error("Stack trace:", error.stack);

    if (adminUser) {
      await writeAdminAuditLog({
        action: "BOLSA_PROCESAR_ARCHIVO",
        actorUid: adminUser.uid,
        actorEmail: adminUser.email || "",
        targetType: "bolsa_documento",
        status: "ERROR",
        ip:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          undefined,
        userAgent: request.headers.get("user-agent") || undefined,
        metadata: {
          error: error?.message || "Error desconocido",
        },
      }).catch((auditError) => {
        console.error("Error escribiendo auditoría admin:", auditError);
      });
    }

    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }

    if (
      error?.code === "auth/id-token-expired" ||
      error?.code === "auth/argument-error"
    ) {
      return NextResponse.json(
        { error: "La sesión expiró. Vuelve a iniciar sesión." },
        { status: 401 },
      );
    }

    if (error?.code === "auth/invalid-id-token") {
      return NextResponse.json(
        { error: "La sesión no es válida. Vuelve a iniciar sesión." },
        { status: 401 },
      );
    }

    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (error?.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Perfil de usuario no encontrado." },
        { status: 404 },
      );
    }

    if (error?.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { error: "La cuenta no está activa para operar bolsa de trabajo." },
        { status: 403 },
      );
    }

    if (error?.message === "ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "No tienes permisos para operar bolsa de trabajo." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
