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
  if (!Array.isArray(p.gaugeRules)) p.gaugeRules = [];
  if (!Array.isArray(p.partRules)) p.partRules = [];
  return p;
}

/* ---------- The gauge a round's size gives ----------
   Owner, 30 Sep 2026: "Mehta's clamp gauge is 25x6 or 30x6 if 150 pieces are done on VAT A1 and 100 pieces on VAT A2, and
   35x6 or 35x8 or 40x6 if 120 pieces and 72 pieces are done in VAT A1." The register writes SSS Mehta's clamps as
   CLAMP with no gauge; the pieces on a round say which gauges it can be. A rule is a client, the part's first word, the
   rack sizes and the gauges they mean (`S.production.gaugeRules`, travelling with the book). The lines the owner named
   are kept on the rule but not required: the pages show 150 on A2 and 120 on A2 as well. A rack in no rule leaves the
   gauge unread. */
function prodGaugeRuleFor(clientId, part, rack) {
  if (clientId == null || !(rack > 0)) return null;
  var w = (prodPartBase(part).toUpperCase().match(/[A-Z]+/) || [''])[0];
  var r = prodData().gaugeRules.find(function(x) { return String(x.clientId) === String(clientId) && x.family === w && (x.racks || []).indexOf(rack) >= 0; });
  return r ? r.gauges.slice() : null;
}

/* ---------- Who plated it ----------
   Owner, 30 Sep 2026: "place workers on the specified production … we'll know who plated what and when, this can be useful
   later when we get replating issues." Read off the day's attendance, never stored: a run in the general shift is the hands
   marked present on its line that day (where they stood, the mark's area); a run outside it (before 8:30 or from 5 PM) is
   the named crew of the OT or night block on its line whose times cover it. A pickling load is the pickling hands present.
   A day with no attendance, or a line nobody stood on, says so rather than naming anyone. */
function prodCrew(e) {
  var rec = e && e.date ? (S.attendance || {})[e.date] : null;
  if (!rec || !rec.marks) return { known: false, why: 'no attendance recorded that day' };
  var areas = e.kind === 'pickled' ? ['pickling-vat', 'pickling-barrel'] : e.line ? [e.line].concat(e.line === 'barrel' ? ['pickling-barrel'] : []) : null;
  if (!areas) return { known: false, why: 'line not known' };
  var t = e.time ? _hhmm(e.time) : null, ot = e.slot === 'ot' || (t != null && (t < 510 || t >= 1020));
  var ids = [], src = 'marks';
  if (ot) {
    (rec.extra || []).forEach(function(x) {
      if (!Array.isArray(x.crew) || !x.crew.length || !x.from || !x.to) return;
      var xa = typeof extraAreas === 'function' ? extraAreas(x) : (x.areas || []);
      if (!xa.some(function(a) { return areas.indexOf(a) >= 0; })) return;
      var a = _hhmm(x.from), b = _hhmm(x.to); if (b <= a) b += 1440;
      var tt = t != null && t < a ? t + 1440 : t;
      if (tt == null || (tt >= a && tt <= b)) x.crew.forEach(function(id) { if (ids.indexOf(String(id)) < 0) ids.push(String(id)); });
    });
    src = 'block';
  } else {
    Object.keys(rec.marks).forEach(function(id) {
      var m = rec.marks[id], w = staffById(id);
      if (!m || (m.st !== 'P' && m.st !== 'H')) return;
      if (areas.indexOf(m.area || (w && w.area) || 'flex') >= 0) ids.push(String(id));
    });
  }
  if (!ids.length) return { known: false, why: ot ? 'no OT block on the line names its crew' : 'nobody marked on the line that day' };
  return { known: true, src: src, ids: ids, names: ids.map(function(id) { var w = staffById(id); return w ? w.name : 'a hand since removed'; }) };
}

function prodGaugeRuleHas(clientId, part) {
  var w = (prodPartBase(part).toUpperCase().match(/[A-Z]+/) || [''])[0];
  return prodData().gaugeRules.some(function(x) { return String(x.clientId) === String(clientId) && x.family === w; });
}

/* ---------- The part a round's size gives ----------
   Owner, 30 Sep 2026: "56 is 3302 on VAT A2, 156 is 3303 on VAT A2. These two are a pair of set they call cover plate. The
   other 3302 is Assy bracket connector that's 50 per round in VAT A1." Samarth sends two parts ending 3302 and the register
   writes its work as TINA, so the code cannot say which; the pieces on a round, on its line, do (`S.production.partRules`:
   client, rack sizes, line, part number, the name the floor gives it). Unlike a gauge rule the line is required: the owner
   named each, and no page contradicts them. A code written that ends the rule's part, or one of the client's other ruled
   parts (the pair is written by either code), is read by the rule and a disagreement said; a code ending a part no rule
   names is kept as written. */
function prodPartRuleFor(clientId, rack, line) {
  if (clientId == null || !(rack > 0)) return null;
  return prodData().partRules.find(function(x) {
    return String(x.clientId) === String(clientId) && (x.racks || []).indexOf(rack) >= 0 && (!x.line || x.line === line);
  }) || null;
}
/* Another client's part at this round on this line, where exactly one rule says so: a round of 50 on A1 under Mehta's
   clamp, where Mehta's rules name no 50 and Samarth's connector is 50 on A1 (owner, 30 Sep 2026: "71 was the last round
   for Mehta and then 50 is Samarth"). Asked, never moved. */
function prodPartRuleOther(clientId, rack, line) {
  if (!(rack > 0)) return null;
  var hits = prodData().partRules.filter(function(x) { return String(x.clientId) !== String(clientId) && (x.racks || []).indexOf(rack) >= 0 && (!x.line || x.line === line); });
  var ids = {}; hits.forEach(function(x) { ids[x.clientId] = true; });
  if (Object.keys(ids).length !== 1) return null;
  var c = (S.clients || []).find(function(x) { return String(x.id) === String(hits[0].clientId); });
  return c ? { name: c.name, partNumber: hits[0].partNumber, partName: hits[0].name || '' } : null;
}
function prodPartRuleRead(clientId, rack, line, part) {
  var r = prodPartRuleFor(clientId, rack, line);
  if (!r) return null;
  var code = prodAliasCode(part), ends = function(pn) { return rateKey(pn).slice(-code.length) === code; };
  if (!code || ends(r.partNumber)) return { partNumber: r.partNumber, name: r.name || '' };
  var ruled = prodData().partRules.some(function(x) { return String(x.clientId) === String(clientId) && ends(x.partNumber); });
  return ruled ? { partNumber: r.partNumber, name: r.name || '', written: code } : { partNumber: null, rulePn: r.partNumber, name: r.name || '', written: code };
}

/* A part carried onto the customer above it under a ditto mark, of a kind that customer has never sent (owner, 30 Sep
   2026: "Samarth doesn't have clamp"). Null when the customer has sent the kind, or the part names no kind; else the
   kind, and the one client whose gauge rule covers it at this round, where exactly one does. */
function prodCarryCheck(clientId, part, rack) {
  var w = (prodPartBase(part).toUpperCase().match(/[A-Z]{3,}/) || [''])[0];
  if (!w) return null;
  if (prodClientParts(clientId).some(function(x) { return (String(x.partNumber) + ' ' + x.desc).toUpperCase().indexOf(w) >= 0; })) return null;
  var owners = {};
  if (rack > 0) prodData().gaugeRules.forEach(function(r) { if (r.family === w && (r.racks || []).indexOf(rack) >= 0 && String(r.clientId) !== String(clientId)) owners[r.clientId] = true; });
  var ids = Object.keys(owners), c = ids.length === 1 ? (S.clients || []).find(function(x) { return String(x.id) === ids[0]; }) : null;
  return c ? { family: w, clientId: c.id, name: c.name } : { family: w, clientId: null };
}

/* ---------- A code two parts end in, matched with the challans ----------
   Owner, 30 Sep 2026: a code two of the client's parts end in ("(0106)") is "checked and matched with recent IM, if
   available in the app. After a few matches it'll become clearer as both would have a different amount of them that can be
   plated in a round"; a group of codes in one figure ("(0106+3313)") is matched the same way. The client's challan lines
   ending in the code, with what is open on them and the last challan's date: the one with a challan open, or received in
   the 45 days before the day, where only one has; else the one plated before at this round on this line. Never learnt for
   the name, since the name is two parts. */
