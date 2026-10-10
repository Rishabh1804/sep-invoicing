/**
 * suppliers.js — Suppliers: what is owed to each, and how long each takes to deliver.
 *
 * Owner, 10 Oct 2026, of one supplier: "Balance payment remaining from us to <it>, no way to record this in the app"; of the
 * lead times: none for three of them, and "3-4 working days for material to be delivered if ordered through <another>, they
 * offer a cheaper price but the material comes from Kolkata". Nothing about a supplier is in the build: the book names them
 * (the stock bills' company, the statement's payees), and what the owner sets on one is a record of the book (S.suppliers).
 *
 * - A supplier is every spelling that names it: "&" is AND and BROS is BROTHERS when names are compared (suppKey), and any
 *   other spelling (the bank's, a short form) is added to it once. A payee whose initials are a supplier's short name is
 *   offered as the same supplier, never taken unseen.
 * - A bill is the stock entries of one invoice (its company, number and date). Its total is the lines before GST with the
 *   supplier's GST, rounded to the rupee as the paper is, unless its total was set as printed. One number on two days is said:
 *   one of them may be typed wrong.
 * - A payment is a debit on the statement read as theirs, or one recorded here (cash, a cheque handed over, a transfer). A
 *   cheque recorded here is the statement's row of its number once that clears: one payment, on the day it was handed over,
 *   which is the day the supplier's own book credits it. A transfer recorded here is the statement's row of the same amount
 *   within a week.
 * - The balance counts from what was owed at the end of a day, typed off their statement: the bills after it, less the
 *   payments after it. A payment the statement shows after that day which their figure already counts is marked so. With
 *   none set, nothing is said to be owed (unknown is not nothing); the bills and payments are still listed.
 * - What is still unpaid is read oldest first: the payments settle the balance set first, then each bill in turn.
 * - Each supplier's lead time, in working days, feeds the reorder list (cost.js): when to order, and whether the cheaper
 *   supplier can still deliver before the line runs out.
 */

var SUPP_GST = 18;               // a supplier's GST on its bills, %, until set on it (the chemicals and the zinc are at 18)
var SUPP_OWED_DAYS = 30;         // the To-do names a balance whose oldest unpaid part is this many days old
var SUPP_PRICE_DAYS = 180;       // a supplier's last price older than this is not set against another's
var SUPP_NEAR_DAYS = 30;         // a statement payment this close after the balance's day can be marked as in it
var SUPP_NO_NUMBER = /^(NA|N\/A|NIL|NONE|-+|\?+|0+)$/;
var _suppMemo = null;            // { S, w (the book's saves), v: the index }, for one turn
var _suppOpenId = null;          // the supplier open in its dialog
var _suppForm = '';              // the form open in it: pay | balance | set

function suppData() { if (!Array.isArray(S.suppliers)) S.suppliers = []; return S.suppliers; }
function suppPays() { if (!Array.isArray(S.supplierPays)) S.supplierPays = []; return S.supplierPays; }
function suppUid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function suppBy() { return typeof grdUserId === 'function' ? grdUserId() : null; }

/* A name as compared: "&" is AND, BROS is BROTHERS, PVT and LTD in full, M/S left out; letters only, as the bank's payee
   key is (bankKey), so "<A> & BROTHERS" on a bill and "<A> AND BROTHERS" on the statement are one supplier. */
function suppKey(s) {
  return relayKey(String(s || '').toUpperCase().replace(/&/g, ' AND ').replace(/\bM\s*\/\s*S\b\.?/g, ' ')
    .replace(/\bBROS\b\.?/g, ' BROTHERS ').replace(/\bPVT\b\.?/g, ' PRIVATE ').replace(/\bLTD\b\.?/g, ' LIMITED '));
}
/* A name's initials, AND, OF and THE left out: three words or more make a short form a bill may be written under. */
function suppInitials(s) {
  var w = String(s || '').toUpperCase().split(/[^A-Z]+/).filter(function(x) { return x && !/^(AND|OF|THE)$/.test(x); });
  return w.length >= 3 ? w.map(function(x) { return x[0]; }).join('') : '';
}
/* A bill's number as compared: spaces out, leading zeros of a number out ("06" is 6); NA and the like are no number. */
function suppNoKey(no) {
  var s = String(no == null ? '' : no).trim().toUpperCase().replace(/\s+/g, '');
  return !s || SUPP_NO_NUMBER.test(s) ? '' : s.replace(/^0+(?=\d)/, '');
}
function suppByDate(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }
/* The statement's rows as read (finintel.js finCtx, worked out once a turn). */
function suppCls() { return typeof finCtx === 'function' ? finCtx().cls : (bankRows().length ? bankClassify(bankRows()) : []); }

/* ---------- The suppliers, their bills and their payments ---------- */
/* Worked out from the book once a save: { list, byId, byKey, find(name) }. Each supplier: { id (its record's, or k:<key> for
   one the book names that nobody has set anything on), rec, name, names, keys, bills, bank (the statement's payments read as
   theirs), hand (recorded here), cleared (a hand payment's id → the statement row it cleared as), pays (the ledger's payments) }. */
