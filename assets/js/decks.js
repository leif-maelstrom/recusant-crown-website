// The Decks page: the starter decks from starter-decks.js, and any deck file
// a visitor opens, shown with real cards and ready to download or print.
// Nothing is uploaded: opening a file only reads it in this browser.
(function () {
  var D = window.RC_DECK;
  var starters = window.RC_STARTER_DECKS || [];
  var picker = document.getElementById('deckPicker');
  if (!picker || !D) return;

  var view = document.getElementById('deck');
  var groups = document.getElementById('deckGroups');
  var message = document.getElementById('deckMessage');
  var fileInput = document.getElementById('deckFile');
  var current = null;   // { deck, entries }

  function pad(n) { return ('000' + n).slice(-4); }

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

  // ---- Picker ----
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

  // ---- Showing a deck ----
  function costOrder(c) { return c.cost === 'X' ? 99 : Number(c.cost) || 0; }

  function show(deck) {
    var r = D.resolve(deck);
    current = { deck: deck, entries: r.entries };
    buttons.forEach(function (b) { b.el.classList.toggle('active', b.deck === deck); });

    document.getElementById('deckKicker').textContent =
      [deck.starter, deck.faction, deck.set].filter(Boolean).join(' · ');
    document.getElementById('deckName').textContent = deck.name || 'Untitled deck';
    var desc = document.getElementById('deckDesc');
    desc.textContent = deck.description || '';
    desc.hidden = !deck.description;

    var entities = r.entries.filter(function (e) { return e.card.kind === 'Entity'; });
    var spells = r.entries.filter(function (e) { return e.card.kind !== 'Entity'; });
    document.getElementById('deckStats').textContent =
      D.total(r.entries) + ' cards · ' + D.total(entities) + ' creatures · ' + D.total(spells) + ' spells';

    var notes = [];
    if (deck.note) notes.push(deck.note);
    if (r.missing.length) {
      notes.push('Not found in the current set, so left out: ' +
        r.missing.map(function (m) { return m.qty + ' ' + (m.name || '#' + m.number); }).join(', ') + '.');
    }
    say(notes.join(' '), r.missing.length > 0);

    groups.innerHTML = '';
    [['Creatures', entities], ['Spells', spells]].forEach(function (g) {
      if (!g[1].length) return;
      var h = document.createElement('h3');
      h.className = 'deck-group-title';
      h.textContent = g[0] + ' (' + D.total(g[1]) + ')';
      var grid = document.createElement('div');
      grid.className = 'library-grid deck-grid';
      g[1].slice().sort(function (a, b) {
        return costOrder(a.card) - costOrder(b.card) || a.card.number - b.card.number;
      }).forEach(function (e) { grid.appendChild(tile(e)); });
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

  // ---- Actions ----
  function saved() { return D.build(current.deck, current.entries); }

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

  document.getElementById('deckDownload').addEventListener('click', function () {
    var deck = saved();
    download(D.fileName(deck), D.toFile(deck), 'application/json');
    track('deck-download/' + D.slug(deck.name), 'Downloaded deck ' + deck.name);
  });

  var printBtn = document.getElementById('deckPrint');
  printBtn.addEventListener('click', function () {
    var list = [];
    current.entries.forEach(function (e) { for (var i = 0; i < e.qty; i++) list.push(e.card); });
    if (!list.length) return;
    printBtn.disabled = true;
    printBtn.textContent = 'Preparing…';
    window.RC_PRINT.cards(list).then(function () {
      printBtn.disabled = false;
      printBtn.textContent = 'Print Cards';
      track('deck-print/' + D.slug(current.deck.name), 'Printed deck ' + current.deck.name);
    });
  });

  document.getElementById('deckPrintList').addEventListener('click', function () {
    var deck = current.deck;
    var page = document.createElement('div');
    page.className = 'print-decklist';
    var h = document.createElement('h1');
    h.textContent = deck.name || 'Untitled deck';
    var sub = document.createElement('p');
    sub.textContent = [deck.faction, deck.set, D.total(current.entries) + ' cards'].filter(Boolean).join(' · ');
    page.appendChild(h);
    page.appendChild(sub);
    var table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Qty</th><th>#</th><th>Card</th><th>Cost</th><th>Kind</th><th>Rarity</th></tr></thead><tbody></tbody>';
    current.entries.slice().sort(function (a, b) {
      return (a.card.kind === 'Entity' ? 0 : 1) - (b.card.kind === 'Entity' ? 0 : 1) ||
        costOrder(a.card) - costOrder(b.card) || a.card.number - b.card.number;
    }).forEach(function (e) {
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
  });

  var copyBtn = document.getElementById('deckCopy');
  copyBtn.addEventListener('click', function () {
    var text = D.toText(saved());
    var done = function () {
      copyBtn.textContent = 'Copied';
      setTimeout(function () { copyBtn.textContent = 'Copy as Text'; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { download(D.slug(current.deck.name) + '.txt', text, 'text/plain'); });
    } else {
      download(D.slug(current.deck.name) + '.txt', text, 'text/plain');
    }
  });

  // ---- Opening a deck file ----
  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > 512 * 1024) { say('That file is too large to be a deck file.', true); return; }
    file.text().then(function (text) {
      var deck = D.parse(text);
      history.replaceState(null, '', location.pathname);
      show(deck);
      view.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (err) {
      say(err.message || 'That file could not be read.', true);
    });
  });

  // A link like decks.html#dream-frogs-and-fancies opens that deck.
  var id = location.hash.slice(1);
  var start = starters.filter(function (d) { return d.id === id; })[0];
  if (start) show(start);
})();