function prodCodeParts(clientId, code, date) {
  var out = {};
  (S.incomingMaterial || []).forEach(function(m) {
    if (String(m.clientId) !== String(clientId) || (date && m.challanDate > date)) return;
    (m.items || []).forEach(function(it) {
      var pn = String(it.partNumber || '').trim(), k = rateKey(pn);
      if (!pn || k.slice(-code.length) !== code) return;
      var o = out[k] || (out[k] = { partNumber: pn, open: 0, last: '', lastNo: '', lastQty: 0 });
      o.open += imLineOpen(it).qty;
      if (m.challanDate > o.last) { o.last = m.challanDate; o.lastNo = m.challanNo || ''; o.lastQty = 0; }
      if (m.challanDate === o.last) o.lastQty += Number(it.nosQty) || Number(it.qty) || 0;
    });
  });
  return Object.keys(out).map(function(k) { return out[k]; });
}
function prodPartRacks(clientId, partNumber, line) {
  var set = {}, k = rateKey(partNumber);
  prodData().entries.forEach(function(e) {
    if (e.voidedAt || e.kind !== 'plated' || e.line !== line || String(e.clientId) !== String(clientId) || !e.partNumber || rateKey(e.partNumber) !== k || e.partSrc === 'round') return;
    (e.rounds || []).forEach(function(r) { var n = r.rack || (!r.batch ? r.qty : null); if (n > 0) set[n] = true; });
  });
  return set;
}
function prodResolveCode(clientId, code, date, line, rack) {
  var c = prodCodeParts(clientId, code, date);
  if (c.length === 1) return { partNumber: c[0].partNumber, how: 'challan', open: c[0].open, lastQty: c[0].lastQty, why: 'the only part of the client’s ending in ' + code };
  if (!c.length) return null;
  var since = isoAddDays(date || localDateStr(), -45);
  var recent = c.filter(function(x) { return x.open > 0 || x.last >= since; });
  if (recent.length === 1) return { partNumber: recent[0].partNumber, how: 'challan', open: recent[0].open, lastQty: recent[0].lastQty, why: 'the one of ' + c.length + ' parts ending in ' + code + ' with a challan open or in the 45 days before' };
  var pool = recent.length ? recent : c;
  var withOpen = pool.filter(function(x) { return x.open > 0; });
  if (withOpen.length === 1) return { partNumber: withOpen[0].partNumber, how: 'challan', open: withOpen[0].open, lastQty: withOpen[0].lastQty, why: 'the one of ' + c.length + ' parts ending in ' + code + ' with a challan open' };
  // The part on the latest challan before the day (owner: "checked and matched with recent IM").
  var latest = pool.reduce(function(a, x) { return x.last > a ? x.last : a; }, '');
  var onLatest = pool.filter(function(x) { return x.last === latest; });
  if (onLatest.length === 1) return { partNumber: onLatest[0].partNumber, how: 'challan', open: onLatest[0].open, lastQty: onLatest[0].lastQty, why: 'the one of ' + c.length + ' parts ending in ' + code + ' on the latest challan' + (onLatest[0].lastNo ? ' (' + onLatest[0].lastNo + ', ' + formatDate(latest) + ')' : '') };
  if (rack > 0 && line) {
    var hit = pool.filter(function(x) { return prodPartRacks(clientId, x.partNumber, line)[rack]; });
    if (hit.length === 1) return { partNumber: hit[0].partNumber, how: 'round', open: hit[0].open, why: 'the one of ' + c.length + ' parts ending in ' + code + ' plated before at a round of ' + rack + ' on this line' };
  }
  return null;
}
function prodCodeGroup(part) {
  var m = /\(\s*(\d{3,5}(?:\s*\+\s*\d{3,5})+)\s*\)/.exec(String(part || ''));
  return m ? m[1].split('+').map(function(x) { return x.trim(); }) : null;
}
function prodEntryRack(e) {
  if (e.partRack) return e.partRack;
  var n = 0;
  (e.rounds || []).forEach(function(r) { var q = r.rack || (!r.batch ? r.qty : 0); if (q > n) n = q; });
  return n || e.rackSize || null;
}
/* For an entry with no part number yet: {partNumber, how, why}, {split: [{partNumber, open}]} for a group, or {why} to ask. */
function prodResolveEntryPart(e, rack) {
  if (e.clientId == null || e.partNumber || !e.part || e.kind === 'downtime') return null;
  var grp = prodCodeGroup(e.part);
  if (grp) {
    var parts = grp.map(function(code) { return prodResolveCode(e.clientId, code, e.date, e.line, null); });
    if (parts.some(function(x) { return !x; })) return { why: 'A figure for ' + e.part + ': not every code matched one of the client’s parts with a recent challan. Pick the parts by hand.' };
    // Shared by what is open on the challans, else by the pieces on each part's latest challan.
    var byOpen = parts.reduce(function(a, x) { return a + x.open; }, 0) > 0;
    if (!byOpen && !parts.reduce(function(a, x) { return a + x.lastQty; }, 0)) return { why: 'A figure for ' + e.part + ', and no challan of its parts to share it by. Enter each part by hand.' };
    return { split: parts.map(function(x) { return { partNumber: x.partNumber, open: byOpen ? x.open : x.lastQty }; }), by: byOpen ? 'the open challans' : 'the latest challans' };
  }
  var code = prodAliasCode(e.part);
  if (!code || prodCodeParts(e.clientId, code, e.date).length < 2) return null;
  return prodResolveCode(e.clientId, code, e.date, e.line, rack != null ? rack : prodEntryRack(e));
}

/* ---------- A round no rule names: flagged until its gauge is picked ----------
   Owner, 30 Sep 2026: "The ones that fall outside the range, raise a flag - resolvable." A run whose round size no gauge rule
   names keeps `gaugeUnknown` (the round) until a gauge is picked on it (Entries → Pick gauge). */
// A run corrected by another entry is not asked about: its correction carries the question on (P127).
function prodGaugeFlagged(e) { return !!(e && e.kind === 'plated' && !e.voidedAt && e.gaugeUnknown && !e.gauge && !prodIndex().replaced[e.id]); }
function prodGaugeChoices(e) {
  var w = (prodPartBase(e.part).toUpperCase().match(/[A-Z]+/) || [''])[0], out = [];
  var add = function(g) { g = String(g || '').toUpperCase().replace(/[×✕]/g, 'X'); if (g && out.indexOf(g) < 0) out.push(g); };
  prodData().gaugeRules.forEach(function(r) { if (String(r.clientId) === String(e.clientId) && r.family === w) (r.gauges || []).forEach(add); });
  (S.incomingMaterial || []).forEach(function(m) {
    if (String(m.clientId) !== String(e.clientId)) return;
    (m.items || []).forEach(function(it) { if ((String(it.partNumber || '') + ' ' + (it.desc || '')).toUpperCase().indexOf(w) >= 0) add(prodGaugeOf(it.partNumber, it.desc)); });
  });
  return out;
}

/* ---------- A floor name and the part it is ----------
   The register writes a part by its floor name, often with its code in brackets ("TINA(0160)", "KUDAL(0106)",
   "TINA(3303)"). A code that ends exactly one of the client's part numbers on its challans and invoices is that part: the
   entry takes it (`partNumber`) and the floor name is learnt for the client (`learn.parts`), so the name alone finds it
   next time. Two parts ending in the code are left for the owner to pick (Entries → Which part?). */
function prodClientParts(clientId) {
  var out = {};
  var master = {};
  (S.items || []).forEach(function(i) { if (i.partNumber && i.desc) master[rateKey(i.partNumber)] = i.desc; });
  var add = function(it) { var pn = String(it.partNumber || it.desc || '').trim(); if (!pn) return; var k = rateKey(pn); out[k] = out[k] || { partNumber: pn, desc: it.desc || master[k] || '', n: 0 }; out[k].n++; };
  (S.incomingMaterial || []).forEach(function(m) { if (String(m.clientId) === String(clientId)) (m.items || []).forEach(add); });
  (S.invoices || []).forEach(function(v) { if (v.status === 'active' && String(v.clientId) === String(clientId)) (v.items || []).forEach(add); });
  return Object.keys(out).map(function(k) { return out[k]; }).sort(function(a, b) { return b.n - a.n; });
}
function prodAliasCode(part) {
  var s = String(part || ''), m = /\(\s*(\d{3,5})\s*\)|[-\s](\d{4})\s*$/.exec(s);
  if (m) return m[1] || m[2];
  // A code written bare ("4206", "0160" under the client's name) is the part's code too (P127): the loads read as no part.
  m = /^\s*(\d{3,5})\s*$/.exec(s);
  return m ? m[1] : null;
}
function prodAliasName(part) { return String(part || '').replace(/[-\s]*\(\s*\d{3,5}\s*\)/, '').replace(/[-\s]+\d{4}\s*$/, '').trim(); }
function prodAliasCandidates(clientId, part) {
  var parts = prodClientParts(clientId), code = prodAliasCode(part), name = prodAliasName(part).toUpperCase();
  var byCode = code ? parts.filter(function(x) { return rateKey(x.partNumber).slice(-code.length) === code; }) : [];
  var byWord = name ? parts.filter(function(x) { return byCode.indexOf(x) < 0 && (String(x.partNumber) + ' ' + x.desc).toUpperCase().indexOf(name) >= 0; }) : [];
  // Two parts ending in the code ("Assy Bracket 3302" against a cover plate and a connector): the one whose description
  // carries every word of the name, when only one does.
  var words = name.split(/[^A-Z]+/).filter(function(w) { return w.length >= 3; });
  var byCodeWords = byCode.length > 1 && words.length ? byCode.filter(function(x) {
    var d = (String(x.partNumber) + ' ' + x.desc).toUpperCase();
    return words.every(function(w) { return d.indexOf(w) >= 0; });
  }) : [];
  return { code: code, byCode: byCode, byCodeWords: byCodeWords, byWord: byWord, all: parts };
}
function prodLearnAlias(clientId, part, gauge, partNumber, how) {
  var p = prodData(), rec = { partNumber: partNumber, gauge: gauge || '', how: how || 'set', at: Date.now() };
  p.learn.parts[prodKey(clientId, part, gauge)] = rec;
  // The name alone ("TINA" of "TINA(3303)") is learnt too, unless it was learnt as another part: one floor name for two
  // parts is ambiguous, and the name alone then finds neither. The owner's own pick wins.
  var nm = prodAliasName(part);
  if (nm && nm !== part) {
    var k2 = prodKey(clientId, nm, gauge), was = p.learn.parts[k2];
    if (how !== 'set' && was && (was.ambiguous || (was.partNumber && rateKey(was.partNumber) !== rateKey(partNumber))))
      p.learn.parts[k2] = { ambiguous: true, parts: (was.parts || [was.partNumber]).concat(was.parts && was.parts.indexOf(partNumber) >= 0 ? [] : [partNumber]), at: Date.now() };
    else p.learn.parts[k2] = rec;
  }
  prodTouch();
}
/* On entries just saved or imported: a bracketed code that names one part is learnt and taken. Returns how many. */
function prodLearnAliases(entries) {
  var n = 0, p = prodData();
  (entries || []).forEach(function(e) {
    if (e.clientId == null || !e.part || e.partNumber || e.kind === 'downtime') return;
    var known = p.learn.parts[prodKey(e.clientId, e.part, e.gauge)];
    if (known && known.partNumber) return;
    var c = prodAliasCandidates(e.clientId, e.part);
    var one = c.byCode.length === 1 ? c.byCode[0] : c.byCodeWords.length === 1 ? c.byCodeWords[0] : null;
    if (one) { prodLearnAlias(e.clientId, e.part, e.gauge, one.partNumber, c.byCode.length === 1 ? 'code' : 'code+name'); e.partNumber = one.partNumber; n++; return; }
    // Two parts end in the code: the recent challans, then the rounds, say which for this entry alone.
    var rs = prodResolveEntryPart(e);
    if (rs && rs.partNumber) { e.partNumber = rs.partNumber; e.partSrc = rs.how; n++; }
  });
  return n;
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
  return { clients: prodClientIndex(S.clients || [], prodData().learn.clients), roster: (S.staff || []).filter(function(w) { return w.active !== false; }), today: localDateStr(),
    partOwners: prodPartOwners(), gaugeRule: prodGaugeRuleFor, gaugeHas: prodGaugeRuleHas, partRule: prodPartRuleRead, partRuleOther: prodPartRuleOther, carryCheck: prodCarryCheck, resolvePart: prodResolveEntryPart };
}
/* Which clients a part has come from, off the challans and invoices of the last year: part key → client ids. A load
   with no client written whose part only one client has ever sent ("LINER", "188 CD") is read as that client, amber. */
