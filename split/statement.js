/* ===== STATEMENT OF ACCOUNT AND PAYMENT REMINDERS =====
   Owner, 7 Oct 2026: of the updates put to them, "Start with 1 and 2" (1: a statement of account and payment reminders).
   The app knew what each client owed and how fast each pays (Finance → Receivables), and the To-do flagged what was over 90
   days, but nothing in it could be handed to the client: the statement that gets money paid, and a message asking for it.

   - **One arithmetic.** Every figure is Receivables' own (`bankReceivables`): its start (`bankRecvFrom`), its opening, its
     invoices, its credit notes, the receipts placed on the client and what each paid, and the paise an exact match settled.
     So the statement's closing balance is what Receivables says is owed, to the paisa, and a spec holds it there.
   - **A period**: from any day on or after the start; what came before it is one line, *Balance brought forward*. To today.
   - **What is open** is Receivables' open list, aged from each invoice's date (0–30, 31–60, 61–90, over 90 days).
   - **The reminder** is a WhatsApp message (or a copy) naming what is owed and the oldest invoices, written from the same
     figures and editable before it goes. Sending it is recorded (`S.bank.reminders`: client, when, the amount, how), so the
     client's row and the To-do's chase say when it was last asked for. Nothing else is written: a statement is drawn each
     time it is shown, like the report and the power case.
   - It needs the bank statement (receipts are read from it), so it is reached from Receivables, which needs it too; a
     statement that ends days ago, and receipts nobody has placed, are said before anything goes out. */

var SOA_REMIND_LINES = 8;
var _soa = null;   // { clientId, from } while the dialog is open

function soaReminders() {
  var b = bankData();
  if (!Array.isArray(b.reminders)) b.reminders = [];
  return b.reminders;
}
function soaLastReminder(clientId) {
  return soaReminders().filter(function(x) { return String(x.clientId) === String(clientId); })
    .reduce(function(m, x) { return !m || (x.at || 0) > (m.at || 0) ? x : m; }, null);
}
function soaClient(id) { return (S.clients || []).find(function(c) { return String(c.id) === String(id); }) || null; }
function soaRecv(clientId, cls) {
  return bankReceivables(cls || bankClassify()).find(function(r) { return String(r.client.id) === String(clientId); }) || null;
}

/* The client's account as dated lines, each with its running balance. `from` is the first day shown: everything before it
   is the balance brought forward. The lines are Receivables' own events, in the order it reads them: on one day the
   opening, then invoices, then credit notes, then receipts, each receipt followed by the paise its exact match settled. */
function soaCompute(clientId, from) {
  var cls = bankClassify(), r = soaRecv(clientId, cls), start = bankRecvFrom();
  if (!r) return null;
  if (!from || from < start) from = start;
  var today = localDateStr(), ev = [];
  if (r.opening) ev.push({ date: start, k: 0, kind: 'opening', label: 'Owed on ' + formatDate(start), sub: 'balance when this account starts', dr: r.opening, cr: 0 });
  (S.invoices || []).filter(function(i) { return i.status === 'active' && String(i.clientId) === String(clientId) && i.date >= start; }).forEach(function(i) {
    ev.push({ date: i.date, k: 1, kind: 'invoice', label: 'Invoice ' + _bankInvLabel(i), sub: i.poNumber ? 'P.O. ' + i.poNumber : '', dr: gstRound(i.grandTotal || 0), cr: 0, ref: i.id });
  });
  getCreditNotes().filter(function(n) { return n.status !== 'cancelled' && String(n.clientId) === String(clientId) && (n.date || '') >= start; }).forEach(function(n) {
    ev.push({ date: n.date || '', k: 2, kind: 'note', label: 'Credit note ' + (n.displayNumber || n.cnNumber || ''), sub: n.againstInvoice ? 'against ' + n.againstInvoice : '', dr: 0, cr: gstRound(n.grandTotal || 0) });
  });
  r.allocs.forEach(function(a, i) {
    var row = a.v.row, inst = bankInstrument(row);
    var paid = a.parts.filter(function(p) { return p.inv; }).map(function(p) { return p.label + (p.whole ? '' : ' (part)'); });
    // A cheque received and not yet in the bank (TM3b) is paid on the day it came, and says where it is.
    ev.push({ date: row.date, k: 3, i: i, kind: 'receipt', label: a.v.pending ? 'Cheque ' + inst + ' received, not yet in the bank' : 'Received' + (inst ? ', cheque ' + inst : bankIsChequeDeposit(row) ? ', cheque' : ''),
      sub: paid.length ? 'for ' + paid.join(', ') : a.unapplied > 0.005 ? 'on account' : '', dr: 0, cr: gstRound(row.cr) });
    if (a.how === 'exact') {
      var sum = gstRound(a.parts.reduce(function(t, p) { return t + p.amount; }, 0)), diff = gstRound(sum - row.cr);
      if (Math.abs(diff) > 0.005) ev.push({ date: row.date, k: 3, i: i + 0.5, kind: 'rounding', label: 'Settled to the rupee', sub: 'the paise between the invoices and the payment',
        dr: diff < 0 ? -diff : 0, cr: diff > 0 ? diff : 0 });
    }
  });
  ev.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.k - b.k || (a.i || 0) - (b.i || 0); });
  var bf = 0, bal = 0, rows = [], dr = 0, cr = 0;
  ev.forEach(function(e) {
    var amt = gstRound(e.dr - e.cr);
    if (e.date < from) { bf = gstRound(bf + amt); bal = bf; return; }
    bal = gstRound(bal + amt);
    dr = gstRound(dr + e.dr); cr = gstRound(cr + e.cr);
    rows.push(Object.assign({}, e, { bal: bal }));
  });
  var age = { a: 0, b: 0, c: 0, d: 0 };
  var open = r.open.map(function(o) {
    var days = Math.max(0, isoDaysBetween(o.date, today));
    age[days > 90 ? 'd' : days > 60 ? 'c' : days > 30 ? 'b' : 'a'] += o.due;
    return { label: o.label, date: o.date, days: days, due: o.due, amount: o.amount, inv: !!o.inv };
  });
  Object.keys(age).forEach(function(k) { age[k] = gstRound(age[k]); });
  var rowsAll = bankRows();
  return { client: r.client, r: r, start: start, from: from, to: today, bf: bf, rows: rows, dr: dr, cr: cr, closing: gstRound(bal), owed: r.owed,
    open: open, age: age, stmtEnd: rowsAll.length ? rowsAll[rowsAll.length - 1].date : '' };
}

