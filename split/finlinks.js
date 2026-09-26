/* ===== FINANCE, LINKED INTO EVERY SCREEN =====
 * docs/FINANCE_INTELLIGENCE_SPEC.md, Phase 6. Each screen carries the finance fact that belongs to it —
 * what a client owes and how fast it pays, whether an invoice is paid, what a supplier was paid — as a
 * link into Finance, never as a second copy of the arithmetic. Every figure here is read from the
 * functions Finance itself uses (bankReceivables, bankDaysToPay, finForecast), once per task via finCtx().
 * With no statement imported, each screen says nothing rather than a zero.
 */

function finHasBank() { return bankData().rows.length > 0; }

/* ---------- A client ---------- */
function finClientMoney(clientId) {
  if (!finHasBank()) return null;
  var ctx = finCtx(), r = ctx.recv().find(function(x) { return String(x.client.id) === String(clientId); });
  var last = null;
  ctx.cls.forEach(function(v) { if (v.cat === 'receipt' && v.clientId != null && String(v.clientId) === String(clientId) && v.row.cr > 0) last = v.row; });
  return { r: r || null, dtp: bankDaysToPay(clientId, bankPayHistory(ctx.recv())), series: bankChequeSeries(ctx.cls)[String(clientId)] || [], last: last,
    bands: r ? finAgeing([r]) : null, from: ctx.rows[0].date };
}
/* One panel, drawn on the client's detail, its edit sheet and its Performance view. */
function finClientMoneyHtml(clientId) {
  var m = finClientMoney(clientId);
  if (!m) return '';
  var h = '<div class="inv-panel inv-panel-flush" data-client-money="' + escHtml(String(clientId)) + '"><div class="inv-panel-head"><span class="inv-panel-title">Money</span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="receipts" data-client="' + escHtml(String(clientId)) + '">Open in Finance</button></div>';
  if (!m.r) return h + '<div class="inv-empty">Nothing invoiced or received since ' + escHtml(formatDate(m.from)) + ', the statement’s first day.</div></div>';
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
  if (!finHasBank() || !inv || inv.status !== 'active') return null;
  var ctx = finCtx(), from = ctx.rows[0].date;
  if (inv.date < from) return { before: from };
  var r = ctx.recv().find(function(x) { return String(x.client.id) === String(inv.clientId); });
  if (!r) return null;
  var label = inv.displayNumber || inv.invoiceNumber, paid = [];
  r.allocs.forEach(function(a) {
    a.parts.forEach(function(p) { if (p.inv && p.label === label) paid.push({ date: a.v.row.date, amount: p.amount, how: a.how, chq: bankInstrument(a.v.row) }); });
  });
  var open = r.open.find(function(o) { return o.inv && o.inv.id === inv.id; });
  return { paid: paid, open: open ? gstRound(open.due) : 0, days: todoDaysBetween(inv.date, localDateStr()) };
}
function finInvoicePaymentHtml(inv) {
  var p = finInvoicePayment(inv);
  if (!p) return '';
  var h = '<div class="inv-row-group" data-inv-payment><span>Payment</span><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="receipts" data-client="' + escHtml(String(inv.clientId)) + '">Open in Finance</button></div>';
  if (p.before) return h + '<div class="inv-row"><span class="inv-row-main inv-row-meta">Dated before the statement’s first day, ' + escHtml(formatDate(p.before)) + ': its payment is not read.</span></div>';
  p.paid.forEach(function(x) {
    h += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title"><span class="inv-dot inv-dot-' + (x.how === 'exact' ? 'ok' : 'info') + '">' + (x.how === 'exact' ? 'Paid, exact' : 'Paid, oldest first') + '</span></span>' +
      '<span class="inv-row-meta">' + escHtml(formatDate(x.date)) + (x.chq ? ' · chq ' + escHtml(x.chq) : '') + '</span></span><span class="inv-row-end inv-num">' + escHtml(formatCurrency(x.amount)) + '</span></div>';
  });
  if (p.open > 0.005) h += '<div class="inv-row"><span class="inv-row-main"><span class="inv-dot inv-dot-' + (p.days > 90 ? 'danger' : p.days > 60 ? 'warning' : 'neutral') + '">Open, ' + p.days + ' days</span></span><span class="inv-row-end inv-num">' + escHtml(formatCurrency(p.open)) + '</span></div>';
  return h;
}

