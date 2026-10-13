import type { DataStatus, FlowNormal, Observation, Parameter, Trend } from '../shared/types';
import type { Gauge } from '../shared/waters';
import { SourceClient, SourceError, numeric, object, timestamp, type Json } from './net';
import { SourceCache, type Snapshot } from './cache';

const BASE = 'https://api.waterdata.usgs.gov/ogcapi/v1/collections';
export const SERIES: Record<Parameter, { unit: string; label: string; display: string }> = {
  '00060': { unit: 'ft^3/s', label: 'River flow', display: 'cfs' },
  '00065': { unit: 'ft', label: 'Gauge height', display: 'ft' },
  '00010': { unit: 'degC', label: 'Water temperature', display: '°F' },
};
export const PARAMETERS = Object.keys(SERIES) as Parameter[];
// An operational display threshold; this is not a biological or safety threshold.
export const OBSERVATION_FRESH_MS = 2 * 3600_000;
export const HISTORY_HOURS = 168;
const GAP_MS = 72 * 60_000; // USGS pinned metadata data_gap_interval=PT1H12M, verified 2026-10-07.
const CALCULATION_VERSION = 'same-series-168h-v1';

export function collectionUrl(collection: string, params: Record<string, string>): string {
  return `${BASE}/${collection}/items?${new URLSearchParams({ f: 'json', limit: '1000', ...params })}`;
}

export function validateStation(feature: Json, gauge: Gauge): void {
  const p = object(feature.properties);
  const geometry = object(feature.geometry);
  const coordinates = geometry.coordinates;
  if (feature.id !== gauge.station_id || p.id !== gauge.station_id || p.agency_code !== 'USGS' ||
    p.monitoring_location_number !== gauge.number ||
    typeof p.monitoring_location_name !== 'string' || p.monitoring_location_name.toUpperCase() !== gauge.name ||
    geometry.type !== 'Point' || !Array.isArray(coordinates) ||
    typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number' ||
    !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) ||
    Math.abs(Number(coordinates[0]) - gauge.longitude) > 0.001 || Math.abs(Number(coordinates[1]) - gauge.latitude) > 0.001) {
    throw new SourceError('USGS station identity or coordinates do not match the reviewed source.');
  }
}

export function validateMetadata(features: Json[], gauge: Gauge): Record<Parameter, Json> {
  const metadata = {} as Record<Parameter, Json>;
  for (const code of PARAMETERS) {
    const matches = features.filter(feature => feature.id === gauge.series[code]);
    if (matches.length !== 1) throw new SourceError(`USGS pinned series is missing or ambiguous (${code}).`);
    const p = object(matches[0]!.properties);
    if (p.id !== gauge.series[code] || p.monitoring_location_id !== gauge.station_id || p.parameter_code !== code ||
      p.unit_of_measure !== SERIES[code].unit || p.statistic_id !== '00011' || p.primary !== 'Primary' ||
      p.computation_period_identifier !== 'Points' || p.computation_identifier !== 'Instantaneous') {
      throw new SourceError(`USGS sensor metadata does not match the pinned parameter (${code}).`);
    }
    timestamp(p.begin); timestamp(p.end);
    metadata[code] = p;
  }
  const daily = features.filter(feature => feature.id === gauge.daily_series);
  if (daily.length !== 1) throw new SourceError('USGS pinned daily-mean series is missing or ambiguous.');
  const d = object(daily[0]!.properties);
  if (d.monitoring_location_id !== gauge.station_id || d.parameter_code !== '00060' || d.unit_of_measure !== SERIES['00060'].unit ||
    d.statistic_id !== '00003' || d.primary !== 'Primary' || d.computation_period_identifier !== 'Daily' || d.computation_identifier !== 'Mean') {
    throw new SourceError('USGS daily-mean series metadata does not match the pinned series.');
  }
  return metadata;
}

export interface DailyMean { date: string; value: number }
export const NORMAL_YEARS = 10;
export const NORMAL_WINDOW_DAYS = 7;
const NORMAL_MIN_YEARS = 5;

