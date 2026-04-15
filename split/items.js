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

/* --- Clients page dispatcher --- */
function renderClientsPage() {
  var container = document.getElementById('clientsPageContent');
  if (!container) return;
  var subView = getItemsSubView();
  var fab = document.getElementById('clientsItemsFab');

  // Phase 8E: Desktop master-detail
  if (_isDesktop) {
    _renderClientsDesktop(subView);
    if (fab) fab.classList.add('inv-hidden');
    return;
  }

  if (subView === 'items') {
    container.innerHTML = _buildItemsSubViewHtml();
    if (fab) fab.classList.remove('inv-hidden');
    _bindItemsSearch();
    _itemsRendered = 0;
    _renderItemsList();
  } else {
    container.innerHTML = _buildClientsSubViewHtml();
    if (fab) fab.classList.add('inv-hidden');
    renderClientList('');
  }
}

function _buildClientsSubViewHtml(includeToggle) {
  return (includeToggle !== false ? _buildSubViewToggle('clients') : '') +
    '<div class="inv-search-wrap">' +
    '<svg class="inv-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' +
    '<input type="text" class="inv-search-input" id="clientSearch" placeholder="Search clients" autocomplete="off">' +
    '</div>' +
    '<div id="clientList"></div>';
}

function _buildItemsSubViewHtml(includeToggle) {
  var search = getItemsSearch();
  var sort = getItemsSort();
  var filter = getItemsFilter();
  var noWeightCount = S.items.filter(function(it) { return it.stdWeightKg == null; }).length;
  var cache = _buildUsageCache();
  var unusedCount = S.items.filter(function(it) { return !cache[it.partNumber]; }).length;

  var html = (includeToggle !== false ? _buildSubViewToggle('items') : '');

  // Toolbar
  html += '<div class="inv-items-toolbar">' +
    '<div class="inv-search-wrap inv-search-no-mb">' +
    '<svg class="inv-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' +
    '<input type="text" class="inv-search-input" id="itemsSearch" placeholder="Search items" value="' + escHtml(search) + '" autocomplete="off">' +
    '</div>' +
    '<div class="inv-items-toolbar-row">' +
    '<span class="inv-items-count" id="itemsCount">' + S.items.length + ' items</span>' +
    '<select class="inv-form-select inv-items-sort" id="itemsSort" data-action="invItemsSort">' +
    '<option value="alpha"' + (sort === 'alpha' ? ' selected' : '') + '>A-Z</option>' +
    '<option value="unit"' + (sort === 'unit' ? ' selected' : '') + '>Unit</option>' +
    '<option value="rate"' + (sort === 'rate' ? ' selected' : '') + '>Rate</option>' +
    '<option value="usage"' + (sort === 'usage' ? ' selected' : '') + '>Usage</option>' +
    '</select>' +
    '</div>' +
    '<div class="inv-items-toolbar-row">' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm' + (filter === 'no-weight' ? ' inv-chip-active' : '') + '" data-action="invFilterNoWeight">No weight (' + noWeightCount + ')</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm' + (filter === 'unused' ? ' inv-chip-active' : '') + '" data-action="invFilterUnused">Unused (' + unusedCount + ')</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invSelectAllUnused">Select unused</button>' +
    '</div>' +
    '<div class="inv-items-toolbar-row">' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invCalcWeights">Calc Weights</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invOpenMergeTool">Merge</button>' +
    '</div>' +
    '</div>';

  // List container
  html += '<div id="itemsList"></div>';
  html += '<div id="itemsLoadMore"></div>';
  html += '<div id="itemsSelBar"></div>';

  return html;
}

function _buildSubViewToggle(active) {
  return '<div class="inv-subview-toggle">' +
    '<button class="inv-subview-btn' + (active === 'clients' ? ' inv-subview-active' : '') + '" data-action="invSwitchSubView" data-view="clients">Clients</button>' +
    '<button class="inv-subview-btn' + (active === 'items' ? ' inv-subview-active' : '') + '" data-action="invSwitchSubView" data-view="items">Items</button>' +
    '</div>';
}

