/* ===== NAVIGATION: AN ADDRESS FOR EVERY SCREEN, AND ONE TRAIL BACK =====
   UX overhaul 2, step 1 (owner, 28 Sep 2026: "Backspace goes back through the screens visited, with a trail on screen").
   Moving between screens recorded nothing, so the phone's back gesture left the app from anywhere.

   Where the app is (navLoc) is the page, its view tab or sub-view, and the record open in it: the address
   `?tab=pageIM&v=invoiced/2026-08&id=IM-301`, which a launch or a refresh opens (navApply). Every change of place is a
   step in the browser's own history, so the browser's back, Alt+←, the phone's back gesture, Backspace and the top bar's
   arrow all walk one trail. The step is taken AFTER whatever moved the app (navSync, after a click, a change, a key or
   switchTab), so no screen had to learn about it: a place is read off the screen's own state, never announced.

   An open dialog, the More sheet or a print preview is a LAYER: one history entry over the screen, so back closes it
   (a dialog holding typed work asks first, dialogLeaveOk). Closed any other way, its entry is marked `skip` and back
   passes over it. A form with unsaved work (typed on a screen that shows its Save in the action bar) asks before back
   leaves it. Filters, sorts and pagers are not places: they move nothing in the trail. */

var NAV_TRAIL_KEY = 'sep_inv_nav_trail';   // this tab's trail, kept across a reload (sessionStorage)
var NAV_TRAIL_SHOWN = 3;                    // earlier steps named in the desktop's top bar
var _navIdx = 0;          // this entry's place in the app's own history
var _navHold = 0;         // while applying a place or asking, nothing is recorded
var _navIgnore = 0;       // a history move the app made itself, to put the trail back
var _navTimer = null;
var _navTrail = [];       // _navTrail[idx] = {loc, page, sub} for a place, null for a layer
var _navBooted = false;
var _navCur = null;       // the entry the app is on, as it stood: a popstate only says where it arrived

function navPageOf() {
  var p = document.querySelector('.inv-page-active');
  return p ? p.id : 'pageHome';
}

/* Where the app is: {tab, v, id}. v is the view tab or sub-view (a part after '/' is its month or sub-view),
   id the record open in the desktop's pane (a phone opens a record in a dialog, which is a layer). */
function navLoc() {
  var tab = navPageOf(), v = '', id = '';
  switch (tab) {
    case 'pageIM':
      if (_challanForm) v = 'form';
      else {
        v = _imTab === 'invoiced' ? 'invoiced/' + (imMonthShown() || '') : 'awaiting';
        if (_isDesktop && _imActiveChallanId) id = _imActiveChallanId;
      }
      break;
    case 'pageRegister': if (_isDesktop && _regActiveInvId) id = _regActiveInvId; break;
    case 'pageClients':
      v = getItemsSubView();
      if (_isDesktop && v === 'clients' && _clientsActiveId != null) id = String(_clientsActiveId);
      break;
    case 'pageFinance': v = _finTab; break;
    case 'pageStats': v = statsTab(); break;
    case 'pageProduction':
      // The paste box and its check are one place: back from the check goes where the paste came from.
      // The register photo's check is a place of its own: it shared the page's address, so Back left Production.
      v = _prodTab + (/^(paste|review)$/.test(_prodView) ? '/paste' : _prodView === 'hand' ? '/hand' : _prodView === 'photo' ? '/photo' : '');
      break;
    case 'pagePower': v = _powerTab; break;
    case 'pageStaff': v = _attView; break;
    case 'pageStock':
      v = _stockView === 'review' ? 'paste' : _stockView;
      if (_stockView === 'item' && _stockItemId) id = _stockItemId;
      break;
    case 'pageTodo': v = _todoShowDone ? 'done' : 'open'; break;
  }
  return { tab: tab, v: v || '', id: id || '' };
}
function navKey(loc) { return loc ? loc.tab + '|' + (loc.v || '') + '|' + (loc.id || '') : ''; }
function navUrl(loc) {
  return window.location.pathname + '?tab=' + encodeURIComponent(loc.tab) +
    (loc.v ? '&v=' + encodeURIComponent(loc.v) : '') + (loc.id ? '&id=' + encodeURIComponent(loc.id) : '');
}
function navLocFromUrl(search) {
  var p;
  try { p = new URLSearchParams(search); } catch (e) { return null; }
  var tab = p.get('tab');
  if (!tab || !isPageId(tab)) return null;
  return { tab: tab, v: p.get('v') || '', id: p.get('id') || '' };
}

