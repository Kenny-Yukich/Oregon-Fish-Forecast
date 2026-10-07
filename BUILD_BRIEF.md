# Oregon Fish Forecast — Build brief v0.1

Prepared for Kenny • October 7, 2026

**Status:** researched implementation brief and source-checking starter code. No website has been built or deployed by this package. Live API calls still need validation in the development/deployment environment. Items labeled proposed are product decisions, not scientific findings.

## 1. Product and boundaries

**Brand:** Oregon Fish Forecast  
**Primary domain:** `oregonfishforecast.com`  
**Redirect domain:** `orfishforecast.com`  
**Message:** Where to fish. When to go. What to throw.

Build a mobile-first, public fishing-conditions and trip-planning site. Start with a small Central Oregon pilot, then expand by validated river reach and lake sector rather than publishing thin pages for the whole state.

Keep the new project in a separate `oregon-fish-forecast` repository/folder and a separate Cloudflare Worker. Do not change the existing Redside repository, its catch logs, its deployment, or the `redside-advisor` Worker. Redside can eventually consume a versioned forecast API; that integration is not part of the first milestone.

The reference TikTok account suggests a repeatable report format. Create original branding, graphics, scripts, and analysis; do not copy its visual assets or imply affiliation. TroutRoutes remains a potential licensed source, not an approved feed: integration requires suitable permission and a documented technical interface. No scraping, private endpoints, or copied map layers in this build.

## 2. What was checked

The connected `Kenny-Yukich/Redside` README and `js/conditions.js` were read. The README describes an existing seven-water offline fishing PWA; the conditions module requests legacy USGS WaterServices and Open-Meteo. This is useful design context, not a complete audit of Redside. [R1, R2]

Two source decisions follow:

- Target modern **USGS Water Data API v1**, not the legacy WaterServices URL. USGS's October 2, 2026 notice says WaterServices will be retired in the first quarter of 2027. [S1, S2]
- Use **NWS** as the initial weather provider. NWS describes its API data as free for any purpose; Open-Meteo's free hosted API is non-commercial, with a separate subscription route for commercial use. This is a choice for the new public product, not a conclusion that Redside's personal use is improper. [S5, S6]

USGS station `USGS-14092500` is officially named **Deschutes River Near Madras, OR**. Its identity and published location were verified. Coverage of a particular downstream fishing reach and the current availability of each sensor still need validation. [S7]

## 3. First deliverable: one complete Lower Deschutes page

**Working route:** `/waters/lower-deschutes-warm-springs-trout-creek`

**Initial target:** trout trip planning for the Warm Springs–Trout Creek area. This is a proposed product scope, not a declaration that every location or fishing method is lawful. Exact boundaries, bank access, land jurisdiction, and applicable rules require editorial review.

The first page must display:

1. **Where this applies.** A named reach, map/description once verified, source station, and a clear note that a gauge reading is not a measurement at every fishing spot.
2. **Measured river conditions.** Flow, gauge height, and water temperature only when the selected source actually reports them. Display units, measurement time, source, and qualification flags. Never substitute air temperature for water temperature.
3. **Weather forecast.** Hourly periods from NWS for a reviewed point representing the reach, plus relevant official alerts. Show forecast issue time and period validity. Station coordinates may be used in a developer smoke test, but do not silently present them as the fishing access or approved weather point.
4. **Recent change.** A 24-hour or 72-hour trend derived from the continuous-data history of the same sensor/time series. No trend based on a single reading. Show data gaps rather than interpolating a smooth fictional curve.
5. **ODFW context.** A short attributed summary with the water-specific report date, review time, and source link. Link to official guidance initially; do not pretend there is an approved structured ODFW API.
6. **Planning interpretation.** A concise, evidence-linked explanation after rules and data checks. It must distinguish observed conditions, forecast weather, and editorial judgment.
7. **Rules and access status.** Verified restrictions and date scope when available; otherwise explicit “not yet verified.” Unknown is not open. Do not recommend a species, method, access route, or time window when the required checks are incomplete.

Until interpretation is approved, the page can be useful as a **conditions page**. A missing score or water temperature is preferable to an invented one.

