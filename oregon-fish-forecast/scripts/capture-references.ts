import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const references = [['awsmd', 'https://awsmd.com/'], ['genrod', 'https://www.genrod.com.ar/home'], ['imagine', 'https://www.loungelizard.com/work/imagine/']];
for (const [name, url] of references.filter(([name]) => process.argv.length < 3 || process.argv.includes(name))) {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `artifacts/reference-${name}-top.png` });
    console.log(JSON.stringify({ name, url: page.url(), status: response?.status(), title: await page.title(), body: (await page.locator('body').innerText()).slice(0, 12000), headings: await page.locator('h1, h2, h3').evaluateAll(nodes => nodes.slice(0, 15).map(node => { const style = getComputedStyle(node); return { text: node.textContent?.trim(), font: style.fontFamily, size: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing }; })) }));
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `artifacts/reference-${name}-middle.png` });
  } catch (error) {
    console.log(JSON.stringify({ name, error: String(error) }));
  }
}
await browser.close();
