/* ===== POWER — the cuts, the connection's load, and the case for reliable supply =====
 * Floor → Power (More → Power on the phone; owner, 30 Sep 2026: "Make a power cut tab, we have built a business case
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

var POWER_TABS = [['overview', 'Overview'], ['cuts', 'Cuts'], ['load', 'Load & bills'], ['case', 'Case']];
var _powerTab = (function() { try { var t = localStorage.getItem('sep_inv_power_tab'); return POWER_TABS.some(function(x) { return x[0] === t; }) ? t : 'overview'; } catch (e) { return 'overview'; } })();
var _powerTabMoved = false;

/* The options' figures, the case's own until a quote replaces them. Money in ₹, capture as a share. */
var POWER_CFG_DEFAULTS = {
  restart: 600, rateFallback: 2500,
  genCapexLo: 350000, genCapexHi: 500000, genPerHour: 320, genYearly: 25000, genCapture: 0.95,
  invCapexLo: 200000, invCapexHi: 300000, invPerHour: 50, invYearly: 40000, invHours: 3,
  tsCapexLo: 200000, tsCapexHi: 650000, tsSaveMonth: 7500, tsCapture: 0.99
};
var POWER_CFG_FIELDS = [
  ['restart', 'Restart, per cut in a working window', '₹'],
  ['rateFallback', 'Output per hour when no invoices are in hand', '₹'],
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
  return p;
}
function powerCfg() {
  var c = powerData().cfg, out = {};
  Object.keys(POWER_CFG_DEFAULTS).forEach(function(k) { out[k] = Number(c[k]) > 0 ? Number(c[k]) : POWER_CFG_DEFAULTS[k]; });
  return out;
}
function powerSetTab(t) {
  if (!POWER_TABS.some(function(x) { return x[0] === t; })) t = 'overview';
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
      out.push({ date: date, from: a, to: b, min: b == null ? null : Math.max(0, b - a), open: b == null, overnight: overnight,
        reports: c.reports, basis: Object.keys(basis), ids: c.ids, note: (ents.find(function(e) { return e.note; }) || {}).note || '' });
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

/* Revenue per scheduled hour, the last 90 days before `asOf`, net of credit notes: what an hour of the plant earns. */
function powerRate(asOf) {
  var to = asOf || localDateStr(), from = isoAddDays(to, -89), cfg = powerCfg();
  var rev = statsInvoices().reduce(function(s, i) { return i.date >= from && i.date <= to ? s + (Number(i.taxableValue) || 0) : s; }, 0);
  var days = statsWorkingDays(from, to);
  if (!(rev > 0) || !days) return { perHour: cfg.rateFallback, measured: false, from: from, to: to };
  return { perHour: rev / (days * (RELAY_GENERAL_OUT - RELAY_GENERAL) / 60), measured: true, from: from, to: to, revenue: rev, days: days };
}
function powerFixedPerMinute(month) {
  var b = costBills().find(function(x) { return x.kind === 'power' && !x.voided && x.month === month && Number(x.fixed) > 0; });
  if (!b) return null;
  var start = month + '-01', days = statsWorkingDays(start, payMonthEnd(start));
  return days ? Number(b.fixed) / (days * (RELAY_GENERAL_OUT - RELAY_GENERAL)) : null;
}

/* What one cut cost, layer by layer. A cut with no time back is costed at the typical length of the cuts that have
   one (ctx.typical, the median), never to the end of the day: 28 Jul's last cut read 640 minutes that way. */
function powerCutCost(cut, ctx) {
  var cfg = ctx.cfg, wins = powerWindows(cut.date);
  var end = cut.to != null ? cut.to : cut.from + (ctx.typical || 0);
  var inside = _powerInside(cut.from, end, wins);
  var ot = _powerInside(cut.from, end, wins.filter(function(w) { return w.kind === 'ot'; }));
  var rec = (S.attendance || {})[cut.date], idle = 0, hands = 0;
  if (rec && rec.marks) Object.keys(rec.marks).forEach(function(id) {
    var mk = rec.marks[id];
    if (!mk || (mk.st !== 'P' && mk.st !== 'H')) return;
    var w = staffById(id);
    var a = mk.inMin != null ? mk.inMin : RELAY_GENERAL, b = mk.outMin != null ? mk.outMin : (mk.st === 'H' ? RELAY_GENERAL + 240 : RELAY_GENERAL_OUT);
    if (b <= a) b += 1440;
    var o = _powerOverlap(cut.from, end, a, b);
    if (o <= 0) return;
    hands++;
    idle += powerHourRate(w, cut.date) * o / 60;
  });
  var lost = ctx.rate.perHour * inside / 60;
  var fpm = powerFixedPerMinute(cut.date.slice(0, 7));
  var fixed = fpm != null ? fpm * inside : 0;
  var restart = inside > 0 ? cfg.restart : 0;
  return { inside: inside, ot: ot, hands: hands, recorded: !!rec, lost: gstRound(lost), idle: gstRound(idle), restart: restart, fixed: gstRound(fixed),
    fixedKnown: fpm != null, total: gstRound(lost + idle + restart + fixed) };
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
  return { recorded: rec.length, of: Object.keys(days).length, gaps: Object.keys(days).filter(function(d) { return !days[d]; }).sort() };
}

/* Runs of recorded working days with no cut, long enough that at the record's own rate some were expected. A day's
   floor can be recorded while its power is not (27 Aug – 15 Sep: attendance every day, no power message or register
   page), so such a run is read as possibly unreported, never as a clean stretch. */
function powerQuietRuns(cuts, first, today, span) {
  var cutDays = {};
  cuts.forEach(function(c) { cutDays[c.date] = true; });
  var gap = {};
  span.gaps.forEach(function(d) { gap[d] = true; });
  var rate = span.recorded ? cuts.length / span.recorded : 0, runs = [], cur = [];
  statsWorkingDayList(first, today).forEach(function(d) {
    if (gap[d]) return;
    if (cutDays[d]) { if (cur.length) runs.push(cur); cur = []; return; }
    cur.push(d);
  });
  if (cur.length) runs.push(cur);
  // Expected at least three cuts at the record's rate: a run that long without one is more likely unreported.
  return runs.filter(function(r) { return rate * r.length >= 3; }).map(function(r) { return { from: r[0], to: r[r.length - 1], days: r.length, expected: rate * r.length }; });
}

/* The whole reading, over the record: every cut with its cost, by month, by hour, the year ahead and the options. */
function powerAnalysis() {
  var cuts = powerCuts(), cfg = powerCfg(), today = localDateStr();
  var rate = powerRate(today), typical = numMedian(cuts.filter(function(c) { return c.min != null; }).map(function(c) { return c.min; })) || 0;
  var ctx = { cfg: cfg, rate: rate, typical: typical };
  cuts.forEach(function(c) { c.cost = powerCutCost(c, ctx); });
  var first = cuts.length ? cuts[0].date : null;
  var months = {};
  cuts.forEach(function(c) {
    var m = c.date.slice(0, 7), e = months[m] || (months[m] = { month: m, cuts: 0, min: 0, open: 0, cost: 0, lost: 0, idle: 0, restart: 0, fixed: 0 });
    e.cuts++; if (c.min != null) e.min += c.min; else e.open++;
    e.cost += c.cost.total; e.lost += c.cost.lost; e.idle += c.cost.idle; e.restart += c.cost.restart; e.fixed += c.cost.fixed;
  });
  var monthList = Object.keys(months).sort().map(function(m) {
    var e = months[m], start = m + '-01', end = payMonthEnd(start);
    if (end > today) end = today;
    if (first && start < first) start = first;
    var rd = powerRecordedDays(start, end);
    e.recorded = rd.recorded; e.of = rd.of; e.perDay = rd.recorded ? e.cuts / rd.recorded : null; e.costPerDay = rd.recorded ? e.cost / rd.recorded : null;
    return e;
  });
  var quiet = first ? powerQuietRuns(cuts, first, today, powerRecordedDays(first, today)) : [];
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
  var from90 = isoAddDays(today, -89), recent = cuts.filter(function(c) { return c.date >= from90; });
  var rd90 = powerRecordedDays(first && first > from90 ? first : from90, today);
  var quietIn90 = 0;
  quiet.forEach(function(q) { if (q.to >= from90) quietIn90 += statsWorkingDays(q.from > from90 ? q.from : from90, q.to); });
  rd90 = { recorded: Math.max(0, rd90.recorded - quietIn90), of: rd90.of, gaps: rd90.gaps, quiet: quietIn90 };
  var yearDays = statsWorkingDays(isoAddDays(today, -364), today);
  var perDayCost = rd90.recorded ? recent.reduce(function(s, c) { return s + c.cost.total; }, 0) / rd90.recorded : null;
  var perDayMin = rd90.recorded ? recent.reduce(function(s, c) { return s + (c.min || 0); }, 0) / rd90.recorded : null;
  // A month holding a run of likely-unreported days is left out of the best and worst: it would read as the best.
  var full = monthList.filter(function(e) {
    return e.recorded >= 10 && e.costPerDay != null && !quiet.some(function(q) { return q.from.slice(0, 7) <= e.month && q.to.slice(0, 7) >= e.month; });
  });
  var lowM = full.slice().sort(function(p, q) { return p.costPerDay - q.costPerDay; })[0] || null, highM = full.slice().sort(function(p, q) { return q.costPerDay - p.costPerDay; })[0] || null;
  var year = perDayCost == null ? null : {
    base: gstRound(perDayCost * yearDays), low: lowM ? gstRound(lowM.costPerDay * yearDays) : null, high: highM ? gstRound(highM.costPerDay * yearDays) : null,
    lowMonth: lowM ? lowM.month : null, highMonth: highM ? highM.month : null,
    hours: perDayMin * yearDays / 60, days: yearDays, recorded: rd90.recorded, of: rd90.of, quiet: rd90.quiet, cuts: recent.length
  };
  // An inverter carries only its hours: the share of dark minutes it would have covered, measured off the cuts.
  var dark = 0, carried = 0;
  cuts.forEach(function(c) { if (c.min == null) return; dark += c.min; carried += Math.min(c.min, cfg.invHours * 60); });
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
      opt('inv', 'Inverter and battery', cfg.invCapexLo, cfg.invCapexHi, invCapture, cfg.invPerHour * year.hours * invCapture, cfg.invYearly, 0,
        'carries ' + formatNum(cfg.invHours, 0) + ' h a cut: ' + Math.round(invCapture * 100) + '% of the dark minutes on record'),
      opt('gen', 'Diesel generator', cfg.genCapexLo, cfg.genCapexHi, cfg.genCapture, cfg.genPerHour * year.hours, cfg.genYearly, 0, 'backs the grid up for any length of cut')
    ];
  }
  var totals = cuts.reduce(function(t, c) {
    t.cuts++; if (c.min != null) t.min += c.min; else t.open++; if (c.overnight) t.overnight++;
    t.cost += c.cost.total; t.lost += c.cost.lost; t.idle += c.cost.idle; t.restart += c.cost.restart; t.fixed += c.cost.fixed;
    if (c.cost.ot) t.inOt++;
    return t;
  }, { cuts: 0, min: 0, open: 0, overnight: 0, cost: 0, lost: 0, idle: 0, restart: 0, fixed: 0, inOt: 0 });
  var span = first ? powerRecordedDays(first, today) : null;
  return { cuts: cuts, months: monthList, bands: bands, hours: hours, year: year, options: options, totals: totals, rate: rate, cfg: cfg,
    first: first, span: span, invCapture: invCapture, load: powerLoad(), typical: typical, quiet: quiet };
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
function renderPower() {
  var el = document.getElementById('powerContent');
  if (!el) return;
  powerData();
  var a = powerAnalysis();
  var h = '<div class="inv-viewtabs" role="tablist" aria-label="Power">' + POWER_TABS.map(function(t) {
    return '<button class="inv-viewtab" role="tab" aria-selected="' + (_powerTab === t[0]) + '" data-action="invPowerTab" data-tab="' + t[0] + '">' + t[1] + '</button>';
  }).join('') + '</div>';
  h += '<div class="inv-toolbar">' + (_powerTab === 'case'
    ? '<button class="inv-btn inv-btn-primary" data-action="invPowerPrint">Print the case</button><button class="inv-btn inv-btn-secondary" data-action="invPowerCfg">Options&rsquo; figures</button>'
    : '<button class="inv-btn inv-btn-primary" data-action="invPowerAddCut">Enter a cut</button>') +
    (_powerTab === 'load' ? '<button class="inv-btn inv-btn-secondary" data-action="invPowerLoadEdit">Edit load</button>' : '') +
    (_powerTab === 'cuts' ? '<button class="inv-btn inv-btn-ghost" data-action="invPowerImport">Import history</button>' : '') + '</div>';
  if (_powerTab === 'cuts') h += powerCutsHtml(a);
  else if (_powerTab === 'load') h += powerLoadHtml(a);
  else if (_powerTab === 'case') h += '<div class="inv-scroll-x" data-power-case-wrap>' + powerCaseHtml(a) + '</div>';
  else h += powerOverviewHtml(a);
  el.innerHTML = h;
  viewTabReveal(el.querySelector('.inv-viewtabs'));
  if (_powerTabMoved) { _powerTabMoved = false; viewTop(); }
  // A case open in the print view follows the data too.
  var body = document.getElementById('invPrintBody'), view = document.getElementById('invPrintView');
  if (body && view && view.classList.contains('inv-print-view-active') && body.querySelector('[data-power-case]')) { body.innerHTML = powerCaseHtml(a); printFit(); }
}

