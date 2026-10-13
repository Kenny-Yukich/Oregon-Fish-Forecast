import type { BoardChange, FlowNormal, Observation, ScoreComponent, SpeciesScore, WaterScore } from '../shared/types';
import { SPECIES, WATER_SPECIES, describeMonths, inSeason, type Band, type Species, type WaterSpecies } from '../shared/species';
import { planningScore } from '../shared/planning';

export const SCORE_VERSION = 'species-conditions-v1';
export const LABELS: [number, WaterScore['label']][] = [[88, 'Prime'], [72, 'Great'], [55, 'Good'], [38, 'Fair'], [0, 'Poor']];
// Flow outside a species' ok band caps the whole score at the flow factor; stress-temperature water caps it here.
const STRESS_CAP = 20;
// Within this percentage of yesterday's flow counts as steady; beyond this much is a fast change.
const STEADY_PERCENT = 2;
const FAST_PERCENT = 10;

export function label(score: number): WaterScore['label'] {
  return LABELS.find(([floor]) => score >= floor)![1];
}

/**
 * 1 at the centre of the best band and 0.85 at its edges, easing to 0.6 at the edge of the ok band,
 * then down to 0.1 at twice that distance beyond it. Only the sweet spot earns full marks.
 */
export function bandFactor(value: number, band: Band): number {
  const [bestLo, bestHi] = band.best; const [okLo, okHi] = band.ok;
  if (value >= bestLo && value <= bestHi) {
    const half = (bestHi - bestLo) / 2 || 1;
    return 1 - 0.15 * Math.abs(value - (bestLo + bestHi) / 2) / half;
  }
  const low = value < bestLo;
  const okEdge = low ? okLo : okHi; const bestEdge = low ? bestLo : bestHi;
  const span = Math.abs(bestEdge - okEdge) || 1;
  const distance = Math.abs(value - bestEdge);
  if (distance <= span) return 0.85 - 0.25 * (distance / span);
  return Math.max(0.1, 0.6 - 0.5 * ((distance - span) / span));
}

function flowComponent(normal: FlowNormal, species: Species): ScoreComponent {
  const percent = normal.percent_of_median;
  if (percent === null) return { name: 'Flow', weight: species.weights.flow, factor: null, points: null, detail: normal.reason ?? 'Flow comparison unavailable.' };
  const factor = bandFactor(percent, species.flow);
  const [lo, hi] = species.flow.best;
  const detail = percent < lo ? `${Math.round(percent)}% of normal — on the low side for ${species.name.toLowerCase()}` :
    percent > hi ? `${Math.round(percent)}% of normal — higher than ${species.name.toLowerCase()} like it` : `${Math.round(percent)}% of normal — in the sweet spot`;
  return { name: 'Flow', weight: species.weights.flow, factor, points: factor * species.weights.flow * 100, detail };
}

function temperatureComponent(temperature: Observation | undefined, species: Species): ScoreComponent {
  const value = temperature?.normalized_value ?? null;
  if (value === null) return { name: 'Water temperature', weight: species.weights.temperature, factor: null, points: null, detail: 'No water temperature reading.' };
  const degrees = `${value.toFixed(1)} °F`;
  if (value >= species.temperature.stress) {
    return { name: 'Water temperature', weight: species.weights.temperature, factor: 0, points: 0, detail: `${degrees} — stressful for ${species.name.toLowerCase()}; consider leaving them alone` };
  }
  const factor = bandFactor(value, species.temperature);
  const [lo, hi] = species.temperature.best;
  const detail = value < lo ? `${degrees} — cold; fish will be slower` : value > hi ? `${degrees} — warm for ${species.name.toLowerCase()}` : `${degrees} — ideal for ${species.name.toLowerCase()}`;
  return { name: 'Water temperature', weight: species.weights.temperature, factor, points: factor * species.weights.temperature * 100, detail };
}

function trendComponent(change: BoardChange | undefined, species: Species): ScoreComponent {
  const percent = change?.percent ?? null;
  if (percent === null) return { name: '24h trend', weight: species.weights.trend, factor: null, points: null, detail: change?.reason ?? 'No 24-hour comparison.' };
  const [steady, fallingGently, fallingFast, risingGently, risingFast] = species.trend;
  const factor = Math.abs(percent) <= STEADY_PERCENT ? steady : percent < 0 ? (percent >= -FAST_PERCENT ? fallingGently : fallingFast) : percent <= FAST_PERCENT ? risingGently : risingFast;
  const word = Math.abs(percent) <= STEADY_PERCENT ? 'Steady' : percent < 0 ? (percent >= -FAST_PERCENT ? 'Falling gently' : 'Dropping fast') : percent <= FAST_PERCENT ? 'Rising gently' : 'Rising fast';
  const detail = `${word} (${percent > 0 ? '+' : ''}${percent.toFixed(1)}% in 24h)${factor >= 0.85 ? '' : factor >= 0.6 ? ' — fish may be unsettled' : ' — often off-color or pushing fish around'}`;
  return { name: '24h trend', weight: species.weights.trend, factor, points: factor * species.weights.trend * 100, detail };
}

