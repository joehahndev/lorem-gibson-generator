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
  /**
   * Replace <img> content with a CRT dead-channel look — snow/static,
   * scanlines, tracking-scramble, or phosphor noise. `false` (default)
   * leaves images alone; `true` sanitizes every image at least
   * `imageMinDimension` in either direction with a randomly-chosen
   * style; or pass an object to pick a specific `style`
   * ('snow' | 'scanlines' | 'scrambled' | 'phosphor' | 'random').
   * Off by default because, unlike text, there's no safe universal
   * signal to tell a user's uploaded photo apart from a decorative
   * logo or icon — turn it on deliberately.
   */
  images: false,
  /** Images smaller than this (px, either dimension) are left alone even when `images` is on — catches icons/logos. */
  imageMinDimension: 32,
  /** Placeholder image texture resolution cap (px) — kept small on purpose, it's static, not a photo. */
  imageMaxDimension: 320,
};

function buildPayload(options) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const words = opts.includeProperNouns ? [...general, ...properNouns] : general;
  const imagesOpt = opts.images
    ? {
        style: (opts.images === true ? undefined : opts.images.style) ?? 'random',
        minDimension: opts.imageMinDimension,
        maxDimension: opts.imageMaxDimension,
      }
    : false;
  return {
    words,
    seed: opts.seed,
    exclude: opts.exclude,
    include: opts.include,
    attributes: opts.attributes,
    preserveNumbers: opts.preserveNumbers,
    maskEmailsAndUrls: opts.maskEmailsAndUrls,
    watch: opts.watch,
    images: imagesOpt,
  };
}

/**
 * Walks the page's DOM and replaces visible text — plus alt/title/
 * aria-label/placeholder attributes and input/textarea values — with
 * Lorem Gibson placeholder text, roughly preserving word length and
 * layout so a screenshot taken right after still looks "real." Pass
 * `images: true` to also swap <img> content for CRT dead-channel static
 * (off by default — see the `images` option below).
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
