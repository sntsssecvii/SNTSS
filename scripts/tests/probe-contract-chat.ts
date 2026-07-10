/**
 * Sondea searchContractSources para validar el retrieval semántico.
 * Uso: JINA_API_KEY=xxx npx tsx scripts/tests/probe-contract-chat.ts
 */
import { searchContractSources } from "@/lib/contract-chat";

const QUERIES = [
  // --- Vacaciones ---
  "cuantos dias de vacaciones me tocan si tengo 3 años de antiguedad",
  "cuantos dias libres pagados tengo al año",
  "las vacaciones son dias habiles o naturales",
  "cuanto me pagan de prima vacacional",
  // --- Aguinaldo / Fondo de ahorro ---
  "cuando me depositan el fondo de ahorro",
  "cuantos dias de sueldo son el fondo de ahorro",
  // --- Permisos ---
  "cuantos dias de permiso me dan si se me muere un familiar",
  "puedo pedir permiso economico y cuantos dias me dan al año",
  // --- Incapacidades ---
  "me pueden correr mientras estoy incapacitado",
  "que diferencia hay entre incapacidad por enfermedad y riesgo de trabajo",
  // --- Maternidad / Guarderías ---
  "cuantos dias de incapacidad me dan por embarazo",
  "hasta que edad puedo meter a mi hijo a la guarderia",
  "hay apoyo para mis hijos pequeños mientras trabajo",
  // --- Salud ---
  "me dan lentes gratis siendo trabajador del imss",
  "me reembolsan los cristales para ver de lejos",
  "mis papas tienen derecho a atencion medica por ser yo trabajador",
  // --- Escalafón ---
  "como funciona el escalafon para ascender de categoria",
  "que cuenta mas para subir de puesto los años o los examenes",
  // --- Cambios / Turnos ---
  "me pueden cambiar de unidad sin mi permiso",
  "si trabajo en domingo me pagan extra",
  "que pasa si trabajo un domingo",
  "me pueden obligar a quedarme mas horas de mi jornada",
  // --- Salarios ---
  "cuanto gana un medico general",
  "cuanto gana una enfermera general clinica",
  "cuanto gana un auo",
  "que diferencia hay entre sueldo tabular y sueldo integrado",
  // --- Jubilación ---
  "cuantos años tengo que trabajar para jubilarme del imss",
  "a que edad me puedo jubilar",
  // --- Préstamos ---
  "puedo pedir un prestamo hipotecario siendo trabajador del imss",
  "el imss me da credito para comprar carro",
  // --- Ayuda renta ---
  "ayuda economica para pagar donde vivo",
  "cuanto me dan de ayuda de renta al mes",
  // --- Uniformes ---
  "cada cuanto me dan uniforme",
  // --- Despido ---
  "me pueden correr del imss estando de base",
  "si me rescinden el contrato cuanto me tienen que pagar",
  // --- Sobresueldos ---
  "las enfermeras tienen algun sobresueldo",
  // --- Acoso ---
  "el contrato protege contra el acoso laboral",
];

async function main() {
  for (const q of QUERIES) {
    try {
      const r = await searchContractSources(q);
      const structured = r.tabuladorContext
        ? r.tabuladorContext.split("\n")[0].slice(0, 70)
        : "—";
      const pages = r.sources.slice(0, 4).map((s) => s.chunk.pageNumber);
      console.log(`\n❓ "${q}"`);
      console.log(`   conversacional: ${r.isConversational}`);
      console.log(`   estructurado:   ${structured}`);
      console.log(`   páginas top:    ${JSON.stringify(pages)}`);
    } catch (e: any) {
      console.log(`\n❓ "${q}"  ->  ERROR: ${e.message}`);
    }
  }
}

main();
