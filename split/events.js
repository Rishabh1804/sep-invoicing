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
    case 'invAddClient': openClientAdd(); break;
    case 'invSaveClient': saveClientEdit(parseInt(btn.dataset.client), btn.dataset.mode); break;
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
    case 'invRegClearRange': {
      regFilter.dateFrom = ''; regFilter.dateTo = '';
      saveRegFilter();
      captureRegFilters();
      break;
    }
    case 'invRegSelectAll': toggleRegSelectAll(); break;
    // Staff & attendance
    case 'invAttView': attSetView(btn.dataset.view); break;
    case 'invAreaSpan': setAreaSpan(btn.dataset.span); break;
    case 'invAttStep': attStepDay(parseInt(btn.dataset.step, 10)); break;
    case 'invAttToday': attGoToday(); break;
    case 'invAttWeekStep': attStepWeek(parseInt(btn.dataset.step, 10)); break;
    case 'invAttThisWeek': attThisWeek(); break;
    case 'invAttSet': setAttState(parseInt(btn.dataset.id, 10), btn.dataset.st); break;
    case 'invAttCycle': cycleAttState(parseInt(btn.dataset.id, 10), btn.dataset.date); break;
    case 'invAttAllPresent': attAllPresent(); break;
    case 'invAttAddExtra': attAddExtra(); break;
    case 'invAttRemoveExtra': attRemoveExtra(parseInt(btn.dataset.idx, 10)); break;
    case 'invAreaExplain': openAreaExplain(btn.dataset.ex); break;
    case 'invAreaExplainSave': saveAreaExplain(); break;
    case 'invAreaUnexplain': reopenAreaExplain(btn.dataset.key); break;
    case 'invAttBlockArea':
      toggleAttBlockArea(parseInt(btn.dataset.idx, 10), btn.dataset.area);
      renderAttendance();
      break;
    case 'invAttBlockCrew':
      toggleAttBlockCrew(parseInt(btn.dataset.idx, 10), btn.dataset.worker);
      renderAttendance();
      break;
    case 'invAttAddWorker': openWorkerAdd(); break;
    case 'invAttImportRoster': importRoster(); break;
    case 'invAttEditWorker': openWorkerEdit(parseInt(btn.dataset.id, 10)); break;
    case 'invAttSaveWorker': saveWorker(parseInt(btn.dataset.id, 10), btn.dataset.mode); break;
    case 'invAttDeleteWorker': deleteWorker(parseInt(btn.dataset.id, 10)); break;
    // Credit notes
    case 'invRegCreditNote': openCreditNoteForm(_regSelectedIds()); break;
    case 'invCnSave': saveCreditNote(); break;
    case 'invCnList': renderCreditNoteList(); break;
    case 'invCnPreview': closeOverlay(); showCreditNotePreview(btn.dataset.id); break;
    case 'invCnCancel': e.stopPropagation(); cancelCreditNote(btn.dataset.id); break;
    case 'invExportCreditNotes': exportCreditNotesCSV(); break;
    case 'invToggleIM': toggleIMExpand(btn.dataset.id); break;
    case 'invCheckIMItem': toggleIMItem(btn.dataset.itemId); break;
    case 'invCheckIMChallan': toggleIMChallan(btn.dataset.id); break;
    case 'invCreateFromIM': createInvoiceFromIM(); break;
    case 'invFilterIM': captureIMFilters(); break;
    // Phase 4: Print preview
    case 'invPreviewInvoice': closeOverlay(); showPrintPreview(btn.dataset.id); break;
    case 'invClosePrint': closePrintPreview(); break;
    case 'invPrint': window.print(); break;
    // Quality certificate — one page per invoice line, single or bulk
    case 'invQualityCert': closeOverlay(); showQualityCertificates([btn.dataset.id]); break;
    case 'invRegQualityCerts': showQualityCertificates(_regSelectedIds()); break;
    // Phase 4: IM Add Challan
    case 'invShowAddChallan': showAddChallanForm(); break;
    case 'invSaveChallan': saveChallan(); break;
    case 'invCancelChallan': cancelAddChallan(); break;
    case 'invAddChallanLine': captureChallanFields(); addChallanLine(); break;
    case 'invRemoveChallanLine': captureChallanFields(); removeChallanLine(parseInt(btn.dataset.idx)); break;
    case 'invSelectChallanClient': selectChallanClient(parseInt(btn.dataset.id)); break;
    case 'invClearChallanClient': if (_challanForm) { captureChallanFields(); _challanForm.clientId = null; renderAddChallanForm(); } break;
    case 'invSelectChallanPart':
      selectChallanPartForLine(parseInt(btn.dataset.idx), parseInt(btn.dataset.partId));
      break;
    // Create a missing part without leaving the line being typed
    case 'invAddItemInline':
      openInlineItemAdd(btn.dataset.kind, parseInt(btn.dataset.idx), btn.dataset.q || '');
      break;
    // Phase 4: IM Delete Challan
    case 'invDeleteChallan': deleteChallan(btn.dataset.id); break;
    // Phase 5: IM Edit Challan
    case 'invEditChallan': editChallan(btn.dataset.id); break;
    case 'invEditChallanGuard': showToast('Cannot edit: ' + btn.dataset.count + ' item' + (parseInt(btn.dataset.count) > 1 ? 's' : '') + ' already invoiced', 'warning'); break;
    // Invoice number ledger
    case 'invShowNumberAudit': showNumberAudit(); break;
    case 'invAccountForNumber': openAccountForNumber(btn.dataset.num); break;
    case 'invSaveGapReason': saveGapReason(); break;
    // IM duplicate guard
    case 'invRunDupeScan': runIMDuplicateScan(); break;
    case 'invDupeSaveAnyway': acceptChallanDuplicates(); break;
    case 'invDupeLocate': imLocateChallan(btn.dataset.id); break;
    // Phase 5: Invoice lifecycle states
    case 'invAdvanceState': advanceInvoiceState(btn.dataset.id); break;
    case 'invBulkMarkFiled': bulkMarkFiled(); break;
    // Phase 7: Stats period chips
    case 'invStatsPeriod': _statsPeriod = btn.dataset.period; renderStats(); break;
    // P9: Trend granularity chips (day/week/month)
    case 'invStatsTrendGran': _statsTrendGran = btn.dataset.gran; renderStats(); break;
    // Chart controls: what the trend plots, how it is drawn, and how the
    // composition and top-item cards are ranked
    case 'invStatsTrendSeries': _statsTrendSeries = btn.dataset.series; renderStats(); break;
    case 'invStatsTrendType': _statsTrendType = btn.dataset.type; renderStats(); break;
    case 'invStatsClientChart': _statsClientChart = btn.dataset.chart; renderStats(); break;
    case 'invStatsTopBy': _statsTopBy = btn.dataset.by; renderStats(); break;
    // Client performance sub-view
    case 'invPerfSeries': _cpSeries = btn.dataset.series; renderClientsPage(); break;
    // Phase 7: Client drill-down overlay
    case 'invStatsClientDrill': openClientDrillOverlay(btn.dataset.clientId); break;
    // Phase 7: Flippable card
    case 'invFlipCard': {
      var inner = document.querySelector('.inv-flip-inner');
      if (!inner) break;
      var front = inner.querySelector('.inv-flip-front');
      var back = inner.querySelector('.inv-flip-back');
      if (!front || !back) break;
      var showingFront = !front.classList.contains('inv-flip-hidden');
      var outFace = showingFront ? front : back;
      var inFace = showingFront ? back : front;
      outFace.classList.add('inv-flip-out');
      setTimeout(function() {
        outFace.classList.remove('inv-flip-out');
        outFace.classList.add('inv-flip-hidden');
        outFace.classList.remove('inv-flip-visible');
        inFace.classList.remove('inv-flip-hidden');
        inFace.classList.add('inv-flip-visible', 'inv-flip-in');
        setTimeout(function() { inFace.classList.remove('inv-flip-in'); }, 250);
      }, 250);
      break;
    }
    // Phase 7: Stats actions
    case 'invStatsCreateInvoice': {
      closeOverlay();
      _preselectedClientId = btn.dataset.clientId;
      switchTab('pageCreate');
      break;
    }
    case 'invStatsJumpRegister': {
      closeOverlay();
      regFilter.clientId = btn.dataset.clientId;
      regFilter.search = '';
      regFilter.state = '';
      saveRegFilter();
      _tabDirty.register = true;
      _regToolbarRendered = false;
      switchTab('pageRegister');
      break;
    }
    case 'invStatsJumpIM': {
      closeOverlay();
      _imFilter.clientId = btn.dataset.clientId;
      _imToolbarRendered = false;
      switchTab('pageIM');
      break;
    }
    // Phase 7: History navigation
    case 'invHistoryJumpInvoice': {
      var inv = S.invoices.find(function(i) { return i.id === btn.dataset.id; });
      if (!inv) { showToast('Invoice not found', 'warning'); break; }
      regFilter.clientId = '';
      regFilter.search = inv.displayNumber || '';
      regFilter.state = '';
      saveRegFilter();
      _tabDirty.register = true;
      _regToolbarRendered = false;
      switchTab('pageRegister');
      break;
    }
    case 'invHistoryJumpChallan': {
      var imId = btn.dataset.id;
      var im = (S.incomingMaterial || []).find(function(c) { return c.id === imId; });
      if (!im) { showToast('Challan not found', 'warning'); break; }
      _imFilter.clientId = String(im.clientId);
      _imToolbarRendered = false;
      switchTab('pageIM');
      setTimeout(function() {
        var hdr = document.querySelector('[data-action="invToggleIM"][data-id="' + imId + '"]');
        var card = hdr ? hdr.closest('.inv-im-challan') : null;
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      break;
    }
    // Phase 7: History load more
    case 'invHistoryLoadMore': _historyShowCount += 50; renderHistory(); break;
    case 'invHistoryType': _historyType = btn.dataset.type; _historyShowCount = 50; renderHistory(); break;
    case 'invHistoryExport': exportHistoryCSV(); break;
    // Phase 4: Challan Scanner
    case 'invScanChallan': scanChallan(); break;
    case 'invToggleApiKey': {
      var akEl = document.getElementById('setApiKey');
      if (akEl) akEl.type = akEl.type === 'password' ? 'text' : 'password';
      break;
    }
    case 'invToggleMetalsKey': {
      var mkEl = document.getElementById('setMetalsKey');
      if (mkEl) mkEl.type = mkEl.type === 'password' ? 'text' : 'password';
      break;
    }
    case 'invRefreshZinc': refreshZincRate(); break;
    // GitHub sync
    case 'invGhPush': ghPush(); break;
    case 'invGhPull': ghPull(); break;
    case 'invToggleGhToken': {
      var gtEl = document.getElementById('setGhToken');
      if (gtEl) gtEl.type = gtEl.type === 'password' ? 'text' : 'password';
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
    case 'invOpenWeightEntry': openWeightEntry(); break;
    case 'invSaveWeights': saveWeights(); break;
    case 'invDeriveWeights': deriveWeightsFromRates(); break;
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
    // Phase 8E: Clients/Items desktop row selection
    case 'invSelectClientRow': _renderClientDetail(parseInt(btn.dataset.id)); break;
    case 'invSelectItemRow': _renderItemDetail(parseInt(btn.dataset.id)); break;
    // Phase 6b: Register bulk operations
    case 'invRegToggleSort': toggleRegSortDir(); break;
    case 'invRegToggleSelect': toggleRegSelectMode(); break;
    case 'invRegToggleInv': e.stopPropagation(); toggleRegInv(btn.dataset.id); break;
    case 'invRegBulkState': regBulkSetState(btn.dataset.state); break;
    // Phase 8C: Desktop table interactions
    case 'invSelectRegRow': _renderRegDetail(btn.dataset.id); break;
    case 'invDesktopSort': {
      if (!regFilter.desktopSort) regFilter.desktopSort = { col: 'date', dir: 'desc' };
      if (regFilter.desktopSort.col === btn.dataset.col) {
        regFilter.desktopSort.dir = regFilter.desktopSort.dir === 'desc' ? 'asc' : 'desc';
      } else {
        regFilter.desktopSort = { col: btn.dataset.col, dir: 'desc' };
      }
      saveRegFilter();
      _renderRegView();
      break;
    }
    // Phase 8D: IM desktop table interactions
    case 'invSelectIMRow': _renderIMDetail(btn.dataset.id); break;
    case 'invDesktopIMSort': {
      if (!_imFilter.desktopSort) _imFilter.desktopSort = { col: 'date', dir: 'desc' };
      if (_imFilter.desktopSort.col === btn.dataset.col) {
        _imFilter.desktopSort.dir = _imFilter.desktopSort.dir === 'desc' ? 'asc' : 'desc';
      } else {
        _imFilter.desktopSort = { col: btn.dataset.col, dir: 'desc' };
      }
      _renderIMView();
      break;
    }
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
  // Register filters — one capture path, so a new filter control cannot end up
  // wired to the click delegate and not to this one.
  if (e.target.id === 'regClientFilter' || e.target.id === 'regMonthFilter' ||
      e.target.id === 'regStateFilter' || e.target.id === 'regDateFrom' || e.target.id === 'regDateTo') {
    captureRegFilters(e.target.id);
  }
  // IM filters
  if (e.target.id === 'imClientFilter' || e.target.id === 'imStatusFilter') {
    captureIMFilters();
  }
  // Attendance. A <select> speaks through change, never click — and the date
  // input re-renders because the date is what the whole view is showing.
  if (e.target.id === 'attDate') {
    attSetDate(e.target.value);
    return;
  }
  // Area decides whether those hours are plating cost or overhead, so the
  // breakdown below has to move with it. Safe on `change` — the native picker
  // has already closed by the time this fires; it is `click` that would shut it.
  if (e.target.hasAttribute && e.target.hasAttribute('data-att-area')) {
    setAttArea(parseInt(e.target.dataset.id, 10), e.target.value);
    renderAttendance();
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-att-extra-area')) {
    setAttExtraArea(parseInt(e.target.dataset.idx, 10), e.target.value);
    renderAttendance();
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-att-extra-kind')) {
    setAttExtraKind(parseInt(e.target.dataset.idx, 10), e.target.value);
    renderAttendance();
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-att-block-from')) {
    setAttBlockTime(parseInt(e.target.dataset.idx, 10), 'from', e.target.value);
    renderAttendance();
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-att-block-to')) {
    setAttBlockTime(parseInt(e.target.dataset.idx, 10), 'to', e.target.value);
    renderAttendance();
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-att-ot')) {
    setAttOt(parseInt(e.target.dataset.id, 10), e.target.value);
    renderAttendance();
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-att-hours')) {
    setAttHours(parseInt(e.target.dataset.id, 10), e.target.value);
    renderAttendance();
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-area-target')) {
    setAreaTarget(e.target.dataset.area, e.target.value);
    renderAttendance();
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-att-extra-hours')) {
    setAttExtraHours(parseInt(e.target.dataset.idx, 10), e.target.value);
    renderAttendance();
    return;
  }
  // Client performance: which account is under the lens
  if (e.target.id === 'cpClientSelect') {
    setPerfClientId(e.target.value);
    renderClientsPage();
    return;
  }
  // Phase 6: Items sort
  if (e.target.id === 'itemsSort') {
    regFilter.itemsSort = e.target.value;
    saveRegFilter();
    _itemsRendered = 0;
    _renderItemsList();
  }
  // Phase 7: History filter changes (client + date range)
  if (e.target.id === 'historyClientFilter') {
    _historyClientFilter = e.target.value;
    _historyShowCount = 50;
    renderHistory();
  }
  if (e.target.id === 'historyDateFrom') {
    _historyDateFrom = e.target.value;
    _historyShowCount = 50;
    renderHistory();
  }
  if (e.target.id === 'historyDateTo') {
    _historyDateTo = e.target.value;
    _historyShowCount = 50;
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
  // Attendance hours. Written on every keystroke so nothing is lost, but never
  // re-rendered here: replacing the field mid-entry is what ended the keyboard
  // path in challan entry, and a number input is the same trap.
  if (e.target.hasAttribute && e.target.hasAttribute('data-att-ot')) {
    setAttOt(parseInt(e.target.dataset.id, 10), e.target.value);
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-att-hours')) {
    setAttHours(parseInt(e.target.dataset.id, 10), e.target.value);
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-area-target')) {
    setAreaTarget(e.target.dataset.area, e.target.value);
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-att-extra-hours')) {
    setAttExtraHours(parseInt(e.target.dataset.idx, 10), e.target.value);
    return;
  }
  // History search. Debounced so a long log is not rebuilt per keystroke, and
  // focus is restored because renderHistory replaces the input it lives in.
  if (e.target.id === 'historySearch') {
    _historySearch = e.target.value.trim();
    clearTimeout(_historySearchTimer);
    _historySearchTimer = setTimeout(function() {
      var caret = null;
      var el = document.getElementById('historySearch');
      if (el) { try { caret = el.selectionStart; } catch (err) { caret = null; } }
      _historyShowCount = 50;
      renderHistory();
      var restored = document.getElementById('historySearch');
      if (restored) {
        restored.focus();
        if (caret != null && restored.setSelectionRange) restored.setSelectionRange(caret, caret);
      }
    }, 250);
    return;
  }
  // Credit note form: the totals restate as the discount is typed, so the
  // figure being committed is the one on screen. Focus is preserved because
  // the caret position is restored across the re-render.
  if (e.target.dataset.action === 'invCnInput') {
    captureCnForm();
    // Only the discount moves the totals. The date and the vehicle number do
    // not, and re-rendering for them replaced the control being used — which
    // on a date input means tearing the native picker out mid-choice.
    if (e.target.id !== 'cnPct') return;
    var cnId = e.target.id, cnCaret = null;
    try { cnCaret = e.target.selectionStart; } catch (err) { cnCaret = null; }
    renderCreditNoteForm();
    var back = document.getElementById(cnId);
    if (back) {
      back.focus();
      if (cnCaret != null && back.setSelectionRange) {
        try { back.setSelectionRange(cnCaret, cnCaret); } catch (err) {}
      }
    }
    return;
  }
  // Bulk weight entry: price the part as soon as a weight is typed
  if (e.target.dataset.action === 'invWeightInput') {
    updateWeightVerdict(e.target);
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
      showChallanPartAutocomplete(cidx, e.target.value);
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

/* Keyboard: suggestion lists, Enter-to-next-field, and challan form shortcuts */
document.addEventListener('keydown', function(e) {
  // 1. An open suggestion list owns the arrow keys and Enter. Without this the
  //    list could only be committed with a pointer — Enter used to return
  //    early here and do nothing at all, which is what stranded the keyboard.
  var openList = e.target.tagName === 'INPUT' ? acListFor(e.target) : null;
  if (openList) {
    if (e.key === 'ArrowDown') { e.preventDefault(); acMoveCursor(openList, 1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); acMoveCursor(openList, -1); return; }
    // Ctrl/Cmd+Enter is "save the challan" and must not be swallowed as a
    // suggestion pick just because a list happens to be open.
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      var pending = acPendingOption(openList);
      if (pending) {
        e.preventDefault();
        acReset();
        // Routed through the same click delegate the pointer path uses, so
        // there is exactly one selection code path to keep correct.
        pending.click();
        return;
      }
    }
  }

  if (e.key === 'Escape') {
    dismissAllAutocomplete();
    var searchRes = document.getElementById('invClientResults');
    if (searchRes) searchRes.classList.add('inv-hidden');
    var imSearchRes = document.getElementById('imChallanClientResults');
    if (imSearchRes) imSearchRes.classList.add('inv-hidden');
    return;
  }

  // 2. Challan form shortcuts, scoped to the form so they cannot fire elsewhere.
  var challanArea = document.getElementById('imAddForm');
  if (_challanForm && challanArea && challanArea.contains(e.target)) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveChallan();
      return;
    }
    if (e.altKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      captureChallanFields();
      addChallanLine();
      return;
    }
  }

  // 3. Enter moves to the next field. Buttons carrying data-kbd-ring join the
  //    chain so the last field of a form steps onto its primary action rather
  //    than dead-ending; unmarked buttons (a line's remove ×) stay out of it,
  //    where a stray Enter would be destructive.
  if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
    e.preventDefault();
    var container = e.target.closest('.inv-page-active, .inv-im-form-active, .inv-overlay-card');
    if (!container) container = document.body;
    var focusable = Array.from(container.querySelectorAll(
      'input:not([readonly]):not([type="hidden"]):not(.inv-hidden), select:not(.inv-hidden), textarea:not(.inv-hidden), [data-kbd-ring]'
    ));
    var curIdx = focusable.indexOf(e.target);
    if (curIdx >= 0 && curIdx < focusable.length - 1) {
      var next = focusable[curIdx + 1];
      next.focus();
      if (next.type === 'number' || next.type === 'text') next.select();
    }
  }
});

/* Blur on part input dismisses autocomplete (with delay for click) */
document.addEventListener('focusout', function(e) {
  if (e.target.dataset && (e.target.dataset.action === 'invEditLinePart' || e.target.dataset.action === 'invEditChallanPart')) {
    setTimeout(dismissAllAutocomplete, 200);
  }
});