/* ---------- The printed statement ----------
   The quotation's paper (its pt tokens, frame and letterhead: one look for what the shop hands a client), its own table. */
function soaAddress(c) {
  return [c.add1, c.add2, c.add3].concat(c.address && !c.add1 ? String(c.address).split('\n') : [])
    .map(function(x) { return String(x || '').trim(); }).filter(Boolean);
}
function soaMoney(n) { return escHtml(formatCurrency(Math.abs(n))); }
function soaBalText(n) { return Math.abs(n) < 0.005 ? '&ndash;' : soaMoney(n) + (n < 0 ? ' Cr' : ' Dr'); }
function soaDocHtml(s) {
  var co = S.company || {}, c = s.client;
  var addr = [co.add1, co.add2, co.add3].map(function(x) { return String(x || '').trim(); }).filter(Boolean).join(', ');
  var phone = [co.phone, co.mobile].map(function(x) { return String(x || '').trim(); }).filter(Boolean).join(', ');
  var contact = [co.gstin ? 'GSTIN: ' + co.gstin : '', phone ? 'Ph: ' + phone : '', co.email || ''].filter(Boolean);
  var h = '<div class="inv-qt-doc" data-soa-doc="' + escHtml(String(c.id)) + '"><table class="inv-qt-frame">' +
    '<thead><tr><td class="inv-qt-frame-head"></td></tr></thead><tfoot><tr><td class="inv-qt-frame-foot"></td></tr></tfoot>' +
    '<tbody><tr><td class="inv-qt-frame-body">' +
    '<div class="inv-qt-head"><div><div class="inv-qt-co">' + escHtml(co.name || '') + '</div>' +
      '<div class="inv-qt-co-sub">' + escHtml(addr) + (contact.length ? '<br>' + contact.map(escHtml).join(' &middot; ') : '') + '</div></div>' +
      '<div class="inv-qt-type"><div class="inv-qt-type-t">STATEMENT OF ACCOUNT</div>' + escHtml(formatDate(s.from)) + ' to ' + escHtml(formatDate(s.to)) + '</div></div>' +
    '<div class="inv-qt-meta"><div><b>Date:</b> ' + escHtml(formatDate(s.to)) + '</div><div><b>Balance due:</b> <span data-soa-closing>' + soaBalText(s.closing) + '</span></div></div>' +
    '<div class="inv-qt-to"><div class="inv-qt-lbl">To</div><div class="inv-qt-to-body"><b>' + escHtml(/^m\/s\b/i.test(c.name || '') ? c.name : 'M/s ' + (c.name || '')) + '</b>' +
      soaAddress(c).map(function(x) { return '<br>' + escHtml(x); }).join('') +
      (c.gstin || c.state ? '<div class="inv-qt-sub">' + [c.gstin ? 'GSTIN: ' + escHtml(c.gstin) : '', c.state ? 'State: ' + escHtml(c.state) : ''].filter(Boolean).join(' &middot; ') + '</div>' : '') +
    '</div></div>' +
    '<table class="inv-soa-table"><thead><tr><th>Date</th><th>Particulars</th><th class="inv-qt-n">Debit</th><th class="inv-qt-n">Credit</th><th class="inv-qt-n">Balance</th></tr></thead><tbody>';
  if (s.from > s.start || Math.abs(s.bf) > 0.005) h += '<tr data-soa-row="bf"><td>' + escHtml(formatDate(s.from)) + '</td><td><b>Balance brought forward</b></td><td></td><td></td><td class="inv-qt-n">' + soaBalText(s.bf) + '</td></tr>';
  s.rows.forEach(function(x) {
    h += '<tr data-soa-row="' + x.kind + '"><td>' + escHtml(formatDate(x.date)) + '</td><td>' + escHtml(x.label) + (x.sub ? '<div class="inv-qt-sub">' + escHtml(x.sub) + '</div>' : '') + '</td>' +
      '<td class="inv-qt-n">' + (x.dr ? soaMoney(x.dr) : '') + '</td><td class="inv-qt-n">' + (x.cr ? soaMoney(x.cr) : '') + '</td><td class="inv-qt-n">' + soaBalText(x.bal) + '</td></tr>';
  });
  if (!s.rows.length) h += '<tr><td></td><td>Nothing in this period.</td><td></td><td></td><td></td></tr>';
  h += '<tr class="inv-soa-total"><td></td><td>Totals for the period</td><td class="inv-qt-n">' + soaMoney(s.dr) + '</td><td class="inv-qt-n">' + soaMoney(s.cr) + '</td>' +
    '<td class="inv-qt-n">' + soaBalText(s.closing) + '</td></tr></tbody></table>';
  // What is open, aged: the part of the balance the client is asked to pay, oldest first.
  h += '<div class="inv-qt-tail">';
  if (s.open.length) {
    h += '<div class="inv-qt-h3">OPEN INVOICES</div><table class="inv-soa-table inv-soa-open"><thead><tr><th>Invoice</th><th>Date</th><th class="inv-qt-n">Days</th><th class="inv-qt-n">Billed</th><th class="inv-qt-n">Due</th></tr></thead><tbody>' +
      s.open.map(function(o) {
        return '<tr data-soa-open="' + escHtml(o.label) + '"><td>' + escHtml(o.label) + '</td><td>' + escHtml(formatDate(o.date)) + '</td><td class="inv-qt-n">' + o.days + '</td>' +
          '<td class="inv-qt-n">' + soaMoney(o.amount) + '</td><td class="inv-qt-n"><b>' + soaMoney(o.due) + '</b></td></tr>';
      }).join('') + '</tbody></table>' +
      '<table class="inv-soa-table inv-soa-age"><thead><tr><th class="inv-qt-n">0&ndash;30 days</th><th class="inv-qt-n">31&ndash;60 days</th><th class="inv-qt-n">61&ndash;90 days</th><th class="inv-qt-n">Over 90 days</th></tr></thead>' +
      '<tbody><tr data-soa-age>' + ['a', 'b', 'c', 'd'].map(function(k) { return '<td class="inv-qt-n">' + (s.age[k] ? soaMoney(s.age[k]) : '&ndash;') + '</td>'; }).join('') + '</tr></tbody></table>';
  }
  if (s.closing < -0.005) h += '<p class="inv-qt-p">The balance is in your favour: ' + soaMoney(s.closing) + ' paid ahead, to be set against the next invoices.</p>';
  var bank = String(S.bankDetails || '').trim();
  if (bank && s.closing > 0.005) h += '<div class="inv-qt-h3">PAYMENT TO</div><p class="inv-qt-p">' + bank.split('\n').map(escHtml).join('<br>') + '</p>';
  h += '<p class="inv-qt-p inv-qt-sub">Drawn from our books on ' + escHtml(formatDate(s.to)) + '. Payments are read from our bank statement up to ' + escHtml(formatDate(s.stmtEnd || s.to)) +
    '; anything paid after it is not shown. Please tell us of any difference within 15 days.</p>' +
    '<div class="inv-qt-sig"><div class="inv-qt-foot"></div><div><div class="inv-qt-for">For ' + escHtml(co.name || '') + '</div><div class="inv-qt-line">Authorised signatory</div></div></div></div>' +
    '</td></tr></tbody></table></div>';
  return h;
}

