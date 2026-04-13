/* ===== VIEW/EDIT INVOICE ===== */
function viewInvoice(invId) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv) return;
  if (inv.status === 'cancelled') {
    openInvoiceDetail(invId);
    return;
  }
  // Build toast — include cross-month warning if applicable
  const now = new Date();
  const curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const invMonth = inv.date ? inv.date.substring(0, 7) : '';
  let editToast = 'Editing ' + inv.displayNumber;
  if (invMonth && invMonth !== curMonth) {
    const monthNames = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
    const parts = invMonth.split('-');
    const mName = monthNames[parseInt(parts[1])] + ' ' + parts[0];
    editToast += ' (' + mName + ' — may affect filed returns)';
  }
  // Load into edit mode
  invoiceForm = {
    clientId: inv.clientId,
    date: inv.date,
    items: inv.items.map(i => ({...i, _override: false, _label: ''})),
    poNumber: inv.poNumber || '',
    poDate: inv.poDate || localDateStr(),
    challanNo: inv.challanNo || '',
    challanDate: inv.challanDate || localDateStr(),
    despatchDate: inv.despatchDate || localDateStr(),
    transport: inv.transport || '',
    eWayBill: inv.eWayBill || '',
    remarks: inv.remarks || '',
    editingId: inv.id
  };
  renderCreateForm();
  switchTab('pageCreate');
  showToast(editToast, 'warning');
}

/* ===== INVOICE REGISTER ===== */

function getFilteredInvoices() {
  let list = [...S.invoices];
  if (regFilter.clientId) {
    const cid = parseInt(regFilter.clientId);
    list = list.filter(i => i.clientId === cid);
  }
  if (regFilter.month) {
    list = list.filter(i => i.date && i.date.startsWith(regFilter.month));
  }
  if (regFilter.search) {
    const q = regFilter.search.toLowerCase();
    list = list.filter(i =>
      (i.displayNumber || '').toLowerCase().includes(q) ||
      (i.clientName || '').toLowerCase().includes(q)
    );
  }
  if (regFilter.state) {
    if (regFilter.state === 'cancelled') {
      list = list.filter(i => i.status === 'cancelled');
    } else {
      list = list.filter(i => i.status === 'active' && getInvState(i) === regFilter.state);
    }
  }
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return list;
}

function renderRegisterToolbar() {
  const area = document.getElementById('regToolbar');
  if (!area) return;

  // Build unique client list for filter dropdown
  const clientIds = [...new Set(S.invoices.map(i => i.clientId))];
  const clientOpts = clientIds.map(cid => {
    const c = S.clients.find(x => x.id === cid);
    return c ? '<option value="' + cid + '"' + (regFilter.clientId == cid ? ' selected' : '') + '>' + escHtml(c.name) + '</option>' : '';
  }).join('');

  let html = '<div class="inv-reg-toolbar">' +
    '<div class="inv-search-wrap inv-search-no-mb">' +
    '<svg class="inv-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' +
    '<input type="text" class="inv-reg-search" id="regSearch" placeholder="Search invoice or client" value="' + escHtml(regFilter.search) + '" autocomplete="off"></div>' +
    '<div class="inv-reg-filters">' +
    '<div class="inv-form-group"><select class="inv-form-select" id="regClientFilter" data-action="invFilterRegister">' +
    '<option value="">All Clients</option>' + clientOpts + '</select></div>' +
    '<div class="inv-form-group"><input type="month" class="inv-form-input inv-mono" id="regMonthFilter" value="' + escHtml(regFilter.month) + '" data-action="invFilterRegister"></div>' +
    '<div class="inv-form-group"><select class="inv-form-select" id="regStateFilter" data-action="invFilterRegister">' +
    '<option value=""' + (!regFilter.state ? ' selected' : '') + '>All States</option>' +
    '<option value="created"' + (regFilter.state === 'created' ? ' selected' : '') + '>Created</option>' +
    '<option value="dispatched"' + (regFilter.state === 'dispatched' ? ' selected' : '') + '>Dispatched</option>' +
    '<option value="delivered"' + (regFilter.state === 'delivered' ? ' selected' : '') + '>Delivered</option>' +
    '<option value="filed"' + (regFilter.state === 'filed' ? ' selected' : '') + '>Filed</option>' +
    '<option value="cancelled"' + (regFilter.state === 'cancelled' ? ' selected' : '') + '>Cancelled</option></select></div>' +
    '</div></div>';

  area.innerHTML = html;

  // Bind debounced search (200ms)
  const searchEl = document.getElementById('regSearch');
  if (searchEl) {
    searchEl.addEventListener('input', function() {
      regFilter.search = this.value;
      saveRegFilter();
      clearTimeout(_regSearchTimer);
      _regSearchTimer = setTimeout(function() { renderRegisterList(); }, 200);
    });
  }
}

