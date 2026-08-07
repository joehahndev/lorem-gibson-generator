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
 *   images: false|{ style: string, minDimension: number, maxDimension: number },
 * }} payload
 */
export function browserSanitize(payload) {
  var words = payload.words;
  var exclude = payload.exclude.concat(['script', 'style', 'noscript', 'template', 'svg']);
  var include = payload.include;
  var attributes = payload.attributes;
  var preserveNumbers = payload.preserveNumbers;
  var maskEmailsAndUrls = payload.maskEmailsAndUrls;
  var images = payload.images;

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

  // ---- CRT dead-channel image replacement ----
  // "The sky above the port was the color of television, tuned to a
  // dead channel." Draws directly into a <canvas>, screen content only
  // — no bezel/frame chrome — then swaps it in as the <img> src via a
  // data URL. Self-contained (no external image assets) so it works
  // offline and inside the sandboxed page context.
  var CRT_STYLES = ['snow', 'scanlines', 'scrambled', 'phosphor'];

  function drawSnow(ctx, w, h, rng) {
    // Classic black & white salt-and-pepper static.
    var imageData = ctx.createImageData(w, h);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      var v = Math.floor(rng() * 256);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function drawScanlines(ctx, w, h, rng) {
    // Idle CRT glow: no signal, tube still lit — dim gradient plus a
    // faint sprinkle of noise and even horizontal scanlines.
    var grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, '#202a3d');
    grad.addColorStop(1, '#05070c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (var y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (var i = 0; i < (w * h) / 40; i++) {
      ctx.fillRect(rng() * w, rng() * h, 1, 1);
    }
  }

  function drawScrambled(ctx, w, h, rng) {
    // Tracking-error scramble: dark base, shifted/jittered horizontal
    // bands, a couple of bright glitch lines.
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);
    var bandCount = 6 + Math.floor(rng() * 8);
    for (var b = 0; b < bandCount; b++) {
      var by = rng() * h;
      var bh = 2 + rng() * (h / 12);
      var xShift = (rng() - 0.5) * w * 0.2;
      ctx.fillStyle =
        'rgba(' +
        Math.floor(rng() * 90) +
        ', ' +
        Math.floor(rng() * 90) +
        ', ' +
        Math.floor(80 + rng() * 120) +
        ', ' +
        (0.4 + rng() * 0.4) +
        ')';
      ctx.fillRect(xShift, by, w, bh);
    }
    for (var g = 0; g < 3; g++) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.15 + rng() * 0.25) + ')';
      ctx.fillRect(0, rng() * h, w, 1);
    }
  }

  function drawPhosphor(ctx, w, h, rng) {
    // Monochrome green phosphor noise with faint burn-in ghosting.
    var imageData = ctx.createImageData(w, h);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      var v = Math.floor(rng() * 55);
      data[i] = 0;
      data[i + 1] = v + 15;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    for (var g = 0; g < 3; g++) {
      ctx.fillStyle = 'rgba(60, 255, 120, 0.05)';
      ctx.fillRect(rng() * w * 0.6, rng() * h * 0.6, w * (0.2 + rng() * 0.3), h * (0.2 + rng() * 0.3));
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (var y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  }

  var DRAW_BY_STYLE = { snow: drawSnow, scanlines: drawScanlines, scrambled: drawScrambled, phosphor: drawPhosphor };

  function crtDataUrl(style, width, height, rng) {
    var w = Math.max(1, Math.min(Math.round(width) || images.minDimension, images.maxDimension));
    var h = Math.max(1, Math.min(Math.round(height) || images.minDimension, images.maxDimension));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    var chosenStyle = style === 'random' ? CRT_STYLES[Math.floor(rng() * CRT_STYLES.length)] : style;
    (DRAW_BY_STYLE[chosenStyle] || drawSnow)(ctx, w, h, rng);
    return canvas.toDataURL('image/png');
  }

  function sanitizeImages(root) {
    var imgs = root.querySelectorAll ? root.querySelectorAll('img') : [];
    if (root.tagName === 'IMG') imgs = [root].concat(Array.prototype.slice.call(imgs));
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (isExcluded(img) || !isIncluded(img)) continue;
      var rect = img.getBoundingClientRect();
      var width = rect.width || img.naturalWidth || img.width;
      var height = rect.height || img.naturalHeight || img.height;
      if (width < images.minDimension || height < images.minDimension) continue; // likely an icon/logo, leave it
      // Lock in the rendered box before swapping src, so an image sized
      // by its own intrinsic dimensions (no explicit CSS width/height)
      // doesn't reflow once the replacement's natural size differs.
      if (!img.style.width) img.style.width = rect.width + 'px';
      if (!img.style.height) img.style.height = rect.height + 'px';
      var rng = mulberry32(hashSeed(baseSeed + '|image-' + nodeCounter++));
      img.src = crtDataUrl(images.style, width, height, rng);
      img.removeAttribute('srcset');
    }
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

    if (images) sanitizeImages(root);
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
