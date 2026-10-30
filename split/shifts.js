/* ===== Shifts by line =====
   Owner, 29 Oct 2026: a night shift on VAT A1 from that day, "Build it as a schedule per line with a start date, read by
   attendance, pay, EXTRA, production, efficiency, power, capacity and the planner". Nothing about the shop is in the build:
   every schedule is the book's (S.lineShifts), typed by the owner in Settings → Labour → Shifts by line.

   A schedule is one line's from a day: the night (its start and end on the clock, past midnight; when the crew stops plating;
   the break inside it, minutes, taken at no fixed time), the crew it needs by area (the line's own hands and the pickling
   hands it pulls), and a spare who covers an absence and books no shortfall. The schedule in force on a day is the latest
   whose first day is on or before it (and whose last day, where set, is on or after it). A night is the day it starts on.

   The barrel's schedule is its running hours instead (owner: "Barrel: on 06:00–20:00; 06:00–08:30 and 17:00–20:00 count as
   running time with no crew"), with the EXTRA booked for loading or unloading in those windows: hours for one barrel, for
   two to four, and for five or six.

   What reads it: Staff's roll reader (a night heading starts at the schedule's start; a hand on the night with no other
   mark is in at it), the general shift's heads (a mark in from 4 PM is the night's, never the general shift's), the Areas
   card (a night block's norm is the schedule's crew), the To-do (a night short of its crew, a hand on two shifts back to
   back), Production's efficiency (the night judged against its plating time less the break; the barrel's whole running
   day), the register reader (a night page's times read on the night's clock), Power (a cut in the night is in working
   hours), Stats' capacity and the planner. Pay needs nothing of it: 6 PM to 6 AM is 12 hours by the roll's own rule, a
   monthly hand's 4 of them overtime, an hourly hand's all at the hour's rate, the night snack for a night past midnight. */

var SHIFT_NIGHT_IN = 960;   // 4 PM: a hand in from here came for the night, not the general shift
var SHIFT_LINES = [['vat-a1', 'VAT A1'], ['vat-a2', 'VAT A2'], ['barrel', 'Barrel']];

function lineShifts() { return Array.isArray(S && S.lineShifts) ? S.lineShifts.filter(function(x) { return x && x.line && x.from && !x.voidedAt; }) : []; }
function shiftLineName(line) { var l = SHIFT_LINES.find(function(x) { return x[0] === line; }); return l ? l[1] : line; }
/* The schedule a line works to on a day, or null. */
/* A night or a running day is not worked on a Sunday (owner, 29 Oct 2026: the night shift does not run Sunday night) unless its
   schedule says so, nor on a day the plant is shut (Home's Plant shut…, flowCfg.holidays). */
function _shiftDayOff(x, iso) {
  if (new Date(iso + 'T00:00:00').getDay() === 0 && !x.sunday) return true;
  var h = S && S.flowCfg && Array.isArray(S.flowCfg.holidays) ? S.flowCfg.holidays : [];
  return h.indexOf(iso) >= 0 || h.indexOf(iso.slice(5)) >= 0;
}
function lineShiftOn(line, iso) {
  var best = null;
  lineShifts().forEach(function(x) {
    if (x.line !== line || x.from > iso || (x.to && x.to < iso)) return;
    if (!best || x.from > best.from) best = x;
  });
  return best;
}
/* A line's night on a day, on the day's clock (minutes from midnight; the end past 1440), or null where the line has none. */
function lineNightOn(line, iso) {
  var x = lineShiftOn(line, iso);
  if (!x || x.line === 'barrel' || _shiftDayOff(x, iso)) return null;
  return shiftNightOf(x, iso);
}
/* A schedule's night on the clock, whatever the day (the planner reads the schedule in force, Sundays and shut days aside). */
function shiftNightOf(x, iso) {
  if (!x || x.line === 'barrel') return null;
  var line = x.line;
  var a = relayParseHhmm(x.start), b = relayParseHhmm(x.end);
  if (a == null || b == null) return null;
  if (b <= a) b += 1440;
  var stop = relayParseHhmm(x.stop);
  if (stop == null) stop = b; else if (stop <= a) stop += 1440;
  if (stop > b) stop = b;
  var brk = Math.max(0, Number(x.breakMin) || 0), crew = {}, need = 0;
  Object.keys(x.crew || {}).forEach(function(k) { var n = Math.max(0, Math.round(Number(x.crew[k]) || 0)); if (n) { crew[k] = n; need += n; } });
  return { line: line, iso: iso, entry: x, start: a, end: b, stop: stop, breakMin: brk, plateMin: Math.max(0, stop - a - brk),
    paidMin: b - a, crew: crew, need: need, spare: Math.max(0, Math.round(Number(x.spare) || 0)) };
}
/* The lines with a night on a day. */
function nightLinesOn(iso) { return SHIFT_LINES.map(function(l) { return lineNightOn(l[0], iso); }).filter(Boolean); }
/* Where a night heading on a roll starts and ends, for the lines it names (any line with a night where it names none):
   the earliest of their nights, or null where no line has one that day. */