function suppIndex() {
  var w = typeof _bookWrites === 'number' ? _bookWrites : 0;
  if (_suppMemo && _suppMemo.S === S && _suppMemo.w === w) return _suppMemo.v;
  // Kept for the turn, as the statement's reading is (finCtx): a figure changed in place before its save is read afresh next turn.
  Promise.resolve().then(function() { _suppMemo = null; });
  var list = [], byId = {}, byKey = {};
  var mk = function(id, rec, name) { return { id: id, rec: rec, name: name, names: [], keys: [], bills: [], bank: [], hand: [], cleared: {}, pays: [] }; };
  var add = function(sp) { list.push(sp); byId[sp.id] = sp; return sp; };
  var name = function(sp, s) {
    s = String(s || '').trim();
    if (!s) return;
    if (sp.names.indexOf(s) < 0) sp.names.push(s);
    [suppKey(s), bankKey(s)].forEach(function(k) { if (k && sp.keys.indexOf(k) < 0) { sp.keys.push(k); if (!byKey[k]) byKey[k] = sp; } });
  };
  var find = function(s) { return byKey[suppKey(s)] || byKey[bankKey(s)] || null; };
  // The owner's records first: each holds every spelling it was given.
  suppData().forEach(function(r) {
    if (!r || !r.id || !String(r.name || '').trim() || byId[r.id]) return;
    var sp = add(mk(r.id, r, String(r.name).trim()));
    [r.name].concat(Array.isArray(r.names) ? r.names : []).forEach(function(s) { name(sp, s); });
  });
  // Every other company on a stock bill, by its name as compared.
  var entries = stockData().entries;
  entries.forEach(function(e) {
    var s = String(e.supplier || '').trim();
    if (!s || e.voided) return;
    var sp = find(s);
    if (!sp) { var k = suppKey(s); if (!k) return; sp = add(mk('k:' + k, null, s)); }
    name(sp, s);
  });
  // The bills: one invoice is its company, its number and its date.
  var bills = {};
  entries.forEach(function(e) {
    if (e.voided || !(e.kind === 'received' || e.kind === 'bill')) return;
    var sp = find(e.supplier);
    if (!sp) return;
    var date = /^\d{4}-\d{2}-\d{2}$/.test(e.billDate || '') ? e.billDate : e.date, nk = suppNoKey(e.billNo);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return;
    var key = (nk || '-') + '|' + date, bk = sp.id + '|' + key;
    var b = bills[bk] || (bills[bk] = { sp: sp, key: key, no: String(e.billNo == null ? '' : e.billNo).trim(), nk: nk, date: date, lines: [], base: 0, unpriced: 0, twice: 0, twins: [] });
    var amt = typeof e.amount === 'number' && isFinite(e.amount) ? e.amount : e.price > 0 && e.qty > 0 ? gstRound(e.price * e.qty) : null;
    // A delivery and its own bill typed again: the same line, quantity and price on one bill counts once.
    if (b.lines.some(function(l) { return l.e.itemId === e.itemId && l.e.qty === e.qty && l.e.price === e.price && l.e.kind !== e.kind; })) { b.twice++; return; }
    b.lines.push({ e: e, amount: amt });
    if (amt == null) b.unpriced++; else b.base = gstRound(b.base + amt);
  });
  Object.keys(bills).forEach(function(k) {
    var b = bills[k], sp = b.sp, set = sp.rec && sp.rec.totals ? sp.rec.totals[b.key] : null;
    b.gst = suppGst(sp);
    b.calc = gstRound(b.base * (1 + b.gst / 100), 0);
    b.typed = typeof set === 'number' && isFinite(set) && set >= 0;
    b.total = b.typed ? set : b.calc;
    sp.bills.push(b);
  });
  // The statement's payments: a debit set to Supplier is its named supplier's; one whose payee names nobody yet is a supplier of
  // its own, by the payee's name. Every cheque number on a debit, for a cheque recorded here to clear against.
  var cls = suppCls(), chq = {};
  cls.forEach(function(v) {
    if (!(v.row.dr > 0)) return;
    var c = bankChequeKey(v.row.chq);
    if (c) (chq[c] = chq[c] || []).push(v);
    if (v.cat !== 'supplier') return;
    var sp = (v.supplier && find(v.supplier)) || suppMatchWritten(v, list);
    if (!sp) {
      // The payee, or the narration where the bank wrote none the reader knows (bankSupplierWritten's rule).
      var nm = String(v.party || v.row.narration || '').trim(), pk = suppKey(nm);
      if (pk.length < 4) return;
      sp = byKey[pk] || add(mk('k:' + pk, null, nm));
      name(sp, nm);
    }
    sp.bank.push(v);
  });
  suppPays().forEach(function(p) { if (p && p.id && byId[p.supplierId]) byId[p.supplierId].hand.push(p); });
  list.forEach(function(sp) {
    sp.bills.sort(suppByDate);
    // One number on two days: one of them may be typed wrong.
    var byNo = {};
    sp.bills.forEach(function(b) { if (b.nk) (byNo[b.nk] = byNo[b.nk] || []).push(b); });
    Object.keys(byNo).forEach(function(n) {
      var g = byNo[n];
      if (g.length > 1) g.forEach(function(b) { b.twins = g.filter(function(x) { return x !== b; }).map(function(x) { return x.date; }); });
    });
    // A cheque recorded here clears as the statement's row of its number; one with no number, or a transfer, as the row of the
    // same amount soon after. A row clears one payment.
    var claimed = {};
    sp.hand.slice().sort(suppByDate).forEach(function(p) {
      if (p.voidedAt || p.how === 'cash') return;
      var c = bankChequeKey(p.chq), from = isoAddDays(p.date, -3), hit = null;
      if (p.how === 'cheque' && c) hit = (chq[c] || []).find(function(v) { return !claimed[v.row.id] && v.row.date >= from && (v.cat !== 'supplier' || sp.bank.indexOf(v) >= 0); }) || null;
      if (!hit) {
        var to = isoAddDays(p.date, p.how === 'cheque' ? 45 : 7);
        hit = sp.bank.filter(function(v) { return !claimed[v.row.id] && Math.abs(v.row.dr - Number(p.amount)) < 0.5 && v.row.date >= isoAddDays(p.date, -2) && v.row.date <= to; })
          .sort(function(a, b) { return Math.abs(isoDaysBetween(p.date, a.row.date)) - Math.abs(isoDaysBetween(p.date, b.row.date)); })[0] || null;
      }
      if (hit) { claimed[hit.row.id] = p.id; sp.cleared[p.id] = hit; }
    });
    sp.pays = sp.hand.filter(function(p) { return !p.voidedAt; }).map(function(p) {
      return { kind: 'hand', id: p.id, date: p.date, amount: Number(p.amount) || 0, p: p, cleared: sp.cleared[p.id] || null };
    }).concat(sp.bank.filter(function(v) { return !claimed[v.row.id]; }).map(function(v) {
      return { kind: 'bank', id: v.row.id, date: v.row.date, amount: v.row.dr, v: v };
    })).sort(suppByDate);
  });
  var v = { list: list, byId: byId, byKey: byKey, find: find };
  _suppMemo = { S: S, w: w, v: v };
  return v;
}
/* The supplier a payment set to Supplier by a rule names, read as every supplier figure reads it (bankSupplierIs): the longest
   name that fits wins. */
function suppMatchWritten(v, list) {
  var w = [bankSupplierWritten(v), suppKey(v.party || '')].filter(function(x) { return x && x.length >= 4; });
  var best = null, len = 0;
  list.forEach(function(sp) {
    sp.keys.forEach(function(k) { if (k.length > len && w.some(function(x) { return bankSupplierIs(x, k); })) { best = sp; len = k.length; } });
  });
  return best;
}
function suppById(id) { return id ? suppIndex().byId[id] || null : null; }
function suppOfName(name) { return name ? suppIndex().find(name) : null; }

function suppLead(sp) {
  var r = sp && sp.rec;
  if (!r || typeof r.leadMax !== 'number' || !(r.leadMax >= 0)) return null;
  return { min: typeof r.leadMin === 'number' && r.leadMin >= 0 && r.leadMin <= r.leadMax ? r.leadMin : r.leadMax, max: r.leadMax };
}
/* A lead time in words: "same day", "3–4 working days"; `says` makes it a phrase of its own ("delivers the same day"), for a
   line that does not name it. */