/* ---------- A supplier ---------- */
/* Payments on the statement set to Supplier whose payee (or narration) carries the supplier's name. */
function finSupplierPaid(name) {
  if (!name || !finHasBank()) return null;
  var k = bankKey(name);
  if (!k || k.length < 4) return null;
  var out = { paid: 0, n: 0, last: null };
  finCtx().cls.forEach(function(v) {
    if (!(v.row.dr > 0) || v.cat !== 'supplier') return;
    // The payee where the narration names one, else the narration itself; the supplier's name anywhere in it.
    var pk = bankKey(v.party || '') || bankKey(v.row.narration || '');
    if (!pk || !(pk.indexOf(k) >= 0 || (pk.length >= 4 && k.indexOf(pk) === 0))) return;
    out.paid = gstRound(out.paid + v.row.dr); out.n++; out.last = v.row;
  });
  return out.n ? out : null;
}

/* ---------- Home ---------- */
function renderFinHomeCard() {
  var el = document.getElementById('homeFinCard');
  if (!el) return;
  var h = '<div class="inv-panel inv-panel-flush" id="homeFin"><div class="inv-panel-head"><span class="inv-panel-title">Money</span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invHomeImportBank">Import statement</button></div>';
  if (!finHasBank()) { el.innerHTML = h + '<div class="inv-empty">No bank statement yet. Import the bank’s .xls to see the balance, what is owed and the forecast.</div></div>'; return; }
  var rows = bankRows(), last = rows[rows.length - 1], recv = finCtx().recv(), fc = finForecast(45);
  var owed = recv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0);
  var book = bankBookDaysToPay(bankPayHistory(recv));
  var loose = finCtx().cls.filter(function(v) { return v.cat === 'receipt' && v.clientId == null && v.row.cr > 0; }).length;
  var age = todoDaysBetween(last.date, localDateStr());
  var tile = function(tab, anchor, label, value, sub, tone) {
    return '<button class="inv-tile' + (tone ? ' inv-tile-' + tone : '') + '" data-action="invFinGo" data-tab="' + tab + '"' + (anchor ? ' data-anchor="' + anchor + '"' : '') + ' data-home-fin="' + label + '">' +
      '<div class="inv-tile-label">' + label + '</div><div class="inv-tile-value inv-tile-value-sm inv-num inv-nowrap" title="' + escHtml(formatCurrency(value)) + '">' + finRs(value) + '</div><div class="inv-tile-sub">' + sub + '</div></button>';
  };
  h += '<div class="inv-tiles inv-tiles-flush">' +
    tile('bank', '', 'Balance', last.balance, 'on ' + escHtml(finShortDate(last.date)) + (age > 7 ? ', ' + age + ' days ago' : ''), last.balance < 0 ? 'danger' : age > 7 ? 'warning' : '') +
    tile('receipts', loose ? 'bankLoose' : '', 'Owed to us', owed, loose ? loose + ' receipt' + (loose === 1 ? '' : 's') + ' not placed' : 'since ' + escHtml(finShortDate(rows[0].date)), loose ? 'warning' : '') +
    (book && book.median != null ? '<button class="inv-tile" data-action="invFinGo" data-tab="receipts" data-home-fin="Pays in"><div class="inv-tile-label">Pays in</div>' +
      '<div class="inv-tile-value inv-tile-value-sm inv-num">' + Math.round(book.median) + ' days</div><div class="inv-tile-sub">the book, invoice to receipt</div></button>' : '') +
    tile('overview', 'finForecast', 'Runway', fc ? fc.min.bal : last.balance, fc && fc.cross ? 'below zero on ' + escHtml(finShortDate(fc.cross)) : fc ? 'lowest in 45 days, ' + escHtml(finShortDate(fc.min.date)) : '', fc && fc.cross ? 'danger' : '') +
    '</div>';
  el.innerHTML = h + '</div>';
}

