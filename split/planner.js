/* ===== THE PLANNER — the plant, certification, staff, clients and a loan, simulated (docs/PLANNER.md) =====
   Insights → Planner (owner, 6 Oct 2026). A scenario is a set of moves with their months; the engine builds each month from
   the bottom up, so every figure adds up: each part's kilos go to its line, the line plates them in rounds within the hours it
   can run less the power cuts, fed by pickling; the month's kilos × each part's rate is the revenue; the cost lines follow the
   kilos, the hours and the hires; margin, the loan and the spend give the cash. A move changes an input, never a total.

   NOTHING ABOUT THE SHOP'S CLIENTS, PEOPLE OR FIGURES IS IN THIS FILE. The baseline is read from the book on the device, over the last three full months,
   by the functions the book's own screens use (statsInvoices, lineWeightKg, liveCost, labourForRange, the Power tab's cuts, the
   production register, the bank statement). The catalogue below (the upgrade trees, the tech tree, the roles) is generic: its
   costs are starting estimates the owner can change, and every assumed figure says so where it is shown.

   A scenario never writes the book: it is its own record (S.planner.scenarios). The registers (machines, the CQI-11 checklist,
   lenders, rates heard, work held back) are real records, in the change log, retired with a reason, never deleted. */

var PLN_N = 24, PLN_TRIALS = 600, PLN_TOP_PARTS = 8;
var PLN_LINE_IDS = ['vat-a1', 'vat-a2', 'barrel'];
// What a line does when nothing measures it: assumed, and said.
var PLN_LINE_ASSUMED = { 'vat-a1': { kgRound: 80, every: 18 }, 'vat-a2': { kgRound: 75, every: 30 }, barrel: { kgRound: 60, every: 40 } };
// The hours a line can run in each window: the general shift (8:30–5:00 less lunch), the morning block (6:00–8:30), the
// evening (5–8 PM), a night shift (8 PM – 4 AM) only with a night crew.
var PLN_SHIFT = { general: 8, morning: 2.5, evening: 3, night: 8 };
var PLN_CFG_DEFAULTS = { pickKgH: null, otLineHour: 260, powerFixed: 15000, cash: null, lines: {}, costs: {} };
var PLN_GOALS = [
  { id: 'easy', label: 'Easy', cqi: 11, at: 23, margin: null, floor: 0, say: 'CQI-11 within a year, and cash never below zero' },
  { id: 'normal', label: 'Normal', cqi: 11, at: 23, marginUp: 45000, floor: 0, say: 'CQI-11 within a year, the margin up ₹45k a month by the second year’s end, cash never below zero' },
  { id: 'hard', label: 'Hard', cqi: 11, at: 23, marginUp: 95000, floor: 0, say: 'CQI-11 within a year, the margin up ₹95k a month by the second year’s end, cash never below zero' }
];

