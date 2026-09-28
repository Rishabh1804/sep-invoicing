/* ===== PRODUCTION — the record, what it measures, and what it links to =====
 * What each line (VAT A1, VAT A2, Barrel; pickling as the stage before them) produced each day, and the material
 * in the plant, read two ways (owner, 28 Sep 2026: "This will give us a clearer picture of whats actually happening
 * in the plant daily"). OWNED BY soma-internal, like stock: this tab is a view and an input. Export is always whole,
 * import merges by id and never overwrites, and the history W18–W35 arrives as a private import.
 *
 * The record is events, never levels: pickled, plated, arrived, downtime. A figure is corrected by voiding it (with a
 * reason, never deleted) and entering it again; a hand entry that corrects a record names it (`replaces`).
 * Everything that can be counted is DERIVED on read — the usual line of a part, rack sizes, which plating a pickled
 * load became — so an import that merges by id can never double a counter, and a guess is never saved as a fact.
 */

var PROD_KINDS = ['arrived', 'pickled', 'plated', 'downtime'];
var PROD_BASIS_RANK = { register: 3, relay: 2, hand: 1 };
var PROD_USUAL_DAYS = 5, PROD_USUAL_SHARE = 0.8;
var PROD_COVER_OK = 0.9;

function prodData() {
  if (!S.production || typeof S.production !== 'object' || Array.isArray(S.production)) S.production = {};
  var p = S.production;
  ['entries', 'pastes', 'photos', 'imports'].forEach(function(k) { if (!Array.isArray(p[k])) p[k] = []; });
  if (!p.learn || typeof p.learn !== 'object') p.learn = {};
  if (!p.learn.clients || typeof p.learn.clients !== 'object') p.learn.clients = {};
  if (!p.learn.parts || typeof p.learn.parts !== 'object') p.learn.parts = {};
  return p;
}
function prodUid(p) { return stockUid(p); }
/* Stored sparsely: an empty field is left out, so a year of entries stays small on a book written whole on every save. */
function prodSparse(e) {
  var o = {};
  Object.keys(e).forEach(function(k) {
    var v = e[k];
    if (v == null || v === '' || v === false || (Array.isArray(v) && !v.length) || k === 'issues' || k === 'clientName' || k === 'lineHint' || k === 'dots') return;
    o[k] = v;
  });
  return o;
}
function prodLive(e) { return !e.voidedAt; }
function prodClientName(id) { var c = (S.clients || []).find(function(x) { return String(x.id) === String(id); }); return c ? c.name : ''; }
/* A picker hands back text; the book's own id is what a key and a match compare against. */
function prodHeldId(v) { var c = (S.clients || []).find(function(x) { return String(x.id) === String(v); }); return c ? c.id : v; }
function prodCtx() {
  return { clients: prodClientIndex(S.clients || [], prodData().learn.clients), roster: (S.staff || []).filter(function(w) { return w.active !== false; }), today: localDateStr() };
}

/* ---------- Keys ---------- */
/* One key for a floor line and a challan line: the client, the part with its gauge text taken out, and the gauge.
   "CLAMP 165X83(40X6)" on a challan and "CLAMP165×83 (40×6)" on the floor are the same part at the same gauge. */
function prodPartKey(part) { return rateKey(prodPartBase(part)); }
function prodGaugeOf(part, desc) { var n = function(s) { return String(s || '').replace(/[×✕]/g, 'X'); }; return lineGauge(n(desc)) || lineGauge(n(part)); }
function prodKey(clientId, part, gauge) { return String(clientId) + '|' + prodPartKey(part) + '|' + (gauge || ''); }
/* The family level serves a line that names only the kind of part and its gauge ("SSS MEHTA / CLAMP(40×6)"): its
   first word ("CLAMP") and the gauge. Coverage at this level is stated wherever it is used. */
function prodFamilyKey(clientId, part, gauge) {
  var w = (prodPartBase(part).toUpperCase().match(/[A-Z]+/) || [''])[0];
  return String(clientId) + '|' + w + '|' + (gauge || '');
}
function prodEntryKey(e) {
  if (e.clientId == null) return null;
  var map = prodData().learn.parts[prodKey(e.clientId, e.part, e.gauge)];
  if (map && map.partNumber) return prodKey(e.clientId, map.partNumber, map.gauge != null ? map.gauge : e.gauge);
  return prodKey(e.clientId, e.partNumber || e.part, e.gauge);
}
/* A part named only by its kind and gauge ("CLAMP(40X6)", "BOX CLAMP"): no figure in it once the gauge is out. Such
   a load is matched, and its usual line read, at the family level. */
function prodIsGeneric(part) { return !/\d/.test(prodPartBase(part)); }
function prodEntryFamily(e) { return e.clientId == null ? null : prodFamilyKey(e.clientId, e.partNumber || e.part, e.gauge); }
function prodChallanKey(m, it) { return prodKey(m.clientId, it.partNumber || it.desc, prodGaugeOf(it.partNumber, it.desc)); }

/* ---------- Weight ---------- */
/* An entry's kilograms and where they came from. The client's own card first; the Items Master only for a part
   number held by one gauge (a two-gauge part averaged is right for neither); unknown is null, never 0. */
