/* ===== The intelligence engine, parts three and four: insights and predictions =====

   Owner, 25 Sep 2026: "go ahead with parts three and four" of the mockup.

   **Insights are To-do rules.** Each is a finding the app spots on its own,
   carrying the figures it was raised on, what to do, and what clears it: the
   exact shape of an app task (todo.js), so they land on the To-do list, the
   Home card and the Windows widget with nothing new to learn, clear themselves
   when the figures change, and snooze against those figures. Each is switchable
   in Settings → To-do. Stats → Overview lists them all in one place.

   Every insight states its instrument. A client "gone quiet" is judged against
   its OWN rhythm (the median gap between its challans), never a fixed cut-off;
   a month's realisation against the months before it, never against a target;
   labour against the model only where 90% of the days are recorded.

   **Predictions say what they rest on.** The month-end figure is the month so
   far at its own pace per working day, with a band from how much the working
   days have varied. The next challan is each client's median gap after its last
   one. The invoice form offers the next PO number only where a client's POs run
   in sequence, and fills the vehicle only where one plainly dominates; otherwise
   it suggests and types nothing. */

/* ---------- Shared measures ---------- */
function insMonthKey(iso) { return iso.slice(0, 7); }
function insMonthsBack(n) {
  var out = [], d = new Date(localDateStr().slice(0, 7) + '-01T00:00:00');
  for (var i = n; i >= 1; i--) { var x = new Date(d); x.setMonth(x.getMonth() - i); out.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')); }
  return out;
}
// The app's own short names ("Sep"): toLocaleString('en-IN') writes "Sept".
function insMonthLabel(m) { return TREND_MONTH_LABELS[parseInt(String(m).slice(5, 7), 10) - 1] || String(m); }
function insClientActive(id) { var c = S.clients.find(function(x) { return String(x.id) === String(id); }); return !c || c.isActive !== false; }
function insActive() { return (S.invoices || []).filter(function(i) { return i.status === 'active' && i.date; }); }

/* Revenue, weighed kg and realisation per month, per client ('' = the book). */
function insMonthly(months) {
  var by = {};
  var add = function(key, m, inv) {
    var k = key + '|' + m, r = by[k] || (by[k] = { rev: 0, kg: 0, revKnown: 0 });
    r.rev += inv.taxableValue || 0;
    var w = weighLines([inv]);
    r.kg += w.kg; r.revKnown += w.revKnown;
  };
  insActive().forEach(function(inv) {
    var m = insMonthKey(inv.date);
    if (months.indexOf(m) < 0) return;
    add('', m, inv); add(String(inv.clientId), m, inv);
  });
  return function(clientKey, m) {
    var r = by[clientKey + '|' + m] || { rev: 0, kg: 0, revKnown: 0 };
    return { rev: r.rev, kg: r.kg, real: r.kg > 0 ? r.revKnown / r.kg : null };
  };
}
function insClientName(id) { var c = (S.clients || []).find(function(x) { return String(x.id) === String(id); }); return c ? c.name : 'Client ' + id; }

/* Each client's challan rhythm: distinct challan dates, the median gap, the
   last one, and when the next is due. */
function predCadence() {
  var byC = {};
  (S.incomingMaterial || []).forEach(function(im) {
    if (!im.challanDate || im.clientId == null) return;
    (byC[im.clientId] = byC[im.clientId] || {})[im.challanDate] = true;
  });
  var today = localDateStr();
  return Object.keys(byC).map(function(id) {
    var d = Object.keys(byC[id]).sort(), gaps = [];
    for (var i = 1; i < d.length; i++) gaps.push(isoDaysBetween(d[i - 1], d[i]));
    var med = gaps.length ? numMedian(gaps) : null, last = d[d.length - 1];
    var since = isoDaysBetween(last, today);
    var next = med != null ? isoAddDays(last, Math.max(1, Math.round(med))) : null;
    // Overdue against its own rhythm: well past its usual gap, and at least
    // three weeks past it, so a twice-a-week client is not flagged after nine.
    var quietAfter = med != null ? Math.max(med * 1.75, med + 21) : null;
    return { id: id, name: insClientName(id), count: d.length, last: last, median: med, since: since, next: next,
      late: next && next < today ? isoDaysBetween(next, today) : 0, quiet: quietAfter != null && d.length >= 5 && since > quietAfter, quietAfter: quietAfter };
  }).sort(function(a, b) { return b.count - a.count; });
}

/* ---------- Part four: predictions ---------- */
function predMonthPace() {
  var today = localDateStr(), from = today.slice(0, 7) + '-01', end = payMonthEnd(from);
  var inv = insActive().filter(function(i) { return i.date >= from && i.date <= today; });
  var rev = inv.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0), kg = weighLines(inv).kg;
  var done = statsWorkingDays(from, today), total = statsWorkingDays(from, end);
  if (!done) return null;
  // The spread of revenue per working day so far sets the band.
  var perDay = {};
  inv.forEach(function(i) { perDay[i.date] = (perDay[i.date] || 0) + (i.taxableValue || 0); });
  var days = [], d = from;
  for (var g = 0; d <= today && g < 40; g++) { if (new Date(d + 'T00:00:00').getDay() !== 0) days.push(perDay[d] || 0); d = isoAddDays(d, 1); }
  var mean = rev / done, sd = Math.sqrt(days.reduce(function(s, v) { return s + (v - mean) * (v - mean); }, 0) / Math.max(1, days.length - 1));
  var left = total - done, band = sd * Math.sqrt(left);
  var unbilled = 0;
  (S.incomingMaterial || []).forEach(function(im) { (im.items || []).forEach(function(it) { if (!it.invoiced) unbilled += imLineOpen(it).amount; }); });
  var prev = insMonthsBack(1)[0], pm = insMonthly([prev]);
  return { rev: rev, kg: kg, done: done, total: total, left: left,
    projRev: gstRound(rev / done * total), projKg: kg / done * total, low: gstRound(Math.max(rev, rev / done * total - band)), high: gstRound(rev / done * total + band),
    unbilled: gstRound(unbilled), prevRev: pm('', prev).rev, prevKg: pm('', prev).kg, prevLabel: insMonthLabel(prev) };
}

