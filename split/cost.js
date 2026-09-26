/* ===== Prices, purchases and the live cost =====

   Owner, 25 Sep 2026: "There is no place to enter a stock's price? When
   entering received stock - also ask for the company, invoice number and date
   of invoice ... The calculation of live cost should be broken down so that
   every cost is visible and measurable and pattern is recorded of the stock
   (price, usage, cadence, etc.)"

   **A purchase is a bill.** A delivery entered by hand carries its company,
   invoice number and invoice date. A delivery that arrived by paste (the
   supervisor's message carries no bill) is priced afterwards with "Add its bill"
   on the entry, which completes that entry. A bill entered on its own (kind
   `bill`) records what was paid without moving the stock level: the goods are
   already in a count or a delivery, and adding them again would count them
   twice. That is also how past purchases arrive from soma-internal.

   **The pattern of each line is read from those records**: the price over time
   and from whom, how often it is bought and how much, how fast it is used, and
   what it costs a day. Nothing is typed twice.

   **The live cost shows every figure with its source.** Measured is from this
   app's own records; a market rate is the zinc card's; a model figure is the
   Settings fallback, used only where nothing is recorded yet, and named as such.
   A line used but never priced is listed, never costed at zero. */

/* ---------- Bills on stock lines ---------- */
var _stockBill = null;   // { itemId, entryId, date, supplier, billNo, qty, price, amount }

function stockSuppliers() {
  var seen = {}, out = [];
  stockData().entries.forEach(function(e) {
    var s = (e.supplier || '').trim();
    if (s && !seen[s.toUpperCase()]) { seen[s.toUpperCase()] = true; out.push(s); }
  });
  return out.sort();
}
function stockSupplierDatalist() {
  return '<datalist id="stockSupplierList">' + stockSuppliers().map(function(s) { return '<option value="' + escHtml(s) + '">'; }).join('') + '</datalist>';
}

