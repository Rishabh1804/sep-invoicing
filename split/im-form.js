/* ===== IM ADD CHALLAN FORM (Phase 4 — Tier 1) ===== */
var _challanForm = null;

/* Where focus should land after the next render.
   The form re-renders by replacing innerHTML, so every structural change —
   adding a line, changing the unit, picking a client — dropped focus to <body>
   and ended the keyboard path. Callers that know where focus belongs set this;
   everything else is restored to wherever it was. Each control carries a
   data-k key that survives the re-render, since the elements themselves do not. */
var _challanFocusNext = null;

function _challanCaptureFocus() {
  var el = document.activeElement;
  if (!el || !el.dataset || !el.dataset.k) return null;
  var area = document.getElementById('imAddForm');
  if (!area || !area.contains(el)) return null;
  var sel = null;
  // Only text-ish inputs expose a caret; number inputs report null here.
  try { sel = el.selectionStart; } catch (e) { sel = null; }
  return { k: el.dataset.k, sel: sel };
}

function _challanRestoreFocus(target) {
  if (!target) return false;
  var area = document.getElementById('imAddForm');
  if (!area) return false;
  var el = area.querySelector('[data-k="' + target.k + '"]');
  if (!el) return false;
  try {
    el.focus();
    // setSelectionRange throws on number inputs, so the caret restore is
    // attempted separately from the focus that matters.
    if (target.sel != null && el.setSelectionRange) el.setSelectionRange(target.sel, target.sel);
    else if (el.select) el.select();
  } catch (e) {}
  return true;
}

function showAddChallanForm() {
  _challanForm = {
    clientId: null, challanNo: '', challanDate: localDateStr(),
    vehicleNo: '', items: [{ partNumber: '', desc: '', hsn: '998873', unit: 'KG', qty: 0, rate: 0, amount: 0, nosQty: null }],
    notes: ''
  };
  renderAddChallanForm();
}