function prodKg(e) {
  if (e.unit === 'KG') return { kg: e.qty, src: 'kg' };
  if (e.unit2 === 'KG' && e.qty2 != null) return { kg: e.qty2, src: 'kg' };
  if (e.qty == null || e.unit !== 'NOS' || e.clientId == null) return { kg: null, src: null };
  var client = (S.clients || []).find(function(c) { return String(c.id) === String(e.clientId); });
  var part = e.partNumber || e.part, desc = (e.part || '') + (e.gauge ? ' (' + e.gauge + ')' : '');
  var pw = client ? getPieceWeight(client, e.date, part, desc) : null;
  if (pw && pw.kg) return { kg: e.qty * pw.kg, src: 'client card' };
  var pk = String(part || '').toUpperCase();
  if (S.partWeights && S.partWeights[pk]) return { kg: e.qty * S.partWeights[pk], src: 'part weights' };
  var rows = (S.items || []).filter(function(i) { return rateKey(i.partNumber) === rateKey(part); });
  var gauges = {};
  rows.forEach(function(i) { gauges[rateKey(i.gauge || '')] = true; });
  if (rows.length && Object.keys(gauges).length === 1 && rows[0].stdWeightKg) return { kg: e.qty * rows[0].stdWeightKg, src: 'items' };
  return { kg: null, src: null };
}

/* ---------- The index (derived on read, never stored) ---------- */
/* Keyed on the version bumped by every write AND the identity of S.production, so a GitHub pull or a Settings
   import (adoptState replaces S whole) can never leave a stale index behind. */
var _prodVer = 0, _prodIdx = null;
function prodTouch() { _prodVer++; _prodIdx = null; }
function prodIndex() {
  var p = prodData();
  if (_prodIdx && _prodIdx.ver === _prodVer && _prodIdx.store === p && _prodIdx.n === p.entries.length) return _prodIdx;
  var live = p.entries.filter(prodLive);
  var replaced = {};
  live.forEach(function(e) { if (e.replaces) replaced[e.replaces] = e.id; });
  var byId = {};
  p.entries.forEach(function(e) { byId[e.id] = e; });
  var counted = prodCountPlated(live, replaced, byId);
  var idx = { ver: _prodVer, store: p, n: p.entries.length, live: live, byId: byId, replaced: replaced, counted: counted.counted, also: counted.also, countedSet: counted.set };
  idx.usual = prodUsualLines(idx);
  idx.racks = prodRackSizes(idx);
  idx.match = prodMatchAll(idx);
  _prodIdx = idx;
  return idx;
}

/* Which plated entries measure a line's output. Per (date, line, general|ot) the complete records are ranked
   register → relay; a standalone hand entry fills only a slot neither covers, and a hand entry that `replaces`
   one takes that record's basis and place. The others are ALSO REPORTED: shown, never added or netted — the
   register is one row per jig load on one line, the relay one figure per block, and they measure different
   populations. On a day with the supervisor's whole-day barrel list, an in-roll barrel OT block is also reported
   beside it (the owner could not say which the list covers, 28 Sep 2026). */
function prodCountPlated(live, replaced, byId) {
  var groups = {}, counted = [], also = [], set = {};
  live.forEach(function(e) {
    if (e.kind !== 'plated' || replaced[e.id]) return;
    var basis = e.replaces && byId[e.replaces] ? (byId[e.replaces].basis || 'hand') : (e.basis || 'hand');
    var sg = e.slot === 'ot' ? 'ot' : 'general';
    var k = e.date + '|' + (e.line || '-') + '|' + sg;
    (groups[k] = groups[k] || []).push({ e: e, basis: basis, standalone: basis === 'hand' && !e.replaces });
  });
  var barrelDay = {};
  live.forEach(function(e) { if (e.kind === 'plated' && e.line === 'barrel' && e.slot === 'day' && !replaced[e.id]) barrelDay[e.date] = true; });
  Object.keys(groups).forEach(function(k) {
    var g = groups[k], best = 0;
    g.forEach(function(x) { if (!x.standalone) best = Math.max(best, PROD_BASIS_RANK[x.basis] || 1); });
    var parts = k.split('|');
    g.forEach(function(x) {
      var keep = best ? (!x.standalone && (PROD_BASIS_RANK[x.basis] || 1) === best) : true;
      if (keep && parts[1] === 'barrel' && parts[2] === 'ot' && barrelDay[parts[0]] && x.basis === 'relay') keep = false;
      if (keep) { counted.push(x.e); set[x.e.id] = true; } else also.push(x.e);
    });
  });
  return { counted: counted, also: also, set: set };
}

/* The usual line of a part: distinct days on each line, from plated entries whose line was WRITTEN or SET — never
   an inferred one, so the pattern cannot feed itself. Usual at 5+ days with 80%+ on one line. */
