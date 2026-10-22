// The Decks page: the starter decks from starter-decks.js, and a deck
// builder. Decks are read and saved in this browser only: deck files are
// downloaded to the visitor's own computer, share links carry the deck in
// the address, and the deck being built is kept in localStorage.
(function () {
  var D = window.RC_DECK;
  var starters = window.RC_STARTER_DECKS || [];
  var picker = document.getElementById('deckPicker');
  if (!picker || !D) return;

  var cards = (window.RC_CARDS || []).slice().sort(function (a, b) { return a.number - b.number; });
  var view = document.getElementById('deck');
  var groups = document.getElementById('deckGroups');
  var message = document.getElementById('deckMessage');
  var fileInput = document.getElementById('deckFile');
  var shown = null;   // the starter deck on show: { deck, entries }

  function $(id) { return document.getElementById(id); }
  function pad(n) { return ('000' + n).slice(-4); }
  function costOrder(c) { return c.cost === 'X' ? 99 : Number(c.cost) || 0; }

  // Creatures first, then by cost, then by number.
  function byPlay(a, b) {
    return (a.card.kind === 'Entity' ? 0 : 1) - (b.card.kind === 'Entity' ? 0 : 1) ||
      costOrder(a.card) - costOrder(b.card) || a.card.number - b.card.number;
  }

  function track(path, title) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: path, title: title || path, event: true });
      }
    } catch (e) { /* counting must never break the page */ }
  }

  function say(text, isError) {
    message.textContent = text || '';
    message.hidden = !text;
    message.classList.toggle('deck-message-error', !!isError);
  }

  function flash(btn, text) {
    var was = btn.textContent;
    btn.textContent = text;
    setTimeout(function () { btn.textContent = was; }, 1500);
  }

  // ---- Actions shared by the deck view and the builder ----
  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function saveFile(deck) {
    download(D.fileName(deck), D.toFile(deck), 'application/json');
    track('deck-download/' + D.slug(deck.name), 'Downloaded deck ' + deck.name);
  }

  function copy(btn, text, fallbackName) {
    var done = function () { flash(btn, 'Copied'); };
    var fallback = function () { download(fallbackName, text, 'text/plain'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function printCards(btn, deck, entries) {
    var list = [];
    entries.forEach(function (e) { for (var i = 0; i < e.qty; i++) list.push(e.card); });
    if (!list.length) return;
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    window.RC_PRINT.cards(list).then(function () {
      btn.disabled = false;
      btn.textContent = label;
      track('deck-print/' + D.slug(deck.name), 'Printed deck ' + deck.name);
    });
  }

  function printList(deck, entries) {
    var page = document.createElement('div');
    page.className = 'print-decklist';
    var h = document.createElement('h1');
    h.textContent = deck.name || 'Untitled deck';
    var sub = document.createElement('p');
    sub.textContent = [deck.faction, deck.set, D.total(entries) + ' cards'].filter(Boolean).join(' · ');
    page.appendChild(h);
    page.appendChild(sub);
    var table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Qty</th><th>#</th><th>Card</th><th>Cost</th><th>Kind</th><th>Rarity</th></tr></thead><tbody></tbody>';
    entries.slice().sort(byPlay).forEach(function (e) {
      var tr = document.createElement('tr');
      [e.qty, pad(e.card.number), e.card.name, e.card.cost, e.card.kind, e.card.rarity].forEach(function (v) {
        var td = document.createElement('td');
        td.textContent = v === undefined ? '' : v;
        tr.appendChild(td);
      });
      table.tBodies[0].appendChild(tr);
    });
    page.appendChild(table);
    window.RC_PRINT.page(page);
  }

  // ---- Starter deck picker and view ----
  var buttons = starters.map(function (deck) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'deck-pick deck-pick-' + D.slug(deck.faction || 'essence');
    b.innerHTML = '<span class="deck-pick-faction"></span><span class="deck-pick-name"></span>';
    b.querySelector('.deck-pick-faction').textContent = deck.faction || '';
    b.querySelector('.deck-pick-name').textContent = deck.name;
    b.addEventListener('click', function () {
      history.replaceState(null, '', '#' + deck.id);
      show(deck);
      view.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    picker.appendChild(b);
    return { deck: deck, el: b };
  });

  function show(deck) {
    var r = D.resolve(deck);
    shown = { deck: deck, entries: r.entries };
    buttons.forEach(function (b) { b.el.classList.toggle('active', b.deck === deck); });

    $('deckKicker').textContent = [deck.starter, deck.faction, deck.set].filter(Boolean).join(' · ');
    $('deckName').textContent = deck.name || 'Untitled deck';
    $('deckDesc').textContent = deck.description || '';
    $('deckDesc').hidden = !deck.description;

    var entities = r.entries.filter(function (e) { return e.card.kind === 'Entity'; });
    var spells = r.entries.filter(function (e) { return e.card.kind !== 'Entity'; });
    $('deckStats').textContent =
      D.total(r.entries) + ' cards · ' + D.total(entities) + ' creatures · ' + D.total(spells) + ' spells';

    groups.innerHTML = '';
    [['Creatures', entities], ['Spells', spells]].forEach(function (g) {
      if (!g[1].length) return;
      var h = document.createElement('h3');
      h.className = 'deck-group-title';
      h.textContent = g[0] + ' (' + D.total(g[1]) + ')';
      var grid = document.createElement('div');
      grid.className = 'library-grid deck-grid';
      g[1].slice().sort(byPlay).forEach(function (e) { grid.appendChild(tile(e)); });
      groups.appendChild(h);
      groups.appendChild(grid);
    });
    view.hidden = false;
  }

  function tile(entry) {
    var card = entry.card;
    var el = document.createElement('article');
    el.className = 'library-card deck-card';
    var img = document.createElement('img');
    img.alt = card.name;
    img.width = 750;
    img.height = 1050;
    img.setAttribute('data-lightbox', '');
    img.setAttribute('data-lightbox-caption', card.name);
    img.setAttribute('data-lightbox-note', entry.qty + ' × · Card #' + pad(card.number));
    window.RC_RENDER.lazy(img, card);
    var qty = document.createElement('span');
    qty.className = 'deck-qty';
    qty.textContent = '×' + entry.qty;
    var info = document.createElement('div');
    info.className = 'library-card-info';
    info.innerHTML = '<div class="library-card-name"></div><div class="library-card-meta"></div>';
    info.firstChild.textContent = card.name;
    info.lastChild.textContent = ['Cost ' + card.cost, card.rarity].join(' · ');
    el.appendChild(img);
    el.appendChild(qty);
    el.appendChild(info);
    return el;
  }

  function shownDeck() { return D.build(shown.deck, shown.entries); }

  $('deckEdit').addEventListener('click', function () {
    var deck = shownDeck();
    deck.name = deck.name + ' (copy)';
    openInBuilder(deck);
  });
  $('deckDownload').addEventListener('click', function () { saveFile(shownDeck()); });
  $('deckPrint').addEventListener('click', function () { printCards(this, shown.deck, shown.entries); });
  $('deckPrintList').addEventListener('click', function () { printList(shown.deck, shown.entries); });
  $('deckCopy').addEventListener('click', function () {
    copy(this, D.toText(shownDeck()), D.slug(shown.deck.name) + '.txt');
  });

  // ---- Builder ----
  var STORE = 'rc-deck-draft-v1';
  var builder = $('builder');
  var nameInput = $('builderName');
  var descInput = $('builderDesc');
  var listEl = $('builderList');
  var draft = { name: '', description: '', entries: [] };

  function store() {
    try { localStorage.setItem(STORE, JSON.stringify(draftDeck())); } catch (e) { /* private mode */ }
  }

  function draftDeck() {
    var factions = [];
    draft.entries.forEach(function (e) {
      if (e.card.faction && e.card.faction !== 'Essence' && factions.indexOf(e.card.faction) === -1) factions.push(e.card.faction);
    });
    return D.build({
      name: draft.name.trim() || 'Untitled deck',
      faction: factions.join(' / '),
      description: draft.description.trim()
    }, draft.entries.slice().sort(byPlay));
  }

  // Load a deck into the builder. Returns the lines that matched no card.
  function load(deck) {
    var r = D.resolve(deck);
    draft = { name: deck.name || '', description: deck.description || '', entries: r.entries };
    nameInput.value = draft.name;
    descInput.value = draft.description;
    refresh();
    return r.missing;
  }

  function openInBuilder(deck, quiet) {
    var missing = load(deck);
    builder.hidden = false;
    var notes = [];
    if (deck.note) notes.push(deck.note);
    if (missing.length) {
      notes.push('Not found in the current set, so left out: ' +
        missing.map(function (m) { return m.qty + ' ' + (m.name || '#' + m.number); }).join(', ') + '.');
    }
    say(notes.join(' '), missing.length > 0);
    if (!quiet) builder.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hasCards() { return draft.entries.length > 0; }

  // Opening something new over a deck in progress asks first.
  function okToReplace() {
    return !hasCards() || window.confirm('Replace the deck in the builder? Download it first if you want to keep it.');
  }

  function setQty(card, n) {
    var entry = draft.entries.filter(function (e) { return e.card === card; })[0];
    n = Math.max(0, Math.min(99, n));
    if (entry && !n) draft.entries.splice(draft.entries.indexOf(entry), 1);
    else if (entry) entry.qty = n;
    else if (n) draft.entries.push({ qty: n, card: card });
    refresh();
  }

  function qtyOf(card) {
    var entry = draft.entries.filter(function (e) { return e.card === card; })[0];
    return entry ? entry.qty : 0;
  }

  function stepper(card, n) {
    var box = document.createElement('div');
    box.className = 'library-qty';
    box.innerHTML = '<button type="button" data-step="-1">&minus;</button>' +
      '<span class="library-qty-value"></span><button type="button" data-step="1">+</button>';
    box.querySelector('.library-qty-value').textContent = n;
    box.querySelector('[data-step="-1"]').disabled = !n;
    box.querySelector('[data-step="-1"]').setAttribute('aria-label', 'Remove a copy of ' + card.name);
    box.querySelector('[data-step="1"]').setAttribute('aria-label', 'Add a copy of ' + card.name);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) setQty(card, qtyOf(card) + Number(b.getAttribute('data-step')));
    });
    return box;
  }

  function refresh() {
    var entries = draft.entries.slice().sort(byPlay);
    var entities = entries.filter(function (e) { return e.card.kind === 'Entity'; });
    var spells = entries.filter(function (e) { return e.card.kind !== 'Entity'; });
    var n = D.total(entries);
    $('builderStats').textContent = n
      ? n + ' cards · ' + D.total(entities) + ' creatures · ' + D.total(spells) + ' spells'
      : 'No cards yet. Add some from the cards below.';

    var checks = $('builderChecks');
    checks.innerHTML = '';
    if (n) {
      var problems = D.check(entries);
      (problems.length ? problems : ['Ready to play: this deck meets the deck-building rules.']).forEach(function (p) {
        var li = document.createElement('li');
        li.textContent = p;
        checks.appendChild(li);
      });
      checks.classList.toggle('builder-checks-ok', !problems.length);
    }

    listEl.innerHTML = '';
    [['Creatures', entities], ['Spells', spells]].forEach(function (g) {
      if (!g[1].length) return;
      var h = document.createElement('h3');
      h.className = 'deck-group-title';
      h.textContent = g[0] + ' (' + D.total(g[1]) + ')';
      var ul = document.createElement('ul');
      ul.className = 'builder-rows';
      g[1].forEach(function (e) {
        var li = document.createElement('li');
        li.className = 'builder-row' + (e.qty > D.limit(e.card) ? ' builder-row-over' : '');
        var name = document.createElement('span');
        name.className = 'builder-row-name';
        name.textContent = e.card.name;
        var meta = document.createElement('span');
        meta.className = 'builder-row-meta';
        meta.textContent = 'Cost ' + e.card.cost + ' · ' + (e.card.rarity || '').charAt(0);
        meta.title = e.card.rarity || '';
        li.appendChild(stepper(e.card, e.qty));
        li.appendChild(name);
        li.appendChild(meta);
        ul.appendChild(li);
      });
      listEl.appendChild(h);
      listEl.appendChild(ul);
    });

    var empty = !n;
    ['builderDownload', 'builderLink', 'builderCopy', 'builderPrint', 'builderPrintList', 'builderClear'].forEach(function (id) {
      $(id).disabled = empty;
    });
    tiles.forEach(function (t) {
      var q = qtyOf(t.card);
      t.value.textContent = q;
      t.minus.disabled = !q;
      t.el.classList.toggle('on-sheet', q > 0);
    });
    store();
  }

  nameInput.addEventListener('input', function () { draft.name = nameInput.value; store(); });
  descInput.addEventListener('input', function () { draft.description = descInput.value; store(); });

  $('builderDownload').addEventListener('click', function () { saveFile(draftDeck()); });
  $('builderCopy').addEventListener('click', function () {
    var deck = draftDeck();
    copy(this, D.toText(deck), D.slug(deck.name) + '.txt');
  });
  $('builderLink').addEventListener('click', function () {
    var deck = draftDeck();
    var url = location.origin + location.pathname + '#' + D.toLink(deck);
    copy(this, url, D.slug(deck.name) + '-link.txt');
    track('deck-link/' + D.slug(deck.name), 'Shared deck link ' + deck.name);
  });
  $('builderPrint').addEventListener('click', function () {
    var deck = draftDeck();
    printCards(this, deck, draft.entries.slice().sort(byPlay));
  });
  $('builderPrintList').addEventListener('click', function () { printList(draftDeck(), draft.entries); });
  $('builderClear').addEventListener('click', function () {
    if (!window.confirm('Clear every card from this deck?')) return;
    draft.entries = [];
    refresh();
  });
  $('builderPasteGo').addEventListener('click', function () {
    var deck;
    try { deck = D.parse($('builderPaste').value); } catch (err) { say(err.message, true); return; }
    if (!okToReplace()) return;
    $('builderPaste').value = '';
    openInBuilder(deck);
  });
  $('deckNew').addEventListener('click', function () {
    if (!okToReplace()) return;
    openInBuilder({ name: '', cards: [] });
    nameInput.focus();
  });

  // ---- Card browser (the Library's search, without the downloads) ----
  var browseGrid = $('builderGrid');
  var tiles = cards.map(function (card) {
    var el = document.createElement('article');
    el.className = 'library-card builder-card';
    var img = document.createElement('img');
    img.alt = card.name;
    img.width = 750;
    img.height = 1050;
    img.setAttribute('data-lightbox', '');
    img.setAttribute('data-lightbox-caption', card.name);
    img.setAttribute('data-lightbox-note', 'Card #' + pad(card.number));
    var actions = document.createElement('div');
    actions.className = 'library-card-actions';
    var label = document.createElement('span');
    label.className = 'library-card-meta';
    label.textContent = card.name;
    var box = stepper(card, 0);
    actions.appendChild(label);
    actions.appendChild(box);
    el.appendChild(img);
    el.appendChild(actions);
    browseGrid.appendChild(el);
    return {
      card: card, el: el, img: img, drawn: false,
      value: box.querySelector('.library-qty-value'),
      minus: box.querySelector('[data-step="-1"]'),
      name: D.simplify(card.name),
      haystack: ' ' + D.simplify([card.name, card.type, card.text].join(' ')) + ' '
    };
  });

  var search = $('builderSearch');
  var selects = Array.prototype.slice.call(document.querySelectorAll('#builderFilters select'));
  var costSelect = document.querySelector('#builderFilters [data-filter="cost"]');
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

  function filter() {
    var q = D.simplify(search.value);
    var qTight = q.replace(/ /g, '');
    var count = 0;
    tiles.forEach(function (t) {
      var hit = selects.every(function (sel) {
        return !sel.value || String(t.card[sel.getAttribute('data-filter')]) === sel.value;
      }) && (!q || t.haystack.indexOf(' ' + q) !== -1 || t.name.replace(/ /g, '').indexOf(qTight) !== -1);
      t.el.hidden = !hit;
      if (hit) {
        count++;
        // Cards are drawn only once the builder is open and they show.
        if (!t.drawn && !builder.hidden) { t.drawn = true; window.RC_RENDER.lazy(t.img, t.card); }
      }
    });
    $('builderCount').textContent = count + ' of ' + cards.length + ' cards';
  }
  search.addEventListener('input', filter);
  selects.forEach(function (s) { s.addEventListener('change', filter); });

  // Draw the browser's cards the first time the builder opens.
  new MutationObserver(function () { if (!builder.hidden) filter(); })
    .observe(builder, { attributes: true, attributeFilter: ['hidden'] });

  // ---- Opening a deck file ----
  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > 512 * 1024) { say('That file is too large to be a deck file.', true); return; }
    file.text().then(function (text) {
      var deck = D.parse(text);
      if (!okToReplace()) return;
      openInBuilder(deck);
      track('deck-open', 'Opened a deck file');
    }).catch(function (err) {
      say(err.message || 'That file could not be read.', true);
    });
  });

  // ---- Start ----
  // decks.html#dark-into-the-ink shows a starter deck; a share link opens
  // its deck in the builder; otherwise any saved draft comes back.
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE)); } catch (e) { saved = null; }
  var start = starters.filter(function (d) { return d.id === location.hash.slice(1); })[0];

  if (saved && saved.cards) load(saved);
  if (saved && saved.cards && saved.cards.length) builder.hidden = false;
  if (!openLink() && start) show(start);

  // A share link opened while the page is already showing.
  window.addEventListener('hashchange', openLink);

  function openLink() {
    var linked = D.fromLink(location.hash);
    if (!linked) return false;
    var same = hasCards() && D.toLink(draftDeck()) === D.toLink(D.build(linked, D.resolve(linked).entries.sort(byPlay)));
    if (same || okToReplace()) openInBuilder(linked);
    history.replaceState(null, '', location.pathname);
    return true;
  }
  refresh();
  filter();
})();
