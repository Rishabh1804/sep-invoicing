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