function shiftNightFor(iso, areas) {
  // A heading naming only the barrel's side is never a VAT line's night (Castor H-1, L-1).
  if ((areas || []).length && (areas || []).every(function(a) { return a === 'barrel' || a === 'pickling-barrel'; })) return null;
  var lines = (areas || []).map(function(a) { return a === 'pickling-vat' ? 'vat-a1' : a; }).filter(function(a) { return a === 'vat-a1' || a === 'vat-a2'; });
  var n = nightLinesOn(iso).filter(function(o) { return !lines.length || lines.indexOf(o.line) >= 0; });
  if (!n.length) return null;
  n.sort(function(p, q) { return p.start - q.start; });
  return n[0];
}
/* The barrel's running day on a day: { from, to, windows: [[a, b], …] with no crew, extra: {one, few, many} } or null. */
function barrelRunOn(iso) {
  var x = lineShiftOn('barrel', iso);
  if (!x || _shiftDayOff(x, iso)) return null;
  var a = relayParseHhmm(x.runFrom), b = relayParseHhmm(x.runTo);
  if (a == null || b == null || b <= a) return null;
  var wins = [];
  if (a < RELAY_GENERAL) wins.push([a, RELAY_GENERAL]);
  if (b > RELAY_GENERAL_OUT) wins.push([RELAY_GENERAL_OUT, b]);
  var num = function(v, d) { var n = Number(v); return v === '' || v == null || !isFinite(n) || n < 0 ? d : n; };
  return { entry: x, from: a, to: b, windows: wins, extra: { one: num(x.extraOne, null), few: num(x.extraFew, null), many: num(x.extraMany, null) } };
}
/* The EXTRA a barrel window's loading or unloading books, for the barrels handled in it: null where not set. */
function barrelWindowExtra(run, barrels) {
  if (!run || !(barrels > 0)) return null;
  var e = run.extra;
  return barrels === 1 ? e.one : barrels <= 4 ? e.few : (e.many != null ? e.many : e.few);
}

/* A mark of a hand who came in for the night, not the general shift: in from 4 PM, on a day a line has a night whose areas hold the
   mark's (with no day given, while any schedule is set). Before any night was scheduled an evening hand stays a general-shift head,
   as the Areas card has always counted (Castor L-2). */
function attMarkOnNight(m, iso) {
  if (!(m && (m.st === 'P' || m.st === 'H') && m.inMin != null && Number(m.inMin) >= SHIFT_NIGHT_IN)) return false;
  if (!iso) return lineShifts().some(function(x) { return x.line !== 'barrel'; });
  return nightLinesOn(iso).some(function(n) { return Object.keys(n.crew).concat(n.line, 'pickling-vat').indexOf(m.area) >= 0; });
}
/* Whether a block is a line's scheduled night on its day: a night slot (attBlockSlot) on a line with a night, or one naming
   no line on a day one line has. */
