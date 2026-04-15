/* ===== STATS (Phase 7 — Analytics Rework) ===== */
var _statsPeriod = 'mtd';

function filterByPeriod(invoices, period) {
  if (period === 'all') return invoices;
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth();
  var startDate;
  if (period === 'mtd') {
    startDate = new Date(y, m, 1);
  } else if (period === 'qtd') {
    var qStart = m - (m % 3);
    startDate = new Date(y, qStart, 1);
  } else if (period === 'ytd') {
    startDate = m >= 3 ? new Date(y, 3, 1) : new Date(y - 1, 3, 1);
  }
  var startTs = startDate.getTime();
  return invoices.filter(function(inv) {
    return (inv.createdAt || 0) >= startTs;
  });
}

function buildMonthlyRevenue(invoices) {
  var byMonth = {};
  invoices.forEach(function(inv) {
    if (!inv.date) return;
    var ym = inv.date.substring(0, 7);
    if (!byMonth[ym]) byMonth[ym] = 0;
    byMonth[ym] += (inv.taxableValue || 0);
  });
  var months = Object.keys(byMonth).sort();
  var last12 = months.slice(-12);
  var labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return last12.map(function(ym) {
    var parts = ym.split('-');
    return { label: labels[parseInt(parts[1]) - 1] + ' ' + parts[0].slice(2), value: byMonth[ym] };
  });
}

function buildTopItems(invoices) {
  var byPart = {};
  invoices.forEach(function(inv) {
    (inv.items || []).forEach(function(it) {
      var key = it.partNumber || it.desc || 'Unknown';
      if (!byPart[key]) byPart[key] = { part: key, desc: it.desc || '', qty: 0, amount: 0 };
      byPart[key].qty += (it.qty || 0);
      byPart[key].amount += (it.amount || 0);
    });
  });
  return Object.values(byPart).sort(function(a, b) { return b.qty - a.qty; }).slice(0, 10);
}

function renderRevenueBarSvg(ranked, maxVal) {
  if (ranked.length === 0) return '<div class="inv-text-muted">No client data</div>';
  var barH = 28, gap = 8, padTop = 4, padBot = 4;
  var totalH = padTop + ranked.length * (barH + gap) - gap + padBot;
  var svg = '<svg class="inv-svg-chart" viewBox="0 0 400 ' + totalH + '" preserveAspectRatio="xMinYMin meet">';
  ranked.forEach(function(r, i) {
    var y = padTop + i * (barH + gap);
    var w = maxVal > 0 ? (r.total / maxVal) * 200 : 0;
    svg += '<g class="inv-svg-bar-group" data-action="invStatsClientDrill" data-client-id="' + r.clientId + '">';
    svg += '<rect x="0" y="' + y + '" width="' + Math.max(w, 2) + '" height="' + barH + '" rx="3" class="inv-svg-bar"/>';
    svg += '<text x="' + (Math.max(w, 2) + 6) + '" y="' + (y + 12) + '" class="inv-svg-bar-label">' + escHtml(r.name) + '</text>';
    svg += '<text x="' + (Math.max(w, 2) + 6) + '" y="' + (y + 24) + '" class="inv-svg-bar-amount">' + formatCurrency(r.total) + '</text>';
    svg += '</g>';
  });
  svg += '</svg>';
  return svg;
}

function renderTrendSvg(monthlyData) {
  if (monthlyData.length < 2) return '<div class="inv-text-muted">Need 2+ months of data for trend</div>';
  var W = 400, H = 160, padL = 10, padR = 40, padT = 20, padB = 30;
  var chartW = W - padL - padR, chartH = H - padT - padB;
  var maxVal = Math.max.apply(null, monthlyData.map(function(d) { return d.value; }));
  if (maxVal === 0) maxVal = 1;
  var points = monthlyData.map(function(d, i) {
    var x = padL + (i / (monthlyData.length - 1)) * chartW;
    var y = padT + chartH - (d.value / maxVal) * chartH;
    return { x: x, y: y, label: d.label, value: d.value };
  });
  var polyline = points.map(function(p) { return p.x + ',' + p.y; }).join(' ');
  var areaPath = 'M' + points[0].x + ',' + (padT + chartH) +
    ' L' + points.map(function(p) { return p.x + ',' + p.y; }).join(' L') +
    ' L' + points[points.length - 1].x + ',' + (padT + chartH) + ' Z';

  var svg = '<svg class="inv-svg-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
  for (var g = 0; g <= 3; g++) {
    var gy = padT + (g / 3) * chartH;
    var gVal = maxVal - (g / 3) * maxVal;
    svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" class="inv-svg-grid"/>';
    svg += '<text x="' + (W - padR + 4) + '" y="' + (gy + 4) + '" class="inv-svg-grid-label">' + (gVal >= 100000 ? formatNum(gVal / 100000, 1) + 'L' : formatNum(gVal / 1000, 0) + 'K') + '</text>';
  }
  svg += '<path d="' + areaPath + '" class="inv-svg-area"/>';
  svg += '<polyline points="' + polyline + '" class="inv-svg-line"/>';
  points.forEach(function(p) {
    svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="3.5" class="inv-svg-dot"/>';
    svg += '<text x="' + p.x + '" y="' + (padT + chartH + 16) + '" text-anchor="middle" class="inv-svg-axis-label">' + p.label + '</text>';
  });
  svg += '</svg>';
  return svg;
}