function renderRegisterList() {
  const area = document.getElementById('regList');
  if (!area) return;

  const filtered = getFilteredInvoices();
  const activeFiltered = filtered.filter(i => i.status === 'active');
  const activeCount = activeFiltered.length;
  const activeRevenue = gstRound(activeFiltered.reduce((s, i) => s + (i.taxableValue || 0), 0));

  let html = '';

  // Summary bar
  html += '<div class="inv-reg-summary">' +
    '<span class="inv-reg-summary-label">' + activeCount + ' active invoice' + (activeCount !== 1 ? 's' : '') + '</span>' +
    '<span class="inv-reg-summary-value">Taxable: ' + formatCurrency(activeRevenue) + '</span></div>';

  // Invoice rows
  if (filtered.length === 0) {
    html += '<div class="inv-empty-state">No invoices found</div>';
  } else {
    html += '<div class="inv-card-list">';
    filtered.forEach(inv => {
      const cancelled = inv.status === 'cancelled';
      html += '<div class="inv-reg-row' + (cancelled ? ' inv-reg-row-cancelled' : '') + '" data-action="invViewInvoiceDetail" data-id="' + escHtml(inv.id) + '">' +
        '<div class="inv-reg-row-top">' +
        '<div class="inv-reg-status-row">' +
        '<span class="inv-reg-invnum">' + escHtml(inv.displayNumber) + '</span> ' +
        getStateBadgeHtml(inv) +
        '</div>' +
        '<div class="inv-reg-amounts"><span class="inv-reg-total">' + formatCurrency(inv.grandTotal) + '</span>' +
        '<span class="inv-reg-taxable">Taxable: ' + formatCurrency(inv.taxableValue) + '</span></div></div>' +
        '<div class="inv-reg-row-bottom">' +
        '<span class="inv-reg-client">' + escHtml(inv.clientName) + '</span>' +
        '<span class="inv-reg-date">' + formatDate(inv.date) + '</span></div></div>';
    });
    html += '</div>';
  }

  // Export + bulk actions
  html += '<div class="inv-reg-export-bar">' +
    '<button class="inv-btn inv-btn-ghost" data-action="invExportSales">Sales Register CSV</button>' +
    '<button class="inv-btn inv-btn-ghost" data-action="invExportGstr1">GSTR1 CSV</button></div>' +
    '<div class="inv-reg-export-bar">' +
    '<button class="inv-btn inv-btn-ghost" data-action="invBulkMarkFiled">Bulk Mark Filed</button></div>';

  area.innerHTML = html;
}

/* Backward-compat: renderRegister calls both */
function renderRegister() {
  _regToolbarRendered = false;
  renderRegisterToolbar();
  _regToolbarRendered = true;
  renderRegisterList();
}

