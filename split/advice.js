/* ===== WHAT TO DO: answers that end in moves (Direction B, step 1; P133) =====

   Owner, 1 Oct 2026: "In the pulse, we have a question that asks who's driving it and there is an answer with a reason,
   with no possible solutions and steps to be taken to ensure smooth running of our plant. Lots of things in the app that
   can answer itself but that linkage is missing." (docs/DIRECTION_B.md § Answers that say what to do.)

   A question the app answers ends in the MOVES that answer it. A move is one row: the move in a sentence, what it is
   worth, what it rests on, and one button to the place where it is made, filled in as far as the book allows.
   - Every figure is the one its own screen shows, read from that screen's function: the contribution by client
     (statsClientMargins), the live cost (liveCost), a stock line's status and the reorder list, the power case
     (powerAnalysis), the Areas card (areaStats), the week's payout (payForecast), the receivables and the forecast, the
     By the hour panel's rounds, the To-do's own rules. Never a second arithmetic.
   - Nothing is applied. A move opens a place or a draft (a quotation, an invoice with its challans ticked); nothing is
     written until the owner saves there. Add to my list makes it a task of the owner's own that keeps the button.
   - A move that cannot be worked out is left out; a question with none says what would make one appear.

   A move: {key, tone: 'red'|'amber'|'info'|'ok', say, worth: {amount, sign, per: 'month'|'period'|'year'|null, label?} |
   null, basis, go: a todoGo descriptor, goLabel, href: 'tel:…' | 'mailto:…' | null, hrefLabel, task}. `say`, `basis` and
   `task` are plain text, escaped where drawn. `key` names the decision, so the same move drawn on two cards is one, and a
   task added from it marks both. */

var ADV_SHOW = 3;                 // moves shown in a list; the rest behind "Show N more moves"
var ADV_DRAFT_PARTS = 3;          // a reprice draft's lines: the client's largest parts by tonnage, the last 90 days
var ADV_PROD_HOUR = 11;           // a staffed line with no general-shift record by this hour asks for its register
var ADV_TONE_RANK = { red: 0, amber: 1, info: 2, ok: 3 };
var ADV_PERIOD_WORDS = { mtd: 'this month', qtd: 'this quarter', ytd: 'this financial year', all: 'over the whole book' };
var ADV_OPTION_NAME = { ts: 'the TSUISL supply switch', inv: 'an inverter and battery', gen: 'a diesel generator' };
var ADV_LISTED_HTML = '<span class="inv-dot inv-dot-ok" data-adv-listed>On your list</span>';
var _advMoves = {};               // every move drawn, by key: a tap finds its place, Add to my list its words
var _advRows = {};                // every move drawn, by its row (advRowRef)

/* A drawn move's row: its key and its words. One decision is one key wherever it is drawn (a task added from either
   marks both), but two moves of it can differ in words and place (QA5-5: an insight asks a client for a month's full
   cost, a question for the period's), so a tap acts on the move drawn under it, never on another drawn later. */
function advRowRef(mv) {
  var ref = mv.key + '#' + mv.say;
  _advRows[ref] = mv;
  _advMoves[mv.key] = mv;
  return ref;
}

/* ---------- Reading the book once per render ---------- */
/* One move or one question failing on a shape nobody anticipated must not take the others with it (the To-do's rule). */
function advSafe(f, dflt) {
  try { return f(); } catch (e) { try { console.warn('advice: ' + ((e && e.message) || e)); } catch (x) { /* no console */ } return dflt; }
}
/* What every question reads, worked out once per render: the period's margins and cost, the To-do's tasks, the last 90
   and 30 days' tonnage by client, the power case, the receivables. */
function advCtx(a) {
  var memo = {};
  var once = function(k, f) { if (!Object.prototype.hasOwnProperty.call(memo, k)) memo[k] = advSafe(f, null); return memo[k]; };
  var ctx = { a: a, r: statsRangeIso(a.period), today: localDateStr(), words: ADV_PERIOD_WORDS[a.period] || 'in the period', cards: {} };
  ctx.margins = function() { return once('margins', function() { return statsClientMargins(a.period, a.filtered, a.tonnage); }); };
  ctx.cost = function() {
    var m = ctx.margins();
    return m ? m.c : once('cost', function() { return a.tonnage.kg > 0 ? liveCost(ctx.r.from, ctx.r.to, a.tonnage.kg) : null; });
  };
  // The tasks the role signed in sees (todo.js todoSees): a question never moves on a task its screens would not list.
  var seen = function(list) { return typeof todoSees === 'function' ? (list || []).filter(todoSees) : (list || []); };
  ctx.todo = function() { return once('todo', function() { return seen(todoAppAll()); }) || []; };
  // One To-do rule's tasks: those the list already raised where the rule is on, else the rule's own test run here (the
  // questions ask whatever the To-do's switches say).
  ctx.rule = function(name) {
    return once('rule:' + name, function() {
      return todoCfg()[name] ? ctx.todo().filter(function(t) { return t.rule === name; }) : seen((TODO_RULE_FNS[name]() || []).map(todoConfApply));
    }) || [];
  };
  ctx.days = function(n) { return once('days' + n, function() { return advWindow(n); }); };
  // A month at the last 90 days' pace: what the worth of a monthly move is read at ("a month at the last three months' tonnage").
  ctx.monthKg = function(id) { var d = ctx.days(90); return d && d.by[String(id)] ? d.by[String(id)].kg / 3 : 0; };
  ctx.plantMonthKg = function() { var d = ctx.days(90); return d ? d.kg / 3 : 0; };
  ctx.power = function() { return once('power', function() { return powerAnalysis(); }); };
  ctx.hourRef = function() { return once('hourRef', function() { return cpLineHourRef(); }); };
  ctx.plantMoves = function() { return once('plantMoves', function() { return advPlantMoves(ctx); }) || []; };
  return ctx;
}
/* The last n days of billing (today in), net of credit notes as Stats counts it, rolled up by client. */
function advWindow(n) {
  var to = localDateStr(), from = isoAddDays(to, -(n - 1));
  var inv = statsInvoices().filter(function(i) { return i.date && i.date >= from && i.date <= to; });
  var by = {}, kg = 0;
  buildClientRollup(inv).forEach(function(r) { by[String(r.clientId)] = r; kg += r.kg; });
  return { from: from, to: to, inv: inv, by: by, kg: kg };
}

/* ---------- Words and figures ---------- */
function advRs(v) { return formatCurrency(gstRound(Math.abs(Number(v) || 0))); }
function advKg(kg) { return kg >= 1000 ? formatNum(kg / 1000, 1) + ' t' : formatNum(kg, 0) + ' kg'; }
function advLower(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }
function advClient(id) { return id == null ? null : (S.clients || []).find(function(c) { return String(c.id) === String(id); }) || null; }
function advNameOf(c, fallback) { return (c && c.name) || fallback || 'the client'; }
/* How to reach a client from its master: a tel: link for its mobile or phone, else a mailto: for its email. */
function advContact(c) {
  if (!c) return null;
  // The first of the client's numbers that can be dialled: a mobile written as a dash does not hide the phone.
  var num = [c.mobile, c.phone].map(function(v) { return String(v || '').trim(); })
    .filter(function(v) { return v.replace(/\D/g, '').length >= 6; })[0];
  if (num) return { href: 'tel:' + num.replace(/[^\d+]/g, ''), label: 'Call', verb: 'Call', number: num };
  var mail = String(c.email || '').trim();
  if (/^[^\s@<>"'&]+@[^\s@<>"'&]+\.[^\s@<>"'&]+$/.test(mail)) return { href: 'mailto:' + mail, label: 'Email', verb: 'Write to', number: mail };
  return null;
}
function advWorthLabel(w) { return w.label || (w.per === 'month' ? 'a month' : w.per === 'period' ? 'on the period' : w.per === 'year' ? 'a year' : ''); }
/* A worth as words, for a task's note: "+₹1,53,000.00 a month". */
function advWorthText(w) {
  if (!w || !(w.amount > 0.005)) return '';
  return (w.sign < 0 ? '−' : '+') + advRs(w.amount) + (advWorthLabel(w) ? ' ' + advWorthLabel(w) : '');
}
/* A worth as a judged figure (DR-8): + in the ok tone, − in the danger tone, the sign the symbol it travels with. */
function advWorthHtml(w) {
  if (!w || !(w.amount > 0.005)) return '';
  return figHtml('<span class="inv-num" data-adv-worth>' + (w.sign < 0 ? '&minus;' : '+') + escHtml(advRs(w.amount)) + '</span>', w.sign < 0 ? 'danger' : 'ok') +
    (advWorthLabel(w) ? ' ' + escHtml(advWorthLabel(w)) : '');
}
/* What a move is worth a month, to rank by: a period's figure is scaled to thirty days, a year's divided by twelve, a
   one-off counts as it is. A move with no worth ranks after every one with one. */
