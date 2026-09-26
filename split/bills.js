/* ===== BILLS & NOTES (Stock → Bills & notes) =====
 * Two records that had no findable door (owner, 26 Sep 2026: "We don't have a place to enter
 * electricity bills anywhere in the app … And even credit notes").
 *
 * Electricity and other bills are S.costBills, the same records Stats → Live cost reads; they
 * were entered only at the foot of that card, under "Power". They are entered here now, a month
 * that closed without one is listed as missing, and the To-do rule `power` asks for it.
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

var _billForm = null;   // { mode: 'new' | 'record', ... } — the credit-note form on this view
var _billsMonths = 6;   // closed months checked for a missing electricity bill

function billsMonthLabel(ym) {
  var p = String(ym || '').split('-');
  return p.length === 2 ? TREND_MONTH_LABELS[parseInt(p[1], 10) - 1] + ' ' + p[0] : ym;
}
function billsPrevMonths(n) {
  var out = [], d = new Date(localDateStr() + 'T00:00:00');
  d.setDate(1);
  for (var i = 0; i < n; i++) { d.setMonth(d.getMonth() - 1); out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
  return out;
}
/* A closed month with invoices but no electricity bill. A month the app billed nothing in is
   not asked for: that is a device holding no books, not a missing bill. */
function billsMissingPower() {
  var have = {};
  costBills().forEach(function(b) { if (b.kind === 'power' && !b.voided) have[b.month] = true; });
  return billsPrevMonths(_billsMonths).filter(function(m) {
    return !have[m] && (S.invoices || []).some(function(i) { return i.status === 'active' && i.date && i.date.slice(0, 7) === m; });
  });
}

/* Stock's two views: the chemicals, and the bills and notes that cost the plant and credit its customers. */
function stockTabsHtml(active) {
  var tab = function(key, label) {
    return '<button class="inv-viewtab" role="tab" aria-selected="' + (active === key) + '" data-action="invStockTab" data-tab="' + key + '">' + label + '</button>';
  };
  return '<div class="inv-viewtabs" role="tablist" aria-label="Stock views">' + tab('list', 'Chemicals') + tab('bills', 'Bills & notes') + '</div>';
}

function renderBillsNotes() {
  return stockTabsHtml('bills') + _billsPowerHtml() + _billsNotesHtml();
}