// When a species has defined peak months, time of year takes this share of its score.
const SEASON_WEIGHT = 0.2;
const SHOULDER_FACTOR = 0.6;

function seasonComponent(entry: WaterSpecies, month: number): ScoreComponent | null {
  if (!entry.peak?.length) return null;
  const peak = entry.peak.includes(month);
  return { name: 'Time of year', weight: SEASON_WEIGHT, factor: peak ? 1 : SHOULDER_FACTOR, points: (peak ? 1 : SHOULDER_FACTOR) * SEASON_WEIGHT * 100,
    detail: peak ? `Peak of the season (${describeMonths(entry.peak)})` : `In season, but outside the peak (${describeMonths(entry.peak)})` };
}

export interface ScoreInputs { normal: FlowNormal; temperature: Observation | undefined; change: BoardChange | undefined }

/** Weighted blend of the available components, renormalized over what is present; partial when anything is missing. */
export function scoreSpecies(entry: WaterSpecies, inputs: ScoreInputs, month: number): SpeciesScore {
  const species = SPECIES[entry.species];
  const base = { species: species.id, name: species.name, in_season: inSeason(entry, month), primary: entry.primary.includes(month), months: entry.months,
    peak: entry.peak ?? [], note: entry.note ?? null, version: SCORE_VERSION };
  const season = seasonComponent(entry, month);
  const scale = season ? 1 - SEASON_WEIGHT : 1;
  const conditions = [flowComponent(inputs.normal, species), temperatureComponent(inputs.temperature, species), trendComponent(inputs.change, species)]
    .map(c => ({ ...c, weight: c.weight * scale, points: c.points === null ? null : c.points * scale }));
  const components = season ? [...conditions, season] : conditions;
  const available = conditions.filter(c => c.factor !== null);
  const missing = conditions.filter(c => c.factor === null).map(c => c.name.toLowerCase());
  // Time of year alone is not a score; at least one measured input is required.
  if (!available.length) return { ...base, score: null, label: null, partial: false, missing, components, stress: false, capped_by: null };
  const scored = season ? [...available, season] : available;
  const weight = scored.reduce((sum, c) => sum + c.weight, 0);
  let score = Math.round(scored.reduce((sum, c) => sum + c.factor! * c.weight, 0) / weight * 100);
  const stress = conditions[1]!.factor === 0;
  // Gates: no amount of good temperature or timing makes a blown-out or dangerously warm river fish well.
  const flowFactor = conditions[0]!.factor;
  let cappedBy: string | null = null;
  if (flowFactor !== null && flowFactor < 0.6 && score > Math.round(flowFactor * 100)) { score = Math.round(flowFactor * 100); cappedBy = 'flow outside the fishable range'; }
  if (stress && score > STRESS_CAP) { score = STRESS_CAP; cappedBy = 'water temperature at the stress threshold'; }
  return { ...base, score, label: label(score), partial: missing.length > 0, missing, components, stress, capped_by: cappedBy };
}

/** The headline follows the water's main target for the month; if that cannot be scored, the best other in-season species stands in. */
export function scoreWater(waterId: string, inputs: ScoreInputs, now: number): WaterScore {
  const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric' }).format(new Date(now)));
  const species = (WATER_SPECIES[waterId] ?? []).map(entry => scoreSpecies(entry, inputs, month));
  const scoreable = species.filter(s => s.in_season && s.score !== null);
  const headline = scoreable.find(s => s.primary) ?? [...scoreable].sort((a, b) => b.score! - a.score!)[0] ?? null;
  const primaryName = species.find(s => s.primary)?.name ?? null;
  return planningScore(waterId, { version: SCORE_VERSION, month, score: headline?.score ?? null, label: headline?.label ?? null, species_id: headline?.species ?? null,
    species_name: headline?.name ?? null, primary_name: primaryName, partial: headline?.partial ?? false, missing: headline?.missing ?? species[0]?.missing ?? [],
    reason: headline ? null : species.length ? 'No in-season species has enough readings to score.' : 'No species list for this water.', species }, now)!;
}