/* ===== CLIENTS/ITEMS DESKTOP MASTER-DETAIL (Phase 8E) ===== */
function _renderClientsDesktop(subView) {
  var container = document.getElementById('clientsPageContent');
  if (!container) return;

  var wrapper = document.getElementById('clientsMasterDetail');
  var toggleEl = document.getElementById('clientsDesktopToggle');

  if (!wrapper) {
    // First render — build full wrapper with toggle above
    container.innerHTML =
      '<div id="clientsDesktopToggle">' + _buildSubViewToggle(subView) + '</div>' +
      '<div class="inv-master-detail" id="clientsMasterDetail">' +
        '<div class="inv-master inv-master-clients" id="clientsMaster"></div>' +
        '<div class="inv-drag-handle" id="clientsDragHandle"></div>' +
        '<div class="inv-detail" id="clientsDetail">' + _renderDetailEmpty() + '</div>' +
      '</div>';
    _initDragHandle('clientsDragHandle', 'clientsMaster', 'clientsDetail', 'pageClients');
    _restorePanelWidth('clientsMaster', 'pageClients');
  } else {
    // Re-render — update toggle and master content only
    if (toggleEl) toggleEl.innerHTML = _buildSubViewToggle(subView);
  }

  var master = document.getElementById('clientsMaster');
  if (!master) return;

  // Detect sub-view switch: clear detail and both active IDs
  var prevSubView = master.dataset.subView;
  if (prevSubView && prevSubView !== subView) {
    _clientsActiveId = null;
    _itemsActiveId = null;
    var detail = document.getElementById('clientsDetail');
    if (detail) detail.innerHTML = _renderDetailEmpty();
  }
  master.dataset.subView = subView;

  if (subView === 'clients') {
    master.innerHTML = _buildClientsSubViewHtml(false);
    renderClientList('');
    _itemsActiveId = null;
  } else {
    master.innerHTML = _buildItemsSubViewHtml(false);
    _bindItemsSearch();
    _itemsRendered = 0;
    _renderItemsList();
    _clientsActiveId = null;
  }

  // Detail validation
  if (subView === 'clients' && _clientsActiveId) {
    var cStill = S.clients.find(function(c) { return c.id === _clientsActiveId; });
    if (!cStill) {
      _clientsActiveId = null;
      var d1 = document.getElementById('clientsDetail');
      if (d1) d1.innerHTML = _renderDetailEmpty();
    } else {
      _renderClientDetail(_clientsActiveId, true);
    }
  } else if (subView === 'items' && _itemsActiveId) {
    var iStill = S.items.find(function(it) { return it.id === _itemsActiveId; });
    if (!iStill) {
      _itemsActiveId = null;
      var d2 = document.getElementById('clientsDetail');
      if (d2) d2.innerHTML = _renderDetailEmpty();
    } else {
      _renderItemDetail(_itemsActiveId, true);
    }
  }
}

