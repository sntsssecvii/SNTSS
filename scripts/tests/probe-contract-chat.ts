/**
 * Sondea searchContractSources para validar el retrieval semántico.
 * Uso: JINA_API_KEY=xxx npx tsx scripts/tests/probe-contract-chat.ts
 */
import { searchContractSources } from "@/lib/contract-chat";

const QUERIES = [
  "cuantos dias de vacaciones me tocan si tengo 3 años de antiguedad",
  "cuantos dias libres pagados tengo al año", // vacaciones sin la palabra
  "me reembolsan los cristales para ver de lejos", // anteojos sin la palabra
  "ayuda economica para pagar donde vivo", // ayuda de renta sin la palabra
  "cuanto gana un medico general", // tabulador
  "hay apoyo para mis hijos pequeños mientras trabajo", // guarderías
  "que pasa si trabajo un domingo", // prima dominical
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
