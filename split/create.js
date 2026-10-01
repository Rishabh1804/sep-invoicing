/* ===== CREATE INVOICE ===== */
let invoiceForm = {
  clientId: null, date: localDateStr(), items: [],
  poNumber:'', poDate:localDateStr(), challanNo:'', challanDate:localDateStr(),
  despatchDate:localDateStr(), transport:'', eWayBill:'', remarks:'',
  editingId: null
};

function initCreateForm() {
  invoiceForm = {clientId:null, date:localDateStr(), items:[], poNumber:'',poDate:localDateStr(),challanNo:'',challanDate:localDateStr(),despatchDate:localDateStr(),transport:'',eWayBill:'',remarks:'',editingId:null};
  createMarkBase();
  renderCreateForm();
}

/* ===== ONE DOOR TO A NEW FORM =====
   New invoice, Edit, IM's Create invoice, a reissue and the Stats drill-down each replace the form, and each used
   to throw away an invoice being typed without a word. A form holds work when it differs from what it was opened
   as (`_base`, stamped by whoever built it); then the door asks first, Keep editing first. Clear is a discard
   somebody chose and asks nothing. */
function createFormSig(capture) {
  const f = invoiceForm;
  if (!f) return '';
  // Read the fields on screen only for the form they belong to: the base is stamped before the new form is drawn.
  if (capture && document.getElementById('invDate')) captureOptionalFields();
  return JSON.stringify([f.clientId, f.date, f.poNumber, f.poDate, f.challanNo, f.challanDate, f.despatchDate, f.transport, f.remarks,
    (f.items || []).map(i => [i.partNumber, i.desc, i.unit, i.qty, i.rate, i.amount, i.nosQty || null])]);
}
function createMarkBase() { if (invoiceForm) invoiceForm._base = createFormSig(); }
function createFormHasWork() {
  const f = invoiceForm;
  if (!f || !document.getElementById('createFormArea') || !document.getElementById('createFormArea').innerHTML) return false;
  return f._base !== undefined && createFormSig(true) !== f._base;
}
function createDiscardOk() {
  if (!createFormHasWork()) return Promise.resolve(true);
  const f = invoiceForm, c = f.clientId ? S.clients.find(x => x.id === f.clientId) : null;
  const what = f.editingId ? 'Your changes to ' + ((S.invoices.find(i => i.id === f.editingId) || {}).displayNumber || 'an invoice')
    : 'An invoice' + (c ? ' for ' + c.name : '') + ' with ' + todoPlural(f.items.length, 'line');
  return uiConfirm({ title: 'Discard the invoice being typed?',
    body: what + ' on Create ' + (f.editingId ? 'are' : 'is') + ' not saved. Keep editing to finish it first, or discard it and go on.',
    okLabel: 'Discard', cancelLabel: 'Keep editing', danger: true });
}
/* New invoice. */
async function createNew() {
  if (!(await createDiscardOk())) return;
  initCreateForm();
  switchTab('pageCreate');
}
/* A new invoice for one client (the Stats drill-down): the client is chosen on a fresh form, whether or not a form
   already existed. It used to be left in a global that only a form not yet drawn would read, so with Create open
   it did nothing, and later leaked into the next New invoice. */
async function createForClient(clientId) {
  if (!(await createDiscardOk())) return;
  closeOverlay();
  initCreateForm();
  const c = S.clients.find(x => x.id === parseInt(clientId));
  if (c) { selectClient(c.id); createMarkBase(); }
  switchTab('pageCreate');
}

/* Change: what the app filled for the old client goes with it — the lines from its challans, the challan no. and
   date the ticks gave, a PO or vehicle filled for it. A field typed for it asks first, naming what would go. Kept
   before, a line of client A's challan could be saved onto client B's invoice and mark A's challan billed. */