function _powerTile(label, value, sub, tone, key) {
  return '<div class="inv-tile' + (tone ? ' inv-tile-' + tone : '') + '" data-power-tile="' + key + '"><div class="inv-tile-label">' + label + '</div><div class="inv-tile-value">' + value + '</div><div class="inv-tile-sub">' + sub + '</div></div>';
}

function powerOverviewHtml(a) {
  var today = localDateStr(), m = today.slice(0, 7), mm = a.months.find(function(x) { return x.month === m; }) || { cuts: 0, min: 0, open: 0, cost: 0, recorded: powerRecordedDays(m + '-01', today).recorded };
  var L = a.load;
  var h = '<div class="inv-tiles">' +
    _powerTile('Cuts this month', String(mm.cuts), escHtml(powerHours(mm.min) + ' dark' + (mm.open ? ' · ' + mm.open + ' with no time back' : '') + ' · ' + (mm.recorded || 0) + ' days recorded'), mm.cuts ? 'warning' : '', 'month') +
    _powerTile('What they cost', figWrapHtml(formatCurrency(mm.cost)), 'this month, output, idle wages, restarts', mm.cost > 0 ? 'warning' : '', 'cost') +
    _powerTile('A year at this rate', a.year ? figWrapHtml(formatCurrency(a.year.base)) : '&mdash;', a.year ? escHtml('on the last 90 days, ' + a.year.recorded + ' of ' + a.year.of + ' days recorded') : 'no cut on record yet', a.year && a.year.base > 0 ? 'danger' : '', 'year') +
    _powerTile('Load', L.sanctioned ? escHtml(formatNum(L.sanctioned, 0) + ' kVA') : '&mdash;',
      L.pending ? escHtml(formatNum(L.approved, 0) + ' kVA approved, not yet billed · ' + formatCurrency(L.penaltySince) + ' penalty since') : L.sanctioned ? 'as billed' : 'not recorded yet', L.pending ? 'danger' : '', 'load') +
    '</div>';
  h += '<div class="inv-panels"><div class="inv-panel" id="powerMonths"><div class="inv-panel-head"><span class="inv-panel-title">Cuts by month</span></div>' +
    chartBars(a.months.map(function(x) { return { label: billsMonthLabel(x.month), value: x.cuts }; }), { unit: 'count', ariaLabel: 'Cuts by month', emptyText: 'No cut on record' }) +
    '<div class="inv-note">Cuts recorded each month. A month with gaps in the record reads low: the Cuts tab gives each month&rsquo;s recorded days.</div></div>';
  h += '<div class="inv-panel" id="powerHours"><div class="inv-panel-head"><span class="inv-panel-title">When they come</span></div>' +
    chartBars(a.hours.map(function(n, i) { return { label: (i % 12 || 12) + (i < 12 ? 'a' : 'p'), value: n }; }).slice(5, 23), { unit: 'count', ariaLabel: 'Cuts by the hour they began', emptyText: 'No cut on record' }) +
    '<div class="inv-note">By the hour each cut began, 5 AM to 10 PM. ' + escHtml(a.bands.map(function(b) { return b.label + ' ' + b.cuts; }).join(' · ')) + '.</div></div>';
  var raised = todoApp(['powerLoad']);
  h += '<div class="inv-panel inv-panel-flush" id="powerRaised"><div class="inv-panel-head"><span class="inv-panel-title">Raised</span><span class="inv-panel-count">' + raised.length + '</span></div>' +
    (raised.length ? raised.map(function(t) {
      return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title"><span class="inv-dot inv-dot-' + uiTone(t.tone) + '">' + escHtml(t.title) + '</span></span><span class="inv-row-meta">' + escHtml(t.sub || '') + '</span></span></div>';
    }).join('') : '<div class="inv-empty">Nothing raised about power.</div>') + '</div></div>';
  return h;
}

