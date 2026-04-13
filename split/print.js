/* ===== SHARED RENDER LAYER (Phase 4 — Tier 2) ===== */
function formatInvoiceData(inv) {
  const client = S.clients.find(c => c.id === inv.clientId);
  const addr = inv.clientAddress || {};
  return {
    invoiceNumber: inv.displayNumber || '',
    date: formatDate(inv.date),
    dateRaw: inv.date,
    status: inv.status,
    cancelled: inv.status === 'cancelled',
    cancelledAt: inv.cancelledAt ? new Date(inv.cancelledAt).toLocaleDateString('en-IN') : null,
    // Company
    companyName: S.company.name,
    companyAdd1: S.company.add1,
    companyAdd2: S.company.add2,
    companyAdd3: S.company.add3 || '',
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
        qty: formatNum(item.qty),
        unit: item.unit || 'KG',
        rate: formatNum(item.rate),
        amount: formatNum(item.amount),
        amountRaw: item.amount || 0,
        nosQtyRaw: item.nosQty || null
      };
    }),
    // Totals
    taxableValue: formatCurrency(inv.taxableValue),
    taxableValueRaw: inv.taxableValue || 0,
    gstType: inv.gstType || 'intra',
    cgstPer: inv.cgstPer || (inv.gstType === 'intra' ? 9 : 0),
    sgstPer: inv.sgstPer || (inv.gstType === 'intra' ? 9 : 0),
    igstPer: inv.igstPer || (inv.gstType === 'inter' ? 18 : 0),
    cgstAmt: formatCurrency(inv.cgstAmt),
    sgstAmt: formatCurrency(inv.sgstAmt),
    igstAmt: formatCurrency(inv.igstAmt),
    cgstAmtRaw: inv.cgstAmt || 0,
    sgstAmtRaw: inv.sgstAmt || 0,
    igstAmtRaw: inv.igstAmt || 0,
    grandTotal: formatCurrency(inv.grandTotal),
    grandTotalRaw: inv.grandTotal || 0,
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

  // Copy label
  html += '<div class="inv-pi-copy-label">' + escHtml(copyLabel) + '</div>';

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
    '<td class="inv-pi-lbl">Your Challan. No.</td><td class="inv-pi-val">' + escHtml(d.challanNo || '') + '</td>' +
    '<td class="inv-pi-lbl">Your Challan Dt.</td><td class="inv-pi-val">' + escHtml(d.challanDate || '') + '</td></tr>';
  var poNumber = inv.poNumber || '';
  var despatchDate = inv.despatchDate ? formatDate(inv.despatchDate) : '';
  html += '<tr><td class="inv-pi-lbl">Your P.O.No.</td><td class="inv-pi-val">' + escHtml(poNumber) + '</td>' +
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

  // Line items table
  html += '<table class="inv-pi-table"><thead><tr>' +
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

  return html;
}

function showPrintPreview(invId) {
  var inv = S.invoices.find(function(i) { return i.id === invId; });
  if (!inv) return;
  var d = formatInvoiceData(inv);

  var copies = [
    'ORIGINAL FOR RECIPIENT',
    'DUPLICATE FOR TRANSPORTER',
    'DUPLICATE FOR TRANSPORTER'
  ];
  var fullHtml = '';
  copies.forEach(function(label, ci) {
    fullHtml += '<div class="inv-print-invoice' + (ci < copies.length - 1 ? ' inv-pi-page-break' : '') + '">';
    fullHtml += _buildInvoiceCopyHtml(d, inv, label);
    fullHtml += '</div>';
  });

  document.getElementById('invPrintBody').innerHTML = fullHtml;
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  document.body.style.overflow = 'hidden';
}

function closePrintPreview() {
  document.getElementById('invPrintView').classList.remove('inv-print-view-active');
  document.body.style.overflow = '';
}