### First-page completion criteria

- A successful upstream response contains the expected location, parameter, units, and measurement/forecast timestamps.
- Source-specific freshness is evaluated using measurement time, not the time the site fetched the data.
- If a provider fails, the other provider's valid information still appears. Cached readings retain their original timestamps and a stale/unavailable label.
- A new browser request does not trigger a duplicate batch of upstream calls.
- A source/parameter mismatch, invalid value, or unknown unit cannot become a confident recommendation.
- The page works on a narrow iPhone viewport, with readable text and no horizontal scrolling.
- Regulations-dependent content is withheld until reviewed, and confirmed restrictions override a favorable conditions assessment.
- Sources and uncertainty survive into any exported report.
- Nothing is deployed to the purchased domains until a preview is reviewed.

## 4. Pilot coverage after the first page works

These are **proposed coverage areas**, not an assertion that usable live sensors exist at each one.

| Area | Initial scope | Required review before recommendations |
|---|---|---|
| Lower Deschutes | Warm Springs–Trout Creek trout planning | Reach/gauge relationship; access and rules |
| Crooked River | Below Bowman Dam | Correct current flow source; applicable reach |
| Metolius River | A specific reviewed reach, not the whole river | Seasonal boundaries; technique restrictions; sensor coverage |
| Fall River | Above the falls as initial scope | Exact boundary and current method/season rules |
| Haystack Reservoir | Bank-fishing conditions | Current access, weather point, stocking context; no presumed lake sensor |
| Lake Billy Chinook | Named arm/sector | Separate lake and tributary measurements, access and jurisdiction |

Do not attach a convenient nearby gauge to an entire river or reservoir. A tributary's water temperature or discharge is not the lake's surface temperature or an overall “lake flow.”

An identity check surfaced two useful cautions: `USGS-14076500` is **Deschutes River Near Culver**, while the official continuous-data record shown for `USGS-14080500` ends in 1991. Do not treat that old Crooked station as a current feed solely because its name looks right. Current coverage must be tested using the API. [S8, S9]

## 5. Source plan

### USGS — automatic observations and history

Use modern v1 collections for latest observations, continuous history, monitoring locations, and time-series metadata. Follow returned pagination links; validate the source host before attaching credentials. Discover and pin the appropriate sensor/time series rather than merging different series just because their parameter codes match. [S2, S3, S4]

Store original value/unit alongside any normalized display value. Preserve provisional/approved status and qualifiers. A zero, a negative value, a missing value, and a censored/qualified value are different cases; validate them according to parameter semantics.

Use an environment secret for a production USGS key and send it in `X-Api-Key`. Do not put keys into browser code, logs, screenshots, or query strings. Keys provide higher rate limits; observe the response's rate-limit headers rather than hard-coding a guessed quota. [S4]

### NWS — automatic forecast and alerts

Resolve a reviewed coordinate using `/points/{latitude},{longitude}`, then follow the returned hourly/grid endpoint. Revalidate the grid mapping periodically. Use an identifying User-Agent, cache responses, and respect provider errors. Separate forecast weather from station observations; rain probability is not rainfall amount. [S5]

Start with only the fields actually consumed by the UI. More complicated sky-cover or precipitation features belong behind explicit schema handling, not arbitrary conversions from text descriptions.

### ODFW — linked and reviewed context first

The Central Zone recreation report provides dated fishing context. Stocking schedules identify a **week**, not the exact delivery day, and are subject to change. Store `scheduled_week_start` separately from `confirmed_stocked_at`; never generate the latter from the former. [S10, S11]

For the first version, link to official material and support short manually reviewed summaries with citations. Before scheduled ingestion, confirm permitted retrieval/reuse, fetch behavior, parser reliability, and editorial requirements. Do not republish long passages or assume all state-site text and imagery can be reused without restriction.

Annual rules, in-season changes, and location/species exceptions need separate review. A weekly fishing report alone is not a complete rule engine. Species-specific closures must not be mislabeled as closure of the entire water, and an open-water label must not imply all species are open.

### Sources deliberately deferred

