import test from 'node:test';
import assert from 'node:assert/strict';
import { WATER_PLANNING, directionsUrl, findPlanning, planningScore } from '../shared/planning';
import { WATERS } from '../shared/waters';
import { WATER_PROFILES } from '../shared/catalog';
import { scoreFixture } from './browser/fixtures';

test('every displayed water has one independent planning record and attributable dates', () => {
  const ids = [...WATERS, ...WATER_PROFILES].map(water => water.id).sort();
  assert.deepEqual(WATER_PLANNING.map(record => record.water_id).sort(), ids);
  assert.equal(new Set(WATER_PLANNING.map(record => record.water_id)).size, ids.length);
  for (const record of WATER_PLANNING) {
    assert.ok(record.target_species.length > 0 && record.sources.length > 0);
    assert.ok(record.access_summary && record.access_detail && record.seasonal_summary && record.seasonal_detail && record.methods);
    assert.match(record.checked_on, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(record.report.summary && record.report.coverage);
    if (record.report.reported_on) assert.ok(record.report.reported_on <= record.report.checked_on);
    for (const url of [record.report.url, ...record.sources.map(source => source.url), ...record.alerts.map(alert => alert.url)]) {
      assert.equal(new URL(url).protocol, 'https:');
    }
    assert.ok(record.alerts.length > 0);
    for (const alert of record.alerts) if (alert.status === 'advisory') assert.ok(alert.checked_on, `${record.water_id}: advisory needs source-review date`);
  }
});

test('directions use the chosen origin and named destination, never an assumed gauge access', () => {
  const fall = findPlanning('fall-river-above-falls')!;
  assert.equal(directionsUrl(fall, '  '), null);
  const route = new URL(directionsUrl(fall, 'Bend, OR & nearby')!);
  assert.equal(route.searchParams.get('origin'), 'Bend, OR & nearby');
  assert.equal(route.searchParams.get('destination'), fall.access_point!.map_query);
  assert.equal(route.searchParams.get('travelmode'), 'driving');
  for (const id of ['crooked-river-opal-springs', 'metolius-river-grandview']) {
    assert.equal(directionsUrl(findPlanning(id)!, 'Bend, OR'), null);
  }
});

test('source restrictions suppress old scores without changing measurements or the cached score object', () => {
  const cached = scoreFixture();
  const guarded = planningScore('lower-deschutes-warm-springs-trout-creek', cached)!;
  assert.equal(guarded.score, null);
  assert.ok(guarded.species.every(species => species.score === null));
  assert.equal(cached.score, 72);
  assert.equal(planningScore('middle-deschutes-culver', cached), cached);
  assert.equal(planningScore('lower-deschutes-warm-springs-trout-creek', cached, Date.parse('2026-06-01T12:00:00Z')), cached);
  assert.equal(planningScore('lower-deschutes-warm-springs-trout-creek', cached, Date.parse('2026-09-01T12:00:00Z'))!.score, null);
});
