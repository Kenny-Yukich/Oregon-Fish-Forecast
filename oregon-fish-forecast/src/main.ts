import './styles.css';
import { home as homePage, type Sort, type SortKey, type WaterFilter, type BoardMode } from './home';
import { scorePanel } from './score-view';
import { profilePage, planningSections } from './profile';
import { findPlanning, planningScore } from '../shared/planning';
import { WATER_PROFILES, findProfile } from '../shared/catalog';
import { SPECIES } from '../shared/species';
import { WATERS, findWater, type Water } from '../shared/waters';
import type { Board, Conditions, HistoryPoint, Observation, Parameter, Trend } from '../shared/types';

const TIMEZONE = 'America/Los_Angeles';
const BOARD_PATH = '/api/v1/board';
const app = document.querySelector<HTMLDivElement>('#app')!;
const snapshots = new Map<string, Conditions>();
let board: Board | null = null;
let boardLoading = false;
let boardError = '';
let boardFetchedAt = 0;
let loading = false;
let requestError = '';
let trendHours = 72;
let lastRenderedPath = '';
let lastFetchAt = 0;
let sort: Sort = { key: 'default', dir: 1 };
let waterFilter: WaterFilter = 'all';
let waterQuery = '';
let boardMode: BoardMode = 'planning';
let tripOrigin = 'Portland, Oregon';
const currentPath = () => location.pathname.replace(/\/$/, '') || '/';
function currentWater(): Water | null {
  const match = /^\/waters\/([a-z0-9-]+)$/.exec(currentPath());
  return match ? findWater(match[1]!) ?? null : null;
}
function currentProfile() {
  const match = /^\/waters\/([a-z0-9-]+)$/.exec(currentPath());
  return match ? findProfile(match[1]!) : undefined;
}
const waterPath = (water: Water) => `/waters/${water.id}`;

const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const external = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" stroke-width="1.4"/></svg>';
const fish = '<img class="weather-fish" src="/brand/weather-fish.webp" width="720" height="348" alt="" decoding="async">';
function esc(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
function safeUrl(value: string): string { try { const url = new URL(value); return url.protocol === 'https:' ? esc(url.href) : '#'; } catch { return '#'; } }
function officialLink(label: string, url: string, className = '') { return `<a class="external-link ${className}" href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}${external}<span class="sr-only"> (opens in a new tab)</span></a>`; }
function date(value: string | null | undefined, short = false): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not available';
  return new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: short ? undefined : '2-digit', timeZoneName: short ? undefined : 'short' }).format(new Date(value));
}
function time(value: string | null | undefined, short = false): string {
  return value && Number.isFinite(Date.parse(value)) ? `<time datetime="${esc(value)}">${date(value, short)}</time>` : 'Not available';
}
const expired = (at: string | null | undefined, hours: number) => !at || Date.now() - Date.parse(at) > hours * 3600000;
function ageSnapshot(snapshot: Conditions | undefined, failedRefresh = false) {
  if (!snapshot) return;
  snapshot.observations.forEach(obs => { if (obs.quality_status === 'current' && (failedRefresh || expired(obs.observed_at, 2))) obs.quality_status = 'stale'; });
  const latestFlow = snapshot.observations.find(obs => obs.parameter_code === '00060');
  if (snapshot.trend.status === 'current' && (failedRefresh || latestFlow?.quality_status !== 'current')) snapshot.trend.status = 'stale';
  if (snapshot.normal?.status === 'current' && (failedRefresh || latestFlow?.quality_status !== 'current')) snapshot.normal.status = 'stale';
  if (snapshot.weather.status === 'current' && (failedRefresh || expired(snapshot.weather.issued_at, 6))) snapshot.weather.status = 'stale';
  const alertsSource = snapshot.source_health.find(source => source.source_id === 'nws_alerts');
  if (snapshot.alerts_status === 'current' && (failedRefresh || expired(alertsSource?.retrieved_at || null, 5 / 60))) snapshot.alerts_status = 'stale';
  snapshot.source_health.forEach(source => {
    const sourceExpired = source.source_id === 'usgs' ? !snapshot.observations.some(obs => obs.quality_status === 'current') : source.source_id === 'nws' ? snapshot.weather.status !== 'current' : snapshot.alerts_status !== 'current';
    if (source.status === 'current' && (failedRefresh || sourceExpired)) source.status = 'stale';
    if (failedRefresh) source.from_cache = true;
  });
}
function ageBoard(failedRefresh = false) {
  board?.rows.forEach(row => {
    for (const reading of [row.flow, row.height, row.temperature]) if (reading.status === 'current' && (failedRefresh || expired(reading.observed_at, 2))) reading.status = 'stale';
    if (row.status === 'current' && (failedRefresh || expired(row.flow.observed_at, 2))) row.status = 'stale';
    if (row.normal.status === 'current' && row.flow.status !== 'current') row.normal.status = 'stale';
  });
}
function number(value: number, max = 1) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: max }).format(value); }
function status(value: string | undefined, fallback = 'Unavailable') { const label = value === 'current' ? 'Current' : value === 'stale' ? 'Stale reading' : fallback; return `<span class="status status-${value || 'unavailable'}"><span></span>${label}</span>`; }