/* Invoice detail overlay (Read intent) — consumes formatInvoiceData (Phase 5 refactor) */
function openInvoiceDetail(invId) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv) return;
  const d = formatInvoiceData(inv);

  let html = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Invoice Detail</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay" aria-label="Close">&times;</button></div>';

  // Status badge if cancelled
  if (d.cancelled) {
    html += '<div class="inv-confirm-warn">This invoice was cancelled on ' +
      escHtml(d.cancelledAt || 'unknown date') +
      '. It cannot be edited.</div>';
  }

  // Header info
  html += '<div class="inv-detail-section">' +
    '<div class="inv-form-row">' +
    '<div><div class="inv-detail-label">Invoice No</div><div class="inv-detail-value-mono">' + escHtml(d.invoiceNumber) + '</div></div>' +
    '<div><div class="inv-detail-label">Date</div><div class="inv-detail-value-mono">' + escHtml(d.date) + '</div></div></div></div>';

  html += '<div class="inv-detail-section">' +
    '<div class="inv-detail-label">Client</div>' +
    '<div class="inv-detail-value">' + escHtml(d.clientName) + '</div>' +
    '<div class="inv-detail-value-mono inv-text-muted inv-detail-gstin">' + escHtml(d.clientGSTIN) + '</div></div>';

  // Lifecycle state timeline
  if (!d.cancelled) {
    var curState = getInvState(inv);
    var curIdx = INV_STATES.indexOf(curState);
    html += '<div class="inv-detail-section inv-state-timeline">' +
      '<div class="inv-detail-label">Status</div>';
    var stateData = [
      { key: 'created', label: 'Created', ts: inv.createdAt },
      { key: 'dispatched', label: 'Dispatched', ts: inv.dispatchedAt },
      { key: 'delivered', label: 'Delivered', ts: inv.deliveredAt },
      { key: 'filed', label: 'Filed', ts: inv.filedAt }
    ];
    stateData.forEach(function(sd, si) {
      var done = si <= curIdx;
      var isCurrent = si === curIdx;
      html += '<div class="inv-state-step">' +
        '<span class="inv-state-dot' + (done ? (isCurrent ? ' inv-state-dot-current' : ' inv-state-dot-done') : '') + '"></span>' +
        '<span class="inv-state-step-label">' + escHtml(sd.label) + '</span>' +
        (sd.ts ? '<span class="inv-state-step-date">' + formatTimestamp(sd.ts) + '</span>' : '') +
        '</div>';
    });
    // Advance button
    if (curIdx < INV_STATES.length - 1) {
      var nextLabel = INV_STATE_LABELS[INV_STATES[curIdx + 1]];
      html += '<div class="inv-btn-bar inv-mb-8"><button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invAdvanceState" data-id="' + escHtml(inv.id) + '">Mark ' + escHtml(nextLabel) + '</button></div>';
    }
    html += '</div>';
  }

  // Line items table
  html += '<div class="inv-detail-section">' +
    '<div class="inv-detail-label">Line Items</div>' +
    '<div class="inv-detail-items-wrap"><table class="inv-detail-items-table"><thead><tr>' +
    '<th>Part</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead><tbody>';
  d.items.forEach(function(item) {
    html += '<tr>' +
      '<td>' + escHtml(item.desc) + '</td>' +
      '<td class="inv-mono">' + escHtml(item.qty) + (item.nosQtyRaw && item.nosQtyRaw > 0 ? ' <span class="inv-text-muted">(' + escHtml(item.nosQtyRaw) + ' NOS)</span>' : '') + '</td>' +
      '<td>' + escHtml(item.unit) + '</td>' +
      '<td class="inv-mono">' + escHtml(item.rate) + '</td>' +
      '<td class="inv-mono">' + escHtml(item.amount) + '</td></tr>';
  });
  html += '</tbody></table></div></div>';

  // Totals — from formatted data
  html += '<div class="inv-detail-section"><div class="inv-totals">' +
    '<div class="inv-total-row"><span class="inv-total-label">Taxable Value</span><span class="inv-total-value">' + escHtml(d.taxableValue) + '</span></div>';
  if (d.gstType === 'intra') {
    html += '<div class="inv-total-row"><span class="inv-total-label">CGST @ ' + d.cgstPer + '%</span><span class="inv-total-value">' + escHtml(d.cgstAmt) + '</span></div>' +
      '<div class="inv-total-row"><span class="inv-total-label">SGST @ ' + d.sgstPer + '%</span><span class="inv-total-value">' + escHtml(d.sgstAmt) + '</span></div>';
  } else {
    html += '<div class="inv-total-row"><span class="inv-total-label">IGST @ ' + d.igstPer + '%</span><span class="inv-total-value">' + escHtml(d.igstAmt) + '</span></div>';
  }
  html += '<div class="inv-total-row inv-total-row-grand"><span class="inv-total-label">Grand Total</span>' +
    '<span class="inv-total-grand">' + escHtml(d.grandTotal) + '</span></div></div></div>';

  // Optional fields
  const optFields = [
    ['Challan No', d.challanNo], ['Challan Date', d.challanDate],
    ['Remarks', d.remarks]
  ].filter(f => f[1]);
  if (optFields.length > 0) {
    html += '<div class="inv-detail-section">';
    optFields.forEach(([label, val]) => {
      html += '<div class="inv-detail-label">' + escHtml(label) + '</div>' +
        '<div class="inv-detail-value">' + escHtml(val) + '</div>';
    });
    html += '</div>';
  }

  // Action buttons
  var invState = getInvState(inv);
  var nextStateIdx = INV_STATES.indexOf(invState) + 1;
  var nextState = nextStateIdx < INV_STATES.length ? INV_STATES[nextStateIdx] : null;

  // State timeline
  if (!d.cancelled) {
    html += '<div class="inv-detail-section"><div class="inv-detail-label">Status</div>' +
      '<div class="inv-state-timeline">';
    INV_STATES.forEach(function(st, i) {
      var done = INV_STATES.indexOf(invState) >= i;
      var current = invState === st;
      var tsMap = { created: inv.createdAt, dispatched: inv.dispatchedAt, delivered: inv.deliveredAt, filed: inv.filedAt };
      html += '<div class="inv-state-step">' +
        '<span class="inv-state-dot' + (done ? ' inv-state-dot-done' : '') + (current ? ' inv-state-dot-current' : '') + '"></span>' +
        '<span class="inv-state-step-label">' + escHtml(INV_STATE_LABELS[st]) + '</span>' +
        (tsMap[st] ? '<span class="inv-state-step-date">' + formatTimestamp(tsMap[st]) + '</span>' : '') +
        '</div>';
    });
    html += '</div>';
    if (nextState) {
      html += '<button class="inv-btn inv-btn-primary inv-btn-block" data-action="invAdvanceState" data-id="' + escHtml(inv.id) + '">Mark as ' + escHtml(INV_STATE_LABELS[nextState]) + '</button>';
    }
    html += '</div>';
  }

  html += '<div class="inv-detail-actions">';
  if (!d.cancelled) {
    html += '<button class="inv-btn inv-btn-primary" data-action="invEditInvoice" data-id="' + escHtml(inv.id) + '">Edit</button>';
    html += '<button class="inv-btn inv-btn-ghost" data-action="invPreviewInvoice" data-id="' + escHtml(inv.id) + '">Preview</button>';
    html += '<button class="inv-btn inv-btn-ghost" data-action="invCancelInvoice" data-id="' + escHtml(inv.id) + '">Cancel Invoice</button>';
  } else {
    html += '<button class="inv-btn inv-btn-ghost" data-action="invPreviewInvoice" data-id="' + escHtml(inv.id) + '">Preview</button>';
  }
  html += '<button class="inv-btn inv-btn-danger" data-action="invDeleteInvoice" data-id="' + escHtml(inv.id) + '">Delete</button>';
  html += '</div></div>';

  const scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = html;
  scrim.addEventListener('click', function(e) { if (e.target === scrim) { scrim.remove(); document.body.style.overflow = ''; popFocus(); } });
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

