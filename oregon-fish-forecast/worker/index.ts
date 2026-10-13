import type { Board, BoardChange, BoardReading, BoardRow, Conditions, DataStatus, HistoryPoint, Observation, Parameter, SourceHealth } from '../shared/types';
import { WATERS, findWater, type Gauge, type Water } from '../shared/waters';
import { SourceCache, type Snapshot } from './cache';
import { SourceClient, type Fetcher } from './net';
import { ALERT_FRESH_MS, NWS_URL, NwsAdapter, WEATHER_FRESH_MS, gaugePoint, unavailableWeather, type WeatherPoint } from './nws';
import { HISTORY_HOURS, OBSERVATION_FRESH_MS, PARAMETERS, SERIES, UsgsAdapter, buildTrend, missingObservation, normalFor, unavailableTrend } from './usgs';
import { scoreWater } from './score';

export const WATER_ID = WATERS[0]!.id;
export const CHANGE_HOURS = [1, 24, 168];
// A comparison reading must sit this close to the target time: a quarter of the window, capped at 45 minutes.
// 15-minute sensors leave at most a 7.5-minute offset, so this only matters when readings are missing.
const changeTolerance = (hours: number) => Math.min(45, hours * 15) * 60_000;
export interface Env {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  USGS_API_KEY?: string;
  ENVIRONMENT?: string;
  ENABLE_GAUGE_WEATHER?: string;
}

export function recommendationGate(regulations: Conditions['regulations_status'], access: Conditions['access_status'], gaugeLabel = 'gauge'): Conditions['outlook'] {
  return { status: 'withheld', reasons: [
    regulations === 'closed' ? 'A verified closure blocks the affected fishing recommendation.' : regulations === 'not_verified' ? 'Current regulations have not been verified for this reach, species, and date.' : 'The planning interpretation has not been reviewed.',
    ...(access === 'not_verified' ? ['Access and exact reach boundaries still need review.'] : []),
  ], limitations: [`The ${gaugeLabel} is a candidate proxy; conditions can differ along this reach.`,
    'No reviewed technique or fishing window is available. An absence of alerts does not establish safe access or wading.'],
    model_version: 'conditions-only-v1' };
}

export function refreshObservation(record: Observation, now: number, refreshError: string | null): Observation {
  const invalid = record.normalized_value === null || !record.observed_at || Date.parse(record.observed_at) > now;
  return { ...record, quality_status: invalid ? 'unavailable' : refreshError || now - Date.parse(record.observed_at!) > OBSERVATION_FRESH_MS ? 'stale' : 'current',
    issues: refreshError ? [...record.issues, 'Refresh failed; retained measurement timestamps are unchanged.'] : record.issues };
}

function health<T>(sourceId: SourceHealth['source_id'], label: string, snapshot: Snapshot<T> | null, status: DataStatus, url: string, message: string): SourceHealth {
  return { source_id: sourceId, label, status, retrieved_at: snapshot?.retrieved_at ?? null,
    last_attempt_at: snapshot?.last_attempt_at ?? null, from_cache: snapshot?.from_cache ?? false,
    message: snapshot?.error ?? message, source_url: url };
}

function validHistory(records: Observation[]): HistoryPoint[] {
  const unique = new Map<string, HistoryPoint>();
  for (const r of records) if (r.observed_at && r.normalized_value !== null) unique.set(r.observed_at, { id: r.id, observed_at: r.observed_at, value: r.normalized_value });
  return [...unique.values()].sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
}

/** Compares the latest valid reading with the valid reading nearest to N hours earlier; a missing reference stays missing. */
export function changeOver(hours: number, points: HistoryPoint[]): BoardChange {
  const latest = points.at(-1);
  if (!latest || latest.value === null) return { hours, absolute: null, percent: null, from_observed_at: null, reason: 'No valid latest reading.' };
  const target = Date.parse(latest.observed_at) - hours * 3600_000;
  let reference: HistoryPoint | null = null;
  for (const point of points) {
    const distance = Math.abs(Date.parse(point.observed_at) - target);
    if (distance <= changeTolerance(hours) && (!reference || distance < Math.abs(Date.parse(reference.observed_at) - target))) reference = point;
  }
  if (!reference || reference.value === null) return { hours, absolute: null, percent: null, from_observed_at: null, reason: `No valid reading about ${hours} hours before the latest one.` };
  const absolute = latest.value - reference.value;
  return { hours, absolute, percent: reference.value === 0 ? null : absolute / reference.value * 100, from_observed_at: reference.observed_at, reason: null };
}