TroutRoutes licensing; statewide access/property layers; fish passage/escapement feeds; reservoir operator feeds; verified user catch reports; automatic video publishing. Each can be added with its own source contract and coverage test. No scraped catch-photo locations or private catch-log uploads.

## 6. Forecast policy: useful without invented certainty

The earlier sample 8.5/10 forecast in the conversation was illustrative, not an actual forecast. It must not enter the app as a real observation or training label.

**Initial public product:** measured conditions, forecast weather, dated fishing context, and an explained planning outlook. Do not launch a numeric bite score by selecting arbitrary weights that merely sum to 100.

**Later optional index:** a transparent, versioned heuristic for a specific water/reach, target species, method, and date. Label it experimental until evaluated against real outcomes. An 8/10 would mean a relative index, never an 80% catch probability.

Keep four things separate:

- **Eligibility:** known rules and closures for the requested species/method/date/reach.
- **Conditions:** measured flow/temperature and forecast weather, with provenance.
- **Data coverage:** which relevant inputs exist, how fresh they are, and how representative their location is. This is not a prediction confidence percentage.
- **Planning outlook:** an interpretation of those inputs and a clear explanation of what is uncertain.

### Gates before ranking

A verified closure removes the affected option from recommendations. Unverified regulations leave the option unranked with a verification notice. Relevant hazards trigger a warning or suppression according to a reviewed policy; lack of an alert is not proof of safe wading or boating. Unknown critical data lowers coverage or prevents an outlook rather than receiving a neutral score.

Any numerical threshold used for freshness, flow change, wind, or water temperature must state whether it is an operational rule, a researched species-specific guide, or a fitted parameter. Do not present a developer threshold as a biological discovery.

### Suggested windows and techniques

A suggested window must say what it optimizes: e.g., a reviewed weather/comfort window versus a biological feeding hypothesis. Do not automatically call one hour before and after sunrise the best fishing time. Use broad, supported windows rather than unsupported minute-level claims. Legal fishing times remain a separate constraint.

Technique recommendations come from curated, attributed water/species guides and the rules check. They are not generated freely by a language model. If no vetted technique exists, show that limitation. Water-specific artificial-only, fly-only, hook, bait, and seasonal restrictions must be respected.

### Calibration later

Collect opt-in trip outcomes with effort duration, species, method, reach, and conditions; include zero-catch trips. Do not import private Redside logs automatically. Compare a proposed index against a simple seasonal baseline on held-out dates/waters. Report where the heuristic fails and avoid claiming calibration from a handful of successful trips.

## 7. Proposed build architecture

Keep the first project small: a TypeScript site and a dedicated Cloudflare Worker, with static assets and API routes in one deployment. Add scheduled refreshes and a small persistent cache/history store before public traffic. Cloudflare documents Worker static assets and Cron Triggers for these roles. [S12, S13]

Suggested logical flow:

```text
USGS / NWS                     ODFW links + reviewed entries
     |                                      |
source-specific adapters -------------------+
     |
validated, timestamped records
     |
shared cache / retained source snapshots
     |
rules + coverage checks + deterministic interpretation
     |
versioned forecast record
     +--> public website
     +--> later: original social-report template
     +--> later: optional Redside API consumer
```

Proposed refresh budgets, **not provider guarantees**: hydrology every 15–30 minutes; weather/alerts according to source caching and validity; editorial reports when updated/reviewed. Avoid per-visitor source requests. Use bounded retries with backoff and honor `Retry-After`.

Store UTC timestamps, plus each water's IANA timezone. Pilot display timezone is `America/Los_Angeles`; do not assume all future Oregon locations share it. Cloudflare cron expressions use UTC, so a desired local-time report needs daylight-saving-aware handling. [S13]

For launch, use `oregonfishforecast.com` as the canonical domain and a permanent path/query-preserving redirect from the short domain. Include www variants intentionally. Cloudflare supports Worker custom domains; creating or changing those bindings remains a separate deployment action after preview approval. [S14]

No paid subscriptions, ads, accounts, email collection, precise user tracking, or autonomous posting in the first milestone. No language-model API is required for the basic conditions page.

## 8. Data contracts