function shiftBlockNight(x, iso) {
  if (!x || x.kind !== 'block' || attBlockSlot(x) == null) return null;
  var a = relayParseHhmm(x.from);
  if (a == null || (a < SHIFT_NIGHT_IN && a >= 240)) return null;
  var n = shiftNightFor(iso, _attBlockAreas(x));
  // From an hour before the night's start, or past midnight: an evening block that ends before the night begins is the
  // evening's overtime, not the night.
  if (!n || (a >= 240 && a < n.start - 60)) return null;
  // It reaches past midnight, or covers most of the night: an evening block of 5 to 8 PM is the evening's overtime (Castor H-1).
  var b = relayParseHhmm(x.to);
  if (a >= 240 && b != null && b > a) { var A = a, B = b; if (B - A < (n.end - n.start) / 2) return null; }
  return n;
}

/* Who stood the night on a line: the hands whose mark is the night's on the line or its pickling, and the crew of the night's
   blocks on it, each once. → { night, heads, byArea: {area: n}, ids: [...], short, over } or null with no night that day. */
function shiftNightCrew(iso, line) {
  var night = lineNightOn(line, iso);
  if (!night) return null;
  var rec = (S.attendance || {})[iso], seen = {}, byArea = {};
  var put = function(id, area) { id = String(id); if (seen[id]) return; seen[id] = true; byArea[area] = (byArea[area] || 0) + 1; };
  var mine = Object.keys(night.crew);
  if (!mine.length) mine = [line, line === 'vat-a1' || line === 'vat-a2' ? 'pickling-vat' : 'pickling-barrel'];
  if (rec) {
    Object.keys(rec.marks || {}).forEach(function(id) {
      var m = rec.marks[id];
      if (!m || mine.indexOf(m.area) < 0) return;
      // In for the night, or a day hand whose out runs past midnight on the night's areas (an untagged night books no block row).
      if (attMarkOnNight(m, iso) || ((m.st === 'P' || m.st === 'H') && Number(m.outMin) > 1440)) put(id, m.area);
    });
    (rec.extra || []).forEach(function(x) {
      var n = shiftBlockNight(x, iso);
      if (!n || n.line !== line || !Array.isArray(x.crew)) return;
      var areas = _attBlockAreas(x);
      x.crew.forEach(function(c) {
        var m = rec.marks && rec.marks[c], a = m && mine.indexOf(m.area) >= 0 ? m.area : areas.find(function(z) { return mine.indexOf(z) >= 0; }) || line;
        put(c, a);
      });
    });
  }
  var heads = Object.keys(seen).length;
  return { night: night, recorded: !!rec, heads: heads, byArea: byArea, ids: Object.keys(seen),
    short: Math.max(0, night.need - heads), over: Math.max(0, heads - night.need - night.spare) };
}
/* Hands on two shifts back to back on a day: the general shift of the day after the night before, or the general shift and
   the night of the same day. → [{ id, name, kind: 'after' | 'same' }]. */
function shiftBackToBack(iso) {
  var out = [], rec = (S.attendance || {})[iso], prevIso = isoAddDays(iso, -1), prev = (S.attendance || {})[prevIso];
  var onNight = function(day, d) {
    var ids = {};
    nightLinesOn(d).forEach(function(n) { var c = shiftNightCrew(d, n.line); if (c) c.ids.forEach(function(id) { ids[id] = true; }); });
    return ids;
  };
  var general = function(m) { return m && (m.st === 'P' || m.st === 'H') && !attMarkOnNight(m, iso) && (m.inMin == null || Number(m.inMin) < 720); };
  if (!rec) return out;
  var lastNight = prev ? onNight(prev, prevIso) : {}, tonight = onNight(rec, iso);
  Object.keys(rec.marks || {}).forEach(function(id) {
    var m = rec.marks[id];
    if (!general(m)) return;
    var w = staffById(id), name = w ? w.name : id;
    if (lastNight[String(id)]) out.push({ id: id, name: name, kind: 'after' });
    else if (tonight[String(id)] && !(Number(m.outMin) > 0 && Number(m.outMin) <= SHIFT_NIGHT_IN)) out.push({ id: id, name: name, kind: 'same' });
  });
  return out;
}

