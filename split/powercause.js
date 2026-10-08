/* ===== POWER: WHY A CUT CAME, AND WHAT BROUGHT THE POWER BACK =====
   Owner, 8 Oct 2026: "If we enter a power cut and save it without giving an out time, there is no option readily available to
   fill in in time and the reason + solution. For reasons and solutions, start remembering them and present them as a list
   once they start being entered and store them in uniform format, no matter how the input text is. Use the intelligence
   system to tie this to the plant and present it in a visual form."

   - **A cut is completed where it is shown**: Power → Cuts and Overview, Production's entries and its hand form, Today and the
     To-do. One dialog (pcsOpen) takes the time the power came back in, why it went, where it hit and what brought it back.
     It is written on every report of the cut (the register and a message can report one cut twice), with who and when. A
     power-in time the register or a message wrote is the record's and is never typed over; one the record only bounded
     ("after 7:16 PM"), inferred, or one typed here before, can be set.
   - **Reasons and fixes are a list the book keeps** (`S.power.causes`), started from nothing and learnt as they are typed.
     Each entry has one name written one way (pcsCanon: spaces, case and punctuation evened, the shop's codes in capitals:
     MCB, JBVNL, VAT A2, kVA) and keeps every spelling ever typed for it (`aliases`). What is typed is matched to the list
     first (pcsKey: the same words in any order and any case, the common endings and a typing slip folded), so
     "TRANSFORMER TRIPPED", "transformer trip" and "tripped transformer" are one reason. A near match is said ("read as …",
     with Keep as new), never taken without showing it. The list is shown as chips the moment it has an entry, the most used
     first, and filters as one types.
   - **A reason says where it starts**: the grid (the supply: the feeder, the substation, a shutdown), the plant (our own
     panel, a breaker, a unit), or not known. **A cut says where it hit**: the whole plant, a line or station, or one unit of
     the plant register (plant.js).
   - **Read for the plant** (Power → Causes): what causes the cuts, ranked by what they cost (each cut's damage, powerCutCost),
     coded by where they start; where they hit, station by station; what brings the power back and how fast; and the list
     itself, renamed or merged by the owner (a merged entry points at the one it joined, so every cut keeps its reason).
   - **The To-do**: a cut to complete (no time back, or no reason), and a cause that keeps cutting the power, with what to do
     about it (advice.js moves). The plant register's unit says the cuts tied to it. */

var PCS_NEAR = 0.8;          // two names sharing this much of their words (Dice, typing slips allowed) are read as one
var PCS_ALIASES_MAX = 24;    // spellings kept per entry
var PCS_CHIPS = 8;           // chips shown under a field
var PCS_RECUR = 3;           // a cause this many times in 30 days is a To-do task; five, red
var PCS_RECUR_RED = 5;
var PCS_ASK_DAYS = 14;       // a recent cut with no reason is asked about this long
var PCS_OPEN_DAYS = 30;      // a cut with no time back is asked about this long (imported history is never asked)
var PCS_SCOPES = [['grid', 'The grid', 'the supply: the feeder, the substation, a shutdown'], ['plant', 'In the plant', 'our own panel, a breaker, a unit'],
  ['', 'Not sure', '']];
/* The shop's codes, written in capitals whatever case they are typed in; and the few written their own way. */
var PCS_CAPS = { jbvnl: 1, tsuisl: 1, jseb: 1, dvc: 1, mcb: 1, mccb: 1, elcb: 1, rccb: 1, rcbo: 1, acb: 1, vcb: 1, ocb: 1, dg: 1, lt: 1, ht: 1,
  db: 1, pdb: 1, mdb: 1, ups: 1, eb: 1, ac: 1, dc: 1, pf: 1, apfc: 1, ct: 1, pt: 1, etp: 1, plc: 1, vfd: 1, olr: 1, smps: 1, vat: 1, cqi: 1 };
var PCS_FORMS = { kva: 'kVA', kw: 'kW', kv: 'kV', kwh: 'kWh', kvah: 'kVAh' };
/* Words that carry nothing for matching: every reason here is about a power cut. */
var PCS_STOP = { the: 1, a: 1, an: 1, of: 1, on: 1, in: 1, at: 1, to: 1, due: 1, because: 1, by: 1, from: 1, for: 1, was: 1, were: 1, is: 1,
  are: 1, be: 1, been: 1, got: 1, get: 1, has: 1, had: 1, have: 1, and: 1, or: 1, it: 1, its: 1, our: 1, we: 1, there: 1, this: 1, that: 1,
  with: 1, power: 1, cut: 1, cuts: 1, light: 1, lights: 1, bijli: 1 };
/* Short words that are words, not codes, when typed in capitals among lower-case ones. */
var PCS_WORDS = { no: 1, not: 1, off: 1, out: 1, up: 1, all: 1, but: 1, can: 1, did: 1, yes: 1, any: 1, new: 1, old: 1, one: 1, two: 1, low: 1,
  hot: 1, wet: 1, set: 1, run: 1, ran: 1, put: 1, day: 1, now: 1, too: 1, may: 1, see: 1, saw: 1, let: 1, try: 1, bad: 1, big: 1, end: 1,
  few: 1, fix: 1, how: 1, top: 1, use: 1, via: 1, why: 1, who: 1, ago: 1, air: 1, fan: 1, fit: 1, gas: 1, hit: 1, key: 1, lot: 1, mix: 1,
  pin: 1, tap: 1, oil: 1, far: 1, own: 1, per: 1, so: 1, as: 1, if: 1, go: 1, me: 1, he: 1, us: 1 };
/* Words that end their own way, and the common misspellings of one. */
var PCS_STEM = { broke: 'break', broken: 'break', failure: 'fail', failed: 'fail', failing: 'fail', fails: 'fail', faulty: 'fault',
  tripped: 'trip', tripping: 'trip', trips: 'trip', burnt: 'burn', burned: 'burn', blown: 'blow', blew: 'blow', reseted: 'reset',
  resetted: 'reset', restored: 'restore', came: 'come', went: 'go', gone: 'go', maintainance: 'maintenance', mantainance: 'maintenance',
  maintanance: 'maintenance', maintenence: 'maintenance', maintanence: 'maintenance', switched: 'switch', switching: 'switch' };
/* The common misspellings, written right in the name (the key folds them as well). */
var PCS_SPELL = { maintainance: 'maintenance', mantainance: 'maintenance', maintanance: 'maintenance', maintenence: 'maintenance', maintanence: 'maintenance',
  tranformer: 'transformer', transfomer: 'transformer', transfromer: 'transformer', trasformer: 'transformer', transformar: 'transformer', breakar: 'breaker', brekar: 'breaker',
  suply: 'supply', supplly: 'supply', voltege: 'voltage', voltag: 'voltage', flactuation: 'fluctuation', flucuation: 'fluctuation',
  fuze: 'fuse', cabel: 'cable', cabal: 'cable', sheduled: 'scheduled', scheduld: 'scheduled', shedule: 'schedule' };
/* Two words written as one, and one written as two. */
var PCS_PHRASES = [[/\bshut\s*-?\s*down\b/g, 'shutdown'], [/\bbreak\s*-?\s*down\b/g, 'breakdown'], [/\bsub\s*-?\s*station\b/g, 'substation'],
  [/\bover\s*-?\s*load/g, 'overload'], [/\bre\s*-?\s*set\b/g, 'reset'], [/\bstand\s*-?\s*by\b/g, 'standby']];

