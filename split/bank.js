/* ===== BANK (Finance → Receivables, Payments, Bank) =====
 * The bank statement read in the app (owner, 26 Sep 2026: "We have the bank statement as well
 * right? There is no way to read it in the app yet"). Three jobs, all three asked for:
 *   - RECEIPTS: which invoices each customer credit pays, and what each customer still owes;
 *   - PAYMENTS: electricity paid becomes the month's bill, wages are set against Pay, suppliers
 *     against the stock bills;
 *   - STATEMENT: the ledger itself, every row with a category.
 *
 * The file is the bank's own export (Bank of Baroda OpTransactionHistoryUX5.xls), read as it is
 * by xls.js, or the same statement saved from Excel as .xlsx (xlsx.js; owner, 8 Oct 2026). Rows are kept in S.bank.rows, merged by id — a hash of the row's own fields, balance
 * included, so the same row in two overlapping statements is one row. The bank writes newest
 * first; `dayIdx` keeps its order inside a day, because two rows of one day sorted by amount
 * would publish the wrong closing balance (soma-internal's 20-Aug ingest did, by ₹1,20,000).
 *
 * A category is WORKED OUT from the narration each time it is read, then overridden by what the
 * operator set: for one row (`row.set`) or for everybody paid under that name (`S.bank.parties`).
 * Every SELF / TO SELF / TO CASH draw is wages (owner, 26 Sep 2026: "All kind of Self should also
 * count towards wages, unless stated otherwise") — a row set to another category says otherwise. They are the owner's
 * drawings too (owner, 6 Oct 2026): as cost, a pay week's cash is wages up to its payout, the rest drawings (bankCostByMonth).
 *
 * Owned by soma-internal like stock: this is a view and an input. Export hands the whole record
 * over for the compile.
 */

var BANK_CATS = [
  ['receipt', 'Receipt'], ['wages', 'Wages'], ['power', 'Electricity'], ['supplier', 'Supplier'],
  ['gst', 'GST'], ['tax', 'Income tax'], ['charges', 'Bank charges'], ['reversal', 'Returned'], ['other', 'Other']
];
var BANK_CAT_TONE = { receipt: 'ok', wages: 'info', power: 'warning', supplier: 'neutral', gst: 'neutral', tax: 'neutral', charges: 'neutral', reversal: 'neutral', other: 'neutral' };
function bankCatLabel(k) { var c = BANK_CATS.find(function(x) { return x[0] === k; }); return c ? c[1] : k; }

var _bankFilter = { cat: '', q: '' };
var _bankSortFrom = null;   // the Finance tab a Sort was pressed on, returned to once the payee is set
var _bankEdit = null;          // the statement row being categorised
var _bankOpen = null;          // the client whose receipts are open
var _bankChange = null;        // a placed receipt whose client is being changed

function bankData() {
  if (!S.bank || typeof S.bank !== 'object' || Array.isArray(S.bank)) S.bank = {};
  var b = S.bank;
  if (!Array.isArray(b.rows)) b.rows = [];
  if (!Array.isArray(b.imports)) b.imports = [];
  if (!b.parties || typeof b.parties !== 'object') b.parties = {};
  if (!b.opening || typeof b.opening !== 'object') b.opening = {};
  if (!b.gstNotes || typeof b.gstNotes !== 'object') b.gstNotes = {};
  // A returned cheque's link to the deposit it undoes: { reversalRowId: depositRowId | null (not a bounce) }.
  if (!b.bounces || typeof b.bounces !== 'object' || Array.isArray(b.bounces)) b.bounces = {};
  // Cheques received and not yet seen on the statement (TM3b): their own record, never a statement row.
  if (!Array.isArray(b.cheques)) b.cheques = [];
  return b;
}

/* ---------- Reading the export ---------- */
function bankAmount(v) {
  if (typeof v === 'number') return gstRound(v);
  var s = String(v == null ? '' : v).replace(/,/g, '').trim();
  return s ? gstRound(parseFloat(s) || 0) : 0;
}
/* " 3,58,745.82Cr" → 358745.82; a Dr balance is an overdraft and reads negative. */
function bankBalance(v) {
  if (typeof v === 'number') return gstRound(v);
  var m = String(v || '').replace(/,/g, '').trim().match(/^(-?[0-9.]+)\s*(Cr|Dr)?$/i);
  if (!m) return null;
  var n = parseFloat(m[1]);
  return gstRound(m[2] && m[2].toLowerCase() === 'dr' ? -n : n);
}
/* A TRAN DATE cell: the bank writes dd/mm/yyyy as text, but a statement opened and saved again in a
   spreadsheet carries Excel's day numbers (46204 is 1 Jul 2026), and those read as no date at all, so the
   whole import came to nothing. Both are read; a day the calendar lacks, or anything else, is not a date. */
function bankIso(v) {
  if (typeof v === 'number') return v > 20000 && v < 80000 ? isoAddDays('1899-12-30', Math.floor(v)) : '';
  var m = String(v || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? isoFromDmy(m[1], m[2], m[3]) || '' : '';
}

/* The sheet as the bank lays it out: a header row carrying TRAN DATE, columns found by their
   labels (never by position — the export pads with empty merged columns), then one row per
   transaction, newest first. Returned oldest first, `dayIdx` in the bank's own order. */
function bankParseSheet(rows) {
  var h = -1, col = {};
  for (var r = 0; r < rows.length && h < 0; r++) {
    (rows[r] || []).forEach(function(v, c) { if (String(v).trim().toUpperCase() === 'TRAN DATE') h = r; });
  }
  if (h < 0) throw new Error('No TRAN DATE column: this does not look like a Bank of Baroda statement');
  var want = { 'TRAN DATE': 'date', 'VALUE DATE': 'valueDate', 'NARRATION': 'narration', 'CHQ.NO.': 'chq', 'WITHDRAWAL(DR)': 'dr', 'DEPOSIT(CR)': 'cr', 'BALANCE(INR)': 'balance' };
  rows[h].forEach(function(v, c) { var k = want[String(v).trim().toUpperCase()]; if (k) col[k] = c; });
  ['date', 'narration', 'dr', 'cr', 'balance'].forEach(function(k) { if (col[k] == null) throw new Error('The statement has no ' + k + ' column'); });
  var account = '';
  rows.slice(0, h).forEach(function(row) {
    (row || []).forEach(function(v, c) {
      if (/^Account No/i.test(String(v).trim())) for (var k = c + 1; k < row.length && !account; k++) if (String(row[k] || '').trim()) account = String(row[k]).trim();
    });
  });
  var out = [];
  for (r = h + 1; r < rows.length; r++) {
    var row = rows[r] || [], date = bankIso(row[col.date]);
    if (!date) continue;
    var dr = bankAmount(row[col.dr]), cr = bankAmount(row[col.cr]), bal = bankBalance(row[col.balance]);
    // A page's foot is not a transaction: the bank prints the time the statement was made under TRAN DATE and "Page 2 of"
    // under BALANCE, with no amount (owner, 8 Oct 2026: a two-page statement stopped at "Row 50: … cannot be read").
    if (!dr && !cr && bal == null) continue;
    if (bal == null) throw new Error('Row ' + (r + 1) + ': the balance "' + row[col.balance] + '" cannot be read');
    out.push({ date: date, valueDate: bankIso(row[col.valueDate]) || date, narration: String(row[col.narration] || '').trim(),
      chq: String(row[col.chq] == null ? '' : row[col.chq]).trim(), dr: dr, cr: cr, balance: bal });
  }
  // A row with no date is a footer or a note and is passed over; a statement where every row was passed over
  // said "0 rows added" and nothing else. It says what the first date cell held instead.
  if (!out.length) {
    var first = null;
    for (r = h + 1; r < rows.length && first == null; r++) { var d0 = (rows[r] || [])[col.date]; if (d0 != null && String(d0).trim()) first = String(d0).trim(); }
    throw new Error(first == null ? 'The statement has no transactions under TRAN DATE' : 'No transaction could be read: the first TRAN DATE reads "' + first + '", which is not a date');
  }
  out.reverse();
  var day = '', n = 0;
  out.forEach(function(x) { if (x.date !== day) { day = x.date; n = 0; } x.dayIdx = n++; });
  return { account: account, rows: out };
}

function bankRowId(x) {
  var s = [x.date, x.narration, x.chq, x.dr.toFixed(2), x.cr.toFixed(2), x.balance.toFixed(2)].join('|'), h1 = 5381, h2 = 52711;
  for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 = (h1 * 33) ^ c; h2 = (h2 * 31) ^ c; }
  return 'BK' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/* Merge by id, never overwrite. A row already held keeps everything the operator set; it takes
   the new file's `dayIdx`, because the later file holds the whole of that day. */
function bankImport(parsed, fileName) {
  var b = bankData(), have = {}, added = 0, same = 0;
  b.rows.forEach(function(x) { have[x.id] = x; });
  var impId = 'BI-' + Date.now().toString(36);
  parsed.rows.forEach(function(x) {
    var id = bankRowId(x);
    if (have[id]) { have[id].dayIdx = x.dayIdx; same++; return; }
    var row = { id: id, date: x.date, valueDate: x.valueDate, narration: x.narration, chq: x.chq, dr: x.dr, cr: x.cr, balance: x.balance, dayIdx: x.dayIdx, importId: impId };
    b.rows.push(row); have[id] = row; added++;
  });
  if (parsed.account && !b.account) b.account = parsed.account;
  var rs = parsed.rows;
  b.imports.push({ id: impId, at: Date.now(), file: fileName || '', account: parsed.account || '', from: rs.length ? rs[0].date : '',
    to: rs.length ? rs[rs.length - 1].date : '', rows: rs.length, added: added, closing: rs.length ? rs[rs.length - 1].balance : null });
  return { added: added, same: same, rows: rs.length };
}

function bankRows() {
  return bankData().rows.slice().sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.dayIdx || 0) - (b.dayIdx || 0); });
}

/* Every row's balance must be the one before it, less what went out, plus what came in. A break
   is a row missing between two statements, or a day the file ordered differently. */
function bankContinuity(rows) {
  var breaks = [];
  for (var i = 1; i < rows.length; i++) {
    var exp = gstRound(rows[i - 1].balance - rows[i].dr + rows[i].cr);
    if (Math.abs(exp - rows[i].balance) > 0.005) breaks.push({ row: rows[i], after: rows[i - 1], expected: exp });
  }
  return breaks;
}