function prodPartOwners() {
  var since = isoAddDays(localDateStr(), -365), out = {};
  var add = function(cid, part) {
    if (cid == null || !part) return;
    var k = prodPartKey(part);
    if (!k || k.length < 3) return;
    var o = out[k] || (out[k] = {});
    o[cid] = true;
  };
  (S.incomingMaterial || []).forEach(function(m) { if ((m.challanDate || '') >= since) (m.items || []).forEach(function(it) { add(m.clientId, it.partNumber); add(m.clientId, it.desc); }); });
  (S.invoices || []).forEach(function(v) { if ((v.date || '') >= since && v.status !== 'cancelled') (v.items || []).forEach(function(it) { add(v.clientId, it.partNumber); }); });
  var single = {};
  Object.keys(out).forEach(function(k) { var ids = Object.keys(out[k]); if (ids.length === 1) single[k] = ids[0]; });
  return single;
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
  // The entry's own part number (a round's rule, a code) is about this entry; a learnt name is about every entry under it.
  if (e.partNumber) return prodKey(e.clientId, e.partNumber, e.gauge);
  var map = prodData().learn.parts[prodKey(e.clientId, e.part, e.gauge)];
  if (map && map.partNumber) return prodKey(e.clientId, map.partNumber, map.gauge != null ? map.gauge : e.gauge);
  return prodKey(e.clientId, e.part, e.gauge);
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
  var w = prodKgPerPiece(e.clientId, e.date, e.partNumber || e.part, (e.part || '') + (e.gauge ? ' (' + e.gauge + ')' : ''));
  return w ? { kg: e.qty * w.kg, src: w.src } : { kg: null, src: null };
}
/* A part's kg per piece for one client on one day: the client's own card, then Settings' part weights, then the
   Items Master where the part number is held by one gauge. Null when unknown, never a guess. */
function prodKgPerPiece(clientId, date, part, desc) {
  if (clientId == null || !part) return null;
  // Keyed as prodKey is: the part without its gauge text, and the gauge on its own. The floor writes the gauge into
  // the part ("CLAMP133×83(35×6)") and the card, the part weights and the Items Master hold the part without it, so
  // the whole text found no weight anywhere.
  var pk = prodPartKey(part), g = prodGaugeOf(part, desc);
  if (!pk) return null;
  var client = (S.clients || []).find(function(c) { return String(c.id) === String(clientId); });
  var card = ((client && client.pieceWeights) || []).find(function(r) { return prodPartKey(r.partNumber) === pk; });
  var pw = card ? getPieceWeight(client, date, card.partNumber, g ? '(' + g + ')' : '') : null;
  if (pw && pw.kg) return { kg: pw.kg, src: 'client card' };
  var idx = prodKgIndex(), rows = idx[pk] || { pw: [], it: [] };
  var pwt = prodByGauge(rows.pw, g);
  if (pwt) return { kg: pwt.kg, src: 'part weights' };
  var it = prodByGauge(rows.it, g);
  return it && it.kg ? { kg: it.kg, src: 'items' } : null;
}
/* The part weights and Items Master rows by part key, built once per pass: prodKgPerPiece runs for every entry and every
   open challan line, and keyed every weight and item afresh each time (the review, 30 Sep 2026). Kept only until the
   pass ends (the next tick), so a weight edited afterwards is never read stale. */
var _prodKgIdx = null;
function prodKgIndex() {
  if (_prodKgIdx) return _prodKgIdx;
  var gOf = function(s) { return lineGauge(String(s || '').replace(/[×✕]/g, 'X')); };
  var idx = {}, at = function(k) { return idx[k] || (idx[k] = { pw: [], it: [] }); };
  Object.keys(S.partWeights || {}).forEach(function(k) {
    if (S.partWeights[k] > 0) { var pk = prodPartKey(k); if (pk) at(pk).pw.push({ g: gOf(k), kg: S.partWeights[k] }); }
  });
  (S.items || []).forEach(function(i) {
    var pk = prodPartKey(i.partNumber);
    if (pk) at(pk).it.push({ g: rateKey(i.gauge || '') || gOf(i.partNumber), kg: i.stdWeightKg });
  });
  _prodKgIdx = idx;
  setTimeout(function() { _prodKgIdx = null; }, 0);
  return idx;
}
/* One weight among a part's rows by the card's gauge rule (cardLookup): the rows at the line's gauge, else those with
   none written; a line with no gauge takes a part held by one gauge. Two gauges left is unknown, never averaged. */
function prodByGauge(list, g) {
  var pool = g ? list.filter(function(x) { return x.g === g; }) : [];
  if (!pool.length) pool = list.filter(function(x) { return !x.g; });
  if (!pool.length && !g) pool = list;
  var gs = {};
  pool.forEach(function(x) { gs[x.g] = true; });
  return pool.length && Object.keys(gs).length === 1 ? pool[0] : null;
}

/* ---------- A plated run's weight, by every route the book holds ----------
   Owner, 9 Oct 2026, on Production's tile: "Plated, last recorded day: 7,630 NOS + 150 kg … 0.68 t known, 14% of the pieces
   weighed … is not uniform enough to draw a full picture of what happened. We have data to analyse and represent it in a
   better way." The floor counts pieces and names a part by its kind ("CLAMP", "LINER", "Z(BKT)"), and only a part named
   exactly found a weight (prodKg: the client's card, part weights, the Items Master): on the owner's book 12% of the pieces
   plated in September were weighed. A run is now weighed by the surest route the book holds, and says which (`how`):
   - written: kilograms on the run itself;
   - record: the part's kg a piece on record (prodKg), for the part the floor name was learnt as too, or, for a client billed
     by the piece, its piece rate over its ₹ a kg (the arithmetic of the Items Master's derived weights: exact for tonnage);
   - challans: the challan lines In plant set the plating against (its own part, or the kind and gauge at the family level,
     oldest open first), each at its own kg a piece: its kilos over its count, its weight on record, or a piece client's
     amount over its ₹ a kg. Pieces past what those lines hold go at the same kg a piece;
   - kind: the client's own challans of that kind of part in the year before (CLAMP, LINER; BKT is BRACKET), at the run's
     gauge or the gauges its round allows: the median kg a piece by pieces, the middle 80% kept as the range (`low`, `high`);
   - null: none of these. Never a guess past them: the pieces are named, with the move that weighs them. */
var PROD_WEIGH_SYN = { BKT: 'BRACKET', BRKT: 'BRACKET', BRAKET: 'BRACKET', BRACKETS: 'BRACKET', CLAMPS: 'CLAMP', CLMP: 'CLAMP' };
var PROD_WEIGH_SKIP = { NT: 1, UT: 1, NO: 1, NOS: 1, PC: 1, PCS: 1, KG: 1, KGS: 1, MM: 1, AND: 1, THE: 1, OF: 1, FOR: 1, WITH: 1, NEW: 1, OLD: 1 };
var PROD_WEIGH_DAYS = 365;
/* The words a part's kind can be read from, in order: the letters of the part (a gauge, a size and a code carry none), each
   of two letters or more, an abbreviation spelt out. */
function prodWeighKinds(text) {
  return String(text || '').toUpperCase().replace(/\(\s*\d+\s*X\s*\d+\s*\)/g, ' ').replace(/[^A-Z]+/g, ' ').split(' ')
    .filter(function(w) { return w.length >= 2 && !PROD_WEIGH_SKIP[w]; }).map(function(w) { return PROD_WEIGH_SYN[w] || w; });
}
/* A challan line's kg a piece, or null: its kilos over its count, its weight on record, a piece client's amount over its
   ₹ a kg (no override: an override is a negotiated figure with no weight in it). */
function prodLineKgPc(m, it, client) {
  var unit = it.unit || 'KG';
  if (unit === 'KG' && it.nosQty > 0 && it.qty > 0) return { kg: it.qty / it.nosQty, src: 'challan' };
  if (unit !== 'NOS' || !(it.qty > 0)) return null;
  var w = prodKgPerPiece(m.clientId, m.challanDate, it.partNumber || it.desc, it.desc);
  if (w && w.kg > 0) return w;
  if (client && client.billingMode === 'piece' && it.amount > 0) {
    var ri = getLineItemRate(client, m.challanDate || localDateStr(), it.partNumber);
    if (!ri._override && ri.ratePerKg > 0) return { kg: it.amount / it.qty / ri.ratePerKg, src: 'rate card' };
  }
  return null;
}
/* What the weighing reads, worked out once a book: In plant's attribution of every run to its challan lines, and the
   clients' challan lines by kind. Kept until the book changes (a save moves _bookWrites, a new book is a new S). */
