# @lorem-gibson/generator

CLI and library for generating Lorem Gibson placeholder text on demand.
Built on [`@lorem-gibson/dictionary`](../dictionary) — see there for word-list
provenance.

## CLI

From the repo root (workspace-linked, no publish needed):

```sh
npm install
npx lorem-gibson paragraph -n 3
npx lorem-gibson sentence --seed demo-page
npx lorem-gibson title -n 4
npx lorem-gibson slug -n 3
npx lorem-gibson dictionary --format csv --out gibson-words.csv
npx lorem-gibson --help
```

`--seed <value>` makes output deterministic — same seed, same text, every
run. Useful for fixtures you don't want to keep re-diffing.

## Library

```js
import { createGenerator, word, sentence, paragraph, title, slug } from '@lorem-gibson/generator'

sentence()                          // "Chrome sprawl bicycle otaku denim tower Kowloon."
paragraph({ minSentences: 2, maxSentences: 4 })
title(4)                            // "Neon Sprawl Chrome Uplink"
slug(3)                             // "neon-sprawl-chrome"

// Deterministic instance — reuse across calls, same seed every time
const gen = createGenerator({ seed: 'my-fixture' })
gen.sentence()
```

`properNounChance` (default `0.12`) controls how often a Neuromancer
proper-noun/glossary term (`Chatsubo`, `Freeside`, `black ice`) shows up
instead of general vocabulary — turn it down for cleaner ambient filler,
up for more flavor.