/* ===== Settings → Labour → Shifts by line ===== */
function _shiftRowHtml(x, i) {
  x = x || {};
  var lineSel = '<select class="inv-input" id="setShLine' + i + '"><option value="">—</option>' + SHIFT_LINES.map(function(l) {
    return '<option value="' + l[0] + '"' + (x.line === l[0] ? ' selected' : '') + '>' + l[1] + '</option>';
  }).join('') + '</select>';
  var t = function(id, v) { return '<input type="time" class="inv-input inv-id" id="' + id + i + '" value="' + escHtml(v || '') + '">'; };
  var n = function(id, v) { return _sNum(id + i, v == null ? '' : v, 1, 0); };
  var crew = x.crew || {};
  return '<div class="inv-callout inv-callout-neutral inv-mt-8" data-shift-row="' + i + '"><div class="inv-field-label">' + (x.from ? escHtml(shiftLineName(x.line) + ' from ' + formatDate(x.from)) : 'Add a schedule') + '</div>' +
    _sRow(_sfg('Line', 'setShLine' + i, lineSel), _sfg('From', 'setShFrom' + i, '<input type="date" class="inv-input inv-id" id="setShFrom' + i + '" value="' + escHtml(x.from || '') + '">', 'blank takes the row off'),
      _sfg('To (blank: open)', 'setShTo' + i, '<input type="date" class="inv-input inv-id" id="setShTo' + i + '" value="' + escHtml(x.to || '') + '">')) +
    _sRow(_sfg('Night from', 'setShStart' + i, t('setShStart', x.start)), _sfg('Night to', 'setShEnd' + i, t('setShEnd', x.end)),
      _sfg('Plating stops', 'setShStop' + i, t('setShStop', x.stop)), _sfg('Break, minutes', 'setShBreak' + i, n('setShBreak', x.breakMin))) +
    _sRow(_sfg('Crew on the line', 'setShCrewL' + i, n('setShCrewL', x.line ? crew[x.line] : null)), _sfg('Crew on pickling', 'setShCrewP' + i, n('setShCrewP', crew['pickling-vat'] != null ? crew['pickling-vat'] : crew['pickling-barrel'])),
      _sfg('Spare', 'setShSpare' + i, n('setShSpare', x.spare))) +
    _sRow(_sfg('Barrel runs from', 'setShRunFrom' + i, t('setShRunFrom', x.runFrom)), _sfg('to', 'setShRunTo' + i, t('setShRunTo', x.runTo)),
      _sfg('EXTRA a window, 1 barrel (h)', 'setShExOne' + i, n('setShExOne', x.extraOne)), _sfg('2 to 4 (h)', 'setShExFew' + i, n('setShExFew', x.extraFew)),
      _sfg('5 or 6 (h)', 'setShExMany' + i, n('setShExMany', x.extraMany))) +
    '<label class="inv-field-check"><input type="checkbox" class="inv-check" id="setShSun' + i + '"' + (x.sunday ? ' checked' : '') + '> Runs on Sundays too</label>' +
    _sfg('Note', 'setShNote' + i, '<input class="inv-input" id="setShNote' + i + '" value="' + escHtml(x.note || '') + '">', 'the material it runs, the rotation') +
    '</div>';
}
function shiftSummary() {
  var l = lineShifts();
  if (!l.length) return escHtml('none set: every line on the general shift');
  var today = localDateStr();
  var now = SHIFT_LINES.map(function(z) {
    var x = lineShiftOn(z[0], today) || l.filter(function(y) { return y.line === z[0] && y.from > today; }).sort(function(a, b) { return a.from.localeCompare(b.from); })[0];
    if (!x) return '';
    return z[1] + (x.line === 'barrel' ? ' on ' + (x.runFrom || '?') + '–' + (x.runTo || '?') : ' night ' + (x.start || '?') + '–' + (x.end || '?')) + (x.from > today ? ' from ' + formatDate(x.from) : '');
  }).filter(Boolean);
  return escHtml(now.join(' · ') || l.length + ' set, none in force today');
}
function shiftSettingsBody() {
  var l = _shiftRowsShown();
  var rows = l.map(function(x, i) { return _shiftRowHtml(x, i); }).join('') + _shiftRowHtml(null, l.length);
  var since = lineShifts().map(function(x) { return x.from; }).sort()[0];
  return rows + '<div class="inv-field-hint">A night line takes the night’s times, its crew and spare; the barrel takes its running hours and its EXTRA. A later From starts a new schedule; the one before it stands up to that day.</div>' +
    (since ? '<button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invShiftReread">Read the rolls again from ' + escHtml(formatDate(since)) + '</button>' : '');
}
function _shiftRowsShown() {
  return (S.lineShifts || []).filter(function(x) { return x && !x.voidedAt; }).slice().sort(function(a, b) { return String(a.line).localeCompare(String(b.line)) || String(a.from).localeCompare(String(b.from)); });
}
function shiftSettingsSave() {
  // The rows as drawn (Castor L-6: saved against the unsorted list, a row could take another's id).
  var l = _shiftRowsShown();
  var next = [], bad = '';
  for (var i = 0; i <= l.length; i++) {
    if (!document.getElementById('setShLine' + i)) continue;
    var line = _sVal('setShLine' + i), from = _sVal('setShFrom' + i);
    if (!line || !from) continue;
    var v = function(id) { return String(_sVal(id + i) || '').trim(); };
    var num = function(id) { var s = v(id); return s === '' ? null : Math.max(0, Number(s)); };
    var sun = document.getElementById('setShSun' + i);
    var x = { id: (l[i] && l[i].line === line && l[i].from === from && l[i].id) || ('ls' + Date.now().toString(36) + i), line: line, from: from, to: v('setShTo') || '', note: v('setShNote'), sunday: !!(sun && sun.checked) };
    if (x.to && x.to < x.from) { bad = shiftLineName(line) + ': its last day is before its first'; break; }
    if (line === 'barrel') {
      x.runFrom = v('setShRunFrom'); x.runTo = v('setShRunTo');
      x.extraOne = num('setShExOne'); x.extraFew = num('setShExFew'); x.extraMany = num('setShExMany');
      if (!x.runFrom || !x.runTo) { bad = 'Barrel from ' + formatDate(from) + ': set the hours it runs'; break; }
    } else {
      x.start = v('setShStart'); x.end = v('setShEnd'); x.stop = v('setShStop'); x.breakMin = num('setShBreak') || 0;
      if (!x.start || !x.end) { bad = shiftLineName(line) + ' from ' + formatDate(from) + ': set when the night starts and ends'; break; }
      x.crew = {}; var cl = num('setShCrewL'), cp = num('setShCrewP');
      if (cl) x.crew[line] = cl;
      if (cp) x.crew['pickling-vat'] = cp;
      x.spare = num('setShSpare') || 0;
    }
    if (next.some(function(y) { return y.line === x.line && y.from === x.from; })) { bad = shiftLineName(line) + ' has two schedules from ' + formatDate(from); break; }
    var was = l[i];
    if (was && was.id === x.id) { x.at = was.at; x.by = was.by; }
    else { x.at = Date.now(); x.by = typeof grdUser === 'function' && grdUser() ? grdUser().name : ''; }
    next.push(x);
  }
  if (bad) { showToast(bad, 'error'); return false; }
  S.lineShifts = next;
}

