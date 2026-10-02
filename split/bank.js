/* ===== BANK (Finance → Receivables, Payments, Bank) =====
 * The bank statement read in the app (owner, 26 Sep 2026: "We have the bank statement as well
 * right? There is no way to read it in the app yet"). Three jobs, all three asked for:
 *   - RECEIPTS: which invoices each customer credit pays, and what each customer still owes;
 *   - PAYMENTS: electricity paid becomes the month's bill, wages are set against Pay, suppliers
 *     against the stock bills;
 *   - STATEMENT: the ledger itself, every row with a category.
 *
 * The file is the bank's own export (Bank of Baroda OpTransactionHistoryUX5.xls), read as it is
 * by xls.js. Rows are kept in S.bank.rows, merged by id — a hash of the row's own fields, balance
 * included, so the same row in two overlapping statements is one row. The bank writes newest
 * first; `dayIdx` keeps its order inside a day, because two rows of one day sorted by amount
 * would publish the wrong closing balance (soma-internal's 20-Aug ingest did, by ₹1,20,000).
 *
 * A category is WORKED OUT from the narration each time it is read, then overridden by what the
 * operator set: for one row (`row.set`) or for everybody paid under that name (`S.bank.parties`).
 * Every SELF / TO SELF / TO CASH draw is wages (owner, 26 Sep 2026: "All kind of Self should also
 * count towards wages, unless stated otherwise") — a row set to another category says otherwise.
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
    var bal = bankBalance(row[col.balance]);
    if (bal == null) throw new Error('Row ' + (r + 1) + ': the balance "' + row[col.balance] + '" cannot be read');
    out.push({ date: date, valueDate: bankIso(row[col.valueDate]) || date, narration: String(row[col.narration] || '').trim(),
      chq: String(row[col.chq] == null ? '' : row[col.chq]).trim(), dr: bankAmount(row[col.dr]), cr: bankAmount(row[col.cr]), balance: bal });
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
  return bankLinkBounces(out);
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
function bankSetBounce(revId, depId) {
  bankData().bounces[revId] = depId || null;
  saveState();
  renderFinance();
}
function bankClearBounce(revId) {
  delete bankData().bounces[revId];
  saveState();
  renderFinance();
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
  (S.clients || []).forEach(function(c) {
    var invs = (S.invoices || []).filter(function(i) { return i.status === 'active' && String(i.clientId) === String(c.id) && i.date >= from; })
      .sort(function(x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : String(x.invoiceNumber).localeCompare(String(y.invoiceNumber)); });
    var recs = cls.filter(function(v) { return v.cat === 'receipt' && v.clientId != null && String(v.clientId) === String(c.id) && v.row.date >= from; });
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
    out.push({ client: c, opening: opening, openingSet: op.set, openingStale: op.stale, openingSuggest: op.set ? null : bankOpeningSuggest(recs, invs, from),
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
function bankCostByMonth(cls) {
  cls = cls || bankClassify();
  var cover = bankCover(), out = {};
  var at = function(ym) { return out[ym] || (out[ym] = { labour: { amount: 0, named: 0, cash: 0, rows: [] }, power: { amount: 0, rows: [] }, other: { amount: 0, rows: [] }, supplies: { amount: 0, rows: [] }, unsorted: { amount: 0, rows: [] } }); };
  cls.forEach(function(v) {
    if (!bankIsCost(v)) return;
    var r = v.row;
    if (v.cat === 'wages') {
      if (!v.cash && v.staffId != null) {
        var L = at(bankPrevMonth(r.date)).labour;
        L.amount += r.dr; L.named += r.dr; L.rows.push(v);
      } else {
        var ws = attWeekStartOf(r.date), seen = {};
        for (var k = 0; k < 7; k++) {
          var d = attParseIso(ws); d.setDate(d.getDate() + k);
          var C = at(isoOf(d).slice(0, 7)).labour;
          C.amount += r.dr / 7; C.cash += r.dr / 7;
          if (!seen[isoOf(d).slice(0, 7)]) { seen[isoOf(d).slice(0, 7)] = 1; C.rows.push(v); }
        }
      }
    } else if (v.cat === 'power') { var P = at(bankBillMonth(r)).power; P.amount += r.dr; P.rows.push(v); }
    else if (v.cat === 'supplier') { var U = at(r.date.slice(0, 7)).supplies; U.amount += r.dr; U.rows.push(v); }
    // "Other" only because nothing recognised the payee is UNSORTED, not a cost: on the real statement
    // that residue is mostly the zinc and chemical traders, at four times the other-cost model.
    else if (v.cat === 'other' && v.auto) { var X = at(r.date.slice(0, 7)).unsorted; X.amount += r.dr; X.rows.push(v); }
    else { var O = at(r.date.slice(0, 7)).other; O.amount += r.dr; O.rows.push(v); }
  });
  return { months: out, cover: cover };
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
  return k === 'labour' && c.to < bankNextMonth(ym) + '-20' ? 'its salaries are not on the statement yet' : '';
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
      res[k].months.push({ month: ym, share: share, rangeShare: rangeShare, amount: (c ? c.amount : 0) * share, whole: c ? c.amount : 0, named: c && c.named || 0, cash: c && c.cash || 0, rows: c ? c.rows : [] });
    });
  }
  return res;
}

/* ---------- Views ---------- */
/* One Finance tab: 'receipts' (Receivables), 'payments', or 'bank' (the statement itself, with its
   import and export). Receivables and Payments read the statement, so without one they say where
   to bring it in. */
