/* ===== SHARED RENDER LAYER (Phase 4 — Tier 2) ===== */
/* A quantity as it is held: kilograms are kept to three places (pieces × kg/pc, 150.274 kg), so the third prints
   when there is one. Two places otherwise, as every invoice has always printed. */
function formatQtyHeld(q) {
  var s = formatNum(q, 3);
  return /\.\d\d0$/.test(s) ? formatNum(q, 2) : s;
}

function formatInvoiceData(inv) {
  const addr = inv.clientAddress || {};
  return {
    invoiceNumber: inv.displayNumber || '',
    date: formatDate(inv.date),
    cancelled: inv.status === 'cancelled',
    cancelledAt: inv.cancelledAt ? new Date(inv.cancelledAt).toLocaleDateString('en-IN') : null,
    // Company
    companyName: S.company.name,
    companyAdd1: S.company.add1,
    companyAdd2: S.company.add2,
    companyPhone: S.company.phone || '',
    companyMobile: S.company.mobile || '',
    companyEmail: S.company.email || '',
    companyGSTIN: S.company.gstin,
    companyState: S.company.state,
    companyStateCode: S.company.stateCode,
    // Client
    clientName: inv.clientName || '',
    clientAdd1: addr.add1 || '',
    clientAdd2: addr.add2 || '',
    clientAdd3: addr.add3 || '',
    clientGSTIN: inv.clientGSTIN || '',
    clientState: addr.state || '',
    clientStateCode: addr.stateCode || '',
    // Line items (formatted)
    items: (inv.items || []).map(function(item, idx) {
      return {
        sno: idx + 1,
        desc: item.desc || item.partNumber || '',
        partNumber: item.partNumber || '',
        hsn: item.hsn || '998873',
        qty: formatQtyHeld(item.qty),
        unit: item.unit || 'KG',
        rate: formatNum(item.rate),
        amount: formatNum(item.amount),
        nosQtyRaw: item.nosQty || null
      };
    }),
    // Totals
    taxableValue: formatCurrency(inv.taxableValue),
    gstType: inv.gstType || 'intra',
    cgstPer: inv.cgstPer || (inv.gstType === 'intra' ? 9 : 0),
    sgstPer: inv.sgstPer || (inv.gstType === 'intra' ? 9 : 0),
    igstPer: inv.igstPer || (inv.gstType === 'inter' ? 18 : 0),
    cgstAmt: formatCurrency(inv.cgstAmt),
    sgstAmt: formatCurrency(inv.sgstAmt),
    igstAmt: formatCurrency(inv.igstAmt),
    grandTotal: formatCurrency(inv.grandTotal),
    amountInWords: inv.amountInWords || numberToWords(inv.grandTotal || 0),
    // Optional
    challanNo: inv.challanNo || '',
    challanDate: inv.challanDate ? formatDate(inv.challanDate) : '',
    remarks: inv.remarks || '',
    // Bank
    bankDetails: S.bankDetails || ''
  };
}

