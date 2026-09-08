/* ===== CREDIT NOTES ===== */
/*
 * SSS Mehta hold a standing 2% discount on any payment batch spanning seven
 * days or more — a price paid for smoother cash flow, temporary but in force.
 * Each such batch ships as two documents: the sales register for the range, and
 * a credit note for 2% of it. So the **batch is the unit, not the invoice**,
 * which is why the 04/08/26 reference credits ₹5,902.12 against roughly ₹2.95L
 * of taxable — about a month of invoices, not the single one it names.
 *
 * That makes the register selection the natural input: tick the batch, export
 * its register, raise the credit note off the same set.
 *
 * The discount is computed on **value**, and the quantity is derived from it.
 * The reference proves the direction: 1092.98 × 5.40 = 5902.09, but it shows
 * 5902.12. Three paise of disagreement only happen if the rupees came first.
 *
 * Deviations from the reference, all deliberate — unlike the quality
 * certificate, no external approval binds this format:
 *   - "Amount Chargeable (in words)" states the Total. The reference printed
 *     the sub-total there, so the words disagreed with the figure beside them.
 *   - The tax-in-words line states total tax, not one of the two components.
 *   - Company identity comes from S.company, so the header and footer cannot
 *     disagree the way the reference's "SOMA ELECTRO PRODUCT" / "8-B, 1ST
 *     PHASE" did with its own footer.
 *   - The document names the batch it credits rather than one invoice of it.
 *     A consolidated credit note is legal, but it should say what it covers.
 */

var CN_DEFAULT_PCT = 2;
var CN_BATCH_MIN_DAYS = 7;
var CN_PARTICULARS = 'JOB WORK ( ELECTRO PLATING )';

/* Financial year tail of the credit note series, read off the invoice prefix so
   the two documents always agree on the year: 'SEP/2026-27/' → '26-27'. */
function cnFyShort() {
  var m = String(S.invPrefix || '').match(/(\d{4})\s*-\s*(\d{2,4})/);
  if (!m) return '';
  var y2 = m[2].length === 4 ? m[2].slice(2) : m[2];
  return m[1].slice(2) + '-' + y2;
}

function cnPadNum(n) { return String(n).padStart(3, '0'); }

function cnDisplayNumber(num) {
  var fy = cnFyShort();
  return 'CN/' + cnPadNum(num) + (fy ? '/' + fy : '');
}

function getCreditNotes() {
  if (!S.creditNotes) S.creditNotes = [];
  return S.creditNotes;
}

/* A credit note number is issued — the customer holds a document bearing it —
   so by the same rule that governs invoice numbers it may never be reused.
   It needs no separate void ledger, though: a credit note is cancelled, never
   deleted, which is the correct GST treatment anyway. The number stays in the
   series carrying its own explanation, and exports declare it at zero. */
function recomputeNextCnNumber() {
  var highest = 0;
  getCreditNotes().forEach(function(cn) {
    var n = parseInt(cn.cnNumber, 10);
    if (!isNaN(n) && n > highest) highest = n;
  });
  if (!S.cnNextNum || S.cnNextNum <= highest) S.cnNextNum = highest + 1;
  return S.cnNextNum;
}

/* Whole days between the earliest and latest invoice date in the batch. */
function cnBatchSpanDays(invoices) {
  var dates = invoices.map(function(i) { return i.date; }).filter(Boolean).sort();
  if (dates.length === 0) return 0;
  var a = new Date(dates[0] + 'T00:00:00');
  var b = new Date(dates[dates.length - 1] + 'T00:00:00');
  return Math.round((b - a) / 86400000) + 1;
}

/* Validate a selection as the base for one credit note, and say precisely what
   is wrong when it is not. Returning the reason rather than hiding the button
   is the difference between "you cannot" and "you cannot, because". */
function cnValidateSelection(invIds) {
  var invoices = (invIds || [])
    .map(function(id) { return S.invoices.find(function(i) { return i.id === id; }); })
    .filter(Boolean);

  var active = invoices.filter(function(i) { return i.status !== 'cancelled'; });
  var cancelled = invoices.length - active.length;

  if (active.length === 0) {
    return { ok: false, reason: 'Select the invoices this credit note covers', invoices: [] };
  }

  var clientIds = {};
  active.forEach(function(i) { clientIds[i.clientId] = true; });
  var names = Object.keys(clientIds);
  if (names.length > 1) {
    return {
      ok: false,
      reason: 'A credit note is addressed to one customer — the selection spans ' + names.length,
      invoices: []
    };
  }

  active.sort(function(a, b) { return String(a.date).localeCompare(String(b.date)); });
  return {
    ok: true,
    invoices: active,
    cancelledSkipped: cancelled,
    client: S.clients.find(function(c) { return c.id === active[0].clientId; }) || null,
    spanDays: cnBatchSpanDays(active)
  };
}

/* Compute the credit from the batch. Value first, quantity derived — the order
   the reference document was itself produced in. */
function cnCompute(invoices, client, pct, rate) {
  var batchTaxable = gstRound(invoices.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0));
  var taxable = gstRound(batchTaxable * (pct || 0) / 100);

  var gstType = (client && client.gstType) || 'intra';
  var cgstPer = gstType === 'intra' ? 9 : 0;
  var sgstPer = gstType === 'intra' ? 9 : 0;
  var igstPer = gstType === 'inter' ? 18 : 0;
  var cgstAmt = gstRound(taxable * cgstPer / 100);
  var sgstAmt = gstRound(taxable * sgstPer / 100);
  var igstAmt = gstRound(taxable * igstPer / 100);
  var grandTotal = gstRound(taxable + cgstAmt + sgstAmt + igstAmt);

  // Quantity exists to make the document readable as a job-work credit; it is
  // the kilograms the credited rupees correspond to at the contract rate, not a
  // separately measured figure. Zero rate would make it meaningless, so it is
  // left blank rather than dividing by zero.
  var qty = rate > 0 ? gstRound(taxable / rate) : 0;

  return {
    batchTaxable: batchTaxable,
    taxable: taxable,
    gstType: gstType,
    cgstPer: cgstPer, cgstAmt: cgstAmt,
    sgstPer: sgstPer, sgstAmt: sgstAmt,
    igstPer: igstPer, igstAmt: igstAmt,
    grandTotal: grandTotal,
    rate: rate, qty: qty
  };
}

