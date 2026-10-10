/* ===== PAY SLIPS =====
   Owner, 7 Oct 2026: of the updates put to them, "Start with 1 and 2" (2: pay slips printed from the app). Staff → Pay worked
   out each hand's earnings, overtime, rest days, payments, advances and the balance carried; the slip handed to the hand was
   still made by hand from the register.

   - **One arithmetic.** A slip is a row of Pay's own `payDue` for the week on screen, in the worker's own period: the week
     for the weekly tiers, the month (of the week's Sunday) for the monthly tier. Earned is the labour card's own figure split
     per worker (`labourForRange().byWorker`), paid is `payPaidFor`, brought forward is `payCarried`, due is what Pay says
     is due. A month on record as paid prints the slip's own row (`payrollPaidFor`): what was paid is the fact.
   - **What it shows**: days present, half and absent in the period, the earnings line by line (days × the day rate, rest
     days, overtime hours, or hours × the hour rate), the gross, each payment and advance in the period with its date, the
     balance brought forward, and what is due (or the advance still to work off). The EXTRA pool is not on it: it is one line
     on the week's slip, disbursed on the floor, and a weekly slip says so.
   - **Two to an A4 page**, with a line to cut along; a reference derived, never counted (`PS/<period>/<card or id>`), so a
     reprint is the same slip and nothing is written when one is printed (the certificate's rule).
   - Wages: only a role that opens Pay reaches it. */

var COMP_SLIP_NOTE = { hourly: 'paid by the hour', daily: 'paid by the day', monthly: 'paid by the month' };

/* The period's marks for one worker: present, half, absent, on the days recorded. */
function psMarks(w, from, to) {
  var out = { P: 0, H: 0, A: 0 };
  attDatesInRange(from, to).forEach(function(iso) {
    var rec = (S.attendance || {})[iso], m = rec && rec.marks && rec.marks[w.id];
    if (m && out[m.st] != null) out[m.st]++;
  });
  return out;
}
/* The payments a slip lists: the ones Pay counted as paid for this period (payPaymentsFor: the bank's salary legs and the
   payments typed on Pay, a typed one the statement also holds once). */
function psPayments(w, from, to) {
  return payPaymentsFor(w, from, to);
}
function psPeriodLabel(r) {
  if (r.weekly) return 'Week ' + attPayWeekNumber(r.from) + ' · ' + formatDate(r.from) + ' to ' + formatDate(r.to);
  var name = attParseIso(r.from).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  return name + (r.to >= localDateStr() ? ', to ' + formatDate(localDateStr()) : '');
}
function psRef(r) {
  var per = r.weekly ? r.to.slice(0, 4) + '-W' + String(attPayWeekNumber(r.from)).padStart(2, '0') : r.from.slice(0, 7);
  return 'PS/' + per + '/' + (r.w.card || String(r.w.id));
}
/* The earnings lines: what each part of the gross is, its quantity and its rate where one rate made it. */
function psLines(r) {
  var w = r.w, e = r.earned || {}, out = [];
  var rate = function(amt, qty) { return qty > 0 ? gstRound(amt / qty) : 0; };
  if (r.asPaid) {
    var row = (payrollPaidFor(r.from.slice(0, 7)) || { rows: [] }).rows.filter(function(x) { var m = payrollMatch(x); return m && m.w && String(m.w.id) === String(w.id); })[0] || {};
    out.push({ what: 'Days, on the month’s slip', qty: Number(row.worked) || 0, unit: 'days', rate: Number(row.rate) || 0, amt: gstRound(Number(row.dayPay) || 0) });
    if (Number(row.restDays)) out.push({ what: 'of which rest days', qty: Number(row.restDays) || 0, unit: 'days', rate: 0, amt: null });
    if (Number(row.ot)) out.push({ what: 'Overtime, on the month’s slip', qty: Number(row.otHours) || 0, unit: 'h', rate: rate(Number(row.ot) || 0, Number(row.otHours) || 0), amt: gstRound(Number(row.ot) || 0) });
    return out;
  }
  if (w.comp === 'hourly') {
    out.push({ what: 'Hours worked', qty: e.hours || 0, unit: 'h', rate: w.hourRate || rate(e.base || 0, e.hours || 0), amt: gstRound(e.base || 0) });
  } else {
    out.push({ what: w.comp === 'monthly' ? 'Days worked' : 'Days worked', qty: e.days || 0, unit: 'days', rate: rate(e.base || 0, e.days || 0), amt: gstRound(e.base || 0) });
    if (e.rest) out.push({ what: w.comp === 'monthly' ? 'Rest days and paid holidays' : 'Weekly rest day', qty: e.restDays || 0, unit: 'days', rate: rate(e.rest, e.restDays || 0), amt: gstRound(e.rest) });
    if (e.ot || e.otHours) out.push({ what: 'Overtime', qty: e.otHours || 0, unit: 'h', rate: rate(e.ot || 0, e.otHours || 0), amt: gstRound(e.ot || 0) });
  }
  return out;
}

