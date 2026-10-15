// Full-screen image viewer for any element marked data-lightbox.
//
// The image opens fitted to the screen. The first zoom step (button, + key
// or double-click) widens it to fill the screen; the wheel and a pinch zoom
// freely toward the pointer. Drag, or use the arrow keys, to move around in
// any direction. "Fit" returns to the whole image.
//
// Images inside an element marked data-lightbox-group (the Library grid, the
// spoiler carousel, the Art page) form a set: the side arrows, the left and
// right arrow keys (when not zoomed in) and a swipe step through the ones
// currently shown, in page order, wrapping at the ends.
(function () {
  var ZOOM_STEP = 1.5;
  var MAX_ZOOM = 8;          // relative to the fitted size
  var PAD = 16;              // breathing room around the fitted image

  // ---- Build the viewer once, shared by every page ----
  var box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Image viewer');
  box.innerHTML =
    '<button class="lightbox-close" type="button" aria-label="Close">&times;</button>' +
    '<div class="lightbox-stage">' +
      '<img class="lightbox-img" alt="" draggable="false">' +
      '<button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous image">&#8249;</button>' +
      '<button class="lightbox-nav lightbox-next" type="button" aria-label="Next image">&#8250;</button>' +
    '</div>' +
    '<div class="lightbox-footer">' +
      '<div class="lightbox-caption"></div>' +
      '<div class="lightbox-note"></div>' +
      '<div class="lightbox-count" aria-live="polite"></div>' +
      '<div class="lightbox-zoom-controls">' +
        '<button class="lightbox-zoom-btn" type="button" data-zoom="out" aria-label="Zoom out">&minus;</button>' +
        '<span class="lightbox-zoom-label" aria-live="polite">100%</span>' +
        '<button class="lightbox-zoom-btn" type="button" data-zoom="in" aria-label="Zoom in">+</button>' +
        '<button class="lightbox-zoom-btn lightbox-fit" type="button" data-zoom="fit">Fit</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(box);

  var stage = box.querySelector('.lightbox-stage');
  var img = box.querySelector('.lightbox-img');
  var caption = box.querySelector('.lightbox-caption');
  var note = box.querySelector('.lightbox-note');
  var label = box.querySelector('.lightbox-zoom-label');
  var closeBtn = box.querySelector('.lightbox-close');
  var btnIn = box.querySelector('[data-zoom="in"]');
  var btnOut = box.querySelector('[data-zoom="out"]');
  var prevBtn = box.querySelector('.lightbox-prev');
  var nextBtn = box.querySelector('.lightbox-next');
  var count = box.querySelector('.lightbox-count');

  // Image state: natural size, fitted scale, current scale, top-left offset.
  var natW = 0, natH = 0, fit = 1, scale = 1, tx = 0, ty = 0;
  var lastFocus = null;

  function stageSize() {
    return { w: stage.clientWidth, h: stage.clientHeight };
  }

  function zoom() { return scale / fit; }

  // The first zoom stop: the image grows to fill the screen edge to edge
  // (for a tall card on a wide screen, its full width, so the text reads
  // across), but stops at the image's true size so the text stays sharp.
  function fillZoom() {
    var s = stageSize();
    var fill = Math.max(s.w / natW, s.h / natH) / fit;
    var trueSize = Math.max(1 / fit, 1.5);
    return Math.min(MAX_ZOOM, fill, trueSize);
  }

  // Zoom in: the first step jumps to the fill level, later steps go up by
  // ZOOM_STEP. Zoom out steps back down, pausing at the fill level.
  function stepZoom(dir) {
    var z = zoom(), f = fillZoom(), hasFill = f > 1.05, next;
    if (dir > 0) next = (hasFill && z < f - 0.01) ? f : z * ZOOM_STEP;
    else next = (hasFill && z > f + 0.01) ? Math.max(z / ZOOM_STEP, f) : 1;
    zoomTo(next, undefined, undefined, true);
  }

  // Keep the image on screen: centre it on any axis where it is smaller
  // than the stage, otherwise stop its edges from pulling inside.
  function clamp() {
    var s = stageSize(), w = natW * scale, h = natH * scale;
    tx = w <= s.w ? (s.w - w) / 2 : Math.min(0, Math.max(s.w - w, tx));
    ty = h <= s.h ? (s.h - h) / 2 : Math.min(0, Math.max(s.h - h, ty));
  }

  function render(animate) {
    clamp();
    img.classList.toggle('is-animating', !!animate);
    img.style.width = natW * scale + 'px';
    img.style.height = natH * scale + 'px';
    img.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
    var z = zoom();
    label.textContent = Math.round(z * 100) + '%';
    btnOut.disabled = z <= 1.001;
    btnIn.disabled = z >= MAX_ZOOM - 0.001;
    stage.classList.toggle('is-zoomed', z > 1.01);
  }

  function computeFit() {
    var s = stageSize();
    fit = Math.min((s.w - PAD * 2) / natW, (s.h - PAD * 2) / natH);
  }

  // Zoom to a new level, keeping the point (px, py) of the stage still.
  function zoomTo(z, px, py, animate) {
    z = Math.max(1, Math.min(MAX_ZOOM, z));
    var s = stageSize();
    if (px === undefined) { px = s.w / 2; py = s.h / 2; }
    var next = fit * z;
    tx = px - (px - tx) * (next / scale);
    ty = py - (py - ty) * (next / scale);
    scale = next;
    render(animate);
  }

  function fitImage(animate) {
    computeFit();
    scale = fit;
    render(animate);
  }

  // ---- The set of images to step through ----
  var set = [], at = -1;

  // The images shown in the same group as el, in page order. Hidden ones
  // (filtered out of the Library) are skipped.
  function groupOf(el) {
    var g = el.closest('[data-lightbox-group]');
    if (!g) return [el];
    return Array.prototype.filter.call(g.querySelectorAll('[data-lightbox]'), function (x) {
      return x === el || x.getClientRects().length > 0;
    });
  }

  // A card image may not be drawn yet (they draw as they near the screen),
  // so draw it first.
  function srcOf(el) {
    var src = el.getAttribute('data-lightbox-src') || el.currentSrc || el.src || el.getAttribute('href');
    var job = el.__rcJob;
    if (!src && job && window.RC_RENDER) return window.RC_RENDER.url(job.card).catch(function () { return job.card.image; });
    return Promise.resolve(src);
  }

  function openEl(el) {
    srcOf(el).then(function (src) {
      open(
        src,
        el.getAttribute('data-lightbox-alt') || el.alt || '',
        el.getAttribute('data-lightbox-caption') || '',
        el.getAttribute('data-lightbox-note') || ''
      );
    });
  }

  function showSet() {
    var many = set.length > 1;
    prevBtn.hidden = nextBtn.hidden = !many;
    count.textContent = many ? (at + 1) + ' / ' + set.length : '';
  }

  function step(dir) {
    if (set.length < 2) return;
    at = (at + dir + set.length) % set.length;
    showSet();
    openEl(set[at]);
  }

  function open(src, alt, cap, nte) {
    if (!box.classList.contains('open')) lastFocus = document.activeElement;
    caption.textContent = cap || '';
    note.textContent = nte || '';
    img.alt = alt || '';
    img.classList.remove('is-ready');
    box.classList.add('open');
    document.body.style.overflow = 'hidden';
    img.onload = function () {
      natW = img.naturalWidth;
      natH = img.naturalHeight;
      fitImage(false);
      img.classList.add('is-ready');
    };
    img.src = src;
    if (!box.contains(document.activeElement)) closeBtn.focus();
  }

  function close() {
    box.classList.remove('open');
    document.body.style.overflow = '';
    img.removeAttribute('src');
    if (lastFocus) lastFocus.focus();
  }

  // One listener for the whole page, so images added later (like the
  // cards the carousel and Library draw from the card list) work too.
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-lightbox]');
    if (!el || box.contains(el)) return;
    e.preventDefault();
    set = groupOf(el);
    at = set.indexOf(el);
    showSet();
    openEl(el);
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', function () { step(-1); });
  nextBtn.addEventListener('click', function () { step(1); });
  // The arrows sit on the stage, so keep their presses from starting a drag.
  [prevBtn, nextBtn].forEach(function (b) {
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  });
  btnIn.addEventListener('click', function () { stepZoom(1); });
  btnOut.addEventListener('click', function () { stepZoom(-1); });
  box.querySelector('[data-zoom="fit"]').addEventListener('click', function () { fitImage(true); });

  function stagePoint(e) {
    var r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ---- Wheel zoom, toward the cursor ----
  stage.addEventListener('wheel', function (e) {
    e.preventDefault();
    var p = stagePoint(e);
    var delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomTo(zoom() * Math.exp(-delta * 0.0015), p.x, p.y, false);
  }, { passive: false });

  // ---- Drag to pan, pinch to zoom (mouse, pen and touch alike) ----
  var pointers = {};
  var drag = null;     // { x, y, tx, ty, moved }
  var pinch = null;    // { dist, zoom, x, y }

  function pointerList() {
    return Object.keys(pointers).map(function (k) { return pointers[k]; });
  }

  function startPinch() {
    var p = pointerList();
    pinch = {
      dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1,
      zoom: zoom()
    };
    drag = null;
  }

  stage.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    stage.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = stagePoint(e);
    if (pointerList().length === 2) {
      startPinch();
    } else if (pointerList().length === 1) {
      drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty, moved: false, onImage: e.target === img };
    }
  });

  stage.addEventListener('pointermove', function (e) {
    if (!pointers[e.pointerId]) return;
    pointers[e.pointerId] = stagePoint(e);
    if (pinch && pointerList().length === 2) {
      var p = pointerList();
      var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      zoomTo(pinch.zoom * d / pinch.dist, (p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2, false);
      return;
    }
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      drag.moved = true;
      stage.classList.add('is-dragging');
    }
    if (drag.moved) {
      tx = drag.tx + dx;
      ty = drag.ty + dy;
      render(false);
    }
  });

  function endPointer(e) {
    if (!pointers[e.pointerId]) return;
    delete pointers[e.pointerId];
    stage.classList.remove('is-dragging');
    if (pinch) {
      pinch = null;
      drag = null;
      return;
    }
    // A plain click on the dark area around the image closes the viewer.
    if (drag && !drag.moved && !drag.onImage && e.type === 'pointerup') close();
    // A sideways swipe while not zoomed in steps to the next or previous image.
    else if (drag && drag.moved && zoom() <= 1.01 && e.type === 'pointerup') {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    }
    drag = null;
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  // Double-click: fill the screen around that spot, or back to fit.
  stage.addEventListener('dblclick', function (e) {
    var p = stagePoint(e);
    if (zoom() > 1.01) fitImage(true);
    else zoomTo(fillZoom() > 1.3 ? fillZoom() : 2.5, p.x, p.y, true);
  });

  // ---- Keyboard ----
  document.addEventListener('keydown', function (e) {
    if (!box.classList.contains('open')) return;
    var k = e.key, pan = 80;
    if (k === 'Escape') close();
    else if (k === '+' || k === '=') stepZoom(1);
    else if (k === '-' || k === '_') stepZoom(-1);
    else if (k === '0') fitImage(true);
    else if ((k === 'ArrowLeft' || k === 'ArrowRight') && zoom() <= 1.01 && set.length > 1) step(k === 'ArrowLeft' ? -1 : 1);
    else if (k === 'ArrowLeft') { tx += pan; render(true); }
    else if (k === 'ArrowRight') { tx -= pan; render(true); }
    else if (k === 'ArrowUp') { ty += pan; render(true); }
    else if (k === 'ArrowDown') { ty -= pan; render(true); }
    else if (k === 'Tab') {
      // Keep focus inside the viewer while it is open.
      var f = box.querySelectorAll('button:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    } else return;
    e.preventDefault();
  });

  // Re-fit on resize or rotation, keeping the current zoom level.
  window.addEventListener('resize', function () {
    if (!box.classList.contains('open') || !natW) return;
    var z = zoom();
    computeFit();
    scale = fit * z;
    render(false);
  });
})();
