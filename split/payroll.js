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
  return attIso(d);
}
function payMedian(nums) {
  var a = nums.slice().sort(function(x, y) { return x - y; });
  if (!a.length) return null;
  var m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function payPaidBetween(staffId, from, to) {
  return gstRound(staffPayments().reduce(function(s, p) {
    if (p.voidedAt || String(p.staffId) !== String(staffId) || p.date < from || p.date > to) return s;
    return s + (Number(p.amount) || 0);
  }, 0));
}

/* One pay week's payout: the weekly tiers' earnings plus the EXTRA pool. */
function payWeek(weekStart) {
  var sat = attAddDays(weekStart, 6);
  var lab = labourForRange(weekStart, sat);
  var workers = 0;
  Object.keys(lab.byWorker).forEach(function(id) {
    var b = lab.byWorker[id];
    if (b.comp !== 'monthly') workers += b.total;
  });
  var paid = 0;
  staffPayments().forEach(function(p) {
    if (p.voidedAt || p.date < weekStart || p.date > sat) return;
    if (payIsWeekly(staffById(p.staffId) || (S.staff || []).find(function(w) { return String(w.id) === String(p.staffId); }))) paid += Number(p.amount) || 0;
  });
  return { start: weekStart, sat: sat, lab: lab, workers: gstRound(workers), extra: lab.extra,
    total: gstRound(workers + lab.extra), paid: gstRound(paid),
    recordedDays: lab.daysRecorded, sundays: lab.sundaysRecorded };
}

/* The payout the week is heading for, and the usual it is read against. */
function payForecast(weekStart) {
  var today = localDateStr();
  var wk = payWeek(weekStart);
  var past = [];
  for (var i = 1; i <= PAY_HISTORY_WEEKS; i++) {
    var p = payWeek(attAddDays(weekStart, -7 * i));
    if (p.recordedDays > 0) past.push(p.total);
  }
  var median = payMedian(past);
  var open = wk.sat >= today;
  var out = { week: wk, median: median, medianWeeks: past.length, open: open, predicted: wk.total, basis: 'recorded' };
  if (open) {
    var sunOnly = labourForRange(weekStart, weekStart), sunPay = 0;
    Object.keys(sunOnly.byWorker).forEach(function(id) { if (sunOnly.byWorker[id].comp !== 'monthly') sunPay += sunOnly.byWorker[id].total; });
    sunPay += sunOnly.extra;
    var missing = 6 - wk.recordedDays;
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
  var sat = attAddDays(weekStart, 6);
  var mFrom = payMonthStart(sat), mTo = payMonthEnd(sat);
  var wk = labourForRange(weekStart, sat);
  var mo = labourForRange(mFrom, mTo > today && mFrom <= today ? today : mTo);
  var rows = staffActive().map(function(w) {
    var weekly = payIsWeekly(w);
    var e = (weekly ? wk : mo).byWorker[w.id] || { total: 0, days: 0, hours: 0, otHours: 0, base: 0, ot: 0, rest: 0 };
    var from = weekly ? weekStart : mFrom, to = weekly ? sat : mTo;
    var paid = payPaidBetween(w.id, from, to);
    // A closed month on record as paid is settled by the slip: what it paid is
    // what was earned, so nothing is due on it however the marks read.
    if (!weekly && e.asPaid) return { w: w, weekly: weekly, earned: e, paid: e.total, due: 0, from: from, to: to, asPaid: true };
    return { w: w, weekly: weekly, earned: e, paid: paid, due: gstRound(e.total - paid), from: from, to: to };
  });
  return { rows: rows, extra: wk.extra, extraHours: wk.extraHours, weekStart: weekStart, sat: sat, mFrom: mFrom, mTo: mTo };
}

function payMoney(n) { return escHtml(formatCurrency(n)); }
function paySigned(n) { return (n > 0 ? '+' : n < 0 ? '&minus;' : '') + escHtml(formatCurrency(Math.abs(n))); }

function _attPayView() {
  var ws = _attWeekStart, sat = attAddDays(ws, 6);
  var html = '<div class="inv-att-nav">' +
    '<button class="inv-att-nav-btn" data-action="invAttWeekStep" data-step="-1" aria-label="Previous week">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>' +
    '<div class="inv-att-nav-label"><span class="inv-att-week-num">Week ' + attPayWeekNumber(ws) + '</span>' +
    '<span class="inv-att-nav-day">Paid Sat ' + formatDate(sat) + '</span></div>' +
    '<button class="inv-att-nav-btn" data-action="invAttWeekStep" data-step="1" aria-label="Next week">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAttThisWeek">This week</button>' +
    '</div>';
  html += _payForecastCard(ws);
  html += _payDueCard(ws);
  html += _payHistoryCard(ws);
  html += _payrollPaidCard();
  // The bank's side of the same payroll (Finance → Payments draws the same panel).
  if (finHasBank()) html += finWagesHtml(finCtx().cls, 'pay');
  return html;
}

function _payForecastCard(ws) {
  var f = payForecast(ws), wk = f.week;
  var tone = f.swing == null ? 'inv-pay-blue' : (f.swingPct != null && f.swingPct > 0.15 ? 'inv-area-gap-over'
    : (f.swingPct != null && f.swingPct < -0.15 ? 'inv-area-gap-under' : 'inv-pay-blue'));
  var h = '<div class="inv-card inv-pay-card" id="payForecast"><div class="inv-card-header"><span class="inv-card-title">Weekly payout</span>' +
    '<span class="inv-lab-total inv-mono">' + payMoney(f.open ? f.predicted : wk.total) + '</span></div>' +
    '<div class="inv-lab-split">' +
    '<div class="inv-lab-half inv-pay-green"><div class="inv-lab-half-label">' + (f.open ? 'So far' : 'The week') + '</div>' +
    '<div class="inv-lab-half-value inv-mono">' + payMoney(wk.total) + '</div>' +
    '<div class="inv-lab-half-sub">' + wk.recordedDays + ' of 6 working days recorded' + (wk.sundays ? ' + Sunday' : '') + '</div></div>' +
    '<div class="inv-lab-half ' + tone + '"><div class="inv-lab-half-label">' + (f.open ? 'Predicted' : 'Against the median') + '</div>' +
    '<div class="inv-lab-half-value inv-mono">' + (f.open ? payMoney(f.predicted) : (f.swing == null ? '&mdash;' : paySigned(f.swing))) + '</div>' +
    '<div class="inv-lab-half-sub">' + (f.open
      ? (f.basis === 'pace' ? f.missing + ' day' + (f.missing === 1 ? '' : 's') + ' at this week&rsquo;s pace, ' + payMoney(f.pace) + '/day'
        : f.basis === 'median' ? 'nothing recorded yet: the median stands in' : 'every working day recorded')
      : (f.swingPct == null ? 'no earlier weeks to compare' : (f.swing >= 0 ? '+' : '&minus;') + formatNum(Math.abs(f.swingPct) * 100, 0) + '% of the median')) + '</div></div></div>';
  h += '<div class="inv-lab-row"><span class="inv-lab-label">Median week<span class="inv-lab-sub">' +
    (f.medianWeeks ? 'of the ' + f.medianWeeks + ' recorded week' + (f.medianWeeks === 1 ? '' : 's') + ' in the ' + PAY_HISTORY_WEEKS + ' before' : 'no recorded weeks before this one') +
    '</span></span><span class="inv-lab-value inv-mono">' + (f.median == null ? '&mdash;' : payMoney(f.median)) + '</span></div>';
  if (f.open && f.swing != null) {
    h += '<div class="inv-lab-row"><span class="inv-lab-label">Swing from the median<span class="inv-lab-sub">predicted less median</span></span>' +
      '<span class="inv-lab-value inv-mono" id="paySwing">' + paySigned(f.swing) + ' (' + (f.swing >= 0 ? '+' : '&minus;') + formatNum(Math.abs(f.swingPct) * 100, 0) + '%)</span></div>';
  }
  h += '<div class="inv-lab-row"><span class="inv-lab-label">Hourly and daily tiers<span class="inv-lab-sub">their pay, OT and rest credit</span></span><span class="inv-lab-value inv-mono">' + payMoney(wk.workers) + '</span></div>' +
    '<div class="inv-lab-row"><span class="inv-lab-label">EXTRA pool<span class="inv-lab-sub">' + formatNum(wk.lab.extraHours, 1) + ' h, disbursed by the supervisor</span></span><span class="inv-lab-value inv-mono">' + payMoney(wk.extra) + '</span></div>' +
    '<div class="inv-stats-note">The weekly tiers and the EXTRA pool, as recorded. The monthly tier is paid by the month and is in the due list below, not here. A day nobody typed is not a day nobody worked: the prediction fills unrecorded days at the week&rsquo;s pace, and the figure so far reads low until they are in.</div>';
  return h + '</div>';
}

function _payDueCard(ws) {
  var d = payDue(ws);
  var monthName = attParseIso(d.mFrom).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  var h = '<div class="inv-card inv-pay-card" id="payDue"><div class="inv-card-header"><span class="inv-card-title">Due by worker</span></div>';
  var group = function(title, rows) {
    if (!rows.length) return '';
    var tot = rows.reduce(function(s, r) { return s + r.due; }, 0);
    var g = '<div class="inv-stk-label inv-mt-8">' + title + '</div>';
    rows.forEach(function(r) {
      var e = r.earned, bits = [];
      if (e.days) bits.push(formatNum(e.days, 1) + ' day' + (e.days === 1 ? '' : 's'));
      if (r.w.comp === 'hourly' && e.hours) bits.push(formatNum(e.hours, 1) + ' h');
      if (e.otHours) bits.push('OT ' + formatNum(e.otHours, 1) + ' h');
      if (e.rest) bits.push('rest ' + payMoney(e.rest));
      g += '<button class="inv-lab-row inv-pay-row" data-action="invPayPick" data-id="' + escHtml(r.w.id) + '" data-due="' + r.due + '">' +
        '<span class="inv-lab-label">' + escHtml(r.w.name) + '<span class="inv-lab-sub">' +
        (bits.length ? bits.join(' · ') + ' · ' : 'nothing recorded · ') + 'earned ' + payMoney(e.total) +
        (r.asPaid ? ' · as paid, from the slip' : r.paid ? ' &minus; paid ' + payMoney(r.paid) : '') + '</span></span>' +
        '<span class="inv-lab-value inv-mono' + (r.due < 0 ? ' inv-pay-over' : '') + '">' + payMoney(r.due) + '</span></button>';
    });
    g += '<div class="inv-lab-row inv-pay-total"><span class="inv-lab-label">Total due</span><span class="inv-lab-value inv-mono">' + payMoney(gstRound(tot)) + '</span></div>';
    return g;
  };
  h += group('Weekly &middot; paid Sat ' + formatDate(d.sat), d.rows.filter(function(r) { return r.weekly; }));
  h += group('Monthly &middot; ' + escHtml(monthName), d.rows.filter(function(r) { return !r.weekly; }));
  h += '<div class="inv-stats-note">Earned is worked out from the days recorded, on the labour card&rsquo;s own rates. A negative due is an advance not yet worked off. Tap a worker to pay what is due.</div>';
  h += _payFormHtml(d);
  h += _payListHtml(d);
  return h + '</div>';
}

function _payFormHtml(d) {
  var today = localDateStr();
  var defDate = today >= d.weekStart && today <= d.sat ? today : d.sat;
  return '<div class="inv-stk-label inv-mt-8">Record a payment</div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label" for="payWorker">Worker</label>' +
    '<select class="inv-form-select" id="payWorker"><option value="">Select&hellip;</option>' +
    staffActive().map(function(w) { return '<option value="' + escHtml(w.id) + '">' + escHtml(w.name) + '</option>'; }).join('') + '</select></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="payKind">Kind</label>' +
    '<select class="inv-form-select" id="payKind"><option value="payment">Payment</option><option value="advance">Advance</option></select></div></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label" for="payAmount">Amount</label>' +
    '<input class="inv-form-input inv-mono" id="payAmount" type="number" step="0.01" min="0" inputmode="decimal"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="payDate">Date</label>' +
    '<input class="inv-form-input" id="payDate" type="date" value="' + defDate + '"></div></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="payNote">Note</label>' +
    '<input class="inv-form-input" id="payNote" placeholder="optional"></div>' +
    '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invPaySave">Save payment</button>';
}

function _payListHtml(d) {
  var list = staffPayments().filter(function(p) {
    var w = (S.staff || []).find(function(x) { return String(x.id) === String(p.staffId); });
    var weekly = payIsWeekly(w);
    return weekly ? (p.date >= d.weekStart && p.date <= d.sat) : (p.date >= d.mFrom && p.date <= d.mTo);
  }).sort(function(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.at || 0) - (a.at || 0); });
  if (!list.length) return '';
  var h = '<div class="inv-stk-label inv-mt-8">Payments in these periods</div>';
  list.forEach(function(p) {
    var w = (S.staff || []).find(function(x) { return String(x.id) === String(p.staffId); });
    h += '<div class="inv-lab-row' + (p.voidedAt ? ' inv-pay-void' : '') + '"><span class="inv-lab-label">' + escHtml(w ? w.name : 'Removed worker') +
      '<span class="inv-lab-sub">' + escHtml(formatDate(p.date)) + ' · ' + (p.kind === 'advance' ? 'Advance' : 'Payment') +
      (p.note ? ' · ' + escHtml(p.note) : '') + (p.voidedAt ? ' · void: ' + escHtml(p.voidReason || '') : '') + '</span></span>' +
      '<span class="inv-lab-value inv-mono">' + payMoney(Number(p.amount) || 0) +
      (p.voidedAt ? '' : ' <button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPayVoid" data-id="' + escHtml(p.id) + '">Void</button>') + '</span></div>';
  });
  return h;
}

function _payHistoryCard(ws) {
  var weeks = [];
  for (var i = PAY_HISTORY_WEEKS - 1; i >= 0; i--) weeks.push(payWeek(attAddDays(ws, -7 * i)));
  // The same median the forecast reads: the twelve weeks before this one.
  var median = payForecast(ws).median;
  var h = '<div class="inv-card inv-pay-card" id="payHistory"><div class="inv-card-header"><span class="inv-card-title">Weekly payouts</span>' +
    '<span class="inv-lab-sub">median ' + (median == null ? '&mdash;' : payMoney(median)) + '</span></div>';
  h += '<div class="inv-pay-chart">' + chartBars(weeks.map(function(w) { return { label: 'W' + attPayWeekNumber(w.start), value: w.total }; }), { ariaLabel: 'Weekly payout' }) + '</div>';
  weeks.slice().reverse().forEach(function(w) {
    var swing = median != null && w.recordedDays > 0 ? gstRound(w.total - median) : null;
    h += '<div class="inv-lab-row inv-pay-week"><span class="inv-lab-label">Week ' + attPayWeekNumber(w.start) + ' &middot; Sat ' + escHtml(formatDate(w.sat)) +
      '<span class="inv-lab-sub">' + (w.recordedDays ? w.recordedDays + ' day' + (w.recordedDays === 1 ? '' : 's') + ' recorded' : 'nothing recorded') +
      (w.paid ? ' · paid ' + payMoney(w.paid) : '') +
      (swing != null ? ' · ' + paySigned(swing) + ' against the median' : '') + '</span></span>' +
      '<span class="inv-lab-value inv-mono">' + payMoney(w.total) + '</span></div>';
  });
  return h + '</div>';
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
function payrollWorker(row) {
  var staff = S.staff || [];
  if (row.staffId != null) {
    var byId = staff.find(function(w) { return String(w.id) === String(row.staffId); });
    if (byId) return byId;
  }
  var k = relayKey(row.name || '');
  if (!k) return null;
  return staff.find(function(w) {
    return relayKey(w.name) === k || (w.relayNames || []).some(function(n) { return relayKey(n) === k; });
  }) || null;
}
function _payrollFingerprint(m) {
  return JSON.stringify((m.rows || []).map(function(r) {
    return [String(r.name || '').toUpperCase(), gstRound(Number(r.dayPay) || 0), gstRound(Number(r.ot) || 0)];
  }).sort());
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
    var fp = _payrollFingerprint({ rows: rows });
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
  var inp = document.getElementById('payrollFileInput');
  if (!inp) return;
  inp.onchange = function(ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function(e2) {
      var res;
      try { res = payrollPaidImport(JSON.parse(e2.target.result)); } catch (err) { res = { error: 'Not a payroll-as-paid file' }; }
      if (res.error) { showToast(res.error, 'error'); return; }
      saveState();
      renderAttendance();
      var bits = [];
      if (res.added) bits.push(res.added + ' month' + (res.added === 1 ? '' : 's') + ' recorded');
      if (res.superseded) bits.push(res.superseded + ' earlier record' + (res.superseded === 1 ? '' : 's') + ' voided');
      if (res.same) bits.push(res.same + ' already on record');
      showToast(bits.length ? bits.join(' · ') : 'Nothing in that file');
    };
    reader.readAsText(f);
  };
  inp.click();
}
function payrollVoid(id) {
  var r = payrollPaidRecords().find(function(x) { return x.id === id; });
  if (!r || r.voidedAt) return;
  var reason = prompt('Why is this month’s record void? (kept, not deleted — the month goes back to the attendance model)');
  if (reason == null) return;
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
  var h = '<div class="inv-card inv-pay-card" id="payrollPaid"><div class="inv-card-header"><span class="inv-card-title">Monthly payroll as paid</span>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPayrollImport">Import</button>' +
    '<input type="file" accept=".json,application/json" id="payrollFileInput" class="inv-hidden"></div>';
  if (!recs.length) {
    h += '<div class="inv-stats-note">No closed month is on record, so every month of the monthly tier is worked out from ' +
      'the attendance marks. Import the payroll file built from the slips and a closed month is read as it was paid.</div>';
    return h + '</div>';
  }
  recs.forEach(function(r) {
    var gross = r.rows.reduce(function(s, x) { return s + (Number(x.dayPay) || 0) + (Number(x.ot) || 0); }, 0);
    var otH = r.rows.reduce(function(s, x) { return s + (Number(x.otHours) || 0); }, 0);
    var unmatched = r.rows.filter(function(x) { return !payrollWorker(x); }).map(function(x) { return x.name; });
    h += '<div class="inv-lab-row' + (r.voidedAt ? ' inv-pay-void' : '') + '"><span class="inv-lab-label">' + escHtml(_monthLabel(r.month)) +
      '<span class="inv-lab-sub">' + r.rows.length + ' hand' + (r.rows.length === 1 ? '' : 's') +
      (otH ? ' · OT ' + formatNum(otH, 1) + ' h' : '') + (r.status === 'computed' ? ' · computed, not confirmed paid' : ' · as paid') +
      (r.source ? ' · ' + escHtml(r.source) : '') +
      (unmatched.length ? ' · not on the roster: ' + escHtml(unmatched.join(', ')) : '') +
      (r.note ? ' · ' + escHtml(r.note) : '') +
      (r.voidedAt ? ' · void: ' + escHtml(r.voidReason || '') : '') + '</span></span>' +
      '<span class="inv-lab-value inv-mono">' + payMoney(gstRound(gross)) +
      (r.voidedAt ? '' : ' <button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPayrollVoid" data-id="' + escHtml(r.id) + '">Void</button>') + '</span></div>';
  });
  h += '<div class="inv-stats-note">A closed month on record replaces the attendance model for the monthly tier &mdash; ' +
    'here, on the labour card and in the live cost &mdash; for the hands it names; a monthly hand it does not name is still modelled. ' +
    'The month in progress is always modelled.</div>';
  return h + '</div>';
}

/* ===== Actions ===== */
function payPick(id, due) {
  var sel = document.getElementById('payWorker'), amt = document.getElementById('payAmount');
  if (sel) sel.value = String(id);
  if (amt) amt.value = due > 0 ? String(due) : '';
  if (amt) amt.focus();
}
function paySave() {
  var id = (document.getElementById('payWorker') || {}).value;
  var w = (S.staff || []).find(function(x) { return String(x.id) === String(id); });
  var amount = gstRound(parseFloat((document.getElementById('payAmount') || {}).value) || 0);
  var date = (document.getElementById('payDate') || {}).value;
  if (!w) { showToast('Pick a worker', 'error'); return; }
  if (!(amount > 0)) { showToast('Enter an amount', 'error'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) { showToast('Enter a date', 'error'); return; }
  staffPayments().push({ id: 'PAY-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), staffId: w.id, date: date, amount: amount,
    kind: (document.getElementById('payKind') || {}).value === 'advance' ? 'advance' : 'payment',
    note: ((document.getElementById('payNote') || {}).value || '').trim(), at: Date.now() });
  saveState();
  renderAttendance();
  showToast('Recorded ' + formatCurrency(amount) + ' to ' + w.name);
}
function payVoid(id) {
  var p = staffPayments().find(function(x) { return x.id === id; });
  if (!p || p.voidedAt) return;
  var reason = prompt('Why is this payment void? (kept on the record, not deleted)');
  if (reason == null) return;
  reason = reason.trim();
  if (!reason) { showToast('A void needs a reason', 'error'); return; }
  p.voidedAt = Date.now();
  p.voidReason = reason;
  saveState();
  renderAttendance();
  showToast('Payment voided');
}
function payAction(action, btn) {
  switch (action) {
    case 'invPayPick': payPick(btn.dataset.id, parseFloat(btn.dataset.due) || 0); return true;
    case 'invPaySave': paySave(); return true;
    case 'invPayVoid': payVoid(btn.dataset.id); return true;
    case 'invPayOpenAtt': homeQuick('attendance'); return true;
    case 'invPayrollImport': payrollImport(); return true;
    case 'invPayrollVoid': payrollVoid(btn.dataset.id); return true;
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
      var w = (S.staff || []).find(function(x) { return String(x.id) === String(id); });
      var a = get(m.area || (w && w.area) || 'flex');
      var hrs = m.hours > 0 ? m.hours : (m.st === 'H' ? 4 : 8);
      if (!(m.hours > 0)) { a.assumed++; assumed++; }
      a.hours += hrs;
      a.ot += m.ot || 0;
      a.workerDays += m.st === 'H' ? 0.5 : 1;
    });
    (rec.extra || []).forEach(function(x) { if (x.hours > 0) get(x.area || 'flex').extra += x.hours; });
  });
  var rows = STAFF_AREAS.map(function(x) { var r = by[x.id]; if (r) r.label = x.label; return r; }).filter(Boolean);
  rows.forEach(function(r) { r.total = r.hours + r.extra; });
  rows.sort(function(a, b) { return b.total - a.total; });
  return { rows: rows, assumed: assumed, total: rows.reduce(function(s, r) { return s + r.total; }, 0) };
}

