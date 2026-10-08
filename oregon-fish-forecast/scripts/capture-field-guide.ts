import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { conditionsFixture, retrievedAt } from '../tests/browser/fixtures';

// Local visual review of the selected homepage, without requesting conditions data.
const output = 'artifacts/field-guide';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const results = [];
for (const width of [1084, 1440, 768, 375, 320]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('http://127.0.0.1:8787/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  await page.screenshot({ path: `${output}/home-${width}.png`, fullPage: true });
  results.push(await page.evaluate(() => ({
    width: innerWidth,
    height: document.documentElement.scrollHeight,
    documentWidth: document.documentElement.scrollWidth,
    font: getComputedStyle(document.querySelector('h1')!).fontFamily,
    fontLoaded: document.fonts.check('700 20px "DM Sans"'),
    images: [...document.images].map(image => ({ src: image.getAttribute('src'), loaded: image.complete && image.naturalWidth > 0 })),
  })));
}

await page.setViewportSize({ width: 375, height: 900 });
await page.goto('http://127.0.0.1:8787/');
await page.locator('.proposed-water').first().locator('summary').click();
await page.locator('.proposed-water').first().screenshot({ path: `${output}/proposed-water-open.png` });

const reference = await readFile('../homepage-exploration/3-conditions-field-guide-landscape-v3.png');
const implementation = await readFile(`${output}/home-1084.png`);
await page.setViewportSize({ width: 2192, height: 1600 });
await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#dce1df;font:16px Arial}main{display:flex;gap:8px;padding:8px}figure{margin:0;width:1084px;flex:none}figcaption{padding:10px;background:white}img{display:block;width:1084px;height:auto}</style><main><figure><figcaption>Selected reference — 1084px</figcaption><img src="data:image/png;base64,${reference.toString('base64')}"></figure><figure><figcaption>Implementation — 1084px</figcaption><img src="data:image/png;base64,${implementation.toString('base64')}"></figure></main>`);
await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode())); });
await page.screenshot({ path: `${output}/comparison-full.png`, fullPage: true });
await page.screenshot({ path: `${output}/comparison-hero.png`, clip: { x: 0, y: 0, width: 2192, height: 530 } });

// Shared logo/chrome also appear on the other existing routes. Conditions are synthetic here.
await page.setViewportSize({ width: 1440, height: 1000 });
await page.clock.install({ time: new Date(retrievedAt) });
await page.route('**/api/v1/conditions/lower-deschutes-warm-springs-trout-creek', route => route.fulfill({ json: conditionsFixture() }));
await page.goto('http://127.0.0.1:8787/waters/lower-deschutes-warm-springs-trout-creek');
await page.getByRole('button', { name: 'Refresh conditions' }).waitFor();
await page.locator('.sidebar-note img').evaluate((image: HTMLImageElement) => image.decode());
await page.locator('.detail-sidebar').screenshot({ path: `${output}/conditions-sidebar-synthetic.png` });
await page.goto('http://127.0.0.1:8787/methodology');
await page.locator('.method-index-note img').evaluate((image: HTMLImageElement) => image.decode());
await page.locator('.method-index').screenshot({ path: `${output}/methodology-sidebar.png` });
await browser.close();
await writeFile(`${output}/checks.json`, JSON.stringify({ results, errors }, null, 2));
console.log(JSON.stringify({ results, errors }, null, 2));
if (errors.length || results.some(result => result.documentWidth > result.width || result.images.some(image => !image.loaded))) process.exitCode = 1;