/* ---------- The reminder ---------- */
function soaWaNumber(c) {
  var nums = [c && c.mobile, c && c.phone].join(',').split(/[,;/]+/).map(function(x) { return x.replace(/\D/g, ''); })
    .map(function(d) { return d.length === 10 ? '91' + d : d.length === 12 && d.slice(0, 2) === '91' ? d : d.length === 11 && d[0] === '0' ? '91' + d.slice(1) : ''; })
    .filter(function(d) { return /^91[6-9]\d{9}$/.test(d); });
  return nums[0] || '';
}
function soaReminderText(s) {
  var co = S.company || {}, open = s.open.filter(function(o) { return o.due > 0.005; });
  var lines = ['Dear Sir/Madam,', '', 'As per our books, ' + formatCurrency(s.closing) + ' is outstanding from ' + (s.client.name || 'you') + ' as on ' + formatDate(s.to) +
    (open.length ? ', against:' : '.')];
  open.slice(0, SOA_REMIND_LINES).forEach(function(o) {
    lines.push('• ' + o.label + ' dated ' + formatDate(o.date) + ': ' + formatCurrency(o.due) + (o.due < o.amount - 0.005 ? ' (of ' + formatCurrency(o.amount) + ')' : '') + ', ' + o.days + ' days');
  });
  if (open.length > SOA_REMIND_LINES) lines.push('• and ' + (open.length - SOA_REMIND_LINES) + ' more, on the statement');
  lines.push('', 'Kindly arrange the payment at the earliest. If it has already been paid, please share the details so we can match it.', '',
    'Regards,', [co.name, co.phone].filter(Boolean).join(', '));
  return lines.join('\n');
}

