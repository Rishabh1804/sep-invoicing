/* ===== THE FLOW THREAD (docs/ENTRY_FACES.md §5, T1–T3) =====
   The owner's answers on the material-flow study (10 Oct 2026): turnaround, *"Target default one day, can be edited as per material
   or overall as well. Say, they ask for a particular material to be done on a priority basis - we can plan that out"*; payment terms,
   *"Mehta 7 days - as we give 2% discount, every other client 45 days"*. Material comes in on a challan, is pickled, plated, despatched
   and invoiced, and is paid for: this module holds the targets each step is held to and reads how each client's material moves.
   - T1, THE TARGETS AND TERMS: a turnaround target from the challan's day to the material's despatch, one working day for the plant
     (Settings → Checks & alerts → Turnaround and terms, `S.flowCfg.turnDays`), the client's own (`client.turnaroundDays`) and a part's
     own on the client (`client.turnaroundParts`); payment terms, 45 days for the plant (`S.flowCfg.termsDays`), the client's own
     (`client.payTermsDays`); and a challan or one of its lines wanted by a day (`priority`, Challans).
   - T2, THE TASKS: material past its target, by where it stands (In plant's stages); a job wanted by a day and not plated by it; an
     invoice past its client's terms (finintel.js, the rule that read a fixed 90 days).
   - T3, THE FLOW ON SCREEN: on a client's page and Floor's Overview, the median working days from the challan to pickling, to
     plating and to despatch, and the days from invoice to payment, against the target and the terms; each open challan's expected
     despatch day and each open invoice's expected payment day.
   Days of work are working days (Sundays out, statsWorkingDays): a challan of Saturday back on Monday met a one-day target. Days to
   pay are calendar days, as the terms are. Despatch is the day written on the invoice as despatched (the invoice's own date is the
   day its challans are collected, the owner's word), else the invoice's date. Pickling and plating are In plant's own reading of
   which load and which run went against which challan line, oldest first (production.js prodInPlant): estimates for one line, firm
   as medians. */

var FLOW_DAYS = 90;          // the medians read the challans of the last 90 days
var FLOW_MIN = 5;            // a client's own median needs five lines; under it, the plant's is used and said
var FLOW_LATE_DAYS = 30;     // the task looks at the challans of the last 30 days: older open lines are the unbilled rule's
var FLOW_RED_AFTER = 2;      // working days past the target before material past it is red

function flowCfg() {
  var c = (S && S.flowCfg) || {};
  return { turnDays: c.turnDays >= 0 && c.turnDays !== '' && c.turnDays != null ? +c.turnDays : 1, termsDays: c.termsDays > 0 ? +c.termsDays : 45 };
}
function flowClient(id) { return id == null ? null : (S.clients || []).find(function(c) { return String(c.id) === String(id); }) || null; }
function flowSetNum(v) { return v !== '' && v != null && isFinite(+v) && +v >= 0; }
/* A client's payment terms: its own, else the plant's. */
function flowTerms(clientId) {
  var c = flowClient(clientId);
  return c && +c.payTermsDays > 0 ? { days: +c.payTermsDays, src: 'client' } : { days: flowCfg().termsDays, src: 'plant' };
}
/* The turnaround a part is held to: the part's own on its client, the client's, else the plant's. */
function flowTarget(clientId, part) {
  var c = flowClient(clientId), k = part ? rateKey(part) : '';
  var p = c && k && Array.isArray(c.turnaroundParts) ? c.turnaroundParts.find(function(x) { return x && flowSetNum(x.days) && rateKey(x.part) === k; }) : null;
  if (p) return { days: +p.days, src: 'part' };
  if (c && flowSetNum(c.turnaroundDays)) return { days: +c.turnaroundDays, src: 'client' };
  return { days: flowCfg().turnDays, src: 'plant' };
}
function flowDaysWord(n) { return n === 0 ? 'the same day' : todoPlural(n, 'working day'); }
/* "Back in 3 working days", "back the same day": the turnaround said as a verdict. */
function flowBackWord(n) { return n === 0 ? 'back the same day' : 'back in ' + todoPlural(n, 'working day'); }
/* "a 1-day target", "a same-day target": a target named in a head. */
function flowTargetWord(n) { return (n === 0 ? 'same-day' : n + '-day') + ' target'; }
/* Working days after `a` up to `b` (the day of `a` itself is day 0); never below 0. */
function flowWd(a, b) { return a && b && b > a ? prodWorkingDaysBetween(a, b) : 0; }
/* The working day `n` working days after `iso`. */
function flowAddWd(iso, n) {
  var d = iso, g = 0;
  while (n > 0 && g++ < 400) { d = isoAddDays(d, 1); if (new Date(d + 'T00:00:00').getDay() !== 0) n--; }
  return d;
}
/* A median weighted by value (a line of ₹40,000 says more about the flow than one of ₹40); plain where nothing carries a value. */
function flowWMedian(list) {
  if (!list.length) return null;
  var w = list.some(function(x) { return x.w > 0; }), s = list.slice().sort(function(a, b) { return a.d - b.d; }), tot = 0, acc = 0;
  s.forEach(function(x) { tot += w ? Math.max(0, x.w) : 1; });
  for (var i = 0; i < s.length; i++) { acc += w ? Math.max(0, s[i].w) : 1; if (acc >= tot / 2) return s[i].d; }
  return s[s.length - 1].d;
}

