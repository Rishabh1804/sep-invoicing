/* ===== THE PLANT: every barrel and tank, its status, and what each line can do =====
   Owner, 7 Oct 2026 (docs/WORKERS_AND_PLANT.md, W1): *"a complete breakdown of the production area, like in Barrel - we have 3
   barrels operational, 3 barrels are not-operational. In VAT A1 - we have 4 tanks out of which 3 are operational and one is not,
   combined capacity of 100% running at 75%"*. The units of a line work side by side and each is measured in kg a round (owner).

   - A unit (`S.plant.units`) is a record of the shop, never of the build: its station (the planner's own ids: `vat-a1`, `vat-a2`,
     `barrel`, `pick`, and the supporting `lab`, `oven`, `power`, `etp`, `other`), its kg a round, its status (running, standby,
     down, under repair) since a day, why, its condition, what it needs, and a risk the planner's trials draw.
   - Every status change is a dated line in `S.plant.log`, so the days a unit stood down are measured, and the status on any
     past day is read back (`pltStatusOn`). A unit is retired with a reason, never deleted.
   - A line's capacity (`pltCapacity`): the units side by side, so what is available is the kg a round of the units running or
     on standby over all of them; with no kg a round typed on every unit it is by count, and says so. What the line actually
     plates a round is the planner's reading of the register (`plnBase().lines`), set against the available kg a round; a line
     with no register read says so, never a zero.
   - One register with the planner: its machines are units (`pltFromMachines` moves them once, their ids kept), and the planner
     reads them through `plnLive('machines')` (`pltMachines`).
   - The owner's alone to change (owner, 7 Oct 2026: *"me"*). */

var PLT_STATIONS = [['vat-a1', 'VAT A1', true], ['vat-a2', 'VAT A2', true], ['barrel', 'Barrel', true], ['pick', 'Pickling', true],
  ['lab', 'Lab', false], ['oven', 'Bake oven', false], ['power', 'Power', false], ['etp', 'Effluent', false], ['other', 'Other', false]];
var PLT_STATUS = [['run', 'Running', 'ok'], ['standby', 'Standby', 'info'], ['repair', 'Under repair', 'warning'], ['down', 'Down', 'danger']];
var PLT_KINDS = [['tank', 'Tank'], ['barrel', 'Barrel'], ['rectifier', 'Rectifier'], ['other', 'Other']];
// The planner's line ids, for a unit's risk: the line it stops when it fails.
var PLT_LINE_STATIONS = { 'vat-a1': 1, 'vat-a2': 1, barrel: 1 };
var PLT_DOWN_AMBER = 3, PLT_DOWN_RED = 7;

if (typeof STATE_CONTAINERS !== 'undefined' && STATE_CONTAINERS.indexOf('plant') < 0) STATE_CONTAINERS.push('plant');

/* ---------- The store ---------- */
function pltData() {
  if (!S.plant || typeof S.plant !== 'object' || Array.isArray(S.plant)) S.plant = {};
  if (!Array.isArray(S.plant.units)) S.plant.units = [];
  if (!Array.isArray(S.plant.log)) S.plant.log = [];
  return S.plant;
}
/* Read without writing: drawing never changes the book. */
function pltRead() {
  var p = S && S.plant && typeof S.plant === 'object' ? S.plant : {};
  return { units: Array.isArray(p.units) ? p.units : [], log: Array.isArray(p.log) ? p.log : [] };
}
function pltNameCmp(a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'en', { numeric: true }); }
function pltUnits(station) {
  return pltRead().units.filter(function(u) { return u && !u.retiredAt && (!station || u.station === station); }).sort(pltNameCmp);
}
/* The day a unit was retired (stamped as a time, or a day on an imported unit). */
function pltRetiredDay(u) { var r = u.retiredAt; return !r ? '' : typeof r === 'number' ? localDateStr(new Date(r)) : String(r).slice(0, 10); }
function pltUnitById(id) { return pltRead().units.find(function(u) { return u && u.id === id; }) || null; }
function pltStationName(id) { var s = PLT_STATIONS.find(function(x) { return x[0] === id; }); return s ? s[1] : id || 'Other'; }
function pltIsLine(id) { var s = PLT_STATIONS.find(function(x) { return x[0] === id; }); return !!(s && s[2]); }
function pltStatus(s) { return PLT_STATUS.find(function(x) { return x[0] === s; }) || PLT_STATUS[0]; }
function pltAvailable(status) { return status === 'run' || status === 'standby'; }
function pltWho() { return typeof grdUser === 'function' && grdUser() ? grdUser().name : ''; }
function pltId(pre) { return pre + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); }

/* The unit's status on a day, read off its log (the last change on or before the day); before its first line, what that line
   changed from (running, for a unit added that day); a unit with no line at all, its status now. */