/* ---------- The catalogue: generic, its costs the owner's to change (cfg.costs) ---------- */
var PLN_STATIONS = [
  { id: 'pick', name: 'Pickling', levels: [{ t: 'As it runs' },
    { id: 'pickAcid', t: 'Acid recovery and fume hood', cost: 120000, fx: { chemSave: 6000 }, say: '₹6,000 a month less acid bought (estimate)' },
    { id: 'pick4', t: 'A fourth tank', cost: 150000, fx: { pickKgH: 140 }, say: 'pickling 140 kg an hour faster' }] },
  { id: 'vat-a1', name: 'VAT A1', levels: [{ t: 'As it runs' },
    { id: 'a1Log', t: 'Rectifier and temperature logged', cost: 60000, say: 'the bath’s records keep themselves (bath analysis needs them)' },
    { id: 'a1Racks', t: 'Two more racks a round', cost: 100000, fx: { line: 'vat-a1', kgRound: 12 }, say: '12 kg more a round' }] },
  { id: 'vat-a2', name: 'VAT A2', levels: [{ t: 'As it runs' },
    { id: 'a2Reline', t: 'Tank repaired or relined', cost: 80000, fixes: 'vat-a2', say: 'the tank’s risk on the machine register goes' },
    { id: 'a2Rect', t: '1,000 A rectifier', cost: 180000, fx: { line: 'vat-a2', every: -6 }, say: 'a round 6 minutes sooner' }] },
  { id: 'barrel', name: 'Barrel', levels: [{ t: 'As it runs' },
    { id: 'barrelFix', t: 'Barrel overhaul', cost: 45000, fixes: 'barrel', say: 'the drive’s risk on the machine register goes' },
    { id: 'barrel2', t: 'A second barrel', cost: 350000, fx: { line: 'barrel', kgRound: 60 }, needs: ['load50'], say: '60 kg more a load; needs the bigger load on the bill' }] },
  { id: 'lab', name: 'Lab', levels: [{ t: 'Nothing yet' },
    { id: 'lab1', t: 'Balance, glassware, Hull cell', cost: 30000, say: 'for daily bath analysis' },
    { id: 'lab2', t: 'Thickness gauge, salt spray', cost: 140000, say: 'a test report with each batch' },
    { id: 'lab3', t: 'XRF analyser', cost: 2000000, say: 'for zinc-nickel' }] },
  { id: 'oven', name: 'Bake oven', levels: [{ t: 'None' },
    { id: 'oven1', t: 'Oven with recorder', cost: 150000, fx: { powerKg: 0.05 }, say: 'hydrogen relief for hard bolts; ₹0.05/kg more power' }] },
  { id: 'power', name: 'Power', levels: [{ t: 'As it runs' },
    { id: 'load50', t: 'The approved load on the bill', cost: 0, fx: { powerSave: 5000 }, say: 'an excess-load charge on the bill stops (₹5,000 a month, an estimate to set)' },
    { id: 'inverter', t: 'Inverter', cost: 300000, fx: { cutCover: 0.85 }, say: 'carries 85% of the cut minutes in working hours' },
    { id: 'genset', t: 'Generator', cost: 600000, fx: { cutCover: 1, gensetRun: 4000 }, say: 'every cut covered, nights too; ₹4,000 a month diesel' }] },
  { id: 'etp', name: 'Effluent', levels: [{ t: 'As it runs' },
    { id: 'etp1', t: 'Sludge drying bed', cost: 100000, fixes: 'etp', say: 'the effluent risk on the machine register goes' }] }
];
var PLN_TECH = [
  { id: 'docs', tier: 0, t: 'FMEA, control plan, records', cost: 20000, months: 1, say: 'the app keeps the records' },
  { id: 'course', tier: 0, t: 'CQI-11 auditor course', cost: 15000, months: 1, say: 'two days online' },
  { id: 'bath', tier: 1, t: 'Daily bath analysis', needs: ['lab1', 'labHand', 'a1Log'], months: 1, say: 'zinc, pH, Hull cell, every shift' },
  { id: 'test', tier: 1, t: 'Thickness and salt-spray tests', needs: ['lab2'], months: 1, say: 'a report with each batch' },
  { id: 'trival', tier: 1, t: 'Trivalent passivation', cost: 50000, needs: ['bath'], months: 2, fx: { chemKg: 0.08 }, say: '₹0.08/kg more chemicals' },
  { id: 'cqi', tier: 2, t: 'CQI-11 self-assessed', needs: ['docs', 'course', 'bath', 'test', 'specialist'], months: 5, say: 'five months of records read back' },
  { id: 'iso', tier: 2, t: 'ISO 9001', cost: 60000, needs: ['docs'], months: 4, say: 'what an OEM asks of a Tier 2' },
  { id: 'oem', tier: 3, t: 'Approved plating source', needs: ['iso', 'trival', 'cqi'], months: 3, say: 'opens work held back for approval (Clients)' },
  { id: 'iatf', tier: 4, t: 'IATF 16949', cost: 300000, needs: ['oem'], months: 12, say: 'twelve months of data first' },
  { id: 'zn', tier: 4, t: 'Zinc-nickel line', cost: 1500000, needs: ['lab3', 'cqi'], months: 4, say: 'opens zinc-nickel work (Clients)' }
];
var PLN_ROLES = [
  { id: 'specialist', t: 'Plating specialist, 5 years', run: 35000, say: 'CQI-11 asks for one on site, full time' },
  { id: 'promote', t: 'Promote and train the supervisor', run: 8000, p: 0.6, as: 'specialist', say: 'an auditor may not accept him: the chance is yours to set' },
  { id: 'labHand', t: 'Lab hand', run: 12000, say: 'bath analysis every shift' },
  { id: 'turnHand', t: 'Turnaround hand', run: 14000, say: 'jobs back in two days (work held back for turnaround)' },
  { id: 'nightCrew', t: 'Night crew, 8 PM – 4 AM', run: 95000, needs: ['inverter|genset'], fx: { night: true }, say: '8 more hours a line a night; needs backup power' },
  { id: 'skill', t: 'Multi-skill training', cost: 20000, fx: { otSave: 8000 }, say: 'EXTRA hours down ₹8,000 a month (estimate)' }
];
var PLN_HELD_WHY = { cert: 'Certificates', turnaround: 'Turnaround', approval: 'Approval as a plating source', other: 'Other' };
var PLN_HELD_NEEDS = { cert: ['cqi'], turnaround: ['turnHand'], approval: ['oem'], other: [] };
var PLN_MACHINE_STATES = [['good', 'Good', 'ok'], ['fair', 'Fair', 'neutral'], ['ageing', 'Ageing', 'warning'], ['needs', 'Needs work', 'danger']];
var PLN_CHECK_STATUS = [['in', 'In place', 'ok'], ['partly', 'Partly', 'warning'], ['missing', 'Missing', 'danger']];
var PLN_LENDER_STATUS = [['offered', 'Offered'], ['asked', 'Asked'], ['agreed', 'Agreed'], ['declined', 'Declined']];
// The CQI-11 self-assessment as the standard groups it; the owner fills status, cost, owner and evidence (the AIAG manual
// is the source: these are the sections, not its words).
var PLN_CHECK_SEED = [
  ['1.1', 'A qualified plating specialist on site'], ['1.2', 'Advanced quality planning for each new part'], ['1.3', 'FMEA kept up to date'],
  ['1.4', 'Process and control plans'], ['1.5', 'Records kept and readable'], ['1.6', 'Internal audits of the process'],
  ['2.1', 'Responsibilities on the floor'], ['2.2', 'Training records'], ['2.3', 'Work instructions at each station'],
  ['3.1', 'Bath analysis on a schedule'], ['3.2', 'Thickness checked and recorded'], ['3.3', 'Salt-spray testing'], ['3.4', 'Hydrogen relief baking, where the part needs it'],
  ['4.1', 'Equipment: rectifiers, temperature, agitation monitored'], ['4.2', 'Calibration of the instruments'], ['4.3', 'Preventive maintenance'],
  ['A', 'Process table A: zinc plating, the bath’s limits']];

/* ---------- The store ---------- */
function plnData() {
  if (!S.planner || typeof S.planner !== 'object' || Array.isArray(S.planner)) S.planner = {};
  var p = S.planner;
  if (!p.cfg || typeof p.cfg !== 'object') p.cfg = {};
  ['machines', 'checklist', 'lenders', 'heard', 'heldBack', 'scenarios'].forEach(function(k) { if (!Array.isArray(p[k])) p[k] = []; });
  return p;
}
/* Read without writing (drawing never changes the book). */
function plnRead() { return S && S.planner && typeof S.planner === 'object' ? S.planner : {}; }
function plnList(k) { var p = plnRead(); return Array.isArray(p[k]) ? p[k] : []; }
function plnLive(k) { return plnList(k).filter(function(r) { return r && !r.retiredAt; }); }
function plnCfg() {
  var c = plnRead().cfg || {}, o = Object.assign({}, PLN_CFG_DEFAULTS);
  Object.keys(c).forEach(function(k) { if (c[k] !== '' && c[k] != null) o[k] = c[k]; });
  o.lines = c.lines || {}; o.costs = c.costs || {};
  return o;
}
function plnId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function plnUpgradeCost(lv) { var c = plnCfg().costs[lv.id]; return c != null && c !== '' && isFinite(+c) ? +c : (lv.cost || 0); }
function plnTechCost(t) { var c = plnCfg().costs[t.id]; return c != null && c !== '' && isFinite(+c) ? +c : (t.cost || 0); }