/* The next PO number, only where the client's POs run in sequence. */
function predPO(clientId) {
  var pos = insActive().filter(function(i) { return String(i.clientId) === String(clientId) && (i.poNumber || '').trim(); })
    .sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0); })
    .map(function(i) { return i.poNumber.trim(); });
  if (pos.length < 4) return null;
  var tail = pos.slice(-8), parse = function(p) { var m = p.match(/^(.*?)(\d+)$/); return m ? { pre: m[1], n: parseInt(m[2], 10), w: m[2].length } : null; };
  var steps = 0, seq = 0, same = 0;
  for (var i = 1; i < tail.length; i++) {
    var a = parse(tail[i - 1]), b = parse(tail[i]);
    if (!a || !b || a.pre !== b.pre) continue;
    steps++;
    if (b.n === a.n) same++; else if (b.n > a.n && b.n - a.n <= 3) seq++;
  }
  // The latest PO is the one to continue: one with no number at its end ("VERBAL", "PO-104A") cannot be.
  var last = parse(tail[tail.length - 1]);
  if (!last) return null;
  // A standing PO (one open order the customer quotes on every invoice) is the next one too.
  if (steps >= 3 && same / steps >= 0.6) {
    return { value: tail[tail.length - 1], last: tail[tail.length - 1], why: 'the same PO on ' + same + ' of the last ' + steps + ' invoices after the first' };
  }
  if (steps < 3 || seq / steps < 0.6) {
    // Rising but not consecutive (the customer numbers POs across all its
    // suppliers): the number cannot be predicted, the shape can.
    var all = tail.map(parse).filter(Boolean), pre = all.length ? all[0].pre : '';
    var rising = all.length >= 4 && all.every(function(x, i) { return x.pre === pre && (i === 0 || x.n >= all[i - 1].n); }) &&
      all.some(function(x, i) { return i > 0 && x.n > all[i - 1].n; });
    if (!rising || !pre) return null;
    return { value: pre, prefixOnly: true, last: tail[tail.length - 1], why: 'the prefix only: numbers rise but skip, last ' + tail[tail.length - 1] };
  }
  var next = last.pre + String(last.n + 1).padStart(last.w, '0');
  return { value: next, last: tail[tail.length - 1], why: 'next in sequence after ' + tail[tail.length - 1] + (same ? ' (the same PO repeats on ' + same + ' of the last ' + steps + ')' : '') };
}

