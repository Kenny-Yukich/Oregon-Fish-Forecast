/**
 * Species catalog and per-water species lists. Comfort bands are angling rules of thumb for how
 * actively fish feed, expressed in °F for water temperature and as a percentage of the date's
 * median flow. They are tunable inputs to a transparent score, not biology.
 */
export type SpeciesId = 'redband-trout' | 'brown-trout' | 'brook-trout' | 'bull-trout' | 'summer-steelhead' | 'spring-chinook' | 'fall-chinook'
  | 'mountain-whitefish' | 'smallmouth-bass' | 'largemouth-bass' | 'kokanee' | 'black-crappie' | 'bluegill';

export interface Band { best: [number, number]; ok: [number, number] }
export interface Species {
  id: SpeciesId;
  name: string;
  /** Water temperature comfort, °F. Above `stress`, fishing pressures the fish and the score says so. */
  temperature: Band & { stress: number };
  /** Flow as a percentage of the median daily flow for the date. */
  flow: Band;
  /** How a 24-hour flow change is read: [steady, falling gently, falling fast, rising gently, rising fast], each 0–1. */
  trend: [number, number, number, number, number];
  /** Component weights; they sum to 1. */
  weights: { flow: number; temperature: number; trend: number };
}

const TROUT_TREND: Species['trend'] = [1, 0.9, 0.6, 0.6, 0.3];
const ANADROMOUS_TREND: Species['trend'] = [1, 0.9, 0.7, 0.85, 0.6];
const WARMWATER_TREND: Species['trend'] = [1, 0.9, 0.7, 0.7, 0.4];
const DEFAULT_WEIGHTS = { flow: 0.45, temperature: 0.35, trend: 0.2 };

export const SPECIES: Record<SpeciesId, Species> = {
  'redband-trout': { id: 'redband-trout', name: 'Redband rainbow trout', temperature: { best: [52, 60], ok: [44, 66], stress: 68 }, flow: { best: [75, 105], ok: [45, 150] }, trend: TROUT_TREND, weights: DEFAULT_WEIGHTS },
  'brown-trout': { id: 'brown-trout', name: 'Brown trout', temperature: { best: [54, 62], ok: [45, 68], stress: 70 }, flow: { best: [75, 110], ok: [45, 160] }, trend: TROUT_TREND, weights: DEFAULT_WEIGHTS },
  'brook-trout': { id: 'brook-trout', name: 'Brook trout', temperature: { best: [48, 60], ok: [42, 65], stress: 68 }, flow: { best: [70, 110], ok: [45, 150] }, trend: TROUT_TREND, weights: DEFAULT_WEIGHTS },
  'bull-trout': { id: 'bull-trout', name: 'Bull trout', temperature: { best: [40, 54], ok: [36, 58], stress: 62 }, flow: { best: [70, 120], ok: [45, 160] }, trend: TROUT_TREND, weights: DEFAULT_WEIGHTS },
  'summer-steelhead': { id: 'summer-steelhead', name: 'Summer steelhead', temperature: { best: [46, 56], ok: [40, 64], stress: 68 }, flow: { best: [85, 125], ok: [50, 180] }, trend: ANADROMOUS_TREND, weights: { flow: 0.45, temperature: 0.3, trend: 0.25 } },
  'spring-chinook': { id: 'spring-chinook', name: 'Spring Chinook', temperature: { best: [48, 58], ok: [42, 62], stress: 66 }, flow: { best: [80, 130], ok: [50, 180] }, trend: ANADROMOUS_TREND, weights: { flow: 0.45, temperature: 0.3, trend: 0.25 } },
  'fall-chinook': { id: 'fall-chinook', name: 'Fall Chinook', temperature: { best: [48, 60], ok: [42, 64], stress: 68 }, flow: { best: [80, 130], ok: [50, 180] }, trend: ANADROMOUS_TREND, weights: { flow: 0.45, temperature: 0.3, trend: 0.25 } },
  'mountain-whitefish': { id: 'mountain-whitefish', name: 'Mountain whitefish', temperature: { best: [38, 55], ok: [34, 62], stress: 68 }, flow: { best: [70, 110], ok: [45, 150] }, trend: TROUT_TREND, weights: DEFAULT_WEIGHTS },
  'smallmouth-bass': { id: 'smallmouth-bass', name: 'Smallmouth bass', temperature: { best: [62, 78], ok: [55, 84], stress: 88 }, flow: { best: [40, 100], ok: [25, 130] }, trend: WARMWATER_TREND, weights: { flow: 0.3, temperature: 0.5, trend: 0.2 } },
  'largemouth-bass': { id: 'largemouth-bass', name: 'Largemouth bass', temperature: { best: [65, 80], ok: [55, 86], stress: 90 }, flow: { best: [40, 100], ok: [25, 130] }, trend: WARMWATER_TREND, weights: { flow: 0.2, temperature: 0.6, trend: 0.2 } },
  'kokanee': { id: 'kokanee', name: 'Kokanee', temperature: { best: [44, 56], ok: [40, 60], stress: 64 }, flow: { best: [70, 120], ok: [45, 160] }, trend: TROUT_TREND, weights: DEFAULT_WEIGHTS },
  'black-crappie': { id: 'black-crappie', name: 'Black crappie', temperature: { best: [60, 75], ok: [52, 82], stress: 88 }, flow: { best: [40, 100], ok: [25, 130] }, trend: WARMWATER_TREND, weights: { flow: 0.2, temperature: 0.6, trend: 0.2 } },
  'bluegill': { id: 'bluegill', name: 'Bluegill', temperature: { best: [65, 80], ok: [55, 86], stress: 90 }, flow: { best: [40, 100], ok: [25, 130] }, trend: WARMWATER_TREND, weights: { flow: 0.2, temperature: 0.6, trend: 0.2 } },
};

