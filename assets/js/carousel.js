(function () {
  document.querySelectorAll('.carousel').forEach(function (root) {
    var track = root.querySelector('.carousel-track');
    var prev = root.querySelector('.carousel-prev');
    var next = root.querySelector('.carousel-next');
    var status = root.parentNode.querySelector('.carousel-status');
    if (!track || !track.children.length) return;
    var cards = track.children;

    function gap() {
      return parseFloat(getComputedStyle(track).columnGap) || 0;
    }

    function step() {
      return cards[0].getBoundingClientRect().width + gap();
    }

    function perView() {
      return Math.max(1, Math.floor((track.clientWidth + gap() + 1) / step()));
    }

    function update() {
      var max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
      if (status) {
        var n = perView();
        var first = next.disabled
          ? Math.max(1, cards.length - n + 1)
          : Math.round(track.scrollLeft / step()) + 1;
        var last = Math.min(cards.length, first + n - 1);
        status.textContent = (first === last ? first : first + '–' + last) + ' of ' + cards.length;
      }
    }

    function go(dir) {
      track.scrollBy({ left: dir * step() * perView(), behavior: 'smooth' });
    }

    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });

    var raf;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });
})();
