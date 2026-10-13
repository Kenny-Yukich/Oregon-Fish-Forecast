/** Editorial records are independent of live station readings. */
export interface PlanningSource { label: string; url: string }
export interface WaterPlanning {
  water_id: string;
  target_species: string[];
  access_summary: string;
  access_detail: string;
  /** A named public destination, never a gauge coordinate or assumed easement. */
  access_point: { label: string; map_query: string } | null;
  seasonal_summary: string;
  seasonal_detail: string;
  methods: string;
  /** Withhold the numerical outlook when known restrictions conflict with its targets. */
  score_notice?: string;
  /** Explicit effective time of the restriction; independent of the fishing report date. */
  score_notice_effective_at?: string;
  report: {
    summary: string;
    /** The water's own update date, not the zone page's general date. */
    reported_on: string | null;
    checked_on: string;
    coverage: string;
    url: string;
  };
  alerts: {
    summary: string;
    status: 'advisory' | 'unverified';
    checked_on: string | null;
    url: string;
  }[];
  checked_on: string;
  sources: PlanningSource[];
}
