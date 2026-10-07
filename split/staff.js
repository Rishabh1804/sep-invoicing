/* ===== STAFF & ATTENDANCE =====

   Labour is the largest line in this business — ₹3.55/kg of an ₹8.55 cost, 42%
   of it — and until now it was one number typed into Settings. This tab is what
   turns it into a measurement: who was on the floor, on which day, in which
   area, and for how many hours beyond the shift.

   Three views over the same store. Day is for entry, Week is for the shape of
   a week and for fixing what the day view got wrong, Roster is the master.

   The roster ships empty on purpose. Names and wages are payroll data and this
   repo is public; the structure (areas, comp classes, the wage arithmetic) is
   code, the people are not. */

/* The areas are the shop's own, and the split is not cosmetic: the staffing
   norms are defined on these exact units — VAT A1 4 · VAT A2 4 · Barrel 3 ·
   Barrel pickling 2 · A1+A2 pickling 3, sixteen on the floor at full house —
   and pickling is two sub-areas that the daily relay already divides. A
   single flat `pickling` cannot carry either norm, so it cannot carry either
   shortfall, so the extra could not be checked against it.

   Colour is deliberately absent, but be exact about why. The passivation step
   is NOT A1's — A2's operators passivate their own work and the barrel route
   passivates too. What is A1-specific is that a **hand is set aside for it**,
   inside its complement of four. So colour is a dedicated post, not a place
   with a crew of its own; giving it an area was the module's own invention,
   and the shop's own register codes those hands `A1`. */
var STAFF_AREAS = [
  { id: 'vat-a1',          label: 'VAT A1',          floor: true },
  { id: 'vat-a2',          label: 'VAT A2',          floor: true },
  { id: 'barrel',          label: 'Barrel',          floor: true,  unit: 'barrel-block' },
  { id: 'pickling-barrel', label: 'Barrel pickling', floor: true,  unit: 'barrel-block' },
  { id: 'pickling-vat',    label: 'Pickling A1+A2',  floor: true },
  { id: 'flex',            label: 'Flex',            floor: true },
  { id: 'office',          label: 'Office',          floor: false },
  { id: 'gate',            label: 'Gate',            floor: false },
  { id: 'civil',           label: 'Civil',           floor: false }
];

/* Barrel and Barrel pickling are two areas for staffing and one block for the
   shortfall arithmetic.

   The relay writes them as one row about as often as it writes them as two —
   `Barrel & pickling | <three hands> | EXTRA 16 HOURS` — and every
   shortfall decode in the record reconciles them together against a combined
   norm of five, never against three and two read apart. Split for the
   reconciliation, a day with both hands on the barrel side reads barrel 2/3
   short 1 and barrel-pickling idle, predicts 8 hours against the 24 the shop
   actually booked, and reports a sixteen-hour surplus on a day whose own decode
   balances exactly.

   Where both sub-areas are staffed the combined norm and the separate norms
   give the same answer, so the pairing costs nothing there and is only ever
   load-bearing on the low-headcount days — which are the days the extra is
   largest. Reporting stays per area; only the shortfall is reconciled per unit.

   `UNIT_LABELS` names a unit where it differs from its areas, so a flag can say
   which thing it is talking about. */
var AREA_UNIT_LABELS = { 'barrel-block': 'Barrel & pickling' };

function areaUnitOf(areaId) {
  var a = STAFF_AREAS.find(function(x) { return x.id === areaId; });
  return (a && a.unit) || areaId;
}

function areaUnitLabel(unitId) {
  if (AREA_UNIT_LABELS[unitId]) return AREA_UNIT_LABELS[unitId];
  return areaLabel(unitId);
}

/* Retired ids and where they go. `pickling` was ambiguous between the two
   sub-areas; it lands on the VAT side because that is the one the relay's format
   labels plainly as "Pickling", the barrel side always carrying the "Barrel"
   qualifier. A mark that meant the other one is a mark to re-point by hand,
   and there is no way to tell them apart after the fact — so the migration
   logs how many it moved rather than pretending the choice was free. */
var STAFF_AREA_ALIASES = { pickling: 'pickling-vat', colour: 'vat-a1' };

/* Retired comp ids, for the same reason and read by the same paths. A legacy
   `permanent` row must land on `monthly`, not on the picker's `daily` fallback:
   the difference is a rest-day gate, an OT denominator, and which side of the
   fixed/variable split the wage falls on. */
var STAFF_COMP_ALIASES = { permanent: 'monthly', contract: 'daily' };

/* ===== COMP CLASSES =====

   Three, because the shop pays three different ways and a single "contract"
   class got two of them wrong.

   `monthly` is the salaried tier — but it is not a flat salary. It is
   `₹/day × days worked`, plus the month's rest days scaled by an attendance
   gate, plus overtime at `₹/day ÷ 8 × 1.1`. That is the ratified rule, and a
   flat monthly divided by calendar days (what the first cut of this module
   did) neither matches the payout slips nor moves when somebody is absent.

   `hourly` is the weekly pool, and it has **no day concept at all**: every
   hour is paid at one flat rate, the fourteenth as the first. Charging it a
   day rate and then paying overtime at ×1.1 — again, the first cut — invents
   a day boundary the slip does not have and overpays the overtime by a tenth.

   `daily` is the generic middle: days at a day rate, overtime at a multiplier.
   No SEP tier is on it today; it is kept because it is the shape most job-work
   contracts take, and because it is what the earlier `contract` class was. */
var COMP_CLASSES = [
  { id: 'monthly', label: 'Monthly', short: 'M', tone: 'perm',
    hint: 'day rate × days worked, rest days gated on attendance, OT at rate ÷ 8' },
  { id: 'hourly', label: 'Hourly', short: 'H', tone: 'cw',
    hint: 'every hour at one flat rate — no day rate, no overtime multiplier' },
  { id: 'daily', label: 'Daily', short: 'D', tone: 'cw',
    hint: 'day rate × days worked, OT hours at the multiplier' }
];

function compClass(id) {
  return COMP_CLASSES.find(function(c) { return c.id === id; }) || COMP_CLASSES[2];
}

/* The hourly pool is paid for hours, so hours are what its row captures. Every
   other tier counts days and captures overtime on top. */
function compIsHourly(w) { return w && w.comp === 'hourly'; }

/* Present / Half day / Absent. A worker with no mark on a recorded day is
   *unmarked*, which is a fourth state and not the same as absent: it is the
   state of a row nobody has reached yet, and it costs nothing rather than
   costing a day's wage. Absent has to be said.

   Half a day is meaningless for an hourly worker — the hours already carry that
   granularity — so their row offers Present and Absent only. */
var ATT_STATES = ['P', 'H', 'A'];
var ATT_STATE_LABELS = { P: 'Present', H: 'Half day', A: 'Absent' };
var ATT_DAY_VALUE = { P: 1, H: 0.5, A: 0 };

var _attView = 'overview';
var _attDate = null;      // ISO date the Day view is showing
var _attWeekStart = null; // ISO Sunday the Week view is showing (the pay week)

/* ===== DATE HELPERS =====
   All local-time. `new Date('2026-08-27')` parses as UTC and lands on the
   previous evening east of Greenwich, which would silently shift every week
   boundary by a day here. */
function attParseIso(iso) {
  var p = String(iso || '').split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}


/* Sunday of the PAY WEEK containing iso. The plant runs Mon–Sat and pays the
   weekly tiers on Saturday; a Sunday worked is paid that coming Saturday, so the
   week runs Sunday to Saturday (owner, 25 Sep 2026). */
function attWeekStartOf(iso) {
  var d = attParseIso(iso);
  d.setDate(d.getDate() - d.getDay());   // 0 = Sunday
  return isoOf(d);
}
/* A pay week is numbered by its Saturday, the payout day — the ISO week the
   payout files are named after (`2026-W38-payout-2026-09-19`). */
function attPayWeekNumber(weekStartIso) {
  return attWeekNumber(isoAddDays(weekStartIso, 6));
}

/* ISO-8601 week number, so a week here is the same week soma-internal's
   attendance files are named after (`2026-W33.md`). */
function attWeekNumber(iso) {
  var d = attParseIso(iso);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  var yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function attDayName(iso) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][attParseIso(iso).getDay()];
}

/* Sun–Sat of a pay week. Sunday is worked only as overtime, but it is paid in
   this week, so it has its column (owner, 25 Sep 2026: "Week Grid doesn't have
   sundays"). */
function attWeekDays(weekStartIso) {
  var out = [];
  for (var i = 0; i < 7; i++) out.push(isoAddDays(weekStartIso, i));
  return out;
}

/* Every ISO date from `from` to `to` inclusive. */
function attDatesInRange(fromIso, toIso) {
  var out = [], cur = fromIso;
  if (!fromIso || !toIso || fromIso > toIso) return out;
  var guard = 0;
  while (cur <= toIso && guard++ < 4000) { out.push(cur); cur = isoAddDays(cur, 1); }
  return out;
}

/* ===== STORE ===== */
/* A day's data is deleted only with a reason, and never without trace (owner, 30 Sep 2026: "there is no way to delete a
   day's data after providing a reason that can be logged"). The whole day goes to S.attendanceDeletes as it was, with the
   reason and when, so History can say what was removed and why, and an audit can tell a day nobody typed from one
   somebody deleted. The day's heads-needed figures (S.shiftNeeds) are not attendance and stay. */
function attDeleteRecord(key, reason, how) {
  var rec = (S.attendance || {})[key];
  if (!rec) return null;
  var marks = Object.keys(rec.marks || {}).length, extra = attExtraRows(rec).length;
  var entry = { id: 'AD-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), key: key,
    iso: /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null, reason: reason, how: how || 'by hand', at: Date.now(),
    marks: marks, extra: extra, day: JSON.parse(JSON.stringify(rec)) };
  if (!Array.isArray(S.attendanceDeletes)) S.attendanceDeletes = [];
  S.attendanceDeletes.push(entry);
  delete S.attendance[key];
  return entry;
}
async function attDeleteDay(iso) {
  var rec = (S.attendance || {})[iso];
  if (!rec) return;
  if (!attFloorOk()) return;   // a floor record: a role that may not enter one is told so, never asked
  if (!grdOk('voids') && !(await guardAsk('voids', 'delete an attendance day'))) return;   // P1 (guard.js)
  var marks = Object.keys(rec.marks || {}).length, extra = attExtraRows(rec).length;
  // The rolls the day was saved from (relayPastes) go into the log with it: left on record, the same roll pasted again
  // was refused as already saved though nothing it saved was left (the QA of 30 Sep 2026).
  var rolls = function() { return (S.relayPastes || []).filter(function(p) { return p && (p.date === iso || (Array.isArray(p.days) && p.days.indexOf(iso) >= 0)); }); };
  var nRolls = rolls().length;
  var reason = await uiPrompt({ title: 'Delete ' + formatDate(iso), danger: true, okLabel: 'Delete day',
    body: 'All of this day\u2019s attendance goes: ' + marks + ' mark' + (marks === 1 ? '' : 's') + ' and ' + extra + ' EXTRA row' + (extra === 1 ? '' : 's') +
      '. It is kept in the log with the reason, and History lists it.' +
      (nRolls ? ' The ' + (nRolls === 1 ? 'roll it was saved from goes' : nRolls + ' rolls it was saved from go') + ' into the log with it, so ' + (nRolls === 1 ? 'it' : 'they') + ' can be pasted again.' : ''),
    label: 'Why is this day being deleted?', required: true, requiredText: 'A deleted day needs a reason.' });
  if (reason == null) return;
  if (!reason.trim()) { showToast('A deleted day needs a reason', 'error'); return; }
  if (!(S.attendance || {})[iso]) return;
  var entry = attDeleteRecord(iso, reason.trim(), 'by hand'), gone = rolls();
  if (entry && gone.length) {
    entry.pastes = gone;
    S.relayPastes = S.relayPastes.filter(function(p) { return gone.indexOf(p) < 0; });
  }
  saveState();
  renderAttendance();
  showToast(formatDate(iso) + ' deleted; the reason is in History');
}

/* A day's EXTRA rows: every row but a block this app made for a hand's slot pick, which books nothing (attSlotMade). */
function attExtraRows(rec) { return ((rec && rec.extra) || []).filter(function(x) { return !(x && x.slotMade); }); }

function attDay(iso, create) {
  if (!S.attendance) S.attendance = {};
  var rec = S.attendance[iso];
  if (!rec && create) {
    rec = { marks: {}, extra: [], note: '' };
    S.attendance[iso] = rec;
  }
  if (rec && !rec.marks) rec.marks = {};
  if (rec && !rec.extra) rec.extra = [];
  return rec || null;
}

function attMark(iso, staffId) {
  var rec = attDay(iso, false);
  if (!rec) return null;
  return rec.marks[staffId] || null;
}

/* The one lookup of a worker by id. Ids are numbers on a device and text in a picker's value, a mark's key or some
   imports, so they are compared as text. */
function staffById(id) {
  if (id == null || id === '') return undefined;
  var k = String(id);
  return (S.staff || []).find(function(w) { return String(w.id) === k; });
}

/* Active roster, leads and permanents first so the week grid reads the way the
   shop does — the four area leads are the rows an absence matters most on. */
function staffActive() {
  return (S.staff || []).filter(function(w) { return w.active !== false; }).sort(function(a, b) {
    var ai = COMP_CLASSES.findIndex(function(c) { return c.id === a.comp; });
    var bi = COMP_CLASSES.findIndex(function(c) { return c.id === b.comp; });
    if (ai !== bi) return ai - bi;
    return (a.name || '').localeCompare(b.name || '');
  });
}

/* The roster of a day: the active hands, and anyone marked that day who has since left. A left hand's mark is priced on
   the day's cost and counted in Needed today, so the Day board and the Week grid must show it, and let it be corrected
   (the QA of 30 Sep 2026: it was on neither). The paper sheets read the same list (attsheet.js). */
function attDayRoster(rec) {
  var list = staffActive().slice();
  if (rec) Object.keys(rec.marks || {}).forEach(function(id) {
    if (!list.some(function(w) { return String(w.id) === String(id); })) { var w = staffById(id); if (w) list.push(w); }
  });
  return list;
}

function areaLabel(id) {
  var a = STAFF_AREAS.find(function(x) { return x.id === id; });
  return a ? a.label : (id || '—');
}

function attAreaOptions(sel) {
  return STAFF_AREAS.map(function(a) {
    return '<option value="' + a.id + '"' + (a.id === sel ? ' selected' : '') + '>' + escHtml(a.label) + '</option>';
  }).join('');
}

/* ===== FOCUS ACROSS RE-RENDER =====

   Every action here replaces `innerHTML`, and marking a day is a run of twenty
   taps down a list. Without this the focus ring lands back on the body after
   each one and a keyboard user restarts the tab order from the top — the same
   failure that ended the keyboard path mid-challan, in a place it would be hit
   twenty times a day rather than once.

   The controls already carry the attributes that identify them, so the selector
   is rebuilt from those rather than adding a parallel key. Values are ids,
   ISO dates and literal action names — nothing that needs escaping. */
// Attributes matched BY VALUE. A chip's identity is which area or worker it
// names, so `data-area` / `data-worker` belong here and not among the
// presence-only flags below: `[data-area]` alone matches every chip in the
// row, and the restore then lands on the first one — precisely the failure it
// was added to prevent. Presence is enough for a field occurring once per row;
// it is never enough for a list.
var ATT_FOCUS_ATTRS = ['data-action', 'data-id', 'data-st', 'data-date', 'data-idx',
  'data-area', 'data-worker'];
var ATT_FOCUS_FLAGS = ['data-att-slot', 'data-att-area', 'data-att-ot', 'data-att-hours', 'data-att-in', 'data-att-out',
  'data-att-extra-area', 'data-att-extra-hours', 'data-att-extra-kind',
  'data-att-block-from', 'data-att-block-to', 'data-att-need', 'data-att-block-need'];

function _attFocusSelector() {
  var page = document.getElementById('pageStaff');
  var el = document.activeElement;
  if (!page || !el || el === document.body || !page.contains(el)) return null;
  if (el.id) return '#' + el.id;
  var parts = [];
  ATT_FOCUS_ATTRS.forEach(function(a) {
    if (el.getAttribute(a) != null) parts.push('[' + a + '="' + el.getAttribute(a) + '"]');
  });
  ATT_FOCUS_FLAGS.forEach(function(a) {
    if (el.getAttribute(a) != null) parts.push('[' + a + ']');
  });
  return parts.length ? parts.join('') : null;
}

function _attRestoreFocus(sel) {
  if (!sel) return;
  var page = document.getElementById('pageStaff');
  if (!page) return;
  var el;
  try { el = page.querySelector(sel); } catch (e) { return; }
  if (!el) return;
  try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
}

/* ===== TAB RENDER ===== */
/* The view tabs (§6.4). Paste message is not one of them: it is a sub-view with its own way back, opened by
   the page's one primary (Overview, Day) or from Home. */
var _attRosterOpen = null;   // the worker open in the desktop's pane (Roster)
var ATT_VIEWS = [['overview', 'Overview'], ['day', 'Day'], ['week', 'Week'], ['register', 'Register'], ['pay', 'Pay'], ['areas', 'Areas'], ['roster', 'Roster']];
var _attPrevView = 'overview';   // where Paste message's back button returns
var STAFF_BACK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
var STAFF_NEXT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

function _attTabsHtml() {
  // An ID that does not see wages has no Pay (guard.js).
  var seen = ATT_VIEWS.filter(function(v) { return v[0] !== 'pay' || typeof grdSeesWages !== 'function' || grdSeesWages(); });
  return '<div class="inv-viewtabs" role="tablist" aria-label="Staff">' + seen.map(function(v) {
    return '<button class="inv-viewtab" role="tab" aria-selected="' + (_attView === v[0]) + '" data-action="invAttView" data-view="' + v[0] + '">' + v[1] + '</button>';
  }).join('') + '</div>';
}

/* A period stepper (§6.7): previous · the period · next · back to now. `label` is the middle: the date field
   on Day, the week's number and dates elsewhere. */