function header() {
  const path = currentPath();
  const link = (href: string, label: string) => `<a data-nav href="${href}" ${path === href ? 'aria-current="page"' : ''}>${label}</a>`;
  return `<a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="wrap header-inner"><a class="brand" data-nav href="/" aria-label="Oregon Fish Forecast home"><span class="brand-mark">${fish}</span><span class="brand-name">OREGON<span>FISH FORECAST</span></span></a><nav aria-label="Main navigation">${link('/', 'Conditions')}${link('/methodology', 'Our approach')}</nav></div></header>`;
}
function footer() {
  return `<footer class="site-footer"><div class="wrap footer-inner"><div><strong>Get to know the water.</strong><span>Oregon Fish Forecast · An Oregon water guide</span></div><nav aria-label="Footer"><a data-nav href="/">Conditions</a><a data-nav href="/methodology">Our approach</a></nav></div></footer>`;
}

function home() { return homePage({ board, loading: boardLoading, error: boardError, sort, filter: waterFilter, query: waterQuery, mode: boardMode, origin: tripOrigin, arrow, esc, number, time, date, status }); }

function metric(snapshot: Conditions | undefined, parameter: Parameter, label: string, unit: string) {
  const obs = snapshot?.observations.find(o => o.parameter_code === parameter);
  const available = obs?.normalized_value !== null && obs?.normalized_value !== undefined;
  return `<article class="metric-card"><h3>${label}</h3><div class="metric-value ${available ? '' : 'value-missing'}">${available ? number(obs!.normalized_value!, parameter === '00060' ? 0 : parameter === '00010' ? 1 : 2) : '—'}<span>${esc(obs?.normalized_unit || unit)}</span></div>${loading && !snapshot ? '<span class="status">Checking source…</span>' : status(obs?.quality_status)}<p class="metric-time">${available ? `Measured ${time(obs?.observed_at)}` : 'No validated reading available'}</p>${obs?.approval_status ? `<span class="metric-qualifier">${esc(obs.approval_status)}${obs.qualifiers.length ? ` · ${esc(obs.qualifiers.join(', '))}` : ''}</span>` : ''}</article>`;
}

function normalMetric(snapshot: Conditions | undefined) {
  const normal = snapshot?.normal;
  const available = normal?.median !== null && normal?.median !== undefined;
  const percent = normal?.percent_of_median;
  return `<article class="metric-card metric-normal"><h3>Typical flow for this date</h3><div class="metric-value ${available ? '' : 'value-missing'}">${available ? number(normal!.median!, 0) : '—'}<span>cfs</span></div>${available ? status(normal!.status) : status(undefined)}<p class="metric-time">${available ? `${percent === null || percent === undefined ? 'Current flow not comparable' : `Today’s flow is ${number(percent, 0)}% of typical`}` : esc(normal?.reason || (loading && !snapshot ? 'Checking daily history…' : 'No daily flow history available'))}</p>${available ? `<span class="metric-qualifier">Median within ${normal!.window_days} days of this date, ${normal!.first_year}–${normal!.last_year}</span>` : ''}</article>`;
}

