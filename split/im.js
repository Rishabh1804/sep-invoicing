/* ===== INCOMING MATERIAL (Phase 3) ===== */
let _imExpanded = {};
let _imSelected = {}; // keyed by item id: true/false
let _imFilter = { clientId: '', status: '' }; // '' = all
let _imToolbarRendered = false;
var _imActiveChallanId = null;

/* A challan's billing state as a status (design principles §6.13): material waiting on an
   invoice is the caution; part-billed is information; fully invoiced is done. */
var IM_STATUS_UI = {
  pending: { word: 'Pending', tone: 'warning' },
  partial: { word: 'Part invoiced', tone: 'info' },
  invoiced: { word: 'Invoiced', tone: 'ok' }
};

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
  var opt = function(v, label) { return '<option value="' + v + '"' + ((_imFilter.status || '') === v ? ' selected' : '') + '>' + label + '</option>'; };

  const dupeCount = imDuplicateGroupCount();

  // The filters speak through change (events.js), never click: a click that re-rendered
  // the toolbar replaced the element the native list hangs off, and it shut unpicked.
  area.innerHTML = '<div class="inv-toolbar">' +
    '<select class="inv-select inv-toolbar-item" id="imClientFilter" aria-label="Filter by client">' +
    '<option value="">All clients</option>' + clientOpts + '</select>' +
    '<select class="inv-select inv-toolbar-item" id="imStatusFilter" aria-label="Filter by status">' +
    opt('', 'All statuses') + opt('pending', 'Pending') + opt('partial', 'Part invoiced') + opt('invoiced', 'Invoiced') + '</select>' +
    '<button class="inv-btn inv-btn-secondary" id="imDupeCheck" data-action="invRunDupeScan">Duplicate check' +
    (dupeCount > 0 ? '<span class="inv-badge inv-badge-warning" data-dupes>' + dupeCount + '</span>' : '') + '</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invScanChallan">' + ICON_CAMERA + 'Scan</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invShowAddChallan">Add challan</button>' +
    '</div>';
}

function renderIMList() {
  const area = document.getElementById('imList');
  if (!area) return;
  const filtered = getFilteredIM();
  let html = _imSummaryHtml(filtered);

  if (filtered.length === 0) {
    html += '<div class="inv-panel"><div class="inv-empty">No incoming material found</div></div>';
  } else {
    // The list is the worklist: material still to bill first, then what is billed —
    // each grouped by challan date with the day's value (§7).
    [['open', 'Awaiting invoice'], ['done', 'Invoiced']].forEach(function(sec) {
      var list = filtered.filter(function(im) { return (getIMStatus(im) === 'invoiced') === (sec[0] === 'done'); });
      if (!list.length) return;
      html += '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">' + sec[1] +
        ' <span class="inv-panel-count">' + list.length + '</span></span></div>';
      var day = null;
      list.forEach(function(im, idx) {
        if (im.challanDate !== day) {
          day = im.challanDate;
          var same = list.filter(function(x) { return x.challanDate === day; });
          html += '<div class="inv-row-group"><span>' + (day ? escHtml(formatDate(day)) : 'No date') + ' · ' + same.length + '</span>' +
            '<span class="inv-num">' + formatCurrency(same.reduce(function(s, x) { return s + imChallanTotal(x); }, 0)) + '</span></div>';
        }
        var status = getIMStatus(im), expanded = !!_imExpanded[im.id];
        var pendingItems = im.items.filter(function(it) { return !it.invoiced; });
        var allChecked = pendingItems.length > 0 && pendingItems.every(function(it) { return _imSelected[it.id]; });
        var id = escHtml(im.id);
        html += '<div class="inv-row inv-row-2' + (allChecked ? ' inv-row-selected' : '') + '" data-im="' + id + '">' +
          (status !== 'invoiced' ? '<label class="inv-row-lead inv-row-tick"><input type="checkbox" class="inv-check" data-action="invCheckIMChallan" data-id="' + id + '"' +
            (allChecked ? ' checked' : '') + ' aria-label="Select all of ' + escHtml(imChallanLabel(im)) + '"></label>' : '') +
          '<button class="inv-row-main inv-row-expander" data-action="invToggleIM" data-id="' + id + '" aria-expanded="' + expanded + '">' +
          '<span class="inv-row-title"><span class="inv-id">' + escHtml(imChallanLabel(im)) + '</span> · ' + escHtml(im.clientName) + '</span>' +
          '<span class="inv-row-meta">' + (im.vehicleNo ? escHtml(im.vehicleNo) + ' · ' : '') + im.items.length + ' item' + (im.items.length !== 1 ? 's' : '') + '</span></button>' +
          '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + formatCurrency(imChallanTotal(im)) + '</span>' + imStatusDotHtml(im) + '</span></span></div>';
        if (expanded) {
          html += '<div class="inv-row-children">' + im.items.map(_imItemRowHtml).join('');
          var acts = _imActionsHtml(im, false);
          if (acts) html += '<div class="inv-row inv-row-auto"><span class="inv-toolbar inv-toolbar-tight">' + acts + '</span></div>';
          html += '</div>';
        }
      });
      html += '</div>';
    });
  }
  area.innerHTML = html;
  renderIMSelBar();
}

