/* ===== HOME: THE DASHBOARD AND NEEDS YOU (Direction B, step 3; UI pass 3, U2; P135, P223) =====
   Owner, 1 Oct 2026 (docs/DIRECTION_B.md), then 15–16 Oct 2026 (docs/UI_PASS_3.md §8: "a Home page and dashboard for it as
   well, a clean, live and informative dashboard. It should show the time, some predictions, some news"). Two views of pageHome:
   - Home, the dashboard (the default): the day card, Home's verdict (the greeting, the clock ticking on the minute, the general
     shift's end, the weather now, the first thing that needs the owner), then one toolbar row (the period, Customise, More), then
     the board of widgets each person arranges (widgets.js, widgetcards.js). Pulse's questions, Do first, Why it moved, the
     period in figures and the month's pace are widgets on it.
   - Needs you, the inbox:
     - the day's inputs, each saying whether it is in and, if not, when it usually arrives, with the one tap that brings it
       (Add's paste box, the hand form for the register's page);
     - on the desktop, the floor now;
     - the last five invoices, each with its print button;
     - every open task, grouped Now / This week / Later, each with its one-tap move.

   The views are pageHome's own `v` (?tab=pageHome&v=needs; an old ?v=pulse opens the dashboard, nav.js NAV_REDIRECTS). The shell
   (workspace.js) draws their tabs once homeViews says they exist, and nav.js reads and applies the view. Nothing here is stored and
   nothing is worked out twice: each figure comes from the function its own screen uses (attDaySummary, prodDayLoads, prodDayLine,
   powerCuts, todoRanked, advTaskMoves, finForecast, pltCapacity, predMonthPace). What a role may not open is not offered
   (guard.js): an input whose screen it does not open, a task it may not see (todo.js todoSees), a widget it may not see. */

var TDY_VIEWS = [{ v: 'home', label: 'Home' }, { v: 'needs', label: 'Needs you' }];
var TDY_SHOW = 10;            // a group of tasks shows its first ten; the rest one tap away (uiMoreHtml)
var TDY_LATE_MIN = 45;        // an input this long past its usual time is amber
var TDY_LEARN_DAYS = 28;      // the usual time is read off the last four weeks
var TDY_MIN_SEEN = 3;         // under three days seen, the usual time is the shop's own (TDY_INPUTS' `usual`)
var _tdyView = 'home';

/* The shell draws Home's two tabs once this says it has them (workspace.js, wsViewsPresent). The dashboard is the default; an
   old view's name (Pulse's) is the dashboard. */
function homeViews() { return TDY_VIEWS.slice(); }
function tdyView() { return _tdyView === 'needs' ? 'needs' : 'home'; }
function tdySetView(v) { _tdyView = v === 'needs' ? 'needs' : 'home'; }

/* What a role may see on Today. With the guard off, everything (guard.js answers yes). */
function tdySees(tabId) { return typeof grdSees !== 'function' || grdSees(tabId); }
function tdySeesMoney() { return typeof grdSeesMoney !== 'function' || grdSeesMoney(); }
/* The screen each input fills, which a role must open for the input to be its own (the QA audit, QA2-5: an Office user saw
   all five floor inputs toned Late, and every tap was refused). */
var TDY_INPUT_PAGE = { 'roll-in': 'pageStaff', 'roll-out': 'pageStaff', pickling: 'pageProduction', production: 'pageProduction', stock: 'pageStock' };
function tdyInputsSeen() { return TDY_INPUTS.filter(function(def) { return tdySees(TDY_INPUT_PAGE[def.k] || 'pageHome'); }); }

/* ---------- The day's inputs ----------
   The five things the floor sends in a day, in the order they arrive. `usual` is the shop's own time, used until four
   weeks of record say otherwise (minutes after midnight): the roll by 9:30, the first pickling load and the stock message
   by 10, the production records by the evening (the register clerk's pages were mostly sent 4 to 6 PM), the out-time roll
   once the crews go home. `from` is when one is first looked for: the out-time roll is not late at noon. */
var TDY_INPUTS = [
  { k: 'roll-in', title: 'In-time roll', usual: 570, from: 0, move: 'paste' },
  { k: 'pickling', title: 'Pickling loads', usual: 600, from: 0, move: 'paste' },
  { k: 'stock', title: 'Stock message', usual: 600, from: 0, move: 'paste' },
  { k: 'production', title: 'Production records', usual: 1080, from: 0, move: 'hand' },
  { k: 'roll-out', title: 'Out-time roll', usual: 1170, from: 1020, move: 'paste' }
];

function tdyMinOfDay(ts) { var d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); }
function tdyNowMin() { return tdyMinOfDay(Date.now()); }
/* When a pasted message arrived on its day: the minute WhatsApp says it was sent (the header's), else the minute it was
   pasted when that was the same day. Null when neither says (a message pasted days later with no header). A saved roll
   keeps only its body, and its header's minute beside it (`sent`: relay.js's sentOn and sentAt). */
function tdyArrival(text, at, day, sent) {
  if (sent && sent.sentAt != null && sent.sentOn === day) return sent.sentAt;
  var m = null;
  try { m = prodSplit(text || '').filter(function(x) { return x.sentOn === day && x.sentAt != null; })[0] || null; } catch (e) { m = null; }
  if (m) return m.sentAt;
  return at && isoOf(new Date(at)) === day ? tdyMinOfDay(at) : null;
}
function tdyMedian(list) { return list.length ? Math.round(numMedian(list)) : null; }

