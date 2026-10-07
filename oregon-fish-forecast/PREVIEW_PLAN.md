# Preview deployment plan — not executed

The build-kit instructions explicitly require approval before deployment. This is a reviewable plan, not authorization to publish. Local development and dry-run bundling do not create a Worker or modify DNS.

1. Review the local app, source validation evidence, browser checks, unresolved data issues, and any remaining errors in `VERIFICATION.md`.
2. Complete review of the exact target reach, access boundaries, gauge representativeness, a reach weather point, and the applicable regulation scope. If a private technical preview precedes editorial review, retain every unverified label and withheld recommendation.
3. Choose an isolated Cloudflare account/Worker preview configuration. Confirm the plan's costs and permissions. Use a distinct preview name, no purchased-domain routes, and no Redside resources. Add a server-side USGS secret only through the authorized secret mechanism if available.
4. Decide whether the preview needs restricted access. Add a persistent shared cache and reviewed refresh schedule before opening public traffic. Do not treat the Cache API as a global database.
5. Rerun `npm ci`, `npm test`, `npm run build`, `npm run check:worker`, and `npm run test:browser`. Check that production cannot activate development fixtures or the unreviewed gauge weather point.
6. Present the exact target, preview access policy, final configuration diff, validation results, and deployment command for **explicit user approval**. Execute deployment only after approval.
7. Inspect the deployed preview's actual USGS/NWS responses, cache behavior across visits, stale/outage states, mobile routes, and content. Record the result and return the preview URL for review.
8. Treat domain bindings, permanent redirects, public launch, paid services, social publication, and integration with Redside as separate later actions. None is included in this milestone.
