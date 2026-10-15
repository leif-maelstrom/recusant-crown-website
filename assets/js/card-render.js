// Draws Recusant Crown cards from card-data.js, so a card's picture always
// matches its current text. Each card is layered on a 750 x 1050 canvas
// (2.5 x 3.5 in at 300 dpi):
//
//   faction background   assets/card-bg/<faction>.jpg (Essence for a
//                        multicolor card, until those have their own)
//   panels and border    drawn here
//   art                  assets/card-art/<4-digit number>-<name>.jpg, named
//                        like the old card images (see card-data.js)
//   icons and text       drawn here: Cinzel Bold for the name and type line,
//                        Fira Sans for the rules text (loaded by the page)
//
// RC_RENDER.url(card) resolves to a JPEG blob URL of the finished card, made
// once per card and then reused. It rejects if anything fails to load, so
// callers can fall back to the card's old image.
(function () {
  var W = 750, H = 1050;
  var BG = { Dream: 'dream', Resolve: 'resolve', Dark: 'dark', Light: 'light', Essence: 'essence' };
  var HEAD = '700 {px}px Cinzel, Georgia, serif';
  var BODY = '{px}px "Fira Sans", "Segoe UI", sans-serif';
  var ITALIC = 'italic {px}px "Fira Sans", "Segoe UI", sans-serif';

  // ---- Icons ----
  // Clarity is a grey circle with four smaller circles orbiting it on the
  // corners of a square: Light top left (ivory), Insight bottom left (blue,
  // with an eye dot), Resolve top right (rust red, with an X), Ink bottom
  // right (black). Essence is the grey circle with those four corners bitten
  // out. A cost badge is the grey circle with the card's faction circle on
  // its corner, so the corner alone names the faction, even without colour.
  var COLOR = { Light: '#efe6cf', Dream: '#2a7fd4', Resolve: '#b4462b', Dark: '#151515', Essence: '#9c9c9c' };
  var BLOOM = { Light: '#e8c060', Dream: '#2a7fd4', Resolve: '#b4462b', Dark: '#8a4fd0', Essence: '#9c9c9c' };
  var CORNER = { Light: [-1, -1], Dream: [-1, 1], Resolve: [1, -1], Dark: [1, 1] };
  var R = 34, MOON = 16, OFF = R / Math.SQRT2;
  var LINE = 'stroke="#000" stroke-width="2"';

  function moon(f, cx, cy) {
    var s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + MOON + '" fill="' + COLOR[f] + '" ' + LINE + '/>';
    if (f === 'Dream') s += '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="#0b1e33"/>';
    if (f === 'Resolve') {
      var d = MOON * 0.75;   // the X runs to the circle's edge
      s += '<clipPath id="x"><circle cx="' + cx + '" cy="' + cy + '" r="' + (MOON - 1) + '"/></clipPath>' +
        '<path clip-path="url(#x)" d="M' + (cx - d) + ' ' + (cy - d) + 'l' + 2 * d + ' ' + 2 * d + 'm0 ' + (-2 * d) + 'l' + (-2 * d) + ' ' + 2 * d +
        '" stroke="#2a0d06" stroke-width="2.6"/>';
    }
    return s;
  }

  // Essence: the grey circle with its four corners bitten out. Sized to sit
  // inside the card's border, with the bites set wide to leave room for a
  // number in the middle.
  function essence() {
    var r = 36, k = r / R, holes = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(function (s) {
      return '<circle cx="' + (50 + s[0] * OFF * k * 1.12) + '" cy="' + (50 + s[1] * OFF * k * 1.12) + '" r="' + MOON * k * 0.92 + '" fill="#000"/>';
    }).join('');
    return '<mask id="e"><circle cx="50" cy="50" r="' + r + '" fill="#fff"/>' + holes + '</mask>' +
      '<rect width="100" height="100" fill="' + COLOR.Essence + '" mask="url(#e)"/>';
  }

  // A faction's own symbol, alone and full size: Light an ivory circle,
  // Insight blue with a dark pupil, Resolve rust with an X, Ink black. Used
  // as a creature's cost (the number sits in the middle, so the X stops
  // short of it) and inline in rules text.
  var PURE = 42;
  function pure(f) {
    var s = '<circle cx="50" cy="50" r="' + PURE + '" fill="' + COLOR[f] + '" stroke="#000" stroke-width="3"/>';
    if (f === 'Dream') s += '<circle cx="50" cy="50" r="22" fill="#0b1e33"/>';
    if (f === 'Resolve') {
      var a = 21 / Math.SQRT2, b = (PURE - 1) / Math.SQRT2;
      s += [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(function (d) {
        return '<path d="M' + (50 + d[0] * a) + ' ' + (50 + d[1] * a) + 'L' + (50 + d[0] * b) + ' ' + (50 + d[1] * b) +
          '" stroke="#2a0d06" stroke-width="7"/>';
      }).join('');
    }
    return s;
  }

  // Bounty: a plain grey circle, since a bounty pays Essence. A card whose
  // bounty pays a faction's Clarity (bountyFaction) shows that faction's own
  // symbol instead, and a crown (bounty null) pays Majesty.
  function bounty() { return '<circle cx="50" cy="50" r="40" fill="' + COLOR.Essence + '"/>'; }

  // A multicolor card's badge carries a circle for each faction it uses.
  function cost(fs) {
    if (fs.length === 1 && fs[0] === 'Essence') return essence();
    return '<circle cx="50" cy="50" r="' + R + '" fill="' + COLOR.Essence + '"/>' +
      fs.filter(function (f) { return CORNER[f]; }).map(function (f) {
        var c = CORNER[f];
        return moon(f, 50 + c[0] * OFF, 50 + c[1] * OFF);
      }).join('');
  }

  function costKind(card) {
    var type = card.type || '', entity = card.kind === 'Entity';
    if (/\bStance\b/.test(type) || /^Conjure\b/.test(type) && (!entity || /^Conjure (Legendary )?Fortification\b/.test(type))) return 'colored';
    if (entity || /\bOverdrive\b/.test(type)) return 'pure';
    return 'spell';
  }

  // A spell's cost: the grey circle (the printed Essence) with a small
  // Essence cross below it (the 1 Clarity of any faction).
  function spellCost() {
    var k = 0.45, cy = 50 + R * 0.95, r = 36 * k;
    var holes = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(function (d) {
      return '<circle cx="' + (50 + d[0] * OFF * k * 1.12 * 36 / R) + '" cy="' + (cy + d[1] * OFF * k * 1.12 * 36 / R) + '" r="' + MOON * k * 0.92 * 36 / R + '" fill="#000"/>';
    }).join('');
    // A thin gap is cut from the big circle around the cross, so the two
    // read apart without an outline.
    return '<mask id="g"><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="' + cy + '" r="' + (r + 3) + '" fill="#000"/></mask>' +
      '<circle cx="50" cy="50" r="' + R + '" fill="' + COLOR.Essence + '" mask="url(#g)"/>' +
      '<mask id="s"><circle cx="50" cy="' + cy + '" r="' + r + '" fill="#fff"/>' + holes + '</mask>' +
      '<rect width="100" height="100" fill="' + COLOR.Essence + '" mask="url(#s)"/>';
  }

  // The factions a card uses: its own, plus any others on a multicolor card.
  function factions(card) { return card.factions && card.factions.length ? card.factions : [card.faction]; }

  // Power: an eight-point starburst, taller than wide, diagonals shorter.
  function power() {
    var pts = [];
    for (var i = 0; i < 16; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 8;
      var r = i % 2 ? 20 : (i % 4 === 0 ? 48 : 31);
      pts.push((50 + Math.cos(a) * r * 0.8).toFixed(1) + ',' + (50 + Math.sin(a) * r).toFixed(1));
    }
    return '<polygon points="' + pts.join(' ') + '" fill="#fbfbf4"/>';
  }

  // Bloom: a four-point starburst whose points curl like a spiral.
  function bloom(f) {
    var d = '', TIP = 48, WAIST = 24, TWIST = 0.5;
    function pt(a, r) { return (50 + Math.cos(a) * r).toFixed(1) + ' ' + (50 + Math.sin(a) * r).toFixed(1); }
    for (var k = 0; k < 4; k++) {
      var a = -Math.PI / 2 + k * Math.PI / 2;
      d += (k ? 'L' : 'M') + pt(a - Math.PI / 4, WAIST) + 'Q' + pt(a - TWIST, TIP * 0.62) + ' ' + pt(a, TIP) +
        'Q' + pt(a + 0.12, TIP * 0.42) + ' ' + pt(a + Math.PI / 4, WAIST);
    }
    return '<path d="' + d + 'Z" fill="' + BLOOM[f] + '"/>';
  }

  // Majesty: the crown from the site's sigil (assets/art/sigil/sigil-crown.png),
  // with the jewel cutout raised so the base under it is sturdier.
  var CROWN = 'M94.5 37.6 L94.0 37.7 L73.7 53.6 L73.8 54.5 L73.8 54.6 L73.8 55.7 L73.9 55.8 L73.8 55.9 L73.8 56.9 L73.8 57.0 L73.8 57.5 L73.3 58.9 L72.8 60.0 L71.7 61.4 L70.7 62.3 L69.8 63.0 L68.7 63.5 L67.6 63.9 L66.8 63.9 L66.7 64.0 L65.7 64.0 L65.6 64.1 L65.3 64.1 L65.3 64.3 L64.8 65.1 L64.5 66.1 L64.0 66.9 L63.7 67.9 L63.2 68.7 L62.9 69.7 L61.2 73.1 L61.2 73.5 L63.8 73.3 L63.9 73.2 L64.7 73.2 L64.8 73.1 L65.6 73.1 L65.7 73.0 L66.6 73.0 L66.7 72.9 L67.5 72.9 L67.5 72.9 L68.4 72.9 L68.4 72.8 L69.3 72.8 L69.3 72.7 L70.2 72.7 L70.2 72.6 L71.1 72.6 L71.1 72.5 L72.0 72.5 L72.0 72.4 L72.9 72.4 L73.0 72.3 L73.8 72.3 L73.8 72.2 L74.7 72.2 L74.8 72.1 L75.6 72.1 L75.6 72.0 L76.5 72.0 L76.5 72.0 L77.4 72.0 L77.5 71.9 L78.3 71.9 L78.3 71.8 L79.2 71.8 L79.2 71.7 L80.1 71.7 L80.1 71.6 L80.7 71.6 L80.9 71.5 L81.7 69.7 L82.2 68.2 L82.5 67.7 L83.0 66.2 L83.3 65.8 L83.3 65.6 L83.6 65.0 L83.6 64.8 L83.8 64.5 L84.1 63.4 L84.4 63.0 L85.3 60.5 L85.5 60.1 L86.3 58.1 L86.5 57.6 L87.4 55.2 L87.7 54.8 L87.7 54.6 L87.9 54.3 L88.6 52.3 L88.9 51.9 L89.8 49.5 L90.0 49.0 L91.0 46.6 L91.2 46.1 L92.1 43.7 L92.4 43.2 L93.1 41.3 L93.4 40.8 L94.3 38.4 L94.5 37.9ZM47.4 22.9 L46.9 22.9 L29.2 58.6 L28.1 58.3 L27.9 58.3 L24.0 56.9 L23.7 56.9 L19.6 55.5 L19.3 55.5 L15.4 54.1 L15.2 54.1 L11.3 52.8 L11.0 52.8 L6.6 51.3 L6.3 51.3 L6.0 51.1 L5.6 51.1 L5.6 51.4 L15.2 64.7 L15.3 65.2 L23.8 77.2 L24.9 77.2 L25.0 77.1 L25.8 77.1 L25.9 77.0 L26.7 77.0 L26.8 76.9 L27.6 76.9 L27.7 76.8 L28.5 76.8 L28.6 76.7 L29.4 76.7 L29.5 76.6 L30.3 76.6 L30.4 76.5 L31.2 76.5 L31.3 76.5 L32.1 76.5 L32.2 76.4 L33.0 76.4 L33.1 76.3 L33.9 76.3 L34.0 76.2 L34.8 76.2 L34.9 76.1 L35.7 76.1 L35.8 76.0 L36.6 76.0 L36.7 75.9 L37.5 75.9 L37.6 75.8 L38.5 75.8 L38.6 75.7 L39.4 75.7 L39.5 75.7 L40.3 75.7 L40.4 75.6 L41.2 75.6 L41.3 75.5 L42.1 75.5 L42.2 75.4 L43.0 75.4 L43.1 75.3 L43.9 75.3 L44.0 75.2 L44.8 75.2 L44.9 75.1 L45.7 75.1 L45.8 75.0 L46.6 75.0 L46.7 74.9 L47.5 74.9 L47.6 74.8 L48.4 74.8 L48.5 74.8 L49.3 74.8 L49.4 74.7 L50.2 74.7 L50.3 74.6 L51.1 74.6 L51.2 74.5 L52.0 74.5 L52.1 74.4 L53.0 74.4 L53.1 74.3 L53.9 74.3 L54.0 74.2 L54.8 74.2 L54.9 74.1 L58.4 73.8 L58.6 73.8 L59.2 72.4 L59.6 71.6 L60.0 70.6 L60.4 69.8 L60.8 68.8 L61.2 68.0 L61.6 67.0 L63.0 64.1 L63.0 63.7 L62.9 63.6 L62.4 63.5 L61.3 63.0 L60.4 62.3 L59.4 61.4 L58.4 60.0 L57.8 58.9 L57.5 57.8 L57.4 57.0 L57.3 56.9 L57.3 55.9 L57.2 55.8 L57.3 55.7 L57.3 54.6 L57.4 54.5 L57.5 53.7 L57.8 52.6 L58.4 51.5 L59.0 50.6 L59.9 49.6 L60.8 48.9 L62.1 48.2 L62.1 47.8 L56.9 39.2 L56.8 38.8 L55.8 37.2 L55.6 36.8 L54.6 35.2 L54.4 34.8 L53.4 33.3 L52.3 31.3 L51.1 29.3 L50.9 28.9 L50.2 27.8 L50.0 27.3 L49.0 25.8 L48.8 25.3 L47.8 23.8Z';
  function majesty() { return '<path d="' + CROWN + '" fill="#d9b25a" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>'; }

  var iconCache = {};
  function icon(key, inner) {
    if (!iconCache[key]) {
      iconCache[key] = load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">' + inner + '</svg>'));
    }
    return iconCache[key];
  }

  // ---- Loading ----
  function load(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Could not load ' + src.slice(0, 80))); };
      img.src = src;
    });
  }

  var fontsReady = null;
  function fonts() {
    if (!fontsReady) {
      fontsReady = document.fonts && document.fonts.load
        ? Promise.all([
            document.fonts.load(HEAD.replace('{px}', 40)),
            document.fonts.load(BODY.replace('{px}', 40)),
            document.fonts.load(ITALIC.replace('{px}', 40))
          ]).catch(function () {})
        : Promise.resolve();
    }
    return fontsReady;
  }

  function slug(name) { return name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function pad(n) { return ('000' + n).slice(-4); }
  function artPath(card) { return 'assets/card-art/' + pad(card.number) + '-' + slug(card.name) + '.jpg'; }

  // ---- Drawing helpers ----
  function cover(ctx, img, x, y, w, h) {
    var s = Math.max(w / img.width, h / img.height);
    var sw = w / s, sh = h / s;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }

  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(235, 240, 245, 0.72)';
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  }

  function noArt(ctx, x, y, w, h) {
    ctx.fillStyle = '#1b1915';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#8a8175';
    ctx.font = HEAD.replace('{px}', 34);
    ctx.textAlign = 'center';
    ctx.fillText('Art to come', x + w / 2, y + h / 2 + 12);
  }

  // Text that must sit on one line: shrink until it fits.
  function line(ctx, text, font, size, x, y, maxW, align) {
    do { ctx.font = font.replace('{px}', size); } while (ctx.measureText(text).width > maxW && --size > 12);
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  // The art credit: one line if it fits at a readable size, else two.
  function credit(ctx, text, x, y, maxW) {
    ctx.textAlign = 'center';
    for (var size = 24; size >= 19; size--) {
      ctx.font = BODY.replace('{px}', size);
      if (ctx.measureText(text).width <= maxW) { ctx.fillText(text, x, y); return; }
    }
    ctx.font = BODY.replace('{px}', 20);
    var lines = wrap(ctx, text, maxW).slice(0, 2);
    lines.forEach(function (l, i) { ctx.fillText(l, x, y - 11 + i * 22, maxW); });
  }

  function wrap(ctx, text, maxW) {
    var lines = [], cur = '';
    text.split(/\s+/).forEach(function (word) {
      var next = cur ? cur + ' ' + word : word;
      if (cur && ctx.measureText(next).width > maxW) { lines.push(cur); cur = word; } else cur = next;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // ---- Symbols in rules text ----
  // {Light} {Insight} {Resolve} {Ink} (or {Dream}, {Dark}) and the emoji
  // ⚪ 🔵 🔴 ⚫ draw that faction's own symbol; {Essence} the grey circle
  // (Essence only); {Any} the Essence cross (any resource); {Essence Ink}
  // and the like the grey circle with that faction's circle orbiting it.
  var NAMES = { Light: 'Light', Insight: 'Dream', Dream: 'Dream', Resolve: 'Resolve', Ink: 'Dark', Dark: 'Dark' };
  var EMOJI = { '⚪': 'Light', '🔵': 'Dream', '🔴': 'Resolve', '⚫': 'Dark' };
  var TOKEN = /\{(Any|Essence|Light|Insight|Dream|Resolve|Ink|Dark)(?: (Light|Insight|Dream|Resolve|Ink|Dark))?\}|⚪|🔵|🔴|⚫/g;

  function tokenKey(m, a, b) {
    if (EMOJI[m]) return 'pure ' + EMOJI[m];
    if (a === 'Any') return b ? null : 'essence';
    if (a === 'Essence') return b ? 'orbit ' + NAMES[b] : 'circle';
    return b ? null : 'pure ' + NAMES[a];
  }
  function inlineKeys(text) {
    var keys = [];
    String(text || '').replace(TOKEN, function (m, a, b) {
      var k = tokenKey(m, a, b);
      if (k && keys.indexOf(k) === -1) keys.push(k);
      return m;
    });
    return keys;
  }
  function glyph(key) {
    var p = key.split(' ');
    return icon(key, p[0] === 'pure' ? pure(p[1]) : p[0] === 'orbit' ? cost([p[1]]) : p[0] === 'circle' ? bounty() : essence());
  }

  // Text becomes runs of plain text and symbols; each symbol is one
  // private-use character standing in for its key.
  var PUA = 0xE000;
  function encode(text, keys) {
    return String(text || '').replace(TOKEN, function (m, a, b) {
      var k = tokenKey(m, a, b);
      return k ? String.fromCharCode(PUA + keys.indexOf(k)) : m;
    });
  }
  function isGlyph(ch) { return ch.charCodeAt(0) >= PUA && ch.charCodeAt(0) < PUA + 64; }
  function pieces(str) { return str.split(/([-])/).filter(Boolean); }
  function glyphSize(ctx) { return parseFloat(/(\d+(\.\d+)?)px/.exec(ctx.font)[1]) * 1.15; }
  function measure(ctx, str) {
    var g = glyphSize(ctx);
    return pieces(str).reduce(function (w, p) { return w + (isGlyph(p) ? g : ctx.measureText(p).width); }, 0);
  }
  function wrapRich(ctx, text, maxW) {
    var lines = [], cur = '';
    text.split(/\s+/).forEach(function (word) {
      var next = cur ? cur + ' ' + word : word;
      if (cur && measure(ctx, next) > maxW) { lines.push(cur); cur = word; } else cur = next;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function drawRich(ctx, str, cx, y, keys, glyphs) {
    var g = glyphSize(ctx), x = cx - measure(ctx, str) / 2;
    ctx.textAlign = 'left';
    pieces(str).forEach(function (p) {
      if (isGlyph(p)) {
        // The Essence and orbit symbols have more room around them in their
        // boxes than a faction's own circle, so they're drawn larger to match.
        var key = keys[p.charCodeAt(0) - PUA], img = glyphs[key];
        var k = key === 'essence' ? 1.25 : /^orbit/.test(key) ? 1.1 : 1, d = g * k;
        if (img) ctx.drawImage(img, x + (g - d) / 2, y - g * 0.8 - (d - g) / 2, d, d);
        x += g;
      } else {
        ctx.fillText(p, x, y);
        x += ctx.measureText(p).width;
      }
    });
  }

  // Rules text, then any closing quotation as italic flavour text, centred in
  // the box and shrunk until both fit.
  function rulesText(ctx, text, x, y, w, h, glyphs) {
    var keys = inlineKeys(text);
    text = encode(text, keys);
    var m = /^(.*?)\s*("[^"]*")\s*$/.exec(text || '');
    var rules = m ? m[1] : (text || ''), flavor = m ? m[2] : '';
    for (var size = 40; size >= 14; size--) {
      var lh = size * 1.18, gap = rules && flavor ? size * 0.5 : 0;
      ctx.font = BODY.replace('{px}', size);
      var a = rules ? wrapRich(ctx, rules, w) : [];
      ctx.font = ITALIC.replace('{px}', size);
      var b = flavor ? wrapRich(ctx, flavor, w) : [];
      var total = (a.length + b.length) * lh + gap;
      if (total <= h || size === 14) break;
    }
    var top = y + (h - total) / 2 + lh * 0.8;
    ctx.font = BODY.replace('{px}', size);
    a.forEach(function (l, i) { drawRich(ctx, l, x + w / 2, top + i * lh, keys, glyphs || {}); });
    ctx.font = ITALIC.replace('{px}', size);
    b.forEach(function (l, i) { drawRich(ctx, l, x + w / 2, top + (a.length + i) * lh + gap, keys, glyphs || {}); });
  }

  // A number on an icon: plain black on light icons, white on dark ones.
  function number(ctx, v, cx, cy, size, dark) {
    ctx.font = HEAD.replace('{px}', size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = dark ? '#111' : '#fff';
    ctx.fillText(String(v), cx, cy + size * 0.04);
    ctx.textBaseline = 'alphabetic';
  }

  function rarity(ctx, r, cx, cy) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    if (r === 'Common') ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    else if (r === 'Uncommon') { ctx.moveTo(cx, cy - 13); ctx.lineTo(cx + 12, cy); ctx.lineTo(cx, cy + 13); ctx.lineTo(cx - 12, cy); }
    else {
      var pts = r === 'Legendary' ? 4 : 5, inner = r === 'Legendary' ? 4.5 : 6;
      for (var i = 0; i < pts * 2; i++) {
        var a = -Math.PI / 2 + i * Math.PI / pts, rr = i % 2 ? inner : 15;
        ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
    }
    ctx.closePath();
    ctx.fill();
  }

  // ---- The card ----
  function draw(card) {
    var entity = card.kind === 'Entity';
    var fs = factions(card), multi = fs.length > 1;
    // The cost symbol shows how the card is paid (Rules Bible, casting):
    //   pure Clarity (creatures, Overdrives): the faction's own symbol
    //   colored (Equipment, Fortifications, Battlegrounds, Stances): the grey
    //     circle with the faction's circle orbiting it, 1 Clarity + Essence
    //   spell (everything else): the grey circle with a small Essence cross
    //     below it, 1 Clarity of any faction + the printed Essence
    // Essence cards pay in Essence, so their pure and colored costs are the
    // plain grey circle. Multicolor cards show every faction's circle.
    var kind = costKind(card), full = kind === 'pure' && !multi && CORNER[card.faction];
    var badge = kind === 'spell' ? icon('cost-spell', spellCost()) :
      full ? glyph('pure ' + card.faction) :
      card.faction === 'Essence' && !multi ? icon('bounty', bounty()) : icon('cost-' + fs.join('-'), cost(fs));
    var icons = [badge];
    var inline = inlineKeys(card.text);
    if (entity) {
      icons.push(icon('bloom-' + card.faction, bloom(card.faction)), icon('power', power()),
        card.bounty == null ? icon('majesty', majesty()) :
          CORNER[card.bountyFaction] ? glyph('pure ' + card.bountyFaction) : icon('bounty', bounty()));
    }
    return Promise.all([
      load('assets/card-bg/' + BG[multi ? 'Essence' : card.faction] + '.jpg'),
      // artSrc: the editor's unsaved upload. A card without art yet
      // (art: false) gets a plain art window instead.
      card.artSrc || card.art !== false ? load(card.artSrc || artPath(card)) : null,
      Promise.all(icons),
      fonts(),
      Promise.all(inline.map(glyph))
    ]).then(function (got) {
      var bg = got[0], art = got[1], ic = got[2], glyphs = {};
      inline.forEach(function (k, i) { glyphs[k] = got[4][i]; });
      var canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d');

      cover(ctx, bg, 0, 0, W, H);
      panel(ctx, 116, 36, 595, 84);     // name bar
      panel(ctx, 44, 528, 667, 70);     // type line
      panel(ctx, 44, 596, 667, 404);    // text box
      if (art) cover(ctx, art, 46, 118, 663, 409);
      else noArt(ctx, 46, 118, 663, 409);
      ctx.lineWidth = 4; ctx.strokeStyle = '#000';
      ctx.strokeRect(46, 118, 663, 409);
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, W - 18, H - 18);   // outer border

      ctx.fillStyle = '#000';
      line(ctx, card.name, HEAD, 44, 413, 92, 572, 'center');
      line(ctx, card.type || '', HEAD, 38, 56, 577, 586, 'left');
      rarity(ctx, card.rarity, 680, 563);
      rulesText(ctx, card.text, 58, 604, 640, 306, glyphs);

      // Footer: set and number between the bloom and power icons, the
      // artist between power and bounty.
      line(ctx, (card.set || 'Alpha-r1') + '-#' + pad(card.number), BODY, 24, 217, 962, 186, 'center');
      credit(ctx, 'Art: ' + (card.artist || 'TBD'), 522, 962, 200);

      // Cost, kept clear of the border.
      ctx.drawImage(ic[0], 14, 14, 112, 112);
      number(ctx, card.cost, 70, kind === 'spell' ? 64 : 70, full ? 42 : kind === 'spell' ? 36 : 40, !full || card.faction === 'Light');
      if (entity) {
        ctx.drawImage(ic[1], 14, 920, 100, 100);
        number(ctx, card.bloom, 64, 970, 40, card.faction === 'Light' || card.faction === 'Essence');
        ctx.drawImage(ic[2], 320, 920, 100, 100);
        number(ctx, card.power, 370, 970, 40, true);
        ctx.drawImage(ic[3], 625, 920, 100, 100);
        if (card.bounty != null) number(ctx, card.bounty, 675, 970, 40, !CORNER[card.bountyFaction] || card.bountyFaction === 'Light');
      }
      return canvas;
    });
  }

  var urls = {};
  function url(card) {
    var key = card.number + '|' + card.name;
    if (!urls[key]) {
      urls[key] = draw(card).then(function (canvas) {
        return new Promise(function (resolve, reject) {
          canvas.toBlob(function (blob) {
            if (blob) resolve(URL.createObjectURL(blob)); else reject(new Error('Could not save ' + card.name));
          }, 'image/jpeg', 0.92);
        });
      });
      urls[key].catch(function () { delete urls[key]; });
    }
    return urls[key];
  }

  // Put a card's render into an <img>, falling back to its old image file.
  // Resolves to the render's URL, or null when it fell back.
  function show(img, card) {
    return url(card).then(function (u) { img.src = u; return u; },
      function () { img.src = card.image; return null; });
  }

  // Render each <img> only as it nears the screen, so a page of 176 cards
  // doesn't draw them all at once. Calls done(url or null) for each.
  var watch = null, pending = [];
  function lazy(img, card, done) {
    if (!('IntersectionObserver' in window)) { show(img, card).then(done); return; }
    if (!watch) {
      watch = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          watch.unobserve(e.target);
          var job = e.target.__rcJob;
          show(e.target, job.card).then(job.done);
        });
      }, { rootMargin: '600px' });
    }
    img.__rcJob = { card: card, done: done || function () {} };
    watch.observe(img);
  }

  window.RC_RENDER = { draw: draw, url: url, show: show, lazy: lazy, artPath: artPath };
})();
