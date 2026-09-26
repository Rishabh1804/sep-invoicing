/* ===== FINANCE (sidebar Money → Finance; More → Finance on the phone) =====
 * The money side of the shop in one place (owner, 26 Sep 2026: "The entire finance sector of our
 * app needs a dashboard"). Bank and Bills & notes lived under Stock, where they never belonged; they
 * are tabs here, beside the Overview that reads across them:
 *   - cash position: the balance on the statement and each month's money in and out;
 *   - owed to us: what clients owe, by age, and the largest debtors;
 *   - where money went: a month's outflow by category, against what was invoiced and received;
 *   - GST due against GST paid, month by month.
 * Every figure says what it rests on. A dashboard that reads a statement which stops on 18 Sep says
 * so on the tile, rather than passing an old balance off as today's.
 */

var FIN_TABS = [['overview', 'Overview'], ['receipts', 'Receivables'], ['payments', 'Payments'], ['bank', 'Bank'], ['bills', 'Bills & notes'], ['gst', 'GST']];
var _finTab = (function() { try { var t = localStorage.getItem('sep_inv_fin_tab'); return FIN_TABS.some(function(x) { return x[0] === t; }) ? t : 'overview'; } catch (e) { return 'overview'; } })();
var _finGstEdit = null;   // the month whose GST note is open
var _finMonth = null;   // the month "where money went" reads; null = the latest with a statement row

function finSetTab(t) {
  if (!FIN_TABS.some(function(x) { return x[0] === t; })) t = 'overview';
  _finTab = t;
  try { localStorage.setItem('sep_inv_fin_tab', t); } catch (e) { /* a per-device convenience only */ }
}

