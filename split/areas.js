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
      cost: 0, headsPerDay: [], recordedDays: 0, unmanned: [], busiest: null
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
      byId[x.id].headsPerDay.push(headsToday[x.id] || 0);
      if (headsToday[x.id]) byId[x.id].recordedDays++;
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
    return a;
  });

  return { rows: rows, recordedDays: totalRecorded, rangeDays: dates.length };
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
    'median stands as the only reference. Averages are over the <strong>' + stats.recordedDays +
    ' recorded day' + (stats.recordedDays === 1 ? '' : 's') + '</strong> in this range, not over the calendar.</div>';

  rows.forEach(function(a) { html += _areaRow(a); });
  html += '</div>';

  var flex = stats.rows.find(function(a) { return a.id === 'flex'; });
  if (flex && flex.headDays > 0) {
    html += '<div class="inv-stats-caveat"><strong>' + formatNum(flex.headDays, 0) + ' worker-day' +
      (flex.headDays === 1 ? '' : 's') + '</strong> sit on Flex and are counted against no area. ' +
      'A floating hand is a fact about the day rather than a gap to fill by guesswork &mdash; but every one of ' +
      'them is missing from the staffing figures above. Set the area on the day view to move them.</div>';
  }

  return html;
}

/* The extra, examined. This is the card the view was asked for. */
function _areaExtraCard(stats) {
  var totalExtra = stats.rows.reduce(function(s, a) { return s + a.extraHours; }, 0);
  var totalPaid = stats.rows.reduce(function(s, a) { return s + a.paidHours; }, 0);
  var unmannedH = stats.rows.reduce(function(s, a) { return s + a.unmannedHours; }, 0);
  var unmannedDays = stats.rows.reduce(function(s, a) { return s + a.unmanned.length; }, 0);
  var cfg = labourCfg();

  var html = '<div class="inv-card inv-lab-card"><div class="inv-card-header">' +
    '<span class="inv-card-title">The extra, checked</span>' +
    '<span class="inv-lab-total inv-mono">' + formatNum(totalExtra, 1) + ' h</span></div>';

  if (totalExtra === 0) {
    return html + '<div class="inv-empty-state inv-empty-state-sm">No extra hours booked in this range</div></div>';
  }

  var share = (totalPaid + totalExtra) > 0 ? (totalExtra / (totalPaid + totalExtra)) * 100 : 0;
  html += '<div class="inv-lab-split">' +
    '<div class="inv-lab-half inv-lab-fixed"><div class="inv-lab-half-label">Named hours</div>' +
    '<div class="inv-lab-half-value inv-mono">' + formatNum(totalPaid, 1) + ' h</div>' +
    '<div class="inv-lab-half-sub">a person and a day behind each</div></div>' +
    '<div class="inv-lab-half inv-lab-variable"><div class="inv-lab-half-label">Extra hours</div>' +
    '<div class="inv-lab-half-value inv-mono">' + formatNum(totalExtra, 1) + ' h</div>' +
    '<div class="inv-lab-half-sub">' + formatNum(share, 1) + '% of paid hours, nobody named</div></div></div>';

  html += _labRow('Extra at the contract tier', formatCurrency(totalExtra * cfg.extraRate),
    formatNum(totalExtra, 1) + ' h &times; ' + formatCurrency(cfg.extraRate));

  if (unmannedDays > 0) {
    html += _labRow('Booked where nobody was marked', formatNum(unmannedH, 1) + ' h',
      'across ' + unmannedDays + ' area-day' + (unmannedDays === 1 ? '' : 's'));
  }

  // The named dates, because a total invites an argument and a date invites a
  // look at the sheet.
  var flagged = stats.rows.filter(function(a) { return a.unmanned.length > 0; });
  if (flagged.length > 0) {
    html += '<div class="inv-area-flags">';
    flagged.forEach(function(a) {
      a.unmanned.slice(0, 8).forEach(function(u) {
        html += '<div class="inv-area-flag"><span class="inv-area-flag-area">' + escHtml(a.label) + '</span>' +
          '<span class="inv-area-flag-date">' + formatDate(u.iso) + '</span>' +
          '<span class="inv-area-flag-hours inv-mono">' + formatNum(u.hours, 1) + ' h</span></div>';
      });
      if (a.unmanned.length > 8) {
        html += '<div class="inv-area-flag inv-area-flag-more">' + escHtml(a.label) + ' &mdash; ' +
          (a.unmanned.length - 8) + ' more</div>';
      }
    });
    html += '</div>';
    html += '<div class="inv-stats-caveat"><strong>Extra was booked to an area with nobody marked in it.</strong> ' +
      'The two halves of the record disagree, which is worth checking against the sheet &mdash; but it does not say ' +
      'which half is wrong. Hours booked to the wrong area, an area assignment nobody typed, and hours that were ' +
      'never worked all look identical from here. What it does say is where to look, and on which day.</div>';
  } else {
    html += '<div class="inv-stats-note">Every hour of extra in this range was booked to an area that had ' +
      'somebody marked in it. That is the only cross-check the record supports, and it passes.</div>';
  }

  html += '<div class="inv-stats-note"><strong>extra /head-day</strong> in the table below is the area&rsquo;s extra ' +
    'hours divided by its worker-days &mdash; the hours each body standing there would have had to work beyond ' +
    'their own recorded time for the booked extra to be theirs. It is a <strong>plausibility test, not an ' +
    'allocation</strong>: nothing in the wage arithmetic uses it, and the extra stays unattributed there, ' +
    'deliberately. Read it against the hours those same people already logged.</div>';

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
    '<div class="inv-area-stat"><span class="inv-area-stat-value inv-mono">' + formatNum(a.extraHours, 1) + '</span>' +
    '<span class="inv-area-stat-label">extra h</span></div>' +
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