/* Read the rolls again for every day from the earliest schedule's first day to today: a night heading then starts at the
   schedule's start, and a hand on the night with no other mark is in at it. What was typed by hand is kept, as on the day's
   own Read the rolls again. */
async function shiftRereadFrom() {
  var since = lineShifts().map(function(x) { return x.from; }).sort()[0];
  if (!since) return;
  if (!grdGate('floor', 'read the rolls again', shiftRereadFrom)) return;
  var today = localDateStr(), days = [];
  for (var d = since, g = 0; d <= today && g < 60; d = isoAddDays(d, 1), g++) if (relayDayHasRolls(d)) days.push(d);
  if (!days.length) { showToast('No day from ' + formatDate(since) + ' has rolls to read again', 'info'); return; }
  var ok = await uiConfirm({ title: 'Read the rolls again?', okLabel: 'Read again',
    body: 'The rolls of ' + days.map(formatDate).join(', ') + ' are read again as the reader reads them now, with the schedule. The marks and EXTRA rows the rolls wrote are replaced; ' +
      'what was entered or corrected by hand is kept, and each day as it is now goes to the log. A day whose rolls ask a question is left for you to read again on the day.' });
  if (!ok) return;
  var done = [], asks = [];
  days.forEach(function(d) {
    var r = relayRereadDay(d, 'read again with the shifts by line (Settings → Labour)');
    if (r === 'asks') asks.push(d); else if (r) done.push(d);
  });
  if (done.length) { saveState(); if (typeof tabRedrawActive === 'function') tabRedrawActive(); }
  var msg = (done.length ? 'Read again: ' + done.map(formatDate).join(', ') : 'Nothing read again') + (asks.length ? '. Read on the day (a name to place): ' + asks.map(formatDate).join(', ') : '');
  showToast(msg, asks.length ? 'info' : 'success');
}

