// Generates the logo exploration sheet (index.html) and standalone SVG marks.
// Run: node build-sheet.mjs            -> writes index.html + svg/ next to this file
//      node build-sheet.mjs --set river -> writes river-country.html + svg/river-country/
//      node build-sheet.mjs --out DIR [--only A]   -> preview build elsewhere
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const outDir = argVal('--out') ?? here;
const only = argVal('--only');

const P = {
  blue: '#002A86', gold: '#FFEA0F', forest: '#285D45', deep: '#193F36',
  paper: '#F5F2E9', white: '#FFFEF8', ink: '#172E49', sky: '#4B82AA',
};

// Right-facing trout used by A, B and C (viewBox 0 0 120 120).
const FISH = 'M111 60.5C106 52.5 97 47.5 86 46C74 44.5 62 44.5 51 48C43 50 37 53 31 56L9 44C12 51 15 56 15 60C15 64 12 69 9 76L31 64C37 68 44 72 54 74.5C68 77.5 82 76.5 94 72C102 69 108.5 65.5 111 60.5Z';
const FINS = 'M79 47.5C77 45.5 75.5 43 74 40.5C71 37.5 68 36 64 35.5C60 37.5 57 41 54 47.5ZM60 74L55 84L68 75.5ZM40 68.5L36 76L47 72Z';
const FISH_ALL = `${FISH}${FINS}`;
// Variant with a triangular dorsal fin so it can read as a mountain summit (C).
const FISH_PEAK = `${FISH}M77 47.5L65 31.5L53 47.5ZM60 74L55 84L68 75.5ZM40 68.5L36 76L47 72Z`;

// Approximate Oregon outline (lon/lat projected, 0-100 wide), used by D.
const OREGON = 'M7.6 1.7L20 3.4L22.3 11.1L41.8 12L53.9 9.9L65 6.5L69 5.1L94.4 5.1L96.8 8.6L99.3 17.2L96.8 25.7L93.1 32.6L93 39.4L93 73.7L0 73.7L0.1 59.3L3.3 50L5.7 39.4L6.2 28.6L7.4 13.7Z';

let uidN = 0;
const nextId = () => `g${++uidN}`;
const f1 = (n) => n.toFixed(1);

