/* ===== TAB SWITCHING (DP v0.2 9-step) ===== */
/* Each page by the name it carries on screen (the tab map, 9 Oct 2026: one word, one meaning). They reach users in refusal
   toasts, the guard's roles grid and a screen that could not be drawn. */
const PAGE_TITLES = {
  pageHome: 'Home', pageCreate: 'Create invoice', pageIM: 'Challans', pageRegister: 'Invoices',
  pageClients: 'Clients', pageFinance: 'Money', pageProduction: 'Production', pagePower: 'Power', pageStock: 'Stock', pageStaff: 'People',
  pageFloor: 'Floor overview', pagePipeline: 'Pipeline', pageFace: 'Mine',
  pageStats: 'Stats', pageReports: 'Reports', pagePlanner: 'Planner', pageHistory: 'History', pageKnow: 'Knowledge'
};

/* ===== ONE LOOK: EVERY SCREEN DECLARES ITS KIND (docs/TAB_MAP.md §3e) =====
   An overview (Today's two views, Pipeline, Floor's and Money's Overview), a work screen (every list and every analysis), a
   document (paper fitted to the screen) or a form (a back head, the fields, the action bar last). Each kind is assembled one
   way, and P197 holds a screen to its kind. The page's root carries its kind (`data-screen`), read off the place on screen:
   a page's own view can differ from the page (`page/view`), and a sub-view that is a form says so while it shows. */
