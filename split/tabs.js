/* ===== TAB SWITCHING (DP v0.2 9-step) ===== */
const PAGE_TITLES = {
  pageHome: 'Home', pageCreate: 'Create invoice', pageIM: 'Challans', pageRegister: 'Register',
  pageClients: 'Clients', pageFinance: 'Finance', pageTodo: 'To-do', pageProduction: 'Production', pagePower: 'Power', pageStock: 'Stock', pageStaff: 'Staff',
  pageStats: 'Stats', pageReports: 'Reports', pageHistory: 'History',
  pagePipeline: 'Pipeline'
};

/* A page is one of PAGE_TITLES' keys. An address or a remembered tab naming anything else (another element, a page another
   build had) opens Home and is never remembered: ?tab=topbarTitle drew a blank page, and every launch after reopened it
   (the QA audit of 30 Sep 2026). */
function isPageId(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PAGE_TITLES, id) && !!document.getElementById(id);
}

function switchTab(tabId) {
  if (!isPageId(tabId)) tabId = 'pageHome';
  // Step 1: Dismiss toasts and close overlays
  document.querySelectorAll('.inv-toast').forEach(t => t.remove());
  closeOverlay();
  closePrintPreview();
  closeMoreSheet();

  // Step 1b: Drain focus stack without focusing (DP v0.2 Section 8)
  drainFocusStack();

  // Step 2: Capture scroll position of departing tab
  const currentPage = document.querySelector('.inv-page-active');
  if (currentPage) {
    _tabScroll[currentPage.id] = currentPage.scrollTop || window.scrollY;
  }

  // Another page is a navigation: a keepScroll around whatever called this does not hold the old place (P79).
  _viewTopAt++;

  // Step 3: Deactivate all tabs and pages
  document.querySelectorAll('.inv-page').forEach(p => p.classList.remove('inv-page-active'));
  document.querySelectorAll('.inv-navbar-item').forEach(t => t.classList.remove('inv-navbar-item-on'));

  // Step 4: Read and clear _navReturnTab
  const returnTab = _navReturnTab;
  _navReturnTab = null;

  // Step 5: Activate target page and tab
  const page = document.getElementById(tabId);
  if (page) page.classList.add('inv-page-active');
  document.querySelectorAll('.inv-navbar-item').forEach(t => {
    if (t.dataset.tab === tabId) t.classList.add('inv-navbar-item-on');
  });
  // To-do, Finance, Stock, Staff, Stats and History live behind More on the phone bar.
  document.querySelectorAll('.inv-navbar-more').forEach(t => t.classList.toggle('inv-navbar-item-on', MORE_TABS.indexOf(tabId) >= 0));
  // The top bar names the screen (§4); the desktop sidebar marks it.
  const title = document.getElementById('topbarTitle');
  if (title) title.textContent = PAGE_TITLES[tabId] || 'SEP Invoicing';
  markSideActive(tabId);

  // Step 6: Check dirty flag and re-render if needed
  const tabKey = tabId === 'pageHome' ? 'home' : tabId === 'pageRegister' ? 'register' : null;
  const isDirty = tabKey ? _tabDirty[tabKey] : true;
  _pageTyped = false;
  _bookRedrawPending = false;
  // Step 6b: remembered for a reload only once it has been drawn (Phase 6b). It was saved before the drawing, so a
  // screen that threw on some shape of data was reopened, and threw, at every launch, with the app never finishing its
  // start (the QA sweep, 29 Sep 2026). A screen that cannot be drawn says so and the rest of the app stays in reach.
  try {
    tabRender(tabId, isDirty);
    regFilter.activeTab = tabId;
    saveRegFilter();
  } catch (err) {
    console.error(err);
    uiNotice('The ' + (PAGE_TITLES[tabId] || 'screen') + ' screen could not be drawn: ' + ((err && err.message) || err) +
      '. The rest of the app works; export a backup from Settings if this keeps happening.', 'danger');
  }

  // Step 7: Scroll restoration
  if (returnTab) {
    // Edit-return: restore scroll position
    const saved = _tabScroll[tabId];
    if (saved != null) {
      window.scrollTo(0, saved);
    }
  } else if (isDirty) {
    // New data: scroll to top
    window.scrollTo(0, 0);
  } else {
    // Clean reveal: restore saved position
    const saved = _tabScroll[tabId];
    if (saved != null) {
      window.scrollTo(0, saved);
    }
  }

  // Step 8: Focus first interactive element in target tab
  var targetPage = document.getElementById(tabId);
  // Where a keyboard continues from; on a touch screen never a field, which raised the keyboard over every screen
  // opened whose first control was a search (the QA sweep, 29 Sep 2026).
  if (targetPage) focusFirstInteractive(targetPage, { noText: touchScreen() });
  navArrived();
}