/* ---------- The priority: a challan, or a line on it, wanted by a day ---------- */
function flowPriorityOf(m, it) { return (it && it.priority) || (m && m.priority) || null; }
var _flowPrio = null;   // the dialog's challan
function flowPriorityOpen(imId) {
  var m = (S.incomingMaterial || []).find(function(x) { return x.id === imId; });
  if (!m) return;
  _flowPrio = imId;
  var open = (m.items || []).filter(function(it) { return !it.invoiced; });
  var row = function(it) {
    var id = 'flowPrio' + String(it.id).replace(/[^A-Za-z0-9_-]/g, '');
    return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + escHtml(lineLabel(it)) + '</label>' +
      '<input type="date" class="inv-input inv-id" id="' + id + '" data-flow-prio="' + escHtml(it.id) + '" value="' + escHtml(it.priority || '') + '" min="' + escHtml(m.challanDate || '') + '"></div>';
  };
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('Wanted by · challan ' + escHtml(m.challanNo || 'with no number')) +
    '<div class="inv-field"><label class="inv-field-label" for="flowPrioAll">The whole challan</label>' +
    '<input type="date" class="inv-input inv-id" id="flowPrioAll" value="' + escHtml(m.priority || '') + '" min="' + escHtml(m.challanDate || '') + '">' +
    '<div class="inv-field-hint">The day the client wants this material back by. The To-do asks on the day if it is not plated by then, and the challan says so until it goes out.</div></div>' +
    (open.length > 1 ? '<div class="inv-field-label">Or a line of its own, which wins over the whole challan’s day</div>' + open.map(row).join('') : '') +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invFlowPrioSave">Save</button></div></div>', { dismiss: true });
}
/* Saved as the challan form saves it: a challan's day is no P1 change (the guard asks nothing of the form either). */
function flowPrioritySave() {
  var m = (S.incomingMaterial || []).find(function(x) { return x.id === _flowPrio; });
  if (!m) { closeOverlay(); return; }
  var iso = /^\d{4}-\d{2}-\d{2}$/;
  var all = (document.getElementById('flowPrioAll') || {}).value || '';
  if (all && !iso.test(all)) { showToast('Pick a day', 'error'); return; }
  if (all && m.challanDate && all < m.challanDate) { showToast('A day before the challan came in', 'error'); return; }
  if (all) m.priority = all; else delete m.priority;
  document.querySelectorAll('[data-flow-prio]').forEach(function(el) {
    var it = (m.items || []).find(function(x) { return String(x.id) === el.dataset.flowPrio; });
    if (!it) return;
    if (el.value && iso.test(el.value)) it.priority = el.value; else delete it.priority;
  });
  saveState();
  closeOverlay();
  if (typeof _renderIMView === 'function' && navPageOf() === 'pageIM') _renderIMView();
  showToast(all ? 'Wanted by ' + formatDate(all) : 'Saved', 'success');
}
/* The badge a challan carries while a day it is wanted by stands and its material is not out. */
function flowPriorityBadgeHtml(m) {
  var days = [m.priority].concat((m.items || []).filter(function(it) { return !it.invoiced; }).map(function(it) { return it.priority; })).filter(Boolean).sort();
  if (!days.length || (m.items || []).every(function(it) { return it.invoiced; })) return '';
  var d = days[0], today = localDateStr(), tone = d < today ? 'danger' : d === today ? 'warning' : 'info';
  return '<span class="inv-badge inv-badge-' + tone + '" data-flow-wanted="' + escHtml(d) + '" title="' + escHtml('Wanted by ' + formatDate(d)) + '">Wanted ' + escHtml(stockShortDate(d)) + '</span>';
}

