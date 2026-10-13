import type { Board, BoardRow, Conditions, FlowNormal, Observation, SpeciesScore, WaterScore } from '../../shared/types';
import { WATERS } from '../../shared/waters';

// Synthetic data is restricted to intercepted browser-test responses.
// No production route, fallback or development server serves this fixture.
export const measuredAt = '2026-10-07T12:15:00.000Z';
export const retrievedAt = '2026-10-07T13:00:00.000Z';
export const issuedAt = '2026-10-07T11:45:00.000Z';
export const stationUrl = 'https://waterdata.usgs.gov/monitoring-location/USGS-14092500/';
export const weatherUrl = 'https://api.weather.gov/gridpoints/PDT/40,100/forecast/hourly';

function observation(parameter: Observation['parameter_code'], value: number | null, unit: string | null, label: string): Observation {
  return {
    id: `test-${parameter}`, source_id: 'usgs', source_url: stationUrl,
    station_id: 'USGS-14092500', time_series_id: `test-series-${parameter}`,
    parameter_code: parameter, label, raw_value: value, raw_unit: unit,
    normalized_value: value, normalized_unit: unit,
    observed_at: value === null ? null : measuredAt, retrieved_at: retrievedAt,
    approval_status: value === null ? null : 'Provisional', qualifiers: [],
    quality_status: value === null ? 'unavailable' : 'current', mapping_status: 'candidate_proxy',
    issues: value === null ? ['This parameter was not reported by the station.'] : [],
  };
}

export function normalFixture(live = true): FlowNormal {
  return live ? { status: 'current', median: 4600, percent_of_median: 4321 / 4600 * 100, years: 8, first_year: 2018, last_year: 2025, window_days: 7,
    time_series_id: 'test-daily-series', retrieved_at: retrievedAt, reason: null }
    : { status: 'unavailable', median: null, percent_of_median: null, years: 0, first_year: null, last_year: null, window_days: 7,
      time_series_id: 'test-daily-series', retrieved_at: null, reason: 'Test outage for this gauge.' };
}

function speciesFixture(species: string, name: string, score: number | null, primary: boolean, inSeason = true): SpeciesScore {
  const label = score === null ? null : score >= 80 ? 'Prime' : score >= 65 ? 'Great' : score >= 50 ? 'Good' : score >= 35 ? 'Fair' : 'Poor';
  return { species, name, in_season: inSeason, primary, months: inSeason ? [8, 9, 10, 11, 12] : [5, 6], peak: [9, 10], note: 'Test species note.', version: 'test-score-v1',
    score, label, partial: false, missing: [], stress: false, capped_by: null, components: [
      { name: 'Flow', weight: 0.36, factor: 1, points: 36, detail: '94% of normal — in the sweet spot' },
      { name: 'Water temperature', weight: 0.24, factor: null, points: null, detail: 'No water temperature reading.' },
      { name: '24h trend', weight: 0.2, factor: 0.9, points: 18, detail: 'Falling gently (-2.7% in 24h)' },
      { name: 'Time of year', weight: 0.2, factor: 1, points: 20, detail: 'Peak of the season (Sep–Oct)' },
    ] };
}
export function scoreFixture(live = true): WaterScore {
  const species = [speciesFixture('summer-steelhead', 'Summer steelhead', live ? 72 : null, true), speciesFixture('redband-trout', 'Redband rainbow trout', live ? 61 : null, false),
    speciesFixture('spring-chinook', 'Spring Chinook', null, false, false)];
  return live ? { version: 'test-score-v1', month: 10, score: 72, label: 'Great', species_id: 'summer-steelhead', species_name: 'Summer steelhead', primary_name: 'Summer steelhead',
    partial: true, missing: ['water temperature'], reason: null, species }
    : { version: 'test-score-v1', month: 10, score: null, label: null, species_id: null, species_name: null, primary_name: 'Summer steelhead',
      partial: false, missing: ['flow', 'water temperature', '24h trend'], reason: 'No in-season species has enough readings to score.', species };
}

