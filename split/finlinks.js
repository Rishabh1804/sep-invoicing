/* ===== FINANCE, LINKED INTO EVERY SCREEN =====
 * docs/FINANCE_INTELLIGENCE_SPEC.md, Phase 6. Each screen carries the finance fact that belongs to it —
 * what a client owes and how fast it pays, whether an invoice is paid, what a supplier was paid — as a
 * link into Finance, never as a second copy of the arithmetic. Every figure here is read from the
 * functions Finance itself uses (bankReceivables, bankDaysToPay, finForecast), once per task via finCtx().
 * With no statement imported, each screen says nothing rather than a zero.
 */

function finHasBank() { return bankData().rows.length > 0; }
/* The statement is there and the person signed in may read it: what the bank says is money, the finance permission's
   (guard.js), on whichever screen it is carried (the QA audit of 2 Oct 2026, QA4-4: a client's Money panel, what the bank
   paid a supplier on Stock, and an invoice's payment showed to a role without money). A screen says nothing then, as it
   does with no statement. */
function finSeen() { return finHasBank() && (typeof grdSeesMoney !== 'function' || grdSeesMoney()); }

/* ---------- A client ---------- */
function finClientMoney(clientId) {
  if (!finSeen()) return null;
  var ctx = finCtx(), r = ctx.recv().find(function(x) { return String(x.client.id) === String(clientId); });
  var last = null;
  ctx.cls.forEach(function(v) { if (v.cat === 'receipt' && v.clientId != null && String(v.clientId) === String(clientId) && v.row.cr > 0) last = v.row; });
  return { r: r || null, dtp: bankDaysToPay(clientId, bankPayHistory(ctx.recv())), series: bankChequeSeries(ctx.cls)[String(clientId)] || [], last: last,
    bands: r ? finAgeing([r]) : null, from: bankRecvFrom(ctx.rows) };
}
/* One panel, drawn on the client's detail, its edit sheet and its Performance view. */
function finClientMoneyHtml(clientId) {
  var m = finClientMoney(clientId);
  if (!m) return '';
  var h = '<div class="inv-panel inv-panel-flush" data-client-money="' + escHtml(String(clientId)) + '"><div class="inv-panel-head"><span class="inv-panel-title">Money</span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="receipts" data-client="' + escHtml(String(clientId)) + '">Open in Finance</button></div>';
  if (!m.r) return h + '<div class="inv-empty">Nothing invoiced or received since ' + escHtml(formatDate(m.from)) + ', when receivables start.</div></div>';
  var row = function(k, v, sub) {
    return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + k + '</span>' + (sub ? '<span class="inv-row-meta">' + sub + '</span>' : '') + '</span><span class="inv-row-end inv-num">' + v + '</span></div>';
  };
  h += row(m.r.owed < -0.005 ? 'Paid ahead' : 'Owed', escHtml(formatCurrency(Math.abs(m.r.owed))), m.r.open.length + ' open' + (m.r.oldestDays != null ? ' · oldest ' + m.r.oldestDays + ' days' : '') + ' · since ' + escHtml(formatDate(m.from)));
  var aged = m.bands.filter(function(b) { return b.amount > 0.005; });
  if (aged.length) h += row('By age', '', aged.map(function(b) { return escHtml(b.label) + ' ' + escHtml(formatCurrency(b.amount)); }).join(' · '));
  h += row('Pays in', m.dtp && m.dtp.median != null ? Math.round(m.dtp.median) + ' days' : '&mdash;',
    m.dtp ? m.dtp.n + ' receipt' + (m.dtp.n === 1 ? '' : 's') + ' set against invoices · last three at ' + Math.round(m.dtp.last3) + ' days · ' + Math.round(m.dtp.exactShare * 100) + '% matched exactly' : 'no receipt set against an invoice yet');
  if (m.last) h += row('Last receipt', escHtml(formatCurrency(m.last.cr)), escHtml(formatDate(m.last.date)) + (bankInstrument(m.last) ? ' · chq ' + escHtml(bankInstrument(m.last)) : ''));
  if (m.series.length) h += row('Cheques', '', '<span class="inv-id">' + escHtml(m.series.slice(-6).join(' · ')) + '</span>');
  return h + '</div>';
}

/* ---------- An invoice ---------- */
/* Paid by the receipts it was set against, or open and how long. An invoice from before the statement's
   first day is not read at all: its payment may be on a statement nobody imported. */
