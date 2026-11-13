// Backstory phone app.
import { LOOKS, guide, GUIDE_FILTERS, BUBBLE } from "/guide.js";
const $ = (s) => document.querySelector(s);

// ---- The tour guide (the Archivist) ----
const GUIDE = LOOKS.archivist;
document.querySelector("svg defs").insertAdjacentHTML("beforeend", GUIDE_FILTERS);
$("#guide-home .walker").innerHTML = guide(GUIDE, "full");
$("#guide-bubble").outerHTML = BUBBLE;
$("#guide-reading").innerHTML = guide(GUIDE, "read");
// narrator: looks up while idle, reads aloud from her book while the story plays
$("#mini-face").innerHTML = guide(GUIDE, "talk");
$("#guide-narrator").innerHTML = `<g class="pose-idle">${guide(GUIDE, "talk")}</g><g class="pose-reading">${guide(GUIDE, "read")}</g>`;

// She walks to the door every time the app opens. The walk waits until the page is
// actually visible (a hidden tab would finish it unseen); reduced motion shows her already there.
(function entrance() {
  const home = $("#home");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return home.classList.add("arrived");
  const start = () => {
    home.classList.add("walking");
    setTimeout(() => home.classList.replace("walking", "arrived"), 2250);
  };
  const whenVisible = () => {
    if (document.visibilityState === "visible") return setTimeout(start, 350);
    document.addEventListener("visibilitychange", whenVisible, { once: true });
  };
  (document.fonts?.ready ?? Promise.resolve()).then(whenVisible);
})();
const screens = ["home", "working", "confirm", "result"];
const STEP_ORDER = ["locate", "identify", "pick", "research", "judge", "story"];
let current = null;
let origin = null; // { lat, lng } used to find the next stop
let snapped = null; // the visitor's own photo, pinned to the story card

function show(id) {
  for (const s of screens) document.getElementById(s).classList.toggle("active", s === id);
  if (id !== "result") $("#mini-player").hidden = true;
  window.scrollTo({ top: 0 });
}
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => reset()));

function toast(msg, { error = false } = {}) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("error", error);
  t.setAttribute("role", error ? "alert" : "status");
  t.classList.add("show");
  clearTimeout(toast.timer);
  // errors stay up longer so there's time to read them; a tap dismisses either kind
  toast.timer = setTimeout(() => t.classList.remove("show"), error ? 7000 : 4000);
}
$("#toast").addEventListener("click", () => $("#toast").classList.remove("show"));

function reset() {
  stopAudio();
  $("#photo").value = "";
  show("home");
}

async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---- Steps UI ----
function setStep(step, state = "doing") {
  const li = document.querySelector(`[data-step="${step}"]`);
  if (!li) return;
  const idx = STEP_ORDER.indexOf(step);
  if (state === "doing") {
    STEP_ORDER.slice(0, idx).forEach((s) => {
      const el = document.querySelector(`[data-step="${s}"]`);
      if (!el.classList.contains("skip")) el.className = "done";
    });
  }
  li.className = state;
}
function resetSteps(skip = []) {
  STEP_ORDER.forEach((s) => (document.querySelector(`[data-step="${s}"]`).className = skip.includes(s) ? "skip" : ""));
}

// ---- Photo + location ----
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 },
    );
  });
}

function shrink(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("Couldn't read that photo"));
    img.src = URL.createObjectURL(file);
  });
}

$("#photo").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  resetSteps();
  $("#preview").removeAttribute("src");
  $("#working-title").textContent = "Looking at your photo";
  show("working");
  try {
    setStep("locate");
    const [image, loc] = await Promise.all([shrink(file), getLocation()]);
    origin = typeof loc.lat === "number" ? { lat: loc.lat, lng: loc.lng } : null;
    $("#preview").src = image;
    snapped = image;
    $("#preview").alt = "Your photo";
    setStep("identify");
    const pickTimer = setTimeout(() => setStep("pick"), 2500);
    const id = await api("/api/identify", { image, ...loc });
    clearTimeout(pickTimer);
    if (!id.building) throw new Error("We couldn't tell what this is. Try again a little closer, or pick a story on the street.");
    if (!id.confident && id.candidates?.length > 1) return askWhich(id);
    $("#working-title").textContent = id.building.name;
    await tell(id.building);
  } catch (err) {
    fail(err);
  }
});

