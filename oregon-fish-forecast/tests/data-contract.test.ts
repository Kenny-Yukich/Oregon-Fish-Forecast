import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceClient, SourceError, numeric, safeUrl, timestamp } from '../worker/net';
import { SourceCache } from '../worker/cache';
import { SERIES, STATION, buildTrend, parseObservation, validateMetadata, validateStation } from '../worker/usgs';
import { ConditionsService, developmentPoint, recommendationGate, refreshObservation } from '../worker/index';
import { GAUGE_POINT, parseAlerts, parseForecast } from '../worker/nws';

const NOW = Date.parse('2026-10-07T13:00:00Z');
const ISO = new Date(NOW).toISOString();
const station = { id: STATION, properties: { id: STATION, agency_code: 'USGS', monitoring_location_number: '14092500',
  monitoring_location_name: 'DESCHUTES RIVER NEAR MADRAS, OR' }, geometry: { type: 'Point', coordinates: [-121.246993886344, 44.7259522504172] } };
const metadata = Object.entries(SERIES).map(([code, series]) => ({ id: series.id, properties: { id: series.id,
  monitoring_location_id: STATION, parameter_code: code, unit_of_measure: series.unit, statistic_id: '00011', primary: 'Primary',
  computation_period_identifier: 'Points', computation_identifier: 'Instantaneous', begin: '2007-10-01T08:00:00Z', end: ISO } }));
function reading(overrides: Record<string, unknown> = {}, time = ISO) {
  return { id: `record-${time}`, properties: { time_series_id: SERIES['00060'].id, monitoring_location_id: STATION,
    parameter_code: '00060', statistic_id: '00011', time, value: '3600', unit_of_measure: 'ft^3/s',
    approval_status: 'Provisional', qualifier: null, ...overrides } };
}
function json(value: unknown, headers?: Record<string, string>) { return new Response(JSON.stringify(value), { headers }); }
function hourlyData() {
  return { properties: { updateTime: ISO, periods: [{ startTime: ISO, endTime: '2026-10-07T14:00:00Z',
    temperature: 58, temperatureUnit: 'F', probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 0 },
    windSpeed: '5 mph', windDirection: 'W', shortForecast: 'Sunny', isDaytime: true }] } };
}
const HOURLY_URL = 'https://api.weather.gov/gridpoints/PDT/30,40/forecast/hourly';

