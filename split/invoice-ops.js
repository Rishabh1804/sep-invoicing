/* ===== VIEW/EDIT INVOICE ===== */

/* ===== AN INVOICE CORRECTION REACHES ITS CHALLAN =====

   IM is the billing spine, and a correction made on the invoice used to stop
   there: an invoiced challan line cannot be edited, and the invoice line did
   not even record which challan line it came from. So 00830 (33 pieces that
   were 330) and 00086 (500 that were 50) were put right on the invoice and
   stayed wrong on the challan (owner, 24 Sep 2026: "back corrections don't
   happen in the IM — it should").

   An invoice line now carries `imItemId`. A line saved before that is matched
   to its challan line when the invoice is opened for editing: same invoice,
   same part, same quantities, each challan line claimed once — and a line that
   matches ambiguously is left unlinked rather than guessed. */
var CHALLAN_SYNC_FIELDS = ['partNumber', 'desc', 'unit', 'qty', 'nosQty', 'rate', 'amount'];

function withChallanLinks(inv) {
  var pool = [];
  (S.incomingMaterial || []).forEach(function(im) {
    (im.items || []).forEach(function(it) { if (it.invoiceId === inv.id) pool.push(it); });
  });
  var taken = {};
  (inv.items || []).forEach(function(li) { if (li.imItemId) taken[li.imItemId] = true; });
  return (inv.items || []).map(function(li) {
    // What the line said when the edit began: only a field that moves from
    // this is a correction to carry back (see backCorrectChallans).
    var orig = {};
    CHALLAN_SYNC_FIELDS.forEach(function(f) { orig[f] = li[f] == null ? null : li[f]; });
    li = Object.assign({}, li, { _orig: orig });
    if (li.imItemId) return Object.assign({}, li, { _imItemId: li.imItemId });
    var free = pool.filter(function(it) { return !taken[it.id] && rateKey(it.partNumber) === rateKey(li.partNumber); });
    var exact = free.filter(function(it) { return it.qty === li.qty && (it.nosQty || null) === (li.nosQty || null); });
    var pick = exact.length === 1 ? exact[0] : (exact.length === 0 && free.length === 1 ? free[0] : null);
    if (!pick) return Object.assign({}, li);
    taken[pick.id] = true;
    return Object.assign({}, li, { _imItemId: pick.id });
  });
}

/* Push an edit's corrections back onto the challan lines they came from.
   Only the fields the operator CHANGED in this edit travel — never every field
   where invoice and challan already disagreed. An older invoice routinely
   differs from its challan for reasons nobody decided today (the gauge folded
   into the description, a rate recomputed from the amount), and an untouched
   save must not rewrite the challan or log corrections nobody made.
   The old values are KEPT on the challan line as `corrections` — the challan is
   the record of what the customer's paper said, and overwriting it without
   trace would lose exactly what an audit asks: what did it say, and who changed
   it from which invoice. */
function backCorrectChallans(inv, formItems) {
  var now = Date.now(), lines = 0, touched = {};
  (formItems || []).forEach(function(li) {
    if (!li._imItemId || !li._orig) return;
    var im = null, it = null;
    (S.incomingMaterial || []).some(function(m) {
      var hit = (m.items || []).find(function(x) { return x.id === li._imItemId; });
      if (hit) { im = m; it = hit; return true; }
      return false;
    });
    if (!it) return;
    var from = {}, changed = false;
    CHALLAN_SYNC_FIELDS.forEach(function(f) {
      var now_ = li[f] == null ? null : li[f];
      if (now_ === li._orig[f]) return;            // not touched in this edit
      var was = it[f] == null ? null : it[f];
      if (was === now_) return;                    // challan already agrees
      from[f] = was; changed = true;
    });
    if (!changed) return;
    var to = {};
    Object.keys(from).forEach(function(f) { it[f] = to[f] = li[f] == null ? null : li[f]; });
    if (!it.corrections) it.corrections = [];
    it.corrections.push({ at: now, invoiceId: inv.id, invoice: inv.displayNumber, from: from, to: to });
    touched[im.id] = im.challanNo || '(no number)';
    lines++;
  });
  return { lines: lines, challans: Object.keys(touched).map(function(k) { return touched[k]; }) };
}

/* ===== INVOICE REGISTER ===== */
var _regSelected = {};
var _regSelectMode = false;
var _regActiveInvId = null;

/* Unified sort accessor (Phase 8C) */
function getRegSortConfig() {
  if (_isDesktop && regFilter.desktopSort) return regFilter.desktopSort;
  return { col: 'date', dir: regFilter.regSortDir || 'desc' };
}