function suppLeadText(lead, says) {
  if (!lead) return 'lead time not set';
  if (!lead.max) return says ? 'delivers the same day' : 'same day';
  var t = (lead.min !== lead.max ? lead.min + '–' + lead.max : String(lead.max)) + ' working day' + (lead.min === lead.max && lead.max === 1 ? '' : 's');
  return says ? 'delivers in ' + t : t;
}
function suppGst(sp) { var g = sp && sp.rec ? sp.rec.gstPct : null; return typeof g === 'number' && g >= 0 && g <= 28 ? g : SUPP_GST; }
/* A day so many working days on, Sundays out (the shop's own count, as days left are). */
function suppAddWorkingDays(iso, n) {
  var d = iso, k = 0;
  while (k < n) { d = isoAddDays(d, 1); if (new Date(d + 'T00:00:00').getDay() !== 0) k++; }
  return d;
}
function suppBillName(b) { return b.no && b.nk ? 'Bill ' + b.no : 'Bill, no number'; }
function suppPayName(p) {
  if (p.kind === 'bank') {
    var c = bankChequeKey(p.v.row.chq);
    return /MICR|CLG|CHQ|CHEQUE/i.test(p.v.row.narration || '') && c ? 'Cheque ' + p.v.row.chq : 'Paid from the bank';
  }
  var q = p.p;
  return q.how === 'cash' ? 'Cash' : q.how === 'transfer' ? 'Transfer' + (q.chq ? ' ' + q.chq : '') : 'Cheque' + (q.chq ? ' ' + q.chq : '');
}

/* ---------- The balance ---------- */
/* { op (the balance set: {amount, date}), lines (bills and payments by date), before, after (those the balance counts), balance
   (null with none set), billed, paid (after the day), open ([{kind, date, amount, left, b}] still unpaid, oldest first), oldest,
   ahead (paid past everything) }. A bill comes before a payment on its day. */
function suppLedger(sp) {
  var r = sp.rec, op = r && r.opening && /^\d{4}-\d{2}-\d{2}$/.test(r.opening.date || '') && typeof r.opening.amount === 'number' && isFinite(r.opening.amount) ? r.opening : null;
  var inOp = {};
  ((r && Array.isArray(r.inOpening)) ? r.inOpening : []).forEach(function(id) { inOp[id] = true; });
  var lines = sp.bills.map(function(b) { return { kind: 'bill', date: b.date, amount: b.total, b: b, id: 'bill|' + b.key }; })
    .concat(sp.pays.map(function(p) { return { kind: 'pay', date: p.date, amount: p.amount, pay: p, id: p.kind + '|' + p.id }; }));
  lines.sort(function(a, b) { return suppByDate(a, b) || (a.kind === 'bill' ? 0 : 1) - (b.kind === 'bill' ? 0 : 1); });
  var out = { op: op, lines: lines, before: [], after: [], balance: null, billed: 0, paid: 0, open: [], oldest: null, ahead: 0 };
  if (!op) { out.after = lines; return out; }
  lines.forEach(function(l) {
    var counted = l.date > op.date && !(l.kind === 'pay' && l.pay.kind === 'bank' && inOp[l.pay.id]);
    (counted ? out.after : out.before).push(l);
  });
  var bal = op.amount;
  out.after.forEach(function(l) {
    if (l.kind === 'bill') { bal = gstRound(bal + l.amount); out.billed = gstRound(out.billed + l.amount); }
    else { bal = gstRound(bal - l.amount); out.paid = gstRound(out.paid + l.amount); }
    l.bal = bal;
  });
  out.balance = bal;
  var owed = [{ kind: 'opening', date: op.date, amount: op.amount, left: Math.max(0, op.amount) }].concat(out.after.filter(function(l) { return l.kind === 'bill'; })
    .map(function(l) { return { kind: 'bill', date: l.date, amount: l.amount, left: l.amount, b: l.b }; }));
  var pay = gstRound(out.paid + Math.max(0, -op.amount));
  owed.forEach(function(o) { var t = Math.min(o.left, pay); o.left = gstRound(o.left - t); pay = gstRound(pay - t); });
  out.ahead = pay;
  out.open = owed.filter(function(o) { return o.left >= 0.5; });
  out.oldest = out.open[0] || null;
  return out;
}
/* Every supplier the book names, with its balance: what is owed first, the largest first; then those with none set, the latest
   bill first. */
function suppRows() {
  return suppIndex().list.filter(function(sp) { return sp.rec || sp.bills.length || sp.pays.length; }).map(function(sp) {
    return { sp: sp, L: suppLedger(sp), lead: suppLead(sp), last: sp.bills.length ? sp.bills[sp.bills.length - 1] : null };
  }).sort(function(a, b) {
    var as = a.L.balance != null, bs = b.L.balance != null;
    if (as !== bs) return as ? -1 : 1;
    if (as) return b.L.balance - a.L.balance;
    var ad = a.last ? a.last.date : '', bd = b.last ? b.last.date : '';
    return ad < bd ? 1 : ad > bd ? -1 : a.sp.name.localeCompare(b.sp.name);
  });
}
function suppTotals() {
  var rows = suppRows(), owed = 0, set = 0;
  rows.forEach(function(x) { if (x.L.balance != null) { set++; if (x.L.balance > 0) owed = gstRound(owed + x.L.balance); } });
  return { rows: rows, owed: owed, set: set, unset: rows.length - set };
}
function suppAgeDays(iso) { return Math.max(0, isoDaysBetween(iso, localDateStr())); }
/* The oldest still unpaid, in one fact (a row's meta holds two). */
function suppOldestText(L) {
  var o = L.oldest;
  if (!o) return L.ahead > 0 ? 'paid ahead' : 'nothing unpaid';
  return 'unpaid from ' + stockShortDate(o.date) + ', ' + todoPlural(suppAgeDays(o.date), 'day');
}
/* A payee read as Other only because nothing recognised it, whose initials are a supplier's short name: offered as that supplier. */
function suppInitialsOffer(party) {
  var ini = suppInitials(party);
  if (ini.length < 3) return null;
  return suppIndex().list.find(function(sp) { return sp.names.some(function(n) { return relayKey(n) === ini && String(n).replace(/[^A-Za-z]/g, '').length <= 5; }); }) || null;
}

