// Captures the four dead-channel image styles side by side for the blog post.
import { chromium } from 'playwright';
import { sanitizePage } from '../packages/playwright-sanitizer/src/index.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, 'styles-gallery.html');
const outDir = path.join(here, 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 760, height: 560 } });
await page.goto(`file://${fixture.replace(/\\/g, '/')}`);

for (const style of ['snow', 'scanlines', 'scrambled', 'phosphor']) {
  await sanitizePage(page, { include: `#${style}`, images: { style }, attributes: [], exclude: ['figcaption'] });
}

await page.screenshot({ path: path.join(outDir, 'styles-gallery.png'), fullPage: true });
console.log('wrote styles-gallery.png');
await browser.close();
