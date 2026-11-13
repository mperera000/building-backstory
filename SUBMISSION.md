# MLH submission: field-by-field answers

## Project Details

**Project name**
Backstory

**One-line pitch**
Point your phone at any San Francisco building, statue or arch and an illustrated tour guide tells you its real story, with every claim fact-checked.

**Source code**
https://github.com/mperera000/building-backstory

**Description** (Markdown works in this box)

```markdown
You walk past a beautiful old building and wonder what happened there. Search gives you ten tabs, and half of them repeat myths.

**Backstory** turns your phone into a walking-tour guide. Knock on the orange door (or tap **Snap a photo**), take a picture, and an illustrated guide reads you the place's story. Every claim is fact-checked and taped **Verified**, **Disputed** or **Legend**, with sources one tap away. Then **Next stop** suggests real historic places a few minutes' walk away, with Google Maps walking directions.

### How it works
- **Gemini (gemini-4-hydrogen)** looks at your photo with your GPS address and names the landmark. It then pulls 5 to 8 claims from the sources and writes a 60-second spoken story that only states verified facts as fact.
- **Bright Data** finds the history pages (SERP API) and fetches them as clean markdown (Web Unlocker). Wikipedia is the fallback.
- **TypeSafe Jev (System One)** makes the judgment calls:
  1. which landmark is in the photo, and whether to ask you to confirm
  2. whether each claim is Verified, Disputed or a Legend, using only what the sources say
  3. which nearby places are real historic landmarks worth walking to (not restaurants, offices, stations or events)
- **Gemini 3.8 TTS** gives the guide her voice. She reads from her notebook while the story plays, and each sentence is highlighted as she reads.
- **Sentry** tracks errors and traces. **DigitalOcean App Platform** hosts the app, with keys stored as encrypted secrets.
- **HyperFrames** turns any story into a vertical "building trailer" video.

### Built like a software factory
Spec first (`PRD.md` with a decision log), then acceptance tests on a golden set of 5 landmarks, then small single-purpose modules. Design tokens are shared by the app and the trailer. If research fails, the guide says so instead of inventing history.

### Design
Original ink-and-watercolor SVG street and tour guide, no framework. Dark mode turns the street into a foggy night with lit windows and stars.

### What's next
Multi-stop walking tours, more cities, and saved favorites.
```

**Technologies Used** (pick from the dropdown whichever of these it lists)
Node.js · JavaScript · HTML/CSS · SVG · Gemini API · Bright Data · Sentry · DigitalOcean · HyperFrames · Wikipedia API · OpenStreetMap

**AI your project calls**
- [x] Gemini
- (TypeSafe Jev isn't in the list. It's covered in the description.)

**Demo video** (required)
Your 1 to 2 minute YouTube, Vimeo or Loom link (still to record)

**Live demo link**
https://building-backstory-9pbmr.ondigitalocean.app

**Upload Screenshots**
Suggested: (1) the home street with the guide, on desktop, (2) a story page with the paper-tape verdicts, (3) the mobile home screen, (4) dark mode.

**Other links**
None needed. Add a trailer MP4 link here if you render one.

## Prize Categories (tick these)
- [x] Best Use of Gemini API
- [x] Best Use of DigitalOcean
- [x] Sentry Raffle
- [x] Best Use of Bright Data
- [x] Best Demo Video Using HyperFrames: **only if your demo video is made with HyperFrames**
- [x] Best Overall Hack
- [x] Best Use of System One Models
- [x] Cleanest Use of a Software Factory
- [ ] Tiger Data / Snowflake: not used, leave unticked

## AI coding tools
- Coding agents and editors: [x] **Claude Code**
- Models your coding tools ran on: [x] **Claude Opus 5.5**
