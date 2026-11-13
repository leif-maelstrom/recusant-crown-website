// Gallery / Free Printables tabs on the Art page.
// Without JavaScript both panels show, one after the other. With it, the
// address hash picks the panel: #printables (or any #printables-<flower>)
// opens the printables, anything else (including #process) opens the gallery.
(function () {
  var tabs = document.querySelectorAll('.art-tab');
  var panels = document.querySelectorAll('.art-panel');
  if (!tabs.length || !panels.length) return;
  document.documentElement.classList.add('art-tabs-on');

  function panelFor(hash) {
    var id = (hash || '').replace(/^#/, '');
    return id === 'printables' || id.indexOf('printables-') === 0 ? 'printables' : 'gallery';
  }

  function show(name) {
    panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
  }

  function sync() {
    var id = location.hash.replace(/^#/, '');
    show(panelFor(location.hash));
    // the panel was hidden when the browser tried to scroll, so scroll now
    if (id && id !== 'gallery' && id !== 'printables') {
      var el = document.getElementById(id);
      if (el) el.scrollIntoView();
    }
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function (e) {
      e.preventDefault();
      var name = t.getAttribute('data-tab');
      history.replaceState(null, '', '#' + name);
      show(name);
    });
  });
  window.addEventListener('hashchange', sync);
  sync();
})();