var _prodWeighIdx = null;
function prodWeighIndex() {
  var p = prodData();
  if (_prodWeighIdx && _prodWeighIdx.s === S && _prodWeighIdx.w === _bookWrites && _prodWeighIdx.v === _prodVer && _prodWeighIdx.p === p) return _prodWeighIdx;
  var clients = {};
  (S.clients || []).forEach(function(c) { clients[String(c.id)] = c; });
  // Each run's share of the challan lines In plant set it against: [{pcs, kg}] (kg null where the line has no weight).
  var alloc = {}, plant = prodInPlant({});
  (plant.lines || []).forEach(function(r) {
    var lu = r.R.NOS != null ? 'NOS' : 'KG', w = null;
    if (lu === 'NOS') w = r.it.unit === 'KG' && r.kpp ? r.kpp : prodLineKgPc(r.m, r.it, clients[String(r.m.clientId)]);
    r.A.L.forEach(function(a) {
      if (!a.e || !a.e.id || a.e.unit !== 'NOS') return;
      var list = alloc[a.e.id] || (alloc[a.e.id] = []);
      // A line held in kilos took the run's pieces through its kg a piece (In plant's own conversion).
      if (lu === 'KG') { if (r.kpp && r.kpp.kg > 0) list.push({ pcs: a.q / r.kpp.kg, kg: a.q }); }
      else list.push({ pcs: a.q, kg: w ? a.q * w.kg : null });
    });
  });
  // Every client's challan lines with a kg a piece, by kind: {clientId|KIND: [{date, g, kg, pcs}]}.
  var kinds = {};
  (S.incomingMaterial || []).forEach(function(m) {
    if (m.clientId == null) return;
    var c = clients[String(m.clientId)];
    (m.items || []).forEach(function(it) {
      var w = prodLineKgPc(m, it, c);
      if (!w || !(w.kg > 0) || w.kg > 100) return;
      var pcs = (it.unit || 'KG') === 'KG' ? it.nosQty : it.qty;
      var g = prodGaugeOf(it.partNumber, it.desc), seen = {};
      prodWeighKinds(it.partNumber).concat(prodWeighKinds(it.desc)).forEach(function(k) {
        if (seen[k]) return;
        seen[k] = true;
        (kinds[m.clientId + '|' + k] = kinds[m.clientId + '|' + k] || []).push({ date: m.challanDate || '', g: g, kg: w.kg, pcs: pcs });
      });
    });
  });
  _prodWeighIdx = { s: S, w: _bookWrites, v: _prodVer, p: p, alloc: alloc, kinds: kinds, byId: {} };
  return _prodWeighIdx;
}
/* The median and the middle 80% of kg a piece over lines, each counted by its pieces. */
function prodWeighSpread(rows) {
  var list = rows.slice().sort(function(a, b) { return a.kg - b.kg; }), tot = list.reduce(function(s, x) { return s + x.pcs; }, 0);
  var at = function(q) { var run = 0; for (var i = 0; i < list.length; i++) { run += list[i].pcs; if (run >= q * tot) return list[i].kg; } return list[list.length - 1].kg; };
  return { kg: at(0.5), low: at(0.1), high: at(0.9), n: list.length };
}
/* The part a run's floor name was learnt as, or null. */
function prodWeighLearnt(e) {
  if (e.partNumber || e.clientId == null || !e.part) return null;
  var map = prodData().learn.parts[prodKey(e.clientId, e.part, e.gauge)];
  return map && map.partNumber ? map.partNumber : null;
}
function prodWeigh(e) {
  if (!e || e.qty == null) return { kg: null, how: null };
  var w0 = prodKg(e);
  if (w0.kg != null) return { kg: w0.kg, how: w0.src === 'kg' ? 'written' : 'record', src: w0.src };
  if (e.unit !== 'NOS' || e.clientId == null) return { kg: null, how: null };
  var idx = prodWeighIndex();
  if (e.id && idx.byId[e.id]) return idx.byId[e.id];
  var res = prodWeighOf(e, idx);
  if (e.id) idx.byId[e.id] = res;
  return res;
}
function prodWeighOf(e, idx) {
  var client = (S.clients || []).find(function(c) { return String(c.id) === String(e.clientId); }) || null;
  var desc = (e.part || '') + (e.gauge ? ' (' + e.gauge + ')' : '');
  // On record: the part the name was learnt as, then a piece client's rate card for the part.
  var pn = e.partNumber || prodWeighLearnt(e) || e.part;
  if (pn !== (e.partNumber || e.part)) {
    var wl = prodKgPerPiece(e.clientId, e.date, pn, desc);
    if (wl && wl.kg > 0) return { kg: e.qty * wl.kg, how: 'record', src: wl.src + ', as ' + pn, kgPc: wl.kg };
  }
  if (client && client.billingMode === 'piece') {
    var pr = getPieceRate(client, e.date, pn, desc), per = clientLadderRate(client, e.date);
    if (pr && pr.rate > 0 && per > 0) return { kg: e.qty * pr.rate / per, how: 'record', src: 'rate card', kgPc: pr.rate / per };
  }
  // From the challans the plating was set against.
  var al = idx.alloc[e.id] || [], pcs = 0, kg = 0;
  al.forEach(function(a) { if (a.kg != null) { pcs += a.pcs; kg += a.kg; } });
  if (pcs > 0.0005 && kg > 0) return { kg: e.qty * kg / pcs, how: 'challans', src: 'challans', kgPc: kg / pcs, part: Math.min(1, pcs / e.qty) };
  // By its kind: the client's challans of that kind, at its gauge (or the gauges its round allows), in the year before.
  var gs = e.gauge ? [e.gauge] : (e.gaugeOptions || []), from = isoAddDays(e.date, -PROD_WEIGH_DAYS), to = isoAddDays(e.date, 1);
  var words = prodWeighKinds(e.partNumber || e.part);
  for (var i = 0; i < words.length; i++) {
    var rows = (idx.kinds[e.clientId + '|' + words[i]] || []).filter(function(x) {
      return x.date >= from && x.date <= to && (!gs.length || gs.indexOf(x.g) >= 0 || (e.gauge && !x.g));
    });
    if (rows.length < 2) continue;
    var sp = prodWeighSpread(rows);
    return { kg: e.qty * sp.kg, how: 'kind', src: words[i], kgPc: sp.kg, low: e.qty * sp.low, high: e.qty * sp.high, lines: sp.n, gauges: gs.slice() };
  }
  return { kg: null, how: null };
}
/* A counted plated run in pieces that no route weighs (Entries' "Not weighed", the To-do's follow-up). */
function prodIsUnweighed(e, idx) {
  idx = idx || prodIndex();
  return !!e && e.kind === 'plated' && !e.voidedAt && e.unit === 'NOS' && e.qty != null && !!idx.countedSet[e.id] && prodWeigh(e).kg == null;
}
/* A plated weight said one way everywhere: tonnes from a tonne, kilograms under it; "≈" where any of it is estimated, "≥"
   where pieces nothing weighs are left out of it (the figure is then the least it can be). */