/* ---------- The baseline, read from the book ---------- */
/* The last three full months before this one. */
function plnPeriod() {
  var today = localDateStr(), first = today.slice(0, 8) + '01';
  var to = isoAddDays(first, -1), d = new Date(first + 'T00:00:00');
  d.setMonth(d.getMonth() - 3);
  return { from: isoOf(d), to: to, months: 3 };
}
var _plnBase = null;
function plnBaseKey() {
  var pr = S.production && Array.isArray(S.production.entries) ? S.production.entries.length : 0;
  return [plnPeriod().from, typeof _bookWrites !== 'undefined' ? _bookWrites : 0, (S.invoices || []).length, (S.creditNotes || []).length, pr, (S.costBills || []).length, ((S.bank || {}).rows || []).length,
    Object.keys(S.attendance || {}).length, ((S.stock || {}).entries || []).length, JSON.stringify(plnRead().cfg || {})].join('|');
}
/* Rounds a day and minutes between them on a line, from the production register's rounds (days with 10+ rounds). */
function plnClock(t) {
  var m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(String(t || ''));
  if (!m) return null;
  var h = +m[1], mi = +m[2], ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + mi;
}
function plnRegisterCadence(from, to) {
  var days = {};
  ((S.production && S.production.entries) || []).forEach(function(e) {
    if (!e || e.kind !== 'plated' || e.voidedAt || e.basis !== 'register' || !e.line || !Array.isArray(e.rounds) || e.date < from || e.date > to) return;
    var k = e.date + '|' + e.line, d = days[k] || (days[k] = { line: e.line, times: {} });
    e.rounds.forEach(function(r) { var t = plnClock(r.time); if (t != null) d.times[t] = 1; });
  });
  var by = {};
  Object.keys(days).forEach(function(k) {
    var d = days[k], ts = Object.keys(d.times).map(Number).sort(function(a, b) { return a - b; });
    if (ts.length < 10) return;
    var span = ts[ts.length - 1] - ts[0];
    (by[d.line] = by[d.line] || []).push({ n: ts.length, every: span / (ts.length - 1) });
  });
  var out = {};
  Object.keys(by).forEach(function(l) {
    if (by[l].length < 3) return;
    out[l] = { days: by[l].length, rounds: numMedian(by[l].map(function(x) { return x.n; })), every: numMedian(by[l].map(function(x) { return x.every; })) };
  });
  return out;
}
/* A part's key, the same on the invoice and the floor: its number or size and its gauge (cpPartIdentity, Performance's own). */
function plnPartKey(partNumber, desc, gauge) {
  var id = cpPartIdentity(partNumber || '', desc || ''), g = gauge || id.gauge;
  return (id.base || rateKey(partNumber || desc)) + (g ? '|' + g : '');
}
/* Each part's usual line and each client's, from plated entries whose line was written or set, by distinct days: a part runs
   on its own line where the record has it, else on its client's. */
