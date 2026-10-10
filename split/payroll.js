/* ===== PAY: what each worker is owed, and what the week pays out =====

   Staff → Pay (owner, 25 Sep 2026). Four questions the Staff tab could not
   answer: what is due to each worker, what each week paid out and what this one
   will, how far a week swings from the usual, and how many hours each area
   worked. Plus the day's attendance on Home.

   **The pay week runs Sunday to Saturday.** The weekly tiers (hourly and daily)
   are paid on Saturday, and a Sunday worked is paid that coming Saturday. The
   monthly tier is paid by the calendar month. The EXTRA pool is one line on the
   weekly slip, disbursed by the supervisor on the floor — it is in the week's
   payout and never in any one worker's due.

   **Due is earned minus paid**, over the worker's own pay period: the week for
   the weekly tiers, the month for the monthly one. Payments and advances are
   recorded here (`S.staffPayments`), and like every other record in this app a
   wrong one is VOIDED with a reason, never deleted — a payment that vanished
   would leave a due nobody could explain.

   **The prediction is the days so far plus the rest at this week's own pace**:
   recorded working days as they are, and the unrecorded Mon–Sat days filled in
   at the week's average per recorded working day. A Sunday is taken out of the
   pace, because it is overtime and does not repeat. With nothing recorded yet
   the median of past weeks stands in, and says so. The swing is read against the
   median of the twelve weeks before, weeks with nothing recorded left out: a
   week nobody typed is not a cheap week. */

var PAY_HISTORY_WEEKS = 12;

function staffPayments() {
  if (!Array.isArray(S.staffPayments)) S.staffPayments = [];
  return S.staffPayments;
}
function payIsWeekly(w) { return !!w && w.comp !== 'monthly'; }
function payMonthStart(iso) { return iso.slice(0, 8) + '01'; }
function payMonthEnd(iso) {
  var d = attParseIso(payMonthStart(iso));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return isoOf(d);
}
function payPaidBetween(staffId, from, to) {
  return gstRound(staffPayments().reduce(function(s, p) {
    if (p.voidedAt || String(p.staffId) !== String(staffId) || p.date < from || p.date > to) return s;
    return s + (Number(p.amount) || 0);
  }, 0));
}
/* The month a monthly hand's payment pays for. A salary goes out around the 14th for the month before (the bank reads a
   salary leg the same way), so a payment dated on or before the 20th pays the month before; an advance, or a payment
   after the 20th, pays the month it is dated in. Counted by its date, a salary paid on the 14th read as an advance
   against the new month, and a month on a slip, skipped whole, took with it the salary paid in it for the month before
   (the QA of 30 Sep 2026: −₹12,000 "Advance" where ₹1,000 was due, or a salary owed for ever). */
var PAY_SALARY_BY_DAY = 20;
function payMonthPaidFor(p) {
  var d = String((p && p.date) || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  return p.kind !== 'advance' && +d.slice(8, 10) <= PAY_SALARY_BY_DAY ? payMonthStart(isoAddDays(payMonthStart(d), -1)) : payMonthStart(d);
}
/* ===== What was paid: the bank's salary legs and the payments typed here =====
   Owner, 10 Oct 2026: "no way to see and print the pay slip of each employee and/or what they have been paid, we have all the
   information in our data but not linked yet": August's two salaries had gone to each other's accounts and a ruled figure was paid
   short, to be adjusted the month after. A salary paid by transfer is on the bank statement, read as wages to
   a hand on the roster (bank.js: the payee's name read as a roll reads one, or set on the row or the payee by hand): it is a
   payment, as one typed on Pay is. A payment typed here that the statement also holds (the same hand, within a rupee, three days
   apart) is that leg, counted once. A leg the name only reads as (a folded spelling) counts, as the bank's wages panel counts it,
   and says so. Paid used to be the typed payments alone: every salary paid by transfer read as unpaid. */
var PAY_LEG_DAYS = 3;
function payBankLegs() {
  if (typeof finCtx !== 'function' || typeof bankRows !== 'function') return [];
  var ctx = finCtx();
  if (!ctx._payLegs) ctx._payLegs = ctx.cls.filter(function(v) { return v.cat === 'wages' && !v.cash && v.staffId != null && v.row.dr > 0; })
    .map(function(v) { return { id: 'bank:' + v.row.id, rowId: v.row.id, staffId: v.staffId, date: v.row.date, amount: gstRound(v.row.dr), kind: 'payment', how: 'bank', guess: !!v.guess }; });
  return ctx._payLegs;
}
function payHandPays(staffId) {
  return staffPayments().filter(function(p) { return !p.voidedAt && String(p.staffId) === String(staffId); });
}
/* Every payment to one hand, oldest first: the bank's legs, and the payments typed here less those the statement holds. */
function payPaymentsOf(staffId) {
  var out = payBankLegs().filter(function(l) { return String(l.staffId) === String(staffId); }).map(function(l) { return Object.assign({}, l); });
  payHandPays(staffId).forEach(function(p) {
    var amt = gstRound(Number(p.amount) || 0);
    var leg = p.kind !== 'advance' && out.find(function(l) { return l.how === 'bank' && !l.typed && Math.abs(l.amount - amt) < 1 && Math.abs(isoDaysBetween(l.date, p.date)) <= PAY_LEG_DAYS; });
    if (leg) { leg.typed = p.id; return; }
    out.push({ id: p.id, staffId: p.staffId, date: p.date, amount: amt, kind: p.kind === 'advance' ? 'advance' : 'payment', how: 'hand', note: p.note || '', at: p.at || 0 });
  });
  return out.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.at || 0) - (b.at || 0); });
}
/* The payments counted for a worker's own period: the weekly tiers' by the date (a week is paid on its Saturday), a monthly
   hand's by the month each payment pays for. */
function payPaymentsFor(w, from, to) {
  var weekly = payIsWeekly(w);
  return payPaymentsOf(w.id).filter(function(p) {
    if (weekly) return p.date >= from && p.date <= to;
    var m = payMonthPaidFor(p);
    return !!m && m >= payMonthStart(from) && m <= to;
  });
}
function payPaidFor(w, from, to) {
  return gstRound(payPaymentsFor(w, from, to).reduce(function(s, p) { return s + p.amount; }, 0));
}

/* ===== What carries from one period to the next =====
   A balance carries (owner, 30 Sep 2026: WB2, "yes, unless stated otherwise and notification cleared"). A due left
   unpaid is still owed next period, an advance not worked off is still to be worked off, and a monthly salary paid
   on the 14th of the next month pays the month it was for. The due had been per period only: the advance vanished
   when the period turned, and September's salary paid in October read as an advance against October.

   It is counted from the period of the worker's first payment recorded here (a monthly hand's, the month before,
   since a salary pays the month before): before that no payment was typed in the app, so nothing is known of what
   was settled and every past wage would read as owed. A month on record as paid (the slip) is settled whatever the
   marks read. **Stated otherwise**: a balance is cleared with a reason (`S.payCarryClears`), which settles every
   period up to the one before the clear and takes the To-do task with it; it is voided, never deleted. */
function payCarryClears() {
  if (!Array.isArray(S.payCarryClears)) S.payCarryClears = [];
  return S.payCarryClears;
}
function payPeriodOf(w, iso) { return payIsWeekly(w) ? attWeekStartOf(iso) : payMonthStart(iso); }
function payPeriodEnd(w, start) { return payIsWeekly(w) ? isoAddDays(start, 6) : payMonthEnd(start); }
/* labourForRange once per range within one drawing: every worker's carry reads the same weeks and months. */
function payLabMemo() {
  var memo = {};
  return function(from, to) { var k = from + '|' + to; return memo[k] || (memo[k] = labourForRange(from, to)); };
}
/* Where a monthly hand's balance starts (owner's month, `S.labour.payCarryFrom`, 'YYYY-MM'). The bank's legs go back months
   before anything here was set against them (the statement from January, the slips from April), so they never start a balance
   on their own: the owner says from which month the months are counted. A weekly hand's balance still starts at the first
   payment typed for them: they are paid in cash on Saturday, never on the statement by name. */
function payCarryFrom() {
  var c = S.labour && S.labour.payCarryFrom;
  return /^\d{4}-\d{2}$/.test(c || '') ? c : '';
}
/* One period as Pay reads it: what was earned (and from where), each payment for it, and what it leaves. A month on the payroll
   as paid is earned as its slip says; with no payment known for it, it is settled by the slip, as it always was (the bank's legs
   may not reach it, or the hand is paid in cash). A payment known for it is set against the slip: the August legs that crossed
   are a difference again, not two months settled. Paid in whole rupees, the paise dropped (as the shop pays), is paid: a
   difference under a rupee is none. */