function renderAddChallanForm() {
  var area = document.getElementById('imAddForm');
  if (!area) return;
  if (!_challanForm) { area.innerHTML = ''; return; }

  var client = _challanForm.clientId ? S.clients.find(function(c) { return c.id === _challanForm.clientId; }) : null;

  // An explicit request from the caller wins over wherever focus happens to be.
  var focusTarget = _challanFocusNext || _challanCaptureFocus();
  _challanFocusNext = null;

  var html = '<div class="inv-im-form inv-im-form-active">' +
    '<div class="inv-im-form-header"><span class="inv-im-form-title">' + (_challanForm._editingId ? 'Edit Challan' : 'Add Challan') + '</span></div>' +
    '<div class="inv-kbd-hint">' +
      '<span class="inv-kbd-hint-item"><kbd class="inv-kbd">Enter</kbd> next field</span>' +
      '<span class="inv-kbd-hint-item"><kbd class="inv-kbd">&uarr;</kbd><kbd class="inv-kbd">&darr;</kbd> pick suggestion</span>' +
      '<span class="inv-kbd-hint-item"><kbd class="inv-kbd">Alt</kbd>+<kbd class="inv-kbd">N</kbd> add line</span>' +
      '<span class="inv-kbd-hint-item"><kbd class="inv-kbd">Ctrl</kbd>+<kbd class="inv-kbd">Enter</kbd> save</span>' +
    '</div>';

  // Client selector
  html += '<div class="inv-card"><div class="inv-card-header"><span class="inv-card-title">Challan Details</span></div>';
  html += '<div class="inv-form-group"><label class="inv-form-label" for="imChallanClientSearch">Client</label>';
  if (client) {
    html += '<div class="inv-flex-between inv-selected-client">' +
      '<div><div class="inv-client-name">' + escHtml(client.name) + '</div>' +
      '<div class="inv-client-meta">' + escHtml(client.gstin || 'No GSTIN') + '</div></div>' +
      '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-k="client-change" data-action="invClearChallanClient">Change</button></div>';
  } else {
    html += '<div class="inv-search-wrap inv-search-no-mb">' +
      '<svg class="inv-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' +
      '<input type="text" class="inv-search-input" id="imChallanClientSearch" data-k="client-search" placeholder="Search client" autocomplete="off"' +
      ' role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="imChallanClientResults">' +
      '<div id="imChallanClientResults" class="inv-search-results inv-hidden" role="listbox"></div></div>';
  }
  html += '</div>';

  // Challan fields
  html += '<div class="inv-form-row">' +
    '<div class="inv-form-group"><label class="inv-form-label" for="imChallanNo">Challan No</label>' +
    '<input class="inv-form-input inv-mono" id="imChallanNo" data-k="challanNo" value="' + escHtml(_challanForm.challanNo) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="imChallanDate">Challan Date</label>' +
    '<input type="date" class="inv-form-input inv-mono" id="imChallanDate" data-k="challanDate" value="' + escHtml(_challanForm.challanDate) + '"></div></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="imVehicleNo">Vehicle No</label>' +
    '<input class="inv-form-input" id="imVehicleNo" data-k="vehicleNo" value="' + escHtml(_challanForm.vehicleNo) + '" list="imVehicleList" autocomplete="off">' +
    '<datalist id="imVehicleList">' + getVehicleSuggestions(_challanForm.clientId) + '</datalist></div></div>';

  // Line items
  html += '<div class="inv-card"><div class="inv-card-header"><span class="inv-card-title">Line Items</span></div>';
  _challanForm.items.forEach(function(item, idx) {
    var isPieceNOS = client && client.billingMode === 'piece' && item.unit === 'NOS';
    var rateDisplay = (item.rate != null && !isNaN(item.rate) && item.rate !== 0) ? formatNum(item.rate) : '';
    var amtDisplay = (item.amount != null && !isNaN(item.amount) && item.amount !== 0) ? formatNum(item.amount) : '';

    html += '<div class="inv-line-item">' +
      '<div class="inv-line-header"><span class="inv-line-num" id="imLineLbl' + idx + '">Item ' + (idx + 1) + '</span>' +
      '<button class="inv-line-remove" data-k="remove-' + idx + '" data-action="invRemoveChallanLine" data-idx="' + idx + '" aria-label="Remove item ' + (idx + 1) + '">&times;</button></div>' +
      '<div class="inv-form-group"><label class="inv-form-label" for="imPart' + idx + '">Part / Description</label>' +
      '<div class="inv-autocomplete-wrap">' +
      '<input class="inv-form-input" id="imPart' + idx + '" data-k="part-' + idx + '" value="' + escHtml(item.desc || item.partNumber) + '" data-action="invEditChallanPart" data-idx="' + idx + '" placeholder="Part name or number" autocomplete="off"' +
      ' role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="imPartAC' + idx + '">' +
      '<div class="inv-autocomplete-list inv-hidden" id="imPartAC' + idx + '" role="listbox"></div></div></div>' +
      '<div class="inv-form-row">' +
      '<div class="inv-form-group"><label class="inv-form-label" for="imQty' + idx + '">Qty (Weight)</label>' +
      '<input type="number" class="inv-form-input inv-mono" id="imQty' + idx + '" data-k="qty-' + idx + '" value="' + (item.qty || '') + '" data-field="qty" data-idx="' + idx + '" data-action="invUpdateChallanLine" step="any" min="0"></div>' +
      '<div class="inv-form-group"><label class="inv-form-label" for="imUnit' + idx + '">Unit</label>' +
      '<select class="inv-form-select" id="imUnit' + idx + '" data-k="unit-' + idx + '" data-field="unit" data-idx="' + idx + '" data-action="invUpdateChallanLine">' +
      '<option value="KG"' + (item.unit === 'KG' ? ' selected' : '') + '>KG</option>' +
      '<option value="NOS"' + (item.unit === 'NOS' ? ' selected' : '') + '>NOS</option></select></div>' +
      '<div class="inv-form-group"><label class="inv-form-label" for="imNos' + idx + '">NOS Qty</label>' +
      '<input type="number" class="inv-form-input inv-mono" id="imNos' + idx + '" data-k="nos-' + idx + '" value="' + (item.nosQty || '') + '" data-field="nosQty" data-idx="' + idx + '" data-action="invUpdateChallanLine" step="1" min="0" placeholder="Pcs"></div></div>' +
      '<div class="inv-form-row">' +
      '<div class="inv-form-group"><label class="inv-form-label" for="imRate' + idx + '">Rate</label>' +
      '<input type="number" class="inv-form-input inv-mono" id="imRate' + idx + '" data-k="rate-' + idx + '" value="' + rateDisplay + '" data-field="rate" data-idx="' + idx + '" data-action="invUpdateChallanLine" step="any" min="0"' +
      (isPieceNOS ? ' readonly' : '') + '></div>' +
      '<div class="inv-form-group"><label class="inv-form-label" for="imAmt' + idx + '">Amount</label>' +
      '<input type="number" class="inv-form-input inv-mono" id="imAmt' + idx + '" data-k="amount-' + idx + '" value="' + amtDisplay + '" data-field="amount" data-idx="' + idx + '" data-action="invUpdateChallanLine" step="any" min="0"' +
      (isPieceNOS ? '' : ' readonly') + '></div></div></div>';
  });
  // data-kbd-ring puts these two in the Enter-to-next-field chain, so the last
  // field of the last line steps onto "Add Line Item" instead of dead-ending.
  // The per-line remove buttons are deliberately left out of that chain.
  html += '<button class="inv-btn inv-btn-ghost inv-btn-block" data-k="addline" data-kbd-ring data-action="invAddChallanLine">+ Add Line Item</button></div>';

  // Save/Cancel
  html += '<div class="inv-btn-bar inv-save-bar">' +
    '<button class="inv-btn inv-btn-ghost" data-k="cancel" data-action="invCancelChallan">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-k="save" data-kbd-ring data-action="invSaveChallan">' + (_challanForm._editingId ? 'Update Challan' : 'Save Challan') + '</button></div></div>';

  area.innerHTML = html;

  // Hide list, toolbar, FAB while form is open
  var listEl = document.getElementById('imList');
  var toolbarEl = document.getElementById('imToolbar');
  var fabEl = document.getElementById('imFabBar');
  var selBarEl = document.getElementById('imSelBar');
  if (listEl) listEl.classList.add('inv-hidden');
  if (toolbarEl) toolbarEl.classList.add('inv-hidden');
  if (fabEl) fabEl.classList.add('inv-hidden');
  if (selBarEl) selBarEl.classList.add('inv-hidden');

  // Bind client search
  var cs = document.getElementById('imChallanClientSearch');
  if (cs) {
    cs.addEventListener('input', function() { renderChallanClientResults(cs.value); });
  }

  // Focus last, so nothing above can steal it back. Auto-focusing the client
  // search is only right on a fresh open — restoring beats it every other time.
  if (!_challanRestoreFocus(focusTarget) && cs) {
    setTimeout(function() { cs.focus(); }, 100);
  }
}