/* ---------- T3: how material moves ---------- */
/* Every challan line with the days it took: to its first pickling, its first plating, its despatch (the day its last share went
   out), each in working days from the challan's day; its value, its target, where an open one stands. Where it stands is In plant's
   reading, and as In plant does, material is said to be waiting to pickle only where the floor's record covers the month (90% of
   line-days): under that a share with no load or run set against it is 'open', with no floor record, never 'waiting'. Read once a
   book. */
var _flowMemo = null;
function flowLines() {
  var key = (typeof _bookWrites !== 'undefined' ? _bookWrites : 0) + '|' + (typeof _prodVer !== 'undefined' ? _prodVer : 0) + '|' + localDateStr();
  if (_flowMemo && _flowMemo.key === key && _flowMemo.S === S) return _flowMemo.v;
  var inv = {};
  (S.invoices || []).forEach(function(v) { if (v && v.id) inv[v.id] = v; });
  var plant = prodInPlant(), rowOf = new Map();
  plant.rows.forEach(function(x) { rowOf.set(x.r, x); });
  var out = plant.lines.map(function(r) {
    var m = r.m, it = r.it, row = rowOf.get(r) || null, first = function(list) { return list.map(function(x) { return x.e.date; }).sort()[0] || null; };
    var pk = first(r.A.P), pl = first(r.A.L), desp = null;
    if (it.invoiced) {
      var ids = it.invoiceIds && it.invoiceIds.length ? it.invoiceIds : (it.invoiceId ? [it.invoiceId] : []);
      desp = ids.map(function(id) { var v = inv[id]; return v && v.status !== 'cancelled' ? (v.despatchDate || v.date || '') : ''; }).filter(Boolean).sort().pop() || null;
    }
    var date = m.challanDate || '', t = flowTarget(m.clientId, it.partNumber || it.desc);
    return { m: m, it: it, clientId: m.clientId, date: date, amount: Number(it.amount) || 0, target: t,
      pickled: pk, plated: pl, despatched: desp && desp >= date ? desp : desp ? date : null,
      toPickle: pk && pk >= date ? flowWd(date, pk) : null, toPlate: pl && pl >= date ? flowWd(date, pl) : null, toDespatch: desp ? flowWd(date, desp >= date ? desp : date) : null,
      row: row, stage: row ? (row.waiting > 0.0005 ? (plant.floorOk ? 'waiting' : 'open') : row.pickledNotPlated > 0.0005 ? 'pickled' : 'plated') : null,
      priority: flowPriorityOf(m, it) };
  });
  _flowMemo = { key: key, S: S, v: out };
  return out;
}
/* The flow of a client (or the plant), over the challans of the last 90 days: the median working days to each step, the share of
   the value despatched within its target, and the days to pay against the terms. */
