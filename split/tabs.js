/* ===== TAB SWITCHING (DP v0.2 9-step) ===== */
function switchTab(tabId) {
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

  // Step 3: Deactivate all tabs and pages
  document.querySelectorAll('.inv-page').forEach(p => p.classList.remove('inv-page-active'));
  document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('inv-tab-active'));
  // Phase 8A: Deactivate sidebar items
  document.querySelectorAll('.inv-sidebar-item').forEach(s => s.classList.remove('inv-sidebar-active'));

  // Step 4: Read and clear _navReturnTab
  const returnTab = _navReturnTab;
  _navReturnTab = null;

  // Step 5: Activate target page and tab
  const page = document.getElementById(tabId);
  if (page) page.classList.add('inv-page-active');
  document.querySelectorAll('.inv-tab').forEach(t => {
    if (t.dataset.tab === tabId) t.classList.add('inv-tab-active');
  });
  // Phase 8A: Activate sidebar item
  document.querySelectorAll('.inv-sidebar-item').forEach(s => {
    if (s.dataset.tab === tabId) s.classList.add('inv-sidebar-active');
  });

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
function renderHome() {
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  const active = S.invoices.filter(i => i.status === 'active' && i.date && i.date.startsWith(ym));
  document.getElementById('mtdCount').textContent = active.length;
  document.getElementById('mtdRevenue').innerHTML = formatCurrency(active.reduce((s,i) => s + (i.taxableValue || 0), 0));

  // Phase 5: Unbilled IM summary card
  var unbilledEl = document.getElementById('homeUnbilledCard');
  if (unbilledEl) {
    var pendingChallans = 0;
    var pendingAmount = 0;
    var pendingItemCount = 0;
    var latestChallan = null;
    (S.incomingMaterial || []).forEach(function(im) {
      var hasPending = false;
      im.items.forEach(function(it) {
        if (!it.invoiced) {
          hasPending = true;
          pendingAmount += (it.amount || 0);
          pendingItemCount++;
        }
      });
      if (hasPending) pendingChallans++;
      if (!latestChallan || (im.createdAt || 0) > (latestChallan.createdAt || 0)) {
        latestChallan = im;
      }
    });

    if (pendingChallans > 0 || latestChallan) {
      var ubHtml = '<div class="inv-card inv-card-unbilled">' +
        '<div class="inv-card-header"><span class="inv-card-title">Unbilled Material</span></div>';
      if (pendingChallans > 0) {
        ubHtml += '<div class="inv-unbilled-row"><span class="inv-unbilled-label">Pending challans</span>' +
          '<span class="inv-unbilled-value">' + pendingChallans + '</span></div>' +
          '<div class="inv-unbilled-row"><span class="inv-unbilled-label">Items awaiting invoicing</span>' +
          '<span class="inv-unbilled-value">' + pendingItemCount + '</span></div>' +
          '<div class="inv-unbilled-row"><span class="inv-unbilled-label">Pending amount</span>' +
          '<span class="inv-unbilled-value">' + formatCurrency(pendingAmount) + '</span></div>';
      } else {
        ubHtml += '<div class="inv-unbilled-row"><span class="inv-unbilled-label">All items invoiced</span>' +
          '<span class="inv-unbilled-value inv-text-cost">0 pending</span></div>';
      }
      if (latestChallan) {
        ubHtml += '<div class="inv-latest-challan">Latest: ' +
          '<span class="inv-latest-challan-num">' + (latestChallan.challanNo ? 'Ch. ' + escHtml(latestChallan.challanNo) : 'No number') + '</span> ' +
          escHtml(latestChallan.clientName) + ' &middot; ' + formatDate(latestChallan.challanDate) + '</div>';
      }
      ubHtml += '<button class="inv-quick-action" data-action="invSwitchTab" data-tab="pageIM">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
        'View Incoming</button></div>';
      unbilledEl.innerHTML = ubHtml;
    } else {
      unbilledEl.innerHTML = '';
    }
  }

  const recent = [...S.invoices].sort((a,b) => (b.createdAt||0) - (a.createdAt||0)).slice(0, 10);
  const el = document.getElementById('recentInvoices');
  if (recent.length === 0) {
    el.innerHTML = '<div class="inv-empty-state">' +
      '<svg class="inv-empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>' +
      '<div class="inv-mt-16">No invoices yet</div>' +
      '<div class="inv-mt-16"><button class="inv-btn inv-btn-primary" data-action="invCreateNew">Create your first invoice</button></div>' +
      '</div>';
    return;
  }
  el.innerHTML = recent.map(inv => {
    const cancelled = inv.status === 'cancelled';
    return '<div class="inv-client-item' + (cancelled ? ' inv-client-inactive' : '') + '" data-action="invViewInvoiceDetail" data-id="' + escHtml(inv.id) + '">' +
      '<div><div class="inv-client-name inv-mono inv-recent-num">' + escHtml(inv.displayNumber) + '</div>' +
      '<div class="inv-client-meta">' + escHtml(inv.clientName) + ' &middot; ' + formatDate(inv.date) + '</div></div>' +
      '<div class="inv-text-right inv-recent-right"><div class="inv-mono inv-text-cost inv-recent-total">' + formatCurrency(inv.grandTotal) + '</div>' +
      getStateBadgeHtml(inv) +
      '</div>' +
      '<button class="inv-recent-print" data-action="invPreviewInvoice" data-id="' + escHtml(inv.id) + '" aria-label="Print">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
      '</button></div>';
  }).join('');
}

