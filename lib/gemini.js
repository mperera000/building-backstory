// Gemini: vision (which building is this?), writing (claims + story) and voice (TTS).
import { GoogleGenAI } from "@google/genai";
import { postJson } from "./http.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = () => process.env.GEMINI_MODEL || "gemini-4-hydrogen";
// If the main model is overloaded (503) or rate-limited (429), try these next.
const BACKUP_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-latest"];
const TTS_MODEL = () => process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";

export const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);

async function generate(model, body, timeoutMs) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const models = model === MODEL() ? [model, ...BACKUP_MODELS.filter((m) => m !== model)] : [model];
  let lastErr;
  for (const m of models) {
    try {
      return await postJson(`${BASE}/${m}:generateContent`, body, { headers: { "x-goog-api-key": key }, timeoutMs });
    } catch (err) {
      lastErr = err;
      if (!/returned (503|429|404)|timed out/.test(err.message)) throw err;
      console.error(`Gemini ${m} unavailable, trying next model:`, err.message.split("\n")[0]);
    }
  }
  throw lastErr;
}

function textOf(data) {
  return (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
}

function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

// Ask for JSON back. `image` is { mimeType, base64 } or undefined.
export async function askJson(prompt, { image, timeoutMs = 45000 } = {}) {
  const parts = [{ text: prompt }];
  if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
  const data = await generate(
    MODEL(),
    { contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } },
    timeoutMs,
  );
  return parseJson(textOf(data));
}

export async function askText(prompt, { timeoutMs = 45000, temperature = 0.7 } = {}) {
  const data = await generate(
    MODEL(),
    { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature } },
    timeoutMs,
  );
  return textOf(data);
}

// The tour guide's voice: Gemini 3.8 TTS through the Interactions API.
// Callirrhoe is a female prebuilt voice the voice library recommends "for friendly guides".
// 3.8 returns a WAV file; older raw-PCM (audio/l16) output still gets a WAV header.
export async function speak(text, { voice = process.env.GEMINI_TTS_VOICE || "Callirrhoe", timeoutMs = 45000 } = {}) {
  if (!hasGemini()) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: "v1beta" }); // 3.8 TTS is served on v1beta
  const call = ai.interactions.create({
    model: TTS_MODEL(),
    input: [{
      type: "user_input",
      content: [{
        type: "text",
        text,
        annotations: [{ type: "speech_metadata", style: "a warm, curious walking-tour guide telling a story to someone standing beside her" }],
      }],
    }],
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice }] },
  });
  const interaction = await Promise.race([
    call,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Gemini TTS timed out after ${timeoutMs}ms`)), timeoutMs)),
  ]);
  const audio = interaction.output_audio;
  if (!audio?.data) throw new Error("Gemini TTS returned no audio");
  const buf = Buffer.from(audio.data, "base64");
  return buf.toString("ascii", 0, 4) === "RIFF" ? buf : pcmToWav(buf, 24000);
}

export function pcmToWav(pcm, sampleRate = 24000, channels = 1, bits = 16) {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bits) / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
