import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const checks: unknown[] = [];
for (const [name, path, width] of [
  ['home-desktop', '/', 1440],
  ['home-mobile', '/', 375],
  ['conditions-desktop', '/waters/lower-deschutes-warm-springs-trout-creek', 1440],
  ['conditions-mobile', '/waters/lower-deschutes-warm-springs-trout-creek', 375],
  ['methodology-mobile', '/methodology', 375],
] as const) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`http://127.0.0.1:8787${path}`);
  if (path.startsWith('/waters/')) await page.getByRole('button', { name: 'Refresh conditions' }).waitFor({ timeout: 60_000 });
  await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
  checks.push({ name, ...await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth,
    title: document.title,
    metrics: [...document.querySelectorAll('.metric-card')].map(card => card.textContent),
  })) });
}
await browser.close();
console.log(JSON.stringify({ checks, errors }, null, 2));
if (errors.length) process.exitCode = 1;