/* Item detail panel (Phase 8E) */
function _renderItemDetail(itemId, skipMasterRefresh) {
  var item = S.items.find(function(it) { return it.id === itemId; });
  if (!item) {
    _itemsActiveId = null;
    var detail = document.getElementById('clientsDetail');
    if (detail) detail.innerHTML = _renderDetailEmpty();
    if (!skipMasterRefresh) {
      _itemsRendered = 0;
      _renderItemsList();
    }
    return;
  }

  _itemsActiveId = itemId;

  var html = '';

  // Header
  html += '<div class="inv-detail-section">' +
    '<div class="inv-detail-client-name inv-detail-value-mono">' + escHtml(item.partNumber) + '</div></div>';

  // Info section
  html += '<div class="inv-detail-section">';
  if (item.desc) {
    html += '<div class="inv-detail-label">Description</div>' +
      '<div class="inv-detail-value">' + escHtml(item.desc) + '</div>';
  }
  html += '<div class="inv-detail-label">HSN Code</div>' +
    '<div class="inv-detail-value-mono">' + escHtml(item.hsn || '998873') + '</div>';
  html += '<div class="inv-detail-label">Unit</div>' +
    '<div class="inv-detail-value">' + escHtml(item.unit || 'KG') + '</div>';
  html += '<div class="inv-detail-label">Default Rate</div>' +
    '<div class="inv-detail-value-mono">' + (item.rate ? formatCurrency(item.rate) : 'No rate') + '</div>';
  if (item.stdWeightKg != null) {
    html += '<div class="inv-detail-label">Standard Weight</div>' +
      '<div class="inv-detail-value-mono">' + formatNum(item.stdWeightKg, 3) + ' kg</div>';
  }
  html += '</div>';

  // Usage stats
  var cache = _buildUsageCache();
  var usage = cache[item.partNumber];
  html += '<div class="inv-detail-section">' +
    '<div class="inv-detail-label">Usage</div>';
  if (usage) {
    var invLines = 0;
    var imLines = 0;
    (S.invoices || []).forEach(function(inv) {
      inv.items.forEach(function(li) {
        if (li.partNumber === item.partNumber) invLines++;
      });
    });
    (S.incomingMaterial || []).forEach(function(im) {
      im.items.forEach(function(li) {
        if (li.partNumber === item.partNumber) imLines++;
      });
    });
    html += '<div class="inv-detail-value">' + usage.total + ' total references (' + usage.recent + ' in last 30 days)</div>' +
      '<div class="inv-detail-value inv-text-muted">' + invLines + ' invoice line' + (invLines !== 1 ? 's' : '') +
      ', ' + imLines + ' challan line' + (imLines !== 1 ? 's' : '') + '</div>';
  } else {
    html += '<div class="inv-detail-value inv-text-muted">Unused</div>';
  }
  html += '</div>';

  // Action buttons
  html += '<div class="inv-detail-actions">' +
    '<button class="inv-btn inv-btn-primary" data-action="invEditItem" data-id="' + item.id + '">Edit</button>' +
    '<button class="inv-btn inv-btn-danger" data-action="invDeleteItem" data-id="' + item.id + '">Delete</button>' +
    '</div>';

  var detailEl = document.getElementById('clientsDetail');
  if (detailEl) detailEl.innerHTML = html;

  // Update master to show active card highlight
  if (!skipMasterRefresh) {
    _itemsRendered = 0;
    _renderItemsList();
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
    listEl.innerHTML = '<div class="inv-empty-state">No items found</div>';
    if (moreEl) moreEl.innerHTML = '';
    return;
  }

  // For search results, render up to 100; otherwise batch
  var limit = search.length > 0 ? Math.min(total, 100) : Math.min(total, _itemsRendered + ITEMS_BATCH);
  if (_itemsRendered === 0) limit = Math.min(total, ITEMS_BATCH);

  var html = '<div class="inv-card-list">';
  for (var i = 0; i < limit; i++) {
    var it = _itemsSorted[i];
    var rateStr = (it.rate != null && it.rate > 0) ? formatCurrency(it.rate) : '';
    var noRate = !it.rate || it.rate === 0;
    var weightStr = it.stdWeightKg != null ? formatNum(it.stdWeightKg, 3) + ' kg' : '';
    var usageCount = _getUsageCount(it.partNumber);
    var isSelected = !!_itemsSelected[it.id];
    var itemAction = _isDesktop ? 'invSelectItemRow' : 'invEditItem';
    var itemActiveClass = (_isDesktop && _itemsActiveId === it.id) ? ' inv-item-card-active' : '';

    html += '<div class="inv-item-card' + (isSelected ? ' inv-item-selected' : '') + itemActiveClass + '" data-action="' + itemAction + '" data-id="' + it.id + '">' +
      '<div class="inv-item-card-top">' +
      '<label class="inv-item-check-wrap" data-action="invToggleItemSelect" data-id="' + it.id + '">' +
      '<input type="checkbox"' + (isSelected ? ' checked' : '') + ' class="inv-im-check"></label>' +
      '<span class="inv-item-pn inv-mono">' + escHtml(it.partNumber) + '</span>' +
      '<span class="inv-item-unit inv-client-badge inv-badge-mode">' + escHtml(it.unit) + '</span>' +
      '</div>' +
      '<div class="inv-item-card-bottom">' +
      '<span class="inv-item-desc">' + escHtml(it.desc || '') + '</span>' +
      '<span class="inv-item-rate inv-mono' + (noRate ? ' inv-text-muted' : ' inv-text-cost') + '">' +
      (noRate ? 'No rate' : rateStr) + '</span>' +
      '</div>' +
      '<div class="inv-item-badges-row">' +
      (weightStr ? '<span class="inv-weight-badge">' + escHtml(weightStr) + '</span>' : '') +
      (usageCount > 0 ? '<span class="inv-usage-badge">' + usageCount + ' ref' + (usageCount !== 1 ? 's' : '') + '</span>' :
        '<span class="inv-usage-badge inv-usage-zero">Unused</span>') +
      '</div>' +
      '</div>';
  }
  html += '</div>';

  listEl.innerHTML = html;
  _itemsRendered = limit;

  // Selection bar
  _renderItemsSelectionBar();

  // Load more button
  if (moreEl) {
    if (limit < total && search.length === 0) {
      moreEl.innerHTML = '<div class="inv-btn-bar inv-btn-bar-center">' +
        '<button class="inv-btn inv-btn-ghost" data-action="invLoadMoreItems">Load more (' + (total - limit) + ' remaining)</button></div>';
    } else {
      moreEl.innerHTML = '';
    }
  }

  // Phase 8E: Desktop detail validation — active item filtered out → clear detail
  if (_isDesktop && _itemsActiveId) {
    var stillVisible = _itemsSorted.find(function(it) { return it.id === _itemsActiveId; });
    if (!stillVisible) {
      _itemsActiveId = null;
      var detail = document.getElementById('clientsDetail');
      if (detail) detail.innerHTML = _renderDetailEmpty();
    }
  }
}