/* The rolls (S.relayPastes) for a day, of one kind. */
function tdyRolls(kind, day) {
  return relayPastes().filter(function(p) { return p && p.kind === kind && (p.date === day || (Array.isArray(p.days) && p.days.indexOf(day) >= 0)); });
}
/* The stock messages about a day: the window a message covers ends on its day, or it was pasted that day. */
function tdyStockMsgs(day) {
  return ((S.stock && S.stock.pastes) || []).filter(function(p) { return p && (p.to === day || (p.at && isoOf(new Date(p.at)) === day)); });
}
/* The days before `day` (four weeks), for learning the usual minute. */
function tdyPastDays(day) {
  var out = [];
  for (var i = 1; i <= TDY_LEARN_DAYS; i++) out.push(isoAddDays(day, -i));
  return out;
}
/* The minute each input usually arrives, from the record (the median over the days it came), else the shop's own. */
function tdyUsual(k, day) {
  var days = tdyPastDays(day), mins = [];
  days.forEach(function(d) {
    var m = null;
    if (k === 'roll-in' || k === 'roll-out') {
      // Learnt only from the minute WhatsApp sent it: a roll pasted without its header carries only when it was pasted,
      // and the owner's pasting hour read as "usually by 1:33 PM" for a roll sent before 9 (6 Oct 2026).
      tdyRolls(k === 'roll-in' ? 'in' : 'out', d).forEach(function(p) { var a = tdyArrival(p.text, null, d, p); if (a != null && (m == null || a < m)) m = a; });
    } else if (k === 'pickling') {
      prodDayLoads(d).forEach(function(e) { var a = relayParseHhmm(e.time); if (a != null && (m == null || a < m)) m = a; });
    } else if (k === 'stock') {
      tdyStockMsgs(d).forEach(function(p) { var a = tdyArrival(p.text, null, d); if (a != null && (m == null || a < m)) m = a; });
    } else if (k === 'production') {
      // The day's records are in when the last line's is: the latest page read that day (a photo of one, before the photo
      // reading came out on 13 Oct 2026, has no header).
      ((S.production && S.production.photos) || []).forEach(function(p) { if (p && p.readDate === d && p.at && isoOf(new Date(p.at)) === d) { var a = tdyMinOfDay(p.at); if (m == null || a > m) m = a; } });
    }
    if (m != null) mins.push(m);
  });
  var def = TDY_INPUTS.filter(function(x) { return x.k === k; })[0];
  return { min: mins.length >= TDY_MIN_SEEN ? tdyMedian(mins) : def.usual, seen: mins.length };
}

/* One input on one day: whether it is in, what it says, and its state: in · wait (not yet due) · late · off (a Sunday or a
   paid holiday nobody worked: nothing is expected). Only today is judged against the clock. */
function tdyInput(def, day) {
  var isToday = day === localDateStr(), now = isToday ? tdyNowMin() : 1440;
  var att = attDaySummary(day), worked = att.marked || Object.keys(prodDayPlated(day).lines).length > 0 || prodDayLoads(day).length > 0;
  var off = !worked && (new Date(day + 'T00:00:00').getDay() === 0 || (typeof labourIsHoliday === 'function' && labourIsHoliday(day)));
  var o = { k: def.k, title: def.title, move: def.move, state: 'wait', text: '', usual: null, lines: null };
  var clock = function(m) { return m == null ? '' : relayClockLabel(m); };
  if (def.k === 'roll-in' || def.k === 'roll-out') {
    var rolls = tdyRolls(def.k === 'roll-in' ? 'in' : 'out', day);
    if (rolls.length) {
      var a = rolls.map(function(p) { return tdyArrival(p.text, p.at, day, p); }).filter(function(x) { return x != null; });
      o.state = 'in';
      o.text = [a.length ? clock(Math.min.apply(null, a)) : '', att.marked && def.k === 'roll-in' ? (att.p + att.half) + ' on site, ' + att.absent.length + ' absent' : ''].filter(Boolean).join(' · ') || 'In';
    } else if (def.k === 'roll-in' && att.marked) {
      // Entered by hand, or from paper: the day is in, with no roll behind it.
      o.state = 'in';
      o.text = (att.p + att.half) + ' on site, ' + att.absent.length + ' absent · entered by hand';
    }
  } else if (def.k === 'pickling') {
    var loads = prodDayLoads(day);
    if (loads.length) {
      var last = flrLatest(loads), lk = last ? flrTimeKey(last) : -1;
      o.state = 'in';
      o.text = todoPlural(loads.length, 'load') + (lk >= 0 ? ' · last ' + relayClockLabel(lk) : '');
    }
  } else if (def.k === 'stock') {
    var msgs = tdyStockMsgs(day), byHand = (stockData().entries || []).some(function(e) { return e && !e.voided && e.date === day && !e.pasteId; });
    if (msgs.length) {
      var am = msgs.map(function(p) { return tdyArrival(p.text, p.at, day); }).filter(function(x) { return x != null; });
      o.state = 'in';
      o.text = (am.length ? clock(Math.min.apply(null, am)) + ' · ' : '') + todoPlural(msgs.length, 'message');
    } else if (byHand) { o.state = 'in'; o.text = 'entered by hand'; }
  } else if (def.k === 'production') {
    // A line is in when it has a record that counts that day (a register page, the barrel list, a run by hand).
    var have = [], miss = [];
    PROD_LINES.forEach(function(l) { (prodDayLine(day, l).entries.length ? have : miss).push(PROD_LINE_LABEL[l]); });
    o.lines = { have: have, miss: miss };
    if (!miss.length) { o.state = 'in'; o.text = 'All three lines in'; }
    // One fact (the tab map, TM6e): which are in and which not, before when the rest are looked for.
    else if (have.length) { o.state = 'part'; o.text = have.join(', ') + ' in; ' + miss.join(', ') + ' not yet'; }
    // Only the barrel list missing: it comes as a message, not a page.
    if (miss.length === 1 && miss[0] === PROD_LINE_LABEL.barrel) o.move = 'paste';
  }
  if (o.state === 'in') {
    // Entered on a person's own screen (faces.js): said by whom, in place of "by hand".
    var by = typeof faceInputBy === 'function' ? faceInputBy(def.k, day) : [];
    if (by.length) { var bt = o.text.replace(/ · entered by hand$/, '').replace(/^entered by hand$/, ''); o.text = bt ? bt + ' · by ' + by.join(', ') : 'Entered by ' + by.join(', '); }
    return o;
  }
  var u = tdyUsual(def.k, day);
  o.usual = u.min;
  if (off) { o.state = 'off'; o.text = 'Not expected: ' + (new Date(day + 'T00:00:00').getDay() === 0 ? 'Sunday' : 'a paid holiday'); return o; }
  var due = Math.max(def.from || 0, 0);
  // What the step says in a line (tdyStepMeta) is read from these: the part already in, when one is first looked for,
  // and whether the usual minute is the record's or the shop's own.
  o.detail = o.text; o.shop = u.seen < TDY_MIN_SEEN;
  if (isToday && now < due) { o.state = o.state === 'part' ? 'part' : 'wait'; o.after = due; o.text = o.text || 'After ' + relayClockLabel(due); return o; }
  var late = now > u.min + TDY_LATE_MIN;
  var usualText = 'usually by ' + relayClockLabel(u.min) + (u.seen >= TDY_MIN_SEEN ? '' : ' (the shop’s usual time)');
  o.text = (o.text ? o.text + ' · ' : 'Not in yet · ') + usualText;
  if (late) o.state = 'late';
  else if (o.state !== 'part') o.state = 'wait';
  return o;
}
var TDY_STATE_DOT = { in: ['ok', 'In'], part: ['neutral', 'Part'], wait: ['neutral', 'Not yet'], late: ['warning', 'Late'], off: ['neutral', 'Not expected'] };
var TDY_INPUT_SHORT = { 'roll-in': 'In-time roll', pickling: 'Pickling loads', stock: 'Stock message', production: 'Production records', 'roll-out': 'Out-time roll' };
var TDY_CHECK_SVG = iconSvg('check', 'inv-ico-bold');   // a tick inside a step's small dot: the set's check, heavier to read at its size
/* An input's line on its step: what came, or when it is looked for (owner, 8 Oct 2026: less to read). */
function tdyStepMeta(r) {
  if (r.state === 'in' || r.state === 'off') return r.text;
  if (r.after != null) return 'After ' + relayClockLabel(r.after);
  var by = r.usual != null ? 'by ' + relayClockLabel(r.usual) : '';
  if (r.state === 'part') return [r.detail, by].filter(Boolean).join(' · ');
  return r.state === 'late' ? 'Late' + (by ? ' · ' + by : '') : by ? by.charAt(0).toUpperCase() + by.slice(1) : 'Not yet';
}
/* The day's inputs (§6.21, §6.23): a hero that says how many are in and what comes next, opening to the day as a rail of
   steps, each with the one tap that brings it in. Open while anything is still to come; shut once all are in. */