function chart(snapshot: Conditions | undefined, trend: Trend | undefined) {
  const end = snapshot ? Date.parse(snapshot.updated_at) : Date.now();
  const start = end - trendHours * 60 * 60 * 1000;
  const points = (trend?.points || []).filter(p => Date.parse(p.observed_at) >= start && Date.parse(p.observed_at) <= end).sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
  const valid = points.filter((p): p is HistoryPoint & { value: number } => p.value !== null && Number.isFinite(p.value));
  if (valid.length < 2) return `<div class="chart-empty"><h4>${loading && !snapshot ? 'Checking the river record' : 'Waiting for a complete picture'}</h4><p>${esc(trend?.reason || 'A trend needs multiple validated readings from the same sensor. There isn’t enough history available to draw one yet.')}</p><span>Gaps stay gaps. Missing data is never filled in.</span></div>`;
  const width = 740, height = 260, left = 100, right = 20, top = 30, bottom = 44;
  const low = Math.min(...valid.map(p => p.value)), high = Math.max(...valid.map(p => p.value));
  const padding = Math.max((high - low) * .2, Math.abs(high) * .015, .5);
  const min = low - padding, max = high + padding;
  const x = (p: HistoryPoint) => left + (Date.parse(p.observed_at) - start) / (end - start) * (width - left - right);
  const y = (v: number) => top + (max - v) / (max - min) * (height - top - bottom);
  // Matches the pinned USGS sensor's reported PT1H12M gap tolerance.
  const gapThreshold = 72 * 60 * 1000;
  let path = '', previous: HistoryPoint | null = null, gap = false;
  for (const point of points) {
    if (point.value === null || !Number.isFinite(point.value)) { previous = null; gap = true; continue; }
    const connected = previous && Date.parse(point.observed_at) - Date.parse(previous.observed_at) <= gapThreshold;
    if (previous && !connected) gap = true;
    path += `${connected ? 'L' : 'M'}${x(point).toFixed(2)},${y(point.value).toFixed(2)} `;
    previous = point;
  }
  const grids = Array.from({ length: 4 }, (_, i) => { const v = min + (max - min) * i / 3; return `<line x1="${left}" y1="${y(v)}" x2="${width - right}" y2="${y(v)}" class="chart-grid"/><text x="${left - 12}" y="${y(v) + 4}" text-anchor="end">${number(v, 0)}</text>`; }).join('');
  const times = Array.from({ length: 3 }, (_, i) => { const time = start + (end - start) * i / 2; return `<text x="${left + (width - left -right) * i / 2}" y="${height - 10}" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}">${esc(date(new Date(time).toISOString(), true))}</text>`; }).join('');
  const label = trendHours === 168 ? '7 days' : `${trendHours} hours`;
  return `<div class="chart-unit">${esc(trend?.unit || 'Reported units')}</div><svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Measured river flow over the last ${label}. ${valid.length} readings. ${gap || trend?.has_gaps ? 'Includes data gaps.' : 'No gaps detected between available readings.'}">${grids}${times}<path d="${path}" fill="none" stroke="#2a6450" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${valid.map(p => `<circle cx="${x(p)}" cy="${y(p.value)}" r="2" fill="#2a6450"><title>${esc(date(p.observed_at))}: ${number(p.value)} ${esc(trend?.unit)}</title></circle>`).join('')}</svg><div class="chart-footer"><span><i></i>Observed flow · Same USGS time series</span><span>${gap || trend?.has_gaps ? 'Data gaps present' : 'Available observations shown'} · Pacific time</span></div>`;
}