/* ---------- The dialog: the period, what to check first, the message, and the two ways out ---------- */
function soaWarnings(s) {
  var w = [], today = localDateStr();
  if (s.stmtEnd && isoDaysBetween(s.stmtEnd, today) > 3) w.push('The bank statement ends ' + formatDate(s.stmtEnd) + ': money received since is not in it. Import the latest before sending.');
  var loose = bankLooseReceipts(bankClassify(), s.start);
  if (loose.length) w.push(todoPlural(loose.length, 'receipt') + ' since ' + formatDate(s.start) + ' ' + (loose.length === 1 ? 'has' : 'have') + ' no client (' + formatCurrency(loose.reduce(function(t, v) { return t + v.row.cr; }, 0)) +
    '). If any is this client\'s, place it first, or the balance reads high.');
  if (s.r.openingStale) w.push('What was owed at the start is set against another day and not counted: set it on Receivables first.');
  else if (s.r.openingSuggest) w.push('What this client owed on ' + formatDate(s.start) + ' is not set; Receivables offers ' + formatCurrency(s.r.openingSuggest.amount) + '.');
  return w;
}
function soaOpen(clientId) {
  if (typeof grdSeesMoney === 'function' && !grdSeesMoney()) { showToast('Statements show money, which this ID does not see', 'error'); return; }
  var c = soaClient(clientId);
  if (!c) return;
  if (!bankRows().length) return uiAlert({ title: 'No bank statement yet', body: 'A statement of account reads the payments from the bank statement. Import it on Finance → Bank first.' });
  var s = soaCompute(clientId, _soa && String(_soa.clientId) === String(clientId) ? _soa.from : null);
  if (!s) return uiAlert({ title: 'Nothing on this account', body: c.name + ' has no invoice or receipt since ' + formatDate(bankRecvFrom()) + '.' });
  _soa = { clientId: c.id, from: s.from };
  var num = soaWaNumber(c), last = soaLastReminder(c.id), warn = soaWarnings(s);
  var html = '<div class="inv-dialog" data-soa-dialog="' + escHtml(String(c.id)) + '" role="dialog" aria-modal="true" aria-labelledby="soaTitle">' +
    dialogHeadHtml('<span id="soaTitle">' + escHtml(c.name) + '</span>') +
    '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">Statement of account</span>' +
      '<span class="inv-num" data-soa-owed>' + figHtml(formatCurrency(s.closing), s.closing > 0.005 && s.open.length ? figToneAge(s.open[0].days) : null) + '</span></div>' +
    '<div class="inv-panel-body"><div class="inv-field"><label class="inv-field-label" for="soaFrom">From</label>' +
      '<input class="inv-input inv-id" type="date" id="soaFrom" value="' + s.from + '" min="' + s.start + '" max="' + s.to + '"></div>' +
      '<div class="inv-note" data-soa-sum>' + s.rows.length + ' entr' + (s.rows.length === 1 ? 'y' : 'ies') + ' to ' + escHtml(formatDate(s.to)) +
        (s.from > s.start ? ', the balance before ' + escHtml(formatDate(s.from)) + ' brought forward' : ', from the day the account starts') +
        ' · ' + todoPlural(s.open.length, 'invoice') + ' open' + (s.open.length ? ', the oldest ' + s.open[0].days + ' days' : '') + '.</div></div>' +
    warn.map(function(t) { return '<div class="inv-callout inv-callout-warning" data-soa-warn>' + escHtml(t) + '</div>'; }).join('') +
    '</div>' +
    '<div class="inv-panel inv-panel-flush inv-mt-8"><div class="inv-panel-head"><span class="inv-panel-title">Reminder</span>' +
      '<span class="inv-row-meta" data-soa-last>' + (last ? 'last sent ' + escHtml(formatDate(isoOf(new Date(last.at)))) + ' for ' + escHtml(formatCurrency(last.amount || 0)) : 'none sent yet') + '</span></div>' +
    '<div class="inv-panel-body">' + (s.closing > 0.005
      ? '<textarea class="inv-textarea" id="soaText" rows="10" data-nodirty>' + escHtml(soaReminderText(s)) + '</textarea>' +
        '<div class="inv-note">' + (num ? 'WhatsApp opens on +' + escHtml(num) + ', the client\'s number, with this message.' : 'The client has no mobile number on record: WhatsApp opens with the message and you pick the chat.') + '</div>' +
        '<div class="inv-toolbar inv-toolbar-tight inv-mt-8"><button class="inv-btn inv-btn-secondary" data-action="invSoaWa">Send on WhatsApp</button>' +
        '<button class="inv-btn inv-btn-secondary" data-action="invSoaCopy">Copy</button></div>'
      : '<div class="inv-note">Nothing is owed, so there is nothing to ask for.</div>') + '</div></div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Close</button>' +
      '<button class="inv-btn inv-btn-primary" data-action="invSoaPrint">Print statement</button></div></div>';
  dialogOpen(html, { dismiss: true, replace: !!document.querySelector('[data-soa-dialog]') });
}
/* A reminder sent is a fact worth keeping: when the client was last asked, and for how much. */
function soaSent(how) {
  if (!_soa) return;
  var s = soaCompute(_soa.clientId, _soa.from);
  if (!s) return;
  soaReminders().push({ id: 'REM-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), clientId: s.client.id, at: Date.now(), amount: s.closing, how: how,
    oldest: s.open.length ? s.open[0].date : '' });
  saveState();
  var el = document.querySelector('[data-soa-last]');
  if (el) el.textContent = 'last sent ' + formatDate(localDateStr()) + ' for ' + formatCurrency(s.closing);
  if (typeof renderFinance === 'function' && document.querySelector('#pageFinance.inv-page-active')) keepScroll(renderFinance);
}
function soaWa() {
  var c = _soa && soaClient(_soa.clientId), t = document.getElementById('soaText');
  if (!c || !t || !t.value.trim()) return;
  var num = soaWaNumber(c);
  window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(t.value.trim()), '_blank', 'noopener');
  soaSent('whatsapp');
  showToast('Reminder opened in WhatsApp for ' + c.name);
}
function soaCopy() {
  var t = document.getElementById('soaText');
  if (!t || !t.value.trim()) return;
  var done = function() { soaSent('copy'); showToast('Reminder copied'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value.trim()).then(done, function() { t.select(); showToast('Select and copy it: the clipboard was refused', 'error'); });
  else { t.select(); showToast('Select and copy it: this browser has no clipboard here', 'error'); }
}
function soaPrint() {
  if (!_soa) return;
  var s = soaCompute(_soa.clientId, _soa.from), body = document.getElementById('invPrintBody');
  if (!s || !body) return;
  closeTopOverlay();
  body.innerHTML = soaDocHtml(s);
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = 'Statement - ' + s.client.name + ' - ' + s.to;
}
function soaFromChanged(v) {
  if (!_soa || !/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return;
  _soa.from = v;
  soaOpen(_soa.clientId);
}
/* The row's line on Receivables: when the client was last asked. */
function soaLastText(clientId) {
  var l = soaLastReminder(clientId);
  return l ? 'reminded ' + formatDate(isoOf(new Date(l.at))) : '';
}

function soaAction(action, btn) {
  switch (action) {
    case 'invSoaOpen': _soa = null; soaOpen(btn.dataset.client); return true;
    case 'invSoaWa': soaWa(); return true;
    case 'invSoaCopy': soaCopy(); return true;
    case 'invSoaPrint': soaPrint(); return true;
  }
  return false;
}