/* Draws one page from S (switchTab's step 6). Also what another window's save redraws, in place (tabRedrawActive). */
function tabRender(tabId, isDirty) {
  if (tabId === 'pageHome') {
    if (isDirty) { renderHome(); _tabDirty.home = false; }
  } else if (tabId === 'pageRegister') {
    if (_isDesktop) {
      renderRegisterTable();
      _tabDirty.register = false;
    } else {
      if (!_regToolbarRendered) {
        renderRegisterToolbar();
        _regToolbarRendered = true;
      }
      if (isDirty) { renderRegisterList(); _tabDirty.register = false; }
    }
  } else if (tabId === 'pageClients') {
    renderClientsPage();
  } else if (tabId === 'pageIM') {
    // Cancel any in-progress challan form
    if (_challanForm) cancelAddChallan();
    if (_isDesktop) {
      renderIMTable();
    } else {
      if (!_imToolbarRendered) {
        renderIMToolbar();
        _imToolbarRendered = true;
      }
      renderIMList();
    }
  } else if (tabId === 'pagePipeline') {
    renderPipeline();
  } else if (tabId === 'pageCreate') {
    if (!document.getElementById('createFormArea').innerHTML) initCreateForm();
  } else if (tabId === 'pageProduction') {
    renderProduction();
  } else if (tabId === 'pagePower') {
    renderPower();
  } else if (tabId === 'pageStock') {
    renderStock();
  } else if (tabId === 'pageTodo') {
    renderTodo();
  } else if (tabId === 'pageStaff') {
    renderAttendance();
  } else if (tabId === 'pageFinance') {
    renderFinance();
  } else if (tabId === 'pageStats') {
    renderStats();
  } else if (tabId === 'pageReports') {
    renderReports();
  } else if (tabId === 'pageHistory') {
    renderHistory();
  }
}

/* The page on screen, drawn again from S where it stands: the page, its panes and dialogs keep their scroll. */
function tabRedrawActive() {
  var page = document.querySelector('.inv-page-active');
  if (!page) return;
  keepScroll(function() { tabRender(page.id, true); });
  if (typeof updateStockBadge === 'function') updateStockBadge();
}

/* ===== HOME ===== */
/* The quick actions: each opens its tab already on the job — the form open,
   the box focused — rather than on the tab's front page. */
function homeQuick(go) {
  if (go === 'challan') { switchTab('pageIM'); showAddChallanForm(); }
  else if (go === 'stock') { switchTab('pageStock'); stockOpenManual(); }
  else if (go === 'attendance') { _attView = 'day'; _attDate = localDateStr(); switchTab('pageStaff'); }
  else if (go === 'paste') relayOpen();
  else if (go === 'task') {
    _todoShowDone = false;  // the add field is on the Open tab
    switchTab('pageTodo');
    var inp = document.getElementById('todoNew');
    if (inp) inp.focus();
  }
}

/* A status is one of five tone words (design principles §6.13); the modules keep their own. */
var UI_TONE = { red: 'danger', amber: 'warning', info: 'info', green: 'ok' };
/* Status as a dot and a word (§6.13, DR-8). `word` is HTML: the caller escapes what came from the user. */
function uiDot(tone, word) { return '<span class="inv-dot inv-dot-' + uiTone(tone) + '">' + word + '</span>'; }
function uiTone(t) { return UI_TONE[t] || (/^(danger|warning|ok|info|neutral)$/.test(t) ? t : 'neutral'); }

var ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
var ICON_CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>';
var ICON_PRINT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