function areaHoursCard(from, to) {
  var r = areaHoursForRange(from, to);
  if (!r.rows.length) return '';
  var h = '<div class="inv-card inv-pay-card" id="areaHours"><div class="inv-card-header"><span class="inv-card-title">Hours by area</span>' +
    '<span class="inv-lab-total inv-mono">' + formatNum(r.total, 1) + ' h</span></div>';
  r.rows.forEach(function(a) {
    var bits = [formatNum(a.workerDays, 1) + ' worker-day' + (a.workerDays === 1 ? '' : 's'), formatNum(a.hours, 1) + ' h worked'];
    if (a.ot) bits.push('OT ' + formatNum(a.ot, 1) + ' h of it');
    if (a.extra) bits.push('EXTRA ' + formatNum(a.extra, 1) + ' h');
    h += '<div class="inv-lab-row"><span class="inv-lab-label">' + escHtml(a.label) + '<span class="inv-lab-sub">' + bits.join(' · ') + '</span></span>' +
      '<span class="inv-lab-value inv-mono">' + formatNum(a.total, 1) + ' h</span></div>';
  });
  h += '<div class="inv-stats-note">Every tier together: the hours on each day&rsquo;s mark, where the worker stood that day, plus the EXTRA booked to the area.' +
    (r.assumed ? ' <strong>' + r.assumed + ' mark' + (r.assumed === 1 ? '' : 's') + '</strong> carried no hours and ' + (r.assumed === 1 ? 'is' : 'are') + ' counted as 8 (a half day as 4).' : '') + '</div>';
  return h + '</div>';
}

