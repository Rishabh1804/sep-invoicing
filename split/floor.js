/* ===== FLOOR → OVERVIEW: the day across the plant (Direction B, step 5; P138; the tab map's TM4a, P188) =====
 * The floor's day on one screen (owner, 1 Oct 2026, direction B): a card each for people, production, stock and power; then a
 * card per line (VAT A1, VAT A2, Barrel, Pickling), the worst first, with the heads on it against the day's number, the EXTRA
 * booked to it, what it is running and when its last round was, what it has plated and who plated it.
 *
 * Nothing is stored here, and nothing is worked out twice: each figure is read from the function its own screen uses.
 * Staffing: areaStats (the heads where each mark says, as Staff → Day's board and Areas count them) against areaNeedOn;
 * Barrel is barrel and barrel pickling, the one unit of five Areas reads. EXTRA: areaStats' hours booked to the line's
 * areas (a row over two areas shared between them, as Areas shares it). Running and plated: prodDayLine (the figure that
 * counts per line and shift, as Production → Lines shows it) and prodDayLoads; the crew, prodCrew. The heroes: Staff's
 * own attDaySummary, Production's day card (prodDayHeroHtml), Stock's stockStatus and reorder list, Power's powerCuts and
 * powerAnalysis. A figure the record cannot give is a dash with its reason, never 0.
 *
 * A day is a place: ?tab=pageFloor&d=YYYY-MM-DD, today with no d (nav.js). A card opens Production → Lines on its line
 * and day; the staffing word opens People → Attendance; the EXTRA badge opens Areas. */

var FLR_LINES = [
  { id: 'vat-a1', areas: ['vat-a1'], src: 'photo' },
  { id: 'vat-a2', areas: ['vat-a2'], src: 'photo' },
  { id: 'barrel', areas: ['barrel', 'pickling-barrel'], src: 'list' },
  { id: 'pickling', areas: ['pickling-vat'], src: 'loads' }
];
// Where each line's record comes from, said on a card that has none: the register clerk's page for the VAT lines, the
// supervisor's barrel list and the pickling hand's messages for the others (Production's three doors).
var FLR_SRC_TEXT = { photo: 'the register page', list: 'the supervisor’s barrel list', loads: 'the pickling hand’s messages' };
var _flrDay = null;   // the day on screen; null is today, and follows the clock

function flrValidDay(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  var t = new Date(d + 'T00:00:00');
  return !isNaN(t) && isoOf(t) === d;
}
/* Never past today: a day to come, or one that is not a date, is today. */
function flrSetDay(d) { _flrDay = flrValidDay(d) && d < localDateStr() ? d : null; }
function flrDayIso() { var t = localDateStr(); return _flrDay && _flrDay < t ? _flrDay : t; }
function flrNavD() { var d = flrDayIso(); return d === localDateStr() ? '' : d; }
function flrNavLabel(d) { return flrValidDay(d) ? attDayName(d) + ' ' + formatDate(d) : 'Today'; }
function flrLineName(id) { return id === 'pickling' ? 'Pickling' : PROD_LINE_LABEL[id] || id; }
function flrHours(h) { return formatNum(h, 1).replace(/\.0$/, ''); }

/* The latest entry by the clock: a run's last round (`to`), else its start; a block past midnight runs on past 1440. An
   entry with no time (the barrel list is the whole day's) ranks under any with one. */
function flrTimeKey(e) {
  var a = relayParseHhmm(e.time), b = relayParseHhmm(e.to);
  if (a != null && b != null && b < a) b += 1440;
  return b != null ? b : a != null ? a : -1;
}
function flrLatest(list) {
  var best = null, bk = -2;
  (list || []).forEach(function(e) { var k = flrTimeKey(e); if (k >= bk) { best = e; bk = k; } });
  return best;
}
/* The size of a run's last round counted: a rack (an END row's "98×8" is rounds of 98), else the round's own figure. */
function flrLastRound(e) {
  var rounds = (e.rounds || []).filter(function(x) { return !x.struck && !x.start; });
  var lr = rounds[rounds.length - 1];
  var size = lr ? (lr.rack || (!lr.batch ? lr.qty : null)) : (e.rackSize || null);
  return size > 0 ? size : null;
}

function renderFloor() {
  var el = document.getElementById('floorContent');
  if (!el) return;
  prodData();
  el.innerHTML = flrHtml(flrDayIso());
}

/* Floor's Overview (the tab map, TM4a): the day stepper; a hero each for people, production, stock and power, each shown to a
   role that opens its screen (People's heads to every role that opens Floor, with no link where People is not theirs), the
   first carrying the screen's verdict; the line cards under them, the worst first; the pieces nothing weighs. */
var FLR_TONE_RANK = { danger: 0, warning: 1, ok: 2, info: 3, neutral: 4 };
function flrSees(page) { return typeof grdSees !== 'function' || grdSees(page); }
/* A hero's day, short: the stepper above names it in full. */
function flrWhen(day, isToday) { return isToday ? 'today' : stockShortDate(day); }
function flrHtml(day) {
  var isToday = day === localDateStr();
  var att = attDaySummary(day), plated = prodDayPlated(day), cuts = powerCuts(day, day);
  // A day the floor recorded (attendance or plating, Power's own test): a cut it does not report is none, not unknown.
  var recorded = att.marked || Object.keys(plated.lines).length > 0;
  var stats = areaStats(day, day), byArea = {};
  stats.rows.forEach(function(a) { byArea[a.id] = a; });
  // The line cards lead with the worst (§1a-1): danger, then warning, ok and info, ties in line order.
  var lines = FLR_LINES.map(function(ln, i) { return { ln: ln, i: i, j: flrLineJudge(day, ln, byArea, att.marked) }; })
    .sort(function(x, y) { return (FLR_TONE_RANK[x.j.tone] - FLR_TONE_RANK[y.j.tone]) || x.i - y.i; });
  return flrStepperHtml(day, isToday) + flrHeroesHtml(day, isToday, att, cuts, recorded, lines) +
    '<div class="inv-panels" id="flrLines">' + lines.map(function(x) { return flrCardHtml(day, isToday, x.ln, byArea, att.marked, x.j); }).join('') + '</div>' +
    flrUnweighedHtml(day);
}

