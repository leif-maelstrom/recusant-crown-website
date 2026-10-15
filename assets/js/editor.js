// The card editor (editor.html): edit or add a card with a live preview,
// then save it straight to the site's repository through the GitHub API.
//
// A save is one commit on main that:
//   - rewrites that card's line in assets/js/card-data.js (re-read fresh from
//     GitHub first, so edits made elsewhere since the page loaded are kept),
//   - adds or renames its art in assets/card-art/ when needed, and
//   - bumps the card-data.js version tag on the pages that load it, as
//     tools/stamp-versions.py would, so visitors get the new list at once.
(function () {
  var OWNER = 'leif-maelstrom', REPO = 'recusant-crown-website', BRANCH = 'main';
  var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
  var DATA = 'assets/js/card-data.js';
  var PAGES = ['library.html', 'cards.html'];   // pages that load card-data.js
  var KEYS = ['number', 'set', 'name', 'image', 'art', 'faction', 'kind', 'cost', 'type', 'rarity', 'bloom', 'power', 'bounty', 'text'];
  var STORE = 'rc-editor-token';
  var ART_W = 1000, ART_H = 620;

  var $ = function (id) { return document.getElementById(id); };
  var form = $('cardForm');
  var token = '';
  var cards = [];          // as last read from GitHub
  var current = null;      // the saved card being edited (null for a new card)
  var upload = null;       // { dataUrl, base64 } for newly chosen art

  // ---- GitHub ----
  function gh(path, opts) {
    opts = opts || {};
    return fetch(path.indexOf('http') === 0 ? path : API + path, {
      method: opts.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error((j && j.message) || ('GitHub said ' + r.status));
          e.status = r.status;
          throw e;
        }
        return j;
      });
    });
  }

  function decode(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function readFile(path) {
    return gh('/contents/' + path + '?ref=' + BRANCH).then(function (f) { return { text: decode(f.content), sha: f.sha }; });
  }

  // ---- card-data.js ----
  // One card per line, each a JSON object, so lines can be read and written
  // without touching the comments above them.
  function isCardLine(l) { return /^\s*\{"number"/.test(l); }

  function parse(text) {
    return text.split('\n').filter(isCardLine).map(function (l) { return JSON.parse(l.trim().replace(/,$/, '')); });
  }

  function cardLine(c) {
    var keys = KEYS.filter(function (k) { return k in c; })
      .concat(Object.keys(c).filter(function (k) { return KEYS.indexOf(k) === -1; }));
    return '  {' + keys.map(function (k) { return JSON.stringify(k) + ': ' + JSON.stringify(c[k]); }).join(', ') + '}';
  }

  // Replace the card numbered oldNumber (or add a new one, or with no card,
  // remove it), keeping the list in collector-number order.
  function applyCard(text, card, oldNumber) {
    var lines = text.split('\n');
    var idx = lines.map(function (l, i) { return isCardLine(l) ? i : -1; }).filter(function (i) { return i >= 0; });
    var list = idx.map(function (i) { return JSON.parse(lines[i].trim().replace(/,$/, '')); })
      .filter(function (c) { return oldNumber == null || c.number !== oldNumber; });
    if (oldNumber != null && list.length === idx.length) {
      throw new Error('Card #' + pad(oldNumber) + ' is no longer in the list. Reload the page and try again.');
    }
    if (card) {
      if (list.some(function (c) { return c.number === card.number; })) {
        throw new Error('Card #' + pad(card.number) + ' already exists. Pick another number.');
      }
      list.push(card);
    }
    list.sort(function (a, b) { return a.number - b.number; });
    var body = list.map(function (c, i) { return cardLine(c) + (i < list.length - 1 ? ',' : ''); });
    return lines.slice(0, idx[0]).concat(body, lines.slice(idx[idx.length - 1] + 1)).join('\n');
  }

  function pad(n) { return ('000' + n).slice(-4); }
  function slug(name) { return name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function sha8(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 8);
    });
  }

  // ---- Sign in ----
  function signIn(t, remember) {
    token = t;
    $('signinMsg').textContent = 'Checking…';
    return gh('').then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) throw new Error("This token can read the site but can't save to it.");
      try {
        (remember ? localStorage : sessionStorage).setItem(STORE, t);
        (remember ? sessionStorage : localStorage).removeItem(STORE);
      } catch (e) { /* storage blocked: stay signed in for this visit only */ }
      return load();
    }).then(function () {
      $('signin').hidden = true;
      $('editor').hidden = false;
    }).catch(function (e) {
      token = '';
      $('signinMsg').textContent = e.status === 401 ? "GitHub didn't accept that token." : e.message;
    });
  }

  function load() {
    return readFile(DATA).then(function (f) {
      cards = parse(f.text);
      var sets = $('sets');
      sets.innerHTML = '';
      allSets().forEach(function (s) { var o = document.createElement('option'); o.value = s; sets.appendChild(o); });
      $('newRevision').textContent = 'Start a new revision of ' + latestSet();
      renderList();
    });
  }

  // Sets in the order cards first use them; the newest is the one most
  // cards are in, since a new revision moves the whole set.
  function allSets() {
    var seen = [];
    cards.forEach(function (c) { if (c.set && seen.indexOf(c.set) === -1) seen.push(c.set); });
    return seen;
  }
  function latestSet() {
    var count = {};
    cards.forEach(function (c) { if (c.set) count[c.set] = (count[c.set] || 0) + 1; });
    return Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0] || 'Alpha-r1';
  }

  $('signinForm').addEventListener('submit', function (e) {
    e.preventDefault();
    signIn($('token').value.trim(), $('remember').checked);
  });

  $('signout').addEventListener('click', function () {
    try { localStorage.removeItem(STORE); sessionStorage.removeItem(STORE); } catch (e) { /* ignore */ }
    location.reload();
  });

  // ---- Card list ----
  function renderList() {
    var q = $('find').value.trim().toLowerCase();
    var list = $('cardList');
    list.innerHTML = '';
    cards.forEach(function (c) {
      if (q && (pad(c.number) + ' ' + c.name).toLowerCase().indexOf(q.replace(/^#/, '')) === -1) return;
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = '#' + pad(c.number) + ' ' + c.name;
      if (current && current.number === c.number) b.className = 'active';
      b.addEventListener('click', function () { edit(c); });
      li.appendChild(b);
      list.appendChild(li);
    });
  }
  $('find').addEventListener('input', renderList);

  // ---- Form ----
  function edit(card) {
    current = card;
    upload = null;
    fill(card || blank());
    $('remove').hidden = !card;
    $('formTitle').textContent = card ? 'Editing #' + pad(card.number) + ' ' + card.name : 'New card';
    $('saveMsg').textContent = '';
    renderList();
    preview();
  }

  // A new card takes the next free number in the chosen faction's hundred.
  var BLOCK = { Dream: 0, Resolve: 100, Dark: 200, Light: 300, Essence: 400 };
  function nextNumber(faction) {
    var n = BLOCK[faction] + 1;
    while (cards.some(function (c) { return c.number === n; })) n++;
    return n;
  }
  function blank() {
    return { number: nextNumber('Dream'), set: latestSet(), name: '', faction: 'Dream', kind: 'Entity', cost: 0, type: 'Conjure ', rarity: 'Common', bloom: 1, power: 1, bounty: 1, text: '' };
  }

  function fill(c) {
    var f = form.elements;
    ['number', 'set', 'name', 'faction', 'kind', 'rarity', 'type', 'text'].forEach(function (k) { f[k].value = c[k] == null ? '' : c[k]; });
    f.cost.value = c.cost;
    f.bloom.value = c.bloom == null ? '' : c.bloom;
    f.power.value = c.power == null ? '' : c.power;
    f.bounty.value = c.bounty == null ? '' : c.bounty;
    f.crown.checked = c.kind === 'Entity' && c.bounty === null;
    f.art.value = '';
    kindChanged();
  }

  function kindChanged() {
    var entity = form.elements.kind.value === 'Entity';
    Array.prototype.forEach.call(form.querySelectorAll('.entity'), function (el) { el.hidden = !entity; });
    form.elements.bounty.disabled = form.elements.crown.checked;
  }

  // The card as the form describes it, in card-data.js's shape.
  function fromForm() {
    var f = form.elements;
    var num = parseInt(f.number.value, 10);
    var name = f.name.value.trim();
    var cost = f.cost.value.trim().toUpperCase() === 'X' ? 'X' : parseInt(f.cost.value, 10);
    var c = {
      number: num,
      set: f.set.value.trim(),
      name: name,
      image: 'assets/cards/' + pad(num) + '-' + slug(name) + '.jpg',
      art: true,
      faction: f.faction.value,
      kind: f.kind.value,
      cost: cost,
      type: f.type.value.trim(),
      rarity: f.rarity.value
    };
    if (c.kind === 'Entity') {
      c.bloom = parseInt(f.bloom.value, 10) || 0;
      c.power = parseInt(f.power.value, 10) || 0;
      c.bounty = f.crown.checked ? null : (parseInt(f.bounty.value, 10) || 0);
    }
    c.text = f.text.value.trim();
    // Keep the old image and any fields this form doesn't edit.
    if (current) {
      if (current.number === num && current.name === name) c.image = current.image;
      Object.keys(current).forEach(function (k) { if (KEYS.indexOf(k) === -1 && k !== 'imagePending') c[k] = current[k]; });
    }
    return c;
  }

  function check(c) {
    if (!c.number || c.number < 1) return 'Give the card a collector number.';
    if (!c.name) return 'Give the card a name.';
    if (!c.set) return 'Give the card a set, such as ' + latestSet() + '.';
    if (c.cost !== 'X' && isNaN(c.cost)) return 'Cost must be a number or X.';
    if (!current && !upload) return 'Choose art for the new card.';
    return '';
  }

  var timer;
  form.addEventListener('input', function (e) {
    if (e.target.name === 'kind' || e.target.name === 'crown') kindChanged();
    if (e.target.name === 'faction' && !current) form.elements.number.value = nextNumber(form.elements.faction.value);
    clearTimeout(timer);
    timer = setTimeout(preview, 250);
  });
  form.elements.kind.addEventListener('change', kindChanged);

  function preview() {
    var c = fromForm();
    if (upload) c.artSrc = upload.dataUrl;
    else if (current) c.artSrc = window.RC_RENDER.artPath(current);
    var msg = $('previewMsg');
    if (!upload && !current) {
      msg.textContent = 'Choose art to see the card.';
      return;
    }
    window.RC_RENDER.draw(c).then(function (canvas) {
      $('preview').getContext('2d').drawImage(canvas, 0, 0);
      msg.textContent = '';
    }).catch(function () { msg.textContent = "Couldn't draw the preview."; });
  }

  // Crop chosen art from the centre to the art window's shape, at the size
  // the site stores it.
  form.elements.art.addEventListener('change', function () {
    var file = form.elements.art.files[0];
    if (!file) return;
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement('canvas');
      cv.width = ART_W; cv.height = ART_H;
      var s = Math.max(ART_W / img.width, ART_H / img.height), sw = ART_W / s, sh = ART_H / s;
      cv.getContext('2d').drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, ART_W, ART_H);
      var dataUrl = cv.toDataURL('image/jpeg', 0.82);
      upload = { dataUrl: dataUrl, base64: dataUrl.split(',')[1] };
      $('saveMsg').textContent = '';
      URL.revokeObjectURL(img.src);
      preview();
    };
    img.onerror = function () { $('previewMsg').textContent = "That file isn't an image this browser can read."; };
    img.src = URL.createObjectURL(file);
  });

  $('newCard').addEventListener('click', function () { edit(null); });
  $('revert').addEventListener('click', function () { edit(current); });

  // ---- Save, remove, new revision ----
  function done(msg, commit, then) {
    var link = 'Saved. <a href="' + commit.html_url + '" target="_blank" rel="noopener">See the change</a>. The site updates in a minute or two.';
    msg.innerHTML = link;
    return load().then(function () { then(); msg.innerHTML = link; });
  }

  function busy(on) { ['save', 'remove', 'newRevision'].forEach(function (id) { $(id).disabled = on; }); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var card = fromForm();
    var problem = check(card);
    var msg = $('saveMsg');
    if (problem) { msg.textContent = problem; return; }
    busy(true);
    msg.textContent = 'Saving…';
    save(card).then(function (commit) {
      return done(msg, commit, function () { edit(cards.filter(function (c) { return c.number === card.number; })[0] || null); });
    }).catch(function (err) {
      msg.textContent = 'Not saved: ' + err.message;
    }).then(function () { busy(false); });
  });

  $('remove').addEventListener('click', function () {
    var card = current, msg = $('saveMsg');
    if (!card || !confirm('Remove #' + pad(card.number) + ' ' + card.name + ' from the site? Its art is removed too. GitHub keeps the old version in the site\'s history.')) return;
    busy(true);
    msg.textContent = 'Removing…';
    commitChange('Remove card #' + pad(card.number) + ' ' + card.name, function (text) {
      return applyCard(text, null, card.number);
    }, function (tree) {
      tree.push({ path: window.RC_RENDER.artPath(card), mode: '100644', type: 'blob', sha: null });
    }).then(function (commit) {
      return done(msg, commit, function () { edit(null); });
    }).catch(function (err) {
      msg.textContent = 'Not removed: ' + err.message;
    }).then(function () { busy(false); });
  });

  // A new revision: mark the current state of the site with a GitHub tag
  // named after the old revision (e.g. alpha-r1), so every card and its art
  // as they stood can always be found again, then move every card in that
  // revision to the new one.
  $('newRevision').addEventListener('click', function () {
    var from = latestSet(), m = /^(.*-r)(\d+)$/.exec(from);
    var to = prompt('Every card in ' + from + ' moves to the new revision, and the site as it stands now is kept on GitHub as "' + tagName(from) + '". New revision name:', m ? m[1] + (+m[2] + 1) : from + '-r2');
    var msg = $('listMsg');
    if (!to || !(to = to.trim()) || to === from) return;
    busy(true);
    msg.textContent = 'Starting ' + to + '…';
    commitChange('Start ' + to + ' (' + from + ' kept as tag ' + tagName(from) + ')', function (text) {
      var lines = text.split('\n').map(function (l) {
        if (!isCardLine(l)) return l;
        var c = JSON.parse(l.trim().replace(/,$/, ''));
        if (c.set !== from) return l;
        c.set = to;
        return cardLine(c) + (/,\s*$/.test(l) ? ',' : '');
      });
      return lines.join('\n');
    }, null, function (head) {
      return gh('/git/refs', { method: 'POST', body: { ref: 'refs/tags/' + tagName(from), sha: head } }).catch(function (err) {
        if (err.status === 422) throw new Error('A tag named ' + tagName(from) + ' already exists on GitHub.');
        throw err;
      });
    }).then(function (commit) {
      return done(msg, commit, function () { edit(current && cards.filter(function (c) { return c.number === current.number; })[0] || null); });
    }).catch(function (err) {
      msg.textContent = 'Not started: ' + err.message;
    }).then(function () { busy(false); });
  });

  function tagName(set) { return set.toLowerCase().replace(/[^a-z0-9.-]+/g, '-'); }

  function save(card) {
    var old = current;
    var oldArt = old ? window.RC_RENDER.artPath(old) : null;
    var newArt = window.RC_RENDER.artPath(card);
    var what = (old ? 'Edit' : 'Add') + ' card #' + pad(card.number) + ' ' + card.name;
    return commitChange(what, function (text) {
      return applyCard(text, card, old ? old.number : null);
    }, function (tree) {
      if (upload) {
        return gh('/git/blobs', { method: 'POST', body: { content: upload.base64, encoding: 'base64' } }).then(function (b) {
          tree.push({ path: newArt, mode: '100644', type: 'blob', sha: b.sha });
          if (oldArt && oldArt !== newArt) tree.push({ path: oldArt, mode: '100644', type: 'blob', sha: null });
        });
      }
      if (oldArt && oldArt !== newArt) {
        // Renamed or renumbered: move the existing art with it.
        return gh('/contents/' + oldArt + '?ref=' + BRANCH).then(function (f) {
          tree.push({ path: newArt, mode: '100644', type: 'blob', sha: f.sha });
          tree.push({ path: oldArt, mode: '100644', type: 'blob', sha: null });
        });
      }
    });
  }

  // One commit on main: card-data.js as editData rewrites it, the version tag
  // bumped on the pages that load it, plus whatever addFiles puts in the tree.
  // before(head) runs first, once, against the commit being built on.
  function commitChange(message, editData, addFiles, before, attempt) {
    var head, baseTree, dataText, tree;
    attempt = attempt || 0;
    return gh('/git/ref/heads/' + BRANCH).then(function (ref) {
      head = ref.object.sha;
      return gh('/git/commits/' + head);
    }).then(function (commit) {
      baseTree = commit.tree.sha;
      return readFile(DATA);
    }).then(function (f) {
      dataText = editData(f.text);
      return Promise.all([sha8(dataText)].concat(PAGES.map(readFile)));
    }).then(function (got) {
      var tag = got[0];
      tree = [{ path: DATA, mode: '100644', type: 'blob', content: dataText }];
      PAGES.forEach(function (p, i) {
        var html = got[i + 1].text.replace(/(assets\/js\/card-data\.js)\?v=[0-9a-f]+/g, '$1?v=' + tag);
        tree.push({ path: p, mode: '100644', type: 'blob', content: html });
      });
      return addFiles && addFiles(tree);
    }).then(function () {
      return gh('/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: tree } });
    }).then(function (t) {
      return gh('/git/commits', { method: 'POST', body: { message: message + '\n\nSaved from the card editor.', tree: t.sha, parents: [head] } });
    }).then(function (commit) {
      return Promise.resolve(before && attempt === 0 && before(head)).then(function () {
        return gh('/git/refs/heads/' + BRANCH, { method: 'PATCH', body: { sha: commit.sha } });
      }).then(function () { return commit; });
    }).catch(function (err) {
      // Someone else committed in between: start again from their version, once.
      if (err.status === 422 && attempt < 1 && !/tag named/.test(err.message)) return commitChange(message, editData, addFiles, before, attempt + 1);
      throw err;
    });
  }

  // ---- Start ----
  var saved = '';
  try { saved = localStorage.getItem(STORE) || sessionStorage.getItem(STORE) || ''; } catch (e) { /* ignore */ }
  if (saved) signIn(saved, !!localStorage.getItem(STORE));
})();