/**
 * A species in a particular water: when it is a realistic target there, when most anglers are after it,
 * when its season peaks, and anything an angler must know.
 */
export interface WaterSpecies {
  species: SpeciesId;
  /** Calendar months (1–12) when this species is a target in this water. Empty means year-round. */
  months: number[];
  /** Months when this is the water's main target; the headline score follows it. */
  primary: number[];
  /** Months at the heart of the run or hatch; shoulder months in season score lower on the season component. Omit for year-round residents. */
  peak?: number[];
  note?: string;
}

const months = (from: number, to: number) => Array.from({ length: (to - from + 12) % 12 + 1 }, (_, i) => ((from - 1 + i) % 12) + 1);
const ALL_YEAR: number[] = [];
const NEVER: number[] = [];

export const WATER_SPECIES: Record<string, WaterSpecies[]> = {
  'lower-deschutes-warm-springs-trout-creek': [
    { species: 'redband-trout', months: ALL_YEAR, primary: [...months(12, 8)], peak: [5, 6, 9, 10], note: 'The Deschutes “redside”. The salmonfly and golden stone hatches peak in late May and June. Artificial flies and lures only on the lower river.' },
    { species: 'summer-steelhead', months: months(8, 12), primary: months(9, 11), peak: [9, 10], note: 'Wild and hatchery fish reach this reach from late summer; most anglers switch to steelhead by September.' },
    { species: 'spring-chinook', months: months(5, 6), primary: NEVER, peak: [5], note: 'Season and open areas are set yearly by ODFW.' },
    { species: 'bull-trout', months: ALL_YEAR, primary: NEVER, note: 'Protected: release immediately and unharmed.' },
    { species: 'mountain-whitefish', months: ALL_YEAR, primary: NEVER, peak: months(11, 2), note: 'Most active in the cold months.' },
  ],
  'lower-deschutes-moody': [
    { species: 'summer-steelhead', months: months(7, 12), primary: months(7, 11), peak: months(8, 10), note: 'The lower river sees the run first, from July.' },
    { species: 'redband-trout', months: ALL_YEAR, primary: [...months(12, 6)] },
    { species: 'fall-chinook', months: months(8, 10), primary: NEVER, peak: [9] },
    { species: 'spring-chinook', months: months(4, 6), primary: NEVER, peak: [5], note: 'Season and open areas are set yearly by ODFW.' },
    { species: 'smallmouth-bass', months: months(5, 10), primary: NEVER, peak: months(6, 8), note: 'The lowest miles above the Columbia.' },
    { species: 'mountain-whitefish', months: ALL_YEAR, primary: NEVER, peak: months(11, 2) },
  ],
  'middle-deschutes-culver': [
    { species: 'redband-trout', months: ALL_YEAR, primary: months(1, 12), note: 'Flows are lowest during irrigation season, April to October.' },
    { species: 'brown-trout', months: ALL_YEAR, primary: NEVER },
    { species: 'mountain-whitefish', months: ALL_YEAR, primary: NEVER, peak: months(11, 2) },
  ],
  'crooked-river-opal-springs': [
    { species: 'redband-trout', months: ALL_YEAR, primary: months(1, 12) },
    { species: 'mountain-whitefish', months: ALL_YEAR, primary: NEVER, peak: months(11, 2) },
    { species: 'bull-trout', months: months(10, 3), primary: NEVER, peak: months(11, 1), note: 'Moves up from Lake Billy Chinook in fall and winter. Protected: release unharmed.' },
    { species: 'smallmouth-bass', months: months(6, 9), primary: NEVER, peak: [7, 8], note: 'Near the lake in summer.' },
  ],
  'metolius-river-grandview': [
    { species: 'redband-trout', months: ALL_YEAR, primary: months(1, 12), note: 'Fly-fishing-only water; check current trout rules.' },
    { species: 'bull-trout', months: ALL_YEAR, primary: NEVER, note: 'The Metolius is the region’s best bull trout river. Check seasonal closures near spawning areas.' },
    { species: 'brown-trout', months: ALL_YEAR, primary: NEVER },
    { species: 'kokanee', months: months(9, 10), primary: NEVER, peak: [10], note: 'Spawning run up from Lake Billy Chinook.' },
    { species: 'mountain-whitefish', months: ALL_YEAR, primary: NEVER, peak: months(11, 2) },
  ],
};