function advRankValue(mv, ctx) {
  var w = mv.worth;
  if (!w || !(w.amount > 0)) return 0;
  if (w.per === 'period' && ctx) return w.amount * 30 / Math.max(1, isoDaysBetween(ctx.r.from, ctx.r.to) + 1);
  if (w.per === 'year') return w.amount / 12;
  return w.amount;
}
/* Ranked by worth, then tone; one decision once. */
function advRank(list, ctx) {
  var seen = {};
  return list.filter(function(mv) { if (!mv || seen[mv.key]) return false; seen[mv.key] = true; return true; })
    .map(function(mv, i) { return { mv: mv, i: i, v: advRankValue(mv, ctx) }; })
    .sort(function(a, b) { return b.v - a.v || (ADV_TONE_RANK[a.mv.tone] - ADV_TONE_RANK[b.mv.tone]) || a.i - b.i; })
    .map(function(x) { return x.mv; });
}

/* ---------- Moves shared by the questions and the tasks ---------- */
/* Call (or write to) a client: the tel: or mailto: link from its master; Add to my list keeps the way to the client.
   `why` tells one call from another to the same client (the key names the decision). */
function advCallMove(c, say, worth, basis, tone, why) {
  var ct = advContact(c);
  if (!ct) return null;
  return { key: 'call:' + c.id + ':' + (why || 'call'), tone: tone || 'info', say: say, worth: worth || null, basis: (basis ? basis + ' · ' : '') + ct.number,
    href: ct.href, hrefLabel: ct.label, go: { kind: 'client', id: c.id }, goLabel: 'The client', task: say };
}
/* A client's Performance, on the panel that answers the move. */
function advPerfMove(c, id, panel, say, worth, basis) {
  var cid = c ? c.id : id;
  if (cid == null) return null;
  return { key: 'perf:' + cid + ':' + panel, tone: 'info', say: say, worth: worth || null,
    basis: basis || (panel === 'hour' ? 'By the hour: what an hour of each part earns' : 'its parts, each against its own rhythm'),
    go: { kind: 'perf', clientId: cid, panel: panel }, goLabel: panel === 'hour' ? 'By the hour' : 'Performance', task: say };
}
/* What a client owes, from the receivables (only with a statement). */
function advOwesMove(c, id) {
  if (!finHasBank()) return null;
  var r = finCtx().recv().find(function(x) { return String(x.client.id) === String(c ? c.id : id); });
  if (!r || !(r.owed > 0.5)) return null;
  var name = advNameOf(c, r.client.name);
  return { key: 'owes:' + r.client.id, tone: 'info', say: 'See what ' + name + ' owes: ' + advRs(r.owed),
    worth: { amount: r.owed, sign: 1, label: 'owed to us' }, basis: todoPlural(r.open.length, 'open invoice') + (r.oldestDays != null ? ', the oldest ' + r.oldestDays + ' days' : ''),
    go: { kind: 'finance', tab: 'receipts', client: r.client.id }, goLabel: 'Receivables', task: 'See what ' + name + ' owes' };
}
/* The quotation a reprice drafts: the client's largest parts by tonnage over the last 90 days, each by the piece at the
   target ₹/kg × its kg a piece where the client's weight is known (prodKgPerPiece: its card, Part weights, the Items
   Master for a part held by one gauge), else by the kilo at the target. `inv` is the 90 days' invoices where worked out;
   `basis` says which full cost the target is (a month's, for an insight), else it is the one "then". */
function advRepriceDraft(clientId, target, inv, basis) {
  var today = localDateStr();
  var mine = (inv || advWindow(90).inv).filter(function(i) { return String(i.clientId) === String(clientId); });
  var unweighed = [];
  var lines = buildTopItems(mine, 'tonnage').rows.slice(0, ADV_DRAFT_PARTS).map(function(r) {
    var w = prodKgPerPiece(clientId, today, r.part, r.desc || (r.gauge ? '(' + r.gauge + ')' : ''));
    var item = r.part + (r.gauge && String(r.part).toUpperCase().replace(/\s+/g, '').indexOf(r.gauge) < 0 ? ' (' + r.gauge + ')' : '');
    if (w && w.kg > 0) return { item: item, partNumber: r.part, desc: '', basis: 'piece', rate: gstRound(target * w.kg), refWeightKg: w.kg, note: '' };
    unweighed.push(r.part);
    return { item: item, partNumber: r.part, desc: '', basis: 'kg', rate: gstRound(target), refWeightKg: null, note: '' };
  });
  if (!lines.length) lines = [{ item: '', partNumber: '', desc: '', basis: 'kg', rate: gstRound(target), refWeightKg: null, note: '' }];
  return { lines: lines, unweighed: unweighed, note: 'Drafted from the Pulse on ' + formatDate(today) + ': ' + formatCurrency(target) + '/kg, the full cost ' + (basis || 'then') };
}
/* Ask a client below the full cost for the full cost, a quotation drafted with its largest parts. */
function advRepriceMove(ctx, x) {
  var m = ctx.margins(), target = gstRound(m.fullKg), c = advClient(x.id), name = advNameOf(c, x.name);
  var mk = ctx.monthKg(x.id), draft = advRepriceDraft(x.id, target, ctx.days(90) ? ctx.days(90).inv : null);
  var basis = ['the live cost, ' + statsPctOf(m.c.measuredShare) + '% measured', 'now ' + formatCurrency(x.net) + '/kg',
    mk > 0 ? advKg(mk) + ' a month' : '',
    m.varKg != null ? 'it covers its variable cost at ' + formatCurrency(m.varKg) + '/kg' : 'the variable cost is not known yet'].filter(Boolean).join(' · ');
  // The full cost is the period's: the words say which, since an insight's move asks the same client for a month's own
  // (ADV_TASK_MOVES.insBelowVar) and both can be on one page (QA5-5). One decision, one key.
  var said = 'Ask ' + name + ' for ' + formatCurrency(target) + '/kg, the full cost ' + ctx.words;
  return { key: 'reprice:' + x.id, tone: x.vsVar != null && x.vsVar < 0 ? 'red' : 'amber', what: name + ' below the full cost',
    say: said,
    worth: mk > 0 ? { amount: (target - x.net) * mk, sign: 1, per: 'month', label: 'a month at the last three months’ tonnage' } : null,
    basis: basis, go: { kind: 'quoteDraft', clientId: x.id, lines: draft.lines, note: draft.note }, goLabel: 'Draft quotation',
    task: said,
    hint: draft.unweighed.length ? 'Enter a weight per piece for ' + name + '’s ' + draft.unweighed.join(', ') + ' (its card, Part weights or the Items Master) to quote ' +
      (draft.unweighed.length === 1 ? 'it' : 'them') + ' by the piece.' : '' };
}