function powerCutsHtml(a) {
  if (!a.cuts.length) return '<div class="inv-empty">No power cut on record. Cuts come in from the register photos and the WhatsApp messages Production reads, or Enter a cut; the history from soma-internal&rsquo;s log comes in through Import history.</div>';
  var h = '<div class="inv-panels">';
  a.months.slice().reverse().forEach(function(m) {
    var list = a.cuts.filter(function(c) { return c.date.slice(0, 7) === m.month; }).reverse();
    var rows = list.map(function(c) {
      var k = c.cost, lay = [];
      if (k.lost) lay.push('output ' + formatCurrency(k.lost));
      if (k.idle) lay.push('idle wages ' + formatCurrency(k.idle) + ' (' + k.hands + ' hand' + (k.hands === 1 ? '' : 's') + ')');
      if (k.restart) lay.push('restart ' + formatCurrency(k.restart));
      if (k.fixed) lay.push('fixed charge ' + formatCurrency(k.fixed));
      var when = powerClock(c.from) + ' – ' + (c.to != null ? powerClock(c.to) + (c.overnight ? ' next day' : '') : 'not back');
      var tone = c.open ? 'warning' : k.inside ? 'danger' : 'neutral';
      return '<div class="inv-row inv-row-2" data-power-cut="' + escHtml(c.date + '|' + c.from) + '"><span class="inv-row-main"><span class="inv-row-title">' +
        escHtml(formatDate(c.date) + ' · ' + when) + '</span><span class="inv-row-meta inv-row-wrap">' +
        escHtml([powerDur(c.min), k.inside ? powerDur(k.inside) + ' in working hours' + (k.ot ? ', ' + powerDur(k.ot) + ' of it overtime' : '') : 'outside working hours', lay.join(' · '), c.reports > 1 ? c.reports + ' reports' : ''].filter(Boolean).join(' · ')) +
        '</span></span><span class="inv-row-end"><span class="inv-num">' + formatCurrency(k.total) + '</span><span class="inv-dot inv-dot-' + tone + '">' + (c.open ? 'No time back' : k.inside ? 'Working hours' : 'Off hours') + '</span></span></div>';
    });
    h += '<div class="inv-panel inv-panel-flush" data-power-month="' + m.month + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(billsMonthLabel(m.month)) +
      ' <span class="inv-panel-count">' + m.cuts + '</span></span></div>' +
      '<div class="inv-panel-body inv-note">' + escHtml(powerHours(m.min) + ' dark' + (m.open ? ', ' + m.open + ' with no time back' : '') + ' · ' + formatCurrency(m.cost) + ' · ' +
        m.recorded + ' of ' + m.of + ' working days recorded' + (m.perDay != null ? ' · ' + formatNum(m.perDay, 2) + ' cuts a recorded day' : '')) + '</div>' +
      uiMoreHtml('power-' + m.month, rows, { noun: 'cuts' }) + '</div>';
  });
  return h + '</div>';
}

