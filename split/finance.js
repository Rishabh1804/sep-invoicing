/* ===== FINANCE (Money on the phone bar and the rail) =====
 * The money side of the shop in one place (owner, 26 Sep 2026: "The entire finance sector of our
 * app needs a dashboard"). Its row is five (the tab map, TM3a): the Overview that reads across the rest, Receivables (what
 * clients owe and the cheques in hand), Payments (money going out, and the bills it pays: electricity and other), Bank (the
 * statement itself) and GST. Credit notes are Office → Invoices' (the Credit notes dialog).
 * Every figure says what it rests on. A dashboard that reads a statement which stops on 18 Sep says
 * so, rather than passing an old balance off as today's.
 */

var FIN_TABS = [['overview', 'Overview'], ['receipts', 'Receivables'], ['payments', 'Payments'], ['bank', 'Bank'], ['gst', 'GST']];
/* A tab another build had: Bills & notes split into Payments (the bills) and Invoices (the notes), TM3a. The redirect table
   (nav.js) says the same for an address. */
function finTabOf(t) { return t === 'bills' ? 'payments' : t; }
var _finTab = (function() { try { var t = finTabOf(localStorage.getItem('sep_inv_fin_tab')); return FIN_TABS.some(function(x) { return x[0] === t; }) ? t : 'overview'; } catch (e) { return 'overview'; } })();
var _finTabMoved = false;   // another tab was chosen: the next render is a navigation and starts at the top
var _finGstEdit = null;   // the month whose GST note is open
var _finMonth = null;   // the month "where money went" reads; null = the latest with a statement row
var _finCat = null;     // the outflow category the pie has open
// The horizon every Overview panel reads; a per-device convenience, like the open tab.
var _finRange = (function() { try { var r = localStorage.getItem('sep_inv_fin_range'); return CHART_RANGES.some(function(x) { return x[0] === r; }) ? r : '6M'; } catch (e) { return '6M'; } })();

function finSetTab(t) {
  t = finTabOf(t);
  if (!FIN_TABS.some(function(x) { return x[0] === t; })) t = 'overview';
  if (t !== _finTab) _finTabMoved = true;
  _finTab = t;
  try { localStorage.setItem('sep_inv_fin_tab', t); } catch (e) { /* a per-device convenience only */ }
}

function renderFinance() {
  var el = document.getElementById('financeContent');
  if (!el) return;
  var looseN = bankData().rows.length ? bankLooseReceipts(bankClassify()).length : 0;
  var tab = function(k, l) { return '<button class="inv-viewtab" role="tab" aria-selected="' + (_finTab === k) + '" data-action="invFinTab" data-tab="' + k + '">' + l +
    (k === 'receipts' && looseN ? ' <span class="inv-badge inv-badge-warning" title="Receipts with no client">' + looseN + '</span>' : '') + '</button>'; };
  var h = '<div class="inv-viewtabs" role="tablist" aria-label="Finance">' + FIN_TABS.map(function(t) { return tab(t[0], t[1]); }).join('') + '</div>' +
    '<input type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" id="bankFileInput" class="inv-hidden">';
  if (_finTab === 'gst') h += finGstTabHtml();
  else if (_finTab === 'overview') h += finOverviewHtml();
  else h += renderBank(_finTab);
  paneScrollKeep(function() { el.innerHTML = h; });
  // The tab row may overflow a phone's width; the one open is brought into view by scrolling the row sideways. Never
  // scrollIntoView: with the tabs above the screen it scrolled the page back to them on every client picked (P79).
  viewTabReveal(el.querySelector('.inv-viewtabs'));
  if (_finTabMoved) { _finTabMoved = false; viewTop(); }
}

/* The overview is read at a glance: whole rupees, rounded half away from zero on the figure as written (HR-8's way:
   Math.round took −₹1,234.50 to −₹1,234 and ₹1,234.50 to ₹1,235). Every tab behind it keeps the paise. */
function finRs(v) { var n = gstRound(v, 0); return (n < 0 ? '-' : '') + '₹' + Math.abs(n).toLocaleString('en-IN'); }

/* ---------- Months ---------- */
/* The last n months, this one included, oldest first. */
function finMonths(n) { return insMonthsBack(n - 1).concat([localDateStr().slice(0, 7)]); }

/* ---------- Cash ---------- */
/* Per month on the statement: money in, money out, and the balance the month closed on. */
function finCashByMonth(rows) {
  var out = {};
  rows.forEach(function(r) {
    var m = insMonthKey(r.date), e = out[m] = out[m] || { month: m, cr: 0, dr: 0, close: null };
    e.cr = gstRound(e.cr + r.cr); e.dr = gstRound(e.dr + r.dr); e.close = r.balance;
  });
  return Object.keys(out).sort().map(function(k) { return out[k]; });
}

/* ---------- Owed ---------- */
var FIN_AGE_BANDS = [[0, 30, '0–30 days'], [31, 60, '31–60 days'], [61, 90, '61–90 days'], [91, Infinity, 'Over 90 days']];
function finAgeing(recv) {
  var bands = FIN_AGE_BANDS.map(function(b) { return { label: b[2], lo: b[0], hi: b[1], amount: 0, n: 0 }; });
  recv.forEach(function(r) {
    r.open.forEach(function(o) {
      // An invoice dated ahead of today (raised for tomorrow's despatch) is not yet owed at all, never "over 90".
      var age = Math.max(0, isoDaysBetween(o.date, localDateStr())), b = bands.find(function(x) { return age >= x.lo && age <= x.hi; }) || bands[bands.length - 1];
      b.amount = gstRound(b.amount + o.due); b.n++;
    });
  });
  return bands;
}