/* ---------- 1. Is the plant running smoothly? ---------- */
function advStockMoves(ctx) {
  var items = stockData().items.filter(function(i) { return i.active !== false; });
  var red = [];
  items.forEach(function(it) { var st = stockStatus(it); if (st.tone === 'red') red.push({ it: it, st: st }); });
  ctx.seen.stock = { lines: items.length, red: red.length };
  if (!red.length) return [];
  // The reorder list's own rows: its quantity, last price and supplier for each line.
  var rows = {};
  stockReorderList().groups.forEach(function(g) { g.rows.forEach(function(r) { rows[r.item.id] = r; }); });
  return red.map(function(x) {
    var it = x.it, st = x.st, r = rows[it.id], unit = it.unit || '', out = st.group === 'out';
    var basis = [st.level != null ? stockFmtQty(Math.max(0, st.level)) + ' ' + unit + ' on the shelf' : '',
      st.rate && st.rate.rate ? 'uses ' + stockFmtRate(st.rate.rate) + ' ' + unit + ' a day' : 'no daily use on record',
      r && r.price != null ? 'last bought ' + (r.supplier && r.supplier !== 'No supplier on record' ? 'from ' + r.supplier + ' ' : '') + 'at ' + formatCurrency(r.price) + '/' + unit : 'no price on record'].filter(Boolean).join(' · ');
    return { key: 'stock:' + it.id, tone: 'red', soon: out ? 0 : Math.max(0, st.daysLeft || 0), cat: 0, what: it.name + (out ? ' out' : ' running out'),
      say: 'Order ' + it.name + (out ? ': it is out' : ': about ' + stockDaysText(st.daysLeft, !!(st.rate && st.rate.tentative)) + ' left'),
      worth: r && r.amount > 0 ? { amount: r.amount, sign: -1, label: 'for ' + stockFmtQty(r.qty) + ' ' + unit + ' at the last price, before GST' } : null,
      basis: basis, go: { kind: 'reorder' }, goLabel: 'Reorder list', task: 'Order ' + it.name };
  });
}
function advWageMoves(ctx) {
  // The week's payout is wages: a role that may not see them has no such move (guard.js grdSeesWages).
  if (!staffActive().length || (typeof grdSeesWages === 'function' && !grdSeesWages())) return [];
  var ws = attWeekStartOf(ctx.today), sat = isoAddDays(ws, 6), until = isoDaysBetween(ctx.today, sat);
  if (until > 2) return [];
  var f = payForecast(ws);
  if (!(f.predicted > 0)) return [];
  var basis = f.basis === 'pace' ? f.week.recordedDays + ' of ' + f.week.workingDays + ' working days recorded, the rest at this week’s pace'
    : f.basis === 'median' ? 'nothing recorded this week yet: the median week stands in' : 'every working day recorded';
  return [{ key: 'wages:' + sat, tone: until === 0 ? 'amber' : 'info', soon: until, cat: 1, what: 'the payout ' + (until === 0 ? 'today' : 'on Saturday'),
    say: 'Have ' + advRs(f.predicted) + ' ready for ' + (until === 0 ? 'today’s' : 'Saturday’s') + ' payout',
    worth: { amount: f.predicted, sign: -1, label: 'due ' + (until === 0 ? 'today' : formatDate(sat)) },
    basis: basis + (f.median != null ? ' · median week ' + advRs(f.median) : ''), go: { kind: 'payWeek' }, goLabel: 'Pay', task: 'Weekly payout, ' + formatDate(sat) }];
}
function advPowerMoves(ctx) {
  var a = ctx.power();
  if (!a || !a.cuts.length) return [];
  var m = ctx.today.slice(0, 7), mm = a.months.find(function(x) { return x.month === m; });
  ctx.seen.power = { cuts: mm ? mm.cuts : 0, cost: mm ? mm.cost : 0, min: mm ? mm.min : 0 };
  if (!mm || !mm.cuts) return [];
  // The case's recommendation (§8: the TSUISL switch first), else the option that pays back soonest.
  var opts = (a.options || []).filter(function(o) { return o.payLo != null && o.gain > 0; });
  var rec = opts.find(function(o) { return o.key === 'ts'; }) || opts.slice().sort(function(p, q) { return p.payLo - q.payLo; })[0] || null;
  return [{ key: 'power:' + m, tone: 'amber', soon: 1, cat: 2, what: todoPlural(mm.cuts, 'power cut') + ' this month',
    say: (rec ? 'Take up ' + (ADV_OPTION_NAME[rec.key] || rec.label) : 'Read the power case') + ': ' + todoPlural(mm.cuts, 'cut') + ' this month cost ' + advRs(mm.cost),
    worth: rec ? { amount: rec.gain, sign: 1, per: 'year', label: 'a year, the case’s gain' } : (mm.cost > 0 ? { amount: mm.cost, sign: -1, label: 'this month, in damage' } : null),
    basis: (rec ? 'pays back in ' + _pcMonths(rec.payLo) + ' to ' + _pcMonths(rec.payHi) + ' · ' : '') +
      (a.year ? 'a year at the last 90 days’ rate costs ' + advRs(a.year.base) : 'not a year of record to read against yet'),
    go: { kind: 'powerCase' }, goLabel: 'Power case', task: 'Act on the power case' }];
}
function advStaffMoves(ctx) {
  if (!(S.staff || []).length) return [];
  var days = statsWorkingDayList(isoAddDays(ctx.today, -10), ctx.today).slice(-6);
  if (!days.length) return [];
  // The Areas card's own reading: each unit's heads against its number (areaNeedOn), a day it ran, and the EXTRA it booked.
  var st = areaStats(days[0], ctx.today), rate = labourCfg().extraRate || 0, out = [];
  ctx.seen.floor = { recorded: st.recordedDays, short: 0, days: days.length };
  st.units.forEach(function(u) {
    var sd = u.days.filter(function(d) { return days.indexOf(d.iso) >= 0 && d.short > 0; });
    if (sd.length < 3) return;
    ctx.seen.floor.short++;
    var booked = gstRound(sd.reduce(function(s, d) { return s + (d.booked || 0); }, 0));
    var most = sd.reduce(function(t, d) { return d.short > t.short ? d : t; }, sd[0]);
    out.push({ key: 'staff:' + u.id, tone: 'amber', soon: 1, cat: 3, what: u.label + ' short of its number',
      say: 'Bring ' + u.label + ' up to its number: short on ' + sd.length + ' of the last ' + days.length + ' working days',
      worth: booked > 0 && rate > 0 ? { amount: booked * rate, sign: -1, label: 'in EXTRA booked on those days' } : null,
      basis: 'short by up to ' + todoPlural(most.short, 'hand') + ' against its ' + most.norm + ' · ' + (booked > 0 ? formatNum(booked, 1) + ' h of EXTRA booked to it' : 'no EXTRA booked to it'),
      go: { kind: 'areas' }, goLabel: 'Areas', task: 'Staff ' + u.label + ' to its number' });
  });
  return out;
}
function advProdMoves(ctx) {
  if (new Date().getHours() < ADV_PROD_HOUR) return [];
  // Only where the floor's record is kept: a plating counted in the last fortnight.
  var since = isoAddDays(ctx.today, -14);
  if (!prodIndex().counted.some(function(e) { return e.date >= since && e.date <= ctx.today; })) return [];
  var staffed = prodStaffedLines((S.attendance || {})[ctx.today]), gen = prodGeneralLines()[ctx.today] || {};
  return PROD_LINES.filter(function(l) { return staffed[l] && !gen[l]; }).map(function(l) {
    return { key: 'prod:' + l + ':' + ctx.today, tone: 'info', soon: 0, cat: 4, what: PROD_LINE_LABEL[l] + ' with no record today',
      say: 'Read ' + PROD_LINE_LABEL[l] + '’s register: no production recorded for it today', worth: null,
      basis: 'staffed on today’s general shift, and no plating counted for it yet',
      go: { kind: 'prodLines', line: l, day: ctx.today }, goLabel: 'Production', task: 'Record ' + PROD_LINE_LABEL[l] + '’s production, ' + formatDate(ctx.today) };
  });
}
function advBackupMoves(ctx) {
  // The To-do's backup rule is the test, and its switch in Settings is the owner's say on it.
  if (!todoCfg().backup) return [];
  var t = ctx.rule('backup')[0];
  if (!t) return [];
  return [{ key: 'backup', tone: 'info', soon: 7, cat: 5, what: advLower(t.sub), say: 'Back up the book: ' + advLower(t.sub), worth: null, basis: t.why,
    go: t.go, goLabel: 'Backup', task: 'Back up the book' }];
}
function advQSmooth(ctx) {
  ctx.seen = {};
  var moves = [].concat(advSafe(function() { return advStockMoves(ctx); }, []), advSafe(function() { return advWageMoves(ctx); }, []),
    advSafe(function() { return advPowerMoves(ctx); }, []), advSafe(function() { return advStaffMoves(ctx); }, []),
    advSafe(function() { return advProdMoves(ctx); }, []), advSafe(function() { return advBackupMoves(ctx); }, []));
  // What could stop it soonest first: a line out today before a cut this month.
  moves.sort(function(a, b) { return a.soon - b.soon || ADV_TONE_RANK[a.tone] - ADV_TONE_RANK[b.tone] || a.cat - b.cat; });
  var worst = moves.reduce(function(t, mv) { return ADV_TONE_RANK[mv.tone] < ADV_TONE_RANK[t] ? mv.tone : t; }, 'ok');
  var answer = moves.length
    ? { tone: uiTone(worst === 'ok' ? 'info' : worst), say: escHtml(todoPlural(moves.length, 'thing') + ' could stop it: ' + moves.slice(0, 3).map(function(mv) { return mv.what; }).join(', ') +
      (moves.length > 3 ? ' and ' + (moves.length - 3) + ' more' : '') + '.') }
    : { tone: 'ok', say: 'Yes: nothing stands in the way this week.' };
  return { key: 'smooth', q: 'Is the plant running smoothly?', html: advSmoothTiles(ctx.seen) + statsStorySay(answer.tone, answer.say), answer: answer,
    moves: moves, sorted: true,
    none: 'A move appears here when a stock line runs low, a power cut is recorded, an area runs short of its number, the week’s payout falls due or the backup is a week old.' };
}
/* The figures behind the answer, each only where its record is kept. */
function advSmoothTiles(seen) {
  var t = '';
  if (seen.stock && seen.stock.lines) t += statsTile('stock', 'Stock lines low', String(seen.stock.red), statsTileSub(seen.stock.red ? 'out or at the red line' : 'every line above its red line'), seen.stock.red ? 'danger' : 'ok');
  if (seen.power) t += statsTile('power', 'Power cuts', String(seen.power.cuts), statsTileSub(seen.power.cuts ? 'this month, ' + escHtml(advRs(seen.power.cost)) : 'none this month'), seen.power.cuts ? 'warning' : 'ok');
  if (seen.floor && seen.floor.recorded) t += statsTile('floor', 'Areas short', String(seen.floor.short), statsTileSub('on 3 or more of the last ' + seen.floor.days + ' working days'), seen.floor.short ? 'warning' : 'ok');
  return t ? statsTiles(t) : '';
}