function prodKgFig(kg, est, atLeast) {
  if (!(kg > 0)) return '';
  return (atLeast ? '≥ ' : est ? '≈ ' : '') + (kg >= 1000 ? formatNum(kg / 1000, 2) + ' t' : formatNum(kg, 0) + ' kg');
}
var PROD_WEIGH_WORD = { written: 'kilos written', record: 'a weight on record', challans: 'from the challans it was set against', kind: 'estimated by its kind' };

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
    // A round's own figure is a rack; a batch's (an END row's "98×8+1") is a total, whose rack is its written factor.
    (e.rounds || []).forEach(function(r) {
      if (r.struck || r.start) return;
      if (r.rack) o[r.rack] = (o[r.rack] || 0) + (r.n || 1);
      else if (!r.batch && r.qty > 0) o[r.qty] = (o[r.qty] || 0) + 1;
    });
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
      var z = row.rackSize || (row.batch ? null : row.qty);
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
      var next = loads[li + 1], nextWd = isoAddDays(load.date, new Date(load.date + 'T00:00:00').getDay() === 6 ? 2 : 1);
      var got = [], sum = 0;
      pool.forEach(function(p) {
        if (used[p.id]) return;
        if (load.qty != null && load.unit === p.unit && sum >= load.qty) return;
        var sameDay = p.date === load.date && (!p.time || !load.time || relayParseHhmm(p.time) >= relayParseHhmm(load.time) - 30);
        var nextDay = p.date === nextWd && (!p.time || relayParseHhmm(p.time) < 720);
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

/* A day's power cuts, as one list. The pickling hand's messages and the register's power log report the same cut
   twice, a minute or two apart. A cut from one source is joined to a cut from ANOTHER source that overlaps it or began
   within ten minutes of it (the earliest cut, the latest return); two cuts in one source are two cuts, however close
   (25 Sep's log: 11:16–11:21 and 11:26–12:00). So a cut is never counted twice, and never merged away. */
function prodDowntimeDay(date) {
  // The source is the log or message a cut was read from. An imported entry keeps its own photo or message where the
  // file carries one; else the file and what reported it (the register, the pickling hand) stand in, since one file
  // holds every report of a cut and keying on the file alone counted one cut twice.
  var list = prodIndex().live.filter(function(e) { return e.kind === 'downtime' && e.date === date && relayParseHhmm(e.time) != null; })
    .map(function(e) { return { from: relayParseHhmm(e.time), to: relayParseHhmm(e.to), ids: [e.id], srcs: [e.photoId || e.pasteId || (e.importId ? e.importId + '|' + (e.basis || '') : e.id)] }; })
    .sort(function(a, b) { return a.from - b.from; });
  var out = [];
  list.forEach(function(x) {
    var hit = out.find(function(y) {
      return y.srcs.indexOf(x.srcs[0]) < 0 && (Math.abs(x.from - y.from) <= 10 || (y.to != null && x.from <= y.to && (x.to == null || x.to >= y.from)));
    });
    if (hit) {
      hit.ids = hit.ids.concat(x.ids); hit.srcs = hit.srcs.concat(x.srcs);
      if (x.from < hit.from) hit.from = x.from;
      if (x.to != null && (hit.to == null || x.to > hit.to)) hit.to = x.to;
      return;
    }
    out.push(x);
  });
  return out.sort(function(a, b) { return a.from - b.from; }).map(function(x) {
    return { time: prodHhmm(x.from), to: x.to == null ? null : prodHhmm(x.to), min: x.to != null && x.to > x.from ? x.to - x.from : 0, ids: x.ids, reports: x.srcs.length };
  });
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
/* The lines with a general-shift record counted, by day: {date: {line: true}}. */
function prodGeneralLines() {
  var gen = {};
  prodIndex().counted.forEach(function(e) { if (e.slot !== 'ot' && e.line) (gen[e.date] = gen[e.date] || {})[e.line] = true; });
  return gen;
}
/* The plating lines a day's marks put heads on: {line: true}. */
function prodStaffedLines(day) {
  var staffed = {};
  if (!day || !day.marks) return staffed;
  Object.keys(day.marks).forEach(function(id) {
    var mk = day.marks[id];
    if (!mk || (mk.st && mk.st !== 'P' && mk.st !== 'H')) return;
    var a = mk.area || '';
    if (a === 'vat-a1' || a === 'vat-a2' || a === 'barrel') staffed[a] = true;
  });
  return staffed;
}
/* A complete day: attendance recorded, and every line that had heads that day has a general-shift record. */
function prodCompleteDays(from, to) {
  var att = S.attendance || {}, out = [];
  var gen = prodGeneralLines();
  for (var d = from, g = 0; d <= to && g < 400; d = isoAddDays(d, 1), g++) {
    var day = att[d];
    if (!day || !day.marks) continue;
    var lines = Object.keys(prodStaffedLines(day));
    if (!lines.length) continue;
    if (lines.every(function(l) { return gen[d] && gen[d][l]; })) out.push(d);
  }
  return out;
}

/* Plated output of a line on a day: the pieces and the kilograms, each run weighed by the surest route the book holds
   (prodWeigh): `by` the kilograms by route, `est` those estimated (from the challans or by kind), `low` / `high` the range the
   kind estimates allow, `unweighed` the pieces no route weighs. Rework is named apart (it counts as work). */
function prodDayLine(date, line) {
  var r = { nos: 0, kg: 0, pieces: 0, weighedPieces: 0, unweighed: 0, rounds: 0, entries: [], rework: 0,
    by: { written: 0, record: 0, challans: 0, kind: 0 }, est: 0, low: 0, high: 0, kgWritten: 0 };
  prodIndex().counted.forEach(function(e) {
    if (e.date !== date || e.line !== line || e.qty == null) return;
    r.entries.push(e);
    if (e.rework) r.rework++;
    var w = prodWeigh(e);
    if (e.unit === 'NOS') { r.nos += e.qty; r.pieces += e.qty; if (w.kg != null) r.weighedPieces += e.qty; else r.unweighed += e.qty; }
    else if (e.unit === 'KG') r.kgWritten += e.qty;
    if (w.kg != null) {
      r.kg += w.kg; r.by[w.how] += w.kg;
      r.low += w.low != null ? w.low : w.kg; r.high += w.high != null ? w.high : w.kg;
      if (w.how === 'challans' || w.how === 'kind') r.est += w.kg;
    }
    // A batch written as racks × rounds ("98×8+1", an END row) is its rounds, not one.
    (e.rounds || []).forEach(function(x) { if (!x.struck) r.rounds += x.n > 0 ? x.n : 1; });
    if (!e.rounds && e.racks) r.rounds += e.racks;
  });
  r.weighedShare = r.pieces ? r.weighedPieces / r.pieces : 1;
  return r;
}
/* A day's plating over the three lines, as Production's tile reads it (Overview; Floor → Day): the tonnes are the figure
   only where 90% of the pieces are weighed, else the pieces are (with any kilo lines' kg). `lines` holds each line with
   a record that day. */
function prodDayPlated(date) {
  var o = { kg: 0, nos: 0, weighed: 0, kgLines: 0, est: 0, unweighed: 0, lines: {} };
  PROD_LINES.forEach(function(l) {
    var r = prodDayLine(date, l);
    o.kg += r.kg; o.nos += r.nos; o.weighed += r.weighedPieces; o.kgLines += r.kgWritten; o.est += r.est; o.unweighed += r.unweighed;
    if (r.entries.length) o.lines[l] = true;
  });
  o.share = o.nos ? o.weighed / o.nos : 1;
  o.whole = o.share >= 0.9;
  // One unit: the tonnes, "≈" where any run is estimated; only a day nothing weighs is its pieces.
  o.text = o.kg > 0 ? prodKgFig(o.kg, o.est > 0.0005, o.unweighed > 0) : Math.round(o.nos).toLocaleString('en-IN') + ' NOS';
  o.sub = prodPlatedSub(o.nos, o.kgLines, o.kg, o.est, o.unweighed);
  return o;
}
/* What a plated figure rests on, in a line: what was recorded, how much of the weight is estimated, what nothing weighs. */
function prodPlatedSub(pieces, kgWritten, kg, est, unweighed) {
  var rec = [pieces ? Math.round(pieces).toLocaleString('en-IN') + ' pieces' : '', kgWritten ? formatNum(kgWritten, 0) + ' kg' : ''].filter(Boolean).join(' and ');
  return [rec ? rec + ' recorded' : '', !(kg > 0) ? '' : est > 0.0005 ? Math.round(est / kg * 100) + '% of the weight estimated' : unweighed ? '' : 'every run weighed',
    unweighed ? Math.round(unweighed).toLocaleString('en-IN') + ' pieces not weighed' : ''].filter(Boolean).join(' · ');
}
/* ---------- A day's plating, the whole picture ----------
   One figure in one unit for the day, with how much of it is estimated, each line's runs on the clock, the clients, the
   pieces nothing weighs (named, with the move that weighs them), the cuts and the loads; against two shifts' capacity and
   the plant's usual day. Read by Production's day card (prodview.js), Floor → Day and Pulse; worked out, never stored. */
function prodDayPicture(date) {
  var pic = { date: date, lines: {}, ran: [], kg: 0, est: 0, low: 0, high: 0, pieces: 0, kgWritten: 0, unweighed: 0, runs: 0,
    by: { written: 0, record: 0, challans: 0, kind: 0 }, clients: [], names: [], spans: {}, from: null, to: null };
  var clients = {}, names = {};
  PROD_LINES.forEach(function(l) {
    var r = prodDayLine(date, l);
    pic.lines[l] = r;
    pic.spans[l] = [];
    if (!r.entries.length) return;
    pic.ran.push(l);
    pic.kg += r.kg; pic.est += r.est; pic.low += r.low; pic.high += r.high; pic.pieces += r.pieces; pic.kgWritten += r.kgWritten;
    pic.unweighed += r.unweighed; pic.runs += r.entries.length;
    Object.keys(r.by).forEach(function(k) { pic.by[k] += r.by[k]; });
    r.entries.forEach(function(e) {
      var w = prodWeigh(e), ck = e.clientId != null ? String(e.clientId) : '?' + (e.client || '');
      var c = clients[ck] || (clients[ck] = { clientId: e.clientId, name: e.clientId != null ? prodClientName(e.clientId) || e.client || '' : e.client || 'No client written', kg: 0, est: 0, pieces: 0, kgWritten: 0, unweighed: 0 });
      if (w.kg != null) { c.kg += w.kg; if (w.how === 'challans' || w.how === 'kind') c.est += w.kg; }
      if (e.unit === 'NOS') { c.pieces += e.qty; if (w.kg == null) c.unweighed += e.qty; } else if (e.unit === 'KG') c.kgWritten += e.qty;
      if (w.kg == null && e.unit === 'NOS') {
        var nk = ck + '|' + String(e.part || '').toUpperCase();
        var n = names[nk] || (names[nk] = { clientId: e.clientId, client: c.name, part: e.part || '', pieces: 0, id: e.id, lines: [] });
        n.pieces += e.qty;
        if (l && n.lines.indexOf(l) < 0) n.lines.push(l);
      }
      // On the clock: a run from its start to its last round; one with no time (the barrel list is the whole day's) is not drawn.
      var a = relayParseHhmm(e.time), b = relayParseHhmm(e.to);
      if (a == null) return;
      if (a < PROD_DAY_START) a += 1440;
      if (b == null) b = a; else { if (b < PROD_DAY_START) b += 1440; if (b < a) b += 1440; }
      pic.spans[l].push({ from: a, to: b, e: e });
      if (pic.from == null || a < pic.from) pic.from = a;
      if (pic.to == null || b > pic.to) pic.to = b;
    });
  });
  pic.clients = Object.keys(clients).map(function(k) { return clients[k]; }).sort(function(a, b) { return b.kg - a.kg || b.pieces - a.pieces; });
  pic.names = Object.keys(names).map(function(k) { return names[k]; }).sort(function(a, b) { return b.pieces - a.pieces; });
  // The lines that had heads on the general shift and no record of it: the day's figure is short of them.
  var att = (S.attendance || {})[date], staffed = prodStaffedLines(att), gen = prodGeneralLines()[date] || {};
  pic.attendance = !!(att && att.marks && Object.keys(att.marks).length);
  pic.missing = PROD_LINES.filter(function(l) { return staffed[l] && !gen[l]; });
  pic.weighedShare = pic.pieces ? (pic.pieces - pic.unweighed) / pic.pieces : 1;
  pic.cuts = typeof powerCuts === 'function' ? powerCuts(date, date) : [];
  pic.loads = prodDayLoads(date).length;
  pic.capacity = STATS_CAPACITY_KG_DAY;
  pic.usual = prodUsualDay(date);
  // Each line's units on the day (the plant register) and its heads against the day's number (Floor → Day's own reading).
  var byArea = {};
  if (pic.attendance && typeof areaStats === 'function') areaStats(date, date).rows.forEach(function(a) { byArea[a.id] = a; });
  pic.equip = {}; pic.crew = {};
  PROD_LINES.forEach(function(l) {
    if (typeof pltCapacity === 'function') { var cap = pltCapacity(l, date); if (cap.n) pic.equip[l] = cap; }
    var fl = typeof FLR_LINES !== 'undefined' ? FLR_LINES.find(function(x) { return x.id === l; }) : null;
    if (fl && pic.attendance) pic.crew[l] = flrStaffing(date, fl, byArea, true);
  });
  // What the day's work is worth at the rates on record (what it will bill), and the labour the day's record holds.
  pic.worth = prodDayWorth(date);
  pic.labour = pic.attendance && typeof labourForRange === 'function' ? labourForRange(date, date).total : null;
  return pic;
}
/* What a day's plating is worth at its clients' rates on record: a piece client's part at its piece rate, a run in kilos at
   the client's ₹ a kg, a run in pieces at the client's ₹ a kg over its weight (estimated where the weight is). Rework is
   not billed and is left out (owner, 28 Sep 2026). {amount, est, unpriced: pieces with neither}. */
function prodDayWorth(date) {
  var o = { amount: 0, est: false, unpriced: 0, runs: 0 };
  prodIndex().counted.forEach(function(e) {
    if (e.date !== date || e.kind !== 'plated' || e.qty == null || e.rework || e.clientId == null) return;
    var client = (S.clients || []).find(function(c) { return String(c.id) === String(e.clientId); });
    if (!client) { if (e.unit === 'NOS') o.unpriced += e.qty; return; }
    var pn = e.partNumber || prodWeighLearnt(e) || e.part || '', desc = (e.part || '') + (e.gauge ? ' (' + e.gauge + ')' : '');
    var rr = getRateOnRecord(client, e.date, { partNumber: pn, desc: desc, unit: e.unit === 'KG' ? 'KG' : 'NOS' });
    var w = prodWeigh(e), amt = null;
    if (rr && rr.rate > 0 && rr.fits !== false) {
      if (rr.unit === 'piece' && e.unit === 'NOS') amt = rr.rate * e.qty;
      else if (rr.unit === 'kg' && w.kg != null) { amt = rr.rate * w.kg; if (w.how === 'challans' || w.how === 'kind') o.est = true; }
    }
    if (amt == null) {
      var per = clientLadderRate(client, e.date);
      if (per > 0 && w.kg != null) { amt = per * w.kg; if (w.how === 'challans' || w.how === 'kind') o.est = true; }
    }
    if (amt == null) { if (e.unit === 'NOS') o.unpriced += e.qty; return; }
    o.amount += amt; o.runs++;
  });
  o.amount = gstRound(o.amount);
  return o;
}
var PROD_DAY_START = 360;   // the shop's day on the clock: 6 AM, when the morning block starts, to 6 AM the next
/* The plant's usual day before this one: the median kilograms of the recorded days in the 60 before it, each with nine
   tenths of its pieces weighed (a day mostly unweighed would read low), and at least five of them. Null otherwise. */
function prodUsualDay(date) {
  var from = isoAddDays(date, -60), days = {};
  prodIndex().counted.forEach(function(e) { if (e.kind === 'plated' && e.date >= from && e.date < date) days[e.date] = true; });
  var kgs = Object.keys(days).map(function(d) {
    var kg = 0, pcs = 0, un = 0;
    PROD_LINES.forEach(function(l) { var r = prodDayLine(d, l); kg += r.kg; pcs += r.pieces; un += r.unweighed; });
    return pcs && un / pcs > 0.1 ? null : kg;
  }).filter(function(x) { return x != null && x > 0; });
  return kgs.length >= 5 ? numMedian(kgs) : null;
}

/* ---------- A line's efficiency on a day ----------
   Owner, 9 Oct 2026: "where it says VAT A1 did a particular amount of production, calculate its efficiency as well, we can
   do a follow up if needed. That is how the colour code of the gradient for cards in this tab will be decided. Barrel is
   also a special case as 50% of it is down." What the line plated against what its working units could plate in the time it
   ran, every input said so it can be checked:
   - a round: the kg a round of the line's units working that day (the plant register, read as found before it was set up);
     the share of the line's kg a round that stood down is said, and half or more down colours the card;
   - how long a round takes: the line's own pace (the planner's: set, else the register's rounds over three months, else
     assumed, and it says which);
   - the time it ran: the general shift (8:30 AM to 5 PM) where it ran or had heads on it, and each overtime run from its
     start to its end (a morning run with no end ends at 8:30), less the power cuts inside that time;
   - what it plated: the day's weight (prodWeigh), "≈" where estimated.
   Where the register counted the rounds, it is split into the pace (rounds run of the rounds the time allowed) and the load
   (kilos a round of what the working units hold). A figure missing is said, never guessed: the line is then not judged. */
var PROD_EFF_OK = 0.75, PROD_EFF_LOW = 0.5;
function prodLineEfficiency(date, line) {
  var r = prodDayLine(date, line);
  var o = { line: line, date: date, kg: r.kg, est: r.est > 0.0005, unweighed: r.unweighed, pieces: r.pieces, rounds: r.rounds, ran: r.entries.length > 0,
    eff: null, pace: null, load: null, possible: null, minutes: null, cutMin: 0, noEnd: 0, avail: null, tone: 'neutral', word: '', why: '' };
  var cap = typeof pltCapacity === 'function' ? pltCapacity(line, date) : null;
  if (cap && cap.n) { o.n = cap.n; o.nAvail = cap.nAvail; o.kgAvail = cap.kgAvail; o.kgTotal = cap.kgTotal; o.byKg = cap.byKg; o.avail = cap.pct; o.down = cap.down; o.unitWord = cap.units.every(function(u) { return u.kind === 'barrel'; }) ? 'barrel' : 'tank'; }
  var L = null;
  try { var B = typeof plnBase === 'function' ? plnBase() : null; L = B && B.lines ? B.lines[line] : null; } catch (e) { L = null; }
  if (L && L.every > 0) { o.every = L.every; o.everySrc = L.src; }
  // The time it ran, on the shop's day (6 AM to 6 AM the next): windows merged, the cuts inside them taken out.
  var att = (S.attendance || {})[date], staffed = !!prodStaffedLines(att)[line];
  var wins = [];
  if (staffed || r.entries.some(function(e) { return e.slot !== 'ot' && e.slot !== 'day'; })) wins.push([RELAY_GENERAL, RELAY_GENERAL_OUT]);
  var on = function(m) { return m < PROD_DAY_START ? m + 1440 : m; };
  r.entries.forEach(function(e) {
    if (e.slot !== 'ot') return;
    var a = relayParseHhmm(e.time), b = relayParseHhmm(e.to);
    if (a == null) { o.noEnd++; return; }
    a = on(a);
    if (b == null) { if (a < RELAY_GENERAL) b = RELAY_GENERAL; else { o.noEnd++; return; } } else { b = on(b); if (b < a) b += 1440; }
    wins.push([a, b]);
  });
  wins.sort(function(x, y) { return x[0] - y[0]; });
  var merged = [];
  wins.forEach(function(w) { var last = merged[merged.length - 1]; if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]); else merged.push([w[0], w[1]]); });
  var span = merged.reduce(function(s2, w) { return s2 + (w[1] - w[0]); }, 0);
  (typeof powerCuts === 'function' ? powerCuts(date, date) : []).forEach(function(c) {
    if (c.from == null) return;
    // powerCuts runs a cut past midnight on past 1440; on the 6 AM day, a cut before 6 AM is the night's end.
    var a = on(c.from), b = c.to == null ? a : c.to + (c.from < PROD_DAY_START ? 1440 : 0);
    if (b < a) b += 1440;
    merged.forEach(function(w) { o.cutMin += Math.max(0, Math.min(b, w[1]) - Math.max(a, w[0])); });
  });
  o.windows = merged;
  o.minutes = Math.max(0, span - o.cutMin);
  // Judged only with every input: a record, the units' kg a round, a pace and some time.
  var missing = staffed && !(prodGeneralLines()[date] || {})[line];
  if (!o.ran && !staffed) { o.word = 'Did not run'; return o; }
  if (missing && !o.ran) { o.tone = 'warning'; o.word = 'No record'; o.why = 'heads on the general shift, nothing recorded'; return o; }
  if (!o.n) o.why = 'no unit on the plant register';
  else if (!o.byKg) o.why = 'set the kg a round of every unit';
  else if (!o.every) o.why = 'no pace for the line';
  else if (!(o.minutes > 0)) o.why = 'no time worked recorded';
  if (!o.why) {
    var roundsPossible = o.minutes / o.every;
    o.roundsPossible = roundsPossible;
    o.possible = o.kgAvail * roundsPossible;
    if (o.possible > 0) o.eff = o.kg / o.possible;
    if (o.rounds > 0 && roundsPossible > 0 && o.kgAvail > 0) { o.pace = o.rounds / roundsPossible; o.load = o.kg / o.rounds / o.kgAvail; }
  }
  // The colour: the efficiency, then a line half or more down (owner: "Barrel is also a special case"), then a missing record.
  var rank = { neutral: 0, ok: 1, info: 1, warning: 2, danger: 3 }, worst = function(t) { if (rank[t] > rank[o.tone]) o.tone = t; };
  if (o.eff != null) {
    if (o.eff > 1.1) { o.tone = 'info'; o.word = 'Over what its units can do'; o.why = 'check the kg a round or the pace'; }
    else { o.tone = o.eff >= PROD_EFF_OK ? 'ok' : o.eff >= PROD_EFF_LOW ? 'warning' : 'danger'; o.word = Math.round(o.eff * 100) + '% efficient'; }
  } else o.word = 'Not judged';
  if (o.avail != null && o.avail <= 0.5) { worst('danger'); o.halfDown = true; }
  if (missing) { worst('warning'); o.missing = true; }
  return o;
}

/* The plant's efficiency on a day: what the lines it could judge plated, against what their working units could plate in the
   time each ran (prodLineEfficiency, line by line). Null where no line is judged. */
function prodDayEfficiency(date) {
  var kg = 0, possible = 0, n = 0, lines = {};
  PROD_LINES.forEach(function(l) { var o = prodLineEfficiency(date, l); lines[l] = o; if (o.eff != null && o.eff <= 1.1) { kg += o.kg; possible += o.possible; n++; } });
  var eff = possible > 0 ? kg / possible : null;
  return { eff: eff, lines: lines, n: n, kg: kg, possible: possible, tone: eff == null ? 'neutral' : eff >= PROD_EFF_OK ? 'ok' : eff >= PROD_EFF_LOW ? 'warning' : 'danger' };
}
/* A day's pickling loads, earliest first: what Production → Lines lists on Pickling, and Floor → Day's Pickling card. */
function prodDayLoads(date) {
  var idx = prodIndex();
  return idx.live.filter(function(e) { return e.kind === 'pickled' && e.date === date && !idx.replaced[e.id]; })
    .sort(function(a, b) { return String(a.time || '').localeCompare(String(b.time || '')); });
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
  var idx = prodIndex(), today = localDateStr(), since = opts.since || isoAddDays(today, -30);
  var lines = [], byKey = {}, invDate = {};
  (S.invoices || []).forEach(function(v) { if (v && v.id) invDate[v.id] = v.date || ''; });
  (S.incomingMaterial || []).forEach(function(m) {
    if (opts.clientId != null && String(m.clientId) !== String(opts.clientId)) return;
    (m.items || []).forEach(function(it) {
      var o = imLineOpen(it);
      var k = prodChallanKey(m, it), fam = prodFamilyKey(m.clientId, it.partNumber || it.desc, prodGaugeOf(it.partNumber, it.desc));
      var nosLine = it.unit === 'NOS', kgLine = it.unit === 'KG', hasNos = nosLine || it.nosQty > 0;
      var rec = { m: m, it: it, key: k, fam: fam, date: m.challanDate || '', open: o, amount: o.amount,
        R: { NOS: hasNos ? (nosLine ? (it.qty || 0) : (it.nosQty || 0)) : null, KG: kgLine ? (it.qty || 0) : null },
        openQ: { NOS: hasNos ? (nosLine ? o.qty : o.nos) : null, KG: kgLine ? o.qty : null },
        P: { NOS: 0, KG: 0 }, L: { NOS: 0, KG: 0 }, A: { P: [], L: [] } };
      // Received by the kilo with no count, and the part's kg per piece known: the pieces are worked out, because the
      // floor counts pieces. Said as worked out, with the weight and where it came from.
      // A kilo line that also counts its pieces carries its own kg per piece; that wins over any card.
      var kpp = kgLine && it.nosQty > 0 && it.qty > 0 ? { kg: it.qty / it.nosQty, src: 'challan' } : prodKgPerPiece(m.clientId, m.challanDate, it.partNumber || it.desc, it.desc);
      if (kpp && kpp.kg > 0) rec.kpp = kpp;
      if (kgLine && !hasNos && rec.kpp) {
        rec.R.NOS = Math.round((it.qty || 0) / kpp.kg);
        rec.openQ.NOS = Math.round(o.qty / kpp.kg);
        rec.derived = true;
      }
      // A line billed whole is closed on its last invoice's day: plating recorded after that is of other material.
      if (it.invoiced) {
        var ids = it.invoiceIds && it.invoiceIds.length ? it.invoiceIds : (it.invoiceId ? [it.invoiceId] : []);
        rec.closedOn = ids.map(function(id) { return invDate[id] || ''; }).sort().pop() || '';
      }
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
    if (!pool && prodIsGeneric(e.partNumber || e.part)) {
      // Only a record naming just the kind and gauge is set against the family; a named part with no challan of its
      // own is on the floor with no challan, never someone else's.
      var fk = prodFamilyKey(e.clientId, e.partNumber || e.part, e.gauge);
      // A gauge read only as one of a few (the rack's rule) is set against the family's challans at any of them.
      var fks = !e.gauge && e.gaugeOptions ? e.gaugeOptions.map(function(g) { return prodFamilyKey(e.clientId, e.partNumber || e.part, g); }) : [fk];
      pool = lines.filter(function(r) { return fks.indexOf(r.fam) >= 0; });
      if (pool.length) famUsed++;
    }
    var left = e.qty, u = e.unit;
    (pool || []).forEach(function(r) {
      if (left <= 0) return;
      // A line held in the other unit takes the entry through the part's kg per piece: kilograms plated of a part
      // the challan counts, or pieces of one it weighs. With no weight known it cannot be compared, and is left.
      // Everything is set against the line in the unit it is shown in: pieces wherever it has a count.
      var lu = r.R.NOS != null ? 'NOS' : 'KG', f = 1;
      if (lu !== u) { if (!r.kpp) return; f = u === 'KG' ? 1 / r.kpp.kg : r.kpp.kg; }
      if (r.date && r.date > isoAddDays(e.date, 1)) return;
      if (r.closedOn !== undefined && (!r.closedOn || r.closedOn < e.date)) return;
      var room = r.R[lu] - r[field][lu];
      if (room <= 0) return;
      var take = Math.min(room, left * f);
      r[field][lu] += take; left -= take / f;
      // Which entry filled the line, in order: what is still open on it is its latest plating (the rule ages that).
      r.A[field].push({ e: e, q: take });
    });
    // Left over, on the floor with no challan: one row per part, its pickling and its plating kept apart. The same
    // material pickled and then plated is one lot, so the row holds the larger stage, never the two added.
    if (left > 0.0005) {
      var nk = (e.clientId == null ? '?' : e.clientId) + '|' + (e.part || '') + '|' + u;
      var nc = noChallan[nk] || (noChallan[nk] = { clientId: e.clientId, client: e.client, part: e.part, qty: 0, unit: u, field: field, oldest: e.date, L: 0, P: 0 });
      nc[field] += left; nc.qty = Math.max(nc.L, nc.P); nc.field = nc.L > 0 ? 'L' : 'P';
      if (e.date < nc.oldest) nc.oldest = e.date;
    }
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
      floorRecorded: r.L[u] > 0 || r.P[u] > 0, derived: !!r.derived, kpp: r.kpp || null, openKg: r.openQ.KG });
  });
  var cov = prodCoverage(since, today), covShare = Math.min.apply(null, PROD_LINES.map(function(l) { return cov[l].share; }));
  var book = rows.reduce(function(s, x) { return s + x.amount; }, 0);
  var unweighed = rows.filter(function(x) { return x.unit === 'KG'; });
  return { rows: rows, unweighed: unweighed.length, unweighedKg: unweighed.reduce(function(s, x) { return s + x.open; }, 0), noChallan: Object.keys(noChallan).map(function(k) { return noChallan[k]; }), arrived: arrived, famUsed: famUsed,
    book: gstRound(book), coverage: cov, coverShare: covShare, floorOk: covShare >= PROD_COVER_OK, since: since, lines: lines };
}

/* ---------- Links: Stats, labour by line, the To-do ---------- */
/* Stats → In one line: the floor's plated tonnage on complete days against ~2 t a shift. Nothing is said with no
   production in the range — never a zero. */
function prodPlatedSummary(from, to) {
  var days = prodCompleteDays(from, to);
  if (!days.length) return null;
  var kg = 0, pieces = 0, weighed = 0, est = 0;
  days.forEach(function(d) { PROD_LINES.forEach(function(l) { var r = prodDayLine(d, l); kg += r.kg; pieces += r.pieces; weighed += r.weighedPieces; est += r.est; }); });
  return { days: days.length, working: statsWorkingDays(from, to), kg: kg, est: est, perDay: kg / days.length, capacity: STATS_CAPACITY_KG_DAY, weighedShare: pieces ? weighed / pieces : 1 };
}
function prodStatsRowHtml(from, to) {
  var s = prodPlatedSummary(from, to);
  if (!s) return '';
  return '<div class="inv-row inv-row-2 inv-row-flow" id="statsPlated"><span class="inv-row-main"><span class="inv-row-title">Plated (floor)</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml((s.est > 0.0005 ? '≈ ' : '') + formatNum(s.kg / 1000, 1) + ' t on ' + s.days + ' complete day' + (s.days === 1 ? '' : 's') + ' of ' + s.working + ' working · ' +
      Math.round(s.perDay / s.capacity * 100) + '% of capacity (~2 t a shift, two shifts) · ' + (s.est > 0.0005 ? Math.round(s.est / s.kg * 100) + '% of the weight estimated' : 'every run weighed') +
      (s.weighedShare < 0.995 ? ', ' + Math.round((1 - s.weighedShare) * 100) + '% of the pieces not weighed' : '')) + '</span></span>' +
    '<span class="inv-row-end"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invSwitchTab" data-tab="pageProduction">Production</button></span></div>';
}

