import type { Conditions, Observation } from '../../shared/types';

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
