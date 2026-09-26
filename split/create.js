/* ===== CREATE INVOICE ===== */
let invoiceForm = {
  clientId: null, date: localDateStr(), items: [],
  poNumber:'', poDate:localDateStr(), challanNo:'', challanDate:localDateStr(),
  despatchDate:localDateStr(), transport:'', eWayBill:'', remarks:'',
  editingId: null
};

function initCreateForm() {
  invoiceForm = {clientId:null, date:localDateStr(), items:[], poNumber:'',poDate:localDateStr(),challanNo:'',challanDate:localDateStr(),despatchDate:localDateStr(),transport:'',eWayBill:'',remarks:'',editingId:null};
  // Phase 7: Pre-select client from Stats drill-down
  if (_preselectedClientId) {
    var pc = S.clients.find(function(c) { return c.id === parseInt(_preselectedClientId); });
    if (pc) invoiceForm.clientId = pc.id;
    _preselectedClientId = null;
  }
  renderCreateForm();
}

/* ===== THE LINE EDITOR (design principles §6.15) =====
   Shared by the invoice form and the challan form. On the phone a line is a
   small grid of fields under "Line n"; on the desktop the same fields line up
   as one row under a column head (inv-lines-head). One DOM for both layouts,
   so every control keeps its place, its data-k and its focus across a switch. */
var LINE_X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function lineField(label, control, forId, cls) {
  return '<div class="inv-field' + (cls ? ' ' + cls : '') + '"><label class="inv-field-label"' +
    (forId ? ' for="' + forId + '"' : '') + '>' + label + '</label>' + control + '</div>';
}

function linesHeadHtml(qtyLabel) {
  return '<div class="inv-lines-head" aria-hidden="true"><span>#</span><span>Part</span>' +
    '<span class="inv-num">' + qtyLabel + '</span><span>Unit</span><span class="inv-num">Pcs</span>' +
    '<span class="inv-num">Rate</span><span class="inv-num">Amount</span><span></span></div>';
}

/* The client picker both forms open on: a search field with its suggestion menu. */
function clientSearchHtml(inputId, resultsId, dataK) {
  return '<div class="inv-field"><label class="inv-field-label" for="' + inputId + '">Client</label>' +
    '<div class="inv-combo"><div class="inv-search">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>' +
    '<input type="text" id="' + inputId + '"' + (dataK ? ' data-k="' + dataK + '"' : '') + ' placeholder="Search client" autocomplete="off"' +
    ' role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="' + resultsId + '"></div>' +
    '<div id="' + resultsId + '" class="inv-menu inv-hidden" role="listbox"></div></div></div>';
}

function clientMenuHtml(matches, action, idPrefix) {
  return matches.map(function(c, i) {
    return '<div class="inv-menu-item" role="option" id="' + idPrefix + i + '" data-action="' + action + '" data-id="' + c.id + '">' +
      '<span class="inv-menu-title">' + escHtml(c.name) + '</span>' +
      (c.gstin ? '<span class="inv-menu-meta inv-id">' + escHtml(c.gstin) + '</span>' : '') + '</div>';
  }).join('');
}

/* The chosen client, as a row with its Change button. */
function chosenClientHtml(client, meta, changeAction, dataK) {
  return '<div class="inv-row inv-row-2" data-chosen-client><div class="inv-row-main">' +
    '<div class="inv-row-title">' + escHtml(client.name) + '</div>' +
    '<div class="inv-row-meta inv-id">' + escHtml(meta) + '</div></div>' +
    '<div class="inv-row-end"><button type="button" class="inv-btn inv-btn-secondary inv-btn-sm"' + (dataK ? ' data-k="' + dataK + '"' : '') +
    ' data-action="' + changeAction + '">Change</button></div></div>';
}

