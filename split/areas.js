/* ===== AREAS =====

   The floor, by place rather than by person.

   Two questions this answers and the other views cannot. **Is an area staffed
   right?** — average heads against a complement the owner sets, with the area's
   own observed median beside it so a target that was never true is visible as
   such. And **does the extra hold up?** — the `EXTRA n HOURS` lines are booked
   to an area block with nobody named against them, which makes them the one
   part of the wage bill nothing in the record corroborates.

   That second question is the reason this view exists, and it is worth being
   precise about what it can and cannot settle. The app can find places where
   the record contradicts itself. It cannot find places where the record is
   consistent and wrong. Every flag below is a flag on the *paperwork*, and a
   contradiction has two possible causes — the hours are wrong, or the area
   assignment was never typed. The view says which it found; it does not say
   which happened. */

var _areaSpan = 1;   // weeks

/* `EXTRA n HOURS` is ONE instrument, and the owner settled it (28 Aug 2026):
   an OT block books the extra exactly as a general shift does — against the
   shortfall in the area that ran. What differs is only the multiplier. A
   general shift credits a missing hand a full 8; a block credits it the
   block's own length, so a 5-to-midnight slot short two hands books 14.

   This REPLACES the earlier reading, which took a block tag as the slot's
   per-hand credit ("5 hands x 3 hr = 15 OT hr") and therefore reconciled it
   against nothing. That reading cannot reproduce that population — though it does
   reproduce individual rows, and the surviving named exception is a row
   where the superseded reading is the one that works (W33 Tue 11, A1: three
   hands x 3 h = 9 = the tag). "Fails every tag" was an unmeasured superlative
   in the same sentence whose other half names its instrument.

   The norm-gap reading matches every tag in the swept population (17 blocks /
   23 rows over W24+W31+W32+W33, once the tags the weekly transcribed into
   man-hr notation are restored from the raw relay; W18-W23 and W25-W30
   unswept) but for ONE named exception -- W33 Tue 11 Aug, disclosed in
   CLAUDE.md. W31 Mon 27 Jul was named beside it and is struck: tagged in the
   raw, under-booked against the prediction, and under-booking is an upper
   bound, never an error. It
   includes the one the codex had written off as
   unreadable — `soma-internal/attendance/2026-W31.md:150` calls the Tue-28
   evening tag "internally inconsistent (group 1: 3x7=21; group 2: 2x7=14!=21)".
   Group 2 is barrel+pickling, a unit of five, two hands present: short three,
   3 x 7 = 21, exactly as tagged. Nothing was inconsistent but the reading.

   The named hands' own overtime is a separate quantity and always was — it is
   on their in/out times, per worker, at their rate x the multiplier. The block
   tag is the unattributed remainder, same as the general-shift one.

   Untagged records default to the general shift: that is what every entry made
   before this field existed meant, and what the area rows on the sheet mean. */
var EXTRA_KINDS = [
  { id: 'coverage', label: 'General shift', hint: 'a missing hand is covered for a full shift \u2014 8 h each' },
  { id: 'block',    label: 'OT block',      hint: '6 AM or evening \u2014 same rule, credited the block\u2019s own hours' }
];

function extraIsCoverage(x) { return !x || !x.kind || x.kind === 'coverage'; }
function extraIsBlock(x) { return !!x && x.kind === 'block'; }

/* A block's length — the CREDITED length, which is not always the clock span.

   The shop credits the 6:00–8:30 morning slot **3 OT hours**, not the 2.5 on
   the clock: `soma-internal/attendance/2026-W24.md:61` states the convention in
   those words, and seven recorded morning tags reconcile at 3 while none
   reconciles at 2.5. Deriving the multiplier from the clock alone flagged every
   faithfully-entered morning block as "more booked than the shortfall explains"
   — a false positive on the most frequent block type in the record.

   So the credited length rounds the span UP to the whole hour. Be exact about
   the evidence: the ONLY convention the corpus states is 2.5 → 3. Rounding up
   is the general rule this app infers from that one instance, and it is a no-op
   on every other recorded block (the evening slot is a clean 7, the 6:00–9:00
   variant a clean 3). A span that is already whole is never moved.

   Two instruments, two lengths, and the app carries both: a NAMED hand's own
   pay uses the clock (BM, 8 Aug — Sambhu's 6:00–8:30 + 5 PM–12 AM = 9.5 hr),
   while the unattributed EXTRA credit uses the convention. `blockSpan` is the
   clock; `blockLength` is what the tag is judged against. The entry row shows
   both whenever they differ, so nothing is rounded behind the operator's back.

   The span itself cannot be derived from the tag — 21 is three hands short of a
   7-hour block and also seven short of a 3-hour one — so deriving it would make
   the check vacuous by construction. It wraps past midnight, because the
   evening slot habitually runs to 12:00. */
function blockSpan(x) {
  if (!x || !x.from || !x.to) return null;
  var a = _hhmm(x.from), b = _hhmm(x.to);
  if (a == null || b == null) return null;
  var mins = b - a;
  // A block cannot be zero-length, and a mis-typed identical pair must not
  // become a 24-hour multiplier: it would over-predict by 8x and the excess
  // lands in "less booked than the shortfall allows", which is never reported
  // as an error. Refuse it instead, so the row says "Not checkable".
  if (mins === 0) return null;
  if (mins < 0) mins += 24 * 60;
  return gstRound(mins / 60);
}

function blockLength(x) {
  var span = blockSpan(x);
  if (span == null) return null;
  return Math.ceil(span - 0.0001);
}

function _hhmm(t) {
  var m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(t || ''));
  if (!m) return null;
  var h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/* The areas a row covers. Block rows may span several — the relay writes one
   tag over A1 and A2 together about as often as one each, and the two readings
   are NOT the same number: separately they are 4 and 4 with pickling on its own
   row, together they are 4 + 4 + 3. */
function extraAreas(x) {
  if (x && Array.isArray(x.areas) && x.areas.length) return x.areas.slice();
  return x && x.area ? [x.area] : [];
}

/* The complement a block row is judged against.

   Units first, so barrel and barrel pickling stay the single unit of five they
   already are everywhere else. Then the pickling fold.

   A VAT line running in a block pulls VAT-side pickling hands with it, and the
   shop writes that as a CO-TAG on the VAT row: `----VAT A1 & pickling`. That is
   not pickling staffed separately — it is the VAT row saying which hands it
   covers — so the row folds (2, or 3 for both lines) rather than carrying
   pickling's own complement of three. Read the other way the flagship recorded
   row predicts 28 against a tag of 21, and the shop's own shorthand becomes
   unenterable: barrel is already read this way (`berral & pickling` is one unit
   of five), and VAT must match it. Owner, 28 Aug 2026.

   Pickling carries its **own** norm only on a row that names it with **no VAT
   line** — a standalone `----pickling----` with its own crew. When such a row
   exists in the block, nothing folds anywhere in that block.

   The ceiling is the ruling's: **both VAT lines at full tilt is 4 + 4 + 3,
   never 4 + 4 + 4.** So the fold is computed for the BLOCK, capped at the three
   hands that exist, and shared across the VAT-covering rows in proportion to
   the lines each covers. Per-row folding would make the answer depend on how
   the relay happened to write the sheet — one row over A1+A2 folding 3 against
   two rows of one line each folding 2+2, the same day reconciling to 11 or to
   12 on nothing but the tagging. Shares divide by the SUM of every row's lines
   rather than the block's distinct count, so overlapping rows cannot fold past
   the ceiling either.

   The fold needs a pickling complement to fold: with none set there are no
   hands to lend, and inventing them would inflate every shortfall.

   The fold is an UPPER BOUND, like every other figure on this card. It assumes
   the lines it covers ran at full tilt; a block running at less needs fewer
   pickling hands and books less. Nothing here measures per-area output, so that
   reduction cannot be derived — which is exactly why booking under the
   prediction is never reported as an error. */