function tdyInputsHtml(day, o) {
  o = o || {};
  var defs = tdyInputsSeen();
  // A role that takes none of the floor's inputs (the office) has no card of them.
  if (!defs.length) return '';
  var rows = defs.map(function(def) { return tdyInput(def, day); });
  var n = rows.filter(function(r) { return r.state === 'in'; }).length, done = rows.filter(function(r) { return r.state === 'in' || r.state === 'off'; }).length;
  var late = rows.filter(function(r) { return r.state === 'late'; }), next = late[0] || rows.find(function(r) { return r.state === 'wait' || r.state === 'part'; });
  var shop = rows.some(function(r) { return r.state !== 'in' && r.state !== 'off' && r.shop; });
  var steps = rows.map(function(r, i) {
    var btn = '';
    if (r.state !== 'in' && r.state !== 'off') {
      btn = r.move === 'hand'
        ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invTdyHand" data-line="' + escHtml(tdyFirstMissingLine(r)) + '">By hand</button>'
        : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invTdyPaste">Paste</button>';
    }
    var node = r.state === 'in' ? TDY_CHECK_SVG : r.state === 'late' ? '!' : String(i + 1);
    return '<div class="inv-step" data-tdy-input="' + r.k + '" data-state="' + r.state + '">' +
      '<span class="inv-step-node" aria-hidden="true">' + node + '</span>' +
      '<button class="inv-step-main" data-action="invTdyInput" data-k="' + r.k + '" aria-label="' + escHtml(r.title + ': ' + (TDY_STATE_DOT[r.state] || TDY_STATE_DOT.wait)[1] + ', ' + tdyStepMeta(r)) + '">' +
      '<span class="inv-step-title">' + escHtml(r.title) + '</span><span class="inv-step-meta">' + escHtml(tdyStepMeta(r)) + '</span></button>' +
      '<span class="inv-row-end">' + btn + '</span></div>';
  }).join('');
  // The messages these steps wait for come in on WhatsApp: open it from here (add.js).
  var wa = '<div class="inv-row inv-row-2 inv-row-flow" data-tdy-wa><span class="inv-row-main"><span class="inv-row-title">WhatsApp</span>' +
    '<span class="inv-row-meta inv-row-wrap">Copy a message there, then Paste on its step</span></span>' +
    '<span class="inv-row-end inv-row-actions">' + waLinksHtml('today') + '</span></div>';
  var meter = chartMeter(rows.map(function(r) { return { v: 1, tone: r.state === 'in' ? 'ok' : r.state === 'late' ? 'warning' : r.state === 'part' ? 'info' : 'neutral-2' }; }),
    { title: rows.map(function(r) { return r.title + ': ' + (TDY_STATE_DOT[r.state] || TDY_STATE_DOT.wait)[1]; }).join(' · ') });
  var sub = done === rows.length ? 'Everything the floor sends is in' : next ? (TDY_INPUT_SHORT[next.k] || next.title) + ' ' + (next.state === 'late' ? 'is late, ' + tdyStepMeta(next).replace(/^Late · /, '') : tdyStepMeta(next).toLowerCase()) : '';
  return uiHeroHtml({ tone: late.length ? 'warning' : done === rows.length ? 'ok' : '', eyebrow: '<span>The day’s inputs</span><span class="inv-panel-count">' + escHtml(attDayName(day) + ' ' + formatDate(day)) + '</span>',
    title: '<span data-tdy-in>' + (n === rows.length ? 'All ' + n + ' in' : n + ' of ' + rows.length + ' in') + '</span>',
    // Open while something is still to come, except on the phone while a red task waits: the head says what is late, and the
    // red tasks under it are what needs the owner first (the survey of 8 Oct 2026).
    fig: late.length ? escHtml(late.length + ' late') : '', sub: escHtml(sub), viz: meter, open: done < rows.length && !o.shut,
    body: '<div class="inv-hero-sheet"><div class="inv-panel-body inv-steps" data-tdy-steps>' + steps + '</div>' + wa +
      (shop ? '<div class="inv-panel-body inv-note">A time with no four weeks of record behind it is the shop’s usual one.</div>' : '') + '</div>',
    attrs: ' data-card="inputs" data-verdict' });
}
/* The first VAT line with no record (the register's page is theirs); else VAT A1. */
function tdyFirstMissingLine(r) {
  var miss = (r.lines && r.lines.miss) || [];
  for (var i = 0; i < PROD_LINES.length; i++) {
    var l = PROD_LINES[i];
    if (l !== 'barrel' && miss.indexOf(PROD_LINE_LABEL[l]) >= 0) return l;
  }
  return 'vat-a1';
}
/* Where an input lands, opened from its row: the day it filled. */
function tdyOpenInput(k) {
  var day = localDateStr();
  if (k === 'roll-in' || k === 'roll-out') { _attView = 'day'; _attDate = day; switchTab('pageStaff'); }
  else if (k === 'pickling') flrOpenLine('pickling');
  else if (k === 'stock') { _stockView = 'list'; switchTab('pageStock'); }
  else if (k === 'production') { if (tdySees('pageFloor')) { flrSetDay(null); switchTab('pageFloor'); } else flrOpenLine('vat-a1'); }
}

/* ---------- The floor now (the desktop) ----------
   Floor → Day in four tiles, as the mockup's desktop Today draws it: each line's staffing word, what it has plated and what it
   is running; the day's cuts. Read from floor.js' own functions. */