function renderCreateForm() {
  const client = invoiceForm.clientId ? S.clients.find(c => c.id === invoiceForm.clientId) : null;
  const area = document.getElementById('createFormArea');
  const editing = invoiceForm.editingId ? S.invoices.find(i => i.id === invoiceForm.editingId) : null;
  const number = editing ? editing.displayNumber : invoiceForm.reissue ? invoiceForm.reissue.displayNumber
    : (S.invPrefix || '') + String(S.invNextNum).padStart(5, '0');
  const unbilled = client && !invoiceForm.editingId && !invoiceForm.reissue ? createUnbilledHtml(client) : '';

  let html = '<div data-form="invoice"><div class="inv-panels">';

  // Invoice: who and when. Takes the whole row until the client's unbilled challans sit beside it.
  html += '<div class="inv-panel inv-panel-flush' + (unbilled ? '' : ' inv-panels-wide') + '">' +
    '<div class="inv-panel-head"><span class="inv-panel-title">' + (editing ? 'Edit invoice' : invoiceForm.reissue ? 'Reissue invoice' : 'New invoice') + '</span>' +
    '<span class="inv-panel-count">' + escHtml(number) + '</span></div>';
  if (invoiceForm.reissue) {
    html += '<div class="inv-panel-body"><div class="inv-callout inv-callout-warning" data-reissue>Reissuing <strong class="inv-id">' + escHtml(invoiceForm.reissue.displayNumber) +
      '</strong>: this invoice takes the number back. Withdraw the customer&rsquo;s copy of the old one.</div></div>';
  }
  if (client) html += chosenClientHtml(client, (client.gstin || 'No GSTIN') + ' · ' + client.billingMode, 'invClearClient');
  html += '<div class="inv-panel-body"><div class="inv-fields">' +
    (client ? '' : clientSearchHtml('invClientSearch', 'invClientResults')) +
    '<div class="inv-field"><label class="inv-field-label" for="invDate">Invoice date</label>' +
    '<input type="date" class="inv-input inv-id" id="invDate" value="' + escHtml(invoiceForm.date) + '"></div></div></div></div>';

  html += unbilled;

  // Lines
  html += '<div class="inv-panel inv-panel-flush inv-panels-wide"><div class="inv-panel-head"><span class="inv-panel-title">Lines</span>' +
    '<span class="inv-panel-count">' + invoiceForm.items.length + '</span></div><div class="inv-lines">' +
    (invoiceForm.items.length ? linesHeadHtml('Qty') : '');
  invoiceForm.items.forEach((item, idx) => {
    const isPieceNOS = client && client.billingMode==='piece' && item.unit==='NOS';
    const rateDisplay = (item.rate != null && !isNaN(item.rate) && item.rate !== 0) ? formatNum(item.rate) : (item.qty > 0 && isPieceNOS ? '—' : (item.rate === 0 && item.qty > 0 ? '0.00' : ''));
    const amtDisplay = (item.amount != null && !isNaN(item.amount) && item.amount !== 0) ? formatNum(item.amount) : (item.amount === 0 && item.qty > 0 ? '0.00' : '');
    const rm = client ? rateMatch(client, invoiceForm.date, item) : null;
    html += '<div class="inv-line"><span class="inv-line-num">' + (idx + 1) + '</span>' +
      lineField('Part', '<div class="inv-combo">' +
        '<input class="inv-input" value="' + escHtml(item.desc || item.partNumber) + '" data-action="invEditLinePart" data-idx="' + idx + '" placeholder="Part name or number" autocomplete="off"' +
        ' role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="invPartAC' + idx + '">' +
        '<div class="inv-menu inv-hidden" id="invPartAC' + idx + '" role="listbox"></div></div>', null, 'inv-line-part') +
      lineField('Qty', '<input type="number" class="inv-input inv-input-num" value="' + (item.qty||'') + '" data-field="qty" data-idx="' + idx + '" data-action="invUpdateLine" step="any" min="0">') +
      lineField('Unit', '<select class="inv-select" data-field="unit" data-idx="' + idx + '" data-action="invUpdateLine">' +
        '<option value="KG"' + (item.unit==='KG'?' selected':'') + '>KG</option>' +
        '<option value="NOS"' + (item.unit==='NOS'?' selected':'') + '>NOS</option></select>') +
      (item.unit === 'KG'
        ? lineField('Pcs', '<input type="number" class="inv-input inv-input-num" value="' + (item.nosQty || '') + '" data-field="nosQty" data-idx="' + idx + '" data-action="invUpdateLine" step="1" min="0" placeholder="Pieces">')
        : '<div class="inv-field" aria-hidden="true"></div>') +
      lineField('Rate', '<input type="number" class="inv-input inv-input-num" value="' + rateDisplay + '" data-field="rate" data-idx="' + idx + '" data-action="invUpdateLine" step="any" min="0"' +
        rateMatchInputAttr(rm) + (isPieceNOS ? ' readonly title="Rate is set from this client&#39;s piece-mode profile"' : '') + '>') +
      lineField('Amount', '<input type="number" class="inv-input inv-input-num" value="' + amtDisplay + '" data-field="amount" data-idx="' + idx + '" data-action="invUpdateLine" step="any" min="0"' +
        (isPieceNOS ? '' : ' readonly') + '>', null, 'inv-line-amt') +
      '<button type="button" class="inv-btn inv-btn-ghost inv-btn-icon inv-line-rm" data-action="invRemoveLineItem" data-idx="' + idx + '" aria-label="Remove line ' + (idx + 1) + '">' + LINE_X_ICON + '</button>' +
      '<div class="inv-line-notes">' +
      (item._override ? '<div><span class="inv-badge inv-badge-info">' + escHtml(item._label || 'Override') + '</span></div>' : '') +
      '<div id="invRateMatch' + idx + '">' + rateMatchNote(rm) + '</div>' +
      '<div id="invWeightMatch' + idx + '">' + (client ? weightMatchNote(weightMatch(client, invoiceForm.date, item)) : '') + '</div>' +
      '<div id="invZeroReason' + idx + '">' + zeroReasonHtml(item, idx) + '</div>' +
      '</div></div>';
  });
  html += '</div><div class="inv-panel-body"><button type="button" class="inv-btn inv-btn-secondary inv-btn-block" data-action="invAddLineItem">Add line</button></div></div>';

  // Optional details: folded until something is in them. The fields stay in the
  // page while folded, so every capture by id still reads them.
  const optSummary = [invoiceForm.challanNo && 'Challan ' + invoiceForm.challanNo, invoiceForm.poNumber && 'PO ' + invoiceForm.poNumber,
    invoiceForm.transport].filter(Boolean).join(' · ');
  const optOpen = invoiceForm._optOpen != null ? invoiceForm._optOpen : !!(optSummary || invoiceForm.remarks || (invoiceForm._pred && (invoiceForm._pred.po || invoiceForm._pred.ve)));
  html += '<details class="inv-panel inv-panel-flush inv-panel-fold" id="invOptional"' + (optOpen ? ' open' : '') + '>' +
    '<summary class="inv-panel-head"><span class="inv-panel-title">Optional details</span>' +
    '<span class="inv-panel-count">' + escHtml(optSummary) + '</span></summary>' +
    '<div class="inv-panel-body"><div class="inv-fields">' +
    '<div class="inv-field"><label class="inv-field-label" for="invChallanNo">Challan no.</label><input class="inv-input inv-id" id="invChallanNo" value="' + escHtml(invoiceForm.challanNo) + '"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="invChallanDate">Challan date</label><input type="date" class="inv-input inv-id" id="invChallanDate" value="' + escHtml(invoiceForm.challanDate) + '"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="invPONumber">P.O. no.</label><input class="inv-input inv-id" id="invPONumber" value="' + escHtml(invoiceForm.poNumber) + '">' + predHintHtml('po') + '</div>' +
    '<div class="inv-field"><label class="inv-field-label" for="invPODate">P.O. date</label><input type="date" class="inv-input inv-id" id="invPODate" value="' + escHtml(invoiceForm.poDate) + '"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="invTransport">Vehicle no.</label><input class="inv-input inv-id" id="invTransport" value="' + escHtml(invoiceForm.transport) + '" placeholder="JH 05XX 0000" list="invVehicleList" autocomplete="off">' +
    '<datalist id="invVehicleList">' + getVehicleSuggestions(invoiceForm.clientId) + '</datalist>' + predHintHtml('ve') + '</div>' +
    '<div class="inv-field"><label class="inv-field-label" for="invDespatchDate">Despatch date</label><input type="date" class="inv-input inv-id" id="invDespatchDate" value="' + escHtml(invoiceForm.despatchDate) + '"></div>' +
    '</div><div class="inv-field"><label class="inv-field-label" for="invRemarks">Remarks</label><textarea class="inv-textarea" id="invRemarks" rows="2">' + escHtml(invoiceForm.remarks) + '</textarea></div></div></details>';

  // Totals: the panel is empty (and not drawn) until there is a line.
  html += '<div id="invTotalsArea" class="inv-panel inv-panel-flush">' + createTotalsHtml(client) + '</div>';
  html += '</div>';

  // Validation + the action bar: the grand total, Clear, and the page's one primary.
  const errors = validateInvoice();
  html += '<div id="invErrorsArea">' + errors.map(e => '<div class="inv-field-error">' + escHtml(e) + '</div>').join('') + '</div>';
  html += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">Grand total</div>' +
    '<div class="inv-actionbar-value" id="invGrandTotal">' + formatCurrency(createTotals(client).grand) + '</div></div>' +
    '<button type="button" class="inv-btn inv-btn-secondary" data-action="invResetForm">Clear</button>' +
    '<button type="button" class="inv-btn inv-btn-primary" id="invSaveBtn" data-action="invSaveInvoice"' + (errors.length > 0 ? ' disabled' : '') + '>' +
    (invoiceForm.editingId ? 'Update invoice' : invoiceForm.reissue ? 'Reissue ' + escHtml(invoiceForm.reissue.invoiceNumber) : 'Create invoice') + '</button></div></div>';

  area.innerHTML = html;

  const fold = document.getElementById('invOptional');
  if (fold) fold.addEventListener('toggle', () => { invoiceForm._optOpen = fold.open; });

  // Bind client search
  const cs = document.getElementById('invClientSearch');
  if (cs) {
    cs.addEventListener('input', () => {
      const q = cs.value.toLowerCase();
      const res = document.getElementById('invClientResults');
      const matches = q.length < 1 ? [] :
        S.clients.filter(c => c.isActive && (c.name.toLowerCase().includes(q) || (c.gstin||'').includes(q))).slice(0, 8);
      acReset();
      if (matches.length === 0) {
        res.classList.add('inv-hidden');
        res.innerHTML = '';
        cs.setAttribute('aria-expanded', 'false');
        return;
      }
      res.classList.remove('inv-hidden');
      res.innerHTML = clientMenuHtml(matches, 'invSelectClient', 'invClientOpt');
      cs.setAttribute('aria-expanded', 'true');
    });
    setTimeout(() => cs.focus(), 100);
  }
}

