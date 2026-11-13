// Research: Bright Data finds and fetches history pages about a building.
// Without Bright Data (or if it fails) we fall back to Wikipedia, so the app still works.
import { request, getJson, hostOf, htmlToText } from "./http.js";

const BD_URL = "https://api.brightdata.com/request";
const UA = { "User-Agent": "building-backstory-hackathon/1.0" };
const SKIP_HOSTS = /(google\.com|tripadvisor|yelp|booking|expedia|hotels\.com|facebook|instagram|tiktok|pinterest|youtube|x\.com|twitter|reddit|linkedin|zillow|redfin|loopnet)/i;
const MAX_PAGES = 6;
const MAX_CHARS = 4000;

export const hasBrightData = () => Boolean(process.env.BRIGHTDATA_API_KEY);

// One endpoint for both products (per docs.brightdata.com): POST /request with a zone name.
async function brightData(body, timeoutMs) {
  const res = await request(BD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}` },
    body,
    timeoutMs,
  });
  return res.text();
}

// SERP API with format "json" returns parsed Google results ({ organic: [{ link, title, description }] }).
async function serp(query) {
  const zone = process.env.BRIGHTDATA_SERP_ZONE || "serp_api1";
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=us`;
  let data = JSON.parse(await brightData({ zone, url, format: "json" }, 30000));
  // format "json" wraps the response as { status_code, headers, body }, and body is a JSON string.
  if (data.status_code && data.status_code !== 200) {
    throw new Error(`SERP ${data.status_code}: ${String(data.body).slice(0, 120)}`);
  }
  if (typeof data.body === "string") data = JSON.parse(data.body);
  else if (data.body) data = data.body;
  const results = data.organic ?? [];
  return results
    .map((r) => ({ title: r.title, url: r.link, snippet: r.description ?? "" }))
    .filter((r) => r.url && !SKIP_HOSTS.test(r.url));
}

// Web Unlocker returns the page as clean markdown, which is ready for the LLM.
async function unlock(url) {
  const zone = process.env.BRIGHTDATA_UNLOCKER_ZONE || "web_unlocker1";
  const text = await brightData({ zone, url, format: "raw", data_format: "markdown" }, 20000);
  const clean = /<html|<body|<div/i.test(text.slice(0, 2000)) ? htmlToText(text) : text;
  return clean
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // drop images
    .replace(/\[\\?\[\d+\\?\]\]\([^)]*\)/g, "") // drop citation markers like [[1]](#cite)
    .replace(/\[\]\([^)]*\)/g, "") // drop empty links
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // keep link text only
    .replace(/https?:\/\/\S+/g, "")
    .split("\n")
    .map((l) => l.replace(/^[*\-\s]+/, "").trim())
    .filter((l) => (l.match(/[a-z]/gi) ?? []).length > 50 || /^#{1,3} \w/.test(l)) // keep prose and headings, drop menus
    .join("\n")
    .slice(0, MAX_CHARS);
}

async function viaBrightData(building) {
  const name = building.name.replace(/,?\s*San Francisco$/i, "");
  let results;
  try {
    results = await serp(`${name} San Francisco history`);
  } catch (err) {
    console.error("SERP retry with a simpler query:", err.message);
    results = await serp(`${name} history`);
  }
  results = results.slice(0, MAX_PAGES);
  const pages = await Promise.allSettled(results.map((r) => unlock(r.url)));
  return results
    .map((r, i) => ({
      title: r.title,
      url: r.url,
      source: hostOf(r.url),
      // If a page can't be fetched, keep the search snippet so the source still counts.
      text: pages[i].status === "fulfilled" && pages[i].value.length > 200 ? pages[i].value : r.snippet,
      via: "Bright Data",
    }))
    .filter((p) => p.text);
}

async function viaWikipedia(building) {
  const api = "https://en.wikipedia.org/w/api.php";
  const q = `${building.name} San Francisco`;
  const search = await getJson(`${api}?action=query&list=search&srlimit=2&format=json&srsearch=${encodeURIComponent(q)}`, {
    headers: UA,
    timeoutMs: 8000,
  });
  const titles = (search?.query?.search ?? []).map((s) => s.title);
  if (titles.length === 0) return [];
  const ex = await getJson(
    `${api}?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(titles.join("|"))}`,
    { headers: UA, timeoutMs: 8000 },
  );
  return Object.values(ex?.query?.pages ?? {})
    .filter((p) => p.extract)
    .map((p) => ({
      title: p.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
      source: "en.wikipedia.org",
      text: p.extract.slice(0, MAX_CHARS * 2),
      via: "Wikipedia",
    }));
}

export async function research(building) {
  if (hasBrightData()) {
    try {
      // Bright Data finds the web's sources; Wikipedia guarantees one solid baseline to cross-check against.
      const [pages, wiki] = await Promise.all([viaBrightData(building), viaWikipedia(building).catch(() => [])]);
      const useful = pages.filter((p) => p.text.length > 120);
      const hasWiki = useful.some((p) => p.source === "en.wikipedia.org" && p.text.length > 1000);
      return [...useful, ...(hasWiki ? [] : wiki.slice(0, 1))];
    } catch (err) {
      console.error("Bright Data fallback:", err.message);
    }
  }
  return viaWikipedia(building);
}