test('strict numbers distinguish zero, missing, boolean, censored and nonfinite', () => {
  assert.equal(numeric('0'), 0); assert.equal(numeric('-0.5'), -0.5);
  for (const value of ['', null, false, 'NaN', 'Infinity', '<5', '0x10']) assert.equal(numeric(value), null);
});
test('timestamps require explicit timezone and calendar-valid dates', () => {
  assert.equal(timestamp('2026-10-07T06:00:00-07:00'), ISO);
  for (const value of ['2026-10-07', '2026-10-07T13:00:00', '2026-02-30T13:00:00Z', '2026-13-07T13:00:00Z', '2026-10-07T24:00:00Z']) assert.throws(() => timestamp(value));
});
test('URL guard prevents credential escape and unexpected origin', () => {
  for (const url of ['http://api.waterdata.usgs.gov/a', 'https://api.waterdata.usgs.gov.evil.test/a',
    'https://user:pass@api.waterdata.usgs.gov/a', 'https://api.waterdata.usgs.gov:444/a']) assert.throws(() => safeUrl(url));
  assert.throws(() => safeUrl('https://api.weather.gov/a', 'api.waterdata.usgs.gov'));
});
test('station metadata rejects mismatches and nonnumeric coordinates', () => {
  validateStation(station); validateMetadata(metadata);
  assert.throws(() => validateStation({ ...station, id: 'USGS-14076500' }));
  assert.throws(() => validateStation({ ...station, geometry: { type: 'Point', coordinates: ['bad', null] } }));
  const wrong = structuredClone(metadata); wrong[0]!.properties.statistic_id = '00003';
  assert.throws(() => validateMetadata(wrong));
});
test('observation preserves provenance, approval and original unit', () => {
  const record = parseObservation(reading(), '00060', ISO, NOW);
  assert.equal(record.normalized_value, 3600); assert.equal(record.raw_value, '3600');
  assert.equal(record.raw_unit, 'ft^3/s'); assert.equal(record.approval_status, 'Provisional');
  assert.equal(record.mapping_status, 'candidate_proxy'); assert.equal(record.quality_status, 'current');
});
test('mismatched station, series or statistic cannot become a valid observation', () => {
  for (const override of [{ monitoring_location_id: 'USGS-14076500' }, { time_series_id: 'other' }, { statistic_id: '00003' }]) {
    assert.throws(() => parseObservation(reading(override), '00060', ISO, NOW));
  }
});
test('unknown units and qualifiers withhold normalized values while retaining raw evidence', () => {
  const qualified = parseObservation(reading({ qualifier: 'Ice' }), '00060', ISO, NOW);
  assert.deepEqual(qualified.qualifiers, ['Ice']); assert.equal(qualified.normalized_value, null);
  const wrongUnit = parseObservation(reading({ unit_of_measure: 'm' }), '00060', ISO, NOW);
  assert.equal(wrongUnit.quality_status, 'unavailable'); assert.equal(wrongUnit.raw_value, '3600');
});
test('parameter semantics preserve zero flow and negative stage; temperature converts from water sensor only', () => {
  assert.equal(parseObservation(reading({ value: '0' }), '00060', ISO, NOW).normalized_value, 0);
  assert.equal(parseObservation(reading({ value: '-1' }), '00060', ISO, NOW).normalized_value, null);
  const stage = parseObservation(reading({ value: '-0.2', parameter_code: '00065', time_series_id: SERIES['00065'].id, unit_of_measure: 'ft' }), '00065', ISO, NOW);
  assert.equal(stage.normalized_value, -0.2);
  const temp = parseObservation(reading({ value: '10', parameter_code: '00010', time_series_id: SERIES['00010'].id, unit_of_measure: 'degC' }), '00010', ISO, NOW);
  assert.equal(temp.normalized_value, 50);
});
test('freshness derives from observation time and is re-evaluated on cache reads', () => {
  const record = parseObservation(reading(), '00060', ISO, NOW);
  const aged = refreshObservation(record, NOW + 3 * 3600_000, null);
  assert.equal(aged.quality_status, 'stale'); assert.equal(aged.retrieved_at, ISO); assert.equal(aged.observed_at, ISO);
  assert.equal(parseObservation(reading({}, '2026-10-07T13:01:00Z'), '00060', ISO, NOW).quality_status, 'unavailable');
});
test('trend requires same sensor and adequate history, never draws a fabricated change across gaps', () => {
  const points = Array.from({ length: 289 }, (_, i) => parseObservation(reading({ value: String(3500 + i) }, new Date(NOW - 72 * 3600_000 + i * 15 * 60_000).toISOString()), '00060', ISO, NOW));
  const complete = buildTrend(points, NOW);
  assert.equal(complete.complete, true); assert.equal(complete.change, 288); assert.equal(complete.input_record_ids.length, 289);
  const gap = buildTrend(points.filter((_, i) => i < 20 || i > 30), NOW);
  assert.equal(gap.has_gaps, true); assert.equal(gap.change, null);
  assert.equal(buildTrend(points.slice(0, 1), NOW).status, 'unavailable');
  assert.equal(buildTrend(points.slice(0, 2).map(p => ({ ...p, normalized_value: null })), NOW).status, 'unavailable');
  assert.throws(() => buildTrend([{ ...points[0]!, time_series_id: 'other' }, points[1]!], NOW));
});
test('cache coalesces concurrent requests and keeps original timestamps on refresh failure', async () => {
  let clock = NOW; let calls = 0;
  const cache = new SourceCache(undefined, () => clock);
  const loader = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return { observed_at: ISO }; };
  await Promise.all(Array.from({ length: 8 }, () => cache.get('test', 1000, loader)));
  assert.equal(calls, 1); clock += 2000;
  const stale = await cache.get('test', 1000, async () => { calls++; throw new SourceError('Offline'); });
  assert.equal(stale.retrieved_at, ISO); assert.equal(stale.value?.observed_at, ISO); assert.equal(stale.error, 'Offline');
  await cache.get('test', 1000, loader); assert.equal(calls, 2);
});
test('negative cache also suppresses repeated first-request outages', async () => {
  const cache = new SourceCache(undefined, () => NOW); let calls = 0;
  const fail = async () => { calls++; throw new SourceError('Offline'); };
  await cache.get('empty', 1000, fail); const second = await cache.get('empty', 1000, fail);
  assert.equal(calls, 1); assert.equal(second.value, null); assert.equal(second.retrieved_at, null);
});
test('cache retention has an upper bound', async () => {
  let clock = NOW; const cache = new SourceCache(undefined, () => clock);
  await cache.get('small', 10, async () => 42, 20); clock += 21;
  const result = await cache.get('small', 10, async () => { throw new SourceError('Offline'); }, 20);
  assert.equal(result.value, null); assert.equal(result.retrieved_at, null);
});
test('pagination follows same-host next links and rejects foreign redirects before sending a key', async () => {
  const requests: { url: string; key: string | null }[] = [];
  const client = new SourceClient(async (input, init) => {
    const url = String(input); requests.push({ url, key: new Headers(init?.headers).get('X-Api-Key') });
    return json({ features: [{ id: requests.length }], links: requests.length === 1 ? [{ rel: 'next', href: 'https://api.waterdata.usgs.gov/next' }] : [] });
  }, 'test-key');
  assert.equal((await client.features('https://api.waterdata.usgs.gov/start')).length, 2);
  assert.deepEqual(requests.map(r => r.key), ['test-key', 'test-key']);
  let count = 0;
  const bad = new SourceClient(async () => { count++; return new Response(null, { status: 302, headers: { Location: 'https://evil.test/' } }); }, 'test-key');
  await assert.rejects(() => bad.json('https://api.waterdata.usgs.gov/start')); assert.equal(count, 1);
});
test('pagination limit cannot silently produce complete history', async () => {
  const client = new SourceClient(async () => json({ features: [], links: [{ rel: 'next', href: 'https://api.waterdata.usgs.gov/start' }] }));
  await assert.rejects(() => client.features('https://api.waterdata.usgs.gov/start'), /pagination/);
});
test('malformed advertised continuation cannot silently truncate a series', async () => {
  for (const paging of [{ links: {} }, { pagination: { next: 42 } }, { pagination: { next: '' } }, { links: [{ rel: 'next', href: 42 }] }]) {
    const client = new SourceClient(async () => json({ features: [], ...paging }));
    await assert.rejects(() => client.features('https://api.waterdata.usgs.gov/start'), /pagination/);
  }
});
test('USGS key is never attached to NWS requests', async () => {
  const client = new SourceClient(async (_input, init) => { assert.equal(new Headers(init?.headers).get('X-Api-Key'), null); return json({}); }, 'test-key');
  await client.json('https://api.weather.gov/points/44,-121');
});
test('default native fetch is invoked without a SourceClient receiver', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async function (this: unknown) {
    // workerd enforces the native Fetch receiver; undici in Node does not.
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    return json({ validated: true });
  };
  try { assert.deepEqual(await new SourceClient().json('https://api.weather.gov/alerts/active'), { validated: true }); }
  finally { globalThis.fetch = original; }
});
test('long Retry-After and exhausted rate budget stop immediate retries', async () => {
  for (const headers of [{ 'Retry-After': '120' }, { 'RateLimit-Remaining': '0', 'RateLimit-Reset': '120' }]) {
    let calls = 0;
    const client = new SourceClient(async () => { calls++; return new Response('', { status: 429, headers }); }, undefined, undefined, () => NOW, async () => {});
    await assert.rejects(() => client.json('https://api.weather.gov/alerts/active'));
    assert.equal(calls, 1);
  }
});
test('forecast issue time and period validity are separate and precipitation zero is retained', () => {
  const weather = parseForecast(hourlyData(), HOURLY_URL, GAUGE_POINT, NOW);
  assert.equal(weather.issued_at, ISO); assert.equal(weather.periods[0]!.precipitation_probability, 0);
  assert.equal(weather.point_status, 'gauge_smoke_test');
  const bad = hourlyData(); bad.properties.periods[0]!.endTime = ISO;
  assert.throws(() => parseForecast(bad, HOURLY_URL, GAUGE_POINT, NOW));
});
test('NWS alerts discard expired/cancelled messages and preserve active validity', () => {
  const alert = { id: 'https://api.weather.gov/alerts/test', properties: { status: 'Actual', messageType: 'Alert',
    event: 'Flood Warning', headline: 'Test warning', severity: 'Severe', effective: ISO, expires: '2026-10-07T14:00:00Z' } };
  assert.equal(parseAlerts([alert], NOW).length, 1);
  assert.equal(parseAlerts([alert], NOW + 2 * 3600_000).length, 0);
  assert.equal(parseAlerts([{ ...alert, properties: { ...alert.properties, messageType: 'Cancel' } }], NOW).length, 0);
});
test('gauge weather opt-in is restricted to explicit local development', () => {
  const env = { ENVIRONMENT: 'development', ENABLE_GAUGE_WEATHER: 'true' };
  assert.equal(developmentPoint(new Request('http://localhost/api'), env)?.status, 'gauge_smoke_test');
  assert.equal(developmentPoint(new Request('https://oregonfishforecast.com/api'), env), null);
  assert.equal(developmentPoint(new Request('http://localhost/api'), { ...env, ENVIRONMENT: 'production' }), null);
});
test('unknown rules and verified closure both prevent recommendations', () => {
  assert.equal(recommendationGate('not_verified', 'not_verified').status, 'withheld');
  assert.match(recommendationGate('closed', 'verified').reasons[0]!, /closure/);
  assert.equal(recommendationGate('open', 'verified').status, 'withheld');
});
test('provider outages are independent and no public NWS calls occur without a reviewed point', async () => {
  const urls: string[] = [];
  const fetcher = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input); urls.push(url);
    if (url.includes('/monitoring-locations/')) return json(station);
    if (url.includes('/time-series-metadata/')) return json({ features: metadata });
    if (url.includes('/latest-continuous/')) return json({ features: [reading()] });
    if (url.includes('/continuous/')) return json({ features: [reading({}, '2026-10-07T12:45:00Z'), reading()] });
    if (url.includes('/points/')) return json({ geometry: { type: 'Point', coordinates: [-121.247, 44.726] }, properties: { forecastHourly: HOURLY_URL } });
    if (url.includes('/forecast/hourly')) return json(hourlyData());
    return new Response('', { status: 403 });
  };
  const service = new ConditionsService({ fetcher, now: () => NOW });
  const publicData = await service.conditions();
  assert.equal(publicData.observations[0]!.normalized_value, 3600);
  assert.equal(publicData.weather.status, 'unavailable'); assert.equal(urls.some(url => url.includes('weather.gov')), false);
  const devData = await service.conditions(GAUGE_POINT);
  assert.equal(devData.weather.status, 'current'); assert.equal(devData.alerts_status, 'unavailable');
  assert.equal(devData.observations[0]!.quality_status, 'current'); assert.equal(devData.suggested_windows.length, 0);
  assert.equal(urls.filter(url => url.includes('/latest-continuous/')).length, 1);
});
test('USGS outage leaves independently validated NWS forecast and alerts available', async () => {
  const fetcher = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    if (url.includes('waterdata.usgs.gov')) return new Response('', { status: 403 });
    if (url.includes('/points/')) return json({ geometry: { type: 'Point', coordinates: [-121.247, 44.726] }, properties: { forecastHourly: HOURLY_URL } });
    if (url.includes('/forecast/hourly')) return json(hourlyData());
    if (url.includes('/alerts/active')) return json({ features: [{ id: 'https://api.weather.gov/alerts/test', properties: {
      status: 'Actual', messageType: 'Alert', event: 'Flood Warning', headline: 'Test warning', severity: 'Severe',
      effective: ISO, expires: '2026-10-07T14:00:00Z',
    } }] });
    throw new Error('Unexpected test request');
  };
  const data = await new ConditionsService({ fetcher, now: () => NOW }).conditions(GAUGE_POINT);
  assert.ok(data.observations.every(r => r.quality_status === 'unavailable'));
  assert.equal(data.weather.status, 'current'); assert.equal(data.alerts_status, 'current');
  assert.equal(data.alerts[0]!.event, 'Flood Warning'); assert.equal(data.coverage_status, 'partial');
  assert.equal(data.outlook.status, 'withheld');
});
test('invalid timestamp in one pinned parameter does not blank other valid measurements', async () => {
  const fetcher = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    if (url.includes('/monitoring-locations/')) return json(station);
    if (url.includes('/time-series-metadata/')) return json({ features: metadata });
    if (url.includes('/latest-continuous/')) return json({ features: [reading(), reading({
      parameter_code: '00065', time_series_id: SERIES['00065'].id, unit_of_measure: 'ft', time: 'not-a-date', value: '2.68',
    }), reading({ parameter_code: '00010', time_series_id: SERIES['00010'].id, unit_of_measure: 'degC', value: '14.7' })] });
    if (url.includes('/continuous/')) return json({ features: [reading({}, '2026-10-07T12:45:00Z'), reading()] });
    throw new Error('Unexpected test request');
  };
  const data = await new ConditionsService({ fetcher, now: () => NOW }).conditions();
  assert.equal(data.observations.find(r => r.parameter_code === '00060')!.quality_status, 'current');
  assert.equal(data.observations.find(r => r.parameter_code === '00065')!.quality_status, 'unavailable');
  assert.equal(data.observations.find(r => r.parameter_code === '00010')!.quality_status, 'current');
  assert.equal(data.trend.points.length, 2);
});