function plnClientLines() {
  var days = {}, parts = {};
  var add = function(map, k, e) { var c = map[k] || (map[k] = {}); (c[e.line] = c[e.line] || {})[e.date] = 1; };
  ((S.production && S.production.entries) || []).forEach(function(e) {
    if (!e || e.kind !== 'plated' || e.voidedAt || e.clientId == null || !e.line || (e.lineSrc !== 'written' && e.lineSrc !== 'set' && e.basis !== 'register')) return;
    add(days, e.clientId, e);
    if (e.partNumber || e.part) add(parts, e.clientId + '|' + plnPartKey(e.partNumber || e.part, e.part || '', e.gauge), e);
  });
  var best = function(map) {
    var out = {};
    Object.keys(map).forEach(function(k) {
      var b = null, bn = 0;
      Object.keys(map[k]).forEach(function(l) { var n = Object.keys(map[k][l]).length; if (n > bn) { bn = n; b = l; } });
      if (b) out[k] = b;
    });
    return out;
  };
  var out = best(days);
  out.parts = best(parts);
  return out;
}
function plnBase() {
  if (!S) return null;
  var key = plnBaseKey();
  if (_plnBase && _plnBase.key === key && _plnBase.S === S) return _plnBase;
  var per = plnPeriod(), cfg = plnCfg();
  var inv = statsInvoices().filter(function(i) { return i.date && i.date >= per.from && i.date <= per.to; });
  var tw = weighLines(inv), mo = per.months;
  var wdTotal = statsWorkingDays(per.from, per.to), wd = Math.max(20, Math.round(wdTotal / mo));
  var clLine = plnClientLines();
  // Parts, by client and part (its number or size, and its gauge: cpPartIdentity, Performance's own).
  var byClient = {};
  inv.forEach(function(row) {
    var c = rowClient(row), cid = c ? c.id : 'none';
    var bc = byClient[cid] || (byClient[cid] = { id: cid, name: c ? c.name : (row.clientName || 'No client'), mode: c ? c.billingMode : '', parts: {}, kg: 0, rev: 0, revUnweighed: 0 });
    (row.items || []).forEach(function(it) {
      var w = lineWeightKg(it, c, row.date), amt = Number(it.amount) || 0;
      if (!w.known || !(w.kg > 0)) { bc.revUnweighed += amt; return; }
      var id = cpPartIdentity(it.partNumber || '', it.desc || ''), pk = plnPartKey(it.partNumber, it.desc);
      var p = bc.parts[pk] || (bc.parts[pk] = { id: pk, name: it.partNumber || it.desc || '—', desc: it.desc || '', gauge: id.gauge, unit: it.unit || 'KG', kg: 0, pcs: 0, rev: 0, rates: {} });
      p.kg += w.kg; p.rev += amt;
      if ((it.unit || 'KG') === 'NOS') p.pcs += Number(it.qty) || 0;
      var r = Number(it.rate) || 0; if (r) p.rates[r] = (p.rates[r] || 0) + 1;
      bc.kg += w.kg; bc.rev += amt;
    });
  });
  var clients = Object.keys(byClient).map(function(cid) {
    var bc = byClient[cid], line = clLine[cid] || null;
    var parts = Object.keys(bc.parts).map(function(k) { return bc.parts[k]; }).filter(function(p) { return p.kg > 0; }).sort(function(a, b) { return b.kg - a.kg; });
    var top = parts.slice(0, PLN_TOP_PARTS), rest = parts.slice(PLN_TOP_PARTS);
    var mk = function(p) {
      var rate = Object.keys(p.rates).sort(function(a, b) { return p.rates[b] - p.rates[a]; })[0];
      var mm = p.gauge ? +p.gauge.split('X')[1] : null;
      var pl = clLine.parts[cid + '|' + p.id];
      return { id: p.id, name: p.name, desc: p.desc, unit: p.unit === 'NOS' && p.pcs > 0 ? 'NOS' : 'KG', rate: rate != null ? +rate : null, kg: p.kg / mo, pcs: p.pcs ? p.pcs / mo : null,
        kgPc: p.unit === 'NOS' && p.pcs > 0 ? p.kg / p.pcs : null, rev: p.rev / mo, perKg: p.rev / p.kg, mm: mm, line: pl || line || 'vat-a2', lineSrc: pl ? 'record' : line ? 'client' : 'assumed', client: cid };
    };
    var out = top.map(mk);
    if (rest.length) {
      var rk = rest.reduce(function(s, p) { return s + p.kg; }, 0), rr = rest.reduce(function(s, p) { return s + p.rev; }, 0);
      out.push({ id: '*rest', name: rest.length + ' other parts', desc: '', unit: 'KG', rate: null, kg: rk / mo, pcs: null, kgPc: null, rev: rr / mo, perKg: rk ? rr / rk : 0, mm: null,
        line: line || 'vat-a2', lineSrc: line ? 'record' : 'assumed', client: cid, group: true });
    }
    return { id: cid, name: bc.name, mode: bc.mode, kg: bc.kg / mo, rev: bc.rev / mo, revUnweighed: bc.revUnweighed / mo, parts: out };
  }).filter(function(c) { return c.kg > 0 || c.revUnweighed > 0; }).sort(function(a, b) { return b.kg - a.kg; });
  var kgMo = tw.kg / mo;
  // Lines: the register where it has three days of rounds, else assumed.
  var cad = plnRegisterCadence(per.from, per.to), lines = {};
  PLN_LINE_IDS.forEach(function(l) {
    var set = cfg.lines[l] || {}, a = PLN_LINE_ASSUMED[l], c = cad[l], kgDay = clients.reduce(function(s, cl) { return s + cl.parts.filter(function(p) { return p.line === l; }).reduce(function(t, p) { return t + p.kg; }, 0); }, 0) / wd;
    var mKg = c && c.rounds > 0 && kgDay > 0 ? kgDay / c.rounds : null;
    lines[l] = {
      kgRound: set.kgRound > 0 ? +set.kgRound : mKg ? mKg : a.kgRound,
      every: set.every > 0 ? +set.every : c ? c.every : a.every,
      src: set.kgRound > 0 || set.every > 0 ? 'set' : c ? 'register' : 'assumed',
      register: c || null, kgDay: kgDay
    };
  });
  // Costs: the live cost's own lines, per kilo or per month; labour by its own parts.
  var lc = liveCost(per.from, per.to, tw.kg), row = function(k) { var r = (lc.rows || []).find(function(x) { return x.key === k; }); return r || { amount: 0, source: 'model' }; };
  var lab = labourForRange(per.from, per.to);
  var labRow = row('labour'), labRec = lab.total || 0;
  var labFixed = (lab.fixed || 0) / mo, labPool = ((lab.pool || 0) + (lab.daily || 0) + (lab.dailyRest || 0)) / mo, labOt = ((lab.ot || 0) + (lab.extra || 0)) / mo;
  var labOther = Math.max(0, (labRow.amount - labRec) / mo);
  var power = row('power').amount / mo, powerFixed = Math.min(cfg.powerFixed, power);
  // Power cuts: minutes in working hours a working day, the Power tab's own reading.
  var cutMin = 0;
  try {
    var pa = powerAnalysis();
    var inside = (pa.cuts || []).filter(function(c) { return c.date >= per.from && c.date <= per.to; }).reduce(function(s, c) { return s + ((c.cost && c.cost.inside) || 0); }, 0);
    cutMin = wdTotal ? inside / wdTotal : 0;
  } catch (e) { cutMin = 0; }
  // A line nothing measures is assumed; where the assumption could not have plated what the book billed in the general shift
  // and the two OT blocks less the cuts, its kilos a round are raised until it could, and it says so (fitted): the plant as it
  // runs must reproduce the book.
  var availFit = PLN_SHIFT.general + PLN_SHIFT.morning + PLN_SHIFT.evening - cutMin / 60;
  PLN_LINE_IDS.forEach(function(l) {
    var L0 = lines[l];
    if (L0.src !== 'assumed' || !(L0.kgDay > 0) || !(availFit > 0)) return;
    var need = L0.kgDay / availFit * L0.every / 60;
    if (need > L0.kgRound) { L0.kgRound = Math.ceil(need); L0.fitted = true; }
  });
  // Cash: set by the owner, else the statement's last balance, else nothing known.
  var cash = cfg.cash != null && cfg.cash !== '' && isFinite(+cfg.cash) ? { v: +cfg.cash, src: 'set' } : null;
  if (!cash) { try { var fr = finCtx().rows; if (fr && fr.length) cash = { v: Number(fr[fr.length - 1].balance) || 0, src: 'statement', on: fr[fr.length - 1].date }; } catch (e) { /* no statement */ } }
  if (!cash) cash = { v: 0, src: 'none' };
  _plnBase = {
    key: key, S: S, period: per, wd: wd, clients: clients, kg: kgMo, unweighed: tw.revUnknown / mo, revenue: (tw.revKnown + tw.revUnknown) / mo,
    lines: lines, cutMin: cutMin, cash: cash, coverage: tw.coverage,
    cost: {
      labourFixed: labFixed, labourPool: labPool, labourOt: labOt, labourOther: labOther,
      zincKg: tw.kg ? row('zinc').amount / tw.kg : 0, chemKg: tw.kg ? row('chem').amount / tw.kg : 0, otherKg: tw.kg ? row('other').amount / tw.kg : 0,
      powerFixed: powerFixed, powerKg: kgMo ? (power - powerFixed) / kgMo : 0,
      src: { labour: labRow.source, zinc: row('zinc').source, chem: row('chem').source, power: row('power').source, other: row('other').source }
    },
    liveCost: lc.perKg
  };
  // Pickling: set by the owner, else today's kilos over the hours the busiest line runs today, with a tenth to spare (assumed:
  // nothing measures it yet), so the plant as it runs is fed and a plan that plates more finds where pickling stops.
  if (cfg.pickKgH > 0) _plnBase.pick = { kgH: +cfg.pickKgH, src: 'set' };
  else {
    var avail0 = PLN_SHIFT.general + PLN_SHIFT.morning + PLN_SHIFT.evening, cutH0 = cutMin / 60, busiest = 0;
    PLN_LINE_IDS.forEach(function(l) {
      var d = clients.reduce(function(s, cl) { return s + cl.parts.filter(function(p) { return p.line === l; }).reduce(function(t, p) { return t + p.kg; }, 0); }, 0) / wd;
      var kgH = lines[l].kgRound * 60 / lines[l].every;
      if (d > 0) busiest = Math.max(busiest, Math.min(avail0, d / kgH + cutH0));
    });
    _plnBase.pick = { kgH: busiest > cutH0 ? Math.ceil(kgMo / wd / (busiest - cutH0) * 1.1 / 10) * 10 : 400, src: 'assumed' };
  }
  _plnBase.otBase = plnMonth(0, [], {}, {}).otH;
  return _plnBase;
}

