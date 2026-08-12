/* ===== INIT ===== */

/* Phase 4: Seed NOS qty on Dorabji + Highco IM items (one-time migration) */
if (S.incomingMaterial && S.incomingMaterial.length > 0 && !S._nosQtySeeded) {
  var nosMap = {"IMI-0001-0":198,"IMI-0001-1":172,"IMI-0002-0":395,"IMI-0002-1":30,"IMI-0002-2":100,"IMI-0003-0":196,"IMI-0004-0":475,"IMI-0004-1":200,"IMI-0005-0":444,"IMI-0005-1":100,"IMI-0005-2":100,"IMI-0006-0":215,"IMI-0007-0":290,"IMI-0008-0":388,"IMI-0008-1":76,"IMI-0008-2":100,"IMI-0009-0":1464,"IMI-0010-0":294,"IMI-0010-1":200,"IMI-0011-0":178,"IMI-0012-0":200,"IMI-0013-0":100,"IMI-0014-0":280,"IMI-0014-1":150,"IMI-0015-0":602,"IMI-0015-1":50,"IMI-0016-0":246,"IMI-0016-1":510,"IMI-0016-2":108,"IMI-0017-0":270,"IMI-0018-0":157,"IMI-0019-0":70,"IMI-0019-1":148,"IMI-0050-0":80};
  S.incomingMaterial.forEach(function(im) {
    im.items.forEach(function(it) {
      if (nosMap[it.id] != null) it.nosQty = nosMap[it.id];
    });
  });
  S._nosQtySeeded = true;
  saveJSON(STORAGE_KEY, S);
}