function _attStepper(action, label, nowAction, nowLabel, prevLabel, nextLabel) {
  return '<div class="inv-toolbar inv-stepper">' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="' + action + '" data-step="-1" aria-label="' + prevLabel + '">' + STAFF_BACK_ICON + '</button>' +
    '<div class="inv-stepper-label">' + label + '</div>' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="' + action + '" data-step="1" aria-label="' + nextLabel + '">' + STAFF_NEXT_ICON + '</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="' + nowAction + '">' + nowLabel + '</button></div>';
}
function _attWeekLabel(title, sub) {
  return '<span class="inv-stepper-title">' + title + '</span><span class="inv-stepper-sub">' + sub + '</span>';
}

/* The page's one primary on the views where marks are entered. */
function _attPasteBar() {
  return '<div class="inv-toolbar"><button class="inv-btn inv-btn-primary" data-action="invAttView" data-view="paste">Paste message</button></div>';
}

var _attDateSeen = null;   // the day the week last followed
function renderAttendance() {
  _attRenderPage();
  attEditRefresh();
}
/* The page itself (the tabs and the open view); the hand's dialog over it is left as it is. */
function _attRenderPage() {
  if (!_attDate) _attDate = localDateStr();
  // Pay is refused to an ID that does not see wages (guard.js), by a tab, the sidebar or an address.
  if (_attView === 'pay' && typeof grdSeesWages === 'function' && !grdSeesWages()) { _attView = 'overview'; showToast('Your ID doesn’t open Pay', 'warning'); }
  // The week follows the Day view's day whenever that day moves, by the stepper, Today, the Overview or a saved roll:
  // Week, Pay and Areas then open on the week of the day just looked at. A week stepped to on its own view stays.
  if (_attDate !== _attDateSeen) { _attWeekStart = attWeekStartOf(_attDate); _attDateSeen = _attDate; }
  if (!_attWeekStart) _attWeekStart = attWeekStartOf(_attDate);
  if (_attView !== 'paste') _attPrevView = _attView;
  // A day's rolls read again are for that check only: left by any way (a tab, back), Paste message opens empty after.
  if (_attView !== 'paste' && _relay && _relay.reread) { _relay = null; _relayView = 'paste'; }

  var focusSel = _attFocusSelector();

  // Paste message is a sub-view: its own head and way back, no tabs.
  var toolbar = document.getElementById('attToolbar');
  if (toolbar) {
    toolbar.innerHTML = _attView === 'paste' ? '' : _attTabsHtml();
    // Six tabs overflow a phone; the open one is scrolled into view sideways only, so a tap lower on the
    // page (a P/H/A, an hour) never jumps the page back up to the tabs.
    viewTabReveal(toolbar.querySelector('.inv-viewtabs'));
  }

  var area = document.getElementById('attContent');
  if (!area) return;
  // A list-and-pane view (Roster on the desktop) keeps where its list and pane were scrolled (paneScrollKeep, state.js).
  paneScrollKeep(function() { area.innerHTML = _attViewHtml(); });
  _attRestoreFocus(focusSel);
}
/* The open view's drawing. The paste box takes every message the floor sends, not only rolls, so it opens without a
   roster (a roll asks). */
function _attViewHtml() {
  if ((S.staff || []).length === 0 && _attView !== 'roster' && _attView !== 'paste') return _attEmptyRoster();
  if (_attView === 'roster') return _attRosterView();
  if (_attView === 'paste') return relayRenderView();
  if (_attView === 'areas') return _attAreasView();
  if (_attView === 'pay') return _attPayView();
  if (_attView === 'overview') return _attPasteBar() + staffOverviewHtml();
  if (_attView === 'week') return _attWeekView();
  if (_attView === 'register') return aregViewHtml();
  return _attDayView();
}

/* ===== A CHANGE TYPED IN A FIELD IS DRAWN AROUND THE FIELD (the QA of 2 Oct 2026) =====
   A time field fires its change while the hand is still typing it: Chrome's In is complete at "8:30 AM", and the redraw
   then replaced the field, focus came back on its hour, and Tab and "5:30 PM" went into the In again (5:00 AM stored, no
   out). A number field fires its change on the blur a tap causes, and the redraw took the button from under the tap (OT
   typed in a hand's day, then Done: the dialog stayed open). So a change typed in a field is saved, and the view is drawn
   again AROUND the field: the field and every element holding it stay as they are (its focus, the part of a time being
   typed, a table's sideways scroll) and everything else is its fresh drawing, so each figure the change moves (the row's
   hours and OT, the dialog's note, the tiles, the day's cost, a block's length and check) is current at once. A tap on its
   way lands first: the drawing waits for its click. A Tab's blur lands first too, and the field it lands in is the one
   kept. Only a field being typed in is kept: a focused button is drawn afresh and keepScroll puts the focus back on it. */
function attRedrawAround(el, landed) {
  if (_attAfterTap(function() { attRedrawAround(el, landed); })) return;
  // A number's change fires on the blur that moves the focus on: let it land, then keep the field it landed in.
  if (!landed && el && el.isConnected && document.activeElement !== el) {
    setTimeout(function() { attRedrawAround(el, true); }, 0);
    return;
  }
  keepScroll(function() {
    var keep = document.activeElement;
    if (!keep || !/^(INPUT|TEXTAREA)$/.test(keep.tagName)) keep = null;
    var scrim = keep && keep.closest('.inv-scrim-dialog');
    if (scrim && scrim.querySelector('[data-att-edit]')) {
      // The hand's dialog: the page behind it is drawn whole (the scrim stops any tap reaching it), the dialog around the field.
      _attRenderPage();
      if (!attSwapAround(scrim, attEditHtml(), keep)) attEditRefresh();
      return;
    }
    var area = document.getElementById('attContent');
    if (keep && area && area.contains(keep) && attSwapAround(area, _attViewHtml(), keep)) return;
    renderAttendance();
  });
}
/* Draws `root` again from `html` around `keep`, one element inside it: `keep` and the elements holding it stay (the same
   nodes), every other node is replaced by its fresh twin. The twin is found by `keep`'s own id or data- attributes and must
   be the only one, at the same depth; otherwise nothing is drawn and false is returned. */
function attSwapAround(root, html, keep) {
  var sel = _keepKey(keep);
  if (!sel || !root || keep === root || !root.contains(keep)) return false;
  var tpl = document.createElement('template');
  tpl.innerHTML = html;
  var twins;
  try { twins = tpl.content.querySelectorAll(sel); } catch (e) { return false; }
  if (twins.length !== 1) return false;
  var lives = [keep], fresh = [twins[0]];
  for (;;) {
    var lp = lives[lives.length - 1].parentNode, fp = fresh[fresh.length - 1].parentNode;
    if (!lp || !fp) return false;
    lives.push(lp); fresh.push(fp);
    if (lp === root || fp === tpl.content) break;
  }
  if (lives[lives.length - 1] !== root || fresh[fresh.length - 1] !== tpl.content) return false;
  // From the outside in: each kept element's brothers become its twin's, in their order.
  for (var i = lives.length - 2; i >= 0; i--) {
    var lk = lives[i], fk = fresh[i], lpar = lives[i + 1], fpar = fresh[i + 1];
    while (lk.previousSibling) lpar.removeChild(lk.previousSibling);
    while (lk.nextSibling) lpar.removeChild(lk.nextSibling);
    while (fpar.firstChild && fpar.firstChild !== fk) lpar.insertBefore(fpar.firstChild, lk);
    while (fk.nextSibling) lpar.appendChild(fk.nextSibling);
  }
  return true;
}
/* A tap on its way: from its pointerdown until its click has run (or a moment has passed with none). */
var _attTapAt = 0, _attTapWait = [];
function _attTapRun() {
  var w = _attTapWait;
  _attTapWait = []; _attTapAt = 0;
  w.forEach(function(fn) { try { fn(); } catch (e) { console.error(e); } });
}
document.addEventListener('pointerdown', function() { _attTapAt = Date.now(); }, true);
document.addEventListener('click', function() { if (_attTapAt || _attTapWait.length) setTimeout(_attTapRun, 0); }, true);
document.addEventListener('pointercancel', function() { if (_attTapAt || _attTapWait.length) setTimeout(_attTapRun, 0); }, true);
/* Runs `fn` once the tap on its way has landed; false (and nothing kept) when no tap is. */
function _attAfterTap(fn) {
  if (!_attTapAt || Date.now() - _attTapAt > 1000) { _attTapAt = 0; return false; }
  _attTapWait.push(fn);
  setTimeout(_attTapRun, 1000);
  return true;
}

/* Staff → Day is a floor entry (the guard, guard.js): a role that may not make one is told so, never asked a PIN, and
   nothing is written. The owner, and a guard that is off, pass. One word at a time: a refusal already on screen is not
   said again for the next key. */
function attFloorOk() {
  if (typeof grdOk !== 'function' || grdOk('floor')) return true;
  if (!document.querySelector('[data-ui-ask]')) grdGate('floor', 'enter attendance');
  return false;
}
/* Wages on the Staff page are the guard's "wages" setting: a role that may not see them sees hours and heads, never a ₹
   figure (a day's cost with one hand per tier gives that hand's rate away). */
function attSeesWages() { return typeof grdSeesWages !== 'function' || grdSeesWages(); }

function _attEmptyRoster() {
  return '<div class="inv-panel"><div class="inv-empty">' +
    '<svg class="inv-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
    '<polyline points="17 11 19 13 23 9"/></svg>' +
    '<div>No one on the roster yet</div>' +
    '<div class="inv-note">Attendance and the labour breakdown both read the roster. ' +
    'Add each worker once with their comp class and rate; the wage arithmetic follows from there.</div>' +
    '<button class="inv-btn inv-btn-primary" data-action="invAttAddWorker">Add the first worker</button>' +
    '</div></div>';
}

/* ===== DAY VIEW ===== */
/* P/H/A carry their tone when chosen (a segment of the status's own colour, which switches with the theme):
   present ok, half warning, absent danger. */
var ATT_STATE_TONE = { P: 'ok', H: 'warning', A: 'danger' };

function _attDayView() {
  var iso = _attDate;
  var rec = attDay(iso, false);
  var roster = attDayRoster(rec);
  var total = roster.length;

  var present = 0, half = 0, absent = 0, unmarked = 0, otHours = 0, poolHours = 0;
  roster.forEach(function(w) {
    var m = rec ? rec.marks[w.id] : null;
    if (!m) { unmarked++; return; }
    if (m.st === 'P') present++;
    else if (m.st === 'H') half++;
    else absent++;
    if (compIsHourly(w)) poolHours += (m.hours || 0);
    else otHours += (m.ot || 0);
  });
  var extraHours = rec ? rec.extra.reduce(function(s, x) { return s + (x.hours || 0); }, 0) : 0;
  var onSite = present + half;

  var html = _attStepper('invAttStep',
    '<input type="date" class="inv-input inv-id" id="attDate" value="' + escHtml(iso) + '" aria-label="Day">' +
    '<span class="inv-stepper-sub">' + attDayName(iso) + '</span>',
    'invAttToday', 'Today', 'Previous day', 'Next day') +
    // Paste message stays the one primary; the paper forms for the day sit beside it (attsheet.js).
    _attPasteBar().replace('</div>', '<button class="inv-btn inv-btn-secondary" data-action="invIdcScan">Scan cards</button>' +
      '<button class="inv-btn inv-btn-secondary" data-action="invAttSheetOpen">Print sheets</button>' +
      // The day's rolls, read again by the reader as it reads now (relay.js, relayRereadOpen).
      (relayDayHasRolls(iso) ? '<button class="inv-btn inv-btn-secondary" data-action="invRelayReread">Read the rolls again</button>' : '') +
      (rec ? '<button class="inv-btn inv-btn-danger" data-action="invAttDayDelete">Delete this day</button>' : '') + '</div>');

  var tile = function(id, label, value, sub, tone) {
    return '<div class="inv-tile' + (tone ? ' inv-tile-' + tone : '') + '"><div class="inv-tile-label">' + label + '</div>' +
      '<div class="inv-tile-value" id="' + id + '">' + figWrapHtml(value) + '</div>' + (sub ? '<div class="inv-tile-sub">' + sub + '</div>' : '') + '</div>';
  };
  html += '<div class="inv-tiles inv-tiles-4" id="attDayTiles">' +
    '<div class="inv-tile"><div class="inv-tile-label">On site</div><div class="inv-tile-value"><span id="attOnSite">' + onSite + '</span>' +
    '<span class="inv-tile-of">/' + total + '</span></div><div class="inv-tile-sub">' + present + ' present</div></div>' +
    tile('attHalf', 'Half day', half, '', half ? 'warning' : '') +
    tile('attAbsent', 'Absent', absent, '', absent ? 'danger' : '') +
    tile('attUnmarked', 'Unmarked', unmarked, unmarked ? 'nobody typed' : '', '') + '</div>';
  if (poolHours > 0 || otHours > 0 || extraHours > 0) {
    html += '<div class="inv-tiles inv-tiles-3" id="attDayHours">' +
      tile('attPoolHours', 'Hourly pool', formatNum(poolHours, 1) + '<span class="inv-tile-of"> h</span>', '', '') +
      tile('attOtHours', 'OT, named', formatNum(otHours, 1) + '<span class="inv-tile-of"> h</span>', '', '') +
      tile('attExtraHours', 'Extra', formatNum(extraHours, 1) + '<span class="inv-tile-of"> h</span>', '', '') + '</div>';
  }

  // The day as a board (owner, 30 Sep 2026: "Attendance sheet for Day scrolls way too far"): a card per area, a line per
  // hand with P / H / A one tap away; the area, hours and OT open on the name. Absent hands are one strip under the board.
  var sheet = attDayAsSheet();
  html += '<div class="inv-toolbar inv-toolbar-flush"><span class="inv-seg" role="group" aria-label="Show the day as">' +
    '<button class="inv-seg-btn" data-action="invAttDayAs" data-v="board" aria-pressed="' + !sheet + '">Board</button>' +
    '<button class="inv-seg-btn" data-action="invAttDayAs" data-v="sheet" aria-pressed="' + sheet + '">Sheet</button></span>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAttAllPresent">All present</button>' +
    '<span class="inv-note">' + (sheet ? 'Deepak’s sheet: P / H / A, area, in and out for each hand; hours and OT are worked out.' : 'Tap a name for the area, the in and out, hours and OT.') + '</span></div>';
  if (sheet) {
    html += attSheetEntryHtml(iso, rec, roster);
    html += _attNeedCard(iso, rec);
    html += _attExtraCard(iso, rec);
    html += _attDayCostCard(iso);
    return html;
  }
  var byArea = {}, absentees = [];
  roster.forEach(function(w) {
    var m = rec ? rec.marks[w.id] : null;
    if (m && m.st === 'A') absentees.push(w);
    // An absent hand stays on their own area's card, so marking A never moves the line from under the tap.
    var a = m && m.st !== 'A' && m.area ? m.area : (w.area || 'flex');
    (byArea[a] = byArea[a] || []).push(w);
  });
  html += '<div class="inv-board" id="attMarks">';
  STAFF_AREAS.forEach(function(a) {
    var list = byArea[a.id] || [];
    var need = a.floor && a.id !== 'flex' ? areaNeedOn(iso, a.id) : null;
    if (!list.length && !need) return;
    var on = list.filter(function(w) { var m = rec ? rec.marks[w.id] : null; return m && (m.st === 'P' || m.st === 'H'); }).length;
    var dot = need == null ? '' : on < need ? uiDot('warning', 'Short ' + (need - on)) : on > need ? uiDot('info', (on - need) + ' over') : uiDot('ok', 'Met');
    html += '<div class="inv-panel inv-panel-flush" data-att-area-card="' + a.id + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(a.label) +
      ' <span class="inv-panel-count">' + on + (need != null ? '/' + need : '') + '</span></span>' + dot + '</div>' +
      (list.length ? list.map(function(w) { return _attBoardRow(w, rec ? rec.marks[w.id] : null); }).join('') : '<div class="inv-empty">Nobody here today.</div>') + '</div>';
  });
  // An area no longer on the list (a mark from an older build) still shows its hands.
  Object.keys(byArea).forEach(function(k) {
    if (STAFF_AREAS.some(function(a) { return a.id === k; })) return;
    html += '<div class="inv-panel inv-panel-flush" data-att-area-card="' + escHtml(k) + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(areaLabel(k)) + '</span></div>' +
      byArea[k].map(function(w) { return _attBoardRow(w, rec ? rec.marks[w.id] : null); }).join('') + '</div>';
  });
  html += '</div>';
  if (absentees.length) {
    html += '<div class="inv-panel inv-panel-flush" id="attAbsentList"><div class="inv-row inv-row-auto"><span class="inv-row-main"><span class="inv-row-meta">Absent · ' + absentees.length + '</span>' +
      '<span class="inv-row-wrap">' + escHtml(absentees.map(function(w) { return w.name; }).join(' · ')) + '</span></span></div></div>';
  }

  html += _attNeedCard(iso, rec);
  html += _attExtraCard(iso, rec);
  html += _attDayCostCard(iso);
  return html;
}

/* The day's cost, folded; none for a role that may not see wages (a day with one hand per tier gives each rate away). */
function _attDayCostCard(iso) {
  return attSeesWages() ? uiFoldCard('attDayCost', renderLabourCard(iso, iso, 'Day cost'), false) : '';
}