/** One point per hour ending at the latest reading (the last reading in each hour); hours without a valid reading are null so the line breaks. */
export function sparkline(points: HistoryPoint[], hours = HISTORY_HOURS): HistoryPoint[] {
  const latest = points.at(-1);
  if (!latest) return [];
  const end = Date.parse(latest.observed_at);
  const buckets = new Map<number, HistoryPoint>();
  for (const point of points) {
    const bucket = Math.floor((end - Date.parse(point.observed_at)) / 3600_000);
    if (bucket >= 0 && bucket < hours) buckets.set(bucket, point);
  }
  return Array.from({ length: hours }, (_, i) => {
    const bucket = hours - 1 - i;
    const point = buckets.get(bucket);
    return point ?? { id: `empty-${bucket}`, observed_at: new Date(end - bucket * 3600_000).toISOString(), value: null };
  });
}

function reading(observations: Observation[], code: Parameter): BoardReading {
  const obs = observations.find(o => o.parameter_code === code);
  return { value: obs?.normalized_value ?? null, unit: SERIES[code].display, observed_at: obs?.normalized_value === null ? null : obs?.observed_at ?? null, status: obs?.quality_status ?? 'unavailable' };
}

export interface ServiceOptions { fetcher?: Fetcher; cache?: SourceCache; now?: () => number; apiKey?: string; waters?: Water[] }
export class ConditionsService {
  private now: () => number;
  private usgs = new Map<string, UsgsAdapter>();
  private nws: NwsAdapter;
  readonly waters: Water[];
  constructor(options: ServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.waters = options.waters ?? WATERS;
    const client = new SourceClient(options.fetcher, options.apiKey, undefined, this.now);
    const cache = options.cache ?? new SourceCache(undefined, this.now);
    for (const water of this.waters) this.usgs.set(water.id, new UsgsAdapter(client, cache, water.gauge, this.now));
    this.nws = new NwsAdapter(client, cache, this.now);
  }

  private adapter(waterId: string): UsgsAdapter {
    const adapter = this.usgs.get(waterId);
    if (!adapter) throw new Error(`Unknown water: ${waterId}`);
    return adapter;
  }

  private observations(hydrology: Snapshot<Observation[]>, gauge: Gauge, now: number): Observation[] {
    return hydrology.value?.map(record => refreshObservation(record, now, hydrology.error)) ??
      PARAMETERS.map(code => missingObservation(code, hydrology.error ?? 'No validated reading is available.', gauge));
  }

  async board(): Promise<Board> {
    const rows = await Promise.all(this.waters.map(async (water): Promise<BoardRow> => {
      const adapter = this.adapter(water.id);
      const [hydrology, history, daily] = await Promise.all([adapter.latest(), adapter.history(), adapter.daily()]);
      const now = this.now();
      const observations = this.observations(hydrology, water.gauge, now);
      const flow = reading(observations, '00060');
      const normal = normalFor(daily, observations.find(o => o.parameter_code === '00060'), now, water.gauge);
      const points = validHistory((history.value ?? []).filter(r => r.time_series_id === water.gauge.series['00060']));
      const historyError = history.error ?? (history.value ? null : 'No continuous history is available.');
      const changes = CHANGE_HOURS.map(hours => historyError ? { hours, absolute: null, percent: null, from_observed_at: null, reason: historyError } : changeOver(hours, points));
      const score = scoreWater(water.id, { normal, temperature: observations.find(o => o.parameter_code === '00010'), change: changes.find(c => c.hours === 24) }, now);
      return { water_id: water.id, name: water.name, reach: water.reach, gauge_label: water.gauge.label, station_id: water.gauge.station_id,
        source_url: water.gauge.url, mapping_status: 'candidate_proxy', status: flow.status, retrieved_at: hydrology.retrieved_at,
        message: hydrology.error ?? (hydrology.from_cache ? 'Retained snapshot; original measurement times are shown.' : 'Station and sensor identity verified. Reach representation remains unreviewed.'),
        flow, height: reading(observations, '00065'), temperature: reading(observations, '00010'), normal, score,
        changes, sparkline: sparkline(points) };
    }));
    return { schema_version: '1.0', timezone: 'America/Los_Angeles', updated_at: new Date(this.now()).toISOString(), rows };
  }