function pltStatusOn(u, iso) {
  var all = pltRead().log.filter(function(l) { return l && l.unitId === u.id && l.to !== 'retired' && l.date; });
  if (!all.length) return u.status || 'run';
  all.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.at || 0) - (b.at || 0); });
  var on = all.filter(function(l) { return l.date <= iso; });
  if (!on.length) return all[0].from && pltStatus(all[0].from)[0] === all[0].from ? all[0].from : 'run';
  return on[on.length - 1].to;
}
/* The day of a unit's latest status line, or ''. */
function pltLastLogDate(u) {
  return pltRead().log.filter(function(l) { return l && l.unitId === u.id && l.date; }).reduce(function(m, l) { return l.date > m ? l.date : m; }, '');
}
/* Days a unit stood down or under repair between two days (inclusive), from its log. */
function pltDownDays(u, from, to) {
  var n = 0;
  for (var d = from; d <= to; d = isoAddDays(d, 1)) if (!pltAvailable(pltStatusOn(u, d))) n++;
  return n;
}
/* Days in the status it is in now. */
function pltDaysIn(u) { return u.since ? Math.max(0, isoDaysBetween(u.since, localDateStr())) : null; }

/* The day the register was set up: the first day a unit was written into it (the day of its first line's `at`). A unit written
   in that day is the plant as found, and stood before it: its "since" is the day it was recorded, not the day it came. The
   owner set the register up on 9 Oct 2026, the running units "since" that day and the stopped ones backdated to when they
   stopped, and every day before read only the stopped ones ("0 of 1 tanks working" on VAT A1, which runs three). A unit
   written in later is new, and counts from its first day. */
function pltRecordedOn(u) {
  var first = pltRead().log.filter(function(l) { return l && l.unitId === u.id && l.from == null && l.at; }).sort(function(a, b) { return a.at - b.at; })[0];
  return first ? isoOf(new Date(first.at)) : u.addedOn || '';
}
function pltSetUpDay() {
  return pltRead().units.reduce(function(m, u) { var d = u ? pltRecordedOn(u) : ''; return d && (!m || d < m) ? d : m; }, '');
}
/* What a line can do on a day: its units side by side.
   {units, n, nAvail, down: [units], byKg, kgTotal, kgAvail, pct, note, used: {kgRound, pct, why}}. `bare` leaves out what the
   line uses (prodTankLoad reads the units working each day, and is what pltUsed reads). */
function pltCapacity(station, iso, bare) {
  var day = iso || localDateStr();
  var setUp = iso ? pltSetUpDay() : '';
  var units = (iso ? pltRead().units.filter(function(u) { return u && u.station === station && (!u.retiredAt || pltRetiredDay(u) > day); }).sort(pltNameCmp) : pltUnits(station))
    .filter(function(u) { return !iso || !u.addedOn || u.addedOn <= day || (setUp && pltRecordedOn(u) === setUp); });
  var st = function(u) { return iso ? pltStatusOn(u, day) : u.status || 'run'; };
  var avail = units.filter(function(u) { return pltAvailable(st(u)); });
  var withKg = units.filter(function(u) { return +u.kgRound > 0; });
  var byKg = units.length > 0 && withKg.length === units.length;
  var kgTotal = withKg.reduce(function(s, u) { return s + (+u.kgRound); }, 0);
  var kgAvail = avail.filter(function(u) { return +u.kgRound > 0; }).reduce(function(s, u) { return s + (+u.kgRound); }, 0);
  var pct = !units.length ? null : byKg ? (kgTotal ? kgAvail / kgTotal : 0) : avail.length / units.length;
  var note = !units.length ? 'no unit recorded' : byKg ? 'by kg a round' : withKg.length ? 'by count: kg a round set on ' + withKg.length + ' of ' + units.length : 'by count: no kg a round set';
  var cap = { units: units, n: units.length, nAvail: avail.length, down: units.filter(function(u) { return !pltAvailable(st(u)); }), byKg: byKg, kgTotal: kgTotal, kgAvail: kgAvail, pct: pct, note: note, used: null };
  if (!bare) cap.used = pltUsed(station, cap, iso);
  return cap;
}
/* What the line actually plates a round, against what is available: the register's own rounds over the 60 days to the day
   (production.js prodTankLoad: a round is every tank working, owner, 9 Oct 2026), said with how much of it rests on parts'
   own weights; firm, it is the line's round in place of the kg typed on the units, so nothing is "running at" against them.
   Without rounds on the register, the planner's reading over its three months. Never a guess. */