function flowStats(clientId) {
  var today = localDateStr(), since = isoAddDays(today, -FLOW_DAYS);
  var all = flowLines().filter(function(x) { return x.date >= since && x.date <= today; });
  var mine = clientId == null ? all : all.filter(function(x) { return String(x.clientId) === String(clientId); });
  var med = function(list, k) {
    var have = list.filter(function(x) { return x[k] != null; });
    return { d: flowWMedian(have.map(function(x) { return { d: x[k], w: x.amount }; })), n: have.length };
  };
  var out = { since: since, lines: mine.length, own: true };
  out.toPickle = med(mine, 'toPickle'); out.toPlate = med(mine, 'toPlate'); out.toDespatch = med(mine, 'toDespatch');
  // A client with under five lines despatched reads at the plant's pace, and says so.
  if (clientId != null && out.toDespatch.n < FLOW_MIN) { var p = med(all, 'toDespatch'); out.usual = { d: p.d, n: p.n, plant: true }; }
  else out.usual = { d: out.toDespatch.d, n: out.toDespatch.n, plant: clientId == null };
  var done = mine.filter(function(x) { return x.toDespatch != null; }), wIn = 0, wAll = 0;
  done.forEach(function(x) { var w = x.amount > 0 ? x.amount : 0; wAll += w; if (x.toDespatch <= x.target.days) wIn += w; });
  out.within = wAll > 0 ? wIn / wAll : done.length ? done.filter(function(x) { return x.toDespatch <= x.target.days; }).length / done.length : null;
  out.done = done.length;
  // Days to pay: the receipts set against invoices (Finance), from the invoice's date, a median by value.
  if (typeof finSeen === 'function' && finSeen()) {
    var hist = bankPayHistory(finCtx().recv());
    var d = clientId != null ? bankDaysToPay(clientId, hist) : bankBookDaysToPay(hist);
    out.pay = d && d.median != null ? { d: Math.round(d.median), n: d.n } : null;
  }
  out.terms = clientId != null ? flowTerms(clientId) : { days: flowCfg().termsDays, src: 'plant' };
  return out;
}
/* A line's median kilos plated on a working day it ran, over the 30 days to today: the pace the work ahead of a challan is read at. */
function flowLinePace(line) {
  var today = localDateStr(), kg = [];
  for (var d = isoAddDays(today, -30); d < today; d = isoAddDays(d, 1)) { var r = prodDayLine(d, line); if (r.entries.length && r.kg > 0) kg.push(r.kg); }
  return kg.length >= 3 ? numMedian(kg) : null;
}
/* The kilos still to be done on an open line: its open pieces at the part's weight, else its open kilos; null where neither is known. */
function flowOpenKg(x) {
  var r = x.row;
  if (!r) return null;
  var left = r.waiting + r.pickledNotPlated;
  if (r.unit === 'KG') return left;
  return r.kpp && r.kpp.kg > 0 ? left * r.kpp.kg : null;
}
/* When an open challan is expected back: the later of its client's usual turnaround from the challan's day, and today plus the work
   ahead of it on its line (open material on that line from challans that came in before it, at the line's pace). Past its target
   is the task's reading (flowLate): working days since the challan came in, past the least target of its open lines. */
function flowExpectChallan(m) {
  var lines = flowLines().filter(function(x) { return x.m === m && x.row; });
  if (!lines.length) return null;
  var today = localDateStr(), st = flowStats(m.clientId), usual = st.usual.d != null ? st.usual.d : flowTarget(m.clientId, '').days;
  var from = m.challanDate || today, target = Math.min.apply(null, lines.map(function(x) { return x.target.days; }));
  var byUsual = flowAddWd(from, usual), over = flowWd(from, today) - target, stage = FLOW_STAGES.find(function(k) { return lines.some(function(x) { return x.stage === k; }); }) || 'plated';
  var key = prodChallanKey(m, lines[0].it), u = prodUsualLine(key), line = u && u.line ? u.line : null, ahead = 0, pace = null;
  if (line && stage !== 'plated') {
    pace = flowLinePace(line);
    if (pace) {
      var kg = 0;
      flowLines().forEach(function(x) {
        if (!x.row || x.m === m || !(x.date < m.challanDate || (x.date === m.challanDate && (x.m.createdAt || 0) < (m.createdAt || 0)))) return;
        var lu = prodUsualLine(prodChallanKey(x.m, x.it));
        if (!lu || lu.line !== line) return;
        var k = flowOpenKg(x); if (k > 0) kg += k;
      });
      ahead = Math.ceil(kg / pace);
    }
  }
  var byQueue = flowAddWd(today, ahead), date = byQueue > byUsual ? byQueue : byUsual;
  return { date: date < today ? today : date, due: flowAddWd(from, target), over: over, late: over > 0, usual: usual, usualPlant: !!st.usual.plant, stage: stage, line: line,
    ahead: ahead, pace: pace, target: target, priority: lines.map(function(x) { return x.priority; }).filter(Boolean).sort()[0] || null };
}
/* When an open invoice is expected to be paid: its date and the client's own days to pay (three receipts or more), else the book's;
   past its terms on its date and the client's terms. */
function flowExpectInvoice(clientId, o, hist, bookMed) {
  var d = bankDaysToPay(clientId, hist), med = d && d.n >= 3 ? d.median : bookMed;
  var terms = flowTerms(clientId).days, due = isoAddDays(o.date, terms);
  return { date: med != null ? isoAddDays(o.date, Math.round(med)) : null, days: med != null ? Math.round(med) : null, own: !!(d && d.n >= 3), due: due, past: due < localDateStr() };
}