/* ---------- What a row is ---------- */
function bankPartyOf(narr) {
  var n = String(narr || '').trim(), m;
  if ((m = n.match(/^(?:NEFT|RTGS|IMPS)-[A-Z0-9]+-(.+)$/i))) {
    var parts = m[1].split('-');
    // The payee's bank rides on the end of a transfer out: "…-STATE BANK OF I", "…-CANARA BANK (CAB".
    while (parts.length > 1 && /BANK|\bBAN$|\bOF\b|\(|^\s*(STATE|UNION|CANARA|INDIAN|CENTRAL|PUNJAB|AXIS|HDFC|ICICI)\b/i.test(parts[parts.length - 1])) parts.pop();
    return parts.join('-').trim();
  }
  if ((m = n.match(/^(.+?)-MICR INWARD CLG/i))) return m[1].trim();
  if (/^BY INST\b/i.test(n)) return '';
  if ((m = n.match(/^(?:TO\s+(?:TR\s+TO\s+)?)?(.+?)-JAMSHE/i))) return m[1].trim();
  return '';
}
function bankKey(s) { return relayKey(s); }
/* A cheque deposit names nobody: its "Cheque deposited" is every cheque's, never a payee to remember. */
function bankIsChequeDeposit(row) { return /^BY INST\b/i.test(String((row && row.narration) || '')); }
/* A row's name on screen: its payee, else its narration; a cheque deposit by its number, which says which one it is (the
   statement and search draw it so, and their lines need not carry the number again). */
function bankRowTitle(v) {
  var r = v.row, inst = bankIsChequeDeposit(r) ? bankInstrument(r) : '';
  return /^\d{4,}$/.test(inst) ? 'Deposit of cheque ' + inst : (v.party || r.narration || '');
}

function bankMatchClient(party) {
  var pk = bankKey(party);
  if (pk.length < 4) return null;
  var hits = (S.clients || []).filter(function(c) {
    var ck = bankKey(c.name);
    if (ck.length < 4) return false;
    if (pk.indexOf(ck) === 0 || ck.indexOf(pk) === 0) return true;
    var n = 0;
    while (n < pk.length && n < ck.length && pk[n] === ck[n]) n++;
    return n >= 8;
  });
  return hits.length === 1 ? hits[0].id : null;
}
function bankSupplierKeys() {
  var keys = {};
  (stockData().entries || []).forEach(function(e) { if (e.supplier) keys[bankKey(e.supplier)] = e.supplier; });
  return keys;
}
/* The one reading of "this payment went to that supplier", wherever a payment is set against the stock bills
   (the guess, Payments, the To-do's supplierNoBill, a stock line's bank figure). They matched four ways, by
   prefix in some and by substring in others, so a payment could be a supplier's on one screen and nobody's on
   the next. `written` is the payee's key, or the narration's where the payee is too short to read: the
   supplier's name anywhere in it (SHREE BALAJI TRADERS for Balaji Traders), or it cut short at the start of the
   supplier's name (the bank truncates). Four letters at least on either side, or every name would match. */
function bankSupplierWritten(v) {
  var pk = bankKey(v.party || '');
  return pk.length >= 4 ? pk : bankKey((v.row && v.row.narration) || '');
}
function bankSupplierIs(written, supplierKey) {
  return !!written && !!supplierKey && supplierKey.length >= 4 &&
    (written.indexOf(supplierKey) >= 0 || (written.length >= 4 && supplierKey.indexOf(written) === 0));
}
/* The supplier a payee names, of the stock bills' suppliers (keys: key → name); the longest name that fits wins. */
function bankMatchSupplier(party, keys) {
  var pk = bankKey(party);
  if (pk.length < 4) return '';
  var hit = Object.keys(keys).filter(function(k) { return bankSupplierIs(pk, k); }).sort(function(a, b) { return b.length - a.length; })[0];
  return hit ? keys[hit] : '';
}

/* A salary transfer names the hand as the bank has him ("BHANU PRATAP SHARMA"), which is rarely
   how the roster writes him. The relay's matcher already knows the shop's ways: either side of a
   dash, a first name nobody else has, the spelling folds (SHARAT for Sarat). A firm is never a
   person, so a payee reading like one is left alone. */
var BANK_FIRM_WORDS = /\b(TRADERS?|INDUSTRIES|INDUSTRY|LTD|LIMITED|PVT|PRIVATE|ENTERPRISES?|COMPANY|CO|BROTHERS|MANAGEMEN\w*|NIGAM|WORKS|AGENC\w*|STORES?|CHEMICALS?|ENGINEERS?|ENGINEERING|AUTO|SONS)\b/i;
function bankMatchWorker(party, idx) {
  if (!party || BANK_FIRM_WORDS.test(party)) return null;
  var m = relayMatchName(party.split(/\s+/).filter(Boolean), idx, false);
  return m && m.w ? m : null;
}

/* The category as the narration reads, before anybody has said otherwise. */
function bankGuess(row, ctx) {
  var n = String(row.narration || '').trim(), party = bankPartyOf(n), out = { cat: 'other', party: party, auto: true };
  if (/^REJECT:/i.test(n)) out.cat = 'reversal';
  else if (/^(TO\s+)?SELF$|^(TO\s+)?CASH$/i.test(n)) { out.cat = 'wages'; out.cash = true; out.party = 'Cash drawn'; }
  else if (/^EBANK:.*GST$/i.test(n)) out.cat = 'gst';
  else if (/CBDT/i.test(n)) out.cat = 'tax';
  else if (/^(SMS\s+)?CHARGES\b|CHEQUE BOOK CHARGES|^CHARGES FOR/i.test(n)) out.cat = 'charges';
  else if (/BIJLI|JBVNL/i.test(n)) { out.cat = 'power'; out.party = 'JBVNL'; }
  else if (row.cr > 0) { out.cat = 'receipt'; out.clientId = bankMatchClient(party); if (/^BY INST\b/i.test(n)) out.party = 'Cheque deposited'; }
  else if (party) {
    if ((out.supplier = bankMatchSupplier(party, ctx.suppliers))) out.cat = 'supplier';
    else {
      var w = bankMatchWorker(party, ctx.roster);
      if (w) { out.cat = 'wages'; out.staffId = w.w.id; out.guess = !w.sure; }
    }
  }
  return out;
}

/* A payee rule speaks for one direction: money out (kept under the payee's key) or money in (under key|in).
   One rule for both let a payment set to Other turn the same party's receipts into Other, and placing a
   receipt wrote over the Supplier rule its payments had. */
var BANK_RULE_IN = '|in';
function bankRuleKey(key, row) { return row.cr > 0 ? key + BANK_RULE_IN : key; }
/* Rules written before they carried a direction applied both ways. Each is given the direction it was made
   from, once: a receipt rule, or one for a payee that has only ever paid in, came from money in and moves to
   its own key; any other came from a payment. Stamped rather than inferred at each read, so a payee's first
   payment out later cannot turn an old money-in rule round. */
function bankRulesDirected(b, ctx) {
  var legacy = Object.keys(b.parties).filter(function(k) { var r = b.parties[k]; return r && !r.dir && k.slice(-BANK_RULE_IN.length) !== BANK_RULE_IN; });
  if (!legacy.length) return;
  var paysOut = {};
  b.rows.forEach(function(row) { if (row.dr > 0) paysOut[bankKey(bankGuess(row, ctx).party)] = true; });
  legacy.forEach(function(k) {
    var r = b.parties[k];
    // A category that is only ever money out (wages, electricity, a supplier, GST, tax, charges) or a hand's wage rule
    // stays out whatever this statement holds: read off the statement alone, a wage rule for a hand with no row on it was
    // turned into a money-in rule (the QA sweep's review, 30 Sep 2026). A receipt is money in; "other" and the rest
    // follow the statement, as before.
    var outOnly = r.staffId != null || ['wages', 'power', 'supplier', 'gst', 'tax', 'charges'].indexOf(r.cat) >= 0;
    if (outOnly || (r.cat !== 'receipt' && paysOut[k])) { r.dir = 'out'; return; }
    if (!b.parties[k + BANK_RULE_IN]) b.parties[k + BANK_RULE_IN] = Object.assign({}, r, { dir: 'in' });
    delete b.parties[k];
  });
}

/* Worked out, then what the operator set for this payee, then for this row. */
function bankClassify(rows) {
  var b = bankData(), ctx = { suppliers: bankSupplierKeys(), roster: relayRosterIndex(S.staff || []) };
  bankRulesDirected(b, ctx);
  var out = (rows || bankRows()).map(function(row) {
    var v = bankGuess(row, ctx), key = bankKey(v.party);
    // A payee rule needs a payee: a cash draw and a cheque deposit name nobody. It is read for the row's own
    // direction only; the row's own setting can still say otherwise.
    var rule = key && !v.cash && !bankIsChequeDeposit(row) ? b.parties[bankRuleKey(key, row)] || null : null;
    [rule, row.set].forEach(function(o) {
      if (!o) return;
      if (o.cat) { v.cat = o.cat; v.auto = false; }
      // A pick set back to "no client" is a decision too: it unplaces, rather than falling back to the guess.
      if ('clientId' in o) v.clientId = o.clientId == null ? null : o.clientId;
      // So is "Nobody on the roster": it clears a guessed hand rather than falling back to the guess.
      if ('staffId' in o) { v.staffId = o.staffId == null ? null : o.staffId; v.guess = false; }
      if ('notCost' in o) v.notCost = !!o.notCost;
    });
    v.row = row; v.key = key;
    return v;
  });
  // A cheque received places its deposit before the returned cheques are linked, so a deposit that comes back keeps its client.
  return bankLinkBounces(bankPlaceCheques(out));
}

/* ---------- Returned cheques ----------
   A bounced cheque is money that came in and went back out. Left alone, the deposit reads as the client
   paying and the debit as a cost-free "Returned" row: the client looks paid, owed90 stays quiet and the
   forecast counts money that never stayed. So a returned-cheque debit is linked to the deposit it undoes:
   - a debit and a credit of the same amount and narration on one day (a posting and its own reversal, as
     REJECT:001290 on the real statement) cancel each other and link to nothing;
   - a debit that names a deposit's cheque number, dated within 60 days after it, is that deposit: linked;
   - otherwise a deposit of exactly that amount in the 15 days before is OFFERED, never applied;
   - what the owner sets (S.bank.bounces) wins: a deposit id, or null for "not a bounce".
   A linked deposit is no longer a receipt (cat 'reversal', its client kept for the cheque series), so every
   reading of receipts — Receivables, owed90, days to pay, the forecast, unplaced counts — sees it unpaid. */
var BANK_BOUNCE_DAYS = 15, BANK_BOUNCE_CHQ_DAYS = 60;
function bankChequeNums(narr) {
  return (String(narr || '').match(/\d{5,}/g) || []).map(function(n) { return n.replace(/^0+/, ''); }).filter(Boolean);
}
function bankLinkBounces(list) {
  if (list.length < 2) return list;
  var set = bankData().bounces, byId = {};
  list.forEach(function(v) { byId[v.row.id] = v; });
  // Postings and their own reversals.
  list.forEach(function(v) {
    if (v.cat !== 'reversal' || v.selfPair) return;
    var twin = list.find(function(w) { return w !== v && !w.selfPair && w.row.date === v.row.date && w.row.narration === v.row.narration &&
      (v.row.dr > 0 ? Math.abs(w.row.cr - v.row.dr) < 0.005 : Math.abs(w.row.dr - v.row.cr) < 0.005); });
    if (twin) { v.selfPair = true; twin.selfPair = true; }
  });
  var taken = {}, isDeposit = function(w) { return w.row.cr > 0 && !w.selfPair && w.cat !== 'reversal'; };
  var link = function(rev, dep, how) {
    taken[dep.row.id] = true;
    rev.bounceOf = { id: dep.row.id, how: how, date: dep.row.date, amount: dep.row.cr, clientId: dep.clientId, chq: bankInstrument(dep.row) };
    dep.bounced = { id: rev.row.id, date: rev.row.date, how: how };
    // What the deposit is in its own right, for its edit form: saving it as "Returned" dropped its client and
    // made it no deposit, so the link could never form again.
    dep.ownCat = dep.cat;
    dep.cat = 'reversal';
  };
  var revs = list.filter(function(v) { return v.cat === 'reversal' && v.row.dr > 0 && !v.selfPair; });
  // What the owner set first, then cheque numbers, then offers by amount.
  revs.forEach(function(r) {
    if (!(r.row.id in set)) return;
    r.bounceSet = true;
    var d = set[r.row.id] == null ? null : byId[set[r.row.id]];
    if (d && isDeposit(d) && !taken[d.row.id]) link(r, d, 'set');
  });
  revs.forEach(function(r) {
    if (r.bounceSet) return;
    var nums = bankChequeNums(r.row.narration);
    if (!nums.length) return;
    var hit = list.filter(function(d) {
      var inst = String(bankInstrument(d.row) || '').replace(/^0+/, '');
      return isDeposit(d) && !taken[d.row.id] && inst && nums.indexOf(inst) >= 0 && d.row.date <= r.row.date && isoDaysBetween(d.row.date, r.row.date) <= BANK_BOUNCE_CHQ_DAYS;
    }).pop();
    if (hit) link(r, hit, 'cheque');
  });
  revs.forEach(function(r) {
    if (r.bounceSet || r.bounceOf) return;
    r.bounceOffers = list.filter(function(d) {
      return isDeposit(d) && !taken[d.row.id] && Math.abs(d.row.cr - r.row.dr) < 0.005 && d.row.date <= r.row.date && isoDaysBetween(d.row.date, r.row.date) <= BANK_BOUNCE_DAYS;
    }).map(function(d) { return d.row.id; });
  });
  return list;
}
function bankReturnedCheques(cls) {
  return (cls || bankClassify()).filter(function(v) { return v.cat === 'reversal' && v.row.dr > 0 && !v.selfPair && !v.bounceOf; });
}
function _bankBouncesHtml(cls) {
  var list = bankReturnedCheques(cls);
  // Linked ones are shown from their reversal too, so a wrong link can be undone where it was made.
  var linked = cls.filter(function(v) { return v.bounceOf; });
  if (!list.length && !linked.length) return '';
  var byId = {}; cls.forEach(function(v) { byId[v.row.id] = v; });
  var cname = function(id) { var c = (S.clients || []).find(function(x) { return String(x.id) === String(id); }); return c ? c.name : 'no client'; };
  var depLine = function(d) { return formatCurrency(d.row.cr) + ' deposited ' + formatDate(d.row.date) + (bankInstrument(d.row) ? ' · chq ' + bankInstrument(d.row) : '') + ' · ' + cname(d.clientId); };
  var h = '<div class="inv-panel inv-panel-flush" id="bankBounces"><div class="inv-panel-head"><span class="inv-panel-title">Returned cheques</span><span class="inv-panel-count">' + (list.length + linked.length) + '</span></div>' +
    '<div class="inv-panel-body inv-note">A cheque that came back is not a receipt: linked to its deposit, the client owes it again. A debit naming the deposit\'s cheque number links itself; a same-amount deposit in the 15 days before is only offered.</div>';
  linked.forEach(function(v) {
    var b = v.bounceOf;
    h += '<div class="inv-row inv-row-2" data-bounce="' + escHtml(v.row.id) + '"><span class="inv-row-main"><span class="inv-row-title"><span class="inv-dot inv-dot-warning">Returned ' + escHtml(formatDate(v.row.date)) + '</span></span>' +
      '<span class="inv-row-meta">' + escHtml(depLine(byId[b.id])) + ' · ' + (b.how === 'cheque' ? 'by cheque number' : 'linked by you') + '</span></span>' +
      '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(v.row.dr) + '</span><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankBounce" data-rev="' + escHtml(v.row.id) + '" data-dep="">Not a bounce</button></span></div>';
  });
  list.forEach(function(v) {
    var marked = v.bounceSet;
    h += '<div class="inv-row inv-row-2" data-bounce="' + escHtml(v.row.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(v.row.narration) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(formatDate(v.row.date)) + ' · ' + (marked ? 'marked not a bounce' : (v.bounceOffers || []).length ? 'which deposit came back?' : 'no deposit of this amount in the 15 days before') + '</span></span>' +
      '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(v.row.dr) + '</span>' +
      (marked ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankBounceClear" data-rev="' + escHtml(v.row.id) + '">Undo</button>'
        : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankBounce" data-rev="' + escHtml(v.row.id) + '" data-dep="">Not a bounce</button>') + '</span></div>';
    if (!marked) (v.bounceOffers || []).forEach(function(id) {
      var d = byId[id];
      h += '<div class="inv-row" data-bounce-offer="' + escHtml(id) + '"><span class="inv-row-main inv-row-meta">' + escHtml(depLine(d)) + '</span>' +
        '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankBounce" data-rev="' + escHtml(v.row.id) + '" data-dep="' + escHtml(id) + '">Link</button></span></div>';
    });
  });
  return h + '</div>';
}
/* Finance's edits are P1 changes (docs/GUARD.md: payments): a receipt placed on a client, what a client owed at the start, a
   returned cheque linked, a statement row sorted, a bill made from a payment, a month's GST note. They asked nothing, so an
   ID without that permission placed receipts, and anyone at an owner's unlocked device past the re-ask window (the QA chain,
   2 Oct 2026). With the guard off, or inside the window, they go through as before; a PIN asked for runs the edit once given. */
function bankGate(what, again) { return typeof grdGate !== 'function' || grdGate('payments', what, again); }

function bankSetBounce(revId, depId) {
  if (!bankGate('link a returned cheque', function() { bankSetBounce(revId, depId); })) return;
  bankData().bounces[revId] = depId || null;
  saveState();
  renderFinance();
}
function bankClearBounce(revId) {
  if (!bankGate('undo a returned cheque', function() { bankClearBounce(revId); })) return;
  delete bankData().bounces[revId];
  saveState();
  renderFinance();
}

/* ---------- Cheques received, not yet in the bank (the tab map, TM3b) ----------
   A cheque from a client counts as paid the day it is received, before it reaches the bank. It is recorded then
   (S.bank.cheques, its own record: never a statement row) and, until its deposit is found, it is a receipt dated that day,
   placed by the receipts' own rules (bankReceivables: exact to the rupee, else oldest first, never against an invoice raised
   after it). So what the client owes falls at once, and everything that reads Receivables follows: the ageing, owed90, the
   statement of account, the forecast, an invoice's payment.
   Its deposit is worked out on every read, as a returned cheque's link is: a credit on the statement naming the cheque's
   number, from three days before it was received to sixty after, is its deposit, whatever its amount (a slip in the amount
   typed must not leave the cheque counting beside its deposit; the difference is said). From then the deposit counts and
   the cheque does not, so nothing is counted twice, and the deposit is placed on the cheque's client unless the row was set
   by hand. The owner's own word wins: `deposit` a row's id, or null for "not this one". A credit of the same amount with no
   number, in the fifteen days after it came, is only offered. A deposit that comes back is a returned cheque (the bounce
   logic, as ever) and the cheque reads Returned. A cheque is voided with a reason, never deleted. */
var BANK_CHQ_BEFORE = 3, BANK_CHQ_AFTER = 60, BANK_CHQ_OFFER = 15;
function bankCheques() { return bankData().cheques; }
function bankChequeKey(n) { return String(n == null ? '' : n).replace(/\D/g, '').replace(/^0+/, ''); }
/* Each cheque and what became of it: { ch, dep (its deposit, a classified row), how ('set' | 'number'), offers (row ids), diff
   (the deposit less the amount typed), status ('held' | 'deposited' | 'returned' | 'void'), days (since it came, to today) }.
   A deposit is one cheque's. */
function bankChequeLinks(cls) {
  var list = (bankCheques() || []).slice().sort(function(a, b) {
    return (a.receivedOn || '') < (b.receivedOn || '') ? -1 : (a.receivedOn || '') > (b.receivedOn || '') ? 1 : (a.at || 0) - (b.at || 0);
  });
  if (!list.length) return [];
  cls = cls || bankClassify();
  var byId = {}, today = localDateStr(), taken = {};
  // Money in: a deposit later returned is still a cheque's deposit; a posting and its own reversal is not.
  var credits = cls.filter(function(v) { return v.row.cr > 0 && !v.selfPair && (v.cat !== 'reversal' || v.bounced); });
  credits.forEach(function(v) { byId[v.row.id] = v; });
  var inWin = function(v, ch, after) { return v.row.date >= isoAddDays(ch.receivedOn, -BANK_CHQ_BEFORE) && v.row.date <= isoAddDays(ch.receivedOn, after); };
  var out = list.map(function(ch) {
    var o = { ch: ch, dep: null, how: null, offers: [], diff: 0, status: ch.voidedAt ? 'void' : 'held', days: ch.receivedOn ? Math.max(0, isoDaysBetween(ch.receivedOn, today)) : 0 };
    if (!ch.voidedAt && ch.deposit && byId[ch.deposit] && !taken[ch.deposit]) { o.dep = byId[ch.deposit]; o.how = 'set'; taken[ch.deposit] = true; }
    return o;
  });
  // Then by the cheque's own number: the earliest credit naming it in the window.
  out.forEach(function(o) {
    var ch = o.ch, key = bankChequeKey(ch.number);
    if (ch.voidedAt || o.dep || ch.deposit === null || !key || !ch.receivedOn) return;
    var hit = credits.find(function(v) { return !taken[v.row.id] && bankChequeKey(bankInstrument(v.row)) === key && inWin(v, ch, BANK_CHQ_AFTER); });
    if (hit) { o.dep = hit; o.how = 'number'; taken[hit.row.id] = true; }
  });
  // Offers, never applied: the same amount, carrying no cheque number, not placed on another client.
  out.forEach(function(o) {
    var ch = o.ch, amt = Number(ch.amount) || 0;
    if (ch.voidedAt || o.dep || !ch.receivedOn) return;
    o.offers = credits.filter(function(v) {
      return !taken[v.row.id] && v.cat === 'receipt' && (v.clientId == null || String(v.clientId) === String(ch.clientId)) && Math.abs(v.row.cr - amt) < 0.005 &&
        inWin(v, ch, BANK_CHQ_OFFER) && !/^\d{4,}$/.test(String(bankInstrument(v.row) || '').trim());
    }).map(function(v) { return v.row.id; });
  });
  out.forEach(function(o) {
    if (!o.dep) return;
    o.status = o.dep.bounced ? 'returned' : 'deposited';
    o.diff = gstRound(o.dep.row.cr - (Number(o.ch.amount) || 0));
  });
  return out;
}
/* A deposit a cheque names is placed on the cheque's client, unless the row itself was set by hand (a client, or a category
   other than a receipt). Run inside bankClassify, before the returned cheques are linked. */
function bankPlaceCheques(list) {
  if (list.length < 2 || !(bankData().cheques || []).length) return list;
  bankChequeLinks(list).forEach(function(o) {
    if (!o.dep || o.ch.voidedAt) return;
    var set = o.dep.row.set;
    o.dep.cheque = o.ch.id;
    if (set && ('clientId' in set || (set.cat && set.cat !== 'receipt'))) return;
    o.dep.cat = 'receipt'; o.dep.clientId = o.ch.clientId; o.dep.auto = false;
  });
  return list;
}
/* The cheques still in hand, for every screen that says so: how many, how much, the oldest in days. */
function bankChequesHeld(cls) {
  var held = bankChequeLinks(cls).filter(function(o) { return o.status === 'held'; });
  return { n: held.length, amount: gstRound(held.reduce(function(t, o) { return t + (Number(o.ch.amount) || 0); }, 0)),
    oldest: held.reduce(function(m, o) { return Math.max(m, o.days); }, 0), list: held };
}
/* How long a cheque may sit in hand: three days amber, seven red (the To-do's chequeHeld). */
function bankChequeTone(days) { return days >= 7 ? 'danger' : days >= 3 ? 'warning' : 'info'; }
function bankChequeAge(days) { return days ? todoPlural(days, 'day') : 'today'; }
/* The next working day after a day (a Sunday is not one): when a cheque in hand is expected in the bank (the forecast). */
function bankChequeNextWorkday(iso) {
  var d = isoAddDays(iso, 1);
  if (attParseIso(d).getDay() === 0) d = isoAddDays(d, 1);
  return d;
}
function bankChequeClient(ch) { return (S.clients || []).find(function(x) { return String(x.id) === String(ch.clientId); }) || null; }

/* ---------- Cheques on screen ---------- */
function _bankChequeRowHtml(o, byId) {
  var ch = o.ch, c = bankChequeClient(ch);
  var st = o.status === 'held' ? { tone: bankChequeTone(o.days), word: 'In hand · ' + bankChequeAge(o.days) }
    : o.status === 'returned' ? { tone: 'danger', word: 'Returned' }
    : Math.abs(o.diff) >= 0.005 ? { tone: 'warning', word: 'In the bank: ' + formatCurrency(o.dep.row.cr) }
    : { tone: 'ok', word: 'In the bank ' + stockShortDate(o.dep.row.date) };
  var meta = escHtml('received ' + stockShortDate(ch.receivedOn));
  var h = '<div class="inv-row inv-row-2" data-cheque="' + escHtml(ch.id) + '"><button class="inv-row-main" data-action="invChequeOpen" data-id="' + escHtml(ch.id) + '">' +
    '<span class="inv-row-title">' + escHtml(c ? c.name : 'A client no longer in the book') + '</span>' +
    '<span class="inv-row-meta"><span class="inv-id">' + escHtml(ch.number) + '</span> · ' + meta + '</span></button>' +
    uiRowEndHtml(escHtml(formatCurrency(ch.amount)), st) + '</div>';
  // An offer is a line of its own under the cheque, its one button at the row's end.
  if (o.offers.length) {
    h += '<div class="inv-row-children">' + o.offers.map(function(id) {
      var v = byId[id];
      if (!v) return '';
      return '<div class="inv-row" data-cheque-offer="' + escHtml(id) + '"><span class="inv-row-main inv-row-meta">' + escHtml(formatCurrency(v.row.cr) + ' came in ' + formatDate(v.row.date) + ', no number') + '</span>' +
        '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invChequeLink" data-id="' + escHtml(ch.id) + '" data-row="' + escHtml(id) + '">Link</button></span></div>';
    }).join('') + '</div>';
  }
  return h;
}
/* Receivables leads with them (what needs the owner, §3e) while any is in hand, or went in or came back in the last 30 days. */
function _bankChequesHtml(cls) {
  var today = localDateStr(), byId = {};
  cls.forEach(function(v) { byId[v.row.id] = v; });
  var shown = bankChequeLinks(cls).filter(function(o) {
    return o.status === 'held' || ((o.status === 'deposited' || o.status === 'returned') && isoDaysBetween(o.dep.row.date, today) <= 30);
  });
  if (!shown.length) return '';
  var held = shown.filter(function(o) { return o.status === 'held'; });
  var amt = gstRound(held.reduce(function(t, o) { return t + (Number(o.ch.amount) || 0); }, 0)), oldest = held.reduce(function(m, o) { return Math.max(m, o.days); }, 0);
  var say = held.length ? '<span class="inv-dot inv-dot-' + bankChequeTone(oldest) + '" data-cheques-held="' + held.length + '">' +
    escHtml(todoPlural(held.length, 'cheque') + ' in hand · ' + finRs(amt) + (oldest ? ' · the oldest ' + todoPlural(oldest, 'day') : ' · received today')) + '</span>'
    : '<span class="inv-dot inv-dot-ok" data-cheques-held="0">None in hand</span>';
  // In hand first, the oldest first; then those gone in, the latest first.
  shown.sort(function(a, b) {
    var ah = a.status === 'held' ? 0 : 1, bh = b.status === 'held' ? 0 : 1;
    if (ah !== bh) return ah - bh;
    return ah === 0 ? b.days - a.days : (b.dep.row.date < a.dep.row.date ? -1 : b.dep.row.date > a.dep.row.date ? 1 : 0);
  });
  return '<div class="inv-panel inv-panel-flush" id="bankCheques"><div class="inv-panel-head"><span class="inv-panel-title">Cheques received</span>' + say + '</div>' +
    shown.map(function(o) { return _bankChequeRowHtml(o, byId); }).join('') + '</div>';
}
/* The dialog a scrim holds, closed once it has done its work. */
function bankChequeDialogClose(sel) {
  var el = document.querySelector(sel), sc = el && el.closest('.inv-scrim-dialog');
  if (!sc) return;
  delete sc.dataset.typed;
  dialogCloseScrim(sc);
}
/* One cheque: what it is and what became of it, and what can be done with it. */
function bankChequeOpen(id) {
  var o = bankChequeLinks().find(function(x) { return x.ch.id === id; });
  if (!o) return;
  var ch = o.ch, c = bankChequeClient(ch);
  var state = o.status === 'held' ? { label: 'In hand', value: bankChequeAge(o.days), sub: 'counts as paid until it reaches the bank' }
    : o.status === 'void' ? { label: 'Void', value: formatDate(isoOf(new Date(ch.voidedAt))), sub: ch.voidReason || '' }
    : { label: o.status === 'returned' ? 'Deposited, then returned' : 'In the bank', value: formatDate(o.dep.row.date),
      sub: (o.how === 'set' ? 'linked by you' : 'found by its number') + (Math.abs(o.diff) >= 0.005 ? '; deposited ' + formatCurrency(o.dep.row.cr) + ', not ' + formatCurrency(ch.amount) : '') };
  var facts = [
    { label: 'Amount', value: formatCurrency(ch.amount) }, { label: 'Cheque number', value: ch.number },
    ch.chequeDate ? { label: 'Dated', value: formatDate(ch.chequeDate) } : null, ch.drawnOn ? { label: 'Drawn on', value: ch.drawnOn } : null,
    { label: 'Received', value: formatDate(ch.receivedOn) }, state
  ].filter(Boolean);
  var foot = '<button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Close</button>' +
    (!ch.voidedAt && o.how === 'number' ? '<button class="inv-btn inv-btn-secondary" data-action="invChequeNotThis" data-id="' + escHtml(ch.id) + '">Not this deposit</button>' : '') +
    (!ch.voidedAt && o.how === 'set' ? '<button class="inv-btn inv-btn-secondary" data-action="invChequeUnlink" data-id="' + escHtml(ch.id) + '">Unlink</button>' : '') +
    (!ch.voidedAt && o.status === 'held' ? '<button class="inv-btn inv-btn-danger" data-action="invChequeVoid" data-id="' + escHtml(ch.id) + '">Void</button>' : '');
  dialogOpen('<div class="inv-dialog" data-cheque-dialog="' + escHtml(ch.id) + '">' + dialogHeadHtml('Cheque ' + escHtml(ch.number)) +
    '<div class="inv-panel inv-panel-flush"><div class="inv-row"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(c ? c.name : 'A client no longer in the book') + '</span></span></div>' +
    facts.map(uiFactRowHtml).join('') + (ch.note ? '<div class="inv-panel-body inv-note">' + escHtml(ch.note) + '</div>' : '') + '</div>' +
    '<div class="inv-dialog-foot">' + foot + '</div></div>', { dismiss: true });
}
/* The form: Money → Receivables → Cheque received, and Add → By hand → Cheque. */
function bankChequeFormOpen(clientId) {
  var today = localDateStr(), f = function(label, control, wide) { return '<label class="inv-field' + (wide ? ' inv-kv-wide' : '') + '"><span class="inv-field-label">' + label + '</span>' + control + '</label>'; };
  var opts = (S.clients || []).filter(function(c) { return c.isActive !== false || String(c.id) === String(clientId); }).slice().sort(function(a, b) { return a.name.localeCompare(b.name); })
    .map(function(c) { return '<option value="' + escHtml(String(c.id)) + '"' + (String(c.id) === String(clientId) ? ' selected' : '') + '>' + escHtml(c.name) + '</option>'; }).join('');
  dialogOpen('<div class="inv-dialog" data-cheque-form>' + dialogHeadHtml('Cheque received') +
    '<div class="inv-fields">' +
    f('Client', '<select class="inv-select" id="chqClient"><option value="">Choose a client</option>' + opts + '</select>') +
    f('Amount', '<input class="inv-input inv-input-num" id="chqAmount" type="number" step="0.01" min="0" inputmode="decimal">') +
    f('Cheque number', '<input class="inv-input" id="chqNumber" inputmode="numeric" autocomplete="off">') +
    f('Received on', '<input class="inv-input" id="chqReceived" type="date" max="' + today + '" value="' + today + '">') +
    f('Cheque date', '<input class="inv-input" id="chqDate" type="date">') +
    f('Drawn on (bank)', '<input class="inv-input" id="chqBank" autocomplete="off">') +
    f('Note', '<input class="inv-input" id="chqNote" autocomplete="off">', true) +
    '</div><div class="inv-note">It counts as paid from the day it came. Its deposit on the statement takes over, found by its number.</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invChequeSave">Save cheque</button></div></div>', { dismiss: true });
}
function bankChequeSave() {
  var form = document.querySelector('[data-cheque-form]');
  if (!form) return;
  var v = function(id) { var el = form.querySelector('#' + id); return el ? String(el.value).trim() : ''; };
  var clientId = v('chqClient'), amount = gstRound(parseFloat(v('chqAmount')) || 0), number = v('chqNumber').replace(/\s+/g, ''), received = v('chqReceived') || localDateStr();
  if (!clientId) { showToast('Choose the client', 'error'); return; }
  if (!(amount > 0)) { showToast('Enter the amount', 'error'); return; }
  if (!/^\d+$/.test(number)) { showToast('Enter the cheque number, digits only', 'error'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(received) || received > localDateStr()) { showToast('The day it came cannot be after today', 'error'); return; }
  var cid = _bankIdOf(S.clients, clientId);
  var twin = bankCheques().find(function(ch) { return !ch.voidedAt && String(ch.clientId) === String(cid) && bankChequeKey(ch.number) === bankChequeKey(number); });
  if (twin) { showToast('Cheque ' + number + ' is already recorded for this client, received ' + formatDate(twin.receivedOn), 'error'); return; }
  // A Finance edit (bankGate, P1): the form stays as typed while the PIN is asked, and the same Save runs once it is given.
  if (!bankGate('record a cheque received', function() { bankChequeSave(); })) return;
  bankCheques().push({ id: 'CHQ-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), clientId: cid, amount: amount, number: number,
    chequeDate: v('chqDate') || null, drawnOn: v('chqBank') || null, receivedOn: received, note: v('chqNote') || null, at: Date.now(),
    by: typeof grdUserId === 'function' ? grdUserId() : null });
  saveState();
  bankChequeDialogClose('[data-cheque-form]');
  if (navPageOf() === 'pageFinance') renderFinance();
  showToast('Cheque ' + number + ' recorded: ' + formatCurrency(amount) + ' counts as paid from ' + formatDate(received));
}
async function bankChequeVoid(id) {
  var ch = bankCheques().find(function(x) { return x.id === id; });
  if (!ch || ch.voidedAt) return;
  if (!bankGate('void a cheque received', function() { bankChequeVoid(id); })) return;
  var reason = await uiPrompt({ title: 'Void cheque ' + ch.number, body: 'It stays on the record and stops counting as paid.', label: 'Why is it void?',
    okLabel: 'Void cheque', danger: true, required: true, requiredText: 'A void needs a reason.' });
  if (reason == null) return;
  if (!reason.trim()) { showToast('A void needs a reason', 'error'); return; }
  ch = bankCheques().find(function(x) { return x.id === id; });
  if (!ch || ch.voidedAt) return;
  ch.voidedAt = Date.now(); ch.voidReason = reason.trim(); ch.voidBy = typeof grdUserId === 'function' ? grdUserId() : null;
  saveState();
  bankChequeDialogClose('[data-cheque-dialog]');
  if (navPageOf() === 'pageFinance') renderFinance();
  showToast('Cheque ' + ch.number + ' voided: what the client owes is back');
}
/* A sep-bank file (this app's own bank export): its cheques received merge by id, never written over; its statement rows are not
   read from it (a statement comes in from the bank's own file). Add → File and Money → Bank's Import hand it here. */
function bankChequesImport(obj, name) {
  var list = obj && Array.isArray(obj.cheques) ? obj.cheques : [], have = {}, added = 0, kept = 0;
  bankCheques().forEach(function(ch) { have[ch.id] = true; });
  list.forEach(function(x) {
    if (!x || typeof x !== 'object' || !x.id || !(Number(x.amount) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(x.receivedOn || ''))) return;
    if (have[x.id]) { kept++; return; }
    var ch = { id: String(x.id), clientId: x.clientId, amount: gstRound(Number(x.amount)), number: String(x.number || ''), chequeDate: x.chequeDate || null,
      drawnOn: x.drawnOn || null, receivedOn: x.receivedOn, note: x.note || null, at: Number(x.at) || Date.now(), by: x.by || null };
    if (x.deposit !== undefined) ch.deposit = x.deposit === null ? null : String(x.deposit);
    if (x.voidedAt) { ch.voidedAt = x.voidedAt; ch.voidReason = x.voidReason || ''; ch.voidBy = x.voidBy || null; }
    bankCheques().push(ch);
    have[ch.id] = true; added++;
  });
  if (added) saveState();
  if (navPageOf() === 'pageFinance') renderFinance();
  uiAlert({ title: added ? todoPlural(added, 'cheque') + ' received added' : 'No cheque added', body: (name || 'The file') + ' holds ' + todoPlural(list.length, 'cheque') + ' received' +
    ': ' + added + ' new' + (kept ? ', ' + kept + ' already held and kept as they are' : '') + '. Its statement rows are not read from it: a statement comes in from the bank’s own .xls or .xlsx, on Money → Bank.' });
}
/* The owner's word on a cheque's deposit: a row (Link), "not this one" (null), or back to its number (Unlink). */
function bankChequeSetDeposit(id, dep) {
  var ch = bankCheques().find(function(x) { return x.id === id; });
  if (!ch || ch.voidedAt) return;
  if (!bankGate('link a cheque to its deposit', function() { bankChequeSetDeposit(id, dep); })) return;
  if (dep === undefined) delete ch.deposit; else ch.deposit = dep;
  saveState();
  bankChequeDialogClose('[data-cheque-dialog]');
  if (navPageOf() === 'pageFinance') renderFinance();
}

/* ---------- Receipts against invoices ---------- */
function _bankInvLabel(inv) { return inv.displayNumber || inv.invoiceNumber; }

/* Receivables start on the later of the statement's first day and the book's first invoice. A statement
   that reaches back before the invoices do (January against a book from April) carries receipts for
   invoices this app never held: read against the book they pay April's invoices early and a client reads
   paid ahead. Before this day nothing is set against anything, and what was owed on it is the opening. */
function bankRecvFrom(rows) {
  rows = rows || bankRows();
  if (!rows.length) return '';
  var from = rows[0].date, book = '';
  (S.invoices || []).forEach(function(i) { if (i.date && (!book || i.date < book)) book = i.date; });
  return book > from ? book : from;
}
/* An opening is what was owed on a particular day. One set against another day (the statement's first,
   before the book was taken into account) no longer describes the start and is not applied. */
/* `set`: an opening recorded for that day, nothing owed included. A client that owed nothing at the start is an
   answer, and it stops the figure offered from asking again. */
function bankOpeningFor(clientId, from) {
  var o = bankData().opening[clientId];
  if (!o) return { amount: 0, stale: null, set: false };
  var rows = bankRows(), day = o.date || (rows.length ? rows[0].date : ''), amt = gstRound(Number(o.amount) || 0);
  return day === from ? { amount: amt, stale: null, set: true } : { amount: 0, stale: { amount: amt, date: day }, set: false };
}
/* What a client most likely owed on the day receivables start, offered and never applied (owner, 28 Sep 2026:
   "most of April payment is actually of March job work"). The shop's fastest payer settles 15-20 days after the
   invoice; the rest pay monthly. So money that reaches the bank before a client's first invoice in the book is 20
   days old paid work from before the book. Measured on the real book, 20 days is the one window that takes every
   such receipt (SSS Mehta 13 Apr, Dorabji 18 Apr, HighCo 29 Apr, RG before its first invoice) and none that paid
   April (SSS Mehta's 5 May, day 20). A receipt before the client's first invoice counts whenever it came; one after
   it counts only for a client already billing when the book began (first invoice within 45 days of the start),
   since a new client's first payment pays its first invoice. A floor, not the answer: money owed at the start and
   never paid is in no receipt. */
var BANK_OPENING_WINDOW = 20, BANK_OPENING_NEAR = 45;
function bankOpeningSuggest(recs, invs, from) {
  var anchor = invs.length ? invs[0].date : '', until = anchor ? isoAddDays(anchor, BANK_OPENING_WINDOW) : '';
  var early = anchor && isoDaysBetween(from, anchor) <= BANK_OPENING_NEAR;
  var rows = recs.filter(function(v) { return !anchor || v.row.date < anchor || (early && v.row.date < until); })
    .map(function(v) { return { date: v.row.date, amount: v.row.cr }; });
  var amount = gstRound(rows.reduce(function(t, x) { return t + x.amount; }, 0));
  return amount > 0 ? { amount: amount, rows: rows, anchor: anchor, until: early ? until : anchor } : null;
}

/* Receipts nobody has placed, from the day receivables start: an earlier one paid an invoice this app
   does not hold, so it cannot make what is owed read high. */
function bankLooseReceipts(cls, from) {
  from = from == null ? bankRecvFrom() : from;
  return cls.filter(function(v) { return v.cat === 'receipt' && v.clientId == null && v.row.cr > 0 && v.row.date >= from; });
}

/* Per client, from bankRecvFrom(): what was invoiced, what was credited, what came in,
   and which invoices each receipt paid. A receipt is set against invoices EXACTLY when one open
   invoice, or a run of consecutive open ones, adds up to it within ₹1 — otherwise oldest first,
   and it says which. soma-internal's tolerant sweep hit every credit and proved nothing; a
   receipt is only ever called a match to the rupee. */
function bankReceivables(cls) {
  cls = cls || bankClassify();
  var from = bankRecvFrom();
  var out = [];
  // A cheque received and not yet in the bank is a receipt dated the day it came (TM3b): the client paid that day. It is no
  // statement row, so it is never placed by hand, offered to another client, or read as what was owed at the start.
  var held = bankChequeLinks(cls).filter(function(o) { return o.status === 'held'; }).map(function(o) {
    return { row: { id: 'chq:' + o.ch.id, date: o.ch.receivedOn, cr: gstRound(Number(o.ch.amount) || 0), dr: 0, narration: 'Cheque ' + o.ch.number + ' in hand', chq: o.ch.number },
      cat: 'receipt', clientId: o.ch.clientId, party: '', pending: true, cheque: o.ch.id };
  });
  (S.clients || []).forEach(function(c) {
    var invs = (S.invoices || []).filter(function(i) { return i.status === 'active' && String(i.clientId) === String(c.id) && i.date >= from; })
      .sort(function(x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : String(x.invoiceNumber).localeCompare(String(y.invoiceNumber)); });
    var recs = cls.filter(function(v) { return v.cat === 'receipt' && v.clientId != null && String(v.clientId) === String(c.id) && v.row.date >= from; })
      .concat(held.filter(function(v) { return String(v.clientId) === String(c.id); }));
    var op = bankOpeningFor(c.id, from), opening = op.amount;
    if (!invs.length && !recs.length && !opening && !op.stale) return;
    var open = [];
    if (opening) open.push({ label: 'Owed at ' + formatDate(from), date: from, amount: opening, due: opening });
    invs.forEach(function(i) { open.push({ inv: i, label: _bankInvLabel(i), date: i.date, amount: gstRound(i.grandTotal || 0), due: gstRound(i.grandTotal || 0) }); });
    // Oldest first, but never against an invoice raised after the money came in: a receipt cannot pay an
    // invoice not yet issued. What a receipt cannot place stays on account (most often money for work from
    // before the book, which the opening is for), rather than quietly paying invoices raised weeks later.
    var fifo = function(amt, parts, upto) {
      open.forEach(function(o) {
        if (amt <= 0 || o.due <= 0 || (upto && o.date > upto)) return;
        var k = Math.min(o.due, amt);
        o.due = gstRound(o.due - k); amt = gstRound(amt - k);
        if (parts) parts.push({ label: o.label, amount: gstRound(k), whole: o.due === 0, date: o.date, inv: !!o.inv });
      });
      return amt;
    };
    // Credit notes and receipts in the order they happened (a note before a receipt of the same day). A note takes its
    // credit off its invoice on its own date; dated after the receipt that paid that invoice, the credit is the client's:
    // it settles what is still open, oldest first, or stays on account (`noteCredit`). Read before every receipt, it
    // turned a payment exact to the rupee into "₹118 more than was open". A rebate raised before its net payment still
    // comes first, so that payment still matches its batch exactly.
    var notes = getCreditNotes().filter(function(n) { return n.status !== 'cancelled' && String(n.clientId) === String(c.id) && (n.date || '') >= from; });
    var events = notes.map(function(n, i) { return { date: n.date || '', k: 0, i: i, n: n }; })
      .concat(recs.map(function(v, i) { return { date: v.row.date, k: 1, i: i, v: v }; }))
      .sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.k - b.k || a.i - b.i; });
    var notesTotal = 0, noteCredit = 0, rounding = 0, received = 0, allocs = [];
    events.forEach(function(e) {
      if (e.n) {
        var na = gstRound(e.n.grandTotal || 0);
        notesTotal = gstRound(notesTotal + na);
        var o = open.find(function(x) { return x.inv && (x.inv.displayNumber === e.n.againstInvoice || x.inv.invoiceNumber === e.n.againstInvoice); });
        if (o) { var nk = Math.min(o.due, na); o.due = gstRound(o.due - nk); na = gstRound(na - nk); }
        if (na > 0) noteCredit = gstRound(noteCredit + fifo(na));
        return;
      }
      var v = e.v, amt = v.row.cr, parts = [], how = 'oldest';
      received = gstRound(received + amt);
      // Exact only against what was already invoiced on the day it came in: a receipt cannot pay, to the
      // rupee, an invoice not yet raised, and matching one left the older invoices it did pay open.
      var live = open.filter(function(o) { return o.due > 0 && o.date <= v.row.date; });
      for (var i = 0; i < live.length && how !== 'exact'; i++) {
        var sum = 0;
        for (var j = i; j < live.length && j < i + 40; j++) {
          sum = gstRound(sum + live[j].due);
          if (Math.abs(sum - amt) <= 1) {
            live.slice(i, j + 1).forEach(function(o) { parts.push({ label: o.label, amount: o.due, whole: true, date: o.date, inv: !!o.inv }); o.due = 0; });
            // An exact match is a settlement: the paise between the invoices and the money are rounding, taken off what
            // is owed (added, where the money was over), so the open list and what is owed always agree.
            rounding = gstRound(rounding + sum - amt);
            how = 'exact'; break;
          }
          if (sum > amt + 1) break;
        }
      }
      var left = how === 'exact' ? 0 : fifo(amt, parts, v.row.date);
      allocs.push({ v: v, how: how, parts: parts, unapplied: gstRound(left) });
    });
    // Money on account is carried forward: at the end it settles what is still open, oldest first, so the
    // open list and its ageing add up to what is owed. It is kept apart from the receipts' own parts, which
    // only ever name an invoice raised by the day the money came in. `carried` is all that came in with nothing
    // open to pay; `onAccount` is what is left of it once the later invoices are settled. The carried figure
    // read "on account" long after it had paid them.
    var credits = [], carried = gstRound(allocs.reduce(function(t, a) { return t + a.unapplied; }, 0));
    var onAccount = gstRound((carried > 0 ? fifo(carried, credits) : 0) + noteCredit);
    var invoiced = gstRound(invs.reduce(function(s, i) { return s + (i.grandTotal || 0); }, 0));
    var owed = gstRound(opening + invoiced - notesTotal - received - rounding) || 0;   // never -0
    var stillOpen = open.filter(function(o) { return o.due > 0.005; });
    var today = localDateStr();
    out.push({ client: c, opening: opening, openingSet: op.set, openingStale: op.stale, openingSuggest: op.set ? null : bankOpeningSuggest(recs.filter(function(v) { return !v.pending; }), invs, from),
      carried: carried, onAccount: onAccount, noteCredit: noteCredit, rounding: rounding, credits: credits, invoiced: invoiced, notes: gstRound(notesTotal), received: received, owed: owed,
      open: stillOpen, allocs: allocs, oldestDays: stillOpen.length ? Math.max(0, isoDaysBetween(stillOpen[0].date, today)) : null });
  });
  return out.sort(function(a, b) { return b.owed - a.owed; });
}

/* ---------- Payments ---------- */
function bankPrevMonth(iso) {
  var d = new Date(iso.slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
/* An electricity payment settles the month before it by default (a bill is paid the month after
   it is read); the operator can say otherwise, and it is kept on the row. A payment that became a bill
   (Add as bill) is that bill's month: the two are one sum of money, and a month set on the row apart from
   its bill's counted it twice, the bill in one month and the payment in the other. */
function bankBillOf(row) { return costBills().find(function(b) { return b.kind === 'power' && !b.voided && b.bankId === row.id; }) || null; }
function bankBillMonth(row) { var b = bankBillOf(row); return b ? b.month : row.billMonth || bankPrevMonth(row.date); }
function bankPowerRows(cls) { return (cls || bankClassify()).filter(function(v) { return v.cat === 'power' && v.row.dr > 0; }); }
function bankAddPowerBill(rowId) {
  var row = bankData().rows.find(function(x) { return x.id === rowId; });
  if (!row) return;
  if (!bankGate('add an electricity bill from the bank', function() { bankAddPowerBill(rowId); })) return;
  var m = bankBillMonth(row);
  if (costBills().some(function(b) { return b.kind === 'power' && !b.voided && b.month === m; })) { showToast('There is already an electricity bill for ' + billsMonthLabel(m), 'error'); return; }
  costBills().push({ id: 'CB-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'power', month: m, amount: row.dr,
    units: null, note: 'Paid ' + formatDate(row.date) + ' (bank)', bankId: row.id, at: Date.now() });
  saveState();
  renderFinance();
  showToast('Electricity bill for ' + billsMonthLabel(m) + ' added from the bank');
}

/* ---------- What was PAID, as cost (docs/FINANCE_INTELLIGENCE_SPEC.md, Phase 4) ----------
   A second instrument beside the operational record: what left the account, attributed to the month
   it pays for. GST, income tax, a returned cheque and anything the owner marks "not a cost"
   (drawings, a loan, a transfer) are money out that is not operating cost. */
var BANK_NOT_COST = { receipt: 1, gst: 1, tax: 1, reversal: 1 };
function bankIsCost(v) { return v.row.dr > 0 && !BANK_NOT_COST[v.cat] && !v.notCost; }
function bankCover(rows) { rows = rows || bankRows(); return rows.length ? { from: rows[0].date, to: rows[rows.length - 1].date } : null; }
function bankNextMonth(ym) { var d = new Date(ym + '-01T00:00:00'); d.setMonth(d.getMonth() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

/* Per month it pays for: labour, power, other and supplies, each with the rows behind it, and
   whether the statement can speak for that month at all.
   - Labour: a transfer to a named hand pays the month BEFORE (salaries go out ~14th for last month);
     cash pays the pay week it was drawn in, spread over that week's seven days, so a week that
     straddles two months is split between them.
   - Electricity: the month the payment settles (bankBillMonth: the month before, operator-settable).
   - Other (bank charges included) and supplies: the month paid.
   A month is KNOWN when the statement covers what would pay for it: the whole month and the salary
   run after it for labour, the whole month for other and supplies, a payment attributed to it for
   electricity. Unknown is never zero. */
/* Whether a pay week's payout is recorded well enough to split its cash into wages and drawings: 90% of its working days
   typed, and no hourly hand without hours (the imported history). Read by the cost and by Staff → Pay alike. */
function bankCashWeekKnown(pw) {
  return !!(pw && pw.recordedDays > 0 && pw.recordedDays >= Math.ceil((pw.workingDays || 6) * 0.9) && !(pw.lab && pw.lab.hourlessMarks > 0));
}
function bankCostByMonth(cls) {
  cls = cls || bankClassify();
  var cover = bankCover(), out = {};
  var cashWeeks = {};
  var at = function(ym) { return out[ym] || (out[ym] = { labour: { amount: 0, named: 0, cash: 0, drawings: 0, open: 0, rows: [] }, power: { amount: 0, rows: [] }, other: { amount: 0, rows: [] }, supplies: { amount: 0, rows: [] }, unsorted: { amount: 0, rows: [] } }); };
  cls.forEach(function(v) {
    if (!bankIsCost(v)) return;
    var r = v.row;
    if (v.cat === 'wages') {
      if (!v.cash && v.staffId != null) {
        var L = at(bankPrevMonth(r.date)).labour;
        L.amount += r.dr; L.named += r.dr; L.rows.push(v);
      } else {
        var wk = attWeekStartOf(r.date);
        (cashWeeks[wk] = cashWeeks[wk] || { amount: 0, rows: [] }).amount += r.dr;
        cashWeeks[wk].rows.push(v);
      }
    } else if (v.cat === 'power') { var P = at(bankBillMonth(r)).power; P.amount += r.dr; P.rows.push(v); }
    else if (v.cat === 'supplier') { var U = at(r.date.slice(0, 7)).supplies; U.amount += r.dr; U.rows.push(v); }
    // "Other" only because nothing recognised the payee is UNSORTED, not a cost: on the real statement
    // that residue is mostly the zinc and chemical traders, at four times the other-cost model.
    else if (v.cat === 'other' && v.auto) { var X = at(r.date.slice(0, 7)).unsorted; X.amount += r.dr; X.rows.push(v); }
    else { var O = at(r.date.slice(0, 7)).other; O.amount += r.dr; O.rows.push(v); }
  });
  // Cash drawn is wages and the owner's drawings (owner, 6 Oct 2026: "Personal drawings as well, through self"). A pay
  // week's cash is wages up to the payout recorded for that week (the weekly tiers and the EXTRA, payWeek) and drawings
  // past it; a week with cash and no attendance recorded cannot be split, and its month's labour is not known from the
  // bank (`open`). Each part is spread over the week's seven days, so a week across two months is split between them.
  Object.keys(cashWeeks).forEach(function(ws) {
    var c = cashWeeks[ws], pw = null;
    try { pw = payWeek(ws); } catch (x) { pw = null; }
    // A week whose hourly hands carry no hours (history imported without them) has a payout that reads near nothing:
    // its cash would read as drawings, so it is not split.
    // A week with only some of its days typed has a payout that reads small, and its cash would read as drawings: it is
    // split only once 90% of its working days are recorded.
    var known = bankCashWeekKnown(pw), wages = known ? Math.min(c.amount, Math.max(0, pw.total)) : 0;
    c.wages = wages; c.drawings = known ? c.amount - wages : 0; c.open = known ? 0 : c.amount; c.payout = known ? pw.total : null; c.known = !!known;
    var seen = {};
    for (var k = 0; k < 7; k++) {
      var d = attParseIso(ws); d.setDate(d.getDate() + k);
      var ym = isoOf(d).slice(0, 7), C = at(ym).labour;
      C.amount += wages / 7; C.cash += wages / 7; C.drawings += c.drawings / 7; C.open += c.open / 7;
      if (!seen[ym]) { seen[ym] = 1; c.rows.forEach(function(v) { C.rows.push(v); }); }
    }
  });
  // A month whose open cash is under a quarter of its labour counts it as wages (bankMonthUnknown), said on the row.
  Object.keys(out).forEach(function(ym) {
    var L = out[ym].labour;
    if (L.open >= 1 && L.open < (L.amount + L.open) * 0.25) { L.amount += L.open; L.cash += L.open; L.openCounted = L.open; }
  });
  return { months: out, cover: cover, cashWeeks: cashWeeks };
}
/* Why the statement cannot speak for a month's k, or '' when it can. Three different reasons, said apart: a
   month the statement does not cover, one whose salaries it does not reach yet, and one it covers whole but whose
   payees are not all sorted (which the owner fixes in a tap, and which "not on the statement" hid). */
/* Why other costs and supplies cannot be read for a month while its payees are unsorted, with where to sort them: one
   string, so a note elsewhere (Recorded against paid, Derive) can tell it from the other reasons. */
var BANK_UNSORTED_WHY = 'payees not yet sorted (Finance → Payments → Not yet sorted)';
function bankMonthUnknown(bm, ym, k) {
  var c = bm.cover, e = bm.months[ym];
  if (k === 'power') return e && e.power.amount > 0 ? '' : 'no payment for this month';
  if (!c || c.from > ym + '-01' || c.to < payMonthEnd(ym + '-01')) return 'not on the statement';
  // Other and supplies speak for a month only once every payment in it is sorted: an unsorted one
  // could be either, and counting it as neither reads the month cheap.
  if ((k === 'other' || k === 'supplies') && e && e.unsorted.amount >= 1) return BANK_UNSORTED_WHY;
  if (k === 'labour' && c.to < bankNextMonth(ym) + '-20') return 'its salaries are not on the statement yet';
  // Cash drawn in a week whose payout is not recorded is wages or drawings, and the bank cannot say which. Where it is under a
  // quarter of the month's labour it is counted as wages (an upper bound: the month reads high, never cheap, and says so);
  // past that the month is not known from the bank. One cash draw in a holiday week had made the whole month unknown.
  if (k === 'labour' && e && e.labour.open >= 1 && e.labour.open >= (e.labour.amount + e.labour.open) * 0.25) return 'cash drawn in a week whose payout is not fully recorded: wages or drawings';
  return '';
}
function bankMonthKnown(bm, ym, k) { return !bankMonthUnknown(bm, ym, k); }

/* The same over a date range: each month's figure for the share of its days inside the range, and
   the share of the RANGE the statement can speak for. */
/* One classification per render: Stats asks for the live cost of every month it draws, and the
   answer cannot change until the current task ends. */
var _bankCostMemo = null;
function bankCostByMonthMemo() {
  if (!_bankCostMemo) { _bankCostMemo = bankCostByMonth(); Promise.resolve().then(function() { _bankCostMemo = null; }); }
  return _bankCostMemo;
}
function bankCostForRange(from, to, byMonth) {
  var bm = byMonth || bankCostByMonthMemo(), days = isoDaysBetween(from, to) + 1;
  var res = {};
  ['labour', 'power', 'other', 'supplies'].forEach(function(k) { res[k] = { amount: 0, known: 0, months: [], unknown: [] }; });
  res.unsorted = { amount: 0, payees: {} };
  if (!bm.cover) return res;
  for (var ym = from.slice(0, 7), g = 0; ym <= to.slice(0, 7) && g < 240; ym = bankNextMonth(ym), g++) {
    var start = ym + '-01', end = payMonthEnd(start), a = from > start ? from : start, z = to < end ? to : end;
    var share = costMonthShare(ym, from, to), rangeShare = (isoDaysBetween(a, z) + 1) / days, e = bm.months[ym];
    if (e) e.unsorted.rows.forEach(function(v) { if (v.row.date >= from && v.row.date <= to) { res.unsorted.amount += v.row.dr; res.unsorted.payees[v.party || v.row.narration] = 1; } });
    ['labour', 'power', 'other', 'supplies'].forEach(function(k) {
      var c = e && e[k];
      // A month the statement cannot speak for keeps its reason, so a note can say why it was left out.
      var why = bankMonthUnknown(bm, ym, k);
      if (why) { res[k].unknown.push({ month: ym, why: why }); return; }
      res[k].known += rangeShare;
      res[k].amount += (c ? c.amount : 0) * share;
      res[k].months.push({ month: ym, share: share, rangeShare: rangeShare, amount: (c ? c.amount : 0) * share, whole: c ? c.amount : 0, named: c && c.named || 0, cash: c && c.cash || 0,
        drawings: c && c.drawings || 0, openCounted: c && c.openCounted || 0, rows: c ? c.rows : [] });
    });
  }
  return res;
}

/* ---------- Views ----------
   Money's three work screens, each in one look (docs/TAB_MAP.md §3e, TM3c): its verdict card, one toolbar row, what needs the
   owner, the list, the rest folded. Receivables: what is owed and the cheques in hand; Payments: what went out, with the bills
   (TM3a: Bills & notes split, its bills here and its credit notes with the invoices); Bank: the statement itself. */
function renderBank(tab) {
  var rows = bankRows();
  if (tab === 'bank') return _bankTabHtml(rows);
  if (tab === 'payments') return _bankPaymentsTabHtml(rows);
  return _bankRecvTabHtml(rows);
}
function _bankNoStatementHtml(what) {
  return '<div class="inv-panel" data-bank-none><div class="inv-empty">' + what + ' the bank statement, and none is imported yet. ' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invBankImport">Import the statement</button></div></div>';
}
/* A verdict is said in the worst tone of what its card holds. */
function _bankWorst(tones) {
  return tones.reduce(function(w, t) { return t && (UI_TONE_RANK[t] || 0) > (UI_TONE_RANK[w] || 0) ? t : w; }, 'ok');
}
/* A verdict of parts, the first always and each after it only while the sentence stays within the card's limit. */
function _bankSay(parts) {
  var out = [];
  parts.filter(Boolean).forEach(function(p) { if (!out.length || out.concat([p]).join(' · ').length <= UI_VERDICT_MAX) out.push(p); });
  return out.join(' · ');
}
function _bankSeesMoney() { return typeof grdSeesMoney !== 'function' || grdSeesMoney(); }

/* ---------- Receivables ---------- */
function _bankRecvTabHtml(rows) {
  var cls = rows.length ? bankClassify(rows) : [];
  var tb = '<div class="inv-toolbar" data-bank-toolbar="receipts"><button class="inv-btn inv-btn-secondary" data-action="invChequeNew">Cheque received</button></div>';
  if (!rows.length) return _bankRecvVerdictHtml(null, cls, rows) + tb + _bankChequesHtml(cls) + _bankNoStatementHtml('Receivables read');
  var recv = bankReceivables(cls);
  return _bankRecvVerdictHtml(recv, cls, rows) + tb + _bankReceiptsHtml(cls, recv);
}
/* Receivables' verdict: what is owed, and how much of it is past 60 days; receipts nobody placed; cheques in hand (TM3b). */
function _bankRecvVerdictHtml(recv, cls, rows) {
  var held = bankChequesHeld(cls), chqTone = held.n && held.oldest >= 3 ? bankChequeTone(held.oldest) : '';
  var chqFact = held.n ? { text: todoPlural(held.n, 'cheque') + ' in hand, ' + finRs(held.amount), money: true } : null;
  if (!recv) return uiVerdictHtml({ screen: 'Receivables', verdict: 'No bank statement yet', tone: chqTone || 'neutral',
    facts: ['what is owed is read from the statement', chqFact], attrs: ' id="bankRecvVerdict"' });
  var from = bankRecvFrom(rows), owed = gstRound(recv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0));
  var bands = finAgeing(recv), over60 = gstRound(bands[2].amount + bands[3].amount), over90 = bands[3].amount;
  var loose = bankLooseReceipts(cls, from).length, book = bankBookDaysToPay(bankPayHistory(recv));
  var owing = recv.filter(function(r) { return r.owed > 0.005; }), late = owing.filter(function(r) { return r.oldestDays > 60; }).length;
  // Never red while a receipt is unplaced: that money may be in already (owed90's rule).
  var tone = _bankWorst([over90 > 0 ? (loose ? 'warning' : 'danger') : over60 > 0 ? 'warning' : 'ok', loose ? 'warning' : '', chqTone]);
  return uiVerdictHtml({ screen: 'Receivables · since ' + stockShortDate(from), tone: tone, money: true,
    verdict: _bankSay([owed < 0.5 ? 'Nothing owed to us' : finRs(owed) + ' owed', over60 > 0 ? finRs(over60) + ' over 60 days' : '', loose ? loose + ' not placed' : '']),
    plain: _bankSay([owing.length ? todoPlural(owing.length, 'client') + ' owe' : 'Nothing owed to us', late ? late + ' over 60 days' : '', loose ? loose + ' not placed' : '']),
    fig: _bankSeesMoney() ? escHtml(finRs(owed)) : '',
    facts: [book && book.median != null ? 'clients pay in ' + Math.round(book.median) + ' days' : '', chqFact,
      loose ? 'owed reads high while ' + (loose === 1 ? 'a receipt is' : 'receipts are') + ' not placed' : ''],
    factors: [
      { label: '0–60 days', fig: escHtml(finRs(bands[0].amount + bands[1].amount)), sub: todoPlural(bands[0].n + bands[1].n, 'invoice'), money: true },
      { label: '61–90 days', fig: escHtml(finRs(bands[2].amount)), tone: bands[2].amount > 0 ? 'warning' : 'ok', sub: todoPlural(bands[2].n, 'invoice'), money: true },
      { label: 'Over 90 days', fig: escHtml(finRs(over90)), tone: over90 > 0 ? (loose ? 'warning' : 'danger') : 'ok', sub: todoPlural(bands[3].n, 'invoice'), money: true },
      { label: 'Not placed', fig: String(loose), tone: loose ? 'warning' : 'ok', sub: 'receipts with no client', attrs: ' data-recv-loose="' + loose + '"' }],
    attrs: ' id="bankRecvVerdict"' });
}

/* What needs the owner first (§3e): a cheque come back, cheques in hand, money nobody placed; then what each client owes. */
function _bankReceiptsHtml(cls, recv) {
  var rows = bankRows(), from = bankRecvFrom(rows), fromTxt = escHtml(formatDate(from));
  var h = _bankBouncesHtml(cls) + _bankChequesHtml(cls) + _bankLooseHtml(cls, recv, from) + _bankOwedHtml(cls, recv, from, fromTxt);
  var early = cls.filter(function(v) { return v.cat === 'receipt' && v.clientId == null && v.row.cr > 0 && v.row.date < from; }).length;
  if (early) h += '<div class="inv-panel-body inv-note" data-loose-early="' + early + '">' + todoPlural(early, 'receipt') + ' with no client from before ' + fromTxt +
    ' ' + (early === 1 ? 'is' : 'are') + ' left out: ' + (early === 1 ? 'it' : 'they') + ' paid invoices from before the book.</div>';
  if (!_isDesktop) return h;
  // The desktop: the list beside the open client's receivables (UX overhaul 2, step 7). A client not on the list (nothing since
  // the start, a garbage address) is no record open: the address drops it.
  var openR = _bankOpen ? recv.find(function(r) { return String(r.client.id) === _bankOpen; }) : null;
  if (!openR) _bankOpen = null;
  return '<div class="inv-pane-host' + (openR ? ' inv-pane-open' : '') + '" id="recvHost" data-open="' + (openR ? escHtml(String(openR.client.id)) : '') + '"><div class="inv-pane-list" id="recvList">' + h + '</div>' +
    '<div class="inv-pane" id="recvPane">' + (openR ? paneHeadHtml('<span class="inv-panel-title">' + escHtml(openR.client.name) + '</span>', 'invBankPaneClose') +
      '<div class="inv-panel inv-panel-flush" data-recv-pane="' + escHtml(String(openR.client.id)) + '"><div class="inv-panel-head"><span class="inv-panel-title">Owed</span>' +
      '<span class="inv-num">' + figHtml(formatCurrency(openR.owed), openR.owed > 0.005 ? figToneAge(openR.oldestDays) : null) + '</span></div>' +
      _bankRecvDetailHtml(openR, fromTxt, cls) + '</div>' : '') + '</div></div>';
}
/* Each client: what it owes, coloured by the age of its oldest open invoice; how fast it pays and how old that invoice is in its
   line. What was invoiced, credited and received is in its fold (one fact a row). */
function _bankOwedHtml(cls, recv, from, fromTxt) {
  var totalOwed = recv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0);
  var h = '<div class="inv-panel inv-panel-flush" id="bankReceipts"><div class="inv-panel-head"><span class="inv-panel-title">Owed by client</span>' +
    '<span class="inv-panel-count inv-num">' + formatCurrency(totalOwed) + '</span></div>';
  var sgN = recv.filter(function(r) { return r.openingSuggest; }).length;
  // How receipts are set against invoices, and what an opening is, are the bank guide's (kbguides.js); one line here.
  var rows = bankRows();
  h += '<div class="inv-panel-body inv-note" data-recv-from>Since ' + fromTxt + '. A receipt pays the invoices it adds up to exactly, else the oldest first.</div>';
  if (sgN) h += '<div class="inv-callout inv-callout-info" data-opening-hint="' + sgN + '">' + (sgN === 1 ? 'A client’s' : todoPlural(sgN, 'client') + '’') +
    ' first payments most likely paid work from before ' + fromTxt + ': open ' + (sgN === 1 ? 'it' : 'each') + ' to check what was owed then.</div>';
  if (!recv.length) h += '<div class="inv-empty">No invoices or receipts since ' + fromTxt + '.</div>';
  var payHist = bankPayHistory(recv);
  recv.forEach(function(r) {
    var open = _bankOpen === String(r.client.id), dtp = bankDaysToPay(r.client.id, payHist);
    // Two facts (§3e): how fast it pays, how old its oldest open invoice is. The rest is in its fold, one fact a row.
    var meta = [dtp && dtp.median != null ? 'pays in ' + figHtml(Math.round(dtp.median) + ' d', figTonePaysIn(dtp.median)) + (dtp.n < 3 ? ' (' + todoPlural(dtp.n, 'receipt') + ')' : '') : '',
      r.open.length ? 'oldest ' + r.oldestDays + ' d' : ''].filter(Boolean);
    // On the desktop a client opens in the pane beside the list, so its row is the current one, not an expander.
    h += '<div class="inv-row inv-row-2" data-recv="' + escHtml(String(r.client.id)) + '"' + (_isDesktop && open ? ' aria-current="true"' : '') + '><button class="inv-row-main' +
      (_isDesktop ? '"' : ' inv-row-expander" aria-expanded="' + open + '"') + ' data-action="invBankClient" data-id="' + escHtml(String(r.client.id)) + '">' +
      '<span class="inv-row-title">' + escHtml(r.client.name) + '</span><span class="inv-row-meta">' + (meta.join(' · ') || escHtml(formatCurrency(r.invoiced)) + ' invoiced') + '</span></button>' +
      // Owed is coloured by how old its oldest open invoice is, and the word under it says so.
      '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + figHtml(formatCurrency(r.owed), r.owed > 0.005 ? figToneAge(r.oldestDays) : null) + '</span><span class="inv-row-meta">' +
      (r.owed < -0.005 ? 'paid ahead' : r.owed > 0.005 && r.oldestDays > 90 ? 'owed, over 90 d' : r.owed > 0.005 && r.oldestDays > 60 ? 'owed, over 60 d' : 'owed') + '</span></span></span></div>';
    if (open && !_isDesktop) h += '<div class="inv-row-children">' + _bankRecvDetailHtml(r, fromTxt, cls) + '</div>';
  });
  return h + '</div>';
}
/* Receipts nobody can name: cheques deposited, a remitter the client list does not recognise. A cheque in hand of the same
   amount is offered first: linked, the deposit is that client's and the cheque stops counting beside it. */
function _bankLooseHtml(cls, recv, from) {
  var loose = bankLooseReceipts(cls, from);
  if (!loose.length) return '';
  var series = bankChequeSeries(cls), chqFor = {};
  bankChequeLinks(cls).forEach(function(o) { o.offers.forEach(function(id) { (chqFor[id] = chqFor[id] || []).push(o.ch); }); });
  var h = '<div class="inv-panel inv-panel-flush" id="bankLoose"><div class="inv-panel-head"><span class="inv-panel-title">Receipts with no client</span><span class="inv-panel-count">' + loose.length + '</span></div>';
  // The latest five, newest first; the rest one tap away (UX overhaul 2, step 6: this list ran three phone screens; ten until
  // the tab map, TM3c, when the verdict, the toolbar and the cheques above it took the room, I10). The verdict counts them all.
  var looseRows = [];
  loose.slice().reverse().forEach(function(v) {
    var h = '', parts = [];
    var inst = bankInstrument(v.row), o = bankPlacementOffers(v.row, recv, series);
    // The cheque number is what the owner matches against the book, so it leads; a remitter's name leads where there is one.
    var chqDep = bankIsChequeDeposit(v.row) && inst;
    h += '<div class="inv-row inv-row-2 inv-row-flow" data-loose="' + escHtml(v.row.id) + '"><span class="inv-row-main"><span class="inv-row-title">' +
      (chqDep ? '<span class="inv-id">' + escHtml(inst) + '</span>' : escHtml(v.party || v.row.narration)) + '</span>' +
      '<span class="inv-row-meta">' + (chqDep ? 'Cheque · ' : '') + escHtml(formatDate(v.row.date)) + (inst && !chqDep ? ' · chq ' + escHtml(inst) : '') + '</span></span>' +
      '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(v.row.cr) + '</span>' + _bankClientSelect(v) + '</span></div>';
    parts.push(h); h = '';
    // Each offer is a line of its own under the receipt, its button at the row's end: inside the one-line meta it was clipped
    // by the ellipsis on a phone and could not be tapped.
    var offer = function(c, why, text) {
      return '<div class="inv-row inv-row-2" data-offer="' + escHtml(v.row.id) + '" data-why="' + why + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(c.name) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(text) + '</span></span>' +
        '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankPlace" data-id="' + escHtml(v.row.id) + '" data-client="' + escHtml(String(c.id)) + '" data-why="' + why + '" aria-label="Place with ' + escHtml(c.name) + '">Place</button></span></div>';
    };
    var chqs = (chqFor[v.row.id] || []).map(function(ch) {
      var c = bankChequeClient(ch);
      return '<div class="inv-row inv-row-2" data-offer="' + escHtml(v.row.id) + '" data-why="cheque"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(c ? c.name : 'A client no longer in the book') + '</span>' +
        '<span class="inv-row-meta">cheque ' + escHtml(ch.number) + ' in hand, the same amount</span></span>' +
        '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invChequeLink" data-id="' + escHtml(ch.id) + '" data-row="' + escHtml(v.row.id) + '">Link</button></span></div>';
    }).join('');
    if (chqs) h += '<div class="inv-row-children">' + chqs + '</div>';
    else if (o.both) h += '<div class="inv-row-children">' + offer(o.both, 'both', 'series and amount agree') + '</div>';
    else if (o.series || o.amount) {
      h += '<div class="inv-row-children">' +
        (o.series ? offer(o.series.client, 'series', 'series ' + o.series.from + '–' + o.series.to) : '') +
        (o.amount ? offer(o.amount.client, 'amount', 'equals ' + o.amount.labels.join(' + ')) : '') + '</div>';
    }
    if (h) parts.push(h);
    looseRows.push({ parts: parts });
  });
  return h + uiMoreHtml('bank-loose', looseRows, { n: 5, noun: 'receipts' }) + '</div>';
}

/* ---------- Payments ---------- */
/* Payees read as "other" only because nothing recognised them: until each is set once, the live cost counts them as neither
   supplier nor cost. */
function _bankUnsorted(cls) {
  var map = {};
  cls.forEach(function(v) {
    if (v.cat !== 'other' || !v.auto || !(v.row.dr > 0)) return;
    var k = v.party || v.row.narration, u = map[k] || (map[k] = { paid: 0, n: 0, last: v.row });
    u.paid = gstRound(u.paid + v.row.dr); u.n++; if (v.row.date >= u.last.date) u.last = v.row;
  });
  var keys = Object.keys(map).sort(function(a, b) { return map[b].paid - map[a].paid; });
  return { map: map, keys: keys, paid: gstRound(keys.reduce(function(t, k) { return t + map[k].paid; }, 0)) };
}
function _bankPaymentsTabHtml(rows) {
  var cls = rows.length ? bankClassify(rows) : [];
  // Add a bill is the screen's one primary; while its form is open here, the form's Save is, and the row goes.
  var tb = _costBillOpen && _costBillOpen.where === 'finance' ? '' :
    '<div class="inv-toolbar" data-bank-toolbar="payments"><button class="inv-btn inv-btn-primary" data-action="invCostBillOpen" data-where="finance">Add a bill</button></div>';
  if (!rows.length) return _bankPayVerdictHtml(cls, rows) + tb + _billsPowerHtml() + _bankNoStatementHtml('Payments read');
  return _bankPayVerdictHtml(cls, rows) + tb + _bankPaymentsHtml(cls);
}
/* Payments' verdict: the payees not yet sorted and the months with no electricity bill, what went out and came in last month. */
function _bankPayVerdictHtml(cls, rows) {
  var miss = billsMissingPower(), billFact = miss.length ? 'no bill for ' + billsMonthLabel(miss[0]) + (miss.length > 1 ? ' and ' + (miss.length - 1) + ' more' : '') : 'every month billed';
  if (!rows.length) return uiVerdictHtml({ screen: 'Payments', verdict: miss.length ? todoPlural(miss.length, 'month') + ' with no electricity bill' : 'No bank statement yet',
    tone: miss.length ? 'warning' : 'neutral', facts: [billFact, 'payments are read from the statement'], attrs: ' id="bankPayVerdict"' });
  var un = _bankUnsorted(cls), months = finCashByMonth(rows), cur = localDateStr().slice(0, 7);
  var lm = months.filter(function(m) { return m.month < cur; }).pop() || months[months.length - 1];
  return uiVerdictHtml({ screen: 'Payments · to ' + stockShortDate(rows[rows.length - 1].date), tone: un.keys.length || miss.length ? 'warning' : 'ok',
    verdict: _bankSay([un.keys.length ? todoPlural(un.keys.length, 'payee') + ' not sorted' : '', miss.length ? todoPlural(miss.length, 'month') + ' with no electricity bill' : '']) || 'Every payee sorted, every bill in',
    fig: _bankSeesMoney() ? escHtml(finRs(lm.dr)) : '',
    facts: [{ text: 'paid out in ' + billsMonthLabel(lm.month), money: true }, un.keys.length ? { text: finRs(un.paid) + ' unsorted counts as no cost', money: true } : 'every payee sorted', billFact],
    factors: [
      { label: 'Not yet sorted', fig: String(un.keys.length), tone: un.keys.length ? 'warning' : 'ok', sub: 'payees to set once', attrs: ' data-pay-unsorted="' + un.keys.length + '"' },
      { label: 'Bills missing', fig: String(miss.length), tone: miss.length ? 'warning' : 'ok', sub: 'electricity months', attrs: ' data-pay-missing="' + miss.length + '"' },
      { label: 'Paid out', fig: escHtml(finRs(lm.dr)), sub: billsMonthLabel(lm.month), money: true },
      { label: 'Came in', fig: escHtml(finRs(lm.cr)), sub: billsMonthLabel(lm.month), money: true }],
    attrs: ' id="bankPayVerdict"' });
}
function _bankUnsortedHtml(un) {
  if (!un.keys.length) return '';
  var h = '<div class="inv-panel inv-panel-flush" id="bankUnsorted"><div class="inv-panel-head"><span class="inv-panel-title">Not yet sorted</span><span class="inv-panel-count">' + un.keys.length + '</span></div>';
  // The three paid most first; the rest one tap away (the bills took the room under them, TM3a, I10). The verdict counts them all.
  return h + uiMoreHtml('bank-unsorted', un.keys.map(function(k) {
    var u = un.map[k];
    return '<div class="inv-row inv-row-2" data-unsorted="' + escHtml(k) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(k) + '</span><span class="inv-row-meta inv-row-wrap">' + todoPlural(u.n, 'payment') + ' · last ' + escHtml(formatDate(u.last.date)) + '</span></span>' +
      '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(u.paid) + '</span><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankSort" data-id="' + escHtml(u.last.id) + '" data-q="' + escHtml(k) + '">Sort</button></span></div>';
  }), { n: 3, noun: 'payees' }) + '</div>';
}
/* What needs the owner first (§3e, §1a-8): the payees not yet sorted, then the bills (the form when open, the months with no
   electricity bill, the bills entered folded); then what was paid, by kind. */
function _bankPaymentsHtml(cls) {
  var h = _bankUnsortedHtml(_bankUnsorted(cls)) + _billsPowerHtml();
  // The sections after what needs the owner are the rest, folded (§3e): shut on the phone, open on the desktop until moved.
  var fold = function(key, card) { return uiFoldCard(key, card, !!_isDesktop); };
  // Electricity: each payment is a month's bill.
  var power = bankPowerRows(cls).slice().reverse(), p = '';
  p += '<div class="inv-panel inv-panel-flush" id="bankPower"><div class="inv-panel-head"><span class="inv-panel-title">Electricity paid <span class="inv-panel-count">' + power.length + '</span></span></div>';
  if (!power.length) p += '<div class="inv-empty">No payment to JBVNL on the statement.</div>';
  power.forEach(function(v) {
    // The bill made from this payment first; else any bill for its month, typed by hand or made from another payment.
    var m = bankBillMonth(v.row), bill = bankBillOf(v.row) || costBills().find(function(b) { return b.kind === 'power' && !b.voided && b.month === m; });
    var status = bill ? (Math.abs(bill.amount - v.row.dr) < 1 ? '<span class="inv-dot inv-dot-ok">Bill on record</span>'
      : '<span class="inv-dot inv-dot-warning">Bill on record: ' + escHtml(formatCurrency(bill.amount)) + '</span>')
      : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankAddBill" data-id="' + escHtml(v.row.id) + '">Add as bill</button>';
    var months = [v.row.date.slice(0, 7)];
    while (months.length < 4) months.push(bankPrevMonth(months[months.length - 1]));
    p += '<div class="inv-row inv-row-2 inv-row-flow" data-power="' + escHtml(v.row.id) + '"><span class="inv-row-main"><span class="inv-row-title inv-num">' + formatCurrency(v.row.dr) + '</span>' +
      '<span class="inv-row-meta">paid ' + escHtml(formatDate(v.row.date)) + ', for the month</span></span>' +
      '<span class="inv-row-end"><select class="inv-select inv-select-sm" data-bank-month="' + escHtml(v.row.id) + '" aria-label="Bill month">' +
      months.map(function(ym) { return '<option value="' + ym + '"' + (ym === m ? ' selected' : '') + '>' + escHtml(billsMonthLabel(ym)) + '</option>'; }).join('') + '</select>' +
      status + '</span></div>';
  });
  h += fold('pay-power', p + '</div>');

  // Wages: the same panel Staff → Pay draws.
  h += finWagesHtml(cls, 'payments');

  // Suppliers, and everything else by category.
  var sup = {};
  cls.forEach(function(v) { if (v.cat === 'supplier' && v.row.dr > 0) { var k = v.party || v.row.narration; (sup[k] = sup[k] || { paid: 0, n: 0, name: v.supplier || v.party, written: bankSupplierWritten(v) }); sup[k].paid = gstRound(sup[k].paid + v.row.dr); sup[k].n++; } });
  var billed = {};
  // A delivery typed by hand before its amount was kept carries its price: price × quantity is its bill.
  (stockData().entries || []).forEach(function(e) {
    var amt = e.amount ? Number(e.amount) : e.price > 0 && e.qty > 0 ? gstRound(e.price * e.qty) : 0;
    if (!e.voided && e.supplier && amt) billed[bankKey(e.supplier)] = gstRound((billed[bankKey(e.supplier)] || 0) + amt);
  });
  var sk = Object.keys(sup).sort(function(a, b) { return sup[b].paid - sup[a].paid; }), q = '';
  q += '<div class="inv-panel inv-panel-flush" id="bankSuppliers"><div class="inv-panel-head"><span class="inv-panel-title">Suppliers paid <span class="inv-panel-count">' + sk.length + '</span></span></div>';
  if (!sk.length) q += '<div class="inv-empty">No payment matched to a stock supplier. Set a payee to Supplier on the statement and it is remembered.</div>';
  sk.forEach(function(k) {
    var s = sup[k], key = Object.keys(billed).find(function(bk) { return bankSupplierIs(s.written, bk); });
    q += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(k) + '</span><span class="inv-row-meta">' + todoPlural(s.n, 'payment') +
      (key ? ' · stock bills recorded ' + escHtml(formatCurrency(billed[key])) : ' · no stock bills recorded') + '</span></span><span class="inv-row-end inv-num">' + formatCurrency(s.paid) + '</span></div>';
  });
  // Its door to the stock bills, a row of its own at its foot (a button in its head would keep it from folding).
  q += '<div class="inv-row"><span class="inv-row-main inv-row-meta">The bills these pay are kept on each stock line</span><span class="inv-row-end">' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invGoStock">Open Stock</button></span></div>';
  h += fold('pay-suppliers', q + '</div>');
  var tot = {};
  cls.forEach(function(v) { if (['gst', 'tax', 'charges', 'other'].indexOf(v.cat) >= 0 && v.row.dr > 0 && !(v.cat === 'other' && v.auto)) tot[v.cat] = gstRound((tot[v.cat] || 0) + v.row.dr); });
  var o = '<div class="inv-panel inv-panel-flush" id="bankOther"><div class="inv-panel-head"><span class="inv-panel-title">Everything else paid</span></div>';
  ['gst', 'tax', 'charges', 'other'].forEach(function(k) {
    if (tot[k]) o += '<div class="inv-row"><span class="inv-row-main">' + escHtml(bankCatLabel(k)) + '</span><span class="inv-row-end inv-num">' + formatCurrency(tot[k]) + '</span></div>';
  });
  if (!Object.keys(tot).length) o += '<div class="inv-empty">Nothing else.</div>';
  return h + fold('pay-other', o + '</div>');
}

/* ---------- Bank: the statement ---------- */
function _bankTabHtml(rows) {
  if (!rows.length) {
    return uiVerdictHtml({ screen: 'Bank statement', verdict: 'No bank statement yet', tone: 'neutral', facts: ['the bank’s .xls as it comes, or saved as .xlsx'], attrs: ' id="bankVerdict"' }) +
      '<div class="inv-toolbar" data-bank-toolbar="bank"><button class="inv-btn inv-btn-primary" data-action="invBankImport">Import the statement</button></div>' +
      '<div class="inv-panel" id="bankHead"><div class="inv-empty">Download the account statement from Bank of Baroda as Excel (.xls) and import it as it is; ' +
      'a later statement that overlaps it adds only the rows that are new.</div></div>' + uiFoldCard('bank-imports', _bankImportsHtml(), false);
  }
  var breaks = bankContinuity(rows);
  return _bankVerdictHtml(rows) + _bankToolbarHtml() + _bankStatementHtml(bankClassify(rows)) + uiFoldCard('bank-check', _bankCheckHtml(breaks), breaks.length > 0) +
    uiFoldCard('bank-imports', _bankImportsHtml(), false);
}
/* The statement's verdict: how far it runs and whether every balance follows from the row before; its closing balance. */
function _bankVerdictHtml(rows) {
  var b = bankData(), first = rows[0], last = rows[rows.length - 1], breaks = bankContinuity(rows), stale = Math.max(0, isoDaysBetween(last.date, localDateStr()));
  var live = b.imports.filter(function(x) { return !x.removedAt; }).length;
  // The Overview's cash card turns amber past a week; the To-do's bankStale is red at thirty days.
  var staleTone = stale >= 30 ? 'danger' : stale > 7 ? 'warning' : 'ok';
  return uiVerdictHtml({ screen: 'Bank statement', tone: _bankWorst([staleTone, breaks.length ? 'warning' : '']),
    verdict: _bankSay(['To ' + stockShortDate(last.date) + (stale > 1 ? ', ' + todoPlural(stale, 'day') + ' old' : ''), breaks.length ? todoPlural(breaks.length, 'break') + ' in the balance' : 'every balance follows']),
    fig: _bankSeesMoney() ? figHtml(escHtml(finRs(last.balance)), last.balance < 0 ? 'danger' : null) : '',
    facts: [{ text: 'closing balance', money: true }, 'from ' + stockShortDate(first.date), todoPlural(rows.length, 'row')],
    factors: [
      { label: 'Last row', fig: escHtml(stockShortDate(last.date)), tone: staleTone, sub: stale ? todoPlural(stale, 'day') + ' old' : 'today' },
      { label: 'Breaks', fig: String(breaks.length), tone: breaks.length ? 'warning' : 'ok', sub: breaks.length ? 'first ' + stockShortDate(breaks[0].row.date) : 'the balance follows' },
      { label: 'Rows', fig: String(rows.length), sub: 'since ' + stockShortDate(first.date) },
      { label: 'Imports', fig: String(live), sub: b.account ? 'account ' + b.account : 'statements brought in' }],
    attrs: ' id="bankVerdict" data-bank-breaks="' + breaks.length + '"' });
}
/* Search and the category filter (on the phone behind Filter, said under the row as a token); the files behind More. */
function _bankToolbarHtml() {
  var cat = '<select class="inv-select inv-toolbar-item" id="bankCatFilter" aria-label="Category"><option value="">Every category</option>' +
    BANK_CATS.map(function(c) { return '<option value="' + c[0] + '"' + (_bankFilter.cat === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select>';
  return '<div class="inv-toolbar" data-bank-toolbar="bank"><label class="inv-search inv-toolbar-item">' + ICON_SEARCH +
    '<input type="search" id="bankSearch" placeholder="Search narration" value="' + escHtml(_bankFilter.q) + '" aria-label="Search the statement"></label>' +
    uiFilterHtml({ key: 'bank', count: _bankFilter.cat ? 1 : 0, controls: cat }) +
    uiToolbarMoreHtml([{ label: 'Import a statement', action: 'invBankImport' }, { label: 'Export Excel', action: 'invBankExport' },
      { label: 'Export JSON for soma-internal', action: 'invBankExportJson' }]) + '</div>' +
    uiTokensHtml([{ key: 'Category', value: _bankFilter.cat ? bankCatLabel(_bankFilter.cat) : '', action: 'invBankCatClear' }]);
}
/* The balance check, folded under the statement (open where it found a break; the verdict says so either way). */
function _bankCheckHtml(breaks) {
  var head = '<div class="inv-panel inv-panel-flush" id="bankCheck"><div class="inv-panel-head"><span class="inv-panel-title">Balance check</span>' +
    '<span class="inv-dot inv-dot-' + (breaks.length ? 'warning' : 'ok') + '">' + (breaks.length ? todoPlural(breaks.length, 'break') : 'Follows') + '</span></div>';
  if (!breaks.length) return head + '<div class="inv-panel-body inv-note" data-bank-check="0">Every balance follows from the row before it, first row to last.</div></div>';
  var br = breaks[0];
  return head + '<div class="inv-panel-body"><div class="inv-callout inv-callout-warning" data-bank-check="' + breaks.length + '">' + todoPlural(breaks.length, 'place') +
    ' where the balance does not follow from the row before. First: ' + escHtml(formatDate(br.row.date)) + ', ' + escHtml(formatCurrency(br.expected)) + ' expected, ' +
    escHtml(formatCurrency(br.row.balance)) + ' on the statement. Rows are missing between two statements, or a statement is incomplete.</div></div></div>';
}

/* Each statement brought in, newest first: its file, the days it covers, what it added. One can be taken out, with a
   reason (bankRemoveImport); a removed one stays listed, saying when and why. */
function _bankImportsHtml() {
  var b = bankData(), list = b.imports.slice().reverse();
  if (!list.length) return '';
  var held = {};
  b.rows.forEach(function(r) { if (r.importId) held[r.importId] = (held[r.importId] || 0) + 1; });
  var day = function(ts) { return formatDate(isoOf(new Date(ts))); };
  return '<div class="inv-panel inv-panel-flush" id="bankImports"><div class="inv-panel-head"><span class="inv-panel-title">Imports <span class="inv-panel-count">' + list.length + '</span></span></div>' +
    uiMoreHtml('bank-imports', list.map(function(imp) {
      var gone = !!imp.removedAt, n = held[imp.id] || 0;
      // Two facts a line (the file and the day it came; what it covers and what it added), and a removed one says what became of it.
      return '<div class="inv-row inv-row-2" data-bank-import="' + escHtml(imp.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml((imp.file || 'Statement') + ' · ' + day(imp.at)) + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">' + (gone ? '<span class="inv-dot inv-dot-neutral">Removed ' + escHtml(day(imp.removedAt)) + '</span> ' + escHtml((imp.rowsRemoved || 0) + ' rows taken out: ' + (imp.removeReason || ''))
          : escHtml((imp.from ? formatDate(imp.from) + ' – ' + formatDate(imp.to) + ' · ' : '') + (imp.rows || 0) + ' rows, ' + (imp.added || 0) + ' new')) + '</span></span>' +
        '<span class="inv-row-end">' + (!gone && n ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankImportRemove" data-id="' + escHtml(imp.id) + '" aria-label="Remove this import">Remove</button>' : '') + '</span></div>';
    }), { n: 5, noun: 'imports' }) + '</div>';
}

/* Take an import out: only the rows it added go (a row it read that an earlier import had brought in carries that
   import's id and stays), with what was set on them. A returned cheque's link that names one of them goes too, and the
   rows left are linked afresh. The import is never deleted: it keeps when, why and which rows (removedIds), and the
   sep-bank export carries that, so soma-internal's compile drops the same rows. */
async function bankRemoveImport(id) {
  var b = bankData(), imp = b.imports.find(function(x) { return x.id === id; });
  if (!imp || imp.removedAt) return;
  var n = b.rows.filter(function(r) { return r.importId === id; }).length;
  if (!n) { showToast('No row this import added is still held', 'error'); return; }
  if (!grdOk('voids') && !(await guardAsk('voids', 'remove a statement import'))) return;   // P1 (guard.js)
  if (!(await uiConfirm({ title: 'Remove this import?', danger: true, okLabel: 'Remove ' + todoPlural(n, 'row'),
      body: (imp.file || 'This statement') + (imp.from ? ', ' + formatDate(imp.from) + ' – ' + formatDate(imp.to) : '') + ', added ' + todoPlural(n, 'row') + ' still held. They come out of the record, ' +
        'with whatever was set on them (a client placed, a category, a returned cheque linked). Rows it read that an earlier import had already brought in stay. The import stays listed, saying when and why.' }))) return;
  var reason = await uiPrompt({ title: 'Why is this import being removed?', label: 'Reason', danger: true, okLabel: 'Remove import', required: true, requiredText: 'A removed import needs a reason.' });
  if (reason == null) return;
  if (!reason.trim()) { showToast('A removed import needs a reason', 'error'); return; }
  // Read again: another window may have saved while the dialogs were open.
  b = bankData(); imp = b.imports.find(function(x) { return x.id === id; });
  if (!imp || imp.removedAt) return;
  var gone = {};
  b.rows.forEach(function(r) { if (r.importId === id) gone[r.id] = true; });
  b.rows = b.rows.filter(function(r) { return !gone[r.id]; });
  Object.keys(b.bounces).forEach(function(k) { if (gone[k] || (b.bounces[k] != null && gone[b.bounces[k]])) delete b.bounces[k]; });
  imp.removedAt = Date.now(); imp.removeReason = reason.trim(); imp.removedIds = Object.keys(gone); imp.rowsRemoved = imp.removedIds.length;
  // The record's account is one a statement still held names.
  if (imp.account && imp.account === b.account && !b.imports.some(function(x) { return !x.removedAt && x.account === imp.account; })) {
    var other = b.imports.find(function(x) { return !x.removedAt && x.account; });
    b.account = other ? other.account : '';
  }
  if (_bankEdit && gone[_bankEdit]) _bankEdit = null;
  if (_bankChange && gone[_bankChange]) _bankChange = null;
  saveState();
  renderFinance();
  showToast(todoPlural(imp.rowsRemoved, 'row') + ' taken out; the import stays listed with the reason');
}

/* One client's receivables: what was owed at the start, each receipt and what it paid, the cheques, what is open.
   The phone draws it under the client's row; the desktop in the pane beside the list (UX overhaul 2, step 7). */
function _bankRecvDetailHtml(r, fromTxt, cls) {
  // What makes up what is owed, one fact a row (the row's line carries only how fast it pays and how old it runs).
  var inHand = r.allocs.filter(function(a) { return a.v.pending; }).length;
  var h = [
    { label: 'Invoiced', value: formatCurrency(r.invoiced), sub: 'since ' + formatDate(bankRecvFrom()), attrs: ' data-recv-fact="invoiced"' },
    r.notes ? { label: 'Credited', value: formatCurrency(r.notes), sub: 'credit notes', attrs: ' data-recv-fact="credited"' } : null,
    { label: 'Received', value: formatCurrency(r.received), sub: inHand ? todoPlural(inHand, 'cheque') + ' in hand among it' : '', attrs: ' data-recv-fact="received"' },
    r.onAccount > 0.005 ? { label: 'On account', value: formatCurrency(r.onAccount), attrs: ' data-recv-fact="account"' } : null,
    r.openingSuggest ? { label: 'Owed at the start', value: '', sub: 'not set: a figure is offered below', attrs: ' data-recv-fact="opening"' } : null,
    Math.abs(r.rounding) > 0.005 ? { label: 'Rounded off', value: formatCurrency(Math.abs(r.rounding)), sub: 'exact payments settled to the rupee', attrs: ' data-recv-fact="rounding"' } : null
  ].filter(Boolean).map(uiFactRowHtml).join('');
  // The statement of account and the reminder, from the same figures (statement.js).
  var rem = soaLastText(r.client.id);
  h += '<div class="inv-row" data-soa-row-btn="' + escHtml(String(r.client.id)) + '"><span class="inv-row-main inv-row-meta">' +
    (rem ? escHtml(rem.charAt(0).toUpperCase() + rem.slice(1)) : r.owed > 0.005 ? 'No reminder sent yet' : 'Nothing owed') + '</span>' +
    '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invSoaOpen" data-client="' + escHtml(String(r.client.id)) + '">Statement and reminder</button></span></div>';
  if (r.openingStale) h += '<div class="inv-callout inv-callout-warning" data-opening-stale>' + escHtml(formatCurrency(r.openingStale.amount)) + ' was set as owed at ' +
    escHtml(formatDate(r.openingStale.date)) + ', but receivables start at ' + fromTxt + ' now, so it is not counted. Set what was owed on ' + fromTxt + '.</div>';
  else if (r.carried > 0.005) h += '<div class="inv-callout inv-callout-info" data-on-account>' + escHtml(formatCurrency(r.carried)) + ' came in with more than was open to pay on the day it arrived, and settles the invoices raised after it, oldest first' +
    (r.onAccount > 0.005 ? (r.onAccount < r.carried - 0.005 ? ': ' + escHtml(formatCurrency(r.onAccount)) + ' of it is still on account. ' : '. It is all still on account. ') : '. None of it is on account now. ') +
    'It most likely paid work from before ' + fromTxt + ': set what was owed on that day.</div>';
  else if (r.owed < -0.005 && !(r.noteCredit > 0.005)) h += '<div class="inv-callout inv-callout-info">More came in than was invoiced since ' + fromTxt + '. The early receipts most likely paid invoices from before then: set what was owed on that day.</div>';
  if (r.noteCredit > 0.005) h += '<div class="inv-callout inv-callout-info" data-note-credit>' + escHtml(formatCurrency(r.noteCredit)) +
    ' of credit notes came after what they credit was paid, so it is credit to the client, on account.</div>';
  h += '<div class="inv-row"><span class="inv-row-main"><label class="inv-field-label" for="bankOpening">Owed at ' + fromTxt + '</label></span>' +
    '<span class="inv-row-end"><input class="inv-input inv-input-sm inv-num" type="number" step="0.01" min="0" inputmode="decimal" id="bankOpening" data-client="' + escHtml(String(r.client.id)) + '" value="' + (r.openingSet ? r.opening : '') + '" placeholder="not set"></span></div>';
  var sg = r.openingSuggest;
  if (sg) h += '<div class="inv-row inv-row-2" data-opening-suggest="' + escHtml(String(r.client.id)) + '"><span class="inv-row-main"><span class="inv-row-title">Most likely owed on ' + fromTxt + '</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml(sg.rows.map(function(x) { return formatDate(x.date) + ' ' + formatCurrency(x.amount); }).join(' · ')) +
    (sg.anchor ? ' came in before ' + escHtml(formatDate(sg.until)) + (sg.until === sg.anchor ? ', its first invoice here' : ', when its first invoice here was ' + BANK_OPENING_WINDOW + ' days old') : ', and nothing of theirs is in the book') +
    ', so ' + (sg.rows.length === 1 ? 'it most likely paid' : 'they most likely paid') + ' work from before. Check it against your ledger: money owed then and never paid is not in it.</span></span>' +
    '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(sg.amount) + '</span><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankOpeningUse" data-client="' + escHtml(String(r.client.id)) + '" data-amount="' + sg.amount + '">Use</button></span></div>';
  r.allocs.forEach(function(a) {
    // A cheque in hand (TM3b) is set against the invoices like any receipt; it has no statement row to move, so it opens itself.
    var pend = !!a.v.pending;
    h += '<div class="inv-row inv-row-2" data-alloc="' + escHtml(a.v.row.id) + '"' + (pend ? ' data-alloc-pending' : '') + '><span class="inv-row-main"><span class="inv-row-title">' +
      (pend ? 'Cheque <span class="inv-id">' + escHtml(a.v.row.chq) + '</span> · in hand since ' + escHtml(stockShortDate(a.v.row.date)) : escHtml(formatDate(a.v.row.date))) + ' · ' +
      '<span class="inv-badge inv-badge-' + (a.how === 'exact' ? 'ok' : 'neutral') + '">' + (a.how === 'exact' ? 'Exact' : 'Oldest first') + '</span></span>' +
      '<span class="inv-row-meta">' + escHtml(a.parts.map(function(p) { return p.label + (p.whole ? '' : ' (part ' + formatCurrency(p.amount) + ')'); }).join(', ') || 'nothing open to set it against') +
      (a.unapplied > 0 ? ' · ' + escHtml(formatCurrency(a.unapplied)) + (a.parts.length ? ' more than was open by then' : ' with nothing open by then') : '') + '</span></span>' +
      '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(a.v.row.cr) + '</span>' +
      (pend ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invChequeOpen" data-id="' + escHtml(a.v.cheque) + '">Cheque</button>'
        : _bankChange === a.v.row.id ? _bankClientSelect(a.v, { empty: 'No client' })
        : '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invBankChange" data-id="' + escHtml(a.v.row.id) + '">Change</button>') + '</span></div>';
  });
  var ser = bankChequeSeries(cls)[String(r.client.id)];
  if (ser && ser.length) h += '<div class="inv-row" data-series="' + escHtml(String(r.client.id)) + '"><span class="inv-row-main inv-row-meta">Cheques: <span class="inv-id">' + escHtml(ser.slice(-5).join(' · ')) + '</span>' +
    (ser.length > 5 ? ' and ' + (ser.length - 5) + ' more' : '') + '</span></div>';
  r.open.forEach(function(o) {
    h += '<div class="inv-row inv-row-2" data-open-inv="' + escHtml(o.label) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(o.label) + '</span>' +
      '<span class="inv-row-meta"><span class="inv-dot inv-dot-warning">Open</span> · ' + escHtml(formatDate(o.date)) + '</span></span>' +
      '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(o.due) + (o.due < o.amount ? ' of ' + formatCurrency(o.amount) : '') + '</span></span></div>';
  });
  return h;
}

/* A cheque deposit names nobody. Where its amount equals, to the rupee, one open invoice or a run
   of one client's open invoices — and only one client's — that client is OFFERED, never placed:
   an exact sum is evidence, not a record of who wrote the cheque. */
function bankSuggestClient(amt, recv, date) {
  var hits = [];
  recv.forEach(function(r) {
    // Only what was invoiced by the day the cheque came in: an invoice raised after it is not what it paid.
    var open = r.open.filter(function(o) { return o.inv && (!date || o.date <= date); });
    for (var i = 0; i < open.length; i++) {
      var sum = 0;
      for (var j = i; j < open.length && j < i + 40; j++) {
        sum = gstRound(sum + open[j].due);
        if (Math.abs(sum - amt) <= 1) { hits.push({ client: r.client, labels: open.slice(i, j + 1).map(function(o) { return o.label; }) }); i = open.length; break; }
        if (sum > amt + 1) break;
      }
    }
  });
  return hits.length === 1 ? hits[0] : null;
}

/* ---------- Cheque numbers and their series ----------
   A deposit's instrument is in the narration ("BY INST 525428 - MICR CLG"), not the cheque column.
   Placing a deposit on a client IS the tag (owner, 26 Sep 2026: "tag cheque numbers to clients —
   their series will help in automation"): no second store, the series is read off the placements. */
function bankInstrument(row) {
  var m = String(row.narration || '').match(/^BY INST\s+(\d+)/i);
  return m ? m[1] : String(row.chq || '').trim();
}
function bankChequeSeries(cls) {
  var out = {};
  (cls || bankClassify()).forEach(function(v) {
    // A bounced cheque still came from the client's book.
    if ((v.cat !== 'receipt' && !v.bounced) || v.clientId == null) return;
    var n = bankInstrument(v.row);
    if (!/^\d{4,}$/.test(n)) return;
    (out[String(v.clientId)] = out[String(v.clientId)] || []).push(n);
  });
  Object.keys(out).forEach(function(k) { out[k].sort(function(a, b) { return +a - +b; }); });
  return out;
}
/* One cheque book: the same length, all but the last three digits alike. A number is suggested to a
   client only when exactly one client holds a number of that book within 50 of it. */
function bankSuggestBySeries(inst, series) {
  if (!/^\d{4,}$/.test(inst)) return null;
  var book = function(n) { return n.length + ':' + n.slice(0, -3); }, hits = [];
  Object.keys(series).forEach(function(id) {
    var near = series[id].filter(function(n) { return book(n) === book(inst) && n !== inst && Math.abs(+n - +inst) <= 50; });
    if (near.length) hits.push({ id: id, nums: series[id].filter(function(n) { return book(n) === book(inst); }) });
  });
  if (hits.length !== 1) return null;
  var c = (S.clients || []).find(function(x) { return String(x.id) === hits[0].id; });
  return c ? { client: c, from: hits[0].nums[0], to: hits[0].nums[hits[0].nums.length - 1] } : null;
}

/* Both ways a deposit can point at a client. When they agree, that is the offer; when they disagree,
   both are shown and nothing is placed. */
function bankPlacementOffers(row, recv, series) {
  var amount = bankSuggestClient(row.cr, recv, row.date), ser = bankSuggestBySeries(bankInstrument(row), series);
  if (amount && ser && String(amount.client.id) === String(ser.client.id)) return { both: amount.client, series: ser, amount: amount };
  return { both: null, series: ser, amount: amount };
}

/* o.id: the edit form's picker, which waits for its Save. Without it the picker is live: data-bank-client
   places the receipt the moment it changes (bankInput), so the form's picker must never carry it. */
function _bankClientSelect(v, o) {
  o = o || {};
  var attrs = o.id ? 'class="inv-select" id="' + o.id + '"' : 'class="inv-select inv-select-sm" data-bank-client="' + escHtml(v.row.id) + '" aria-label="Client"';
  return '<select ' + attrs + '><option value="">' + escHtml(o.empty || 'Client…') + '</option>' +
    (S.clients || []).slice().sort(function(a, b) { return a.name.localeCompare(b.name); }).map(function(c) {
      return '<option value="' + escHtml(String(c.id)) + '"' + (String(v.clientId) === String(c.id) ? ' selected' : '') + '>' + escHtml(c.name) + '</option>';
    }).join('') + '</select>';
}

function _bankStatementHtml(cls) {
  var q = _bankFilter.q.trim().toLowerCase();
  var list = cls.filter(function(v) {
    if (_bankFilter.cat && v.cat !== _bankFilter.cat) return false;
    return !q || (v.row.narration + ' ' + v.party + ' ' + v.row.chq).toLowerCase().indexOf(q) >= 0;
  }).reverse();
  var h = '<div class="inv-panel inv-panel-flush" id="bankStatement"><div class="inv-panel-head"><span class="inv-panel-title">Statement</span><span class="inv-panel-count">' + list.length + '</span></div>';
  if (!list.length) h += '<div class="inv-empty">No row matches.</div>';
  // The latest thirty, newest first; the rest one tap away (UX overhaul 2, step 6: the statement ran 18 phone screens).
  // The count in the head and every total read the whole statement. A row being edited is always shown.
  var rows = [];
  if (_bankEdit && list.findIndex(function(v) { return v.row.id === _bankEdit; }) >= UI_MORE_ROWS) _uiMoreShown['bank-statement'] = true;
  list.forEach(function(v) {
    var h = '';
    var r = v.row, out = r.dr > 0, title = bankRowTitle(v), who = v.cat === 'receipt' && v.clientId != null ? ((S.clients || []).find(function(c) { return String(c.id) === String(v.clientId); }) || {}).name
      : v.cat === 'wages' && v.staffId != null ? ((staffById(v.staffId) || {}).name || '') + (v.guess ? '?' : '') : '';
    h += '<div class="inv-row inv-row-2" data-bank-row="' + escHtml(r.id) + '"><button class="inv-row-main" data-action="invBankEdit" data-id="' + escHtml(r.id) + '" aria-expanded="' + (_bankEdit === r.id) + '">' +
      '<span class="inv-row-title">' + escHtml(title) + '</span>' +
      // A line naming a client or a hand wraps whole (a long name in the dot was cut on the phone, P76).
      '<span class="inv-row-meta' + (who ? ' inv-row-wrap' : '') + '">' + escHtml(formatDate(r.date)) + ' · <span class="inv-dot inv-dot-' + BANK_CAT_TONE[v.cat] + '">' + escHtml(bankCatLabel(v.cat)) + (who ? ': ' + escHtml(who) : '') + '</span>' +
      // Two facts: the day and what it is. A cheque's number is in its narration, shown when the row opens, and search finds it
      // (it had made a third on every payment by the shop's own cheques).
      (v.notCost ? ' · not a cost' : '') + (v.bounced ? ' · returned ' + escHtml(formatDate(v.bounced.date)) : '') +
      (v.bounceOf ? ' · bounce of ' + escHtml(formatDate(v.bounceOf.date)) + ' deposit' : '') + '</span></button>' +
      '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + (out ? '−' : '+') + formatCurrency(out ? r.dr : r.cr) + '</span>' +
      '<span class="inv-row-meta inv-num">' + formatCurrency(r.balance) + '</span></span></span></div>';
    rows.push({ parts: _bankEdit === r.id ? [h, _bankEditHtml(v)] : [h] });
  });
  return h + uiMoreHtml('bank-statement', rows, { noun: 'rows' }) + '</div>';
}

function _bankEditChequeText(id) {
  var ch = (bankCheques() || []).find(function(x) { return x.id === id; }), c = ch && bankChequeClient(ch);
  return ch ? 'The deposit of cheque ' + ch.number + ', received ' + formatDate(ch.receivedOn) + (c ? ' from ' + c.name : '') +
    '. Receivables → Cheques received links or unlinks it.' : '';
}
function _bankEditHtml(v) {
  // Every cheque deposit reads "Cheque deposited": a rule on that would place all of them on one client.
  var r = v.row, canRule = !!v.key && !v.cash && !bankIsChequeDeposit(r);
  // A deposit linked to a returned cheque reads as Returned, but that is the link's doing, undone under Returned
  // cheques: its form edits what the deposit is itself.
  var cat = v.bounced ? v.ownCat : v.cat;
  var h = '<div class="inv-panel-body" data-bank-edit="' + escHtml(r.id) + '"><div class="inv-row-meta">' + escHtml(r.narration) + '</div>' +
    (v.bounced ? '<div class="inv-note" data-bank-edit-bounced>Linked to the cheque returned on ' + escHtml(formatDate(v.bounced.date)) + ', so it counts as returned, not received. Receivables → Returned cheques undoes the link.</div>' : '') +
    // The deposit of a cheque recorded as received (TM3b): its client is the cheque's unless placed here by hand.
    (v.cheque ? '<div class="inv-note" data-bank-edit-cheque>' + escHtml(_bankEditChequeText(v.cheque)) + '</div>' : '') +
    '<div class="inv-fields">' +
    '<div class="inv-field"><label class="inv-field-label" for="bankEditCat">Category</label><select class="inv-select" id="bankEditCat">' +
    BANK_CATS.map(function(c) { return '<option value="' + c[0] + '"' + (cat === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div>';
  if (cat === 'receipt') h += '<div class="inv-field"><label class="inv-field-label" for="bankEditClient">Client</label>' + _bankClientSelect(v, { id: 'bankEditClient' }) + '</div>';
  if (cat === 'wages' && !v.cash) {
    h += '<div class="inv-field"><label class="inv-field-label" for="bankEditStaff">Paid to</label><select class="inv-select" id="bankEditStaff"><option value="">Nobody on the roster</option>' +
      (S.staff || []).map(function(w) { return '<option value="' + escHtml(String(w.id)) + '"' + (String(v.staffId) === String(w.id) ? ' selected' : '') + '>' + escHtml(w.name) + '</option>'; }).join('') + '</select></div>';
  }
  if (r.dr > 0) h += '<label class="inv-field-check"><input type="checkbox" class="inv-check" id="bankEditNotCost"' + (v.notCost ? ' checked' : '') + '> Not an operating cost (drawings, a loan, a transfer)</label>';
  h += '</div>' + (canRule ? '<label class="inv-field-check"><input type="checkbox" class="inv-check" id="bankEditAll" checked> Every payment ' + (r.cr > 0 ? 'from' : 'to') + ' ' + escHtml(v.party) + '</label>' : '') +
    '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankEditCancel">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invBankEditSave" data-id="' + escHtml(r.id) + '">Save</button></div></div>';
  return h;
}

/* ---------- Doing ---------- */
function bankSaveEdit(id) {
  var b = bankData(), row = b.rows.find(function(x) { return x.id === id; });
  if (!row) return;
  // The form stays as typed while the PIN is asked; given, the same Save runs and reads it.
  if (!bankGate('sort a statement row', function() { bankSaveEdit(id); })) return;
  var v = bankClassify([row])[0], val = function(i) { var el = document.getElementById(i); return el ? el.value : null; };
  var set = { cat: val('bankEditCat') || v.cat };
  var cl = val('bankEditClient'), st = val('bankEditStaff');
  if (set.cat === 'receipt' && cl != null) set.clientId = cl === '' ? null : _bankIdOf(S.clients, cl);
  if (set.cat === 'wages' && st != null) set.staffId = st === '' ? null : _bankIdOf(S.staff, st);
  var nc = document.getElementById('bankEditNotCost');
  if (nc) set.notCost = nc.checked;
  var all = document.getElementById('bankEditAll');
  // "Every payment to / from" is that direction's rule: money in and money out keep a rule each.
  if (all && all.checked && v.key && !bankIsChequeDeposit(row)) { b.parties[bankRuleKey(v.key, row)] = Object.assign(set, { dir: row.cr > 0 ? 'in' : 'out' }); delete row.set; }
  else row.set = set;
  _bankEdit = null;
  saveState();
  // Sorted from Payments' Not yet sorted: back to that list for the next payee, which is how the list is worked through
  // (it left the statement filtered to the one payee, and the list was a tab and a scroll away).
  var from = _bankSortFrom;
  _bankSortFrom = null;
  if (from && from !== 'bank') {
    _bankFilter = { cat: '', q: '' };
    finSetTab(from);
    renderFinance();
    var un = document.getElementById('bankUnsorted');
    if (un && un.scrollIntoView) try { un.scrollIntoView({ block: 'start' }); } catch (x) { /* a convenience */ }
  } else renderFinance();
  showToast(all && all.checked ? 'Saved for every row under ' + v.party : 'Saved');
}
/* The picker hands back text; ids are numbers on real books. */
function _bankIdOf(list, s) { var hit = (list || []).find(function(x) { return String(x.id) === String(s); }); return hit ? hit.id : s; }

function bankSetClient(rowId, clientId) {
  var b = bankData(), row = b.rows.find(function(x) { return x.id === rowId; });
  if (!row) return;
  // The picker is put back to what is stored while the PIN is asked; given, the placement is made.
  if (!bankGate('place a receipt', function() { bankSetClient(rowId, clientId); })) { renderFinance(); return; }
  var v = bankClassify([row])[0], id = clientId === '' ? null : _bankIdOf(S.clients, clientId);
  // A named remitter is remembered, for money in only: a rule the same party's payments have is left alone.
  // A cheque deposit has no name to remember and is kept on the row. The row's own setting would outrank the
  // rule (bankClassify), so it goes: the placement just made is the answer.
  if (v.key && !bankIsChequeDeposit(row) && row.cr > 0) { b.parties[bankRuleKey(v.key, row)] = { cat: 'receipt', clientId: id, dir: 'in' }; delete row.set; }
  else row.set = { cat: 'receipt', clientId: id };
  saveState();
  renderFinance();
}

function bankImportFile() {
  var inp = document.getElementById('bankFileInput');
  if (!inp) return;
  inp.value = '';
  inp.onchange = function(ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function(e2) { bankImportBuf(e2.target.result, f.name); };
    reader.readAsArrayBuffer(f);
  };
  inp.click();
}
/* A statement's cells, from the bank's own .xls or the same statement saved as .xlsx: known by its bytes, never its name. */
async function bankReadSheet(buf) {
  var u8 = new Uint8Array(buf, 0, Math.min(buf.byteLength, 8));
  if (u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 0x03 && u8[3] === 0x04) return xlsxRead(buf);
  if (u8.length === 8 && u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0) return xlsRead(buf);
  throw new Error('Not an Excel file: import the statement as the bank exports it (.xls), or saved from Excel (.xlsx)');
}
/* A statement's bytes, from Finance's Import or from Add → File (add.js). */
async function bankImportBuf(buf, name) {
  var res, parsed, b;
  try {
    parsed = bankParseSheet((await bankReadSheet(buf)).rows);
    b = bankData();
  } catch (err) { if (!addFileElsewhere(buf, name, 'xls')) showToast(err.message || 'That file could not be read', 'error'); return; }
  if (b.account && parsed.account && parsed.account !== b.account &&
    !(await uiConfirm({ title: 'A different account', danger: true, okLabel: 'Import into the same record',
      body: 'This statement is for account ' + parsed.account + '; the rows held are for ' + b.account + '. Imported, its rows sit in one record with them, and the balances will not follow from one another. ' +
        'It can be taken out again under Imports.' }))) return;
  try {
    res = bankImport(parsed, name);
  } catch (err) { showToast(err.message || 'That file could not be read', 'error'); return; }
  saveState();
  renderFinance();
  showToast(res.added + ' row' + (res.added === 1 ? '' : 's') + ' added' + (res.same ? ' · ' + res.same + ' already held' : ''));
}

/* The statement as a clean workbook (owner, 26 Sep 2026: "BANK Statement export should be a clean
   sorted excel file"). Oldest first, in the bank's own order inside a day, so the balance column
   reads down as the running balance it is. Dates are Excel dates and amounts are numbers, so the
   sheet sorts, filters and sums. A second sheet totals each category over the period. */
function bankExportXlsx() {
  var b = bankData(), rows = bankRows();
  if (!rows.length) { showToast('No statement to export', 'error'); return; }
  var cls = bankClassify(rows);
  var clientName = function(id) { var c = (S.clients || []).find(function(x) { return String(x.id) === String(id); }); return c ? c.name : ''; };
  var who = function(v) {
    if (v.cat === 'receipt' && v.clientId != null) return clientName(v.clientId);
    if (v.cat === 'wages' && v.staffId != null) return ((staffById(v.staffId) || {}).name || '') + (v.guess ? ' (?)' : '');
    if (v.cat === 'supplier') return v.supplier || '';
    return '';
  };
  var head = ['Date', 'Value date', 'Narration', 'Payee', 'Category', 'Client / worker', 'Cheque no.', 'Withdrawal', 'Deposit', 'Balance']
    .map(function(t) { return { v: t, s: 'head' }; });
  var data = cls.map(function(v) {
    var r = v.row;
    return [{ v: r.date, s: 'date' }, { v: r.valueDate || r.date, s: 'date' }, r.narration, v.party || '', bankCatLabel(v.cat) + (v.cash ? ' (cash)' : ''),
      who(v), r.chq || '', { v: r.dr || null, s: 'money' }, { v: r.cr || null, s: 'money' }, { v: r.balance, s: 'money' }];
  });
  var first = rows[0], last = rows[rows.length - 1], breaks = bankContinuity(rows);
  var sum = {};
  cls.forEach(function(v) {
    var k = bankCatLabel(v.cat) + (v.cash ? ' (cash)' : ''), e = sum[k] = sum[k] || { n: 0, cr: 0, dr: 0 };
    e.n++; e.cr = gstRound(e.cr + v.row.cr); e.dr = gstRound(e.dr + v.row.dr);
  });
  var keys = Object.keys(sum).sort(function(a, c) { return (sum[c].cr + sum[c].dr) - (sum[a].cr + sum[a].dr); });
  var tot = keys.reduce(function(t, k) { return { n: t.n + sum[k].n, cr: gstRound(t.cr + sum[k].cr), dr: gstRound(t.dr + sum[k].dr) }; }, { n: 0, cr: 0, dr: 0 });
  var summary = [
    [{ v: 'Bank statement', s: 'bold' }],
    ['Account', b.account || ''],
    ['From', { v: first.date, s: 'date' }],
    ['To', { v: last.date, s: 'date' }],
    ['Opening balance', { v: gstRound(first.balance + first.dr - first.cr), s: 'money' }],
    ['Closing balance', { v: last.balance, s: 'money' }],
    ['Balance check', breaks.length ? breaks.length + ' place(s) where a balance does not follow from the row before; first on ' + formatDate(breaks[0].row.date) : 'Every balance follows from the row before it'],
    [],
    ['Category', 'Rows', 'Money in', 'Money out'].map(function(t) { return { v: t, s: 'head' }; })
  ].concat(keys.map(function(k) { return [k, { v: sum[k].n, s: 'int' }, { v: sum[k].cr || null, s: 'money' }, { v: sum[k].dr || null, s: 'money' }]; }))
    .concat([[{ v: 'Total', s: 'bold' }, { v: tot.n, s: 'int' }, { v: tot.cr, s: 'boldMoney' }, { v: tot.dr, s: 'boldMoney' }]]);
  var bytes = xlsxBuild([
    { name: 'Statement', cols: [11, 11, 48, 30, 16, 24, 11, 14, 14, 15], rows: [head].concat(data), freeze: 1, filter: true },
    { name: 'Summary', cols: [22, 14, 16, 16], rows: summary }
  ]);
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = 'bank-statement-' + first.date + '-to-' + last.date + '.xlsx';
  a.click();
  showToast('Statement exported: ' + rows.length + ' rows');
}

/* The whole record for soma-internal's compile, which owns the ledger. */
function bankExportJson() {
  var b = bankData(), meta = document.querySelector('meta[name="app-build"]');
  var cls = bankClassify();
  var out = { format: 'sep-bank', version: 1, exportedAt: new Date().toISOString(), build: meta ? meta.content : '', account: b.account || '',
    imports: b.imports, parties: b.parties, opening: b.opening, gstNotes: b.gstNotes, bounces: b.bounces, cheques: b.cheques,
    rows: cls.map(function(v) { return Object.assign({}, v.row, { cat: v.cat, party: v.party, clientId: v.clientId == null ? null : v.clientId, staffId: v.staffId == null ? null : v.staffId, cash: !!v.cash }); }) };
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = 'sep-bank-' + localDateStr() + '.json';
  a.click();
  showToast('Bank exported: ' + out.rows.length + ' rows');
}

function bankInput(t) {
  if (!t) return false;
  if (t.id === 'bankCatFilter') { _bankFilter.cat = t.value; renderFinance(); return true; }
  if (t.id === 'bankSearch') {
    _bankFilter.q = t.value;
    renderFinance();
    var s = document.getElementById('bankSearch');
    if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    return true;
  }
  if (t.dataset && t.dataset.bankClient) { _bankChange = null; bankSetClient(t.dataset.bankClient, t.value); return true; }
  if (t.dataset && t.dataset.bankMonth) {
    var row = bankData().rows.find(function(x) { return x.id === t.dataset.bankMonth; }), mo = t.value;
    if (row && !bankGate('move a payment to another month', function() { t.value = mo; bankInput(t); })) { renderFinance(); return true; }
    if (row) {
      // The bill made from this payment moves with it: they are one payment, in one month.
      var bill = bankBillOf(row), twin = bill && costBills().find(function(b) { return b !== bill && b.kind === 'power' && !b.voided && b.month === t.value; });
      row.billMonth = t.value;
      if (bill) bill.month = t.value;
      saveState(); renderFinance();
      // Warn, never block: two bills for one month may be right (a split payment), and both are counted.
      if (twin) showToast('There is another electricity bill for ' + billsMonthLabel(t.value) + ': both are counted', 'error');
    }
    return true;
  }
  if (t.id === 'bankOpening') {
    // An empty field clears it; 0 is an answer (nothing was owed that day) and is kept, which stops the figure
    // offered from asking again. A 0 used to read as nothing typed.
    var raw = String(t.value).trim(), amt = gstRound(parseFloat(raw) || 0), o = bankData().opening;
    if (!bankGate('set what a client owed at the start', function() { t.value = raw; bankInput(t); })) { renderFinance(); return true; }
    if (raw !== '' && amt >= 0) o[t.dataset.client] = { amount: amt, date: bankRecvFrom(), at: Date.now() }; else delete o[t.dataset.client];
    saveState();
    renderFinance();
    return true;
  }
  if (t.id === 'bankEditCat') {
    // The client or worker picker follows the category, so redraw the form keeping the choice.
    var id = _bankEdit, r = bankData().rows.find(function(x) { return x.id === id; });
    if (!r) return true;
    var keep = r.set, v = bankClassify([r])[0];
    // The redraw rebuilds every box from the record: what was ticked but not saved is carried across, or
    // an unticked "every payment" comes back ticked and the Save that follows writes a rule for every row.
    var ticks = {};
    ['bankEditAll', 'bankEditNotCost'].forEach(function(k) { var el = document.getElementById(k); if (el) ticks[k] = el.checked; });
    r.set = Object.assign({}, v.row.set || {}, { cat: t.value });
    renderFinance();
    r.set = keep;
    Object.keys(ticks).forEach(function(k) { var el = document.getElementById(k); if (el) el.checked = ticks[k]; });
    return true;
  }
  return false;
}

function bankAction(action, btn) {
  switch (action) {
    case 'invBankImport': bankImportFile(); return true;
    case 'invBankExport': bankExportXlsx(); return true;
    case 'invBankExportJson': bankExportJson(); return true;
    case 'invBankImportRemove': bankRemoveImport(btn.dataset.id); return true;
    case 'invBankClient': _bankOpen = _bankOpen === btn.dataset.id ? null : btn.dataset.id; keepScroll(renderFinance); return true;
    case 'invBankPaneClose': _bankOpen = null; keepScroll(renderFinance); return true;
    case 'invBankAddBill': bankAddPowerBill(btn.dataset.id); return true;
    case 'invBankBounce': bankSetBounce(btn.dataset.rev, btn.dataset.dep); return true;
    case 'invBankBounceClear': bankClearBounce(btn.dataset.rev); return true;
    case 'invBankSort': _bankSortFrom = _finTab; _bankFilter = { cat: '', q: btn.dataset.q || '' }; _bankEdit = btn.dataset.id; finSetTab('bank'); renderFinance(); return true;
    case 'invBankPlace': bankSetClient(btn.dataset.id, btn.dataset.client); return true;
    case 'invBankChange': _bankChange = btn.dataset.id; renderFinance(); return true;
    case 'invBankOpeningUse': {
      if (!bankGate('set what a client owed at the start', function() { bankAction('invBankOpeningUse', btn); })) return true;
      var amt = gstRound(parseFloat(btn.dataset.amount) || 0);
      if (amt > 0) { bankData().opening[btn.dataset.client] = { amount: amt, date: bankRecvFrom(), at: Date.now(), suggested: true }; saveState(); }
      renderFinance(); return true;
    }
    case 'invBankEdit': _bankEdit = _bankEdit === btn.dataset.id ? null : btn.dataset.id; renderFinance(); return true;
    case 'invBankEditCancel': _bankEdit = null; renderFinance(); return true;
    case 'invBankEditSave': bankSaveEdit(btn.dataset.id); return true;
    case 'invBankCatClear': _bankFilter.cat = ''; renderFinance(); return true;
    // Cheques received (TM3b). A client open in the desktop's pane is the one the form starts on.
    case 'invChequeNew': bankChequeFormOpen(_bankOpen || null); return true;
    case 'invChequeSave': bankChequeSave(); return true;
    case 'invChequeOpen': bankChequeOpen(btn.dataset.id); return true;
    case 'invChequeVoid': bankChequeVoid(btn.dataset.id); return true;
    case 'invChequeLink': bankChequeSetDeposit(btn.dataset.id, btn.dataset.row); return true;
    case 'invChequeNotThis': bankChequeSetDeposit(btn.dataset.id, null); return true;
    case 'invChequeUnlink': bankChequeSetDeposit(btn.dataset.id, undefined); return true;
  }
  return false;
}