export function parseDailyMean(feature: Json, gauge: Gauge): DailyMean | null {
  const p = object(feature.properties);
  if (p.time_series_id !== gauge.daily_series || p.parameter_code !== '00060' || p.statistic_id !== '00003') throw new SourceError('USGS daily value identity mismatch.');
  if (typeof p.time !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.time) || !Number.isFinite(Date.parse(`${p.time}T00:00:00Z`))) throw new SourceError('USGS daily value has an invalid date.');
  const value = numeric(p.value);
  // Qualified, unapproved, wrong-unit, or negative daily means are left out rather than guessed at.
  if (value === null || value < 0 || p.unit_of_measure !== SERIES['00060'].unit || (p.approval_status !== 'Approved' && p.approval_status !== 'Provisional') ||
    (p.qualifier !== null && p.qualifier !== undefined && p.qualifier !== '')) return null;
  return { date: p.time, value };
}

function unavailableNormal(reason: string, gauge: Gauge, retrievedAt: string | null = null): FlowNormal {
  return { status: 'unavailable', median: null, percent_of_median: null, years: 0, first_year: null, last_year: null,
    window_days: NORMAL_WINDOW_DAYS, time_series_id: gauge.daily_series, retrieved_at: retrievedAt, reason };
}

/** Median of daily means within NORMAL_WINDOW_DAYS of the given month/day in earlier years, compared with the latest flow. */
export function flowNormal(records: DailyMean[], latest: Observation | undefined, today: { year: number; month: number; day: number }, gauge: Gauge, retrievedAt: string | null, status: DataStatus): FlowNormal {
  const dayMs = 86_400_000;
  const values: number[] = []; const years = new Set<number>();
  for (const record of records) {
    const year = Number(record.date.slice(0, 4));
    if (year >= today.year) continue; // The current year is what we are comparing against, not part of "normal".
    const at = Date.parse(`${record.date}T00:00:00Z`);
    const nearest = Math.min(...[year - 1, year, year + 1].map(y => Math.abs(at - Date.UTC(y, today.month - 1, today.day)) / dayMs));
    if (nearest <= NORMAL_WINDOW_DAYS) { values.push(record.value); years.add(year); }
  }
  if (years.size < NORMAL_MIN_YEARS) return unavailableNormal(`Fewer than ${NORMAL_MIN_YEARS} earlier years of daily flow are available for this date.`, gauge, retrievedAt);
  values.sort((a, b) => a - b);
  const median = values.length % 2 ? values[(values.length - 1) / 2]! : (values[values.length / 2 - 1]! + values[values.length / 2]!) / 2;
  const sortedYears = [...years].sort((a, b) => a - b);
  const flow = latest?.normalized_value ?? null;
  // The comparison is only as fresh as the flow reading it uses.
  const combined: DataStatus = flow === null ? 'unavailable' : latest!.quality_status === 'stale' || status === 'stale' ? 'stale' : latest!.quality_status;
  return { status: combined, median, percent_of_median: flow === null || median === 0 ? null : flow / median * 100,
    years: years.size, first_year: sortedYears[0]!, last_year: sortedYears.at(-1)!, window_days: NORMAL_WINDOW_DAYS,
    time_series_id: gauge.daily_series, retrieved_at: retrievedAt, reason: flow === null ? 'No validated current flow to compare.' : null };
}

export function normalFor(daily: Snapshot<DailyMean[]>, latest: Observation | undefined, now: number, gauge: Gauge): FlowNormal {
  if (!daily.value) return unavailableNormal(daily.error ?? 'Daily flow history is unavailable.', gauge);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(now));
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return flowNormal(daily.value, latest, { year: part('year'), month: part('month'), day: part('day') }, gauge, daily.retrieved_at, daily.error ? 'stale' : 'current');
}

export function missingObservation(code: Parameter, reason: string, gauge: Gauge): Observation {
  return { id: `missing-${gauge.number}-${code}`, source_id: 'usgs', source_url: gauge.url, station_id: gauge.station_id,
    time_series_id: gauge.series[code], parameter_code: code, label: SERIES[code].label,
    raw_value: null, raw_unit: null, normalized_value: null, normalized_unit: SERIES[code].display,
    observed_at: null, retrieved_at: null, approval_status: null, qualifiers: [], quality_status: 'unavailable',
    mapping_status: 'candidate_proxy', issues: [reason] };
}