/* One hand on the board: the name (opens the area, hours and OT), what is recorded, and P / H / A. */
function _attBoardRow(w, m) {
  var st = m ? m.st : '', hourly = compIsHourly(w);
  var states = hourly ? ['P', 'A'] : ATT_STATES;
  var hrs = m && st !== 'A' ? (hourly ? (m.hours ? m.hours + ' h' : 'no hours') : (m.ot ? 'OT ' + m.ot + ' h' : '')) : '';
  if (m && st !== 'A' && attTimesText(m)) hrs = attTimesText(m) + (hrs ? ' · ' + hrs : '');
  var recD = attDay(_attDate, false);
  var slots = m && st !== 'A' ? ATT_SLOTS.map(function(z) { var a = attHandSlotArea(recD, w.id, z[0]); return a ? z[1] + ' ' + areaLabel(a) : ''; }).filter(Boolean) : [];
  if (slots.length) hrs = (hrs ? hrs + ' · ' : '') + slots.join(' · ');
  return '<div class="inv-row" data-att-row="' + w.id + '">' +
    '<button class="inv-row-main" data-action="invAttEdit" data-id="' + w.id + '"><span class="inv-row-title">' + escHtml(w.name) + '</span>' +
    '<span class="inv-row-meta">' + escHtml(compClass(w.comp).label) + (w.active === false ? ' · left' : '') +
    (m ? ' · ' + escHtml(ATT_STATE_LABELS[st] || '') + (hrs ? ' · ' + hrs : '') : ' · unmarked') + '</span></button>' +
    '<span class="inv-row-end"><span class="inv-seg" role="group" aria-label="Attendance for ' + escHtml(w.name) + '">' +
    states.map(function(x) {
      return '<button class="inv-seg-btn inv-seg-btn-' + ATT_STATE_TONE[x] + '" data-action="invAttSet" data-id="' + w.id +
        '" data-st="' + x + '" aria-pressed="' + (st === x) + '" title="' + ATT_STATE_LABELS[x] + '">' + x + '</button>';
    }).join('') + '</span></span></div>';
}

/* The day as Deepak's sheet (attsheet.js prints it): the roster in the sheet's order, one row a hand, P / H / A, the area,
   the in and the out, and the hours and OT worked out from them. Every change is saved as it is made, as on the board. */
var ATT_DAY_AS_KEY = 'sep_inv_att_day_as';
function attDayAsSheet() { try { return localStorage.getItem(ATT_DAY_AS_KEY) === 'sheet'; } catch (e) { return false; } }
function attDayAsSet(v) { try { localStorage.setItem(ATT_DAY_AS_KEY, v === 'sheet' ? 'sheet' : 'board'); } catch (e) { /* per device */ } }
function attSheetEntryHtml(iso, rec, roster) {
  var h = '<div class="inv-panel inv-panel-flush" id="attSheetEntry"><div class="inv-scroll-x"><table class="inv-table"><thead><tr>' +
    '<th>Hand</th><th>Attendance</th><th>General</th>' + ATT_SLOTS.map(function(z) { return '<th>' + z[1] + '</th>'; }).join('') +
    '<th>In</th><th>Out</th><th class="inv-num">Hours</th><th class="inv-num">OT</th></tr></thead><tbody>';
  roster.forEach(function(w) {
    var m = rec ? rec.marks[w.id] : null, st = m ? m.st : '', hourly = compIsHourly(w), live = st && st !== 'A';
    var states = hourly ? ['P', 'A'] : ATT_STATES;
    h += '<tr data-att-sheet-row="' + w.id + '"><td><button class="inv-btn-link" data-action="invAttEdit" data-id="' + w.id + '">' + escHtml(w.name) + '</button>' +
      '<div class="inv-row-meta">' + escHtml(compClass(w.comp).label) + (w.active === false ? ' · left' : '') + '</div></td>' +
      '<td><span class="inv-seg" role="group" aria-label="Attendance for ' + escHtml(w.name) + '">' + states.map(function(x) {
        return '<button class="inv-seg-btn inv-seg-btn-' + ATT_STATE_TONE[x] + '" data-action="invAttSet" data-id="' + w.id + '" data-st="' + x + '" aria-pressed="' + (st === x) + '" title="' + ATT_STATE_LABELS[x] + '">' + x + '</button>';
      }).join('') + '</span></td>' +
      '<td><select class="inv-select" data-att-area data-id="' + w.id + '" aria-label="Area for ' + escHtml(w.name) + '"' + (live ? '' : ' disabled') + '>' + attAreaOptions(m && m.area ? m.area : (w.area || 'flex')) + '</select></td>' +
      ATT_SLOTS.map(function(z) { return '<td>' + attSlotSelectHtml(rec, w, z[0], live, z[1]) + '</td>'; }).join('') +
      '<td><input type="time" class="inv-input inv-id" data-att-in data-id="' + w.id + '" value="' + escHtml(attTimeVal(m && m.inMin)) + '" aria-label="In for ' + escHtml(w.name) + '"' + (live ? '' : ' disabled') + '></td>' +
      '<td><input type="time" class="inv-input inv-id" data-att-out data-id="' + w.id + '" value="' + escHtml(attTimeVal(m && m.outMin)) + '" aria-label="Out for ' + escHtml(w.name) + '"' + (live ? '' : ' disabled') + '></td>' +
      '<td class="inv-num" data-att-sheet-hours>' + (live && (m.hours || attTimesText(m)) ? m.hours : '—') + '</td>' +
      '<td class="inv-num" data-att-sheet-ot>' + (live && !hourly ? (m.ot || 0) : '—') + '</td></tr>';
  });
  return h + '</tbody></table></div>' +
    '<div class="inv-note inv-panel-body">General is the area of the 8:30 AM to 5:00 PM shift; Morning OT, Evening OT and Night are where the hand stood on each, which puts them on that slot’s OT crew (the EXTRA rows below). Left blank, an in or out is the shift’s: 8:30 AM to 5:00 PM (the gate 7 to 7, a half day four hours). Hours are the span to the whole hour; OT is the hours over 8, never for an hourly hand or the gate. EXTRA rows are entered below.</div></div>';
}

/* A hand's day in a dialog: P / H / A, where they stood, and the hours (an hourly hand) or the overtime. Each change is
   saved as it is made, as on the board. */
var _attEditId = null;
function attEditHtml() {
  var w = staffById(_attEditId);
  if (!w) return '';
  var rec = attDay(_attDate, false), m = rec ? rec.marks[w.id] : null, st = m ? m.st : '', hourly = compIsHourly(w), live = st && st !== 'A';
  var states = hourly ? ['P', 'A'] : ATT_STATES;
  return '<div class="inv-dialog" role="dialog" aria-modal="true" aria-labelledby="attEditT" data-att-edit="' + w.id + '">' +
    dialogHeadHtml('<span id="attEditT">' + escHtml(w.name) + ' · ' + escHtml(attDayName(_attDate) + ' ' + formatDate(_attDate)) + '</span>', 'invAttEditClose') +
    '<div class="inv-dialog-body" data-nodirty><div class="inv-fields">' +
    '<div class="inv-field"><span class="inv-field-label">Attendance</span><span class="inv-seg" role="group" aria-label="Attendance">' +
    states.map(function(x) {
      return '<button class="inv-seg-btn inv-seg-btn-' + ATT_STATE_TONE[x] + '" data-action="invAttSet" data-id="' + w.id + '" data-st="' + x + '" aria-pressed="' + (st === x) + '">' + ATT_STATE_LABELS[x] + '</button>';
    }).join('') + '</span></div>' +
    '<label class="inv-field"><span class="inv-field-label">General shift area</span><select class="inv-select" data-att-area data-id="' + w.id + '"' + (live ? '' : ' disabled') + '>' +
    attAreaOptions(m && m.area ? m.area : (w.area || 'flex')) + '</select></label>' +
    '<label class="inv-field"><span class="inv-field-label">In</span><input type="time" class="inv-input inv-id" data-att-in data-id="' + w.id + '" value="' + escHtml(attTimeVal(m && m.inMin)) + '"' + (live ? '' : ' disabled') + '></label>' +
    '<label class="inv-field"><span class="inv-field-label">Out</span><input type="time" class="inv-input inv-id" data-att-out data-id="' + w.id + '" value="' + escHtml(attTimeVal(m && m.outMin)) + '"' + (live ? '' : ' disabled') + '></label>' +
    ATT_SLOTS.map(function(z) { return '<label class="inv-field"><span class="inv-field-label">' + z[1] + ' area</span>' + attSlotSelectHtml(rec, w, z[0], live, z[1]) + '</label>'; }).join('') +
    (hourly
      ? '<label class="inv-field"><span class="inv-field-label">Hours worked</span><input type="number" class="inv-input inv-input-num" data-att-hours data-id="' + w.id + '" step="0.5" min="0" value="' + (m && m.hours ? m.hours : '') + '"' + (live ? '' : ' disabled') + '></label>'
      : '<label class="inv-field"><span class="inv-field-label">Overtime, hours</span><input type="number" class="inv-input inv-input-num" data-att-ot data-id="' + w.id + '" step="0.5" min="0" value="' + (m && m.ot ? m.ot : '') + '"' + (live ? '' : ' disabled') + '></label>') +
    '</div>' + (live ? '<div class="inv-note" data-att-times-note>' + (attTimesText(m)
      ? escHtml(attTimesText(m) + ': ' + m.hours + ' h' + (hourly ? '' : ', OT ' + (m.ot || 0) + ' h') + ', worked out from the times. A figure typed below the times wins until a time is changed.')
      : 'Type the in and out from the sheet, and the hours and OT are worked out as a roll works them out. Left blank, the shift (8:30 AM to 5:00 PM) is assumed.') + '</div>'
      : '<div class="inv-note">' + (st === 'A' ? 'Absent: no area or hours.' : 'Mark the day first.') + '</div>') + '</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-primary" data-action="invAttEditClose" data-att-done>Done</button></div></div>';
}
function attEditOpen(id) { _attEditId = id; dialogOpen(attEditHtml()); }
/* The dialog follows the day: after a change it is drawn again in place (the board behind it is redrawn too). Its own
   scrim is drawn, never merely the top one: a word over it (a refusal, a question) is not written over. */
function attEditRefresh() {
  var dlg = _attEditId ? document.querySelector('[data-att-edit]') : null, scrim = dlg && dlg.closest('.inv-scrim-dialog');
  if (!scrim) return;
  var html = attEditHtml();
  if (!html) return;
  var focus = document.activeElement, k = focus && focus.dataset && scrim.contains(focus) ? (focus.hasAttribute('data-att-hours') ? '[data-att-hours]' : focus.hasAttribute('data-att-ot') ? '[data-att-ot]' : focus.hasAttribute('data-att-in') ? '[data-att-in]' : focus.hasAttribute('data-att-out') ? '[data-att-out]' : null) : null;
  scrim.innerHTML = html;
  if (k) { var el = scrim.querySelector('[data-att-edit] ' + k); if (el) try { el.focus(); } catch (x) { /* a convenience */ } }
}

/* ===== EXTRA HOURS =====
   What "the extra" is, and why it has no name against it.

   The daily relay books hours in two different ways. Named men carry their
   own out-time, and those hours are OT on the row above. But every day also
   carries lines like `EXTRA 16 HOURS` written against an *area block* — the
   barrel line, the 6 AM VAT slot — with no person attached. They are real paid
   hours at the contract tier, and the payout sheet settles them.

   So they are recorded as what they are: hours booked to an area. In the bill they
   are one pooled line, counted once, and never enter a per-worker wage, so the
   fixed-versus-variable split does not turn on how they are shared. Who receives
   them is ruled (28 Aug 2026): the short area's present crew, pro-rata, paid out
   by the supervisor on the floor — the Areas card works out that split. */
/* The three things a block row needs and a general-shift row does not.

   In and out give the multiplier; the areas give the complement; the crew
   gives the head count. None can be inferred from the marks — the marks say
   where a worker stood on the GENERAL shift, and the recorded blocks routinely
   move people (W31 Wed: a hand on barrel pickling all day is in the VAT A1
   evening block). Reading the marks would put the head in the wrong area and
   report a shortfall that never existed. */
function _attBlockAreaSummary(x) {
  var ids = (Array.isArray(x.areas) && x.areas.length) ? x.areas : (x.area ? [x.area] : []);
  if (!ids.length) return 'No area';
  return ids.map(function(id) {
    var a = STAFF_AREAS.find(function(y) { return y.id === id; });
    return a ? a.label : id;
  }).join(' + ');
}