function tdyFloorHtml(day) {
  var att = attDaySummary(day), stats = areaStats(day, day), byArea = {}, worst = '';
  stats.rows.forEach(function(a) { byArea[a.id] = a; });
  var tiles = FLR_LINES.filter(function(ln) { return ln.id !== 'pickling'; }).map(function(ln) {
    var st = flrStaffing(day, ln, byArea, att.marked), r = prodDayLine(day, ln.id), last = flrLatest(r.entries);
    if (st.tone === 'warning') worst = 'warning';
    var fig = r.kg > 0 ? escHtml(prodKgFig(r.kg, r.est > 0.0005, r.unweighed > 0)) : r.nos > 0 ? Math.round(r.nos).toLocaleString('en-IN') + ' NOS' : '&mdash;';
    // The tile is coded by its staffing (§6.26), the word under its figure saying which.
    return '<button type="button" class="inv-tile" data-tdy-line="' + ln.id + '" data-action="invTdyFloor" data-tone="' + escHtml(st.tone || 'neutral') + '"><div class="inv-tile-label">' + escHtml(flrLineName(ln.id)) + '</div>' +
      '<div class="inv-tile-value inv-tile-value-sm">' + fig + '</div><div class="inv-tile-sub">' + uiDot(st.tone, escHtml(st.word)) + '</div>' +
      '<div class="inv-tile-sub">' + escHtml(last ? prodEntryTitle(last) : 'No record yet today') + '</div></button>';
  });
  var cuts = powerCuts(day, day), mins = cuts.reduce(function(s, c) { return s + (c.min || 0); }, 0), open = cuts.filter(function(c) { return c.open; }).length;
  tiles.push('<button type="button" class="inv-tile' + (cuts.length ? ' inv-tile-warning' : '') + '" data-tdy-line="power" data-action="invTdyPower"><div class="inv-tile-label">Power</div>' +
    '<div class="inv-tile-value inv-tile-value-sm">' + (cuts.length ? escHtml(todoPlural(cuts.length, 'cut')) : 'No cut') + '</div>' +
    '<div class="inv-tile-sub">' + (cuts.length ? uiDot(open ? 'warning' : 'neutral', escHtml(open ? open + ' with no time back' : powerDur(mins) + ' dark')) : uiDot('ok', 'None reported')) + '</div>' +
    '<div class="inv-tile-sub">' + escHtml(cuts.length ? cuts.map(function(c) { return powerClock(c.from) + (c.to != null ? ' – ' + powerClock(c.to) : ''); }).join(', ') : 'today') + '</div></button>');
  var staffed = FLR_LINES.filter(function(ln) { return ln.id !== 'pickling'; }).filter(function(ln) { var st = flrStaffing(day, ln, byArea, att.marked); return st.heads > 0; }).length;
  // Who is on site against the day's roster, in the tone Floor and People give it (attOnSiteTone, TM6a); the card takes the worst
  // of what it holds.
  var onTone = att.marked ? attOnSiteTone(att) : null;
  var tone = [worst, open ? 'warning' : '', onTone].filter(Boolean).sort(function(a, b) { return (UI_TONE_RANK[b] || 0) - (UI_TONE_RANK[a] || 0); })[0] || '';
  return uiHeroHtml({ tone: tone, eyebrow: '<span>Floor now</span>', title: att.marked ? escHtml(todoPlural(staffed, 'line') + ' staffed') : 'No attendance yet today',
    sub: att.marked ? '<span data-tdy-onsite>' + figHtml(escHtml((att.p + att.half) + ' of ' + att.roster.length + ' on site'), onTone) + '</span>' + escHtml(' · ' + att.absent.length + ' absent') : 'The in-time roll says who stands where', fold: 'tdy-floor', open: true,
    body: '<div class="inv-hero-sheet"><div class="inv-tiles inv-tiles-flush">' + tiles.join('') + '</div></div>', attrs: ' data-card="floor" data-verdict' });
}

/* ---------- The tasks ----------
   Every open task, the app's and yours (todoRanked), in three groups by when it wants doing:
   - Now: red, and your own late or due today;
   - This week: amber, and your own due within the week or undated (what you typed is easiest to forget under the raised
     ones: owner, 26 Sep 2026);
   - Later: everything to know.
   Inside a group the To-do's own order holds, yours first. A task whose place the role may not open is left out. */
function tdyGroupOf(r) {
  if (r.tone === 'red') return 'now';
  if (r.mine) {
    if (!r.mine.due) return 'week';
    var d = isoDaysBetween(todoToday(), r.mine.due);
    return d <= 0 ? 'now' : d <= 7 ? 'week' : 'later';
  }
  return r.tone === 'amber' ? 'week' : 'later';
}
var TDY_GROUPS = [['now', 'Now'], ['week', 'This week'], ['later', 'Later']];
function tdyTaskPage(t) {
  var go = t && t.go;
  if (!go) return null;
  if (typeof isPageId === 'function' && isPageId(go.page)) return go.page;
  return typeof WS_GO_PAGE !== 'undefined' ? WS_GO_PAGE[go.kind] || null : null;
}
function tdyTaskWs(t) {
  var tab = tdyTaskPage(t);
  return tab && typeof wsLabelOf === 'function' ? wsLabelOf(tab) : '';
}
/* The task's one-tap move: its first move (advice.js) the role may follow (todo.js todoGoSees: its page, Pay's wages,
   Settings), else its own button. */
function tdyTaskMoveHtml(t) {
  var mv = typeof advTaskMoves === 'function' ? advTaskMoves(t) : [];
  var m = mv.filter(function(x) { return x.href || (x.go && todoGoSees(x.go)); })[0];
  if (m) {
    var ref = advRowRef(m);
    return m.href ? '<a class="inv-btn inv-btn-secondary inv-btn-sm" href="' + escHtml(m.href) + '" data-adv-call>' + escHtml(m.hrefLabel || 'Call') + '</a>'
      : '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAdvGo" data-key="' + escHtml(m.key) + '" data-adv-row="' + escHtml(ref) + '" title="' + escHtml(m.say) + '">' + escHtml(m.goLabel || 'Open') + '</button>';
  }
  return t.goLabel ? '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invTodoGoApp" data-key="' + escHtml(t.key) + '">' + escHtml(t.goLabel) + '</button>' : '';
}
/* A task as a card (§6.22): its mark and where it lands in the head with the rupees it names, the task and its figures,
   and its one move at the foot. The card opens the task, with every move it has. */
