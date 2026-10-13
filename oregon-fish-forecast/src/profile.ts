import type { WaterProfile } from '../shared/catalog';
import type { PlanningSource, WaterPlanning } from '../shared/planning-types';
import { findPlanning, directionsUrl } from '../shared/planning';

interface ProfileView {
  esc: (value: unknown) => string;
  officialLink: (label: string, url: string, className?: string) => string;
  origin: string;
}

/** A calendar source-review date, not a live observation timestamp. */
export function profileDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(parsed)
    : 'Not checked';
}

export function reportLabel(report: WaterPlanning['report']): string {
  if (!report.reported_on) return 'Undated report';
  const ageDays = (Date.now() - Date.parse(`${report.reported_on}T12:00:00Z`)) / 86_400_000;
  return `${ageDays > 7 ? 'Historical report' : 'Report dated'} · ${profileDate(report.reported_on)}`;
}

/** Editorial guidance is rendered separately from gauges and their freshness state. */
export function planningSections(plan: WaterPlanning, view: ProfileView, extraSources: PlanningSource[] = []): string {
  const { esc, officialLink } = view;
  const route = directionsUrl(plan, view.origin);
  const sources = [...new Map([...plan.sources, ...extraSources].map(source => [source.url, source])).values()];
  return `<div class="water-planning-details">
    <p class="profile-review">Guide checked <time datetime="${esc(plan.checked_on)}">${esc(profileDate(plan.checked_on))}</time> · Source review date; measurements and reports retain their own dates.</p>
    <section class="panel" aria-labelledby="planning-species-title"><h2 id="planning-species-title">What can I catch?</h2><ul class="profile-species">${plan.target_species.map(species => `<li>${esc(species)}</li>`).join('')}</ul><p class="panel-footnote">Documented targets, subject to species-specific rules. Presence does not establish an open season or a current catch rate.</p></section>
    <section class="panel" aria-labelledby="planning-access-title"><h2 id="planning-access-title">Where can I access the water?</h2><p>${esc(plan.access_detail)}</p>
      <div class="detail-directions"><label for="trip-origin">Driving from</label><input id="trip-origin" type="text" value="${esc(view.origin)}" placeholder="Your town, Oregon" autocomplete="off">${route ? officialLink('View drive time in Google Maps', route) : `<span>${plan.access_point ? 'Add a starting town to view the route and drive time.' : 'A public driving destination has not been verified for this reach.'}</span>`}</div>
      ${plan.access_point ? `<p class="panel-footnote">Destination: ${esc(plan.access_point.label)}. Confirm openings, road conditions, permits, and parking with the land manager.</p>` : ''}
    </section>
    <section class="panel" aria-labelledby="planning-methods-title"><h2 id="planning-methods-title">How should I fish it?</h2><p>${esc(plan.methods)}</p><p class="panel-footnote">Methods describe the source’s fishing context. Current species, tackle, and section rules take precedence.</p>${officialLink('Current fishing regulations', 'https://myodfw.com/fishing/regulations')}</section>
    <section class="panel profile-conditions" aria-labelledby="planning-outlook-title"><h2 id="planning-outlook-title">Is it worth going right now?</h2>
      <h3>Seasonal outlook</h3><p>${esc(plan.seasonal_detail)}</p>
      <div class="dated-report"><h3>${esc(reportLabel(plan.report))}</h3><p>${esc(plan.report.summary)}</p><p class="panel-footnote">Coverage: ${esc(plan.report.coverage)}. Source checked ${esc(profileDate(plan.report.checked_on))}. ${plan.report.reported_on ? 'This report is dated context, not a live measurement.' : 'No water-specific report date is available; this does not establish today’s conditions.'}</p>${officialLink('Read the official fishing report', plan.report.url)}</div>
      ${plan.score_notice ? `<p class="source-restriction"><strong>Fishing restriction</strong> ${esc(plan.score_notice)}</p>` : ''}
      <h3>Alerts & notices</h3><ul class="planning-alerts">${plan.alerts.length ? plan.alerts.map(alert => `<li><strong>${alert.status === 'advisory' ? 'Source advisory' : 'Current status unverified'}</strong><p>${esc(alert.summary)}</p>${officialLink('Check the source', alert.url)}${alert.checked_on ? `<span class="cell-meta">Source checked ${esc(profileDate(alert.checked_on))}</span>` : ''}</li>`).join('') : '<li>Current alerts have not been verified.</li>'}</ul><p class="panel-footnote">The absence of a listed alert does not establish safe conditions or permission to fish.</p>
    </section>
    <section class="panel profile-sources" aria-labelledby="planning-sources-title"><h2 id="planning-sources-title">Sources behind this guide</h2><ul>${sources.map(source => `<li>${officialLink(source.label, source.url)}</li>`).join('')}</ul></section>
  </div>`;
}

export function profilePage(profile: WaterProfile, view: ProfileView): string {
  const { esc, officialLink } = view;
  const plan = findPlanning(profile.id);
  return `<main id="main" class="detail-main profile-main wrap"><a class="text-link back-to-waters" data-nav href="/">← All waters</a>
    <header class="page-title"><div><p class="eyebrow">${esc(profile.region)} · ${esc(profile.kind)}</p><h1>${esc(profile.name)}</h1><p>${esc(profile.reach)}</p></div><span class="profile-status">Fishing guide</span></header><p class="profile-intro">${esc(profile.description)}</p>
    <p class="guide-availability">Live readings not connected. Use the dated source context below.</p>
    ${plan ? planningSections(plan, view, profile.sources) : `<section class="panel"><h2>Source context</h2><p>${esc(profile.access_summary)}</p><ul class="profile-species">${profile.species.map(species => `<li>${esc(species)}</li>`).join('')}</ul>${profile.sources.map(source => officialLink(source.label, source.url)).join('')}<p>Further planning details have not been reviewed.</p></section>`}
  </main>`;
}
