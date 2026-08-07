// Before/after demo for the blog post: opens the fixture dashboard, shoots it
// as-is, sanitizes it (text + images), shoots it again. Run with:
//   node examples/capture-screenshots.mjs
import { chromium } from 'playwright';
import { sanitizePage } from '../packages/playwright-sanitizer/src/index.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, 'dashboard.html');
const outDir = path.join(here, 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 780 } });
await page.goto(`file://${fixture.replace(/\\/g, '/')}`);

await page.screenshot({ path: path.join(outDir, 'before.png'), fullPage: true });
console.log('wrote before.png');

// text only, no images touched
await sanitizePage(page, { seed: 'blog-demo-text', images: false });
await page.screenshot({ path: path.join(outDir, 'after-text-only.png'), fullPage: true });
console.log('wrote after-text-only.png (text sanitized, images untouched)');

await browser.close();

// Fresh page for the text+images pass, so it's not double-sanitizing the
// already-sanitized DOM from the run above.
const browser2 = await chromium.launch();
const page2 = await browser2.newPage({ viewport: { width: 960, height: 780 } });
await page2.goto(`file://${fixture.replace(/\\/g, '/')}`);
await sanitizePage(page2, { seed: 'blog-demo-text', images: { style: 'scanlines' } });
await page2.screenshot({ path: path.join(outDir, 'after-text-and-images.png'), fullPage: true });
console.log('wrote after-text-and-images.png (text + images sanitized)');
await browser2.close();
