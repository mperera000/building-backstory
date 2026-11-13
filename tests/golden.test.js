// Golden-set tests: the acceptance criteria from PRD.md, checked against the cached results
// (run `npm run golden` first to build them), plus unit tests for the decision rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_BUILDINGS, nearestDemo, slug } from "../lib/buildings.js";
import { readCache } from "../lib/cache.js";
import { ruleVerdict } from "../lib/jev.js";
import { pcmToWav } from "../lib/gemini.js";
import { htmlToText } from "../lib/http.js";

for (const b of DEMO_BUILDINGS) {
  test(`golden: ${b.name} has a fact-checked story`, async (t) => {
    const r = await readCache(slug(b.id));
    if (!r) return t.skip("not cached yet — run npm run golden");
    assert.equal(r.building.name, b.name);
    const verified = r.claims.filter((c) => c.verdict === "verified");
    assert.ok(verified.length >= 3, `expected ≥3 Verified claims, got ${verified.length}`);
    for (const c of r.claims) {
      assert.ok(["verified", "disputed", "legend"].includes(c.verdict), `bad verdict ${c.verdict}`);
      assert.ok(c.evidence.length >= 1, `claim "${c.text}" has no sources`);
      for (const e of c.evidence) assert.match(e.url, /^https?:\/\//);
    }
    const words = r.story.split(/\s+/).length;
    assert.ok(words >= 90 && words <= 220, `story is ${words} words`);
  });
}

test("rules: anecdotes are legends, conflicts are disputed, 2+ sources verify", () => {
  const ev = (...s) => s.map((source) => ({ source, says: "x" }));
  assert.equal(ruleVerdict({ kind: "anecdote", evidence: ev("a", "b") }), "legend");
  assert.equal(ruleVerdict({ kind: "fact", conflict: true, evidence: ev("a", "b") }), "disputed");
  assert.equal(ruleVerdict({ kind: "fact", evidence: ev("a", "b") }), "verified");
  assert.equal(ruleVerdict({ kind: "fact", evidence: ev("a", "a") }), "legend");
});

test("location: standing at the Palace Hotel finds it; far away finds nothing", () => {
  assert.equal(nearestDemo(37.7881, -122.4022)?.id, "palace-hotel");
  assert.equal(nearestDemo(37.7, -122.5), null);
});

test("audio: PCM is wrapped in a valid WAV header", () => {
  const wav = pcmToWav(Buffer.alloc(4800), 24000);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.length, 4844);
});

test("html: scripts and tags are stripped", () => {
  assert.equal(htmlToText("<p>Built in <b>1875</b></p><script>x()</script>"), "Built in 1875");
});