function tdyAppCardHtml(t) {
  var money = tdySeesMoney() && t.worth > 0.005;
  return '<article class="inv-deck-item" data-todo="app" data-tdy-task="' + escHtml(t.key) + '" data-tone="' + escHtml(t.tone || '') + '">' +
    '<div class="inv-deck-head">' + todoGlyph(t.tone) + '<span class="inv-deck-word">' + escHtml(tdyTaskWs(t) || TODO_TONE_WORD[t.tone] || 'To know') + '</span>' +
    (money ? '<span class="inv-deck-fig">' + figHtml(escHtml(formatCurrency(gstRound(t.worth))), t.tone === 'red' ? 'danger' : t.tone === 'amber' ? 'warning' : '') + '</span>' : '') + '</div>' +
    '<button class="inv-deck-main" data-action="invTodoOpenApp" data-key="' + escHtml(t.key) + '"><span class="inv-deck-title">' + escHtml(t.title) + '</span>' +
    (t.sub ? '<span class="inv-deck-sub">' + escHtml(t.sub) + '</span>' : '') + '</button>' +
    '<div class="inv-deck-foot">' + tdyTaskMoveHtml(t) + '</div></article>';
}
/* A task of your own as a card: its tick box and its due date in the head, its words, the place it was added from. */
function tdyMineCardHtml(t) {
  var tone = todoMineTone(t), go = '';
  if (t.go) go = '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invTodoGo" data-id="' + escHtml(t.id) + '">' + escHtml(todoGoLabel(t)) + '</button>';
  else if (t.link) go = '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invTodoGo" data-id="' + escHtml(t.id) + '">' + escHtml(todoLinkLabel(t.link)) + '</button>';
  return '<article class="inv-deck-item" data-todo="mine" data-tone="' + escHtml(tone) + '">' +
    '<div class="inv-deck-head"><label class="inv-row-lead inv-row-tick"><input type="checkbox" class="inv-check" data-action="invTodoToggle" data-id="' + escHtml(t.id) + '" aria-label="Mark done: ' + escHtml(t.text) + '"></label>' +
    '<span class="inv-deck-word">Yours</span>' + (t.due ? uiDot(tone ? uiTone(tone) : 'neutral', escHtml(todoDueLabel(t.due))) : '') + '</div>' +
    '<button class="inv-deck-main" data-action="invTodoEdit" data-id="' + escHtml(t.id) + '"><span class="inv-deck-title">' + escHtml(t.text) + '</span>' +
    (t.note ? '<span class="inv-deck-sub">' + escHtml(t.note) + '</span>' : '') + '</button>' + (go ? '<div class="inv-deck-foot">' + go + '</div>' : '') + '</article>';
}
/* The To-do's own list for the role signed in (todo.js todoRanked → todoSees, todoMineSees): a task whose move lands on a
   page the role does not open, on Pay without the wages or on Settings without the settings, or whose figures are money
   or wages it may not read, is not here. One list for Needs you, the To-do and the bar's counts (workspace.js). */
function tdyTasks() { return todoRanked(); }
/* The tasks as three hero cards (§6.21): Now (red, and your own due), This week and Later, each coded in its tone and
   opening to its deck. Now opens by itself; This week opens where Now is empty; Later stays shut until opened. */
var TDY_GROUP_TONE = { now: 'danger', week: 'warning', later: 'info' };
function tdyTasksHtml(rows) {
  rows = rows || tdyTasks();
  var groups = { now: [], week: [], later: [] };
  if (typeof learnSeen === 'function') learnSeen(rows.filter(function(r) { return r.app; }).map(function(r) { return r.app; }));
  rows.forEach(function(r) { groups[tdyGroupOf(r)].push(r); });
  var money = tdySeesMoney();
  var worth = function(list) { return gstRound(list.reduce(function(s, r) { return s + (r.app && r.app.worth > 0 ? r.app.worth : 0); }, 0)); };
  var card = function(r) { return r.app ? tdyAppCardHtml(r.app) : tdyMineCardHtml(r.mine); };
  var deck = function(g, list) { return uiMoreDeckHtml('tdy-' + g, list.map(card), { n: TDY_SHOW, noun: list.length - TDY_SHOW === 1 ? 'task' : 'tasks' }); };
  // What a folded group holds, in a line (the tab map, TM6e): its first two tasks, each cut to forty letters, a list (commas).
  var clip = function(t) { t = String(t || ''); return t.length > 40 ? t.slice(0, 39).replace(/[\s,.;:·-]+$/, '') + '…' : t; };
  var titles = function(list) { return list.slice(0, 2).map(function(r) { return clip(r.app ? r.app.title : r.mine.text); }).join(', ') + (list.length > 2 ? ' and ' + (list.length - 2) + ' more' : ''); };
  var counts = function(list, g) { return '<span>' + TDY_GROUPS.filter(function(x) { return x[0] === g; })[0][1] + '</span><span class="inv-panel-count" data-tdy-count>' + list.length + '</span>'; };
  // A group's figure is the rupees its tasks name, said as such: unlabelled, it read as a total owed (the survey of 8 Oct 2026).
  var stake = function(w) { return money && w > 0 ? figWrapHtml(escHtml(formatCurrency(w))) + '<span class="inv-tile-of"> at stake</span>' : ''; };
  var h = '';
  var now = groups.now, wN = worth(now);
  var meter = rows.length ? chartMeter([{ v: groups.now.length, tone: 'danger' }, { v: groups.week.length, tone: 'warning' }, { v: groups.later.length, tone: 'info' }],
    { title: groups.now.length + ' now · ' + groups.week.length + ' this week · ' + groups.later.length + ' later' }) : '';
  var rest = [groups.week.length ? groups.week.length + ' this week' : '', groups.later.length ? groups.later.length + ' to know' : ''].filter(Boolean).join(' · ');
  h += uiHeroHtml({ tone: now.length ? (now.some(function(r) { return r.tone === 'red'; }) ? 'danger' : 'warning') : 'ok',
    eyebrow: counts(now, 'now'), title: now.length ? escHtml(todoPlural(now.length, 'thing needs', 'things need') + ' you now') : 'Nothing needs you now',
    fig: stake(wN), sub: escHtml(now.length ? rest || 'and nothing else is waiting' : rest ? rest + ', when you have a moment' : 'Every task is done'),
    viz: meter, open: true, body: now.length ? deck('now', now) : null, attrs: ' data-tdy-group="now" data-verdict' });
  [['week', groups.week], ['later', groups.later]].forEach(function(p) {
    var g = p[0], list = p[1];
    if (!list.length) return;
    var w = worth(list);
    h += uiHeroHtml({ tone: TDY_GROUP_TONE[g], eyebrow: counts(list, g), title: escHtml(g === 'week' ? todoPlural(list.length, 'task') + ' for this week' : todoPlural(list.length, 'thing') + ' to know'),
      fig: stake(w), sub: escHtml(titles(list)), fold: 'tdy-' + g, open: g === 'week' && !now.length,
      body: deck(g, list), attrs: ' data-tdy-group="' + g + '" data-verdict' });
  });
  return '<div class="inv-hero-stack" data-card="tasks">' + tdyAddHtml() + h + tdySnoozedHtml() + tdyDoneHtml() + tdyLearnHtml() + '</div>';
}
/* What only the To-do page had, here since the To-do joined Needs you (the tab map, TM2a): your own task typed where the tasks
   are, the tasks snoozed with Wake, the tasks ticked with the tick that reopens, and what the app learnt from your answers.
   The field and Add head the tasks (Add is the view's one primary; Enter in the field adds, events.js); the rest fold, shut. */