/* ---------- Scenarios ---------- */
function plnScenarios() { return plnList('scenarios'); }
function plnScenario() {
  var p = plnRead(), list = plnScenarios();
  return list.find(function(s) { return s.id === p.active; }) || list[0] || null;
}
/* The scenario on show, made the first time the planner is used (the only write the page makes by itself is on a tap). */
function plnScenarioEnsure() {
  var p = plnData(), s = plnScenario();
  if (s) return s;
  s = { id: plnId('SC'), name: 'My plan', goal: 'normal', plan: {}, asks: {}, loan: null, cards: [], at: Date.now(), by: plnWho() };
  p.scenarios.push(s); p.active = s.id;
  return s;
}
function plnWho() { return typeof grdUser === 'function' && grdUser() ? grdUser().name : ''; }
function plnGoal(sc) { return PLN_GOALS.find(function(g) { return g.id === (sc && sc.goal); }) || PLN_GOALS[1]; }

/* Every move in a scenario as one record the engine reads. */
function plnMoves(sc) {
  if (!sc) return [];
  var plan = sc.plan || {}, on = function(k) { return plan[k] != null; }, L = [];
  PLN_STATIONS.forEach(function(st) { st.levels.forEach(function(lv, i) { if (i && on(lv.id)) L.push({ key: lv.id, lane: 'plant', label: st.name + ': ' + lv.t, at: plan[lv.id], cost: plnUpgradeCost(lv), fx: lv.fx || {}, fixes: lv.fixes, needs: (lv.needs || []).concat(i > 1 ? [st.levels[i - 1].id] : []), months: 0 }); }); });
  PLN_TECH.forEach(function(t) { if (on(t.id)) L.push({ key: t.id, lane: 'tech', label: t.t, at: plan[t.id], cost: plnTechCost(t), fx: t.fx || {}, needs: t.needs || [], months: t.months }); });
  PLN_ROLES.forEach(function(r) { if (on(r.id)) L.push({ key: r.id, lane: 'staff', label: r.t, at: plan[r.id], cost: plnTechCost(r), run: r.run || 0, p: r.id === 'promote' ? plnRoleChance(sc, r) : r.p, as: r.as, fx: r.fx || {}, needs: r.needs || [], months: r.id === 'promote' ? 2 : 1 }); });
  var base = plnBase();
  (base ? base.clients : []).forEach(function(c) {
    var k = 'ask:' + c.id;
    if (on(k)) { var a = plnAskOf(sc, c); L.push({ key: k, lane: 'clients', label: plnClientShort(c) + ': ' + plnAskLabel(a), at: plan[k], p: a.p, ask: { client: c.id, to: a.to, pct: a.pct, parts: a.parts || {} }, refuse: a.refuse, needs: [], months: 1 }); }
  });
  plnLive('heldBack').forEach(function(h) {
    var k = 'held:' + h.id;
    if (!on(k)) return;
    L.push({ key: k, lane: 'clients', label: plnClientNameOf(h.clientId) + ': ' + (PLN_HELD_WHY[h.why] || 'work held back').toLowerCase(), at: plan[k], p: h.chance != null ? h.chance : 0.5,
      vol: { client: h.clientId, kg: +h.kg || 0, rate: +h.rate || 0, line: h.line || 'vat-a2', ramp: 3 }, needs: (PLN_HELD_NEEDS[h.why] || []).slice(), months: 1 });
  });
  if (sc.loan) L.push({ key: 'loan', lane: 'money', label: 'Loan: ' + plnLoanLabel(sc.loan), at: sc.loan.at || 0, needs: [], months: 0, loan: sc.loan });
  (sc.cards || []).forEach(function(k) {
    if (!on('card:' + k.id)) return;
    L.push({ key: 'card:' + k.id, lane: 'custom', label: k.title, at: plan['card:' + k.id], cost: +k.cost || 0, run: +k.run || 0, p: k.p != null ? k.p : 0.7, months: +k.lag || 0,
      fx: k.kind === 'line' ? { line: k.line, kgRound: +k.kgRound || 0 } : k.kind === 'save' ? { saveMo: +k.gain || 0 } : {},
      vol: k.kind === 'volume' ? { client: 'card', kg: (+k.tonnes || 0) * 1000, rate: +k.rate || 0, line: k.line || 'vat-a2', ramp: 1 } : null, needs: k.needs ? [k.needs] : [] });
  });
  return L;
}
function plnRoleChance(sc, r) { var o = ((sc && sc.chances) || {})[r.id]; return o != null ? o : r.p; }
function plnClientShort(c) { var n = String(c.name || ''); var w = n.replace(/\b(PVT|PRIVATE|LTD|LIMITED|CO|CORPORATION|INDUSTRIES|P)\b\.?/gi, '').replace(/\s+/g, ' ').trim(); return w.length > 22 ? w.slice(0, 21) + '…' : w || n; }
function plnClientNameOf(id) { var c = (S.clients || []).find(function(x) { return String(x.id) === String(id); }); return c ? plnClientShort(c) : 'A client'; }
/* An ask's settings: what the scenario set, else a default from the client's billing (a piece client +5% at 3 in 10; a
   client billed by weight to the ₹/kg the scenario names as the market's, at 7 in 10). */
function plnAskOf(sc, c) {
  var o = (sc.asks || {})[c.id] || {}, piece = c.mode === 'piece';
  return { to: o.to != null ? +o.to : piece ? null : Math.max(15, Math.ceil(c.rev / Math.max(1, c.kg) + 0.5)), pct: o.pct != null ? +o.pct : piece ? 5 : null,
    p: o.p != null ? +o.p : piece ? 0.3 : 0.7, parts: o.parts || {}, refuse: piece ? { p: 0.2, cut: 0.15 } : null };
}
function plnAskLabel(a) { return a.pct ? 'ask +' + formatNum(a.pct, 1).replace(/\.0$/, '') + '%' : 'ask ₹' + formatNum(a.to, 2).replace(/\.00$/, '') + '/kg'; }
function plnLoanLabel(l) { return (l.who || 'A lender') + ' ' + formatInrShort(l.amt || 0) + ' at ' + formatNum(l.rate || 0, 1).replace(/\.0$/, '') + '%'; }

/* When each move takes effect: its month, after everything it needs, plus its own months; null when it never can.
   `luck` (a trial) adds CQI-11's slip, the promotion's pass and each chance. */
