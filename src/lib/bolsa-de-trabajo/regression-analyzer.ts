import type {
  BolsaPosicionMaterializada,
  RegressionAnalysis,
  TipoRegressionStats,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";

interface AnalyzeRegressionParams {
  syncAnteriorId: string | null;
  newPositions: BolsaPosicionMaterializada[];
  previousPositions: BolsaPosicionMaterializada[];
}

function positionKey(pos: BolsaPosicionMaterializada): string {
  // Usar grupoComparable completo como key porque un trabajador puede competir
  // en múltiples grupos dentro del mismo tipo (diferente categoría, zona,
  // subcategoría, turno, adscripción, etc.)
  const grupo = pos.grupoComparable ?? {};
  const grupoKey = Object.keys(grupo)
    .sort()
    .map((k) => grupo[k] ?? "")
    .join("|");
  return `${pos.tipoDocumento}::${pos.matricula}::${grupoKey}`;
}

export function analyzeRegression({
  syncAnteriorId,
  newPositions,
  previousPositions,
}: AnalyzeRegressionParams): RegressionAnalysis {
  if (!syncAnteriorId || previousPositions.length === 0) {
    return {
      sinComparacion: true,
      alertaDisparada: false,
      porTipo: {},
      syncAnteriorId: null,
    };
  }

  const prevLookup = new Map<string, number>();
  for (const pos of previousPositions) {
    prevLookup.set(positionKey(pos), pos.posicionBase);
  }

  // Agrupar nuevas posiciones por tipo
  const byTipo = new Map<TipoBolsaDeTrabajo, BolsaPosicionMaterializada[]>();
  for (const pos of newPositions) {
    const arr = byTipo.get(pos.tipoDocumento) ?? [];
    arr.push(pos);
    byTipo.set(pos.tipoDocumento, arr);
  }

  const porTipo: Partial<Record<TipoBolsaDeTrabajo, TipoRegressionStats>> = {};
  let alertaDisparada = false;

  for (const [tipo, positions] of byTipo) {
    let avanzaron = 0;
    let retrocedieron = 0;
    let sinCambio = 0;

    for (const pos of positions) {
      const prevPos = prevLookup.get(positionKey(pos));
      if (prevPos === undefined) {
        sinCambio++;
      } else if (pos.posicionBase < prevPos) {
        avanzaron++;
      } else if (pos.posicionBase > prevPos) {
        retrocedieron++;
      } else {
        sinCambio++;
      }
    }

    const total = positions.length;
    const porcentajeRetroceso =
      total > 0 ? Math.round((retrocedieron / total) * 100) : 0;

    porTipo[tipo] = {
      total,
      avanzaron,
      retrocedieron,
      sinCambio,
      porcentajeRetroceso,
    };

    if (porcentajeRetroceso > 10) {
      alertaDisparada = true;
    }
  }

  return {
    sinComparacion: false,
    alertaDisparada,
    porTipo,
    syncAnteriorId,
  };
}