/* Labour ₹/kg by line: variable labour (the pool, the daily tier, OT, the EXTRA) of each area, divided by the kg
   that line plated, over the SAME days — days with attendance and a usable production record (kg weighed on 90% of
   its pieces). The VAT side's pickling hands are split between A1 and A2 by that day's kg. The monthly crew is the
   standing crew and is not by line. What was excluded is said: a one-day range credits no weekly rest, and a closed
   month paid on a slip puts monthly OT on the hand's home area, so neither is a line's figure here. */
var PROD_LINE_AREAS = { 'vat-a1': ['vat-a1'], 'vat-a2': ['vat-a2'], barrel: ['barrel', 'pickling-barrel'] };
function prodLabourByLine(from, to) {
  var res = {}, skipped = 0, days = 0;
  PROD_LINES.forEach(function(l) { res[l] = { cost: 0, kg: 0, days: 0 }; });
  for (var d = from, g = 0; d <= to && g < 120; d = isoAddDays(d, 1), g++) {
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
    });
    if (used) days++; else skipped++;
  }
  PROD_LINES.forEach(function(l) { res[l].perKg = res[l].kg > 0 && res[l].days >= 5 ? res[l].cost / res[l].kg : null; res[l].cost = gstRound(res[l].cost); });
  return { lines: res, days: days, skipped: skipped };
}