/* ‹ the day › and back to today; never past today. */
function flrStepperHtml(day, isToday) {
  return '<div class="inv-toolbar inv-stepper" id="flrStepper">' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invFlrStep" data-step="-1" aria-label="Day before">' + STAFF_BACK_ICON + '</button>' +
    '<div class="inv-stepper-label"><input type="date" class="inv-input inv-id" id="flrDate" value="' + escHtml(day) + '" max="' + escHtml(localDateStr()) + '" aria-label="Day">' +
    '<span class="inv-stepper-sub">' + escHtml(attDayName(day) + (isToday ? ' · today' : '')) + '</span></div>' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invFlrStep" data-step="1" aria-label="Day after"' + (isToday ? ' disabled' : '') + '>' + STAFF_NEXT_ICON + '</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFlrToday"' + (isToday ? ' disabled' : '') + '>Today</button></div>';
}

/* ---------- The heroes ---------- */
/* Side by side on the desktop (two, four across from 80rem), two to a row on the phone, each shut to its line until opened, as
   Money's Overview's are: one opened takes its row. People and Production read the day on screen, Stock now, Power the day
   and its month to date. The figures that led the page as tiles (on site, plated, power) are theirs now (I8). */
function flrHeroesHtml(day, isToday, att, cuts, recorded, lines) {
  var cards = [flrPeopleHeroHtml(day, isToday, att, lines),
    flrSees('pageProduction') ? prodDayHeroHtml(day, { fold: 'flr-hero-prod', open: false, vital: true, floor: true, lead: flrProdLead(lines), label: 'Production',
      when: flrWhen(day, isToday), attrs: ' data-card="flr-prod"' }) : '',
    flrSees('pageStock') ? flrStockHeroHtml() : '',
    flrSees('pagePower') ? flrPowerHeroHtml(day, isToday, cuts, recorded) : '',
    // The flow (the entry faces' T3): how fast material comes back, against the target; where Production is the role's.
    flrSees('pageProduction') ? flowHeroHtml() : ''].filter(Boolean);
  // Four or five subjects: two across, four on a wide window, and a fifth on a row of its own (styles.css).
  return '<div class="inv-heroes' + (cards.length >= 4 ? ' inv-heroes-4' : '') + '" id="flrHeroes">' + cards.join('') + '</div>';
}
function flrLink(page, action, label, attrs) {
  return flrSees(page) ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="' + action + '"' + (attrs || '') + '>' + label + '</button>' : '';
}
/* People: who is on site against the day's roster (attOnSiteTone: the rest-day gate and the floor's number), the lines short of
   their number by name, the day's attendance panel inside. Heads only, never a rupee, so every role that opens Floor sees it. */
function flrPeopleHeroHtml(day, isToday, d, lines) {
  var eyebrow = '<span>People</span><span class="inv-panel-count">' + escHtml(flrWhen(day, isToday)) + '</span>';
  // People leads (every role that opens Floor sees it), so it carries the screen's verdict (§3e, an overview).
  var link = flrLink('pageStaff', 'invFlrStaff', 'Open Attendance'), attrs = ' data-card="flr-people" data-verdict';
  if (!d.marked) {
    return uiHeroHtml({ tone: 'neutral', vital: true, eyebrow: eyebrow, fig: '&mdash;', title: isToday ? 'Nothing recorded yet' : 'No attendance recorded',
      sub: isToday ? 'the in-time roll fills it' : 'a gap, not a day off', attrs: attrs, foot: link });
  }
  var on = d.p + d.half, n = d.roster.length;
  // Short where the line cards say short: the general shift's heads against the day's number, Barrel with barrel pickling.
  var short = lines.filter(function(x) { return x.j.st.need != null && x.j.st.heads < x.j.st.need; });
  var anyNeed = lines.some(function(x) { return x.j.st.need != null; });
  var title = short.length ? short.slice(0, 2).map(function(x) { return flrLineName(x.ln.id) + ' short ' + (x.j.st.need - x.j.st.heads); }).join(', ') + (short.length > 2 ? ', +' + (short.length - 2) : '')
    : anyNeed ? 'Every line at its number' : on + ' of ' + n + ' on site';
  var sub = [d.complement ? d.floorHeads + ' of ' + d.complement + ' on the floor' : '', todoPlural(d.absent.length, 'absent', 'absent') + (d.unmarked ? ', ' + d.unmarked + ' unmarked' : '')].filter(Boolean).join(' · ');
  var viz = chartMeter([{ v: d.p, tone: 'ok' }, { v: d.half, tone: 'warning' }, { v: d.absent.length, tone: 'danger' }, { v: d.unmarked, tone: 'neutral' }],
    { title: d.p + ' present, ' + d.half + ' half day, ' + d.absent.length + ' absent' + (d.unmarked ? ', ' + d.unmarked + ' unmarked' : '') });
  return uiHeroHtml({ tone: attOnSiteTone(d) || 'ok', vital: true, eyebrow: eyebrow, fig: on + '<span class="inv-tile-of">/' + n + '</span>', title: escHtml(title), sub: escHtml(sub), viz: viz,
    body: '<div class="inv-hero-sheet">' + attDayPanelHtml(d, null, 'flrAtt') + '</div>', fold: 'flr-hero-people', open: false, attrs: attrs, foot: link });
}
/* The line the Production card names: the worst card's, where it is not ok (the line cards' own order). */
function flrProdLead(lines) {
  var w = lines.filter(function(x) { return x.ln.id !== 'pickling' && x.j.ef && (x.j.tone === 'danger' || x.j.tone === 'warning'); })[0];
  if (!w) return null;
  var ef = w.j.ef, name = flrLineName(w.ln.id), unit = ef.unitWord || 'unit';
  return { tone: w.j.tone, line: w.ln.id,
    title: ef.halfDown ? name + ': ' + (ef.n - ef.nAvail) + ' of ' + ef.n + ' ' + unit + 's down' : ef.missing ? name + ' had heads and no record'
      : ef.eff != null ? name + ' plated ' + Math.round(ef.eff * 100) + '% of what it could' : name + ': ' + (ef.word || 'not judged').toLowerCase() };
}
/* Stock, now (not the day on screen, and it says so): the lines out and low, the first three by name, and what the reorder list
   would cost with GST (Stock shows it to every role that opens it; the QA audit, QA4-4). */