/* ---------- GST ---------- */
/* Output tax per month on the invoices (active, by invoice date) less the tax on credit notes (not
   cancelled, by note date), set against the GST paid through the bank the month after — a
   month's return is paid by the 20th of the next. What is paid in cash is output tax LESS input
   credit, so paying less than is due is the normal shape, not a shortfall by itself. */
function finGstByMonth(months, cls) {
  var due = {}, paid = {}, paidRows = {};
  months.forEach(function(m) { due[m] = 0; paid[m] = 0; paidRows[m] = []; });
  (S.invoices || []).forEach(function(i) {
    var m = i.date ? insMonthKey(i.date) : '';
    if (i.status === 'active' && m in due) due[m] = gstRound(due[m] + (i.cgstAmt || 0) + (i.sgstAmt || 0) + (i.igstAmt || 0));
  });
  getCreditNotes().forEach(function(n) {
    var m = n.date ? insMonthKey(n.date) : '';
    if (n.status !== 'cancelled' && m in due) due[m] = gstRound(due[m] - ((n.cgstAmt || 0) + (n.sgstAmt || 0) + (n.igstAmt || 0)));
  });
  (cls || []).forEach(function(v) {
    if (v.cat !== 'gst' || !(v.row.dr > 0)) return;
    var m = bankPrevMonth(v.row.date);
    if (m in paid) { paid[m] = gstRound(paid[m] + v.row.dr); paidRows[m].push(v.row); }
  });
  var today = localDateStr(), notes = bankData().gstNotes, cover = bankCover();
  return months.map(function(m) {
    var next = bankNextMonth(m), dueBy = next + '-20', n = notes[m] || null;
    // A return paid another way (owner, 26 Sep 2026: July went by another route) is recorded by hand
    // and counts as paid, but is never shown as what the bank saw.
    var other = n && Number(n.paidOther) > 0 ? gstRound(Number(n.paidOther)) : 0;
    return { month: m, due: due[m], paidBank: paid[m], paidOther: other, paid: gstRound(paid[m] + other), rows: paidRows[m], note: n,
      dueBy: dueBy, open: today <= dueBy || m >= today.slice(0, 7),
      // Whether the statement could show the payment at all: the month after, from its first day to the due date.
      seen: !!cover && cover.from <= next + '-01' && cover.to >= dueBy };
  });
}
/* One reading of a month, shared by the table and the tile. */
function finGstStatus(r) {
  if (r.paidBank > 0) return { tone: 'ok', text: 'Paid ' + stockShortDate(r.rows[r.rows.length - 1].date) };
  if (r.paidOther > 0) return { tone: 'info', text: 'Outside bank', title: 'Paid another way' + (r.note && r.note.via ? ' via ' + r.note.via : '') };
  if (r.note) return { tone: 'neutral', text: 'Noted', title: r.note.note };
  if (r.due <= 0) return { tone: 'neutral', text: 'Nil' };
  if (r.open) return { tone: 'info', text: 'Due ' + stockShortDate(r.dueBy) };
  // A month the statement does not reach says nothing either way: unknown is not unpaid.
  if (!r.seen) return { tone: 'neutral', text: 'No statement', title: 'The bank statement does not cover the days this was due by' };
  // Only the bank is read: a return paid another way is not on the statement, so this says what is known.
  return { tone: 'warning', text: 'Not in bank', title: 'No GST payment on the statement for this month; one made another way would not show here', missing: true };
}

/* A month's GST status, a dot and a word. A note is possible for any month the bank shows no payment for, not only once it
   is overdue, and the month's own row opens it (a separate "Add note" beside the status did not fit a phone). */
function finGstNoteOk(r) { return !!(r.note || (r.due > 0 && !r.paidBank)); }
function finGstDotHtml(r) {
  var st = finGstStatus(r);
  return '<span class="inv-dot inv-dot-' + st.tone + '"' + (st.title ? ' title="' + escHtml(st.title) + '"' : '') + '>' + escHtml(st.text) + '</span>';
}
function finGstNoteLine(r) {
  return !r.note ? '' : r.note.note + (r.paidOther ? ', ' + formatCurrency(r.paidOther) + ' paid' + (r.note.paidOn ? ' on ' + formatDate(r.note.paidOn) : '') + (r.note.via ? ' via ' + r.note.via : '') : '');
}
/* The months, newest first: a table on the desktop; on the phone a row a month, its status a dot and a word, due and paid at
   its end (the table's status column was cut at 393 px: the tab map, TM3c). */
