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
      cost: 0, headsPerDay: [], recordedDays: 0, unmanned: [], busiest: null,
      shortHeads: 0, expectedExtra: 0, idleDays: 0, days: []
    };
  });

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

    STAFF_AREAS.forEach(function(x) {
      var a = byId[x.id];
      var heads = headsToday[x.id] || 0;
      a.headsPerDay.push(heads);
      if (heads) a.recordedDays++;

      // The norm-gap model, which is the rule the floor is actually run to:
      // a hand missing from an area at full tilt is covered by the crew who
      // are there, and eight hours are booked to the area for it.
      //
      // A norm only binds an area that RAN that day. A line nobody stood on is
      // not short by its whole complement — it was not running, so there was no
      // production to cover and nothing to book. The recorded decode says this
      // outright on the day A2 did not plate: "every staffed sub-area at full
      // norm → 0 EXTRA man-hr (no A2 plating, so no A2 norm to fill)". Without
      // this the expected figure counts every idle line as a full shortfall and
      // reads wildly high — a day running one area of five would predict more
      // coverage than the whole plant could absorb.
      var norm = areaTarget(x.id);
      var running = heads > 0;
      var short = (norm != null && running) ? Math.max(0, norm - heads) : 0;
      a.shortHeads += short;
      a.expectedExtra += short * cfg.extraHoursPerHead;
      if (norm != null && !running) a.idleDays++;
      a.days.push({ iso: iso, heads: heads, norm: norm, running: running, short: short, booked: 0 });
    });

    extras.forEach(function(x) {
      var h = x.hours || 0;
      if (h <= 0) return;
      var a = byId[x.area] || byId.flex;
      a.extraHours += h;
      a.cost += h * cfg.extraRate;
      // Extra booked to an area nobody was marked in. Not proof the hours are
      // wrong — the assignment may simply never have been typed — but the two
      // records disagree, and that is worth a name and a date.
      if (!headsToday[a.id]) a.unmanned.push({ iso: iso, hours: h });
      var today = a.days[a.days.length - 1];
      if (today && today.iso === iso) today.booked += h;
      if (!a.busiest || h > a.busiest.hours) a.busiest = { iso: iso, hours: h, heads: headsToday[a.id] || 0 };
    });
  });

  var rows = STAFF_AREAS.map(function(x) {
    var a = byId[x.id];
    a.avgHeads = totalRecorded > 0 ? a.headDays / totalRecorded : 0;
    a.medianHeads = _median(a.headsPerDay);
    a.target = areaTarget(a.id);
    a.variance = a.target != null ? a.avgHeads - a.target : null;
    a.paidHours = a.hours + a.otHours;
    // The one diagnostic on the extra. It is NOT an allocation — the app never
    // spreads extra across the men present, and this number is not written
    // anywhere near a wage. It is the plausibility test: how many hours each
    // body standing in this area would have had to work beyond their own
    // recorded time for the booked extra to be theirs.
    a.impliedPerHead = a.headDays > 0 ? a.extraHours / a.headDays : null;
    a.extraShare = (a.paidHours + a.extraHours) > 0 ? a.extraHours / (a.paidHours + a.extraHours) : 0;
    a.cost = gstRound(a.cost);
    a.unmannedHours = a.unmanned.reduce(function(s, u) { return s + u.hours; }, 0);
    a.expectedExtra = gstRound(a.expectedExtra);
    a.extraGap = a.extraHours - a.expectedExtra;
    // Three kinds of disagreement, kept apart because they mean different
    // things. Booked while the area was at or above its complement is the one
    // the rule forbids outright. Short with nothing booked is the opposite
    // omission. A mismatch on a day that was short both ways is a quantity
    // question, not a principle one.
    a.bookedAtNorm = a.days.filter(function(d) { return d.norm != null && d.short === 0 && d.booked > 0; });
    a.shortUnbooked = a.days.filter(function(d) { return d.running && d.short > 0 && d.booked === 0; });
    a.mismatched = a.days.filter(function(d) {
      return d.short > 0 && d.booked > 0 && Math.abs(d.booked - d.short * cfg.extraHoursPerHead) > 0.001;
    });
    return a;
  });

  var withNorm = rows.filter(function(a) { return a.target != null; });
  return {
    rows: rows,
    recordedDays: totalRecorded,
    rangeDays: dates.length,
    normed: withNorm.length,
    expectedExtra: gstRound(withNorm.reduce(function(s, a) { return s + a.expectedExtra; }, 0)),
    bookedExtra: gstRound(rows.reduce(function(s, a) { return s + a.extraHours; }, 0)),
    bookedInNormed: gstRound(withNorm.reduce(function(s, a) { return s + a.extraHours; }, 0)),
    absorption: _absorption(dates, roster)
  };
}

