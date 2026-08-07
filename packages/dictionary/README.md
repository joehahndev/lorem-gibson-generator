# @lorem-gibson/dictionary

The word data. No generation logic — just two arrays, merged and deduped
from three independent "Lorem Gibson" implementations found on GitHub, all
of which trace back to the same root list published at `loremgibson.com`.
See [`/SOURCES.md`](../../SOURCES.md) at the repo root for provenance.

```js
import { general, properNouns, all } from '@lorem-gibson/dictionary'

general      // 170 terms — safe anywhere: "chrome", "sprawl", "neon", "hacker", "-ware"...
properNouns  // 62 terms  — names/places/jargon: "Chatsubo", "Freeside", "black ice"...
all          // general + properNouns, 232 terms total
```

`@lorem-gibson/generator` and `@lorem-gibson/playwright-sanitizer` both
depend on this package, so the word list only lives in one place.