function finGstListHtml(rows) {
  if (_isDesktop) {
    var t = '<div class="inv-scroll"><table class="inv-table"><thead><tr><th>Month</th><th class="inv-num">Due</th><th class="inv-num">Paid</th><th>Status</th></tr></thead><tbody>';
    rows.forEach(function(r) {
      t += '<tr data-gst="' + r.month + '"><td class="inv-nowrap">' + escHtml(billsMonthLabel(r.month)) + '</td><td class="inv-num">' + formatCurrency(r.due) + '</td>' +
        '<td class="inv-num">' + (r.paid ? formatCurrency(r.paid) : '&mdash;') + '</td><td>' +
        (finGstNoteOk(r) ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGstNote" data-month="' + r.month + '" title="' + (r.note ? 'Edit the note' : 'Add a note') + '">' + finGstDotHtml(r) + '</button>' : finGstDotHtml(r)) +
        '</td></tr>';
      if (r.note) t += '<tr class="inv-row-note" data-gst-note="' + r.month + '"><td colspan="4"><span class="inv-row-meta">' + escHtml(finGstNoteLine(r)) + '</span></td></tr>';
    });
    return t + '</tbody></table></div>';
  }
  // The latest six, the rest one tap away (a long list shows its first rows, UX overhaul 2 step 6); the verdict covers all twelve.
  return uiMoreHtml('fin-gst', rows.map(function(r) {
    var main = '<span class="inv-row-title">' + escHtml(billsMonthLabel(r.month)) + '</span><span class="inv-row-meta">' + finGstDotHtml(r) +
      (r.note ? ' <span data-gst-note="' + r.month + '">' + escHtml(finGstNoteLine(r)) + '</span>' : '') + '</span>';
    return '<div class="inv-row inv-row-2" data-gst="' + r.month + '">' +
      (finGstNoteOk(r) ? '<button class="inv-row-main" data-action="invFinGstNote" data-month="' + r.month + '" title="' + (r.note ? 'Edit the note' : 'Add a note') + '">' + main + '</button>'
        : '<span class="inv-row-main">' + main + '</span>') +
      '<span class="inv-row-end inv-row-end-stack"><span class="inv-num">' + formatCurrency(r.due) + '</span><span class="inv-row-meta inv-num">' +
      (r.paid ? 'paid ' + formatCurrency(r.paid) : 'not paid') + '</span></span></div>';
  }), { n: 6, noun: 'months' });
}
/* GST's verdict card (§6.28): the last closed month (its due, by when, or paid), and the months the statement shows no payment
   for. `rows` newest first. */
function finGstVerdictHtml(rows) {
  var thisMonth = localDateStr().slice(0, 7), last = rows.find(function(r) { return r.month < thisMonth; }) || rows[0];
  if (!last) return uiVerdictHtml({ screen: 'GST', verdict: 'Nothing invoiced yet', tone: 'neutral', attrs: ' id="finGstVerdict"' });
  var mon = function(ym) { return TREND_MONTH_LABELS[parseInt(ym.slice(5, 7), 10) - 1]; };
  var st = finGstStatus(last), missing = rows.filter(function(r) { return finGstStatus(r).missing; });
  var said = last.due <= 0 ? ' nil' : last.paidBank > 0 ? ' paid ' + stockShortDate(last.rows[last.rows.length - 1].date) : last.paidOther > 0 ? ' paid outside the bank'
    : last.note ? ' noted' : last.open ? ' ' + finRs(last.due) + ' due by ' + stockShortDate(last.dueBy) : ' ' + st.text.toLowerCase();
  var gone = missing.length === 1 ? mon(missing[0].month) + ' not in the bank' : missing.length ? missing.length + ' months not in the bank' : '';
  var verdict = mon(last.month) + said + (gone ? ' · ' + gone : '');
  var plain = mon(last.month) + (last.paid > 0 ? ' paid' : last.open ? ' due by ' + stockShortDate(last.dueBy) : ' ' + st.text.toLowerCase()) + (gone ? ' · ' + gone : '');
  var sum = function(k) { return gstRound(rows.reduce(function(t, r) { return t + (r[k] || 0); }, 0)); };
  var noted = rows.filter(function(r) { return r.note; }).length;
  return uiVerdictHtml({ screen: 'GST · 12 months', verdict: verdict, plain: plain, money: true,
    tone: missing.length ? 'warning' : st.missing ? 'warning' : last.open && !last.paid && last.due > 0 ? 'info' : 'ok',
    fig: escHtml(finRs(last.due)), facts: [billsMonthLabel(last.month), last.paid > 0 ? 'paid ' + finRs(last.paid) : last.open ? 'due by ' + formatDate(last.dueBy) : st.text],
    factors: [
      { label: 'Due', fig: escHtml(finRs(sum('due'))), sub: 'output tax less notes', money: true },
      { label: 'Paid', fig: escHtml(finRs(sum('paid'))), sub: 'the bank and outside it', money: true },
      { label: 'Not in the bank', fig: String(missing.length), tone: missing.length ? 'warning' : 'ok', sub: missing.length ? missing.map(function(r) { return mon(r.month); }).join(', ') : 'none' },
      { label: 'Noted', fig: String(noted), sub: 'a month paid another way' }],
    attrs: ' id="finGstVerdict"' });
}
/* Money → GST (a work screen, §3e): the verdict card, then the months. */
function finGstTabHtml() {
  var rows = finGstByMonth(finMonths(12), bankClassify()).reverse();
  return finGstVerdictHtml(rows) +
    // What due and paid mean is the bank guide's (kbguides.js).
    '<div class="inv-panel inv-panel-flush" id="finGst"><div class="inv-panel-head"><span class="inv-panel-title">GST due and paid</span><span class="inv-panel-count">12 months</span></div>' +
    (_finGstEdit ? finGstNoteFormHtml(_finGstEdit) : '') + finGstListHtml(rows) + '</div>';
}

/* ---------- The overview ----------
   An overview (the tab map, §3e, TM3c): the range in its head, then a hero a subject, each folding to its line on the phone,
   the first carrying the verdict: cash, what is owed, GST, what went out. The tiles that led the page went into them; the
   charts follow, each a fold, shut on the phone. */
/* A hero's figure in whole rupees, its exact amount in its title (the Overview reads at a glance; every tab keeps the paise). */
function finHeroFig(v, tone) { return '<span title="' + escHtml(formatCurrency(v)) + '">' + figHtml(escHtml(finRs(v)), tone || null) + '</span>'; }
function finCashHeroHtml(rows, months) {
  var tile = ' data-card="fin-cash" data-fin-tile="balance" data-verdict';
  if (!rows.length) {
    return uiHeroHtml({ tone: 'neutral', vital: true, eyebrow: '<span>Cash</span>', title: 'No bank statement yet', fig: '&mdash;', sub: 'the balance reads from the statement',
      attrs: tile, foot: '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invBankImport">Import the statement</button>' });
  }
  var last = rows[rows.length - 1], stale = isoDaysBetween(last.date, localDateStr()), fc = finForecast(60), held = bankChequesHeld();
  var tone = last.balance < 0 || (fc && fc.cross && !fc.noInflow) ? 'danger' : (fc && fc.cross) || stale > 7 ? 'warning' : 'ok';
  var title = last.balance < 0 ? 'Overdrawn on the statement' : fc && fc.cross ? 'Below zero on ' + stockShortDate(fc.cross) + (fc.noInflow ? ', outflows only' : '')
    : fc ? 'Lowest ' + finRs(fc.min.bal) + ' in 60 days' : 'In the bank';
  var sub = ['on ' + stockShortDate(last.date) + (stale > 7 ? ', ' + stale + ' days old' : ''), held.n ? '+ ' + finRs(held.amount) + ' in cheques in hand' : ''].filter(Boolean).join(' · ');
  var at = function(n) { return fc && fc.days.length ? fc.days[Math.min(n, fc.days.length) - 1] : null; };
  var only = fc && fc.noInflow ? 'outflows only' : '';
  var facts = [
    { label: 'In the bank', value: finRs(last.balance), sub: 'on ' + formatDate(last.date), attrs: ' data-fc="Now"' },
    held.n ? { label: 'Cheques in hand', value: finRs(held.amount), sub: todoPlural(held.n, 'cheque') + ' not yet in the bank', attrs: ' data-fc="Held"' } : null,
    fc ? { label: 'Lowest in 60 days', value: finRs(fc.min.bal), sub: [only, 'on ' + formatDate(fc.min.date)].filter(Boolean).join(', '), attrs: ' data-fc="Lowest"' } : null,
    at(30) ? { label: 'In 30 days', value: finRs(at(30).bal), sub: only || 'P25–P75 ' + finRs(at(30).lo) + ' to ' + finRs(at(30).hi), attrs: ' data-fc="In 30 days"' } : null,
    at(60) ? { label: 'In 60 days', value: finRs(at(60).bal), sub: only || 'P25–P75 ' + finRs(at(60).lo) + ' to ' + finRs(at(60).hi), attrs: ' data-fc="In 60 days"' } : null
  ].filter(Boolean);
  var sm = months.slice(-6);
  return uiHeroHtml({ tone: tone, vital: true, eyebrow: '<span>Cash</span>', title: escHtml(title),
    fig: finHeroFig(last.balance, last.balance < 0 ? 'danger' : null), sub: escHtml(sub),
    viz: chartSpark(sm.map(function(m) { return m.close; }), { labels: sm.map(function(m) { return insMonthLabel(m.month); }), title: 'Closing balance by month' }),
    body: '<div class="inv-hero-sheet">' + facts.map(uiFactRowHtml).join('') + '</div>', fold: 'fin-hero-cash', open: false, attrs: tile,
    foot: '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="bank">Open the statement</button>' });
}
function finOwedHeroHtml(rows, cls, recv) {
  var tile = ' data-card="fin-owed" data-fin-tile="owed" id="finOwed"';
  var go = '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="receipts">Open Receivables</button>';
  if (!rows.length) return uiHeroHtml({ tone: 'neutral', vital: true, eyebrow: '<span>Owed to us</span>', title: 'Needs a statement', fig: '&mdash;', sub: 'receipts are read from the bank', attrs: tile, foot: go });
  var owed = gstRound(recv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0)), from = bankRecvFrom(rows);
  var bands = finAgeing(recv), old90 = bands[3].amount, old60 = bands[2].amount, loose = bankLooseReceipts(cls, from).length;
  var book = bankBookDaysToPay(bankPayHistory(recv));
  // Never red while a receipt is unplaced: that money may be in already, and the line under it says so (owed90's rule).
  var tone = loose ? 'warning' : old90 > 0 ? 'danger' : old60 > 0 ? 'warning' : 'ok';
  var title = owed < 0.5 ? 'Nothing owed to us' : old90 > 0 ? finRs(old90) + ' owed over 90 days' : old60 > 0 ? finRs(old60) + ' owed over 60 days' : 'Nothing owed over 60 days';
  var sub = loose ? todoPlural(loose, 'receipt') + ' not placed: reads high' : book && book.median != null ? 'clients pay in ' + Math.round(book.median) + ' days' : 'since ' + stockShortDate(from);
  var payHist = bankPayHistory(recv), top = recv.filter(function(r) { return r.owed > 0.005; }).slice(0, 5);
  var body = top.map(function(r) {
    var dtp = bankDaysToPay(r.client.id, payHist);
    return '<div class="inv-row inv-row-2" data-debtor="' + escHtml(String(r.client.id)) + '"><button class="inv-row-main" data-action="invFinClient" data-id="' + escHtml(String(r.client.id)) + '">' +
      '<span class="inv-row-title">' + escHtml(r.client.name) + '</span><span class="inv-row-meta">' + (r.oldestDays != null ? 'oldest ' + r.oldestDays + ' d' : r.open.length + ' open') +
      (dtp && dtp.median != null ? ' · pays in ' + figHtml(Math.round(dtp.median) + ' d', figTonePaysIn(dtp.median)) : '') + '</span></button>' +
      '<span class="inv-row-end inv-num">' + figHtml(formatCurrency(r.owed), figToneAge(r.oldestDays)) + '</span></div>';
  }).join('');
  if (!top.length) body = '<div class="inv-empty">Nothing owed since ' + escHtml(formatDate(from)) + '.</div>';
  if (loose) body += '<div class="inv-row" data-fin-loose><span class="inv-row-main inv-row-meta">' + todoPlural(loose, 'receipt') + ' with no client: what is owed reads high</span>' +
    '<span class="inv-row-end"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinLoose">Place them</button></span></div>';
  return uiHeroHtml({ tone: tone, vital: true, eyebrow: '<span>Owed to us</span>', title: escHtml(title), fig: finHeroFig(owed), sub: escHtml(sub),
    viz: owed >= 0.5 ? chartMeter(bands.map(function(b, i) { return { v: b.amount, tone: FIN_AGE_TONE[i] || 'neutral' }; }),
      { title: 'Owed by age: ' + bands.map(function(b) { return b.label + ' ' + finRs(b.amount); }).join(' · ') }) : '',
    body: '<div class="inv-hero-sheet">' + body + '</div>', fold: 'fin-hero-owed', open: false, attrs: tile, foot: go });
}
function finGstHeroHtml(cls) {
  var r = finGstByMonth(insMonthsBack(1), cls)[0], st = finGstStatus(r), six = finGstByMonth(insMonthsBack(5).concat([r.month]).filter(function(m, i, a) { return a.indexOf(m) === i; }).sort(), cls);
  var title = r.due <= 0 ? 'Nothing due for ' + billsMonthLabel(r.month) : r.paidBank > 0 ? 'Paid ' + stockShortDate(r.rows[r.rows.length - 1].date)
    : r.paidOther > 0 ? 'Paid outside the bank' : r.note ? 'Noted' : r.open ? 'Due by ' + stockShortDate(r.dueBy) : st.missing ? 'Not in the bank' : st.text;
  return uiHeroHtml({ tone: r.due <= 0 ? 'neutral' : st.tone === 'neutral' ? 'neutral' : st.tone, vital: true, eyebrow: '<span>GST · ' + escHtml(billsMonthLabel(r.month)) + '</span>',
    title: escHtml(title), fig: finHeroFig(r.due), sub: escHtml(r.paid > 0 ? 'paid ' + finRs(r.paid) : r.open ? 'due ' + formatDate(r.dueBy) : st.text),
    viz: chartSpark(six.map(function(x) { return Math.max(0, x.due); }), { labels: six.map(function(x) { return insMonthLabel(x.month); }), title: 'GST due by month', zero: true }),
    attrs: ' data-card="fin-gst" data-fin-tile="gst"', foot: '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="gst">Open GST</button>' });
}
function finOutHeroHtml(cls, months) {
  var tile = ' data-card="fin-out" data-fin-tile="out"';
  var go = '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="payments">Open Payments</button>';
  var m = months.length ? months[months.length - 1] : null;
  if (!m) return uiHeroHtml({ tone: 'neutral', vital: true, eyebrow: '<span>Paid out</span>', title: 'Needs a statement', fig: '&mdash;', sub: 'payments are read from the bank', attrs: tile, foot: go });
  var byCat = {};
  cls.forEach(function(v) {
    if (!(v.row.dr > 0) || insMonthKey(v.row.date) !== m.month) return;
    var k = bankCatLabel(v.cat) + (v.cash ? ' (cash)' : '');
    byCat[k] = gstRound((byCat[k] || 0) + v.row.dr);
  });
  var cats = Object.keys(byCat).sort(function(a, b) { return byCat[b] - byCat[a]; });
  var sm = months.slice(-6);
  return uiHeroHtml({ tone: 'neutral', vital: true, eyebrow: '<span>Paid out · ' + escHtml(billsMonthLabel(m.month)) + '</span>',
    title: escHtml(cats.length ? 'Most to ' + cats[0].toLowerCase() : 'Nothing paid out'), fig: finHeroFig(m.dr), sub: escHtml(finRs(m.cr) + ' came in'),
    viz: chartSpark(sm.map(function(x) { return x.dr; }), { labels: sm.map(function(x) { return insMonthLabel(x.month); }), title: 'Paid out by month', zero: true }),
    body: '<div class="inv-hero-sheet">' + cats.slice(0, 5).map(function(k) { return uiFactRowHtml({ label: k, value: finRs(byCat[k]), attrs: ' data-went-top="' + escHtml(k) + '"' }); }).join('') + '</div>',
    fold: 'fin-hero-out', open: false, attrs: tile, foot: go });
}
/* GST due against paid over the range, a chart: the months themselves are GST's own (I8). */
function finGstChartHtml(months, cls) {
  var g = finGstByMonth(months, cls);
  return '<div class="inv-panel inv-panel-flush inv-panels-wide" id="finGstChart"><div class="inv-panel-head"><span class="inv-panel-title">GST due and paid</span></div>' +
    '<div class="inv-panel-body">' + chartStack(months.map(function(m) { return insMonthLabel(m) + (months.length > 12 ? " '" + m.slice(2, 4) : ''); }), [
      { label: 'Due', values: g.map(function(r) { return Math.max(0, r.due); }) },
      { label: 'Paid', values: g.map(function(r) { return r.paid; }), tone: 2 }
    ], { mode: 'group', ariaLabel: 'GST due and paid', keys: months }) + '</div>' +
    '<div class="inv-row"><span class="inv-row-main inv-row-meta">Each month’s status and its note</span><span class="inv-row-end">' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="gst">Open GST</button></span></div></div>';
}
function finOverviewHtml() {
  var rows = bankRows(), cls = bankClassify(rows), has = rows.length > 0;
  var recv = has ? bankReceivables(cls) : [];
  var months = finCashByMonth(rows);
  var heroes = '<div class="inv-heroes inv-heroes-4" data-fin-heroes>' + finCashHeroHtml(rows, months) + finOwedHeroHtml(rows, cls, recv) + finGstHeroHtml(cls) + finOutHeroHtml(cls, months) + '</div>';
  var fold = function(key, card) { return uiFoldCard(key, card, !!_isDesktop); };
  if (!has) {
    return heroes + '<div class="inv-panel"><div class="inv-empty">Import the bank statement on the Bank tab. The balance, what clients owe and where money went all read from it; GST due reads from the invoices.</div></div>' +
      fold('fin-gst', finGstChartHtml(finMonths(6), cls));
  }

  // One horizon for every chart below (spec Phase 3): the months the range covers, from the statement and the invoices
  // together, so a month with invoices but no statement row still shows.
  var monthSet = {};
  months.forEach(function(m) { monthSet[m.month] = true; });
  (S.invoices || []).forEach(function(i) { if (i.status === 'active' && i.date && i.date <= localDateStr()) monthSet[insMonthKey(i.date)] = true; });
  var inRange = chartRangeMonths(_finRange, Object.keys(monthSet));
  var byMonth = {};
  months.forEach(function(m) { byMonth[m.month] = m; });
  var lab = function(m) { return insMonthLabel(m) + (inRange.length > 12 ? " '" + m.slice(2, 4) : ''); };
  var h = chartRangeHtml(_finRange, 'invFinRange') + heroes + '<div class="inv-panels inv-panels-3">';

  // Cash: balance, in and out on one axis; a tap on a month moves "where money went" to it.
  var cashMonths = inRange.filter(function(m) { return byMonth[m]; });
  var cash = '<div class="inv-panel inv-panel-flush inv-panels-wide" id="finCash"><div class="inv-panel-head"><span class="inv-panel-title">Cash by month</span></div>' +
    '<div class="inv-panel-body">' + chartLines(cashMonths.map(lab), [
      { label: 'Balance', values: cashMonths.map(function(m) { return byMonth[m].close; }) },
      { label: 'In', values: cashMonths.map(function(m) { return byMonth[m].cr; }), tone: 2 },
      { label: 'Out', values: cashMonths.map(function(m) { return byMonth[m].dr; }), tone: 3 }
    ], { ariaLabel: 'Cash by month', pointAction: 'invFinMonth', keys: cashMonths, emptyText: 'The statement covers under two months of this range' }) + '</div>' +
    '<div class="inv-scroll"><table class="inv-table"><thead><tr><th>Month</th><th class="inv-num">In</th><th class="inv-num">Out</th><th class="inv-num">Closed at</th></tr></thead><tbody>';
  cashMonths.slice().reverse().forEach(function(k) {
    var m = byMonth[k];
    cash += '<tr data-cash="' + m.month + '"><td class="inv-nowrap">' + escHtml(billsMonthLabel(m.month)) + '</td><td class="inv-num" title="' + escHtml(formatCurrency(m.cr)) + '">' + finRs(m.cr) + '</td>' +
      '<td class="inv-num" title="' + escHtml(formatCurrency(m.dr)) + '">' + finRs(m.dr) + '</td><td class="inv-num" title="' + escHtml(formatCurrency(m.close)) + '">' + finRs(m.close) + '</td></tr>';
  });
  h += fold('fin-cash', cash + '</tbody></table></div></div>');

  // The next 60 days, at the pace the statement shows (Phase 5).
  h += fold('fin-forecast', finForecastHtml());

  // Where money went: the range stacked by category, and the chosen month as a pie that filters.
  var catKey = function(v) { return v.cat + (v.cash ? ':cash' : ''); };
  var catLabel = function(k) { var p = k.split(':'); return bankCatLabel(p[0]) + (p[1] ? ' (cash)' : ''); };
  var outByMonthCat = {}, cats = {};
  cls.forEach(function(v) {
    if (!(v.row.dr > 0)) return;
    var m = insMonthKey(v.row.date), k = catKey(v);
    (outByMonthCat[m] = outByMonthCat[m] || {})[k] = gstRound(((outByMonthCat[m] || {})[k] || 0) + v.row.dr);
    if (inRange.indexOf(m) >= 0) cats[k] = gstRound((cats[k] || 0) + v.row.dr);
  });
  // Past the eighth, the smallest categories fold into one series that names them, as the pie folds its tail: the
  // stack used to drop a ninth, and its money with it.
  var catAll = Object.keys(cats).sort(function(a, b) { return cats[b] - cats[a]; });
  var catOrder = catAll.length > CHART_SERIES_MAX ? catAll.slice(0, CHART_SERIES_MAX - 1) : catAll, catTail = catAll.slice(catOrder.length);
  var stackSeries = catOrder.map(function(k) {
    return { label: catLabel(k), values: cashMonths.map(function(m) { return (outByMonthCat[m] || {})[k] || 0; }) };
  });
  if (catTail.length) stackSeries.push({ label: catTail.length + ' others: ' + catTail.map(catLabel).join(', '), tone: 'x',
    values: cashMonths.map(function(m) { return gstRound(catTail.reduce(function(t, k) { return t + ((outByMonthCat[m] || {})[k] || 0); }, 0)); }) });
  var paidMonth = months.length ? months[months.length - 1] : null;
  var ym = _finMonth && byMonth[_finMonth] ? _finMonth : (cashMonths.length ? cashMonths[cashMonths.length - 1] : paidMonth.month);
  var byCat = outByMonthCat[ym] || {};
  var sel = _finCat && byCat[_finCat] ? _finCat : null;
  var invoiced = gstRound((S.invoices || []).reduce(function(s, i) { return s + (i.status === 'active' && i.date && insMonthKey(i.date) === ym ? (i.grandTotal || 0) : 0); }, 0));
  var received = gstRound(cls.reduce(function(s, v) { return s + (v.cat === 'receipt' && insMonthKey(v.row.date) === ym ? v.row.cr : 0); }, 0));
  // The month picker is the panel's first row: a <select> in a fold's head would open and shut the fold too.
  var went = '<div class="inv-panel inv-panel-flush inv-panels-wide" id="finWent"><div class="inv-panel-head"><span class="inv-panel-title">Where money went</span></div>' +
    '<div class="inv-panel-body inv-toolbar"><select class="inv-select inv-select-sm inv-toolbar-item" id="finMonthPick" aria-label="Month">' + months.slice().reverse().map(function(m) {
      return '<option value="' + m.month + '"' + (m.month === ym ? ' selected' : '') + '>' + escHtml(billsMonthLabel(m.month)) + '</option>'; }).join('') + '</select></div>' +
    '<div class="inv-panel-body">' + chartStack(cashMonths.map(lab), stackSeries,
      { action: 'invFinMonth', keys: cashMonths, selected: ym, ariaLabel: 'Outflow by category', readHint: 'Tap a month to read it; the pie below follows' }) + '</div>' +
    // A category keeps its colour in both: one folded into the stack's others takes the others' colour here too.
    '<div class="inv-panel-body">' + chartPieTap(Object.keys(byCat).map(function(k) { var t = catOrder.indexOf(k); return { key: k, label: catLabel(k), value: byCat[k], tone: t >= 0 ? t : catTail.indexOf(k) >= 0 ? 'x' : null }; }),
      { action: 'invFinCat', selected: sel, ariaLabel: 'Outflow in ' + billsMonthLabel(ym), emptyText: 'Nothing paid out in ' + billsMonthLabel(ym), readHint: 'Tap a slice to list its payments' }) + '</div>';
  Object.keys(byCat).sort(function(a, b) { return byCat[b] - byCat[a]; }).forEach(function(k) {
    went += '<div class="inv-row" data-went-cat="' + escHtml(k) + '"><span class="inv-row-main">' + escHtml(catLabel(k)) + '</span><span class="inv-row-end inv-num">' + formatCurrency(byCat[k]) + '</span></div>';
    if (k !== sel) return;
    var list = cls.filter(function(v) { return catKey(v) === k && insMonthKey(v.row.date) === ym && v.row.dr > 0; }).reverse();
    went += '<div class="inv-row-children">';
    list.slice(0, 8).forEach(function(v) {
      went += '<div class="inv-row inv-row-2" data-went-row="' + escHtml(v.row.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(v.party || v.row.narration) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(formatDate(v.row.date)) + '</span></span><span class="inv-row-end inv-num">' + formatCurrency(v.row.dr) + '</span></div>';
    });
    went += '<div class="inv-row"><span class="inv-row-main inv-row-meta">' + todoPlural(list.length, 'payment') + '</span><span class="inv-row-end">' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinStatementCat" data-cat="' + escHtml(k.split(':')[0]) + '">Open in the statement</button></span></div></div>';
  });
  went += [['Invoiced', invoiced, 'incl. GST, by invoice date'], ['Received', received, 'from clients'], ['Paid out', Object.keys(byCat).reduce(function(s, k) { return gstRound(s + byCat[k]); }, 0), 'every category']].map(function(x) {
      return '<div class="inv-row" data-went="' + x[0] + '"><span class="inv-row-main">' + x[0] + ' <span class="inv-row-meta">' + x[2] + '</span></span><span class="inv-row-end inv-num">' + formatCurrency(x[1]) + '</span></div>';
    }).join('') + '</div>';
  h += fold('fin-went', went);

  // Where money came from: receipts by client over the range; unplaced receipts are a wedge of their own, named.
  var from = {};
  cls.forEach(function(v) {
    if (v.cat !== 'receipt' || !(v.row.cr > 0) || inRange.indexOf(insMonthKey(v.row.date)) < 0) return;
    var k = v.clientId == null ? '__loose' : String(v.clientId);
    from[k] = gstRound((from[k] || 0) + v.row.cr);
  });
  h += fold('fin-from', '<div class="inv-panel inv-panel-flush" id="finFrom"><div class="inv-panel-head"><span class="inv-panel-title">Where money came from</span></div>' +
    '<div class="inv-panel-body">' + chartPieTap(Object.keys(from).map(function(k) {
      return { key: k, label: k === '__loose' ? 'Not placed yet' : insClientName(k), value: from[k] };
    }), { action: 'invFinFrom', ariaLabel: 'Receipts by client', emptyText: 'No receipts in this range', readHint: 'Tap a client to open what it owes' }) + '</div></div>');

  // Invoiced against received: the gap between the lines is what the book is lending its clients.
  var invBy = {}, recBy = {};
  (S.invoices || []).forEach(function(i) { if (i.status === 'active' && i.date) invBy[insMonthKey(i.date)] = gstRound((invBy[insMonthKey(i.date)] || 0) + (i.grandTotal || 0)); });
  cls.forEach(function(v) { if (v.cat === 'receipt' && v.row.cr > 0) recBy[insMonthKey(v.row.date)] = gstRound((recBy[insMonthKey(v.row.date)] || 0) + v.row.cr); });
  h += fold('fin-invrec', '<div class="inv-panel inv-panel-flush inv-panels-wide" id="finInvRec"><div class="inv-panel-head"><span class="inv-panel-title">Invoiced against received</span></div>' +
    '<div class="inv-panel-body">' + chartLines(inRange.map(lab), [
      { label: 'Invoiced', values: inRange.map(function(m) { return invBy[m] || 0; }) },
      { label: 'Received', values: inRange.map(function(m) { return byMonth[m] ? (recBy[m] || 0) : null; }), tone: 2 }
    ], { ariaLabel: 'Invoiced against received', emptyText: 'Needs two months in the range' }) + '</div>' +
    '<div class="inv-panel-body inv-note">Invoiced incl. GST, by invoice date; received is every receipt on the statement.</div></div>');

  return h + fold('fin-gst', finGstChartHtml(inRange, cls)) + '</div>';
}

/* A place for what the statement cannot say (owner, 26 Sep 2026: "For July, make sure that reason is
   mentioned or has a place where we can mention it"). Nothing is seeded: the note is the owner's. */
function finGstNoteFormHtml(m) {
  var n = bankData().gstNotes[m] || {};
  var f = function(id, label, input) { return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' + input + '</div>'; };
  return '<div class="inv-panel-body" data-gst-form="' + m + '"><div class="inv-panel-title">GST for ' + escHtml(billsMonthLabel(m)) + '</div><div class="inv-fields">' +
    f('finGstNote', 'What happened', '<input class="inv-input" id="finGstNote" value="' + escHtml(n.note || '') + '" placeholder="e.g. paid from the ACI account">') +
    f('finGstPaid', 'Paid another way (₹, optional)', '<input class="inv-input inv-num" type="number" step="0.01" min="0" inputmode="decimal" id="finGstPaid" value="' + (n.paidOther || '') + '">') +
    f('finGstOn', 'On', '<input class="inv-input" type="date" id="finGstOn" value="' + escHtml(n.paidOn || '') + '">') +
    f('finGstVia', 'Via', '<input class="inv-input" id="finGstVia" value="' + escHtml(n.via || '') + '" placeholder="account or route">') +
    '</div><div class="inv-toolbar">' + (bankData().gstNotes[m] ? '<button class="inv-btn inv-btn-danger inv-btn-sm" data-action="invFinGstRemove" data-month="' + m + '">Remove note</button>' : '') +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFinGstCancel">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invFinGstSave" data-month="' + m + '">Save</button></div></div>';
}
function finGstNoteSave(m) {
  var root = document.querySelector('#pageFinance [data-gst-form="' + m + '"]');
  if (!root) return;
  var v = function(id) { var el = root.querySelector('#' + id); return el ? el.value.trim() : ''; };
  if (!v('finGstNote')) { showToast('Say what happened', 'error'); return; }
  // A P1 change, as every Finance edit (bankGate, bank.js); the form stays as typed while the PIN is asked.
  if (!bankGate('note a month\'s GST', function() { finGstNoteSave(m); })) return;
  var paid = gstRound(parseFloat(v('finGstPaid')) || 0);
  bankData().gstNotes[m] = { note: v('finGstNote'), paidOther: paid > 0 ? paid : null, paidOn: v('finGstOn') || null, via: v('finGstVia') || null, at: Date.now() };
  _finGstEdit = null;
  saveState();
  renderFinance();
  showToast('Note saved for ' + billsMonthLabel(m));
}

function financeInput(t) {
  if (t && t.id === 'finMonthPick') { _finMonth = t.value; _finCat = null; renderFinance(); return true; }
  return false;
}

/* A chart datum that also moves the Overview (a month, a slice) redraws it under the tap, so the figure it carries
   was never read out, where a plain tap writes it (charts.js). The same datum is found in the redrawn chart and read. */
function finRedrawReading(btn) {
  var read = btn.dataset.read, act = btn.dataset.action, host = btn.closest('.inv-panel[id]'), hostId = host ? host.id : '';
  renderFinance();
  var root = (hostId && document.getElementById(hostId)) || document.getElementById('financeContent');
  if (!root || !read) return;
  var hit = Array.prototype.find.call(root.querySelectorAll('[data-action="' + act + '"][data-read]'), function(el) { return el.dataset.read === read; });
  if (hit) chartShowRead(hit);
}
function financeAction(action, btn) {
  switch (action) {
    case 'invFinTab': finSetTab(btn.dataset.tab); _bankEdit = null; renderFinance(); return true;
    case 'invFinClient': _bankOpen = btn.dataset.id; finSetTab('receipts'); renderFinance(); return true;
    case 'invFinRange':
      _finRange = btn.dataset.range;
      try { localStorage.setItem('sep_inv_fin_range', _finRange); } catch (e) { /* a per-device convenience only */ }
      renderFinance(); return true;
    case 'invFinMonth': _finMonth = btn.dataset.key; _finCat = null; finRedrawReading(btn); return true;
    case 'invFinCat': _finCat = _finCat === btn.dataset.key ? null : btn.dataset.key; finRedrawReading(btn); return true;
    case 'invFinFrom':
      if (btn.dataset.key === '__loose') return financeAction('invFinLoose', btn);
      if (btn.dataset.key === '__others') { chartShowRead(btn); return true; }
      _bankOpen = btn.dataset.key; finSetTab('receipts'); renderFinance(); return true;
    case 'invFinStatementCat': _bankFilter = { cat: btn.dataset.cat, q: '' }; finSetTab('bank'); renderFinance(); return true;
    case 'invFinLoose':
      // The list of receipts with no client, not a client's pane left open from before (QA chain, 2 Oct 2026).
      _bankOpen = null;
      finSetTab('receipts'); renderFinance();
      var lp = document.getElementById('bankLoose');
      if (lp && lp.scrollIntoView) lp.scrollIntoView({ block: 'start' });
      return true;
    case 'invFinGstNote': _finGstEdit = btn.dataset.month; renderFinance(); return true;
    case 'invFinGstCancel': _finGstEdit = null; renderFinance(); return true;
    case 'invFinGstSave': finGstNoteSave(btn.dataset.month); return true;
    case 'invFinGstRemove':
      var gm = btn.dataset.month;
      uiConfirm({ title: 'Remove the note for ' + billsMonthLabel(gm) + '?', body: 'The month then reads from the bank alone.', okLabel: 'Remove note', danger: true })
        .then(function(ok) {
          if (!ok) return;
          var drop = function() { delete bankData().gstNotes[gm]; _finGstEdit = null; saveState(); renderFinance(); };
          if (bankGate('remove a GST note', drop)) drop();
        });
      return true;
  }
  return false;
}
