/**
 * The dictionary deliberately includes affix fragments ("post-", "-ware",
 * "cyber-") because that's how the original loremgibson.com word bank
 * reads — a real Gibson sentence is full of bolted-together neologisms.
 * Naively space-joining them leaves dangling hyphens ("cyber- space
 * bicycle -ware ."), so this collapses a word list into a clean sentence:
 * a trailing "-" glues to the next word with no space, a leading "-"
 * glues to the previous word, and a trailing "-" at the very end of the
 * sentence becomes the full stop instead of a hyphen-period.
 *
 * @param {string[]} words
 * @returns {string} space-joined (affixes collapsed), NOT capitalized or punctuated
 */
export function joinWords(words) {
  let out = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevEndsWithHyphen = out.endsWith('-');
    const wordStartsWithHyphen = word.startsWith('-');
    if (i > 0 && !prevEndsWithHyphen && !wordStartsWithHyphen) out += ' ';
    out += word;
  }
  return out;
}

/**
 * Capitalizes the first letter and appends terminal punctuation, folding
 * a trailing affix hyphen into the punctuation mark rather than stacking
 * "-.".
 * @param {string} text
 * @param {string} [punctuation]
 * @returns {string}
 */
export function sentenceCase(text, punctuation = '.') {
  let out = text.endsWith('-') ? text.slice(0, -1) + punctuation : text + punctuation;
  out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}
