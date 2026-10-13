import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceClient, SourceError, numeric, safeUrl, timestamp } from '../worker/net';
import { SourceCache } from '../worker/cache';
import { HISTORY_HOURS, SERIES, buildTrend, flowNormal, parseDailyMean, parseObservation, validateMetadata, validateStation, type DailyMean } from '../worker/usgs';
import { ConditionsService, changeOver, developmentPoint, recommendationGate, refreshObservation, sparkline } from '../worker/index';
import { GAUGE_POINT, parseAlerts, parseForecast } from '../worker/nws';
import { WATERS } from '../shared/waters';
import { WATER_SPECIES, describeMonths } from '../shared/species';
import { bandFactor, label, scoreSpecies, scoreWater } from '../worker/score';
import type { HistoryPoint } from '../shared/types';

const NOW = Date.parse('2026-10-07T13:00:00Z');
const ISO = new Date(NOW).toISOString();
const GAUGE = WATERS[0]!.gauge;
const STATION = GAUGE.station_id;
const station = { id: STATION, properties: { id: STATION, agency_code: 'USGS', monitoring_location_number: '14092500',
  monitoring_location_name: 'DESCHUTES RIVER NEAR MADRAS, OR' }, geometry: { type: 'Point', coordinates: [-121.246993886344, 44.7259522504172] } };
const metadata = Object.entries(SERIES).map(([code, series]) => ({ id: GAUGE.series[code as keyof typeof SERIES], properties: { id: GAUGE.series[code as keyof typeof SERIES],
  monitoring_location_id: STATION, parameter_code: code, unit_of_measure: series.unit, statistic_id: '00011', primary: 'Primary',
  computation_period_identifier: 'Points', computation_identifier: 'Instantaneous', begin: '2007-10-01T08:00:00Z', end: ISO } }));
metadata.push({ id: GAUGE.daily_series, properties: { id: GAUGE.daily_series, monitoring_location_id: STATION, parameter_code: '00060', unit_of_measure: 'ft^3/s',
  statistic_id: '00003', primary: 'Primary', computation_period_identifier: 'Daily', computation_identifier: 'Mean', begin: '1923-12-28T08:00:00Z', end: ISO } });
