// Runs the full pipeline for the 5 golden buildings and caches the results in data/cache,
// so the live demo works even on bad Wi-Fi. Usage: npm run golden [-- --fresh] [-- --only palace-hotel]
import { DEMO_BUILDINGS } from "../lib/buildings.js";
import { backstory, narrate } from "../lib/pipeline.js";

const fresh = process.argv.includes("--fresh");
const voice = process.argv.includes("--voice");
const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;

for (const b of DEMO_BUILDINGS.filter((x) => !only || x.id === only)) {
  const t = Date.now();
  try {
    const r = await backstory(b, { fresh });
    const tally = r.claims.reduce((m, c) => ((m[c.verdict] = (m[c.verdict] ?? 0) + 1), m), {});
    const via = [...new Set(r.sources.map((s) => s.via))].join("+");
    const judge = [...new Set(r.claims.map((c) => c.decidedBy))].join("+");
    console.log(`✅ ${b.name}: ${r.claims.length} claims ${JSON.stringify(tally)} · ${r.sources.length} sources via ${via} · judged by ${judge} · ${Date.now() - t}ms${r.cached ? " (cached)" : ""}`);
    if (voice) {
      await narrate(r.building.id, r.story);
      console.log(`   🔊 narration cached`);
    }
  } catch (err) {
    console.log(`❌ ${b.name}: ${err.message}`);
  }
}
