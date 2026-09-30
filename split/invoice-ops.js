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
/* The fields that are an invoice's SHARE of a challan line, not a fact about it. */
var CHALLAN_SHARE_FIELDS = ['qty', 'nosQty', 'amount'];

function withChallanLinks(inv) {
  var pool = [];
  (S.incomingMaterial || []).forEach(function(im) {
    (im.items || []).forEach(function(it) {
      if (it.invoiceId === inv.id || (it.invoiceIds || []).indexOf(inv.id) >= 0) pool.push(it);
    });
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
    // A looser match whose quantity differs billed the WHOLE challan line, as the
    // all-or-nothing app did: linking it must not reopen what is left over.
    var whole = pick.qty !== li.qty ? { imWhole: true } : {};
    return Object.assign({}, li, { _imItemId: pick.id }, whole);
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
  var now = Date.now(), lines = 0, touched = {}, idx = imBilledIndex();
  (formItems || []).forEach(function(li) {
    if (!li._imItemId || !li._orig) return;
    var im = null, it = null;
    (S.incomingMaterial || []).some(function(m) {
      var hit = (m.items || []).find(function(x) { return x.id === li._imItemId; });
      if (hit) { im = m; it = hit; return true; }
      return false;
    });
    if (!it) return;
    // A line that is PART of the challan line — another invoice bills it too, or
    // this line's quantity was not the challan's when the edit began — changes
    // only this invoice's share: its quantity, pieces and amount never travel.
    var others = (idx[it.id] || []).some(function(r) { return r.invoiceId !== inv.id; });
    var part = others || li._orig.qty !== (it.qty == null ? null : it.qty);
    // A line billed in another unit than its challan line's travels back only as a correction the
    // operator named ("Challan unit was wrong"), and only on a whole line. Any other unit change is how
    // the customer is billed, not what their paper said: the challan keeps its unit and its quantity.
    var unitOff = (li.unit || null) !== (it.unit == null ? null : it.unit);
    var carryUnit = unitOff && !part && li.unitReason === 'challan';
    if (unitOff && !carryUnit) part = true;
    var from = {}, changed = false;
    CHALLAN_SYNC_FIELDS.forEach(function(f) {
      if (part && CHALLAN_SHARE_FIELDS.indexOf(f) >= 0) return;
      if (f === 'unit' && unitOff && !carryUnit) return;
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
  return { col: regFilter.regSortBy === 'number' ? 'number' : 'date', dir: regFilter.regSortDir || 'desc' };
}

/* One test of the register's filters, for an invoice and for a voided number alike (isVoid): the export's voids ran
   their own copy, which ignored the State filter. A void is in no state, so a State filter leaves it out; a search
   reaches the challan the deleted invoice billed, as it reaches an invoice's. */
function regFilterMatch(rec, isVoid) {
  if (regFilter.clientId && rec.clientId !== parseInt(regFilter.clientId)) return false;
  // A date range and a month are alternatives, never layered — whichever the
  // operator set last wins and the other is cleared, so there is no precedence
  // rule to remember. ISO dates compare lexically, so no parsing is needed.
  if (regFilter.dateFrom || regFilter.dateTo) {
    if (!rec.date) return false;
    if (regFilter.dateFrom && rec.date < regFilter.dateFrom) return false;
    if (regFilter.dateTo && rec.date > regFilter.dateTo) return false;
  } else if (regFilter.month && !(rec.date && rec.date.startsWith(regFilter.month))) return false;
  if (regFilter.search) {
    var q = regFilter.search.toLowerCase();
    // Challan numbers too: an invoice is found by the challan it billed as
    // often as by its own number, and matching only the invoice number made a
    // challan search land on whichever invoice's digits happened to contain it.
    if ((rec.displayNumber || '').toLowerCase().indexOf(q) < 0 && (rec.clientName || '').toLowerCase().indexOf(q) < 0 &&
        !regChallanMatch(rec.challanNo, q)) return false;
  }
  if (regFilter.state) {
    if (isVoid) return false;
    if (regFilter.state === 'cancelled' ? rec.status !== 'cancelled' : (rec.status !== 'active' || getInvState(rec) !== regFilter.state)) return false;
  }
  return true;
}

function getFilteredInvoices() {
  let list = S.invoices.filter(function(i) { return regFilterMatch(i, false); });

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
        case 'number': return dir * invSerialCompare(a, b);
        case 'taxable': return dir * ((a.taxableValue || 0) - (b.taxableValue || 0));
        case 'total': return dir * ((a.grandTotal || 0) - (b.grandTotal || 0));
        case 'state': {
          va = a.status === 'cancelled' ? -1 : Math.max(0, invStateIdx(getInvState(a)));
          vb = b.status === 'cancelled' ? -1 : Math.max(0, invStateIdx(getInvState(b)));
          return dir * (va - vb);
        }
        default: va = a.date || ''; vb = b.date || ''; return va < vb ? -dir : va > vb ? dir : 0;
      }
    });
  } else {
    var sortDir = regFilter.regSortDir || 'desc';
    if (regFilter.regSortBy === 'number') {
      list.sort(function(a, b) { return (sortDir === 'asc' ? 1 : -1) * invSerialCompare(a, b); });
    } else if (sortDir === 'asc') {
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
  var byNumber = regFilter.regSortBy === 'number';
  var unaccounted = unaccountedNumberCount();
  var rangeActive = !!(regFilter.dateFrom || regFilter.dateTo);
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
    stateOpt('', 'All states') + stateOpt('created', 'Created') + stateOpt('printed', 'Printed') + stateOpt('dispatched', 'Dispatched') +
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
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invRegSortBy">' + (byNumber ? 'By number' : 'By date') + '</button>' +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invRegToggleSort">' +
      (byNumber ? (sortDir === 'asc' ? 'Lowest first' : 'Highest first') : (sortDir === 'asc' ? 'Oldest first' : 'Newest first')) + '</button>' +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invRegToggleSelect" aria-pressed="' + _regSelectMode + '">' + (_regSelectMode ? 'Cancel select' : 'Select') + '</button>') +
    // Offered wherever ticking is actually possible; kept in step with the selection by _renderRegSelBar.
    '<span id="regSelectAllSlot"' + (_regSelectAllHtml() ? '' : ' hidden') + '>' + _regSelectAllHtml() + '</span>' +
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

/* The select-all button, as the selection and the filter stand now. It was drawn with the toolbar only, so after a
   bulk action or a tick cleared the selection it still said "Clear selection" and then selected everything. */
function _regSelectAllHtml() {
  var selectable = regSelectableInvoices();
  if (!(_isDesktop || _regSelectMode) || !selectable.length) return '';
  var allSelected = selectable.every(function(i) { return _regSelected[i.id]; });
  return '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invRegSelectAll">' +
    (allSelected ? 'Clear selection' : 'Select all (' + selectable.length + ')') + '</button>';
}

/* Clear range: the range goes from the filter and from its two fields. It read the fields back after clearing
   the filter, so the range the fields still held came straight back. */
function regClearRange() {
  ['regDateFrom', 'regDateTo'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
  regFilter.dateFrom = ''; regFilter.dateTo = '';
  captureRegFilters();
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
    // Sorted by number they are grouped by series instead: a day heading over a
    // run of numbers would repeat every time a backdated invoice broke the run.
    html += '<div class="inv-panel inv-panel-flush">';
    var byNum = regFilter.regSortBy === 'number';
    var groups = [], byDate = {};
    filtered.forEach(function(inv) {
      var k = byNum ? invSeriesOf(inv) : (inv.date || '');
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
    // The latest thirty invoices; the rest one tap away (UX overhaul 2, step 6). The summary above counts them all.
    var regRows = [];
    groups.forEach(function(k) {
      var list = byDate[k], live = list.filter(function(i) { return i.status === 'active'; });
      regRows.push({ head: true, parts: ['<div class="inv-row-group"><span>' + (byNum ? (k ? escHtml(k.replace(/\/$/, '')) : 'No number') : (k ? escHtml(formatDate(k)) : 'No date')) + ' · ' + list.length + '</span>' +
        '<span class="inv-num">' + formatCurrency(gstRound(sumTaxable(live))) + '</span></div>'] });
      list.forEach(function(inv) {
        var cancelled = inv.status === 'cancelled';
        var tickable = _regSelectMode && !cancelled;
        var cls = 'inv-row inv-row-2' + (cancelled ? ' inv-row-muted' : '') + (_regSelected[inv.id] ? ' inv-row-selected' : '');
        var open = ' data-action="invViewInvoiceDetail" data-id="' + escHtml(inv.id) + '"';
        var main = '<span class="inv-row-title inv-id" data-invnum>' + escHtml(inv.displayNumber) + '</span>' +
          '<span class="inv-row-meta">' + escHtml(inv.clientName) + '</span>';
        var end = '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + formatCurrency(inv.grandTotal) + '</span>' +
          getStateDotHtml(inv) + cnInvoiceMarkHtml(inv) + '</span></span>';
        // With no tick box the whole row opens the invoice, figures included; with
        // one, the box is its own full-height touch target beside the row.
        regRows.push(tickable
          ? '<div class="' + cls + '"><label class="inv-row-lead inv-row-tick">' + _regCheckHtml(inv) + '</label>' +
            '<button class="inv-row-main"' + open + '>' + main + '</button>' + end + '</div>'
          : '<button class="' + cls + '"' + open + (cancelled ? ' data-cancelled' : '') + '><span class="inv-row-main">' + main + '</span>' + end + '</button>');
      });
    });
    html += uiMoreHtml('reg-list', regRows, { noun: 'invoices' }) + '</div>';
  }

  area.innerHTML = html + _regExportHtml();
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
    '<th class="inv-table-check"><span class="inv-visually-hidden">Select</span></th>' + th('number', 'Invoice') + th('client', 'Client', 'inv-col-grow') + th('date', 'Date', 'inv-col-opt3') +
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
      '<td>' + getStateDotHtml(inv) + ' ' + cnInvoiceMarkHtml(inv) + '</td></tr>';
  });
  return html + '</tbody></table>' + _regExportHtml();
}

/* A list-and-pane view rebuilds its table and pane whole, which drops the keyboard to <body>.
   Focus goes back to the same control; where that is gone or hidden (the pane covering the
   list), to the pane's close button, and on closing, to the row of the item that was open.
   Shared by the Register and IM (one wrapper id, and the actions that open and close). */
function _mdFocusKey(wrapId, openId) {
  var ae = document.activeElement, wrap = document.getElementById(wrapId);
  if (!ae || !wrap || !wrap.contains(ae) || !ae.dataset || !ae.dataset.action) return null;
  return { wrap: wrapId, action: ae.dataset.action, id: ae.dataset.id || '', col: ae.dataset.col || '', open: openId };
}
function _mdRestoreFocus(k, openAction, closeAction) {
  var wrap = k && document.getElementById(k.wrap);
  if (!wrap) return;
  var q = function(sel) { var el = wrap.querySelector(sel); return el && el.offsetParent !== null ? el : null; };
  var attr = function(n, v) { return v ? '[data-' + n + '="' + String(v).replace(/["\\]/g, '\\$&') + '"]' : ''; };
  var el = k.action === closeAction
    ? q('button[data-action="' + openAction + '"]' + attr('id', k.open))
    : q(':is(button, input)[data-action="' + k.action + '"]' + attr('id', k.id) + attr('col', k.col));
  el = el || q('[data-action="' + closeAction + '"]');
  if (el) el.focus();
}
function _regFocusKey() { return _mdFocusKey('regMasterDetail', _regActiveInvId); }
function _regRestoreFocus(k) { _mdRestoreFocus(k, 'invSelectRegRow', 'invRegClosePane'); }

/* Render invoice detail inline in #regDetail */
function _renderRegDetail(invId, skipMasterRefresh) {
  var focusKey = skipMasterRefresh ? null : _regFocusKey();
  var inv = invId ? S.invoices.find(function(i) { return i.id === invId; }) : null;
  var detailEl = document.getElementById('regDetail');
  _regActiveInvId = inv ? invId : null;
  // The pane takes room only while an invoice is open; the table then drops columns in priority order (§6.11).
  var wrap = document.getElementById('regMasterDetail');
  if (wrap) wrap.classList.toggle('inv-pane-open', !!inv);
  if (detailEl) detailEl.innerHTML = inv ? paneHeadHtml('<span class="inv-panel-title inv-id">' + escHtml(inv.displayNumber) + '</span>', 'invRegClosePane') + invoiceDetailHtml(inv) : '';
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
      '<div class="inv-pane-host" id="regMasterDetail">' +
        '<div class="inv-pane-list" id="regMaster"></div>' +
        '<div class="inv-pane" id="regDetail"></div>' +
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
  var slot = document.getElementById('regSelectAllSlot');
  if (slot) { slot.innerHTML = _regSelectAllHtml(); slot.hidden = !slot.innerHTML; }
  var bar = document.getElementById('regSelBar');
  if (!bar) return;
  var ids = _regSelectedIds();
  if (ids.length === 0 || (!_isDesktop && !_regSelectMode)) { bar.innerHTML = ''; return; }

  // Determine what state transitions are available
  var canPrint = 0, canDispatch = 0, canDeliver = 0, canFile = 0, taxable = 0;
  ids.forEach(function(id) {
    var inv = S.invoices.find(function(i) { return i.id === id; });
    if (!inv || inv.status !== 'active') return;
    taxable += inv.taxableValue || 0;
    var st = getInvState(inv);
    if (st === 'created') canPrint++;
    if (st === 'created' || st === 'printed') canDispatch++;
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
  if (canPrint > 0) btns += b('invRegBulkState', 'Printed (' + canPrint + ')', ' data-state="printed"');
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

  var targetIdx = invStateIdx(targetState);
  if (targetIdx < 0) return;

  ids.forEach(function(id) {
    var inv = S.invoices.find(function(i) { return i.id === id; });
    if (!inv || inv.status !== 'active') return;
    var curState = getInvState(inv);
    var curIdx = invStateIdx(curState);
    // One step at a time, except that Created may be dispatched straight away (printed outside the app).
    if (curIdx >= 0 && (curIdx + 1 === targetIdx || (curState === 'created' && targetState === 'dispatched'))) {
      invSetState(inv, targetState, now);
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

/* Phone: sort by the date an invoice was raised, or by its number. */
function toggleRegSortBy() {
  regFilter.regSortBy = regFilter.regSortBy === 'number' ? 'date' : 'number';
  saveRegFilter();
  _regToolbarRendered = false;
  renderRegisterToolbar();
  _regToolbarRendered = true;
  _renderRegView();
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
  dialogOpen(_invDetailSheetHtml(inv), { dismiss: true });
}
function _invDetailSheetHtml(inv) {
  return '<div class="inv-dialog" data-inv-detail="' + escHtml(inv.id) + '">' + dialogHeadHtml('Invoice <span class="inv-id">' + escHtml(inv.displayNumber) + '</span>') +
    invoiceDetailHtml(inv) + '</div>';
}

/* A state set anywhere shows at once wherever the invoice is drawn (owner, 29 Sep 2026: "the invoice state change to
   printed should be immediately once the invoice is printed and when I mark it dispatched the state should change
   immediately, right now I have to refresh or switch tabs"). After Print nothing was redrawn, and a mark redrew only
   the Register, so Home's recent invoices, a client, a challan or the To-do kept the old state under the sheet. The
   page is redrawn in place, and a sheet open on the invoice is redrawn on its new step rather than closed. A page
   holding typed work (a form in progress, IM's challan form) keeps it and shows the change on the next move. */
function invStateShown(invId) {
  var inv = S.invoices.find(function(i) { return i.id === invId; });
  _tabDirty.home = true;
  _tabDirty.register = true;
  var sheets = Array.prototype.filter.call(document.querySelectorAll('.inv-scrim-dialog [data-inv-detail]'), function(d) { return d.getAttribute('data-inv-detail') === invId; });
  var hadFocus = sheets.some(function(d) { return d.contains(document.activeElement); });
  keepScroll(function() {
    if (!_pageTyped && !(typeof _challanForm !== 'undefined' && _challanForm)) tabRedrawActive();
    if (inv) sheets.forEach(function(d) {
      var tmp = document.createElement('div');
      tmp.innerHTML = _invDetailSheetHtml(inv);
      d.parentNode.replaceChild(tmp.firstChild, d);
    });
  });
  // The button pressed is gone with the step it named: focus goes to the next one, else the sheet's close.
  var act = document.activeElement;
  if (hadFocus && !(act && act.closest && act.closest('[data-inv-detail]'))) {
    var sheet = Array.prototype.find.call(document.querySelectorAll('.inv-scrim-dialog [data-inv-detail]'), function(d) { return d.getAttribute('data-inv-detail') === invId; });
    var to = sheet && (sheet.querySelector('[data-action="invAdvanceState"]') || sheet.querySelector('.inv-dialog-close'));
    if (to) to.focus({ preventScroll: true });
  }
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
  // The number is the pane's and the sheet's head (paneHeadHtml / dialogHeadHtml); it is not said twice here.
  h += '<div class="inv-kv inv-mb-8">' +
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
    h += '<div class="inv-row-group"><span>Status</span></div>';
    INV_STATES.forEach(function(st, i) {
      // A step passed is done; the one it is in is coloured by how long it has sat there (invStateTone).
      var tone = i < curIdx ? 'ok' : i === curIdx ? invStateTone(inv) : 'neutral';
      var at = inv[INV_STATE_AT[st]];
      var skipped = i < curIdx && !at && st === 'printed';
      h += '<div class="inv-row' + (i > curIdx || skipped ? ' inv-row-muted' : '') + '"' + (i === curIdx ? ' aria-current="step"' : '') + '>' +
        '<span class="inv-row-main"><span class="inv-dot inv-dot-' + (skipped ? 'neutral' : tone) + '">' + escHtml(INV_STATE_LABELS[st]) +
        (i === curIdx && invStateAgeText(inv) ? ' · ' + escHtml(invStateAgeText(inv)) : i === curIdx ? ' · now' : '') + '</span></span>' +
        '<span class="inv-row-end inv-row-meta">' + (at ? escHtml(formatTimestamp(at)) : skipped ? 'not recorded' : '') + '</span></div>';
    });
    if (curIdx < INV_STATES.length - 1) {
      var adv = function(st) {
        return '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAdvanceState" data-id="' + escHtml(inv.id) + '" data-state="' + st + '">Mark ' +
          escHtml(INV_STATE_LABELS[st]).toLowerCase() + '</button>';
      };
      // Print cannot tell whether the paper came out: a Printed invoice can be put back (invNotPrinted).
      h += '<div class="inv-row"><span class="inv-row-actions">' + adv(INV_STATES[curIdx + 1]) + (cur === 'created' ? adv('dispatched') : '') +
        (cur === 'printed' ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invNotPrinted" data-id="' + escHtml(inv.id) + '">Not printed</button>' : '') +
        '</span></div>';
    }
  }

  h += cnInvoiceDetailHtml(inv);

  h += '<div class="inv-row-group"><span>Lines · ' + d.items.length + '</span></div><div data-lines>';
  d.items.forEach(function(item, li) {
    var raw = raws[li];
    h += '<div class="inv-row inv-row-auto" data-line>' +
      '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(lineLabel(raw || item)) + '</span>' +
      '<span class="inv-row-meta"><span class="inv-num">' + escHtml(item.qty) + '</span> ' + escHtml(item.unit) +
      (item.nosQtyRaw && item.nosQtyRaw > 0 ? ' (' + escHtml(item.nosQtyRaw) + ' NOS)' : '') + ' × <span class="inv-num">' + escHtml(item.rate) + '</span></span>' +
      zeroReasonTag(raw) + challanAckTag(raw) + detailRateMatch(inv, raw) + '</span>' +
      '<span class="inv-row-end inv-num">' + formatCurrency(Number(raw && raw.amount != null ? raw.amount : item.amount) || 0) + '</span></div>';
  });
  h += '</div>';

  var tot = function(label, value, strong) {
    return '<div class="inv-row' + (strong ? ' inv-row-strong' : '') + '"><span class="inv-row-main">' + label + '</span><span class="inv-row-end inv-num">' + escHtml(value) + '</span></div>';
  };
  h += '<div class="inv-row-group"><span>Totals</span></div>' + tot('Taxable value', d.taxableValue);
  if (d.gstType === 'intra') h += tot('CGST @ ' + escHtml(d.cgstPer) + '%', d.cgstAmt) + tot('SGST @ ' + escHtml(d.sgstPer) + '%', d.sgstAmt);
  else h += tot('IGST @ ' + escHtml(d.igstPer) + '%', d.igstAmt);
  h += tot('Grand total', d.grandTotal, true) + finInvoicePaymentHtml(inv) + '</div>';

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
  return '<div class="inv-note"><span class="inv-badge inv-badge-' + (raw.zeroReason ? 'warning' : 'danger') + '">\u20B90</span> ' + escHtml(text) + '</div>';
}

/* A line the challan could not vouch for says why, where the invoice is read: more than was left
   on its challan line, or billed in another unit. An over-bill accepted before reasons were asked
   (`overBillAck: {at, left}`) says so rather than reading as explained. */
function challanAckTag(raw) {
  if (!raw) return '';
  var out = '', tag = function(badge, text, ok) {
    return '<div class="inv-note" data-ack-tag><span class="inv-badge inv-badge-' + (ok ? 'warning' : 'danger') + '">' + badge + '</span> ' + escHtml(text) + '</div>';
  };
  var o = raw.overBillAck;
  if (o) out += tag('Over challan', 'Billed over the ' + imQtyText(o.left) + ' left on its challan line: ' +
    (o.reason ? challanAckReasonLabel('over', o) + (o.note ? ' \u2014 ' + o.note : '') : 'accepted, no reason recorded'), !!o.reason);
  var u = raw.unitChangeAck;
  if (u) out += tag('Unit changed', 'Challan ' + (u.from || 'no unit') + ', billed ' + (u.to || 'no unit') + ', closing the challan line: ' +
    (u.reason ? challanAckReasonLabel('unit', u) + (u.note ? ' \u2014 ' + u.note : '') : 'no reason recorded'), !!u.reason);
  return out;
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
    // A date the invoice was saved without stays blank: an edit or a reissue used to fill today into it.
    poDate: inv.poDate || inv.challanDate || '',
    // A P.O. date the invoice was saved with, other than its challan date, was typed: it stays.
    _pdTyped: !!inv.poDate && inv.poDate !== (inv.challanDate || ''),
    challanNo: inv.challanNo || '',
    challanDate: inv.challanDate || '',
    despatchDate: inv.despatchDate || '',
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

async function editInvoice(invId) {
  let inv = S.invoices.find(i => i.id === invId);
  if (!inv) return;
  // Refused before the question, so nobody discards a typed invoice to be told this one cannot be edited (the review).
  if (inv.status === 'cancelled') {
    showToast('Cancelled invoices cannot be edited', 'warning');
    return;
  }
  // An invoice being typed is not thrown away unasked (createDiscardOk, create.js).
  if (!(await createDiscardOk())) return;
  // Found again after the question: another window's save can replace the book while it is open.
  inv = S.invoices.find(i => i.id === invId);
  if (!inv || inv.status === 'cancelled') { showToast(inv ? 'Cancelled invoices cannot be edited' : 'That invoice is no longer in the book', 'warning'); return; }

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
  createMarkBase();
  closeOverlay();
  renderCreateForm();
  switchTab('pageCreate');
  showToast(editToast, 'warning');
}

/* Cancel invoice — set status to cancelled, unlink IM */
function cancelInvoice(invId) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv || inv.status === 'cancelled') return;

  // A filed invoice is in a return already: cancelling it here changes the book, not the return.
  const filed = getInvState(inv) === 'filed';
  // An act: the consequence in the body, the danger button last; a tap on the scrim does nothing (DP 5.2).
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('Cancel invoice', 'invCloseConfirm') +
    (filed ? '<div class="inv-callout inv-callout-warning inv-mb-8" data-cancel-warn>This invoice is marked filed: its number and value are in a filed GSTR-1. ' +
      'Cancelling it here does not change that return. The change has to be reported as an amendment in a later return, and a credit note is usually the right instrument for a filed invoice.</div>' : '') +
    '<p class="inv-mb-8">Cancel invoice <strong class="inv-id">' + escHtml(inv.displayNumber) + '</strong>? It will appear as cancelled in your GSTR-1 export. The customer should be notified. This cannot be undone.</p>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseConfirm">Keep active</button>' +
    '<button class="inv-btn inv-btn-danger inv-btn-solid" data-action="invConfirmCancel" data-id="' + escHtml(inv.id) + '">Cancel invoice</button></div></div>');
}

function confirmCancelInvoice(invId) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv) return;
  inv.status = 'cancelled';
  inv.cancelledAt = Date.now();
  inv.updatedAt = Date.now();
  // A cancelled invoice bills nothing: its share of each challan line is free again.
  // A line it billed before lines were linked is freed by its flag, as it always was.
  (S.incomingMaterial || []).forEach(im => (im.items || []).forEach(it => {
    if (it.billedLegacy && it.invoiceId === inv.id) { it.invoiced = false; it.invoiceId = null; delete it.billedLegacy; }
  }));
  imSyncBilled();
  saveState();
  closeOverlay();
  renderRegister();
  showToast('Invoice ' + inv.displayNumber + ' cancelled');
}

/* What deleting an invoice does to its number, and the words for it:
   - spent: the customer holds it (dispatched or later), or it was cancelled, which the export already declared at
     zero. It stays in the series and keeps exporting at zero, as voided.
   - returns: nothing after it is held in its series, so the next invoice takes it.
   - gap: a later number is already issued, so Next cannot walk back to it. It stays in the series as a gap, and the
     returns carry it at zero as voided. The dialog said "returns to the series" in both of the last two cases. */
function invDeleteOutcome(inv) {
  var n = invNumInt(inv.invoiceNumber), series = invSeriesOf(inv);
  if (invStateIdx(getInvState(inv)) >= invStateIdx('dispatched')) return { kind: 'spent', text: 'This cannot be undone.' };
  if (inv.status === 'cancelled') return { kind: 'spent', text: 'It was cancelled, so its number is already declared at zero in the GSTR-1 export: the number stays spent and keeps exporting at zero, as voided. This cannot be undone.' };
  var later = 0;
  S.invoices.forEach(function(i) { var m = invNumInt(i.invoiceNumber); if (i !== inv && m != null && m > n && m > later && invSeriesOf(i) === series) later = m; });
  getVoidedNumbers().forEach(function(v) { var m = invNumInt(v.invoiceNumber); if (v.reserved && m != null && m > n && m > later && invSeriesOf(v) === series) later = m; });
  if (!later) return { kind: 'returns', text: 'It never left the building and nothing after it is issued, so the next invoice takes ' + escHtml(inv.displayNumber) + '.' };
  return { kind: 'gap', text: 'It never left the building, but ' + escHtml(series + padInvNum(later)) + ' is already issued, so this number cannot return to the series: ' +
    'it stays as a gap, and the sales register and GSTR-1 CSVs list it at zero, as voided.' };
}

/* Back on the Register with one invoice open: the desktop's pane, the phone's sheet. */
function regShowInvoice(invId) {
  if (!S.invoices.some(function(i) { return i.id === invId; })) return;
  if (_isDesktop) _renderRegDetail(invId); else openInvoiceDetail(invId);
}

/* Delete invoice — hard delete with filing cutoff tiered warning */
function deleteInvoice(invId) {
  const inv = S.invoices.find(i => i.id === invId);
  if (!inv) return;

  // Past GSTR-1's due day for its month (the 11th of the next, invFileDue — the date the Delivered state is judged by)
  // the invoice may be in a filed return.
  const due = invFileDue(inv);
  const pastDeadline = !!due && new Date() >= due;

  // The lifecycle state is harder evidence than the date heuristic: once an
  // invoice is dispatched the customer holds a document bearing that number,
  // and deleting it here does not retract it there.
  const issued = invStateIdx(getInvState(inv)) >= invStateIdx('dispatched');
  const canReissue = inv.status !== 'cancelled' && getInvState(inv) !== 'filed';

  let warnHtml = '';
  let bodyText = '';
  let btnClass = 'inv-btn-danger inv-btn-solid';
  const num = '<strong class="inv-id">' + escHtml(inv.displayNumber) + '</strong>';

  if (issued) {
    warnHtml = '<div class="inv-callout inv-callout-warning inv-mb-8" data-delete-warn>This invoice was ' + escHtml(INV_STATE_LABELS[getInvState(inv)].toLowerCase()) +
      '. The customer may hold a copy and claim credit against this number, which deleting it here does not retract' +
      (pastDeadline ? ', and it may already sit in a filed return' : '') +
      '. A credit note is usually the right instrument. The number stays spent either way.</div>';
  } else if (pastDeadline) {
    warnHtml = '<div class="inv-callout inv-callout-warning inv-mb-8" data-delete-warn>This invoice may have been included in a filed GST return. Cancelling (not deleting) is recommended.</div>';
  }
  // What happens to the number, said as it will happen (invDeleteOutcome).
  const out = invDeleteOutcome(inv);
  bodyText = 'Delete invoice ' + num + '? ' + out.text;
  if (!issued && !pastDeadline && out.kind === 'returns') btnClass = 'inv-btn-primary';

  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('Delete invoice', 'invCloseConfirm') +
    warnHtml +
    '<p class="inv-mb-8">' + bodyText + '</p>' +
    '<div class="inv-field"><label class="inv-field-label" for="invDeleteReason">Why is it going?</label>' +
    '<input class="inv-input" id="invDeleteReason" placeholder="e.g. duplicate of 00657" autocomplete="off">' +
    '<div class="inv-field-hint">Kept against the number in the register. Without it a deleted number is indistinguishable from one never issued.</div></div>' +
    // Before filing, a corrected invoice may take the number back. Filed is
    // final: GSTR-1 carries the number and only a credit note corrects it.
    (canReissue
      ? '<div class="inv-callout inv-callout-neutral"><button class="inv-btn inv-btn-secondary inv-btn-block" data-action="invConfirmReissue" data-id="' + escHtml(inv.id) + '">Delete and reissue <span class="inv-id">' + escHtml(inv.invoiceNumber) + '</span></button>' +
        '<div class="inv-field-hint">Opens a new invoice with the same lines under this number, for correcting it before the GST return is filed. The old version stays on record against the number.</div></div>'
      : '') +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseConfirm">Keep</button>' +
    '<button class="inv-btn ' + btnClass + '" data-action="invConfirmDelete" data-id="' + escHtml(inv.id) + '">Delete</button></div></div>');
}

async function confirmDeleteInvoice(invId, reissue) {
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
  // A reissue opens the create form: an invoice being typed there is asked about BEFORE anything is deleted.
  if (reissue && !(await createDiscardOk())) return;
  if (!S.invoices.includes(inv)) return;

  // The replacement's form is read BEFORE the delete unlinks the challan lines.
  const reissueForm = reissue ? invoiceFormFrom(inv, { reissue: { invoiceNumber: inv.invoiceNumber, displayNumber: inv.displayNumber } }) : null;

  const dispNum = inv.displayNumber;
  // A number the customer has seen is spent, and so is a cancelled one (the export already declared it at zero);
  // any other returns to the series or stays as a gap (invDeleteOutcome). Recorded before the invoice is spliced out.
  const reserved = invDeleteOutcome(inv).kind === 'spent';
  recordVoidedNumber(inv, reason, reserved);

  // Hard delete from array; its share of each challan line is free again.
  const idx = S.invoices.indexOf(inv);
  if (idx > -1) S.invoices.splice(idx, 1);
  imSyncBilled();

  // Recycle the number only if nothing holds it — live invoices and reserved
  // voids both count, so invNextNum can no longer walk back over an issued one.
  recomputeNextInvoiceNumber();

  saveState();
  closeOverlay();
  if (reissueForm) {
    invoiceForm = reissueForm;
    // The old invoice's PO and vehicle travel with it; the client's own fill only a field it left empty.
    createApplyClientDefaults();
    createMarkBase();
    renderCreateForm();
    switchTab('pageCreate');
    showToast('Reissuing ' + dispNum + ' — correct it and save', 'warning');
    return;
  }
  renderRegister();
  showToast('Invoice ' + dispNum + (reserved ? ' deleted — number stays spent' : ' deleted'));
}