function dailyValue(date: string, value: string | null = '4000', overrides: Record<string, unknown> = {}) {
  return { id: `daily-${date}`, properties: { time_series_id: GAUGE.daily_series, parameter_code: '00060', statistic_id: '00003', time: date,
    value, unit_of_measure: 'ft^3/s', approval_status: 'Approved', qualifier: null, ...overrides } };
}
/** Eight earlier years of daily means around October 7, each year a little higher, plus the current year's partial record. */
function dailyHistory() {
  const features = [];
  for (let year = 2018; year <= 2026; year++) for (let offset = -20; offset <= 20; offset++) {
    const date = new Date(Date.UTC(year, 9, 7 + offset)).toISOString().slice(0, 10);
    if (Date.parse(`${date}T00:00:00Z`) <= NOW) features.push(dailyValue(date, String(3000 + (year - 2018) * 100)));
  }
  return features;
}
function reading(overrides: Record<string, unknown> = {}, time = ISO) {
  return { id: `record-${time}`, properties: { time_series_id: GAUGE.series['00060'], monitoring_location_id: STATION,
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
/** Serves the Madras gauge only; every other station gets a 403 so multi-gauge behavior is exercised. */
function madrasFetcher(extra: (url: string) => Response | null = () => null) {
  return async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    const handled = extra(url);
    if (handled) return handled;
    if (url.includes('waterdata.usgs.gov') && !url.includes('14092500') && !url.includes(GAUGE.daily_series) && !Object.values(GAUGE.series).some(id => url.includes(id))) return new Response('', { status: 403 });
    if (url.includes('/monitoring-locations/')) return json(station);
    if (url.includes('/time-series-metadata/')) return json({ features: metadata });
    if (url.includes('/latest-continuous/')) return json({ features: [reading()] });
    if (url.includes('/continuous/')) return json({ features: [reading({}, '2026-10-07T12:45:00Z'), reading()] });
    if (url.includes('/daily/')) return json({ features: dailyHistory() });
    return new Response('', { status: 403 });
  };
}

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
  validateStation(station, GAUGE); validateMetadata(metadata, GAUGE);
  assert.throws(() => validateStation({ ...station, id: 'USGS-14076500' }, GAUGE));
  assert.throws(() => validateStation(station, WATERS[1]!.gauge));
  assert.throws(() => validateStation({ ...station, geometry: { type: 'Point', coordinates: ['bad', null] } }, GAUGE));
  const wrong = structuredClone(metadata); wrong[0]!.properties.statistic_id = '00003';
  assert.throws(() => validateMetadata(wrong, GAUGE));
  assert.throws(() => validateMetadata(metadata.filter(m => m.id !== GAUGE.daily_series), GAUGE), /daily-mean/);
  assert.throws(() => validateMetadata(metadata, WATERS[1]!.gauge));
});
test('every configured gauge has distinct identity and series ids', () => {
  const stations = new Set(WATERS.map(w => w.gauge.station_id)); const ids = new Set(WATERS.map(w => w.id));
  const series = WATERS.flatMap(w => Object.values(w.gauge.series));
  assert.equal(stations.size, WATERS.length); assert.equal(ids.size, WATERS.length); assert.equal(new Set(series).size, series.length);
  for (const water of WATERS) assert.match(water.gauge.url, new RegExp(`${water.gauge.station_id}/$`));
});
test('observation preserves provenance, approval and original unit', () => {
  const record = parseObservation(reading(), '00060', ISO, NOW, GAUGE);
  assert.equal(record.normalized_value, 3600); assert.equal(record.raw_value, '3600');
  assert.equal(record.raw_unit, 'ft^3/s'); assert.equal(record.approval_status, 'Provisional');
  assert.equal(record.mapping_status, 'candidate_proxy'); assert.equal(record.quality_status, 'current');
});
test('mismatched station, series or statistic cannot become a valid observation', () => {
  for (const override of [{ monitoring_location_id: 'USGS-14076500' }, { time_series_id: 'other' }, { statistic_id: '00003' }]) {
    assert.throws(() => parseObservation(reading(override), '00060', ISO, NOW, GAUGE));
  }
  assert.throws(() => parseObservation(reading(), '00060', ISO, NOW, WATERS[1]!.gauge));
});
test('unknown units and qualifiers withhold normalized values while retaining raw evidence', () => {
  const qualified = parseObservation(reading({ qualifier: 'Ice' }), '00060', ISO, NOW, GAUGE);
  assert.deepEqual(qualified.qualifiers, ['Ice']); assert.equal(qualified.normalized_value, null);
  const wrongUnit = parseObservation(reading({ unit_of_measure: 'm' }), '00060', ISO, NOW, GAUGE);
  assert.equal(wrongUnit.quality_status, 'unavailable'); assert.equal(wrongUnit.raw_value, '3600');
});
test('parameter semantics preserve zero flow and negative stage; temperature converts from water sensor only', () => {
  assert.equal(parseObservation(reading({ value: '0' }), '00060', ISO, NOW, GAUGE).normalized_value, 0);
  assert.equal(parseObservation(reading({ value: '-1' }), '00060', ISO, NOW, GAUGE).normalized_value, null);
  const stage = parseObservation(reading({ value: '-0.2', parameter_code: '00065', time_series_id: GAUGE.series['00065'], unit_of_measure: 'ft' }), '00065', ISO, NOW, GAUGE);
  assert.equal(stage.normalized_value, -0.2);
  const temp = parseObservation(reading({ value: '10', parameter_code: '00010', time_series_id: GAUGE.series['00010'], unit_of_measure: 'degC' }), '00010', ISO, NOW, GAUGE);
  assert.equal(temp.normalized_value, 50);
});
test('freshness derives from observation time and is re-evaluated on cache reads', () => {
  const record = parseObservation(reading(), '00060', ISO, NOW, GAUGE);
  const aged = refreshObservation(record, NOW + 3 * 3600_000, null);
  assert.equal(aged.quality_status, 'stale'); assert.equal(aged.retrieved_at, ISO); assert.equal(aged.observed_at, ISO);
  assert.equal(parseObservation(reading({}, '2026-10-07T13:01:00Z'), '00060', ISO, NOW, GAUGE).quality_status, 'unavailable');
});
test('trend requires same sensor and adequate history, never draws a fabricated change across gaps', () => {
  const count = HISTORY_HOURS * 4 + 1;
  const points = Array.from({ length: count }, (_, i) => parseObservation(reading({ value: String(3500 + i) }, new Date(NOW - HISTORY_HOURS * 3600_000 + i * 15 * 60_000).toISOString()), '00060', ISO, NOW, GAUGE));
  const complete = buildTrend(points, NOW, null, GAUGE);
  assert.equal(complete.complete, true); assert.equal(complete.change, count - 1); assert.equal(complete.input_record_ids.length, count);
  assert.equal(complete.period_hours, HISTORY_HOURS);
  const gap = buildTrend(points.filter((_, i) => i < 20 || i > 30), NOW, null, GAUGE);
  assert.equal(gap.has_gaps, true); assert.equal(gap.change, null);
  assert.equal(buildTrend(points.slice(0, 1), NOW, null, GAUGE).status, 'unavailable');
  assert.equal(buildTrend(points.slice(0, 2).map(p => ({ ...p, normalized_value: null })), NOW, null, GAUGE).status, 'unavailable');
  assert.throws(() => buildTrend([{ ...points[0]!, time_series_id: 'other' }, points[1]!], NOW, null, GAUGE));
});
test('daily means are validated and only clean approved or provisional values count', () => {
  assert.deepEqual(parseDailyMean(dailyValue('2025-10-07'), GAUGE), { date: '2025-10-07', value: 4000 });
  for (const overrides of [{ qualifier: 'Ice' }, { approval_status: 'Estimated' }, { unit_of_measure: 'm^3/s' }, { value: '-3' }, { value: 'Dis' }]) {
    assert.equal(parseDailyMean(dailyValue('2025-10-07', '4000', overrides), GAUGE), null);
  }
  assert.throws(() => parseDailyMean(dailyValue('2025-10-07', '4000', { time_series_id: 'other' }), GAUGE));
  assert.throws(() => parseDailyMean(dailyValue('2025-10-07T00:00:00Z'), GAUGE));
  assert.throws(() => parseDailyMean(dailyValue('2025-10-07'), WATERS[1]!.gauge));
});
test('normal flow is the median within a week of the date over earlier years and excludes the current year', () => {
  const records = dailyHistory().map(f => parseDailyMean(f, GAUGE)!);
  const latest = parseObservation(reading(), '00060', ISO, NOW, GAUGE);
  const normal = flowNormal(records, latest, { year: 2026, month: 10, day: 7 }, GAUGE, ISO, 'current');
  assert.equal(normal.years, 8); assert.equal(normal.first_year, 2018); assert.equal(normal.last_year, 2025);
  assert.equal(normal.median, 3350); // Median of eight evenly spaced yearly values is between the 4th and 5th.
  assert.equal(Math.round(normal.percent_of_median!), Math.round(3600 / 3350 * 100)); assert.equal(normal.status, 'current');
  const few = flowNormal(records.filter(r => r.date >= '2022'), latest, { year: 2026, month: 10, day: 7 }, GAUGE, ISO, 'current');
  assert.equal(few.median, null); assert.match(few.reason!, /Fewer than 5/);
  const noFlow = flowNormal(records, { ...latest, normalized_value: null }, { year: 2026, month: 10, day: 7 }, GAUGE, ISO, 'current');
  assert.equal(noFlow.median, 3350); assert.equal(noFlow.percent_of_median, null); assert.equal(noFlow.status, 'unavailable');
  // A window around New Year reaches across the year boundary.
  const winter: DailyMean[] = [];
  for (let year = 2018; year <= 2025; year++) for (const date of [`${year}-12-28`, `${year + 1}-01-03`]) winter.push({ date, value: year });
  const wrap = flowNormal(winter, latest, { year: 2026, month: 1, day: 1 }, GAUGE, ISO, 'current');
  assert.equal(wrap.years, 8); assert.equal(wrap.first_year, 2018); assert.equal(wrap.last_year, 2025);
  assert.equal(flowNormal([], latest, { year: 2026, month: 10, day: 7 }, GAUGE, ISO, 'current').status, 'unavailable');
});
test('species bands score full inside, ease to the ok edge and fall beyond it', () => {
  const band = { best: [50, 62] as [number, number], ok: [44, 66] as [number, number] };
  assert.equal(bandFactor(56, band), 1); assert.equal(bandFactor(50, band), 0.85); assert.equal(bandFactor(62, band), 0.85);
  assert.ok(bandFactor(53, band) > 0.9 && bandFactor(53, band) < 1);
  assert.equal(bandFactor(47, band), 0.725); assert.equal(bandFactor(44, band), 0.6); assert.equal(bandFactor(66, band), 0.6);
  assert.ok(bandFactor(40, band) < 0.6 && bandFactor(40, band) >= 0.1); assert.equal(bandFactor(0, band), 0.1);
  assert.deepEqual([label(88), label(87), label(72), label(71), label(55), label(38), label(37)], ['Prime', 'Great', 'Great', 'Good', 'Good', 'Fair', 'Poor']);
  assert.equal(describeMonths([8, 9, 10, 11, 12]), 'Aug–Dec'); assert.equal(describeMonths([10, 11, 12, 1, 2, 3]), 'Oct–Mar');
  assert.equal(describeMonths([]), 'Year-round'); assert.equal(describeMonths([5, 6, 9, 10]), 'May, Jun, Sep, Oct');
});
test('species scores follow season, go partial when a reading is missing, and flag warm water', () => {
  const normal = { status: 'current' as const, median: 4000, percent_of_median: 94, years: 10, first_year: 2016, last_year: 2025, window_days: 7, time_series_id: 'd', retrieved_at: ISO, reason: null };
  const temp = parseObservation(reading({ value: '14.8', parameter_code: '00010', time_series_id: GAUGE.series['00010'], unit_of_measure: 'degC' }), '00010', ISO, NOW, GAUGE);
  const change = { hours: 24, absolute: -10, percent: -0.3, from_observed_at: ISO, reason: null };
  const steelhead = WATER_SPECIES['lower-deschutes-warm-springs-trout-creek']!.find(s => s.species === 'summer-steelhead')!;
  const october = scoreSpecies(steelhead, { normal, temperature: temp, change }, 10);
  assert.equal(october.in_season, true); assert.equal(october.primary, true); assert.equal(october.partial, false);
  assert.equal(october.components.length, 4); assert.match(october.components[3]!.detail, /Peak/);
  assert.ok(october.score! >= 75 && october.score! <= 95, `expected a strong but not perfect October steelhead score, got ${october.score}`);
  const august = scoreSpecies(steelhead, { normal, temperature: temp, change }, 8);
  assert.equal(august.primary, false); assert.ok(august.score! < october.score!); assert.match(august.components[3]!.detail, /outside the peak/);
  const march = scoreSpecies(steelhead, { normal, temperature: temp, change }, 3);
  assert.equal(march.in_season, false);
  const partial = scoreSpecies(steelhead, { normal, temperature: undefined, change }, 10);
  assert.equal(partial.partial, true); assert.deepEqual(partial.missing, ['water temperature']); assert.ok(partial.score !== null);
  const nothing = scoreSpecies(steelhead, { normal: { ...normal, percent_of_median: null, median: null }, temperature: undefined, change: undefined }, 10);
  assert.equal(nothing.score, null); // Time of year alone never makes a score.
  const warm = scoreSpecies(steelhead, { normal, temperature: { ...temp, normalized_value: 70 }, change }, 10);
  assert.equal(warm.stress, true); assert.equal(warm.components[1]!.points, 0); assert.match(warm.components[1]!.detail, /stressful/);
  assert.ok(warm.score! <= 20); assert.match(warm.capped_by!, /stress/); assert.equal(october.capped_by, null);
  const flood = scoreSpecies(steelhead, { normal: { ...normal, percent_of_median: 260 }, temperature: temp, change: { ...change, percent: 25 } }, 10);
  assert.ok(flood.score! <= 20, `expected a poor flood score, got ${flood.score}`); assert.match(flood.capped_by!, /flow/); assert.equal(flood.label, 'Poor');
});
test('known restrictions withhold the headline and historical calculations keep their own date', () => {
  const normal = { status: 'current' as const, median: 4000, percent_of_median: 94, years: 10, first_year: 2016, last_year: 2025, window_days: 7, time_series_id: 'd', retrieved_at: ISO, reason: null };
  const temp = parseObservation(reading({ value: '14.8', parameter_code: '00010', time_series_id: GAUGE.series['00010'], unit_of_measure: 'degC' }), '00010', ISO, NOW, GAUGE);
  const change = { hours: 24, absolute: -10, percent: -0.3, from_observed_at: ISO, reason: null };
  const october = scoreWater('lower-deschutes-warm-springs-trout-creek', { normal, temperature: temp, change }, Date.parse('2026-10-12T20:00:00Z'));
  assert.equal(october.month, 10); assert.equal(october.species_id, null); assert.equal(october.score, null);
  assert.equal(october.primary_name, 'Restrictions reported'); assert.match(october.reason!, /restrictions/);
  assert.ok(october.species.every(s => s.score === null && !s.primary));
  assert.equal(october.species.length, 5); assert.equal(october.species.filter(s => s.in_season).length, 4);
  const june = scoreWater('lower-deschutes-warm-springs-trout-creek', { normal, temperature: temp, change }, Date.parse('2026-06-12T20:00:00Z'));
  assert.equal(june.species_id, 'redband-trout');
  // Late on the last day of a Pacific month is still that month.
  assert.equal(scoreWater('metolius-river-grandview', { normal, temperature: temp, change }, Date.parse('2026-11-01T05:00:00Z')).month, 10);
  const unknown = scoreWater('nowhere', { normal, temperature: temp, change }, NOW);
  assert.equal(unknown.score, null); assert.match(unknown.reason!, /No species/);
  for (const [id, list] of Object.entries(WATER_SPECIES)) {
    assert.ok(WATERS.some(w => w.id === id), `${id} has species but no gauge`);
    for (let month = 1; month <= 12; month++) assert.equal(list.filter(s => s.primary.includes(month)).length, 1, `${id} month ${month} needs exactly one main target`);
  }
});
test('board changes compare same-series readings and stay blank without a reference reading', () => {
  const series: HistoryPoint[] = Array.from({ length: HISTORY_HOURS * 4 + 1 }, (_, i) => ({ id: String(i), observed_at: new Date(NOW - HISTORY_HOURS * 3600_000 + i * 15 * 60_000).toISOString(), value: 3000 + i }));
  const hour = changeOver(1, series); assert.equal(hour.absolute, 4); assert.equal(hour.percent! > 0, true); assert.equal(hour.from_observed_at, new Date(NOW - 3600_000).toISOString());
  assert.equal(changeOver(24, series).absolute, 96); assert.equal(changeOver(168, series).absolute, HISTORY_HOURS * 4);
  const missingDay = series.filter(p => Math.abs(Date.parse(p.observed_at) - (NOW - 24 * 3600_000)) > 50 * 60_000);
  assert.equal(changeOver(24, missingDay).absolute, null); assert.match(changeOver(24, missingDay).reason!, /24 hours/);
  assert.equal(changeOver(1, missingDay).absolute, 4);
  assert.equal(changeOver(1, []).reason, 'No valid latest reading.');
  assert.equal(changeOver(1, [{ id: 'a', observed_at: ISO, value: 0 }, { id: 'b', observed_at: new Date(NOW + 3600_000).toISOString(), value: 5 }]).percent, null);
});
test('sparkline buckets one reading per hour and leaves empty hours null', () => {
  const series: HistoryPoint[] = Array.from({ length: HISTORY_HOURS * 4 + 1 }, (_, i) => ({ id: String(i), observed_at: new Date(NOW - HISTORY_HOURS * 3600_000 + i * 15 * 60_000).toISOString(), value: 3000 + i }));
  const full = sparkline(series);
  assert.equal(full.length, HISTORY_HOURS); assert.equal(full.at(-1)!.value, 3000 + HISTORY_HOURS * 4); assert.equal(full.every(p => p.value !== null), true);
  const gappy = sparkline(series.filter(p => Date.parse(p.observed_at) < NOW - 50 * 3600_000 || Date.parse(p.observed_at) > NOW - 40 * 3600_000));
  assert.equal(gappy.length, HISTORY_HOURS); assert.equal(gappy.filter(p => p.value === null).length, 10);
  assert.deepEqual(sparkline([]), []);
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
  assert.equal(developmentPoint(new Request('http://localhost/api'), env, WATERS[1]!.gauge)?.latitude, WATERS[1]!.gauge.latitude);
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
  const fetcher = madrasFetcher(url => {
    urls.push(url);
    if (url.includes('/points/')) return json({ geometry: { type: 'Point', coordinates: [-121.247, 44.726] }, properties: { forecastHourly: HOURLY_URL } });
    if (url.includes('/forecast/hourly')) return json(hourlyData());
    return null;
  });
  const service = new ConditionsService({ fetcher, now: () => NOW });
  const publicData = await service.conditions();
  assert.equal(publicData.observations[0]!.normalized_value, 3600);
  assert.equal(publicData.weather.status, 'unavailable'); assert.equal(urls.some(url => url.includes('weather.gov')), false);
  const devData = await service.conditions(WATERS[0]!.id, GAUGE_POINT);
  assert.equal(devData.weather.status, 'current'); assert.equal(devData.alerts_status, 'unavailable');
  assert.equal(devData.observations[0]!.quality_status, 'current'); assert.equal(devData.suggested_windows.length, 0);
  assert.equal(urls.filter(url => url.includes('/latest-continuous/')).length, 1);
});
test('one failing gauge does not blank the others on the board', async () => {
  const service = new ConditionsService({ fetcher: madrasFetcher(), now: () => NOW });
  const board = await service.board();
  assert.equal(board.rows.length, WATERS.length);
  assert.deepEqual(board.rows.map(r => r.water_id), WATERS.map(w => w.id));
  const madras = board.rows[0]!;
  assert.equal(madras.flow.value, 3600); assert.equal(madras.status, 'current'); assert.equal(madras.flow.observed_at, ISO);
  assert.equal(madras.changes.find(c => c.hours === 1)!.absolute, null); // Only 15 minutes of history exist in this fixture.
  assert.equal(madras.sparkline.length, HISTORY_HOURS); assert.equal(madras.sparkline.at(-1)!.value, 3600);
  assert.equal(madras.normal.median, 3350); assert.equal(madras.normal.years, 8); assert.equal(madras.normal.status, 'current');
  for (const row of board.rows.slice(1)) {
    assert.equal(row.status, 'unavailable'); assert.equal(row.flow.value, null); assert.match(row.message, /HTTP 403/);
    assert.ok(row.changes.every(c => c.absolute === null && c.reason)); assert.deepEqual(row.sparkline, []);
    assert.equal(row.normal.median, null); assert.ok(row.normal.reason);
  }
  assert.equal(madras.score.score, null); assert.equal(madras.score.partial, false);
  assert.match(madras.score.reason!, /restrictions/); // A closure notice overrides otherwise scoreable flow.
  assert.deepEqual(madras.score.missing, []);
  assert.equal(board.rows[1]!.score.score, null);
  const conditions = await service.conditions();
  assert.equal(conditions.normal?.median, 3350); assert.equal(conditions.score?.species_id, madras.score.species_id);
  await assert.rejects(() => service.conditions('not-a-water'), /Unknown water/);
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
  const data = await new ConditionsService({ fetcher, now: () => NOW }).conditions(WATERS[0]!.id, GAUGE_POINT);
  assert.ok(data.observations.every(r => r.quality_status === 'unavailable'));
  assert.equal(data.weather.status, 'current'); assert.equal(data.alerts_status, 'current');
  assert.equal(data.alerts[0]!.event, 'Flood Warning'); assert.equal(data.coverage_status, 'partial');
  assert.equal(data.outlook.status, 'withheld');
});
test('invalid timestamp in one pinned parameter does not blank other valid measurements', async () => {
  const fetcher = madrasFetcher(url => url.includes('/latest-continuous/') ? json({ features: [reading(), reading({
    parameter_code: '00065', time_series_id: GAUGE.series['00065'], unit_of_measure: 'ft', time: 'not-a-date', value: '2.68',
  }), reading({ parameter_code: '00010', time_series_id: GAUGE.series['00010'], unit_of_measure: 'degC', value: '14.7' })] }) : null);
  const data = await new ConditionsService({ fetcher, now: () => NOW }).conditions();
  assert.equal(data.observations.find(r => r.parameter_code === '00060')!.quality_status, 'current');
  assert.equal(data.observations.find(r => r.parameter_code === '00065')!.quality_status, 'unavailable');
  assert.equal(data.observations.find(r => r.parameter_code === '00010')!.quality_status, 'current');
  assert.equal(data.trend.points.length, 2);
});