function renderBank(tab) {
  var rows = bankRows();
  if (tab === 'bank') return _bankHeadHtml(rows) + _bankImportsHtml() + (rows.length ? _bankStatementHtml(bankClassify(rows)) : '');
  if (!rows.length) {
    return '<div class="inv-panel"><div class="inv-empty">' + (tab === 'payments' ? 'Payments read' : 'Receivables read') +
      ' the bank statement, and none is imported yet. <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invBankImport">Import the statement</button></div></div>';
  }
  var cls = bankClassify(rows);
  return tab === 'payments' ? _bankPaymentsHtml(cls) : _bankReceiptsHtml(cls);
}

function _bankHeadHtml(rows) {
  var b = bankData();
  var h = '<div class="inv-panel inv-panel-flush" id="bankHead"><div class="inv-panel-head"><span class="inv-panel-title">Bank statement</span>' +
    '<span class="inv-toolbar inv-toolbar-tight">' + (rows.length ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankExport">Export Excel</button>' : '') +
    '<button class="inv-btn ' + (rows.length ? 'inv-btn-secondary' : 'inv-btn-primary') + ' inv-btn-sm" data-action="invBankImport">Import</button></span>' +
    '</div>';
  if (!rows.length) {
    return h + '<div class="inv-empty">No statement yet. Download the account statement from Bank of Baroda as Excel (.xls) and import it as it is; ' +
      'a later statement that overlaps it adds only the rows that are new.</div></div>';
  }
  var first = rows[0], last = rows[rows.length - 1], breaks = bankContinuity(rows), liveImports = b.imports.filter(function(x) { return !x.removedAt; }).length;
  h += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(formatDate(first.date)) + ' – ' + escHtml(formatDate(last.date)) + '</span>' +
    '<span class="inv-row-meta">' + rows.length + ' rows' + (b.account ? ' · account ' + escHtml(b.account) : '') + ' · ' + liveImports + ' import' + (liveImports === 1 ? '' : 's') + '</span></span>' +
    '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + formatCurrency(last.balance) + '</span><span class="inv-row-meta">closing balance</span></span></span></div>';
  if (breaks.length) {
    var br = breaks[0];
    h += '<div class="inv-panel-body"><div class="inv-callout inv-callout-warning" data-bank-breaks="' + breaks.length + '">' + breaks.length + ' place' + (breaks.length === 1 ? '' : 's') +
      ' where the balance does not follow from the row before. First: ' + escHtml(formatDate(br.row.date)) + ', ' + escHtml(formatCurrency(br.expected)) +
      ' expected, ' + escHtml(formatCurrency(br.row.balance)) + ' on the statement. Rows are missing between two statements, or a statement is incomplete.</div></div>';
  } else {
    h += '<div class="inv-panel-body inv-note" data-bank-breaks="0">Every balance follows from the row before it, first row to last.</div>';
  }
  h += '<div class="inv-row"><span class="inv-row-main inv-row-meta">The record for the soma-internal compile</span>' +
    '<span class="inv-row-end"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invBankExportJson">Export JSON</button></span></div>';
  return h + '</div>';
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
      return '<div class="inv-row inv-row-2" data-bank-import="' + escHtml(imp.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(imp.file || 'Statement') + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">' + escHtml((imp.from ? formatDate(imp.from) + ' – ' + formatDate(imp.to) + ' · ' : '') + (imp.rows || 0) + ' rows read · ' + (imp.added || 0) + ' added · imported ' + day(imp.at)) +
        (gone ? ' · <span class="inv-dot inv-dot-neutral">Removed ' + escHtml(day(imp.removedAt)) + '</span> ' + escHtml((imp.rowsRemoved || 0) + ' rows taken out: ' + (imp.removeReason || '')) : '') + '</span></span>' +
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

function _bankReceiptsHtml(cls) {
  var recv = bankReceivables(cls), rows = bankRows(), from = bankRecvFrom(rows), fromTxt = escHtml(formatDate(from));
  var totalOwed = recv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0);
  var h = '<div class="inv-panel inv-panel-flush" id="bankReceipts"><div class="inv-panel-head"><span class="inv-panel-title">Owed by client</span>' +
    '<span class="inv-panel-count inv-num">' + formatCurrency(totalOwed) + '</span></div>' +
    '<div class="inv-panel-body inv-note">From ' + fromTxt + (from === rows[0].date ? ', the statement\'s first day' :
      ', the first invoice in the book (the statement starts ' + escHtml(formatDate(rows[0].date)) + '; receipts before ' + fromTxt + ' paid invoices this app does not hold, and are left out)') +
    ': invoices less credit notes less receipts, plus whatever was owed on that day if you set it. A receipt that equals one invoice, or a run of them, to the rupee is marked exact; any other is set against the oldest first.</div>';
  var sgN = recv.filter(function(r) { return r.openingSuggest; }).length;
  if (sgN) h += '<div class="inv-callout inv-callout-info" data-opening-hint="' + sgN + '">' + todoPlural(sgN, 'client') + ' paid money in the first weeks that most likely settled work from before ' + fromTxt +
    '. Open ' + (sgN === 1 ? 'it' : 'each') + ' to check the figure offered for what ' + (sgN === 1 ? 'it' : 'each') + ' owed on that day.</div>';
  if (!recv.length) h += '<div class="inv-empty">No invoices or receipts since ' + fromTxt + '.</div>';
  var payHist = bankPayHistory(recv);
  recv.forEach(function(r) {
    var open = _bankOpen === String(r.client.id), dtp = bankDaysToPay(r.client.id, payHist);
    h += '<div class="inv-row inv-row-2" data-recv="' + escHtml(String(r.client.id)) + '"><button class="inv-row-main inv-row-expander" aria-expanded="' + open + '" data-action="invBankClient" data-id="' + escHtml(String(r.client.id)) + '">' +
      '<span class="inv-row-title">' + escHtml(r.client.name) + '</span><span class="inv-row-meta inv-row-wrap">' +
      escHtml(formatCurrency(r.invoiced)) + ' invoiced' + (r.notes ? ' · ' + escHtml(formatCurrency(r.notes)) + ' credited' : '') + ' · ' + escHtml(formatCurrency(r.received)) + ' received' +
      (r.open.length ? ' · oldest open ' + r.oldestDays + ' d' : '') + (r.onAccount > 0.005 ? ' · ' + escHtml(formatCurrency(r.onAccount)) + ' on account' : '') + (Math.abs(r.rounding) > 0.005 ? ' · ' + escHtml(formatCurrency(Math.abs(r.rounding))) + ' rounded off' : '') + (r.openingSuggest ? ' · owed at start not set' : '') +
      (dtp && dtp.median != null ? ' · pays in ' + figHtml(Math.round(dtp.median) + ' d', figTonePaysIn(dtp.median)) + (dtp.n < 3 ? ' (' + dtp.n + ' receipt' + (dtp.n === 1 ? '' : 's') + ')' : '') : '') + '</span></button>' +
      // Owed is coloured by how old its oldest open invoice is, and the word under it says so.
      '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + figHtml(formatCurrency(r.owed), r.owed > 0.005 ? figToneAge(r.oldestDays) : null) + '</span><span class="inv-row-meta">' +
      (r.owed < -0.005 ? 'paid ahead' : r.owed > 0.005 && r.oldestDays > 90 ? 'owed, over 90 d' : r.owed > 0.005 && r.oldestDays > 60 ? 'owed, over 60 d' : 'owed') + '</span></span></span></div>';
    if (!open) return;
    h += '<div class="inv-row-children">';
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
      h += '<div class="inv-row inv-row-2" data-alloc="' + escHtml(a.v.row.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(formatDate(a.v.row.date)) + ' · ' +
        '<span class="inv-badge inv-badge-' + (a.how === 'exact' ? 'ok' : 'neutral') + '">' + (a.how === 'exact' ? 'Exact' : 'Oldest first') + '</span></span>' +
        '<span class="inv-row-meta">' + escHtml(a.parts.map(function(p) { return p.label + (p.whole ? '' : ' (part ' + formatCurrency(p.amount) + ')'); }).join(', ') || 'nothing open to set it against') +
        (a.unapplied > 0 ? ' · ' + escHtml(formatCurrency(a.unapplied)) + (a.parts.length ? ' more than was open by then' : ' with nothing open by then') : '') + '</span></span>' +
        '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(a.v.row.cr) + '</span>' +
        (_bankChange === a.v.row.id ? _bankClientSelect(a.v, { empty: 'No client' })
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
    h += '</div>';
  });
  h += '</div>';
  // Receipts nobody can name: cheques deposited, a remitter the client list does not recognise.
  var loose = bankLooseReceipts(cls, from), series = bankChequeSeries(cls);
  var early = cls.filter(function(v) { return v.cat === 'receipt' && v.clientId == null && v.row.cr > 0 && v.row.date < from; }).length;
  if (early) h += '<div class="inv-panel-body inv-note" data-loose-early="' + early + '">' + todoPlural(early, 'receipt') + ' with no client from before ' + fromTxt +
    ' ' + (early === 1 ? 'is' : 'are') + ' not listed: ' + (early === 1 ? 'it' : 'they') + ' paid invoices from before the book starts. Place one from the Statement if you want its cheque in a client\'s series.</div>';
  if (loose.length) {
    h += '<div class="inv-panel inv-panel-flush" id="bankLoose"><div class="inv-panel-head"><span class="inv-panel-title">Receipts with no client</span><span class="inv-panel-count">' + loose.length + '</span></div>' +
      '<div class="inv-panel-body inv-note">Cheques deposited carry no name. Pick the client; a remitter\'s name is remembered for its next receipt.</div>';
    // The latest ten, newest first; the rest one tap away (UX overhaul 2, step 6: this list ran three phone screens).
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
      // Each offer is a line of its own under the cheque, its button at the row's end: inside the
      // one-line meta it was clipped by the ellipsis on a phone and could not be tapped.
      var offer = function(c, why, text) {
        return '<div class="inv-row inv-row-2" data-offer="' + escHtml(v.row.id) + '" data-why="' + why + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(c.name) + '</span>' +
          '<span class="inv-row-meta">' + escHtml(text) + '</span></span>' +
          '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankPlace" data-id="' + escHtml(v.row.id) + '" data-client="' + escHtml(String(c.id)) + '" data-why="' + why + '" aria-label="Place with ' + escHtml(c.name) + '">Place</button></span></div>';
      };
      if (o.both) h += '<div class="inv-row-children">' + offer(o.both, 'both', 'series and amount agree') + '</div>';
      else if (o.series || o.amount) {
        h += '<div class="inv-row-children">' +
          (o.series ? offer(o.series.client, 'series', 'series ' + o.series.from + '–' + o.series.to) : '') +
          (o.amount ? offer(o.amount.client, 'amount', 'equals ' + o.amount.labels.join(' + ')) : '') + '</div>';
      }
      if (h) parts.push(h);
      looseRows.push({ parts: parts });
    });
    h += uiMoreHtml('bank-loose', looseRows, { n: 10, noun: 'receipts' }) + '</div>';
  }
  return h + _bankBouncesHtml(cls);
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

function _bankPaymentsHtml(cls) {
  var h = '';
  // Electricity: each payment is a month's bill.
  var power = bankPowerRows(cls).slice().reverse();
  h += '<div class="inv-panel inv-panel-flush" id="bankPower"><div class="inv-panel-head"><span class="inv-panel-title">Electricity paid <span class="inv-panel-count">' + power.length + '</span></span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invGoBills">Open Bills &amp; notes</button></div>';
  if (!power.length) h += '<div class="inv-empty">No payment to JBVNL on the statement.</div>';
  power.forEach(function(v) {
    // The bill made from this payment first; else any bill for its month, typed by hand or made from another payment.
    var m = bankBillMonth(v.row), bill = bankBillOf(v.row) || costBills().find(function(b) { return b.kind === 'power' && !b.voided && b.month === m; });
    var status = bill ? (Math.abs(bill.amount - v.row.dr) < 1 ? '<span class="inv-dot inv-dot-ok">Bill on record</span>'
      : '<span class="inv-dot inv-dot-warning">Bill on record: ' + escHtml(formatCurrency(bill.amount)) + '</span>')
      : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankAddBill" data-id="' + escHtml(v.row.id) + '">Add as bill</button>';
    var months = [v.row.date.slice(0, 7)];
    while (months.length < 4) months.push(bankPrevMonth(months[months.length - 1]));
    h += '<div class="inv-row inv-row-2" data-power="' + escHtml(v.row.id) + '"><span class="inv-row-main"><span class="inv-row-title inv-num">' + formatCurrency(v.row.dr) + '</span>' +
      '<span class="inv-row-meta">paid ' + escHtml(formatDate(v.row.date)) + ', for the month</span></span>' +
      '<span class="inv-row-end"><select class="inv-select inv-select-sm" data-bank-month="' + escHtml(v.row.id) + '" aria-label="Bill month">' +
      months.map(function(ym) { return '<option value="' + ym + '"' + (ym === m ? ' selected' : '') + '>' + escHtml(billsMonthLabel(ym)) + '</option>'; }).join('') + '</select>' +
      status + '</span></div>';
  });
  h += '</div>';

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
  var sk = Object.keys(sup).sort(function(a, b) { return sup[b].paid - sup[a].paid; });
  h += '<div class="inv-panel inv-panel-flush" id="bankSuppliers"><div class="inv-panel-head"><span class="inv-panel-title">Suppliers paid <span class="inv-panel-count">' + sk.length + '</span></span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invGoStock">Open Stock</button></div>';
  if (!sk.length) h += '<div class="inv-empty">No payment matched to a stock supplier. Set a payee to Supplier on the statement and it is remembered.</div>';
  sk.forEach(function(k) {
    var s = sup[k], key = Object.keys(billed).find(function(bk) { return bankSupplierIs(s.written, bk); });
    h += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(k) + '</span><span class="inv-row-meta">' + s.n + ' payment' + (s.n === 1 ? '' : 's') +
      (key ? ' · stock bills recorded ' + escHtml(formatCurrency(billed[key])) : ' · no stock bills recorded') + '</span></span><span class="inv-row-end inv-num">' + formatCurrency(s.paid) + '</span></div>';
  });
  h += '</div>';
  // Payees read as "other" only because nothing recognised them: until each is set once, the live
  // cost counts them as neither supplier nor cost, and says so.
  var uns = {};
  cls.forEach(function(v) {
    if (v.cat !== 'other' || !v.auto || !(v.row.dr > 0)) return;
    var k = v.party || v.row.narration, u = uns[k] || (uns[k] = { paid: 0, n: 0, last: v.row });
    u.paid = gstRound(u.paid + v.row.dr); u.n++; if (v.row.date >= u.last.date) u.last = v.row;
  });
  var uk = Object.keys(uns).sort(function(a, b) { return uns[b].paid - uns[a].paid; });
  if (uk.length) {
    h += '<div class="inv-panel inv-panel-flush" id="bankUnsorted"><div class="inv-panel-head"><span class="inv-panel-title">Not yet sorted</span><span class="inv-panel-count">' + uk.length + '</span></div>' +
      '<div class="inv-panel-body inv-note">Nothing recognised these payees, so the live cost counts them as neither supplier nor cost. Set each once: Supplier, Other, or not a cost.</div>';
    uk.forEach(function(k) {
      var u = uns[k];
      h += '<div class="inv-row inv-row-2" data-unsorted="' + escHtml(k) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(k) + '</span><span class="inv-row-meta">' + u.n + ' payment' + (u.n === 1 ? '' : 's') + ' · last ' + escHtml(formatDate(u.last.date)) + '</span></span>' +
        '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(u.paid) + '</span><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankSort" data-id="' + escHtml(u.last.id) + '" data-q="' + escHtml(k) + '">Sort</button></span></div>';
    });
    h += '</div>';
  }
  var tot = {};
  cls.forEach(function(v) { if (['gst', 'tax', 'charges', 'other'].indexOf(v.cat) >= 0 && v.row.dr > 0 && !(v.cat === 'other' && v.auto)) tot[v.cat] = gstRound((tot[v.cat] || 0) + v.row.dr); });
  h += '<div class="inv-panel inv-panel-flush" id="bankOther"><div class="inv-panel-head"><span class="inv-panel-title">Everything else paid</span></div>';
  ['gst', 'tax', 'charges', 'other'].forEach(function(k) {
    if (tot[k]) h += '<div class="inv-row"><span class="inv-row-main">' + escHtml(bankCatLabel(k)) + '</span><span class="inv-row-end inv-num">' + formatCurrency(tot[k]) + '</span></div>';
  });
  if (!Object.keys(tot).length) h += '<div class="inv-empty">Nothing else.</div>';
  return h + '</div>';
}

function _bankStatementHtml(cls) {
  var q = _bankFilter.q.trim().toLowerCase();
  var list = cls.filter(function(v) {
    if (_bankFilter.cat && v.cat !== _bankFilter.cat) return false;
    return !q || (v.row.narration + ' ' + v.party + ' ' + v.row.chq).toLowerCase().indexOf(q) >= 0;
  }).reverse();
  var h = '<div class="inv-panel inv-panel-flush" id="bankStatement"><div class="inv-panel-head"><span class="inv-panel-title">Statement</span><span class="inv-panel-count">' + list.length + '</span></div>' +
    '<div class="inv-panel-body inv-toolbar"><select class="inv-select inv-toolbar-item" id="bankCatFilter" aria-label="Category"><option value="">Every category</option>' +
    BANK_CATS.map(function(c) { return '<option value="' + c[0] + '"' + (_bankFilter.cat === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select>' +
    '<input class="inv-input inv-toolbar-item" type="search" id="bankSearch" placeholder="Search narration" value="' + escHtml(_bankFilter.q) + '"></div>';
  if (!list.length) h += '<div class="inv-empty">No row matches.</div>';
  // The latest thirty, newest first; the rest one tap away (UX overhaul 2, step 6: the statement ran 18 phone screens).
  // The count in the head and every total read the whole statement. A row being edited is always shown.
  var rows = [];
  if (_bankEdit && list.findIndex(function(v) { return v.row.id === _bankEdit; }) >= UI_MORE_ROWS) _uiMoreShown['bank-statement'] = true;
  list.forEach(function(v) {
    var h = '';
    var r = v.row, out = r.dr > 0, who = v.cat === 'receipt' && v.clientId != null ? ((S.clients || []).find(function(c) { return String(c.id) === String(v.clientId); }) || {}).name
      : v.cat === 'wages' && v.staffId != null ? ((staffById(v.staffId) || {}).name || '') + (v.guess ? '?' : '') : '';
    h += '<div class="inv-row inv-row-2" data-bank-row="' + escHtml(r.id) + '"><button class="inv-row-main" data-action="invBankEdit" data-id="' + escHtml(r.id) + '" aria-expanded="' + (_bankEdit === r.id) + '">' +
      '<span class="inv-row-title">' + escHtml(v.party || r.narration) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(formatDate(r.date)) + ' · <span class="inv-dot inv-dot-' + BANK_CAT_TONE[v.cat] + '">' + escHtml(bankCatLabel(v.cat)) + (who ? ': ' + escHtml(who) : '') + '</span>' +
      (r.chq ? ' · chq ' + escHtml(r.chq) : '') + (v.notCost ? ' · not a cost' : '') + (v.bounced ? ' · returned ' + escHtml(formatDate(v.bounced.date)) : '') +
      (v.bounceOf ? ' · bounce of ' + escHtml(formatDate(v.bounceOf.date)) + ' deposit' : '') + '</span></button>' +
      '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + (out ? '−' : '+') + formatCurrency(out ? r.dr : r.cr) + '</span>' +
      '<span class="inv-row-meta inv-num">' + formatCurrency(r.balance) + '</span></span></span></div>';
    rows.push({ parts: _bankEdit === r.id ? [h, _bankEditHtml(v)] : [h] });
  });
  return h + uiMoreHtml('bank-statement', rows, { noun: 'rows' }) + '</div>';
}

function _bankEditHtml(v) {
  // Every cheque deposit reads "Cheque deposited": a rule on that would place all of them on one client.
  var r = v.row, canRule = !!v.key && !v.cash && !bankIsChequeDeposit(r);
  // A deposit linked to a returned cheque reads as Returned, but that is the link's doing, undone under Returned
  // cheques: its form edits what the deposit is itself.
  var cat = v.bounced ? v.ownCat : v.cat;
  var h = '<div class="inv-panel-body" data-bank-edit="' + escHtml(r.id) + '"><div class="inv-row-meta">' + escHtml(r.narration) + '</div>' +
    (v.bounced ? '<div class="inv-note" data-bank-edit-bounced>Linked to the cheque returned on ' + escHtml(formatDate(v.bounced.date)) + ', so it counts as returned, not received. Receivables → Returned cheques undoes the link.</div>' : '') +
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
/* A statement's bytes, from Finance's Import or from Add → File (add.js). */
async function bankImportBuf(buf, name) {
  var res, parsed, b;
  try {
    parsed = bankParseSheet(xlsRead(buf).rows);
    b = bankData();
  } catch (err) { showToast(err.message || 'That file could not be read', 'error'); return; }
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
    imports: b.imports, parties: b.parties, opening: b.opening, gstNotes: b.gstNotes, bounces: b.bounces,
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
    var row = bankData().rows.find(function(x) { return x.id === t.dataset.bankMonth; });
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
    case 'invBankClient': _bankOpen = _bankOpen === btn.dataset.id ? null : btn.dataset.id; renderFinance(); return true;
    case 'invBankAddBill': bankAddPowerBill(btn.dataset.id); return true;
    case 'invBankBounce': bankSetBounce(btn.dataset.rev, btn.dataset.dep); return true;
    case 'invBankBounceClear': bankClearBounce(btn.dataset.rev); return true;
    case 'invBankSort': _bankSortFrom = _finTab; _bankFilter = { cat: '', q: btn.dataset.q || '' }; _bankEdit = btn.dataset.id; finSetTab('bank'); renderFinance(); return true;
    case 'invBankPlace': bankSetClient(btn.dataset.id, btn.dataset.client); return true;
    case 'invBankChange': _bankChange = btn.dataset.id; renderFinance(); return true;
    case 'invBankOpeningUse': {
      var amt = gstRound(parseFloat(btn.dataset.amount) || 0);
      if (amt > 0) { bankData().opening[btn.dataset.client] = { amount: amt, date: bankRecvFrom(), at: Date.now(), suggested: true }; saveState(); }
      renderFinance(); return true;
    }
    case 'invBankEdit': _bankEdit = _bankEdit === btn.dataset.id ? null : btn.dataset.id; renderFinance(); return true;
    case 'invBankEditCancel': _bankEdit = null; renderFinance(); return true;
    case 'invBankEditSave': bankSaveEdit(btn.dataset.id); return true;
  }
  return false;
}
