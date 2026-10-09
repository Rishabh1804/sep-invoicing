/* ===== TAB SWITCHING (DP v0.2 9-step) ===== */
/* Each page by the name it carries on screen (the tab map, 9 Oct 2026: one word, one meaning). They reach users in refusal
   toasts, the guard's roles grid and a screen that could not be drawn. */
const PAGE_TITLES = {
  pageHome: 'Today', pageCreate: 'Create invoice', pageIM: 'Challans', pageRegister: 'Invoices',
  pageClients: 'Clients', pageFinance: 'Money', pageProduction: 'Production', pagePower: 'Power', pageStock: 'Stock', pageStaff: 'People',
  pageFloor: 'Floor overview', pagePipeline: 'Pipeline',
  pageStats: 'Stats', pageReports: 'Reports', pagePlanner: 'Planner', pageHistory: 'History', pageKnow: 'Knowledge'
};

/* ===== ONE LOOK: EVERY SCREEN DECLARES ITS KIND (docs/TAB_MAP.md §3e) =====
   An overview (Today's two views, Pipeline, Floor's and Money's Overview), a work screen (every list and every analysis), a
   document (paper fitted to the screen) or a form (a back head, the fields, the action bar last). Each kind is assembled one
   way, and P197 holds a screen to its kind. The page's root carries its kind (`data-screen`), read off the place on screen:
   a page's own view can differ from the page (`page/view`), and a sub-view that is a form says so while it shows. */
var SCREEN_KINDS = {
  pageHome: 'overview', pagePipeline: 'overview', pageIM: 'work', pageRegister: 'work', pageClients: 'work',
  pageCreate: 'form', pageFloor: 'overview',
  pageStaff: 'work', 'pageStaff/overview': 'overview',
  pageProduction: 'work', 'pageProduction/overview': 'overview',
  pageStock: 'work', 'pageStock/overview': 'overview', 'pageStock/item': 'form',
  pagePower: 'work', 'pagePower/overview': 'overview', 'pagePower/case': 'document',
  pageFinance: 'work', 'pageFinance/overview': 'overview',
  pageStats: 'work',
  pageReports: 'document', pagePlanner: 'work', pageHistory: 'work',
  pageKnow: 'work', 'pageKnow/start': 'overview'
};
// A part of the address that is a form wherever it appears: a challan, a quotation, a paste and its check, by hand, a register
// photo's check, an article being written.
var SCREEN_FORM_PARTS = /^(form|paste|review|hand|photo|manual|edit)$/;
function screenKindOf(loc) {
  loc = loc || navLoc();
  var parts = String(loc.v || '').split('/');
  if (parts.some(function(x) { return SCREEN_FORM_PARTS.test(x); })) return 'form';
  // An article read on the phone is a record opened as a sub-view; on the desktop it sits in the pane beside its list.
  if (loc.tab === 'pageKnow' && loc.id && !_isDesktop) return 'form';
  return SCREEN_KINDS[loc.tab + '/' + parts[0]] || SCREEN_KINDS[loc.tab] || 'work';
}
function screenKindApply() {
  var p = document.querySelector('.inv-page-active');
  if (!p) return;
  var k = screenKindOf();
  if (p.dataset.screen !== k) p.dataset.screen = k;
}

/* A page is one of PAGE_TITLES' keys. An address or a remembered tab naming anything else (another element, a page another
   build had) opens Home and is never remembered: ?tab=topbarTitle drew a blank page, and every launch after reopened it
   (the QA audit of 30 Sep 2026). */
function isPageId(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PAGE_TITLES, id) && !!document.getElementById(id);
}

