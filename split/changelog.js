/* ===== THE CHANGE LOG (the guard, step G1 · P141) =====
   Owner, 1 Oct 2026: "log every change in history", "tag the user appropriately", and for later, "all other changes
   made by any other ID merge into [the admin's data] but don't overwrite and give a log of changes". Nothing recorded who
   changed a record, or what it said before.

   So every save is compared with the book as it stood after the save before, record by record: what was added, what was
   changed (each changed field, from and to) and what was removed, tagged with who was signed in (grdUserId, the gate) and
   on which device (devId), and kept in the book (S.changeLog, newest last), so it travels with a backup and the GitHub
   copy, where the merge will read it. An entry names its store (`coll`), its record (`rid`) and its fields exactly: the
   merge needs no more to find what it is about. History lists the log under Changes.

   What is compared (CHG_TRACK, and the book's other keys walked the same way): every list of records, every record of a
   keyed store (a day of attendance, a payee rule), and every setting as one record named by its Settings section. What
   is not: the log itself; migration flags (a key starting _, at any depth, which also covers a line's auto-fill marks);
   `updatedAt`, which moves with every edit; what is worked out from other records (a challan line's billed share, a
   client's recent vehicles); what is learnt (the roll reader's and the register reader's lessons); and the messages kept
   whole (a roll, a stock message, a production message or photo), whose arrival is one line, never their text. A secret
   (a PIN's hash, the recovery code's) is said to have changed and never shown.

   How it stays cheap: each record is held as its string (a native JSON.stringify) from one save to the next, and only a
   record whose string moved is compared field by field. Nothing relies on how a module changes a record: an edit in
   place, a push and a replacement all move the string. A save reads the book once, record by record, which costs less
   than the save's own stringify of it (P141 measures both).

   The rules: the log never changes a record and never stops a save (an error is caught and counted; Settings → storage
   diagnostics says so); a save that changed nothing adds nothing; a book replaced whole is the new starting point, never
   logged record by record (another window's save loaded here, which that window logged; an import or a pull, logged as
   one line); a change to the same record by the same person on the same device within a minute is one entry (the
   attendance hours save at every keystroke); at most 120 days and 4,000 entries are kept, the oldest dropped first and
   counted (S.changeLogDropped). */

var CHG_MAX_ENTRIES = 4000;
var CHG_MAX_DAYS = 120;
var CHG_MAX_FIELDS = 12;
var CHG_VAL_MAX = 80;
var CHG_AGG = 25;            // more adds or removes than this in one store in one save are one entry
var CHG_AGG_RIDS = 200;      // and it names this many of them
var CHG_MERGE_MS = 60000;    // the same record, the same person, the same device, within a minute: one entry
var CHG_DEPTH = 3;           // fields are named this deep: a line's rate (items[0].rate), a worker's mark (marks.12.st)
var CHG_MATCH_MS = 2000;     // History: an event and an entry on the same record this close together are one act

// The log is a container of the book: filled empty on an older book, carried by every backup and every pull.
STATE_CONTAINERS.push('changeLog');

/* What a person calls each store's records. kind: 'arr' a list of records (an id, else `key`), 'map' records by key,
   'cfg' one object as one record (`sec` names its Settings section, `dflt` the values the app fills in unasked, which
   are no change), 'raw' messages kept whole (their arrival and removal only), 'rows' the bank statement (a row's own
   edits only: an import is the import's one line), 'skip' never compared. `omit`: fields worked out from elsewhere. */
