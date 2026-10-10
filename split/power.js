/* ===== POWER — the cuts, the connection's load, and the case for reliable supply =====
 * Floor → Power (owner, 30 Sep 2026: "Make a power cut tab, we have built a business case
 * for power cut and how to resolve it, find it, read it and update it"). The case was written once, on 30 May, over 56
 * days (soma-internal `archives/2026-W21-W22-session/13-power-cut-infrastructure-case.md`); this page keeps it current.
 *
 * **The cuts are Production's** (`S.production.entries`, kind `downtime`): the register's power log, the pickling hand's
 * and the supervisor's messages, a cut entered by hand, and the history imported from soma-internal's power-cut log (a
 * `sep-production` file of downtime entries, built privately and never committed). The same cut reported twice is one
 * cut (`prodDowntimeDay`). A cut whose power-back is earlier in the clock than its start ran overnight.
 *
 * **The case is a document drawn from the data every time it is shown** (owner: "The case report should always be
 * printable, and it should be dynamic - updates data as soon as the data feeding it is updated"): Case shows it on the
 * page, Print sends the same document to the print view, and a save anywhere, in this window or another, redraws it.
 *
 * What a cut costs, in four layers, each saying where it comes from:
 *   - output lost: the cut's minutes inside a working window (the 8:30–5:00 shift, and any OT block recorded that
 *     day) × revenue per scheduled hour over the last 90 days, net of credit notes. The case's ₹2,500 an hour was an
 *     estimate; this is measured, and like it, it is revenue at stake, not revenue certainly lost (a day can be
 *     recovered by staying late, as 11 Jun was);
 *   - wages paid idle: every hand marked present whose own day covers the cut, at their hour rate;
 *   - the restart: bath and line back to work, a flat figure per cut in a working window (the case's ₹600);
 *   - the fixed charge carried by no output: the month's fixed/demand charge over its scheduled minutes, per dark minute.
 * A day with no record is a gap, never a day without cuts: rates are per RECORDED working day, and the gaps are listed. */

/* The areas whose line stops when the power goes: their hands are the lower end of the idle wages. */
var POWER_PLATING_AREAS = ['vat-a1', 'vat-a2', 'barrel'];
// The tab map, TM4e: the Overview went (the month, its cost and a year at this rate are Cuts' card and Floor's Power card).
var POWER_TABS = [['cuts', 'Cuts'], ['causes', 'Causes'], ['load', 'Load & bills'], ['case', 'Case']];
var _powerTab = (function() { try { var t = localStorage.getItem('sep_inv_power_tab'); return POWER_TABS.some(function(x) { return x[0] === t; }) ? t : 'cuts'; } catch (e) { return 'cuts'; } })();
var _powerTabMoved = false;

/* The options' figures, the case's own until a quote replaces them. Money in ₹, capture as a share. */
var POWER_CFG_DEFAULTS = {
  restart: 600, rateFallback: 2500, contribFallback: 0.2,
  genCapexLo: 350000, genCapexHi: 500000, genPerHour: 320, genYearly: 25000, genCapture: 0.95,
  invCapexLo: 200000, invCapexHi: 300000, invPerHour: 50, invYearly: 40000, invHours: 3,
  tsCapexLo: 200000, tsCapexHi: 650000, tsSaveMonth: 7500, tsCapture: 0.99
};
var POWER_CFG_FIELDS = [
  ['restart', 'Restart, per cut in a working window', '₹'],
  ['rateFallback', 'Output per hour when no invoices are in hand', '₹'],
  ['contribFallback', 'Contribution per rupee of output when no tonnage is weighed', 'share'],
  ['genCapexLo', 'Generator: capex, low', '₹'], ['genCapexHi', 'Generator: capex, high', '₹'],
  ['genPerHour', 'Generator: diesel per running hour', '₹'], ['genYearly', 'Generator: maintenance a year', '₹'],
  ['genCapture', 'Generator: share of dark minutes covered', 'share'],
  ['invCapexLo', 'Inverter: capex, low', '₹'], ['invCapexHi', 'Inverter: capex, high', '₹'],
  ['invPerHour', 'Inverter: recharge per running hour', '₹'], ['invYearly', 'Inverter: battery, a year', '₹'],
  ['invHours', 'Inverter: hours it can carry the plant', 'h'],
  ['tsCapexLo', 'TSUISL switch: one-time, low', '₹'], ['tsCapexHi', 'TSUISL switch: one-time, high', '₹'],
  ['tsSaveMonth', 'TSUISL switch: tariff saving a month', '₹'], ['tsCapture', 'TSUISL switch: share of cuts it removes', 'share']
];
/* What the case left open on 30 May, and what has been added since. Their state is the owner's to set. */
var POWER_ITEMS = [
  ['load50', '50 kVA sanctioned load showing on the bill'],
  ['tsQuote', 'TSUISL connection quote'],
  ['invQuote', 'Inverter quote (Plan B)'],
  ['signoff', 'Partners’ sign-off on the spend'],
  ['records', 'Every working day’s power recorded (register or message)']
];