function askWhich(id) {
  $("#scene").textContent = id.scene ? `It looks like: ${id.scene}` : "";
  const list = $("#candidates");
  list.innerHTML = "";
  for (const c of id.candidates) {
    const b = document.createElement("button");
    b.className = "btn btn-option option";
    b.innerHTML = `<strong></strong><small></small>`;
    b.querySelector("strong").textContent = c.name;
    b.querySelector("small").textContent = c.why || "";
    b.onclick = () => {
      show("working");
      tell({ id: c.id, name: c.name, address: id.building?.address }).catch(fail);
    };
    list.append(b);
  }
  show("confirm");
}

// ---- Demo stories: hanging tags on the houses and the chips below ----
let demos = {};
function openDemo(id) {
  const b = demos[id];
  if (!b) return;
  origin = typeof b.lat === "number" ? { lat: b.lat, lng: b.lng } : null;
  snapped = null;
  resetSteps(["locate", "identify", "pick"]);
  $("#preview").removeAttribute("src");
  $("#working-title").textContent = b.name;
  show("working");
  tell(b).catch(fail);
}
async function loadDemos() {
  try {
    for (const b of await api("/api/demo-buildings")) demos[b.id] = b;
  } catch {
    /* demos are optional */
  }
  document.querySelectorAll("[data-demo]").forEach((el) => {
    el.addEventListener("click", () => openDemo(el.dataset.demo));
    el.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openDemo(el.dataset.demo)));
  });
}

// ---- The door: swings open, then the camera opens ----
const door = $("#door");
function openDoor() {
  door.classList.add("open");
  $("#photo").click(); // must run inside the tap so phones allow the camera
  setTimeout(() => door.classList.remove("open"), 2500);
}
door.addEventListener("click", openDoor);
$("#snap").addEventListener("click", openDoor);
door.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openDoor()));

// ---- Story ----
async function tell(building) {
  setStep("research");
  const t1 = setTimeout(() => setStep("judge"), 6000);
  const t2 = setTimeout(() => setStep("story"), 11000);
  try {
    const data = await api("/api/backstory", { building });
    current = data;
    render(data);
  } finally {
    clearTimeout(t1);
    clearTimeout(t2);
  }
}

// Visitors see a plain sentence in the guide's voice; the technical detail stays in the console.
function friendly(err) {
  const m = String(err?.message || "");
  if (/couldn't tell what this is|couldn't read that photo/i.test(m)) return m;
  if (/history sources/i.test(m)) return "I couldn't find enough history about this one yet. Try a nearby landmark, or pick a story on the street.";
  if (/too large/i.test(m)) return "That photo is a little too big. Try again with a regular camera photo.";
  if (/failed to fetch|network|load failed/i.test(m)) return "I lost the connection for a moment. Check your signal and try again.";
  return "I couldn't reach the archives just now. Try again in a moment, or pick a story on the street.";
}
function fail(err) {
  console.error(err);
  toast(friendly(err), { error: true });
  show("home");
}

const LABEL = { verified: "Verified", disputed: "Disputed", legend: "Legend" };