function _attBlockFields(x, i, siblings) {
  var areas = (Array.isArray(x.areas) && x.areas.length) ? x.areas : (x.area ? [x.area] : []);
  var crew = Array.isArray(x.crew) ? x.crew : [];
  var hrs = blockLength(x);
  var span = blockSpan(x);
  var roster = staffActive();

  var html = '<div class="inv-mt-8" data-block="' + i + '">' +
    '<div class="inv-toolbar">' +
    '<div class="inv-field inv-toolbar-item"><label class="inv-field-label" for="blkFrom-' + i + '">In</label>' +
    '<input type="time" class="inv-input inv-id" id="blkFrom-' + i + '" data-att-block-from data-idx="' + i +
    '" value="' + escHtml(x.from || '') + '" aria-label="Block start time"></div>' +
    '<div class="inv-field inv-toolbar-item"><label class="inv-field-label" for="blkTo-' + i + '">Out</label>' +
    '<input type="time" class="inv-input inv-id" id="blkTo-' + i + '" data-att-block-to data-idx="' + i +
    '" value="' + escHtml(x.to || '') + '" aria-label="Block end time"></div>' +
    // Both lengths, whenever they differ: the clock span the operator typed
    // and the credited length the tag is judged against. Nothing is rounded
    // behind their back.
    // What this block needed: its own number, else the complement of the areas it covers (the fold included).
    '<div class="inv-field inv-toolbar-item"><label class="inv-field-label" for="blkNeed-' + i + '">Needed</label>' +
    '<input type="number" class="inv-input inv-input-num" id="blkNeed-' + i + '" data-att-block-need data-idx="' + i + '" step="1" min="0"' +
    ' placeholder="' + (function() { var c = {}; for (var k in x) c[k] = x[k]; delete c.need; var n = blockNorm(c, [c].concat(siblings || [])); return n != null ? formatNum(n, 1).replace(/\.0$/, '') : '—'; })() +
    '" value="' + (typeof x.need === 'number' ? x.need : '') + '" aria-label="Heads the block needed"></div>' +
    '<span class="inv-num inv-toolbar-end" data-block-len>' + (hrs == null ? '&mdash;'
      : (span != null && span !== hrs
        ? formatNum(span, 1) + ' h &rarr; ' + formatNum(hrs, 1) + ' credited'
        : formatNum(hrs, 1) + ' h')) + '</span>' +
    '</div>';

  // Areas as toggles rather than one select, because a block row genuinely
  // spans several: the relay writes one tag over A1 and A2 together about as
  // often as one each, and the complement differs between the two readings.
  html += '<div class="inv-field-label">Areas it covers</div>' +
    '<div class="inv-toolbar" role="group" aria-label="Areas the block covers" data-block-areas>';
  STAFF_AREAS.filter(function(a) { return a.floor && a.id !== 'flex'; }).forEach(function(a) {
    var on = areas.indexOf(a.id) >= 0;
    html += '<button class="inv-chip" data-action="invAttBlockArea" ' +
      'data-idx="' + i + '" data-area="' + escHtml(a.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
      escHtml(a.label) + '</button>';
  });
  html += '</div>';

  html += '<div class="inv-field-label">On the block <span class="inv-num" data-block-count>' + crew.length + '</span></div>' +
    '<div class="inv-toolbar" role="group" aria-label="Who stood the block" data-block-crew>';
  if (roster.length === 0) {
    html += '<span class="inv-note">No roster yet &mdash; import one on the Roster view</span>';
  } else {
    roster.forEach(function(w) {
      var on = crew.indexOf(w.id) >= 0;
      html += '<button class="inv-chip" data-action="invAttBlockCrew" ' +
        'data-idx="' + i + '" data-worker="' + w.id + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        escHtml(w.name) + '</button>';
    });
  }
  html += '</div>';

  // The prediction, in place, so the operator sees the check as they type it
  // rather than having to leave for the Areas view to find out.
  // The block itself, so its own Needed wins over the complement the way it does on the Areas card.
  var norm = blockNorm(x, [x].concat(siblings || []));
  // The preview must refuse on exactly the conditions `areaStats` refuses on,
  // or the two surfaces disagree about the same row. A crew nobody named is not
  // a crew of zero: zero heads is a real reading only where a sibling row of the
  // same block names its crew (the shop books a fully-short line that way), and
  // never for a crew the import could not match.
  var hasCrew = crew.length > 0 || (!x.crewUnknown && (siblings || []).some(function(r) { return Array.isArray(r.crew) && r.crew.length > 0; }));
  if (hrs != null && norm != null && hasCrew) {
    var short = Math.max(0, norm - crew.length);
    var expect = gstRound(short * hrs);
    var booked = x.hours || 0;
    var ok = Math.abs(booked - expect) <= 0.001;
    html += '<div class="inv-callout' + (ok ? '' : ' inv-callout-warning') + '" data-block-check="' + (ok ? 'ok' : 'differs') + '">' +
      '<span class="inv-dot inv-dot-' + (ok ? 'ok' : 'warning') + '">' + (ok ? 'Matches' : 'Differs') + '</span> ' +
      crew.length + ' of ' + norm + ' &middot; short ' + short + ' &times; ' + formatNum(hrs, 1) + ' h = ' +
      '<strong>' + formatNum(expect, 1) + ' h</strong>' +
      (ok ? '' : ' &middot; booked ' + formatNum(booked, 1)) + '</div>';
  } else {
    var missing = [];
    if (hrs == null) missing.push('in/out times');
    if (norm == null) missing.push('an area with a complement');
    if (!hasCrew) missing.push('its crew');
    html += '<div class="inv-callout" data-block-check="none">Not checkable yet &mdash; needs ' +
      escHtml(missing.join(', ')) + '. The hours still count in the bill.</div>';
  }

  return html + '</div>';
}

/* Needed today: the heads each floor area stood on the general shift against what the shift needed (areaNeedOn). The
   box starts at the area's usual complement and takes the day's own number; blank goes back to the usual. */
function _attNeedCard(iso, rec) {
  // Every hand marked that day counts where the mark says, one who has since left included (the Areas card's rule).
  var heads = {};
  Object.keys(rec ? rec.marks : {}).forEach(function(id) {
    var m = rec.marks[id], w = staffById(id);
    if (!m || (m.st !== 'P' && m.st !== 'H')) return;
    var a = m.area || (w && w.area) || 'flex';
    heads[a] = (heads[a] || 0) + 1;
  });
  var html = '<details class="inv-panel inv-panel-flush inv-panel-fold" id="attNeed" data-fold="attNeed"' + (uiFoldOpen('attNeed', false) ? ' open' : '') + '><summary class="inv-panel-head"><span class="inv-panel-title">Needed today</span><span class="inv-note">the numbers on each card</span></summary>' +
    '<div class="inv-panel-body inv-note">The general shift: who stood in each area against what the shift needed. The box starts at the area&rsquo;s usual number ' +
    '(Areas); type the day&rsquo;s own, 0 when the line did not need anyone, or clear it for the usual. The shortfall and the extra are judged against it. ' +
    'An OT or night block takes its own number under Extra hours.</div>';
  STAFF_AREAS.filter(function(a) { return a.floor && a.id !== 'flex'; }).forEach(function(a) {
    var need = areaNeedOn(iso, a.id), usual = areaTarget(a.id), h = heads[a.id] || 0, set = areaNeedSet(iso, a.id);
    var dot = need == null ? uiDot('neutral', 'No number') : h < need ? uiDot('warning', 'Short ' + (need - h)) : h > need ? uiDot('info', (h - need) + ' over') : uiDot('ok', 'Met');
    html += '<div class="inv-row inv-row-2" data-need-area="' + a.id + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(a.label) + '</span>' +
      '<span class="inv-row-meta">' + h + ' on the floor' + (set && usual != null ? ' · usually ' + usual : '') + '</span></span>' +
      '<span class="inv-row-end"><input type="number" class="inv-input inv-input-sm inv-input-num" data-att-need data-area="' + a.id + '" step="1" min="0"' +
      ' placeholder="' + (usual != null ? usual : '—') + '" value="' + (set ? need : '') + '" aria-label="Needed in ' + escHtml(a.label) + '">' + dot + '</span></div>';
  });
  return html + '</details>';
}

/* A block's own number (blockNorm reads it first); blank goes back to the areas' complement. */
function setAttBlockNeed(idx, v) {
  if (!attFloorOk()) return false;
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  var n = String(v).trim() === '' ? NaN : Math.floor(Number(v));
  if (!isNaN(n) && n >= 0) rec.extra[idx].need = n; else delete rec.extra[idx].need;
  _attHandEdit(rec.extra[idx]);
  saveState();
  return true;
}

function _attExtraCard(iso, rec) {
  // A block made for a hand's slot pick books nothing and is no EXTRA row: it is the pick, shown on the hand's line.
  var all = rec ? rec.extra : [], rows = attExtraRows(rec);
  var html = '<div class="inv-panel inv-panel-flush" id="attExtra"><div class="inv-panel-head">' +
    '<span class="inv-panel-title">Extra hours ' + (rows.length ? '<span class="inv-panel-count">' + rows.length + '</span>' : '') + '</span>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAttAddExtra">Add</button></div>' +
    '<div class="inv-panel-body inv-note">Hours booked to an area block rather than to a named worker &mdash; ' +
    'the <span class="inv-id">EXTRA n HOURS</span> lines on the daily sheet. ' +
    (attSeesWages() ? 'Priced at the contract tier (' + formatCurrency((S.labour && S.labour.extraRate) || 0) + '/h) and counted' : 'Counted') + ' in the bill. ' +
    'Both kinds are checked against the shortfall in the area that ran; they differ only in the ' +
    '<strong>multiplier</strong>. A general shift credits a missing hand a full eight hours. An ' +
    '<strong>OT block</strong> credits it the block&rsquo;s own length, so it needs its in and out ' +
    'times and its crew &mdash; the day&rsquo;s marks supply neither, because a hand on one area ' +
    'all day turns up in another area&rsquo;s evening block.</div>';
  if (rows.length === 0) {
    html += '<div class="inv-empty">None booked for this day</div>';
  } else {
    // data-idx is the row's place in the day's rows, the made blocks included: the setters read it.
    all.forEach(function(x, i) {
      if (attSlotMade(x)) return;
      var kind = x.kind || 'coverage';
      html += '<div class="inv-row inv-row-top inv-row-auto" data-extra-row="' + i + '"><div class="inv-row-main">' +
        '<div class="inv-toolbar inv-toolbar-flush">' +
        '<select class="inv-select inv-toolbar-item" data-att-extra-kind data-idx="' + i + '" aria-label="Kind of extra hours">' +
        EXTRA_KINDS.map(function(k) {
          return '<option value="' + k.id + '"' + (kind === k.id ? ' selected' : '') + '>' + escHtml(k.label) + '</option>';
        }).join('') + '</select>' +
        // A block row's areas are the chips below; showing the single-area
        // select as well would let the operator set an area the reconciler
        // never reads, and the hours would bucket somewhere the check does
        // not look.
        (kind === 'block'
          ? '<span class="inv-toolbar-item inv-row-title">' + escHtml(_attBlockAreaSummary(x)) + '</span>'
          : '<select class="inv-select inv-toolbar-item" data-att-extra-area data-idx="' + i + '" aria-label="Area for extra hours">' +
            attAreaOptions(x.area) + '</select>') +
        '<input type="number" class="inv-input inv-input-num inv-toolbar-item" data-att-extra-hours data-idx="' + i +
        '" step="0.5" min="0" value="' + (x.hours || 0) + '" aria-label="Extra hours">' +
        '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invAttRemoveExtra" data-idx="' + i +
        '" aria-label="Remove">&times;</button>' +
        '</div>' +
        '<div class="inv-note inv-mt-4">' + escHtml((EXTRA_KINDS.find(function(k) { return k.id === kind; }) || EXTRA_KINDS[0]).hint) + '</div>';
      // Siblings matter: the pickling fold depends on whether ANOTHER row in
      // the same block tags pickling, so the preview must see them or it will
      // disagree with the Areas card over the same day.
      if (kind === 'block') {
        html += _attBlockFields(x, i, rows.filter(function(r) {
          return r !== x && r.kind === 'block' && blockKey(r) === blockKey(x);
        }));
      }
      html += '</div></div>';
    });
  }
  return html + '</div>';
}

/* ===== WEEK VIEW ===== */

function _attWeekView() {
  var days = attWeekDays(_attWeekStart);
  // The active roster, and anyone marked in the week who has since left (attDayRoster).
  var roster = staffActive().slice();
  days.forEach(function(d) { attDayRoster(attDay(d, false)).forEach(function(w) { if (roster.indexOf(w) < 0) roster.push(w); }); });
  var last = days[days.length - 1];
  var today = localDateStr();

  var html = _attStepper('invAttWeekStep', _attWeekLabel('Week ' + attPayWeekNumber(_attWeekStart),
    formatDate(_attWeekStart) + ' &ndash; ' + formatDate(last)), 'invAttThisWeek', 'This week', 'Previous week', 'Next week');

  html += '<div class="inv-panel inv-panel-flush" id="attWeekGrid"><div class="inv-panel-head"><span class="inv-panel-title">Week grid</span></div>' +
    '<div class="inv-panel-body inv-note">Tap a cell to cycle it: present, half day, absent, then back to unmarked. ' +
    'An unmarked cell is a day nobody typed &mdash; which is not the same fact as a day nobody worked, ' +
    'and the labour figures below keep the two apart. The figure in a cell is the hours that decide the pay: ' +
    'the whole day for the hourly pool, the overtime for everyone else.</div>' +
    '<div class="inv-scroll-x"><table class="inv-table inv-table-grid">' +
    '<thead><tr><th scope="col">Worker</th>' +
    days.map(function(d) {
      return '<th scope="col"' + (d === today ? ' aria-current="date"' : '') + (attParseIso(d).getDay() === 0 ? ' data-sun' : '') + '>' +
        attDayName(d) + '<span class="inv-table-grid-date">' + attParseIso(d).getDate() + '</span></th>';
    }).join('') + '</tr></thead><tbody>';

  roster.forEach(function(w) {
    var cls = compClass(w.comp);
    var hourly = compIsHourly(w);
    var left = w.active === false;
    html += '<tr' + (left ? ' data-left' : '') + '><th scope="row" title="' + escHtml(w.name + ' · ' + cls.label + (left ? ' · left' : '')) + '">' + escHtml(w.name) +
      ' <span class="inv-unit">' + cls.short + (left ? ' · left' : '') + '</span></th>';
    days.forEach(function(d) {
      var m = attMark(d, w.id);
      var st = m ? m.st : '';
      // The figure is the hours that decide this worker's pay: the whole
      // day for the hourly pool, the overtime on top for everyone else.
      var badge = m ? (hourly ? (m.hours || 0) : (m.ot || 0)) : 0;
      html += '<td' + (attParseIso(d).getDay() === 0 ? ' data-sun' : '') + '><button class="inv-cell inv-cell-' +
        (st ? ATT_STATE_TONE[st] : 'empty') + '" data-action="invAttCycle" data-id="' + w.id + '" data-date="' + d +
        '" aria-label="' + escHtml(w.name) + ' ' + attDayName(d) + ' ' + (st ? ATT_STATE_LABELS[st] : 'unmarked') +
        (badge ? ', ' + formatNum(badge, 1) + ' hours' : '') + '">' +
        (st || '&middot;') + (badge ? '<span class="inv-unit">' + formatNum(badge, 0) + '</span>' : '') +
        '</button></td>';
    });
    html += '</tr>';
  });

  html += '</tbody><tfoot><tr><th scope="row">On site</th>' +
    days.map(function(d) {
      var rec = attDay(d, false);
      if (!rec) return '<td class="inv-num"' + (attParseIso(d).getDay() === 0 ? ' data-sun' : '') + '>&mdash;</td>';
      var n = 0;
      roster.forEach(function(w) {
        var m = rec.marks[w.id];
        if (m && (m.st === 'P' || m.st === 'H')) n++;
      });
      return '<td class="inv-num"' + (attParseIso(d).getDay() === 0 ? ' data-sun' : '') + '>' + n + '<span class="inv-unit">/' + roster.length + '</span></td>';
    }).join('') + '</tr></tfoot></table></div></div>';

  // A role that may not see wages sees the week's marks, never its cost (one hand per tier gives a rate away).
  if (attSeesWages()) html += renderLabourCard(_attWeekStart, isoAddDays(_attWeekStart, 6), 'Week cost');
  return html;
}

/* ===== ROSTER VIEW ===== */
function _attRosterView() {
  var all = (S.staff || []).slice().sort(function(a, b) {
    if ((a.active !== false) !== (b.active !== false)) return a.active !== false ? -1 : 1;
    // Order by tier, then by name. Comparing against a single id was both
    // asymmetric (two non-monthly classes never fell through to the name) and
    // written against a comp id that no longer exists.
    var ai = COMP_CLASSES.findIndex(function(c) { return c.id === a.comp; });
    var bi = COMP_CLASSES.findIndex(function(c) { return c.id === b.comp; });
    if (ai !== bi) return ai - bi;
    return (a.name || '').localeCompare(b.name || '');
  });
  var activeCount = all.filter(function(w) { return w.active !== false; }).length;

  var html = '<div class="inv-toolbar">' +
    '<button class="inv-btn inv-btn-primary" data-action="invAttAddWorker">Add worker</button>' +
    '<button class="inv-btn inv-btn-ghost" data-action="invAttImportRoster">Import</button>' +
    (typeof pplOwner !== 'function' || pplOwner() ? '<button class="inv-btn inv-btn-ghost" data-action="invIdcPrint">ID cards</button><button class="inv-btn inv-btn-ghost" data-action="invCkSetup">Office QR</button>' : '') + '</div>' +
    '<div class="inv-pagehead"><span class="inv-pagehead-meta">' + activeCount + ' active of ' + all.length + ' on file. ' +
    'The denominator on every headcount is this number.</span></div>';

  // A role that may not see wages sees the roster without its rates (the guard's "wages" setting).
  var wages = typeof grdSeesWages !== 'function' || grdSeesWages();
  if (_isDesktop && all.length) return html + _attRosterDesktop(all, wages);
  html += '<div class="inv-panel inv-panel-flush" id="attRoster"><div class="inv-panel-head"><span class="inv-panel-title">Roster ' +
    '<span class="inv-panel-count">' + all.length + '</span></span></div>';
  if (all.length === 0) return html + '<div class="inv-empty">Nobody on file yet</div></div>';

  // Each worker at a glance (people.js, the 6-second rule): tenure, reliability, consistency and workload as short bars with
  // their figures, the top skills, and for the owner the motivation index.
  var memo = typeof payLabMemo === 'function' ? payLabMemo() : null;
  all.forEach(function(w) {
    var cls = compClass(w.comp);
    var inactive = w.active === false;
    html += '<button class="inv-row inv-row-2 inv-row-flow' + (inactive ? ' inv-row-muted' : '') + '" data-action="invAttEditWorker" data-id="' + w.id + '">' +
      '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(w.name) + '</span>' +
      (wages ? '<span class="inv-row-meta inv-id">' + escHtml(workerRateLabel(w)) + '</span>' : '') +
      (inactive ? '' : pplGlanceHtml(w, memo)) + '</span>' +
      '<span class="inv-row-end">' +
      '<span class="inv-badge">' + escHtml(cls.label) + '</span>' +
      '<span class="inv-badge">' + escHtml(areaLabel(w.area)) + '</span>' +
      (w.onFloor === false ? '<span class="inv-badge inv-badge-info">Off floor</span>' : '') +
      (inactive ? '<span class="inv-badge inv-badge-neutral">Inactive</span>' : '') +
      '</span></button>';
  });
  return html + '</div>';
}

/* The desktop's roster: a table beside the open worker (UX overhaul 2, step 7). The phone opens the worker's edit sheet. */
function _attRosterDesktop(all, wages) {
  var open = _attRosterOpen != null ? staffById(_attRosterOpen) : null;
  if (!open) _attRosterOpen = null;
  var h = '<div class="inv-pane-host' + (open ? ' inv-pane-open' : '') + '" id="attRosterHost" data-open="' + (open ? escHtml(String(open.id)) : '') + '"><div class="inv-pane-list">' +
    '<table class="inv-table" id="attRosterTable"><thead><tr><th class="inv-col-grow">Name</th><th>Tier</th>' + (wages ? '<th class="inv-col-opt3">Rate</th>' : '') +
    '<th>Area</th><th>Status</th></tr></thead><tbody>';
  var memo = typeof payLabMemo === 'function' ? payLabMemo() : null;
  all.forEach(function(w) {
    var inactive = w.active === false, id = escHtml(String(w.id));
    h += '<tr data-action="invAttRosterOpen" data-id="' + id + '"' + (inactive ? ' class="inv-row-muted"' : '') + (open && String(open.id) === String(w.id) ? ' aria-current="true"' : '') + '>' +
      '<td class="inv-col-grow"><button class="inv-btn-link" data-action="invAttRosterOpen" data-id="' + id + '">' + escHtml(w.name) + '</button>' + (inactive ? '' : pplGlanceHtml(w, memo)) + '</td>' +
      '<td>' + escHtml(compClass(w.comp).label) + '</td>' +
      (wages ? '<td class="inv-col-opt3 inv-id" title="' + escHtml(workerRateLabel(w)) + '">' + escHtml(workerRateLabel(w)) + '</td>' : '') +
      '<td>' + escHtml(areaLabel(w.area)) + (w.onFloor === false ? ' <span class="inv-badge inv-badge-info">Off floor</span>' : '') + '</td>' +
      '<td>' + (inactive ? '<span class="inv-dot inv-dot-neutral">Inactive</span>' : '<span class="inv-dot inv-dot-ok">Active</span>') + '</td></tr>';
  });
  return h + '</tbody></table></div><div class="inv-pane" id="attRosterPane">' + (open ? _attWorkerPaneHtml(open, wages) : '') + '</div></div>';
}

/* One worker: who they are on the roster, and the last four pay weeks as the marks have them. */
function _attWorkerPaneHtml(w, wages) {
  var cls = compClass(w.comp), today = localDateStr();
  var kv = [['Tier', cls.label], ['Home area', areaLabel(w.area)], ['On the floor', w.onFloor === false ? 'No' : 'Yes'], ['Status', w.active === false ? 'Inactive' : 'Active']];
  if (wages) kv.splice(1, 0, ['Rate', workerRateLabel(w)]);
  if ((w.relayNames || []).length) kv.push(['Spellings on the rolls', w.relayNames.join(', ')]);
  var n = { P: 0, H: 0, A: 0 }, hours = 0, ot = 0, days = 0, areas = {}, last = '';
  for (var i = 0; i < 28; i++) {
    var iso = isoAddDays(today, -i), m = attMark(iso, w.id);
    if (!m || !n.hasOwnProperty(m.st)) continue;
    n[m.st]++; days++;
    if (!last) last = iso;
    if (m.st !== 'A') { hours += +m.hours || 0; ot += +m.ot || 0; if (m.area) areas[m.area] = (areas[m.area] || 0) + 1; }
  }
  var where = Object.keys(areas).sort(function(a, b) { return areas[b] - areas[a]; }).map(function(a) { return areaLabel(a) + ' ' + areas[a]; }).join(' · ');
  var h = paneHeadHtml('<span class="inv-panel-title">' + escHtml(w.name) + '</span>', 'invAttRosterClose') +
    '<div class="inv-panel" data-worker-pane="' + escHtml(String(w.id)) + '"><div class="inv-kv">' + kv.map(function(x) {
      return '<div' + (x[0] === 'Rate' || x[0] === 'Spellings on the rolls' ? ' class="inv-kv-wide"' : '') + '><div class="inv-kv-k">' + escHtml(x[0]) + '</div><div>' + escHtml(x[1]) + '</div></div>';
    }).join('') + '</div></div>' +
    '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">The last 28 days</span>' +
    '<span class="inv-panel-count">' + (days ? todoPlural(days, 'day') + ' marked' : 'nothing marked') + '</span></div>';
  if (days) {
    h += '<div class="inv-tiles">' +
      '<div class="inv-tile"><div class="inv-tile-label">Present</div><div class="inv-tile-value">' + n.P + '</div><div class="inv-tile-sub">' + (n.H ? n.H + ' half' : 'no half days') + '</div></div>' +
      '<div class="inv-tile"><div class="inv-tile-label">Absent</div><div class="inv-tile-value">' + n.A + '</div><div class="inv-tile-sub">marked absent</div></div>' +
      '<div class="inv-tile"><div class="inv-tile-label">Hours</div><div class="inv-tile-value">' + formatNum(hours, 0) + '</div><div class="inv-tile-sub">' + (ot ? formatNum(ot, 0) + ' of them OT' : 'no OT') + '</div></div>' +
      '</div>' + (where ? '<div class="inv-panel-body inv-note">Stood in ' + escHtml(where) + '. Last marked ' + escHtml(formatDate(last)) + '.</div>' : '');
  } else h += '<div class="inv-empty">No day in the last 28 marks this worker.</div>';
  h += '</div><div class="inv-toolbar"><button class="inv-btn inv-btn-secondary" data-action="invAttEditWorker" data-id="' + escHtml(String(w.id)) + '">Edit</button></div>';
  // Their record (people.js): tenure, reliability, consistency, workload, skills, ties; the owner's alone, motivation and details.
  return h + pplRecordHtml(w);
}

/* The hourly rate a worker's overtime is paid at.

   For the monthly tier it is derived — `₹/day ÷ 8` — which is what makes the
   rate card's own OT column fall out of the day rate rather than being a second
   number to keep in step with it. An explicit `hourRate` still overrides, for a
   worker whose overtime was negotiated apart from their day. */
/* A monthly hand on a contracted MONTHLY wage (BM, 14 Sep 2026: "Uday is
   9000/month. per day is calculated as per days in that month") has no fixed
   day rate: it is the wage over the days in the month the day falls in. */
function workerDayRate(w, iso) {
  if (!w) return 0;
  if (w.comp === 'monthly' && w.monthWage > 0) return w.monthWage / labourDaysInMonth(iso || localDateStr());
  return w.dayRate || 0;
}
function workerOtRate(w, iso) {
  if (!w) return 0;
  if (w.hourRate > 0) return w.hourRate;
  if (w.comp === 'monthly') return workerDayRate(w, iso) / 8;
  return 0;
}
/* What one overtime hour pays: the OT rate × the multiplier, and for the
   monthly tier CAPPED (owner, 25 Sep 2026: "monthly hands get OT at day rate ÷
   8 × 1.1. Capped at 68.2"). The cap binds a day rate above ₹496 — Shyam's
   ₹576 would pay ₹79.20 an hour, and pays ₹68.20 — and only on OT dated on or
   after `otCapFrom`: the cap applies from September, and July and August were
   paid uncapped. With no date the cap applies, which is the rate going forward. */
function workerOtHourPay(w, cfg, iso) {
  cfg = cfg || labourCfg();
  var pay = workerOtRate(w, iso) * cfg.otMult;
  var capped = !iso || !cfg.otCapFrom || iso >= cfg.otCapFrom;
  if (w && w.comp === 'monthly' && cfg.otCap > 0 && capped) pay = Math.min(pay, cfg.otCap);
  return pay;
}

/* The OT figure is what one overtime hour pays going forward (workerOtHourPay): the rate × the multiplier, the monthly
   tier capped. It showed the rate before either, so Shyam's ₹576 a day read ₹72.00/h where an hour pays ₹68.20. */
function workerRateLabel(w) {
  var cls = compClass(w.comp), cfg = labourCfg();
  if (cls.id === 'hourly') return formatCurrency(w.hourRate || 0) + '/h, every hour';
  var pay = workerOtHourPay(w, cfg), capped = cls.id === 'monthly' && cfg.otCap > 0 && workerOtRate(w) * cfg.otMult > pay + 0.001;
  var ot = 'OT ' + formatCurrency(pay) + '/h' + (capped ? ' (capped)' : cls.id === 'monthly' && !(w.hourRate > 0) ? ' (day rate ÷ 8 × ' + formatNum(cfg.otMult, 1) + ')' : '');
  if (cls.id === 'monthly' && w.monthWage > 0) {
    return formatCurrency(w.monthWage) + '/month · ' + formatCurrency(workerDayRate(w)) + '/day this month · ' + ot;
  }
  return formatCurrency(w.dayRate || 0) + '/day · ' + ot;
}

/* ===== ACTIONS ===== */
function attSetView(view) {
  _attView = view;
  renderAttendance();
}

function attStepDay(n) {
  _attDate = isoAddDays(_attDate || localDateStr(), n);
  renderAttendance();
}

function attGoToday() {
  _attDate = localDateStr();
  _attWeekStart = attWeekStartOf(_attDate);
  renderAttendance();
}

function attStepWeek(n) {
  _attWeekStart = isoAddDays(_attWeekStart || attWeekStartOf(localDateStr()), n * 7);
  renderAttendance();
}

function attThisWeek() {
  _attWeekStart = attWeekStartOf(localDateStr());
  renderAttendance();
}

function attSetDate(iso) {
  if (!iso) return;
  _attDate = iso;
  _attWeekStart = attWeekStartOf(iso);
  renderAttendance();
}

/* Writes one mark. `st` of '' clears the row back to unmarked, and a cleared
   row takes its OT with it — hours nobody was present for are not hours. */
function attSetState(iso, staffId, st) {
  if (!attFloorOk()) return false;
  var w = staffById(staffId);
  if (!w) return;
  var rec = attDay(iso, true);
  if (!st) {
    delete rec.marks[staffId];
  } else {
    var m = rec.marks[staffId] || { ot: 0, hours: 0, area: w.area || 'flex' };
    var was = m.st;
    // An absence carries no place (a roll writes it Flex): back from absent, a hand stands at their own area.
    if (m.st === 'A' && st !== 'A' && (!m.area || m.area === 'flex')) m.area = w.area || 'flex';
    m.st = st;
    _attHandEdit(m);
    // Absent pays nothing and worked nothing: hours that nobody was here for
    // are not hours, in either tier.
    if (st === 'A') { m.ot = 0; m.hours = 0; delete m.inMin; delete m.outMin; }
    // Present and half day with times typed: a half day is four hours from its in, so the hours and OT are worked out again.
    else if ((was === 'P' || was === 'H') && was !== st && (m.inMin != null || m.outMin != null)) attTimesApply(m, w);
    rec.marks[staffId] = m;
  }
  _attPrune(iso);
  saveState();
  return true;
}

function setAttState(staffId, st) {
  var cur = attMark(_attDate, staffId);
  attSetState(_attDate, staffId, (cur && cur.st === st) ? '' : st);
  renderAttendance();
}

/* Week grid cycle: unmarked → P → H → A → unmarked. */
function cycleAttState(staffId, iso) {
  var cur = attMark(iso, staffId);
  // No half day in the hourly cycle — the hours field carries that granularity,
  // and a state the pay model cannot price should not be reachable by tapping.
  var order = compIsHourly(staffById(staffId)) ? ['', 'P', 'A'] : ['', 'P', 'H', 'A'];
  var idx = order.indexOf(cur ? cur.st : '');
  attSetState(iso, staffId, order[(idx + 1) % order.length]);
  renderAttendance();
}

function setAttOt(staffId, hours) {
  if (!attFloorOk()) return false;
  var m = attMark(_attDate, staffId);
  if (!m) return;                       // OT without a presence mark is not a fact
  m.ot = Math.max(0, Number(hours) || 0);
  _attHandEdit(m);
  saveState();
  return true;
}

/* Hours worked, for the hourly pool. Same guard as OT: hours without a
   presence mark are not a fact about the day. */
function setAttHours(staffId, hours) {
  if (!attFloorOk()) return false;
  var m = attMark(_attDate, staffId);
  if (!m) return;
  m.hours = Math.max(0, Number(hours) || 0);
  _attHandEdit(m);
  saveState();
  return true;
}

/* A field's change, written: drawn around the field when it was saved, the day drawn again (the field put back as stored)
   when it was not (refused, or nothing to write it to). */
function attFieldDone(el, saved) { if (saved) attRedrawAround(el); else renderAttendance(); }

/* The shifts a hand works in a day (owner, 1 Oct 2026: "there is also no way to record which area the OT workers actually
   worked on, we get to select one option for the entire day. Every worker can have states, like morning OT, General, Evening
   OT, Late night OT, etc."). The General shift is the mark's own area. Each OT slot is the crew of that slot's block on the
   day (the EXTRA rows' kind 'block': areas, crew, from, to), the one record Areas, Power and Production's crews already read:
   putting a hand on Evening OT · VAT A2 adds them to the evening block covering VAT A2, made at the slot's usual times
   (hours 0, no EXTRA booked, `slotMade`) when there is none. A slot is read off a block's start: before 8:30 AM the morning,
   from 5 PM the evening, from 8 PM (or past midnight) the night.

   The hand's own pick is a fact of the DAY, kept apart from the marks and the EXTRA rows (the QA of 2 Oct 2026): it was only
   a crew, so a block made for it read as one entered by hand and a roll's evening block was "kept, not added" beside it
   (its EXTRA lost), and a pick on a roll's block made that block the owner's, so reading the rolls again left the slot
   without the roll's other rows. `rec.slotHand[staffId][slot]` is the area picked, or '' when taken off the slot by hand.
   attSlotsApply puts the crews right from the picks, after a pick and after a roll is saved or read again; a pick never
   makes a roll's row the owner's, and crew the roll named for a hand with no pick is left as the roll wrote it. */
var ATT_SLOTS = [['morning', 'Morning OT', '06:00', '08:30'], ['evening', 'Evening OT', '17:00', '20:00'], ['night', 'Night', '20:00', '06:00']];
/* A block this app made for a pick: it books nothing and is nobody's EXTRA row (not on the EXTRA card, the sheets, History
   or the Areas check); it is only where the picked hands stood. */
function attSlotMade(x) { return !!(x && x.slotMade); }
function attSlotsApply(rec) {
  if (!rec) return;
  var picks = rec.slotHand || {};
  if (!Array.isArray(rec.extra)) rec.extra = [];
  Object.keys(picks).forEach(function(sid) {
    var w = staffById(sid), id = w ? w.id : sid, mine = picks[sid] || {};   // the crew holds the roster's own id
    ATT_SLOTS.forEach(function(z) {
      if (!Object.prototype.hasOwnProperty.call(mine, z[0])) return;
      var areaId = mine[z[0]];
      rec.extra.forEach(function(x) {
        if (attBlockSlot(x) !== z[0] || !Array.isArray(x.crew)) return;
        for (var i = _attCrewAt(x, id); i >= 0; i = _attCrewAt(x, id)) x.crew.splice(i, 1);
      });
      if (!areaId) return;
      // The block of the slot that covers the area: one the roll wrote or one entered by hand, before one made for a pick.
      var on = rec.extra.filter(function(x) { return attBlockSlot(x) === z[0] && _attBlockAreas(x).indexOf(areaId) >= 0; });
      var blk = on.find(function(r) { return !attSlotMade(r); }) || on[0];
      if (!blk) { blk = { kind: 'block', areas: [areaId], area: areaId, crew: [], hours: 0, from: z[2], to: z[3], slotMade: true }; rec.extra.push(blk); }
      if (!Array.isArray(blk.crew)) blk.crew = [];
      blk.crew.push(id);
    });
  });
  // A block made for a pick that nobody stands on any more goes.
  rec.extra = rec.extra.filter(function(x) { return !(attSlotMade(x) && !(x.crew || []).length && !(x.hours > 0)); });
}
function attBlockSlot(x) {
  if (!x || x.kind !== 'block') return null;
  var a = relayParseHhmm(x.from);
  if (a == null) return null;
  if (a >= 1200 || a < 240) return 'night';
  if (a < 510) return 'morning';
  if (a >= 1020) return 'evening';
  return null;
}
function _attBlockAreas(x) { return Array.isArray(x.areas) && x.areas.length ? x.areas : (x.area ? [x.area] : []); }
/* The block a hand stands on in a slot, or null. */
function _attCrewAt(x, staffId) {
  var k = String(staffId);
  return Array.isArray(x.crew) ? x.crew.findIndex(function(c) { return String(c) === k; }) : -1;
}
function attHandSlot(rec, staffId, slot) {
  return (rec && rec.extra || []).find(function(x) { return attBlockSlot(x) === slot && _attCrewAt(x, staffId) >= 0; }) || null;
}
/* The area a hand stood in on a slot, '' on none: the hand's own pick; else the block's own first area (a block over Barrel
   and VAT A2 is Barrel until VAT A2 is picked); a block that named no line (a roll's, saved Flex) is the hand's general
   shift's area, never Flex for want of one. Read by the sheet's and the dialog's picks, the board and attHoursSplit. */
function attHandSlotArea(rec, staffId, slot) {
  var pick = rec && rec.slotHand ? rec.slotHand[String(staffId)] : null;
  if (pick && Object.prototype.hasOwnProperty.call(pick, slot)) return pick[slot] || '';
  var x = attHandSlot(rec, staffId, slot);
  if (!x) return '';
  var own = Array.isArray(x.areas) && x.areas.length ? x.areas : (x.area && x.area !== 'flex' ? [x.area] : []);
  if (own.length) return own[0];
  var m = rec.marks ? rec.marks[staffId] : null, w = staffById(staffId);
  return (m && m.area) || (w && w.area) || 'flex';
}
function setAttSlotArea(staffId, slot, areaId) {
  if (!attFloorOk()) return false;
  var w = staffById(staffId), def = ATT_SLOTS.find(function(z) { return z[0] === slot; });
  if (!def || !w) return;
  var rec = attDay(_attDate, true);
  if (!rec.slotHand || typeof rec.slotHand !== 'object') rec.slotHand = {};
  var mine = rec.slotHand[String(w.id)] || (rec.slotHand[String(w.id)] = {});
  mine[slot] = areaId || '';
  attSlotsApply(rec);
  _attPrune(_attDate);
  saveState();
  return true;
}
/* The area of the latest OT slot a hand stood on that day, '' when they stood on none. */
function attOtSlotArea(rec, w) {
  for (var i = ATT_SLOTS.length - 1; i >= 0; i--) { var a = attHandSlotArea(rec, w.id, ATT_SLOTS[i][0]); if (a) return a; }
  return '';
}
/* Where a mark's hours were worked: the general shift's area and the OT slot's (the QA of 2 Oct 2026: Labour moved overtime
   to the slot while the Areas card and Hours by area kept it on the general shift, and an hourly hand's evening hours were
   never moved). One split, read by all three. A monthly or daily hand's overtime (m.ot) is booked where it was worked; an
   hourly hand has no overtime of their own, so the hours past eight go to the slot's area when the hand stood on one, and
   stay with the general shift's when not. → { area, otArea, otHours }: the general shift's area, the OT's, and the hours
   booked to the OT's area (a monthly or daily hand's OT, an hourly hand's hours past eight on a slot). */
function attHoursSplit(rec, w, m) {
  var area = (m && m.area) || (w && w.area) || 'flex';
  var slot = rec && w ? attOtSlotArea(rec, w) : '';
  if (w && w.comp === 'hourly') return { area: area, otArea: slot || area, otHours: slot ? Math.max(0, (Number(m && m.hours) || 0) - 8) : 0 };
  return { area: area, otArea: slot || area, otHours: Number(m && m.ot) || 0 };
}
function attSlotSelectHtml(rec, w, slot, live, label) {
  var cur = attHandSlotArea(rec, w.id, slot);
  return '<select class="inv-select" data-att-slot="' + slot + '" data-id="' + w.id + '" aria-label="' + escHtml(label + ' area for ' + w.name) + '"' + (live ? '' : ' disabled') + '>' +
    '<option value=""' + (cur ? '' : ' selected') + '>—</option>' +
    STAFF_AREAS.filter(function(a) { return a.floor; }).map(function(a) { return '<option value="' + a.id + '"' + (a.id === cur ? ' selected' : '') + '>' + escHtml(a.label) + '</option>'; }).join('') + '</select>';
}

/* In and out typed by hand (owner, 1 Oct 2026: "Attendance has no option to enter time in and time out by hand, so we
   have to rely on whatsapp message only, there is no way to simply enter the data that is presented to us by Deepak in
   his sheet"). A time typed sets the hours and the OT by the rolls' own rule (relayHoursOf); the side not typed is the
   shift's (8:30 AM to 5:00 PM, the gate's 7 to 7, a half day four hours from its in), and an out typed not after the in
   ran past midnight. An out the shift supplies that is not after the in is no out of this hand's (a night hand typed in at
   8 PM read 21 hours, OT 13): 0 hours until the out is typed, relayPersonMark's rule. Both cleared, the hours and OT go
   back to none. The mark is then the hand's, never rewritten by a roll. */
function attTimeMin(v) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '').trim());
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
}
function attTimesApply(m, w) {
  var gate = (m.area || (w && w.area)) === 'gate';
  if (m.inMin == null && m.outMin == null) { delete m.inMin; delete m.outMin; m.hours = 0; m.ot = 0; return; }
  var a = m.inMin != null ? m.inMin : gate ? RELAY_GATE[0] : RELAY_GENERAL;
  var typed = m.outMin != null;
  var b = typed ? m.outMin % 1440 : gate ? RELAY_GATE[1] : m.st === 'H' ? a + 240 : RELAY_GENERAL_OUT;
  if (b <= a) b = typed ? b + 1440 : null;
  if (typed) m.outMin = b;
  var h = relayHoursOf(a, b, w, gate ? 'gate' : m.area);
  m.hours = h.hours;
  m.ot = h.ot;
}
function setAttTime(staffId, which, v) {
  if (!attFloorOk()) return false;
  var m = attMark(_attDate, staffId), w = staffById(staffId);
  if (!m || m.st === 'A') return;
  var min = attTimeMin(v);
  if (which === 'in') { if (min == null) delete m.inMin; else m.inMin = min; }
  else { if (min == null) delete m.outMin; else m.outMin = min; }
  attTimesApply(m, w);
  m.outKnown = m.outMin != null;
  _attHandEdit(m);
  saveState();
  return true;
}
/* "HH:MM" for a time field (a stored out past midnight shows its clock time). */
function attTimeVal(min) { return min == null ? '' : relayHhmm(min); }
/* The times and what they came to, said on the board and the sheet. */
function attTimesText(m) {
  if (!m || (m.inMin == null && m.outMin == null)) return '';
  return (m.inMin != null ? relayClockLabel(m.inMin) : 'shift start') + ' – ' + (m.outMin != null ? relayClockLabel(m.outMin) : 'shift end');
}