/* ---------- 2. Are we making money? ---------- */
/* The open share of the challans the To-do's unbilled rule counts (older than its days), and the plated work among them. */
function advWaitingMove(ctx) {
  var cfg = todoCfg(), by = {}, total = 0, n = 0;
  (S.incomingMaterial || []).forEach(function(im) {
    if (!im.challanDate || isoDaysBetween(im.challanDate, ctx.today) < cfg.challanDays) return;
    var amt = 0;
    (im.items || []).forEach(function(it) { if (!it.invoiced) amt += imLineOpen(it).amount; });
    if (!(amt > 0.005)) return;
    by[im.clientId] = (by[im.clientId] || 0) + amt; total += amt; n++;
  });
  if (!(total > 0.005)) return null;
  var ids = Object.keys(by).sort(function(a, b) { return by[b] - by[a]; }), top = ids[0], one = by[top] / total >= 0.6;
  var plated = ctx.rule('prodPlatedUnbilled');
  var name = advNameOf(advClient(top), 'one client');
  return { key: 'bill:waiting', tone: 'amber', say: 'Bill what is waiting: ' + todoPlural(n, 'challan') + ' over ' + cfg.challanDays + ' days, not invoiced',
    worth: { amount: total, sign: 1, label: 'waiting to be billed' },
    basis: [ids.length === 1 ? 'from ' + name : one ? advRs(by[top]) + ' of it from ' + name : 'from ' + todoPlural(ids.length, 'client'),
      plated.length ? 'plated and not invoiced for ' + todoPlural(plated.length, 'client') : ''].filter(Boolean).join(' · '),
    go: one ? { kind: 'im', clientId: top } : { kind: 'im' }, goLabel: 'Open challans', task: 'Bill the challans waiting' };
}
/* The cost line furthest above its model, measured: the money it is worth a month brought back to the model. */
function advCostLineMove(ctx) {
  var c = ctx.cost();
  if (!c || !(c.kg > 0)) return null;
  var cm = costModelCfg();
  var model = { labour: labourCfg().modelPerKg || 3.55, chem: stockCfg().chemModel, zinc: cm.zincPerKg, power: cm.power, other: cm.other };
  var best = null;
  c.rows.forEach(function(r) {
    if (r.perKg == null || !(model[r.key] > 0) || r.source === 'model' || !(r.measured > 0)) return;
    var over = r.perKg - model[r.key];
    if (over <= model[r.key] * 0.05) return;
    if (!best || over > best.over) best = { r: r, over: over, model: model[r.key] };
  });
  if (!best) return null;
  var mk = ctx.plantMonthKg(), r = best.r;
  return { key: 'cost:' + r.key, tone: 'amber', say: 'Look into ' + r.label.toLowerCase() + ': ' + formatCurrency(r.perKg) + '/kg against the ' + formatCurrency(best.model) + ' model',
    worth: mk > 0 ? { amount: best.over * mk, sign: 1, per: 'month', label: 'a month at the last three months’ tonnage, back at the model' } : null,
    basis: COST_SRC_LABEL[r.source] + ' · ' + r.note, go: { kind: 'liveCost', key: r.key, period: ctx.a.period }, goLabel: 'Live cost', task: 'Look into the ' + r.label.toLowerCase() + ' cost' };
}
function advMoneyMoves(ctx) {
  var out = [], hints = [], m = ctx.margins();
  if (m) m.ranked.filter(function(x) { return x.kg >= m.kg * 0.1 && x.vsFull < 0; }).sort(function(p, q) { return q.kg - p.kg; }).slice(0, 2).forEach(function(x) {
    var rp = advSafe(function() { return advRepriceMove(ctx, x); }, null);
    if (rp) { out.push(rp); if (rp.hint) hints.push(rp.hint); }
  });
  out.push(advSafe(function() { return advWaitingMove(ctx); }, null));
  out.push(advSafe(function() { return advCostLineMove(ctx); }, null));
  // The spare capacity: question 4's own first move.
  var plant = ctx.cards.plant;
  if (plant && plant.capPct != null && plant.capPct < 0.8) out.push(ctx.plantMoves()[0] || null);
  return { moves: advRank(out.filter(Boolean), ctx), hints: hints,
    none: !(ctx.a.tonnage.kg > 0) ? 'Nothing to work out yet: no weighed tonnage in the period. A weight per piece (the client’s card, Part weights or the Items Master) lets the app set what was billed against the cost.'
      : 'Nothing to move on: no account with a tenth of the plant is below the full cost, nothing has waited ' + todoCfg().challanDays + ' days to be billed, and every cost line is within its model.' };
}

/* ---------- 3. Who is driving it? ---------- */
function advRebateMove(ctx, x, name) {
  var since = isoAddDays(ctx.today, -89), sum = 0, n = 0;
  // Rebates only (bills.js cnIsRebate): a rate correction or goods returned is not what the client's payment terms buy (QA5-8).
  getCreditNotes().forEach(function(cn) {
    if (cn.status !== 'cancelled' && cnIsRebate(cn) && String(cn.clientId) === String(x.id) && (cn.date || '') >= since) { sum += Number(cn.taxableValue) || 0; n++; }
  });
  if (!(sum > 0.005)) return null;
  var pays = '';
  if (finHasBank()) {
    var hist = bankPayHistory(finCtx().recv()), d = bankDaysToPay(x.id, hist), b = bankBookDaysToPay(hist);
    if (d && d.median != null) pays = 'pays in ' + Math.round(d.median) + ' days' + (b && b.median != null ? ' against the book’s ' + Math.round(b.median) : '');
  }
  return { key: 'rebate:' + x.id, tone: 'info', say: 'Weigh ' + name + '’s rebate against how it pays: ' + advRs(sum) + ' credited in 90 days',
    worth: { amount: sum / 3, sign: -1, per: 'month', label: 'a month in rebates' },
    basis: todoPlural(n, 'rebate note') + ' · ' + (pays || 'no bank statement to say how fast it pays'), go: { kind: 'cnList' }, goLabel: 'Credit notes',
    task: 'Weigh ' + name + '’s rebate against how it pays' };
}
/* By the hour: its part whose round earns least under what an hour of the plant costs (the panel's own figures). */
function advHourMove(ctx, x, name) {
  var ref = ctx.hourRef(), c = advClient(x.id), hp = c ? cpHourParts(c.id) : null;
  if (!ref || !hp) return null;
  var worst = null;
  hp.times.concat(hp.auto).forEach(function(t) {
    var rd = cpRound(hp.client, t);
    if (rd.perHour == null || rd.perHour >= ref.cost) return;
    if (!worst || rd.perHour < worst.rd.perHour) worst = { t: t, rd: rd };
  });
  if (!worst) return null;
  var hints = cpRoundHints(worst.rd, worst.t.id ? worst.t : null);
  return { key: 'hour:' + x.id, tone: 'amber', say: 'Look at ' + worst.t.name + '’s rounds: an hour of it earns ' + advRs(worst.rd.perHour) + ', an hour of the plant costs ' + advRs(ref.cost),
    worth: { amount: ref.cost - worst.rd.perHour, sign: -1, label: 'on every hour of its rounds' },
    basis: hints.length ? hints[0].text : 'a round is ' + Math.round(worst.rd.total) + ' min for ' + worst.rd.pcs.v + ' pieces',
    go: { kind: 'perf', clientId: c.id, panel: 'hour' }, goLabel: 'By the hour', task: 'Look at ' + worst.t.name + '’s rounds for ' + name };
}
/* The labour question the decision turns on, settled both ways (the contribution table's own block). */
function advLabourMove(ctx, x, name) {
  var m = ctx.margins(), split = x.vsVar != null;
  return { key: 'labour:' + x.id, tone: split && x.vsVar < 0 ? 'red' : 'amber',
    say: 'Settle the labour question for ' + name + (split ? ': with labour fixed it ' + (x.vsVar >= 0 ? 'leaves ' + advRs(x.vsVar) : 'loses ' + advRs(x.vsVar)) +
      '/kg, with labour scaling it loses ' + advRs(x.vsFull) + '/kg' : ': record the attendance or import the bank statement to split labour'),
    worth: null, basis: 'contribution by client at the live cost ' + ctx.words + ', ' + statsPctOf(m.c.measuredShare) + '% measured',
    // The period it was worked out for goes with it: Stats opens there, where this client is the block named.
    go: { kind: 'stats', tab: 'clients', anchor: 'statsWorst', period: ctx.a.period }, goLabel: 'Contribution', task: 'Settle the labour question for ' + name };
}
function advClientsMoves(ctx, card) {
  var out = [], hints = [], m = ctx.margins(), x = card.worst;
  if (x && m) {
    var c = advClient(x.id), name = advNameOf(c, x.name);
    var rp = advSafe(function() { return advRepriceMove(ctx, x); }, null);
    if (rp) { out.push(rp); if (rp.hint) hints.push(rp.hint); }
    out.push(advSafe(function() { return advRebateMove(ctx, x, name); }, null));
    out.push(advSafe(function() { return advHourMove(ctx, x, name); }, null));
    out.push(advLabourMove(ctx, x, name));
  }
  var mv = card.mover;
  if (mv && mv.d < 0) {
    var mc = advClient(mv.id), mname = advNameOf(mc, 'A client'), prior = PERIOD_PRIOR_LABELS[ctx.a.period] || 'the period before';
    var stop = advPerfMove(mc, mv.id, 'materials', 'See what ' + mname + ' stopped sending: ' + advRs(mv.d) + ' less than ' + prior, { amount: -mv.d, sign: -1, per: 'period' });
    if (stop) { stop.key = 'stopped:' + stop.go.clientId + ':' + ctx.a.period; stop.tone = 'amber'; out.push(stop); }
    var call = advCallMove(mc, 'Call ' + mname + ' about the fall', null, 'billed ' + advRs(mv.d) + ' less than ' + prior, null, 'fall');
    if (call) out.push(call);
    else if (mc) hints.push('Put a phone number or an email on ' + mname + '’s card to call it from here.');
  }
  return { moves: advRank(out.filter(Boolean), ctx), hints: hints,
    none: !m ? 'Weighed billing in the period ranks the clients by what a kilo leaves; nothing to move on until then.'
      : 'Nothing to move on: no account with a tenth of the plant is below the full cost, and no client billed less than ' + (PERIOD_PRIOR_LABELS[ctx.a.period] || 'the period before') + '.' };
}

