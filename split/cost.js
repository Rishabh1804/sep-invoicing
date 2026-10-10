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
  var field = function(id, label, input) { return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' + input + '</div>'; };
  var num = function(id, v, dis) { return '<input type="number" inputmode="decimal" step="any" min="0" id="' + id + '" class="inv-input inv-input-num"' + (dis ? ' disabled' : '') + ' value="' + escHtml(v) + '">'; };
  return '<div class="inv-panel-body" id="stockBillForm"><div class="inv-panel-title inv-mb-8">' + (b.entryId ? 'The bill for this delivery' : 'A bill') + '</div>' +
    '<div class="inv-fields">' +
    field('stockBillSupplier', 'Company', '<input id="stockBillSupplier" class="inv-input" list="stockSupplierList" value="' + escHtml(b.supplier) + '" autocomplete="off">') +
    field('stockBillNo', 'Invoice no.', '<input id="stockBillNo" class="inv-input" value="' + escHtml(b.billNo) + '" autocomplete="off">') +
    field('stockBillDate', 'Invoice date', '<input type="date" id="stockBillDate" class="inv-input" value="' + escHtml(b.date) + '">') +
    field('stockBillQty', 'Quantity (' + escHtml(unit) + ')', num('stockBillQty', b.qty, !!b.entryId)) +
    field('stockBillPrice', '&#8377; per ' + escHtml(unit) + ', before GST', num('stockBillPrice', b.price)) +
    field('stockBillAmount', 'or the bill amount, before GST', num('stockBillAmount', b.amount)) +
    '</div>' + stockSupplierDatalist() +
    '<div class="inv-toolbar inv-toolbar-tight"><button class="inv-btn inv-btn-secondary" data-action="invStockBillCancel">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invStockBillSave">Save bill</button></div></div>';
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
  // A bill amount typed is the bill's figure: kept as typed, not rebuilt from a price rounded to 4 places.
  var typedAmount = !(price > 0) && amount > 0;
  if (typedAmount) price = amount / qty;
  if (!(price > 0)) { showToast('Enter the price per unit or the bill amount', 'error'); return; }
  // Kept to 4 places, rounded on the figure as typed (HR-8): 12.00035 × 10000 is 120003.4999… on the binary copy.
  price = gstRound(price, 4);
  var fields = { price: price, amount: gstRound(typedAmount ? amount : price * qty), supplier: b.supplier.trim(), billNo: b.billNo.trim(), billDate: b.date };
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
  dates.forEach(function(d) { if (!events.length || isoDaysBetween(events[events.length - 1], d) > 3) events.push(d); });
  if (events.length) out.lastBought = events[events.length - 1];
  if (events.length >= 2) {
    var gaps = [];
    for (var i = 1; i < events.length; i++) gaps.push(isoDaysBetween(events[i - 1], events[i]));
    out.cadence = numMedian(gaps);
    out.nextDue = isoAddDays(out.lastBought, Math.round(out.cadence));
  }
  var today = localDateStr(), cut = isoAddDays(today, -30);
  stockItemEntries(item.id).forEach(function(e) { if ((e.kind === 'used' || e.kind === 'charged') && e.date > cut) out.used30 += e.qty; });
  if (out.rate && out.rate.rate && out.last) {
    out.costDay = gstRound(out.rate.rate * out.last.e.price);
    out.costMonth = gstRound(out.costDay * 26);
  }
  return out;
}

/* Price and pattern, a flush panel of rows on the line's page (Stock → a line). */
function stockPatternHtml(item) {
  var p = stockPattern(item), unit = item.unit || 'unit';
  var open = _stockBill && _stockBill.itemId === item.id;
  var h = '<div class="inv-panel inv-panel-flush" id="stockPattern"><div class="inv-panel-head"><span class="inv-panel-title">Price and pattern</span>' +
    (open ? '' : '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invStockBillOpen">Add a bill</button>') + '</div>';
  if (open) h += stockBillFormHtml(item);
  var row = function(label, sub, val) {
    return '<div class="inv-row inv-row-2 inv-row-flow"><span class="inv-row-main"><span class="inv-row-title">' + label + '</span>' + (sub ? '<span class="inv-row-meta inv-row-wrap">' + sub + '</span>' : '') + '</span>' +
      '<span class="inv-row-end inv-num">' + val + '</span></div>';
  };
  if (p.last) {
    h += row('Price', 'last paid, ' + escHtml(stockShortDate(p.last.date)) + (p.last.e.supplier ? ' · ' + escHtml(p.last.e.supplier) : '') + (p.last.e.billNo ? ' · invoice ' + escHtml(p.last.e.billNo) : ''),
      formatCurrency(p.last.e.price) + '/' + escHtml(unit));
    if (p.prev) h += row('Change', 'against ' + formatCurrency(p.prev.e.price) + ' on ' + escHtml(stockShortDate(p.prev.date)),
      (p.change > 0 ? '+' : p.change < 0 ? '&minus;' : '') + formatNum(Math.abs(p.change) * 100, 1) + '%');
    if (p.buys.length > 1) h += row('Range', p.buys.length + ' priced purchases', formatCurrency(p.min) + ' – ' + formatCurrency(p.max));
    p.suppliers.forEach(function(s) {
      // What the bank paid them, beside what the bills say (every line from them, not only this one).
      var bp = finSupplierPaid(s.name);
      h += row(escHtml(s.name), s.count + ' bill' + (s.count === 1 ? '' : 's') + ' · ' + escHtml(stockFmtQty(s.qty)) + ' ' + escHtml(unit) + ' · last ' + formatCurrency(s.last.e.price) +
        (bp ? ' · the bank paid them ' + formatCurrency(bp.paid) + ' in ' + bp.n + ' payment' + (bp.n === 1 ? '' : 's') + ', last ' + escHtml(stockShortDate(bp.last.date)) : ''), formatCurrency(gstRound(s.spent)));
    });
  } else {
    h += '<div class="inv-row inv-row-auto"><span class="inv-note">No price recorded. Add the bill for a delivery (on its entry below) or a past bill here.</span></div>';
  }
  // Who it is ordered from, the owner's pick or the app's, and the door to set its suppliers side by side (suppliers.js).
  var pk = suppReorderPick(item, suppDaysLeft(item));
  h += '<div class="inv-row inv-row-2 inv-row-flow" data-stock-order-from><span class="inv-row-main"><span class="inv-row-title">Order from</span><span class="inv-row-meta inv-row-wrap">' + escHtml(suppPickLine(pk)) + '</span></span>' +
    '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invSuppCompare" data-item="' + escHtml(item.id) + '">Compare suppliers</button></span></div>';
  if (p.lastBought) h += row('Bought', p.cadence != null ? 'every ' + formatNum(p.cadence, 0) + ' days (median) · ' + (p.avgQty != null ? 'about ' + escHtml(stockFmtQty(p.avgQty)) + ' ' + escHtml(unit) + ' a time' : '') : 'once on record',
    'last ' + escHtml(stockShortDate(p.lastBought)) + (p.nextDue ? ', next ~' + escHtml(stockShortDate(p.nextDue)) : ''));
  if (p.rate && p.rate.rate) h += row('Use', escHtml(stockFmtQty(p.used30)) + ' ' + escHtml(unit) + ' in the last 30 days', escHtml(stockFmtRate(p.rate.rate)) + ' ' + escHtml(unit) + '/day');
  if (p.costDay != null) h += row('Costs', 'at the last price', formatCurrency(p.costDay) + '/day · ' + formatCurrency(p.costMonth) + '/month');
  return h + '</div>';
}

/* ---------- Stock by line (PP3; owner, 9 Oct 2026: "Exactly", to reading the bath a stock line names) ----------
   What went into each plating line's bath against what the line plated: zinc and every chemical whose use names its bath (the
   supervisor's message, "use VAT A 2 / 25/09/26/ 150 kg", or Into on a use typed by hand), as so much a tonne plated and rupees a
   kilogram, at the price paid by the day (stockPriceAt). A use counts by the day it ends, as the live cost counts it; one naming
   no bath is the plant's, totalled apart and never placed. The kilograms are Production's (prodDayLine: every run weighed by the
   surest route).
   - What goes into a bath is a lump the bath draws on until the next of its kind (zinc anodes, a salt, a brightener), so each
     addition is set against what the line plated from it until the next of the same stock line into the same bath. The last is
     still in the bath and runs to today: it is said apart, "so far", and kept out of the line's figure unless it is the only one.
   - The working days the line has no record for are filled at the pace of those it has, said; under half recorded, the addition
     is not set against anything (one barrel day of fifteen had read 75 kg of zinc as 500 kg a tonne). Today, still running, is
     left out until it is recorded.
   - A use naming two baths is shared by what each plated over its days where each is recorded on half of them; else evenly. Both
     are estimates and say so.
   Worked out each time; nothing is stored but the entries' lines. */