/* ---------- T2: the tasks ---------- */
var FLOW_RULES = [['flowLate', 'Turnaround: material past its target'], ['flowPriority', 'Turnaround: a job wanted by a day, not plated']];
FLOW_RULES.forEach(function(r) { TODO_RULES.push(r); TODO_CHECK_DEFAULTS[r[0]] = true; });
var FLOW_STAGE_WORD = { waiting: 'waiting to pickle', open: 'with no floor record', pickled: 'pickled, not plated', plated: 'plated, not invoiced' };
var FLOW_STAGES = ['waiting', 'open', 'pickled', 'plated'];   // the least advanced first: a challan stands where its least advanced line does
// Three clients or more past their targets, or three challans wanted, are one task each (todo.js todoFoldList).
TODO_FOLD.flowLate = { title: function(n) { return n + ' clients past their turnaround target'; }, go: prodGo('plant'), goLabel: 'Open In plant' };
TODO_FOLD.flowPriority = { title: function(n) { return n + ' challans wanted by a day have no plating recorded'; }, go: { kind: 'im' }, goLabel: 'Open challans' };
TODO_RULE_FNS.flowLate = function() {
  var today = localDateStr(), since = isoAddDays(today, -FLOW_LATE_DAYS), by = {};
  flowLines().forEach(function(x) {
    if (!x.row || x.date < since || x.date > today || x.clientId == null) return;
    var over = flowWd(x.date, today) - x.target.days;
    if (over <= 0) return;
    var c = by[x.clientId] || (by[x.clientId] = { n: 0, amount: 0, nos: 0, kg: 0, stages: {}, oldest: x.date, worst: 0, challans: {} });
    c.n++; c.amount += x.row.amount || 0; c.stages[x.stage] = (c.stages[x.stage] || 0) + 1; c.worst = Math.max(c.worst, over); c.challans[x.m.id] = true;
    if (x.row.unit === 'NOS') c.nos += x.row.open; else c.kg += x.row.open;
    if (x.date < c.oldest) c.oldest = x.date;
  });
  return Object.keys(by).map(function(id) {
    var c = by[id], name = prodClientName(id) || 'A client', tone = c.worst > FLOW_RED_AFTER ? 'red' : 'amber';
    var where = FLOW_STAGES.filter(function(k) { return c.stages[k]; }).map(function(k) { return c.stages[k] + ' ' + FLOW_STAGE_WORD[k]; }).join(', ');
    var t = flowTarget(id, ''), what = (c.nos ? Math.round(c.nos).toLocaleString('en-IN') + ' NOS' : '') + (c.nos && c.kg ? ' + ' : '') + (c.kg ? formatNum(c.kg, 1) + ' kg' : '');
    // Quantities, never rupees: the floor reads this task (the value ranks it, and Today shows it only to a role that sees money).
    return { key: 'flowLate:' + id, rule: 'flowLate', tone: tone, clientId: id, amount: gstRound(c.amount), n: c.n,
      title: name + ': ' + todoPlural(c.n, 'challan line') + ' past ' + (t.src === 'plant' ? 'the' : 'its') + ' turnaround target',
      sub: where + ' · the oldest from ' + formatDate(c.oldest),
      why: 'Turnaround · from the challan to despatch', facts: [['Lines past', String(c.n)], ['Challans', String(Object.keys(c.challans).length)], ['Target', flowDaysWord(t.days)],
        ['Most past it', todoPlural(c.worst, 'working day')], ['Open on them', what || '—']],
      clears: 'Clears itself as the material is invoiced, or when the target is set to what the client agreed (Clients → the client → Turnaround and terms).',
      go: prodGo('plant', { client: id }), goLabel: 'Open In plant', sig: tone + '|' + c.n };
  });
};
TODO_RULE_FNS.flowPriority = function() {
  var today = localDateStr(), by = {};
  flowLines().forEach(function(x) {
    if (!x.row || !x.priority || x.stage === 'plated' || x.priority > today) return;
    var c = by[x.m.id] || (by[x.m.id] = { m: x.m, n: 0, day: x.priority, amount: 0 });
    c.n++; c.amount += x.row.amount || 0; if (x.priority < c.day) c.day = x.priority;
  });
  return Object.keys(by).map(function(id) {
    var c = by[id], past = c.day < today, name = prodClientName(c.m.clientId) || c.m.clientName || 'A client';
    return { key: 'flowPriority:' + id, rule: 'flowPriority', tone: past ? 'red' : 'amber', clientId: c.m.clientId, amount: gstRound(c.amount), n: c.n,
      title: name + ' challan ' + (c.m.challanNo || 'with no number') + (past ? ' was wanted by ' + formatDate(c.day) : ' is wanted today'),
      sub: todoPlural(c.n, 'line') + ' with no plating recorded' + (past ? ' · ' + todoPlural(flowWd(c.day, today), 'working day') + ' late' : ''),
      why: 'Turnaround · wanted by a day', facts: [['Wanted by', formatDate(c.day)], ['Lines with no plating', String(c.n)], ['Challan of', formatDate(c.m.challanDate)]],
      clears: 'Clears itself once it is plated, or when the day is changed or taken off (Challans → the challan → Wanted by).',
      go: { kind: 'challan', id: c.m.id }, goLabel: 'Open the challan', sig: (past ? 'red' : 'amber') + '|' + c.day };
  });
};