/* ===== INVOICE PREVIEW/PRINT (Phase 4 — Tier 1) ===== */
function _buildInvoiceCopyHtml(d, inv, copyLabel) {
  var html = '';

  /* The letterhead through the disclaimer is one visual box — the blocks chain
     `border-top: none` onto each other to draw it — so it is wrapped and kept
     whole. Split across a page it opens the box and reads as a second, headless
     invoice. */
  html += '<div class="inv-pi-head-block">';

  // TAX INVOICE heading
  html += '<div class="inv-pi-title">TAX INVOICE</div>';

  // Company header / letterhead
  html += '<div class="inv-pi-header">' +
    '<div class="inv-pi-company">' + escHtml(d.companyName) + '</div>' +
    '<div class="inv-pi-address">' + escHtml(d.companyAdd1);
  if (d.companyAdd2) html += ', ' + escHtml(d.companyAdd2);
  html += '</div>';
  var contacts = [];
  if (d.companyPhone) contacts.push('Phone : ' + escHtml(d.companyPhone));
  if (d.companyMobile) contacts.push('Mobile : ' + escHtml(d.companyMobile));
  if (d.companyEmail) contacts.push('E-Mail : ' + escHtml(d.companyEmail));
  if (contacts.length) html += '<div class="inv-pi-address">' + contacts.join('  ') + '</div>';
  html += '<div class="inv-pi-tagline">SPECIALIST IN : Zinc Plating</div>' +
    '<div class="inv-pi-tagline">Bright Zinc Plating (Approved by TATA MOTORS LTD.)</div></div>';

  // GSTIN / State / State Code row
  html += '<div class="inv-pi-gstin-row">' +
    '<span>GSTIN  ' + escHtml(d.companyGSTIN) + '</span>' +
    '<span>STATE  ' + escHtml(d.companyState) + '</span>' +
    '<span>STATE CODE : ' + escHtml(d.companyStateCode) + '</span></div>';

  // Invoice meta grid
  html += '<table class="inv-pi-info-grid"><tr>' +
    '<td class="inv-pi-lbl">Invoice Number</td><td class="inv-pi-val">' + escHtml(d.invoiceNumber) + '</td>' +
    '<td class="inv-pi-lbl">Inv Dt.</td><td class="inv-pi-val">' + escHtml(d.date) + '</td>' +
    '<td class="inv-pi-lbl">Your Challan. No.</td><td class="inv-pi-val inv-pi-val-wrap">' + escHtml(d.challanNo || '') + '</td>' +
    '<td class="inv-pi-lbl">Your Challan Dt.</td><td class="inv-pi-val">' + escHtml(d.challanDate || '') + '</td></tr>';
  var poNumber = inv.poNumber || '';
  var despatchDate = inv.despatchDate ? formatDate(inv.despatchDate) : '';
  html += '<tr><td class="inv-pi-lbl">Your P.O.No.</td><td class="inv-pi-val inv-pi-val-wrap">' + escHtml(poNumber) + '</td>' +
    '<td class="inv-pi-lbl">Despatch Dt</td><td class="inv-pi-val">' + escHtml(despatchDate) + '</td>' +
    '<td colspan="4"></td></tr></table>';

  // Bill To / Ship To
  html += '<div class="inv-pi-parties">' +
    '<div class="inv-pi-party"><div class="inv-pi-party-title">Bill To</div>' +
    '<div class="inv-pi-party-name">' + escHtml(d.clientName) + '</div>';
  if (d.clientAdd1) html += '<div>' + escHtml(d.clientAdd1) + '</div>';
  if (d.clientAdd2) html += '<div>' + escHtml(d.clientAdd2) + '</div>';
  if (d.clientAdd3) html += '<div>' + escHtml(d.clientAdd3) + '</div>';
  html += '<div class="inv-pi-party-gstin">GSTIN  ' + escHtml(d.clientGSTIN || 'N/A') + '</div>' +
    '<div class="inv-pi-party-state">STATE  <strong>' + escHtml(d.clientState) + '</strong>  State Code  <strong>' + escHtml(d.clientStateCode) + '</strong></div></div>';
  html += '<div class="inv-pi-party"><div class="inv-pi-party-title">Ship To</div>' +
    '<div class="inv-pi-party-name">' + escHtml(d.clientName) + '</div>';
  if (d.clientAdd1) html += '<div>' + escHtml(d.clientAdd1) + '</div>';
  if (d.clientAdd2) html += '<div>' + escHtml(d.clientAdd2) + '</div>';
  if (d.clientAdd3) html += '<div>' + escHtml(d.clientAdd3) + '</div>';
  html += '<div class="inv-pi-party-gstin">GSTIN  ' + escHtml(d.clientGSTIN || 'N/A') + '</div>' +
    '<div class="inv-pi-party-state">STATE  <strong>' + escHtml(d.clientState) + '</strong>  State Code  <strong>' + escHtml(d.clientStateCode) + '</strong></div></div></div>';

  // Disclaimer
  html += '<div class="inv-pi-disclaimer">Please Receive the following Goods after Processing to your entire satisfaction No responsibility after Delivery</div>';

  html += '</div>';

  /* Line items table. Its column headings repeat on every page it spans; which
     invoice and which copy a page belongs to is the frame's header (below). */
  html += '<table class="inv-pi-table"><thead>' +
    '<tr>' +
    '<th>Sl.No.</th><th>Product Description</th><th>Part Number</th><th>HSN/SAC</th><th>Qty</th><th>UOM</th><th>Rate</th><th>Value</th></tr></thead><tbody>';
  d.items.forEach(function(item) {
    var descHtml = escHtml(item.desc);
    var origItem = (inv.items || [])[item.sno - 1];
    if (origItem && origItem.nosQty && origItem.nosQty > 0) {
      descHtml += '<span class="inv-pi-nos-sub">' + escHtml(origItem.nosQty) + ' NOS</span>';
    }
    html += '<tr>' +
      '<td>' + escHtml(item.sno) + '</td>' +
      '<td>' + descHtml + '</td>' +
      '<td>' + escHtml(item.partNumber) + '</td>' +
      '<td>' + escHtml(item.hsn) + '</td>' +
      '<td class="inv-pi-num">' + escHtml(item.qty) + '</td>' +
      '<td>' + escHtml(item.unit) + '</td>' +
      '<td class="inv-pi-num">' + escHtml(item.rate) + '</td>' +
      '<td class="inv-pi-num">' + escHtml(item.amount) + '</td></tr>';
  });
  html += '</tbody></table>';

  /* Totals, bank, signature and declaration are one block. They were four
     siblings, two of which avoided breaking individually — which let a page
     boundary fall between the totals and the signature that attests them. */
  html += '<div class="inv-pi-tail">';

  // Footer: delivery info + totals
  var vehicleNo = inv.transport || '';
  html += '<div class="inv-pi-footer-grid">' +
    '<div class="inv-pi-footer-left">' +
    '<div>Delivery by Tempo / Truck No.  ' + escHtml(vehicleNo) + '</div>' +
    '<div class="inv-pi-words">' + escHtml(d.amountInWords) + '</div></div>' +
    '<div class="inv-pi-footer-right"><table>';
  html += '<tr><td class="inv-pi-total-label">Product Value</td><td class="inv-pi-total-value">' + escHtml(d.taxableValue) + '</td></tr>';
  if (d.gstType === 'intra') {
    html += '<tr><td class="inv-pi-total-label">CGST  ' + d.cgstPer + '.00 %</td><td class="inv-pi-total-value">' + escHtml(d.cgstAmt) + '</td></tr>' +
      '<tr><td class="inv-pi-total-label">SGST  ' + d.sgstPer + '.00 %</td><td class="inv-pi-total-value">' + escHtml(d.sgstAmt) + '</td></tr>';
  } else {
    html += '<tr><td class="inv-pi-total-label">IGST  ' + d.igstPer + '.00 %</td><td class="inv-pi-total-value">' + escHtml(d.igstAmt) + '</td></tr>';
  }
  html += '<tr class="inv-pi-grand"><td class="inv-pi-total-label">Total Amount</td><td class="inv-pi-total-value">' + escHtml(d.grandTotal) + '</td></tr>';
  html += '</table></div></div>';

  // Bank details
  if (d.bankDetails) {
    html += '<div class="inv-pi-bank"><span class="inv-pi-bank-label">Bank Details: </span>' + escHtml(d.bankDetails) + '</div>';
  }

  // Remarks
  if (d.remarks) {
    html += '<div class="inv-pi-bank"><span class="inv-pi-bank-label">Remarks: </span>' + escHtml(d.remarks) + '</div>';
  }

  // Signature block
  html += '<div class="inv-pi-sig-grid">' +
    '<div class="inv-pi-sig-left"><div>NAME</div><div class="inv-pi-sig-bottom inv-pi-sig-label">RECEIVERS SIGNATURE</div></div>' +
    '<div class="inv-pi-sig-mid"><div>RECEIVED QUANTITY FOUND OK AS PER YOUR INVOICE QUANTITY</div><div class="inv-pi-sig-bottom"></div></div>' +
    '<div class="inv-pi-sig-right"><div>E. &amp; O.E</div><div class="inv-pi-sig-company">For ' + escHtml(d.companyName) + '</div><div class="inv-pi-sig-bottom inv-pi-sig-label">Authorised Signatory</div></div></div>';

  // Quality declaration footer
  html += '<div class="inv-pi-declaration">All processed material is inspected before dispatch. Material accepted at the time of delivery shall be deemed to have met quality requirements. Any claim for rework or replating must be accompanied by a written explanation and a delivery challan within 7 days of receipt.</div>';

  html += '</div>';

  return _invoiceFrameHtml(d, copyLabel, html);
}

