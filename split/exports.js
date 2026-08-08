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
  const header = ['Inv. No.', 'Date', 'Customer', 'Taxable Value', 'CGST%', 'CGST Amt', 'SGST%', 'SGST Amt', 'IGST%', 'IGST Amt', 'Invoice Amount'];
  const rows = [metaRow, header];
  invoices.forEach(inv => {
    const cancelled = inv.status === 'cancelled';
    rows.push([
      inv.displayNumber,
      formatDateExport(inv.date),
      inv.clientName,
      cancelled ? 0 : inv.taxableValue,
      cancelled ? 0 : (inv.cgstPer || 0),
      cancelled ? 0 : (inv.cgstAmt || 0),
      cancelled ? 0 : (inv.sgstPer || 0),
      cancelled ? 0 : (inv.sgstAmt || 0),
      cancelled ? 0 : (inv.igstPer || 0),
      cancelled ? 0 : (inv.igstAmt || 0),
      cancelled ? 0 : (inv.grandTotal || 0)
    ]);
  });
  // Voided numbers ride along at zero. The number was issued, so the series
  // has to show it; the reason travels in the customer column so the internal
  // register explains its own gaps.
  const voided = getVoidedForExport();
  voided.forEach(v => {
    rows.push([
      v.displayNumber,
      formatDateExport(v.date),
      (v.clientName ? v.clientName + ' — ' : '') + 'VOID: ' + v.reason,
      0, 0, 0, 0, 0, 0, 0, 0
    ]);
  });
  const prefix = regFilter.month || 'all';
  downloadCSV('SEP-Sales-Register-' + prefix + '.csv', rows);
  showToast('Sales Register exported (' + (invoices.length + voided.length) + ' rows)');
}

function exportGSTR1CSV() {
  const invoices = getFilteredInvoices();
  // Phase 5: Metadata row above column headers
  var exportDate = formatDateExport(localDateStr());
  var metaRow = ['SOMA ELECTRO PRODUCTS | GSTIN: ' + (S.company.gstin || '20AAPFS4718J2Z0') + ' | Export Date: ' + exportDate];
  const header = ['GSTIN/UIN of Recipient', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Reverse Charge', 'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Cess Amount'];
  const rows = [metaRow, header];
  invoices.forEach(inv => {
    const cancelled = inv.status === 'cancelled';
    const gstRate = cancelled ? 0 : ((inv.cgstPer || 0) + (inv.sgstPer || 0) + (inv.igstPer || 0));
    rows.push([
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
    ]);
  });
  // Same treatment as a cancelled invoice, which this export already carries at
  // zero: the number is declared, the value is not. Without these rows the
  // return shows a hole the app cannot explain.
  const voided = getVoidedForExport();
  voided.forEach(v => {
    rows.push([
      '', v.displayNumber, formatDateExport(v.date), 0,
      '20-Jharkhand', 'N', 'Regular', '', 0, 0, 0, 0, 0, 0
    ]);
  });
  const prefix = regFilter.month || 'all';
  downloadCSV('SEP-GSTR1-' + prefix + '.csv', rows);
  showToast('GSTR1 exported (' + (invoices.length + voided.length) + ' rows)');
}