/* ---------- 4. Is the plant full? ---------- */
function advPlantMoves(ctx) {
  var plant = ctx.cards.plant, a = ctx.a;
  if (!plant || plant.capPct == null) return [];
  var out = [], m = ctx.margins();
  if (plant.capPct < 0.8) {
    // Clients that pay above the full cost and are sending less than usual, or have gone quiet against their own rhythm.
    if (m) {
      var cad = advSafe(function() { return predCadence(); }, []) || [], quiet = {};
      cad.forEach(function(q) { if (q.quiet) quiet[String(q.id)] = q; });
      var d30 = ctx.days(30);
      m.ranked.filter(function(x) { return x.vsFull > 0; }).forEach(function(x) {
        var usual = ctx.monthKg(x.id), last = d30 && d30.by[String(x.id)] ? d30.by[String(x.id)].kg : 0, q = quiet[String(x.id)];
        if (!(usual > 0) || !(q || last < usual * 0.75)) return;
        var c = advClient(x.id), name = advNameOf(c, x.name), ct = advContact(c), per = m.varKg != null ? m.varKg : m.fullKg;
        var say = 'Ask ' + name + ' for more work: ' + formatCurrency(x.net) + '/kg, usually ' + advKg(usual) + ' a month';
        var mv = { key: 'more:' + x.id, tone: 'amber', say: say,
          worth: { amount: (usual - last) * (x.net - per), sign: 1, per: 'month', label: 'a month back at its usual tonnage' },
          basis: [advKg(last) + ' in the last 30 days', q ? 'no challan for ' + q.since + ' days' : '', formatCurrency(x.vsFull) + '/kg over the full cost'].filter(Boolean).join(' · '),
          go: { kind: 'perf', clientId: x.id, panel: 'materials' }, goLabel: 'Performance', task: say };
        if (ct) { mv.href = ct.href; mv.hrefLabel = ct.label; }
        out.push(mv);
      });
    }
    // Quotations out with no answer.
    var outq = getQuotations().filter(function(q) { return q.status === 'issued' && qtLive(q); })
      .sort(function(p, q) { return String(p.date || '').localeCompare(String(q.date || '')); });
    if (outq.length) out.push({ key: 'quotes:out', tone: 'info', say: 'Follow up ' + (outq.length === 1 ? qtNumberText(outq[0]) + ' to ' + qtRecipient(outq[0]) : outq.length + ' quotations out') + ': no answer yet',
      worth: null, basis: 'the oldest issued ' + formatDate(outq[0].date) + (qtDaysLeft(outq[0]) != null ? ', valid ' + qtDaysLeft(outq[0]) + ' more days' : ''),
      go: { kind: 'quotes', status: 'issued' }, goLabel: 'Quotations', task: 'Follow up the quotations out' });
    // A new quotation at a rate that clears the full cost by 10%.
    if (m && m.fullKg > 0) {
      var rate = gstRound(m.fullKg * 1.1), spare = Math.max(0, plant.cap - a.tonnage.kg), base = m.varKg != null ? m.varKg : m.fullKg;
      // The spare tonnes are the period's, so the worth is ranked as the period's, scaled to a month (QA5-9).
      out.push({ key: 'quote:new', tone: 'info', say: 'Quote new work at ' + formatCurrency(rate) + '/kg: it clears the full cost by 10%',
        worth: spare > 0 ? { amount: spare * (rate - base), sign: 1, per: 'period', label: 'on the period’s ' + advKg(spare) + ' spare' } : null,
        basis: 'the full cost ' + ctx.words + ' ' + formatCurrency(m.fullKg) + '/kg × 1.1' + (m.varKg != null ? ' · the variable cost ' + formatCurrency(m.varKg) + '/kg' : ''),
        go: { kind: 'quoteDraft', lines: [{ item: '', partNumber: '', desc: '', basis: 'kg', rate: rate, refWeightKg: null, note: '' }],
          note: 'Drafted from the Pulse on ' + formatDate(ctx.today) + ': ' + formatCurrency(rate) + '/kg, the full cost then and 10%' },
        goLabel: 'Draft quotation', task: 'Quote new work at ' + formatCurrency(rate) + '/kg' });
    }
    // The line with the most working days and no plating on record, the last 30 days or since the record began: a day
    // before the floor kept a record says nothing about the line.
    var since = isoAddDays(ctx.today, -29), first = null;
    prodIndex().counted.forEach(function(e) { if (e.date <= ctx.today && (!first || e.date < first)) first = e.date; });
    if (first && first > since) since = first;
    if (first && first <= ctx.today) {
      var cov = prodCoverage(since, ctx.today), idle = null;
      PROD_LINES.forEach(function(l) { var x = cov[l], n = x.of - x.days; if (n >= 3 && (!idle || n > idle.n)) idle = { line: l, n: n, of: x.of }; });
      if (idle) out.push({ key: 'idle:' + idle.line, tone: 'info', say: 'Find out why ' + PROD_LINE_LABEL[idle.line] + ' has no plating on record for ' + idle.n + ' of the last ' + idle.of + ' working days',
        worth: null, basis: 'Production’s record of the line: a day nobody recorded is a gap, or a day it stood idle',
        go: { kind: 'prodLines', line: idle.line }, goLabel: 'Production', task: 'Find out why ' + PROD_LINE_LABEL[idle.line] + ' sat idle' });
    }
  } else {
    // Busy: the worst-priced work to reprice, and the overtime it is costing.
    var worst = m ? m.ranked.filter(function(x) { return x.kg >= m.kg * 0.1 && x.vsFull < 0; })[0] : null;
    if (worst) out.push(advSafe(function() { return advRepriceMove(ctx, worst); }, null));
    if ((S.staff || []).length) {
      var st = areaStats(isoAddDays(ctx.today, -27), ctx.today), top = null;
      st.rows.forEach(function(r) { var h = r.otHours + r.extraHours; if (h > 0 && (!top || h > top.h)) top = { r: r, h: h }; });
      if (top) out.push({ key: 'ot:' + top.r.id, tone: 'info', say: 'Weigh the overtime on ' + top.r.label + ': ' + formatNum(top.h, 0) + ' h of OT and EXTRA in four weeks',
        worth: null, basis: formatNum(top.r.otHours, 0) + ' h OT · ' + formatNum(top.r.extraHours, 0) + ' h EXTRA, the Areas card’s hours', go: { kind: 'areas' }, goLabel: 'Areas',
        task: 'Weigh the overtime on ' + top.r.label });
    }
  }
  return advRank(out.filter(Boolean), ctx);
}