function flrStockHeroHtml() {
  var eyebrow = '<span>Stock</span><span class="inv-panel-count">now</span>', attrs = ' data-card="flr-stock"';
  var link = flrLink('pageStock', 'invFlrStock', 'Open Stock');
  var items = stockData().items.filter(function(i) { return i.active !== false; });
  if (!items.length) return uiHeroHtml({ tone: 'neutral', vital: true, eyebrow: eyebrow, fig: '&mdash;', title: 'No stock recorded yet', sub: 'the supervisor’s stock message starts it', attrs: attrs, foot: link });
  var cfg = stockCfg(), rows = items.map(function(i) { return { item: i, s: stockStatus(i) }; });
  var out = rows.filter(function(x) { return x.s.group === 'out'; }).sort(function(a, b) { return a.item.name < b.item.name ? -1 : 1; });
  var low = rows.filter(function(x) { return x.s.group === 'low'; }).sort(function(a, b) { return a.s.daysLeft - b.s.daysLeft; });
  var red = out.length + low.filter(function(x) { return x.s.tone === 'red'; }).length;
  var tone = red ? 'danger' : low.length ? 'warning' : 'ok';
  var title = out.length ? todoPlural(out.length, 'line') + ' out' + (low.length ? ', ' + low.length + ' low' : '') : low.length ? todoPlural(low.length, 'line') + ' at ' + cfg.amberDays + ' days or less' : 'Every line above ' + cfg.amberDays + ' days';
  var L = stockReorderList(), need = gstRound(L.total * 1.18);
  var first = out.concat(low).slice(0, 3);
  var body = first.map(function(x) {
    return '<div class="inv-row" data-flr-stock-line="' + escHtml(x.item.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(x.item.name) + '</span></span>' +
      '<span class="inv-row-end">' + stockStatusDot(x.s, true) + '</span></div>';
  }).join('') + (out.length + low.length > 3 ? uiFactRowHtml({ label: 'More out or low', value: out.length + low.length - 3 }) : '') +
    (need > 0 ? uiFactRowHtml({ label: 'The reorder list, with GST', value: formatCurrency(need), sub: L.unpriced ? todoPlural(L.unpriced, 'line') + ' without a price' : 'at the last prices', attrs: ' data-flr-reorder' }) : '');
  return uiHeroHtml({ tone: tone, vital: true, eyebrow: eyebrow, fig: String(out.length + low.length) + '<span class="inv-tile-of">/' + items.length + '</span>', title: escHtml(title),
    sub: escHtml(need > 0 ? 'reorder ' + finRs(need) + ' with GST' : out.length + low.length ? 'lines out or low' : todoPlural(items.length, 'line') + ' on record'),
    body: body ? '<div class="inv-hero-sheet">' + body + '</div>' : null, fold: 'flr-hero-stock', open: false, attrs: attrs, foot: link });
}
/* Power: the day's cuts and how long it was dark, its month to the day, a year at the record's rate, and the load to chase while
   an approved load is not on the bill (the To-do's own tone: red once a penalty has been billed for it). */
function flrPowerHeroHtml(day, isToday, cuts, recorded) {
  var eyebrow = '<span>Power</span><span class="inv-panel-count">' + escHtml(flrWhen(day, isToday)) + '</span>';
  // What a cut cost is Power's own figure, shown to every role that opens Power; this card says the same.
  var a = powerAnalysis(), L = a.load;
  var mins = cuts.reduce(function(s, c) { return s + (c.min || 0); }, 0), open = cuts.filter(function(c) { return c.open; }).length;
  var month = a.cuts.filter(function(c) { return c.date >= day.slice(0, 7) + '-01' && c.date <= day; });
  var mCost = gstRound(month.reduce(function(s, c) { return s + ((c.cost && c.cost.total) || 0); }, 0)), mMin = month.reduce(function(s, c) { return s + (c.min || 0); }, 0);
  var loadTone = L.pending ? (L.penaltySince > 0 ? 'danger' : 'warning') : '';
  var dayTone = cuts.length ? 'warning' : recorded ? 'ok' : 'neutral';
  var tone = loadTone === 'danger' ? 'danger' : loadTone || dayTone;
  var dayTitle = cuts.length ? (mins ? powerDur(mins) + ' dark' : todoPlural(cuts.length, 'cut')) + (open ? ', ' + open + ' with no time back' : '')
    : recorded ? 'No cut reported' : isToday ? 'Nothing recorded yet' : 'No floor record this day';
  var loadTitle = L.pending ? formatNum(L.approved, 0) + ' kVA approved, billed at ' + formatNum(L.sanctioned, 0) : '';
  var title = loadTone === 'danger' && !cuts.length ? loadTitle : dayTitle;
  var sub = 'this month ' + todoPlural(month.length, 'cut') + (mCost > 0 ? ', ' + finRs(mCost) : '');
  var facts = [
    { label: 'This month to ' + stockShortDate(day), value: todoPlural(month.length, 'cut'), sub: mMin ? powerHours(mMin) + ' dark' + (mCost > 0 ? ' · ' + formatCurrency(mCost) : '') : '', attrs: ' data-flr-power="month"' },
    a.year ? { label: 'A year at this rate', value: formatCurrency(a.year.base), sub: 'the last 90 days’ record', attrs: ' data-flr-power="year"' } : null,
    L.pending ? { label: 'Load to chase', value: loadTitle, sub: L.penaltySince > 0 ? formatCurrency(L.penaltySince) + ' penalty since approval' : 'not yet on the bill', attrs: ' data-flr-power="load"' } : null
  ].filter(Boolean);
  var viz = cuts.length ? chartDayStrip(cuts.map(function(c) { return { from: c.from, to: c.to, tone: 'danger' }; }),
    // Its hours named under it on the desktop; a phone's half-width card has no room for them (the title says the times).
    { axis: !!_isDesktop, title: 'Power cut ' + cuts.map(function(c) { return powerClock(c.from) + (c.to != null ? ' – ' + powerClock(c.to) : ', no time back'); }).join(', ') }) : '';
  return uiHeroHtml({ tone: tone, vital: true, eyebrow: eyebrow, fig: recorded || cuts.length ? String(cuts.length) + '<span class="inv-tile-of"> ' + (cuts.length === 1 ? 'cut' : 'cuts') + '</span>' : '&mdash;',
    title: escHtml(title), sub: escHtml(sub), viz: viz, body: '<div class="inv-hero-sheet">' + facts.map(uiFactRowHtml).join('') + '</div>',
    fold: 'flr-hero-power', open: false, attrs: ' data-card="flr-power"' + (loadTone ? ' data-flr-load="' + loadTone + '"' : ''), foot: flrLink('pagePower', 'invFlrPower', 'Open Cuts') });
}

/* ---------- A line's card ---------- */
function flrStaffing(day, ln, byArea, marked) {
  var heads = 0, need = null;
  ln.areas.forEach(function(a) {
    var dd = byArea[a] && byArea[a].days[0];
    heads += dd ? dd.heads : 0;
    var n = areaNeedOn(day, a);
    if (n != null) need = (need || 0) + n;
  });
  if (!marked) return { tone: 'neutral', word: 'No attendance' };
  if (need == null) return { tone: 'neutral', word: 'No number · ' + heads + ' on', heads: heads };
  if (heads < need) return { tone: 'warning', word: 'Short ' + (need - heads) + ' · ' + heads + '/' + need, heads: heads, need: need };
  if (heads > need) return { tone: 'info', word: (heads - need) + ' over · ' + heads + '/' + need, heads: heads, need: need };
  return { tone: 'ok', word: 'Met ' + heads + '/' + need, heads: heads, need: need };
}

/* How a line's card is judged: a plating line by its efficiency (owner, 9 Oct 2026: "that is how the colour code of the gradient
   for cards in this tab will be decided"), half or more of its units down, and a general shift with heads and no record;
   pickling by its heads against the day's number. The cards are ordered by it, worst first. */
function flrLineJudge(day, ln, byArea, marked) {
  var st = flrStaffing(day, ln, byArea, marked), ef = ln.id === 'pickling' ? null : prodLineEfficiency(day, ln.id);
  return { st: st, ef: ef, tone: ef ? ef.tone : st.tone === 'warning' ? 'warning' : st.tone === 'ok' ? 'ok' : 'neutral' };
}
function flrCardHtml(day, isToday, ln, byArea, marked, j) {
  j = j || flrLineJudge(day, ln, byArea, marked);
  var name = flrLineName(ln.id), st = j.st, ef = j.ef;
  var extra = ln.areas.reduce(function(s, a) { return s + ((byArea[a] && byArea[a].extraHours) || 0); }, 0);
  // Its doors open Production and People: drawn as plain words for a role that does not open them (the guard, I4).
  var prodOk = flrSees('pageProduction'), staffOk = flrSees('pageStaff');
  var main = function(inner) { return prodOk ? '<button class="inv-row-main" data-action="invFlrLine" data-line="' + ln.id + '">' + inner + '</button>' : '<span class="inv-row-main">' + inner + '</span>'; };
  var last, title, meta, end;
  if (ln.id === 'pickling') {
    var loads = prodDayLoads(day);
    last = flrLatest(loads);
    if (last) {
      var L = prodLoadLine(last), k = flrTimeKey(last);
      title = prodEntryTitle(last);
      meta = [k >= 0 ? 'last ' + relayClockLabel(k) : 'no time written', prodQtyText(last.qty, last.unit), L.line ? 'to ' + prodLineName(L.line) : ''].filter(Boolean).join(' · ');
      end = '<span class="inv-num" data-flr-plated>' + escHtml(todoPlural(loads.length, 'load')) + '</span>';
    }
  } else {
    var r = prodDayLine(day, ln.id);
    last = flrLatest(r.entries);
    if (last) {
      var size = flrLastRound(last), kk = flrTimeKey(last);
      title = prodEntryTitle(last);
      meta = [size ? 'a round of ' + Math.round(size).toLocaleString('en-IN') : '', kk >= 0 ? 'last ' + relayClockLabel(kk) : last.slot === 'day' ? 'the day’s list' : 'no time written',
        r.entries.length > 1 ? todoPlural(r.entries.length, 'run') : ''].filter(Boolean).join(' · ');
      // What the line plated that day, as Lines' tiles show it: the weight (≈ where any run is estimated), the pieces under it.
      var fig = r.kg > 0 ? prodKgFig(r.kg, r.est > 0.0005, r.unweighed > 0) : r.nos > 0 ? Math.round(r.nos).toLocaleString('en-IN') + ' NOS' : null;
      var kgSub = r.kg > 0 && r.nos > 0 ? Math.round(r.nos).toLocaleString('en-IN') + ' NOS' + (r.unweighed ? ', ' + Math.round(r.unweighed).toLocaleString('en-IN') + ' not weighed' : '') : '';
      end = '<span class="inv-row-stack"><span class="inv-num" data-flr-plated>' + (fig ? escHtml(fig) : '&mdash;') + '</span>' +
        (kgSub ? '<span class="inv-row-meta inv-num" data-flr-kg>' + escHtml(kgSub) + '</span>' : '') + '</span>';
    }
  }
  var h = '';
  if (last) {
    h += '<div class="inv-row inv-row-2" data-flr-run="' + escHtml(last.id) + '">' +
      main('<span class="inv-row-title">' + escHtml(title) + '</span><span class="inv-row-meta">' + escHtml(meta) + '</span>') +
      '<span class="inv-row-end">' + end + '</span></div>';
  } else {
    // No record: where it comes from, and the one move that fills it (a line of its own under the row on the phone).
    var btn = !prodOk ? '' : ln.src === 'photo' ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFlrPhoto" data-line="' + ln.id + '">Read register photo</button>'
      : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFlrPaste" data-line="' + ln.id + '">Paste message</button>';
    h += '<div class="inv-row inv-row-2 inv-row-flow" data-flr-run="">' +
      main('<span class="inv-row-title">' + (isToday ? 'No record yet today' : 'No record this day') + '</span>' +
        '<span class="inv-row-meta">' + escHtml((isToday ? 'From ' : 'A gap, not a zero: from ') + FLR_SRC_TEXT[ln.src]) + '</span>') +
      (btn ? '<span class="inv-row-end inv-row-actions">' + btn + '</span>' : '') + '</div>';
  }
  // What the line earned, against what its kilos cost and its usual day (one row; a role without money: the kilos against it).
  if (last && ln.id !== 'pickling') h += flrEarnedRowHtml(day, isToday, ln.id);
  // The efficiency's parts, so a figure that looks wrong can be followed to the input that made it.
  if (ef && ef.eff != null) h += flrEffRowHtml(ef, ln.id);
  // Who plated it: the run's crew (prodCrew, as Production → Entries names it); with no run, the hands marked on the line.
  var cr = last ? prodCrew(last) : prodCrew(ln.id === 'pickling' ? { date: day, kind: 'pickled' } : { date: day, kind: 'plated', line: ln.id, slot: 'general' });
  var crew = last ? (cr.known ? (cr.src === 'block' ? 'OT crew: ' : 'Crew: ') + cr.names.join(', ') : 'Crew not known: ' + cr.why)
    : cr.known ? 'On the line: ' + cr.names.join(', ') : cr.why.charAt(0).toUpperCase() + cr.why.slice(1);
  // The line's units on the day shown (plant.js): what of it could run.
  h += pltFloorRowHtml(ln.id, day);
  // What went into the line's bath that day, as the stock record has it (PP3): a use over several days on the day it ends. One
  // a fact row; more, a row that folds open to them (§6.27).
  if (ln.id !== 'pickling') {
    var adds = stockDayAdds(day, ln.id);
    var addFact = function(a) {
      return { label: a.item.name, value: stockFmtQty(a.qty) + (a.item.unit ? ' ' + a.item.unit : ''), attrs: ' data-flr-bath-item',
        sub: [a.from !== day ? stockSpanText(a.from, day) : '', a.shared ? 'shared with ' + a.with.map(prodLineName).join(' and ') : ''].filter(Boolean).join(' · ') };
    };
    if (adds.length === 1) h += uiFactRowHtml(Object.assign(addFact(adds[0]), { label: adds[0].item.name + ' into the bath', attrs: ' data-flr-bath' }));
    else if (adds.length) h += uiFoldRowHtml('flr-bath-' + ln.id, { label: 'Into the bath', value: adds.length, count: true }, adds.map(addFact), ' data-flr-bath');
  }
  h += '<div class="inv-row inv-row-auto" data-flr-crew><span class="inv-row-main"><span class="inv-row-meta inv-row-wrap">' + escHtml(crew) + '</span></span></div>';
  // The head: what the line is judged on; the foot: its staffing and its EXTRA, each a door to People where the role opens it.
  var tone = j.tone;
  var head = flrEffHead(ef, last, isToday);
  var extraBadge = '<span class="inv-badge inv-badge-warning">EXTRA ' + flrHours(extra) + ' h</span>';
  var foot = (staffOk ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFlrStaff" data-flr-staff aria-label="' + escHtml(name + ' staffing: ' + st.word + '. Open People, Attendance') + '">' + uiDot(st.tone, escHtml(st.word)) + '</button>'
      : '<span data-flr-staff>' + uiDot(st.tone, escHtml(st.word)) + '</span>') +
    (extra > 0.0005 ? (staffOk ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFlrAreas" data-flr-extra aria-label="' + escHtml('EXTRA ' + flrHours(extra) + ' hours booked to ' + name + '. Open Areas') + '">' + extraBadge + '</button>'
      : '<span data-flr-extra>' + extraBadge + '</span>') : '');
  return uiHeroHtml({ tone: tone, eyebrow: '<span class="inv-panel-title">' + escHtml(name) + '</span>' + (ef && ef.eff != null ? '<span class="inv-panel-count">' + escHtml(ef.word) + '</span>' : ''),
    title: escHtml(head.title), fig: head.fig ? escHtml(head.fig) : '', sub: head.sub ? escHtml(head.sub) : '', viz: head.viz || '',
    body: '<div class="inv-hero-sheet">' + h + '</div>', open: true, fold: 'flr-line-' + ln.id, foot: foot, attrs: ' data-line="' + ln.id + '"' + (ef ? ' data-flr-eff="' + escHtml(ef.eff != null ? String(Math.round(ef.eff * 100)) : '') + '"' : '') });
}
/* What a plating line earned on the day at its clients' rates on record (prodDayWorth; owner, 10 Oct 2026: "As we are calculating
   production, why don't we calculate the earnings?"), coloured by whether its rupee a kilo clears what a kilo costs (the live cost,
   prodCostRef), and set against its usual day ("corrections and comparisons are missing"). A day still running says so and is not
   set against a whole one. A role that does not see money reads the kilos against the usual day instead (I4). One fact row. */
function flrEarnedRowHtml(day, isToday, line) {
  var x = prodLineDaySum(day, line), u = prodLineUsual(line, day);
  if (!x.runs) return '';
  var money = typeof grdSeesMoney !== 'function' || grdSeesMoney();
  if (!money) {
    if (u.kg == null || !(x.kg > 0)) return '';
    if (isToday) return uiFactRowHtml({ label: 'A usual day', value: prodKgFig(u.kg, true), sub: 'so far ' + prodKgFig(x.kg, x.est, x.unweighed > 0) + ' · median of ' + u.kgDays + ' days', attrs: ' data-flr-usual' });
    return uiFactRowHtml({ label: 'Against a usual day', value: figDeltaPct(x.kg, u.kg), tone: x.weighed >= 0.9 ? figDeltaTone(x.kg, u.kg, 'up') : null,
      sub: 'a usual day ' + prodKgFig(u.kg, true) + ' · median of ' + u.kgDays + ' days' + (x.weighed < 0.9 ? ' · reads low: pieces not weighed' : ''), attrs: ' data-flr-usual' });
  }
  var ref = prodCostRef(day), real = x.kgPriced > 0 ? x.amountKg / x.kgPriced : null;
  // Two facts (§3b): the rupee a kilo against the cost, then the usual day; where a tenth or more of the work has no rate, that
  // instead, since the figure reads low against a whole day (the day card lists what is not priced).
  var notPriced = x.unpriced ? Math.round(x.unpriced).toLocaleString('en-IN') + ' pcs not priced' : x.unpricedKg ? formatNum(x.unpricedKg, 0) + ' kg not priced' : '';
  var vs = x.pricedShare < 0.9 ? notPriced : u.worth == null ? '' : isToday ? 'so far; a usual day ' + finRs(u.worth) : figDeltaText(x.worth, u.worth, 'a usual day');
  var sub = [real != null ? formatCurrency(real) + ' a kg' + (ref ? ', cost ' + formatCurrency(ref.perKg) : '') : '', vs].filter(Boolean).join(' · ');
  return uiFactRowHtml({ label: 'Earned', value: x.priced ? (x.worthEst ? '≈ ' : '') + finRs(x.worth) : '', tone: real != null && ref ? figToneAgainst(real, ref.perKg, 5) : null,
    sub: sub || 'nothing priced: no rate on record', attrs: ' data-flr-earned' });
}
/* A plating line's head: its efficiency as the figure, what it plated of what it could, and the inputs; or why it is not judged. */
function flrEffHead(ef, last, isToday) {
  if (!ef) return { title: last ? 'Loads pickled' : isToday ? 'Nothing pickled yet today' : 'Nothing pickled this day' };
  var unit = ef.unitWord || 'unit', units = ef.n ? ef.nAvail + ' of ' + ef.n + ' ' + unit + 's working' : '';
  var down = ef.halfDown ? (ef.n - ef.nAvail) + ' of ' + ef.n + ' ' + unit + 's down' : '';
  if (!ef.ran) return { title: ef.missing ? 'Heads on the general shift and no record of it' : isToday ? 'Not running yet today' : 'Did not run', sub: [down, units].filter(Boolean).join(' · ') };
  var kg = prodKgFig(ef.kg, ef.est, ef.unweighed > 0) || '—';
  if (ef.eff == null) return { title: 'Plated ' + kg, sub: 'Not judged: ' + ef.why + (units ? ' · ' + units : '') };
  var hours = ef.minutes / 60, hTxt = formatNum(hours, 1).replace(/\.0$/, '') + ' h';
  var plated = ef.over ? 'Plated ' + kg + ', over the ' + prodKgFig(ef.possible) + (ef.kgSrc === 'measured' ? ' its usual round and pace would plate: ' : ' its units can plate: ') + ef.why
    : kg + ' of the ' + prodKgFig(ef.possible) + ' its working ' + unit + 's could plate';
  // What needs following up leads (half the line down, the general shift unrecorded); the plating follows in the sub.
  var lead = [ef.halfDown ? down : '', ef.missing ? 'no record of the general shift' : ''].filter(Boolean).join(', ');
  var title = lead ? lead.charAt(0).toUpperCase() + lead.slice(1) : plated;
  // What it had to plate with and what reads it low; the round, the pace and the rest are the working under the card (§6.27).
  var sub = [lead ? plated : '', units, hTxt + ' run' + (ef.cutMin ? ', ' + powerDur(ef.cutMin) + ' cut' : ''),
    ef.unweighed ? Math.round(ef.unweighed).toLocaleString('en-IN') + ' pcs not weighed' : ''].filter(Boolean).join(' · ');
  var viz = chartMeter([{ v: Math.min(ef.kg, ef.possible * 1.2), tone: ef.tone === 'neutral' ? 'neutral' : ef.tone }], { max: ef.possible, mark: ef.possible * PROD_EFF_OK,
    title: kg + ' of ' + prodKgFig(ef.possible) + ' (' + ef.word + '); the mark is three quarters' });
  return { title: title, fig: Math.round(ef.eff * 100) + '%', sub: sub, viz: viz };
}
/* How the efficiency splits where the register counted the rounds (owner, 9 Oct 2026: "We'll do both, so solutions for
   efficiency can be worked out"): the time (the rounds run, of the rounds the hours allowed), the racks (how full each round
   was, against its part's fullest round), the parts (what a full round of the day's parts weighs, against the line's round)
   and, where rounds have no weight, what they leave out: their product is the figure (prodLineEfficiency). Drawn as an
   analysis (§6.27; owner: "The times lost most reads like a block of text"): what moved it most names the factors, a tile each,
   and how each was worked out is folded under them, one fact a row, where the round and the pace come from as a badge. */
function flrEffRowHtml(ef, line) {
  // The rounds the hours allowed are hours over the pace, a fraction: shown to a tenth, so 25 against 24.5 reads as 102%.
  var pct = function(x) { return Math.round(x * 100) + '%'; }, T = ef.tank || {}, C = ef.cycle || {}, unitW = ef.unitWord || 'unit',
    rp = Math.abs(ef.roundsPossible - Math.round(ef.roundsPossible)) < 0.05 ? String(Math.round(ef.roundsPossible)) : formatNum(ef.roundsPossible, 1);
  // The time is the rounds' worth: kilos written without rounds count at the counted rounds' weight. Past a quarter of the
  // line's kilos that is a guess at a different mix (an evening of heavy clamps beside a day of pads), so it is not given.
  var noRounds = ef.kg > 0 ? (ef.kgNoRounds || 0) / ef.kg : 0, timeKnown = ef.pace != null && (ef.roundsOnly || noRounds <= 0.25);
  var nr = Math.round(ef.rounds || 0), SRC = { measured: ['ok', 'measured'], set: ['neutral', 'set'], assumed: ['warning', 'assumed'], typed: ['neutral', 'typed'] };
  // Why a measure is not firm yet: the first of what it lacks, a few words; the rest follows once that is met.
  var lacks = function(why) { return String(why || '').split(', ')[0]; };
  // The working, in the order the figure is built: the time (hours, pace, rounds), then the round (its kilos, the racks, the parts).
  var facts = [{ label: 'Hours run', value: formatNum(ef.minutes / 60, 1).replace(/\.0$/, '') + ' h', sub: ef.cutMin ? powerDur(ef.cutMin) + ' of cuts taken off' : '' },
    { label: 'A round every', value: Math.round(ef.every) + ' min', src: SRC[ef.everySrc] || null,
      sub: ef.everySrc === 'measured' ? 'on the register, ' + todoPlural(C.shifts, 'shift') + (ef.everySet && Math.round(ef.everySet) !== Math.round(ef.every) ? ' · set ' + Math.round(ef.everySet) : '')
        : C.every != null ? 'register ' + Math.round(C.every) + ' min, not firm: ' + lacks(C.why) : '' }];
  if (ef.pace != null) {
    facts.push({ label: 'Rounds the hours allowed', value: rp });
    facts.push(ef.roundsOnly ? { label: 'Rounds run', value: nr, sub: 'counted on the register' }
      : timeKnown ? { label: 'Rounds run', value: '≈ ' + Math.round(ef.roundsRun), sub: nr + ' counted · ' + prodKgFig(ef.kgNoRounds) + ' without rounds' }
      : { label: 'Rounds run', value: nr, sub: pct(noRounds) + ' of the kilos without rounds: time not told apart' });
  } else facts.push({ label: 'Rounds', value: '', sub: 'none counted: time and load not told apart' });
  facts.push({ label: 'A full round', value: formatNum(ef.kgAvail, 0) + ' kg', src: ef.kgSrc === 'measured' ? SRC.measured : SRC.typed,
    sub: ef.kgSrc === 'measured' ? (T.perTank != null && ef.nAvail ? formatNum(T.perTank, 0) + ' kg a ' + unitW + ' × ' + ef.nAvail + ' · ' : '') + T.rounds + ' rounds' + (ef.kgTyped ? ' · typed ' + formatNum(ef.kgTyped, 0) : '')
      : T.perRound != null ? 'register ' + formatNum(T.perRound, 0) + ' kg, not firm: ' + lacks(T.why) : '' });
  if (ef.pace != null && ef.racks != null) {
    facts.push({ label: 'Racks full', value: pct(ef.racks), sub: 'against each part’s fullest round' });
    // The parts run part-full, a row each, most kilos short first.
    (ef.partFull || []).slice(0, 3).forEach(function(p) {
      var fulls = Object.keys(p.fulls), who = p.clientId != null ? plnClientNameOf(p.clientId) : p.client;
      facts.push({ label: (p.part || 'No part written') + (p.gauge && String(p.part).toUpperCase().indexOf(p.gauge) < 0 ? ' (' + p.gauge + ')' : ''), value: pct(p.qty / p.cap),
        sub: [who, todoPlural(Math.max(1, Math.round(p.n)), 'round') + (fulls.length === 1 ? ' of ' + fulls[0] : '')].filter(Boolean).join(' · '), attrs: ' data-flr-partfull' });
    });
    if ((ef.partFull || []).length > 3) facts.push({ label: 'More parts not full', value: ef.partFull.length - 3 });
    facts.push({ label: 'A full round of the day’s parts', value: formatNum(ef.fullRound, 0) + ' kg', sub: pct(ef.parts) + ' of the line’s round' });
  } else if (ef.pace != null) facts.push({ label: 'Loaded', value: pct(ef.load), sub: 'of a full round' });
  if (ef.roundsUnweighed >= 0.5 && ef.weighed != null) facts.push({ label: 'Rounds with no weight', value: Math.round(ef.roundsUnweighed) + ' of ' + nr, sub: 'about ' + pct(1 - ef.weighed) + ' of the work: reads low' });
  if (ef.noEnd) facts.push({ label: 'Runs with no end time', value: ef.noEnd, sub: 'not counted' });
  // What moved it most names the factors: under its usual, the factor that lost most (lighter parts are the work, not a fault);
  // at or over it, the factor that raised it. A time not told apart is never named.
  var known = (ef.racks != null ? [['racks', ef.racks], ['parts', ef.parts]] : [['load', ef.load]]).concat(timeKnown ? [['time', ef.pace]] : [])
    .concat(ef.roundsUnweighed ? [['weighed', ef.weighed]] : []).filter(function(x) { return x[1] != null; });
  var LOST = { racks: 'Part-full racks lost most', parts: 'Lighter parts than the line’s round', load: 'The load lost most', time: 'The time lost most',
      weighed: 'Rounds with no weight read it low' },
    RAISED = { parts: 'Heavier parts than the line’s round', load: 'Heavier rounds than the line’s round', time: 'Faster than its usual pace' };
  var title = 'How it splits', pick;
  if (ef.eff >= 1) {
    pick = known.filter(function(x) { return x[1] > 1 && RAISED[x[0]]; }).sort(function(a, b) { return b[1] - a[1]; })[0];
    if (pick) title = RAISED[pick[0]];
    else if (timeKnown && !known.some(function(x) { return x[1] < 1; })) title = 'Nothing lost to the time, the racks or the parts';
  } else {
    pick = known.filter(function(x) { return x[1] < 1; }).sort(function(a, b) { return a[1] - b[1]; })[0];
    if (pick) title = LOST[pick[0]];
  }
  var working = uiWorkingHtml('flr-eff-' + line, facts, null, ' data-flr-effworking');
  // With no rounds counted there are no factors to name: only the working.
  if (ef.pace == null) return working;
  var tone = function(x, ok, warn) { return x >= ok ? 'ok' : x >= warn ? 'warning' : 'danger'; };
  var tile = function(key, label, v, sub, t) {
    return '<div class="inv-tile' + (t ? ' inv-tile-' + t : '') + '" data-flr-factor="' + key + '"><div class="inv-tile-label">' + escHtml(label) + '</div>' +
      '<div class="inv-tile-value">' + escHtml(v) + '</div><div class="inv-tile-sub">' + escHtml(sub) + '</div></div>';
  };
  var tiles = [timeKnown ? tile('time', 'Time', pct(ef.pace), (ef.roundsOnly ? '' : 'about ') + Math.round(ef.roundsRun) + ' of ' + rp + ' rounds', tone(ef.pace, 0.9, 0.75))
    : tile('time', 'Time', '—', 'not told apart', '')];
  if (ef.racks != null) {
    tiles.push(tile('racks', 'Racks', pct(ef.racks), ef.partFull && ef.partFull.length ? todoPlural(ef.partFull.length, 'part') + ' not full' : 'full', tone(ef.racks, 0.95, 0.85)));
    tiles.push(tile('parts', 'Parts', pct(ef.parts), formatNum(ef.fullRound, 0) + ' of ' + formatNum(ef.kgAvail, 0) + ' kg a round', 'info'));
  } else tiles.push(tile('load', 'Load', pct(ef.load), 'of ' + formatNum(ef.kgAvail, 0) + ' kg a round', 'info'));
  if (ef.roundsUnweighed >= 0.5 && ef.weighed != null) tiles.push(tile('weighed', 'Weighed', pct(ef.weighed), Math.round(ef.roundsUnweighed) + ' of ' + nr + ' rounds unweighed', tone(ef.weighed, 0.95, 0.75)));
  return '<div class="inv-row-group" data-flr-effverdict><span>' + escHtml(title) + '</span></div>' +
    '<div class="inv-tiles inv-tiles-flush' + (tiles.length === 3 ? ' inv-tiles-3' : '') + '" data-flr-effsplit>' + tiles.join('') + '</div>' + working;
}

/* The day's pieces nothing weighs, named with the move that weighs them (owner, 9 Oct 2026: "we should have a list of those
   pieces whose weights are missing so we can do a follow up"): the floor's name, its client and line, the pieces. */
function flrUnweighedHtml(day) {
  var pic = prodDayPicture(day);
  if (!pic.names.length) return '';
  // Open, since each row is a question for the owner: the first ten, the rest one tap away (how it works is the guide's).
  return '<div class="inv-panel inv-panel-flush" id="flrUnweighed"><div class="inv-panel-head"><span class="inv-panel-title">Not weighed</span>' +
    '<span class="inv-panel-count">' + escHtml(Math.round(pic.unweighed).toLocaleString('en-IN') + ' pcs') + '</span>' +
    (flrSees('pageProduction') ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invProdUnweighedAll">Every day</button>' : '') + '</div>' +
    uiMoreHtml('flr-unweighed', prodUnweighedRows(pic.names), { n: 10, noun: 'parts' }) + '</div>';
}

/* ---------- Where each part opens ---------- */
/* Production → Lines on the line and the day on screen (Pickling is Lines' fourth). */
function flrOpenLine(line) {
  _prodLine = line === 'pickling' || PROD_LINES.indexOf(line) >= 0 ? line : 'vat-a1';
  _prodDay = flrDayIso();
  _prodView = 'main';
  prodSetTab('lines');
  switchTab('pageProduction');
}
/* Staff on the day: its Day board, or Areas on the day's week. */
function flrOpenStaff(view) {
  var day = flrDayIso();
  _attView = view;
  _attDate = day;
  _attWeekStart = attWeekStartOf(day);
  switchTab('pageStaff');
}
function flrStep(n) { flrSetDay(isoAddDays(flrDayIso(), n)); renderFloor(); }

function flrAction(action, btn) {
  switch (action) {
    // A day stepped to is a place of its own (the address carries it); the page and the focus stay where they were.
    case 'invFlrStep': keepScroll(function() { flrStep(+btn.dataset.step || 0); }); return true;
    case 'invFlrToday': keepScroll(function() { _flrDay = null; renderFloor(); }); return true;
    case 'invFlrLine': flrOpenLine(btn.dataset.line); return true;
    // Production's own doors, opened on the line and day: the register photo's picker (the key is asked there), and the
    // paste box for the barrel list and the pickling messages.
    case 'invFlrPhoto': flrOpenLine(btn.dataset.line); prodPhotoPick(); return true;
    case 'invFlrPaste': flrOpenLine(btn.dataset.line); prodSetView('paste'); return true;
    case 'invFlrStaff': flrOpenStaff('day'); return true;
    case 'invFlrAreas': flrOpenStaff('areas'); return true;
    case 'invFlrStock': _stockView = 'list'; switchTab('pageStock'); return true;
    case 'invFlrPower': powerSetTab('cuts'); switchTab('pagePower'); return true;
  }
  return false;
}
/* The day's field: a date picked; one to come is today. */
function flrOnChange(t) {
  if (!t || t.id !== 'flrDate') return false;
  if (t.value) flrSetDay(t.value);
  renderFloor();
  return true;
}