/* ===== Home: the day's attendance ===== */
/* One day's attendance, read once: Home's card and Staff → Overview draw the same figures. The day is today,
   or the last day that has marks when nothing is typed today, and it says which. */
function attDaySummary() {
  var roster = staffActive();
  var today = localDateStr();
  var iso = today, rec = (S.attendance || {})[today];
  var marked = function(r) { return r && Object.keys(r.marks || {}).length > 0; };
  if (!marked(rec)) {
    var last = Object.keys(S.attendance || {}).filter(function(k) { return k < today && marked(S.attendance[k]); }).sort().pop();
    if (last) { iso = last; rec = S.attendance[last]; }
  }
  var out = { roster: roster, iso: iso, today: iso === today, marked: marked(rec), p: 0, half: 0, absent: [], unmarked: 0, floorHeads: 0, complement: 0, extraH: 0, short: false };
  if (!out.marked) return out;
  roster.forEach(function(w) {
    var m = rec.marks[w.id];
    if (!m || !m.st) { out.unmarked++; return; }
    if (m.st === 'A') { out.absent.push(w.name); return; }
    if (m.st === 'H') out.half++; else out.p++;
    if (w.onFloor !== false && _areaIsFloor(m.area || w.area)) out.floorHeads++;
  });
  out.complement = STAFF_AREAS.reduce(function(s, a) { var t = areaTarget(a.id); return s + (t != null ? t : 0); }, 0);
  out.extraH = (rec.extra || []).reduce(function(s, x) { return s + (x.hours || 0); }, 0);
  out.short = !!out.complement && out.floorHeads < out.complement;
  return out;
}
function attDayPanelHtml(d, headBtn, id) {
  var h = '<div class="inv-panel inv-panel-flush"' + (id ? ' id="' + id + '"' : '') + '><div class="inv-panel-head"><span class="inv-panel-title">Attendance ' +
    '<span class="inv-panel-count">' + (d.today ? 'today' : escHtml(attDayName(d.iso) + ' ' + formatDate(d.iso))) + '</span></span>' + (headBtn || '') + '</div>';
  if (!d.marked) return h + '<div class="inv-empty">Nothing recorded yet.</div></div>';
  h += '<div class="inv-tiles inv-tiles-flush">' +
    '<div class="inv-tile"><div class="inv-tile-label">On site</div>' +
    '<div class="inv-tile-value" data-att-onsite' + (id === 'homeAtt' ? ' id="homeAttOnSite"' : '') + '>' + (d.p + d.half) + '<span class="inv-tile-of">/' + d.roster.length + '</span></div>' +
    '<div class="inv-tile-sub">' + (d.half ? d.half + ' half day' + (d.half === 1 ? '' : 's') + ' · ' : '') + d.absent.length + ' absent' + (d.unmarked ? ' · ' + d.unmarked + ' unmarked' : '') + '</div></div>' +
    '<div class="inv-tile' + (d.short ? ' inv-tile-warning' : '') + '"><div class="inv-tile-label">On the floor</div>' +
    '<div class="inv-tile-value">' + d.floorHeads + (d.complement ? '<span class="inv-tile-of">/' + d.complement + '</span>' : '') + '</div>' +
    '<div class="inv-tile-sub">' + (d.complement ? (d.short ? (d.complement - d.floorHeads) + ' short of the complement' : 'against the complement') : 'no complement set') + '</div></div></div>';
  if (d.absent.length) h += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-meta">Absent</span><span class="inv-row-wrap">' + escHtml(d.absent.join(', ')) + '</span></span></div>';
  if (d.extraH) h += '<div class="inv-row"><span class="inv-row-main">EXTRA booked</span><span class="inv-row-end inv-num">' + formatNum(d.extraH, 1) + ' h</span></div>';
  return h + '</div>';
}
function renderAttHomeCard() {
  var el = document.getElementById('homeAttCard');
  if (!el) return;
  if (!staffActive().length) { el.innerHTML = ''; return; }
  el.innerHTML = attDayPanelHtml(attDaySummary(), '<button class="inv-btn-link" data-action="invPayOpenAtt">Open</button>', 'homeAtt');
}
