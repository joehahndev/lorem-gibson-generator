# lorem-gibson-generator

Cyberpunk (William Gibson-style) placeholder text, four tools, one repo
— bound together by the word dictionary they draw from and the
anonymize-a-screenshot purpose most of them serve.

| Package | What it's for |
|---|---|
| [`packages/dictionary`](packages/dictionary) | The word data. Merged and deduped from three GitHub "Lorem Gibson" clones. See [`SOURCES.md`](SOURCES.md) for provenance. |
| [`packages/generator`](packages/generator) | `npx lorem-gibson` CLI + library — words, sentences, paragraphs, titles, slugs, on demand. |
| [`packages/playwright-sanitizer`](packages/playwright-sanitizer) | Replaces real text (and optionally images, as CRT dead-channel static) in a page's DOM before a Playwright screenshot, so screenshots that end up in docs/tickets/blog posts don't leak real data. |
| [`packages/mcp-server`](packages/mcp-server) | The above two, as an MCP server registered machine-wide — `generate_text`, `screenshot_sanitized`, `sanitize_html` tools available to any project's Claude Code session, no per-project install. |

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
A ready-to-sanitize demo page lives in [`examples/`](examples).

## Using this from another project

Nothing here is published to npm — it's local-only, linked via npm
workspaces inside this repo. To pull `@lorem-gibson/playwright-sanitizer`
(or `@lorem-gibson/generator`) into a *different* project on this
machine, point at both it and `@lorem-gibson/dictionary` with `file:`
dependencies (the sanitizer/generator depend on the dictionary by a bare
`"*"` version, which only resolves inside this workspace — an external
project needs its own explicit path to it):

```jsonc
// in the OTHER project's package.json
"dependencies": {
  "@lorem-gibson/dictionary": "file:C:/dev/lorem-gibson-generator/packages/dictionary",
  "@lorem-gibson/playwright-sanitizer": "file:C:/dev/lorem-gibson-generator/packages/playwright-sanitizer"
}
```

Then `npm install` in that project. npm copies/symlinks both packages in;
pull latest changes here and re-run `npm install` there to update.

For the CLI, `@lorem-gibson/generator`'s `bin` entry works the same way
once it's a `file:` dependency — `npx lorem-gibson ...` inside the other
project resolves to it. Or skip installing entirely and just run it from
here: `node C:/dev/lorem-gibson-generator/packages/generator/bin/lorem-gibson.js ...`.