/* ---------- T3: the flow, drawn ---------- */
function flowDayText(d) { return d == null ? '—' : d === 0 ? 'same day' : d + ' d'; }
/* What the flow says in one line, and its tone: within the target, or how far past it; against the terms where days to pay are known. */
function flowVerdict(st, clientId) {
  var t = clientId != null ? flowTarget(clientId, '') : { days: flowCfg().turnDays };
  var u = st.toDespatch.d, within = st.within;
  var tone = u == null ? 'neutral' : u <= t.days ? (within == null || within >= 0.8 ? 'ok' : 'warning') : u <= t.days + FLOW_RED_AFTER ? 'warning' : 'danger';
  var head = u == null ? 'Nothing despatched in 90 days to read' : flowBackWord(u).charAt(0).toUpperCase() + flowBackWord(u).slice(1);
  return { tone: tone, t: t, head: head, on: within != null ? Math.round(within * 100) + '% of the value on target' : '',
    text: head + (u != null && within != null ? ', ' + Math.round(within * 100) + '% of the value on target' : '') };
}
function flowRow(title, fig, sub, tone, attrs) {
  return '<div class="inv-row inv-row-2"' + (attrs || '') + '><span class="inv-row-main"><span class="inv-row-title">' + title + '</span>' + (sub ? '<span class="inv-row-meta inv-row-wrap">' + sub + '</span>' : '') + '</span>' +
    '<span class="inv-row-end">' + (tone ? uiDot(tone, fig) : '<span class="inv-num">' + fig + '</span>') + '</span></div>';
}
/* The steps of the flow as rows: challan to pickling, to plating, to despatch; and invoice to payment for a role that sees money. */
function flowStepsHtml(st, clientId) {
  var v = flowVerdict(st, clientId), money = typeof grdSeesMoney !== 'function' || grdSeesMoney();
  var h = flowRow('Challan to pickling', escHtml(flowDayText(st.toPickle.d)), escHtml(st.toPickle.n ? 'median of ' + todoPlural(st.toPickle.n, 'line') + ' with a load set against it' : 'no load set against a challan yet'), null, ' data-flow-step="pickle"') +
    flowRow('Challan to plating', escHtml(flowDayText(st.toPlate.d)), escHtml(st.toPlate.n ? 'median of ' + todoPlural(st.toPlate.n, 'line') + ' with plating set against it' : 'no plating set against a challan yet'), null, ' data-flow-step="plate"') +
    // Two facts a line (§3b-11): how many lines, the target; the share on target is the verdict's.
    flowRow('Challan to despatch', escHtml(flowDayText(st.toDespatch.d)), escHtml((st.toDespatch.n ? 'median of ' + todoPlural(st.toDespatch.n, 'line') : 'nothing despatched yet') + ' · the target: ' + flowDaysWord(v.t.days)),
      v.tone === 'neutral' ? null : v.tone, ' data-flow-step="despatch"');
  if (money) {
    var pay = st.pay, terms = st.terms.days, tone = pay ? (pay.d <= terms ? 'ok' : pay.d <= terms * 1.5 ? 'warning' : 'danger') : null;
    h += flowRow('Invoice to payment', pay ? escHtml(pay.d + ' d') : '—', escHtml((pay ? 'median of ' + todoPlural(pay.n, 'receipt') + ' set against invoices' : finSeen() ? 'no receipt set against an invoice yet' : 'no bank statement yet') + ' · terms ' + terms + ' days'), tone, ' data-flow-step="pay"');
  }
  return h;
}
/* A client's page: its flow over 90 days, each open challan's expected despatch, and each open invoice's expected payment.
   Given a fold's key (Performance, a page of analyses whose tools fold), it folds to its head, shut on the phone like the
   others there, and the head says the verdict. */
