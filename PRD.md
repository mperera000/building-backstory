# Building Backstory — PRD

## Problem
You walk past a beautiful old building in San Francisco and wonder what happened there. Search gives you ten tabs, half of them repeating myths. Tour apps are scripted and don't cover the building in front of you.

## User
A curious walker in SF (tourist, new resident, conference attendee) with a phone and 60 seconds.

## Promise
Point your phone at a building → in about 20 seconds hear its real story, with every claim labeled **Verified**, **Disputed** or **Legend**.

## Flow
1. **Locate:** phone GPS → nearest address (OpenStreetMap). Fallback: pick one of 5 demo buildings.
2. **Identify:** Gemini Vision looks at the photo + address and names the building. Jev decides if the match is confident or the user should confirm.
3. **Research:** Bright Data searches the web and fetches the top history pages. Fallback: Wikipedia.
4. **Fact-check:** Gemini extracts 5–8 claims, each tied to its sources. **Jev rules each one Verified / Disputed / Legend.**
5. **Narrate:** Gemini writes a ~60-second story from Verified claims (Legends are told as legends). Read aloud with Gemini TTS, or the browser voice as fallback.
6. **Trailer:** export a 30-second HyperFrames video of the story.

## Non-goals (today)
Buildings outside SF, accounts, saving tours, AR overlays, multiple languages.

## Guardrails
- Summarize sources in our own words and link them. Never copy passages.
- A claim with only one weak source can't be Verified.
- If research fails, say so instead of inventing history.

## Success (demo day)
- 5 golden buildings each return the right name and ≥3 Verified claims with sources.
- Live photo outside Moscone → story plays in ≤20 seconds.
- 3 attendee testers: would they use it on a walk? What confused them?

## Prize mapping
Jev (verdicts + match check) · Gemini (vision, writing, voice) · Bright Data (research) · HyperFrames (trailer + demo video) · Sentry (errors) · DigitalOcean (App Platform hosting) · Software Factory (this spec → golden tests → clean build).

## Decision log
| Time | Decision | Why |
|---|---|---|
| 10:15 | GPS does most of identification, photo confirms | Photo-only ID is unreliable |
| 10:15 | Cache golden-set research | Venue Wi-Fi and scraping can fail live |