function prodUsualLines(idx) {
  var days = {};
  idx.counted.forEach(function(e) {
    if (!e.line || (e.lineSrc !== 'written' && e.lineSrc !== 'set')) return;
    [prodEntryKey(e), prodEntryFamily(e) && 'F:' + prodEntryFamily(e)].forEach(function(k) {
      if (!k) return;
      var d = days[k] || (days[k] = {});
      (d[e.line] = d[e.line] || {})[e.date] = true;
    });
  });
  var out = {};
  Object.keys(days).forEach(function(k) {
    var counts = {}, total = 0, top = null;
    Object.keys(days[k]).forEach(function(l) { counts[l] = Object.keys(days[k][l]).length; total += counts[l]; if (!top || counts[l] > counts[top]) top = l; });
    var share = total ? counts[top] / total : 0;
    out[k] = { line: top, days: counts[top], total: total, share: share, counts: counts,
      kind: total >= PROD_USUAL_DAYS && share >= PROD_USUAL_SHARE ? 'usual' : share >= 0.6 ? 'mostly' : 'moves' };
  });
  return out;
}
function prodUsualLine(key) { return (prodIndex().usual || {})[key] || null; }

/* Rack sizes seen per line and part, counted over rounds actually counted (a START or struck round is not). */
function prodRackSizes(idx) {
  var out = {};
  idx.counted.forEach(function(e) {
    if (!e.line) return;
    var k = e.line + '|' + (prodEntryKey(e) || '');
    var o = out[k] || (out[k] = {});
    (e.rounds || []).forEach(function(r) { if (!r.struck && r.qty > 0) o[r.qty] = (o[r.qty] || 0) + 1; });
    if (e.rackSize && e.racks) o[e.rackSize] = (o[e.rackSize] || 0) + e.racks;
  });
  return out;
}

/* A register read against the rack sizes this book has seen on that line for that part. A size never counted
   there (with three or more rounds on record) is amber: a misread figure or a new jig, the photo decides. A round of
   half the usual rack on VAT A2 is only said (the line runs half racks of the long parts). Adds to each row's issues. */
function prodRackCheck(rd, line) {
  line = line !== undefined ? line : rd && rd.line;
  if (!rd || !line) return rd;
  var racks = prodIndex().racks;
  rd.runs.forEach(function(run) {
    if (run.clientId == null) return;
    var seen = racks[line + '|' + prodEntryKey(run)] || {}, sizes = Object.keys(seen).map(Number), total = 0, top = null;
    sizes.forEach(function(z) { total += seen[z]; if (top == null || seen[z] > seen[top]) top = z; });
    if (total < 3) return;
    (run.rows || []).forEach(function(row) {
      var z = row.rackSize || row.qty;
      if (!z || row.start || seen[z] || (row.rackSize == null && row.rounds == null && row.qty != null && row.qty !== Math.round(row.qty))) return;
      if (line === 'vat-a2' && top && Math.abs(z * 2 - top) < 0.5) row.issues.push({ tone: 'info', code: 'halfrack', text: 'Half the usual rack of ' + top + ' on VAT A2.' });
      else if (!row.rackSize && !row.rounds) row.issues.push({ tone: 'amber', code: 'rack', text: z + ' has not been seen as a round of this part on ' + PROD_LINE_LABEL[line] + ' (usually ' + top + '). Check it against the photo.' });
      else if (row.rackSize && !seen[row.rackSize]) row.issues.push({ tone: 'amber', code: 'rack', text: 'A rack of ' + row.rackSize + ' has not been seen for this part on ' + PROD_LINE_LABEL[line] + ' (usually ' + top + ').' });
    });
  });
  return rd;
}

/* A pickled load → the plating it became: the same part, plated the same day at or after the pickling time (less
   half an hour), or the next working day before noon; earliest first until the load's quantity is reached, or up
   to the next load of the part when no quantity was written. What this infers — the line, a missing quantity — is
   SHOWN, never stored; `set.matchIds` is the owner's own answer and wins. */