/* Edit invoice — loads into Create Invoice in edit mode */
function editInvoice(invId) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv) return;
  if (inv.status === 'cancelled') {
    showToast('Cancelled invoices cannot be edited', 'warning');
    return;
  }

  // Check cross-month warning
  const now = new Date();
  const curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const invMonth = inv.date ? inv.date.substring(0, 7) : '';
  let editToast = 'Editing ' + inv.displayNumber;
  if (invMonth && invMonth !== curMonth) {
    const monthNames = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
    const parts = invMonth.split('-');
    const mName = monthNames[parseInt(parts[1])] + ' ' + parts[0];
    editToast += ' (' + mName + ' — may affect filed returns)';
  }

  // Load into form
  invoiceForm = {
    clientId: inv.clientId,
    date: inv.date,
    items: inv.items.map(i => ({...i, _override: false, _label: ''})),
    poNumber: inv.poNumber || '',
    poDate: inv.poDate || localDateStr(),
    challanNo: inv.challanNo || '',
    challanDate: inv.challanDate || localDateStr(),
    despatchDate: inv.despatchDate || localDateStr(),
    transport: inv.transport || '',
    eWayBill: inv.eWayBill || '',
    remarks: inv.remarks || '',
    editingId: inv.id
  };
  closeOverlay();
  _navReturnTab = 'pageRegister';
  renderCreateForm();
  switchTab('pageCreate');
  showToast(editToast, 'warning');
}