/* What a place is called: the page, then the view and the record ("Challans", "Invoiced, Aug 2026 · Ch. 301"). */
function _navFind(list, k) { var t = (list || []).find(function(x) { return x[0] === k; }); return t ? t[1] : ''; }
function navLabel(loc) {
  var parts = String(loc.v || '').split('/'), sub = [], rec = '';
  switch (loc.tab) {
    case 'pageIM':
      sub.push(parts[0] === 'form' ? 'New challan' : parts[0] === 'invoiced' ? 'Invoiced, ' + imMonthLabel(parts[1]) : 'Awaiting invoice');
      var im = loc.id && (S.incomingMaterial || []).find(function(m) { return m.id === loc.id; });
      if (im) rec = imChallanLabel(im);
      break;
    case 'pageRegister':
      var inv = loc.id && S.invoices.find(function(i) { return i.id === loc.id; });
      if (inv) rec = 'Invoice ' + String(inv.displayNumber || '').split('/').pop();
      break;
    case 'pageClients':
      sub.push({ clients: 'Clients', items: 'Items', performance: 'Performance' }[parts[0]] || '');
      var c = loc.id && S.clients.find(function(x) { return String(x.id) === loc.id; });
      if (c) rec = c.name;
      break;
    case 'pageFinance': sub.push(_navFind(FIN_TABS, parts[0])); break;
    case 'pageStats': sub.push(_navFind(STATS_TABS, parts[0])); break;
    case 'pageProduction': sub.push(_navFind(PROD_TABS, parts[0])); sub.push({ paste: 'Paste message', hand: 'Enter by hand', photo: 'Register photo' }[parts[1]] || ''); break;
    case 'pagePower': sub.push(_navFind(POWER_TABS, parts[0])); break;
    case 'pageStaff': sub.push(parts[0] === 'paste' ? 'Paste message' : _navFind(ATT_VIEWS, parts[0])); break;
    case 'pageStock':
      sub.push({ overview: 'Overview', list: 'Lines', item: 'Lines', paste: 'Paste message', manual: 'Enter by hand', reorder: 'Reorder list' }[parts[0]] || '');
      var it = loc.id && stockItem(loc.id);
      if (it) rec = it.name;
      break;
    case 'pageTodo': sub.push(parts[0] === 'done' ? 'Done' : 'Open'); break;
  }
  if (rec) sub.push(rec);
  return { page: PAGE_TITLES[loc.tab] || 'SEP Invoicing', sub: sub.filter(Boolean).join(' · ') };
}