function finInvoicePayment(inv) {
  if (!finSeen() || !inv || inv.status !== 'active') return null;
  var ctx = finCtx(), from = bankRecvFrom(ctx.rows);
  if (inv.date < from) return { before: from };
  var r = ctx.recv().find(function(x) { return String(x.client.id) === String(inv.clientId); });
  if (!r) return null;
  var label = inv.displayNumber || inv.invoiceNumber, paid = [];
  r.allocs.forEach(function(a) {
    a.parts.forEach(function(p) { if (p.inv && p.label === label) paid.push({ date: a.v.row.date, amount: p.amount, how: a.how, chq: bankInstrument(a.v.row) }); });
  });
  (r.credits || []).forEach(function(p) { if (p.inv && p.label === label) paid.push({ date: '', amount: p.amount, how: 'account' }); });
  var open = r.open.find(function(o) { return o.inv && o.inv.id === inv.id; });
  return { paid: paid, open: open ? gstRound(open.due) : 0, days: isoDaysBetween(inv.date, localDateStr()) };
}
function finInvoicePaymentHtml(inv) {
  var p = finInvoicePayment(inv);
  if (!p) return '';
  var h = '<div class="inv-row-group" data-inv-payment><span>Payment</span><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="receipts" data-client="' + escHtml(String(inv.clientId)) + '">Open in Finance</button></div>';
  if (p.before) return h + '<div class="inv-row"><span class="inv-row-main inv-row-meta">Dated before receivables start, ' + escHtml(formatDate(p.before)) + ': its payment is not read.</span></div>';
  p.paid.forEach(function(x) {
    if (x.how === 'account') {
      h += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title"><span class="inv-dot inv-dot-info">Settled from money on account</span></span>' +
        '<span class="inv-row-meta">paid before this invoice was raised</span></span><span class="inv-row-end inv-num">' + escHtml(formatCurrency(x.amount)) + '</span></div>';
      return;
    }
    h += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title"><span class="inv-dot inv-dot-' + (x.how === 'exact' ? 'ok' : 'info') + '">' + (x.how === 'exact' ? 'Paid, exact' : 'Paid, oldest first') + '</span></span>' +
      '<span class="inv-row-meta">' + escHtml(formatDate(x.date)) + (x.chq ? ' · chq ' + escHtml(x.chq) : '') + '</span></span><span class="inv-row-end inv-num">' + escHtml(formatCurrency(x.amount)) + '</span></div>';
  });
  if (p.open > 0.005) h += '<div class="inv-row"><span class="inv-row-main"><span class="inv-dot inv-dot-' + (p.days > 90 ? 'danger' : p.days > 60 ? 'warning' : 'neutral') + '">Open, ' + p.days + ' days</span></span><span class="inv-row-end inv-num">' + escHtml(formatCurrency(p.open)) + '</span></div>';
  return h;
}

/* ---------- A supplier ---------- */
/* Payments on the statement set to Supplier whose payee (or narration) carries the supplier's name, read by the
   one matcher every supplier figure uses (bankSupplierIs, bank.js). */
function finSupplierPaid(name) {
  if (!name || !finSeen()) return null;
  var k = bankKey(name);
  if (k.length < 4) return null;
  var out = { paid: 0, n: 0, last: null };
  finCtx().cls.forEach(function(v) {
    if (!(v.row.dr > 0) || v.cat !== 'supplier' || !bankSupplierIs(bankSupplierWritten(v), k)) return;
    out.paid = gstRound(out.paid + v.row.dr); out.n++; out.last = v.row;
  });
  return out.n ? out : null;
}

/* ---------- Home ---------- */
/* What is owed, by age, as a bar's tones: within a month fresh, a second month plain, then warning and danger (figToneAge's
   60 and 90 days). Pulse's Money card and the cash question draw the one bar (intel.js). */
var FIN_AGE_TONE = ['ok', 'neutral', 'warning', 'danger'];
/* Pulse's Money as a hero: what is owed past 60 and 90 days, the ageing as a bar in its tones, and the four tiles into Finance
   (balance, owed, pays in, runway), each coded in its own tone. Coded by the worst of them. */