export function parseObservation(feature: Json, code: Parameter, retrievedAt: string, now: number, gauge: Gauge): Observation {
  const p = object(feature.properties);
  if (p.monitoring_location_id !== gauge.station_id || p.time_series_id !== gauge.series[code] ||
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
  // Negative stage and slightly negative water temperature can be meaningful; negative discharge is withheld.
  if (rawNumber !== null && code === '00060' && rawNumber < 0) issues.push('Negative discharge requires review for this station.');
  if (rawNumber !== null && code === '00010' && (rawNumber < -1 || rawNumber > 65)) issues.push('Temperature exceeds this sensor’s published operational bounds.');
  const normalized = issues.length === 0 && rawNumber !== null ? (code === '00010' ? rawNumber * 9 / 5 + 32 : rawNumber) : null;
  const id = typeof feature.id === 'string' ? feature.id : `${gauge.series[code]}:${observedAt}`;
  return { id, source_id: 'usgs', source_url: gauge.url, station_id: gauge.station_id, time_series_id: gauge.series[code],
    parameter_code: code, label: SERIES[code].label, raw_value: p.value ?? null, raw_unit: rawUnit,
    normalized_value: normalized, normalized_unit: SERIES[code].display, observed_at: observedAt, retrieved_at: retrievedAt,
    approval_status: typeof p.approval_status === 'string' ? p.approval_status : null, qualifiers,
    quality_status: normalized === null ? 'unavailable' : now - Date.parse(observedAt) > OBSERVATION_FRESH_MS ? 'stale' : 'current',
    mapping_status: 'candidate_proxy', issues };
}

export function unavailableTrend(reason: string, gauge: Gauge): Trend {
  return { status: 'unavailable', parameter_code: '00060', time_series_id: gauge.series['00060'], unit: 'cfs', period_hours: HISTORY_HOURS,
    points: [], change: null, change_percent: null, has_gaps: true, complete: false, reason,
    calculation_version: CALCULATION_VERSION, input_record_ids: [] };
}

export function buildTrend(records: Observation[], now: number, error: string | null, gauge: Gauge): Trend {
  if (!records.length) return unavailableTrend(error ?? 'No continuous flow history was returned.', gauge);
  if (records.some(r => r.time_series_id !== gauge.series['00060'] || r.parameter_code !== '00060')) throw new SourceError('Trend mixes sensor series.');
  const unique = new Map<string, Observation>();
  for (const record of records) {
    if (!record.observed_at) continue;
    const existing = unique.get(record.observed_at);
    if (existing && existing.normalized_value !== record.normalized_value) throw new SourceError('Conflicting history readings at the same time.');
    unique.set(record.observed_at, record);
  }
  const ordered = [...unique.values()].sort((a, b) => Date.parse(a.observed_at!) - Date.parse(b.observed_at!));
  // The trend covers the HISTORY_HOURS ending at the latest reading; anything fetched before that is margin.
  const latestAt = Date.parse(ordered.at(-1)!.observed_at!);
  const points = ordered.filter(r => latestAt - Date.parse(r.observed_at!) <= HISTORY_HOURS * 3600_000).map(r => ({ id: r.id, observed_at: r.observed_at!, value: r.normalized_value }));
  const first = points[0]; const last = points.at(-1);
  if (!first || !last || points.filter(p => p.value !== null).length < 2) return { ...unavailableTrend('At least two valid same-series measurements are required.', gauge), points };
  const hasGaps = points.some((p, i) => p.value === null || (i > 0 && Date.parse(p.observed_at) - Date.parse(points[i - 1]!.observed_at) > GAP_MS));
  const span = Date.parse(last.observed_at) - Date.parse(first.observed_at);
  const complete = !hasGaps && span >= (HISTORY_HOURS - 1) * 3600_000 && span <= (HISTORY_HOURS + 1) * 3600_000;
  const change = complete && first.value !== null && last.value !== null ? last.value - first.value : null;
  return { status: error || now - Date.parse(last.observed_at) > OBSERVATION_FRESH_MS ? 'stale' : 'current',
    parameter_code: '00060', time_series_id: gauge.series['00060'], unit: 'cfs', period_hours: HISTORY_HOURS, points,
    change, change_percent: change !== null && first.value !== null && first.value !== 0 ? change / first.value * 100 : null,
    has_gaps: hasGaps, complete, reason: error ?? (!complete ? `History has gaps or does not cover a full ${HISTORY_HOURS}-hour comparison.` : null),
    calculation_version: CALCULATION_VERSION, input_record_ids: points.map(p => p.id) };
}

export class UsgsAdapter {
  constructor(private client: SourceClient, private cache: SourceCache, readonly gauge: Gauge, private now: () => number = Date.now) {}

  async latest(): Promise<Snapshot<Observation[]>> {
    const { gauge } = this;
    return this.cache.get(`usgs-latest-${gauge.station_id}-v2`, 15 * 60_000, async () => {
      const metadata = await this.cache.get(`usgs-metadata-${gauge.station_id}-v2`, 24 * 3600_000, async () => {
        const [station, series] = await Promise.all([
          this.client.json(`${BASE}/monitoring-locations/items/${gauge.station_id}?f=json`),
          this.client.features(collectionUrl('time-series-metadata', { monitoring_location_id: gauge.station_id })),
        ]);
        validateStation(station, gauge);
        return validateMetadata(series, gauge);
      });
      if (!metadata.value || metadata.error) throw new SourceError(`USGS station and sensor metadata could not be revalidated. ${metadata.error ?? 'Metadata is unavailable.'}`);
      const features = await this.client.features(collectionUrl('latest-continuous', { monitoring_location_id: gauge.station_id }));
      const retrieved = new Date(this.now()).toISOString();
      return PARAMETERS.map(code => {
        const selected = features.filter(f => object(f.properties).time_series_id === gauge.series[code]);
        if (selected.length === 0) return missingObservation(code, 'The pinned sensor did not return a measurement.', gauge);
        if (selected.length !== 1) throw new SourceError('USGS returned multiple latest readings for one pinned series.');
        try { return parseObservation(selected[0]!, code, retrieved, this.now(), gauge); }
        catch (error) { return missingObservation(code, error instanceof SourceError ? error.message : 'Measurement validation failed.', gauge); }
      });
    });
  }

  async history(): Promise<Snapshot<Observation[]>> {
    const { gauge } = this;
    return this.cache.get(`usgs-history-flow-${gauge.station_id}-v2`, 15 * 60_000, async () => {
      const latest = await this.latest();
      if (!latest.value || latest.error) throw new SourceError('Continuous history awaits a validated source identity.');
      // Two extra hours so a 7-day comparison still has a reference reading when the latest reading lags the clock.
      const end = this.now();
      const features = await this.client.features(collectionUrl('continuous', {
        time_series_id: gauge.series['00060'], datetime: `${new Date(end - (HISTORY_HOURS + 2) * 3600_000).toISOString()}/${new Date(end).toISOString()}`,
      }));
      const retrieved = new Date(this.now()).toISOString();
      return features.map(feature => parseObservation(feature, '00060', retrieved, this.now(), gauge));
    });
  }

  /** Daily-mean flow for the last NORMAL_YEARS years; refreshed daily and retained for a week. */
  async daily(): Promise<Snapshot<DailyMean[]>> {
    const { gauge } = this;
    return this.cache.get(`usgs-daily-flow-${gauge.station_id}-v1`, 24 * 3600_000, async () => {
      const latest = await this.latest();
      if (!latest.value || latest.error) throw new SourceError('Daily history awaits a validated source identity.');
      const end = new Date(this.now());
      const start = new Date(Date.UTC(end.getUTCFullYear() - NORMAL_YEARS, end.getUTCMonth(), end.getUTCDate()));
      const url = `${BASE}/daily/items?${new URLSearchParams({ f: 'json', limit: '10000', time_series_id: gauge.daily_series,
        datetime: `${start.toISOString().slice(0, 10)}/${end.toISOString().slice(0, 10)}` })}`;
      const features = await this.client.features(url);
      return features.map(feature => parseDailyMean(feature, gauge)).filter((record): record is DailyMean => record !== null);
    }, 7 * 24 * 3600_000);
  }
}
