/* ===== STAFF AND STOCK OVERVIEWS =====
 * docs/FINANCE_INTELLIGENCE_SPEC.md, Phase 7 (7a, 7b): the owner's "same for Staff, Stock" — each screen opens on an
 * Overview built from the Phase 2 charts and reading the functions the rest of the app already uses. A week or month
 * nobody typed is a gap in a line, never a zero; every panel says what it rests on.
 */

var DASH_STAFF_RULES = ['insLabour', 'insAttGap', 'wageVsSlip', 'cashSwing', 'costGap'];

function _dashPanel(id, title, body, head) {
  return '<div class="inv-panel" id="' + id + '"><div class="inv-panel-head"><span class="inv-panel-title">' + title + '</span>' + (head || '') + '</div>' +
    '<div class="inv-panel-body">' + body + '</div></div>';
}
function _dashWeekLabel(sat) { return stockShortDate(sat); }

/* ---------- 7a. Staff ---------- */
/* Worker-days present (P = 1, H = ½) over the active roster's marks typed that week, per pay week.
   Only the active roster's marks count: a leaver's days are not in the denominator, so they are not in the numerator. */
function dashAttendanceByWeek(n) {
  // Unmarked is not absent (CLAUDE.md, Labour and attendance): the denominator is the active roster's marks that
  // were actually typed — present, half or absent — so a half-entered day reads as what was entered.
  var active = staffActive(), ids = {}, today = localDateStr(), out = [], ws = attWeekStartOf(today);
  active.forEach(function(w) { ids[String(w.id)] = true; });
  for (var k = n - 1; k >= 0; k--) {
    var start = attAddDays(ws, -7 * k), sat = attAddDays(start, 6), present = 0, marked = 0, days = 0;
    for (var d = 1; d <= 6; d++) {
      var iso = attAddDays(start, d), rec = (S.attendance || {})[iso];
      if (iso > today || !rec || !Object.keys(rec.marks || {}).length) continue;
      days++;
      Object.keys(rec.marks).forEach(function(id) {
        var m = rec.marks[id];
        if (!ids[String(id)] || !m || (m.st !== 'P' && m.st !== 'H' && m.st !== 'A')) return;
        marked++;
        if (m.st === 'P') present += 1; else if (m.st === 'H') present += 0.5;
      });
    }
    out.push({ start: start, sat: sat, days: days, marked: marked, pct: marked ? present / marked * 100 : null });
  }
  return out;
}
/* One labour reading per closed month, shared by the ₹/kg and the payroll panels. */
function _dashLabMonths(months) {
  var out = {};
  months.forEach(function(m) { out[m] = labourForRange(m + '-01', payMonthEnd(m + '-01')); });
  return out;
}
function _dashBankByMonth() { return finHasBank() ? bankCostByMonthMemo() : null; }
function dashLabourByMonth(labs) {
  var months = insMonthsBack(6), active = insActive(), bm = _dashBankByMonth();
  labs = labs || _dashLabMonths(months);
  return months.map(function(m) {
    var from = m + '-01', to = payMonthEnd(from), lab = labs[m];
    var kg = weighLines(active.filter(function(i) { return i.date >= from && i.date <= to; })).kg;
    // A month the statement speaks for with no wage on it paid nothing: known, and zero.
    var paid = bm && bankMonthKnown(bm, m, 'labour') ? (bm.months[m] ? bm.months[m].labour.amount : 0) : null;
    return { month: m, kg: kg, recorded: kg > 0 && lab.total > 0 && lab.coverage >= 0.9 ? lab.total / kg : null, coverage: lab.coverage,
      paid: kg > 0 && paid != null ? paid / kg : null };
  });
}
function dashPayrollVsBank(labs) {
  var months = insMonthsBack(6), bm = _dashBankByMonth();
  return months.map(function(m) {
    var slip = payrollPaidFor(m), payroll = 0, src = 'slip';
    if (slip) slip.rows.forEach(function(r) { payroll += r.paid != null ? Number(r.paid) || 0 : (Number(r.dayPay) || 0) + (Number(r.ot) || 0); });
    else {
      src = 'model';
      var lab = labs && labs[m] || labourForRange(m + '-01', payMonthEnd(m + '-01'));
      Object.keys(lab.byWorker).forEach(function(id) { if (lab.byWorker[id].comp === 'monthly') payroll += lab.byWorker[id].total; });
    }
    var named = bm && bankMonthKnown(bm, m, 'labour') ? (bm.months[m] ? bm.months[m].labour.named : 0) : null;
    return { month: m, payroll: gstRound(payroll), src: src, bank: named == null ? null : gstRound(named) };
  });
}