function prodMatchAll(idx) {
  var plated = {}, pickled = {}, out = {}, used = {};
  // A plated entry sits in its part's pool and its family's; a load draws from its part's, or its family's when it
  // names only the kind of part. One `used` across both, so no plating is claimed twice. Named parts go first.
  idx.counted.forEach(function(e) {
    var k = prodEntryKey(e), f = prodEntryFamily(e);
    if (k) (plated[k] = plated[k] || []).push(e);
    if (f) (plated['F:' + f] = plated['F:' + f] || []).push(e);
  });
  idx.live.forEach(function(e) {
    if (e.kind !== 'pickled' || idx.replaced[e.id]) return;
    var k = prodIsGeneric(e.partNumber || e.part) ? (prodEntryFamily(e) && 'F:' + prodEntryFamily(e)) : prodEntryKey(e);
    if (k) (pickled[k] = pickled[k] || []).push(e);
  });
  var cmp = function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.time || '').localeCompare(String(b.time || '')); };
  Object.keys(pickled).sort(function(a, b) { return (a.indexOf('F:') === 0) - (b.indexOf('F:') === 0); }).forEach(function(k) {
    var loads = pickled[k].sort(cmp), pool = (plated[k] || []).slice().sort(cmp);
    loads.forEach(function(load, li) {
      if (load.set && load.set.matchIds !== undefined) {
        var ids = load.set.matchIds || [];
        out[load.id] = prodMatchResult(ids.map(function(id) { return idx.byId[id]; }).filter(Boolean), load, true);
        ids.forEach(function(id) { used[id] = true; });
        return;
      }
      var next = loads[li + 1], nextWd = stockIsoAdd(load.date, new Date(load.date + 'T00:00:00').getDay() === 6 ? 2 : 1);
      var got = [], sum = 0;
      pool.forEach(function(p) {
        if (used[p.id]) return;
        if (load.qty != null && load.unit === p.unit && sum >= load.qty) return;
        var sameDay = p.date === load.date && (!p.time || !load.time || prodMin(p.time) >= prodMin(load.time) - 30);
        var nextDay = p.date === nextWd && (!p.time || prodMin(p.time) < 720);
        if (!sameDay && !nextDay) return;
        if (load.qty == null && next && cmp(p, next) >= 0 && (next.date === p.date)) return;
        got.push(p); used[p.id] = true;
        if (p.unit === load.unit && p.qty != null) sum += p.qty;
      });
      out[load.id] = prodMatchResult(got, load, false);
    });
  });
  return out;
}
function prodMatchResult(list, load, set) {
  var lines = {}, qty = 0, unitOk = true;
  list.forEach(function(p) { if (p.line) lines[p.line] = true; if (p.qty != null && p.unit === load.unit) qty += p.qty; else unitOk = false; });
  var ls = Object.keys(lines);
  return { ids: list.map(function(p) { return p.id; }), lines: ls, line: ls.length === 1 ? ls[0] : null, split: ls.length > 1, qty: list.length && unitOk ? qty : null, set: set };
}

/* A pickled load's line as the page shows it: written or set, else inferred from its plating, else unknown with
   the usual line of its part as a hint (a chip the owner taps; never applied by itself). */
function prodLoadLine(e) {
  if (e.line) return { line: e.line, how: e.lineSrc === 'set' ? 'set' : 'written' };
  var m = prodIndex().match[e.id];
  if (m && m.line) return { line: m.line, how: 'plating' };
  if (m && m.split) return { line: null, how: 'split', lines: m.lines };
  var k = prodIsGeneric(e.partNumber || e.part) ? (prodEntryFamily(e) && 'F:' + prodEntryFamily(e)) : prodEntryKey(e);
  var u = k ? prodUsualLine(k) : null;
  return { line: null, how: 'unknown', hint: u && u.kind === 'usual' ? u : null, family: !!(k && k.indexOf('F:') === 0) };
}

/* ---------- Record coverage ---------- */
/* A line-day is recorded when a counted plated entry exists for it. A day nobody recorded is a gap, never 0. */
function prodLineDays(from, to) {
  var out = {};
  PROD_LINES.forEach(function(l) { out[l] = {}; });
  prodIndex().counted.forEach(function(e) { if (e.line && out[e.line] && e.date >= from && e.date <= to) out[e.line][e.date] = true; });
  return out;
}
function prodCoverage(from, to) {
  var wd = statsWorkingDays(from, to), ld = prodLineDays(from, to), res = {};
  PROD_LINES.forEach(function(l) {
    var n = Object.keys(ld[l]).length, last = Object.keys(ld[l]).sort().pop() || null;
    res[l] = { days: n, of: wd, share: wd ? n / wd : 0, last: last };
  });
  return res;
}
/* A complete day: attendance recorded, and every line that had heads that day has a general-shift record. */
function prodCompleteDays(from, to) {
  var att = S.attendance || {}, out = [];
  var gen = {};
  prodIndex().counted.forEach(function(e) { if (e.slot !== 'ot' && e.line) (gen[e.date] = gen[e.date] || {})[e.line] = true; });
  for (var d = from, g = 0; d <= to && g < 400; d = stockIsoAdd(d, 1), g++) {
    var day = att[d];
    if (!day || !day.marks) continue;
    var staffed = {};
    Object.keys(day.marks).forEach(function(id) {
      var mk = day.marks[id];
      if (!mk || (mk.st && mk.st !== 'P' && mk.st !== 'H')) return;
      var a = mk.area || '';
      if (a === 'vat-a1' || a === 'vat-a2' || a === 'barrel') staffed[a] = true;
    });
    var lines = Object.keys(staffed);
    if (!lines.length) continue;
    if (lines.every(function(l) { return gen[d] && gen[d][l]; })) out.push(d);
  }
  return out;
}

/* Plated output of a line on a day: NOS and kg, how much of it was weighed, rework named apart (it counts as work). */
function prodDayLine(date, line) {
  var r = { nos: 0, kgKnown: 0, kg: 0, pieces: 0, weighedPieces: 0, rounds: 0, entries: [], rework: 0 };
  prodIndex().counted.forEach(function(e) {
    if (e.date !== date || e.line !== line || e.qty == null) return;
    r.entries.push(e);
    if (e.rework) r.rework++;
    var w = prodKg(e);
    if (e.unit === 'NOS') { r.nos += e.qty; r.pieces += e.qty; if (w.kg != null) { r.weighedPieces += e.qty; r.kg += w.kg; } }
    else if (e.unit === 'KG') r.kg += e.qty;
    (e.rounds || []).forEach(function(x) { if (!x.struck) r.rounds++; });
    if (!e.rounds && e.racks) r.rounds += e.racks;
  });
  r.weighedShare = r.pieces ? r.weighedPieces / r.pieces : 1;
  return r;
}