function pltUsed(station, cap, iso) {
  if (!PLT_LINE_STATIONS[station]) return { kgRound: null, pct: null, why: station === 'pick' ? 'pickling is not timed a round' : 'not a plating line' };
  var T = typeof prodTankLoad === 'function' ? prodTankLoad(station, iso || localDateStr()) : null;
  if (T && T.perRound != null) {
    return { kgRound: T.perRound, perTank: T.perTank, firm: T.firm, pct: !T.firm && cap.byKg && cap.kgAvail > 0 ? T.perRound / cap.kgAvail : null,
      why: 'the register’s ' + T.rounds + ' round' + (T.rounds === 1 ? '' : 's') + ' over ' + T.days + ' day' + (T.days === 1 ? '' : 's') +
        (T.perTank != null ? ', ' + formatNum(T.perTank, 0) + ' kg a tank' : '') +
        (T.firm ? '; firm, so it is the line’s round in place of the kg typed' : '; ' + T.why) };
  }
  if (!cap.byKg) return { kgRound: null, pct: null, why: 'set the kg a round of every unit to compare' };
  var L = null;
  try { var B = typeof plnBase === 'function' ? plnBase() : null; L = B && B.lines ? B.lines[station] : null; } catch (e) { L = null; }
  if (!L || L.src !== 'register') return { kgRound: null, pct: null, why: 'not measured: no register read for this line' };
  return { kgRound: L.kgRound, pct: cap.kgAvail > 0 ? L.kgRound / cap.kgAvail : null, why: 'the register’s rounds against the book’s kilos, ' + L.register.days + ' days' };
}
function pltCapWords(cap) {
  if (!cap.n) return 'No unit recorded';
  var noun = cap.units.every(function(u) { return u.kind === 'barrel'; }) ? 'barrel' : cap.units.every(function(u) { return u.kind === 'tank'; }) ? 'tank' : 'unit';
  return cap.nAvail + ' of ' + cap.n + ' ' + noun + (cap.n === 1 ? '' : 's') + ' working · ' + Math.round(cap.pct * 100) + '% available' +
    (cap.used && cap.used.pct != null ? ' · running at ' + Math.round(cap.used.pct * 100) + '%' : '');
}
function pltCapTone(cap) { return !cap.n ? 'neutral' : cap.nAvail === 0 ? 'danger' : cap.nAvail < cap.n ? 'warning' : 'ok'; }
function pltCapDot(cap) {
  var t = pltCapTone(cap);
  return uiDot(t, !cap.n ? 'None recorded' : t === 'ok' ? 'All working' : t === 'danger' ? 'Nothing working' : cap.down.length + ' not working');
}