/* ---------- Payments: the suppliers' card ---------- */
/* Money → Payments' fold: a supplier a row, what is owed and since when, its lead time; the row opens the supplier. */
function suppPanelHtml() {
  var t = suppTotals(), money = typeof grdSeesMoney !== 'function' || grdSeesMoney();
  var h = '<div class="inv-panel inv-panel-flush" id="bankSuppliers"><div class="inv-panel-head"><span class="inv-panel-title">Suppliers <span class="inv-panel-count">' + t.rows.length + '</span></span>' +
    (t.set && money ? '<span class="inv-dot inv-dot-' + (t.owed > 0 ? 'warning' : 'ok') + '" data-supp-owed-all="' + t.owed + '">' + escHtml(t.owed > 0 ? finRs(t.owed) + ' owed' : 'nothing owed') + '</span>' : '') + '</div>';
  if (!t.rows.length) h += '<div class="inv-empty">No supplier yet: a stock bill names its company, and a payment set to Supplier on the statement its payee.</div>';
  h += uiMoreHtml('supp-rows', t.rows.map(function(x) {
    var L = x.L, set = L.balance != null;
    var meta = [set ? suppOldestText(L) : x.last ? 'last bill ' + stockShortDate(x.last.date) : todoPlural(x.sp.pays.length, 'payment'), suppLeadText(x.lead, true)];
    var end = set ? (money ? '<span class="inv-row-end inv-num">' + figHtml(escHtml(formatCurrency(Math.abs(L.balance))), L.balance < 0 ? null : L.oldest && suppAgeDays(L.oldest.date) > SUPP_OWED_DAYS ? 'warning' : null) + (L.balance < 0 ? ' ahead' : '') + '</span>' : '')
      : '<span class="inv-row-end"><span class="inv-dot inv-dot-neutral">No balance set</span></span>';
    return '<div class="inv-row inv-row-2" data-supplier="' + escHtml(x.sp.id) + '"><button type="button" class="inv-row-main" data-action="invSuppOpen" data-id="' + escHtml(x.sp.id) + '">' +
      '<span class="inv-row-title">' + escHtml(x.sp.name) + '</span><span class="inv-row-meta">' + escHtml(meta.join(' · ')) + '</span></button>' + end + '</div>';
  }), { n: 8, noun: 'suppliers' });
  // Its door to the stock bills, a row of its own at its foot (a button in its head would keep it from folding).
  h += '<div class="inv-row"><span class="inv-row-main inv-row-meta">The bills are kept on each stock line</span><span class="inv-row-end">' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invGoStock">Open Stock</button></span></div>';
  return h + '</div>';
}