var CHG_TRACK = [
  { path: 'invoices', kind: 'arr', noun: 'invoice', label: function(r) { return chgJoin(r.displayNumber || r.invoiceNumber, r.clientName || chgClientName(r.clientId)); } },
  { path: 'incomingMaterial', kind: 'arr', noun: 'challan', omit: ['billedQty', 'billedNos', 'invoiceIds', 'invoiceId', 'invoiced'],
    label: function(r) { return chgJoin(r.challanNo || 'no number', r.clientName || chgClientName(r.clientId), r.challanDate ? chgDay(r.challanDate) : ''); } },
  { path: 'clients', kind: 'arr', noun: 'client', omit: ['recentVehicles'], cid: function(r) { return r.id; }, label: function(r) { return r.name; } },
  { path: 'items', kind: 'arr', noun: 'item', label: function(r) { return chgJoin(r.partNumber, r.gauge); } },
  { path: 'creditNotes', kind: 'arr', noun: 'credit note', label: function(r) { return chgJoin(r.displayNumber, r.clientName || chgClientName(r.clientId)); } },
  { path: 'quotations', kind: 'arr', noun: 'quotation',
    label: function(r) { return chgJoin(r.displayNumber ? r.displayNumber + (r.rev ? ' Rev ' + r.rev : '') : 'draft', r.to && r.to.name); } },
  { path: 'voidedNumbers', kind: 'arr', noun: 'deleted number', key: function(r) { return 'V:' + (r.displayNumber || r.invoiceNumber || '') + '@' + (r.voidedAt || ''); },
    label: function(r) { return chgJoin(r.displayNumber || r.invoiceNumber, r.reason); } },
  { path: 'extraExceptions', kind: 'arr', noun: 'explained exception', key: function(r) { return 'X:' + [r.iso, r.scope, r.key, r.at].join('|'); },
    label: function(r) { return chgJoin(r.label || r.key, r.iso ? chgDay(r.iso) : ''); } },
  { path: 'attendanceDeletes', kind: 'arr', noun: 'deleted attendance day', label: function(r) { return chgJoin(r.iso ? chgDay(r.iso) : r.key, r.reason); } },
  { path: 'staff', kind: 'arr', noun: 'worker', label: function(r) { return r.name; } },
  { path: 'staffPayments', kind: 'arr', noun: 'payment', label: function(r) { return chgJoin(chgStaffName(r.staffId), r.kind, chgMoney(r.amount), r.date ? chgDay(r.date) : ''); } },
  { path: 'payCarryClears', kind: 'arr', noun: 'cleared balance', label: function(r) { return chgJoin(chgStaffName(r.staffId), r.through ? 'to ' + chgDay(r.through) : '', r.reason); } },
  { path: 'costBills', kind: 'arr', noun: 'bill',
    label: function(r) { return chgJoin((typeof COST_BILL_KINDS !== 'undefined' && COST_BILL_KINDS[r.kind]) || r.kind, r.month, chgMoney(r.amount)); } },
  { path: 'payrollPaid', kind: 'arr', noun: 'payroll as paid', plural: 'payrolls as paid', label: function(r) { return chgJoin(r.month, r.source); } },
  { path: 'attendance', kind: 'map', noun: 'attendance', plural: 'attendance days', label: function(r, k) { return chgDay(k); } },
  { path: 'shiftNeeds', kind: 'map', noun: 'heads needed', plural: 'days of heads needed', label: function(r, k) { return chgDay(k); } },
  { path: 'partWeights', kind: 'map', noun: 'part weight', label: function(r, k) { return k; } },
  { path: 'areaTargets', kind: 'cfg', sec: 'Staff → Areas → complements' },
  { path: 'relayPastes', kind: 'raw', noun: 'roll', label: function(r) { return chgJoin(r.kind === 'in' ? 'in-time' : r.kind === 'out' ? 'out-time' : r.kind, r.date ? chgDay(r.date) : ''); } },
  { path: 'relayLearn', kind: 'skip' },
  { path: 'attRegister.months', kind: 'map', noun: 'register page', label: function(r, k) { return k; } },
  { path: 'attRegister.names', kind: 'map', noun: 'register column name', label: function(r, k) { return k; } },
  { path: 'stock.items', kind: 'arr', noun: 'stock line', omit: ['lastPos'], label: function(r) { return r.name; } },
  { path: 'stock.entries', kind: 'arr', noun: 'stock entry', plural: 'stock entries',
    label: function(r) { return chgJoin(chgStockName(r.itemId), r.kind, r.qty != null ? r.qty + (chgStockUnit(r.itemId) ? ' ' + chgStockUnit(r.itemId) : '') : '', r.date ? chgDay(r.date) : ''); } },
  { path: 'stock.pastes', kind: 'raw', noun: 'stock message', label: function(r) { return chgJoin(r.sentBy, r.to ? chgDay(r.to) : ''); } },
  { path: 'production.entries', kind: 'arr', noun: 'production entry', plural: 'production entries',
    label: function(r) { return chgJoin(r.kind, r.line, r.client || chgClientName(r.clientId), r.part, r.qty != null ? r.qty + (r.unit ? ' ' + r.unit : '') : '', r.date ? chgDay(r.date) : ''); } },
  { path: 'production.pastes', kind: 'raw', noun: 'production message', label: function(r) { return chgJoin(r.kind, r.day ? chgDay(r.day) : ''); } },
  { path: 'production.photos', kind: 'raw', noun: 'register photo', label: function(r) { return r.name; } },
  { path: 'production.learn', kind: 'skip' },
  { path: 'kb.articles', kind: 'arr', noun: 'article', omit: ['versions'],
    label: function(r) { return chgJoin(typeof kbKindName === 'function' ? kbKindName(r.kind) : r.kind, r.title); } },
  { path: 'kb.trained', kind: 'arr', noun: 'training record', label: function(r) { return chgJoin(r.name, r.on ? chgDay(r.on) : ''); } },
  { path: 'kb.paths', kind: 'arr', noun: 'training path', label: function(r) { return r.title; } },
  { path: 'bank.rows', kind: 'rows', noun: 'statement row', proj: function(r) { return { set: r.set, clientId: r.clientId, notCost: r.notCost }; },
    label: function(r) { return chgJoin(r.date ? chgDay(r.date) : '', r.cr ? chgMoney(r.cr) + ' in' : r.dr ? chgMoney(r.dr) + ' out' : '', chgCut(r.narration, 40)); } },
  { path: 'bank.imports', kind: 'arr', noun: 'statement import', label: function(r) { return chgJoin(r.file, r.rows != null ? r.rows + ' rows' : '', r.from ? chgDay(r.from) + ' to ' + chgDay(r.to) : ''); } },
  { path: 'bank.parties', kind: 'map', noun: 'payee rule', label: function(r, k) { return k; } },
  { path: 'bank.opening', kind: 'map', noun: 'opening balance', cid: function(r, k) { return k; }, label: function(r, k) { return chgClientName(k) || k; } },
  { path: 'bank.gstNotes', kind: 'map', noun: 'GST note', label: function(r, k) { return k; } },
  { path: 'bank.bounces', kind: 'map', noun: 'returned cheque', label: function(r, k) { return k; } },
  { path: 'todo.tasks', kind: 'arr', noun: 'task', label: function(r) { return r.text; } },
  { path: 'todo.snoozes', kind: 'map', noun: 'snooze', label: function(r, k) { return k; } },
  // A task answered (learn.js, I5) is a record of use, not a change anybody made: kept quietly, as a push's stamp is.
  { path: 'todo.resp', kind: 'skip' },
  { path: 'todo.learn', kind: 'cfg', sec: 'To-do → Learnt from your answers' },
  { path: 'power.items', kind: 'map', noun: 'power open item', label: function(r, k) {
    var it = typeof POWER_ITEMS !== 'undefined' ? POWER_ITEMS.find(function(x) { return x[0] === k; }) : null;
    return it ? it[1] : k;
  } },
  { path: 'power.load', kind: 'cfg', sec: 'Power → the connection' },
  { path: 'power.cfg', kind: 'cfg', sec: 'Power → the options’ figures' },
  { path: 'users', kind: 'arr', noun: 'user', label: function(r) { return chgJoin(r.name, r.role); } },
  // A push stamps its time on the device's row and keeps it quietly (devices.js devPushPrep): a record of the sync, not a
  // change anybody made, and it read "changed device · lastPushAt" at the next save (the QA audit, QA4-11).
  { path: 'devices', kind: 'arr', noun: 'device', omit: ['lastPushAt'], label: function(r) { return r.name; } },
  // Settings: each one record, named by the section that sets it.
  { path: 'company', kind: 'cfg', sec: 'Company' },
  { path: 'labour', kind: 'cfg', sec: { otMult: 'Overtime', otCap: 'Overtime', otCapFrom: 'Overtime', gateFull: 'Rest days & attendance', gateHalf: 'Rest days & attendance',
      restCreditMinDays: 'Rest days & attendance', holidays: 'Rest days & attendance', extraRate: 'The extra', extraHoursPerHead: 'The extra', modelPerKg: 'Modelled labour', '': 'Labour' },
    dflt: function() { return getDefaultState().labour; } },
  { path: 'rateCheck', kind: 'cfg', sec: 'Rate & weight check', dflt: function() { return RATE_CHECK_DEFAULTS; } },
  { path: 'invStateCheck', kind: 'cfg', sec: 'Invoice states', dflt: function() { return INV_STATE_CHECK_DEFAULTS; } },
  { path: 'stockCheck', kind: 'cfg', sec: { redDays: 'Stock alerts', amberDays: 'Stock alerts', chemModel: 'Live cost fallbacks', leadDays: 'Stock → Reorder list', coverDays: 'Stock → Reorder list', '': 'Stock alerts' },
    dflt: function() { return Object.assign({}, STOCK_CHECK_DEFAULTS, typeof STOCK_REORDER_DEFAULTS !== 'undefined' ? STOCK_REORDER_DEFAULTS : {}); } },
  { path: 'todoCheck', kind: 'cfg', sec: 'To-do', dflt: function() { return typeof TODO_CHECK_DEFAULTS !== 'undefined' ? TODO_CHECK_DEFAULTS : getDefaultState().todoCheck; } },
  { path: 'costModel', kind: 'cfg', sec: 'Live cost fallbacks', dflt: function() { return typeof COST_MODEL_DEFAULTS !== 'undefined' ? COST_MODEL_DEFAULTS : getDefaultState().costModel; } },
  { path: 'qtnCfg', kind: 'cfg', sec: 'Quotations', dflt: function() { return getDefaultState().qtnCfg; } },
  { path: 'zinc', kind: 'cfg', sec: 'Zinc rate', omit: ['lmeHistory'],
    dflt: function() { return { ratePerKg: null, premiumPerKg: 15, upliftPct: typeof ZINC_DEFAULT_UPLIFT !== 'undefined' ? ZINC_DEFAULT_UPLIFT : null, basis: 'manual', updatedAt: null, source: '' }; } },
  { path: 'perfCfg', kind: 'cfg', sec: 'Clients → Performance → By the hour' },
  { path: 'guardCfg', kind: 'cfg', sec: 'Users & access', dflt: function() { return getDefaultState().guardCfg || {}; } }
];
// Stores a parent object holds; a key of theirs that no row above names is compared the same way (a list, a setting).
var CHG_PARENTS = { stock: 1, production: 1, bank: 1, todo: 1, power: 1, kb: 1 };
// Never compared: the log itself (a key starting _ never is either).
var CHG_SKIP_TOP = { changeLog: 1, changeLogDropped: 1 };
// The book's own figures, grouped by the Settings section that sets them. A figure no section names is its own record.
var CHG_SCALARS = { invPrefix: 'invoice', invNextNum: 'invoice', invNextSetAt: 'invoice', cnNextNum: 'cn', bankDetails: 'bank',
  defaultCostPerKg: 'fullCost', companyLogo: 'logo' };
