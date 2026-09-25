/* ===== LABOUR COST =====

   Labour was one number: ₹3.55/kg, 42% of an ₹8.55 cost, entered by hand and
   never checked against anything. Two questions were left open by the last
   two handoffs — how staff is allocated, and what "the extra" stands for —
   and both are the same question in different clothes: which of this bill is
   fixed and which of it scales with tonnage. Nothing could answer it because
   nothing measured it.

   This does the arithmetic from the attendance store:

     permanent   monthly salary, accrued by calendar day. Fixed. It is owed
                 whether or not anyone typed the day, so it is prorated across
                 the period rather than counted per recorded day.
     contract    days worked × day rate, half a day counting half. Variable.
     rest credit one further paid day for a contract worker whose week is full
                 — the ratified rule, gated rather than automatic.
     OT          named overtime hours × hour rate × multiplier (1.1).
     extra       area-booked hours nobody is named for, at the contract tier.

   Two figures are then kept apart everywhere they appear. **Fixed** is the
   permanent payroll: it does not move when tonnage moves, which is exactly why
   the SSS Mehta question turns on it — at fixed labour that account still
   contributes ₹0.53/kg, at volume-scaling labour it loses ₹1.64/kg. **Variable**
   is contract, OT and extra together. Reporting one labour number would answer
   that question by accident, in whichever direction the blend happened to fall.

   And what is not known is never averaged away. A day nobody typed is not a day
   nobody worked; permanent salary still accrues over it and contract wages do
   not, so a period recorded in part reads *low*, never neutral. The card states
   its coverage and withholds ₹/kg below 90% rather than printing a figure that
   flatters the plant. */

/* The cap on monthly-tier OT binds from 1 Sep 2026 (owner, 25 Sep 2026: "Cap
   applies from September"). July and August were paid at rate ÷ 8 × 1.1
   uncapped, and a model that capped them would disagree with the slips. */
var LABOUR_OT_CAP_FROM = '2026-09-01';

/* Paid holidays. BM, 10 Sep 2026: "National holiday is always paid". The three
   national holidays recur (MM-DD); a one-off is written as a full date. A
   festival is NOT one of them: 28 Aug (Raksha Bandhan) was ruled an absence. */
var LABOUR_HOLIDAYS = ['01-26', '08-15', '10-02'];

function labourIsHoliday(iso, cfg) {
  var h = (cfg || labourCfg()).holidays || [];
  return h.indexOf(iso) >= 0 || h.indexOf(iso.slice(5)) >= 0;
}

