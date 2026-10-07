import { ConditionsService } from '../worker/index';
import { GAUGE_POINT } from '../worker/nws';

// Read-only integration check. Does not deploy, save a cache, or print credentials.
const gaugeWeather = process.argv.includes('--gauge-weather');
const service = new ConditionsService({ apiKey: process.env.USGS_API_KEY });
const result = await service.conditions(gaugeWeather ? GAUGE_POINT : null);
console.log(JSON.stringify({
  checked_at: result.updated_at,
  purpose: 'Source integration check; not approval of reach representation or fishing recommendations.',
  observations: result.observations,
  trend: { ...result.trend, points: undefined, input_record_ids: undefined,
    point_count: result.trend.points.length,
    first_point: result.trend.points.at(0), last_point: result.trend.points.at(-1) },
  weather: { ...result.weather, periods: result.weather.periods.slice(0, 2),
    total_periods: result.weather.periods.length },
  alerts_status: result.alerts_status,
  alerts: result.alerts,
  source_health: result.source_health,
  regulations_status: result.regulations_status,
  outlook: result.outlook,
}, null, 2));
if (!result.observations.some(record => record.normalized_value !== null) ||
  result.trend.points.length < 2 || (gaugeWeather && result.weather.status === 'unavailable')) {
  process.exitCode = 2;
}