function staffOverviewHtml() {
  // "Open the day" opens the day the panel shows: today, or the last day typed when today is empty.
  var day = attDaySummary();
  var h = attDayPanelHtml(day, '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invDashOpenDay" data-date="' + escHtml(day.iso) + '">Open the day</button>', 'dashStaffToday');

  var weeks = dashAttendanceByWeek(12);
  h += _dashPanel('dashAttWeeks', 'Attendance by week', chartLines(weeks.map(function(w) { return _dashWeekLabel(w.sat); }),
    [{ label: 'Present', values: weeks.map(function(w) { return w.pct == null ? null : Math.round(w.pct * 10) / 10; }) }],
    { unit: 'pct', ariaLabel: 'Attendance by week', emptyText: 'Needs two pay weeks with attendance recorded' }) +
    '<div class="inv-note">Worker-days present (a half day is half) over the active roster’s marks typed that week; an unmarked hand is not counted absent. A week nobody typed is a gap, not a zero.</div>');

  var labs = _dashLabMonths(insMonthsBack(6)), lm = dashLabourByMonth(labs), model = labourCfg().modelPerKg || 3.55;
  h += _dashPanel('dashLabour', 'Labour ₹/kg by month', chartLines(lm.map(function(x) { return insMonthLabel(x.month); }), [
    { label: 'Recorded', values: lm.map(function(x) { return x.recorded == null ? null : gstRound(x.recorded); }) },
    { label: 'Paid, bank', values: lm.map(function(x) { return x.paid == null ? null : gstRound(x.paid); }), tone: 2 },
    { label: 'Model', values: lm.map(function() { return model; }), tone: 3 }
  ], { unit: 'rate', ariaLabel: 'Labour per kg by month', emptyText: 'Needs two months with tonnage' }) +
    '<div class="inv-note">Recorded is attendance priced by the wage model, shown where 90% of the month’s working days are recorded; paid is the salaries and cash the bank statement set against the month; model is Settings → Labour.</div>');

  var ws = attWeekStartOf(localDateStr()), from = attAddDays(ws, -21), ah = areaHoursForRange(from, localDateStr());
  h += _dashPanel('dashAreaHours', 'OT and EXTRA by area, four weeks', chartStack(ah.rows.map(function(r) { return r.label; }), [
    { label: 'OT', values: ah.rows.map(function(r) { return Math.round(r.ot * 10) / 10; }) },
    { label: 'EXTRA', values: ah.rows.map(function(r) { return Math.round(r.extra * 10) / 10; }) }
  ], { unit: 'h', ariaLabel: 'OT and EXTRA hours by area', emptyText: 'No OT or EXTRA booked in the last four weeks' }) +
    '<div class="inv-note">From ' + escHtml(formatDate(from)) + ': overtime hours on each mark where the worker stood that day, and the EXTRA booked to the area.</div>');

  var pb = dashPayrollVsBank(labs);
  h += _dashPanel('dashPayBank', 'Payroll against the bank', chartStack(pb.map(function(x) { return insMonthLabel(x.month); }), [
    { label: 'Payroll', values: pb.map(function(x) { return x.payroll; }) },
    { label: 'Paid, bank', values: pb.map(function(x) { return x.bank == null ? 0 : x.bank; }) }
  ], { mode: 'group', ariaLabel: 'Payroll against the bank', emptyText: 'No monthly payroll in six months' }) +
    '<div class="inv-note">Payroll is the slip as paid where one is imported, else the wage model’s monthly tier (' +
    escHtml(pb.filter(function(x) { return x.src === 'model'; }).map(function(x) { return insMonthLabel(x.month); }).join(', ') || 'none') +
    '). Paid is the transfers to named hands the bank set against the month; a month the statement does not reach shows none.</div>');

  var raised = todoApp(DASH_STAFF_RULES).filter(function(t) { return t.rule !== 'costGap' || t.key === 'costGap:labour'; });
  h += '<div class="inv-panel inv-panel-flush" id="dashStaffRaised"><div class="inv-panel-head"><span class="inv-panel-title">Raised</span><span class="inv-panel-count">' + raised.length + '</span></div>' +
    (raised.length ? raised.map(_dashTaskRow).join('') : '<div class="inv-empty">Nothing raised about labour or pay.</div>') + '</div>';
  return '<div class="inv-panels">' + h + '</div>';
}
function _dashTaskRow(t) {
  return '<div class="inv-row inv-row-2"><button class="inv-row-main" data-action="invDashTask" data-key="' + escHtml(t.key) + '"><span class="inv-row-title">' +
    '<span class="inv-dot inv-dot-' + uiTone(t.tone) + '">' + escHtml(t.title) + '</span></span><span class="inv-row-meta">' + escHtml(t.sub || '') + '</span></button></div>';
}