function renderChallanClientResults(query) {
  var res = document.getElementById('imChallanClientResults');
  var input = document.getElementById('imChallanClientSearch');
  if (!res) return;
  var q = (query || '').trim().toLowerCase();
  var matches = q.length < 1 ? [] : S.clients.filter(function(c) {
    return c.isActive && (c.name.toLowerCase().includes(q) || (c.gstin || '').includes(q));
  }).slice(0, 8);

  acReset();
  if (matches.length === 0) {
    res.className = 'inv-search-results inv-hidden';
    res.innerHTML = '';
    if (input) input.setAttribute('aria-expanded', 'false');
    return;
  }
  res.className = 'inv-search-results';
  res.innerHTML = matches.map(function(c, i) {
    return '<div class="inv-search-item" role="option" id="imClientOpt' + i + '" data-action="invSelectChallanClient" data-id="' + c.id + '">' +
      '<div><div class="inv-client-name">' + escHtml(c.name) + '</div>' +
      '<div class="inv-client-meta">' + escHtml(c.gstin || '') + '</div></div></div>';
  }).join('');
  if (input) input.setAttribute('aria-expanded', 'true');
}

function captureChallanFields() {
  if (!_challanForm) return;
  var cn = document.getElementById('imChallanNo');
  var cd = document.getElementById('imChallanDate');
  var vn = document.getElementById('imVehicleNo');
  if (cn) _challanForm.challanNo = cn.value.trim();
  if (cd) _challanForm.challanDate = cd.value;
  if (vn) _challanForm.vehicleNo = vn.value.trim();
}

function selectChallanClient(clientId) {
  if (!_challanForm) return;
  captureChallanFields();
  _challanForm.clientId = clientId;
  // Picking the client is the first step; Challan No is the next thing typed.
  _challanFocusNext = { k: 'challanNo', sel: null };
  var client = S.clients.find(function(c) { return c.id === clientId; });
  // Auto-fill rate on existing items
  if (client) {
    _challanForm.items.forEach(function(item) {
      var rateInfo = getLineItemRate(client, _challanForm.challanDate || localDateStr(), item.partNumber);
      if (rateInfo._override) {
        item.rate = rateInfo.rate;
      } else {
        item.rate = rateInfo.ratePerKg || 0;
      }
      recalcChallanLine(item, client);
    });
  }
  renderAddChallanForm();
}