function setAttArea(staffId, areaId) {
  if (!attFloorOk()) return false;
  var m = attMark(_attDate, staffId), w = staffById(staffId);
  if (!m) return;
  var wasGate = (m.area || (w && w.area)) === 'gate';
  m.area = areaId;
  // Times typed: the gate's hours are its shift and carry no OT, so moving onto or off it is worked out again. Any other
  // move keeps the hours and OT as they are: a figure typed in the hand's dialog wins until a time is changed.
  if ((m.inMin != null || m.outMin != null) && wasGate !== ((m.area || (w && w.area)) === 'gate')) attTimesApply(m, w);
  _attHandEdit(m);
  saveState();
  return true;
}

/* Marks every unmarked worker present. It never overwrites a mark already
   made — the absences are the part that was typed deliberately. */
function attAllPresent() {
  if (!attFloorOk()) return;
  var rec = attDay(_attDate, true);
  var n = 0;
  staffActive().forEach(function(w) {
    if (!rec.marks[w.id]) {
      rec.marks[w.id] = { st: 'P', ot: 0, hours: 0, area: w.area || 'flex' };
      n++;
    }
  });
  _attPrune(_attDate);
  saveState();
  renderAttendance();
  showToast(n === 0 ? 'Every worker already marked' : n + ' marked present');
}

