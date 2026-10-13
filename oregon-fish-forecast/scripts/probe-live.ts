import { ConditionsService } from '../worker/index';
import { gaugePoint } from '../worker/nws';
import { WATERS } from '../shared/waters';

// Read-only integration check across every configured gauge. Does not deploy, save a cache, or print credentials.
const gaugeWeather = process.argv.includes('--gauge-weather');
const service = new ConditionsService({ apiKey: process.env.USGS_API_KEY });
const board = await service.board();
console.log(JSON.stringify({
  checked_at: board.updated_at,
  purpose: 'Source integration check; not approval of reach representation or fishing recommendations.',
  board: board.rows.map(row => ({ ...row, sparkline: undefined, sparkline_points: row.sparkline.filter(p => p.value !== null).length })),
}, null, 2));
let failures = board.rows.filter(row => row.flow.value === null).length;
for (const water of WATERS) {
  const result = await service.conditions(water.id, gaugeWeather ? gaugePoint(water.gauge) : null);
  console.log(JSON.stringify({
    water_id: water.id,
    observations: result.observations.map(o => ({ label: o.label, value: o.normalized_value, unit: o.normalized_unit, observed_at: o.observed_at, status: o.quality_status, issues: o.issues })),
    trend: { status: result.trend.status, point_count: result.trend.points.length, complete: result.trend.complete, reason: result.trend.reason,
      first_point: result.trend.points.at(0), last_point: result.trend.points.at(-1) },
    weather: { status: result.weather.status, point_status: result.weather.point_status, total_periods: result.weather.periods.length, reason: result.weather.reason },
    alerts_status: result.alerts_status,
    source_health: result.source_health,
  }, null, 2));
  if (!result.observations.some(record => record.normalized_value !== null) ||
    result.trend.points.length < 2 || (gaugeWeather && result.weather.status === 'unavailable')) failures++;
}
if (failures) process.exitCode = 2;
