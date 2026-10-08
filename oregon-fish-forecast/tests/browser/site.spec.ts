import { expect, test, type Page } from '@playwright/test';
import type { Conditions } from '../../shared/types';
import { conditionsFixture, measuredAt, retrievedAt, staleFixture } from './fixtures';

const waterPath = '/waters/lower-deschutes-warm-springs-trout-creek';
const apiPath = '/api/v1/conditions/lower-deschutes-warm-springs-trout-creek';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(retrievedAt) });
});

async function intercept(page: Page, data = conditionsFixture()) {
  await page.route(`**${apiPath}`, route => route.fulfill({ json: data }));
}

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
  for (const route of ['/', waterPath, '/methodology']) {
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

  const riverNav = page.getByRole('navigation').getByRole('link', { name: 'River conditions' });
  await riverNav.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${waterPath}$`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lower Deschutes');
  await expect(riverNav).toHaveAttribute('aria-current', 'page');
  await page.getByRole('navigation').getByRole('link', { name: 'Our approach' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/methodology$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Not a crystal ball.');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lower Deschutes');
});

test('homepage artwork loads and the featured reach opens the available conditions page', async ({ page }) => {
  let conditionsRequests = 0;
  await page.route(`**${apiPath}`, route => {
    conditionsRequests += 1;
    return route.fulfill({ json: conditionsFixture() });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get to know the water.');

  for (const selector of ['.field-guide-hero-image', '.brand-mark img']) {
    const image = page.locator(selector);
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => (
      node.complete && node.naturalWidth > 0 && node.naturalHeight > 0
    ))).toBe(true);
  }
  expect(conditionsRequests).toBe(0);

  const reach = page.locator('.featured-reach');
  await expect(reach).toContainText('Warm Springs to Trout Creek');
  await expect(reach).toContainText('Reach review in progress');
  const explore = reach.getByRole('link', { name: 'Explore the Lower Deschutes' });
  await expect(explore).toHaveAttribute('href', waterPath);
  await explore.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${waterPath}$`));
  await expect(metric(page, 'River flow')).toContainText('4,321');
  expect(conditionsRequests).toBeGreaterThan(0);
});

test('proposed waters expand with the keyboard and link to coverage review instead of unavailable conditions', async ({ page }) => {
  await page.goto('/');
  const names = ['Crooked River', 'Metolius River', 'Fall River', 'Haystack Reservoir', 'Lake Billy Chinook'];
  await expect(page.locator('details.proposed-water')).toHaveCount(names.length);

  for (const name of names) {
    const row = page.locator('details.proposed-water').filter({ has: page.locator('summary').filter({ hasText: name }) });
    const summary = row.locator('summary');
    const reviewLink = row.locator('a[href="/methodology#coverage"]');
    await expect(summary).toContainText('Proposed coverage');
    await expect(row).toHaveJSProperty('open', false);
    await expect(reviewLink).toBeHidden();
    await expect(row.locator('a[href^="/waters/"]')).toHaveCount(0);

    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(row).toHaveJSProperty('open', true);
    await expect(summary).toBeFocused();
    await expect(row).toContainText(/review/i);
    await expect(reviewLink).toBeVisible();
    await page.keyboard.press('Space');
    await expect(row).toHaveJSProperty('open', false);
    await expect(summary).toBeFocused();
  }

  const firstRow = page.locator('details.proposed-water').first();
  await firstRow.locator('summary').focus();
  await page.keyboard.press('Enter');
  await firstRow.locator('a[href="/methodology#coverage"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/methodology#coverage$/);
  await expect(page.getByRole('heading', { name: 'One reach at a time.' })).toBeVisible();
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
  const panel = page.getByRole('region', { name: 'Gauge weather test.' });
  await expect(panel).toContainText('DEVELOPMENT GAUGE SMOKE TEST');
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
  const panel = page.getByRole('region', { name: 'The weather ahead.' });
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
  await expect(page.getByRole('region', { name: 'The weather ahead.' })).toContainText('Forecast currently unavailable');
});

test('unavailable hydrology does not hide a valid reviewed forecast', async ({ page }) => {
  const data = reviewedWeatherFixture();
  data.observations.forEach(row => { row.normalized_value = null; row.quality_status = 'unavailable'; });
  data.trend.points = [];
  data.trend.status = 'unavailable';
  data.source_health[0]!.status = 'unavailable';
  await openConditions(page, data);
  await expect(metric(page, 'River flow')).toContainText('Unavailable');
  await expect(page.getByRole('region', { name: 'The weather ahead.' })).toContainText('61');
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
  await page.getByRole('navigation').getByRole('link', { name: 'Our approach' }).click();
  await page.clock.fastForward(3 * 3600_000);
  await page.getByRole('navigation').getByRole('link', { name: 'River conditions' }).click();
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
  await expect(page.locator('.metric-card .status-unavailable')).toHaveCount(3);
  await expect(page.locator('.planning-card')).toContainText('Withheld pending review');
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
  await expect(page.getByRole('region', { name: 'The weather ahead.' })).toContainText(data.weather.periods[0]!.short_forecast);
  await expect(page.locator('.weather-periods img')).toHaveCount(0);
  expect(await page.evaluate(() => 'providerScriptExecuted' in window)).toBe(false);
});