function payPeriodRow(w, from, to, lr) {
  var weekly = payIsWeekly(w), e = lr.byWorker[w.id] || null, pays = payPaymentsFor(w, from, to);
  var paid = gstRound(pays.reduce(function(s, p) { return s + p.amount; }, 0));
  var guess = !weekly && (lr.paidGuess || {})[w.id];
  var slip = !weekly && !!((e && e.asPaid) || guess);
  var earned = e ? gstRound(e.total) : 0;
  // A month whose payroll is on record but does not name this hand, with no payment for them known: they were paid off the slip
  // (a voucher of their own, the weekly pool while on it), not left owed the month (a hand new to the monthly tier read the
  // whole of August as unpaid).
  var offSlip = !weekly && !slip && !pays.length && (lr.paidMonths || []).some(function(m) { return m.month === from.slice(0, 7); });
  var out = { from: from, to: to, lr: lr, e: e, earned: earned, pays: pays, paid: paid, slip: slip, guess: guess || '', offSlip: offSlip,
    source: slip ? 'slip' : e && (e.days || e.hours || e.total) ? 'marks' : 'none' };
  // A slip row only guessed to be this hand keeps its money under its own name (labourForRange): settled by the slip.
  out.settled = (slip && (!pays.length || !!guess)) || offSlip;
  out.diff = out.settled ? 0 : gstRound(earned - paid);
  if (pays.length && Math.abs(out.diff) < 1) out.diff = 0;
  return out;
}
function payCarried(w, periodFrom, lab) {
  var id = String(w.id), weekly = payIsWeekly(w), start = null, cf = weekly ? '' : payCarryFrom();
  if (cf) start = cf + '-01';
  else {
    // A typed payment dates the start, one in this period included: a salary paid in October for September must carry
    // September into October, not read as an advance against October.
    var pays = payHandPays(id);
    if (!pays.length) return { amount: 0, periods: 0, parts: [] };
    var first = pays.reduce(function(m, p) { return p.date < m ? p.date : m; }, pays[0].date);
    start = payPeriodOf(w, first);
    if (!weekly) start = payMonthStart(isoAddDays(start, -1));
  }
  var clear = payCarryClears().filter(function(c) { return !c.voidedAt && String(c.staffId) === id && c.through < periodFrom; })
    .sort(function(a, b) { return a.through < b.through ? 1 : a.through > b.through ? -1 : (b.at || 0) - (a.at || 0); })[0] || null;
  if (clear) { var next = payPeriodOf(w, isoAddDays(clear.through, 1)); if (next > start) start = next; }
  var amt = 0, periods = 0, parts = [];
  for (var p = start, guard = 0; p < periodFrom && guard < 260; guard++) {
    var end = payPeriodEnd(w, p), row = payPeriodRow(w, p, end, lab(p, end));
    periods++;
    if (row.diff) {
      // A month whose payment settles what it earned and what was brought into it, each to the rupee (the paise of both
      // dropped, as the shop pays), leaves nothing.
      var before = amt;
      amt = gstRound(amt + row.diff);
      if (row.pays.length && before && Math.abs(amt) < 2) amt = 0;
      parts.push(row);
    }
    p = isoAddDays(end, 1);
  }
  return { amount: gstRound(amt), from: start, periods: periods, clear: clear, parts: parts.filter(function(r) { return r.diff; }) };
}
/* The balance a worker is owed or has been advanced as of today, for the To-do and the motivation index: last month's salary is
   not owed before the day it is paid by (PAY_SALARY_BY_DAY), so a monthly hand's balance then stops at the month before. */
function payOverdue(w, today, lab) {
  today = today || localDateStr();
  var from = payPeriodOf(w, today);
  if (!payIsWeekly(w) && +today.slice(8, 10) <= PAY_SALARY_BY_DAY) from = payMonthStart(isoAddDays(from, -1));
  return payCarried(w, from, lab || payLabMemo());
}
/* Two hands' salaries paid to each other: each was paid, to the rupee, what the other earned (August 2026: the owner's two salaries
   that went to each other's accounts). Said wherever the difference is, so it reads as what it is. */
function payCrossedWith(w, from, to, lr) {
  if (payIsWeekly(w)) return null;
  var me = payPeriodRow(w, from, to, lr);
  if (!me.pays.length || Math.abs(me.diff) < 1) return null;
  return (S.staff || []).find(function(o) {
    if (String(o.id) === String(w.id) || payIsWeekly(o)) return false;
    var r = payPeriodRow(o, from, to, lr);
    return r.pays.length > 0 && Math.abs(r.paid - me.earned) < 1 && Math.abs(me.paid - r.earned) < 1;
  }) || null;
}
/* A period's difference in words: "August 2026: paid ₹12,456.00 against ₹15,796.80", the crossing named. */
function payPartWords(w, part) {
  var label = payIsWeekly(w) ? 'Week ' + attPayWeekNumber(part.from) : _monthLabel(part.from.slice(0, 7));
  if (!part.pays.length) return label + ': ' + formatCurrency(part.earned) + ' earned, nothing paid';
  var x = !payIsWeekly(w) ? payCrossedWith(w, part.from, part.to, part.lr) : null;
  return label + ': paid ' + formatCurrency(part.paid) + ' against ' + formatCurrency(part.earned) + (part.slip ? ' on the slip' : ' earned') +
    (x ? ', the bank legs crossed with ' + x.name + '\u2019s' : '');
}

/* One pay week's payout: the weekly tiers' earnings plus the EXTRA pool. */
function payWeek(weekStart) {
  var sat = isoAddDays(weekStart, 6);
  var lab = labourForRange(weekStart, sat);
  var workers = 0;
  Object.keys(lab.byWorker).forEach(function(id) {
    var b = lab.byWorker[id];
    if (b.comp !== 'monthly') workers += b.total;
  });
  var paid = 0;
  staffPayments().forEach(function(p) {
    if (p.voidedAt || p.date < weekStart || p.date > sat) return;
    if (payIsWeekly(staffById(p.staffId))) paid += Number(p.amount) || 0;
  });
  return { start: weekStart, sat: sat, lab: lab, workers: gstRound(workers), extra: lab.extra,
    total: gstRound(workers + lab.extra), paid: gstRound(paid),
    recordedDays: lab.daysRecorded, workingDays: lab.workingDays, sundays: lab.sundaysRecorded };
}

/* The payout the week is heading for, and the usual it is read against. */
function payForecast(weekStart) {
  var today = localDateStr();
  var wk = payWeek(weekStart);
  var past = [];
  for (var i = 1; i <= PAY_HISTORY_WEEKS; i++) {
    var p = payWeek(isoAddDays(weekStart, -7 * i));
    if (p.recordedDays > 0) past.push(p.total);
  }
  var median = numMedian(past);
  var open = wk.sat >= today;
  var out = { week: wk, median: median, medianWeeks: past.length, open: open, predicted: wk.total, basis: 'recorded' };
  if (open) {
    // The Sunday and a paid holiday are not working days: what they paid does not repeat, so it is out of the pace, and
    // the days left to predict are the week's working days (five in a holiday week) less those recorded.
    var sunPay = 0;
    attWeekDays(weekStart).forEach(function(d) {
      if (attParseIso(d).getDay() !== 0 && !labourIsHoliday(d)) return;
      var one = labourForRange(d, d);
      Object.keys(one.byWorker).forEach(function(id) { if (one.byWorker[id].comp !== 'monthly') sunPay += one.byWorker[id].total; });
      sunPay += one.extra;
    });
    var missing = Math.max(0, wk.workingDays - wk.recordedDays);
    if (wk.recordedDays > 0) {
      var pace = (wk.total - sunPay) / wk.recordedDays;
      out.predicted = gstRound(wk.total + pace * missing);
      out.pace = gstRound(pace);
      out.basis = missing > 0 ? 'pace' : 'recorded';
    } else if (median != null) {
      out.predicted = gstRound(median + sunPay);
      out.basis = 'median';
    }
    out.missing = missing;
  }
  out.swing = median != null ? gstRound(out.predicted - median) : null;
  out.swingPct = median ? out.swing / median : null;
  return out;
}

/* What each active worker earned, has been paid, and is owed, for the pay
   period the selected week sits in. */
function payDue(weekStart) {
  var today = localDateStr();
  var sat = isoAddDays(weekStart, 6);
  // The monthly tier's month is the one the week's Sunday is in: a week that runs into the next month is the last pay
  // week of the month it closes. Read off the Saturday, the last week of September showed October's due at nothing and
  // hid September's, which is the one being settled.
  var mFrom = payMonthStart(weekStart), mTo = payMonthEnd(weekStart);
  var wk = labourForRange(weekStart, sat);
  var mo = labourForRange(mFrom, mTo > today && mFrom <= today ? today : mTo);
  // The active roster, and anyone who has left but earned or was paid in the period: their final week must be payable.
  var pool = staffActive().slice(), poolLab = payLabMemo();
  (S.staff || []).filter(function(w) { return w.active === false; }).sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); }).forEach(function(w) {
    var weekly = payIsWeekly(w), from = weekly ? weekStart : mFrom, to = weekly ? sat : mTo;
    var e = (weekly ? wk : mo).byWorker[w.id];
    if ((e && (e.total || e.days || e.hours || e.hourless)) || staffPayments().some(function(p) { return !p.voidedAt && String(p.staffId) === String(w.id) && p.date >= from && p.date <= to; })
      || payPaidFor(w, from, to) || Math.abs(payCarried(w, from, poolLab).amount) >= 1) pool.push(w);
  });
  var lab = payLabMemo();
  var rows = pool.map(function(w) {
    var weekly = payIsWeekly(w);
    var carry = payCarried(w, weekly ? weekStart : mFrom, lab), c = Math.abs(carry.amount) >= 1 ? carry.amount : 0;
    var e = (weekly ? wk : mo).byWorker[w.id] || { total: 0, days: 0, hours: 0, otHours: 0, base: 0, ot: 0, rest: 0 };
    var from = weekly ? weekStart : mFrom, to = weekly ? sat : mTo;
    // The period as Pay reads it (payPeriodRow): a closed month on the payroll as paid is earned as its slip says, and settled by
    // it while no payment for it is known; a payment known for it is set against the slip.
    var row = payPeriodRow(w, from, to, weekly ? wk : mo);
    if (row.slip && row.settled) return { w: w, weekly: weekly, earned: e, paid: e.total, due: c, carried: c, carry: carry, from: from, to: to, asPaid: true, asPaidAs: row.guess, pays: row.pays };
    return { w: w, weekly: weekly, earned: e, paid: row.paid, due: gstRound(row.diff + c), carried: c, carry: carry, from: from, to: to, asPaid: row.slip, asPaidAs: row.guess, compared: row.slip, pays: row.pays,
      crossed: row.slip || !weekly ? payCrossedWith(w, from, to, weekly ? wk : mo) : null };
  });
  return { rows: rows, extra: wk.extra, extraHours: wk.extraHours, weekStart: weekStart, sat: sat, mFrom: mFrom, mTo: mTo };
}

function payMoney(n) { return escHtml(formatCurrency(n)); }
function paySigned(n) { return (n > 0 ? '+' : n < 0 ? '&minus;' : '') + escHtml(formatCurrency(Math.abs(n))); }