/* --- Add/Edit Item Overlay --- */
function openItemEdit(itemId) {
  var item = S.items.find(function(it) { return it.id === itemId; });
  if (!item) return;
  _showItemOverlay(item, false);
}

function openItemAdd() {
  _showItemOverlay(null, true);
}

function _showItemOverlay(item, isAdd) {
  var title = isAdd ? 'Add Item' : 'Edit Item';
  var pn = item ? item.partNumber : '';
  var desc = item ? item.desc : '';
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
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Part Number</label>' +
    '<input class="inv-form-input inv-mono" id="itemEditPN" value="' + escHtml(pn) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Description</label>' +
    '<input class="inv-form-input" id="itemEditDesc" value="' + escHtml(desc) + '"></div>' +
    '<div class="inv-form-row">' +
    '<div class="inv-form-group"><label class="inv-form-label">HSN Code</label>' +
    '<input class="inv-form-input inv-mono" id="itemEditHSN" value="' + escHtml(hsn) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Unit</label>' +
    '<select class="inv-form-select" id="itemEditUnit">' +
    '<option value="KG"' + (unit === 'KG' ? ' selected' : '') + '>KG</option>' +
    '<option value="NOS"' + (unit === 'NOS' ? ' selected' : '') + '>NOS</option></select></div></div>' +
    '<div class="inv-form-row">' +
    '<div class="inv-form-group"><label class="inv-form-label">Default Rate</label>' +
    '<input type="number" class="inv-form-input inv-mono" id="itemEditRate" value="' + rate + '" step="0.01" min="0"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Std Weight (kg)</label>' +
    '<input type="number" class="inv-form-input inv-mono" id="itemEditWeight" value="' + stdW + '" step="0.001" min="0" placeholder="Optional"></div></div>' +
    (refCount > 0 ? '<div class="inv-text-muted inv-storage-text">Referenced in ' + invRefs + ' invoice line' + (invRefs !== 1 ? 's' : '') + ', ' + imRefs + ' challan line' + (imRefs !== 1 ? 's' : '') + '</div>' : '') +
    '<div class="inv-btn-bar">' +
    (!isAdd ? '<button class="inv-btn inv-btn-danger inv-btn-sm" data-action="invDeleteItem" data-id="' + itemId + '">Delete</button>' : '') +
    '<button class="inv-btn inv-btn-ghost" data-action="invCloseOverlay">Cancel</button>' +
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
  var hsn = document.getElementById('itemEditHSN').value.trim() || '998873';
  var unit = document.getElementById('itemEditUnit').value;
  var rate = parseFloat(document.getElementById('itemEditRate').value) || 0;
  var wVal = document.getElementById('itemEditWeight').value.trim();
  var stdW = wVal !== '' ? parseFloat(wVal) : null;
  if (stdW !== null && (isNaN(stdW) || stdW < 0)) stdW = null;

  if (mode === 'add') {
    var maxId = S.items.reduce(function(mx, it) { return Math.max(mx, it.id); }, 0);
    S.items.push({
      id: maxId + 1,
      partNumber: pn,
      desc: desc,
      hsn: hsn,
      unit: unit,
      rate: rate,
      stdWeightKg: stdW
    });
    showToast('Item added: ' + pn);
  } else {
    var item = S.items.find(function(it) { return it.id === itemId; });
    if (!item) return;
    item.partNumber = pn;
    item.desc = desc;
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
  if (_isDesktop && _itemsActiveId === itemId) {
    _itemsActiveId = null;
    var detail = document.getElementById('clientsDetail');
    if (detail) detail.innerHTML = _renderDetailEmpty();
  }
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
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Merge Duplicates</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div>';

  if (groups.length === 0) {
    html += '<div class="inv-empty-state">No duplicate groups found</div>';
  } else {
    html += '<div class="inv-text-muted inv-storage-text inv-mb-16">' + groups.length + ' candidate group' + (groups.length !== 1 ? 's' : '') + ' found. Select the primary item in each group, then merge.</div>';
    groups.forEach(function(group, gi) {
      html += '<div class="inv-merge-group" id="mergeGroup' + gi + '">' +
        '<div class="inv-merge-group-header">' +
        '<span class="inv-card-title">Group ' + (gi + 1) + ' \u2014 ' + group.items.length + ' items</span>' +
        '<button class="inv-btn inv-btn-primary inv-btn-sm inv-merge-btn" data-action="invMergeGroup" data-group="' + gi + '">Merge</button>' +
        '</div>';
      group.items.forEach(function(it, ii) {
        html += '<label class="inv-merge-radio-row">' +
          '<input type="radio" name="mergePrimary' + gi + '" value="' + it.id + '"' + (ii === 0 ? ' checked' : '') + ' class="inv-merge-radio">' +
          '<div class="inv-merge-item-info">' +
          '<span class="inv-mono">' + escHtml(it.partNumber) + '</span> ' +
          '<span class="inv-client-badge inv-badge-mode">' + escHtml(it.unit) + '</span> ' +
          '<span class="inv-mono' + (it.rate > 0 ? ' inv-text-cost' : ' inv-text-muted') + '">' +
          (it.rate > 0 ? formatCurrency(it.rate) : 'No rate') + '</span>' +
          '</div>' +
          '<div class="inv-merge-item-desc inv-text-muted">' + escHtml(it.desc || '') + '</div>' +
          '</label>';
      });
      if (group._warn) {
        html += '<div class="inv-merge-warn">Review: descriptions differ within this group</div>';
      }
      html += '</div>';
    });
  }

  html += '<div class="inv-btn-bar"><button class="inv-btn inv-btn-ghost" data-action="invCloseOverlay">Close</button></div></div>';
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

  groupEl.innerHTML = '<div class="inv-merge-preview">' +
    '<div class="inv-card-title">Merge into: ' + escHtml(primary.partNumber) + '</div>' +
    '<div class="inv-text-muted inv-storage-text inv-mb-8">Will remove: ' + secondaries.length + ' duplicate item' + (secondaries.length !== 1 ? 's' : '') + '</div>' +
    '<div class="inv-text-muted inv-storage-text inv-mb-16">Will update: ' + invCount + ' invoice' + (invCount !== 1 ? 's' : '') + ', ' + imCount + ' challan' + (imCount !== 1 ? 's' : '') + '</div>' +
    '<div class="inv-btn-bar">' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invMergeCancelPreview" data-group="' + groupIdx + '">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invMergeConfirm" data-group="' + groupIdx + '" data-primary="' + primaryId + '">Confirm Merge</button>' +
    '</div></div>';
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
  // Toggle visual on card
  var card = document.querySelector('.inv-item-card[data-id="' + itemId + '"]');
  if (card) card.classList.toggle('inv-item-selected', !!_itemsSelected[itemId]);
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
  bar.innerHTML = '<div class="inv-im-sel-bar">' +
    '<span class="inv-im-sel-count">' + count + ' selected</span>' +
    '<div class="inv-items-sel-actions">' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm inv-sel-clear-btn" data-action="invClearItemSelection">Clear</button>' +
    '<button class="inv-im-sel-btn" data-action="invBatchDeleteItems">Delete</button>' +
    '</div></div>';
}
