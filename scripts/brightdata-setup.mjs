// Finds your Bright Data SERP and Web Unlocker zones, saves their names to .env,
// and sends one test request to each. Never prints the API key.
// Usage: node --env-file=.env scripts/brightdata-setup.mjs
import { readFile, writeFile } from "node:fs/promises";

const key = process.env.BRIGHTDATA_API_KEY;
if (!key) {
  console.log("❌ BRIGHTDATA_API_KEY isn't in .env yet. Run: scripts/save-key.sh brightdata");
  process.exit(1);
}
const auth = { Authorization: `Bearer ${key}` };

const res = await fetch("https://api.brightdata.com/zone/get_active_zones", { headers: auth });
if (!res.ok) {
  console.log(`❌ Bright Data rejected the key (${res.status}).`);
  process.exit(1);
}
const zones = await res.json();
console.log("Active zones:", zones.map((z) => `${z.name} (${z.type})`).join(", ") || "none");

const find = (re) => zones.find((z) => re.test(`${z.type} ${z.name}`))?.name;
const serpZone = process.env.BRIGHTDATA_SERP_ZONE || find(/serp/i);
const unlockerZone = process.env.BRIGHTDATA_UNLOCKER_ZONE || find(/unblock|unlock/i);

let env = await readFile(".env", "utf8").catch(() => "");
const setVar = (k, v) => {
  env = env.split("\n").filter((l) => l && !l.startsWith(`${k}=`)).join("\n") + `\n${k}=${v}\n`;
};
if (serpZone) setVar("BRIGHTDATA_SERP_ZONE", serpZone);
if (unlockerZone) setVar("BRIGHTDATA_UNLOCKER_ZONE", unlockerZone);
await writeFile(".env", env.replace(/^\n+/, ""), { mode: 0o600 });
console.log(`SERP zone: ${serpZone ?? "❌ none — add a SERP API zone at brightdata.com/cp/zones"}`);
console.log(`Unlocker zone: ${unlockerZone ?? "❌ none — add a Web Unlocker API zone at brightdata.com/cp/zones"}`);

async function call(body) {
  const t = Date.now();
  const r = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, ms: Date.now() - t, text: await r.text() };
}

if (serpZone) {
  const r = await call({ zone: serpZone, url: "https://www.google.com/search?q=Palace+Hotel+San+Francisco+history&hl=en&gl=us", format: "json" });
  if (r.ok) {
    let data = JSON.parse(r.text);
    if (typeof data.body === "string") data = JSON.parse(data.body);
    const organic = data.organic ?? [];
    console.log(`✅ SERP API: ${organic.length} results in ${r.ms}ms. Top: ${organic.slice(0, 3).map((o) => o.link).join(" · ")}`);
  } else console.log(`❌ SERP API ${r.status}: ${r.text.slice(0, 200)}`);
}
if (unlockerZone) {
  const r = await call({ zone: unlockerZone, url: "https://en.wikipedia.org/wiki/Palace_Hotel,_San_Francisco", format: "raw", data_format: "markdown" });
  console.log(r.ok ? `✅ Web Unlocker: ${r.text.length} chars of markdown in ${r.ms}ms` : `❌ Web Unlocker ${r.status}: ${r.text.slice(0, 200)}`);
}