/* ---------- Drawn ---------- */
/* A capacity bar: the share available, and what is used of it where measured. An SVG, so its widths are attributes. */
function pltBarHtml(cap) {
  if (!cap.n) return '';
  var a = Math.max(0, Math.min(100, Math.round(cap.pct * 100))), u = cap.used && cap.used.pct != null ? Math.max(0, Math.min(a, Math.round(cap.used.pct * cap.pct * 100))) : null;
  return '<svg class="inv-unit-bar" viewBox="0 0 100 6" preserveAspectRatio="none" role="img" aria-label="' + escHtml(pltCapWords(cap)) + '">' +
    '<rect class="inv-unit-bar-track" x="0" y="0" width="100" height="6"></rect><rect class="inv-unit-bar-avail" x="0" y="0" width="' + a + '" height="6"></rect>' +
    (u != null ? '<rect class="inv-unit-bar-used" x="0" y="0" width="' + u + '" height="6"></rect>' : '') + '</svg>';
}
/* One unit as a tile: its name, its status in a word and a colour, its kg a round and how long it has been so. */
function pltTileHtml(u, iso) {
  var s = pltStatus(iso ? pltStatusOn(u, iso) : u.status), days = iso ? null : pltDaysIn(u);
  var sub = [+u.kgRound > 0 ? formatNum(+u.kgRound, 0) + ' kg a round' : 'kg a round not set', s[0] !== 'run' && days != null ? (days ? days + ' day' + (days === 1 ? '' : 's') : 'today') : ''].filter(Boolean).join(' · ');
  return '<button type="button" class="inv-plt-unit" data-status="' + s[0] + '" data-action="invPltEdit" data-id="' + escHtml(u.id) + '" data-plt-unit="' + escHtml(u.id) + '"' +
    ' aria-label="' + escHtml(u.name + ': ' + s[1] + (u.reason && s[0] !== 'run' ? ', ' + u.reason : '')) + '">' +
    '<span class="inv-unit-name">' + escHtml(u.name) + '</span>' + uiDot(s[2], s[1]) + '<span class="inv-unit-sub">' + escHtml(sub) + '</span></button>';
}
/* A small square per unit, coloured by its status: the strip at a glance (Overview, Floor → Day). */
function pltPipsHtml(cap, iso) {
  return '<span class="inv-unit-pips" aria-hidden="true">' + cap.units.map(function(u) {
    return '<span class="inv-unit-pip" data-status="' + pltStatus(iso ? pltStatusOn(u, iso) : u.status || 'run')[0] + '"></span>';
  }).join('') + '</span>';
}
/* A line's panel: its name, how much of it works, the bar, and its units. */
function pltStationHtml(station) {
  var cap = pltCapacity(station), name = pltStationName(station);
  var h = '<div class="inv-panel inv-panel-flush" data-plt-station="' + station + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(name) +
    ' <span class="inv-panel-count">' + (cap.n ? cap.nAvail + ' of ' + cap.n : 'none') + '</span></span>' + pltCapDot(cap) + '</div>';
  if (!cap.n) return h + '<div class="inv-empty">No unit recorded for ' + escHtml(name) + '.' + (pltCanEdit() ? ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPltEdit" data-station="' + station + '">Add one</button>' : '') + '</div></div>';
  h += '<div class="inv-panel-body"><div class="inv-unit-cap" data-plt-cap><span class="inv-unit-cap-words">' + escHtml(pltCapWords(cap)) + '</span>' + pltBarHtml(cap) +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml(cap.note + (cap.byKg ? ': ' + formatNum(cap.kgAvail, 0) + ' of ' + formatNum(cap.kgTotal, 0) + ' kg a round' : '') +
    (cap.used && cap.used.kgRound != null ? ' · plating ' + formatNum(cap.used.kgRound, 0) + ' kg a round (' + cap.used.why + ')' : cap.used && PLT_LINE_STATIONS[station] ? ' · ' + cap.used.why : '')) + '</span></div>' +
    '<div class="inv-unit-strip">' + cap.units.map(function(u) { return pltTileHtml(u); }).join('') + '</div></div>';
  // The power cuts that hit this line (powercause.js), when any were tied to it.
  if (typeof pcsStationNote === 'function') h += pcsStationNote(station);
  return h + '</div>';
}
/* The supporting stations (lab, oven, power, effluent, other): rows, since they are not side by side. */
function pltSupportHtml() {
  var units = pltUnits().filter(function(u) { return !pltIsLine(u.station); });
  if (!units.length) return '';
  return '<div class="inv-panel inv-panel-flush" data-plt-station="support"><div class="inv-panel-head"><span class="inv-panel-title">Supporting equipment <span class="inv-panel-count">' + units.length + '</span></span></div>' +
    units.map(function(u) {
      var s = pltStatus(u.status), cond = typeof PLN_MACHINE_STATES !== 'undefined' ? PLN_MACHINE_STATES.find(function(x) { return x[0] === u.condition; }) : null;
      var meta = [pltStationName(u.station), cond ? cond[1] : '', u.needs || '', u.reason && u.status !== 'run' ? u.reason : ''].filter(Boolean).join(' · ');
      return '<div class="inv-row inv-row-2" data-plt-unit="' + escHtml(u.id) + '"><button class="inv-row-main" data-action="invPltEdit" data-id="' + escHtml(u.id) + '"><span class="inv-row-title">' + escHtml(u.name) + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">' + escHtml(meta) + '</span></button><span class="inv-row-end">' + uiDot(s[2], s[1]) + '</span></div>';
    }).join('') + '</div>';
}
/* The status changes, newest first. */
function pltLogHtml() {
  var log = pltRead().log.slice().sort(function(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.at || 0) - (a.at || 0); });
  if (!log.length) return '';
  var rows = log.map(function(l) {
    var u = pltUnitById(l.unitId), to = l.to === 'retired' ? ['retired', 'Retired', 'neutral'] : pltStatus(l.to);
    var meta = [formatDate(l.date), l.from ? 'was ' + (l.from === 'retired' ? 'retired' : pltStatus(l.from)[1].toLowerCase()) : 'added', l.reason || '', l.by || ''].filter(Boolean).join(' · ');
    return '<div class="inv-row inv-row-2" data-plt-log><span class="inv-row-main"><span class="inv-row-title">' + escHtml((u ? u.name + ' · ' + pltStationName(u.station) : 'A unit')) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(meta) + '</span></span><span class="inv-row-end">' + uiDot(to[2], to[1]) + '</span></div>';
  });
  return '<div class="inv-panel inv-panel-flush" id="pltLog"><div class="inv-panel-head"><span class="inv-panel-title">Status changes <span class="inv-panel-count">' + log.length + '</span></span></div>' +
    uiMoreHtml('pltLog', rows, { noun: 'change' }) + '</div>';
}
/* Production → Equipment. */
function pltEquipmentHtml() {
  var h = pltCanEdit() ? '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary" data-action="invPltEdit">Add a unit</button>' +
    '<button class="inv-btn inv-btn-ghost" data-action="invPltExport">Export</button><button class="inv-btn inv-btn-ghost" data-action="invPltImport">Import</button>' +
    '<input type="file" accept=".json,application/json" id="pltFileInput" class="inv-hidden"></div>' : '';
  if (!pltUnits().length) {
    return h + '<div class="inv-empty" id="pltEmpty">No unit recorded yet. Add each barrel and tank: its line, its kg a round and whether it is working. ' +
      'The line’s capacity is worked out from them, and every change of status is kept with its day.</div>';
  }
  h += '<div class="inv-panels">' + PLT_STATIONS.filter(function(s) { return s[2]; }).map(function(s) { return pltStationHtml(s[0]); }).join('') + '</div>';
  h += '<div class="inv-panels">' + pltSupportHtml() + pltLogHtml() + '</div>';
  return h;
}
/* The plant at a glance: a row per line (Production → Overview's first panel). */
function pltGlanceHtml() {
  if (!pltUnits().length) return '';
  return '<div class="inv-panel inv-panel-flush" id="pltGlance"><div class="inv-panel-head"><span class="inv-panel-title">The plant now</span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invProdTab" data-tab="equipment">Equipment</button></div>' +
    PLT_STATIONS.filter(function(s) { return s[2]; }).map(function(s) {
      var cap = pltCapacity(s[0]);
      return '<div class="inv-row inv-row-2" data-plt-glance="' + s[0] + '"><button class="inv-row-main" data-action="invPltOpen"><span class="inv-row-title">' + escHtml(s[1]) + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">' + escHtml(pltCapWords(cap)) + '</span></button><span class="inv-row-end">' + (cap.n ? pltPipsHtml(cap) : '') + pltCapDot(cap) + '</span></div>';
    }).join('') + '</div>';
}
/* Floor → Day: the line's units on the day shown, one row under its card. */
function pltFloorRowHtml(lineId, day) {
  var station = lineId === 'pickling' ? 'pick' : lineId, cap = pltCapacity(station, day);
  if (!cap.n) return '';
  return '<div class="inv-row inv-row-2" data-flr-units><button class="inv-row-main" data-action="invPltOpen"><span class="inv-row-title">' + escHtml(pltCapWords(cap)) + '</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml(cap.down.length ? cap.down.map(function(u) { return u.name + ' ' + pltStatus(pltStatusOn(u, day))[1].toLowerCase(); }).join(' · ') : 'every unit working') + '</span></button>' +
    '<span class="inv-row-end">' + pltPipsHtml(cap, day) + '</span></div>';
}