/* The invoice's tax, worked the one way both the render and the live update read. */
function createTotals(client) {
  const taxable = gstRound(invoiceForm.items.reduce((s,i) => s + (i.amount || 0), 0));
  const gstType = client ? client.gstType : 'intra';
  const cgst = gstType === 'intra' ? gstRound(taxable * 9 / 100) : 0;
  const sgst = gstType === 'intra' ? gstRound(taxable * 9 / 100) : 0;
  const igst = gstType === 'inter' ? gstRound(taxable * 18 / 100) : 0;
  return { gstType, taxable, cgst, sgst, igst, grand: gstRound(taxable + cgst + sgst + igst) };
}

function createTotalsHtml(client) {
  if (invoiceForm.items.length === 0) return '';
  const t = createTotals(client);
  const row = (label, v, strong) => '<div class="inv-row' + (strong ? ' inv-row-strong' : '') + '"><span class="inv-row-main">' + label + '</span>' +
    '<span class="inv-row-end inv-num">' + formatCurrency(v) + '</span></div>';
  return '<div class="inv-panel-head"><span class="inv-panel-title">Totals</span></div>' +
    row('Taxable value', t.taxable) +
    (t.gstType === 'intra' ? row('CGST @ 9%', t.cgst) + row('SGST @ 9%', t.sgst) : row('IGST @ 18%', t.igst)) +
    row('Grand total', t.grand, true);
}