function attAddExtra() {
  if (!attFloorOk()) return;
  var rec = attDay(_attDate, true);
  rec.extra.push({ area: 'barrel', hours: 0, kind: 'coverage' });
  saveState();
  renderAttendance();
}

function attRemoveExtra(idx) {
  if (!attFloorOk()) return;
  var rec = attDay(_attDate, false);
  if (!rec) return;
  rec.extra.splice(idx, 1);
  // A hand picked onto the block taken off still stood on that slot: the pick is kept, on a block made for it.
  attSlotsApply(rec);
  _attPrune(_attDate);
  saveState();
  renderAttendance();
}

/* A correction to a row the roll made is a lesson for the next roll with the same heading (relay.js). Put back as it
   was read, the lesson goes. */
function relayLearnFromRow(x) {
  if (!x) return;
  var L = relayLearnData(), at = Date.now();
  // Kept under the heading AND its slot (relayLearnKey), so a correction to the evening block's "VAT A 1" never moves the
  // 8:30 shift's. A row saved before the slot was kept on it teaches nothing: its lesson would have no slot to go to.
  if (x.srcHead && x.srcAt) {
    var k = relayLearnKey(x.srcHead, x.srcAt), was = x.srcAreas || [], cov = extraIsCoverage(x);
    // A general-shift row books to one area of every area its heading read: the lesson keeps them all (each hand stays
    // at his own) and puts the corrected one first, which is the one its EXTRA books to.
    var now = cov ? [x.area].concat(was.filter(function(a) { return a !== x.area; })) : extraAreas(x);
    var asRead = cov ? x.area === was[0] : now.slice().sort().join() === was.slice().sort().join();
    if (asRead) delete L.heads[k];
    else L.heads[k] = { areas: now, was: was, text: x.srcHead, slot: x.srcAt, at: at, day: _attDate };
  }
  // A row saved while "12:00AM--OUT TIME" still read as worded carries it as its slot: a time is no lesson (relayHeadHasWords).
  if (x.srcSlot && x.kind === 'block' && relayHeadHasWords(x.srcSlot)) {
    var ks = relayHeadKey(x.srcSlot);
    if (x.from === x.srcFrom && x.to === x.srcTo) delete L.slots[ks];
    else if (x.from && x.to) L.slots[ks] = { from: x.from, to: x.to, wasFrom: x.srcFrom || '', wasTo: x.srcTo || '', text: x.srcSlot, at: at, day: _attDate };
  }
}

/* A mark or an EXTRA row the roll wrote and somebody then changed by hand is the owner's from then on, like one entered
   by hand: the next roll keeps it rather than writing over the correction (relayPlan reads `src`). */
function _attHandEdit(o) { if (o && o.src === 'relay') delete o.src; }

function setAttExtraArea(idx, areaId) {
  if (!attFloorOk()) return false;
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  rec.extra[idx].area = areaId;
  _attHandEdit(rec.extra[idx]);
  relayLearnFromRow(rec.extra[idx]);
  saveState();
  return true;
}

function setAttExtraKind(idx, kind) {
  if (!attFloorOk()) return false;
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  var x = rec.extra[idx];
  x.kind = EXTRA_KINDS.some(function(k) { return k.id === kind; }) ? kind : 'coverage';
  _attHandEdit(x);
  // Flipping back to a general shift must CLEAR the block-only fields. Left
  // behind, `areas[]` still splits the row's hours across areas the UI no
  // longer shows (the select renders `x.area` alone) while `_absorption`'s
  // coverage branch absorbs against `x.area` only — hours over two areas,
  // absorbed by one area's crew. Numerator and denominator, again.
  if (x.kind === 'coverage') {
    delete x.areas; delete x.crew; delete x.from; delete x.to;
  }
  attSlotsApply(rec);
  saveState();
  return true;
}

/* A block's in or out. The hands' picks are not put right here: a block made for a pick going would move the rows under a
   time still being typed; the next pick, area or crew change, or roll does it. */
function setAttBlockTime(idx, which, value) {
  if (!attFloorOk()) return false;
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  rec.extra[idx][which === 'to' ? 'to' : 'from'] = String(value || '');
  _attHandEdit(rec.extra[idx]);
  relayLearnFromRow(rec.extra[idx]);
  saveState();
  return true;
}

/* Areas and crew are toggles, so both setters flip membership rather than
   replacing a value. `areas` is written even for a single pick, because the
   reconciler reads it first and falls back to `area` only for rows that
   predate this field. */
function toggleAttBlockArea(idx, areaId) {
  if (!attFloorOk()) return false;
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  if (!STAFF_AREAS.some(function(a) { return a.id === areaId; })) return;
  var x = rec.extra[idx];
  var list = (Array.isArray(x.areas) && x.areas.length) ? x.areas.slice() : (x.area ? [x.area] : []);
  var at = list.indexOf(areaId);
  if (at >= 0) list.splice(at, 1); else list.push(areaId);
  x.areas = list;
  // Keep `area` pointing at something real: it is what the per-area hour and
  // cost tallies bucket on, and a row that lost its last area would otherwise
  // keep booking against whichever one it used to name.
  x.area = list.length ? list[0] : 'flex';
  _attHandEdit(x);
  relayLearnFromRow(x);
  // A hand picked onto an area the block now covers stands on it; one picked onto an area it no longer covers moves.
  attSlotsApply(rec);
  saveState();
  return true;
}

/* A crew chip edits the block itself: the hand's own pick for that slot no longer speaks for it, and goes. */
function toggleAttBlockCrew(idx, workerId) {
  if (!attFloorOk()) return false;
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  var id = Number(workerId);
  if (!staffById(id)) return;
  var x = rec.extra[idx];
  var list = Array.isArray(x.crew) ? x.crew.slice() : [];
  var at = list.indexOf(id);
  if (at >= 0) list.splice(at, 1); else list.push(id);
  x.crew = list;
  _attHandEdit(x);
  var slot = attBlockSlot(x), pick = rec.slotHand && rec.slotHand[String(id)];
  if (slot && pick) { delete pick[slot]; if (!Object.keys(pick).length) delete rec.slotHand[String(id)]; }
  saveState();
  return true;
}

function setAttExtraHours(idx, hours) {
  if (!attFloorOk()) return false;
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  rec.extra[idx].hours = Math.max(0, Number(hours) || 0);
  _attHandEdit(rec.extra[idx]);
  saveState();
  return true;
}

/* A day emptied of every mark is deleted rather than left as `{}`. The presence
   of a key is what "this day was recorded" means to the coverage figure, and an
   empty husk would claim a recording that never happened. */
function _attPrune(iso) {
  var rec = S.attendance[iso];
  if (!rec) return;
  if (Object.keys(rec.marks).length === 0 && rec.extra.length === 0 && !rec.note) {
    delete S.attendance[iso];
  }
}

/* ===== ROSTER CRUD ===== */
function _blankWorker() {
  return {
    id: 0, name: '', comp: 'hourly', dayRate: 0,
    hourRate: (S.labour && S.labour.extraRate) || 0,
    area: 'flex', onFloor: true, active: true, note: ''
  };
}

function openWorkerAdd() { _showWorkerOverlay(null, true); }

function openWorkerEdit(id) {
  var w = staffById(id);
  if (!w) return;
  _showWorkerOverlay(w, false);
}

/* The same person entered twice. The roster import merges on the NAME, so a
   spelling the importer has never seen lands as a second active row — and both
   rows are then paid. Deletion cannot fix it: it is refused for anyone carrying
   marks, and rightly, because the marks would be orphaned rather than removed.
   So the overlay offers the merge instead, on the row that is about to vanish.

   Offered even when this worker has no marks of their own: an empty duplicate
   still doubles the headcount an area is judged against. */
function _mergeControl(w) {
  var others = (S.staff || []).filter(function(x) { return x.id !== w.id; });
  if (!others.length) return '';
  others.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  return _wfield('wedMergeInto', 'Merge this worker into',
    '<select class="inv-select" id="wedMergeInto"><option value="">Select a worker&hellip;</option>' +
    others.map(function(x) {
      return '<option value="' + x.id + '">' + escHtml(x.name) + '</option>';
    }).join('') + '</select>',
    'Use this when one person was entered twice under two ' +
    'spellings. <strong>' + escHtml(w.name) + '</strong> is the row that disappears &mdash; their days ' +
    'and block crews move to the worker chosen here, so open whichever of the two carries ' +
    'the name you want to keep. A day both rows were marked on is a day that was paid twice; ' +
    'the merge collapses it to the fuller mark and tells you the dates.') +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm inv-mb-16" data-action="invAttMergeWorker" ' +
    'data-id="' + w.id + '">Merge worker</button>';
}

/* A labelled field (§6.15), its hint under the control. */
function _wfield(id, label, control, hint) {
  return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' + control +
    (hint ? '<div class="inv-field-hint">' + hint + '</div>' : '') + '</div>';
}

function _showWorkerOverlay(worker, isAdd) {
  var w = worker || _blankWorker();
  var marks = worker ? _attMarkCount(w.id) : 0;
  // A role that may not see wages edits the worker without the rates: the fields are not drawn, and Save keeps them.
  var wages = attSeesWages();
  var num = function(id, v, step) {
    return '<input class="inv-input inv-input-num" id="' + id + '" type="number" step="' + step + '" min="0" value="' + v + '">';
  };
  dialogOpen('<div class="inv-dialog">' +
    dialogHeadHtml((isAdd ? 'Add worker' : 'Edit worker')) +
    // Their record first (people.js): what the book says of them, then the fields that set them.
    (isAdd ? '' : '<div data-ppl-sheet="' + escHtml(String(w.id)) + '">' + pplRecordHtml(w) + '</div>') +
    _wfield('wedName', 'Name', '<input class="inv-input" id="wedName" value="' + escHtml(w.name) + '">') +
    '<div class="inv-fields">' +
    _wfield('wedComp', 'Comp class', '<select class="inv-select" id="wedComp">' +
    COMP_CLASSES.map(function(c) {
      return '<option value="' + c.id + '"' + (w.comp === c.id ? ' selected' : '') + '>' + escHtml(c.label) + '</option>';
    }).join('') + '</select>') +
    _wfield('wedArea', 'Area', '<select class="inv-select" id="wedArea">' + attAreaOptions(w.area) + '</select>') +
    '</div>' +
    '<div class="inv-note inv-mb-16">' + COMP_CLASSES.map(function(c) {
      return '<strong>' + escHtml(c.label) + '</strong> &mdash; ' + escHtml(c.hint) + '.';
    }).join(' ') + '</div>' +
    (wages ? '<div class="inv-fields">' +
    _wfield('wedDay', 'Day rate', num('wedDay', w.dayRate || 0, '0.01')) +
    _wfield('wedHour', 'Hour rate', num('wedHour', w.hourRate || 0, '0.01')) +
    '</div>' +
    '<div class="inv-note inv-mb-16">The hourly tier uses the hour rate alone. The monthly and daily tiers use the day ' +
    'rate; leave their hour rate at zero and a monthly worker&rsquo;s overtime derives as <span class="inv-id">day rate ÷ 8</span>, ' +
    'which is how the rate card&rsquo;s own OT column is built. Wages are counted only for days actually recorded, ' +
    'which is why the labour card states its coverage.</div>' +
    _wfield('wedMonth', 'Contracted monthly wage (monthly tier only)', num('wedMonth', w.monthWage || 0, '1'),
      'Leave at zero for a monthly hand paid by the day. A contracted wage is paid as ' +
      '<span class="inv-id">wage ÷ days in the month</span> a day, its Sundays are not gated by attendance, and a ' +
      'Sunday worked adds nothing &mdash; it is inside the wage.')
      : '<div class="inv-note inv-mb-16" data-wages-hidden>The rates are not shown to your ID. Saving keeps them as they are; the owner sets them.</div>') +
    _wfield('wedSpell', 'Other spellings on the WhatsApp roll',
      '<input class="inv-input" id="wedSpell" value="' + escHtml((w.relayNames || []).join(', ')) + '" placeholder="e.g. SHARAT, SARAT MAHTO">',
      'Paste message reads these as this worker. A name you place on the check screen is added here.') +
    '<label class="inv-field inv-toolbar inv-toolbar-flush"><input type="checkbox" class="inv-check" id="wedFloor"' + (w.onFloor !== false ? ' checked' : '') + '> On the plant floor</label>' +
    '<div class="inv-note inv-mb-16">Clear this for the gate and the office. Their wage is still labour and still in the ' +
    'bill; it is simply not plating cost, and the breakdown splits it out.</div>' +
    '<label class="inv-field inv-toolbar"><input type="checkbox" class="inv-check" id="wedActive"' + (w.active !== false ? ' checked' : '') + '> Active</label>' +
    (isAdd ? '' : _mergeControl(w)) +
    (isAdd ? '' : '<div><button class="inv-btn inv-btn-danger inv-btn-sm" data-action="invAttDeleteWorker" data-id="' + w.id + '">Delete worker' +
      (marks > 0 ? ' (' + marks + ' day' + (marks === 1 ? '' : 's') + ' recorded)' : '') + '</button></div>') +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invAttSaveWorker" data-id="' + w.id +
    '" data-mode="' + (isAdd ? 'add' : 'edit') + '">' + (isAdd ? 'Add worker' : 'Save') + '</button></div></div>', { dismiss: true });
}

/* Days on which the attendance record names this worker.

   Block crews count. A hand who only ever appears on OT block rows has no
   mark, and deleting them would orphan those ids: `areaStats` still counts the
   crew length as heads while `_absorption` can no longer resolve the name, so
   the block's shortfall and its ranking would silently disagree. The guard
   exists to stop exactly that, and it has to look everywhere the id is used. */
function _attMarkCount(staffId) {
  var n = 0;
  Object.keys(S.attendance || {}).forEach(function(iso) {
    var rec = S.attendance[iso];
    if (!rec) return;
    if (rec.marks && rec.marks[staffId]) { n++; return; }
    var onBlock = (rec.extra || []).some(function(x) {
      return Array.isArray(x.crew) && x.crew.indexOf(Number(staffId)) >= 0;
    });
    if (onBlock) n++;
  });
  return n;
}

/* Payments that name this worker: Pay's payments and advances, a balance cleared with a reason, and the bank's wage
   rules and row settings. */
function _attPayRefs(staffId) {
  var k = String(staffId), n = 0, bank = S.bank || {};
  (S.staffPayments || []).forEach(function(p) { if (String(p.staffId) === k) n++; });
  (S.payCarryClears || []).forEach(function(c) { if (String(c.staffId) === k) n++; });
  Object.keys(bank.parties || {}).forEach(function(q) { var r = bank.parties[q]; if (r && r.staffId != null && String(r.staffId) === k) n++; });
  (bank.rows || []).forEach(function(r) { if (r.set && r.set.staffId != null && String(r.set.staffId) === k) n++; });
  return n;
}