/* ---------- 5. Is cash coming in? ---------- */
/* A debt over 90 days: a call where the client's master has a number, and its receivables either way. */
function advOwedMove(t) {
  var c = advClient(t.clientId), name = advNameOf(c, ''), ct = advContact(c);
  var say = (ct ? ct.verb + ' ' : 'Chase ') + name + ' about ' + advRs(t.amount) + ' over 90 days';
  var mv = { key: 'owed:' + t.clientId, tone: t.tone, say: say, worth: { amount: t.amount, sign: 1, label: 'owed over 90 days' },
    basis: todoPlural(t.n, 'invoice') + ', the oldest ' + formatDate(t.oldest) + ' · owed in all ' + advRs(t.owed),
    go: { kind: 'finance', tab: 'receipts', client: t.clientId }, goLabel: 'Receivables', task: say };
  if (ct) { mv.href = ct.href; mv.hrefLabel = ct.label; }
  var last = typeof soaLastReminder === 'function' ? soaLastReminder(t.clientId) : null;
  if (last) mv.basis += ' · reminded ' + formatDate(isoOf(new Date(last.at)));
  return mv;
}
/* The reminder and the statement that goes with it (statement.js): a message from the same figures, sent from the dialog. */
function advRemindMove(t) {
  var c = advClient(t.clientId), name = advNameOf(c, '');
  if (!c) return null;
  var last = typeof soaLastReminder === 'function' ? soaLastReminder(t.clientId) : null;
  var say = 'Send ' + name + ' a reminder and its statement of account';
  return { key: 'remind:' + t.clientId, tone: t.tone, say: say, worth: null,
    basis: last ? 'last reminded ' + formatDate(isoOf(new Date(last.at))) + ' for ' + advRs(last.amount || 0) : 'no reminder sent yet',
    go: { kind: 'soa', client: t.clientId }, goLabel: 'Statement and reminder', task: say };
}
function advSlowerMove(t) {
  var c = advClient(t.clientId), name = advNameOf(c, ''), ct = advContact(c);
  var say = (ct ? ct.verb + ' ' : 'Ask ') + name + ' why its payments slowed: the last three in ' + t.days + ' days, usually ' + t.usual;
  var mv = { key: 'slower:' + t.clientId, tone: 'amber', say: say, worth: null, basis: t.why + ' · ' + t.sub,
    go: { kind: 'finance', tab: 'receipts', client: t.clientId }, goLabel: 'Receivables', task: say };
  if (ct) { mv.href = ct.href; mv.hrefLabel = ct.label; }
  return mv;
}
function advLooseMove(t) {
  return { key: 'loose', tone: t.tone, say: 'Place ' + todoPlural(t.n, 'receipt') + (t.n === 1 ? ' on its client: ' : ' on their clients: ') + advRs(t.amount) + ' came in with no client',
    worth: { amount: t.amount, sign: 1, label: 'in already, owed reads high by it' }, basis: t.why, go: t.go, goLabel: 'Place them', task: 'Place the receipts on their clients' };
}
function advRunwayMove(t) {
  return { key: 'runway', tone: t.tone, say: t.cross ? 'Plan for cash: the account goes below zero on ' + formatDate(t.cross) : 'Plan for cash: the account is overdrawn',
    worth: t.low < 0 ? { amount: -t.low, sign: -1, label: 'at its lowest, ' + formatDate(t.lowDate) } : null,
    basis: (t.onlyOut ? 'the forecast counts money out only: place receipts on their clients so it can count money in' : 'the 60-day forecast, at the statement’s pace') + ' · ' + t.sub,
    go: t.go, goLabel: 'Forecast', task: 'Plan for the cash forecast’s low' };
}
function advCashMoves(ctx) {
  if (!finHasBank()) return { moves: [], none: '' };
  var out = [];
  // The To-do's own tests: owed over 90 days (the three largest), receipts with no client, a client paying slower than
  // usual, the forecast below zero within 45 days.
  ctx.rule('owed90').slice().sort(function(a, b) { return b.amount - a.amount; }).slice(0, 3).forEach(function(t) { out.push(advOwedMove(t)); });
  ctx.rule('bankLoose').forEach(function(t) { out.push(advLooseMove(t)); });
  ctx.rule('payingSlower').forEach(function(t) { out.push(advSlowerMove(t)); });
  ctx.rule('runway').forEach(function(t) { out.push(advRunwayMove(t)); });
  return { moves: advRank(out, ctx), none: 'Nothing to chase: nobody owes over 90 days, every receipt a week old is placed, and the forecast stays above zero.' };
}

/* ---------- 6. What changed? The insights, each with its own moves ---------- */
function advChangedMoves(ctx, card) {
  var moves = [];
  (card.ins || []).slice(0, 3).forEach(function(t) { moves = moves.concat(advTaskMoves(t)); });
  return { moves: moves, inline: true,
    none: (card.ins || []).length ? 'These insights carry no move the app can work out yet: each one’s figures are on its row.' : 'No insight is raised on the book right now; each appears here with what can be done about it.' };
}

/* ---------- The questions ---------- */
/* The six questions in order, each {key, q, html, answer: {tone, say}, moves, none, hints, go, goLabel}: `html` the card's
   body (statsStoryCards, intel.js, for the five the Overview had), `moves` what can be done, worked out from the book.
   `range` is a period ('mtd'…) or statsPulseArgs' object. */
function advQuestions(range) {
  var a = range && typeof range === 'object' ? range : statsPulseArgs(range || _statsPeriod);
  var ctx = advCtx(a);
  ctx.cards = statsStoryCards(a, ctx);
  var out = [advSafe(function() { return advQSmooth(ctx); }, null)];
  [['money', advMoneyMoves], ['clients', advClientsMoves], ['plant', function(cx) { return { moves: cx.plantMoves(),
    none: ctx.cards.plant.capPct == null ? 'Weighed billing in the period says how full the plant is; nothing to move on until then.'
      : ctx.cards.plant.capPct >= 0.8 ? 'Busy, with no account below the full cost to reprice and no overtime booked.'
      : 'Spare capacity, and nothing yet says who could fill it: clients’ challans and the quotations in Clients → Quotations are what the app reads.' }; }],
    ['cash', advCashMoves], ['changed', advChangedMoves]].forEach(function(p) {
    var card = ctx.cards[p[0]];
    if (!card) return;
    var res = advSafe(function() { return p[1](ctx, card); }, null) || { moves: [] };
    out.push(Object.assign({}, card, { moves: res.moves || [], none: res.none || '', hints: res.hints || [], inline: !!res.inline }));
  });
  return out.filter(Boolean);
}
/* The six cards for a period, read exactly as Stats → Overview reads them (statsPulseArgs): Today → Pulse draws them here. */
function advPulseHtml(period) {
  var a = statsPulseArgs(period || _statsPeriod);
  return statsStoriesHtml(a.period, a.filtered, a.prior, a.tonnage, a.periodCost);
}

/* ---------- Moves on every app task ---------- */
/* Built from the task's own data (attached at its rule: clientId, itemId, month…), never from its title. A rule with no
   entry keeps its one button. */
