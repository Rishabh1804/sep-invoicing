/* ===== SWIPE NAVIGATION ===== */
(function() {
  var _swipeX = 0, _swipeY = 0;
  // A swipe moves between the open workspace's views, in its tab row's order, and stops at its ends: never across
  // workspaces (DIRECTION_B; workspace.js holds the order).

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
    // A swipe moves between screens, so it means nothing while a dialog or a print preview is over the screen:
    // switching closed every dialog, a form holding typed work included (the QA sweep, 29 Sep 2026).
    if (navLayerOpen()) return;

    // Don't swipe if inside a horizontally scrollable container
    var target = e.target;
    while (target && target !== document.body) {
      if (target.scrollWidth > target.clientWidth + 2) return;
      target = target.parentElement;
    }

    var view = wsSwipeTarget(dx < 0 ? 1 : -1);
    if (!view) return;

    // A swipe leaves the screen like a tap on the bar does: unsaved work asks first (nav.js).
    // It is a step of the trail as a tap is (navSync runs after a click, a change or a key, and a touch is none of them).
    navLeaveOk().then(function(ok) { if (ok) { wsShowView(view); navSoon(); } });
  }, { passive: true });
})();