/* The client's usual vehicle: filled only when one carries 60% or more of its
   last 30 invoices that name a vehicle; otherwise offered, never typed. */
function predVehicle(clientId) {
  var list = insActive().filter(function(i) { return String(i.clientId) === String(clientId) && (i.transport || '').trim(); })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; }).slice(-30);
  if (!list.length) return null;
  var count = {};
  list.forEach(function(i) { var v = i.transport.trim().toUpperCase(); count[v] = (count[v] || 0) + 1; });
  var ranked = Object.keys(count).map(function(v) { return [v, count[v]]; }).sort(function(a, b) { return b[1] - a[1]; });
  var top = ranked[0], last = list[list.length - 1].transport.trim().toUpperCase();
  return { fill: top[1] / list.length >= 0.6 ? top[0] : '', share: top[1] + ' of the last ' + list.length, top: ranked.slice(0, 3).map(function(r) { return r[0]; }), last: last };
}

/* Invoice form: fill on client choice, for a new invoice, only into an empty field. */
function predApplyToInvoice() {
  if (!invoiceForm || invoiceForm.editingId || !invoiceForm.clientId) { if (invoiceForm) invoiceForm._pred = null; return; }
  // A client with its own vehicle or PO pattern (createApplyClientDefaults) is not predicted for that field.
  var own = S.clients.find(function(c) { return c.id === invoiceForm.clientId; }) || {};
  var po = String(own.poFromChallan || '').trim() ? null : predPO(invoiceForm.clientId);
  var ve = String(own.defaultTransport || '').trim() ? null : predVehicle(invoiceForm.clientId);
  invoiceForm._pred = { po: po, ve: ve };
  // What the app filled is the app's (invoiceForm._auto, shared with createApplyClientDefaults): another client
  // replaces it, where a typed value is the operator's for good. A prediction left behind used to ride onto the
  // next client's invoice and read as typed there.
  var auto = invoiceForm._auto || (invoiceForm._auto = {});
  if (!invoiceForm.poNumber || invoiceForm.poNumber === auto.po) { invoiceForm.poNumber = po ? po.value : ''; auto.po = invoiceForm.poNumber; }
  if (!invoiceForm.transport || invoiceForm.transport === auto.ve) { invoiceForm.transport = ve && ve.fill ? ve.fill : ''; auto.ve = invoiceForm.transport; }
}
function predHintHtml(field) {
  var p = invoiceForm && invoiceForm._pred;
  if (!p) return '';
  if (field === 'po' && p.po) return '<div class="inv-field-hint" data-pred="po">Predicted: ' + escHtml(p.po.why) + '</div>';
  if (field === 've' && p.ve) {
    var chips = p.ve.top.concat(p.ve.top.indexOf(p.ve.last) < 0 ? [p.ve.last] : []);
    return '<div class="inv-field-hint" data-pred="ve">' + (p.ve.fill ? 'Usual vehicle: ' + escHtml(p.ve.share) : 'No single usual vehicle') + '</div>' +
      '<div class="inv-toolbar inv-field-hint" role="group" aria-label="Vehicles this client uses">' +
      chips.map(function(v) { return '<button type="button" class="inv-chip" data-action="invPredVehicle" data-v="' + escHtml(v) + '"><span class="inv-id">' + escHtml(v) + '</span>' + (v === p.ve.last ? ' · last' : '') + '</button>'; }).join('') + '</div>';
  }
  return '';
}
function predAction(action, btn) {
  if (action !== 'invPredVehicle') return false;
  var el = document.getElementById('invTransport');
  if (el) { el.value = btn.dataset.v; invoiceForm.transport = btn.dataset.v; }
  return true;
}

