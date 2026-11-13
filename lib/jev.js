// TypeSafe Jev (a System One decision model) makes the two judgment calls:
//   1. Which candidate building is in the photo, and is the match confident?
//   2. Is each history claim Verified, Disputed or a Legend?
// If Jev is unavailable we fall back to simple, clearly-labeled rules.
import { postJson } from "./http.js";

const JEV_URL = "https://api.typesafe.ai/v1/systemone";
const TIMEOUT_MS = Number(process.env.JEV_TIMEOUT_MS || 6000);

export const hasJev = () => Boolean(process.env.TYPESAFE_API_KEY);

export async function askJev(state, questions) {
  if (!hasJev()) return null;
  try {
    const data = await postJson(
      JEV_URL,
      { model: "jev-latest", state, questions },
      { headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}` }, timeoutMs: TIMEOUT_MS },
    );
    return data.answers ?? null;
  } catch (err) {
    console.error("Jev fallback:", err.message);
    return null;
  }
}

// candidates: [{ id, name, why }] from Gemini Vision; scene: what Gemini saw; address: from GPS.
export async function pickBuilding({ candidates, scene, address }) {
  const answers = await askJev(
    {
      photo_description: scene || "no photo",
      street_address_from_gps: address || "unknown",
      candidates: Object.fromEntries(candidates.map((c) => [c.id, { name: c.name, reasoning: c.why }])),
    },
    {
      building: {
        type: "choice",
        instructions:
          "Which building in `candidates` is most likely the one in the photo, given `photo_description` and `street_address_from_gps`?",
        criteria: Object.fromEntries(candidates.map((c) => [c.id, c.name])),
      },
      confident: {
        type: "noul",
        instructions:
          "Is it clear enough which building this is that we can tell its history without asking the user to confirm? Unsure or ambiguous means no.",
      },
    },
  );
  if (!answers) {
    return { pick: candidates[0], confident: candidates.length === 1, decidedBy: "rules" };
  }
  const pick = candidates.find((c) => c.id === answers.building?.choice) ?? candidates[0];
  return { pick, confident: (answers.confident?.noul ?? 0) >= 0.6, decidedBy: "TypeSafe Jev" };
}

const VERDICTS = {
  verified: "Stated as fact by the sources (a reliable reference, or two or more sources agree) and nothing in the sources contradicts it.",
  disputed: "The sources give conflicting versions (different dates, numbers, names or causes), or one source questions it.",
  legend: "A colorful anecdote, rumor, ghost story or 'local lore' that sources repeat but don't firmly establish, or that rests on one weak source.",
};

// claims: [{ id, text, kind, evidence: [{ source, says }] }]
export async function judgeClaims(building, claims) {
  if (claims.length === 0) return [];
  const questions = {};
  for (const c of claims) {
    questions[c.id] = {
      type: "choice",
      instructions: `Judge claim \`claims.${c.id}.text\` about ${building.name} using only \`claims.${c.id}.evidence\` (what each source says about it).`,
      criteria: VERDICTS,
    };
  }
  const answers = await askJev(
    {
      building: building.name,
      claims: Object.fromEntries(claims.map((c) => [c.id, { text: c.text, evidence: c.evidence }])),
    },
    questions,
  );
  return claims.map((c) => {
    const choice = answers?.[c.id]?.choice;
    if (choice && VERDICTS[choice]) return { ...c, verdict: choice, decidedBy: "TypeSafe Jev" };
    return { ...c, verdict: ruleVerdict(c), decidedBy: "rules" };
  });
}

export function ruleVerdict(claim) {
  const sources = new Set((claim.evidence ?? []).map((e) => e.source)).size;
  if (claim.kind === "anecdote") return "legend";
  if (claim.conflict) return "disputed";
  return sources >= 2 ? "verified" : "legend";
}
