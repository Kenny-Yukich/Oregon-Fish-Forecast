# Milestone A verification

Build date: October 7, 2026. Local implementation only; no deployment, DNS change, paid-service enrollment, or Redside modification.

## Real upstream evidence

The original Python probe first failed inside the network-restricted sandbox. Rerunning the same read-only command with authorized network access succeeded for both providers. The full local `../source-check.json` is ignored by version control; the following describes that historical validation result, not current conditions.

- Probe completed at `2026-10-07T13:12:38.976745Z`.
- USGS latest-continuous returned station `USGS-14092500`, **Deschutes River Near Madras, OR**. All three observations below were marked **Provisional**, with null qualifiers and measurement time `2026-10-07T12:30:00Z`.

| Parameter | Time-series ID | Original unit | Value in inspected response |
| --- | --- | --- | --- |
| Discharge, `00060` | `47492ea9b75943f897a02eb01b0b4483` | `ft^3/s` | 3630 |
| Gauge height, `00065` | `1bbe6876316b47ffb21c5599f7e2238d` | `ft` | 2.68 |
| Water temperature, `00010` | `40a81e5a03e644ebbad40c3d86380654` | `degC` | 14.7 |

- A separate monitoring-location response confirmed the station identity and point coordinates `44.7259522504172, -121.246993886344`.
- Actual time-series metadata matched all three pinned IDs, station, parameters, and units. Records were `Primary`, `Points`, `Instantaneous`, statistic `00011`; the published gap interval was `PT1H12M`. Discharge references stage as its parent series; filtering out every derived series would incorrectly exclude this flow sensor.
- A continuous-data request for the pinned discharge series returned 95 records for the inspected 24-hour interval, with timestamps, feature IDs, original units, approval state, and qualifiers. This established actual history retrieval, not a trend fabricated from the latest value.
- NWS `/points/44.7260,-121.2470` returned `/gridpoints/PDT/44,71/forecast/hourly`. The inspected forecast was issued `2026-10-07T11:01:03Z` and contained 156 periods. The first period was valid `2026-10-07T06:00:00-07:00` through `07:00:00-07:00` and reported 49°F air temperature. This verifies the gauge-coordinate smoke test only; it does not approve that point for the fishing reach.

Official contracts: [USGS v1](https://api.waterdata.usgs.gov/docs/ogcapi/), [USGS migration](https://api.waterdata.usgs.gov/docs/ogcapi/migration/), [NWS API](https://www.weather.gov/documentation/services-web-api).

## Checks run

- Original starter suite: `python -m unittest discover -s tests -v` — **17 passed**.
- Original live probe: `python probe_sources.py --output source-check.json` — both providers received with authorized network access.
- Pinned dependency installation and lockfile generation completed.
- Application validation: `npm test` — **26 tests passed**, including source identity, units, timestamps, missing values, independent outages, cache retention/coalescing, retry limits, incomplete pagination, recommendation gates, and native Worker fetch binding.
- TypeScript integration probe: `npm run probe:app -- --gauge-weather` — **passed** at `2026-10-07T13:20:08.781Z`. Three validated observations; 285 continuous flow records across the requested 72 hours; 156 hourly weather periods; a valid empty active-alert response. All source states were current under the documented operational thresholds. Weather was explicitly marked `gauge_smoke_test`.
- The inspected 72-hour history ran from `2026-10-04T13:30Z` (3700 cfs) to `2026-10-07T12:30Z` (3630 cfs), with no detected gaps and a −70 cfs endpoint change. This is historical build evidence, not a live report.

- Application build and type checking: `npm run build` — passed.
- Worker packaging: `npm run check:worker` — local dry run passed; no upload or deployment. Actual startup caught named helper exports in the entry module; a dedicated handler-only `worker/entry.ts` resolved this runtime constraint.
- Browser suite: `npm run test:browser` — **22 Chromium checks passed** against the local Wrangler server, covering 320px/375px layouts, keyboard controls, provenance, missing values, chart gaps, source isolation, stale/expired snapshots, failed refresh, alerts, trailing-slash navigation, and closed/unknown regulations. These use clearly identified test-only intercepted API fixtures.
- Actual workerd source check at `2026-10-07T13:30Z` — USGS observations, 284 history points, NWS 156 hourly periods, and alerts all received. This check caught and fixed a native `fetch` receiver-binding issue that Node's adapter probe alone did not expose. NWS was explicitly enabled only for a localhost gauge-coordinate smoke test.
- Desktop and mobile screenshots were captured from the real local app, with no injected API data; no browser page errors or horizontal overflow were reported. Latest captures are in the ignored `artifacts/` directory.
- Final `npm run check` passed all 26 data tests, both TypeScript configurations, Vite production build, and Wrangler dry run. The final chart-label adjustment was followed by another `npm run test:browser`: **22 passed**.
- Final `npm exec tsx -- scripts/capture-local.ts` passed: the rendered desktop and mobile pages showed the real provisional USGS readings with original measurement times. Consecutive local API requests reused the same source retrieval timestamp and returned `from_cache: true`, 284 history records, `weather.point_status: not_reviewed`, and `outlook.status: withheld`.

## Files added or changed

All application code lives in the new `oregon-fish-forecast/` subfolder. Added frontend files (`src/main.ts`, `src/styles.css`, `index.html`, `public/favicon.svg`), six Worker modules, shared response types, exact dependency versions and lockfile, Vite/TypeScript/Wrangler configuration, 26 data tests, 22 browser checks with test-only fixtures, two local inspection scripts, and README/verification/preview-plan documentation. The build kit's root `.gitignore` was expanded for generated artifacts. Its original brief, registries, source probe, and starter tests were preserved. No Git repository or remote was created.

## Remaining release gates

### Visual refresh — October 7, 2026

Applied the user's exact reference colors: blue `#002A86`, gold `#FFEA0F`, plus evergreen `#285D45`. Added a dedicated `src/theme.css` layer and original `src/artwork.ts` landscape; updated the hero, navigation, typography, card layout, favicon, and browser theme color. All presentation animation and transitions are disabled. Navigation, filters, and data controls remain functional.

Visually inspected the user-supplied [Awsmd](https://awsmd.com/), [Genrod](https://www.genrod.com.ar/home), and [Lounge Lizard Imagine](https://www.loungelizard.com/work/imagine/) references in Chromium. Adapted their large headline scale, open spacing, rounded elements, and prominent static visuals with original Oregon artwork.

`npm run build` passed. The seven existing mobile-layout and keyboard-navigation checks passed at 320px/375px. Desktop/mobile captures of all three app views showed no browser page errors or horizontal overflow. Screenshot review also corrected missing spaces where mobile styling hides line breaks. Backend data logic was not changed by this visual refresh.

## Remaining release gates

- Hydrological representativeness of the Madras gauge for the entire proposed Warm Springs–Trout Creek reach.
- Reviewed reach weather coordinate; production reach weather is withheld pending this record.
- Exact boundaries, bank access, land jurisdiction, and species/method/date-specific annual and in-season rules.
- Reviewed ODFW summary and technique entries. Official links alone are not editorial approval.
- Persistent, shared source storage and scheduled refresh appropriate to public traffic; the initial cache is best effort per location/instance.
- Approved preview target, preview deployment, actual Cloudflare-environment integration checks, and subsequent public-release review.

The remaining gates prevent a claim of a deployed or validated fishing forecast. They do not prevent local use of the clearly attributed conditions page.