function renderStats() {
  var toolbar = document.getElementById('statsToolbar');
  var area = document.getElementById('statsContent');
  if (!area) return;

  // Period chips
  if (toolbar) {
    var chips = ['mtd', 'qtd', 'ytd', 'all'];
    var chipLabels = { mtd: 'MTD', qtd: 'QTD', ytd: 'YTD', all: 'All' };
    var chipHtml = '<div class="inv-stats-chips">';
    chips.forEach(function(p) {
      chipHtml += '<button class="inv-chip' + (_statsPeriod === p ? ' inv-chip-active' : '') +
        '" data-action="invStatsPeriod" data-period="' + p + '">' + chipLabels[p] + '</button>';
    });
    chipHtml += '</div>';
    toolbar.innerHTML = chipHtml;
  }

  var activeInvs = S.invoices.filter(function(i) { return i.status === 'active'; });
  var filtered = filterByPeriod(activeInvs, _statsPeriod);
  var html = '';

  // Card 1: Revenue Overview
  var totalRev = filtered.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0);
  var totalGrand = filtered.reduce(function(s, i) { return s + (i.grandTotal || 0); }, 0);
  var allTimeRev = activeInvs.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0);
  var pctOfAll = allTimeRev > 0 ? Math.round(totalRev / allTimeRev * 100) : 0;
  html += '<div class="inv-stats-card">' +
    '<div class="inv-stats-title">Revenue Overview</div>' +
    '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Taxable Revenue</span>' +
    '<span class="inv-stats-metric-value">' + formatCurrency(totalRev) + '</span></div>' +
    '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Grand Total (incl. GST)</span>' +
    '<span class="inv-stats-metric-sub">' + formatCurrency(totalGrand) + '</span></div>' +
    '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Invoices</span>' +
    '<span class="inv-stats-metric-sub">' + filtered.length + (_statsPeriod !== 'all' ? ' (' + pctOfAll + '% of all-time)' : '') + '</span></div></div>';

  // Card 2: Invoice States
  var stateCount = { created: 0, dispatched: 0, delivered: 0, filed: 0 };
  filtered.forEach(function(inv) {
    var s = getInvState(inv);
    if (stateCount[s] != null) stateCount[s]++;
  });
  html += '<div class="inv-stats-card">' +
    '<div class="inv-stats-title">Invoice States</div>' +
    '<div class="inv-stats-states-row">' +
    '<span class="inv-state-badge inv-state-created">' + stateCount.created + ' Created</span>' +
    '<span class="inv-state-badge inv-state-dispatched">' + stateCount.dispatched + ' Dispatched</span>' +
    '<span class="inv-state-badge inv-state-delivered">' + stateCount.delivered + ' Delivered</span>' +
    '<span class="inv-state-badge inv-state-filed">' + stateCount.filed + ' Filed</span>' +
    '</div></div>';

  // Card 3: Revenue by Client — SVG bar chart (full-width)
  var clientRev = {};
  filtered.forEach(function(inv) {
    var key = inv.clientId;
    if (!clientRev[key]) clientRev[key] = { clientId: key, name: inv.clientName, total: 0, count: 0 };
    clientRev[key].total += (inv.taxableValue || 0);
    clientRev[key].count++;
  });
  var ranked = Object.values(clientRev).sort(function(a, b) { return b.total - a.total; });
  var maxClientRev = ranked.length > 0 ? ranked[0].total : 0;
  html += '<div class="inv-stats-card inv-stats-card-full">' +
    '<div class="inv-stats-title">Revenue by Client</div>' +
    renderRevenueBarSvg(ranked, maxClientRev) + '</div>';

  // Card 4: Pending Revenue (always current, not period-filtered)
  var pendingByClient = {};
  (S.incomingMaterial || []).forEach(function(im) {
    im.items.forEach(function(it) {
      if (!it.invoiced) {
        var key = im.clientId;
        if (!pendingByClient[key]) pendingByClient[key] = { clientId: key, name: im.clientName, total: 0, items: 0 };
        pendingByClient[key].total += (it.amount || 0);
        pendingByClient[key].items++;
      }
    });
  });
  var pendingRanked = Object.values(pendingByClient).sort(function(a, b) { return b.total - a.total; });
  var totalPending = pendingRanked.reduce(function(s, r) { return s + r.total; }, 0);
  html += '<div class="inv-stats-card">' +
    '<div class="inv-stats-title">Pending Revenue</div>' +
    '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Total Unbilled</span>' +
    '<span class="inv-stats-metric-value">' + formatCurrency(totalPending) + '</span></div>';
  pendingRanked.forEach(function(r) {
    html += '<div class="inv-stats-row inv-stats-row-tap" data-action="invStatsClientDrill" data-client-id="' + r.clientId + '">' +
      '<span class="inv-stats-name">' + escHtml(r.name) + ' <span class="inv-text-muted">(' + r.items + ' items)</span></span>' +
      '<span class="inv-stats-val">' + formatCurrency(r.total) + '</span></div>';
  });
  if (pendingRanked.length === 0) {
    html += '<div class="inv-text-muted inv-p-8">All material invoiced</div>';
  }
  html += '</div>';

  // Card 5: Monthly Trend (full-width, always all-time)
  var monthlyData = buildMonthlyRevenue(activeInvs);
  html += '<div class="inv-stats-card inv-stats-card-full">' +
    '<div class="inv-stats-title">Monthly Revenue Trend</div>' +
    renderTrendSvg(monthlyData) + '</div>';

  // Card 6: Dispatch Cycle
  var dispatchDays = [], deliveryDays = [], fullCycleDays = [];
  filtered.forEach(function(inv) {
    if (inv.createdAt && inv.dispatchedAt) dispatchDays.push((inv.dispatchedAt - inv.createdAt) / 86400000);
    if (inv.dispatchedAt && inv.deliveredAt) deliveryDays.push((inv.deliveredAt - inv.dispatchedAt) / 86400000);
    if (inv.createdAt && inv.deliveredAt) fullCycleDays.push((inv.deliveredAt - inv.createdAt) / 86400000);
  });
  function avg(arr) { return arr.length > 0 ? (arr.reduce(function(a, b) { return a + b; }, 0) / arr.length) : null; }
  var avgDispatch = avg(dispatchDays);
  var avgDelivery = avg(deliveryDays);
  var avgFull = avg(fullCycleDays);
  if (avgDispatch !== null || avgDelivery !== null) {
    html += '<div class="inv-stats-card">' +
      '<div class="inv-stats-title">Dispatch Cycle</div>';
    if (avgDispatch !== null) {
      html += '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Created to Dispatched</span>' +
        '<span class="inv-stats-metric-sub">' + formatNum(avgDispatch, 1) + ' days avg (' + dispatchDays.length + ')</span></div>';
    }
    if (avgDelivery !== null) {
      html += '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Dispatched to Delivered</span>' +
        '<span class="inv-stats-metric-sub">' + formatNum(avgDelivery, 1) + ' days avg (' + deliveryDays.length + ')</span></div>';
    }
    if (avgFull !== null) {
      html += '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Full Cycle</span>' +
        '<span class="inv-stats-metric-sub">' + formatNum(avgFull, 1) + ' days avg (' + fullCycleDays.length + ')</span></div>';
    }
    html += '</div>';
  }

  // Card 7: Top Items by Volume (full-width)
  var topItems = buildTopItems(filtered);
  if (topItems.length > 0) {
    html += '<div class="inv-stats-card inv-stats-card-full">' +
      '<div class="inv-stats-title">Top Items by Volume</div>' +
      '<div class="inv-stats-table"><div class="inv-stats-table-header">' +
      '<span class="inv-stats-table-cell inv-stats-table-rank">#</span>' +
      '<span class="inv-stats-table-cell inv-stats-table-part">Part</span>' +
      '<span class="inv-stats-table-cell inv-stats-table-qty">Qty</span>' +
      '<span class="inv-stats-table-cell inv-stats-table-amt">Amount</span></div>';
    topItems.forEach(function(it, idx) {
      html += '<div class="inv-stats-table-row">' +
        '<span class="inv-stats-table-cell inv-stats-table-rank">' + (idx + 1) + '</span>' +
        '<span class="inv-stats-table-cell inv-stats-table-part">' + escHtml(it.part) +
        (it.desc && it.desc !== it.part ? '<br><span class="inv-text-muted inv-text-xs">' + escHtml(it.desc) + '</span>' : '') + '</span>' +
        '<span class="inv-stats-table-cell inv-stats-table-qty inv-mono">' + formatNum(it.qty, 2) + '</span>' +
        '<span class="inv-stats-table-cell inv-stats-table-amt inv-mono">' + formatCurrency(it.amount) + '</span></div>';
    });
    html += '</div></div>';
  }

  if (html === '') html = '<div class="inv-empty-state">No data yet. Create invoices and log incoming material to see analytics.</div>';
  area.innerHTML = html;
}

