# lorem-gibson-generator

Cyberpunk (William Gibson-style) placeholder text, three tools, one repo
— bound together by the word dictionary all three draw from.

| Package | What it's for |
|---|---|
| [`packages/dictionary`](packages/dictionary) | The word data. Merged and deduped from three GitHub "Lorem Gibson" clones. See [`SOURCES.md`](SOURCES.md) for provenance. |
| [`packages/generator`](packages/generator) | `npx lorem-gibson` CLI + library — words, sentences, paragraphs, titles, slugs, on demand. |
| [`packages/playwright-sanitizer`](packages/playwright-sanitizer) | Replaces real text in a page's DOM with placeholder text before a Playwright screenshot, so screenshots that end up in docs/tickets/blog posts don't leak real data. |

## Setup

```sh
npm install     # npm workspaces links the three packages together
```

## Quick start

```sh
npx lorem-gibson paragraph -n 2
npx lorem-gibson sentence --seed demo-page
npx lorem-gibson dictionary --format csv --out gibson-words.csv
```

```js
// in a Playwright script, right before a screenshot
import { sanitizePage } from '@lorem-gibson/playwright-sanitizer'
await sanitizePage(page)
await page.screenshot({ path: 'anonymized.png', fullPage: true })
```

Full details, options, and examples live in each package's own README.