var CHG_SCALAR_SEC = { invoice: 'Invoice series', cn: 'Credit note series', bank: 'Bank details', fullCost: 'Full cost', logo: 'Company logo' };
// Fields never compared, at any depth (with every key starting _).
var CHG_OMIT = { updatedAt: 1 };
// A secret is said to have changed, never shown: not its hash, not its salt.
var CHG_SECRET = { secret: 1, recovery: 1, salt: 1, hash: 1, pin: 1, pinHash: 1, password: 1, token: 1 };
// Said to have changed without the value (an image).
var CHG_NOVALUE = { companyLogo: 1 };
var CHG_ARR_NOUN = { items: 'line', lines: 'line', rates: 'rate', pieceRates: 'piece rate', pieceWeights: 'piece weight', itemRates: 'item rate',
  extra: 'EXTRA row', crew: 'hand', relayNames: 'spelling', aliases: 'spelling', corrections: 'correction', holidays: 'holiday' };

var _chg = null;            // { of: the S it was taken from, units: { path: { sp, recs: Map(key → the record's string) } } }
var _chgPrevCounts = null;  // the book before it was replaced whole, for the line that says so
var _chgHealth = { saves: 0, logged: 0, errors: 0, lastError: '', lastErrorAt: 0, lastMs: 0, maxMs: 0, baselineMs: 0 };