/* ===== The To-do =====
   A night short of its crew, once the night is recorded: the EXTRA it books is the night's length a missing hand, which the
   Areas card checks against what was booked. And a hand on two shifts back to back (owner: "Flag a hand on two shifts back to
   back"): the general shift the day after a night, or the general shift and the night of one day. Both floor tasks. */
TODO_RULES.push(['nightShort', 'Night shift: a night short of its crew']);
TODO_CHECK_DEFAULTS.nightShort = true;
TODO_RULE_NEED.nightShort = 'floor';
TODO_RULE_FNS.nightShort = function() {
  var today = localDateStr(), out = [];
  for (var i = 1; i <= 7; i++) {
    var d = isoAddDays(today, -i);
    nightLinesOn(d).forEach(function(n) {
      var c = shiftNightCrew(d, n.line);
      if (!c || !c.recorded || !c.heads || !c.short) return;
      out.push({ d: d, n: n, c: c });
    });
  }
  if (!out.length) return [];
  var f = out[0];
  return [{ key: 'nightShort', rule: 'nightShort', tone: 'amber',
    title: out.length === 1 ? shiftLineName(f.n.line) + '’s night of ' + stockShortDate(f.d) + ' was ' + f.c.short + ' short of its crew' : todoPlural(out.length, 'night') + ' short of their crew',
    sub: out.slice(0, 3).map(function(o) { return shiftLineName(o.n.line) + ' ' + stockShortDate(o.d) + ' ' + o.c.heads + '/' + o.n.need; }).join(' · '),
    why: 'Attendance · the night’s crew against its schedule (Settings → Labour → Shifts by line)',
    facts: out.slice(0, 4).map(function(o) { return [shiftLineName(o.n.line) + ', ' + formatDate(o.d), o.c.heads + ' of ' + o.n.need + ': EXTRA ' + formatNum(o.c.short * Math.ceil(o.n.paidMin / 60), 0) + ' h to book'] ; }),
    clears: 'Clears itself when the night’s hands are on its roll or its block, or after a week.',
    go: { kind: 'staffDay', date: f.d }, goLabel: 'Open the day', sig: out.map(function(o) { return o.d + ':' + o.n.line + ':' + o.c.heads; }).join('|') }];
};
TODO_RULES.push(['nightTwice', 'Night shift: a hand on two shifts back to back']);
TODO_CHECK_DEFAULTS.nightTwice = true;
TODO_RULE_NEED.nightTwice = 'floor';
TODO_RULE_FNS.nightTwice = function() {
  if (!lineShifts().length) return [];
  var today = localDateStr(), out = [];
  for (var i = 0; i <= 6; i++) { var d = isoAddDays(today, -i); shiftBackToBack(d).forEach(function(x) { out.push(Object.assign({ d: d }, x)); }); }
  if (!out.length) return [];
  var say = function(x) { return x.kind === 'after' ? 'the general shift of ' + stockShortDate(x.d) + ' after the night before' : 'the general shift and the night of ' + stockShortDate(x.d); };
  return [{ key: 'nightTwice', rule: 'nightTwice', tone: 'amber',
    title: out.length === 1 ? out[0].name + ' worked two shifts back to back' : todoPlural(out.length, 'hand') + ' on two shifts back to back',
    sub: out.slice(0, 3).map(function(x) { return x.name + ' ' + stockShortDate(x.d); }).join(' · '),
    why: 'Attendance · the night and the general shift, hand by hand',
    facts: out.slice(0, 4).map(function(x) { return [x.name, say(x)]; }),
    clears: 'Clears itself when the day’s marks put the hand on one shift, or after a week.',
    go: { kind: 'staffDay', date: out[0].d }, goLabel: 'Open the day', sig: out.map(function(x) { return x.d + ':' + x.id + ':' + x.kind; }).join('|') }];
};