/* The rate the batch was billed at, for the derived quantity. Read from the
   client ladder at the batch's own date, not today's — a rate change between
   the batch and the credit note must not silently restate the quantity. */
function cnBatchRate(client, invoices) {
  if (!client) return 0;
  var onDate = invoices.length ? invoices[invoices.length - 1].date : localDateStr();
  var info = getLineItemRate(client, onDate, '');
  return info.ratePerKg || 0;
}

/* ===== FORM ===== */
var _cnForm = null;

function openCreditNoteForm(invIds) {
  var v = cnValidateSelection(invIds);
  if (!v.ok) { showToast(v.reason, 'error'); return; }

  var rate = cnBatchRate(v.client, v.invoices);
  _cnForm = {
    invoiceIds: v.invoices.map(function(i) { return i.id; }),
    clientId: v.client ? v.client.id : null,
    pct: CN_DEFAULT_PCT,
    date: localDateStr(),
    vehicleNo: '',
    rate: rate,
    spanDays: v.spanDays,
    cancelledSkipped: v.cancelledSkipped
  };
  renderCreditNoteForm();
}

function renderCreditNoteForm() {
  if (!_cnForm) return;
  var invoices = _cnForm.invoiceIds
    .map(function(id) { return S.invoices.find(function(i) { return i.id === id; }); })
    .filter(Boolean);
  var client = S.clients.find(function(c) { return c.id === _cnForm.clientId; });
  var c = cnCompute(invoices, client, _cnForm.pct, _cnForm.rate);
  var from = invoices[0] ? invoices[0].date : '';
  var to = invoices[invoices.length - 1] ? invoices[invoices.length - 1].date : '';

  var html = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Raise Credit Note</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay" aria-label="Close">&times;</button></div>';

  html += '<div class="inv-detail-section">' +
    '<div class="inv-detail-label">Customer</div>' +
    '<div class="inv-detail-value">' + escHtml(client ? client.name : '') + '</div>' +
    '<div class="inv-detail-label inv-mt-8">Batch</div>' +
    '<div class="inv-detail-value">' + invoices.length + ' invoice' + (invoices.length !== 1 ? 's' : '') +
    ', ' + escHtml(formatDate(from)) + ' &ndash; ' + escHtml(formatDate(to)) +
    ' <span class="inv-text-muted">(' + _cnForm.spanDays + ' day' + (_cnForm.spanDays !== 1 ? 's' : '') + ')</span></div>' +
    '</div>';

  // The discount is for batches of a week or more. Split batches are the
  // operator's call, so this warns and does not block.
  if (_cnForm.spanDays < CN_BATCH_MIN_DAYS) {
    html += '<div class="inv-confirm-warn">This batch spans ' + _cnForm.spanDays + ' day' +
      (_cnForm.spanDays !== 1 ? 's' : '') + '. The standing discount is for batches of ' +
      CN_BATCH_MIN_DAYS + ' days or more — raise it anyway only if you mean to.</div>';
  }
  if (_cnForm.cancelledSkipped > 0) {
    html += '<div class="inv-confirm-warn">' + _cnForm.cancelledSkipped +
      ' cancelled invoice' + (_cnForm.cancelledSkipped !== 1 ? 's were' : ' was') +
      ' left out of the base — those goods were never billed.</div>';
  }

  html += '<div class="inv-form-row">' +
    '<div class="inv-form-group"><label class="inv-form-label">Discount %</label>' +
    '<input type="number" step="0.01" min="0" max="100" class="inv-form-input inv-mono" id="cnPct" value="' + escHtml(_cnForm.pct) + '" data-action="invCnInput"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Credit note date</label>' +
    '<input type="date" class="inv-form-input inv-mono" id="cnDate" value="' + escHtml(_cnForm.date) + '" data-action="invCnInput"></div></div>';

  html += '<div class="inv-form-group"><label class="inv-form-label">Vehicle No. (optional)</label>' +
    '<input type="text" class="inv-form-input" id="cnVehicle" value="' + escHtml(_cnForm.vehicleNo) + '" data-action="invCnInput" autocomplete="off"></div>';

  html += '<div class="inv-totals">' +
    '<div class="inv-total-row"><span class="inv-total-label">Batch taxable</span><span class="inv-total-value">' + formatCurrency(c.batchTaxable) + '</span></div>' +
    '<div class="inv-total-row"><span class="inv-total-label">Credit @ ' + escHtml(_cnForm.pct) + '%</span><span class="inv-total-value">' + formatCurrency(c.taxable) + '</span></div>';
  if (c.gstType === 'intra') {
    html += '<div class="inv-total-row"><span class="inv-total-label">CGST @ ' + c.cgstPer + '%</span><span class="inv-total-value">' + formatCurrency(c.cgstAmt) + '</span></div>' +
      '<div class="inv-total-row"><span class="inv-total-label">SGST @ ' + c.sgstPer + '%</span><span class="inv-total-value">' + formatCurrency(c.sgstAmt) + '</span></div>';
  } else {
    html += '<div class="inv-total-row"><span class="inv-total-label">IGST @ ' + c.igstPer + '%</span><span class="inv-total-value">' + formatCurrency(c.igstAmt) + '</span></div>';
  }
  html += '<div class="inv-total-row inv-total-row-grand"><span class="inv-total-label">Total credit</span>' +
    '<span class="inv-total-grand">' + formatCurrency(c.grandTotal) + '</span></div></div>';

  html += '<div class="inv-form-hint">Shown on the note as ' + formatNum(c.qty, 2) + ' KG at &#8377;' +
    formatNum(c.rate, 2) + '/KG &mdash; the kilograms these rupees represent at the batch rate, derived from the value.</div>';

  html += '<div class="inv-btn-bar">' +
    '<button class="inv-btn inv-btn-ghost" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invCnSave">Raise ' + escHtml(cnDisplayNumber(recomputeNextCnNumber())) + '</button></div></div>';

  var existing = document.querySelector('.inv-overlay-scrim');
  if (existing) {
    existing.innerHTML = html;
  } else {
    var scrim = document.createElement('div');
    scrim.className = 'inv-overlay-scrim';
    scrim.innerHTML = html;
    pushFocus();
    document.body.appendChild(scrim);
    document.body.style.overflow = 'hidden';
    focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
  }
}

