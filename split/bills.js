/* ===== BILLS AND CREDIT NOTES =====
 * Two records that had no findable door (owner, 26 Sep 2026: "We don't have a place to enter
 * electricity bills anywhere in the app … And even credit notes"). They shared a Finance tab,
 * Bills & notes, until the tab map (TM3a, 10 Oct 2026) put each where its work is: the bills on
 * Money → Payments, beside what the bank paid for them; the credit notes with the invoices, in
 * Office → Invoices → Credit notes. The forms stay here.
 *
 * Electricity and other bills are S.costBills, the same records Stats → Live cost reads; they
 * were entered only at the foot of that card, under "Power". A month that closed without one is
 * listed as missing, and the To-do rule `power` asks for it.
 *
 * Credit notes could only be RAISED, and only one way: a register selection priced at the SSS
 * Mehta batch discount. Two things had no door at all:
 *   - a note already issued outside the app (CN/001–005 were; CN/004 and CN/005, ₹11,388.66 gross,
 *     sat outside S.creditNotes and so outside the CDNR export — CLAUDE.md's control gap);
 *   - a note for any other reason: a rate correction, goods returned, a short weight.
 * Both land in the same series, list, printout and CSV as a batch note. The reason is a FIXED
 * list (owner's choice) so the register can be read by kind; Other requires a description.
 */

var CN_REASONS = [
  ['rate', 'Rate correction'],
  ['returned', 'Goods returned or rejected'],
  ['short', 'Short quantity or weight'],
  ['discount', 'Discount'],
  ['rebate', 'Batch rebate'],
  ['other', 'Other']
];
function cnReasonLabel(key) { var r = CN_REASONS.find(function(x) { return x[0] === key; }); return r ? r[1] : ''; }
/* A batch rebate is the SSS Mehta scheme: the To-do batch rule and the printed annex read only these. */
function cnIsRebate(cn) { return !cn.kind || cn.kind === 'rebate'; }

var _billForm = null;   // { mode: 'new' | 'record', ... } — the credit-note form, in the Credit notes dialog
var _billsMonths = 6;   // closed months checked for a missing electricity bill

function billsMonthLabel(ym) {
  var p = String(ym || '').split('-');
  return p.length === 2 ? TREND_MONTH_LABELS[parseInt(p[1], 10) - 1] + ' ' + p[0] : ym;
}
/* The n closed months before this one, newest first. */
function billsPrevMonths(n) { return insMonthsBack(n).reverse(); }
/* A closed month with invoices but no electricity bill. A month the app billed nothing in is
   not asked for: that is a device holding no books, not a missing bill. */
function billsMissingPower(n) {
  var have = {};
  costBills().forEach(function(b) { if (b.kind === 'power' && !b.voided) have[b.month] = true; });
  return billsPrevMonths(n || _billsMonths).filter(function(m) {
    return !have[m] && (S.invoices || []).some(function(i) { return i.status === 'active' && i.date && i.date.slice(0, 7) === m; });
  });
}



/* ---------- Electricity and other bills (Money → Payments) ----------
   The bill form when it is open here, the closed months with no electricity bill (what needs the owner), then the bills entered
   in month order, folded to one row that says how many and the latest that stands; each opens with its note and its Void. Add a
   bill is the screen's toolbar (bank.js). */
