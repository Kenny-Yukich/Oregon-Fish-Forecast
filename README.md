# Oregon Fish Forecast

A local Oregon fishing guide with an illustrated homepage and a searchable table of 24 waters. Every row includes sourced species, access, seasonal context, dated reports, advisory links, and a source-review date. Five Central Oregon reaches also have gauge-backed conditions pages.

Reach, current access, and comprehensive regulation reviews remain incomplete. Reports retain their original dates and geographic scope; source-review dates never replace observation dates. Directions use a visitor's starting town and a documented access destination; drive times are requested from Maps. This repository contains the app and design explorations; no live deployment is represented here.

## Homepage concepts

Three Higgsfield design explorations, in review order:

1. [First Light Immersion](homepage-exploration/1-first-light-immersion.png) — a large scenic hero and prominent Lower Deschutes entry point.
2. [River Country Editorial](homepage-exploration/2-river-country-editorial.png) — warm paper, large typography, and a river directory.
3. [Conditions Field Guide](homepage-exploration/3-conditions-field-guide.png) — a practical layout that brings the conditions page forward.

See the [concept gallery](homepage-exploration/README.md) for all three images. Landscape imagery is illustrative.

## Repository layout

- [`oregon-fish-forecast/`](oregon-fish-forecast/) — TypeScript frontend, Cloudflare Worker, source adapters, and app tests.
- [`homepage-exploration/`](homepage-exploration/) — generated homepage concepts and design prompts.
- [`logo-exploration/`](logo-exploration/) — River Country logo explorations, SVGs, and comparison renders.
- [`BUILD_BRIEF.md`](BUILD_BRIEF.md), [`sources.json`](sources.json), and [`waters.json`](waters.json) — product scope and source/coverage records.
- [`probe_sources.py`](probe_sources.py) and [`tests/`](tests/) — standalone source probe and offline checks.

## Run locally

Requires Node.js 24 or newer and npm. From the repository root:

```powershell
cd oregon-fish-forecast
npm ci
npm run dev
```

Open <http://127.0.0.1:8787>. See the [app README](oregon-fish-forecast/README.md) for configuration and [validation commands](oregon-fish-forecast/README.md#checks), plus the [verification record](oregon-fish-forecast/VERIFICATION.md) for current limitations.

Keep API credentials in local ignored files or environment variables. Never commit keys or populate example files with real credentials.
