/* ===== FLOOR → DAY: the line board (Direction B, step 5; P138) =====
 * The floor's day on one screen (owner, 1 Oct 2026, direction B): a card per line (VAT A1, VAT A2, Barrel, Pickling) with
 * the heads on it against the day's number, the EXTRA booked to it, what it is running and when its last round was, what
 * it has plated and who plated it; tiles for on site, plated and power above the cards.
 *
 * Nothing is stored here, and nothing is worked out twice: each figure is read from the function its own screen uses.
 * Staffing: areaStats (the heads where each mark says, as Staff → Day's board and Areas count them) against areaNeedOn;
 * Barrel is barrel and barrel pickling, the one unit of five Areas reads. EXTRA: areaStats' hours booked to the line's
 * areas (a row over two areas shared between them, as Areas shares it). Running and plated: prodDayLine (the figure that
 * counts per line and shift, as Production → Lines shows it) and prodDayLoads; the crew, prodCrew. The tiles: Staff's
 * own attDaySummary, Production's prodDayPlated and Power's powerCuts. A figure the record cannot give is a dash with
 * its reason, never 0.
 *
 * A day is a place: ?tab=pageFloor&d=YYYY-MM-DD, today with no d (nav.js). A card opens Production → Lines on its line
 * and day; the staffing word opens Staff → Day; the EXTRA badge opens Areas. */

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