/* ---------- Part three: insights, as To-do rules ---------- */
var INSIGHT_RULES = [
  ['insQuiet', 'Insight: a client has gone quiet against its own rhythm'],
  ['insRealLow', 'Insight: the month is realising below the months before'],
  ['insClientDown', 'Insight: a client’s billing has fallen three months running'],
  ['insLeak', 'Insight: a client realised below its own usual ₹/kg'],
  ['insBelowVar', 'Insight: a large account is below its variable cost'],
  ['insLabour', 'Insight: measured labour is far from the model'],
  ['insAttGap', 'Insight: last week has no attendance'],
  ['insChemPrice', 'Insight: chemicals used with no price']
];
INSIGHT_RULES.forEach(function(r) { TODO_RULES.push(r); TODO_CHECK_DEFAULTS[r[0]] = true; });

function insGo(tab) { return { kind: 'stats', tab: tab }; }

TODO_RULE_FNS.insQuiet = function() {
  var months = insMonthsBack(3), mm = insMonthly(months), bookRev = 0;
  months.forEach(function(m) { bookRev += mm('', m).rev; });
  return predCadence().filter(function(c) { return c.quiet; }).map(function(c) {
    var rev = 0, kg = 0, known = 0;
    months.forEach(function(m) { var r = mm(c.id, m); rev += r.rev; kg += r.kg; if (r.real != null) known += r.real * r.kg; });
    if (rev < 20000) return null;
    var share = bookRev > 0 ? rev / bookRev : 0;
    return { key: 'insQuiet:' + c.id, rule: 'insQuiet', tone: share >= 0.1 ? 'red' : 'amber',
      title: c.name + ': no challan for ' + c.since + ' days',
      sub: 'Usually every ' + formatNum(c.median, 0) + ' day' + (c.median === 1 ? '' : 's') + '; overdue after ' + Math.round(c.quietAfter) + (kg > 0 ? ' · ₹' + formatNum(known / kg, 2) + '/kg' : ''),
      why: 'Client · gone quiet', go: { kind: 'client', id: c.id }, goLabel: 'Open the client',
      facts: [['Last challan', formatDate(c.last)], ['Usual gap', formatNum(c.median, 0) + ' days'], ['Last 3 months', formatCurrency(gstRound(rev))], ['Share of the book', Math.round(share * 100) + '%']],
      clears: 'Clears itself when a challan from this client is entered.', sig: c.last };
  }).filter(Boolean);
};

TODO_RULE_FNS.insRealLow = function() {
  var today = localDateStr(), cur = today.slice(0, 7), prior = insMonthsBack(6);
  if (statsWorkingDays(cur + '-01', today) < 5) return [];
  var mm = insMonthly(prior.concat([cur])), now = mm('', cur);
  var reals = prior.map(function(m) { return mm('', m).real; }).filter(function(v) { return v != null; });
  if (now.real == null || reals.length < 3 || now.real >= Math.min.apply(null, reals)) return [];
  var med = numMedian(reals);
  // The mix: whose share of the month moved most.
  var prev = prior[prior.length - 1], moved = null;
  (S.clients || []).forEach(function(c) {
    var a = mm(String(c.id), cur).rev / (now.rev || 1), b = mm(String(c.id), prev).rev / (mm('', prev).rev || 1);
    if (!moved || Math.abs(a - b) > Math.abs(moved.d)) moved = { name: c.name, d: a - b, a: a, b: b };
  });
  return [{ key: 'insRealLow:' + cur, rule: 'insRealLow', tone: 'amber',
    title: insMonthLabel(cur) + ' is realising ₹' + formatNum(now.real, 2) + '/kg, the lowest in ' + (reals.length + 1) + ' months',
    sub: 'Median of the ' + reals.length + ' before: ₹' + formatNum(med, 2) + (moved && Math.abs(moved.d) >= 0.05 ? ' · ' + moved.name + ' is ' + Math.round(moved.a * 100) + '% of revenue against ' + Math.round(moved.b * 100) + '%' : ''),
    why: 'Money · this month', go: insGo('overview'), goLabel: 'Open Stats',
    facts: [['This month', '₹' + formatNum(now.real, 2) + '/kg'], ['Lowest before', '₹' + formatNum(Math.min.apply(null, reals), 2)], ['Median before', '₹' + formatNum(med, 2)]],
    clears: 'Clears itself when the month climbs back above the lowest of the months before.', sig: cur + '|' + formatNum(now.real, 1) }];
};

