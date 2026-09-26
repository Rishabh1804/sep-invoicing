/* ===== CLIENT MASTER ===== */
var _clientsActiveId = null;

var CLIENT_MODE_LABEL = { weight: 'Weight', piece: 'Piece', nos_to_weight: 'NOS to weight' };

/* The rate in force today, else the newest on record. */
function _clientRateNow(c) {
  var today = localDateStr();
  var sorted = (c.rates || []).slice().sort(function(a, b) { return b.effectiveFrom.localeCompare(a.effectiveFrom); });
  return sorted.find(function(r) { return r.effectiveFrom <= today; }) || sorted[0] || null;
}

function _clientStatusDot(c) {
  return '<span class="inv-dot inv-dot-' + (c.isActive ? 'ok' : 'neutral') + '">' + (c.isActive ? 'Active' : 'Inactive') + '</span>';
}

/* Phone: a row per client that opens its edit sheet. Desktop: a table beside the pane. */
function renderClientList(filter) {
  const q = (filter || '').toLowerCase();
  const sorted = [...S.clients].sort((a,b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const filtered = q ? sorted.filter(c => c.name.toLowerCase().includes(q) || (c.gstin||'').toLowerCase().includes(q)) : sorted;
  const el = document.getElementById('clientList');
  if (!el) return;
  const countEl = document.getElementById('clientsCount');
  if (countEl) countEl.textContent = filtered.length + (filtered.length === 1 ? ' client' : ' clients');

  // Desktop: a client filtered out of the list closes its pane.
  if (_isDesktop && _clientsActiveId && !filtered.some(function(c) { return c.id === _clientsActiveId; })) {
    _clientsActiveId = null;
    _clientsPaneShow('', '');
  }

  if (filtered.length === 0) {
    el.innerHTML = _isDesktop ? '<div class="inv-empty">No clients found</div>' : '<div class="inv-panel"><div class="inv-empty">No clients found</div></div>';
    return;
  }
  const overrides = c => (c.itemRates && c.itemRates.length) ? c.itemRates.length + ' override' + (c.itemRates.length > 1 ? 's' : '') : '';

  if (_isDesktop) {
    el.innerHTML = '<table class="inv-table"><thead><tr><th class="inv-col-grow">Client</th><th class="inv-col-opt2">GSTIN</th>' +
      '<th class="inv-col-opt1">Billing</th><th class="inv-num">Rate / kg</th><th>Status</th></tr></thead><tbody>' +
      filtered.map(c => {
        const r = _clientRateNow(c);
        const id = escHtml(String(c.id));
        return '<tr class="' + (c.isActive ? '' : 'inv-row-muted') + '"' + (_clientsActiveId === c.id ? ' aria-current="true"' : '') +
          ' data-action="invSelectClientRow" data-id="' + id + '">' +
          // The name is a real button, so the row opens from the keyboard.
          '<td class="inv-col-grow" title="' + escHtml(c.name) + '"><button class="inv-btn-link" data-action="invSelectClientRow" data-id="' + id + '">' + escHtml(c.name) + '</button></td>' +
          '<td class="inv-id inv-col-opt2">' + escHtml(c.gstin || '') + '</td>' +
          '<td class="inv-col-opt1">' + escHtml([CLIENT_MODE_LABEL[c.billingMode] || c.billingMode, overrides(c)].filter(Boolean).join(' · ')) + '</td>' +
          '<td class="inv-num">' + (r ? formatCurrency(r.ratePerKg) : '&mdash;') + '</td>' +
          '<td>' + _clientStatusDot(c) + '</td></tr>';
      }).join('') + '</tbody></table>';
    return;
  }

  el.innerHTML = '<div class="inv-panel inv-panel-flush">' + filtered.map(c => {
    const r = _clientRateNow(c);
    const meta = [c.gstin || 'No GSTIN', CLIENT_MODE_LABEL[c.billingMode] || c.billingMode, overrides(c)].filter(Boolean).join(' · ');
    return '<button class="inv-row inv-row-2' + (c.isActive ? '' : ' inv-row-muted') + '" data-action="invEditClient" data-id="' + escHtml(String(c.id)) + '">' +
      '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(c.name) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(meta) + '</span></span>' +
      '<span class="inv-row-end"><span class="inv-row-stack">' +
      (r ? '<span class="inv-num">' + formatCurrency(r.ratePerKg) + '/kg</span>' : '<span class="inv-row-meta">No rate</span>') +
      (c.isActive ? '' : _clientStatusDot(c)) + '</span></span></button>';
  }).join('') + '</div>';
}

/* Client add/edit overlay */
function openClientEdit(clientId) {
  const c = S.clients.find(x => x.id === clientId);
  if (!c) return;
  _showClientOverlay(c, false);
}

function openClientAdd() {
  _showClientOverlay(null, true);
}

function _blankClient() {
  return {
    id: 0, name: '', gstin: '', state: 'JHARKHAND', stateCode: '20',
    add1: '', add2: '', add3: '', mobile: '', phone: '', email: '',
    billingMode: 'weight', gstType: 'intra', gstRate: 18,
    rates: [], itemRates: [], isActive: true, notes: ''
  };
}

/* A labelled field (§6.15). `control` is the whole input/select element. */
function _cfield(id, label, control) {
  return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' + control + '</div>';
}
function _cinput(id, value, cls, extra) {
  return '<input class="inv-input' + (cls ? ' ' + cls : '') + '" id="' + id + '" value="' + escHtml(value == null ? '' : value) + '"' + (extra || '') + '>';
}

/* A card on the client (rates, piece rates, piece weights): its rows, then the form that adds to it. */
function _clientCardHtml(title, count, rowsHtml, bodyHtml, id) {
  return '<div class="inv-panel inv-panel-flush">' +
    '<div class="inv-panel-head"><span class="inv-panel-title">' + title + (count != null ? ' <span class="inv-panel-count">' + count + '</span>' : '') + '</span></div>' +
    '<div' + (id ? ' id="' + id + '"' : '') + '>' + rowsHtml + '</div>' + bodyHtml + '</div>';
}

/* A dated entry on a card: what (mono), the figure, the date it applies from, and a remove button. */
function _cardRowHtml(what, figure, date, removeAttrs) {
  return '<div class="inv-row inv-row-2">' +
    '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + what + '</span>' +
    '<span class="inv-row-meta inv-id">' + (date ? 'from ' + escHtml(date) : '') + '</span></span>' +
    '<span class="inv-row-end"><span class="inv-num">' + figure + '</span>' +
    (removeAttrs ? '<button class="inv-btn inv-btn-icon inv-btn-ghost inv-btn-sm"' + removeAttrs + '>&times;</button>' : '') + '</span></div>';
}

function _showClientOverlay(client, isAdd) {
  const c = client || _blankClient();
  const opt = (v, cur, l) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + l + '</option>';
  let rates = '';
  if (!isAdd) {
    rates = _clientCardHtml('Rate history', (c.rates || []).length,
      _clientRateRowsHtml(c) ||
        '<div class="inv-empty">No rate on record</div>',
      '<div class="inv-panel-body">' + _clientRateFieldsHtml(false) +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAddRate" data-client="' + c.id + '">Add rate</button></div>', 'ceditRates');
  }
  const scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">' + (isAdd ? 'Add client' : 'Edit client') + '</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay" aria-label="Close">&times;</button></div>' +
    (isAdd ? '' : finClientMoneyHtml(c.id)) +
    _cfield('ceditName', 'Name', _cinput('ceditName', c.name)) +
    '<div class="inv-fields">' +
    _cfield('ceditGstin', 'GSTIN', _cinput('ceditGstin', c.gstin, 'inv-id', ' maxlength="15"')) +
    _cfield('ceditState', 'State', _cinput('ceditState', c.state)) +
    _cfield('ceditStateCode', 'State code', _cinput('ceditStateCode', c.stateCode, 'inv-id', ' maxlength="2"')) +
    '</div>' +
    _cfield('ceditAdd1', 'Address 1', _cinput('ceditAdd1', c.add1)) +
    _cfield('ceditAdd2', 'Address 2', _cinput('ceditAdd2', c.add2)) +
    _cfield('ceditAdd3', 'Address 3', _cinput('ceditAdd3', c.add3)) +
    '<div class="inv-fields">' +
    _cfield('ceditMobile', 'Mobile', _cinput('ceditMobile', c.mobile || '', 'inv-id', ' type="tel"')) +
    _cfield('ceditPhone', 'Phone', _cinput('ceditPhone', c.phone || '', 'inv-id', ' type="tel"')) +
    _cfield('ceditEmail', 'Email', _cinput('ceditEmail', c.email || '', '', ' type="email"')) +
    '</div>' +
    '<div class="inv-fields">' +
    _cfield('ceditMode', 'Billing mode', '<select class="inv-select" id="ceditMode">' +
      opt('weight', c.billingMode, 'Weight (KG)') + opt('piece', c.billingMode, 'Piece (challan)') + opt('nos_to_weight', c.billingMode, 'NOS to weight') + '</select>') +
    _cfield('ceditGstType', 'GST type', '<select class="inv-select" id="ceditGstType">' +
      opt('intra', c.gstType, 'Intra (CGST+SGST)') + opt('inter', c.gstType, 'Inter (IGST)') + '</select>') +
    '</div>' +
    _cfield('ceditNotes', 'Notes', '<textarea class="inv-textarea" id="ceditNotes" rows="2">' + escHtml(c.notes) + '</textarea>') +
    '<label class="inv-field inv-toolbar"><input type="checkbox" class="inv-check" id="ceditActive"' + (c.isActive ? ' checked' : '') + '> Active</label>' +
    // A new client takes an optional opening rate; an existing one keeps its dated cards.
    (isAdd ? _clientCardHtml('Opening rate', null, '', '<div class="inv-panel-body">' + _clientRateFieldsHtml(true) + '</div>')
      : rates + _pieceRatesEditHtml(c) + _pieceWeightsEditHtml(c)) +
    '<div class="inv-btn-bar"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invSaveClient" data-client="' + c.id + '" data-mode="' + (isAdd ? 'add' : 'edit') + '">' + (isAdd ? 'Add client' : 'Save') + '</button></div></div>';
  scrim.addEventListener('click', e => { if (e.target === scrim) { scrim.remove(); document.body.style.overflow = ''; popFocus(); } });
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

/* The ₹/kg ladder, newest first; the rate in force today says so. */
function _clientRateRowsHtml(c) {
  var now = _clientRateNow(c);
  return (c.rates || []).slice().sort(function(a, b) { return b.effectiveFrom.localeCompare(a.effectiveFrom); }).map(function(r) {
    var cur = now && r.effectiveFrom === now.effectiveFrom && r.ratePerKg === now.ratePerKg;
    return '<div class="inv-row"><span class="inv-row-main inv-id">from ' + escHtml(r.effectiveFrom) + '</span>' +
      '<span class="inv-row-end">' + (cur ? '<span class="inv-dot inv-dot-ok">Current</span>' : '') +
      '<span class="inv-num">' + formatCurrency(r.ratePerKg) + '/kg</span></span></div>';
  }).join('');
}

function _clientRateFieldsHtml(isAdd) {
  return '<div class="inv-fields">' +
    _cfield('ceditNewRate', isAdd ? 'Rate per kg' : 'New rate per kg', '<input class="inv-input inv-input-num" id="ceditNewRate" type="number" step="0.01" placeholder="14.25">') +
    _cfield('ceditNewRateDate', 'Effective from', '<input class="inv-input inv-id" id="ceditNewRateDate" type="date" value="' + localDateStr() + '">') +
    '</div>';
}

/* Reads the overlay form into a plain object. Returns null on validation failure
   (toast already shown). excludeId skips the client being edited in dup checks. */
function _readClientForm(excludeId) {
  const name = document.getElementById('ceditName').value.trim();
  if (!name) { showToast('Client name is required', 'error'); return null; }
  const dup = S.clients.find(x => x.id !== excludeId && (x.name || '').trim().toLowerCase() === name.toLowerCase());
  if (dup) { showToast('Client already exists: ' + dup.name, 'error'); return null; }

  const gstin = document.getElementById('ceditGstin').value.trim().toUpperCase();
  if (gstin && gstin.length !== 15) { showToast('GSTIN must be 15 characters', 'error'); return null; }

  return {
    name: name,
    gstin: gstin,
    state: document.getElementById('ceditState').value.trim(),
    stateCode: document.getElementById('ceditStateCode').value.trim(),
    add1: document.getElementById('ceditAdd1').value.trim(),
    add2: document.getElementById('ceditAdd2').value.trim(),
    add3: document.getElementById('ceditAdd3').value.trim(),
    mobile: document.getElementById('ceditMobile').value.trim(),
    phone: document.getElementById('ceditPhone').value.trim(),
    email: document.getElementById('ceditEmail').value.trim(),
    billingMode: document.getElementById('ceditMode').value,
    gstType: document.getElementById('ceditGstType').value,
    notes: document.getElementById('ceditNotes').value.trim(),
    isActive: document.getElementById('ceditActive').checked
  };
}

function saveClientEdit(clientId, mode) {
  if (mode === 'add') { addClient(); return; }
  const c = S.clients.find(x => x.id === clientId);
  if (!c) return;
  const form = _readClientForm(clientId);
  if (!form) return;
  Object.keys(form).forEach(k => { c[k] = form[k]; });
  saveState();
  closeOverlay();
  const searchEl = document.getElementById('clientSearch');
  renderClientList(searchEl ? searchEl.value : '');
  // Phase 8E: Refresh detail panel if active client was edited
  if (_isDesktop && _clientsActiveId === clientId) {
    _renderClientDetail(clientId, true);
  }
  showToast('Client saved');
}

function addClient() {
  const form = _readClientForm(0);
  if (!form) return;

  const c = _blankClient();
  Object.keys(form).forEach(k => { c[k] = form[k]; });
  c.id = S.clients.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;

  // Opening rate is optional — a client can be created before rates are negotiated
  const rateVal = document.getElementById('ceditNewRate').value.trim();
  const rateDate = document.getElementById('ceditNewRateDate').value;
  if (rateVal !== '') {
    const rate = parseFloat(rateVal);
    if (isNaN(rate) || rate < 0) { showToast('Enter a valid rate', 'error'); return; }
    if (!rateDate) { showToast('Enter the rate effective date', 'error'); return; }
    c.rates.push({ratePerKg: gstRound(rate), ratePerPiece: null, effectiveFrom: rateDate});
  }

  S.clients.push(c);
  saveState();
  closeOverlay();
  // Clear the filter so the new client is never rendered out of view
  const searchEl = document.getElementById('clientSearch');
  if (searchEl) searchEl.value = '';
  // Desktop: let the detail render refresh the master so the new row gets its
  // active highlight — _clientsActiveId is only set inside _renderClientDetail
  if (_isDesktop) _renderClientDetail(c.id, false);
  else renderClientList('');
  showToast('Client added: ' + c.name);
}

function addClientRate(clientId) {
  const c = S.clients.find(x => x.id === clientId);
  if (!c) return;
  const rate = parseFloat(document.getElementById('ceditNewRate').value);
  const date = document.getElementById('ceditNewRateDate').value;
  if (isNaN(rate) || !date) { showToast('Enter rate and date','error'); return; }
  if (!c.rates) c.rates = [];
  c.rates.push({ratePerKg: rate, ratePerPiece: null, effectiveFrom: date});
  saveState();
  showToast('Rate added');
  closeOverlay();
  // Phase 8E: On desktop, refresh detail panel instead of reopening overlay
  if (_isDesktop && _clientsActiveId === clientId) {
    _renderClientDetail(clientId, false);
  } else {
    openClientEdit(clientId);
  }
}

function closeOverlay() {
  var count = document.querySelectorAll('.inv-overlay-scrim').length;
  document.querySelectorAll('.inv-overlay-scrim').forEach(s => s.remove());
  document.body.style.overflow = '';
  // Pop focus stack for each closed overlay
  for (var i = 0; i < count; i++) popFocus();
  // Phase 8A: Drain deferred mode switch
  if (_pendingModeSwitch) {
    _pendingModeSwitch = false;
    updateLayoutMode();
  }
}

function closeTopOverlay() {
  const all = document.querySelectorAll('.inv-overlay-scrim');
  if (all.length > 0) {
    all[all.length - 1].remove();
    if (document.querySelectorAll('.inv-overlay-scrim').length === 0) {
      document.body.style.overflow = '';
    }
    popFocus();
  }
}

/* ===== CLIENT DETAIL PANE (desktop) =====
   The client's particulars, its Money panel, then its cards as rows under group heads, and the
   last five invoices. One primary: Edit. */
function _renderClientDetail(clientId, skipMasterRefresh) {
  var focusKey = skipMasterRefresh ? null : _clientsFocusKey();
  var c = clientId != null ? S.clients.find(function(x) { return x.id === clientId; }) : null;
  _clientsActiveId = c ? clientId : null;
  if (!c) {
    _clientsPaneShow('', '');
  } else {
    var kv = function(k, v, wide) { return '<div' + (wide ? ' class="inv-kv-wide"' : '') + '><div class="inv-kv-k">' + k + '</div><div>' + v + '</div></div>'; };
    var address = [c.add1, c.add2, c.add3].filter(function(a) { return a; });
    var html = '<div>' + _clientStatusDot(c) + '</div><div class="inv-kv">' +
      (c.gstin ? kv('GSTIN', '<span class="inv-id">' + escHtml(c.gstin) + '</span>', true) : '') +
      (c.state || c.stateCode ? kv('State', escHtml(c.state || '') + (c.stateCode ? ' <span class="inv-id">(' + escHtml(c.stateCode) + ')</span>' : '')) : '') +
      kv('Billing mode', escHtml(CLIENT_MODE_LABEL[c.billingMode] || c.billingMode)) +
      kv('GST type', escHtml(c.gstType === 'inter' ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'), true) +
      (address.length ? kv('Address', address.map(function(a) { return escHtml(a); }).join('<br>'), true) : '') +
      (c.notes ? kv('Notes', escHtml(c.notes), true) : '') +
      '</div>';

    html += finClientMoneyHtml(c.id);

    var group = function(title, n) { return '<div class="inv-row-group"><span>' + title + ' · ' + n + '</span></div>'; };
    var cards = '';
    if ((c.rates || []).length) cards += group('Rate history', c.rates.length) + _clientRateRowsHtml(c);
    if (c.itemRates && c.itemRates.length) {
      cards += group('Item rate overrides', c.itemRates.length) + c.itemRates.map(function(ir) {
        return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title inv-id">' + escHtml(ir.partPattern) + '</span>' +
          (ir.label ? '<span class="inv-row-meta">' + escHtml(ir.label) + '</span>' : '') + '</span>' +
          '<span class="inv-row-end inv-num">' + formatCurrency(ir.rate) + '/' + escHtml(ir.unit || 'kg') + '</span></div>';
      }).join('');
    }
    if (c.pieceRates && c.pieceRates.length) {
      cards += group('Piece rates', c.pieceRates.length) + _sortedPieceRates(c).map(function(pr) {
        return _cardRowHtml(_partGaugeHtml(pr), formatCurrency(pr.rate) + '/pc', pr.effectiveFrom, '');
      }).join('');
    }
    if (c.pieceWeights && c.pieceWeights.length) {
      cards += group('Piece weights', c.pieceWeights.length) + _sortedCard(c.pieceWeights).map(function(pw) {
        return _cardRowHtml(_partGaugeHtml(pw), escHtml(pw.kgPerPiece) + ' kg/pc', pw.effectiveFrom, '');
      }).join('');
    }
    var recent = (S.invoices || []).filter(function(i) { return i.clientId === c.id; })
      .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 5);
    if (recent.length) {
      cards += '<div class="inv-row-group"><span>Recent invoices</span></div>' + recent.map(function(inv) {
        return '<button class="inv-row inv-row-2' + (inv.status === 'cancelled' ? ' inv-row-muted' : '') + '" data-action="invViewInvoiceDetail" data-id="' + escHtml(inv.id) + '">' +
          '<span class="inv-row-main"><span class="inv-row-title inv-id">' + escHtml(inv.displayNumber) + '</span>' +
          '<span class="inv-row-meta inv-id">' + escHtml(formatDate(inv.date)) + '</span></span>' +
          '<span class="inv-row-end inv-num">' + formatCurrency(inv.grandTotal) + '</span></button>';
      }).join('');
    }
    if (cards) html += '<div class="inv-panel inv-panel-flush">' + cards + '</div>';

    html += '<div class="inv-toolbar">' +
      '<button class="inv-btn inv-btn-primary" data-action="invEditClient" data-id="' + c.id + '">Edit</button>' +
      '<button class="inv-btn inv-btn-secondary" data-action="invStatsJumpRegister" data-client-id="' + c.id + '">View in register</button>' +
      '</div>';
    _clientsPaneShow('<span class="inv-panel-title">' + escHtml(c.name) + '</span>', html);
  }

  if (!skipMasterRefresh) {
    var searchEl = document.getElementById('clientSearch');
    renderClientList(searchEl ? searchEl.value : '');
    _clientsRestoreFocus(focusKey);
  }
}

/* A card entry's part, with its gauge when it has one. */
function _partGaugeHtml(e) {
  return '<span class="inv-id">' + escHtml(e.partNumber) + '</span>' + (e.gauge ? ' · <span class="inv-id">' + escHtml(e.gauge) + '</span>' : '');
}


/* ===== PIECE RATE CARD =====
   The client's per-piece rates, dated and keyed on part + gauge. Read by
   getPieceRate() in state.js; see the note there for why these are not
   itemRates overrides. */
var _pieceFillReport = null;

function _sortedPieceRates(c) { return _sortedCard(c.pieceRates); }

function _sortedCard(list) {
  return (list || []).map(function(pr, i) { return Object.assign({ _i: i }, pr); })
    .sort(function(a, b) {
      return rateKey(a.partNumber).localeCompare(rateKey(b.partNumber)) ||
        rateKey(a.gauge).localeCompare(rateKey(b.gauge)) ||
        String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || ''));
    });
}

function _pieceRatesEditHtml(c) {
  // Every client: a weight-billed client can still send a part billed per piece
  // (Parakh's ROLLER), and the matcher tells the operator to add it here.
  var rows = _sortedPieceRates(c).map(function(pr) {
    return _cardRowHtml(_partGaugeHtml(pr), formatCurrency(pr.rate) + '/pc', pr.effectiveFrom,
      ' data-action="invRemovePieceRate" data-client="' + c.id + '" data-idx="' + pr._i + '" aria-label="Remove piece rate"');
  }).join('') || '<div class="inv-empty">No piece rates on record. Fill them from what has been billed, or add one below.</div>';
  var body = (_pieceFillReport && _pieceFillReport.clientId === c.id ? _pieceFillReportHtml(_pieceFillReport) : '') +
    '<div class="inv-panel-body"><div class="inv-fields">' +
    _cfield('ceditPiecePart', 'Part', '<input class="inv-input inv-id" id="ceditPiecePart" placeholder="CLAMP 165X83 (NT)">') +
    _cfield('ceditPieceGauge', 'Gauge', '<input class="inv-input inv-id" id="ceditPieceGauge" placeholder="40X6">') +
    _cfield('ceditPieceRate', 'Rate per piece', '<input class="inv-input inv-input-num" id="ceditPieceRate" type="number" step="0.01" min="0">') +
    _cfield('ceditPieceDate', 'Effective from', '<input class="inv-input inv-id" id="ceditPieceDate" type="date" value="' + localDateStr() + '">') +
    '</div><div class="inv-toolbar inv-toolbar-tight">' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFillPieceRates" data-client="' + c.id + '">Fill from billing history</button>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAddPieceRate" data-client="' + c.id + '">Add piece rate</button></div></div>';
  return _clientCardHtml('Piece rates', (c.pieceRates || []).length, rows, body, 'ceditPieceRates');
}

/* What a fill from billing history did, and what it left out and why: a summary, then each part it
   would not guess at, as rows under the reason. */
function _fillReportHtml(summary, groups) {
  var html = '<div class="inv-panel-body"><div class="inv-callout inv-callout-' + (groups.some(function(g) { return g.rows.length; }) ? 'warning' : 'info') + '">' + summary + '</div></div>';
  groups.forEach(function(g) {
    if (!g.rows.length) return;
    html += '<div class="inv-row-group"><span>' + g.title + '</span></div>' + g.rows.map(function(r) {
      return '<div class="inv-row inv-row-auto"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + r[0] + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">' + r[1] + '</span></span></div>';
    }).join('');
  });
  return html;
}

function _pieceFillReportHtml(r) {
  return _fillReportHtml(
    r.added + ' rate' + (r.added === 1 ? '' : 's') + ' added from ' + r.lines + ' billed line' + (r.lines === 1 ? '' : 's') +
    (r.skippedExisting ? ' · ' + r.skippedExisting + ' part' + (r.skippedExisting === 1 ? '' : 's') + ' already on the card, left alone' : ''),
    [{ title: 'Left out — billed at alternating rates, most likely two gauges under one name. Add these by hand, with the gauge:',
       rows: r.mixed.map(function(m) { return [_partGaugeHtml(m), m.rates.map(function(x) { return formatCurrency(x); }).join(' / ')]; }) },
     { title: 'Left out — a rate billed on one invoice only. Check these against the customer’s rate card:',
       rows: r.outliers.map(function(o) {
         return [_partGaugeHtml(o), 'at ' + formatCurrency(o.rate) + ' on ' + escHtml(o.invoiceNumber) + ' (' + escHtml(o.date) + ')' +
           (o.usual != null && o.usual !== o.rate ? '; elsewhere ' + formatCurrency(o.usual) : '; no rate seen twice')];
       }) }]);
}

/* Derive a dated piece-rate card from what this client has actually been billed.
   The billed rate is the evidence the customer accepted; the Items Master is
   not (see state.js). One rule keeps an error from becoming the card: a rate
   seen on ONE invoice, where the part has been billed at another rate on two or
   more, is left out and listed — that is the shape of 00922/00923, where
   material was misattributed and two brackets swapped rates for a day. A part
   already on the card is left alone; the operator's entry wins. */
function pieceRatesFromHistory(client) {
  var groups = {}, lines = 0;
  (S.invoices || []).forEach(function(inv) {
    if (inv.clientId !== client.id || inv.status === 'cancelled') return;
    (inv.items || []).forEach(function(li) {
      if (li.unit !== 'NOS' || !(li.rate > 0) || !(li.amount > 0) || !li.partNumber) return;
      var gauge = lineGauge(li.desc) || lineGauge(li.partNumber);
      var key = rateKey(li.partNumber) + '|' + rateKey(gauge);
      if (!groups[key]) groups[key] = { partNumber: li.partNumber, gauge: gauge, hits: [] };
      groups[key].hits.push({ date: inv.date || '', rate: gstRound(li.rate), inv: inv.invoiceNumber });
      lines++;
    });
  });
  var have = {};
  (client.pieceRates || []).forEach(function(pr) { have[rateKey(pr.partNumber) + '|' + rateKey(pr.gauge)] = true; });
  var add = [], outliers = [], mixed = [], skippedExisting = 0;
  Object.keys(groups).forEach(function(key) {
    var grp = groups[key];
    if (have[key]) { skippedExisting++; return; }
    var invsByRate = {};
    grp.hits.forEach(function(h) {
      (invsByRate[h.rate] = invsByRate[h.rate] || {})[h.inv] = true;
    });
    var rates = Object.keys(invsByRate);
    var established = rates.filter(function(r) { return Object.keys(invsByRate[r]).length >= 2; });
    var keep = function(rate) { return rates.length === 1 || established.indexOf(String(rate)) >= 0; };
    if (established.length === 0 && rates.length > 1) {
      // Every rate seen once: nothing is established, and guessing is how a
      // swap becomes the card. Report all of them.
      grp.hits.forEach(function(h) { outliers.push({ partNumber: grp.partNumber, gauge: grp.gauge, rate: h.rate, invoiceNumber: h.inv, date: h.date, usual: null }); });
      return;
    }
    grp.hits.sort(function(a, b) { return a.date.localeCompare(b.date); });
    // A rate that RETURNS after changing is not a rate history, it is two
    // products billed under one name — the gauge-less "CLAMP 165X83 (NT)" lines
    // swing 4.27 / 4.89 / 4.27 on consecutive days because they are 35X6 and
    // 40X6. A dated card built from that would be wrong on every other line.
    var seq = [];
    grp.hits.forEach(function(h) { if (keep(h.rate) && seq[seq.length - 1] !== h.rate) seq.push(h.rate); });
    if (seq.length !== new Set(seq).size) {
      mixed.push({ partNumber: grp.partNumber, gauge: grp.gauge, rates: Array.from(new Set(seq)) });
      return;
    }
    var usual = null, bestN = 0;
    established.forEach(function(r) { var n = Object.keys(invsByRate[r]).length; if (n > bestN) { bestN = n; usual = parseFloat(r); } });
    var last = null;
    grp.hits.forEach(function(h) {
      if (!keep(h.rate)) {
        outliers.push({ partNumber: grp.partNumber, gauge: grp.gauge, rate: h.rate, invoiceNumber: h.inv, date: h.date, usual: usual });
        return;
      }
      if (last === null || h.rate !== last) {
        add.push({ partNumber: grp.partNumber, gauge: grp.gauge, rate: h.rate, effectiveFrom: h.date, source: 'history' });
        last = h.rate;
      }
    });
  });
  return { add: add, outliers: outliers, mixed: mixed, lines: lines, skippedExisting: skippedExisting };
}

function fillPieceRatesFromHistory(clientId) {
  var c = S.clients.find(function(x) { return x.id === clientId; });
  if (!c) return;
  var r = pieceRatesFromHistory(c);
  if (!c.pieceRates) c.pieceRates = [];
  var now = Date.now();
  r.add.forEach(function(pr) { pr.addedAt = now; c.pieceRates.push(pr); });
  if (r.add.length) saveState();
  _pieceFillReport = { clientId: c.id, added: r.add.length, lines: r.lines,
    skippedExisting: r.skippedExisting, outliers: r.outliers, mixed: r.mixed };
  showToast(r.add.length ? r.add.length + ' piece rates added from billing history' : 'No new piece rates to add',
    (r.outliers.length || r.mixed.length) ? 'warning' : undefined);
  _reopenClientAfterRateChange(clientId);
}

function addPieceRate(clientId) {
  var c = S.clients.find(function(x) { return x.id === clientId; });
  if (!c) return;
  var part = (document.getElementById('ceditPiecePart').value || '').trim();
  var gauge = (document.getElementById('ceditPieceGauge').value || '').trim().toUpperCase();
  var rate = parseFloat(document.getElementById('ceditPieceRate').value);
  var date = document.getElementById('ceditPieceDate').value;
  if (!part) { showToast('Enter the part number', 'error'); return; }
  if (isNaN(rate) || rate <= 0) { showToast('Enter a rate per piece', 'error'); return; }
  if (!date) { showToast('Enter the date the rate applies from', 'error'); return; }
  if (!c.pieceRates) c.pieceRates = [];
  var dup = c.pieceRates.some(function(pr) {
    return rateKey(pr.partNumber) === rateKey(part) && rateKey(pr.gauge) === rateKey(gauge) && pr.effectiveFrom === date;
  });
  if (dup) { showToast('That part already has a rate from ' + date, 'error'); return; }
  c.pieceRates.push({ partNumber: part, gauge: gauge, rate: gstRound(rate), effectiveFrom: date, source: 'manual', addedAt: Date.now() });
  saveState();
  showToast('Piece rate added');
  _reopenClientAfterRateChange(clientId);
}

function removePieceRate(clientId, idx) {
  var c = S.clients.find(function(x) { return x.id === clientId; });
  if (!c || !c.pieceRates || !c.pieceRates[idx]) return;
  c.pieceRates.splice(idx, 1);
  saveState();
  showToast('Piece rate removed');
  _reopenClientAfterRateChange(clientId);
}

function _reopenClientAfterRateChange(clientId) {
  closeOverlay();
  if (_isDesktop && _clientsActiveId === clientId) _renderClientDetail(clientId, false);
  openClientEdit(clientId);
}


/* ===== PIECE WEIGHT CARD =====
   kg per piece, per client, keyed on part + gauge — read by getPieceWeight()
   in state.js. Filled from billing history by the MEDIAN of the kg ÷ pieces
   each KG line recorded: a median is what a scale's own spread cannot move,
   and one slipped line (00830's ×10) cannot drag it. */
var _weightFillReport = null;

function _pieceWeightsEditHtml(c) {
  var rows = _sortedCard(c.pieceWeights).map(function(pw) {
    return _cardRowHtml(_partGaugeHtml(pw), escHtml(pw.kgPerPiece) + ' kg/pc', pw.effectiveFrom,
      ' data-action="invRemovePieceWeight" data-client="' + c.id + '" data-idx="' + pw._i + '" aria-label="Remove piece weight"');
  }).join('') || '<div class="inv-empty">No piece weights on record. For a client billed by the kilo whose challans also count pieces, fill them from what has been billed.</div>';
  var body = (_weightFillReport && _weightFillReport.clientId === c.id ? _weightFillReportHtml(_weightFillReport) : '') +
    '<div class="inv-panel-body"><div class="inv-fields">' +
    _cfield('ceditWtPart', 'Part', '<input class="inv-input inv-id" id="ceditWtPart" placeholder="2525 2015 8202">') +
    _cfield('ceditWtGauge', 'Gauge', '<input class="inv-input inv-id" id="ceditWtGauge" placeholder="(if any)">') +
    _cfield('ceditWtKg', 'kg per piece', '<input class="inv-input inv-input-num" id="ceditWtKg" type="number" step="0.0001" min="0">') +
    _cfield('ceditWtDate', 'Effective from', '<input class="inv-input inv-id" id="ceditWtDate" type="date" value="' + localDateStr() + '">') +
    '</div><div class="inv-toolbar inv-toolbar-tight">' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFillPieceWeights" data-client="' + c.id + '">Fill from billing history</button>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAddPieceWeight" data-client="' + c.id + '">Add piece weight</button></div></div>';
  return _clientCardHtml('Piece weights', (c.pieceWeights || []).length, rows, body, 'ceditPieceWeights');
}

function _weightFillReportHtml(r) {
  return _fillReportHtml(
    r.added + ' weight' + (r.added === 1 ? '' : 's') + ' added from ' + r.lines + ' weighed line' + (r.lines === 1 ? '' : 's') +
    (r.skippedExisting ? ' · ' + r.skippedExisting + ' part' + (r.skippedExisting === 1 ? '' : 's') + ' already on the card, left alone' : '') +
    (r.single ? ' · ' + r.single + ' part' + (r.single === 1 ? '' : 's') + ' seen on one invoice only, not enough to set a weight' : ''),
    [{ title: 'Left out — weights spread too far for one part, most likely two sizes under one name. Add these by hand, with the size in the name or gauge:',
       rows: r.mixed.map(function(m) { return [_partGaugeHtml(m), m.lines + ' lines, ' + m.far + ' more than 10% from the middle (' + m.median + ' kg/pc)']; }) }]);
}

function _median(a) {
  var v = a.slice().sort(function(x, y) { return x - y; });
  var h = Math.floor(v.length / 2);
  return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
}

/* A weight is set only where the part was weighed on two or more invoices —
   one weighing is a reading, not a norm. A part where more than a quarter of
   its lines (and at least two) sit 10%+ from the middle is two products under
   one name (HighCo's FLANGE NUT at exactly 0.032 or 0.064 kg; Khurana's WASHER
   at 0.021 or 0.042): listed, never averaged into a figure right for neither.
   A power-of-ten line is a slip, not a second size, and does not count as far. */
function pieceWeightsFromHistory(client) {
  var groups = {}, lines = 0;
  (S.invoices || []).forEach(function(inv) {
    if (inv.clientId !== client.id || inv.status === 'cancelled') return;
    (inv.items || []).forEach(function(li) {
      if (li.unit !== 'KG' || !(li.nosQty > 0) || !(li.qty > 0) || !li.partNumber) return;
      var gauge = lineGauge(li.desc) || lineGauge(li.partNumber);
      var key = rateKey(li.partNumber) + '|' + rateKey(gauge);
      if (!groups[key]) groups[key] = { partNumber: li.partNumber, gauge: gauge, hits: [], invs: {}, first: inv.date || '' };
      var gr = groups[key];
      gr.hits.push(li.qty / li.nosQty);
      gr.invs[inv.invoiceNumber] = true;
      if (inv.date && inv.date < gr.first) gr.first = inv.date;
      lines++;
    });
  });
  var have = {};
  (client.pieceWeights || []).forEach(function(pw) { have[rateKey(pw.partNumber) + '|' + rateKey(pw.gauge)] = true; });
  var add = [], mixed = [], single = 0, skippedExisting = 0;
  Object.keys(groups).forEach(function(key) {
    var gr = groups[key];
    if (have[key]) { skippedExisting++; return; }
    if (Object.keys(gr.invs).length < 2) { single++; return; }
    var m = _median(gr.hits);
    var far = gr.hits.filter(function(x) {
      var r = x / m, k = Math.round(Math.log10(r));
      if (k !== 0 && Math.abs(r / Math.pow(10, k) - 1) < 0.05) return false;
      return Math.abs(r - 1) >= 0.10;
    }).length;
    var kg = Math.round(m * 10000) / 10000;
    if (far >= 2 && far / gr.hits.length > 0.25) {
      mixed.push({ partNumber: gr.partNumber, gauge: gr.gauge, lines: gr.hits.length, far: far, median: kg });
      return;
    }
    add.push({ partNumber: gr.partNumber, gauge: gr.gauge, kgPerPiece: kg, effectiveFrom: gr.first, source: 'history' });
  });
  return { add: add, mixed: mixed, single: single, lines: lines, skippedExisting: skippedExisting };
}

function fillPieceWeightsFromHistory(clientId) {
  var c = S.clients.find(function(x) { return x.id === clientId; });
  if (!c) return;
  var r = pieceWeightsFromHistory(c);
  if (!c.pieceWeights) c.pieceWeights = [];
  var now = Date.now();
  r.add.forEach(function(pw) { pw.addedAt = now; c.pieceWeights.push(pw); });
  if (r.add.length) saveState();
  _weightFillReport = { clientId: c.id, added: r.add.length, lines: r.lines, single: r.single,
    skippedExisting: r.skippedExisting, mixed: r.mixed };
  showToast(r.add.length ? r.add.length + ' piece weights added from billing history' : 'No new piece weights to add',
    r.mixed.length ? 'warning' : undefined);
  _reopenClientAfterRateChange(clientId);
}

function addPieceWeight(clientId) {
  var c = S.clients.find(function(x) { return x.id === clientId; });
  if (!c) return;
  var part = (document.getElementById('ceditWtPart').value || '').trim();
  var gauge = (document.getElementById('ceditWtGauge').value || '').trim().toUpperCase();
  var kg = parseFloat(document.getElementById('ceditWtKg').value);
  var date = document.getElementById('ceditWtDate').value;
  if (!part) { showToast('Enter the part number', 'error'); return; }
  if (isNaN(kg) || kg <= 0) { showToast('Enter the weight of one piece in kg', 'error'); return; }
  if (!date) { showToast('Enter the date the weight applies from', 'error'); return; }
  if (!c.pieceWeights) c.pieceWeights = [];
  var dup = c.pieceWeights.some(function(pw) {
    return rateKey(pw.partNumber) === rateKey(part) && rateKey(pw.gauge) === rateKey(gauge) && pw.effectiveFrom === date;
  });
  if (dup) { showToast('That part already has a weight from ' + date, 'error'); return; }
  c.pieceWeights.push({ partNumber: part, gauge: gauge, kgPerPiece: Math.round(kg * 10000) / 10000, effectiveFrom: date, source: 'manual', addedAt: Date.now() });
  saveState();
  showToast('Piece weight added');
  _reopenClientAfterRateChange(clientId);
}

function removePieceWeight(clientId, idx) {
  var c = S.clients.find(function(x) { return x.id === clientId; });
  if (!c || !c.pieceWeights || !c.pieceWeights[idx]) return;
  c.pieceWeights.splice(idx, 1);
  saveState();
  showToast('Piece weight removed');
  _reopenClientAfterRateChange(clientId);
}