export function conditionsFixture(): Conditions {
  return {
    schema_version: '1.0', water_id: 'lower-deschutes',
    reach_id: 'warm-springs-trout-creek', target_species: 'trout',
    timezone: 'America/Los_Angeles', updated_at: retrievedAt,
    mode: 'live', coverage_status: 'partial',
    observations: [
      observation('00060', 4321, 'cfs', 'River flow'),
      observation('00065', 3.21, 'ft', 'Gauge height'),
      observation('00010', null, null, 'Water temperature'),
    ],
    trend: {
      status: 'current', parameter_code: '00060', time_series_id: 'test-series-00060', unit: 'cfs',
      period_hours: 24,
      points: [
        { id: 'history-1', observed_at: '2026-10-06T12:15:00.000Z', value: 4000 },
        { id: 'history-2', observed_at: '2026-10-06T12:30:00.000Z', value: 4100 },
        { id: 'history-3', observed_at: '2026-10-06T12:45:00.000Z', value: null },
        { id: 'history-4', observed_at: '2026-10-07T12:00:00.000Z', value: 4200 },
        { id: 'history-5', observed_at: measuredAt, value: 4321 },
      ],
      change: null, change_percent: null, has_gaps: true, complete: false,
      reason: 'A gap separates the available observations. No 24-hour change is reported.',
      calculation_version: 'test-v1', input_record_ids: ['history-1', 'history-2', 'history-3', 'history-4', 'history-5'],
    },
    normal: normalFixture(),
    score: scoreFixture(),
    weather: {
      status: 'current', issued_at: issuedAt, retrieved_at: retrievedAt, source_url: weatherUrl,
      point_status: 'gauge_smoke_test', point_label: 'Gauge coordinates · developer smoke test',
      periods: [
        { start_at: '2026-10-07T13:00:00.000Z', end_at: '2026-10-07T14:00:00.000Z',
          temperature: 61, temperature_unit: 'F', precipitation_probability: 20,
          wind_speed: '5 mph', wind_direction: 'NW', short_forecast: 'Partly cloudy', is_daytime: true },
      ],
      reason: 'Weather point has not been reviewed for the fishing reach.',
    },
    alerts: [], alerts_status: 'unavailable',
    source_health: [
      { source_id: 'usgs', label: 'USGS river observations', status: 'current', retrieved_at: retrievedAt,
        last_attempt_at: retrievedAt, from_cache: false, message: 'Validated test observations.', source_url: stationUrl },
      { source_id: 'nws', label: 'NWS hourly weather', status: 'current', retrieved_at: retrievedAt,
        last_attempt_at: retrievedAt, from_cache: false, message: 'Gauge weather point is not reviewed for the reach.', source_url: weatherUrl },
      { source_id: 'nws_alerts', label: 'NWS official alerts', status: 'unavailable', retrieved_at: null,
        last_attempt_at: retrievedAt, from_cache: false, message: 'The alert source could not be reached.', source_url: 'https://api.weather.gov/alerts/active' },
    ],
    regulations_status: 'not_verified', access_status: 'not_verified', restrictions: [],
    official_links: [
      { label: 'ODFW Central Zone recreation report', url: 'https://myodfw.com/recreation-report/fishing-report/central-zone' },
      { label: 'ODFW fishing regulations', url: 'https://myodfw.com/fishing/regulations' },
    ],
    outlook: { status: 'withheld', reasons: ['Regulations and access have not been verified.'],
      limitations: ['Gauge measurements do not describe every fishing spot.'], model_version: 'conditions-only-v1' },
    suggested_windows: [], reviewed_techniques: [],
  };
}

/** Every configured water gets a row; only the first has readings so empty states are exercised too. */
export function boardFixture(): Board {
  const rows = WATERS.map((water, index): BoardRow => {
    const live = index === 0;
    const reading = (value: number | null, unit: string) => ({ value: live ? value : null, unit, observed_at: live && value !== null ? measuredAt : null, status: live && value !== null ? 'current' as const : 'unavailable' as const });
    return {
      water_id: water.id, name: water.name, reach: water.reach, gauge_label: water.gauge.label, station_id: water.gauge.station_id,
      source_url: water.gauge.url, mapping_status: 'candidate_proxy', status: live ? 'current' : 'unavailable', retrieved_at: live ? retrievedAt : null,
      message: live ? 'Validated test observations.' : 'Test outage for this gauge.',
      flow: reading(4321, 'cfs'), height: reading(3.21, 'ft'), temperature: reading(null, '°F'), normal: normalFixture(live), score: scoreFixture(live),
      changes: [
        { hours: 1, absolute: live ? 21 : null, percent: live ? 0.49 : null, from_observed_at: live ? '2026-10-07T11:15:00.000Z' : null, reason: live ? null : 'Test outage for this gauge.' },
        { hours: 24, absolute: live ? -120 : null, percent: live ? -2.7 : null, from_observed_at: live ? '2026-10-06T12:15:00.000Z' : null, reason: live ? null : 'Test outage for this gauge.' },
        { hours: 168, absolute: live ? -379 : null, percent: live ? -8.06 : null, from_observed_at: live ? '2026-09-30T12:15:00.000Z' : null, reason: live ? null : 'Test outage for this gauge.' },
      ],
      sparkline: live ? Array.from({ length: 168 }, (_, i) => ({ id: `spark-${i}`, observed_at: new Date(Date.parse(measuredAt) - (167 - i) * 3600_000).toISOString(), value: i > 100 && i < 110 ? null : 4700 - i * 2 })) : [],
    };
  });
  return { schema_version: '1.0', timezone: 'America/Los_Angeles', updated_at: retrievedAt, rows };
}

export function staleFixture(): Conditions {
  const data = conditionsFixture();
  const oldObservedAt = '2026-10-05T12:15:00.000Z';
  data.observations = data.observations.map(row => row.normalized_value === null ? row : {
    ...row, observed_at: oldObservedAt, quality_status: 'stale', issues: ['Observation is older than the freshness limit.'],
  });
  data.trend.status = 'stale';
  data.weather.status = 'stale';
  data.weather.issued_at = '2026-10-05T11:45:00.000Z';
  data.weather.reason = 'Retained forecast is stale.';
  data.source_health = data.source_health.map(source => source.status === 'unavailable' ? source : {
    ...source, status: 'stale', from_cache: true, message: 'Source refresh failed; retaining the original snapshot.',
  });
  return data;
}
