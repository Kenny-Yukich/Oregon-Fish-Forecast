import type { Parameter } from './types';

/**
 * Gauges on the board. Every field below was read from the USGS Water Data API on the verified_on date:
 * station number, name, coordinates, and the primary instantaneous series id for each parameter.
 * A gauge is a candidate proxy for its water; it does not measure every fishing spot on that water.
 */
export interface Gauge {
  station_id: string;
  number: string;
  name: string;
  label: string;
  longitude: number;
  latitude: number;
  series: Record<Parameter, string>;
  /** Primary daily-mean discharge series; the basis for "normal flow for this date". */
  daily_series: string;
  url: string;
}
export interface Water {
  id: string;
  name: string;
  reach: string;
  gauge: Gauge;
  verified_on: string;
}

function gauge(number: string, name: string, label: string, longitude: number, latitude: number, series: Record<Parameter, string>, dailySeries: string): Gauge {
  return { station_id: `USGS-${number}`, number, name, label, longitude, latitude, series, daily_series: dailySeries, url: `https://waterdata.usgs.gov/monitoring-location/USGS-${number}/` };
}

export const WATERS: Water[] = [
  { id: 'lower-deschutes-warm-springs-trout-creek', name: 'Lower Deschutes', reach: 'Warm Springs to Trout Creek', verified_on: '2026-10-12',
    gauge: gauge('14092500', 'DESCHUTES RIVER NEAR MADRAS, OR', 'Madras gauge', -121.246993886344, 44.7259522504172,
      { '00060': '47492ea9b75943f897a02eb01b0b4483', '00065': '1bbe6876316b47ffb21c5599f7e2238d', '00010': '40a81e5a03e644ebbad40c3d86380654' }, 'fefdd77d62624cd5b2edc8d6ae2dec80') },
  { id: 'lower-deschutes-moody', name: 'Lower Deschutes', reach: 'Lower river near the mouth', verified_on: '2026-10-12',
    gauge: gauge('14103000', 'DESCHUTES RIVER AT MOODY, NEAR BIGGS, OR', 'Moody gauge', -120.905620323184, 45.6220678034004,
      { '00060': '5e1925ea44c94eb199158a23fc17febe', '00065': '4f98b2dac6e4437c903fe838cd7d03dd', '00010': 'bc9df919057e493890e0bf6e94e33bdd' }, 'ec9e7f84b3204791a3248177826f326a') },
  { id: 'middle-deschutes-culver', name: 'Middle Deschutes', reach: 'Above Lake Billy Chinook', verified_on: '2026-10-12',
    gauge: gauge('14076500', 'DESCHUTES RIVER NEAR CULVER, OR', 'Culver gauge', -121.321155782003, 44.498729327928,
      { '00060': '06bb6608f8d64da9b2e2359b517af394', '00065': 'a00f567113594198a53fb484693a2d7a', '00010': '7f21fbf24b364f6fa1af4fe26eb454a4' }, 'a0025ba4c80f40d6b93b3dd75f6e616d') },
  { id: 'crooked-river-opal-springs', name: 'Crooked River', reach: 'Lower canyon below Opal Springs', verified_on: '2026-10-12',
    gauge: gauge('14087400', 'CROOKED RIVER BELOW OPAL SPRINGS, NEAR CULVER, OR', 'Opal Springs gauge', -121.298377020145, 44.4923407376854,
      { '00060': '21f582baadb34875a726077e39fe1991', '00065': '38cd36e7f15b446782bf9357c058bfb7', '00010': '26fa261e047644f484aa4353f78b9a35' }, '7088802733df43e08f0f9a8fe0f49e3d') },
  { id: 'metolius-river-grandview', name: 'Metolius River', reach: 'Lower river near Grandview', verified_on: '2026-10-12',
    gauge: gauge('14091500', 'METOLIUS RIVER NEAR GRANDVIEW, OR', 'Grandview gauge', -121.483943279553, 44.6262275028065,
      { '00060': '233fb38310a240c8ba4eef9f0461b6c3', '00065': '74783144d50548f4aad9e1ab2b0c29ed', '00010': '5595f1e6a6f145bb92f8296946b408e3' }, '605736c7f68947188aa47f065cae9b83') },
];

/** Waters without a usable USGS sensor. Their former USGS gauges stopped reporting in 1991 or never existed. */
export const PROPOSED_WATERS = [
  { name: 'Crooked River below Bowman Dam', reason: 'The USGS gauge near Prineville stopped in 1991; a state (OWRD) gauge needs its own source review.' },
  { name: 'Fall River', reason: 'The USGS gauge near La Pine stopped in 1991; a state (OWRD) gauge needs its own source review.' },
  { name: 'Haystack Reservoir', reason: 'No water sensor. Coverage would rely on weather and official reports only.' },
  { name: 'Lake Billy Chinook', reason: 'No water sensor. Coverage would rely on weather and official reports only.' },
];

export function findWater(id: string): Water | undefined {
  return WATERS.find(water => water.id === id);
}
