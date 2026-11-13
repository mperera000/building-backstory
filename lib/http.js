// Small fetch helpers with timeouts, shared by every service client.

export async function request(url, { method = "GET", headers = {}, body, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: body && typeof body !== "string" ? { "Content-Type": "application/json", ...headers } : headers,
      body: body && typeof body !== "string" ? JSON.stringify(body) : body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`${new URL(url).hostname} returned ${res.status}${detail ? `: ${detail}` : ""}`);
    }
    return res;
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`${new URL(url).hostname} timed out after ${timeoutMs}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson(url, opts) {
  return (await request(url, opts)).json();
}

export async function postJson(url, body, opts = {}) {
  return (await request(url, { ...opts, method: "POST", body })).json();
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

// Turn an HTML page into readable plain text (good enough for history pages).
export function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}