function _attPayView() {
  var ws = _attWeekStart, phone = !_isDesktop, thisWeek = ws === attWeekStartOf(localDateStr());
  // One look (the tab map, TM4b): the payout as the verdict (it was the Weekly payout card's head), one toolbar row (the week, Pay
  // slips, More), labour ₹/kg and the payroll against the bank (they led Staff's Overview), then what is due by worker, each
  // opening to its arithmetic; the history, the slips as paid and the bank's legs folded.
  var html = _payVerdictHtml(ws) + '<div class="inv-toolbar" data-att-toolbar="pay">' +
    _attStepInRow('invAttWeekStep', '<span class="inv-stepper-title">Week ' + attPayWeekNumber(ws) + '</span>', 'Previous week', 'Next week') +
    (phone ? '' : '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAttThisWeek"' + (thisWeek ? ' disabled' : '') + '>This week</button>') +
    // The slips are printed from the due rows (payslip.js).
    '<button class="inv-btn inv-btn-secondary" data-action="invPsOpen">Pay slips</button>' +
    uiToolbarMoreHtml([phone && !thisWeek ? { label: 'Go to this week', action: 'invAttThisWeek' } : null, { label: 'Import the payroll as paid', action: 'invPayrollImport' }], { icon: phone }) +
    '<input type="file" accept=".json,application/json" id="payrollFileInput" class="inv-hidden"></div>';
  html += payLabourPanelsHtml();
  html += _payDueCard(ws);
  html += uiFoldCard('payHistory', _payHistoryCard(ws), false);
  html += uiFoldCard('payrollPaid', _payrollPaidCard(), false);
  // The bank's side of the same payroll (Finance → Payments draws the same panel): the bank is money, so a role that sees
  // wages but not money has the slips without the statement's legs (the guard, the QA chain of 2 Oct 2026).
  if (finHasBank() && (typeof grdSeesMoney !== 'function' || grdSeesMoney())) html += finWagesHtml(finCtx().cls, 'pay');
  return html;
}
/* Pay's verdict (§3e): the week's payout, heading for it while the week is open, and its change against the usual week (the median
   of the twelve before), toned by the swing: well above the usual is a caution, below says nothing on its own. */
function _payVerdictHtml(ws) {
  var f = payForecast(ws), wk = f.week, sat = isoAddDays(ws, 6), amount = f.open ? f.predicted : wk.total;
  var pct = f.swingPct != null ? (f.swing >= 0 ? '+' : '−') + formatNum(Math.abs(f.swingPct) * 100, 0) + '%' : '';
  var tone = f.swingPct != null && f.swingPct > 0.15 ? 'warning' : f.median != null ? 'ok' : 'neutral';
  return uiVerdictHtml({ screen: 'Pay · week ' + attPayWeekNumber(ws) + ', paid Sat ' + stockShortDate(sat), tone: tone,
    // The amount is said once, in the sentence (the spec's "Payout ₹5,130 · +13% on its usual"); its paise are the factors'.
    verdict: (f.open ? 'Payout heading for ' : 'Payout ') + finRs(amount) + (pct ? ', ' + pct + ' on its usual' : ''),
    facts: [wk.recordedDays + ' of ' + wk.workingDays + ' days recorded' + (wk.sundays ? ', and the Sunday' : ''),
      f.open ? (f.basis === 'pace' ? todoPlural(f.missing, 'day') + ' at this week’s pace' : f.basis === 'median' ? 'the median stands in' : '') : ''],
    factors: [
      { label: f.open ? 'So far' : 'The week', fig: payMoney(wk.total), sub: wk.workingDays < 6 ? 'a paid holiday out' : 'as recorded', attrs: ' data-tile="sofar"' },
      f.open ? { label: 'Predicted', fig: payMoney(f.predicted), sub: f.basis === 'pace' ? payMoney(f.pace) + ' a day' : f.basis === 'median' ? 'the median' : 'every day in', attrs: ' data-tile="predicted"' }
        : { label: 'Paid', fig: payMoney(wk.paid), sub: 'to the weekly hands', attrs: ' data-tile="paid"' },
      { label: 'Usual week', fig: f.median == null ? '' : payMoney(f.median), sub: f.medianWeeks ? 'median of ' + f.medianWeeks + ' weeks' : 'no week before', attrs: ' data-tile="median"' },
      { label: 'Against its usual', fig: f.swing == null ? '' : '<span id="paySwing">' + paySigned(f.swing) + '</span>', tone: f.swing == null ? null : tone, sub: pct ? pct + ' on the median' : 'no week to compare', attrs: ' data-tile="swing"' }],
    body: '<div class="inv-hero-sheet">' + uiFactRowHtml({ label: 'Hourly and daily tiers', value: formatCurrency(wk.workers), sub: 'their pay, OT and rest credit' }) +
      uiFactRowHtml({ label: 'EXTRA pool', value: formatCurrency(wk.extra), sub: formatNum(wk.lab.extraHours, 1) + ' h, disbursed by the supervisor' }) + '</div>',
    attrs: ' id="payForecast"' });
}

/* A worker's or a week's figure on a pay card (§6.10): who or what, what it rests on, the money at the end. */
function _payRow(title, sub, end, attrs, cls) {
  var tag = attrs && attrs.indexOf('data-action') >= 0 ? 'button' : 'div';
  return '<' + tag + ' class="inv-row' + (sub ? ' inv-row-2' : '') + (cls ? ' ' + cls : '') + '"' + (attrs || '') + '>' +
    '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + title + '</span>' +
    (sub ? '<span class="inv-row-meta inv-row-wrap">' + sub + '</span>' : '') + '</span>' +
    '<span class="inv-row-end">' + end + '</span></' + tag + '>';
}

function _payDueCard(ws) {
  var d = payDue(ws);
  var monthName = attParseIso(d.mFrom).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  // How earned, paid and a balance carried are worked out is the guide's (Using the app: pay); a hand opens to its own arithmetic.
  var h = _labPanelHead('due', 'Due by worker', null, '', 'payDue');
  var group = function(title, rows) {
    if (!rows.length) return '';
    // What is due and what was advanced are two figures: netting one hand's advance against another's due read low.
    var tot = rows.reduce(function(s, r) { return s + (r.due > 0 ? r.due : 0); }, 0);
    var adv = rows.reduce(function(s, r) { return s + (r.due < 0 ? -r.due : 0); }, 0);
    var g = '<div class="inv-row-group">' + title + '</div>' + rows.map(_payDueRowHtml).join('');
    g += _payRow('Total due', '', '<span class="inv-num" data-pay-total="due">' + payMoney(gstRound(tot)) + '</span>', '', 'inv-row-strong');
    if (adv > 0) g += _payRow('Advanced, not yet worked off', 'not taken off the total due',
      '<span class="inv-row-stack"><span class="inv-num" data-pay-total="advanced">' + payMoney(gstRound(adv)) + '</span><span class="inv-dot inv-dot-warning">Advance</span></span>');
    return g;
  };
  h += group('Weekly &middot; paid Sat ' + formatDate(d.sat), d.rows.filter(function(r) { return r.weekly; }));
  h += group('Monthly &middot; ' + escHtml(monthName), d.rows.filter(function(r) { return !r.weekly; }));
  h += _payCarriedHtml(d);
  h += _payFormHtml(d);
  h += _payListHtml(d);
  return h + '</div>';
}
/* One hand's due (§3c): what is owed as the row's figure, earned and paid its two facts; opened, the wage arithmetic a fact a row (the
   days at their rate, the rest days, the overtime hours at theirs, paid, brought forward) and the one move, Pay. The rates are read
   back off the labour card's own figures (a day's pay over the days), never worked out a second way. */
function _payDueRowHtml(r) {
  var e = r.earned, w = r.w, id = String(w.id), money = function(n) { return formatCurrency(n); };
  var facts = [];
  if (r.asPaid && !r.compared) facts.push({ label: 'As paid, from the slip', value: money(r.paid), sub: r.asPaidAs ? 'its row “' + r.asPaidAs + '”, only read as this hand' : 'no payment for it on record' });
  else {
    if (r.compared) facts.push({ label: 'Earned, as the slip says', value: money(e.total), sub: 'the month’s payroll as paid' });
    else {
      if (w.comp === 'hourly' && e.hours) facts.push({ label: formatNum(e.hours, 1) + ' h × ' + money(e.base / e.hours), value: money(e.base) });
      else if (e.days) facts.push({ label: formatNum(e.days, 1) + ' day' + (e.days === 1 ? '' : 's') + ' × ' + money(e.base / e.days), value: money(e.base) });
      if (e.rest) facts.push({ label: 'Rest days' + (e.restDays ? ', ' + formatNum(e.restDays, 1) : ''), value: money(e.rest) });
      if (e.otHours) facts.push({ label: formatNum(e.otHours, 1) + ' h overtime × ' + money(e.ot / e.otHours), value: money(e.ot) });
      if (e.hourless) facts.push({ label: todoPlural(e.hourless, 'day') + ' present with no hours', value: money(0), sub: 'priced at nothing' });
      facts.push({ label: 'Earned', value: money(e.total) });
    }
    // Each payment for the period, the bank's and the typed (payPaymentsFor), so what was paid is seen, not only its sum.
    (r.pays || []).forEach(function(p) { facts.push(payPaymentFact(w, p)); });
    if (r.crossed) facts.push({ label: 'The bank legs crossed', value: null, src: ['warning', 'check'], sub: w.name + ' was paid what ' + r.crossed.name + ' earned' });
  }
  if (r.carried) facts.push({ label: r.carried > 0 ? 'Owed from before' : 'Advanced before', value: (r.carried > 0 ? '+ ' : '− ') + money(Math.abs(r.carried)),
    sub: (r.carry.parts || []).slice(-2).map(function(pt) { return payPartWords(w, pt); }).join('; ') });
  facts.push({ label: r.due < 0 ? 'Advance to work off' : 'Due', value: money(r.due) });
  var meta = r.asPaid && !r.compared ? 'as paid, from the slip' : 'earned ' + money(e.total) + (r.paid ? ' · paid ' + money(r.paid) : '');
  var key = 'pay-due-' + id;
  return '<details class="inv-row-fold" data-fold="' + escHtml(key) + '" data-pay-row="' + escHtml(id) + '"' + (uiFoldOpen(key, false) ? ' open' : '') + '>' +
    '<summary class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(w.name) +
    (w.active === false ? ' <span class="inv-badge inv-badge-neutral">Left</span>' : '') + '</span><span class="inv-row-meta">' + escHtml(meta) + '</span></span>' +
    '<span class="inv-row-end' + (r.due < 0 ? ' inv-row-end-stack' : '') + '"><span class="inv-num">' + payMoney(r.due) + '</span>' + (r.due < 0 ? '<span class="inv-dot inv-dot-warning">Advance</span>' : '') + '</span></summary>' +
    '<div class="inv-row-children">' + facts.map(uiFactRowHtml).join('') +
    // Its two moves on a line of their own (one look: a row's end holds one action).
    '<div class="inv-row-actions" data-row-more><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPayPick" data-id="' + escHtml(id) + '" data-due="' + r.due + '">' +
    (r.due > 0 ? 'Pay ' + payMoney(r.due) : 'Record a payment') + '</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPayHistory" data-id="' + escHtml(id) + '">History</button></div></div></details>';
}
/* One payment as a fact: the day, by bank or typed here, an advance said; a leg the bank's name only reads as this hand says so. */
function payPaymentFact(w, p) {
  return { label: (p.kind === 'advance' ? 'Advance ' : 'Paid ') + formatDate(p.date) + (p.how === 'bank' ? ', by bank' : ''),
    value: '− ' + formatCurrency(p.amount), src: p.guess ? ['warning', 'name read as'] : null,
    sub: p.how === 'bank' ? (p.typed ? 'also typed on Pay, counted once' : p.guess ? 'confirm the payee on the statement' : '') : p.note || '' };
}