function powerLoadHtml(a) {
  var L = a.load;
  var h = '<div class="inv-panels"><div class="inv-panel inv-panel-flush" id="powerLoad"><div class="inv-panel-head"><span class="inv-panel-title">The connection</span></div>';
  var row = function(label, value, end) { return '<div class="inv-row"><span class="inv-row-main"><span class="inv-row-title">' + label + '</span></span><span class="inv-row-end">' + value + (end || '') + '</span></div>'; };
  h += row('Load as billed', '<span class="inv-num">' + (L.sanctioned ? escHtml(formatNum(L.sanctioned, 0) + ' kVA') : '&mdash;') + '</span>', L.billedOn ? '<span class="inv-row-meta">' + escHtml(billsMonthLabel(L.billedOn) + ' bill') + '</span>' : '');
  h += row('Load approved', '<span class="inv-num">' + (L.approved ? escHtml(formatNum(L.approved, 0) + ' kVA') : '&mdash;') + '</span>', L.approvedOn ? '<span class="inv-row-meta">' + escHtml('since ' + formatDate(L.approvedOn)) + '</span>' : '');
  h += row('Peak drawn', '<span class="inv-num">' + (L.peak ? escHtml(formatNum(L.peak, 2) + ' kVA') : '&mdash;') + '</span>', L.peakMonth ? '<span class="inv-row-meta">' + escHtml(billsMonthLabel(L.peakMonth) + ' bill') + '</span>' : '');
  if (L.pending) h += '<div class="inv-panel-body"><div class="inv-callout inv-callout-danger">' + escHtml(formatNum(L.approved, 0) + ' kVA was approved on ' + formatDate(L.approvedOn) + ' and the bill still charges for ' + formatNum(L.sanctioned, 0) +
    ' kVA. Over-limit penalty on the bills since: ' + formatCurrency(L.penaltySince) + '. Chase JBVNL' + (L.ref ? ' (ref ' + L.ref + ')' : '') + '.') + '</div></div>';
  if (L.note) h += '<div class="inv-panel-body inv-note">' + escHtml(L.note) + '</div>';
  h += '</div>';
  h += '<div class="inv-panel inv-panel-flush" id="powerBills"><div class="inv-panel-head"><span class="inv-panel-title">Electricity bills</span><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPowerBillsGo">Add a bill</button></div>';
  if (!L.bills.length) h += '<div class="inv-empty">No electricity bill entered. Bills are added in Finance &rarr; Bills &amp; notes; their details (units, peak, charges) are set here.</div>';
  L.bills.slice().reverse().forEach(function(b) {
    var bits = [b.kwh ? formatNum(b.kwh, 0) + ' kWh' : (b.units ? formatNum(b.units, 0) + ' units' : ''), b.kvah ? formatNum(b.kvah, 0) + ' kVAh' : '',
      b.kwh && b.kvah ? 'PF ' + formatNum(b.kwh / b.kvah, 3) : '', b.md ? 'peak ' + formatNum(b.md, 2) + ' kVA' : '', b.kvaBilled ? 'billed at ' + formatNum(b.kvaBilled, 0) + ' kVA' : '',
      b.fixed ? 'fixed ' + formatCurrency(b.fixed) : '', b.energy ? 'energy ' + formatCurrency(b.energy) : '', b.fca ? 'fuel ' + formatCurrency(b.fca) : '', b.duty ? 'duty ' + formatCurrency(b.duty) : '',
      b.penalty ? 'penalty ' + formatCurrency(b.penalty) : '', b.arrears ? 'arrears ' + formatCurrency(b.arrears) : ''].filter(Boolean);
    h += '<div class="inv-row inv-row-2" data-power-bill="' + escHtml(b.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(billsMonthLabel(b.month)) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(bits.length ? bits.join(' · ') : 'amount only: set its details') + '</span></span>' +
      '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(b.amount) + '</span><button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPowerBillEdit" data-id="' + escHtml(b.id) + '">Details</button></span></div>';
  });
  h += '</div>';
  var pts = L.bills.filter(function(b) { return b.penalty != null || b.md != null; });
  if (pts.length >= 2) h += '<div class="inv-panel" id="powerPenalty"><div class="inv-panel-head"><span class="inv-panel-title">Over-limit penalty by bill</span></div>' +
    chartBars(pts.map(function(b) { return { label: billsMonthLabel(b.month), value: Number(b.penalty) || 0 }; }), { ariaLabel: 'Over-limit penalty by bill' }) + '</div>';
  return h + '</div>';
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
    (t.overnight ? ' (' + t.overnight + ' ran overnight)' : '') + '. Together they cost ' + formatCurrency(t.cost) + ': output at stake ' + formatCurrency(t.lost) +
    ', wages paid while the line stood ' + formatCurrency(t.idle) + ', restarts ' + formatCurrency(t.restart) + (t.fixed ? ', fixed charge carried by no output ' + formatCurrency(t.fixed) : '') + '.'));
  if (y) h += _pcP(escHtml('At the last 90 days’ rate (' + y.cuts + ' cuts on ' + y.recorded + ' recorded days' + (y.quiet ? ', leaving out ' + y.quiet + ' days whose power was likely not reported' : '') + ') a year costs ' + formatCurrency(y.base) +
    (y.low != null ? '; the complete months ran from ' + formatCurrency(y.low) + ' a year (' + billsMonthLabel(y.lowMonth) + ') to ' + formatCurrency(y.high) + ' (' + billsMonthLabel(y.highMonth) + ')' : '') + ', for about ' + formatNum(y.hours, 0) + ' dark hours.'));
  if (L.pending) h += _pcP(escHtml('The connection is billed at ' + formatNum(L.sanctioned, 0) + ' kVA though ' + formatNum(L.approved, 0) + ' kVA was approved on ' + formatDate(L.approvedOn) +
    '; the over-limit penalty on the bills since is ' + formatCurrency(L.penaltySince) + (L.peak ? ', with a peak of ' + formatNum(L.peak, 2) + ' kVA' : '') + '.'));
  if (bestOpt) h += _pcP(escHtml('Of the three options, ' + bestOpt.label + ' pays back soonest: ' + _pcMonths(bestOpt.payLo) + ' to ' + _pcMonths(bestOpt.payHi) + '.'));

  // 2. The record
  h += _pcSec(2, 'The record, month by month');
  h += _pcTable([['Month'], ['Cuts', 1], ['Dark', 1], ['No time back', 1], ['Days recorded', 1], ['Cuts a recorded day', 1], ['Cost', 1]],
    a.months.map(function(m) { return [escHtml(billsMonthLabel(m.month)), m.cuts, escHtml(powerHours(m.min)), m.open || '', m.recorded + ' of ' + m.of, m.perDay != null ? formatNum(m.perDay, 2) : '—', formatCurrency(m.cost)]; }),
    ['Total', t.cuts, escHtml(powerHours(t.min)), t.open || '', a.span.recorded + ' of ' + a.span.of, a.span.recorded ? formatNum(t.cuts / a.span.recorded, 2) : '—', formatCurrency(t.cost)]);
  if (a.span.gaps.length) h += _pcP(escHtml(a.span.gaps.length + ' working day' + (a.span.gaps.length === 1 ? '' : 's') + ' since the first cut carry no record at all (no production, no attendance, no power entry): a gap in the record, not days without cuts. Rates here are per recorded day.' +
    ' The longest run: ' + _powerLongestGap(a.span.gaps) + '.'));

  if (a.quiet.length) h += _pcP(escHtml('Recorded days with no cut, longer than the record makes likely: ' + a.quiet.map(function(q) {
    return formatDate(q.from) + ' – ' + formatDate(q.to) + ' (' + q.days + ' days, ~' + formatNum(q.expected, 0) + ' cuts expected)';
  }).join('; ') + '. The floor was recorded on those days but its power may not have been: read as possibly unreported, never as clean. The month rates above include them, so those months read low; the year ahead leaves them out.'));

  // 3. When
  h += _pcSec(3, 'When they come');
  h += _pcTable([['Began'], ['Cuts', 1], ['Share', 1], ['Dark', 1]], a.bands.map(function(b) { return [escHtml(b.label), b.cuts, Math.round(b.cuts / t.cuts * 100) + '%', escHtml(powerHours(b.min))]; }));
  var noon = a.bands[2];
  h += _pcP(escHtml(noon.cuts + ' of ' + t.cuts + ' cuts (' + Math.round(noon.cuts / t.cuts * 100) + '%) began between noon and 2 PM, two hours of the eight and a half worked: the midday load-shed the log has named since June. ' + t.inOt + ' cut' + (t.inOt === 1 ? '' : 's') + ' fell in paid overtime.'));

  // 4. What a cut costs
  h += _pcSec(4, 'What a cut costs');
  h += _pcTable([['Layer'], ['How it is worked out'], ['On record', 1]], [
    ['Output at stake', escHtml('minutes in a working window × ' + formatCurrency(a.rate.perHour) + ' an hour ' + (a.rate.measured ? '(revenue net of credit notes over ' + a.rate.days + ' working days to ' + formatDate(a.rate.to) + ', per 8½-hour shift)' : '(the case’s estimate: no invoices in the last 90 days)')), formatCurrency(t.lost)],
    ['Wages paid idle', 'every hand marked present whose own day covers the cut, at their hour rate; only on days with attendance recorded', formatCurrency(t.idle)],
    ['Restarts', escHtml(formatCurrency(a.cfg.restart) + ' a cut in a working window: bath and line back to work'), formatCurrency(t.restart)],
    ['Fixed charge, dark', 'the month’s fixed/demand charge over its scheduled minutes, per dark working minute; only where a bill carries its fixed charge', formatCurrency(t.fixed)]
  ], ['Total', '', formatCurrency(t.cost)]);
  var top = a.cuts.slice().sort(function(p, q) { return q.cost.total - p.cost.total; }).slice(0, 10);
  h += _pcP('The ten costliest:');
  h += _pcTable([['Date'], ['Cut'], ['In working hours', 1], ['Idle hands', 1], ['Cost', 1]], top.map(function(c) {
    return [escHtml(formatDate(c.date)), escHtml(powerClock(c.from) + ' – ' + (c.to != null ? powerClock(c.to) + (c.overnight ? ' next day' : '') : 'not back')), escHtml(powerDur(c.cost.inside)), c.cost.hands || '', formatCurrency(c.cost.total)];
  }));

  // 5. The year ahead
  h += _pcSec(5, 'A year at this rate');
  if (y) h += _pcTable([['Reading'], ['A year', 1]], [
    ['The best complete month' + (y.lowMonth ? ' (' + escHtml(billsMonthLabel(y.lowMonth)) + ')' : ''), y.low != null ? formatCurrency(y.low) : '—'],
    ['The last 90 days' + (y.quiet ? ', less ' + y.quiet + ' likely-unreported days' : ''), formatCurrency(y.base)],
    ['The worst complete month' + (y.highMonth ? ' (' + escHtml(billsMonthLabel(y.highMonth)) + ')' : ''), y.high != null ? formatCurrency(y.high) : '—']
  ]) + _pcP(escHtml('A complete month has 10 or more recorded working days and no run of likely-unreported days; the last 90 days can sit outside their range when it holds a month that is not complete. ' + y.days + ' working days a year.'));
  else h += _pcP('Not enough record in the last 90 days to read a year.');

  // 6. The connection
  h += _pcSec(6, 'The connection');
  h += _pcTable([['Month'], ['Billed at', 1], ['Peak', 1], ['Penalty', 1], ['Fixed', 1], ['Bill', 1]], L.bills.map(function(b) {
    return [escHtml(billsMonthLabel(b.month)), b.kvaBilled ? formatNum(b.kvaBilled, 0) + ' kVA' : '—', b.md ? formatNum(b.md, 2) + ' kVA' : '—', b.penalty != null ? formatCurrency(b.penalty) : '—', b.fixed ? formatCurrency(b.fixed) : '—', formatCurrency(b.amount)];
  }));
  h += _pcP(escHtml(L.approved ? (L.pending ? formatNum(L.approved, 0) + ' kVA approved on ' + formatDate(L.approvedOn) + ', not yet on the bill: ' + formatCurrency(L.penaltySince) + ' of over-limit penalty since.' : formatNum(L.approved, 0) + ' kVA approved' + (L.sanctioned >= L.approved ? ' and billed.' : '.')) : 'No load recorded: Power → Load & bills → Edit load.') +
    ' Any backup or new connection is sized to this load: the options below assume the 50 kVA the plant draws.');

  // 7. The options
  h += _pcSec(7, 'The options');
  if (a.options) {
    h += _pcTable([['Option'], ['One-time', 1], ['Covers', 1], ['Running a year', 1], ['Gain a year', 1], ['Pays back', 1]], a.options.map(function(o) {
      return [escHtml(o.label) + '<br><span class="inv-sr-void">' + escHtml(o.note) + '</span>', escHtml(_pcL(o.capLo) + '–' + _pcL(o.capHi)), Math.round(o.capture * 100) + '%',
        formatCurrency(o.running + o.yearly), formatCurrency(o.gain), escHtml(o.payLo != null ? _pcMonths(o.payLo) + ' – ' + _pcMonths(o.payHi) : 'does not pay back')];
    }));
    h += _pcP(escHtml('Gain a year = the year at this rate × the share an option covers' + ' + TSUISL’s tariff saving − running and upkeep. The one-time figures and running costs are the 30 May case’s estimates until a quote replaces them (Options’ figures).'));
  } else h += _pcP('The options are read once there is a year to read against.');

  // 8. Recommendation
  h += _pcSec(8, 'Recommendation');
  var ts = (a.options || []).find(function(o) { return o.key === 'ts'; }), inv = (a.options || []).find(function(o) { return o.key === 'inv'; });
  h += _pcP(escHtml('The 30 May case stands on the record: pursue the TSUISL switch first, since it is the only option that replaces the JBVNL feeder rather than backing it up' +
    (ts && ts.payLo != null ? ' (paying back in ' + _pcMonths(ts.payLo) + ' to ' + _pcMonths(ts.payHi) + ' at today’s rate)' : '') + ', and quote an inverter in parallel as Plan B' +
    (inv ? ' (it would have carried ' + Math.round(a.invCapture * 100) + '% of the dark minutes on record)' : '') + '. ' +
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
    'Output recovered by staying late (11 Jun: two hands to ~7 PM) is still read as at stake: the figure is what a cut puts at risk, not what is certainly lost.',
    'Bath chemistry shocked by repeated restarts, and single-phase faults (22 Jun) beyond their hours: not yet measurable.',
    t.open + ' cut' + (t.open === 1 ? '' : 's') + ' with no time back recorded are costed at the typical length of those that have one (' + powerDur(a.typical) + ').',
    'Days with no record at all are gaps, never days without cuts.'
  ].map(function(x) { return '<li>' + escHtml(x) + '</li>'; }).join('') + '</ul>';
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
  prodOpenHand(null);
  if (_prodHand) { _prodHand.kind = 'downtime'; renderProduction(); }
}
/* The history from soma-internal, one file: its cuts as a `sep-production` file (merged by id into Production), and
   under `power` the electricity bills' details by month and the load. A detail fills a bill of that month only where the
   bill has none: a figure typed here is never overwritten. A month with no bill in the app is counted, never invented. */
