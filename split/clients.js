/* ===== CLIENT MASTER ===== */
var _clientsActiveId = null;

function renderClientList(filter='') {
  const q = filter.toLowerCase();
  const sorted = [...S.clients].sort((a,b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const filtered = q ? sorted.filter(c => c.name.toLowerCase().includes(q) || (c.gstin||'').toLowerCase().includes(q)) : sorted;
  const el = document.getElementById('clientList');
  const countEl = document.getElementById('clientsCount');
  if (countEl) countEl.textContent = filtered.length + (filtered.length === 1 ? ' client' : ' clients');
  if (filtered.length === 0) { el.innerHTML = '<div class="inv-empty-state">No clients found</div>'; return; }
  el.innerHTML = filtered.map(c => {
    const sortedRates = (c.rates || []).slice().sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    const rateInfo = sortedRates.length > 0 ? sortedRates[0] : null;
    const rateStr = rateInfo ? '\u20B9' + rateInfo.ratePerKg + '/kg' : 'No rate';
    var cardAction = _isDesktop ? 'invSelectClientRow' : 'invEditClient';
    var activeClass = (_isDesktop && _clientsActiveId === c.id) ? ' inv-client-item-active' : '';
    return '<div class="inv-client-item' + (c.isActive ? '' : ' inv-client-inactive') + activeClass + '" data-action="' + cardAction + '" data-id="' + c.id + '">' +
      '<div class="inv-client-content"><div class="inv-client-name">' + escHtml(c.name) + '</div>' +
      '<div class="inv-client-meta">' + escHtml(c.gstin || 'No GSTIN') + '</div>' +
      '<div class="inv-client-badges">' +
      '<span class="inv-client-badge inv-badge-mode">' + escHtml(c.billingMode) + '</span>' +
      '<span class="inv-client-badge inv-badge-rate">' + escHtml(rateStr) + '</span>' +
      (c.itemRates && c.itemRates.length ? '<span class="inv-override-badge">' + c.itemRates.length + ' override' + (c.itemRates.length>1?'s':'') + '</span>' : '') +
      (!c.isActive ? '<span class="inv-client-badge inv-badge-inactive">Inactive</span>' : '') +
      '</div></div>' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>';
  }).join('');

  // Desktop detail validation: active client filtered out → clear detail
  if (_isDesktop && _clientsActiveId) {
    var stillVisible = filtered.find(function(c) { return c.id === _clientsActiveId; });
    if (!stillVisible) {
      _clientsActiveId = null;
      var detail = document.getElementById('clientsDetail');
      if (detail) detail.innerHTML = _renderDetailEmpty();
    }
  }
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

function _showClientOverlay(client, isAdd) {
  const c = client || _blankClient();
  const scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">' + (isAdd ? 'Add Client' : 'Edit Client') + '</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div>' +
    (isAdd ? '' : finClientMoneyHtml(c.id)) +
    '<div class="inv-form-group"><label class="inv-form-label">Name</label><input class="inv-form-input" id="ceditName" value="' + escHtml(c.name) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">GSTIN</label><input class="inv-form-input inv-mono" id="ceditGstin" value="' + escHtml(c.gstin) + '" maxlength="15"></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">State</label><input class="inv-form-input" id="ceditState" value="' + escHtml(c.state) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">State Code</label><input class="inv-form-input inv-mono" id="ceditStateCode" value="' + escHtml(c.stateCode) + '" maxlength="2"></div></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Address 1</label><input class="inv-form-input" id="ceditAdd1" value="' + escHtml(c.add1) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Address 2</label><input class="inv-form-input" id="ceditAdd2" value="' + escHtml(c.add2) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Address 3</label><input class="inv-form-input" id="ceditAdd3" value="' + escHtml(c.add3) + '"></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">Mobile</label><input class="inv-form-input inv-mono" id="ceditMobile" type="tel" value="' + escHtml(c.mobile || '') + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Phone</label><input class="inv-form-input inv-mono" id="ceditPhone" type="tel" value="' + escHtml(c.phone || '') + '"></div></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Email</label><input class="inv-form-input" id="ceditEmail" type="email" value="' + escHtml(c.email || '') + '"></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">Billing Mode</label><select class="inv-form-select" id="ceditMode">' +
    '<option value="weight"' + (c.billingMode==='weight'?' selected':'') + '>Weight (KG)</option>' +
    '<option value="piece"' + (c.billingMode==='piece'?' selected':'') + '>Piece (Challan)</option>' +
    '<option value="nos_to_weight"' + (c.billingMode==='nos_to_weight'?' selected':'') + '>NOS to Weight</option></select></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">GST Type</label><select class="inv-form-select" id="ceditGstType">' +
    '<option value="intra"' + (c.gstType==='intra'?' selected':'') + '>Intra (CGST+SGST)</option>' +
    '<option value="inter"' + (c.gstType==='inter'?' selected':'') + '>Inter (IGST)</option></select></div></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Notes</label><textarea class="inv-form-input" id="ceditNotes" rows="2">' + escHtml(c.notes) + '</textarea></div>' +
    '<div class="inv-settings-title">' + (isAdd ? 'Opening Rate' : 'Rate History') + '</div>' +
    (isAdd ? '' : '<div id="ceditRates">' + (c.rates||[]).map((r,i) => '<div class="inv-rate-row"><span class="inv-mono">\u20B9' + escHtml(r.ratePerKg) + '/kg</span><span class="inv-text-muted inv-mono">' + escHtml(r.effectiveFrom) + '</span></div>').join('') + '</div>') +
    '<div class="inv-form-row inv-mb-8"><div class="inv-form-group"><label class="inv-form-label">' + (isAdd ? 'Rate/KG' : 'New Rate/KG') + '</label><input class="inv-form-input inv-mono" id="ceditNewRate" type="number" step="0.01" placeholder="14.25"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Effective From</label><input class="inv-form-input inv-mono" id="ceditNewRateDate" type="date" value="' + localDateStr() + '"></div></div>' +
    (isAdd ? '' : '<button class="inv-btn inv-btn-ghost inv-btn-sm inv-mb-16" data-action="invAddRate" data-client="' + c.id + '">Add Rate</button>') +
    (isAdd ? '' : _pieceRatesEditHtml(c)) +
    (isAdd ? '' : _pieceWeightsEditHtml(c)) +
    '<div class="inv-flex-between inv-mb-16"><label class="inv-checkbox-label">' +
    '<input type="checkbox" id="ceditActive"' + (c.isActive?' checked':'') + '> Active</label></div>' +
    '<div class="inv-btn-bar"><button class="inv-btn inv-btn-ghost" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invSaveClient" data-client="' + c.id + '" data-mode="' + (isAdd ? 'add' : 'edit') + '">' + (isAdd ? 'Add Client' : 'Save') + '</button></div></div>';
  scrim.addEventListener('click', e => { if (e.target === scrim) { scrim.remove(); document.body.style.overflow = ''; popFocus(); } });
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
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

/* ===== CLIENT DETAIL PANEL (Phase 8E) ===== */
function _renderClientDetail(clientId, skipMasterRefresh) {
  var c = S.clients.find(function(x) { return x.id === clientId; });
  if (!c) {
    _clientsActiveId = null;
    var detail = document.getElementById('clientsDetail');
    if (detail) detail.innerHTML = _renderDetailEmpty();
    if (!skipMasterRefresh) {
      var searchEl = document.getElementById('clientSearch');
      renderClientList(searchEl ? searchEl.value : '');
    }
    return;
  }

  _clientsActiveId = clientId;

  var html = '';

  // Header
  html += '<div class="inv-detail-section">' +
    '<div class="inv-detail-client-header">' +
    '<span class="inv-detail-client-name">' + escHtml(c.name) + '</span>' +
    '<span class="inv-client-badge ' + (c.isActive ? 'inv-badge-active' : 'inv-badge-inactive') + '">' +
    (c.isActive ? 'Active' : 'Inactive') + '</span></div></div>';

  // Info section
  html += '<div class="inv-detail-section">';
  if (c.gstin) {
    html += '<div class="inv-detail-label">GSTIN</div>' +
      '<div class="inv-detail-value-mono">' + escHtml(c.gstin) + '</div>';
  }
  if (c.state || c.stateCode) {
    html += '<div class="inv-detail-label">State</div>' +
      '<div class="inv-detail-value">' + escHtml(c.state || '') +
      (c.stateCode ? ' <span class="inv-detail-value-mono">(' + escHtml(c.stateCode) + ')</span>' : '') + '</div>';
  }
  var address = [c.add1, c.add2, c.add3].filter(function(a) { return a; });
  if (address.length > 0) {
    html += '<div class="inv-detail-label">Address</div>' +
      '<div class="inv-detail-value">' + address.map(function(a) { return escHtml(a); }).join('<br>') + '</div>';
  }
  html += '<div class="inv-detail-label">Billing Mode</div>' +
    '<div class="inv-detail-value">' + escHtml(c.billingMode) + '</div>';
  html += '<div class="inv-detail-label">GST Type</div>' +
    '<div class="inv-detail-value">' + escHtml(c.gstType === 'inter' ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)') + '</div>';
  if (c.notes) {
    html += '<div class="inv-detail-label">Notes</div>' +
      '<div class="inv-detail-value">' + escHtml(c.notes) + '</div>';
  }
  html += '</div>';

  html += finClientMoneyHtml(c.id);

  // Rate History
  var sortedRates = (c.rates || []).slice().sort(function(a, b) {
    return b.effectiveFrom.localeCompare(a.effectiveFrom);
  });
  if (sortedRates.length > 0) {
    var today = localDateStr();
    var currentRate = sortedRates.find(function(r) { return r.effectiveFrom <= today; });
    html += '<div class="inv-detail-section">' +
      '<div class="inv-detail-label">Rate History</div>';
    sortedRates.forEach(function(r) {
      var isCurrent = currentRate && r.effectiveFrom === currentRate.effectiveFrom;
      html += '<div class="inv-detail-rate-row' + (isCurrent ? ' inv-detail-rate-current' : '') + '">' +
        '<span class="inv-detail-value-mono">' + formatCurrency(r.ratePerKg) + '/kg</span>' +
        '<span class="inv-detail-value-mono inv-text-muted">' + escHtml(r.effectiveFrom) + '</span>' +
        (isCurrent ? '<span class="inv-client-badge inv-badge-active">Current</span>' : '') +
        '</div>';
    });
    html += '</div>';
  }

  // Item Rate Overrides
  if (c.itemRates && c.itemRates.length > 0) {
    html += '<div class="inv-detail-section">' +
      '<div class="inv-detail-label">Item Rate Overrides</div>';
    c.itemRates.forEach(function(ir) {
      html += '<div class="inv-detail-rate-row">' +
        '<span class="inv-detail-value-mono">' + escHtml(ir.partPattern) + '</span>' +
        '<span class="inv-detail-value-mono">' + formatCurrency(ir.rate) + '/' + escHtml(ir.unit || 'kg') + '</span>' +
        (ir.label ? '<span class="inv-text-muted">' + escHtml(ir.label) + '</span>' : '') +
        '</div>';
    });
    html += '</div>';
  }

  // Piece rates on record
  if (c.pieceRates && c.pieceRates.length > 0) {
    html += '<div class="inv-detail-section">' +
      '<div class="inv-detail-label">Piece Rates</div>';
    _sortedPieceRates(c).forEach(function(pr) {
      html += '<div class="inv-detail-rate-row">' +
        '<span class="inv-detail-value-mono">' + escHtml(pr.partNumber) + (pr.gauge ? ' \u00B7 ' + escHtml(pr.gauge) : '') + '</span>' +
        '<span class="inv-detail-value-mono">' + formatCurrency(pr.rate) + '/pc</span>' +
        '<span class="inv-detail-value-mono inv-text-muted">' + escHtml(pr.effectiveFrom || '') + '</span>' +
        '</div>';
    });
    html += '</div>';
  }

  // Piece weights on record
  if (c.pieceWeights && c.pieceWeights.length > 0) {
    html += '<div class="inv-detail-section">' +
      '<div class="inv-detail-label">Piece Weights</div>';
    _sortedCard(c.pieceWeights).forEach(function(pw) {
      html += '<div class="inv-detail-rate-row">' +
        '<span class="inv-detail-value-mono">' + escHtml(pw.partNumber) + (pw.gauge ? ' \u00B7 ' + escHtml(pw.gauge) : '') + '</span>' +
        '<span class="inv-detail-value-mono">' + escHtml(pw.kgPerPiece) + ' kg/pc</span>' +
        '<span class="inv-detail-value-mono inv-text-muted">' + escHtml(pw.effectiveFrom || '') + '</span>' +
        '</div>';
    });
    html += '</div>';
  }

  // Recent Invoices
  var clientInvoices = (S.invoices || []).filter(function(i) { return i.clientId === c.id; })
    .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); })
    .slice(0, 5);
  if (clientInvoices.length > 0) {
    html += '<div class="inv-detail-section">' +
      '<div class="inv-detail-label">Recent Invoices</div>';
    clientInvoices.forEach(function(inv) {
      html += '<div class="inv-detail-invoice-row" data-action="invViewInvoiceDetail" data-id="' + escHtml(inv.id) + '">' +
        '<span class="inv-detail-value-mono">' + escHtml(inv.displayNumber) + '</span>' +
        '<span class="inv-detail-value-mono inv-text-muted">' + formatDate(inv.date) + '</span>' +
        '<span class="inv-detail-value-mono inv-text-cost">' + formatCurrency(inv.grandTotal) + '</span>' +
        '</div>';
    });
    html += '</div>';
  }

  // Action buttons
  html += '<div class="inv-detail-actions">' +
    '<button class="inv-btn inv-btn-primary" data-action="invEditClient" data-id="' + c.id + '">Edit</button>' +
    '<button class="inv-btn inv-btn-ghost" data-action="invStatsJumpRegister" data-client-id="' + c.id + '">View in Register</button>' +
    '</div>';

  var detailEl = document.getElementById('clientsDetail');
  if (detailEl) detailEl.innerHTML = html;

  // Update master to show active card highlight
  if (!skipMasterRefresh) {
    var searchEl = document.getElementById('clientSearch');
    renderClientList(searchEl ? searchEl.value : '');
  }
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
  var html = '<div class="inv-settings-title">Piece Rates</div>';
  var rows = _sortedPieceRates(c);
  if (rows.length === 0) {
    html += '<div class="inv-text-muted inv-piece-empty">No piece rates on record. Fill them from what has been billed, or add one below.</div>';
  }
  html += '<div id="ceditPieceRates">';
  rows.forEach(function(pr) {
    html += '<div class="inv-rate-row inv-piece-row">' +
      '<span class="inv-mono">' + escHtml(pr.partNumber) + (pr.gauge ? ' · ' + escHtml(pr.gauge) : '') + '</span>' +
      '<span class="inv-mono">' + formatCurrency(pr.rate) + '/pc</span>' +
      '<span class="inv-text-muted inv-mono">' + escHtml(pr.effectiveFrom || '') + '</span>' +
      '<button class="inv-line-remove" data-action="invRemovePieceRate" data-client="' + c.id + '" data-idx="' + pr._i + '" aria-label="Remove piece rate">&times;</button>' +
      '</div>';
  });
  html += '</div>';
  if (_pieceFillReport && _pieceFillReport.clientId === c.id) html += _pieceFillReportHtml(_pieceFillReport);
  html += '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">Part</label><input class="inv-form-input inv-mono" id="ceditPiecePart" placeholder="CLAMP 165X83 (NT)"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Gauge</label><input class="inv-form-input inv-mono" id="ceditPieceGauge" placeholder="40X6"></div></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">Rate/piece</label><input class="inv-form-input inv-mono" id="ceditPieceRate" type="number" step="0.01" min="0"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Effective From</label><input class="inv-form-input inv-mono" id="ceditPieceDate" type="date" value="' + localDateStr() + '"></div></div>' +
    '<div class="inv-btn-bar inv-mb-16">' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFillPieceRates" data-client="' + c.id + '">Fill from billing history</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAddPieceRate" data-client="' + c.id + '">Add Piece Rate</button></div>';
  return html;
}

function _pieceFillReportHtml(r) {
  var html = '<div class="inv-piece-report">' +
    '<div>' + r.added + ' rate' + (r.added === 1 ? '' : 's') + ' added from ' + r.lines + ' billed line' + (r.lines === 1 ? '' : 's') +
    (r.skippedExisting ? ' · ' + r.skippedExisting + ' part' + (r.skippedExisting === 1 ? '' : 's') + ' already on the card, left alone' : '') + '</div>';
  if (r.mixed.length) {
    html += '<div class="inv-piece-report-warn">Left out \u2014 billed at alternating rates, most likely two gauges under one name. Add these by hand, with the gauge:</div><ul class="inv-piece-report-list">';
    r.mixed.forEach(function(m) {
      html += '<li class="inv-mono">' + escHtml(m.partNumber) + (m.gauge ? ' \u00B7 ' + escHtml(m.gauge) : '') + ': ' +
        m.rates.map(function(x) { return formatCurrency(x); }).join(' / ') + '</li>';
    });
    html += '</ul>';
  }
  if (r.outliers.length) {
    html += '<div class="inv-piece-report-warn">Left out — a rate billed on one invoice only. Check these against the customer’s rate card:</div><ul class="inv-piece-report-list">';
    r.outliers.forEach(function(o) {
      html += '<li class="inv-mono">' + escHtml(o.partNumber) + (o.gauge ? ' · ' + escHtml(o.gauge) : '') + ' at ' + formatCurrency(o.rate) +
        ' on ' + escHtml(o.invoiceNumber) + ' (' + escHtml(o.date) + ')' +
        (o.usual != null && o.usual !== o.rate ? '; elsewhere ' + formatCurrency(o.usual) : '; no rate seen twice') + '</li>';
    });
    html += '</ul>';
  }
  return html + '</div>';
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
  var html = '<div class="inv-settings-title">Piece Weights</div>';
  var rows = _sortedCard(c.pieceWeights);
  if (rows.length === 0) {
    html += '<div class="inv-text-muted inv-piece-empty">No piece weights on record. For a client billed by the kilo whose challans also count pieces, fill them from what has been billed.</div>';
  }
  html += '<div id="ceditPieceWeights">';
  rows.forEach(function(pw) {
    html += '<div class="inv-rate-row inv-piece-row">' +
      '<span class="inv-mono">' + escHtml(pw.partNumber) + (pw.gauge ? ' · ' + escHtml(pw.gauge) : '') + '</span>' +
      '<span class="inv-mono">' + escHtml(pw.kgPerPiece) + ' kg/pc</span>' +
      '<span class="inv-text-muted inv-mono">' + escHtml(pw.effectiveFrom || '') + '</span>' +
      '<button class="inv-line-remove" data-action="invRemovePieceWeight" data-client="' + c.id + '" data-idx="' + pw._i + '" aria-label="Remove piece weight">&times;</button>' +
      '</div>';
  });
  html += '</div>';
  if (_weightFillReport && _weightFillReport.clientId === c.id) html += _weightFillReportHtml(_weightFillReport);
  html += '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label" for="ceditWtPart">Part</label><input class="inv-form-input inv-mono" id="ceditWtPart" placeholder="2525 2015 8202"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="ceditWtGauge">Gauge</label><input class="inv-form-input inv-mono" id="ceditWtGauge" placeholder="(if any)"></div></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label" for="ceditWtKg">kg per piece</label><input class="inv-form-input inv-mono" id="ceditWtKg" type="number" step="0.0001" min="0"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="ceditWtDate">Effective From</label><input class="inv-form-input inv-mono" id="ceditWtDate" type="date" value="' + localDateStr() + '"></div></div>' +
    '<div class="inv-btn-bar inv-mb-16">' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFillPieceWeights" data-client="' + c.id + '">Fill from billing history</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAddPieceWeight" data-client="' + c.id + '">Add Piece Weight</button></div>';
  return html;
}

function _weightFillReportHtml(r) {
  var html = '<div class="inv-piece-report">' +
    '<div>' + r.added + ' weight' + (r.added === 1 ? '' : 's') + ' added from ' + r.lines + ' weighed line' + (r.lines === 1 ? '' : 's') +
    (r.skippedExisting ? ' · ' + r.skippedExisting + ' part' + (r.skippedExisting === 1 ? '' : 's') + ' already on the card, left alone' : '') +
    (r.single ? ' · ' + r.single + ' part' + (r.single === 1 ? '' : 's') + ' seen on one invoice only, not enough to set a weight' : '') + '</div>';
  if (r.mixed.length) {
    html += '<div class="inv-piece-report-warn">Left out — weights spread too far for one part, most likely two sizes under one name. Add these by hand, with the size in the name or gauge:</div><ul class="inv-piece-report-list">';
    r.mixed.forEach(function(m) {
      html += '<li class="inv-mono">' + escHtml(m.partNumber) + (m.gauge ? ' · ' + escHtml(m.gauge) : '') + ': ' +
        m.lines + ' lines, ' + m.far + ' more than 10% from the middle (' + m.median + ' kg/pc)</li>';
    });
    html += '</ul>';
  }
  return html + '</div>';
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
