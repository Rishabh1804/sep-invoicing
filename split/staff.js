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
   and pickling is two sub-areas that Shyam's daily relay already divides. A
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
  { id: 'gate',            label: 'Gate',            floor: false }
];

/* Barrel and Barrel pickling are two areas for staffing and one block for the
   shortfall arithmetic.

   The relay writes them as one row about as often as it writes them as two —
   `Barrel & pickling | Shyam · Sunil · Suklal · EXTRA 16 HOURS` — and every
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
   sub-areas; it lands on the VAT side because that is the one Shyam's format
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

var _attView = 'day';
var _attDate = null;      // ISO date the Day view is showing
var _attWeekStart = null; // ISO Monday the Week view is showing

/* ===== DATE HELPERS =====
   All local-time. `new Date('2026-08-27')` parses as UTC and lands on the
   previous evening east of Greenwich, which would silently shift every week
   boundary by a day here. */
function attParseIso(iso) {
  var p = String(iso || '').split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function attIso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');
}

function attAddDays(iso, n) {
  var d = attParseIso(iso);
  d.setDate(d.getDate() + n);
  return attIso(d);
}

/* Monday of the week containing iso. The plant runs Mon–Sat. */
function attWeekStartOf(iso) {
  var d = attParseIso(iso);
  var dow = d.getDay();            // 0 = Sunday
  var back = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - back);
  return attIso(d);
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

/* Mon–Sat of a week. Sunday is worked here only as overtime, and an OT Sunday
   is recorded on its own date through the Day view rather than being given a
   permanent column that is empty fifty weeks a year. */
function attWeekDays(weekStartIso) {
  var out = [];
  for (var i = 0; i < 6; i++) out.push(attAddDays(weekStartIso, i));
  return out;
}

/* Every ISO date from `from` to `to` inclusive. */
function attDatesInRange(fromIso, toIso) {
  var out = [], cur = fromIso;
  if (!fromIso || !toIso || fromIso > toIso) return out;
  var guard = 0;
  while (cur <= toIso && guard++ < 4000) { out.push(cur); cur = attAddDays(cur, 1); }
  return out;
}

/* ===== STORE ===== */
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