/* ---------- 7b. Stock ---------- */
var _dashSupplier = null;     // the supplier slice open on the pie
var _dashPriceItem = null;    // the line on the price chart

function dashStockDays() {
  var rows = [], none = [];
  stockData().items.filter(function(i) { return i.active !== false && i.basis !== 'charge'; }).forEach(function(it) {
    var st = stockStatus(it);
    if (st.group === 'out') rows.push({ it: it, days: 0, tone: 'red', out: true });
    else if (st.daysLeft != null) rows.push({ it: it, days: st.daysLeft, tone: st.tone, tentative: !!(st.rate && st.rate.tentative) });
    else none.push(it.name);
  });
  rows.sort(function(a, b) { return a.days - b.days; });
  return { rows: rows, none: none };
}
function dashSupplierSpend(months) {
  var from = insMonthsBack(months)[0] + '-01', by = {};
  stockData().items.forEach(function(it) {
    stockPurchases(it.id).forEach(function(b) {
      if (b.date < from) return;
      var k = b.e.supplier || 'No supplier on record', r = by[k] || (by[k] = { name: k, named: !!b.e.supplier, amount: 0, bills: [] });
      r.amount += (b.e.price || 0) * (b.e.qty || 0); r.bills.push({ it: it, b: b });
    });
  });
  return { from: from, list: Object.keys(by).map(function(k) { by[k].amount = gstRound(by[k].amount); return by[k]; }).sort(function(a, b) { return b.amount - a.amount; }) };
}
/* A week with no stock entry at all (count, delivery, use or charge) is a week nobody typed: null, a gap in
   the line, never ₹0. A week that was typed and used nothing priced is a real zero. */
function dashUsedByWeek(n) {
  var ws = attWeekStartOf(localDateStr()), weeks = [], byItem = {}, unpriced = {}, typed = [];
  for (var k = n - 1; k >= 0; k--) { weeks.push(attAddDays(ws, -7 * k)); typed.push(false); }
  var first = weeks[0];
  stockData().entries.forEach(function(e) {
    if (e.voided || e.kind === 'bill' || e.date < first) return;
    var w = weeks.indexOf(attWeekStartOf(e.date));
    if (w < 0) return;
    typed[w] = true;
    if (e.kind !== 'used' && e.kind !== 'charged') return;
    var it = stockItem(e.itemId);
    if (!it) return;
    var p = stockPriceAt(it.id, e.date);
    if (!p) { unpriced[it.name] = 1; return; }
    var r = byItem[it.id] || (byItem[it.id] = { name: it.name, v: weeks.map(function() { return 0; }), total: 0 });
    r.v[w] += e.qty * p.price; r.total += e.qty * p.price;
  });
  var lines = Object.keys(byItem).map(function(k) { return byItem[k]; }).sort(function(a, b) { return b.total - a.total; });
  lines.forEach(function(l) { l.v = l.v.map(function(v, i) { return typed[i] ? gstRound(v) : null; }); });
  var total = weeks.map(function(_, i) { return typed[i] ? gstRound(lines.reduce(function(s, l) { return s + l.v[i]; }, 0)) : null; });
  return { weeks: weeks, total: total, top: lines.slice(0, 4), unpriced: Object.keys(unpriced) };
}