var ADV_TASK_MOVES = {
  insQuiet: function(t) {
    var c = advClient(t.clientId), name = advNameOf(c, '');
    return [advCallMove(c, 'Call ' + name + ': it has gone quiet', t.rev3 > 0 ? { amount: t.rev3 / 3, sign: 1, per: 'month', label: 'a month at its last three months' } : null, null, 'amber', 'quiet'),
      advPerfMove(c, t.clientId, 'materials', 'See what ' + name + ' stopped sending'), advOwesMove(c, t.clientId)];
  },
  insClientDown: function(t) {
    var c = advClient(t.clientId), name = advNameOf(c, '');
    return [advPerfMove(c, t.clientId, 'materials', 'See what ' + name + ' stopped sending', t.fall > 0 ? { amount: t.fall, sign: -1, per: 'month', label: 'a month, the fall over three months' } : null),
      advCallMove(c, 'Call ' + name + ' about the fall', null, null, 'amber', 'down')];
  },
  insLeak: function(t) {
    var c = advClient(t.clientId), name = advNameOf(c, '');
    return [{ key: 'leak:' + t.clientId + ':' + t.month, tone: 'amber', say: 'Check ' + name + '’s ' + insMonthLabel(t.month) + ' invoices for lines under its rate card',
      worth: t.gap > 0 ? { amount: t.gap, sign: 1, label: 'at its own usual rate' } : null, basis: '₹0 lines, a changed rate or the mix: the register shows each line',
      go: { kind: 'register', clientId: t.clientId, month: t.month }, goLabel: 'Invoices', task: 'Check ' + name + '’s ' + insMonthLabel(t.month) + ' invoices' },
      c ? { key: 'card:' + c.id, tone: 'info', say: 'Check ' + name + '’s rate card', worth: null, basis: 'its rates and piece rates on the client', go: { kind: 'client', id: c.id }, goLabel: 'Rate card',
        task: 'Check ' + name + '’s rate card' } : null];
  },
  // An insight is about its own month, and Stats shows the period its chip holds (this month, the quarter…), where the
  // month and the block a move named may not be on screen (QA5-12): its moves open that month's report on the section.
  insRealLow: function(t) {
    return [{ key: 'mix:' + t.month, tone: 'info', say: 'See whose share of ' + insMonthLabel(t.month) + ' moved', worth: null, basis: billsMonthLabel(t.month) + '’s report: revenue, ₹/kg and share by client',
      go: { kind: 'report', report: 'monthly', from: t.month + '-01', sec: 'clients' }, goLabel: 'Report', task: 'See whose share of ' + insMonthLabel(t.month) + ' moved' }];
  },
  insBelowVar: function(t) {
    var c = advClient(t.clientId), name = advNameOf(c, ''), target = gstRound(t.fullKg);
    // The month's own full cost, said as such: the questions ask the same client for the period's (advRepriceMove).
    var said = 'Ask ' + name + ' for ' + formatCurrency(target) + '/kg, the full cost in ' + billsMonthLabel(t.month);
    var draft = advRepriceDraft(t.clientId, target, null, 'in ' + billsMonthLabel(t.month));
    return [{ key: 'reprice:' + t.clientId, tone: 'red', say: said,
      worth: t.kg > 0 ? { amount: (target - t.net) * t.kg, sign: 1, per: 'month', label: 'a month at ' + insMonthLabel(t.month) + '’s tonnage' } : null,
      basis: insMonthLabel(t.month) + ': ' + formatCurrency(t.net) + '/kg against ' + formatCurrency(t.varKg) + ' variable and ' + formatCurrency(t.fullKg) + ' full',
      go: { kind: 'quoteDraft', clientId: t.clientId, lines: draft.lines, note: draft.note }, goLabel: 'Draft quotation', task: said },
      { key: 'labour:' + t.clientId, tone: 'amber', say: 'Settle the labour question for ' + name, worth: null, basis: billsMonthLabel(t.month) + '’s contribution by client, against the variable and the full cost',
        go: { kind: 'report', report: 'monthly', from: t.month + '-01', sec: 'clients' }, goLabel: 'Report', task: 'Settle the labour question for ' + name }];
  },
  insLabour: function(t) {
    return [{ key: 'labour-model:' + t.month, tone: 'amber', say: 'See where labour’s ' + formatCurrency(t.perKg) + '/kg went, against the ' + formatCurrency(t.model) + ' model',
      worth: t.kg > 0 ? { amount: Math.abs(t.perKg - t.model) * t.kg, sign: t.perKg > t.model ? -1 : 1, label: insMonthLabel(t.month) + ', against the model' } : null,
      basis: billsMonthLabel(t.month) + '’s report: labour fixed and variable, and the hours by area', go: { kind: 'report', report: 'monthly', from: t.month + '-01', sec: 'staff' },
      goLabel: 'Report', task: 'See where labour went in ' + insMonthLabel(t.month) },
      { key: 'areas', tone: 'info', say: 'See the hours by area', worth: null, basis: 'staffing, overtime and the EXTRA by area', go: { kind: 'areas' }, goLabel: 'Areas', task: 'See the hours by area' }];
  },
  insChemPrice: function(t) {
    return (t.itemIds || []).slice(0, 3).map(function(id) {
      var it = stockItem(id);
      return it ? { key: 'price:' + id, tone: 'info', say: 'Add a bill for ' + it.name, worth: null, basis: 'used in the last 30 days with no price, so the live cost reads it at nothing',
        go: { kind: 'stock', id: id }, goLabel: 'The line', task: 'Add a bill for ' + it.name } : null;
    });
  },
  stock: function(t) {
    var it = stockItem(t.itemId);
    if (!it) return [];
    var r = null;
    stockReorderList().groups.forEach(function(g) { g.rows.forEach(function(x) { if (x.item.id === it.id) r = x; }); });
    // The decision the Pulse's stock move names (advStockMoves): one key, so it is one task whichever list adds it (QA5-5).
    return [{ key: 'stock:' + it.id, tone: t.tone, say: 'Put ' + it.name + ' on the order', worth: r && r.amount > 0 ? { amount: r.amount, sign: -1, label: 'for ' + stockFmtQty(r.qty) + ' ' + (it.unit || '') + ' at the last price' } : null,
      basis: r ? 'the reorder list: lead time and cover, rounded to the pack' : 'no daily use yet, so the list cannot suggest a quantity', go: { kind: 'reorder' }, goLabel: 'Reorder list', task: 'Order ' + it.name }];
  },
  challan: function(t) {
    var c = advClient(t.clientId), name = advNameOf(c, ''), amt = 0;
    var ims = (t.imIds || []).map(function(id) { return (S.incomingMaterial || []).find(function(m) { return m.id === id; }); }).filter(Boolean);
    ims.forEach(function(im) { (im.items || []).forEach(function(it) { if (!it.invoiced) amt += imLineOpen(it).amount; }); });
    return [c ? { key: 'invoice:' + c.id, tone: 'amber', say: 'Invoice ' + name + '’s ' + todoPlural(ims.length, 'challan'), worth: amt > 0 ? { amount: amt, sign: 1, label: 'waiting to be billed' } : null,
      basis: 'the challans ticked on a new invoice: nothing is saved until Create invoice', go: { kind: 'createFor', clientId: c.id, ims: ims.map(function(im) { return im.id; }) },
      goLabel: 'Create invoice', task: 'Invoice ' + name + '’s challans' } : null];
  },
  dispatch: function(t) {
    return [{ key: 'dispatch:' + (t.ids || []).join(','), tone: 'info', say: 'Tick the ' + todoPlural((t.ids || []).length, 'invoice') + ' in the Register and mark them', worth: null,
      basis: 'the selection bar marks them printed or dispatched in one go', go: { kind: 'regState', state: '', ids: t.ids || [] }, goLabel: 'Select them', task: 'Mark the invoices dispatched' }];
  },
  power: function(t) {
    return [{ key: 'bill:power:' + t.month, tone: t.tone, say: 'Add the electricity bill for ' + billsMonthLabel(t.month), worth: null, basis: 'until then the live cost reads electricity at the model',
      go: { kind: 'bills', month: t.month }, goLabel: 'Bills & notes', task: 'Add the electricity bill for ' + billsMonthLabel(t.month) }];
  },
  bankStale: function(t) {
    return [{ key: 'statement', tone: t.tone, say: 'Import the bank statement: ' + advLower(t.sub), worth: null, basis: t.why, go: { kind: 'finance', tab: 'bank' }, goLabel: 'Bank', task: 'Import the bank statement' }];
  },
  owed90: function(t) { return [advOwedMove(t), advRemindMove(t)].filter(Boolean); },
  payingSlower: function(t) { return [advSlowerMove(t)]; },
  bankLoose: function(t) { return [advLooseMove(t)]; },
  runway: function(t) { return [advRunwayMove(t)]; },
  prodPlatedUnbilled: function(t) {
    var c = advClient(t.clientId), name = advNameOf(c, '');
    var ims = (S.incomingMaterial || []).filter(function(im) { return String(im.clientId) === String(t.clientId) && (im.items || []).some(function(it) { return !it.invoiced; }); });
    return [c && ims.length ? { key: 'invoice:' + c.id, tone: t.tone, say: 'Invoice ' + name + '’s plated work', worth: null,
      basis: todoPlural(ims.length, 'challan') + ' with something open, ticked on a new invoice: nothing is saved until Create invoice',
      go: { kind: 'createFor', clientId: c.id, ims: ims.map(function(im) { return im.id; }) }, goLabel: 'Create invoice', task: 'Invoice ' + name + '’s plated work' } : null,
      { key: 'challans:' + t.clientId, tone: 'info', say: 'Open ' + name + '’s challans', worth: null, basis: 'awaiting invoice', go: { kind: 'im', clientId: t.clientId }, goLabel: 'Open challans',
        task: 'Open ' + name + '’s challans' }];
  },
  payCarry: function(t) {
    return [{ key: 'carry', tone: t.tone, say: 'Settle the balances brought forward', worth: null, basis: t.sub, go: { kind: 'payWeek' }, goLabel: 'Pay', task: 'Settle the balances brought forward' }];
  },
  powerLoad: function(t) {
    return [{ key: 'powerCase', tone: 'info', say: 'Read the power case: the approved load comes first', worth: null, basis: t.sub, go: { kind: 'powerCase' }, goLabel: 'Power case', task: 'Get the approved load onto the bill' }];
  }
};
function advTaskMoves(t) {
  var f = t && ADV_TASK_MOVES[t.rule];
  if (!f) return [];
  return (advSafe(function() { return f(t); }, []) || []).filter(Boolean);
}
/* A task's dialog: What you can do, above What clears it. */
function advTaskMovesHtml(t) {
  var mv = advTaskMoves(t);
  if (!mv.length) return '';
  return '<div class="inv-panel inv-panel-flush" data-adv-moves data-adv-task="' + escHtml(t.key) + '"><div class="inv-panel-head"><span class="inv-panel-title">What you can do</span></div>' +
    advMovesHtml(mv, 'task-' + t.key) + '</div>';
}
/* An insight on What changed?: its moves under its row, indented as its own. Its best move shows, the rest one tap away,
   so the card's three insights show three moves between them. */
function advInsightMovesHtml(t) {
  var mv = advTaskMoves(t);
  return mv.length ? '<div class="inv-row-children" data-adv-for="' + escHtml(t.key) + '">' + advMovesHtml(mv, 'ins-' + t.key, 1) + '</div>' : '';
}

/* ---------- Drawing ---------- */
function advListedKeys() {
  var o = {};
  todoData().tasks.forEach(function(t) { if (t.advKey && !t.doneAt) { o[t.advKey] = true; o[advKeyNow(t.advKey)] = true; } });
  return o;
}
/* A key a task kept from before one decision had one key (QA5-5): the stock task's order:<id> is the stock move's
   stock:<id>, and an insight's reprice:<client>:<month> the reprice:<client> the questions draw. */
function advKeyNow(k) { return String(k).replace(/^order:/, 'stock:').replace(/^(reprice:[^:]+):\d{4}-\d{2}$/, '$1'); }
/* A move (§6.10): the tone's mark, the move, its worth and what it rests on, then its button (a real tel: or mailto: link
   for a call) and Add to my list; on the phone the end takes a line under the row (inv-row-actions). */