function blockNorm(row, blockRows) {
  var areas = extraAreas(row);
  var rows = blockRows || [row];

  // A standalone pickling row anywhere in the block turns the fold off for all
  // of it; a co-tag does not, and its pickling area is replaced by the fold
  // rather than counted at its full complement.
  var picklingOwnRow = rows.some(function(r) {
    var a = extraAreas(r);
    return a.indexOf('pickling-vat') >= 0 && _vatLines(a) === 0;
  });
  var mine = _vatLines(areas);
  var coTagged = mine > 0 && areas.indexOf('pickling-vat') >= 0 && !picklingOwnRow;
  var counted = coTagged
    ? areas.filter(function(id) { return id !== 'pickling-vat'; })
    : areas;

  var seen = {}, norm = 0, hasNorm = false;
  counted.forEach(function(id) {
    var unit = areaUnitOf(id);
    if (!unit || seen[unit]) return;
    seen[unit] = true;
    STAFF_AREAS.forEach(function(y) {
      if (areaUnitOf(y.id) !== unit) return;
      var t = areaTarget(y.id);
      if (t != null) { norm += t; hasNorm = true; }
    });
  });
  if (!hasNorm) return null;

  var cap = areaTarget('pickling-vat');
  if (!picklingOwnRow && cap != null && mine > 0) {
    var across = {};
    rows.forEach(function(r) {
      extraAreas(r).forEach(function(id) {
        if (id === 'vat-a1' || id === 'vat-a2') across[id] = true;
      });
    });
    var pool = Math.min(Object.keys(across).length >= 2 ? 3 : 2, cap);
    var claimed = 0;
    rows.forEach(function(r) { claimed += _vatLines(extraAreas(r)); });
    if (claimed > 0) norm += pool * (mine / claimed);
  }
  return norm;
}

function _vatLines(areas) {
  var d = {};
  areas.forEach(function(id) { if (id === 'vat-a1' || id === 'vat-a2') d[id] = true; });
  return Object.keys(d).length;
}

/* ===== THE EXCEPTION LEDGER =====

   A disagreement this card raises is a question. Once a human has looked at it
   and can say why, it stops being a question and becomes a **record** — the
   same treatment `S.voidedNumbers` gives a number gap and `dupeAck` gives an
   accepted duplicate receipt. Two recorded blocks need this already: W31 Mon
   27 Jul, where no fold value reconciles both rows, and W33 Tue 11 Aug, which
   reconciles only at four pickling hands against a ceiling of three. Those are
   the cases that test the rule, and they must be precedent inside the system
   rather than a paragraph in a document nobody queries.

   The reason is REQUIRED, for the reason the void ledger's is: an exception
   with no explanation is indistinguishable from one nobody was shown.

   An acknowledgement is of a SPECIFIC disagreement, not a blanket silence. It
   stores the figures it was granted against, and if the underlying data moves
   — a crew corrected, a tag retyped — the record no longer describes what is
   there. It is then reported as **stale** and the disagreement surfaces again,
   rather than an old note quietly suppressing a new problem. That is the same
   guard the sync SHA gives a blind overwrite. */
function extraExceptions() {
  if (!S.extraExceptions) S.extraExceptions = [];
  return S.extraExceptions;
}

function exceptionKey(d) {
  return [d.iso, d.scope, d.key, d.kind].join('|');
}

function recordExtraException(d, reason) {
  var r = String(reason || '').trim();
  if (!r) return null;
  var rec = {
    iso: d.iso, scope: d.scope, key: d.key, kind: d.kind,
    label: d.label || '',
    // The figures this was granted against. Their disagreement IS the thing
    // being explained, so an exception that no longer matches them explains
    // nothing.
    expected: d.expected == null ? null : gstRound(d.expected),
    booked: d.booked == null ? null : gstRound(d.booked),
    reason: r,
    at: Date.now()
  };
  var list = extraExceptions();
  var at = -1;
  list.forEach(function(x, i) { if (exceptionKey(x) === exceptionKey(rec)) at = i; });
  if (at >= 0) list[at] = rec; else list.push(rec);
  saveState();
  return rec;
}

function removeExtraException(key) {
  var list = extraExceptions();
  for (var i = list.length - 1; i >= 0; i--) {
    if (exceptionKey(list[i]) === key) list.splice(i, 1);
  }
  saveState();
}

/* Split computed disagreements into the ones already explained and the ones
   still open. `stale` is neither: it is an explanation that has come adrift
   from the figures it was written about, which is worth saying out loud. */
function _partitionExceptions(found) {
  var byKey = {};
  extraExceptions().forEach(function(x) { byKey[exceptionKey(x)] = x; });
  var open = [], acked = [], stale = [];
  found.forEach(function(d) {
    var x = byKey[exceptionKey(d)];
    if (!x) { open.push(d); return; }
    var same = _near(x.expected, d.expected) && _near(x.booked, d.booked);
    if (same) acked.push({ d: d, x: x });
    else { stale.push({ d: d, x: x }); open.push(d); }
  });
  return { open: open, acked: acked, stale: stale };
}

function _near(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= 0.001;
}

/* Blocks are keyed by their own times, because two rows at 5 PM are one block
   and a 6 AM row beside them is a different one. */
function blockKey(x) { return (x && x.from ? x.from : '?') + '-' + (x && x.to ? x.to : '?'); }

function areaTarget(areaId) {
  var t = (S.areaTargets || {})[areaId];
  return t > 0 ? t : null;
}

function setAreaTarget(areaId, heads) {
  if (!S.areaTargets) S.areaTargets = {};
  var n = Math.max(0, Number(heads) || 0);
  if (n > 0) S.areaTargets[areaId] = n;
  else delete S.areaTargets[areaId];
  saveState();
}