function renderFinance() {
  var el = document.getElementById('financeContent');
  if (!el) return;
  var looseN = bankRows().length ? bankClassify().filter(function(v) { return v.cat === 'receipt' && v.clientId == null; }).length : 0;
  var tab = function(k, l) { return '<button class="inv-viewtab" role="tab" aria-selected="' + (_finTab === k) + '" data-action="invFinTab" data-tab="' + k + '">' + l +
    (k === 'receipts' && looseN ? ' <span class="inv-badge inv-badge-warning" title="Receipts with no client">' + looseN + '</span>' : '') + '</button>'; };
  var h = '<div class="inv-viewtabs" role="tablist" aria-label="Finance">' + FIN_TABS.map(function(t) { return tab(t[0], t[1]); }).join('') + '</div>' +
    '<input type="file" accept=".xls,application/vnd.ms-excel" id="bankFileInput" class="inv-hidden">';
  if (_finTab === 'bills') h += renderBillsNotes();
  else if (_finTab === 'gst') h += finGstHtml(12);
  else if (_finTab === 'overview') h += finOverviewHtml();
  else h += renderBank(_finTab);
  el.innerHTML = h;
  // Six tabs overflow a phone's width; the one open is scrolled into view, never left off-screen.
  var on = el.querySelector('.inv-viewtab[aria-selected="true"]');
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/* The overview is read at a glance: whole rupees. Every tab behind it keeps the paise. */
function finRs(v) { var n = Math.round(Number(v) || 0); return (n < 0 ? '-' : '') + '₹' + Math.abs(n).toLocaleString('en-IN'); }
function finPl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

/* ---------- Months ---------- */
function finYm(iso) { return String(iso || '').slice(0, 7); }
function finNextMonth(ym) { var d = new Date(ym + '-01T00:00:00'); d.setMonth(d.getMonth() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
/* The last n months, this one included, oldest first. */
function finMonths(n) { return insMonthsBack(n - 1).concat([localDateStr().slice(0, 7)]); }
function finDaysAgo(iso) { return Math.round((new Date(localDateStr() + 'T00:00:00') - new Date(iso + 'T00:00:00')) / 86400000); }

/* ---------- Cash ---------- */
/* Per month on the statement: money in, money out, and the balance the month closed on. */
function finCashByMonth(rows) {
  var out = {};
  rows.forEach(function(r) {
    var m = finYm(r.date), e = out[m] = out[m] || { month: m, cr: 0, dr: 0, close: null, open: null };
    if (e.open == null) e.open = gstRound(r.balance + r.dr - r.cr);
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
      var age = finDaysAgo(o.date), b = bands.find(function(x) { return age >= x.lo && age <= x.hi; }) || bands[bands.length - 1];
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
    var m = finYm(i.date);
    if (i.status === 'active' && m in due) due[m] = gstRound(due[m] + (i.cgstAmt || 0) + (i.sgstAmt || 0) + (i.igstAmt || 0));
  });
  getCreditNotes().forEach(function(n) {
    var m = finYm(n.date);
    if (n.status !== 'cancelled' && m in due) due[m] = gstRound(due[m] - ((n.cgstAmt || 0) + (n.sgstAmt || 0) + (n.igstAmt || 0)));
  });
  (cls || []).forEach(function(v) {
    if (v.cat !== 'gst' || !(v.row.dr > 0)) return;
    var m = bankPrevMonth(v.row.date);
    if (m in paid) { paid[m] = gstRound(paid[m] + v.row.dr); paidRows[m].push(v.row); }
  });
  var today = localDateStr(), notes = bankData().gstNotes;
  return months.map(function(m) {
    var next = finNextMonth(m), dueBy = next + '-20', n = notes[m] || null;
    // A return paid another way (owner, 26 Sep 2026: July went by another route) is recorded by hand
    // and counts as paid, but is never shown as what the bank saw.
    var other = n && Number(n.paidOther) > 0 ? gstRound(Number(n.paidOther)) : 0;
    return { month: m, due: due[m], paidBank: paid[m], paidOther: other, paid: gstRound(paid[m] + other), rows: paidRows[m], note: n,
      dueBy: dueBy, open: today <= dueBy || m >= today.slice(0, 7) };
  });
}
/* One reading of a month, shared by the table and the tile. */
function finGstStatus(r) {
  if (r.paidBank > 0) return { tone: 'ok', text: 'Paid ' + finShortDate(r.rows[r.rows.length - 1].date) };
  if (r.paidOther > 0) return { tone: 'info', text: 'Outside bank', title: 'Paid another way' + (r.note && r.note.via ? ' via ' + r.note.via : '') };
  if (r.note) return { tone: 'neutral', text: 'Noted', title: r.note.note };
  if (r.due <= 0) return { tone: 'neutral', text: 'Nil' };
  if (r.open) return { tone: 'info', text: 'Due ' + finShortDate(r.dueBy) };
  // Only the bank is read: a return paid another way is not on the statement, so this says what is known.
  return { tone: 'warning', text: 'Not in bank', title: 'No GST payment on the statement for this month; one made another way would not show here', missing: true };
}

/* "Jun '26": a month column that has to leave room for a status on a phone. */
function finShortMonth(ym) { return TREND_MONTH_LABELS[parseInt(ym.slice(5, 7), 10) - 1] + " '" + ym.slice(2, 4); }
function finShortDate(iso) { var d = new Date(iso + 'T00:00:00'); return d.getDate() + ' ' + TREND_MONTH_LABELS[d.getMonth()]; }
function finGstHtml(n, wide) {
  var cls = bankClassify(), rows = finGstByMonth(finMonths(n), cls).reverse();
  var h = '<div class="inv-panel inv-panel-flush' + (wide ? ' inv-panels-wide' : '') + '" id="finGst"><div class="inv-panel-head"><span class="inv-panel-title">GST due and paid</span></div>' +
    '<div class="inv-panel-body inv-note">Due is the output tax on the month\'s invoices less the tax on its credit notes. Paid is the GST the bank sent the month after. ' +
    'Cash paid is output tax less input credit, so paying less than is due is normal; the gap is the credit claimed, or a shortfall only the return can tell apart.</div>' +
    (_finGstEdit ? finGstNoteFormHtml(_finGstEdit) : '') +
    '<div class="inv-scroll"><table class="inv-table"><thead><tr><th>Month</th><th class="inv-num">Due</th><th class="inv-num">Paid</th><th>Status</th></tr></thead><tbody>';
  rows.forEach(function(r) {
    var st = finGstStatus(r);
    h += '<tr data-gst="' + r.month + '"><td class="inv-nowrap" title="' + escHtml(billsMonthLabel(r.month)) + '">' + escHtml(finShortMonth(r.month)) + '</td><td class="inv-num">' + formatCurrency(r.due) + '</td>' +
      '<td class="inv-num">' + (r.paid ? formatCurrency(r.paid) : '&mdash;') + '</td><td><span class="inv-dot inv-dot-' + st.tone + '"' + (st.title ? ' title="' + escHtml(st.title) + '"' : '') + '>' + escHtml(st.text) + '</span>' +
      // A note is possible for any month the bank shows no payment for, not only once it is overdue.
      (r.note || (r.due > 0 && !r.paidBank) ? ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGstNote" data-month="' + r.month + '">' + (r.note ? 'Edit' : 'Add note') + '</button>' : '') + '</td></tr>';
    if (r.note) {
      h += '<tr class="inv-row-note" data-gst-note="' + r.month + '"><td colspan="4"><span class="inv-row-meta">' + escHtml(r.note.note) +
        (r.paidOther ? ' · ' + escHtml(formatCurrency(r.paidOther)) + ' paid' + (r.note.paidOn ? ' on ' + escHtml(formatDate(r.note.paidOn)) : '') + (r.note.via ? ' via ' + escHtml(r.note.via) : '') : '') + '</span></td></tr>';
    }
  });
  return h + '</tbody></table></div></div>';
}

/* ---------- The overview ---------- */
function finOverviewHtml() {
  var rows = bankRows(), cls = bankClassify(rows), has = rows.length > 0;
  var recv = has ? bankReceivables(cls) : [];
  var owed = gstRound(recv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0));
  var last = has ? rows[rows.length - 1] : null, stale = last ? finDaysAgo(last.date) : 0;
  var months = finCashByMonth(rows);
  var paidMonth = months.length ? months[months.length - 1] : null;
  var gst = finGstByMonth(insMonthsBack(1), cls)[0];
  var loose = cls.filter(function(v) { return v.cat === 'receipt' && v.clientId == null; }).length;

  var tile = function(label, value, sub, tone, key) {
    return '<div class="inv-tile' + (tone ? ' inv-tile-' + tone : '') + '" data-fin-tile="' + key + '"><div class="inv-tile-label">' + label + '</div>' +
      '<div class="inv-tile-value inv-num">' + value + '</div><div class="inv-tile-sub">' + sub + '</div></div>';
  };
  var h = '<div class="inv-tiles">' +
    tile('Bank balance', last ? formatCurrency(last.balance) : '&mdash;', last ? 'on ' + escHtml(formatDate(last.date)) + (stale > 7 ? ' · statement ' + stale + ' days old' : '') : 'no statement imported',
      last && last.balance < 0 ? 'danger' : last && stale > 7 ? 'warning' : '', 'balance') +
    // Unplaced receipts are money in that no client is credited with, so the figure reads HIGH until they are placed.
    tile('Owed to us', has ? formatCurrency(owed) : '&mdash;', has ? (loose ? finPl(loose, 'receipt') + ' not placed: reads high' : finPl(recv.filter(function(r) { return r.owed > 0.005; }).length, 'client') + ' · since ' + escHtml(formatDate(rows[0].date))) : 'needs a statement',
      loose ? 'warning' : '', 'owed') +
    tile('Paid out', paidMonth ? formatCurrency(paidMonth.dr) : '&mdash;', paidMonth ? 'in ' + escHtml(billsMonthLabel(paidMonth.month)) + ' · ' + finRs(paidMonth.cr) + ' came in' : 'needs a statement', '', 'out') +
    tile('GST for ' + escHtml(billsMonthLabel(gst.month)), formatCurrency(gst.due), (function() {
      var st = finGstStatus(gst);
      return gst.paidBank > 0 ? 'paid ' + formatCurrency(gst.paidBank) : gst.paidOther > 0 ? formatCurrency(gst.paidOther) + ' paid outside the bank'
        : gst.note ? 'noted: ' + escHtml(gst.note.note) : gst.open ? 'due by ' + escHtml(formatDate(gst.dueBy)) : st.missing ? 'no payment on the statement' : '';
    })(), gst.paid > 0 || gst.note || gst.due <= 0 ? '' : gst.open ? 'info' : 'warning', 'gst') +
    '</div>';

  if (!has) {
    return h + '<div class="inv-panel"><div class="inv-empty">Import the bank statement on the Bank tab. The balance, what clients owe and where money went all read from it; GST due reads from the invoices and is below.</div></div>' +
      finGstHtml(6);
  }

  h += '<div class="inv-panels">';
  // Cash by month
  h += '<div class="inv-panel inv-panel-flush" id="finCash"><div class="inv-panel-head"><span class="inv-panel-title">Cash by month</span></div>';
  var bal = months.map(function(m) { return { label: insMonthLabel(m.month), value: m.close }; });
  if (bal.length >= 2 && bal.every(function(b) { return b.value >= 0; })) h += '<div class="inv-panel-body">' + chartLine(bal, { ariaLabel: 'Month-end balance' }) + '</div>';
  h += '<div class="inv-scroll"><table class="inv-table"><thead><tr><th>Month</th><th class="inv-num">In</th><th class="inv-num">Out</th><th class="inv-num">Closed at</th></tr></thead><tbody>';
  months.slice(-6).reverse().forEach(function(m) {
    h += '<tr data-cash="' + m.month + '"><td class="inv-nowrap">' + escHtml(billsMonthLabel(m.month)) + '</td><td class="inv-num" title="' + escHtml(formatCurrency(m.cr)) + '">' + finRs(m.cr) + '</td>' +
      '<td class="inv-num" title="' + escHtml(formatCurrency(m.dr)) + '">' + finRs(m.dr) + '</td><td class="inv-num" title="' + escHtml(formatCurrency(m.close)) + '">' + finRs(m.close) + '</td></tr>';
  });
  h += '</tbody></table></div></div>';

  // Owed to us
  var bands = finAgeing(recv), top = recv.filter(function(r) { return r.owed > 0.005; }).slice(0, 5);
  h += '<div class="inv-panel inv-panel-flush" id="finOwed"><div class="inv-panel-head"><span class="inv-panel-title">Owed to us</span><span class="inv-panel-count inv-num">' + formatCurrency(owed) + '</span></div>' +
    '<div class="inv-tiles inv-tiles-flush inv-tiles-4">' + bands.map(function(b, i) {
      return '<div class="inv-tile' + (i === 3 && b.amount > 0 ? ' inv-tile-danger' : i === 2 && b.amount > 0 ? ' inv-tile-warning' : '') + '" data-age="' + i + '"><div class="inv-tile-label">' + b.label + '</div>' +
        '<div class="inv-tile-value inv-tile-value-sm inv-num" title="' + escHtml(formatCurrency(b.amount)) + '">' + finRs(b.amount) + '</div><div class="inv-tile-sub">' + finPl(b.n, 'invoice') + '</div></div>';
    }).join('') + '</div>';
  top.forEach(function(r) {
    h += '<div class="inv-row inv-row-2" data-debtor="' + escHtml(String(r.client.id)) + '"><button class="inv-row-main" data-action="invFinClient" data-id="' + escHtml(String(r.client.id)) + '">' +
      '<span class="inv-row-title">' + escHtml(r.client.name) + '</span><span class="inv-row-meta">' + r.open.length + ' open' + (r.oldestDays != null ? ' · oldest ' + r.oldestDays + ' d' : '') + '</span></button>' +
      '<span class="inv-row-end inv-num">' + formatCurrency(r.owed) + '</span></div>';
  });
  if (!top.length) h += '<div class="inv-empty">Nothing owed since the statement starts.</div>';
  if (loose) h += '<div class="inv-panel-body inv-note">' + finPl(loose, 'receipt') + ' with no client ' + (loose === 1 ? 'is' : 'are') + ' not counted yet, so what is owed reads high. ' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinLoose">Place them</button></div>';
  h += '</div>';

  // Where money went
  var ym = _finMonth && months.some(function(m) { return m.month === _finMonth; }) ? _finMonth : paidMonth.month;
  var byCat = {};
  cls.forEach(function(v) {
    if (finYm(v.row.date) !== ym || !(v.row.dr > 0)) return;
    var k = bankCatLabel(v.cat) + (v.cash ? ' (cash)' : '');
    byCat[k] = gstRound((byCat[k] || 0) + v.row.dr);
  });
  var invoiced = gstRound((S.invoices || []).reduce(function(s, i) { return s + (i.status === 'active' && finYm(i.date) === ym ? (i.grandTotal || 0) : 0); }, 0));
  var received = gstRound(cls.reduce(function(s, v) { return s + (v.cat === 'receipt' && finYm(v.row.date) === ym ? v.row.cr : 0); }, 0));
  h += '<div class="inv-panel inv-panel-flush inv-panels-wide" id="finWent"><div class="inv-panel-head"><span class="inv-panel-title">Where money went</span>' +
    '<select class="inv-select inv-select-sm" id="finMonthPick" aria-label="Month">' + months.slice().reverse().map(function(m) {
      return '<option value="' + m.month + '"' + (m.month === ym ? ' selected' : '') + '>' + escHtml(billsMonthLabel(m.month)) + '</option>'; }).join('') + '</select></div>' +
    '<div class="inv-panel-body">' + chartRankedBars(Object.keys(byCat).sort(function(a, b) { return byCat[b] - byCat[a]; }).map(function(k) { return { label: k, value: byCat[k] }; }),
      { emptyText: 'Nothing paid out in ' + billsMonthLabel(ym) }) + '</div>' +
    [['Invoiced', invoiced, 'incl. GST, by invoice date'], ['Received', received, 'from clients'], ['Paid out', Object.keys(byCat).reduce(function(s, k) { return gstRound(s + byCat[k]); }, 0), 'every category']].map(function(x) {
      return '<div class="inv-row" data-went="' + x[0] + '"><span class="inv-row-main">' + x[0] + ' <span class="inv-row-meta">' + x[2] + '</span></span><span class="inv-row-end inv-num">' + formatCurrency(x[1]) + '</span></div>';
    }).join('') +
    '</div>';
  return h + finGstHtml(6, true) + '</div>';
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
  var paid = gstRound(parseFloat(v('finGstPaid')) || 0);
  bankData().gstNotes[m] = { note: v('finGstNote'), paidOther: paid > 0 ? paid : null, paidOn: v('finGstOn') || null, via: v('finGstVia') || null, at: Date.now() };
  _finGstEdit = null;
  saveState();
  renderFinance();
  showToast('Note saved for ' + billsMonthLabel(m));
}

function financeInput(t) {
  if (t && t.id === 'finMonthPick') { _finMonth = t.value; renderFinance(); return true; }
  return false;
}
function financeAction(action, btn) {
  switch (action) {
    case 'invFinTab': finSetTab(btn.dataset.tab); _bankEdit = null; renderFinance(); return true;
    case 'invFinClient': _bankOpen = btn.dataset.id; finSetTab('receipts'); renderFinance(); return true;
    case 'invFinLoose':
      finSetTab('receipts'); renderFinance();
      var lp = document.getElementById('bankLoose');
      if (lp && lp.scrollIntoView) lp.scrollIntoView({ block: 'start' });
      return true;
    case 'invFinGstNote': _finGstEdit = btn.dataset.month; renderFinance(); return true;
    case 'invFinGstCancel': _finGstEdit = null; renderFinance(); return true;
    case 'invFinGstSave': finGstNoteSave(btn.dataset.month); return true;
    case 'invFinGstRemove':
      if (!confirm('Remove the note for ' + billsMonthLabel(btn.dataset.month) + '?')) return true;
      delete bankData().gstNotes[btn.dataset.month]; _finGstEdit = null; saveState(); renderFinance(); return true;
  }
  return false;
}
