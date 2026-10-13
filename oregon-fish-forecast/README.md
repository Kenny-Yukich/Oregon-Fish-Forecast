# Oregon Fish Forecast

An illustrated Oregon water guide with a searchable, filterable table: five gauge-backed conditions pages and 19 source-linked water profiles. This project is isolated from Redside. The website has not been deployed or connected to the purchased domains.

The four previously proposed waters now have guide pages: Crooked River below Bowman Dam, Fall River above the falls, Haystack Reservoir, and Lake Billy Chinook's Crooked River arm. Ten additional river areas and five lakes/reservoirs extend the guide statewide. These are established destinations selected from official fishing guides, not a statistically ranked popularity list. All 24 waters have independent editorial planning records, reviewed October 12, 2026. They include seasonal context, access descriptions, methods, dated ODFW reports, and relevant documented advisories; they do not establish a comprehensive current rules or access check.

Each water carries a species list (`shared/species.ts`): which fish live there, the months each is a realistic target, the months most anglers are after it, and peak months for runs and hatches. The worker scores every in-season species (`worker/score.ts`) from flow vs. normal, water temperature, the 24-hour trend, and time of year, using per-species comfort bands; the board shows the score for the month's main target, and a water's page shows every species with the full breakdown. Scores go partial, with the missing input named, rather than disappearing when a sensor is down; they never show without at least one measured input. The formula is published on the approach page.

The homepage preserves the field-guide artwork and simple table. The default trip-planning view shows water, target species, drive time, access, seasonal outlook, current conditions, alerts, and last verified. A separate gauge view retains flow, historical comparisons, temperature, trend, scores, and measurement times. Reports keep their own dates and coverage; undated or older reports cannot masquerade as live observations. Search matches names, reaches, species, and regions. Filters show all waters, rivers, lakes/reservoirs, or waters with connected readings. Every row opens its own page, including direct and trailing-slash URLs.

Driving directions default to Portland, Oregon; the starting town remains editable. Routes use the named public access destination. The app does not invent travel durations or treat gauge coordinates as public access. Opal Springs and Grandview currently have no verified route destination. Known lower Deschutes species restrictions withhold the old numerical score, including on retained API snapshots; this does not label the entire river closed.

Gauges are configured in `shared/waters.ts`; every station number, name, coordinate, and series id there was read from the USGS API on the recorded date. The worker validates each gauge against the API before serving its readings. The independent profile catalog is `shared/catalog.ts`. Its `source_checked_on` date records background-source review, not a field visit, measurement, rules verification, or confirmation that an access point is currently open. A guide page requires no conditions API request. Styling lives in `src/styles.css`, the board in `src/home.ts`, and guide pages in `src/profile.ts`.

River additions: Columbia, Rogue, mainstem Umpqua, McKenzie, Willamette, Clackamas, Sandy, Wilson, North Fork Nehalem, and Siletz. Lake additions: Diamond, Detroit, Henry Hagg, Odell, and Wallowa. Each entry identifies a local reach or access area and links the official sources used for its species and access context.

## Run locally

Requires Node.js 24 or newer and npm. From this directory:

```powershell
npm ci
npm run dev
```

Open <http://127.0.0.1:8787>. The detail page is `/waters/lower-deschutes-warm-springs-trout-creek`. `npm run dev` builds the frontend and runs Wrangler locally; it does not deploy. Restart it after changing frontend files, or run `npm run dev:web` in a second terminal for Vite's frontend development server with `/api` proxied to port 8787.

Real upstream data is requested by the Worker, never directly by the browser. USGS can work without a key. If one is available, copy `.dev.vars.example` to `.dev.vars` and set `USGS_API_KEY` locally. Never put it in a Vite variable, browser bundle, URL, or committed file.

An unreachable source produces an unavailable state or a labeled retained snapshot. Production does not silently substitute fixture values. Browser tests intercept the API with synthetic records solely to exercise display states.