TODO_RULE_FNS.insClientDown = function() {
  var months = insMonthsBack(3), mm = insMonthly(months), out = [];
  (S.clients || []).forEach(function(c) {
    var r = months.map(function(m) { return mm(String(c.id), m).rev; });
    if (!(r[0] >= 30000 && r[1] < r[0] && r[2] < r[1] && r[2] <= r[0] * 0.75)) return;
    out.push({ key: 'insClientDown:' + c.id, rule: 'insClientDown', tone: 'amber', title: c.name + ': billing down three months running',
      sub: months.map(function(m, i) { return insMonthLabel(m) + ' ' + formatCurrency(Math.round(r[i])); }).join(' → '),
      why: 'Client · trend', go: { kind: 'client', id: c.id }, goLabel: 'Open the client',
      facts: months.map(function(m, i) { return [insMonthLabel(m), formatCurrency(gstRound(r[i]))]; }).concat([['Fall', Math.round((1 - r[2] / r[0]) * 100) + '%']]),
      clears: 'Clears itself when a month stops the fall.', sig: months[2] });
  });
  return out;
};

TODO_RULE_FNS.insLeak = function() {
  var months = insMonthsBack(4), last = months[3], mm = insMonthly(months), out = [];
  (S.clients || []).forEach(function(c) {
    var cur = mm(String(c.id), last);
    if (cur.real == null || cur.rev < 10000) return;
    var before = months.slice(0, 3).map(function(m) { return mm(String(c.id), m).real; }).filter(function(v) { return v != null; });
    if (before.length < 2) return;
    var med = numMedian(before);
    if (cur.real >= med * 0.95) return;
    var gap = gstRound((med - cur.real) * cur.kg);
    out.push({ key: 'insLeak:' + c.id, rule: 'insLeak', tone: 'amber', title: c.name + ' realised ₹' + formatNum(cur.real, 2) + '/kg against its usual ₹' + formatNum(med, 2),
      sub: insMonthLabel(last) + ' · ≈ ' + formatCurrency(gap) + ' of work at its own usual rate (₹0 lines, a changed rate, or the mix)',
      why: 'Money · leakage', go: { kind: 'client', id: c.id }, goLabel: 'Open the client',
      facts: [[insMonthLabel(last), '₹' + formatNum(cur.real, 2) + '/kg'], ['Usual', '₹' + formatNum(med, 2) + '/kg'], ['At stake', formatCurrency(gap)]],
      clears: 'Clears itself when the next month is back within 5% of the usual.', sig: last });
  });
  return out;
};

TODO_RULE_FNS.insBelowVar = function() {
  var last = insMonthsBack(1)[0], from = last + '-01', to = payMonthEnd(from);
  var inv = insActive().filter(function(i) { return i.date >= from && i.date <= to; });
  var m = statsClientMargins(null, inv, weighLines(inv), { from: from, to: to });
  if (!m) return [];
  return m.ranked.filter(function(x) { return x.kg >= m.kg * 0.1 && x.vsVar < 0; }).map(function(x) {
    return { key: 'insBelowVar:' + x.id, rule: 'insBelowVar', tone: 'red', title: x.name + ' is below its variable cost',
      sub: insMonthLabel(last) + ': ₹' + formatNum(x.net, 2) + '/kg against ₹' + formatNum(m.varKg, 2) + ' variable · loses ' + formatCurrency(gstRound(-x.vsVar * x.kg)) + ' even with labour fixed',
      why: 'Money · margin', go: insGo('clients'), goLabel: 'Open contribution by client',
      facts: [['Realised', '₹' + formatNum(x.net, 2) + '/kg'], ['Variable cost', '₹' + formatNum(m.varKg, 2) + '/kg'], ['Full cost', '₹' + formatNum(m.fullKg, 2) + '/kg'], ['Share of tonnage', Math.round(x.kg / m.kg * 100) + '%'], ['Cost measured', Math.round(m.c.measuredShare * 100) + '%']],
      clears: 'Clears itself when a month realises above the variable cost.', sig: last };
  });
};

