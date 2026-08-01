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
  const dup = S.clients.find(x => x.id !== excludeId && x.name.trim().toLowerCase() === name.toLowerCase());
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
  const searchEl = document.getElementById('clientSearch');
  if (searchEl) searchEl.value = '';
  renderClientList('');
  if (_isDesktop) _renderClientDetail(c.id, true);
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