function flowClientHtml(clientId, foldKey) {
  if (!S || clientId == null) return '';
  var st = flowStats(clientId), v = flowVerdict(st, clientId), terms = flowTerms(clientId), t = flowTarget(clientId, '');
  var head = '<span class="inv-panel-title">Turnaround</span><span class="inv-panel-count">' + escHtml(flowTargetWord(t.days) + ' · ' + terms.days + '-day terms') + '</span>';
  // Two facts (§3b-11): the share on target, and what the days rest on (the plant's pace under five despatched).
  var plantPace = st.usual.plant && st.toDespatch.n < FLOW_MIN;
  var h = foldKey ? '' : '<div class="inv-row inv-row-2" data-flow-verdict><span class="inv-row-main"><span class="inv-row-title">' + escHtml(v.head) + '</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml([v.on || 'nothing despatched in 90 days', plantPace ? 'under ' + FLOW_MIN + ' despatched: the plant’s pace' : todoPlural(st.lines, 'line') + ' in 90 days'].join(' · ')) + '</span></span>' +
    '<span class="inv-row-end">' + uiDot(v.tone, escHtml(v.tone === 'ok' ? 'On target' : v.tone === 'warning' ? 'Slipping' : v.tone === 'danger' ? 'Past target' : 'Not read')) + '</span></div>';
  h += flowStepsHtml(st, clientId);
  // Open challans, the oldest first: when each is expected back, and why.
  var open = (S.incomingMaterial || []).filter(function(m) { return String(m.clientId) === String(clientId) && (m.items || []).some(function(it) { return !it.invoiced; }); })
    .sort(function(a, b) { return (a.challanDate || '').localeCompare(b.challanDate || ''); });
  var rows = open.map(function(m) {
    var e = flowExpectChallan(m);
    if (!e) return '';
    // A day it was wanted by and will not make is red, as is a target missed by more than two working days; a target missed, amber.
    var tone = e.priority && e.priority < e.date ? 'danger' : e.over > FLOW_RED_AFTER ? 'danger' : e.late ? 'warning' : 'info';
    var ahead = e.ahead ? todoPlural(e.ahead, 'working day') + ' of work ahead on ' + PROD_LINE_LABEL[e.line] : '';
    var why = 'came in ' + stockShortDate(m.challanDate) + ' · ' + (e.priority ? 'wanted by ' + stockShortDate(e.priority) : ahead || FLOW_STAGE_WORD[e.stage]);
    var full = [FLOW_STAGE_WORD[e.stage], ahead, 'usually ' + flowDaysWord(e.usual) + (e.usualPlant ? ' (the plant’s)' : '')].filter(Boolean).join('; ');
    return '<div class="inv-row inv-row-2" data-flow-challan="' + escHtml(m.id) + '"' + (e.late ? ' data-flow-over="' + e.over + '"' : '') + ' title="' + escHtml(full) + '"><span class="inv-row-main"><span class="inv-row-title">Challan ' + escHtml(m.challanNo || 'with no number') + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(why) + '</span></span><span class="inv-row-end">' + uiDot(tone, escHtml((e.late ? 'Late · back ~' : 'Back ~') + stockShortDate(e.date))) + '</span></div>';
  }).filter(Boolean);
  // One row behind a "Show 1 more" takes the room of the row itself: six are shown whole.
  if (rows.length) h += '<div class="inv-row-group"><span>Open challans · expected back</span></div>' + uiMoreHtml('flow-challans-' + clientId, rows, { n: rows.length === 6 ? 6 : 5, noun: 'challans' });
  // Open invoices: when each is expected to be paid at the client's pace, and past its terms.
  if ((typeof grdSeesMoney !== 'function' || grdSeesMoney()) && typeof finSeen === 'function' && finSeen()) {
    var recv = finCtx().recv(), r = recv.find(function(x) { return String(x.client.id) === String(clientId); }), hist = bankPayHistory(recv), book = bankBookDaysToPay(hist);
    var invs = r ? r.open.filter(function(o) { return o.inv && o.due > 0.005; }) : [];
    var today = localDateStr();
    var irows = invs.map(function(o) {
      var e = flowExpectInvoice(clientId, o, hist, book ? book.median : null);
      // Past its terms is red; past the day its client's pace (or the book's) gave it, amber; else the day it is expected.
      var tone = e.past ? 'danger' : e.date && e.date < today ? 'warning' : 'info';
      var word = e.past ? 'Past terms' : !e.date ? 'Due ' + stockShortDate(e.due) : e.date < today ? 'Slow · expected ~' + stockShortDate(e.date) : 'Expected ~' + stockShortDate(e.date);
      return '<div class="inv-row inv-row-2" data-flow-invoice="' + escHtml(o.inv.id) + '" data-flow-pay="' + (e.past ? 'past' : e.date && e.date < today ? 'slow' : 'due') + '" title="' + escHtml('of ' + formatDate(o.date) + ', due ' + formatDate(e.due)) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(o.label || o.inv.displayNumber || '') + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">' + escHtml(formatCurrency(o.due) + ' · ' + (e.days != null ? (e.own ? 'pays' : 'the book pays') + ' in ' + e.days + ' days' : 'due ' + formatDate(e.due))) + '</span></span>' +
        '<span class="inv-row-end">' + uiDot(tone, escHtml(word)) + '</span></div>';
    });
    if (irows.length) h += '<div class="inv-row-group"><span>Open invoices · expected paid</span></div>' + uiMoreHtml('flow-invoices-' + clientId, irows, { n: irows.length === 6 ? 6 : 5, noun: 'invoices' });
  }
  var attrs = ' data-client-flow="' + escHtml(String(clientId)) + '"';
  // Folded, its head is the title and the verdict, which wraps rather than run under the chevron; the target and the terms
  // are the steps' own (the despatch row, the payment row), and the verdict's title.
  if (foldKey) return uiFoldHtml(foldKey, '<span class="inv-panel-title">Turnaround</span><span class="inv-dot inv-dot-' + uiTone(v.tone) + '" title="' +
    escHtml(flowTargetWord(t.days) + ' · ' + terms.days + '-day terms') + '">' + escHtml(v.text) + '</span>', h, _isDesktop, attrs + ' data-card="flow"');
  return '<div class="inv-panel inv-panel-flush"' + attrs + '><div class="inv-panel-head">' + head + '</div>' + h + '</div>';
}
/* Floor's Overview: the plant's flow as a hero, shut to its line until opened, as the others are. */
function flowHeroHtml() {
  var st = flowStats(null), v = flowVerdict(st, null), today = localDateStr(), since = isoAddDays(today, -FLOW_LATE_DAYS);
  var late = flowLines().filter(function(x) { return x.row && x.date >= since && x.date <= today && flowWd(x.date, today) > x.target.days; });
  var wanted = flowLines().filter(function(x) { return x.row && x.priority && x.stage !== 'plated' && x.priority <= today; });
  var tone = wanted.some(function(x) { return x.priority < today; }) ? 'danger' : late.length ? (v.tone === 'danger' ? 'danger' : 'warning') : v.tone;
  var stages = {};
  late.forEach(function(x) { stages[x.stage] = (stages[x.stage] || 0) + 1; });
  var body = '<div class="inv-hero-sheet">' + flowStepsHtml(st, null) +
    flowRow('Past the target now', String(late.length), escHtml(late.length ? FLOW_STAGES.filter(function(k) { return stages[k]; }).map(function(k) { return stages[k] + ' ' + FLOW_STAGE_WORD[k]; }).join(', ') : 'nothing open past its target'), late.length ? 'warning' : 'ok', ' data-flow-late') +
    (wanted.length ? flowRow('Wanted by today, not plated', String(wanted.length), escHtml(todoPlural(wanted.length, 'line') + ' on challans wanted by a day'), wanted.some(function(x) { return x.priority < today; }) ? 'danger' : 'warning', ' data-flow-wanted-now') : '') + '</div>';
  var link = typeof flrLink === 'function' ? flrLink('pageProduction', 'invFlowPlant', 'Open In plant') : '';
  return uiHeroHtml({ tone: tone, vital: true, eyebrow: '<span>Turnaround</span><span class="inv-panel-count">90 days</span>',
    fig: st.toDespatch.d != null ? escHtml(String(st.toDespatch.d)) + '<span class="inv-unit">d</span>' : '&mdash;', title: escHtml(v.text),
    sub: escHtml(late.length ? todoPlural(late.length, 'line') + ' past the target now' : 'nothing open past its target'),
    body: body, fold: 'flr-hero-flow', open: false, attrs: ' data-card="flr-flow"', foot: link });
}
