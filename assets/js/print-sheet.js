// Home printing, shared by the Library and the Decks page. Cards come out at
// true size (2.5 x 3.5 in), nine to a page; the pages only show when
// printing (see .print-sheet in the CSS).
//
//   RC_PRINT.cards(list)   list of cards, one entry per copy
//   RC_PRINT.page(el)      any element, printed on its own (a deck list)
//
// Both resolve once the print dialog has been opened.
(function () {
  var PER_PAGE = 9;

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
      for (var i = 0; i < list.length; i += PER_PAGE) {
        var page = document.createElement('div');
        page.className = 'print-page';
        var grid = document.createElement('div');
        grid.className = 'print-grid';
        page.appendChild(grid);
        list.slice(i, i + PER_PAGE).forEach(function (card) {
          var img = document.createElement('img');
          img.className = 'print-card';
          img.alt = card.name;
          waits.push(new Promise(function (done) { img.onload = img.onerror = done; }));
          img.src = srcFor.get(card);
          var slot = document.createElement('div');
          slot.className = 'print-slot';
          slot.appendChild(img);
          grid.appendChild(slot);
        });
        wrap.appendChild(page);
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