/* The client's challans still waiting for an invoice, each a tick box: ticking one
   brings its open lines into the invoice (linked, so saving marks them invoiced),
   unticking takes them out. The same lines the IM screen's selection would bring. */
function createUnbilledHtml(client) {
  const open = (S.incomingMaterial || []).filter(im => im.clientId === client.id && (im.items || []).some(it => !it.invoiced))
    .sort((a, b) => String(a.challanDate || '').localeCompare(String(b.challanDate || '')));
  if (!open.length) return '';
  const inForm = {};
  invoiceForm.items.forEach(i => { if (i._imItemId) inForm[i._imItemId] = true; });
  let html = '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">Unbilled challans</span>' +
    '<span class="inv-panel-count">' + open.length + '</span></div><div class="inv-scroll">';
  open.forEach(im => {
    const lines = im.items.filter(it => !it.invoiced);
    const on = lines.some(it => inForm[it.id]);
    const kg = lines.reduce((s, it) => s + (it.unit === 'KG' ? (it.qty || 0) : 0), 0);
    const amt = gstRound(lines.reduce((s, it) => s + (it.amount || 0), 0));
    const name = 'Challan ' + (im.challanNo || '(no number)');
    html += '<div class="inv-row inv-row-2' + (on ? ' inv-row-selected' : '') + '">' +
      '<label class="inv-row-lead inv-row-tick"><input type="checkbox" class="inv-check" data-action="invCreatePickChallan" data-id="' + escHtml(im.id) + '"' +
      (on ? ' checked' : '') + ' aria-label="' + escHtml(name) + '"></label>' +
      '<div class="inv-row-main"><div class="inv-row-title inv-id">' + escHtml(name) + '</div>' +
      '<div class="inv-row-meta">' + escHtml(formatDate(im.challanDate)) + ' · ' + lines.length + ' line' + (lines.length === 1 ? '' : 's') +
      (kg > 0 ? ' · <span class="inv-id">' + formatNum(kg, 2) + ' kg</span>' : '') + '</div></div>' +
      '<div class="inv-row-end inv-num">' + formatCurrency(amt) + '</div></div>';
  });
  return html + '</div></div>';
}

/* What the ticked challans say for the invoice's challan no., date and vehicle. */
function createChallanAuto() {
  const ims = (invoiceForm._linkedIMIds || []).map(id => (S.incomingMaterial || []).find(m => m.id === id)).filter(Boolean);
  const uniq = arr => arr.filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  const dates = ims.map(m => m.challanDate).filter(Boolean).sort();
  return { no: uniq(ims.map(m => m.challanNo)), date: dates[0] || '', ve: uniq(ims.map(m => m.vehicleNo)) };
}

