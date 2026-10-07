import type { Observation, Parameter, Trend } from '../shared/types';
import { SourceClient, SourceError, numeric, object, timestamp, type Json } from './net';
import { SourceCache, type Snapshot } from './cache';

export const STATION = 'USGS-14092500';
export const STATION_URL = `https://waterdata.usgs.gov/monitoring-location/${STATION}/`;
const BASE = 'https://api.waterdata.usgs.gov/ogcapi/v1/collections';
export const SERIES: Record<Parameter, { id: string; unit: string; label: string; display: string }> = {
  '00060': { id: '47492ea9b75943f897a02eb01b0b4483', unit: 'ft^3/s', label: 'River flow', display: 'cfs' },
  '00065': { id: '1bbe6876316b47ffb21c5599f7e2238d', unit: 'ft', label: 'Gauge height', display: 'ft' },
  '00010': { id: '40a81e5a03e644ebbad40c3d86380654', unit: 'degC', label: 'Water temperature', display: '°F' },
};
export const PARAMETERS = Object.keys(SERIES) as Parameter[];
// An operational display threshold; this is not a biological or safety threshold.
export const OBSERVATION_FRESH_MS = 2 * 3600_000;
const GAP_MS = 72 * 60_000; // USGS pinned metadata data_gap_interval=PT1H12M, verified 2026-10-07.

export function collectionUrl(collection: string, params: Record<string, string>): string {
  return `${BASE}/${collection}/items?${new URLSearchParams({ f: 'json', limit: '1000', ...params })}`;
}

export function validateStation(feature: Json): void {
  const p = object(feature.properties);
  const geometry = object(feature.geometry);
  const coordinates = geometry.coordinates;
  if (feature.id !== STATION || p.id !== STATION || p.agency_code !== 'USGS' ||
    p.monitoring_location_number !== '14092500' ||
    typeof p.monitoring_location_name !== 'string' || p.monitoring_location_name.toUpperCase() !== 'DESCHUTES RIVER NEAR MADRAS, OR' ||
    geometry.type !== 'Point' || !Array.isArray(coordinates) ||
    typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number' ||
    !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) ||
    Math.abs(Number(coordinates[0]) + 121.246993886344) > 0.001 || Math.abs(Number(coordinates[1]) - 44.7259522504172) > 0.001) {
    throw new SourceError('USGS station identity or coordinates do not match the reviewed source.');
  }
}

export function validateMetadata(features: Json[]): Record<Parameter, Json> {
  const metadata = {} as Record<Parameter, Json>;
  for (const code of PARAMETERS) {
    const matches = features.filter(feature => feature.id === SERIES[code].id);
    if (matches.length !== 1) throw new SourceError(`USGS pinned series is missing or ambiguous (${code}).`);
    const p = object(matches[0]!.properties);
    if (p.id !== SERIES[code].id || p.monitoring_location_id !== STATION || p.parameter_code !== code ||
      p.unit_of_measure !== SERIES[code].unit || p.statistic_id !== '00011' || p.primary !== 'Primary' ||
      p.computation_period_identifier !== 'Points' || p.computation_identifier !== 'Instantaneous') {
      throw new SourceError(`USGS sensor metadata does not match the pinned parameter (${code}).`);
    }
    timestamp(p.begin); timestamp(p.end);
    metadata[code] = p;
  }
  return metadata;
}

export function missingObservation(code: Parameter, reason: string): Observation {
  return { id: `missing-${code}`, source_id: 'usgs', source_url: STATION_URL, station_id: STATION,
    time_series_id: SERIES[code].id, parameter_code: code, label: SERIES[code].label,
    raw_value: null, raw_unit: null, normalized_value: null, normalized_unit: SERIES[code].display,
    observed_at: null, retrieved_at: null, approval_status: null, qualifiers: [], quality_status: 'unavailable',
    mapping_status: 'candidate_proxy', issues: [reason] };
}

export function parseObservation(feature: Json, code: Parameter, retrievedAt: string, now: number): Observation {
  const p = object(feature.properties);
  if (p.monitoring_location_id !== STATION || p.time_series_id !== SERIES[code].id ||
      p.parameter_code !== code || p.statistic_id !== '00011') throw new SourceError('USGS observation identity mismatch.');
  const observedAt = timestamp(p.time);
  const rawUnit = typeof p.unit_of_measure === 'string' ? p.unit_of_measure : null;
  const rawNumber = numeric(p.value);
  const issues: string[] = [];
  const qualifiers = p.qualifier === null || p.qualifier === undefined || p.qualifier === '' ? [] :
    typeof p.qualifier === 'string' ? [p.qualifier] : Array.isArray(p.qualifier) && p.qualifier.every(q => typeof q === 'string') ? p.qualifier : ['Unknown qualifier format'];
  if (rawNumber === null) issues.push('Missing or non-numeric measurement.');
  if (rawUnit !== SERIES[code].unit) issues.push('Unrecognized unit for this pinned parameter.');
  if (p.approval_status !== 'Approved' && p.approval_status !== 'Provisional') issues.push('Unknown approval status.');
  if (qualifiers.length) issues.push('Qualified measurement; inspect the original USGS record.');
  if (Date.parse(observedAt) > now) issues.push('Measurement timestamp is in the future.');
  // Negative stage and slightly negative water temperature can be meaningful; negative discharge at this station is withheld.
  if (rawNumber !== null && code === '00060' && rawNumber < 0) issues.push('Negative discharge requires review for this station.');
  if (rawNumber !== null && code === '00010' && (rawNumber < -1 || rawNumber > 65)) issues.push('Temperature exceeds this sensor’s published operational bounds.');
  const normalized = issues.length === 0 && rawNumber !== null ? (code === '00010' ? rawNumber * 9 / 5 + 32 : rawNumber) : null;
  const id = typeof feature.id === 'string' ? feature.id : `${SERIES[code].id}:${observedAt}`;
  return { id, source_id: 'usgs', source_url: STATION_URL, station_id: STATION, time_series_id: SERIES[code].id,
    parameter_code: code, label: SERIES[code].label, raw_value: p.value ?? null, raw_unit: rawUnit,
    normalized_value: normalized, normalized_unit: SERIES[code].display, observed_at: observedAt, retrieved_at: retrievedAt,
    approval_status: typeof p.approval_status === 'string' ? p.approval_status : null, qualifiers,
    quality_status: normalized === null ? 'unavailable' : now - Date.parse(observedAt) > OBSERVATION_FRESH_MS ? 'stale' : 'current',
    mapping_status: 'candidate_proxy', issues };
}