/* Each copy is one table whose header and footer rows the browser repeats on
   every printed page (owner, 27 Sep 2026: the copy label printed twice on page
   one — at the top and again in a caption row over the line items, which was
   the only way a continuation page said which copy it was).
   - The header carries the invoice number and the copy label, once per page,
     at the top of every page, page one included.
   - The header and footer are also the top and bottom gutters. The page has no
     margin (a margin box is where the browser stamps its own date and title),
     so the gutters used to be padding on the copy, which applies once to the
     whole flow: a continuation page began hard against the paper edge. A band
     in a repeating row is reserved on every page.
   - The copy's content is one cell, so the frame spans every page the copy
     does, including a tail that lands alone on its own page. */
function _invoiceFrameHtml(d, copyLabel, body) {
  return '<table class="inv-pi-frame">' +
    '<thead><tr><th class="inv-pi-frame-head"><div class="inv-pi-copy-label">' +
    '<span class="inv-pi-copy-inv">Invoice ' + escHtml(d.invoiceNumber) + '</span>' +
    '<span>' + escHtml(copyLabel) + '</span></div>' +
    // A cancelled invoice printed clean, the same as a live one. The band is in the repeating header, so every page
    // of every copy carries it.
    (d.cancelled ? '<div class="inv-pi-cancelled">CANCELLED' + (d.cancelledAt ? ' on ' + escHtml(d.cancelledAt) : '') + '</div>' : '') +
    '</th></tr></thead>' +
    '<tfoot><tr><td class="inv-pi-frame-foot"></td></tr></tfoot>' +
    '<tbody><tr><td class="inv-pi-frame-body">' + body + '</td></tr></tbody></table>';
}