function weatherPanel(snapshot: Conditions | undefined) {
  const weather = snapshot?.weather;
  const reviewed = weather?.point_status === 'reviewed';
  const smokeTest = weather?.point_status === 'gauge_smoke_test';
  const periods = reviewed || smokeTest ? (weather?.periods || []).filter(p => Date.parse(p.end_at) > Date.now()).slice(0, 6) : [];
  const alerts = reviewed ? snapshot?.alerts || [] : [];
  return `<section class="panel weather-panel" aria-labelledby="weather-title">
    <div class="panel-heading"><h2 id="weather-title">${smokeTest ? 'Gauge weather test' : 'Weather'}</h2><span class="panel-source">National Weather Service</span></div>
    ${smokeTest ? '<div class="fixture-notice"><strong>Development gauge smoke test.</strong> This forecast is for the gauge coordinates. The weather point has not been reviewed for this fishing reach or for access planning.</div>' : ''}
    ${periods.length ? `<div class="weather-meta">${status(weather?.status)}<span>Issued ${time(weather?.issued_at)}</span></div><div class="weather-periods">${periods.map(p => `<article><span class="weather-hour">${time(p.start_at, true)}</span><strong>${p.temperature === null ? '—' : number(p.temperature)}<span>°${esc(p.temperature_unit || '')}</span></strong><p>${esc(p.short_forecast)}</p><span>${p.precipitation_probability === null ? 'Rain chance unavailable' : `${p.precipitation_probability}% rain chance`}</span><span>${esc(p.wind_speed || 'Wind unavailable')} ${esc(p.wind_direction || '')}</span><span class="valid-until">Valid until ${time(p.end_at, true)}</span></article>`).join('')}</div><p class="panel-footnote">${esc(weather?.point_label)} · Retrieved ${time(weather?.retrieved_at)}. Rain chance is a probability, not a rainfall amount.</p>` : `<div class="quiet-state"><h3>${reviewed || smokeTest ? 'Forecast currently unavailable' : 'A local forecast needs a local check.'}</h3><p>${esc(weather?.reason || 'The representative weather point for this reach has not been reviewed. A nearby gauge location is not automatically the right forecast location.')}</p>${officialLink('Visit the National Weather Service', 'https://www.weather.gov/')}</div>`}
    <div class="alert-status"><div>${alerts.length ? `${status(snapshot?.alerts_status)}${alerts.map(a => `<p><strong>${esc(a.event)}</strong> · ${esc(a.headline)}<br>${officialLink('Read official alert', a.source_url)}<span>Effective ${time(a.effective_at)} · Expires ${time(a.expires_at)}</span></p>`).join('')}` : `<span>${reviewed && snapshot?.alerts_status === 'current' ? 'No active alerts returned for the reviewed point.' : 'Local alerts are not verified for this reach.'}</span><small>The absence of an alert does not establish safe river conditions.</small>`}</div></div></section>`;
}
function provenance(obs: Observation) {
  return `<div class="observation-record"><h4>${esc(obs.label)} ${status(obs.quality_status)}</h4><dl><div><dt>Measurement time</dt><dd>${date(obs.observed_at)}</dd></div><div><dt>Retrieved</dt><dd>${date(obs.retrieved_at)}</dd></div><div><dt>Original reading</dt><dd>${esc(obs.raw_value === null ? 'Unavailable' : obs.raw_value)} ${esc(obs.raw_unit)}</dd></div><div><dt>Time series</dt><dd>${esc(obs.time_series_id || 'Not verified')}</dd></div><div><dt>Approval & qualifiers</dt><dd>${esc(obs.approval_status || 'Not available')}${obs.qualifiers.length ? ` · ${esc(obs.qualifiers.join(', '))}` : ''}</dd></div><div><dt>Reach mapping</dt><dd>${esc(obs.mapping_status.replaceAll('_', ' '))}</dd></div></dl>${obs.issues.length ? `<p>${esc(obs.issues.join(' '))}</p>` : ''}${officialLink('View source record', obs.source_url)}</div>`;
}
function sourcePanel(snapshot: Conditions | undefined) {
  return `<section class="panel source-panel"><div class="panel-heading"><h2>Sources</h2></div>${snapshot?.source_health.length ? `<div class="source-rows">${snapshot.source_health.map(s => `<div class="source-row"><div><strong>${esc(s.label)}</strong><p>${esc(s.message)}</p><span>Retrieved ${date(s.retrieved_at)}${s.from_cache ? ' · Retained snapshot' : ''}</span><span>Last attempt ${date(s.last_attempt_at)}</span></div>${status(s.status)}</div>`).join('')}</div>` : `<p class="empty-source-copy">${loading ? 'Checking source status…' : 'Source status is unavailable. No measurements have been substituted.'}</p>`}<details class="source-details"><summary id="source-records-summary">View measurement records & provenance<span>+</span></summary><div class="source-detail-body"><p>Measurement time determines freshness. Retrieving or refreshing a record does not make its observation newer.</p>${snapshot?.observations.map(provenance).join('') || '<p>No measurement records are available.</p>'}${snapshot?.trend ? `<div class="trend-provenance"><h4>Trend calculation</h4><p>Version: ${esc(snapshot.trend.calculation_version)} · ${snapshot.trend.input_record_ids.length} input records · Series: ${esc(snapshot.trend.time_series_id || 'Unavailable')}</p><p>${esc(snapshot.trend.reason || 'Drawn from validated observations of the same parameter and time series. Missing values and intervals appear as gaps.')}</p></div>` : ''}</div></details><a class="text-link" data-nav href="/methodology">How we handle the data ${arrow}</a></section>`;
}
function detail(water: Water) {
  const snapshot = snapshots.get(water.id);
  const plan = findPlanning(water.id);
  const { gauge } = water;
  const ranges = [[24, '24 hours'], [72, '72 hours'], [168, '7 days']] as const;
  return `<main id="main" class="detail-main wrap"><header class="page-title"><div><h1>${esc(water.name)}</h1><p>${esc(water.reach)} · Readings from the USGS ${esc(gauge.label)}, a candidate proxy for this water · All times Pacific</p></div><button class="refresh-button" id="refresh" ${loading ? 'disabled' : ''}>${loading ? 'Checking sources…' : 'Refresh conditions'}</button></header>
  <p class="review-notice"><strong>Know before you go.</strong> Rules and access for this water have not been reviewed here yet; confirm them with ODFW before you fish. <a href="#before-you-go">Planning status</a></p>${snapshot?.mode === 'development_fixture' ? '<div class="fixture-notice"><strong>Development preview.</strong> The values below are test fixtures, not current river conditions. Do not use them to plan a trip.</div>' : ''}${requestError ? `<div class="request-error" role="status"><strong>We couldn’t refresh the conditions.</strong> ${snapshot ? 'The previous snapshot remains below with its original timestamps.' : 'No live readings are available. Official sources are linked below.'}<span>${esc(requestError)}</span></div>` : ''}
  ${scorePanel(planningScore(water.id, snapshot?.score), loading, { esc, number })}
  <section class="panel" aria-labelledby="river-title"><div class="panel-heading"><h2 id="river-title">Current readings</h2><span class="panel-source">USGS</span></div><div class="metric-grid">${metric(snapshot, '00060', 'River flow', 'cfs')}${metric(snapshot, '00065', 'Gauge height', 'ft')}${metric(snapshot, '00010', 'Water temperature', '°F')}${normalMetric(snapshot)}</div><p class="measurement-note">${esc(gauge.name)} (${esc(gauge.station_id)}). The gauge does not measure every fishing spot. ${officialLink('View the gauge', gauge.url)}</p></section>
  <section class="panel trend-panel"><div class="panel-heading"><h2>Flow history</h2><div class="range-toggle" role="group" aria-label="Flow chart time range">${ranges.map(([hours, label]) => `<button data-hours="${hours}" class="${trendHours === hours ? 'active' : ''}" aria-pressed="${trendHours === hours}">${label}</button>`).join('')}</div></div>${chart(snapshot, snapshot?.trend)}${snapshot?.trend.status === 'stale' ? '<p class="panel-footnote">Retained history is stale. Original measurement times are shown.</p>' : ''}</section>
  <section class="panel planning-card" id="before-you-go"><div class="panel-heading"><h2>Before you go</h2></div><div class="planning-row"><span>Fishing regulations</span><strong class="${snapshot?.regulations_status === 'closed' ? 'text-danger' : ''}">${snapshot?.regulations_status === 'closed' ? 'Restrictions apply' : snapshot?.regulations_status === 'open' ? 'Reviewed open' : 'Not yet verified'}</strong></div><div class="planning-row"><span>Access & boundaries</span><strong>${snapshot?.access_status === 'verified' ? 'Verified' : 'Not yet verified'}</strong></div><div class="planning-row"><span>Fishing outlook</span><strong>Withheld pending review</strong></div>${snapshot?.restrictions.length ? `<ul>${snapshot.restrictions.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}<p>Unknown doesn’t mean open. Confirm the current rules for your exact location, species, method, and date before fishing.</p><div class="link-row">${officialLink('Check ODFW regulations', 'https://myodfw.com/fishing/regulations')}${officialLink('Check in-season updates', 'https://myodfw.com/recreation-report/fishing-report/central-zone')}</div></section>
  ${weatherPanel(snapshot)}
  ${plan ? planningSections(plan, { esc, officialLink, origin: tripOrigin }) : ''}
  ${sourcePanel(snapshot)}<p class="snapshot-footer">${snapshot ? `Snapshot assembled ${date(snapshot.updated_at)} · Schema ${esc(snapshot.schema_version)}` : 'No conditions snapshot available'} · Source measurement times always take precedence.</p></main>`;
}

function methodology() {
  return `<main id="main" class="method-main wrap"><header class="page-title"><div><h1>A clearer picture.<br><em>Not a crystal ball.</em></h1><p>Useful information begins with knowing where it came from, when it was measured, and what it can actually tell you.</p></div></header><div class="method-content"><section id="observations"><h2>The river has the first word.</h2><p>River flow, gauge height, and water temperature come from the modern USGS Water Data API. A value appears only after its station, parameter, units, and measurement timestamp pass validation. Air temperature is never used as a substitute for water temperature.</p><p>Waters with live readings are paired with a USGS gauge whose identity, coordinates, and sensor series were checked against the API. Guide-only profiles have no connected measurements. A gauge is a candidate proxy for its water; its suitability for any particular reach still requires review.</p><div class="method-callout"><strong>“Current” describes the reading, not the river everywhere.</strong><p>Freshness is calculated from the original measurement time. An older record stays older when it is fetched again. The refresh button checks the shared snapshot; it does not bypass the provider cache.</p></div><p>Flow charts and board changes use observations from the same sensor and time series. A change compares the latest reading with the reading nearest to one hour, one day, or seven days earlier; if no reading exists close to that time (within 15 minutes for the hourly change, 45 minutes otherwise), no change is shown. Missing readings and long intervals break the line. Qualifiers and provisional status remain available in each measurement record.</p><p>“Typical flow for this date” is the median of USGS daily-mean flows falling within seven days of today’s calendar date, across the earlier years returned for the last ten years. The current year is excluded so the comparison is independent of this week’s readings, and at least five earlier years are required before a figure is shown. It describes what the river usually does on this date; it does not say whether that is good for fishing.</p>${officialLink('USGS Water Data API documentation', 'https://api.waterdata.usgs.gov/docs/ogcapi/')}${WATERS.map(water => officialLink(`USGS ${water.gauge.label} · ${water.name}`, water.gauge.url)).join('')}</section>
  <section id="forecast"><h2>Weather belongs to a place and time.</h2><p>The National Weather Service is our initial forecast provider. Hourly forecasts must use a reviewed point that represents the reach. A gauge’s coordinates alone do not establish a useful weather point or a fishing access location.</p><p>Weather forecasts show their issue time and each period’s validity. Rain probability is a chance of precipitation, not an amount. Official alerts are shown when available for a reviewed point; no returned alerts is not a declaration that wading or boating is safe.</p>${officialLink('National Weather Service API documentation', 'https://www.weather.gov/documentation/services-web-api')}</section>
  <section id="reviews"><h2>Check the rules. Then make a plan.</h2><p>Fishing regulations, in-season changes, and access boundaries need separate review. A weekly fishing report cannot replace those checks. Seasonal and method guidance describes the linked source context. It is not confirmation that a particular species or technique is legal today. Reported restrictions suppress the affected water score pending review.</p><p>ODFW reports are linked directly. Summaries retain their water-specific report date, geographic coverage, and source-review date. Historical and undated reports are labeled separately from live observations. A scheduled stocking week will never be presented as proof that fish have already been stocked.</p>${officialLink('ODFW fishing regulations', 'https://myodfw.com/fishing/regulations')}${officialLink('ODFW Central Zone fishing report', 'https://myodfw.com/recreation-report/fishing-report/central-zone')}</section>
  <section id="score"><h2>How the score works.</h2><p>Every water has a list of the species that live in it, the months each is a realistic target, and the months most anglers are after it. The score on the board is for that month’s main target; a water’s page scores every species in season.</p><p>Each species is scored from up to four parts: <strong>flow</strong> (today’s flow as a share of the normal flow for this date, against the band that species fishes best in), <strong>water temperature</strong> (the band the species feeds actively in; at or above its stress temperature the part scores zero and the page says so), the <strong>24-hour trend</strong> (steady or gently falling water scores highest for most fish; fast-rising water lowest), and for runs and hatches, <strong>time of year</strong> (full marks at the peak, less on the shoulders). Within each band the part scores full marks, easing off toward the edge of the acceptable range and dropping beyond it.</p><p>The parts are weighted — flow 45%, temperature 35%, trend 20% for trout, with more weight on temperature for bass and more on trend and season for steelhead and salmon — and when a reading is missing the remaining parts are reweighted and the score is marked partial. A score is never built from time of year alone. The number is a description of the water for that fish on this date, a planning aid rather than a promise; a closure or restriction always outranks it. The bands are published rules of thumb and will be tuned as we compare them with what people actually catch.</p><p>Species on the board: ${Object.values(SPECIES).map(s => s.name).join(', ')}.</p></section>
  <section id="uncertainty"><h2>An honest blank beats a confident guess.</h2><div class="status-explainer"><div>${status('current')}<p>A validated reading within the source’s operational freshness window.</p></div><div>${status('stale')}<p>A retained reading outside that window, with its original timestamp.</p></div><div>${status('unavailable')}<p>A missing, invalid, or unverified reading. It is never filled with a made-up number.</p></div></div><p>Source providers operate independently: a weather outage should not hide a valid river observation, and one gauge’s outage does not blank the others. Shared source snapshots help avoid a new batch of upstream requests for every visitor. The pilot uses operational freshness windows of 2 hours for river observations, 6 hours from forecast issue time, and 5 minutes for alert checks. These settings describe data handling; they are not biological thresholds. The flow chart breaks a line when readings are more than 72 minutes apart, matching the pinned sensor metadata.</p><p>The score is an interpretation layered on measurements, and it always shows its parts. Measured conditions, the score, forecast weather, and editorial judgment are different kinds of information, and the page keeps them visibly separate. Regulations and access review continue to outrank any score.</p></section>
  <section id="coverage"><h2>A guide for every kind of water.</h2><p>The directory includes ${WATERS.length} waters with connected USGS gauges and ${WATER_PROFILES.length} source-linked guides. The four planned Central Oregon waters now have guide pages, alongside ten additional river areas and five lakes and reservoirs selected from official fishing guides. This is an editorial selection of established destinations, not a measured ranking of popularity.</p><p>Each river entry names a section or access area. Trip planning keeps documented species, public access, seasonal context, methods, and dated reports independent of live measurements. The separate gauge view retains the five connected stations. Driving directions use a named public access point and the starting town you enter; no drive time is estimated by this site. Their source-review date does not verify current regulations, openings, alerts, or fishing success. A missing gauge does not mean poor fishing, and it does not prevent a water from having a useful guide.</p><p>A nearby gauge is not automatically representative of a whole river or lake. Reservoir coverage may have weather and official reports without a suitable water sensor. Coverage will describe what exists.</p><a class="text-link" data-nav href="/">See the board ${arrow}</a></section></div></main>`;
}

function render(restoreFocus?: string) {
  const path = currentPath();
  const water = currentWater();
  const profile = currentProfile();
  const samePage = path === lastRenderedPath;
  const focused = samePage ? document.activeElement as HTMLElement | null : null;
  const focusId = focused?.id;
  const selection = focused instanceof HTMLInputElement ? [focused.selectionStart, focused.selectionEnd] : null;
  const sourcesOpen = samePage && app.querySelector<HTMLDetailsElement>('.source-details')?.open;
  const boardNotesOpen = samePage && app.querySelector<HTMLDetailsElement>('#board-notes')?.open;
  const tableScroll = samePage ? app.querySelector('.table-scroll')?.scrollLeft ?? 0 : 0;
  if (water) ageSnapshot(snapshots.get(water.id));
  ageBoard();
  document.title = water ? `${water.name} conditions — Oregon Fish Forecast` : profile ? `${profile.name} fishing guide — Oregon Fish Forecast` : path === '/methodology' ? 'Our approach — Oregon Fish Forecast' : 'Oregon Fish Forecast — Oregon waters & conditions';
  const body = water ? detail(water) : profile ? profilePage(profile, { esc, officialLink, origin: tripOrigin }) : path === '/methodology' ? methodology() : path === '/' ? home() : `<main id="main" class="wrap not-found"><h1>This water isn’t on our board.</h1><p>Explore our river, lake, and reservoir guides and available conditions.</p><a data-nav class="text-link" href="/">Back to the board ${arrow}</a></main>`;
  app.innerHTML = header() + body + footer() + '<div id="live-status" class="sr-only" role="status" aria-live="polite"></div>';
  app.querySelector<HTMLElement>('#main')!.tabIndex = -1;
  if (sourcesOpen) app.querySelector<HTMLDetailsElement>('.source-details')!.open = true;
  if (boardNotesOpen) app.querySelector<HTMLDetailsElement>('#board-notes')!.open = true;
  const table = app.querySelector('.table-scroll');
  if (table) table.scrollLeft = tableScroll;
  if (restoreFocus) app.querySelector<HTMLElement>(restoreFocus)?.focus({ preventScroll: true });
  else if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  if (selection && document.activeElement instanceof HTMLInputElement) document.activeElement.setSelectionRange(selection[0]!, selection[1]!);
  lastRenderedPath = path;
}

async function loadBoard() {
  if (boardLoading) return;
  const refreshFocused = document.activeElement?.id === 'refresh';
  boardLoading = true;
  boardError = '';
  if (currentPath() === '/') render();
  try {
    const response = await fetch(BOARD_PATH, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`The conditions service returned ${response.status}.`);
    const data = await response.json() as Board;
    if (data.schema_version !== '1.0' || !Array.isArray(data.rows)) throw new Error('The conditions service returned an unrecognized response.');
    board = data;
    boardFetchedAt = Date.now();
  } catch (error) {
    ageBoard(true);
    boardError = error instanceof Error && error.name === 'TimeoutError' ? 'The source check timed out. You can try again.' : error instanceof Error ? error.message : 'Please try again shortly.';
  } finally {
    boardLoading = false;
    if (currentPath() === '/') {
      render(refreshFocused ? '#refresh' : undefined);
      document.querySelector('#live-status')!.textContent = boardError ? 'The board could not be refreshed.' : 'Board updated. Check each measurement time for freshness.';
    }
  }
}

async function loadConditions(water: Water) {
  if (loading) return;
  const refreshFocused = document.activeElement?.id === 'refresh';
  loading = true;
  requestError = '';
  if (currentWater()?.id === water.id) render();
  try {
    const response = await fetch(`/api/v1/conditions/${water.id}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`The conditions service returned ${response.status}.`);
    const data = await response.json() as Conditions;
    if (data.schema_version !== '1.0' || !Array.isArray(data.observations) || !data.weather || !data.trend || !Array.isArray(data.source_health)) throw new Error('The conditions service returned an unrecognized response.');
    snapshots.set(water.id, data);
    lastFetchAt = Date.now();
  } catch (error) {
    ageSnapshot(snapshots.get(water.id), true);
    requestError = error instanceof Error && error.name === 'TimeoutError' ? 'The source check timed out. You can try again.' : error instanceof Error ? error.message : 'Please try again shortly.';
  } finally {
    loading = false;
    if (currentWater()?.id === water.id) {
      render(refreshFocused ? '#refresh' : undefined);
      document.querySelector('#live-status')!.textContent = requestError ? 'Conditions could not be refreshed.' : 'Conditions snapshot updated. Check individual measurement times for freshness.';
    }
  }
}

