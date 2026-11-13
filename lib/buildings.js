// Five demo buildings within a short walk of Moscone Center (the golden set).
// Used as a fallback when GPS/photo can't identify a building, and as our test set.
export const DEMO_BUILDINGS = [
  { id: "palace-hotel", name: "Palace Hotel", address: "2 New Montgomery St, San Francisco", lat: 37.7881, lng: -122.4021 },
  { id: "ferry-building", name: "San Francisco Ferry Building", address: "1 Ferry Building, San Francisco", lat: 37.7955, lng: -122.3937 },
  { id: "old-mint", name: "Old San Francisco Mint", address: "88 5th St, San Francisco", lat: 37.7826, lng: -122.4069 },
  { id: "flood-building", name: "James Flood Building", address: "870 Market St, San Francisco", lat: 37.7849, lng: -122.4077 },
  { id: "transamerica", name: "Transamerica Pyramid", address: "600 Montgomery St, San Francisco", lat: 37.7952, lng: -122.4028 },
];

export function nearestDemo(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  let best = null;
  for (const b of DEMO_BUILDINGS) {
    const d = Math.hypot(b.lat - lat, (b.lng - lng) * Math.cos((lat * Math.PI) / 180));
    if (!best || d < best.d) best = { b, d };
  }
  // ~0.0015 degrees ≈ 150 m
  return best && best.d < 0.0015 ? best.b : null;
}

export function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