/* ---------- small helpers ---------- */
function chgNow() { try { return performance.now(); } catch (e) { return Date.now(); } }
function chgJoin() {
  return Array.prototype.filter.call(arguments, function(x) { return x != null && String(x).trim() !== ''; }).map(String).join(' · ');
}
function chgCut(s, n) { s = s == null ? '' : String(s); n = n || CHG_VAL_MAX; return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function chgDay(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? formatDate(iso) : String(iso == null ? '' : iso); }
function chgMoney(n) { return n == null || n === '' || isNaN(n) ? '' : formatCurrency(Number(n)); }
function chgFind(list, id) { return Array.isArray(list) ? list.find(function(x) { return x && String(x.id) === String(id); }) : null; }
function chgClientName(id) { if (id == null || id === '' || !S) return ''; var c = chgFind(S.clients, id); return c ? c.name : ''; }
function chgStaffName(id) { if (id == null || !S) return ''; var w = chgFind(S.staff, id); return w ? w.name : ''; }
function chgStockName(id) { var it = S && S.stock ? chgFind(S.stock.items, id) : null; return it ? it.name : ''; }
function chgStockUnit(id) { var it = S && S.stock ? chgFind(S.stock.items, id) : null; return it ? it.unit || '' : ''; }
function chgUid() { return 'CL-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
/* Who made the change: the person signed in (the gate), unless a save is being made for somebody (chgAs). */
var _chgAs;   // undefined: whoever is signed in
function chgBy() {
  if (_chgAs !== undefined) return _chgAs;
  try { return typeof grdUserId === 'function' ? (grdUserId() || null) : null; } catch (e) { return null; }
}
/* Runs fn (a save) as the change of `by`: what the guard saves with nobody signed in any more, or not yet (the guard turned
   off, a PIN reset from the lock), or with a book whose users do not hold the person (an import), is that person's, not
   "Someone"'s (the QA audit of 2 Oct 2026, QA4-10). The log is written at the start of a save (saveState → chgOnSave), so
   the name holds for that save alone. */
function chgAs(by, fn) {
  var was = _chgAs;
  _chgAs = by == null ? null : by;
  try { return fn(); } finally { _chgAs = was; }
}
function chgDev() { try { return typeof devId === 'function' ? (devId() || null) : null; } catch (e) { return null; } }
function chgSpecOf(coll) { return CHG_TRACK.find(function(sp) { return sp.path === coll; }) || null; }
function chgNounOf(coll, n) {
  var sp = chgSpecOf(coll), noun = sp && sp.noun ? sp.noun : String(coll || 'record').split('.').pop();
  return n === 1 ? noun : (sp && sp.plural) || noun + 's';
}

/* ---------- the stores ---------- */
function chgGet(path) {
  var v = S;
  for (var parts = path.split('.'), i = 0; i < parts.length; i++) {
    if (v == null || typeof v !== 'object') return undefined;
    v = v[parts[i]];
  }
  return v;
}
// The book's own figures as records: { group: { key: value } }.
function chgScalars() {
  var out = {};
  Object.keys(S).forEach(function(k) {
    var v = S[k];
    if (k.charAt(0) === '_' || CHG_SKIP_TOP[k] || (v !== null && typeof v === 'object')) return;
    var g = CHG_SCALARS[k] || k;
    (out[g] = out[g] || {})[k] = v;
  });
  return out;
}
// A parent's own figures (bank.account, say): one record.
function chgParentScalars(p) {
  var o = S[p], out = {}, any = false;
  Object.keys(o).forEach(function(k) { var v = o[k]; if (k.charAt(0) !== '_' && (v === null || typeof v !== 'object')) { out[k] = v; any = true; } });
  return any ? out : undefined;
}
// Every store the book holds now, each with its spec.
function chgUnits() {
  var known = {}, units = [];
  CHG_TRACK.forEach(function(sp) { known[sp.path] = sp; });
  function add(path, v) {
    var sp = known[path];
    if (sp) { if (sp.kind !== 'skip') units.push(sp); return; }
    if (Array.isArray(v)) units.push({ path: path, kind: 'arr', generic: true });
    else if (v !== null && typeof v === 'object') units.push({ path: path, kind: 'cfg', generic: true, sec: path });
  }
  Object.keys(S).forEach(function(k) {
    var v = S[k];
    if (k.charAt(0) === '_' || CHG_SKIP_TOP[k] || v === null || typeof v !== 'object') return;
    if (CHG_PARENTS[k] && !Array.isArray(v)) {
      Object.keys(v).forEach(function(sk) { if (sk.charAt(0) !== '_') add(k + '.' + sk, v[sk]); });
      if (chgParentScalars(k)) units.push({ path: k + '.*', kind: 'cfg', generic: true, sec: k, get: function() { return chgParentScalars(k); } });
      return;
    }
    add(k, v);
  });
  units.push({ path: '#settings', kind: 'scalars', coll: 'settings', get: chgScalars });
  return units;
}
function chgCont(sp) { return sp.get ? sp.get() : chgGet(sp.path); }
function chgKey(sp, r, i) {
  if (sp.key) return sp.key(r, i);
  return r && typeof r === 'object' && r.id != null ? String(r.id) : '#' + i;
}
/* A record as compared: its string, held per record between saves (a message kept whole is compared by its presence
   alone). Record by record, never the store whole: a store's one string is a large allocation at every save, and the
   collections it set off cost more than the comparing (measured on a 4 MB book: 2.4 ms for the invoices one by one,
   8.7 ms as one string). */
function chgStr(sp, r) {
  if (sp.kind === 'raw') return '';
  var s = JSON.stringify(sp.proj ? sp.proj(r) : r);
  return s === undefined ? 'null' : s;
}
/* Every record of a store, in order: fn(key, record). Two records under one id (a hand-edited backup) are each their own.
   Returns whether a key is in the store now. */
var CHG_NONE = function() { return false; };
function chgEach(sp, cont, fn) {
  if (cont == null) return CHG_NONE;
  if (sp.kind === 'cfg') { fn('', cont); return function(k) { return k === ''; }; }
  if (sp.kind === 'map' || sp.kind === 'scalars') {
    if (typeof cont !== 'object' || Array.isArray(cont)) return CHG_NONE;
    Object.keys(cont).forEach(function(k) { fn(k, cont[k]); });
    return function(k) { return Object.prototype.hasOwnProperty.call(cont, k); };
  }
  if (!Array.isArray(cont)) return CHG_NONE;
  var seen = new Set();
  for (var i = 0; i < cont.length; i++) {
    var k = chgKey(sp, cont[i], i);
    if (seen.has(k)) { var n = 2; while (seen.has(k + '#' + n)) n++; k = k + '#' + n; }
    seen.add(k);
    fn(k, cont[i]);
  }
  return function(k) { return seen.has(k); };
}

/* ---------- the starting point ---------- */
function chgBaseline() {
  var t0 = chgNow(), prev = _chg;
  try {
    // What the book held before it was replaced (an import, a pull: chgAdopted says so).
    var o = prev && prev.of && prev.of !== S ? prev.of : null;
    _chgPrevCounts = o ? { invoices: (o.invoices || []).length, incomingMaterial: (o.incomingMaterial || []).length, clients: (o.clients || []).length, staff: (o.staff || []).length } : null;
    _chg = { of: S, units: {} };
    if (!S) return;
    chgUnits().forEach(function(sp) {
      var cont = chgCont(sp);
      if (cont === undefined) return;
      var recs = new Map();
      chgEach(sp, cont, function(k, r) { recs.set(k, chgStr(sp, r)); });
      _chg.units[sp.path] = { sp: sp, recs: recs };
    });
  } catch (e) {
    chgNoteError(e);
    _chg = { of: S, units: {}, broken: true };
  } finally {
    _chgHealth.baselineMs = chgNow() - t0;
  }
}

/* A book adopted whole (an import, a pull: adoptState): the new starting point, and one line saying the book was replaced,
   by whom, from what, so History tells a replaced book from one edited. */
function chgAdopted() {
  try {
    chgBaseline();
    var before = _chgPrevCounts;
    _chgPrevCounts = null;
    if (!S) return;
    var how = (typeof _ghBusy !== 'undefined' && _ghBusy) ? 'a pull from GitHub' : 'an import';
    var fields = [];
    if (before) ['invoices', 'incomingMaterial', 'clients', 'staff'].forEach(function(k) {
      var n = (S[k] || []).length;
      if (before[k] !== n) fields.push({ f: k, from: before[k], to: n });
    });
    chgAppend([{ id: chgUid(), at: Date.now(), by: chgBy(), dev: chgDev(), op: 'change', coll: 'book', rid: null, label: 'the whole book, by ' + how, fields: fields }]);
  } catch (e) { chgNoteError(e); }
}

/* ---------- at each save (saveState) ---------- */
function chgOnSave() {
  if (!S) return;
  var t0 = chgNow();
  try {
    // The book was replaced without a word here: what is in memory is the new starting point.
    if (!_chg || _chg.of !== S || _chg.broken) { chgBaseline(); return; }
    var entries = chgCollect();
    if (entries.length) chgAppend(entries);
    _chgHealth.saves++;
  } catch (e) {
    chgNoteError(e);
    // Compared with this save from now on: the next save is not blamed for this one.
    try { chgBaseline(); } catch (e2) { /* counted above */ }
  } finally {
    var ms = chgNow() - t0;
    _chgHealth.lastMs = ms;
    if (ms > _chgHealth.maxMs) _chgHealth.maxMs = ms;
  }
}
function chgNoteError(e) {
  _chgHealth.errors++;
  _chgHealth.lastError = (e && (e.message || e.name)) || String(e);
  _chgHealth.lastErrorAt = Date.now();
}

function chgCollect() {
  var ctx = { at: Date.now(), by: chgBy(), dev: chgDev() }, out = [], seen = {};
  chgUnits().forEach(function(sp) {
    seen[sp.path] = true;
    chgUnitDiff(sp, chgCont(sp), ctx, out);
  });
  // A store that was there and is gone.
  Object.keys(_chg.units).forEach(function(p) { if (!seen[p]) chgUnitDiff(_chg.units[p].sp, undefined, ctx, out); });
  return chgPostRules(out);
}

function chgUnitDiff(sp, cont, ctx, out) {
  var c = _chg.units[sp.path];
  if (cont === undefined && !c) return;
  if (!c) c = _chg.units[sp.path] = { sp: sp, recs: new Map() };
  var cache = c.recs, coll = sp.coll || sp.path, adds = [], changed = [], removed = [], matched = 0;
  var has = chgEach(sp, cont, function(k, r) {
    var s = chgStr(sp, r), prev = cache.get(k);
    if (prev === undefined) { adds.push([k, r]); cache.set(k, s); return; }
    matched++;
    if (prev !== s) { changed.push([k, r, prev]); cache.set(k, s); }
  });
  if (matched + adds.length < cache.size) {
    cache.forEach(function(s, k) { if (!has(k)) removed.push([k, s]); });
    removed.forEach(function(x) { cache.delete(x[0]); });
  }
  if (cont === undefined) delete _chg.units[sp.path];

  if (sp.kind === 'cfg') {
    // One record: changed, set where there was none, or gone. What the app fills in unasked (dflt) is no change.
    var before = changed.length ? changed[0][2] : adds.length ? null : removed.length ? removed[0][1] : undefined;
    if (before === undefined) return;
    var dfl = sp.dflt ? sp.dflt() || {} : {};
    var d0 = chgFieldsOf(Object.assign({}, dfl, before == null ? {} : JSON.parse(before)), Object.assign({}, dfl, cont || {}), sp);
    if (d0.out.length || d0.more) out.push(chgMake(ctx, 'change', coll, null, chgCfgLabel(sp, d0.out), d0, null));
    return;
  }
  changed.forEach(function(x) {
    var k = x[0], rec = x[1], d = chgFieldsOf(JSON.parse(x[2]), sp.proj ? sp.proj(rec) : rec, sp);
    if (!d.out.length && !d.more) return;   // only what is not compared moved (a challan line's billed share)
    out.push(chgMake(ctx, 'change', coll, chgRid(sp, k, rec), chgLabel(sp, rec, k), d, chgCid(sp, rec, k)));
  });
  var parse = function(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  [['add', adds], ['remove', removed.map(function(x) { return [x[0], parse(x[1])]; })]].forEach(function(pair) {
    var op = pair[0], recs = pair[1];
    if (!recs.length) return;
    if (recs.length > CHG_AGG || sp.kind === 'rows') {
      var e = chgMake(ctx, op, coll, null, recs.length + ' ' + chgNounOf(coll, recs.length), null, null);
      e.n = recs.length;
      e.rids = recs.slice(0, CHG_AGG_RIDS).map(function(x) { return chgRid(sp, x[0], x[1]); });
      out.push(e);
      return;
    }
    recs.forEach(function(x) { out.push(chgMake(ctx, op, coll, chgRid(sp, x[0], x[1]), chgLabel(sp, x[1], x[0]), null, chgCid(sp, x[1], x[0]))); });
  });
}

function chgMake(ctx, op, coll, rid, label, d, cid) {
  var e = { id: chgUid(), at: ctx.at, by: ctx.by, dev: ctx.dev, op: op, coll: coll, rid: rid === undefined ? null : rid, label: chgCut(label || '', 120),
    fields: d ? d.out : [] };
  if (d && d.more) e.more = d.more;
  if (cid != null && cid !== '') e.cid = cid;
  return e;
}
// A record's id as the book holds it (a number stays a number); a keyed record's key.
function chgRid(sp, k, rec) {
  if (sp.kind === 'arr' || sp.kind === 'rows' || sp.kind === 'raw') return rec && rec.id != null && !sp.key ? rec.id : k;
  return k;
}
// The rid a record of a store is logged under, for a screen that names the record (History's events).
function chgRidOf(coll, rec) {
  var sp = chgSpecOf(coll);
  return sp && sp.key ? sp.key(rec, 0) : rec && rec.id != null ? rec.id : null;
}
function chgCid(sp, rec, k) {
  try { return sp.cid ? sp.cid(rec, k) : rec && typeof rec === 'object' && rec.clientId != null ? rec.clientId : null; } catch (e) { return null; }
}
function chgLabel(sp, rec, k) {
  try {
    if (sp.label) return sp.label(rec || {}, k) || String(k);
    if (sp.kind === 'scalars') return 'Settings → ' + (CHG_SCALAR_SEC[k] || k);
    var r = rec || {};
    return r.name || r.label || r.text || r.title || String(k);
  } catch (e) { return String(k); }
}
function chgCfgLabel(sp, fields) {
  var sec = sp.sec || sp.path;
  // A setting no row of CHG_TRACK names (another step's) is named by its place in the book.
  if (sp.generic) return String(sp.path).replace(/\.\*$/, '');
  if (sec && typeof sec === 'object') {
    var first = fields.length ? String(fields[0].f).split(/[.[]/)[0] : '';
    sec = sec[first] || sec[''] || sp.path;
  }
  return /→/.test(sec) ? sec : 'Settings → ' + sec;
}

/* What one save moved that is not a change anybody made: the invoice and credit note counters move on by themselves with
   a document added or deleted (Next set in Settings is a change, and says so); the rows a statement import brought or
   took away are the import's one line. */
function chgPostRules(out) {
  var docs = {};
  out.forEach(function(e) { if (e.op !== 'change') docs[e.coll] = true; });
  var counter = { invoice: docs.invoices ? 'invNextNum' : null, cn: docs.creditNotes ? 'cnNextNum' : null };
  var imported = out.some(function(e) { return e.coll === 'bank.imports'; });
  return out.filter(function(e) {
    if (e.coll === 'settings' && counter[e.rid]) {
      e.fields = e.fields.filter(function(f) { return f.f !== counter[e.rid]; });
      if (!e.fields.length && !e.more) return false;
    }
    return !(imported && e.coll === 'bank.rows' && e.op !== 'change');
  });
}

/* ---------- the fields that moved ---------- */
function chgOmitted(k, sp) { return k.charAt(0) === '_' || CHG_OMIT[k] === 1 || !!(sp.omit && sp.omit.indexOf(k) >= 0); }
// A value as compared, without what is not compared.
function chgJson(v, sp) {
  return JSON.stringify(v, function(k, x) { return k && chgOmitted(k, sp) ? undefined : x; });
}
function chgNullish(v) { return v == null || (typeof v === 'number' && !isFinite(v)); }
function chgLeafSame(a, b) { return a === b || (chgNullish(a) && chgNullish(b)); }
function chgFieldsOf(a, b, sp) {
  var ctx = { sp: sp, out: [], more: 0 };
  chgWalk(a, b, '', 0, ctx);
  return ctx;
}
function chgPushField(ctx, f) { if (ctx.out.length < CHG_MAX_FIELDS) ctx.out.push(f); else ctx.more++; }
function chgWalk(a, b, path, depth, ctx) {
  var kb = b && typeof b === 'object' ? Object.keys(b) : [], ka = a && typeof a === 'object' ? Object.keys(a) : [];
  var inB = {};
  kb.forEach(function(k) { inB[k] = true; });
  kb.concat(ka.filter(function(k) { return !inB[k]; })).forEach(function(k) {
    if (chgOmitted(k, ctx.sp)) return;
    chgCompare(a ? a[k] : undefined, b ? b[k] : undefined, path ? path + '.' + k : k, k, depth, ctx);
  });
}
function chgCompare(va, vb, p, k, depth, ctx) {
  if (chgLeafSame(va, vb)) return;
  if (CHG_SECRET[k]) { if (chgJson(va, ctx.sp) !== chgJson(vb, ctx.sp)) chgPushField(ctx, { f: p, secret: true }); return; }
  var oa = va !== null && typeof va === 'object', ob = vb !== null && typeof vb === 'object';
  if (oa || ob) {
    // Only what is not compared moved (a line's billed share): nothing to say.
    if (chgJson(va, ctx.sp) === chgJson(vb, ctx.sp)) return;
    if (oa && ob && Array.isArray(va) === Array.isArray(vb) && depth + 1 < CHG_DEPTH) {
      if (Array.isArray(va)) chgWalkArr(va, vb, p, k, depth + 1, ctx);
      else chgWalk(va, vb, p, depth + 1, ctx);
      return;
    }
  }
  if (CHG_NOVALUE[k]) { chgPushField(ctx, { f: p, from: chgNullish(va) ? null : 'set', to: chgNullish(vb) ? null : 'set' }); return; }
  chgPushField(ctx, { f: p, from: chgVal(va, k), to: chgVal(vb, k) });
}
// A list inside a record: its count when that moved, then each element matched (by id where every one has one).
function chgWalkArr(va, vb, p, k, depth, ctx) {
  if (va.length !== vb.length) chgPushField(ctx, { f: p, from: chgVal(va, k), to: chgVal(vb, k) });
  var byId = va.length && vb.length && va.concat(vb).every(function(x) { return x && typeof x === 'object' && x.id != null; });
  if (byId) {
    var old = {};
    va.forEach(function(x) { old[String(x.id)] = x; });
    vb.forEach(function(x, i) { var o = old[String(x.id)]; if (o) chgCompare(o, x, p + '[' + i + ']', k, depth, ctx); });
    return;
  }
  for (var i = 0; i < Math.min(va.length, vb.length); i++) chgCompare(va[i], vb[i], p + '[' + i + ']', k, depth, ctx);
}
function chgVal(v, k) {
  if (chgNullish(v)) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return chgCut(v);
  if (Array.isArray(v)) { var noun = CHG_ARR_NOUN[k] || 'item'; return v.length + ' ' + noun + (v.length === 1 ? '' : 's'); }
  var t = v.reason || v.note || v.name || v.text;
  return typeof t === 'string' && t ? chgCut(t) : 'set';
}

/* ---------- into the book ---------- */
function chgAppend(entries) {
  if (!Array.isArray(S.changeLog)) S.changeLog = [];
  var log = S.changeLog;
  entries.forEach(function(e) { if (!chgCoalesce(log, e)) log.push(e); });
  _chgHealth.logged += entries.length;
  chgCap();
}
/* The same record, by the same person on the same device, within a minute of its last entry: one entry, from what it was
   before the first to what it is now (a figure typed a digit at a time saves at every key). A record added that minute
   is the add. The entry keeps its id and takes the latest time. */
function chgCoalesce(log, e) {
  if (e.op !== 'change' || e.rid == null || e.n) return false;
  for (var i = log.length - 1, looked = 0; i >= 0 && looked < 200; i--, looked++) {
    var p = log[i];
    if (e.at - p.at > CHG_MERGE_MS) return false;
    if (p.coll !== e.coll || String(p.rid) !== String(e.rid)) continue;
    if (p.by !== e.by || p.dev !== e.dev || p.n) return false;
    if (p.op === 'add') return true;
    if (p.op !== 'change') return false;
    e.fields.forEach(function(f) {
      var q = p.fields.find(function(x) { return x.f === f.f; });
      if (!q) { p.fields.push(f); return; }
      if (f.secret) q.secret = true; else q.to = f.to;
    });
    p.fields = p.fields.filter(function(x) { return x.secret || !chgLeafSame(x.from, x.to); });
    if (p.fields.length > CHG_MAX_FIELDS) { p.more = (p.more || 0) + p.fields.length - CHG_MAX_FIELDS; p.fields = p.fields.slice(0, CHG_MAX_FIELDS); }
    if (e.more) p.more = (p.more || 0) + e.more;
    p.label = e.label;
    if (e.cid != null) p.cid = e.cid;
    log.splice(i, 1);
    // Typed back to what it was: nothing changed.
    if (p.fields.length || p.more) { p.at = e.at; log.push(p); }
    return true;
  }
  return false;
}
// At most 120 days and 4,000 entries: the oldest go first, and are counted.
function chgCap() {
  var log = S.changeLog, cutoff = Date.now() - CHG_MAX_DAYS * 86400000;
  if (!log.length || (log.length <= CHG_MAX_ENTRIES && !log.some(function(e) { return !(e.at >= cutoff); }))) return;
  var keep = log.filter(function(e) { return e.at >= cutoff; });
  if (keep.length > CHG_MAX_ENTRIES) keep = keep.slice(keep.length - CHG_MAX_ENTRIES);
  var kept = {}, newest = 0, n = 0;
  keep.forEach(function(e) { kept[e.id] = true; });
  log.forEach(function(e) { if (!kept[e.id]) { n++; if (e.at > newest) newest = e.at; } });
  var d = S.changeLogDropped && typeof S.changeLogDropped === 'object' ? S.changeLogDropped : { n: 0, before: 0 };
  S.changeLogDropped = { n: (d.n || 0) + n, before: Math.max(d.before || 0, newest) };
  S.changeLog = keep;
}

/* ---------- for the gate, the devices, the merge ---------- */
/* The log, newest last; `filter` a function or {coll, rid, op, by (null: no ID), dev, since, until}. */
function chgEntries(filter) {
  var log = S && Array.isArray(S.changeLog) ? S.changeLog : [];
  if (!filter) return log.slice();
  if (typeof filter === 'function') return log.filter(filter);
  return log.filter(function(e) {
    if (filter.coll && e.coll !== filter.coll) return false;
    if (filter.rid != null && String(e.rid) !== String(filter.rid)) return false;
    if (filter.op && e.op !== filter.op) return false;
    if (Object.prototype.hasOwnProperty.call(filter, 'by') && (e.by == null ? null : String(e.by)) !== (filter.by == null ? null : String(filter.by))) return false;
    if (filter.dev && e.dev !== filter.dev) return false;
    if (filter.since && e.at < filter.since) return false;
    if (filter.until && e.at > filter.until) return false;
    return true;
  });
}
/* What a device is called: its name on the devices list, this device's own name, else a short id. */
function chgDeviceLabel(id) {
  if (!id) return '';
  var d = S ? chgFind(S.devices, id) : null;
  if (d && d.name) return d.name;
  try {
    if (typeof devId === 'function' && devId() === id) return (typeof devName === 'function' && devName()) || 'this device';
  } catch (e) { /* a name only */ }
  return 'device ' + String(id).slice(0, 6);
}
/* Who a user id is: the user's name, Someone with no ID (the guard was off). */
function chgUserName(id) {
  if (id == null || id === '') return 'Someone';
  var u = S ? chgFind(S.users, id) : null;
  return u && u.name ? u.name : 'An ID not on this book';
}
/* For Settings → storage diagnostics. */
function chgHealthText() {
  var log = S && Array.isArray(S.changeLog) ? S.changeLog : [], d = S && S.changeLogDropped;
  var oldest = log.length ? log.reduce(function(m, e) { return e.at < m ? e.at : m; }, log[0].at) : 0;
  return log.length + ' entr' + (log.length === 1 ? 'y' : 'ies') + (oldest ? ' since ' + formatTimestamp(oldest) : '') +
    (d && d.n ? ', ' + d.n + ' older dropped' : '') + ' · last compare ' + _chgHealth.lastMs.toFixed(1) + ' ms (slowest ' + _chgHealth.maxMs.toFixed(1) +
    ' ms over ' + _chgHealth.saves + ' save' + (_chgHealth.saves === 1 ? '' : 's') + '; starting point ' + _chgHealth.baselineMs.toFixed(1) + ' ms) · ' +
    (_chgHealth.errors ? _chgHealth.errors + ' error' + (_chgHealth.errors === 1 ? '' : 's') + ', the last ' + formatTimestamp(_chgHealth.lastErrorAt) + ': ' + _chgHealth.lastError + ' (the saves went on)' : 'no errors');
}

/* ---------- History (stats.js) ---------- */
var CHG_VERB = { add: 'added', change: 'changed', remove: 'removed' };
var CHG_FIELD_WORDS = { st: 'mark', invoiceState: 'state', qty: 'quantity', nosQty: 'pieces', ratePerKg: 'rate per kg', otCap: 'OT cap', otMult: 'OT multiplier' };
// Voided or cancelled, read off the fields a change set: said as such.
function chgAct(e) {
  if (e.coll === 'book') return 'replaced';
  if (e.op !== 'change') return CHG_VERB[e.op] || e.op;
  var set = function(f) { return e.fields.some(function(x) { return x.f === f && x.from == null && x.to != null; }); };
  if (set('voided') || set('voidedAt')) return 'voided';
  if (set('cancelledAt') || e.fields.some(function(x) { return (x.f === 'status' || x.f === 'invoiceState') && x.to === 'cancelled'; })) return 'cancelled';
  return 'changed';
}
var CHG_ACT_WORDS = { added: ['Added', 'ok'], changed: ['Changed', 'neutral'], removed: ['Removed', 'danger'], voided: ['Voided', 'danger'],
  cancelled: ['Cancelled', 'danger'], replaced: ['Replaced', 'warning'] };
function chgKindWord(e) { return CHG_ACT_WORDS[chgAct(e)] || CHG_ACT_WORDS.changed; }
function chgShow(v, f) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number' && /At$/.test(f) && v > 1e11) return formatTimestamp(v);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}
/* A field as a person reads it: a line's field with the line (none when the record has one line), a worker's mark by name. */
function chgFieldName(e, f, ctx) {
  var m = /^(items|lines)\[(\d+)\]\.(.+)$/.exec(f);
  if (m) {
    var rec = ctx && ctx.rec ? ctx.rec(e) : null, n = rec && Array.isArray(rec[m[1]]) ? rec[m[1]].length : 0;
    var field = CHG_FIELD_WORDS[m[3]] || m[3];
    return n === 1 ? field : 'line ' + (Number(m[2]) + 1) + ' ' + field;
  }
  m = /^marks\.([^.]+)(?:\.(.+))?$/.exec(f);
  if (m && e.coll === 'attendance') return (chgStaffName(m[1]) || 'worker ' + m[1]) + (m[2] ? ' ' + (CHG_FIELD_WORDS[m[2]] || m[2]) : '');
  return CHG_FIELD_WORDS[f] || f;
}
function chgFieldText(e, x, ctx) {
  var name = chgFieldName(e, x.f, ctx);
  return x.secret ? name + ' changed' : name + ' ' + chgShow(x.from, x.f) + ' → ' + chgShow(x.to, x.f);
}
/* "Asha changed invoice SEP/26-27/00941 · ALPHA FORGINGS · rate 13 → 13.2". `all`: every field (the CSV). */
function chgText(e, all, ctx) {
  var act = chgAct(e), noun = e.n || e.coll === 'book' ? '' : chgNounOf(e.coll, 1);
  var cfg = !e.n && e.coll !== 'book' && e.rid == null || e.coll === 'settings';
  var head = chgUserName(e.by) + ' ' + act + ' ' + (cfg || !noun ? '' : noun + ' ') + (e.label || '');
  // A void or a cancel says so in its verb: the stamp that made it one is not said again.
  var fs = (e.fields || []).filter(function(x) { return !((act === 'voided' && /^voided(At)?$/.test(x.f)) || (act === 'cancelled' && x.f === 'cancelledAt')); });
  var shown = all ? fs : fs.slice(0, 2);
  var rest = fs.length - shown.length + (e.more || 0);
  return head + shown.map(function(x) { return ' · ' + chgFieldText(e, x, ctx); }).join('') + (rest > 0 ? ' · +' + rest + ' more' : '');
}
/* The log's rows for History, and on the events already listed, who made them: an event and an entry on the same
   record within two seconds are one act, said once on the event's row ("by Asha"); the entry is still listed under
   Changes. Events say which record they are about with `cc` (the store) and `cr` (the record). */
function chgHistoryEvents(events, clientFilter) {
  var log = S && Array.isArray(S.changeLog) ? S.changeLog : [];
  if (!log.length) return;
  var idx = {};
  events.forEach(function(ev) { if (ev.cc && ev.cr != null) (idx[ev.cc + '\u0001' + ev.cr] = idx[ev.cc + '\u0001' + ev.cr] || []).push(ev); });
  var byId = { invoices: {}, incomingMaterial: {} };
  (S.invoices || []).forEach(function(r) { byId.invoices[r.id] = r; });
  (S.incomingMaterial || []).forEach(function(r) { byId.incomingMaterial[r.id] = r; });
  var ctx = { rec: function(e) { return byId[e.coll] ? byId[e.coll][e.rid] : null; } };
  log.forEach(function(e) {
    var folded = false;
    if (e.rid != null) (idx[e.coll + '\u0001' + e.rid] || []).forEach(function(ev) {
      if (Math.abs((ev.ts || 0) - e.at) > CHG_MATCH_MS) return;
      if (!Object.prototype.hasOwnProperty.call(ev, 'by')) { ev.by = e.by; ev.byDev = e.dev; }
      folded = true;
    });
    if (clientFilter && String(e.cid) !== String(clientFilter)) return;
    var rec = ctx.rec(e), jump = rec ? (e.coll === 'invoices' ? 'invoice' : 'challan') : null;
    events.push({ ts: e.at, type: 'change', kind: 'chg', act: chgAct(e), sourceId: jump ? e.rid : null, jump: jump, by: e.by, dev: e.dev, folded: folded, logId: e.id,
      text: chgText(e, false, ctx), full: chgText(e, true, ctx) });
  });
}
/* The Who filter's choices: the users, any other ID the log names, and No ID; none at all while nobody has an ID. */
function chgWhoOptions() {
  var users = S && Array.isArray(S.users) ? S.users : [], log = S && Array.isArray(S.changeLog) ? S.changeLog : [];
  var seen = {}, out = [];
  users.forEach(function(u) { if (u && u.id != null && !seen[u.id]) { seen[u.id] = true; out.push([String(u.id), u.name || String(u.id)]); } });
  log.forEach(function(e) { if (e.by != null && !seen[e.by]) { seen[e.by] = true; out.push([String(e.by), chgUserName(e.by)]); } });
  if (!out.length) return [];
  out.push(['_none', 'No ID']);
  return out;
}
function chgWhoMatch(ev, who) {
  if (!Object.prototype.hasOwnProperty.call(ev, 'by')) return false;
  return who === '_none' ? ev.by == null : ev.by != null && String(ev.by) === String(who);
}
function chgDroppedText() {
  var d = S && S.changeLogDropped;
  if (!d || !d.n) return '';
  return d.n.toLocaleString('en-IN') + ' older change' + (d.n === 1 ? ' was' : 's were') + ' dropped to keep the book small' +
    (d.before ? ' (the last of them from ' + formatTimestamp(d.before) + ')' : '') + '.';
}