/* A block in the barrel's running windows on a day: the EXTRA its loading or unloading books for the barrels handled in it (the
   barrel batches loaded or unloaded inside the window, each barrel once), or null where the barrel has no running day, the block
   is not in a window, the barrels handled are not on record, or the hours are not set. */
function shiftBarrelWindowExpect(iso, x) {
  var run = barrelRunOn(iso);
  if (!run || !x || x.kind !== 'block') return null;
  var areas = _attBlockAreas(x);
  if (areas.indexOf('barrel') < 0 && areas.indexOf('pickling-barrel') < 0) return null;
  var a = relayParseHhmm(x.from), b = relayParseHhmm(x.to);
  if (a == null || b == null) return null;
  if (b <= a) b += 1440;
  var win = run.windows.find(function(w) { return a < w[1] && b > w[0]; });
  if (!win) return null;
  // Barrels, not batches: only a batch naming its barrel counts, each barrel once; one naming none leaves the window not checkable.
  // The morning's unloading is of batches loaded the evening before too.
  var seen = {}, unnamed = false, prevIso = isoAddDays(iso, -1);
  (typeof prodIndex === 'function' ? prodIndex().counted : []).forEach(function(e) {
    if (e.kind !== 'plated' || e.line !== 'barrel' || (e.date !== iso && e.date !== prevIso)) return;
    var t1 = relayParseHhmm(e.time), t2 = relayParseHhmm(e.to);
    var inside = function(t) { return t != null && t >= win[0] && t <= win[1]; };
    var hit = e.date === iso ? inside(t1) || inside(t2) : win[0] < RELAY_GENERAL && t2 != null && t1 != null && t2 < t1 && inside(t2);
    if (!hit) return;
    var b = e.unitId || e.barrel;
    if (b) seen[b] = true; else unnamed = true;
  });
  var n = Object.keys(seen).length, h = unnamed ? null : barrelWindowExtra(run, n);
  return h == null ? null : { hours: h, barrels: n, window: win };
}