function psSlipHtml(r) {
  var co = S.company || {}, w = r.w, p = w.profile || {}, e = r.earned || {};
  var addr = [co.add1, co.add2, co.add3].map(function(x) { return String(x || '').trim(); }).filter(Boolean).join(', ');
  var marks = psMarks(w, r.from, r.to > localDateStr() ? localDateStr() : r.to), lines = psLines(r), pays = psPayments(w, r.from, r.to), settled = r.asPaid && !r.compared;
  var gross = r.asPaid ? gstRound(lines.reduce(function(t, l) { return t + (l.amt || 0); }, 0)) : gstRound(e.total || 0);
  var m = function(n) { return escHtml(formatCurrency(n)); };
  var kv = [['Name', w.name], ['Card', w.card || ''], ['Designation', p.designation || ''], ['Area', w.area && w.area !== 'flex' ? areaLabel(w.area) : ''],
    ['Paid', compClass(w.comp).label + ', ' + (COMP_SLIP_NOTE[w.comp] || '')],
    ['Rate', w.comp === 'hourly' ? formatCurrency(w.hourRate || 0) + ' an hour' : w.comp === 'monthly' && w.monthWage > 0 ? formatCurrency(w.monthWage) + ' a month' : formatCurrency(w.dayRate || 0) + ' a day']]
    .filter(function(x) { return x[1]; });
  var h = '<div class="inv-ps-slip" data-ps-slip="' + escHtml(String(w.id)) + '">' +
    '<div class="inv-ps-head"><div><div class="inv-ps-co">' + escHtml(co.name || '') + '</div><div class="inv-ps-sub">' + escHtml(addr) + '</div></div>' +
      '<div class="inv-ps-title"><div class="inv-ps-title-t">PAY SLIP</div><div class="inv-ps-sub">' + escHtml(psPeriodLabel(r)) + '</div>' +
      '<div class="inv-ps-sub" data-ps-ref>' + escHtml(psRef(r)) + '</div></div></div>' +
    '<div class="inv-ps-body"><dl class="inv-ps-kv">' + kv.map(function(x) { return '<dt>' + escHtml(x[0]) + '</dt><dd>' + escHtml(x[1]) + '</dd>'; }).join('') + '</dl>' +
      '<div class="inv-ps-att"><div class="inv-ps-lbl">Attendance</div><div data-ps-att>Present ' + marks.P + ' · Half day ' + marks.H + ' · Absent ' + marks.A + '</div>' +
        (r.asPaid ? '<div class="inv-ps-sub">Earned as the month\'s payroll says</div>' : '') + '</div></div>' +
    '<table class="inv-ps-table"><thead><tr><th>Earnings</th><th class="inv-ps-n">Qty</th><th class="inv-ps-n">Rate</th><th class="inv-ps-n">Amount</th></tr></thead><tbody>' +
    lines.map(function(l) {
      return '<tr><td>' + escHtml(l.what) + '</td><td class="inv-ps-n">' + escHtml(formatNum(l.qty, l.qty % 1 ? 1 : 0)) + ' ' + l.unit + '</td>' +
        '<td class="inv-ps-n">' + (l.rate ? m(l.rate) : '') + '</td><td class="inv-ps-n">' + (l.amt == null ? '' : m(l.amt)) + '</td></tr>';
    }).join('') +
    '<tr class="inv-ps-strong"><td colspan="3">Earned</td><td class="inv-ps-n" data-ps-gross>' + m(gross) + '</td></tr>';
  // A month on record as paid with no payment for it known is settled by its payroll: one line, as Pay reads it (payDue), so the
  // slip foots. Otherwise each payment for the period, by bank or typed on Pay.
  if (!settled) pays.forEach(function(x) {
    h += '<tr><td colspan="3">' + (x.kind === 'advance' ? 'Advance' : 'Paid') + ' on ' + escHtml(formatDate(x.date)) + (x.how === 'bank' ? ', by bank' : '') +
      (x.note ? ' · ' + escHtml(x.note) : '') + '</td><td class="inv-ps-n">&minus;' + m(Number(x.amount) || 0) + '</td></tr>';
  });
  if (settled) h += '<tr><td colspan="3">Paid against the month\'s payroll</td><td class="inv-ps-n">&minus;' + m(gross) + '</td></tr>';
  // What is brought forward names the periods it is made of (August's legs paid to each other, a ruled figure paid short).
  if (r.carried) h += '<tr data-ps-carried><td colspan="3">' + (r.carried > 0 ? 'Owed from before' : 'Paid over before, taken back') +
    ((r.carry && r.carry.parts) || []).slice(-3).map(function(pt) { return '<div class="inv-ps-sub">' + escHtml(payPartWords(w, pt)) + '</div>'; }).join('') +
    '</td><td class="inv-ps-n">' + (r.carried > 0 ? '+' : '&minus;') + m(Math.abs(r.carried)) + '</td></tr>';
  h += '<tr class="inv-ps-strong inv-ps-due"><td colspan="3">' + (r.due < -0.005 ? 'Advance still to work off' : 'Due to you') + '</td><td class="inv-ps-n" data-ps-due>' + m(Math.abs(r.due)) + '</td></tr></tbody></table>' +
    (r.weekly ? '<div class="inv-ps-sub">EXTRA hours are paid from the floor\'s pool by the supervisor and are not on this slip.</div>' : '') +
    '<div class="inv-ps-sign"><div class="inv-ps-line">Received by (signature or thumb)</div><div class="inv-ps-line">For ' + escHtml(co.name || '') + '</div></div></div>';
  return h;
}
/* Two slips to an A4 page, a line to cut along between them. */
function psSheetsHtml(rows) {
  var h = '';
  for (var i = 0; i < rows.length; i += 2) {
    h += '<div class="inv-ps-sheet" data-ps-sheet>' + psSlipHtml(rows[i]) + (rows[i + 1] ? '<div class="inv-ps-cut"></div>' + psSlipHtml(rows[i + 1]) : '') + '</div>';
  }
  return h;
}

