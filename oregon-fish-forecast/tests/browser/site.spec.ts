import { expect, test, type Page } from '@playwright/test';
import type { Conditions } from '../../shared/types';
import { boardFixture, conditionsFixture, measuredAt, retrievedAt, staleFixture } from './fixtures';
import { WATERS } from '../../shared/waters';
import { WATER_PROFILES } from '../../shared/catalog';
import { WATER_PLANNING, findPlanning } from '../../shared/planning';

const waterPath = '/waters/lower-deschutes-warm-springs-trout-creek';
const apiPath = '/api/v1/conditions/lower-deschutes-warm-springs-trout-creek';
const profilePath = () => `/waters/${WATER_PROFILES[0]!.id}`;

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(retrievedAt) });
});

async function intercept(page: Page, data = conditionsFixture()) {
  await page.route(`**${apiPath}`, route => route.fulfill({ json: data }));
  await page.route('**/api/v1/board', route => route.fulfill({ json: boardFixture() }));
}
const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' });
const boardLink = (page: Page) => page.locator('.board').getByRole('link', { name: /Lower Deschutes.*Warm Springs/ });

async function openConditions(page: Page, data = conditionsFixture()) {
  await intercept(page, data);
  await page.goto(waterPath);
  await expect(page.getByRole('button', { name: 'Refresh conditions' })).toBeEnabled();
}

function metric(page: Page, label: string) {
  return page.locator('article.metric-card').filter({ has: page.getByRole('heading', { name: label, exact: true }) });
}

function reviewedWeatherFixture(): Conditions {
  const data = conditionsFixture();
  data.weather.point_status = 'reviewed';
  data.weather.point_label = 'Synthetic reviewed point for browser testing';
  data.weather.reason = null;
  return data;
}

test('a directly opened trailing-slash conditions URL loads its API data', async ({ page }) => {
  await intercept(page);
  await page.goto(`${waterPath}/`);
  await expect(metric(page, 'River flow')).toContainText('4,321');
  await expect(page.getByRole('button', { name: 'Refresh conditions' })).toBeEnabled();
});

for (const width of [375, 320]) {
  for (const route of ['/', waterPath, profilePath(), '/methodology']) {
    test(`${route} remains readable without horizontal scrolling at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 812 });
      await intercept(page);
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (route === waterPath) await expect(metric(page, 'River flow')).toContainText('4,321');
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
      if (width === 375) {
        const file = testInfo.outputPath(`synthetic-${route === '/' ? 'home' : route === waterPath ? 'conditions' : 'methodology'}-375.png`);
        await page.screenshot({ path: file, fullPage: true });
        await testInfo.attach('Mobile layout — synthetic API fixture', { path: file, contentType: 'image/png' });
      }
    });
  }
}

test('primary navigation works from the keyboard', async ({ page }) => {
  await intercept(page);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeVisible();

  const approach = mainNav(page).getByRole('link', { name: 'Our approach' });
  await approach.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/methodology$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Not a crystal ball.');
  await expect(approach).toHaveAttribute('aria-current', 'page');
  await mainNav(page).getByRole('link', { name: 'Conditions' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await boardLink(page).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${waterPath}$`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lower Deschutes');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get to know the water.');
});