function loadForPath() {
  const water = currentWater();
  if (water) void loadConditions(water);
  else if (currentPath() === '/') void loadBoard();
}

function focusDestination(scroll = true) {
  let anchor: HTMLElement | null = null;
  try { anchor = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null; } catch { /* Ignore malformed fragments. */ }
  const destination = anchor || document.getElementById('main');
  destination?.setAttribute('tabindex', '-1');
  destination?.focus({ preventScroll: true });
  if (scroll) {
    if (anchor) anchor.scrollIntoView();
    else window.scrollTo(0, 0);
  }
}

document.addEventListener('click', event => {
  const target = event.target as Element;
  const nav = target.closest<HTMLAnchorElement>('a[data-nav]');
  if (nav && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
    event.preventDefault();
    history.pushState({}, '', nav.getAttribute('href')!);
    render();
    focusDestination();
    loadForPath();
  }
  if (target.closest('#refresh')) loadForPath();
  const range = target.closest<HTMLButtonElement>('[data-hours]');
  if (range) { trendHours = Number(range.dataset.hours); render(`[data-hours="${trendHours}"]`); }
  const sortButton = target.closest<HTMLButtonElement>('[data-sort]');
  if (sortButton) {
    const key = sortButton.dataset.sort as SortKey;
    sort = sort.key === key ? (sort.dir === 1 ? { key, dir: -1 } : { key: 'default', dir: 1 }) : { key, dir: key === 'name' ? 1 : -1 };
    render(`[data-sort="${key}"]`);
  }
  const filterButton = target.closest<HTMLButtonElement>('[data-water-filter]');
  if (filterButton) {
    waterFilter = filterButton.dataset.waterFilter as WaterFilter;
    render(`[data-water-filter="${waterFilter}"]`);
  }
  const modeButton = target.closest<HTMLButtonElement>('[data-board-mode]');
  if (modeButton) {
    boardMode = modeButton.dataset.boardMode as BoardMode;
    waterFilter = 'all';
    sort = { key: 'default', dir: 1 };
    render(`[data-board-mode="${boardMode}"]`);
  }
});
document.addEventListener('input', event => {
  if (event.target instanceof HTMLInputElement && event.target.id === 'water-search') {
    waterQuery = event.target.value;
    render();
  }
  if (event.target instanceof HTMLInputElement && event.target.id === 'trip-origin') {
    tripOrigin = event.target.value;
    render();
  }
});
window.addEventListener('popstate', () => { render(); focusDestination(false); loadForPath(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadForPath(); });
window.setInterval(() => {
  if (document.hidden || loading || boardLoading) return;
  const water = currentWater();
  if (water) { if (Date.now() - lastFetchAt > 5 * 60 * 1000) void loadConditions(water); else render(); }
  else if (currentPath() === '/') { if (Date.now() - boardFetchedAt > 5 * 60 * 1000) void loadBoard(); else render(); }
}, 60 * 1000);
render();
if (location.hash) focusDestination();
loadForPath();
export { waterPath };
