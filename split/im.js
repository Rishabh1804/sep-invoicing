/* ===== INCOMING MATERIAL (Phase 3) ===== */
let _imExpanded = {};
let _imSelected = {}; // keyed by item id: true/false
let _imFilter = { clientId: '', status: '' }; // '' = all
let _imToolbarRendered = false;
var _imActiveChallanId = null;

/* Unified IM sort accessor (Phase 8D) */
function getIMSortConfig() {
  if (_isDesktop && _imFilter.desktopSort) return _imFilter.desktopSort;
  return null; // mobile uses inline sort logic, not config-driven
}

function getIMStatus(im) {
  const total = im.items.length;
  const invoicedCount = im.items.filter(it => it.invoiced).length;
  if (invoicedCount === 0) return 'pending';
  if (invoicedCount < total) return 'partial';
  return 'invoiced';
}

function getFilteredIM() {
  let list = [...(S.incomingMaterial || [])];
  if (_imFilter.clientId) {
    const cid = parseInt(_imFilter.clientId);
    list = list.filter(im => im.clientId === cid);
  }
  if (_imFilter.status) {
    list = list.filter(im => getIMStatus(im) === _imFilter.status);
  }
  // Sort: desktop uses multi-column, mobile uses pending-first + date desc
  if (_isDesktop) {
    var sc = getIMSortConfig();
    if (sc) {
      var dir = sc.dir === 'asc' ? 1 : -1;
      list.sort(function(a, b) {
        var va, vb;
        switch (sc.col) {
          case 'client': va = (a.clientName || '').toLowerCase(); vb = (b.clientName || '').toLowerCase(); return va < vb ? -dir : va > vb ? dir : 0;
          case 'date': va = a.challanDate || ''; vb = b.challanDate || ''; return va < vb ? -dir : va > vb ? dir : 0;
          case 'items': return dir * (a.items.length - b.items.length);
          case 'amount': {
            var ta = a.items.reduce(function(s, it) { return s + (it.amount || 0); }, 0);
            var tb = b.items.reduce(function(s, it) { return s + (it.amount || 0); }, 0);
            return dir * (ta - tb);
          }
          case 'status': {
            var so = { pending: 0, partial: 1, invoiced: 2 };
            va = so[getIMStatus(a)] || 0;
            vb = so[getIMStatus(b)] || 0;
            return dir * (va - vb);
          }
          default: va = a.challanDate || ''; vb = b.challanDate || ''; return va < vb ? -dir : va > vb ? dir : 0;
        }
      });
    } else {
      // Desktop with no explicit sort: same as mobile default
      list.sort(function(a, b) {
        var sa = getIMStatus(a) === 'invoiced' ? 1 : 0;
        var sb = getIMStatus(b) === 'invoiced' ? 1 : 0;
        if (sa !== sb) return sa - sb;
        return (b.challanDate || '').localeCompare(a.challanDate || '') || (b.createdAt || 0) - (a.createdAt || 0);
      });
    }
  } else {
    list.sort(function(a, b) {
      var sa = getIMStatus(a) === 'invoiced' ? 1 : 0;
      var sb = getIMStatus(b) === 'invoiced' ? 1 : 0;
      if (sa !== sb) return sa - sb;
      return (b.challanDate || '').localeCompare(a.challanDate || '') || (b.createdAt || 0) - (a.createdAt || 0);
    });
  }
  return list;
}

function renderIMToolbar() {
  const area = document.getElementById('imToolbar');
  if (!area) return;
  const clientIds = [...new Set((S.incomingMaterial || []).map(im => im.clientId))];
  const clientOpts = clientIds.map(cid => {
    const c = S.clients.find(x => x.id === cid);
    return c ? '<option value="' + cid + '"' + (_imFilter.clientId == cid ? ' selected' : '') + '>' + escHtml(c.name) + '</option>' : '';
  }).join('');

  area.innerHTML = '<div class="inv-im-toolbar">' +
    '<div class="inv-form-group"><select class="inv-form-select" id="imClientFilter" data-action="invFilterIM">' +
    '<option value="">All Clients</option>' + clientOpts + '</select></div>' +
    '<div class="inv-form-group"><select class="inv-form-select" id="imStatusFilter" data-action="invFilterIM">' +
    '<option value=""' + (!_imFilter.status ? ' selected' : '') + '>All Status</option>' +
    '<option value="pending"' + (_imFilter.status === 'pending' ? ' selected' : '') + '>Pending</option>' +
    '<option value="partial"' + (_imFilter.status === 'partial' ? ' selected' : '') + '>Partial</option>' +
    '<option value="invoiced"' + (_imFilter.status === 'invoiced' ? ' selected' : '') + '>Invoiced</option></select></div></div>';
}

