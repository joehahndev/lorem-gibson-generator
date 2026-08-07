import { general, properNouns } from '@lorem-gibson/dictionary';
import { browserSanitize } from './browser-sanitizer.js';

const DEFAULT_OPTIONS = {
  /** Deterministic per page when set — same seed, same replacement text every run. Omit for fresh random text each call. */
  seed: undefined,
  /** Include the Neuromancer proper-noun/glossary tier in the replacement pool, alongside general vocabulary. */
  includeProperNouns: true,
  /** CSS selectors to leave untouched (in addition to script/style/noscript/template/svg, which are always skipped). */
  exclude: [],
  /** CSS selector — if set, ONLY sanitize inside matching elements (allowlist mode) instead of the whole page. */
  include: undefined,
  /** Attributes to sanitize on top of text nodes and input/textarea values. */
  attributes: ['alt', 'title', 'aria-label', 'placeholder'],
  /** Numeric tokens ("42", "2026-08-07", "$1,204") get replaced with same-shaped random digits instead of dictionary words. */
  preserveNumbers: true,
  /** Emails and http(s) URLs get replaced with obviously-fake lookalikes (user@example.test, https://example.test/word) instead of word salad. */
  maskEmailsAndUrls: true,
  /** Keep sanitizing content added to the DOM after the initial pass (SPA route changes, lazy content) via a MutationObserver. Call stopWatching(page) when done. */
  watch: false,
};

function buildPayload(options) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const words = opts.includeProperNouns ? [...general, ...properNouns] : general;
  return {
    words,
    seed: opts.seed,
    exclude: opts.exclude,
    include: opts.include,
    attributes: opts.attributes,
    preserveNumbers: opts.preserveNumbers,
    maskEmailsAndUrls: opts.maskEmailsAndUrls,
    watch: opts.watch,
  };
}

/**
 * Walks the page's DOM and replaces visible text — plus alt/title/
 * aria-label/placeholder attributes and input/textarea values — with
 * Lorem Gibson placeholder text, roughly preserving word length and
 * layout so a screenshot taken right after still looks "real."
 *
 * Call this immediately before `page.screenshot()`. It mutates the live
 * page, not a copy — don't run it on a page you still need real content
 * from afterward.
 *
 * @param {import('playwright-core').Page} page
 * @param {Partial<typeof DEFAULT_OPTIONS>} [options]
 */
export async function sanitizePage(page, options = {}) {
  await page.evaluate(browserSanitize, buildPayload(options));
}

/**
 * Convenience wrapper: sanitize, then screenshot. `screenshotOptions` is
 * passed straight through to `page.screenshot()`.
 *
 * @param {import('playwright-core').Page} page
 * @param {Partial<typeof DEFAULT_OPTIONS> & { screenshot?: Record<string, unknown> }} [options]
 */
export async function screenshotSanitized(page, options = {}) {
  const { screenshot, ...sanitizeOptions } = options;
  await sanitizePage(page, sanitizeOptions);
  return page.screenshot(screenshot);
}

/** Disconnects the MutationObserver started by `sanitizePage(page, { watch: true })`. */
export async function stopWatching(page) {
  await page.evaluate(() => {
    if (window.__loremGibsonSanitizerObserver) {
      window.__loremGibsonSanitizerObserver.disconnect();
      delete window.__loremGibsonSanitizerObserver;
    }
  });
}

export { browserSanitize } from './browser-sanitizer.js';