function stockBillOpen(entryId) {
  var e = entryId ? stockData().entries.find(function(x) { return x.id === entryId; }) : null;
  _stockBill = { itemId: e ? e.itemId : _stockItemId, entryId: e ? e.id : '', date: e ? (e.billDate || e.date) : localDateStr(),
    supplier: e && e.supplier || '', billNo: e && e.billNo || '', qty: e ? String(e.qty) : '', price: '', amount: '' };
  renderStock();
  var f = document.getElementById('stockBillSupplier');
  if (f) f.focus();
}
function stockBillOnInput(t) {
  if (!_stockBill || !t.id || t.id.indexOf('stockBill') !== 0) return false;
  var k = { stockBillDate: 'date', stockBillSupplier: 'supplier', stockBillNo: 'billNo', stockBillQty: 'qty', stockBillPrice: 'price', stockBillAmount: 'amount' }[t.id];
  if (!k) return false;
  _stockBill[k] = t.value;
  return true;
}
function stockBillFormHtml(item) {
  var b = _stockBill, unit = item.unit || 'unit';
  return '<div class="inv-stk-billform" id="stockBillForm"><div class="inv-stk-label">' + (b.entryId ? 'The bill for this delivery' : 'A bill') + '</div>' +
    '<div class="inv-stk-fields">' +
    '<div class="inv-stk-field"><label class="inv-stk-label" for="stockBillSupplier">Company</label><input id="stockBillSupplier" class="inv-form-input" list="stockSupplierList" value="' + escHtml(b.supplier) + '"></div>' +
    '<div class="inv-stk-field"><label class="inv-stk-label" for="stockBillNo">Invoice no.</label><input id="stockBillNo" class="inv-form-input" value="' + escHtml(b.billNo) + '"></div>' +
    '<div class="inv-stk-field"><label class="inv-stk-label" for="stockBillDate">Invoice date</label><input type="date" id="stockBillDate" class="inv-form-input" value="' + escHtml(b.date) + '"></div>' +
    '<div class="inv-stk-field"><label class="inv-stk-label" for="stockBillQty">Quantity (' + escHtml(unit) + ')</label><input type="number" inputmode="decimal" step="any" min="0" id="stockBillQty" class="inv-form-input"' + (b.entryId ? ' disabled' : '') + ' value="' + escHtml(b.qty) + '"></div>' +
    '<div class="inv-stk-field"><label class="inv-stk-label" for="stockBillPrice">&#8377; per ' + escHtml(unit) + ', before GST</label><input type="number" inputmode="decimal" step="any" min="0" id="stockBillPrice" class="inv-form-input" value="' + escHtml(b.price) + '"></div>' +
    '<div class="inv-stk-field"><label class="inv-stk-label" for="stockBillAmount">or the bill amount, before GST</label><input type="number" inputmode="decimal" step="any" min="0" id="stockBillAmount" class="inv-form-input" value="' + escHtml(b.amount) + '"></div>' +
    '</div>' + stockSupplierDatalist() +
    '<div class="inv-stk-foot"><button class="inv-stk-btn" data-action="invStockBillCancel">Cancel</button>' +
    '<button class="inv-stk-btn inv-stk-btn-pri" data-action="invStockBillSave">Save bill</button></div></div>';
}
function stockBillSave() {
  var b = _stockBill;
  if (!b) return;
  var item = stockItem(b.itemId);
  if (!item) return;
  var qty = parseFloat(b.qty), price = parseFloat(b.price), amount = parseFloat(b.amount);
  if (!b.supplier.trim()) { showToast('Enter the company that billed it', 'error'); return; }
  if (!b.billNo.trim()) { showToast('Enter the invoice number', 'error'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) { showToast('Enter the invoice date', 'error'); return; }
  if (!(qty > 0)) { showToast('Enter the quantity billed', 'error'); return; }
  if (!(price > 0) && amount > 0) price = amount / qty;
  if (!(price > 0)) { showToast('Enter the price per unit or the bill amount', 'error'); return; }
  price = Math.round(price * 10000) / 10000;
  var fields = { price: price, amount: gstRound(price * qty), supplier: b.supplier.trim(), billNo: b.billNo.trim(), billDate: b.date };
  if (b.entryId) {
    var e = stockData().entries.find(function(x) { return x.id === b.entryId; });
    if (!e) return;
    Object.keys(fields).forEach(function(k) { e[k] = fields[k]; });
    e.billAddedAt = Date.now();
  } else {
    stockData().entries.push(Object.assign({ id: stockUid('SE'), itemId: item.id, kind: 'bill', qty: qty, date: b.date, seq: 0,
      at: Date.now(), source: 'manual', by: stockBy(), sentBy: '' }, fields));
  }
  _stockBill = null;
  saveState();
  renderStock();
  showToast('Bill saved: ' + formatCurrency(price) + '/' + (item.unit || 'unit') + ' from ' + fields.supplier);
}

/* ---------- The pattern of a line ---------- */
function stockMedian(a) {
  var s = a.slice().sort(function(x, y) { return x - y; });
  if (!s.length) return null;
  var m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function stockDaysApart(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }

function stockPattern(item) {
  var buys = stockPurchases(item.id);
  var out = { buys: buys, last: null, prev: null, change: null, min: null, max: null, suppliers: [], cadence: null, nextDue: null,
    lastBought: null, avgQty: null, rate: stockRate(item), used30: 0, costDay: null, costMonth: null };
  if (buys.length) {
    out.last = buys[buys.length - 1];
    out.prev = buys.length > 1 ? buys[buys.length - 2] : null;
    if (out.prev && out.prev.e.price > 0) out.change = (out.last.e.price - out.prev.e.price) / out.prev.e.price;
    var prices = buys.map(function(b) { return b.e.price; });
    out.min = Math.min.apply(null, prices);
    out.max = Math.max.apply(null, prices);
    var bySup = {};
    buys.forEach(function(b) {
      var k = (b.e.supplier || 'Not recorded');
      var r = bySup[k] || (bySup[k] = { name: k, count: 0, qty: 0, spent: 0, last: null });
      r.count++; r.qty += b.e.qty || 0; r.spent += (b.e.price || 0) * (b.e.qty || 0); r.last = b;
    });
    out.suppliers = Object.keys(bySup).map(function(k) { return bySup[k]; }).sort(function(a, b) { return b.count - a.count; });
    out.avgQty = buys.reduce(function(s, b) { return s + (b.e.qty || 0); }, 0) / buys.length;
  }
  // How often it is bought: every bill and every delivery, a delivery and its
  // own bill a few days apart counted once.
  var dates = stockItemEntries(item.id).filter(function(e) { return e.kind === 'received' || e.kind === 'bill'; })
    .map(function(e) { return e.billDate || e.date; }).sort();
  var events = [];
  dates.forEach(function(d) { if (!events.length || stockDaysApart(events[events.length - 1], d) > 3) events.push(d); });
  if (events.length) out.lastBought = events[events.length - 1];
  if (events.length >= 2) {
    var gaps = [];
    for (var i = 1; i < events.length; i++) gaps.push(stockDaysApart(events[i - 1], events[i]));
    out.cadence = stockMedian(gaps);
    out.nextDue = stockIsoAdd(out.lastBought, Math.round(out.cadence));
  }
  var today = localDateStr(), cut = stockIsoAdd(today, -30);
  stockItemEntries(item.id).forEach(function(e) { if ((e.kind === 'used' || e.kind === 'charged') && e.date > cut) out.used30 += e.qty; });
  if (out.rate && out.rate.rate && out.last) {
    out.costDay = gstRound(out.rate.rate * out.last.e.price);
    out.costMonth = gstRound(out.costDay * 26);
  }
  return out;
}

function stockPatternHtml(item) {
  var p = stockPattern(item), unit = item.unit || 'unit', h = '<div class="inv-stk-sec">Price and pattern</div><div class="inv-stk-pattern">';
  var row = function(label, sub, val) { return '<div class="inv-lab-row"><span class="inv-lab-label">' + label + (sub ? '<span class="inv-lab-sub">' + sub + '</span>' : '') + '</span><span class="inv-lab-value inv-mono">' + val + '</span></div>'; };
  if (p.last) {
    h += row('Price', 'last paid, ' + escHtml(stockShortDate(p.last.date)) + (p.last.e.supplier ? ' · ' + escHtml(p.last.e.supplier) : '') + (p.last.e.billNo ? ' · invoice ' + escHtml(p.last.e.billNo) : ''),
      formatCurrency(p.last.e.price) + '/' + escHtml(unit));
    if (p.prev) h += row('Change', 'against ' + formatCurrency(p.prev.e.price) + ' on ' + escHtml(stockShortDate(p.prev.date)),
      (p.change > 0 ? '+' : p.change < 0 ? '&minus;' : '') + formatNum(Math.abs(p.change) * 100, 1) + '%');
    if (p.buys.length > 1) h += row('Range', p.buys.length + ' priced purchases', formatCurrency(p.min) + ' – ' + formatCurrency(p.max));
    p.suppliers.forEach(function(s) {
      h += row(escHtml(s.name), s.count + ' bill' + (s.count === 1 ? '' : 's') + ' · ' + escHtml(stockFmtQty(s.qty)) + ' ' + escHtml(unit) + ' · last ' + formatCurrency(s.last.e.price), formatCurrency(gstRound(s.spent)));
    });
  } else {
    h += '<div class="inv-stk-hint">No price recorded. Add the bill for a delivery (on the entry below) or a past bill here.</div>';
  }
  if (p.lastBought) h += row('Bought', p.cadence != null ? 'every ' + formatNum(p.cadence, 0) + ' days (median) · ' + (p.avgQty != null ? 'about ' + escHtml(stockFmtQty(p.avgQty)) + ' ' + escHtml(unit) + ' a time' : '') : 'once on record',
    'last ' + escHtml(stockShortDate(p.lastBought)) + (p.nextDue ? ', next ~' + escHtml(stockShortDate(p.nextDue)) : ''));
  if (p.rate && p.rate.rate) h += row('Use', escHtml(stockFmtQty(p.used30)) + ' ' + escHtml(unit) + ' in the last 30 days', escHtml(stockFmtRate(p.rate.rate)) + ' ' + escHtml(unit) + '/day');
  if (p.costDay != null) h += row('Costs', 'at the last price', formatCurrency(p.costDay) + '/day · ' + formatCurrency(p.costMonth) + '/month');
  h += '</div>';
  if (_stockBill && _stockBill.itemId === item.id) h += stockBillFormHtml(item);
  else h += '<button class="inv-stk-btn" data-action="invStockBillOpen">Add a bill</button>';
  return h;
}

/* ---------- The live cost ---------- */
var COST_MODEL_DEFAULTS = { power: 0.81, other: 0.42, zincKgMonth: 425, zincPerKg: 2.21 };
function costModelCfg() {
  var c = S.costModel || {}, d = COST_MODEL_DEFAULTS;
  return { power: c.power > 0 ? c.power : d.power, other: c.other > 0 ? c.other : d.other, zincKgMonth: c.zincKgMonth > 0 ? c.zincKgMonth : d.zincKgMonth,
    zincPerKg: c.zincPerKg > 0 ? c.zincPerKg : d.zincPerKg };
}
function costBills() {
  if (!Array.isArray(S.costBills)) S.costBills = [];
  return S.costBills;
}
var COST_BILL_KINDS = { power: 'Electricity', other: 'Consumables, ETP, maintenance' };

/* The share of a month's bill that falls inside the range, by calendar days. */
function costMonthShare(month, from, to) {
  var start = month + '-01', end = payMonthEnd(start);
  var a = from > start ? from : start, b = to < end ? to : end;
  if (a > b) return 0;
  return (stockDaysApart(a, b) + 1) / (stockDaysApart(start, end) + 1);
}

/* Every row is MEASURED where the record exists and FILLED from its model rate
   where it does not, pro rata by the days (or, for labour, the working days)
   the record leaves out. The fill is a line of its own in the breakdown, and
   only the measured part counts towards "measured". Reading an unrecorded
   stretch as zero made the plant look cheapest exactly where least was known:
   a quarter with one power bill read as a quarter that used one month's power. */
function liveCost(from, to, kg) {
  var cfg = costModelCfg(), days = stockDaysApart(from, to) + 1, rows = [];
  // What the bank paid, the second instrument (bank.js loads after this file; read at call time).
  var bk = typeof bankCostForRange === 'function' && bankRows().length ? bankCostForRange(from, to) : null;
  var per = function(v) { return kg > 0 ? v / kg : null; };
  var fillLine = function(perKg, share, what) {
    return { label: 'Not recorded: ' + what, sub: formatCurrency(perKg) + '/kg model × ' + formatNum(share * 100, 0) + '% of the tonnage', amount: perKg * kg * share, fill: true };
  };
  var push = function(r) {
    var fill = r.detail.filter(function(d) { return d.fill; }).reduce(function(s, d) { return s + d.amount; }, 0);
    r.measured = r.measuredOverride != null ? r.measuredOverride : r.amount - fill;
    // Paid from the bank, with nothing from the app's own records beside it.
    var paid = r.detail.some(function(d) { return d.bank; }) && !r.detail.some(function(d) { return !d.bank && !d.fill && !d.ref && d.amount; });
    if (!r.source) r.source = r.measured <= 0.005 ? 'model' : (fill > 0.005 || r.low ? 'partial' : paid ? 'bank' : 'measured');
    rows.push(r);
  };

  // Labour: the attendance record, every tier; unrecorded working days at the model.
  var lab = labourForRange(from, to), lm = labourCfg().modelPerKg || 3.55;
  var labMissing = lab.total > 0 ? Math.max(0, 1 - lab.coverage) : 1;
  var labDetail = [['Monthly crew, days worked', lab.monthlyDays], ['Monthly crew, rest days', lab.rest], ['Hourly pool', lab.pool],
    ['Daily tier', lab.daily + lab.dailyRest], ['Overtime', lab.ot], ['EXTRA pool', lab.extra]].filter(function(d) { return d[1]; })
    .map(function(d) { return { label: d[0], amount: d[1] }; });
  var labCov = lab.total > 0 ? lab.coverage : 0;
  // The order: attendance where 90% of the days are recorded; else what the bank paid, where the
  // statement covers more of the period than attendance does; else attendance and the model.
  if (labCov < 0.9 && bk && bk.labour.known > 0.001 && bk.labour.known >= labCov) {
    var bl = bk.labour, blMissing = Math.max(0, 1 - bl.known);
    var blDetail = bl.months.map(function(mo) {
      return { label: 'Paid for ' + billsMonthLabel(mo.month), bank: true, amount: mo.amount,
        sub: [mo.named ? formatCurrency(mo.named) + ' to named hands, paid the month after' : '', mo.cash ? formatCurrency(mo.cash) + ' cash, by pay week' : '', mo.share < 0.999 ? formatNum(mo.share * 100, 0) + '% of the month' : ''].filter(Boolean).join(' · ') || 'nothing paid' };
    });
    if (blMissing > 0.001) blDetail.push(fillLine(lm, blMissing, Math.round(blMissing * 100) + '% of the period the statement does not cover'));
    push({ key: 'labour', label: 'Labour', coverage: labCov, bankShare: bl.known, amount: bl.amount + (blMissing > 0.001 ? lm * kg * blMissing : 0),
      note: 'paid, from the bank statement: ' + Math.round(bl.known * 100) + '% of the period · attendance covers ' + Math.round(labCov * 100) + '%', detail: blDetail });
  } else {
    if (labMissing > 0.001) labDetail.push(fillLine(lm, labMissing, Math.round(labMissing * 100) + '% of working days'));
    push({ key: 'labour', label: 'Labour', coverage: labCov, amount: lab.total + (labMissing > 0.001 ? lm * kg * labMissing : 0),
      note: lab.total > 0 ? Math.round(lab.coverage * 100) + '% of working days recorded' : 'no attendance recorded: ' + formatCurrency(lm) + '/kg from Settings', detail: labDetail });
  }

  // Chemicals and zinc: what the stock record says was used, at the price paid.
  var chem = { amount: 0, detail: [], unpriced: [] }, zinc = { qty: 0, amount: 0, priced: true, item: null };
  var byItem = {};
  stockData().entries.forEach(function(e) {
    if (e.voided || (e.kind !== 'used' && e.kind !== 'charged') || e.date < from || e.date > to) return;
    var it = stockItem(e.itemId);
    if (!it) return;
    var p = stockPriceAt(it.id, e.date);
    var r = byItem[it.id] || (byItem[it.id] = { item: it, qty: 0, amount: 0, priced: true, price: null });
    r.qty += e.qty;
    if (p) { r.amount += e.qty * p.price; r.price = p.price; } else r.priced = false;
  });
  Object.keys(byItem).forEach(function(id) {
    var r = byItem[id];
    if (r.item.key === 'ZINC') { zinc = { qty: r.qty, amount: r.amount, priced: r.priced, item: r.item }; return; }
    if (r.priced) { chem.amount += r.amount; chem.detail.push({ label: r.item.name, sub: stockFmtQty(r.qty) + ' ' + (r.item.unit || '') + ' × ' + formatCurrency(r.price), amount: r.amount }); }
    else chem.unpriced.push({ label: r.item.name, sub: stockFmtQty(r.qty) + ' ' + (r.item.unit || '') + ' used, no price' });
  });
  // What was BOUGHT in the period, by bill date. Shown beside the figure for
  // reference and never used as it: a purchase is stock on the shelf, not use,
  // and a month that restocked would read as a month that consumed.
  var bought = { zinc: { qty: 0, amount: 0, bills: 0 }, chem: { amount: 0, bills: 0 } };
  stockData().items.forEach(function(it) {
    stockPurchases(it.id).forEach(function(b) {
      if (b.date < from || b.date > to) return;
      var t = it.key === 'ZINC' ? bought.zinc : bought.chem;
      t.amount += (b.e.price || 0) * (b.e.qty || 0); t.bills++;
      if (it.key === 'ZINC') t.qty += b.e.qty || 0;
    });
  });
  var boughtLine = function(t, what) {
    return t.bills ? [{ label: 'Bought in the period, for reference', sub: t.bills + ' bill line' + (t.bills === 1 ? '' : 's') + (what ? ' · ' + what : '') + ' · purchases are not use, so not in the figure', amount: t.amount, ref: true }] : [];
  };
  // How much of the period the stock record covers.
  var firstStock = null;
  stockData().entries.forEach(function(e) { if (!e.voided && e.kind !== 'bill' && (!firstStock || e.date < firstStock)) firstStock = e.date; });
  var coveredDays = !firstStock || firstStock > to ? 0 : firstStock <= from ? days : stockDaysApart(firstStock, to) + 1;
  var stockMissing = 1 - coveredDays / days;
  var stockWhat = coveredDays ? (days - coveredDays) + ' of ' + days + ' days before the stock record starts (' + stockShortDate(firstStock) + ')' : 'no stock record in this period';

  var chemModel = stockCfg().chemModel;
  var chemDetail = chem.detail.sort(function(a, b) { return b.amount - a.amount; }).concat(chem.unpriced);
  if (stockMissing > 0.001) chemDetail.push(fillLine(chemModel, stockMissing, stockWhat));
  var chemLines = chem.detail.length + chem.unpriced.length;
  push({ key: 'chem', label: 'Chemicals', amount: chem.amount + (stockMissing > 0.001 ? chemModel * kg * stockMissing : 0), low: chem.unpriced.length > 0,
    note: (chemLines ? chem.detail.length + ' of ' + chemLines + ' lines used are priced' + (chem.unpriced.length ? ', so the measured part reads low' : '') : 'no chemical use recorded') +
      (stockMissing > 0.001 && coveredDays ? ' · ' + (days - coveredDays) + ' days at the model' : ''),
    detail: chemDetail.concat(boughtLine(bought.chem)).concat(bk && bk.supplies.months.length ? [{ label: 'Paid to suppliers, for reference', ref: true, amount: bk.supplies.amount,
      sub: 'chemicals and zinc together, from the bank · ' + Math.round(bk.supplies.known * 100) + '% of the period on the statement · a payment is not use, so not in the figure' }] : []) });

  var landed = typeof zincLandedRate === 'function' ? zincLandedRate() : null;
  // Modelled zinc kilos are priced at what was last PAID by the end of the
  // period, and only failing that at today's market rate.
  var zincItem = stockData().items.find(function(i) { return i.key === 'ZINC'; });
  var zincPaid = zincItem ? stockPriceAt(zincItem.id, to) : null;
  if (zincPaid && zincPaid.date > to) zincPaid = null;
  var zp = zincPaid ? zincPaid.price : landed;
  var zDetail = [], zAmount = 0, zMeasured = 0, zSource = null;
  if (zinc.qty > 0) {
    var zPrice = zinc.priced ? null : landed;
    var zAmt = zinc.priced ? zinc.amount : (landed ? zinc.qty * landed : 0);
    zDetail.push({ label: 'Charged', sub: stockFmtQty(zinc.qty) + ' kg' + (zinc.priced ? ' at the price paid' : zPrice ? ' × the market rate ' + formatCurrency(zPrice) + ' (no bill yet)' : ', no price'), amount: zAmt });
    zAmount += zAmt; zMeasured += zinc.priced ? zAmt : 0;
    if (!zinc.priced) zSource = 'rate';
  }
  if (stockMissing > 0.001 && zp) {
    var missDays = days * stockMissing, zkg = cfg.zincKgMonth * missDays / 30;
    zDetail.push({ label: 'Not recorded: ' + (coveredDays ? stockWhat : 'zinc use'), sub: formatNum(zkg, 0) + ' kg (' + cfg.zincKgMonth + ' kg/month) × ' + formatCurrency(zp) + (zincPaid ? ' last paid, ' + stockShortDate(zincPaid.date) : ' market rate'), amount: zkg * zp, fill: true });
    zAmount += zkg * zp;
  }
  if (stockMissing > 0.001 && !zp) {
    // No zinc price of any kind: the cost model's ₹/kg, never nothing.
    zDetail.push(fillLine(cfg.zincPerKg, stockMissing, coveredDays ? stockWhat : 'zinc use, and no zinc rate set'));
    zAmount += cfg.zincPerKg * kg * stockMissing;
  }
  if (!zDetail.length) zSource = 'none';
  push({ key: 'zinc', label: 'Zinc', amount: zAmount, measuredOverride: zMeasured, source: zSource && zMeasured === 0 && zSource !== 'none' && zDetail.length === 1 ? 'rate' : (zSource === 'none' ? 'none' : null),
    note: zSource === 'none' ? 'no zinc use recorded and no zinc rate set' : (zinc.qty > 0 ? stockFmtQty(zinc.qty) + ' kg charged' : 'use not recorded') + (stockMissing > 0.001 && zp && coveredDays ? ' · ' + (days - coveredDays) + ' days at the model' : ''),
    detail: zDetail.concat(boughtLine(bought.zinc, stockFmtQty(bought.zinc.qty) + ' kg')) });

  // Power and other: each month's bill for its share of the period; a month
  // with no bill at the model rate, for its share of the tonnage.
  var months = [], m = from.slice(0, 7);
  for (var g = 0; m <= to.slice(0, 7) && g < 240; g++) { months.push(m); var d = new Date(m + '-01T00:00:00'); d.setMonth(d.getMonth() + 1); m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  ['power', 'other'].forEach(function(kind) {
    var bills = costBills().filter(function(b) { return b.kind === kind && !b.voided; });
    var amt = 0, detail = [], unbilled = 0, unbilledMonths = [];
    months.forEach(function(mo) {
      var start = mo + '-01', end = payMonthEnd(start);
      var a = from > start ? from : start, z = to < end ? to : end;
      var rangeShare = (stockDaysApart(a, z) + 1) / days;
      var mine = bills.filter(function(b) { return b.month === mo; });
      var bm = !mine.length && bk ? bk[kind].months.find(function(x) { return x.month === mo; }) : null;
      if (bm) {
        amt += bm.amount;
        detail.push({ label: 'Paid for ' + billsMonthLabel(mo), bank: true, amount: bm.amount,
          sub: 'from the bank, no bill entered · ' + bm.rows.length + ' payment' + (bm.rows.length === 1 ? '' : 's') + (bm.share < 0.999 ? ' × ' + formatNum(bm.share * 100, 0) + '% of the month' : '') });
        return;
      }
      if (!mine.length) { unbilled += rangeShare; unbilledMonths.push(mo); return; }
      mine.forEach(function(b) {
        var share = costMonthShare(b.month, from, to);
        amt += b.amount * share;
        detail.push({ label: (b.label || COST_BILL_KINDS[kind]) + ' · ' + b.month, sub: formatCurrency(b.amount) + (share < 0.999 ? ' × ' + formatNum(share * 100, 0) + '% of the month' : '') + (b.units ? ' · ' + b.units + ' units' : '') + (b.note ? ' · ' + b.note : ''), amount: b.amount * share });
      });
    });
    if (unbilled > 0.001) detail.push(fillLine(cfg[kind], unbilled, 'no bill for ' + unbilledMonths.join(', ')));
    if (kind === 'other' && bk && bk.unsorted.amount >= 1) {
      var np = Object.keys(bk.unsorted.payees).length;
      detail.push({ label: 'Paid to payees not yet sorted, not counted', ref: true, amount: bk.unsorted.amount,
        sub: np + ' payee' + (np === 1 ? '' : 's') + ' on the bank statement read as neither supplier nor cost · set each once in Finance → Bank, and the month counts' });
    }
    push({ key: kind, label: COST_BILL_KINDS[kind], amount: amt + (unbilled > 0.001 ? cfg[kind] * kg * unbilled : 0),
      note: (function() {
        var nb = detail.filter(function(x) { return !x.fill && !x.bank && !x.ref; }).length, np = detail.filter(function(x) { return x.bank; }).length;
        var parts = [nb ? nb + ' bill' + (nb === 1 ? '' : 's') : '', np ? np + ' month' + (np === 1 ? '' : 's') + ' paid, from the bank' : '',
          unbilledMonths.length && (nb || np) ? unbilledMonths.length + ' month' + (unbilledMonths.length === 1 ? '' : 's') + ' at the model' : ''].filter(Boolean);
        return parts.length ? parts.join(' · ') : formatCurrency(cfg[kind]) + '/kg from Settings; no bill entered for this period';
      })(), detail: detail });
  });

  rows.forEach(function(r) { r.amount = gstRound(r.amount); r.measured = gstRound(Math.min(r.measured, r.amount)); r.perKg = per(r.amount); });
  var total = gstRound(rows.reduce(function(s, r) { return s + r.amount; }, 0));
  var measured = rows.reduce(function(s, r) { return s + (r.measured > 0 ? r.measured : 0); }, 0);
  return { from: from, to: to, kg: kg, rows: rows, total: total, perKg: per(total), measuredShare: total > 0 ? measured / total : 0 };
}

/* Recorded against paid (docs/FINANCE_INTELLIGENCE_SPEC.md, 4c): the app's own record of a cost set
   beside what the bank paid for it, over ONLY the months where both exist — numerator and
   denominator, same population. A gap over 10% is flagged, never smoothed: the reasons it can be
   right are written on the row. Chemicals and zinc compare use with purchases, which differ by
   design, so that row is never flagged. */
var COST_GAP = 0.10;
function liveCostPaidCheck(from, to) {
  if (typeof bankCostForRange !== 'function' || !bankRows().length) return [];
  var bk = bankCostForRange(from, to), out = [];
  var span = function(ym) { var s = ym + '-01', e = payMonthEnd(s); return [from > s ? from : s, to < e ? to : e]; };
  var finish = function(key, label, t, why, known) {
    var r = { key: key, label: label, months: t.months, skipped: t.skipped, recorded: null, paid: null, delta: null, pct: null, flag: false, why: why };
    if (key === 'supplies' && t.paid < 1 && t.recorded < 1) { r.note = 'no priced use and no supplier payment in the months the statement covers'; out.push(r); return; }
    if (t.months.length) {
      r.recorded = gstRound(t.recorded); r.paid = gstRound(t.paid); r.delta = gstRound(t.paid - t.recorded);
      r.pct = t.recorded > 0 ? r.delta / t.recorded : null;
      r.flag = key !== 'supplies' && (r.pct == null ? r.paid > 0 : Math.abs(r.pct) > COST_GAP);
    }
    r.note = t.months.length ? 'over ' + t.months.map(billsMonthLabel).join(', ') + (t.skipped.length ? ' · not ' + t.skipped.map(billsMonthLabel).join(', ') + ': ' + known : '') + ' · ' + why
      : t.skipped.length ? 'nothing to compare: ' + known + ' for ' + t.skipped.map(billsMonthLabel).join(', ') : 'nothing paid on the statement for this period';
    out.push(r);
  };

  var lab = { recorded: 0, paid: 0, months: [], skipped: [] };
  bk.labour.months.forEach(function(mo) {
    var p = span(mo.month), l = labourForRange(p[0], p[1]);
    if (!(l.total > 0) || l.coverage < 0.9) { lab.skipped.push(mo.month); return; }
    lab.recorded += l.total; lab.paid += mo.amount; lab.months.push(mo.month);
  });
  finish('labour', 'Labour', lab, 'salaries are set against the month before; cash against the pay week it was drawn in', 'attendance under 90% of days');

  ['power', 'other'].forEach(function(kind) {
    var t = { recorded: 0, paid: 0, months: [], skipped: [] };
    bk[kind].months.forEach(function(mo) {
      var bills = costBills().filter(function(b) { return b.kind === kind && !b.voided && b.month === mo.month; });
      if (!bills.length) { t.skipped.push(mo.month); return; }
      t.recorded += bills.reduce(function(s, b) { return s + b.amount; }, 0) * mo.share; t.paid += mo.amount; t.months.push(mo.month);
    });
    finish(kind, COST_BILL_KINDS[kind], t, kind === 'power' ? 'a payment settles the month before unless set otherwise' : 'bills are before GST, a payment includes it', 'no bill entered');
  });

  var sup = { recorded: 0, paid: 0, months: [], skipped: [] };
  bk.supplies.months.forEach(function(mo) {
    var p = span(mo.month), u = liveCost(p[0], p[1], 0);
    var used = u.rows.filter(function(r) { return r.key === 'chem' || r.key === 'zinc'; }).reduce(function(s, r) { return s + (r.measured > 0 ? r.measured : 0); }, 0);
    sup.recorded += used; sup.paid += mo.amount; sup.months.push(mo.month);
  });
  finish('supplies', 'Chemicals and zinc', sup, 'used against bought: a purchase is stock on the shelf, so these differ by design', '');
  return out;
}
function _costPaidHtml(from, to) {
  var chk = liveCostPaidCheck(from, to);
  if (!chk.length) return '';
  return '<div class="inv-cost-bills" id="liveCostPaid"><div class="inv-stk-label">Recorded against paid</div>' + chk.map(function(r) {
    // The gap on the right; what it is the gap between leads the note, so a phone keeps one figure per column.
    var fig = r.recorded == null ? '&mdash;' : (r.delta >= 0 ? '+' : '&minus;') + formatCurrency(Math.abs(r.delta)) +
      (r.pct != null ? ' (' + (r.pct >= 0 ? '+' : '&minus;') + formatNum(Math.abs(r.pct) * 100, 0) + '%)' : '');
    var note = (r.recorded == null ? '' : 'recorded ' + formatCurrency(r.recorded) + ' · paid ' + formatCurrency(r.paid) + ' · ') + r.note;
    return '<div class="inv-cost-dline" data-paid="' + r.key + '"><span>' + escHtml(r.label) + (r.flag ? ' <span class="inv-dot inv-dot-danger">over 10% apart</span>' : '') +
      '<span class="inv-cost-note">' + escHtml(note) + '</span></span><span class="inv-mono inv-nowrap">' + fig + '</span></div>';
  }).join('') + '</div>';
}

/* Derive from the bank (docs/FINANCE_INTELLIGENCE_SPEC.md, 4d): the six closed months before this one
   that the statement can speak for, each as paid ÷ tonnage, and the six together as total paid ÷ total
   tonnage — a sum over a sum, not a mean of ratios, so a thin month cannot pull the figure. Offered,
   never applied: Use fills the field and leaves the section unsaved, the zinc uplift's contract. */
var COST_DERIVE_FIELDS = { labour: ['setLabModel', 'Labour'], power: ['setCostPower', 'Electricity'], other: ['setCostOther', 'Consumables, ETP'] };
function costDeriveFromBank(which) {
  var keys = which === 'labour' ? ['labour'] : ['power', 'other'];
  var out = document.getElementById(which === 'labour' ? 'labDeriveOut' : 'costDeriveOut');
  var res = costDeriveCompute(keys);
  if (out) out.innerHTML = _costDerivedHtml(res);
  return res;
}
function costDeriveCompute(keys) {
  if (!bankRows().length) return { none: 'No bank statement imported: Finance → Bank → Import.' };
  var bm = bankCostByMonth(), active = (S.invoices || []).filter(function(i) { return i.status === 'active' && i.date; });
  var months = [], ym = localDateStr().slice(0, 7);
  for (var k = 0; k < 6; k++) { ym = bankPrevMonth(ym + '-01'); months.unshift(ym); }
  var res = {};
  keys.forEach(function(key) {
    var rows = [], paid = 0, kg = 0;
    months.forEach(function(m) {
      if (!bankMonthKnown(bm, m, key)) { rows.push({ month: m, skip: key === 'power' ? 'no payment for this month' : 'not on the statement' }); return; }
      var e = bm.months[m], p = gstRound(e ? e[key].amount : 0), s = m + '-01';
      var w = weighLines(active.filter(function(i) { return i.date >= s && i.date <= payMonthEnd(s); })).kg;
      if (!(w > 0)) { rows.push({ month: m, skip: 'no tonnage invoiced' }); return; }
      rows.push({ month: m, paid: p, kg: w, perKg: p / w });
      paid += p; kg += w;
    });
    res[key] = { rows: rows, paid: paid, kg: kg, perKg: kg > 0 ? Math.round(paid / kg * 100) / 100 : null };
  });
  return res;
}
function _costDerivedHtml(res) {
  if (res.none) return '<div class="inv-text-muted inv-storage-text">' + escHtml(res.none) + '</div>';
  var set = { labour: labourCfg().modelPerKg, power: costModelCfg().power, other: costModelCfg().other };
  return Object.keys(res).map(function(key) {
    var d = res[key], f = COST_DERIVE_FIELDS[key];
    var h = '<div class="inv-set-derive-rows" data-derive="' + key + '"><div class="inv-set-derive-row"><strong>' + escHtml(f[1]) + '</strong></div>' + d.rows.map(function(r) {
      return '<div class="inv-set-derive-row"><span>' + escHtml(billsMonthLabel(r.month)) + '</span><span class="inv-mono">' + (r.skip ? escHtml(r.skip)
        : formatCurrency(r.paid) + ' &divide; ' + formatNum(r.kg / 1000, 1) + ' t = ' + formatCurrency(r.perKg) + '/kg') + '</span></div>';
    }).join('') + '</div>';
    if (d.perKg == null) return h + '<div class="inv-text-muted inv-storage-text">No month the statement covers has tonnage beside it, so nothing to offer.</div>';
    var n = d.rows.filter(function(r) { return !r.skip; }).length;
    return h + '<div class="inv-set-derive-foot"><span>' + n + ' month' + (n === 1 ? '' : 's') + ': ' + formatCurrency(d.paid) + ' &divide; ' + formatNum(d.kg / 1000, 1) + ' t = <strong class="inv-mono">' +
      formatCurrency(d.perKg) + '/kg</strong> against ' + formatCurrency(set[key] || 0) + ' set</span>' +
      '<button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invCostUseDerived" data-field="' + f[0] + '" data-val="' + d.perKg + '">Use ' + formatCurrency(d.perKg) + '</button></div>';
  }).join('') + (res.labour ? '<div class="inv-text-muted inv-storage-text">Paid covers every wage leg on the statement: salaries for the month before, and cash by pay week, the EXTRA pool with it.</div>' : '');
}
function costUseDerived(field, val) {
  var el = document.getElementById(field);
  if (!el) return;
  el.value = val;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

var COST_SRC_LABEL = { measured: 'measured', bank: 'paid, bank', partial: 'part-recorded', rate: 'market rate', model: 'model', none: 'nothing recorded' };
var _costBillOpen = false;

function renderLiveCostCard(period, tonnage) {
  var range = periodRange(period, 0);
  var iso = function(ts) { var d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var from = range ? iso(range.start) : ((S.invoices || []).map(function(i) { return i.date; }).filter(Boolean).sort()[0] || localDateStr());
  var to = range ? iso(range.end) : localDateStr();
  var kg = tonnage ? tonnage.kg : 0;
  var c = liveCost(from, to, kg);
  var h = '<div class="inv-stats-card inv-stats-card-full" id="liveCost"><div class="inv-stats-title">' + escHtml(PERIOD_LABELS[period] || '') + ' Live cost' +
    '<span class="inv-stats-title-sub">every figure with where it came from</span></div>';
  h += '<div class="inv-stats-row"><span class="inv-stats-name"><strong>Full cost</strong><span class="inv-cost-note">' + formatNum(kg / 1000, 1) + ' t plated · ' +
    Math.round(c.measuredShare * 100) + '% of it measured</span></span><span class="inv-stats-val"><strong>' + (c.perKg != null ? formatCurrency(c.perKg) + '/kg' : '&mdash;') + '</strong><span class="inv-cost-note">' + formatCurrency(c.total) + '</span></span></div>';
  var partial = c.rows.filter(function(r) { return r.source === 'partial'; }).map(function(r) { return r.label.toLowerCase(); });
  if (partial.length) h += '<div class="inv-stats-alert">This period reads LOW: ' + escHtml(partial.join(' and ')) + (partial.length === 1 ? ' is' : ' are') + ' only part-recorded. Open a line to see what is missing.</div>';
  c.rows.forEach(function(r) {
    h += '<details class="inv-cost-row"><summary class="inv-stats-row"><span class="inv-stats-name">' + escHtml(r.label) +
      ' <span class="inv-cost-src inv-cost-src-' + r.source + '">' + COST_SRC_LABEL[r.source] + '</span><span class="inv-cost-note">' + escHtml(r.note) + '</span></span>' +
      '<span class="inv-stats-val">' + (r.perKg != null ? formatCurrency(r.perKg) + '/kg' : '&mdash;') + '<span class="inv-cost-note">' + formatCurrency(r.amount) + '</span></span></summary>';
    if (r.detail.length) {
      h += '<div class="inv-cost-detail">' + r.detail.map(function(d) {
        return '<div class="inv-cost-dline"><span>' + escHtml(d.label) + (d.sub ? '<span class="inv-cost-note">' + escHtml(d.sub) + '</span>' : '') + '</span><span class="inv-mono">' + (d.amount != null ? formatCurrency(gstRound(d.amount)) : '&mdash;') + '</span></div>';
      }).join('') + '</div>';
    }
    h += '</details>';
  });
  h += _costPaidHtml(from, to);
  var typed = S.defaultCostPerKg || 0;
  if (typed && c.perKg != null) h += '<div class="inv-stats-caveat">The figure typed in Settings is ' + formatCurrency(typed) + '/kg; this period measures ' + formatCurrency(c.perKg) + '/kg. ' +
    'Anything marked model is a Settings fallback until the record exists: add bills to Stock lines, and power and other bills below.</div>';
  h += _costBillHtml();
  return h + '</div>';
}

function _costBillHtml() {
  var bills = costBills().slice().sort(function(a, b) { return a.month < b.month ? 1 : -1; });
  var h = '<div class="inv-cost-bills"><div class="inv-stk-label">Electricity and other bills</div>';
  bills.slice(0, 12).forEach(function(b) {
    h += '<div class="inv-cost-dline' + (b.voided ? ' inv-pay-void' : '') + '"><span>' + escHtml((b.label || COST_BILL_KINDS[b.kind]) + ' · ' + b.month) +
      '<span class="inv-cost-note">' + escHtml([b.units ? b.units + ' units' : '', b.note || '', b.voided ? 'void: ' + (b.voidReason || '') : ''].filter(Boolean).join(' · ')) + '</span></span>' +
      '<span class="inv-mono">' + formatCurrency(b.amount) + (b.voided ? '' : ' <button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invCostBillVoid" data-id="' + escHtml(b.id) + '">Void</button>') + '</span></div>';
  });
  if (!_costBillOpen || _costBillOpen.where !== 'stats') {
    return h + '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invCostBillOpen" data-where="stats">Add a bill</button>' +
      '<div class="inv-note">Bills are also kept under Stock &rarr; Bills &amp; notes.</div></div>';
  }
  return h + costBillFormHtml() + '</div>';
}

/* One form, drawn wherever it was opened: Stats → Live cost, or Finance → Bills & notes. */
function costBillFormHtml() {
  var o = _costBillOpen || {}, m = o.month || localDateStr().slice(0, 7);
  return '<div class="inv-fields">' +
    '<label class="inv-field"><span class="inv-field-label">Kind</span><select class="inv-select" id="costBillKind">' +
    '<option value="power">Electricity</option><option value="other">Consumables, ETP, maintenance</option></select></label>' +
    '<label class="inv-field"><span class="inv-field-label">Month it covers</span><input class="inv-input" id="costBillMonth" type="month" value="' + escHtml(m) + '"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Amount, before GST</span><input class="inv-input inv-input-num" id="costBillAmount" type="number" step="0.01" min="0" inputmode="decimal"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Units (electricity)</span><input class="inv-input inv-input-num" id="costBillUnits" type="number" step="1" min="0" inputmode="numeric"></label>' +
    '<label class="inv-field inv-kv-wide"><span class="inv-field-label">Note</span><input class="inv-input" id="costBillNote" placeholder="e.g. JBVNL bill, ETP sludge"></label></div>' +
    '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCostBillCancel">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invCostBillSave">Save bill</button></div>';
}
function costBillRedraw(where) { if (where === 'finance') renderFinance(); else renderStats(); }
/* The page a form or a button sits on. Both pages stay in the DOM when hidden, so a form left open
   on Stats still holds the same ids as one opened on Stock, and a bare getElementById reads the
   hidden one (Stats comes first). Every lookup is scoped to the page the form was opened on. */
function costBillRoot(where) { return document.getElementById(where === 'finance' ? 'pageFinance' : 'pageStats') || document; }

function costBillSave() {
  var root = costBillRoot((_costBillOpen || {}).where);
  var v = function(id) { return ((root.querySelector('#' + id) || {}).value || '').trim(); };
  var kind = v('costBillKind') === 'other' ? 'other' : 'power', month = v('costBillMonth'), amount = gstRound(parseFloat(v('costBillAmount')) || 0);
  if (!/^\d{4}-\d{2}$/.test(month)) { showToast('Pick the month the bill covers', 'error'); return; }
  if (!(amount > 0)) { showToast('Enter the amount', 'error'); return; }
  var units = parseFloat(v('costBillUnits'));
  costBills().push({ id: 'CB-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: kind, month: month, amount: amount,
    units: units > 0 ? units : null, note: v('costBillNote'), at: Date.now() });
  var where = (_costBillOpen || {}).where;
  _costBillOpen = false;
  saveState();
  costBillRedraw(where);
  showToast(COST_BILL_KINDS[kind] + ' bill saved for ' + month);
}
function costBillVoid(id, where) {
  var b = costBills().find(function(x) { return x.id === id; });
  if (!b || b.voided) return;
  var reason = prompt('Why is this bill void? (kept on the record, not deleted)');
  if (reason == null) return;
  if (!reason.trim()) { showToast('A void needs a reason', 'error'); return; }
  b.voided = Date.now();
  b.voidReason = reason.trim();
  saveState();
  costBillRedraw(where);
}
function costAction(action, btn) {
  switch (action) {
    case 'invCostBillOpen': {
      var where = btn.dataset.where === 'finance' ? 'finance' : 'stats';
      _costBillOpen = { where: where, month: btn.dataset.month || '' };
      costBillRedraw(where);
      var a = costBillRoot(where).querySelector('#costBillAmount'); if (a) a.focus();
      return true;
    }
    case 'invCostBillCancel': { var w = (_costBillOpen || {}).where; _costBillOpen = false; costBillRedraw(w); return true; }
    case 'invCostBillSave': costBillSave(); return true;
    // Redraw the page the Void was tapped on, read from the button, not guessed from a hidden page's DOM.
    case 'invCostBillVoid': costBillVoid(btn.dataset.id, btn.closest('#pageStock') ? 'stock' : 'stats'); return true;
  }
  return false;
}

/* ---------- The reorder list ----------
   Owner, 25 Sep 2026: "add a stock reorder list generator". For every line
   with a daily use on record: what it will use over the lead time plus the days
   to cover, less what is on the shelf, rounded up to the pack it is bought in,
   at the last price paid, grouped by the supplier it last came from. Typed
   quantities win over the suggestion. Nothing is ordered from here: the list
   is copied as a message for whoever places the order. */
var _stockReorder = null;   // { qty: { itemId: typed } }
var STOCK_REORDER_DEFAULTS = { leadDays: 10, coverDays: 30 };
function stockReorderCfg() {
  var c = S.stockCheck || {}, d = STOCK_REORDER_DEFAULTS;
  return { leadDays: c.leadDays > 0 ? c.leadDays : d.leadDays, coverDays: c.coverDays > 0 ? c.coverDays : d.coverDays };
}
/* The pack a line is bought in: the smallest purchase, when every purchase is a
   whole number of it (30 L cans bought as 30, 60 and 90). */
function stockPackSize(item) {
  var q = stockPurchases(item.id).map(function(p) { return p.e.qty; }).filter(function(v) { return v > 0; });
  if (q.length < 2) return null;
  var pack = Math.min.apply(null, q);
  return q.every(function(v) { var r = v / pack; return Math.abs(r - Math.round(r)) < 0.05; }) ? pack : null;
}
function stockReorderList() {
  var cfg = stockReorderCfg(), rows = [], skipped = { enough: 0, norate: [] };
  stockData().items.filter(function(i) { return i.active !== false; }).forEach(function(it) {
    var st = stockStatus(it), rate = st.rate && st.rate.rate ? st.rate.rate : null, level = st.level == null ? 0 : Math.max(0, st.level);
    var typed = _stockReorder && _stockReorder.qty[it.id];
    if (!rate) {
      if (st.level != null && st.level <= 0 || typed) rows.push({ item: it, need: null, suggest: null, pack: stockPackSize(it), level: level, rate: null, noRate: true });
      else skipped.norate.push(it.name);
      return;
    }
    var need = rate * (cfg.leadDays + cfg.coverDays) - level;
    var pack = stockPackSize(it);
    var suggest = need > 0 ? (pack ? Math.ceil(need / pack) * pack : Math.ceil(need)) : 0;
    if (suggest <= 0 && !typed) { skipped.enough++; return; }
    rows.push({ item: it, need: need, suggest: suggest, pack: pack, level: level, rate: rate, daysLeft: st.daysLeft, tentative: !!(st.rate && st.rate.tentative) });
  });
  rows.forEach(function(r) {
    var typed = _stockReorder && _stockReorder.qty[r.item.id];
    r.qty = typed != null && typed !== '' ? Math.max(0, parseFloat(typed) || 0) : (r.suggest || 0);
    var lp = stockPriceAt(r.item.id, '9999-12-31');
    r.price = lp ? lp.price : null;
    r.supplier = lp && lp.supplier ? lp.supplier : 'No supplier on record';
    r.amount = r.price != null ? gstRound(r.qty * r.price) : null;
  });
  var groups = {};
  rows.forEach(function(r) { (groups[r.supplier] = groups[r.supplier] || []).push(r); });
  var order = Object.keys(groups).sort(function(a, b) { return (a === 'No supplier on record') - (b === 'No supplier on record') || a.localeCompare(b); });
  var total = rows.reduce(function(s, r) { return s + (r.amount || 0); }, 0);
  return { cfg: cfg, groups: order.map(function(k) { return { supplier: k, rows: groups[k].sort(function(a, b) { return (a.daysLeft == null ? -1 : a.daysLeft) - (b.daysLeft == null ? -1 : b.daysLeft); }) }; }),
    total: gstRound(total), unpriced: rows.filter(function(r) { return r.price == null && r.qty > 0; }).length, skipped: skipped };
}
function stockReorderText(L) {
  var lines = ['Order · ' + stockShortDate(localDateStr())];
  L.groups.forEach(function(g) {
    var rows = g.rows.filter(function(r) { return r.qty > 0; });
    if (!rows.length) return;
    lines.push('', g.supplier + ':');
    rows.forEach(function(r, i) { lines.push((i + 1) + ') ' + r.item.name + ' ' + stockFmtQty(r.qty) + ' ' + (r.item.unit || '')); });
  });
  return lines.join('\n');
}
function renderStockReorder() {
  var L = stockReorderList(), cfg = L.cfg;
  var h = stockBackBar('Stock', 'Reorder list');
  h += '<div class="inv-stk-fields"><div class="inv-stk-field"><label class="inv-stk-label" for="stockLeadDays">Lead time (days)</label>' +
    '<input type="number" min="1" step="1" inputmode="numeric" id="stockLeadDays" class="inv-form-input" value="' + cfg.leadDays + '"></div>' +
    '<div class="inv-stk-field"><label class="inv-stk-label" for="stockCoverDays">Days to cover after it lands</label>' +
    '<input type="number" min="1" step="1" inputmode="numeric" id="stockCoverDays" class="inv-form-input" value="' + cfg.coverDays + '"></div></div>' +
    '<div class="inv-stk-hint">Suggested = daily use × (' + cfg.leadDays + ' + ' + cfg.coverDays + ' days) less what is on the shelf, rounded up to the pack it is bought in. Type a quantity to change it; 0 leaves the line out.</div>';
  if (!L.groups.length) {
    h += '<div class="inv-stk-empty">Nothing to order: every line with a daily use covers ' + (cfg.leadDays + cfg.coverDays) + ' days.</div>';
  }
  L.groups.forEach(function(g) {
    var sub = g.rows.reduce(function(s, r) { return s + (r.amount || 0); }, 0);
    h += '<div class="inv-stk-sec">' + escHtml(g.supplier) + '<span>' + (sub ? escHtml(formatCurrency(gstRound(sub))) : '') + '</span></div><div class="inv-stk-reorder">';
    g.rows.forEach(function(r) {
      var unit = r.item.unit || '';
      var why = r.noRate ? 'out, and no daily use on record: enter a quantity'
        : stockFmtQty(r.level) + ' ' + unit + ' on hand · ' + stockFmtRate(r.rate) + ' ' + unit + '/day' + (r.daysLeft != null ? ' · ' + stockDaysText(r.daysLeft, false) + ' left' : '') +
          ' · needs ' + stockFmtQty(Math.max(0, r.need)) + (r.pack ? ' · packs of ' + stockFmtQty(r.pack) : '') + (r.tentative ? ' · rate from under 3 days of record: check' : '');
      h += '<div class="inv-stk-mrow"><div class="inv-stk-mname">' + escHtml(r.item.name) + '<span>' + escHtml(why) + '</span></div>' +
        '<input type="number" inputmode="decimal" step="any" min="0" class="inv-stk-in" data-stock-reorder="' + escHtml(r.item.id) + '" value="' + escHtml(stockFmtQty(r.qty)) + '" aria-label="' + escHtml(r.item.name) + ' quantity to order">' +
        '<span class="inv-stk-munit">' + escHtml(unit) + '</span>' +
        '<span class="inv-stk-rprice">' + (r.amount != null ? escHtml(formatCurrency(r.amount)) : 'no price') + '</span></div>';
    });
    h += '</div>';
  });
  if (L.skipped.enough || L.skipped.norate.length) {
    h += '<div class="inv-stk-hint">' + (L.skipped.enough ? L.skipped.enough + ' line' + (L.skipped.enough === 1 ? ' has' : 's have') + ' enough on hand. ' : '') +
      (L.skipped.norate.length ? 'No daily use yet, so nothing suggested: ' + escHtml(L.skipped.norate.join(', ')) + '.' : '') + '</div>';
  }
  if (L.groups.length) {
    h += '<div class="inv-stk-foot"><span id="stockReorderTotal">' + escHtml(formatCurrency(L.total)) + ' at the last prices, before GST' + (L.unpriced ? ' · ' + L.unpriced + ' without a price' : '') + '</span>' +
      '<button class="inv-stk-btn inv-stk-btn-pri" data-action="invStockReorderCopy">Copy as message</button></div>';
  }
  return h;
}
function stockReorderCopy() {
  var text = stockReorderText(stockReorderList());
  var done = function() { showToast('Order copied: paste it into WhatsApp'); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function() { prompt('Copy the order:', text); }); return; }
  } catch (e) { /* fall through */ }
  prompt('Copy the order:', text);
}
function stockReorderOnInput(t) {
  var id = t.getAttribute && t.getAttribute('data-stock-reorder');
  if (id && _stockReorder) { _stockReorder.qty[id] = t.value; var tot = document.getElementById('stockReorderTotal'); if (tot) { var L = stockReorderList(); tot.textContent = formatCurrency(L.total) + ' at the last prices, before GST' + (L.unpriced ? ' · ' + L.unpriced + ' without a price' : ''); } return true; }
  if (t.id === 'stockLeadDays' || t.id === 'stockCoverDays') {
    var v = parseInt(t.value, 10);
    if (v > 0) { if (!S.stockCheck) S.stockCheck = {}; S.stockCheck[t.id === 'stockLeadDays' ? 'leadDays' : 'coverDays'] = v; saveState(); }
    return true;
  }
  return false;
}