function _billsPowerHtml() {
  var bills = costBills().slice().sort(function(a, b) { return a.month < b.month ? 1 : a.month > b.month ? -1 : (b.at || 0) - (a.at || 0); });
  var missing = billsMissingPower(), open = _costBillOpen && _costBillOpen.where === 'finance', live = bills.filter(function(b) { return !b.voided; });
  var h = '<div class="inv-panel inv-panel-flush" id="billsPower"><div class="inv-panel-head"><span class="inv-panel-title">Bills: electricity and other</span>' +
    (missing.length ? '<span class="inv-dot inv-dot-warning" data-bills-missing="' + missing.length + '">' + escHtml(todoPlural(missing.length, 'month') + ' with no bill') + '</span>'
      : '<span class="inv-panel-count">' + live.length + '</span>') + '</div>';
  if (open) h += '<div class="inv-panel-body" data-bill-form>' + costBillFormHtml() + '</div>';
  // The bank already says what was paid for a missing month: offered, never added unasked.
  var bankPower = missing.length ? bankPowerRows() : [];
  // The latest three, the rest one tap away (TM3a: Payments took the bills, and gave the room back, I10); the head counts all.
  h += uiMoreHtml('bills-missing', missing.map(function(m) {
    var paid = bankPower.find(function(v) { return bankBillMonth(v.row) === m; });
    var parts = ['<div class="inv-row" data-missing="' + m + '"><span class="inv-row-main"><span class="inv-dot inv-dot-warning">No electricity bill for ' + escHtml(billsMonthLabel(m)) + '</span></span>' +
      '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCostBillOpen" data-where="finance" data-month="' + m + '">Add</button></span></div>'];
    // What the bank paid for it is an offer, a line of its own under the month (one action a row's end, §1a-11).
    if (paid) parts.push('<div class="inv-row-children"><div class="inv-row" data-missing-paid="' + m + '"><span class="inv-row-main inv-row-meta">' +
      escHtml(formatCurrency(paid.row.dr) + ' paid ' + formatDate(paid.row.date)) + '</span><span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invBankAddBill" data-id="' +
      escHtml(paid.row.id) + '">Add as bill</button></span></div></div>');
    return { parts: parts };
  }), { n: 3, noun: 'months' });
  if (!bills.length) {
    if (!missing.length) h += '<div class="inv-empty">No bills recorded. Until there are, Live cost prices electricity and the other costs at the Settings fallbacks.</div>';
    return h + '</div>';
  }
  var rows = bills.map(function(b) {
    var meta = [b.units ? formatNum(b.units, 0) + ' units' : ''].concat(costBillParts(b), [b.note || '', b.voided ? 'void: ' + (b.voidReason || '') : '']).filter(Boolean).join(' · ');
    return '<div class="inv-row inv-row-2' + (b.voided ? ' inv-row-muted' : '') + '" data-bill="' + escHtml(b.id) + '"><span class="inv-row-main">' +
      '<span class="inv-row-title">' + escHtml((b.label || COST_BILL_KINDS[b.kind] || b.kind) + ' · ' + billsMonthLabel(b.month)) + '</span>' +
      (meta ? '<span class="inv-row-meta inv-row-wrap">' + escHtml(meta) + '</span>' : '') + '</span>' +
      '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(b.amount) + '</span>' +
      (b.voided ? '<span class="inv-dot inv-dot-neutral">Void</span>' : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCostBillVoid" data-id="' + escHtml(b.id) + '">Void</button>') +
      '</span></div>';
  }).join('');
  // A voided bill is listed inside, muted, and never leads the head.
  h += '<details class="inv-row-fold" data-fold="bills-entered"' + (uiFoldOpen('bills-entered', !!_isDesktop) ? ' open' : '') + '><summary class="inv-row" data-bills-entered="' + live.length + '">' +
    '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(live.length ? todoPlural(live.length, 'bill') + ' entered, the latest ' + billsMonthLabel(live[0].month)
      : todoPlural(bills.length, 'bill') + ' entered, all voided') + '</span></span>' +
    '<span class="inv-row-end">' + (live.length ? '<span class="inv-num">' + formatCurrency(live[0].amount) + '</span>' : '') + '</span></summary>' +
    '<div class="inv-row-children">' + rows + '</div></details>';
  return h + '</div>';
}

/* A new note is against an invoice in the book, so it offers the clients that have one. A note being recorded may
   be against an invoice typed from outside the book, so it offers every client: one with no invoice here could not
   be picked, and its note could not be recorded at all. */
function _billsClientOptions(sel, all) {
  var ids = {};
  (S.invoices || []).forEach(function(i) { ids[i.clientId] = true; });
  return S.clients.filter(function(c) { return all || ids[c.id]; }).sort(function(a, b) { return a.name < b.name ? -1 : 1; })
    .map(function(c) { return '<option value="' + c.id + '"' + (String(sel) === String(c.id) ? ' selected' : '') + '>' + escHtml(c.name) + '</option>'; }).join('');
}
function _billsClientInvoices(clientId) {
  return (S.invoices || []).filter(function(i) { return String(i.clientId) === String(clientId) && i.status === 'active'; })
    .sort(function(a, b) { return (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0); });
}