/* The two To-do rules. Both read only what was captured here (never the imported history, which would raise a
   flood on the first day), leave rework out (replating is not billed twice), and carry the tone in their sig so a
   snoozed amber task comes back when it turns red. */
var PROD_RULES = [['prodPlatedUnbilled', 'Production: plated and not invoiced'], ['prodPickledNoChallan', 'Production: pickled with no open challan'], ['prodGaugeUnknown', 'Production: a round no gauge rule names'],
  ['prodUnweighed', 'Production: pieces plated with no weight']];
PROD_RULES.forEach(function(r) { TODO_RULES.push(r); TODO_CHECK_DEFAULTS[r[0]] = true; });
TODO_CHECK_DEFAULTS.prodPlatedDays = 3;
function prodGo(tab, extra) { return Object.assign({ kind: 'production', tab: tab }, extra || {}); }
/* Working days after a, up to and including b: the one counter, statsWorkingDays (Sundays out). */
function prodWorkingDaysBetween(a, b) { return statsWorkingDays(isoAddDays(a, 1), b); }

TODO_RULE_FNS.prodPlatedUnbilled = function() {
  var cfg = todoCfg(), N = cfg.prodPlatedDays || 3, today = localDateStr(), since = isoAddDays(today, -45);
  var idx = prodIndex(), byClient = {};
  var own = function(e) { return e.src !== 'import' && !e.rework && e.date >= since && e.qty != null && e.clientId != null; };
  if (!idx.counted.some(own)) return [];
  var plant = prodInPlant({ since: since });
  plant.rows.forEach(function(x) {
    if (x.platedNotInvoiced <= 0) return;
    var cid = x.r.m.clientId;
    // What is still open on a line is its latest plating: invoicing takes the oldest first. The age is that plating's,
    // and only what was captured here counts, never the imported history. It was aged from the part's oldest plating
    // in 45 days (billed or not) and counted the whole line, the history's share included.
    var inv = x.I, open = [];
    x.r.A.L.forEach(function(a) {
      var billed = Math.min(a.q, Math.max(0, inv)), left = a.q - billed;
      inv -= a.q;
      if (left > 0.0005 && own(a.e)) open.push({ e: a.e, q: left });
    });
    if (!open.length) return;
    var qty = open.reduce(function(s, o) { return s + o.q; }, 0);
    var oldest = open.map(function(o) { return o.e.date; }).sort()[0];
    var age = prodWorkingDaysBetween(oldest, today);
    if (age < N) return;
    var c = byClient[cid] || (byClient[cid] = { nos: 0, kg: 0, parts: {}, oldest: oldest, age: age });
    if (x.unit === 'NOS') c.nos += qty; else c.kg += qty;
    c.parts[x.r.it.partNumber || x.r.it.desc] = true;
    if (oldest < c.oldest) { c.oldest = oldest; c.age = age; }
  });
  return Object.keys(byClient).map(function(cid) {
    var c = byClient[cid], n = Object.keys(c.parts).length, tone = c.age >= 2 * N ? 'red' : 'amber', name = prodClientName(cid) || 'Client ' + cid;
    var what = (c.nos ? Math.round(c.nos).toLocaleString('en-IN') + ' NOS' : '') + (c.nos && c.kg ? ' + ' : '') + (c.kg ? formatNum(c.kg, 1) + ' kg' : '');
    return { key: 'prodPlatedUnbilled:' + cid, rule: 'prodPlatedUnbilled', tone: tone, clientId: cid, title: name + ': ' + what + ' plated, not invoiced',
      sub: todoPlural(n, 'part') + ' · oldest plated ' + formatDate(c.oldest) + ' (' + todoPlural(c.age, 'working day') + ')',
      why: 'Production · rule: ' + N + ' working days', facts: [['Plated, not invoiced', what], ['Parts', String(n)], ['Oldest', formatDate(c.oldest)]],
      clears: 'Invoice these parts, or void a plated entry that was wrong.', go: prodGo('plant', { client: cid }), goLabel: 'Open in plant',
      sig: tone + '|' + cid + '|' + c.oldest + '|' + n };
  });
};
/* A pickled load the rule "pickled with no open challan" counts, and the one test Entries → No challan lists by, so
   "Open the loads" shows the loads the task counted: captured here (never the imported history), not rework, not
   void or corrected, in the last 30 days and a working day old, and no challan line of its part open on the day (or
   billed on or after it). A named part must be on the challan by name; only a load naming just the kind and gauge
   matches by family. The list used to take any challan of the part or its family, open or not, and the rule counted
   loads since corrected. */
