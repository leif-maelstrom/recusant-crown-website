/* "Read the latest" banner at the top of fiction.html and tales.html.
   It copies the last card in the .chapters list, so posting a new chapter
   or tale (added at the end, as always) updates the banner with no extra step. */
(function () {
  var cards = document.querySelectorAll('.chapters .chapter-card');
  var title = document.querySelector('.page-title');
  if (!cards.length || !title) return;

  var last = cards[cards.length - 1];
  var link = last.querySelector('a');
  if (!link) return;

  function part(sel) {
    var el = last.querySelector(sel);
    return el ? el.textContent.trim() : '';
  }

  var banner = document.createElement('a');
  banner.className = 'latest-card card';
  banner.href = link.getAttribute('href');

  var img = last.querySelector('.chapter-art img');
  if (img) {
    var art = document.createElement('div');
    art.className = 'latest-art';
    var copy = document.createElement('img');
    copy.src = img.getAttribute('src');
    copy.alt = img.getAttribute('alt') || '';
    art.appendChild(copy);
    banner.appendChild(art);
  }

  var body = document.createElement('div');
  body.className = 'latest-body';

  var eyebrow = document.createElement('div');
  eyebrow.className = 'latest-eyebrow';
  eyebrow.textContent = 'Newest: ' + part('.chapter-subtype');

  var h = document.createElement('h2');
  h.className = 'latest-title';
  h.textContent = part('.chapter-title');

  var text = document.createElement('p');
  text.className = 'latest-text';
  text.textContent = part('.chapter-text');

  var btn = document.createElement('span');
  btn.className = 'btn';
  btn.textContent = 'Read the latest';

  body.appendChild(eyebrow);
  body.appendChild(h);
  body.appendChild(text);
  body.appendChild(btn);
  banner.appendChild(body);

  title.parentNode.insertBefore(banner, title.nextSibling);
})();