/* Stock → Spend and prices: the supplier tapped on the pie, its lead time and what is owed (to a role that sees money), and its door. */
function suppSpendRowHtml(sp) {
  var L = suppLedger(sp), money = typeof grdSeesMoney !== 'function' || grdSeesMoney();
  var sub = suppLeadText(suppLead(sp), true) + (money && L.balance != null ? ', ' + (L.balance > 0.5 ? finRs(L.balance) + ' owed' : L.balance < -0.5 ? 'paid ahead' : 'nothing owed') : '');
  return '<div class="inv-row inv-row-2" data-supp-spend="' + escHtml(sp.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(sp.name) + '</span><span class="inv-row-meta">' + escHtml(sub) + '</span></span>' +
    '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invSuppOpen" data-id="' + escHtml(sp.id) + '">Open</button></span></div>';
}

/* ---------- The supplier, in a dialog ---------- */
function suppOpen(id, form) {
  var sp = suppById(id);
  if (!sp) { showToast('That supplier is no longer in the book', 'error'); return; }
  _suppOpenId = sp.id;
  _suppForm = form || '';
  var html = suppDialogHtml(sp), open = document.querySelector('[data-supp-dialog]');
  if (open) {
    var sc = open.closest('.inv-scrim-dialog');
    if (sc) { delete sc.dataset.typed; sc.innerHTML = html; focusFirstInteractive(sc.querySelector('.inv-dialog')); return; }
  }
  dialogOpen(html, { dismiss: true });
}
/* Redrawn where it stands once something in it changed (a save, a void): the record may have been made since, so it is found by
   its name when its id has moved. */
function suppRedraw(id) {
  var sp = suppById(id) || suppById(_suppOpenId);
  if (navPageOf() === 'pageFinance' && typeof renderFinance === 'function') keepScroll(renderFinance);
  else if (navPageOf() === 'pageStock' && typeof renderStock === 'function') keepScroll(renderStock);
  if (sp && document.querySelector('[data-supp-dialog]')) suppOpen(sp.id, _suppForm);
}
function suppDialogClose() {
  var el = document.querySelector('[data-supp-dialog]'), sc = el && el.closest('.inv-scrim-dialog');
  if (!sc) return;
  delete sc.dataset.typed;
  dialogCloseScrim(sc);
}
/* A fact of the dialog: a figure at the row's end in the figures' face (uiFactRowHtml), or words there in the text's. */
function suppFactHtml(f) {
  if (!('words' in f)) return uiFactRowHtml(f);
  return '<div class="inv-row' + (f.sub ? ' inv-row-2' : '') + '"' + (f.attrs || '') + '><span class="inv-row-main"><span class="inv-row-title">' + escHtml(f.label) + '</span>' +
    (f.sub ? '<span class="inv-row-meta">' + escHtml(f.sub) + '</span>' : '') + '</span>' + (f.words ? '<span class="inv-row-end">' + escHtml(f.words) + '</span>' : '') + '</div>';
}
function suppField(id, label, control, wide) {
  return '<label class="inv-field' + (wide ? ' inv-kv-wide' : '') + '"><span class="inv-field-label">' + label + '</span>' + control + '</label>';
}
function suppDialogHtml(sp) {
  var L = suppLedger(sp), lead = suppLead(sp), money = typeof grdSeesMoney !== 'function' || grdSeesMoney();
  var h = '<div class="inv-dialog" data-supp-dialog="' + escHtml(sp.id) + '">' + dialogHeadHtml(escHtml(sp.name));
  if (_suppForm === 'pay') return h + suppPayFormHtml(sp) + '</div>';
  if (_suppForm === 'balance') return h + suppBalanceFormHtml(sp, L) + '</div>';
  if (_suppForm === 'set') return h + suppSetFormHtml(sp, lead) + '</div>';
  // What it comes to.
  var facts = [];
  if (!money) facts.push({ label: 'Owed', words: '', sub: 'what is owed is shown to a role that sees money' });
  else if (L.op) facts.push({ label: L.balance < 0 ? 'Paid ahead' : 'Owed', value: formatCurrency(Math.abs(L.balance)), tone: L.balance > 0 && L.oldest && suppAgeDays(L.oldest.date) > SUPP_OWED_DAYS ? 'warning' : null,
    sub: formatCurrency(L.op.amount) + ' owed on ' + formatDate(L.op.date) + ', bills ' + finRs(L.billed) + ', paid ' + finRs(L.paid) + ' since', attrs: ' data-supp-owed="' + L.balance + '"' });
  else facts.push({ label: 'Owed', words: 'not set', sub: 'what was owed on a day, from their statement', attrs: ' data-supp-owed=""' });
  if (money && L.op) {
    var nb = L.open.filter(function(o) { return o.kind === 'bill'; }).length, part = L.open.some(function(o) { return o.kind === 'opening'; });
    facts.push({ label: 'Unpaid', words: L.open.length ? (part ? 'the balance set' + (nb ? ' and ' + todoPlural(nb, 'bill') : '') : todoPlural(nb, 'bill')) : 'nothing', sub: suppOldestText(L), attrs: ' data-supp-oldest' });
  }
  facts.push({ label: 'Lead time', words: suppLeadText(lead), sub: lead ? 'from the order to the goods, Sundays out' : 'the reorder list uses its own until set', attrs: ' data-supp-lead' });
  facts.push({ label: 'GST on its bills', value: suppGst(sp) + '%', sub: 'each bill rounded to the rupee' });
  if (sp.names.length > 1) facts.push({ label: 'Also written', words: '', sub: sp.names.filter(function(n) { return n !== sp.name; }).join(', ') });
  if (sp.rec && sp.rec.note) facts.push({ label: 'Note', words: '', sub: sp.rec.note });
  h += '<div class="inv-panel inv-panel-flush" data-supp-facts>' + facts.map(suppFactHtml).join('') + '</div>';
  if (money) h += suppLedgerHtml(sp, L);
  var foot = '<button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Close</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invSuppForm" data-form="set">Change</button>' +
    (money ? '<button class="inv-btn inv-btn-secondary" data-action="invSuppForm" data-form="balance">' + (L.op ? 'Set the balance again' : 'Set the balance') + '</button>' +
      '<button class="inv-btn inv-btn-primary" data-action="invSuppForm" data-form="pay">Record a payment</button>' : '');
  return h + '<div class="inv-dialog-foot">' + foot + '</div></div>';
}
/* The ledger, the latest first: each bill and payment with the balance after it; those before the balance's day folded. */
function suppLedgerHtml(sp, L) {
  var near = L.op ? isoAddDays(L.op.date, SUPP_NEAR_DAYS) : '';
  var row = function(l, counted) {
    var attrs = ' data-supp-line="' + escHtml(l.id) + '"';
    if (l.kind === 'bill') {
      var b = l.b, meta = [stockShortDate(b.date), finRs(b.base) + ' + ' + b.gst + '% GST' + (b.typed ? ', total as printed' : '') + (b.unpriced ? ', ' + todoPlural(b.unpriced, 'line') + ' with no price' : '')];
      var flag = b.twins.length ? '<span class="inv-dot inv-dot-warning" data-supp-twin>' + escHtml('Same number on ' + b.twins.map(stockShortDate).join(', ')) + '</span>' : '';
      return '<div class="inv-row inv-row-2' + (counted ? '' : ' inv-row-muted') + '"' + attrs + '><button type="button" class="inv-row-main" data-action="invSuppBillTotal" data-id="' + escHtml(sp.id) + '" data-key="' + escHtml(b.key) + '" aria-label="' + escHtml(suppBillName(b) + ': set its total as printed') + '">' +
        '<span class="inv-row-title">' + escHtml(suppBillName(b) + ' · ' + todoPlural(b.lines.length, 'line')) + '</span><span class="inv-row-meta">' + escHtml(meta.join(' · ')) + '</span></button>' +
        '<span class="inv-row-end inv-row-end-stack"><span class="inv-num">' + escHtml(formatCurrency(b.total)) + '</span>' + (flag || (counted && l.bal != null ? '<span class="inv-row-meta inv-num">' + escHtml('owed ' + finRs(l.bal)) + '</span>' : '')) + '</span></div>';
    }
    var p = l.pay, meta2 = [stockShortDate(p.date)];
    if (p.kind === 'hand') meta2.push((p.cleared ? 'cleared ' + stockShortDate(p.cleared.row.date) : p.p.how === 'cash' ? 'recorded here' : 'not on the statement yet') + (p.p.note ? ', ' + p.p.note : ''));
    else meta2.push('on the statement');
    var acts = [];
    if (p.kind === 'hand') acts.push('<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invSuppVoidPay" data-id="' + escHtml(p.id) + '">Void</button>');
    else if (L.op && p.date > L.op.date && p.date <= near) acts.push('<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invSuppInOpening" data-id="' + escHtml(sp.id) + '" data-row="' + escHtml(p.id) + '">' + (counted ? 'In their balance' : 'Count it') + '</button>');
    return '<div class="inv-row inv-row-2' + (acts.length ? ' inv-row-flow' : '') + (counted ? '' : ' inv-row-muted') + '"' + attrs + '><span class="inv-row-main"><span class="inv-row-title">' + escHtml(suppPayName(p)) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(meta2.join(' · ')) + '</span></span>' +
      '<span class="inv-row-end' + (acts.length ? ' inv-row-actions' : ' inv-row-end-stack') + '"><span class="inv-num">' + escHtml('−' + formatCurrency(p.amount)) + '</span>' +
      (acts.length ? acts.join('') : counted && l.bal != null ? '<span class="inv-row-meta inv-num">' + escHtml('owed ' + finRs(l.bal)) + '</span>' : '') + '</span></div>';
  };
  var after = L.after.slice().reverse(), before = L.before.slice().reverse();
  var h = '<div class="inv-panel inv-panel-flush" data-supp-ledger><div class="inv-panel-head"><span class="inv-panel-title">' + (L.op ? 'Since ' + escHtml(formatDate(L.op.date)) : 'Bills and payments') +
    ' <span class="inv-panel-count">' + after.length + '</span></span></div>';
  if (!after.length) h += '<div class="inv-empty">' + (L.op ? 'Nothing since: what is owed is the balance set.' : 'No bill or payment on record.') + '</div>';
  h += uiMoreHtml('supp-ledger-' + sp.id, after.map(function(l) { return row(l, !!L.op); }), { n: 12, noun: 'lines' });
  if (L.op) h += '<div class="inv-row" data-supp-opening><span class="inv-row-main"><span class="inv-row-title">Owed on ' + escHtml(formatDate(L.op.date)) + '</span>' +
    (L.op.note ? '<span class="inv-row-meta">' + escHtml(L.op.note) + '</span>' : '') + '</span><span class="inv-row-end inv-num">' + escHtml(formatCurrency(L.op.amount)) + '</span></div>';
  h += '</div>';
  if (before.length) {
    h += uiFoldHtml('supp-before', '<span class="inv-panel-title">In the balance set, or before it <span class="inv-panel-count">' + before.length + '</span></span>',
      uiMoreHtml('supp-before-' + sp.id, before.map(function(l) { return row(l, false); }), { n: 12, noun: 'lines' }), false, ' data-supp-before');
  }
  return h;
}
function suppPayFormHtml(sp) {
  var today = localDateStr();
  return '<div class="inv-fields" data-supp-pay-form>' +
    suppField('suppPayDate', 'Paid on', '<input class="inv-input" id="suppPayDate" type="date" max="' + today + '" value="' + today + '">') +
    suppField('suppPayAmount', 'Amount', '<input class="inv-input inv-input-num" id="suppPayAmount" type="number" step="0.01" min="0" inputmode="decimal">') +
    suppField('suppPayHow', 'How', '<select class="inv-select" id="suppPayHow"><option value="cheque">Cheque handed over</option><option value="transfer">Transfer</option><option value="cash">Cash</option></select>') +
    suppField('suppPayChq', 'Cheque or reference no.', '<input class="inv-input" id="suppPayChq" autocomplete="off">') +
    suppField('suppPayNote', 'Note', '<input class="inv-input" id="suppPayNote" autocomplete="off">', true) +
    '</div><div class="inv-note">A cheque counts from the day it is handed over, as their book counts it; when the statement shows it clear by its number, that row is this payment, never a second one.</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invSuppForm" data-form="">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invSuppSavePay">Save payment</button></div>';
}
function suppBalanceFormHtml(sp, L) {
  var op = L.op || {}, today = localDateStr();
  return '<div class="inv-fields" data-supp-balance-form>' +
    suppField('suppBalAmount', 'Owed to them', '<input class="inv-input inv-input-num" id="suppBalAmount" type="number" step="0.01" inputmode="decimal" value="' + escHtml(op.amount != null ? String(op.amount) : '') + '">') +
    suppField('suppBalDate', 'At the end of', '<input class="inv-input" id="suppBalDate" type="date" max="' + today + '" value="' + escHtml(op.date || '') + '">') +
    suppField('suppBalNote', 'Note', '<input class="inv-input" id="suppBalNote" autocomplete="off" placeholder="Their statement, the page for the month" value="' + escHtml(op.note || '') + '">', true) +
    '</div><div class="inv-note" id="suppBalPreview" aria-live="polite">' + escHtml(suppBalPreview(sp, op.amount, op.date)) + '</div>' +
    '<div class="inv-note">The figure on their statement after its last entry, and that entry’s day. The bills and payments after it are counted; a cheque they had credited before the day that clears after it can be marked as in their figure.</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invSuppForm" data-form="">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invSuppSaveBalance">Save balance</button></div>';
}
/* What a balance typed would come to now: the bills and payments on record after its day. */
function suppBalPreview(sp, amount, date) {
  var a = parseFloat(amount);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || isNaN(a)) return 'Type the figure and its day to see what it comes to now.';
  var billed = 0, paid = 0;
  sp.bills.forEach(function(b) { if (b.date > date) billed = gstRound(billed + b.total); });
  sp.pays.forEach(function(p) { if (p.date > date) paid = gstRound(paid + p.amount); });
  var now = gstRound(a + billed - paid);
  return 'Owed now: ' + formatCurrency(now) + ' (bills ' + finRs(billed) + ' and payments ' + finRs(paid) + ' after ' + formatDate(date) + ').';
}
function suppSetFormHtml(sp, lead) {
  var r = sp.rec || {}, others = sp.names.filter(function(n) { return n !== sp.name; });
  var num = function(id, v, max) { return '<input class="inv-input inv-input-num" id="' + id + '" type="number" min="0" max="' + max + '" step="1" inputmode="numeric" value="' + escHtml(v == null ? '' : String(v)) + '">'; };
  return '<div class="inv-fields" data-supp-set-form>' +
    suppField('suppSetName', 'Name', '<input class="inv-input" id="suppSetName" autocomplete="off" value="' + escHtml(sp.name) + '">', true) +
    suppField('suppSetLeadMin', 'Lead time, at least (working days)', num('suppSetLeadMin', lead ? lead.min : '', 60)) +
    suppField('suppSetLeadMax', 'Lead time, at most (working days)', num('suppSetLeadMax', lead ? lead.max : '', 60)) +
    suppField('suppSetGst', 'GST on its bills (%)', num('suppSetGst', suppGst(sp), 28)) +
    suppField('suppSetNames', 'Also written (one a line)', '<textarea class="inv-textarea" id="suppSetNames" rows="3">' + escHtml(others.join('\n')) + '</textarea>', true) +
    suppField('suppSetNote', 'Note', '<input class="inv-input" id="suppSetNote" autocomplete="off" value="' + escHtml(r.note || '') + '">', true) +
    '</div><div class="inv-note">0 is the same day. Another spelling (the bank’s, a short form) makes its bills and payments this supplier’s.</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invSuppForm" data-form="">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invSuppSaveSet">Save</button></div>';
}

