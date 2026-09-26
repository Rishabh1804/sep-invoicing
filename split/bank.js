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
function bankIso(v) {
  var m = String(v || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
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
function bankMatchSupplier(party, keys) {
  var pk = bankKey(party);
  if (pk.length < 4) return '';
  var hit = '';
  Object.keys(keys).forEach(function(k) { if (k.length >= 4 && (pk.indexOf(k) === 0 || k.indexOf(pk) === 0)) hit = keys[k]; });
  return hit;
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

/* Worked out, then what the operator set for this payee, then for this row. */
function bankClassify(rows) {
  var b = bankData(), ctx = { suppliers: bankSupplierKeys(), roster: relayRosterIndex(S.staff || []) };
  return (rows || bankRows()).map(function(row) {
    var v = bankGuess(row, ctx), key = bankKey(v.party);
    var rule = key && !v.cash ? b.parties[key] : null;
    [rule, row.set].forEach(function(o) {
      if (!o) return;
      if (o.cat) { v.cat = o.cat; v.auto = false; }
      // A pick set back to "no client" is a decision too: it unplaces, rather than falling back to the guess.
      if ('clientId' in o) v.clientId = o.clientId == null ? null : o.clientId;
      if (o.staffId != null) { v.staffId = o.staffId; v.guess = false; }
    });
    v.row = row; v.key = key;
    return v;
  });
}

/* ---------- Receipts against invoices ---------- */
function _bankInvLabel(inv) { return inv.displayNumber || inv.invoiceNumber; }

/* Per client, from the statement's first day: what was invoiced, what was credited, what came in,
   and which invoices each receipt paid. A receipt is set against invoices EXACTLY when one open
   invoice, or a run of consecutive open ones, adds up to it within ₹1 — otherwise oldest first,
   and it says which. soma-internal's tolerant sweep hit every credit and proved nothing; a
   receipt is only ever called a match to the rupee. */
function bankReceivables(cls) {
  cls = cls || bankClassify();
  var rows = bankRows(), from = rows.length ? rows[0].date : '', b = bankData();
  var out = [];
  (S.clients || []).forEach(function(c) {
    var invs = (S.invoices || []).filter(function(i) { return i.status === 'active' && String(i.clientId) === String(c.id) && i.date >= from; })
      .sort(function(x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : String(x.invoiceNumber).localeCompare(String(y.invoiceNumber)); });
    var recs = cls.filter(function(v) { return v.cat === 'receipt' && v.clientId != null && String(v.clientId) === String(c.id); });
    var opening = gstRound(Number((b.opening[c.id] || {}).amount) || 0);
    if (!invs.length && !recs.length && !opening) return;
    var open = [];
    if (opening) open.push({ label: 'Owed at ' + formatDate(from), date: from, amount: opening, due: opening });
    invs.forEach(function(i) { open.push({ inv: i, label: _bankInvLabel(i), date: i.date, amount: gstRound(i.grandTotal || 0), due: gstRound(i.grandTotal || 0) }); });
    var notesTotal = 0, looseNotes = 0;
    getCreditNotes().forEach(function(n) {
      if (n.status === 'cancelled' || String(n.clientId) !== String(c.id) || (n.date || '') < from) return;
      var amt = gstRound(n.grandTotal || 0);
      notesTotal += amt;
      var o = open.find(function(x) { return x.inv && (x.inv.displayNumber === n.againstInvoice || x.inv.invoiceNumber === n.againstInvoice); });
      if (o) { var k = Math.min(o.due, amt); o.due = gstRound(o.due - k); amt = gstRound(amt - k); }
      looseNotes = gstRound(looseNotes + amt);
    });
    var fifo = function(amt, parts) {
      open.forEach(function(o) {
        if (amt <= 0 || o.due <= 0) return;
        var k = Math.min(o.due, amt);
        o.due = gstRound(o.due - k); amt = gstRound(amt - k);
        if (parts) parts.push({ label: o.label, amount: gstRound(k), whole: o.due === 0 });
      });
      return amt;
    };
    if (looseNotes > 0) fifo(looseNotes);
    var received = 0, allocs = [];
    recs.forEach(function(v) {
      var amt = v.row.cr, parts = [], how = 'oldest';
      received = gstRound(received + amt);
      var live = open.filter(function(o) { return o.due > 0; });
      for (var i = 0; i < live.length && how !== 'exact'; i++) {
        var sum = 0;
        for (var j = i; j < live.length && j < i + 40; j++) {
          sum = gstRound(sum + live[j].due);
          if (Math.abs(sum - amt) <= 1) {
            live.slice(i, j + 1).forEach(function(o) { parts.push({ label: o.label, amount: o.due, whole: true }); o.due = 0; });
            how = 'exact'; break;
          }
          if (sum > amt + 1) break;
        }
      }
      var left = how === 'exact' ? 0 : fifo(amt, parts);
      allocs.push({ v: v, how: how, parts: parts, unapplied: gstRound(left) });
    });
    var invoiced = gstRound(invs.reduce(function(s, i) { return s + (i.grandTotal || 0); }, 0));
    var owed = gstRound(opening + invoiced - notesTotal - received);
    var stillOpen = open.filter(function(o) { return o.due > 0.005; });
    var today = localDateStr();
    out.push({ client: c, opening: opening, invoiced: invoiced, notes: gstRound(notesTotal), received: received, owed: owed,
      open: stillOpen, allocs: allocs, oldestDays: stillOpen.length ? Math.round((new Date(today) - new Date(stillOpen[0].date)) / 86400000) : null });
  });
  return out.sort(function(a, b) { return b.owed - a.owed; });
}

/* ---------- Payments ---------- */
function bankPrevMonth(iso) {
  var d = new Date(iso.slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
/* An electricity payment settles the month before it by default (a bill is paid the month after
   it is read); the operator can say otherwise, and it is kept on the row. */
function bankBillMonth(row) { return row.billMonth || bankPrevMonth(row.date); }
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

/* ---------- Views ---------- */
/* One Finance tab: 'receipts' (Receivables), 'payments', or 'bank' (the statement itself, with its
   import and export). Receivables and Payments read the statement, so without one they say where
   to bring it in. */
function renderBank(tab) {
  var rows = bankRows();
  if (tab === 'bank') return _bankHeadHtml(rows) + (rows.length ? _bankStatementHtml(bankClassify(rows)) : '');
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
  var first = rows[0], last = rows[rows.length - 1], breaks = bankContinuity(rows);
  h += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(formatDate(first.date)) + ' – ' + escHtml(formatDate(last.date)) + '</span>' +
    '<span class="inv-row-meta">' + rows.length + ' rows' + (b.account ? ' · account ' + escHtml(b.account) : '') + ' · ' + b.imports.length + ' import' + (b.imports.length === 1 ? '' : 's') + '</span></span>' +
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

function _bankReceiptsHtml(cls) {
  var recv = bankReceivables(cls), rows = bankRows();
  var totalOwed = recv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0);
  var h = '<div class="inv-panel inv-panel-flush" id="bankReceipts"><div class="inv-panel-head"><span class="inv-panel-title">Owed by client</span>' +
    '<span class="inv-panel-count inv-num">' + formatCurrency(totalOwed) + '</span></div>' +
    '<div class="inv-panel-body inv-note">From ' + escHtml(formatDate(rows[0].date)) + ', the statement\'s first day: invoices less credit notes less receipts, ' +
    'plus whatever was owed on that day if you set it. A receipt that equals one invoice, or a run of them, to the rupee is marked exact; any other is set against the oldest first.</div>';
  if (!recv.length) h += '<div class="inv-empty">No invoices or receipts since the statement starts.</div>';
  recv.forEach(function(r) {
    var open = _bankOpen === String(r.client.id);
    h += '<div class="inv-row inv-row-2" data-recv="' + escHtml(String(r.client.id)) + '"><button class="inv-row-main inv-row-expander" aria-expanded="' + open + '" data-action="invBankClient" data-id="' + escHtml(String(r.client.id)) + '">' +
      '<span class="inv-row-title">' + escHtml(r.client.name) + '</span><span class="inv-row-meta">' +
      escHtml(formatCurrency(r.invoiced)) + ' invoiced' + (r.notes ? ' · ' + escHtml(formatCurrency(r.notes)) + ' credited' : '') + ' · ' + escHtml(formatCurrency(r.received)) + ' received' +
      (r.open.length ? ' · oldest open ' + r.oldestDays + ' d' : '') + '</span></button>' +
      '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + formatCurrency(r.owed) + '</span><span class="inv-row-meta">' + (r.owed < -0.005 ? 'paid ahead' : 'owed') + '</span></span></span></div>';
    if (!open) return;
    h += '<div class="inv-row-children">';
    if (r.owed < -0.005) h += '<div class="inv-callout inv-callout-info">More came in than was invoiced since ' + escHtml(formatDate(rows[0].date)) + '. The early receipts most likely paid invoices from before the statement: set what was owed on that day.</div>';
    h += '<div class="inv-row"><span class="inv-row-main"><label class="inv-field-label" for="bankOpening">Owed at ' + escHtml(formatDate(rows[0].date)) + '</label></span>' +
      '<span class="inv-row-end"><input class="inv-input inv-input-sm inv-num" type="number" step="0.01" min="0" inputmode="decimal" id="bankOpening" data-client="' + escHtml(String(r.client.id)) + '" value="' + (r.opening || '') + '" placeholder="0.00"></span></div>';
    r.allocs.forEach(function(a) {
      h += '<div class="inv-row inv-row-2" data-alloc="' + escHtml(a.v.row.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(formatDate(a.v.row.date)) + ' · ' +
        '<span class="inv-badge inv-badge-' + (a.how === 'exact' ? 'ok' : 'neutral') + '">' + (a.how === 'exact' ? 'Exact' : 'Oldest first') + '</span></span>' +
        '<span class="inv-row-meta">' + escHtml(a.parts.map(function(p) { return p.label + (p.whole ? '' : ' (part ' + formatCurrency(p.amount) + ')'); }).join(', ') || 'nothing open to set it against') +
        (a.unapplied > 0 ? ' · ' + escHtml(formatCurrency(a.unapplied)) + ' more than was owed' : '') + '</span></span>' +
        '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(a.v.row.cr) + '</span>' +
        (_bankChange === a.v.row.id ? _bankClientSelect(a.v).replace('<option value="">Client…</option>', '<option value="">No client</option>')
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
  var loose = cls.filter(function(v) { return v.cat === 'receipt' && v.clientId == null; }), series = bankChequeSeries(cls);
  if (loose.length) {
    h += '<div class="inv-panel inv-panel-flush" id="bankLoose"><div class="inv-panel-head"><span class="inv-panel-title">Receipts with no client</span><span class="inv-panel-count">' + loose.length + '</span></div>' +
      '<div class="inv-panel-body inv-note">Cheques deposited carry no name. Pick the client; a remitter\'s name is remembered for its next receipt.</div>';
    loose.slice().reverse().forEach(function(v) {
      var inst = bankInstrument(v.row), o = bankPlacementOffers(v.row, recv, series);
      // The cheque number is what the owner matches against the book, so it leads; a remitter's name leads where there is one.
      var chqDep = /^BY INST\b/i.test(v.row.narration) && inst;
      h += '<div class="inv-row inv-row-2" data-loose="' + escHtml(v.row.id) + '"><span class="inv-row-main"><span class="inv-row-title">' +
        (chqDep ? '<span class="inv-id">' + escHtml(inst) + '</span>' : escHtml(v.party || v.row.narration)) + '</span>' +
        '<span class="inv-row-meta">' + (chqDep ? 'Cheque · ' : '') + escHtml(formatDate(v.row.date)) + (inst && !chqDep ? ' · chq ' + escHtml(inst) : '') + '</span></span>' +
        '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(v.row.cr) + '</span>' + _bankClientSelect(v, 'bankLooseClient') + '</span></div>';
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
    });
    h += '</div>';
  }
  return h;
}

/* A cheque deposit names nobody. Where its amount equals, to the rupee, one open invoice or a run
   of one client's open invoices — and only one client's — that client is OFFERED, never placed:
   an exact sum is evidence, not a record of who wrote the cheque. */
function bankSuggestClient(amt, recv) {
  var hits = [];
  recv.forEach(function(r) {
    var open = r.open.filter(function(o) { return o.inv; });
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
    if (v.cat !== 'receipt' || v.clientId == null) return;
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
  var amount = bankSuggestClient(row.cr, recv), ser = bankSuggestBySeries(bankInstrument(row), series);
  if (amount && ser && String(amount.client.id) === String(ser.client.id)) return { both: amount.client, series: ser, amount: amount };
  return { both: null, series: ser, amount: amount };
}

function _bankClientSelect(v, cls) {
  return '<select class="inv-select inv-select-sm" data-bank-client="' + escHtml(v.row.id) + '" aria-label="Client"><option value="">Client…</option>' +
    (S.clients || []).slice().sort(function(a, b) { return a.name.localeCompare(b.name); }).map(function(c) {
      return '<option value="' + escHtml(String(c.id)) + '"' + (String(v.clientId) === String(c.id) ? ' selected' : '') + '>' + escHtml(c.name) + '</option>';
    }).join('') + '</select>';
}

function _bankPaymentsHtml(cls) {
  var h = '';
  // Electricity: each payment is a month's bill.
  var power = bankPowerRows(cls).slice().reverse();
  h += '<div class="inv-panel inv-panel-flush" id="bankPower"><div class="inv-panel-head"><span class="inv-panel-title">Electricity paid</span><span class="inv-panel-count">' + power.length + '</span></div>';
  if (!power.length) h += '<div class="inv-empty">No payment to JBVNL on the statement.</div>';
  power.forEach(function(v) {
    var m = bankBillMonth(v.row), bill = costBills().find(function(b) { return b.kind === 'power' && !b.voided && b.month === m; });
    var status = bill ? (Math.abs(bill.amount - v.row.dr) < 1 ? '<span class="inv-dot inv-dot-ok">Bill on record</span>'
      : '<span class="inv-dot inv-dot-warning">Bill on record: ' + escHtml(formatCurrency(bill.amount)) + '</span>')
      : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankAddBill" data-id="' + escHtml(v.row.id) + '">Add as bill</button>';
    var months = [0, 1, 2, 3].map(function(k) { var d = new Date(v.row.date.slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() - k); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
    h += '<div class="inv-row inv-row-2" data-power="' + escHtml(v.row.id) + '"><span class="inv-row-main"><span class="inv-row-title inv-num">' + formatCurrency(v.row.dr) + '</span>' +
      '<span class="inv-row-meta">paid ' + escHtml(formatDate(v.row.date)) + ', for the month</span></span>' +
      '<span class="inv-row-end"><select class="inv-select inv-select-sm" data-bank-month="' + escHtml(v.row.id) + '" aria-label="Bill month">' +
      months.map(function(ym) { return '<option value="' + ym + '"' + (ym === m ? ' selected' : '') + '>' + escHtml(billsMonthLabel(ym)) + '</option>'; }).join('') + '</select>' +
      status + '</span></div>';
  });
  h += '</div>';

  // Wages: named transfers against the payroll as paid, and cash against the weekly payout.
  var wages = cls.filter(function(v) { return v.cat === 'wages' && v.row.dr > 0; });
  var byMonth = {};
  wages.forEach(function(v) {
    var m = v.row.date.slice(0, 7), e = byMonth[m] = byMonth[m] || { named: {}, cash: 0, total: 0 };
    e.total = gstRound(e.total + v.row.dr);
    if (v.cash || v.staffId == null) e.cash = gstRound(e.cash + v.row.dr);
    else { var k = String(v.staffId); e.named[k] = gstRound((e.named[k] || 0) + v.row.dr); }
  });
  h += '<div class="inv-panel inv-panel-flush" id="bankWages"><div class="inv-panel-head"><span class="inv-panel-title">Wages paid</span></div>' +
    '<div class="inv-panel-body inv-note">Every cash draw (SELF, TO SELF, TO CASH) counts as wages unless a row is set otherwise. Transfers to a hand on the roster are set against the payroll as paid for the month before; cash is set against the weekly payout.</div>';
  var months = Object.keys(byMonth).sort().reverse();
  if (!months.length) h += '<div class="inv-empty">No wages on the statement.</div>';
  months.forEach(function(m) {
    var e = byMonth[m], slip = payrollPaidFor(bankPrevMonth(m + '-01')), named = Object.keys(e.named);
    h += '<div class="inv-row inv-row-group"><span class="inv-row-main">Paid in ' + escHtml(billsMonthLabel(m)) + '</span><span class="inv-row-end inv-num">' + formatCurrency(e.total) + '</span></div>';
    named.forEach(function(id) {
      var w = staffById(id) || (S.staff || []).find(function(x) { return String(x.id) === id; }) || { name: '?' };
      var row = slip ? slip.rows.find(function(r) { var pw = payrollWorker(r); return pw && String(pw.id) === id; }) : null;
      var owed = row ? gstRound(row.paid != null ? Number(row.paid) : (Number(row.dayPay) || 0) + (Number(row.ot) || 0)) : null;
      var diff = owed == null ? null : gstRound(e.named[id] - owed);
      h += '<div class="inv-row" data-wage="' + escHtml(m + ':' + id) + '"><span class="inv-row-main">' + escHtml(w.name) +
        (owed == null ? '' : Math.abs(diff) < 1 ? ' <span class="inv-dot inv-dot-ok">as the slip</span>'
          : ' <span class="inv-dot inv-dot-danger">slip ' + escHtml(formatCurrency(owed)) + ', ' + (diff > 0 ? 'over' : 'short') + ' ' + escHtml(formatCurrency(Math.abs(diff))) + '</span>') +
        '</span><span class="inv-row-end inv-num">' + formatCurrency(e.named[id]) + '</span></div>';
    });
    if (named.length && !slip) h += '<div class="inv-row"><span class="inv-row-main inv-row-meta">No payroll as paid for ' + escHtml(billsMonthLabel(bankPrevMonth(m + '-01'))) + ' to set these against.</span></div>';
    if (e.cash) h += '<div class="inv-row"><span class="inv-row-main">Cash drawn</span><span class="inv-row-end inv-num">' + formatCurrency(e.cash) + '</span></div>';
  });
  var weeks = {};
  wages.forEach(function(v) { if (v.cash) { var ws = attWeekStartOf(v.row.date); weeks[ws] = gstRound((weeks[ws] || 0) + v.row.dr); } });
  var wk = Object.keys(weeks).sort().reverse().slice(0, 12);
  if (wk.length) {
    h += '<div class="inv-row inv-row-group"><span class="inv-row-main">Cash by pay week, against the weekly payout</span></div>';
    wk.forEach(function(ws) {
      var pw = payWeek(ws), d = gstRound(weeks[ws] - pw.total);
      h += '<div class="inv-row inv-row-2" data-cashweek="' + ws + '"><span class="inv-row-main"><span class="inv-row-title">Week to ' + escHtml(formatDate(pw.sat)) + '</span>' +
        '<span class="inv-row-meta">payout ' + escHtml(formatCurrency(pw.total)) + (pw.recordedDays ? '' : ' (no attendance recorded)') + ' · ' + (d >= 0 ? 'drawn ' + formatCurrency(d) + ' more' : 'drawn ' + formatCurrency(-d) + ' less') + '</span></span>' +
        '<span class="inv-row-end inv-num">' + formatCurrency(weeks[ws]) + '</span></div>';
    });
  }
  h += '</div>';

  // Suppliers, and everything else by category.
  var sup = {};
  cls.forEach(function(v) { if (v.cat === 'supplier' && v.row.dr > 0) { var k = v.party || v.row.narration; (sup[k] = sup[k] || { paid: 0, n: 0, name: v.supplier || v.party }); sup[k].paid = gstRound(sup[k].paid + v.row.dr); sup[k].n++; } });
  var billed = {};
  (stockData().entries || []).forEach(function(e) { if (!e.voided && e.supplier && e.amount) billed[bankKey(e.supplier)] = gstRound((billed[bankKey(e.supplier)] || 0) + Number(e.amount)); });
  var sk = Object.keys(sup).sort(function(a, b) { return sup[b].paid - sup[a].paid; });
  h += '<div class="inv-panel inv-panel-flush" id="bankSuppliers"><div class="inv-panel-head"><span class="inv-panel-title">Suppliers paid</span><span class="inv-panel-count">' + sk.length + '</span></div>';
  if (!sk.length) h += '<div class="inv-empty">No payment matched to a stock supplier. Set a payee to Supplier on the statement and it is remembered.</div>';
  sk.forEach(function(k) {
    var s = sup[k], key = Object.keys(billed).find(function(bk) { var pk = bankKey(k); return bk.length >= 4 && (pk.indexOf(bk) === 0 || bk.indexOf(pk) === 0); });
    h += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(k) + '</span><span class="inv-row-meta">' + s.n + ' payment' + (s.n === 1 ? '' : 's') +
      (key ? ' · stock bills recorded ' + escHtml(formatCurrency(billed[key])) : ' · no stock bills recorded') + '</span></span><span class="inv-row-end inv-num">' + formatCurrency(s.paid) + '</span></div>';
  });
  h += '</div>';
  var tot = {};
  cls.forEach(function(v) { if (['gst', 'tax', 'charges', 'other'].indexOf(v.cat) >= 0 && v.row.dr > 0) tot[v.cat] = gstRound((tot[v.cat] || 0) + v.row.dr); });
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
  list.forEach(function(v) {
    var r = v.row, out = r.dr > 0, who = v.cat === 'receipt' && v.clientId != null ? ((S.clients || []).find(function(c) { return String(c.id) === String(v.clientId); }) || {}).name
      : v.cat === 'wages' && v.staffId != null ? ((staffById(v.staffId) || {}).name || '') + (v.guess ? '?' : '') : '';
    h += '<div class="inv-row inv-row-2" data-bank-row="' + escHtml(r.id) + '"><button class="inv-row-main" data-action="invBankEdit" data-id="' + escHtml(r.id) + '" aria-expanded="' + (_bankEdit === r.id) + '">' +
      '<span class="inv-row-title">' + escHtml(v.party || r.narration) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(formatDate(r.date)) + ' · <span class="inv-dot inv-dot-' + BANK_CAT_TONE[v.cat] + '">' + escHtml(bankCatLabel(v.cat)) + (who ? ': ' + escHtml(who) : '') + '</span>' +
      (r.chq ? ' · chq ' + escHtml(r.chq) : '') + '</span></button>' +
      '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + (out ? '−' : '+') + formatCurrency(out ? r.dr : r.cr) + '</span>' +
      '<span class="inv-row-meta inv-num">' + formatCurrency(r.balance) + '</span></span></span></div>';
    if (_bankEdit === r.id) h += _bankEditHtml(v);
  });
  return h + '</div>';
}

function _bankEditHtml(v) {
  var r = v.row, canRule = !!v.key && !v.cash;
  var h = '<div class="inv-panel-body" data-bank-edit="' + escHtml(r.id) + '"><div class="inv-row-meta">' + escHtml(r.narration) + '</div><div class="inv-fields">' +
    '<div class="inv-field"><label class="inv-field-label" for="bankEditCat">Category</label><select class="inv-select" id="bankEditCat">' +
    BANK_CATS.map(function(c) { return '<option value="' + c[0] + '"' + (v.cat === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div>';
  if (v.cat === 'receipt') h += '<div class="inv-field"><label class="inv-field-label" for="bankEditClient">Client</label>' + _bankClientSelect(v).replace('<select class="inv-select inv-select-sm"', '<select class="inv-select" id="bankEditClient"') + '</div>';
  if (v.cat === 'wages' && !v.cash) {
    h += '<div class="inv-field"><label class="inv-field-label" for="bankEditStaff">Paid to</label><select class="inv-select" id="bankEditStaff"><option value="">Nobody on the roster</option>' +
      (S.staff || []).map(function(w) { return '<option value="' + escHtml(String(w.id)) + '"' + (String(v.staffId) === String(w.id) ? ' selected' : '') + '>' + escHtml(w.name) + '</option>'; }).join('') + '</select></div>';
  }
  h += '</div>' + (canRule ? '<label class="inv-check"><input type="checkbox" id="bankEditAll" checked> Every payment ' + (r.cr > 0 ? 'from' : 'to') + ' ' + escHtml(v.party) + '</label>' : '') +
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
  var all = document.getElementById('bankEditAll');
  if (all && all.checked && v.key) { b.parties[v.key] = set; delete row.set; }
  else row.set = set;
  _bankEdit = null;
  saveState();
  renderFinance();
  showToast(all && all.checked ? 'Saved for every row under ' + v.party : 'Saved');
}
/* The picker hands back text; ids are numbers on real books. */
function _bankIdOf(list, s) { var hit = (list || []).find(function(x) { return String(x.id) === String(s); }); return hit ? hit.id : s; }

function bankSetClient(rowId, clientId) {
  var b = bankData(), row = b.rows.find(function(x) { return x.id === rowId; });
  if (!row) return;
  var v = bankClassify([row])[0], id = clientId === '' ? null : _bankIdOf(S.clients, clientId);
  // A named remitter is remembered; a cheque deposit has no name to remember and is kept on the row.
  if (v.key && !/^BY INST\b/i.test(row.narration)) b.parties[v.key] = { cat: 'receipt', clientId: id };
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
    reader.onload = function(e2) {
      var res;
      try {
        var parsed = bankParseSheet(xlsRead(e2.target.result).rows);
        var b = bankData();
        if (b.account && parsed.account && parsed.account !== b.account &&
          !confirm('This statement is for account ' + parsed.account + '; the rows held are for ' + b.account + '. Import it into the same record?')) return;
        res = bankImport(parsed, f.name);
      } catch (err) { showToast(err.message || 'That file could not be read', 'error'); return; }
      saveState();
      renderFinance();
      showToast(res.added + ' row' + (res.added === 1 ? '' : 's') + ' added' + (res.same ? ' · ' + res.same + ' already held' : ''));
    };
    reader.readAsArrayBuffer(f);
  };
  inp.click();
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
    imports: b.imports, parties: b.parties, opening: b.opening, gstNotes: b.gstNotes,
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
    if (row) { row.billMonth = t.value; saveState(); renderFinance(); }
    return true;
  }
  if (t.id === 'bankOpening') {
    var amt = gstRound(parseFloat(t.value) || 0), o = bankData().opening;
    if (amt > 0) o[t.dataset.client] = { amount: amt, at: Date.now() }; else delete o[t.dataset.client];
    saveState();
    renderFinance();
    return true;
  }
  if (t.id === 'bankEditCat') {
    // The client or worker picker follows the category, so redraw the form keeping the choice.
    var id = _bankEdit, r = bankData().rows.find(function(x) { return x.id === id; });
    if (!r) return true;
    var keep = r.set, v = bankClassify([r])[0];
    r.set = Object.assign({}, v.row.set || {}, { cat: t.value });
    renderFinance();
    r.set = keep;
    return true;
  }
  return false;
}

function bankAction(action, btn) {
  switch (action) {
    case 'invBankImport': bankImportFile(); return true;
    case 'invBankExport': bankExportXlsx(); return true;
    case 'invBankExportJson': bankExportJson(); return true;
    case 'invBankClient': _bankOpen = _bankOpen === btn.dataset.id ? null : btn.dataset.id; renderFinance(); return true;
    case 'invBankAddBill': bankAddPowerBill(btn.dataset.id); return true;
    case 'invBankPlace': bankSetClient(btn.dataset.id, btn.dataset.client); return true;
    case 'invBankChange': _bankChange = btn.dataset.id; renderFinance(); return true;
    case 'invBankEdit': _bankEdit = _bankEdit === btn.dataset.id ? null : btn.dataset.id; renderFinance(); return true;
    case 'invBankEditCancel': _bankEdit = null; renderFinance(); return true;
    case 'invBankEditSave': bankSaveEdit(btn.dataset.id); return true;
  }
  return false;
}