/* ---------- Material in plant ---------- */
/* Two readings of what is in the plant, and the gap between them.
   BOOK = Σ the open share of every challan line (imLineOpen), unwindowed: the same figure as Home's unbilled.
   FLOOR = the same open lines, split by what the floor recorded: plating and pickling of a part are attributed to
   its challan lines OLDEST OPEN FIRST, carried-in lines included (numerator and denominator from one population).
   Per line: waiting to pickle, pickled and not plated, plated and not invoiced. The unit is the floor's: pieces
   where the challan counts them (a KG line's nosQty), else kilograms. Rework is work, never billing, and is left
   out. Arrived entries (the pickling hand's incoming messages) are a floor receipt count of their own, shown
   beside the book's receipts, never merged into them. */
function prodInPlant(opts) {
  opts = opts || {};
  var idx = prodIndex(), today = localDateStr(), since = opts.since || stockIsoAdd(today, -30);
  var lines = [], byKey = {};
  (S.incomingMaterial || []).forEach(function(m) {
    if (opts.clientId != null && String(m.clientId) !== String(opts.clientId)) return;
    (m.items || []).forEach(function(it) {
      var o = imLineOpen(it);
      var k = prodChallanKey(m, it), fam = prodFamilyKey(m.clientId, it.partNumber || it.desc, prodGaugeOf(it.partNumber, it.desc));
      var nosLine = it.unit === 'NOS', hasNos = nosLine || it.nosQty > 0;
      var rec = { m: m, it: it, key: k, fam: fam, date: m.challanDate || '', open: o, amount: o.amount,
        R: { NOS: hasNos ? (nosLine ? (it.qty || 0) : (it.nosQty || 0)) : null, KG: it.unit === 'KG' ? (it.qty || 0) : null },
        openQ: { NOS: hasNos ? (nosLine ? o.qty : o.nos) : null, KG: it.unit === 'KG' ? o.qty : null },
        P: { NOS: 0, KG: 0 }, L: { NOS: 0, KG: 0 } };
      lines.push(rec);
      (byKey[k] = byKey[k] || []).push(rec);
    });
  });
  Object.keys(byKey).forEach(function(k) { byKey[k].sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }); });
  var noChallan = {}, famUsed = 0, arrived = {};
  var alloc = function(e, field) {
    var k = prodEntryKey(e);
    if (!k || e.qty == null || !e.unit || e.unit === 'BAG') return;
    var pool = byKey[k];
    if (!pool) {
      var fk = prodFamilyKey(e.clientId, e.partNumber || e.part, e.gauge);
      pool = lines.filter(function(r) { return r.fam === fk; });
      if (pool.length) famUsed++;
    }
    var left = e.qty, u = e.unit;
    (pool || []).forEach(function(r) {
      if (left <= 0 || r.R[u] == null) return;
      if (r.date && r.date > stockIsoAdd(e.date, 1)) return;
      var room = r.R[u] - r[field][u];
      if (room <= 0) return;
      var take = Math.min(room, left);
      r[field][u] += take; left -= take;
    });
    if (left > 0.0005) { var nk = (e.clientId == null ? '?' : e.clientId) + '|' + (e.part || ''); var nc = noChallan[nk] || (noChallan[nk] = { clientId: e.clientId, client: e.client, part: e.part, qty: 0, unit: u, field: field, oldest: e.date }); nc.qty += left; if (e.date < nc.oldest) nc.oldest = e.date; }
  };
  var sortE = function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.time || '').localeCompare(String(b.time || '')); };
  idx.counted.slice().sort(sortE).forEach(function(e) { if (!e.rework && (opts.clientId == null || String(e.clientId) === String(opts.clientId))) alloc(e, 'L'); });
  idx.live.filter(function(e) { return e.kind === 'pickled' && !e.rework && !idx.replaced[e.id]; }).sort(sortE)
    .forEach(function(e) { if (opts.clientId == null || String(e.clientId) === String(opts.clientId)) alloc(e, 'P'); });
  idx.live.forEach(function(e) {
    if (e.kind !== 'arrived' || e.date < since) return;
    var k = prodEntryKey(e); if (!k || e.qty == null) return;
    var a = arrived[k] || (arrived[k] = { NOS: 0, KG: 0 }); if (e.unit === 'NOS' || e.unit === 'KG') a[e.unit] += e.qty;
  });
  // Per open line, in its floor unit.
  var rows = [];
  lines.forEach(function(r) {
    var u = r.R.NOS != null ? 'NOS' : 'KG';
    var R = r.R[u] || 0, openQ = r.openQ[u] || 0, I = Math.max(0, R - openQ), L = Math.min(R, r.L[u]), P = Math.min(R, Math.max(r.P[u], L));
    var platedNotInvoiced = Math.max(0, Math.min(openQ, L - I));
    var pickledNotPlated = Math.max(0, Math.min(openQ - platedNotInvoiced, P - Math.max(L, I)));
    var waiting = Math.max(0, openQ - platedNotInvoiced - pickledNotPlated);
    if (openQ <= 0.0005 && platedNotInvoiced <= 0) return;
    rows.push({ r: r, unit: u, R: R, I: I, L: r.L[u], P: r.P[u], open: openQ, amount: r.amount, platedNotInvoiced: platedNotInvoiced, pickledNotPlated: pickledNotPlated, waiting: waiting,
      floorRecorded: r.L[u] > 0 || r.P[u] > 0 });
  });
  var cov = prodCoverage(since, today), covShare = Math.min.apply(null, PROD_LINES.map(function(l) { return cov[l].share; }));
  var book = rows.reduce(function(s, x) { return s + x.amount; }, 0);
  return { rows: rows, noChallan: Object.keys(noChallan).map(function(k) { return noChallan[k]; }), arrived: arrived, famUsed: famUsed,
    book: gstRound(book), coverage: cov, coverShare: covShare, floorOk: covShare >= PROD_COVER_OK, since: since };
}

