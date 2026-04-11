import { adminDb } from "@/lib/firebase/admin";
import { materializeDocumentPositions } from "@/lib/bolsa-de-trabajo/materialize-sync-positions";
import {
  deleteBolsaPosicionesMaterializadasPorSync,
  upsertBolsaPosicionesMaterializadas,
} from "@/lib/firebase/bolsa-posiciones-materializadas";
import type {
  BolsaDeTrabajoRegistro,
  PeriodoBolsa,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";

const DOC_COLLECTION = "bolsa_de_trabajo_documentos";
const REGISTROS_SUBCOLLECTION = "registros";

export interface MaterializeSyncResult {
  totalDocumentos: number;
  totalMaterializados: number;
}

export async function materializeSyncPositions(
  syncId: string,
  periodo: PeriodoBolsa,
): Promise<MaterializeSyncResult> {
  const docsSnap = await adminDb
    .collection(DOC_COLLECTION)
    .where("syncId", "==", syncId)
    .get();

  if (docsSnap.empty) {
    throw new Error("SYNC_WITHOUT_DOCUMENTS");
  }

  const documentos = docsSnap.docs.map((doc) => ({
    id: doc.id,
    tipo: doc.get("tipo") as TipoBolsaDeTrabajo,
    estado: doc.get("estado") as string,
  }));

  const documentosNoCompletados = documentos.filter(
    (doc) => doc.estado !== "COMPLETADO",
  );
  if (documentosNoCompletados.length > 0) {
    throw new Error(
      `SYNC_HAS_INCOMPLETE_DOCUMENTS:${JSON.stringify(documentosNoCompletados)}`,
    );
  }

  await deleteBolsaPosicionesMaterializadasPorSync(syncId);

  let totalMaterializados = 0;

  for (const documento of documentos) {
    const registrosSnap = await adminDb
      .collection(DOC_COLLECTION)
      .doc(documento.id)
      .collection(REGISTROS_SUBCOLLECTION)
      .get();

    const registros = registrosSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BolsaDeTrabajoRegistro[];

    const lookups = materializeDocumentPositions({
      syncId,
      documentoId: documento.id,
      tipoDocumento: documento.tipo,
      periodo,
      registros,
    });

    totalMaterializados += await upsertBolsaPosicionesMaterializadas(lookups);
  }

  return {
    totalDocumentos: documentos.length,
    totalMaterializados,
  };
}