/* ===== CLIENT DRILL-DOWN OVERLAY (Flippable Card) ===== */
function openClientDrillOverlay(clientId) {
  clientId = parseInt(clientId);
  var client = S.clients.find(function(c) { return c.id === clientId; });
  if (!client) { showToast('Client not found', 'warning'); return; }

  var activeInvs = S.invoices.filter(function(i) { return i.status === 'active'; });
  var filtered = filterByPeriod(activeInvs, _statsPeriod);
  var clientInvs = filtered.filter(function(i) { return i.clientId === clientId; });
  var totalRev = clientInvs.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0);
  var allRev = filtered.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0);
  var pct = allRev > 0 ? Math.round(totalRev / allRev * 100) : 0;

  var pendingAmt = 0, pendingItems = 0;
  (S.incomingMaterial || []).forEach(function(im) {
    if (im.clientId !== clientId) return;
    im.items.forEach(function(it) {
      if (!it.invoiced) { pendingAmt += (it.amount || 0); pendingItems++; }
    });
  });

  var stateCounts = { created: 0, dispatched: 0, delivered: 0, filed: 0 };
  clientInvs.forEach(function(inv) {
    var s = getInvState(inv);
    if (stateCounts[s] != null) stateCounts[s]++;
  });

  var rateInfo = '';
  if (client.billingMode === 'perKg') {
    var r = getLineItemRate(client, localDateStr());
    rateInfo = 'Per Kg \u00b7 ' + formatCurrency(r.ratePerKg || r.rate || 0) + '/kg';
  } else if (client.billingMode === 'perPiece') {
    rateInfo = 'Per Piece';
  } else {
    rateInfo = client.billingMode || 'Standard';
  }

  var recentInvs = S.invoices
    .filter(function(i) { return i.clientId === clientId && i.status === 'active'; })
    .sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); })
    .slice(0, 5);
  var recentHtml = '';
  if (recentInvs.length === 0) {
    recentHtml = '<div class="inv-text-muted">No invoices</div>';
  } else {
    recentInvs.forEach(function(inv) {
      recentHtml += '<div class="inv-flip-row">' +
        '<span class="inv-mono">' + escHtml(inv.displayNumber) + '</span>' +
        '<span class="inv-text-muted">' + formatDate(inv.date) + '</span>' +
        '<span class="inv-mono inv-text-cost">' + formatCurrency(inv.grandTotal) + '</span>' +
        getStateBadgeHtml(inv) + '</div>';
    });
  }

  var pendingChallans = (S.incomingMaterial || []).filter(function(im) {
    if (im.clientId !== clientId) return false;
    return im.items.some(function(it) { return !it.invoiced; });
  });
  var challanHtml = '';
  if (pendingChallans.length === 0) {
    challanHtml = '<div class="inv-text-muted">No pending challans</div>';
  } else {
    pendingChallans.forEach(function(im) {
      var pItems = im.items.filter(function(it) { return !it.invoiced; });
      var pAmt = pItems.reduce(function(s, it) { return s + (it.amount || 0); }, 0);
      challanHtml += '<div class="inv-flip-row">' +
        '<span>' + (im.challanNo ? 'Ch. ' + escHtml(im.challanNo) : 'No number') + '</span>' +
        '<span class="inv-text-muted">' + formatDate(im.challanDate) + '</span>' +
        '<span class="inv-text-muted">' + pItems.length + ' items</span>' +
        '<span class="inv-mono">' + formatCurrency(pAmt) + '</span></div>';
    });
  }

  var periodLabels = { mtd: 'MTD', qtd: 'QTD', ytd: 'YTD', all: 'All Time' };
  var periodLabel = periodLabels[_statsPeriod] || 'All';

  pushFocus();
  document.body.style.overflow = 'hidden';
  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = '<div class="inv-overlay-card inv-flip-container">' +
    '<div class="inv-flip-inner">' +
    '<div class="inv-flip-front">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">' + escHtml(client.name) + '</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div>' +
    '<div class="inv-flip-period-label">' + escHtml(periodLabel) + '</div>' +
    '<div class="inv-flip-kpis">' +
    '<div class="inv-flip-kpi"><span class="inv-flip-kpi-label">Revenue</span><span class="inv-flip-kpi-value">' + formatCurrency(totalRev) + '</span></div>' +
    '<div class="inv-flip-kpi"><span class="inv-flip-kpi-label">Invoices</span><span class="inv-flip-kpi-value">' + clientInvs.length + '</span></div>' +
    '<div class="inv-flip-kpi"><span class="inv-flip-kpi-label">Share</span><span class="inv-flip-kpi-value">' + pct + '%</span></div>' +
    '<div class="inv-flip-kpi"><span class="inv-flip-kpi-label">Unbilled</span><span class="inv-flip-kpi-value">' + formatCurrency(pendingAmt) + '</span></div>' +
    '</div>' +
    '<div class="inv-flip-states">' +
    '<span class="inv-state-badge inv-state-created">' + stateCounts.created + ' Created</span>' +
    '<span class="inv-state-badge inv-state-dispatched">' + stateCounts.dispatched + ' Dispatched</span>' +
    '<span class="inv-state-badge inv-state-delivered">' + stateCounts.delivered + ' Delivered</span>' +
    '<span class="inv-state-badge inv-state-filed">' + stateCounts.filed + ' Filed</span>' +
    '</div>' +
    '<div class="inv-flip-meta">' + escHtml(rateInfo) + '</div>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-block" data-action="invFlipCard">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>' +
    ' Details &amp; Actions</button>' +
    '</div>' +
    '<div class="inv-flip-back">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">' + escHtml(client.name) + '</span><div>' +
    '<button class="inv-overlay-close" data-action="invFlipCard" aria-label="Flip back">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>' +
    '</button>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div></div>' +
    '<div class="inv-flip-section-title">Recent Invoices</div>' + recentHtml +
    '<div class="inv-flip-section-title">Pending Challans</div>' + challanHtml +
    '<div class="inv-flip-actions">' +
    '<button class="inv-btn inv-btn-primary" data-action="invStatsCreateInvoice" data-client-id="' + clientId + '">Create Invoice</button>' +
    '<button class="inv-btn inv-btn-ghost" data-action="invStatsJumpRegister" data-client-id="' + clientId + '">View in Register</button>' +
    '<button class="inv-btn inv-btn-ghost" data-action="invStatsJumpIM" data-client-id="' + clientId + '">View in IM</button>' +
    '</div></div>' +
    '</div></div>';
  document.body.appendChild(scrim);
  focusFirstInteractive(scrim);
}