function renderIMList() {
  const area = document.getElementById('imList');
  if (!area) return;
  const filtered = getFilteredIM();
  const pendingCount = filtered.filter(im => getIMStatus(im) !== 'invoiced').length;

  let html = '<div class="inv-im-summary">' +
    '<span class="inv-reg-summary-label">' + filtered.length + ' challan' + (filtered.length !== 1 ? 's' : '') +
    ' (' + pendingCount + ' pending)</span></div>';

  if (filtered.length === 0) {
    html += '<div class="inv-empty-state">No incoming material found</div>';
  } else {
    filtered.forEach(im => {
      const status = getIMStatus(im);
      const expanded = _imExpanded[im.id] || false;
      const challanTotal = im.items.reduce((s, it) => s + (it.amount || 0), 0);
      const pendingItems = im.items.filter(it => !it.invoiced);
      const allPendingChecked = pendingItems.length > 0 && pendingItems.every(it => _imSelected[it.id]);

      html += '<div class="inv-im-challan">' +
        '<div class="inv-im-header" data-action="invToggleIM" data-id="' + escHtml(im.id) + '">' +
        (status !== 'invoiced' ? '<input type="checkbox" class="inv-im-check" data-action="invCheckIMChallan" data-id="' + escHtml(im.id) + '"' + (allPendingChecked ? ' checked' : '') + '>' : '') +
        '<div class="inv-im-info">' +
        '<div class="inv-im-challan-num">' + (im.challanNo ? 'Ch. ' + escHtml(im.challanNo) : 'No challan no.') +
        ' <span class="inv-im-status inv-im-status-' + status + '">' + status + '</span></div>' +
        '<div class="inv-im-client">' + escHtml(im.clientName) + '</div>' +
        '<div class="inv-im-meta">' + formatDate(im.challanDate) +
        (im.vehicleNo ? ' &middot; ' + escHtml(im.vehicleNo) : '') +
        ' &middot; ' + im.items.length + ' item' + (im.items.length > 1 ? 's' : '') + '</div></div>' +
        '<span class="inv-im-amount">' + formatCurrency(challanTotal) + '</span>' +
        '<svg class="inv-im-chevron' + (expanded ? ' inv-im-chevron-open' : '') + '" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>';

      // Line items (expandable)
      html += '<div class="inv-im-items' + (expanded ? ' inv-im-items-open' : '') + '">';
      im.items.forEach(it => {
        const itemInvoiced = it.invoiced;
        var invBadgeHtml = '';
        if (itemInvoiced) {
          var linkedInv = it.invoiceId ? S.invoices.find(function(iv) { return iv.id === it.invoiceId; }) : null;
          if (linkedInv) {
            var shortNum = linkedInv.invoiceNumber || linkedInv.displayNumber;
            invBadgeHtml = '<span class="inv-im-status inv-im-status-invoiced inv-mono" title="' + escHtml(linkedInv.displayNumber) + '">INV ' + escHtml(shortNum) + '</span>';
          } else {
            invBadgeHtml = '<span class="inv-im-status inv-im-status-orphan" title="Invoice deleted — tap to repair">INV (missing)</span>';
          }
        }
        html += '<div class="inv-im-item' + (itemInvoiced ? ' inv-im-item-invoiced' : '') + '">' +
          (!itemInvoiced ? '<input type="checkbox" class="inv-im-check" data-action="invCheckIMItem" data-item-id="' + escHtml(it.id) + '"' + (_imSelected[it.id] ? ' checked' : '') + '>' :
          invBadgeHtml) +
          '<div class="inv-im-item-info">' +
          '<div class="inv-im-item-desc">' + escHtml(it.desc || it.partNumber) + '</div>' +
          '<div class="inv-im-item-detail">' + escHtml(it.qty) + ' ' + escHtml(it.unit) +
          (it.nosQty && it.nosQty > 0 ? ' (' + escHtml(it.nosQty) + ' NOS)' : '') +
          ' @ ' + formatCurrency(it.rate) + '/' + escHtml(it.unit) + '</div></div>' +
          '<span class="inv-im-item-amount">' + formatCurrency(it.amount) + '</span></div>';
      });
      // Delete + Edit buttons (only if zero items invoiced)
      if (status !== 'invoiced' && im.items.filter(it => it.invoiced).length === 0) {
        html += '<div class="inv-btn-bar inv-im-delete-bar">' +
          '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invEditChallan" data-id="' + escHtml(im.id) + '">Edit</button>' +
          '<button class="inv-btn inv-btn-ghost inv-btn-sm inv-text-danger" data-action="invDeleteChallan" data-id="' + escHtml(im.id) + '">Delete Challan</button></div>';
      } else if (status !== 'invoiced') {
        // Partially invoiced: show disabled edit with toast guard
        var invoicedItemCount = im.items.filter(function(it2) { return it2.invoiced; }).length;
        html += '<div class="inv-btn-bar inv-im-delete-bar">' +
          '<button class="inv-btn inv-btn-ghost inv-btn-sm inv-btn-disabled" data-action="invEditChallanGuard" data-count="' + invoicedItemCount + '">Edit</button></div>';
      }
      html += '</div></div>';
    });
  }
  area.innerHTML = html;
  renderIMSelBar();
}