function tdyAddHtml() {
  // What is typed outlives a redraw (a tick on a task redraws Needs you while the field holds half a task), for the person who
  // typed it: drawn for another ID after the lock, the field starts empty, since the last person's half-typed task is theirs.
  var who = String((typeof grdUserId === 'function' && grdUserId()) || '');
  var cur = document.getElementById('todoNew'), typed = cur && cur.getAttribute('data-uid') === who ? cur.value : '';
  return '<div class="inv-toolbar" data-tdy-add><input class="inv-input inv-toolbar-item" id="todoNew" data-todo-new data-uid="' + escHtml(who) + '" placeholder="Add a task…" aria-label="New task" autocomplete="off"' +
    (typed ? ' value="' + escHtml(typed) + '"' : '') + '>' +
    '<button class="inv-btn inv-btn-primary" data-action="invTodoAdd">Add</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invTodoNew">Details</button></div>';
}
function tdySnoozedHtml() {
  var td = todoData();
  // Nothing snoozed is nothing to list: every rule read the whole book twice more on each draw of Needs you to find that out.
  // Otherwise one pass serves the tasks and the folds (todoFolds' own reading, from the same tasks).
  if (!Object.keys(td.snoozes || {}).length) return '';
  var seen = todoAppAll().filter(todoSees);
  var snoozed = seen.filter(todoIsSnoozed).concat(todoFoldList(seen.filter(function(t) { return !todoIsSnoozed(t); }))
    .filter(function(t) { return t.rule === 'fold' && todoIsSnoozed(t); }));
  if (!snoozed.length) return '';
  var rows = snoozed.map(function(t) {
    var sn = td.snoozes[t.key] || {};
    return '<div class="inv-row inv-row-2" data-todo="snoozed"><span class="inv-row-main"><span class="inv-row-title" title="' + escHtml(t.title) + '">' + escHtml(t.title) + '</span>' +
      '<span class="inv-row-meta">' + (sn.until ? 'Until ' + escHtml(stockShortDate(sn.until)) : 'Until the figures change') + '</span></span>' +
      '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invTodoWake" data-key="' + escHtml(t.key) + '">Wake</button></span></div>';
  }).join('');
  return uiFoldHtml('tdy-snoozed', '<span class="inv-panel-title">Snoozed <span class="inv-panel-count">' + snoozed.length + '</span></span>', rows, false, ' data-card="snoozed"');
}
function tdyDoneHtml() {
  var done = todoData().tasks.filter(function(t) { return t.doneAt && todoMineSees(t); }).sort(function(a, b) { return b.doneAt - a.doneAt; });
  if (!done.length) return '';
  return uiFoldHtml('tdy-done', '<span class="inv-panel-title">Done <span class="inv-panel-count">' + done.length + '</span></span>',
    uiMoreHtml('todoDone', done.map(function(t) { return todoMineRowHtml(t); }), { noun: 'done' }), false, ' data-card="done"');
}
function tdyLearnHtml() { return typeof learnPanelHtml === 'function' ? learnPanelHtml() : ''; }
/* Your own task, from anywhere (Add → By hand → Task, search, the widget): Needs you, its field focused. */
function tdyFocusAdd() {
  tdySetView('needs');
  switchTab('pageHome');
  var inp = document.getElementById('todoNew');
  if (inp) { uiRevealEl(inp); inp.focus(); }
}
/* Open the Done fold and bring it into sight (search's "Done tasks"). */
function tdyShowDone() {
  tdySetView('needs');
  switchTab('pageHome');
  var d = document.querySelector('#homeNeeds [data-card="done"]');
  if (d) { d.open = true; uiRevealEl(d); }
}

/* ---------- Drawing ---------- */
/* Needs you: on the phone a column of cards (the day's inputs, then the tasks, then the recent invoices); on the desktop
   the tasks across the top and the day, the floor and the invoices packed under them with no gap (§6.25). */
function renderNeeds() {
  var el = document.getElementById('homeNeeds');
  if (!el) return;
  // Nothing a role decides is drawn while nobody is signed in (guard.js grdHeld): the unlock draws it.
  if (typeof grdHeld === 'function' && grdHeld()) return;
  var day = localDateStr(), rows = tdyTasks();
  var tasks = tdyTasksHtml(rows), recent = tdyRecentHtml();
  var inputs = tdyInputsHtml(day, { shut: !_isDesktop && rows.some(function(r) { return r.tone === 'red'; }) });
  if (_isDesktop) {
    var floor = tdySees('pageFloor') ? tdyFloorHtml(day) : '';
    el.innerHTML = '<div class="inv-panels inv-panels-3" data-tdy-grid>' + tasks.replace('class="inv-hero-stack"', 'class="inv-hero-stack inv-panels-wide"') + inputs + floor + recent + '</div>';
    uiMasonry(el.querySelector('[data-tdy-grid]'));
  } else el.innerHTML = inputs + tasks + recent;
}
/* The last invoices made, each a tap from its print preview (owner, 6 Oct 2026: *"earlier we used to see the recently created
   invoices for quick print, now to print a recent invoice is 4 clicks"*: the list had gone to Pulse, under the questions). A hero
   in the theme's colour: the latest invoice and its figure, opening to the five with their print buttons. */
var TDY_RECENT = 5;
function tdyRecentHtml() {
  if (!tdySees('pageRegister')) return '';
  var list = homeRecentInvoices(TDY_RECENT);
  if (!list.length) return '';
  return uiHeroHtml(Object.assign(tdyRecentHead(list), { fold: 'tdy-recent', open: true,
    body: '<div class="inv-hero-sheet">' + list.map(homeRecentRowHtml).join('') +
      '<div class="inv-row"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invSwitchTab" data-tab="pageRegister">All invoices</button></div></div>',
    attrs: ' data-card="recent" data-verdict' }));
}
/* The head of a card of recent invoices: what was made today and its total, else when the last was made. The rows under it name
   each invoice, the newest first, so the head does not name the newest again (the survey of 8 Oct 2026). */