function saveWorker(id, mode) {
  var name = document.getElementById('wedName').value.trim();
  if (!name) { showToast('Worker name is required', 'error'); return; }
  var comp = document.getElementById('wedComp').value;
  var dup = (S.staff || []).find(function(x) {
    return x.id !== id && staffNameKey(x.name) === staffNameKey(name);
  });
  if (dup) { showToast('Already on the roster: ' + dup.name, 'error'); return; }

  // A rate field not drawn (a role that may not see wages) keeps what is stored: a new worker's starts at none.
  var stored = mode === 'add' ? null : staffById(id);
  var rateOf = function(elId, k) {
    var el = document.getElementById(elId);
    return el ? Math.max(0, parseFloat(el.value) || 0) : (stored ? Math.max(0, Number(stored[k]) || 0) : 0);
  };
  var fields = {
    name: name,
    comp: comp,
    dayRate: rateOf('wedDay', 'dayRate'),
    hourRate: rateOf('wedHour', 'hourRate'),
    monthWage: comp === 'monthly' ? rateOf('wedMonth', 'monthWage') : 0,
    area: document.getElementById('wedArea').value,
    onFloor: document.getElementById('wedFloor').checked,
    active: document.getElementById('wedActive').checked
  };
  var spellEl = document.getElementById('wedSpell');
  if (spellEl) {
    var seen = {};
    fields.relayNames = spellEl.value.split(/[,;\n]+/).map(function(x) { return x.trim().toUpperCase(); }).filter(function(x) {
      var k = relayKey(x);
      if (!k || seen[k] || k === relayKey(name)) return false;
      return (seen[k] = true);
    });
  }

  // A rate of zero is not refused — a worker can be on the roster before the
  // rate is settled — but the labour card would then be quietly short, so it
  // is said once here rather than discovered as a low ₹/kg later. Which rate
  // has to be present depends on the tier: the hourly pool has no day rate at
  // all, and refusing one for want of it would be a rule about the wrong number.
  var rateMissing = comp === 'hourly' ? fields.hourRate <= 0 : (fields.dayRate <= 0 && !(fields.monthWage > 0));

  // P1 (guard.js): a wage rate or a monthly wage set or changed is a payments change; any other edit is the floor's roster.
  var was = mode === 'add' ? null : staffById(id), num = function(v) { return Number(v) || 0; };
  var wageSet = was ? (was.comp !== fields.comp || num(was.dayRate) !== fields.dayRate || num(was.hourRate) !== fields.hourRate || num(was.monthWage) !== fields.monthWage)
    : (fields.dayRate > 0 || fields.hourRate > 0 || fields.monthWage > 0);
  if (!grdGate(wageSet ? 'payments' : 'floor', wageSet ? 'set a worker’s wage' : 'save a worker', function() { saveWorker(id, mode); })) return;

  if (mode === 'add') {
    if (!S.staff) S.staff = [];
    var nextId = S.staff.reduce(function(m, x) { return Math.max(m, x.id || 0); }, 0) + 1;
    fields.id = nextId;
    fields.note = '';
    S.staff.push(fields);
  } else {
    var w = staffById(id);
    if (!w) return;
    // A renamed worker keeps the old name as a spelling, as a merge keeps the retired row's: rolls and payroll slips
    // written under it are matched by name alone, and a rename cut the worker off from every slip (the review, 30 Sep 2026).
    var oldName = w.name;
    // A rate changed is kept with its day (people.js reads "no rise in a year" off it).
    if (wageSet && (num(w.dayRate) || num(w.hourRate) || num(w.monthWage))) {
      w.rateHistory = Array.isArray(w.rateHistory) ? w.rateHistory : [];
      w.rateHistory.push({ on: localDateStr(), from: { dayRate: num(w.dayRate), hourRate: num(w.hourRate), monthWage: num(w.monthWage) },
        to: { dayRate: fields.dayRate, hourRate: fields.hourRate, monthWage: fields.monthWage } });
    }
    Object.keys(fields).forEach(function(k) { w[k] = fields[k]; });
    if (oldName && relayKey(oldName) && relayKey(oldName) !== relayKey(w.name)) {
      w.relayNames = w.relayNames || [];
      if (!w.relayNames.some(function(x) { return relayKey(x) === relayKey(oldName); })) w.relayNames.push(String(oldName).toUpperCase());
    }
  }
  saveState();
  closeOverlay();
  renderAttendance();
  showToast(rateMissing
    ? name + ' saved without a rate — labour cost will read short until it is set'
    : (mode === 'add' ? name + ' added' : name + ' saved'),
    rateMissing ? 'warning' : 'success');
}

/* ===== ROSTER IMPORT =====

   Settings → Import replaces the whole state, which is the right behaviour for
   a backup and the wrong one for a roster: loading a payroll file through it
   would take every invoice with it. So the roster gets its own door.

   It **merges by name** and never touches anything else on `S`. A name already
   on the roster has its rates and area updated in place, which keeps the
   worker's id — and therefore every attendance mark already recorded against
   them — intact. That is the whole reason the merge key is the name rather
   than the id: two devices that typed the same person will have given them
   different ids, and matching on id would silently duplicate the roster.

   Payroll is deliberately not seeded into this repo, which is public and whose
   built page is served to anyone. This is the path that keeps it off both. */
function importRoster() {
  if (!grdGate('imports', 'import a roster', importRoster)) return;   // P1 (guard.js)
  var inp = document.getElementById('rosterFileInput');
  if (!inp) return;
  inp.onchange = function(e) {
    var f = e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function(ev) { importRosterText(ev.target.result); };
    reader.readAsText(f);
    inp.value = '';
  };
  inp.click();
}
/* A roster file's text, from Staff → Roster → Import or from Add → File (add.js). */
function importRosterText(text) {
  var data;
  try { data = JSON.parse(text); }
  catch (err) { showToast('Not valid JSON: ' + err.message, 'error'); return; }
  // A file of workers' details (people.js) is the owner's, checked row by row before anything is kept.
  if (data && data.format === 'sep-people') { pplImportData(data); return; }
  var res = applyRosterImport(data);
  if (res.error) { showToast(res.error, 'error'); return; }
  saveState();
  renderAttendance();
  // Every count the merge dropped something on is stated. A silent import
  // that skipped half a file reads exactly like one that worked.
  showToast(res.added + ' added, ' + res.updated + ' updated' +
    (res.skipped ? ', ' + res.skipped + ' skipped' : '') +
    (res.aliased ? ' · ' + res.aliased + ' matched an existing worker under another spelling' : '') +
    (res.collapsed ? ' · ' + res.collapsed + ' row' + (res.collapsed === 1 ? '' : 's') +
      ' in the file were the same worker' : '') +
    (res.dupesOnRoster ? ' · ' + res.dupesOnRoster + ' worker' +
      (res.dupesOnRoster === 1 ? ' is' : 's are') + ' already on the roster twice under ' +
      'different spellings — merge from the worker\u2019s Edit screen' : '') +
    (res.aliasConflicts ? ' · ' + res.aliasConflicts + ' alias' +
      (res.aliasConflicts === 1 ? '' : 'es') + ' refused for naming two workers' : '') +
    (res.spellings ? ' · ' + res.spellings + ' other spelling' + (res.spellings === 1 ? '' : 's') + ' kept for reading rolls' : '') +
    (res.targets ? ' · ' + res.targets + ' complement' + (res.targets === 1 ? '' : 's') + ' set' : '') +
    (res.days ? ' · ' + res.days + ' day' + (res.days === 1 ? '' : 's') + ' of attendance' : '') +
    (res.daysKept ? ' (' + res.daysKept + ' already recorded, kept)' : '') +
    (res.marksDropped ? ' · ' + res.marksDropped + ' mark' +
      (res.marksDropped === 1 ? '' : 's') + ' for names not on the roster' : '') +
    (res.extrasDropped ? ' · ' + res.extrasDropped + ' booked-hours entr' +
      (res.extrasDropped === 1 ? 'y' : 'ies') + ' not recognised' : '') +
    (res.crewsUnresolved ? ' · ' + res.crewsUnresolved + ' block crew' +
      (res.crewsUnresolved === 1 ? '' : 's') + ' with unknown names, kept as not checkable' : '') +
    (res.daysDropped ? ' · ' + res.daysDropped + ' day' +
      (res.daysDropped === 1 ? '' : 's') + ' with unreadable dates' : ''),
    (res.marksDropped || res.extrasDropped || res.crewsUnresolved || res.daysDropped ||
     res.aliasConflicts || res.dupesOnRoster) ? 'warning' : 'success');
}

/* ===== ONE PERSON, MANY SPELLINGS =====

   The roster merges on the NAME, which is the right key — ids are per-device,
   and two devices that typed the same person gave them different numbers. What
   the name cannot do on its own is recognise a spelling it has never seen. The
   shop writes "Shyam" where the roster carries "Shyam Bera", and a bare
   case-insensitive equality reads those as two people.

   What that costs is worth stating exactly, because the obvious answer is the
   wrong one. It is NOT a double payment: the two rows carry different days, so
   no day is marked twice and no area's heads are doubled. What it does is split
   one person's attendance in half, which drops BOTH rows under the monthly
   rest-day gate — so the bill reads LOW, and the roster somebody writes a cash
   slip from carries the same name twice. Measured on one real device: four
   duplicated hands and a labour figure understated by five figures.

   Deletion cannot undo it either — it is refused for anyone carrying marks, and
   rightly so, because the marks would be orphaned rather than removed.

   So the import file may carry an `aliases` map, canonical name -> the other
   spellings, and every name on both sides is resolved through it before
   anything is matched. The map is the shop's own alias register travelling with
   the roster, for exactly the reason the area complements travel with it: they
   are one decision, and the file that sets the tab up leaves an instrument
   switched off if it arrives without them.

   Two rules, and both are about not making the problem worse.

   **An alias that would join two canonical names is REFUSED and counted.**
   Merging two people is the one error worse than splitting one, because the
   split is visible on the roster and the join is not. A file claiming both is
   wrong, and choosing which of the two a spelling belongs to would be a guess.

   **A matched row keeps the name the OPERATOR typed.** An alias match says the
   two spellings are the same person; it does not say theirs is the wrong one,
   and silently renaming a roster from a file is the overwrite the rest of this
   module refuses. Only a pure re-casing of the same string is normalised. */
function buildNameAliases(aliases) {
  var out = { key: {}, spellings: {}, refused: {}, conflicts: 0 };
  if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) return out;
  // Names are keyed the way a roll reads them (relayKey): case, spaces and punctuation aside. Trim and lower case alone
  // read "Sarat  Mahato" and "SARAT MAHATO." as two people and added the second.
  var norm = relayKey;

  // Canonicals first, so an alias can never claim a name that is somebody's
  // canonical spelling regardless of the order the file happens to list them.
  Object.keys(aliases).forEach(function(canon) {
    var k = norm(canon);
    if (!k) return;
    out.key[k] = k;
    out.spellings[k] = [k];
  });

  Object.keys(aliases).forEach(function(canon) {
    var k = norm(canon);
    if (!k) return;
    var v = aliases[canon];
    (Array.isArray(v) ? v : [v]).forEach(function(alt) {
      var a = norm(alt);
      if (!a || a === k) return;
      if (out.key[a]) {
        if (out.key[a] === k) return;                     // listed twice in one group
        // Claimed by two groups. REFUSED means bound to NEITHER — an earlier
        // version merely counted it and left the first claimant's binding
        // standing, so the "refusal" resolved the name by `Object.keys` order.
        // That is the guess the rule exists to forbid: merging two people is
        // the one error worse than splitting one, and picking by file order is
        // not a decision anybody made.
        var prev = out.key[a];
        delete out.key[a];
        if (out.spellings[prev]) {
          out.spellings[prev] = out.spellings[prev].filter(function(x) { return x !== a; });
        }
        out.conflicts++;
        out.refused[a] = true;                            // never re-bindable this run
        return;
      }
      if (out.refused[a]) { out.conflicts++; return; }    // a third claimant changes nothing
      out.key[a] = k;
      out.spellings[k].push(a);
    });
  });
  return out;
}

/* The group a name belongs to, or the name itself when it belongs to none.
   Falling back to the name keeps this a strict widening of the old rule: a file
   carrying no aliases resolves exactly as before. */
function aliasKey(name, al) {
  var n = relayKey(name);
  return (al && al.key[n]) || staffNameKey(name);
}
/* Who a roster name is: its letters as a roll reads them, with its digits, or the name itself when it has no Latin
   letters. relayKey alone keeps A-Z only, so 'Ramu 1' and 'Ramu 2' were one worker to the roster (the second refused,
   an import merging it into the first) and every name written in Devanagari keyed to nothing (the review, 30 Sep 2026). */
function staffNameKey(name) {
  var k = relayKey(name), d = String(name || '').replace(/\D/g, '');
  return (k || String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')) + (d ? '#' + d : '');
}

/* The merge itself, split out so it can be tested without a file picker. */
function applyRosterImport(data) {
  var rows = data && Array.isArray(data.staff) ? data.staff
    : (Array.isArray(data) ? data : null);
  if (!rows) return { error: 'No staff array in that file' };

  var added = 0, updated = 0, skipped = 0, aliased = 0, collapsed = 0, onRoster = 0;
  var al = buildNameAliases(data && data.aliases);
  var touched = [];
  if (!S.staff) S.staff = [];
  var nextId = S.staff.reduce(function(m, x) { return Math.max(m, x.id || 0); }, 0);

  rows.forEach(function(row) {
    var name = String((row && row.name) || '').trim();
    if (!name) { skipped++; return; }
    // A retired id in a file is the same id the migration re-points, so it is
    // read through the same table — otherwise a roster written against the old
    // structure silently drops those workers onto Flex while their complement
    // lands on the sub-area they meant.
    var rowArea = STAFF_AREA_ALIASES[row.area] || row.area;
    // `compClass()` falls back to `daily` for an unknown id, which is the right
    // default for a picker and the wrong one here: a legacy `permanent` row
    // would import onto a tier with no rest-day gate and the wrong OT rate, and
    // the comp migration has already run and cannot repair it. Retired ids are
    // translated; anything else unrecognised takes the fallback.
    var comp = compClass(STAFF_COMP_ALIASES[row.comp] || row.comp).id;
    var key = aliasKey(name, al);
    var group = S.staff.filter(function(x) { return aliasKey(x.name, al) === key; });
    var existing = group[0];
    // A worker already on the roster takes only the fields the file carries: a file naming a hand's new area must not
    // zero the rates it did not mention, nor set a hand the owner cleared Active back to active.
    var has = function(k) { return row[k] !== undefined && row[k] !== null && row[k] !== ''; };
    var nextComp = existing && !has('comp') ? existing.comp : comp;
    var fields = {};
    if (!existing || has('comp')) fields.comp = comp;
    if (!existing || has('dayRate')) fields.dayRate = Math.max(0, Number(row.dayRate) || 0);
    if (!existing || has('hourRate')) fields.hourRate = Math.max(0, Number(row.hourRate) || 0);
    if (!existing || has('monthWage') || nextComp !== 'monthly') fields.monthWage = nextComp === 'monthly' ? Math.max(0, Number(row.monthWage) || 0) : 0;
    if (!existing || has('area')) fields.area = STAFF_AREAS.some(function(a) { return a.id === rowArea; }) ? rowArea : 'flex';
    if (!existing || has('onFloor')) fields.onFloor = row.onFloor !== false;
    if (!existing || has('active')) fields.active = row.active !== false;
    // The roster ALREADY holding two rows for one person is the state this map
    // is meant to have prevented, and an import cannot repair it: collapsing
    // them here would destroy days without showing the operator which ones both
    // rows were marked on. So it is COUNTED and named, and the merge on the
    // worker overlay is where it gets fixed.
    // Counted ONCE per group, not once per file row that lands on it: two rows
    // resolving to the same pair would otherwise report four duplicates where
    // there is one.
    if (group.length > 1 && touched.indexOf(existing.id) === -1) {
      onRoster += group.length - 1;
    }
    if (existing) {
      Object.keys(fields).forEach(function(k) { existing[k] = fields[k]; });
      if ((existing.name || '').trim().toLowerCase() === name.toLowerCase()) {
        existing.name = name; // a re-casing of the same string, not a rename
      } else {
        aliased++;
      }
      // Two rows in the FILE resolving to one worker is the duplicate arriving
      // pre-collapsed. Counted, because the second row's fields have just
      // overwritten the first's and the operator should know which won.
      if (touched.indexOf(existing.id) !== -1) collapsed++; else touched.push(existing.id);
      updated++;
    } else {
      fields.id = ++nextId;
      fields.name = name;
      fields.note = '';
      S.staff.push(fields);
      added++;
    }
  });

  // The area complements travel with the roster too. They are the same
  // decision — who stands where, and how many of them there should be — and the
  // extra-hours check is dead without them, so shipping them apart would mean
  // the file that sets up the tab leaves its main instrument switched off.
  var targets = 0;
  if (data && data.areaTargets && typeof data.areaTargets === 'object') {
    if (!S.areaTargets) S.areaTargets = {};
    Object.keys(data.areaTargets).forEach(function(k) {
      var id = STAFF_AREA_ALIASES[k] || k;
      if (!STAFF_AREAS.some(function(a) { return a.id === id; })) return;
      var v = Number(data.areaTargets[k]);
      if (!isNaN(v) && v > 0) { S.areaTargets[id] = v; targets++; }
    });
  }

  // The labour config may travel with the roster — the rates and the rules that
  // price them were settled together and drift apart if they arrive separately.
  if (data && data.labour && typeof data.labour === 'object') {
    if (!S.labour) S.labour = {};
    ['otMult', 'otCap', 'restCreditMinDays', 'extraRate', 'modelPerKg', 'gateFull', 'gateHalf',
     'extraHoursPerHead'].forEach(function(k) {
      var v = Number(data.labour[k]);
      if (data.labour[k] != null && !isNaN(v) && v >= 0) S.labour[k] = v;
    });
  }
  // The alias map is also how the supervisor's roll spells these people, so it
  // is kept on the worker (`relayNames`) rather than spent on this import: the
  // Paste message reader then matches "Sharat" and "Budheswer" from the first
  // roll, instead of asking for every one of them by hand.
  // A roster typed with full names ("Sarat Mahato") holds none of the file's
  // short canonicals, so a group with no row by name is found the way the roll
  // reader finds a name — exactly, or by a first name nobody else has — and
  // only when every spelling in the group lands on the same one worker.
  var spellings = 0, rIdx = relayRosterIndex(S.staff);
  Object.keys(al.spellings).forEach(function(canon) {
    var group = S.staff.filter(function(x) { return aliasKey(x.name, al) === canon; });
    if (!group.length) {
      var hits = [];
      al.spellings[canon].forEach(function(sp) { var h = rIdx.byKey[relayKey(sp)]; if (h && hits.indexOf(h) < 0) hits.push(h); });
      group = hits;
    }
    if (group.length !== 1) return;                  // nobody, or two rows: not ours to pick
    var w = group[0];
    al.spellings[canon].forEach(function(sp) {
      var k = relayKey(sp);
      if (!k || k === relayKey(w.name) || (w.relayNames || []).some(function(n) { return relayKey(n) === k; })) return;
      w.relayNames = (w.relayNames || []).concat([k]);
      spellings++;
    });
  });
  var att = applyAttendanceImport(data, al);

  return { added: added, updated: updated, skipped: skipped, targets: targets,
           aliased: aliased, collapsed: collapsed, aliasConflicts: al.conflicts, spellings: spellings,
           dupesOnRoster: onRoster,
           days: att.days, daysKept: att.daysKept, daysDropped: att.daysDropped,
           marksDropped: att.marksDropped, extrasDropped: att.extrasDropped,
           crewsUnresolved: att.crewsUnresolved };
}

/* ===== ATTENDANCE THROUGH THE SAME DOOR =====

   The roster and the days it worked are one decision, and they arrive together
   for the same reason the area complements do: a roster with no history has
   nothing for the Areas card to check, and a history with no roster has nobody
   to attach itself to. Settings -> Import still cannot serve, because it
   replaces the whole state and would take every invoice with it.

   Three rules, and each of them is the difference between seeding a history and
   corrupting one.

   **Marks name a WORKER, never an id.** Ids are per-device -- two devices that
   typed the same person gave them different numbers -- so an id in a file would
   attach a day's marks to whoever happens to hold that number here. The name is
   resolved against the roster this import just merged, which is why attendance
   is applied last.

   **A name that is not on the roster is dropped and COUNTED, never created.**
   Creating a worker from an attendance file would put a row with no comp class
   and no rate on the roster, and the labour figure would then read short with
   nothing on screen saying why. A reported drop is a question the operator can
   answer; an invented worker is a wrong number nobody sees.

   **A day that already exists is KEPT, never overwritten.** Seeding must not be
   able to destroy entry somebody actually did. The count is reported so a
   re-import that did nothing says so rather than looking like it worked. */
function applyAttendanceImport(data, al) {
  al = al || buildNameAliases(data && data.aliases);
  var out = { days: 0, daysKept: 0, daysDropped: 0, marksDropped: 0,
              extrasDropped: 0, crewsUnresolved: 0 };
  var src = data && data.attendance;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out;

  if (!S.attendance) S.attendance = {};

  // One name->id table for the whole import rather than a scan per mark. Every
  // spelling in a worker's alias group is registered against that worker, so a
  // mark or a block crew naming any of them resolves — and `importedExtra` gets
  // it for free, which matters: a crew name that failed to match makes the whole
  // row Not checkable, so an unbridged alias would take real booked hours out
  // of the reconciler as well as out of the wage.
  var byName = {}, byExact = {}, shared = {};
  (S.staff || []).forEach(function(w) {
    var n = relayKey(w.name);
    byExact[staffNameKey(w.name)] = w.id;
    // A letters-only key two workers share names neither ('Ramu 1', 'Ramu 2'): the exact key has to decide.
    if (byName[n] != null && byName[n] !== w.id) shared[n] = true;
    byName[n] = w.id;
    ((al.spellings[aliasKey(n, al)]) || []).forEach(function(sp) {
      if (byName[sp] == null) byName[sp] = w.id;
    });
  });
  function importWorkerId(name) {
    var e = byExact[staffNameKey(name)];
    if (e != null) return e;
    var k = relayKey(name);
    return shared[k] ? null : byName[k];
  }

  Object.keys(src).forEach(function(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) { out.daysDropped++; return; }
    if (S.attendance[iso]) { out.daysKept++; return; }

    var day = src[iso] || {};
    var rec = { marks: {}, extra: [], note: String(day.note || '') };

    (Array.isArray(day.marks) ? day.marks : []).forEach(function(m) {
      var id = importWorkerId(m && m.name);
      if (id == null) { out.marksDropped++; return; }
      // The state is normalised before it is judged, and an unrecognised one is
      // DROPPED AND COUNTED, never coerced: the old fallback turned a mistyped
      // absence ('a', ' A') into a paid present day — the exact absent/present
      // distinction this store exists to keep, silently inverted.
      var st = String(m.st == null ? 'P' : m.st).trim().toUpperCase() || 'P';
      if (ATT_STATES.indexOf(st) === -1) { out.marksDropped++; return; }
      var area = STAFF_AREA_ALIASES[m.area] || m.area;
      rec.marks[id] = {
        st: st,
        // Absent pays nothing and worked nothing — the same invariant the entry
        // UI enforces when a worker is marked absent. This route is the only
        // other writer, so it holds the line too.
        ot: st === 'A' ? 0 : Math.max(0, Number(m.ot) || 0),
        hours: st === 'A' ? 0 : Math.max(0, Number(m.hours) || 0),
        area: STAFF_AREAS.some(function(a) { return a.id === area; }) ? area : 'flex'
      };
    });

    (Array.isArray(day.extra) ? day.extra : []).forEach(function(x) {
      var e = importedExtra(x, importWorkerId, out);
      // A refused row is COUNTED, never silently dropped — booked hours leaving
      // the bill with nothing on screen saying why is the failure the marks
      // side already refuses, applied to money instead of people.
      if (e) rec.extra.push(e); else out.extrasDropped++;
    });

    S.attendance[iso] = rec;
    out.days++;
  });

  return out;
}

