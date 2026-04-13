/* ===== SWIPE NAVIGATION ===== */
(function() {
  var _swipeX = 0, _swipeY = 0;
  var TAB_ORDER = ['pageHome','pageCreate','pageIM','pageRegister','pageClients','pageStats','pageHistory'];

  document.addEventListener('touchstart', function(e) {
    _swipeX = e.touches[0].clientX;
    _swipeY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - _swipeX;
    var dy = e.changedTouches[0].clientY - _swipeY;
    var absDx = Math.abs(dx);
    var absDy = Math.abs(dy);

    // 80px threshold, 2:1 angle constraint
    if (absDx < 80 || absDx < absDy * 2) return;

    // Don't swipe if inside a horizontally scrollable container
    var target = e.target;
    while (target && target !== document.body) {
      if (target.scrollWidth > target.clientWidth + 2) return;
      target = target.parentElement;
    }

    var current = document.querySelector('.inv-page-active');
    if (!current) return;
    var idx = TAB_ORDER.indexOf(current.id);
    if (idx < 0) return;

    var next = dx < 0 ? idx + 1 : idx - 1;
    if (next < 0 || next >= TAB_ORDER.length) return;

    switchTab(TAB_ORDER[next]);
  }, { passive: true });
})();

