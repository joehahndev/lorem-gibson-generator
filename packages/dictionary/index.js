import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Common vocabulary — safe to drop anywhere in a sentence. 170 terms. */
export const general = require('./data/general.json');

/**
 * Proper nouns and glossary terms lifted from the Neuromancer/Sprawl
 * universe (character and place names, tech jargon). Higher-signal, so
 * use these sparingly — e.g. capped at one per sentence — or they read
 * as a name-drop parade instead of ambient filler text. 62 terms.
 */
export const properNouns = require('./data/proper-nouns.json');

/** Everything in one flat array, general vocabulary first. 232 terms. */
export const all = [...general, ...properNouns];