function tdyRecentHead(list) {
  // Every invoice dated today, not only those listed: the card lists five, and a day can make more.
  var today = localDateStr(), made = (S.invoices || []).filter(function(i) { return i.date === today && i.status !== 'cancelled'; });
  var sum = gstRound(made.reduce(function(t, i) { return t + (i.grandTotal || 0); }, 0)), last = list[0];
  return { eyebrow: '<span>Recent invoices</span><span class="inv-panel-count">' + list.length + '</span>',
    title: escHtml(made.length ? todoPlural(made.length, 'invoice') + ' made today' : last ? 'The last made ' + formatDate(last.date) : 'No invoices yet'),
    fig: made.length && tdySeesMoney() ? figWrapHtml(escHtml(formatCurrency(sum))) : '' };
}
/* ---------- Home, the dashboard (docs/UI_PASS_3.md §8b, §8c) ----------
   The day card leads (Home's verdict), then one toolbar row, then the board of widgets (widgets.js), then the foot's door to the
   gallery. The questions Pulse asked are widgets now (widgetcards.js: q-*, dofirst, why, figures, pace); the moves worth most across
   them are worked out here once a draw (tdyFirstMoves), for the dofirst widget. */
var TDY_Q_WORD = { smooth: 'Running', money: 'Money', clients: 'Clients', plant: 'Capacity', cash: 'Cash', changed: 'What changed' };
/* The questions for the period the board shows, worked out once a book, a period and a person (wdgMemo). */
function tdyQuestions() {
  if (!tdySeesMoney()) return [];
  var per = typeof _statsPeriod === 'string' ? _statsPeriod : 'mtd';
  return wdgMemo('tdy-questions', function() {
    try { return advQuestions(statsPulseArgs(per)); } catch (e) { if (typeof errReport === 'function') errReport(e, 'render: Home questions'); return []; }
  });
}
/* The moves worth most across every question, best first: what to do first, before reading any answer. Each keeps the word of
   the question it came from. */
function tdyFirstMoves(qs, n) {
  var from = {}, all = [];
  (qs || []).forEach(function(q) { if (!q.inline) (q.moves || []).forEach(function(mv) { if (!from[mv.key]) { from[mv.key] = q.key; all.push(mv); } }); });
  return advRank(all, null).slice(0, n || 3).map(function(mv) { return { mv: mv, word: TDY_Q_WORD[from[mv.key]] }; });
}

/* The day card (§8b): the greeting and the date, the clock with the general shift's end under it, the weather now, and the first
   of what holds as its verdict, the next two as its facts. Its tone is the worst of them. A role without money reads only what
   it may (the forecast and the pace are money). */
function homeGreeting(now) {
  var h = now.getHours(), part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  var u = typeof grdUser === 'function' ? grdUser() : null, name = u && u.name ? String(u.name).trim().split(/\s+/)[0] : '';
  var day = now.toLocaleDateString('en-IN', { weekday: 'long' }) + ', ' + now.getDate() + ' ' + now.toLocaleDateString('en-IN', { month: 'long' });
  return 'Good ' + part + (name ? ', ' + name : '') + ' · ' + day;
}
/* The clock (9:42 AM, 2:00 PM: a clock keeps its minutes, where a roll's time drops ":00"), and the general shift's end: "General
   shift ends 5:00 PM · 7 h 18 min", or that it has ended. The shift is the roll's own (relay.js: 8:30 AM to 5:00 PM). */
function homeClockMin(m) { var h = Math.floor(m / 60) % 24, mm = m % 60; return (h % 12 || 12) + ':' + String(mm).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); }
function homeClockText(now) { return homeClockMin(now.getHours() * 60 + now.getMinutes()); }
function homeShiftText(now) {
  var m = now.getHours() * 60 + now.getMinutes(), end = RELAY_GENERAL_OUT, start = RELAY_GENERAL;
  if (m >= end) return 'The general shift has ended';
  if (m < start) return 'General shift starts ' + homeClockMin(start);
  var left = end - m, h = Math.floor(left / 60), mm = left % 60;
  return 'General shift ends ' + homeClockMin(end) + ' · ' + [h ? h + ' h' : '', mm ? mm + ' min' : ''].filter(Boolean).join(' ');
}
/* What may lead the day card, in the order it leads: each {tone, text, money}. */
function homeDayFacts() {
  var out = [], today = localDateStr(), money = tdySeesMoney();
  if (money && tdySees('pageFinance') && typeof finHasBank === 'function' && finHasBank()) {
    try {
      var fc = finForecast(60);
      if (fc && fc.overdrawn) out.push({ tone: 'danger', text: 'The bank account is overdrawn', money: true });
      else if (fc && fc.cross && isoDaysBetween(today, fc.cross) <= 14) out.push({ tone: 'danger', text: 'Cash dips below zero on ' + stockShortDate(fc.cross), money: true });
    } catch (e) { /* the forecast's own screen says what went wrong */ }
  }
  var red = tdyTasks().filter(function(r) { return r.tone === 'red'; }).length;
  if (red) out.push({ tone: 'danger', text: todoPlural(red, 'thing needs', 'things need') + ' you now' });
  if (tdySees('pageProduction') && typeof pltCapacity === 'function') {
    PROD_LINES.forEach(function(l) {
      try {
        var c = pltCapacity(l, null, true);
        if (c && c.n >= 2 && c.down.length * 2 >= c.n) out.push({ tone: 'danger', text: prodLineName(l) + ': ' + c.down.length + ' of ' + c.n + ' down' });
      } catch (e) { /* the plant register says what went wrong */ }
    });
  }
  if (money && tdySees('pageRegister') && typeof predMonthPace === 'function') {
    try {
      var p = predMonthPace();
      if (p && p.prevRev > 0) {
        var ahead = p.projRev >= p.prevRev;
        out.push({ tone: ahead ? 'ok' : 'warning', text: 'On pace for ' + formatInrShort(p.projRev) + ', ' + (ahead ? 'ahead of ' : 'behind ') + p.prevLabel, money: true });
      }
    } catch (e) { /* the pace's own widget says what went wrong */ }
  }
  return out;
}
var HOME_TONE_RANK = { danger: 3, warning: 2, ok: 1, info: 1, neutral: 0 };
function homeDayCardHtml() {
  var now = new Date(), facts = homeDayFacts(), lead = facts[0] || { tone: 'ok', text: 'Nothing needs you now' };
  var rest = facts.slice(1, 3), tone = [lead].concat(rest).map(function(f) { return f.tone; })
    .sort(function(a, b) { return (HOME_TONE_RANK[b] || 0) - (HOME_TONE_RANK[a] || 0); })[0] || 'ok';
  var open = tdyTasks().length;
  var links = ['<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invSwitchTab" data-tab="pageHome" data-v="needs" data-home-needs>Open Needs you' +
    (open ? ' · ' + open : '') + '</button>'];
  if (tdySees('pageReports')) links.push('<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invHomeReport">Make today’s report</button>');
  var wx = typeof feedWeatherNowHtml === 'function' ? feedWeatherNowHtml() : '';
  return uiVerdictHtml({ key: 'home-day', screen: homeGreeting(now), verdict: lead.text, tone: tone,
    fig: '<span class="inv-homeday-clock" data-home-clock>' + escHtml(homeClockText(now)) + '</span>' +
      '<span class="inv-homeday-shift" data-home-shift>' + escHtml(homeShiftText(now)) + '</span>',
    viz: wx ? '<span class="inv-homeday-wx" data-home-wx>' + wx + '</span>' : '',
    facts: rest.map(function(f) { return { text: f.text, tone: f.tone }; }), links: links, attrs: ' data-home-day' });
}
/* The day card drawn again in place (a task ticked on the board changes what leads it and its count), its clock running on. */
function homeDayRefresh() {
  var host = document.querySelector('#homeDash [data-home-daycard]');
  if (!host || !host.isConnected || typeof grdHeld === 'function' && grdHeld()) return;
  keepScroll(function() { host.innerHTML = homeDayCardHtml(); });
  homeClockTick();
}
/* The clock ticks on the minute while the dashboard is drawn and visible (§8b): it sets the two texts, waits to the next minute and
   then every 60 s, and stops when the page is hidden or Home is left; coming back sets them at once. Only the two texts change: no
   node is added, so nothing that watches the page is woken. */