/* ===== HISTORY (Phase 7 — Activity Log Rework) ===== */
var _historyClientFilter = '';
var _historyDateFrom = '';
var _historyDateTo = '';
var _historyShowCount = 50;

function renderHistory() {
  var toolbar = document.getElementById('historyToolbar');
  var area = document.getElementById('historyList');
  if (!area) return;

  if (toolbar) {
    var clientIds = new Set();
    S.invoices.forEach(function(i) { clientIds.add(i.clientId); });
    (S.incomingMaterial || []).forEach(function(im) { clientIds.add(im.clientId); });
    var clientOpts = '';
    clientIds.forEach(function(cid) {
      var c = S.clients.find(function(x) { return x.id === cid; });
      if (c) clientOpts += '<option value="' + cid + '"' + (_historyClientFilter == cid ? ' selected' : '') + '>' + escHtml(c.name) + '</option>';
    });
    toolbar.innerHTML = '<div class="inv-im-toolbar"><div class="inv-history-filters">' +
      '<select class="inv-form-select" id="historyClientFilter">' +
      '<option value="">All Clients</option>' + clientOpts + '</select>' +
      '<input type="date" class="inv-form-input inv-history-date" id="historyDateFrom" value="' + escHtml(_historyDateFrom) + '">' +
      '<input type="date" class="inv-form-input inv-history-date" id="historyDateTo" value="' + escHtml(_historyDateTo) + '">' +
      '</div></div>';
  }

  var events = [];

  S.invoices.forEach(function(inv) {
    if (_historyClientFilter && inv.clientId != _historyClientFilter) return;
    events.push({ ts: inv.createdAt, type: 'invoice', sourceId: inv.id, text: 'Invoice ' + (inv.displayNumber || '') + ' created for ' + (inv.clientName || ''), amount: inv.grandTotal, dot: 'invoice' });
    if (inv.dispatchedAt) events.push({ ts: inv.dispatchedAt, type: 'state', sourceId: inv.id, text: (inv.displayNumber || '') + ' dispatched', dot: 'state' });
    if (inv.deliveredAt) events.push({ ts: inv.deliveredAt, type: 'state', sourceId: inv.id, text: (inv.displayNumber || '') + ' delivered (signed copy received)', dot: 'state' });
    if (inv.filedAt) events.push({ ts: inv.filedAt, type: 'state', sourceId: inv.id, text: (inv.displayNumber || '') + ' marked as filed in GSTR1', dot: 'state' });
    if (inv.status === 'cancelled' && inv.cancelledAt) events.push({ ts: inv.cancelledAt, type: 'cancel', sourceId: inv.id, text: (inv.displayNumber || '') + ' cancelled', dot: 'cancel' });
    if (inv.updatedAt && inv.updatedAt !== inv.createdAt) events.push({ ts: inv.updatedAt, type: 'state', sourceId: inv.id, text: (inv.displayNumber || '') + ' edited', dot: 'state' });
  });

  (S.incomingMaterial || []).forEach(function(im) {
    if (_historyClientFilter && im.clientId != _historyClientFilter) return;
    var challanAmt = im.items.reduce(function(s, it) { return s + (it.amount || 0); }, 0);
    events.push({
      ts: im.createdAt, type: 'challan', sourceId: im.id,
      text: 'Challan' + (im.challanNo ? ' ' + im.challanNo : '') + ' received from ' + (im.clientName || '') + ' (' + im.items.length + ' item' + (im.items.length > 1 ? 's' : '') + ')',
      amount: challanAmt, dot: 'challan'
    });
  });

  if (_historyDateFrom) {
    var fromTs = new Date(_historyDateFrom + 'T00:00:00').getTime();
    if (!isNaN(fromTs)) events = events.filter(function(ev) { return (ev.ts || 0) >= fromTs; });
  }
  if (_historyDateTo) {
    var toTs = new Date(_historyDateTo + 'T23:59:59').getTime();
    if (!isNaN(toTs)) events = events.filter(function(ev) { return (ev.ts || 0) <= toTs; });
  }

  events.sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });

  if (events.length === 0) {
    area.innerHTML = '<div class="inv-empty-state">No activity found</div>';
    return;
  }

  var html = '<div class="inv-stats-card">' +
    '<div class="inv-stats-title">Activity Log (' + events.length + ' events)</div>';

  var shown = events.slice(0, _historyShowCount);
  var currentDay = '';
  shown.forEach(function(ev) {
    var dayStr = ev.ts ? formatTimestamp(ev.ts).split(',')[0] : 'Unknown date';
    if (dayStr !== currentDay) {
      currentDay = dayStr;
      html += '<div class="inv-history-day-header">' + escHtml(dayStr) + '</div>';
    }
    var action = ev.type === 'challan' ? 'invHistoryJumpChallan' : 'invHistoryJumpInvoice';
    html += '<div class="inv-history-item" data-action="' + action + '" data-id="' + escHtml(ev.sourceId) + '">' +
      '<div class="inv-history-dot inv-history-dot-' + ev.dot + '"></div>' +
      '<div class="inv-history-body">' +
      '<div class="inv-history-text">' + escHtml(ev.text) +
      (ev.amount ? ' \u00b7 ' + formatCurrency(ev.amount) : '') + '</div>' +
      '<div class="inv-history-meta">' + (ev.ts ? formatTimestamp(ev.ts) : '') + '</div>' +
      '</div></div>';
  });

  if (events.length > _historyShowCount) {
    var remaining = events.length - _historyShowCount;
    html += '<button class="inv-btn inv-btn-ghost inv-btn-block inv-mt-16" data-action="invHistoryLoadMore">' +
      'Show more (' + remaining + ' remaining)</button>';
  }
  html += '</div>';
  area.innerHTML = html;
}