export function unavailableTrend(reason: string): Trend {
  return { status: 'unavailable', parameter_code: '00060', time_series_id: SERIES['00060'].id, unit: 'cfs', period_hours: 72,
    points: [], change: null, change_percent: null, has_gaps: true, complete: false, reason,
    calculation_version: 'same-series-72h-v1', input_record_ids: [] };
}

export function buildTrend(records: Observation[], now: number, error: string | null = null): Trend {
  if (!records.length) return unavailableTrend(error ?? 'No continuous flow history was returned.');
  if (records.some(r => r.time_series_id !== SERIES['00060'].id || r.parameter_code !== '00060')) throw new SourceError('Trend mixes sensor series.');
  const unique = new Map<string, Observation>();
  for (const record of records) {
    if (!record.observed_at) continue;
    const existing = unique.get(record.observed_at);
    if (existing && existing.normalized_value !== record.normalized_value) throw new SourceError('Conflicting history readings at the same time.');
    unique.set(record.observed_at, record);
  }
  const ordered = [...unique.values()].sort((a, b) => Date.parse(a.observed_at!) - Date.parse(b.observed_at!));
  const points = ordered.map(r => ({ id: r.id, observed_at: r.observed_at!, value: r.normalized_value }));
  const first = points[0]; const last = points.at(-1);
  if (!first || !last || points.filter(p => p.value !== null).length < 2) return { ...unavailableTrend('At least two valid same-series measurements are required.'), points };
  const hasGaps = points.some((p, i) => p.value === null || (i > 0 && Date.parse(p.observed_at) - Date.parse(points[i - 1]!.observed_at) > GAP_MS));
  const span = Date.parse(last.observed_at) - Date.parse(first.observed_at);
  const complete = !hasGaps && span >= 71 * 3600_000 && span <= 73 * 3600_000;
  const change = complete && first.value !== null && last.value !== null ? last.value - first.value : null;
  return { status: error || now - Date.parse(last.observed_at) > OBSERVATION_FRESH_MS ? 'stale' : 'current',
    parameter_code: '00060', time_series_id: SERIES['00060'].id, unit: 'cfs', period_hours: 72, points,
    change, change_percent: change !== null && first.value !== null && first.value !== 0 ? change / first.value * 100 : null,
    has_gaps: hasGaps, complete, reason: error ?? (!complete ? 'History has gaps or does not cover a full 72-hour comparison.' : null),
    calculation_version: 'same-series-72h-v1', input_record_ids: points.map(p => p.id) };
}

export class UsgsAdapter {
  constructor(private client: SourceClient, private cache: SourceCache, private now: () => number = Date.now) {}

  async latest(): Promise<Snapshot<Observation[]>> {
    return this.cache.get('usgs-latest-pinned-v1', 15 * 60_000, async () => {
      const metadata = await this.cache.get('usgs-metadata-pinned-v1', 24 * 3600_000, async () => {
        const [station, series] = await Promise.all([
          this.client.json(`${BASE}/monitoring-locations/items/${STATION}?f=json`),
          this.client.features(collectionUrl('time-series-metadata', { monitoring_location_id: STATION })),
        ]);
        validateStation(station);
        return validateMetadata(series);
      });
      if (!metadata.value || metadata.error) throw new SourceError(`USGS station and sensor metadata could not be revalidated. ${metadata.error ?? 'Metadata is unavailable.'}`);
      const features = await this.client.features(collectionUrl('latest-continuous', { monitoring_location_id: STATION }));
      const retrieved = new Date(this.now()).toISOString();
      return PARAMETERS.map(code => {
        const selected = features.filter(f => object(f.properties).time_series_id === SERIES[code].id);
        if (selected.length === 0) return missingObservation(code, 'The pinned sensor did not return a measurement.');
        if (selected.length !== 1) throw new SourceError('USGS returned multiple latest readings for one pinned series.');
        try { return parseObservation(selected[0]!, code, retrieved, this.now()); }
        catch (error) { return missingObservation(code, error instanceof SourceError ? error.message : 'Measurement validation failed.'); }
      });
    });
  }

  async history(): Promise<Snapshot<Observation[]>> {
    return this.cache.get('usgs-history-flow-v1', 15 * 60_000, async () => {
      const latest = await this.latest();
      if (!latest.value || latest.error) throw new SourceError('Continuous history awaits a validated source identity.');
      const end = this.now();
      const features = await this.client.features(collectionUrl('continuous', {
        time_series_id: SERIES['00060'].id, datetime: `${new Date(end - 72 * 3600_000).toISOString()}/${new Date(end).toISOString()}`,
      }));
      const retrieved = new Date(this.now()).toISOString();
      return features.map(feature => parseObservation(feature, '00060', retrieved, this.now()));
    });
  }
}