/* Phase 4: Seed 7 scanned challans from Apr 8-9 delivery challan photos */
if (!S._scanSeed1) {
  var scanned = [
    {"id":"IM-SC-036","challanNo":"36","challanDate":"2026-04-08","clientId":1,"clientName":"DORABJI AUTO","vehicleNo":"JH 05BZ 9693","items":[{"id":"IM-SC-036-0","partNumber":"5069 4370 0108","desc":"Bracket 5069 4370 0108 (Kanghi)","hsn":"998873","unit":"KG","qty":60.4,"rate":13,"amount":785.2,"nosQty":592,"invoiced":false,"invoiceId":null},{"id":"IM-SC-036-1","partNumber":"5079 5470 0101","desc":"Bracket 5079 5470 0101 (Chidiya)","hsn":"998873","unit":"KG","qty":64.1,"rate":13,"amount":833.3,"nosQty":504,"invoiced":false,"invoiceId":null},{"id":"IM-SC-036-2","partNumber":"5181 4370 0105","desc":"Bracket 5181 4370 0105","hsn":"998873","unit":"KG","qty":46.4,"rate":13,"amount":603.2,"nosQty":197,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-08","notes":"","createdAt":1775721660000},
    {"id":"IM-SC-037","challanNo":"37","challanDate":"2026-04-08","clientId":1,"clientName":"DORABJI AUTO","vehicleNo":"JH 05BZ 9693","items":[{"id":"IM-SC-037-0","partNumber":"2525 2015 8202","desc":"Bracket 2525 2015 8202","hsn":"998873","unit":"KG","qty":1.7,"rate":13,"amount":22.1,"nosQty":8,"invoiced":false,"invoiceId":null},{"id":"IM-SC-037-1","partNumber":"5737 0117 3304","desc":"Bracket 5737 0117 3304","hsn":"998873","unit":"KG","qty":57.1,"rate":13,"amount":742.3,"nosQty":1019,"invoiced":false,"invoiceId":null},{"id":"IM-SC-037-2","partNumber":"5567 5450 0103","desc":"Bracket 5567 5450 0103","hsn":"998873","unit":"KG","qty":10.2,"rate":13,"amount":132.6,"nosQty":17,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-08","notes":"","createdAt":1775721661000},
    {"id":"IM-SC-038","challanNo":"38","challanDate":"2026-04-08","clientId":1,"clientName":"DORABJI AUTO","vehicleNo":"JH 05DN 6730","items":[{"id":"IM-SC-038-0","partNumber":"2715 2671 0140","desc":"Bracket 2715 2671 0140 (New Material)","hsn":"998873","unit":"KG","qty":105.5,"rate":13,"amount":1371.5,"nosQty":300,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-08","notes":"","createdAt":1775721662000},
    {"id":"IM-SC-039","challanNo":"39","challanDate":"2026-04-08","clientId":1,"clientName":"DORABJI AUTO","vehicleNo":"JH 05DL 3376","items":[{"id":"IM-SC-039-0","partNumber":"5181 4370 0105","desc":"Bracket 5181 4370 0105","hsn":"998873","unit":"KG","qty":23.2,"rate":13,"amount":301.6,"nosQty":98,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-08","notes":"","createdAt":1775721663000},
    {"id":"IM-SC-041","challanNo":"41","challanDate":"2026-04-09","clientId":1,"clientName":"DORABJI AUTO","vehicleNo":"JH 05DL 4176","items":[{"id":"IM-SC-041-0","partNumber":"5152 4370 3301","desc":"Twist Bracket 5152 4370 3301","hsn":"998873","unit":"KG","qty":23.8,"rate":13,"amount":309.4,"nosQty":100,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-09","notes":"","createdAt":1775721664000},
    {"id":"IM-SC-M41","challanNo":"41","challanDate":"2026-04-08","clientId":2,"clientName":"SSSMEHTA ENTERPRISES AND INDUSTRIES PVT LTD","vehicleNo":"JH 05DR 2505","items":[{"id":"IM-SC-M41-0","partNumber":"Clamp 106x81","desc":"Clamp 106x81 (25x6)","hsn":"998873","unit":"NOS","qty":237,"rate":2.24,"amount":530.88,"nosQty":237,"invoiced":false,"invoiceId":null},{"id":"IM-SC-M41-1","partNumber":"Clamp 74x81","desc":"Clamp 74x81 (25x6)","hsn":"998873","unit":"NOS","qty":240,"rate":1.81,"amount":434.4,"nosQty":240,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-08","notes":"","createdAt":1775721665000},
    {"id":"IM-SC-M43","challanNo":"43","challanDate":"2026-04-09","clientId":2,"clientName":"SSSMEHTA ENTERPRISES AND INDUSTRIES PVT LTD","vehicleNo":"JH 05DR 2505","items":[{"id":"IM-SC-M43-0","partNumber":"Clamp 133x83","desc":"Clamp 133x83 (40x6)","hsn":"998873","unit":"NOS","qty":358,"rate":4.24,"amount":1517.92,"nosQty":358,"invoiced":false,"invoiceId":null},{"id":"IM-SC-M43-1","partNumber":"Clamp 165x83","desc":"Clamp 165x83 (40x6)","hsn":"998873","unit":"NOS","qty":365,"rate":4.89,"amount":1784.85,"nosQty":365,"invoiced":false,"invoiceId":null},{"id":"IM-SC-M43-2","partNumber":"Clamp 181x83","desc":"Clamp 181x83 (40x6)","hsn":"998873","unit":"NOS","qty":368,"rate":5.06,"amount":1862.08,"nosQty":368,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-09","notes":"","createdAt":1775721666000}
  ];
  scanned.forEach(function(ch) { S.incomingMaterial.push(ch); });
  S._scanSeed1 = true;
  saveState();
}

/* Phase 5: Migrate existing invoices to lifecycle states */
(function() {
  var migrated = 0;
  (S.invoices || []).forEach(function(inv) {
    if (!inv.invoiceState) {
      inv.invoiceState = 'created';
      if (!inv.dispatchedAt) inv.dispatchedAt = null;
      if (!inv.deliveredAt) inv.deliveredAt = null;
      if (!inv.filedAt) inv.filedAt = null;
      migrated++;
    }
  });
  if (migrated > 0) saveJSON(STORAGE_KEY, S);
})();

/* Phase 5: Seed recentVehicles on clients from IM challan data */
(function() {
  var seeded = false;
  (S.incomingMaterial || []).forEach(function(im) {
    if (!im.vehicleNo || !im.vehicleNo.trim()) return;
    var v = im.vehicleNo.trim().toUpperCase();
    var client = S.clients.find(function(c) { return c.id === im.clientId; });
    if (!client) return;
    if (!client.recentVehicles) { client.recentVehicles = []; seeded = true; }
    if (client.recentVehicles.indexOf(v) < 0) {
      client.recentVehicles.push(v);
      seeded = true;
    }
  });
  if (seeded) saveJSON(STORAGE_KEY, S);
})();

/* Phase 5: Orphan detection — reset IM items pointing to deleted invoices */
(function() {
  var invoiceIds = {};
  (S.invoices || []).forEach(function(inv) { invoiceIds[inv.id] = true; });
  var repaired = 0;
  (S.incomingMaterial || []).forEach(function(im) {
    im.items.forEach(function(it) {
      if (it.invoiced && (!it.invoiceId || !invoiceIds[it.invoiceId])) {
        it.invoiced = false;
        it.invoiceId = null;
        repaired++;
      }
    });
  });
  if (repaired > 0) {
    saveJSON(STORAGE_KEY, S);
    console.log('Orphan repair: reset ' + repaired + ' IM item(s) pointing to deleted invoices');
  }
})();

/* Lift a bare gauge out of the description into its own field. Idempotent.

   166 catalogue rows used `desc` to hold nothing but a steel strip size —
   "40X6", "25X6" — which is a specification, not a description. It is also
   the only thing distinguishing several clamp rows that share a part number,
   so it needs to be a field the app can see rather than free text.

   The rule is deliberately narrow: exactly two dimensions, and the text must
   not simply repeat the part number (part "82X81" describes itself and is not
   a gauge). Three-dimension values like "150X68X3" are sizes, not gauges, and
   are left alone. */
(function() {
  var GAUGE_RE = /^\s*\d+\s*[Xx]\s*\d+\s*$/;
  var moved = 0;
  (S.items || []).forEach(function(it) {
    if (it.gauge) return;
    var d = String(it.desc || '').trim();
    if (!GAUGE_RE.test(d)) return;
    if (d.toLowerCase() === String(it.partNumber || '').trim().toLowerCase()) return;
    it.gauge = d.toUpperCase();
    it.desc = '';
    moved++;
  });
  if (moved > 0) {
    saveJSON(STORAGE_KEY, S);
    console.log('Items Master: moved ' + moved + ' gauge value(s) out of the description field');
  }
})();

/* Repair duplicate item ids. Idempotent.

   The seed shipped id 4586 on two different rows (CLAMP 45X86(BOX) and
   BOX CLAMP 45X86). Every lookup — openItemEdit, _renderItemDetail,
   selectPartForLine — resolves by id through .find(), so the second row was
   unreachable and picking it in autocomplete silently selected the first. */
(function() {
  var seen = {};
  var maxId = (S.items || []).reduce(function(mx, it) { return Math.max(mx, it.id || 0); }, 0);
  var repaired = 0;
  (S.items || []).forEach(function(it) {
    if (it.id == null || seen[it.id]) {
      it.id = ++maxId;
      repaired++;
    }
    seen[it.id] = true;
  });
  if (repaired > 0) {
    saveJSON(STORAGE_KEY, S);
    console.log('Items Master: reassigned ' + repaired + ' duplicate item id(s)');
  }
})();

/* Collapse redundant Items Master rows. Idempotent — no version flag needed.

   A row is redundant ONLY when another row matches it on partNumber, gauge,
   unit, rate AND stdWeightKg, and at most one distinct informative
   description exists in the group ("informative" = non-empty and not just a
   copy of the part number). The discarded row then carries no information the
   kept row lacks, so this cannot lose data.

   Deliberately conservative: rows sharing a part number but differing in
   gauge, rate or unit are LEFT ALONE. CLAMP 133X83 (NT) exists as 35X6 at
   3.67 and 40X6 at 4.24. Nothing prices off these rows — invoice and challan
   lines both resolve rate through getLineItemRate() against the client ladder
   — so merging them would misprice nothing today, but it would erase the only
   record of which gauge costs what. Use the Merge tool for judgement calls. */
(function() {
  var items = S.items || [];
  var groups = {};
  var order = [];

  function keyOf(it) {
    return [
      String(it.partNumber || '').trim().toLowerCase(),
      String(it.gauge || '').trim().toUpperCase(),
      it.unit || '',
      it.rate == null ? 0 : it.rate,
      it.stdWeightKg == null ? '' : it.stdWeightKg
    ].join('\u0000');
  }

  function informative(it) {
    var d = String(it.desc || '').trim();
    return d !== '' && d.toLowerCase() !== String(it.partNumber || '').trim().toLowerCase();
  }

  items.forEach(function(it) {
    var k = keyOf(it);
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(it);
  });

  var kept = [];
  order.forEach(function(k) {
    var group = groups[k];
    if (group.length < 2) { kept.push(group[0]); return; }
    var descs = {};
    group.forEach(function(it) {
      if (informative(it)) descs[String(it.desc).trim().toLowerCase()] = true;
    });
    // Conflicting real descriptions — not safely mergeable, keep every row.
    if (Object.keys(descs).length > 1) { kept.push.apply(kept, group); return; }
    var winner = null;
    for (var i = 0; i < group.length; i++) {
      if (informative(group[i])) { winner = group[i]; break; }
    }
    kept.push(winner || group[0]);
  });

  if (kept.length !== items.length) {
    var removed = items.length - kept.length;
    S.items = kept;
    saveJSON(STORAGE_KEY, S);
    console.log('Items Master: collapsed ' + removed + ' redundant row' + (removed !== 1 ? 's' : ''));
  }
})();

/* Phase 6b: Remove Belrise trading items (rate > 25) — one-time cleanup */
if (!S._rateCleanup1) {
  var before = S.items.length;
  S.items = S.items.filter(function(it) { return (it.rate || 0) <= 25; });
  var removed = before - S.items.length;
  if (removed > 0) console.log('Rate cleanup: removed ' + removed + ' items with rate > 25 (Belrise trading remnants)');
  S._rateCleanup1 = true;
  saveJSON(STORAGE_KEY, S);
}

/* Phase 9: Default cost per KG for margin dashboard (IL-4) — idempotent */
if (S.defaultCostPerKg === undefined) {
  S.defaultCostPerKg = 8.55;
  saveJSON(STORAGE_KEY, S);
}

/* Derive standard weights from piece pricing — one-time, idempotent.

   Stats measures this business in rupees per kilogram, and a line whose part
   has no weight cannot be counted at all. On live data 90 of 168 catalogue rows
   had no weight, and the gap was not random: it was almost entirely the
   piece-billed work, which is the low-realisation end of the book. So tonnage
   covered 61% of revenue and realisation was computed over the well-priced
   remainder — the one account the figures existed to examine was the one they
   could not see. Leaving that behind a button nobody had pressed made the
   dashboard quietly wrong rather than visibly incomplete.

   Where a client bills per piece off a rate per kg, weight = pieceRate /
   ratePerKg recovers the weight exactly. It fills only empty weights and never
   touches billing: rates resolve through getLineItemRate() against the client
   ladder, and stdWeightKg is read by Stats and Items Master alone. The
   nos_to_weight billing path reads S.partWeights, which this does not write.

   Note what such a weight is and is not. Defined as rate/ratePerKg it prices
   back at exactly ratePerKg, so it measures tonnage, not margin.

   The flag is only set once there was something to derive from, so a device
   that loads empty and imports a backup afterwards still gets its pass. */
if (!S._deriveWeights1) {
  var _dw = applyDerivedWeights();
  if (_dw.sources > 0) {
    S._deriveWeights1 = true;
    saveJSON(STORAGE_KEY, S);
    if (_dw.derived > 0) {
      console.log('Weights: derived ' + _dw.derived + ' from piece rates' +
        (_dw.highVariance > 0 ? ' (' + _dw.highVariance + ' with inconsistent rates)' : ''));
    }
  }
}

/* ===== LAYOUT MODE (Phase 8A) ===== */
var _resizeTimer = null;

function updateLayoutMode() {
  var w = window.innerWidth;
  var newDesktop = w >= 1024;
  var newTablet = w >= 768 && w < 1024;

  // No mode change — just update tablet class
  if (newDesktop === _isDesktop) {
    _isTablet = newTablet;
    document.body.classList.toggle('inv-tablet', _isTablet);
    return;
  }

  // Mode change — defer if overlay or form is active
  if (document.querySelector('.inv-overlay-scrim') || _challanForm) {
    _pendingModeSwitch = true;
    return;
  }

  _applyModeSwitch(newDesktop, newTablet);
}

function _applyModeSwitch(newDesktop, newTablet) {
  _isDesktop = newDesktop;
  _isTablet = newTablet;
  document.body.classList.toggle('inv-desktop', _isDesktop);
  document.body.classList.toggle('inv-tablet', _isTablet);
  _regToolbarRendered = false;
  _imToolbarRendered = false;
  renderSidebar();
  switchTab(regFilter.activeTab || 'pageHome');
}

function renderSidebar() {
  var existing = document.getElementById('invSidebar');
  if (existing) existing.remove();
  if (!_isDesktop) return;

  var tabs = [
    { id: 'pageHome', label: 'Home', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>' },
    { id: 'pageCreate', label: 'Create', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>' },
    { id: 'pageIM', label: 'IM', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>' },
    { id: 'pageRegister', label: 'Register', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
    { id: 'pageClients', label: 'Clients', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>' },
    { id: 'pageStats', label: 'Stats', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>' },
    { id: 'pageHistory', label: 'History', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' }
  ];

  var activeTab = regFilter.activeTab || 'pageHome';
  var html = '<div class="inv-sidebar-inner">';
  tabs.forEach(function(t) {
    var cls = 'inv-sidebar-item' + (t.id === activeTab ? ' inv-sidebar-active' : '');
    html += '<button class="' + cls + '" data-action="invSwitchTab" data-tab="' + t.id + '">' +
      t.icon + '<span class="inv-sidebar-label">' + escHtml(t.label) + '</span></button>';
  });
  html += '<div class="inv-sidebar-spacer"></div>';
  html += '<button class="inv-sidebar-item" data-action="invOpenSettings">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>' +
    '<span class="inv-sidebar-label">Settings</span></button>';
  html += '</div>';

  var sidebar = document.createElement('nav');
  sidebar.className = 'inv-sidebar';
  sidebar.id = 'invSidebar';
  sidebar.innerHTML = html;
  document.body.insertBefore(sidebar, document.body.firstChild);

  // Touch-desktop fallback
  sidebar.addEventListener('click', function(e) {
    if (e.target.closest('[data-action]')) {
      // Nav click — collapse after navigation on touch devices
      if (!window.matchMedia('(hover: hover)').matches) {
        sidebar.classList.remove('inv-sidebar-expanded');
      }
      return;
    }
    // Background tap — toggle expand/collapse
    if (!window.matchMedia('(hover: hover)').matches) {
      sidebar.classList.toggle('inv-sidebar-expanded');
    }
  });
}

// One-time outside-tap handler for sidebar collapse
document.addEventListener('click', function(e) {
  var sb = document.getElementById('invSidebar');
  if (sb && !sb.contains(e.target)) {
    sb.classList.remove('inv-sidebar-expanded');
  }
});

/* ===== GLOBAL DRAG HANDLERS (Phase 8B) ===== */
function _onDragMove(clientX) {
  if (!_dragState) return;
  var dx = clientX - _dragState.startX;
  var newW = _dragState.masterStart + dx;
  var minMaster = 280, minDetail = 320;
  var maxMaster = _dragState.containerW - minDetail;
  newW = Math.max(minMaster, Math.min(maxMaster, newW));
  document.getElementById(_dragState.masterId).style.width = (newW / _dragState.containerW * 100) + '%';
}

function _onDragEnd() {
  if (!_dragState) return;
  var master = document.getElementById(_dragState.masterId);
  var ratio = master.offsetWidth / master.parentElement.offsetWidth;
  if (!regFilter.desktopPanelWidths) regFilter.desktopPanelWidths = {};
  regFilter.desktopPanelWidths[_dragState.tabKey] = ratio;
  saveRegFilter();
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  _dragState = null;
}

document.addEventListener('mousemove', function(e) { _onDragMove(e.clientX); });
document.addEventListener('mouseup', _onDragEnd);
document.addEventListener('touchmove', function(e) {
  if (!_dragState) return;
  e.preventDefault();
  _onDragMove(e.touches[0].clientX);
}, { passive: false });
document.addEventListener('touchend', _onDragEnd);

// Debounced ResizeObserver
new ResizeObserver(function() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(updateLayoutMode, 150);
}).observe(document.documentElement);

/* Manifest app shortcuts land here as ?tab=<pageId>[&new=1]. Writing the target
   into regFilter before the first layout pass means both the desktop and the
   mobile restore paths pick it up without a second switchTab, and the query is
   stripped so a later refresh returns to the ordinary saved tab. */
var _launchNew = false;
(function() {
  var params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
  var wanted = params.get('tab');
  if (!wanted || !document.getElementById(wanted)) return;
  regFilter.activeTab = wanted;
  saveRegFilter();
  _launchNew = params.get('new') === '1';
  try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
})();

// Initial layout detection (no debounce)
updateLayoutMode();

/* Phase 6b: Restore active tab on refresh */
// If updateLayoutMode triggered _applyModeSwitch, it already called switchTab.
// Only do manual restore if we're still on mobile (no mode switch happened).
if (!_isDesktop) {
  var _savedTab = regFilter.activeTab || 'pageHome';
  if (_savedTab !== 'pageHome' && document.getElementById(_savedTab)) {
    switchTab(_savedTab);
  } else {
    renderHome();
  }
}

/* The "Add Challan" app shortcut opens the form, not just the tab. Runs after
   the tab restore above so the IM view exists to render into. */
if (_launchNew && regFilter.activeTab === 'pageIM' && !_isDesktop) {
  showAddChallanForm();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