/* ---------- The dialog: who, for the week on Pay, or a month picked ---------- */
/* Any month's slips (owner, 10 Oct 2026: "no way to see and print the pay slip of each employee"): the dialog's month picks the
   monthly hands' month; the weekly hands' slips stay the week on Pay's. */
var _psMonth = null;   // 'YYYY-MM' picked in the dialog; null is the month of the week on Pay
/* The pay week a month's slips are read through: payDue reads a monthly hand's month off the week's Sunday, so the first Sunday
   on or after the month's first day. */
function psMonthWeek(month) {
  var first = month + '-01', ws = attWeekStartOf(first);
  return ws < first ? isoAddDays(ws, 7) : ws;
}
function psWeekMonth() { return payMonthStart(_attWeekStart || attWeekStartOf(localDateStr())).slice(0, 7); }
function psPicked() { return _psMonth && _psMonth !== psWeekMonth() ? _psMonth : null; }
function psRows() {
  var month = psPicked();
  return payDue(month ? psMonthWeek(month) : (_attWeekStart || attWeekStartOf(localDateStr()))).rows.filter(function(r) {
    if (month && r.weekly) return false;
    var e = r.earned || {};
    return r.asPaid || e.total || e.days || e.hours || r.paid || r.carried || r.due;
  });
}
/* The months the picker offers: this month and the eleven before. */
function psMonths() {
  var out = [], m = localDateStr().slice(0, 7);
  for (var i = 0; i < 12; i++) { out.push(m); m = payMonthStart(isoAddDays(m + '-01', -1)).slice(0, 7); }
  return out;
}
function psOpen(keepMonth) {
  if (typeof grdSeesWages === 'function' && !grdSeesWages()) { showToast('Your ID doesn’t open Pay', 'warning'); return; }
  if (!keepMonth) _psMonth = null;
  var rows = psRows();
  if (!rows.length && !keepMonth) return uiAlert({ title: 'Nothing to put on a slip', body: 'No worker earned, was paid or carries a balance in this week or its month.' });
  var group = function(title, list) {
    if (!list.length) return '';
    return '<div class="inv-row-group">' + escHtml(title) + '</div>' + list.map(function(r) {
      return '<label class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(r.w.name) + '</span>' +
        '<span class="inv-row-meta">' + escHtml((r.due < -0.005 ? 'advance ' : 'due ') + formatCurrency(Math.abs(r.due))) + (r.asPaid ? ' · as paid' : '') + '</span></span>' +
        '<span class="inv-row-end"><input type="checkbox" class="inv-check" data-ps-pick="' + escHtml(String(r.w.id)) + '" checked></span></label>';
    }).join('');
  };
  var weekly = rows.filter(function(r) { return r.weekly; }), monthly = rows.filter(function(r) { return !r.weekly; });
  var month = psPicked() || psWeekMonth();
  // The month is a <select> that speaks through change (psOnChange), never a data-action.
  var pick = '<div class="inv-field"><label class="inv-field-label" for="psMonth">Monthly hands’ month</label><select class="inv-select" id="psMonth">' +
    psMonths().map(function(m) { return '<option value="' + m + '"' + (m === month ? ' selected' : '') + '>' + escHtml(_monthLabel(m)) + '</option>'; }).join('') + '</select></div>';
  dialogOpen('<div class="inv-dialog" data-ps-dialog role="dialog" aria-modal="true" aria-labelledby="psTitle">' + dialogHeadHtml('<span id="psTitle">Pay slips</span>') +
    '<div class="inv-note">One slip a worker for their own period, the figures Pay shows: two to an A4 page.' + (psPicked() ? ' The weekly hands’ slips follow the week on Pay.' : '') + '</div>' +
    '<div class="inv-panel-body">' + pick + '</div>' +
    '<div class="inv-panel inv-panel-flush inv-mt-8">' +
      group(weekly.length ? 'Weekly · ' + psPeriodLabel(weekly[0]) : '', weekly) +
      group(monthly.length ? 'Monthly · ' + psPeriodLabel(monthly[0]) : '', monthly) +
      (rows.length ? '' : '<div class="inv-empty">Nobody earned, was paid or carries a balance in ' + escHtml(_monthLabel(month)) + '.</div>') + '</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
      '<button class="inv-btn inv-btn-primary" data-action="invPsPrint"' + (rows.length ? '' : ' disabled') + '>Preview</button></div></div>', { dismiss: true, replace: !!keepMonth });
}
function psOnChange(el) {
  if (!el || el.id !== 'psMonth') return false;
  _psMonth = el.value || null;
  psOpen(true);
  return true;
}
function psPrint() {
  var picked = {};
  document.querySelectorAll('[data-ps-pick]').forEach(function(c) { if (c.checked) picked[c.getAttribute('data-ps-pick')] = true; });
  var rows = psRows().filter(function(r) { return picked[String(r.w.id)]; });
  if (!rows.length) { showToast('Tick at least one worker', 'error'); return; }
  closeTopOverlay();
  psShow(rows);
}
/* One hand's slip for one period, from their pay history. */
function psOne(id, from) {
  var w = staffById(id);
  if (!w || !/^\d{4}-\d{2}-\d{2}$/.test(from || '')) return;
  if (typeof grdSeesWages === 'function' && !grdSeesWages()) { showToast('Your ID doesn’t open Pay', 'warning'); return; }
  var r = payDue(payIsWeekly(w) ? from : psMonthWeek(from.slice(0, 7))).rows.find(function(x) { return String(x.w.id) === String(id); });
  if (!r) { showToast('Nothing to put on a slip for that period', 'warning'); return; }
  closeTopOverlay();
  psShow([r]);
}
function psShow(rows) {
  var body = document.getElementById('invPrintBody');
  if (!body) return;
  body.innerHTML = psSheetsHtml(rows);
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = 'Pay slips ' + (rows[0].weekly ? rows[0].to : rows[0].from.slice(0, 7));
}
function psAction(action, btn) {
  switch (action) {
    case 'invPsOpen': psOpen(); return true;
    case 'invPsPrint': psPrint(); return true;
    case 'invPsOne': psOne(btn.dataset.id, btn.dataset.from); return true;
  }
  return false;
}