For an explicitly labeled, local-only NWS smoke test at the gauge coordinate, use `npm run dev:gauge-weather` instead of `npm run dev`. This uses real weather data for the gauge point, not an approved forecast for the fishing reach. Both the development flag and a loopback request are required.

## Checks

```powershell
npm test
npm run build
npm run check:worker
npm exec playwright -- install chromium
npm run test:browser
npm run probe:app -- --gauge-weather
```

`check:worker` is a local Wrangler bundle dry run, not a deployment. The original build-kit checks remain available one directory up:

`probe:app` exercises the TypeScript adapters against real providers and prints a concise validation snapshot. `--gauge-weather` explicitly includes the unreviewed gauge coordinate for this read-only smoke test. It does not enable reach weather in production.

```powershell
python -m unittest discover -s tests -v
python probe_sources.py --output source-check.json
```

If the execution sandbox blocks package downloads, upstream network calls, or Windows child processes, run those commands in a normal local terminal or with the environment's authorized network/process permission. A sandbox failure does not establish an upstream outage.

## Structure

- `src/`: TypeScript UI, routing, accessible charts, and responsive CSS.
- `shared/types.ts`: versioned conditions response and field provenance.
- `shared/catalog.ts`: independent guide profiles, named reaches, species, access context, and official source links.
- `shared/planning.ts`, `planning-central.ts`, and `planning-statewide.ts`: linked planning records for all 24 water IDs, with report coverage, original dates, advisory evidence, and named route destinations.
- `worker/`: USGS v1/NWS adapters, validation, retained source caching, and API route.
- `tests/`: adapter, cache, gating, and browser behavior checks.
- `wrangler.jsonc`: separate Worker and static assets; no custom domains or deployment script.

The API is `GET /api/v1/board` for the live-gauge portion of the table and `GET /api/v1/conditions/<water-id>` for one gauged water, where the ids are those in `shared/waters.ts`. The frontend combines that response with the independent guide catalog; guide IDs have no conditions endpoint. Times are stored in UTC and displayed in `America/Los_Angeles`. The response generation time is separate from each observation time and retrieval time.

## Release limits

The Madras gauge is a candidate proxy, not a reading at every fishing location. Sensor identity and reach representativeness are distinct checks. The supplied gauge coordinate is not an approved fishing destination or reviewed reach forecast point. Reach weather stays withheld until an approved point is recorded.

Comprehensive rules and current access remain unverified. Specific dated restrictions and advisories are surfaced, with source links; an unlisted alert never means a water is safe. Editorial reports and advisories are manually reviewed snapshots, not automated feeds. The existing experimental gauge scores are not catch probabilities and are withheld where the reviewed restrictions conflict with their targets. Guide-only entries have no scores. Method notes are attributed guide context subject to the exact species, section, and current rules. There are no logins, billing, trackers, or AI services.

The initial source cache reduces repeated calls within a Cloudflare location and coalesces concurrent requests in a Worker instance. Cache eviction, another location, or another instance can still cause a new source request. Durable shared storage and scheduled refresh must be evaluated before public traffic; this local milestone does not claim a globally synchronized ingestion service.

See [VERIFICATION.md](./VERIFICATION.md) for evidence from this build and [PREVIEW_PLAN.md](./PREVIEW_PLAN.md) for the approval-gated release procedure.

## Official implementation references

- [Cloudflare Worker static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Wrangler installation and supported Node versions](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [Vite getting started](https://vite.dev/guide/)
- [USGS modern API migration](https://api.waterdata.usgs.gov/docs/ogcapi/migration/)
- [USGS API overview](https://api.waterdata.usgs.gov/docs/ogcapi/)
- [NWS web API documentation](https://www.weather.gov/documentation/services-web-api)

Tooling versions are pinned in `package.json` and `package-lock.json`; selected from the npm registry after checking the official implementation documentation on October 7, 2026.
