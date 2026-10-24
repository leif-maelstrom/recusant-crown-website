// Home printing, shared by the Library and the Decks page. Cards come out at
// true size (2.5 x 3.5 in), nine to a page; the pages only show when
// printing (see .print-sheet in the CSS).
//
//   RC_PRINT.cards(list)   list of cards, one entry per copy
//   RC_PRINT.page(el)      any element, printed on its own (a deck list)
//
// Both resolve once the print dialog has been opened.
//
// Any checkbox marked data-print-backs turns on card backs for two-sided
// printing: each page of fronts is followed by a page of backs, mirrored
// left to right so every back lands behind its card when the printer flips
// on the long edge. The choice is remembered in this browser.
(function () {
  var PER_PAGE = 9, COLS = 3;
  var BACK = 'assets/art/illustrations/card-back-alpha.jpg';
  var STORE = 'rc-print-backs';

  var backs = false;
  try { backs = localStorage.getItem(STORE) === '1'; } catch (e) { /* private mode */ }
  var boxes = Array.prototype.slice.call(document.querySelectorAll('[data-print-backs]'));
  boxes.forEach(function (box) {
    box.checked = backs;
    box.addEventListener('change', function () {
      backs = box.checked;
      boxes.forEach(function (b) { b.checked = backs; });
      try { localStorage.setItem(STORE, backs ? '1' : '0'); } catch (e) { /* private mode */ }
    });
  });

  // The card's drawn image, or its old image file if drawing fails.
  function cardImage(card) {
    return window.RC_RENDER.url(card).catch(function () { return card.image; });
  }

  function replace(wrap) {
    var old = document.querySelector('.print-sheet');
    if (old) old.remove();
    wrap.className = 'print-sheet';
    document.body.appendChild(wrap);
  }

  function cards(list) {
    var unique = list.filter(function (c, i) { return list.indexOf(c) === i; });
    return Promise.all(unique.map(cardImage)).then(function (srcs) {
      var srcFor = new Map();
      unique.forEach(function (c, i) { srcFor.set(c, srcs[i]); });

      var wrap = document.createElement('div');
      var waits = [];
      function slot(grid, src, alt) {
        var s = document.createElement('div');
        s.className = 'print-slot';
        if (src) {
          var img = document.createElement('img');
          img.className = 'print-card';
          img.alt = alt;
          waits.push(new Promise(function (done) { img.onload = img.onerror = done; }));
          img.src = src;
          s.appendChild(img);
        } else {
          s.className += ' print-slot-empty';
        }
        grid.appendChild(s);
      }
      function newPage() {
        var page = document.createElement('div');
        page.className = 'print-page';
        var grid = document.createElement('div');
        grid.className = 'print-grid';
        page.appendChild(grid);
        wrap.appendChild(page);
        return grid;
      }
      for (var i = 0; i < list.length; i += PER_PAGE) {
        var group = list.slice(i, i + PER_PAGE);
        var grid = newPage();
        group.forEach(function (card) { slot(grid, srcFor.get(card), card.name); });
        if (!backs) continue;
        // The backs, row by row with each row reversed: the mirror image of
        // the fronts. A short row keeps its gaps on the mirrored side.
        grid = newPage();
        for (var r = 0; r * COLS < group.length; r++) {
          for (var c = COLS - 1; c >= 0; c--) {
            slot(grid, r * COLS + c < group.length ? BACK : null, 'Card back');
          }
        }
      }
      replace(wrap);
      return Promise.all(waits);
    }).then(function () { window.print(); });
  }

  function page(el) {
    var wrap = document.createElement('div');
    wrap.appendChild(el);
    replace(wrap);
    window.print();
    return Promise.resolve();
  }

  window.RC_PRINT = { cards: cards, page: page, perPage: PER_PAGE, cardImage: cardImage };
})();
