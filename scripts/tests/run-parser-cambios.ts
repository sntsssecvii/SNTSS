// Corre el parser real de cambios contra un PDF y reporta camino + extracción.
// GOOGLE no requerido. Ejecutar:
//   npx tsx scripts/tests/run-parser-cambios.ts "<ruta pdf>"
import { parsearListadoCambios } from "../../src/lib/pdf/parsers/cambios-escalafon";

const path = process.argv[2];
if (!path) {
  console.error("Uso: run-parser-cambios.ts <ruta-pdf>");
  process.exit(1);
}

(async () => {
  try {
    const res = await parsearListadoCambios(path);
    console.log("=== LISTADO ===");
    console.log(JSON.stringify(res.listado, null, 2));
    console.log("=== ERRORES ===", res.errores);
    console.log("=== #REGISTROS ===", res.registros.length);
    console.log("=== TODOS LOS REGISTROS ===");
    res.registros.forEach((r, i) => {
      console.log(
        `${i + 1}. mat=${r.matricula} | nombre="${r.nombre}" | adscOrigen="${r.adscripcionOrigen}" | zona=${r.zona} | adscSol="${r.adscripcionSolicitada}" | esp=${r.especialidadArea} | tipo=${r.tipo} | turno=${r.turnoSolicitado} | percibe=${r.percibeConcepto}`,
      );
    });
  } catch (e) {
    console.error("PARSER THREW:", e);
  }
})();
