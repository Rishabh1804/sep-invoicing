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

function renderCreateForm() {
  const client = invoiceForm.clientId ? S.clients.find(c => c.id === invoiceForm.clientId) : null;
  const area = document.getElementById('createFormArea');

  let html = '<div class="inv-card"><div class="inv-card-header"><span class="inv-card-title">Invoice Details</span></div>';

  // Client selector
  html += '<div class="inv-form-group"><label class="inv-form-label">Client</label>';
  if (client) {
    html += '<div class="inv-flex-between inv-selected-client">' +
      '<div><div class="inv-client-name">' + escHtml(client.name) + '</div>' +
      '<div class="inv-client-meta">' + escHtml(client.gstin || 'No GSTIN') + ' &middot; ' + escHtml(client.billingMode) + '</div></div>' +
      '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invClearClient">Change</button></div>';
  } else {
    html += '<div class="inv-search-wrap inv-search-no-mb">' +
      '<svg class="inv-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' +
      '<input type="text" class="inv-search-input" id="invClientSearch" placeholder="Search client" autocomplete="off">' +
      '<div id="invClientResults" class="inv-hidden"></div></div>';
  }
  html += '</div>';

  // Date
  html += '<div class="inv-form-group"><label class="inv-form-label">Invoice Date</label>' +
    '<input type="date" class="inv-form-input inv-mono" id="invDate" value="' + escHtml(invoiceForm.date) + '"></div></div>';

  // Line items
  html += '<div class="inv-card"><div class="inv-card-header"><span class="inv-card-title">Line Items</span></div>';
  invoiceForm.items.forEach((item, idx) => {
    const isPieceNOS = client && client.billingMode==='piece' && item.unit==='NOS';
    const rateDisplay = (item.rate != null && !isNaN(item.rate) && item.rate !== 0) ? formatNum(item.rate) : (item.qty > 0 && isPieceNOS ? '\u2014' : (item.rate === 0 && item.qty > 0 ? '0.00' : ''));
    const amtDisplay = (item.amount != null && !isNaN(item.amount) && item.amount !== 0) ? formatNum(item.amount) : (item.amount === 0 && item.qty > 0 ? '0.00' : '');
    html += '<div class="inv-line-item">' +
      '<div class="inv-line-header"><span class="inv-line-num">Item ' + (idx + 1) + '</span>' +
      '<button class="inv-line-remove" data-action="invRemoveLineItem" data-idx="' + idx + '">&times;</button></div>' +
      '<div class="inv-form-group"><label class="inv-form-label">Part / Description</label>' +
      '<div class="inv-autocomplete-wrap">' +
      '<input class="inv-form-input" value="' + escHtml(item.desc || item.partNumber) + '" data-action="invEditLinePart" data-idx="' + idx + '" placeholder="Part name or number" autocomplete="off">' +
      '<div class="inv-autocomplete-list inv-hidden" id="invPartAC' + idx + '"></div></div></div>' +
      '<div class="inv-form-row">' +
      '<div class="inv-form-group"><label class="inv-form-label">Qty</label>' +
      '<input type="number" class="inv-form-input inv-mono" value="' + (item.qty||'') + '" data-field="qty" data-idx="' + idx + '" data-action="invUpdateLine" step="any" min="0"></div>' +
      '<div class="inv-form-group"><label class="inv-form-label">Unit</label>' +
      '<select class="inv-form-select" data-field="unit" data-idx="' + idx + '" data-action="invUpdateLine">' +
      '<option value="KG"' + (item.unit==='KG'?' selected':'') + '>KG</option>' +
      '<option value="NOS"' + (item.unit==='NOS'?' selected':'') + '>NOS</option></select></div></div>' +
      '<div class="inv-form-row">' +
      '<div class="inv-form-group"><label class="inv-form-label">Rate</label>' +
      '<input type="number" class="inv-form-input inv-mono' + (client && client.billingMode==='piece' && item.unit==='NOS' ? ' inv-form-input-readonly' : '') + '" value="' + rateDisplay + '" data-field="rate" data-idx="' + idx + '" data-action="invUpdateLine" step="any" min="0"' +
      (client && client.billingMode==='piece' && item.unit==='NOS' ? ' readonly title="Rate is set from this client&#39;s piece-mode profile"' : '') + '></div>' +
      '<div class="inv-form-group"><label class="inv-form-label">Amount</label>' +
      '<input type="number" class="inv-form-input inv-mono" value="' + amtDisplay + '" data-field="amount" data-idx="' + idx + '" data-action="invUpdateLine" step="any" min="0"' +
      (client && client.billingMode==='piece' && item.unit==='NOS' ? '' : ' readonly') + '></div></div>' +
      (item.rate === 0 ? '<span class="inv-zero-badge">\u20B90</span> ' : '') +
      (item._override ? '<span class="inv-override-badge">' + escHtml(item._label || 'Override') + '</span> ' : '') +
      '</div>';
  });
  html += '<button class="inv-btn inv-btn-ghost inv-btn-block" data-action="invAddLineItem">+ Add Line Item</button></div>';

  // Optional fields
  html += '<div class="inv-card"><div class="inv-card-header"><span class="inv-card-title">Optional Details</span></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">Challan No</label><input class="inv-form-input" id="invChallanNo" value="' + escHtml(invoiceForm.challanNo) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Challan Date</label><input type="date" class="inv-form-input inv-mono" id="invChallanDate" value="' + escHtml(invoiceForm.challanDate) + '"></div></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">PO No</label><input class="inv-form-input" id="invPONumber" value="' + escHtml(invoiceForm.poNumber) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">PO Date</label><input type="date" class="inv-form-input inv-mono" id="invPODate" value="' + escHtml(invoiceForm.poDate) + '"></div></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">Vehicle No</label><input class="inv-form-input" id="invTransport" value="' + escHtml(invoiceForm.transport) + '" placeholder="JH 05XX 0000" list="invVehicleList" autocomplete="off">' +
    '<datalist id="invVehicleList">' + getVehicleSuggestions(invoiceForm.clientId) + '</datalist></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Despatch Date</label><input type="date" class="inv-form-input inv-mono" id="invDespatchDate" value="' + escHtml(invoiceForm.despatchDate) + '"></div></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Remarks</label><textarea class="inv-form-input" id="invRemarks" rows="2">' + escHtml(invoiceForm.remarks) + '</textarea></div></div>';

  // Totals
  html += '<div id="invTotalsArea">';
  if (invoiceForm.items.length > 0) {
    const taxable = gstRound(invoiceForm.items.reduce((s,i) => s + (i.amount || 0), 0));
    const gstType = client ? client.gstType : 'intra';
    const cgst = gstType === 'intra' ? gstRound(taxable * 9 / 100) : 0;
    const sgst = gstType === 'intra' ? gstRound(taxable * 9 / 100) : 0;
    const igst = gstType === 'inter' ? gstRound(taxable * 18 / 100) : 0;
    const grand = gstRound(taxable + cgst + sgst + igst);

    html += '<div class="inv-totals">' +
      '<div class="inv-total-row"><span class="inv-total-label">Taxable Value</span><span class="inv-total-value">' + formatCurrency(taxable) + '</span></div>';
    if (gstType === 'intra') {
      html += '<div class="inv-total-row"><span class="inv-total-label">CGST @ 9%</span><span class="inv-total-value">' + formatCurrency(cgst) + '</span></div>' +
        '<div class="inv-total-row"><span class="inv-total-label">SGST @ 9%</span><span class="inv-total-value">' + formatCurrency(sgst) + '</span></div>';
    } else {
      html += '<div class="inv-total-row"><span class="inv-total-label">IGST @ 18%</span><span class="inv-total-value">' + formatCurrency(igst) + '</span></div>';
    }
    html += '<div class="inv-total-row inv-total-row-grand"><span class="inv-total-label">Grand Total</span><span class="inv-total-grand">' + formatCurrency(grand) + '</span></div></div>';
  }
  html += '</div>';

  // Validation + Save
  const errors = validateInvoice();
  html += '<div id="invErrorsArea">';
  if (errors.length > 0) {
    html += errors.map(e => '<div class="inv-error">' + escHtml(e) + '</div>').join('');
  }
  html += '</div>';
  html += '<div class="inv-btn-bar inv-save-bar">' +
    '<button class="inv-btn inv-btn-ghost" data-action="invResetForm">Clear</button>' +
    '<button class="inv-btn inv-btn-primary" id="invSaveBtn" data-action="invSaveInvoice"' + (errors.length > 0 ? ' disabled' : '') + '>' +
    (invoiceForm.editingId ? 'Update Invoice' : 'Create Invoice') + '</button></div>';

  area.innerHTML = html;

  // Bind client search
  const cs = document.getElementById('invClientSearch');
  if (cs) {
    cs.addEventListener('input', () => {
      const q = cs.value.toLowerCase();
      if (q.length < 1) { document.getElementById('invClientResults').classList.add('inv-hidden'); return; }
      const matches = S.clients.filter(c => c.isActive && (c.name.toLowerCase().includes(q) || (c.gstin||'').includes(q))).slice(0, 8);
      const res = document.getElementById('invClientResults');
      res.classList.remove('inv-hidden');
      res.className = 'inv-search-results';
      res.innerHTML = matches.map(c => '<div class="inv-search-item" data-action="invSelectClient" data-id="' + c.id + '">' +
        '<div><div class="inv-client-name">' + escHtml(c.name) + '</div>' +
        '<div class="inv-client-meta">' + escHtml(c.gstin || '') + '</div></div></div>').join('');
    });
    setTimeout(() => cs.focus(), 100);
  }
}