function plnReady(L, luck) {
  var by = {}; L.forEach(function(m) { by[m.key] = m; });
  var memo = {};
  function ready(k, stack) {
    if (k in memo) return memo[k];
    if (k.indexOf('|') >= 0) { var best = null; k.split('|').forEach(function(x) { var r = ready(x, stack); if (r != null && (best == null || r < best)) best = r; }); return (memo[k] = best); }
    if (k === 'specialist') {
      var a = by.specialist ? Math.max(0, by.specialist.at) + 1 : null, pr = by.promote && (!luck || luck.promote) ? Math.max(0, by.promote.at) + 2 : null;
      return (memo[k] = a == null ? pr : pr == null ? a : Math.min(a, pr));
    }
    var m = by[k]; if (!m || stack[k]) return (memo[k] = null);
    stack[k] = 1;
    var at = m.at < 0 ? 0 : m.at;
    for (var j = 0; j < m.needs.length; j++) { var r = ready(m.needs[j], stack); if (r == null) { delete stack[k]; return (memo[k] = null); } at = Math.max(at, r); }
    delete stack[k];
    at += m.months + (k === 'cqi' && luck ? luck.cqi : 0);
    if (luck && m.p != null && k !== 'promote' && !luck.lands(k, m.p)) return (memo[k] = null);
    return (memo[k] = at);
  }
  var out = {}; L.forEach(function(m) { out[m.key] = ready(m.key, {}); }); out.specialist = ready('specialist', {});
  return out;
}

/* Weighted by each chance: a move counts at its own chance times the chances of everything it needs (the likelier of two
   alternatives; the specialist is certain once hired, else the promotion's chance). */
function plnWeights(L) {
  var by = {}, memo = {};
  L.forEach(function(m) { by[m.key] = m; });
  function wt(k, stack) {
    if (k in memo) return memo[k];
    if (k.indexOf('|') >= 0) return (memo[k] = Math.max.apply(null, k.split('|').map(function(x) { return wt(x, stack); })));
    if (k === 'specialist') {
      var hire = by.specialist ? (by.specialist.p != null ? by.specialist.p : 1) : 0, pr = by.promote && !stack.promote ? wt('promote', stack) : 0;
      return (memo[k] = Math.max(hire, pr));
    }
    var m = by[k]; if (!m || stack[k]) return (memo[k] = 0);
    stack[k] = 1;
    var v = m.p != null ? m.p : 1;
    m.needs.forEach(function(n) { v *= wt(n, stack); });
    delete stack[k];
    return (memo[k] = v);
  }
  var out = {}; L.forEach(function(m) { out[m.key] = wt(m.key, {}); });
  return out;
}