function renderFinHomeCard() {
  var el = document.getElementById('homeFinCard');
  if (!el) return;
  // Pulse's Money widget is the finance permission's: for another role it is not drawn at all (tabs.js homeWidgetSeen).
  if (typeof grdSeesMoney === 'function' && !grdSeesMoney()) { el.innerHTML = ''; return; }
  var imp = '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invHomeImportBank">Import statement</button>';
  if (!finHasBank()) {
    el.innerHTML = uiHeroHtml({ tone: 'neutral', eyebrow: '<span>Money</span>', title: 'No bank statement yet',
      sub: 'Import the bank’s .xls or .xlsx to see the balance, what is owed and the forecast.', attrs: ' id="homeFin" data-card="money"', foot: imp });
    return;
  }
  var rows = bankRows(), last = rows[rows.length - 1], recv = finCtx().recv(), fc = finForecast(45);
  var owed = recv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0);
  var book = bankBookDaysToPay(bankPayHistory(recv));
  var loose = bankLooseReceipts(finCtx().cls, bankRecvFrom(finCtx().rows)).length;
  var age = isoDaysBetween(last.date, localDateStr());
  // What is owed is judged by its age: any of it past 90 days is danger, past 60 warning (figToneAge).
  var over = finAgeing(recv), old90 = over[3] ? over[3].amount : 0, old60 = over[2] ? over[2].amount : 0;
  var tones = [];
  var tile = function(tab, anchor, label, value, sub, tone) {
    if (tone) tones.push(tone);
    return '<button class="inv-tile' + (tone ? ' inv-tile-' + tone : '') + '" data-action="invFinGo" data-tab="' + tab + '"' + (anchor ? ' data-anchor="' + anchor + '"' : '') + ' data-home-fin="' + label + '">' +
      '<div class="inv-tile-label">' + label + '</div><div class="inv-tile-value inv-tile-value-sm inv-nowrap" title="' + escHtml(formatCurrency(value)) + '">' + finRs(value) + '</div><div class="inv-tile-sub">' + sub + '</div></button>';
  };
  var pays = book && book.median != null ? figTonePaysIn(book.median) : null;
  if (pays) tones.push(pays);
  var tiles = '<div class="inv-tiles inv-tiles-flush">' +
    tile('bank', '', 'Balance', last.balance, 'on ' + escHtml(stockShortDate(last.date)) + (age > 7 ? ', ' + age + ' days ago' : ''), last.balance < 0 ? 'danger' : age > 7 ? 'warning' : '') +
    tile('receipts', loose ? 'bankLoose' : '', 'Owed to us', owed, loose ? loose + ' receipt' + (loose === 1 ? '' : 's') + ' not placed'
      : old90 > 0 ? finRs(old90) + ' over 90 days' : old60 > 0 ? finRs(old60) + ' over 60 days' : 'since ' + escHtml(stockShortDate(bankRecvFrom(rows))),
      // Never red while a receipt is unplaced: that money may be in already, and the sub line names the receipts (owed90).
      loose ? 'warning' : old90 > 0 ? 'danger' : old60 > 0 ? 'warning' : '') +
    (book && book.median != null ? '<button class="inv-tile' + (pays ? ' inv-tile-' + pays : '') + '" data-action="invFinGo" data-tab="receipts" data-home-fin="Pays in"><div class="inv-tile-label">Pays in</div>' +
      '<div class="inv-tile-value inv-tile-value-sm">' + Math.round(book.median) + ' days</div><div class="inv-tile-sub">the book, invoice to receipt' +
      (book.median > 60 ? ' · over two months' : book.median > 30 ? ' · over a month' : '') + '</div></button>' : '') +
    // Overdrawn on the statement says so; counting outflows only (no receipt yet says when clients pay) is a warning, said.
    tile('overview', 'finForecast', 'Runway', fc ? fc.min.bal : last.balance, !fc ? '' : fc.overdrawn ? 'overdrawn on ' + escHtml(stockShortDate(fc.asOf)) + (fc.noInflow ? ' · outflows only' : '')
      : (fc.noInflow ? 'outflows only · ' : '') + (fc.cross ? 'below zero on ' + escHtml(stockShortDate(fc.cross)) : 'lowest in 45 days, ' + escHtml(stockShortDate(fc.min.date))),
      !fc ? '' : fc.overdrawn ? 'danger' : fc.cross ? (fc.noInflow ? 'warning' : 'danger') : '') +
    '</div>';
  var rank = { danger: 3, warning: 2, ok: 1 }, worst = tones.filter(function(t) { return rank[t]; }).sort(function(x, y) { return rank[y] - rank[x]; })[0] || '';
  var title = owed < 0.5 ? 'Nothing owed to us' : old90 > 0 ? finRs(old90) + ' owed over 90 days' : old60 > 0 ? finRs(old60) + ' owed over 60 days' : 'Nothing owed over 60 days';
  var meter = owed >= 0.5 ? chartMeter(over.map(function(b, i) { return { v: b.amount, tone: FIN_AGE_TONE[i] || 'neutral' }; }),
    { title: 'Owed by age: ' + over.map(function(b) { return b.label + ' ' + finRs(b.amount); }).join(' · ') }) : '';
  el.innerHTML = uiHeroHtml({ tone: worst, eyebrow: '<span>Money</span><span class="inv-panel-count">statement to ' + escHtml(stockShortDate(last.date)) + '</span>',
    title: escHtml(title), sub: escHtml([owed >= 0.5 ? finRs(owed) + ' owed in all' : '', book && book.median != null ? 'clients pay in ' + Math.round(book.median) + ' days' : '', finRs(last.balance) + ' in the bank'].filter(Boolean).join(' · ')),
    viz: meter, fold: 'pulse-money', open: !!_isDesktop, attrs: ' id="homeFin" data-card="money"', body: '<div class="inv-hero-sheet">' + tiles + '</div>', foot: imp });
}