function switchTab(tabId) {
  if (!isPageId(tabId)) tabId = 'pageHome';
  // The guard (guard.js): a page this ID may not open is refused with a word, and Home opens instead.
  var refused = typeof grdSees === 'function' && !grdSees(tabId) ? tabId : null;
  if (refused) tabId = 'pageHome';
  // Step 1: Dismiss toasts and close overlays
  document.querySelectorAll('.inv-toast').forEach(t => t.remove());
  closeOverlay();
  closePrintPreview();

  // Step 1b: Drain focus stack without focusing (DP v0.2 Section 8)
  drainFocusStack();

  // Step 2: Capture scroll position of departing tab
  const currentPage = document.querySelector('.inv-page-active');
  if (currentPage) {
    _tabScroll[currentPage.id] = currentPage.scrollTop || window.scrollY;
  }
  // Step 2b: a knowledge article's form is left with its page, and with a tap on the page itself (knowledge.js kbLeave).
  if (currentPage && currentPage.id === 'pageKnow' && typeof kbLeave === 'function') kbLeave();

  // Another page is a navigation: a keepScroll around whatever called this does not hold the old place (P79).
  _viewTopAt++;

  // Step 3: Deactivate all tabs and pages
  document.querySelectorAll('.inv-page').forEach(p => p.classList.remove('inv-page-active'));

  // Step 4: Read and clear _navReturnTab
  const returnTab = _navReturnTab;
  _navReturnTab = null;

  // Step 5: Activate target page and tab
  const page = document.getElementById(tabId);
  if (page) page.classList.add('inv-page-active');

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
    if (typeof errReport === 'function') errReport(err, 'render: ' + tabId);
    uiNotice('The ' + (PAGE_TITLES[tabId] || 'screen') + ' screen could not be drawn: ' + ((err && err.message) || err) +
      '. The rest of the app works; export a backup from Settings if this keeps happening.', 'danger');
  }
  // Step 6c: the shell (workspace.js), once the page is drawn: the bar's workspace, its tab row, the top bar's names and
  // the sidebar's mark.
  wsShellDraw(tabId);

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
  if (refused) showToast('Your ID doesn’t open ' + (PAGE_TITLES[refused] || 'that screen'), 'warning');
}

/* Draws one page from S (switchTab's step 6). Also what another window's save redraws, in place (tabRedrawActive).
   Nothing a role decides is drawn while nobody is signed in (guard.js grdHeld): the page waits for the unlock, which draws
   it for whoever unlocks; each drawing records whom it was for (grdDrawn). */
function tabRender(tabId, isDirty) {
  if (typeof grdHeld === 'function' && grdHeld()) return;
  if (typeof grdDrawn === 'function') grdDrawn();
  if (tabId === 'pageHome') {
    // Needs you is drawn every time it is shown: an input goes late by the clock, with nothing saved. Pulse is drawn when the
    // book changed or when Home was last drawn on the other view: opened from elsewhere on Pulse with nothing saved, the
    // address said Pulse and Needs you stayed on screen (the QA chain, 2 Oct 2026).
    // Pulse is drawn again too when the period changed on Stats since (the tab map, TM2b: one period for both).
    if (isDirty || tdyView() === 'needs' || _homeDrawnView !== tdyView() || _homeDrawnPeriod !== _statsPeriod) { renderHome(); _tabDirty.home = false; }
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
  } else if (tabId === 'pageFloor') {
    renderFloor();
  } else if (tabId === 'pageStock') {
    renderStock();
  } else if (tabId === 'pageStaff') {
    renderAttendance();
  } else if (tabId === 'pageFinance') {
    renderFinance();
  } else if (tabId === 'pageStats') {
    renderStats();
  } else if (tabId === 'pageReports') {
    renderReports();
  } else if (tabId === 'pagePlanner') {
    renderPlanner();
  } else if (tabId === 'pageHistory') {
    renderHistory();
  } else if (tabId === 'pageKnow') {
    renderKnow();
  }
  screenKindApply();
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
  // A task of your own is typed on Needs you, where the tasks are (the tab map, TM2a).
  else if (go === 'task') tdyFocusAdd();
}

/* A status is one of five tone words (design principles §6.13); the modules keep their own. */
var UI_TONE = { red: 'danger', amber: 'warning', info: 'info', green: 'ok' };
/* Status as a dot and a word (§6.13, DR-8). `word` is HTML: the caller escapes what came from the user. */
function uiDot(tone, word) { return '<span class="inv-dot inv-dot-' + uiTone(tone) + '">' + word + '</span>'; }
function uiTone(t) { return UI_TONE[t] || (/^(danger|warning|ok|info|neutral)$/.test(t) ? t : 'neutral'); }

var ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
var ICON_CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>';
var ICON_PRINT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

/* The month so far, for a role without money: not drawn at all, rather than another role's month left in it. */
function homeBlankTiles() { var e = document.getElementById('homeMtdCard'); if (e) e.innerHTML = ''; }
/* Home's month so far as a hero (§6.21): the month's billing against the same days last month, realisation against the
   cost, and the four tiles under it, each with the tonnage behind the revenue (What Stats measures) and a line of the months
   before. A tile whose change has a direction is coded in it (§6.26: data-tone, its figure a plain fact); realisation, which
   the app judges against the cost, is coloured as well (inv-tile-<tone>). */
