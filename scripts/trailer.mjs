// Builds a HyperFrames "building trailer" (vertical 1080×1920 HTML composition) from a cached backstory.
// Usage: node scripts/trailer.mjs palace-hotel   → trailer/palace-hotel/index.html
// Render: cd trailer/palace-hotel && npx hyperframes render
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readCache } from "../lib/cache.js";
import { readFileSync } from "node:fs";
import { LOOKS, guide, GUIDE_FILTERS } from "../public/guide.js";

const HOST = LOOKS.archivist; // the app's tour guide

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Same tokens as the app, so the trailer never drifts from it
const TOKENS = readFileSync(join(ROOT, "public", "tokens.css"), "utf8");
const id = process.argv[2];
if (!id) {
  console.log("Usage: node scripts/trailer.mjs <building-id>");
  process.exit(1);
}
const d = await readCache(id);
if (!d) {
  console.log(`No cached backstory for "${id}". Run: npm run golden -- --only ${id}`);
  process.exit(1);
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const LABEL = { verified: "Verified", disputed: "Disputed", legend: "Legend" };

// Pick up to 5 claims: lead with verified, make sure a legend shows up if there is one.
const claims = [...d.claims].sort((a, b) => (a.verdict === "verified" ? -1 : 0) - (b.verdict === "verified" ? -1 : 0));
const legend = d.claims.find((c) => c.verdict === "legend");
const picked = claims.filter((c) => c !== legend).slice(0, legend ? 4 : 5);
if (legend) picked.splice(Math.min(2, picked.length), 0, legend);

const INTRO = 3.5;
const PER = 3.4;
const OUTRO = 4;
const total = INTRO + picked.length * PER + OUTRO;
const tally = d.claims.reduce((m, c) => ((m[c.verdict] = (m[c.verdict] ?? 0) + 1), m), {});

const cards = picked
  .map((c, i) => {
    const start = (INTRO + i * PER).toFixed(2);
    const src = c.evidence[0]?.source ?? "";
    const more = c.evidence.length > 1 ? ` + ${c.evidence.length - 1} more` : "";
    return `
    <section id="claim-${i}" class="clip scene claim" data-start="${start}" data-duration="${PER}" data-track-index="1">
      <p class="num">Claim ${String(i + 1).padStart(2, "0")} / ${String(picked.length).padStart(2, "0")}</p>
      ${c.year ? `<p class="year">${esc(c.year)}</p>` : ""}
      <p class="text">${esc(c.text)}</p>
      <p class="src">Source: ${esc(src)}${more}</p>
      <div class="stamp ${c.verdict}">${LABEL[c.verdict]}</div>
    </section>`;
  })
  .join("");

const anims = picked
  .map((_, i) => {
    const t = (INTRO + i * PER).toFixed(2);
    return `
      tl.fromTo("#claim-${i} .text", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, ${t});
      tl.fromTo("#claim-${i} .num, #claim-${i} .year, #claim-${i} .src", { opacity: 0 }, { opacity: 1, duration: 0.5 }, ${t});
      tl.fromTo("#claim-${i} .stamp", { opacity: 0, scale: 2.4, rotate: -14 }, { opacity: 0.94, scale: 1, rotate: -8, duration: 0.32, ease: "back.out(2.2)" }, ${(Number(t) + 1.1).toFixed(2)});`;
  })
  .join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700&family=Geist+Mono:wght@500;700&family=Young+Serif&family=Patrick+Hand&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
  ${TOKENS}
  :root { --paper: var(--sky-bottom); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; background: var(--paper); }
  #root { position: relative; width: 100%; height: 100%; color: var(--ink); font-family: "Geist", system-ui, sans-serif; isolation: isolate;
          background: linear-gradient(var(--sky-top), var(--sky-bottom) 55%); }
  .scene { position: absolute; inset: 0; padding: 140px 96px; display: flex; flex-direction: column; justify-content: center; }
  .kicker, .num, .src, .year, .foot { font-family: "Geist Mono", monospace; letter-spacing: .14em; text-transform: uppercase; }
  .kicker { color: var(--accent); font-size: 34px; font-weight: 700; margin-bottom: 36px; }
  h1 { font-family: "Young Serif", Georgia, serif; font-size: 140px; line-height: 1; font-weight: 400; }
  .built { margin-top: 40px; font-size: 48px; font-weight: 600; color: var(--ink-2); }
  .hook { margin-top: 24px; font-family: "Patrick Hand", cursive; font-size: 56px; line-height: 1.3; color: var(--ink-2); }
  .claim { justify-content: center; }
  .num { font-size: 30px; color: var(--muted); margin-bottom: 30px; }
  .year { font-size: 56px; font-weight: 700; color: var(--accent); margin-bottom: 20px; letter-spacing: .06em; }
  .text { font-size: 76px; line-height: 1.18; font-weight: 400; }
  .src { margin-top: 48px; font-size: 26px; color: var(--muted); letter-spacing: .06em; text-transform: none; }
  .stamp { position: absolute; right: 96px; bottom: 260px; font-family: "Geist Mono", monospace; font-weight: 700; font-size: 64px;
           letter-spacing: .14em; text-transform: uppercase; padding: 20px 30px; border: 8px solid currentColor; border-radius: 12px; }
  .stamp.verified { color: var(--verified); } .stamp.disputed { color: var(--disputed); } .stamp.legend { color: var(--legend); }
  .tally { display: grid; gap: 28px; margin: 60px 0 0; }
  .tally div { font-family: "Geist Mono", monospace; font-size: 48px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .brand { font-family: "Young Serif", Georgia, serif; font-size: 120px; line-height: 1; font-weight: 400; }
  .brand em { font-style: normal; color: var(--title-accent); }
  .foot { position: absolute; left: 96px; right: 96px; bottom: 120px; font-size: 24px; color: var(--muted); letter-spacing: .08em; text-transform: none; }
  #intro { justify-content: flex-start; padding-top: 220px; }
  .host { position: absolute; }
  .host-intro { right: 40px; bottom: 0; width: 520px; }
  .host-outro { right: 70px; bottom: 150px; width: 330px; }
  #outro .foot { right: 440px; }
  .gk { fill: none; stroke: var(--ink-on-paper); stroke-width: 0.9; stroke-linecap: round; stroke-linejoin: round; filter: url(#ink-fine); }
  .gw { filter: url(#wash-fine); }
  .m-open { opacity: 0; }
  .host-outro .arm-r { transform-box: fill-box; transform-origin: 50% 0%; transform: rotate(-48deg); }
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute"><defs>${GUIDE_FILTERS}</defs></svg>
<div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
  <section id="intro" class="clip scene" data-start="0" data-duration="${INTRO}" data-track-index="0">
    <p class="kicker">San Francisco</p>
    <h1>${esc(d.building.name)}</h1>
    ${d.built ? `<p class="built">Built ${esc(d.built)}${d.architect ? ` · ${esc(d.architect)}` : ""}</p>` : ""}
    ${d.hook ? `<p class="hook">${esc(d.hook)}</p>` : ""}
    <svg class="host host-intro" viewBox="-34 -200 68 104">${guide(HOST, "talk")}</svg>
  </section>
  ${cards}
  <section id="outro" class="clip scene" data-start="${(total - OUTRO).toFixed(2)}" data-duration="${OUTRO}" data-track-index="2">
    <p class="kicker">Truth or Legend</p>
    <p class="brand">Building<br><em>Backstory</em></p>
    <div class="tally">
      <div style="color:var(--verified)">${tally.verified ?? 0} Verified</div>
      <div style="color:var(--disputed)">${tally.disputed ?? 0} Disputed</div>
      <div style="color:var(--legend)">${tally.legend ?? 0} Legend</div>
    </div>
    <svg class="host host-outro" viewBox="-60 -200 100 206"><g transform="scale(-1 1)">${guide(HOST, "full")}</g></svg>
    <p class="foot">Research by Bright Data. Verdicts by TypeSafe Jev. Story by Gemini.</p>
  </section>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  tl.fromTo("#intro .kicker", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, 0.1);
  tl.fromTo("#intro h1", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0.3);
  tl.fromTo("#intro .built, #intro .hook", { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.3 }, 1.0);
  tl.fromTo("#intro .host", { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0.4);
  ${anims}
  tl.fromTo("#outro .brand", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, ${(total - OUTRO + 0.1).toFixed(2)});
  tl.fromTo("#outro .host", { opacity: 0, x: 120 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }, ${(total - OUTRO + 0.2).toFixed(2)});
  tl.fromTo("#outro .tally div", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.25 }, ${(total - OUTRO + 0.7).toFixed(2)});
  window.__timelines["main"] = tl;
  tl.seek(0);
</script>
</body>
</html>
`;

const out = join(ROOT, "trailer", id);
await mkdir(out, { recursive: true });
await writeFile(join(out, "index.html"), html);
console.log(`🎬 trailer/${id}/index.html (${total.toFixed(1)}s, ${picked.length} claims)\n   Render: cd ${out} && npx hyperframes render`);
