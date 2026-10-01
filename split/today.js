/* ===== TODAY: NEEDS YOU AND PULSE (Direction B, step 3; P135) =====
   Owner, 1 Oct 2026 (docs/DIRECTION_B.md): Home becomes Today, two views of pageHome.
   - Needs you, the inbox:
     - the day's inputs, each saying whether it is in and, if not, when it usually arrives, with the one tap that brings it
       (Add's paste box, the register photo);
     - on the desktop, the floor now;
     - every open task, grouped Now / This week / Later, each with its one-tap move.
   - Pulse: the six questions with what to do (advice.js), then the widgets the owner arranged (tabs.js), with Edit.

   The views are pageHome's own `v` (?tab=pageHome&v=pulse). The shell (workspace.js) draws their tabs once homeViews
   says they exist, and nav.js reads and applies the view. Nothing here is stored and nothing is worked out twice: each
   figure comes from the function its own screen uses (attDaySummary, prodDayLoads, prodDayLine, powerCuts, todoRanked,
   advTaskMoves, advPulseHtml). What a role may not open is not offered (guard.js): a task whose move lands on a refused
   page is left out, and Pulse's money is the finance permission's. */

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
   pasted when that was the same day. Null when neither says (a message pasted days later with no header). */
function tdyArrival(text, at, day) {
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
      tdyRolls(k === 'roll-in' ? 'in' : 'out', d).forEach(function(p) { var a = tdyArrival(p.text, p.at, d); if (a != null && (m == null || a < m)) m = a; });
    } else if (k === 'pickling') {
      prodDayLoads(d).forEach(function(e) { var a = relayParseHhmm(e.time); if (a != null && (m == null || a < m)) m = a; });
    } else if (k === 'stock') {
      tdyStockMsgs(d).forEach(function(p) { var a = tdyArrival(p.text, p.at, d); if (a != null && (m == null || a < m)) m = a; });
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
      var a = rolls.map(function(p) { return tdyArrival(p.text, p.at, day); }).filter(function(x) { return x != null; });
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
  if (o.state === 'in') return o;
  var u = tdyUsual(def.k, day);
  o.usual = u.min;
  if (off) { o.state = 'off'; o.text = 'Not expected: ' + (new Date(day + 'T00:00:00').getDay() === 0 ? 'Sunday' : 'a paid holiday'); return o; }
  var due = Math.max(def.from || 0, 0);
  if (isToday && now < due) { o.state = o.state === 'part' ? 'part' : 'wait'; o.text = o.text || 'After ' + relayClockLabel(due); return o; }
  var late = now > u.min + TDY_LATE_MIN;
  var usualText = 'usually by ' + relayClockLabel(u.min) + (u.seen >= TDY_MIN_SEEN ? '' : ' (the shop’s usual time)');
  o.text = (o.text ? o.text + ' · ' : 'Not in yet · ') + usualText;
  if (late) o.state = 'late';
  else if (o.state !== 'part') o.state = 'wait';
  return o;
}
var TDY_STATE_DOT = { in: ['ok', 'In'], part: ['neutral', 'Part'], wait: ['neutral', 'Not yet'], late: ['warning', 'Late'], off: ['neutral', 'Not expected'] };

function tdyInputsHtml(day) {
  var rows = TDY_INPUTS.map(function(def) { return tdyInput(def, day); });
  var n = rows.filter(function(r) { return r.state === 'in'; }).length;
  var h = '<div class="inv-panel inv-panel-flush" data-card="inputs"><div class="inv-panel-head"><span class="inv-panel-title">The day&rsquo;s inputs ' +
    '<span class="inv-panel-count" data-tdy-in>' + n + ' of ' + rows.length + ' in</span></span>' +
    '<span class="inv-row-meta">' + escHtml(attDayName(day) + ' ' + formatDate(day)) + '</span></div>';
  rows.forEach(function(r) {
    var dot = TDY_STATE_DOT[r.state] || TDY_STATE_DOT.wait;
    var btn = '';
    if (r.state !== 'in' && r.state !== 'off') {
      btn = r.move === 'photo'
        ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invTdyPhoto" data-line="' + escHtml(tdyFirstMissingLine(r)) + '">Photo</button>'
        : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invTdyPaste">Paste</button>';
    }
    h += '<div class="inv-row inv-row-2 inv-row-flow" data-tdy-input="' + r.k + '" data-state="' + r.state + '">' +
      '<button class="inv-row-main" data-action="invTdyInput" data-k="' + r.k + '"><span class="inv-row-title">' + escHtml(r.title) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(r.text) + '</span></button>' +
      '<span class="inv-row-end inv-row-actions inv-toolbar inv-toolbar-tight">' + uiDot(dot[0], dot[1]) + btn + '</span></div>';
  });
  return h + '</div>';
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
  else if (k === 'stock') { _stockView = 'overview'; switchTab('pageStock'); }
  else if (k === 'production') { if (tdySees('pageFloor')) { flrSetDay(null); switchTab('pageFloor'); } else flrOpenLine('vat-a1'); }
}