/* ---------- Links: Stats, labour by line, the To-do ---------- */
/* Stats → In one line: the floor's plated tonnage on complete days against ~2 t a shift. Nothing is said with no
   production in the range — never a zero. */
function prodPlatedSummary(from, to) {
  var days = prodCompleteDays(from, to);
  if (!days.length) return null;
  var kg = 0, pieces = 0, weighed = 0;
  days.forEach(function(d) { PROD_LINES.forEach(function(l) { var r = prodDayLine(d, l); kg += r.kg; pieces += r.pieces; weighed += r.weighedPieces; }); });
  return { days: days.length, working: statsWorkingDays(from, to), kg: kg, perDay: kg / days.length, capacity: STATS_CAPACITY_KG_DAY, weighedShare: pieces ? weighed / pieces : 1 };
}
function prodStatsRowHtml(from, to) {
  var s = prodPlatedSummary(from, to);
  if (!s) return '';
  return '<div class="inv-row inv-row-2 inv-row-flow" id="statsPlated"><span class="inv-row-main"><span class="inv-row-title">Plated (floor)</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml(formatNum(s.kg / 1000, 1) + ' t on ' + s.days + ' complete day' + (s.days === 1 ? '' : 's') + ' of ' + s.working + ' working · ' +
      Math.round(s.perDay / s.capacity * 100) + '% of ~2 t per shift · kg known for ' + Math.round(s.weighedShare * 100) + '% of pieces') + '</span></span>' +
    '<span class="inv-row-end"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invSwitchTab" data-tab="pageProduction">Production</button></span></div>';
}

/* Labour ₹/kg by line: variable labour (the pool, the daily tier, OT, the EXTRA) of each area, divided by the kg
   that line plated, over the SAME days — days with attendance and a usable production record (kg weighed on 90% of
   its pieces). The VAT side's pickling hands are split between A1 and A2 by that day's kg. The monthly crew is the
   standing crew and is not by line. What was excluded is said: a one-day range credits no weekly rest, and a closed
   month paid on a slip puts monthly OT on the hand's home area, so neither is a line's figure here. */
var PROD_LINE_AREAS = { 'vat-a1': ['vat-a1'], 'vat-a2': ['vat-a2'], barrel: ['barrel', 'pickling-barrel'] };
function prodLabourByLine(from, to) {
  var res = {}, skipped = 0, skippedCost = 0, days = 0;
  PROD_LINES.forEach(function(l) { res[l] = { cost: 0, kg: 0, days: 0 }; });
  for (var d = from, g = 0; d <= to && g < 120; d = stockIsoAdd(d, 1), g++) {
    if (!S.attendance || !S.attendance[d]) continue;
    var lab = labourForRange(d, d), areas = lab.byArea || {}, used = false;
    var dayKg = {};
    PROD_LINES.forEach(function(l) { var r = prodDayLine(d, l); if (r.entries.length && r.weighedShare >= 0.9 && r.kg > 0) dayKg[l] = r.kg; });
    var vatKg = (dayKg['vat-a1'] || 0) + (dayKg['vat-a2'] || 0);
    PROD_LINES.forEach(function(l) {
      var cost = 0;
      PROD_LINE_AREAS[l].forEach(function(a) { cost += (areas[a] || {}).cost || 0; });
      if ((l === 'vat-a1' || l === 'vat-a2') && areas['pickling-vat'] && vatKg > 0 && dayKg[l]) cost += areas['pickling-vat'].cost * dayKg[l] / vatKg;
      if (dayKg[l]) { res[l].cost += cost; res[l].kg += dayKg[l]; res[l].days++; used = true; }
      else { skippedCost += cost; }
    });
    if (used) days++; else skipped++;
  }
  PROD_LINES.forEach(function(l) { res[l].perKg = res[l].kg > 0 && res[l].days >= 5 ? res[l].cost / res[l].kg : null; res[l].cost = gstRound(res[l].cost); });
  return { lines: res, days: days, skipped: skipped, skippedCost: gstRound(skippedCost) };
}

/* The two To-do rules. Both read only what was captured here (never the imported history, which would raise a
   flood on the first day), leave rework out (replating is not billed twice), and carry the tone in their sig so a
   snoozed amber task comes back when it turns red. */
