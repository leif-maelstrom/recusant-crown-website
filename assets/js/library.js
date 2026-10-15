// The Library: every card from card-data.js, with search, downloads, and a
// print sheet that lays chosen cards out at true size (2.5 x 3.5 in), nine to
// a page, for home printing.
(function () {
  var cards = (window.RC_CARDS || []).slice().sort(function (a, b) {
    return a.number - b.number;
  });
  var grid = document.getElementById('libraryGrid');
  if (!grid) return;

  var search = document.getElementById('librarySearch');
  var count = document.getElementById('libraryCount');
  var empty = document.getElementById('libraryEmpty');
  var summary = document.getElementById('printSummary');
  var btnAll = document.getElementById('printAddAll');
  var btnClear = document.getElementById('printClear');
  var btnPrint = document.getElementById('printGo');

  var PER_PAGE = 9;
  var MAX_COPIES = 9;
  var STORE = 'rc-print-sheet-v2';   // v1 was keyed by card number

  // How many copies of each card are on the print sheet, keyed by image
  // path: always unique, unlike card numbers while the set is in flux.
  var sheet = {};
  try { sheet = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { sheet = {}; }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(sheet)); } catch (e) { /* private mode */ }
  }

  function pad(n) { return ('000' + n).slice(-4); }   // 4-digit, as printed on the card

  // Report an event to the site's visit counter (GoatCounter), if it has
  // loaded. Blocked or missing, it quietly does nothing.
  function track(path, title) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: path, title: title || path, event: true });
      }
    } catch (e) { /* counting must never break the page */ }
  }

  function cardKey(card) { return card.number + '-' + slug(card.name); }

  function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function extension(path) {
    var m = /\.[a-z0-9]+$/i.exec(path);
    return m ? m[0] : '.jpg';
  }

  // ---- Card grid ----
  var tiles = cards.map(function (card) {
    var tile = document.createElement('article');
    tile.className = 'library-card';

    var img = document.createElement('img');
    img.src = card.image;
    img.alt = card.name;
    img.loading = 'lazy';
    img.setAttribute('data-lightbox', '');
    img.setAttribute('data-lightbox-caption', card.name);
    img.setAttribute('data-lightbox-note', 'Card #' + pad(card.number));

    var info = document.createElement('div');
    info.className = 'library-card-info';
    info.innerHTML =
      '<div class="library-card-number">#' + pad(card.number) + '</div>' +
      '<div class="library-card-name"></div>' +
      '<div class="library-card-meta"></div>';
    info.querySelector('.library-card-name').textContent = card.name;
    info.querySelector('.library-card-meta').textContent =
      [card.faction, card.kind, card.rarity].filter(Boolean).join(' \u00b7 ');
    if (card.imagePending) {
      // The text has been revised since this image was rendered.
      var pending = document.createElement('div');
      pending.className = 'library-card-pending';
      pending.textContent = 'Updated text, new image coming';
      info.appendChild(pending);
      img.setAttribute('data-lightbox-note', 'Card #' + pad(card.number) + ' \u00b7 updated text, new image coming');
    }

    var actions = document.createElement('div');
    actions.className = 'library-card-actions';

    var dl = document.createElement('a');
    dl.className = 'library-download';
    dl.href = card.image;
    dl.download = 'recusant-crown-' + pad(card.number) + '-' + slug(card.name) + extension(card.image);
    dl.textContent = 'Download';
    dl.setAttribute('aria-label', 'Download ' + card.name);
    dl.addEventListener('click', function () {
      track('download/' + cardKey(card), 'Downloaded ' + card.name);
    });

    var qty = document.createElement('div');
    qty.className = 'library-qty';
    qty.innerHTML =
      '<span class="library-qty-label">Print</span>' +
      '<button type="button" data-step="-1">&minus;</button>' +
      '<span class="library-qty-value"></span>' +
      '<button type="button" data-step="1">+</button>';
    qty.querySelector('[data-step="-1"]').setAttribute('aria-label', 'Remove a copy of ' + card.name + ' from the print sheet');
    qty.querySelector('[data-step="1"]').setAttribute('aria-label', 'Add a copy of ' + card.name + ' to the print sheet');
    qty.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var n = (sheet[card.image] || 0) + Number(b.getAttribute('data-step'));
      setCopies(card.image, n);
    });

    actions.appendChild(dl);
    actions.appendChild(qty);
    tile.appendChild(img);
    tile.appendChild(info);
    tile.appendChild(actions);
    grid.appendChild(tile);
    return { card: card, el: tile, qty: qty };
  });

  // ---- Search and filters ----
  // Punctuation and spacing are ignored, so "snapcaster's wand" finds
  // "Snapcasters Wand". A bare number (1, 0001 or #0001) finds that card;
  // anything else searches names, type lines and rules text.
  function simplify(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  tiles.forEach(function (t) {
    var c = t.card;
    t.name = simplify(c.name);
    t.haystack = ' ' + simplify([c.name, c.type, c.text].join(' ')) + ' ';
  });

  var selects = Array.prototype.slice.call(document.querySelectorAll('#libraryFilters select'));
  var clearBtn = document.getElementById('libraryClear');

  // Cost choices come from the cards themselves: 0, 1, 2 ... then X.
  var costSelect = document.querySelector('[data-filter="cost"]');
  var costs = [];
  cards.forEach(function (c) { if (c.cost !== undefined && costs.indexOf(c.cost) === -1) costs.push(c.cost); });
  costs.sort(function (a, b) {
    if (a === 'X') return 1;
    if (b === 'X') return -1;
    return a - b;
  }).forEach(function (v) {
    var o = document.createElement('option');
    o.value = String(v);
    o.textContent = String(v);
    costSelect.appendChild(o);
  });

  function matchesFilters(c) {
    return selects.every(function (sel) {
      var v = sel.value, key = sel.getAttribute('data-filter');
      if (!v) return true;
      if (key === 'art') return !!c.art;
      return String(c[key]) === v;
    });
  }

  function filter() {
    var raw = search.value.trim().replace(/^#/, '');
    var q = simplify(raw);
    var qTight = q.replace(/ /g, '');
    var isNumber = /^\d+$/.test(raw);
    var active = !!q || selects.some(function (s) { return s.value; });
    var shown = 0;
    tiles.forEach(function (t) {
      var hit = matchesFilters(t.card) && (
        !q ||
        (isNumber ? Number(raw) === t.card.number
                  : t.haystack.indexOf(' ' + q) !== -1 ||
                    t.name.replace(/ /g, '').indexOf(qTight) !== -1));
      t.el.hidden = !hit;
      if (hit) shown++;
    });
    count.textContent = active
      ? shown + ' of ' + cards.length + ' cards'
      : cards.length + (cards.length === 1 ? ' card' : ' cards');
    empty.hidden = shown > 0;
    clearBtn.disabled = !active;
  }
  search.addEventListener('input', filter);
  selects.forEach(function (s) { s.addEventListener('change', filter); });
  clearBtn.addEventListener('click', function () {
    search.value = '';
    selects.forEach(function (s) { s.value = ''; });
    filter();
  });

  // ---- Print sheet ----
  function setCopies(key, n) {
    n = Math.max(0, Math.min(MAX_COPIES, n));
    if (n) sheet[key] = n; else delete sheet[key];
    save();
    updateSheet();
  }

  function sheetList() {
    var list = [];
    cards.forEach(function (card) {
      for (var i = 0; i < (sheet[card.image] || 0); i++) list.push(card);
    });
    return list;
  }

  function updateSheet() {
    tiles.forEach(function (t) {
      var n = sheet[t.card.image] || 0;
      t.qty.querySelector('.library-qty-value').textContent = n;
      t.qty.querySelector('[data-step="-1"]').disabled = !n;
      t.qty.querySelector('[data-step="1"]').disabled = n >= MAX_COPIES;
      t.el.classList.toggle('on-sheet', n > 0);
    });
    var total = sheetList().length;
    var pages = Math.ceil(total / PER_PAGE);
    summary.textContent = total
      ? total + (total === 1 ? ' card' : ' cards') + ' on the sheet, ' +
        pages + (pages === 1 ? ' page' : ' pages') + ' to print.'
      : 'No cards on the sheet yet. Use the + buttons on the cards above.';
    btnPrint.disabled = !total;
    btnClear.disabled = !total;
  }

  btnAll.addEventListener('click', function () {
    cards.forEach(function (card) {
      if (!sheet[card.image]) sheet[card.image] = 1;
    });
    save();
    updateSheet();
  });

  btnClear.addEventListener('click', function () {
    sheet = {};
    save();
    updateSheet();
  });

  // Build the printable pages, wait for every image, then open the print
  // dialog. The pages only show when printing (see .print-sheet in the CSS).
  btnPrint.addEventListener('click', function () {
    var list = sheetList();
    if (!list.length) return;
    var old = document.querySelector('.print-sheet');
    if (old) old.remove();

    var wrap = document.createElement('div');
    wrap.className = 'print-sheet';
    var waits = [];
    for (var i = 0; i < list.length; i += PER_PAGE) {
      var page = document.createElement('div');
      page.className = 'print-page';
      var cardGrid = document.createElement('div');
      cardGrid.className = 'print-grid';
      page.appendChild(cardGrid);
      list.slice(i, i + PER_PAGE).forEach(function (card) {
        var img = document.createElement('img');
        img.className = 'print-card';
        img.alt = card.name;
        waits.push(new Promise(function (done) {
          img.onload = img.onerror = done;
        }));
        img.src = card.image;
        var slot = document.createElement('div');
        slot.className = 'print-slot';
        slot.appendChild(img);
        cardGrid.appendChild(slot);
      });
      wrap.appendChild(page);
    }
    document.body.appendChild(wrap);

    btnPrint.disabled = true;
    btnPrint.textContent = 'Preparing…';
    Promise.all(waits).then(function () {
      btnPrint.disabled = false;
      btnPrint.textContent = 'Print Sheet';
      // One event per print sheet (titled with its size), plus one per
      // distinct card on it, so the dashboard shows which cards get printed.
      track('print-sheet', 'Print sheet: ' + list.length + (list.length === 1 ? ' card' : ' cards'));
      list.filter(function (c, i) { return list.indexOf(c) === i; }).forEach(function (c) {
        track('print/' + cardKey(c), 'Printed ' + c.name);
      });
      window.print();
    });
  });

  filter();
  updateSheet();
})();