function renderIMSelBar() {
  const bar = document.getElementById('imSelBar');
  const fab = document.getElementById('imFabBar');
  if (!bar) return;
  const selectedIds = Object.keys(_imSelected).filter(k => _imSelected[k]);
  if (selectedIds.length === 0) {
    bar.innerHTML = '';
    if (fab) fab.classList.remove('inv-hidden');
    return;
  }
  if (fab) fab.classList.add('inv-hidden');
  // Calculate total of selected items
  let total = 0;
  (S.incomingMaterial || []).forEach(im => {
    im.items.forEach(it => {
      if (_imSelected[it.id]) total += (it.amount || 0);
    });
  });
  // Check if all selected items belong to one client
  const clientIds = new Set();
  (S.incomingMaterial || []).forEach(im => {
    im.items.forEach(it => {
      if (_imSelected[it.id]) clientIds.add(im.clientId);
    });
  });
  const multiClient = clientIds.size > 1;

  bar.innerHTML = '<div class="inv-im-sel-bar">' +
    '<span class="inv-im-sel-count">' + selectedIds.length + ' item' + (selectedIds.length > 1 ? 's' : '') +
    ' &middot; ' + formatCurrency(total) + '</span>' +
    '<button class="inv-im-sel-btn" data-action="invCreateFromIM"' + (multiClient ? ' disabled title="Select items from one client only"' : '') + '>' +
    (multiClient ? 'Multi-client' : 'Create Invoice') + '</button></div>';
}

/* ===== IM DESKTOP TABLE (Phase 8D) ===== */

