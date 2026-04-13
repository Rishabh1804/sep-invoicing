/* ===== STATS (Phase 5 — Analytics) ===== */
function renderStats() {
  var area = document.getElementById('statsContent');
  if (!area) return;
  var activeInvs = S.invoices.filter(function(i) { return i.status === 'active'; });
  var now = new Date();
  var ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var mtdInvs = activeInvs.filter(function(i) { return i.date && i.date.startsWith(ym); });

  var html = '';

  // Revenue overview
  var totalRev = activeInvs.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0);
  var mtdRev = mtdInvs.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0);
  html += '<div class="inv-stats-card">' +
    '<div class="inv-stats-title">Revenue Overview</div>' +
    '<div class="inv-stats-metric"><span class="inv-stats-metric-label">All Time Taxable</span>' +
    '<span class="inv-stats-metric-value">' + formatCurrency(totalRev) + '</span></div>' +
    '<div class="inv-stats-metric"><span class="inv-stats-metric-label">MTD Taxable</span>' +
    '<span class="inv-stats-metric-value">' + formatCurrency(mtdRev) + '</span></div>' +
    '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Total Invoices</span>' +
    '<span class="inv-stats-metric-sub">' + activeInvs.length + ' active, ' + (S.invoices.length - activeInvs.length) + ' cancelled</span></div></div>';

  // Revenue by client (ranked)
  var clientRev = {};
  activeInvs.forEach(function(inv) {
    var key = inv.clientId;
    if (!clientRev[key]) clientRev[key] = { name: inv.clientName, total: 0, count: 0 };
    clientRev[key].total += (inv.taxableValue || 0);
    clientRev[key].count++;
  });
  var ranked = Object.values(clientRev).sort(function(a, b) { return b.total - a.total; });
  if (ranked.length > 0) {
    html += '<div class="inv-stats-card"><div class="inv-stats-title">Revenue by Client</div>';
    ranked.forEach(function(r, idx) {
      var pct = totalRev > 0 ? Math.round(r.total / totalRev * 100) : 0;
      html += '<div class="inv-stats-row">' +
        '<span class="inv-stats-rank">' + (idx + 1) + '</span>' +
        '<span class="inv-stats-name">' + escHtml(r.name) + ' <span class="inv-text-muted">(' + r.count + ')</span></span>' +
        '<span class="inv-stats-val">' + formatCurrency(r.total) + ' <span class="inv-text-muted">' + pct + '%</span></span></div>';
    });
    html += '</div>';
  }

  // Pending revenue by client (unbilled IM)
  var pendingByClient = {};
  (S.incomingMaterial || []).forEach(function(im) {
    im.items.forEach(function(it) {
      if (!it.invoiced) {
        var key = im.clientId;
        if (!pendingByClient[key]) pendingByClient[key] = { name: im.clientName, total: 0, items: 0 };
        pendingByClient[key].total += (it.amount || 0);
        pendingByClient[key].items++;
      }
    });
  });
  var pendingRanked = Object.values(pendingByClient).sort(function(a, b) { return b.total - a.total; });
  if (pendingRanked.length > 0) {
    var totalPending = pendingRanked.reduce(function(s, r) { return s + r.total; }, 0);
    html += '<div class="inv-stats-card"><div class="inv-stats-title">Pending Revenue (Unbilled IM)</div>' +
      '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Total Unbilled</span>' +
      '<span class="inv-stats-metric-value">' + formatCurrency(totalPending) + '</span></div>';
    pendingRanked.forEach(function(r) {
      html += '<div class="inv-stats-row">' +
        '<span class="inv-stats-name">' + escHtml(r.name) + ' <span class="inv-text-muted">(' + r.items + ' items)</span></span>' +
        '<span class="inv-stats-val">' + formatCurrency(r.total) + '</span></div>';
    });
    html += '</div>';
  }

  // Dispatch cycle (avg days between states)
  var dispatchDays = [];
  var deliveryDays = [];
  var fullCycleDays = [];
  activeInvs.forEach(function(inv) {
    if (inv.createdAt && inv.dispatchedAt) {
      dispatchDays.push((inv.dispatchedAt - inv.createdAt) / 86400000);
    }
    if (inv.dispatchedAt && inv.deliveredAt) {
      deliveryDays.push((inv.deliveredAt - inv.dispatchedAt) / 86400000);
    }
    if (inv.createdAt && inv.deliveredAt) {
      fullCycleDays.push((inv.deliveredAt - inv.createdAt) / 86400000);
    }
  });
  function avg(arr) { return arr.length > 0 ? (arr.reduce(function(a, b) { return a + b; }, 0) / arr.length) : null; }
  var avgDispatch = avg(dispatchDays);
  var avgDelivery = avg(deliveryDays);
  var avgFull = avg(fullCycleDays);
  if (avgDispatch !== null || avgDelivery !== null) {
    html += '<div class="inv-stats-card"><div class="inv-stats-title">Dispatch Cycle</div>';
    if (avgDispatch !== null) {
      html += '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Created to Dispatched</span>' +
        '<span class="inv-stats-metric-sub">' + formatNum(avgDispatch, 1) + ' days avg (' + dispatchDays.length + ' invoices)</span></div>';
    }
    if (avgDelivery !== null) {
      html += '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Dispatched to Delivered</span>' +
        '<span class="inv-stats-metric-sub">' + formatNum(avgDelivery, 1) + ' days avg (' + deliveryDays.length + ' invoices)</span></div>';
    }
    if (avgFull !== null) {
      html += '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Full Cycle (Create to Deliver)</span>' +
        '<span class="inv-stats-metric-sub">' + formatNum(avgFull, 1) + ' days avg (' + fullCycleDays.length + ' invoices)</span></div>';
    }
    html += '</div>';
  }

  // Client billing frequency (challans per client)
  var challanByClient = {};
  (S.incomingMaterial || []).forEach(function(im) {
    var key = im.clientId;
    if (!challanByClient[key]) challanByClient[key] = { name: im.clientName, count: 0, totalAmt: 0 };
    challanByClient[key].count++;
    challanByClient[key].totalAmt += im.items.reduce(function(s, it) { return s + (it.amount || 0); }, 0);
  });
  var challanRanked = Object.values(challanByClient).sort(function(a, b) { return b.count - a.count; });
  if (challanRanked.length > 0) {
    html += '<div class="inv-stats-card"><div class="inv-stats-title">Challans by Client</div>';
    challanRanked.forEach(function(r) {
      html += '<div class="inv-stats-row">' +
        '<span class="inv-stats-name">' + escHtml(r.name) + '</span>' +
        '<span class="inv-stats-val">' + r.count + ' challans &middot; ' + formatCurrency(r.totalAmt) + '</span></div>';
    });
    html += '</div>';
  }

  // Invoice state summary
  var stateCount = { created: 0, dispatched: 0, delivered: 0, filed: 0 };
  activeInvs.forEach(function(inv) {
    var s = getInvState(inv);
    if (stateCount[s] != null) stateCount[s]++;
  });
  html += '<div class="inv-stats-card"><div class="inv-stats-title">Invoice States</div>' +
    '<div class="inv-stats-row"><span class="inv-stats-name">Created</span><span class="inv-state-badge inv-state-created">' + stateCount.created + '</span></div>' +
    '<div class="inv-stats-row"><span class="inv-stats-name">Dispatched</span><span class="inv-state-badge inv-state-dispatched">' + stateCount.dispatched + '</span></div>' +
    '<div class="inv-stats-row"><span class="inv-stats-name">Delivered</span><span class="inv-state-badge inv-state-delivered">' + stateCount.delivered + '</span></div>' +
    '<div class="inv-stats-row"><span class="inv-stats-name">Filed</span><span class="inv-state-badge inv-state-filed">' + stateCount.filed + '</span></div></div>';

  if (html === '') html = '<div class="inv-empty-state">No data yet. Create invoices and log incoming material to see analytics.</div>';
  area.innerHTML = html;
}

