import type { Board, BoardChange, BoardReading, BoardRow, FlowNormal, HistoryPoint, WaterScore } from '../shared/types';
import { WATERS } from '../shared/waters';
import { WATER_SPECIES, SPECIES } from '../shared/species';
import { WATER_PROFILES, type WaterProfile } from '../shared/catalog';
import { findPlanning, directionsUrl, planningScore } from '../shared/planning';
import type { WaterPlanning } from '../shared/planning-types';
import { profileDate, reportLabel } from './profile';
import { scoreBadge } from './score-view';

export type SortKey = 'default' | 'name' | 'score' | 'flow' | 'normal' | 'trend' | 'temperature';
export interface Sort { key: SortKey; dir: 1 | -1 }
export type WaterFilter = 'all' | 'river' | 'lake' | 'live';
export type BoardMode = 'planning' | 'gauges';
export interface HomeView {
  board: Board | null; loading: boolean; error: string; sort: Sort; filter: WaterFilter; query: string; mode: BoardMode; origin: string; arrow: string;
  esc: (value: unknown) => string;
  number: (value: number, max?: number) => string;
  time: (value: string | null | undefined, short?: boolean) => string;
  date: (value: string | null | undefined, short?: boolean) => string;
  status: (value: string | undefined) => string;
}
export const STEADY_PERCENT = 2;
const COLUMNS: { key: SortKey; label: string; title?: string }[] = [
  { key: 'name', label: 'Water' }, { key: 'score', label: 'Score', title: 'Fishing score for the month’s main target species' },
  { key: 'flow', label: 'Flow' }, { key: 'normal', label: 'vs. normal', title: 'Latest flow as a percentage of the median daily flow for this date' },
  { key: 'trend', label: '24h trend', title: 'Change in flow over the last 24 hours' }, { key: 'temperature', label: 'Water temp' },
];
const emptyNormal = (reason: string): FlowNormal => ({ status: 'unavailable', median: null, percent_of_median: null, years: 0, first_year: null, last_year: null, window_days: 7, time_series_id: '', retrieved_at: null, reason });
const emptyScore = (reason: string): WaterScore => ({ version: '', month: 0, score: null, label: null, species_id: null, species_name: null, primary_name: null, partial: false, missing: [], reason, species: [] });
function rows(board: Board | null): BoardRow[] {
  return WATERS.map(water => board?.rows.find(row => row.water_id === water.id) ?? {
    water_id: water.id, name: water.name, reach: water.reach, gauge_label: water.gauge.label, station_id: water.gauge.station_id,
    source_url: water.gauge.url, mapping_status: 'candidate_proxy', status: 'unavailable', retrieved_at: null, message: 'No board snapshot is available.',
    flow: { value: null, unit: 'cfs', observed_at: null, status: 'unavailable' }, height: { value: null, unit: 'ft', observed_at: null, status: 'unavailable' },
    temperature: { value: null, unit: '°F', observed_at: null, status: 'unavailable' }, normal: emptyNormal('No board snapshot is available.'), score: emptyScore('No board snapshot is available.'),
    changes: [1, 24, 168].map(hours => ({ hours, absolute: null, percent: null, from_observed_at: null, reason: 'No board snapshot is available.' })), sparkline: [],
  });
}
const dayChange = (row: BoardRow) => row.changes.find(change => change.hours === 24);
function sortValue(row: BoardRow, key: SortKey): number | string | null {
  if (key === 'name') return `${row.name} ${row.reach}`;
  if (key === 'score') return planningScore(row.water_id, row.score)?.score ?? null;
  if (key === 'flow') return row.flow.value;
  if (key === 'normal') return row.normal.percent_of_median;
  if (key === 'temperature') return row.temperature.value;
  return dayChange(row)?.percent ?? null;
}
export function sortRows(list: BoardRow[], sort: Sort): BoardRow[] {
  if (sort.key === 'default') return list;
  return [...list].sort((a, b) => {
    const left = sortValue(a, sort.key), right = sortValue(b, sort.key);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return (typeof left === 'string' ? left.localeCompare(String(right)) : left - Number(right)) * sort.dir;
  });
}
export function sparklineSvg(points: HistoryPoint[]): string {
  const valid = points.filter((p): p is HistoryPoint & { value: number } => p.value !== null);
  if (valid.length < 2 || points.length < 2) return '<span class="delta-none" aria-label="Not enough history for a sparkline">—</span>';
  const width = 120, height = 32, pad = 2;
  const low = Math.min(...valid.map(p => p.value)), high = Math.max(...valid.map(p => p.value)), span = high - low || 1;
  const x = (i: number) => pad + i / (points.length - 1) * (width - pad * 2);
  const y = (value: number) => height - pad - (value - low) / span * (height - pad * 2);
  let d = '', pen = false;
  points.forEach((point, i) => { if (point.value === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(point.value).toFixed(1)} `; pen = true; });
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" role="img" aria-label="Flow over the last 7 days, ${valid.length} hourly readings${points.some(p => p.value === null) ? ', with gaps' : ''}"><path d="${d.trim()}"/></svg>`;
}
function readingCell(reading: BoardReading, view: HomeView, digits: number): string {
  return reading.value === null ? '<span class="delta-none" title="No validated reading">—</span>' : `<span class="value">${view.number(reading.value, digits)}</span><span class="unit">${view.esc(reading.unit)}</span>`;
}
export function trendWord(change: BoardChange | undefined): 'Rising' | 'Falling' | 'Steady' | null {
  if (!change || change.percent === null) return null;
  return change.percent > STEADY_PERCENT ? 'Rising' : change.percent < -STEADY_PERCENT ? 'Falling' : 'Steady';
}
function trendCell(change: BoardChange | undefined, view: HomeView): string {
  const word = trendWord(change);
  if (!word || !change || change.absolute === null) return `<span class="delta delta-none" title="${view.esc(change?.reason ?? 'Not available')}">—</span>`;
  const glyph = word === 'Rising' ? '↑' : word === 'Falling' ? '↓' : '→';
  const amount = `${change.absolute > 0 ? '+' : change.absolute < 0 ? '−' : ''}${view.number(Math.abs(change.absolute), 0)} cfs`;
  return `<span class="delta trend-${word.toLowerCase()}" title="${view.esc(`${amount} (${view.number(Math.abs(change.percent!), 1)}%) since ${view.date(change.from_observed_at)}`)}"><span class="value"><span aria-hidden="true">${glyph}</span> ${word}</span><span class="sub">${view.esc(amount)}</span></span>`;
}
function normalCell(normal: FlowNormal, view: HomeView): string {
  if (normal.percent_of_median === null || normal.median === null) return `<span class="delta delta-none" title="${view.esc(normal.reason ?? 'Not available')}">—</span>`;
  const title = `Median of daily flows within ${normal.window_days} days of this date, ${normal.first_year}–${normal.last_year} (${normal.years} years): ${view.number(normal.median, 0)} cfs`;
  return `<span class="delta" title="${view.esc(title)}"><span class="value">${view.number(normal.percent_of_median, 0)}%</span><span class="sub">typical ${view.number(normal.median, 0)} cfs</span></span>`;
}

type Entry = { id: string; name: string; reach: string; kind: 'river' | 'lake' | 'reservoir'; search: string; reading: BoardRow | null; profile: WaterProfile | null };

function compact(text: string, view: HomeView, className = '') {
  return `<span class="cell-copy ${className}" title="${view.esc(text)}">${view.esc(text)}</span>`;
}

function routeCell(plan: WaterPlanning | undefined, view: HomeView): string {
  if (!plan?.access_point) return '<span class="cell-muted">Access point unverified</span>';
  const route = directionsUrl(plan, view.origin);
  return route ? `<a class="route-link" href="${view.esc(route)}" target="_blank" rel="noopener noreferrer">View drive time ↗<span class="sr-only"> in Google Maps (opens in a new tab)</span></a><span class="cell-meta">${view.esc(plan.access_point.label)}</span>`
    : '<span class="cell-muted">Add your starting town above</span>';
}

/** Source reports provide dated context. They never masquerade as live measurements. */
function conditionsCell(entry: Entry, plan: WaterPlanning | undefined, view: HomeView): string {
  const readings = entry.reading ? [
    { value: entry.reading.flow, label: 'Flow', digits: 0 },
    { value: entry.reading.temperature, label: 'Water', digits: 1 },
  ].filter(reading => reading.value.value !== null && reading.value.status !== 'unavailable') : [];
  if (readings.length) return readings.map(({ value, label, digits }) => `<span class="trip-reading"><strong>${view.number(value.value!, digits)} ${view.esc(value.unit)}</strong> ${view.status(value.status)}<span class="cell-meta">${label} · ${view.time(value.observed_at, true)}</span></span>`).join('');
  if (!plan) return '<span class="cell-muted">No current reading or reviewed report</span>';
  return `<span class="report-label">${view.esc(reportLabel(plan.report))}</span>${compact(plan.report.summary, view)}<span class="cell-meta report-coverage">${view.esc(plan.report.coverage)}</span>`;
}

function alertsCell(plan: WaterPlanning | undefined, view: HomeView): string {
  if (!plan?.alerts.length) return '<span class="cell-muted">Current alerts not verified</span>';
  const advisory = plan.alerts.filter(alert => alert.status === 'advisory');
  const items = advisory.length ? advisory : plan.alerts;
  return `${compact(items.map(alert => alert.summary).join(' '), view, advisory.length ? 'advisory-copy' : '')}<span class="cell-meta">${advisory.length ? 'Source advisory · check updates' : 'Current status unverified'}</span>`;
}

function planningRow(entry: Entry, view: HomeView): string {
  const plan = findPlanning(entry.id);
  const species = plan?.target_species ?? entry.profile?.species ?? (WATER_SPECIES[entry.id] ?? []).map(item => SPECIES[item.species].name);
  const checked = plan?.checked_on ?? entry.profile?.source_checked_on;
  return `<tr class="planning-row-entry ${entry.profile ? 'guide-row' : 'gauge-planning-row'}" data-water-kind="${entry.kind}">
    <td><a data-nav href="/waters/${view.esc(entry.id)}"><strong>${view.esc(entry.name)}</strong><span>${view.esc(entry.reach)}</span></a></td>
    <td>${compact(species.join(' · '), view)}</td>
    <td class="drive-cell">${routeCell(plan, view)}</td>
    <td>${compact(plan?.access_summary ?? entry.profile?.access_summary ?? 'Access not yet reviewed', view)}</td>
    <td>${compact(plan?.seasonal_summary ?? 'Seasonal context not yet reviewed', view)}</td>
    <td class="trip-conditions">${conditionsCell(entry, plan, view)}</td>
    <td>${alertsCell(plan, view)}</td>
    <td class="guide-checked"><span class="cell-meta">Guide checked</span>${checked ? `<time datetime="${view.esc(checked)}">${view.esc(profileDate(checked))}</time>` : 'Not reviewed'}</td>
  </tr>`;
}

function gaugeRow(row: BoardRow, view: HomeView): string {
  return `<tr data-water-kind="river">
    <td><a data-nav href="/waters/${view.esc(row.water_id)}"><strong>${view.esc(row.name)}</strong><span>${view.esc(row.reach)} · ${view.esc(row.gauge_label)}</span></a></td>
    <td class="score-cell">${scoreBadge(planningScore(row.water_id, row.score), view)}</td><td>${readingCell(row.flow, view, 0)}</td>
    <td>${normalCell(row.normal, view)}</td><td>${trendCell(dayChange(row), view)}</td>
    <td>${readingCell(row.temperature, view, 1)}</td><td class="spark-cell">${sparklineSvg(row.sparkline)}</td>
    <td class="measured">${view.status(row.status)}<span>${row.flow.observed_at ? view.time(row.flow.observed_at) : 'No reading'}</span></td>
  </tr>`;
}

export function home(view: HomeView): string {
  const gauges = view.mode === 'gauges';
  const live: Entry[] = sortRows(rows(view.board), gauges ? view.sort : { key: view.sort.key === 'name' ? 'name' : 'default', dir: view.sort.dir }).map(row => ({
    id: row.water_id, name: row.name, reach: row.reach, kind: 'river', reading: row, profile: null,
    search: `${row.name} ${row.reach} Central Oregon ${(findPlanning(row.water_id)?.target_species ?? (WATER_SPECIES[row.water_id] ?? []).map(s => SPECIES[s.species].name)).join(' ')}`,
  }));
  const profiles: Entry[] = WATER_PROFILES.map(profile => ({
    id: profile.id, name: profile.name, reach: profile.reach, kind: profile.kind, reading: null, profile,
    search: `${profile.name} ${profile.reach} ${profile.region} ${(findPlanning(profile.id)?.target_species ?? profile.species).join(' ')}`,
  }));
  const terms = view.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = (gauges ? live : [...live, ...profiles]).filter(entry =>
    (view.filter === 'all' || (view.filter === 'live' ? !!entry.reading : view.filter === 'river' ? entry.kind === 'river' : entry.kind !== 'river')) &&
    terms.every(term => entry.search.toLowerCase().includes(term)));
  if (view.sort.key === 'name') list.sort((a, b) => `${a.name} ${a.reach}`.localeCompare(`${b.name} ${b.reach}`) * view.sort.dir);
  const sortHeading = (column: typeof COLUMNS[number]) => {
    const active = view.sort.key === column.key;
    return `<th scope="col" aria-sort="${active ? (view.sort.dir === 1 ? 'ascending' : 'descending') : 'none'}"><button data-sort="${column.key}" ${column.title ? `title="${column.title}"` : ''}>${column.label}${active ? `<span aria-hidden="true"> ${view.sort.dir === 1 ? '↑' : '↓'}</span>` : ''}</button></th>`;
  };
  const headings = gauges ? `${COLUMNS.map(sortHeading).join('')}<th scope="col">7 days</th><th scope="col">Measured</th>`
    : `${sortHeading(COLUMNS[0]!)}${['Target species', 'Drive time', 'Access', 'Seasonal outlook', 'Current conditions', 'Alerts', 'Last verified'].map(label => `<th scope="col">${label}</th>`).join('')}`;
  const body = list.map(entry => gauges ? gaugeRow(entry.reading!, view) : planningRow(entry, view)).join('');
  const filters: [WaterFilter, string][] = [['all', 'All waters'], ['river', 'Rivers'], ['lake', 'Lakes & reservoirs'], ['live', 'Live readings']];
  return `<main id="main" class="home wrap">
    <section class="field-guide-hero" aria-labelledby="home-title"><div class="field-guide-intro"><p class="eyebrow">YOUR OREGON FIELD GUIDE</p><h1 id="home-title">Get to know<br> the water.</h1><p>Rivers move. Conditions change. A clear look at the water before you go.</p></div><img class="field-guide-hero-image" src="/brand/river-country-landscape.webp" width="1280" height="683" alt="Illustrated snowy mountains, evergreen forest, and a winding river under a golden sun." fetchpriority="high" decoding="async"></section>
    <section class="conditions-board" aria-labelledby="board-title">
      <header class="board-heading"><div><p class="eyebrow">THE WATERS</p><h2 id="board-title">Oregon waters & conditions</h2><p>${WATERS.length + WATER_PROFILES.length} places to explore · ${WATERS.length} connected gauges · All times Pacific</p></div><button class="refresh-button" id="refresh" ${view.loading ? 'disabled' : ''}>${view.loading ? 'Checking gauges…' : 'Refresh'}</button></header>
      <div class="board-options"><div class="board-modes" role="group" aria-label="Table view"><button data-board-mode="planning" aria-pressed="${!gauges}">Trip planning</button><button data-board-mode="gauges" aria-pressed="${gauges}">Gauge readings</button></div>${!gauges ? `<div class="trip-origin"><label for="trip-origin">Driving from</label><input id="trip-origin" type="text" value="${view.esc(view.origin)}" placeholder="Your town, Oregon" autocomplete="off"><span>Open a route for current drive time.</span></div>` : ''}</div>
      <div class="water-tools"><div class="water-filters" role="group" aria-label="Filter waters">${filters.map(([value, label]) => `<button data-water-filter="${value}" aria-pressed="${view.filter === value}">${label}</button>`).join('')}</div><div class="water-search"><label for="water-search">Find a water or species</label><input type="search" id="water-search" placeholder="Name, species, or region" value="${view.esc(view.query)}" autocomplete="off"></div></div>
      <p class="water-count" role="status">${list.length} of ${gauges ? WATERS.length : WATERS.length + WATER_PROFILES.length} waters shown</p>
      ${view.error ? `<div class="request-error" role="status"><strong>We couldn’t refresh the gauges.</strong> ${view.board ? 'Previous readings retain their original timestamps.' : 'No live readings are available.'} Source-linked planning information remains below.<span>${view.esc(view.error)}</span></div>` : ''}
      <p class="table-hint" id="table-hint">Swipe or scroll across to compare ${gauges ? 'all readings' : 'all trip details'}.</p>
      <div class="table-scroll" role="region" aria-labelledby="board-title" aria-describedby="table-hint" tabindex="0"><table class="board ${gauges ? 'gauge-board' : 'planning-board'}"><caption class="sr-only">${gauges ? 'Gauge measurements with source times. Select a column heading to sort.' : 'Oregon trip planning. Select a water for its full details and sources.'}</caption><thead><tr>${headings}</tr></thead><tbody>${body || '<tr><td colspan="8" class="no-waters">No waters match. Try a different name, species, or filter.</td></tr>'}</tbody></table></div>
      <p class="board-footnote">“Guide checked” dates a source review, not current access or permission to fish. Reports keep their original date and coverage; historical or undated reports do not establish today’s conditions. Measurements keep their own timestamps.</p>
      <details class="board-notes" id="board-notes"><summary id="board-notes-toggle">How to read the board <span aria-hidden="true">+</span></summary><div><p><strong>Trip planning</strong> combines documented species, public-access context, seasonal patterns, and dated source reports. A typical season is not a legal opening. Check current rules, access notices, and advisories before traveling.</p><p><strong>Drive time</strong> opens Google Maps from your starting town to a named public access point. No time is estimated here, and a gauge location is never used as a driving destination.</p><p><strong>Gauge readings</strong> show five source stations. Scores, typical-flow comparisons, and trends describe those readings; each station remains a candidate proxy for its reach.</p><p>A change within ${STEADY_PERCENT}% reads as steady. Missing measurements stay missing. An absent alert is not an all-clear.</p><a class="text-link" data-nav href="/methodology">Our sources and approach ${view.arrow}</a></div></details>
    </section><p class="coverage-note">The statewide additions are established fishing destinations selected from official guides, not a measured popularity ranking. <a class="text-link" data-nav href="/methodology#coverage">How we add new waters ${view.arrow}</a></p>
  </main>`;
}