function _median(nums) {
  if (!nums.length) return 0;
  var s = nums.slice().sort(function(a, b) { return a - b; });
  var mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/* Per-area totals over an inclusive ISO range.

   Heads are counted per day from the marks, so a worker who was moved to
   another area that day counts where they actually stood, not where the roster
   says they live. Marks on `flex` land in the flex bucket and are reported
   there rather than being distributed — a floating hand is a fact about the
   day, not a gap to be filled by guesswork. */
function areaStats(fromIso, toIso) {
  var dates = attDatesInRange(fromIso, toIso);
  var roster = (S.staff || []).filter(function(w) { return w.active !== false; });
  var cfg = labourCfg();

  var byId = {};
  STAFF_AREAS.forEach(function(a) {
    byId[a.id] = {
      id: a.id, label: a.label, floor: a.floor,
      headDays: 0, dayTierDays: 0, hours: 0, otHours: 0, extraHours: 0,
      cost: 0, headsPerDay: [], recordedDays: 0,
      coverageHours: 0, blockHours: 0, days: []
    };
  });

  var units = {};
  var blocks = [];
  var totalRecorded = 0;

  dates.forEach(function(iso) {
    var rec = (S.attendance || {})[iso];
    if (!rec) return;
    var marks = rec.marks || {};
    var extras = rec.extra || [];
    if (Object.keys(marks).length === 0 && extras.length === 0) return;
    totalRecorded++;

    var headsToday = {};
    roster.forEach(function(w) {
      var m = marks[w.id];
      if (!m || !m.st || m.st === 'A') return;
      var areaId = m.area || w.area || 'flex';
      var a = byId[areaId];
      if (!a) return;
      headsToday[areaId] = (headsToday[areaId] || 0) + 1;
      a.headDays++;

      if (w.comp === 'hourly') {
        var hrs = m.hours || 0;
        a.hours += hrs;
        a.cost += hrs * (w.hourRate || 0);
      } else {
        var dayVal = ATT_DAY_VALUE[m.st] || 0;
        a.dayTierDays += dayVal;
        a.cost += dayVal * (w.dayRate || 0);
      }
      var oth = m.ot || 0;
      if (oth > 0) {
        a.otHours += oth;
        a.cost += oth * workerOtRate(w) * cfg.otMult;
      }
    });

    // Bookings are tallied BEFORE the shortfall is judged, because whether an
    // area was idle or fully short turns on whether anything was booked to it.
    // Both kinds are reconciled now; they differ only in the multiplier and in
    // where their heads come from — a general-shift row reads the day's marks,
    // a block row reads its own named crew, because the two are not the same
    // people (a hand on barrel-pickling all day turns up in the A1 evening
    // block, and the marks cannot say so).
    var bookedToday = {}, coverToday = {};
    var blockRowsToday = [];
    extras.forEach(function(x) {
      var h = x.hours || 0;
      // A row booking NOTHING is still evidence about the block's staffing: a
      // 6 AM `pickling` line with a crew and no tag beside a tagged `VAT A2`
      // line is what tells the fold that pickling was separately manned. Drop
      // it before grouping and the VAT row folds hands that were standing
      // right there. It contributes its area, never any hours.
      if (h <= 0) {
        if (extraIsBlock(x)) blockRowsToday.push(x);
        return;
      }
      // A block row may span several areas, and booking the lot to the first
      // of them would misattribute the per-area extra columns — which are the
      // allocation half this whole view exists to answer. Split evenly across
      // the areas the row names; a single-area row is the same arithmetic with
      // a divisor of one, so the general-shift path is untouched.
      var ids = extraAreas(x).filter(function(id) { return !!byId[id]; });
      if (ids.length === 0) ids = ['flex'];
      var share = h / ids.length;
      ids.forEach(function(id) {
        var a = byId[id];
        a.extraHours += share;
        a.cost += share * cfg.extraRate;
        bookedToday[a.id] = (bookedToday[a.id] || 0) + share;
        if (extraIsCoverage(x)) {
          a.coverageHours += share;
          coverToday[a.id] = (coverToday[a.id] || 0) + share;
        } else {
          a.blockHours += share;
        }
      });
      if (!extraIsCoverage(x)) blockRowsToday.push(x);
    });

    // Blocks reconcile per block, not per unit-day: a 6 AM slot and an evening
    // slot on the same date are two different questions with two different
    // crews, and summing them would answer neither.
    var byBlock = {};
    blockRowsToday.forEach(function(x) {
      var k = blockKey(x);
      (byBlock[k] || (byBlock[k] = [])).push(x);
    });
    Object.keys(byBlock).forEach(function(k) {
      var rows = byBlock[k];
      rows.forEach(function(x) {
        if (!(x.hours > 0)) return;   // supplies its area to the fold, books nothing
        var hrs = blockLength(x);
        var norm = blockNorm(x, rows);
        // An empty crew means two different things, and the record itself
        // tells them apart. A crew-less row BESIDE named sibling rows is the
        // relay stating nobody stood that line — W32 Thu-6's pickling rows
        // reconcile only at heads 0 (evening: 3 short × 7 = 21 exactly as
        // tagged; morning: 3 × 3 = 9) — the same reading V-B1 gave a zero-head
        // general-shift area with a booking. A block with no crew named on ANY
        // row is unrecorded: reading that as 0 invented a full-complement
        // shortfall on every imported crew-less block and drained the
        // Not-checkable line.
        var heads = Array.isArray(x.crew) && x.crew.length > 0 ? x.crew.length : null;
        // ... unless the import marked the crew UNRESOLVED: recorded names that
        // failed to match the roster are a head count that exists and is
        // unknown, never a statement of nobody. Promoting it would publish a
        // full-complement shortfall from a record the toast just said was kept
        // as Not checkable (Cipher, Edict V).
        if (heads == null && !x.crewUnknown && rows.some(function(r) {
          return r !== x && Array.isArray(r.crew) && r.crew.length > 0;
        })) heads = 0;
        var booked = x.hours || 0;
        var areas = extraAreas(x);
        var label = areas.map(function(id) {
          var a = byId[id];
          return a ? a.label : id;
        }).join(' + ') || 'Unassigned';

        // An incomplete row is REPORTED, never reconciled at a guess. Without
        // the times there is no multiplier; without a crew there is no head
        // count; without a complement there is nothing to be short of. Any of
        // the three missing and the hours still count in the bill — they are
        // simply not evidence about staffing.
        if (hrs == null || norm == null || heads == null) {
          blocks.push({ iso: iso, key: k, label: label, booked: booked,
            hours: hrs, norm: norm, heads: heads, expected: null, incomplete: true });
          return;
        }
        var short = Math.max(0, norm - heads);
        blocks.push({ iso: iso, key: k, label: label, booked: booked,
          hours: hrs, norm: norm, heads: heads,
          expected: gstRound(short * hrs), short: short, incomplete: false });
      });
    });

    STAFF_AREAS.forEach(function(x) {
      var a = byId[x.id];
      var heads = headsToday[x.id] || 0;
      a.headsPerDay.push(heads);
      if (heads) a.recordedDays++;
      a.days.push({ iso: iso, heads: heads, booked: coverToday[x.id] || 0, all: bookedToday[x.id] || 0 });
    });

    // The norm-gap model, reconciled per UNIT rather than per area: barrel and
    // barrel pickling are one block on the sheet and one shortfall in the
    // decode, whatever they are for staffing.
    var unitSeen = {};
    STAFF_AREAS.forEach(function(x) {
      var unit = areaUnitOf(x.id);
      if (unitSeen[unit]) return;
      unitSeen[unit] = true;
      var members = STAFF_AREAS.filter(function(y) { return areaUnitOf(y.id) === unit; });

      var norm = 0, hasNorm = false, heads = 0, booked = 0;
      members.forEach(function(y) {
        var t = areaTarget(y.id);
        if (t != null) { norm += t; hasNorm = true; }
        heads += headsToday[y.id] || 0;
        booked += coverToday[y.id] || 0;
      });
      if (!hasNorm) return;

      // A norm binds a unit that RAN. A line nobody stood on and nobody booked
      // to is idle, not short of its whole complement — the recorded decode
      // says so on the day A2 did not plate: "no A2 plating, so no A2 norm to
      // fill". Without that, a day running one area of five predicts more
      // coverage than the plant could absorb.
      //
      // But a unit with no heads AND hours booked to it is the opposite case,
      // and the record is equally plain: a zero-head pickling row carrying
      // `EXTRA 24 HOURS` against a norm of three is 8 × 3 exactly — the shop
      // treated it as fully short and fully covered. Judging that one idle
      // would drop it from the expected side while keeping it on the booked
      // side, and the card would report a surplus on a day that balances to
      // the hour. Numerator and denominator, same population.
      var idle = heads === 0 && booked === 0;
      var short = idle ? 0 : Math.max(0, norm - heads);
      // Judged per unit and on coverage only, for the same reason the shortfall
      // is. A merged `Barrel & pickling` row types the hours on the side the
      // heads are not, and per area that reads as an unmanned booking on a unit
      // that was fully staffed. `booked` here is coverage; a block credit is
      // not reconciled at all, so it cannot be an unmanned coverage booking.
      var unmanned = heads === 0 && booked > 0;
      var u = units[unit] || (units[unit] = {
        id: unit, label: areaUnitLabel(unit), members: members.map(function(y) { return y.id; }),
        norm: norm, shortHeads: 0, expectedExtra: 0, booked: 0, idleDays: 0,
        unmannedDays: 0, unmannedHours: 0, days: []
      });
      u.shortHeads += short;
      u.expectedExtra += short * cfg.extraHoursPerHead;
      u.booked += booked;
      if (idle) u.idleDays++;
      if (unmanned) { u.unmannedDays++; u.unmannedHours += booked; }
      u.days.push({ iso: iso, heads: heads, norm: norm, idle: idle, short: short,
                    booked: booked, unmanned: unmanned });
    });
  });

  var rows = STAFF_AREAS.map(function(x) {
    var a = byId[x.id];
    a.avgHeads = totalRecorded > 0 ? a.headDays / totalRecorded : 0;
    a.medianHeads = _median(a.headsPerDay);
    a.target = areaTarget(a.id);
    a.variance = a.target != null ? a.avgHeads - a.target : null;
    a.paidHours = a.hours + a.otHours;
    a.unit = areaUnitOf(a.id);
    // The one diagnostic on the extra. It is NOT an allocation — the app never
    // spreads extra across the men present, and this number is not written
    // anywhere near a wage. It is the plausibility test: how many hours each
    // body standing in this area would have had to work beyond their own
    // recorded time for the booked extra to be theirs.
    a.impliedPerHead = a.headDays > 0 ? a.extraHours / a.headDays : null;
    a.extraShare = (a.paidHours + a.extraHours) > 0 ? a.extraHours / (a.paidHours + a.extraHours) : 0;
    a.cost = gstRound(a.cost);
    return a;
  });

  // The three disagreements, judged per unit for the same reason the shortfall
  // is: booked at or above complement is the case the rule forbids, short with
  // nothing booked is the opposite omission, and a quantity that is neither is
  // a question about the number rather than about the principle.
  var unitRows = Object.keys(units).map(function(k) {
    var u = units[k];
    u.expectedExtra = gstRound(u.expectedExtra);
    u.booked = gstRound(u.booked);
    u.unmannedHours = gstRound(u.unmannedHours);
    u.bookedAtNorm = u.days.filter(function(d) { return !d.idle && d.short === 0 && d.booked > 0; });
    u.shortUnbooked = u.days.filter(function(d) { return !d.idle && d.short > 0 && d.booked === 0; });
    u.mismatched = u.days.filter(function(d) {
      return d.short > 0 && d.booked > 0 && Math.abs(d.booked - d.short * cfg.extraHoursPerHead) > 0.001;
    });
    return u;
  });

  var blockHours = gstRound(rows.reduce(function(s, a) { return s + a.blockHours; }, 0));
  var reconciled = blocks.filter(function(b) { return !b.incomplete; });
  return {
    rows: rows,
    units: unitRows,
    recordedDays: totalRecorded,
    rangeDays: dates.length,
    normed: unitRows.length,
    // Expected and booked are summed over the SAME population — the normed
    // units, coverage bookings only. A block credit and an un-normed area are
    // both excluded from both sides, and both are reported separately.
    expectedExtra: gstRound(unitRows.reduce(function(s, u) { return s + u.expectedExtra; }, 0)),
    bookedInNormed: gstRound(unitRows.reduce(function(s, u) { return s + u.booked; }, 0)),
    bookedExtra: gstRound(rows.reduce(function(s, a) { return s + a.extraHours; }, 0)),
    blockHours: blockHours,
    idleDays: unitRows.reduce(function(s, u) { return s + u.idleDays; }, 0),
    // Blocks: the same three figures over the reconcilable ones only, so the
    // incomplete rows never quietly enter a denominator they cannot answer.
    blocks: blocks,
    blockExpected: gstRound(reconciled.reduce(function(s, b) { return s + b.expected; }, 0)),
    blockBooked: gstRound(reconciled.reduce(function(s, b) { return s + b.booked; }, 0)),
    blockReconciled: reconciled.length,
    blockIncomplete: blocks.filter(function(b) { return b.incomplete; }),
    // Judged at BLOCK level, not per row. When the relay splits one block over
    // two rows the hours it writes on each need not match that row's share of
    // the shortfall — the fold is apportioned, so a 14/14 split against a
    // 1.5/2.5 shortfall reconciles to 28 exactly and flags nothing. Per-row
    // judging reported two disagreements on a block that balances to the hour,
    // which is the same numerator-and-denominator error V-B1 caught once
    // already. The block is the unit, as the invariance property says.
    blockMismatched: _blockGroups(reconciled).filter(function(g) {
      return Math.abs(g.booked - g.expected) > 0.001;
    }).map(function(g) {
      g.scope = 'block'; g.kind = 'mismatched';
      return g;
    }),
    absorption: _absorption(dates, roster, cfg)
  };
}

/* One entry per block, summing the rows the relay wrote for it. */
function _blockGroups(rows) {
  var by = {}, order = [];
  rows.forEach(function(b) {
    var k = b.iso + '|' + b.key;
    if (!by[k]) {
      by[k] = { iso: b.iso, key: b.key, labels: [], expected: 0, booked: 0 };
      order.push(k);
    }
    var g = by[k];
    if (g.labels.indexOf(b.label) < 0) g.labels.push(b.label);
    g.expected += b.expected;
    g.booked += b.booked;
  });
  return order.map(function(k) {
    var g = by[k];
    g.expected = gstRound(g.expected);
    g.booked = gstRound(g.booked);
    g.label = g.labels.join(' + ');
    return g;
  });
}

/* Pro-rata absorption, per worker.

   The ruling that settles what the extra is also settles who carries it: the
   coverage is absorbed collectively by the short area's present crew, pro-rata,
   which makes the hours attributable from the relay format with no new logging.

   And the owner ruled (28 Aug 2026) that this attribution IS the payment: the
   extra is GIVEN pro-rata to the workers of the area where the shortage
   occurred. The money stays UNDER THE EXTRA LINE — one pooled figure that
   Shyam disburses on the floor — and the shares below are the split he
   disburses it by: what each hand receives, not merely a measure of who was
   leaned on, and never a line in the per-worker wage arithmetic. An earlier
   version of this comment called the spread "deliberately not money"; that
   caution was right until the ruling and wrong after it. The labour card's
   totals are untouched: the bill counts the extra exactly once. */
function _absorption(dates, roster, cfg) {
  var by = {};
  dates.forEach(function(iso) {
    var rec = (S.attendance || {})[iso];
    if (!rec) return;
    var marks = rec.marks || {};
    var present = {};
    roster.forEach(function(w) {
      var m = marks[w.id];
      if (!m || !m.st || m.st === 'A') return;
      var areaId = m.area || w.area || 'flex';
      (present[areaId] || (present[areaId] = [])).push(w);
    });
    (rec.extra || []).forEach(function(x) {
      var h = x.hours || 0;
      if (h <= 0) return;
      // A block row names its own crew, which makes its absorption exact rather
      // than inferred — those are the people who were actually on the slot. A
      // general-shift row has no names, so its crew is the area's marks.
      var crew;
      if (extraIsBlock(x)) {
        var ids = Array.isArray(x.crew) ? x.crew : [];
        crew = roster.filter(function(w) { return ids.indexOf(w.id) >= 0; });
      } else {
        crew = present[x.area] || [];
      }
      if (crew.length === 0) return;      // nobody to PAY it to; the flag covers that
      var each = h / crew.length;
      crew.forEach(function(w) {
        var e = by[w.id] || (by[w.id] = { id: w.id, name: w.name, hours: 0, days: 0, _seen: {} });
        e.hours += each;
        // Count DATES, not rows. `days` is the denominator of the per-day
        // ceiling that marks an implausible absorption, and a day carrying
        // both a general-shift row and a block row would otherwise count
        // twice — halving the per-day figure and disarming the very guard
        // that exists to catch fifteen absorbed hours in one day.
        if (!e._seen[iso]) { e._seen[iso] = true; e.days++; }
      });
    });
  });
  // The ruling names the payee, but it does not repeal arithmetic: 24 coverage
  // hours against two present hands is twelve each on top of a full shift.
  // Under the ruling that is money those two RECEIVED, so an over-ceiling row
  // is no longer "probably a different payee" — it is a pay figure that needs
  // checking against the record, and the flag says exactly that.
  var ceiling = (cfg && cfg.extraHoursPerHead) || 8;
  return Object.keys(by).map(function(k) {
    var e = by[k];
    e.perDay = e.days > 0 ? e.hours / e.days : 0;
    e.implausible = e.perDay > ceiling;
    delete e._seen;
    return e;
  }).sort(function(a, b) { return b.hours - a.hours; });
}

/* Ask for the reason. Required, and refused empty — an exception with no
   explanation is indistinguishable from one nobody was shown, which is the
   whole failure the void ledger exists to prevent. */
var _exPending = null;

function openAreaExplain(payload) {
  var d;
  try { d = JSON.parse(decodeURIComponent(payload)); } catch (e) { return; }
  _exPending = d;
  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Explain this exception</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div>' +
    '<div class="inv-stats-note">' + escHtml(d.label) + ' &middot; ' + formatDate(d.iso) + ' &mdash; ' +
    'booked <span class="inv-mono">' + formatNum(d.booked, 1) + ' h</span> against a predicted ' +
    '<span class="inv-mono">' + formatNum(d.expected, 1) + ' h</span>. Say what the record shows, ' +
    'so the next reader inherits the finding rather than the puzzle.</div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="areaExReason">Reason</label>' +
    '<textarea class="inv-form-input" id="areaExReason" rows="3" ' +
    'placeholder="e.g. no fold value reconciles both rows of this block"></textarea></div>' +
    '<div class="inv-btn-bar">' +
    '<button class="inv-btn inv-btn-ghost" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invAreaExplainSave">Record it</button>' +
    '</div></div>';
  document.body.appendChild(scrim);
  var ta = document.getElementById('areaExReason');
  if (ta) ta.focus();
}

function saveAreaExplain() {
  if (!_exPending) return;
  var el = document.getElementById('areaExReason');
  var reason = el ? el.value.trim() : '';
  if (!reason) {
    showToast('A reason is required', 'error');
    if (el) el.focus();
    return;
  }
  recordExtraException(_exPending, reason);
  _exPending = null;
  closeOverlay();
  renderAttendance();
  showToast('Exception recorded');
}

function reopenAreaExplain(key) {
  removeExtraException(decodeURIComponent(key));
  renderAttendance();
  showToast('Exception reopened');
}

/* ===== VIEW ===== */
function _attAreasView() {
  var from = _attWeekStart;
  var to = attAddDays(_attWeekStart, _areaSpan * 7 - 1);
  var stats = areaStats(from, to);

  var html = '<div class="inv-att-nav">' +
    '<button class="inv-att-nav-btn" data-action="invAttWeekStep" data-step="-1" aria-label="Earlier">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>' +
    '<div class="inv-att-nav-label"><span class="inv-att-week-num">' +
    (_areaSpan === 1 ? 'Week ' + attWeekNumber(from) : _areaSpan + ' weeks') + '</span>' +
    '<span class="inv-att-nav-day">' + formatDate(from) + ' &ndash; ' + formatDate(to) + '</span></div>' +
    '<button class="inv-att-nav-btn" data-action="invAttWeekStep" data-step="1" aria-label="Later">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAttThisWeek">This week</button>' +
    '</div>';

  html += '<div class="inv-stats-chips inv-mb-16">' +
    [[1, '1 week'], [4, '4 weeks'], [12, '12 weeks']].map(function(s) {
      return '<button class="inv-chip' + (_areaSpan === s[0] ? ' inv-chip-active' : '') +
        '" data-action="invAreaSpan" data-span="' + s[0] + '">' + s[1] + '</button>';
    }).join('') + '</div>';

  if (stats.recordedDays === 0) {
    return html + '<div class="inv-card"><div class="inv-empty-state inv-empty-state-sm">' +
      'No attendance recorded in this range. Mark some days and the floor appears here.</div></div>';
  }

  html += _areaExtraCard(stats);

  // Ranked by the hours the area actually consumed, because that is what
  // staffing is spent on — a bigger crew standing idle and a smaller one
  // working eighteen hours are different problems and the hours tell them apart.
  var rows = stats.rows.slice().filter(function(a) {
    return a.headDays > 0 || a.extraHours > 0 || a.target != null;
  }).sort(function(a, b) {
    return (b.paidHours + b.extraHours + b.dayTierDays * 8) - (a.paidHours + a.extraHours + a.dayTierDays * 8);
  });

  html += '<div class="inv-card"><div class="inv-card-header"><span class="inv-card-title">Staffing by area</span></div>' +
    '<div class="inv-stats-note">Heads are counted from the day’s marks, so a worker moved to another area ' +
    'counts where they actually stood. Set a complement to see the variance; leave it blank and the area’s own ' +
    'median stands as the only reference &mdash; and the extra above cannot be checked without one. ' +
    'Averages are over the <strong>' + stats.recordedDays +
    ' recorded day' + (stats.recordedDays === 1 ? '' : 's') + '</strong> in this range, not over the calendar.</div>';

  rows.forEach(function(a) { html += _areaRow(a); });
  html += '</div>';

  html += _areaAbsorptionCard(stats);

  var flex = stats.rows.find(function(a) { return a.id === 'flex'; });
  if (flex && flex.headDays > 0) {
    html += '<div class="inv-stats-caveat"><strong>' + formatNum(flex.headDays, 0) + ' worker-day' +
      (flex.headDays === 1 ? '' : 's') + '</strong> sit on Flex and are counted against no area. ' +
      'A floating hand is a fact about the day rather than a gap to fill by guesswork &mdash; but every one of ' +
      'them is missing from the staffing figures above. Set the area on the day view to move them.</div>';
  }

  return html;
}

/* The extra, examined. This is the card the view was asked for.

   The rule is `8 × (norm − heads)` per UNIT, per day: a hand missing from an
   area running at full tilt is covered by the crew who are there, and eight
   hours are booked to the area for it. So the extra is not an unexplained
   line — it is a *prediction*, and a prediction can be checked against what was
   actually booked.

   Be exact about which half of that is ruled. The 11 Jun ruling fixes the label
   under the short sub-area and gives a worked example — A1 3/4, A2 3/4, pickling
   2/3 → 24 h — in which every gap is ONE, so it cannot distinguish 8-per-missing
   -hand from 8-per-short-area. The per-hand scaling is the **owner's, confirmed
   27 Aug 2026**. Two recorded days contradict it: W27 Mon 29 Jun and W28 Fri
   10 Jul, both VAT A1 at 2 of 4, both tagged 8 where per-hand predicts 16. The
   app follows the owner's rule and surfaces those as *booked but not the
   predicted amount* rather than smoothing them away. `extraHoursPerHead` is in
   Settings because the question is not closed.

   The one thing this cannot do is judge capacity. The rule holds when the area
   is running at full tilt; an area that was short *and* running light needs no
   coverage and should book nothing. Nothing in this app measures per-area
   output, so the expected figure is an **upper bound**, and booking under it is
   as likely to mean a light day as a missed tag. The card says that where it
   matters rather than dressing the bound up as a target. */
function _areaExtraCard(stats) {
  var cfg = labourCfg();
  var totalExtra = stats.bookedExtra;
  var totalPaid = stats.rows.reduce(function(s, a) { return s + a.paidHours; }, 0);
  var unmannedH = stats.units.reduce(function(s, u) { return s + u.unmannedHours; }, 0);
  var unmannedDays = stats.units.reduce(function(s, u) { return s + u.unmannedDays; }, 0);

  var html = '<div class="inv-card inv-lab-card"><div class="inv-card-header">' +
    '<span class="inv-card-title">The extra, checked</span>' +
    '<span class="inv-lab-total inv-mono">' + formatNum(totalExtra, 1) + ' h</span></div>';

  if (totalExtra === 0 && stats.expectedExtra === 0 && stats.blockHours === 0) {
    // Nothing to reconcile — but say WHY nothing was expected, because on a
    // day with lines standing idle that is an assumption doing real work.
    var idleQuiet = stats.idleDays;
    return html + '<div class="inv-empty-state inv-empty-state-sm">No extra hours booked, and every area ' +
      'that ran was at its complement' +
      (idleQuiet > 0 ? ' &mdash; ' + idleQuiet + ' unit-day' + (idleQuiet === 1 ? '' : 's') +
        ' were idle and not counted' : '') + '</div></div>';
  }

  // The headline comparison, when there is a norm to compare against.
  if (stats.normed > 0) {
    var gap = stats.bookedInNormed - stats.expectedExtra;
    var tone = Math.abs(gap) < 0.001 ? 'inv-lab-fixed' : (gap > 0 ? 'inv-area-gap-over' : 'inv-area-gap-under');
    html += '<div class="inv-lab-split">' +
      '<div class="inv-lab-half inv-lab-fixed"><div class="inv-lab-half-label">Expected</div>' +
      '<div class="inv-lab-half-value inv-mono">' + formatNum(stats.expectedExtra, 1) + ' h</div>' +
      '<div class="inv-lab-half-sub">' + formatNum(cfg.extraHoursPerHead, 0) + ' h &times; each missing hand</div></div>' +
      '<div class="inv-lab-half ' + tone + '"><div class="inv-lab-half-label">Booked</div>' +
      '<div class="inv-lab-half-value inv-mono">' + formatNum(stats.bookedInNormed, 1) + ' h</div>' +
      '<div class="inv-lab-half-sub">' + (Math.abs(gap) < 0.001 ? 'exactly as predicted'
        : formatNum(Math.abs(gap), 1) + ' h ' + (gap > 0 ? 'more than the shortfall explains' : 'less than the shortfall allows')) +
      '</div></div></div>';

    if (gap > 0.001) {
      html += '<div class="inv-stats-caveat"><strong>More was booked than the shortfall explains.</strong> ' +
        'Under the rule every extra hour answers a missing hand, so a surplus has to come from somewhere the ' +
        'rule does not describe &mdash; hours on top of named columns rather than instead of them, a tag on a ' +
        'full area, or a quantity written larger than the gap. The rows below say which areas and which days.</div>';
    } else if (gap < -0.001) {
      html += '<div class="inv-stats-note">Less was booked than the shortfall allows. That is not in itself ' +
        'wrong: the rule applies to an area running at full tilt, and an area that was short <em>and</em> ' +
        'running light needs no coverage. Nothing here measures per-area output, so the expected figure is an ' +
        '<strong>upper bound</strong> rather than a target.</div>';
    }
  } else {
    html += '<div class="inv-stats-caveat">No complement is set on any area, so there is no shortfall to ' +
      'predict from and the extra cannot be checked &mdash; only counted. Set the norms below ' +
      '(VAT A1 and A2 at 4, Barrel 3, Barrel pickling 2, Pickling A1+A2 3 is the floor\u2019s own full house) ' +
      'and this card starts answering the question it exists for.</div>';
  }

  var share = (totalPaid + totalExtra) > 0 ? (totalExtra / (totalPaid + totalExtra)) * 100 : 0;
  html += _labRow('Extra at the contract tier', formatCurrency(totalExtra * cfg.extraRate),
    formatNum(totalExtra, 1) + ' h &times; ' + formatCurrency(cfg.extraRate) + ' &middot; ' +
    formatNum(share, 1) + '% of paid hours');

  // Three disagreements, kept apart because they mean different things.
  var atNorm = [], unbooked = [], mism = [];
  (stats.units || []).forEach(function(u) {
    u.bookedAtNorm.forEach(function(d) { atNorm.push({ a: u, d: d }); });
    u.shortUnbooked.forEach(function(d) { unbooked.push({ a: u, d: d }); });
    u.mismatched.forEach(function(d) { mism.push({ a: u, d: d }); });
  });

  if (atNorm.length > 0) {
    html += _labRow('Booked at or above complement', atNorm.length + ' unit-day' + (atNorm.length === 1 ? '' : 's'),
      'the rule predicts nothing here');
    html += _areaFlagList(atNorm, function(f) {
      return formatNum(f.d.booked, 1) + ' h on ' + f.d.heads + '/' + f.d.norm;
    }, 'inv-area-flag');
  }
  if (unmannedDays > 0) {
    html += _labRow('Read as fully short', formatNum(unmannedH, 1) + ' h',
      'across ' + unmannedDays + ' unit-day' + (unmannedDays === 1 ? '' : 's') +
      ' nobody was marked on');
  }
  if (mism.length > 0) {
    html += _labRow('Booked, but not the predicted amount', mism.length + ' unit-day' + (mism.length === 1 ? '' : 's'),
      'short, and covered by a different number of hours');
    html += _areaFlagList(mism, function(f) {
      return formatNum(f.d.booked, 1) + ' h against ' + formatNum(f.d.short * cfg.extraHoursPerHead, 1) + ' h';
    }, 'inv-area-flag inv-area-flag-warn');
  }
  if (unbooked.length > 0) {
    html += _labRow('Short, nothing booked', unbooked.length + ' unit-day' + (unbooked.length === 1 ? '' : 's'),
      'a light day, or a tag nobody wrote');
  }
  if (stats.idleDays > 0) {
    html += _labRow('Not running, not counted', stats.idleDays + ' unit-day' + (stats.idleDays === 1 ? '' : 's'),
      'nobody stood on it and nothing was booked to it');
  }
  if (unmannedDays > 0) {
    html += '<div class="inv-stats-note">A unit nobody was marked on that still carries hours is ' +
      'read as <strong>fully short and fully covered</strong> &mdash; a zero-head pickling row against ' +
      'a norm of three booking 24 hours is 8 &times; 3 exactly. It counts on both sides of the check ' +
      'rather than neither, so it does not fail it. What it does say is that the marks for that day ' +
      'were never typed.</div>';
  }
  if (stats.blockHours > 0) html += _areaBlockSection(stats);

  // `unmannedDays` is deliberately NOT a gate. A unit nobody was marked on that
  // carries a booking is read as fully short and fully covered — the ruling this
  // card follows — so it can and does reconcile to the hour. Holding it against
  // the check would mean the canonical case could never pass. It is reported
  // above because the marks were not typed, which is worth knowing on its own.
  // The pass note speaks for the WHOLE card, so it must clear the block
  // disagreements too. Gated on the shift ones alone it rendered "30.0 h
  // against 14.0 h" and "every booking reconciles exactly" one after the other.
  if (atNorm.length === 0 && mism.length === 0 && stats.blockMismatched.length === 0 && stats.normed > 0) {
    html += '<div class="inv-stats-note">Every booking in this range sits on an area that was short by ' +
      'exactly the hands the hours pay for. That is the whole cross-check the record supports, and it passes.</div>';
  } else if (atNorm.length > 0) {
    html += '<div class="inv-stats-caveat">These are flags on the <strong>paperwork</strong>. Hours booked to ' +
      'the wrong area, an area assignment nobody typed, and hours that were never worked all look identical ' +
      'from here, and so does a day the relay simply recorded loosely. What the card gives you is the area and ' +
      'the date &mdash; the sheet settles the rest.</div>';
  }

  html += '<div class="inv-stats-note"><strong>extra /head-day</strong> in the table below is the area&rsquo;s extra ' +
    'hours divided by its worker-days &mdash; the hours each body standing there carried beyond their own ' +
    'recorded time. Under the norm-gap rule that absorption is real and pro-rata, which is what the ' +
    'card below it ranks; it stays out of the wage arithmetic because the payout is pooled, not per-worker.</div>';

  return html + '</div>';
}

/* OT blocks, reconciled on their own terms.

   Same rule as the general shift, different multiplier: a missing hand is
   credited the block's own length rather than a full 8. Kept in its own
   section rather than summed into the shift figures, because the two answer
   different questions — a plant short-handed all day and a plant short-handed
   for a 3-hour morning slot are not the same finding, and one total would
   report neither. */
function _areaBlockSection(stats) {
  var html = '<div class="inv-area-blocks"><div class="inv-stats-note"><strong>OT blocks</strong> ' +
    'book the extra the same way a general shift does &mdash; against the shortfall in the area ' +
    'that ran &mdash; credited the block&rsquo;s own hours rather than a full eight. The named ' +
    'hands&rsquo; own overtime is a separate figure and is not in here.</div>';

  if (stats.blockReconciled > 0) {
    html += _labRow('Expected across the blocks', formatNum(stats.blockExpected, 1) + ' h',
      'shortfall &times; each block\u2019s own length');
    html += _labRow('Booked', formatNum(stats.blockBooked, 1) + ' h',
      'across ' + stats.blockReconciled + ' block row' + (stats.blockReconciled === 1 ? '' : 's'));
  }

  var part = _partitionExceptions(stats.blockMismatched);
  if (part.open.length > 0) {
    html += _labRow('Booked, but not the predicted amount', part.open.length + ' block' +
      (part.open.length === 1 ? '' : 's'), 'the block\u2019s shortfall explains a different number');
    html += '<div class="inv-area-flags">';
    part.open.slice(0, 8).forEach(function(b) {
      html += '<div class="inv-area-flag inv-area-flag-warn">' +
        '<span class="inv-area-flag-area">' + escHtml(b.label) + '</span>' +
        '<span class="inv-area-flag-date">' + formatDate(b.iso) + '</span>' +
        '<span class="inv-area-flag-hours inv-mono">' + formatNum(b.booked, 1) + ' h against ' +
        formatNum(b.expected, 1) + ' h</span>' +
        '<button class="inv-area-flag-explain" data-action="invAreaExplain" ' +
        'data-ex="' + encodeURIComponent(JSON.stringify({
          iso: b.iso, scope: b.scope, key: b.key, kind: b.kind,
          label: b.label, expected: b.expected, booked: b.booked
        })) + '">Explain</button></div>';
    });
    html += '</div>';
  } else if (stats.blockReconciled > 0 && part.acked.length === 0) {
    html += '<div class="inv-stats-note">Every block row sits on a shortfall that explains its ' +
      'hours exactly. That is the whole cross-check the record supports, and it passes.</div>';
  }

  if (part.stale.length > 0) {
    html += _labRow('Explanation no longer matches', part.stale.length + ' block' +
      (part.stale.length === 1 ? '' : 's'), 'the figures moved since it was written');
    html += '<div class="inv-stats-caveat">An exception is granted against the numbers it was ' +
      'written about. These have changed since &mdash; a crew corrected, a tag retyped &mdash; so ' +
      'the note no longer describes what is here and the disagreement is listed again above. ' +
      'Explain it afresh rather than letting an old note quietly cover a new problem.</div>';
  }

  if (part.acked.length > 0) {
    html += _labRow('Explained exceptions', part.acked.length + ' block' +
      (part.acked.length === 1 ? '' : 's'), 'examined, and the reason is on the record');
    html += '<div class="inv-area-flags">';
    part.acked.slice(0, 8).forEach(function(a) {
      html += '<div class="inv-area-flag inv-area-flag-ack">' +
        '<span class="inv-area-flag-area">' + escHtml(a.x.label || a.d.label) + '</span>' +
        '<span class="inv-area-flag-date">' + formatDate(a.d.iso) + '</span>' +
        '<span class="inv-area-flag-hours inv-mono">' + formatNum(a.d.booked, 1) + ' h against ' +
        formatNum(a.d.expected, 1) + ' h</span>' +
        '<span class="inv-area-flag-reason">' + escHtml(a.x.reason) + '</span>' +
        '<button class="inv-area-flag-explain" data-action="invAreaUnexplain" ' +
        'data-key="' + encodeURIComponent(exceptionKey(a.x)) + '">Reopen</button></div>';
    });
    html += '</div>';
    html += '<div class="inv-stats-note">These are the cases the rule does <strong>not</strong> ' +
      'reproduce, kept as records rather than smoothed away. A rule whose exceptions are named is ' +
      'one you can trust the rest of; a rule with none is one nobody has tested.</div>';
  }

  // Never reconciled at a guess, and never silently dropped either.
  if (stats.blockIncomplete.length > 0) {
    var ih = stats.blockIncomplete.reduce(function(s, b) { return s + b.booked; }, 0);
    html += _labRow('Not checkable', formatNum(ih, 1) + ' h',
      stats.blockIncomplete.length + ' row' + (stats.blockIncomplete.length === 1 ? '' : 's') +
      ' missing times, crew or a complement');
    html += '<div class="inv-stats-caveat">A block is checked against <strong>its own length ' +
      '&times; its own shortfall</strong>, so it needs all three: the in and out times give the ' +
      'multiplier, the named crew gives the head count (the day&rsquo;s marks cannot &mdash; a hand ' +
      'on one area all day turns up in another area&rsquo;s evening block), and the areas it covers ' +
      'give the complement. These hours are still counted in the bill; they are simply not ' +
      'evidence about staffing.</div>';
  }

  return html + '</div>';
}

function _areaFlagList(flags, detail, cls) {
  var html = '<div class="inv-area-flags">';
  flags.slice(0, 8).forEach(function(f) {
    html += '<div class="' + cls + '"><span class="inv-area-flag-area">' + escHtml(f.a.label) + '</span>' +
      '<span class="inv-area-flag-date">' + formatDate(f.d.iso) + '</span>' +
      '<span class="inv-area-flag-hours inv-mono">' + detail(f) + '</span></div>';
  });
  if (flags.length > 8) {
    html += '<div class="' + cls + ' inv-area-flag-more">' + (flags.length - 8) + ' more</div>';
  }
  return html + '</div>';
}

/* Who carried the coverage. Ranked, because the question this answers is which
   hands the shortfall keeps landing on. */
function _areaAbsorptionCard(stats) {
  var rows = stats.absorption;
  if (!rows || rows.length === 0) return '';
  var cfg = labourCfg();
  var total = rows.reduce(function(s, r) { return s + r.hours; }, 0);
  var html = '<div class="inv-card"><div class="inv-card-header">' +
    '<span class="inv-card-title">The extra, paid pro-rata</span>' +
    '<span class="inv-lab-total inv-mono">' + formatCurrency(gstRound(total * cfg.extraRate)) + '</span></div>' +
    '<div class="inv-stats-note">The extra is booked to an area, and <strong>the area&rsquo;s present crew ' +
    'receive it pro-rata</strong> (owner, 28 Aug 2026). It stays under the <strong>EXTRA</strong> line of the ' +
    'bill &mdash; one pooled figure, <strong>disbursed by Shyam on the floor</strong> &mdash; and these shares ' +
    'are the split he disburses it by. Nothing here enters the per-worker wage arithmetic; the bill counts the ' +
    'extra exactly once, and this card says who it reaches.</div>';
  var flagged = 0;
  rows.slice(0, 12).forEach(function(r) {
    if (r.implausible) flagged++;
    html += '<div class="inv-stats-row"><span class="inv-stats-name">' + escHtml(r.name) +
      (r.implausible ? '<span class="inv-area-absorb-flag">more than a shift</span>' : '') + '</span>' +
      '<span class="inv-stats-val">' + formatCurrency(gstRound(r.hours * cfg.extraRate)) +
      '<span class="inv-area-absorb-days"> · ' + formatNum(r.hours, 1) + ' h · ' +
      formatNum(r.perDay, 1) + ' h/day over ' + r.days +
      ' day' + (r.days === 1 ? '' : 's') + '</span></span></div>';
  });
  if (flagged > 0) {
    html += '<div class="inv-stats-caveat">Marked rows are paid more in a day than a body could stand on top ' +
      'of their own shift &mdash; twenty-four coverage hours against two present hands is twelve each. The ' +
      'ruling names the payee; it does not repeal arithmetic. Check those rows against the record before ' +
      'reading them as settled pay.</div>';
  }
  return html + '</div>';
}

function _areaRow(a) {
  var target = a.target;
  var tone = '';
  var badge = '';
  if (target != null) {
    var v = a.avgHeads - target;
    // Half a head either way is rounding on a small crew, not a staffing call.
    if (v >= 0.5) { tone = ' inv-area-over'; badge = '+' + formatNum(v, 1) + ' over'; }
    else if (v <= -0.5) { tone = ' inv-area-under'; badge = formatNum(v, 1) + ' under'; }
    else { tone = ' inv-area-ok'; badge = 'at complement'; }
  }

  // NOTE on the basis. This figure is what was PAID FOR WORK DONE IN THIS AREA:
  // every tier's day or hour pay, its OT, and the extra booked here. It is not
  // the labour card's variable-by-area figure and must not be read as one —
  // that one deliberately omits the monthly tier's day pay (the standing crew's
  // cost does not follow the area it happened to stand in) and includes the
  // daily tier's rest credit (which is not worked in any area). Two questions,
  // two bases; the label below says which this is.
  var bits = [];
  if (a.dayTierDays > 0) bits.push(formatNum(a.dayTierDays, 1) + ' day-tier day' + (a.dayTierDays === 1 ? '' : 's'));
  if (a.hours > 0) bits.push(formatNum(a.hours, 1) + ' pool h');
  if (a.otHours > 0) bits.push(formatNum(a.otHours, 1) + ' OT h');

  return '<div class="inv-area-row' + tone + '">' +
    '<div class="inv-area-head">' +
    '<span class="inv-area-name">' + escHtml(a.label) +
    (a.floor ? '' : '<span class="inv-area-offfloor">off floor</span>') + '</span>' +
    (badge ? '<span class="inv-area-badge">' + badge + '</span>' : '<span class="inv-area-badge inv-area-badge-none">no complement</span>') +
    '</div>' +
    '<div class="inv-area-grid">' +
    '<div class="inv-area-stat"><span class="inv-area-stat-value inv-mono">' + formatNum(a.avgHeads, 1) + '</span>' +
    '<span class="inv-area-stat-label">avg heads</span></div>' +
    '<div class="inv-area-stat"><span class="inv-area-stat-value inv-mono">' + formatNum(a.medianHeads, 1) + '</span>' +
    '<span class="inv-area-stat-label">median</span></div>' +
    '<div class="inv-area-stat"><span class="inv-area-stat-value inv-mono">' + formatNum(a.extraHours, 1) +
    (a.blockHours > 0 ? '<span class="inv-area-stat-vs">' + formatNum(a.blockHours, 0) + ' blk</span>' : '') + '</span>' +
    '<span class="inv-area-stat-label">extra h</span></div>' +
    '<div class="inv-area-stat"><span class="inv-area-stat-value inv-mono">' +
    (a.impliedPerHead != null ? formatNum(a.impliedPerHead, 1) : '&mdash;') + '</span>' +
    '<span class="inv-area-stat-label">extra /head-day</span></div>' +
    '</div>' +
    '<div class="inv-area-foot">' +
    '<span class="inv-area-detail">' + (bits.length ? escHtml(bits.join(' · ')) : 'nothing recorded') +
    (a.extraShare > 0 ? ' · extra is ' + formatNum(a.extraShare * 100, 0) + '% of its hours' : '') + '</span>' +
    '<span class="inv-area-cost inv-mono" title="All tiers, work done here: day and hour pay, OT, ' +
    'and the extra booked to this area. Not the labour card\u2019s variable-by-area figure.">' +
    formatCurrency(a.cost) + '<span class="inv-area-cost-basis">worked here</span></span>' +
    '</div>' +
    '<div class="inv-area-target"><label class="inv-area-target-label" for="areaTgt-' + a.id + '">Complement</label>' +
    '<input type="number" class="inv-form-input inv-mono inv-area-target-input" id="areaTgt-' + a.id +
    '" data-area-target data-area="' + a.id + '" step="1" min="0" placeholder="—" value="' +
    (target != null ? target : '') + '" aria-label="Expected heads in ' + escHtml(a.label) + '"></div>' +
    '</div>';
}

function setAreaSpan(n) {
  _areaSpan = Math.max(1, parseInt(n, 10) || 1);
  renderAttendance();
}
