import './styles.css';
import './theme.css';
import './field-guide.css';
import { fieldGuideHome } from './home';
import { riverPhoto } from './photos';
import type { Conditions, HistoryPoint, Observation, Parameter, Trend } from '../shared/types';

const WATER_PATH = '/waters/lower-deschutes-warm-springs-trout-creek';
const API_PATH = '/api/v1/conditions/lower-deschutes-warm-springs-trout-creek';
const app = document.querySelector<HTMLDivElement>('#app')!;
let snapshot: Conditions | null = null;
let loading = false;
let requestError = '';
let trendHours = 72;
let lastRenderedPath = '';
let lastFetchAt = 0;
const currentPath = () => location.pathname.replace(/\/$/, '') || '/';

const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const external = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" stroke-width="1.4"/></svg>';
const fish = '<img class="weather-fish" src="/brand/weather-fish.webp" width="720" height="348" alt="" decoding="async">';
const icons: Record<string, string> = {
  flow: '<path d="M3 7c3-4 6 4 9 0s6 4 9 0M3 12c3-4 6 4 9 0s6 4 9 0M3 17c3-4 6 4 9 0s6 4 9 0"/>',
  height: '<path d="M7 3v18M4 6l3-3 3 3M4 18l3 3 3-3M14 6h6M14 12h6M14 18h6"/>',
  temperature: '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0ZM12 9v9M18 6h3M18 10h3"/>',
  location: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3ZM12 8v5M12 16h.01"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.5-2L20 8M4 16l2.4 3A7 7 0 0 0 18 17"/>',
  book: '<path d="M3 4h6a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H3V4ZM21 4h-6a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h6V4Z"/>',
};
function icon(name: string) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.flow}</svg>`; }
function esc(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
function safeUrl(value: string): string { try { const url = new URL(value); return url.protocol === 'https:' ? esc(url.href) : '#'; } catch { return '#'; } }
function officialLink(label: string, url: string, className = '') { return `<a class="external-link ${className}" href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}${external}<span class="sr-only"> (opens in a new tab)</span></a>`; }
function date(value: string | null | undefined, short = false): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not available';
  return new Intl.DateTimeFormat('en-US', { timeZone: snapshot?.timezone || 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: short ? undefined : '2-digit', timeZoneName: short ? undefined : 'short' }).format(new Date(value));
}
function time(value: string | null | undefined, short = false): string {
  return value && Number.isFinite(Date.parse(value)) ? `<time datetime="${esc(value)}">${date(value, short)}</time>` : 'Not available';
}
function ageSnapshot(failedRefresh = false) {
  if (!snapshot) return;
  const expired = (at: string | null, hours: number) => !at || Date.now() - Date.parse(at) > hours * 3600000;
  snapshot.observations.forEach(obs => { if (obs.quality_status === 'current' && (failedRefresh || expired(obs.observed_at, 2))) obs.quality_status = 'stale'; });
  const latestFlow = snapshot.observations.find(obs => obs.parameter_code === '00060');
  if (snapshot.trend.status === 'current' && (failedRefresh || latestFlow?.quality_status !== 'current')) snapshot.trend.status = 'stale';
  if (snapshot.weather.status === 'current' && (failedRefresh || expired(snapshot.weather.issued_at, 6))) snapshot.weather.status = 'stale';
  const alertsSource = snapshot.source_health.find(source => source.source_id === 'nws_alerts');
  if (snapshot.alerts_status === 'current' && (failedRefresh || expired(alertsSource?.retrieved_at || null, 5 / 60))) snapshot.alerts_status = 'stale';
  snapshot.source_health.forEach(source => {
    const sourceExpired = source.source_id === 'usgs' ? !snapshot!.observations.some(obs => obs.quality_status === 'current') : source.source_id === 'nws' ? snapshot!.weather.status !== 'current' : snapshot!.alerts_status !== 'current';
    if (source.status === 'current' && (failedRefresh || sourceExpired)) source.status = 'stale';
    if (failedRefresh) source.from_cache = true;
  });
}
function number(value: number, max = 1) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: max }).format(value); }
function status(value: string | undefined, fallback = 'Unavailable') { const label = value === 'current' ? 'Current' : value === 'stale' ? 'Stale reading' : fallback; return `<span class="status status-${value || 'unavailable'}"><span></span>${label}</span>`; }


function header() {
  const path = currentPath();
  return `<a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="header-inner"><a class="brand" data-nav href="/" aria-label="Oregon Fish Forecast home"><span class="brand-mark">${fish}</span><span>OREGON<span>FISH FORECAST</span></span></a><nav aria-label="Main navigation"><a data-nav href="/" ${path === '/' ? 'aria-current="page"' : ''}>The waters</a><a data-nav href="${WATER_PATH}" ${path === WATER_PATH ? 'aria-current="page"' : ''}>River conditions</a><a data-nav href="/methodology" ${path === '/methodology' ? 'aria-current="page"' : ''}>Our approach</a></nav><span class="pilot-label"><span></span>CENTRAL OREGON PILOT</span></div></header>`;
}
function footer() {
  return `<footer class="site-footer"><div class="footer-inner"><div class="footer-signature"><a class="footer-brand" data-nav href="/" aria-label="Oregon Fish Forecast home">${fish}</a><a class="footer-approach" data-nav href="/methodology"><span>The source matters.</span><strong>Our approach.</strong></a></div><div class="footer-place"><span>${icon('flow')} Central Oregon</span><small>Clean water. Healthy fish. Resilient landscapes.</small></div></div></footer>`;
}

function home() { return fieldGuideHome({ waterPath: WATER_PATH, fish, arrow, icon }); }

function metric(parameter: Parameter, label: string, iconName: string, unit: string) {
  const obs = snapshot?.observations.find(o => o.parameter_code === parameter);
  const available = obs?.normalized_value !== null && obs?.normalized_value !== undefined;
  return `<article class="metric-card"><div class="metric-label">${icon(iconName)}<h3>${label}</h3></div><div class="metric-value ${available ? '' : 'value-missing'}">${available ? number(obs!.normalized_value!, parameter === '00060' ? 0 : parameter === '00010' ? 1 : 2) : '—'}<span>${esc(obs?.normalized_unit || unit)}</span></div>${loading && !snapshot ? '<span class="status">Checking source…</span>' : status(obs?.quality_status)}<p class="metric-time">${available ? `Measured ${time(obs?.observed_at)}` : 'No validated reading available'}</p>${obs?.approval_status ? `<span class="metric-qualifier">${esc(obs.approval_status)}${obs.qualifiers.length ? ` · ${esc(obs.qualifiers.join(', '))}` : ''}</span>` : ''}</article>`;
}

function chart(trend: Trend | undefined) {
  const end = snapshot ? Date.parse(snapshot.updated_at) : Date.now();
  const start = end - trendHours * 60 * 60 * 1000;
  const points = (trend?.points || []).filter(p => Date.parse(p.observed_at) >= start && Date.parse(p.observed_at) <= end).sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
  const valid = points.filter((p): p is HistoryPoint & { value: number } => p.value !== null && Number.isFinite(p.value));
  if (valid.length < 2) return `<div class="chart-empty">${icon('flow')}<h4>${loading && !snapshot ? 'Checking the river record' : 'Waiting for a complete picture'}</h4><p>${esc(trend?.reason || 'A trend needs multiple validated readings from the same sensor. There isn’t enough history available to draw one yet.')}</p><span>Gaps stay gaps. Missing data is never filled in.</span></div>`;
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
  return `<div class="chart-unit">${esc(trend?.unit || 'Reported units')}</div><svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Measured river flow over the last ${trendHours} hours. ${valid.length} readings. ${gap || trend?.has_gaps ? 'Includes data gaps.' : 'No gaps detected between available readings.'}">${grids}${times}<path d="${path}" fill="none" stroke="#2a6450" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${valid.map(p => `<circle cx="${x(p)}" cy="${y(p.value)}" r="2" fill="#2a6450"><title>${esc(date(p.observed_at))}: ${number(p.value)} ${esc(trend?.unit)}</title></circle>`).join('')}</svg><div class="chart-footer"><span><i></i>Observed flow · Same USGS time series</span><span>${gap || trend?.has_gaps ? 'Data gaps present' : 'Available observations shown'} · Pacific time</span></div>`;
}

