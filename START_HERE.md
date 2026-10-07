# Start here

This is a build kit, not a deployed website. Keep it outside Redside.

Open a new folder named `oregon-fish-forecast` in your coding workspace. Place this kit inside that folder. Give your coding agent the prompt below.

## First coding prompt

```text
Build the first working milestone of Oregon Fish Forecast.

Read BUILD_BRIEF.md, sources.json, waters.json, and VERIFICATION.md before making changes. These files describe the product and explicitly separate verified facts from proposed implementation choices. Inspect the workspace first; do not overwrite existing work. Keep all work isolated from Redside and redside-advisor. Do not deploy, alter DNS, create paid services, or publish social posts.

Implement Milestone A only: a mobile-first Lower Deschutes conditions page plus a minimal home/coverage page and methodology page. Use a dedicated Cloudflare Worker/static-asset deployment with TypeScript and a small maintainable front end. Choose currently supported dependencies from official documentation, pin versions, and include a lockfile. Do not add an AI dependency, login, billing, or a statewide map.

Start by running the included offline tests and source probe. The previous environment could not fetch the live JSON APIs; it verified documentation, not end-to-end data delivery. Resolve any schema issues by inspecting actual responses and official v1 documentation. Do not switch back to legacy USGS WaterServices. Use a secret USGS key only when available; never request secrets in chat or commit them.

Validate USGS-14092500 identity, current parameters, units, timestamps, qualifiers, and time-series mapping. This station is a candidate proxy for the proposed fishing reach, not automatically representative of every downstream spot. Validate a suitable reach weather coordinate before public release; the supplied coordinate is the gauge point for smoke testing only. Resolve NWS hourly endpoints through /points rather than inventing grid IDs.

Implement source adapters, field-level freshness, explicit missing/stale states, safe source caching, bounded retries, and a clearly labeled trend using actual historical data. Preserve observed_at separately from retrieved_at. Never fabricate values or pretend a request success makes an old measurement current. Failure of one source must not blank the other source or relabel stale cached data as live.

Implement the UI using real API responses when accessible. If upstream access fails, use visibly labeled developer fixtures behind an explicit development mode. Production must show unavailable states instead of silently using fixtures. Do not hard-code current fishing rules, generate unsupported technique recommendations, or add bite scores/suggested windows. Link to ODFW; identify regulations as not yet verified until a reviewed record exists.

Write tests for timestamps, missing/null/non-numeric values, units, same-station/time-series selection, source errors, stale cached values, incomplete pagination, and disabled recommendations for unknown/closed regulations. Include mobile browser checks, build/type checks, README commands, and a preview deployment plan that requires explicit approval before execution.

When done, report files changed, commands actually run, test results, remaining blockers, and whether any real upstream response was inspected. Provide the local run command and stop after Milestone A. Do not claim a deployed or accurate fish forecast just because a page renders.
```

## Included source probe

Python 3.10 or newer; no third-party dependencies. In this kit's directory:

```powershell
python -m unittest discover -s tests -v
python probe_sources.py --output source-check.json
```

An optional `USGS_API_KEY` environment variable is read without being printed. Do not commit `.env`, `.dev.vars`, secrets, or output containing personal data. The default weather coordinate is the officially published gauge location, not a reviewed public fishing destination.

The probe is an adapter smoke test: it checks that JSON records can be received and reports their source timestamps and age. Success is **not** proof of current, complete, geographically representative, or predictive data. It does not implement the forecast engine, history/trends, cache, regulations, or website.
