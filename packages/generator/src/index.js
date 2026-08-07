import { general, properNouns } from '@lorem-gibson/dictionary';
import { toRng } from './rng.js';
import { joinWords, sentenceCase } from './join.js';

const DEFAULTS = {
  properNounChance: 0.12,
  minWords: 7,
  maxWords: 16,
  minSentences: 3,
  maxSentences: 8,
};

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Creates an independent generator instance with its own RNG. Pass a
 * `seed` (string or number) for reproducible output — the same seed
 * always produces the same sequence of words/sentences/paragraphs.
 *
 * @param {{ seed?: string|number, properNounChance?: number }} [options]
 */
export function createGenerator(options = {}) {
  let rng = toRng(options.seed);
  const properNounChance = options.properNounChance ?? DEFAULTS.properNounChance;

  function word() {
    return rng() < properNounChance ? pick(rng, properNouns) : pick(rng, general);
  }

  function words(count) {
    return Array.from({ length: count }, word);
  }

  function sentence(opts = {}) {
    const min = opts.minWords ?? DEFAULTS.minWords;
    const max = opts.maxWords ?? DEFAULTS.maxWords;
    const length = randInt(rng, min, max);
    return sentenceCase(joinWords(words(length)));
  }

  function sentences(count, opts = {}) {
    return Array.from({ length: count }, () => sentence(opts));
  }

  function paragraph(opts = {}) {
    const min = opts.minSentences ?? DEFAULTS.minSentences;
    const max = opts.maxSentences ?? DEFAULTS.maxSentences;
    const count = randInt(rng, min, max);
    return sentences(count, opts).join(' ');
  }

  function paragraphs(count, opts = {}) {
    return Array.from({ length: count }, () => paragraph(opts));
  }

  /** Title Case, no terminal punctuation, no dangling affix hyphens — for headings/UI mocks. */
  function title(wordCount = 3) {
    return words(wordCount)
      .map((w) => w.replace(/^-|-$/g, ''))
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /** kebab-case, ASCII-safe — for URLs, filenames, IDs. */
  function slug(wordCount = 3) {
    return words(wordCount).map(slugify).filter(Boolean).join('-');
  }

  function reset(seed) {
    rng = toRng(seed);
  }

  return { word, words, sentence, sentences, paragraph, paragraphs, title, slug, reset };
}

// Module-level default instance (unseeded — Math.random) for quick one-off use.
const defaultGenerator = createGenerator();

export const word = defaultGenerator.word;
export const words = defaultGenerator.words;
export const sentence = defaultGenerator.sentence;
export const sentences = defaultGenerator.sentences;
export const paragraph = defaultGenerator.paragraph;
export const paragraphs = defaultGenerator.paragraphs;
export const title = defaultGenerator.title;
export const slug = defaultGenerator.slug;

export { general, properNouns } from '@lorem-gibson/dictionary';