/* ===== HISTORY (Phase 5 — Activity Log) ===== */
var _historyClientFilter = '';

function renderHistory() {
  var toolbar = document.getElementById('historyToolbar');
  var area = document.getElementById('historyList');
  if (!area) return;

  // Toolbar: client filter
  if (toolbar) {
    var clientIds = new Set();
    S.invoices.forEach(function(i) { clientIds.add(i.clientId); });
    (S.incomingMaterial || []).forEach(function(im) { clientIds.add(im.clientId); });
    var clientOpts = '';
    clientIds.forEach(function(cid) {
      var c = S.clients.find(function(x) { return x.id === cid; });
      if (c) clientOpts += '<option value="' + cid + '"' + (_historyClientFilter == cid ? ' selected' : '') + '>' + escHtml(c.name) + '</option>';
    });
    toolbar.innerHTML = '<div class="inv-im-toolbar"><div class="inv-form-group"><select class="inv-form-select" id="historyClientFilter" data-action="invFilterHistory">' +
      '<option value="">All Clients</option>' + clientOpts + '</select></div></div>';
  }

  // Build timeline events from all sources
  var events = [];

  // Invoices
  S.invoices.forEach(function(inv) {
    if (_historyClientFilter && inv.clientId != _historyClientFilter) return;
    events.push({ ts: inv.createdAt, type: 'invoice', text: 'Invoice ' + (inv.displayNumber || '') + ' created for ' + (inv.clientName || ''), amount: inv.grandTotal, dot: 'invoice' });
    if (inv.dispatchedAt) events.push({ ts: inv.dispatchedAt, type: 'state', text: (inv.displayNumber || '') + ' dispatched', dot: 'state' });
    if (inv.deliveredAt) events.push({ ts: inv.deliveredAt, type: 'state', text: (inv.displayNumber || '') + ' delivered (signed copy received)', dot: 'state' });
    if (inv.filedAt) events.push({ ts: inv.filedAt, type: 'state', text: (inv.displayNumber || '') + ' marked as filed in GSTR1', dot: 'state' });
    if (inv.status === 'cancelled' && inv.cancelledAt) events.push({ ts: inv.cancelledAt, type: 'cancel', text: (inv.displayNumber || '') + ' cancelled', dot: 'cancel' });
    if (inv.updatedAt && inv.updatedAt !== inv.createdAt) events.push({ ts: inv.updatedAt, type: 'state', text: (inv.displayNumber || '') + ' edited', dot: 'state' });
  });

  // Challans
  (S.incomingMaterial || []).forEach(function(im) {
    if (_historyClientFilter && im.clientId != _historyClientFilter) return;
    var challanAmt = im.items.reduce(function(s, it) { return s + (it.amount || 0); }, 0);
    events.push({
      ts: im.createdAt,
      type: 'challan',
      text: 'Challan' + (im.challanNo ? ' ' + im.challanNo : '') + ' received from ' + (im.clientName || '') + ' (' + im.items.length + ' item' + (im.items.length > 1 ? 's' : '') + ')',
      amount: challanAmt,
      dot: 'challan'
    });
  });

  // Sort by timestamp descending
  events.sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });

  if (events.length === 0) {
    area.innerHTML = '<div class="inv-empty-state">No activity yet</div>';
    return;
  }

  var html = '<div class="inv-stats-card">' +
    '<div class="inv-stats-title">Activity Log (' + events.length + ' events)</div>';
  // Cap at 100 for performance
  var shown = events.slice(0, 100);
  shown.forEach(function(ev) {
    html += '<div class="inv-history-item">' +
      '<div class="inv-history-dot inv-history-dot-' + ev.dot + '"></div>' +
      '<div class="inv-history-body">' +
      '<div class="inv-history-text">' + escHtml(ev.text) +
      (ev.amount ? ' &middot; ' + formatCurrency(ev.amount) : '') + '</div>' +
      '<div class="inv-history-meta">' + (ev.ts ? formatTimestamp(ev.ts) : '') + '</div>' +
      '</div></div>';
  });
  if (events.length > 100) {
    html += '<div class="inv-text-muted inv-text-center">Showing 100 of ' + events.length + ' events</div>';
  }
  html += '</div>';
  area.innerHTML = html;
}

