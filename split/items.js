/* ===== ITEMS MASTER (Phase 6) ===== */

/* --- Subview state --- */
var _itemsRendered = 0;
var _itemsSearchTimer = null;
var _itemsSorted = [];
var _mergeBackupWarned = false;
var _itemsSelected = {};
var _itemsUsageCache = null;
var ITEMS_BATCH = 50;
var _itemsActiveId = null;

function getItemsSubView() {
  return regFilter.clientsSubView || 'clients';
}

function setItemsSubView(view) {
  regFilter.clientsSubView = view;
  saveRegFilter();
}

function getItemsSort() {
  return regFilter.itemsSort || 'alpha';
}

function getItemsSearch() {
  return regFilter.itemsSearch || '';
}

function getItemsFilter() {
  return regFilter.itemsFilter || 'all';
}

/* --- Clients page dispatcher ---
   Tabs, then the view's toolbar (its one primary is Add), then the list. On the desktop the list
   is a table with a detail pane that takes room only while a row is open (§6.14), as the
   Register's does; on the phone a row opens the edit sheet. There is no floating Add: the
   toolbar's was the second Add on every phone view (the survey's doubled Add buttons). */
function renderClientsPage() {
  var container = document.getElementById('clientsPageContent');
  if (!container) return;
  var subView = getItemsSubView();

  // Performance is one client's analysis, not a list with a detail pane, so it
  // renders full width in both layouts.
  if (subView === 'performance') {
    container.innerHTML = _buildSubViewToggle('performance') + '<div id="clientPerfArea"></div>';
    renderClientPerformance(document.getElementById('clientPerfArea'));
    return;
  }

  var isItems = subView === 'items';
  var focusKey = _isDesktop ? _clientsFocusKey() : null;
  // The pane belongs to the view it was opened in.
  if (isItems) _clientsActiveId = null; else _itemsActiveId = null;
  var listHtml = isItems
    ? '<div id="itemsList"></div><div id="itemsLoadMore"></div><div id="itemsSelBar"></div>'
    : '<div id="clientList"></div>';
  container.innerHTML = _buildSubViewToggle(subView) +
    (isItems ? _buildItemsSubViewHtml() : _buildClientsSubViewHtml()) +
    (_isDesktop
      ? '<div class="inv-master-detail inv-master-detail-pane" id="clientsMasterDetail">' +
          '<div class="inv-master" id="clientsMaster">' + listHtml + '</div>' +
          '<div class="inv-detail inv-pane" id="clientsDetail"></div>' +
        '</div>'
      : listHtml);

  if (isItems) {
    _bindItemsSearch();
    _itemsRendered = 0;
    _renderItemsList();
    if (_isDesktop) _renderItemDetail(_itemsActiveId && S.items.some(function(it) { return it.id === _itemsActiveId; }) ? _itemsActiveId : null, true);
  } else {
    renderClientList('');
    if (_isDesktop) _renderClientDetail(_clientsActiveId, true);
  }
  _clientsRestoreFocus(focusKey);
}

function _buildClientsSubViewHtml() {
  return '<div class="inv-toolbar">' +
    '<label class="inv-search">' + ICON_SEARCH +
    '<input type="text" id="clientSearch" placeholder="Search clients" autocomplete="off" aria-label="Search clients"></label>' +
    '<button class="inv-btn inv-btn-primary" data-action="invAddClient">Add client</button>' +
    '</div>' +
    '<div class="inv-pagehead"><span class="inv-pagehead-meta" id="clientsCount">' + S.clients.length + ' clients</span></div>';
}

function _buildItemsSubViewHtml() {
  var search = getItemsSearch();
  var sort = getItemsSort();
  var filter = getItemsFilter();
  var noWeightCount = S.items.filter(function(it) { return it.stdWeightKg == null; }).length;
  var cache = _buildUsageCache();
  var unusedCount = S.items.filter(function(it) { return !cache[it.partNumber]; }).length;
  var opt = function(v, l) { return '<option value="' + v + '"' + (sort === v ? ' selected' : '') + '>' + l + '</option>'; };

  // A <select> speaks through change only (events.js), never a data-action: the click that opens it must not run it.
  return '<div class="inv-toolbar">' +
    '<label class="inv-search">' + ICON_SEARCH +
    '<input type="text" id="itemsSearch" placeholder="Search items" value="' + escHtml(search) + '" autocomplete="off" aria-label="Search items"></label>' +
    '<button class="inv-btn inv-btn-primary" data-action="invAddItem">Add item</button>' +
    '</div>' +
    '<div class="inv-toolbar">' +
    '<button class="inv-chip" data-action="invFilterNoWeight" aria-pressed="' + (filter === 'no-weight') + '">No weight (' + noWeightCount + ')</button>' +
    '<button class="inv-chip" data-action="invFilterUnused" aria-pressed="' + (filter === 'unused') + '">Unused (' + unusedCount + ')</button>' +
    '<select class="inv-select inv-toolbar-item" id="itemsSort" aria-label="Sort items">' +
    opt('alpha', 'A to Z') + opt('unit', 'Unit') + opt('rate', 'Rate') + opt('usage', 'Usage') + '</select>' +
    '</div>' +
    '<div class="inv-toolbar">' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invSelectAllUnused">Select unused</button>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCalcWeights">Calc weights</button>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invOpenWeightEntry">Enter weights (' + noWeightCount + ')</button>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invOpenMergeTool">Merge</button>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invOpenPartWeights">Part weights (' + Object.keys(S.partWeights || {}).length + ')</button>' +
    '</div>' +
    '<div class="inv-pagehead"><span class="inv-pagehead-meta" id="itemsCount">' + S.items.length + ' items</span></div>';
}

function _buildSubViewToggle(active) {
  var tab = function(k, l) {
    return '<button class="inv-viewtab" role="tab" aria-selected="' + (active === k) + '" data-action="invSwitchSubView" data-view="' + k + '">' + l + '</button>';
  };
  return '<div class="inv-viewtabs" role="tablist" aria-label="Clients">' +
    tab('clients', 'Clients') + tab('items', 'Items') + tab('performance', 'Performance') + '</div>';
}

/* ===== CLIENTS/ITEMS DESKTOP: LIST AND PANE =====
   The pane re-renders whole, which drops the keyboard; focus goes back as the Register's does. */
function _clientsFocusKey() {
  return _mdFocusKey('clientsMasterDetail', getItemsSubView() === 'items' ? _itemsActiveId : _clientsActiveId);
}
function _clientsRestoreFocus(k) {
  _mdRestoreFocus(k, getItemsSubView() === 'items' ? 'invSelectItemRow' : 'invSelectClientRow', 'invClientsClosePane');
}