async function createClearClient() {
  captureOptionalFields();
  const f = invoiceForm, auto = f._auto || {}, ticks = createChallanAuto();
  const fromChallan = f.items.filter(i => i._imItemId);
  const typed = [];
  if (f.poNumber && f.poNumber !== auto.po) typed.push('P.O. no. ' + f.poNumber);
  if (f.transport && f.transport !== auto.ve && f.transport !== ticks.ve) typed.push('vehicle ' + f.transport);
  if (f.challanNo && f.challanNo !== ticks.no) typed.push('challan no. ' + f.challanNo);
  // A challan line changed by hand is typed work too.
  const edited = fromChallan.filter(i => {
    let it = null;
    (S.incomingMaterial || []).some(m => (it = (m.items || []).find(x => x.id === i._imItemId)));
    if (!it) return false;
    const fresh = imLineFormItem(it);
    return Math.abs((fresh.qty || 0) - (i.qty || 0)) > IM_QTY_EPS || Math.abs((fresh.amount || 0) - (i.amount || 0)) > 0.005 || (fresh.rate || 0) !== (i.rate || 0);
  });
  if (edited.length) typed.push(todoPlural(edited.length, 'line') + ' from its challans, changed by hand');
  const c = f.clientId ? S.clients.find(x => x.id === f.clientId) : null;
  if (typed.length && !(await uiConfirm({ title: 'Change client?',
    body: 'These were typed for ' + (c ? c.name : 'this client') + ' and go with it: ' + typed.join(', ') + '.',
    okLabel: 'Change client', cancelLabel: 'Keep', danger: true }))) return;
  f.clientId = null;
  f.items = f.items.filter(i => !i._imItemId);
  f._linkedIMIds = []; f._linkedIMItemIds = [];
  if (f.challanNo === ticks.no || typed.length) f.challanNo = '';
  if (ticks.date && f.challanDate === ticks.date) f.challanDate = localDateStr();
  if (!f.poNumber || f.poNumber === auto.po || typed.length) f.poNumber = '';
  if (!f.transport || f.transport === auto.ve || f.transport === ticks.ve || typed.length) f.transport = '';
  f._auto = {}; f._pred = null; f._defaults = null;
  createSyncPoDate();
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
  const shareIdx = invoiceForm.items.some(i => i._imItemId) ? imBilledIndex() : null;
  invoiceForm.items.forEach((item, idx) => {
    const isPieceNOS = client && client.billingMode==='piece' && item.unit==='NOS';
    const rateDisplay = (item.rate != null && !isNaN(item.rate) && item.rate !== 0) ? formatNum(item.rate) : (item.qty > 0 && isPieceNOS ? '—' : (item.rate === 0 && item.qty > 0 ? '0.00' : ''));
    const amtDisplay = (item.amount != null && !isNaN(item.amount) && item.amount !== 0) ? formatNum(item.amount) : (item.amount === 0 && item.qty > 0 ? '0.00' : '');
    const rm = client ? rateMatch(client, invoiceForm.date, item) : null;
    // The field holds the PART NUMBER, as the challan form's does: it showed the description, and a keystroke made
    // that text the part number ("BRACKET" for 2715 2671 0140), which then travelled back to the challan as a
    // correction. The description, when it says more than the number, is said under the line.
    html += '<div class="inv-line"><span class="inv-line-num">' + (idx + 1) + '</span>' +
      lineField('Part', '<div class="inv-combo">' +
        '<input class="inv-input" value="' + escHtml(item.partNumber || item.desc) + '" data-action="invEditLinePart" data-idx="' + idx + '" placeholder="Part name or number" autocomplete="off"' +
        ' role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="invPartAC' + idx + '">' +
        '<div class="inv-menu inv-hidden" id="invPartAC' + idx + '" role="listbox"></div></div>', null, 'inv-line-part') +
      lineField('Qty', '<input type="number" class="inv-input inv-input-num" value="' + (item.qty||'') + '" data-field="qty" data-idx="' + idx + '" data-action="invUpdateLine" step="any" min="0">') +
      lineField('Unit', '<select class="inv-select" data-field="unit" data-idx="' + idx + '" data-change="invUpdateLine">' +
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
      '<div class="inv-line-notes"><div id="invDesc' + idx + '">' + challanDescNote(item) + '</div>' +
      (item._override ? '<div><span class="inv-badge inv-badge-info">' + escHtml(item._label || 'Override') + '</span></div>' : '') +
      '<div id="invRateMatch' + idx + '">' + rateMatchNote(rm) + '</div>' +
      '<div id="invWeightMatch' + idx + '">' + (client ? weightMatchNote(weightMatch(client, invoiceForm.date, item)) : '') + '</div>' +
      '<div id="invZeroReason' + idx + '">' + zeroReasonHtml(item, idx) + '</div>' +
      '<div id="invImShare' + idx + '">' + imShareNoteHtml(idx, shareIdx) + '</div>' +
      '</div></div>';
  });
  html += '</div><div class="inv-panel-body"><button type="button" class="inv-btn inv-btn-secondary inv-btn-block" data-action="invAddLineItem">Add line</button></div></div>';

  createSyncPoDate();
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
    '<div class="inv-field"><label class="inv-field-label" for="invPONumber">P.O. no.</label><input class="inv-input inv-id" id="invPONumber" value="' + escHtml(invoiceForm.poNumber) + '">' +
      '<div id="invPoHint">' + createFieldHintHtml('po') + '</div></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="invPODate">P.O. date</label><input type="date" class="inv-input inv-id" id="invPODate" value="' + escHtml(invoiceForm.poDate) + '">' +
      '<div id="invPoDateHint">' + createPoDateHintHtml() + '</div></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="invTransport">Vehicle no.</label><input class="inv-input inv-id" id="invTransport" value="' + escHtml(invoiceForm.transport) + '" placeholder="JH 05XX 0000" list="invVehicleList" autocomplete="off">' +
    '<datalist id="invVehicleList">' + getVehicleSuggestions(invoiceForm.clientId) + '</datalist>' +
      '<div id="invVeHint">' + createFieldHintHtml('ve') + '</div></div>' +
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
        S.clients.filter(c => c.isActive && (c.name.toLowerCase().includes(q) || (c.gstin||'').toLowerCase().includes(q))).slice(0, 8);
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

/* ===== THE CLIENT'S OWN VEHICLE AND PO =====
   A client whose invoices always carry the same vehicle, or a PO made from the challan number
   (Dorabji Auto: DA1/ + the challan number in five digits), has them as settings on the client
   (`defaultTransport`, `poFromChallan`; state.js). A new invoice for it — the client chosen, a challan
   ticked, IM → Create invoice, a reissue — takes them into the field when it is empty or was itself
   filled this way (`invoiceForm._auto`): a typed value is the operator's for good. An auto PO follows
   the challan number when another challan is ticked; several challans give the first one's number,
   and the hint says so. Where a client has one, it replaces insights.js's prediction for that field. */
function createApplyClientDefaults() {
  const f = invoiceForm;
  if (!f) return;
  const client = f.clientId ? S.clients.find(c => c.id === f.clientId) : null;
  if (f.editingId || !client) { f._defaults = null; return; }
  const auto = f._auto || (f._auto = {});
  const d = { client: client.name };
  const ve = String(client.defaultTransport || '').trim();
  if (ve) {
    d.ve = ve;
    if (!f.transport || f.transport === auto.ve) { f.transport = ve; auto.ve = ve; }
  }
  const tpl = String(client.poFromChallan || '').trim();
  if (tpl && clientPoTemplateOk(tpl)) {
    const po = clientPoFromChallan(client, f.challanNo);
    const nos = String(f.challanNo || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
    d.po = { value: po, tpl: tpl, many: nos.length > 1, first: nos[0] || '', count: nos.length };
    if (po && (!f.poNumber || f.poNumber === auto.po)) { f.poNumber = po; auto.po = po; }
    // Every challan unticked: an auto PO has nothing left to be made from.
    else if (!po && auto.po && f.poNumber === auto.po) { f.poNumber = ''; auto.po = ''; }
  }
  f._defaults = (d.ve || d.po) ? d : null;
}

/* The hint under the PO or vehicle field: the client's setting where it has one, else the prediction. */
function createFieldHintHtml(field) {
  const d = invoiceForm && invoiceForm._defaults;
  const auto = (invoiceForm && invoiceForm._auto) || {};
  const from = d ? 'from ' + d.client + '’s settings' : '';
  if (field === 'po' && d && d.po) {
    let t;
    if (!d.po.value) t = 'Fills from the challan number once one is cited (' + from + ': ' + d.po.tpl + ')';
    else if (invoiceForm.poNumber === auto.po) t = 'Challan ' + d.po.first + ' as ' + d.po.tpl + ', ' + from + (d.po.many ? ' — the first of ' + d.po.count + ' challans' : '');
    else t = 'Typed here; ' + d.client + '’s settings would give ' + d.po.value;
    return '<div class="inv-field-hint" data-client-default="po">' + escHtml(t) + '</div>';
  }
  if (field === 've' && d && d.ve) {
    const t = invoiceForm.transport === auto.ve ? 'Filled ' + from : 'Typed here; ' + d.client + '’s settings would give ' + d.ve;
    return '<div class="inv-field-hint" data-client-default="ve">' + escHtml(t) + '</div>';
  }
  return predHintHtml(field);
}

/* The challan number typed or changed by hand: an auto PO follows it, in place (no redraw, so focus stays). */
function createRefreshDefaults() {
  if (!invoiceForm || !invoiceForm._defaults) return;
  captureOptionalFields();
  createApplyClientDefaults();
  const po = document.getElementById('invPONumber'), ve = document.getElementById('invTransport');
  if (po) po.value = invoiceForm.poNumber || '';
  if (ve) ve.value = invoiceForm.transport || '';
  const ph = document.getElementById('invPoHint'), vh = document.getElementById('invVeHint');
  if (ph) ph.innerHTML = createFieldHintHtml('po');
  if (vh) vh.innerHTML = createFieldHintHtml('ve');
}

/* The P.O. date is not printed on the invoice, and it is almost always the challan's date (owner, 27 Sep
   2026). So it follows the challan date — picked by hand, filled from the challans ticked, or IM → Create
   invoice — until somebody types a different one (`invoiceForm._pdTyped`); clearing it, or typing the challan
   date, hands it back. An invoice opened for editing keeps a P.O. date that differs from its challan date. */
function createSyncPoDate() {
  if (invoiceForm && !invoiceForm._pdTyped) invoiceForm.poDate = invoiceForm.challanDate || '';
}
function createPoDateHintHtml() {
  const t = invoiceForm && invoiceForm._pdTyped ? 'Typed here · not printed on the invoice' : 'Follows the challan date · not printed on the invoice';
  return '<div class="inv-field-hint">' + escHtml(t) + '</div>';
}
/* The challan date or the P.O. date changed by hand: the P.O. date follows in place (no redraw, so focus stays). */
function createRefreshPoDate(changed) {
  if (!invoiceForm) return;
  const cd = document.getElementById('invChallanDate'), pd = document.getElementById('invPODate');
  if (cd) invoiceForm.challanDate = cd.value;
  if (changed === 'po' && pd) {
    invoiceForm.poDate = pd.value;
    invoiceForm._pdTyped = !!pd.value && pd.value !== invoiceForm.challanDate;
  }
  createSyncPoDate();
  if (pd) pd.value = invoiceForm.poDate || '';
  const h = document.getElementById('invPoDateHint');
  if (h) h.innerHTML = createPoDateHintHtml();
}

/* The tax on a taxable value: the one computation the invoice form, the saved invoice and a credit note all read
   (it was worked three ways). 9% + 9% within the state, 18% across. */
function invTax(taxable, gstType) {
  const intra = (gstType || 'intra') === 'intra';
  const cgstPer = intra ? 9 : 0, sgstPer = intra ? 9 : 0, igstPer = gstType === 'inter' ? 18 : 0;
  const cgstAmt = gstRound(taxable * cgstPer / 100), sgstAmt = gstRound(taxable * sgstPer / 100), igstAmt = gstRound(taxable * igstPer / 100);
  return { gstType: gstType || 'intra', cgstPer, cgstAmt, sgstPer, sgstAmt, igstPer, igstAmt, grand: gstRound(taxable + cgstAmt + sgstAmt + igstAmt) };
}

/* The invoice's tax, worked the one way both the render and the live update read. */
function createTotals(client) {
  const taxable = gstRound(invoiceForm.items.reduce((s,i) => s + (i.amount || 0), 0));
  const t = invTax(taxable, client ? client.gstType : 'intra');
  return { gstType: t.gstType, taxable, cgst: t.cgstAmt, sgst: t.sgstAmt, igst: t.igstAmt, grand: t.grand };
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
    // What is LEFT: a challan invoiced in parts offers only its open share.
    const kg = lines.reduce((s, it) => s + (it.unit === 'KG' ? imLineOpen(it).qty : 0), 0);
    const amt = gstRound(lines.reduce((s, it) => s + imLineOpen(it).amount, 0));
    const parts = lines.filter(imLineBilled);
    const name = 'Challan ' + (im.challanNo || '(no number)');
    html += '<div class="inv-row inv-row-2' + (on ? ' inv-row-selected' : '') + '">' +
      '<label class="inv-row-lead inv-row-tick"><input type="checkbox" class="inv-check" data-action="invCreatePickChallan" data-id="' + escHtml(im.id) + '"' +
      (on ? ' checked' : '') + ' aria-label="' + escHtml(name) + '"></label>' +
      '<div class="inv-row-main"><div class="inv-row-title inv-id">' + escHtml(name) + '</div>' +
      '<div class="inv-row-meta">' + escHtml(formatDate(im.challanDate)) + ' · ' + lines.length + ' line' + (lines.length === 1 ? '' : 's') +
      (kg > 0 ? ' · <span class="inv-id">' + formatNum(kg, 2) + ' kg</span>' : '') + '</div>' +
      parts.map(it => { const sh = imLineShare(it.id); return sh ? '<div class="inv-row-meta inv-row-wrap" data-im-share><span class="inv-dot inv-dot-info">Part invoiced</span> ' +
        '<span>' + escHtml(lineLabel(it)) + ': ' + escHtml(imShareText(sh)) + '</span></div>' : ''; }).join('') + '</div>' +
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
    // Each line at what is left of it; dispatching 200 of 600 is typing 200. A piece client's share is priced off the
    // challan's own amount, the share that completes the line taking what is left of it (createPieceShare).
    const pc = S.clients.find(c => c.id === invoiceForm.clientId);
    lines.forEach(it => {
      const item = imLineFormItem(it);
      invoiceForm.items.push(item);
      if (pc && pc.billingMode === 'piece' && item.unit === 'NOS') createPieceShare(item);
    });
    invoiceForm._linkedIMItemIds = (invoiceForm._linkedIMItemIds || []).concat(ids);
    invoiceForm._linkedIMIds = (invoiceForm._linkedIMIds || []).concat([imId]);
  }
  // The challan fields follow the ticks while nobody has typed over them.
  const after = createChallanAuto();
  if (!invoiceForm.challanNo || invoiceForm.challanNo === before.no) {
    invoiceForm.challanNo = after.no;
    if (after.date) invoiceForm.challanDate = after.date;
  }
  createSyncPoDate();
  if (!invoiceForm.transport || invoiceForm.transport === before.ve) {
    invoiceForm.transport = after.ve;
    // Filled from the ticks, so still the app's: a client's own vehicle may replace it.
    (invoiceForm._auto || (invoiceForm._auto = {})).ve = after.ve;
  }
  createApplyClientDefaults();
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

/* ===== A LINE THAT IS PART OF A CHALLAN =====
   What the challan holds, what other invoices billed of it and what is left,
   under a line that takes only part of it; and a line billing more than is
   left says by how much. While an invoice is edited its own share counts as left.

   Two things the challan cannot vouch for ask for a REASON under the line, the
   red flag's and the ₹0 line's contract (owner, 27 Sep 2026: "for both the
   limits, ask for a reason"): billing MORE than is left, and billing it in a
   different UNIT from the challan's. A tap on a reason, a note recommended; the
   invoice cannot be saved without one, and the line keeps it — `overBillAck:
   {at, left, reason, note}` or `unitChangeAck: {at, from, to, reason, note}` —
   so an audit can tell an accepted over-bill or unit change from one nobody was
   shown. Warn, never block: a reason is one tap. */
function invFormImQty(itemId) {
  return invoiceForm.items.reduce((s, i) => s + (i._imItemId === itemId ? (i.qty || 0) : 0), 0);
}

function createImShare(idx, bIdx) {
  const item = invoiceForm.items[idx];
  if (!item || !item._imItemId) return null;
  const sh = imLineShare(item._imItemId, invoiceForm.editingId || null, bIdx);
  if (!sh || (item.unit || '') !== (sh.it.unit || '')) return null;
  const inForm = invFormImQty(item._imItemId);
  const over = parseFloat((inForm - Math.max(0, sh.left)).toFixed(3));
  return { sh: sh, over: over > IM_QTY_EPS ? over : 0, part: sh.refs.length > 0 || Math.abs(inForm - sh.left) > IM_QTY_EPS };
}

function createOverText(o) {
  return imQtyText(o.over) + (o.sh.it.unit === 'KG' ? ' kg' : '') + ' over what is left on challan ' + (o.sh.im.challanNo || '(no number)');
}

/* A line linked to a challan line and billed in a different unit (NOS ↔ KG). The two quantities
   cannot be netted, so the line bills the challan line WHOLE: it closes it (imRefsBilled). */
function createUnitChange(idx, bIdx) {
  const item = invoiceForm.items[idx];
  if (!item || !item._imItemId) return null;
  const sh = imLineShare(item._imItemId, invoiceForm.editingId || null, bIdx);
  if (!sh || (item.unit || '') === (sh.it.unit || '')) return null;
  return { sh: sh, from: sh.it.unit || '', to: item.unit || '' };
}

function createUnitText(u) {
  const ch = 'challan ' + (u.sh.im.challanNo || '(no number)');
  return 'Cannot be compared with ' + ch + ': it holds ' + imQtyText(u.sh.qty) + ' ' + (u.from || 'with no unit') +
    (u.sh.refs.length ? ', ' + imQtyText(u.sh.billed) + ' invoiced' : '') + ', and this line bills it in ' + (u.to || 'no unit') +
    '. Saved, this line closes the challan line: nothing is left on it after this invoice.';
}

/* The reason a line's form holds, read once from what the line was saved with. */
function createAckInit(item) {
  if (item.overReason === undefined) { item.overReason = (item.overBillAck && item.overBillAck.reason) || null; item.overNote = (item.overBillAck && item.overBillAck.note) || ''; }
  if (item.unitReason === undefined) { item.unitReason = (item.unitChangeAck && item.unitChangeAck.reason) || null; item.unitNote = (item.unitChangeAck && item.unitChangeAck.note) || ''; }
  return item;
}

/* The chips and the note under a line the challan cannot vouch for (kind: 'over' | 'unit'). */
function createAckPickerHtml(kind, item, idx, reasons, question) {
  const on = kind === 'over' ? item.overReason : item.unitReason;
  const note = kind === 'over' ? item.overNote : item.unitNote;
  const act = kind === 'over' ? 'invOverReason' : 'invUnitReason';
  let h = '<div class="inv-callout inv-callout-warning" data-ack="' + kind + '">' + escHtml(question) +
    '<div class="inv-toolbar" role="radiogroup" aria-label="' + escHtml(question) + '">';
  reasons.forEach(r => {
    const sel = on === r.id;
    h += '<button type="button" class="inv-chip' + (sel ? ' inv-chip-on' : '') + '" role="radio" aria-checked="' + sel + '"' +
      ' data-action="' + act + '" data-idx="' + idx + '" data-reason="' + r.id + '" data-k="' + kind + 'r-' + idx + '-' + r.id + '">' + escHtml(r.label) + '</button>';
  });
  return h + '</div><input class="inv-input" data-action="' + (kind === 'over' ? 'invOverNote' : 'invUnitNote') + '" data-idx="' + idx + '" data-k="' + kind + 'note-' + idx + '"' +
    ' value="' + escHtml(note || '') + '" placeholder="' + (on === 'other' ? 'What was it? (recommended)' : 'Note (recommended)') + '"' +
    ' aria-label="Note on the reason"></div>';
}

function imShareNoteHtml(idx, bIdx) {
  const item = invoiceForm.items[idx];
  if (!item) return '';
  const u = createUnitChange(idx, bIdx);
  if (u) {
    createAckInit(item);
    return '<div class="inv-verdict" data-im-unit><span class="inv-dot inv-dot-warning">Unit changed</span>' +
      '<span class="inv-verdict-text">' + escHtml(createUnitText(u)) + '</span></div>' +
      createAckPickerHtml('unit', item, idx, unitChangeReasons(u.to), 'Why is this line billed in ' + (u.to || 'another unit') + ' when the challan says ' + (u.from || 'no unit') + '?');
  }
  const o = createImShare(idx, bIdx);
  if (!o || (!o.part && !o.over)) return '';
  let h = '<div class="inv-verdict" data-im-share><span class="inv-dot inv-dot-info">Part of challan</span>' +
    '<span class="inv-verdict-text">' + escHtml(imShareText(o.sh)) + '</span></div>';
  if (o.over) {
    createAckInit(item);
    const old = item.overBillAck && !item.overBillAck.reason && !item.overReason;
    h += '<div class="inv-verdict" data-im-over><span class="inv-dot inv-dot-warning">More than left</span>' +
      '<span class="inv-verdict-text">' + escHtml(createOverText(o)) + '</span></div>' +
      createAckPickerHtml('over', item, idx, OVER_BILL_REASONS, old
        ? 'Accepted earlier with no reason recorded. Why does this line bill more than is left?'
        : 'Why does this line bill more than is left?');
  }
  return h;
}

/* Every line's note, since two lines may draw on one challan line. */
function refreshImShare() {
  const bIdx = invoiceForm.items.some(i => i._imItemId) ? imBilledIndex() : null;
  invoiceForm.items.forEach((item, idx) => {
    const box = document.getElementById('invImShare' + idx);
    if (!box) return;
    // Redrawn only when it changes, so a note being typed in keeps its caret.
    const html = imShareNoteHtml(idx, bIdx);
    if (box.dataset.drawn !== html) { box.innerHTML = html; box.dataset.drawn = html; }
  });
}

/* The lines billing more than is left, each with what was left. */
function createOverBills(bIdx) {
  if (!bIdx && invoiceForm.items.some(i => i._imItemId)) bIdx = imBilledIndex();
  return invoiceForm.items.map((item, idx) => {
    const o = createImShare(idx, bIdx);
    return o && o.over ? { idx: idx, item: item, over: o.over, left: Math.max(0, o.sh.left), sh: o.sh } : null;
  }).filter(Boolean);
}

/* The lines billed in another unit than their challan line's. */
function createUnitChanges(bIdx) {
  if (!bIdx && invoiceForm.items.some(i => i._imItemId)) bIdx = imBilledIndex();
  return invoiceForm.items.map((item, idx) => {
    const u = createUnitChange(idx, bIdx);
    return u ? Object.assign({ idx: idx, item: item }, u) : null;
  }).filter(Boolean);
}

/* Stamp each line with the reason it carries (or take a stale one off), just before it is saved. */
function createStampAcks() {
  const bIdx = invoiceForm.items.some(i => i._imItemId) ? imBilledIndex() : null;
  const now = Date.now();
  const overs = createOverBills(bIdx), units = createUnitChanges(bIdx);
  invoiceForm.items.forEach(i => {
    createAckInit(i);
    const o = overs.find(x => x.item === i);
    if (!o) delete i.overBillAck;
    else {
      const prev = i.overBillAck;
      const same = prev && prev.reason === i.overReason && Math.abs((prev.left || 0) - o.left) <= IM_QTY_EPS;
      const note = (i.overNote || '').trim();
      i.overBillAck = { at: same && prev.at ? prev.at : now, left: o.left, reason: i.overReason };
      if (note) i.overBillAck.note = note;
    }
    const u = units.find(x => x.item === i);
    if (u) {
      const prev = i.unitChangeAck;
      const same = prev && prev.reason === i.unitReason && prev.from === u.from && prev.to === u.to;
      const note = (i.unitNote || '').trim();
      i.unitChangeAck = { at: same && prev.at ? prev.at : now, from: u.from, to: u.to, reason: i.unitReason };
      if (note) i.unitChangeAck.note = note;
    } else if (!(i.unitChangeAck && i.unitChangeAck.to === i.unit && i.unitChangeAck.from !== i.unit)) {
      // The unit put back: nothing to explain. (A change carried back to the challan as a correction keeps
      // its record — the line still bills in the unit the reason was given for.)
      delete i.unitChangeAck;
    }
  });
}

/* A piece client's line from a challan, re-priced for a new quantity at the
   challan's own amount per piece. Not on an edit of a line that billed the
   whole challan line: there a changed count is a correction, and the amount
   the customer's paper carried stays (the passthrough). */
function createPieceShare(item) {
  if (!item._imItemId) return false;
  const sh = imLineShare(item._imItemId, invoiceForm.editingId || null);
  if (!sh || sh.it.unit !== item.unit || !(sh.qty > 0) || !(sh.it.amount > 0)) return false;
  if (invoiceForm.editingId && item._orig && item._orig.qty === sh.qty && !sh.refs.length) return false;
  item.amount = gstRound(sh.it.amount * (item.qty || 0) / sh.qty);
  // The share that completes the line takes what is left of its amount, so the shares add up to the challan to the
  // paisa: three thirds of ₹100.00 billed ₹99.99. Only where every other share is a share (none bills it whole).
  const others = invoiceForm.items.filter(i => i !== item && i._imItemId === item._imItemId);
  const inForm = invFormImQty(item._imItemId);
  if (!sh.refs.some(r => imRefWhole(sh.it, r)) && Math.abs(sh.billed + inForm - sh.qty) <= IM_QTY_EPS) {
    let billedAmt = 0;
    (S.invoices || []).forEach(inv => {
      if (inv.status === 'cancelled' || inv.id === invoiceForm.editingId) return;
      (inv.items || []).forEach(li => { if (li.imItemId === item._imItemId) billedAmt += li.amount || 0; });
    });
    const rest = gstRound(sh.it.amount - billedAmt - others.reduce((t, i) => t + (i.amount || 0), 0));
    if (rest > 0) item.amount = rest;
  }
  return true;
}

/* A KG line from a challan: pieces nobody typed are the challan's, in proportion
   to the kilograms this line takes of it. */
function createKgPieces(item) {
  if (!item._imItemId || !item._nosAuto || item.unit !== 'KG') return false;
  const sh = imLineShare(item._imItemId, invoiceForm.editingId || null);
  if (!sh || !(sh.qty > 0) || !sh.it.nosQty) return false;
  item.nosQty = Math.round(sh.it.nosQty * (item.qty || 0) / sh.qty) || null;
  return true;
}

/* The pieces a saved line states. A NOS line's pieces ARE its quantity, and the form has no Pcs field for one: a line
   from a NOS challan line takes its share of the challan's pieces. A 200 dispatch of a 600-piece line kept all 600,
   printed "600 NOS" under a line billing 200, and billed the challan's every piece. */
function createLinePieces(i) {
  if (i.unit === 'NOS' && i._imItemId && i.nosQty) {
    const sh = imLineShare(i._imItemId, invoiceForm.editingId || null);
    if (sh && sh.it.unit === 'NOS' && sh.qty > 0 && sh.it.nosQty) return Math.round(sh.it.nosQty * (i.qty || 0) / sh.qty) || null;
  }
  return i.nosQty || null;
}

/* A form line as the invoice keeps it. */
function invSavedLine(i) {
  return { partNumber: i.partNumber, desc: i.desc, hsn: i.hsn || '998873', unit: i.unit, qty: i.qty, rate: i.rate, amount: i.amount, nosQty: createLinePieces(i),
    ...zeroReasonFields(i),
    ...(i._imItemId ? { imItemId: i._imItemId } : {}),
    ...(i._imItemId && i.imWhole ? { imWhole: true } : {}),
    ...(i._imItemId && i.overBillAck ? { overBillAck: i.overBillAck } : {}),
    ...(i._imItemId && i.unitChangeAck ? { unitChangeAck: i.unitChangeAck } : {}) };
}

function validateInvoice() {
  const errors = [];
  if (!invoiceForm.clientId) errors.push('Select a client');
  // Gone since the form was opened (another window, a merge): the save used to return without a word.
  else if (!S.clients.some(c => c.id === invoiceForm.clientId)) errors.push('The client chosen is no longer in the client master — choose the client again');
  if (invoiceForm.editingId && !S.invoices.some(i => i.id === invoiceForm.editingId)) errors.push('The invoice being edited is no longer in the register (deleted, or changed in another window) — nothing can be saved to it');
  if (!invoiceForm.date) errors.push('Enter invoice date');
  if (invoiceForm.items.length === 0) errors.push('Add at least one line item');
  invoiceForm.items.forEach((item, i) => {
    // A line bills a part, some of it: a blank line saved a ₹0 invoice, reached a quality certificate, and an
    // amount with no quantity printed 0.00 NOS.
    // A line whose Part field was typed in is named by the field (the part number); one never touched may be named by its
    // description alone, as a challan line written with only a description is.
    if (!String((item._partTyped ? item.partNumber : item.partNumber || item.desc) || '').trim()) errors.push('Line ' + (i+1) + ': name the part');
    if (!((item.qty || 0) > 0)) { if (!(item.qty < 0)) errors.push('Line ' + (i+1) + ': enter the quantity'); }
    if (item.qty < 0) errors.push('Line ' + (i+1) + ': Quantity cannot be negative');
    if (item.amount < 0) errors.push('Line ' + (i+1) + ': Amount cannot be negative');
    if (isZeroBilledLine(item) && !item.zeroReason) errors.push('Line ' + (i+1) + ': billed at \u20B90 \u2014 pick a reason');
  });
  // A line the challan cannot vouch for: more than is left on it, or in another unit.
  if (invoiceForm.items.some(i => i._imItemId)) {
    const bIdx = imBilledIndex();
    createUnitChanges(bIdx).forEach(u => {
      if (!createAckInit(u.item).unitReason) errors.push('Line ' + (u.idx + 1) + ': billed in ' + (u.to || 'another unit') + ', challan ' +
        (u.sh.im.challanNo || '(no number)') + ' says ' + (u.from || 'no unit') + ' \u2014 pick a reason');
    });
    createOverBills(bIdx).forEach(o => {
      if (!createAckInit(o.item).overReason) errors.push('Line ' + (o.idx + 1) + ': ' + createOverText(o) + ' \u2014 pick a reason');
    });
  }
  return errors;
}

function selectClient(id) {
  captureOptionalFields();
  invoiceForm.clientId = id;
  // PO and vehicle from the client's own history (insights.js): filled only
  // into an empty field, and only where the history clearly says what it is.
  predApplyToInvoice();
  // A client's own vehicle and PO pattern (its settings) win over the prediction.
  createApplyClientDefaults();
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
      // The new client's rate is the app's, not a typed one.
      if (item._auto) item._auto.rate = true;
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

function recalcLineItem(item, client) { linePrice(item, client, invoiceForm.date); }

/* The question before saving an invoice dated outside the financial year its number's series names, or null: the
   next number's series for a new invoice, the number it keeps for an edit or a reissue. */
function createFyAsk() {
  const f = invoiceForm;
  const editing = f.editingId ? S.invoices.find(i => i.id === f.editingId) : null;
  const held = editing || f.reissue || null;
  const number = held ? held.displayNumber : (S.invPrefix || '') + String(S.invNextNum).padStart(5, '0');
  const dt = document.getElementById('invDate');
  return seriesFyAsk('This invoice', number, held ? invSeriesOf(held) : (S.invPrefix || ''), dt ? dt.value : f.date);
}

async function saveInvoice() {
  const errors = validateInvoice();
  if (errors.length > 0) { showToast(errors[0], 'error'); return; }

  // Asked, never refused: an old document entered late may be meant (seriesFyAsk, number-audit.js).
  const fyAsk = createFyAsk();
  if (fyAsk && !(await uiConfirm(fyAsk))) return;

  const client = S.clients.find(c => c.id === invoiceForm.clientId);
  if (!client) { showToast('The client chosen is no longer in the client master — nothing was saved', 'error'); return; }

  // More than is left on a challan line, or another unit than its: each carries the reason picked under it.
  createStampAcks();

  invoiceForm.challanNo = (document.getElementById('invChallanNo') || {}).value || '';
  invoiceForm.challanDate = (document.getElementById('invChallanDate') || {}).value || '';
  invoiceForm.transport = (document.getElementById('invTransport') || {}).value || '';
  invoiceForm.poNumber = (document.getElementById('invPONumber') || {}).value || '';
  invoiceForm.poDate = (document.getElementById('invPODate') || {}).value || '';
  createSyncPoDate();
  invoiceForm.despatchDate = (document.getElementById('invDespatchDate') || {}).value || '';
  invoiceForm.remarks = (document.getElementById('invRemarks') || {}).value || '';
  invoiceForm.date = document.getElementById('invDate').value;

  const taxable = gstRound(invoiceForm.items.reduce((s,i) => s + (i.amount || 0), 0));
  const { cgstPer, cgstAmt, sgstPer, sgstAmt, igstPer, igstAmt, grand } = invTax(taxable, client.gstType);

  const now = Date.now();
  // Shown AFTER the tab switch below: switchTab() clears every toast, so a
  // confirmation raised before it was wiped the instant it appeared — "Invoice
  // updated" never reached the screen, and neither would the challan note.
  let doneToast = null;
  // An edit or a reissue goes back to the Register on the invoice; a new one to Home. (The return tab set by Edit
  // was cleared by the very switch to Create, so an update landed on Home.)
  let backTo = null;

  if (invoiceForm.editingId) {
    // Update existing
    const inv = S.invoices.find(i => i.id === invoiceForm.editingId);
    if (!inv) { showToast('The invoice being edited is no longer in the register — nothing was saved', 'error'); return; }
    backTo = inv.id;
    const gstTypeChanged = inv.gstType !== client.gstType;
    Object.assign(inv, {
      date: invoiceForm.date, clientId: client.id, clientName: client.name,
      clientGSTIN: client.gstin, clientAddress: {add1:client.add1,add2:client.add2,add3:client.add3,state:client.state,stateCode:client.stateCode},
      gstType: client.gstType,
      items: invoiceForm.items.map(invSavedLine),
      taxableValue: taxable, cgstPer, cgstAmt, sgstPer, sgstAmt, igstPer, igstAmt,
      grandTotal: grand, amountInWords: numberToWords(grand),
      challanNo: invoiceForm.challanNo, challanDate: invoiceForm.challanDate,
      poNumber: invoiceForm.poNumber, poDate: invoiceForm.poDate,
      despatchDate: invoiceForm.despatchDate, transport: invoiceForm.transport, remarks: invoiceForm.remarks, updatedAt: now
    });
    // A challan line brought in while editing is linked to the invoice too.
    invoiceForm.items.forEach(i => {
      if (!i._imItemId) return;
      const im = (S.incomingMaterial || []).find(m => (m.items || []).some(it => it.id === i._imItemId));
      if (im) { if (!inv.linkedIMIds) inv.linkedIMIds = []; if (inv.linkedIMIds.indexOf(im.id) < 0) inv.linkedIMIds.push(im.id); }
    });
    const synced = backCorrectChallans(inv, invoiceForm.items);
    // A line matched to its challan line as the edit opened, and taken off in it, bills that line no more.
    invFreeDropped(inv, invoiceForm);
    imSyncBilled();
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
    // the form again (a line removed, a challan unticked) stays unbilled. A reissue
    // also carries what the old invoice held by its id alone (invReissueCarry).
    const carried = invoiceForm.items.map(i => i._imItemId).filter(Boolean).concat((reissue && reissue.legacyItemIds) || []);
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
      items: invoiceForm.items.map(invSavedLine),
      taxableValue: taxable, cgstPer, cgstAmt, sgstPer, sgstAmt, igstPer, igstAmt,
      grandTotal: grand, amountInWords: numberToWords(grand),
      poNumber: invoiceForm.poNumber, poDate: invoiceForm.poDate, challanNo: invoiceForm.challanNo, challanDate: invoiceForm.challanDate,
      despatchDate: invoiceForm.despatchDate, transport: invoiceForm.transport, eWayBill:'', remarks: invoiceForm.remarks,
      linkedIMIds: linkedIMIds, createdAt: now, updatedAt: now, cancelledAt: null
    };
    S.invoices.push(inv);
    if (reissue) backTo = inv.id;
    // Never leave the series pointing at a number already held: a number
    // reissued from Settings used to leave Next on the one after it (851 when
    // 993 had been issued), and the invoice after that would have taken 851
    // a second time.
    S.invNextNum = Math.max(S.invNextNum + (reissue ? 0 : 1), invHighestIssued(S.invPrefix) + 1);

    // A field typed over what the challan said is a correction, and reaches the challan with a note (owner, 30 Sep 2026).
    const syncedNew = backCorrectChallans(inv, invoiceForm.items);
    // A reissue takes over what was keyed on the old invoice's id: challan lines it held alone, and its credit notes.
    if (reissue) invReissueCarry(reissue, inv);
    // What each challan line has been billed is derived from the invoices.
    imSyncBilled();

    doneToast = syncedNew.lines
      ? ['Invoice ' + inv.displayNumber + ' saved — challan ' + syncedNew.challans.join(', ') + ' corrected to match (' + syncedNew.lines + ' line' + (syncedNew.lines === 1 ? '' : 's') + ')', 'warning']
      : ['Invoice ' + inv.displayNumber + ' saved'];
  }

  // Save vehicle number to client for autocomplete
  saveVehicleToClient(invoiceForm.clientId, invoiceForm.transport);

  saveState();
  initCreateForm();
  if (backTo) {
    _navReturnTab = 'pageRegister';
    switchTab('pageRegister');
    regShowInvoice(backTo);
  } else switchTab(_navReturnTab || 'pageHome');
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
  if (!item) return;
  // The description under the Part field follows the part being typed (the challan form's note, im-form.js).
  var dn = document.getElementById('invDesc' + idx);
  if (dn) dn.innerHTML = challanDescNote(item);
  var client = invoiceForm.clientId ? S.clients.find(function(c) { return c.id === invoiceForm.clientId; }) : null;
  if (!client) return;
  refreshRateMatch('invRateMatch' + idx, document.querySelector('[data-action="invUpdateLine"][data-field="rate"][data-idx="' + idx + '"]'),
    client, invoiceForm.date, item);
  refreshWeightMatch('invWeightMatch' + idx, client, invoiceForm.date, item);
  // A part typed that prices the line at ₹0 (a nos_to_weight part with no weight) asks why, as a typed figure does.
  refreshZeroReason(idx);
  // And the form is judged again: a part named or a quantity cleared opens or holds the Save.
  updateTotalsDisplay();
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

/* A rate typed on an invoice line is the operator's for good (item._auto.rate false, and the figure it was typed as):
   linePrice then never fills the record's rate over it. On a nos_to_weight line the card rate replaced a typed one
   silently, the field still showing what was typed. Marked in the capture phase, before events.js prices the line. */
document.addEventListener('input', function(e) {
  var el = e.target;
  if (!el || !el.matches) return;
  // The challan form's rate too: both forms price through linePrice, and only the invoice's was marked, so a rate typed
  // on a challan line was replaced by the card's (the QA sweep's review, 30 Sep 2026).
  var onChallan = el.matches('[data-action="invUpdateChallanLine"][data-field="rate"]');
  if (!onChallan && !el.matches('[data-action="invUpdateLine"][data-field="rate"]')) return;
  var form = onChallan ? (typeof _challanForm !== 'undefined' ? _challanForm : null) : invoiceForm;
  var item = form && form.items && form.items[parseInt(el.dataset.idx, 10)];
  if (!item) return;
  item._auto = item._auto || {};
  item._auto.rate = false;
  item._auto.rateTyped = parseFloat(el.value) || 0;
}, true);
