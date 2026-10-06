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

/* Does a client answer a search? Its name or its GSTIN, case ignored on both: a GSTIN is stored in capitals, and the
   challan form's search lower-cased what was typed and compared it with them, so "20aaack" found nobody. */
function clientMatchesQuery(c, q) {
  q = String(q || '').trim().toLowerCase();
  return !q || String(c.name || '').toLowerCase().indexOf(q) >= 0 || String(c.gstin || '').toLowerCase().indexOf(q) >= 0;
}

/* Phone: a row per client that opens its edit sheet. Desktop: a table beside the pane. */
function renderClientList(filter) {
  const q = (filter || '').toLowerCase();
  const sorted = [...S.clients].sort((a,b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const filtered = q ? sorted.filter(c => clientMatchesQuery(c, q)) : sorted;
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

/* A card on the client (rates, piece rates, piece weights): its rows, then the form that adds to it. A card of more
   than CLIENT_CARD_FOLD rows folds to its head, which gives its count (open or shut remembered on the device): SSS
   Mehta's piece rates and Dorabji's piece weights, one row per part, ran the sheet far past a screen (owner, 29 Sep
   2026; UX overhaul 2, step 6). */
var CLIENT_CARD_FOLD = 5;
function _clientCardHtml(title, count, rowsHtml, bodyHtml, id) {
  if (id && count > CLIENT_CARD_FOLD) {
    return uiFoldHtml('client-' + id, '<span class="inv-panel-title">' + title + ' <span class="inv-panel-count">' + count + '</span></span>',
      '<div id="' + id + '">' + rowsHtml + '</div>' + bodyHtml, false);
  }
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

function _showClientOverlay(client, isAdd, inPlace) {
  const c = client || _blankClient();
  const opt = (v, cur, l) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + l + '</option>';
  let rates = '';
  if (!isAdd) {
    rates = _clientCardHtml('Rate history', (c.rates || []).length,
      _clientRateRowsHtml(c, true) ||
        '<div class="inv-empty">No rate on record</div>',
      '<div class="inv-panel-body">' + _clientRateFieldsHtml(false) +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAddRate" data-client="' + c.id + '">Add rate</button></div>', 'ceditRates');
  }
  dialogOpen('<div class="inv-dialog">' +
    dialogHeadHtml((isAdd ? 'Add client' : 'Edit client')) +
    (isAdd ? '' : todoClientCardHtml(c.id) + finClientMoneyHtml(c.id) + qtClientPanelHtml(c.id) + kbLinkedHtml('client', c.id, c.name, 'Knowledge')) +
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
    _clientDocDefaultsHtml(c) +
    _cfield('ceditNotes', 'Notes', '<textarea class="inv-textarea" id="ceditNotes" rows="2">' + escHtml(c.notes) + '</textarea>') +
    '<label class="inv-field inv-toolbar"><input type="checkbox" class="inv-check" id="ceditActive"' + (c.isActive ? ' checked' : '') + '> Active</label>' +
    // A new client takes an optional opening rate; an existing one keeps its dated cards.
    (isAdd ? _clientCardHtml('Opening rate', null, '', '<div class="inv-panel-body">' + _clientRateFieldsHtml(true) + '</div>')
      : rates + _pieceRatesEditHtml(c) + _pieceWeightsEditHtml(c)) +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invSaveClient" data-client="' + c.id + '" data-mode="' + (isAdd ? 'add' : 'edit') + '">' + (isAdd ? 'Add client' : 'Save') + '</button></div></div>', { dismiss: true, replace: !!inPlace });
}

/* What every new invoice for this client carries (state.js, clientPoFromChallan; create.js fills them). */
function _clientPoExampleNo(c) {
  var last = (S.incomingMaterial || []).filter(function(im) { return im.clientId === c.id && poChallanDigits(im.challanNo); })
    .sort(function(a, b) { return String(b.challanDate || '').localeCompare(String(a.challanDate || '')); })[0];
  return last ? poChallanDigits(last.challanNo) : '1244';
}
function _clientPoExampleText(c, tpl) {
  tpl = String(tpl || '').trim();
  if (!tpl) return 'Empty: the P.O. is not filled for this client.';
  if (!clientPoTemplateOk(tpl)) return 'Put {challan} where the number goes, or {challan:5} for five digits.';
  var n = _clientPoExampleNo(c);
  return 'Challan ' + n + ' gives ' + clientPoFromChallan({ poFromChallan: tpl }, n) + '.';
}
function _clientDocDefaultsHtml(c) {
  return '<div class="inv-panel inv-panel-flush" data-client-defaults><div class="inv-panel-head"><span class="inv-panel-title">On every new invoice</span></div>' +
    '<div class="inv-panel-body"><div class="inv-note">Filled in while the field is empty; anything typed on the invoice wins.</div><div class="inv-fields">' +
    '<div class="inv-field"><label class="inv-field-label" for="ceditTransport">Vehicle no.</label>' +
    _cinput('ceditTransport', c.defaultTransport || '', 'inv-id', ' placeholder="JH 05XX 0000" autocomplete="off"') + '</div>' +
    '<div class="inv-field"><label class="inv-field-label" for="ceditPoTpl">P.O. from the challan no.</label>' +
    _cinput('ceditPoTpl', c.poFromChallan || '', 'inv-id', ' placeholder="DA1/{challan:5}" autocomplete="off" data-client-id="' + c.id + '"') +
    '<div class="inv-field-hint">{challan} is the challan number; {challan:5} pads it to five digits.</div>' +
    '<div class="inv-field-hint inv-id" id="ceditPoEx">' + escHtml(_clientPoExampleText(c, c.poFromChallan)) + '</div></div>' +
    '</div></div></div>';
}
function clientPoExampleRefresh(input) {
  var ex = document.getElementById('ceditPoEx');
  if (!ex) return;
  var c = S.clients.find(function(x) { return String(x.id) === String(input.dataset.clientId); }) || { id: null };
  ex.textContent = _clientPoExampleText(c, input.value);
}

/* The ₹/kg ladder, newest first; the rate in force today says so. In the edit sheet each entry can be removed: a mistyped
   rate had no way off the ladder. */
function _clientRateRowsHtml(c, editable) {
  var now = _clientRateNow(c);
  return (c.rates || []).map(function(r, i) { return Object.assign({ _i: i }, r); })
    .sort(function(a, b) { return b.effectiveFrom.localeCompare(a.effectiveFrom); }).map(function(r) {
    var cur = now && r.effectiveFrom === now.effectiveFrom && r.ratePerKg === now.ratePerKg;
    return '<div class="inv-row"><span class="inv-row-main inv-id">from ' + escHtml(r.effectiveFrom) + '</span>' +
      '<span class="inv-row-end">' + (cur ? '<span class="inv-dot inv-dot-ok">Current</span>' : '') +
      '<span class="inv-num">' + formatCurrency(r.ratePerKg) + '/kg</span>' +
      (editable ? '<button class="inv-btn inv-btn-icon inv-btn-ghost inv-btn-sm" data-action="invRemoveRate" data-client="' + c.id + '" data-idx="' + r._i + '" aria-label="Remove rate">&times;</button>' : '') +
      '</span></div>';
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
  const poTpl = (document.getElementById('ceditPoTpl') || {}).value || '';
  if (!clientPoTemplateOk(poTpl.trim())) { showToast('The P.O. pattern needs {challan} where the number goes', 'error'); return null; }

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
    defaultTransport: ((document.getElementById('ceditTransport') || {}).value || '').trim().toUpperCase(),
    poFromChallan: poTpl.trim(),
    isActive: document.getElementById('ceditActive').checked
  };
}

/* Save takes what was typed into a card's add fields too: a rate typed and Save pressed, without Add rate, was dropped. A
   card entry half typed stops the save and says what it lacks. */
async function saveClientEdit(clientId, mode) {
  // P1 (guard.js): the client master, its rate ladder and its cards.
  if (!grdOk('rates') && !(await guardAsk('rates', mode === 'add' ? 'add a client' : 'save a client'))) return;
  if (mode === 'add') { addClient(); return; }
  var c = S.clients.find(x => x.id === clientId);
  if (!c) return;
  const form = _readClientForm(clientId);
  if (!form) return;
  var rate = _readLadderRate(c, true), pr = _readCardEntry('rate', c, true), pw = _readCardEntry('weight', c, true);
  var bad = [rate, pr, pw].find(function(x) { return x && x.error; });
  if (bad) { showToast(bad.error, 'error'); return; }
  if (rate && !(await _ladderSameDateOk(c, rate.entry))) return;
  // The book may have been reloaded while a question was open: the client saved is the one held now.
  c = S.clients.find(x => x.id === clientId);
  if (!c) return;
  Object.keys(form).forEach(k => { c[k] = form[k]; });
  if (rate) _ladderPut(c, rate.entry);
  if (pr) (c.pieceRates || (c.pieceRates = [])).push(pr.entry);
  if (pw) (c.pieceWeights || (c.pieceWeights = [])).push(pw.entry);
  saveState();
  closeOverlay();
  _clientPaneRefresh(clientId);
  showToast('Client saved');
}

/* The desktop pane shows the client just changed, and its row in the list the new rate: the pane was redrawn only when it
   was already open on that client, and a card change made from the edit sheet closed the sheet instead. */
function _clientPaneRefresh(clientId) {
  const searchEl = document.getElementById('clientSearch');
  if (_isDesktop && document.getElementById('clientList')) _renderClientDetail(clientId, false);
  else renderClientList(searchEl ? searchEl.value : '');
}

/* The edit sheet drawn again in place after a card changed, everything typed in it kept (a card change used to close it
   and open it afresh, dropping every unsaved edit), except the fields of the entry just added. */
function _clientDialogRedraw(clientId, clearIds) {
  var c = S.clients.find(function(x) { return x.id === clientId; });
  var name = document.getElementById('ceditName');
  var scrim = name && name.closest('.inv-scrim-dialog');
  if (!c || !scrim) { if (c) _showClientOverlay(c, false); _clientPaneRefresh(clientId); return; }
  var kept = {};
  scrim.querySelectorAll('input[id], textarea[id], select[id]').forEach(function(el) {
    if ((clearIds || []).indexOf(el.id) < 0) kept[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  keepScroll(function() {
    _showClientOverlay(c, false, true);
    Object.keys(kept).forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = kept[id]; else el.value = kept[id];
    });
    var tpl = document.getElementById('ceditPoTpl');
    if (tpl) clientPoExampleRefresh(tpl);
  });
  _clientPaneRefresh(clientId);
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

/* The rate typed into Rate history's fields: null when nothing is typed, {error} when half of it is. */
function _readLadderRate(c, optional) {
  var rv = ((document.getElementById('ceditNewRate') || {}).value || '').trim();
  var date = (document.getElementById('ceditNewRateDate') || {}).value || '';
  if (!rv && optional) return null;
  var rate = parseFloat(rv);
  if (isNaN(rate) || rate < 0 || !date) return { error: 'Rate history: enter the rate and the date it applies from' };
  return { entry: { ratePerKg: gstRound(rate), ratePerPiece: null, effectiveFrom: date } };
}
/* A rate on a date the ladder already has corrects that one; asked first, since it moves every invoice priced from then. */
function _ladderSameDateOk(c, e) {
  var old = (c.rates || []).find(function(r) { return r.effectiveFrom === e.effectiveFrom; });
  if (!old || old.ratePerKg === e.ratePerKg) return Promise.resolve(true);
  return uiConfirm({ title: 'Replace the rate from ' + formatDate(e.effectiveFrom) + '?',
    body: 'On record: ' + formatCurrency(old.ratePerKg) + '/kg from ' + formatDate(e.effectiveFrom) + '. ' + formatCurrency(e.ratePerKg) +
      '/kg takes its place, and lines dated from then are priced and checked against it.', okLabel: 'Replace rate' });
}
/* One entry per date: the later one wins. Two on a date were sorted stably, so the correction lost to the original. */
function _ladderPut(c, e) {
  c.rates = (c.rates || []).filter(function(r) { return r.effectiveFrom !== e.effectiveFrom; });
  c.rates.push(e);
}

async function addClientRate(clientId) {
  var c = S.clients.find(x => x.id === clientId);
  if (!c) return;
  var r = _readLadderRate(c, false);
  if (r.error) { showToast(r.error, 'error'); return; }
  if (!grdOk('rates') && !(await guardAsk('rates', 'add a rate'))) return;   // P1 (guard.js)
  if (!(await _ladderSameDateOk(c, r.entry))) return;
  c = S.clients.find(x => x.id === clientId);
  if (!c) return;
  _ladderPut(c, r.entry);
  saveState();
  showToast('Rate added');
  _clientDialogRedraw(clientId, ['ceditNewRate']);
}

/* A ladder entry taken off, asked first (a rate prices every line dated from it). */
async function removeClientRate(clientId, idx) {
  var c = S.clients.find(x => x.id === clientId), r = c && c.rates && c.rates[idx];
  if (!r) return;
  if (!grdOk('rates') && !(await guardAsk('rates', 'remove a rate'))) return;   // P1 (guard.js)
  if (!(await uiConfirm({ title: 'Remove the rate from ' + formatDate(r.effectiveFrom) + '?',
    body: formatCurrency(r.ratePerKg) + '/kg from ' + formatDate(r.effectiveFrom) + ' comes off the ladder; lines dated from then take the rate before it.',
    okLabel: 'Remove rate', danger: true }))) return;
  _cardRemove(clientId, 'rates', r, function(x) { return x.effectiveFrom === r.effectiveFrom && x.ratePerKg === r.ratePerKg; }, 'Rate removed');
}

/* Takes an entry off a card, found again in the book held now (another window may have saved while the question was
   open), and draws the sheet again. */
function _cardRemove(clientId, list, was, same, msg) {
  var c = S.clients.find(x => x.id === clientId);
  var i = c && c[list] ? c[list].findIndex(same) : -1;
  if (i < 0) { showToast('Not removed: it had changed meanwhile', 'warning'); _clientDialogRedraw(clientId); return; }
  c[list].splice(i, 1);
  saveState();
  showToast(msg);
  _clientDialogRedraw(clientId);
}

/* The ladder's remove button: an action events.js does not route, so it is answered here. */
document.addEventListener('click', function(e) {
  var btn = e.target && e.target.closest ? e.target.closest('[data-action="invRemoveRate"]') : null;
  if (btn) removeClientRate(parseInt(btn.dataset.client, 10), parseInt(btn.dataset.idx, 10));
});

function closeOverlay() {
  var count = document.querySelectorAll('.inv-scrim-dialog').length;
  document.querySelectorAll('.inv-scrim-dialog').forEach(s => s.remove());
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
  const all = document.querySelectorAll('.inv-scrim-dialog');
  if (all.length > 0) {
    all[all.length - 1].remove();
    popFocus();
    // The last one shut: the page scrolls again, and a layout switch deferred while it was open runs now.
    if (document.querySelectorAll('.inv-scrim-dialog').length === 0) {
      document.body.style.overflow = '';
      if (_pendingModeSwitch) { _pendingModeSwitch = false; updateLayoutMode(); }
    }
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

    html += todoClientCardHtml(c.id);
    html += finClientMoneyHtml(c.id);
    html += qtClientPanelHtml(c.id);
    html += kbLinkedHtml('client', c.id, c.name, 'Knowledge');

    var group = function(title, n) { return '<div class="inv-row-group"><span>' + title + ' · ' + n + '</span></div>'; };
    var cards = '';
    if ((c.rates || []).length) cards += group('Rate history', c.rates.length) + _clientRateRowsHtml(c);
    if (c.itemRates && c.itemRates.length) {
      cards += group('Item rate overrides', c.itemRates.length) + c.itemRates.map(function(ir) {
        return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title inv-id">' + escHtml(ir.partPattern) + '</span>' +
          (ir.label ? '<span class="inv-row-meta">' + escHtml(ir.label) + '</span>' : '') + '</span>' +
          '<span class="inv-row-end inv-num">' + formatCurrency(ir.rate) + '/' + itemRateUnit(ir) + '</span></div>';
      }).join('');
    }
    // Ten of each card here; the rest one tap away (Edit holds them all, folded).
    if (c.pieceRates && c.pieceRates.length) {
      cards += group('Piece rates', c.pieceRates.length) + uiMoreHtml('cpane-pr-' + c.id, _sortedPieceRates(c).map(function(pr) {
        return _cardRowHtml(_partGaugeHtml(pr), formatCurrency(pr.rate) + '/pc', pr.effectiveFrom, '');
      }), { n: 10, noun: 'piece rates' });
    }
    if (c.pieceWeights && c.pieceWeights.length) {
      cards += group('Piece weights', c.pieceWeights.length) + uiMoreHtml('cpane-pw-' + c.id, _sortedCard(c.pieceWeights).map(function(pw) {
        return _cardRowHtml(_partGaugeHtml(pw), escHtml(pw.kgPerPiece) + ' kg/pc', pw.effectiveFrom, '');
      }), { n: 10, noun: 'piece weights' });
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
      // Counted by the invoice's id: its number restarts every financial year, so 00012 of two years read as one invoice.
      groups[key].hits.push({ date: inv.date || '', rate: gstRound(li.rate), inv: inv.id, invoiceNumber: inv.invoiceNumber });
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
      grp.hits.forEach(function(h) { outliers.push({ partNumber: grp.partNumber, gauge: grp.gauge, rate: h.rate, invoiceNumber: h.invoiceNumber, date: h.date, usual: null }); });
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
        outliers.push({ partNumber: grp.partNumber, gauge: grp.gauge, rate: h.rate, invoiceNumber: h.invoiceNumber, date: h.date, usual: usual });
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
  if (!grdGate('rates', 'fill piece rates from billing', function() { fillPieceRatesFromHistory(clientId); })) return;   // P1 (guard.js)
  var r = pieceRatesFromHistory(c);
  if (!c.pieceRates) c.pieceRates = [];
  var now = Date.now();
  r.add.forEach(function(pr) { pr.addedAt = now; c.pieceRates.push(pr); });
  if (r.add.length) saveState();
  _pieceFillReport = { clientId: c.id, added: r.add.length, lines: r.lines,
    skippedExisting: r.skippedExisting, outliers: r.outliers, mixed: r.mixed };
  showToast(r.add.length ? r.add.length + ' piece rates added from billing history' : 'No new piece rates to add',
    (r.outliers.length || r.mixed.length) ? 'warning' : undefined);
  _clientDialogRedraw(clientId);
}

/* What a card's add fields hold: {entry}, {error} when it is half typed, or null when nothing is typed and that is allowed
   (the Save of the whole sheet). One reader for the Add button and for Save. */
var CARD_FIELDS = {
  rate: { list: 'pieceRates', part: 'ceditPiecePart', gauge: 'ceditPieceGauge', fig: 'ceditPieceRate', date: 'ceditPieceDate', title: 'Piece rates',
    figMsg: 'enter a rate per piece', dupMsg: 'already has a rate from ' },
  weight: { list: 'pieceWeights', part: 'ceditWtPart', gauge: 'ceditWtGauge', fig: 'ceditWtKg', date: 'ceditWtDate', title: 'Piece weights',
    figMsg: 'enter the weight of one piece in kg', dupMsg: 'already has a weight from ' }
};
function _readCardEntry(kind, c, optional) {
  var f = CARD_FIELDS[kind], v = function(id) { return ((document.getElementById(id) || {}).value || '').trim(); };
  var part = v(f.part), gauge = v(f.gauge).toUpperCase(), fig = parseFloat(v(f.fig)), date = v(f.date);
  if (optional && !part && !v(f.fig)) return null;
  var err = function(m) { return { error: (optional ? f.title + ': ' : '') + m }; };
  if (!part) return err(optional ? 'enter the part number, or clear the entry' : 'Enter the part number');
  if (isNaN(fig) || fig <= 0) return err(optional ? f.figMsg : f.figMsg.charAt(0).toUpperCase() + f.figMsg.slice(1));
  if (!date) return err('Enter the date it applies from');
  var dup = (c[f.list] || []).some(function(e) { return rateKey(e.partNumber) === rateKey(part) && rateKey(e.gauge) === rateKey(gauge) && e.effectiveFrom === date; });
  if (dup) return err('That part ' + f.dupMsg + date);
  var entry = { partNumber: part, gauge: gauge, effectiveFrom: date, source: 'manual', addedAt: Date.now() };
  if (kind === 'rate') entry.rate = gstRound(fig); else entry.kgPerPiece = Math.round(fig * 10000) / 10000;
  return { entry: entry };
}
function _addCardEntry(kind, clientId) {
  var c = S.clients.find(function(x) { return x.id === clientId; });
  if (!c) return;
  var r = _readCardEntry(kind, c, false), f = CARD_FIELDS[kind];
  if (r.error) { showToast(r.error, 'error'); return; }
  if (!grdGate('rates', kind === 'rate' ? 'add a piece rate' : 'add a piece weight', function() { _addCardEntry(kind, clientId); })) return;   // P1 (guard.js)
  (c[f.list] || (c[f.list] = [])).push(r.entry);
  saveState();
  showToast(kind === 'rate' ? 'Piece rate added' : 'Piece weight added');
  _clientDialogRedraw(clientId, [f.part, f.gauge, f.fig]);
}
/* A card entry taken off, asked first, and found again by what it was (not its place) in the book held after the question. */
async function _removeCardEntry(kind, clientId, idx) {
  var f = CARD_FIELDS[kind], c = S.clients.find(function(x) { return x.id === clientId; }), e = c && c[f.list] && c[f.list][idx];
  if (!e) return;
  if (!grdOk('rates') && !(await guardAsk('rates', kind === 'rate' ? 'remove a piece rate' : 'remove a piece weight'))) return;   // P1 (guard.js)
  var what = e.partNumber + (e.gauge ? ' · ' + e.gauge : '') + ', ' + (kind === 'rate' ? formatCurrency(e.rate) + '/pc' : e.kgPerPiece + ' kg/pc') +
    (e.effectiveFrom ? ' from ' + formatDate(e.effectiveFrom) : '');
  if (!(await uiConfirm({ title: kind === 'rate' ? 'Remove this piece rate?' : 'Remove this piece weight?', body: what + '. Lines of this part are then checked against what is left on the card.',
    okLabel: 'Remove', danger: true }))) return;
  _cardRemove(clientId, f.list, e, function(x) {
    return x.partNumber === e.partNumber && (x.gauge || '') === (e.gauge || '') && x.effectiveFrom === e.effectiveFrom && x.rate === e.rate && x.kgPerPiece === e.kgPerPiece;
  }, kind === 'rate' ? 'Piece rate removed' : 'Piece weight removed');
}

function addPieceRate(clientId) { _addCardEntry('rate', clientId); }
function removePieceRate(clientId, idx) { return _removeCardEntry('rate', clientId, idx); }


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
      gr.invs[inv.id] = true;   // by id: the number restarts every financial year
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
    var m = (numMedian(gr.hits) || 0);
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
  if (!grdGate('rates', 'fill piece weights from billing', function() { fillPieceWeightsFromHistory(clientId); })) return;   // P1 (guard.js)
  var r = pieceWeightsFromHistory(c);
  if (!c.pieceWeights) c.pieceWeights = [];
  var now = Date.now();
  r.add.forEach(function(pw) { pw.addedAt = now; c.pieceWeights.push(pw); });
  if (r.add.length) saveState();
  _weightFillReport = { clientId: c.id, added: r.add.length, lines: r.lines, single: r.single,
    skippedExisting: r.skippedExisting, mixed: r.mixed };
  showToast(r.add.length ? r.add.length + ' piece weights added from billing history' : 'No new piece weights to add',
    r.mixed.length ? 'warning' : undefined);
  _clientDialogRedraw(clientId);
}

function addPieceWeight(clientId) { _addCardEntry('weight', clientId); }
function removePieceWeight(clientId, idx) { return _removeCardEntry('weight', clientId, idx); }