var PROD_RULES = [['prodPlatedUnbilled', 'Production: plated and not invoiced'], ['prodPickledNoChallan', 'Production: pickled with no open challan']];
PROD_RULES.forEach(function(r) { TODO_RULES.push(r); TODO_CHECK_DEFAULTS[r[0]] = true; });
TODO_CHECK_DEFAULTS.prodPlatedDays = 3;
function prodGo(tab, extra) { return Object.assign({ kind: 'production', tab: tab }, extra || {}); }
function prodWorkingDaysBetween(a, b) { var n = 0; for (var d = stockIsoAdd(a, 1), g = 0; d <= b && g < 400; d = stockIsoAdd(d, 1), g++) if (new Date(d + 'T00:00:00').getDay() !== 0) n++; return n; }

TODO_RULE_FNS.prodPlatedUnbilled = function() {
  var cfg = todoCfg(), N = cfg.prodPlatedDays || 3, today = localDateStr(), since = stockIsoAdd(today, -45);
  var idx = prodIndex(), byClient = {};
  var own = idx.counted.filter(function(e) { return e.src !== 'import' && !e.rework && e.date >= since && e.qty != null && e.clientId != null; });
  if (!own.length) return [];
  var plant = prodInPlant({ since: since });
  plant.rows.forEach(function(x) {
    if (x.platedNotInvoiced <= 0) return;
    var cid = x.r.m.clientId;
    // The oldest capture-sourced plating of this part decides the age.
    var k = x.r.key, mine = own.filter(function(e) { return prodEntryKey(e) === k; });
    if (!mine.length) return;
    var oldest = mine.map(function(e) { return e.date; }).sort()[0];
    var age = prodWorkingDaysBetween(oldest, today);
    if (age < N) return;
    var c = byClient[cid] || (byClient[cid] = { nos: 0, kg: 0, parts: {}, oldest: oldest, age: age });
    if (x.unit === 'NOS') c.nos += x.platedNotInvoiced; else c.kg += x.platedNotInvoiced;
    c.parts[x.r.it.partNumber || x.r.it.desc] = true;
    if (oldest < c.oldest) { c.oldest = oldest; c.age = age; }
  });
  return Object.keys(byClient).map(function(cid) {
    var c = byClient[cid], n = Object.keys(c.parts).length, tone = c.age >= 2 * N ? 'red' : 'amber', name = prodClientName(cid) || 'Client ' + cid;
    var what = (c.nos ? Math.round(c.nos).toLocaleString('en-IN') + ' NOS' : '') + (c.nos && c.kg ? ' + ' : '') + (c.kg ? formatNum(c.kg, 1) + ' kg' : '');
    return { key: 'prodPlatedUnbilled:' + cid, rule: 'prodPlatedUnbilled', tone: tone, title: name + ': ' + what + ' plated, not invoiced',
      sub: todoPlural(n, 'part') + ' · oldest plated ' + formatDate(c.oldest) + ' (' + todoPlural(c.age, 'working day') + ')',
      why: 'Production · rule: ' + N + ' working days', facts: [['Plated, not invoiced', what], ['Parts', String(n)], ['Oldest', formatDate(c.oldest)]],
      clears: 'Invoice these parts, or void a plated entry that was wrong.', go: prodGo('plant', { client: cid }), goLabel: 'Open in plant',
      sig: tone + '|' + cid + '|' + c.oldest + '|' + n };
  });
};
TODO_RULE_FNS.prodPickledNoChallan = function() {
  var today = localDateStr(), since = stockIsoAdd(today, -30), idx = prodIndex();
  var own = idx.live.filter(function(e) { return e.kind === 'pickled' && e.src !== 'import' && !e.rework && e.date >= since && prodWorkingDaysBetween(e.date, today) >= 1; });
  if (!own.length) return [];
  var byClient = {}, outside = [];
  own.forEach(function(e) {
    if (e.clientId == null) { outside.push(e); return; }
    var k = prodEntryKey(e), fk = prodFamilyKey(e.clientId, e.partNumber || e.part, e.gauge), found = false;
    (S.incomingMaterial || []).some(function(m) {
      if (String(m.clientId) !== String(e.clientId) || (m.challanDate || '') > stockIsoAdd(e.date, 1)) return false;
      return (m.items || []).some(function(it) {
        var ck = prodChallanKey(m, it);
        var match = e.part ? (ck === k || prodFamilyKey(m.clientId, it.partNumber || it.desc, prodGaugeOf(it.partNumber, it.desc)) === fk) : true;
        if (!match) return false;
        var open = imLineOpen(it).qty > 0;
        var billedAfter = (it.invoiceIds || []).some(function(id) { var inv = S.invoices.find(function(x) { return x.id === id; }); return inv && inv.date >= e.date; });
        if (open || billedAfter) { found = true; return true; }
        return false;
      });
    });
    if (found) return;
    var c = byClient[e.clientId] || (byClient[e.clientId] = { n: 0, oldest: e.date });
    c.n++; if (e.date < c.oldest) c.oldest = e.date;
  });
  var tasks = Object.keys(byClient).map(function(cid) {
    var c = byClient[cid], age = prodWorkingDaysBetween(c.oldest, today), tone = age >= 3 ? 'red' : 'amber';
    return { key: 'prodPickledNoChallan:' + cid, rule: 'prodPickledNoChallan', tone: tone, title: (prodClientName(cid) || 'Client ' + cid) + ': ' + todoPlural(c.n, 'load') + ' pickled with no open challan',
      sub: 'Oldest ' + formatDate(c.oldest), why: 'Production · pickled, and no challan of that part open on the day',
      facts: [['Loads', String(c.n)], ['Oldest', formatDate(c.oldest)]], clears: 'Enter the challan (Challans → Add challan), map the part to the challan’s part, or void the load.',
      go: prodGo('entries', { client: cid, flag: 'nochallan' }), goLabel: 'Open the loads', sig: tone + '|' + cid + '|' + c.oldest + '|' + c.n };
  });
  if (outside.length) {
    var names = {}; outside.forEach(function(e) { names[e.client || '?'] = true; });
    tasks.push({ key: 'prodPickledNoChallan:outside', rule: 'prodPickledNoChallan', tone: 'amber', title: todoPlural(outside.length, 'load') + ' pickled for a client not in the book',
      sub: Object.keys(names).slice(0, 3).join(', '), why: 'Production · the client named is not in Clients', facts: [['Loads', String(outside.length)]],
      clears: 'Add the client, or pick the client on the load.', go: prodGo('entries', { flag: 'noclient' }), goLabel: 'Open the loads', sig: 'amber|' + outside.length });
  }
  return tasks;
};

