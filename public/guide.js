// The tour guide: one original ink-and-watercolor character, drawn in SVG.
// guide(look, pose) returns SVG markup in local coordinates (feet at 0,0, about 190 units tall).
// Poses: "full" (walk / point, driven by CSS classes), "read" (bust with a book), "talk" (bust, narrating).

const INK = "#1f1d1a";

function ell(cx, cy, rx, ry) {
  return `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
}
// a watercolor fill under a wobbly ink outline
function part(d, fill, ink = true) {
  return `<path class="gw" d="${d}" fill="${fill}"/>${ink ? `<path class="gk" d="${d}"/>` : ""}`;
}

export const LOOKS = {
  historian: {
    label: "A. Bookish historian",
    skin: "#a86e4c", hair: "#2a1d17", top: "#d9a13b", inner: "#f3ead6", stripe: "#2d4a6b",
    pants: "#5e6b45", shoes: "#6b4a33", hairStyle: "bun", glasses: true, prop: "notebook", bag: "#8a5a3a",
  },
  walker: {
    label: "B. Fog-ready walker",
    skin: "#7a4a33", hair: "#33251d", top: "#d9542f", inner: "#d9542f", scarf: "#2b3f5c",
    pants: "#4c6a8c", shoes: "#f2efe8", hairStyle: "curls", prop: "map",
  },
  archivist: {
    label: "C. Archivist in linen",
    skin: "#b77f58", hair: "#261a14", top: "#ece2cd", inner: "#ece2cd", scarf: "#8fa47a",
    pants: "#3d3a36", shoes: "#5b3a28", hairStyle: "braid", earrings: true, prop: "journal", coat: true,
  },
};

function hairBack(L) {
  if (L.hairStyle === "curls") {
    const c = [[-14, -170, 9], [14, -170, 9], [-13, -156, 8], [13, -156, 8], [0, -185, 11], [-10, -182, 9], [10, -182, 9], [-15, -145, 7], [15, -145, 7]];
    return c.map(([x, y, r]) => part(ell(x, y, r, r), L.hair, false)).join("") +
      `<path class="gk" d="M-19 -172 q3 -3 5 0 M15 -170 q3 -3 5 0 M-17 -150 q3 -3 5 0 M13 -150 q3 -3 5 0 M-5 -191 q3 -3 5 0 M7 -188 q3 -3 5 0" stroke="#5a4236"/>`;
  }
  if (L.hairStyle === "bun") return part(ell(9, -184, 7, 7), L.hair);
  if (L.hairStyle === "braid") {
    // drawn behind the head: it starts behind her ear and falls over her shoulder
    let b = "";
    for (let i = 0; i < 7; i++) b += part(ell(15 + i * 0.4, -156 + i * 7, 3.6, 4.4), L.hair);
    return b + part(ell(17.6, -106, 2, 1.6), L.scarf);
  }
  return "";
}
function hairFront(L) {
  if (L.hairStyle === "curls") {
    return [[-7, -180, 6.5], [6, -181, 6.5], [0, -183, 6]].map(([x, y, r]) => part(ell(x, y, r, r), L.hair, false)).join("");
  }
  const cap = "M-13 -166 Q-15 -186 0 -185 Q15 -186 13 -166 Q11 -176 1 -178 Q-9 -177 -13 -166Z";
  let s = part(cap, L.hair);
  if (L.hairStyle === "bun") s += `<path class="gk" d="M-6 -182 q4 4 10 3 M-10 -176 q3 3 4 8"/>`;
  return s;
}

function face(L, mode) {
  const eyes = mode === "read"
    ? `<path class="gk" d="M-6.5 -167 q2 1.8 4 0 M2.5 -167 q2 1.8 4 0"/>`
    : `<circle cx="-4.5" cy="-168" r="1.3" fill="${INK}"/><circle cx="4.5" cy="-168" r="1.3" fill="${INK}"/>`;
  let s = eyes;
  s += `<path class="gk" d="M-7 -172.5 q2.5 -1.5 5 0 M2 -172.5 q2.5 -1.5 5 0 M0.5 -166 q1.6 3 -1.2 3.6"/>`;
  s += `<circle cx="-7" cy="-161.5" r="2.4" fill="#c4553f" opacity=".18"/><circle cx="7" cy="-161.5" r="2.4" fill="#c4553f" opacity=".18"/>`;
  s += `<path class="gk m-closed" d="M-3.6 -159 q3.6 2.6 7.2 0"/>`;
  s += `<path class="m-open" d="${ell(0, -158.6, 2.6, 2)}" fill="#6b2a22"/>`;
  if (L.glasses) s += `<path class="gk" d="${ell(-4.8, -168, 4, 3.6)} ${ell(4.8, -168, 4, 3.6)} M-0.8 -168 h1.6"/>`;
  if (L.earrings) s += `<circle cx="-12.6" cy="-160" r="1.7" fill="#d4a537"/><circle cx="12.6" cy="-160" r="1.7" fill="#d4a537"/>`;
  return s;
}

function head(L, mode) {
  return hairBack(L) +
    part("M-4 -153 h8 v12 h-8z", L.skin) +
    part(ell(-12.4, -165, 2.4, 3.4), L.skin) + part(ell(12.4, -165, 2.4, 3.4), L.skin) +
    part(ell(0, -167, 12.5, 14.5), L.skin) +
    face(L, mode) + hairFront(L);
}

function torso(L) {
  const body = L.coat
    ? "M-17 -142 Q-20 -96 -23 -44 L23 -44 Q20 -96 17 -142 Q0 -147 -17 -142Z"
    : "M-17 -142 Q-19 -120 -14 -100 L-15 -86 L15 -86 L14 -100 Q19 -120 17 -142 Q0 -147 -17 -142Z";
  let s = part(body, L.top);
  if (L.stripe) {
    s += part("M-7 -143 L-6 -88 L6 -88 L7 -143 Q0 -145 -7 -143Z", L.inner);
    s += `<path d="M-6.5 -133 h13 M-6.3 -123 h12.6 M-6.2 -113 h12.4 M-6.1 -103 h12.2 M-6 -94 h12" stroke="${L.stripe}" stroke-width="1.6" opacity=".8"/>`;
  }
  if (L.coat) s += `<path class="gk" d="M0 -136 V-44 M-8 -110 h-6 M8 -110 h6"/>`;
  if (L.scarf) s += part("M-10 -146 Q0 -138 10 -146 L11 -140 Q0 -132 -11 -140Z M4 -139 L9 -112 L3 -110 L0 -137Z", L.scarf);
  if (L.bag) s += `<path class="gk" d="M-14 -141 L17 -98" stroke-width="2.6" stroke="${L.bag}"/>` + part("M10 -102 h14 v13 h-14z", L.bag);
  return s;
}

function prop(L) {
  if (L.prop === "journal") {
    // a leather field notebook tucked against her hip: cream page edges, an elastic band, a little label
    return `<g transform="rotate(-10 -22 -103)">` +
      part("M-31 -118 h17 v28 h-17z", "#f1e8d2") +            // page block, peeking out on the right
      part("M-33 -119 h17 v28 h-17z", "#8a3f2a") +            // cover
      `<path class="gk" d="M-15.5 -117 v25 M-14.5 -116 v24" stroke-width=".6"/>` + // page edges
      `<path d="M-19 -119 v28" stroke="#2a1d14" stroke-width="1.6"/>` +           // elastic band
      part("M-30 -112 h8 v5 h-8z", "#efe2c4") +                // label
      `</g>`;
  }
  if (L.prop === "notebook") return part("M-26 -104 l10 -2 l2 14 l-10 2z", "#6b3e2e");
  if (L.prop === "map") return part("M-22 -120 l6 -2 l9 30 l-6 2z", "#efe4c8") + `<path class="gk" d="M-19 -112 l4 12"/>`;
  return `<path class="gk" d="M-19 -103 L-16 -93" stroke-width="2.4"/>` + part(ell(-23, -110, 6, 6), "#dcebf3");
}

function leg(L, side) {
  const x = side === "l" ? -7 : 7;
  return `<g class="leg leg-${side}">` +
    part(`M${x - 5} -90 L${x - 4} -10 L${x + 4} -10 L${x + 5} -90Z`, L.pants) +
    part(ell(x + (side === "l" ? -1 : 1), -6, 7.5, 4.6), L.shoes) + `</g>`;
}

function arm(L, side) {
  const s = side === "l" ? -1 : 1;
  const sleeve = `M${17 * s} -141 L${21 * s} -97 L${14 * s} -97 L${11 * s} -138Z`;
  const hand = part(ell(17.5 * s, -93, 3.6, 3.8), L.skin);
  // a held notebook sits under the fingers (hand and thumb drawn on top); other props sit in front
  const held = side === "l" && L.prop === "journal";
  return `<g class="arm arm-${side}">` + part(sleeve, L.top) +
    (held ? prop(L) + hand + part(ell(-21.5, -101, 1.8, 2.6), L.skin) : hand + (side === "l" ? prop(L) : "")) + `</g>`;
}

export function guide(L, pose = "full") {
  if (pose === "full") {
    return `<g class="guide-figure"><g class="bob">${leg(L, "l")}${leg(L, "r")}${arm(L, "l")}${torso(L)}${arm(L, "r")}${head(L, "full")}</g></g>`;
  }
  const book = pose === "read"
    ? part("M-20 -122 L0 -118 L20 -122 L20 -105 L0 -101 L-20 -105Z", "#f3ead6") + `<path class="gk" d="M0 -118 V-101 M-15 -117 h10 M-15 -113 h10 M5 -117 h10 M5 -113 h10"/>` +
      part(ell(-20, -112, 3.6, 3.8), L.skin) + part(ell(20, -112, 3.6, 3.8), L.skin)
    : "";
  return `<g class="guide-bust ${pose}">${torso(L)}${head(L, pose)}${book}</g>`;
}

// SVG filters the figure needs (finer than the street's, so the face stays clean)
export const GUIDE_FILTERS = `
  <filter id="ink-fine" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.1"/>
  </filter>
  <filter id="wash-fine" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="5" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.5 1.1" result="ga"/>
    <feComposite in="d" in2="ga" operator="in"/>
  </filter>`;

// Speech bubble: a solid card beside her head over the plain blue wall, short tail to her.
// Kept to one job (the intro above already explains the app). Scene coordinates.
export const BUBBLE = `<g class="bubble">
  <path d="M24 294 h80 q8 0 8 8 v10 l12 10 l-12 2 v12 q0 8 -8 8 h-80 q-8 0 -8 -8 v-34 q0 -8 8 -8z" fill="var(--tag)" stroke="#1f1d1a" stroke-width="1.1" stroke-linejoin="round"/>
  <g class="hand-read" font-size="14.5"><text x="26" y="314">Knock on the</text><text x="26" y="333">orange door!</text></g>
</g>`;
