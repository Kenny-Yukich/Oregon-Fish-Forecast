import type { Conditions, DataStatus, Observation, SourceHealth } from '../shared/types';
import { SourceCache, type Snapshot } from './cache';
import { SourceClient, type Fetcher } from './net';
import { ALERT_FRESH_MS, GAUGE_POINT, NWS_URL, NwsAdapter, WEATHER_FRESH_MS, unavailableWeather, type WeatherPoint } from './nws';
import { OBSERVATION_FRESH_MS, PARAMETERS, STATION_URL, UsgsAdapter, buildTrend, missingObservation, unavailableTrend } from './usgs';

export const WATER_ID = 'lower-deschutes-warm-springs-trout-creek';
export interface Env {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  USGS_API_KEY?: string;
  ENVIRONMENT?: string;
  ENABLE_GAUGE_WEATHER?: string;
}

export function recommendationGate(regulations: Conditions['regulations_status'], access: Conditions['access_status']): Conditions['outlook'] {
  return { status: 'withheld', reasons: [
    regulations === 'closed' ? 'A verified closure blocks the affected fishing recommendation.' : regulations === 'not_verified' ? 'Current regulations have not been verified for this reach, species, and date.' : 'The planning interpretation has not been reviewed.',
    ...(access === 'not_verified' ? ['Access and exact reach boundaries still need review.'] : []),
  ], limitations: ['The Madras gauge is a candidate proxy; conditions can differ along this reach.',
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

export interface ServiceOptions { fetcher?: Fetcher; cache?: SourceCache; now?: () => number; apiKey?: string }
export class ConditionsService {
  private now: () => number;
  private usgs: UsgsAdapter;
  private nws: NwsAdapter;
  constructor(options: ServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    const client = new SourceClient(options.fetcher, options.apiKey, undefined, this.now);
    const cache = options.cache ?? new SourceCache(undefined, this.now);
    this.usgs = new UsgsAdapter(client, cache, this.now);
    this.nws = new NwsAdapter(client, cache, this.now);
  }

  async conditions(point: WeatherPoint | null = null): Promise<Conditions> {
    const [hydrology, history, forecast, alerts] = await Promise.all([
      this.usgs.latest(), this.usgs.history(),
      point ? this.nws.forecast(point) : Promise.resolve(null),
      point ? this.nws.alerts(point) : Promise.resolve(null),
    ]);
    const now = this.now();
    const observations = hydrology.value?.map(record => refreshObservation(record, now, hydrology.error)) ??
      PARAMETERS.map(code => missingObservation(code, hydrology.error ?? 'No validated reading is available.'));
    const usgsStatus: DataStatus = observations.some(r => r.quality_status === 'current') ? 'current' :
      observations.some(r => r.quality_status === 'stale') ? 'stale' : 'unavailable';
    let trend = unavailableTrend(history.error ?? 'No validated continuous history is available.');
    if (history.value) {
      try { trend = buildTrend(history.value, now, history.error); } catch { trend = unavailableTrend('Continuous history failed validation.'); }
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
      schema_version: '1.0', water_id: WATER_ID, reach_id: WATER_ID, target_species: 'trout', timezone: 'America/Los_Angeles',
      updated_at: new Date(now).toISOString(), mode: 'live', coverage_status: usgsStatus !== 'unavailable' || weather.status !== 'unavailable' ? 'partial' : 'unavailable',
      observations, trend, weather, alerts: activeAlerts, alerts_status: alertsStatus,
      source_health: [health('usgs', 'USGS Madras gauge', hydrology, usgsStatus, STATION_URL,
        'Station and sensor identity verified. Reach representation remains unreviewed.'),
      health('nws', 'NWS hourly forecast', forecast, weather.status, weather.source_url, weather.reason ?? 'Hourly forecast retrieved for the selected point.'),
      health('nws_alerts', 'NWS alerts', alerts, alertsStatus, 'https://www.weather.gov/alerts',
        point ? 'Official alerts retrieved; no alerts does not establish safe conditions.' : 'Local alerts await a reviewed weather point.')],
      regulations_status: 'not_verified', access_status: 'not_verified', restrictions: [],
      official_links: [
        { label: 'USGS Madras gauge', url: STATION_URL },
        { label: 'NWS weather and alerts', url: 'https://www.weather.gov/' },
        { label: 'ODFW Central Zone report', url: 'https://myodfw.com/recreation-report/fishing-report/central-zone' },
        { label: 'Oregon fishing regulations', url: 'https://myodfw.com/fishing/regulations' },
      ],
      outlook: recommendationGate('not_verified', 'not_verified'), suggested_windows: [], reviewed_techniques: [],
    };
  }
}

export function developmentPoint(request: Request, env: Env): WeatherPoint | null {
  const hostname = new URL(request.url).hostname;
  return env.ENVIRONMENT === 'development' && env.ENABLE_GAUGE_WEATHER === 'true' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? GAUGE_POINT : null;
}

let service: ConditionsService | undefined;
let configuredKey: string | undefined;
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname !== `/api/v1/conditions/${WATER_ID}`) return Response.json({ error: 'API route not found.' }, { status: 404 });
      if (request.method !== 'GET' && request.method !== 'HEAD') return Response.json({ error: 'Use GET.' }, { status: 405, headers: { Allow: 'GET, HEAD' } });
      if (!service || configuredKey !== env.USGS_API_KEY) {
        const persistent = typeof caches !== 'undefined' && 'default' in caches ? caches.default as unknown as import('./cache').CacheStorageLike : undefined;
        service = new ConditionsService({ apiKey: env.USGS_API_KEY, cache: new SourceCache(persistent) });
        configuredKey = env.USGS_API_KEY;
      }
      const data = await service.conditions(developmentPoint(request, env));
      return new Response(request.method === 'HEAD' ? null : JSON.stringify(data), { headers: {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      } });
    }
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Static assets are not built yet.', { status: 503 });
  },
};