/* The pane opens with its identifier and a close button; with nothing open it takes no room. */
function _clientsPaneShow(title, bodyHtml) {
  var wrap = document.getElementById('clientsMasterDetail');
  if (wrap) wrap.classList.toggle('inv-pane-open', !!bodyHtml);
  var el = document.getElementById('clientsDetail');
  if (el) el.innerHTML = bodyHtml ? '<div class="inv-pane-head">' + title +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invClientsClosePane" aria-label="Close">&times;</button></div>' + bodyHtml : '';
}

function closeClientsPane() {
  var focusKey = _clientsFocusKey();
  if (getItemsSubView() === 'items') _renderItemDetail(null); else _renderClientDetail(null);
  _clientsRestoreFocus(focusKey);
}

/* Item detail pane (Phase 8E) */
function _renderItemDetail(itemId, skipMasterRefresh) {
  var focusKey = skipMasterRefresh ? null : _clientsFocusKey();
  var item = itemId != null ? S.items.find(function(it) { return it.id === itemId; }) : null;
  _itemsActiveId = item ? itemId : null;
  if (!item) {
    _clientsPaneShow('', '');
  } else {
    var kv = function(k, v, cls) { return '<div' + (cls ? ' class="' + cls + '"' : '') + '><div class="inv-kv-k">' + k + '</div><div>' + v + '</div></div>'; };
    var html = '<div class="inv-kv">' +
      (item.desc ? kv('Description', escHtml(item.desc), 'inv-kv-wide') : '') +
      (item.gauge ? kv('Gauge / spec', '<span class="inv-id">' + escHtml(item.gauge) + '</span>') : '') +
      kv('HSN code', '<span class="inv-id">' + escHtml(item.hsn || '998873') + '</span>') +
      kv('Unit', escHtml(item.unit || 'KG')) +
      kv('Default rate', item.rate ? '<span class="inv-num">' + formatCurrency(item.rate) + '</span>' : 'No rate') +
      (item.stdWeightKg != null ? kv('Standard weight', '<span class="inv-num">' + formatNum(item.stdWeightKg, 3) + '</span> kg') : '') +
      '</div>';

    // Usage
    var usage = _buildUsageCache()[item.partNumber];
    html += '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">Usage</span></div>';
    if (usage) {
      var invLines = 0, imLines = 0;
      (S.invoices || []).forEach(function(inv) {
        inv.items.forEach(function(li) { if (li.partNumber === item.partNumber) invLines++; });
      });
      (S.incomingMaterial || []).forEach(function(im) {
        im.items.forEach(function(li) { if (li.partNumber === item.partNumber) imLines++; });
      });
      html += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">References</span>' +
        '<span class="inv-row-meta">' + invLines + ' invoice line' + (invLines !== 1 ? 's' : '') + ', ' + imLines + ' challan line' + (imLines !== 1 ? 's' : '') + '</span></span>' +
        '<span class="inv-row-end inv-num">' + usage.total + '</span></div>' +
        '<div class="inv-row"><span class="inv-row-main">In the last 30 days</span><span class="inv-row-end inv-num">' + usage.recent + '</span></div>';
    } else {
      html += '<div class="inv-empty">Unused: on no invoice or challan.</div>';
    }
    html += '</div>';

    html += '<div class="inv-toolbar">' +
      '<button class="inv-btn inv-btn-primary" data-action="invEditItem" data-id="' + item.id + '">Edit</button>' +
      '<button class="inv-btn inv-btn-danger" data-action="invDeleteItem" data-id="' + item.id + '">Delete</button>' +
      '</div>';
    _clientsPaneShow('<span class="inv-panel-title inv-id">' + escHtml(item.partNumber) + '</span>', html);
  }

  if (!skipMasterRefresh) {
    _itemsRendered = 0;
    _renderItemsList();
    _clientsRestoreFocus(focusKey);
  }
}

function _bindItemsSearch() {
  var el = document.getElementById('itemsSearch');
  if (!el) return;
  el.addEventListener('input', function() {
    regFilter.itemsSearch = el.value;
    saveRegFilter();
    clearTimeout(_itemsSearchTimer);
    _itemsSearchTimer = setTimeout(function() {
      _itemsRendered = 0;
      _renderItemsList();
    }, 300);
  });
}

/* --- Sort & filter items --- */
function _getSortedFilteredItems() {
  var search = getItemsSearch().toLowerCase();
  var sort = getItemsSort();
  var filter = getItemsFilter();

  var list = S.items.slice();

  // Filter
  if (filter === 'no-weight') {
    list = list.filter(function(it) { return it.stdWeightKg == null; });
  } else if (filter === 'unused') {
    var cache = _buildUsageCache();
    list = list.filter(function(it) { return !cache[it.partNumber]; });
  }

  // Search
  if (search.length > 0) {
    list = list.filter(function(it) {
      return (it.partNumber || '').toLowerCase().indexOf(search) >= 0 ||
             (it.desc || '').toLowerCase().indexOf(search) >= 0;
    });
  }

  // Sort
  if (sort === 'alpha') {
    list.sort(function(a, b) { return (a.partNumber || '').localeCompare(b.partNumber || ''); });
  } else if (sort === 'unit') {
    list.sort(function(a, b) {
      if (a.unit !== b.unit) return (a.unit || '').localeCompare(b.unit || '');
      return (a.partNumber || '').localeCompare(b.partNumber || '');
    });
  } else if (sort === 'rate') {
    list.sort(function(a, b) { return (b.rate || 0) - (a.rate || 0); });
  } else if (sort === 'usage') {
    list.sort(function(a, b) { return _getUsageScore(b.partNumber) - _getUsageScore(a.partNumber); });
  }

  return list;
}

function _itemCheckHtml(it) {
  return '<input type="checkbox" class="inv-check" data-action="invToggleItemSelect" data-id="' + it.id + '"' +
    (_itemsSelected[it.id] ? ' checked' : '') + ' aria-label="Select ' + escHtml(it.partNumber) + '">';
}

/* The phone row: a tick box, then the part (which opens its edit sheet), then its rate. */
function _itemRowHtml(it) {
  var usageCount = _getUsageCount(it.partNumber);
  var meta = [it.desc || '', it.gauge || '', it.unit || '',
    it.stdWeightKg != null ? formatNum(it.stdWeightKg, 3) + ' kg' : '',
    usageCount > 0 ? usageCount + ' ref' + (usageCount !== 1 ? 's' : '') : 'Unused'].filter(Boolean).join(' · ');
  var hasRate = it.rate != null && it.rate > 0;
  return '<div class="inv-row inv-row-2' + (_itemsSelected[it.id] ? ' inv-row-selected' : '') + '" data-item-row="' + it.id + '">' +
    '<label class="inv-row-lead inv-row-tick">' + _itemCheckHtml(it) + '</label>' +
    '<button class="inv-row-main" data-action="invEditItem" data-id="' + it.id + '">' +
    '<span class="inv-row-title inv-id">' + escHtml(it.partNumber) + '</span>' +
    '<span class="inv-row-meta">' + escHtml(meta) + '</span></button>' +
    '<span class="inv-row-end">' + (hasRate ? '<span class="inv-num">' + formatCurrency(it.rate) + '</span>' : '<span class="inv-row-meta">No rate</span>') + '</span>' +
    '</div>';
}

