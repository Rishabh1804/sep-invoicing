/* ===== TAB SWITCHING (DP v0.2 9-step) ===== */
const PAGE_TITLES = {
  pageHome: 'Home', pageCreate: 'Create invoice', pageIM: 'Challans', pageRegister: 'Register',
  pageClients: 'Clients', pageFinance: 'Finance', pageTodo: 'To-do', pageStock: 'Stock', pageStaff: 'Staff',
  pageStats: 'Stats', pageHistory: 'History'
};

function switchTab(tabId) {
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

  // Step 5b: Persist active tab for refresh recovery (Phase 6b)
  regFilter.activeTab = tabId;
  saveRegFilter();

  // Step 6: Check dirty flag and re-render if needed
  const tabKey = tabId === 'pageHome' ? 'home' : tabId === 'pageRegister' ? 'register' : null;
  const isDirty = tabKey ? _tabDirty[tabKey] : true;

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
  } else if (tabId === 'pageCreate') {
    if (!document.getElementById('createFormArea').innerHTML) initCreateForm();
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
  } else if (tabId === 'pageHistory') {
    renderHistory();
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
  if (targetPage) focusFirstInteractive(targetPage);
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
    switchTab('pageTodo');
    var inp = document.getElementById('todoNew');
    if (inp) inp.focus();
  }
}

/* A status is one of five tone words (design principles §6.13); the modules keep their own. */
var UI_TONE = { red: 'danger', amber: 'warning', info: 'info', green: 'ok' };
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
  set('mtdRevenue', formatCurrency(sumTaxable(active)));
  // Two places, as Stats shows it: one place read 40 kg as '0.0 t'.
  set('mtdKg', w.kg > 0 ? formatNum(w.kg / 1000, 2) + ' t' : '&mdash;');
  set('mtdKgSub', w.kg > 0 ? Math.round(w.kg).toLocaleString('en-IN') + ' kg' : 'nothing weighed yet');
  set('mtdPerKg', w.kg > 0 ? formatCurrency(w.revKnown / w.kg) + '<span class="inv-tile-of">/kg</span>' : '&mdash;');
  // A partial figure always reads better than the blend: the unweighed lines are the piece-billed end.
  // "All" only when nothing priced is unweighed, and a partial share never rounds up to 100%.
  set('mtdPerKgSub', !(w.kg > 0) ? '&nbsp;' : w.revUnknown < 0.005 ? 'all revenue weighed'
    : 'on the ' + Math.min(99, Math.round(w.coverage * 100)) + '% of revenue weighed');
}

function renderHome() {
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  const active = S.invoices.filter(i => i.status === 'active' && i.date && i.date.startsWith(ym));
  renderHomeTiles(active);

  renderZincCard();
  renderFinHomeCard();
  renderTodoHomeCard();
  renderAttHomeCard();
  updateStockBadge();
  ghRenderCard();

  var unbilledEl = document.getElementById('homeUnbilledCard');
  if (unbilledEl) {
    var pendingChallans = 0, pendingAmount = 0, pendingItemCount = 0, latestChallan = null;
    (S.incomingMaterial || []).forEach(function(im) {
      var hasPending = false;
      im.items.forEach(function(it) {
        if (!it.invoiced) { hasPending = true; pendingAmount += (it.amount || 0); pendingItemCount++; }
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
          '<div class="inv-tile"><div class="inv-tile-label">Pending amount</div><div class="inv-tile-value">' + formatCurrency(pendingAmount) + '</div>' +
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
      '<span class="inv-row-meta">' + escHtml(inv.clientName) + ' &middot; ' + escHtml(formatDate(inv.date)) + '</span></button>' +
      '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + formatCurrency(inv.grandTotal) + '</span>' + getStateBadgeHtml(inv) + '</span>' +
      '<button class="inv-btn inv-btn-icon" data-action="invPreviewInvoice" data-id="' + escHtml(inv.id) + '" aria-label="Print">' + ICON_PRINT + '</button></span></div>';
  }).join('');
}