Every measurement needs at least:

```text
source_id, source_url, station_id, time_series_id, parameter_code
raw_value, raw_unit, normalized_value (nullable), normalized_unit (nullable)
observed_at, retrieved_at, approval_status, qualifiers
quality_status, mapping_status
```

Every forecast needs issue time plus valid start/end. Every editorial statement needs a source and review date. Every derived metric needs its input record IDs and calculation version.

Recommended public response shape:

```text
water_id, reach_id, target_species, timezone
coverage_status, updated_at
observations[], weather_periods[], source_health[]
regulations_status, restrictions[], official_links[]
outlook {status, reasons[], limitations[], model_version}
suggested_windows[], reviewed_techniques[]
```

Use `null`/explicit status for unknown values. Do not encode a missing temperature as zero. `updated_at` is merely the response/build time; it must not replace individual source times. The first release can have empty windows and techniques until reviewed.

## 9. Website and content design

The first home page should offer a short Central Oregon water list with honest coverage labels and the first functioning detail page. Avoid showing “coming soon” waters as live forecasts.

Use an original, clean outdoor/editorial style: strong typography, spacious cards, highly legible mobile charts, and subtle fishing/river illustration where helpful. Do not reproduce the reference account's logo or layouts. A useful screen matters more than decorative animation.

Build these views in order: water detail, coverage/home list, sources/methodology. Add stocking and weekend comparison once their underlying data and editorial workflow are ready. Save login/community features for later.

The same **approved snapshot** should eventually power a social report: water/species/date → observed change → explained planning window → reviewed technique → source/freshness footer → site address. Corrections should be traceable to the published snapshot. Start with manual review/export; automatic posting is a separate integration and authorization step.

## 10. Delivery sequence

**Milestone A — one working conditions page:** validate the two source adapters in the target environment; inspect sensor metadata; implement normalization/freshness; build the Lower Deschutes page; run automated and mobile tests.

**Milestone B — reviewed outlook:** complete reach/access/regulations and technique entries; add deterministic explanations; document uncertainty. Do not introduce a numeric index just to fill a card.

**Milestone C — pilot expansion:** add the other five areas only after each has an approved source mapping and coverage status. Lakes may legitimately have weather/report information without a live water sensor.

**Milestone D — content workflow:** produce the first source-linked social report from the exact website snapshot, review it, and export. No unattended publication.

**Milestone E — statewide and validation:** expand by region, test model skill against baselines, and revisit licensed sources including TroutRoutes.

## References — checked October 7, 2026

Identifiers match `sources.json`. Official pages can change; recheck before implementation or publication.

[R1] Redside README: https://github.com/Kenny-Yukich/Redside/blob/main/README.md  
[R2] Redside conditions code: https://github.com/Kenny-Yukich/Redside/blob/main/js/conditions.js  
[S1] USGS retirement notice: https://waterdata.usgs.gov/blog/api-waterservices-decom  
[S2] USGS migration guide: https://api.waterdata.usgs.gov/docs/ogcapi/migration/  
[S3] USGS OGC API overview: https://api.waterdata.usgs.gov/docs/ogcapi/  
[S4] USGS keys: https://api.waterdata.usgs.gov/docs/ogcapi/keys/  
[S5] NWS API: https://www.weather.gov/documentation/services-web-api  
[S6] Open-Meteo terms: https://open-meteo.com/en/terms  
[S7] Madras station: https://waterdata.usgs.gov/monitoring-location/USGS-14092500/  
[S8] Culver station: https://waterdata.usgs.gov/monitoring-location/USGS-14076500/  
[S9] Historical Crooked station: https://waterdata.usgs.gov/monitoring-location/USGS-14080500/  
[S10] ODFW Central Zone report: https://myodfw.com/recreation-report/fishing-report/central-zone  
[S11] ODFW stocking: https://myodfw.com/fishing/species/trout/stocking-schedule  
[S12] Cloudflare static assets: https://developers.cloudflare.com/workers/static-assets/  
[S13] Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/  
[S14] Cloudflare custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/  
[S15] USGS latest-continuous fields: https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/queryables?f=html