var STOCK_LINE_DAYS = 60;
function stockByLine(from, to) {
  var st = stockData(), first = null, today = localDateStr();
  st.entries.forEach(function(e) { if (e.voided || !stockIsDraw(e)) return; var d = stockEntryWindow(e)[0]; if (!first || d < first) first = d; });
  var start = first && first > from ? first : from;
  var out = { from: from, to: to, start: start, recorded: !!first && first <= to, lines: {}, unnamed: { items: {}, n: 0 }, items: {} };
  // Each line's kilograms a day, read once for the call.
  var memo = {};
  var kgOn = function(l, d) {
    var k = l + '|' + d;
    if (!memo[k]) { var r = prodDayLine(d, l); memo[k] = { kg: r.kg, est: r.est, unweighed: r.unweighed, rec: r.entries.length > 0 }; }
    return memo[k];
  };
  // What a line plated over [a, b], with the share of the working days its record covers.
  var span = function(l, a, b) {
    var o = { kg: 0, est: 0, unweighed: 0, days: 0 };
    for (var d = a, g = 0; d <= b && g < 400; d = isoAddDays(d, 1), g++) { var x = kgOn(l, d); o.kg += x.kg; o.est += x.est; o.unweighed += x.unweighed; if (x.rec) o.days++; }
    var end = b === today && !kgOn(l, today).rec ? isoAddDays(b, -1) : b;
    o.work = end >= a ? statsWorkingDays(a, end) : 0;
    o.cover = o.work ? Math.min(1, o.days / o.work) : o.days ? 1 : 0;
    return o;
  };
  PROD_LINES.forEach(function(l) {
    var k = start <= to ? span(l, start, to) : { kg: 0, est: 0, unweighed: 0, days: 0, work: 0, cover: 0 };
    out.lines[l] = { line: l, kg: k.kg, est: k.est, unweighed: k.unweighed, days: k.days, of: k.work, share: k.cover, items: {}, adds: [] };
  });
  st.entries.forEach(function(e) {
    if (e.voided || !stockIsDraw(e) || e.date < from || e.date > to || !(e.qty > 0)) return;
    var it = stockItem(e.itemId);
    if (!it) return;
    var p = stockPriceAt(it.id, e.date), price = p && p.price > 0 ? p.price : null;
    var baths = stockEntryLines(e).filter(function(l) { return PROD_LINES.indexOf(l) >= 0; }), w = stockEntryWindow(e);
    var tot = out.items[it.id] || (out.items[it.id] = { item: it, qty: 0, named: 0 });
    tot.qty += e.qty;
    if (!baths.length) {
      var u = out.unnamed.items[it.id] || (out.unnamed.items[it.id] = { item: it, qty: 0, rs: 0, priced: true, ids: [] });
      u.qty += e.qty; u.ids.push(e.id);
      if (price != null) u.rs += e.qty * price; else u.priced = false;
      out.unnamed.n++;
      return;
    }
    tot.named += e.qty;
    var spans = baths.length > 1 ? baths.map(function(l) { return span(l, w[0], w[1]); }) : null;
    var byKg = spans && spans.every(function(k) { return k.cover >= 0.5; }) && spans.some(function(k) { return k.kg > 0; });
    var sum = byKg ? spans.reduce(function(t, k) { return t + k.kg; }, 0) : 0;
    baths.forEach(function(l, i) {
      var share = baths.length === 1 ? 1 : byKg ? spans[i].kg / sum : 1 / baths.length, q = e.qty * share, L = out.lines[l];
      var r = L.items[it.id] || (L.items[it.id] = { item: it, qty: 0, shared: 0, n: 0, priced: true });
      r.qty += q; r.n++;
      if (baths.length > 1) r.shared += q;
      if (price == null) r.priced = false;
      L.adds.push({ e: e, item: it, qty: q, rs: price != null ? q * price : null, with: baths.filter(function(x) { return x !== l; }),
        even: baths.length > 1 && !byKg, from: w[0], to: w[1] });
    });
  });
  // Each bath's additions of each stock line, against what the line plated over them (two starting on one day are one).
  PROD_LINES.forEach(function(l) {
    var L = out.lines[l];
    L.runs = {};
    L.rsKg = null; L.rsKgEst = false; L.unpriced = 0; L.soFar = 0;
    Object.keys(L.items).forEach(function(id) {
      var g = [];
      L.adds.filter(function(a) { return a.item.id === id; }).sort(function(a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : 1; }).forEach(function(a) {
        var last = g[g.length - 1];
        if (last && last.from === a.from) { last.qty += a.qty; last.list.push(a); if (a.to > last.to) last.to = a.to; last.rs = last.rs == null || a.rs == null ? null : last.rs + a.rs; }
        else g.push({ from: a.from, to: a.to, qty: a.qty, rs: a.rs, list: [a] });
      });
      var runs = L.runs[id] = g.map(function(x, i) {
        var next = g[i + 1], until = next ? isoAddDays(next.from, -1) : to;
        if (until < x.to) until = x.to;
        var k = span(l, x.from, until), ok = k.days > 0 && k.cover >= 0.5;
        var kgFull = ok ? k.kg / k.cover : null;
        return { from: x.from, to: x.to, until: until, open: !next, qty: x.qty, rs: x.rs, list: x.list, kg: k.kg, kgFull: kgFull, days: k.days, work: k.work, cover: k.cover,
          est: k.est > 0.0005 || k.cover < 0.999, unweighed: k.unweighed, perT: ok && kgFull > 0 ? x.qty / (kgFull / 1000) : null };
      });
      // The line's figure for the stock line: its additions set against what was plated over them, the one still in the bath apart.
      var r = L.items[id], closed = runs.filter(function(x) { return !x.open && x.perT != null; }), last = runs[runs.length - 1];
      var use = closed.length ? closed : last && last.open && last.perT != null ? [last] : [];
      var qty = use.reduce(function(t, x) { return t + x.qty; }, 0), kg = use.reduce(function(t, x) { return t + x.kgFull; }, 0);
      r.perT = use.length && kg > 0 ? qty / (kg / 1000) : null;
      r.soFar = !closed.length && use.length > 0;
      r.est = use.some(function(x) { return x.est; }); r.atMost = use.some(function(x) { return x.unweighed > 0; });
      r.on = use.length; r.withheld = runs.filter(function(x) { return x.perT == null; }).length;
      // Why there is no figure: the line not recorded on half the days, or recorded with nothing weighed.
      r.why = r.perT != null ? '' : runs.some(function(x) { return x.days > 0 && x.cover >= 0.5; }) ? 'no plating weighed' : 'too few days recorded';
      var rs = use.every(function(x) { return x.rs != null; }) ? use.reduce(function(t, x) { return t + x.rs; }, 0) : null;
      r.rs = runs.reduce(function(t, x) { return t + (x.rs || 0); }, 0);
      r.rsKg = rs != null && kg > 0 ? rs / kg : null;
      // The line's rupees a kilogram: each stock line's over the plating its additions met, only where one has been drawn on to the
      // next (a first addition still in the bath would read it high), the others counted apart.
      if (use.length && rs == null) L.unpriced++;
      if (r.soFar) L.soFar++;
      else if (r.rsKg != null) { L.rsKg = (L.rsKg || 0) + r.rsKg; if (r.est) L.rsKgEst = true; }
    });
  });
  return out;
}
/* A line's figure for a stock line a tonne plated, with its sign: ≤ where pieces nothing weighs leave the kilograms short (the
   most it can be), ≈ where a weight is estimated or a day not recorded was filled. Null where it is not set against anything. */
function stockPerTonneText(v, est, atMost) {
  return v == null ? null : (atMost ? '≤ ' : est ? '≈ ' : '') + stockFmtRate(v);
}
/* The uses of a stock line that go into a bath on a day, for Floor's card: those of one day on it, and a use over several days
   on the day it ends, with its days. */
function stockDayAdds(day, line) {
  var out = [];
  stockData().entries.forEach(function(e) {
    if (e.voided || !stockIsDraw(e) || e.date !== day || !(e.qty > 0)) return;
    var it = stockItem(e.itemId), baths = stockEntryLines(e);
    if (!it || baths.indexOf(line) < 0) return;
    var w = stockEntryWindow(e);
    out.push({ e: e, item: it, qty: e.qty, shared: baths.length > 1, with: baths.filter(function(x) { return x !== line; }), from: w[0] });
  });
  return out;
}

/* Two days as a span, the month once where they share it: "23 – 24 Sep", "28 Sep – 2 Oct". */
function stockSpanText(a, b) {
  if (!a || a === b) return stockShortDate(a || b);
  return a.slice(0, 7) === b.slice(0, 7) ? (+a.slice(8)) + ' – ' + stockShortDate(b) : stockShortDate(a) + ' – ' + stockShortDate(b);
}
/* By line, on a stock line's page (Stock → a line), drawn as an analysis (§6.27): a row a line with its figure a tonne plated, its
   rupees a kilogram and its additions folded under it, one a row; what named no bath, a row of its own. How it is worked out is
   the guide's (kbguides.js, "Reading the plant's figures"). */