const concepts = [
  {
    id: 'A', slug: 'lateral-line', name: 'Lateral Line',
    idea: 'A trout whose lateral line is the river’s flow chart, ending at the eye as the “now” reading.',
    why: 'A fish’s lateral line is the organ that senses current, so the mark says “measured water” without looking like a chart widget. It is unmistakably fishing, and it matches the brief’s data-first, no-hype stance.',
    watch: 'The line and eye-dot detail drops out below about 28 px, so small sizes use a plain fish with an eye. The silhouette is still a generic fish rather than recognizably a trout.',
    roles: {
      paper: { fg: P.blue, acc: P.gold },
      blue: { fg: P.gold, acc: P.blue },
      monoPaper: { fg: P.ink, acc: P.paper },
      monoBlue: { fg: P.white, acc: P.blue },
    },
    draw(r, o) {
      if (o.small) {
        return `<path d="${FISH_ALL}" fill="${r.fg}"/><circle cx="96" cy="57" r="5" fill="${r.acc}"/>`;
      }
      return `<path d="${FISH_ALL}" fill="${r.fg}"/>
<polyline points="26,60 33,60 39,58.5 45,61 51,57 57,53.5 63,57.5 69,59.5 77,58 85,57 96,57" fill="none" stroke="${r.acc}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="96" cy="57" r="3.8" fill="${r.acc}"/>`;
    },
  },
  {
    id: 'B', slug: 'first-light', name: 'First Light',
    idea: 'A gold sunrise disc with a daylight arc of hour ticks, and a trout leaping out of the water toward it.',
    why: 'It speaks to “When to go” and makes the flag gold the hero. The tick arc reads as daylight hours or a river-gauge dial, and the round badge works as a header mark, favicon and social avatar with no extra framing.',
    watch: 'A fish leaping at the sun is a familiar trope. The ticks and wave lines drop out at 32 px and below, leaving a gold disc with a dark fish.',
    roles: {
      paper: { disc: P.gold, detail: P.blue, ring: P.blue },
      blue: { disc: P.gold, detail: P.blue, ring: null },
      monoPaper: { disc: P.ink, detail: P.paper, ring: null },
      monoBlue: { disc: P.white, detail: P.blue, ring: null },
    },
    draw(r, o) {
      const id = nextId();
      const ticks = [];
      if (!o.small) {
        for (let i = 0; i <= 12; i++) {
          const a = Math.PI + (i * Math.PI) / 12;
          const long = i % 3 === 0;
          const r1 = long ? 43 : 46.5;
          const r2 = 51.5;
          ticks.push(`<line x1="${f1(60 + r1 * Math.cos(a))}" y1="${f1(60 + r1 * Math.sin(a))}" x2="${f1(60 + r2 * Math.cos(a))}" y2="${f1(60 + r2 * Math.sin(a))}" stroke="${r.detail}" stroke-width="${long ? 3.2 : 2.2}" stroke-linecap="round"/>`);
        }
      }
      return `<defs><clipPath id="${id}"><circle cx="60" cy="60" r="56"/></clipPath></defs>
<circle cx="60" cy="60" r="56" fill="${r.disc}"/>
<g clip-path="url(#${id})">
<path d="M0 86C15 80 28 91 44 86S74 80 90 86S110 90 120 86V120H0Z" fill="${r.detail}"/>
${o.small ? '' : `<path d="M30 99q8-4 16 0t16 0t16 0M44 109q6-3 12 0t12 0" fill="none" stroke="${r.disc}" stroke-width="2.4" stroke-linecap="round"/>`}
</g>
${ticks.join('\n')}
<g transform="translate(60 52) rotate(-32) scale(.66) translate(-60 -60)">
<path d="${FISH_ALL}" fill="${r.detail}"/>
<circle cx="96" cy="57" r="3.6" fill="${r.disc}"/>
</g>
${r.ring ? `<circle cx="60" cy="60" r="54.5" fill="none" stroke="${r.ring}" stroke-width="3"/>` : ''}`;
    },
  },
  {
    id: 'C', slug: 'river-country', name: 'River Country',
    idea: 'A trout filled with the landscape: the sun as its eye, a snow peak, forest, and a winding river.',
    why: 'It carries the hero illustration into the logo and leads with place, which is the “Where to fish” half of the message.',
    watch: 'The most detail of any option and the most dependent on color. It is weakest in one color and at small sizes.',
    roles: {
      paper: { sky: P.blue, sun: P.gold, peak: P.white, forest: P.forest, river: P.sky, ring: P.blue },
      blue: { sky: P.blue, sun: P.gold, peak: P.white, forest: P.forest, river: P.sky, ring: P.white },
      monoPaper: { sky: P.ink, sun: P.paper, peak: P.paper, forest: P.ink, river: P.paper, ring: P.ink },
      monoBlue: { sky: P.white, sun: P.blue, peak: P.blue, forest: P.white, river: P.blue, ring: P.white },
    },
    draw(r, o) {
      const id = nextId();
      return `<defs><clipPath id="${id}"><path d="${FISH_PEAK}"/></clipPath></defs>
${r.ring ? `<path d="${FISH_PEAK}" fill="${r.ring}" stroke="${r.ring}" stroke-width="7" stroke-linejoin="round"/>` : ''}
<g clip-path="url(#${id})">
<rect x="0" y="0" width="120" height="120" fill="${r.sky}"/>
<path d="M33 64L65 30.5L97 64Z" fill="${r.peak}"/>
<path d="M-5 63C16 58 36 65 58 63S98 60 125 65V125H-5Z" fill="${r.forest}"/>
${o.small ? '' : `<path d="M62.5 63L67.5 63C69.5 69 60.5 72 64.5 77C66.5 80 72 83 76 87L48 87C55 83 58 80 56 76C54 71 61 69 62.5 63Z" fill="${r.river}"/>`}
<circle cx="96" cy="57" r="5.2" fill="${r.sun}"/>
</g>`;
    },
  },
  {
    id: 'D', slug: 'state-line', name: 'State Line',
    idea: 'The Oregon silhouette with the Deschutes drawn in gold and a gauge dot at Madras, the first station in the brief.',
    why: 'Unmistakably Oregon, with room to grow statewide. The dot marks the real USGS Madras gauge, so the mark carries the “measured” story too.',
    watch: 'There is no fish in the mark, so the wordmark must do that work. A whole-state shape also implies statewide coverage while the pilot is Central Oregon only. The outline is a simplified approximation.',
    roles: {
      paper: { land: P.blue, river: P.gold },
      blue: { land: P.gold, river: P.blue },
      monoPaper: { land: P.ink, river: P.paper },
      monoBlue: { land: P.white, river: P.blue },
    },
    draw(r) {
      return `<g transform="translate(5 19.5) scale(1.1)">
<path d="${OREGON}" fill="${r.land}" stroke="${r.land}" stroke-width="3" stroke-linejoin="round"/>
<path d="M34.4 46C38.5 42.5 41 40.5 40.6 35.5S42.4 29 41.8 24.5S44.2 18 45.1 11.6" fill="none" stroke="${r.river}" stroke-width="3.4" stroke-linecap="round"/>
<circle cx="41.9" cy="28.6" r="6.6" fill="${r.land}" stroke="${r.river}" stroke-width="2.2"/>
<circle cx="41.9" cy="28.6" r="2.9" fill="${r.river}"/>
</g>`;
    },
  },
  {
    id: 'E', slug: 'the-float', name: 'The Float',
    idea: 'A fishing float sitting on the waterline: gold above the surface, a muted half below it.',
    why: 'The simplest and most ownable option. It avoids the fish cliché, reads as “watching the water,” and holds up at favicon size.',
    watch: 'It does not say Oregon. Floats suggest bait and kids’ fishing, while the pilot waters are mostly fly and trout water.',
    roles: {
      paper: { fg: P.blue, acc: P.gold },
      blue: { fg: P.white, acc: P.gold },
      monoPaper: { fg: P.ink, acc: 'none' },
      monoBlue: { fg: P.white, acc: 'none' },
    },
    draw(r, o) {
      const id = nextId();
      const wave = 'M6 64q9-6 18 0t18 0t18 0t18 0t18 0t18 0';
      return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120"><rect width="120" height="120" fill="#fff"/><path d="${wave}" fill="none" stroke="#000" stroke-width="11" stroke-linecap="round"/></mask></defs>
<g mask="url(#${id})">
<line x1="60" y1="12" x2="60" y2="38" stroke="${r.fg}" stroke-width="6" stroke-linecap="round"/>
<path d="M33 64A27 27 0 0 1 87 64Z" fill="${r.acc}"/>
<path d="M33 64A27 27 0 0 0 87 64Z" fill="${r.fg}" opacity=".5"/>
<path d="M33 64A27 27 0 0 1 87 64" fill="none" stroke="${r.fg}" stroke-width="4.6" stroke-linecap="round"/>
<path d="M33 64A27 27 0 0 0 87 64" fill="none" stroke="${r.fg}" stroke-width="4.6" stroke-linecap="round" opacity=".5"/>
</g>
<path d="${wave}" fill="none" stroke="${r.fg}" stroke-width="4.6" stroke-linecap="round"/>
${o.small ? '' : `<path d="M30 92q9-5 18 0t18 0t18 0M42 104q9-5 18 0t18 0" fill="none" stroke="${r.fg}" stroke-width="3.6" stroke-linecap="round" opacity=".75"/>`}`;
    },
  },
  {
    id: 'F', slug: 'type-first', name: 'Type-First',
    idea: 'A heavy wordmark whose river-line underline forks like a tail, plus an F with swallowtail arms for icons.',
    why: 'The cheapest to maintain and closest to the site’s bold DM Sans look. The notched arms also read as a weather pennant, which suits a forecast.',
    watch: 'Least memorable on its own. Do not use an “OFF” monogram: it reads as switched off.',
    roles: {
      paper: { tile: P.blue, glyph: P.gold },
      blue: { tile: P.gold, glyph: P.blue },
      monoPaper: { tile: P.ink, glyph: P.paper },
      monoBlue: { tile: P.white, glyph: P.blue },
    },
    draw(r) {
      return `<rect x="6" y="6" width="108" height="108" rx="26" fill="${r.tile}"/>
<path d="M38 28H90L82 38L90 48H52V60H78L71 66L78 72H52V94H38Z" fill="${r.glyph}"/>`;
    },
  },
];

// ---- River Country variations (--set river) ----
const SAND = '#D9AC4B', CLAY = '#AD8743', SHADE = '#C9D6E3';
const RIVER_RIBBON = 'M62.5 63L67.5 63C69.5 69 60.5 72 64.5 77C66.5 80 72 83 76 87L48 87C55 83 58 80 56 76C54 71 61 69 62.5 63Z';

// Fill roles shared by every variant; monoMap(fg, bg) assigns each role to ink or paper.
const sceneRoles = (full, monoMap) => ({
  paper: { ...full, ring: P.blue },
  blue: { ...full, ring: P.white },
  monoPaper: { ...monoMap(P.ink, P.paper), ring: P.ink, mono: true },
  monoBlue: { ...monoMap(P.white, P.blue), ring: P.white, mono: true },
});

function clippedScene(r, clipD, inner) {
  const id = nextId();
  return `<defs><clipPath id="${id}"><path d="${clipD}"/></clipPath></defs>
${r.ring ? `<path d="${clipD}" fill="${r.ring}" stroke="${r.ring}" stroke-width="7" stroke-linejoin="round"/>` : ''}
<g clip-path="url(#${id})"><rect x="0" y="0" width="120" height="120" fill="${r.sky}"/>${inner}</g>`;
}

const fir = (x, base, h) =>
  `M${x} ${base - h}L${f1(x - h * 0.3)} ${f1(base - h * 0.45)}H${f1(x - h * 0.15)}L${f1(x - h * 0.4)} ${base}H${f1(x + h * 0.4)}L${f1(x + h * 0.15)} ${f1(base - h * 0.45)}H${f1(x + h * 0.3)}Z`;

const riverConcepts = [
  {
    id: 'C1', slug: 'original', name: 'Original',
    idea: 'The version you picked: one snow peak in the dorsal fin, forest, a winding river, and the sun as the eye.',
    why: 'Simple enough to read at header size, and every element maps to the hero illustration.',
    watch: 'The forest band is a flat stripe, so the lower half carries little character.',
    roles: concepts.find((c) => c.id === 'C').roles,
    draw: (r, o) => concepts.find((c) => c.id === 'C').draw(r, o),
  },
  {
    id: 'C2', slug: 'timberline', name: 'Timberline',
    idea: 'Adds a fir treeline along the ridge, picking up the evergreens in the hero art.',
    why: 'More unmistakably Pacific Northwest. The trees break up the flat forest band and give the silhouette a toothed, hand-made edge.',
    watch: 'The trees are fine detail. They drop out at 32 px and below, and in one color they merge into the sky.',
    roles: sceneRoles(
      { sky: P.blue, sun: P.gold, peak: P.white, forest: P.forest, tree: P.deep, river: P.sky },
      (fg, bg) => ({ sky: fg, sun: bg, peak: bg, forest: fg, tree: fg, river: bg }),
    ),
    draw(r, o) {
      const trees = o.small ? '' : `<path d="${[fir(21, 65, 12), fir(28, 65, 15), fir(35, 64, 11), fir(43, 64, 13), fir(80, 64, 13), fir(86, 65, 10)].join('')}" fill="${r.tree}"/>`;
      return clippedScene(r, FISH_PEAK, `<path d="M38 64L65 30.5L92 64Z" fill="${r.peak}"/>
<path d="M-5 63C16 58 36 65 58 63S98 60 125 65V125H-5Z" fill="${r.forest}"/>
${trees}
${o.small ? '' : `<path d="${RIVER_RIBBON}" fill="${r.river}"/>`}
<circle cx="96" cy="57" r="5.2" fill="${r.sun}"/>`);
    },
  },
  {
    id: 'C3', slug: 'three-sisters', name: 'Three Sisters',
    idea: 'Three shaded peaks, a nod to the Three Sisters that frame the Central Oregon pilot waters.',
    why: 'The three peaks give the alpine direction a Central Oregon reference. Shaded faces separate the summits and add depth.',
    watch: 'It is a stylized skyline, not an accurate profile, and locals will judge the resemblance. Shading disappears in one color.',
    roles: sceneRoles(
      { sky: P.blue, sun: P.gold, peak: P.white, shade: SHADE, forest: P.forest, river: P.sky },
      (fg, bg) => ({ sky: fg, sun: bg, peak: bg, shade: bg, forest: fg, river: bg }),
    ),
    draw(r, o) {
      return clippedScene(r, FISH_PEAK, `<path d="M28 64L45 53L54 59L65 30.5L76 56L84 50L102 64Z" fill="${r.peak}"/>
<path d="M45 53L55 64H45ZM65 30.5L79 64H65ZM84 50L94 64H84Z" fill="${r.shade}"/>
<path d="M-5 63C16 59 36 65 58 63S98 60 125 65V125H-5Z" fill="${r.forest}"/>
${o.small ? '' : `<path d="${RIVER_RIBBON}" fill="${r.river}"/>`}
<circle cx="96" cy="57" r="5.2" fill="${r.sun}"/>`);
    },
  },
  {
    id: 'C4', slug: 'canyon-country', name: 'Canyon Country',
    idea: 'Rimrock canyon walls in sand and ochre with the river cutting through: the Lower Deschutes, the first water on the site.',
    why: 'It matches the landscape of the first page you are building and the gold canyon in the hero art. It is the most distinct from generic mountain-lake fishing logos.',
    watch: 'The sand tones sit close to the gold eye, so it needs the most color care in print and merch.',
    roles: sceneRoles(
      { sky: P.blue, sun: P.gold, peak: P.white, rim: SAND, wall: CLAY, river: P.blue },
      (fg, bg) => ({ sky: fg, sun: bg, peak: bg, rim: bg, wall: fg, river: bg }),
    ),
    draw(r, o) {
      return clippedScene(r, FISH_PEAK, `<path d="M50 60L65 30.5L80 60Z" fill="${r.peak}"/>
<path d="M-5 61H24L30 56H46L50 62H82L86 63H125V125H-5Z" fill="${r.rim}"/>
<path d="M-5 70C20 67 34 71 52 69S96 66 125 70V125H-5Z" fill="${r.wall}"/>
${o.small ? '' : `<path d="M60 62H66C68 67 58 70 63 75C66 78 73 82 77 87H48C55 82 57 78 55 74C53 69 59 67 60 62Z" fill="${r.river}"/>
<path d="M8 66H22M34 65H44M84 67H100" stroke="${r.wall}" stroke-width="1.6" stroke-linecap="round" opacity="${r.mono ? 1 : .8}"/>`}
<circle cx="96" cy="56" r="5.2" fill="${r.sun}"/>`);
    },
  },
  {
    id: 'C5', slug: 'still-water', name: 'Still Water',
    idea: 'The peak and sun reflected in calm water across the lower body, broken by ripple lines.',
    why: 'It says “read the water,” which is the whole product. The ripple lines echo a river surface and the site’s “Know the water” tagline.',
    watch: 'The full-color reflection uses transparency; one-color versions use solid ripple bands. The small version omits the fine ripples.',
    roles: sceneRoles(
      { sky: P.blue, sun: P.gold, peak: P.white, water: P.sky },
      (fg, bg) => ({ sky: fg, sun: bg, peak: bg, water: fg }),
    ),
    draw(r, o) {
      return clippedScene(r, FISH_PEAK, `<path d="M36 63L65 30.5L94 63Z" fill="${r.peak}"/>
<path d="M-5 63H125V125H-5Z" fill="${r.water}"/>
<path d="M36 63L65 88L94 63Z" fill="${r.peak}" opacity="${r.mono ? 1 : .5}"/>
${o.small ? '' : `<path d="M20 67.5H104M26 72.5H100M34 77.5H94" stroke="${r.water}" stroke-width="2" stroke-linecap="round"/>
<path d="M92 66H100M94 70H99" stroke="${r.sun}" stroke-width="2" stroke-linecap="round" opacity="${r.mono ? 1 : .85}"/>`}
<path d="M-5 63H125" stroke="${r.peak}" stroke-width="1" opacity="${r.mono ? 1 : .6}"/>
<circle cx="96" cy="56.5" r="5.2" fill="${r.sun}"/>`);
    },
  },
  {
    id: 'C6', slug: 'sunrise-bands', name: 'Sunrise Bands',
    idea: 'A big striped sun rising behind the peak, the classic outdoor-patch look, with a white eye.',
    why: 'The warmest and most nostalgic of the set, and the strongest for stickers, hats and social posts. The gold sun carries the Oregon flag color.',
    watch: 'The outdoor-patch styling is less specific to this product. Small versions omit the stripes, leaving a solid gold sun behind the peak.',
    roles: sceneRoles(
      { sky: P.blue, sun: P.gold, peak: P.white, forest: P.forest, river: P.sky, eye: P.white, pupil: P.blue },
      (fg, bg) => ({ sky: fg, sun: bg, peak: bg, forest: fg, river: bg, eye: bg, pupil: fg }),
    ),
    draw(r, o) {
      const stripes = o.small ? '' : `<path d="M54 50.5H94" stroke="${r.sky}" stroke-width="1.2"/><path d="M54 54.5H94" stroke="${r.sky}" stroke-width="1.8"/><path d="M54 58.8H94" stroke="${r.sky}" stroke-width="2.4"/>`;
      return clippedScene(r, FISH_PEAK, `<circle cx="74" cy="60" r="18" fill="${r.sun}"/>
${stripes}
<path d="M48 64L65 30.5L80 64Z" fill="${r.peak}"/>
<path d="M-5 63C16 59 36 65 58 63S98 60 125 65V125H-5Z" fill="${r.forest}"/>
${o.small ? '' : `<path d="${RIVER_RIBBON}" fill="${r.river}"/>`}
<circle cx="97" cy="56.5" r="4" fill="${r.eye}"/><circle cx="98" cy="56.5" r="1.7" fill="${r.pupil}"/>`);
    },
  },
  {
    id: 'C7', slug: 'trailhead-badge', name: 'Trailhead Badge',
    idea: 'The same landscape in a round badge, with a gold trout leaping from the river.',
    why: 'It keeps the River Country scene but gains a circle, so it drops straight into avatars, the favicon and the existing round header mark.',
    watch: 'The full badge reads as landscape first. The small icon enlarges the trout and omits the trees and river; at 16 px, the fish is still only a silhouette.',
    roles: sceneRoles(
      { sky: P.blue, sun: P.gold, peak: P.white, forest: P.forest, tree: P.deep, river: P.sky, fish: P.gold },
      (fg, bg) => ({ sky: fg, sun: bg, peak: bg, forest: fg, tree: fg, river: bg, fish: bg }),
    ),
    draw(r, o) {
      const id = nextId();
      const trees = o.small ? '' : `<path d="${[fir(16, 72, 14), fir(24, 71, 18), fir(32, 70, 12), fir(92, 70, 14), fir(100, 71, 18), fir(108, 72, 12)].join('')}" fill="${r.tree}"/>`;
      const fish = `<g transform="translate(${o.small ? '54 87' : '40 86'}) rotate(-28) scale(${o.small ? .62 : .34}) translate(-60 -60)"><path d="${FISH_ALL}" fill="${r.fish}" stroke="${r.forest}" stroke-width="${r.mono ? 5 : 0}" stroke-linejoin="round" paint-order="stroke"/>${o.small ? '' : `<circle cx="96" cy="57" r="4" fill="${r.forest}"/>`}</g>`;
      return `<defs><clipPath id="${id}"><circle cx="60" cy="60" r="54"/></clipPath></defs>
<circle cx="60" cy="60" r="56.5" fill="${r.ring}"/>
<g clip-path="url(#${id})">
<rect x="0" y="0" width="120" height="120" fill="${r.sky}"/>
<circle cx="86" cy="38" r="10" fill="${r.sun}"/>
<path d="M4 74L36 44L48 55L62 30L90 64L100 58L124 76V120H4Z" fill="${r.peak}"/>
<path d="M-5 70C20 64 40 72 62 68S100 64 125 70V125H-5Z" fill="${r.forest}"/>
${trees}
${o.small ? '' : `<path d="M58 68H64C67 76 54 82 62 90C67 96 76 104 84 124H36C46 106 50 96 46 88C42 80 56 77 58 68Z" fill="${r.river}"/>`}
${fish}
</g>`;
    },
  },
];

const set = argVal('--set');
const activeConcepts = set === 'river' ? riverConcepts : concepts;
const byId = Object.fromEntries(activeConcepts.map((c) => [c.id, c]));

const svgWrap = (inner, size, label, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${label}"${extra}>${inner}</svg>`;

function mark(c, ctx, size = 120, small = false) {
  return svgWrap(c.draw(c.roles[ctx], { small }), size, `${c.name} logo mark`);
}

// Rounded-square icon tile (the favicon / app-icon treatment).
function iconTile(c, size = 64, small = size <= 40) {
  if (c.id === 'F') return mark(c, 'paper', size, true);
  if (c.id === 'C7') return mark(c, 'paper', size, small);
  const inner = `<rect x="2" y="2" width="116" height="116" rx="28" fill="${P.blue}"/>
<g transform="translate(60 60) scale(.74) translate(-60 -60)">${c.draw(c.roles.blue, { small })}</g>`;
  return svgWrap(inner, size, `${c.name} icon tile`);
}

const currentMark = (color) =>
  `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M8 34C21 15 39 20 47 30l9-8v23l-9-9C33 50 18 45 8 34Z" stroke="${color}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="20" cy="31" r="1.8" fill="${color}"/><path d="m28 24 6-9 6 11M28 42l6 8 6-9" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;

function lockup(c, on) {
  if (c.id === 'F') {
    const tail = `<svg class="tail" viewBox="0 0 320 30" fill="none" aria-hidden="true" preserveAspectRatio="xMinYMid meet"><path d="M3 16C22 4 40 28 60 16S98 4 118 16S156 28 176 16S214 4 234 16S258 22 272 16" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="M268 16L312 2C304 10 304 22 312 30Z" fill="currentColor"/></svg>`;
    return `<div class="lockup wm lock-${on}"><span class="wm-text">Oregon <em>Fish</em> Forecast</span>${tail}</div>`;
  }
  const ctx = on === 'blue' ? 'blue' : 'paper';
  return `<div class="lockup lock-${on}"><span class="lm">${mark(c, ctx, 52, false)}</span><span class="lt"><b>OREGON</b><i>FISH FORECAST</i></span></div>`;
}

const sizeLadder = (c, ctx) => [16, 24, 32, 48]
  .map((s) => `<span class="sz">${mark(c, ctx, s, s <= 32)}<small>${s}</small></span>`).join('');

function colorways(c) {
  const cell = (ctx, bgClass, cap) => `<figure class="cw ${bgClass}">${mark(c, ctx, 76)}<figcaption>${cap}</figcaption></figure>`;
  return `${cell('paper', 'on-paper', 'Full color')}${cell('blue', 'on-blue', 'Reversed')}${cell('monoPaper', 'on-paper', 'One color')}${cell('monoBlue', 'on-blue', 'One color, reversed')}`;
}

function section(c) {
  return `<section class="concept" id="concept-${c.id}">
  <header class="c-head"><span class="c-id">${c.id}</span><div><h2>${c.name}</h2><p>${c.idea}</p></div></header>
  <div class="c-grid">
    <figure class="stage on-paper">${mark(c, 'paper', 260)}</figure>
    <figure class="stage on-blue">${mark(c, 'blue', 260)}</figure>
    <div class="notes"><h3>Why it fits</h3><p>${c.why}</p><h3>Watch-outs</h3><p>${c.watch}</p></div>
  </div>
  <div class="c-lockups">${lockup(c, 'blue')}${lockup(c, 'paper')}</div>
  <div class="c-tests">
    <div class="cws">${colorways(c)}</div>
    <div class="ladder on-paper"><h4>Small sizes</h4><div>${sizeLadder(c, 'paper')}</div></div>
    <div class="ladder on-blue"><h4>Small sizes, reversed</h4><div>${sizeLadder(c, 'blue')}</div></div>
    <div class="tile"><h4>${c.id === 'C7' ? 'Badge icon' : 'Favicon tile'}</h4><div>${iconTile(c, 72)}${iconTile(c, 32)}${iconTile(c, 16)}</div></div>
  </div>
</section>`;
}

function overview() {
  const cells = activeConcepts.map((c) => `<a class="ov" href="#concept-${c.id}"><span class="ov-art on-paper">${mark(c, 'paper', 84)}</span><span class="ov-art on-blue">${mark(c, 'blue', 84)}</span><span class="ov-name"><b>${c.id}</b> ${c.name}</span></a>`).join('');
  const cur = `<div class="ov current"><span class="ov-art on-paper"><span class="cur" style="color:${P.blue}">${currentMark(P.blue)}</span></span><span class="ov-art on-blue"><span class="cur" style="color:${P.gold}">${currentMark(P.gold)}</span></span><span class="ov-name"><b>—</b> Current mark (for reference)</span></div>`;
  return `<div class="overview">${cur}${cells}</div>`;
}

const CSS = `
:root{--blue:${P.blue};--gold:${P.gold};--forest:${P.forest};--paper:${P.paper};--white:${P.white};--ink:${P.ink};--muted:#596975;--line:#d5dcda}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 'DM Sans',Arial,sans-serif}
.wrap{width:min(1180px,calc(100% - 40px));margin-inline:auto}
.top{background:var(--blue);color:var(--white);padding:56px 0 52px;border-radius:0 0 28px 28px;margin:0 12px}
.top .eyebrow{color:#fff8bc;font-size:12px;letter-spacing:.2em;text-transform:uppercase;font-weight:600}
h1{font-size:clamp(34px,5.4vw,60px);letter-spacing:-.05em;line-height:1.03;margin:14px 0 16px;font-weight:700}
h1 em{font-style:normal;color:var(--gold)}
.top p{max-width:62ch;color:#e1e9f7;margin:0 0 10px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.chip{display:inline-flex;align-items:center;gap:8px;background:#ffffff14;border:1px solid #ffffff2e;border-radius:999px;padding:6px 14px 6px 8px;font-size:12px;color:#e1e9f7}
.chip i{width:16px;height:16px;border-radius:50%;display:block;border:1px solid #ffffff55}
h2{font-size:clamp(26px,3.4vw,38px);letter-spacing:-.04em;line-height:1.1;margin:0;color:var(--blue)}
h3{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--forest);margin:0 0 6px}
h4{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 10px;font-weight:600}
.overview-sec{padding:44px 0 8px}
.overview-sec h2{margin-bottom:6px}
.overview-sec>.wrap>p{color:var(--muted);margin:0 0 22px;max-width:62ch}
.overview{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.ov{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;border:1px solid var(--line);border-radius:16px;overflow:hidden;text-decoration:none;color:var(--ink);background:var(--white)}
.ov:hover{border-color:var(--blue)}
.ov-art{display:grid;place-items:center;padding:14px 8px}
.ov-art svg{width:60px;height:60px}
.ov-name{grid-column:1/-1;padding:10px 14px;font-size:14px;font-weight:600;color:var(--blue);border-top:1px solid var(--line)}
.ov-name b{color:var(--forest);margin-right:4px}
.ov.current .ov-name{color:var(--muted);font-weight:500}
.cur svg{width:50px;height:50px;display:block}
.on-paper{background:var(--white)}
.on-blue{background:var(--blue)}
.concept{padding:60px 0 12px;border-top:1px solid var(--line);margin-top:48px}
.c-head{display:flex;gap:18px;align-items:flex-start;margin-bottom:22px}
.c-id{flex:none;width:46px;height:46px;border-radius:50%;background:var(--blue);color:var(--gold);display:grid;place-items:center;font-weight:700;font-size:20px}
.c-head p{margin:6px 0 0;font-size:18px;max-width:64ch;color:#2a3f57}
.c-grid{display:grid;grid-template-columns:300px 300px 1fr;gap:16px;align-items:stretch}
.stage{margin:0;border-radius:20px;display:grid;place-items:center;min-height:300px;border:1px solid var(--line)}
.stage.on-blue{border-color:var(--blue)}
.stage svg{max-width:100%;height:auto}
.notes{background:#e6eddf;border:1px solid #cdd9c4;border-radius:20px;padding:24px 26px}
.notes p{margin:0 0 18px;font-size:15px}
.notes p:last-child{margin-bottom:0}
.c-lockups{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
.lockup{border-radius:20px;padding:30px 34px;display:flex;align-items:center;gap:14px;min-height:118px;border:1px solid var(--line)}
.lock-blue{background:var(--blue);color:var(--white);border-color:var(--blue)}
.lock-paper{background:var(--white);color:var(--blue)}
.lm svg{display:block}
.lt{display:block;line-height:1}
.lt b{display:block;font-size:22px;letter-spacing:.17em;font-weight:700}
.lt i{display:block;font-style:normal;font-size:9.5px;letter-spacing:.34em;margin-top:7px;font-weight:600}
.lock-blue .lt i{color:var(--gold)}
.lock-paper .lt i{color:var(--forest)}
.lockup.wm{flex-direction:column;align-items:flex-start;justify-content:center;gap:8px}
.wm-text{font-size:clamp(26px,3.3vw,40px);font-weight:800;letter-spacing:-.05em;line-height:1}
.lock-blue .wm-text em{color:var(--gold);font-style:normal}
.lock-paper .wm-text em{color:var(--forest);font-style:normal}
.lock-blue .tail{color:var(--gold)}.lock-paper .tail{color:var(--blue)}
.tail{width:min(300px,70%);height:auto;display:block}
.c-tests{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr) minmax(0,1fr) minmax(0,.9fr);gap:16px;margin-top:16px;align-items:stretch}
.cws{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.cw{margin:0;border:1px solid var(--line);border-radius:16px;display:grid;justify-items:center;gap:8px;padding:14px 6px 10px}
.cw.on-blue{border-color:var(--blue)}
.cw figcaption{font-size:10px;text-align:center;color:var(--muted);line-height:1.25}
.cw.on-blue figcaption{color:#d5e1f5}
.ladder,.tile{border-radius:16px;padding:16px 18px;border:1px solid var(--line)}
.ladder.on-blue{border-color:var(--blue)}
.ladder.on-blue h4{color:#d5e1f5}
.ladder>div,.tile>div{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap}
.tile{background:var(--white)}
.sz{display:grid;justify-items:center;gap:6px}
.sz small{font-size:10px;color:var(--muted)}
.ladder.on-blue .sz small{color:#d5e1f5}
.verdict{margin:70px 0 80px;background:var(--forest);color:var(--white);border-radius:24px;padding:44px 48px}
.verdict h2{color:var(--white)}
.verdict h2 em{font-style:normal;color:var(--gold)}
.verdict p{max-width:68ch;margin:12px 0 0;color:#e3ebdc}
.verdict ul{margin:14px 0 0;padding-left:20px;max-width:68ch;color:#e3ebdc}
.verdict li{margin:4px 0}
footer.note{padding:0 0 60px;color:var(--muted);font-size:13px}
@media (max-width:1020px){.c-grid{grid-template-columns:1fr 1fr}.notes{grid-column:1/-1}.c-tests{grid-template-columns:1fr 1fr}.cws{grid-column:1/-1}}
@media (max-width:640px){.c-grid,.c-lockups,.c-tests{grid-template-columns:1fr}.cws{grid-template-columns:repeat(2,1fr)}.stage{min-height:0;padding:20px}.stage svg{width:220px}.verdict{padding:30px 24px}.lockup{padding:22px}}
`;

const palette = [['Oregon blue', P.blue], ['Oregon gold', P.gold], ['Forest', P.forest], ['Paper', P.paper], ['Ink', P.ink]]
  .map(([n, h]) => `<span class="chip"><i style="background:${h}"></i>${n} ${h}</span>`).join('');

const verdict = `<section class="verdict"><h2>Starting point: <em>B, First Light</em></h2>
<p>It is the most finished at every size, and the only option that works as the header mark, the favicon and a round social avatar without extra framing. The brief plans social reports, so the avatar matters. Its gold disc echoes the sun in the hero illustration and the gold already used in the header, and the tick arc reads as both daylight hours and a gauge dial, which covers “When to go” and the measured-data story together.</p>
<ul>
<li><b>Next refinement:</b> borrow A’s idea by drawing the water surface as a flow trace instead of wave lines, so the data story lives inside the badge.</li>
<li><b>Before adopting:</b> convert the lockup text to outlines, confirm the fish silhouette reads as a trout at 16 px on a real device, and swap the site favicon.</li>
<li><b>Runner-up:</b> A (Lateral Line) has the best concept but needs a tile to work as an avatar. E (The Float) is the simplest and most distinctive if you would rather avoid fish.</li>
</ul></section>`;

function page(body, title) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>${body}</body></html>
`;
}

const riverVerdict = `<section class="verdict"><h2>After rendering: <em>C4, Canyon Country</em></h2>
<p>C4 remains the strongest starting point. The warm canyon bands and blue river make it distinct within this set, and both the paper and reversed versions retain the chosen trout outline. The canyon scene also fits the Lower Deschutes launch brief.</p>
<ul>
<li><b>Alpine alternative:</b> C3 adds depth through three shaded peaks. C1 remains the original reference.</li>
<li><b>Round companion:</b> C7 fills an avatar better. Its small version keeps a larger trout and removes fine landscape detail.</li>
<li><b>Small-size limit:</b> at 16 px the fish-shaped marks read as silhouettes and color bands. Use the simplified icon export; the full landscape needs more room.</li>
<li><b>Before adopting:</b> test a physical print and convert lockup text to outlines. Monochrome previews assume the shown paper or blue background.</li>
</ul></section>`;

const intro = set === 'river'
  ? `<header class="top"><div class="wrap"><span class="eyebrow">Oregon Fish Forecast · Logo exploration, round 2</span>
<h1>Seven takes on <em>River Country</em></h1>
<p>C1–C6 keep the trout filled with Oregon landscape and its outline on paper or blue. C7 moves the scene into a round badge with a leaping trout. C1 is the version you picked, for reference. Each variation includes a large mark, header lockup, four colorways and a small-size test.</p>
<div class="chips">${palette}</div></div></header>
<section class="overview-sec"><div class="wrap"><h2>Side by side</h2><p>Click a card to jump to that variation. Left cell is on paper, right cell is on the header blue.</p>${overview()}</div></section>`
  : `<header class="top"><div class="wrap"><span class="eyebrow">Oregon Fish Forecast · Logo exploration</span>
<h1>Six directions for <em>the mark</em></h1>
<p>All original, all built on the site’s existing palette and DM Sans. Each concept is shown as a large mark, a header lockup, four colorways, and a small-size test. Nothing here is wired into the site yet.</p>
<p>The reference TikTok account’s branding is deliberately not echoed anywhere, per the build brief.</p>
<div class="chips">${palette}</div></div></header>
<section class="overview-sec"><div class="wrap"><h2>Side by side</h2><p>Click a card to jump to that concept. Left cell is on paper, right cell is on the header blue.</p>${overview()}</div></section>`;

mkdirSync(outDir, { recursive: true });

if (only) {
  const c = byId[only];
  writeFileSync(join(outDir, `preview-${only}.html`), page(`<div class="wrap">${section(c)}</div>`, `Preview ${only}`));
  writeFileSync(join(outDir, 'preview-overview.html'), page(intro, 'Preview overview'));
} else {
  const river = set === 'river';
  const note = river
    ? 'Generated by build-sheet.mjs --set river. Exports: 28 full-detail colorways and 7 simplified icon SVGs. Icon exports match the 16/32 px previews. Marks are hand-built SVG; lockup text is live DM Sans. Skylines are stylized, not survey-accurate.'
    : 'Generated by build-sheet.mjs. Marks are hand-built SVG; lockup text is live DM Sans and would be converted to outlines for production files. The Oregon outline in D is a simplified approximation.';
  const body = `${intro}<div class="wrap">${activeConcepts.map(section).join('\n')}${river ? riverVerdict : verdict}<footer class="note">${note}</footer></div>`;
  writeFileSync(join(outDir, river ? 'river-country.html' : 'index.html'), page(body, river ? 'River Country variations' : 'Oregon Fish Forecast logo exploration'));

  const svgDir = river ? join(outDir, 'svg', 'river-country') : join(outDir, 'svg');
  mkdirSync(svgDir, { recursive: true });
  const ctxNames = { paper: 'on-paper', blue: 'on-blue', monoPaper: 'mono-ink', monoBlue: 'mono-white' };
  for (const c of activeConcepts) {
    for (const [ctx, label] of Object.entries(ctxNames)) {
      writeFileSync(join(svgDir, `${c.id}-${c.slug}-${label}.svg`), `${mark(c, ctx, 512)}\n`);
    }
    writeFileSync(join(svgDir, `${c.id}-${c.slug}-icon-tile.svg`), `${iconTile(c, 512, river)}\n`);
  }
}
console.log('wrote to', outDir);