/* Home's stat strip: the month so far, with the tonnage behind the revenue (What Stats measures). */
function renderHomeTiles(active) {
  var set = function(id, html) { var e = document.getElementById(id); if (e) e.innerHTML = html; };
  var w = weighLines(active);
  // The app's own month names ('Sep'); en-IN's locale string reads 'Sept'.
  var month = TREND_MONTH_LABELS[new Date().getMonth()];
  set('mtdCount', String(active.length));
  set('mtdCountSub', escHtml(month) + ' to date');
  set('mtdRevenue', figWrapHtml(formatCurrency(sumTaxable(active))));
  // Net of credit notes, as Stats is (owner, 30 Sep 2026: "yes, it should and it should be mentioned").
  var credited = gstRound(active.reduce(function(s, i) { return s + (i._credit || 0); }, 0));
  set('mtdRevenueSub', credited > 0.005 ? 'taxable, net of ' + escHtml(formatCurrency(credited)) + ' in credit notes' : 'taxable, net of credit notes');
  // Two places, as Stats shows it: one place read 40 kg as '0.0 t'.
  set('mtdKg', w.kg > 0 ? formatNum(w.kg / 1000, 2) + ' t' : '&mdash;');
  set('mtdKgSub', w.kg > 0 ? Math.round(w.kg).toLocaleString('en-IN') + ' kg' : 'nothing weighed yet');
  set('mtdPerKg', w.kg > 0 ? figWrapHtml(formatCurrency(w.revKnown / w.kg)) + '<span class="inv-tile-of">/kg</span>' : '&mdash;');
  // A partial figure always reads better than the blend: the unweighed lines are the piece-billed end.
  // "All" only when nothing priced is unweighed, and a partial share never rounds up to 100%.
  set('mtdPerKgSub', !(w.kg > 0) ? '&nbsp;' : w.revUnknown < 0.005 ? 'all revenue weighed'
    : 'on the ' + Math.min(99, Math.round(w.coverage * 100)) + '% of revenue weighed');

  // Whether each is good (owner, 29 Sep 2026): against the same days last month, and realisation against the month's
  // live cost, the cost Stats judges it by.
  var p = homePriorSameDays(), pw = weighLines(p.invoices), lbl = 'same days last month';
  var real = w.kg > 0 ? w.revKnown / w.kg : null, preal = pw.kg > 0 ? pw.revKnown / pw.kg : null;
  var has = p.invoices.length > 0;
  set('mtdCountDelta', has ? figDeltaHtml(active.length, p.invoices.length, lbl, null) : '');
  set('mtdRevenueDelta', has ? figDeltaHtml(sumTaxable(active), sumTaxable(p.invoices), lbl, 'up') : '');
  set('mtdKgDelta', has && w.kg > 0 && pw.kg > 0 ? figDeltaHtml(w.kg, pw.kg, lbl, 'up') : '');
  var cost = null;
  if (real != null) { try { var lc = liveCost(p.monthStart, localDateStr(), w.kg); cost = lc && lc.perKg > 0 ? lc.perKg : null; } catch (e) { cost = null; } }
  if (cost == null && S.defaultCostPerKg > 0) cost = S.defaultCostPerKg;
  var tone = real != null && cost != null ? figToneAgainst(real, cost, 5) : null;
  var tileEl = document.getElementById('mtdPerKgTile');
  if (tileEl) tileEl.className = 'inv-tile' + (tone ? ' inv-tile-' + tone : '');
  // Only what there is, joined: with nothing weighed on the same days last month the line ended on a bare " · ".
  set('mtdPerKgDelta', real == null ? '' : [cost != null ? (real >= cost ? 'clears' : 'below') + ' cost ' + formatCurrency(cost) : '',
    preal != null ? figDeltaHtml(real, preal, lbl, 'up') : ''].filter(Boolean).join(' · '));
}

/* Last month's invoices over the same days this month has run (the 1st to today's date, capped at last month's length),
   and this month's first day: the fair comparison part-way through a month. */
function homePriorSameDays() {
  var t = new Date(), y = t.getFullYear(), m = t.getMonth(), d = t.getDate();
  var py = m === 0 ? y - 1 : y, pm = m === 0 ? 11 : m - 1, plen = new Date(py, pm + 1, 0).getDate();
  var pad = function(n) { return String(n).padStart(2, '0'); };
  var from = py + '-' + pad(pm + 1) + '-01', to = py + '-' + pad(pm + 1) + '-' + pad(Math.min(d, plen));
  return { from: from, to: to, monthStart: y + '-' + pad(m + 1) + '-01',
    invoices: statsInvoices().filter(function(i) { return i.date && i.date >= from && i.date <= to; }) };
}

