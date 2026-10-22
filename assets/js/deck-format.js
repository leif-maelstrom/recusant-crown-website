// Deck files: how a deck is saved, read back and matched to the cards.
//
// A deck file (.rcdeck.json) is plain JSON that anyone can read or edit:
//
//   {
//     "format": "recusant-crown-deck",
//     "version": 1,
//     "name": "Frogs and Fancies",
//     "faction": "Dream",                 optional
//     "set": "Alpha-r1",                  the set revision it was built from
//     "description": "...",               optional
//     "cards": [
//       { "qty": 5, "number": 3, "name": "Well Gazer" },
//       ...
//     ]
//   }
//
// Each card carries its number and its name, so a deck still finds its
// cards if a later revision renumbers or renames one of them. Keep reading
// version 1 files forever; a new version may add fields but should never
// change what these mean.
//
// The same deck as plain text, one card per line ("5 Well Gazer"), is
// accepted too, for decks copied from forums or typed by hand.
(function () {
  var FORMAT = 'recusant-crown-deck';
  var VERSION = 1;

  function simplify(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function slug(name) {
    return simplify(name).replace(/ /g, '-') || 'deck';
  }

  var byNumber = {}, byName = {};
  (window.RC_CARDS || []).forEach(function (c) {
    byNumber[c.number] = c;
    byName[simplify(c.name)] = c;
  });

  // The card a deck line means: same number and name first, then the name
  // alone (renumbered), then the number alone (renamed).
  function find(line) {
    var n = byNumber[line.number], key = simplify(line.name);
    if (n && (!key || simplify(n.name) === key)) return n;
    return byName[key] || n || null;
  }

  // The deck's cards matched to card-data.js, copies of the same card
  // merged. Lines that match no card are listed under missing.
  function resolve(deck) {
    var entries = [], missing = [], seen = new Map();
    (deck.cards || []).forEach(function (line) {
      var qty = Math.max(0, Math.floor(Number(line.qty) || 0));
      if (!qty) return;
      var card = find(line);
      if (!card) { missing.push({ qty: qty, number: line.number, name: line.name }); return; }
      if (seen.has(card)) { seen.get(card).qty += qty; return; }
      var entry = { qty: qty, card: card };
      seen.set(card, entry);
      entries.push(entry);
    });
    return { entries: entries, missing: missing };
  }

  function total(entries) {
    return entries.reduce(function (n, e) { return n + e.qty; }, 0);
  }

  // A clean deck object, ready to save, from matched entries.
  function build(info, entries) {
    var deck = { format: FORMAT, version: VERSION, name: info.name || 'Untitled deck' };
    if (info.faction) deck.faction = info.faction;
    deck.set = info.set || ((window.RC_CARDS || [])[0] || {}).set || '';
    if (info.description) deck.description = info.description;
    deck.cards = entries.map(function (e) {
      return { qty: e.qty, number: e.card.number, name: e.card.name };
    });
    return deck;
  }

  // The file's text: one card per line, so it diffs and hand-edits well.
  function toFile(deck) {
    var head = {};
    Object.keys(deck).forEach(function (k) { if (k !== 'cards') head[k] = deck[k]; });
    var lines = (deck.cards || []).map(function (c) {
      return '    { "qty": ' + c.qty + ', "number": ' + JSON.stringify(c.number) +
        ', "name": ' + JSON.stringify(c.name) + ' }';
    });
    var json = JSON.stringify(head, null, 2);
    return json.slice(0, -2) + ',\n  "cards": [\n' + lines.join(',\n') + '\n  ]\n}\n';
  }

  function fileName(deck) {
    return 'recusant-crown-' + slug(deck.name) + '.rcdeck.json';
  }

  // Plain text: "5 Well Gazer" per line, the deck's name as a "#" heading.
  function toText(deck) {
    return '# ' + (deck.name || 'Untitled deck') + '\n' +
      (deck.cards || []).map(function (c) { return c.qty + ' ' + c.name; }).join('\n') + '\n';
  }

  // Read a deck file or a text list. Throws an Error with a message fit to
  // show the visitor when the text is neither.
  function parse(text) {
    text = String(text || '').replace(/^﻿/, '').trim();
    if (text.charAt(0) === '{') {
      var data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('This file is not a readable deck file.'); }
      if (data.format !== FORMAT || !Array.isArray(data.cards)) {
        throw new Error('This file is not a Recusant Crown deck.');
      }
      if (Number(data.version) > VERSION) {
        // Newer files keep the version 1 fields, so read what we can.
        data.note = 'This deck was saved by a newer version of the site; some details may be missing.';
      }
      return data;
    }
    var deck = { format: FORMAT, version: VERSION, name: '', cards: [] };
    text.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      if (/^(#|\/\/)/.test(line)) {
        if (!deck.name) deck.name = line.replace(/^(#+|\/\/)\s*/, '');
        return;
      }
      // "5 Well Gazer", "5x Well Gazer", "Well Gazer x5", "5 #3"
      var m = line.match(/^(\d+)\s*[x×]?\s+(.+)$/i) || line.match(/^(.+?)\s+[x×]\s*(\d+)$/i);
      if (!m) { deck.cards.push({ qty: 1, name: line }); return; }
      var qty = /^\d+$/.test(m[1]) ? Number(m[1]) : Number(m[2]);
      var name = /^\d+$/.test(m[1]) ? m[2] : m[1];
      var num = name.match(/^#?(\d+)$/);
      deck.cards.push(num ? { qty: qty, number: Number(num[1]), name: '' } : { qty: qty, name: name });
    });
    if (!deck.cards.length) throw new Error('No cards found in that text.');
    deck.name = deck.name || 'Imported deck';
    return deck;
  }

  // ---- Share links ----
  // A deck packed into a page address, read by the browser only:
  //   decks.html#v=1&n=Frogs+and+Fancies&s=Alpha-r1&c=3-5.1-5.4-4
  // c lists number-qty pairs. Links carry numbers only, to stay short, so
  // they belong to the set revision in s; deck files are the lasting copy.
  function toLink(deck) {
    var q = new URLSearchParams();
    q.set('v', VERSION);
    q.set('n', deck.name || '');
    if (deck.set) q.set('s', deck.set);
    q.set('c', (deck.cards || []).map(function (c) { return c.number + '-' + c.qty; }).join('.'));
    return q.toString();
  }

  // The deck in a link's hash, or null when the hash holds no deck.
  function fromLink(hash) {
    var q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    if (!q.get('c')) return null;
    var names = {};
    (window.RC_CARDS || []).forEach(function (c) { names[c.number] = c.name; });
    var cards = q.get('c').split('.').map(function (pair) {
      var p = pair.split('-');
      return { qty: Number(p[1]) || 0, number: Number(p[0]), name: names[Number(p[0])] || '' };
    }).filter(function (c) { return c.qty > 0 && c.number >= 0; });
    var deck = { format: FORMAT, version: VERSION, name: q.get('n') || 'Shared deck', cards: cards };
    if (q.get('s')) deck.set = q.get('s');
    return deck;
  }

  // ---- Deck-building checks (Rules Bible XVIII) ----
  // At least 60 cards; by rarity, up to 5 copies of a Common, 4 of an
  // Uncommon, 3 of a Rare, and 1 of each Legendary with no more than 7
  // Legendaries in all. A card's own text overrides its limit: "You may
  // have any number of ..." (Creeping Shade) or "You may have 7 copies of
  // ..." (Dwarf Miner). These are shown as warnings only; casual and
  // house-rule decks still save.
  var MIN_CARDS = 60, MAX_LEGENDARIES = 7;
  var LIMITS = { Common: 5, Uncommon: 4, Rare: 3, Legendary: 1 };

  function limit(card) {
    var text = card.text || '';
    if (/you may have any number of/i.test(text)) return Infinity;
    var own = text.match(/you may have (\d+) copies/i);
    if (own) return Number(own[1]);
    return LIMITS[card.rarity] || 1;
  }

  function check(entries) {
    var problems = [];
    var n = total(entries);
    if (n < MIN_CARDS) problems.push(n + ' cards: a deck needs at least ' + MIN_CARDS + '.');
    entries.forEach(function (e) {
      var max = limit(e.card);
      if (e.qty > max) {
        problems.push(e.qty + ' × ' + e.card.name + ': ' + e.card.rarity + ' cards are limited to ' + max + (max === 1 ? ' copy.' : ' copies.'));
      }
    });
    var legends = total(entries.filter(function (e) { return e.card.rarity === 'Legendary'; }));
    if (legends > MAX_LEGENDARIES) problems.push(legends + ' Legendaries: a deck may hold ' + MAX_LEGENDARIES + ' at most.');
    return problems;
  }

  window.RC_DECK = {
    FORMAT: FORMAT, VERSION: VERSION,
    resolve: resolve, total: total, build: build,
    toFile: toFile, fileName: fileName, toText: toText, parse: parse,
    toLink: toLink, fromLink: fromLink, check: check, limit: limit,
    simplify: simplify, slug: slug
  };
})();