function stockByLineHtml(item) {
  var to = localDateStr(), res = stockByLine(isoAddDays(to, -(STOCK_LINE_DAYS - 1)), to), unit = item.unit || '', tot = res.items[item.id];
  if (!tot) return '';
  var q = function(v) { return stockFmtQty(v) + (unit ? ' ' + unit : ''); };
  var per = function(txt) { return txt ? txt + ' ' + (unit || 'unit') + '/t' : ''; };
  var t = function(kg) { return formatNum(kg / 1000, kg < 10000 ? 2 : 1) + ' t'; };
  var h = '<div class="inv-panel inv-panel-flush" id="stockByLine"><div class="inv-panel-head"><span class="inv-panel-title">By line, ' + STOCK_LINE_DAYS + ' days</span></div>';
  if (!(tot.named > 0)) {
    // A line counted in pieces (gloves, a spray can) goes into no bath: nothing to say.
    if (/^nos$/i.test(unit)) return '';
    return h + '<div class="inv-row inv-row-auto" data-stock-unnamed><span class="inv-note">None of the ' + escHtml(q(tot.qty)) + ' used names its bath. ' +
      'Write the bath in the message (“use VAT A 2 / 150 kg”), or pick it under Into by hand, and it is set against the line.</span></div></div>';
  }
  PROD_LINES.forEach(function(l) {
    var L = res.lines[l], r = L.items[item.id];
    if (!r) return;
    var sign = r.atMost ? '≤ ' : r.est || r.soFar ? '≈ ' : '';
    var head = { label: prodLineName(l), src: r.soFar ? ['neutral', 'so far'] : null, value: per(stockPerTonneText(r.perT, r.est || r.soFar, r.atMost)), attrs: ' data-stock-line="' + l + '"',
      sub: r.perT == null ? r.why : [r.rsKg != null ? sign + '₹' + formatNum(r.rsKg, 2) + '/kg' : r.priced ? '' : 'no price', todoPlural(r.n, 'addition')].filter(Boolean).join(' · ') };
    var facts = (L.runs[item.id] || []).map(function(x) {
      var shared = x.list.some(function(a) { return a.with.length; });
      return { label: stockSpanText(x.from, x.to) + ' · ' + q(x.qty), src: shared ? ['neutral', 'shared'] : null, value: per(stockPerTonneText(x.perT, x.est, x.unweighed > 0)), attrs: ' data-stock-add="' + l + '"',
        sub: x.perT == null ? (x.days > 0 && x.cover >= 0.5 ? 'nothing weighed to ' + stockShortDate(x.until) : x.days + ' of ' + x.work + ' days recorded')
          : (x.est ? '≈ ' : '') + t(x.kgFull) + (x.open ? ' so far' : ' to ' + stockShortDate(x.until)) + (x.cover < 0.999 ? ' · ' + x.days + ' of ' + x.work + ' days' : '') };
    });
    h += uiFoldRowHtml('stock-line-' + item.id + '-' + l, head, facts);
  });
  var u = res.unnamed.items[item.id];
  if (u) {
    var checks = stockEntryChecks(item.id), held = u.ids.filter(function(id) { return checks[id] && checks[id].length; }).length;
    h += uiFactRowHtml({ label: 'No bath named', value: q(u.qty), sub: 'the plant’s' + (held ? ' · ' + held + ' on To check' : ''), attrs: ' data-stock-unnamed' });
  }
  return h + '<div class="inv-panel-body inv-note">Each addition against what its line plated until the next. ≈ an estimate, ≤ the most it can be.</div></div>';
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
/* A second electricity bill in one month is not a mistake (owner, 30 Sep 2026: it "only happens when a bit or all of a
   couple months ago was not paid in time, so it might include a penalty"). Such a bill carries the ARREARS of the month
   that went unpaid, already counted as that month's cost by its own bill, and a PENALTY that is this month's. So a bill
   records both (`arrears`, `penalty`, parts of `amount`), and the cost of a bill is its amount less the arrears: counting
   them again would charge the late month twice. The penalty stays in and is named, as is any standing charge the owner
   enters there (an excess-load charge while the connection still reads its old load). */
function costBillCost(b) { return gstRound((Number(b.amount) || 0) - (Number(b.arrears) || 0)); }
function costBillParts(b) {
  return [b.arrears > 0 ? 'arrears ' + formatCurrency(b.arrears) + (b.arrearsOf ? ' of ' + billsMonthLabel(b.arrearsOf) : '') + ', not counted again' : '',
    b.penalty > 0 ? 'penalty ' + formatCurrency(b.penalty) : ''].filter(Boolean);
}

/* The share of a month's bill that falls inside the range, by calendar days. */
function costMonthShare(month, from, to) {
  var start = month + '-01', end = payMonthEnd(start);
  var a = from > start ? from : start, b = to < end ? to : end;
  if (a > b) return 0;
  return (isoDaysBetween(a, b) + 1) / (isoDaysBetween(start, end) + 1);
}

/* Every row is MEASURED where the record exists and FILLED from its model rate
   where it does not, pro rata by the days (or, for labour, the working days)
   the record leaves out. The fill is a line of its own in the breakdown, and
   only the measured part counts towards "measured". Reading an unrecorded
   stretch as zero made the plant look cheapest exactly where least was known:
   a quarter with one power bill read as a quarter that used one month's power. */
/* Zinc from its bills: what was bought in the 90 days to `to`, per kg plated (weighed) over the same days. Null unless every
   zinc bill in the window is priced and something was plated: a gap is filled at the model, never read as cheap. */
function costZincByBills(to) {
  var it = stockData().items.find(function(i) { return i.key === 'ZINC'; });
  if (!it) return null;
  // The window starts no earlier than the first zinc bill on record: before it, nothing was entered, which is not nothing
  // bought (June read ₹0.93/kg over a window two-thirds before the bills began).
  var all = stockPurchases(it.id), first = all.reduce(function(m, b) { return !m || b.date < m ? b.date : m; }, '');
  var from = isoAddDays(to, -89);
  if (!first || first > to) return null;
  if (first > from) from = first;
  if (isoDaysBetween(from, to) + 1 < 28) return null;
  var qty = 0, amount = 0, bills = 0, unpriced = 0;
  all.forEach(function(b) {
    if (b.date < from || b.date > to) return;
    bills++; qty += b.e.qty || 0;
    if (b.e.price > 0) amount += b.e.price * (b.e.qty || 0); else unpriced++;
  });
  // A delivery with no price and no bill beside it (a pasted "add 495 kg" whose bill was never entered) is zinc bought at
  // an unknown price: the window would read cheap, so it is not read. One whose bill was entered as its own line (within a
  // week, the same quantity within 5%) is that bill.
  stockItemEntries(it.id).forEach(function(e) {
    if (e.kind !== 'received' || e.price != null || e.date < from || e.date > to) return;
    var billed = all.some(function(b) { return Math.abs(isoDaysBetween(b.date, e.date)) <= 7 && Math.abs((b.e.qty || 0) - e.qty) <= e.qty * 0.05; });
    if (!billed) unpriced++;
  });
  if (!bills || unpriced) return null;
  var w = weighLines(statsInvoices().filter(function(i) { return i.date >= from && i.date <= to; }));
  if (!(w.kg > 0)) return null;
  return { from: from, to: to, qty: qty, amount: amount, bills: bills, kg: w.kg, perKg: amount / w.kg };
}
function liveCost(from, to, kg) {
  var cfg = costModelCfg(), days = isoDaysBetween(from, to) + 1, rows = [];
  // What the bank paid, the second instrument (bank.js loads after this file; read at call time).
  var bk = bankData().rows.length ? bankCostForRange(from, to) : null;
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
  // The share of the row that is fixed (the monthly crew's days and rest days), for Stats' fixed and variable
  // (statsCostSplit): read from the instrument the figure comes from, and held over the stretch filled at the model.
  // Null where nothing recorded says.
  var labFixed = lab.total > 0 ? { share: lab.fixed / lab.total, from: 'attendance' } : null;
  // The order: attendance where 90% of the days are recorded; else what the bank paid, where the
  // statement covers more of the period than attendance does; else attendance and the model.
  if (labCov < 0.9 && bk && bk.labour.known > 0.001 && bk.labour.known >= labCov) {
    var bl = bk.labour, blMissing = Math.max(0, 1 - bl.known);
    // Paid: the salary transfers to named hands against the cash drawn for the weekly pool.
    var blNamed = 0, blCash = 0;
    bl.months.forEach(function(mo) { blNamed += mo.named * mo.share; blCash += mo.cash * mo.share; });
    if (blNamed + blCash > 0) labFixed = { share: blNamed / (blNamed + blCash), from: 'bank' };
    var blDetail = bl.months.map(function(mo) {
      return { label: 'Paid for ' + billsMonthLabel(mo.month), bank: true, amount: mo.amount,
        sub: [mo.named ? formatCurrency(mo.named) + ' to named hands, paid the month after' : '', mo.cash ? formatCurrency(mo.cash) + ' cash as wages, up to each week\'s payout' : '', mo.drawings >= 1 ? formatCurrency(mo.drawings) + ' cash past the payout: drawings, not counted' : '', mo.openCounted >= 1 ? formatCurrency(mo.openCounted) + ' cash in weeks whose payout is not recorded, counted as wages: an upper bound' : '', mo.share < 0.999 ? formatNum(mo.share * 100, 0) + '% of the month' : ''].filter(Boolean).join(' · ') || 'nothing paid' };
    });
    if (blMissing > 0.001) blDetail.push(fillLine(lm, blMissing, Math.round(blMissing * 100) + '% of the period the statement does not cover'));
    push({ key: 'labour', label: 'Labour', coverage: labCov, bankShare: bl.known, amount: bl.amount + (blMissing > 0.001 ? lm * kg * blMissing : 0),
      fixedShare: labFixed ? labFixed.share : null, fixedFrom: labFixed ? labFixed.from : null,
      note: 'paid, from the bank statement: ' + Math.round(bl.known * 100) + '% of the period · attendance covers ' + Math.round(labCov * 100) + '%', detail: blDetail });
  } else {
    if (labMissing > 0.001) labDetail.push(fillLine(lm, labMissing, Math.round(labMissing * 100) + '% of working days'));
    push({ key: 'labour', label: 'Labour', coverage: labCov, amount: lab.total + (labMissing > 0.001 ? lm * kg * labMissing : 0),
      fixedShare: labFixed ? labFixed.share : null, fixedFrom: labFixed ? labFixed.from : null,
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
  var bought = { zinc: { qty: 0, amount: 0, bills: 0, unpriced: 0 }, chem: { amount: 0, bills: 0 } };
  stockData().items.forEach(function(it) {
    stockPurchases(it.id).forEach(function(b) {
      if (b.date < from || b.date > to) return;
      var t = it.key === 'ZINC' ? bought.zinc : bought.chem;
      t.amount += (b.e.price || 0) * (b.e.qty || 0); t.bills++;
      if (it.key === 'ZINC') { t.qty += b.e.qty || 0; if (!(b.e.price > 0)) t.unpriced++; }
    });
  });
  var boughtLine = function(t, what) {
    // A purchase is stock on the shelf, not use, so it is not in the figure: the guide says so (kbguides.js, Reading Stats).
    return t.bills ? [{ label: 'Bought in the period, for reference', sub: t.bills + ' bill line' + (t.bills === 1 ? '' : 's') + (what ? ' · ' + what : ''), amount: t.amount, ref: true }] : [];
  };
  // How much of the period the stock record covers: from the first USE or CHARGE (its window's first day). Use is read
  // from nothing else, so a count or a delivery before it says nothing about what was used: one past purchase entered by
  // hand, dated 6 Jul, marked the whole quarter recorded and read its chemicals and zinc as ₹0 (the QA audit, 30 Sep 2026).
  var firstStock = null;
  stockData().entries.forEach(function(e) {
    if (e.voided || (e.kind !== 'used' && e.kind !== 'charged')) return;
    var d = /^\d{4}-\d{2}-\d{2}$/.test(e.from || '') && e.from < e.date ? e.from : e.date;
    if (!firstStock || d < firstStock) firstStock = d;
  });
  var coveredDays = !firstStock || firstStock > to ? 0 : firstStock <= from ? days : isoDaysBetween(firstStock, to) + 1;
  var stockMissing = 1 - coveredDays / days;
  var stockWhat = coveredDays ? (days - coveredDays) + ' of ' + days + ' days before the stock record starts (' + stockShortDate(firstStock) + ')' : 'no stock record in this period';

  var chemModel = stockCfg().chemModel;
  var chemDetail = chem.detail.sort(function(a, b) { return b.amount - a.amount; }).concat(chem.unpriced);
  // Zinc's rule for chemicals: a period with nothing drawn in it, or drawn only from lines with no price, measured
  // nothing, and is filled whole at the model; it read ₹0 as "model" (August on the real book).
  var chemMeasured = chem.detail.some(function(d) { return d.amount > 0; });
  var chemMissing = chemMeasured ? stockMissing : 1;
  var chemWhat = chemMeasured || !coveredDays ? stockWhat : 'no chemical used in this period';
  if (chemMissing > 0.001) chemDetail.push(fillLine(chemModel, chemMissing, chemWhat));
  var chemLines = chem.detail.length + chem.unpriced.length;
  push({ key: 'chem', label: 'Chemicals', amount: chem.amount + (chemMissing > 0.001 ? chemModel * kg * chemMissing : 0), low: chem.unpriced.length > 0,
    note: (chemMeasured || (chemLines && !coveredDays) ? chem.detail.length + ' of ' + chemLines + ' lines used are priced' + (chem.unpriced.length ? ', so the measured part reads low' : '')
      : coveredDays ? 'no chemical used in this period' : 'no chemical use recorded') +
      (chemMeasured ? (chemMissing > 0.001 && coveredDays ? ' · ' + (days - coveredDays) + ' days at the model' : '') : coveredDays ? ' · filled at the model' : ''),
    detail: chemDetail.concat(boughtLine(bought.chem)).concat(bk && bk.supplies.months.length ? [{ label: 'Paid to suppliers, for reference', ref: true, amount: bk.supplies.amount,
      sub: 'chemicals and zinc, from the bank · ' + Math.round(bk.supplies.known * 100) + '% of the period on the statement' }] : []) });

  var landed = zincLandedRate();
  // Modelled zinc kilos are priced at what was last PAID by the end of the
  // period, and only failing that at today's market rate.
  var zincItem = stockData().items.find(function(i) { return i.key === 'ZINC'; });
  var zincPaid = zincItem ? stockPriceAt(zincItem.id, to) : null;
  if (zincPaid && zincPaid.date > to) zincPaid = null;
  var zp = zincPaid ? zincPaid.price : landed;
  var zDetail = [], zAmount = 0, zMeasured = 0, zRate = false;
  // The share of the period zinc's own record does not speak for. A period with no zinc charged in it is not a
  // period that used none: it read ₹0 as "nothing recorded" (and said no rate was set when one was), and a charge
  // with no bill and no market rate read ₹0 as "market rate". Both are unrecorded, and filled at the model.
  // Zinc goes into the bath as it arrives: the 24 Sep delivery of 495 kg was charged within four days (the owner's book,
  // 6 Oct 2026). So a charge record that starts partway through a month is a lump, and filling the days before it at the
  // model counts the month twice (September read ₹3.94/kg). Over a month or more, where the charge record does not cover the
  // whole period and every zinc bill in it is priced, the period's zinc bills stand for its use (intelligence step I2).
  // A month's bills are lumpy too (a delivery late in June is July's zinc), so they are read over the 90 days to the
  // period's end, per kg plated over the same days, and set against the period's tonnage (costZincByBills).
  var zWin = days >= 28 && (stockMissing > 0.001 || !(zinc.qty > 0)) ? costZincByBills(to) : null;
  var zByBills = !!zWin;
  var zNoPrice = zinc.qty > 0 && !zinc.priced && !landed;
  var zMissing = zinc.qty > 0 && !zNoPrice ? stockMissing : 1, zWhat = zinc.qty > 0 ? stockWhat : coveredDays ? 'no zinc charged in this period' : 'zinc use';
  if (zByBills) {
    var zbAmt = zWin.perKg * kg;
    // One line each (the tab map, TM2b); why zinc's bills are its use is the guide's (kbguides.js, Reading Stats).
    zDetail.push({ label: 'Bought over 90 days, per kg plated', amount: zbAmt,
      sub: stockFmtQty(zWin.qty) + ' kg on ' + zWin.bills + ' bill line' + (zWin.bills === 1 ? '' : 's') + ', ' + formatCurrency(zWin.amount) + ', ' + stockShortDate(zWin.from) + ' – ' + stockShortDate(zWin.to) +
        ' over ' + formatNum(zWin.kg / 1000, 1) + ' t = ' + formatCurrency(zWin.perKg) + '/kg' });
    if (zinc.qty > 0) zDetail.push({ label: 'Charged since the record began', sub: stockFmtQty(zinc.qty) + ' kg from ' + stockShortDate(firstStock) + ', in the bills above', amount: null, ref: true });
    zAmount = zbAmt; zMeasured = zbAmt; zMissing = 0;
  } else if (zinc.qty > 0 && !zNoPrice) {
    var zAmt = zinc.priced ? zinc.amount : zinc.qty * landed;
    zDetail.push({ label: 'Charged', sub: stockFmtQty(zinc.qty) + ' kg' + (zinc.priced ? ' at the price paid' : ' × the market rate ' + formatCurrency(landed) + ' (no bill yet)'), amount: zAmt });
    zAmount += zAmt; zMeasured += zinc.priced ? zAmt : 0;
    zRate = !zinc.priced;
  } else if (zNoPrice) {
    // Kilos with no price of any kind: shown, and the whole period filled at the model below.
    zDetail.push({ label: 'Charged, no price', sub: stockFmtQty(zinc.qty) + ' kg · no zinc bill and no market rate, so the period is filled at the model', amount: null, ref: true });
    zWhat = stockFmtQty(zinc.qty) + ' kg charged with no price';
  }
  if (zMissing > 0.001 && zp) {
    var missDays = days * zMissing, zkg = cfg.zincKgMonth * missDays / 30;
    zDetail.push({ label: 'Not recorded: ' + zWhat, sub: formatNum(zkg, 0) + ' kg (' + cfg.zincKgMonth + ' kg/month) × ' + formatCurrency(zp) + (zincPaid ? ' last paid, ' + stockShortDate(zincPaid.date) : ' market rate'), amount: zkg * zp, fill: true });
    zAmount += zkg * zp;
  } else if (zMissing > 0.001) {
    // No zinc price of any kind: the cost model's ₹/kg, never nothing.
    zDetail.push(fillLine(cfg.zincPerKg, zMissing, zWhat + (zinc.qty > 0 ? '' : ', and no zinc rate set')));
    zAmount += cfg.zincPerKg * kg * zMissing;
  }
  push({ key: 'zinc', label: 'Zinc', amount: zAmount, measuredOverride: zMeasured, source: zRate && zDetail.length === 1 ? 'rate' : null,
    note: zByBills ? 'its bills over the 90 days to ' + stockShortDate(to) + ', ' + formatCurrency(zWin.perKg) + ' per kg plated'
      : (zinc.qty > 0 ? stockFmtQty(zinc.qty) + ' kg charged' + (zNoPrice ? ', no price' : '') : coveredDays ? 'no zinc charged in this period' : 'use not recorded') +
      (zinc.qty > 0 && !zNoPrice ? (zMissing > 0.001 ? ' · ' + (days - coveredDays) + ' days at the model' : '') : ' · filled at the model'),
    detail: zByBills ? zDetail : zDetail.concat(boughtLine(bought.zinc, stockFmtQty(bought.zinc.qty) + ' kg')) });

  // Power and other: each month's bill for its share of the period; a month
  // with no bill at the model rate, for its share of the tonnage.
  var months = [], m = from.slice(0, 7);
  for (var g = 0; m <= to.slice(0, 7) && g < 240; g++) { months.push(m); m = bankNextMonth(m); }
  ['power', 'other'].forEach(function(kind) {
    var bills = costBills().filter(function(b) { return b.kind === kind && !b.voided; });
    var amt = 0, detail = [], unbilled = 0, unbilledMonths = [];
    months.forEach(function(mo) {
      var start = mo + '-01', end = payMonthEnd(start);
      var a = from > start ? from : start, z = to < end ? to : end;
      var rangeShare = (isoDaysBetween(a, z) + 1) / days;
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
        var cost = costBillCost(b);
        amt += cost * share;
        detail.push({ label: (b.label || COST_BILL_KINDS[kind]) + ' · ' + b.month, sub: formatCurrency(cost) + (share < 0.999 ? ' × ' + formatNum(share * 100, 0) + '% of the month' : '') + (b.units ? ' · ' + b.units + ' units' : '') +
          costBillParts(b).map(function(x) { return ' · ' + x; }).join('') + (b.note ? ' · ' + b.note : ''), amount: cost * share });
      });
    });
    if (unbilled > 0.001) detail.push(fillLine(cfg[kind], unbilled, 'no bill for ' + unbilledMonths.join(', ')));
    if (kind === 'other' && bk && bk.unsorted.amount >= 1) {
      var np = Object.keys(bk.unsorted.payees).length;
      detail.push({ label: 'Paid to payees not yet sorted, not counted', ref: true, amount: bk.unsorted.amount,
        sub: np + ' payee' + (np === 1 ? '' : 's') + ' not sorted on the statement · Money → Payments' });
    }
    push({ key: kind, label: COST_BILL_KINDS[kind], amount: amt + (unbilled > 0.001 ? cfg[kind] * kg * unbilled : 0),
      note: (function() {
        var nb = detail.filter(function(x) { return !x.fill && !x.bank && !x.ref; }).length, np = detail.filter(function(x) { return x.bank; }).length;
        var parts = [nb ? nb + ' bill' + (nb === 1 ? '' : 's') : '', np ? np + ' month' + (np === 1 ? '' : 's') + ' paid, from the bank' : '',
          unbilledMonths.length && (nb || np) ? unbilledMonths.length + ' month' + (unbilledMonths.length === 1 ? '' : 's') + ' at the model' : ''].filter(Boolean);
        // Two facts at most (§3b-11): a month at the model is said by its own row in the fold.
        return parts.length ? parts.slice(0, 2).join(' · ') : formatCurrency(cfg[kind]) + '/kg from Settings; no bill entered for this period';
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
  if (!bankData().rows.length) return [];
  var bk = bankCostForRange(from, to), out = [];
  var span = function(ym) { var s = ym + '-01', e = payMonthEnd(s); return [from > s ? from : s, to < e ? to : e]; };
  // A month dropped because payees are not yet sorted says so, and where to sort them: read as "nothing paid" it hid
  // lakhs a month paid to suppliers.
  var unsortedIn = function(key) {
    return ((bk[key] && bk[key].unknown) || []).filter(function(u) { return u.why === BANK_UNSORTED_WHY; }).map(function(u) { return billsMonthLabel(u.month); });
  };
  var finish = function(key, label, t, why, known) {
    var r = { key: key, label: label, months: t.months, skipped: t.skipped, recorded: null, paid: null, delta: null, pct: null, flag: false, why: why };
    var uns = unsortedIn(key);
    // The months left out, each with why, for the row's line (the note keeps the whole sentence).
    r.leftOut = [t.skipped.length ? 'not ' + t.skipped.map(billsMonthLabel).join(', ') + ' (' + known + ')' : '',
      uns.length ? 'not ' + uns.join(', ') + ' (' + BANK_UNSORTED_WHY + ')' : ''].filter(Boolean);
    if (key === 'supplies' && t.paid < 1 && t.recorded < 1) {
      r.note = uns.length ? 'nothing to compare: ' + BANK_UNSORTED_WHY + ' for ' + uns.join(', ') : 'no priced use and no supplier payment in the months the statement covers';
      out.push(r); return;
    }
    if (t.months.length) {
      r.recorded = gstRound(t.recorded); r.paid = gstRound(t.paid); r.delta = gstRound(t.paid - t.recorded);
      r.pct = t.recorded > 0 ? r.delta / t.recorded : null;
      r.flag = key !== 'supplies' && (r.pct == null ? r.paid > 0 : Math.abs(r.pct) > COST_GAP);
    }
    r.note = t.months.length ? 'over ' + t.months.map(billsMonthLabel).join(', ') + (t.skipped.length ? ' · not ' + t.skipped.map(billsMonthLabel).join(', ') + ': ' + known : '') +
        (uns.length ? ' · not ' + uns.join(', ') + ': ' + BANK_UNSORTED_WHY : '') + ' · ' + why
      : t.skipped.length || uns.length ? 'nothing to compare: ' + [t.skipped.length ? known + ' for ' + t.skipped.map(billsMonthLabel).join(', ') : '',
        uns.length ? BANK_UNSORTED_WHY + ' for ' + uns.join(', ') : ''].filter(Boolean).join('; ') : 'nothing paid on the statement for this period';
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
      t.recorded += bills.reduce(function(s, b) { return s + costBillCost(b); }, 0) * mo.share; t.paid += mo.amount; t.months.push(mo.month);
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
  // Fact rows (§3c): the gap at the end, recorded and paid under the label, a gap over 10% a badge in its tone (the tab map, TM2b).
  return '<div id="liveCostPaid"><div class="inv-row-group"><span>Recorded against paid</span></div>' + chk.map(function(r) {
    var fig = r.recorded == null ? '' : (r.delta >= 0 ? '+' : '−') + formatCurrency(Math.abs(r.delta)) +
      (r.pct != null ? ' (' + (r.pct >= 0 ? '+' : '−') + formatNum(Math.abs(r.pct) * 100, 0) + '%)' : '');
    // The months compared lead (numerator and denominator, the same months), then what is left out and why; why the two can
    // differ and still be right is the screen's guide.
    return uiFactRowHtml({ label: r.label, value: fig, src: r.flag ? ['danger', 'over 10% apart'] : null, attrs: ' data-paid="' + escHtml(r.key) + '"',
      sub: r.recorded == null ? r.note : r.months.map(billsMonthLabel).join(', ') + ': recorded ' + formatCurrency(r.recorded) + ', paid ' + formatCurrency(r.paid) +
        (r.leftOut || []).map(function(x) { return '; ' + x; }).join('') });
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
  if (!bankData().rows.length) return { none: 'No bank statement imported: Finance → Bank → Import.' };
  var bm = bankCostByMonth(), active = (S.invoices || []).filter(function(i) { return i.status === 'active' && i.date; });
  var months = [], ym = localDateStr().slice(0, 7);
  for (var k = 0; k < 6; k++) { ym = bankPrevMonth(ym + '-01'); months.unshift(ym); }
  var res = {};
  keys.forEach(function(key) {
    var rows = [], paid = 0, kg = 0;
    months.forEach(function(m) {
      var why = bankMonthUnknown(bm, m, key);
      if (why) { rows.push({ month: m, skip: why }); return; }
      var e = bm.months[m], p = gstRound(e ? e[key].amount : 0), s = m + '-01';
      var w = weighLines(active.filter(function(i) { return i.date >= s && i.date <= payMonthEnd(s); })).kg;
      if (!(w > 0)) { rows.push({ month: m, skip: 'no tonnage invoiced' }); return; }
      rows.push({ month: m, paid: p, kg: w, perKg: p / w });
      paid += p; kg += w;
    });
    res[key] = { rows: rows, paid: paid, kg: kg, perKg: kg > 0 ? gstRound(paid / kg) : null };
  });
  return res;
}
/* The working drawn into a neutral callout in Settings: a row per month (the month, then paid ÷ tonnage in
   mono), and what it offers with its Use button. */
function _costDerivedHtml(res) {
  if (res.none) return '<p class="inv-note">' + escHtml(res.none) + '</p>';
  var set = { labour: labourCfg().modelPerKg, power: costModelCfg().power, other: costModelCfg().other };
  return Object.keys(res).map(function(key) {
    var d = res[key], f = COST_DERIVE_FIELDS[key];
    var h = '<div data-derive="' + key + '"><div class="inv-row-group">' + escHtml(f[1]) + '</div>' + d.rows.map(function(r) {
      return '<div class="inv-row inv-row-auto"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(billsMonthLabel(r.month)) + '</span>' +
        '<span class="inv-row-meta inv-row-wrap' + (r.skip ? '' : ' inv-id') + '">' + (r.skip ? escHtml(r.skip)
        : formatCurrency(r.paid) + ' &divide; ' + formatNum(r.kg / 1000, 1) + ' t = ' + formatCurrency(r.perKg) + '/kg') + '</span></span></div>';
    }).join('') + '</div>';
    if (d.perKg == null) {
      // Why nothing is offered: a month left out for unsorted payees (or a salary run not on the statement yet) is not a
      // month with no tonnage beside it.
      var whys = [], by = {};
      d.rows.forEach(function(r) { if (!r.skip) return; if (!by[r.skip]) { by[r.skip] = []; whys.push(r.skip); } by[r.skip].push(billsMonthLabel(r.month)); });
      var plain = whys.every(function(w) { return w === 'no tonnage invoiced' || w === 'not on the statement'; });
      return h + '<p class="inv-note inv-mt-4">' + (plain ? 'No month the statement covers has tonnage beside it, so nothing to offer.'
        : escHtml('Nothing to offer: ' + whys.map(function(w) { return w + ' for ' + by[w].join(', '); }).join('; ') + '.')) + '</p>';
    }
    var n = d.rows.filter(function(r) { return !r.skip; }).length;
    return h + '<div class="inv-toolbar inv-toolbar-flush inv-mt-8"><span class="inv-row-main">' + n + ' month' + (n === 1 ? '' : 's') + ': ' + formatCurrency(d.paid) + ' &divide; ' + formatNum(d.kg / 1000, 1) + ' t = <strong class="inv-id">' +
      formatCurrency(d.perKg) + '/kg</strong> against ' + formatCurrency(set[key] || 0) + ' set</span>' +
      '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCostUseDerived" data-field="' + f[0] + '" data-val="' + d.perKg + '">Use ' + formatCurrency(d.perKg) + '</button></div>';
  }).join('') + (res.labour ? '<p class="inv-note inv-mt-8">Paid covers every wage leg on the statement: salaries for the month before, and cash by pay week, the EXTRA pool with it.</p>' : '');
}
function costUseDerived(field, val) {
  var el = document.getElementById(field);
  if (!el) return;
  el.value = val;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

var COST_SRC_LABEL = { measured: 'measured', bank: 'paid, bank', partial: 'part-recorded', rate: 'market rate', model: 'model' };
var _costBillOpen = false;

/* A component's source, as a badge (§6.13): the tone says how far the figure can be trusted. */
var COST_SRC_TONE = { measured: 'ok', bank: 'ok', partial: 'warning', rate: 'info', model: 'neutral' };
function costSrcBadge(src) {
  return '<span class="inv-badge inv-badge-' + (COST_SRC_TONE[src] || 'neutral') + '" data-src="' + src + '">' + COST_SRC_LABEL[src] + '</span>';
}

function renderLiveCostCard(period, tonnage) {
  var range = periodRange(period, 0);
  var iso = function(ts) { var d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var from = range ? iso(range.start) : ((S.invoices || []).map(function(i) { return i.date; }).filter(Boolean).sort()[0] || localDateStr());
  var to = range ? iso(range.end) : localDateStr();
  var kg = tonnage ? tonnage.kg : 0;
  var c = liveCost(from, to, kg);
  var money = function(v) { return '<span class="inv-row-stack"><span class="inv-num">' + (v.perKg != null ? formatCurrency(v.perKg) + '<span class="inv-unit">/kg</span>' : '&mdash;') +
    '</span><span class="inv-row-meta inv-num">' + formatCurrency(v.amount != null ? v.amount : v.total) + '</span></span>'; };
  var h = '<div class="inv-panel inv-panel-flush inv-panels-wide" id="liveCost" data-card="livecost"><div class="inv-panel-head"><span class="inv-panel-title">' +
    escHtml(PERIOD_LABELS[period] || '') + ' live cost <span class="inv-note">every figure with where it came from</span></span></div>';
  h += '<div class="inv-row inv-row-2 inv-row-strong" data-cost-total><span class="inv-row-main"><span class="inv-row-title">Full cost</span><span class="inv-row-meta">' +
    formatNum(kg / 1000, 1) + ' t plated · ' + Math.round(c.measuredShare * 100) + '% of it measured</span></span><span class="inv-row-end">' + money(c) + '</span></div>';
  var partial = c.rows.filter(function(r) { return r.source === 'partial'; }).map(function(r) { return r.label.toLowerCase(); });
  if (partial.length) h += '<div class="inv-panel-body"><div class="inv-callout inv-callout-danger">This period reads LOW: ' + escHtml(partial.join(' and ')) + (partial.length === 1 ? ' is' : ' are') + ' only part-recorded. Open a line to see what is missing.</div></div>';
  // The ₹/kg divides by the weighed tonnage alone, and says so in a line (statsCostWeighedShort, stats.js); why is the guide's.
  var weighed = statsCostWeighedShort(tonnage);
  if (weighed) h += '<div class="inv-panel-body"><div class="inv-note" data-callout="weighed">' + weighed + '</div></div>';
  // Each component folds open to its parts: labour by tier, chemicals line by line, each bill's share.
  c.rows.forEach(function(r) {
    h += '<details class="inv-row-fold" data-cost="' + r.key + '"><summary class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(r.label) +
      ' ' + costSrcBadge(r.source) + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(r.note) + '</span></span>' +
      '<span class="inv-row-end">' + money(r) + '</span></summary>';
    if (r.detail.length) {
      h += '<div class="inv-row-children">' + r.detail.map(function(d) {
        return '<div class="inv-row' + (d.sub ? ' inv-row-2' : '') + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(d.label) + '</span>' +
          (d.sub ? '<span class="inv-row-meta inv-row-wrap">' + escHtml(d.sub) + '</span>' : '') + '</span>' +
          '<span class="inv-row-end"><span class="inv-num">' + (d.amount != null ? formatCurrency(gstRound(d.amount)) : '&mdash;') + '</span></span></div>';
      }).join('') + '</div>';
    }
    h += '</details>';
  });
  h += _costPaidHtml(from, to);
  // The typed figure beside the measured one, as a fact; what "model" means is the guide's (kbguides.js, Reading Stats).
  var typed = S.defaultCostPerKg || 0;
  if (typed && c.perKg != null) h += uiFactRowHtml({ label: 'Typed in Settings', sub: 'this period measures ' + formatCurrency(c.perKg) + '/kg', value: formatCurrency(typed) + '/kg', attrs: ' data-cost-typed' });
  h += _costBillHtml();
  return h + '</div>';
}

/* The bills are entered on Money → Payments, where they are kept with their notes (the tab map, TM3a: the list here repeated it);
   the card's electricity and other rows fold open to each bill's share of the period, which is the cost's own working. */
function _costBillHtml() {
  return '<div class="inv-row" data-cost-bills><span class="inv-row-main"><span class="inv-row-meta">Bills are entered in Money &rarr; Payments</span></span>' +
    '<span class="inv-row-end"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invCostBillGo">Add a bill</button></span></div>';
}

/* The bill form, on Money → Payments (opened there, and from Add, the To-do, Power and Live cost through todoGo). */
function costBillFormHtml() {
  var o = _costBillOpen || {}, m = o.month || localDateStr().slice(0, 7);
  return '<div class="inv-fields">' +
    '<label class="inv-field"><span class="inv-field-label">Kind</span><select class="inv-select" id="costBillKind">' +
    '<option value="power">Electricity</option><option value="other"' + (o.kind === 'other' ? ' selected' : '') + '>Consumables, ETP, maintenance</option></select></label>' +
    '<label class="inv-field"><span class="inv-field-label">Month it covers</span><input class="inv-input" id="costBillMonth" type="month" value="' + escHtml(m) + '"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Amount, before GST</span><input class="inv-input inv-input-num" id="costBillAmount" type="number" step="0.01" min="0" inputmode="decimal"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Units (electricity)</span><input class="inv-input inv-input-num" id="costBillUnits" type="number" step="1" min="0" inputmode="numeric"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Arrears in it, of an earlier month</span><input class="inv-input inv-input-num" id="costBillArrears" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Month the arrears are for</span><input class="inv-input" id="costBillArrearsOf" type="month"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Penalty or extra charge in it</span><input class="inv-input inv-input-num" id="costBillPenalty" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0"></label>' +
    '<label class="inv-field inv-kv-wide"><span class="inv-field-label">Note</span><input class="inv-input" id="costBillNote" placeholder="e.g. JBVNL bill, ETP sludge"></label></div>' +
    (o.saved ? '<div class="inv-note">' + o.saved + (o.saved === 1 ? ' bill' : ' bills') + ' saved from this form. The next month is filled in.</div>' : '') +
    '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCostBillCancel">' + (o.saved ? 'Close' : 'Cancel') + '</button>' +
    '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invCostBillSave">Save bill</button></div>';
}
function costBillRedraw() { renderFinance(); }
/* The page the form sits on: every lookup is scoped to it, since a hidden page stays in the DOM. */
function costBillRoot() { return document.getElementById('pageFinance') || document; }

async function costBillSave() {
  var root = costBillRoot();
  var v = function(id) { return ((root.querySelector('#' + id) || {}).value || '').trim(); };
  var kind = v('costBillKind') === 'other' ? 'other' : 'power', month = v('costBillMonth'), amount = gstRound(parseFloat(v('costBillAmount')) || 0);
  if (!/^\d{4}-\d{2}$/.test(month)) { showToast('Pick the month the bill covers', 'error'); return; }
  if (!(amount > 0)) { showToast('Enter the amount', 'error'); return; }
  var units = parseFloat(v('costBillUnits'));
  var arrears = gstRound(parseFloat(v('costBillArrears')) || 0), penalty = gstRound(parseFloat(v('costBillPenalty')) || 0), arrearsOf = v('costBillArrearsOf');
  if (arrears < 0 || penalty < 0 || gstRound(arrears + penalty) > amount) { showToast('Arrears and penalty are parts of the bill: together they cannot be more than its amount', 'error'); return; }
  if (arrearsOf && !/^\d{4}-\d{2}$/.test(arrearsOf)) arrearsOf = '';
  if (arrearsOf && arrearsOf >= month) { showToast('Arrears are for a month before the one the bill covers', 'error'); return; }
  // A second electricity bill for the month is asked about, never refused: it is usually arrears and a penalty.
  var twin = kind === 'power' && costBills().find(function(b) { return b.kind === 'power' && !b.voided && b.month === month; });
  if (twin && !(arrears > 0)) {
    var ok = await uiConfirm({ title: 'A second electricity bill for ' + billsMonthLabel(month) + '?',
      body: 'There is already one for ' + formatCurrency(twin.amount) + '. A second bill in a month usually carries the arrears of an earlier month that was not paid in time, and a penalty. Enter the arrears so they are not counted twice; with none entered, all of this bill counts as ' + billsMonthLabel(month) + '’s cost.',
      okLabel: 'Save as it is' });
    if (!ok) return;
  }
  costBills().push({ id: 'CB-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: kind, month: month, amount: amount,
    units: units > 0 ? units : null, arrears: arrears > 0 ? arrears : null, arrearsOf: arrears > 0 && arrearsOf ? arrearsOf : null,
    penalty: penalty > 0 ? penalty : null, note: v('costBillNote'), at: Date.now() });
  // The form stays open for the next bill (bills are back-filled a month at a time): the same kind, the next month with
  // no bill of that kind, the figures cleared.
  var was = _costBillOpen || {}, next = month;
  for (var i = 0; i < 24; i++) {
    next = isoAddDays(next + '-01', 32).slice(0, 7);
    var nk = next;
    if (!costBills().some(function(b) { return b.kind === kind && !b.voided && b.month === nk; })) break;
  }
  _costBillOpen = { where: 'finance', month: next, kind: kind, saved: (was.saved || 0) + 1 };
  saveState();
  costBillRedraw();
  showToast(COST_BILL_KINDS[kind] + ' bill saved for ' + month);
}
async function costBillVoid(id) {
  var b = costBills().find(function(x) { return x.id === id; });
  if (!b || b.voided) return;
  if (!grdOk('voids') && !(await guardAsk('voids', 'void a bill'))) return;   // P1 (guard.js)
  var reason = await uiPrompt({ title: 'Void this bill', body: 'It is kept on the record, not deleted.', label: 'Why is this bill void?',
    okLabel: 'Void bill', required: true, requiredText: 'A void needs a reason.' });
  if (reason == null) return;
  if (!reason.trim()) { showToast('A void needs a reason', 'error'); return; }
  if (b.voided) return;
  b.voided = Date.now();
  b.voidReason = reason.trim();
  saveState();
  costBillRedraw();
}
function costAction(action, btn) {
  switch (action) {
    case 'invCostBillOpen': {
      _costBillOpen = { where: 'finance', month: btn.dataset.month || '' };
      costBillRedraw();
      var a = costBillRoot().querySelector('#costBillAmount'); if (a) a.focus();
      return true;
    }
    case 'invCostBillCancel': _costBillOpen = false; costBillRedraw(); return true;
    case 'invCostBillSave': costBillSave(); return true;
    case 'invCostBillVoid': costBillVoid(btn.dataset.id); return true;
    // Live cost's link: the form on Payments, on the latest closed month with no electricity bill (add.js).
    case 'invCostBillGo': addBill(); return true;
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
    // Who it is ordered from and by when (suppliers.js): the owner's pick or the app's, at the supplier's own lead time where set,
    // else the list's.
    var pick = suppReorderPick(it, suppDaysLeft(it, st));
    if (!rate) {
      if (st.level != null && st.level <= 0 || typed) rows.push({ item: it, need: null, suggest: null, pack: stockPackSize(it), level: level, rate: null, noRate: true, pick: pick });
      else skipped.norate.push(it.name);
      return;
    }
    var lead = pick && pick.lead ? pick.lead.max : cfg.leadDays;
    var need = rate * (lead + cfg.coverDays) - level;
    var pack = stockPackSize(it);
    var suggest = need > 0 ? (pack ? Math.ceil(need / pack) * pack : Math.ceil(need)) : 0;
    if (suggest <= 0 && !typed) { skipped.enough++; return; }
    rows.push({ item: it, need: need, suggest: suggest, pack: pack, level: level, rate: rate, daysLeft: st.daysLeft, tentative: !!(st.rate && st.rate.tentative), pick: pick, lead: lead });
  });
  rows.forEach(function(r) {
    var typed = _stockReorder && _stockReorder.qty[r.item.id];
    r.qty = typed != null && typed !== '' ? Math.max(0, parseFloat(typed) || 0) : (r.suggest || 0);
    var lp = stockPriceAt(r.item.id, '9999-12-31');
    // At the price of the supplier it is ordered from: the last it came from, or the cheaper one that can deliver in time.
    r.price = r.pick ? r.pick.price : lp ? lp.price : null;
    r.supplier = r.pick && r.pick.sp ? r.pick.name : lp && lp.supplier ? lp.supplier : 'No supplier on record';
    r.lastFrom = r.pick && r.pick.last ? r.pick.last.name : r.supplier;
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
/* The reorder list (§7 Stock): grouped by the supplier each line last came from, the order
   quantity typed in place. A table on the desktop, rows on the phone; one set of inputs either way. */
function renderStockReorder() {
  var L = stockReorderList(), cfg = L.cfg;
  var h = stockBackBar('Stock', 'Reorder list');
  // Not a form: lead and cover save as they change, and a typed quantity is a working figure for the message copied
  // from it (the list starts afresh each time it opens). Leaving asks nothing.
  h += '<div class="inv-panel" data-nodirty><div class="inv-fields">' +
    '<div class="inv-field"><label class="inv-field-label" for="stockLeadDays">Lead time where a supplier’s is not set (days)</label>' +
    '<input type="number" min="1" step="1" inputmode="numeric" id="stockLeadDays" class="inv-input inv-input-num" value="' + cfg.leadDays + '"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="stockCoverDays">Days to cover after it lands</label>' +
    '<input type="number" min="1" step="1" inputmode="numeric" id="stockCoverDays" class="inv-input inv-input-num" value="' + cfg.coverDays + '"></div></div>' +
    '<div class="inv-note">Suggested = daily use × (lead time + ' + cfg.coverDays + ' days) less what is on the shelf, rounded up to the pack it is bought in. The lead time is the supplier’s where it is set on them (Money → Payments → Suppliers), else these ' + cfg.leadDays + ' days. Type a quantity to change it; 0 leaves the line out.</div></div>';
  if (!L.groups.length) {
    h += '<div class="inv-panel"><div class="inv-empty">Nothing to order: every line with a daily use covers ' + (cfg.leadDays + cfg.coverDays) + ' days.</div></div>';
  } else {
    h += '<div class="inv-panel inv-panel-flush" id="stockReorder" data-nodirty>' + (_isDesktop ? stockReorderTableHtml(L) : stockReorderRowsHtml(L)) + '</div>';
  }
  if (L.skipped.enough || L.skipped.norate.length) {
    h += '<div class="inv-note inv-mb-8">' + (L.skipped.enough ? L.skipped.enough + ' line' + (L.skipped.enough === 1 ? ' has' : 's have') + ' enough on hand. ' : '') +
      (L.skipped.norate.length ? 'No daily use yet, so nothing suggested: ' + escHtml(L.skipped.norate.join(', ')) + '.' : '') + '</div>';
  }
  if (L.groups.length) {
    // The cash it needs, against the forecast: an order is a payment in a few weeks.
    // The forecast is the bank's: shown to a role that may read money (finlinks.js finSeen).
    var fc = finSeen() ? finForecast(45) : null;
    if (fc && L.total > 0) {
      var after = gstRound(fc.min.bal - L.total * 1.18);
      h += '<div class="inv-callout inv-callout-info inv-mb-8" id="stockReorderCash">With GST about ' + escHtml(formatCurrency(gstRound(L.total * 1.18))) + '. The cash forecast’s lowest point in 45 days is ' +
        escHtml(formatCurrency(fc.min.bal)) + ' (' + escHtml(stockShortDate(fc.min.date)) + '), ' + escHtml(formatCurrency(after)) + ' after this order. ' +
        '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="overview" data-anchor="finForecast">Open the forecast</button></div>';
    }
    h += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label" id="stockReorderNote">' + escHtml(stockReorderNote(L)) + '</div>' +
      '<div class="inv-actionbar-value" id="stockReorderTotal">' + escHtml(formatCurrency(L.total)) + '</div></div>' +
      '<button class="inv-btn inv-btn-primary" data-action="invStockReorderCopy">Copy as message</button></div>';
  }
  return h;
}
function stockReorderNote(L) { return 'At the last prices, before GST' + (L.unpriced ? ' · ' + L.unpriced + ' without a price' : ''); }
function stockReorderWhy(r, full) {
  var unit = r.item.unit || '';
  if (r.noRate) return 'out, and no daily use on record: enter a quantity';
  return (full ? stockFmtQty(r.level) + ' ' + unit + ' on hand · ' + stockFmtRate(r.rate) + ' ' + unit + '/day' + (r.daysLeft != null ? ' · ' + stockDaysText(r.daysLeft, false) + ' left' : '') + ' · ' : '') +
    'needs ' + stockFmtQty(Math.max(0, r.need)) + (r.pack ? ' · packs of ' + stockFmtQty(r.pack) : '') + (r.tentative ? ' · rate from under 3 days of record: check' : '');
}
/* Who the line is ordered from, by when and why, with the door to compare its suppliers (suppliers.js): a row under the line's on the
   phone, lines in its cell on the desktop. */
function stockReorderFromHtml(r, cell) {
  var text = suppPickLine(r.pick), btn = '<button class="inv-btn inv-btn-' + (cell ? 'link' : 'secondary') + ' inv-btn-sm" data-action="invSuppCompare" data-item="' + escHtml(r.item.id) + '">Compare suppliers</button>';
  if (cell) return '<div data-reorder-from="' + escHtml(r.item.id) + '"><div class="inv-row-meta inv-row-wrap">' + escHtml(text) + '</div>' + btn + '</div>';
  return '<div class="inv-row-children"><div class="inv-row inv-row-2 inv-row-flow" data-reorder-from="' + escHtml(r.item.id) + '"><span class="inv-row-main"><span class="inv-row-meta inv-row-wrap">' + escHtml(text) + '</span></span>' +
    '<span class="inv-row-end">' + btn + '</span></div></div>';
}
function stockReorderInput(r) {
  return '<input type="number" inputmode="decimal" step="any" min="0" class="inv-input inv-input-sm inv-input-num" data-stock-reorder="' + escHtml(r.item.id) + '" value="' + escHtml(stockFmtQty(r.qty)) + '" aria-label="' + escHtml(r.item.name) + ' quantity to order">';
}
function stockReorderSub(g) { var sub = g.rows.reduce(function(s, r) { return s + (r.amount || 0); }, 0); return sub ? formatCurrency(gstRound(sub)) : ''; }
function stockReorderRowsHtml(L) {
  var h = '';
  L.groups.forEach(function(g) {
    h += '<div class="inv-row-group"><span>' + escHtml(g.supplier) + '</span><span class="inv-num">' + escHtml(stockReorderSub(g)) + '</span></div>';
    g.rows.forEach(function(r) {
      h += '<div class="inv-row inv-row-2 inv-row-flow"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(r.item.name) + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">' + escHtml(stockReorderWhy(r, true)) + '</span></span>' +
        '<span class="inv-row-end">' + stockReorderInput(r) + '<span class="inv-unit">' + escHtml(r.item.unit || '') + '</span>' +
        '<span class="inv-num">' + (r.amount != null ? escHtml(formatCurrency(r.amount)) : '<span class="inv-dot inv-dot-neutral">No price</span>') + '</span></span></div>' + stockReorderFromHtml(r, false);
    });
  });
  return h;
}
function stockReorderTableHtml(L) {
  var h = '<table class="inv-table"><thead><tr><th class="inv-col-grow">Line</th><th class="inv-num">On hand</th><th class="inv-num">Use a day</th><th>Days left</th>' +
    '<th class="inv-num">Order</th><th class="inv-num">Amount</th></tr></thead><tbody>';
  L.groups.forEach(function(g) {
    h += '<tr class="inv-table-group"><td colspan="5">' + escHtml(g.supplier) + '</td><td class="inv-num">' + escHtml(stockReorderSub(g)) + '</td></tr>';
    g.rows.forEach(function(r) {
      var unit = r.item.unit || '';
      h += '<tr><td class="inv-col-grow" title="' + escHtml(stockReorderWhy(r, false)) + '"><div>' + escHtml(r.item.name) + '</div><div class="inv-row-meta">' + escHtml(stockReorderWhy(r, false)) + '</div>' + stockReorderFromHtml(r, true) + '</td>' +
        '<td class="inv-num">' + stockQtyUnit(r.level, unit) + '</td>' +
        '<td class="inv-num">' + (r.rate ? escHtml(stockFmtRate(r.rate)) + '<span class="inv-unit">' + escHtml(unit) + '</span>' : '&mdash;') + '</td>' +
        '<td class="inv-nowrap">' + (r.daysLeft != null ? escHtml(stockDaysText(r.daysLeft, r.tentative)) : r.noRate ? '<span class="inv-dot inv-dot-danger">Out</span>' : '&mdash;') + '</td>' +
        '<td class="inv-num">' + stockReorderInput(r) + '<span class="inv-unit">' + escHtml(unit) + '</span></td>' +
        '<td class="inv-num">' + (r.amount != null ? escHtml(formatCurrency(r.amount)) : '<span class="inv-dot inv-dot-neutral">No price</span>') + '</td></tr>';
    });
  });
  return h + '</tbody></table>';
}
function stockReorderCopy() {
  var text = stockReorderText(stockReorderList());
  var done = function() { showToast('Order copied: paste it into WhatsApp'); };
  // The clipboard can refuse (no permission, not a secure page): the order is then shown to copy by hand.
  var byHand = function() { uiAlert({ title: 'Copy the order', body: 'It could not be copied by itself. Select the text below and copy it.\n\n' + text, okLabel: 'Done' }); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, byHand); return; }
  } catch (e) { /* fall through */ }
  byHand();
}
function stockReorderOnInput(t) {
  var id = t.getAttribute && t.getAttribute('data-stock-reorder');
  if (id && _stockReorder) {
    _stockReorder.qty[id] = t.value;
    // Only the total moves as a figure is typed: redrawing would take the field from under the cursor.
    var tot = document.getElementById('stockReorderTotal'), note = document.getElementById('stockReorderNote');
    if (tot) { var L = stockReorderList(); tot.textContent = formatCurrency(L.total); if (note) note.textContent = stockReorderNote(L); }
    return true;
  }
  if (t.id === 'stockLeadDays' || t.id === 'stockCoverDays') {
    var v = parseInt(t.value, 10);
    if (v > 0) { if (!S.stockCheck) S.stockCheck = {}; S.stockCheck[t.id === 'stockLeadDays' ? 'leadDays' : 'coverDays'] = v; saveState(); }
    return true;
  }
  return false;
}