function _buildIMTableHtml() {
  var filtered = getFilteredIM();
  var pendingCount = filtered.filter(function(im) { return getIMStatus(im) !== 'invoiced'; }).length;

  var html = '<div class="inv-im-summary">' +
    '<span class="inv-reg-summary-label">' + filtered.length + ' challan' + (filtered.length !== 1 ? 's' : '') +
    ' (' + pendingCount + ' pending)</span></div>';

  if (filtered.length === 0) {
    html += '<div class="inv-empty-state">No incoming material found</div>';
    return html;
  }

  var sc = getIMSortConfig();

  html += '<table class="inv-desktop-table"><thead><tr>';
  html += '<th class="inv-th inv-td-check"></th>';
  html += '<th class="inv-th inv-td-challan">Challan</th>';

  var cols = [
    { key: 'client', label: 'Client', cls: '' },
    { key: 'date', label: 'Date', cls: 'inv-td-date' },
    { key: 'items', label: 'Items', cls: 'inv-td-items' },
    { key: 'amount', label: 'Amount', cls: 'inv-td-amount inv-th-amount' },
    { key: 'status', label: 'Status', cls: 'inv-td-status' }
  ];
  cols.forEach(function(c) {
    html += '<th class="inv-th inv-th-sortable' + (c.cls ? ' ' + c.cls : '') + '" data-action="invDesktopIMSort" data-col="' + c.key + '">' +
      c.label + (sc && sc.col === c.key ? '<span class="inv-sort-arrow">' + (sc.dir === 'asc' ? '\u25B2' : '\u25BC') + '</span>' : '') +
      '</th>';
  });
  html += '</tr></thead><tbody>';

  filtered.forEach(function(im) {
    var status = getIMStatus(im);
    var isActive = _imActiveChallanId === im.id;
    var challanTotal = im.items.reduce(function(s, it) { return s + (it.amount || 0); }, 0);
    var pendingItems = im.items.filter(function(it) { return !it.invoiced; });
    var allPendingChecked = pendingItems.length > 0 && pendingItems.every(function(it) { return _imSelected[it.id]; });

    html += '<tr class="inv-tr' + (isActive ? ' inv-tr-active' : '') + '" data-id="' + escHtml(im.id) + '">';

    // Checkbox cell
    if (status !== 'invoiced') {
      html += '<td class="inv-td inv-td-check"><input type="checkbox" data-action="invCheckIMChallan" data-id="' + escHtml(im.id) + '"' + (allPendingChecked ? ' checked' : '') + '></td>';
    } else {
      html += '<td class="inv-td inv-td-check"></td>';
    }

    // Challan number (monospace)
    html += '<td class="inv-td inv-td-challan" data-action="invSelectIMRow" data-id="' + escHtml(im.id) + '">' +
      (im.challanNo ? escHtml(im.challanNo) : '\u2014') + '</td>';

    // Content cells — all get invSelectIMRow
    html += '<td class="inv-td" data-action="invSelectIMRow" data-id="' + escHtml(im.id) + '">' + escHtml(im.clientName) + '</td>';
    html += '<td class="inv-td inv-td-date" data-action="invSelectIMRow" data-id="' + escHtml(im.id) + '">' + formatDate(im.challanDate) + '</td>';
    html += '<td class="inv-td inv-td-items" data-action="invSelectIMRow" data-id="' + escHtml(im.id) + '">' + im.items.length + '</td>';
    html += '<td class="inv-td inv-td-amount" data-action="invSelectIMRow" data-id="' + escHtml(im.id) + '">' + formatCurrency(challanTotal) + '</td>';

    // Status badge (inline, no helper function)
    html += '<td class="inv-td inv-td-status" data-action="invSelectIMRow" data-id="' + escHtml(im.id) + '">' +
      '<span class="inv-im-status inv-im-status-' + status + '">' + status + '</span></td>';

    html += '</tr>';
  });

  html += '</tbody></table>';

  // IM FAB bar (Add Challan + Scan buttons visible on desktop too)
  html += '<div class="inv-im-fab-bar" id="imFabBarDesktop">' +
    '<button class="inv-btn inv-btn-primary" data-action="invShowAddChallan">Add Challan</button>' +
    '<button class="inv-btn inv-btn-ghost" data-action="invScanChallan">Scan</button></div>';

  return html;
}