function renderHome() {
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  // The month's invoices net of their credit notes (statsInvoices), so Home and Stats read one revenue.
  const active = statsInvoices().filter(i => i.date && i.date.startsWith(ym));
  renderHomeTiles(active);

  renderZincCard();
  renderFinHomeCard();
  renderTodoHomeCard();
  renderAttHomeCard();
  updateStockBadge();
  ghRenderCard();
  homeApplyLayout();

  var unbilledEl = document.getElementById('homeUnbilledCard');
  if (unbilledEl) {
    var pendingChallans = 0, pendingAmount = 0, pendingItemCount = 0, latestChallan = null;
    (S.incomingMaterial || []).forEach(function(im) {
      var hasPending = false;
      im.items.forEach(function(it) {
        if (!it.invoiced) { hasPending = true; pendingAmount += imLineOpen(it).amount; pendingItemCount++; }
      });
      if (hasPending) pendingChallans++;
      if (!latestChallan || (im.createdAt || 0) > (latestChallan.createdAt || 0)) latestChallan = im;
    });
    if (pendingChallans > 0 || latestChallan) {
      var ub = '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">Unbilled material</span>' +
        '<button class="inv-btn-link" data-action="invSwitchTab" data-tab="pageIM">View challans</button></div>';
      if (pendingChallans > 0) {
        ub += '<div class="inv-tiles inv-tiles-flush">' +
          '<div class="inv-tile"><div class="inv-tile-label">Pending challans</div><div class="inv-tile-value">' + pendingChallans + '</div>' +
          '<div class="inv-tile-sub">' + pendingItemCount + ' item' + (pendingItemCount === 1 ? '' : 's') + ' awaiting invoicing</div></div>' +
          '<div class="inv-tile"><div class="inv-tile-label">Pending amount</div><div class="inv-tile-value">' + figWrapHtml(formatCurrency(pendingAmount)) + '</div>' +
          '<div class="inv-tile-sub">at the challans&rsquo; rates</div></div></div>';
      } else {
        ub += '<div class="inv-row"><span class="inv-row-main"><span class="inv-dot inv-dot-ok">All items invoiced</span></span></div>';
      }
      if (latestChallan) {
        ub += '<div class="inv-row"><span class="inv-row-main"><span class="inv-row-meta">Latest</span>' +
          '<span class="inv-row-title"><span class="inv-id">' + (latestChallan.challanNo ? 'Ch. ' + escHtml(latestChallan.challanNo) : 'No number') + '</span> ' +
          escHtml(latestChallan.clientName) + '</span></span><span class="inv-row-end inv-row-meta">' + escHtml(formatDate(latestChallan.challanDate)) + '</span></div>';
      }
      unbilledEl.innerHTML = ub + '</div>';
    } else {
      unbilledEl.innerHTML = '';
    }
  }

  const recent = [...S.invoices].sort((a,b) => (b.createdAt||0) - (a.createdAt||0)).slice(0, 10);
  const el = document.getElementById('recentInvoices');
  if (recent.length === 0) {
    el.innerHTML = '<div class="inv-empty">' +
      '<svg class="inv-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>' +
      '<div>No invoices yet</div>' +
      '<button class="inv-btn inv-btn-secondary" data-action="invCreateNew">Create your first invoice</button>' +
      '</div>';
    return;
  }
  el.innerHTML = recent.map(inv => {
    return '<div class="inv-row inv-row-2' + (inv.status === 'cancelled' ? ' inv-row-muted' : '') + '">' +
      '<button class="inv-row-main" data-action="invViewInvoiceDetail" data-id="' + escHtml(inv.id) + '">' +
      '<span class="inv-row-title inv-id">' + escHtml(inv.displayNumber) + '</span>' +
      // The date leads: after a long client name it was the part cut off.
      '<span class="inv-row-meta">' + escHtml(formatDate(inv.date)) + ' &middot; ' + escHtml(inv.clientName) + '</span></button>' +
      '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + formatCurrency(inv.grandTotal) + '</span>' + getStateBadgeHtml(inv) + '</span>' +
      '<button class="inv-btn inv-btn-icon" data-action="invPreviewInvoice" data-id="' + escHtml(inv.id) + '" aria-label="Print">' + ICON_PRINT + '</button></span></div>';
  }).join('');
}