function recalcChallanLine(item, client) {
  if (!client) { item.amount = gstRound((item.qty || 0) * (item.rate || 0)); return; }
  if (client.billingMode === 'piece' && item.unit === 'NOS') {
    // Amount entered directly for NOS piece mode
    if (item.qty > 0 && item.amount > 0) {
      item.rate = gstRound(item.amount / item.qty);
    }
  } else {
    item.amount = gstRound((item.qty || 0) * (item.rate || 0));
  }
}

function addChallanLine() {
  if (!_challanForm) return;
  captureChallanFields();
  var client = _challanForm.clientId ? S.clients.find(function(c) { return c.id === _challanForm.clientId; }) : null;
  var item = { partNumber: '', desc: '', hsn: '998873', unit: 'KG', qty: 0, rate: 0, amount: 0, nosQty: null };
  if (client) {
    var rateInfo = getLineItemRate(client, _challanForm.challanDate || localDateStr(), '');
    item.rate = rateInfo.ratePerKg || 0;
  }
  _challanForm.items.push(item);
  _challanFocusNext = { k: 'part-' + (_challanForm.items.length - 1), sel: null };
  renderAddChallanForm();
}

function removeChallanLine(idx) {
  if (!_challanForm) return;
  captureChallanFields();
  _challanForm.items.splice(idx, 1);
  // Land on the line that slid into this slot, or the one above it if the
  // removed line was last. With no lines left there is nothing to focus but
  // the button that makes one.
  if (_challanForm.items.length === 0) {
    _challanFocusNext = { k: 'addline', sel: null };
  } else {
    _challanFocusNext = { k: 'part-' + Math.min(idx, _challanForm.items.length - 1), sel: null };
  }
  renderAddChallanForm();
}

function saveChallan() {
  if (!_challanForm) return;
  captureChallanFields();
  if (!_challanForm.clientId) { showToast('Select a client', 'error'); return; }
  if (_challanForm.items.length === 0) { showToast('Add at least one line item', 'error'); return; }

  var client = S.clients.find(function(c) { return c.id === _challanForm.clientId; });
  if (!client) return;

  // Duplicate guard: warn once, then let the operator decide. Covers both entry
  // paths — the scanner fills this same form and comes through here.
  if (!_challanForm._dupeAcked) {
    var dupes = findChallanDuplicates(_challanForm, _challanForm._editingId || null);
    if (dupes.any) { showChallanDuplicateWarning(dupes); return; }
  }

  var now = Date.now();
  // Stamped so a later audit can tell an accepted duplicate from an unseen one.
  var dupeAck = _challanForm._dupeAcked
    ? { at: now, matchedIds: _challanForm._dupeMatchedIds || [] }
    : null;

  if (_challanForm._editingId) {
    // Phase 5: Edit mode — update existing entry
    var existing = (S.incomingMaterial || []).find(function(m) { return m.id === _challanForm._editingId; });
    if (!existing) { showToast('Challan not found', 'error'); return; }
    existing.challanNo = _challanForm.challanNo;
    existing.challanDate = _challanForm.challanDate;
    existing.clientId = client.id;
    existing.clientName = client.name;
    existing.vehicleNo = _challanForm.vehicleNo;
    existing.receivedDate = _challanForm.challanDate || localDateStr();
    existing.notes = _challanForm.notes || '';
    if (dupeAck) existing.dupeAck = dupeAck;
    existing.items = _challanForm.items.map(function(item, idx) {
      return {
        id: existing.id + '-' + idx,
        partNumber: item.partNumber,
        desc: item.desc || item.partNumber,
        hsn: item.hsn || '998873',
        unit: item.unit || 'KG',
        qty: item.qty || 0,
        rate: item.rate || 0,
        amount: item.amount || 0,
        nosQty: item.nosQty || null,
        invoiced: false,
        invoiceId: null
      };
    });
    saveVehicleToClient(_challanForm.clientId, _challanForm.vehicleNo);
    saveState();
    _challanForm = null;
    cancelAddChallanUI();
    _imToolbarRendered = false;
    renderIMToolbar();
    _imToolbarRendered = true;
    _renderIMView();
    showToast('Challan updated (' + existing.items.length + ' item' + (existing.items.length > 1 ? 's' : '') + ')');
    return;
  }

  // New challan
  var imId = 'IM-' + now;
  var entry = {
    id: imId,
    challanNo: _challanForm.challanNo,
    challanDate: _challanForm.challanDate,
    clientId: client.id,
    clientName: client.name,
    vehicleNo: _challanForm.vehicleNo,
    items: _challanForm.items.map(function(item, idx) {
      return {
        id: imId + '-' + idx,
        partNumber: item.partNumber,
        desc: item.desc || item.partNumber,
        hsn: item.hsn || '998873',
        unit: item.unit || 'KG',
        qty: item.qty || 0,
        rate: item.rate || 0,
        amount: item.amount || 0,
        nosQty: item.nosQty || null,
        invoiced: false,
        invoiceId: null
      };
    }),
    receivedDate: _challanForm.challanDate || localDateStr(),
    notes: '',
    createdAt: now,
    dupeAck: dupeAck
  };

  S.incomingMaterial.push(entry);
  saveVehicleToClient(_challanForm.clientId, _challanForm.vehicleNo);
  saveState();

  _challanForm = null;
  cancelAddChallanUI();
  _imToolbarRendered = false;
  renderIMToolbar();
  _imToolbarRendered = true;
  _renderIMView();
  showToast('Challan saved (' + entry.items.length + ' item' + (entry.items.length > 1 ? 's' : '') + ')');
}