/* ---------- One month, from parts to margin ---------- */
function plnMonth(m, L, ready, opts) {
  var B = _plnBase, cfg = plnCfg();
  opts = opts || {};
  var live = function(mv) { var r = ready[mv.key]; return r != null && m >= r && !(opts.drop && opts.drop[mv.key]); };
  var w = function(mv) { return !opts.expected ? 1 : opts.weights && opts.weights[mv.key] != null ? opts.weights[mv.key] : mv.p != null ? mv.p : 1; };
  var lines = {}, fx = { pickKgH: B.pick ? B.pick.kgH : 400, cutCover: 0, night: false, chemKg: 0, chemSave: 0, powerSave: 0, gensetRun: 0, otSave: 0, powerKg: 0, saveMo: 0 };
  PLN_LINE_IDS.forEach(function(k) { lines[k] = { kgRound: B.lines[k].kgRound, every: B.lines[k].every, demand: 0, down: 0 }; });
  L.forEach(function(mv) {
    if (!live(mv)) return;
    var f = mv.fx || {}, s = w(mv);
    if (f.line && lines[f.line]) { lines[f.line].kgRound += (f.kgRound || 0) * s; lines[f.line].every = Math.max(5, lines[f.line].every + (f.every || 0) * s); }
    if (f.pickKgH) fx.pickKgH += f.pickKgH * s;
    if (f.cutCover) fx.cutCover = Math.max(fx.cutCover, f.cutCover * s);
    if (f.night && s >= 0.5) fx.night = true;
    ['chemKg', 'chemSave', 'powerSave', 'gensetRun', 'otSave', 'powerKg', 'saveMo'].forEach(function(k) { if (f[k]) fx[k] += f[k] * s; });
  });
  // Demand by part, at its rate after any ask.
  var rows = [], uw = {}, uwDelta = 0;
  B.clients.forEach(function(c) {
    var ask = L.find(function(mv) { return mv.ask && mv.ask.client === c.id; });
    var askOn = ask && live(ask), s = askOn ? w(ask) : 0;
    // A refusal sends less from the month after the ask, never before it.
    var cut = ask && ask.refuse && opts.refused && opts.refused[c.id] && m >= Math.max(0, ask.at) + 1 ? ask.refuse.cut : 0;
    // Lines with no weight are revenue without kilos: a percentage ask raises them, a refusal cuts them, like the rest.
    if (c.revUnweighed) { uw[c.id] = c.revUnweighed * (1 + (askOn && ask.ask.pct ? ask.ask.pct / 100 * s : 0)) * (1 - cut); uwDelta += uw[c.id] - c.revUnweighed; }
    c.parts.forEach(function(p) {
      var perKg = p.perKg;
      if (askOn) {
        var o = ask.ask.parts[p.id];
        if (o === 'skip') { /* this part is not asked */ }
        else if (o != null && o !== '' && isFinite(+o)) perKg = p.perKg + (+o - p.perKg) * s;
        else if (ask.ask.pct) perKg = p.perKg * (1 + ask.ask.pct / 100 * s);
        else if (ask.ask.to > p.perKg) perKg = p.perKg + (ask.ask.to - p.perKg) * s;
      }
      rows.push({ client: c.id, part: p, line: p.line, kgDay: p.kg * (1 - cut) / B.wd, perKg: perKg, base: p.perKg });
    });
  });
  L.forEach(function(mv) {
    if (!mv.vol || !live(mv)) return;
    var ramp = Math.min(1, (m - ready[mv.key] + 1) / (mv.vol.ramp || 1));
    rows.push({ client: mv.vol.client, part: { id: mv.key, name: mv.label }, line: lines[mv.vol.line] ? mv.vol.line : 'vat-a2', kgDay: mv.vol.kg * ramp * w(mv) / B.wd, perKg: mv.vol.rate, base: mv.vol.rate, extra: mv.key });
  });
  if (opts.down) Object.keys(opts.down).forEach(function(k) { if (lines[k]) lines[k].down = opts.down[k]; });
  rows.forEach(function(r) { lines[r.line].demand += r.kgDay; });
  // Each line: the hours needed against the hours it can run, the cuts taken out.
  var cutMin = opts.cutMin != null ? opts.cutMin : B.cutMin;
  var cutH = cutMin * (1 - fx.cutCover) / 60, avail = PLN_SHIFT.general + PLN_SHIFT.morning + PLN_SHIFT.evening + (fx.night ? PLN_SHIFT.night : 0);
  var plated0 = 0;
  PLN_LINE_IDS.forEach(function(k) {
    var l = lines[k]; l.kgH = l.kgRound * 60 / l.every;
    l.need = l.demand > 0 ? l.demand / l.kgH + cutH : 0;
    l.hours = Math.min(l.need, avail);
    l.cap = l.kgH * Math.max(0, avail - cutH);
    l.plated = Math.min(l.demand, l.kgH * Math.max(0, l.hours - cutH));
    plated0 += l.plated;
  });
  // Pickling runs as long as the lines need it (at least the hours the busiest line runs), within the day's window.
  var pickH = Math.max(0, Math.min(avail - cutH, Math.max(Math.max.apply(null, PLN_LINE_IDS.map(function(k) { return lines[k].hours; })) - cutH, fx.pickKgH > 0 ? plated0 / fx.pickKgH : 0)));
  var pickCap = fx.pickKgH * pickH, pickShare = plated0 > pickCap && plated0 > 0 ? pickCap / plated0 : 1;
  var otH = 0, nightH = 0;
  PLN_LINE_IDS.forEach(function(k) {
    var l = lines[k];
    l.share = l.demand > 0 ? l.plated * pickShare / l.demand : 0;
    l.plated *= pickShare;
    l.waitH = pickShare < 1 ? Math.max(0, l.hours - cutH) * (1 - pickShare) : 0;
    l.ot = Math.max(0, Math.min(l.hours, PLN_SHIFT.general + PLN_SHIFT.morning + PLN_SHIFT.evening) - PLN_SHIFT.general);
    l.nightH = Math.max(0, l.hours - PLN_SHIFT.general - PLN_SHIFT.morning - PLN_SHIFT.evening);
    otH += l.ot; nightH += l.nightH;
  });
  var plated = 0, rev = B.unweighed + uwDelta, byClient = {}, lost = 0;
  Object.keys(uw).forEach(function(id) { byClient[id] = uw[id]; });
  rows.forEach(function(r) {
    var l = lines[r.line], kg = r.kgDay * l.share * Math.max(0, B.wd - (l.down || 0));
    r.kgMo = kg; r.revMo = kg * r.perKg;
    lost += (r.kgDay * B.wd - kg) * r.perKg;
    plated += kg; rev += r.revMo;
    byClient[r.client] = (byClient[r.client] || 0) + r.revMo;
  });
  var hires = 0;
  // A hire is paid from when it can start (its month, or once what it needs is ready), never while it cannot take effect.
  L.forEach(function(mv) {
    if (!mv.run || (opts.drop && opts.drop[mv.key])) return;
    var from = mv.key === 'specialist' ? Math.max(0, mv.at) : ready[mv.key] != null ? Math.max(0, ready[mv.key] - (mv.months || 0)) : null;
    if (from != null && m >= from) hires += mv.run;
  });
  var C = B.cost, otBase = B.otBase != null ? B.otBase : otH;
  var cost = {
    labourFixed: C.labourFixed, labourPool: C.labourPool,
    labourOt: Math.max(0, C.labourOt - fx.otSave + (otH - otBase) * B.wd * (+cfg.otLineHour || 0)) + C.labourOther,
    hires: hires, zinc: plated * C.zincKg, chem: plated * (C.chemKg + fx.chemKg) - fx.chemSave,
    power: C.powerFixed + plated * (C.powerKg + fx.powerKg) - fx.powerSave + fx.gensetRun, other: plated * C.otherKg - fx.saveMo
  };
  var costTot = 0; Object.keys(cost).forEach(function(k) { costTot += cost[k]; });
  var capex = 0, loanIn = 0, interest = 0, principal = 0;
  L.forEach(function(mv) { if (mv.cost && Math.max(0, mv.at) === m && !(opts.drop && opts.drop[mv.key])) capex += mv.cost; });
  var lm = L.find(function(mv) { return mv.key === 'loan'; });
  if (lm && !(opts.drop && opts.drop.loan)) { var e = plnLoanSchedule(lm.loan)[m]; if (e) { loanIn = e.in; interest = e.interest; principal = e.principal; } }
  return { m: m, lines: lines, rows: rows, plated: plated, rev: rev, byClient: byClient, cost: cost, costTot: costTot, opMargin: rev - costTot, margin: rev - costTot - interest,
    capex: capex, loanIn: loanIn, interest: interest, principal: principal, lostRev: lost, otH: otH, nightH: nightH, cutH: cutH, pickShare: pickShare, pickCap: pickCap, pickH: pickH, kgDay: plated / Math.max(1, B.wd) };
}
/* The loan, month by month: in, interest on what is owed, principal by amortised instalment after the interest-only months. */
function plnLoanSchedule(l) {
  var out = [];
  if (!l) return out;
  var bal = +l.amt || 0, r = (+l.rate || 0) / 1200, months = Math.max(1, +l.months || 1), mor = Math.max(0, Math.min(months - 1, +l.mor || 0)), n = months - mor;
  var emi = r > 0 ? bal * r / (1 - Math.pow(1 + r, -n)) : bal / n, at = Math.max(0, +l.at || 0);
  for (var m = 0; m < PLN_N; m++) {
    var k = m - at, e = { in: 0, interest: 0, principal: 0, bal: 0, emi: 0 };
    if (k === 0) e.in = +l.amt || 0;
    else if (k > 0 && bal > 0.5) { e.interest = bal * r; e.principal = k <= mor ? 0 : Math.min(bal, emi - e.interest); bal -= e.principal; }
    e.bal = k >= 0 ? bal : 0; e.emi = e.interest + e.principal;
    out.push(e);
  }
  return out;
}
function plnRunAll(L, ready, opts) {
  var B = plnBase(), months = [], cash = B.cash.v;
  for (var m = 0; m < PLN_N; m++) { var r = plnMonth(m, L, ready, opts); cash += r.margin - r.capex + r.loanIn - r.principal; r.cash = cash; months.push(r); }
  return months;
}

/* ---------- The plan run once (every move landing, or weighted by each chance) ---------- */
var _plnPlanned = null;
function plnPlanned(mode) {
  var sc = plnScenario(), B = plnBase();
  if (!B) return null;
  var key = B.key + '|' + JSON.stringify(sc || {}) + '|' + (mode || 'all') + '|' + JSON.stringify(plnLive('heldBack')) + '|' + JSON.stringify(plnLive('machines'));
  if (_plnPlanned && _plnPlanned.key === key && _plnPlanned.B === B) return _plnPlanned;
  var L = plnMoves(sc), ready = plnReady(L, null);
  _plnPlanned = { key: key, B: B, sc: sc, L: L, ready: ready, months: plnRunAll(L, ready, { expected: mode === 'expected', weights: plnWeights(L) }), base: plnRunAll([], {}, {}) };
  return _plnPlanned;
}
/* What each move added to a month, one at a time in the order they take effect (a prerequisite before what it opens):
   each row is the plan up to and including it against the plan up to the one before, so the rows add up to the plan. */
