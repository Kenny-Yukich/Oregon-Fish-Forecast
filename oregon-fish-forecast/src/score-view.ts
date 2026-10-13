import type { SpeciesScore, WaterScore } from '../shared/types';
import { describeMonths } from '../shared/species';

export interface ScoreFormat { esc: (value: unknown) => string; number: (value: number, max?: number) => string }

/** The compact score cell used on the board: number, word, and the species it describes. */
export function scoreBadge(score: WaterScore | undefined, fmt: ScoreFormat): string {
  if (!score || score.score === null) {
    const why = score?.reason ?? (score?.missing.length ? `Missing ${score.missing.join(' and ')}.` : 'No score yet.');
    return `<span class="score score-none" title="${fmt.esc(why)}"><span class="score-number">—</span><span class="score-species">${fmt.esc(score?.primary_name ?? 'No score')}</span></span>`;
  }
  const headline = score.species.find(s => s.species === score.species_id);
  const flags = [score.partial ? `partial · missing ${score.missing.join(', ')}` : '', headline?.stress ? 'water too warm for this species' : ''].filter(Boolean).join(' · ');
  return `<span class="score score-${score.label!.toLowerCase()}" title="${fmt.esc(flags || `${score.label} for ${score.species_name}`)}"><span class="score-number">${score.score}</span><span class="score-word">${score.label}${score.partial ? '<small>partial</small>' : ''}</span><span class="score-species">${fmt.esc(score.species_name)}</span></span>`;
}

function components(species: SpeciesScore, fmt: ScoreFormat): string {
  return `<ul class="score-breakdown">${species.components.map(c => `<li><span class="score-part">${fmt.esc(c.name)}</span><span class="score-points">${c.points === null ? '—' : `${fmt.number(c.points, 0)} / ${fmt.number(c.weight * 100, 0)}`}</span><span class="score-detail">${fmt.esc(c.detail)}</span></li>`).join('')}</ul>`;
}

/** The full score section on a water's page: headline, its breakdown, then every species with its own score. */
export function scorePanel(score: WaterScore | undefined, loading: boolean, fmt: ScoreFormat): string {
  const headline = score?.species.find(s => s.species === score.species_id);
  const month = score ? describeMonths([score.month]) : '';
  const hero = !score || score.score === null || !headline
    ? `<div class="score-hero"><div class="score-big score-none"><span class="score-number">—</span></div><div class="score-copy"><strong>${fmt.esc(score?.primary_name ?? 'No score')}</strong><p>${fmt.esc(score?.reason ?? (score?.missing.length ? `Missing ${score.missing.join(' and ')}.` : loading ? 'Checking sources…' : 'No score is available.'))}</p></div></div>`
    : `<div class="score-hero"><div class="score-big score-${score.label!.toLowerCase()}"><span class="score-number">${score.score}</span><span class="score-word">${score.label}</span></div><div class="score-copy"><strong>${fmt.esc(headline.name)}</strong> · ${headline.primary ? `the main target in ${month}` : `${score.primary_name ? `${fmt.esc(score.primary_name)} is the usual target in ${month} but could not be scored; ` : ''}best-scoring species in season`}${score.partial ? `<p class="score-flag">Partial score: no ${fmt.esc(score.missing.join(' or '))} reading, so the rest carries the weight.</p>` : ''}${headline.stress ? '<p class="score-flag">The water is warm enough to stress these fish. Fishing them now can kill fish that are released.</p>' : ''}${headline.capped_by && !headline.stress ? `<p class="score-flag">Score held down by ${fmt.esc(headline.capped_by)}.</p>` : ''}${components(headline, fmt)}</div></div>`;
  const list = score?.species.map(s => `<details class="species-row ${s.in_season ? '' : 'species-off'}"><summary><span class="species-name">${fmt.esc(s.name)}${s.primary ? '<small>main target</small>' : ''}</span><span class="species-season">${s.in_season ? describeMonths(s.months) : `Out of season · ${describeMonths(s.months)}`}</span><span class="species-score">${s.score === null ? (s.in_season ? '—' : '') : `<b>${s.score}</b> ${s.label}${s.partial ? '<small>partial</small>' : ''}`}</span></summary><div class="species-body">${s.note ? `<p>${fmt.esc(s.note)}</p>` : ''}${s.in_season ? components(s, fmt) : `<p>Not a realistic target this month. Season: ${describeMonths(s.months)}.</p>`}</div></details>`).join('') ?? '';
  return `<section class="panel score-panel" aria-labelledby="score-title"><div class="panel-heading"><h2 id="score-title">Fishing score</h2><span class="panel-source">${fmt.esc(score?.version ?? '')}</span></div>${hero}<h3 class="species-heading">Every species in this water</h3><div class="species-list">${list}</div><p class="panel-footnote">Scores blend today’s flow against normal, water temperature, the 24-hour trend, and, for runs and hatches, time of year — each species on its own comfort bands. A score describes the water for that fish; it is not a promise of a bite, and it never overrides the rules. <a data-nav href="/methodology#score">How the score works</a></p></section>`;
}
