/**
 * Runs INSIDE the page (via page.evaluate/addInitScript), not in Node.
 * Playwright serializes this function to source text and re-parses it in
 * the browser realm, so it must be fully self-contained: no imports, no
 * closures over anything outside its own body. Everything it needs
 * (the word list, config) arrives as the single `payload` argument.
 *
 * @param {{
 *   words: string[],
 *   seed: string|number|undefined,
 *   exclude: string[],
 *   include: string|undefined,
 *   attributes: string[],
 *   preserveNumbers: boolean,
 *   maskEmailsAndUrls: boolean,
 *   watch: boolean,
 * }} payload
 */
export function browserSanitize(payload) {
  var words = payload.words;
  var exclude = payload.exclude.concat(['script', 'style', 'noscript', 'template', 'svg']);
  var include = payload.include;
  var attributes = payload.attributes;
  var preserveNumbers = payload.preserveNumbers;
  var maskEmailsAndUrls = payload.maskEmailsAndUrls;

  // ---- deterministic RNG (mulberry32 + FNV-1a), same algorithm as
  // @lorem-gibson/generator's rng.js, duplicated here because this
  // function can't import anything once it's dropped into the page. ----
  function hashSeed(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var baseSeed = payload.seed === undefined ? String(Math.random()) : String(payload.seed);

  // words bucketed by length, so replacements roughly preserve token
  // width and layout doesn't reflow.
  var byLength = {};
  for (var w = 0; w < words.length; w++) {
    var len = words[w].length;
    (byLength[len] || (byLength[len] = [])).push(words[w]);
  }
  var lengths = Object.keys(byLength)
    .map(Number)
    .sort(function (a, b) {
      return a - b;
    });

  function pickWordNear(rng, targetLen) {
    var bucket = byLength[targetLen];
    if (!bucket) {
      var best = lengths[0];
      var bestDiff = Math.abs(best - targetLen);
      for (var i = 1; i < lengths.length; i++) {
        var diff = Math.abs(lengths[i] - targetLen);
        if (diff < bestDiff) {
          best = lengths[i];
          bestDiff = diff;
        }
      }
      bucket = byLength[best];
    }
    return bucket[Math.floor(rng() * bucket.length)];
  }

  function matchCase(sample, replacement) {
    if (/^[A-Z]+$/.test(sample)) return replacement.toUpperCase();
    if (/^[A-Z]/.test(sample)) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    return replacement.toLowerCase();
  }

  function digitsLike(sample, rng) {
    var out = '';
    for (var i = 0; i < sample.length; i++) {
      out += /[0-9]/.test(sample[i]) ? String(Math.floor(rng() * 10)) : sample[i];
    }
    return out;
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var URL_RE = /^https?:\/\/\S+$/i;

  // Replaces one whitespace-free token (word, punctuation-attached or
  // not) with placeholder text of about the same shape.
  function replaceToken(token, rng) {
    if (!token) return token;

    if (maskEmailsAndUrls && EMAIL_RE.test(token)) {
      return pickWordNear(rng, 6).toLowerCase() + '@example.test';
    }
    if (maskEmailsAndUrls && URL_RE.test(token)) {
      return 'https://example.test/' + pickWordNear(rng, 6).toLowerCase();
    }

    // Any digit anywhere in the token gets swapped in place ("$1,204.55"
    // -> "$8,617.29", "2026-07-14" -> "4193-58-27", "#48213" -> "#70945"),
    // regardless of surrounding/embedded punctuation. Handled before the
    // word-shaped path below because that path only understands
    // punctuation at the very start/end of a token — a decimal or
    // thousands-separator in the middle would otherwise make the whole
    // token fail to match and pass through untouched, which is exactly
    // the class of thing (money, dates, IDs) this tool exists to catch.
    if (preserveNumbers && /[0-9]/.test(token)) {
      return digitsLike(token, rng);
    }

    // Split off leading/trailing punctuation so ".", "),", "€" etc. survive.
    var m = token.match(/^([^A-Za-z0-9]*)([A-Za-z0-9][A-Za-z0-9'-]*)([^A-Za-z0-9]*)$/);
    if (!m) return token; // pure punctuation/symbol token — leave as-is

    var lead = m[1],
      core = m[2],
      trail = m[3];

    var replacement = pickWordNear(rng, core.length);
    // A multi-word dictionary entry ("beef noodles") inside a single
    // token position would look broken — collapse to its first word.
    replacement = replacement.split(' ')[0];
    return lead + matchCase(core, replacement) + trail;
  }

  function replaceText(text, seedSuffix) {
    var rng = mulberry32(hashSeed(baseSeed + '|' + seedSuffix));
    // Split on whitespace but keep the whitespace runs so multi-space /
    // newline formatting in <pre> etc. is preserved.
    var parts = text.split(/(\s+)/);
    for (var i = 0; i < parts.length; i++) {
      if (!/^\s*$/.test(parts[i])) parts[i] = replaceToken(parts[i], rng);
    }
    return parts.join('');
  }

  function isExcluded(el) {
    if (!el) return false;
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (exclude.indexOf(tag) !== -1) return true;
    for (var i = 0; i < exclude.length; i++) {
      if (exclude[i].indexOf(tag) === -1 && el.closest && el.closest(exclude[i])) return true;
    }
    return false;
  }

  function isIncluded(el) {
    if (!include) return true;
    return !!(el.closest && el.closest(include));
  }

  var nodeCounter = 0;

  function sanitizeRoot(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !/\S/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        var el = node.parentElement;
        if (isExcluded(el) || !isIncluded(el)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var textNodes = [];
    var current;
    while ((current = walker.nextNode())) textNodes.push(current);
    for (var i = 0; i < textNodes.length; i++) {
      textNodes[i].nodeValue = replaceText(textNodes[i].nodeValue, 'text-' + nodeCounter++);
    }

    var attrSelector = attributes.join(',');
    if (attrSelector) {
      var attrEls = root.querySelectorAll ? root.querySelectorAll('[' + attributes.join('],[') + ']') : [];
      for (var a = 0; a < attrEls.length; a++) {
        var el2 = attrEls[a];
        if (isExcluded(el2) || !isIncluded(el2)) continue;
        for (var b = 0; b < attributes.length; b++) {
          var attr = attributes[b];
          var val = el2.getAttribute(attr);
          if (val && val.trim()) el2.setAttribute(attr, replaceText(val, 'attr-' + attr + '-' + nodeCounter++));
        }
      }
    }

    // <input>/<textarea> values aren't reachable via TreeWalker or a plain
    // attribute selector (the live `value` isn't necessarily the `value`
    // attribute), so handle them explicitly.
    var fields = root.querySelectorAll ? root.querySelectorAll('input, textarea') : [];
    for (var f = 0; f < fields.length; f++) {
      var field = fields[f];
      if (isExcluded(field) || !isIncluded(field)) continue;
      var type = (field.getAttribute('type') || 'text').toLowerCase();
      if (['checkbox', 'radio', 'button', 'submit', 'hidden', 'file', 'password'].indexOf(type) !== -1) continue;
      if (field.value) field.value = replaceText(field.value, 'value-' + nodeCounter++);
    }
  }

  sanitizeRoot(document.body || document);

  if (payload.watch) {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeType === 1) sanitizeRoot(added[j]);
        }
      }
    });
    observer.observe(document.body || document, { childList: true, subtree: true });
    window.__loremGibsonSanitizerObserver = observer;
  }
}
