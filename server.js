// Building Backstory server: static phone app + JSON API. Runs on DigitalOcean App Platform (or locally).
import "./lib/instrument.js";
import * as Sentry from "@sentry/node";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { identify, backstory, narrate } from "./lib/pipeline.js";
import { DEMO_BUILDINGS } from "./lib/buildings.js";
import { hasGemini } from "./lib/gemini.js";
import { hasBrightData } from "./lib/research.js";
import { hasJev } from "./lib/jev.js";
import { nearby } from "./lib/nearby.js";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "public");
const PORT = Number(process.env.PORT || 3300);
const MAX_BODY = 10 * 1024 * 1024;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json" };

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("Photo is too large"), { status: 413 });
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function parseDataUrl(dataUrl) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl || "");
  return m ? { mimeType: m[1], base64: m[2] } : undefined;
}

const routes = {
  "GET /api/health": async () => ({ ok: true, gemini: hasGemini(), brightData: hasBrightData(), jev: hasJev(), sentry: Boolean(process.env.SENTRY_DSN) }),
  "GET /api/demo-buildings": async () => DEMO_BUILDINGS.map(({ id, name, address, lat, lng }) => ({ id, name, address, lat, lng })),
  "POST /api/identify": async (body) => identify({ image: parseDataUrl(body.image), lat: body.lat, lng: body.lng, demoId: body.demoId }),
  "POST /api/backstory": async (body) => {
    if (!body.building?.name) throw Object.assign(new Error("Missing building"), { status: 400 });
    return backstory(body.building, { fresh: Boolean(body.fresh) });
  },
  "GET /api/sentry-test": async () => {
    throw new Error(`Sentry test error ${Date.now()}`);
  },
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const key = `${req.method} ${url.pathname}`;
  try {
    if (key === "POST /api/narrate") {
      const body = await readBody(req);
      if (!body.story) return send(res, 400, { error: "Missing story" });
      const wav = await narrate(body.buildingId || "story", body.story);
      return send(res, 200, wav, "audio/wav");
    }
    if (key === "GET /api/nearby") {
      const q = url.searchParams;
      return send(res, 200, await nearby({ lat: Number(q.get("lat")), lng: Number(q.get("lng")), exclude: q.get("exclude") || "" }));
    }
    if (routes[key]) {
      const body = req.method === "POST" ? await readBody(req) : {};
      return send(res, 200, await routes[key](body));
    }
    if (req.method !== "GET") return send(res, 404, { error: "Not found" });

    const path = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
    const file = join(PUBLIC, path);
    if (!file.startsWith(PUBLIC)) return send(res, 403, { error: "Forbidden" });
    const data = await readFile(file).catch(() => null);
    if (!data) return send(res, 404, "Not found", "text/plain");
    return send(res, 200, data, TYPES[extname(file)] ?? "application/octet-stream");
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) {
      Sentry.captureException(err, { tags: { route: key } });
      Sentry.logger?.error("Request failed", { route: key, message: err.message });
    }
    console.error(key, err.message);
    return send(res, status, { error: err.message });
  }
});

server.listen(PORT, () => console.log(`Building Backstory on http://localhost:${PORT}`));