test('the board lists every configured gauge and opens a conditions page without fetching it first', async ({ page }) => {
  let conditionsRequests = 0;
  await page.route('**/api/v1/board', route => route.fulfill({ json: boardFixture() }));
  await page.route(`**${apiPath}`, route => {
    conditionsRequests += 1;
    return route.fulfill({ json: conditionsFixture() });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get to know the water.');
  const image = page.locator('.brand-mark img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  await page.locator('[data-board-mode="gauges"]').click();

  const rows = page.locator('.board tbody tr:not(.guide-row)');
  await expect(rows).toHaveCount(WATERS.length);
  const first = rows.first();
  await expect(first).toContainText('Warm Springs to Trout Creek');
  await expect(first).toContainText('4,321');
  await expect(first.locator('.score')).toContainText('Restrictions reported');
  await expect(first.locator('.score')).not.toContainText('72');
  await expect(first).toContainText('94%');
  await expect(first).toContainText('typical 4,600 cfs');
  await expect(first).toContainText('Falling');
  await expect(first).toContainText('−120 cfs');
  await expect(first.locator('.spark')).toHaveCount(1);
  await expect(first.locator('.status')).toHaveText('Current');
  const metolius = rows.filter({ hasText: 'Metolius' });
  await expect(metolius).toContainText('No reading');
  await expect(metolius).not.toContainText('typical');
  await expect(metolius.locator('.score')).toContainText('—');
  await page.getByRole('button', { name: /^Score/ }).click();
  await expect(rows.first().locator('.score')).toContainText('Restrictions reported');
  await expect(rows.last().locator('.score')).toContainText('—');
  await expect(metolius.locator('.status')).toHaveText('Unavailable');
  await expect(metolius.locator('.spark')).toHaveCount(0);
  expect(conditionsRequests).toBe(0);

  await page.getByRole('button', { name: /^Flow/ }).click();
  await expect(rows.first()).toContainText('4,321');
  await expect(page.locator('th[aria-sort="descending"]')).toHaveCount(1);

  const open = boardLink(page);
  await expect(open).toHaveAttribute('href', waterPath);
  await open.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${waterPath}$`));
  await expect(metric(page, 'River flow')).toContainText('4,321');
  expect(conditionsRequests).toBeGreaterThan(0);
});

test('all 24 waters have eight populated planning fields without invented readings', async ({ page }) => {
  await intercept(page);
  await page.goto('/');
  const guides = page.locator('.board .guide-row');
  await expect(guides).toHaveCount(19);
  await expect(page.locator('.board a[data-nav]')).toHaveCount(WATERS.length + WATER_PROFILES.length);
  await expect(page.locator('.board thead th')).toHaveCount(8);
  for (const record of WATER_PLANNING) {
    const row = page.locator('.board tbody tr').filter({ has: page.locator(`a[href="/waters/${record.water_id}"]`) });
    await expect(row.locator('td')).toHaveCount(8);
    await expect(row).toContainText(record.target_species[0]!);
    await expect(row).toContainText(record.access_summary);
    await expect(row).toContainText(record.seasonal_summary);
    await expect(row).toContainText('Guide checked');
  }
  for (const name of ['Bowman Dam to Castle Rock', 'Fall River', 'Haystack Reservoir', 'Lake Billy Chinook']) {
    await expect(guides.filter({ hasText: name })).toHaveCount(1);
  }
  for (const profile of WATER_PROFILES) {
    const row = guides.filter({ has: page.locator(`a[href="/waters/${profile.id}"]`) });
    await expect(row).toContainText(profile.name);
    await expect(row).toContainText(findPlanning(profile.id)!.report.summary);
    await expect(row).toContainText('Guide checked');
    await expect(row.locator(`time[datetime="${profile.source_checked_on}"]`).first()).toBeVisible();
  }
  await expect(guides.locator('.score, .spark, .status-current')).toHaveCount(0);
  await expect(page.locator('.not-covered')).toHaveCount(0);
});

test('trip routes use the selected starting town and avoid unverified gauge access', async ({ page }) => {
  await intercept(page);
  await page.goto('/');
  await page.locator('#trip-origin').fill('Bend, OR & nearby');
  const fall = page.locator('.board tbody tr').filter({ has: page.locator('a[href="/waters/fall-river-above-falls"]') });
  const route = new URL(await fall.locator('a[href^="https://www.google.com/maps/dir/"]').getAttribute('href') as string);
  expect(route.searchParams.get('origin')).toBe('Bend, OR & nearby');
  expect(route.searchParams.get('destination')).toBe(findPlanning('fall-river-above-falls')!.access_point!.map_query);
  for (const id of ['crooked-river-opal-springs', 'metolius-river-grandview']) {
    const row = page.locator('.board tbody tr').filter({ has: page.locator(`a[href="/waters/${id}"]`) });
    await expect(row.locator('a[href^="https://www.google.com/maps/dir/"]')).toHaveCount(0);
  }
  await page.locator('#trip-origin').fill('');
  await expect(page.locator('.board a[href^="https://www.google.com/maps/dir/"]')).toHaveCount(0);
});

test('a recent source review does not make an old fishing report current', async ({ page }) => {
  await intercept(page);
  await page.goto('/');
  const haystack = page.locator('.board tbody tr').filter({ has: page.locator('a[href="/waters/haystack-reservoir"]') });
  await expect(haystack).toContainText('Historical report · Jul 6, 2026');
  await expect(haystack).toContainText('Guide checked');
  await expect(haystack).toContainText('Oct 12, 2026');
  await expect(haystack.locator('.status-current')).toHaveCount(0);
  await haystack.locator('a[data-nav]').click();
  await expect(page.locator('.dated-report')).toContainText('Jul 6, 2026');
  await expect(page.locator('.dated-report')).toContainText('not a recent West Shore catch report');
  await expect(page.locator('.dated-report')).toContainText('not a live measurement');
});

test('water search and filters compose and preserve the live conditions rows', async ({ page }) => {
  await intercept(page);
  await page.goto('/');
  const links = page.locator('.board tbody a[data-nav]');
  const search = page.locator('#water-search');
  await page.locator('[data-water-filter="river"]').click();
  await expect(links).toHaveCount(17);
  await page.locator('[data-water-filter="lake"]').click();
  await expect(links).toHaveCount(7);
  await search.fill('Billy Chinook');
  await expect(links).toHaveCount(1);
  await expect(links).toContainText('Lake Billy Chinook');
  await search.fill('no such Oregon water');
  await expect(links).toHaveCount(0);
  await search.fill('');
  await page.locator('[data-water-filter="live"]').click();
  await expect(links).toHaveCount(WATERS.length);
  await expect(page.locator('.board .guide-row')).toHaveCount(0);
  await expect(page.locator('.board tbody tr').first()).toContainText('4,321');
  await page.locator('[data-water-filter="all"]').click();
  await expect(links).toHaveCount(WATERS.length + WATER_PROFILES.length);
  await search.fill('HATCHERY ABOVE FALLS');
  await expect(links).toHaveCount(1);
  await expect(links).toContainText('Fall River');
});

test('guide details deep-link, retain source dates, and never fetch gauge data', async ({ page }) => {
  const conditionsRequests: string[] = [];
  await page.route('**/api/v1/conditions/**', route => {
    conditionsRequests.push(route.request().url());
    return route.fulfill({ status: 404, json: { error: 'No gauge exists for this profile.' } });
  });
  for (const profile of WATER_PROFILES) {
    await page.goto(`/waters/${profile.id}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(profile.name);
    await expect(page.locator('main')).toContainText('Guide checked');
    await expect(page.locator(`main time[datetime="${profile.source_checked_on}"]`).first()).toBeVisible();
    await expect(page.locator('main')).toContainText(/not connected|not yet connected/i);
    await expect(page.locator('.metric-card, .score-panel, .score, .trend-chart')).toHaveCount(0);
    const sources = page.locator('main a[href^="https://"]');
    expect(await sources.count()).toBeGreaterThan(1);
    for (const source of profile.sources) await expect(page.locator(`main a[href="${source.url}"]`).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh conditions' })).toHaveCount(0);
  }
  await page.clock.fastForward(6 * 60_000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(conditionsRequests).toEqual([]);
});

test('a guide opens from the table by keyboard and browser back restores the table', async ({ page }) => {
  await intercept(page);
  await page.goto('/');
  const link = page.locator(`.board a[href="${profilePath()}"]`);
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${profilePath()}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(WATER_PROFILES[0]!.name);
  await expect(page.locator('main')).toBeFocused();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get to know the water.');
  await expect(page.locator('.board .guide-row')).toHaveCount(WATER_PROFILES.length);
});

test('measured readings show units, original timestamps and provenance without inventing temperature', async ({ page }) => {
  await openConditions(page);
  const flow = metric(page, 'River flow');
  await expect(flow).toContainText('4,321');
  await expect(flow).toContainText('cfs');
  await expect(flow).toContainText(/Measured Oct 7.*5:15 AM PDT/);
  await expect(flow).toContainText('Provisional');
  await expect(metric(page, 'Gauge height')).toContainText('3.21');
  await expect(metric(page, 'Water temperature')).toContainText('Unavailable');
  await expect(metric(page, 'Water temperature').locator('.metric-value')).toContainText('—');
  await expect(metric(page, 'Typical flow for this date')).toContainText('4,600');
  await expect(metric(page, 'Typical flow for this date')).toContainText('94% of typical');
  const scorePanel = page.locator('.score-panel');
  await expect(scorePanel).toContainText('Restrictions reported');
  await expect(scorePanel).toContainText('withheld');
  await expect(scorePanel).not.toContainText('72');
  await expect(scorePanel).not.toContainText('main target in Oct');
  await expect(scorePanel.locator('.species-row')).toHaveCount(3);
  await expect(scorePanel.locator('.species-row.species-off')).toContainText('Out of season');
  await scorePanel.locator('.species-row').nth(1).locator('summary').click();
  await expect(scorePanel.locator('.species-row').nth(1)).toContainText('restrictions');
  await expect(page.locator('.planning-card')).toContainText('Not yet verified');
  await expect(page.locator('.planning-card')).toContainText('Withheld pending review');
  await page.getByText('View measurement records & provenance').click();
  const provenance = page.locator('.observation-record').filter({ has: page.getByRole('heading', { name: /River flow/ }) });
  await expect(provenance).toContainText('test-series-00060');
  await expect(provenance).toContainText(/Oct 7.*6:00 AM PDT/);
  await expect(provenance.getByRole('link', { name: /View source record/ })).toHaveAttribute('href', /USGS-14092500/);
});

test('gauge weather is explicitly labeled as a development test and hides unreviewed alerts', async ({ page }) => {
  const data = conditionsFixture();
  data.alerts_status = 'current';
  data.alerts = [{ id: 'test-alert', event: 'Synthetic gauge alert', headline: 'This alert is not reviewed for the reach',
    severity: 'Moderate', effective_at: measuredAt, expires_at: '2026-10-08T13:00:00.000Z',
    source_url: 'https://api.weather.gov/alerts/test' }];
  await openConditions(page, data);
  const panel = page.getByRole('region', { name: 'Gauge weather test' });
  await expect(panel).toContainText('Development gauge smoke test');
  await expect(panel).toContainText(/not.*reviewed|unreviewed/i);
  await expect(panel.locator('.weather-periods')).toHaveCount(1);
  await expect(panel).toContainText('Local alerts are not verified');
  await expect(panel).not.toContainText('Synthetic gauge alert');
  await expect(metric(page, 'Water temperature').locator('.metric-value')).not.toContainText('61');
});

test('retained official alerts display their stale status next to the alert', async ({ page }) => {
  const data = reviewedWeatherFixture();
  data.alerts_status = 'stale';
  data.alerts = [{ id: 'test-alert', event: 'Synthetic flood warning', headline: 'A retained test alert',
    severity: 'Severe', effective_at: measuredAt, expires_at: '2026-10-08T13:00:00.000Z',
    source_url: 'https://api.weather.gov/alerts/test' }];
  await openConditions(page, data);
  await expect(page.locator('.alert-status')).toContainText('Synthetic flood warning');
  await expect(page.locator('.alert-status')).toContainText('Stale');
});

test('reviewed forecast distinguishes issue time, period validity and rain probability', async ({ page }) => {
  await openConditions(page, reviewedWeatherFixture());
  const panel = page.getByRole('region', { name: 'Weather' });
  await expect(panel).toContainText(/Issued Oct 7.*4:45 AM PDT/);
  await expect(panel).toContainText('61');
  await expect(panel).toContainText('20% rain chance');
  await expect(panel).toContainText('5 mph NW');
  await expect(panel).toContainText(/Valid until Oct 7.*7 AM/);
  await expect(panel).toContainText('Rain chance is a probability, not a rainfall amount.');
});

test('an unavailable weather source does not hide valid river observations', async ({ page }) => {
  const data = reviewedWeatherFixture();
  data.weather.status = 'unavailable';
  data.weather.periods = [];
  data.weather.reason = 'NWS source is unavailable in this test.';
  data.source_health[1]!.status = 'unavailable';
  await openConditions(page, data);
  await expect(metric(page, 'River flow')).toContainText('4,321');
  await expect(metric(page, 'River flow').locator('.status')).toHaveText('Current');
  await expect(page.getByRole('region', { name: 'Weather' })).toContainText('Forecast currently unavailable');
});

test('unavailable hydrology does not hide a valid reviewed forecast', async ({ page }) => {
  const data = reviewedWeatherFixture();
  data.observations.forEach(row => { row.normalized_value = null; row.quality_status = 'unavailable'; });
  data.trend.points = [];
  data.trend.status = 'unavailable';
  data.source_health[0]!.status = 'unavailable';
  await openConditions(page, data);
  await expect(metric(page, 'River flow')).toContainText('Unavailable');
  await expect(page.getByRole('region', { name: 'Weather' })).toContainText('61');
});

test('stale snapshots preserve measurement times and never claim current readings', async ({ page }) => {
  await openConditions(page, staleFixture());
  await expect(metric(page, 'River flow')).toContainText('4,321');
  await expect(metric(page, 'River flow')).toContainText(/Oct 5.*5:15 AM PDT/);
  await expect(metric(page, 'River flow').locator('.status')).toHaveText('Stale reading');
  await expect(page.locator('.metric-card .status-current')).toHaveCount(0);
  await expect(page.locator('.source-panel')).toContainText('Retained snapshot');
  await expect(page.locator('.trend-panel')).toContainText('Retained history is stale');
});

test('returning to the conditions page reevaluates an older snapshot', async ({ page }) => {
  await openConditions(page, reviewedWeatherFixture());
  await expect(metric(page, 'River flow').locator('.status')).toHaveText('Current');
  await mainNav(page).getByRole('link', { name: 'Our approach' }).click();
  await page.clock.fastForward(3 * 3600_000);
  await mainNav(page).getByRole('link', { name: 'Conditions' }).click();
  await boardLink(page).click();
  await expect(metric(page, 'River flow').locator('.status')).toHaveText('Stale reading');
  await expect(metric(page, 'River flow')).toContainText(/Oct 7.*5:15 AM PDT/);
  await expect(page.locator('.weather-periods')).toHaveCount(0);
});

test('missing history values break the chart line', async ({ page }) => {
  await openConditions(page);
  const chart = page.getByRole('img', { name: /Measured river flow/ });
  await expect(chart).toHaveAttribute('aria-label', /Includes data gaps/);
  const path = await chart.locator('path').getAttribute('d');
  expect(path?.match(/M/g)).toHaveLength(2);
  await page.getByRole('button', { name: '24 hours', exact: true }).click();
  await expect(page.getByRole('button', { name: '24 hours', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '24 hours', exact: true })).toBeFocused();
});

test('two distant observations are not joined across an unmeasured interval', async ({ page }) => {
  const data = conditionsFixture();
  data.trend.points = [
    { id: 'before-gap', observed_at: '2026-10-06T16:15:00.000Z', value: 4000 },
    { id: 'after-gap', observed_at: measuredAt, value: 4321 },
  ];
  await openConditions(page, data);
  const path = await page.locator('.trend-chart path').getAttribute('d');
  expect(path?.match(/M/g)).toHaveLength(2);
  expect(path).not.toContain('L');
});

test('failed refresh retains original values and labels them stale', async ({ page }) => {
  let requests = 0;
  await page.route(`**${apiPath}`, route => {
    requests += 1;
    return requests === 1 ? route.fulfill({ json: conditionsFixture() }) : route.fulfill({ status: 503, json: { error: 'Test service outage' } });
  });
  await page.goto(waterPath);
  await expect(metric(page, 'River flow')).toContainText('4,321');
  await page.getByRole('button', { name: 'Refresh conditions' }).click();
  await expect(page.locator('.request-error')).toContainText('previous snapshot');
  await expect(metric(page, 'River flow')).toContainText(/Oct 7.*5:15 AM PDT/);
  await expect(metric(page, 'River flow').locator('.status')).toHaveText('Stale reading');
  await expect(page.locator('.metric-card .status-current')).toHaveCount(0);
  expect(requests).toBe(2);
});

test('initial service failure shows unavailable readings and usable official links', async ({ page }) => {
  await page.route(`**${apiPath}`, route => route.fulfill({ status: 503, json: { error: 'Test service outage' } }));
  await page.goto(waterPath);
  await expect(page.locator('.request-error')).toContainText('No live readings are available');
  await expect(page.locator('.metric-card .status-unavailable')).toHaveCount(4);
  await expect(page.locator('.planning-card')).toContainText('Withheld pending review');
  await expect(page.locator('.score-panel')).toContainText('No score');
  await expect(page.getByRole('link', { name: /Check ODFW regulations/ })).toHaveAttribute('href', 'https://myodfw.com/fishing/regulations');
  await expect(page.locator('.fixture-notice')).toHaveCount(0);
});

test('closed regulations override otherwise favorable observations', async ({ page }) => {
  const data = conditionsFixture();
  data.regulations_status = 'closed';
  data.restrictions = ['Test closure applies to the requested species and date.'];
  await openConditions(page, data);
  const planning = page.locator('.planning-card');
  await expect(planning).toContainText('Restrictions apply');
  await expect(planning).toContainText('Test closure applies');
  await expect(planning).toContainText('Withheld pending review');
  await expect(planning).not.toContainText('Reviewed open');
});

test('provider text is rendered as text rather than executable HTML', async ({ page }) => {
  const data = reviewedWeatherFixture();
  data.weather.periods[0]!.short_forecast = '<img src=x onerror="window.providerScriptExecuted=true">';
  await openConditions(page, data);
  await expect(page.getByRole('region', { name: 'Weather' })).toContainText(data.weather.periods[0]!.short_forecast);
  await expect(page.locator('.weather-periods img')).toHaveCount(0);
  expect(await page.evaluate(() => 'providerScriptExecuted' in window)).toBe(false);
});