/* ---------- Wages: the bank's legs beside the payroll, on Finance → Payments and on Staff → Pay ---------- */
function finWagesHtml(cls, where) {
  var wages = cls.filter(function(v) { return v.cat === 'wages' && v.row.dr > 0; });
  var byMonth = {};
  wages.forEach(function(v) {
    var m = v.row.date.slice(0, 7), e = byMonth[m] = byMonth[m] || { named: {}, cash: 0, total: 0 };
    e.total = gstRound(e.total + v.row.dr);
    if (v.cash || v.staffId == null) e.cash = gstRound(e.cash + v.row.dr);
    else { var k = String(v.staffId); e.named[k] = gstRound((e.named[k] || 0) + v.row.dr); }
  });
  var link = where === 'pay' ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="payments" data-anchor="bankWages">Open in Finance</button>'
    : '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invGoPay">Open Staff &rarr; Pay</button>';
  var h = '<div class="inv-panel inv-panel-flush" id="' + (where === 'pay' ? 'payBankWages' : 'bankWages') + '"><div class="inv-panel-head"><span class="inv-panel-title">Wages paid, from the bank</span>' + link + '</div>' +
    '<div class="inv-panel-body inv-note">Every cash draw (SELF, TO SELF, TO CASH) counts as wages unless a row is set otherwise. Transfers to a hand on the roster are set against the payroll as paid for the month before; cash is set against the weekly payout.</div>';
  var months = Object.keys(byMonth).sort().reverse();
  if (!months.length) h += '<div class="inv-empty">No wages on the statement.</div>';
  months.forEach(function(m) {
    var e = byMonth[m], slip = payrollPaidFor(bankPrevMonth(m + '-01')), named = Object.keys(e.named);
    h += '<div class="inv-row inv-row-group"><span class="inv-row-main">Paid in ' + escHtml(billsMonthLabel(m)) + '</span><span class="inv-row-end inv-num">' + formatCurrency(e.total) + '</span></div>';
    named.forEach(function(id) {
      var w = (S.staff || []).find(function(x) { return String(x.id) === id; }) || { name: '?' };
      var row = slip ? slip.rows.find(function(r) { var pw = payrollWorker(r); return pw && String(pw.id) === id; }) : null;
      var owedW = row ? gstRound(row.paid != null ? Number(row.paid) : (Number(row.dayPay) || 0) + (Number(row.ot) || 0)) : null;
      var diff = owedW == null ? null : gstRound(e.named[id] - owedW);
      h += '<div class="inv-row" data-wage="' + escHtml(m + ':' + id) + '"><span class="inv-row-main">' + escHtml(w.name) +
        (owedW == null ? '' : Math.abs(diff) < 1 ? ' <span class="inv-dot inv-dot-ok">as the slip</span>'
          : ' <span class="inv-dot inv-dot-danger">slip ' + escHtml(formatCurrency(owedW)) + ', ' + (diff > 0 ? 'over' : 'short') + ' ' + escHtml(formatCurrency(Math.abs(diff))) + '</span>') +
        '</span><span class="inv-row-end inv-num">' + formatCurrency(e.named[id]) + '</span></div>';
    });
    if (named.length && !slip) h += '<div class="inv-row"><span class="inv-row-main inv-row-meta">No payroll as paid for ' + escHtml(billsMonthLabel(bankPrevMonth(m + '-01'))) + ' to set these against.</span></div>';
    if (e.cash) h += '<div class="inv-row"><span class="inv-row-main">Cash drawn</span><span class="inv-row-end inv-num">' + formatCurrency(e.cash) + '</span></div>';
  });
  var weeks = {};
  wages.forEach(function(v) { if (v.cash || v.staffId == null) { var ws = attWeekStartOf(v.row.date); weeks[ws] = gstRound((weeks[ws] || 0) + v.row.dr); } });
  var wk = Object.keys(weeks).sort().reverse().slice(0, 12);
  if (wk.length) {
    h += '<div class="inv-row inv-row-group"><span class="inv-row-main">Cash by pay week, against the weekly payout</span></div>';
    wk.forEach(function(ws) {
      var pw = payWeek(ws), d = gstRound(weeks[ws] - pw.total);
      h += '<div class="inv-row inv-row-2" data-cashweek="' + ws + '"><span class="inv-row-main"><span class="inv-row-title">Week to ' + escHtml(formatDate(pw.sat)) + '</span>' +
        '<span class="inv-row-meta">payout ' + escHtml(formatCurrency(pw.total)) + (pw.recordedDays ? '' : ' (no attendance recorded)') + ' · ' + (d >= 0 ? 'drawn ' + formatCurrency(d) + ' more' : 'drawn ' + formatCurrency(-d) + ' less') + '</span></span>' +
        '<span class="inv-row-end inv-num">' + formatCurrency(weeks[ws]) + '</span></div>';
    });
  }
  return h + '</div>';
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