  async conditions(waterId: string = WATER_ID, point: WeatherPoint | null = null): Promise<Conditions> {
    const water = this.waters.find(w => w.id === waterId);
    if (!water) throw new Error(`Unknown water: ${waterId}`);
    const adapter = this.adapter(water.id);
    const [hydrology, history, daily, forecast, alerts] = await Promise.all([
      adapter.latest(), adapter.history(), adapter.daily(),
      point ? this.nws.forecast(point) : Promise.resolve(null),
      point ? this.nws.alerts(point) : Promise.resolve(null),
    ]);
    const now = this.now();
    const observations = this.observations(hydrology, water.gauge, now);
    const normal = normalFor(daily, observations.find(o => o.parameter_code === '00060'), now, water.gauge);
    const score = scoreWater(water.id, { normal, temperature: observations.find(o => o.parameter_code === '00010'),
      change: history.value ? changeOver(24, validHistory(history.value.filter(r => r.time_series_id === water.gauge.series['00060']))) : undefined }, now);
    const usgsStatus: DataStatus = observations.some(r => r.quality_status === 'current') ? 'current' :
      observations.some(r => r.quality_status === 'stale') ? 'stale' : 'unavailable';
    let trend = unavailableTrend(history.error ?? 'No validated continuous history is available.', water.gauge);
    if (history.value) {
      try { trend = buildTrend(history.value, now, history.error, water.gauge); } catch { trend = unavailableTrend('Continuous history failed validation.', water.gauge); }
    }
    let weather = unavailableWeather();
    if (point) weather = { ...weather, point_status: point.status, point_label: point.label, reason: forecast?.error ?? 'Hourly weather is unavailable.' };
    if (forecast?.value) {
      const periods = forecast.value.periods.filter(p => Date.parse(p.end_at) > now);
      weather = { ...forecast.value, periods, status: !periods.length ? 'unavailable' : forecast.error ||
        now - Date.parse(forecast.value.issued_at!) > WEATHER_FRESH_MS ? 'stale' : 'current',
        reason: forecast.error ?? forecast.value.reason };
    }
    const alertsStatus: DataStatus = !alerts?.value ? 'unavailable' : alerts.error || !alerts.retrieved_at ||
      now - Date.parse(alerts.retrieved_at) > ALERT_FRESH_MS ? 'stale' : 'current';
    const activeAlerts = alerts?.value?.filter(a => a.expires_at && Date.parse(a.expires_at) > now) ?? [];
    return {
      schema_version: '1.0', water_id: water.id, reach_id: water.id, target_species: 'trout', timezone: 'America/Los_Angeles',
      updated_at: new Date(now).toISOString(), mode: 'live', coverage_status: usgsStatus !== 'unavailable' || weather.status !== 'unavailable' ? 'partial' : 'unavailable',
      observations, trend, normal, score, weather, alerts: activeAlerts, alerts_status: alertsStatus,
      source_health: [health('usgs', `USGS ${water.gauge.label}`, hydrology, usgsStatus, water.gauge.url,
        'Station and sensor identity verified. Reach representation remains unreviewed.'),
      health('nws', 'NWS hourly forecast', forecast, weather.status, weather.source_url, weather.reason ?? 'Hourly forecast retrieved for the selected point.'),
      health('nws_alerts', 'NWS alerts', alerts, alertsStatus, 'https://www.weather.gov/alerts',
        point ? 'Official alerts retrieved; no alerts does not establish safe conditions.' : 'Local alerts await a reviewed weather point.')],
      regulations_status: 'not_verified', access_status: 'not_verified', restrictions: [],
      official_links: [
        { label: `USGS ${water.gauge.label}`, url: water.gauge.url },
        { label: 'NWS weather and alerts', url: NWS_URL },
        { label: 'ODFW Central Zone report', url: 'https://myodfw.com/recreation-report/fishing-report/central-zone' },
        { label: 'Oregon fishing regulations', url: 'https://myodfw.com/fishing/regulations' },
      ],
      outlook: recommendationGate('not_verified', 'not_verified', water.gauge.label), suggested_windows: [], reviewed_techniques: [],
    };
  }
}

export function developmentPoint(request: Request, env: Env, gauge: Gauge = WATERS[0]!.gauge): WeatherPoint | null {
  const hostname = new URL(request.url).hostname;
  return env.ENVIRONMENT === 'development' && env.ENABLE_GAUGE_WEATHER === 'true' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? gaugePoint(gauge) : null;
}

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
let service: ConditionsService | undefined;
let configuredKey: string | undefined;
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const conditionsMatch = /^\/api\/v1\/conditions\/([a-z0-9-]+)$/.exec(url.pathname);
      const water = conditionsMatch ? findWater(conditionsMatch[1]!) : null;
      if (url.pathname !== '/api/v1/board' && !water) return Response.json({ error: 'API route not found.' }, { status: 404 });
      if (request.method !== 'GET' && request.method !== 'HEAD') return Response.json({ error: 'Use GET.' }, { status: 405, headers: { Allow: 'GET, HEAD' } });
      if (!service || configuredKey !== env.USGS_API_KEY) {
        const persistent = typeof caches !== 'undefined' && 'default' in caches ? caches.default as unknown as import('./cache').CacheStorageLike : undefined;
        service = new ConditionsService({ apiKey: env.USGS_API_KEY, cache: new SourceCache(persistent) });
        configuredKey = env.USGS_API_KEY;
      }
      const data = water ? await service.conditions(water.id, developmentPoint(request, env, water.gauge)) : await service.board();
      return new Response(request.method === 'HEAD' ? null : JSON.stringify(data), { headers: JSON_HEADERS });
    }
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Static assets are not built yet.', { status: 503 });
  },
};