var _homeClockT = null;
function homeClockTick() {
  var c = document.querySelector('#homeDash [data-home-clock]'), s = document.querySelector('#homeDash [data-home-shift]');
  if (!c || !c.isConnected) { homeClockStop(); return; }
  var now = new Date(), ct = homeClockText(now), st = homeShiftText(now);
  if (c.textContent !== ct) c.textContent = ct;
  if (s && s.textContent !== st) s.textContent = st;
}
function homeClockStart() {
  homeClockStop();
  homeClockTick();
  var wait = 60000 - (Date.now() % 60000);
  _homeClockT = setTimeout(function next() {
    homeClockTick();
    if (_homeClockT === null) return;
    _homeClockT = setTimeout(next, 60000 - (Date.now() % 60000));
  }, wait);
}
function homeClockStop() { if (_homeClockT) clearTimeout(_homeClockT); _homeClockT = null; }
document.addEventListener('visibilitychange', function() {
  if (document.hidden) { homeClockStop(); return; }
  var dash = document.getElementById('homeDash');
  if (dash && !dash.classList.contains('inv-hidden') && dash.closest('.inv-page-active')) homeClockStart();
});

/* The board's toolbar (§8c): the period (one with Stats'), Customise and More (Make a report, Open Stats, Reset Home). Arranging,
   the toolbar is Add a widget, Reset and Done, the one primary. A door the role does not open is not offered. */
function homeToolbarHtml() {
  if (wdgArrangeOn('home')) {
    return '<div class="inv-toolbar" data-home-toolbar data-arranging>' +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invWdgGallery" data-board="home">' + iconSvg('plus') + '<span>Add a widget</span></button>' +
      '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invWdgReset" data-board="home">Reset</button>' +
      '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invWdgDone" data-board="home">Done</button></div>';
  }
  var per = typeof _statsPeriod === 'string' ? _statsPeriod : 'mtd';
  return '<div class="inv-toolbar" data-home-toolbar>' +
    (tdySeesMoney() ? statsSeg('invStatsPeriod', 'period', { mtd: 'MTD', qtd: 'QTD', ytd: 'YTD', all: 'All' }, per, 'Period', false, 'inv-toolbar-item') : '') +
    (_isDesktop ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invWdgArrange" data-board="home" aria-label="Customise Home">' + iconSvg('widgets') + '<span>Customise</span></button>'
      : '<button class="inv-btn inv-btn-secondary inv-btn-icon" data-action="invWdgArrange" data-board="home" aria-label="Customise Home" title="Customise Home">' + iconSvg('widgets') + '</button>') +
    uiToolbarMoreHtml([tdySees('pageReports') && tdySeesMoney() ? { label: 'Make a report', action: 'invRptFromStats' } : null,
      tdySees('pageStats') ? { label: 'Open Stats', action: 'invSwitchTab', attrs: ' data-tab="pageStats"' } : null,
      { label: 'Reset Home', action: 'invWdgReset', attrs: ' data-board="home"' }], { icon: !_isDesktop }) + '</div>';
}
/* The dashboard drawn: the day card, the toolbar, the board, the foot. */
function renderHomeBoard() {
  var el = document.getElementById('homeDash');
  if (!el) return;
  if (typeof grdHeld === 'function' && grdHeld()) return;
  var n = wdgAddable('home');
  el.innerHTML = '<div data-home-daycard>' + homeDayCardHtml() + '</div>' + homeToolbarHtml() + '<div id="homeBoard"></div>' +
    (n && !wdgArrangeOn('home') ? '<div class="inv-wboard-foot" data-home-foot><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invWdgGallery" data-board="home">Add a widget · ' +
      n + ' to choose from</button></div>' : '');
  wdgBoardDraw(document.getElementById('homeBoard'), 'home');
  homeClockStart();
}
/* The view on screen: one of the two blocks shown. Leaving the dashboard stops its clock and its live widgets. */
function tdyApplyView() {
  var v = tdyView(), needs = document.getElementById('homeNeeds'), dash = document.getElementById('homeDash');
  if (needs) needs.classList.toggle('inv-hidden', v !== 'needs');
  if (dash) dash.classList.toggle('inv-hidden', v !== 'home');
  if (v !== 'home') { homeClockStop(); wdgLiveStop('home'); if (wdgArrangeOn('home')) wdgArrangeDone(true); }
}

function tdyAction(action, btn) {
  switch (action) {
    case 'invTdyInput': tdyOpenInput(btn.dataset.k); return true;
    case 'invTdyPaste': if (typeof addOpen === 'function') addOpen(); else relayOpen(); return true;
    case 'invTdyHand': flrOpenLine(btn.dataset.line || 'vat-a1'); prodOpenHand(null, null, true); return true;
    case 'invTdyFloor': flrSetDay(null); switchTab('pageFloor'); return true;
    case 'invTdyPower': powerSetTab('cuts'); switchTab('pagePower'); return true;
    // The day card's link: today's report (the daily kind on today), on Reports.
    case 'invHomeReport': rptSet('daily', localDateStr()); switchTab('pageReports'); return true;
  }
  return false;
}