function render(d) {
  // the photo they snapped, pinned to the card like a print
  $(".plaque-photo").hidden = !snapped;
  if (snapped) $("#r-photo").src = snapped;
  else $("#r-photo").removeAttribute("src");
  $("#r-name").textContent = d.building.name;
  $("#r-address").textContent = d.building.address || "San Francisco";
  $("#r-hook").textContent = d.hook || "";
  // show only what we actually know
  $("#r-built").textContent = d.built || "";
  $("#r-built").parentElement.hidden = !d.built;
  $("#r-architect").textContent = d.architect || "";
  $("#r-architect").parentElement.hidden = !d.architect;
  $("#r-count").textContent = String(d.claims.length);
  // short paragraphs of about three sentences; every sentence is its own span so it can light up as she reads
  sentences = d.story.match(/[^.!?]+[.!?]+["')]*\s*/g) ?? [d.story];
  let at = 0;
  sentenceStarts = sentences.map((t) => ((at += t.length), at - t.length));
  $("#story").replaceChildren(...Array.from({ length: Math.ceil(sentences.length / 3) }, (_, i) => {
    const p = document.createElement("p");
    sentences.slice(i * 3, i * 3 + 3).forEach((t, j) => {
      const span = document.createElement("span");
      span.className = "s";
      span.dataset.i = String(i * 3 + j);
      span.textContent = t;
      p.append(span);
    });
    return p;
  }));
  const judges = new Set(d.claims.map((c) => c.decidedBy));
  $("#r-judge").textContent = judges.has("TypeSafe Jev") ? "Every claim judged by TypeSafe Jev against the sources." : "Claims judged by source-count rules.";

  const counts = { verified: 0, disputed: 0, legend: 0 };
  d.claims.forEach((c) => counts[c.verdict]++);
  $("#tally").innerHTML = Object.entries(counts)
    .map(([k, n]) => `<span class="mini ${k}">${n} ${LABEL[k]}</span>`)
    .join("");

  renderTimeline(d.claims);
  const sl = $("#sources");
  sl.innerHTML = "";
  for (const s of d.sources) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = s.title;
    const small = document.createElement("small");
    small.textContent = ` ${s.source}, via ${s.via}`;
    li.append(a, small);
    sl.append(li);
  }
  stopAudio();
  audioFor = null;
  $("#mini-player").hidden = true;
  show("result");
  loadNextStop(d);
}

// ---- Timeline: claims in date order, each with its stamp ----
const yearOf = (c) => Number(String(c.year ?? "").match(/\d{4}/)?.[0] ?? 99999);
function renderTimeline(claims) {
  const row = $("#timeline");
  row.innerHTML = "";
  [...claims].sort((a, b) => yearOf(a) - yearOf(b)).forEach((c, i) => {
    const card = document.createElement("article");
    card.className = `t-card ${c.verdict}`;
    card.setAttribute("role", "listitem");
    card.innerHTML = `<p class="t-year"></p><p class="t-text"></p>
      <span class="stamp ${c.verdict}" style="animation-delay:${0.2 + i * 0.12}s">${LABEL[c.verdict]}</span>
      <details><summary>Why: ${c.evidence.length} source${c.evidence.length === 1 ? "" : "s"}</summary><ul></ul></details>`;
    card.querySelector(".t-year").textContent = /\d{4}/.test(String(c.year ?? "")) ? c.year : "Undated";
    card.querySelector(".t-text").textContent = c.text;
    const ul = card.querySelector("ul");
    for (const e of c.evidence) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = e.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = e.source;
      li.append(a, document.createTextNode(`: ${e.says}`));
      ul.append(li);
    }
    row.append(card);
  });
  row.scrollLeft = 0;
}

