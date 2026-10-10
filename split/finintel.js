/* ===== FINANCE INTELLIGENCE =====
 * docs/FINANCE_INTELLIGENCE_SPEC.md, Phase 5: what the bank statement says, as To-do rules, a
 * days-to-pay per client, and a cash forecast. Every rule is an ordinary To-do rule (an insight is a
 * To-do rule): figures, what to do, what clears it, a snooze against its figures. Warn, never block.
 * Nothing here writes to the book.
 */

/* One classification and one receivables pass per task: the To-do asks every rule in one go. */
var _finCtxMemo = null;
function finCtx() {
  if (!_finCtxMemo) {
    var rows = bankRows(), ctx = { rows: rows, cls: rows.length ? bankClassify(rows) : [], _recv: null };
    ctx.recv = function() { return ctx._recv || (ctx._recv = bankReceivables(ctx.cls)); };
    _finCtxMemo = ctx;
    Promise.resolve().then(function() { _finCtxMemo = null; });
  }
  return _finCtxMemo;
}
function finPct(a, p) {
  if (!a.length) return null;
  var s = a.slice().sort(function(x, y) { return x - y; }), i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
function finOrd(n) { var t = n % 100, u = n % 10; return n + (t > 10 && t < 14 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'); }
function finMonthEnd(ym) { return payMonthEnd(ym + '-01'); }
/* Closed months the statement covers end to end, newest last. */
function finClosedMonths(n) {
  var c = bankCover();
  if (!c) return [];
  var out = [], ym = bankPrevMonth(localDateStr());
  for (var g = 0; g < 36 && out.length < n; g++, ym = bankPrevMonth(ym + '-01')) {
    if (ym + '-01' < c.from) break;
    if (c.to >= finMonthEnd(ym)) out.unshift(ym);
  }
  return out;
}

/* ---------- Days to pay ----------
   Per receipt, the days from each invoice it paid to the day it came in, weighted by the amount
   paid against that invoice. An opening balance has no invoice date and is left out. */
function bankPayHistory(recv) {
  var out = {};
  (recv || finCtx().recv()).forEach(function(r) {
    var list = [];
    r.allocs.forEach(function(a) {
      var w = 0, d = 0;
      a.parts.forEach(function(p) {
        if (!p.inv || !p.date) return;
        var days = isoDaysBetween(p.date, a.v.row.date);
        if (days < 0) return;
        w += p.amount; d += days * p.amount;
      });
      if (w > 0) list.push({ date: a.v.row.date, days: d / w, amount: w, exact: a.how === 'exact' });
    });
    out[r.client.id] = list;
  });
  return out;
}
function _finWeightedMedian(list) {
  var s = list.slice().sort(function(a, b) { return a.days - b.days; }), tot = 0, acc = 0;
  s.forEach(function(x) { tot += x.amount; });
  for (var i = 0; i < s.length; i++) { acc += s[i].amount; if (acc >= tot / 2) return s[i].days; }
  return null;
}
function bankDaysToPay(clientId, hist) {
  var list = (hist || bankPayHistory())[clientId] || [];
  if (!list.length) return null;
  var tot = 0, ex = 0;
  list.forEach(function(x) { tot += x.amount; if (x.exact) ex += x.amount; });
  var l3 = list.slice(-3), w3 = 0, d3 = 0;
  l3.forEach(function(x) { w3 += x.amount; d3 += x.days * x.amount; });
  return { median: _finWeightedMedian(list), last3: w3 > 0 ? d3 / w3 : null, n: list.length, exactShare: tot > 0 ? ex / tot : 0, list: list };
}
function bankBookDaysToPay(hist) {
  var all = [];
  Object.keys(hist).forEach(function(k) { all = all.concat(hist[k]); });
  return all.length ? { median: _finWeightedMedian(all), n: all.length } : null;
}

/* ---------- The cash forecast ----------
   Today's balance + what is expected in − what is expected out, day by day. Each input is a median
   of what the statement shows, with its 25th and 75th percentiles for the band; what it rests on is
   returned with it, and said under the chart. */
function finForecast(days) {
  days = days || 60;
  var ctx = finCtx(), rows = ctx.rows;
  if (!rows.length) return null;
  var today = localDateStr(), last = rows[rows.length - 1], end = isoAddDays(today, days);
  var ev = {}, rests = [];
  var add = function(date, k, lo, mid, hi) {
    if (date <= today || date > end) return;
    var e = ev[date] || (ev[date] = { in: [0, 0, 0], out: [0, 0, 0] });
    e[k][0] += lo; e[k][1] += mid; e[k][2] += hi;
  };
  var months = [], ym = today.slice(0, 7);
  for (var g = 0; g < 4 && ym <= end.slice(0, 7); g++, ym = bankNextMonth(ym)) months.push(ym);
  var onDay = function(ymm, day) { var e = finMonthEnd(ymm); return ymm + '-' + String(Math.min(day, +e.slice(8, 10))).padStart(2, '0'); };

  // In: open invoices at the client's own days-to-pay (the book's where it has under three receipts).
  var recv = ctx.recv(), hist = bankPayHistory(recv), book = bankBookDaysToPay(hist), bookMed = book ? book.median : null;
  // An invoice a little past its usual day is spread over the next four weeks; one long past it (twice
  // the usual and a month, or over 90 days) is not expected at all: on a book with unplaced receipts it is
  // most likely already paid, and otherwise it is a debt to chase, not cash to plan on.
  var nOpen = 0, amtOpen = 0, late = 0, lateAmt = 0, stale = 0, staleAmt = 0, unread = 0, unreadAmt = 0;
  recv.forEach(function(r) {
    var d = bankDaysToPay(r.client.id, hist), med = d && d.n >= 3 ? d.median : bookMed;
    // Nothing yet says when clients pay (no receipt set against an invoice): the invoice is owed, and not counted in.
    if (med == null) { r.open.forEach(function(o) { if (o.inv && o.due > 0.005) { unread++; unreadAmt += o.due; } }); return; }
    r.open.forEach(function(o) {
      if (!o.inv) return;
      var age = isoDaysBetween(o.date, today), due = isoAddDays(o.date, Math.round(med));
      if (age > 90 || age > Math.max(2 * med, med + 30)) { stale++; staleAmt += o.due; return; }
      if (due <= today) {
        for (var k = 1; k <= 28; k++) add(isoAddDays(today, k), 'in', 0, o.due / 28, o.due / 28);
        late++; lateAmt += o.due;
      } else add(due, 'in', o.due, o.due, o.due);
      nOpen++; amtOpen += o.due;
    });
  });
  // In: billing at its recent pace, paid at the book's lag. Without it every future week would carry
  // wages and no sales.
  var from60 = isoAddDays(today, -56), billed = 0, wk = {};
  (S.invoices || []).forEach(function(i) {
    if (i.status !== 'active' || !i.date || i.date <= from60 || i.date > today) return;
    billed += i.grandTotal || 0;
    var ws = attWeekStartOf(i.date); wk[ws] = (wk[ws] || 0) + (i.grandTotal || 0);
  });
  // With no receipt set against an invoice the forecast cannot tell when clients pay, so what is owed and what will be
  // billed are left out and it counts money going out only. Where there is something it left out, it says so wherever
  // it is read (the runway task, the Home tile, the Overview), and a fall below zero is a warning, never red: owed90's
  // rule, for the same reason (unplaced receipts may be money already in).
  var noInflow = null;
  if (bookMed == null && (unread || billed > 0)) {
    var left = (unread ? [todoPlural(unread, 'open invoice') + ' (' + formatCurrency(gstRound(unreadAmt)) + ')'] : []).concat(billed > 0 ? ['new billing'] : []);
    noInflow = { open: unread, amount: gstRound(unreadAmt),
      why: 'no receipt is placed against an invoice yet, so it cannot tell when clients pay, and ' + left.join(' and ') + (unread > 1 || left.length > 1 ? ' are' : ' is') + ' not counted in' };
  }
  if (noInflow) rests.push('Outflows only: ' + noInflow.why + '.');
  else if (bookMed == null) rests.push('No receipt is placed against an invoice yet, so nothing is expected in: the forecast is outflows only.');
  else rests.push(todoPlural(nOpen, 'open invoice') + ', ' + formatCurrency(gstRound(amtOpen)) + ', each at its client’s usual days to pay (the book’s ' + Math.round(bookMed) + ' days where a client has under three receipts)' +
    (late ? '; ' + late + ' a little past it (' + formatCurrency(gstRound(lateAmt)) + ') spread over four weeks, and not counted at the low end' : '') + '.');
  if (stale) rests.push(todoPlural(stale, 'invoice') + ' long past their usual day, ' + formatCurrency(gstRound(staleAmt)) + ', not expected: chase them, do not plan on them.');
  // In: a cheque in hand (TM3b) reaches the bank the next working day, or on its own date where it is dated later. It already
  // settled the invoices it pays (bankReceivables), so they are not expected twice.
  var held = bankChequesHeld(ctx.cls), heldDay = bankChequeNextWorkday(today);
  held.list.forEach(function(o) {
    var amt = Number(o.ch.amount) || 0, on = o.ch.chequeDate && o.ch.chequeDate > heldDay ? o.ch.chequeDate : heldDay;
    add(on, 'in', amt, amt, amt);
  });
  if (held.n) rests.push(todoPlural(held.n, 'cheque') + ' in hand, ' + formatCurrency(held.amount) + ', expected in the bank on ' + formatDate(heldDay) + ' (a post-dated one on its date).');
  var loose = bankLooseReceipts(ctx.cls, bankRecvFrom(ctx.rows));
  if (loose.length && bookMed != null) rests.push(todoPlural(loose.length, 'receipt') + ' not placed on a client: the invoices they paid still read as open, so money in reads high.');

  if (bookMed != null) {
    var weeks = [];
    for (var w = 1; w <= 8; w++) weeks.push(wk[attWeekStartOf(isoAddDays(today, -7 * w))] || 0);
    var perDay = [finPct(weeks, 0.25) / 6, billed / 48, finPct(weeks, 0.75) / 6];
    for (var d = isoAddDays(today, 1); d <= end; d = isoAddDays(d, 1)) {
      if (attParseIso(d).getDay() === 0) continue;
      add(isoAddDays(d, Math.round(bookMed)), 'in', perDay[0], perDay[1], perDay[2]);
    }
    if (billed > 0) rests.push('New billing at the last eight weeks’ pace, ' + formatCurrency(gstRound(billed / 8)) + ' a week, paid ' + Math.round(bookMed) + ' days after it is invoiced.');
  }

  // Out: from the closed months the statement covers.
  var closed = finClosedMonths(3), wages = {}, days1 = [], other = {}, power = [], powerDays = [], cashWk = {};
  // The months a salary run or an electricity payment is on the statement already: an early one (the 8th, where the
  // usual day is the 14th) is in the balance the forecast starts from, and adding the month's again counted it twice.
  var paidIn = { wages: {}, power: {} }, thisMonth = today.slice(0, 7);
  closed.forEach(function(m) { wages[m] = 0; other[m] = 0; });
  ctx.cls.forEach(function(v) {
    var r = v.row;
    // A returned cheque, and a posting with its own reversal, is money that came in and went back out: it does not
    // recur, and counted as "every other payment" it put a month's bounces into every month to come.
    if (!(r.dr > 0) || v.cat === 'reversal') return;
    var m = r.date.slice(0, 7);
    if (v.cat === 'wages' && !v.cash && v.staffId != null) { paidIn.wages[m] = true; if (m in wages) { wages[m] += r.dr; days1.push(+r.date.slice(8, 10)); } }
    else if (v.cat === 'wages') { var ws = attWeekStartOf(r.date); cashWk[ws] = (cashWk[ws] || 0) + r.dr; }
    else if (v.cat === 'power') { paidIn.power[m] = true; power.push(r.dr); powerDays.push(+r.date.slice(8, 10)); }
    else if (v.cat !== 'gst' && m in other) other[m] += r.dr;
  });
  if (!closed.length) rests.push('The statement covers no whole month yet, so salaries, suppliers and other payments are not forecast.');
  if (closed.length) {
    var wv = closed.map(function(m) { return wages[m]; }), sd = Math.round(finPct(days1, 0.5) || 14);
    if (finPct(wv, 0.5) > 0) {
      months.forEach(function(mm) { if (!paidIn.wages[mm]) add(onDay(mm, sd), 'out', finPct(wv, 0.25), finPct(wv, 0.5), finPct(wv, 0.75)); });
      rests.push('Salaries to named hands, ' + formatCurrency(gstRound(finPct(wv, 0.5))) + ' a month around the ' + finOrd(sd) +
        (paidIn.wages[thisMonth] ? '; this month’s are on the statement already' : '') + '.');
    }
    var ov = closed.map(function(m) { return other[m]; });
    months.forEach(function(mm) {
      var n = +finMonthEnd(mm).slice(8, 10);
      for (var k = 1; k <= n; k++) add(mm + '-' + String(k).padStart(2, '0'), 'out', finPct(ov, 0.25) / n, finPct(ov, 0.5) / n, finPct(ov, 0.75) / n);
    });
    rests.push('Suppliers and every other payment, ' + formatCurrency(gstRound(finPct(ov, 0.5))) + ' a month spread by day (the median of ' + closed.map(billsMonthLabel).join(', ') + ').');
  }
  var cw = [], c0 = bankCover();
  for (var q = 1; q <= 8; q++) {
    var s0 = attWeekStartOf(isoAddDays(today, -7 * q));
    if (c0 && s0 >= c0.from && isoAddDays(s0, 6) <= c0.to) cw.push(cashWk[s0] || 0);
  }
  if (cw.length && finPct(cw, 0.5) > 0) {
    for (var sat = isoAddDays(attWeekStartOf(today), 6); sat <= end; sat = isoAddDays(sat, 7)) add(sat, 'out', finPct(cw, 0.25), finPct(cw, 0.5), finPct(cw, 0.75));
    rests.push('Cash drawn for the weekly payout, ' + formatCurrency(gstRound(finPct(cw, 0.5))) + ' each Saturday (the median of ' + cw.length + ' weeks).');
  }
  if (power.length) {
    var pv = power.slice(-6), pd = Math.round(finPct(powerDays.slice(-6), 0.5));
    months.forEach(function(mm) { if (!paidIn.power[mm]) add(onDay(mm, pd), 'out', finPct(pv, 0.25), finPct(pv, 0.5), finPct(pv, 0.75)); });
    rests.push('Electricity, ' + formatCurrency(gstRound(finPct(pv, 0.5))) + ' around the ' + finOrd(pd) +
      (paidIn.power[thisMonth] ? '; this month’s is on the statement already' : '') + '.');
  }
  // GST by the 20th: the month's own due where it is closed, else the last closed month's, at the share of
  // due the bank has paid (input credit takes the rest).
  var gm = insMonthsBack(6), gst = finGstByMonth(gm.concat([today.slice(0, 7)]), ctx.cls), ratios = [];
  gst.forEach(function(r) { if (r.paidBank > 0 && r.due > 0) ratios.push(r.paidBank / r.due); });
  var ratio = ratios.length ? finPct(ratios, 0.5) : null, lastDue = gst.length > 1 ? gst[gst.length - 2].due : 0;
  if (ratio != null) {
    months.forEach(function(mm) {
      var pm = bankPrevMonth(mm + '-01'), r = gst.find(function(x) { return x.month === pm; });
      if (r && r.paid > 0) return;
      var due = r && pm < today.slice(0, 7) ? r.due : lastDue;
      if (due > 0) add(mm + '-20', 'out', due * finPct(ratios, 0.25), due * ratio, due * finPct(ratios, 0.75));
    });
    rests.push('GST by the 20th at ' + Math.round(ratio * 100) + '% of the output tax due, the share the bank has paid.');
  }

  var bal = [last.balance, last.balance, last.balance], out = [], cross = null, min = { bal: last.balance, date: today }, was = last.balance;
  for (var dd = isoAddDays(today, 1); dd <= end; dd = isoAddDays(dd, 1)) {
    var e = ev[dd] || { in: [0, 0, 0], out: [0, 0, 0] };
    bal = [bal[0] + e.in[0] - e.out[2], bal[1] + e.in[1] - e.out[1], bal[2] + e.in[2] - e.out[0]];
    out.push({ date: dd, lo: gstRound(bal[0]), bal: gstRound(bal[1]), hi: gstRound(bal[2]), in: gstRound(e.in[1]), out: gstRound(e.out[1]) });
    if (bal[1] < min.bal) min = { bal: gstRound(bal[1]), date: dd };
    // Below zero is a move from credit into overdraft. An account overdrawn on the statement's last day is overdrawn
    // (`overdrawn`), and read as "below zero tomorrow" it was told a date that had already passed.
    if (!cross && bal[1] < 0 && was >= 0) cross = dd;
    was = bal[1];
  }
  var stale = isoDaysBetween(last.date, today);
  if (stale > 3) rests.unshift('Starts from the balance on ' + formatDate(last.date) + ', the statement’s last day: ' + stale + ' days of payments since are not on it.');
  return { asOf: last.date, start: last.balance, overdrawn: last.balance < 0, days: out, cross: cross, min: min, rests: rests, noInflow: noInflow };
}

function finForecastHtml() {
  var fc = finForecast(60);
  if (!fc) return '';
  var pts = fc.days.filter(function(x, i) { return i % 3 === 2 || i === fc.days.length - 1; });
  var h = '<div class="inv-panel inv-panel-flush inv-panels-wide" id="finForecast"><div class="inv-panel-head"><span class="inv-panel-title">Cash forecast, 60 days</span></div>';
  var at = function(n) { return fc.days[Math.min(n, fc.days.length) - 1]; };
  // Counting outflows only, a figure the forecast made is a warning below zero, never a danger, and says why beside it
  // (DR-8). What the statement itself says (Now) keeps its own tone.
  var only = fc.noInflow ? 'outflows only · ' : '';
  var tiles = [['Now', fc.start, (fc.overdrawn ? 'overdrawn on the statement, ' : 'on the statement, ') + stockShortDate(fc.asOf)], ['Lowest', fc.min.bal, only + 'on ' + stockShortDate(fc.min.date)],
    ['In 30 days', at(30).bal, only + (at(30).lo < 0 && at(30).bal >= 0 ? 'could dip below zero' : 'P25–P75 ' + finRs(at(30).lo) + ' to ' + finRs(at(30).hi))],
    ['In 60 days', at(60).bal, only + 'P25–P75 ' + finRs(at(60).lo) + ' to ' + finRs(at(60).hi)]];
  h += '<div class="inv-tiles inv-tiles-4 inv-tiles-flush">' + tiles.map(function(t, i) {
    return '<div class="inv-tile' + (t[1] < 0 ? (fc.noInflow && i > 0 ? ' inv-tile-warning' : ' inv-tile-danger') : '') + '" data-fc="' + t[0] + '"><div class="inv-tile-label">' + t[0] + '</div>' +
      '<div class="inv-tile-value inv-tile-value-sm inv-nowrap" title="' + escHtml(formatCurrency(t[1])) + '">' + finRs(t[1]) + '</div><div class="inv-tile-sub">' + escHtml(t[2]) + '</div></div>';
  }).join('') + '</div><div class="inv-panel-body">';
  var why = fc.noInflow ? ' Outflows only: ' + fc.noInflow.why + '.' : '';
  if (fc.overdrawn) h += '<div class="inv-callout inv-callout-danger">' + escHtml('The account is overdrawn: ' + formatCurrency(fc.start) + ' on ' + formatDate(fc.asOf) + ', the statement’s last day.' +
    (fc.cross ? ' At this pace it comes back into credit and goes below zero again on ' + formatDate(fc.cross) + '.' : '') + why) + '</div>';
  else if (fc.cross) h += '<div class="inv-callout inv-callout-' + (fc.noInflow ? 'warning' : 'danger') + '">' + escHtml('At this pace the account goes below zero on ' + formatDate(fc.cross) + '.' + why) + '</div>';
  else if (fc.noInflow) h += '<div class="inv-callout inv-callout-warning">' + escHtml(why.trim()) + '</div>';
  h += chartLines(pts.map(function(x) { return stockShortDate(x.date); }), [{ label: 'Balance', values: pts.map(function(x) { return x.bal; }) }],
    { band: pts.map(function(x) { return { lo: x.lo, hi: x.hi }; }), ariaLabel: 'Cash forecast' });
  h += '<div class="inv-note">What it rests on:</div><ul class="inv-note">' + fc.rests.map(function(r) { return '<li>' + escHtml(r) + '</li>'; }).join('') + '</ul>';
  return h + '</div></div>';
}

/* ---------- The rules ---------- */
var FIN_RULES = [
  ['bankStale', 'Finance: the bank statement is out of date'],
  ['bankLoose', 'Finance: receipts not placed on a client'],
  ['owed90', 'Finance: a client owes invoices past its payment terms'],
  ['payingSlower', 'Finance: a client is paying slower than usual'],
  ['gstNotInBank', 'Finance: a month’s GST is not on the statement'],
  ['powerPaidNoBill', 'Finance: electricity paid with no bill entered'],
  ['supplierNoBill', 'Finance: a supplier paid with no stock bill'],
  ['supplierOwed', 'Finance: a supplier is owed for a bill over 30 days old'],
  ['wageVsSlip', 'Finance: a salary paid differs from the payroll as paid'],
  ['cashSwing', 'Finance: a week’s cash drawn is well short of its payout'],
  ['costGap', 'Finance: a recorded cost is far from what was paid'],
  ['runway', 'Finance: the cash forecast goes below zero'],
  ['bankBounce', 'Finance: a returned cheque is not matched to its deposit'],
  ['chequeHeld', 'Finance: a cheque received is not yet in the bank']
];
FIN_RULES.forEach(function(r) { TODO_RULES.push(r); TODO_CHECK_DEFAULTS[r[0]] = true; });
/* Who sees them (todo.js todoSees): every one reads the statement, which is money, whatever page its move lands on (a
   supplier's bill on Stock, the wages on Staff → Pay); the two set against the pay need the wages as well (the QA audit
   of 2 Oct 2026, QA4-4, QA4-3). */
FIN_RULES.forEach(function(r) { TODO_RULE_NEED[r[0]] = 'money'; });
TODO_RULE_NEED.wageVsSlip = 'money wages';
TODO_RULE_NEED.cashSwing = 'money wages';
/* A worker's balance carried from an earlier pay period (payCarried): it asks until it is paid, worked off, or
   cleared with a reason on Staff → Pay ("stated otherwise and notification cleared", owner, 30 Sep 2026). A worker's pay:
   the wages' (QA4-3). */
TODO_RULES.push(['payCarry', 'Pay: a worker carries a balance from an earlier period']);
TODO_CHECK_DEFAULTS.payCarry = true;
TODO_RULE_NEED.payCarry = 'wages';
TODO_RULE_FNS.payCarry = function() {
  if (!staffPayments().some(function(p) { return !p.voidedAt; }) && !payCarryFrom()) return [];
  // What is owed as of today (payOverdue): last month's salary is not owed before the day it is paid by, so the days before
  // payday raise nothing.
  var ws = attWeekStartOf(localDateStr()), lab = payLabMemo();
  var rows = payDue(ws).rows.map(function(r) { var o = payOverdue(r.w, null, lab); return { w: r.w, carried: Math.abs(o.amount) >= 1 ? o.amount : 0 }; })
    .filter(function(r) { return r.carried; });
  if (!rows.length) return [];
  var owed = rows.filter(function(r) { return r.carried > 0; }), adv = rows.filter(function(r) { return r.carried < 0; });
  var sum = function(list) { return gstRound(list.reduce(function(t, r) { return t + Math.abs(r.carried); }, 0)); };
  return [{ key: 'payCarry', rule: 'payCarry', tone: 'amber',
    title: todoPlural(rows.length, 'worker') + ' carry a balance from an earlier period',
    sub: rows.slice(0, 3).map(function(r) { return r.w.name + ' ' + (r.carried > 0 ? 'owed ' : 'advanced ') + formatCurrency(Math.abs(r.carried)); }).join(' · '),
    why: 'Pay · brought forward', facts: [['Owed from before', formatCurrency(sum(owed))], ['Advanced before', formatCurrency(sum(adv))]],
    clears: 'Clears itself when each balance is paid or worked off, or cleared with a reason on People → Pay.',
    go: { kind: 'payDue' }, goLabel: 'Open Pay', sig: rows.map(function(r) { return r.w.id + ':' + r.carried; }).join('|') }];
};
/* A hand named on an overtime block whose own times do not reach it (payCrewGaps), this pay week and the last: the block's hours
   are in nobody's pay until the day is put right (the week of 4 Oct, 10 Oct 2026). A floor entry, so the floor's task. */
TODO_RULES.push(['payCrewGap', 'Attendance: a hand on an OT block their own times do not reach']);
TODO_CHECK_DEFAULTS.payCrewGap = true;
TODO_RULE_NEED.payCrewGap = 'floor';
TODO_RULE_FNS.payCrewGap = function() {
  var ws = attWeekStartOf(localDateStr()), gaps = payCrewGaps(isoAddDays(ws, -7), localDateStr());
  if (!gaps.length) return [];
  return [{ key: 'payCrewGap', rule: 'payCrewGap', tone: 'amber',
    title: gaps.length === 1 ? gaps[0].name + ' is on an OT block their own times do not reach' : todoPlural(gaps.length, 'hand') + ' on an OT block their own times do not reach',
    sub: gaps.slice(0, 3).map(function(gp) { return gp.name + ' ' + stockShortDate(gp.date); }).join(' · '),
    why: 'Attendance · pay reads each hand’s own times', facts: gaps.slice(0, 4).map(function(gp) { return [gp.name, payGapText(gp)]; }),
    clears: 'Clears itself when the hand’s in or out time reaches the block, or the hand is taken off its crew, on People → Attendance.',
    go: { kind: 'staffDay', date: gaps[0].date }, goLabel: 'Open the day', sig: gaps.map(function(gp) { return gp.date + ':' + gp.staffId; }).join('|') }];
};
function finGo(tab, extra) { return Object.assign({ kind: 'finance', tab: tab }, extra || {}); }
function _finRows() { return finCtx().rows; }

TODO_RULE_FNS.bankStale = function() {
  var rows = _finRows();
  if (!rows.length) return [];
  var last = rows[rows.length - 1].date, age = isoDaysBetween(last, localDateStr());
  if (age < 14) return [];
  return [{ key: 'bankStale', rule: 'bankStale', tone: age >= 30 ? 'red' : 'amber', title: 'Import the bank statement', sub: 'The last row is from ' + formatDate(last),
    why: 'Bank · ' + todoPlural(age, 'day') + ' old', facts: [['Last row', formatDate(last)], ['Age', todoPlural(age, 'day')]],
    clears: 'Clears itself when a newer statement is imported.', go: finGo('bank'), goLabel: 'Open the statement', sig: last }];
};
TODO_RULE_FNS.bankLoose = function() {
  var today = localDateStr(), loose = bankLooseReceipts(finCtx().cls, bankRecvFrom(finCtx().rows)).filter(function(v) { return isoDaysBetween(v.row.date, today) >= 7; });
  if (!loose.length) return [];
  var sum = gstRound(loose.reduce(function(s, v) { return s + v.row.cr; }, 0));
  return [{ key: 'bankLoose', rule: 'bankLoose', tone: loose.length >= 10 || sum >= 100000 ? 'red' : 'amber', amount: sum, n: loose.length,
    title: 'Place ' + todoPlural(loose.length, 'receipt') + ' on a client', sub: formatCurrency(sum) + ' came in with no client, so what is owed reads high',
    why: 'Receivables · a week or more unplaced', facts: [['Receipts', String(loose.length)], ['Amount', formatCurrency(sum)], ['Oldest', formatDate(loose[0].row.date)]],
    clears: 'Clears itself when every receipt a week old is placed.', go: finGo('receipts', { anchor: 'bankLoose' }), goLabel: 'Place them', sig: loose.length + '|' + sum }];
};
/* An invoice past its client's payment terms (the entry faces' T2; owner, 10 Oct 2026: "Mehta 7 days - as we give 2% discount, every
   other client 45 days"): the receivables' ageing against each client's terms (flow.js flowTerms), where it read a fixed 90 days. The
   rule keeps its first name, so a switch or a snooze set on it before stands. */
TODO_RULE_FNS.owed90 = function() {
  var today = localDateStr(), recv = finCtx().recv(), book = recv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0);
  // Unplaced receipts may have paid these: until they are placed the figure is an upper bound, never red.
  var loose = bankLooseReceipts(finCtx().cls, bankRecvFrom(finCtx().rows)).length;
  return recv.map(function(r) {
    var terms = flowTerms(r.client.id).days;
    var old = r.open.filter(function(o) { return o.inv && isoDaysBetween(o.date, today) > terms; });
    if (!old.length) return null;
    var sum = gstRound(old.reduce(function(s, o) { return s + o.due; }, 0)), past = isoDaysBetween(old[0].date, today) - terms;
    return { key: 'owed90:' + r.client.id, rule: 'owed90', tone: !loose && book > 0 && sum >= book * 0.1 ? 'red' : 'amber',
      clientId: r.client.id, amount: sum, n: old.length, oldest: old[0].date, owed: r.owed, terms: terms,
      title: r.client.name + ' owes ' + formatCurrency(sum) + ' past its ' + terms + '-day terms', sub: todoPlural(old.length, 'invoice') + ', the oldest ' + formatDate(old[0].date) + ', ' + todoPlural(past, 'day') + ' past them' +
        (loose ? ' · ' + todoPlural(loose, 'receipt') + ' not placed yet may have paid some' : ''),
      why: 'Receivables · past the payment terms', facts: [['Past terms', formatCurrency(sum)], ['Terms', terms + ' days'], ['Invoices', String(old.length)], ['Owed in all', formatCurrency(r.owed)]],
      clears: 'Clears itself when they are paid, or the opening balance or the client’s terms are corrected.', go: finGo('receipts', { client: r.client.id }), goLabel: 'Open the client', sig: old.length + '|' + sum };
  }).filter(Boolean);
};
TODO_RULE_FNS.payingSlower = function() {
  var hist = bankPayHistory();
  return (S.clients || []).map(function(c) {
    var d = bankDaysToPay(c.id, hist);
    if (!d || d.n < 5 || d.median == null || d.last3 == null || d.last3 < d.median * 1.25 || d.last3 - d.median < 5) return null;
    return { key: 'payingSlower:' + c.id, rule: 'payingSlower', tone: 'amber', clientId: c.id, days: Math.round(d.last3), usual: Math.round(d.median),
      title: c.name + ' is paying slower',
      sub: 'Last three receipts ' + Math.round(d.last3) + ' days after the invoice, against a usual ' + Math.round(d.median),
      why: 'Receivables · days to pay', facts: [['Usual', Math.round(d.median) + ' days'], ['Last three', Math.round(d.last3) + ' days'], ['Receipts', String(d.n)], ['Matched exactly', Math.round(d.exactShare * 100) + '%']],
      clears: 'Clears itself when its last three receipts are back within its usual.', go: finGo('receipts', { client: c.id }), goLabel: 'Open the client', sig: d.list[d.list.length - 1].date };
  }).filter(Boolean);
};
TODO_RULE_FNS.gstNotInBank = function() {
  var c = bankCover();
  if (!c) return [];
  return finGstByMonth(insMonthsBack(6), finCtx().cls).filter(function(r) {
    // Only where the statement reaches the day it was due by and covers the month: otherwise it cannot say.
    return finGstStatus(r).missing && c.to >= r.dueBy && c.from <= r.month + '-01';
  }).map(function(r) {
    return { key: 'gstNotInBank:' + r.month, rule: 'gstNotInBank', tone: 'amber', title: 'GST for ' + billsMonthLabel(r.month) + ' is not on the statement',
      sub: formatCurrency(r.due) + ' output tax due by ' + formatDate(r.dueBy) + '; add a note if it was paid another way',
      why: 'GST · no payment, no note', facts: [['Output tax', formatCurrency(r.due)], ['Due by', formatDate(r.dueBy)]],
      clears: 'Clears itself when the payment is on the statement or the month has a note.', go: finGo('gst', { gstMonth: r.month }), goLabel: 'Add a note', sig: r.month };
  });
};
TODO_RULE_FNS.powerPaidNoBill = function() {
  // Only the book's months: a payment for a month before the first invoice pays a bill Payments never asks for
  // (billsMissingPower) and nothing reads. Nor a month the power rule already asks for: one task per bill.
  var first = '';
  (S.invoices || []).forEach(function(i) { if (i.date && (!first || i.date < first)) first = i.date; });
  if (!first) return [];
  var asked = {};
  try { if (todoCfg().power) (TODO_RULE_FNS.power() || []).forEach(function(t) { if (t.go && t.go.month) asked[t.go.month] = true; }); } catch (e) { /* the power rule's own */ }
  var miss = {};
  bankPowerRows(finCtx().cls).forEach(function(v) {
    var m = bankBillMonth(v.row);
    if (m < first.slice(0, 7) || asked[m]) return;
    if (costBills().some(function(b) { return b.kind === 'power' && !b.voided && b.month === m; })) return;
    miss[m] = gstRound((miss[m] || 0) + v.row.dr);
  });
  var ms = Object.keys(miss).sort();
  if (!ms.length) return [];
  var tot = gstRound(ms.reduce(function(s, m) { return s + miss[m]; }, 0));
  return [{ key: 'powerPaidNoBill', rule: 'powerPaidNoBill', tone: 'info',
    title: ms.length === 1 ? 'Add the electricity bill the bank paid for ' + billsMonthLabel(ms[0]) : 'Add ' + ms.length + ' electricity bills the bank paid for',
    sub: ms.map(billsMonthLabel).join(', ') + ' · ' + formatCurrency(tot) + '; Live cost reads them from the bank until then',
    why: 'Payments · electricity', facts: ms.map(function(m) { return [billsMonthLabel(m), formatCurrency(miss[m])]; }),
    clears: 'Clears itself when each month has its bill (one tap on Payments: Add as bill).', go: finGo('payments', { anchor: 'bankPower' }), goLabel: 'Add as bills', sig: ms.join('|') }];
};
/* A payment to a supplier with no stock bill from them that month or the one before (a bill is paid after it is raised), read through
   the suppliers (suppliers.js): every spelling the owner gave one is theirs, and "&" is AND, so a payment the statement writes one
   way is set against bills written the other. */
TODO_RULE_FNS.supplierNoBill = function() {
  var today = localDateStr(), out = [];
  suppIndex().list.forEach(function(sp) {
    var months = {}, by = {};
    sp.bills.forEach(function(b) { months[b.date.slice(0, 7)] = 1; });
    sp.bank.forEach(function(v) {
      if (isoDaysBetween(v.row.date, today) > 90) return;
      var m = v.row.date.slice(0, 7);
      if (months[m] || months[bankPrevMonth(m + '-01')]) return;
      var e = by[m] || (by[m] = { month: m, paid: 0, n: 0 });
      e.paid = gstRound(e.paid + v.row.dr); e.n++;
    });
    Object.keys(by).forEach(function(m) {
      var e = by[m];
      out.push({ key: 'supplierNoBill:' + (sp.keys[0] || sp.id) + '|' + m, rule: 'supplierNoBill', tone: 'info', title: 'Enter the stock bill for ' + sp.name + ', ' + billsMonthLabel(m),
        sub: formatCurrency(e.paid) + ' paid in ' + todoPlural(e.n, 'payment') + ' with no stock bill from them that month or the one before',
        why: 'Payments · supplier', facts: [['Paid', formatCurrency(e.paid)], ['Month', billsMonthLabel(m)]],
        clears: 'Clears itself when a stock bill from them is entered for that month.', go: { kind: 'stockList' }, goLabel: 'Open Stock', sig: e.paid + '' });
    });
  });
  return out;
};
/* A supplier with a balance set whose oldest unpaid part is over SUPP_OWED_DAYS old (suppliers.js: the payments settle the oldest
   first). Only to know: when to pay is the owner's. */
TODO_RULE_FNS.supplierOwed = function() {
  return suppTotals().rows.filter(function(x) { return x.L.balance > 0.5 && x.L.oldest && suppAgeDays(x.L.oldest.date) > SUPP_OWED_DAYS; }).map(function(x) {
    var L = x.L, o = L.oldest;
    return { key: 'supplierOwed:' + x.sp.id, rule: 'supplierOwed', tone: 'info', title: 'Pay ' + x.sp.name + ': ' + formatCurrency(L.balance) + ' owed',
      sub: 'Unpaid from ' + formatDate(o.date) + ', ' + todoPlural(suppAgeDays(o.date), 'day') + ' ago',
      why: 'Payments · suppliers', amount: L.balance,
      facts: [['Owed', formatCurrency(L.balance)], ['Unpaid from', formatDate(o.date)], ['Balance set', formatCurrency(L.op.amount) + ' on ' + formatDate(L.op.date)]],
      clears: 'Clears itself when nothing unpaid is over ' + SUPP_OWED_DAYS + ' days old.', go: { kind: 'supplier', id: x.sp.id }, goLabel: 'Open the supplier',
      sig: L.balance + '|' + o.date };
  });
};
TODO_RULE_FNS.wageVsSlip = function() {
  var byMonth = {};
  finCtx().cls.forEach(function(v) {
    if (v.cat !== 'wages' || v.cash || v.staffId == null || !(v.row.dr > 0)) return;
    var m = v.row.date.slice(0, 7), e = byMonth[m] || (byMonth[m] = {});
    e[String(v.staffId)] = gstRound((e[String(v.staffId)] || 0) + v.row.dr);
  });
  return Object.keys(byMonth).map(function(m) {
    var slip = payrollPaidFor(bankPrevMonth(m + '-01'));
    if (!slip) return null;
    // Once monthly balances are counted (Pay, Count from a month) a month's difference is Pay's: from that month on it carries to the
    // next month's due, said there by month; the months before it the owner settled as they stand.
    if (payCarryFrom()) return null;
    // The slip's rows by worker, matched by name like a roll (payrollRowsByWorker), once per month.
    var off = [], byW = payrollRowsByWorker(slip.rows);
    Object.keys(byMonth[m]).forEach(function(id) {
      var row = byW[id];
      if (!row) return;
      var owed = gstRound(row.paid != null ? Number(row.paid) : (Number(row.dayPay) || 0) + (Number(row.ot) || 0)), d = gstRound(byMonth[m][id] - owed);
      if (Math.abs(d) >= 1) off.push([(staffById(id) || { name: '?' }).name, d]);
    });
    if (!off.length) return null;
    var pm = bankPrevMonth(m + '-01');
    return { key: 'wageVsSlip:' + m, rule: 'wageVsSlip', tone: 'amber', title: todoPlural(off.length, 'salary', 'salaries') + ' for ' + billsMonthLabel(pm) + ' differ from the slip',
      sub: off.slice(0, 3).map(function(o) { return o[0] + ' ' + (o[1] > 0 ? 'over' : 'short') + ' ' + formatCurrency(Math.abs(o[1])); }).join(' · '),
      why: 'Payments · wages against payroll as paid', facts: off.map(function(o) { return [o[0], (o[1] > 0 ? '+' : '−') + formatCurrency(Math.abs(o[1]))]; }),
      clears: 'Clears itself when the amounts agree; snooze it if a note explains them.', go: { kind: 'payWages' }, goLabel: 'Open wages paid', sig: off.map(function(o) { return o[1]; }).join('|') };
  }).filter(Boolean);
};
TODO_RULE_FNS.cashSwing = function() {
  var c = bankCover(), today = localDateStr();
  if (!c) return [];
  var ws = attWeekStartOf(isoAddDays(today, -7)), sat = isoAddDays(ws, 6);
  if (c.to < sat || c.from > ws) return [];
  var drawn = gstRound(finCtx().cls.reduce(function(s, v) {
    return s + (v.cat === 'wages' && (v.cash || v.staffId == null) && v.row.dr > 0 && attWeekStartOf(v.row.date) === ws ? v.row.dr : 0);
  }, 0));
  var pw = payWeek(ws);
  // Cash past the payout is the owner's drawings (owner, 6 Oct 2026), so only a week drawn well short of its payout asks:
  // the wages were paid some other way, or the payout reads high.
  if (!pw.recordedDays || !(pw.total > 0) || drawn >= pw.total * 0.75) return [];
  var d = gstRound(drawn - pw.total);
  return [{ key: 'cashSwing:' + ws, rule: 'cashSwing', tone: 'amber', title: 'Cash drawn for the week to ' + formatDate(sat) + ' is under its payout',
    sub: formatCurrency(drawn) + ' drawn against a payout of ' + formatCurrency(pw.total) + ': paid some other way, or the payout reads high', why: 'Payments · cash by pay week',
    facts: [['Drawn', formatCurrency(drawn)], ['Payout', formatCurrency(pw.total)], ['Gap', (d > 0 ? '+' : '−') + formatCurrency(Math.abs(d))]],
    clears: 'Clears itself when a week\'s cash comes within a quarter of its payout.', go: { kind: 'payWages' }, goLabel: 'Open wages paid', sig: drawn + '|' + pw.total }];
};
TODO_RULE_FNS.costGap = function() {
  var closed = finClosedMonths(3);
  if (!closed.length) return [];
  var from = closed[0] + '-01', to = finMonthEnd(closed[closed.length - 1]);
  return liveCostPaidCheck(from, to).filter(function(r) { return r.flag; }).map(function(r) {
    return { key: 'costGap:' + r.key, rule: 'costGap', tone: 'amber', title: r.label + ': recorded and paid are ' + (r.pct != null ? Math.round(Math.abs(r.pct) * 100) + '%' : 'far') + ' apart',
      sub: 'Recorded ' + formatCurrency(r.recorded) + ' · paid ' + formatCurrency(r.paid) + ' over ' + r.months.map(billsMonthLabel).join(', '),
      why: 'Live cost · recorded against paid', facts: [['Recorded', formatCurrency(r.recorded)], ['Paid', formatCurrency(r.paid)], ['Reads', r.why]],
      clears: 'Clears itself when the two are within 10%; snooze it once the reason is known.', go: { kind: 'stats', tab: 'cost' }, goLabel: 'Open Live cost', sig: r.key + '|' + (r.pct != null ? Math.round(r.pct * 100) : '') };
  });
};
TODO_RULE_FNS.bankBounce = function() {
  var open = bankReturnedCheques(finCtx().cls).filter(function(v) { return !v.bounceSet; });
  if (!open.length) return [];
  var sum = gstRound(open.reduce(function(s, v) { return s + v.row.dr; }, 0));
  return [{ key: 'bankBounce', rule: 'bankBounce', tone: 'amber',
    title: open.length === 1 ? 'Match the cheque returned on ' + formatDate(open[0].row.date) : 'Match ' + open.length + ' returned cheques',
    sub: formatCurrency(sum) + ' went back out; until each is linked to its deposit, that client reads as paid',
    why: 'Receivables · returned cheques', facts: open.map(function(v) { return [formatDate(v.row.date), formatCurrency(v.row.dr)]; }),
    clears: 'Clears itself when each is linked to its deposit or marked not a bounce.', go: finGo('receipts', { anchor: 'bankBounces' }), goLabel: 'Match them', sig: open.map(function(v) { return v.row.id; }).join('|') }];
};
/* A cheque received and still in hand (TM3b): amber at 3 days, red at 7, one task a cheque (three or more fold into one). It
   says whether the statement reaches past the day it came, so "not in the bank" is a fact, else to import the statement. */
TODO_RULE_FNS.chequeHeld = function() {
  var ctx = finCtx(), end = ctx.rows.length ? ctx.rows[ctx.rows.length - 1].date : '';
  return bankChequesHeld(ctx.cls).list.filter(function(o) { return o.days >= 3; }).map(function(o) {
    var c = bankChequeClient(o.ch), past = end && end > o.ch.receivedOn, tone = o.days >= 7 ? 'red' : 'amber';
    return { key: 'chequeHeld:' + o.ch.id, rule: 'chequeHeld', tone: tone, clientId: o.ch.clientId, amount: Number(o.ch.amount) || 0,
      // The client is in its line, not its title: Needs you's groups name their tasks by title in one line (a long name made
      // that line a block of text, P195).
      title: 'Deposit cheque ' + o.ch.number,
      sub: (c ? c.name + ' · ' : '') + formatCurrency(o.ch.amount) + ', received ' + formatDate(o.ch.receivedOn) + (past ? ': not in the bank by ' + formatDate(end) : ': import the statement to check'),
      why: 'Receivables · cheque in hand', facts: [['Received', formatDate(o.ch.receivedOn)], ['In hand', todoPlural(o.days, 'day')], ['Statement to', end ? formatDate(end) : 'none yet']],
      clears: 'Clears itself when its deposit is on the statement, or the cheque is voided.', go: finGo('receipts', { cheque: o.ch.id }), goLabel: 'Open the cheque',
      sig: o.ch.id + '|' + tone };
  });
};
TODO_RULE_FNS.runway = function() {
  var fc = finForecast(45);
  if (!fc || !(fc.cross || fc.overdrawn)) return [];
  var go = finGo('overview', { anchor: 'finForecast' });
  // Overdrawn on the statement's last day is a fact, said as one: not "below zero tomorrow".
  if (fc.overdrawn) return [{ key: 'runway', rule: 'runway', tone: 'red', low: fc.min.bal, lowDate: fc.min.date, cross: fc.cross, onlyOut: !!fc.noInflow,
    title: 'The account is overdrawn: ' + formatCurrency(fc.start) + ' on ' + formatDate(fc.asOf),
    sub: 'The balance on the statement’s last day' + (fc.cross ? '; at the forecast’s pace it comes back into credit and goes below zero again on ' + formatDate(fc.cross)
      : '; the forecast’s lowest point is ' + formatCurrency(fc.min.bal) + ' on ' + formatDate(fc.min.date)) + (fc.noInflow ? ' (outflows only)' : ''),
    why: 'Finance · the statement', facts: [['Balance on ' + formatDate(fc.asOf), formatCurrency(fc.start)], ['Lowest', formatCurrency(fc.min.bal)]],
    clears: 'Clears itself when a statement shows the account in credit and the forecast stays above zero for 45 days.', go: go, goLabel: 'Open the forecast', sig: 'overdrawn|' + fc.asOf }];
  // Counting outflows only (nothing yet says when clients pay) it is a warning, never red: owed90's rule, for the same reason.
  var only = !!fc.noInflow;
  return [{ key: 'runway', rule: 'runway', tone: only ? 'amber' : 'red', low: fc.min.bal, lowDate: fc.min.date, cross: fc.cross, onlyOut: only,
    title: (only ? 'Outflows only: cash goes below zero on ' : 'Cash goes below zero on ') + formatDate(fc.cross),
    sub: only ? 'The forecast counts money out and nothing in: ' + fc.noInflow.why : 'At the forecast’s pace; the lowest point is ' + formatCurrency(fc.min.bal) + ' on ' + formatDate(fc.min.date),
    why: 'Finance · cash forecast' + (only ? ', outflows only' : ''), facts: [['Balance on ' + formatDate(fc.asOf), formatCurrency(fc.start)], ['Below zero', formatDate(fc.cross)], ['Lowest', formatCurrency(fc.min.bal)]],
    clears: 'Clears itself when the forecast stays above zero for 45 days.' + (only ? ' Placing receipts on their clients lets it count money in.' : ''),
    go: go, goLabel: 'Open the forecast', sig: (only ? 'out|' : '') + fc.cross }];
};
