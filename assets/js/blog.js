/* Blog page: show the newest post, and keep older posts behind a
   "Load all posts" button. A link straight to an older post opens them all. */
(function () {
  var entries = document.querySelectorAll('#posts .blog-entry');
  var more = document.getElementById('posts-more');
  if (entries.length < 2 || !more) return;

  var older = Array.prototype.slice.call(entries, 1);

  function showAll() {
    older.forEach(function (el) { el.hidden = false; });
    more.hidden = true;
  }

  function targetIsOlder() {
    var id = decodeURIComponent(location.hash.slice(1));
    return id && older.some(function (el) { return el.id === id || el.querySelector('[id="' + id + '"]'); });
  }

  if (targetIsOlder()) return;

  older.forEach(function (el) { el.hidden = true; });
  more.textContent = 'Load all posts (' + older.length + ' more)';
  more.hidden = false;
  more.addEventListener('click', showAll);
  window.addEventListener('hashchange', function () {
    if (targetIsOlder()) {
      showAll();
      var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) el.scrollIntoView();
    }
  });
})();