/* Render challan detail inline in #imDetail (Phase 8D) */
function _renderIMDetail(challanId, skipMasterRefresh) {
  var im = (S.incomingMaterial || []).find(function(m) { return m.id === challanId; });
  if (!im) {
    _imActiveChallanId = null;
    var detail = document.getElementById('imDetail');
    if (detail) detail.innerHTML = _renderDetailEmpty();
    if (!skipMasterRefresh) {
      var master = document.getElementById('imMaster');
      if (master) master.innerHTML = _buildIMTableHtml();
    }
    return;
  }

  _imActiveChallanId = challanId;
  var status = getIMStatus(im);
  var challanTotal = im.items.reduce(function(s, it) { return s + (it.amount || 0); }, 0);
  var invoicedItemCount = im.items.filter(function(it) { return it.invoiced; }).length;

  var html = '';

  // Header: challan number + date
  html += '<div class="inv-detail-section">' +
    '<div class="inv-form-row">' +
    '<div><div class="inv-detail-label">Challan No</div><div class="inv-detail-value-mono">' +
    (im.challanNo ? escHtml(im.challanNo) : '\u2014') + '</div></div>' +
    '<div><div class="inv-detail-label">Date</div><div class="inv-detail-value-mono">' + formatDate(im.challanDate) + '</div></div></div></div>';

  // Client name
  html += '<div class="inv-detail-section">' +
    '<div class="inv-detail-label">Client</div>' +
    '<div class="inv-detail-value">' + escHtml(im.clientName) + '</div></div>';

  // Vehicle number (if present)
  if (im.vehicleNo) {
    html += '<div class="inv-detail-section">' +
      '<div class="inv-detail-label">Vehicle</div>' +
      '<div class="inv-detail-value">' + escHtml(im.vehicleNo) + '</div></div>';
  }

  // Status indicator
  html += '<div class="inv-detail-section">' +
    '<div class="inv-detail-label">Status</div>' +
    '<span class="inv-im-status inv-im-status-' + status + '">' + status + '</span></div>';

  // Line items with item-level checkboxes
  html += '<div class="inv-detail-section">' +
    '<div class="inv-detail-label">Items (' + im.items.length + ')</div>';
  im.items.forEach(function(it) {
    var itemInvoiced = it.invoiced;
    var invBadgeHtml = '';
    if (itemInvoiced) {
      var linkedInv = it.invoiceId ? S.invoices.find(function(iv) { return iv.id === it.invoiceId; }) : null;
      if (linkedInv) {
        var shortNum = linkedInv.invoiceNumber || linkedInv.displayNumber;
        invBadgeHtml = '<span class="inv-im-status inv-im-status-invoiced inv-mono" title="' + escHtml(linkedInv.displayNumber) + '">INV ' + escHtml(shortNum) + '</span>';
      } else {
        invBadgeHtml = '<span class="inv-im-status inv-im-status-orphan" title="Invoice deleted">INV (missing)</span>';
      }
    }
    html += '<div class="inv-im-item' + (itemInvoiced ? ' inv-im-item-invoiced' : '') + '">' +
      (!itemInvoiced ? '<input type="checkbox" class="inv-im-check" data-action="invCheckIMItem" data-item-id="' + escHtml(it.id) + '"' + (_imSelected[it.id] ? ' checked' : '') + '>' :
      invBadgeHtml) +
      '<div class="inv-im-item-info">' +
      '<div class="inv-im-item-desc">' + escHtml(it.desc || it.partNumber) + '</div>' +
      '<div class="inv-im-item-detail">' + escHtml(it.qty) + ' ' + escHtml(it.unit) +
      (it.nosQty && it.nosQty > 0 ? ' (' + escHtml(it.nosQty) + ' NOS)' : '') +
      ' @ ' + formatCurrency(it.rate) + '/' + escHtml(it.unit) + '</div></div>' +
      '<span class="inv-im-item-amount">' + formatCurrency(it.amount) + '</span></div>';
  });
  html += '</div>';

  // Total amount
  html += '<div class="inv-detail-section"><div class="inv-totals">' +
    '<div class="inv-total-row inv-total-row-grand"><span class="inv-total-label">Total</span>' +
    '<span class="inv-total-grand">' + formatCurrency(challanTotal) + '</span></div></div></div>';

  // Action buttons
  if (invoicedItemCount === 0) {
    // Zero items invoiced: Edit + Delete
    html += '<div class="inv-detail-actions">' +
      '<button class="inv-btn inv-btn-primary" data-action="invEditChallan" data-id="' + escHtml(im.id) + '">Edit</button>' +
      '<button class="inv-btn inv-btn-danger" data-action="invDeleteChallan" data-id="' + escHtml(im.id) + '">Delete</button></div>';
  } else if (status !== 'invoiced') {
    // Partially invoiced: disabled edit with guard
    html += '<div class="inv-detail-actions">' +
      '<button class="inv-btn inv-btn-ghost inv-btn-disabled" data-action="invEditChallanGuard" data-count="' + invoicedItemCount + '">Edit</button></div>';
  }
  // Fully invoiced: no action buttons (read-only)

  // Notes
  if (im.notes) {
    html += '<div class="inv-detail-section">' +
      '<div class="inv-detail-label">Notes</div>' +
      '<div class="inv-detail-value">' + escHtml(im.notes) + '</div></div>';
  }

  var detailEl = document.getElementById('imDetail');
  if (detailEl) detailEl.innerHTML = html;

  // Update master to show active row highlight
  if (!skipMasterRefresh) {
    var masterEl = document.getElementById('imMaster');
    if (masterEl) masterEl.innerHTML = _buildIMTableHtml();
  }
}

