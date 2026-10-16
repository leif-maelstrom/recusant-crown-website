/* Milestones list on the blog page, read from the RSS feed (milestones.xml)
   so the list and the feed are the same file. Newest first, as written. */
(function () {
  var list = document.getElementById('milestone-list');
  var more = document.getElementById('milestone-more');
  if (!list) return;

  var SHOWN = 6;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function text(item, tag) {
    var el = item.getElementsByTagName(tag)[0];
    return el ? el.textContent.trim() : '';
  }

  // Show the date the feed says, not the reader's time zone version of it.
  function shortDate(pubDate) {
    var m = /(\d{1,2}) (\w{3}) (\d{4})/.exec(pubDate);
    return m ? m[2] + ' ' + Number(m[1]) + ', ' + m[3] : pubDate;
  }

  // Links in the feed are absolute; keep visitors on the site they are on.
  function localHref(link) {
    return link.replace(/^https:\/\/www\.recusantcrown\.com\//, '') || 'index.html';
  }

  fetch('milestones.xml')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (xml) {
      var doc = new DOMParser().parseFromString(xml, 'application/xml');
      var items = doc.getElementsByTagName('item');
      if (!items.length) throw new Error('empty');
      list.textContent = '';

      Array.prototype.forEach.call(items, function (item, i) {
        var li = document.createElement('li');
        li.className = 'milestone';
        if (i >= SHOWN) li.hidden = true;

        var date = document.createElement('span');
        date.className = 'milestone-date';
        date.textContent = shortDate(text(item, 'pubDate'));

        var title = document.createElement('a');
        title.className = 'milestone-title';
        title.href = localHref(text(item, 'link'));
        title.textContent = text(item, 'title');

        var desc = document.createElement('span');
        desc.className = 'milestone-desc';
        desc.textContent = text(item, 'description');

        li.appendChild(date);
        li.appendChild(title);
        li.appendChild(desc);
        list.appendChild(li);
      });

      if (more && items.length > SHOWN) {
        more.textContent = 'Show all ' + items.length;
        more.hidden = false;
        more.addEventListener('click', function () {
          Array.prototype.forEach.call(list.children, function (li) { li.hidden = false; });
          more.hidden = true;
        });
      }
    })
    .catch(function () {
      list.innerHTML = '<li class="milestone"><span class="milestone-desc">The milestones could not load here. ' +
        'You can still read them in the <a href="milestones.xml">feed</a>.</span></li>';
    });
})();