/* ---------- Changed by the owner alone ---------- */
function pltCanEdit() { return typeof grdIsOwner !== 'function' || grdIsOwner(); }
function pltOwnerOk(again) {
  if (!pltCanEdit()) { uiAlert({ title: 'The owner’s to change', body: 'The plant register is changed by the owner alone.' }); return false; }
  return typeof grdGate !== 'function' || grdGate('settings', 'Change the plant register', again);
}
function _pltOpts(list, v) { return list.map(function(o) { return '<option value="' + escHtml(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>'; }).join(''); }
function _pltField(id, label, v, type, extra) {
  return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + escHtml(label) + '</label><input class="inv-input" id="' + id + '" type="' + (type || 'text') + '" value="' + escHtml(v == null ? '' : String(v)) + '"' + (extra || '') + '></div>';
}
function _pltSelect(id, label, list, v) {
  return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + escHtml(label) + '</label><select class="inv-input" id="' + id + '">' + _pltOpts(list, v) + '</select></div>';
}
function pltEdit(id, station) {
  if (!pltOwnerOk(function() { pltEdit(id, station); })) return;
  var u = id ? pltUnitById(id) : null, v = u || { station: station || 'vat-a1', kind: station === 'barrel' ? 'barrel' : 'tank', status: 'run', since: localDateStr(), condition: 'fair' };
  var risk = v.risk || {};
  var f = _pltField('pltName', 'Name', v.name, 'text', ' placeholder="Tank 3, Barrel 2"') +
    _pltSelect('pltStation', 'Line or station', PLT_STATIONS.map(function(s) { return [s[0], s[1]]; }), v.station) +
    _pltSelect('pltKind', 'Kind', PLT_KINDS, v.kind || 'tank') +
    _pltField('pltKg', 'Kg a round', v.kgRound, 'number', ' min="0" step="any" inputmode="decimal"') +
    _pltSelect('pltStatus', 'Status', PLT_STATUS.map(function(s) { return [s[0], s[1]]; }), v.status || 'run') +
    _pltField('pltSince', 'Since', v.since || localDateStr(), 'date') +
    _pltField('pltReason', 'Why (when not running)', v.reason) +
    _pltSelect('pltCond', 'Condition', typeof PLN_MACHINE_STATES !== 'undefined' ? PLN_MACHINE_STATES.map(function(s) { return [s[0], s[1]]; }) : [['fair', 'Fair']], v.condition || 'fair') +
    _pltField('pltAge', 'Age', v.age) + _pltField('pltNeeds', 'What it needs', v.needs) + _pltField('pltNote', 'Note', v.note) +
    '<details class="inv-panel inv-panel-flush inv-panel-fold inv-mt-8"><summary class="inv-panel-head"><span class="inv-panel-title">If it fails (the planner’s trials)</span></summary><div class="inv-panel-body"><div class="inv-fields">' +
    _pltField('pltRiskP', 'Chance it fails in a month, %', risk.p != null ? Math.round(risk.p * 1000) / 10 : '', 'number', ' min="0" max="100" step="any"') +
    _pltField('pltRiskCost', 'What a failure costs, ₹', risk.cost, 'number', ' min="0" step="any"') +
    _pltField('pltRiskDays', 'Days the line is down', risk.days, 'number', ' min="0" step="any"') +
    _pltSelect('pltLine', 'Line it stops when it fails', [['', 'None']].concat(PLT_STATIONS.filter(function(s) { return s[2]; }).map(function(s) { return [s[0], s[1]]; })), pltLineOf(v)) +
    _pltField('pltRiskSay', 'What failing means', risk.say) + '</div></div></details>';
  dialogOpen('<div class="inv-dialog" data-plt-dialog="' + escHtml(u ? u.id : '') + '">' + dialogHeadHtml(u ? escHtml(u.name) + ' · ' + escHtml(pltStationName(u.station)) : 'Add a unit') +
    '<div class="inv-fields">' + f + '</div>' + (u ? pltUnitHistoryHtml(u) : '') +
    '<div class="inv-dialog-foot">' + (u ? '<button class="inv-btn inv-btn-danger" data-action="invPltRetire" data-id="' + escHtml(u.id) + '">Retire</button>' : '') +
    '<button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPltSave"' + (u ? ' data-id="' + escHtml(u.id) + '"' : '') + '>Save</button></div></div>', { dismiss: true });
}
/* A unit's own history: its last status changes, and its days down over 90. */
function pltUnitHistoryHtml(u) {
  var today = localDateStr(), log = pltRead().log.filter(function(l) { return l.unitId === u.id; }).sort(function(a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 5);
  var down = pltDownDays(u, isoAddDays(today, -89), today);
  return '<div class="inv-panel inv-panel-flush inv-mt-8"><div class="inv-panel-head"><span class="inv-panel-title">Its record</span><span class="inv-panel-count">' + escHtml(down + ' day' + (down === 1 ? '' : 's') + ' not working in 90') + '</span></div>' +
    log.map(function(l) {
      var to = l.to === 'retired' ? ['retired', 'Retired', 'neutral'] : pltStatus(l.to);
      return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(formatDate(l.date)) + '</span><span class="inv-row-meta">' + escHtml(l.reason || (l.from ? '' : 'added')) + '</span></span><span class="inv-row-end">' + uiDot(to[2], to[1]) + '</span></div>';
    }).join('') + (typeof pcsUnitHtml === 'function' ? pcsUnitHtml(u) : '') + '</div>';
}
function _pltVal(id) { var el = document.getElementById(id); return el ? String(el.value).trim() : ''; }
function _pltNum(id) { var v = _pltVal(id); if (v === '') return null; var n = parseFloat(v); return isFinite(n) && n >= 0 ? n : null; }
function pltSave(id) {
  if (!pltOwnerOk(function() { pltSave(id); })) return;
  var name = _pltVal('pltName');
  if (!name) return uiAlert({ title: 'Name the unit', body: 'A unit needs a name: Tank 3, Barrel 2.' });
  var status = _pltVal('pltStatus') || 'run', since = _pltVal('pltSince') || localDateStr(), reason = _pltVal('pltReason');
  if (since > localDateStr()) return uiAlert({ title: 'A day not yet come', body: 'The status begins on a day up to today.' });
  var p = pltData(), u = id ? p.units.find(function(x) { return x.id === id; }) : null, now = Date.now(), who = pltWho();
  var pr = _pltNum('pltRiskP');
  var rec = { name: name, station: _pltVal('pltStation') || 'other', kind: _pltVal('pltKind') || 'tank', kgRound: _pltNum('pltKg'), condition: _pltVal('pltCond') || 'fair',
    age: _pltVal('pltAge'), needs: _pltVal('pltNeeds'), note: _pltVal('pltNote'), line: _pltVal('pltLine'),
    risk: pr > 0 ? { p: Math.min(100, pr) / 100, cost: _pltNum('pltRiskCost') || 0, days: _pltNum('pltRiskDays') || 0, say: _pltVal('pltRiskSay') } : null };
  if (!u) {
    u = Object.assign({ id: pltId('PU'), status: status, since: since, reason: status === 'run' ? '' : reason, addedOn: since }, rec, { at: now, by: who });
    p.units.push(u);
    p.log.push({ id: pltId('PL'), unitId: u.id, date: since, from: null, to: status, reason: status === 'run' ? '' : reason, at: now, by: who });
  } else {
    var moved = u.status !== status, last = pltLastLogDate(u);
    // A change dated before the last one on record would leave the log saying otherwise: the log is read by date.
    if (moved && last && since < last) return uiAlert({ title: 'Before its last change', body: u.name + '’s last change is dated ' + formatDate(last) + '. A new status begins on that day or later.' });
    if (moved) p.log.push({ id: pltId('PL'), unitId: u.id, date: since, from: u.status || 'run', to: status, reason: reason, at: now, by: who });
    else if (since !== u.since) {
      // Only the day corrected: the line that began this status moves with it, never before the change before it.
      var mine = p.log.filter(function(l) { return l.unitId === u.id && l.to === u.status && l.date === u.since; }).pop();
      var before = p.log.filter(function(l) { return l.unitId === u.id && l !== mine && l.date; }).reduce(function(m, l) { return l.date > m ? l.date : m; }, '');
      if (before && since < before) return uiAlert({ title: 'Before its last change', body: 'The change before this one is dated ' + formatDate(before) + '.' });
      if (mine) mine.date = since;
    }
    Object.assign(u, rec, { status: status, since: since || u.since, reason: status === 'run' ? '' : reason, at: now, by: who });
  }
  closeOverlay();
  saveState();
  pltRedraw();
  showToast(id ? 'Saved' : 'Added');
}
function pltRetire(id) {
  if (!pltOwnerOk(function() { pltRetire(id); })) return;
  var u = pltUnitById(id);
  if (!u) return;
  uiPrompt({ title: 'Retire ' + u.name, label: 'Why it is retired (kept with its record)', required: true }).then(function(why) {
    if (why == null || !String(why).trim()) return;
    var p = pltData(), x = p.units.find(function(r) { return r.id === id; }), now = Date.now();
    if (!x) return;
    x.retiredAt = now; x.retireReason = String(why).trim();
    p.log.push({ id: pltId('PL'), unitId: x.id, date: localDateStr(), from: x.status || 'run', to: 'retired', reason: x.retireReason, at: now, by: pltWho() });
    closeOverlay();
    saveState();
    pltRedraw();
    showToast('Retired');
  });
}
function pltRedraw() {
  var page = typeof navPageOf === 'function' ? navPageOf() : '';
  if (page === 'pageProduction' && typeof renderProduction === 'function') renderProduction();
  else if (page === 'pagePlanner' && typeof renderPlanner === 'function') renderPlanner();
  else if (page === 'pageFloor' && typeof renderFloor === 'function') renderFloor();
}
/* A status changed in the form: the day it began is today, unless typed. */
document.addEventListener('change', function(e) {
  var t = e.target;
  if (!t || t.id !== 'pltStatus') return;
  var dlg = t.closest('[data-plt-dialog]'), u = dlg && dlg.dataset.pltDialog ? pltUnitById(dlg.dataset.pltDialog) : null, since = document.getElementById('pltSince');
  if (u && since && t.value !== u.status) since.value = localDateStr();
});

function pltAction(action, btn) {
  switch (action) {
    case 'invPltOpen': prodSetTab('equipment'); _prodView = 'main'; switchTab('pageProduction'); return true;
    case 'invPltEdit': pltEdit(btn.dataset.id || null, btn.dataset.station || null); return true;
    case 'invPltSave': pltSave(btn.dataset.id || null); return true;
    case 'invPltRetire': pltRetire(btn.dataset.id); return true;
    case 'invPltExport': pltExport(); return true;
    case 'invPltImport': {
      if (!pltOwnerOk(function() { var i = document.getElementById('pltFileInput'); if (i) i.click(); })) return true;
      var inp = document.getElementById('pltFileInput');
      if (inp) inp.click();
      return true;
    }
  }
  return false;
}

/* ---------- One register with the planner ---------- */
/* The line a unit stops when it fails: as set, else its own line for a unit on one, else none. */
function pltLineOf(u) { return u.line !== undefined && u.line !== null ? u.line || '' : PLT_LINE_STATIONS[u.station] ? u.station : ''; }
/* The planner's machines, read from the units (its trials draw a unit's risk until the upgrade that fixes its station). */
function pltMachines() {
  return pltUnits().map(function(u) {
    return { id: u.id, item: u.name, station: u.station, line: pltLineOf(u) || null, state: u.condition || 'fair',
      age: u.age || '', needs: u.needs || '', risk: u.risk || null, status: u.status || 'run' };
  });
}
/* The planner's machines move into the register once, their ids kept, so the change log and the trials know them. */
function pltFromMachines() {
  if (!S || !S.planner || !Array.isArray(S.planner.machines) || !S.planner.machines.length) return false;
  var p = pltData(), today = localDateStr();
  S.planner.machines.forEach(function(m) {
    if (!m || p.units.some(function(u) { return u.id === m.id; })) return;
    var station = PLT_STATIONS.some(function(s) { return s[0] === m.station; }) ? m.station : 'other';
    p.units.push({ id: m.id || pltId('PU'), name: m.item || 'Machine', station: station, kind: station === 'barrel' ? 'barrel' : 'other', kgRound: null,
      status: 'run', since: today, reason: '', condition: m.state || 'fair', age: m.age || '', needs: m.needs || '', risk: m.risk || null, line: m.line || null,
      note: '', at: m.at || Date.now(), by: m.by || '', retiredAt: m.retiredAt || null, retireReason: m.retireReason || '', from: 'planner' });
  });
  S.planner.machines = [];
  return true;
}

/* ---------- The To-do: a unit down ---------- */
TODO_RULES.push(['plantDown', 'Plant: a unit down or under repair for days']);
TODO_CHECK_DEFAULTS.plantDown = true;
TODO_RULE_FNS.plantDown = function() {
  return pltUnits().filter(function(u) { return !pltAvailable(u.status) && (pltDaysIn(u) || 0) >= PLT_DOWN_AMBER; }).map(function(u) {
    var d = pltDaysIn(u), s = pltStatus(u.status), cap = pltCapacity(u.station);
    return { key: 'plantDown:' + u.id, rule: 'plantDown', tone: d >= PLT_DOWN_RED ? 'red' : 'amber',
      title: u.name + ' (' + pltStationName(u.station) + ') ' + s[1].toLowerCase() + ' ' + d + ' days', sub: u.reason || 'no reason written', why: 'Plant register',
      facts: [['Status', s[1] + ' since ' + formatDate(u.since)], ['Why', u.reason || 'not written'], [pltStationName(u.station), pltCapWords(cap)]],
      clears: 'Clears itself when the unit is set running or on standby, or retired.', go: { kind: 'production', tab: 'equipment' }, goLabel: 'Open Equipment',
      sig: u.id + ':' + u.status + ':' + u.since + ':' + (d >= PLT_DOWN_RED ? 'red' : 'amber') };
  });
};

/* ---------- The register as a file: sep-plant v1 ----------
   Export is whole (the units and the log); import merges by id and never overwrites a unit already held, so the owner can
   fill the units in a spreadsheet, or move the register to another device. A unit with no id is new; one with the same
   name on the same line as a unit held is the same unit, and is left as it is. */
function pltExport() {
  var p = pltRead(), meta = document.querySelector('meta[name="app-build"]');
  downloadJson('sep-plant-' + localDateStr() + '.json', { format: 'sep-plant', version: 1, exportedAt: new Date().toISOString(), build: meta ? meta.getAttribute('content') : '',
    units: p.units, log: p.log }, 1);
}
function pltMergeImport(obj) {
  if (!obj || obj.format !== 'sep-plant' || !Array.isArray(obj.units)) return { ok: false };
  var p = pltData(), added = 0, kept = 0, bad = 0, logs = 0, dropped = 0, today = localDateStr(), now = Date.now(), who = pltWho();
  var key = function(u) { return u.station + '|' + String(u.name || '').trim().toLowerCase(); };
  obj.units.forEach(function(r) {
    if (!r || !String(r.name || '').trim() || !PLT_STATIONS.some(function(s) { return s[0] === r.station; })) { bad++; return; }
    if ((r.id && p.units.some(function(u) { return u.id === r.id; })) || p.units.some(function(u) { return !u.retiredAt && key(u) === key(r); })) { kept++; return; }
    var status = PLT_STATUS.some(function(s) { return s[0] === r.status; }) ? r.status : 'run', since = /^\d{4}-\d{2}-\d{2}$/.test(r.since || '') && r.since <= today ? r.since : today;
    var u = { id: r.id || pltId('PU'), name: String(r.name).trim(), station: r.station, kind: PLT_KINDS.some(function(k) { return k[0] === r.kind; }) ? r.kind : (r.station === 'barrel' ? 'barrel' : 'tank'),
      kgRound: +r.kgRound > 0 ? +r.kgRound : null, status: status, since: since, reason: status === 'run' ? '' : String(r.reason || ''), addedOn: since,
      condition: r.condition || 'fair', age: String(r.age || ''), needs: String(r.needs || ''), note: String(r.note || ''), risk: pltRiskClean(r.risk),
      retiredAt: r.retiredAt || null, retireReason: r.retireReason || '', at: now, by: who };
    p.units.push(u);
    added++;
    var own = Array.isArray(obj.log) ? obj.log.filter(function(l) { return l && l.unitId === u.id; }) : [];
    var okLog = function(l) { return (l.to === 'retired' || PLT_STATUS.some(function(x) { return x[0] === l.to; })) && /^\d{4}-\d{2}-\d{2}$/.test(String(l.date || '')) && l.date <= today &&
      (l.from == null || PLT_STATUS.some(function(x) { return x[0] === l.from; })); };
    var fine = own.filter(okLog);
    dropped += own.length - fine.length;
    if (fine.length) fine.forEach(function(l) { if (!p.log.some(function(x) { return x.id === l.id; })) { p.log.push({ id: String(l.id || pltId('PL')), unitId: u.id, date: l.date, from: l.from || null, to: l.to, reason: String(l.reason || ''), at: +l.at || now, by: String(l.by || '') }); logs++; } });
    else p.log.push({ id: pltId('PL'), unitId: u.id, date: since, from: null, to: status, reason: u.reason, at: now, by: who });
  });
  return { ok: true, added: added, kept: kept, bad: bad, logs: logs, dropped: dropped };
}
/* A unit's risk as the trials read it: a chance 0–1 (a figure over 1 read as a percentage), a cost and days of 0 or more. */
function pltRiskClean(r) {
  if (!r || !(+r.p > 0)) return null;
  var p = +r.p > 1 ? +r.p / 100 : +r.p;
  return { p: Math.min(1, p), cost: Math.max(0, +r.cost || 0), days: Math.max(0, +r.days || 0), say: String(r.say || '') };
}
function pltImportText(text) {
  if (!pltOwnerOk(function() { pltImportText(text); })) return;
  var obj;
  try { obj = JSON.parse(text); } catch (e) { showToast('Not valid JSON: ' + e.message, 'error'); return; }
  var r = pltMergeImport(obj);
  if (!r.ok) { uiAlert({ title: 'Not a plant file', body: 'A plant register file is marked sep-plant and carries a list of units.' }); return; }
  saveState();
  pltRedraw();
  showToast(r.added + ' unit' + (r.added === 1 ? '' : 's') + ' added' + (r.kept ? ' · ' + r.kept + ' already held, kept' : '') + (r.bad ? ' · ' + r.bad + ' without a name or a known line' : '') + (r.dropped ? ' · ' + r.dropped + ' status lines not readable, left out' : ''), r.bad || r.dropped ? 'warning' : 'success');
}
document.addEventListener('change', function(e) {
  var t = e.target;
  if (!t || t.id !== 'pltFileInput' || !t.files || !t.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(ev) { pltImportText(ev.target.result); };
  reader.readAsText(t.files[0]);
  t.value = '';
});