/* Puts the app where loc says. Every screen's own setters, then one draw; the record last, once the list exists. */
function navApply(loc) {
  _navHold++;
  try {
    var tab = loc && isPageId(loc.tab) ? loc.tab : 'pageHome';
    var parts = String((loc && loc.v) || '').split('/'), id = (loc && loc.id) || '';
    var before = navLoc(), same = tab === before.tab;
    closeOverlay(); closePrintPreview(); closeMoreSheet();
    switch (tab) {
      case 'pageIM':
        if (parts[0] !== 'form') {
          if (_challanForm) cancelAddChallan();
          imSetTab(parts[0] === 'invoiced' ? 'invoiced' : 'awaiting', parts[0] === 'invoiced' ? (parts[1] || null) : undefined);
        }
        break;
      case 'pageClients': setItemsSubView(/^(clients|items|performance)$/.test(parts[0]) ? parts[0] : 'clients'); break;
      case 'pageFinance': finSetTab(parts[0]); _bankEdit = null; break;
      case 'pageStats': try { localStorage.setItem(STATS_TAB_KEY, parts[0] || 'overview'); } catch (e) { /* per device only */ } break;
      case 'pageProduction': prodSetTab(parts[0]); _prodView = parts[1] === 'paste' || parts[1] === 'hand' || parts[1] === 'photo' ? parts[1] : 'main'; break;
      case 'pagePower': powerSetTab(parts[0]); break;
      case 'pageStaff': _attView = parts[0] === 'paste' || ATT_VIEWS.some(function(x) { return x[0] === parts[0]; }) ? parts[0] : 'overview'; break;
      case 'pageStock':
        var sv = /^(overview|list|item|paste|manual|reorder)$/.test(parts[0]) ? parts[0] : 'overview';
        if (sv === 'item' && !(id && stockItem(id))) sv = 'list';
        if (sv === 'item') _stockItemId = id;
        _stockView = sv;
        break;
      case 'pageTodo': _todoShowDone = parts[0] === 'done'; break;
    }
    if (!same) switchTab(tab);
    else {
      tabRender(tab, true);
      if (before.v !== ((loc && loc.v) || '')) viewTop();   // another view is a navigation; another record is not
    }
    // The record, now that its list is drawn. Gone since (deleted, filtered away): the pane stays shut.
    if (_isDesktop) {
      if (tab === 'pageRegister') _renderRegDetail(id && S.invoices.some(function(i) { return i.id === id; }) ? id : null);
      if (tab === 'pageIM' && parts[0] !== 'form') {
        var im = id && (S.incomingMaterial || []).find(function(m) { return m.id === id; });
        if (im) imShowChallanTab(im);
        _renderIMDetail(im ? id : null);
      }
      if (tab === 'pageClients' && getItemsSubView() === 'clients') {
        var cid = id !== '' && S.clients.some(function(c) { return String(c.id) === id; }) ? S.clients.find(function(c) { return String(c.id) === id; }).id : null;
        if (cid != null) _renderClientDetail(cid, false); else if (_clientsActiveId != null) closeClientsPane();
      }
    }
    // Forward into a new challan: the form, empty (what was typed there was left behind).
    if (tab === 'pageIM' && parts[0] === 'form' && !_challanForm) showAddChallanForm();
    markSideActive(tab);
  } finally {
    _navHold--;
  }
  var now = navLoc(), st = history.state;
  if (st && st.sep) { history.replaceState(Object.assign({}, st, { loc: now }), '', navUrl(now)); _navCur = history.state; }
  navTrailPut(now);
  navBarDraw();
}

/* ---------- Recording ---------- */
function navLayerOpen() { return !!document.querySelector('.inv-scrim-dialog, #moreSheet, .inv-print-view-active'); }
function navState(loc, extra) { return Object.assign({ sep: 1, idx: _navIdx, loc: loc }, extra || {}); }
function navTrailPut(loc) {
  _navTrail.length = _navIdx + 1;
  _navTrail[_navIdx] = loc ? Object.assign({ loc: loc }, navLabel(loc)) : null;
  try { sessionStorage.setItem(NAV_TRAIL_KEY, JSON.stringify(_navTrail)); } catch (e) { /* a convenience only */ }
}
function navPush(loc, extra) {
  _navIdx++;
  history.pushState(navState(loc, extra), '', navUrl(loc));
  navTrailPut(extra && extra.layer ? null : loc);
}

/* Takes the step, if the app moved: a new place is pushed; a layer that opened gets its entry; a layer that shut
   without back marks its entry to be passed over. */
function navSync() {
  _navTimer = null;
  // A book another window saved while this one was busy (a dialog open, a form typed) is drawn as soon as it is not:
  // the toast promised it, and nothing drew it before the next screen (the QA sweep, 29 Sep 2026).
  if (_bookRedrawPending && !bookBusy()) { _bookRedrawPending = false; tabRedrawActive(); }
  if (_navHold || _navIgnore || !_navBooted) return;
  var st = history.state, loc = navLoc(), layer = navLayerOpen();
  if (!st || !st.sep) { history.replaceState(navState(loc), '', navUrl(loc)); _navCur = history.state; navTrailPut(loc); navBarDraw(); return; }
  if (st.layer && !layer) history.replaceState(Object.assign({}, st, { layer: false, skip: true }), '', window.location.href);
  _navCur = history.state;
  if (navKey(history.state.loc) !== navKey(loc)) navPush(loc);
  if (layer && !history.state.layer) navPush(loc, { layer: true });
  _navCur = history.state;
  navBarDraw();
}
function navSoon() {
  if (_navTimer || !_navBooted) return;
  _navTimer = setTimeout(navSync, 0);
}