/* ---------- The floor now (the desktop) ----------
   Floor → Day in three lines and the power, as the mockup's desktop Today draws it: each line's staffing word, what it is
   running and what it has plated; the day's cuts. Read from floor.js' own functions. */
function tdyFloorHtml(day) {
  var att = attDaySummary(day), stats = areaStats(day, day), byArea = {};
  stats.rows.forEach(function(a) { byArea[a.id] = a; });
  var h = '<div class="inv-panel inv-panel-flush" data-card="floor"><div class="inv-panel-head"><span class="inv-panel-title">Floor now</span>' +
    '<button class="inv-btn-link" data-action="invTdyFloor">Open Floor</button></div>';
  FLR_LINES.filter(function(ln) { return ln.id !== 'pickling'; }).forEach(function(ln) {
    var st = flrStaffing(day, ln, byArea, att.marked), r = prodDayLine(day, ln.id), last = flrLatest(r.entries);
    var fig = r.nos > 0 ? Math.round(r.nos).toLocaleString('en-IN') + ' NOS' : r.kg > 0 ? formatNum(r.kg, 0) + ' kg' : '';
    h += '<div class="inv-row inv-row-2" data-tdy-line="' + ln.id + '"><button class="inv-row-main" data-action="invTdyFloor">' +
      '<span class="inv-row-title">' + escHtml(flrLineName(ln.id)) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(last ? prodEntryTitle(last) : 'No record yet today') + '</span></button>' +
      '<span class="inv-row-end inv-row-stack">' + uiDot(st.tone, escHtml(st.word)) + (fig ? '<span class="inv-num">' + escHtml(fig) + '</span>' : '') + '</span></div>';
  });
  var cuts = powerCuts(day, day), mins = cuts.reduce(function(s, c) { return s + (c.min || 0); }, 0);
  h += '<div class="inv-row inv-row-2" data-tdy-line="power"><button class="inv-row-main" data-action="invTdyPower"><span class="inv-row-title">Power</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml(cuts.length ? cuts.map(function(c) { return powerClock(c.from) + (c.to != null ? ' – ' + powerClock(c.to) : ', no time back'); }).join(', ') : 'No cut reported') + '</span></button>' +
    '<span class="inv-row-end inv-row-stack">' + (cuts.length ? uiDot('warning', todoPlural(cuts.length, 'cut')) + (mins ? '<span class="inv-num">' + escHtml(powerDur(mins)) + '</span>' : '') : uiDot('ok', 'None')) + '</span></div>';
  return h + '</div>';
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
/* The task's one-tap move: its first move (advice.js), else its own button. */
function tdyTaskMoveHtml(t) {
  var mv = typeof advTaskMoves === 'function' ? advTaskMoves(t) : [];
  var m = mv.filter(function(x) { return x.href || (x.go && tdySees(tdyTaskPage({ go: x.go }) || 'pageHome')); })[0];
  if (m) {
    _advMoves[m.key] = m;
    return m.href ? '<a class="inv-btn inv-btn-secondary inv-btn-sm" href="' + escHtml(m.href) + '" data-adv-call>' + escHtml(m.hrefLabel || 'Call') + '</a>'
      : '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAdvGo" data-key="' + escHtml(m.key) + '" title="' + escHtml(m.say) + '">' + escHtml(m.goLabel || 'Open') + '</button>';
  }
  return t.goLabel ? '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invTodoGoApp" data-key="' + escHtml(t.key) + '">' + escHtml(t.goLabel) + '</button>' : '';
}
function tdyAppRowHtml(t) {
  var ws = tdyTaskWs(t);
  return '<div class="inv-row inv-row-2 inv-row-flow" data-todo="app" data-tdy-task="' + escHtml(t.key) + '" data-tone="' + escHtml(t.tone || '') + '">' +
    '<span class="inv-row-lead">' + todoGlyph(t.tone) + '</span>' +
    '<button class="inv-row-main" data-action="invTodoOpenApp" data-key="' + escHtml(t.key) + '"><span class="inv-row-title inv-row-wrap">' + escHtml(t.title) + '</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml([t.sub, ws].filter(Boolean).join(' · ')) + '</span></button>' +
    '<span class="inv-row-end inv-row-actions">' + tdyTaskMoveHtml(t) + '</span></div>';
}
function tdyTasks() {
  return todoRanked().filter(function(r) { return !r.app || !tdyTaskPage(r.app) || tdySees(tdyTaskPage(r.app)); });
}
function tdyTasksHtml() {
  var rows = tdyTasks(), groups = { now: [], week: [], later: [] };
  rows.forEach(function(r) { groups[tdyGroupOf(r)].push(r); });
  var h = '<div class="inv-panel inv-panel-flush inv-panels-wide" data-card="tasks"><div class="inv-panel-head"><span class="inv-panel-title">Needs you' +
    (rows.length ? ' <span class="inv-panel-count" data-tdy-count>' + rows.length + '</span>' : '') + '</span>' +
    '<button class="inv-btn-link" data-action="invSwitchTab" data-tab="pageTodo">' + (rows.length ? 'To-do list' : 'Add a task') + '</button></div>';
  if (!rows.length) return h + '<div class="inv-row" data-tdy-none><span class="inv-row-main">' + uiDot('ok', 'Nothing needs you') + '</span></div></div>';
  TDY_GROUPS.forEach(function(g) {
    var list = groups[g[0]];
    if (!list.length) return;
    h += '<div class="inv-row-group" data-tdy-group="' + g[0] + '"><span>' + g[1] + '</span><span class="inv-num">' + list.length + '</span></div>';
    h += uiMoreHtml('tdy-' + g[0], list.map(function(r) { return r.app ? tdyAppRowHtml(r.app) : todoMineRowHtml(r.mine); }), { n: TDY_SHOW, noun: list.length - TDY_SHOW === 1 ? 'task' : 'tasks' });
  });
  return h + '</div>';
}

/* ---------- Drawing ---------- */
function renderNeeds() {
  var el = document.getElementById('homeNeeds');
  if (!el) return;
  var day = localDateStr();
  var h = '<div class="inv-panels">' + tdyInputsHtml(day);
  if (_isDesktop && tdySees('pageFloor')) h += tdyFloorHtml(day);
  el.innerHTML = h + tdyTasksHtml() + '</div>';
}
/* Pulse: the questions, read for the period Stats shows (statsPulseArgs), then the widgets. Without the finance permission
   there are no questions: every one of them reads money. */
function renderPulseQuestions() {
  var el = document.getElementById('homeQuestions');
  if (!el) return;
  if (!tdySeesMoney()) { el.innerHTML = ''; return; }
  var per = typeof _statsPeriod === 'string' ? _statsPeriod : 'mtd';
  var html = '';
  try { html = advPulseHtml(per); } catch (e) { html = ''; if (typeof errReport === 'function') errReport(e, 'render: Pulse'); }
  el.innerHTML = '<div class="inv-panel-head inv-mb-8" data-tdy-pulse-head><span class="inv-panel-title">' + escHtml(tdyCap(ADV_PERIOD_WORDS[per] || 'this month')) + '</span>' +
    '<button class="inv-btn-link" data-action="invSwitchTab" data-tab="pageStats">Insights</button></div>' +
    (html ? '<div class="inv-panels" data-tdy-questions>' + html + '</div>' : '<div class="inv-empty">The questions could not be worked out: Insights → Stats has the figures.</div>');
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
