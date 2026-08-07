/**
 * Small dependency-free seedable RNG (mulberry32) plus a string-to-seed
 * hash (FNV-1a). Deterministic output for a given seed — useful when you
 * want the "random" text to be stable across runs (e.g. visual-regression
 * screenshots that shouldn't diff just because the placeholder text moved).
 */

/** @param {string} str @returns {number} 32-bit unsigned int seed */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * @param {number} seed 32-bit unsigned int
 * @returns {() => number} generator yielding floats in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Normalizes a seed of any of the accepted shapes into a mulberry32 RNG.
 * No seed (or `undefined`) falls back to `Math.random` — non-deterministic,
 * which is what you want for one-off CLI/library calls.
 * @param {number|string|undefined} seed
 * @returns {() => number}
 */
export function toRng(seed) {
  if (seed === undefined) return Math.random;
  if (typeof seed === 'number') return mulberry32(seed >>> 0);
  return mulberry32(hashSeed(String(seed)));
}
