import type { OfficialAlert, Weather, WeatherPeriod } from '../shared/types';
import { SourceCache, type Snapshot } from './cache';
import { SourceClient, SourceError, numeric, object, safeUrl, timestamp, type Json } from './net';

export interface WeatherPoint { latitude: number; longitude: number; label: string; status: 'reviewed' | 'gauge_smoke_test' }
export const GAUGE_POINT: WeatherPoint = { latitude: 44.7259522504172, longitude: -121.246993886344,
  label: 'USGS gauge location · development smoke test only', status: 'gauge_smoke_test' };
export const NWS_URL = 'https://www.weather.gov/documentation/services-web-api';
export const WEATHER_FRESH_MS = 6 * 3600_000;
export const ALERT_FRESH_MS = 5 * 60_000;

function pointQuery(point: WeatherPoint): string { return `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`; }
function text(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }

export function unavailableWeather(reason = 'A representative weather point has not been reviewed.'): Weather {
  return { status: 'unavailable', issued_at: null, retrieved_at: null, source_url: NWS_URL, point_status: 'not_reviewed',
    point_label: 'Reach weather point awaiting review', periods: [], reason };
}

export function parseForecast(data: Json, sourceUrl: string, point: WeatherPoint, now: number): Weather {
  const p = object(data.properties);
  const issued = timestamp(p.updateTime ?? p.updated);
  if (Date.parse(issued) > now) throw new SourceError('NWS forecast issue time is in the future.');
  if (!Array.isArray(p.periods) || !p.periods.length) throw new SourceError('NWS hourly forecast has no periods.');
  const periods: WeatherPeriod[] = p.periods.map(raw => {
    const period = object(raw);
    const start = timestamp(period.startTime); const end = timestamp(period.endTime);
    if (Date.parse(end) <= Date.parse(start)) throw new SourceError('NWS forecast period has an invalid interval.');
    let temperature = numeric(period.temperature);
    let unit = typeof period.temperatureUnit === 'string' ? period.temperatureUnit : null;
    if (period.temperature !== null && typeof period.temperature === 'object') {
      const qv = object(period.temperature); temperature = numeric(qv.value);
      unit = qv.unitCode === 'wmoUnit:degC' ? 'C' : qv.unitCode === 'wmoUnit:degF' ? 'F' : null;
    }
    if (unit !== 'F' && unit !== 'C') { temperature = null; unit = null; }
    const precipitation = period.probabilityOfPrecipitation ? object(period.probabilityOfPrecipitation) : null;
    let probability = precipitation?.unitCode === 'wmoUnit:percent' ? numeric(precipitation.value) : null;
    if (probability !== null && (probability < 0 || probability > 100)) probability = null;
    return { start_at: start, end_at: end, temperature, temperature_unit: unit, precipitation_probability: probability,
      wind_speed: typeof period.windSpeed === 'string' ? period.windSpeed : null,
      wind_direction: typeof period.windDirection === 'string' ? period.windDirection : null,
      short_forecast: text(period.shortForecast, 'Forecast text unavailable'), is_daytime: period.isDaytime === true };
  }).sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  for (let i = 1; i < periods.length; i++) {
    if (Date.parse(periods[i]!.start_at) < Date.parse(periods[i - 1]!.end_at)) throw new SourceError('NWS forecast periods overlap.');
  }
  const future = periods.filter(period => Date.parse(period.end_at) > now);
  if (!future.length) throw new SourceError('NWS forecast contains no valid future periods.');
  return { status: now - Date.parse(issued) > WEATHER_FRESH_MS ? 'stale' : 'current', issued_at: issued,
    retrieved_at: new Date(now).toISOString(), source_url: safeUrl(sourceUrl, 'api.weather.gov'),
    point_status: point.status, point_label: point.label, periods: future,
    reason: point.status === 'gauge_smoke_test' ? 'Gauge-coordinate test forecast; this is not an approved reach weather point.' : null };
}

export function parseAlerts(features: Json[], now: number): OfficialAlert[] {
  return features.flatMap(feature => {
    const p = object(feature.properties);
    if (p.status !== 'Actual' || p.messageType === 'Cancel') return [];
    const effective = timestamp(p.effective); const expires = timestamp(p.expires);
    if (Date.parse(expires) <= Date.parse(effective)) throw new SourceError('NWS alert validity interval is invalid.');
    if (Date.parse(expires) <= now) return [];
    const id = text(feature.id, text(p.id));
    if (!id || typeof p.event !== 'string' || typeof p.severity !== 'string') throw new SourceError('NWS alert identity is incomplete.');
    const sourceUrl = safeUrl(id, 'api.weather.gov');
    return [{ id, event: p.event, headline: text(p.headline, p.event), severity: p.severity,
      effective_at: effective, expires_at: expires, source_url: sourceUrl }];
  });
}

export class NwsAdapter {
  constructor(private client: SourceClient, private cache: SourceCache, private now: () => number = Date.now) {}
  async forecast(point: WeatherPoint): Promise<Snapshot<Weather>> {
    const query = pointQuery(point);
    return this.cache.get(`nws-hourly-${point.status}-${query}`, 30 * 60_000, async () => {
      const mapping = await this.cache.get(`nws-point-${query}`, 24 * 3600_000, async () => {
        const data = await this.client.json(`https://api.weather.gov/points/${query}`);
        const properties = object(data.properties); const geometry = object(data.geometry);
        const coordinates = geometry.coordinates;
        if (geometry.type !== 'Point' || !Array.isArray(coordinates) || !Number.isFinite(Number(coordinates[0])) ||
          !Number.isFinite(Number(coordinates[1])) || Math.abs(Number(coordinates[0]) - point.longitude) > 0.001 ||
          Math.abs(Number(coordinates[1]) - point.latitude) > 0.001 || typeof properties.forecastHourly !== 'string') {
          throw new SourceError('NWS point coordinates or hourly mapping do not match the requested location.');
        }
        const hourly = safeUrl(properties.forecastHourly, 'api.weather.gov');
        if (!/^\/gridpoints\/[A-Z]{3}\/\d+,\d+\/forecast\/hourly$/.test(new URL(hourly).pathname)) throw new SourceError('NWS returned an unexpected hourly grid endpoint.');
        return hourly;
      });
      if (!mapping.value || mapping.error) throw new SourceError('NWS point mapping could not be revalidated.');
      return parseForecast(await this.client.json(mapping.value), mapping.value, point, this.now());
    }, 24 * 3600_000);
  }
  async alerts(point: WeatherPoint): Promise<Snapshot<OfficialAlert[]>> {
    const query = pointQuery(point);
    return this.cache.get(`nws-alerts-${point.status}-${query}`, 2 * 60_000, async () => {
      const features = await this.client.features(`https://api.weather.gov/alerts/active?point=${query}`);
      return parseAlerts(features, this.now());
    }, 24 * 3600_000);
  }
}
