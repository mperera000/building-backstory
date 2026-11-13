// The Backstory pipeline: locate → identify → research → fact-check → narrate.
import { getJson } from "./http.js";
import { askJson, askText, hasGemini, speak } from "./gemini.js";
import { research } from "./research.js";
import { pickBuilding, judgeClaims } from "./jev.js";
import { DEMO_BUILDINGS, nearestDemo, slug } from "./buildings.js";
import { readCache, writeCache } from "./cache.js";

export async function reverseGeocode(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  try {
    const d = await getJson(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`,
      { headers: { "User-Agent": "building-backstory-hackathon/1.0" }, timeoutMs: 5000 },
    );
    const a = d.address ?? {};
    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    return {
      address: [street, a.city || a.town || "San Francisco"].filter(Boolean).join(", "),
      placeName: d.name || null,
    };
  } catch (err) {
    console.error("Reverse geocode failed:", err.message);
    return null;
  }
}

// image: { mimeType, base64 } | undefined
export async function identify({ image, lat, lng, demoId }) {
  if (demoId) {
    const b = DEMO_BUILDINGS.find((x) => x.id === demoId);
    if (b) return { building: b, confident: true, decidedBy: "demo pick", candidates: [b] };
  }

  const place = await reverseGeocode(lat, lng);
  const near = nearestDemo(lat, lng);
  const candidates = [];
  let scene = "";

  if (image && hasGemini()) {
    try {
      const v = await askJson(
        `You are identifying a landmark in San Francisco from a phone photo. It may be a building, monument, statue, arch, bridge, mural, fountain or other public artwork.
GPS street address: ${place?.address ?? "unknown"}. Map place name at that spot: ${place?.placeName ?? "unknown"}.
Return JSON: {"scene": "one sentence describing what's in the photo (type, style, materials, notable features)",
"candidates": [{"name": "specific landmark name", "why": "short reason"}]}
Give 1 to 3 candidates, most likely first. Use real names (for example "Dewey Monument" or "Women's Building murals"), not street addresses. If it isn't a recognizable landmark, return an empty candidates list.`,
        { image },
      );
      scene = v.scene ?? "";
      for (const c of v.candidates ?? []) if (c?.name) candidates.push({ name: c.name, why: c.why ?? "" });
    } catch (err) {
      console.error("Gemini vision failed:", err.message);
    }
  }
  if (near && !candidates.some((c) => c.name.toLowerCase().includes(near.name.toLowerCase().split(" ")[0]))) {
    candidates.push({ name: near.name, why: "the landmark closest to your GPS location" });
  }
  if (place?.placeName && !candidates.some((c) => c.name === place.placeName)) {
    candidates.push({ name: place.placeName, why: "the map's name for this spot" });
  }
  if (candidates.length === 0) return { building: null, confident: false, decidedBy: "none", candidates: [], address: place?.address };

  const withIds = candidates.slice(0, 4).map((c, i) => ({ ...c, id: `b${i}` }));
  const { pick, confident, decidedBy } = await pickBuilding({ candidates: withIds, scene, address: place?.address });
  return {
    building: { id: slug(pick.name), name: pick.name, address: near?.name === pick.name ? near.address : place?.address ?? null, lat, lng },
    confident,
    decidedBy,
    scene,
    candidates: withIds.map((c) => ({ id: slug(c.name), name: c.name, why: c.why })),
  };
}

const CLAIMS_PROMPT = (building, pages) => `You are a careful local historian. Below are ${pages.length} source pages about ${building.name}${
  building.address ? ` (${building.address})` : ""
} in San Francisco.

${pages.map((p, i) => `[[PAGE ${i}]] ${p.title} — ${p.source}\n${p.text}`).join("\n\n")}

Extract 5 to 8 of the most interesting claims about its history (who made or built it, when, why, people, disasters, famous events, stories).
Include at least one well-known anecdote or legend if the sources mention one.
Return JSON:
{"built": "year or period, or null", "architect": "architect, sculptor or artist name, or null", "one_line": "a 12-word hook about it, no em-dashes",
 "claims": [{"text": "the claim in your own words, one sentence", "year": "year or null",
   "kind": "fact" or "anecdote",
   "conflict": true if sources disagree about it, else false,
   "evidence": [{"page": page number, "says": "a short paraphrase (max 20 words) of what THAT page says about it — never copy sentences"}]}]}
Only use the pages. Every claim needs evidence from at least one page. List every page that mentions it.`;

export async function backstory(building, { fresh = false } = {}) {
  const key = slug(building.id || building.name);
  if (!fresh) {
    const cached = await readCache(key);
    if (cached) return { ...cached, cached: true };
  }
  if (!hasGemini()) throw new Error("This building isn't cached yet and the Gemini key isn't set.");

  const pages = await research(building);
  if (pages.length === 0) throw new Error(`Couldn't find any history sources for ${building.name}.`);

  const extracted = await askJson(CLAIMS_PROMPT(building, pages), { timeoutMs: 40000 });
  const claims = (extracted.claims ?? []).slice(0, 8).map((c, i) => ({
    id: `c${i}`,
    text: c.text,
    year: c.year ?? null,
    kind: c.kind === "anecdote" ? "anecdote" : "fact",
    conflict: Boolean(c.conflict),
    evidence: (c.evidence ?? [])
      .filter((e) => pages[e.page])
      .map((e) => ({ source: pages[e.page].source, url: pages[e.page].url, says: e.says })),
  }));

  const judged = await judgeClaims(building, claims);
  const story = await writeStory(building, judged, extracted);

  const result = {
    building: { id: key, name: building.name, address: building.address ?? null },
    built: extracted.built ?? null,
    architect: extracted.architect ?? null,
    hook: extracted.one_line ?? null,
    claims: judged,
    story,
    sources: pages.map((p) => ({ title: p.title, url: p.url, source: p.source, via: p.via })),
    createdAt: new Date().toISOString(),
  };
  await writeCache(key, result);
  return result;
}

async function writeStory(building, claims, extracted) {
  const verified = claims.filter((c) => c.verdict === "verified").map((c) => `- ${c.text}`);
  const disputed = claims.filter((c) => c.verdict === "disputed").map((c) => `- ${c.text}`);
  const legends = claims.filter((c) => c.verdict === "legend").map((c) => `- ${c.text}`);
  return askText(
    `Write a 60-second spoken walking-tour story (130 to 160 words) about ${building.name}, for someone standing in front of it right now. It may be a building, monument, statue, arch or artwork.
Use the VERIFIED facts as fact, in roughly chronological order, and open with one of them. Mention at most one DISPUTED point and say historians disagree. Tell LEGENDS clearly as legends ("the story goes…"), near the end, as a fun closer.
Don't invent anything else. Warm, vivid, second person ("Look up at…"). No headings, no lists, no emojis, no em-dashes.
Built: ${extracted.built ?? "unknown"}. Architect: ${extracted.architect ?? "unknown"}.
VERIFIED:\n${verified.join("\n") || "(none)"}
DISPUTED:\n${disputed.join("\n") || "(none)"}
LEGENDS:\n${legends.join("\n") || "(none)"}`,
  );
}

export async function narrate(buildingId, story) {
  const key = `${slug(buildingId)}.audio`;
  const cached = await readCache(key);
  if (cached?.story === story && cached.wav) return Buffer.from(cached.wav, "base64");
  const wav = await speak(story);
  await writeCache(key, { story, wav: wav.toString("base64") });
  return wav;
}