function weatherPanel() {
  const weather = snapshot?.weather;
  const reviewed = weather?.point_status === 'reviewed';
  const smokeTest = weather?.point_status === 'gauge_smoke_test';
  const periods = reviewed || smokeTest ? (weather?.periods || []).filter(p => Date.parse(p.end_at) > Date.now()).slice(0, 6) : [];
  const alerts = reviewed ? snapshot?.alerts || [] : [];
  return `<section class="panel weather-panel" aria-labelledby="weather-title">
    <div class="panel-heading"><div><div class="eyebrow">FORECAST / NATIONAL WEATHER SERVICE</div><h2 id="weather-title">${smokeTest ? 'Gauge weather test.' : 'The weather ahead.'}</h2></div>${icon('sun')}</div>
    ${smokeTest ? '<div class="fixture-notice"><strong>DEVELOPMENT GAUGE SMOKE TEST</strong> · This forecast is for the gauge coordinates. The weather point has not been reviewed for this fishing reach or for access planning.</div>' : ''}
    ${periods.length ? `<div class="weather-meta">${status(weather?.status)}<span>Issued ${time(weather?.issued_at)}</span></div><div class="weather-periods">${periods.map(p => `<article><span class="weather-hour">${time(p.start_at, true)}</span>${icon('sun')}<strong>${p.temperature === null ? '—' : number(p.temperature)}<span>°${esc(p.temperature_unit || '')}</span></strong><p>${esc(p.short_forecast)}</p><span>${p.precipitation_probability === null ? 'Rain chance unavailable' : `${p.precipitation_probability}% rain chance`}</span><span>${esc(p.wind_speed || 'Wind unavailable')} ${esc(p.wind_direction || '')}</span><span class="valid-until">Valid until ${time(p.end_at, true)}</span></article>`).join('')}</div><p class="panel-footnote">${esc(weather?.point_label)} · Retrieved ${time(weather?.retrieved_at)}. Rain chance is a probability, not a rainfall amount.</p>` : `<div class="quiet-state"><div class="quiet-icon">${icon('sun')}</div><div><h3>${reviewed || smokeTest ? 'Forecast currently unavailable' : 'A local forecast needs a local check.'}</h3><p>${esc(weather?.reason || 'The representative weather point for this reach has not been reviewed. A nearby gauge location is not automatically the right forecast location.')}</p>${officialLink('Visit the National Weather Service', 'https://www.weather.gov/')}</div></div>`}
    <div class="alert-status">${icon('shield')}<div>${alerts.length ? `${status(snapshot?.alerts_status)}${alerts.map(a => `<p><strong>${esc(a.event)}</strong> · ${esc(a.headline)}<br>${officialLink('Read official alert', a.source_url)}<span>Effective ${time(a.effective_at)} · Expires ${time(a.expires_at)}</span></p>`).join('')}` : `<span>${reviewed && snapshot?.alerts_status === 'current' ? 'No active alerts returned for the reviewed point.' : 'Local alerts are not verified for this reach.'}</span><small>The absence of an alert does not establish safe river conditions.</small>`}</div></div></section>`;
}
function provenance(obs: Observation) {
  return `<div class="observation-record"><h4>${esc(obs.label)} ${status(obs.quality_status)}</h4><dl><div><dt>Measurement time</dt><dd>${date(obs.observed_at)}</dd></div><div><dt>Retrieved</dt><dd>${date(obs.retrieved_at)}</dd></div><div><dt>Original reading</dt><dd>${esc(obs.raw_value === null ? 'Unavailable' : obs.raw_value)} ${esc(obs.raw_unit)}</dd></div><div><dt>Time series</dt><dd>${esc(obs.time_series_id || 'Not verified')}</dd></div><div><dt>Approval & qualifiers</dt><dd>${esc(obs.approval_status || 'Not available')}${obs.qualifiers.length ? ` · ${esc(obs.qualifiers.join(', '))}` : ''}</dd></div><div><dt>Reach mapping</dt><dd>${esc(obs.mapping_status.replaceAll('_', ' '))}</dd></div></dl>${obs.issues.length ? `<p>${esc(obs.issues.join(' '))}</p>` : ''}${officialLink('View source record', obs.source_url)}</div>`;
}
function sourcePanel() {
  return `<section class="panel source-panel"><div class="panel-heading"><div><div class="eyebrow">BEHIND THE READING</div><h2>Sources, in plain sight.</h2></div><span class="source-count">${snapshot?.source_health.length || 0} source checks</span></div>${snapshot?.source_health.length ? `<div class="source-rows">${snapshot.source_health.map(s => `<div class="source-row"><div><strong>${esc(s.label)}</strong><p>${esc(s.message)}</p><span>Retrieved ${date(s.retrieved_at)}${s.from_cache ? ' · Retained snapshot' : ''}</span><span>Last attempt ${date(s.last_attempt_at)}</span></div>${status(s.status)}</div>`).join('')}</div>` : `<p class="empty-source-copy">${loading ? 'Checking source status…' : 'Source status is unavailable. No measurements have been substituted.'}</p>`}<details class="source-details"><summary id="source-records-summary">View measurement records & provenance<span>+</span></summary><div class="source-detail-body"><p>Measurement time determines freshness. Retrieving or refreshing a record does not make its observation newer.</p>${snapshot?.observations.map(provenance).join('') || '<p>No measurement records are available.</p>'}${snapshot?.trend ? `<div class="trend-provenance"><h4>Trend calculation</h4><p>Version: ${esc(snapshot.trend.calculation_version)} · ${snapshot.trend.input_record_ids.length} input records · Series: ${esc(snapshot.trend.time_series_id || 'Unavailable')}</p><p>${esc(snapshot.trend.reason || 'Drawn from validated observations of the same parameter and time series. Missing values and intervals appear as gaps.')}</p></div>` : ''}</div></details><a class="text-link" data-nav href="/methodology">How we handle the data ${arrow}</a></section>`;
}
function detail() {
  const gauge = 'https://waterdata.usgs.gov/monitoring-location/USGS-14092500/';
  return `<main id="main" class="detail-main"><section class="detail-hero wrap"><div class="breadcrumb"><a data-nav href="/">The waters</a><span>/</span>Lower Deschutes</div><div class="detail-title-row"><div><div class="eyebrow">CENTRAL OREGON / PILOT CONDITIONS</div><h1>Lower Deschutes<span>Warm Springs to Trout Creek</span></h1><p>A view of the river, with the source always in sight.</p></div><div class="reach-stamp">${icon('location')}<span>ONE REACH.<br>A CLOSER LOOK.</span></div></div><div class="detail-toolbar"><span>${icon('flow')}River observations <span class="toolbar-separator">/</span> All times Pacific</span><button class="refresh-button" id="refresh" ${loading ? 'disabled' : ''}>${icon('refresh')} ${loading ? 'Checking sources…' : 'Refresh conditions'}</button></div></section>
  <div class="wrap"><div class="review-notice">${icon('shield')}<div><strong>Know before you go.</strong> Rules, access, and the gauge’s relationship to this reach are still under review. These observations are not a fishing recommendation. <a href="#before-you-go">View planning status ${arrow}</a></div></div>${snapshot?.mode === 'development_fixture' ? '<div class="fixture-notice"><strong>DEVELOPMENT PREVIEW</strong> · The values below are test fixtures, not current river conditions. Do not use them to plan a trip.</div>' : ''}${requestError ? `<div class="request-error" role="status"><strong>We couldn’t refresh the conditions.</strong> ${snapshot ? 'The previous snapshot remains below with its original timestamps.' : 'No live readings are available. Official sources are linked below.'}<span>${esc(requestError)}</span></div>` : ''}
  <div class="detail-grid"><div class="detail-primary"><section aria-labelledby="river-title"><div class="subsection-heading"><div><span class="eyebrow">OBSERVED / USGS</span><h2 id="river-title">A pulse on the river.</h2></div><span class="gauge-tag">MADRAS GAUGE</span></div><div class="metric-grid">${metric('00060', 'River flow', 'flow', 'ft³/s')}${metric('00065', 'Gauge height', 'height', 'ft')}${metric('00010', 'Water temperature', 'temperature', '°F')}</div><p class="measurement-note">Readings are from Deschutes River Near Madras, OR (USGS-14092500), a candidate upstream proxy. They do not measure every fishing spot.</p></section>
  <section class="panel trend-panel"><div class="panel-heading"><div><div class="eyebrow">RECENT RIVER HISTORY</div><h2>Follow the flow.</h2></div><div class="range-toggle" role="group" aria-label="Flow chart time range"><button data-hours="24" class="${trendHours === 24 ? 'active' : ''}" aria-pressed="${trendHours === 24}">24 hours</button><button data-hours="72" class="${trendHours === 72 ? 'active' : ''}" aria-pressed="${trendHours === 72}">72 hours</button></div></div>${chart(snapshot?.trend)}${snapshot?.trend.status === 'stale' ? '<p class="panel-footnote">Retained history is stale. Original measurement times are shown.</p>' : ''}</section>
  ${weatherPanel()}${sourcePanel()}</div>
  <aside class="detail-sidebar"><section class="reach-card">${riverPhoto('reach')}<div><span class="eyebrow">THE REACH</span><h2>Warm Springs<br>to Trout Creek</h2><p>The initial pilot focuses on this stretch of the Lower Deschutes. Exact boundaries, bank access, and the gauge-to-reach relationship need editorial review.</p><span class="inline-label">${icon('location')}Scenic photo · Not an access map</span>${officialLink('Explore the USGS gauge', gauge)}</div></section>
  <section class="planning-card" id="before-you-go"><div class="eyebrow">BEFORE YOU GO</div><h2>A few checks first.</h2><div class="planning-row"><span>Fishing regulations</span><strong class="${snapshot?.regulations_status === 'closed' ? 'text-danger' : ''}">${snapshot?.regulations_status === 'closed' ? 'Restrictions apply' : snapshot?.regulations_status === 'open' ? 'Reviewed open' : 'Not yet verified'}</strong></div><div class="planning-row"><span>Access & boundaries</span><strong>${snapshot?.access_status === 'verified' ? 'Verified' : 'Not yet verified'}</strong></div><div class="planning-row"><span>Fishing outlook</span><strong>Withheld pending review</strong></div>${snapshot?.restrictions.length ? `<ul>${snapshot.restrictions.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}<p>Unknown doesn’t mean open. Confirm the current rules for your exact location, species, method, and date before fishing.</p>${officialLink('Check ODFW regulations', 'https://myodfw.com/fishing/regulations')}${officialLink('Check in-season updates', 'https://myodfw.com/recreation-report/fishing-report/central-zone')}</section>
  <section class="report-card"><div class="eyebrow">FROM THE FIELD / ODFW</div><h2>The local report.</h2><p>The Central Zone report offers official fishing context. A water-specific summary and its report date have not yet been reviewed here.</p><span class="review-status">Editorial review: pending</span>${officialLink('Read the Central Zone report', 'https://myodfw.com/recreation-report/fishing-report/central-zone')}</section>
  <div class="sidebar-note">${fish}<p>Good information leaves room<br>for what’s still unknown.</p></div></aside></div><div class="snapshot-footer">${snapshot ? `Snapshot assembled ${date(snapshot.updated_at)} · Schema ${esc(snapshot.schema_version)}` : 'No conditions snapshot available'}<span>Source measurement times always take precedence.</span></div></div></main>`;
}

function methodology() {
  return `<main id="main" class="method-main wrap"><div class="breadcrumb"><a data-nav href="/">The waters</a><span>/</span>Our approach</div><section class="method-hero"><div class="eyebrow">SOURCES & METHODOLOGY</div><h1>A clearer picture.<br><em>Not a crystal ball.</em></h1><p>Useful information begins with knowing where it came from, when it was measured, and what it can actually tell you.</p></section><div class="method-grid"><aside class="method-index"><span class="eyebrow">IN THIS FIELD NOTE</span><a href="#observations">01 &nbsp; Measured conditions</a><a href="#forecast">02 &nbsp; Forecast weather</a><a href="#reviews">03 &nbsp; Rules & local context</a><a href="#uncertainty">04 &nbsp; Honest uncertainty</a><a href="#coverage">05 &nbsp; The pilot</a><div class="method-index-note">${fish}<p>Know the water.<br>Respect what’s unknown.</p></div></aside><div class="method-content"><section id="observations"><span class="section-number">01 / OBSERVED</span><h2>The river has the first word.</h2><p>River flow, gauge height, and water temperature come from the modern USGS Water Data API. A value appears only after its station, parameter, units, and measurement timestamp pass validation. Air temperature is never used as a substitute for water temperature.</p><p>Our first candidate source is <strong>Deschutes River Near Madras, OR (USGS-14092500)</strong>. The station’s identity is established. Its suitability as a proxy for the Warm Springs–Trout Creek reach still requires review.</p><div class="method-callout"><strong>“Current” describes the reading, not the river everywhere.</strong><p>Freshness is calculated from the original measurement time. An older record stays older when it is fetched again. The refresh button checks the shared snapshot; it does not bypass the provider cache.</p></div><p>The flow chart uses observations from the same sensor and time series. Missing readings and long intervals break the line. A single measurement cannot establish a trend. Qualifiers and provisional status remain available in each measurement record.</p>${officialLink('USGS Water Data API documentation', 'https://api.waterdata.usgs.gov/docs/ogcapi/')}${officialLink('USGS Madras monitoring location', 'https://waterdata.usgs.gov/monitoring-location/USGS-14092500/')}</section>
  <section id="forecast"><span class="section-number">02 / FORECAST</span><h2>Weather belongs to a place and time.</h2><p>The National Weather Service is our initial forecast provider. Hourly forecasts must use a reviewed point that represents the reach. A gauge’s coordinates alone do not establish a useful weather point or a fishing access location.</p><p>Weather forecasts show their issue time and each period’s validity. Rain probability is a chance of precipitation, not an amount. Official alerts are shown when available for a reviewed point; no returned alerts is not a declaration that wading or boating is safe.</p>${officialLink('National Weather Service API documentation', 'https://www.weather.gov/documentation/services-web-api')}</section>
  <section id="reviews"><span class="section-number">03 / REVIEWED CONTEXT</span><h2>Check the rules. Then make a plan.</h2><p>Fishing regulations, in-season changes, and access boundaries need separate review. A weekly fishing report cannot replace those checks. Until the exact reach, species, method, and date are reviewed, the page does not rank the water, recommend a technique, or suggest a fishing window.</p><p>ODFW reports are linked directly. Any future summary must include its source, the water-specific report date, and the date it was reviewed. A scheduled stocking week will never be presented as proof that fish have already been stocked.</p>${officialLink('ODFW fishing regulations', 'https://myodfw.com/fishing/regulations')}${officialLink('ODFW Central Zone fishing report', 'https://myodfw.com/recreation-report/fishing-report/central-zone')}</section>
  <section id="uncertainty"><span class="section-number">04 / UNCERTAINTY</span><h2>An honest blank beats a confident guess.</h2><div class="status-explainer"><div>${status('current')}<p>A validated reading within the source’s operational freshness window.</p></div><div>${status('stale')}<p>A retained reading outside that window, with its original timestamp.</p></div><div>${status('unavailable')}<p>A missing, invalid, or unverified reading. It is never filled with a made-up number.</p></div></div><p>Source providers operate independently: a weather outage should not hide a valid river observation. Shared source snapshots help avoid a new batch of upstream requests for every visitor. The pilot uses operational freshness windows of 2 hours for river observations, 6 hours from forecast issue time, and 5 minutes for alert checks. These settings describe data handling; they are not biological thresholds. The flow chart breaks a line when readings are more than 72 minutes apart, matching the pinned sensor metadata.</p><p>There is no numeric bite score. Measured conditions, forecast weather, and editorial judgment are different kinds of information. Future planning interpretation will identify its evidence and limitations, and will remain gated by rules and access review.</p></section>
  <section id="coverage"><span class="section-number">05 / THE PILOT</span><h2>One reach at a time.</h2><p>We’re beginning with the Lower Deschutes. Crooked River, Metolius River, Fall River, Haystack Reservoir, and Lake Billy Chinook are proposed coverage areas. They will need their own source mappings and reviews before conditions pages become available.</p><p>A nearby gauge is not automatically representative of a whole river or lake. Reservoir coverage may have weather and official reports without a suitable water sensor. Coverage will describe what exists.</p><a class="button button-primary" data-nav href="${WATER_PATH}">See the pilot conditions page ${arrow}</a></section></div></div></main>`;
}

function render(restoreFocus?: string) {
  const path = currentPath();
  const samePage = path === lastRenderedPath;
  const focused = samePage ? document.activeElement as HTMLElement | null : null;
  const focusId = focused?.id;
  const sourcesOpen = samePage && app.querySelector<HTMLDetailsElement>('.source-details')?.open;
  ageSnapshot();
  document.title = path === WATER_PATH ? 'Lower Deschutes conditions — Oregon Fish Forecast' : path === '/methodology' ? 'Our approach — Oregon Fish Forecast' : 'Oregon Fish Forecast — Know the water.';
  const body = path === WATER_PATH ? detail() : path === '/methodology' ? methodology() : path === '/' ? home() : `<main id="main" class="wrap not-found"><span class="eyebrow">OFF THE BEATEN PATH</span><h1>This water isn’t on our map.</h1><p>The pilot starts with one Lower Deschutes conditions page.</p><a data-nav class="button button-primary" href="/">Back to the waters ${arrow}</a></main>`;
  app.innerHTML = header() + body + footer() + '<div id="live-status" class="sr-only" role="status" aria-live="polite"></div>';
  app.querySelector<HTMLElement>('#main')!.tabIndex = -1;
  if (sourcesOpen) app.querySelector<HTMLDetailsElement>('.source-details')!.open = true;
  if (restoreFocus) app.querySelector<HTMLElement>(restoreFocus)?.focus({ preventScroll: true });
  else if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  lastRenderedPath = path;
}

async function loadConditions() {
  if (loading) return;
  const refreshFocused = document.activeElement?.id === 'refresh';
  loading = true;
  requestError = '';
  if (currentPath() === WATER_PATH) render();
  try {
    const response = await fetch(API_PATH, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`The conditions service returned ${response.status}.`);
    const data = await response.json() as Conditions;
    if (data.schema_version !== '1.0' || !Array.isArray(data.observations) || !data.weather || !data.trend || !Array.isArray(data.source_health)) throw new Error('The conditions service returned an unrecognized response.');
    snapshot = data;
    lastFetchAt = Date.now();
  } catch (error) {
    ageSnapshot(true);
    requestError = error instanceof Error && error.name === 'TimeoutError' ? 'The source check timed out. You can try again.' : error instanceof Error ? error.message : 'Please try again shortly.';
  } finally {
    loading = false;
    if (currentPath() === WATER_PATH) {
      render(refreshFocused ? '#refresh' : undefined);
      document.querySelector('#live-status')!.textContent = requestError ? 'Conditions could not be refreshed.' : 'Conditions snapshot updated. Check individual measurement times for freshness.';
    }
  }
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
    if (currentPath() === WATER_PATH) void loadConditions();
  }
  const refresh = target.closest('#refresh');
  if (refresh) void loadConditions();
  const range = target.closest<HTMLButtonElement>('[data-hours]');
  if (range) { trendHours = Number(range.dataset.hours); render(`[data-hours="${trendHours}"]`); }
});
window.addEventListener('popstate', () => { render(); focusDestination(false); if (currentPath() === WATER_PATH) void loadConditions(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && currentPath() === WATER_PATH) void loadConditions(); });
window.setInterval(() => {
  if (document.hidden || currentPath() !== WATER_PATH || loading) return;
  if (Date.now() - lastFetchAt > 5 * 60 * 1000) void loadConditions();
  else render();
}, 60 * 1000);
render();
if (location.hash) focusDestination();
if (currentPath() === WATER_PATH) void loadConditions();
