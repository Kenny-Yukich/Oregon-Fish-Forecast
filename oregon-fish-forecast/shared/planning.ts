import { CENTRAL_PLANNING } from './planning-central';
import { STATEWIDE_PLANNING } from './planning-statewide';
import type { WaterPlanning } from './planning-types';
import type { WaterScore } from './types';

export const WATER_PLANNING: WaterPlanning[] = [...CENTRAL_PLANNING, ...STATEWIDE_PLANNING];

export function findPlanning(waterId: string): WaterPlanning | undefined {
  return WATER_PLANNING.find(record => record.water_id === waterId);
}

/** Directions are requested by the visitor; no travel duration is fabricated or cached. */
export function directionsUrl(planning: WaterPlanning, origin: string): string | null {
  if (!planning.access_point || !origin.trim()) return null;
  const query = new URLSearchParams({ api: '1', origin: origin.trim(), destination: planning.access_point.map_query, travelmode: 'driving' });
  return `https://www.google.com/maps/dir/?${query}`;
}

/** A reported restriction cannot be overridden by good gauge readings or an old API snapshot. */
export function planningScore(waterId: string, score: WaterScore | undefined, asOf?: number): WaterScore | undefined {
  const planning = findPlanning(waterId);
  const notice = planning?.score_notice;
  if (!score || !notice) return score;
  // A later report may describe an already-active restriction. Use its effective
  // time, not the report date; after the noticed period we still need a new review.
  if (asOf !== undefined && planning?.score_notice_effective_at && asOf < Date.parse(planning.score_notice_effective_at)) return score;
  return { ...score, score: null, label: null, species_id: null, species_name: null, primary_name: 'Restrictions reported',
    partial: false, missing: [], reason: notice,
    species: score.species.map(species => ({ ...species, score: null, label: null, primary: false, components: [], note: notice })) };
}