function staffById(id) {
  return (S.staff || []).find(function(w) { return w.id === id; });
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
var ATT_FOCUS_FLAGS = ['data-att-area', 'data-att-ot', 'data-att-hours',
  'data-att-extra-area', 'data-att-extra-hours', 'data-att-extra-kind',
  'data-att-block-from', 'data-att-block-to'];

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
function renderAttendance() {
  if (!_attDate) _attDate = localDateStr();
  if (!_attWeekStart) _attWeekStart = attWeekStartOf(_attDate);

  var focusSel = _attFocusSelector();

  var toolbar = document.getElementById('attToolbar');
  if (toolbar) {
    var views = [['day', 'Day'], ['week', 'Week'], ['areas', 'Areas'], ['roster', 'Roster']];
    toolbar.innerHTML = '<div class="inv-stats-chips">' + views.map(function(v) {
      return '<button class="inv-chip' + (_attView === v[0] ? ' inv-chip-active' : '') +
        '" data-action="invAttView" data-view="' + v[0] + '">' + v[1] + '</button>';
    }).join('') + '</div>';
  }

  var area = document.getElementById('attContent');
  if (!area) return;

  if ((S.staff || []).length === 0 && _attView !== 'roster') {
    area.innerHTML = _attEmptyRoster();
    _attRestoreFocus(focusSel);
    return;
  }

  if (_attView === 'roster') area.innerHTML = _attRosterView();
  else if (_attView === 'areas') area.innerHTML = _attAreasView();
  else if (_attView === 'week') area.innerHTML = _attWeekView();
  else area.innerHTML = _attDayView();

  _attRestoreFocus(focusSel);
}

function _attEmptyRoster() {
  return '<div class="inv-card"><div class="inv-empty-state">' +
    '<svg class="inv-empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
    '<polyline points="17 11 19 13 23 9"/></svg>' +
    '<div class="inv-mt-16">No one on the roster yet</div>' +
    '<div class="inv-stats-note">Attendance and the labour breakdown both read the roster. ' +
    'Add each worker once with their comp class and rate; the wage arithmetic follows from there.</div>' +
    '<div class="inv-mt-16"><button class="inv-btn inv-btn-primary" data-action="invAttAddWorker">Add the first worker</button></div>' +
    '</div></div>';
}

/* ===== DAY VIEW ===== */
function _attDayView() {
  var iso = _attDate;
  var rec = attDay(iso, false);
  var roster = staffActive();
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

  var html = '<div class="inv-att-nav">' +
    '<button class="inv-att-nav-btn" data-action="invAttStep" data-step="-1" aria-label="Previous day">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>' +
    '<div class="inv-att-nav-label"><input type="date" class="inv-form-input inv-mono inv-att-date" id="attDate" value="' + escHtml(iso) + '">' +
    '<span class="inv-att-nav-day">' + attDayName(iso) + '</span></div>' +
    '<button class="inv-att-nav-btn" data-action="invAttStep" data-step="1" aria-label="Next day">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAttToday">Today</button>' +
    '</div>';

  html += '<div class="inv-card inv-card-hero"><div class="inv-card-header">' +
    '<span class="inv-card-title">On site</span>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAttAllPresent">All present</button></div>' +
    '<div class="inv-att-count"><span class="inv-display inv-att-count-value">' + onSite + '</span>' +
    '<span class="inv-att-count-of">/ ' + total + '</span></div>' +
    '<div class="inv-att-summary">' +
    '<span class="inv-att-pill inv-att-pill-p">' + present + ' present</span>' +
    '<span class="inv-att-pill inv-att-pill-h">' + half + ' half</span>' +
    '<span class="inv-att-pill inv-att-pill-a">' + absent + ' absent</span>' +
    (unmarked > 0 ? '<span class="inv-att-pill inv-att-pill-u">' + unmarked + ' unmarked</span>' : '') +
    '</div>' +
    (poolHours > 0 || otHours > 0 || extraHours > 0
      ? '<div class="inv-att-summary">' +
        (poolHours > 0 ? '<span class="inv-att-pill inv-att-pill-hr">' + formatNum(poolHours, 1) + ' h pool</span>' : '') +
        (otHours > 0 ? '<span class="inv-att-pill inv-att-pill-ot">' + formatNum(otHours, 1) + ' h OT named</span>' : '') +
        (extraHours > 0 ? '<span class="inv-att-pill inv-att-pill-x">' + formatNum(extraHours, 1) + ' h extra</span>' : '') +
        '</div>'
      : '') +
    '</div>';

  // The rows. One line per worker: who, where, what state, and OT hours.
  html += '<div class="inv-card"><div class="inv-card-header"><span class="inv-card-title">Mark the day</span></div>';
  roster.forEach(function(w) {
    var m = rec ? rec.marks[w.id] : null;
    var st = m ? m.st : '';
    var wArea = m && m.area ? m.area : (w.area || 'flex');
    var cls = compClass(w.comp);
    var hourly = compIsHourly(w);
    // Half a day is not a state an hourly worker can be in: the hours say it.
    var states = hourly ? ['P', 'A'] : ATT_STATES;
    var live = st && st !== 'A';
    html += '<div class="inv-att-row">' +
      '<div class="inv-att-who"><span class="inv-att-name">' + escHtml(w.name) + '</span>' +
      '<span class="inv-att-badge inv-att-badge-' + cls.tone + '">' + escHtml(cls.label) + '</span></div>' +
      '<div class="inv-att-controls">' +
      '<div class="inv-att-seg" role="group" aria-label="Attendance for ' + escHtml(w.name) + '">' +
      states.map(function(x) {
        return '<button class="inv-att-seg-btn inv-att-seg-' + x.toLowerCase() +
          (st === x ? ' inv-att-seg-on' : '') + '" data-action="invAttSet" data-id="' + w.id +
          '" data-st="' + x + '" aria-pressed="' + (st === x) + '" title="' + ATT_STATE_LABELS[x] + '">' + x + '</button>';
      }).join('') +
      '</div>' +
      '<select class="inv-form-select inv-att-area" data-att-area data-id="' + w.id + '" aria-label="Area for ' + escHtml(w.name) + '"' +
      (live ? '' : ' disabled') + '>' + attAreaOptions(wArea) + '</select>' +
      // Deliberately not inv-mono: in the mono face the placeholders "OT" and
      // "h" sit in a field whose whole content is otherwise numbers, and the
      // mono O is indistinguishable from a zero.
      (hourly
        ? '<input type="number" class="inv-form-input inv-att-ot" data-att-hours data-id="' + w.id +
          '" step="0.5" min="0" placeholder="hrs" value="' + (m && m.hours ? m.hours : '') + '"' +
          (live ? '' : ' disabled') + ' aria-label="Hours worked by ' + escHtml(w.name) + '">'
        : '<input type="number" class="inv-form-input inv-att-ot" data-att-ot data-id="' + w.id +
          '" step="0.5" min="0" placeholder="OT" value="' + (m && m.ot ? m.ot : '') + '"' +
          (live ? '' : ' disabled') + ' aria-label="OT hours for ' + escHtml(w.name) + '">') +
      '</div></div>';
  });
  html += '</div>';

  html += _attExtraCard(iso, rec);
  html += renderLabourCard(iso, iso, 'Day cost');
  return html;
}

/* ===== EXTRA HOURS =====
   What "the extra" is, and why it has no name against it.

   Shyam's daily relay books hours in two different ways. Named men carry their
   own out-time, and those hours are OT on the row above. But every day also
   carries lines like `EXTRA 16 HOURS` written against an *area block* — the
   barrel line, the 6 AM VAT slot — with no person attached. They are real paid
   hours at the contract tier, and the payout sheet settles them.

   So they are recorded as what they are: hours booked to an area, unattributed.
   Spreading them across the men present would produce a per-worker cost that
   reads precise and is invented, and the one question this tab exists to answer
   is which labour is fixed and which scales — a question that spreading would
   silently answer for us. The labour card counts them in the bill and reports
   them separately as unattributed. */
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

  var html = '<div class="inv-att-block">' +
    '<div class="inv-att-block-times">' +
    '<label class="inv-att-block-label" for="blkFrom-' + i + '">In</label>' +
    '<input type="time" class="inv-form-input inv-mono" id="blkFrom-' + i + '" data-att-block-from data-idx="' + i +
    '" value="' + escHtml(x.from || '') + '" aria-label="Block start time">' +
    '<label class="inv-att-block-label" for="blkTo-' + i + '">Out</label>' +
    '<input type="time" class="inv-form-input inv-mono" id="blkTo-' + i + '" data-att-block-to data-idx="' + i +
    '" value="' + escHtml(x.to || '') + '" aria-label="Block end time">' +
    // Both lengths, whenever they differ: the clock span the operator typed
    // and the credited length the tag is judged against. Nothing is rounded
    // behind their back.
    '<span class="inv-att-block-len inv-mono">' + (hrs == null ? '&mdash;'
      : (span != null && span !== hrs
        ? formatNum(span, 1) + ' h &rarr; ' + formatNum(hrs, 1) + ' credited'
        : formatNum(hrs, 1) + ' h')) + '</span>' +
    '</div>';

  // Areas as toggles rather than one select, because a block row genuinely
  // spans several: the relay writes one tag over A1 and A2 together about as
  // often as one each, and the complement differs between the two readings.
  html += '<div class="inv-att-block-areas">';
  STAFF_AREAS.filter(function(a) { return a.floor && a.id !== 'flex'; }).forEach(function(a) {
    var on = areas.indexOf(a.id) >= 0;
    html += '<button class="inv-att-chip' + (on ? ' inv-att-chip-on' : '') + '" data-action="invAttBlockArea" ' +
      'data-idx="' + i + '" data-area="' + escHtml(a.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
      escHtml(a.label) + '</button>';
  });
  html += '</div>';

  html += '<div class="inv-att-block-crew">' +
    '<span class="inv-att-block-label">On the block</span>' +
    '<span class="inv-att-block-count inv-mono">' + crew.length + '</span></div>' +
    '<div class="inv-att-block-names">';
  if (roster.length === 0) {
    html += '<span class="inv-att-block-empty">No roster yet &mdash; import one on the Roster view</span>';
  } else {
    roster.forEach(function(w) {
      var on = crew.indexOf(w.id) >= 0;
      html += '<button class="inv-att-chip' + (on ? ' inv-att-chip-on' : '') + '" data-action="invAttBlockCrew" ' +
        'data-idx="' + i + '" data-worker="' + w.id + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        escHtml(w.name) + '</button>';
    });
  }
  html += '</div>';

  // The prediction, in place, so the operator sees the check as they type it
  // rather than having to leave for the Areas view to find out.
  var norm = blockNorm({ areas: areas }, [{ areas: areas }].concat(siblings || []));
  // The preview must refuse on exactly the conditions `areaStats` refuses on,
  // or the two surfaces disagree about the same row. A MISSING crew key is not
  // a crew of zero: zero heads is a real reading (the shop books a fully-short
  // line that way), but nobody having typed the crew is not.
  var hasCrew = Array.isArray(x.crew);
  if (hrs != null && norm != null && hasCrew) {
    var short = Math.max(0, norm - crew.length);
    var expect = gstRound(short * hrs);
    var booked = x.hours || 0;
    var ok = Math.abs(booked - expect) <= 0.001;
    html += '<div class="inv-att-block-check' + (ok ? ' inv-att-block-ok' : '') + '">' +
      crew.length + ' of ' + norm + ' &middot; short ' + short + ' &times; ' + formatNum(hrs, 1) + ' h = ' +
      '<strong>' + formatNum(expect, 1) + ' h</strong>' +
      (ok ? ' &mdash; matches' : ' &middot; booked ' + formatNum(booked, 1)) + '</div>';
  } else {
    var missing = [];
    if (hrs == null) missing.push('in/out times');
    if (norm == null) missing.push('an area with a complement');
    if (!hasCrew) missing.push('its crew');
    html += '<div class="inv-att-block-check">Not checkable yet &mdash; needs ' +
      escHtml(missing.join(', ')) + '. The hours still count in the bill.</div>';
  }

  return html + '</div>';
}

function _attExtraCard(iso, rec) {
  var rows = rec ? rec.extra : [];
  var html = '<div class="inv-card"><div class="inv-card-header">' +
    '<span class="inv-card-title">Extra hours</span>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAttAddExtra">Add</button></div>' +
    '<div class="inv-stats-note">Hours booked to an area block rather than to a named worker &mdash; ' +
    'the <span class="inv-mono">EXTRA n HOURS</span> lines on the daily sheet. Priced at the contract tier ' +
    '(' + formatCurrency((S.labour && S.labour.extraRate) || 0) + '/h) and counted in the bill. ' +
    'Both kinds are checked against the shortfall in the area that ran; they differ only in the ' +
    '<strong>multiplier</strong>. A general shift credits a missing hand a full eight hours. An ' +
    '<strong>OT block</strong> credits it the block&rsquo;s own length, so it needs its in and out ' +
    'times and its crew &mdash; the day&rsquo;s marks supply neither, because a hand on one area ' +
    'all day turns up in another area&rsquo;s evening block.</div>';
  if (rows.length === 0) {
    html += '<div class="inv-empty-state inv-empty-state-sm">None booked for this day</div>';
  } else {
    rows.forEach(function(x, i) {
      var kind = x.kind || 'coverage';
      html += '<div class="inv-att-extra-row">' +
        // A block row's areas are the chips below; showing the single-area
        // select as well would let the operator set an area the reconciler
        // never reads, and the hours would bucket somewhere the check does
        // not look.
        (kind === 'block'
          ? '<span class="inv-att-extra-areas-label">' +
            escHtml(_attBlockAreaSummary(x)) + '</span>'
          : '<select class="inv-form-select" data-att-extra-area data-idx="' + i + '" aria-label="Area for extra hours">' +
            attAreaOptions(x.area) + '</select>') +
        '<input type="number" class="inv-form-input inv-mono" data-att-extra-hours data-idx="' + i +
        '" step="0.5" min="0" value="' + (x.hours || 0) + '" aria-label="Extra hours">' +
        '<button class="inv-att-extra-del" data-action="invAttRemoveExtra" data-idx="' + i + '" aria-label="Remove">&times;</button>' +
        '</div>' +
        '<div class="inv-att-extra-kind">' +
        '<select class="inv-form-select" data-att-extra-kind data-idx="' + i + '" aria-label="Kind of extra hours">' +
        EXTRA_KINDS.map(function(k) {
          return '<option value="' + k.id + '"' + (kind === k.id ? ' selected' : '') + '>' + escHtml(k.label) + '</option>';
        }).join('') + '</select>' +
        '<span class="inv-att-extra-hint">' + escHtml((EXTRA_KINDS.find(function(k) { return k.id === kind; }) || EXTRA_KINDS[0]).hint) + '</span>' +
        '</div>';
      // Siblings matter: the pickling fold depends on whether ANOTHER row in
      // the same block tags pickling, so the preview must see them or it will
      // disagree with the Areas card over the same day.
      if (kind === 'block') {
        html += _attBlockFields(x, i, rows.filter(function(r) {
          return r !== x && r.kind === 'block' && blockKey(r) === blockKey(x);
        }));
      }
    });
  }
  return html + '</div>';
}

/* ===== WEEK VIEW ===== */
function _attWeekView() {
  var days = attWeekDays(_attWeekStart);
  var roster = staffActive();
  var last = days[days.length - 1];

  var html = '<div class="inv-att-nav">' +
    '<button class="inv-att-nav-btn" data-action="invAttWeekStep" data-step="-1" aria-label="Previous week">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>' +
    '<div class="inv-att-nav-label"><span class="inv-att-week-num">Week ' + attWeekNumber(_attWeekStart) + '</span>' +
    '<span class="inv-att-nav-day">' + formatDate(_attWeekStart) + ' &ndash; ' + formatDate(last) + '</span></div>' +
    '<button class="inv-att-nav-btn" data-action="invAttWeekStep" data-step="1" aria-label="Next week">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAttThisWeek">This week</button>' +
    '</div>';

  html += '<div class="inv-card"><div class="inv-card-header"><span class="inv-card-title">Week grid</span></div>' +
    '<div class="inv-stats-note">Tap a cell to cycle it: present, half day, absent, then back to unmarked. ' +
    'An unmarked cell is a day nobody typed &mdash; which is not the same fact as a day nobody worked, ' +
    'and the labour figures below keep the two apart.</div>' +
    '<div class="inv-att-grid-wrap"><table class="inv-att-grid">' +
    '<thead><tr><th class="inv-att-grid-name">Worker</th>' +
    days.map(function(d) {
      return '<th class="inv-att-grid-day' + (d === localDateStr() ? ' inv-att-grid-today' : '') + '">' +
        attDayName(d) + '<span class="inv-att-grid-date">' + attParseIso(d).getDate() + '</span></th>';
    }).join('') + '</tr></thead><tbody>';

  roster.forEach(function(w) {
    var cls = compClass(w.comp);
    var hourly = compIsHourly(w);
    html += '<tr><th class="inv-att-grid-name"><span class="inv-att-grid-worker">' + escHtml(w.name) + '</span>' +
      '<span class="inv-att-grid-comp inv-att-badge-' + cls.tone + '" title="' + escHtml(cls.label) + '">' +
      cls.short + '</span></th>';
    days.forEach(function(d) {
      var m = attMark(d, w.id);
      var st = m ? m.st : '';
      // The corner figure is the hours that decide this worker's pay: the whole
      // day for the hourly pool, the overtime on top for everyone else.
      var badge = m ? (hourly ? (m.hours || 0) : (m.ot || 0)) : 0;
      html += '<td class="inv-att-grid-cell"><button class="inv-att-cell inv-att-cell-' +
        (st ? st.toLowerCase() : 'u') + '" data-action="invAttCycle" data-id="' + w.id + '" data-date="' + d +
        '" aria-label="' + escHtml(w.name) + ' ' + attDayName(d) + ' ' + (st ? ATT_STATE_LABELS[st] : 'unmarked') +
        (badge ? ', ' + formatNum(badge, 1) + ' hours' : '') + '">' +
        (st || '·') + (badge ? '<span class="inv-att-cell-ot">' + formatNum(badge, 0) + '</span>' : '') +
        '</button></td>';
    });
    html += '</tr>';
  });

  html += '</tbody><tfoot><tr><th class="inv-att-grid-name">On site</th>' +
    days.map(function(d) {
      var rec = attDay(d, false);
      if (!rec) return '<td class="inv-att-grid-cell inv-att-grid-foot">&mdash;</td>';
      var n = 0;
      roster.forEach(function(w) {
        var m = rec.marks[w.id];
        if (m && (m.st === 'P' || m.st === 'H')) n++;
      });
      return '<td class="inv-att-grid-cell inv-att-grid-foot">' + n + '<span class="inv-att-grid-of">/' + roster.length + '</span></td>';
    }).join('') + '</tr></tfoot></table></div></div>';

  html += renderLabourCard(_attWeekStart, attAddDays(_attWeekStart, 6), 'Week cost');
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

  var html = '<div class="inv-card"><div class="inv-card-header">' +
    '<span class="inv-card-title">Roster</span>' +
    '<span class="inv-att-roster-actions">' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAttImportRoster">Import</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAttAddWorker">Add worker</button></span></div>' +
    '<div class="inv-stats-note">' + activeCount + ' active of ' + all.length + ' on file. ' +
    'The denominator on every headcount above is this number.</div>';

  if (all.length === 0) {
    html += '<div class="inv-empty-state inv-empty-state-sm">Nobody on file yet</div></div>';
    return html;
  }

  all.forEach(function(w) {
    var cls = compClass(w.comp);
    html += '<div class="inv-client-item' + (w.active === false ? ' inv-client-inactive' : '') +
      '" data-action="invAttEditWorker" data-id="' + w.id + '">' +
      '<div class="inv-client-content"><div class="inv-client-name">' + escHtml(w.name) + '</div>' +
      '<div class="inv-client-meta inv-mono">' + escHtml(workerRateLabel(w)) + '</div>' +
      '<div class="inv-client-badges">' +
      '<span class="inv-att-badge inv-att-badge-' + cls.tone + '">' + escHtml(cls.label) + '</span>' +
      '<span class="inv-client-badge inv-badge-mode">' + escHtml(areaLabel(w.area)) + '</span>' +
      (w.onFloor === false ? '<span class="inv-client-badge inv-badge-rate">Off floor</span>' : '') +
      (w.active === false ? '<span class="inv-client-badge inv-badge-inactive">Inactive</span>' : '') +
      '</div></div>' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>';
  });
  return html + '</div>';
}

/* The hourly rate a worker's overtime is paid at.

   For the monthly tier it is derived — `₹/day ÷ 8` — which is what makes the
   rate card's own OT column fall out of the day rate rather than being a second
   number to keep in step with it. An explicit `hourRate` still overrides, for a
   worker whose overtime was negotiated apart from their day. */
function workerOtRate(w) {
  if (!w) return 0;
  if (w.hourRate > 0) return w.hourRate;
  if (w.comp === 'monthly') return (w.dayRate || 0) / 8;
  return 0;
}

function workerRateLabel(w) {
  var cls = compClass(w.comp);
  if (cls.id === 'hourly') return formatCurrency(w.hourRate || 0) + '/h, every hour';
  var ot = workerOtRate(w);
  return formatCurrency(w.dayRate || 0) + '/day · OT ' + formatCurrency(ot) + '/h' +
    (cls.id === 'monthly' && !(w.hourRate > 0) ? ' (derived)' : '');
}

/* ===== ACTIONS ===== */
function attSetView(view) {
  _attView = view;
  renderAttendance();
}

function attStepDay(n) {
  _attDate = attAddDays(_attDate || localDateStr(), n);
  renderAttendance();
}

function attGoToday() {
  _attDate = localDateStr();
  _attWeekStart = attWeekStartOf(_attDate);
  renderAttendance();
}

function attStepWeek(n) {
  _attWeekStart = attAddDays(_attWeekStart || attWeekStartOf(localDateStr()), n * 7);
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
  var w = staffById(staffId);
  if (!w) return;
  var rec = attDay(iso, true);
  if (!st) {
    delete rec.marks[staffId];
  } else {
    var m = rec.marks[staffId] || { ot: 0, hours: 0, area: w.area || 'flex' };
    m.st = st;
    // Absent pays nothing and worked nothing: hours that nobody was here for
    // are not hours, in either tier.
    if (st === 'A') { m.ot = 0; m.hours = 0; }
    rec.marks[staffId] = m;
  }
  _attPrune(iso);
  saveState();
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
  var m = attMark(_attDate, staffId);
  if (!m) return;                       // OT without a presence mark is not a fact
  m.ot = Math.max(0, Number(hours) || 0);
  saveState();
}

/* Hours worked, for the hourly pool. Same guard as OT: hours without a
   presence mark are not a fact about the day. */
function setAttHours(staffId, hours) {
  var m = attMark(_attDate, staffId);
  if (!m) return;
  m.hours = Math.max(0, Number(hours) || 0);
  saveState();
}

function setAttArea(staffId, areaId) {
  var m = attMark(_attDate, staffId);
  if (!m) return;
  m.area = areaId;
  saveState();
}

/* Marks every unmarked worker present. It never overwrites a mark already
   made — the absences are the part that was typed deliberately. */
function attAllPresent() {
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
  var rec = attDay(_attDate, true);
  rec.extra.push({ area: 'barrel', hours: 0, kind: 'coverage' });
  saveState();
  renderAttendance();
}

function attRemoveExtra(idx) {
  var rec = attDay(_attDate, false);
  if (!rec) return;
  rec.extra.splice(idx, 1);
  _attPrune(_attDate);
  saveState();
  renderAttendance();
}

function setAttExtraArea(idx, areaId) {
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  rec.extra[idx].area = areaId;
  saveState();
}

function setAttExtraKind(idx, kind) {
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  var x = rec.extra[idx];
  x.kind = EXTRA_KINDS.some(function(k) { return k.id === kind; }) ? kind : 'coverage';
  // Flipping back to a general shift must CLEAR the block-only fields. Left
  // behind, `areas[]` still splits the row's hours across areas the UI no
  // longer shows (the select renders `x.area` alone) while `_absorption`'s
  // coverage branch absorbs against `x.area` only — hours over two areas,
  // absorbed by one area's crew. Numerator and denominator, again.
  if (x.kind === 'coverage') {
    delete x.areas; delete x.crew; delete x.from; delete x.to;
  }
  saveState();
}

function setAttBlockTime(idx, which, value) {
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  rec.extra[idx][which === 'to' ? 'to' : 'from'] = String(value || '');
  saveState();
}

/* Areas and crew are toggles, so both setters flip membership rather than
   replacing a value. `areas` is written even for a single pick, because the
   reconciler reads it first and falls back to `area` only for rows that
   predate this field. */
function toggleAttBlockArea(idx, areaId) {
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
  saveState();
}

function toggleAttBlockCrew(idx, workerId) {
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  var id = Number(workerId);
  if (!staffById(id)) return;
  var x = rec.extra[idx];
  var list = Array.isArray(x.crew) ? x.crew.slice() : [];
  var at = list.indexOf(id);
  if (at >= 0) list.splice(at, 1); else list.push(id);
  x.crew = list;
  saveState();
}

function setAttExtraHours(idx, hours) {
  var rec = attDay(_attDate, false);
  if (!rec || !rec.extra[idx]) return;
  rec.extra[idx].hours = Math.max(0, Number(hours) || 0);
  saveState();
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

function _showWorkerOverlay(worker, isAdd) {
  var w = worker || _blankWorker();
  var marks = worker ? _attMarkCount(w.id) : 0;
  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">' + (isAdd ? 'Add Worker' : 'Edit Worker') + '</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="wedName">Name</label>' +
    '<input class="inv-form-input" id="wedName" value="' + escHtml(w.name) + '"></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label" for="wedComp">Comp class</label>' +
    '<select class="inv-form-select" id="wedComp">' +
    COMP_CLASSES.map(function(c) {
      return '<option value="' + c.id + '"' + (w.comp === c.id ? ' selected' : '') + '>' + escHtml(c.label) + '</option>';
    }).join('') + '</select></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="wedArea">Area</label>' +
    '<select class="inv-form-select" id="wedArea">' + attAreaOptions(w.area) + '</select></div></div>' +
    '<div class="inv-stats-note">' + COMP_CLASSES.map(function(c) {
      return '<strong>' + escHtml(c.label) + '</strong> &mdash; ' + escHtml(c.hint) + '.';
    }).join(' ') + '</div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label" for="wedDay">Day rate</label>' +
    '<input class="inv-form-input inv-mono" id="wedDay" type="number" step="0.01" min="0" value="' + (w.dayRate || 0) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="wedHour">Hour rate</label>' +
    '<input class="inv-form-input inv-mono" id="wedHour" type="number" step="0.01" min="0" value="' + (w.hourRate || 0) + '"></div></div>' +
    '<div class="inv-stats-note">The hourly tier uses the hour rate alone. The monthly and daily tiers use the day ' +
    'rate; leave their hour rate at zero and a monthly worker&rsquo;s overtime derives as <span class="inv-mono">day rate ÷ 8</span>, ' +
    'which is how the rate card&rsquo;s own OT column is built. Wages are counted only for days actually recorded, ' +
    'which is why the labour card states its coverage.</div>' +
    '<div class="inv-flex-between inv-mb-8"><label class="inv-checkbox-label">' +
    '<input type="checkbox" id="wedFloor"' + (w.onFloor !== false ? ' checked' : '') + '> On the plant floor</label></div>' +
    '<div class="inv-stats-note">Clear this for the gate and the office. Their wage is still labour and still in the ' +
    'bill; it is simply not plating cost, and the breakdown splits it out.</div>' +
    '<div class="inv-flex-between inv-mb-16"><label class="inv-checkbox-label">' +
    '<input type="checkbox" id="wedActive"' + (w.active !== false ? ' checked' : '') + '> Active</label></div>' +
    (isAdd ? '' : '<button class="inv-btn inv-btn-danger inv-btn-sm inv-mb-16" data-action="invAttDeleteWorker" data-id="' + w.id + '">Delete worker' +
      (marks > 0 ? ' (' + marks + ' day' + (marks === 1 ? '' : 's') + ' recorded)' : '') + '</button>') +
    '<div class="inv-btn-bar"><button class="inv-btn inv-btn-ghost" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invAttSaveWorker" data-id="' + w.id +
    '" data-mode="' + (isAdd ? 'add' : 'edit') + '">' + (isAdd ? 'Add Worker' : 'Save') + '</button></div></div>';
  scrim.addEventListener('click', function(e) {
    if (e.target === scrim) { scrim.remove(); document.body.style.overflow = ''; popFocus(); }
  });
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
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

function saveWorker(id, mode) {
  var name = document.getElementById('wedName').value.trim();
  if (!name) { showToast('Worker name is required', 'error'); return; }
  var comp = document.getElementById('wedComp').value;
  var dup = (S.staff || []).find(function(x) {
    return x.id !== id && (x.name || '').trim().toLowerCase() === name.toLowerCase();
  });
  if (dup) { showToast('Already on the roster: ' + dup.name, 'error'); return; }

  var fields = {
    name: name,
    comp: comp,
    dayRate: Math.max(0, parseFloat(document.getElementById('wedDay').value) || 0),
    hourRate: Math.max(0, parseFloat(document.getElementById('wedHour').value) || 0),
    area: document.getElementById('wedArea').value,
    onFloor: document.getElementById('wedFloor').checked,
    active: document.getElementById('wedActive').checked
  };

  // A rate of zero is not refused — a worker can be on the roster before the
  // rate is settled — but the labour card would then be quietly short, so it
  // is said once here rather than discovered as a low ₹/kg later. Which rate
  // has to be present depends on the tier: the hourly pool has no day rate at
  // all, and refusing one for want of it would be a rule about the wrong number.
  var rateMissing = comp === 'hourly' ? fields.hourRate <= 0 : fields.dayRate <= 0;

  if (mode === 'add') {
    if (!S.staff) S.staff = [];
    var nextId = S.staff.reduce(function(m, x) { return Math.max(m, x.id || 0); }, 0) + 1;
    fields.id = nextId;
    fields.note = '';
    S.staff.push(fields);
  } else {
    var w = staffById(id);
    if (!w) return;
    Object.keys(fields).forEach(function(k) { w[k] = fields[k]; });
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
  var inp = document.getElementById('rosterFileInput');
  if (!inp) return;
  inp.onchange = function(e) {
    var f = e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var data;
      try { data = JSON.parse(ev.target.result); }
      catch (err) { showToast('Not valid JSON: ' + err.message, 'error'); return; }
      var res = applyRosterImport(data);
      if (res.error) { showToast(res.error, 'error'); return; }
      saveState();
      renderAttendance();
      showToast(res.added + ' added, ' + res.updated + ' updated' +
        (res.skipped ? ', ' + res.skipped + ' skipped' : '') +
        (res.targets ? ' · ' + res.targets + ' complement' + (res.targets === 1 ? '' : 's') + ' set' : ''));
    };
    reader.readAsText(f);
    inp.value = '';
  };
  inp.click();
}

/* The merge itself, split out so it can be tested without a file picker. */
function applyRosterImport(data) {
  var rows = data && Array.isArray(data.staff) ? data.staff
    : (Array.isArray(data) ? data : null);
  if (!rows) return { error: 'No staff array in that file' };

  var added = 0, updated = 0, skipped = 0;
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
    var fields = {
      comp: comp,
      dayRate: Math.max(0, Number(row.dayRate) || 0),
      hourRate: Math.max(0, Number(row.hourRate) || 0),
      area: STAFF_AREAS.some(function(a) { return a.id === rowArea; }) ? rowArea : 'flex',
      onFloor: row.onFloor !== false,
      active: row.active !== false
    };
    var existing = S.staff.find(function(x) {
      return (x.name || '').trim().toLowerCase() === name.toLowerCase();
    });
    if (existing) {
      Object.keys(fields).forEach(function(k) { existing[k] = fields[k]; });
      existing.name = name;
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
    ['otMult', 'restCreditMinDays', 'extraRate', 'modelPerKg', 'gateFull', 'gateHalf',
     'extraHoursPerHead'].forEach(function(k) {
      var v = Number(data.labour[k]);
      if (data.labour[k] != null && !isNaN(v) && v >= 0) S.labour[k] = v;
    });
  }
  return { added: added, updated: updated, skipped: skipped, targets: targets };
}

/* Deletion is refused while attendance names the worker. Removing the row would
   not remove the marks, it would orphan them: every past week's labour would
   silently drop that person's wage and no figure would say why. Deactivating
   keeps the history intact and takes them out of today's denominator, which is
   what "left" actually means here. */
function deleteWorker(id) {
  var w = staffById(id);
  if (!w) return;
  var marks = _attMarkCount(id);
  if (marks > 0) {
    showToast('Cannot delete: ' + w.name + ' is on ' + marks + ' recorded day' +
      (marks === 1 ? '' : 's') + '. Clear Active instead.', 'error');
    return;
  }
  if (!confirm('Delete ' + w.name + ' from the roster?')) return;
  S.staff = S.staff.filter(function(x) { return x.id !== id; });
  saveState();
  closeOverlay();
  renderAttendance();
  showToast(w.name + ' removed');
}
