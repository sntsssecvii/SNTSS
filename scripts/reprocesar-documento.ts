// scripts/reprocesar-documento.ts
// Reprocesa un documento de bolsa de trabajo existente en Firestore
// usando los parsers actualizados, sin necesidad de re-subir el archivo.
//
// Ejecutar con:
// GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
//   npx ts-node -r tsconfig-paths/register scripts/reprocesar-documento.ts

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { Timestamp } from "firebase-admin/firestore";
import * as nodePath from "node:path";
import * as nodeFs from "node:fs";

const ROOT = process.cwd();

// Cargar .env.local para tener acceso a ADOBE_CLIENT_ID etc.
const envLocalPath = nodePath.join(ROOT, ".env.local");
if (nodeFs.existsSync(envLocalPath)) {
  const envLines = nodeFs.readFileSync(envLocalPath, "utf8").split("\n");
  for (const line of envLines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const DOCUMENTO_ID = "cHxs4viHOlCygKILORo1";
const COLECCION = "bolsa_de_trabajo_documentos";
const SUBCOLECCION_REGISTROS = "registros";

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  nodePath.join(
    process.env.HOME || "",
    ".config/firebase/sntss-service-account.json",
  );

if (!nodeFs.existsSync(serviceAccountPath)) {
  console.error(`Service account no encontrado: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(
  nodeFs.readFileSync(serviceAccountPath, "utf8"),
);

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
});

const db = getFirestore(app);
const bucket = getStorage(app).bucket();

async function reemplazarRegistros(
  documentoId: string,
  registros: any[],
): Promise<void> {
  const registrosRef = db
    .collection(COLECCION)
    .doc(documentoId)
    .collection(SUBCOLECCION_REGISTROS);

  const existentes = await registrosRef.get();
  if (!existentes.empty) {
    const BATCH_SIZE = 500;
    const docs = existentes.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    console.log(`Eliminados ${docs.length} registros anteriores`);
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < registros.length; i += BATCH_SIZE) {
    const batch = db.batch();
    registros.slice(i, i + BATCH_SIZE).forEach((reg) => {
      const limpio = Object.fromEntries(
        Object.entries(reg).filter(([, v]) => v !== undefined),
      );
      batch.set(registrosRef.doc(reg.id), limpio);
    });
    await batch.commit();
  }
  console.log(`Guardados ${registros.length} registros nuevos`);
}

async function main() {
  const docSnap = await db.collection(COLECCION).doc(DOCUMENTO_ID).get();
  if (!docSnap.exists) {
    console.error(`Documento ${DOCUMENTO_ID} no encontrado`);
    process.exit(1);
  }
  const docData = docSnap.data()!;
  const nombreArchivo = docData.nombreArchivo as string;
  const tipo = docData.tipo as string;
  const meta = docData.metadata as any;
  const anio = meta?.anio || new Date().getFullYear();
  const mes = meta?.mes || new Date().getMonth() + 1;
  const quincena = meta?.quincena || 1;

  console.log(`Documento: ${nombreArchivo} (${tipo})`);
  console.log(`Periodo: ${anio}-${mes} Q${quincena}`);

  const storagePath = `bolsa_de_trabajo/${DOCUMENTO_ID}/${nombreArchivo}`;
  console.log(`Descargando desde Storage: ${storagePath}`);
  const storageFile = bucket.file(storagePath);
  const [pdfBuffer] = await storageFile.download();
  console.log(`PDF descargado: ${pdfBuffer.length} bytes`);

  let resultadoParse: any;
  const { parseExcel } = await import("../src/lib/excel/parsers/excelParser");
  const { parsePDF } = await import("../src/lib/pdf/parser");

  if (process.env.ADOBE_CLIENT_ID && process.env.ADOBE_CLIENT_SECRET) {
    console.log("Usando Adobe PDF Services...");
    const { AdobePdfService } =
      await import("../src/lib/excel/services/adobePdfService");
    const excelBuffer = await AdobePdfService.convertPdfToExcel(
      pdfBuffer,
      nombreArchivo,
    );
    resultadoParse = await parseExcel(
      excelBuffer,
      tipo as any,
      nombreArchivo.replace(/\.pdf$/i, ".xlsx"),
    );
    if (resultadoParse.metadata) resultadoParse.metadata.extraidoCon = "EXCEL";
  } else {
    console.warn("ADOBE_CLIENT_ID no configurado, usando parser PDF de texto");
    resultadoParse = await parsePDF(pdfBuffer, tipo as any, nombreArchivo);
  }

  resultadoParse.metadata = {
    ...(resultadoParse.metadata || {}),
    anio,
    mes,
    quincena,
  };

  console.log(`Registros parseados: ${resultadoParse.registros.length}`);
  if (resultadoParse.errores?.length > 0) {
    console.log(`Errores: ${resultadoParse.errores.length}`);
  }
  if (resultadoParse.registros.length > 0) {
    const r0 = resultadoParse.registros[0];
    console.log(
      `Muestra registro[0]: matricula=${r0.matricula} nombre="${r0.nombre}" sexo=${r0.sexo}`,
    );
  }

  await reemplazarRegistros(DOCUMENTO_ID, resultadoParse.registros);

  const registrosConErrores = resultadoParse.registros.filter(
    (r: any) => r.necesitaValidacion,
  ).length;
  await db
    .collection(COLECCION)
    .doc(DOCUMENTO_ID)
    .update({
      estado: resultadoParse.registros.length > 0 ? "COMPLETADO" : "VALIDANDO",
      totalRegistros: resultadoParse.registros.length,
      registrosConErrores,
      registrosValidados: 0,
      metadata: resultadoParse.metadata,
      errores: resultadoParse.errores || [],
      fechaActualizacion: Timestamp.now(),
    });

  console.log("Documento principal actualizado en Firestore");
}

main()
  .then(() => {
    console.log("Reprocesamiento completado.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