/* The desktop table: the part number is a real button, so the row opens from the keyboard. */
function _itemsTableHtml(list) {
  var html = '<table class="inv-table"><thead><tr>' +
    '<th class="inv-table-check"><span class="inv-visually-hidden">Select</span></th><th>Part</th><th class="inv-col-grow">Description</th>' +
    '<th class="inv-col-opt2">Gauge</th><th class="inv-col-opt1">Unit</th><th class="inv-num inv-col-opt3">kg / pc</th>' +
    '<th class="inv-num inv-col-opt2">Refs</th><th class="inv-num">Rate</th></tr></thead><tbody>';
  list.forEach(function(it) {
    var usageCount = _getUsageCount(it.partNumber);
    html += '<tr class="' + (_itemsSelected[it.id] ? 'inv-row-selected' : '') + '"' + (_itemsActiveId === it.id ? ' aria-current="true"' : '') +
      ' data-item-row="' + it.id + '" data-action="invSelectItemRow" data-id="' + it.id + '">' +
      '<td class="inv-table-check">' + _itemCheckHtml(it) + '</td>' +
      '<td><button class="inv-btn-link inv-id" data-action="invSelectItemRow" data-id="' + it.id + '">' + escHtml(it.partNumber) + '</button></td>' +
      '<td class="inv-col-grow" title="' + escHtml(it.desc || '') + '">' + escHtml(it.desc || '') + '</td>' +
      '<td class="inv-id inv-col-opt2">' + escHtml(it.gauge || '') + '</td>' +
      '<td class="inv-col-opt1">' + escHtml(it.unit || '') + '</td>' +
      '<td class="inv-num inv-col-opt3">' + (it.stdWeightKg != null ? formatNum(it.stdWeightKg, 3) : '&mdash;') + '</td>' +
      '<td class="inv-num inv-col-opt2">' + (usageCount > 0 ? usageCount : '<span class="inv-dot inv-dot-neutral">Unused</span>') + '</td>' +
      '<td class="inv-num">' + (it.rate > 0 ? formatCurrency(it.rate) : '&mdash;') + '</td></tr>';
  });
  return html + '</tbody></table>';
}

function _renderItemsList() {
  var listEl = document.getElementById('itemsList');
  var moreEl = document.getElementById('itemsLoadMore');
  var countEl = document.getElementById('itemsCount');
  if (!listEl) return;

  _itemsSorted = _getSortedFilteredItems();
  var total = _itemsSorted.length;
  var search = getItemsSearch();

  if (countEl) countEl.textContent = total + ' item' + (total !== 1 ? 's' : '');

  if (total === 0) {
    listEl.innerHTML = _isDesktop ? '<div class="inv-empty">No items found</div>' : '<div class="inv-panel"><div class="inv-empty">No items found</div></div>';
    if (moreEl) moreEl.innerHTML = '';
  } else {
    // For search results, render up to 100; otherwise batch
    var limit = search.length > 0 ? Math.min(total, 100) : Math.min(total, _itemsRendered + ITEMS_BATCH);
    if (_itemsRendered === 0) limit = Math.min(total, ITEMS_BATCH);
    var shown = _itemsSorted.slice(0, limit);
    listEl.innerHTML = _isDesktop ? _itemsTableHtml(shown)
      : '<div class="inv-panel inv-panel-flush">' + shown.map(_itemRowHtml).join('') + '</div>';
    _itemsRendered = limit;

    if (moreEl) {
      moreEl.innerHTML = limit < total && search.length === 0
        ? '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary" data-action="invLoadMoreItems">Load more (' + (total - limit) + ' remaining)</button></div>'
        : '';
    }
  }

  _renderItemsSelectionBar();

  // Desktop: an item filtered out of the list closes its pane.
  if (_isDesktop && _itemsActiveId && !_itemsSorted.some(function(it) { return it.id === _itemsActiveId; })) {
    _renderItemDetail(null, true);
  }
}

/* --- Add/Edit Item Overlay --- */
function openItemEdit(itemId) {
  var item = S.items.find(function(it) { return it.id === itemId; });
  if (!item) return;
  _inlineItemReturn = null;
  _showItemOverlay(item, false);
}

function openItemAdd() {
  // Any abandoned inline add is dropped here, so a cancelled one can never
  // redirect an ordinary add raised later from this tab.
  _inlineItemReturn = null;
  _showItemOverlay(null, true);
}