function flrHtml(day) {
  var isToday = day === localDateStr();
  var att = attDaySummary(day), plated = prodDayPlated(day), cuts = powerCuts(day, day);
  // A day the floor recorded (attendance or plating, Power's own test): a cut it does not report is none, not unknown.
  var recorded = att.marked || Object.keys(plated.lines).length > 0;
  var stats = areaStats(day, day), byArea = {};
  stats.rows.forEach(function(a) { byArea[a.id] = a; });
  return flrStepperHtml(day, isToday) +
    '<div class="inv-tiles inv-tiles-3" id="flrTiles">' + flrOnSiteTile(att, isToday) + flrPlatedTile(plated, isToday) + flrPowerTile(cuts, recorded, isToday) + '</div>' +
    '<div class="inv-panels" id="flrLines">' + FLR_LINES.map(function(ln) { return flrCardHtml(day, isToday, ln, byArea, att.marked); }).join('') + '</div>' +
    '<div class="inv-note inv-mt-8" id="flrNote">Staffing: the general shift&rsquo;s heads against the day&rsquo;s number (Staff &rarr; Day); Barrel is barrel and barrel pickling, one unit. ' +
    'Plated: the figure that counts for each shift, as Production &rarr; Lines shows it. A day nobody recorded is a gap, not a zero.</div>';
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

/* ---------- The tiles ---------- */
function flrTile(key, label, value, sub, tone, action) {
  return '<button class="inv-tile' + (tone ? ' inv-tile-' + tone : '') + '" data-action="' + action + '" data-flr-tile="' + key + '">' +
    '<div class="inv-tile-label">' + label + '</div><div class="inv-tile-value">' + value + '</div><div class="inv-tile-sub">' + sub + '</div></button>';
}
/* On site against the active roster, judged at the rest-day gate's 90% and 80% as Staff's own panel judges it. */
function flrOnSiteTile(d, isToday) {
  if (!d.marked) return flrTile('onsite', 'On site', '&mdash;', isToday ? 'nothing recorded yet' : 'no attendance recorded', '', 'invFlrStaff');
  var on = d.p + d.half, pct = d.roster.length && !d.unmarked ? on / d.roster.length * 100 : null;
  return flrTile('onsite', 'On site', on + '<span class="inv-tile-of">/' + d.roster.length + '</span>',
    escHtml((d.half ? todoPlural(d.half, 'half day') + ' · ' : '') + d.absent.length + ' absent' + (d.unmarked ? ' · ' + d.unmarked + ' unmarked' : '')), figTonePct(pct, 90, 80), 'invFlrStaff');
}
/* The day's plating across the lines, Production's tile rule: the tonnes where 90% of the pieces are weighed, else the pieces. */
function flrPlatedTile(pl, isToday) {
  var label = 'Plated' + (isToday ? ' so far' : '');
  if (!Object.keys(pl.lines).length) return flrTile('plated', label, '&mdash;', isToday ? 'nothing recorded yet' : 'not recorded: a gap', '', 'invFlrPlated');
  return flrTile('plated', label, figWrapHtml(escHtml(pl.text)), escHtml(pl.whole ? Math.round(pl.nos).toLocaleString('en-IN') + ' NOS'
    : formatNum(pl.kg / 1000, 2) + ' t known, ' + Math.round(pl.share * 100) + '% of the pieces weighed'), '', 'invFlrPlated');
}
/* The day's cuts, one per event as Power counts them (a cut the register and the pickling hand both report is one), and
   the minutes they were dark. */
function flrPowerTile(cuts, recorded, isToday) {
  if (!cuts.length) return flrTile('power', 'Power', recorded ? '0<span class="inv-tile-of"> cuts</span>' : '&mdash;',
    recorded ? 'no cut reported' : isToday ? 'nothing recorded yet' : 'no floor record this day', '', 'invFlrPower');
  var mins = cuts.reduce(function(s, c) { return s + (c.min || 0); }, 0), open = cuts.filter(function(c) { return c.open; }).length;
  return flrTile('power', 'Power', cuts.length + '<span class="inv-tile-of"> ' + (cuts.length === 1 ? 'cut' : 'cuts') + '</span>',
    escHtml([mins ? powerDur(mins) + ' dark' : '', open ? open + ' with no time back' : ''].filter(Boolean).join(' · ')), 'warning', 'invFlrPower');
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

function flrCardHtml(day, isToday, ln, byArea, marked) {
  var name = flrLineName(ln.id), st = flrStaffing(day, ln, byArea, marked);
  var extra = ln.areas.reduce(function(s, a) { return s + ((byArea[a] && byArea[a].extraHours) || 0); }, 0);
  var h = '<div class="inv-panel inv-panel-flush" data-line="' + ln.id + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(name) + '</span>' +
    '<span class="inv-toolbar inv-toolbar-tight">' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFlrStaff" data-flr-staff aria-label="' + escHtml(name + ' staffing: ' + st.word + '. Open Staff, Day') + '">' + uiDot(st.tone, escHtml(st.word)) + '</button>' +
    (extra > 0.0005 ? '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFlrAreas" data-flr-extra aria-label="' + escHtml('EXTRA ' + flrHours(extra) + ' hours booked to ' + name + '. Open Areas') + '">' +
      '<span class="inv-badge inv-badge-warning">EXTRA ' + flrHours(extra) + ' h</span></button>' : '') +
    '</span></div>';
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
      // What the line plated that day, as Lines' tiles show it: the pieces, and the kilograms (with the share weighed).
      var fig = r.nos > 0 ? Math.round(r.nos).toLocaleString('en-IN') + ' NOS' : r.kg > 0 ? formatNum(r.kg, 0) + ' kg' : null;
      var kgSub = r.nos > 0 && r.kg > 0 ? formatNum(r.kg, 0) + ' kg' + (r.weighedShare < 0.9 ? ', ' + Math.round(r.weighedShare * 100) + '% weighed' : '') : '';
      end = '<span class="inv-row-stack"><span class="inv-num" data-flr-plated>' + (fig ? escHtml(fig) : '&mdash;') + '</span>' +
        (kgSub ? '<span class="inv-row-meta inv-num" data-flr-kg>' + escHtml(kgSub) + '</span>' : '') + '</span>';
    }
  }
  if (last) {
    h += '<div class="inv-row inv-row-2" data-flr-run="' + escHtml(last.id) + '"><button class="inv-row-main" data-action="invFlrLine" data-line="' + ln.id + '">' +
      '<span class="inv-row-title">' + escHtml(title) + '</span><span class="inv-row-meta">' + escHtml(meta) + '</span></button>' +
      '<span class="inv-row-end">' + end + '</span></div>';
  } else {
    // No record: where it comes from, and the one move that fills it (a line of its own under the row on the phone).
    var btn = ln.src === 'photo' ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFlrPhoto" data-line="' + ln.id + '">Read register photo</button>'
      : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFlrPaste" data-line="' + ln.id + '">Paste message</button>';
    h += '<div class="inv-row inv-row-2 inv-row-flow" data-flr-run=""><button class="inv-row-main" data-action="invFlrLine" data-line="' + ln.id + '">' +
      '<span class="inv-row-title">' + (isToday ? 'No record yet today' : 'No record this day') + '</span>' +
      '<span class="inv-row-meta">' + escHtml((isToday ? 'From ' : 'A gap, not a zero: from ') + FLR_SRC_TEXT[ln.src]) + '</span></button>' +
      '<span class="inv-row-end inv-row-actions">' + btn + '</span></div>';
  }
  // Who plated it: the run's crew (prodCrew, as Production → Entries names it); with no run, the hands marked on the line.
  var cr = last ? prodCrew(last) : prodCrew(ln.id === 'pickling' ? { date: day, kind: 'pickled' } : { date: day, kind: 'plated', line: ln.id, slot: 'general' });
  var crew = last ? (cr.known ? (cr.src === 'block' ? 'OT crew: ' : 'Crew: ') + cr.names.join(', ') : 'Crew not known: ' + cr.why)
    : cr.known ? 'On the line: ' + cr.names.join(', ') : cr.why.charAt(0).toUpperCase() + cr.why.slice(1);
  // The line's units on the day shown (plant.js): what of it could run.
  h += pltFloorRowHtml(ln.id, day);
  h += '<div class="inv-row inv-row-auto" data-flr-crew><span class="inv-row-main"><span class="inv-row-meta inv-row-wrap">' + escHtml(crew) + '</span></span></div>';
  return h + '</div>';
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
    case 'invFlrPlated': {
      var pl = prodDayPlated(flrDayIso());
      flrOpenLine(PROD_LINES.find(function(l) { return pl.lines[l]; }) || 'vat-a1');
      return true;
    }
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
