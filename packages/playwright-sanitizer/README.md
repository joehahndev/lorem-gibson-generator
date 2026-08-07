# @lorem-gibson/playwright-sanitizer

Anonymizes a page before you screenshot it: walks the live DOM and
replaces visible text, `alt`/`title`/`aria-label`/`placeholder`
attributes, and input/textarea values with Lorem Gibson placeholder
text — roughly matching original word length so layout doesn't reflow.
Numbers become same-shaped random digits; emails and URLs become obvious
fakes (`user@example.test`).

Built on [`@lorem-gibson/dictionary`](../dictionary) — same word list the
generator uses, that's the thing tying these tools together.

## Why not just `page.screenshot({ mask: [...] })`

Playwright's built-in `mask` option paints a solid box over an element —
correct when you want to hide something entirely, but it means picking
every sensitive locator by hand and the screenshot shows blank boxes.
This tool is for the opposite case: you want the screenshot to still
*look* like a populated, working UI — for a blog post, a ticket, a demo
— just with no real customer data in it anywhere on the page.

## Usage

```js
import { chromium } from 'playwright'
import { sanitizePage, screenshotSanitized } from '@lorem-gibson/playwright-sanitizer'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('https://example.com/dashboard')

// Option A: sanitize, then screenshot yourself
await sanitizePage(page)
await page.screenshot({ path: 'dashboard.png', fullPage: true })

// Option B: one call
await screenshotSanitized(page, { path: 'dashboard.png', screenshot: { fullPage: true } })
```

### Options

```js
await sanitizePage(page, {
  seed: 'dashboard-fixture',     // deterministic output — same seed, same placeholder text every run
  includeProperNouns: true,      // mix in Chatsubo/Freeside/black ice, not just general vocab
  exclude: ['.brand', '[data-no-sanitize]'],  // CSS selectors to leave alone
  include: '#main-content',      // allowlist mode: ONLY sanitize inside this selector
  attributes: ['alt', 'title', 'aria-label', 'placeholder'],
  preserveNumbers: true,         // "42" -> "17", not a word
  maskEmailsAndUrls: true,       // real-looking emails/URLs -> obvious fakes
  watch: true,                   // keep sanitizing content added after the initial pass (SPA route changes)
})
```

Always sanitizes the whole page except script/style/noscript/template/svg
by default — the assumption is "everything is potentially real user data
unless you say otherwise," which is the safer default for anonymization.

With `watch: true`, a `MutationObserver` keeps sanitizing new DOM content
(useful if you interact with the page — open a modal, navigate an SPA
route — between sanitizing and screenshotting). Call `stopWatching(page)`
when you're done to disconnect it.

`seed` matters for visual-regression screenshots: without it, placeholder
text is fresh random every run, so an unrelated diff shows up as noise
every time. Set a stable seed per fixture/page and the same elements get
the same placeholder text across runs.