function createPickChallan(imId) {
  captureOptionalFields();
  const im = (S.incomingMaterial || []).find(m => m.id === imId);
  if (!im || im.clientId !== invoiceForm.clientId) return;
  const lines = im.items.filter(it => !it.invoiced);
  const ids = lines.map(it => it.id);
  const before = createChallanAuto();
  const had = invoiceForm.items.some(i => ids.indexOf(i._imItemId) >= 0);
  if (had) {
    invoiceForm.items = invoiceForm.items.filter(i => ids.indexOf(i._imItemId) < 0);
    invoiceForm._linkedIMItemIds = (invoiceForm._linkedIMItemIds || []).filter(id => ids.indexOf(id) < 0);
    invoiceForm._linkedIMIds = (invoiceForm._linkedIMIds || []).filter(id => id !== imId);
  } else {
    // An untouched blank line would only sit above the challan's lines.
    invoiceForm.items = invoiceForm.items.filter(i => i._imItemId || i.partNumber || i.desc || i.qty || i.amount);
    lines.forEach(it => invoiceForm.items.push({
      partNumber: it.partNumber, desc: it.desc, hsn: it.hsn || '998873', unit: it.unit, qty: it.qty,
      rate: it.rate || 0, amount: it.amount || 0, nosQty: it.nosQty || null, _override: false, _label: '', _imItemId: it.id
    }));
    invoiceForm._linkedIMItemIds = (invoiceForm._linkedIMItemIds || []).concat(ids);
    invoiceForm._linkedIMIds = (invoiceForm._linkedIMIds || []).concat([imId]);
  }
  // The challan fields follow the ticks while nobody has typed over them.
  const after = createChallanAuto();
  if (!invoiceForm.challanNo || invoiceForm.challanNo === before.no) {
    invoiceForm.challanNo = after.no;
    if (after.date) invoiceForm.challanDate = after.date;
  }
  if (!invoiceForm.transport || invoiceForm.transport === before.ve) invoiceForm.transport = after.ve;
  renderCreateForm();
}

/* The reason block under a line billed at ₹0. Re-rendered on its own when the
   line moves in or out of ₹0, so the field being typed in keeps focus. */
function zeroReasonHtml(item, idx) {
  if (!isZeroBilledLine(item)) return '';
  var html = '<div class="inv-callout inv-callout-warning" data-zero-reason>' +
    '<span class="inv-badge inv-badge-warning">₹0</span> Why is this line not billed?' +
    '<div class="inv-toolbar" role="radiogroup" aria-label="Reason for billing at zero">';
  ZERO_REASONS.forEach(function(r) {
    var on = item.zeroReason === r.id;
    html += '<button type="button" class="inv-chip' + (on ? ' inv-chip-on' : '') + '" role="radio" aria-checked="' + on + '"' +
      ' data-action="invZeroReason" data-idx="' + idx + '" data-reason="' + r.id + '">' + escHtml(r.label) + '</button>';
  });
  html += '</div>' +
    '<input class="inv-input" data-action="invZeroNote" data-idx="' + idx + '" data-k="zeronote-' + idx + '"' +
    ' value="' + escHtml(item.zeroNote || '') + '" placeholder="' + (item.zeroReason === 'other' ? 'What was it? (recommended)' : 'Note (optional)') + '"' +
    ' aria-label="Note on why this line is not billed">' +
    '</div>';
  return html;
}

/* What a saved line carries about being billed at ₹0 — nothing at all when it
   is billed, so a line priced later does not keep a stale reason. */
function zeroReasonFields(item) {
  if (!isZeroBilledLine(item) || !item.zeroReason) return {};
  var out = { zeroReason: item.zeroReason };
  var note = (item.zeroNote || '').trim();
  if (note) out.zeroNote = note;
  if (item.zeroReasonBackfilled) out.zeroReasonBackfilled = item.zeroReasonBackfilled;
  return out;
}

function refreshZeroReason(idx) {
  var box = document.getElementById('invZeroReason' + idx);
  var item = invoiceForm.items[idx];
  if (!box || !item) return;
  var want = isZeroBilledLine(item);
  var has = !!box.firstChild;
  if (want !== has) box.innerHTML = zeroReasonHtml(item, idx);
}

function validateInvoice() {
  const errors = [];
  if (!invoiceForm.clientId) errors.push('Select a client');
  if (!invoiceForm.date) errors.push('Enter invoice date');
  if (invoiceForm.items.length === 0) errors.push('Add at least one line item');
  invoiceForm.items.forEach((item, i) => {
    if (item.qty < 0) errors.push('Line ' + (i+1) + ': Quantity cannot be negative');
    if (item.amount < 0) errors.push('Line ' + (i+1) + ': Amount cannot be negative');
    if (isZeroBilledLine(item) && !item.zeroReason) errors.push('Line ' + (i+1) + ': billed at \u20B90 \u2014 pick a reason');
  });
  return errors;
}

function selectClient(id) {
  captureOptionalFields();
  invoiceForm.clientId = id;
  // PO and vehicle from the client's own history (insights.js): filled only
  // into an empty field, and only where the history clearly says what it is.
  predApplyToInvoice();
  const client = S.clients.find(c => c.id === id);
  // Auto-fill rate on existing items
  if (client) {
    invoiceForm.items.forEach(item => {
      const rateInfo = getLineItemRate(client, invoiceForm.date, item.partNumber);
      if (rateInfo._override) {
        item.rate = rateInfo.rate;
        item._override = true;
        item._label = rateInfo._label;
      } else {
        item.rate = defaultLineRate(client, invoiceForm.date, item);
      }
      recalcLineItem(item, client);
    });
  }
  renderCreateForm();
}