function labourDaysInMonth(iso) {
  var d = attParseIso(iso.slice(0, 8) + '01');
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function labourCfg() {
  var c = S.labour || {};
  return {
    otMult: c.otMult != null ? c.otMult : 1.1,
    otCap: c.otCap != null ? c.otCap : 68.2,
    otCapFrom: c.otCapFrom != null ? c.otCapFrom : LABOUR_OT_CAP_FROM,
    holidays: Array.isArray(c.holidays) ? c.holidays : LABOUR_HOLIDAYS.slice(),
    restCreditMinDays: c.restCreditMinDays != null ? c.restCreditMinDays : 6,
    extraRate: c.extraRate || 0,
    modelPerKg: c.modelPerKg || 0,
    extraHoursPerHead: c.extraHoursPerHead != null ? c.extraHoursPerHead : 8,
    gateFull: c.gateFull != null ? c.gateFull : 0.9,
    gateHalf: c.gateHalf != null ? c.gateHalf : 0.8
  };
}

/* The three-layer rest-day gate on the monthly tier.

   Rest days are paid, but the entitlement is scaled by attendance: at or above
   the full threshold the whole of it, above the half threshold half of it, and
   below that none. It is the one place a monthly worker's pay moves with their
   own attendance, which is why the tier is called monthly and not fixed.

   Exact over a calendar month, which is the period it was written for. Over a
   shorter range it is an approximation of a monthly rule and the card says so —
   a week with one Sunday gets that Sunday judged on that week's attendance. */
function restGate(attendance, cfg) {
  if (attendance >= cfg.gateFull) return 1;
  if (attendance >= cfg.gateHalf) return 0.5;
  return 0;
}

/* Is this area on the plant floor? An unknown area is treated as floor: the
   plating cost reading slightly high is the safe direction of an unknown. */
function _areaIsFloor(areaId) {
  var a = STAFF_AREAS.find(function(x) { return x.id === areaId; });
  return a ? a.floor : true;
}

/* The whole model, over an inclusive ISO date range. Pure: reads S, writes
   nothing, and every figure it returns is traceable to a recorded mark. */
function labourForRange(fromIso, toIso) {
  var cfg = labourCfg();
  var dates = attDatesInRange(fromIso, toIso);
  var roster = (S.staff || []).filter(function(w) { return w.active !== false; });

  var out = {
    from: fromIso, to: toIso, rangeDays: dates.length,
    monthlyDays: 0, monthlyDaysWorked: 0,
    rest: 0, restDaysCredited: 0, restDaysInRange: 0,
    pool: 0, poolHours: 0,
    daily: 0, dailyDays: 0, dailyRest: 0,
    ot: 0, otHours: 0, extra: 0, extraHours: 0,
    floorCost: 0,
    daysRecorded: 0, workingDays: 0, sundaysRecorded: 0,
    rosterSize: roster.length, ratelessWorkers: [], byArea: {}, byWorker: {}
  };

  // What each worker earned in the range, on the same arithmetic as the totals:
  // the Pay view reads it to say what is due to whom. EXTRA is not in it — the
  // pool is disbursed by the supervisor on the floor, one line on the slip.
  function bumpWorker(w, k, v, days, hours, otHours) {
    var b = out.byWorker[w.id] || (out.byWorker[w.id] = { id: w.id, name: w.name, comp: w.comp,
      days: 0, hours: 0, otHours: 0, base: 0, ot: 0, rest: 0, restDays: 0, total: 0 });
    b[k] += v; b.total += v;
    b.days += days || 0; b.hours += hours || 0; b.otHours += otHours || 0;
    return b;
  }

  // Variable labour, by the area it was worked in. The monthly tier's day pay
  // is deliberately absent: see _labAreaRows.
  function bumpArea(areaId, cost, days, hours) {
    var a = out.byArea[areaId] || (out.byArea[areaId] = { cost: 0, days: 0, hours: 0 });
    a.cost += cost; a.days += days; a.hours += hours;
  }
  function bumpFloor(w, areaId, cost) {
    if (w.onFloor !== false && _areaIsFloor(areaId)) out.floorCost += cost;
  }

  // Per-worker tallies, because both gates below are judged over the range
  // rather than per day: the monthly tier's rest credit needs the attendance
  // percentage, the daily tier's needs a week's day count.
  var weekDaysWorked = {};
  // The monthly tier is judged per CALENDAR MONTH, because that is the period
  // its rule was written for: each month the range touches gets its own count
  // of Sundays, paid holidays and working days, and each worker their own days.
  var months = {};
  function monthSeg(iso) {
    var k = iso.slice(0, 7);
    if (months[k]) return months[k];
    var paid = payrollPaidFor(k), paidIds = {};
    if (paid) paid.rows.forEach(function(r) { var pw = payrollWorker(r); if (pw) paidIds[pw.id] = true; });
    return (months[k] = { key: k, sundays: 0, holidays: 0, working: 0, worked: {}, paid: paid, paidIds: paidIds });
  }
  out.paidMonths = [];

  dates.forEach(function(iso) {
    var dow = attParseIso(iso).getDay();
    if (dow === 0) out.restDaysInRange++; else out.workingDays++;
    var seg = monthSeg(iso);
    var holiday = dow !== 0 && labourIsHoliday(iso, cfg);
    if (dow === 0) seg.sundays++; else if (holiday) seg.holidays++; else seg.working++;

    var rec = (S.attendance || {})[iso];
    if (!rec) return;
    var marks = rec.marks || {};
    var marked = Object.keys(marks).length;
    if (marked === 0 && (rec.extra || []).length === 0) return;
    if (marked > 0) {
      if (dow === 0) out.sundaysRecorded++; else out.daysRecorded++;
    }

    var wk = attWeekStartOf(iso);
    roster.forEach(function(w) {
      var m = marks[w.id];
      if (!m || !m.st) return;
      var dayVal = ATT_DAY_VALUE[m.st] || 0;
      var areaId = m.area || w.area || 'flex';

      if (w.comp === 'hourly') {
        // No day rate exists for this tier and no multiplier applies: the
        // fourteenth hour is paid exactly like the first.
        var hrs = m.hours || 0;
        if (hrs > 0) {
          var pay = hrs * (w.hourRate || 0);
          out.pool += pay;
          out.poolHours += hrs;
          bumpWorker(w, 'base', pay, 0, hrs, 0);
          bumpArea(areaId, pay, 0, hrs);
          bumpFloor(w, areaId, pay);
          if (!(w.hourRate > 0) && out.ratelessWorkers.indexOf(w.name) < 0) out.ratelessWorkers.push(w.name);
        }
        return;
      }

      // A hand whose month is on record as paid is read from that record, not
      // re-modelled from the marks: see payrollPaidFor. A monthly hand the
      // record does not name (paid on a voucher of their own) is still modelled.
      if (w.comp === 'monthly' && seg.paidIds[w.id]) return;

      // BM's monthly model (10 Sep 2026). A weekday worked is a day and counts
      // toward the attendance the gate is judged on. A Sunday or a paid holiday
      // worked is one further day on top of its credit, and its hours are that
      // day — never OT as well, which would pay them twice. On a contracted
      // monthly wage the Sundays are inside the wage (BM, 14 Sep: "Sunday is
      // inside the 9000"), so a Sunday worked adds nothing.
      var offDay = w.comp === 'monthly' && (dow === 0 || holiday);
      var fixedWage = w.comp === 'monthly' && w.monthWage > 0;
      var wage = offDay && fixedWage ? 0 : dayVal * workerDayRate(w, iso);
      bumpWorker(w, 'base', wage, dayVal, m.hours || 0, 0);
      if (w.comp === 'monthly') {
        out.monthlyDays += wage;
        out.monthlyDaysWorked += dayVal;
        if (!offDay) seg.worked[w.id] = (seg.worked[w.id] || 0) + dayVal;
      } else {
        out.daily += wage;
        out.dailyDays += dayVal;
        weekDaysWorked[w.id + '|' + wk] = (weekDaysWorked[w.id + '|' + wk] || 0) + dayVal;
        bumpArea(areaId, wage, dayVal, 0);
      }
      bumpFloor(w, areaId, wage);

      var oth = offDay ? 0 : (m.ot || 0);
      if (oth > 0) {
        var rate = workerOtRate(w, iso);
        var otPay = oth * workerOtHourPay(w, cfg, iso);
        out.otHours += oth;
        out.ot += otPay;
        bumpWorker(w, 'ot', otPay, 0, 0, oth);
        bumpArea(areaId, otPay, 0, oth);
        bumpFloor(w, areaId, otPay);
        if (!(rate > 0) && out.ratelessWorkers.indexOf(w.name) < 0) out.ratelessWorkers.push(w.name);
      }
    });

    (rec.extra || []).forEach(function(x) {
      var h = x.hours || 0;
      if (h <= 0) return;
      var pay = h * cfg.extraRate;
      out.extraHours += h;
      out.extra += pay;
      if (_areaIsFloor(x.area)) out.floorCost += pay;
      bumpArea(x.area || 'flex', pay, 0, h);
    });
  });

  // Monthly tier rest credit, per calendar month: the month's Sundays scaled by
  // each worker's attendance through the gate, plus every paid holiday in full
  // (BM: "National holiday is always paid"). Attendance is weekdays worked over
  // the month's working days — Sundays and paid holidays out of both sides. A
  // contracted monthly wage is not gated (BM, 14 Sep: "His sundays are not gate
  // sensitive"). A worker with no day recorded in the month is credited
  // nothing: a month nobody typed is not a month of holidays.
  Object.keys(months).forEach(function(k) {
    var seg = months[k];
    var anyIso = k + '-01';
    roster.forEach(function(w) {
      if (w.comp !== 'monthly' || seg.paidIds[w.id]) return;
      var worked = seg.worked[w.id] || 0;
      if (!(worked > 0)) return;
      var att = seg.working > 0 ? worked / seg.working : 0;
      var g = w.monthWage > 0 ? 1 : restGate(att, cfg);
      var credited = seg.sundays * g + seg.holidays;
      if (!(credited > 0)) return;
      var pay = credited * workerDayRate(w, anyIso);
      out.rest += pay;
      out.restDaysCredited += credited;
      bumpWorker(w, 'rest', pay, 0, 0, 0).restDays += credited;
      if (w.onFloor !== false) out.floorCost += pay;
    });
  });

  // Months whose monthly payroll is on record as paid: the record replaces the
  // model, pro-rata to the share of the month this range covers.
  Object.keys(months).forEach(function(k) {
    var seg = months[k];
    if (!seg.paid) return;
    var share = (seg.sundays + seg.holidays + seg.working) / labourDaysInMonth(k + '-01');
    out.paidMonths.push({ month: k, share: share, gross: seg.paid.gross, source: seg.paid.source || '' });
    seg.paid.rows.forEach(function(r) {
      var w = payrollWorker(r) || { id: 'paid:' + r.name, name: r.name, comp: 'monthly', onFloor: true };
      var dayPay = (Number(r.dayPay) || 0) * share, ot = (Number(r.ot) || 0) * share;
      out.monthlyDays += dayPay;
      out.monthlyDaysWorked += (Number(r.worked) || 0) * share;
      out.ot += ot;
      out.otHours += (Number(r.otHours) || 0) * share;
      var b = bumpWorker(w, 'base', dayPay, (Number(r.worked) || 0) * share, 0, 0);
      if (ot) bumpWorker(w, 'ot', ot, 0, 0, (Number(r.otHours) || 0) * share);
      b.asPaid = true;
      if (ot) bumpArea(w.area || 'flex', ot, 0, (Number(r.otHours) || 0) * share);
      if (w.onFloor !== false) out.floorCost += dayPay + ot;
    });
  });

  // Daily tier rest credit: one further paid day for a week that reached the
  // gate. Measured on days inside this range, so a range cutting a week in half
  // under-credits that week — stated on the card rather than papered over.
  if (cfg.restCreditMinDays > 0) {
    Object.keys(weekDaysWorked).forEach(function(key) {
      if (weekDaysWorked[key] < cfg.restCreditMinDays) return;
      var w = staffById(parseInt(key.split('|')[0], 10));
      if (!w) return;
      var pay = (w.dayRate || 0);
      out.dailyRest += pay;
      bumpWorker(w, 'rest', pay, 0, 0, 0).restDays += 1;
      if (w.onFloor !== false) out.floorCost += pay;
      bumpArea(w.area || 'flex', pay, 1, 0);
    });
  }

  ['monthlyDays', 'rest', 'pool', 'daily', 'dailyRest', 'ot', 'extra', 'floorCost'].forEach(function(k) {
    out[k] = gstRound(out[k]);
  });
  Object.keys(out.byArea).forEach(function(k) { out.byArea[k].cost = gstRound(out.byArea[k].cost); });
  Object.keys(out.byWorker).forEach(function(k) {
    var b = out.byWorker[k];
    // The total is rounded ONCE, from the unrounded parts: a contracted wage's
    // 28 days × ₹290.3226 is ₹8,129.03 on the slip, and rounding day pay and
    // rest credit separately first would make it ₹8,129.04.
    b.total = gstRound(b.base + b.ot + b.rest);
    ['base', 'ot', 'rest'].forEach(function(f) { b[f] = gstRound(b[f]); });
  });

  // Fixed is the standing crew — the monthly tier, days and gated rest days
  // together. It moves with their attendance but not with tonnage, which is the
  // distinction the split exists to draw.
  out.fixed = gstRound(out.monthlyDays + out.rest);
  out.variable = gstRound(out.pool + out.daily + out.dailyRest + out.ot + out.extra);
  out.total = gstRound(out.fixed + out.variable);
  out.floor = out.floorCost;
  out.offFloor = gstRound(out.total - out.floor);
  out.coverage = out.workingDays > 0 ? Math.min(1, out.daysRecorded / out.workingDays) : 0;
  return out;
}

/* The one place that decides whether a ₹/kg may be printed at all.

   Two gates, and they fail for different reasons. Coverage below 90% means the
   numerator is short — the same 90% bar the client realisation table already
   uses, for the same reason: a figure drawn from a fraction of the book is not
   the same kind of number as one drawn from all of it.

   The day floor is about sample size, not about the lag. The lag is real at
   every length — tonnage here is *billed* tonnage and material is plated weeks
   before it is invoiced — so it cannot be gated away, only stated, and it is
   stated below wherever the range is short enough for it to dominate. Under a
   fortnight there is not enough of either side to divide. */
var LABOUR_PERKG_MIN_DAYS = 14;
var LABOUR_PERKG_LAG_DAYS = 60;
var LABOUR_PERKG_MIN_COVERAGE = 0.9;

function labourPerKgVerdict(lab, tonnageKg) {
  if (lab.total <= 0) return { ok: false, why: 'no labour recorded in this period' };
  if (!(tonnageKg > 0)) return { ok: false, why: 'no weighed tonnage in this period' };
  if (lab.rangeDays < LABOUR_PERKG_MIN_DAYS) {
    return { ok: false, why: 'a range under a fortnight is too short to divide &mdash; ' +
      'billing lags plating, so these invoices are not this period\u2019s output' };
  }
  if (lab.coverage < LABOUR_PERKG_MIN_COVERAGE) {
    return { ok: false, why: 'only ' + lab.daysRecorded + ' of ' + lab.workingDays +
      ' working days are recorded, so the contract side of the bill is short' };
  }
  return { ok: true, perKg: lab.total / tonnageKg };
}

function _labRow(label, value, sub) {
  return '<div class="inv-lab-row"><span class="inv-lab-label">' + label +
    (sub ? '<span class="inv-lab-sub">' + sub + '</span>' : '') + '</span>' +
    '<span class="inv-lab-value inv-mono">' + value + '</span></div>';
}

/* Where the variable hours went.

   This is the second half of the question the handoffs left open — not just how
   much labour, but how it is allocated. It ranks by cost rather than by days,
   because an area that pulls the overtime is a more expensive area than one
   that merely has bodies in it, and days alone would hide that.

   Drawn with `chartRankedBars` rather than a bar of its own: the app already
   has one ranked-bar shape and Top Items is the view a reader arrives from.

   Permanent payroll is not in here and the caption says so. A monthly salary
   cannot be attributed to a day, let alone to the area that day was worked in;
   splitting it by home area would print an allocation that nobody measured. */
function _labAreaRows(lab) {
  var keys = Object.keys(lab.byArea).filter(function(k) { return lab.byArea[k].cost > 0; });
  if (keys.length === 0) return '';
  keys.sort(function(a, b) { return lab.byArea[b].cost - lab.byArea[a].cost; });
  var total = keys.reduce(function(sum, k) { return sum + lab.byArea[k].cost; }, 0);

  var rows = keys.map(function(k) {
    var a = lab.byArea[k];
    var bits = [];
    if (a.days > 0) bits.push(formatNum(a.days, 1) + ' day' + (a.days === 1 ? '' : 's'));
    if (a.hours > 0) bits.push(formatNum(a.hours, 1) + ' h');
    if (total > 0) bits.push(formatNum((a.cost / total) * 100, 0) + '% of variable');
    return {
      label: areaLabel(k),
      value: a.cost,
      display: formatCurrency(a.cost),
      sub: bits.join(' \u00B7 '),
      // Off-floor areas are shaded apart: their wage is real and in the bill,
      // but it is overhead rather than plating cost, and a reader scanning for
      // where the plant's money goes should not have to remember which is which.
      tone: _areaIsFloor(k) ? '' : 'danger'
    };
  });

  return '<div class="inv-lab-area-title">Variable labour by area</div>' +
    chartRankedBars(rows, { unit: 'money' }) +
    '<div class="inv-stats-note">Hourly pool, daily tier, overtime and extra hours, placed by the area each ' +
    'was worked in. <strong>The monthly tier&rsquo;s day pay and rest days are not in here</strong> &mdash; that ' +
    'crew is the standing one and its cost does not follow the area it happened to stand in, so splitting it ' +
    'would print an allocation nobody measured. Their overtime <em>is</em> in here, because an overtime hour ' +
    'was worked somewhere specific and was paid for being worked.</div>';
}

/* The breakdown card. Used by the Attendance tab for a day or a week (cash
   only) and by Stats for the period (cash and ₹/kg). */
function renderLabourCard(fromIso, toIso, title, tonnage, extraClass) {
  var lab = labourForRange(fromIso, toIso);
  var cfg = labourCfg();
  var html = '<div class="inv-card inv-lab-card' + (extraClass ? ' ' + extraClass : '') +
    '"><div class="inv-card-header">' +
    '<span class="inv-card-title">' + escHtml(title || 'Labour') + '</span>' +
    '<span class="inv-lab-total inv-mono">' + formatCurrency(lab.total) + '</span></div>';

  if (lab.rosterSize === 0) {
    return html + '<div class="inv-empty-state inv-empty-state-sm">Nobody on the roster</div></div>';
  }

  html += '<div class="inv-lab-split">' +
    '<div class="inv-lab-half inv-lab-fixed"><div class="inv-lab-half-label">Fixed</div>' +
    '<div class="inv-lab-half-value inv-mono">' + formatCurrency(lab.fixed) + '</div>' +
    '<div class="inv-lab-half-sub">monthly tier, days and rest</div></div>' +
    '<div class="inv-lab-half inv-lab-variable"><div class="inv-lab-half-label">Variable</div>' +
    '<div class="inv-lab-half-value inv-mono">' + formatCurrency(lab.variable) + '</div>' +
    '<div class="inv-lab-half-sub">hourly, daily, OT and extra</div></div></div>';

  // One row per tier that actually has something in it. A tier nobody is on
  // renders nothing rather than a zero: a zero reads as a measurement.
  if (lab.monthlyDays > 0 || lab.monthlyDaysWorked > 0) {
    html += _labRow('Monthly tier &mdash; days', formatCurrency(lab.monthlyDays),
      formatNum(lab.monthlyDaysWorked, 1) + ' day' + (lab.monthlyDaysWorked === 1 ? '' : 's') + ' worked at day rate' +
      ((lab.paidMonths || []).length ? ' &middot; ' + lab.paidMonths.map(function(m) { return escHtml(_monthLabel(m.month)); }).join(', ') +
        ' as paid, from the slip' : ''));
  }
  if (lab.rest > 0 || lab.restDaysInRange > 0) {
    html += _labRow('Rest days credited', formatCurrency(lab.rest),
      formatNum(lab.restDaysCredited, 1) + ' days: Sundays gated at ' +
      Math.round(cfg.gateFull * 100) + '% / ' + Math.round(cfg.gateHalf * 100) + '% per month, paid holidays in full');
  }
  if (lab.pool > 0 || lab.poolHours > 0) {
    html += _labRow('Hourly pool', formatCurrency(lab.pool),
      formatNum(lab.poolHours, 1) + ' h, flat rate &mdash; no multiplier');
  }
  if (lab.daily > 0 || lab.dailyDays > 0) {
    html += _labRow('Daily tier', formatCurrency(lab.daily),
      formatNum(lab.dailyDays, 1) + ' day' + (lab.dailyDays === 1 ? '' : 's') + ' worked');
  }
  if (lab.dailyRest > 0) {
    html += _labRow('Daily rest credit', formatCurrency(lab.dailyRest),
      'full weeks at ' + cfg.restCreditMinDays + '+ days');
  }
  html += _labRow('Overtime (named)', formatCurrency(lab.ot),
    formatNum(lab.otHours, 1) + ' h at &times;' + formatNum(cfg.otMult, 2) + ', monthly tier at day rate &divide; 8, capped at ' + formatCurrency(cfg.otCap) + '/h' +
    (cfg.otCapFrom ? ' from ' + escHtml(formatDate(cfg.otCapFrom)) : ''));
  html += _labRow('Extra (unattributed)', formatCurrency(lab.extra), formatNum(lab.extraHours, 1) + ' h at ' + formatCurrency(cfg.extraRate) + '/h');
  html += _labRow('On the floor', formatCurrency(lab.floor),
    lab.offFloor > 0 ? formatCurrency(lab.offFloor) + ' off floor (gate, office)' : 'all of it');

  if (tonnage) {
    var verdict = labourPerKgVerdict(lab, tonnage.kg);
    if (verdict.ok) {
      var gap = cfg.modelPerKg > 0 ? verdict.perKg - cfg.modelPerKg : null;
      html += '<div class="inv-lab-perkg"><span class="inv-lab-perkg-value inv-mono">' +
        formatCurrency(verdict.perKg) + '/kg</span><span class="inv-lab-perkg-label">measured labour</span>' +
        (gap != null
          ? '<span class="inv-lab-perkg-model">against ' + formatCurrency(cfg.modelPerKg) +
            '/kg modelled &mdash; ' + (Math.abs(gap) < 0.005 ? 'the same figure'
              : formatCurrency(Math.abs(gap)) + '/kg ' + (gap > 0 ? 'higher' : 'lower')) + '</span>'
          : '') +
        '</div>';
      if (lab.rangeDays < LABOUR_PERKG_LAG_DAYS) {
        html += '<div class="inv-stats-caveat">Read that as an order of magnitude, not a rate. The labour is ' +
          'this period&rsquo;s; the tonnage under it is what was <strong>billed</strong> in this period, and ' +
          'material is plated weeks before it is invoiced. Over a quarter or a year the two line up; over ' +
          'a month they measure partly different work.</div>';
      }
      if (tonnage.coverage < 0.999) {
        html += '<div class="inv-stats-caveat">That ₹/kg divides the whole labour bill by tonnage covering <strong>' +
          Math.round(tonnage.coverage * 100) + '% of revenue</strong>. The unweighed lines are the piece-billed work, ' +
          'so the real denominator is larger and the true labour cost per kilo is <strong>lower</strong> than this. ' +
          'Items Master &rarr; Derive weights from rates closes it.</div>';
      }
    } else {
      html += '<div class="inv-lab-perkg inv-lab-perkg-none"><span class="inv-lab-perkg-value">&mdash;</span>' +
        '<span class="inv-lab-perkg-label">₹/kg withheld</span>' +
        '<span class="inv-lab-perkg-model">' + verdict.why + '</span></div>';
    }
  }

  // Coverage, always, in the same place whether it is complete or not. A card
  // that only mentions its gaps when it has them teaches the reader to stop
  // looking for the line.
  var covPct = Math.round(lab.coverage * 100);
  html += '<div class="inv-stats-note">Recorded <strong>' + lab.daysRecorded + ' of ' + lab.workingDays +
    ' working days</strong> in this range (' + covPct + '%)' +
    (lab.sundaysRecorded > 0 ? ', plus ' + lab.sundaysRecorded + ' Sunday' + (lab.sundaysRecorded === 1 ? '' : 's') : '') + '. ' +
    (lab.coverage < 0.999
      ? 'Every tier is paid for days and hours actually recorded, so an incomplete range reads <strong>low</strong>, ' +
        'never neutral &mdash; and the monthly tier reads low <em>twice</em>, because a day nobody typed also ' +
        'depresses the attendance its rest-day gate is judged on.'
      : 'Every working day in the range is on file.') +
    (lab.restDaysInRange > 0 && lab.rangeDays < 28
      ? ' The rest-day gate is a monthly rule; over a range shorter than a month it judges each rest day on this range&rsquo;s attendance alone.'
      : '') +
    (lab.dailyRest > 0 && lab.rangeDays > 7 ? ' Daily rest credit is gated on days inside this range, so a range cutting a week in half under-credits that week.' : '') +
    '</div>';

  if (lab.ratelessWorkers.length > 0) {
    html += '<div class="inv-stats-caveat">Hours are recorded for <strong>' +
      escHtml(lab.ratelessWorkers.join(', ')) + '</strong> with no rate to price them at, so those hours ' +
      'are counted in the totals above and paid at zero. Set the rate in Roster to bring them into the bill.</div>';
  }

  // The allocation answer sits last: it is a breakdown of a figure the reader
  // has already been given, and in Stats the ₹/kg is the headline that must not
  // be pushed below a chart.
  html += _labAreaRows(lab);

  if (lab.extra > 0) {
    var share = lab.total > 0 ? (lab.extra / lab.total) * 100 : 0;
    html += '<div class="inv-stats-note"><strong>' + formatNum(share, 1) + '% of this bill</strong> is extra hours ' +
      'booked to an area rather than to a person. That is what &ldquo;the extra&rdquo; on the daily sheet is: ' +
      'real paid contract hours with no name against them. They are not spread across the men present, because ' +
      'a per-worker cost invented that way would answer the fixed-versus-variable question by accident.</div>';
  }

  return html + '</div>';
}

/* ===== STATS INTEGRATION =====
   Converts a Stats period into the ISO range the labour model works in. For
   'all', the range is the attendance store's own span — there is nothing to
   measure outside it. */
function labourRangeForPeriod(period) {
  var range = periodRange(period, 0);
  if (range) {
    return { from: attIso(new Date(range.start)), to: attIso(new Date(range.end)) };
  }
  var keys = Object.keys(S.attendance || {}).sort();
  if (keys.length === 0) return null;
  return { from: keys[0], to: keys[keys.length - 1] };
}

function renderLabourStatsCard(period, tonnage) {
  if ((S.staff || []).length === 0) return '';
  var r = labourRangeForPeriod(period);
  if (!r) return '';
  return renderLabourCard(r.from, r.to, (PERIOD_LABELS[period] || '') + ' Labour', tonnage, 'inv-stats-card-full');
}
