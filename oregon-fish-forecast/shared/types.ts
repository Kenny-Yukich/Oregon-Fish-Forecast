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

/** One reading as it appears on the board; the full Observation record lives on the conditions endpoint. */
export interface BoardReading {
  value: number | null;
  unit: string;
  observed_at: string | null;
  status: DataStatus;
}
/** A same-series comparison against the reading closest to N hours before the latest one. */
export interface BoardChange {
  hours: number;
  absolute: number | null;
  percent: number | null;
  from_observed_at: string | null;
  reason: string | null;
}
/** The latest flow against the median of daily-mean flows within a week of today's date, over the years available. */
export interface FlowNormal {
  status: DataStatus;
  median: number | null;
  percent_of_median: number | null;
  years: number;
  first_year: number | null;
  last_year: number | null;
  window_days: number;
  time_series_id: string;
  retrieved_at: string | null;
  reason: string | null;
}
export interface ScoreComponent {
  name: string;
  weight: number;
  factor: number | null;
  points: number | null;
  detail: string;
}
export interface SpeciesScore {
  species: string;
  name: string;
  in_season: boolean;
  /** This species is the water's main target this month. */
  primary: boolean;
  months: number[];
  peak: number[];
  note: string | null;
  version: string;
  score: number | null;
  label: 'Prime' | 'Great' | 'Good' | 'Fair' | 'Poor' | null;
  partial: boolean;
  missing: string[];
  components: ScoreComponent[];
  /** Water temperature at or above the species' stress threshold. */
  stress: boolean;
  /** Set when a gate (unfishable flow or stress temperature) held the score below the weighted blend. */
  capped_by: string | null;
}
/** The water's headline score is its best in-season species; every species is scored underneath. */
export interface WaterScore {
  version: string;
  month: number;
  score: number | null;
  label: SpeciesScore['label'];
  species_id: string | null;
  species_name: string | null;
  /** The month's main target, even when it could not be scored. */
  primary_name: string | null;
  partial: boolean;
  missing: string[];
  reason: string | null;
  species: SpeciesScore[];
}
export interface BoardRow {
  normal: FlowNormal;
  score: WaterScore;
  water_id: string;
  name: string;
  reach: string;
  gauge_label: string;
  station_id: string;
  source_url: string;
  mapping_status: Observation['mapping_status'];
  status: DataStatus;
  retrieved_at: string | null;
  message: string;
  flow: BoardReading;
  height: BoardReading;
  temperature: BoardReading;
  changes: BoardChange[];
  sparkline: HistoryPoint[];
}
export interface Board {
  schema_version: '1.0';
  timezone: string;
  updated_at: string;
  rows: BoardRow[];
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
  normal?: FlowNormal;
  score?: WaterScore;
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