function prodLoadNoChallan(e, idx, today) {
  today = today || localDateStr();
  if (e.kind !== 'pickled' || e.voidedAt || e.src === 'import' || e.rework || (idx || prodIndex()).replaced[e.id]) return false;
  if (e.date < isoAddDays(today, -30) || prodWorkingDaysBetween(e.date, today) < 1) return false;
  if (e.clientId == null) return true;
  var k = prodEntryKey(e), fk = prodFamilyKey(e.clientId, e.partNumber || e.part, e.gauge);
  return !(S.incomingMaterial || []).some(function(m) {
    if (String(m.clientId) !== String(e.clientId) || (m.challanDate || '') > isoAddDays(e.date, 1)) return false;
    return (m.items || []).some(function(it) {
      var match = !e.part ? true : prodIsGeneric(e.partNumber || e.part) ? prodFamilyKey(m.clientId, it.partNumber || it.desc, prodGaugeOf(it.partNumber, it.desc)) === fk : prodChallanKey(m, it) === k;
      if (!match) return false;
      return imLineOpen(it).qty > 0 || (it.invoiceIds || []).some(function(id) { var inv = (S.invoices || []).find(function(x) { return x.id === id; }); return inv && inv.date >= e.date; });
    });
  });
}
TODO_RULE_FNS.prodGaugeUnknown = function() {
  var by = {};
  prodData().entries.forEach(function(e) {
    if (!prodGaugeFlagged(e)) return;
    var k = e.clientId == null ? '-' : String(e.clientId), c = by[k] || (by[k] = { n: 0, rounds: {}, oldest: e.date });
    c.n++; c.rounds[e.gaugeUnknown] = true; if (e.date < c.oldest) c.oldest = e.date;
  });
  return Object.keys(by).map(function(k) {
    var c = by[k], sizes = Object.keys(c.rounds).map(Number).sort(function(a, b) { return a - b; }).join(', ');
    return { key: 'prodGaugeUnknown:' + k, rule: 'prodGaugeUnknown', tone: 'amber', clientId: k === '-' ? undefined : k, title: (k === '-' ? 'No client' : prodClientName(k) || 'Client ' + k) + ': ' + todoPlural(c.n, 'run') + ' with the gauge unknown',
      sub: 'Rounds of ' + sizes + ', none in the gauge rules', why: 'Production · a round of a size no gauge rule names',
      facts: [['Runs', String(c.n)], ['Rounds', sizes], ['Oldest', formatDate(c.oldest)]], clears: 'Pick the gauge on each run (Production → Entries → Gauge unknown → Pick gauge), or void it.',
      go: prodGo('entries', { flag: 'gauge' }), goLabel: 'Open the runs', sig: 'amber|' + k + '|' + c.n };
  });
};
TODO_RULE_FNS.prodPickledNoChallan = function() {
  var today = localDateStr(), idx = prodIndex();
  var own = idx.live.filter(function(e) { return prodLoadNoChallan(e, idx, today); });
  if (!own.length) return [];
  var byClient = {}, outside = [];
  own.forEach(function(e) {
    if (e.clientId == null) { outside.push(e); return; }
    var c = byClient[e.clientId] || (byClient[e.clientId] = { n: 0, oldest: e.date });
    c.n++; if (e.date < c.oldest) c.oldest = e.date;
  });
  var tasks = Object.keys(byClient).map(function(cid) {
    var c = byClient[cid], age = prodWorkingDaysBetween(c.oldest, today), tone = age >= 3 ? 'red' : 'amber';
    return { key: 'prodPickledNoChallan:' + cid, rule: 'prodPickledNoChallan', tone: tone, clientId: cid, title: (prodClientName(cid) || 'Client ' + cid) + ': ' + todoPlural(c.n, 'load') + ' pickled with no open challan',
      sub: 'Oldest ' + formatDate(c.oldest), why: 'Production · pickled, and no challan of that part open on the day',
      facts: [['Loads', String(c.n)], ['Oldest', formatDate(c.oldest)]], clears: 'Enter the challan (Challans → Add challan), correct the load to the challan’s part (Production → Entries → Correct), or void the load.',
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

/* Pieces plated in the last 30 days that nothing weighs, one task a client (owner, 9 Oct 2026: "a list of those pieces whose
   weights are missing so we can do a follow up"). Amber: the day's weight reads low by them, and a line's efficiency with it.
   The imported history counts too: a weight set once weighs every day. Clears when each name is weighed. */
TODO_RULE_FNS.prodUnweighed = function() {
  var since = isoAddDays(localDateStr(), -30), idx = prodIndex(), byClient = {};
  idx.counted.forEach(function(e) {
    if (e.date < since || e.clientId == null || !prodIsUnweighed(e, idx)) return;
    var c = byClient[e.clientId] || (byClient[e.clientId] = { pieces: 0, names: {} });
    c.pieces += e.qty;
    var k = String(e.part || '?');
    c.names[k] = (c.names[k] || 0) + e.qty;
  });
  return Object.keys(byClient).map(function(cid) {
    var c = byClient[cid], names = Object.keys(c.names).sort(function(a, b) { return c.names[b] - c.names[a]; });
    return { key: 'prodUnweighed:' + cid, rule: 'prodUnweighed', tone: 'amber', clientId: cid,
      title: (prodClientName(cid) || 'Client ' + cid) + ': ' + Math.round(c.pieces).toLocaleString('en-IN') + ' pieces plated with no weight',
      sub: names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) : ''), why: 'Production · plated in pieces, and no weight for the part anywhere in the book',
      facts: [['Pieces, 30 days', Math.round(c.pieces).toLocaleString('en-IN')], ['Names', names.join(', ')]],
      clears: 'Which part? reads the floor’s name as one of the client’s parts; Set its weight puts a kg a piece on the client’s card. Until then the day’s weight and the line’s efficiency read low.',
      go: prodGo('entries', { client: cid, flag: 'unweighed' }), goLabel: 'Open the runs', sig: 'amber|' + cid + '|' + names.join('|') };
  });
};

/* ---------- Export and import (sep-production v1) ---------- */
function prodExport() {
  var p = prodData();
  var meta = document.querySelector('meta[name="app-build"]');
  var obj = { format: 'sep-production', version: 1, exportedAt: new Date().toISOString(), build: meta ? meta.getAttribute('content') : '',
    entries: p.entries, pastes: p.pastes, photos: p.photos, imports: p.imports, learn: p.learn,
    // The reasons and fixes a cut names by id (powercause.js): without them a cut's reason is an id nobody can read.
    powerCauses: typeof pcsList === 'function' ? pcsList() : [] };
  downloadJson('sep-production-' + localDateStr() + '.json', obj, 1);
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
    // A quantity is a number, never text: isFinite('300') is true, and a string qty added into a sum concatenates.
    var num = function(v) { return v == null || (typeof v === 'number' && isFinite(v)); };
    if (PROD_KINDS.indexOf(e0.kind) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(e0.date || '') || !num(e0.qty) || !num(e0.qty2) ||
      (e0.unit != null && ['NOS', 'KG', 'BAG'].indexOf(e0.unit) < 0) || (e0.line != null && PROD_LINES.indexOf(e0.line) < 0)) { bad++; return; }
    var e = {};
    Object.keys(e0).forEach(function(k) { e[k] = e0[k]; });
    if (e.clientId != null) {
      var held = (S.clients || []).find(function(c) { return String(c.id) === String(e.clientId); });
      // Kept only where the name written is the held client's own (or reads as it): a name that reads as another
      // client used to keep the wrong id, since any match passed.
      var named = e.client ? prodMatchClient(e.client, ctx.clients) : null;
      if (!held || (e.client && relayKey(held.name) !== relayKey(e.client) && !(named && String(named.id) === String(held.id)))) e.clientId = null;
    }
    if (e.clientId == null && e.client) { var hit = prodMatchClient(e.client, ctx.clients); if (hit) e.clientId = hit.id; }
    if (e.clientId == null && e.kind !== 'downtime' && (e.client || e.part)) unknown++;
    if (!e.src) e.src = 'import';
    e.importId = e.importId || imp.id;
    prodLearnAliases([e]);
    p.entries.push(prodSparse(e));
    have[e.id] = true;
    added++;
  });
  var ph = {}; p.pastes.forEach(function(x) { ph[x.id] = true; ph['h' + x.hash] = true; });
  (src.pastes || []).forEach(function(x) { if (x && x.id && !ph[x.id] && !ph['h' + x.hash]) { p.pastes.push(x); ph[x.id] = true; } });
  var fh = {}; p.photos.forEach(function(x) { fh[x.id] = true; fh['s' + x.sha] = true; });
  (src.photos || []).forEach(function(x) { if (x && x.id && !fh[x.id] && !fh['s' + x.sha]) { p.photos.push(x); fh[x.id] = true; } });
  // A lesson names a client by the id of the book that wrote the file. It is kept only for an id the file's own entries show
  // under that client's name in this book (the entries' check), or a spelling that itself reads as the client: an id the two
  // books give to different clients would point the lesson at the wrong one (P127).
  var trusted = {}, heldOf = function(id) { return (S.clients || []).find(function(c) { return String(c.id) === String(id); }); };
  src.entries.forEach(function(e0) {
    if (!e0 || typeof e0 !== 'object' || e0.clientId == null || !e0.client) return;
    var held = heldOf(e0.clientId), named = prodMatchClient(e0.client, ctx.clients);
    if (held && (relayKey(held.name) === relayKey(e0.client) || (named && String(named.id) === String(held.id)))) trusted[String(held.id)] = true;
  });
  var fromL = src.learn && typeof src.learn === 'object' ? src.learn : {};
  Object.keys(fromL.clients || {}).forEach(function(key) {
    if (key in p.learn.clients) return;
    var held = heldOf(fromL.clients[key]), named = held ? prodMatchClient(key, ctx.clients) : null;
    if (held && (trusted[String(held.id)] || relayKey(held.name) === relayKey(key) || (named && String(named.id) === String(held.id)))) p.learn.clients[key] = held.id;
  });
  Object.keys(fromL.parts || {}).forEach(function(key) {
    if (key in p.learn.parts) return;
    var cid = key.split('|')[0];
    if (trusted[cid] && heldOf(cid) && fromL.parts[key] && typeof fromL.parts[key] === 'object') p.learn.parts[key] = fromL.parts[key];
  });
  var causes = typeof pcsMergeImport === 'function' ? pcsMergeImport(src.powerCauses) : 0;
  imp.counts = { entries: added, skipped: skipped, unknownClient: unknown, refused: bad };
  if (causes) imp.counts.causes = causes;   // the power causes the file brought (powercause.js), only where it brought any
  if (added || causes) p.imports.push(imp);
  prodTouch();
  return { ok: true, added: added, skipped: skipped, unknown: unknown, bad: bad, causes: causes };
}
