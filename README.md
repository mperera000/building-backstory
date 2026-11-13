# Building Backstory

**Point your phone at a San Francisco building. Hear what really happened there, with every claim stamped Verified, Disputed or Legend.**

Built at the AIE x MLH Hackathon @ Code Summit (SF, Nov 13 2026).

## How it works
1. **Locate:** phone GPS → nearest address (OpenStreetMap).
2. **Identify:** Gemini Vision names candidate buildings from the photo; **TypeSafe Jev** picks the one that matches and decides whether to ask you to confirm.
3. **Research:** **Bright Data** searches Google (SERP API) and fetches the top history pages (Web Unlocker). Wikipedia is the fallback.
4. **Fact-check:** Gemini pulls out 5–8 claims, each tied to the sources that mention it. **Jev rules each one Verified, Disputed or Legend.**
5. **Narrate:** Gemini writes a 60-second walking-tour story that only states Verified facts as fact, and reads it aloud (Gemini TTS).
6. **Trailer:** a **HyperFrames** composition turns the verdicts into a 20-second vertical video.

Errors and traces go to **Sentry**. Hosted on **DigitalOcean App Platform**.

## Built like a software factory
`PRD.md` (spec and decision log) → `tests/golden.test.js` (acceptance criteria for 5 known buildings) → small single-purpose modules in `lib/`:

| File | Job |
|---|---|
| `lib/pipeline.js` | locate → identify → research → fact-check → narrate |
| `lib/jev.js` | the two Jev decisions, with clearly labeled rule fallbacks |
| `lib/research.js` | Bright Data SERP + Web Unlocker, Wikipedia fallback |
| `lib/gemini.js` | vision, JSON extraction, story, TTS |
| `scripts/golden.mjs` | runs and caches the golden set |
| `scripts/trailer.mjs` | writes the HyperFrames trailer |

## Run it
```bash
npm install
scripts/save-key.sh gemini        # and: jev, brightdata, serp-zone, unlocker-zone, sentry
npm run dev                       # http://localhost:3300
npm run golden -- --voice         # research + cache the 5 demo buildings
npm test
node scripts/trailer.mjs palace-hotel && (cd trailer/palace-hotel && npx hyperframes render)
```

## Guardrails
Sources are summarized in our own words and linked, never copied. A claim with one weak source can't be Verified. If research fails, the app says so instead of inventing history.