/** Species in waters that are not on the board yet, so people still learn what swims there. */
export const PROPOSED_WATER_SPECIES: Record<string, SpeciesId[]> = {
  'Crooked River below Bowman Dam': ['redband-trout', 'mountain-whitefish'],
  'Fall River': ['redband-trout', 'brown-trout', 'brook-trout'],
  'Haystack Reservoir': ['redband-trout', 'largemouth-bass', 'smallmouth-bass', 'black-crappie', 'bluegill', 'kokanee'],
  'Lake Billy Chinook': ['kokanee', 'bull-trout', 'smallmouth-bass', 'brown-trout', 'redband-trout', 'largemouth-bass'],
};

export function inSeason(entry: WaterSpecies, month: number): boolean {
  return entry.months.length === 0 || entry.months.includes(month);
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Aug–Dec", "Oct–Mar", "Year-round", or a list when months are not contiguous. */
export function describeMonths(list: number[]): string {
  if (!list.length || list.length === 12) return 'Year-round';
  const sorted = [...new Set(list)].sort((a, b) => a - b);
  // Find a contiguous run allowing wrap past December.
  for (const start of sorted) {
    const run = Array.from({ length: sorted.length }, (_, i) => ((start - 1 + i) % 12) + 1);
    if (run.every(m => sorted.includes(m))) return `${MONTH_NAMES[run[0]! - 1]}–${MONTH_NAMES[run.at(-1)! - 1]}`;
  }
  return sorted.map(m => MONTH_NAMES[m - 1]).join(', ');
}
