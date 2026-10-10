// Fill the Card Game page's spoiler carousel with 12 random cards from the
// card list (card-data.js). Runs before carousel.js so the carousel sees them.
(function () {
  var COUNT = 12;
  var track = document.querySelector('#spoilerCarousel .carousel-track');
  var cards = (window.RC_CARDS || []).slice();
  if (!track || !cards.length) return;

  // Fisher-Yates shuffle, then keep the first COUNT.
  for (var i = cards.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = cards[i]; cards[i] = cards[j]; cards[j] = t;
  }

  cards.slice(0, COUNT).forEach(function (card) {
    var item = document.createElement('div');
    item.className = 'spoiler-card';

    var img = document.createElement('img');
    img.src = card.image;
    img.alt = card.name;
    img.setAttribute('data-lightbox', '');
    img.setAttribute('data-lightbox-caption', card.name);
    img.setAttribute('data-lightbox-note', 'Card #' + card.number);

    var name = document.createElement('div');
    name.className = 'spoiler-name';
    name.textContent = card.name;

    item.appendChild(img);
    item.appendChild(name);
    track.appendChild(item);
  });
})();