/* ---------- The list ---------- */
/* Read without writing: drawing never changes the book. */
function pcsList() { return S && S.power && Array.isArray(S.power.causes) ? S.power.causes : []; }
function pcsStore() { var p = powerData(); if (!Array.isArray(p.causes)) p.causes = []; return p.causes; }
function pcsUid() { return 'PCS-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
/* An entry by its id, following a merge to the entry it joined. */
function pcsGet(id) {
  if (!id) return null;
  var list = pcsList(), c = list.find(function(x) { return x && x.id === id; }), hops = 0;
  while (c && c.mergedInto && hops++ < 12) c = list.find(function(x) { return x && x.id === c.mergedInto; }) || c;
  return c || null;
}
function pcsName(id) { var c = pcsGet(id); return c ? c.name : ''; }
/* The entries of a kind still in use: not merged into another, not retired. */
function pcsLive(kind) { return pcsList().filter(function(c) { return c && c.kind === kind && !c.mergedInto && !c.retiredAt; }); }
function pcsScopeWord(scope) { return scope === 'grid' ? 'from the grid' : scope === 'plant' ? 'in the plant' : 'where it starts not known'; }
/* The tone a cause is coded in (the status tones, §3.3): one that keeps coming in the plant is ours to stop (danger); one in
   the plant is ours to check (warning); one from the grid is the supply's (info); one not placed says nothing yet. */
function pcsTone(scope, n30) { return scope === 'plant' ? (n30 >= PCS_RECUR ? 'danger' : 'warning') : scope === 'grid' ? 'info' : 'neutral'; }

/* ---------- One way of writing a name ---------- */
function pcsClean(text) {
  return String(text == null ? '' : text).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/^\s*(?:\d+[.)]|[-*•·]+)\s+/, '').replace(/\s+/g, ' ').replace(/^["'\s]+|["'\s]+$/g, '').replace(/[\s.,;:!?-]+$/, '').trim();
}
/* The uniform name: sentence case, the shop's codes in capitals, a code with a figure in it (A2, 11kV) written as such, a word the
   owner typed in capitals among lower-case ones kept as typed. "TRANSFORMER TRIPPED AT jbvnl sub station" → "Transformer tripped
   at JBVNL substation". */
function pcsCanon(text) {
  var s = pcsClean(text);
  if (!s) return '';
  // One word written as two is written as one ("sub station", "shut down"), in the name as in the key.
  PCS_PHRASES.forEach(function(p) { s = s.replace(new RegExp(p[0].source, 'gi'), p[1]); });
  // Typed mostly in capitals, the capitals say nothing: only the shop's codes stay in them. Typed in lower case with a word of
  // two or three capitals among it (a code the list does not know: "RMU", "LA"), that word is kept as typed; a longer one
  // ("LINE TRIP at the feeder") is a word written loud.
  var letters = s.replace(/[^A-Za-z]/g, ''), upper = s.replace(/[^A-Z]/g, '');
  var shout = letters.length > 0 && upper.length / letters.length > 0.5;
  var words = s.split(' ').map(function(w) {
    var m = /^([^A-Za-z0-9]*)([A-Za-z0-9][A-Za-z0-9/&'.-]*?)([^A-Za-z0-9]*)$/.exec(w);
    if (!m) return w;
    var core = m[2], low = core.toLowerCase(), out;
    var unit = /^(\d+(?:\.\d+)?)(kva|kw|kv|kwh|kvah)$/.exec(low);
    if (PCS_FORMS[low]) out = PCS_FORMS[low];
    else if (unit) out = unit[1] + PCS_FORMS[unit[2]];
    else if (PCS_CAPS[low]) out = core.toUpperCase();
    else if (/\d/.test(core) && /[a-z]/i.test(core) && core.length <= 6) out = core.toUpperCase();
    else if (!shout && core.length >= 2 && core.length <= 3 && !PCS_STOP[low] && !PCS_WORDS[low] && core === core.toUpperCase() && /[A-Z]/.test(core)) out = core;
    else out = PCS_SPELL[low] || low;
    return m[1] + out + m[3];
  });
  var first = words[0];
  words[0] = first.charAt(0).toUpperCase() + first.slice(1);
  return words.join(' ');
}
function pcsStem(w) {
  if (PCS_STEM[w]) return PCS_STEM[w];
  var s = w;
  if (/^\d+$/.test(s)) return s;
  if (s.length > 5 && /ing$/.test(s)) s = s.slice(0, -3);
  else if (s.length > 4 && /ed$/.test(s)) s = s.slice(0, -2);
  else if (s.length > 3 && /s$/.test(s) && !/ss$/.test(s)) s = s.slice(0, -1);
  if (s.length > 3 && /e$/.test(s)) s = s.slice(0, -1);
  return s.replace(/([a-z])\1+/g, '$1');
}
/* The key two names are matched on: lower case, the words that carry nothing left out, each word's ending folded, the
   words in order. "Tripped transformer" and "TRANSFORMER TRIPPING" share "transformer trip". */
function pcsKey(text) {
  var s = pcsClean(text).toLowerCase();
  PCS_PHRASES.forEach(function(p) { s = s.replace(p[0], p[1]); });
  var seen = {};
  return s.split(/[^a-z0-9]+/).filter(function(t) { return t && !PCS_STOP[t]; }).map(function(t) { return pcsStem(PCS_SPELL[t] || t); })
    .filter(function(t) { if (!t || seen[t]) return false; seen[t] = true; return true; }).sort().join(' ');
}
function pcsLev(a, b) {
  var prev = [], cur, i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    cur = [i];
    for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/* Two words are one where they are equal, one begins the other (transform, transformer), or a long word is a slip away. A
   short word (MCB, DG) must be equal. */
function pcsTokSame(a, b) {
  if (a === b) return true;
  var n = Math.min(a.length, b.length);
  if (n >= 5 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return true;
  if (n < 5) return false;
  return pcsLev(a, b) <= (n >= 8 ? 2 : 1);
}
/* The words two keys share: {m, a, b} (each word counted once, typing slips allowed). */
function pcsOverlap(k1, k2) {
  var A = k1 ? k1.split(' ') : [], B = k2 ? k2.split(' ') : [], used = {}, m = 0;
  A.forEach(function(a) { for (var i = 0; i < B.length; i++) if (!used[i] && pcsTokSame(a, B[i])) { used[i] = 1; m++; break; } });
  return { m: m, a: A.length, b: B.length };
}
function pcsDice(k1, k2) { var o = pcsOverlap(k1, k2); return o.a && o.b ? 2 * o.m / (o.a + o.b) : 0; }
/* Near: most words shared, or every word of the shorter one in the longer ("tripped transformer" in "Transformer tripped at
   the substation") where the shorter has two or more and is half the longer or more. */
function pcsNearScore(k1, k2) {
  var o = pcsOverlap(k1, k2), lo = Math.min(o.a, o.b), d = o.a && o.b ? 2 * o.m / (o.a + o.b) : 0;
  if (d >= PCS_NEAR) return d;
  return lo >= 2 && o.m === lo && lo * 2 >= Math.max(o.a, o.b) ? Math.max(d, PCS_NEAR) : 0;
}
/* What a typed name is on the list: {c, how: 'exact' | 'near', score}, or null. */
function pcsMatch(text, kind) {
  var key = pcsKey(text);
  if (!key) return null;
  var best = null;
  pcsLive(kind).forEach(function(c) {
    [c.name].concat(c.aliases || []).forEach(function(n) {
      if (best && best.how === 'exact') return;
      var k = pcsKey(n);
      if (k === key) { best = { c: c, how: 'exact', score: 1 }; return; }
      var d = pcsNearScore(key, k);
      if (d && (!best || d > best.score)) best = { c: c, how: 'near', score: d };
    });
  });
  return best;
}
/* A name onto the list: the entry it is, its spelling kept; or a new entry written the one way. Returns the entry's id. */
function pcsLearn(kind, text, opts) {
  opts = opts || {};
  var clean = pcsClean(text);
  if (!clean) return null;
  var list = pcsStore(), hit = opts.id ? pcsGet(opts.id) : null;
  if (!hit && !opts.keepNew) { var m = pcsMatch(clean, kind); if (m) hit = m.c; }
  if (!hit && opts.keepNew) { var ex = pcsMatch(clean, kind); if (ex && ex.how === 'exact') hit = ex.c; }
  var now = Date.now(), by = pcsWho();
  if (hit) {
    var low = clean.toLowerCase();
    if (hit.name.toLowerCase() !== low && !(hit.aliases || []).some(function(a) { return a.toLowerCase() === low; })) {
      hit.aliases = (hit.aliases || []).concat([clean]).slice(-PCS_ALIASES_MAX);
    }
    return hit.id;
  }
  var c = { id: pcsUid(), kind: kind, name: pcsCanon(clean), aliases: pcsCanon(clean) === clean ? [] : [clean], at: now, by: by };
  if (kind === 'reason') c.scope = opts.scope === 'grid' || opts.scope === 'plant' ? opts.scope : '';
  list.push(c);
  return c.id;
}
function pcsWho() { return (typeof grdUser === 'function' && grdUser() ? grdUser().name : '') || (typeof stockBy === 'function' ? stockBy() : '') || ''; }
/* The list from another book (a sep-production file's `powerCauses`), merged by id and never written over. Each is cleaned
   as the app writes one; one written the same way as an entry here joins it (its cuts read the entry here, its spellings are
   kept there). Returns how many were added. */
function pcsMergeImport(list) {
  if (!Array.isArray(list)) return 0;
  var have = {}, n = 0, store = null;
  pcsList().forEach(function(c) { if (c && c.id) have[c.id] = true; });
  list.forEach(function(c0) {
    if (!c0 || typeof c0 !== 'object' || typeof c0.id !== 'string' || !/^PCS-[A-Za-z0-9_-]{1,40}$/.test(c0.id) || have[c0.id]) return;
    if (c0.kind !== 'reason' && c0.kind !== 'fix') return;
    var name = pcsCanon(typeof c0.name === 'string' ? c0.name : '');
    if (!name) return;
    var spell = (Array.isArray(c0.aliases) ? c0.aliases : []).filter(function(a) { return typeof a === 'string'; }).map(pcsClean).filter(Boolean);
    var c = { id: c0.id, kind: c0.kind, name: name, aliases: spell.slice(-PCS_ALIASES_MAX), at: Number(c0.at) || Date.now(), by: typeof c0.by === 'string' ? c0.by : '' };
    if (c.kind === 'reason') c.scope = c0.scope === 'grid' || c0.scope === 'plant' ? c0.scope : '';
    if (typeof c0.mergedInto === 'string' && /^PCS-/.test(c0.mergedInto)) c.mergedInto = c0.mergedInto;
    var same = !c.mergedInto && pcsLive(c.kind).find(function(x) { return pcsKey(x.name) === pcsKey(name); });
    if (same) {
      c.mergedInto = same.id; c.mergedAt = Date.now(); c.mergedBy = 'import';
      same.aliases = (same.aliases || []).concat([name], spell).filter(function(a, i, arr) {
        return a.toLowerCase() !== same.name.toLowerCase() && arr.findIndex(function(z) { return z.toLowerCase() === a.toLowerCase(); }) === i;
      }).slice(-PCS_ALIASES_MAX);
    }
    (store || (store = pcsStore())).push(c);
    have[c.id] = true; n++;
  });
  return n;
}

/* ---------- The cut ---------- */
/* What the reports of one cut say of its reason, fix and where, the latest set winning; read by powerCuts. */
function pcsCutFields(ents) {
  var set = ents.filter(function(e) { return e.downtime && e.downtime.setAt; }).sort(function(a, b) { return b.downtime.setAt - a.downtime.setAt; })[0];
  var d = set ? set.downtime : {};
  var closed = ents.find(function(e) { return e.downtime && e.downtime.closedHow; });
  return { reason: d.reason || null, fix: d.fix || null, where: d.where || null, unitId: d.unitId || null, cnote: d.note || '', setAt: d.setAt || null,
    setBy: d.setBy || '', closedHow: closed ? closed.downtime.closedHow : null, closedBy: closed ? closed.downtime.closedBy || '' : '',
    imported: ents.length > 0 && ents.every(function(e) { return e.src === 'import'; }) };
}
/* The cut an entry is a report of, as Power reads it (powerCuts: the same cut reported twice is one). */
function pcsCutOf(entryId) {
  var e = prodIndex().byId[entryId];
  if (!e || e.kind !== 'downtime') return null;
  return powerCuts(e.date, e.date).find(function(c) { return c.ids.indexOf(entryId) >= 0; }) || null;
}
/* Where a cut hit, in words. */
function pcsWhereWord(where, unitId) {
  var u = unitId && typeof pltUnitById === 'function' ? pltUnitById(unitId) : null;
  if (u) return u.name + ' · ' + pltStationName(u.station);
  if (!where) return '';
  return where === 'all' ? 'the whole plant' : pltStationName(where);
}
/* A cut's state: what it still needs. */
function pcsNeeds(c) { return { time: !!c.open, reason: !c.reason }; }
function pcsCutWhen(c) {
  var at = powerClock(c.from);
  return stockShortDate(c.date) + ' · ' + (c.to == null ? at + ', no time back' : at + ' – ' + powerClock(c.to) + (c.overnight ? ' next day' : ''));
}

/* ---------- The dialog ---------- */
var _pcs = null;
function pcsOpen(entryId) {
  var c = pcsCutOf(entryId);
  if (!c) { showToast('That power cut is no longer on the record', 'warning'); return; }
  var idx = prodIndex(), ents = c.ids.map(function(id) { return idx.byId[id]; }).filter(Boolean);
  // The power-in time can be set where the record has none, only bounds it, inferred it, or where it was typed here.
  var editable = c.open || c.atLeast || c.inferred || c.closedHow === 'hand';
  var basis = ents.map(function(e) { return e.basis || e.src || 'hand'; });
  var r = c.reason ? pcsGet(c.reason) : null, f = c.fix ? pcsGet(c.fix) : null;
  _pcs = { ids: c.ids.slice(), date: c.date, from: c.from, toMin: c.to, editable: editable, basis: basis, open: c.open,
    to: editable && c.to != null && !c.open ? prodHhmm(c.to % 1440) : '',
    reason: { text: r ? r.name : '', id: r ? r.id : null, keepNew: false, touched: false },
    fix: { text: f ? f.name : '', id: f ? f.id : null, keepNew: false, touched: false },
    // A cut that says nothing of where it hit is taken to have stopped the whole plant, as a cut of the supply does; a reason
    // known for one place moves it there (pcsSync) until it is picked by hand.
    scope: '', where: c.unitId ? 'u:' + c.unitId : c.where || 'all', whereTouched: !!(c.where || c.unitId), note: c.cnote || '', was: { where: c.unitId ? 'u:' + c.unitId : c.where || '', note: c.cnote || '' } };
  dialogOpen(pcsDialogHtml(), { dismiss: true });
  var first = document.getElementById(editable && c.open ? 'pcsTo' : 'pcsReason');
  if (first && !touchScreen()) try { first.focus(); } catch (e) { /* focus is a convenience */ }
}
function pcsDialogHtml() {
  var f = _pcs, cut = { date: f.date, from: f.from, to: f.toMin, overnight: f.toMin != null && f.toMin >= 1440 };
  var src = f.basis.indexOf('register') >= 0 ? 'the register' : f.basis.indexOf('relay') >= 0 || f.basis.indexOf('pickling') >= 0 ? 'the message' : 'the record';
  var h = '<div class="inv-dialog" data-pcs-dialog="' + escHtml(f.ids[0]) + '">' + dialogHeadHtml('Power cut · ' + escHtml(attDayName(f.date) + ' ' + formatDate(f.date)) + ', ' + escHtml(powerClock(f.from)));
  h += '<div class="inv-fields">';
  if (f.editable) {
    h += '<div class="inv-field"><label class="inv-field-label" for="pcsTo">Power in at</label><input type="time" id="pcsTo" class="inv-input" data-pcs-in="to" value="' + escHtml(f.to) + '">' +
      '<span class="inv-note">' + (f.open ? 'When the power came back in.' : 'The record only bounded or inferred this time: set it if it is known.') + '</span></div>';
  } else {
    h += '<div class="inv-field"><span class="inv-field-label">Power in at</span><div class="inv-row-title" data-pcs-to-fixed>' + escHtml(pcsCutWhen(cut).split(' · ')[1]) + '</div>' +
      '<span class="inv-note">As ' + src + ' wrote it: corrected by voiding the entry in Production and entering it again.</span></div>';
  }
  h += '</div>' + pcsKindHtml('reason') + '<div class="inv-fields">' + pcsWhereFieldHtml() + '</div>' + pcsKindHtml('fix');
  h += '<div class="inv-field"><label class="inv-field-label" for="pcsNote">Note</label><input id="pcsNote" class="inv-input" data-pcs-in="note" value="' + escHtml(f.note) + '" placeholder="Anything more (optional)" autocomplete="off"></div>';
  h += '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPcsSave">Save</button></div></div>';
  return h;
}
var PCS_KIND_WORDS = { reason: { label: 'Why it went', ph: 'e.g. Feeder trip at the substation', id: 'pcsReason' }, fix: { label: 'What brought it back', ph: 'e.g. Waited for the supply', id: 'pcsFix' } };
function pcsKindHtml(kind) {
  var w = PCS_KIND_WORDS[kind], t = _pcs[kind];
  return '<div class="inv-field" data-pcs-field="' + kind + '"><label class="inv-field-label" for="' + w.id + '">' + w.label + '</label>' +
    '<div class="inv-toolbar" role="group" aria-label="' + w.label + ', known" data-pcs-chips="' + kind + '">' + pcsChipsHtml(kind) + '</div>' +
    '<input id="' + w.id + '" class="inv-input" data-pcs-in="' + kind + '" value="' + escHtml(t.text) + '" placeholder="' + escHtml(w.ph) + '" autocomplete="off">' +
    '<div data-pcs-read="' + kind + '">' + pcsReadHtml(kind) + '</div></div>';
}
/* How often each entry has been used, by its id (merges followed): {id: {n, last, with: {id: n}, where: {k: n}}}. */
function pcsUseCounts(cuts) {
  var out = {};
  (cuts || powerCuts()).forEach(function(c) {
    var r = c.reason ? pcsGet(c.reason) : null, f = c.fix ? pcsGet(c.fix) : null;
    [r, f].forEach(function(x, i) {
      if (!x) return;
      var u = out[x.id] || (out[x.id] = { n: 0, last: '', with: {}, where: {} });
      u.n++;
      if (c.date > u.last) u.last = c.date;
      var other = i === 0 ? f : r;
      if (other) u.with[other.id] = (u.with[other.id] || 0) + 1;
      var wk = c.unitId ? 'u:' + c.unitId : c.where;
      if (wk && i === 0) u.where[wk] = (u.where[wk] || 0) + 1;
    });
  });
  return out;
}
/* The chips under a field: the list as it is, the most used first, filtered by what is typed; a fix the reason picked was
   brought back by before leads. */
function pcsChipsHtml(kind) {
  var t = _pcs[kind], uses = _pcs.uses || (_pcs.uses = pcsUseCounts());
  var list = pcsLive(kind);
  if (!list.length) return '<span class="inv-note" data-pcs-empty>Nothing on the list yet: what is typed here starts it.</span>';
  var key = pcsKey(t.text), r = kind === 'fix' ? pcsReadState('reason') : null;
  var withR = r && r.c && uses[r.c.id] ? uses[r.c.id].with : {};
  var score = function(c) {
    if (!key || (t.id && t.id === c.id)) return 1;
    return [c.name].concat(c.aliases || []).reduce(function(m, n) { var k = pcsKey(n); return Math.max(m, k.indexOf(key) >= 0 || key.indexOf(k) >= 0 ? 1 : pcsDice(key, k)); }, 0);
  };
  var shown = list.map(function(c) { return { c: c, s: score(c), n: (uses[c.id] || {}).n || 0, w: withR[c.id] || 0 }; })
    .filter(function(x) { return x.s >= 0.5; })
    .sort(function(a, b) { return b.w - a.w || b.s - a.s || b.n - a.n || a.c.name.localeCompare(b.c.name); }).slice(0, PCS_CHIPS);
  if (!shown.length) return '<span class="inv-note">None on the list like it: it is saved as a new one.</span>';
  return shown.map(function(x) {
    return '<button type="button" class="inv-chip" data-action="invPcsPick" data-kind="' + kind + '" data-id="' + escHtml(x.c.id) + '" aria-pressed="' + (t.id === x.c.id) + '">' +
      escHtml(x.c.name) + (x.n ? ' <span class="inv-panel-count">' + x.n + '</span>' : '') + '</button>';
  }).join('');
}
/* What the typed name will be saved as: {state: 'empty' | 'known' | 'near' | 'new', c, name}. */
function pcsReadState(kind) {
  var t = _pcs && _pcs[kind];
  if (!t || !pcsClean(t.text)) return { state: 'empty' };
  if (t.id) { var p = pcsGet(t.id); if (p && pcsKey(p.name) === pcsKey(t.text)) return { state: 'known', c: p }; }
  var m = pcsMatch(t.text, kind);
  if (m && m.how === 'exact') return { state: 'known', c: m.c };
  if (m && !t.keepNew) return { state: 'near', c: m.c };
  return { state: 'new', name: pcsCanon(t.text) };
}
function pcsReadHtml(kind) {
  var st = pcsReadState(kind), uses = (_pcs.uses || {});
  if (st.state === 'empty') return '';
  if (st.state === 'known') {
    var n = (uses[st.c.id] || {}).n || 0;
    return '<div class="inv-note" data-pcs-state="known">Saved as <strong>' + escHtml(st.c.name) + '</strong>' +
      (kind === 'reason' ? ' · ' + escHtml(pcsScopeWord(st.c.scope)) : '') + (n ? ' · ' + todoPlural(n, 'cut') + ' before' : '') + '</div>';
  }
  if (st.state === 'near') {
    return '<div class="inv-note" data-pcs-state="near">Read as <strong>' + escHtml(st.c.name) + '</strong>, already on the list. ' +
      '<button type="button" class="inv-btn inv-btn-link inv-btn-sm" data-action="invPcsKeepNew" data-kind="' + kind + '">Keep as new</button></div>';
  }
  var h = '<div class="inv-note" data-pcs-state="new">New: <strong>' + escHtml(st.name) + '</strong>, added to the list as written here.</div>';
  if (kind === 'reason') {
    h += '<div class="inv-field-label inv-mt-8">Where does it start?</div><div class="inv-seg inv-seg-fit" role="group" aria-label="Where it starts" data-pcs-scope>' +
      PCS_SCOPES.map(function(s) { return '<button type="button" class="inv-seg-btn" data-action="invPcsScope" data-scope="' + s[0] + '" aria-pressed="' + (_pcs.scope === s[0]) + '"' + (s[2] ? ' title="' + escHtml(s[2]) + '"' : '') + '>' + s[1] + '</button>'; }).join('') + '</div>';
  }
  return h;
}
function pcsWhereFieldHtml() {
  var f = _pcs, units = typeof pltUnits === 'function' ? pltUnits() : [];
  var opt = function(v, label) { return '<option value="' + escHtml(v) + '"' + (f.where === v ? ' selected' : '') + '>' + escHtml(label) + '</option>'; };
  var h = '<div class="inv-field"><label class="inv-field-label" for="pcsWhere">Where it hit</label><select id="pcsWhere" class="inv-select" data-pcs-in="where">' +
    opt('', 'Not said') + opt('all', 'The whole plant');
  PLT_STATIONS.forEach(function(s) {
    var mine = units.filter(function(u) { return u.station === s[0]; });
    h += opt(s[0], s[1] + (s[0] === 'power' ? ' (the panel and supply equipment)' : ''));
    if (mine.length) h += '<optgroup label="' + escHtml(s[1] + ': a unit') + '">' + mine.map(function(u) { return opt('u:' + u.id, u.name + ' · ' + s[1]); }).join('') + '</optgroup>';
  });
  return h + '</select></div>';
}
/* A field's chips and its reading, drawn again as it is typed in; the field itself is never replaced. */
function pcsSync(kind) {
  var dlg = document.querySelector('[data-pcs-dialog]');
  if (!dlg || !_pcs) return;
  var ch = dlg.querySelector('[data-pcs-chips="' + kind + '"]'), rd = dlg.querySelector('[data-pcs-read="' + kind + '"]');
  if (ch) ch.innerHTML = pcsChipsHtml(kind);
  if (rd) rd.innerHTML = pcsReadHtml(kind);
  if (kind === 'reason') {
    pcsSync('fix');
    // A reason known for where it hits: Where it hit follows it, until it is picked by hand.
    var st = pcsReadState('reason'), u = st.c && (_pcs.uses || {})[st.c.id];
    if (!_pcs.whereTouched && u) {
      var top = Object.keys(u.where).sort(function(a, b) { return u.where[b] - u.where[a]; })[0];
      var sel = dlg.querySelector('#pcsWhere');
      if (top && sel && Array.prototype.some.call(sel.options, function(o) { return o.value === top; })) { sel.value = top; _pcs.where = top; }
    }
  }
}
function pcsOnInput(t) {
  if (!_pcs || !t || !t.dataset || !t.dataset.pcsIn) return false;
  var k = t.dataset.pcsIn;
  if (k === 'reason' || k === 'fix') {
    var f = _pcs[k];
    f.text = t.value; f.touched = true; f.keepNew = false;
    if (f.id) { var p = pcsGet(f.id); if (!p || pcsKey(p.name) !== pcsKey(f.text)) f.id = null; }
    pcsSync(k);
  } else if (k === 'to') _pcs.to = t.value;
  else if (k === 'note') _pcs.note = t.value;
  return true;
}
function pcsOnChange(t) {
  if (!_pcs || !t || !t.dataset || !t.dataset.pcsIn) return false;
  if (t.dataset.pcsIn === 'where') { _pcs.where = t.value; _pcs.whereTouched = true; return true; }
  if (t.dataset.pcsIn === 'to') { _pcs.to = t.value; return true; }
  return t.dataset.pcsIn === 'reason' || t.dataset.pcsIn === 'fix' || t.dataset.pcsIn === 'note';
}
function pcsPick(kind, id) {
  var c = pcsGet(id);
  if (!_pcs || !c) return;
  var f = _pcs[kind];
  // A chip pressed again lets it go.
  if (f.id === c.id && pcsKey(f.text) === pcsKey(c.name)) { f.id = null; f.text = ''; }
  else { f.id = c.id; f.text = c.name; }
  f.touched = true; f.keepNew = false;
  var inp = document.getElementById(PCS_KIND_WORDS[kind].id);
  if (inp) inp.value = f.text;
  pcsSync(kind);
}
/* The name a field will be saved under: {id} known, {text, keepNew, scope} new, null when empty. */
function pcsFieldResult(kind) {
  var st = pcsReadState(kind), f = _pcs[kind];
  if (st.state === 'empty') return null;
  if (st.state === 'known' || st.state === 'near') return { id: st.c.id, text: f.text };
  return { text: f.text, keepNew: true };
}
async function pcsSave() {
  var f = _pcs;
  if (!f) return;
  if (!grdOk('floor') && !(await guardAsk('floor', 'complete a power cut'))) return;   // the guard (guard.js): a floor entry
  if (_pcs !== f) return;
  var to = f.editable ? String(f.to || '').trim() : '';
  var toMin = to ? relayParseHhmm(to) : null;
  if (to && toMin == null) { showToast('Enter the power-in time as hh:mm', 'error'); return; }
  if (toMin != null && toMin === f.from % 1440) { showToast('The power came back the minute it went: check the time', 'error'); return; }
  // A power back earlier on the clock than the cut ran overnight, or is a slip: asked, never assumed (as the hand form asks).
  if (toMin != null && toMin < f.from % 1440) {
    var ok = await uiConfirm({ title: 'Did the power stay off overnight?', body: 'The power came back at ' + relayClockLabel(toMin) + ', earlier on the clock than the cut at ' +
      relayClockLabel(f.from) + '. Saved as it is, the cut ran overnight: ' + powerDur(toMin + 1440 - f.from % 1440) + '. Check the time if it did not.', okLabel: 'Yes, overnight' });
    if (!ok || _pcs !== f) return;
  }
  var r = pcsFieldResult('reason'), x = pcsFieldResult('fix');
  var whereNow = f.where || '', note = pcsClean(f.note);
  // Where it hit counts as a change only once picked: its default (the whole plant) is saved with something else, never alone.
  var changed = toMin != null || f.reason.touched || f.fix.touched || (f.whereTouched && whereNow !== f.was.where) || note !== pcsClean(f.was.note);
  if (!changed) { showToast('Nothing to save: enter the power-in time, why it went or what brought it back', 'warning'); return; }
  var by = pcsWho(), now = Date.now();
  var rid = r ? (r.id ? pcsLearn('reason', r.text, { id: r.id }) : pcsLearn('reason', r.text, { keepNew: true, scope: f.scope })) : null;
  var fid = x ? (x.id ? pcsLearn('fix', x.text, { id: x.id }) : pcsLearn('fix', x.text, { keepNew: true })) : null;
  var unitId = whereNow.indexOf('u:') === 0 ? whereNow.slice(2) : null;
  var u = unitId && typeof pltUnitById === 'function' ? pltUnitById(unitId) : null;
  var where = u ? u.station : whereNow || null;
  var idx = prodIndex(), n = 0;
  f.ids.forEach(function(id) {
    var e = idx.byId[id];
    if (!e || e.voidedAt) return;
    var d = Object.assign({ cause: 'power' }, e.downtime || {});
    if (toMin != null) {
      e.to = prodHhmm(toMin);
      d.open = false; delete d.atLeast; delete d.inferred;
      d.closedAt = now; d.closedBy = by; d.closedHow = 'hand';
    }
    if (f.reason.touched) { if (rid) d.reason = rid; else delete d.reason; }
    if (f.fix.touched) { if (fid) d.fix = fid; else delete d.fix; }
    if (where) d.where = where; else delete d.where;
    if (unitId) d.unitId = unitId; else delete d.unitId;
    if (note) d.note = note; else delete d.note;
    d.setAt = now; d.setBy = by;
    e.downtime = d;
    n++;
  });
  if (!n) { showToast('That power cut is no longer on the record', 'warning'); closeOverlay(); _pcs = null; return; }
  _pcs = null;
  prodTouch();
  saveState();
  closeOverlay();
  tabRedrawActive();
  showToast(toMin != null ? 'Power cut completed: back at ' + relayClockLabel(toMin) : 'Saved', 'success');
}

/* ---------- Read for the plant ---------- */
/* Every cause, fix and place over the record, with what each cost (powerAnalysis' cuts carry their damage). */
function pcsAnalysis(a) {
  a = a || powerAnalysis();
  var today = localDateStr(), from30 = isoAddDays(today, -29), from14 = isoAddDays(today, -(PCS_ASK_DAYS - 1));
  var reasons = {}, fixes = {}, places = {}, t = { cuts: a.cuts.length, reasoned: 0, open: 0, grid: 0, plant: 0, unplaced: 0, dmgReasoned: 0, dmgNone: 0, none: 0, minNone: 0 };
  var bandOf = function(c) { var b = a.bands.find(function(x) { return c.from >= x.from && c.from < x.to; }); return b ? b.label : ''; };
  var complete = [];
  a.cuts.forEach(function(c) {
    var dmg = c.cost ? c.cost.total : 0, r = c.reason ? pcsGet(c.reason) : null, f = c.fix ? pcsGet(c.fix) : null, in30 = c.date >= from30;
    if (c.open) t.open++;
    if (r) {
      t.reasoned++; t.dmgReasoned += dmg;
      if (r.scope === 'grid') t.grid++; else if (r.scope === 'plant') t.plant++; else t.unplaced++;
      var e = reasons[r.id] || (reasons[r.id] = { c: r, n: 0, n30: 0, dmg: 0, dmg30: 0, min: 0, open: 0, bands: {}, fixes: {}, where: {}, last: '' });
      e.n++; e.dmg += dmg; e.min += c.min || 0; if (c.open) e.open++;
      if (in30) { e.n30++; e.dmg30 += dmg; }
      if (c.date > e.last) e.last = c.date;
      var bd = bandOf(c); if (bd) e.bands[bd] = (e.bands[bd] || 0) + 1;
      if (f) e.fixes[f.id] = (e.fixes[f.id] || 0) + 1;
      var wk = c.unitId ? 'u:' + c.unitId : c.where;
      if (wk) e.where[wk] = (e.where[wk] || 0) + 1;
    } else { t.none++; t.dmgNone += dmg; t.minNone += c.min || 0; }
    if (f) {
      var x = fixes[f.id] || (fixes[f.id] = { c: f, n: 0, mins: [], reasons: {} });
      x.n++;
      if (c.min != null && !c.atLeast) x.mins.push(c.min);
      if (r) x.reasons[r.id] = (x.reasons[r.id] || 0) + 1;
    }
    var pk = c.where || (c.unitId ? 'unit' : null);
    if (pk) {
      var st = c.unitId && typeof pltUnitById === 'function' && pltUnitById(c.unitId) ? pltUnitById(c.unitId).station : c.where;
      var p = places[st] || (places[st] = { key: st, n: 0, n30: 0, plant30: 0, dmg: 0, min: 0, units: {} });
      p.n++; p.dmg += dmg; p.min += c.min || 0;
      if (in30) { p.n30++; if (r && r.scope !== 'grid') p.plant30++; }
      if (c.unitId) p.units[c.unitId] = (p.units[c.unitId] || 0) + 1;
    }
    var needs = pcsNeeds(c);
    if (!c.imported && ((needs.time && c.date >= isoAddDays(today, -(PCS_OPEN_DAYS - 1))) || (needs.reason && c.date >= from14))) complete.push(c);
  });
  var rlist = Object.keys(reasons).map(function(k) { var e = reasons[k]; e.dmg = gstRound(e.dmg); e.dmg30 = gstRound(e.dmg30); e.tone = pcsTone(e.c.scope, e.n30); return e; })
    .sort(function(p, q) { return q.dmg - p.dmg || q.n - p.n; });
  var flist = Object.keys(fixes).map(function(k) { var x = fixes[k]; x.median = x.mins.length ? numMedian(x.mins) : null; return x; })
    .sort(function(p, q) { return (p.median == null ? 1e9 : p.median) - (q.median == null ? 1e9 : q.median) || q.n - p.n; });
  var plist = Object.keys(places).map(function(k) { var p = places[k]; p.dmg = gstRound(p.dmg); return p; });
  // Every open cut, newest first, and a recent one with no reason: what Complete asks for.
  var openAll = a.cuts.filter(function(c) { return c.open; });
  return { a: a, t: t, reasons: rlist, fixes: flist, places: plist, complete: complete.reverse(), openAll: openAll.reverse(), from30: from30 };
}

/* ---------- Drawn ---------- */
/* The cuts to complete: a row each with its Complete. `list` is cuts (powerCuts' shape). */
function pcsCompleteRowsHtml(list) {
  return list.map(function(c) {
    var needs = pcsNeeds(c), r = c.reason ? pcsGet(c.reason) : null;
    var meta = [needs.time ? 'no time back' : powerDur(c.min), r ? r.name : 'no reason', c.imported ? 'from the imported log' : ''].filter(Boolean).join(' · ');
    return '<div class="inv-row inv-row-2 inv-row-flow" data-pcs-cut="' + escHtml(c.ids[0]) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(pcsCutWhen(c)) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + uiDot(needs.time ? 'warning' : 'info', escHtml(meta)) + '</span></span><span class="inv-row-end inv-row-actions">' +
      '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPcsOpen" data-id="' + escHtml(c.ids[0]) + '">Complete</button></span></div>';
  });
}
/* Under a cut on Power → Cuts: why it went, where it hit and what brought it back, with the one button that completes it. */
function pcsCutWhyHtml(c) {
  var r = c.reason ? pcsGet(c.reason) : null, f = c.fix ? pcsGet(c.fix) : null, where = pcsWhereWord(c.where, c.unitId);
  var bits = [r ? r.name + ' (' + pcsScopeWord(r.scope) + ')' : 'no reason given', where ? 'hit ' + where : '', f ? 'brought back by ' + f.name : '', c.cnote || ''].filter(Boolean);
  var label = c.open ? 'Complete' : r || f ? 'Edit' : 'Add reason';
  return '<div class="inv-row inv-row-2 inv-row-flow" data-pcs-why="' + escHtml(c.ids[0]) + '"><span class="inv-row-main"><span class="inv-row-title">' + (c.open ? 'No time back yet' : 'Why it went') + '</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml(bits.join(' · ')) + '</span></span><span class="inv-row-end">' +
    '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPcsOpen" data-id="' + escHtml(c.ids[0]) + '">' + label + '</button></span></div>';
}
/* Power → Overview and Cuts: what is left to complete, led by the cuts with no time back. Nothing when nothing is. */
function pcsCompleteHtml(z) {
  var seen = {}, list = [];
  z.openAll.concat(z.complete).forEach(function(c) { var k = c.ids[0]; if (!seen[k]) { seen[k] = true; list.push(c); } });
  if (!list.length) return '';
  return '<div class="inv-panel inv-panel-flush" id="pcsComplete"><div class="inv-panel-head"><span class="inv-panel-title">To complete <span class="inv-panel-count">' + list.length + '</span></span></div>' +
    uiMoreHtml('pcs-complete', pcsCompleteRowsHtml(list), { n: 5, noun: 'cuts' }) + '</div>';
}
/* A cause's ranked bar: what it cost, its count and dark time, where it starts, when it comes and what brought it back. */
function pcsReasonRow(e) {
  var band = Object.keys(e.bands).sort(function(p, q) { return e.bands[q] - e.bands[p]; })[0];
  var fx = Object.keys(e.fixes).sort(function(p, q) { return e.fixes[q] - e.fixes[p]; })[0];
  var where = Object.keys(e.where).sort(function(p, q) { return e.where[q] - e.where[p]; })[0];
  var sub = [todoPlural(e.n, 'cut') + (e.n30 ? ' (' + e.n30 + ' in 30 days)' : ''), powerHours(e.min) + ' dark', pcsScopeWord(e.c.scope),
    where ? 'hit ' + pcsWhereWord(where.indexOf('u:') === 0 ? null : where, where.indexOf('u:') === 0 ? where.slice(2) : null) : '',
    band ? 'mostly ' + band.charAt(0).toLowerCase() + band.slice(1) : '', fx ? 'brought back by ' + pcsName(fx) : ''].filter(Boolean).join(' · ');
  return { label: e.c.name, value: e.dmg > 0 ? e.dmg : e.n, display: e.dmg > 0 ? formatCurrency(e.dmg) : todoPlural(e.n, 'cut'), sub: sub, tone: e.tone === 'neutral' ? 'neutral' : e.tone === 'ok' ? 'good' : e.tone };
}
/* Power → Overview: the causes at a glance. */
function pcsOverviewHtml(z) {
  if (!z.t.reasoned) return '';
  return '<div class="inv-panel" id="pcsWhy"><div class="inv-panel-head"><span class="inv-panel-title">Why they come</span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPowerTab" data-tab="causes">Causes</button></div>' +
    chartRankedBars(z.reasons.slice(0, 5).map(pcsReasonRow), { unit: 'money' }) +
    '<div class="inv-note inv-mt-8">' + escHtml(z.t.reasoned + ' of ' + todoPlural(z.t.cuts, 'cut') + (z.t.reasoned === 1 ? ' has' : ' have') + ' a reason; each bar is what its cuts cost.') + '</div></div>';
}
/* Power → Causes. */
function pcsCausesHtml(a) {
  var z = pcsAnalysis(a), t = z.t;
  var share = function(n) { return t.reasoned ? Math.round(n / t.reasoned * 100) + '%' : '—'; };
  var top = z.reasons[0];
  var h = '<div class="inv-tiles inv-tiles-4" data-pcs-tiles>' +
    _powerTile('With a reason', t.reasoned + '<span class="inv-tile-of">/' + t.cuts + '</span>', t.cuts ? escHtml(Math.round(t.reasoned / t.cuts * 100) + '% of the cuts on record') : 'no cut on record', '', 'reasoned') +
    _powerTile('To complete', String(z.complete.length + z.openAll.filter(function(c) { return z.complete.indexOf(c) < 0; }).length),
      escHtml(t.open ? t.open + ' with no time back' : 'every cut has its time back'), t.open ? 'warning' : '', 'complete') +
    _powerTile('From the grid', share(t.grid), escHtml(t.reasoned ? t.plant + ' in the plant · ' + t.unplaced + ' not placed' : 'no reason recorded yet'), t.grid ? 'info' : '', 'grid') +
    _powerTile('Costliest cause', top ? figWrapHtml(formatCurrency(top.dmg)) : '&mdash;', top ? escHtml(top.c.name + ' · ' + todoPlural(top.n, 'cut')) : 'none recorded yet', top ? (top.tone === 'neutral' ? '' : top.tone) : '', 'top') + '</div>';
  h += pcsCompleteHtml(z);
  if (!t.reasoned) {
    return h + '<div class="inv-empty" data-pcs-none>No cut has a reason yet. Complete a cut (the time the power came back, why it went, what brought it back) ' +
      'and its reason joins the list here: what causes the cuts, where they hit the plant, and what brings the power back.</div>';
  }
  h += '<div class="inv-panels">';
  h += '<div class="inv-panel" id="pcsReasons"><div class="inv-panel-head"><span class="inv-panel-title">What causes them <span class="inv-note">by what they cost</span></span></div>' +
    chartRankedBars(z.reasons.map(pcsReasonRow), { unit: 'money' }) +
    '<div class="inv-note inv-mt-8">' + escHtml('Coded by where it starts: red, in the plant and three times or more in 30 days; amber, in the plant; blue, from the grid; grey, not placed. ' +
      (t.none ? todoPlural(t.none, 'cut') + ' with no reason (' + formatCurrency(gstRound(t.dmgNone)) + ') ' + (t.none === 1 ? 'is' : 'are') + ' not drawn.' : '')) + '</div></div>';
  h += pcsPlantMapHtml(z);
  h += '<div class="inv-panel" id="pcsFixes"><div class="inv-panel-head"><span class="inv-panel-title">What brings it back <span class="inv-note">fastest first</span></span></div>' +
    (z.fixes.length ? chartRankedBars(z.fixes.map(function(x) {
      var rs = Object.keys(x.reasons).sort(function(p, q) { return x.reasons[q] - x.reasons[p]; }).slice(0, 2).map(function(id) { return pcsName(id) + ' (' + x.reasons[id] + ')'; });
      return { label: x.c.name, value: x.median != null ? x.median : 0, display: x.median != null ? 'back in ' + powerDur(Math.round(x.median)) : 'no time back yet',
        sub: [todoPlural(x.n, 'cut'), rs.length ? 'for ' + rs.join(', ') : ''].filter(Boolean).join(' · '), tone: 'neutral' };
    }), { unit: 'count' }) + '<div class="inv-note inv-mt-8">The middle of the minutes from the cut to the power in, over the cuts each fix brought back.</div>'
      : '<div class="inv-empty">No fix recorded yet: what brought the power back is asked with the reason.</div>') + '</div>';
  h += pcsListHtml('reason') + pcsListHtml('fix');
  return h + '</div>';
}
/* Where the cuts hit, station by station, in the plant's order: the whole plant first (a cut of the supply stops everything),
   then the lines, then the supporting stations. Coded by the cuts in the last 30 days that started in the plant. */
function pcsPlantMapHtml(z) {
  var by = {};
  z.places.forEach(function(p) { by[p.key] = p; });
  var keys = ['all'].concat(PLT_STATIONS.map(function(s) { return s[0]; })).filter(function(k) {
    return by[k] || (PLT_LINE_STATIONS[k] || k === 'pick');
  });
  var tiles = keys.map(function(k) {
    var p = by[k] || { n: 0, n30: 0, plant30: 0, dmg: 0, min: 0, units: {} };
    var tone = k === 'all' ? (p.n30 ? 'info' : 'ok') : p.plant30 >= PCS_RECUR ? 'danger' : p.plant30 ? 'warning' : 'ok';
    var units = Object.keys(p.units).map(function(id) { var u = typeof pltUnitById === 'function' ? pltUnitById(id) : null; return (u ? u.name : 'a unit') + ' ' + p.units[id] + '×'; });
    var sub = p.n ? [p.n30 + ' in 30 days', powerHours(p.min) + ' dark', p.dmg ? formatCurrency(p.dmg) : ''].concat(units).filter(Boolean).join(' · ') : 'no cut tied to it';
    return '<div class="inv-tile' + (p.n ? ' inv-tile-' + tone : '') + '" data-pcs-place="' + k + '"><div class="inv-tile-label">' + escHtml(k === 'all' ? 'The whole plant' : pltStationName(k)) + '</div>' +
      '<div class="inv-tile-value">' + p.n + '</div><div class="inv-tile-sub">' + escHtml(sub) + '</div></div>';
  });
  var untied = z.t.reasoned - z.places.reduce(function(s, p) { return s + p.n; }, 0);
  return '<div class="inv-panel inv-panel-flush" id="pcsPlaces"><div class="inv-panel-head"><span class="inv-panel-title">Where they hit</span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPltOpen">The plant</button></div>' +
    '<div class="inv-tiles inv-tiles-flush">' + tiles.join('') + '</div>' +
    '<div class="inv-panel-body inv-note">' + escHtml('Cuts tied to each place. A line is red where three or more cuts started in the plant in 30 days, amber for one or two; ' +
      'the whole plant is blue, the supply’s. ' + (untied > 0 ? todoPlural(untied, 'cut') + ' with a reason ' + (untied === 1 ? 'does' : 'do') + ' not say where it hit.' : '')) + '</div></div>';
}
/* The list itself: each entry, its uses and spellings; renamed, placed or merged by the owner. */
function pcsListHtml(kind) {
  var list = pcsLive(kind), uses = pcsUseCounts();
  if (!list.length) return '';
  var rows = list.map(function(c) { return { c: c, u: uses[c.id] || { n: 0, last: '' } }; }).sort(function(p, q) { return q.u.n - p.u.n || p.c.name.localeCompare(q.c.name); }).map(function(x) {
    var c = x.c, sp = (c.aliases || []).length;
    var meta = [todoPlural(x.u.n, 'cut'), x.u.last ? 'last ' + stockShortDate(x.u.last) : '', kind === 'reason' ? pcsScopeWord(c.scope) : '', sp ? todoPlural(sp, 'spelling') + ' kept' : ''].filter(Boolean).join(' · ');
    return '<div class="inv-row inv-row-2" data-pcs-entry="' + escHtml(c.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(c.name) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap"' + (sp ? ' title="' + escHtml('Typed as: ' + c.aliases.join(' · ')) + '"' : '') + '>' + escHtml(meta) + '</span></span>' +
      '<span class="inv-row-end">' + (kind === 'reason' ? uiDot(pcsTone(c.scope, 0), escHtml(c.scope === 'grid' ? 'Grid' : c.scope === 'plant' ? 'Plant' : 'Not placed')) : '') +
      (pcsCanEdit() ? '<button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPcsEdit" data-id="' + escHtml(c.id) + '">Edit</button>' : '') + '</span></div>';
  });
  return '<div class="inv-panel inv-panel-flush" id="pcsList-' + kind + '"><div class="inv-panel-head"><span class="inv-panel-title">' + (kind === 'reason' ? 'Reasons' : 'Fixes') +
    ' <span class="inv-panel-count">' + list.length + '</span></span></div>' + uiMoreHtml('pcs-list-' + kind, rows, { n: 10, noun: kind === 'reason' ? 'reasons' : 'fixes' }) + '</div>';
}

/* ---------- The list, edited by the owner ---------- */
function pcsCanEdit() { return typeof grdIsOwner !== 'function' || !grdOn() || grdIsOwner(); }
function pcsEditOpen(id) {
  if (!pcsCanEdit()) { uiAlert({ title: 'The owner’s to change', body: 'The list of reasons and fixes is renamed and merged by the owner.' }); return; }
  if (!grdGate('settings', 'edit the power causes', function() { pcsEditOpen(id); })) return;
  var c = pcsGet(id);
  if (!c) return;
  var others = pcsLive(c.kind).filter(function(x) { return x.id !== c.id; }).sort(function(p, q) { return p.name.localeCompare(q.name); });
  var h = '<div class="inv-dialog" data-pcs-edit="' + escHtml(c.id) + '">' + dialogHeadHtml(c.kind === 'reason' ? 'A reason' : 'A fix') + '<div class="inv-fields">' +
    '<div class="inv-field"><label class="inv-field-label" for="pcsEditName">Name</label><input id="pcsEditName" class="inv-input" value="' + escHtml(c.name) + '" autocomplete="off">' +
    '<span class="inv-note">Written the one way when saved; the old name is kept as a spelling.</span></div>';
  if (c.kind === 'reason') h += '<div class="inv-field"><label class="inv-field-label" for="pcsEditScope">Where it starts</label><select id="pcsEditScope" class="inv-select">' +
    PCS_SCOPES.map(function(s) { return '<option value="' + s[0] + '"' + ((c.scope || '') === s[0] ? ' selected' : '') + '>' + s[1] + (s[2] ? ': ' + s[2] : '') + '</option>'; }).join('') + '</select></div>';
  if (others.length) h += '<div class="inv-field"><label class="inv-field-label" for="pcsEditMerge">Merge into</label><select id="pcsEditMerge" class="inv-select"><option value="">Keep it on its own</option>' +
    others.map(function(x) { return '<option value="' + escHtml(x.id) + '">' + escHtml(x.name) + '</option>'; }).join('') + '</select>' +
    '<span class="inv-note">Every cut that named it reads the one it joins, and its spellings go with it.</span></div>';
  h += '</div>' + ((c.aliases || []).length ? '<div class="inv-note">Typed as: ' + escHtml(c.aliases.join(' · ')) + '</div>' : '') +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPcsEditSave" data-id="' + escHtml(c.id) + '">Save</button></div></div>';
  dialogOpen(h, { dismiss: true });
}
function pcsEditSave(id) {
  if (!pcsCanEdit() || !grdGate('settings', 'edit the power causes', function() { pcsEditSave(id); })) return;
  var c = pcsGet(id);
  if (!c) { closeOverlay(); return; }
  var v = function(k) { var el = document.getElementById(k); return el ? el.value : ''; };
  var into = v('pcsEditMerge'), name = pcsCanon(v('pcsEditName'));
  if (!name) { showToast('A name is needed', 'error'); return; }
  if (into) {
    var b = pcsGet(into);
    if (!b || b.id === c.id) return;
    b.aliases = (b.aliases || []).concat([c.name], c.aliases || []).filter(function(a, i, arr) {
      return a.toLowerCase() !== b.name.toLowerCase() && arr.findIndex(function(z) { return z.toLowerCase() === a.toLowerCase(); }) === i;
    }).slice(-PCS_ALIASES_MAX);
    if (c.kind === 'reason' && !b.scope && c.scope) b.scope = c.scope;
    c.mergedInto = b.id; c.mergedAt = Date.now(); c.mergedBy = pcsWho();
    closeOverlay(); saveState(); tabRedrawActive();
    showToast('Merged into ' + b.name, 'success');
    return;
  }
  var clash = pcsLive(c.kind).find(function(x) { return x.id !== c.id && pcsKey(x.name) === pcsKey(name); });
  if (clash) { uiAlert({ title: 'Already on the list', body: '“' + clash.name + '” is on the list. Pick it under Merge into to join the two.' }); return; }
  if (name !== c.name) {
    c.aliases = (c.aliases || []).concat([c.name]).filter(function(a, i, arr) {
      return a.toLowerCase() !== name.toLowerCase() && arr.findIndex(function(z) { return z.toLowerCase() === a.toLowerCase(); }) === i;
    }).slice(-PCS_ALIASES_MAX);
    c.name = name;
  }
  if (c.kind === 'reason') { var sc = v('pcsEditScope'); c.scope = sc === 'grid' || sc === 'plant' ? sc : ''; }
  c.editedAt = Date.now(); c.editedBy = pcsWho();
  closeOverlay(); saveState(); tabRedrawActive();
  showToast('Saved', 'success');
}

/* ---------- The plant register's side ---------- */
/* The cuts tied to a unit, and to a station, over 90 days. */
function pcsTiedTo(match) {
  var today = localDateStr(), from = isoAddDays(today, -89), n = 0, min = 0, last = '', reasons = {};
  powerCuts(from, today).forEach(function(c) {
    if (!match(c)) return;
    n++; min += c.min || 0; if (c.date > last) last = c.date;
    if (c.reason) { var r = pcsGet(c.reason); if (r) reasons[r.name] = (reasons[r.name] || 0) + 1; }
  });
  return { n: n, min: min, last: last, reasons: Object.keys(reasons).sort(function(p, q) { return reasons[q] - reasons[p]; }) };
}
function pcsUnitHtml(u) {
  var s = pcsTiedTo(function(c) { return c.unitId === u.id; });
  if (!s.n) return '';
  return '<div class="inv-row inv-row-2" data-pcs-unit><span class="inv-row-main"><span class="inv-row-title">' + escHtml(todoPlural(s.n, 'power cut') + ' tied to it in 90 days') + '</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml([powerHours(s.min) + ' dark', 'last ' + formatDate(s.last), s.reasons.length ? s.reasons.slice(0, 2).join(', ') : ''].filter(Boolean).join(' · ')) + '</span></span>' +
    '<span class="inv-row-end">' + uiDot(s.n >= PCS_RECUR ? 'danger' : 'warning', s.n >= PCS_RECUR ? 'Keeps cutting' : 'Cut') + '</span></div>';
}
function pcsStationNote(station) {
  var s = pcsTiedTo(function(c) { return c.where === station || (c.unitId && typeof pltUnitById === 'function' && pltUnitById(c.unitId) && pltUnitById(c.unitId).station === station); });
  if (!s.n) return '';
  return '<div class="inv-panel-body inv-note" data-pcs-station="' + station + '">' + escHtml(todoPlural(s.n, 'power cut') + ' hit ' + pltStationName(station) + ' in 90 days' +
    (s.reasons.length ? ': ' + s.reasons.slice(0, 2).join(', ') : '') + '.') +
    ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPowerTabGo" data-tab="causes">Causes</button></div>';
}

/* ---------- The To-do ---------- */
TODO_RULES.push(['powerComplete', 'Power: a cut with no time back, or no reason']);
TODO_CHECK_DEFAULTS.powerComplete = true;
TODO_RULE_FNS.powerComplete = function() {
  var z = todoPassMemo('pcsAnalysis', function() { return pcsAnalysis(); });
  var list = z.complete;
  if (!list.length) return [];
  var noTime = list.filter(function(c) { return c.open; }), noWhy = list.filter(function(c) { return !c.reason; });
  var first = noTime[0] || list[0];
  return [{ key: 'powerComplete', rule: 'powerComplete', tone: noTime.length ? 'amber' : 'info',
    title: list.length === 1 ? 'Complete the power cut of ' + stockShortDate(first.date) + ', ' + powerClock(first.from) : 'Complete ' + list.length + ' power cuts',
    sub: [noTime.length ? 'no time back on ' + noTime.length : '', noWhy.length ? 'no reason on ' + noWhy.length : ''].filter(Boolean).join(' · '),
    why: 'Power · the cuts', cuts: list.map(function(c) { return c.ids[0]; }),
    facts: list.slice(0, 6).map(function(c) { var nd = pcsNeeds(c); return [pcsCutWhen(c), [nd.time ? 'no time back' : '', nd.reason ? 'no reason' : ''].filter(Boolean).join(', ')]; })
      .concat(list.length > 6 ? [['And', (list.length - 6) + ' more']] : []),
    clears: 'Clears itself when each cut has its time back (in the last ' + PCS_OPEN_DAYS + ' days) and a reason (in the last ' + PCS_ASK_DAYS + ' days). History imported from the log is never asked.',
    go: { kind: 'powerCut', id: first.ids[0] }, goLabel: 'Complete',
    sig: list.map(function(c) { return c.ids[0] + (c.open ? 'o' : '') + (c.reason ? '' : 'r'); }).join(',') + '|' + (noTime.length ? 'amber' : 'info') }];
};
TODO_RULES.push(['powerCause', 'Power: one cause keeps cutting the power']);
TODO_CHECK_DEFAULTS.powerCause = true;
TODO_RULE_FNS.powerCause = function() {
  var z = todoPassMemo('pcsAnalysis', function() { return pcsAnalysis(); });
  return z.reasons.filter(function(e) { return e.c.scope === 'grid' ? e.n30 >= PCS_RECUR_RED : e.n30 >= PCS_RECUR; }).map(function(e) {
    var grid = e.c.scope === 'grid', fx = Object.keys(e.fixes).sort(function(p, q) { return e.fixes[q] - e.fixes[p]; })[0];
    var where = Object.keys(e.where).sort(function(p, q) { return e.where[q] - e.where[p]; })[0];
    var whereWord = where ? pcsWhereWord(where.indexOf('u:') === 0 ? null : where, where.indexOf('u:') === 0 ? where.slice(2) : null) : '';
    return { key: 'powerCause:' + e.c.id, rule: 'powerCause', tone: !grid && e.n30 >= PCS_RECUR_RED ? 'red' : 'amber', amount: e.dmg30, reasonId: e.c.id,
      unitId: where && where.indexOf('u:') === 0 ? where.slice(2) : null, scope: e.c.scope || '',
      title: '“' + e.c.name + '” cut the power ' + e.n30 + ' times in 30 days',
      sub: [e.dmg30 ? formatCurrency(e.dmg30) + ' in damage' : '', pcsScopeWord(e.c.scope), whereWord ? 'hit ' + whereWord : '', fx ? 'brought back by ' + pcsName(fx) : ''].filter(Boolean).join(' · '),
      why: 'Power · the causes',
      facts: [['Cuts in 30 days', String(e.n30)], ['Damage in 30 days', formatCurrency(e.dmg30)], ['Where it starts', pcsScopeWord(e.c.scope)]]
        .concat(whereWord ? [['Where it hit', whereWord]] : []).concat(fx ? [['What brought it back', pcsName(fx)]] : []),
      clears: 'Clears itself once it has come fewer than ' + (grid ? PCS_RECUR_RED : PCS_RECUR) + ' times in the last 30 days.',
      go: { kind: 'power', tab: 'causes' }, goLabel: 'Causes', sig: e.c.id + '|' + e.n30 + '|' + (!grid && e.n30 >= PCS_RECUR_RED ? 'red' : 'amber') };
  });
};

function pcsAction(action, btn) {
  switch (action) {
    case 'invPcsOpen': pcsOpen(btn.dataset.id); return true;
    case 'invPcsPick': pcsPick(btn.dataset.kind, btn.dataset.id); return true;
    case 'invPcsKeepNew': if (_pcs && _pcs[btn.dataset.kind]) { _pcs[btn.dataset.kind].keepNew = true; pcsSync(btn.dataset.kind); } return true;
    case 'invPcsScope':
      if (_pcs) {
        _pcs.scope = btn.dataset.scope || '';
        document.querySelectorAll('[data-pcs-scope] [data-action="invPcsScope"]').forEach(function(b) { b.setAttribute('aria-pressed', String((b.dataset.scope || '') === _pcs.scope)); });
      }
      return true;
    case 'invPcsSave': pcsSave(); return true;
    case 'invPcsEdit': pcsEditOpen(btn.dataset.id); return true;
    case 'invPcsEditSave': pcsEditSave(btn.dataset.id); return true;
    case 'invPowerTabGo': powerSetTab(btn.dataset.tab); switchTab('pagePower'); return true;
  }
  return false;
}
