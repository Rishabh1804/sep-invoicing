/* ===== EVENT DELEGATION ===== */
document.addEventListener('click', function(e) {
  // Dismiss client search dropdown when clicking outside it
  const searchRes = document.getElementById('invClientResults');
  if (searchRes && !searchRes.classList.contains('inv-hidden')) {
    const searchWrap = searchRes.closest('.inv-search-wrap');
    if (searchWrap && !searchWrap.contains(e.target)) {
      searchRes.classList.add('inv-hidden');
    }
  }

  // Dismiss part autocomplete when clicking outside
  if (!e.target.closest('.inv-autocomplete-wrap')) {
    dismissAllAutocomplete();
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  switch(action) {
    case 'invSwitchTab': switchTab(btn.dataset.tab); break;
    case 'invCreateNew': initCreateForm(); switchTab('pageCreate'); break;
    case 'invOpenSettings': openSettings(); break;
    case 'invCloseOverlay': closeOverlay(); break;
    case 'invCloseConfirm': closeTopOverlay(); break;
    case 'invEditClient': openClientEdit(parseInt(btn.dataset.id)); break;
    case 'invSaveClient': saveClientEdit(parseInt(btn.dataset.client)); break;
    case 'invAddRate': addClientRate(parseInt(btn.dataset.client)); break;
    case 'invSelectClient': selectClient(parseInt(btn.dataset.id)); break;
    case 'invClearClient': captureOptionalFields(); invoiceForm.clientId = null; renderCreateForm(); break;
    case 'invAddLineItem': captureOptionalFields(); addLineItem(); break;
    case 'invRemoveLineItem': captureOptionalFields(); invoiceForm.items.splice(parseInt(btn.dataset.idx), 1); renderCreateForm(); break;
    case 'invSaveInvoice': saveInvoice(); break;
    case 'invViewInvoice': viewInvoice(btn.dataset.id); break;
    case 'invResetForm': initCreateForm(); break;
    case 'invSaveSettings': saveSettings(); break;
    case 'invExportData': exportData(); break;
    case 'invImportData': importData(); break;
    case 'invAddPartWeight': addPartWeight(); break;
    case 'invDeletePartWeight': deletePartWeight(btn.dataset.part); break;
    case 'invViewInvoiceDetail': openInvoiceDetail(btn.dataset.id); break;
    case 'invEditInvoice': editInvoice(btn.dataset.id); break;
    case 'invCancelInvoice': cancelInvoice(btn.dataset.id); break;
    case 'invConfirmCancel': confirmCancelInvoice(btn.dataset.id); break;
    case 'invDeleteInvoice': deleteInvoice(btn.dataset.id); break;
    case 'invConfirmDelete': confirmDeleteInvoice(btn.dataset.id); break;
    case 'invExportSales': exportSalesCSV(); break;
    case 'invExportGstr1': exportGSTR1CSV(); break;
    case 'invSelectPart': selectPartForLine(parseInt(btn.dataset.idx), parseInt(btn.dataset.partId)); break;
    case 'invFilterRegister': {
      const cf = document.getElementById('regClientFilter');
      const mf = document.getElementById('regMonthFilter');
      const sf = document.getElementById('regStateFilter');
      if (cf) regFilter.clientId = cf.value;
      if (mf) regFilter.month = mf.value;
      if (sf) regFilter.state = sf.value;
      saveRegFilter();
      renderRegisterList();
      break;
    }
    case 'invToggleIM': toggleIMExpand(btn.dataset.id); break;
    case 'invCheckIMItem': toggleIMItem(btn.dataset.itemId); break;
    case 'invCheckIMChallan': toggleIMChallan(btn.dataset.id); break;
    case 'invCreateFromIM': createInvoiceFromIM(); break;
    case 'invFilterIM': {
      const icf = document.getElementById('imClientFilter');
      const isf = document.getElementById('imStatusFilter');
      if (icf) _imFilter.clientId = icf.value;
      if (isf) _imFilter.status = isf.value;
      renderIMList();
      break;
    }
    // Phase 4: Print preview
    case 'invPreviewInvoice': closeOverlay(); showPrintPreview(btn.dataset.id); break;
    case 'invClosePrint': closePrintPreview(); break;
    case 'invPrint': window.print(); break;
    // Phase 4: IM Add Challan
    case 'invShowAddChallan': showAddChallanForm(); break;
    case 'invSaveChallan': saveChallan(); break;
    case 'invCancelChallan': cancelAddChallan(); break;
    case 'invAddChallanLine': captureChallanFields(); addChallanLine(); break;
    case 'invRemoveChallanLine': captureChallanFields(); removeChallanLine(parseInt(btn.dataset.idx)); break;
    case 'invSelectChallanClient': selectChallanClient(parseInt(btn.dataset.id)); break;
    case 'invClearChallanClient': if (_challanForm) { captureChallanFields(); _challanForm.clientId = null; renderAddChallanForm(); } break;
    case 'invSelectChallanPart': {
      if (!_challanForm) break;
      const pidx = parseInt(btn.dataset.idx);
      const part = S.items.find(function(p) { return p.id === parseInt(btn.dataset.partId); });
      if (!part) break;
      const cItem = _challanForm.items[pidx];
      if (!cItem) break;
      cItem.partNumber = part.partNumber;
      cItem.desc = part.desc;
      cItem.hsn = part.hsn || '998873';
      cItem.unit = part.unit || 'KG';
      const cClient = _challanForm.clientId ? S.clients.find(function(c) { return c.id === _challanForm.clientId; }) : null;
      if (cClient) {
        const cRateInfo = getLineItemRate(cClient, _challanForm.challanDate || localDateStr(), cItem.partNumber);
        if (cRateInfo._override) { cItem.rate = cRateInfo.rate; }
        else { cItem.rate = cRateInfo.ratePerKg || 0; }
        recalcChallanLine(cItem, cClient);
      }
      dismissAllAutocomplete();
      captureChallanFields();
      renderAddChallanForm();
      break;
    }
    // Phase 4: IM Delete Challan
    case 'invDeleteChallan': deleteChallan(btn.dataset.id); break;
    // Phase 5: IM Edit Challan
    case 'invEditChallan': editChallan(btn.dataset.id); break;
    case 'invEditChallanGuard': showToast('Cannot edit: ' + btn.dataset.count + ' item' + (parseInt(btn.dataset.count) > 1 ? 's' : '') + ' already invoiced', 'warning'); break;
    // Phase 5: Invoice lifecycle states
    case 'invAdvanceState': advanceInvoiceState(btn.dataset.id); break;
    case 'invBulkMarkFiled': bulkMarkFiled(); break;
    // Phase 5: History filter
    case 'invFilterHistory': {
      var hcf = document.getElementById('historyClientFilter');
      if (hcf) _historyClientFilter = hcf.value;
      renderHistory();
      break;
    }
    // Phase 4: Challan Scanner
    case 'invScanChallan': scanChallan(); break;
    case 'invToggleApiKey': {
      var akEl = document.getElementById('setApiKey');
      if (akEl) akEl.type = akEl.type === 'password' ? 'text' : 'password';
      break;
    }
    // Phase 6: Items Master
    case 'invSwitchSubView': setItemsSubView(btn.dataset.view); renderClientsPage(); break;
    case 'invEditItem': openItemEdit(parseInt(btn.dataset.id)); break;
    case 'invAddItem': openItemAdd(); break;
    case 'invSaveItem': saveItem(parseInt(btn.dataset.id), btn.dataset.mode); break;
    case 'invDeleteItem': deleteItem(parseInt(btn.dataset.id)); break;
    case 'invOpenMergeTool': openMergeTool(); break;
    case 'invMergeGroup': mergeGroup(parseInt(btn.dataset.group)); break;
    case 'invMergeConfirm': confirmMerge(parseInt(btn.dataset.group), parseInt(btn.dataset.primary)); break;
    case 'invMergeCancelPreview': cancelMergePreview(parseInt(btn.dataset.group)); break;
    case 'invCalcWeights': calculateStdWeights(); break;
    case 'invFilterNoWeight': {
      var curFilter = getItemsFilter();
      regFilter.itemsFilter = curFilter === 'no-weight' ? 'all' : 'no-weight';
      saveRegFilter();
      _itemsRendered = 0;
      renderClientsPage();
      break;
    }
    case 'invFilterUnused': {
      var curFilter2 = getItemsFilter();
      regFilter.itemsFilter = curFilter2 === 'unused' ? 'all' : 'unused';
      saveRegFilter();
      _itemsRendered = 0;
      renderClientsPage();
      break;
    }
    case 'invSelectAllUnused': selectAllUnused(); break;
    case 'invToggleItemSelect': e.stopPropagation(); toggleItemSelect(parseInt(btn.dataset.id)); break;
    case 'invClearItemSelection': clearItemSelection(); break;
    case 'invBatchDeleteItems': batchDeleteItems(); break;
    case 'invLoadMoreItems': _renderItemsList(); break;
    case 'invItemsSort': {
      var sortEl = document.getElementById('itemsSort');
      if (sortEl) { regFilter.itemsSort = sortEl.value; saveRegFilter(); _itemsRendered = 0; _renderItemsList(); }
      break;
    }
    // Phase 6b: Register bulk operations
    case 'invRegToggleSort': toggleRegSortDir(); break;
    case 'invRegToggleSelect': toggleRegSelectMode(); break;
    case 'invRegToggleInv': e.stopPropagation(); toggleRegInv(btn.dataset.id); break;
    case 'invRegBulkState': regBulkSetState(btn.dataset.state); break;
  }
});

/* Capture optional fields from DOM into invoiceForm before any re-render */
function captureOptionalFields() {
  const cn = document.getElementById('invChallanNo');
  const cd = document.getElementById('invChallanDate');
  const rm = document.getElementById('invRemarks');
  const tr = document.getElementById('invTransport');
  const po = document.getElementById('invPONumber');
  const pd = document.getElementById('invPODate');
  const dd = document.getElementById('invDespatchDate');
  const dt = document.getElementById('invDate');
  if (cn) invoiceForm.challanNo = cn.value;
  if (cd) invoiceForm.challanDate = cd.value;
  if (rm) invoiceForm.remarks = rm.value;
  if (tr) invoiceForm.transport = tr.value;
  if (po) invoiceForm.poNumber = po.value;
  if (pd) invoiceForm.poDate = pd.value;
  if (dd) invoiceForm.despatchDate = dd.value;
  if (dt) invoiceForm.date = dt.value;
}

/* Update totals section only (no full re-render) */
function updateTotalsDisplay() {
  const container = document.getElementById('invTotalsArea');
  if (!container) return;
  const client = invoiceForm.clientId ? S.clients.find(c => c.id === invoiceForm.clientId) : null;
  if (invoiceForm.items.length === 0) { container.innerHTML = ''; return; }
  const taxable = gstRound(invoiceForm.items.reduce((s,i) => s + (i.amount || 0), 0));
  const gstType = client ? client.gstType : 'intra';
  const cgst = gstType === 'intra' ? gstRound(taxable * 9 / 100) : 0;
  const sgst = gstType === 'intra' ? gstRound(taxable * 9 / 100) : 0;
  const igst = gstType === 'inter' ? gstRound(taxable * 18 / 100) : 0;
  const grand = gstRound(taxable + cgst + sgst + igst);
  let h = '<div class="inv-totals"><div class="inv-total-row"><span class="inv-total-label">Taxable Value</span><span class="inv-total-value">' + formatCurrency(taxable) + '</span></div>';
  if (gstType === 'intra') {
    h += '<div class="inv-total-row"><span class="inv-total-label">CGST @ 9%</span><span class="inv-total-value">' + formatCurrency(cgst) + '</span></div>' +
      '<div class="inv-total-row"><span class="inv-total-label">SGST @ 9%</span><span class="inv-total-value">' + formatCurrency(sgst) + '</span></div>';
  } else {
    h += '<div class="inv-total-row"><span class="inv-total-label">IGST @ 18%</span><span class="inv-total-value">' + formatCurrency(igst) + '</span></div>';
  }
  h += '<div class="inv-total-row inv-total-row-grand"><span class="inv-total-label">Grand Total</span><span class="inv-total-grand">' + formatCurrency(grand) + '</span></div></div>';
  container.innerHTML = h;
  // Update validation state
  const errors = validateInvoice();
  const errArea = document.getElementById('invErrorsArea');
  if (errArea) errArea.innerHTML = errors.length > 0 ? errors.map(e => '<div class="inv-error">' + escHtml(e) + '</div>').join('') : '';
  const saveBtn = document.getElementById('invSaveBtn');
  if (saveBtn) saveBtn.disabled = errors.length > 0;
}

document.addEventListener('change', function(e) {
  const el = e.target.closest('[data-action="invUpdateLine"]');
  if (el) {
    const idx = parseInt(el.dataset.idx);
    const field = el.dataset.field;
    const item = invoiceForm.items[idx];
    if (!item) return;
    const client = invoiceForm.clientId ? S.clients.find(c => c.id === invoiceForm.clientId) : null;
    if (field === 'unit') {
      item.unit = el.value;
      // Piece mode: switching to NOS means amount is user-entered, rate is back-calculated
      if (client && client.billingMode === 'piece' && el.value === 'NOS') {
        item.rate = 0;
        item.amount = 0;
      }
      recalcLineItem(item, client);
      captureOptionalFields();
      renderCreateForm();
    }
  }
  if (e.target.id === 'invDate') {
    invoiceForm.date = e.target.value;
  }
  // Register filters
  if (e.target.id === 'regClientFilter' || e.target.id === 'regMonthFilter' || e.target.id === 'regStateFilter') {
    const cf = document.getElementById('regClientFilter');
    const mf = document.getElementById('regMonthFilter');
    const sf = document.getElementById('regStateFilter');
    if (cf) regFilter.clientId = cf.value;
    if (mf) regFilter.month = mf.value;
    if (sf) regFilter.state = sf.value;
    saveRegFilter();
    renderRegisterList();
  }
  // IM filters
  if (e.target.id === 'imClientFilter' || e.target.id === 'imStatusFilter') {
    const icf = document.getElementById('imClientFilter');
    const isf = document.getElementById('imStatusFilter');
    if (icf) _imFilter.clientId = icf.value;
    if (isf) _imFilter.status = isf.value;
    renderIMList();
  }
  // Phase 6: Items sort
  if (e.target.id === 'itemsSort') {
    regFilter.itemsSort = e.target.value;
    saveRegFilter();
    _itemsRendered = 0;
    _renderItemsList();
  }
  // Phase 5: History filter change
  if (e.target.id === 'historyClientFilter') {
    _historyClientFilter = e.target.value;
    renderHistory();
  }
  // Phase 4: IM challan line unit change
  const challanLineEl = e.target.closest('[data-action="invUpdateChallanLine"]');
  if (challanLineEl && challanLineEl.dataset.field === 'unit' && _challanForm) {
    const cidx = parseInt(challanLineEl.dataset.idx);
    const citem = _challanForm.items[cidx];
    if (citem) {
      citem.unit = challanLineEl.value;
      var cclient = _challanForm.clientId ? S.clients.find(function(c) { return c.id === _challanForm.clientId; }) : null;
      if (cclient && cclient.billingMode === 'piece' && challanLineEl.value === 'NOS') {
        citem.rate = 0; citem.amount = 0;
      }
      recalcChallanLine(citem, cclient);
      captureChallanFields();
      renderAddChallanForm();
    }
  }
});

document.addEventListener('input', function(e) {
  if (e.target.id === 'clientSearch') {
    renderClientList(e.target.value);
  }
  // Part name editing + autocomplete
  if (e.target.dataset.action === 'invEditLinePart') {
    const idx = parseInt(e.target.dataset.idx);
    const item = invoiceForm.items[idx];
    if (item) {
      item.desc = e.target.value;
      item.partNumber = e.target.value;

      // Show part autocomplete dropdown
      showPartAutocomplete(idx, e.target.value);

      // Recalc for nos_to_weight: part name change affects weight lookup
      const client = invoiceForm.clientId ? S.clients.find(c => c.id === invoiceForm.clientId) : null;
      if (client && client.billingMode === 'nos_to_weight' && item.unit === 'NOS' && item.qty > 0) {
        recalcLineItem(item, client);
        const amtInput = document.querySelector('[data-field="amount"][data-idx="' + idx + '"]');
        if (amtInput) amtInput.value = formatNum(item.amount);
        updateTotalsDisplay();
      }
      // Also check itemRates override
      if (client && client.itemRates && client.itemRates.length > 0) {
        const rateInfo = getLineItemRate(client, invoiceForm.date, item.partNumber);
        if (rateInfo._override) {
          item.rate = rateInfo.rate;
          item._override = true;
          item._label = rateInfo._label;
          recalcLineItem(item, client);
          const rateInput = document.querySelector('[data-field="rate"][data-idx="' + idx + '"]');
          const amtInput = document.querySelector('[data-field="amount"][data-idx="' + idx + '"]');
          if (rateInput) rateInput.value = formatNum(item.rate);
          if (amtInput) amtInput.value = formatNum(item.amount);
          updateTotalsDisplay();
        }
      }
    }
    return;
  }
  // Phase 4: IM challan part editing + autocomplete
  if (e.target.dataset.action === 'invEditChallanPart' && _challanForm) {
    var cidx = parseInt(e.target.dataset.idx);
    var citem = _challanForm.items[cidx];
    if (citem) {
      citem.desc = e.target.value;
      citem.partNumber = e.target.value;
      // Show part autocomplete
      var acEl = document.getElementById('imPartAC' + cidx);
      if (acEl) {
        var matches = searchParts(e.target.value);
        if (matches.length === 0) { acEl.classList.add('inv-hidden'); }
        else {
          acEl.classList.remove('inv-hidden');
          acEl.innerHTML = matches.map(function(m) {
            return '<div class="inv-autocomplete-item" data-action="invSelectChallanPart" data-idx="' + cidx + '" data-part-id="' + m.id + '">' +
              '<span class="inv-autocomplete-part">' + escHtml(m.partNumber) + '</span>' +
              '<span class="inv-autocomplete-desc">' + escHtml(m.desc) + '</span></div>';
          }).join('');
        }
      }
      // Auto-fill rate from client rate card
      var cclient = _challanForm.clientId ? S.clients.find(function(c) { return c.id === _challanForm.clientId; }) : null;
      if (cclient && cclient.itemRates && cclient.itemRates.length > 0) {
        var rateInfo = getLineItemRate(cclient, _challanForm.challanDate || localDateStr(), citem.partNumber);
        if (rateInfo._override) {
          citem.rate = rateInfo.rate;
          recalcChallanLine(citem, cclient);
          var rI = document.querySelector('[data-action="invUpdateChallanLine"][data-field="rate"][data-idx="' + cidx + '"]');
          var aI = document.querySelector('[data-action="invUpdateChallanLine"][data-field="amount"][data-idx="' + cidx + '"]');
          if (rI) rI.value = formatNum(citem.rate);
          if (aI) aI.value = formatNum(citem.amount);
        }
      }
    }
    return;
  }
  // Phase 4: IM challan numeric field input
  var challanLineInput = e.target.closest('[data-action="invUpdateChallanLine"]');
  if (challanLineInput && _challanForm && (challanLineInput.dataset.field === 'qty' || challanLineInput.dataset.field === 'rate' || challanLineInput.dataset.field === 'amount' || challanLineInput.dataset.field === 'nosQty')) {
    var cidx2 = parseInt(challanLineInput.dataset.idx);
    var citem2 = _challanForm.items[cidx2];
    if (citem2) {
      // nosQty is integer, others are float
      if (challanLineInput.dataset.field === 'nosQty') {
        citem2.nosQty = parseInt(challanLineInput.value) || null;
        return;
      }
      var cclient2 = _challanForm.clientId ? S.clients.find(function(c) { return c.id === _challanForm.clientId; }) : null;
      citem2[challanLineInput.dataset.field] = parseFloat(challanLineInput.value) || 0;
      if (cclient2 && cclient2.billingMode === 'piece' && citem2.unit === 'NOS') {
        if (challanLineInput.dataset.field === 'amount' || challanLineInput.dataset.field === 'qty') {
          if (citem2.qty > 0 && citem2.amount > 0) {
            citem2.rate = gstRound(citem2.amount / citem2.qty);
            var rI2 = document.querySelector('[data-action="invUpdateChallanLine"][data-field="rate"][data-idx="' + cidx2 + '"]');
            if (rI2) rI2.value = formatNum(citem2.rate);
          }
        }
      } else {
        if (challanLineInput.dataset.field !== 'amount') {
          recalcChallanLine(citem2, cclient2);
          var aI2 = document.querySelector('[data-action="invUpdateChallanLine"][data-field="amount"][data-idx="' + cidx2 + '"]');
          if (aI2) aI2.value = formatNum(citem2.amount);
        }
      }
    }
    return;
  }
  // Numeric line item fields — update model + totals only, no full re-render
  const el = e.target.closest('[data-action="invUpdateLine"]');
  if (el && (el.dataset.field === 'qty' || el.dataset.field === 'rate' || el.dataset.field === 'amount')) {
    const idx = parseInt(el.dataset.idx);
    const item = invoiceForm.items[idx];
    if (!item) return;
    const client = invoiceForm.clientId ? S.clients.find(c => c.id === invoiceForm.clientId) : null;
    item[el.dataset.field] = parseFloat(el.value) || 0;

    if (client && client.billingMode === 'piece' && item.unit === 'NOS') {
      // Piece mode NOS: amount is user-entered, rate is back-calculated
      if (el.dataset.field === 'amount' || el.dataset.field === 'qty') {
        if (item.qty > 0 && item.amount > 0) {
          item.rate = gstRound(item.amount / item.qty);
          const rateInput = document.querySelector('[data-field="rate"][data-idx="' + idx + '"]');
          if (rateInput) rateInput.value = formatNum(item.rate);
        }
      }
    } else {
      // All other modes: amount = qty * rate
      if (el.dataset.field !== 'amount') {
        recalcLineItem(item, client);
        const amtInput = document.querySelector('[data-field="amount"][data-idx="' + idx + '"]');
        if (amtInput) amtInput.value = formatNum(item.amount);
      }
    }
    // Update totals without full DOM replacement
    updateTotalsDisplay();
  }
});

/* ESC key dismisses autocomplete, Enter moves to next field */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    dismissAllAutocomplete();
    var searchRes = document.getElementById('invClientResults');
    if (searchRes) searchRes.classList.add('inv-hidden');
    var imSearchRes = document.getElementById('imChallanClientResults');
    if (imSearchRes) imSearchRes.classList.add('inv-hidden');
  }
  // Enter key: move to next focusable field (skip readonly, skip buttons unless submit)
  if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
    // Don't interfere with autocomplete selection
    if (e.target.closest('.inv-autocomplete-wrap')) {
      var acList = e.target.closest('.inv-autocomplete-wrap').querySelector('.inv-autocomplete-list');
      if (acList && !acList.classList.contains('inv-hidden')) return;
    }
    e.preventDefault();
    // Find all focusable fields in the current page/form
    var container = e.target.closest('.inv-page-active, .inv-im-form-active, .inv-overlay-card');
    if (!container) container = document.body;
    var focusable = Array.from(container.querySelectorAll('input:not([readonly]):not([type="hidden"]):not(.inv-hidden), select:not(.inv-hidden), textarea:not(.inv-hidden)'));
    var curIdx = focusable.indexOf(e.target);
    if (curIdx >= 0 && curIdx < focusable.length - 1) {
      focusable[curIdx + 1].focus();
      if (focusable[curIdx + 1].type === 'number' || focusable[curIdx + 1].type === 'text') {
        focusable[curIdx + 1].select();
      }
    }
  }
});

/* Blur on part input dismisses autocomplete (with delay for click) */
document.addEventListener('focusout', function(e) {
  if (e.target.dataset && (e.target.dataset.action === 'invEditLinePart' || e.target.dataset.action === 'invEditChallanPart')) {
    setTimeout(dismissAllAutocomplete, 200);
  }
});

