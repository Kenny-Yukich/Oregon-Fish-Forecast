import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WATERS } from '../../oregon-fish-forecast/shared/waters';
import { WATER_PROFILES } from '../../oregon-fish-forecast/shared/catalog';
import { findPlanning } from '../../oregon-fish-forecast/shared/planning';

const destination = resolve(import.meta.dirname, '../reference');
await mkdir(destination, { recursive: true });
const entries = [
  ...WATERS.map(water => ({ id: water.id, name: water.name, reach: water.reach, kind: 'river', region: 'Central Oregon',
    gauge: { station_id: water.gauge.station_id, label: water.gauge.label, url: water.gauge.url },
    planning: findPlanning(water.id), readings: null })),
  ...WATER_PROFILES.map(water => ({ id: water.id, name: water.name, reach: water.reach, kind: water.kind, region: water.region,
    description: water.description, sources: water.sources, gauge: null, planning: findPlanning(water.id), readings: null })),
];
await writeFile(resolve(destination, 'waters.json'), JSON.stringify({ brand: 'Oregon Fish Forecast', defaultOrigin: 'Portland, Oregon',
  generatedFor: 'Separate Open Design comparison, October 13, 2026',
  dataNote: 'Editorial records were checked October 12, 2026. No live measurements are included. Missing readings must remain unavailable.',
  waters: entries }, null, 2));
for (const name of ['weather-fish.webp', 'river-country-landscape.webp']) {
  await copyFile(resolve(import.meta.dirname, '../../oregon-fish-forecast/public/brand', name), resolve(destination, name));
}
console.log(JSON.stringify({ waterCount: entries.length, destination }));
