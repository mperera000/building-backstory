// "Next stop": historic places within walking distance.
// Wikipedia's geosearch finds everything nearby (landmarks, but also restaurants, offices, stations);
// TypeSafe Jev decides which ones are historic places a walker can actually go and look at.
import { getJson } from "./http.js";
import { askJev } from "./jev.js";

const UA = { "User-Agent": "building-backstory-hackathon/1.0" };
const WALK_M_PER_MIN = 80; // a relaxed sightseeing pace
const cache = new Map();

function distanceM(a, b) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Cheap first pass so Jev only sees plausible candidates.
const NOT_A_PLACE = /\b(restaurant|company|corporation|organization|organisation|foundation|agency|firm|consulate|university|school|college|station|stop|line|chain|brand|software|nonprofit|non-profit|condominium|apartment|magazine|newspaper|riot|protest|bombing|massacre|strike|parade|attack|shooting|event|former|defunct|demolished|district|neighborhood|neighbourhood|mall|attraction)\b/i;

export async function nearby({ lat, lng, exclude = "", limit = 3 }) {
  if (typeof lat !== "number" || typeof lng !== "number") throw new Error("Missing location");
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${exclude}`;
  if (cache.has(key)) return cache.get(key);

  const api = "https://en.wikipedia.org/w/api.php";
  const url = `${api}?action=query&generator=geosearch&ggscoord=${lat}%7C${lng}&ggsradius=1500&ggslimit=50&prop=description%7Ccoordinates&format=json`;
  const data = await getJson(url, { headers: UA, timeoutMs: 8000 });
  const here = { lat, lng };
  const ex = exclude.toLowerCase().replace(/,? ?san francisco$/, "");
  let places = Object.values(data?.query?.pages ?? {})
    .filter((p) => p.coordinates?.[0])
    .map((p) => {
      const c = { lat: p.coordinates[0].lat, lng: p.coordinates[0].lon };
      return { title: p.title, name: p.title.replace(/ \(San Francisco\)$/, "").replace(/, San Francisco$/, ""), description: p.description ?? "", lat: c.lat, lng: c.lng, meters: Math.round(distanceM(here, c)) };
    })
    .filter((p) => p.meters > 60) // skip where you're already standing
    .filter((p) => !ex || !p.title.toLowerCase().startsWith(ex))
    .filter((p) => !NOT_A_PLACE.test(`${p.title} ${p.description}`))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, 24);

  // Jev: is each one a historic place worth walking to?
  const questions = Object.fromEntries(places.map((p, i) => [`p${i}`, {
    type: "noul",
    instructions: `Is \`places.p${i}\` a real place a visitor can walk up to and look at today that has an interesting history: a historic building, church, theater, hotel, monument, statue, fountain, arch, mural or park? Answer no for businesses, organizations, transit stops, events, or ordinary modern towers.`,
  }]));
  const answers = places.length
    ? await askJev({ places: Object.fromEntries(places.map((p, i) => [`p${i}`, { name: p.title, description: p.description }])) }, questions)
    : null;
  const listed = (p) => /historic place|historic landmark|landmark/i.test(p.description) ? 0.3 : 0; // officially listed sites get a boost
  const judged = places.map((p, i) => ({ ...p, score: (answers?.[`p${i}`]?.noul ?? (/historic|monument|fountain|statue|memorial|church|theat/i.test(p.description) ? 0.6 : 0.3)) + listed(p) }));

  const result = {
    decidedBy: answers ? "TypeSafe Jev" : "rules",
    // Jev is conservative (churches and theaters score ~0.3-0.5), so keep the most landmark-like
    // nearby places above a floor, then show them nearest first.
    places: judged
      .filter((p) => p.score >= 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .sort((a, b) => a.meters - b.meters)
      .map(({ name, title, description, lat, lng, meters }) => ({ name, title, description, lat, lng, meters, minutes: Math.max(1, Math.round(meters / WALK_M_PER_MIN)) })),
  };
  cache.set(key, result);
  return result;
}