/* ---------- Electricity and other bills ---------- */
function _billsPowerHtml() {
  var bills = costBills().slice().sort(function(a, b) { return a.month < b.month ? 1 : a.month > b.month ? -1 : (b.at || 0) - (a.at || 0); });
  var missing = billsMissingPower();
  var h = '<div class="inv-panel inv-panel-flush" id="billsPower"><div class="inv-panel-head"><span class="inv-panel-title">Electricity and other bills' +
    (bills.length ? ' <span class="inv-panel-count">' + bills.length + '</span>' : '') + '</span>' +
    (_costBillOpen ? '' : '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invCostBillOpen" data-where="stock">Add bill</button>') + '</div>';
  if (_costBillOpen && _costBillOpen.where === 'stock') h += '<div class="inv-panel-body">' + costBillFormHtml() + '</div>';
  /* One list in month order: a missing month sits where its bill would. */
  var rows = missing.map(function(m) { return { month: m, missing: true }; }).concat(bills.map(function(b) { return { month: b.month, bill: b }; }));
  rows.sort(function(a, b) { return a.month < b.month ? 1 : a.month > b.month ? -1 : (a.missing ? -1 : b.missing ? 1 : 0); });
  if (!bills.length && !missing.length) {
    h += '<div class="inv-empty">No bills recorded. Until there are, Live cost prices electricity and the other costs at the Settings fallbacks.</div>';
  }
  rows.forEach(function(r) {
    if (r.missing) {
      var m = r.month;
      h += '<div class="inv-row" data-missing="' + m + '"><span class="inv-row-main"><span class="inv-dot inv-dot-warning">No electricity bill for ' + escHtml(billsMonthLabel(m)) + '</span></span>' +
      '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCostBillOpen" data-where="stock" data-month="' + m + '">Add</button></span></div>';
      return;
    }
    var b = r.bill;
    var meta = [b.units ? formatNum(b.units, 0) + ' units' : '', b.note || '', b.voided ? 'void: ' + (b.voidReason || '') : ''].filter(Boolean).join(' · ');
    h += '<div class="inv-row inv-row-2' + (b.voided ? ' inv-row-muted' : '') + '" data-bill="' + escHtml(b.id) + '"><span class="inv-row-main">' +
      '<span class="inv-row-title">' + escHtml((b.label || COST_BILL_KINDS[b.kind] || b.kind) + ' · ' + billsMonthLabel(b.month)) + '</span>' +
      (meta ? '<span class="inv-row-meta">' + escHtml(meta) + '</span>' : '') + '</span>' +
      '<span class="inv-row-end"><span class="inv-num">' + formatCurrency(b.amount) + '</span>' +
      (b.voided ? '<span class="inv-dot inv-dot-neutral">Void</span>' : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCostBillVoid" data-id="' + escHtml(b.id) + '">Void</button>') +
      '</span></div>';
  });
  return h + '</div>';
}

/* ---------- Credit notes ---------- */
function _billsNotesHtml() {
  var notes = getCreditNotes().slice().sort(function(a, b) { return (parseInt(b.cnNumber, 10) || 0) - (parseInt(a.cnNumber, 10) || 0); });
  var h = '<div class="inv-panel inv-panel-flush" id="billsNotes"><div class="inv-panel-head"><span class="inv-panel-title">Credit notes' +
    (notes.length ? ' <span class="inv-panel-count">' + notes.length + '</span>' : '') + '</span>' +
    (_billForm ? '' : '<span class="inv-toolbar inv-toolbar-tight">' +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCnFormOpen" data-mode="record">Record issued</button>' +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCnFormOpen" data-mode="new">New note</button></span>') + '</div>';
  if (_billForm) h += '<div class="inv-panel-body">' + _billsCnFormHtml() + '</div>';
  if (!notes.length) {
    h += '<div class="inv-empty">No credit notes. The batch rebate is raised from a Register selection; any other note, or one already issued, is entered here.</div>';
  }
  notes.forEach(function(cn) {
    var cancelled = cn.status === 'cancelled';
    var kind = cnIsRebate(cn) ? 'Batch rebate' + (cn.discountPct ? ' ' + cn.discountPct + '%' : '') : (cn.reason || 'Credit note');
    h += '<div class="inv-row inv-row-2' + (cancelled ? ' inv-row-muted' : '') + '" data-cn="' + escHtml(cn.id) + '">' +
      '<button class="inv-row-main" data-action="invCnPreview" data-id="' + escHtml(cn.id) + '">' +
      '<span class="inv-row-title"><span class="inv-id" title="' + escHtml(cn.displayNumber) + '">CN/' + escHtml(cn.cnNumber) + '</span> · ' + escHtml(cn.clientName) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(formatDate(cn.date)) + ' · ' + escHtml(kind) + ' · against ' + escHtml(cnAgainstInvoiceLabel(cn)) +
      (cn.recorded ? ' · recorded' : '') + '</span></button>' +
      '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + formatCurrency(cn.grandTotal) + '</span>' +
      (cancelled ? '<span class="inv-dot inv-dot-danger">Cancelled</span>' : '<span class="inv-row-meta inv-num">' + formatCurrency(cn.taxableValue) + ' taxable</span>') + '</span>' +
      (cancelled ? '' : '<button class="inv-btn inv-btn-danger inv-btn-sm" data-action="invCnCancel" data-id="' + escHtml(cn.id) + '">Cancel</button>') + '</span></div>';
  });
  if (notes.length) h += '<div class="inv-row"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invExportCreditNotes">Credit notes CSV</button></div>';
  return h + '</div>';
}

function _billsClientOptions(sel) {
  var ids = {};
  (S.invoices || []).forEach(function(i) { ids[i.clientId] = true; });
  return S.clients.filter(function(c) { return ids[c.id]; }).sort(function(a, b) { return a.name < b.name ? -1 : 1; })
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
    field('Client', 'cnfClient', '<select class="inv-select" id="cnfClient"><option value="">Choose a client</option>' + _billsClientOptions(f.clientId) + '</select>') +
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
  var c = _billsCnFigures();
  if (c) h += '<div class="inv-callout inv-mb-8" data-cn-figures>' + formatCurrency(c.taxable) + ' taxable + ' + formatCurrency(gstRound(c.cgstAmt + c.sgstAmt + c.igstAmt)) +
    ' GST (' + (c.gstType === 'inter' ? 'IGST 18%' : 'CGST 9% + SGST 9%') + ') = <strong>' + formatCurrency(c.grandTotal) + '</strong></div>';
  return h + '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary" data-action="invCnFormCancel">Cancel</button>' +
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

function billsCnFormOpen(mode) {
  _billForm = { mode: mode === 'record' ? 'record' : 'new', date: localDateStr(), clientId: '', invId: '', reason: mode === 'record' ? 'rebate' : 'rate',
    note: '', taxable: '', qty: '', unit: 'KG', num: '', fy: cnFyShort(), pct: CN_DEFAULT_PCT, from: '', to: '', invNo: '', invDate: '',
    cgst: '', sgst: '', igst: '' };
  renderStock();
}

/* Read the form back into _billForm. A field that changes what the form shows redraws it. */
function billsCnFormInput(t) {
  if (!_billForm || !t.id || t.id.indexOf('cnf') !== 0) return false;
  var map = { cnfNum: 'num', cnfFy: 'fy', cnfDate: 'date', cnfClient: 'clientId', cnfInv: 'invId', cnfInvNo: 'invNo', cnfInvDate: 'invDate',
    cnfReason: 'reason', cnfNote: 'note', cnfPct: 'pct', cnfFrom: 'from', cnfTo: 'to', cnfTaxable: 'taxable', cnfQty: 'qty', cnfUnit: 'unit',
    cnfCgst: 'cgst', cnfSgst: 'sgst', cnfIgst: 'igst' };
  var k = map[t.id];
  if (!k) return false;
  _billForm[k] = ['taxable', 'qty', 'pct', 'cgst', 'sgst', 'igst'].indexOf(k) >= 0 ? (t.value === '' ? '' : parseFloat(t.value)) : t.value;
  if (k === 'clientId') _billForm.invId = '';
  if (['clientId', 'invId', 'reason'].indexOf(k) >= 0) { renderStock(); return true; }
  if (['taxable', 'cgst', 'sgst', 'igst'].indexOf(k) >= 0) {
    var box = document.querySelector('[data-cn-figures]'), c = _billsCnFigures();
    if (c && box) box.innerHTML = formatCurrency(c.taxable) + ' taxable + ' + formatCurrency(gstRound(c.cgstAmt + c.sgstAmt + c.igstAmt)) +
      ' GST (' + (c.gstType === 'inter' ? 'IGST 18%' : 'CGST 9% + SGST 9%') + ') = <strong>' + formatCurrency(c.grandTotal) + '</strong>';
    else if (c && !box) renderStock();
  }
  return true;
}

function billsCnFormSave() {
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
  // Warn, never block: a credit larger than what is left on the invoice is the operator's call.
  if (inv) {
    var room = cnInvoiceHeadroom(inv, null);
    if (f.taxable > room + 0.005 && !confirm('This credits ' + formatCurrency(f.taxable) + ' taxable against ' + inv.displayNumber +
        ', which has ' + formatCurrency(room) + ' left after the notes already taken against it.\n\nIssue it anyway?')) return;
  }

  // The number: the next in the series for a new note; the printed one for a recorded note,
  // refused if the series already holds it — a credit note number is issued, never reused.
  var num;
  if (rec) {
    num = parseInt(f.num, 10);
    if (!(num > 0)) { showToast('Enter the number printed on the note', 'error'); return; }
    var fy = String(f.fy || '').trim();
    var display = 'CN/' + cnPadNum(num) + (fy ? '/' + fy : '');
    if (getCreditNotes().some(function(x) { return x.displayNumber === display || (parseInt(x.cnNumber, 10) === num && (!fy || fy === cnFyShort())); })) {
      showToast(display + ' is already in the series', 'error'); return;
    }
  } else {
    num = recomputeNextCnNumber();
  }

  var c = _billsCnFigures();
  var qty = f.qty > 0 ? f.qty : null;
  var rebate = f.reason === 'rebate';
  var pct = rebate && f.pct > 0 ? f.pct : null;
  var addr = (inv && inv.clientAddress) || {};
  var invDate = inv ? (inv.date || '') : (f.invDate || '');
  var reasonText = cnReasonLabel(f.reason) + (String(f.note || '').trim() ? ': ' + String(f.note).trim() : '');
  var cn = {
    id: 'CN-' + Date.now(),
    cnNumber: cnPadNum(num),
    displayNumber: rec ? 'CN/' + cnPadNum(num) + (String(f.fy || '').trim() ? '/' + String(f.fy).trim() : '') : cnDisplayNumber(num),
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
  _billForm = null;
  renderStock();
  showToast(cn.displayNumber + (rec ? ' recorded — ' : ' issued — ') + formatCurrency(cn.grandTotal));
  if (!rec) showCreditNotePreview(cn.id);
}

/* ---------- Stock line: name and unit ---------- */
var STOCK_UNIT_CHOICES = ['kg', 'g', 'L', 'mL', 'nos', 'bag', 'drum', 'can'];

/* A rename keeps every spelling the line was known by, so a pasted message written the old
   way still lands on it. A unit change converts nothing, and says so before it is made. */
function stockEditSave(itemId) {
  var it = stockItem(itemId);
  if (!it) return;
  var nameEl = document.getElementById('stockEditName'), unitEl = document.getElementById('stockEditUnit');
  var name = String(nameEl ? nameEl.value : '').trim().replace(/\s+/g, ' ');
  var unit = unitEl ? unitEl.value : it.unit;
  if (!name) { showToast('A stock line needs a name', 'error'); return; }
  var key = stockKey(name);
  var clash = stockData().items.find(function(o) { return o.id !== it.id && (o.key === key || (o.aliases || []).indexOf(key) >= 0); });
  if (clash) { showToast('"' + name + '" is already read as ' + clash.name + '. Pick another name.', 'error'); return; }
  var used = stockData().entries.some(function(e) { return e.itemId === it.id && !e.voided; });
  if (unit !== (it.unit || '') && used && !confirm('Change the unit from ' + (it.unit || 'not set') + ' to ' + (unit || 'not set') + '?\n\n' +
      'The figures already recorded are not converted: 40 ' + (it.unit || 'units') + ' will read as 40 ' + (unit || 'units') + '. Change it only if the unit was wrong.')) return;
  if (name !== it.name) {
    var old = stockKey(it.name);
    it.aliases = (it.aliases || []).slice();
    [old, it.key].forEach(function(k) { if (k && k !== key && it.aliases.indexOf(k) < 0) it.aliases.push(k); });
    if (key !== it.key && it.aliases.indexOf(key) < 0) it.aliases.push(key);
    it.name = name;
  }
  it.unit = unit;
  saveState();
  renderStock();
  showToast(it.name + ' saved');
}

function stockEditHtml(item) {
  var units = STOCK_UNIT_CHOICES.slice();
  if (item.unit && units.indexOf(item.unit) < 0) units.unshift(item.unit);
  return '<div class="inv-panel" id="stockEdit"><div class="inv-panel-head inv-mb-8"><span class="inv-panel-title">Name and unit</span></div>' +
    '<div class="inv-fields">' +
    '<label class="inv-field"><span class="inv-field-label">Name</span><input class="inv-input" id="stockEditName" value="' + escHtml(item.name) + '" autocomplete="off"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Unit</span><select class="inv-select" id="stockEditUnit">' +
    '<option value=""' + (!item.unit ? ' selected' : '') + '>not set</option>' +
    units.map(function(u) { return '<option' + (item.unit === u ? ' selected' : '') + '>' + escHtml(u) + '</option>'; }).join('') + '</select></label></div>' +
    ((item.aliases || []).length ? '<div class="inv-note inv-mb-8">Messages are also read as: ' + item.aliases.map(escHtml).join(', ') + '</div>' : '') +
    '<button class="inv-btn inv-btn-secondary" data-action="invStockEditSave" data-id="' + escHtml(item.id) + '">Save name and unit</button></div>';
}

/* ---------- Actions ---------- */
function billsAction(action, btn) {
  switch (action) {
    case 'invStockTab': stockSetView(btn.dataset.tab === 'bills' ? 'bills' : 'list'); return true;
    case 'invCnFormOpen': billsCnFormOpen(btn.dataset.mode); return true;
    case 'invCnFormCancel': _billForm = null; renderStock(); return true;
    case 'invCnFormSave': billsCnFormSave(); return true;
    case 'invStockEditSave': stockEditSave(btn.dataset.id); return true;
  }
  return false;
}
