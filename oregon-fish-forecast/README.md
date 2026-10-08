# Oregon Fish Forecast

Milestone A: a local, mobile-first Lower Deschutes conditions page, a six-area coverage page, and a methodology page. This project is isolated from Redside. The website has not been deployed or connected to the purchased domains.

The site displays source observations and their limitations. Fishing outlooks, windows, and techniques remain withheld until reach, access, and regulation reviews are complete. The five additional waters are proposed coverage only.

The homepage now follows the selected Conditions Field Guide design: the changing-weather fish brands the header and footer, a separate landscape illustration fills the hero, and the main action opens the existing Lower Deschutes conditions page. Proposed-water rows expand to explain their review status. The supplied Deschutes and Metolius photographs remain labeled as regional scenery.

The selected reference is `../homepage-exploration/3-conditions-field-guide-landscape-v3.png`. Homepage layout lives in `src/home.ts` and `src/field-guide.css`; optimized brand assets and their generation prompts live in `public/brand/`. See [design-qa.md](./design-qa.md) for the visual comparison and checks. With the local server running, `npx tsx scripts/capture-field-guide.ts` reproduces desktop/mobile screenshots and the combined reference comparison in ignored `artifacts/field-guide/`.

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
- `worker/`: USGS v1/NWS adapters, validation, retained source caching, and API route.
- `tests/`: adapter, cache, gating, and browser behavior checks.
- `wrangler.jsonc`: separate Worker and static assets; no custom domains or deployment script.

The API is `GET /api/v1/conditions/lower-deschutes-warm-springs-trout-creek`. Times are stored in UTC and displayed in `America/Los_Angeles`. The response generation time is separate from each observation time and retrieval time.

## Release limits

The Madras gauge is a candidate proxy, not a reading at every fishing location. Sensor identity and reach representativeness are distinct checks. The supplied gauge coordinate is not an approved fishing destination or reviewed reach forecast point. Reach weather stays withheld until an approved point is recorded.

Rules and access are explicitly not verified. An ODFW report link is not a reviewed regulations record. There are no bite scores, generated technique recommendations, logins, billing, trackers, or AI services.

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
