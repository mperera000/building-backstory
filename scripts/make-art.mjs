// Generates the home-screen illustration: an original ink-and-watercolor San Francisco Victorian.
// Usage: node --env-file=.env scripts/make-art.mjs [variants]   → public/art/house-<n>.png
import { GoogleGenAI } from "@google/genai";
import { mkdir, writeFile } from "node:fs/promises";

const ai = new GoogleGenAI({});
const count = Number(process.argv[2] || 3);

const PROMPT = `An original hand-drawn illustration in loose black ink line work with soft watercolor washes on white watercolor paper.
Subject: a single tall, narrow San Francisco Victorian row house (Queen Anne / Painted Lady style), seen straight-on from the sidewalk, filling most of the frame vertically and centered horizontally.
Details: a pointed turret roof on one side with terracotta shingles, decorative gable trim and fish-scale shingles, two stacked bay windows with three tall panes each, deep-blue glass in the windows, cornice brackets.
Ground floor: a LARGE, clearly visible front door in the center, deep brick red, with a small window in it, at the top of five short front steps, with a little lamp beside it.
Directly above the door: a wide, completely BLANK cream-colored rectangular signboard with a thin dark frame (no letters, no text at all).
On the sidewalk to the right of the steps: a small wooden A-frame sandwich board, also completely BLANK (no text).
Palette: muted sage green and olive walls, cream trim, brick red door, terracotta roof accents, slate blue windows.
A potted plant by the steps, a hint of a neighboring pastel house cut off at the edges, a simple sidewalk line at the bottom.
Plenty of white paper margin around the house. No people, no cars, no text, no letters, no signature, no watermark.`;

await mkdir("public/art", { recursive: true });
for (let i = 1; i <= count; i++) {
  const t = Date.now();
  const interaction = await ai.interactions.create({
    model: "gemini-nano-banana-2.1",
    input: PROMPT,
    response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "9:16", image_size: "2K" },
  });
  const img = interaction.output_image;
  if (!img?.data) {
    console.log(`❌ variant ${i}: no image returned`);
    continue;
  }
  await writeFile(`public/art/house-${i}.jpg`, Buffer.from(img.data, "base64"));
  console.log(`✅ public/art/house-${i}.jpg (${Math.round(img.data.length * 0.75 / 1024)} KB, ${Date.now() - t}ms)`);
}