/* ---------- Wages: the bank's legs beside the payroll, on Finance → Payments and on Staff → Pay ---------- */
/* What the payroll as paid says a hand was owed for its month, or null when the slip does not name them: the slip's
   paid figure, else its day pay and overtime. One lookup for the wages panel's count and its rows. */
function finSlipOwed(slip, staffId) {
  var row = slip ? slip.rows.find(function(r) { var pw = payrollWorker(r); return pw && String(pw.id) === String(staffId); }) : null;
  return row ? gstRound(row.paid != null ? Number(row.paid) : (Number(row.dayPay) || 0) + (Number(row.ot) || 0)) : null;
}
function finWagesHtml(cls, where) {
  var wages = cls.filter(function(v) { return v.cat === 'wages' && v.row.dr > 0; });
  var byMonth = {};
  wages.forEach(function(v) {
    var m = v.row.date.slice(0, 7), e = byMonth[m] = byMonth[m] || { named: {}, cash: 0, total: 0 };
    e.total = gstRound(e.total + v.row.dr);
    if (v.cash || v.staffId == null) e.cash = gstRound(e.cash + v.row.dr);
    else { var k = String(v.staffId); e.named[k] = gstRound((e.named[k] || 0) + v.row.dr); }
  });
  var months = Object.keys(byMonth).sort().reverse();
  // One fact, one screen (UX overhaul 2, owner 28 Sep 2026): the card lives in Staff → Pay beside the payroll it checks;
  // Finance → Payments keeps one line that says what it holds and opens it.
  var off = 0;
  months.forEach(function(m) {
    var e = byMonth[m], slip = payrollPaidFor(bankPrevMonth(m + '-01'));
    if (slip) Object.keys(e.named).forEach(function(id) {
      var owedW = finSlipOwed(slip, id);
      if (owedW != null && Math.abs(e.named[id] - owedW) >= 1) off++;
    });
  });
  var sum = months.length ? 'Latest: ' + escHtml(billsMonthLabel(months[0])) + ' <span class="inv-num">' + formatCurrency(byMonth[months[0]].total) + '</span>' +
    (off ? ' · <span class="inv-dot inv-dot-danger">' + off + ' off the slip</span>' : '') : 'No wages on the statement';
  if (where !== 'pay') {
    return '<div class="inv-panel inv-panel-flush" id="bankWages"><div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">Wages paid, from the bank</span>' +
      '<span class="inv-row-meta">' + sum + '</span></span><span class="inv-row-end"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invGoPay">Open Staff &rarr; Pay</button></span></div></div>';
  }
  var h = '<div class="inv-panel-body inv-note">A cash draw (SELF, TO SELF, TO CASH) is wages and the owner\'s drawings: each pay week\'s cash counts as wages up to the payout recorded for that week, and what is drawn past it is drawings, never a cost. A week with no attendance recorded cannot be split. Transfers to a hand on the roster are set against the payroll as paid for the month before.</div>';
  if (!months.length) h += '<div class="inv-empty">No wages on the statement.</div>';
  // The latest three months; the rest one tap away.
  h += uiMoreHtml('pay-wages-months', months.map(function(m) {
    var e = byMonth[m], slip = payrollPaidFor(bankPrevMonth(m + '-01')), named = Object.keys(e.named);
    var h = '<div class="inv-row inv-row-group"><span class="inv-row-main">Paid in ' + escHtml(billsMonthLabel(m)) + '</span><span class="inv-row-end inv-num">' + formatCurrency(e.total) + '</span></div>';
    named.forEach(function(id) {
      var w = (S.staff || []).find(function(x) { return String(x.id) === id; }) || { name: '?' };
      var owedW = finSlipOwed(slip, id);
      var diff = owedW == null ? null : gstRound(e.named[id] - owedW);
      h += '<div class="inv-row" data-wage="' + escHtml(m + ':' + id) + '"><span class="inv-row-main">' + escHtml(w.name) +
        (owedW == null ? '' : Math.abs(diff) < 1 ? ' <span class="inv-dot inv-dot-ok">as the slip</span>'
          : ' <span class="inv-dot inv-dot-danger">slip ' + escHtml(formatCurrency(owedW)) + ', ' + (diff > 0 ? 'over' : 'short') + ' ' + escHtml(formatCurrency(Math.abs(diff))) + '</span>') +
        '</span><span class="inv-row-end inv-num">' + formatCurrency(e.named[id]) + '</span></div>';
    });
    if (named.length && !slip) h += '<div class="inv-row"><span class="inv-row-main inv-row-meta">No payroll as paid for ' + escHtml(billsMonthLabel(bankPrevMonth(m + '-01'))) + ' to set these against.</span></div>';
    if (e.cash) h += '<div class="inv-row"><span class="inv-row-main">Cash drawn</span><span class="inv-row-end inv-num">' + formatCurrency(e.cash) + '</span></div>';
    // A month is its heading and its rows, each a flat row of its own: held back together.
    return { parts: h.split(/(?=<div class="inv-row)/) };
  }), { n: 3, noun: 'months' });
  var weeks = {};
  wages.forEach(function(v) { if (v.cash || v.staffId == null) { var ws = attWeekStartOf(v.row.date); weeks[ws] = gstRound((weeks[ws] || 0) + v.row.dr); } });
  var wk = Object.keys(weeks).sort().reverse().slice(0, 12);
  if (wk.length) {
    h += '<div class="inv-row inv-row-group"><span class="inv-row-main">Cash by pay week, against the weekly payout</span></div>';
    h += uiMoreHtml('pay-wages-weeks', wk.map(function(ws) {
      var pw = payWeek(ws), d = gstRound(weeks[ws] - pw.total);
      return '<div class="inv-row inv-row-2" data-cashweek="' + ws + '"><span class="inv-row-main"><span class="inv-row-title">Week to ' + escHtml(formatDate(pw.sat)) + '</span>' +
        '<span class="inv-row-meta">' + (bankCashWeekKnown(pw) ? 'payout ' + escHtml(formatCurrency(pw.total)) + ' · ' + (d >= 0 ? escHtml(formatCurrency(d)) + ' past it: drawings' : 'drawn ' + escHtml(formatCurrency(-d)) + ' less than the payout')
          : 'payout not fully recorded: wages or drawings') + '</span></span>' +
        '<span class="inv-row-end inv-num">' + formatCurrency(weeks[ws]) + '</span></div>';
    }), { n: 4, noun: 'weeks' });
  }
  // Folded to its head, which says the latest month and whether any leg is off its slip (open when one is).
  return uiFoldHtml('pay-bank-wages', '<span class="inv-row-main"><span class="inv-row-title inv-row-strong">Wages paid, from the bank</span><span class="inv-row-meta">' + sum + '</span></span>',
    h, off > 0, ' id="payBankWages"');
}

/* ---------- Doing ---------- */
function finLinkAction(action, btn) {
  switch (action) {
    case 'invFinGo': {
      var go = finGo(btn.dataset.tab || 'overview');
      if (btn.dataset.client) go.client = btn.dataset.client;
      if (btn.dataset.anchor) go.anchor = btn.dataset.anchor;
      todoGo(go);
      return true;
    }
    case 'invHomeImportBank': finSetTab('bank'); switchTab('pageFinance'); bankImportFile(); return true;
    case 'invGoPay': _attView = 'pay'; switchTab('pageStaff'); return true;
    case 'invGoBills': finSetTab('bills'); renderFinance(); return true;
    case 'invGoStock': _stockView = 'list'; switchTab('pageStock'); return true;
  }
  return false;
}