function addLineItem() {
  captureOptionalFields();
  const client = invoiceForm.clientId ? S.clients.find(c => c.id === invoiceForm.clientId) : null;
  const item = {partNumber:'', desc:'', hsn:'998873', unit:'KG', qty:0, rate:0, amount:0, _override:false, _label:''};
  if (client) {
    const rateInfo = getLineItemRate(client, invoiceForm.date, '');
    item.rate = rateInfo.ratePerKg || 0;
  }
  invoiceForm.items.push(item);
  renderCreateForm();
}

function recalcLineItem(item, client) {
  if (!client) { item.amount = gstRound((item.qty||0) * (item.rate||0)); return; }
  if (client.billingMode === 'piece' && item.unit === 'NOS') {
    // Challan passthrough: amount entered directly, rate back-calculated
    if (item.qty > 0 && item.amount > 0) {
      item.rate = gstRound(item.amount / item.qty);
    }
    // Don't auto-calc amount for NOS piece mode
  } else if (client.billingMode === 'nos_to_weight' && item.unit === 'NOS') {
    const pwKey = (item.partNumber || '').toUpperCase();
    const rateInfo = getLineItemRate(client, invoiceForm.date, item.partNumber);
    // A part with no weight on record cannot be converted; it is billed per
    // piece off the client's card (Samarth's brackets), or an override. Before
    // this the line priced itself at weight 0 × ₹/kg = ₹0.
    const perPiece = rateInfo._override ? {rate: rateInfo.rate}
      : (S.partWeights[pwKey] ? null : getPieceRate(client, invoiceForm.date, item.partNumber, item.desc));
    if (perPiece && perPiece.rate != null) {
      item.rate = perPiece.rate;
      item.amount = gstRound((item.qty || 0) * item.rate);
      return;
    }
    const w = (item.qty || 0) * (S.partWeights[pwKey] || 0);
    item.rate = rateInfo.ratePerKg || 0;
    item.amount = gstRound(w * item.rate);
  } else {
    item.amount = gstRound((item.qty || 0) * (item.rate || 0));
  }
}