function renderIMSelBar() {
  const bar = document.getElementById('imSelBar');
  if (!bar) return;
  const selectedIds = Object.keys(_imSelected).filter(k => _imSelected[k]);
  if (selectedIds.length === 0) { bar.innerHTML = ''; return; }
  let total = 0;
  const clientIds = new Set();
  (S.incomingMaterial || []).forEach(im => {
    im.items.forEach(it => {
      if (_imSelected[it.id]) { total += (it.amount || 0); clientIds.add(im.clientId); }
    });
  });
  // An invoice is addressed to one customer: a two-client selection says so on the button.
  const multiClient = clientIds.size > 1;
  bar.innerHTML = '<div class="inv-selbar">' +
    '<span class="inv-selbar-count">' + selectedIds.length + ' item' + (selectedIds.length > 1 ? 's' : '') + '</span>' +
    '<span class="inv-selbar-sum">' + formatCurrency(total) + '</span>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCreateFromIM"' + (multiClient ? ' disabled title="Select items from one client only"' : '') + '>' +
    (multiClient ? 'Two clients selected' : 'Create invoice') + '</button></div>';
}

/* ===== IM DESKTOP TABLE (Phase 8D) ===== */

/* ===== IM DESKTOP TABLE ===== */
function _buildIMTableHtml() {
  var filtered = getFilteredIM();
  var html = _imSummaryHtml(filtered);
  if (filtered.length === 0) return html + '<div class="inv-empty">No incoming material found</div>';

  var sc = getIMSortConfig();
  var th = function(key, label, cls) {
    var on = sc && sc.col === key;
    return '<th class="' + (cls || '') + '"' + (on ? ' aria-sort="' + (sc.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '>' +
      '<button class="inv-table-sort" data-action="invDesktopIMSort" data-col="' + key + '">' + label +
      (on ? '<span aria-hidden="true">' + (sc.dir === 'asc' ? ' ▲' : ' ▼') + '</span>' : '') + '</button></th>';
  };
  html += '<table class="inv-table"><thead><tr>' +
    '<th class="inv-table-check"><span class="inv-visually-hidden">Select</span></th><th>Challan</th>' + th('client', 'Client', 'inv-col-grow') +
    th('date', 'Date', 'inv-col-opt3') + '<th class="inv-col-opt2">Vehicle</th>' + th('items', 'Items', 'inv-num inv-col-opt2') +
    th('amount', 'Amount', 'inv-num') + th('status', 'Status') + '</tr></thead><tbody>';

  filtered.forEach(function(im) {
    var status = getIMStatus(im), id = escHtml(im.id);
    var pendingItems = im.items.filter(function(it) { return !it.invoiced; });
    var allChecked = pendingItems.length > 0 && pendingItems.every(function(it) { return _imSelected[it.id]; });
    html += '<tr class="' + (allChecked ? 'inv-row-selected' : '') + '"' + (_imActiveChallanId === im.id ? ' aria-current="true"' : '') +
      ' data-id="' + id + '" data-im="' + id + '" data-action="invSelectIMRow">' +
      '<td class="inv-table-check">' + (status !== 'invoiced' ? '<input type="checkbox" class="inv-check" data-action="invCheckIMChallan" data-id="' + id + '"' +
        (allChecked ? ' checked' : '') + ' aria-label="Select all of ' + escHtml(imChallanLabel(im)) + '">' : '') + '</td>' +
      // The challan number is a real button, so the row opens from the keyboard.
      '<td><button class="inv-btn-link inv-id" data-action="invSelectIMRow" data-id="' + id + '">' + (im.challanNo ? escHtml(im.challanNo) : '—') + '</button></td>' +
      '<td class="inv-col-grow" title="' + escHtml(im.clientName) + '">' + escHtml(im.clientName) + '</td>' +
      '<td class="inv-id inv-col-opt3">' + escHtml(formatDate(im.challanDate)) + '</td>' +
      '<td class="inv-id inv-col-opt2">' + escHtml(im.vehicleNo || '') + '</td>' +
      '<td class="inv-num inv-col-opt2">' + im.items.length + '</td>' +
      '<td class="inv-num">' + formatCurrency(imChallanTotal(im)) + '</td>' +
      '<td>' + imStatusDotHtml(im) + '</td></tr>';
  });
  return html + '</tbody></table>';
}

/* Render challan detail inline in #imDetail */
function _renderIMDetail(challanId, skipMasterRefresh) {
  var focusKey = skipMasterRefresh ? null : _mdFocusKey('imMasterDetail', _imActiveChallanId);
  var im = challanId ? (S.incomingMaterial || []).find(function(m) { return m.id === challanId; }) : null;
  _imActiveChallanId = im ? challanId : null;
  // The pane takes room only while a challan is open (§6.14), as the Register's does.
  var wrap = document.getElementById('imMasterDetail');
  if (wrap) wrap.classList.toggle('inv-pane-open', !!im);
  var detailEl = document.getElementById('imDetail');
  if (detailEl) detailEl.innerHTML = im ? '<div class="inv-pane-head"><span class="inv-panel-title inv-id">' + escHtml(imChallanLabel(im)) + '</span>' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invIMClosePane" aria-label="Close">&times;</button></div>' + challanDetailHtml(im) : '';
  if (!skipMasterRefresh) {
    var masterEl = document.getElementById('imMaster');
    if (masterEl) masterEl.innerHTML = _buildIMTableHtml();
    _mdRestoreFocus(focusKey, 'invSelectIMRow', 'invIMClosePane');
  }
}

function renderIMTable() {
  var area = document.getElementById('imList');
  if (!area) return;

  if (!_imToolbarRendered) {
    renderIMToolbar();
    _imToolbarRendered = true;
  }

  if (!document.getElementById('imMasterDetail')) {
    area.innerHTML =
      '<div class="inv-master-detail inv-master-detail-pane" id="imMasterDetail">' +
        '<div class="inv-master" id="imMaster"></div>' +
        '<div class="inv-detail inv-pane" id="imDetail"></div>' +
      '</div>';
  }

  var master = document.getElementById('imMaster');
  if (!master) return;
  var focusKey = _mdFocusKey('imMasterDetail', _imActiveChallanId);
  master.innerHTML = _buildIMTableHtml();

  // Keep the pane in step with the data: a deleted or filtered-out challan closes it.
  if (_imActiveChallanId) {
    var visible = getFilteredIM().some(function(m) { return m.id === _imActiveChallanId; });
    _renderIMDetail(visible ? _imActiveChallanId : null, true);
  } else {
    _renderIMDetail(null, true);
  }
  _mdRestoreFocus(focusKey, 'invSelectIMRow', 'invIMClosePane');

  renderIMSelBar();
}

function imStatusDotHtml(im) {
  var s = IM_STATUS_UI[getIMStatus(im)] || { word: getIMStatus(im), tone: 'neutral' };
  return '<span class="inv-dot inv-dot-' + s.tone + '">' + escHtml(s.word) + '</span>';
}

function imChallanTotal(im) { return im.items.reduce(function(s, it) { return s + (it.amount || 0); }, 0); }

function _imSummaryHtml(filtered) {
  var pending = filtered.filter(function(im) { return getIMStatus(im) !== 'invoiced'; }).length;
  return '<div class="inv-pagehead"><span class="inv-pagehead-meta" data-im-summary>' + filtered.length + ' challan' +
    (filtered.length !== 1 ? 's' : '') + ' · ' + pending + ' awaiting invoice</span></div>';
}

/* A challan line. A line still to bill carries its tick box; a billed one names its invoice. */
function _imItemRowHtml(it) {
  var lead = '', tag = '';
  if (!it.invoiced) {
    lead = '<label class="inv-row-lead inv-row-tick"><input type="checkbox" class="inv-check" data-action="invCheckIMItem" data-item-id="' + escHtml(it.id) + '"' +
      (_imSelected[it.id] ? ' checked' : '') + ' aria-label="Select ' + escHtml(lineLabel(it)) + '"></label>';
  } else {
    var linked = it.invoiceId ? S.invoices.find(function(iv) { return iv.id === it.invoiceId; }) : null;
    tag = linked
      ? '<span class="inv-badge inv-badge-ok" title="' + escHtml(linked.displayNumber) + '">Invoice ' + escHtml(linked.invoiceNumber || linked.displayNumber) + '</span>'
      : '<span class="inv-badge inv-badge-danger" title="Invoice deleted">Invoice missing</span>';
  }
  return '<div class="inv-row inv-row-auto' + (it.invoiced ? ' inv-row-sub' : '') + '" data-im-item>' + lead +
    '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap" data-im-desc>' + escHtml(lineLabel(it)) + '</span>' +
    '<span class="inv-row-meta inv-row-wrap" data-im-detail>' + escHtml(it.qty) + ' ' + escHtml(it.unit) +
    (it.nosQty && it.nosQty > 0 ? ' (' + escHtml(it.nosQty) + ' NOS)' : '') +
    ' @ ' + formatCurrency(it.rate) + '/' + escHtml(it.unit) + '</span>' + (tag ? '<span class="inv-row-meta">' + tag + '</span>' : '') + '</span>' +
    '<span class="inv-row-end inv-num">' + formatCurrency(it.amount) + '</span></div>';
}

/* Edit and delete while nothing on the challan is billed; once a line is, the edit says why not. */
function _imActionsHtml(im, primary) {
  var status = getIMStatus(im), billed = im.items.filter(function(it) { return it.invoiced; }).length, id = escHtml(im.id);
  if (billed === 0) {
    // Secondary: the page's one primary is Add challan (DR-3).
    return '<button class="inv-btn inv-btn-secondary' + (primary ? '' : ' inv-btn-sm') + '" data-action="invEditChallan" data-id="' + id + '">Edit</button>' +
      '<button class="inv-btn inv-btn-danger' + (primary ? '' : ' inv-btn-sm') + '" data-action="invDeleteChallan" data-id="' + id + '">Delete challan</button>';
  }
  if (status !== 'invoiced') {
    return '<button class="inv-btn inv-btn-secondary inv-btn-disabled' + (primary ? '' : ' inv-btn-sm') + '" data-action="invEditChallanGuard" data-count="' + billed + '">Edit</button>';
  }
  return '';
}

/* One challan read in full, in the desktop pane. */
function challanDetailHtml(im) {
  var h = '<div class="inv-kv inv-mb-8">' +
    '<div><div class="inv-kv-k">Challan</div><div class="inv-id">' + (im.challanNo ? escHtml(im.challanNo) : '—') + '</div></div>' +
    '<div><div class="inv-kv-k">Date</div><div class="inv-id">' + escHtml(formatDate(im.challanDate)) + '</div></div>' +
    '<div class="inv-kv-wide"><div class="inv-kv-k">Client</div><div>' + escHtml(im.clientName) + '</div></div>' +
    (im.vehicleNo ? '<div><div class="inv-kv-k">Vehicle</div><div class="inv-id">' + escHtml(im.vehicleNo) + '</div></div>' : '') +
    '<div><div class="inv-kv-k">Status</div><div>' + imStatusDotHtml(im) + '</div></div>' +
    (im.notes ? '<div class="inv-kv-wide"><div class="inv-kv-k">Notes</div><div>' + escHtml(im.notes) + '</div></div>' : '') +
    '</div>';
  h += '<div class="inv-panel inv-panel-flush"><div class="inv-row-group"><span>Lines · ' + im.items.length + '</span></div>' +
    im.items.map(_imItemRowHtml).join('') +
    '<div class="inv-row inv-row-strong"><span class="inv-row-main">Total</span><span class="inv-row-end inv-num">' + formatCurrency(imChallanTotal(im)) + '</span></div></div>';
  var acts = _imActionsHtml(im, true);
  return h + (acts ? '<div class="inv-toolbar">' + acts + '</div>' : '');
}

/* View dispatcher (Phase 8B) */
function _renderIMView() {
  _isDesktop ? renderIMTable() : renderIMList();
}

function toggleIMExpand(imId) {
  _imExpanded[imId] = !_imExpanded[imId];
  _renderIMView();
}

/* Read the IM filters, and drop the selection they hide.
   Rows filtered off the screen stayed ticked, and Create Invoice From IM acts
   on the whole selection — so material the operator could no longer see went
   onto the invoice. Same shape as the register's, and the same fix. */
function captureIMFilters() {
  var icf = document.getElementById('imClientFilter');
  var isf = document.getElementById('imStatusFilter');
  if (icf) _imFilter.clientId = icf.value;
  if (isf) _imFilter.status = isf.value;
  _imSelected = {};
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
  const clientIds = new Set();
  let clientId = null;
  (S.incomingMaterial || []).forEach(im => {
    im.items.forEach(it => {
      if (_imSelected[it.id]) {
        selectedItems.push({ ...it, _imId: im.id, _challanNo: im.challanNo, _challanDate: im.challanDate, _vehicleNo: im.vehicleNo });
        linkedIMIds.add(im.id);
        clientIds.add(im.clientId);
        clientId = im.clientId;
      }
    });
  });

  /* An invoice is addressed to one customer. This used to take whichever
     challan happened to come last in the array — the loop above simply
     overwrote clientId — so a selection spanning two clients produced one
     invoice carrying both clients' material, billed to one of them and priced
     off that one's rate card. Reachable without any filter at all: the IM list
     defaults to All Clients, so two challans from two customers sit next to
     each other and both can be ticked. */
  if (clientIds.size > 1) {
    var names = Array.from(clientIds).map(function(cid) {
      var c = S.clients.find(function(x) { return x.id === cid; });
      return c ? c.name : ('client ' + cid);
    });
    showToast('One invoice, one customer — this selection spans ' + names.join(' and '), 'error');
    return;
  }

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