/* ---------- Export and import (sep-production v1) ---------- */
function prodExport() {
  var p = prodData();
  var meta = document.querySelector('meta[name="app-build"]');
  var obj = { format: 'sep-production', version: 1, exportedAt: new Date().toISOString(), build: meta ? meta.getAttribute('content') : '',
    entries: p.entries, pastes: p.pastes, photos: p.photos, imports: p.imports, learn: p.learn };
  var blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sep-production-' + localDateStr() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
}
/* Merge by id, never overwrite. A client is kept by id only when the book holds that id under the same name;
   otherwise it is found by name, and a name the book does not hold is counted, never invented. */
function prodMergeImport(obj, fileName) {
  var src = obj && obj.format === 'sep-production' ? obj : (obj && obj.production) || null;
  if (!src || !Array.isArray(src.entries)) return { ok: false };
  var p = prodData(), have = {}, ctx = prodCtx(), added = 0, skipped = 0, unknown = 0, bad = 0;
  p.entries.forEach(function(e) { have[e.id] = true; });
  var imp = { id: prodUid('PI'), at: Date.now(), by: stockBy(), file: fileName || '', exportedAt: src.exportedAt || '', build: src.build || '' };
  src.entries.forEach(function(e0) {
    if (!e0 || typeof e0 !== 'object' || !e0.id || have[e0.id]) { skipped++; return; }
    if (PROD_KINDS.indexOf(e0.kind) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(e0.date || '') || (e0.qty != null && !isFinite(e0.qty)) ||
      (e0.unit != null && ['NOS', 'KG', 'BAG'].indexOf(e0.unit) < 0) || (e0.line != null && PROD_LINES.indexOf(e0.line) < 0)) { bad++; return; }
    var e = {};
    Object.keys(e0).forEach(function(k) { e[k] = e0[k]; });
    if (e.clientId != null) {
      var held = (S.clients || []).find(function(c) { return String(c.id) === String(e.clientId); });
      if (!held || (e.client && relayKey(held.name) !== relayKey(e.client) && !prodMatchClient(e.client, ctx.clients))) e.clientId = null;
    }
    if (e.clientId == null && e.client) { var hit = prodMatchClient(e.client, ctx.clients); if (hit) e.clientId = hit.id; }
    if (e.clientId == null && e.kind !== 'downtime' && (e.client || e.part)) unknown++;
    if (!e.src) e.src = 'import';
    e.importId = e.importId || imp.id;
    p.entries.push(prodSparse(e));
    have[e.id] = true;
    added++;
  });
  var ph = {}; p.pastes.forEach(function(x) { ph[x.id] = true; ph['h' + x.hash] = true; });
  (src.pastes || []).forEach(function(x) { if (x && x.id && !ph[x.id] && !ph['h' + x.hash]) { p.pastes.push(x); ph[x.id] = true; } });
  var fh = {}; p.photos.forEach(function(x) { fh[x.id] = true; fh['s' + x.sha] = true; });
  (src.photos || []).forEach(function(x) { if (x && x.id && !fh[x.id] && !fh['s' + x.sha]) { p.photos.push(x); fh[x.id] = true; } });
  ['clients', 'parts'].forEach(function(k) { var from = (src.learn || {})[k] || {}; Object.keys(from).forEach(function(key) { if (!(key in p.learn[k])) p.learn[k][key] = from[key]; }); });
  imp.counts = { entries: added, skipped: skipped, unknownClient: unknown, refused: bad };
  if (added) p.imports.push(imp);
  prodTouch();
  return { ok: true, added: added, skipped: skipped, unknown: unknown, bad: bad };
}