/* ===== HOME, AS THE OWNER ARRANGES IT =====
   Owner, 30 Sep 2026: "Home screen needs an overhaul with an option to select what widget to show on the home screen and
   where: a dynamic home screen which user can adjust." They chose presets and an edit mode, kept per device (the phone
   and the PC each keep their own Home, like the theme; a backup or a pull never rearranges another device).

   Every card on Home is a widget (`data-home-w`). A layout is {preset, order, hidden, wide}: the order the widgets stand
   in, which are hidden, and which take the page's width on the desktop (half otherwise; the phone is one column). A preset
   is a starting layout; Edit Home shows each widget with a switch, up and down, and half or full. */
var HOME_LAYOUT_KEY = 'sep_inv_home';
var HOME_WIDGETS = [
  ['mtd', 'Month to date'], ['quick', 'Quick actions'], ['money', 'Money'], ['todo', 'To-do'], ['attendance', 'Attendance'],
  ['unbilled', 'Unbilled material'], ['production', 'Production'], ['power', 'Power cuts'], ['stock', 'Stock running low'],
  ['sync', 'GitHub sync'], ['zinc', 'Zinc rate'], ['recent', 'Recent invoices']
];
var HOME_PRESETS = {
  owner: { label: 'Owner', order: ['mtd', 'quick', 'money', 'todo', 'attendance', 'unbilled', 'sync', 'zinc', 'recent', 'production', 'power', 'stock'],
    hidden: ['production', 'power', 'stock'], wide: ['mtd', 'quick', 'recent'] },
  floor: { label: 'Floor', order: ['quick', 'attendance', 'production', 'stock', 'power', 'todo', 'unbilled', 'mtd', 'money', 'recent', 'sync', 'zinc'],
    hidden: ['mtd', 'money', 'recent', 'sync', 'zinc'], wide: ['quick'] },
  money: { label: 'Money', order: ['mtd', 'money', 'unbilled', 'recent', 'todo', 'zinc', 'quick', 'attendance', 'production', 'power', 'stock', 'sync'],
    hidden: ['quick', 'attendance', 'production', 'power', 'stock', 'sync'], wide: ['mtd', 'recent'] }
};
var _homeEdit = false;
function homePresetLayout(k) {
  var p = HOME_PRESETS[k] || HOME_PRESETS.owner, hid = {}, wide = {};
  p.hidden.forEach(function(x) { hid[x] = true; });
  p.wide.forEach(function(x) { wide[x] = true; });
  return { preset: HOME_PRESETS[k] ? k : 'owner', order: p.order.slice(), hidden: hid, wide: wide };
}
function homeLayout() {
  var l = null;
  try { l = JSON.parse(localStorage.getItem(HOME_LAYOUT_KEY) || 'null'); } catch (e) { l = null; }
  if (!l || !Array.isArray(l.order)) return homePresetLayout('owner');
  // A widget added since the layout was saved joins at the end, hidden, so a new build never rearranges a Home.
  HOME_WIDGETS.forEach(function(w) { if (l.order.indexOf(w[0]) < 0) { l.order.push(w[0]); (l.hidden = l.hidden || {})[w[0]] = true; } });
  l.order = l.order.filter(function(k) { return HOME_WIDGETS.some(function(w) { return w[0] === k; }); });
  l.hidden = l.hidden || {}; l.wide = l.wide || {};
  return l;
}
function homeLayoutSave(l) {
  try { localStorage.setItem(HOME_LAYOUT_KEY, JSON.stringify(l)); } catch (e) { /* a per-device convenience only */ }
}
/* The layout onto the page: each widget moved to its place, hidden or shown, full or half. */
function homeApplyLayout() {
  var host = document.getElementById('homeWidgets');
  if (!host) return;
  var l = homeLayout();
  renderHomeExtraCards();
  l.order.forEach(function(k) {
    var el = host.querySelector('[data-home-w="' + k + '"]');
    if (!el) return;
    host.appendChild(el);
    el.classList.toggle('inv-hidden', !!l.hidden[k]);
    el.classList.toggle('inv-panels-wide', !!l.wide[k]);
  });
  var area = document.getElementById('homeEditArea'), bar = document.getElementById('homeEditBar');
  if (area) area.innerHTML = _homeEdit ? homeEditHtml(l) : '';
  if (bar) bar.classList.toggle('inv-hidden', _homeEdit);
}
function homeEditHtml(l) {
  var name = {}; HOME_WIDGETS.forEach(function(w) { name[w[0]] = w[1]; });
  var h = '<div class="inv-panel inv-panel-flush" id="homeEdit" data-nodirty><div class="inv-panel-head"><span class="inv-panel-title">Edit Home</span>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invHomeEditDone">Done</button></div>' +
    '<div class="inv-panel-body"><div class="inv-field-label">Start from</div><div class="inv-seg" role="group" aria-label="Preset">' +
    Object.keys(HOME_PRESETS).map(function(k) { return '<button class="inv-seg-btn" data-action="invHomePreset" data-preset="' + k + '" aria-pressed="' + (l.preset === k) + '">' + HOME_PRESETS[k].label + '</button>'; }).join('') +
    '</div><div class="inv-note inv-mt-8">' + (l.preset === 'custom' ? 'Your own arrangement. ' : '') + 'Kept on this device only. Half or full is the width on a wide screen; a phone shows one column.</div></div>';
  l.order.forEach(function(k, i) {
    var on = !l.hidden[k];
    h += '<div class="inv-row' + (on ? '' : ' inv-row-muted') + '" data-home-edit="' + k + '"><label class="inv-row-lead inv-row-tick"><input type="checkbox" class="inv-check" data-home-show="' + k + '"' + (on ? ' checked' : '') + ' aria-label="Show ' + escHtml(name[k]) + '"></label>' +
      '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(name[k]) + '</span></span><span class="inv-row-end">' +
      '<span class="inv-seg" role="group" aria-label="Width of ' + escHtml(name[k]) + '">' +
      '<button class="inv-seg-btn" data-action="invHomeWide" data-w="' + k + '" data-v="0" aria-pressed="' + !l.wide[k] + '">Half</button>' +
      '<button class="inv-seg-btn" data-action="invHomeWide" data-w="' + k + '" data-v="1" aria-pressed="' + !!l.wide[k] + '">Full</button></span>' +
      '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invHomeMove" data-w="' + k + '" data-d="-1" aria-label="Move ' + escHtml(name[k]) + ' up"' + (i === 0 ? ' disabled' : '') + '>&uarr;</button>' +
      '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invHomeMove" data-w="' + k + '" data-d="1" aria-label="Move ' + escHtml(name[k]) + ' down"' + (i === l.order.length - 1 ? ' disabled' : '') + '>&darr;</button></span></div>';
  });
  return h + '</div>';
}
function homeEditChange(fn) {
  var l = homeLayout();
  fn(l);
  l.preset = 'custom';
  homeLayoutSave(l);
  homeApplyLayout();
}
function homeAction(action, btn) {
  switch (action) {
    case 'invHomeEdit': _homeEdit = true; homeApplyLayout(); viewTop(); return true;
    case 'invHomeEditDone': _homeEdit = false; homeApplyLayout(); return true;
    case 'invHomePreset': homeLayoutSave(homePresetLayout(btn.dataset.preset)); homeApplyLayout(); return true;
    case 'invHomeWide': homeEditChange(function(l) { l.wide[btn.dataset.w] = btn.dataset.v === '1'; }); return true;
    case 'invHomeMove': homeEditChange(function(l) {
      var i = l.order.indexOf(btn.dataset.w), j = i + parseInt(btn.dataset.d, 10);
      if (i < 0 || j < 0 || j >= l.order.length) return;
      l.order.splice(j, 0, l.order.splice(i, 1)[0]);
    }); return true;
  }
  return false;
}
function homeShowToggle(el) {
  homeEditChange(function(l) { if (el.checked) delete l.hidden[el.dataset.homeShow]; else l.hidden[el.dataset.homeShow] = true; });
}