function powerData() {
  if (!S.power || typeof S.power !== 'object') S.power = {};
  var p = S.power;
  if (!p.load || typeof p.load !== 'object') p.load = {};
  if (!p.cfg || typeof p.cfg !== 'object') p.cfg = {};
  if (!p.items || typeof p.items !== 'object') p.items = {};
  // Why a cut came and what brought the power back, the list the book keeps (powercause.js).
  if (!Array.isArray(p.causes)) p.causes = [];
  return p;
}
function powerCfg() {
  var c = powerData().cfg, out = {};
  Object.keys(POWER_CFG_DEFAULTS).forEach(function(k) { out[k] = Number(c[k]) > 0 ? Number(c[k]) : POWER_CFG_DEFAULTS[k]; });
  return out;
}
function powerSetTab(t) {
  if (!POWER_TABS.some(function(x) { return x[0] === t; })) t = 'cuts';
  if (t !== _powerTab) _powerTabMoved = true;
  _powerTab = t;
  try { localStorage.setItem('sep_inv_power_tab', t); } catch (e) { /* a per-device convenience only */ }
}
function powerClock(min) {
  var m = ((min % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = m % 60;
  return (h % 12 || 12) + ':' + String(mm).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM');
}
function powerDur(min) {
  if (min == null) return 'no time back';
  var h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min';
}
function powerHours(min) { return formatNum(min / 60, 1) + ' h'; }

/* ---------- The cuts ---------- */
/* Every cut Production holds, one per event, oldest first: {date, from, to (minutes, past 1440 when overnight), min,
   open, overnight, reports, basis[]}. */
function powerCuts(from, to) {
  var idx = prodIndex(), byId = {}, dates = {};
  idx.live.forEach(function(e) {
    if (e.kind !== 'downtime') return;
    byId[e.id] = e;
    if ((!from || e.date >= from) && (!to || e.date <= to)) dates[e.date] = true;
  });
  var out = [];
  Object.keys(dates).sort().forEach(function(date) {
    prodDowntimeDay(date).forEach(function(c) {
      var a = relayParseHhmm(c.time), b = c.to == null ? null : relayParseHhmm(c.to);
      var overnight = b != null && b < a;
      if (overnight) b += 1440;
      var ents = c.ids.map(function(id) { return byId[id]; }).filter(Boolean);
      var basis = {};
      ents.forEach(function(e) { basis[e.basis || e.src || 'hand'] = true; });
      out.push(Object.assign({ date: date, from: a, to: b, min: b == null ? null : Math.max(0, b - a), open: b == null, overnight: overnight,
        reports: c.reports, basis: Object.keys(basis), ids: c.ids, note: (ents.find(function(e) { return e.note; }) || {}).note || '',
        // The log sometimes has only a bound for the power-back ("after 6:59 PM"): the time is the earliest it can be.
        atLeast: ents.some(function(e) { return e.downtime && e.downtime.atLeast; }),
        // A close the record did not see (the day ended early): counted as timed, and said.
        inferred: ents.some(function(e) { return e.downtime && e.downtime.inferred; }),
        phase: (ents.find(function(e) { return e.downtime && e.downtime.phase; }) || { downtime: {} }).downtime.phase || null },
        // Why it went, where it hit and what brought it back, as completed (powercause.js).
        typeof pcsCutFields === 'function' ? pcsCutFields(ents) : {}));
    });
  });
  return out;
}

/* The windows a day was worked in: the general shift on a working day (or any day with marks), and every OT or night
   block the day records. Minutes from midnight; a block past midnight runs past 1440. */
function powerWindows(date) {
  var rec = (S.attendance || {})[date], out = [];
  var sunday = new Date(date + 'T00:00:00').getDay() === 0;
  var marked = rec && rec.marks && Object.keys(rec.marks).some(function(k) { var m = rec.marks[k]; return m && (m.st === 'P' || m.st === 'H'); });
  if (!sunday || marked) out.push({ from: RELAY_GENERAL, to: RELAY_GENERAL_OUT, kind: 'general' });
  ((rec && rec.extra) || []).forEach(function(x) {
    if (x.kind !== 'block') return;
    var a = relayParseHhmm(x.from), b = relayParseHhmm(x.to);
    if (a == null || b == null) return;
    if (b <= a) b += 1440;
    out.push({ from: a, to: b, kind: 'ot' });
  });
  return out;
}
function _powerOverlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }
/* Minutes of a stretch inside the union of windows (windows overlap when a block runs into the shift). */
function _powerInside(from, to, wins) {
  var n = 0;
  for (var m = from; m < to; m += 1) { if (wins.some(function(w) { return m >= w.from && m < w.to; })) n++; }
  return n;
}
/* A worker's rate for an hour of their day: an hourly hand's rate, else the day rate over eight. */
function powerHourRate(w, iso) {
  if (!w) return 0;
  if (w.comp === 'hourly') return Number(w.hourRate) || 0;
  return workerDayRate(w, iso) / 8;
}

/* Revenue per scheduled hour, the last 90 days before `asOf`, net of credit notes: what an hour of the plant earns. It is
   revenue at stake, the upper bound of what an hour lost costs; the damage is read on its contribution (powerMargin). */
function powerRate(asOf) {
  var to = asOf || localDateStr(), from = isoAddDays(to, -89), cfg = powerCfg();
  var rev = statsInvoices().reduce(function(s, i) { return i.date >= from && i.date <= to ? s + (Number(i.taxableValue) || 0) : s; }, 0);
  var days = statsWorkingDays(from, to);
  if (!(rev > 0) || !days) return { perHour: cfg.rateFallback, measured: false, from: from, to: to };
  return { perHour: rev / (days * (RELAY_GENERAL_OUT - RELAY_GENERAL) / 60), measured: true, from: from, to: to, revenue: rev, days: days };
}
/* The share of a rupee of output that is contribution: realisation less the variable cost per kg (everything but the
   monthly crew), over the same 90 days at the live cost. Output not made loses that share, never the whole rupee: the
   zinc, chemicals and power it would have used are not bought (Iuno, 30 Sep 2026: the case counted revenue). A book
   with no weighed tonnage uses the fallback in the options' figures, and says so. */
function powerMargin(asOf) {
  var to = asOf || localDateStr(), from = isoAddDays(to, -89), cfg = powerCfg();
  var inv = statsInvoices().filter(function(i) { return i.date >= from && i.date <= to; });
  var w = inv.length ? weighLines(inv) : { kg: 0 };
  if (w.kg > 0) {
    var c = liveCost(from, to, w.kg), sp = statsCostSplit(c);
    if (sp.known) {
      // Read twice: at the live cost, and at the typed full cost less the same monthly crew. The live cost reads low where
      // its record is thin (the chemicals' use, zinc charged), and a low cost makes a lost hour look dear; the lower share
      // is used, so the case never reads a gain out of what is not recorded.
      var real = w.revKnown / w.kg, varKg = sp.variable / w.kg, fixedKg = sp.fixed / w.kg;
      var typed = Number(S.defaultCostPerKg) || 8.55, varTyped = Math.max(0, typed - fixedKg);
      var clamp = function(v) { return real > 0 ? Math.min(1, Math.max(0, (real - v) / real)) : 0; };
      var live = clamp(varKg), model = clamp(varTyped);
      return { share: Math.min(live, model), basis: model < live ? 'typed' : 'live', live: live, model: model, measured: true, real: real, varKg: varKg,
        varTyped: varTyped, typed: typed, fixedKg: fixedKg, liveKg: c.perKg, costShare: c.measuredShare, from: from, to: to };
    }
  }
  return { share: cfg.contribFallback, measured: false, from: from, to: to };
}
function powerFixedPerMinute(month) {
  var b = costBills().find(function(x) { return x.kind === 'power' && !x.voided && x.month === month && Number(x.fixed) > 0; });
  if (!b) return null;
  var start = month + '-01', days = statsWorkingDays(start, payMonthEnd(start));
  return days ? Number(b.fixed) / (days * (RELAY_GENERAL_OUT - RELAY_GENERAL)) : null;
}

/* One cut, layer by layer. A cut with no time back is costed at the typical length of the cuts that have one
   (ctx.typical, the median), never to the end of the day: 28 Jul's last cut read 640 minutes that way.
   Idle wages are a range: the platers present (VAT A1, VAT A2, barrel: the lines that stop) up to everyone present
   (pickling, which is a chemical dip and runs through a cut, the office and the gate too; Iuno H-5).
   A hand's time is their own in and out, and every OT or night block that names them in its crew: a cut in an evening
   block idles the block's crew whatever their general-shift mark says (Iuno H-5: 5 Aug and 18 Aug read ₹0). */
function powerCutCost(cut, ctx) {
  var cfg = ctx.cfg, wins = powerWindows(cut.date);
  // A power-back known only as a bound ("after 7:16 PM") ends at the later of the bound and the typical length.
  var end = cut.to == null ? cut.from + (ctx.typical || 0) : cut.atLeast ? Math.max(cut.to, cut.from + (ctx.typical || 0)) : cut.to;
  var inside = _powerInside(cut.from, end, wins);
  var ot = _powerInside(cut.from, end, wins.filter(function(w) { return w.kind === 'ot'; }));
  var rec = (S.attendance || {})[cut.date], idle = 0, idleAll = 0, idleOt = 0, hands = 0, handsAll = 0;
  if (rec) {
    var spans = {};
    Object.keys(rec.marks || {}).forEach(function(id) {
      var mk = rec.marks[id];
      if (!mk || (mk.st !== 'P' && mk.st !== 'H')) return;
      var a = mk.inMin != null ? mk.inMin : RELAY_GENERAL, b = mk.outMin != null ? mk.outMin : (mk.st === 'H' ? RELAY_GENERAL + 240 : RELAY_GENERAL_OUT);
      if (b <= a) b += 1440;
      (spans[String(id)] = spans[String(id)] || { mk: mk, iv: [] }).iv.push({ from: a, to: b, areas: [mk.area || ((staffById(id) || {}).area) || ''] });
    });
    (rec.extra || []).forEach(function(x) {
      if (x.kind !== 'block' || !Array.isArray(x.crew)) return;
      var a = relayParseHhmm(x.from), b = relayParseHhmm(x.to);
      if (a == null || b == null) return;
      if (b <= a) b += 1440;
      x.crew.forEach(function(id) { if (id != null) (spans[String(id)] = spans[String(id)] || { mk: null, iv: [] }).iv.push({ from: a, to: b, areas: x.areas || [] }); });
    });
    Object.keys(spans).forEach(function(id) {
      var sp = spans[id], o = _powerInside(cut.from, end, sp.iv);
      if (o <= 0) return;
      var w = staffById(id), r = powerHourRate(w, cut.date) * o / 60;
      var inGen = _powerInside(cut.from, end, sp.iv.map(function(v) { return { from: Math.max(v.from, RELAY_GENERAL), to: Math.min(v.to, RELAY_GENERAL_OUT) }; }));
      // Where the hand stood at the time: a pickling hand on the general shift can be on a VAT line in the evening block.
      var plat = _powerInside(cut.from, end, sp.iv.filter(function(v) { return v.areas.some(function(x) { return POWER_PLATING_AREAS.indexOf(x) >= 0; }); }));
      handsAll++; idleAll += r;
      // The idle wages already counted for minutes past the shift, at what an overtime hour pays (Castor N-9).
      if (o > inGen && w) idleOt += (w.comp === 'hourly' ? Number(w.hourRate) || 0 : workerOtHourPay(w, labourCfg(), cut.date)) * (o - inGen) / 60;
      if (plat > 0) { hands++; idle += r * plat / o; }
    });
  }
  var lost = ctx.rate.perHour * inside / 60;
  var fpm = powerFixedPerMinute(cut.date.slice(0, 7));
  var fixed = fpm != null ? fpm * inside : 0;
  var restart = inside > 0 ? cfg.restart : 0;
  return { end: end, inside: inside, ot: ot, hands: hands, handsAll: handsAll, recorded: !!rec, lost: gstRound(lost), contrib: gstRound(lost * ctx.margin.share),
    idle: gstRound(idle), idleAll: gstRound(idleAll), idleOt: idleOt, restart: restart, fixed: gstRound(fixed), fixedKnown: fpm != null,
    // Filled by powerRecovery: the overtime the backlog took, and the share of the dark working time it made up.
    recOt: 0, recHours: 0, recovered: 0, total: 0, upper: 0 };
}
/* The damage, once the recovery is known. Where the backlog was worked off late, the cut cost that overtime; where it
   was not, it cost the output's contribution and the wages that bought none. A restart is paid either way. The fixed
   charge is paid whether the power is on or not, so it is shown and never added. */
function _powerDamage(k) {
  var left = 1 - k.recovered;
  k.total = gstRound(k.restart + k.recOt + left * (k.contrib + k.idle));
  k.upper = gstRound(k.restart + k.recOt + left * (k.contrib + k.idleAll));
  return k;
}

/* Overtime paid on a day, in rupees and hand-hours: every hand's own overtime (a monthly or daily hand's OT hours at
   their overtime rate; an hourly hand's hours past eight at their flat rate, since that tier has no overtime of its own)
   and the EXTRA booked on every OT or night block. The EXTRA booked on the general shift is left out: it covers a hand
   missing from an area, not work carried over. A Sunday is not read (a day worked there is a day, not overtime). */
/* A night hold is the night shift (owner, 30 Sep 2026: "night hold is night shift"): a block that starts at 8 PM or later,
   or runs past midnight into the morning, is a shift of its own, not a day running late, so it is never catch-up. */
function powerIsNightBlock(x) {
  var a = relayParseHhmm(x.from), b = relayParseHhmm(x.to);
  if (a == null || b == null) return false;
  return a >= 1200 || (b < a && b > 0);
}
function powerDayOt(date, skip) {
  var rec = (S.attendance || {})[date];
  if (!rec) return null;
  var cfg = labourCfg(), cost = 0, hours = 0;
  Object.keys(rec.marks || {}).forEach(function(id) {
    var mk = rec.marks[id], w = staffById(id);
    if (!mk || !w || (mk.st !== 'P' && mk.st !== 'H')) return;
    var oh = w.comp === 'hourly' ? Math.max(0, (Number(mk.hours) || 0) - 8) : Number(mk.ot) || 0;
    if (!(oh > 0)) return;
    hours += oh;
    cost += oh * (w.comp === 'hourly' ? Number(w.hourRate) || 0 : workerOtHourPay(w, cfg, date));
  });
  (rec.extra || []).forEach(function(x) {
    var hh = Number(x.hours) || 0;
    if (x.kind !== 'block' || !(hh > 0) || powerIsNightBlock(x) || (skip && skip.indexOf(x) >= 0)) return;
    hours += hh; cost += hh * (cfg.extraRate || 0);
  });
  return { cost: cost, hours: hours };
}
/* The overtime a cut's backlog took (owner, 30 Sep 2026: "also take into assumption OT that we had to do following the
   power cut due to the backlog of material it creates"). A cut in working hours puts its own day and the next working
   day at risk of running late. Each such day's overtime is set against the usual: the median of the clean recorded days
   (no cut that day or the working day before, and not in a run of likely-unreported days) IN THE SAME MONTH, at least
   four of them. The record changed what it holds from one month to the next (evening blocks from late July, the night
   hold from 19 August, the monthly crew's OT from September), and a baseline drawn across such a change measures the
   change, not a backlog (Castor and Vulcanus, re-audit N-2). Left out of the overtime on both sides: a night hold, which
   is a shift; and on a cut's own day, the block the cut fell in, whose EXTRA is that block's own staffing, not catch-up
   (N-1). What is above the usual is shared among the cuts that put the day at risk, by their dark working minutes, after
   taking off the idle wages already counted for a cut past the shift. **Each cut's share is capped at the hand-hours it
   stood idle** (its dark working minutes × the platers idle, or everyone present where no plater is recorded): a cut
   cannot have taken more work to make up than it stopped (N-1: a 13-minute cut had been billed 30 hand-hours). It is
   still an upper reading: a day running late for an urgent order reads the same. */
function powerRecovery(cuts, first, today, quiet) {
  var out = { byDay: {}, affected: 0, above: 0, noBase: 0, cost: 0, hours: 0, capped: 0 };
  if (!first) return out;
  var days = statsWorkingDayList(first, today), risk = {}, quietDay = {};
  quiet.forEach(function(q) { statsWorkingDayList(q.from, q.to).forEach(function(d) { quietDay[d] = true; }); });
  // The next working day with attendance, within a week: the day the backlog would be carried into.
  var nextOf = function(d) { return days.find(function(x) { return x > d && x <= isoAddDays(d, 7) && (S.attendance || {})[x]; }) || null; };
  cuts.forEach(function(c) {
    if (!(c.cost.inside > 0)) return;
    [c.date, nextOf(c.date)].forEach(function(d, j) {
      if (!d || (j === 0 && new Date(d + 'T00:00:00').getDay() === 0)) return;
      (risk[d] = risk[d] || []).push({ cut: c, w: c.cost.inside, own: j === 0 });
    });
  });
  var clean = days.filter(function(d) { return !risk[d] && !quietDay[d] && (S.attendance || {})[d]; }).map(function(d) { return { d: d, ot: powerDayOt(d) }; });
  Object.keys(risk).sort().forEach(function(d) {
    // The blocks a cut on this day fell in.
    var rec = (S.attendance || {})[d] || {}, skip = [];
    risk[d].forEach(function(r) {
      if (!r.own) return;
      (rec.extra || []).forEach(function(x) {
        if (x.kind !== 'block') return;
        var a = relayParseHhmm(x.from), b = relayParseHhmm(x.to);
        if (a == null || b == null) return;
        if (b <= a) b += 1440;
        if (_powerOverlap(r.cut.from, r.cut.cost.end, a, b) > 0 && skip.indexOf(x) < 0) skip.push(x);
      });
    });
    var ot = powerDayOt(d, skip);
    if (!ot) return;
    out.affected++;
    var near = clean.filter(function(x) { return x.d.slice(0, 7) === d.slice(0, 7); });
    if (near.length < 4) { out.noBase++; out.byDay[d] = { ot: ot, base: null }; return; }
    var base = { cost: numMedian(near.map(function(x) { return x.ot.cost; })), hours: numMedian(near.map(function(x) { return x.ot.hours; })) };
    var ownIdle = risk[d].filter(function(r) { return r.own; }).reduce(function(s, r) { return s + r.cut.cost.idleOt; }, 0);
    // Hand-hours above the usual, scaled down with the rupees when the day's own idle OT is taken off.
    var raw = ot.cost - base.cost, cost = Math.max(0, raw - ownIdle), hours = raw > 0 ? Math.max(0, ot.hours - base.hours) * cost / raw : 0;
    out.byDay[d] = { ot: ot, base: base, excess: cost, hours: hours, cuts: risk[d].length };
    if (!(cost > 0)) return;
    out.above++;
    var tw = risk[d].reduce(function(s, r) { return s + r.w; }, 0);
    risk[d].forEach(function(r) { r.cut.cost.recOt += cost * r.w / tw; r.cut.cost.recHours += hours * r.w / tw; });
  });
  cuts.forEach(function(c) {
    var k = c.cost, idleHands = k.hands > 0 ? k.hands : k.handsAll;
    var cap = k.inside * idleHands / 60;
    if (k.recHours > cap + 1e-9) {
      k.recOt = k.recHours > 0 ? k.recOt * cap / k.recHours : 0;
      k.recHours = cap;
      out.capped++;
    }
    k.recOt = gstRound(k.recOt);
    out.cost += k.recOt; out.hours += k.recHours;
    // The share of the cut's dark working time the overtime made up: its hand-hours over the hands the cut stood idle.
    k.recovered = k.inside > 0 && idleHands > 0 ? Math.min(1, k.recHours * 60 / (k.inside * idleHands)) : 0;
    _powerDamage(k);
  });
  out.cost = gstRound(out.cost);
  return out;
}

/* Working days in a range that carry a record of the floor: a plated entry or an attendance day. A cut alone does not
   make its day recorded: April's cuts come from the handwritten power log with no floor record around them, and counting
   only the days that had a cut read April at 1.38 cuts a day. A day with no record is a gap, and no rate is read across it. */
function powerRecordedDays(from, to) {
  var days = {};
  statsWorkingDayList(from, to).forEach(function(d) { days[d] = false; });
  prodIndex().live.forEach(function(e) { if (e.date in days && e.kind === 'plated') days[e.date] = true; });
  Object.keys(S.attendance || {}).forEach(function(d) { if (d in days) days[d] = true; });
  var rec = Object.keys(days).filter(function(d) { return days[d]; });
  return { recorded: rec.length, of: Object.keys(days).length, gaps: Object.keys(days).filter(function(d) { return !days[d]; }).sort(), days: rec.sort() };
}

/* Runs of recorded working days with no cut, long enough that at the record's own rate some were expected. A day's
   floor can be recorded while its power is not (27 Aug – 15 Sep: attendance every day, no power message or register
   page), so such a run is read as possibly unreported, never as a clean stretch. The rate is the cuts on recorded days
   over those days, one population (Iuno H-3: April's cuts, on days with no record, had been divided by recorded days),
   and a cut on a Sunday worked ends a run like any other. */
function powerQuietRuns(cuts, first, today, span) {
  var cutDays = {}, recDay = {};
  span.days.forEach(function(d) { recDay[d] = true; });
  cuts.forEach(function(c) { cutDays[c.date] = true; });
  var onRec = cuts.filter(function(c) { return recDay[c.date]; }).length;
  var rate = span.recorded ? onRec / span.recorded : 0, runs = [], cur = [];
  var list = statsWorkingDayList(first, today);
  Object.keys(cutDays).forEach(function(d) { if (d >= first && d <= today && list.indexOf(d) < 0) list.push(d); });
  list.sort().forEach(function(d) {
    if (cutDays[d]) { if (cur.length) runs.push(cur); cur = []; return; }
    if (!recDay[d]) return;
    cur.push(d);
  });
  if (cur.length) runs.push(cur);
  // Expected at least three cuts at the record's rate: a run that long without one is more likely unreported.
  return runs.filter(function(r) { return rate * r.length >= 3; }).map(function(r) { return { from: r[0], to: r[r.length - 1], days: r.length, expected: rate * r.length, rate: rate }; });
}

/* The whole reading, over the record: every cut with its cost, by month, by hour, the year ahead and the options. */
function powerAnalysis() {
  var cuts = powerCuts(), cfg = powerCfg(), today = localDateStr();
  var rate = powerRate(today), margin = powerMargin(today), typical = numMedian(cuts.filter(function(c) { return c.min != null && !c.atLeast; }).map(function(c) { return c.min; })) || 0;
  var ctx = { cfg: cfg, rate: rate, margin: margin, typical: typical };
  cuts.forEach(function(c) { c.cost = powerCutCost(c, ctx); });
  var first = cuts.length ? cuts[0].date : null;
  var span = first ? powerRecordedDays(first, today) : null;
  var quiet = first ? powerQuietRuns(cuts, first, today, span) : [];
  var recovery = powerRecovery(cuts, first, today, quiet);
  var quietIn = function(from, to) {
    return quiet.reduce(function(s, q) { var a = q.from > from ? q.from : from, b = q.to < to ? q.to : to; return a <= b ? s + statsWorkingDayList(a, b).filter(function(d) { return span.days.indexOf(d) >= 0; }).length : s; }, 0);
  };
  // A rate reads only the cuts on recorded days, the days it divides by (Iuno H-3, the case's total row; P127: each month and
  // the year counted a cut on a day with no record, a Sunday included, over the recorded days alone).
  var onRec = {};
  if (span) span.days.forEach(function(d) { onRec[d] = true; });
  var months = {};
  cuts.forEach(function(c) {
    var m = c.date.slice(0, 7), e = months[m] || (months[m] = { month: m, cuts: 0, min: 0, open: 0, cost: 0, upper: 0, lost: 0, contrib: 0, idle: 0, idleAll: 0, recOt: 0, restart: 0, fixed: 0, cutsRec: 0, costRec: 0 });
    e.cuts++;
    if (onRec[c.date]) { e.cutsRec++; e.costRec += c.cost.total; } if (c.min != null) e.min += c.min; else e.open++;
    e.cost += c.cost.total; e.upper += c.cost.upper; e.lost += c.cost.lost; e.contrib += c.cost.contrib; e.idle += c.cost.idle; e.idleAll += c.cost.idleAll;
    e.recOt += c.cost.recOt; e.restart += c.cost.restart; e.fixed += c.cost.fixed;
  });
  var monthList = Object.keys(months).sort().map(function(m) {
    var e = months[m], start = m + '-01', end = payMonthEnd(start);
    if (end > today) end = today;
    if (first && start < first) start = first;
    var rd = powerRecordedDays(start, end);
    e.recorded = rd.recorded; e.of = rd.of; e.quiet = quietIn(start, end);
    // A month's rate leaves out its likely-unreported days: read across them it would say the power was fine (Iuno H-4).
    var base = rd.recorded - e.quiet;
    e.perDay = base >= 5 ? e.cutsRec / base : null; e.costPerDay = base >= 5 ? e.costRec / base : null;
    return e;
  });
  // By when the cut began, in the shop's own bands.
  var bands = [['Before 8:30 AM', 0, RELAY_GENERAL], ['8:30 AM – noon', RELAY_GENERAL, 720], ['Noon – 2 PM', 720, 840], ['2 – 5 PM', 840, RELAY_GENERAL_OUT], ['After 5 PM', RELAY_GENERAL_OUT, 1440]]
    .map(function(b) { return { label: b[0], from: b[1], to: b[2], cuts: 0, min: 0 }; });
  var hours = [];
  for (var hh = 0; hh < 24; hh++) hours.push(0);
  cuts.forEach(function(c) {
    var b = bands.find(function(x) { return c.from >= x.from && c.from < x.to; });
    if (b) { b.cuts++; if (c.min != null) b.min += c.min; }
    hours[Math.floor(c.from / 60) % 24]++;
  });
  // The year ahead, from the last 90 days of record, per recorded working day, leaving out the days of a likely-unreported
  // run: they are recorded days whose power was not, and reading them as clean would put the year below the best month.
  var from90 = isoAddDays(today, -89), recent = cuts.filter(function(c) { return c.date >= from90 && onRec[c.date]; });
  var start90 = first && first > from90 ? first : from90;
  var rd90 = first ? powerRecordedDays(start90, today) : { recorded: 0, of: 0 };
  var quietIn90 = first ? quietIn(start90, today) : 0;
  rd90 = { recorded: Math.max(0, rd90.recorded - quietIn90), of: rd90.of, quiet: quietIn90 };
  var yearDays = statsWorkingDays(isoAddDays(today, -364), today);
  var sum = function(f) { return recent.reduce(function(s, c) { return s + f(c); }, 0); };
  var perDay = function(v) { return rd90.recorded ? v / rd90.recorded * yearDays : null; };
  // A month holding a run of likely-unreported days is left out of the best and worst: it would read as the best.
  var full = monthList.filter(function(e) { return e.recorded >= 10 && e.costPerDay != null && !e.quiet; });
  var lowM = full.slice().sort(function(p, q) { return p.costPerDay - q.costPerDay; })[0] || null, highM = full.slice().sort(function(p, q) { return q.costPerDay - p.costPerDay; })[0] || null;
  var year = !rd90.recorded ? null : {
    base: gstRound(perDay(sum(function(c) { return c.cost.total; }))), upper: gstRound(perDay(sum(function(c) { return c.cost.upper; }))),
    revenue: gstRound(perDay(sum(function(c) { return c.cost.lost; }))), recOt: gstRound(perDay(sum(function(c) { return c.cost.recOt; }))),
    low: lowM ? gstRound(lowM.costPerDay * yearDays) : null, high: highM ? gstRound(highM.costPerDay * yearDays) : null,
    lowMonth: lowM ? lowM.month : null, highMonth: highM ? highM.month : null,
    hours: perDay(sum(function(c) { return c.min || 0; })) / 60, workHours: perDay(sum(function(c) { return c.cost.inside; })) / 60,
    days: yearDays, recorded: rd90.recorded, of: rd90.of, quiet: rd90.quiet, cuts: recent.length
  };
  // An inverter carries only its hours, from the moment the grid goes: the share of the dark WORKING minutes it would
  // have covered (Iuno M-3: read on every dark minute, the night cuts pulled it down).
  var dark = 0, carried = 0;
  cuts.forEach(function(c) { dark += c.cost.inside; carried += Math.min(c.cost.inside, cfg.invHours * 60); });
  var invCapture = dark ? carried / dark : 0;
  var options = null;
  if (year) {
    var opt = function(key, label, capLo, capHi, capture, running, yearly, saving, note) {
      var gain = year.base * capture + saving - running - yearly;
      return { key: key, label: label, capLo: capLo, capHi: capHi, capture: capture, running: gstRound(running), yearly: yearly, saving: saving, gain: gstRound(gain),
        payLo: gain > 0 ? capLo / gain * 12 : null, payHi: gain > 0 ? capHi / gain * 12 : null, note: note };
    };
    options = [
      opt('ts', 'TSUISL supply switch', cfg.tsCapexLo, cfg.tsCapexHi, cfg.tsCapture, 0, 0, cfg.tsSaveMonth * 12, 'replaces the JBVNL feeder; the quote is still to come'),
      opt('inv', 'Inverter and battery', cfg.invCapexLo, cfg.invCapexHi, invCapture, cfg.invPerHour * year.workHours * invCapture, cfg.invYearly, 0,
        Math.round(invCapture * 100) + '% of the dark working minutes on record fall within ' + formatNum(cfg.invHours, 0) + ' h of a cut; that it can carry the plating load that long is the 30 May estimate'),
      opt('gen', 'Diesel generator', cfg.genCapexLo, cfg.genCapexHi, cfg.genCapture, cfg.genPerHour * year.workHours, cfg.genYearly, 0, 'backs the grid up for any length of cut')
    ];
  }
  var totals = cuts.reduce(function(t, c) {
    var k = c.cost;
    t.cuts++; if (c.min != null) t.min += c.min; else t.open++; if (c.overnight) t.overnight++;
    if (c.inferred) t.inferred++; if (c.atLeast) t.atLeast++;
    if (c.phase === 'single') { t.single++; t.singleMin += c.min || 0; }
    t.cost += k.total; t.upper += k.upper; t.lost += k.lost; t.contrib += k.contrib; t.idle += k.idle; t.idleAll += k.idleAll; t.recOt += k.recOt; t.recHours += k.recHours;
    t.restart += k.restart; t.fixed += k.fixed; t.inside += k.inside;
    t.leftC += (1 - k.recovered) * k.contrib; t.leftI += (1 - k.recovered) * k.idle; t.leftIAll += (1 - k.recovered) * k.idleAll;
    if (k.ot) t.inOt++;
    return t;
  }, { cuts: 0, min: 0, open: 0, overnight: 0, cost: 0, upper: 0, lost: 0, contrib: 0, idle: 0, idleAll: 0, recOt: 0, recHours: 0, restart: 0, fixed: 0, inside: 0, leftC: 0, leftI: 0, leftIAll: 0, inOt: 0, inferred: 0, atLeast: 0, single: 0, singleMin: 0 });
  ['cost', 'upper', 'lost', 'contrib', 'idle', 'idleAll', 'recOt', 'restart', 'fixed', 'leftC', 'leftI', 'leftIAll'].forEach(function(k) { totals[k] = gstRound(totals[k]); });
  return { cuts: cuts, months: monthList, bands: bands, hours: hours, year: year, options: options, totals: totals, rate: rate, margin: margin, cfg: cfg,
    first: first, span: span, invCapture: invCapture, load: powerLoad(), typical: typical, quiet: quiet, recovery: recovery };
}

/* ---------- The connection's load ---------- */
/* The load record, and what the bills say of it: the load billed, the peak drawn, the over-limit penalty. */
function powerBills() {
  return costBills().filter(function(b) { return b.kind === 'power' && !b.voided; }).sort(function(a, b) { return a.month < b.month ? -1 : a.month > b.month ? 1 : (a.at || 0) - (b.at || 0); });
}
function powerLoad() {
  var l = powerData().load, bills = powerBills();
  var billed = bills.filter(function(b) { return Number(b.kvaBilled) > 0; }).pop() || null;
  var sanctioned = billed ? Number(billed.kvaBilled) : Number(l.sanctioned) || null;
  var approved = Number(l.approved) || null;
  var since = l.approvedOn ? l.approvedOn.slice(0, 7) : null;
  var penaltySince = since ? gstRound(bills.filter(function(b) { return b.month >= since; }).reduce(function(s, b) { return s + (Number(b.penalty) || 0); }, 0)) : 0;
  var peak = bills.filter(function(b) { return Number(b.md) > 0; }).pop() || null;
  return { sanctioned: sanctioned, approved: approved, approvedOn: l.approvedOn || null, ref: l.ref || '', note: l.note || '', billedOn: billed ? billed.month : null,
    pending: !!(approved && sanctioned && sanctioned < approved), penaltySince: penaltySince, since: since, peak: peak ? Number(peak.md) : null, peakMonth: peak ? peak.month : null, bills: bills };
}

/* ---------- The page ---------- */
/* Power (the tab map, TM4e): Cuts · Causes · Load & bills · Case, each led by its verdict card and its own toolbar (§1a-12): Cuts
   enters a cut (Import history behind More), Causes has none, Load & bills edits the load, Case prints. */
function renderPower() {
  var el = document.getElementById('powerContent');
  if (!el) return;
  powerData();
  if (!POWER_TABS.some(function(t) { return t[0] === _powerTab; })) _powerTab = 'cuts';
  var a = powerAnalysis();
  var h = '<div class="inv-viewtabs" role="tablist" aria-label="Power">' + POWER_TABS.map(function(t) {
    return '<button class="inv-viewtab" role="tab" aria-selected="' + (_powerTab === t[0]) + '" data-action="invPowerTab" data-tab="' + t[0] + '">' + t[1] + '</button>';
  }).join('') + '</div>';
  if (_powerTab === 'causes') h += pcsCausesHtml(a);
  else if (_powerTab === 'load') h += powerLoadHtml(a);
  else if (_powerTab === 'case') h += powerCaseViewHtml(a);
  else h += powerCutsHtml(a);
  el.innerHTML = h;
  viewTabReveal(el.querySelector('.inv-viewtabs'));
  // The case on the page is the paper, fitted to the screen (TM2f's paperFit, as the report is).
  if (_powerTab === 'case') paperFit(document.getElementById('powerCaseSheet'));
  if (_powerTabMoved) { _powerTabMoved = false; viewTop(); }
  // A case open in the print view follows the data too.
  var body = document.getElementById('invPrintBody'), view = document.getElementById('invPrintView');
  if (body && view && view.classList.contains('inv-print-view-active') && body.querySelector('[data-power-case]')) { body.innerHTML = powerCaseHtml(a); printFit(); }
}

/* The month on record so far: its cuts, dark minutes, the ones with no time back, their cost and its recorded days. */
function powerMonthNow(a) {
  var today = localDateStr(), m = today.slice(0, 7);
  return a.months.find(function(x) { return x.month === m; }) || { month: m, cuts: 0, min: 0, open: 0, cost: 0, recorded: powerRecordedDays(m + '-01', today).recorded };
}
/* The load approved and not yet billed, as a row of what needs the owner, in red (it was a callout on Load & bills). */
function powerLoadRowHtml(L) {
  if (!L.pending) return '';
  return '<div class="inv-row inv-row-2" data-power-load-row><button class="inv-row-main" data-action="invPowerTab" data-tab="load"><span class="inv-row-title">' +
    escHtml(formatNum(L.approved, 0) + ' kVA approved, billed at ' + formatNum(L.sanctioned, 0)) + '</span><span class="inv-row-meta">' +
    escHtml('since ' + formatDate(L.approvedOn) + ' · chase JBVNL') + '</span></button>' +
    uiRowEndHtml(escHtml(formatCurrency(L.penaltySince)), { tone: 'danger', word: 'Penalty' }) + '</div>';
}

/* Cuts (TM4e): the month's verdict (its cuts and their cost, a year at this rate; the Overview's four tiles its factors), Enter a
   cut, what needs the owner (the load approved and not billed, in red; the cuts to complete), then the cuts by month, each a line
   of two facts that opens to what its damage is made of; the two charts folded after them. */
function powerCutsHtml(a) {
  var mm = powerMonthNow(a), L = a.load, y = a.year, phone = !_isDesktop;
  var h = uiVerdictHtml({ screen: 'Cuts · ' + billsMonthLabel(mm.month || localDateStr().slice(0, 7)),
    verdict: mm.cuts ? todoPlural(mm.cuts, 'cut') + ' this month, ' + finRs(mm.cost) : 'No cut this month', money: true,
    plain: mm.cuts ? todoPlural(mm.cuts, 'cut') + ' this month' : 'No cut this month',
    tone: L.pending ? 'danger' : mm.cuts ? 'warning' : 'ok',
    facts: [y ? { text: formatInrShort(y.base) + ' a year at this rate', money: true } : '', mm.cuts ? powerHours(mm.min) + ' dark' + (mm.open ? ', ' + mm.open + ' with no time back' : '') : '',
      (mm.recorded || 0) + ' days recorded'],
    factors: [
      { label: 'Cuts this month', fig: String(mm.cuts), tone: mm.cuts ? 'warning' : null, sub: powerHours(mm.min) + ' dark', attrs: ' data-power-tile="month"' },
      { label: 'What they cost', fig: figWrapHtml(escHtml(formatCurrency(mm.cost))), tone: mm.cost > 0 ? 'warning' : null, sub: 'this month', money: true, attrs: ' data-power-tile="cost"' },
      { label: 'A year at this rate', fig: y ? figWrapHtml(escHtml(formatCurrency(y.base))) : '', tone: y && y.base > 0 ? 'danger' : null,
        sub: y ? 'the last 90 days, ' + y.recorded + ' of ' + y.of + ' recorded' : 'no cut on record yet', money: true, attrs: ' data-power-tile="year"' },
      { label: 'Load', fig: L.sanctioned ? escHtml(formatNum(L.sanctioned, 0) + ' kVA') : '', tone: L.pending ? 'danger' : null,
        sub: L.pending ? formatNum(L.approved, 0) + ' kVA approved, not billed' : L.sanctioned ? 'as billed' : 'not recorded yet', attrs: ' data-power-tile="load"' }],
    attrs: ' id="powerVerdict"' });
  h += '<div class="inv-toolbar" data-power-toolbar="cuts"><button class="inv-btn inv-btn-primary" data-action="invPowerAddCut">Enter a cut</button>' +
    uiToolbarMoreHtml([{ label: 'Import history', action: 'invPowerImport' }], { icon: phone }) + '</div>';
  h += pcsCompleteHtml(pcsAnalysis(a), powerLoadRowHtml(L));
  if (!a.cuts.length) return h + '<div class="inv-panel"><div class="inv-empty">No power cut on record yet: they come in with the register photos and the messages Production reads, or Enter a cut.</div></div>';
  // A cut is one line (the day and why, the clock and how long, the damage and where it fell) that opens to what the damage is made
  // of; the newest month is open and every older one folds to its head (UX overhaul 2's length pass).
  a.months.slice().reverse().forEach(function(m, mi) {
    var list = a.cuts.filter(function(c) { return c.date.slice(0, 7) === m.month; }).reverse();
    var rows = list.map(function(c) { return powerCutRowHtml(c, a.typical); });
    var head = '<span class="inv-panel-title">' + escHtml(billsMonthLabel(m.month)) + ' <span class="inv-panel-count">' + m.cuts + '</span></span>' +
      '<span class="inv-num">' + formatCurrency(m.cost) + '</span>';
    h += uiFoldHtml('power-' + m.month, head,
      '<div class="inv-row" data-power-month-facts><span class="inv-row-main"><span class="inv-row-meta">' + escHtml(powerHours(m.min) + ' dark · ' + m.recorded + ' of ' + m.of + ' working days recorded') + '</span></span></div>' +
      uiMoreHtml('power-' + m.month, rows, { n: 10, noun: 'cuts' }), mi === 0, ' data-power-month="' + m.month + '"');
  });
  // The two charts, folded after the cuts (they led the Overview).
  h += uiFoldCard('power-months', '<div class="inv-panel inv-panel-flush" id="powerMonths"><div class="inv-panel-head"><span class="inv-panel-title">Cuts by month</span></div><div class="inv-panel-body">' +
    chartBars(a.months.map(function(x) { return { label: billsMonthLabel(x.month), value: x.cuts }; }), { unit: 'count', ariaLabel: 'Cuts by month', emptyText: 'No cut on record' }) + '</div></div>', false);
  h += uiFoldCard('power-hours', '<div class="inv-panel inv-panel-flush" id="powerHours"><div class="inv-panel-head"><span class="inv-panel-title">When they come</span></div><div class="inv-panel-body">' +
    chartBars(a.hours.map(function(n, i) { return { label: (i % 12 || 12) + (i < 12 ? 'a' : 'p'), value: n }; }).slice(5, 23), { unit: 'count', ariaLabel: 'Cuts by the hour they began, 5 AM to 10 PM', emptyText: 'No cut on record' }) +
    '<div class="inv-note">' + escHtml(a.bands.map(function(b) { return b.label + ' ' + b.cuts; }).join(' · ')) + '</div></div></div>', false);
  return h;
}
/* A cut (§3b-11): the day (and why it went) as its title, the clock and how long as two facts (a cut with no time back: the time it
   went and the length it is costed at, `typical`), the damage at its end with where it fell; opened, its reason and fix, and what
   the damage is made of, a fact a row. */
function powerCutRowHtml(c, typical) {
  var k = c.cost, left = 1 - (k.recovered || 0), parts = [];
  var part = function(label, meta, amount) { parts.push(uiFactRowHtml({ label: label, sub: meta, value: formatCurrency(amount), attrs: ' data-power-part' })); };
  if (k.restart) part('Restart', 'paid whether or not the work is made up', k.restart);
  if (k.recOt) part('Catch-up overtime', k.recovered ? Math.round(k.recovered * 100) + '% made up' : '', k.recOt);
  if (k.lost) part('Output not made', 'its contribution' + (k.recovered ? ', the ' + Math.round(left * 100) + '% not made up' : '') + ' (output ' + formatCurrency(k.lost) + ')', gstRound(left * k.contrib));
  if (k.idleAll) part('Wages that bought nothing', k.hands + ' plater' + (k.hands === 1 ? '' : 's') + (k.idleAll > k.idle ? ', ' + formatCurrency(k.idleAll) + ' with everyone' : '') +
    (k.recovered ? ', the ' + Math.round(left * 100) + '% not made up' : ''), gstRound(left * k.idle));
  if (k.fixed) part('Fixed charge', 'paid anyway, so not added', k.fixed);
  var facts = [c.phase === 'single' ? uiFactRowHtml({ label: 'Single-phase', value: '', sub: 'counted as dark' }) : '',
    c.reports > 1 ? uiFactRowHtml({ label: 'Reports', value: String(c.reports), sub: 'counted once' }) : '',
    k.inside ? uiFactRowHtml({ label: 'In working hours', value: powerDur(k.inside), sub: k.ot ? powerDur(k.ot) + ' of it overtime' : '' }) : ''].join('');
  // The meridiem once where both ends share it (10:10 – 10:45 AM).
  var at = powerClock(c.from), back = c.to != null ? powerClock(c.to) : null;
  var when = back == null ? at : c.atLeast || c.overnight ? at + ' – ' + (c.atLeast ? 'after ' : '') + back + (c.overnight ? ' next day' : '')
    : at.slice(-2) === back.slice(-2) ? at.slice(0, -3) + ' – ' + back : at + ' – ' + back;
  var tone = c.open ? 'warning' : k.inside ? 'danger' : 'neutral', why = c.reason && pcsName(c.reason) ? pcsName(c.reason) : '';
  var meta = [when, c.open ? 'costed at ' + powerDur(typical || 0) : powerDur(c.min) + (c.atLeast ? ' at least' : '') + (c.inferred ? ', close inferred' : '')].join(' · ');
  return '<details class="inv-row-fold" data-power-cut="' + escHtml(c.date + '|' + c.from) + '"><summary class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' +
    escHtml(stockShortDate(c.date)) + (why ? ' · <span data-power-cut-why>' + escHtml(why) + '</span>' : '') + '</span><span class="inv-row-meta">' + escHtml(meta) + '</span></span>' +
    uiRowEndHtml(escHtml(formatCurrency(k.total)), { tone: tone, word: c.open ? 'No time back' : k.inside ? 'Working hours' : 'Off hours' }) + '</summary>' +
    '<div class="inv-row-children">' + pcsCutWhyHtml(c) + facts + parts.join('') + '</div></details>';
}

/* Load & bills (TM4e): the load's verdict (approved against billed, the penalty since approval; its factors the load billed and
   approved, the peak and the penalty, each said once: the connection's rows are the card's), Edit load, then each bill a line that
   opens to its details, and the penalty by bill. */
function powerLoadHtml(a) {
  var L = a.load, any = L.sanctioned || L.approved || L.bills.length;
  var verdict = L.pending ? 'Approved ' + formatNum(L.approved, 0) + ' kVA, billed at ' + formatNum(L.sanctioned, 0)
    : L.sanctioned ? 'Billed at ' + formatNum(L.sanctioned, 0) + ' kVA' + (L.approved && L.approved === L.sanctioned ? ', as approved' : '') : 'No load recorded yet';
  var kva = function(n, dp) { return escHtml(formatNum(n, dp)) + '<span class="inv-tile-of"> kVA</span>'; };
  var h = uiVerdictHtml({ screen: 'Load & bills', verdict: verdict, tone: L.pending ? 'danger' : L.sanctioned ? 'ok' : 'neutral',
    facts: [L.pending ? { text: formatCurrency(L.penaltySince) + ' penalty since approval', tone: L.penaltySince > 0 ? 'danger' : null, money: true } : '',
      L.pending ? 'chase JBVNL' + (L.ref ? ', ref ' + L.ref : '') : '', L.bills.length ? todoPlural(L.bills.length, 'bill') + ' on record' : 'no bill entered yet'],
    factors: any ? [
      { label: 'Billed at', fig: L.sanctioned ? kva(L.sanctioned, 0) : '', tone: L.pending ? 'danger' : null, sub: L.billedOn ? billsMonthLabel(L.billedOn) + ' bill' : 'the load typed', attrs: ' data-power-tile="billed"' },
      { label: 'Approved', fig: L.approved ? kva(L.approved, 0) : '', sub: L.approvedOn ? 'since ' + formatDate(L.approvedOn) + (L.ref ? ', ref ' + L.ref : '') : 'not recorded', attrs: ' data-power-tile="approved"' },
      { label: 'Peak drawn', fig: L.peak ? kva(L.peak, 2) : '', sub: L.peakMonth ? billsMonthLabel(L.peakMonth) + ' bill' : 'no bill gives it', attrs: ' data-power-tile="peak"' },
      { label: 'Penalty since', fig: L.since ? figWrapHtml(escHtml(formatCurrency(L.penaltySince))) : '', tone: L.penaltySince > 0 ? 'danger' : null, sub: L.since ? 'the bills since approval' : 'no approval recorded', money: true, attrs: ' data-power-tile="penalty"' }] : [],
    body: L.note ? '<div class="inv-hero-sheet"><div class="inv-row" data-power-load-note><span class="inv-row-main"><span class="inv-row-meta inv-row-wrap">' + escHtml(L.note) + '</span></span></div></div>' : '',
    attrs: ' id="powerLoad"' });
  h += '<div class="inv-toolbar" data-power-toolbar="load"><button class="inv-btn inv-btn-primary" data-action="invPowerLoadEdit">Edit load</button></div>';
  h += '<div class="inv-panels">';
  h += '<div class="inv-panel inv-panel-flush" id="powerBills"><div class="inv-panel-head"><span class="inv-panel-title">Electricity bills</span><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPowerBillsGo">Add a bill</button></div>';
  if (!L.bills.length) h += '<div class="inv-empty">No electricity bill entered. Bills are added in Money → Payments; their details are set here.</div>';
  L.bills.slice().reverse().forEach(function(b) {
    var facts = [b.kwh ? ['Units', formatNum(b.kwh, 0) + ' kWh'] : b.units ? ['Units', formatNum(b.units, 0)] : null, b.kvah ? ['kVAh', formatNum(b.kvah, 0)] : null,
      b.kwh && b.kvah ? ['Power factor', formatNum(b.kwh / b.kvah, 3)] : null, b.md ? ['Peak drawn', formatNum(b.md, 2) + ' kVA'] : null, b.kvaBilled ? ['Billed at', formatNum(b.kvaBilled, 0) + ' kVA'] : null,
      b.fixed ? ['Fixed charge', formatCurrency(b.fixed)] : null, b.energy ? ['Energy', formatCurrency(b.energy)] : null, b.fca ? ['Fuel adjustment', formatCurrency(b.fca)] : null,
      b.duty ? ['Duty', formatCurrency(b.duty)] : null, b.penalty ? ['Penalty', formatCurrency(b.penalty)] : null, b.arrears ? ['Arrears', formatCurrency(b.arrears)] : null].filter(Boolean);
    var two = [b.kwh ? formatNum(b.kwh, 0) + ' kWh' : b.units ? formatNum(b.units, 0) + ' units' : '', b.md ? 'peak ' + formatNum(b.md, 2) + ' kVA' : ''].filter(Boolean).join(' · ');
    var key = 'power-bill-' + b.id;
    h += '<details class="inv-row-fold" data-fold="' + escHtml(key) + '" data-power-bill="' + escHtml(b.id) + '"' + (uiFoldOpen(key, false) ? ' open' : '') + '>' +
      '<summary class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(billsMonthLabel(b.month)) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(facts.length ? two || todoPlural(facts.length, 'detail') : 'amount only: set its details') + '</span></span>' +
      uiRowEndHtml(escHtml(formatCurrency(b.amount))) + '</summary>' +
      // Opened: its details a fact a row, and Details, the one action that sets them (§1a-11: the row's end is its figure).
      '<div class="inv-row-children">' + facts.map(function(f) { return uiFactRowHtml({ label: f[0], value: f[1] }); }).join('') +
      '<div class="inv-row-actions"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPowerBillEdit" data-id="' + escHtml(b.id) + '">' + (facts.length ? 'Details' : 'Set its details') + '</button></div></div></details>';
  });
  h += '</div>';
  var pts = L.bills.filter(function(b) { return b.penalty != null || b.md != null; });
  if (pts.length >= 2) h += uiFoldCard('power-penalty', '<div class="inv-panel inv-panel-flush" id="powerPenalty"><div class="inv-panel-head"><span class="inv-panel-title">Over-limit penalty by bill</span></div><div class="inv-panel-body">' +
    chartBars(pts.map(function(b) { return { label: billsMonthLabel(b.month), value: Number(b.penalty) || 0 }; }), { ariaLabel: 'Over-limit penalty by bill' }) + '</div></div>', false);
  return h + '</div>';
}
/* Case (TM4e): the document, Print the case the one primary and Options' figures beside it, the paper fitted to the screen. */
window.addEventListener('resize', function() { var s = document.getElementById('powerCaseSheet'); if (s && s.offsetParent) paperFit(s); });
function powerCaseViewHtml(a) {
  return '<div class="inv-toolbar" data-power-toolbar="case"><button class="inv-btn inv-btn-primary" data-action="invPowerPrint">Print the case</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invPowerCfg">Options&rsquo; figures</button></div>' +
    '<div class="inv-rpt-sheet" id="powerCaseSheet" data-power-case-wrap>' + powerCaseHtml(a) + '</div>';
}

/* ---------- The case, as a document ---------- */
function _pcTable(head, rows, foot) {
  return '<table class="inv-sr-table"><thead><tr>' + head.map(function(x) { return '<th' + (x[1] ? ' class="inv-sr-amt"' : '') + '>' + x[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function(r) { return '<tr>' + r.map(function(v, i) { return '<td' + (head[i] && head[i][1] ? ' class="inv-sr-amt"' : '') + '>' + v + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>' +
    (foot ? '<tfoot><tr>' + foot.map(function(v, i) { return '<td' + (head[i] && head[i][1] ? ' class="inv-sr-amt"' : '') + '>' + v + '</td>'; }).join('') + '</tr></tfoot>' : '') + '</table>';
}
function _pcSec(n, title) { return '<div class="inv-pc-sec">' + n + '. ' + title + '</div>'; }
function _pcP(text) { return '<p class="inv-pc-p">' + text + '</p>'; }
function _pcL(n) { return formatNum(n / 100000, 2) + ' L'; }
function _pcMonths(m) { return m == null ? '—' : m < 1 ? 'under a month' : formatNum(m, 0) + ' months'; }

function powerCaseHtml(a) {
  a = a || powerAnalysis();
  var co = (S.company && S.company.name) || 'Soma Electro Products', t = a.totals, today = localDateStr(), L = a.load, y = a.year;
  var h = '<div class="inv-sr-doc" data-power-case><div class="inv-sr-head"><div class="inv-sr-co">' + escHtml(co) + '</div></div>' +
    '<div class="inv-sr-title">Power cuts: the case for reliable supply</div>' +
    '<table class="inv-sr-meta"><tr><td class="inv-sr-meta-l">As of</td><td>' + escHtml(formatDate(today)) + ', drawn from the app&rsquo;s records when printed</td></tr>' +
    '<tr><td class="inv-sr-meta-l">Record</td><td>' + (a.first ? escHtml(formatDate(a.first) + ' to ' + formatDate(today) + ' · ' + todoPlural(t.cuts, 'cut') + ' · ' + a.span.recorded + ' of ' + a.span.of + ' working days carry a record') : 'no cut on record') + '</td></tr>' +
    '<tr><td class="inv-sr-meta-l">First written</td><td>30 May 2026, over 56 days: 26 cuts, ~35 h 31 min, ~&#8377;3.7 L a year forgone (base), TSUISL switch recommended</td></tr></table>';
  if (!t.cuts) return h + _pcP('No power cut is on record yet, so the case cannot be read from the data. Import the history from soma-internal&rsquo;s power-cut log (Power &rarr; Cuts &rarr; Import history), or record cuts as they come.') + '</div>';

  // 1. Summary
  var bestOpt = (a.options || []).filter(function(o) { return o.payLo != null; }).sort(function(p, q) { return p.payLo - q.payLo; })[0];
  h += _pcSec(1, 'In short');
  h += _pcP(escHtml(todoPlural(t.cuts, 'cut') + ' on record since ' + formatDate(a.first) + ', ' + powerHours(t.min) + ' dark' + (t.open ? ' and ' + t.open + ' more with no time back recorded' : '') +
    (t.overnight ? ' (' + t.overnight + ' ran overnight)' : '') + ', ' + powerHours(t.inside) + ' of it in working hours. Together they cost ' + formatCurrency(t.cost) + ': overtime to catch up the backlog ' +
    formatCurrency(t.recOt) + ', output never made up (its contribution) ' + formatCurrency(t.leftC) + ', platers’ wages that bought nothing ' + formatCurrency(t.leftI) + ', restarts ' + formatCurrency(t.restart) +
    ' (the 30 May case’s ₹' + formatNum(a.cfg.restart, 0) + ' a cut, an estimate, not measured: without it the record measures ' + formatCurrency(gstRound(t.cost - t.restart)) + '). Counting everyone present, not only the floor, it is ' + formatCurrency(t.upper) + '. At full revenue the output at stake was ' + formatCurrency(t.lost) + ': the most the cuts could have cost, not what they did.'));
  if (y) h += _pcP(escHtml('At the last 90 days’ rate (' + y.cuts + ' cuts on ' + y.recorded + ' recorded days' + (y.quiet ? ', leaving out ' + y.quiet + ' days whose power was likely not reported' : '') + ') a year costs ' + formatCurrency(y.base) +
    (y.upper > y.base ? ' (' + formatCurrency(y.upper) + ' with everyone’s wages)' : '') +
    (y.low != null ? '; the complete months ran from ' + formatCurrency(y.low) + ' a year (' + billsMonthLabel(y.lowMonth) + ') to ' + formatCurrency(y.high) + ' (' + billsMonthLabel(y.highMonth) + ')' : '') + ', for about ' + formatNum(y.workHours, 0) + ' dark working hours.'));
  if (L.pending) h += _pcP(escHtml('The connection is billed at ' + formatNum(L.sanctioned, 0) + ' kVA though ' + formatNum(L.approved, 0) + ' kVA was recorded as approved on ' + formatDate(L.approvedOn) +
    '; the over-limit penalty on the bills since is ' + formatCurrency(L.penaltySince) + (L.peak ? ', with a peak of ' + formatNum(L.peak, 2) + ' kVA' : '') + '.'));
  if (bestOpt) h += _pcP(escHtml('Of the three options, ' + bestOpt.label + ' pays back soonest: ' + _pcMonths(bestOpt.payLo) + ' to ' + _pcMonths(bestOpt.payHi) + '.'));

  // 2. The record
  h += _pcSec(2, 'The record, month by month');
  var qTot = a.months.reduce(function(s2, m) { return s2 + m.quiet; }, 0), rTot = a.span.recorded - qTot;
  var onRec = a.cuts.filter(function(c) { return a.span.days.indexOf(c.date) >= 0; }).length;
  h += _pcTable([['Month'], ['Cuts', 1], ['Dark', 1], ['No time back', 1], ['Days recorded', 1], ['Cuts a recorded day', 1], ['Catch-up OT', 1], ['Cost', 1]],
    a.months.map(function(m) { return [escHtml(billsMonthLabel(m.month)), m.cuts, escHtml(powerHours(m.min)), m.open || '', m.recorded + ' of ' + m.of + (m.quiet ? ' (' + m.quiet + ' quiet)' : ''),
      m.perDay != null ? formatNum(m.perDay, 2) : '—', m.recOt ? formatCurrency(m.recOt) : '—', formatCurrency(m.cost)]; }),
    ['Total', t.cuts, escHtml(powerHours(t.min)), t.open || '', a.span.recorded + ' of ' + a.span.of, rTot > 0 ? formatNum(onRec / rTot, 2) : '—', formatCurrency(t.recOt), formatCurrency(t.cost)]);
  h += _pcP(escHtml('Cuts a recorded day leave out the quiet days (below) and a month with fewer than five days left; each month and the total count only the cuts that fell on a recorded day.'));
  if (a.span.gaps.length) h += _pcP(escHtml(a.span.gaps.length + ' working day' + (a.span.gaps.length === 1 ? '' : 's') + ' since the first cut carry no record at all (no production, no attendance, no power entry): a gap in the record, not days without cuts. Rates here are per recorded day.' +
    ' The longest run: ' + _powerLongestGap(a.span.gaps) + '.'));

  if (a.quiet.length) h += _pcP(escHtml('Recorded days with no cut, longer than the record makes likely: ' + a.quiet.map(function(q) {
    return formatDate(q.from) + ' – ' + formatDate(q.to) + ' (' + q.days + ' days, ~' + formatNum(q.expected, 0) + ' cuts expected)';
  }).join('; ') + '. The floor was recorded on those days but its power may not have been: read as possibly unreported, never as clean. The month rates above include them, so those months read low; the year ahead leaves them out.'));

  // 3. When
  h += _pcSec(3, 'When they come');
  h += _pcTable([['Began'], ['Cuts', 1], ['Share', 1], ['Dark', 1]], a.bands.map(function(b) { return [escHtml(b.label), b.cuts, Math.round(b.cuts / t.cuts * 100) + '%', escHtml(powerHours(b.min))]; }));
  var noon = a.bands[2];
  h += _pcP(escHtml(noon.cuts + ' of ' + t.cuts + ' cuts (' + Math.round(noon.cuts / t.cuts * 100) + '%) began between noon and 2 PM, two hours of the eight and a half worked: the midday pattern the log has named since June. ' + t.inOt + ' cut' + (t.inOt === 1 ? '' : 's') + ' fell in an overtime block the attendance records; a block the record does not hold is not seen, so this is a floor, not the count.'));

  // 4. What a cut costs
  h += _pcSec(4, 'What a cut costs');
  var mg = a.margin, rv = a.recovery;
  h += _pcP(escHtml('A cut in working hours stops the line, and the work it stopped is either made up later, in overtime, or never made. Made up, the cut cost the overtime; never made, it cost the output’s contribution and the wages that bought nothing. A restart is paid either way.'));
  h += _pcTable([['Layer'], ['How it is worked out'], ['On record', 1]], [
    ['Overtime to catch up', escHtml('the overtime paid on the cut’s day and the next working day, above the usual: the median of the clean recorded days in the same month, since the record held different overtime from month to month (' + rv.affected + ' days at risk, ' + rv.above + ' ran above the usual' +
      (rv.noBase ? ', ' + rv.noBase + ' with fewer than four clean days in their month to judge' : '') + '). A night hold is a shift and never counts, nor, on a cut’s own day, the EXTRA of the block the cut fell in. Shared among the cuts by their dark working minutes and capped at the hand-hours each cut stood idle' +
      (rv.capped ? ' (' + rv.capped + ' capped)' : '') + ': ' + formatNum(t.recHours, 0) + ' hand-hours. An upper reading: a day running late for an urgent order reads the same.'), formatCurrency(t.recOt)],
    ['Output not made up', escHtml('minutes in a working window × ' + formatCurrency(a.rate.perHour) + ' an hour × ' + Math.round(mg.share * 100) + '% contribution, on the share not made up. ' +
      (mg.measured ? 'The contribution is realisation ' + formatCurrency(mg.real) + '/kg over the last 90 days less the variable cost, everything but the monthly crew (the zinc, chemicals and power lost output would have used are not bought): ' +
        formatCurrency(mg.varKg) + '/kg at the live cost (' + formatCurrency(mg.liveKg) + '/kg in all, ' + Math.round(mg.costShare * 100) + '% measured) gives ' + Math.round(mg.live * 100) + '%; ' +
        formatCurrency(mg.varTyped) + '/kg at the typed full cost of ' + formatCurrency(mg.typed) + '/kg gives ' + Math.round(mg.model * 100) + '%. The lower is used, so a thin record never makes a lost hour dearer.'
        : 'The contribution is the fallback in the options’ figures: no weighed tonnage in the last 90 days.')), formatCurrency(t.leftC)],
    ['Wages that bought nothing', escHtml('platers present (VAT A1, VAT A2, barrel) whose own day or OT block covers the cut, at their hour rate, on the share not made up (a monthly plater’s wage is in the fixed cost the contribution leaves out, so this is that cost standing idle, not counted twice); ' + formatCurrency(t.leftIAll) + ' counting everyone present (pickling runs through a cut, so it is the upper end)'), formatCurrency(t.leftI)],
    ['Restarts', escHtml(formatCurrency(a.cfg.restart) + ' a cut in a working window, the 30 May case’s estimate: bath and line back to work'), formatCurrency(t.restart)]
  ], ['Damage', '', formatCurrency(t.cost)]);
  h += _pcTable([['Shown, not added'], ['Why'], ['On record', 1]], [
    ['Output at stake, full revenue', escHtml('minutes in a working window × ' + formatCurrency(a.rate.perHour) + ' an hour ' + (a.rate.measured ? '(revenue net of credit notes over ' + a.rate.days + ' working days to ' + formatDate(a.rate.to) + ', per 8½-hour shift)' : '(the case’s estimate: no invoices in the last 90 days)') + ': the upper bound, if no hour were ever made up and nothing it used were saved'), formatCurrency(t.lost)],
    ['Fixed charge, dark minutes', 'the month’s fixed/demand charge per dark working minute; paid whether the power is on or not, so a backup saves none of it', formatCurrency(t.fixed)]
  ]);
  var top = a.cuts.slice().sort(function(p, q) { return q.cost.total - p.cost.total; }).slice(0, 10);
  h += _pcP('The ten costliest:');
  h += _pcTable([['Date'], ['Cut'], ['In working hours', 1], ['Platers', 1], ['Catch-up OT', 1], ['Made up', 1], ['Cost', 1]], top.map(function(c) {
    return [escHtml(formatDate(c.date)), escHtml(powerClock(c.from) + ' – ' + (c.to != null ? powerClock(c.to) + (c.overnight ? ' next day' : '') : 'not back')), escHtml(powerDur(c.cost.inside)), c.cost.hands || '',
      c.cost.recOt ? formatCurrency(c.cost.recOt) : '—', c.cost.recovered ? Math.round(c.cost.recovered * 100) + '%' : '—', formatCurrency(c.cost.total)];
  }));

  // 5. The year ahead
  h += _pcSec(5, 'A year at this rate');
  if (y) h += _pcTable([['Reading'], ['A year', 1]], [
    ['The best complete month' + (y.lowMonth ? ' (' + escHtml(billsMonthLabel(y.lowMonth)) + ')' : ''), y.low != null ? formatCurrency(y.low) : '—'],
    ['The last 90 days' + (y.quiet ? ', less ' + y.quiet + ' likely-unreported days' : ''), formatCurrency(y.base)],
    ['The worst complete month' + (y.highMonth ? ' (' + escHtml(billsMonthLabel(y.highMonth)) + ')' : ''), y.high != null ? formatCurrency(y.high) : '—'],
    ['The last 90 days, counting everyone’s wages', formatCurrency(y.upper)],
    ['The last 90 days’ output at full revenue (the upper bound)', formatCurrency(y.revenue)]
  ]) + _pcP(escHtml('Of the last 90 days’ reading, ' + formatCurrency(y.recOt) + ' a year is overtime to catch up. A complete month has 10 or more recorded working days and no run of likely-unreported days. ' +
    'The last 90 days are read per recorded day with the quiet days left out, and can sit outside the complete months’ range, since those months are other months. ' + y.days + ' working days a year.'));
  else h += _pcP('Not enough record in the last 90 days to read a year.');

  // 6. The connection
  h += _pcSec(6, 'The connection');
  h += _pcTable([['Month'], ['Billed at', 1], ['Peak', 1], ['Penalty', 1], ['Fixed', 1], ['Bill', 1]], L.bills.map(function(b) {
    return [escHtml(billsMonthLabel(b.month)), b.kvaBilled ? formatNum(b.kvaBilled, 0) + ' kVA' : '—', b.md ? formatNum(b.md, 2) + ' kVA' : '—', b.penalty != null ? formatCurrency(b.penalty) : '—', b.fixed ? formatCurrency(b.fixed) : '—', formatCurrency(b.amount)];
  }));
  h += _pcP(escHtml(L.approved ? (L.pending ? formatNum(L.approved, 0) + ' kVA recorded as approved on ' + formatDate(L.approvedOn) + ', not yet on the bill: ' + formatCurrency(L.penaltySince) + ' of over-limit penalty since.' : formatNum(L.approved, 0) + ' kVA approved' + (L.sanctioned >= L.approved ? ' and billed.' : '.')) : 'No load recorded: Power → Load & bills → Edit load.') +
    ' Any backup or new connection is sized to this load: the options below assume the 50 kVA the plant draws.');

  // 7. The options
  h += _pcSec(7, 'The options');
  if (a.options) {
    h += _pcTable([['Option'], ['One-time', 1], ['Covers', 1], ['Running a year', 1], ['Gain a year', 1], ['Pays back', 1]], a.options.map(function(o) {
      return [escHtml(o.label) + '<br><span class="inv-sr-void">' + escHtml(o.note) + '</span>', escHtml(_pcL(o.capLo) + '–' + _pcL(o.capHi)), Math.round(o.capture * 100) + '%',
        formatCurrency(o.running + o.yearly), formatCurrency(o.gain), escHtml(o.payLo != null ? _pcMonths(o.payLo) + ' – ' + _pcMonths(o.payHi) : 'does not pay back')];
    }));
    h += _pcP(escHtml('Gain a year = the year’s damage at this rate × the share an option covers + TSUISL’s tariff saving − running and upkeep. The damage, not the revenue at stake: an hour kept is worth its catch-up overtime or its contribution, not its price. Running hours are the dark working hours. The one-time figures and running costs are the 30 May case’s estimates until a quote replaces them (Options’ figures).'));
  } else h += _pcP('The options are read once there is a year to read against.');

  // 8. Recommendation
  h += _pcSec(8, 'Recommendation');
  var ts = (a.options || []).find(function(o) { return o.key === 'ts'; }), inv = (a.options || []).find(function(o) { return o.key === 'inv'; });
  h += _pcP(escHtml('The 30 May case stands on the record: pursue the TSUISL switch first, since it is the only option that replaces the JBVNL feeder rather than backing it up' +
    (ts && ts.payLo != null ? ' (paying back in ' + _pcMonths(ts.payLo) + ' to ' + _pcMonths(ts.payHi) + ' at today’s rate)' : '') + ', and quote an inverter in parallel as Plan B' +
    (inv ? ' (' + Math.round(a.invCapture * 100) + '% of the dark working minutes on record fall within its hours)' : '') + '. ' +
    (L.pending ? 'Before either, get the approved ' + formatNum(L.approved, 0) + ' kVA onto the bill: the penalty is money spent every month for nothing, and every option is sized to that load.' : '')));

  // 9. Open items
  h += _pcSec(9, 'Open');
  var items = powerData().items;
  h += _pcTable([['Item'], ['State'], ['Note']], POWER_ITEMS.map(function(it) {
    var s = items[it[0]] || {};
    var auto = it[0] === 'load50' && L.approved && !L.pending && L.sanctioned ? 'done' : null;
    return [escHtml(it[1]), escHtml((auto || s.status) === 'done' ? 'Done' + (s.at ? ', ' + formatDate(isoOf(new Date(s.at))) : '') : s.status === 'asked' ? 'Asked' : 'Open'), escHtml(s.note || '')];
  }));

  // 10. What is not counted
  h += _pcSec(10, 'What this does not count');
  h += '<ul class="inv-pc-p">' + [
    'Catch-up overtime is read off the attendance record, so a day that ran late for an urgent order reads the same as one catching up a cut: an upper reading. A cut on a day with no attendance has none to read, and its output counts as never made up.',
    'A Sunday worked to catch up is not read: a day worked there is paid as a day, not as overtime.',
    'Bath chemistry shocked by repeated restarts, and single-phase faults (22 Jun) beyond their hours: not yet measurable.',
    t.open + ' cut' + (t.open === 1 ? '' : 's') + ' with no time back recorded ' + (t.open === 1 ? 'is' : 'are') + ' costed at the typical length of those that have one (' + powerDur(a.typical) + ')' +
      (t.atLeast ? '; ' + t.atLeast + ' known only to have lasted past a time are costed to the later of that time and the typical length' : '') +
      (t.inferred ? '; ' + t.inferred + ' more ' + (t.inferred === 1 ? 'has' : 'have') + ' a close the record inferred rather than saw' : '') + '.',
    t.single ? t.single + ' single-phase fault' + (t.single === 1 ? '' : 's') + ' (' + powerHours(t.singleMin) + ') ' + (t.single === 1 ? 'is' : 'are') + ' counted as dark, as the log records ' + (t.single === 1 ? 'it' : 'them') + '; whether a line ran part-load on one phase is not recorded.' : '',
    'Days with no record at all are gaps, never days without cuts.'
  ].filter(Boolean).map(function(x) { return '<li>' + escHtml(x) + '</li>'; }).join('') + '</ul>';
  h += '<div class="inv-sr-foot">Sources: Production&rsquo;s power entries (register, messages, by hand, and the soma-internal log imported); attendance and pay rates; invoices net of credit notes; electricity bills. The case document in soma-internal records where this came from.</div>';
  return h + '</div>';
}
function _powerLongestGap(gaps) {
  var best = [], cur = [];
  gaps.forEach(function(d) {
    if (cur.length && statsWorkingDays(isoAddDays(cur[cur.length - 1], 1), d) === 1) cur.push(d); else cur = [d];
    if (cur.length > best.length) best = cur.slice();
  });
  return best.length ? best.length + ' working day' + (best.length === 1 ? '' : 's') + ', ' + formatDate(best[0]) + (best.length > 1 ? ' – ' + formatDate(best[best.length - 1]) : '') : 'none';
}

function powerPrint() {
  var body = document.getElementById('invPrintBody');
  if (!body) return;
  body.innerHTML = powerCaseHtml();
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = 'Power cuts case ' + localDateStr();
}

/* ---------- Dialogs ---------- */
function _pwField(id, label, value, type, extra) {
  return '<label class="inv-field"><span class="inv-field-label">' + label + '</span><input class="inv-input' + (type === 'number' ? ' inv-input-num' : '') + '" id="' + id + '" type="' + (type || 'text') + '"' +
    (type === 'number' ? ' step="any" min="0" inputmode="decimal"' : '') + ' value="' + escHtml(value == null ? '' : String(value)) + '"' + (extra || '') + '></label>';
}
function powerLoadEdit() {
  var l = powerData().load;
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('The connection&rsquo;s load') + '<div class="inv-fields">' +
    _pwField('pwSanctioned', 'Sanctioned load, kVA (as the bill says)', l.sanctioned, 'number') +
    _pwField('pwApproved', 'Load approved, kVA', l.approved, 'number') +
    _pwField('pwApprovedOn', 'Approved on', l.approvedOn, 'date') +
    _pwField('pwRef', 'Application reference', l.ref) + '</div>' +
    _pwField('pwNote', 'Note', l.note) +
    '<div class="inv-note">A bill&rsquo;s own &ldquo;billed at&rdquo; figure, set in its details, wins over the sanctioned load typed here.</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPowerLoadSave">Save</button></div></div>', { dismiss: true });
}
function _pwVal(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
function _pwNum(id) { var v = parseFloat(_pwVal(id)); return v > 0 ? v : null; }
function powerLoadSave() {
  var p = powerData();
  var on = _pwVal('pwApprovedOn');
  p.load = { sanctioned: _pwNum('pwSanctioned'), approved: _pwNum('pwApproved'), approvedOn: /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : null, ref: _pwVal('pwRef'), note: _pwVal('pwNote'), at: Date.now() };
  closeOverlay();
  saveState();
  renderPower();
  showToast('Load saved');
}
var POWER_BILL_FIELDS = [['kvaBilled', 'Load billed at, kVA'], ['md', 'Peak demand, kVA'], ['kwh', 'Units, kWh'], ['kvah', 'kVAh'], ['fixed', 'Fixed / demand charge, ₹'],
  ['energy', 'Energy charge, ₹'], ['penalty', 'Over-limit (excess CD) penalty, ₹'], ['fca', 'Fuel cost adjustment, ₹'], ['duty', 'Electricity duty, ₹'], ['net', 'Net payable on the bill, ₹']];
function powerBillEdit(id) {
  var b = costBills().find(function(x) { return x.id === id; });
  if (!b) return;
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('Bill details · ' + escHtml(billsMonthLabel(b.month))) + '<div class="inv-fields">' +
    POWER_BILL_FIELDS.map(function(f) { return _pwField('pwb_' + f[0], f[1], b[f[0]], 'number'); }).join('') + '</div>' +
    '<div class="inv-note">The details are what the bill says; the amount the cost counts stays ' + escHtml(formatCurrency(b.amount)) + ' (void and re-enter the bill to change it).</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPowerBillSave" data-id="' + escHtml(b.id) + '">Save</button></div></div>', { dismiss: true });
}
function powerBillSave(id) {
  var b = costBills().find(function(x) { return x.id === id; });
  if (!b) { closeOverlay(); return; }
  var pen = _pwNum('pwb_penalty'), arr = Number(b.arrears) || 0;
  if (pen != null && gstRound(pen + arr) > Number(b.amount)) { showToast('The penalty and arrears are parts of the bill: together they cannot be more than its amount', 'error'); return; }
  POWER_BILL_FIELDS.forEach(function(f) { var v = _pwNum('pwb_' + f[0]); if (v == null) delete b[f[0]]; else b[f[0]] = f[0] === 'kwh' || f[0] === 'kvah' ? v : f[0] === 'md' || f[0] === 'kvaBilled' ? v : gstRound(v); });
  closeOverlay();
  saveState();
  renderPower();
  showToast('Bill details saved');
}
function powerCfgEdit() {
  var c = powerCfg();
  dialogOpen('<div class="inv-dialog inv-dialog-wide">' + dialogHeadHtml('The options&rsquo; figures') + '<div class="inv-fields">' +
    POWER_CFG_FIELDS.map(function(f) { return _pwField('pwc_' + f[0], f[1] + (f[2] === 'share' ? ' (0 to 1)' : f[2] === 'h' ? ', hours' : ', ₹'), c[f[0]], 'number'); }).join('') + '</div>' +
    '<div class="inv-note">The 30 May case&rsquo;s estimates until a quote replaces them. Blank goes back to the case&rsquo;s figure.</div>' +
    '<div class="inv-field"><span class="inv-field-label">Open items</span>' + POWER_ITEMS.map(function(it) {
      var s = powerData().items[it[0]] || {};
      return '<div class="inv-fields"><label class="inv-field"><span class="inv-field-label">' + escHtml(it[1]) + '</span><select class="inv-select" id="pwi_' + it[0] + '">' +
        [['open', 'Open'], ['asked', 'Asked'], ['done', 'Done']].map(function(o) { return '<option value="' + o[0] + '"' + ((s.status || 'open') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        _pwField('pwin_' + it[0], 'Note', s.note) + '</div>';
    }).join('') + '</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPowerCfgSave">Save</button></div></div>', { dismiss: true });
}
function powerCfgSave() {
  var p = powerData(), cfg = {};
  POWER_CFG_FIELDS.forEach(function(f) {
    var v = _pwNum('pwc_' + f[0]);
    if (v != null && f[2] === 'share') v = Math.min(1, v);
    if (v != null && v !== POWER_CFG_DEFAULTS[f[0]]) cfg[f[0]] = v;
  });
  p.cfg = cfg;
  POWER_ITEMS.forEach(function(it) {
    var st = _pwVal('pwi_' + it[0]) || 'open', note = _pwVal('pwin_' + it[0]), was = p.items[it[0]] || {};
    if (st === 'open' && !note) { delete p.items[it[0]]; return; }
    p.items[it[0]] = { status: st, note: note, at: was.status === st && was.at ? was.at : Date.now() };
  });
  closeOverlay();
  saveState();
  renderPower();
  showToast('Saved');
}
/* A cut is entered where every floor record is: Production's hand form, on a power cut. */
function powerAddCut() {
  switchTab('pageProduction');
  prodOpenHand(null, 'power');
  if (_prodHand) { _prodHand.kind = 'downtime'; renderProduction(); }
}
/* The history from soma-internal, one file: its cuts as a `sep-production` file (merged by id into Production), and
   under `power` the electricity bills' details by month and the load. A detail fills a bill of that month only where the
   bill has none: a figure typed here is never overwritten. A month with no bill in the app is counted, never invented. */
function powerImport() {
  if (!grdGate('imports', 'import power history', powerImport)) return;   // P1 (guard.js)
  var inp = document.getElementById('powerFileInput');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json'; inp.id = 'powerFileInput'; inp.className = 'inv-hidden';
    document.body.appendChild(inp);
    inp.addEventListener('change', function() {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function() { var obj = null; try { obj = JSON.parse(rd.result); } catch (e) { obj = null; } powerImportData(obj, f.name); inp.value = ''; };
      rd.readAsText(f);
    });
  }
  inp.click();
}
function powerImportData(obj, name) {
  if (!obj || typeof obj !== 'object') { uiAlert({ title: 'Not a power history file', body: 'The file could not be read as JSON.' }); return null; }
  // A file with no cut and no bill in it is another screen's (a day's production, a stock file): said, and taken there.
  var hasCut = obj.format === 'sep-production' && Array.isArray(obj.entries) && obj.entries.some(function(e) { return e && e.kind === 'downtime'; });
  if (!hasCut && !obj.power && obj.format !== 'sep-power' && addFileElsewhere(obj, name, 'power')) return null;
  var res = { cuts: null, details: 0, noBill: [], load: false };
  // A production file merges whole, as Production's Import merges it; what it adds is counted as cuts and as the rest.
  var cutsHeld = function() { return prodData().entries.filter(function(e) { return e.kind === 'downtime'; }).length; }, held0 = cutsHeld();
  if (obj.format === 'sep-production') { res.cuts = prodMergeImport(obj, name); res.cutsAdded = cutsHeld() - held0; }
  var pw = obj.power || (obj.format === 'sep-power' ? obj : null);
  res.refused = 0;
  if (pw && pw.bills && typeof pw.bills === 'object') Object.keys(pw.bills).forEach(function(m) {
    var fb = pw.bills[m];
    // Checked before anything is added (P127): an entry that is not a bill, or a month that is not one, is refused and
    // counted; it used to throw after the bills before it were pushed and never saved.
    if (!fb || typeof fb !== 'object' || Array.isArray(fb) || !/^\d{4}-\d{2}$/.test(m)) { res.refused++; return; }
    var b = costBills().find(function(x) { return x.kind === 'power' && !x.voided && x.month === m; });
    // What the shop paid is the cost; the bill's net payable is a detail beside it (Iuno H-6: April's net ₹54,096 was
    // paid as ₹52,846). A file with only an amount gives the amount, and says which it is in `basis`.
    var paid = Number(fb.paid) > 0 ? Number(fb.paid) : Number(fb.amount);
    if (!b && paid > 0 && /^\d{4}-\d{2}$/.test(m)) {
      // The file is the record of a bill the app does not hold: added with what was paid, never made up from details.
      b = { id: 'CB-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'power', month: m, amount: gstRound(paid), units: null,
        note: fb.note || ('From the soma-internal electricity bills record' + (fb.basis ? ' (' + fb.basis + ')' : '')), at: Date.now() };
      costBills().push(b);
      res.bills = (res.bills || 0) + 1;
    }
    if (!b) { res.noBill.push(m); return; }
    // Money to the paisa, as the Details form keeps it (HR-8); a penalty that with the arrears outgrows the bill is refused, as
    // the form refuses it.
    POWER_BILL_FIELDS.forEach(function(f) {
      var v = Number(fb[f[0]]);
      if (!(v > 0) || Number(b[f[0]]) > 0) return;
      if (['kvaBilled', 'md', 'kwh', 'kvah'].indexOf(f[0]) < 0) v = gstRound(v);
      if (f[0] === 'penalty' && gstRound(v + (Number(b.arrears) || 0)) > Number(b.amount)) { res.refused++; return; }
      b[f[0]] = v; res.details++;
    });
  });
  var p = powerData();
  if (pw && pw.load && typeof pw.load === 'object' && !Array.isArray(pw.load) && !(p.load.sanctioned || p.load.approved)) { p.load = Object.assign({}, pw.load, { at: Date.now() }); res.load = true; }
  if (!(res.cuts && res.cuts.added) && !res.details && !res.load && !res.bills) { uiAlert({ title: 'Nothing imported', body: 'The file holds no power cuts or bill details this book does not already have.' + (res.noBill.length ? ' Bills not in the app for: ' + res.noBill.join(', ') + '.' : '') }); return res; }
  saveState();
  renderPower();
  var c = res.cuts || {}, cut = res.cutsAdded || 0, rest = (c.added || 0) - cut;
  showToast([cut ? cut + ' cut' + (cut === 1 ? '' : 's') + ' added' : c.ok ? 'no new cuts' : '', rest > 0 ? todoPlural(rest, 'other production entry', 'other production entries') + ' added' : '', res.details ? res.details + ' bill detail' + (res.details === 1 ? '' : 's') + ' filled' : '',
    res.bills ? res.bills + ' bill' + (res.bills === 1 ? '' : 's') + ' added' : '', res.refused ? res.refused + ' refused' : '', res.noBill.length ? res.noBill.length + ' month' + (res.noBill.length === 1 ? '' : 's') + ' with no bill in the app' : ''].filter(Boolean).join(' · '));
  return res;
}

function powerAction(action, btn) {
  switch (action) {
    case 'invPowerTab': powerSetTab(btn.dataset.tab); renderPower(); return true;
    case 'invPowerPrint': powerPrint(); return true;
    case 'invPowerCfg': powerCfgEdit(); return true;
    case 'invPowerCfgSave': powerCfgSave(); return true;
    case 'invPowerLoadEdit': powerLoadEdit(); return true;
    case 'invPowerLoadSave': powerLoadSave(); return true;
    case 'invPowerBillEdit': powerBillEdit(btn.dataset.id); return true;
    case 'invPowerBillSave': powerBillSave(btn.dataset.id); return true;
    case 'invPowerBillsGo': addBill(); return true;
    case 'invPowerAddCut': powerAddCut(); return true;
    case 'invPowerImport': powerImport(); return true;
  }
  return false;
}

/* ---------- The To-do ---------- */
/* The approved load not yet on the bill: it asks until a bill is billed at it, or the load record says it is. */
TODO_RULES.push(['powerLoad', 'Power: an approved load is not yet on the bill']);
TODO_CHECK_DEFAULTS.powerLoad = true;
TODO_RULE_FNS.powerLoad = function() {
  var L = powerLoad();
  if (!L.pending) return [];
  return [{ key: 'powerLoad', rule: 'powerLoad', tone: L.penaltySince > 0 ? 'red' : 'amber', amount: L.penaltySince,
    title: formatNum(L.approved, 0) + ' kVA approved, still billed at ' + formatNum(L.sanctioned, 0) + ' kVA',
    sub: 'Approved ' + formatDate(L.approvedOn) + ' · ' + formatCurrency(L.penaltySince) + ' over-limit penalty on the bills since',
    why: 'Power · the connection', facts: [['Approved', formatNum(L.approved, 0) + ' kVA, ' + formatDate(L.approvedOn)], ['Billed at', formatNum(L.sanctioned, 0) + ' kVA'], ['Penalty since', formatCurrency(L.penaltySince)]]
      .concat(L.peak ? [['Peak drawn', formatNum(L.peak, 2) + ' kVA']] : []),
    clears: 'Clears itself when a bill is billed at the approved load, or the load record says it is.', go: { kind: 'power', tab: 'load' }, goLabel: 'Open Power',
    sig: L.sanctioned + '|' + L.approved + '|' + L.penaltySince }];
};