function captureCnForm() {
  if (!_cnForm) return;
  var p = document.getElementById('cnPct');
  var d = document.getElementById('cnDate');
  var v = document.getElementById('cnVehicle');
  if (p) _cnForm.pct = parseFloat(p.value) || 0;
  if (d) _cnForm.date = d.value;
  if (v) _cnForm.vehicleNo = v.value;
}

function saveCreditNote() {
  if (!_cnForm) return;
  captureCnForm();
  if (!(_cnForm.pct > 0)) { showToast('Discount must be more than zero', 'error'); return; }
  if (!_cnForm.date) { showToast('A credit note needs a date', 'error'); return; }

  var invoices = _cnForm.invoiceIds
    .map(function(id) { return S.invoices.find(function(i) { return i.id === id; }); })
    .filter(Boolean);
  if (invoices.length === 0) { showToast('Those invoices are no longer in the register', 'error'); return; }

  var client = S.clients.find(function(c) { return c.id === _cnForm.clientId; });
  var c = cnCompute(invoices, client, _cnForm.pct, _cnForm.rate);
  var num = recomputeNextCnNumber();
  var addr = invoices[0].clientAddress || {};

  // The note names ONE invoice, and it has to be big enough to carry the credit.
  // WARN, never block: a batch of small invoices is the operator's problem to
  // solve (split the batch, or raise against a later one), and refusing outright
  // would leave them with a discount they owe and no document to issue it on.
  var against = cnPickAgainstInvoice(invoices, c.taxable, null, c.gstType);
  if (!against && !confirm('No invoice in this batch is as large as the credit (\u20b9' +
      formatNum(c.taxable, 2) + ' taxable).\n\nThe note will print without an invoice ' +
      'reference. Raise it anyway?')) return;

  var cn = {
    id: 'CN-' + Date.now(),
    cnNumber: cnPadNum(num),
    displayNumber: cnDisplayNumber(num),
    date: _cnForm.date,
    clientId: _cnForm.clientId,
    clientName: invoices[0].clientName,
    clientGSTIN: invoices[0].clientGSTIN || (client && client.gstin) || '',
    clientAddress: { add1: addr.add1 || '', add2: addr.add2 || '', add3: addr.add3 || '', state: addr.state || '', stateCode: addr.stateCode || '' },
    // The batch, recorded both by id and by number. Numbers are snapshotted so
    // the note still says what it credited after an invoice is deleted — the
    // customer's copy does not lose its reference when ours does.
    invoiceIds: invoices.map(function(i) { return i.id; }),
    invoiceNumbers: invoices.map(function(i) { return i.displayNumber; }),
    // Rule 53(1A)(g) wants the serial number AND the date of each corresponding
    // invoice. Dates are snapshotted for the same reason the numbers are: a
    // deleted invoice must not strip a statutory particular off a document the
    // customer already holds.
    invoiceDates: invoices.map(function(i) { return i.date || ''; }),
    // The single invoice the note is taken against, stamped so the number on the
    // customer's copy cannot move if the register later changes.
    againstInvoice: (against && against.displayNumber) || '',
    againstInvoiceId: (against && against.id) || '',
    againstInvoiceDate: (against && against.date) || '',
    periodFrom: invoices[0].date,
    periodTo: invoices[invoices.length - 1].date,
    spanDays: cnBatchSpanDays(invoices),
    discountPct: _cnForm.pct,
    batchTaxable: c.batchTaxable,
    reason: 'Standing ' + _cnForm.pct + '% batch discount',
    particulars: CN_PARTICULARS,
    unit: 'KG', rate: c.rate, qty: c.qty,
    gstType: c.gstType,
    taxableValue: c.taxable,
    cgstPer: c.cgstPer, cgstAmt: c.cgstAmt,
    sgstPer: c.sgstPer, sgstAmt: c.sgstAmt,
    igstPer: c.igstPer, igstAmt: c.igstAmt,
    grandTotal: c.grandTotal,
    amountInWords: numberToWords(c.grandTotal),
    taxInWords: numberToWords(gstRound(c.cgstAmt + c.sgstAmt + c.igstAmt)),
    vehicleNo: _cnForm.vehicleNo,
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  getCreditNotes().push(cn);
  S.cnNextNum = num + 1;
  saveState();
  _cnForm = null;
  closeOverlay();
  _regSelected = {};
  _renderRegView();
  _renderRegSelBar();
  showToast(cn.displayNumber + ' raised — ' + formatCurrency(cn.grandTotal));
  showCreditNotePreview(cn.id);
}

/* Cancelled, never deleted: the customer holds a document bearing the number
   and a credit note is reversed by cancelling it, not by making it vanish. */
function cancelCreditNote(cnId) {
  var cn = getCreditNotes().find(function(x) { return x.id === cnId; });
  if (!cn || cn.status === 'cancelled') return;
  cn.status = 'cancelled';
  cn.cancelledAt = Date.now();
  cn.updatedAt = Date.now();
  saveState();
  closeOverlay();
  renderCreditNoteList();
  showToast(cn.displayNumber + ' cancelled — the number stays in the series');
}

/* ===== PRINTED DOCUMENT ===== */
function buildCreditNoteHtml(cn) {
  var co = S.company || {};
  var a = cn.clientAddress || {};
  var addrHtml = [a.add1, a.add2, a.add3].filter(Boolean).map(escHtml).join('<br>');
  var partyHtml = '<div class="inv-cn-party-name">' + escHtml(cn.clientName) + '</div>' +
    (addrHtml ? '<div>' + addrHtml + '</div>' : '') +
    '<div>GST # ' + escHtml(cn.clientGSTIN || 'N/A') + '</div>';

  var html = '<div class="inv-cn-doc">';

  // Identity block. Company details come from S.company so the header and the
  // footer are the same fact, not two transcriptions of it.
  html += '<div class="inv-cn-top">' +
    '<div class="inv-cn-seller">' +
    '<div class="inv-cn-seller-name">' + escHtml(co.name || '') + '</div>' +
    '<div>' + [co.add1, co.add2, co.add3].filter(Boolean).map(escHtml).join('<br>') + '</div>' +
    '<div>State Code : ' + escHtml(co.stateCode || '') + '</div>' +
    '<div>GSTIN : ' + escHtml(co.gstin || '') + '</div></div>' +
    '<table class="inv-cn-meta">' +
    '<tr><td class="inv-cn-meta-l">Credit note No</td><td class="inv-cn-meta-v"><strong>' + escHtml(cn.displayNumber) + '</strong></td></tr>' +
    '<tr><td class="inv-cn-meta-l">Credit note Date</td><td class="inv-cn-meta-v">' + escHtml(formatDateExport(cn.date)) + '</td></tr>' +
    // ONE invoice number, at the customer's request — the invoice the credit is
    // taken against. The batch it was COMPUTED from is still stated in full on
    // the annex below, which is what keeps a consolidated note auditable.
    '<tr><td class="inv-cn-meta-l">Against Invoice</td><td class="inv-cn-meta-v"><strong>' +
    escHtml(cnAgainstInvoiceLabel(cn)) + '</strong>' +
    (cnAgainstInvoiceDate(cn) ? ' <span class="inv-cn-meta-sub">dated ' +
      escHtml(formatDateExport(cnAgainstInvoiceDate(cn))) + '</span>' : '') + '</td></tr>' +
    '<tr><td class="inv-cn-meta-l">Period</td><td class="inv-cn-meta-v">' +
    escHtml(formatDateExport(cn.periodFrom)) + ' &ndash; ' + escHtml(formatDateExport(cn.periodTo)) + '</td></tr>' +
    '<tr><td class="inv-cn-meta-l">Reason</td><td class="inv-cn-meta-v">' + escHtml(cn.reason || '') + '</td></tr>' +
    '</table></div>';

  html += '<div class="inv-cn-parties">' +
    '<div class="inv-cn-party"><div class="inv-cn-party-title">Buyer Billing Address :</div>' + partyHtml + '</div>' +
    '<div class="inv-cn-party"><div class="inv-cn-party-title">Buyer Shipping Address :</div>' + partyHtml + '</div></div>';

  html += '<div class="inv-cn-band">PRODUCTS SUPPLIED</div>';
  var gstRate = (cn.cgstPer || 0) + (cn.sgstPer || 0) + (cn.igstPer || 0);
  html += '<table class="inv-cn-table"><thead><tr>' +
    '<th>Sl. No.</th><th>PARTICULARS</th><th>GST Rate</th><th>Quantity</th>' +
    '<th>UOM</th><th>Rate</th><th>Amount</th></tr></thead><tbody>' +
    '<tr><td class="inv-cn-c">1</td><td>' + escHtml(cn.particulars || CN_PARTICULARS) + '</td>' +
    '<td class="inv-cn-c">' + gstRate + '%</td>' +
    '<td class="inv-cn-num">' + formatNum(cn.qty, 2) + '</td>' +
    '<td class="inv-cn-c">' + escHtml(cn.unit || 'KG') + '</td>' +
    '<td class="inv-cn-num">' + formatNum(cn.rate, 2) + '</td>' +
    '<td class="inv-cn-num">' + formatNum(cn.taxableValue, 2) + '</td></tr>' +
    '</tbody></table>';

  html += '<table class="inv-cn-totals">' +
    '<tr><td class="inv-cn-tot-l">SUB TOTAL</td><td class="inv-cn-num">' + formatNum(cn.taxableValue, 2) + '</td></tr>';
  if (cn.gstType === 'intra') {
    html += '<tr><td class="inv-cn-tot-l">SGST</td><td class="inv-cn-num">' + formatNum(cn.sgstAmt, 2) + '</td></tr>' +
      '<tr><td class="inv-cn-tot-l">CGST</td><td class="inv-cn-num">' + formatNum(cn.cgstAmt, 2) + '</td></tr>';
  } else {
    html += '<tr><td class="inv-cn-tot-l">IGST</td><td class="inv-cn-num">' + formatNum(cn.igstAmt, 2) + '</td></tr>';
  }
  html += '<tr class="inv-cn-grand"><td class="inv-cn-tot-l">Total</td><td class="inv-cn-num">' + formatNum(cn.grandTotal, 2) + '</td></tr></table>';

  // The reference printed the sub-total in this box while the figure beside it
  // was the total. Stated as the total here, which is what is chargeable.
  html += '<div class="inv-cn-words-row">' +
    '<div class="inv-cn-words-box"><div class="inv-cn-words-title">Amount Chargeable (in words)</div>' +
    '<div>' + escHtml(cn.amountInWords || numberToWords(cn.grandTotal)) + '</div>' +
    '<div class="inv-cn-pan">Company PAN No. &nbsp; ' + escHtml(cnPanFromGstin(co.gstin)) + '</div></div>' +
    '<table class="inv-cn-taxsum"><tr><th>Taxable Value</th>' +
    (cn.gstType === 'intra' ? '<th colspan="2">CGST</th><th colspan="2">SGST</th>' : '<th colspan="2">IGST</th>') +
    '</tr><tr><th></th>' + (cn.gstType === 'intra' ? '<th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th>' : '<th>Rate</th><th>Amount</th>') + '</tr>' +
    '<tr><td class="inv-cn-num">' + formatNum(cn.taxableValue, 2) + '</td>' +
    (cn.gstType === 'intra'
      ? '<td class="inv-cn-c">' + cn.cgstPer + '%</td><td class="inv-cn-num">' + formatNum(cn.cgstAmt, 2) + '</td>' +
        '<td class="inv-cn-c">' + cn.sgstPer + '%</td><td class="inv-cn-num">' + formatNum(cn.sgstAmt, 2) + '</td>'
      : '<td class="inv-cn-c">' + cn.igstPer + '%</td><td class="inv-cn-num">' + formatNum(cn.igstAmt, 2) + '</td>') +
    '</tr></table></div>';

  // Total tax, not one of its two halves — the reference printed only CGST here.
  html += '<div class="inv-cn-taxwords">Tax Amount (in words) : ' +
    escHtml(cn.taxInWords || numberToWords(gstRound((cn.cgstAmt || 0) + (cn.sgstAmt || 0) + (cn.igstAmt || 0)))) + '</div>';

  // The batch the discount was COMPUTED on, in full. Since the note is now
  // attributed to a single invoice above, this list is no longer a second
  // reference that would contradict it — it is the working, and it stays,
  // because a consolidated 2% that cannot be checked against the turnover it
  // was taken on is not auditable.
  // ⚠ THE CAPTION IS THE COMPLIANCE SENTENCE, not decoration. s.15(3)(b) allows a
  // post-supply discount to reduce taxable value only where it is SPECIFICALLY
  // LINKED to the relevant invoices, and naming all fourteen is how this note
  // satisfies that limb — the register records it as CN/006's substantive
  // improvement over CN/005. An intermediate version of this line read "Computed
  // on (N invoices)", which asserts an arithmetic basis and drops the linkage
  // claim. Both readings now, because the document needs both.
  html += '<div class="inv-cn-annex"><div class="inv-cn-annex-title">Invoices credited (' +
    (cn.invoiceNumbers || []).length + ') &mdash; the discount is computed on this batch, taxable ' +
    formatNum(cn.batchTaxable, 2) +
    ' at ' + escHtml(cn.discountPct) + '%</div>' +
    '<div class="inv-cn-annex-list">' + cnAnnexEntries(cn).map(escHtml).join(' \u00b7 ') + '</div></div>';

  html += '<div class="inv-cn-foot">' +
    '<div class="inv-cn-foot-left">' +
    '<div><strong>N.B:</strong> The chemicals other than I.P/B.P chemicals are sold</div>' +
    '<div>Vehicle No. : ' + escHtml(cn.vehicleNo || '') + '</div>' +
    '<div>Date &amp; Time : ' + escHtml(formatDateExport(cn.date)) + '</div></div>' +
    '<div class="inv-cn-foot-right"><div class="inv-cn-eoe">E. &amp; O. E.</div>' +
    '<div class="inv-cn-sig-co">' + escHtml(co.name || '') + '</div>' +
    '<div>' + [co.add1, co.add2].filter(Boolean).map(escHtml).join('<br>') + '</div>' +
    '<div>GSTIN : ' + escHtml(co.gstin || '') + '</div>' +
    '<div class="inv-cn-sig-line">Authorised Signatory</div></div></div>';

  html += '</div>';
  return html;
}

/* ===== THE NOTE NAMES ONE INVOICE, NOT THE RANGE =====

   The customer asked for a single invoice number on the face of the document
   rather than `00745 – 00804 (14 invoices)`. That is a change to what the note
   is ATTRIBUTED to, not to how it is computed: the discount is still 2% of the
   whole batch, and the batch is still recorded in full on the annex and in
   `invoiceNumbers`.

   **The chosen invoice must be able to absorb the credit** — the reason this
   picks on value rather than taking the first or the last of the batch.

   ⚠ Be exact about WHERE the negative would appear, because an earlier version
   of this comment was not. Since the September-2020 de-linking, GSTR-1 table 9B
   is keyed on the note alone and nothing in the return nets a credit note against
   a named invoice — so the defect is not "a negative invoice" in our own filing.
   It lands on the RECIPIENT: a credit exceeding the invoice it is taken against
   drives their ledger for that supply below zero and asks them to reverse more
   input tax credit than they ever took. The rule is right; the reason is theirs,
   not ours.

   The pick is the LARGEST qualifying invoice by taxable value, tie-broken by the
   highest number. Largest for the most headroom, and it is the rule least able
   to hit the "too small" trap the register already records against `000718`.

   ⚠ THE PICK IS NOT INVARIANT, and an earlier version of this comment claimed it
   was "the same property the certificate reference has". It is not. `QC/<num>/<line>`
   is STRUCTURALLY derived and cannot move; this reads a MUTABLE money field, and
   those fields do move — CN/006's stored `batchTaxable` already disagrees with the
   sum of its own invoices by ₹81.00. On live data the margin between first and
   second place is ₹640.58, so a correction of that size flips the answer.

   THAT is why the result is STAMPED on the note at creation (`againstInvoice`).
   The stamp is what makes a reprint stable; the rule alone never was. Recomputation
   exists only for notes raised before the stamp did. */
function cnPickAgainstInvoice(invoices, cnTaxable, exceptCnId, gstType) {
  var need = Number(cnTaxable) || 0;
  // A CANCELLED invoice certifies nothing and credits nothing — it exports at
  // zero and appears in GSTR-1 at zero, so naming one would attribute a credit
  // to a supply that was never billed. The same rule the quality certificate
  // already enforces. The creation path never sees one (`cnValidateSelection`
  // hands over active invoices only); the RETROACTIVE path maps raw
  // `invoiceIds`, so the guard has to live here, where both paths meet.
  var ok = (invoices || []).filter(function(i) {
    if (!i || i.status === 'cancelled') return false;
    return cnInvoiceHeadroom(i, exceptCnId) >= need;
  });
  if (!ok.length) return null;
  // TAX HEAD FIRST, then size. `cnCompute` reads gstType from the CLIENT while
  // every invoice carries its own, so a client flipped to `inter` after a batch
  // was billed `intra` would produce an IGST note naming a CGST/SGST invoice —
  // two documents disagreeing about which head the tax sits under. A PREFERENCE
  // rather than a filter: where nothing matches, a note with a reference on the
  // wrong head still beats a note with no reference at all, and the mismatch is
  // then visible on the face instead of diffuse across fourteen numbers.
  ok.sort(function(a, b) {
    if (gstType) {
      var am = (a.gstType || 'intra') === gstType ? 0 : 1;
      var bm = (b.gstType || 'intra') === gstType ? 0 : 1;
      if (am !== bm) return am - bm;
    }
    var d = (Number(b.taxableValue) || 0) - (Number(a.taxableValue) || 0);
    if (d) return d;
    return (invNumInt(b.invoiceNumber) || 0) - (invNumInt(a.invoiceNumber) || 0);
  });
  return ok[0];
}

/* What is left of an invoice after the credit notes ALREADY taken against it.

   The rule above — the invoice must be able to absorb the credit — breaks on the
   second note if each is judged against the invoice's full value: two notes of
   ₹3,800 both fit inside ₹5,000 separately and not together. So the test is on
   what remains.

   CANCELLED notes consume nothing: they export at zero and credit nothing, which
   is the whole point of cancelling rather than deleting one. `exceptCnId` lets a
   note being re-picked ignore its own existing claim. */
function cnInvoiceHeadroom(inv, exceptCnId) {
  var taken = 0;
  (S.creditNotes || []).forEach(function(cn) {
    if (cn.status === 'cancelled') return;
    if (exceptCnId && cn.id === exceptCnId) return;
    if (cn.againstInvoiceId ? cn.againstInvoiceId === inv.id
                            : cn.againstInvoice === inv.displayNumber) {
      taken += Number(cn.taxableValue) || 0;
    }
  });
  return (Number(inv.taxableValue) || 0) - taken;
}

/* What the document prints in the "Against Invoice" box.

   Stamped at creation, so the number on the customer's copy cannot move if the
   register later changes. Notes raised before this existed carry no stamp, so
   the pick is recomputed from the batch — same function, same rule, so a
   reprint of CN/007 names what it would have named had the rule always been
   there.

   ⚠ TWO DIFFERENT FAILURES, and an earlier version reported both as the same
   one ("batch no longer in the register"). They need different words because
   only one of them is actionable: a batch that is GONE is a data problem
   nobody on this screen can fix, while a batch that is PRESENT but whose every
   invoice is smaller than the credit is the operator's own call — split the
   batch, or raise the note against a later invoice. Telling them the invoices
   vanished when the invoices are sitting there hides the one fix available. */
function cnAgainstInvoiceLabel(cn) {
  if (cn.againstInvoice) return cn.againstInvoice;
  var derived = cnDeriveAgainstInvoice(cn);
  if (derived) return derived.displayNumber;
  var nums = cn.invoiceNumbers || [];
  if (!nums.length) return '—';
  var present = (cn.invoiceIds || []).filter(function(id) {
    return (S.invoices || []).some(function(i) { return i.id === id && i.status !== 'cancelled'; });
  }).length;
  return present
    ? '— (none of the ' + present + ' large enough)'
    : '— (' + nums.length + ' invoice' + (nums.length !== 1 ? 's' : '') + ' no longer in the register)';
}

/* SET THE REFERENCE BY HAND, because the rule cannot reproduce every issued note.

   The rule picks the LARGEST qualifying invoice. BM's stated convention is looser
   — "use any invoice that has at least that much amount billed" — so largest is a
   conforming subset, not the only right answer, and the notes already issued on
   paper did not all use it. Measured against the 7 Sep backup: CN/005's recorded
   reference `000716` IS the largest qualifying invoice and the rule reproduces it
   exactly; CN/004's `000443` qualifies (₹11,087.61 against a ₹3,749.29 credit) but
   is NOT the largest — the rule would print `000571`.

   CN/004 and CN/005 are the ₹10,821.75 of issued notes still outside this app. If
   they are ever back-entered, the app must be able to carry the number on the
   customer's copy rather than the one the rule prefers: a document already in
   somebody's hands is the fact, and a rule is not. So the field is settable, and
   what is typed must still pass the same headroom test the rule applies — the
   arithmetic reason for the test does not care who chose the invoice. */
function cnSetAgainstInvoice(id) {
  var cn = getCreditNotes().find(function(c) { return c.id === id; });
  if (!cn) return;
  if (cn.status === 'cancelled') { showToast('That credit note is cancelled', 'error'); return; }
  var current = cnAgainstInvoiceLabel(cn);
  var typed = prompt('Invoice this credit note is taken against.\n\nMust be one of the ' +
    (cn.invoiceNumbers || []).length + ' in the batch and large enough to carry \u20b9' +
    formatNum(cn.taxableValue, 2) + ' taxable.\n\nBatch: ' +
    (cn.invoiceNumbers || []).join(', '), cn.againstInvoice || (current.indexOf('\u2014') === 0 ? '' : current));
  if (typed === null) return;
  var want = String(typed).trim();
  if (!want) {
    delete cn.againstInvoice; delete cn.againstInvoiceId; delete cn.againstInvoiceDate;
    saveState(); showToast('Reference cleared \u2014 the rule will choose again', 'success');
    renderCreditNoteList(); return;
  }
  // It must be IN THE BATCH. A reference outside the invoices the discount was
  // computed on would break the s.15(3)(b) linkage the annex exists to evidence.
  var idx = (cn.invoiceNumbers || []).indexOf(want);
  if (idx === -1) { showToast(want + ' is not in this batch', 'error'); return; }
  var inv = (S.invoices || []).find(function(i) { return i.displayNumber === want; });
  if (!inv) { showToast(want + ' is no longer in the register', 'error'); return; }
  if (inv.status === 'cancelled') { showToast(want + ' is cancelled \u2014 it credits nothing', 'error'); return; }
  if (cnInvoiceHeadroom(inv, cn.id) < (Number(cn.taxableValue) || 0)) {
    showToast(want + ' is not large enough to carry this credit', 'error'); return;
  }
  cn.againstInvoice = inv.displayNumber;
  cn.againstInvoiceId = inv.id;
  cn.againstInvoiceDate = inv.date || '';
  saveState();
  showToast('Now taken against ' + inv.displayNumber, 'success');
  renderCreditNoteList();
}

/* The DATE of the invoice named on the face. Stamped at creation; for a note
   that predates the stamp it is recovered from the register, and where the
   invoice is gone the date is simply absent rather than guessed. */
function cnAgainstInvoiceDate(cn) {
  if (cn.againstInvoiceDate) return cn.againstInvoiceDate;
  if (cn.againstInvoiceId || cn.againstInvoice) {
    var inv = (S.invoices || []).find(function(i) {
      return cn.againstInvoiceId ? i.id === cn.againstInvoiceId
                                 : i.displayNumber === cn.againstInvoice;
    });
    if (inv) return inv.date || '';
    return '';
  }
  var d = cnDeriveAgainstInvoice(cn);
  return (d && d.date) || '';
}

/* The annex entries, each as `number (date)` where the date is known.

   Dates come from the note's own snapshot; a note raised before the snapshot
   existed falls back to the register, and an entry whose invoice has since been
   deleted prints the number alone. A missing date is left missing — inventing
   one would put a false statutory particular on a GST document. */
function cnAnnexEntries(cn) {
  var nums = cn.invoiceNumbers || [];
  var dates = cn.invoiceDates || [];
  var ids = cn.invoiceIds || [];
  return nums.map(function(num, idx) {
    var d = dates[idx];
    if (!d) {
      var inv = (S.invoices || []).find(function(i) {
        return ids[idx] ? i.id === ids[idx] : i.displayNumber === num;
      });
      d = inv && inv.date;
    }
    return d ? num + ' (' + formatDateExport(d) + ')' : num;
  });
}

/* Recompute the pick for a note that predates the stamp. */
function cnDeriveAgainstInvoice(cn) {
  var ids = cn.invoiceIds || [];
  var invoices = ids
    .map(function(id) { return (S.invoices || []).find(function(i) { return i.id === id; }); })
    .filter(function(i) { return i && i.status !== 'cancelled'; });
  if (!invoices.length) return null;
  return cnPickAgainstInvoice(invoices, cn.taxableValue, cn.id, cn.gstType);
}

/* PAN sits inside the GSTIN: 2 state digits, then the 10-character PAN. */
function cnPanFromGstin(gstin) {
  var g = String(gstin || '');
  return g.length >= 12 ? g.slice(2, 12) : '';
}

function showCreditNotePreview(cnId) {
  var cn = getCreditNotes().find(function(x) { return x.id === cnId; });
  if (!cn) return;
  var body = document.getElementById('invPrintBody');
  if (!body) return;
  var banner = cn.status === 'cancelled'
    ? '<div class="inv-qc-notice inv-qc-notice-warn">' + escHtml(cn.displayNumber) + ' was cancelled. The number stays in the series.</div>'
    : '';
  body.innerHTML = banner + buildCreditNoteHtml(cn);
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = cn.displayNumber.replace(/\//g, '-') + ' - ' + (cn.clientName || 'SEP');
}

/* ===== LIST ===== */
function renderCreditNoteList() {
  var notes = getCreditNotes().slice().sort(function(a, b) {
    return (parseInt(b.cnNumber, 10) || 0) - (parseInt(a.cnNumber, 10) || 0);
  });

  var html = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Credit Notes</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay" aria-label="Close">&times;</button></div>';

  if (notes.length === 0) {
    html += '<div class="inv-empty-state">No credit notes yet. Select a batch of invoices in the register to raise one.</div>';
  } else {
    html += '<div class="inv-card-list">';
    notes.forEach(function(cn) {
      var cancelled = cn.status === 'cancelled';
      html += '<div class="inv-reg-row' + (cancelled ? ' inv-reg-row-cancelled' : '') + '">' +
        '<div class="inv-reg-row-content" data-action="invCnPreview" data-id="' + escHtml(cn.id) + '">' +
        '<div class="inv-reg-row-top"><div class="inv-reg-status-row">' +
        '<span class="inv-reg-invnum">' + escHtml(cn.displayNumber) + '</span>' +
        (cancelled ? ' <span class="inv-cancelled-badge">Cancelled</span>' : '') + '</div>' +
        '<div class="inv-reg-amounts"><span class="inv-reg-total">' + formatCurrency(cn.grandTotal) + '</span>' +
        '<span class="inv-reg-taxable">Taxable: ' + formatCurrency(cn.taxableValue) + '</span></div></div>' +
        '<div class="inv-reg-row-bottom"><span class="inv-reg-client">' + escHtml(cn.clientName) + '</span>' +
        '<span class="inv-reg-date">' + escHtml(formatDate(cn.date)) + '</span></div>' +
        '<div class="inv-reg-row-bottom"><span class="inv-text-muted inv-text-xs">' +
        escHtml(cn.discountPct) + '% of ' + formatCurrency(cn.batchTaxable) + ' over ' +
        (cn.invoiceNumbers || []).length + ' invoice' + ((cn.invoiceNumbers || []).length !== 1 ? 's' : '') +
        '</span></div>' +
        // The customer identifies this note by ONE invoice number now, so that
        // number belongs on the row rather than behind a preview.
        '<div class="inv-reg-row-bottom"><span class="inv-text-muted inv-text-xs">Against ' +
        escHtml(cnAgainstInvoiceLabel(cn)) + '</span></div></div>' +
        (cancelled ? '' :
          '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invCnSetAgainst" data-id="' + escHtml(cn.id) + '">Reference</button>' +
          '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invCnCancel" data-id="' + escHtml(cn.id) + '">Cancel</button>') +
        '</div>';
    });
    html += '</div>';
    html += '<div class="inv-btn-bar"><button class="inv-btn inv-btn-ghost" data-action="invExportCreditNotes">Credit Notes CSV</button></div>';
  }
  html += '</div>';

  var existing = document.querySelector('.inv-overlay-scrim');
  if (existing) {
    existing.innerHTML = html;
  } else {
    var scrim = document.createElement('div');
    scrim.className = 'inv-overlay-scrim';
    scrim.innerHTML = html;
    scrim.addEventListener('click', function(e) { if (e.target === scrim) { scrim.remove(); document.body.style.overflow = ''; popFocus(); } });
    pushFocus();
    document.body.appendChild(scrim);
    document.body.style.overflow = 'hidden';
    focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
  }
}

/* ===== EXPORT =====
   Its own file rather than rows inside the GSTR1 sheet: credit notes go to
   table 9B (CDNR), whose columns are not the B2B ones, and mixing the two
   shapes into one flat sheet would corrupt both. A cancelled note is declared
   at zero, the same treatment a cancelled invoice already gets. */
function exportCreditNotesCSV() {
  var notes = getCreditNotes().slice().sort(function(a, b) {
    return (parseInt(a.cnNumber, 10) || 0) - (parseInt(b.cnNumber, 10) || 0);
  });
  if (notes.length === 0) { showToast('No credit notes to export', 'warning'); return; }

  var metaRow = ['SOMA ELECTRO PRODUCTS | GSTIN: ' + (S.company.gstin || '') +
    ' | Export Date: ' + formatDateExport(localDateStr())];
  var header = ['GSTIN/UIN of Recipient', 'Receiver Name', 'Note Number', 'Note Date', 'Note Type',
    'Place Of Supply', 'Note Value', 'Rate', 'Taxable Value', 'CGST Amount', 'SGST Amount',
    'IGST Amount', 'Cess Amount', 'Against Invoice', 'Against Invoice Date', 'Period From', 'Period To', 'Discount %', 'Batch Taxable', 'Status'];
  var rows = [metaRow, header];
  notes.forEach(function(cn) {
    var z = cn.status === 'cancelled';
    var rate = (cn.cgstPer || 0) + (cn.sgstPer || 0) + (cn.igstPer || 0);
    rows.push([
      cn.clientGSTIN || '', cn.clientName, cn.displayNumber, formatDateExport(cn.date), 'C',
      ((cn.clientAddress && cn.clientAddress.stateCode) || '20') + '-' + ((cn.clientAddress && cn.clientAddress.state) || 'Jharkhand'),
      z ? 0 : (cn.grandTotal || 0), z ? 0 : rate, z ? 0 : (cn.taxableValue || 0),
      z ? 0 : (cn.cgstAmt || 0), z ? 0 : (cn.sgstAmt || 0), z ? 0 : (cn.igstAmt || 0), 0,
      // ⚠ RAW, never the screen label. `cnAgainstInvoiceLabel` can emit prose
      // ("— (2 invoices, none recomputable)") and this is a working paper a
      // human pastes toward a GSTR-1 working: an em-dash and a sentence in a
      // number column is worse than an empty cell. Empty means "no reference
      // stamped", which is the truth. N.B. `Against Invoice` is NOT a 9B column
      // — since the Sept-2020 de-linking, table 9B is keyed on the note alone —
      // so this and the four columns after it are SEP's own working fields.
      cn.againstInvoice || (cnDeriveAgainstInvoice(cn) || {}).displayNumber || '',
      cnAgainstInvoiceDate(cn) ? formatDateExport(cnAgainstInvoiceDate(cn)) : '',
      formatDateExport(cn.periodFrom), formatDateExport(cn.periodTo),
      cn.discountPct, cn.batchTaxable, z ? 'Cancelled' : 'Active'
    ]);
  });
  // Named for what the file holds, not for the register's filters. It borrowed
  // exportScopeLabel(), so a file containing every credit note came out stamped
  // with whatever month the register happened to be showing.
  // From the dates themselves, not from the ends of a list ordered by number:
  // the two orderings usually agree, but a back-dated note would misname the
  // file with no way of noticing.
  var dates = notes.map(function(c) { return c.date; }).filter(Boolean).sort();
  var span = dates.length === 0 ? 'all'
    : dates[0] === dates[dates.length - 1] ? dates[0]
    : dates[0] + '_to_' + dates[dates.length - 1];
  downloadCSV('SEP-Credit-Notes_' + span + '.csv', rows);
  showToast('Credit notes exported (' + notes.length + ')');
}
