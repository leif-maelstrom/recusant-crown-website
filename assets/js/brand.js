// Bounce the header crown on hover. The class stays until the bounce
// ends, so moving the mouse away early doesn't cut it short.
(function () {
  document.querySelectorAll('.brand').forEach(function (brand) {
    var crown = brand.querySelector('.brand-crown-inner');
    if (!crown) return;
    brand.addEventListener('mouseenter', function () {
      crown.classList.add('is-bouncing');
    });
    crown.addEventListener('animationend', function () {
      crown.classList.remove('is-bouncing');
    });
  });
})();
