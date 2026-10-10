/* ===== TODAY: NEEDS YOU AND PULSE (Direction B, step 3; P135) =====
   Owner, 1 Oct 2026 (docs/DIRECTION_B.md): Home becomes Today, two views of pageHome.
   - Needs you, the inbox:
     - the day's inputs, each saying whether it is in and, if not, when it usually arrives, with the one tap that brings it
       (Add's paste box, the register photo);
     - on the desktop, the floor now;
     - the last five invoices, each with its print button;
     - every open task, grouped Now / This week / Later, each with its one-tap move.
   - Pulse: the six questions with what to do (advice.js), then the widgets the owner arranged (tabs.js), with Edit.

   The views are pageHome's own `v` (?tab=pageHome&v=pulse). The shell (workspace.js) draws their tabs once homeViews
   says they exist, and nav.js reads and applies the view. Nothing here is stored and nothing is worked out twice: each
   figure comes from the function its own screen uses (attDaySummary, prodDayLoads, prodDayLine, powerCuts, todoRanked,
   advTaskMoves, advQuestions, whyHtml, statsOverviewHtml, paceCardHtml). What a role may not open is not offered (guard.js): an input whose screen it does not open,
   a task it may not see (todo.js todoSees), and Pulse's money is the finance permission's. */

var TDY_VIEWS = [{ v: 'needs', label: 'Needs you' }, { v: 'pulse', label: 'Pulse' }];
var TDY_SHOW = 10;            // a group of tasks shows its first ten; the rest one tap away (uiMoreHtml)
var TDY_LATE_MIN = 45;        // an input this long past its usual time is amber
var TDY_LEARN_DAYS = 28;      // the usual time is read off the last four weeks
var TDY_MIN_SEEN = 3;         // under three days seen, the usual time is the shop's own (TDY_INPUTS' `usual`)
var _tdyView = 'needs';