/* Leaving a form with unsaved work asks first. A form is a screen showing its Save in the sticky action bar: the challan
   form, Stock's and Production's paste checks and hand entry, the register photo's check. Create is not asked for: its
   form stays as typed when the app leaves it, and is there on coming back. */
function navFormDirty() {
  return !!_pageTyped && navPageOf() !== 'pageCreate' && !!document.querySelector('.inv-page-active .inv-actionbar');
}
function navLeaveOk() {
  if (!navFormDirty()) return Promise.resolve(true);
  return uiConfirm({ title: 'Leave without saving?', body: 'What you typed on this screen has not been saved. Stay to finish and save it, or leave it.',
    okLabel: 'Leave', cancelLabel: 'Stay', danger: true }).then(function(ok) { if (ok) _pageTyped = false; return ok; });
}

/* A tap that leaves the screen: the phone bar, the sidebar, the More sheet, a view tab, a sub-view's back button. With
   unsaved work on screen it asks first (owner, 29 Sep 2026: "that's a real bug" — only the browser's Back asked, and a
   tap on another screen dropped a half-typed challan). On Leave the same tap runs again with nothing typed left to lose.
   Caught before events.js sees it (capture), so the screen is never left and then asked about. */
var NAV_LEAVE_ACTIONS = { invSwitchTab: 1, invSideGo: 1, invStockBack: 1, invProdBack: 1, invProdHandDone: 1, invAttView: 1, invDashStockView: 1 };
function navIsLeave(el) {
  // A tab inside a dialog moves within the dialog, not off the screen.
  return !!(el && el.dataset && !el.closest('.inv-scrim-dialog') && (NAV_LEAVE_ACTIONS[el.dataset.action] || el.getAttribute('role') === 'tab'));
}
document.addEventListener('click', function(e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
  if (!navIsLeave(el) || !navFormDirty()) return;
  e.preventDefault();
  e.stopPropagation();
  _navHold++;
  navLeaveOk().then(function(ok) {
    _navHold--;
    if (ok && el.isConnected) el.click();
  });
}, true);

/* Back over a layer: the top one closes, a dialog holding typed work asking first. */
function navCloseLayer() {
  var dialogs = document.querySelectorAll('.inv-scrim-dialog');
  if (dialogs.length) {
    var top = dialogs[dialogs.length - 1];
    // Settings asks in its own words, naming the sections not saved.
    if (top.id === 'settingsScrim') return closeSettings();
    return dialogLeaveOk(top).then(function(ok) { if (ok) dialogCloseScrim(top); });
  }
  if (document.querySelector('.inv-print-view-active')) closePrintPreview();
  else closeMoreSheet();
  return Promise.resolve();
}

window.addEventListener('popstate', function(e) {
  var st = e.state;
  if (!st || !st.sep || !_navBooted) return;
  var from = _navIdx, dir = st.idx < from ? -1 : 1, left = _navCur;
  _navIdx = st.idx;
  _navCur = st;
  if (_navIgnore) { _navIgnore--; navBarDraw(); return; }
  if (dir < 0 && navLayerOpen()) { navCloseLayer().then(navSoon); return; }
  // Leaving a shut layer's entry for the place it was over: that place is where the app already is, so go on.
  if (left && left.skip && !st.skip && !st.layer && navKey(st.loc) === navKey(navLoc()) && st.idx > 0) { history.go(dir); return; }
  if (st.skip || st.layer) {
    // A layer already shut: pass over it, the way the move was going.
    history.go(dir);
    setTimeout(function() { if (_navIdx === st.idx) navArrive(st, from); }, 120);
    return;
  }
  navArrive(st, from);
});
function navArrive(st, from) {
  if (navKey(st.loc) === navKey(navLoc())) { navBarDraw(); return; }
  _navHold++;
  navLeaveOk().then(function(ok) {
    if (ok) { _navHold--; navApply(st.loc); return; }
    // Stay: the browser is put back on the form's entry. Nothing is recorded until it gets there.
    _navHold--;
    _navIgnore++;
    history.go(from - _navIdx);
    setTimeout(function() { _navIgnore = 0; navSoon(); }, 400);
  });
}
function navCanBack() { return _navIdx > 0; }
function navBack() { if (navCanBack()) history.back(); }
function navGoTo(idx) { if (idx >= 0 && idx < _navIdx) history.go(idx - _navIdx); }

