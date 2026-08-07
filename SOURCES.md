# Dictionary provenance

`packages/dictionary` merges and dedupes the word lists from three
independent GitHub implementations of "Lorem Gibson" — William
Gibson-flavored placeholder text. All three turned out to share the same
root list, which cross-validated the data rather than requiring a
judgment call about which source to trust:

| Source | What it contributed |
|---|---|
| [`loremgibson.com`](http://loremgibson.com/) (site by [@davidtweaver](https://twitter.com/DavidTWeaver)) | The canonical 160-word list, pulled from an inline `<script>` in the page source. Treated as the root — every other source matched it. |
| [`erdostom/LoremGibsonSublime`](https://github.com/erdostom/LoremGibsonSublime) | Sublime Text plugin. Its embedded word array is identical to the canonical list (confirmed by diff) — independent re-implementation, no new terms. |
| [`entozoon/atom-lorem-gibson`](https://github.com/entozoon/atom-lorem-gibson) (MIT licensed) | Atom plugin. Same canonical list plus ~10 extra general terms (`galaxy`, `warp`, `screen`, `watch`, `gauntlet`, `jacket`, `stellar`, `system`, `claymore`, `electro-`) and a ~65-term glossary of proper nouns/jargon lifted from *Neuromancer* itself (`Chatsubo`, `Freeside`, `Tessier-Ashpool`, `ICE`, `Ono-Sendai`, `Villa Straylight`, etc). |

## Merge notes

- `packages/dictionary/data/general.json` — 170 terms: the canonical 160
  plus the Atom plugin's general-vocabulary extras, deduped
  case-insensitively.
- `packages/dictionary/data/proper-nouns.json` — 62 terms: the Atom
  glossary tail, deduped against the general list, with two entries that
  the source's comma-splitting had mangled repaired by hand
  (`Cornell, Joseph (1902-1973)` and `black ice` were each split across
  two array entries in the original).
- Kept as two tiers (general vs. proper-noun) rather than one flat list
  because the proper nouns are much higher-signal — dropping "Freeside"
  or "Tessier-Ashpool" into every other sentence reads as a name-drop
  parade rather than ambient filler text. `@lorem-gibson/generator`
  defaults to a 12% chance per word; both consuming packages let you
  tune or disable that tier.

## Licensing

The word list itself is short phrases and common/fictional nouns, not
subject to much in the way of copyrightable structure beyond the
proper-noun tier (fictional terms coined by William Gibson, used here
descriptively/transformatively — the same way every "Lorem Gibson" clone
listed above already does, several with no license restriction stated at
all). `atom-lorem-gibson`, the source of the proper-noun tier, is
MIT-licensed; this repo is MIT-licensed to match.