function saveInvoice() {
  const errors = validateInvoice();
  if (errors.length > 0) { showToast(errors[0], 'error'); return; }

  const client = S.clients.find(c => c.id === invoiceForm.clientId);
  if (!client) return;

  invoiceForm.challanNo = (document.getElementById('invChallanNo') || {}).value || '';
  invoiceForm.challanDate = (document.getElementById('invChallanDate') || {}).value || '';
  invoiceForm.transport = (document.getElementById('invTransport') || {}).value || '';
  invoiceForm.poNumber = (document.getElementById('invPONumber') || {}).value || '';
  invoiceForm.poDate = (document.getElementById('invPODate') || {}).value || '';
  invoiceForm.despatchDate = (document.getElementById('invDespatchDate') || {}).value || '';
  invoiceForm.remarks = (document.getElementById('invRemarks') || {}).value || '';
  invoiceForm.date = document.getElementById('invDate').value;

  const taxable = gstRound(invoiceForm.items.reduce((s,i) => s + (i.amount || 0), 0));
  const cgstPer = client.gstType === 'intra' ? 9 : 0;
  const sgstPer = client.gstType === 'intra' ? 9 : 0;
  const igstPer = client.gstType === 'inter' ? 18 : 0;
  const cgstAmt = gstRound(taxable * cgstPer / 100);
  const sgstAmt = gstRound(taxable * sgstPer / 100);
  const igstAmt = gstRound(taxable * igstPer / 100);
  const grand = gstRound(taxable + cgstAmt + sgstAmt + igstAmt);

  const now = Date.now();
  // Shown AFTER the tab switch below: switchTab() clears every toast, so a
  // confirmation raised before it was wiped the instant it appeared — "Invoice
  // updated" never reached the screen, and neither would the challan note.
  let doneToast = null;

  if (invoiceForm.editingId) {
    // Update existing
    const inv = S.invoices.find(i => i.id === invoiceForm.editingId);
    if (!inv) return;
    const gstTypeChanged = inv.gstType !== client.gstType;
    Object.assign(inv, {
      date: invoiceForm.date, clientId: client.id, clientName: client.name,
      clientGSTIN: client.gstin, clientAddress: {add1:client.add1,add2:client.add2,add3:client.add3,state:client.state,stateCode:client.stateCode},
      gstType: client.gstType,
      items: invoiceForm.items.map(i => ({partNumber:i.partNumber,desc:i.desc,hsn:i.hsn||'998873',unit:i.unit,qty:i.qty,rate:i.rate,amount:i.amount,nosQty:i.nosQty||null,...zeroReasonFields(i),...(i._imItemId ? {imItemId:i._imItemId} : {})})),
      taxableValue: taxable, cgstPer, cgstAmt, sgstPer, sgstAmt, igstPer, igstAmt,
      grandTotal: grand, amountInWords: numberToWords(grand),
      challanNo: invoiceForm.challanNo, challanDate: invoiceForm.challanDate,
      poNumber: invoiceForm.poNumber, poDate: invoiceForm.poDate,
      despatchDate: invoiceForm.despatchDate, transport: invoiceForm.transport, remarks: invoiceForm.remarks, updatedAt: now
    });
    const synced = backCorrectChallans(inv, invoiceForm.items);
    const syncNote = synced.lines ? ' — challan ' + synced.challans.join(', ') + ' corrected to match (' + synced.lines + ' line' + (synced.lines === 1 ? '' : 's') + ')' : '';
    doneToast = gstTypeChanged
      ? ['Invoice updated — GST type changed, verify tax amounts' + syncNote, 'warning']
      : ['Invoice updated' + syncNote, synced.lines ? 'warning' : undefined];
  } else {
    // New invoice. A reissue takes back the number it replaces; anything else
    // takes the next in the series. Either way no live invoice may share it.
    const reissue = invoiceForm.reissue || null;
    const num = reissue ? reissue.invoiceNumber : String(S.invNextNum).padStart(5, '0');
    const disp = reissue ? reissue.displayNumber : S.invPrefix + num;
    if (S.invoices.some(i => i.displayNumber === disp)) {
      showToast(disp + ' is already a live invoice — not saved. Check Settings → Business → Invoice series.', 'error');
      return;
    }
    // Only what the invoice still carries is linked: a challan line taken out of
    // the form again (a line removed, a challan unticked) stays unbilled.
    const carried = invoiceForm.items.map(i => i._imItemId).filter(Boolean);
    const linkedItemIds = (invoiceForm._linkedIMItemIds || []).filter(id => carried.indexOf(id) >= 0);
    const linkedIMIds = (invoiceForm._linkedIMIds || []).filter(imId => {
      const im = (S.incomingMaterial || []).find(m => m.id === imId);
      return !im || im.items.some(it => linkedItemIds.indexOf(it.id) >= 0);
    });
    const inv = {
      id: 'INV-' + now,
      invoiceNumber: num,
      displayNumber: disp,
      date: invoiceForm.date,
      status: 'active',
      invoiceState: 'created',
      dispatchedAt: null, deliveredAt: null, filedAt: null,
      clientId: client.id, clientName: client.name,
      clientGSTIN: client.gstin,
      clientAddress: {add1:client.add1,add2:client.add2,add3:client.add3,state:client.state,stateCode:client.stateCode},
      gstType: client.gstType,
      items: invoiceForm.items.map(i => ({partNumber:i.partNumber,desc:i.desc,hsn:i.hsn||'998873',unit:i.unit,qty:i.qty,rate:i.rate,amount:i.amount,nosQty:i.nosQty||null,...zeroReasonFields(i),...(i._imItemId ? {imItemId:i._imItemId} : {})})),
      taxableValue: taxable, cgstPer, cgstAmt, sgstPer, sgstAmt, igstPer, igstAmt,
      grandTotal: grand, amountInWords: numberToWords(grand),
      poNumber: invoiceForm.poNumber, poDate: invoiceForm.poDate, challanNo: invoiceForm.challanNo, challanDate: invoiceForm.challanDate,
      despatchDate: invoiceForm.despatchDate, transport: invoiceForm.transport, eWayBill:'', remarks: invoiceForm.remarks,
      linkedIMIds: linkedIMIds, createdAt: now, updatedAt: now, cancelledAt: null
    };
    S.invoices.push(inv);
    // Never leave the series pointing at a number already held: a number
    // reissued from Settings used to leave Next on the one after it (851 when
    // 993 had been issued), and the invoice after that would have taken 851
    // a second time.
    S.invNextNum = Math.max(S.invNextNum + (reissue ? 0 : 1), invHighestIssued(S.invPrefix) + 1);

    // Mark IM items as invoiced
    if (linkedItemIds.length > 0) {
      (S.incomingMaterial || []).forEach(function(im) {
        im.items.forEach(function(it) {
          if (linkedItemIds.indexOf(it.id) >= 0) {
            it.invoiced = true;
            it.invoiceId = inv.id;
          }
        });
      });
    }

    doneToast = ['Invoice ' + inv.displayNumber + ' saved'];
  }

  // Save vehicle number to client for autocomplete
  saveVehicleToClient(invoiceForm.clientId, invoiceForm.transport);

  saveState();
  const returnDest = _navReturnTab || 'pageHome';
  initCreateForm();
  switchTab(returnDest);
  if (doneToast) showToast(doneToast[0], doneToast[1]);
}


/* The matcher's note under a line's rate, and the class its Rate field takes.
   One renderer for the invoice form, the challan form and the invoice detail,
   so the three can never describe the same line differently. */