function _showItemOverlay(item, isAdd) {
  var title = isAdd ? 'Add item' : 'Edit item';
  var pn = item ? item.partNumber : '';
  var desc = item ? item.desc : '';
  var gauge = item ? (item.gauge || '') : '';
  var hsn = item ? (item.hsn || '998873') : '998873';
  var unit = item ? item.unit : 'KG';
  var rate = item ? (item.rate || 0) : 0;
  var stdW = (item && item.stdWeightKg != null) ? item.stdWeightKg : '';
  var itemId = item ? item.id : 0;

  // Reference count for delete warning
  var invRefs = 0;
  var imRefs = 0;
  if (item) {
    (S.invoices || []).forEach(function(inv) {
      inv.items.forEach(function(li) {
        if (li.partNumber === item.partNumber) invRefs++;
      });
    });
    (S.incomingMaterial || []).forEach(function(im) {
      im.items.forEach(function(li) {
        if (li.partNumber === item.partNumber) imRefs++;
      });
    });
  }
  var refCount = invRefs + imRefs;

  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">' + escHtml(title) + '</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay" aria-label="Close">&times;</button></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="itemEditPN">Part number</label>' +
    '<input class="inv-input inv-id" id="itemEditPN" value="' + escHtml(pn) + '"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="itemEditDesc">Description</label>' +
    '<input class="inv-input" id="itemEditDesc" value="' + escHtml(desc) + '"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="itemEditGauge">Gauge / spec</label>' +
    '<input class="inv-input inv-id" id="itemEditGauge" value="' + escHtml(gauge) + '" placeholder="e.g. 40X6"></div>' +
    '<div class="inv-fields">' +
    '<div class="inv-field"><label class="inv-field-label" for="itemEditHSN">HSN code</label>' +
    '<input class="inv-input inv-id" id="itemEditHSN" value="' + escHtml(hsn) + '"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="itemEditUnit">Unit</label>' +
    '<select class="inv-select" id="itemEditUnit">' +
    '<option value="KG"' + (unit === 'KG' ? ' selected' : '') + '>KG</option>' +
    '<option value="NOS"' + (unit === 'NOS' ? ' selected' : '') + '>NOS</option></select></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="itemEditRate">Default rate</label>' +
    '<input type="number" class="inv-input inv-input-num" id="itemEditRate" value="' + rate + '" step="0.01" min="0"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="itemEditWeight">Std weight (kg)</label>' +
    '<input type="number" class="inv-input inv-input-num" id="itemEditWeight" value="' + stdW + '" step="0.001" min="0" placeholder="Optional"></div></div>' +
    (refCount > 0 ? '<div class="inv-note">Referenced in ' + invRefs + ' invoice line' + (invRefs !== 1 ? 's' : '') + ', ' + imRefs + ' challan line' + (imRefs !== 1 ? 's' : '') + '</div>' : '') +
    '<div class="inv-btn-bar">' +
    (!isAdd ? '<button class="inv-btn inv-btn-danger inv-btn-sm" data-action="invDeleteItem" data-id="' + itemId + '">Delete</button>' : '') +
    '<button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invSaveItem" data-id="' + itemId + '" data-mode="' + (isAdd ? 'add' : 'edit') + '">Save</button></div></div>';

  scrim.addEventListener('click', function(e) {
    if (e.target === scrim) { scrim.remove(); document.body.style.overflow = ''; popFocus(); }
  });
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

function saveItem(itemId, mode) {
  var pn = document.getElementById('itemEditPN').value.trim();
  if (!pn) { showToast('Part number is required', 'error'); return; }

  var desc = document.getElementById('itemEditDesc').value.trim();
  var gauge = document.getElementById('itemEditGauge').value.trim().toUpperCase();
  var hsn = document.getElementById('itemEditHSN').value.trim() || '998873';
  var unit = document.getElementById('itemEditUnit').value;
  var rate = parseFloat(document.getElementById('itemEditRate').value) || 0;
  var wVal = document.getElementById('itemEditWeight').value.trim();
  var stdW = wVal !== '' ? parseFloat(wVal) : null;
  if (stdW !== null && (isNaN(stdW) || stdW < 0)) stdW = null;

  if (mode === 'add') {
    // A part number may legitimately repeat across gauges — the clamp lines
    // carry the same number in 30X6, 35X6 and 40X6. Identity is part + gauge.
    var dup = S.items.find(function(it) {
      return (it.partNumber || '').trim().toLowerCase() === pn.toLowerCase() &&
             (it.gauge || '').trim().toUpperCase() === gauge;
    });
    if (dup) {
      showToast('Already exists: ' + dup.partNumber + (dup.gauge ? ' (' + dup.gauge + ')' : ''), 'error');
      return;
    }
    var maxId = S.items.reduce(function(mx, it) { return Math.max(mx, it.id); }, 0);
    var added = {
      id: maxId + 1,
      partNumber: pn,
      desc: desc,
      gauge: gauge,
      hsn: hsn,
      unit: unit,
      rate: rate,
      stdWeightKg: stdW
    };
    S.items.push(added);
    showToast('Item added: ' + pn);
    // Raised from a line being typed rather than from the Items tab: save, then
    // put the new part straight into that line. Returning the operator to the
    // Items list here is what made the round trip necessary in the first place.
    // Only this branch saves early — the shared tail below covers every other
    // path, and saving in both fired the sync debounce twice for one edit.
    if (_inlineItemReturn) {
      saveState();
      if (finishInlineItemAdd(added)) return;
    }
  } else {
    var item = S.items.find(function(it) { return it.id === itemId; });
    if (!item) return;
    item.partNumber = pn;
    item.desc = desc;
    item.gauge = gauge;
    item.hsn = hsn;
    item.unit = unit;
    item.rate = rate;
    item.stdWeightKg = stdW;
    showToast('Item updated');
  }

  saveState();
  closeOverlay();
  _itemsRendered = 0;
  _renderItemsList();
  // Phase 8E: Refresh detail panel if active item was edited
  if (_isDesktop && _itemsActiveId === itemId) {
    _renderItemDetail(itemId, true);
  }
}

function deleteItem(itemId) {
  var item = S.items.find(function(it) { return it.id === itemId; });
  if (!item) return;

  var invRefs = 0;
  var imRefs = 0;
  (S.invoices || []).forEach(function(inv) {
    inv.items.forEach(function(li) {
      if (li.partNumber === item.partNumber) invRefs++;
    });
  });
  (S.incomingMaterial || []).forEach(function(im) {
    im.items.forEach(function(li) {
      if (li.partNumber === item.partNumber) imRefs++;
    });
  });

  var msg = 'Delete ' + item.partNumber + '?';
  if (invRefs + imRefs > 0) {
    msg += '\n\nReferenced in ' + invRefs + ' invoice line' + (invRefs !== 1 ? 's' : '') +
      ' and ' + imRefs + ' challan line' + (imRefs !== 1 ? 's' : '') +
      '. Historical references will be kept as-is.';
  }
  if (!confirm(msg)) return;

  var idx = S.items.indexOf(item);
  if (idx > -1) S.items.splice(idx, 1);
  saveState();
  closeOverlay();
  // Phase 8E: Clear detail panel if active item was deleted
  if (_isDesktop && _itemsActiveId === itemId) _renderItemDetail(null, true);
  _itemsRendered = 0;
  _renderItemsList();
  showToast('Item deleted');
}

/* --- Merge Duplicates Tool --- */
function openMergeTool() {
  if (!_mergeBackupWarned) {
    _mergeBackupWarned = true;
    showToast('Back up your data before merging. Settings \u2192 Export Data.', 'warning');
  }

  var groups = findDuplicateGroups(S.items);

  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  var html = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Merge duplicates</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay" aria-label="Close">&times;</button></div>';

  if (groups.length === 0) {
    html += '<div class="inv-empty">No duplicate groups found</div>';
  } else {
    html += '<p class="inv-note">' + groups.length + ' candidate group' + (groups.length !== 1 ? 's' : '') + ' found. Pick the item to keep in each group, then merge.</p>' +
      '<div class="inv-scroll">';
    // Each group is a panel of radio rows; Merge on its head opens a preview whose Confirm is the one primary.
    groups.forEach(function(group, gi) {
      html += '<div class="inv-panel inv-panel-flush" id="mergeGroup' + gi + '">' +
        '<div class="inv-panel-head"><span class="inv-panel-title">Group ' + (gi + 1) + ' <span class="inv-panel-count">' + group.items.length + ' items</span></span>' +
        '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMergeGroup" data-group="' + gi + '">Merge</button>' +
        '</div>';
      if (group._warn) {
        html += '<div class="inv-panel-body"><div class="inv-callout inv-callout-warning">Review: descriptions differ within this group</div></div>';
      }
      group.items.forEach(function(it, ii) {
        html += '<label class="inv-row inv-row-2">' +
          '<span class="inv-row-lead inv-row-tick"><input type="radio" class="inv-check" name="mergePrimary' + gi + '" value="' + it.id + '"' + (ii === 0 ? ' checked' : '') + '></span>' +
          '<span class="inv-row-main"><span class="inv-row-title inv-id">' + escHtml(it.partNumber) + '</span>' +
          '<span class="inv-row-meta">' + escHtml([it.unit, it.desc].filter(Boolean).join(' · ')) + '</span></span>' +
          '<span class="inv-row-end">' + (it.rate > 0 ? '<span class="inv-num">' + formatCurrency(it.rate) + '</span>' : '<span class="inv-row-meta">No rate</span>') + '</span>' +
          '</label>';
      });
      html += '</div>';
    });
    html += '</div>';
  }

  html += '<div class="inv-btn-bar"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Close</button></div></div>';
  scrim.innerHTML = html;
  scrim.addEventListener('click', function(e) {
    if (e.target === scrim) { scrim.remove(); document.body.style.overflow = ''; popFocus(); }
  });

  scrim._mergeGroups = groups;

  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

function findDuplicateGroups(items) {
  var groups = [];
  var used = {};

  var coreMap = {};
  items.forEach(function(it) {
    var core = _extractNumericCore(it.partNumber);
    if (!core || core.replace(/\s/g, '').length < 4) return;
    if (!coreMap[core]) coreMap[core] = [];
    coreMap[core].push(it);
  });

  Object.keys(coreMap).forEach(function(core) {
    if (coreMap[core].length < 2) return;
    var ids = coreMap[core].map(function(it) { return it.id; }).sort().join(',');
    if (used[ids]) return;
    used[ids] = true;

    var descs = {};
    coreMap[core].forEach(function(it) {
      var d = (it.desc || '').toUpperCase().trim();
      if (d && d !== (it.partNumber || '').toUpperCase().trim()) {
        descs[d] = true;
      }
    });

    groups.push({ items: coreMap[core], _warn: Object.keys(descs).length > 1 });
  });

  groups.sort(function(a, b) {
    if (a._warn !== b._warn) return a._warn ? 1 : -1;
    return b.items.length - a.items.length;
  });

  return groups;
}

function _extractNumericCore(partNumber) {
  if (!partNumber) return '';
  var digits = partNumber.match(/\d+/g);
  if (!digits) return '';
  return digits.join(' ');
}

function mergeGroup(groupIdx) {
  var scrim = document.querySelector('.inv-overlay-scrim');
  if (!scrim || !scrim._mergeGroups) return;
  var group = scrim._mergeGroups[groupIdx];
  if (!group) return;

  var radios = document.querySelectorAll('input[name="mergePrimary' + groupIdx + '"]');
  var primaryId = null;
  radios.forEach(function(r) { if (r.checked) primaryId = parseInt(r.value); });
  if (primaryId == null) return;

  var primary = group.items.find(function(it) { return it.id === primaryId; });
  if (!primary) return;
  var secondaries = group.items.filter(function(it) { return it.id !== primaryId; });
  if (secondaries.length === 0) return;

  var secondaryPNs = secondaries.map(function(it) { return it.partNumber; });

  var invCount = 0;
  var imCount = 0;
  (S.invoices || []).forEach(function(inv) {
    var affected = false;
    inv.items.forEach(function(li) {
      if (secondaryPNs.indexOf(li.partNumber) >= 0) affected = true;
    });
    if (affected) invCount++;
  });
  (S.incomingMaterial || []).forEach(function(im) {
    var affected = false;
    im.items.forEach(function(li) {
      if (secondaryPNs.indexOf(li.partNumber) >= 0) affected = true;
    });
    if (affected) imCount++;
  });

  var groupEl = document.getElementById('mergeGroup' + groupIdx);
  if (!groupEl) return;

  groupEl.innerHTML = '<div class="inv-panel-head"><span class="inv-panel-title">Merge into <span class="inv-id">' + escHtml(primary.partNumber) + '</span></span></div>' +
    '<div class="inv-row"><span class="inv-row-main">Duplicates removed</span><span class="inv-row-end inv-num">' + secondaries.length + '</span></div>' +
    '<div class="inv-row"><span class="inv-row-main">Invoices updated</span><span class="inv-row-end inv-num">' + invCount + '</span></div>' +
    '<div class="inv-row"><span class="inv-row-main">Challans updated</span><span class="inv-row-end inv-num">' + imCount + '</span></div>' +
    '<div class="inv-panel-body inv-toolbar inv-toolbar-tight">' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMergeCancelPreview" data-group="' + groupIdx + '">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invMergeConfirm" data-group="' + groupIdx + '" data-primary="' + primaryId + '">Confirm merge</button>' +
    '</div>';
}

function confirmMerge(groupIdx, primaryId) {
  var scrim = document.querySelector('.inv-overlay-scrim');
  if (!scrim || !scrim._mergeGroups) return;
  var group = scrim._mergeGroups[groupIdx];
  if (!group) return;

  var primary = group.items.find(function(it) { return it.id === primaryId; });
  if (!primary) return;
  var secondaries = group.items.filter(function(it) { return it.id !== primaryId; });
  var secondaryPNs = secondaries.map(function(it) { return it.partNumber; });

  var invUpdated = 0;
  (S.invoices || []).forEach(function(inv) {
    inv.items.forEach(function(li) {
      if (secondaryPNs.indexOf(li.partNumber) >= 0) {
        li.partNumber = primary.partNumber;
        li.desc = primary.desc;
        invUpdated++;
      }
    });
  });

  var imUpdated = 0;
  (S.incomingMaterial || []).forEach(function(im) {
    im.items.forEach(function(li) {
      if (secondaryPNs.indexOf(li.partNumber) >= 0) {
        li.partNumber = primary.partNumber;
        li.desc = primary.desc;
        imUpdated++;
      }
    });
  });

  secondaries.forEach(function(sec) {
    var idx = S.items.indexOf(sec);
    if (idx > -1) S.items.splice(idx, 1);
  });

  saveState();

  var groupEl = document.getElementById('mergeGroup' + groupIdx);
  if (groupEl) groupEl.remove();
  scrim._mergeGroups[groupIdx] = null;

  showToast('Merged ' + (secondaries.length + 1) + ' \u2192 1. Updated ' + invUpdated + ' invoice line' + (invUpdated !== 1 ? 's' : '') + ', ' + imUpdated + ' challan line' + (imUpdated !== 1 ? 's' : '') + '.');
}

function cancelMergePreview(groupIdx) {
  closeOverlay();
  openMergeTool();
}

/* --- Weight Calculator --- */
/* ===== BULK WEIGHT ENTRY =====

   Calc Weights derives a weight from lines billed in KG that also carry a
   piece count. Piece-billed work has no such line, so for those parts it can
   derive nothing — and without a weight there is no rupees-per-kg, which means
   no margin figure for the piece-billed side of the book at all.

   This screen closes that gap by hand. It orders the gaps by the revenue
   riding on them, and shows the break-even weight beside each input: at the
   configured cost per kg, a piece heavier than rate/cost is being processed
   at a loss. Typing a weight prices the part immediately, so the entry pass
   doubles as a margin review. */

function _partRevenueMap() {
  var rev = {};
  (S.invoices || []).forEach(function(inv) {
    if (inv.status === 'cancelled') return;
    (inv.items || []).forEach(function(li) {
      if (!li.partNumber) return;
      rev[li.partNumber] = (rev[li.partNumber] || 0) + (li.amount || 0);
    });
  });
  return rev;
}

/* partNumber -> [weight, ...] recovered from piece pricing, in ONE pass.

   Deliberately not a per-item scan. With ~700 invoices and ~160 items that
   shape cost ~350,000 getLineItemRate() calls, each filtering and sorting a
   client's rate ladder — enough to stall the phone this runs on. Walking the
   book once, with the client resolved per invoice rather than per line, does
   the same work in a few hundred. */
function _buildDerivedWeightMap() {
  var map = {};
  (S.invoices || []).forEach(function(inv) {
    if (inv.status === 'cancelled') return;
    var client = S.clients.find(function(c) { return c.id === inv.clientId; });
    if (!client || client.billingMode !== 'piece') return;
    var date = inv.date || localDateStr();

    (inv.items || []).forEach(function(li) {
      if (!li.partNumber) return;
      if ((li.unit || '').toUpperCase() !== 'NOS' || !(li.rate > 0)) return;
      var rateInfo = getLineItemRate(client, date, li.partNumber);
      // An override is a negotiated per-piece figure with no weight basis;
      // inverting it would invent a number rather than recover one.
      if (rateInfo._override || !(rateInfo.ratePerKg > 0)) return;
      if (!map[li.partNumber]) map[li.partNumber] = [];
      map[li.partNumber].push(li.rate / rateInfo.ratePerKg);
    });
  });
  return map;
}

/* Break-even weight in kg: above this, the piece rate does not cover cost.
   Only meaningful for per-piece rates — a KG rate is already rupees per kg. */
function _breakEvenKg(item, cost) {
  if (!cost || cost <= 0) return null;
  if ((item.unit || '').toUpperCase() !== 'NOS') return null;
  if (!item.rate || item.rate <= 0) return null;
  return item.rate / cost;
}

/* ===== PART WEIGHTS (NOS to KG) =====
   The kilograms a nos_to_weight client's line is priced on: qty × this. It is
   the one weight that bills, so it lives with the parts rather than in
   Settings. Distinct from stdWeightKg (read by Stats only) and from a client's
   own pieceWeights (the weight check). */
function openPartWeights() {
  closeOverlay();
  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Part weights (NOS to KG)</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay" aria-label="Close">&times;</button></div>' +
    '<p class="inv-note">A client billed by weight off a piece count is priced on pieces &times; this weight. It moves money on the invoice, unlike the standard weight Stats reads.</p>' +
    '<div class="inv-panel inv-panel-flush inv-scroll" id="setPWList">' + renderPartWeightsList() + '</div>' +
    '<div class="inv-fields"><div class="inv-field"><label class="inv-field-label" for="setPWPart">Part number</label><input class="inv-input inv-id" id="setPWPart" placeholder="HINGE PIN"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="setPWWeight">Weight (kg)</label><input type="number" class="inv-input inv-input-num" id="setPWWeight" step="0.001" placeholder="0.045"></div></div>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAddPartWeight">Add weight</button></div>';
  scrim.addEventListener('click', function(e) { if (e.target === scrim) closeOverlay(); });
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

function _partWeightsCount() {
  var b = document.querySelector('[data-action="invOpenPartWeights"]');
  if (b) b.textContent = 'Part weights (' + Object.keys(S.partWeights || {}).length + ')';
}

function renderPartWeightsList() {
  const entries = Object.entries(S.partWeights || {});
  if (entries.length === 0) return '<div class="inv-empty">No part weights defined yet</div>';
  return entries.map(([part, wt]) =>
    '<div class="inv-row"><span class="inv-row-main inv-row-title inv-id">' + escHtml(part) + '</span>' +
    '<span class="inv-row-end"><span class="inv-num">' + escHtml(wt) + '</span> kg' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost inv-btn-sm" data-action="invDeletePartWeight" data-part="' + escHtml(part) + '" aria-label="Remove ' + escHtml(part) + '">&times;</button></span></div>'
  ).join('');
}

function addPartWeight() {
  const partEl = document.getElementById('setPWPart');
  const wtEl = document.getElementById('setPWWeight');
  if (!partEl || !wtEl) return;
  const part = partEl.value.trim().toUpperCase();
  const wt = parseFloat(wtEl.value);
  if (!part || isNaN(wt) || wt <= 0) { showToast('Enter part name and weight', 'error'); return; }
  S.partWeights[part] = wt;
  saveState();
  const list = document.getElementById('setPWList');
  if (list) list.innerHTML = renderPartWeightsList();
  partEl.value = '';
  wtEl.value = '';
  _partWeightsCount();
  showToast('Weight added: ' + part + ' = ' + wt + ' kg');
}

function deletePartWeight(part) {
  if (!confirm('Delete weight for ' + part + '?')) return;
  delete S.partWeights[part];
  saveState();
  const list = document.getElementById('setPWList');
  if (list) list.innerHTML = renderPartWeightsList();
  _partWeightsCount();
  showToast('Weight removed');
}

function openWeightEntry() {
  var missing = (S.items || []).filter(function(it) { return it.stdWeightKg == null; });
  if (missing.length === 0) {
    showToast('Every item already has a standard weight');
    return;
  }

  var cost = S.defaultCostPerKg || 0;
  var revMap = _partRevenueMap();
  missing.sort(function(a, b) {
    return (revMap[b.partNumber] || 0) - (revMap[a.partNumber] || 0);
  });

  var weightMap = _buildDerivedWeightMap();
  var derivable = missing.filter(function(it) { return !!weightMap[it.partNumber]; }).length;

  var html = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Enter weights</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay" aria-label="Close">&times;</button></div>' +
    '<p class="inv-note">' +
    missing.length + ' item' + (missing.length !== 1 ? 's' : '') + ' without a weight, heaviest revenue first. ' +
    (cost > 0
      ? 'Break-even is shown against a cost of ' + formatCurrency(cost) + '/kg.'
      : 'Set a cost per kg in Settings to see break-even weights.') +
    '</p>' +
    (derivable > 0
      ? '<div class="inv-callout inv-callout-info">' +
        derivable + ' of these are billed per piece off a rate per kg, so the weight is ' +
        'recoverable from the pricing itself — no weighing needed. Note that a weight ' +
        'derived this way prices back at exactly that rate, so it measures tonnage, not margin.' +
        '</div>'
      : '');

  // One row per part: what it is and what rides on it, then the weight field and what that weight
  // prices the part at (a dot and the ₹/kg), updated as it is typed.
  html += '<div class="inv-panel inv-panel-flush inv-scroll">';
  missing.forEach(function(it) {
    var be = _breakEvenKg(it, cost);
    var revenue = revMap[it.partNumber] || 0;
    var meta = [(it.rate ? formatCurrency(it.rate) + '/' + (it.unit || 'KG') : 'No rate'),
      revenue > 0 ? formatCurrency(revenue) + ' billed' : ''].filter(Boolean).join(' · ');
    html += '<div class="inv-row inv-row-auto" data-weight-row="' + it.id + '">' +
      '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap"><span class="inv-id">' + escHtml(it.partNumber) + '</span>' +
      (it.gauge ? ' <span class="inv-badge" data-gauge>' + escHtml(it.gauge) + '</span>' : '') +
      ' <span class="inv-badge">' + escHtml(it.unit || 'KG') + '</span></span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(meta) +
      (be != null ? ' · <span data-breakeven>break-even ' + formatNum(be, 3) + ' kg</span>' : '') + '</span>' +
      '<span class="inv-row-meta" id="invWeightVerdict' + it.id + '" data-verdict></span></span>' +
      '<span class="inv-row-end"><input type="number" class="inv-input inv-input-sm inv-input-num" ' +
      'data-action="invWeightInput" data-id="' + it.id + '" ' +
      'data-rate="' + (it.rate || 0) + '" data-unit="' + escHtml(it.unit || 'KG') + '" ' +
      'step="0.001" min="0" placeholder="kg per piece" aria-label="Weight of ' + escHtml(it.partNumber) + ' in kg per piece"></span>' +
      '</div>';
  });
  html += '</div>';

  html += '<div class="inv-btn-bar">' +
    '<button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
    (derivable > 0
      ? '<button class="inv-btn inv-btn-secondary" data-action="invDeriveWeights">Derive ' + derivable + ' from rates</button>'
      : '') +
    '<button class="inv-btn inv-btn-primary" data-action="invSaveWeights">Save weights</button></div></div>';

  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = html;
  scrim.addEventListener('click', function(e) {
    if (e.target === scrim) { scrim.remove(); document.body.style.overflow = ''; popFocus(); }
  });
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

/* Live pricing as a weight is typed. */
function updateWeightVerdict(input) {
  var el = document.getElementById('invWeightVerdict' + input.dataset.id);
  if (!el) return;
  var cost = S.defaultCostPerKg || 0;
  var rate = parseFloat(input.dataset.rate) || 0;
  var kg = parseFloat(input.value);

  el.dataset.verdict = '';
  el.textContent = '';
  if (!input.value.trim() || isNaN(kg) || kg <= 0) return;
  if (rate <= 0 || cost <= 0 || (input.dataset.unit || '').toUpperCase() !== 'NOS') return;

  // At or above the cost per kg the part pays for itself; below it, it is processed at a loss.
  var perKg = gstRound(rate / kg);
  var ok = perKg >= cost;
  el.dataset.verdict = ok ? 'ok' : 'bad';
  el.innerHTML = '<span class="inv-dot inv-dot-' + (ok ? 'ok' : 'danger') + '">' + (ok ? 'Covers cost' : 'Below cost') + '</span> ' +
    '<span class="inv-num">' + escHtml(formatCurrency(perKg)) + '/kg</span>';
}

function saveWeights() {
  var inputs = document.querySelectorAll('[data-action="invWeightInput"]');
  var saved = 0;
  var invalid = 0;

  inputs.forEach(function(input) {
    var raw = input.value.trim();
    if (raw === '') return;
    var kg = parseFloat(raw);
    if (isNaN(kg) || kg <= 0) { invalid++; return; }
    var item = S.items.find(function(it) { return it.id === parseInt(input.dataset.id); });
    if (!item) return;
    item.stdWeightKg = kg;
    saved++;
  });

  if (invalid > 0 && saved === 0) {
    showToast('Enter weights greater than zero', 'error');
    return;
  }
  if (saved === 0) {
    showToast('No weights entered', 'error');
    return;
  }

  saveState();
  closeOverlay();
  _itemsRendered = 0;
  renderClientsPage();
  showToast('Saved ' + saved + ' weight' + (saved !== 1 ? 's' : '') +
    (invalid > 0 ? ' (' + invalid + ' skipped)' : ''));
}

/* Derive weights by inverting the client's own pricing.

   Where a client bills per piece off a rate per kg, the piece rate WAS the
   weight times that rate — so weight = pieceRate / ratePerKg recovers it
   exactly. Corroborated against strip gauge: clamps carried in two gauges
   imply the same developed strip length to within ~1%, which only happens if
   the rates were built this way.

   Restricted to billingMode 'piece' with no itemRates override. An override is
   a negotiated per-piece figure with no stated weight basis, so inverting it
   would invent a number.

   Note what this cannot do: a weight defined as rate/ratePerKg prices back at
   exactly ratePerKg, so these weights say nothing about which parts are more
   profitable. Their value is tonnage — what the plant actually processed. */
/* The derivation itself, with no UI attached, so the Items Master button and
   the bootstrap migration in init.js run exactly the same code rather than two
   implementations that can drift. Fills only empty weights — a weight already
   on file, whether typed or previously derived, is never overwritten.
   Returns what it did; persisting is the caller's business. */
function applyDerivedWeights() {
  var derived = 0;
  var highVariance = 0;
  var ambiguous = 0;
  var weightMap = _buildDerivedWeightMap();

  /* Part numbers held by more than one catalogue row at different gauges.
     Four clamp families are like this — CLAMP 165X83 (NT) exists at 35X6 and
     40X6, and priced differently, so they are different weights. An invoice
     line carries no gauge field, only the part number, so a derived weight
     cannot be attributed to one of them: averaging would hand both rows a
     figure that is right for neither. They are left for manual entry.

     This costs no tonnage. Stats derives a piece-billed line's weight from the
     line's own amount, which is correct whichever gauge it was. What is
     withheld is only the catalogue's per-part figure. */
  var gaugesFor = {};
  (S.items || []).forEach(function(it) {
    var key = it.partNumber;
    if (!gaugesFor[key]) gaugesFor[key] = {};
    gaugesFor[key][it.gauge || ''] = true;
  });

  (S.items || []).forEach(function(item) {
    if (item.stdWeightKg != null) return;

    var weights = weightMap[item.partNumber];
    if (!weights || weights.length === 0) return;

    if (Object.keys(gaugesFor[item.partNumber] || {}).length > 1) { ambiguous++; return; }

    var avg = weights.reduce(function(s, w) { return s + w; }, 0) / weights.length;
    if (weights.length > 1) {
      var variance = weights.reduce(function(s, w) { return s + Math.pow(w - avg, 2); }, 0) / weights.length;
      if ((Math.sqrt(variance) / avg) * 100 > 20) highVariance++;
    }

    item.stdWeightKg = Math.round(avg * 10000) / 10000;
    derived++;
  });

  return { derived: derived, highVariance: highVariance, ambiguous: ambiguous,
           sources: Object.keys(weightMap).length };
}

function deriveWeightsFromRates() {
  var result = applyDerivedWeights();
  var derived = result.derived;
  var highVariance = result.highVariance;

  if (derived === 0) {
    showToast('No piece-billed lines to derive weights from', 'error');
    return;
  }

  saveState();
  closeOverlay();
  _itemsRendered = 0;
  renderClientsPage();
  var notes = [];
  if (highVariance > 0) notes.push(highVariance + ' with inconsistent rates');
  if (result.ambiguous > 0) notes.push(result.ambiguous + ' skipped: same part in two gauges');
  showToast('Derived ' + derived + ' weight' + (derived !== 1 ? 's' : '') +
    (notes.length ? ' (' + notes.join(', ') + ')' : ''),
    notes.length ? 'warning' : 'success');
}

function calculateStdWeights() {
  var calculated = 0;
  var highVariance = 0;

  S.items.forEach(function(item) {
    if (item.stdWeightKg != null) return;

    var pairs = [];

    (S.invoices || []).forEach(function(inv) {
      inv.items.forEach(function(li) {
        if (li.partNumber === item.partNumber && li.unit === 'KG' && li.nosQty > 0 && li.qty > 0) {
          pairs.push({ kg: li.qty, nos: li.nosQty });
        }
      });
    });

    (S.incomingMaterial || []).forEach(function(im) {
      im.items.forEach(function(li) {
        if (li.partNumber === item.partNumber && li.unit === 'KG' && li.nosQty > 0 && li.qty > 0) {
          pairs.push({ kg: li.qty, nos: li.nosQty });
        }
      });
    });

    if (pairs.length === 0) return;

    var weights = pairs.map(function(p) { return p.kg / p.nos; });
    var avg = weights.reduce(function(s, w) { return s + w; }, 0) / weights.length;

    if (weights.length > 1) {
      var variance = weights.reduce(function(s, w) { return s + Math.pow(w - avg, 2); }, 0) / weights.length;
      var cv = (Math.sqrt(variance) / avg) * 100;
      if (cv > 20) highVariance++;
    }

    item.stdWeightKg = gstRound(avg * 1000) / 1000;
    calculated++;
  });

  if (calculated > 0) {
    saveState();
    _itemsRendered = 0;
    _renderItemsList();
  }

  var msg = 'Calculated weights for ' + calculated + ' item' + (calculated !== 1 ? 's' : '') + ' from invoice/challan history';
  if (highVariance > 0) msg += '. ' + highVariance + ' with high variance (>20% CV)';
  if (calculated === 0) msg = 'No items with calculable weights found. Need invoice/challan data with both KG qty and NOS count.';
  showToast(msg, calculated > 0 ? 'success' : 'warning');
}

/* --- Usage Scoring (Phase 6b) --- */
function _buildUsageCache() {
  if (_itemsUsageCache) return _itemsUsageCache;
  var cache = {};
  var now = Date.now();
  var thirtyDaysMs = 30 * 86400000;

  (S.invoices || []).forEach(function(inv) {
    var recent = inv.createdAt && (now - inv.createdAt) < thirtyDaysMs;
    (inv.items || []).forEach(function(li) {
      var pn = li.partNumber;
      if (!pn) return;
      if (!cache[pn]) cache[pn] = { total: 0, recent: 0 };
      cache[pn].total++;
      if (recent) cache[pn].recent++;
    });
  });

  (S.incomingMaterial || []).forEach(function(im) {
    var recent = im.createdAt && (now - im.createdAt) < thirtyDaysMs;
    (im.items || []).forEach(function(li) {
      var pn = li.partNumber;
      if (!pn) return;
      if (!cache[pn]) cache[pn] = { total: 0, recent: 0 };
      cache[pn].total++;
      if (recent) cache[pn].recent++;
    });
  });

  _itemsUsageCache = cache;
  return cache;
}

function _getUsageScore(partNumber) {
  var cache = _buildUsageCache();
  var entry = cache[partNumber];
  if (!entry) return 0;
  return entry.total + (entry.recent * 2);
}

function _getUsageCount(partNumber) {
  var cache = _buildUsageCache();
  var entry = cache[partNumber];
  return entry ? entry.total : 0;
}

function _invalidateUsageCache() {
  _itemsUsageCache = null;
}

/* --- Batch Select/Delete --- */
function toggleItemSelect(itemId) {
  _itemsSelected[itemId] = !_itemsSelected[itemId];
  if (!_itemsSelected[itemId]) delete _itemsSelected[itemId];
  _renderItemsSelectionBar();
  // The row (phone) or table row (desktop) carries the selection fill.
  var row = document.querySelector('[data-item-row="' + itemId + '"]');
  if (row) row.classList.toggle('inv-row-selected', !!_itemsSelected[itemId]);
}

function selectAllUnused() {
  _itemsSelected = {};
  var cache = _buildUsageCache();
  S.items.forEach(function(it) {
    if (!cache[it.partNumber]) _itemsSelected[it.id] = true;
  });
  _itemsRendered = 0;
  _renderItemsList();
  _renderItemsSelectionBar();
  var count = Object.keys(_itemsSelected).length;
  showToast(count + ' unused item' + (count !== 1 ? 's' : '') + ' selected');
}

function clearItemSelection() {
  _itemsSelected = {};
  _itemsRendered = 0;
  _renderItemsList();
  _renderItemsSelectionBar();
}

function batchDeleteItems() {
  var ids = Object.keys(_itemsSelected).filter(function(k) { return _itemsSelected[k]; }).map(Number);
  if (ids.length === 0) return;
  if (!confirm('Delete ' + ids.length + ' item' + (ids.length !== 1 ? 's' : '') + '? Historical invoice/challan references will be kept.')) return;
  S.items = S.items.filter(function(it) { return ids.indexOf(it.id) < 0; });
  _itemsSelected = {};
  _invalidateUsageCache();
  saveState();
  _itemsRendered = 0;
  _renderItemsList();
  _renderItemsSelectionBar();
  showToast(ids.length + ' item' + (ids.length !== 1 ? 's' : '') + ' deleted');
}

function _renderItemsSelectionBar() {
  var count = Object.keys(_itemsSelected).filter(function(k) { return _itemsSelected[k]; }).length;
  var bar = document.getElementById('itemsSelBar');
  if (!bar) return;
  if (count === 0) {
    bar.innerHTML = '';
    return;
  }
  bar.innerHTML = '<div class="inv-selbar">' +
    '<span class="inv-selbar-count">' + count + ' selected</span>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invClearItemSelection">Clear</button>' +
    '<button class="inv-btn inv-btn-danger inv-btn-sm" data-action="invBatchDeleteItems">Delete</button>' +
    '</div>';
}