/* ---------- The top bar: the arrow, and on the desktop the trail ---------- */
function navBarDraw() {
  var back = document.getElementById('navBack'), trail = document.getElementById('navTrail'), ctx = document.getElementById('topbarCtx');
  if (back) back.hidden = !navCanBack();
  var cur = _navTrail[_navIdx] || (history.state && history.state.loc ? Object.assign({ loc: history.state.loc }, navLabel(history.state.loc)) : null);
  // The view and the record beside the page's name, on the desktop (the phone's bar has no room).
  if (ctx) ctx.textContent = _isDesktop && cur ? cur.sub : '';
  if (!trail) return;
  if (!_isDesktop) { trail.innerHTML = ''; return; }
  var steps = [];
  for (var i = _navIdx - 1; i >= 0 && steps.length < NAV_TRAIL_SHOWN; i--) {
    var t = _navTrail[i];
    if (!t) continue;
    var prev = steps.length ? steps[steps.length - 1].t : cur;
    if (prev && navKey(prev.loc) === navKey(t.loc)) continue;
    steps.push({ i: i, t: t });
  }
  // A step on the same page as the one after it names only its view and record: "Stats · Overview › Awaiting invoice ›".
  steps.reverse();
  trail.innerHTML = steps.map(function(s, k) {
    var next = k + 1 < steps.length ? steps[k + 1].t : cur, name = s.t.page + (s.t.sub ? ' · ' + s.t.sub : '');
    var text = next && next.loc && next.loc.tab === s.t.loc.tab && s.t.sub ? s.t.sub : name;
    return '<button type="button" class="inv-btn-link" data-action="invNavGo" data-to="' + s.i + '" title="' + escHtml(name) + '">' + escHtml(text) + '</button><span aria-hidden="true">›</span>';
  }).join('');
}

/* ---------- Doing ---------- */
function navAction(action, btn) {
  if (action === 'invNavBack') { navBack(); return true; }
  if (action === 'invNavGo') { navGoTo(+btn.dataset.to); return true; }
  return false;
}

// Whatever a click, a change or a key did, the step is taken after it.
document.addEventListener('click', navSoon);
document.addEventListener('change', navSoon);
document.addEventListener('keyup', navSoon);
// A dialog or sheet opened later (after a question was answered, a file read) is a layer too.
new MutationObserver(navSoon).observe(document.body, { childList: true });

/* Backspace goes back when no field has focus (owner, 28 Sep 2026), and from the field the APP focused on arriving at a
   screen (switchTab's step 8: the search on the Register, History, Create) while it is still empty and nobody has typed in
   it or left it since: arriving there, Backspace did nothing (the QA audit of 30 Sep 2026). Once typed in, even emptied
   again, its Backspace is the field's. */
var _navArrivalField = null;
function navArrived() {
  var a = document.activeElement;
  _navArrivalField = a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && !a.value ? a : null;
}
document.addEventListener('input', function(e) { if (e.target === _navArrivalField) _navArrivalField = null; }, true);
document.addEventListener('focusout', function(e) { if (e.target === _navArrivalField) _navArrivalField = null; }, true);
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Backspace' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
  var t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && !(t === _navArrivalField && !t.value)) return;
  if (!navCanBack()) return;
  e.preventDefault();
  navBack();
});

/* At the end of boot: this tab's trail back from sessionStorage, the address the app was opened at applied (a view or a
   record; the page itself the tab restore already opened), and the entry written. */
function navBoot(launch) {
  var st = history.state;
  try { var saved = JSON.parse(sessionStorage.getItem(NAV_TRAIL_KEY) || '[]'); if (Array.isArray(saved)) _navTrail = saved; } catch (e) { _navTrail = []; }
  if (st && st.sep && typeof st.idx === 'number') _navIdx = st.idx;
  else { _navIdx = 0; _navTrail = []; }
  _navBooted = true;
  // A reload keeps its address even where another window has since moved the saved tab.
  if (launch && (launch.v || launch.id || launch.tab !== navPageOf())) navApply(launch);
  var loc = navLoc();
  history.replaceState(navState(loc), '', navUrl(loc));
  _navCur = history.state;
  navTrailPut(loc);
  navBarDraw();
}