/* The three widgets Home had no card for. Each is drawn only while shown, and says nothing rather than a zero. */
function renderHomeExtraCards() {
  var l = homeLayout(), set = function(id, html) { var e = document.getElementById(id); if (e) e.innerHTML = html; };
  var head = function(title, go, label) { return '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">' + title + '</span>' +
    '<button class="inv-btn-link" data-action="invSwitchTab" data-tab="' + go + '">' + label + '</button></div>'; };
  // Production: the last day with plating on record, by line.
  if (!l.hidden.production) {
    var h = '';
    try {
      var last = null;
      prodIndex().counted.forEach(function(e) { if (!last || e.date > last) last = e.date; });
      h = head('Production', 'pageProduction', 'Open');
      if (!last) h += '<div class="inv-empty">No plating on record yet.</div>';
      else {
        h += '<div class="inv-row-group"><span>' + escHtml(attDayName(last) + ' ' + formatDate(last)) + '</span></div>';
        PROD_LINES.forEach(function(ln) {
          var r = prodDayLine(last, ln);
          if (!r.entries.length) return;
          h += '<div class="inv-row"><span class="inv-row-main">' + escHtml(prodLineName(ln)) + '</span><span class="inv-row-end inv-num">' +
            (r.kg > 0 ? cpNum(r.kg) + ' kg' : '') + (r.nos > 0 ? (r.kg > 0 ? ' · ' : '') + cpNum(r.nos) + ' NOS' : '') + '</span></div>';
        });
      }
      h += '</div>';
    } catch (e) { h = ''; }
    set('homeProdCard', h);
  } else set('homeProdCard', '');
  // Power: this month's cuts and the last one.
  if (!l.hidden.power) {
    var ph = '';
    try {
      var today = localDateStr(), cuts = powerCuts(today.slice(0, 8) + '01', today), all = powerCuts(null, today);
      var mins = cuts.reduce(function(s, c) { return s + (c.min || 0); }, 0), lastCut = all[all.length - 1];
      ph = head('Power cuts', 'pagePower', 'Open') + '<div class="inv-tiles inv-tiles-flush"><div class="inv-tile' + (cuts.length ? ' inv-tile-warning' : '') + '"><div class="inv-tile-label">This month</div><div class="inv-tile-value">' + cuts.length + '</div>' +
        '<div class="inv-tile-sub">' + (mins ? powerDur(mins) + ' dark' : 'none recorded') + '</div></div>' +
        '<div class="inv-tile"><div class="inv-tile-label">Last cut</div><div class="inv-tile-value">' + (lastCut ? escHtml(formatDate(lastCut.date)) : '&mdash;') + '</div>' +
        '<div class="inv-tile-sub">' + (lastCut ? escHtml(powerClock(lastCut.from) + (lastCut.open ? ', no time back' : ' – ' + powerClock(lastCut.to))) : '') + '</div></div></div></div>';
    } catch (e) { ph = ''; }
    set('homePowerCard', ph);
  } else set('homePowerCard', '');
  // Stock: the lines red or amber, soonest out first.
  if (!l.hidden.stock) {
    var sh = '';
    try {
      var rows = stockData().items.filter(function(i) { return i.active !== false; }).map(function(i) { return { i: i, s: stockStatus(i) }; })
        .filter(function(x) { return x.s.tone === 'red' || x.s.tone === 'amber'; }).sort(function(a, b) { return (a.s.daysLeft == null ? -1 : a.s.daysLeft) - (b.s.daysLeft == null ? -1 : b.s.daysLeft); });
      sh = head('Stock running low', 'pageStock', 'Open') + (rows.length ? rows.slice(0, 5).map(function(x) {
        return '<div class="inv-row"><span class="inv-row-main">' + escHtml(x.i.name) + '</span><span class="inv-row-end">' + uiDot(x.s.tone === 'red' ? 'danger' : 'warning', escHtml(stockStatusWord(x.s, true))) + '</span></div>';
      }).join('') + (rows.length > 5 ? '<div class="inv-row"><span class="inv-row-main inv-row-meta">and ' + (rows.length - 5) + ' more</span></div>' : '') : '<div class="inv-empty">No line is running low.</div>') + '</div>';
    } catch (e) { sh = ''; }
    set('homeStockCard', sh);
  } else set('homeStockCard', '');
}