/* Cancel invoice — set status to cancelled, unlink IM */
function cancelInvoice(invId) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv || inv.status === 'cancelled') return;

  // Show confirmation overlay (Act intent)
  const scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Cancel Invoice</span>' +
    '<button class="inv-overlay-close" data-action="invCloseConfirm">&times;</button></div>' +
    '<div class="inv-confirm-body">Cancel invoice <strong>' + escHtml(inv.displayNumber) + '</strong>?<br>This invoice will appear as cancelled in your GSTR1 export. The customer should be notified. This cannot be undone.</div>' +
    '<div class="inv-btn-bar"><button class="inv-btn inv-btn-ghost" data-action="invCloseConfirm">Keep Active</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invConfirmCancel" data-id="' + escHtml(inv.id) + '">Cancel Invoice</button></div></div>';
  // Act overlay: scrim tap does nothing (DP 5.2)
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

function confirmCancelInvoice(invId) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv) return;
  inv.status = 'cancelled';
  inv.cancelledAt = Date.now();
  inv.updatedAt = Date.now();
  // Unlink IM items (item-level, not entry-level)
  if (inv.linkedIMIds && inv.linkedIMIds.length > 0) {
    inv.linkedIMIds.forEach(imId => {
      const im = (S.incomingMaterial || []).find(m => m.id === imId);
      if (im) {
        im.items.forEach(it => {
          if (it.invoiceId === inv.id) { it.invoiced = false; it.invoiceId = null; }
        });
      }
    });
  }
  saveState();
  closeOverlay();
  renderRegister();
  showToast('Invoice ' + inv.displayNumber + ' cancelled');
}

/* Delete invoice — hard delete with filing cutoff tiered warning */
function deleteInvoice(invId) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv) return;

  // Filing cutoff: invoice month + 1 month + 5 days
  const invDate = new Date(inv.date + 'T00:00:00');
  const filingDeadline = new Date(invDate.getFullYear(), invDate.getMonth() + 2, 5);
  const now = new Date();
  const pastDeadline = now >= filingDeadline;

  const scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';

  let warnHtml = '';
  let bodyText = '';
  let btnClass = '';

  if (pastDeadline) {
    // Tier 3: past filing deadline
    warnHtml = '<div class="inv-confirm-warn">This invoice may have been included in a filed GST return. Cancelling (not deleting) is recommended.</div>';
    bodyText = 'Permanently delete invoice <strong>' + escHtml(inv.displayNumber) + '</strong>? This cannot be undone.';
    btnClass = 'inv-btn-danger';
  } else {
    // Tier 2: before filing deadline
    bodyText = 'Delete invoice <strong>' + escHtml(inv.displayNumber) + '</strong>? This number will be available for reuse.';
    btnClass = 'inv-btn-primary';
  }

  scrim.innerHTML = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Delete Invoice</span>' +
    '<button class="inv-overlay-close" data-action="invCloseConfirm">&times;</button></div>' +
    warnHtml +
    '<div class="inv-confirm-body">' + bodyText + '</div>' +
    '<div class="inv-btn-bar"><button class="inv-btn inv-btn-ghost" data-action="invCloseConfirm">Keep</button>' +
    '<button class="inv-btn ' + btnClass + '" data-action="invConfirmDelete" data-id="' + escHtml(inv.id) + '">Delete</button></div></div>';
  // Act overlay: scrim tap does nothing (DP 5.2)
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

function confirmDeleteInvoice(invId) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv) return;
  const dispNum = inv.displayNumber;
  // Unlink IM items (item-level, not entry-level)
  if (inv.linkedIMIds && inv.linkedIMIds.length > 0) {
    inv.linkedIMIds.forEach(imId => {
      const im = (S.incomingMaterial || []).find(m => m.id === imId);
      if (im) {
        im.items.forEach(it => {
          if (it.invoiceId === inv.id) { it.invoiced = false; it.invoiceId = null; }
        });
      }
    });
  }
  // Hard delete from array
  const idx = S.invoices.indexOf(inv);
  if (idx > -1) S.invoices.splice(idx, 1);

  // Recycle invoice number: recalculate invNextNum
  if (S.invoices.length === 0) {
    S.invNextNum = 1;
  } else {
    const maxNum = S.invoices.reduce(function(max, inv) {
      const n = parseInt(inv.invoiceNumber);
      return n > max ? n : max;
    }, 0);
    S.invNextNum = maxNum + 1;
  }

  saveState();
  closeOverlay();
  renderRegister();
  showToast('Invoice ' + dispNum + ' deleted');
}