// ---- Next stop: historic places within a short walk (Wikipedia nearby, filtered by Jev) ----
async function loadNextStop(d) {
  const box = $("#next-stop");
  box.hidden = true;
  if (!origin) return;
  try {
    const q = new URLSearchParams({ lat: origin.lat, lng: origin.lng, exclude: d.building.name });
    const { places } = await api(`/api/nearby?${q}`);
    if (!places?.length || current !== d) return;
    const list = $("#next-list");
    list.innerHTML = "";
    for (const p of places) {
      const card = document.createElement("div");
      card.className = "next-card";
      card.innerHTML = `<div><p class="n-name"></p><p class="n-desc"></p></div>
        <a class="n-walk" target="_blank" rel="noopener"><i class="ph ph-person-simple-walk" aria-hidden="true"></i> <span></span> <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>
        <button class="btn btn-ghost n-go">Hear its story</button>`;
      card.querySelector(".n-name").textContent = p.name;
      card.querySelector(".n-desc").textContent = p.description || "Historic place";
      card.querySelector(".n-walk span").textContent = `${p.minutes} min walk`;
      // Walking directions in Google Maps. No origin: Maps starts from wherever the phone is,
      // and the visitor's own location never goes into the link.
      const walk = card.querySelector(".n-walk");
      walk.href = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`;
      walk.setAttribute("aria-label", `Walking directions to ${p.name} in Google Maps, about ${p.minutes} minutes`);
      card.querySelector(".n-go").addEventListener("click", () => openPlace(p));
      list.append(card);
    }
    box.hidden = false;
  } catch (err) {
    console.error("Next stop unavailable:", err.message);
  }
}
function openPlace(p) {
  stopAudio();
  origin = { lat: p.lat, lng: p.lng };
  snapped = null;
  resetSteps(["locate", "identify", "pick"]);
  $("#preview").removeAttribute("src");
  $("#working-title").textContent = p.name;
  show("working");
  tell({ name: p.title, address: p.description || "San Francisco" }).catch(fail);
}

// ---- Audio: Gemini voice, browser voice as fallback ----
const audio = $("#audio");
let audioFor = null;
let sentences = [];
let sentenceStarts = [];

// light up the sentence she is reading
function highlight(i) {
  document.querySelectorAll("#story .s.now").forEach((el) => el.classList.remove("now"));
  if (i >= 0) document.querySelector(`#story .s[data-i="${i}"]`)?.classList.add("now");
}
function sentenceAtChar(ch) {
  let i = 0;
  while (i + 1 < sentenceStarts.length && sentenceStarts[i + 1] <= ch) i++;
  return i;
}
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
audio.addEventListener("timeupdate", () => {
  if (!audio.duration || !current) return;
  const frac = audio.currentTime / audio.duration;
  highlight(sentenceAtChar(frac * current.story.length)); // estimate by text position
  $("#mini-progress").style.transform = `scaleX(${frac})`;
  $("#mini-time").textContent = fmt(audio.currentTime);
});

// the pinned player appears once the story has started and the main Play row is off screen
const playRowSeen = new IntersectionObserver(([e]) => {
  const started = Boolean(audioFor) || speechSynthesis?.speaking;
  $("#mini-player").hidden = e.isIntersecting || !started || !$("#result").classList.contains("active");
});
playRowSeen.observe($(".narrator-row"));
$("#mini-toggle").addEventListener("click", () => $("#play").click());
function stopAudio() {
  audio.pause();
  speechSynthesis?.cancel?.();
  setPlaying(false);
}
function setPlaying(on, label) {
  $("#play-label").textContent = label || (on ? "Pause" : "Play the story");
  $("#mini-toggle").innerHTML = `<i class="ph-fill ${on ? "ph-pause" : "ph-play"}" aria-hidden="true"></i>`;
  $("#mini-toggle").setAttribute("aria-label", on ? "Pause the story" : "Play the story");
  $("#guide-narrator").classList.toggle("speaking", Boolean(on));
  const icon = $(".play-icon");
  icon.classList.toggle("ph-play", !on);
  icon.classList.toggle("ph-pause", on);
}
audio.addEventListener("ended", () => { setPlaying(false); highlight(-1); });

$("#play").addEventListener("click", async () => {
  if (!current) return;
  if (!audio.paused || speechSynthesis?.speaking) return stopAudio();
  if (audioFor === current.building.id && audio.src) {
    audio.play();
    return setPlaying(true);
  }
  $("#play").disabled = true;
  setPlaying(false, "Warming up…");
  try {
    const res = await fetch("/api/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildingId: current.building.id, story: current.story }),
    });
    if (!res.ok) throw new Error("voice unavailable");
    audio.src = URL.createObjectURL(await res.blob());
    audioFor = current.building.id;
    await audio.play();
    setPlaying(true);
  } catch {
    const u = new SpeechSynthesisUtterance(current.story);
    u.rate = 0.98;
    u.onboundary = (e) => highlight(sentenceAtChar(e.charIndex));
    u.onend = () => { setPlaying(false); highlight(-1); };
    speechSynthesis.speak(u);
    setPlaying(true);
  } finally {
    $("#play").disabled = false;
  }
});

loadDemos();