function stockOverviewHtml() {
  var h = '';
  var dd = dashStockDays();
  h += _dashPanel('dashStockDays', 'Days left', chartRankedBars(dd.rows.map(function(r) {
    return { label: r.it.name, value: r.out ? 0 : Math.round(r.days * 10) / 10, display: r.out ? 'Out' : stockDaysText(r.days, r.tentative),
      tone: r.tone === 'red' ? 'danger' : r.tone === 'amber' ? 'warning' : 'good', action: 'invDashStockLine', clientId: r.it.id };
  }), { unit: 'count', emptyText: 'No line has a daily use yet' }) +
    (dd.none.length ? '<div class="inv-note">No daily use yet: ' + escHtml(dd.none.join(', ')) + '.</div>' : '') +
    '<div class="inv-note">Red at ' + stockCfg().redDays + ' days or fewer, amber at ' + stockCfg().amberDays + ' (Settings → Checks & alerts → Stock alerts). A bath line is not listed: its shelf runs empty by design.</div>');

  var sp = dashSupplierSpend(6), sel = sp.list.find(function(x) { return x.name === _dashSupplier; });
  var body = chartPieTap(sp.list.map(function(x) { return { key: x.name, label: x.name, value: x.amount }; }),
    { action: 'invDashSupplier', selected: _dashSupplier, ariaLabel: 'Spend by supplier', emptyText: 'No priced bill in six months', readHint: 'Tap a supplier to list its bills' });
  if (sel) {
    var bp = sel.named ? finSupplierPaid(sel.name) : null;
    // Newest first across every line the supplier sold, not line by line.
    var bills = sel.bills.slice().sort(function(a, b) { return a.b.date < b.b.date ? 1 : a.b.date > b.b.date ? -1 : 0; });
    body += '<div class="inv-rows" data-dash-supplier="' + escHtml(sel.name) + '">' + bills.map(function(x) {
      return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(x.it.name) + '</span><span class="inv-row-meta">' + escHtml(formatDate(x.b.date)) +
        ' · ' + escHtml(stockFmtQty(x.b.e.qty)) + ' ' + escHtml(x.it.unit || '') + ' × ' + escHtml(formatCurrency(x.b.e.price)) + (x.b.e.billNo ? ' · ' + escHtml(x.b.e.billNo) : '') + '</span></span>' +
        '<span class="inv-row-end inv-num">' + formatCurrency(gstRound((x.b.e.price || 0) * (x.b.e.qty || 0))) + '</span></div>';
    }).join('') + (bp ? '<div class="inv-row"><span class="inv-row-main inv-row-meta">The bank paid them ' + escHtml(formatCurrency(bp.paid)) + ' in ' + bp.n + ' payment' + (bp.n === 1 ? '' : 's') + '</span></div>' : '') + '</div>';
  }
  h += _dashPanel('dashSupplier', 'Spend by supplier, six months', body + '<div class="inv-note">Bills before GST from ' + escHtml(formatDate(sp.from)) + '.</div>');

  var u = dashUsedByWeek(12), labs = u.weeks.map(function(w) { return _dashWeekLabel(attAddDays(w, 6)); });
  h += _dashPanel('dashUsed', 'Used, in rupees, by week', chartLines(labs, [{ label: 'All lines', values: u.total }].concat(u.top.map(function(l, i) {
    return { label: l.name, values: l.v, tone: i + 2 };
  })), { ariaLabel: 'Stock used by week in rupees', emptyText: 'Needs two weeks of use recorded' }) +
    '<div class="inv-note">Each use at the price paid for that line on the day.' + (u.unpriced.length ? ' Not counted, no price: ' + escHtml(u.unpriced.join(', ')) + '.' : '') + '</div>');

  var priced = stockData().items.filter(function(i) { return i.active !== false && stockPurchases(i.id).length; });
  if (!priced.some(function(i) { return i.id === _dashPriceItem; })) _dashPriceItem = priced.length ? priced[0].id : null;
  h += _dashPanel('dashPrice', 'Price trend', priced.length ? '<select class="inv-select inv-select-sm" id="dashPriceLine" aria-label="Line">' +
    priced.map(function(i) { return '<option value="' + escHtml(i.id) + '"' + (i.id === _dashPriceItem ? ' selected' : '') + '>' + escHtml(i.name) + '</option>'; }).join('') + '</select>' +
    '<div id="dashPriceChart">' + dashPriceChart() + '</div>' : '<div class="inv-empty">No bill with a price yet.</div>');

  var L = stockReorderList(), fc = finHasBank() ? finForecast(45) : null;
  var need = gstRound(L.total * 1.18);
  h += '<div class="inv-panel inv-panel-flush" id="dashReorder"><div class="inv-panel-head"><span class="inv-panel-title">Reorder cash</span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invStockReorder">Open the reorder list</button></div><div class="inv-tiles inv-tiles-flush">' +
    '<div class="inv-tile"><div class="inv-tile-label">Order, with GST</div><div class="inv-tile-value inv-tile-value-sm inv-num">' + escHtml(formatCurrency(need)) + '</div><div class="inv-tile-sub">' +
      (L.unpriced ? L.unpriced + ' line' + (L.unpriced === 1 ? '' : 's') + ' without a price' : 'at the last prices') + '</div></div>' +
    (fc ? '<div class="inv-tile"><div class="inv-tile-label">Forecast lowest</div><div class="inv-tile-value inv-tile-value-sm inv-num">' + escHtml(formatCurrency(fc.min.bal)) + '</div><div class="inv-tile-sub">on ' + escHtml(stockShortDate(fc.min.date)) + '</div></div>' +
      '<div class="inv-tile' + (fc.min.bal - need < 0 ? ' inv-tile-danger' : '') + '"><div class="inv-tile-label">After the order</div><div class="inv-tile-value inv-tile-value-sm inv-num">' + escHtml(formatCurrency(gstRound(fc.min.bal - need))) + '</div><div class="inv-tile-sub">at the lowest point</div></div>'
      : '<div class="inv-tile"><div class="inv-tile-label">Forecast</div><div class="inv-tile-value inv-tile-value-sm">&mdash;</div><div class="inv-tile-sub">import a bank statement</div></div>') +
    '</div></div>';
  return '<div class="inv-panels">' + h + '</div>';
}
function dashPriceChart() {
  var it = stockItem(_dashPriceItem);
  if (!it) return '';
  var b = stockPurchases(it.id);
  return chartLines(b.map(function(x) { return stockShortDate(x.date); }), [{ label: it.name + ' ₹/' + (it.unit || 'unit'), values: b.map(function(x) { return x.e.price; }) }],
    { unit: 'money', ariaLabel: 'Price trend', emptyText: it.name + ': one bill so far, ' + (b[0] ? formatCurrency(b[0].e.price) + ' on ' + stockShortDate(b[0].date) : '') });
}
function stockViewTabsHtml() {
  var t = function(k, l) { return '<button class="inv-viewtab" role="tab" aria-selected="' + (_stockView === k) + '" data-action="invDashStockView" data-view="' + k + '">' + l + '</button>'; };
  return '<div class="inv-viewtabs" role="tablist">' + t('overview', 'Overview') + t('list', 'Lines') + '</div>' +
    (_stockView === 'overview' ? '<div class="inv-toolbar"><button class="inv-btn inv-btn-primary" data-action="invStockPaste">Paste message</button>' +
      '<button class="inv-btn" data-action="invStockManual">Enter by hand</button></div>' : '');
}

/* ---------- Doing ---------- */
function dashAction(action, btn) {
  switch (action) {
    case 'invDashTask': {
      var t = todoAppAll(DASH_STAFF_RULES).find(function(x) { return x.key === btn.dataset.key; });
      if (t) todoGo(t.go);
      return true;
    }
    case 'invDashOpenDay': if (btn.dataset.date) _attDate = btn.dataset.date; _attView = 'day'; renderAttendance(); return true;
    case 'invDashStockView': stockSetView(btn.dataset.view); return true;
    case 'invDashStockLine': _stockItemId = btn.dataset.clientId; stockSetView('item'); return true;
    case 'invDashSupplier': _dashSupplier = _dashSupplier === btn.dataset.key ? null : btn.dataset.key; renderStock(); return true;
  }
  return false;
}
function dashInput(t) {
  if (t.id !== 'dashPriceLine') return false;
  _dashPriceItem = t.value;
  var el = document.getElementById('dashPriceChart');
  if (el) el.innerHTML = dashPriceChart();
  return true;
}