function renderHomeTiles(active) {
  var host = document.getElementById('homeMtdCard');
  if (!host) return;
  var w = weighLines(active);
  // The app's own month names ('Sep'); en-IN's locale string reads 'Sept'.
  var month = TREND_MONTH_LABELS[new Date().getMonth()];
  var rev = sumTaxable(active);
  // Net of credit notes, as Stats is (owner, 30 Sep 2026: "yes, it should and it should be mentioned").
  var credited = gstRound(active.reduce(function(s, i) { return s + (i._credit || 0); }, 0));
  // Whether each is good (owner, 29 Sep 2026): against the same days last month, and realisation against the month's
  // live cost, the cost Stats judges it by.
  var p = homePriorSameDays(), pw = weighLines(p.invoices), lbl = 'same days last month';
  var real = w.kg > 0 ? w.revKnown / w.kg : null, preal = pw.kg > 0 ? pw.revKnown / pw.kg : null;
  var has = p.invoices.length > 0, prev = sumTaxable(p.invoices);
  var cost = null;
  if (real != null) { try { var lc = liveCost(p.monthStart, localDateStr(), w.kg); cost = lc && lc.perKg > 0 ? lc.perKg : null; } catch (e) { cost = null; } }
  if (cost == null && S.defaultCostPerKg > 0) cost = S.defaultCostPerKg;
  var realTone = real != null && cost != null ? figToneAgainst(real, cost, 5) : null;
  var revTone = has ? figDeltaTone(rev, prev, 'up') : null, kgTone = has && w.kg > 0 && pw.kg > 0 ? figDeltaTone(w.kg, pw.kg, 'up') : null;
  // Each figure's last six full months as a line under it (owner, 8 Oct 2026: the data on Today "still primitive"): the month
  // so far is the tile's own figure, so the line stops at the last month that ended.
  var hist = homeMonthsBack(6), labels = hist.map(function(x) { return x.label; });
  var tile = function(key, label, value, sub, delta, viz, o) {
    o = o || {};
    return '<div class="inv-tile' + (o.cls ? ' inv-tile-' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + (o.tone ? ' data-tone="' + o.tone + '"' : '') + '>' +
      '<div class="inv-tile-label">' + label + '</div><div class="inv-tile-value" id="mtd' + key + '">' + value + '</div>' +
      '<div class="inv-tile-sub" id="mtd' + key + 'Sub">' + sub + '</div><div class="inv-tile-sub" id="mtd' + key + 'Delta">' + delta + '</div>' +
      '<div class="inv-tile-viz" id="mtd' + key + 'Viz">' + viz + '</div></div>';
  };
  var tiles = tile('Count', 'Invoices', String(active.length), escHtml(month) + ' to date', has ? figDeltaHtml(active.length, p.invoices.length, lbl, null) : '',
      chartSpark(hist.map(function(x) { return x.n; }), { labels: labels, unit: 'count', dot: false, title: 'Invoices by month: ' + hist.map(function(x) { return x.label + ' ' + x.n; }).join(' · ') })) +
    tile('Revenue', 'Revenue', figWrapHtml(formatCurrency(rev)),
      credited > 0.005 ? 'taxable, net of ' + escHtml(formatCurrency(credited)) + ' in credit notes' : 'taxable, net of credit notes',
      has ? figDeltaHtml(rev, prev, lbl, 'up') : '', chartSpark(hist.map(function(x) { return x.rev; }), { labels: labels, dot: false }), { tone: revTone }) +
    // Two places, as Stats shows it: one place read 40 kg as '0.0 t'.
    tile('Kg', 'Tonnage billed', w.kg > 0 ? formatNum(w.kg / 1000, 2) + ' t' : '&mdash;', w.kg > 0 ? Math.round(w.kg).toLocaleString('en-IN') + ' kg' : 'nothing weighed yet',
      has && w.kg > 0 && pw.kg > 0 ? figDeltaHtml(w.kg, pw.kg, lbl, 'up') : '',
      chartSpark(hist.map(function(x) { return x.kg > 0 ? gstRound(x.kg / 1000) : null; }), { labels: labels, unit: 'count', dot: false,
        title: 'Tonnes by month: ' + hist.map(function(x) { return x.label + ' ' + formatNum(x.kg / 1000, 1) + ' t'; }).join(' · ') }), { tone: kgTone }) +
    // A partial figure always reads better than the blend: the unweighed lines are the piece-billed end. "All" only when
    // nothing priced is unweighed, and a partial share never rounds up to 100%. Only what there is is joined: with nothing
    // weighed on the same days last month the line ended on a bare " · ".
    tile('PerKg', 'Realisation', w.kg > 0 ? figWrapHtml(formatCurrency(w.revKnown / w.kg)) + '<span class="inv-tile-of">/kg</span>' : '&mdash;',
      !(w.kg > 0) ? '&nbsp;' : w.revUnknown < 0.005 ? 'all revenue weighed' : 'on the ' + Math.min(99, Math.round(w.coverage * 100)) + '% of revenue weighed',
      real == null ? '' : [cost != null ? (real >= cost ? 'clears' : 'below') + ' cost ' + formatCurrency(cost) : '', preal != null ? figDeltaHtml(real, preal, lbl, 'up') : ''].filter(Boolean).join(' · '),
      chartSpark(hist.map(function(x) { return x.real; }), { ref: hist.map(function(x) { return x.cost; }), labels: labels, unit: 'rate', dot: false }),
      { id: 'mtdPerKgTile', cls: realTone });
  // What the month says, in words: the billing against the same days last month, and realisation against the cost. The card
  // is coded by the worse of the two.
  var pct = has && prev > 0 ? (rev - prev) / prev * 100 : null;
  var title = !active.length ? 'Nothing billed yet this month' : pct == null ? 'The month’s first invoices'
    : Math.abs(pct) <= FIG_FLAT_PCT ? 'Billing level with the same days last month'
    : 'Billing ' + formatNum(Math.abs(pct), 1) + '% ' + (pct > 0 ? 'ahead of' : 'behind') + ' the same days last month';
  var sub = real == null ? (active.length ? 'Nothing weighed yet, so no realisation' : '')
    : 'Realising ' + formatCurrency(real) + ' a kg' + (cost != null ? (real >= cost ? ', clearing the cost of ' : ' against a cost of ') + formatCurrency(cost) : '');
  var rank = { danger: 3, warning: 2, ok: 1 }, worst = [revTone, realTone].filter(Boolean).sort(function(x, y) { return rank[y] - rank[x]; })[0] || '';
  host.innerHTML = uiHeroHtml({ tone: worst, eyebrow: '<span>Month to date</span><span class="inv-panel-count">' + escHtml(month) + ' 1–' + new Date().getDate() + '</span>',
    title: escHtml(title), sub: escHtml(sub), fold: 'pulse-mtd', open: !!_isDesktop, attrs: ' data-card="mtd"',
    body: '<div class="inv-hero-sheet"><div class="inv-tiles" id="homeTiles">' + tiles + '</div></div>' });
}
/* The last n months that have ended, oldest first, as Stats reads them (statsMonthRows: realisation over the weighed lines,
   at each month's own live cost), with the invoices counted. */
function homeMonthsBack(n) {
  var rows = typeof statsMonthRows === 'function' ? statsMonthRows(n + 1) : [], cur = localDateStr().slice(0, 7);
  var count = {};
  statsInvoices().forEach(function(i) { if (i.date) count[i.date.slice(0, 7)] = (count[i.date.slice(0, 7)] || 0) + 1; });
  return rows.filter(function(r) { return r.month !== cur; }).slice(-n).map(function(r) {
    return { label: r.label, n: count[r.month] || 0, rev: gstRound(r.rev), kg: r.kg, real: r.real != null ? gstRound(r.real) : null, cost: r.cost != null ? gstRound(r.cost) : null };
  });
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

/* Today (today.js): the view on screen is drawn; the other is drawn when it is opened. Never for nobody (grdHeld). */
var _homeDrawnView = '';   // the view of Today drawn last (tabRender)
var _homeDrawnPeriod = '';   // the period Pulse was drawn on last: Stats and Pulse share one (tabRender)
function renderHome() {
  if (typeof grdHeld === 'function' && grdHeld()) return;
  _homeDrawnView = tdyView();
  _homeDrawnPeriod = _statsPeriod;
  tdyApplyView();
  // The bar's red counts on either view: Needs you had none drawn, so they stood as the start counted them (QA2-7).
  if (tdyView() === 'needs') { renderNeeds(); updateStockBadge(); return; }
  renderPulseQuestions();
  renderHomeWidgets();
}
/* A widget's card emptied: one the role signed in does not see is not drawn at all, hidden or not (the QA audit, QA4-4:
   the money cards were drawn in full and hidden, for any role). */
function homeWidgetBlank(ids) { ids.forEach(function(id) { var e = document.getElementById(id); if (e) e.innerHTML = ''; }); }
/* Pulse's widgets, as the owner arranged them. */
function renderHomeWidgets() {
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  // The month's invoices net of their credit notes (statsInvoices), so Home and Stats read one revenue.
  if (homeWidgetSeen('mtd')) {
    const active = statsInvoices().filter(i => i.date && i.date.startsWith(ym));
    renderHomeTiles(active);
  } else homeBlankTiles();

  if (homeWidgetSeen('zinc')) renderZincCard(); else homeWidgetBlank(['homeZincCard']);
  if (homeWidgetSeen('money')) renderFinHomeCard(); else homeWidgetBlank(['homeFinCard']);
  renderTodoHomeCard();
  if (homeWidgetSeen('attendance')) renderAttHomeCard(); else homeWidgetBlank(['homeAttCard']);
  updateStockBadge();
  if (homeWidgetSeen('sync')) ghRenderCard(); else homeWidgetBlank(['homeSyncCard']);
  renderHomeUnbilledCard();
  renderHomeRecentCard();
  // Laid out once every card is drawn: the packed grid measures their heights (§6.25).
  homeApplyLayout();
}
/* Unbilled material as a hero: what is waiting to be invoiced and how long the oldest has waited, coded as Pipeline codes its
   first stage (amber from the To-do's challan days, red at twice them); the two tiles and the latest challan under it. */
function renderHomeUnbilledCard() {
  var el = document.getElementById('homeUnbilledCard');
  if (!el) return;
  if (!homeWidgetSeen('unbilled')) { el.innerHTML = ''; return; }
  var pendingChallans = 0, pendingAmount = 0, pendingItemCount = 0, latestChallan = null, oldest = null;
  (S.incomingMaterial || []).forEach(function(im) {
    var hasPending = false;
    im.items.forEach(function(it) {
      if (!it.invoiced) { hasPending = true; pendingAmount += imLineOpen(it).amount; pendingItemCount++; }
    });
    if (hasPending) { pendingChallans++; if (im.challanDate && (!oldest || im.challanDate < oldest)) oldest = im.challanDate; }
    if (!latestChallan || (im.createdAt || 0) > (latestChallan.createdAt || 0)) latestChallan = im;
  });
  if (!pendingChallans && !latestChallan) { el.innerHTML = ''; return; }
  var age = oldest ? isoDaysBetween(oldest, localDateStr()) : 0, amberD = todoCfg().challanDays;
  var tone = !pendingChallans ? 'ok' : age >= amberD * 2 ? 'danger' : age >= amberD ? 'warning' : '';
  var body = '';
  if (pendingChallans > 0) {
    body += '<div class="inv-tiles inv-tiles-flush">' +
      '<div class="inv-tile"><div class="inv-tile-label">Pending challans</div><div class="inv-tile-value">' + pendingChallans + '</div>' +
      '<div class="inv-tile-sub">' + pendingItemCount + ' item' + (pendingItemCount === 1 ? '' : 's') + ' awaiting invoicing</div></div>' +
      '<div class="inv-tile"><div class="inv-tile-label">Pending amount</div><div class="inv-tile-value">' + figWrapHtml(formatCurrency(pendingAmount)) + '</div>' +
      '<div class="inv-tile-sub">at the challans&rsquo; rates</div></div></div>';
  } else {
    body += '<div class="inv-row"><span class="inv-row-main"><span class="inv-dot inv-dot-ok">All items invoiced</span></span></div>';
  }
  if (latestChallan) {
    body += '<div class="inv-row"><span class="inv-row-main"><span class="inv-row-meta">Latest</span>' +
      '<span class="inv-row-title"><span class="inv-id">' + (latestChallan.challanNo ? 'Ch. ' + escHtml(latestChallan.challanNo) : 'No number') + '</span> ' +
      escHtml(latestChallan.clientName) + '</span></span><span class="inv-row-end inv-row-meta">' + escHtml(formatDate(latestChallan.challanDate)) + '</span></div>';
  }
  el.innerHTML = uiHeroHtml({ tone: tone, eyebrow: '<span>Unbilled material</span>' + (pendingChallans ? '<span class="inv-panel-count">' + pendingChallans + '</span>' : ''),
    title: pendingChallans ? escHtml(todoPlural(pendingChallans, 'challan') + ' to invoice') : 'Everything received is invoiced',
    fig: pendingChallans ? figWrapHtml(escHtml(formatCurrency(pendingAmount))) : '',
    sub: pendingChallans && oldest ? escHtml('The oldest from ' + formatDate(oldest) + (age > 0 ? ', ' + todoPlural(age, 'day') + ' ago' : ', today')) : '',
    fold: 'pulse-unbilled', open: !!_isDesktop, attrs: ' data-card="unbilled-pulse"', body: '<div class="inv-hero-sheet">' + body + '</div>',
    foot: '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invSwitchTab" data-tab="pageIM">View challans</button>' });
}
/* The recent invoices as a hero, as Needs you draws them (tdyRecentHtml), ten of them: the latest and its figure, opening to
   the rows with their print buttons. With none yet, the way to the first. */
function renderHomeRecentCard() {
  var host = document.getElementById('homeRecentCard');
  if (!host) return;
  if (!homeWidgetSeen('recent')) { host.innerHTML = ''; return; }
  var recent = homeRecentInvoices(10);
  var rows = recent.length ? recent.map(homeRecentRowHtml).join('') : '<div class="inv-empty">' +
    '<svg class="inv-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>' +
    '<div>No invoices yet</div>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invCreateNew">Create your first invoice</button>' +
    '</div>';
  host.innerHTML = uiHeroHtml(Object.assign(recent.length ? tdyRecentHead(recent) : { eyebrow: '<span>Recent invoices</span>', title: 'No invoices yet' }, {
    fold: 'pulse-recent', open: !!_isDesktop, attrs: ' data-card="recent-pulse"',
    body: '<div class="inv-hero-sheet"><div id="recentInvoices">' + rows + '</div></div>' }));
}
/* The invoices made last, newest first. */
function homeRecentInvoices(n) { return [...(S.invoices || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, n); }
/* A recent invoice: it opens its detail, and its print button opens the print preview at once (Today → Needs you and the
   Pulse widget draw the same row). */
function homeRecentRowHtml(inv) {
  return '<div class="inv-row inv-row-2' + (inv.status === 'cancelled' ? ' inv-row-muted' : '') + '" data-recent-inv="' + escHtml(inv.id) + '">' +
    '<button class="inv-row-main" data-action="invViewInvoiceDetail" data-id="' + escHtml(inv.id) + '">' +
    '<span class="inv-row-title inv-id">' + escHtml(inv.displayNumber) + '</span>' +
    // The date leads: after a long client name it was the part cut off.
    '<span class="inv-row-meta">' + escHtml(formatDate(inv.date)) + ' &middot; ' + escHtml(inv.clientName) + '</span></button>' +
    '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + formatCurrency(inv.grandTotal) + '</span>' + getStateBadgeHtml(inv) + '</span>' +
    '<button class="inv-btn inv-btn-icon" data-action="invPreviewInvoice" data-id="' + escHtml(inv.id) + '" aria-label="Print ' + escHtml(inv.displayNumber) + '" title="Print">' + ICON_PRINT + '</button></span></div>';
}


/* ===== HOME, AS THE OWNER ARRANGES IT =====
   Owner, 30 Sep 2026: "Home screen needs an overhaul with an option to select what widget to show on the home screen and
   where: a dynamic home screen which user can adjust." They chose presets and an edit mode, kept per device (the phone
   and the PC each keep their own Home, like the theme; a backup or a pull never rearranges another device).

   Every card on Home is a widget (`data-home-w`). A layout is {preset, order, hidden, wide}: the order the widgets stand
   in, which are hidden, and which take the page's width on the desktop (half otherwise; the phone is one column). A preset
   is a starting layout; Edit Home shows each widget with a switch, up and down, and half or full. */
var HOME_LAYOUT_KEY = 'sep_inv_home';
/* Each widget is a hero whose line answers at a glance: shut on the phone and open on the desktop until moved, remembered per
   device (`pulse-<widget>`), as the verdict cards are (the tab map, §1a-3, TM2c: Pulse at or under three and a half phone screens
   on the owner's book; open, its widgets alone ran past three). */
var HOME_WIDGETS = [
  ['mtd', 'Month to date'], ['quick', 'Quick actions'], ['money', 'Money'], ['todo', 'To-do'], ['attendance', 'Attendance'],
  ['unbilled', 'Unbilled material'], ['production', 'Production'], ['power', 'Power cuts'], ['stock', 'Stock running low'],
  ['sync', 'GitHub sync'], ['zinc', 'Zinc rate'], ['recent', 'Recent invoices']
];
/* Every preset hides the To-do, the recent invoices and Money (the tab map, TM2c): the tasks and the recent invoices are Needs
   you's, the money is Money's own section, and Pulse gives that room to the cards it took from Stats. They come last, so a layout
   made from a preset that shows one again puts it where it was. */
var HOME_PRESETS = {
  owner: { label: 'Owner', order: ['mtd', 'quick', 'attendance', 'unbilled', 'sync', 'zinc', 'production', 'power', 'stock', 'money', 'todo', 'recent'],
    hidden: ['production', 'power', 'stock', 'money', 'todo', 'recent'], wide: ['mtd', 'quick', 'recent'] },
  floor: { label: 'Floor', order: ['quick', 'attendance', 'production', 'stock', 'power', 'unbilled', 'mtd', 'sync', 'zinc', 'money', 'todo', 'recent'],
    hidden: ['mtd', 'sync', 'zinc', 'money', 'todo', 'recent'], wide: ['quick'] },
  money: { label: 'Money', order: ['mtd', 'unbilled', 'zinc', 'quick', 'attendance', 'production', 'power', 'stock', 'sync', 'money', 'todo', 'recent'],
    hidden: ['quick', 'attendance', 'production', 'power', 'stock', 'sync', 'money', 'todo', 'recent'], wide: ['mtd', 'recent'] }
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
  // A device on a preset follows the preset as this build defines it (TM2c); a layout of the owner's own is kept as it is.
  if (l.preset !== 'custom' && HOME_PRESETS[l.preset]) return homePresetLayout(l.preset);
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
/* What a widget needs to be shown to the person signed in (guard.js; everything with the guard off): the money widgets
   the finance permission, GitHub sync the owner, the others the screen they open. */
var HOME_WIDGET_NEEDS = { mtd: 'money', money: 'money', zinc: 'money', sync: 'owner', unbilled: 'pageIM', recent: 'pageRegister',
  attendance: 'pageStaff', production: 'pageProduction', power: 'pagePower', stock: 'pageStock', quick: 'pageCreate' };
function homeWidgetSeen(k) {
  var need = HOME_WIDGET_NEEDS[k];
  if (!need || typeof grdOn !== 'function' || !grdOn()) return true;
  if (need === 'money') return grdSeesMoney();
  if (need === 'owner') return grdIsOwner();
  return grdSees(need);
}
function homeApplyLayout() {
  var host = document.getElementById('homeWidgets');
  if (!host) return;
  var l = homeLayout();
  renderHomeExtraCards();
  l.order.forEach(function(k) {
    var el = host.querySelector('[data-home-w="' + k + '"]');
    if (!el) return;
    host.appendChild(el);
    el.classList.toggle('inv-hidden', !!l.hidden[k] || !homeWidgetSeen(k));
    el.classList.toggle('inv-panels-wide', !!l.wide[k]);
  });
  // Packed with no gaps on the desktop (§6.25): a short widget no longer leaves its row's height empty beside it.
  if (_isDesktop) uiMasonry(host); else if (host.classList.contains('inv-masonry-on')) uiMasonry(host);
  // Edit Home is opened from More in Pulse's head (the tab map, TM2b: one toolbar row; it was a toolbar of its own at the foot).
  var area = document.getElementById('homeEditArea');
  if (area) area.innerHTML = _homeEdit ? homeEditHtml(l) : '';
}
function homeEditHtml(l) {
  var name = {}; HOME_WIDGETS.forEach(function(w) { name[w[0]] = w[1]; });
  var h = '<div class="inv-panel inv-panel-flush" id="homeEdit" data-nodirty><div class="inv-panel-head"><span class="inv-panel-title">Edit Home</span>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invHomeEditDone">Done</button></div>' +
    '<div class="inv-panel-body"><div class="inv-field-label">Start from</div><div class="inv-seg" role="group" aria-label="Preset">' +
    Object.keys(HOME_PRESETS).map(function(k) { return '<button class="inv-seg-btn" data-action="invHomePreset" data-preset="' + k + '" aria-pressed="' + (l.preset === k) + '">' + HOME_PRESETS[k].label + '</button>'; }).join('') +
    '</div><div class="inv-note inv-mt-8">' + (l.preset === 'custom' ? 'Your own arrangement. ' : '') + 'Kept on this device only. Half or full is the width on a wide screen; a phone shows one column.</div></div>';
  l.order.forEach(function(k, i) {
    if (!homeWidgetSeen(k)) return;
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

/* The three widgets Home had no card for, as heroes. Each is drawn only while shown, to a role that sees it (homeWidgetSeen),
   and says nothing rather than a zero. */
function renderHomeExtraCards() {
  var l = homeLayout(), set = function(id, html) { var e = document.getElementById(id); if (e) e.innerHTML = html; };
  var open = function(go) { return '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invSwitchTab" data-tab="' + go + '">Open</button>'; };
  // Production: the last day with plating on record, as Production's own day card (prodDayHeroHtml): one unit, the lines.
  if (!l.hidden.production && homeWidgetSeen('production')) {
    var h = '';
    try {
      var last = null;
      prodIndex().counted.forEach(function(e) { if (e.kind === 'plated' && (!last || e.date > last)) last = e.date; });
      h = prodDayHeroHtml(last, { compact: true, fold: 'pulse-production', open: !!_isDesktop, attrs: ' data-card="production"' });
    } catch (e) { h = ''; }
    set('homeProdCard', h);
  } else set('homeProdCard', '');
  // Power: this month's cuts and the last one.
  if (!l.hidden.power && homeWidgetSeen('power')) {
    var ph = '';
    try {
      var today = localDateStr(), cuts = powerCuts(today.slice(0, 8) + '01', today), all = powerCuts(null, today);
      var mins = cuts.reduce(function(s, c) { return s + (c.min || 0); }, 0), lastCut = all[all.length - 1];
      var openCuts = cuts.filter(function(c) { return c.open; }).length;
      ph = uiHeroHtml({ tone: openCuts ? 'warning' : cuts.length ? 'info' : 'ok', eyebrow: '<span>Power cuts</span><span class="inv-panel-count">' + cuts.length + '</span>',
        title: cuts.length ? escHtml(todoPlural(cuts.length, 'cut') + ' this month') : 'No cut this month',
        fig: mins ? escHtml(powerDur(mins)) : '', sub: escHtml(mins ? 'dark in all' + (openCuts ? ' · ' + todoPlural(openCuts, 'cut') + ' with no time back' : '') : 'none recorded'),
        fold: 'pulse-power', open: !!_isDesktop, attrs: ' data-card="power"',
        body: '<div class="inv-hero-sheet"><div class="inv-tiles inv-tiles-flush"><div class="inv-tile' + (cuts.length ? ' inv-tile-warning' : '') + '"><div class="inv-tile-label">This month</div><div class="inv-tile-value">' + cuts.length + '</div>' +
          '<div class="inv-tile-sub">' + (mins ? powerDur(mins) + ' dark' : 'none recorded') + '</div></div>' +
          '<div class="inv-tile"><div class="inv-tile-label">Last cut</div><div class="inv-tile-value">' + (lastCut ? escHtml(formatDate(lastCut.date)) : '&mdash;') + '</div>' +
          '<div class="inv-tile-sub">' + (lastCut ? escHtml(powerClock(lastCut.from) + (lastCut.open ? ', no time back' : ' – ' + powerClock(lastCut.to))) : '') + '</div></div></div></div>',
        foot: open('pagePower') });
    } catch (e) { ph = ''; }
    set('homePowerCard', ph);
  } else set('homePowerCard', '');
  // Stock: the lines red or amber, soonest out first.
  if (!l.hidden.stock && homeWidgetSeen('stock')) {
    var sh = '';
    try {
      var low = stockData().items.filter(function(i) { return i.active !== false; }).map(function(i) { return { i: i, s: stockStatus(i) }; })
        .filter(function(x) { return x.s.tone === 'red' || x.s.tone === 'amber'; }).sort(function(a, b) { return (a.s.daysLeft == null ? -1 : a.s.daysLeft) - (b.s.daysLeft == null ? -1 : b.s.daysLeft); });
      var red = low.filter(function(x) { return x.s.tone === 'red'; }).length;
      sh = uiHeroHtml({ tone: red ? 'danger' : low.length ? 'warning' : 'ok', eyebrow: '<span>Stock running low</span>' + (low.length ? '<span class="inv-panel-count">' + low.length + '</span>' : ''),
        title: low.length ? escHtml(todoPlural(low.length, 'line') + ' running low') : 'No line is running low',
        sub: low.length ? escHtml(low.slice(0, 3).map(function(x) { return x.i.name; }).join(' · ') + (low.length > 3 ? ' · and ' + (low.length - 3) + ' more' : '')) : '',
        fold: 'pulse-stock', open: !!_isDesktop, attrs: ' data-card="stock-low"',
        body: low.length ? '<div class="inv-hero-sheet">' + low.slice(0, 5).map(function(x) {
          return '<div class="inv-row"><span class="inv-row-main">' + escHtml(x.i.name) + '</span><span class="inv-row-end">' + uiDot(x.s.tone === 'red' ? 'danger' : 'warning', escHtml(stockStatusWord(x.s, true))) + '</span></div>';
        }).join('') + (low.length > 5 ? '<div class="inv-row"><span class="inv-row-main inv-row-meta">and ' + (low.length - 5) + ' more</span></div>' : '') + '</div>' : null,
        foot: open('pageStock') });
    } catch (e) { sh = ''; }
    set('homeStockCard', sh);
  } else set('homeStockCard', '');
}