TODO_RULE_FNS.insLabour = function() {
  var last = insMonthsBack(1)[0], from = last + '-01', to = payMonthEnd(from);
  var lab = labourForRange(from, to), kg = weighLines(insActive().filter(function(i) { return i.date >= from && i.date <= to; })).kg;
  var model = labourCfg().modelPerKg || 3.55;
  if (lab.coverage < 0.9 || !(kg > 0) || !(lab.total > 0)) return [];
  var perKg = lab.total / kg, diff = perKg - model;
  if (Math.abs(diff) / model < 0.2) return [];
  return [{ key: 'insLabour:' + last, rule: 'insLabour', tone: 'amber',
    title: 'Labour reads ₹' + formatNum(perKg, 2) + '/kg against the ₹' + formatNum(model, 2) + ' model',
    sub: insMonthLabel(last) + (diff < 0 ? ': if the roster is short of hands or rates, every margin is overstated by up to ' + formatCurrency(gstRound(-diff * kg)) : ': the model understates labour by ' + formatCurrency(gstRound(diff * kg))),
    why: 'Data gap · affects every margin', go: { kind: 'staffRoster' }, goLabel: 'Check the roster',
    facts: [['Measured', formatCurrency(gstRound(lab.total)) + ' on ' + formatNum(kg / 1000, 1) + ' t'], ['At the model', formatCurrency(gstRound(model * kg))], ['Days recorded', Math.round(lab.coverage * 100) + '%']],
    clears: 'Clears itself when the two agree within 20%, or the model is updated in Settings.', sig: last + '|' + formatNum(model, 2) }];
};

TODO_RULE_FNS.insAttGap = function() {
  if (!staffActive().length) return [];
  var ws = isoAddDays(attWeekStartOf(localDateStr()), -7), wk = payWeek(ws);
  if (wk.recordedDays > 0) return [];
  return [{ key: 'insAttGap:' + ws, rule: 'insAttGap', tone: 'info', title: 'Week ' + attPayWeekNumber(ws) + ' has no attendance',
    sub: 'The payout and labour read ₹0 for it until the rolls are pasted', why: 'Floor · data gap', go: { kind: 'staffPaste' }, goLabel: 'Paste the rolls',
    facts: [['Week', formatDate(ws) + ' – ' + formatDate(wk.sat)]], clears: 'Clears itself when a day of that week is recorded.', sig: ws }];
};

TODO_RULE_FNS.insChemPrice = function() {
  var cut = isoAddDays(localDateStr(), -30), names = {};
  stockData().entries.forEach(function(e) {
    if (e.voided || (e.kind !== 'used' && e.kind !== 'charged') || e.date < cut) return;
    var it = stockItem(e.itemId);
    if (it && !stockPriceAt(it.id, e.date)) names[it.name] = true;
  });
  var list = Object.keys(names).sort();
  if (!list.length) return [];
  return [{ key: 'insChemPrice', rule: 'insChemPrice', tone: 'info', title: list.length + ' stock line' + (list.length === 1 ? '' : 's') + ' used with no price',
    sub: list.join(', '), why: 'Data gap · live cost', go: { kind: 'stockList' }, goLabel: 'Open Stock',
    facts: [['Lines', list.join(', ')]], clears: 'Clears itself when each has a bill.', sig: list.join('|') }];
};