function _billsCnFormHtml() {
  var f = _billForm, rec = f.mode === 'record';
  var reasons = CN_REASONS.filter(function(r) { return rec || r[0] !== 'rebate'; });
  var invs = f.clientId ? _billsClientInvoices(f.clientId) : [];
  var field = function(label, id, control, cls) {
    return '<label class="inv-field' + (cls ? ' ' + cls : '') + '"><span class="inv-field-label">' + label + '</span>' + control + '</label>';
  };
  var inp = function(id, type, val, extra) {
    return '<input class="inv-input' + (type === 'number' ? ' inv-input-num' : '') + '" id="' + id + '" type="' + type + '" value="' + escHtml(val == null ? '' : val) + '"' + (extra || '') + '>';
  };
  var h = '<div class="inv-panel-title inv-mb-8">' + (rec ? 'Record a credit note already issued' : 'New credit note') + '</div>' +
    (rec ? '<div class="inv-note inv-mb-8">For a note the customer already holds: type it as printed. It joins the series, the list and the credit-note CSV; the number it carries is kept, and never issued again.</div>'
         : '<div class="inv-note inv-mb-8">A note against one invoice, for a reason other than the batch rebate (that is raised from a Register selection). It takes the next number in the series.</div>') +
    '<div class="inv-fields">' +
    (rec ? field('Number', 'cnfNum', inp('cnfNum', 'number', f.num, ' min="1" step="1" inputmode="numeric"')) +
      field('Financial year', 'cnfFy', inp('cnfFy', 'text', f.fy, ' placeholder="26-27"')) : '') +
    field('Date', 'cnfDate', inp('cnfDate', 'date', f.date)) +
    field('Client', 'cnfClient', '<select class="inv-select" id="cnfClient"><option value="">Choose a client</option>' + _billsClientOptions(f.clientId, rec) + '</select>') +
    field('Against invoice', 'cnfInv', '<select class="inv-select" id="cnfInv"' + (f.clientId ? '' : ' disabled') + '>' +
      '<option value="">' + (f.clientId ? 'Choose an invoice' : 'Choose a client first') + '</option>' +
      invs.map(function(i) {
        return '<option value="' + escHtml(i.id) + '"' + (f.invId === i.id ? ' selected' : '') + '>' + escHtml(i.displayNumber + ' · ' + formatDate(i.date) + ' · ' + formatCurrency(i.taxableValue)) + '</option>';
      }).join('') +
      (rec ? '<option value="__typed"' + (f.invId === '__typed' ? ' selected' : '') + '>Not in the register: type it</option>' : '') + '</select>') +
    (rec && f.invId === '__typed' ? field('Invoice number, as printed', 'cnfInvNo', inp('cnfInvNo', 'text', f.invNo)) + field('Invoice date', 'cnfInvDate', inp('cnfInvDate', 'date', f.invDate)) : '') +
    field('Reason', 'cnfReason', '<select class="inv-select" id="cnfReason">' + reasons.map(function(r) {
      return '<option value="' + r[0] + '"' + (f.reason === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select>') +
    field(f.reason === 'other' ? 'Describe it (required)' : 'Note (optional)', 'cnfNote', inp('cnfNote', 'text', f.note)) +
    (f.reason === 'rebate' ? field('Discount %', 'cnfPct', inp('cnfPct', 'number', f.pct, ' step="0.01" min="0"')) +
      field('Period from', 'cnfFrom', inp('cnfFrom', 'date', f.from)) + field('Period to', 'cnfTo', inp('cnfTo', 'date', f.to)) : '') +
    field('Taxable value credited (before GST)', 'cnfTaxable', inp('cnfTaxable', 'number', f.taxable, ' step="0.01" min="0" inputmode="decimal"')) +
    (rec ? _billsTaxFields(field, inp) : '') +
    field('Quantity (optional)', 'cnfQty', inp('cnfQty', 'number', f.qty, ' step="any" min="0" inputmode="decimal"')) +
    field('Unit', 'cnfUnit', '<select class="inv-select" id="cnfUnit">' + ['KG', 'NOS'].map(function(u) {
      return '<option' + (f.unit === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select>') +
    '</div>';
  // Always drawn, hidden while empty, so typing the taxable fills it in place rather than redrawing
  // the form under the field being typed in.
  var c = _billsCnFigures();
  h += '<div class="inv-callout inv-mb-8' + (c ? '' : ' inv-hidden') + '" data-cn-figures>' + _billsFiguresHtml(c) + '</div>';
  return h + '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary" data-action="invCnFormCancel">' + (f.saved ? 'Close' : 'Cancel') + '</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invCnFormSave">' + (rec ? 'Record note' : 'Issue note') + '</button></div>';
}

/* A recorded note carries the tax AS PRINTED. Recomputing it is not the same thing: CN/004 is
   3,749.29 taxable, which the app's per-half rounding makes 337.44 + 337.44 = 4,424.17 gross,
   where the note the customer holds reads 4,424.16. The fields start at the computed figure. */
function _billsTaxFields(field, inp) {
  var f = _billForm, client = S.clients.find(function(c) { return String(c.id) === String(f.clientId); });
  var inter = client && client.gstType === 'inter';
  return inter
    ? field('IGST as printed', 'cnfIgst', inp('cnfIgst', 'number', f.igst, ' step="0.01" min="0" inputmode="decimal" placeholder="18% of taxable"'))
    : field('CGST as printed', 'cnfCgst', inp('cnfCgst', 'number', f.cgst, ' step="0.01" min="0" inputmode="decimal" placeholder="9% of taxable"')) +
      field('SGST as printed', 'cnfSgst', inp('cnfSgst', 'number', f.sgst, ' step="0.01" min="0" inputmode="decimal" placeholder="9% of taxable"'));
}

/* The GST follows the client's own type, as a batch note's does (cnCompute); a recorded note
   overrides any half the operator typed as printed. */
function _billsCnFigures() {
  var f = _billForm;
  if (!f || !f.clientId || !(f.taxable > 0)) return null;
  var client = S.clients.find(function(c) { return String(c.id) === String(f.clientId); });
  var c = cnCompute([{ taxableValue: f.taxable }], client, 100, 0);
  if (f.mode === 'record') {
    if (c.gstType === 'inter') { if (f.igst !== '' && f.igst != null && !isNaN(f.igst)) c.igstAmt = gstRound(f.igst); }
    else {
      if (f.cgst !== '' && f.cgst != null && !isNaN(f.cgst)) c.cgstAmt = gstRound(f.cgst);
      if (f.sgst !== '' && f.sgst != null && !isNaN(f.sgst)) c.sgstAmt = gstRound(f.sgst);
    }
    c.grandTotal = gstRound(c.taxable + c.cgstAmt + c.sgstAmt + c.igstAmt);
  }
  return c;
}

function _billsFiguresHtml(c) {
  if (!c) return '';
  return formatCurrency(c.taxable) + ' taxable + ' + formatCurrency(gstRound(c.cgstAmt + c.sgstAmt + c.igstAmt)) +
    ' GST (' + (c.gstType === 'inter' ? 'IGST 18%' : 'CGST 9% + SGST 9%') + ') = <strong>' + formatCurrency(c.grandTotal) + '</strong>';
}

function billsCnFormOpen(mode) {
  _billForm = { mode: mode === 'record' ? 'record' : 'new', date: localDateStr(), clientId: '', invId: '', reason: mode === 'record' ? 'rebate' : 'rate',
    note: '', taxable: '', qty: '', unit: 'KG', num: '', fy: cnFyShort(), pct: CN_DEFAULT_PCT, from: '', to: '', invNo: '', invDate: '',
    cgst: '', sgst: '', igst: '' };
  renderCreditNoteList(true);
}

/* Read the form back into _billForm. A field that changes what the form shows redraws it; the
   figures are updated in place. Called on `input` for typed fields (held as typed, so Save reads
   them even if the field never lost focus) and on `change` for every field. */
function billsCnFormInput(t) {
  if (!_billForm || !t.id || t.id.indexOf('cnf') !== 0) return false;
  var map = { cnfNum: 'num', cnfFy: 'fy', cnfDate: 'date', cnfClient: 'clientId', cnfInv: 'invId', cnfInvNo: 'invNo', cnfInvDate: 'invDate',
    cnfReason: 'reason', cnfNote: 'note', cnfPct: 'pct', cnfFrom: 'from', cnfTo: 'to', cnfTaxable: 'taxable', cnfQty: 'qty', cnfUnit: 'unit',
    cnfCgst: 'cgst', cnfSgst: 'sgst', cnfIgst: 'igst' };
  var k = map[t.id];
  if (!k) return false;
  _billForm[k] = ['taxable', 'qty', 'pct', 'cgst', 'sgst', 'igst'].indexOf(k) >= 0 ? (t.value === '' ? '' : parseFloat(t.value)) : t.value;
  if (k === 'clientId') _billForm.invId = '';
  if (['clientId', 'invId', 'reason'].indexOf(k) >= 0) { renderCreditNoteList(true); return true; }
  if (['taxable', 'cgst', 'sgst', 'igst'].indexOf(k) >= 0) {
    var box = document.querySelector('[data-cn-dialog] [data-cn-figures]'), c = _billsCnFigures();
    if (box) { box.innerHTML = _billsFiguresHtml(c); box.classList.toggle('inv-hidden', !c); }
  }
  return true;
}

/* A recorded note's financial year however it was typed (2026-27, 2026-2027, 26-27, 26/27) in the series' own form,
   '26-27' (cnFyShort): compared and stored that way, '2026-27' was a year of its own beside '26-27', so CN/012/2026-27
   was missed by the duplicate check and the series, and the next new note took CN/012/26-27. Anything else is as typed. */
function billsCnFy(s) {
  var t = String(s == null ? '' : s).trim(), m = t.match(/^(\d{2}|\d{4})\s*[-\/]\s*(\d{2}|\d{4})$/);
  return m ? m[1].slice(-2) + '-' + m[2].slice(-2) : t;
}

async function billsCnFormSave() {
  var f = _billForm;
  if (!f) return;
  var rec = f.mode === 'record';
  var client = S.clients.find(function(c) { return String(c.id) === String(f.clientId); });
  if (!client) { showToast('Choose the client', 'error'); return; }
  if (!f.date) { showToast('A credit note needs a date', 'error'); return; }
  if (!(f.taxable > 0)) { showToast('Enter the taxable value credited', 'error'); return; }
  if (f.reason === 'other' && !String(f.note || '').trim()) { showToast('Describe what the note is for', 'error'); return; }

  var inv = f.invId && f.invId !== '__typed' ? S.invoices.find(function(i) { return i.id === f.invId; }) : null;
  var typedNo = rec && f.invId === '__typed' ? String(f.invNo || '').trim() : '';
  if (!inv && !typedNo) { showToast('Choose the invoice the note is against', 'error'); return; }
  // P1 (guard.js): a note recorded from paper or issued here.
  if (!grdOk('billing') && !(await guardAsk('billing', rec ? 'record a credit note' : 'issue a credit note'))) return;
  if (_billForm !== f) return;
  // Warn, never block: a credit larger than what is left on the invoice is the operator's call.
  if (inv) {
    var room = cnInvoiceHeadroom(inv, null);
    if (f.taxable > room + 0.005 && !(await uiConfirm({ title: 'More than the invoice has left',
        body: 'This credits ' + formatCurrency(f.taxable) + ' taxable against ' + inv.displayNumber +
        ', which has ' + formatCurrency(room) + ' left after the notes already taken against it.\n\nIssue it anyway?', okLabel: 'Issue anyway' }))) return;
  }

  // The number: the next in the series for a new note; the printed one for a recorded note,
  // refused if the series already holds it — a credit note number is issued, never reused.
  // A number is unique within its financial year's series (a note stating no year is this year's):
  // CN/004/25-26 does not hold CN/004/26-27, and CN/007 typed without a year is CN/007/26-27.
  var num, display;
  if (rec) {
    num = parseInt(f.num, 10);
    if (!(num > 0)) { showToast('Enter the number printed on the note', 'error'); return; }
    var fy = billsCnFy(f.fy), cur = cnFyShort();
    display = 'CN/' + cnPadNum(num) + (fy ? '/' + fy : '');
    if (getCreditNotes().some(function(x) { return parseInt(x.cnNumber, 10) === num && (billsCnFy(cnNoteFy(x)) || cur) === (fy || cur); })) {
      showToast(display + ' is already in the series', 'error'); return;
    }
  } else {
    num = recomputeNextCnNumber();
    display = cnDisplayNumber(num);
  }
  // Dated outside the financial year its number's series names (a recorded note's own year, as typed): asked, never
  // refused (seriesFyAsk, number-audit.js).
  var fyAsk = seriesFyAsk('This credit note', display, rec ? (String(f.fy || '').trim() || cnFyShort()) : cnFyShort(), f.date);
  if (fyAsk && !(await uiConfirm(fyAsk))) return;

  var c = _billsCnFigures();
  var qty = f.qty > 0 ? f.qty : null;
  var rebate = f.reason === 'rebate';
  var pct = rebate && f.pct > 0 ? f.pct : null;
  // The invoice's own snapshot where there is one; a typed invoice falls back to the client master,
  // or the note prints no buyer address and its CDNR row takes the home state as place of supply.
  var addr = (inv && inv.clientAddress) || { add1: client.add1, add2: client.add2, add3: client.add3, state: client.state, stateCode: client.stateCode };
  var invDate = inv ? (inv.date || '') : (f.invDate || '');
  var reasonText = cnReasonLabel(f.reason) + (String(f.note || '').trim() ? ': ' + String(f.note).trim() : '');
  var cn = {
    id: 'CN-' + Date.now(),
    cnNumber: cnPadNum(num),
    displayNumber: display,
    date: f.date,
    clientId: client.id, clientName: client.name,
    clientGSTIN: (inv && inv.clientGSTIN) || client.gstin || '',
    clientAddress: { add1: addr.add1 || '', add2: addr.add2 || '', add3: addr.add3 || '', state: addr.state || '', stateCode: addr.stateCode || '' },
    invoiceIds: inv ? [inv.id] : [],
    invoiceNumbers: [inv ? inv.displayNumber : typedNo],
    invoiceDates: [invDate],
    againstInvoice: inv ? inv.displayNumber : typedNo,
    againstInvoiceId: inv ? inv.id : '',
    againstInvoiceDate: invDate,
    // A rebate states the period it was taken on; any other note is about its one invoice.
    periodFrom: rebate && f.from ? f.from : (invDate || f.date),
    periodTo: rebate && f.to ? f.to : (invDate || f.date),
    spanDays: 0,
    kind: rebate ? 'rebate' : 'adjustment',
    reasonKey: f.reason,
    reason: reasonText,
    discountPct: pct,
    batchTaxable: pct ? gstRound(c.taxable * 100 / pct) : null,
    particulars: CN_PARTICULARS,
    unit: f.unit || 'KG', qty: qty, rate: qty ? gstRound(c.taxable / qty) : null,
    gstType: c.gstType,
    taxableValue: c.taxable,
    cgstPer: c.cgstPer, cgstAmt: c.cgstAmt, sgstPer: c.sgstPer, sgstAmt: c.sgstAmt, igstPer: c.igstPer, igstAmt: c.igstAmt,
    grandTotal: c.grandTotal,
    amountInWords: numberToWords(c.grandTotal),
    taxInWords: numberToWords(gstRound(c.cgstAmt + c.sgstAmt + c.igstAmt)),
    vehicleNo: '',
    status: 'active',
    recorded: rec || undefined,
    createdAt: Date.now(), updatedAt: Date.now()
  };
  getCreditNotes().push(cn);
  recomputeNextCnNumber();
  saveState();
  // A note recorded from paper is one of several typed at a sitting: the form stays, on the same client and reason, with the
  // figures cleared. A new note opens its preview, which is where it goes next.
  if (rec) {
    var keep = _billForm;
    billsCnFormOpen('record');
    _billForm.clientId = keep.clientId; _billForm.reason = keep.reason; _billForm.fy = billsCnFy(keep.fy); _billForm.saved = (keep.saved || 0) + 1;
  } else _billForm = null;
  renderCreditNoteList(true);
  cnRegisterRefresh();
  showToast(cn.displayNumber + (rec ? ' recorded — ' : ' issued — ') + formatCurrency(cn.grandTotal) + (rec ? ' · the form is ready for the next' : ''));
  if (!rec) showCreditNotePreview(cn.id);
}

/* ---------- Stock line: name and unit ---------- */
var STOCK_UNIT_CHOICES = ['kg', 'g', 'L', 'mL', 'nos', 'bag', 'drum', 'can'];

/* A rename keeps every spelling the line was known by, so a pasted message written the old
   way still lands on it. A unit change converts nothing, and says so before it is made. */
async function stockEditSave(itemId) {
  var it = stockItem(itemId);
  if (!it) return;
  var nameEl = document.getElementById('stockEditName'), unitEl = document.getElementById('stockEditUnit');
  var name = String(nameEl ? nameEl.value : '').trim().replace(/\s+/g, ' ');
  var unit = unitEl ? unitEl.value : it.unit;
  if (!name) { showToast('A stock line needs a name', 'error'); return; }
  var key = stockKey(name);
  var clash = stockData().items.find(function(o) { return o.id !== it.id && (o.key === key || stockAliases(o).indexOf(key) >= 0); });
  if (clash) { showToast('"' + name + '" is already read as ' + clash.name + '. Pick another name.', 'error'); return; }
  var used = stockData().entries.some(function(e) { return e.itemId === it.id && !e.voided; });
  if (unit !== (it.unit || '') && used && !(await uiConfirm({ title: 'Change the unit from ' + (it.unit || 'not set') + ' to ' + (unit || 'not set') + '?',
      body: 'The figures already recorded are not converted: 40 ' + (it.unit || 'units') + ' will read as 40 ' + (unit || 'units') + '. Change it only if the unit was wrong.',
      okLabel: 'Change unit' }))) return;
  if (name !== it.name) {
    var old = stockKey(it.name);
    it.aliases = stockAliases(it);
    [old, it.key].forEach(function(k) { if (k && k !== key && it.aliases.indexOf(k) < 0) it.aliases.push(k); });
    if (key !== it.key && it.aliases.indexOf(key) < 0) it.aliases.push(key);
    it.name = name;
  }
  it.unit = unit;
  saveState();
  renderStock();
  showToast(it.name + ' saved');
}

/* The line's own settings on its page: how it is used (a setting of the line, applied at once),
   and its name and unit (saved together). */
function stockEditHtml(item) {
  var units = STOCK_UNIT_CHOICES.slice();
  if (item.unit && units.indexOf(item.unit) < 0) units.unshift(item.unit);
  var seg = function(v, l, on) { return '<button type="button" class="inv-seg-btn" data-action="invStockBasis" data-v="' + v + '" aria-pressed="' + on + '">' + l + '</button>'; };
  return '<div class="inv-panel inv-panel-flush" id="stockEdit"><div class="inv-panel-head"><span class="inv-panel-title">The line</span></div><div class="inv-panel-body">' +
    '<div class="inv-field"><span class="inv-field-label" id="stockBasisLabel">How it is used</span><div class="inv-seg" role="group" aria-labelledby="stockBasisLabel">' +
    seg('draw', 'Drawn daily', item.basis !== 'charge') + seg('charge', 'Charged to a bath', item.basis === 'charge') + '</div></div>' +
    '<div class="inv-fields">' +
    '<label class="inv-field"><span class="inv-field-label">Name</span><input class="inv-input" id="stockEditName" value="' + escHtml(item.name) + '" autocomplete="off"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Unit</span><select class="inv-select" id="stockEditUnit">' +
    '<option value=""' + (!item.unit ? ' selected' : '') + '>not set</option>' +
    units.map(function(u) { return '<option' + (item.unit === u ? ' selected' : '') + '>' + escHtml(u) + '</option>'; }).join('') + '</select></label></div>' +
    (stockAliases(item).length ? '<div class="inv-note inv-mb-8">Messages are also read as: ' + stockAliases(item).map(escHtml).join(', ') + '</div>' : '') +
    '<button class="inv-btn inv-btn-secondary" data-action="invStockEditSave" data-id="' + escHtml(item.id) + '">Save name and unit</button></div></div>';
}

/* ---------- Actions ---------- */
function billsAction(action, btn) {
  switch (action) {
    case 'invCnFormOpen': billsCnFormOpen(btn.dataset.mode); return true;
    case 'invCnFormCancel': _billForm = null; renderCreditNoteList(true); return true;
    // The dialog's own ×: the form goes with it (asked first where something was typed).
    case 'invCnListClose': { _billForm = null; var sc = btn.closest('.inv-scrim-dialog'); if (sc) dialogCloseScrim(sc); return true; }
    case 'invCnFormSave': billsCnFormSave(); return true;
    case 'invStockEditSave': stockEditSave(btn.dataset.id); return true;
  }
  return false;
}
