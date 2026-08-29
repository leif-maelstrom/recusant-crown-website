(function () {
  var lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  var img = document.getElementById('lightboxImg');
  var caption = document.getElementById('lightboxCaption');
  var note = document.getElementById('lightboxNote');
  var stage = document.getElementById('lightboxStage');
  var closeBtn = document.getElementById('lightboxClose');
  var zoomInBtn = document.getElementById('zoomIn');
  var zoomOutBtn = document.getElementById('zoomOut');
  var zoomResetBtn = document.getElementById('zoomReset');
  var zoomLabel = document.getElementById('zoomLabel');

  var zoomLevel = 1;
  var ZOOM_STEP = 1.5;
  var MAX_ZOOM = 8;
  var MIN_ZOOM = 0.5;

  function open(src, alt, cap, nte) {
    img.src = src;
    img.alt = alt || '';
    caption.textContent = cap || '';
    note.textContent = nte || '';
    zoomLevel = 1;
    applyZoom();
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
  }

  function close() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    img.src = '';
  }

  function applyZoom() {
    img.style.transform = 'scale(' + zoomLevel + ')';
    if (zoomLabel) zoomLabel.textContent = Math.round(zoomLevel * 100) + '%';
  }

  function zoomIn() {
    zoomLevel = Math.min(zoomLevel * ZOOM_STEP, MAX_ZOOM);
    applyZoom();
  }

  function zoomOut() {
    zoomLevel = Math.max(zoomLevel / ZOOM_STEP, MIN_ZOOM);
    applyZoom();
  }

  function zoomReset() {
    zoomLevel = 1;
    applyZoom();
  }

  document.querySelectorAll('[data-lightbox]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var src = el.getAttribute('data-lightbox-src') || el.src || el.getAttribute('href');
      var alt = el.getAttribute('data-lightbox-alt') || el.alt || '';
      var cap = el.getAttribute('data-lightbox-caption') || '';
      var nte = el.getAttribute('data-lightbox-note') || '';
      open(src, alt, cap, nte);
    });
  });

  closeBtn.addEventListener('click', close);

  // Click on the backdrop closes
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) close();
  });

  // Click on the stage (area around the image) closes too
  stage.addEventListener('click', function (e) {
    if (e.target === stage) close();
  });

  zoomInBtn.addEventListener('click', zoomIn);
  zoomOutBtn.addEventListener('click', zoomOut);
  zoomResetBtn.addEventListener('click', zoomReset);

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === '+' || e.key === '=') zoomIn();
    if (e.key === '-') zoomOut();
    if (e.key === '0') zoomReset();
  });

  stage.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }, { passive: false });
})();