var RM_LABELS = { match: 'Matches', decimal: '×10 slip', differs: 'Differs', check: 'Check',
  none: 'No rate on record', gauge: 'Gauge not stated' };
/* The tone each verdict speaks in (DR-1): a Check or ×10 is a red flag, the rest are not. */
var RM_TONE = { match: 'ok', decimal: 'warning', differs: 'neutral', check: 'danger', none: 'neutral', gauge: 'neutral' };

/* A verdict under a line: a dot and its word, then the working in mono (§6.15). */
function verdictHtml(status, label, text) {
  return '<div class="inv-verdict" data-verdict="' + status + '"><span class="inv-dot inv-dot-' + RM_TONE[status] + '">' + label + '</span>' +
    (text ? '<span class="inv-verdict-text">' + escHtml(text) + '</span>' : '') + '</div>';
}

function rateMatchNote(m, compact) {
  if (!m) return '';
  var per = m.unit === 'kg' ? '/kg' : '/pc';
  var text = '';
  if (m.status === 'match') text = compact ? '' : formatCurrency(m.ref) + per + ' on record';
  else if (m.status === 'decimal') text = 'On record ' + formatCurrency(m.ref) + per + ' — a power of ten away. Did you mean ' + formatCurrency(m.ref) + '?';
  else if (m.status === 'differs' || m.status === 'check') {
    var sign = function(n) { return (n > 0 ? '+' : '−') + formatCurrency(Math.abs(n)); };
    text = 'On record ' + formatCurrency(m.ref) + per + ' · ' + sign(m.diff) + ' (' + (m.pct * 100).toFixed(1) + '%)' +
      ' · ' + sign(m.stake) + ' on this line';
  } else if (m.status === 'none') text = compact ? '' : 'Add it to the client’s piece rates to check this line';
  else if (m.status === 'gauge') text = compact ? '' : 'This part is priced by gauge — put the gauge in the description';
  return verdictHtml(m.status, RM_LABELS[m.status], text);
}

/* The Rate field carries its verdict too, so a Check reads on the field itself. */
function rateMatchInputAttr(m) {
  return m ? ' data-verdict="' + m.status + '"' : '';
}

/* Re-judge one line in place: the note and the Rate field's class. Called from
   the input handlers, which deliberately do not re-render the whole form. */
function refreshRateMatch(boxId, inputEl, client, onDate, item) {
  var m = rateMatch(client, onDate, item);
  var box = document.getElementById(boxId);
  if (box) box.innerHTML = rateMatchNote(m);
  if (inputEl) {
    if (m) inputEl.setAttribute('data-verdict', m.status); else inputEl.removeAttribute('data-verdict');
  }
}

function refreshInvoiceLineMatch(idx) {
  var item = invoiceForm.items[idx];
  var client = invoiceForm.clientId ? S.clients.find(function(c) { return c.id === invoiceForm.clientId; }) : null;
  if (!item || !client) return;
  refreshRateMatch('invRateMatch' + idx, document.querySelector('[data-action="invUpdateLine"][data-field="rate"][data-idx="' + idx + '"]'),
    client, invoiceForm.date, item);
  refreshWeightMatch('invWeightMatch' + idx, client, invoiceForm.date, item);
}

/* The weight verdict under a KG line that carries a piece count. Same chips as
   the rate, named for the weight so the two can sit on one line unconfused. */
var WM_LABELS = { match: 'Weight matches', decimal: 'Weight ×10', differs: 'Weight differs',
  check: 'Check weight', none: 'No weight on record', gauge: 'Gauge not stated' };

function weightMatchNote(m, compact) {
  if (!m) return '';
  var kg = function(n) { return (Math.round(n * 100) / 100).toFixed(2) + ' kg'; };
  var text = '';
  var basis = m.pcs + ' pcs × ' + m.ref + ' kg/pc = ' + kg(m.expected);
  if (m.status === 'match') text = compact ? '' : basis;
  else if (m.status === 'decimal') text = basis + ' — a power of ten away. Check the weight and the piece count.';
  else if (m.status === 'differs' || m.status === 'check') {
    text = basis + ' · ' + (m.diff > 0 ? '+' : '−') + kg(Math.abs(m.diff)) + ' (' + (m.pct * 100).toFixed(1) + '%)' +
      ' · ' + (m.stake > 0 ? '+' : '−') + formatCurrency(Math.abs(m.stake)) + ' on this line';
  } else if (m.status === 'none') text = compact ? '' : 'Add it to the client’s piece weights to check this line';
  else if (m.status === 'gauge') text = compact ? '' : 'This part is weighed by gauge — put the gauge in the description';
  return verdictHtml(m.status, WM_LABELS[m.status], text);
}

function refreshWeightMatch(boxId, client, onDate, item) {
  var box = document.getElementById(boxId);
  if (box) box.innerHTML = weightMatchNote(weightMatch(client, onDate, item));
}