/* ---------- Saving ---------- */
/* The supplier's record, made the first time something is set on it: every spelling the book had for it goes with it. */
function suppRecord(sp) {
  if (sp.rec) return sp.rec;
  var r = { id: suppUid('SUP-'), name: sp.name, names: sp.names.filter(function(n) { return n !== sp.name; }), at: Date.now(), by: suppBy() };
  suppData().push(r);
  sp.rec = r;
  return r;
}
function suppFormVal(sel, id) { var f = document.querySelector(sel), el = f && f.parentNode.querySelector('#' + id); return el ? String(el.value).trim() : ''; }
function suppSavePay() {
  var sp = suppById(_suppOpenId);
  if (!sp) return;
  var v = function(id) { return suppFormVal('[data-supp-pay-form]', id); };
  var date = v('suppPayDate'), amount = gstRound(parseFloat(v('suppPayAmount')) || 0), how = v('suppPayHow') || 'cheque', chq = v('suppPayChq').replace(/\s+/g, '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > localDateStr()) { showToast('The day it was paid cannot be after today', 'error'); return; }
  if (!(amount > 0)) { showToast('Enter the amount', 'error'); return; }
  if (how === 'cheque' && chq && !/^\d+$/.test(chq)) { showToast('A cheque number is digits only', 'error'); return; }
  var ck = bankChequeKey(chq);
  if (how === 'cheque' && ck && suppPays().some(function(p) { return !p.voidedAt && p.how === 'cheque' && bankChequeKey(p.chq) === ck; })) { showToast('Cheque ' + chq + ' is already recorded', 'error'); return; }
  // A Finance edit (bankGate, P1): the form stays as typed while the PIN is asked, and the same Save runs once it is given.
  if (!bankGate('record a payment to a supplier', function() { suppSavePay(); })) return;
  var r = suppRecord(sp);
  suppPays().push({ id: suppUid('SPY-'), supplierId: r.id, date: date, amount: amount, how: how === 'transfer' || how === 'cash' ? how : 'cheque', chq: chq || null,
    note: v('suppPayNote') || null, at: Date.now(), by: suppBy() });
  _suppOpenId = r.id; _suppForm = '';
  saveState();
  suppRedraw(r.id);
  showToast(formatCurrency(amount) + ' to ' + sp.name + ' recorded' + (how === 'cheque' && chq ? ': cheque ' + chq + ' clears against the statement by its number' : ''));
}
function suppSaveBalance() {
  var sp = suppById(_suppOpenId);
  if (!sp) return;
  var v = function(id) { return suppFormVal('[data-supp-balance-form]', id); };
  var amt = parseFloat(v('suppBalAmount')), date = v('suppBalDate');
  if (isNaN(amt)) { showToast('Enter what was owed', 'error'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > localDateStr()) { showToast('Pick the day it was owed at the end of, not after today', 'error'); return; }
  if (!bankGate('set what is owed to a supplier', function() { suppSaveBalance(); })) return;
  var r = suppRecord(sp);
  r.opening = { amount: gstRound(amt), date: date, note: v('suppBalNote') || null, at: Date.now(), by: suppBy() };
  // A payment marked as in the figure belonged to the day it was set against.
  delete r.inOpening;
  _suppOpenId = r.id; _suppForm = '';
  saveState();
  suppRedraw(r.id);
  var L = suppLedger(suppById(r.id));
  showToast('Balance set: ' + formatCurrency(L.balance) + ' owed to ' + r.name + ' now');
}
function suppSaveSet() {
  var sp = suppById(_suppOpenId);
  if (!sp) return;
  var v = function(id) { return suppFormVal('[data-supp-set-form]', id); };
  var name = v('suppSetName').replace(/\s+/g, ' '), lmin = v('suppSetLeadMin'), lmax = v('suppSetLeadMax'), gst = v('suppSetGst');
  if (!name) { showToast('Name the supplier', 'error'); return; }
  var nmin = lmin === '' ? null : parseInt(lmin, 10), nmax = lmax === '' ? null : parseInt(lmax, 10);
  if (nmax == null && nmin != null) nmax = nmin;
  if (nmin == null && nmax != null) nmin = nmax;
  if ((nmax != null && (isNaN(nmax) || nmax < 0 || nmax > 60)) || (nmin != null && (isNaN(nmin) || nmin < 0 || nmin > nmax))) { showToast('A lead time is 0 to 60 working days, the least not above the most', 'error'); return; }
  var g = gst === '' ? SUPP_GST : parseFloat(gst);
  if (isNaN(g) || g < 0 || g > 28) { showToast('GST is 0 to 28%', 'error'); return; }
  var names = v('suppSetNames').split(/\n+/).map(function(s) { return s.trim().replace(/\s+/g, ' '); }).filter(Boolean);
  // A spelling already another supplier's would make two suppliers one by accident: refused, said which.
  var idx = suppIndex(), clash = null;
  [name].concat(names).some(function(s) { var o = idx.find(s); if (o && o !== sp) { clash = { s: s, o: o }; return true; } return false; });
  if (clash) { showToast('“' + clash.s + '” is ' + clash.o.name + '’s already', 'error'); return; }
  if (!bankGate('change a supplier', function() { suppSaveSet(); })) return;
  var r = suppRecord(sp), old = r.name;
  r.name = name;
  // A rename keeps the old name as a spelling, so the bills that carry it stay this supplier's.
  var keep = names.slice();
  if (old && old !== name && keep.indexOf(old) < 0) keep.push(old);
  sp.names.forEach(function(n) { if (n !== name && keep.indexOf(n) < 0 && stockData().entries.some(function(e) { return String(e.supplier || '').trim() === n; })) keep.push(n); });
  r.names = keep.filter(function(n) { return n !== name; });
  if (nmax == null) { delete r.leadMin; delete r.leadMax; } else { r.leadMin = nmin; r.leadMax = nmax; }
  if (g === SUPP_GST) delete r.gstPct; else r.gstPct = g;
  var note = v('suppSetNote');
  if (note) r.note = note; else delete r.note;
  r.setAt = Date.now(); r.setBy = suppBy();
  _suppOpenId = r.id; _suppForm = '';
  saveState();
  suppRedraw(r.id);
  showToast(name + ' saved' + (nmax != null ? ': ' + suppLeadText({ min: nmin, max: nmax }) : ''));
}
async function suppVoidPay(id) {
  var p = suppPays().find(function(x) { return x.id === id; });
  if (!p || p.voidedAt) return;
  if (!bankGate('void a payment to a supplier', function() { suppVoidPay(id); })) return;
  var reason = await uiPrompt({ title: 'Void this payment', body: formatCurrency(p.amount) + ' on ' + formatDate(p.date) + '. It stays on the record and stops counting.',
    label: 'Why is it void?', okLabel: 'Void payment', danger: true, required: true, requiredText: 'A void needs a reason.' });
  if (reason == null) return;
  if (!reason.trim()) { showToast('A void needs a reason', 'error'); return; }
  p = suppPays().find(function(x) { return x.id === id; });
  if (!p || p.voidedAt) return;
  p.voidedAt = Date.now(); p.voidReason = reason.trim(); p.voidBy = suppBy();
  saveState();
  suppRedraw(p.supplierId);
  showToast('Payment voided: ' + formatCurrency(p.amount) + ' is owed again');
}
/* A statement payment soon after the balance's day: in their figure already (a cheque they credited before it cleared), or counted. */
function suppInOpening(id, rowId) {
  var sp = suppById(id);
  if (!sp || !rowId) return;
  if (!bankGate('change what a supplier’s balance counts', function() { suppInOpening(id, rowId); })) return;
  var r = suppRecord(sp), list = Array.isArray(r.inOpening) ? r.inOpening : (r.inOpening = []), at = list.indexOf(rowId);
  if (at >= 0) list.splice(at, 1); else list.push(rowId);
  if (!list.length) delete r.inOpening;
  _suppOpenId = r.id;
  saveState();
  suppRedraw(r.id);
  showToast(at >= 0 ? 'Counted after the balance’s day' : 'Marked as in their balance: not counted again');
}
/* A bill's total as printed, where the paper differs from its lines with GST (freight, another rate); blank puts it back. */
async function suppBillTotal(id, key) {
  var sp = suppById(id), b = sp && sp.bills.find(function(x) { return x.key === key; });
  if (!b) return;
  if (!bankGate('set a supplier bill’s total', function() { suppBillTotal(id, key); })) return;
  var v = await uiPrompt({ title: suppBillName(b) + ', ' + formatDate(b.date), body: 'Worked out: ' + formatCurrency(b.base) + ' before GST, ' + formatCurrency(b.calc) + ' with ' + b.gst + '%. Type the total printed on the bill, or leave it blank for the worked-out one.',
    label: 'Total on the bill', value: b.typed ? String(b.total) : '', okLabel: 'Save total' });
  if (v == null) return;
  var n = String(v).trim() === '' ? null : parseFloat(v);
  if (n != null && (isNaN(n) || n < 0)) { showToast('A total is a figure', 'error'); return; }
  sp = suppById(id);
  if (!sp) return;
  var r = suppRecord(sp);
  r.totals = r.totals && typeof r.totals === 'object' ? r.totals : {};
  if (n == null) delete r.totals[key]; else r.totals[key] = gstRound(n);
  if (!Object.keys(r.totals).length) delete r.totals;
  _suppOpenId = r.id;
  saveState();
  suppRedraw(r.id);
  showToast(n == null ? 'The worked-out total stands' : 'Total set as printed: ' + formatCurrency(n));
}
/* A payee on the statement is this supplier (its initials, or the owner's word): its name becomes one of the supplier's spellings. */
function suppSameAs(id, payee) {
  var sp = suppById(id);
  if (!sp || !payee) return;
  if (!bankGate('name a supplier’s payee', function() { suppSameAs(id, payee); })) return;
  var r = suppRecord(sp);
  r.names = Array.isArray(r.names) ? r.names : [];
  if (r.names.indexOf(payee) < 0 && r.name !== payee) r.names.push(payee);
  saveState();
  if (navPageOf() === 'pageFinance' && typeof renderFinance === 'function') keepScroll(renderFinance);
  showToast(payee + ' is ' + r.name + ' now: its payments are theirs');
}
function suppOnInput(t) {
  if (!t || (t.id !== 'suppBalAmount' && t.id !== 'suppBalDate')) return false;
  var sp = suppById(_suppOpenId), el = document.getElementById('suppBalPreview');
  if (sp && el) el.textContent = suppBalPreview(sp, suppFormVal('[data-supp-balance-form]', 'suppBalAmount'), suppFormVal('[data-supp-balance-form]', 'suppBalDate'));
  return true;
}
function suppAction(action, btn) {
  switch (action) {
    case 'invSuppOpen': suppOpen(btn.dataset.id, ''); return true;
    case 'invSuppForm': {
      // Cancel from a typed form is a discard somebody chose: nothing asks.
      var sc = btn.closest('.inv-scrim-dialog');
      if (sc) delete sc.dataset.typed;
      suppOpen(_suppOpenId, btn.dataset.form || '');
      return true;
    }
    case 'invSuppSavePay': suppSavePay(); return true;
    case 'invSuppSaveBalance': suppSaveBalance(); return true;
    case 'invSuppSaveSet': suppSaveSet(); return true;
    case 'invSuppVoidPay': suppVoidPay(btn.dataset.id); return true;
    case 'invSuppInOpening': suppInOpening(btn.dataset.id, btn.dataset.row); return true;
    case 'invSuppBillTotal': suppBillTotal(btn.dataset.id, btn.dataset.key); return true;
    case 'invSuppSame': suppSameAs(btn.dataset.id, btn.dataset.payee); return true;
  }
  return false;
}

/* ---------- The reorder list ---------- */
/* Which supplier a line is ordered from, and by when (cost.js stockReorderList; the line's task in todo.js). Every supplier who sold
   the line within SUPP_PRICE_DAYS is weighed at its last price: of those whose lead time lets the goods come before the line runs
   out, the cheapest; when the one it last came from cannot make it, the fastest that can, and what the hurry costs. A supplier
   whose lead time is not set is never chosen over the last one: it is named. With no daily use on record nothing runs out, so
   the cheapest with a lead time set is chosen. Zinc follows the market (zinc.js sets each bill against it), so an older bill is
   not a price to weigh: its last supplier stands.
   Returns { sp, name, price, lead, orderBy, late, daysLeft, why, last: {sp, name, price} }. */
function suppReorderPick(item, daysLeft) {
  var buys = stockPurchases(item.id);
  if (!buys.length) return null;
  var idx = suppIndex(), today = localDateStr(), from = isoAddDays(today, -SUPP_PRICE_DAYS), by = {};
  buys.forEach(function(b) {
    var sp = idx.find(b.e.supplier || ''), k = sp ? sp.id : '';
    by[k] = { sp: sp, name: sp ? sp.name : 'No supplier on record', price: b.e.price, date: b.date, lead: sp ? suppLead(sp) : null };
  });
  var lastB = buys[buys.length - 1], lastSp = idx.find(lastB.e.supplier || ''), last = by[lastSp ? lastSp.id : ''];
  var others = item.key === 'ZINC' ? [] : Object.keys(by).map(function(k) { return by[k]; }).filter(function(x) { return x.sp && x !== last && x.date >= from; });
  var fits = function(x) { return x.lead && (daysLeft == null || x.lead.max <= daysLeft); };
  var dear = function(a, b) { return a.price - b.price || a.lead.max - b.lead.max; };
  var pick = last, why = '';
  if (last.lead && daysLeft != null && last.lead.max > daysLeft) {
    // The one it last came from cannot make it: the fastest that can, else it stays, late.
    var can = others.filter(fits).sort(function(a, b) { return a.lead.max - b.lead.max || a.price - b.price; })[0];
    if (can) {
      pick = can;
      var d = gstRound(can.price - last.price, 2);
      why = last.name + ' takes ' + suppLeadText(last.lead) + ': it would run out first; ' + (d > 0 ? formatCurrency(d) + ' a unit more' : d < 0 ? formatCurrency(-d) + ' a unit less' : 'the same price') + ' from ' + can.name;
    }
  } else {
    var cheaper = others.filter(function(x) { return fits(x) && x.price < last.price - 0.005; }).sort(dear)[0];
    if (cheaper) { pick = cheaper; why = formatCurrency(gstRound(last.price - cheaper.price, 2)) + ' a unit less than ' + last.name + ', ' + suppLeadText(cheaper.lead); }
    else {
      var named = others.filter(function(x) { return !x.lead && x.price < last.price - 0.005; }).sort(function(a, b) { return a.price - b.price; })[0];
      var slow = others.filter(function(x) { return x.lead && x.price < last.price - 0.005; }).sort(function(a, b) { return a.price - b.price; })[0];
      if (slow) why = slow.name + ' is ' + formatCurrency(gstRound(last.price - slow.price, 2)) + ' a unit less but takes ' + suppLeadText(slow.lead) + ': it would run out first';
      else if (named) why = named.name + ' sold it ' + formatCurrency(gstRound(last.price - named.price, 2)) + ' a unit less on ' + stockShortDate(named.date) + '; set its lead time to weigh it';
    }
  }
  var lead = pick.lead, orderBy = null, late = false;
  if (lead && daysLeft != null) {
    var spare = Math.floor(daysLeft - lead.max);
    late = spare < 0;
    orderBy = late ? today : suppAddWorkingDays(today, spare);
  }
  return { sp: pick.sp, name: pick.name, price: pick.price, lead: lead, orderBy: orderBy, late: late, daysLeft: daysLeft, why: why,
    last: { sp: last.sp, name: last.name, price: last.price } };
}
/* The pick in words, for the list's row and the line's task: who, how long, by when. */
function suppPickText(pk) {
  if (!pk || !pk.sp) return '';
  var when = '';
  if (pk.orderBy) when = pk.late ? (pk.daysLeft != null && pk.daysLeft <= 0 ? ', order now: it is out' : ', order now: it runs out before it can come')
    : pk.orderBy === localDateStr() ? ', order today' : ', order by ' + stockShortDate(pk.orderBy);
  return pk.name + ': ' + suppLeadText(pk.lead) + when;
}