/* Pro-rata absorption, per worker.

   The ruling that settles what the extra is also settles who carries it: the
   coverage is absorbed collectively by the short area's present crew, pro-rata,
   which makes the hours attributable from the relay format with no new logging.

   It is computed here and it is deliberately **not** money. Payment is pooled —
   one line on the slip, paid out on the floor — so spreading it into the wage
   arithmetic would invent a per-worker cost the payout never had. What it is
   good for is the thing it was asked for: availability. A worker whose area is
   short around them, week after week, is absorbing the shortfall. */
function _absorption(dates, roster) {
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
      var crew = present[x.area] || [];
      if (crew.length === 0) return;      // nobody to absorb it; the flag covers that
      var each = h / crew.length;
      crew.forEach(function(w) {
        var e = by[w.id] || (by[w.id] = { id: w.id, name: w.name, hours: 0, days: 0 });
        e.hours += each;
        e.days++;
      });
    });
  });
  return Object.keys(by).map(function(k) { return by[k]; })
    .sort(function(a, b) { return b.hours - a.hours; });
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

   The rule is `8 × (norm − heads)` per sub-area, per day: a hand missing from
   an area running at full tilt is covered by the crew who are there, and eight
   hours are booked to the area for it. So the extra is not an unexplained
   line — it is a *prediction*, and a prediction can be checked against what was
   actually booked.

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
  var unmannedH = stats.rows.reduce(function(s, a) { return s + a.unmannedHours; }, 0);
  var unmannedDays = stats.rows.reduce(function(s, a) { return s + a.unmanned.length; }, 0);

  var html = '<div class="inv-card inv-lab-card"><div class="inv-card-header">' +
    '<span class="inv-card-title">The extra, checked</span>' +
    '<span class="inv-lab-total inv-mono">' + formatNum(totalExtra, 1) + ' h</span></div>';

  if (totalExtra === 0 && stats.expectedExtra === 0) {
    // Nothing to reconcile — but say WHY nothing was expected, because on a
    // day with lines standing idle that is an assumption doing real work.
    var idleQuiet = stats.rows.reduce(function(s2, a) { return s2 + a.idleDays; }, 0);
    return html + '<div class="inv-empty-state inv-empty-state-sm">No extra hours booked, and every area ' +
      'that ran was at its complement' +
      (idleQuiet > 0 ? ' &mdash; ' + idleQuiet + ' area-day' + (idleQuiet === 1 ? '' : 's') +
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
  stats.rows.forEach(function(a) {
    a.bookedAtNorm.forEach(function(d) { atNorm.push({ a: a, d: d }); });
    a.shortUnbooked.forEach(function(d) { unbooked.push({ a: a, d: d }); });
    a.mismatched.forEach(function(d) { mism.push({ a: a, d: d }); });
  });

  if (atNorm.length > 0) {
    html += _labRow('Booked at or above complement', atNorm.length + ' area-day' + (atNorm.length === 1 ? '' : 's'),
      'the rule predicts nothing here');
    html += _areaFlagList(atNorm, function(f) {
      return formatNum(f.d.booked, 1) + ' h on ' + f.d.heads + '/' + f.d.norm;
    }, 'inv-area-flag');
  }
  if (unmannedDays > 0) {
    html += _labRow('Booked where nobody was marked', formatNum(unmannedH, 1) + ' h',
      'across ' + unmannedDays + ' area-day' + (unmannedDays === 1 ? '' : 's'));
  }
  if (mism.length > 0) {
    html += _labRow('Booked, but not the predicted amount', mism.length + ' area-day' + (mism.length === 1 ? '' : 's'),
      'short, and covered by a different number of hours');
    html += _areaFlagList(mism, function(f) {
      return formatNum(f.d.booked, 1) + ' h against ' + formatNum(f.d.short * cfg.extraHoursPerHead, 1) + ' h';
    }, 'inv-area-flag inv-area-flag-warn');
  }
  if (unbooked.length > 0) {
    html += _labRow('Short, nothing booked', unbooked.length + ' area-day' + (unbooked.length === 1 ? '' : 's'),
      'a light day, or a tag nobody wrote');
  }
  var idle = stats.rows.reduce(function(s2, a) { return s2 + a.idleDays; }, 0);
  if (idle > 0) {
    html += _labRow('Not running, not counted', idle + ' area-day' + (idle === 1 ? '' : 's'),
      'a line nobody stood on is idle, not short of its whole complement');
  }

  if (atNorm.length === 0 && unmannedDays === 0 && mism.length === 0 && stats.normed > 0) {
    html += '<div class="inv-stats-note">Every booking in this range sits on an area that was short by ' +
      'exactly the hands the hours pay for. That is the whole cross-check the record supports, and it passes.</div>';
  } else if (atNorm.length > 0 || unmannedDays > 0) {
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
  var total = rows.reduce(function(s, r) { return s + r.hours; }, 0);
  var html = '<div class="inv-card"><div class="inv-card-header">' +
    '<span class="inv-card-title">Coverage absorbed, pro-rata</span>' +
    '<span class="inv-lab-total inv-mono">' + formatNum(total, 1) + ' h</span></div>' +
    '<div class="inv-stats-note">The extra is booked to an area, and the area&rsquo;s present crew absorb it ' +
    'between them &mdash; so it is attributable to people even though it is paid as one pooled line. ' +
    'This is an <strong>availability measure, not a wage</strong>: nothing here is added to anyone&rsquo;s pay, ' +
    'and the labour card still counts the extra exactly once, unattributed.</div>';
  rows.slice(0, 12).forEach(function(r) {
    html += '<div class="inv-stats-row"><span class="inv-stats-name">' + escHtml(r.name) + '</span>' +
      '<span class="inv-stats-val">' + formatNum(r.hours, 1) + ' h' +
      '<span class="inv-area-absorb-days"> · ' + r.days + ' day' + (r.days === 1 ? '' : 's') + '</span></span></div>';
  });
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
    (a.target != null ? '<span class="inv-area-stat-vs">/' + formatNum(a.expectedExtra, 0) + '</span>' : '') + '</span>' +
    '<span class="inv-area-stat-label">' + (a.target != null ? 'extra h booked/exp' : 'extra h') + '</span></div>' +
    '<div class="inv-area-stat"><span class="inv-area-stat-value inv-mono">' +
    (a.impliedPerHead != null ? formatNum(a.impliedPerHead, 1) : '&mdash;') + '</span>' +
    '<span class="inv-area-stat-label">extra /head-day</span></div>' +
    '</div>' +
    '<div class="inv-area-foot">' +
    '<span class="inv-area-detail">' + (bits.length ? escHtml(bits.join(' · ')) : 'nothing recorded') +
    (a.extraShare > 0 ? ' · extra is ' + formatNum(a.extraShare * 100, 0) + '% of its hours' : '') + '</span>' +
    '<span class="inv-area-cost inv-mono">' + formatCurrency(a.cost) + '</span>' +
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
