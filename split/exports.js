/* ===== GST EXPORT ===== */
function csvEscape(val) {
  const s = String(val == null ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function downloadCSV(filename, rows) {
  const content = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

/* Rows in serial order, voided numbers sitting in their own slot.
   Both exports used to take getFilteredInvoices() order, which on mobile is
   createdAt descending — so the register filed to the accountant came out in
   reverse typing order — and then appended the voids in a block at the end. A
   register is read by serial: that is the order rule 46's consecutive series is
   kept in, and it is the order a gap is spotted in. The on-screen sort is a
   browsing preference and deliberately does not reach the file. */
function _exportRowsInSerialOrder(invoices, voided, invRow, voidRow) {
  var rows = invoices.map(function(inv) {
    return { num: invNumInt(inv.invoiceNumber), build: function() { return invRow(inv); } };
  }).concat(voided.map(function(v) {
    return { num: invNumInt(v.invoiceNumber), build: function() { return voidRow(v); } };
  }));
  rows.sort(function(a, b) {
    if (a.num == null) return 1;
    if (b.num == null) return -1;
    return a.num - b.num;
  });
  return rows.map(function(r) { return r.build(); });
}

/* Filenames say what the file actually contains. `SEP-Sales-Register-all.csv`
   twice in a downloads folder, from two different client filters, is a filing
   accident waiting to happen. */
function _exportSlug(s) {
  return String(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function exportScopeLabel() {
  var parts = [];
  if (regFilter.dateFrom || regFilter.dateTo) {
    parts.push((regFilter.dateFrom || 'start') + '_to_' + (regFilter.dateTo || localDateStr()));
  } else if (regFilter.month) {
    parts.push(regFilter.month);
  } else {
    parts.push('all-dates');
  }
  if (regFilter.clientId) {
    var c = S.clients.find(function(x) { return x.id === parseInt(regFilter.clientId); });
    if (c) parts.push(_exportSlug(c.name));
  }
  if (regFilter.state) parts.push(_exportSlug(regFilter.state));
  if (regFilter.search) parts.push('search-' + _exportSlug(regFilter.search));
  return parts.join('_');
}

function getPlaceOfSupply(inv) {
  const code = (inv.clientAddress && inv.clientAddress.stateCode) || '20';
  const stateMap = { '20': 'Jharkhand', '27': 'Maharashtra' };
  const name = stateMap[code] || (inv.clientAddress && inv.clientAddress.state) || 'Jharkhand';
  return code + '-' + name;
}

function exportSalesCSV() {
  const invoices = getFilteredInvoices();
  // Phase 5: Metadata row above column headers
  var exportDate = formatDateExport(localDateStr());
  var metaRow = ['SOMA ELECTRO PRODUCTS | GSTIN: ' + (S.company.gstin || '20AAPFS4718J2Z0') + ' | Export Date: ' + exportDate];
  var scope = exportScopeLabel();
  metaRow.push('Scope: ' + scope);
  const header = ['Inv. No.', 'Date', 'Customer', 'Status', 'Taxable Value', 'CGST%', 'CGST Amt', 'SGST%', 'SGST Amt', 'IGST%', 'IGST Amt', 'Invoice Amount'];
  // Voided numbers ride along at zero. The number was issued, so the series
  // has to show it; the reason travels in the customer column so the internal
  // register explains its own gaps.
  const voided = getVoidedForExport();
  const rows = [metaRow, header].concat(_exportRowsInSerialOrder(
    invoices, voided,
    function(inv) {
      const cancelled = inv.status === 'cancelled';
      return [
        inv.displayNumber,
        formatDateExport(inv.date),
        inv.clientName,
        cancelled ? 'Cancelled' : INV_STATE_LABELS[getInvState(inv)] || 'Created',
        cancelled ? 0 : inv.taxableValue,
        cancelled ? 0 : (inv.cgstPer || 0),
        cancelled ? 0 : (inv.cgstAmt || 0),
        cancelled ? 0 : (inv.sgstPer || 0),
        cancelled ? 0 : (inv.sgstAmt || 0),
        cancelled ? 0 : (inv.igstPer || 0),
        cancelled ? 0 : (inv.igstAmt || 0),
        cancelled ? 0 : (inv.grandTotal || 0)
      ];
    },
    function(v) {
      return [
        v.displayNumber,
        formatDateExport(v.date),
        (v.clientName ? v.clientName + ' — ' : '') + 'VOID: ' + v.reason,
        'Voided',
        0, 0, 0, 0, 0, 0, 0, 0
      ];
    }
  ));
  downloadCSV('SEP-Sales-Register_' + scope + '.csv', rows);
  showToast('Sales Register exported (' + (invoices.length + voided.length) + ' rows)');
}

function exportGSTR1CSV() {
  const invoices = getFilteredInvoices();
  // Phase 5: Metadata row above column headers
  var exportDate = formatDateExport(localDateStr());
  var metaRow = ['SOMA ELECTRO PRODUCTS | GSTIN: ' + (S.company.gstin || '20AAPFS4718J2Z0') + ' | Export Date: ' + exportDate];
  var scope = exportScopeLabel();
  metaRow.push('Scope: ' + scope);
  const header = ['GSTIN/UIN of Recipient', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Reverse Charge', 'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Cess Amount'];
  // Same treatment as a cancelled invoice, which this export already carries at
  // zero: the number is declared, the value is not. Without these rows the
  // return shows a hole the app cannot explain.
  const voided = getVoidedForExport();
  const rows = [metaRow, header].concat(_exportRowsInSerialOrder(
    invoices, voided,
    function(inv) {
      const cancelled = inv.status === 'cancelled';
      const gstRate = cancelled ? 0 : ((inv.cgstPer || 0) + (inv.sgstPer || 0) + (inv.igstPer || 0));
      return [
        inv.clientGSTIN || '',
        inv.displayNumber,
        formatDateExport(inv.date),
        cancelled ? 0 : (inv.grandTotal || 0),
        getPlaceOfSupply(inv),
        'N',
        'Regular',
        '',
        gstRate,
        cancelled ? 0 : (inv.taxableValue || 0),
        cancelled ? 0 : (inv.cgstAmt || 0),
        cancelled ? 0 : (inv.sgstAmt || 0),
        cancelled ? 0 : (inv.igstAmt || 0),
        0
      ];
    },
    function(v) {
      return ['', v.displayNumber, formatDateExport(v.date), 0,
        '20-Jharkhand', 'N', 'Regular', '', 0, 0, 0, 0, 0, 0];
    }
  ));
  downloadCSV('SEP-GSTR1_' + scope + '.csv', rows);
  showToast('GSTR1 exported (' + (invoices.length + voided.length) + ' rows)');
}


/* ===== THE SALES REGISTER AS A DOCUMENT =====

   The CSV is a working paper for the accountant. This is the same register as
   something a CUSTOMER can be handed — SSS Mehta get the register for a batch
   alongside the credit note raised on it, and a spreadsheet is not what you send
   with a GST document.

   Printed, not generated: every other document here (invoice, certificate,
   credit note) is print-to-PDF through the browser dialog, and adding a PDF
   library to produce one page of a table would be a second rendering path for
   the same job. Same print view, same `@page` margin 0.

   ⚠ SCOPE IS SELECTION-FIRST, and it is STATED ON THE FACE. A credit note is
   raised from a ticked batch, so the register that accompanies it has to be able
   to cover exactly that batch — the register filter alone cannot express "these
   fourteen". The CSV is filter-only and unchanged, so the two can disagree; a
   document that names its own scope cannot mislead anybody about which it is. */
function _registerScopeInvoices() {
  var selectedIds = Object.keys(_regSelected || {});
  if (selectedIds.length) {
    var picked = selectedIds
      .map(function(id) { return S.invoices.find(function(i) { return String(i.id) === String(id); }); })
      .filter(Boolean);
    if (picked.length) {
      return { invoices: picked, label: picked.length + ' selected invoice' + (picked.length !== 1 ? 's' : ''), fromSelection: true };
    }
  }
  return { invoices: getFilteredInvoices(), label: exportScopeLabel().replace(/_/g, ' '), fromSelection: false };
}

function buildSalesRegisterHtml(scope) {
  var invoices = scope.invoices;
  var co = S.company || {};
  // Voids ride along at zero on the same rule the CSV uses: the number was
  // issued, so the series has to show it, and the register explains its own gap.
  // Only those inside the scope — a selection cannot tick a number that is gone,
  // so a selection-scoped register carries none, which is correct.
  var voided = scope.fromSelection ? [] : getVoidedForExport();
  var anyIgst = invoices.some(function(i) { return (i.igstAmt || 0) > 0; });

  var t = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
  var body = _exportRowsInSerialOrder(invoices, voided,
    function(inv) {
      var c = inv.status === 'cancelled';
      if (!c) {
        t.taxable = gstRound(t.taxable + (inv.taxableValue || 0));
        t.cgst = gstRound(t.cgst + (inv.cgstAmt || 0));
        t.sgst = gstRound(t.sgst + (inv.sgstAmt || 0));
        t.igst = gstRound(t.igst + (inv.igstAmt || 0));
        t.total = gstRound(t.total + (inv.grandTotal || 0));
      }
      return '<tr><td class="inv-sr-num">' + escHtml(inv.displayNumber) + '</td>' +
        '<td class="inv-sr-date">' + escHtml(formatDateExport(inv.date)) + '</td>' +
        '<td>' + escHtml(inv.clientName || '') + '</td>' +
        '<td>' + escHtml(c ? 'Cancelled' : (INV_STATE_LABELS[getInvState(inv)] || 'Created')) + '</td>' +
        '<td class="inv-sr-amt">' + formatCurrency(c ? 0 : (inv.taxableValue || 0)) + '</td>' +
        '<td class="inv-sr-amt">' + formatCurrency(c ? 0 : (inv.cgstAmt || 0)) + '</td>' +
        '<td class="inv-sr-amt">' + formatCurrency(c ? 0 : (inv.sgstAmt || 0)) + '</td>' +
        (anyIgst ? '<td class="inv-sr-amt">' + formatCurrency(c ? 0 : (inv.igstAmt || 0)) + '</td>' : '') +
        '<td class="inv-sr-amt">' + formatCurrency(c ? 0 : (inv.grandTotal || 0)) + '</td></tr>';
    },
    function(v) {
      return '<tr class="inv-sr-void"><td class="inv-sr-num">' + escHtml(v.displayNumber) + '</td>' +
        '<td class="inv-sr-date">' + escHtml(formatDateExport(v.date)) + '</td>' +
        // ⚠ THE REASON IS NOT PRINTED. A void reason is internal commentary
        // ("typed against the wrong challan, reissued as 00812") and this
        // document is handed to a customer. The number showing as Voided is
        // what rule 46 needs -- the series accounts for itself -- and the
        // reason stays where it belongs: the CSV and the number audit.
        '<td>' + escHtml(v.clientName || '') + '</td>' +
        '<td>Voided</td>' +
        '<td class="inv-sr-amt">' + formatCurrency(0) + '</td><td class="inv-sr-amt">' + formatCurrency(0) + '</td><td class="inv-sr-amt">' + formatCurrency(0) + '</td>' +
        (anyIgst ? '<td class="inv-sr-amt">' + formatCurrency(0) + '</td>' : '') +
        '<td class="inv-sr-amt">' + formatCurrency(0) + '</td></tr>';
    }).join('');

  var cols = anyIgst ? 9 : 8;
  return '<div class="inv-sr-doc">' +
    '<div class="inv-sr-head">' +
      '<div class="inv-sr-co">' + escHtml(co.name || 'SOMA ELECTRO PRODUCTS') + '</div>' +
      '<div>' + escHtml([co.add1, co.add2, co.add3].filter(Boolean).join(', ')) + '</div>' +
      '<div>GSTIN: ' + escHtml(co.gstin || '') + '</div>' +
    '</div>' +
    '<div class="inv-sr-title">Sales Register</div>' +
    '<table class="inv-sr-meta"><tr>' +
      '<td class="inv-sr-meta-l">Scope</td><td>' + escHtml(scope.label) + '</td>' +
      '<td class="inv-sr-meta-l">Generated</td><td>' + escHtml(formatDateExport(localDateStr())) + '</td>' +
    '</tr></table>' +
    '<table class="inv-sr-table"><thead><tr>' +
      '<th>Invoice No.</th><th>Date</th><th>Customer</th><th>Status</th>' +
      '<th class="inv-sr-amt">Taxable</th><th class="inv-sr-amt">CGST</th><th class="inv-sr-amt">SGST</th>' +
      (anyIgst ? '<th class="inv-sr-amt">IGST</th>' : '') +
      '<th class="inv-sr-amt">Invoice Amt</th>' +
    '</tr></thead><tbody>' + body + '</tbody>' +
    '<tfoot><tr><td colspan="4" class="inv-sr-tot-l">Total &mdash; ' + invoices.length +
      ' invoice' + (invoices.length !== 1 ? 's' : '') + '</td>' +
      '<td class="inv-sr-amt">' + formatCurrency(t.taxable) + '</td>' +
      '<td class="inv-sr-amt">' + formatCurrency(t.cgst) + '</td>' +
      '<td class="inv-sr-amt">' + formatCurrency(t.sgst) + '</td>' +
      (anyIgst ? '<td class="inv-sr-amt">' + formatCurrency(t.igst) + '</td>' : '') +
      '<td class="inv-sr-amt">' + formatCurrency(t.total) + '</td></tr></tfoot>' +
    '</table>' +
    '<div class="inv-sr-foot">Cancelled and voided numbers are listed at zero: the number was ' +
      'issued, so the series shows it. Total is of the ' + cols + '-column body above, ' +
      'excluding them.</div>' +
    '</div>';
}

function showSalesRegisterPreview() {
  var scope = _registerScopeInvoices();
  if (!scope.invoices.length) { showToast('No invoices in this register', 'error'); return; }
  var body = document.getElementById('invPrintBody');
  if (!body) return;

  // ⚠ A REGISTER SHARED WITH ONE CUSTOMER MUST NOT CARRY ANOTHER'S. This document
  // exists to go out with a credit note, and a credit note is addressed to one
  // customer — cnValidateSelection refuses a batch that spans two. The register
  // has no such constraint because it is also an internal filing document, so
  // the multi-customer case is WARNED, never blocked: sending it is the
  // operator's call, and filing it is a legitimate reason to build one.
  var names = {};
  scope.invoices.forEach(function(i) { if (i.clientName) names[i.clientName] = true; });
  var n = Object.keys(names).length;
  var banner = n > 1
    ? '<div class="inv-qc-notice inv-qc-notice-warn">This register covers <strong>' + n +
      ' customers</strong>. It is fine for your own filing, but do not send it to one of them &mdash; ' +
      'it would disclose the others. Filter or select a single customer first.</div>'
    : '';

  body.innerHTML = banner + buildSalesRegisterHtml(scope);
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = 'Sales Register - ' + (n === 1 ? Object.keys(names)[0] : scope.label);
}