/* The three copies of a tax invoice (CGST rule 48): one for each party. The
   third read DUPLICATE FOR TRANSPORTER, the same as the second, until 27 Sep
   2026; the shop keeps it, so it is the supplier's. */
var INVOICE_COPIES = ['ORIGINAL FOR RECIPIENT', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER'];

var _printInvId = null;   // the invoice in the preview; null for any other document
function showPrintPreview(invId) {
  var inv = S.invoices.find(function(i) { return i.id === invId; });
  if (!inv) return;
  _printInvId = invId;
  var d = formatInvoiceData(inv);

  var copies = INVOICE_COPIES;
  var fullHtml = '';
  copies.forEach(function(label, ci) {
    fullHtml += '<div class="inv-print-invoice' + (ci < copies.length - 1 ? ' inv-pi-page-break' : '') + '">';
    fullHtml += _buildInvoiceCopyHtml(d, inv, label);
    fullHtml += '</div>';
  });

  document.getElementById('invPrintBody').innerHTML = fullHtml;
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  document.body.style.overflow = 'hidden';
  printFit();
  // Set page title for PDF filename (Phase 6b)
  document._savedTitle = document.title;
  document.title = (inv.displayNumber || 'Invoice') + ' - ' + (inv.clientName || 'SEP');
}

/* Scales the preview's documents to the screen: each is laid out at its paper width (an A4 sheet in mm), so the
   preview shows the page exactly as it prints, and zoom fits the whole sheet in (never above life size). */
function printFit() {
  var view = document.getElementById('invPrintView'), body = document.getElementById('invPrintBody');
  if (!view || !body || !view.classList.contains('inv-print-view-active')) return;
  body.style.setProperty('--pp-zoom', '1');
  var widest = 0;
  Array.prototype.forEach.call(body.children, function(el) { widest = Math.max(widest, el.getBoundingClientRect().width); });
  var cs = getComputedStyle(body);
  var room = body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  body.style.setProperty('--pp-zoom', widest > room && widest > 0 ? String(Math.floor(room / widest * 1000) / 1000) : '1');
}
window.addEventListener('resize', printFit);

/* Print on a Created invoice's preview moves it to Printed, and the screen under the preview shows it at once (the
   row, the pane, Home's recent invoices). The print dialog cannot say whether the paper came out, so a print that
   never came out is put back with Not printed on the invoice (invNotPrinted).
   The mark is a billing change (guard.js): a role that may not make one prints the invoice and leaves its state as it was
   (the QA audit of 2 Oct 2026, QA4-6). No PIN is asked: marking is part of printing an invoice the role opened, and the
   print dialog has to open in the same tap. */
function printMarkPrinted() {
  var inv = _printInvId && S.invoices.find(function(i) { return i.id === _printInvId; });
  if (!inv || inv.status === 'cancelled' || getInvState(inv) !== 'created') return;
  if (typeof grdCan === 'function' && !grdCan('billing')) { showToast('Your ID can’t change invoices: printing leaves it Created', 'warning'); return; }
  invSetState(inv, 'printed');
  saveState();
  invStateShown(inv.id);
}

function closePrintPreview() {
  _printInvId = null;
  if (typeof idcPrintDiscard === 'function') idcPrintDiscard();   // ID card numbers previewed and not printed are not given
  document.getElementById('invPrintView').classList.remove('inv-print-view-active');
  document.body.style.overflow = '';
  // Restore page title
  if (document._savedTitle) { document.title = document._savedTitle; document._savedTitle = null; }
}