/* One booked-hours row, read defensively. A block keeps its own shape -- areas,
   crew and times -- because the reconciler needs all three and reports the row
   as "Not checkable" when any is missing. That refusal is the point: a block
   whose crew was never written down is honestly unverifiable, and the hours are
   still counted in the bill, because unverifiable is not unpaid. */
function importedExtra(x, workerId, counters) {
  if (!x || typeof x !== 'object') return null;
  var hours = Math.max(0, Number(x.hours) || 0);
  var kind = EXTRA_KINDS.some(function(k) { return k.id === x.kind; }) ? x.kind : 'coverage';

  if (kind === 'block') {
    var areas = (Array.isArray(x.areas) ? x.areas : [])
      .map(function(a) { return STAFF_AREA_ALIASES[a] || a; })
      .filter(function(a) { return STAFF_AREAS.some(function(s2) { return s2.id === a; }); });
    // A block naming NO area is kept, not dropped. The shop writes some evening
    // blocks purely as out-times (`Out | <hand> 10 PM · <hand> 12 AM · EXTRA 13
    // hours`), which states the hours without saying which line ran. Those are
    // real booked hours: dropping them takes them out of the bill, and
    // unverifiable is not unpaid. The reconciler already has the right answer
    // for a block missing one of its three inputs -- it reports Not checkable.
    // The cost buckets to `flex`, which is what an unattributed hand is.
    // The crew is carried by NAME for the same reason the marks are. And a
    // PARTIALLY resolved crew is worse than none: dropping one unmatched name
    // leaves a head count that reads as real and is simply wrong — the
    // reconciler would derive a shortfall from it. So one unresolvable name
    // makes the whole crew unrecorded (the row reports Not checkable), and the
    // event is counted so the operator can see which record to repair.
    var crew = [];
    var unresolved = false;
    (Array.isArray(x.crew) ? x.crew : []).forEach(function(n) {
      var id = workerId(n);
      if (id == null) { unresolved = true; return; }
      if (crew.indexOf(id) === -1) crew.push(id);
    });
    if (unresolved) {
      crew = [];
      if (counters) counters.crewsUnresolved++;
    }
    // The marker is what keeps the toast's promise. An empty crew BESIDE named
    // sibling rows normally reads as "the relay stated nobody stood this line"
    // (heads 0, the W32 Thu-6 reading) — but an UNRESOLVED crew was recorded
    // and merely failed to match, so promoting it to zero would publish a
    // full-complement shortfall from a record that exists. Marked, the
    // reconciler keeps it Not checkable, exactly as reported on import.
    var row = {
      kind: 'block', areas: areas, crew: crew, hours: hours,
      from: _hhmm(x.from) == null ? '' : String(x.from),
      to: _hhmm(x.to) == null ? '' : String(x.to),
      area: areas[0] || 'flex'
    };
    if (unresolved) row.crewUnknown = true;
    return row;
  }

  var area = STAFF_AREA_ALIASES[x.area] || x.area;
  if (!STAFF_AREAS.some(function(a) { return a.id === area; })) return null;
  return { kind: 'coverage', area: area, hours: hours };
}

/* ===== MERGING TWO ROWS THAT ARE ONE PERSON =====

   The roster merges by NAME, and the app has no alias table: `Shyam` and
   `Shyam Bera` are two strings, so they become two rows, both active, both
   carrying a rate — and the labour card pays both. That is not a display
   nuisance, it is a wage error, and it is the one an import is most likely to
   create, because a file written against the floor's short names meets a
   roster typed from the bank's full ones.

   Deleting the wrong one is refused (it would orphan that row's marks) and
   deactivating it is wrong too (the days it holds are real and would drop out
   of the bill). What is actually needed is a MERGE: one row survives, and every
   mark and every block crew that named the other now names the survivor.

   A worker id appears in exactly two places, and this walks both:
     - `S.attendance[iso].marks[id]`      the day's mark
     - `S.attendance[iso].extra[].crew[]` an OT block's named crew

   **A day both rows are marked on is the double-count itself**, so it is not
   silently resolved. The richer mark wins — present beats absent, and among
   present the one carrying more hours — and the count is REPORTED, because the
   number of collided days is the number of days that were paid twice, and the
   operator is the only one who can decide whether that reached a payout. */
function mergeWorkers(fromId, intoId) {
  var from = staffById(fromId), into = staffById(intoId);
  if (!from || !into) return { error: 'Worker not found' };
  if (fromId === intoId) return { error: 'A worker cannot be merged into themselves' };

  var moved = 0, collided = 0, crews = 0, collisionDays = [];

  Object.keys(S.attendance || {}).forEach(function(iso) {
    var rec = S.attendance[iso];
    if (!rec) return;

    var marks = rec.marks || {};
    var a = marks[fromId], b = marks[intoId];
    if (a) {
      if (!b) {
        marks[intoId] = a;
        moved++;
      } else {
        // Both rows marked on one day: the survivor keeps whichever mark says
        // more. `A` pays nothing and records nothing, so it never beats a day
        // somebody was present for.
        if (_markRicherThan(a, b)) marks[intoId] = a;
        collided++;
        collisionDays.push(iso);
      }
      delete marks[fromId];
    }

    (rec.extra || []).forEach(function(x) {
      if (!Array.isArray(x.crew)) return;
      var i = x.crew.indexOf(fromId);
      if (i === -1) return;
      x.crew.splice(i, 1);
      if (x.crew.indexOf(intoId) === -1) x.crew.push(intoId); // dedupe: one head, not two
      crews++;
    });
    // Their card scans go with them, merged by time.
    if (rec.scans && rec.scans[fromId]) {
      rec.scans[intoId] = (rec.scans[intoId] || []).concat(rec.scans[fromId]).sort(function(p, q) { return p.min - q.min || p.at - q.at; });
      delete rec.scans[fromId];
    }
    // The hand's own slot picks go with them; the survivor's own pick for a slot wins.
    var picks = rec.slotHand && rec.slotHand[String(fromId)];
    if (picks) {
      var into = rec.slotHand[String(intoId)] || (rec.slotHand[String(intoId)] = {});
      Object.keys(picks).forEach(function(sl) { if (!Object.prototype.hasOwnProperty.call(into, sl)) into[sl] = picks[sl]; });
      delete rec.slotHand[String(fromId)];
      attSlotsApply(rec);
    }
  });

  // Money that names the worker follows the merge too: payments and advances, the bank's wage rules and the wage set on
  // a statement row, and an as-paid slip row's id. Left behind, they named a worker who no longer exists.
  var same = function(v) { return v != null && String(v) === String(fromId); };
  var payments = 0;
  (S.staffPayments || []).forEach(function(p) { if (same(p.staffId)) { p.staffId = intoId; payments++; } });
  var bank = S.bank || {};
  Object.keys(bank.parties || {}).forEach(function(k) { var r = bank.parties[k]; if (r && same(r.staffId)) { r.staffId = intoId; payments++; } });
  (bank.rows || []).forEach(function(r) { if (r.set && same(r.set.staffId)) { r.set.staffId = intoId; payments++; } });
  (S.payrollPaid || []).forEach(function(rec) { (rec.rows || []).forEach(function(r) { if (same(r.staffId)) r.staffId = intoId; }); });
  // A balance cleared with a reason is the worker's too: left on the merged-away id, the survivor carried it again.
  var clears = 0;
  (S.payCarryClears || []).forEach(function(c) { if (same(c.staffId)) { c.staffId = intoId; clears++; } });

  // The row going away was a spelling of this person; the roll may still use it.
  [from.name].concat(from.relayNames || []).forEach(function(n) {
    var k = relayKey(n);
    if (k && k !== relayKey(into.name) && !(into.relayNames || []).some(function(x) { return relayKey(x) === k; })) {
      into.relayNames = (into.relayNames || []).concat([k]);
    }
  });

  var idx = (S.staff || []).findIndex(function(w) { return w.id === fromId; });
  if (idx !== -1) S.staff.splice(idx, 1);

  return { moved: moved, collided: collided, crews: crews, payments: payments, clears: clears,
           collisionDays: collisionDays.sort(), fromName: from.name, intoName: into.name };
}

/* Which of two marks for one day says more.

   The state ranks FIRST, on `ATT_DAY_VALUE` — the same table `labourForRange`
   and `areaStats` price a day with, so the merge cannot prefer a mark the wage
   arithmetic then values lower. An earlier version demoted only `A`, which left
   a HALF DAY tying with a full present one: both default to `hours: 0` (the
   seed's default and the day view's), so the tie fell through to the `false`
   branch and the half day was KEPT. That understates the bill, in the merge
   whose whole purpose is repairing a wage understatement.

   Hours break a tie within one state, and overtime breaks that. */
function _markRicherThan(a, b) {
  var av = ATT_DAY_VALUE[a.st || 'P'] || 0, bv = ATT_DAY_VALUE[b.st || 'P'] || 0;
  if (av !== bv) return av > bv;
  if ((a.hours || 0) !== (b.hours || 0)) return (a.hours || 0) > (b.hours || 0);
  return (a.ot || 0) > (b.ot || 0);
}

/* The merge, from the worker-edit overlay. The row you have OPEN is the one
   that disappears, so choosing which of the two to open is how the operator
   picks which name survives — the app does not decide that for them. */
async function mergeWorkerInto(fromId) {
  var sel = document.getElementById('wedMergeInto');
  if (!sel || !sel.value) return;
  var intoId = parseInt(sel.value, 10);
  var from = staffById(fromId), into = staffById(intoId);
  if (!from || !into) return;
  if (!grdOk('payments') && !(await guardAsk('payments', 'merge two workers'))) return;   // P1 (guard.js): their pay records join
  if (!(await uiConfirm({ title: 'Merge "' + from.name + '" into "' + into.name + '"?',
      body: '"' + from.name + '" is removed. Every day and every block crew that named ' +
      'them will name "' + into.name + '" instead. This cannot be undone.', okLabel: 'Merge', danger: true }))) return;

  var res = mergeWorkers(fromId, intoId);
  if (res.error) { showToast(res.error, 'error'); return; }
  saveState();
  closeOverlay();
  renderAttendance();
  showToast('Merged into ' + res.intoName + ' \u2014 ' + res.moved + ' day' +
    (res.moved === 1 ? '' : 's') + ' moved' +
    (res.crews ? ', ' + res.crews + ' block crew' + (res.crews === 1 ? '' : 's') + ' re-pointed' : '') +
    (res.payments ? ', ' + res.payments + ' payment' + (res.payments === 1 ? '' : 's') + ' moved with them' : '') +
    (res.clears ? ', ' + res.clears + ' cleared balance' + (res.clears === 1 ? '' : 's') + ' with them' : ''),
    res.collided ? 'warning' : 'success');

  /* The collided days do not fit in a toast, and they are the half that costs
     money: each one was marked on both rows, so each one was entered twice.
     The dates go on a card the operator can read at their own pace. */
  if (res.collided) showCollisionReport(res);
}

/* What the merge could not decide for the operator, listed rather than counted.

   A day marked on BOTH rows is the only place a duplicate roster row actually
   doubles anything — the marks are keyed by worker id, so one row per day is
   the ordinary case and costs nothing. These are the exceptions, and the app
   cannot tell whether the double entry reached a payout. Naming the dates is
   the whole point; a count would say there is a problem without saying where. */
function showCollisionReport(res) {
  dialogOpen('<div class="inv-dialog">' +
    dialogHeadHtml('Days marked on both rows') +
    '<div class="inv-note inv-mb-8">' + res.collided + ' day' + (res.collided === 1 ? '' : 's') +
    ' had a mark on <strong>' + escHtml(res.fromName) + '</strong> and on <strong>' +
    escHtml(res.intoName) + '</strong>. Each has been collapsed to the fuller mark &mdash; a ' +
    'recorded day beats an absence, and the longer day wins between two present marks. ' +
    'Every other day moved across untouched.</div>' +
    '<div class="inv-panel inv-panel-flush inv-scroll" id="mergeCollisions">' +
    res.collisionDays.map(function(d) {
      return '<div class="inv-row"><span class="inv-row-main inv-id">' + escHtml(d) + '</span>' +
        '<span class="inv-row-end inv-row-meta">' + escHtml(attDayName(d) + ' ' + formatDate(d)) + '</span></div>';
    }).join('') +
    '</div>' +
    '<div class="inv-callout inv-callout-warning">Those days were entered twice before this merge. ' +
    'Check them against the payout for that week &mdash; the app cannot tell whether the ' +
    'double entry reached one.</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-primary" ' +
    'data-action="invCloseOverlay">Done</button></div></div>', { dismiss: true });
}

/* Deletion is refused while attendance names the worker. Removing the row would
   not remove the marks, it would orphan them: every past week's labour would
   silently drop that person's wage and no figure would say why. Deactivating
   keeps the history intact and takes them out of today's denominator, which is
   what "left" actually means here. */
async function deleteWorker(id) {
  var w = staffById(id);
  if (!w) return;
  var marks = _attMarkCount(id);
  if (marks > 0) {
    showToast('Cannot delete: ' + w.name + ' is on ' + marks + ' recorded day' +
      (marks === 1 ? '' : 's') + '. Clear Active instead.', 'error');
    return;
  }
  // A payment naming them is a record the same way a day is (a void one included: it is kept, not deleted), and so is a
  // wage the bank statement sets against them. Deleting would leave each reading "Removed worker".
  var pays = _attPayRefs(id);
  if (pays > 0) {
    showToast('Cannot delete: ' + pays + ' payment' + (pays === 1 ? ' names ' : 's name ') + w.name + '. Clear Active instead.', 'error');
    return;
  }
  if (!grdOk('payments') && !(await guardAsk('payments', 'delete a worker'))) return;   // P1 (guard.js): wage rates go with them
  if (!(await uiConfirm({ title: 'Delete ' + w.name + ' from the roster?', body: 'No day names them, so nothing is lost with the row.', okLabel: 'Delete', danger: true }))) return;
  S.staff = S.staff.filter(function(x) { return x.id !== id; });
  // A slot pick naming nobody now (taken off a slot, then the day's mark cleared) goes with the row.
  Object.keys(S.attendance || {}).forEach(function(iso) { var r = S.attendance[iso]; if (r && r.slotHand) delete r.slotHand[String(id)]; });
  saveState();
  closeOverlay();
  renderAttendance();
  showToast(w.name + ' removed');
}
