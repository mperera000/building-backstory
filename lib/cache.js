// File cache for researched buildings. The golden set is committed in data/cache,
// so the demo still works if venue Wi-Fi or a scraper fails.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "cache");

export async function readCache(key) {
  try {
    return JSON.parse(await readFile(join(DIR, `${key}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function writeCache(key, value) {
  try {
    await mkdir(DIR, { recursive: true });
    await writeFile(join(DIR, `${key}.json`), JSON.stringify(value, null, 2));
  } catch (err) {
    console.error("Cache write failed:", err.message);
  }
}