function plnAttribution(m, mode) {
  var P = plnPlanned(mode), by = {};
  P.L.forEach(function(mv) { by[mv.key] = mv; });
  var depth = function(k, seen) {
    var mv = by[k === 'specialist' ? (by.specialist ? 'specialist' : 'promote') : k];
    if (!mv || seen[mv.key]) return 0;
    seen[mv.key] = 1;
    return 1 + Math.max.apply(null, [0].concat(mv.needs.map(function(n) { return n.split('|').reduce(function(d, x) { return Math.max(d, depth(x, seen)); }, 0); })));
  };
  var order = P.L.slice().sort(function(a, b) {
    var ra = P.ready[a.key], rb = P.ready[b.key]; ra = ra == null ? 999 : ra; rb = rb == null ? 999 : rb;
    return ra - rb || depth(a.key, {}) - depth(b.key, {}) || a.at - b.at;
  });
  var prev = P.base[m], rows = [], sub = [];
  order.forEach(function(mv) {
    sub.push(mv);
    var cur = plnMonth(m, sub, plnReady(sub, null), { expected: mode === 'expected', weights: plnWeights(sub) });
    rows.push({ mv: mv, margin: cur.margin - prev.margin, kg: cur.plated - prev.plated, ready: P.ready[mv.key] });
    prev = cur;
  });
  return { rows: rows.filter(function(r) { return Math.abs(r.margin) >= 1 || Math.abs(r.kg) >= 1; }), idle: rows.filter(function(r) { return Math.abs(r.margin) < 1 && Math.abs(r.kg) < 1; }),
    base: P.base[m].margin, plan: P.months[m].margin };
}

/* ---------- The trials ---------- */
function plnRng(seed) { return function() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
function plnTrials() {
  var sc = plnScenario(), B = plnBase(), L = plnMoves(sc), r = plnRng(20261006), all = [], g = plnGoal(sc);
  var machines = plnLive('machines').filter(function(x) { return x.risk && +x.risk.p > 0; });
  var fixAt = function(ready, station) { var hit = null; PLN_STATIONS.forEach(function(st) { st.levels.forEach(function(lv) { if (lv.fixes === station && ready[lv.id] != null) hit = hit == null ? ready[lv.id] : Math.min(hit, ready[lv.id]); }); }); return hit; };
  for (var t = 0; t < PLN_TRIALS; t++) {
    var draws = {}, luck = { cqi: Math.floor(r() * 4), promote: r() < plnRoleChance(sc, PLN_ROLES[1]), lands: function(k, p) { if (!(k in draws)) draws[k] = r() < p; return draws[k]; } };
    var ready = plnReady(L, luck), refused = {};
    if (!luck.promote) ready.promote = null;   // a promotion that did not pass did not come through
    L.forEach(function(mv) { if (mv.refuse && ready[mv.key] == null && r() < mv.refuse.p) refused[mv.ask.client] = true; });
    var months = [], cash = B.cash.v, events = [];
    for (var m = 0; m < PLN_N; m++) {
      var down = {}, hit = 0;
      machines.forEach(function(x) {
        var f = fixAt(ready, x.station);
        if ((f == null || m < f) && r() < +x.risk.p) { hit += +x.risk.cost || 0; if (x.line && x.risk.days) down[x.line] = (down[x.line] || 0) + (+x.risk.days); if (events.length < 16) events.push([m, x.item + ': ' + (x.risk.say || 'broke down') + (x.risk.cost ? ', ' + formatInrShort(x.risk.cost) : ''), 'danger']); }
      });
      var mo = plnMonth(m, L, ready, { down: down, refused: refused, cutMin: B.cutMin * (0.6 + r() * 0.9) });
      mo.margin -= hit; cash += mo.margin - mo.capex + mo.loanIn - mo.principal;
      months.push({ margin: mo.margin, cash: cash, plated: mo.plated });
    }
    L.forEach(function(mv) {
      var rd = ready[mv.key];
      if (rd != null && rd < PLN_N && (mv.p != null || mv.key === 'cqi')) events.push([rd, mv.label + (mv.key === 'cqi' ? ': the plant is certifiable' : ': it came through'), 'ok']);
      else if (mv.p != null && rd == null) events.push([Math.max(0, mv.at) + 1, mv.label + ': no', 'warning']);
    });
    Object.keys(refused).forEach(function(cid) { events.push([Math.max(0, (sc.plan || {})['ask:' + cid] || 0) + 1, plnClientNameOf(cid) + ' refused, and sent less', 'danger']); });
    events.sort(function(a, b) { return a[0] - b[0]; });
    all.push({ months: months, cqi: ready.cqi, low: Math.min.apply(null, months.map(function(x) { return x.cash; })), events: events });
  }
  var pct = function(arr, p) { var s = arr.slice().sort(function(a, b) { return a - b; }); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  var res = { all: all, p10: [], p50: [], p90: [], c10: [], c50: [], c90: [], key: plnPlanned().key };
  for (var m2 = 0; m2 < PLN_N; m2++) {
    var mg = all.map(function(x) { return x.months[m2].margin; }), cs = all.map(function(x) { return x.months[m2].cash; });
    res.p10.push(pct(mg, 0.1)); res.p50.push(pct(mg, 0.5)); res.p90.push(pct(mg, 0.9)); res.c10.push(pct(cs, 0.1)); res.c50.push(pct(cs, 0.5)); res.c90.push(pct(cs, 0.9));
  }
  var target = plnGoalMargin(g, B);
  res.score = all.filter(function(x) { return x.cqi != null && x.cqi <= g.cqi && (target == null || x.months[g.at].margin >= target) && x.low >= g.floor; }).length / PLN_TRIALS;
  res.cqiShare = all.filter(function(x) { return x.cqi != null && x.cqi <= g.cqi; }).length / PLN_TRIALS;
  res.red = all.filter(function(x) { return x.low < 0; }).length / PLN_TRIALS;
  res.atGoal = all.map(function(x) { return x.months[g.at].margin; });
  return res;
}
/* A goal's margin is today's, raised: a target fixed in rupees would mean nothing on another book. */
function plnGoalMargin(g, B) { return g.marginUp == null ? null : plnRunAll([], {}, {})[0].margin + g.marginUp; }