/* ---------- Stats cards ---------- */
function insightsCardHtml() {
  var all = [];
  try { all = todoAppAll().filter(function(t) { return t.rule.indexOf('ins') === 0; }); } catch (e) { all = []; }
  var h = statsPanel('insights', 'Insights', 'what the book shows on its own, most urgent first', { wide: true, id: 'statsInsights' });
  if (!all.length) return h + '<div class="inv-empty">Nothing stands out right now. Each insight appears here and on the To-do list when its figures call for it.</div></div>';
  // The To-do's own rows: an insight is a task, and reads as one wherever it is listed.
  h += all.map(function(t) { return todoAppRowHtml(t); }).join('');
  return h + statsBody(statsNote('Tap one for its figures and what clears it. They are on the To-do list too, and can be switched off in Settings &rarr; Checks &amp; alerts &rarr; To-do.')) + '</div>';
}

function paceCardHtml() {
  var p = predMonthPace();
  if (!p) return '';
  var h = statsPanel('pace', 'This month at its pace', p.done + ' of ' + p.total + ' working days in', { wide: true, id: 'statsPace' });
  h += statsTiles(
    statsTile('revenue', 'Revenue', escHtml(formatCurrency(p.projRev)), statsTileSub(escHtml(p.prevLabel) + ' ' + escHtml(formatCurrency(p.prevRev)) +
      (p.prevRev > 0 ? ' · ' + (p.projRev >= p.prevRev ? '+' : '&minus;') + Math.abs(Math.round((p.projRev / p.prevRev - 1) * 100)) + '%' : '')), '', 'paceRev') +
    statsTile('tonnage', 'Tonnage', formatNum(p.projKg / 1000, 1) + '<span class="inv-tile-of"> t</span>', statsTileSub(escHtml(p.prevLabel) + ' ' + formatNum(p.prevKg / 1000, 1) + ' t' +
      (p.prevKg > 0 ? ' · ' + (p.projKg >= p.prevKg ? '+' : '&minus;') + Math.abs(Math.round((p.projKg / p.prevKg - 1) * 100)) + '%' : ''))));
  h += statsRow('So far', formatNum(p.kg / 1000, 1) + ' t billed', statsNum(escHtml(formatCurrency(p.rev)))) +
    statsRow('Likely range', 'from how much the working days so far have varied', statsNum(escHtml(formatCurrency(p.low)) + ' – ' + escHtml(formatCurrency(p.high))), '', 'inv-row-flow') +
    statsRow('Unbilled challans in hand', 'would lift the month if billed in it', statsNum(escHtml(formatCurrency(p.unbilled))));
  return h + '</div>';
}

function nextChallanCardHtml() {
  // Every client with a rhythm, most overdue first; uiMoreHtml shows the first ten. Cut to the twelve busiest
  // before sorting, a late small client never appeared and the count was wrong. A client set inactive has left.
  var list = predCadence().filter(function(c) { return c.median != null && c.count >= 3 && insClientActive(c.id); });
  if (!list.length) return '';
  var today = localDateStr();
  var h = statsPanel('next', 'Next challan expected', 'from each client&rsquo;s own rhythm', { id: 'statsNextChallan' });
  // The ten most overdue; the rest one tap away (UX overhaul 2, step 6).
  h += uiMoreHtml('stats-next', list.sort(function(a, b) { return (b.late - a.late) || (a.next < b.next ? -1 : 1); }).map(function(c) {
    var when = c.quiet ? uiDot('danger', c.late + ' days late · quiet') : c.late ? uiDot('warning', c.late + ' day' + (c.late === 1 ? '' : 's') + ' late')
      : '<span class="inv-nowrap">' + (c.next === today ? 'today' : escHtml(formatDate(c.next))) + '</span>';
    return statsRow(escHtml(c.name), 'every ' + formatNum(c.median, 0) + ' day' + (c.median === 1 ? '' : 's') + ' · last ' + escHtml(formatDate(c.last)), when);
  }), { n: 10, noun: 'clients' });
  return h + statsBody(statsNote('The median gap between each client&rsquo;s challans, counted from the last one. Late is past that; quiet is past both 1.75 times the gap and three weeks beyond it.')) + '</div>';
}