function renderIMTable() {
  var area = document.getElementById('imList');
  if (!area) return;

  if (!_imToolbarRendered) {
    renderIMToolbar();
    _imToolbarRendered = true;
  }

  var wrapper = document.getElementById('imMasterDetail');
  if (!wrapper) {
    // First render — build wrapper, init drag, restore width
    area.innerHTML =
      '<div class="inv-master-detail" id="imMasterDetail">' +
        '<div class="inv-master" id="imMaster"></div>' +
        '<div class="inv-drag-handle" id="imDragHandle"></div>' +
        '<div class="inv-detail" id="imDetail">' + _renderDetailEmpty() + '</div>' +
      '</div>';
    _initDragHandle('imDragHandle', 'imMaster', 'imDetail', 'pageIM');
    _restorePanelWidth('imMaster', 'pageIM');
  }

  // Re-render master content
  var master = document.getElementById('imMaster');
  if (!master) return;
  master.innerHTML = _buildIMTableHtml();

  // Detail panel validation: keep detail in sync with data changes
  if (_imActiveChallanId) {
    var stillExists = (S.incomingMaterial || []).find(function(m) { return m.id === _imActiveChallanId; });
    if (!stillExists) {
      // Deleted — clear detail
      _imActiveChallanId = null;
      var detail = document.getElementById('imDetail');
      if (detail) detail.innerHTML = _renderDetailEmpty();
    } else {
      // Check if active challan is still in filtered set
      var filtered = getFilteredIM();
      var inFiltered = filtered.find(function(m) { return m.id === _imActiveChallanId; });
      if (!inFiltered) {
        // Filtered out — clear detail
        _imActiveChallanId = null;
        var detail2 = document.getElementById('imDetail');
        if (detail2) detail2.innerHTML = _renderDetailEmpty();
      } else {
        // Still visible — refresh detail content (skip master since we just rendered it)
        _renderIMDetail(_imActiveChallanId, true);
      }
    }
  }

  renderIMSelBar();
}

/* View dispatcher (Phase 8B) */
function _renderIMView() {
  _isDesktop ? renderIMTable() : renderIMList();
}

function toggleIMExpand(imId) {
  _imExpanded[imId] = !_imExpanded[imId];
  _renderIMView();
}

function toggleIMItem(itemId) {
  _imSelected[itemId] = !_imSelected[itemId];
  if (!_imSelected[itemId]) delete _imSelected[itemId];
  _renderIMView();
}

function toggleIMChallan(imId) {
  const im = (S.incomingMaterial || []).find(m => m.id === imId);
  if (!im) return;
  const pendingItems = im.items.filter(it => !it.invoiced);
  const allChecked = pendingItems.every(it => _imSelected[it.id]);
  pendingItems.forEach(it => {
    if (allChecked) {
      delete _imSelected[it.id];
    } else {
      _imSelected[it.id] = true;
    }
  });
  _renderIMView();
}

function createInvoiceFromIM() {
  const selectedIds = Object.keys(_imSelected).filter(k => _imSelected[k]);
  if (selectedIds.length === 0) return;

  // Collect selected items and determine client
  const selectedItems = [];
  const linkedIMIds = new Set();
  let clientId = null;
  (S.incomingMaterial || []).forEach(im => {
    im.items.forEach(it => {
      if (_imSelected[it.id]) {
        selectedItems.push({ ...it, _imId: im.id, _challanNo: im.challanNo, _challanDate: im.challanDate, _vehicleNo: im.vehicleNo });
        linkedIMIds.add(im.id);
        clientId = im.clientId;
      }
    });
  });

  if (!clientId) return;
  const client = S.clients.find(c => c.id === clientId);
  if (!client) return;

  // Build invoice form
  invoiceForm = {
    clientId: clientId,
    date: localDateStr(),
    items: selectedItems.map(it => ({
      partNumber: it.partNumber,
      desc: it.desc,
      hsn: it.hsn || '998873',
      unit: it.unit,
      qty: it.qty,
      rate: it.rate || 0,
      amount: it.amount || 0,
      nosQty: it.nosQty || null,
      _override: false,
      _label: '',
      _imItemId: it.id
    })),
    poNumber: '', poDate: localDateStr(),
    challanNo: selectedItems.map(it => it._challanNo).filter(Boolean).filter((v,i,a) => a.indexOf(v) === i).join(', '),
    challanDate: selectedItems[0]._challanDate || localDateStr(),
    despatchDate: localDateStr(), transport: selectedItems.map(it => it._vehicleNo).filter(Boolean).filter((v,i,a) => a.indexOf(v) === i).join(', '), eWayBill: '',
    remarks: '',
    editingId: null,
    _linkedIMItemIds: selectedIds,
    _linkedIMIds: [...linkedIMIds]
  };

  // Clear selection
  _imSelected = {};

  renderCreateForm();
  switchTab('pageCreate');
  showToast(selectedItems.length + ' item' + (selectedItems.length > 1 ? 's' : '') + ' loaded from incoming material');
}