function powerImport() {
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
  var res = { cuts: null, details: 0, noBill: [], load: false };
  if (obj.format === 'sep-production') res.cuts = prodMergeImport(obj, name);
  var pw = obj.power || (obj.format === 'sep-power' ? obj : null);
  if (pw && pw.bills) Object.keys(pw.bills).forEach(function(m) {
    var b = costBills().find(function(x) { return x.kind === 'power' && !x.voided && x.month === m; });
    var fb = pw.bills[m];
    if (!b && Number(fb.amount) > 0 && /^\d{4}-\d{2}$/.test(m)) {
      // The file is the record of a bill the app does not hold: added with its amount, never made up from details.
      b = { id: 'CB-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'power', month: m, amount: gstRound(Number(fb.amount)), units: null,
        note: fb.note || 'From the soma-internal electricity bills record', at: Date.now() };
      costBills().push(b);
      res.bills = (res.bills || 0) + 1;
    }
    if (!b) { res.noBill.push(m); return; }
    POWER_BILL_FIELDS.forEach(function(f) { var v = Number(pw.bills[m][f[0]]); if (v > 0 && !(Number(b[f[0]]) > 0)) { b[f[0]] = v; res.details++; } });
  });
  var p = powerData();
  if (pw && pw.load && !(p.load.sanctioned || p.load.approved)) { p.load = Object.assign({}, pw.load, { at: Date.now() }); res.load = true; }
  if (!(res.cuts && res.cuts.added) && !res.details && !res.load && !res.bills) { uiAlert({ title: 'Nothing imported', body: 'The file holds no power cuts or bill details this book does not already have.' + (res.noBill.length ? ' Bills not in the app for: ' + res.noBill.join(', ') + '.' : '') }); return res; }
  saveState();
  renderPower();
  var c = res.cuts || {};
  showToast([c.added ? c.added + ' cut' + (c.added === 1 ? '' : 's') + ' added' : c.ok ? 'no new cuts' : '', res.details ? res.details + ' bill detail' + (res.details === 1 ? '' : 's') + ' filled' : '',
    res.bills ? res.bills + ' bill' + (res.bills === 1 ? '' : 's') + ' added' : '', res.noBill.length ? res.noBill.length + ' month' + (res.noBill.length === 1 ? '' : 's') + ' with no bill in the app' : ''].filter(Boolean).join(' · '));
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
    case 'invPowerBillsGo': todoGo({ kind: 'bills' }); return true;
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
  return [{ key: 'powerLoad', rule: 'powerLoad', tone: L.penaltySince > 0 ? 'red' : 'amber',
    title: formatNum(L.approved, 0) + ' kVA approved, still billed at ' + formatNum(L.sanctioned, 0) + ' kVA',
    sub: 'Approved ' + formatDate(L.approvedOn) + ' · ' + formatCurrency(L.penaltySince) + ' over-limit penalty on the bills since',
    why: 'Power · the connection', facts: [['Approved', formatNum(L.approved, 0) + ' kVA, ' + formatDate(L.approvedOn)], ['Billed at', formatNum(L.sanctioned, 0) + ' kVA'], ['Penalty since', formatCurrency(L.penaltySince)]]
      .concat(L.peak ? [['Peak drawn', formatNum(L.peak, 2) + ' kVA']] : []),
    clears: 'Clears itself when a bill is billed at the approved load, or the load record says it is.', go: { kind: 'power', tab: 'load' }, goLabel: 'Open Power',
    sig: L.sanctioned + '|' + L.approved + '|' + L.penaltySince }];
};
