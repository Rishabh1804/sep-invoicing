/* ===== INCOMING MATERIAL (Phase 3) ===== */
let _imExpanded = {};
let _imSelected = {}; // keyed by item id: true/false
let _imFilter = { clientId: '', status: '' }; // '' = all
let _imToolbarRendered = false;

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
  // Sort: pending first, then by date desc
  list.sort((a, b) => {
    const sa = getIMStatus(a) === 'invoiced' ? 1 : 0;
    const sb = getIMStatus(b) === 'invoiced' ? 1 : 0;
    if (sa !== sb) return sa - sb;
    return (b.challanDate || '').localeCompare(a.challanDate || '') || (b.createdAt || 0) - (a.createdAt || 0);
  });
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
          ' @ ' + escHtml(formatNum(it.rate)) + '/' + escHtml(it.unit) + '</div></div>' +
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

function toggleIMExpand(imId) {
  _imExpanded[imId] = !_imExpanded[imId];
  renderIMList();
}

function toggleIMItem(itemId) {
  _imSelected[itemId] = !_imSelected[itemId];
  if (!_imSelected[itemId]) delete _imSelected[itemId];
  renderIMList();
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
  renderIMList();
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

