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
    // Names the batch it credits. A consolidated credit note is legal, but a
    // document that credits forty invoices while naming one is not auditable.
    '<tr><td class="inv-cn-meta-l">Against Invoices</td><td class="inv-cn-meta-v">' +
    escHtml(cnInvoiceRangeLabel(cn)) + '</td></tr>' +
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

  // The invoices this credits, in full. The whole point of the document.
  html += '<div class="inv-cn-annex"><div class="inv-cn-annex-title">Invoices credited (' +
    (cn.invoiceNumbers || []).length + ') &mdash; batch taxable ' + formatNum(cn.batchTaxable, 2) +
    ' at ' + escHtml(cn.discountPct) + '%</div>' +
    '<div class="inv-cn-annex-list">' + (cn.invoiceNumbers || []).map(escHtml).join(', ') + '</div></div>';

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

/* First–last when the batch is contiguous in the series, an explicit list when
   it is short, and a count either way. */
function cnInvoiceRangeLabel(cn) {
  var nums = cn.invoiceNumbers || [];
  if (nums.length === 0) return '—';
  if (nums.length === 1) return nums[0];
  if (nums.length <= 3) return nums.join(', ');
  return nums[0] + ' – ' + nums[nums.length - 1] + ' (' + nums.length + ' invoices)';
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
        '</span></div></div>' +
        (cancelled ? '' : '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invCnCancel" data-id="' + escHtml(cn.id) + '">Cancel</button>') +
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
    'IGST Amount', 'Cess Amount', 'Against Invoices', 'Period From', 'Period To', 'Discount %', 'Batch Taxable', 'Status'];
  var rows = [metaRow, header];
  notes.forEach(function(cn) {
    var z = cn.status === 'cancelled';
    var rate = (cn.cgstPer || 0) + (cn.sgstPer || 0) + (cn.igstPer || 0);
    rows.push([
      cn.clientGSTIN || '', cn.clientName, cn.displayNumber, formatDateExport(cn.date), 'C',
      ((cn.clientAddress && cn.clientAddress.stateCode) || '20') + '-' + ((cn.clientAddress && cn.clientAddress.state) || 'Jharkhand'),
      z ? 0 : (cn.grandTotal || 0), z ? 0 : rate, z ? 0 : (cn.taxableValue || 0),
      z ? 0 : (cn.cgstAmt || 0), z ? 0 : (cn.sgstAmt || 0), z ? 0 : (cn.igstAmt || 0), 0,
      (cn.invoiceNumbers || []).join(' '), formatDateExport(cn.periodFrom), formatDateExport(cn.periodTo),
      cn.discountPct, cn.batchTaxable, z ? 'Cancelled' : 'Active'
    ]);
  });
  downloadCSV('SEP-Credit-Notes_' + exportScopeLabel() + '.csv', rows);
  showToast('Credit notes exported (' + notes.length + ')');
}