function getFilteredInvoices() {
  let list = [...S.invoices];
  if (regFilter.clientId) {
    const cid = parseInt(regFilter.clientId);
    list = list.filter(i => i.clientId === cid);
  }
  // A date range and a month are alternatives, never layered — whichever the
  // operator set last wins and the other is cleared, so there is no precedence
  // rule to remember. ISO dates compare lexically, so no parsing is needed.
  if (regFilter.dateFrom || regFilter.dateTo) {
    list = list.filter(function(i) {
      if (!i.date) return false;
      if (regFilter.dateFrom && i.date < regFilter.dateFrom) return false;
      if (regFilter.dateTo && i.date > regFilter.dateTo) return false;
      return true;
    });
  } else if (regFilter.month) {
    list = list.filter(i => i.date && i.date.startsWith(regFilter.month));
  }
  if (regFilter.search) {
    const q = regFilter.search.toLowerCase();
    // Challan numbers too: an invoice is found by the challan it billed as
    // often as by its own number, and matching only the invoice number made a
    // challan search land on whichever invoice's digits happened to contain it.
    list = list.filter(i =>
      (i.displayNumber || '').toLowerCase().includes(q) ||
      (i.clientName || '').toLowerCase().includes(q) ||
      regChallanMatch(i.challanNo, q)
    );
  }
  if (regFilter.state) {
    if (regFilter.state === 'cancelled') {
      list = list.filter(i => i.status === 'cancelled');
    } else {
      list = list.filter(i => i.status === 'active' && getInvState(i) === regFilter.state);
    }
  }

  /* Desktop: multi-column sort via getRegSortConfig().
     Mobile: preserve existing createdAt sort (no behavioral change). */
  if (_isDesktop) {
    var sc = getRegSortConfig();
    var dir = sc.dir === 'asc' ? 1 : -1;
    list.sort(function(a, b) {
      var va, vb;
      switch (sc.col) {
        case 'client': va = (a.clientName || '').toLowerCase(); vb = (b.clientName || '').toLowerCase(); return va < vb ? -dir : va > vb ? dir : 0;
        case 'date': va = a.date || ''; vb = b.date || ''; return va < vb ? -dir : va > vb ? dir : 0;
        case 'taxable': return dir * ((a.taxableValue || 0) - (b.taxableValue || 0));
        case 'total': return dir * ((a.grandTotal || 0) - (b.grandTotal || 0));
        case 'state': {
          var so = { created: 0, dispatched: 1, delivered: 2, filed: 3 };
          va = a.status === 'cancelled' ? -1 : (so[getInvState(a)] || 0);
          vb = b.status === 'cancelled' ? -1 : (so[getInvState(b)] || 0);
          return dir * (va - vb);
        }
        default: va = a.date || ''; vb = b.date || ''; return va < vb ? -dir : va > vb ? dir : 0;
      }
    });
  } else {
    var sortDir = regFilter.regSortDir || 'desc';
    if (sortDir === 'asc') {
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } else {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  }
  return list;
}

/* Read every register filter control into regFilter, in one place.
   Two event paths reached these fields with the same block of code copied into
   both, so a new filter had to be added twice or it silently did nothing on one
   of them.

   Driven by `change` only. These controls used to carry a data-action as well,
   which meant the click that OPENS a <select> ran this — and this re-renders
   the toolbar, replacing the element the dropdown was hanging off, so the list
   shut before an option could be picked. A select speaks through change; a
   click on one is not a choice. */
function captureRegFilters(changedId) {
  var cf = document.getElementById('regClientFilter');
  var mf = document.getElementById('regMonthFilter');
  var sf = document.getElementById('regStateFilter');
  var df = document.getElementById('regDateFrom');
  var dt = document.getElementById('regDateTo');
  if (cf) regFilter.clientId = cf.value;
  if (sf) regFilter.state = sf.value;
  if (mf) regFilter.month = mf.value;
  if (df) regFilter.dateFrom = df.value;
  if (dt) regFilter.dateTo = dt.value;

  // Month and range are alternatives. Setting one clears the other rather than
  // leaving both populated and one of them quietly ignored.
  if (changedId === 'regMonthFilter' && regFilter.month) {
    regFilter.dateFrom = ''; regFilter.dateTo = '';
  } else if ((changedId === 'regDateFrom' || changedId === 'regDateTo') &&
             (regFilter.dateFrom || regFilter.dateTo)) {
    regFilter.month = '';
  }

  // A selection made under one filter must not survive into another. The rows
  // become invisible but stay selected, and every bulk action still acts on
  // them — file, dispatch, certificates alike. Harmless while selecting meant
  // one tap per row; a hazard now that one tap selects the whole page.
  _regSelected = {};

  saveRegFilter();
  // The toolbar has to be rebuilt — the range's clear button, the scope note
  // and the select-all count all depend on the filters — but rebuilding it
  // throws away the control the operator is standing on, so focus is put back.
  var focusId = document.activeElement && document.activeElement.id;
  _regToolbarRendered = false;
  renderRegisterToolbar();
  _regToolbarRendered = true;
  if (focusId) {
    var back = document.getElementById(focusId);
    if (back) { try { back.focus(); } catch (err) {} }
  }
  _renderRegView();
  _renderRegSelBar();
}

/* Invoices in the current filter that a bulk action can actually act on.
   Cancelled ones are excluded: every bulk path already refuses them — state
   transitions skip them and certificates are declined — and on mobile their
   row renders no checkbox at all, so selecting one would be unclearable. */
function regSelectableInvoices() {
  return getFilteredInvoices().filter(function(i) { return i.status !== 'cancelled'; });
}

function toggleRegSelectAll() {
  var selectable = regSelectableInvoices();
  var allOn = selectable.length > 0 && selectable.every(function(i) { return _regSelected[i.id]; });
  _regSelected = {};
  if (!allOn) selectable.forEach(function(i) { _regSelected[i.id] = true; });
  _renderRegView();
  _renderRegSelBar();
  _regToolbarRendered = false;
  renderRegisterToolbar();
  _regToolbarRendered = true;
  showToast(allOn ? 'Selection cleared'
    : selectable.length + ' invoice' + (selectable.length !== 1 ? 's' : '') + ' selected');
}

function renderRegisterToolbar() {
  const area = document.getElementById('regToolbar');
  if (!area) return;

  var sortDir = regFilter.regSortDir || 'desc';
  var unaccounted = unaccountedNumberCount();
  var rangeActive = !!(regFilter.dateFrom || regFilter.dateTo);
  var selectable = regSelectableInvoices();
  var selectableCount = selectable.length;
  var allSelected = selectableCount > 0 && selectable.every(function(i) { return _regSelected[i.id]; });
  var cnCount = (S.creditNotes || []).filter(function(c) { return c.status !== 'cancelled'; }).length;

  // Build unique client list for filter dropdown
  const clientIds = [...new Set(S.invoices.map(i => i.clientId))];
  const clientOpts = clientIds.map(cid => {
    const c = S.clients.find(x => x.id === cid);
    return c ? '<option value="' + cid + '"' + (regFilter.clientId == cid ? ' selected' : '') + '>' + escHtml(c.name) + '</option>' : '';
  }).join('');
  var stateOpt = function(v, label) { return '<option value="' + v + '"' + ((regFilter.state || '') === v ? ' selected' : '') + '>' + label + '</option>'; };

  let html = '<div class="inv-toolbar">' +
    '<label class="inv-search">' + ICON_SEARCH +
    '<input type="text" id="regSearch" placeholder="Search invoice, client or challan" value="' + escHtml(regFilter.search) + '" autocomplete="off" aria-label="Search the register"></label>' +
    '<select class="inv-select inv-toolbar-item" id="regClientFilter" aria-label="Filter by client">' +
    '<option value="">All clients</option>' + clientOpts + '</select>' +
    '<input type="month" class="inv-input inv-toolbar-item" id="regMonthFilter" value="' + escHtml(regFilter.month || '') + '" aria-label="Filter by month">' +
    '<select class="inv-select inv-toolbar-item" id="regStateFilter" aria-label="Filter by state">' +
    stateOpt('', 'All states') + stateOpt('created', 'Created') + stateOpt('dispatched', 'Dispatched') +
    stateOpt('delivered', 'Delivered') + stateOpt('filed', 'Filed') + stateOpt('cancelled', 'Cancelled') + '</select>' +
    '</div>' +
    // Explicit range, for an export that does not line up with a calendar month.
    '<div class="inv-toolbar">' +
    '<label class="inv-field inv-toolbar-item"><span class="inv-field-label">From</span>' +
    '<input type="date" class="inv-input" id="regDateFrom" value="' + escHtml(regFilter.dateFrom || '') + '"></label>' +
    '<label class="inv-field inv-toolbar-item"><span class="inv-field-label">To</span>' +
    '<input type="date" class="inv-input" id="regDateTo" value="' + escHtml(regFilter.dateTo || '') + '"></label>' +
    (rangeActive ? '<button class="inv-btn inv-btn-secondary inv-btn-sm inv-toolbar-end" data-action="invRegClearRange">Clear range</button>' : '') +
    '</div>' +
    (rangeActive ? '<div class="inv-callout inv-callout-warning inv-mb-8" data-scope-note>Range in use — the month filter is ignored while it is set.</div>' : '') +
    '<div class="inv-toolbar">' +
    // The desktop table sorts by its column heads, and always shows its tick boxes.
    (_isDesktop ? '' :
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invRegToggleSort">' + (sortDir === 'asc' ? 'Oldest first' : 'Newest first') + '</button>' +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invRegToggleSelect" aria-pressed="' + _regSelectMode + '">' + (_regSelectMode ? 'Cancel select' : 'Select') + '</button>') +
    // Offered wherever ticking is actually possible.
    ((_isDesktop || _regSelectMode) && selectableCount > 0
      ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invRegSelectAll">' +
        (allSelected ? 'Clear selection' : 'Select all (' + selectableCount + ')') + '</button>'
      : '') +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCnList">Credit notes' +
    (cnCount > 0 ? '<span class="inv-badge">' + cnCount + '</span>' : '') + '</button>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" id="regNumberAudit" data-action="invShowNumberAudit">Number audit' +
    (unaccounted > 0 ? '<span class="inv-badge inv-badge-warning" data-unaccounted>' + unaccounted + '</span>' : '') + '</button>' +
    '</div>';

  area.innerHTML = html;

  // Bind debounced search (200ms)
  const searchEl = document.getElementById('regSearch');
  if (searchEl) {
    searchEl.addEventListener('input', function() {
      regFilter.search = this.value;
      saveRegFilter();
      // Search is a filter like any other, and was the one that kept its
      // selection: narrowing the search left earlier rows ticked but off
      // screen, and every bulk action still reached them.
      _regSelected = {};
      clearTimeout(_regSearchTimer);
      _regSearchTimer = setTimeout(function() { _renderRegView(); _renderRegSelBar(); }, 200);
    });
  }
}

/* A challan field is a list ("834, 835, 838"). A number in the search matches
   a whole challan number, never a fragment of one — "83" must not find 834. */
function regChallanMatch(challanNo, q) {
  q = String(q || '').trim();
  var list = String(challanNo || '').toLowerCase().split(/[,;\/&\s]+/).filter(Boolean);
  if (/^\d+$/.test(q)) {
    var n = String(parseInt(q, 10));
    return list.some(function(c) { return c.replace(/^0+/, '') === n; });
  }
  return list.some(function(c) { return c.indexOf(q) >= 0; });
}

function renderRegisterList() {
  const area = document.getElementById('regList');
  if (!area) return;

  const filtered = getFilteredInvoices();
  let html = _regSummaryHtml(filtered);

  if (filtered.length === 0) {
    html += '<div class="inv-panel"><div class="inv-empty">No invoices found</div></div>';
  } else {
    // Rows grouped by invoice date, each group with its count and taxable (§7).
    html += '<div class="inv-panel inv-panel-flush">';
    var groups = [], byDate = {};
    filtered.forEach(function(inv) {
      var k = inv.date || '';
      if (!byDate[k]) { byDate[k] = []; groups.push(k); }
      byDate[k].push(inv);
    });
    // The list is sorted by when each invoice was raised, but the headers are
    // invoice dates: a backdated or reissued invoice would otherwise pull its
    // whole day to the top. Days follow the date; rows within a day, the raising.
    var desc = (regFilter.regSortDir || 'desc') !== 'asc';
    groups.sort(function(a, b) {
      if (!a || !b) return (!a) - (!b);
      return a === b ? 0 : ((a < b) === desc ? 1 : -1);
    });
    groups.forEach(function(k) {
      var list = byDate[k], live = list.filter(function(i) { return i.status === 'active'; });
      html += '<div class="inv-row-group"><span>' + (k ? escHtml(formatDate(k)) : 'No date') + ' · ' + list.length + '</span>' +
        '<span class="inv-num">' + formatCurrency(gstRound(sumTaxable(live))) + '</span></div>';
      list.forEach(function(inv) {
        var cancelled = inv.status === 'cancelled';
        var tickable = _regSelectMode && !cancelled;
        var cls = 'inv-row inv-row-2' + (cancelled ? ' inv-row-muted' : '') + (_regSelected[inv.id] ? ' inv-row-selected' : '');
        var open = ' data-action="invViewInvoiceDetail" data-id="' + escHtml(inv.id) + '"';
        var main = '<span class="inv-row-title inv-id" data-invnum>' + escHtml(inv.displayNumber) + '</span>' +
          '<span class="inv-row-meta">' + escHtml(inv.clientName) + '</span>';
        var end = '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + formatCurrency(inv.grandTotal) + '</span>' +
          getStateDotHtml(inv) + '</span></span>';
        // With no tick box the whole row opens the invoice, figures included; with
        // one, the box is its own full-height touch target beside the row.
        html += tickable
          ? '<div class="' + cls + '"><label class="inv-row-lead inv-row-tick">' + _regCheckHtml(inv) + '</label>' +
            '<button class="inv-row-main"' + open + '>' + main + '</button>' + end + '</div>'
          : '<button class="' + cls + '"' + open + (cancelled ? ' data-cancelled' : '') + '><span class="inv-row-main">' + main + '</span>' + end + '</button>';
      });
    });
    html += '</div>';
  }

  area.innerHTML = html + _regExportHtml();
}

/* ===== SHARED DESKTOP UTILITIES (Phase 8B) ===== */
function _renderDetailEmpty() {
  return '<div class="inv-detail-empty">' +
    '<svg class="inv-detail-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
    '<div class="inv-detail-empty-text">Select an item to view details</div></div>';
}

function _restorePanelWidth(masterId, tabKey) {
  var widths = regFilter.desktopPanelWidths;
  if (!widths || !widths[tabKey]) return;
  var master = document.getElementById(masterId);
  if (master) master.style.width = (widths[tabKey] * 100) + '%';
}

function _initDragHandle(handleId, masterId, detailId, tabKey) {
  var handle = document.getElementById(handleId);
  if (!handle || handle.dataset.dragInit) return;
  handle.dataset.dragInit = 'true';

  function onStart(e) {
    e.preventDefault();
    var container = handle.parentElement;
    var startX = e.clientX || e.touches[0].clientX;
    _dragState = {
      startX: startX,
      containerW: container.offsetWidth,
      masterStart: document.getElementById(masterId).offsetWidth,
      masterId: masterId, tabKey: tabKey
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  handle.addEventListener('mousedown', onStart);
  handle.addEventListener('touchstart', onStart, { passive: false });
}

/* ===== REGISTER DESKTOP TABLE ===== */
function _buildRegisterTableHtml() {
  var filtered = getFilteredInvoices();
  var html = _regSummaryHtml(filtered);
  if (filtered.length === 0) return html + '<div class="inv-empty">No invoices found</div>' + _regExportHtml();

  var sc = getRegSortConfig();
  // The column heads the register sorts by; the rest are read-only.
  var th = function(key, label, cls) {
    var on = sc.col === key;
    return '<th class="' + (cls || '') + '"' + (on ? ' aria-sort="' + (sc.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '>' +
      '<button class="inv-table-sort" data-action="invDesktopSort" data-col="' + key + '">' + label +
      (on ? '<span aria-hidden="true">' + (sc.dir === 'asc' ? ' ▲' : ' ▼') + '</span>' : '') + '</button></th>';
  };
  html += '<table class="inv-table"><thead><tr>' +
    '<th class="inv-table-check"><span class="inv-visually-hidden">Select</span></th><th>Invoice</th>' + th('client', 'Client', 'inv-col-grow') + th('date', 'Date', 'inv-col-opt3') +
    '<th class="inv-col-opt2">Challans</th><th class="inv-num inv-col-opt2">kg</th>' + th('taxable', 'Taxable', 'inv-num inv-col-opt3') + '<th class="inv-num inv-col-opt1">GST</th>' +
    th('total', 'Total', 'inv-num') + th('state', 'State') + '</tr></thead><tbody>';

  filtered.forEach(function(inv) {
    var cancelled = inv.status === 'cancelled';
    // A line with no known weight adds nothing to kg, so a partly weighed invoice
    // reads light; it says so rather than passing as the whole consignment.
    var w = cancelled ? null : weighLines([inv]);
    var kg = w ? w.kg : 0, partKg = !!w && w.known < w.lines;
    var gst = gstRound((inv.cgstAmt || 0) + (inv.sgstAmt || 0) + (inv.igstAmt || 0));
    html += '<tr class="' + (cancelled ? 'inv-row-muted' : '') + (_regSelected[inv.id] ? ' inv-row-selected' : '') + '"' +
      (_regActiveInvId === inv.id ? ' aria-current="true"' : '') + (cancelled ? ' data-cancelled' : '') +
      ' data-action="invSelectRegRow" data-id="' + escHtml(inv.id) + '">' +
      '<td class="inv-table-check">' + (cancelled ? '' : _regCheckHtml(inv)) + '</td>' +
      // The number is a real button, so the row can be opened from the keyboard.
      '<td><button class="inv-btn-link inv-id" data-action="invSelectRegRow" data-id="' + escHtml(inv.id) + '" data-invnum>' + escHtml(inv.displayNumber) + '</button></td>' +
      '<td class="inv-col-grow" title="' + escHtml(inv.clientName) + '">' + escHtml(inv.clientName) + '</td>' +
      '<td class="inv-id inv-col-opt3">' + escHtml(formatDate(inv.date)) + '</td>' +
      '<td class="inv-id inv-col-grow-sm inv-col-opt2" title="' + escHtml(inv.challanNo || '') + '">' + escHtml(inv.challanNo || '') + '</td>' +
      '<td class="inv-num inv-col-opt2"' + (partKg && kg > 0 ? ' title="' + w.known + ' of ' + w.lines + ' lines weighed"' : '') + '>' +
        (kg > 0 ? (partKg ? '&ge;&thinsp;' : '') + formatNum(kg, 1) : '&mdash;') + '</td>' +
      '<td class="inv-num inv-col-opt3">' + formatCurrency(inv.taxableValue) + '</td>' +
      '<td class="inv-num inv-col-opt1">' + formatCurrency(gst) + '</td>' +
      '<td class="inv-num">' + formatCurrency(inv.grandTotal) + '</td>' +
      '<td>' + getStateDotHtml(inv) + '</td></tr>';
  });
  return html + '</tbody></table>' + _regExportHtml();
}

/* The table and the pane are rebuilt whole, which drops the keyboard to <body>.
   Focus goes back to the same control; where that is gone or hidden (the pane
   covering the list), to the pane's close button, and on closing, to the row
   of the invoice that was open. */
function _regFocusKey() {
  var ae = document.activeElement, wrap = document.getElementById('regMasterDetail');
  if (!ae || !wrap || !wrap.contains(ae) || !ae.dataset || !ae.dataset.action) return null;
  return { action: ae.dataset.action, id: ae.dataset.id || '', col: ae.dataset.col || '', open: _regActiveInvId };
}
function _regRestoreFocus(k) {
  var wrap = k && document.getElementById('regMasterDetail');
  if (!wrap) return;
  var q = function(sel) { var el = wrap.querySelector(sel); return el && el.offsetParent !== null ? el : null; };
  var attr = function(n, v) { return v ? '[data-' + n + '="' + String(v).replace(/["\\]/g, '\\$&') + '"]' : ''; };
  var el = k.action === 'invRegClosePane'
    ? q('button[data-action="invSelectRegRow"]' + attr('id', k.open))
    : q(':is(button, input)[data-action="' + k.action + '"]' + attr('id', k.id) + attr('col', k.col));
  el = el || q('[data-action="invRegClosePane"]');
  if (el) el.focus();
}

/* Render invoice detail inline in #regDetail */
function _renderRegDetail(invId, skipMasterRefresh) {
  var focusKey = skipMasterRefresh ? null : _regFocusKey();
  var inv = invId ? S.invoices.find(function(i) { return i.id === invId; }) : null;
  var detailEl = document.getElementById('regDetail');
  _regActiveInvId = inv ? invId : null;
  // The pane takes room only while an invoice is open; the table then drops columns in priority order (§6.11).
  var wrap = document.getElementById('regMasterDetail');
  if (wrap) wrap.classList.toggle('inv-pane-open', !!inv);
  if (detailEl) detailEl.innerHTML = inv ? '<div class="inv-pane-head"><span class="inv-panel-title inv-id">' + escHtml(inv.displayNumber) + '</span>' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invRegClosePane" aria-label="Close">&times;</button></div>' + invoiceDetailHtml(inv) : '';
  if (!skipMasterRefresh) {
    var masterEl = document.getElementById('regMaster');
    if (masterEl) masterEl.innerHTML = _buildRegisterTableHtml();
    _regRestoreFocus(focusKey);
  }
}

function renderRegisterTable() {
  var area = document.getElementById('regList');
  if (!area) return;

  if (!_regToolbarRendered) {
    renderRegisterToolbar();
    _regToolbarRendered = true;
  }

  // The list takes the room and the pane a fixed width (§6.14): a resizable
  // split left the table in 40% of the screen, Total cut off and every client
  // name wrapped over three lines.
  if (!document.getElementById('regMasterDetail')) {
    area.innerHTML =
      '<div class="inv-master-detail inv-master-detail-pane" id="regMasterDetail">' +
        '<div class="inv-master" id="regMaster"></div>' +
        '<div class="inv-detail inv-pane" id="regDetail"></div>' +
      '</div>';
  }

  var master = document.getElementById('regMaster');
  if (!master) return;
  var focusKey = _regFocusKey();
  master.innerHTML = _buildRegisterTableHtml();

  // Keep the pane in step with the data: a deleted or filtered-out invoice closes it.
  // The filtered list is drawn from S.invoices, so being in it is being in the book too.
  if (_regActiveInvId) {
    var visible = getFilteredInvoices().some(function(i) { return i.id === _regActiveInvId; });
    _renderRegDetail(visible ? _regActiveInvId : null, true);
  }
  _regRestoreFocus(focusKey);

  _renderRegSelBar();
}

/* View dispatcher (Phase 8B) */
function _renderRegView() {
  _isDesktop ? renderRegisterTable() : renderRegisterList();
}

/* Backward-compat: renderRegister calls both */
function renderRegister() {
  if (_isDesktop) {
    renderRegisterTable();
    return;
  }
  _regToolbarRendered = false;
  renderRegisterToolbar();
  _regToolbarRendered = true;
  _renderRegView();
}

/* --- Register bulk selection (Phase 6b) --- */
function toggleRegSelectMode() {
  _regSelectMode = !_regSelectMode;
  _regSelected = {};
  _regToolbarRendered = false;
  renderRegisterToolbar();
  _regToolbarRendered = true;
  _renderRegView();
  _renderRegSelBar();
}

function toggleRegInv(invId) {
  _regSelected[invId] = !_regSelected[invId];
  if (!_regSelected[invId]) delete _regSelected[invId];
  _renderRegView();
  _renderRegSelBar();
}

/* The register's current selection, in one place — three call sites used to
   re-derive it and a fourth would have made four. */
function _regSelectedIds() {
  return Object.keys(_regSelected).filter(function(k) { return _regSelected[k]; });
}

function _renderRegSelBar() {
  var bar = document.getElementById('regSelBar');
  if (!bar) return;
  var ids = _regSelectedIds();
  if (ids.length === 0 || (!_isDesktop && !_regSelectMode)) { bar.innerHTML = ''; return; }

  // Determine what state transitions are available
  var canDispatch = 0, canDeliver = 0, canFile = 0, taxable = 0;
  ids.forEach(function(id) {
    var inv = S.invoices.find(function(i) { return i.id === id; });
    if (!inv || inv.status !== 'active') return;
    taxable += inv.taxableValue || 0;
    var st = getInvState(inv);
    if (st === 'created') canDispatch++;
    if (st === 'dispatched') canDeliver++;
    if (st === 'delivered') canFile++;
  });

  // Certificates go out with the dispatch, so the count is of what can actually
  // be certified — a cancelled invoice in the selection is not offered.
  var canCert = qcEligibleCount(ids);
  var b = function(action, label, extra) {
    return '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="' + action + '"' + (extra || '') + '>' + label + '</button>';
  };
  var btns = '';
  if (canDispatch > 0) btns += b('invRegBulkState', 'Dispatch (' + canDispatch + ')', ' data-state="dispatched"');
  if (canDeliver > 0) btns += b('invRegBulkState', 'Deliver (' + canDeliver + ')', ' data-state="delivered"');
  if (canFile > 0) btns += b('invRegBulkState', 'File (' + canFile + ')', ' data-state="filed"');
  if (canCert > 0) btns += b('invRegQualityCerts', 'Quality certs (' + canCert + ')');
  // Offered whenever there is anything active in the selection. If the batch is
  // unusable — two customers in it, say — the click explains why rather than
  // the button silently not being there.
  if (ids.some(function(id) {
    var inv = S.invoices.find(function(i) { return i.id === id; });
    return inv && inv.status !== 'cancelled';
  })) btns += b('invRegCreditNote', 'Credit note');

  bar.innerHTML = '<div class="inv-selbar">' +
    '<span class="inv-selbar-count">' + ids.length + ' selected</span>' +
    '<span class="inv-selbar-sum">' + formatCurrency(gstRound(taxable)) + ' taxable</span>' + btns + '</div>';
}

function regBulkSetState(targetState) {
  var ids = _regSelectedIds();
  var now = Date.now();
  var updated = 0;

  var stateOrder = { created: 0, dispatched: 1, delivered: 2, filed: 3 };
  var targetIdx = stateOrder[targetState];
  if (targetIdx == null) return;

  ids.forEach(function(id) {
    var inv = S.invoices.find(function(i) { return i.id === id; });
    if (!inv || inv.status !== 'active') return;
    var curState = getInvState(inv);
    var curIdx = stateOrder[curState];
    // Only advance by one step
    if (curIdx != null && curIdx + 1 === targetIdx) {
      inv.invoiceState = targetState;
      if (targetState === 'dispatched') inv.dispatchedAt = now;
      else if (targetState === 'delivered') inv.deliveredAt = now;
      else if (targetState === 'filed') inv.filedAt = now;
      updated++;
    }
  });

  if (updated > 0) {
    saveState();
    _regSelected = {};
    _renderRegView();
    _renderRegSelBar();
    showToast(updated + ' invoice' + (updated !== 1 ? 's' : '') + ' marked as ' + INV_STATE_LABELS[targetState]);
  }
}

function toggleRegSortDir() {
  regFilter.regSortDir = (regFilter.regSortDir || 'desc') === 'desc' ? 'asc' : 'desc';
  saveRegFilter();
  _regToolbarRendered = false;
  renderRegisterToolbar();
  _regToolbarRendered = true;
  _renderRegView();
}

/* Invoice detail on the phone: the same content as the desktop pane, in a sheet. */
function openInvoiceDetail(invId) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv) return;
  var html = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Invoice ' + escHtml(inv.displayNumber) + '</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay" aria-label="Close">&times;</button></div>' +
    invoiceDetailHtml(inv) + '</div>';

  const scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = html;
  scrim.addEventListener('click', function(e) { if (e.target === scrim) { scrim.remove(); document.body.style.overflow = ''; popFocus(); } });
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

/* The count and the taxable of what the filter shows (cancelled invoices bill nothing). */
function _regSummaryHtml(filtered) {
  var active = filtered.filter(function(i) { return i.status === 'active'; });
  return '<div class="inv-pagehead"><span class="inv-pagehead-meta" data-reg-summary>' + active.length + ' active invoice' + (active.length !== 1 ? 's' : '') +
    ' · <span class="inv-num">' + formatCurrency(gstRound(sumTaxable(active))) + '</span> taxable</span></div>';
}

function _regExportHtml() {
  return '<div class="inv-toolbar inv-mt-16">' +
    '<button class="inv-btn inv-btn-secondary" data-action="invExportSales">Sales register CSV</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invPrintSalesRegister">Sales register PDF</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invExportGstr1">GSTR-1 CSV</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invBulkMarkFiled">Bulk mark filed</button></div>';
}

function _regCheckHtml(inv) {
  return '<input type="checkbox" class="inv-check" data-action="invRegToggleInv" data-id="' + escHtml(inv.id) + '"' +
    (_regSelected[inv.id] ? ' checked' : '') + ' aria-label="Select ' + escHtml(inv.displayNumber) + '">';
}

/* One invoice read in full: the desktop pane and the phone sheet draw the same thing. */
function invoiceDetailHtml(inv) {
  var d = formatInvoiceData(inv);
  var raws = inv.items || [];
  var h = '';
  if (d.cancelled) {
    h += '<div class="inv-callout inv-callout-danger inv-mb-8">This invoice was cancelled on ' + escHtml(d.cancelledAt || 'unknown date') + '. It cannot be edited.</div>';
  }
  h += '<div class="inv-kv inv-mb-8">' +
    '<div><div class="inv-kv-k">Invoice</div><div class="inv-id">' + escHtml(d.invoiceNumber) + '</div></div>' +
    '<div><div class="inv-kv-k">Date</div><div class="inv-id">' + escHtml(d.date) + '</div></div>' +
    '<div class="inv-kv-wide"><div class="inv-kv-k">Client</div><div>' + escHtml(d.clientName) + '</div>' +
    (d.clientGSTIN ? '<div class="inv-id inv-note">' + escHtml(d.clientGSTIN) + '</div>' : '') + '</div>' +
    (d.challanNo ? '<div><div class="inv-kv-k">Challan</div><div class="inv-id">' + escHtml(d.challanNo) + '</div></div>' : '') +
    (d.challanDate ? '<div><div class="inv-kv-k">Challan date</div><div class="inv-id">' + escHtml(d.challanDate) + '</div></div>' : '') +
    (d.remarks ? '<div class="inv-kv-wide"><div class="inv-kv-k">Remarks</div><div>' + escHtml(d.remarks) + '</div></div>' : '') +
    '</div>';

  h += '<div class="inv-panel inv-panel-flush">';
  // The lifecycle, once (the phone sheet used to draw it twice).
  if (!d.cancelled) {
    var cur = getInvState(inv), curIdx = INV_STATES.indexOf(cur);
    var ts = { created: inv.createdAt, dispatched: inv.dispatchedAt, delivered: inv.deliveredAt, filed: inv.filedAt };
    h += '<div class="inv-row-group"><span>Status</span></div>';
    INV_STATES.forEach(function(st, i) {
      var tone = i < curIdx ? 'ok' : i === curIdx ? INV_STATE_TONE[st] : 'neutral';
      h += '<div class="inv-row' + (i > curIdx ? ' inv-row-muted' : '') + '"' + (i === curIdx ? ' aria-current="step"' : '') + '>' +
        '<span class="inv-row-main"><span class="inv-dot inv-dot-' + tone + '">' + escHtml(INV_STATE_LABELS[st]) + (i === curIdx ? ' · now' : '') + '</span></span>' +
        '<span class="inv-row-end inv-row-meta">' + (ts[st] ? escHtml(formatTimestamp(ts[st])) : '') + '</span></div>';
    });
    if (curIdx < INV_STATES.length - 1) {
      h += '<div class="inv-row"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAdvanceState" data-id="' + escHtml(inv.id) + '">Mark ' +
        escHtml(INV_STATE_LABELS[INV_STATES[curIdx + 1]]).toLowerCase() + '</button></div>';
    }
  }

  h += '<div class="inv-row-group"><span>Lines · ' + d.items.length + '</span></div><div data-lines>';
  d.items.forEach(function(item, li) {
    var raw = raws[li];
    h += '<div class="inv-row inv-row-auto" data-line>' +
      '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(lineLabel(raw || item)) + '</span>' +
      '<span class="inv-row-meta"><span class="inv-num">' + escHtml(item.qty) + '</span> ' + escHtml(item.unit) +
      (item.nosQtyRaw && item.nosQtyRaw > 0 ? ' (' + escHtml(item.nosQtyRaw) + ' NOS)' : '') + ' × <span class="inv-num">' + escHtml(item.rate) + '</span></span>' +
      zeroReasonTag(raw) + detailRateMatch(inv, raw) + '</span>' +
      '<span class="inv-row-end inv-num">' + escHtml(item.amount) + '</span></div>';
  });
  h += '</div>';

  var tot = function(label, value, strong) {
    return '<div class="inv-row' + (strong ? ' inv-row-strong' : '') + '"><span class="inv-row-main">' + label + '</span><span class="inv-row-end inv-num">' + escHtml(value) + '</span></div>';
  };
  h += '<div class="inv-row-group"><span>Totals</span></div>' + tot('Taxable value', d.taxableValue);
  if (d.gstType === 'intra') h += tot('CGST @ ' + escHtml(d.cgstPer) + '%', d.cgstAmt) + tot('SGST @ ' + escHtml(d.sgstPer) + '%', d.sgstAmt);
  else h += tot('IGST @ ' + escHtml(d.igstPer) + '%', d.igstAmt);
  h += tot('Grand total', d.grandTotal, true) + '</div>';

  // One primary: Edit. A cancelled invoice can only be read or removed.
  var id = escHtml(inv.id);
  h += '<div class="inv-toolbar">';
  if (!d.cancelled) {
    h += '<button class="inv-btn inv-btn-primary" data-action="invEditInvoice" data-id="' + id + '">Edit</button>' +
      '<button class="inv-btn inv-btn-secondary" data-action="invPreviewInvoice" data-id="' + id + '">Preview</button>' +
      '<button class="inv-btn inv-btn-secondary" data-action="invQualityCert" data-id="' + id + '">Quality cert</button>' +
      '<button class="inv-btn inv-btn-danger" data-action="invCancelInvoice" data-id="' + id + '">Cancel invoice</button>';
  } else {
    h += '<button class="inv-btn inv-btn-secondary" data-action="invPreviewInvoice" data-id="' + id + '">Preview</button>';
  }
  return h + '<button class="inv-btn inv-btn-danger" data-action="invDeleteInvoice" data-id="' + id + '">Delete</button></div>';
}

/* Edit invoice — loads into Create Invoice in edit mode */
/* A ₹0 line says why, where the invoice is read. A backfilled reason says it
   came from the owner's ruling rather than from whoever raised the invoice. */
function zeroReasonTag(raw) {
  if (!raw || !isZeroBilledLine(raw)) return '';
  var text = raw.zeroReason ? zeroReasonLabel(raw.zeroReason) || raw.zeroReason : 'No reason recorded';
  if (raw.zeroNote) text += ' \u2014 ' + raw.zeroNote;
  if (raw.zeroReasonBackfilled) text += ' (backfilled: owner ruling ' + raw.zeroReasonBackfilled + ')';
  return '<div class="inv-zero-tag' + (raw.zeroReason ? '' : ' inv-zero-tag-missing') + '">' +
    '<span class="inv-zero-badge">\u20B90</span> ' + escHtml(text) + '</div>';
}

/* The matcher on a saved invoice: only what needs a second look. A matching
   line says nothing here — the register is read, not typed into, and a column
   of green would bury the one line that is not. A cancelled invoice bills
   nothing, so it is not judged. */
function detailRateMatch(inv, raw) {
  if (!inv || !raw || inv.status === 'cancelled') return '';
  var client = S.clients.find(function(c) { return c.id === inv.clientId; });
  var out = '';
  var m = client ? rateMatch(client, inv.date, raw) : null;
  if (m && m.status !== 'match' && m.status !== 'none') out += rateMatchNote(m, true);
  var w = client ? weightMatch(client, inv.date, raw) : null;
  if (w && w.status !== 'match' && w.status !== 'none') out += weightMatchNote(w, true);
  return out;
}

/* An invoice as the create form holds it: for an edit (editingId) or for a
   reissue under the same number (reissue), which also re-links the challan
   lines the delete is about to free. */
function invoiceFormFrom(inv, extra) {
  const items = withChallanLinks(inv).map(i => ({...i, _override: false, _label: ''}));
  const form = {
    clientId: inv.clientId,
    date: inv.date,
    items: items,
    poNumber: inv.poNumber || '',
    poDate: inv.poDate || localDateStr(),
    challanNo: inv.challanNo || '',
    challanDate: inv.challanDate || localDateStr(),
    despatchDate: inv.despatchDate || localDateStr(),
    transport: inv.transport || '',
    eWayBill: inv.eWayBill || '',
    remarks: inv.remarks || '',
    editingId: null
  };
  if (extra && extra.reissue) {
    form._linkedIMIds = (inv.linkedIMIds || []).slice();
    form._linkedIMItemIds = items.map(i => i._imItemId).filter(Boolean);
    items.forEach(i => { delete i._orig; });
  }
  return Object.assign(form, extra || {});
}

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
  invoiceForm = invoiceFormFrom(inv, { editingId: inv.id });
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

  // The lifecycle state is harder evidence than the date heuristic: once an
  // invoice is dispatched the customer holds a document bearing that number,
  // and deleting it here does not retract it there.
  const issued = getInvState(inv) !== 'created';
  const canReissue = inv.status !== 'cancelled' && getInvState(inv) !== 'filed';

  let warnHtml = '';
  let bodyText = '';
  let btnClass = '';

  if (issued) {
    warnHtml = '<div class="inv-confirm-warn">This invoice was ' + escHtml(INV_STATE_LABELS[getInvState(inv)].toLowerCase()) +
      '. The customer may hold a copy and claim credit against this number, which deleting it here does not retract' +
      (pastDeadline ? ', and it may already sit in a filed return' : '') +
      '. A credit note is usually the right instrument. The number stays spent either way.</div>';
    bodyText = 'Permanently delete invoice <strong>' + escHtml(inv.displayNumber) + '</strong>? This cannot be undone.';
    btnClass = 'inv-btn-danger inv-btn-solid';
  } else if (pastDeadline) {
    warnHtml = '<div class="inv-confirm-warn">This invoice may have been included in a filed GST return. Cancelling (not deleting) is recommended.</div>';
    bodyText = 'Permanently delete invoice <strong>' + escHtml(inv.displayNumber) + '</strong>? This cannot be undone.';
    btnClass = 'inv-btn-danger inv-btn-solid';
  } else {
    bodyText = 'Delete invoice <strong>' + escHtml(inv.displayNumber) + '</strong>? It never left the building, so this number returns to the series.';
    btnClass = 'inv-btn-primary';
  }

  scrim.innerHTML = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Delete Invoice</span>' +
    '<button class="inv-overlay-close" data-action="invCloseConfirm">&times;</button></div>' +
    warnHtml +
    '<div class="inv-confirm-body">' + bodyText + '</div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Why is it going?</label>' +
    '<input class="inv-form-input" id="invDeleteReason" placeholder="e.g. duplicate of 00657" autocomplete="off">' +
    '<div class="inv-form-hint">Kept against the number in the register. Without it a deleted number is indistinguishable from one never issued.</div></div>' +
    '<div class="inv-btn-bar"><button class="inv-btn inv-btn-ghost" data-action="invCloseConfirm">Keep</button>' +
    '<button class="inv-btn ' + btnClass + '" data-action="invConfirmDelete" data-id="' + escHtml(inv.id) + '">Delete</button></div>' +
    // Before filing, a corrected invoice may take the number back. Filed is
    // final: GSTR-1 carries the number and only a credit note corrects it.
    (canReissue
      ? '<div class="inv-reissue-offer"><button class="inv-btn inv-btn-ghost inv-btn-block" data-action="invConfirmReissue" data-id="' + escHtml(inv.id) + '">Delete and reissue ' + escHtml(inv.invoiceNumber) + '</button>' +
        '<div class="inv-form-hint">Opens a new invoice with the same lines under this number, for correcting it before the GST return is filed. The old version stays on record against the number.</div></div>'
      : '') + '</div>';
  // Act overlay: scrim tap does nothing (DP 5.2)
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

function confirmDeleteInvoice(invId, reissue) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv) return;
  if (reissue && (inv.status === 'cancelled' || getInvState(inv) === 'filed')) {
    showToast('A filed invoice cannot be reissued — a credit note corrects it', 'error');
    return;
  }

  const reasonEl = document.getElementById('invDeleteReason');
  const reason = reasonEl ? reasonEl.value.trim() : '';
  if (!reason) {
    showToast('Say why it is going — the number outlives the invoice', 'error');
    if (reasonEl) reasonEl.focus();
    return;
  }

  // The replacement's form is read BEFORE the delete unlinks the challan lines.
  const reissueForm = reissue ? invoiceFormFrom(inv, { reissue: { invoiceNumber: inv.invoiceNumber, displayNumber: inv.displayNumber } }) : null;

  const dispNum = inv.displayNumber;
  // A number the customer has seen is spent; one still in `created` returns to
  // the series. Recorded before the invoice is spliced out.
  const reserved = getInvState(inv) !== 'created';
  recordVoidedNumber(inv, reason, reserved);

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

  // Recycle the number only if nothing holds it — live invoices and reserved
  // voids both count, so invNextNum can no longer walk back over an issued one.
  recomputeNextInvoiceNumber();

  saveState();
  closeOverlay();
  if (reissueForm) {
    invoiceForm = reissueForm;
    _navReturnTab = 'pageRegister';
    renderCreateForm();
    switchTab('pageCreate');
    showToast('Reissuing ' + dispNum + ' — correct it and save', 'warning');
    return;
  }
  renderRegister();
  showToast('Invoice ' + dispNum + (reserved ? ' deleted — number stays spent' : ' deleted'));
}