function validateInvoice() {
  const errors = [];
  if (!invoiceForm.clientId) errors.push('Select a client');
  if (!invoiceForm.date) errors.push('Enter invoice date');
  if (invoiceForm.items.length === 0) errors.push('Add at least one line item');
  invoiceForm.items.forEach((item, i) => {
    if (item.qty < 0) errors.push('Line ' + (i+1) + ': Quantity cannot be negative');
    if (item.amount < 0) errors.push('Line ' + (i+1) + ': Amount cannot be negative');
  });
  return errors;
}

function selectClient(id) {
  captureOptionalFields();
  invoiceForm.clientId = id;
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
        item.rate = rateInfo.ratePerKg || 0;
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
    const w = (item.qty || 0) * (S.partWeights[pwKey] || 0);
    const rateInfo = getLineItemRate(client, invoiceForm.date, item.partNumber);
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

  if (invoiceForm.editingId) {
    // Update existing
    const inv = S.invoices.find(i => i.id === invoiceForm.editingId);
    if (!inv) return;
    const gstTypeChanged = inv.gstType !== client.gstType;
    Object.assign(inv, {
      date: invoiceForm.date, clientId: client.id, clientName: client.name,
      clientGSTIN: client.gstin, clientAddress: {add1:client.add1,add2:client.add2,add3:client.add3,state:client.state,stateCode:client.stateCode},
      gstType: client.gstType,
      items: invoiceForm.items.map(i => ({partNumber:i.partNumber,desc:i.desc,hsn:i.hsn||'998873',unit:i.unit,qty:i.qty,rate:i.rate,amount:i.amount,nosQty:i.nosQty||null})),
      taxableValue: taxable, cgstPer, cgstAmt, sgstPer, sgstAmt, igstPer, igstAmt,
      grandTotal: grand, amountInWords: numberToWords(grand),
      challanNo: invoiceForm.challanNo, challanDate: invoiceForm.challanDate,
      poNumber: invoiceForm.poNumber, poDate: invoiceForm.poDate,
      despatchDate: invoiceForm.despatchDate, transport: invoiceForm.transport, remarks: invoiceForm.remarks, updatedAt: now
    });
    if (gstTypeChanged) {
      showToast('Invoice updated — GST type changed, verify tax amounts', 'warning');
    } else {
      showToast('Invoice updated');
    }
  } else {
    // New invoice
    const num = String(S.invNextNum).padStart(5, '0');
    const inv = {
      id: 'INV-' + now,
      invoiceNumber: num,
      displayNumber: S.invPrefix + num,
      date: invoiceForm.date,
      status: 'active',
      invoiceState: 'created',
      dispatchedAt: null, deliveredAt: null, filedAt: null,
      clientId: client.id, clientName: client.name,
      clientGSTIN: client.gstin,
      clientAddress: {add1:client.add1,add2:client.add2,add3:client.add3,state:client.state,stateCode:client.stateCode},
      gstType: client.gstType,
      items: invoiceForm.items.map(i => ({partNumber:i.partNumber,desc:i.desc,hsn:i.hsn||'998873',unit:i.unit,qty:i.qty,rate:i.rate,amount:i.amount,nosQty:i.nosQty||null})),
      taxableValue: taxable, cgstPer, cgstAmt, sgstPer, sgstAmt, igstPer, igstAmt,
      grandTotal: grand, amountInWords: numberToWords(grand),
      poNumber: invoiceForm.poNumber, poDate: invoiceForm.poDate, challanNo: invoiceForm.challanNo, challanDate: invoiceForm.challanDate,
      despatchDate: invoiceForm.despatchDate, transport: invoiceForm.transport, eWayBill:'', remarks: invoiceForm.remarks,
      linkedIMIds: invoiceForm._linkedIMIds || [], createdAt: now, updatedAt: now, cancelledAt: null
    };
    S.invoices.push(inv);
    S.invNextNum++;

    // Mark IM items as invoiced
    if (invoiceForm._linkedIMItemIds && invoiceForm._linkedIMItemIds.length > 0) {
      (S.incomingMaterial || []).forEach(function(im) {
        im.items.forEach(function(it) {
          if (invoiceForm._linkedIMItemIds.indexOf(it.id) >= 0) {
            it.invoiced = true;
            it.invoiceId = inv.id;
          }
        });
      });
    }

    showToast('Invoice ' + inv.displayNumber + ' saved');
  }

  // Save vehicle number to client for autocomplete
  saveVehicleToClient(invoiceForm.clientId, invoiceForm.transport);

  saveState();
  const returnDest = _navReturnTab || 'pageHome';
  initCreateForm();
  switchTab(returnDest);
}