/* The balances brought forward, each clearable with a reason ("stated otherwise"). */
function _payCarriedHtml(d) {
  var rows = d.rows.filter(function(r) { return r.carried; }), h = '';
  h += _payCarryFromRowHtml(d);
  if (rows.length) h += '<div class="inv-row-group">Brought forward</div>';
  rows.forEach(function(r) {
    var owed = r.carried > 0, parts = (r.carry.parts || []).slice(-2);
    // Two facts a line: what it is and since when; the months it is made of, each on a line of their own.
    h += _payRow(escHtml(r.w.name),
      (owed ? 'Owed' : 'Advanced') + ' from before ' + escHtml(formatDate(r.from)) + ' · counted since ' + escHtml(formatDate(r.carry.from)) +
        (r.carry.clear ? ' (cleared up to ' + escHtml(formatDate(r.carry.clear.through)) + ')' : '') +
        parts.map(function(pt) { return '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(payPartWords(r.w, pt)); }).join(''),
      '<span class="inv-row-stack"><span class="inv-num" data-pay-carried="' + escHtml(r.w.id) + '">' + payMoney(r.carried) + '</span><span class="inv-dot inv-dot-warning">' + (owed ? 'Owed' : 'Advance') + '</span></span>' +
        '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPayClear" data-id="' + escHtml(r.w.id) + '" data-through="' + escHtml(isoAddDays(r.from, -1)) + '" data-amount="' + r.carried + '">Clear</button>',
      ' data-carried-row="' + escHtml(r.w.id) + '"');
  });
  var clears = payCarryClears().filter(function(c) { return !c.voidedAt && d.rows.some(function(r) { return String(r.w.id) === String(c.staffId); }); });
  if (clears.length) {
    h += '<div class="inv-row-group">Balances cleared</div>';
    clears.slice().sort(function(a, b) { return (b.at || 0) - (a.at || 0); }).slice(0, 10).forEach(function(c) {
      var w = staffById(c.staffId);
      h += _payRow(escHtml(w ? w.name : 'Removed worker'), 'Up to ' + escHtml(formatDate(c.through)) + ' · ' + escHtml(c.reason || ''),
        '<span class="inv-num">' + payMoney(c.amount || 0) + '</span><button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPayClearVoid" data-id="' + escHtml(c.id) + '">Undo</button>',
        ' data-pay-clear="' + escHtml(c.id) + '"', 'inv-row-muted');
    });
  }
  return h;
}

/* Where monthly balances start, said on Pay with its Change; where none is set and the statement pays monthly hands, the one line
   that asks for it. Months before it are settled as they stand; from it on, what each month earned and what was paid for it
   carry to the next, the brought-forward lines naming each month. */
function _payCarryFromRowHtml(d) {
  var cf = payCarryFrom(), monthly = d.rows.filter(function(r) { return !r.weekly; });
  if (!monthly.length) return '';
  if (cf) return _payRow('Monthly balances', 'counted from ' + escHtml(_monthLabel(cf)) + ' · months before it are settled as they stand',
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPayCarryFrom">Change</button>', ' data-pay-carry-from="' + escHtml(cf) + '"');
  var legs = payBankLegs().filter(function(l) { var w = staffById(l.staffId); return w && !payIsWeekly(w); });
  if (!legs.length) return '';
  return _payRow('Salaries paid from the bank', 'counted as paid; a month paid more or less than it earned is not carried to the next until you say from which month',
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPayCarryFrom">Count from a month</button>', ' data-pay-carry-from=""');
}
/* The months a balance may start from: each month with a slip on record or a salary on the statement, to last month. */
function payCarryFromMonths() {
  var set = {}, last = payMonthStart(isoAddDays(payMonthStart(localDateStr()), -1)).slice(0, 7);
  // Only a month whose earnings are known (a slip, or attendance recorded): from one that has neither, every salary on the
  // statement would read as paid over.
  payrollPaidRecords().forEach(function(r) { if (!r.voidedAt && r.month <= last) set[r.month] = 1; });
  Object.keys(S.attendance || {}).forEach(function(d) { var m = d.slice(0, 7); if (/^\d{4}-\d{2}$/.test(m) && m <= last && Object.keys((S.attendance[d] || {}).marks || {}).length) set[m] = 1; });
  set[last] = 1;
  return Object.keys(set).sort().reverse();
}
function payCarryFromOpen() {
  if (!grdGate('payments', 'set where monthly balances start', payCarryFromOpen)) return;   // P1 (guard.js)
  var cf = payCarryFrom(), months = payCarryFromMonths();
  var dflt = cf || (payrollPaidRecords().filter(function(r) { return !r.voidedAt; }).map(function(r) { return r.month; }).sort().pop()) || months[0];
  dialogOpen('<div class="inv-dialog" role="dialog" aria-modal="true" aria-labelledby="payCfTitle" data-pay-carry-dialog>' + dialogHeadHtml('<span id="payCfTitle">Count monthly balances from</span>') +
    '<div class="inv-panel-body"><p class="inv-note">From this month on, what each monthly hand earned and what was paid for it (the bank&rsquo;s salaries and the payments typed here) carry to the next month: paid short is owed, paid over is taken back. Months before it are settled as they stand.</p>' +
    '<div class="inv-field"><label class="inv-field-label" for="payCfMonth">Month</label><select class="inv-select" id="payCfMonth">' +
    months.map(function(m) { return '<option value="' + m + '"' + (m === dflt ? ' selected' : '') + '>' + escHtml(_monthLabel(m)) + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="inv-dialog-foot">' + (cf ? '<button class="inv-btn inv-btn-ghost" data-action="invPayCarryFromOff">Stop counting</button>' : '') +
    '<button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPayCarryFromSave">Count from this month</button></div></div>', { dismiss: true });
}
function payCarryFromSave(off) {
  if (!grdGate('payments', 'set where monthly balances start')) return;
  var m = off ? '' : ((document.getElementById('payCfMonth') || {}).value || '');
  if (!off && !/^\d{4}-\d{2}$/.test(m)) { showToast('Pick a month', 'error'); return; }
  if (!S.labour) S.labour = {};
  S.labour.payCarryFrom = m;
  closeTopOverlay();
  saveState();
  renderAttendance();
  showToast(off ? 'Monthly balances are no longer carried' : 'Monthly balances counted from ' + _monthLabel(m));
}

var _payLast = null;   // the kind and date of the last payment recorded, carried to the next (several go in at a sitting)
function _payFormHtml(d) {
  var today = localDateStr();
  var defDate = _payLast && _payLast.date >= d.weekStart && _payLast.date <= d.sat ? _payLast.date : today >= d.weekStart && today <= d.sat ? today : d.sat;
  var f = function(id, label, control) { return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' + control + '</div>'; };
  // One look (TM4b): the form is one line until it is wanted (a hand's Pay opens it filled); open on the desktop, where it fits.
  return '<details class="inv-row-fold" data-fold="pay-form" id="payFormFold"' + (uiFoldOpen('pay-form', !!_isDesktop) ? ' open' : '') + '>' +
    '<summary class="inv-row"><span class="inv-row-main"><span class="inv-row-title">Record a payment</span></span></summary>' +
    '<div class="inv-panel-body" id="payForm"><div class="inv-fields">' +
    f('payWorker', 'Worker', '<select class="inv-select" id="payWorker"><option value="">Select&hellip;</option>' +
      d.rows.map(function(r) { return '<option value="' + escHtml(r.w.id) + '">' + escHtml(r.w.name) + '</option>'; }).join('') + '</select>') +
    f('payKind', 'Kind', '<select class="inv-select" id="payKind"><option value="payment">Payment</option><option value="advance"' + (_payLast && _payLast.kind === 'advance' ? ' selected' : '') + '>Advance</option></select>') +
    f('payAmount', 'Amount', '<input class="inv-input inv-input-num" id="payAmount" type="number" step="0.01" min="0" inputmode="decimal">') +
    f('payDate', 'Date', '<input class="inv-input inv-id" id="payDate" type="date" value="' + defDate + '">') +
    '</div>' + f('payNote', 'Note', '<input class="inv-input" id="payNote" placeholder="optional">') +
    '<button class="inv-btn inv-btn-primary" data-action="invPaySave">Save payment</button></div></details>';
}

function _payListHtml(d) {
  // A monthly hand's payment is listed in the month it is dated in and in the month it pays for, and says which it pays. The
  // bank's salary legs are listed too, without a Void: the statement is their record.
  var inPeriod = function(p) {
    var w = staffById(p.staffId);
    var weekly = payIsWeekly(w);
    return weekly ? (p.date >= d.weekStart && p.date <= d.sat) : (p.date >= d.mFrom && p.date <= d.mTo) || payMonthPaidFor(p) === d.mFrom;
  };
  var list = staffPayments().filter(inPeriod).concat(payBankLegs().filter(inPeriod))
    .sort(function(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.at || 0) - (a.at || 0); });
  if (!list.length) return '';
  var h = '<div class="inv-row-group">Payments in these periods</div>';
  list.forEach(function(p) {
    var w = staffById(p.staffId), forM = payIsWeekly(w) ? '' : payMonthPaidFor(p), bank = p.how === 'bank';
    // Two facts a line (§3b-11): the day and the kind; a note, or why it was voided, on a line of its own.
    var said = p.voidedAt ? 'void: ' + (p.voidReason || '') : bank ? (p.guess ? 'the statement’s name read as this hand' : '') : p.note || '';
    h += _payRow(escHtml(w ? w.name : 'Removed worker'),
      escHtml(formatDate(p.date)) + ' · ' + (bank ? 'by bank' : p.kind === 'advance' ? 'advance' : 'payment') +
        (forM && forM !== payMonthStart(p.date) ? ' for ' + escHtml(_monthLabel(forM.slice(0, 7))) : '') +
        (said ? '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(said) : ''),
      '<span class="inv-num">' + payMoney(Number(p.amount) || 0) + '</span>' +
        (p.voidedAt || bank ? '' : '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPayVoid" data-id="' + escHtml(p.id) + '">Void</button>'),
      ' data-payment="' + escHtml(p.id) + '"', p.voidedAt ? 'inv-row-muted' : '');
  });
  return h;
}

function _payHistoryCard(ws) {
  var weeks = [];
  for (var i = PAY_HISTORY_WEEKS - 1; i >= 0; i--) weeks.push(payWeek(isoAddDays(ws, -7 * i)));
  // The same median the forecast reads: the twelve weeks before this one.
  var median = payForecast(ws).median;
  var h = '<div class="inv-panel inv-panel-flush" id="payHistory"><div class="inv-panel-head"><span class="inv-panel-title">Weekly payouts</span>' +
    '<span class="inv-panel-count">median ' + (median == null ? '&mdash;' : payMoney(median)) + '</span></div>';
  // A week nobody typed is a gap, not a ₹0 week: chartStack draws no bar (and no ₹0 reading) for it.
  h += '<div class="inv-panel-body">' + chartStack(weeks.map(function(w) { return 'W' + attPayWeekNumber(w.start); }),
    [{ label: 'Payout', values: weeks.map(function(w) { return w.recordedDays || w.sundays ? w.total : null; }) }],
    { ariaLabel: 'Weekly payout', emptyText: 'No week recorded in the twelve' }) + '</div>';
  weeks.slice().reverse().forEach(function(w) {
    var swing = median != null && w.recordedDays > 0 ? gstRound(w.total - median) : null;
    // The row's figure and its change against the median at the end; the days and what was paid its two facts.
    h += _payRow('Week ' + attPayWeekNumber(w.start) + ' &middot; Sat ' + escHtml(formatDate(w.sat)),
      (w.recordedDays ? w.recordedDays + ' day' + (w.recordedDays === 1 ? '' : 's') + ' recorded' : 'nothing recorded') +
        (w.paid ? ' · paid ' + payMoney(w.paid) : ''),
      '<span class="inv-row-stack"><span class="inv-num">' + payMoney(w.total) + '</span>' + (swing != null ? '<span class="inv-row-meta inv-num" title="' + escHtml('against the median, ' + payMoney(median)) + '">' + paySigned(swing) + '</span>' : '') + '</span>', ' data-week="' + w.start + '"');
  });
  return h + '</div>';
}

/* ===== A hand's pay, period by period =====
   Owner, 10 Oct 2026: "no way to see and print the pay slip of each employee and/or what they have been paid". A hand's last twelve
   months (a weekly hand's weeks), newest first, from the first with anything in it: what was paid as the row's figure, its state
   as a word (paid, paid short, paid over, not paid, as the slip, to date), what it earned and what it left as its facts; opened,
   where the earnings came from, each payment, a crossing, the balance after it, and its slip. The figures are Pay's own
   (payPeriodRow, payCarried): nothing is worked out a second way. */
var PAY_HISTORY_PERIODS = 12;
function payHistoryRows(w) {
  var today = localDateStr(), weekly = payIsWeekly(w), lab = payLabMemo(), cf = weekly ? '' : payCarryFrom();
  var periods = [];
  for (var i = 0, p = payPeriodOf(w, today); i < PAY_HISTORY_PERIODS; i++) { periods.push(p); p = weekly ? isoAddDays(p, -7) : payMonthStart(isoAddDays(p, -1)); }
  var rows = periods.map(function(p) {
    var end = payPeriodEnd(w, p), running = end >= today;
    var row = payPeriodRow(w, p, end, lab(p, running ? today : end));
    row.running = running;
    row.counted = !running && (cf ? p >= cf + '-01' : null);
    return row;
  });
  // From the first period with anything in it: what came before it is nothing to show.
  while (rows.length && !rows[rows.length - 1].earned && !rows[rows.length - 1].pays.length && !rows[rows.length - 1].slip) rows.pop();
  rows.forEach(function(r) {
    var next = isoAddDays(r.to, 1);
    r.balanceAfter = r.running ? null : payCarried(w, next, lab);
  });
  return rows;
}
function payHistoryState(r) {
  if (r.running) return ['info', 'to date'];
  if (r.offSlip) return ['neutral', 'not on the slip'];
  if (r.slip && r.settled) return ['neutral', 'as the slip'];
  // Paid for a month whose earnings nobody recorded (the statement reaches back before the marks and the slips): what it earned
  // is not known, so neither is a difference.
  if (r.source === 'none' && r.pays.length) return ['neutral', 'no earnings recorded'];
  if (!r.pays.length) return r.earned ? ['warning', 'not paid'] : ['neutral', 'nothing'];
  return r.diff > 0 ? ['danger', 'paid short'] : r.diff < 0 ? ['warning', 'paid over'] : ['ok', 'paid'];
}
function payHistoryHtml(w) {
  var weekly = payIsWeekly(w), rows = payHistoryRows(w), cf = weekly ? '' : payCarryFrom(), lab = payLabMemo();
  var now = payCarried(w, payPeriodOf(w, localDateStr()), lab);
  var h = '<div class="inv-panel inv-panel-flush" data-pay-history="' + escHtml(String(w.id)) + '">';
  h += uiFactRowHtml({ label: Math.abs(now.amount) < 1 ? 'Nothing carried into this ' + (weekly ? 'week' : 'month') : now.amount > 0 ? 'Owed from before' : 'Advanced before, to work off',
    value: Math.abs(now.amount) < 1 ? null : formatCurrency(Math.abs(now.amount)),
    sub: weekly ? (payHandPays(w.id).length ? 'counted from the first payment typed for them' : 'no payment typed for them yet') :
      cf ? 'monthly balances counted from ' + _monthLabel(cf) : 'monthly balances are not counted yet: Pay, Count from a month',
    attrs: ' data-pay-history-now="' + gstRound(now.amount) + '"' });
  if (!rows.length) return h + '<div class="inv-empty">Nothing earned or paid in the last ' + PAY_HISTORY_PERIODS + (weekly ? ' weeks' : ' months') + '.</div></div>';
  rows.forEach(function(r) {
    var label = weekly ? 'Week ' + attPayWeekNumber(r.from) + ' · ' + formatDate(r.to) : _monthLabel(r.from.slice(0, 7));
    var st = payHistoryState(r), key = 'pay-hist-' + w.id + '-' + r.from;
    var facts = [{ label: r.slip ? 'Earned, as the slip says' : 'Earned', value: formatCurrency(r.earned), src: r.slip ? ['neutral', 'slip'] : r.source === 'marks' ? ['neutral', 'worked out'] : ['neutral', 'not recorded'] }];
    r.pays.forEach(function(p) { facts.push(payPaymentFact(w, p)); });
    var x = !weekly && r.diff ? payCrossedWith(w, r.from, r.to, r.lr) : null;
    if (x) facts.push({ label: 'The bank legs crossed', value: null, src: ['warning', 'check'], sub: w.name + ' was paid what ' + x.name + ' earned' });
    if (r.diff && !r.running && r.source !== 'none') facts.push({ label: r.diff > 0 ? (r.pays.length ? 'Paid short' : 'Not paid') : 'Paid over', value: formatCurrency(Math.abs(r.diff)),
      sub: r.counted === false ? 'before monthly balances are counted: not carried' : '' });
    if (r.balanceAfter && Math.abs(r.balanceAfter.amount) >= 1) facts.push({ label: r.balanceAfter.amount > 0 ? 'Owed after it' : 'Advanced after it', value: formatCurrency(Math.abs(r.balanceAfter.amount)) });
    var sub = (r.source === 'none' ? 'earnings not recorded' : 'earned ' + formatCurrency(r.earned)) +
      (r.diff && !r.running && r.source !== 'none' && r.pays.length ? ' · ' + (r.diff > 0 ? 'short ' : 'over ') + formatCurrency(Math.abs(r.diff)) : '');
    h += '<details class="inv-row-fold" data-fold="' + escHtml(key) + '" data-pay-period="' + escHtml(r.from) + '"' + (uiFoldOpen(key, false) ? ' open' : '') + '>' +
      '<summary class="inv-row inv-row-2">' + _uiFactInner({ label: label, value: formatCurrency(r.paid), src: st, sub: sub }) + '</summary>' +
      '<div class="inv-row-children">' + facts.map(uiFactRowHtml).join('') +
      '<div class="inv-row"><span class="inv-row-main"></span><span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPsOne" data-id="' + escHtml(String(w.id)) + '" data-from="' + escHtml(r.from) + '">Print the slip</button></span></div>' +
      '</div></details>';
  });
  return h + '</div>';
}
function payHistoryOpen(id) {
  var w = staffById(id);
  if (!w) return;
  if (typeof grdSeesWages === 'function' && !grdSeesWages()) { showToast('Your ID doesn’t open Pay', 'warning'); return; }
  dialogOpen('<div class="inv-dialog inv-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="payHistTitle" data-pay-history-dialog>' +
    dialogHeadHtml('<span id="payHistTitle">' + escHtml(w.name) + '’s pay</span>') +
    '<div class="inv-note">' + escHtml(compClass(w.comp).label + (payIsWeekly(w) ? ': the last ' + PAY_HISTORY_PERIODS + ' pay weeks, newest first' : ': the last ' + PAY_HISTORY_PERIODS + ' months, newest first') + '. Paid is the bank’s salaries and the payments typed on Pay.') + '</div>' +
    payHistoryHtml(w) +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Close</button></div></div>', { dismiss: true });
}

/* ===== The monthly payroll AS PAID =====

   Owner, 25 Sep 2026. A closed month of the monthly tier is not a thing to
   re-derive: somebody was paid against a slip, and the slip is the fact. The
   attendance model is a prediction of that slip — good enough for the month in
   progress, and wrong on every closed month whose marks were typed late, typed
   short, or paid on a rule that has since changed (July and August carry
   monthly OT the history never recorded: 30 h and 195 h against 0 and 11).

   So `S.payrollPaid` holds one record per closed month: what each hand was paid,
   split into day pay and OT, with where the figure came from. A month on record
   REPLACES the model's monthly tier for that month everywhere labour is read —
   the Pay view, the labour card, the live cost — and the month in progress is
   still modelled. A record is never edited or deleted: a later import for the
   same month voids the earlier one with a reason, the ledger rule every record
   here follows. The file is built privately from the slips and imported; wages
   never enter this public repo. */
function payrollPaidRecords() {
  if (!Array.isArray(S.payrollPaid)) S.payrollPaid = [];
  return S.payrollPaid;
}
function payrollPaidFor(month) {
  if (!Array.isArray(S.payrollPaid) || !(month < localDateStr().slice(0, 7))) return null;
  var rec = null;
  S.payrollPaid.forEach(function(r) {
    if (r.voidedAt || r.month !== month) return;
    if (!rec || (r.at || 0) > (rec.at || 0)) rec = r;
  });
  if (!rec) return null;
  var gross = (rec.rows || []).reduce(function(s, r) { return s + (Number(r.dayPay) || 0) + (Number(r.ot) || 0); }, 0);
  return { rec: rec, rows: rec.rows || [], gross: gstRound(gross), source: rec.source || '' };
}
/* A slip row's worker, by NAME the way a roll is read (relayRosterIndex / relayMatchName: the roster name and its
   bracket or dash variants, a spelling kept on the worker, a first name nobody else shares), never by the id a file
   carries: ids are per device. Only a sure match moves money; a spelling read only by its fold or one letter off is
   offered on the card as a guess (payrollMatch) and not used. The index is kept while the roster's names stand. */
var _payrollIdx = null, _payrollIdxSig = '';
function payrollRosterIndex() {
  var staff = S.staff || [];
  var sig = staff.map(function(w) { return w.id + ':' + w.name + ':' + (w.relayNames || []).join('|') + ':' + (w.aliases || []).join('|'); }).join(',');
  if (!_payrollIdx || sig !== _payrollIdxSig) { _payrollIdx = relayRosterIndex(staff); _payrollIdxSig = sig; }
  return _payrollIdx;
}
function payrollMatch(row) {
  var name = String((row && row.name) || '').trim();
  if (!relayKey(name)) return null;
  var idx = payrollRosterIndex(), whole = idx.byKey[relayKey(name)];
  if (whole) return { w: whole, sure: true };
  if (relayKey(name) in idx.byKey) return null;    // a name two workers share: neither
  var words = name.split(/[\s\-–,]+/).filter(Boolean), m = relayMatchName(words, idx, false);
  // On a roll the words after a name are the rest of the line; on a slip the field is all name, so a first name that
  // leaves words unexplained ("Ramu Kumar" for the roster's Ramu Singh) is a guess, not a match.
  return m && m.w ? { w: m.w, sure: !!m.sure && m.used >= words.length } : null;
}
function payrollWorker(row) {
  var m = payrollMatch(row);
  return m && m.sure ? m.w : null;
}
/* A slip's rows by the worker each names, worked out once (the wage check reads it per worker). */
function payrollRowsByWorker(rows) {
  var out = {};
  (rows || []).forEach(function(r) { var w = payrollWorker(r); if (w && !out[w.id]) out[w.id] = r; });
  return out;
}
/* Everything that makes one slip differ from another: each row's name as a roll reads it and every figure on it, the
   amount actually paid and its note, and the month's status and source. Name, day pay and OT alone let a corrected
   slip (a changed paid figure, a row's owed note) read as the one already on record and be skipped. */
function _payrollFingerprint(m) {
  var n = function(v) { return v == null || v === '' ? null : gstRound(Number(v) || 0); };
  return JSON.stringify([m.status || 'paid', String(m.source || ''), String(m.note || ''), (m.rows || []).map(function(r) {
    return [relayKey(r.name), n(r.rate), n(r.worked), n(r.restDays), n(r.dayPay), n(r.otHours), n(r.ot), n(r.paid), String(r.note || '')];
  }).sort()]);
}
/* Merge an import file. A month already on record with the same figures is
   skipped; one with different figures supersedes it, and the old record is
   voided with the reason — never overwritten. */
function payrollPaidImport(data) {
  if (!data || data.kind !== 'sep-payroll-paid' || !Array.isArray(data.months)) return { error: 'Not a payroll-as-paid file' };
  var out = { added: 0, superseded: 0, same: 0, bad: 0 };
  var now = Date.now();
  data.months.forEach(function(m, i) {
    if (!m || !/^\d{4}-\d{2}$/.test(m.month || '') || !Array.isArray(m.rows) || !m.rows.length) { out.bad++; return; }
    var rows = m.rows.filter(function(r) { return r && String(r.name || '').trim(); }).map(function(r) {
      return { name: String(r.name).trim(), staffId: r.staffId != null ? r.staffId : null,
        rate: Number(r.rate) || 0, worked: Number(r.worked) || 0, restDays: Number(r.restDays) || 0,
        dayPay: gstRound(Number(r.dayPay) || 0), otHours: Number(r.otHours) || 0, ot: gstRound(Number(r.ot) || 0),
        paid: r.paid != null ? gstRound(Number(r.paid) || 0) : null, note: String(r.note || '') };
    });
    var fp = _payrollFingerprint({ rows: rows, status: m.status === 'computed' ? 'computed' : 'paid', source: m.source, note: m.note });
    var live = payrollPaidRecords().filter(function(r) { return !r.voidedAt && r.month === m.month; });
    if (live.some(function(r) { return _payrollFingerprint(r) === fp; })) { out.same++; return; }
    live.forEach(function(r) {
      r.voidedAt = now;
      r.voidReason = 'Superseded by an import of ' + formatDate(localDateStr());
      out.superseded++;
    });
    payrollPaidRecords().push({ id: 'PRL-' + now.toString(36) + '-' + i, month: m.month, source: String(m.source || ''),
      status: m.status === 'computed' ? 'computed' : 'paid', note: String(m.note || ''), rows: rows, at: now + i });
    out.added++;
  });
  return out;
}
function payrollImport() {
  if (!grdGate('payments', 'import the payroll as paid', payrollImport)) return;   // P1 (guard.js)
  var inp = document.getElementById('payrollFileInput');
  if (!inp) return;
  inp.onchange = function(ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function(e2) { payrollImportText(e2.target.result, f.name); };
    reader.readAsText(f);
  };
  inp.click();
}
/* A sep-payroll-paid file's text, from Pay's Import or from Add → File (add.js). */
function payrollImportText(text, name) {
  var res;
  try { res = payrollPaidImport(JSON.parse(text)); } catch (err) { res = { error: 'Not a payroll-as-paid file' }; }
  if (res.error) { if (!addFileElsewhere(text, name, 'payroll')) showToast(res.error, 'error'); return; }
  saveState();
  renderAttendance();
  var bits = [];
  if (res.added) bits.push(res.added + ' month' + (res.added === 1 ? '' : 's') + ' recorded');
  if (res.superseded) bits.push(res.superseded + ' earlier record' + (res.superseded === 1 ? '' : 's') + ' voided');
  if (res.same) bits.push(res.same + ' already on record');
  showToast(bits.length ? bits.join(' · ') : 'Nothing in that file');
}
async function payrollVoid(id) {
  var r = payrollPaidRecords().find(function(x) { return x.id === id; });
  if (!r || r.voidedAt) return;
  if (!grdOk('voids') && !(await guardAsk('voids', 'void a month’s payroll record'))) return;   // P1 (guard.js)
  var reason = await uiPrompt({ title: 'Void this month’s record', body: 'It is kept, not deleted — the month goes back to the attendance model.',
    label: 'Why is this month’s record void?', okLabel: 'Void record', required: true, requiredText: 'A void needs a reason.' });
  if (reason == null || r.voidedAt) return;
  reason = reason.trim();
  if (!reason) { showToast('A void needs a reason', 'error'); return; }
  r.voidedAt = Date.now();
  r.voidReason = reason;
  saveState();
  renderAttendance();
  showToast('Record voided');
}
function _monthLabel(month) {
  return attParseIso(month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}
function _payrollPaidCard() {
  var recs = payrollPaidRecords().slice().sort(function(a, b) { return a.month < b.month ? 1 : a.month > b.month ? -1 : (b.at || 0) - (a.at || 0); });
  // Its Import is the toolbar's More (§1a-10: files behind More); what a month on record replaces is the guide's.
  var h = '<div class="inv-panel inv-panel-flush" id="payrollPaid"><div class="inv-panel-head"><span class="inv-panel-title">Monthly payroll as paid</span>' +
    '<span class="inv-panel-count">' + recs.filter(function(r) { return !r.voidedAt; }).length + '</span></div>';
  if (!recs.length) return h + '<div class="inv-empty">No closed month on record: the monthly tier is worked out from the marks.</div></div>';
  recs.forEach(function(r) {
    var gross = r.rows.reduce(function(s, x) { return s + (Number(x.dayPay) || 0) + (Number(x.ot) || 0); }, 0);
    var otH = r.rows.reduce(function(s, x) { return s + (Number(x.otHours) || 0); }, 0);
    // A name the roster does not hold is said, with the roll reader's guess where it has one: the guess moves no money
    // until the spelling is kept on the worker.
    var unmatched = r.rows.filter(function(x) { return !payrollWorker(x); }).map(function(x) {
      var m = payrollMatch(x);
      return x.name + (m ? ' (read as ' + m.w.name + '? keep the spelling on the worker to use it)' : '');
    });
    // Two facts a line: its hands and how it stands; then, each on a line of its own, where it came from (the slip it was paid
    // against: a title alone is never read on a phone), who the roster does not hold, its note, why it was voided.
    var lines = [r.source ? 'from ' + r.source : '', unmatched.length ? 'not on the roster: ' + unmatched.join(', ') : '', r.note || '', r.voidedAt ? 'void: ' + (r.voidReason || '') : ''].filter(Boolean);
    h += _payRow(escHtml(_monthLabel(r.month)),
      r.rows.length + ' hand' + (r.rows.length === 1 ? '' : 's') + (otH ? ', OT ' + formatNum(otH, 1) + ' h' : '') + (r.status === 'computed' ? ' · computed, not confirmed paid' : ' · as paid') +
        lines.map(function(l) { return '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(l); }).join(''),
      '<span class="inv-num">' + payMoney(gstRound(gross)) + '</span>' +
        (r.voidedAt ? '' : '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPayrollVoid" data-id="' + escHtml(r.id) + '">Void</button>'),
      '', r.voidedAt ? 'inv-row-muted' : '');
  });
  return h + '</div>';
}

/* ===== Actions ===== */
function payPick(id, due) {
  var fold = document.getElementById('payFormFold');
  if (fold && !fold.open) fold.open = true;
  var sel = document.getElementById('payWorker'), amt = document.getElementById('payAmount');
  if (sel) sel.value = String(id);
  if (amt) amt.value = due > 0 ? String(due) : '';
  if (amt) amt.focus();
}
function paySave() {
  var id = (document.getElementById('payWorker') || {}).value;
  var w = staffById(id);
  var amount = gstRound(parseFloat((document.getElementById('payAmount') || {}).value) || 0);
  var date = (document.getElementById('payDate') || {}).value;
  if (!w) { showToast('Pick a worker', 'error'); return; }
  if (!(amount > 0)) { showToast('Enter an amount', 'error'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) { showToast('Enter a date', 'error'); return; }
  if (!grdGate('payments', 'record a payment', paySave)) return;   // P1 (guard.js): a payment or an advance
  staffPayments().push({ id: 'PAY-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), staffId: w.id, date: date, amount: amount,
    kind: (document.getElementById('payKind') || {}).value === 'advance' ? 'advance' : 'payment',
    note: ((document.getElementById('payNote') || {}).value || '').trim(), at: Date.now() });
  _payLast = { date: date, kind: staffPayments()[staffPayments().length - 1].kind };
  saveState();
  renderAttendance();
  showToast('Recorded ' + formatCurrency(amount) + ' to ' + w.name);
}
async function payVoid(id) {
  var p = staffPayments().find(function(x) { return x.id === id; });
  if (!p || p.voidedAt) return;
  if (!grdOk('voids') && !(await guardAsk('voids', 'void a payment'))) return;   // P1 (guard.js)
  var reason = await uiPrompt({ title: 'Void this payment', body: 'It is kept on the record, not deleted.', label: 'Why is this payment void?',
    okLabel: 'Void payment', required: true, requiredText: 'A void needs a reason.' });
  if (reason == null || p.voidedAt) return;
  reason = reason.trim();
  if (!reason) { showToast('A void needs a reason', 'error'); return; }
  p.voidedAt = Date.now();
  p.voidReason = reason;
  saveState();
  renderAttendance();
  showToast('Payment voided');
}
async function payClear(id, through, amount) {
  var w = staffById(id);
  if (!w || !/^\d{4}-\d{2}-\d{2}$/.test(through || '')) return;
  if (!grdOk('payments') && !(await guardAsk('payments', 'clear a carried balance'))) return;   // P1 (guard.js)
  var reason = await uiPrompt({ title: 'Clear ' + w.name + '’s balance',
    body: (amount > 0 ? formatCurrency(amount) + ' owed' : formatCurrency(-amount) + ' advanced') + ' up to ' + formatDate(through) +
      ' stops carrying forward. It is kept on the record, and can be undone.',
    label: 'Why is it cleared?', okLabel: 'Clear balance', required: true, requiredText: 'Clearing a balance needs a reason.' });
  if (reason == null) return;
  reason = reason.trim();
  if (!reason) { showToast('Clearing a balance needs a reason', 'error'); return; }
  payCarryClears().push({ id: 'PCC-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), staffId: w.id, through: through,
    amount: gstRound(amount), reason: reason, at: Date.now() });
  saveState();
  renderAttendance();
  showToast('Balance cleared for ' + w.name);
}
async function payClearVoid(id) {
  var c = payCarryClears().find(function(x) { return x.id === id; });
  if (!c || c.voidedAt) return;
  if (!grdOk('payments') && !(await guardAsk('payments', 'undo a cleared balance'))) return;   // P1 (guard.js)
  var ok = await uiConfirm({ title: 'Undo this clear?', body: 'The balance carries forward again.', okLabel: 'Undo clear' });
  if (!ok || c.voidedAt) return;
  c.voidedAt = Date.now();
  saveState();
  renderAttendance();
  showToast('Clear undone');
}
function payAction(action, btn) {
  switch (action) {
    case 'invPayPick': payPick(btn.dataset.id, parseFloat(btn.dataset.due) || 0); return true;
    case 'invPaySave': paySave(); return true;
    case 'invPayVoid': payVoid(btn.dataset.id); return true;
    case 'invPayClear': payClear(btn.dataset.id, btn.dataset.through, parseFloat(btn.dataset.amount) || 0); return true;
    case 'invPayClearVoid': payClearVoid(btn.dataset.id); return true;
    case 'invPayOpenAtt': homeQuick('attendance'); return true;
    case 'invPayrollImport': payrollImport(); return true;
    case 'invPayrollVoid': payrollVoid(btn.dataset.id); return true;
    case 'invPayHistory': payHistoryOpen(btn.dataset.id); return true;
    case 'invPayCarryFrom': payCarryFromOpen(); return true;
    case 'invPayCarryFromSave': payCarryFromSave(false); return true;
    case 'invPayCarryFromOff': payCarryFromSave(true); return true;
  }
  return false;
}

/* ===== Hours by area =====
   How many hours each area was worked, every tier together: the hours on each
   mark (a day marked present with no hours counts 8, a half day 4, and the card
   says how many were counted that way), its OT among them, and the EXTRA booked
   to the area. Heads say who stood where; hours say what the area consumed. */
function areaHoursForRange(from, to) {
  var by = {}, assumed = 0;
  var get = function(id) { return by[id] || (by[id] = { id: id, hours: 0, ot: 0, extra: 0, workerDays: 0, assumed: 0 }); };
  attDatesInRange(from, to).forEach(function(iso) {
    var rec = (S.attendance || {})[iso];
    if (!rec) return;
    Object.keys(rec.marks || {}).forEach(function(id) {
      var m = rec.marks[id];
      if (!m || (m.st !== 'P' && m.st !== 'H')) return;
      var w = staffById(id);
      var a = get(m.area || (w && w.area) || 'flex');
      // A mark with no hours counts the day (8, a half day 4) and its OT on top: OT is part of a day's hours.
      var hrs = m.hours > 0 ? m.hours : (m.st === 'H' ? 4 : 8) + (m.ot || 0);
      if (!(m.hours > 0)) { a.assumed++; assumed++; }
      // The overtime where it was worked, as Labour and the Areas card place it (attHoursSplit, staff.js): a monthly or daily
      // hand's OT to their OT slot's area, an hourly hand's hours past eight on a slot to the slot's. Those hours are not
      // overtime: the hourly tier has none (every hour at one rate), so they move as hours and are never counted as OT.
      var sp = attHoursSplit(rec, w, m), late = Math.min(hrs, sp.otHours), o = get(sp.otArea);
      a.hours += hrs - late;
      o.hours += late;
      if (!(w && w.comp === 'hourly')) o.ot += late;
      a.workerDays += m.st === 'H' ? 0.5 : 1;
    });
    // A block over several areas books to each of them evenly, as the Areas card splits it; it all went to the first.
    (rec.extra || []).forEach(function(x) {
      if (!(x.hours > 0)) return;
      var ids = extraAreas(x).filter(function(id) { return STAFF_AREAS.some(function(a) { return a.id === id; }); });
      if (!ids.length) ids = ['flex'];
      ids.forEach(function(id) { get(id).extra += x.hours / ids.length; });
    });
  });
  var rows = STAFF_AREAS.map(function(x) { var r = by[x.id]; if (r) r.label = x.label; return r; }).filter(Boolean);
  rows.forEach(function(r) { r.total = r.hours + r.extra; });
  rows.sort(function(a, b) { return b.total - a.total; });
  return { rows: rows, assumed: assumed, total: rows.reduce(function(s, r) { return s + r.total; }, 0) };
}

function areaHoursCard(from, to) {
  var r = areaHoursForRange(from, to);
  if (!r.rows.length) return '';
  var h = _labPanelHead('hours', 'Hours by area', formatNum(r.total, 1) + ' h', '', 'areaHours');
  // A table, an area a row (TM4f): its worker-days, the hours on its marks with the OT among them, the EXTRA booked to it and the
  // two together had been four facts in one line under each area's name.
  var cell = function(v) { return '<td class="inv-num">' + (v ? formatNum(v, 1) : '&mdash;') + '</td>'; };
  h += '<div class="inv-scroll-x"><table class="inv-table" data-area-hours><thead><tr><th class="inv-col-grow">Area</th>' +
    '<th class="inv-num" title="worker-days, a half day counted half">Days</th><th class="inv-num" title="hours on the marks">Hours</th>' +
    '<th class="inv-num" title="overtime, among the hours">OT</th><th class="inv-num" title="booked to the area">EXTRA</th><th class="inv-num">Total</th></tr></thead><tbody>' +
    r.rows.map(function(a) {
      return '<tr data-area-hours-row="' + escHtml(a.id) + '"><td>' + escHtml(a.label) + '</td>' + cell(a.workerDays) + cell(a.hours) + cell(a.ot) + cell(a.extra) +
        '<td class="inv-num">' + formatNum(a.total, 1) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  h += _labNote('Every tier together: the hours on each day&rsquo;s mark, where the worker stood that day, plus the EXTRA booked to the area.' +
    (r.assumed ? ' <strong>' + r.assumed + ' mark' + (r.assumed === 1 ? '' : 's') + '</strong> carried no hours and ' + (r.assumed === 1 ? 'is' : 'are') + ' counted as 8 (a half day as 4), with any OT on top.' : ''));
  return h + '</div>';
}

/* ===== Home: the day's attendance ===== */
/* One day's attendance, read once: Home's card and Staff → Overview draw the same figures. The day is today,
   or the last day that has marks when nothing is typed today, and it says which. A day named (Floor → Day) is that day. */
function attDaySummary(day) {
  var today = localDateStr();
  var iso = day || today, rec = (S.attendance || {})[iso];
  var marked = function(r) { return r && Object.keys(r.marks || {}).length > 0; };
  if (!day && !marked(rec)) {
    var last = Object.keys(S.attendance || {}).filter(function(k) { return k < today && marked(S.attendance[k]); }).sort().pop();
    if (last) { iso = last; rec = S.attendance[last]; }
  }
  // The day's roster, as Staff → Day counts it: the active hands and anyone marked that day who has since left. The active
  // roster alone read 15/16 on Floor → Day and Home against Staff → Day's 16/17 for the same day (QA3-9).
  var roster = attDayRoster(rec);
  var out = { roster: roster, iso: iso, today: iso === today, marked: marked(rec), p: 0, half: 0, absent: [], unmarked: 0, floorHeads: 0, complement: 0, extraH: 0, short: false, byArea: {} };
  if (!out.marked) return out;
  roster.forEach(function(w) {
    var m = rec.marks[w.id];
    if (!m || !m.st) { out.unmarked++; return; }
    if (m.st === 'A') { out.absent.push(w.name); return; }
    if (m.st === 'H') out.half++; else out.p++;
    if (w.onFloor !== false && _areaIsFloor(m.area || w.area)) out.floorHeads++;
    var ar = m.area || w.area || 'flex';
    out.byArea[ar] = (out.byArea[ar] || 0) + 1;
  });
  // The floor's complement against the floor's heads: an office or gate complement is not a head on the floor.
  out.complement = STAFF_AREAS.reduce(function(s, a) { var t = a.floor ? areaNeedOn(iso, a.id) : null; return s + (t != null ? t : 0); }, 0);
  out.extraH = (rec.extra || []).reduce(function(s, x) { return s + (x.hours || 0); }, 0);
  out.short = !!out.complement && out.floorHeads < out.complement;
  return out;
}
/* How the day's attendance stands, one tone wherever it is drawn (the tab map, TM4a): on site against the day's roster at the
   rest-day gate's 90% and 80% (a day with hands unmarked is not judged on it), and warning when the floor is short of its
   number. Null when nothing judges it (nothing marked, or hands unmarked and the floor at its number). */
function attOnSiteTone(d) {
  if (!d || !d.marked) return null;
  var n = d.roster.length, tone = figTonePct(n && !d.unmarked ? (d.p + d.half) / n * 100 : null, 90, 80);
  if (d.short && tone !== 'danger') tone = 'warning';
  return tone;
}
/* The day's attendance as a panel. headBtn: the head's link; null, no head (a hero card above it says what the head would). */
function attDayPanelHtml(d, headBtn, id) {
  var h = '<div class="inv-panel inv-panel-flush"' + (id ? ' id="' + id + '"' : '') + '>' + (headBtn === null ? '' : '<div class="inv-panel-head"><span class="inv-panel-title">Attendance ' +
    '<span class="inv-note">' + (d.today ? 'today' : escHtml(attDayName(d.iso) + ' ' + formatDate(d.iso))) + '</span></span>' + (headBtn || '') + '</div>');
  if (!d.marked) return h + '<div class="inv-empty">Nothing recorded yet.</div></div>';
  // On site against the roster, judged at the rest-day gate's 90% and 80% and the floor's number (attOnSiteTone).
  var onTone = attOnSiteTone(d);
  h += '<div class="inv-tiles inv-tiles-flush">' +
    '<div class="inv-tile' + (onTone ? ' inv-tile-' + onTone : '') + '" data-att-onsite><div class="inv-tile-label">On site</div>' +
    '<div class="inv-tile-value"' + (id === 'homeAtt' ? ' id="homeAttOnSite"' : '') + '>' + (d.p + d.half) + '<span class="inv-tile-of">/' + d.roster.length + '</span></div>' +
    '<div class="inv-tile-sub">' + (d.half ? d.half + ' half day' + (d.half === 1 ? '' : 's') + ' · ' : '') + d.absent.length + ' absent' + (d.unmarked ? ' · ' + d.unmarked + ' unmarked' : '') + '</div></div>' +
    '<div class="inv-tile' + (d.short ? ' inv-tile-warning' : d.complement ? ' inv-tile-ok' : '') + '"><div class="inv-tile-label">On the floor</div>' +
    '<div class="inv-tile-value">' + d.floorHeads + (d.complement ? '<span class="inv-tile-of">/' + d.complement + '</span>' : '') + '</div>' +
    '<div class="inv-tile-sub">' + (d.complement ? (d.short ? (d.complement - d.floorHeads) + ' short of the complement' : 'against the complement') : 'no complement set') + '</div></div></div>';
  // Where everyone on site stood, every area the day has a hand in: the office, the gate, Flex and Civil as well as the
  // floor (owner, 30 Sep 2026: "Overview doesn't show any staff allocation for Office, gate, flex, civil").
  var alloc = STAFF_AREAS.filter(function(a) { return d.byArea[a.id] || (a.floor && a.id !== 'flex' && areaNeedOn(d.iso, a.id)); });
  Object.keys(d.byArea).forEach(function(k) { if (!STAFF_AREAS.some(function(a) { return a.id === k; })) alloc.push({ id: k, label: areaLabel(k), floor: false }); });
  if (alloc.length) {
    h += '<div class="inv-row inv-row-auto" data-att-alloc><span class="inv-row-main"><span class="inv-row-meta">By area</span><span class="inv-row-wrap">' +
      alloc.map(function(a) {
        var n = d.byArea[a.id] || 0, need = a.floor && a.id !== 'flex' ? areaNeedOn(d.iso, a.id) : null;
        var tone = need != null ? (n < need ? 'warning' : 'ok') : null;
        return '<span data-alloc="' + escHtml(a.id) + '">' + escHtml(a.label) + ' ' + figHtml('<span class="inv-num">' + n + (need != null ? '/' + need : '') + '</span>', tone) + '</span>';
      }).join(' · ') + '</span></span></div>';
  }
  if (d.absent.length) h += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-meta">Absent</span><span class="inv-row-wrap">' + escHtml(d.absent.join(', ')) + '</span></span></div>';
  if (d.extraH) h += '<div class="inv-row"><span class="inv-row-main">EXTRA booked</span><span class="inv-row-end inv-num">' + formatNum(d.extraH, 1) + ' h</span></div>';
  return h + '</div>';
}
/* Pulse's Attendance as a hero: who is on site against the roster, judged at the rest-day gate's 90% and 80%, the floor
   against its number, the day as a bar of present, half, absent and unmarked; the panel's tiles and rows under it. */
function renderAttHomeCard() {
  var el = document.getElementById('homeAttCard');
  if (!el) return;
  if (!staffActive().length) { el.innerHTML = ''; return; }
  var d = attDaySummary(), n = d.roster.length, on = d.p + d.half;
  var tone = attOnSiteTone(d);
  var meter = d.marked ? chartMeter([{ v: d.p, tone: 'ok' }, { v: d.half, tone: 'warning' }, { v: d.absent.length, tone: 'danger' }, { v: d.unmarked, tone: 'neutral' }],
    { title: d.p + ' present · ' + d.half + ' half day · ' + d.absent.length + ' absent' + (d.unmarked ? ' · ' + d.unmarked + ' unmarked' : '') }) : '';
  var floor = d.complement ? d.floorHeads + ' of ' + d.complement + ' on the floor' + (d.short ? ', ' + (d.complement - d.floorHeads) + ' short' : '') : '';
  el.innerHTML = uiHeroHtml({ tone: d.marked ? tone || 'ok' : 'neutral',
    eyebrow: '<span>Attendance</span><span class="inv-panel-count">' + (d.today ? 'today' : escHtml(attDayName(d.iso) + ' ' + formatDate(d.iso))) + '</span>',
    title: d.marked ? escHtml(on + ' of ' + n + ' on site') : 'Nothing recorded yet',
    sub: escHtml([floor, d.marked ? todoPlural(d.absent.length, 'absent', 'absent') : ''].filter(Boolean).join(' · ')), viz: meter,
    fold: 'pulse-attendance', open: !!_isDesktop, attrs: ' data-card="attendance"',
    body: d.marked ? '<div class="inv-hero-sheet">' + attDayPanelHtml(d, null, 'homeAtt') + '</div>' : null,
    foot: '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPayOpenAtt">Open</button>' });
}
