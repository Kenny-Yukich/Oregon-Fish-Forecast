// Run after `node build-sheet.mjs --set river`.
// Uses the browser dependency already installed in the adjacent app.
import { chromium } from '../oregon-fish-forecast/node_modules/playwright/index.mjs';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'renders', 'river-country');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(join(here, 'river-country.html')).href);
  await page.evaluate(() => document.fonts.ready);
  const report = { browser: browser.version(), errors, layouts: [], assets: [] };
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    report.layouts.push(await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        concepts: document.querySelectorAll('.concept').length,
        duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
        missingClips: [...document.querySelectorAll('[clip-path]')]
          .map((node) => node.getAttribute('clip-path').slice(5, -1))
          .filter((id) => !document.getElementById(id)),
      };
    }));
    if (width === 1440) {
      await page.screenshot({ path: join(out, 'desktop-sheet.png'), fullPage: true });
      for (const section of await page.locator('.concept').all()) {
        await section.screenshot({ path: join(out, `${await section.getAttribute('id')}.png`) });
      }
    }
    if (width === 390) await page.locator('#concept-C4').screenshot({ path: join(out, 'mobile-C4.png') });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const cards = await page.locator('.concept').evaluateAll((sections) => sections.map((section) => ({
    name: `${section.querySelector('.c-id').textContent} · ${section.querySelector('h2').textContent}`,
    marks: [...section.querySelectorAll('.stage')].map((stage) => stage.outerHTML).join(''),
  })));
  const comparison = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await comparison.setContent(`<html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:32px;background:#F5F2E9;color:#002A86;font-family:Arial,sans-serif}
    h1{font-size:30px;margin:0 0 8px}p{margin:0 0 24px;color:#596975}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
    article{border:1px solid #d5dcda;border-radius:16px;overflow:hidden}h2{font-size:18px;padding:16px;margin:0}
    figure{margin:0;display:grid;place-items:center;height:160px}.on-paper{background:#FFFEF8}.on-blue{background:#002A86}
    svg{width:240px;height:160px}
  </style></head><body><h1>River Country · Seven variations</h1><p>Each mark on paper and header blue. Open river-country.html for colorways, lockups and size tests.</p>
  <div class="grid">${cards.map((card) => `<article><h2>${card.name}</h2>${card.marks}</article>`).join('')}</div></body></html>`);
  await comparison.screenshot({ path: join(out, 'comparison.png'), fullPage: true });
  const svgDir = join(here, 'svg', 'river-country');
  for (const file of readdirSync(svgDir).filter((name) => name.endsWith('.svg'))) {
    const source = readFileSync(join(svgDir, file), 'utf8');
    report.assets.push(await page.evaluate(({ source, file }) => {
      const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
      return { file, valid: !doc.querySelector('parsererror') && doc.documentElement.localName === 'svg' };
    }, { source, file }));
  }
  writeFileSync(join(out, 'checks.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output: out, layouts: report.layouts, svgCount: report.assets.length, invalid: report.assets.filter((asset) => !asset.valid), errors }));
  if (errors.length || report.layouts.some((layout) => layout.scrollWidth > layout.width || layout.duplicateIds.length || layout.missingClips.length) || report.assets.some((asset) => !asset.valid)) process.exitCode = 1;
} finally {
  await browser.close();
}