function cancelAddChallan() {
  _challanForm = null;
  cancelAddChallanUI();
  // Phase 8A: Drain deferred mode switch
  if (_pendingModeSwitch) {
    _pendingModeSwitch = false;
    updateLayoutMode();
  }
}

function cancelAddChallanUI() {
  var area = document.getElementById('imAddForm');
  if (area) area.innerHTML = '';
  var listEl = document.getElementById('imList');
  var toolbarEl = document.getElementById('imToolbar');
  var fabEl = document.getElementById('imFabBar');
  var selBarEl = document.getElementById('imSelBar');
  if (listEl) listEl.classList.remove('inv-hidden');
  if (toolbarEl) toolbarEl.classList.remove('inv-hidden');
  if (fabEl) fabEl.classList.remove('inv-hidden');
  if (selBarEl) selBarEl.classList.remove('inv-hidden');
}

/* ===== IM DELETE CHALLAN (Phase 4 — Tier 2) ===== */
function deleteChallan(imId) {
  var im = (S.incomingMaterial || []).find(function(m) { return m.id === imId; });
  if (!im) return;
  // Check if any items are invoiced
  var invoicedCount = im.items.filter(function(it) { return it.invoiced; }).length;
  if (invoicedCount > 0) {
    showToast('Cannot delete: ' + invoicedCount + ' item' + (invoicedCount > 1 ? 's' : '') + ' already invoiced', 'warning');
    return;
  }
  // Tier 1 confirm
  if (!confirm('Delete this challan?')) return;
  var idx = S.incomingMaterial.indexOf(im);
  if (idx > -1) S.incomingMaterial.splice(idx, 1);
  // Clean up expanded/selected state
  delete _imExpanded[imId];
  if (_imActiveChallanId === imId) _imActiveChallanId = null;
  im.items.forEach(function(it) { delete _imSelected[it.id]; });
  saveState();
  _imToolbarRendered = false;
  renderIMToolbar();
  _imToolbarRendered = true;
  _renderIMView();
  showToast('Challan deleted');
}

/* ===== IM EDIT CHALLAN (Phase 5 — Tier 2) ===== */
function editChallan(imId) {
  var im = (S.incomingMaterial || []).find(function(m) { return m.id === imId; });
  if (!im) return;
  // Guard: if any items invoiced, show toast
  var invoicedCount = im.items.filter(function(it) { return it.invoiced; }).length;
  if (invoicedCount > 0) {
    showToast('Cannot edit: ' + invoicedCount + ' item' + (invoicedCount > 1 ? 's' : '') + ' already invoiced', 'warning');
    return;
  }
  // Pre-fill challan form with existing data
  _challanForm = {
    clientId: im.clientId,
    challanNo: im.challanNo || '',
    challanDate: im.challanDate || localDateStr(),
    vehicleNo: im.vehicleNo || '',
    items: im.items.map(function(it) {
      return {
        partNumber: it.partNumber || '',
        desc: it.desc || it.partNumber || '',
        hsn: it.hsn || '998873',
        unit: it.unit || 'KG',
        qty: it.qty || 0,
        rate: it.rate || 0,
        amount: it.amount || 0,
        nosQty: it.nosQty || null
      };
    }),
    notes: im.notes || '',
    _editingId: imId
  };
  if (_challanForm.items.length === 0) {
    _challanForm.items.push({partNumber:'', desc:'', hsn:'998873', unit:'KG', qty:0, rate:0, amount:0, nosQty:null});
  }
  renderAddChallanForm();
  showToast('Editing challan' + (im.challanNo ? ' ' + im.challanNo : ''), 'warning');
}