/* The shell draws Today's two tabs once this says it has them (workspace.js, wsViewsPresent). */
function homeViews() { return TDY_VIEWS.slice(); }
function tdyView() { return _tdyView === 'pulse' ? 'pulse' : 'needs'; }
function tdySetView(v) { _tdyView = v === 'pulse' ? 'pulse' : 'needs'; }

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
   by 10, the production records by the evening (the register clerk's photos are mostly sent 4 to 6 PM), the out-time roll
   once the crews go home. `from` is when one is first looked for: the out-time roll is not late at noon. */
var TDY_INPUTS = [
  { k: 'roll-in', title: 'In-time roll', usual: 570, from: 0, move: 'paste' },
  { k: 'pickling', title: 'Pickling loads', usual: 600, from: 0, move: 'paste' },
  { k: 'stock', title: 'Stock message', usual: 600, from: 0, move: 'paste' },
  { k: 'production', title: 'Production records', usual: 1080, from: 0, move: 'photo' },
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
function tdyCap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }
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
      // The day's records are in when the last line's is: the latest photo read that day (a photo has no header).
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
    else if (have.length) { o.state = 'part'; o.text = have.join(', ') + ' in · ' + miss.join(', ') + ' not yet'; }
    // Only the barrel list missing: it comes as a message, not a photo.
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
var TDY_CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
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
      btn = r.move === 'photo'
        ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invTdyPhoto" data-line="' + escHtml(tdyFirstMissingLine(r)) + '">Photo</button>'
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
/* The first VAT line with no record (the register photo is theirs); else VAT A1. */
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
  return uiHeroHtml({ tone: worst || (open ? 'warning' : ''), eyebrow: '<span>Floor now</span>', title: att.marked ? escHtml(todoPlural(staffed, 'line') + ' staffed') : 'No attendance yet today',
    sub: escHtml(att.marked ? (att.p + att.half) + ' on site · ' + att.absent.length + ' absent' : 'The in-time roll says who stands where'), fold: 'tdy-floor', open: true,
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
  var titles = function(list) { return list.slice(0, 3).map(function(r) { return r.app ? r.app.title : r.mine.text; }).join(' · ') + (list.length > 3 ? ' · and ' + (list.length - 3) + ' more' : ''); };
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
  // What is typed outlives a redraw (a tick on a task redraws Needs you while the field holds half a task).
  var cur = document.getElementById('todoNew'), typed = cur ? cur.value : '';
  return '<div class="inv-toolbar" data-tdy-add><input class="inv-input inv-toolbar-item" id="todoNew" data-todo-new placeholder="Add a task…" aria-label="New task" autocomplete="off"' +
    (typed ? ' value="' + escHtml(typed) + '"' : '') + '>' +
    '<button class="inv-btn inv-btn-primary" data-action="invTodoAdd">Add</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invTodoNew">Details</button></div>';
}
function tdySnoozedHtml() {
  var td = todoData();
  var snoozed = todoAppAll().filter(function(t) { return todoIsSnoozed(t) && todoSees(t); }).concat(todoFolds().filter(todoIsSnoozed));
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
/* Pulse: the questions as hero tiles (§6.21), read for the period Stats shows (statsPulseArgs): each says its answer in a
   figure, a word and a small chart, and opens, across its row, to the whole story and what can be done about it. Then the
   moves worth most across every question, then what was Stats → Overview's (the tab map, TM2b): why the period moved, the
   period in one line and the month's pace, each a hero shut on the phone. Its head is the period, one with Stats', and More:
   Make a report, Open Stats, Edit Home. Without the finance permission there are no questions, since every one reads money, and
   the head is Edit Home alone. */
var TDY_Q_WORD = { smooth: 'Running', money: 'Money', clients: 'Clients', plant: 'Capacity', cash: 'Cash', changed: 'What changed' };
function renderPulseQuestions() {
  var el = document.getElementById('homeQuestions');
  if (!el) return;
  if (!tdySeesMoney()) {
    el.innerHTML = '<div class="inv-toolbar" data-tdy-pulse-head><button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invHomeEdit">Edit Home</button></div>';
    return;
  }
  var per = typeof _statsPeriod === 'string' ? _statsPeriod : 'mtd';
  var a = null, qs = [], cards = '';
  try { a = statsPulseArgs(per); qs = advQuestions(a); } catch (e) { qs = []; if (typeof errReport === 'function') errReport(e, 'render: Pulse'); }
  if (a) [function() { return whyHtml(per, a.filtered, a.prior); }, function() { return statsOverviewHtml(per, a.filtered, a.tonnage); }, paceCardHtml].forEach(function(f) {
    try { cards += f() || ''; } catch (e) { if (typeof errReport === 'function') errReport(e, 'render: Pulse'); }
  });
  // One toolbar row on both layouts (§1a-10): the period, and More with the rest (Edit Home was a toolbar at the foot).
  el.innerHTML = '<div class="inv-toolbar" data-tdy-pulse-head>' +
    statsSeg('invStatsPeriod', 'period', { mtd: 'MTD', qtd: 'QTD', ytd: 'YTD', all: 'All' }, per, 'Period', false, 'inv-toolbar-item') +
    uiToolbarMoreHtml([{ label: 'Make a report', action: 'invRptFromStats' }, { label: 'Open Stats', action: 'invSwitchTab', attrs: ' data-tab="pageStats"' },
      { label: 'Edit Home', action: 'invHomeEdit' }], { icon: !_isDesktop }) + '</div>' +
    (qs.length ? '<div class="inv-heroes" data-tdy-questions>' + qs.map(tdyQuestionHtml).join('') + '</div>' + tdyFirstHtml(qs)
      : '<div class="inv-empty">The questions could not be worked out: Stats has the figures.</div>') +
    (cards ? '<div class="inv-hero-stack" data-tdy-pulse-cards>' + cards + '</div>' : '');
}
function tdyQuestionHtml(x) {
  var v = x.vital || { fig: '', title: x.answer ? x.answer.say : '', sub: '', viz: '', tone: x.answer ? x.answer.tone : 'neutral' };
  var moves = '';
  // What you can do heads the moves, or says what would make one appear (an insight's moves are under its row: inline).
  if (!x.inline || !x.moves.length) {
    moves = '<div class="inv-hero-moves" data-tdy-moves><div class="inv-hero-eyebrow inv-mt-8 inv-mb-8" data-adv-head>What you can do' +
      (x.moves.length ? ' <span class="inv-panel-count">' + x.moves.length + '</span>' : '') + '</div>' +
      (x.moves.length ? advMovesDeckHtml(x.moves, 'q-' + x.key, ADV_SHOW) : '<div class="inv-note" data-adv-none>' + escHtml(x.none || 'Nothing to do here yet.') + '</div>') +
      (x.hints || []).map(function(t) { return '<div class="inv-note inv-mt-8" data-adv-hint>' + escHtml(t) + '</div>'; }).join('') + '</div>';
  }
  return uiHeroHtml({ tone: v.tone || 'neutral', vital: true, eyebrow: '<span>' + escHtml(x.q) + '</span>', fig: v.fig || '', title: v.title || '', sub: v.sub || '', viz: v.viz || '',
    fold: 'tdy-q-' + x.key, open: false, body: '<div class="inv-hero-sheet">' + x.html + '</div>' + moves, attrs: ' data-tdy-q="' + escHtml(x.key) + '" data-verdict' });
}
/* The moves worth most across every question, as cards: what to do first, before reading any answer. */
function tdyFirstHtml(qs) {
  var from = {}, all = [];
  qs.forEach(function(q) { if (!q.inline) (q.moves || []).forEach(function(mv) { if (!from[mv.key]) { from[mv.key] = q.key; all.push(mv); } }); });
  var top = advRank(all, null).slice(0, 3);
  if (!top.length) return '';
  var listed = advListedKeys();
  return uiHeroHtml({ eyebrow: '<span>Do first</span><span class="inv-panel-count">' + top.length + '</span>', title: 'The moves worth most',
    sub: 'Across every question above, by what each is worth a month; each question opens to its own', fold: 'tdy-first', open: true, attrs: ' data-card="first"',
    body: '<div class="inv-deck" data-adv-deck="first">' + top.map(function(mv) { return advMoveCardHtml(mv, listed, TDY_Q_WORD[from[mv.key]]); }).join('') + '</div>' });
}
/* The view on screen: one of the two blocks shown. */
function tdyApplyView() {
  var v = tdyView(), needs = document.getElementById('homeNeeds'), pulse = document.getElementById('homePulse');
  if (needs) needs.classList.toggle('inv-hidden', v !== 'needs');
  if (pulse) pulse.classList.toggle('inv-hidden', v !== 'pulse');
}

function tdyAction(action, btn) {
  switch (action) {
    case 'invTdyInput': tdyOpenInput(btn.dataset.k); return true;
    case 'invTdyPaste': if (typeof addOpen === 'function') addOpen(); else relayOpen(); return true;
    case 'invTdyPhoto': flrOpenLine(btn.dataset.line || 'vat-a1'); prodPhotoPick(); return true;
    case 'invTdyFloor': flrSetDay(null); switchTab('pageFloor'); return true;
    case 'invTdyPower': powerSetTab('cuts'); switchTab('pagePower'); return true;
  }
  return false;
}