var SCREEN_KINDS = {
  pageHome: 'overview', pagePipeline: 'overview', pageIM: 'work', pageRegister: 'work', pageClients: 'work',
  pageCreate: 'form', pageFloor: 'overview', pageFace: 'overview', 'pageFace/pickling': 'form', 'pageFace/incoming': 'form',
  'pageFace/roll-in': 'form', 'pageFace/roll-out': 'form', 'pageFace/barrel': 'form', 'pageFace/vat': 'form',
  pageStaff: 'work',
  pageProduction: 'work',
  pageStock: 'work', 'pageStock/item': 'form',
  pagePower: 'work', 'pagePower/case': 'document',
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
  // A face's form is left with its page (faces.js): Mine opens on the face again, not on a form someone left half filled.
  if (currentPage && currentPage.id === 'pageFace' && tabId !== 'pageFace' && typeof _faceForm !== 'undefined') _faceForm = null;
  // Home's clock and live widgets stop when Home is left (today.js homeLeave); they start again when it is shown.
  if (currentPage && currentPage.id === 'pageHome' && tabId !== 'pageHome' && typeof homeLeave === 'function') homeLeave();

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
  // opened whose first control was a search (the QA sweep, 29 Sep 2026). Home's board moves no focus when it is drawn (UI pass 3
  // §24b: a ring on its first card at load read as a card pressed); a keyboard's Tab starts at its first control all the same.
  var board = tabId === 'pageHome' && typeof tdyView === 'function' && tdyView() === 'home';
  if (targetPage && !board) focusFirstInteractive(targetPage, { noText: touchScreen() });
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
    // Pulse is drawn again too when the period changed on Stats since (the tab map, TM2b: one period for both). Home's dashboard
    // (UI pass 3) is drawn again on a new day too: its day card's date and what the calendar has made late.
    // And for whoever is in: Home drawn for somebody else is drawn again (a person's board is their own).
    if (isDirty || tdyView() === 'needs' || _homeDrawnView !== tdyView() || _homeDrawnPeriod !== _statsPeriod || _homeDrawnDay !== localDateStr() ||
      _homeDrawnFor !== homeDrawnKey()) { renderHome(); _tabDirty.home = false; }
    else if (tdyView() === 'home' && typeof homeArrive === 'function') homeArrive();
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
  } else if (tabId === 'pageFace') {
    renderFace();
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

var ICON_SEARCH = iconSvg('search');
var ICON_PRINT = iconSvg('print');

/* The month so far as a hero's options (§6.21; Home's mtd widget draws it, widgetcards.js): the month's billing against the same days last month, realisation against the
   cost, and the four tiles under it, each with the tonnage behind the revenue (What Stats measures) and a line of the months
   before. A tile whose change has a direction is coded in it (§6.26: data-tone, its figure a plain fact); realisation, which
   the app judges against the cost, is coloured as well (inv-tile-<tone>). */
function homeMtdOpts(active, opt) {
  opt = opt || {};
  var withViz = opt.viz !== false;   // the tiles' lines of the months before: the mtd widget draws them at Large only
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
      (withViz ? '<div class="inv-tile-viz" id="mtd' + key + 'Viz">' + viz + '</div>' : '') + '</div>';
  };
  var tiles = tile('Count', 'Invoices', String(active.length), escHtml(month) + ' to date', has ? figDeltaHtml(active.length, p.invoices.length, lbl, null) : '',
      chartSpark(hist.map(function(x) { return x.n; }), { labels: labels, unit: 'count', dot: false, title: 'Invoices by month: ' + hist.map(function(x) { return x.label + ' ' + x.n; }).join(' · ') })) +
    // Money on a board is short, its exact figure its title (U2R §24k).
    tile('Revenue', 'Revenue', inrFigHtml(rev),
      credited > 0.005 ? 'taxable, net of ' + inrFigHtml(credited, { inline: true }) + ' in credit notes' : 'taxable, net of credit notes',
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
  var span = month + ' 1–' + new Date().getDate();
  return { tone: worst, eyebrow: '<span>Month to date</span><span class="inv-panel-count">' + escHtml(span) + '</span>', span: span,
    title: escHtml(title), sub: escHtml(sub), attrs: ' data-card="mtd"', rev: rev, revTone: revTone, revDelta: has ? figDeltaHtml(rev, prev, lbl, 'up') : '',
    tiles: '<div class="inv-tiles" id="homeTiles">' + tiles + '</div>', body: '<div class="inv-hero-sheet"><div class="inv-tiles" id="homeTiles">' + tiles + '</div></div>' };
}
/* The month's invoices so far, net of their credit notes (statsInvoices), so Home and Stats read one revenue. */
function homeMonthInvoices() {
  var now = new Date(), ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  return statsInvoices().filter(function(i) { return i.date && i.date.startsWith(ym); });
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

/* Home (today.js): the view on screen is drawn; the other is drawn when it is opened. Never for nobody (grdHeld). */
var _homeDrawnView = '';   // the view of Home drawn last (tabRender)
var _homeDrawnPeriod = '';   // the period the dashboard was drawn on last: Stats and Home share one (tabRender)
var _homeDrawnDay = '';      // the day Home was drawn on last (tabRender)
var _homeDrawnFor = '';      // whom Home was drawn for last (homeDrawnKey): a person's board and masthead are their own
/* Who Home is drawn for: the person signed in and their role's settings (guard.js grdDrawKey), null with the guard off. Home is kept
   between visits, so a board drawn for one person was shown to the next to sign in (the clerk's masthead and board to the owner). */
function homeDrawnKey() { return typeof grdOn === 'function' && grdOn() && typeof grdDrawKey === 'function' ? grdDrawKey(grdUser()) : null; }
function renderHome() {
  if (typeof grdHeld === 'function' && grdHeld()) return;
  _homeDrawnView = tdyView();
  _homeDrawnPeriod = _statsPeriod;
  _homeDrawnDay = localDateStr();
  _homeDrawnFor = homeDrawnKey();
  tdyApplyView();
  // The bar's red counts on either view: Needs you had none drawn, so they stood as the start counted them (QA2-7).
  if (tdyView() === 'needs') renderNeeds(); else renderHomeBoard();
  updateStockBadge();
}
/* The invoices made last, newest first. */
function homeRecentInvoices(n) { return [...(S.invoices || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, n); }
/* A recent invoice: it opens its detail, and its print button opens the print preview at once (Home → Needs you's recent invoices). */
function homeRecentRowHtml(inv) {
  return '<div class="inv-row inv-row-2' + (inv.status === 'cancelled' ? ' inv-row-muted' : '') + '" data-recent-inv="' + escHtml(inv.id) + '">' +
    '<button class="inv-row-main" data-action="invViewInvoiceDetail" data-id="' + escHtml(inv.id) + '">' +
    '<span class="inv-row-title inv-id">' + escHtml(inv.displayNumber) + '</span>' +
    // The date leads: after a long client name it was the part cut off.
    '<span class="inv-row-meta">' + escHtml(formatDate(inv.date)) + ' &middot; ' + escHtml(inv.clientName) + '</span></button>' +
    '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + formatCurrency(inv.grandTotal) + '</span>' + getStateBadgeHtml(inv) + '</span>' +
    '<button class="inv-btn inv-btn-icon" data-action="invPreviewInvoice" data-id="' + escHtml(inv.id) + '" aria-label="Print ' + escHtml(inv.displayNumber) + '" title="Print">' + ICON_PRINT + '</button></span></div>';
}


/* The last day plated, the month's power cuts and the stock running low, as heroes' options (Home's prodday, powercuts and
   stockdays widgets draw them, widgetcards.js). Each says nothing rather than a zero. */
/* The last day with plating on record, or '' with none. */
function homeLastPlatedDay() {
  var last = '';
  prodIndex().counted.forEach(function(e) { if (e.kind === 'plated' && (!last || e.date > last)) last = e.date; });
  return last;
}
/* Power: this month's cuts and the last one. */
function homePowerOpts() {
  var today = localDateStr(), cuts = powerCuts(today.slice(0, 8) + '01', today), all = powerCuts(null, today);
  var mins = cuts.reduce(function(s, c) { return s + (c.min || 0); }, 0), lastCut = all[all.length - 1];
  var openCuts = cuts.filter(function(c) { return c.open; }).length;
  return { tone: openCuts ? 'warning' : cuts.length ? 'info' : 'ok', eyebrow: '<span>Power cuts</span><span class="inv-panel-count">' + cuts.length + '</span>',
    title: cuts.length ? escHtml(todoPlural(cuts.length, 'cut') + ' this month') : 'No cut this month',
    fig: mins ? escHtml(powerDur(mins)) : '', sub: escHtml(mins ? 'dark in all' + (openCuts ? ' · ' + todoPlural(openCuts, 'cut') + ' with no time back' : '') : 'none recorded'),
    attrs: ' data-card="power"', cuts: cuts.length, mins: mins,
    body: '<div class="inv-hero-sheet"><div class="inv-tiles inv-tiles-flush"><div class="inv-tile' + (cuts.length ? ' inv-tile-warning' : '') + '"><div class="inv-tile-label">This month</div><div class="inv-tile-value">' + cuts.length + '</div>' +
      '<div class="inv-tile-sub">' + (mins ? powerDur(mins) + ' dark' : 'none recorded') + '</div></div>' +
      '<div class="inv-tile"><div class="inv-tile-label">Last cut</div><div class="inv-tile-value">' + (lastCut ? escHtml(formatDate(lastCut.date)) : '&mdash;') + '</div>' +
      '<div class="inv-tile-sub">' + (lastCut ? escHtml(powerClock(lastCut.from) + (lastCut.open ? ', no time back' : ' – ' + powerClock(lastCut.to))) : '') + '</div></div></div></div>' };
}
