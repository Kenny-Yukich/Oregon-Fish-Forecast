export type DataStatus = 'current' | 'stale' | 'unavailable';
export type Parameter = '00060' | '00065' | '00010';

export interface Observation {
  id: string;
  source_id: 'usgs';
  source_url: string;
  station_id: string;
  time_series_id: string | null;
  parameter_code: Parameter;
  label: string;
  raw_value: unknown;
  raw_unit: string | null;
  normalized_value: number | null;
  normalized_unit: string | null;
  observed_at: string | null;
  retrieved_at: string | null;
  approval_status: string | null;
  qualifiers: string[];
  quality_status: DataStatus;
  mapping_status: 'candidate_proxy' | 'verified' | 'unverified';
  issues: string[];
}

export interface HistoryPoint {
  id: string;
  observed_at: string;
  value: number | null;
}

export interface Trend {
  status: DataStatus;
  parameter_code: Parameter;
  time_series_id: string | null;
  unit: string | null;
  period_hours: number;
  points: HistoryPoint[];
  change: number | null;
  change_percent: number | null;
  has_gaps: boolean;
  complete: boolean;
  reason: string | null;
  calculation_version: string;
  input_record_ids: string[];
}

export interface WeatherPeriod {
  start_at: string;
  end_at: string;
  temperature: number | null;
  temperature_unit: string | null;
  precipitation_probability: number | null;
  wind_speed: string | null;
  wind_direction: string | null;
  short_forecast: string;
  is_daytime: boolean;
}

export interface Weather {
  status: DataStatus;
  issued_at: string | null;
  retrieved_at: string | null;
  source_url: string;
  point_status: 'not_reviewed' | 'reviewed' | 'gauge_smoke_test';
  point_label: string;
  periods: WeatherPeriod[];
  reason: string | null;
}

export interface OfficialAlert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  effective_at: string | null;
  expires_at: string | null;
  source_url: string;
}

export interface SourceHealth {
  source_id: 'usgs' | 'nws' | 'nws_alerts';
  label: string;
  status: DataStatus;
  retrieved_at: string | null;
  last_attempt_at: string | null;
  from_cache: boolean;
  message: string;
  source_url: string;
}

export interface Conditions {
  schema_version: '1.0';
  water_id: string;
  reach_id: string;
  target_species: string;
  timezone: string;
  updated_at: string;
  mode: 'live' | 'development_fixture';
  coverage_status: 'partial' | 'unavailable';
  observations: Observation[];
  trend: Trend;
  weather: Weather;
  alerts: OfficialAlert[];
  alerts_status: DataStatus;
  source_health: SourceHealth[];
  regulations_status: 'not_verified' | 'open' | 'closed';
  access_status: 'not_verified' | 'verified';
  restrictions: string[];
  official_links: { label: string; url: string }[];
  outlook: { status: 'withheld'; reasons: string[]; limitations: string[]; model_version: string };
  suggested_windows: never[];
  reviewed_techniques: never[];
}