function advMoveRowHtml(mv, listed) {
  var ref = ' data-adv-row="' + escHtml(advRowRef(mv)) + '"';
  var meta = [advWorthHtml(mv.worth), mv.basis ? escHtml(mv.basis) : ''].filter(Boolean).join(' · ');
  var btn = mv.href ? '<a class="inv-btn inv-btn-secondary inv-btn-sm" href="' + escHtml(mv.href) + '" data-adv-call>' + escHtml(mv.hrefLabel || 'Call') + '</a>'
    : mv.go ? '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAdvGo" data-key="' + escHtml(mv.key) + '"' + ref + '>' + escHtml(mv.goLabel || 'Open') + '</button>' : '';
  var add = listed[mv.key] ? ADV_LISTED_HTML : '<button type="button" class="inv-btn inv-btn-link inv-btn-sm" data-action="invAdvTask" data-key="' + escHtml(mv.key) + '"' + ref + '>Add to my list</button>';
  return '<div class="inv-row inv-row-auto inv-row-flow" data-adv-move="' + escHtml(mv.key) + '" data-tone="' + escHtml(mv.tone) + '">' +
    '<span class="inv-row-lead">' + todoGlyph(mv.tone) + '</span>' +
    '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(mv.say) + '</span>' +
    (meta ? '<span class="inv-row-meta inv-row-wrap">' + meta + '</span>' : '') + '</span>' +
    '<span class="inv-row-end inv-row-actions inv-toolbar inv-toolbar-tight">' +
    (mv.tone === 'red' || mv.tone === 'amber' ? uiDot(mv.tone, TODO_TONE_WORD[mv.tone]) : '') + btn + add + '</span></div>';
}
/* A list of moves: the first ADV_SHOW (or `n`), the rest one tap away. */
function advMovesHtml(moves, listKey, n) {
  var listed = advListedKeys();
  return uiMoreHtml('adv-' + listKey, moves.map(function(mv) { return advMoveRowHtml(mv, listed); }), { n: n || ADV_SHOW, noun: moves.length - (n || ADV_SHOW) === 1 ? 'move' : 'moves' });
}
/* A question's foot: What you can do, its moves, and what would make one appear where there is none. An insight's moves
   are drawn under its row (`inline`), so What changed? draws a foot only to say there is none. */
function advFootHtml(q) {
  if (!q || (q.inline && q.moves.length)) return '';
  var h = '<div class="inv-row-group" data-adv-head><span>What you can do</span>' + (q.moves.length ? '<span class="inv-num">' + q.moves.length + '</span>' : '') + '</div>';
  if (!q.moves.length) return h + '<div class="inv-row inv-row-auto" data-adv-none><span class="inv-row-main inv-note inv-row-wrap">' + escHtml(q.none || 'Nothing to do here yet.') + '</span></div>';
  h += advMovesHtml(q.moves, 'q-' + q.key);
  (q.hints || []).forEach(function(x) { h += '<div class="inv-row inv-row-auto" data-adv-hint><span class="inv-row-main inv-note inv-row-wrap">' + escHtml(x) + '</span></div>'; });
  return h;
}

/* ---------- Add to my list ---------- */
/* The move becomes a task of the owner's own, due today, that keeps the move's button (`go`) and says what it was worth
   and rested on; the move then reads On your list wherever it is drawn, until the task is ticked. */
function advAddTask(key, ref) {
  var mv = (ref && _advRows[ref]) || _advMoves[key];
  if (!mv) return;
  if (!advListedKeys()[key]) {
    todoData().tasks.push({ id: todoUid(), text: mv.task || mv.say, due: todoToday(), note: [advWorthText(mv.worth), mv.basis].filter(Boolean).join(' · '),
      link: null, go: mv.go || null, goLabel: mv.goLabel || '', advKey: key, createdAt: Date.now(), doneAt: null });
    saveState();
  }
  var sel = '[data-action="invAdvTask"][data-key="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]';
  document.querySelectorAll(sel).forEach(function(b) {
    var row = b.closest('[data-adv-move]'), go = row && row.querySelector('[data-action="invAdvGo"], [data-adv-call]');
    b.outerHTML = ADV_LISTED_HTML;
    if (go && document.activeElement === document.body) { try { go.focus({ preventScroll: true }); } catch (e) { /* focus is a courtesy */ } }
  });
  if (typeof todoRefreshViews === 'function') todoRefreshViews();
  showToast('Added to your list');
}

/* ---------- Going to the place ---------- */
/* The jumps a move needs, beside todoGo's own kinds (todoGo hands these on): each lands exactly on the place, its filters
   set and nothing else carried over (the regJump / imJump rule). */
function advGoTo(go) {
  switch (go && go.kind) {
    case 'planner': plnSetView(go.v || 'play'); switchTab('pagePlanner'); return true;
    case 'quoteDraft': qtOpenDraft({ clientId: go.clientId, lines: go.lines, note: go.note }); return true;
    case 'quotes':
      _qtForm = null; _qtSearch = ''; _qtStatus = go.status || 'all'; _qtActiveId = null; _pageTyped = false;
      setItemsSubView('quotes'); switchTab('pageClients'); return true;
    case 'perf': {
      var pc = advClient(go.clientId);
      if (pc) setPerfClientId(pc.id);
      _qtForm = null;
      setItemsSubView('performance');
      switchTab('pageClients');
      var root = document.getElementById('clientsPageContent'), panel = null;
      if (root && go.panel === 'hour') panel = root.querySelector('details[data-fold="cp-hours"]');
      else if (root && go.panel === 'worked') panel = root.querySelector('details[data-fold="cp-worked"]');
      else if (root) panel = root.querySelector('[data-card="materials"]');
      if (panel && panel.tagName === 'DETAILS') panel.open = true;
      if (panel) uiRevealEl(panel);
      return true;
    }
    case 'reorder': _stockReorder = { qty: {} }; _stockView = 'reorder'; switchTab('pageStock'); return true;
    case 'powerCase': powerSetTab('case'); switchTab('pagePower'); return true;
    case 'areas': _attView = 'areas'; _attDate = localDateStr(); switchTab('pageStaff'); return true;
    case 'payWeek': _attView = 'pay'; _attDate = go.day || localDateStr(); switchTab('pageStaff'); return true;
    case 'liveCost': {
      try { localStorage.setItem(STATS_TAB_KEY, 'cost'); } catch (e) { /* per-device */ }
      if (go.period && PERIOD_LABELS[go.period]) _statsPeriod = go.period;
      switchTab('pageStats');
      var row = document.querySelector('#statsContent details[data-cost="' + String(go.key || '').replace(/[^a-z]/gi, '') + '"]');
      if (row) { row.open = true; uiRevealEl(row); }
      return true;
    }
    case 'prodLines': prodSetTab('lines'); _prodLine = PROD_LINES.indexOf(go.line) >= 0 || go.line === 'pickling' ? go.line : 'vat-a1'; _prodDay = go.day || null; _prodView = 'main';
      switchTab('pageProduction'); return true;
    case 'createFor': createForClient(go.clientId, go.ims); return true;
    // What a merge held for the owner (merge.js).
    case 'mergeHeld': mrgHeldOpenDialog(); return true;
    // The statement and reminder dialog, over the client's receivables.
    case 'soa':
      finSetTab('receipts'); _bankOpen = go.client != null ? String(go.client) : null; switchTab('pageFinance');
      soaOpen(go.client); return true;
    case 'register': regJump({ clientId: go.clientId, month: go.month }); return true;
    // A report of a kind on the period holding `from`, at a section (an insight's month, QA5-12).
    case 'report': {
      rptSet(rptKindOk(go.report) ? go.report : 'monthly', rptIsoOk(go.from) ? go.from : localDateStr());
      switchTab('pageReports');
      var sec = go.sec && document.querySelector('#rptSheet [data-rpt-sec="' + String(go.sec).replace(/[^a-z]/gi, '') + '"]');
      if (sec) uiRevealEl(sec);
      return true;
    }
  }
  return false;
}

function advAction(action, btn) {
  // A move under a task (its dialog, or its row on Today) answers that task (learn.js, I5).
  var tk = (action === 'invAdvGo' || action === 'invAdvTask') && btn.closest && btn.closest('[data-adv-task], [data-tdy-task]');
  if (tk && typeof learnRespondKey === 'function') learnRespondKey(tk.dataset.advTask || tk.dataset.tdyTask, action === 'invAdvGo' ? 'go' : 'list');
  if (action === 'invAdvGo') {
    var mv = (btn.dataset.advRow && _advRows[btn.dataset.advRow]) || _advMoves[btn.dataset.key];
    if (mv && mv.go) todoGo(mv.go); else showToast('That move has changed: open the card again', 'warning');
    return true;
  }
  if (action === 'invAdvTask') { advAddTask(btn.dataset.key, btn.dataset.advRow); return true; }
  return false;
}
