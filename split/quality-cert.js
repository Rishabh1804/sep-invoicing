/* ===== QUALITY CERTIFICATE (Test Certificate — ZN Plating) ===== */
/*
 * A quality certificate is issued per part per dispatch, not per invoice: one
 * invoice covering four part numbers is four certificates, because the customer
 * files them against the parts they inspect. So a selection of N invoices
 * yields one page per invoice line.
 *
 * The layout, the process sequence, the chemical names and the specification
 * text below are transcribed verbatim from the TML-approved 04/02/26 reference
 * certificate (prototyped in docs/test-certificates/, which this supersedes).
 * Original-document typos are preserved — 'Cynide', 'Brightner', 'Ruse',
 * 'Peef off', 'Importer Coverage', 'final gating', 'Ginca', 'Rodiprind' —
 * because Tata Motors QA approval is bound to the exact text, and the document
 * itself says so: "No alterations are permissible to the format without written
 * approval of QA - TML." Correcting the spelling would invalidate the approval.
 *
 * This lives as a constant rather than on S for the same reason: an imported
 * backup must not be able to rewrite a QA-approved format. Company identity is
 * the exception — name, address, contacts and GSTIN are read from S.company so
 * the certificate and the tax invoice can never disagree about who issued them.
 */
var QC_SHOP_DATA = {
  title: 'TEST CERTIFICATE (ZN PLATING)',
  logoMark: 'soma',
  fixed: {
    jobDescription: 'ZN : Plating with Fezn8A / 8B / 8C / 8CIIY',
    processReg: 'As Per JAQADPT02 of TATA MOTORS LTD',
    qualifiedByTML: 'Yes',
    qualifiedByTataSteelLtd: 'Yes',
    category: 'Sheet Metal / HR',
    // The reference's blank. Only reached now for a line with no measured
    // weight behind it — see qcNetWeight().
    netWt: '0.000'
  },
  section1: {
    heading: 'Description of Zinc Chemicals Used',
    subHeading: '(Please click the Appropriate Column &amp; Attach relevent Gl As per IS : 277-2018)',
    supplierA: 'GTZ India Ltd.',
    supplierB: 'M/s Graur &amp; Well',
    rows: [
      { sl: '01', process: 'Soak Greasing',
        a: 'Unisole NE / Super Soak', aObs: 'OK',
        b: 'Steelex K - 20', bObs: 'OK' },
      { sl: '02', process: 'Derusting',
        a: 'i) HCL Commercial Grade or<br>ii) Sulphuric Acid Commercial Grade', aObs: 'OK',
        b: 'i) HCL Commercial Grade or<br>ii) Sulphuric Acid Commercial Grade', bObs: 'OK' },
      { sl: '03', process: 'Anodic Electrolytic Cleaning',
        a: 'Cleaner SE-11 / Uniclean 266', aObs: 'OK',
        b: 'Ginbond 812', bObs: 'OK' },
      { sl: '04', process: 'Cynide / Acid Dip',
        a: 'Sodium Cyanide/Hydrochloric Acid', aObs: 'OK',
        b: 'Sodium Cyanide/Hydrochloric Acid', bObs: 'OK' },
      { sl: '05', process: 'Zinc Plating Bath I<br><span class="inv-qc-sub">Cynide based Zinc Bath</span>',
        a: 'Zinc Metal (99.99 % Pure)<br>Zintek Salt - 501<br>Duo - 555 / Unicol - A Purifier', aObs: '',
        b: 'Zinc Metal (99.99 % Pure)<br>Zinc Brite 16 Salt / Zinc Brite 17 Salt<br>Zinc Brite 16 Brightner / Zinc Brite', bObs: '' },
      { sl: '06', process: 'Zinc Plating Bath II<br><span class="inv-qc-sub">Acid based Zinc / Chloride Bath and or Barrel</span>',
        a: 'Acid Zinc Salt No. 1 (A)<br>Acid Zinc Salt No.2 (B)<br>Zylite MR Additive (M)<br>Zylite MR Brightner (B)', aObs: '',
        b: '47 Brightner / Monical Purifier<br>Zinthe Brite 937A, Zinthe Brite 937 BR,<br>Zinthe Brite ZN 21M / 75M, Zn 21R/75 R', bObs: '' },
      { sl: '07', process: 'Neutralisation',
        a: 'Nitric Acid Dip', aObs: 'OK',
        b: 'Nitric Acid Dip', bObs: 'OK' },
      { sl: '08', process: 'Passivation',
        a: 'Unimax OG 40 / Rodiprind (OGP)', aObs: 'OK',
        b: 'Ginca Fix Olive 952 / 952 M', bObs: 'OK' }
    ]
  },
  section2: {
    heading: 'Product Inspection',
    rows: [
      { sl: '01',
        param: 'Plating Thickness <span class="inv-qc-sub">(Check as per sampling plan given at the end)</span>',
        obs: '10-12', spec: 'TRIYELLOW', equip: 'DIGITAL ELCO METER' }
    ]
  },
  section3: {
    heading: 'FINAL COATING (100% Testing)',
    rows: [
      { sl: '01',
        param: 'Passivation Colour <span class="inv-qc-sub">(Master Sample)</span>',
        obs: 'OK',
        spec: 'Dark Smooth Olive Green / Blues (Silver) / Golden Yellow / Trivalent Yellow / Trivalent Blues',
        defective: 'NIL', equip: 'Digital Elco Meter' },
      { sl: '02',
        param: 'Visual Appearance <span class="inv-qc-sub">(Wrt Master Sample)</span>',
        obs: 'OK',
        spec: 'OK without any surface defect / Ruse / Damage / Importer Coverage / Peef off',
        defective: '', equip: '' }
    ]
  },
  notes: [
    'a) The Critical Parameters stated in the Final gating is checked 100% and only OK materials are to be despatched to the Customer.',
    'b) All the Information provided above are accurate and Auditable.',
    'c) Sampling Plan : Lot is defined at the No. of Components Zn Plated in one Bath-Rack/Barrel'
  ],
  samplingTable: [
    ['Up to 10', '100%', '21 to 50', '20%', '100 &amp; Above', '5%'],
    ['11 to 20', '50%', '51 to 100', '10%', '', '']
  ],
  disclaimer: 'Note : No alterations are permissible to the format without written approval of QA - TML.'
};

/* The certificate's own reference. Derived from the invoice line rather than
   drawn from a counter: regenerating a certificate must yield the same number
   it did the first time, and a derived reference cannot gap, cannot be voided,
   and needs no ledger of its own to explain itself. It also reads backwards —
   the number names the exact invoice line the certificate certifies. */
function qcCertNumber(inv, lineIdx) {
  return 'QC/' + (inv.displayNumber || inv.invoiceNumber || '') + '/' +
    String(lineIdx + 1).padStart(2, '0');
}

/* Net Wt. is the kilograms of this part in this dispatch — per consignment, not
   per piece (settled with the owner; the approved reference left it at 0.000 and
   never said which). It sits beside Quantity in the same table, so it is scoped
   to the same line the certificate certifies, not to the whole invoice.

   Only ever a weight the invoice itself was priced on. Three cases:  */
function qcNetWeight(inv, item) {
  // 1. A KG line's quantity IS kilograms — the same figure that was billed.
  //    Quantity and Net Wt. reading alike is correct on weight-billed work; the
  //    form carries both fields because piece-billed parts make them differ.
  if ((item.unit || 'KG') === 'KG') return formatNum(item.qty, 3);

  var client = S.clients.find(function(c) { return c.id === inv.clientId; });

  // 2. A nos_to_weight line stores NOS, but the kilograms it was priced on are
  //    qty × the operator-entered figure in S.partWeights — the very arithmetic
  //    recalcLineItem() ran to produce the amount. Same measured fact, stored
  //    differently, so it certifies on the same footing as case 1. Absent that
  //    entry there is nothing measured to state, and it falls through.
  if (client && client.billingMode === 'nos_to_weight') {
    var w = (S.partWeights || {})[(item.partNumber || '').toUpperCase()] || 0;
    if (w > 0) return formatNum((item.qty || 0) * w, 3);
  }

  // 3. Piece-billed lines carry no measured weight. The Items Master figure for
  //    them is pieceRate ÷ ratePerKg — exact for tonnage and capacity share, but
  //    it is the rate card read backwards, and the customer who set that rate is
  //    the one being handed the certificate. Left blank rather than manufactured.
  return QC_SHOP_DATA.fixed.netWt;
}

/* Quantity as the certificate states it: three decimals, with the unit, because
   40 KG and 40 NOS are different consignments and the reference prints a bare
   number. A nos_to_weight line carries both, so both are shown. */
function qcQuantity(item) {
  var qty = formatNum(item.qty, 3) + ' ' + (item.unit || 'KG');
  if (item.nosQty && item.nosQty > 0) qty += ' (' + formatNum(item.nosQty, 0) + ' NOS)';
  return qty;
}

/* One certificate descriptor per invoice line. */
function qcCertsForInvoice(inv) {
  var addr = inv.clientAddress || {};
  var addrHtml = [addr.add1, addr.add2, addr.add3]
    .filter(function(l) { return l; })
    .map(escHtml)
    .join('<br>');

  return (inv.items || []).map(function(item, idx) {
    var partNo = item.partNumber || item.desc || '';
    // The gauge is part of a part's identity — two rows can share a part number
    // at different gauges and different weights. It is folded into `desc` at
    // entry by partLineDesc(), so carrying the description through carries the
    // gauge onto the certificate without a second registry lookup.
    var partDesc = (item.desc && item.desc !== partNo) ? item.desc : '';
    return {
      certNo: qcCertNumber(inv, idx),
      issueDate: formatDateExport(inv.date),
      customerName: inv.clientName || '',
      customerAddrHtml: addrHtml,
      invoiceNo: inv.displayNumber || '',
      poRef: inv.poNumber || '',
      challanNo: inv.challanNo || '',
      challanDate: inv.challanDate ? formatDateExport(inv.challanDate) : '',
      partNo: partNo,
      partDesc: partDesc,
      quantity: qcQuantity(item),
      netWt: qcNetWeight(inv, item)
    };
  });
}

function _qcHeaderHtml() {
  var co = S.company || {};
  var addr = [co.add1, co.add2, co.add3].filter(function(l) { return l; }).join(', ');
  var contacts = [];
  if (co.phone) contacts.push('Phone : ' + escHtml(co.phone));
  if (co.mobile) contacts.push('Mobile : ' + escHtml(co.mobile));
  if (co.email) contacts.push('E-Mail : ' + escHtml(co.email));

  return '<div class="inv-qc-header">' +
    '<div class="inv-qc-logo">' + escHtml(QC_SHOP_DATA.logoMark) + '</div>' +
    '<div class="inv-qc-letterhead">' +
    '<div class="inv-qc-company">' + escHtml(co.name || '') + '</div>' +
    '<div class="inv-qc-addr">' + escHtml(addr) + '</div>' +
    (contacts.length ? '<div class="inv-qc-contact">' + contacts.join(' &nbsp; ') + '</div>' : '') +
    '</div></div>';
}

function _qcFooterHtml() {
  var co = S.company || {};
  var addr = [co.add1, co.add2, co.add3].filter(function(l) { return l; }).join(', ');
  return '<div class="inv-qc-footer">' +
    '<div class="inv-qc-addr-block"><strong>' + escHtml(co.name || '') + '</strong><br>' +
    escHtml(addr) + '<br>GSTIN : ' + escHtml(co.gstin || '') + '</div>' +
    '<div class="inv-qc-sig"><span class="inv-qc-attribution">for ' + escHtml(co.name || '') + '</span>' +
    'Authorised Signatory</div></div>';
}

/* Build one A4 certificate page. Values drawn from the invoice are escaped;
   QC_SHOP_DATA is a constant carrying deliberate markup (line breaks, sub-text
   spans) and is not user data, so it is emitted as authored. */
function buildQualityCertHtml(c) {
  var s1 = QC_SHOP_DATA.section1;
  var s2 = QC_SHOP_DATA.section2;
  var s3 = QC_SHOP_DATA.section3;
  var f = QC_SHOP_DATA.fixed;
  var html = '';

  html += _qcHeaderHtml();
  html += '<div class="inv-qc-title">' + QC_SHOP_DATA.title + '</div>';

  html += '<div class="inv-qc-meta-row">' +
    '<span>Sr. No.: ' + escHtml(c.certNo) + '</span>' +
    '<span>Date: ' + escHtml(c.issueDate) + '</span></div>';

  var partCell = '<strong>' + escHtml(c.partNo) + '</strong>' +
    (c.partDesc ? '<span class="inv-qc-sub inv-qc-part-desc">' + escHtml(c.partDesc) + '</span>' : '');

  html += '<table class="inv-qc-grid inv-qc-customer">' +
    '<tr><td class="inv-qc-label">Customer Name</td><td class="inv-qc-value">' + escHtml(c.customerName) + '</td>' +
    '<td class="inv-qc-label">Invoice No.</td><td class="inv-qc-value">' + escHtml(c.invoiceNo) + '</td></tr>' +
    '<tr><td class="inv-qc-label">Address</td><td class="inv-qc-value">' + c.customerAddrHtml + '</td>' +
    '<td class="inv-qc-label">Purchase Order Ref :</td><td class="inv-qc-value">' + (c.poRef ? escHtml(c.poRef) : '&ndash;') + '</td></tr>' +
    '<tr><td class="inv-qc-label">Job Description</td><td class="inv-qc-value">' + f.jobDescription + '</td>' +
    '<td class="inv-qc-label">Challan No. Ref.</td><td class="inv-qc-value">' + (c.challanNo ? escHtml(c.challanNo) : '&ndash;') + '</td></tr>' +
    '<tr><td class="inv-qc-label">Process Reg.</td><td class="inv-qc-value">' + f.processReg + '</td>' +
    '<td class="inv-qc-label">Challan Date</td><td class="inv-qc-value">' + (c.challanDate ? escHtml(c.challanDate) : '&ndash;') + '</td></tr>' +
    '<tr><td class="inv-qc-label">Process Qualified by TML</td><td class="inv-qc-value">' + f.qualifiedByTML + '</td>' +
    '<td class="inv-qc-label">Quantity</td><td class="inv-qc-value">' + escHtml(c.quantity) + '</td></tr>' +
    '<tr><td class="inv-qc-label">Process Qualified By Tata Steel Ltd.</td><td class="inv-qc-value">' + f.qualifiedByTataSteelLtd + '</td>' +
    '<td class="inv-qc-label">Part No.</td><td class="inv-qc-value">' + partCell + '</td></tr>' +
    '<tr><td class="inv-qc-label">Net Wt.</td><td class="inv-qc-value">' + escHtml(c.netWt) + '</td>' +
    '<td class="inv-qc-label">Category</td><td class="inv-qc-value">' + f.category + '</td></tr>' +
    '</table>';

  // Section 1 — chemicals, two suppliers side by side
  html += '<div class="inv-qc-section">' + s1.heading +
    '<span class="inv-qc-sub-rule">' + s1.subHeading + '</span></div>';
  html += '<table class="inv-qc-grid inv-qc-no-top inv-qc-chem"><thead><tr>' +
    '<th>Sl. No.</th><th>Process Sequence</th>' +
    '<th>Chemical Name<span class="inv-qc-supplier-sub">' + s1.supplierA + '</span></th>' +
    '<th class="inv-qc-c">Observation</th>' +
    '<th>Chemical Name<span class="inv-qc-supplier-sub">' + s1.supplierB + '</span></th>' +
    '<th class="inv-qc-c">Observation</th></tr></thead><tbody>';
  s1.rows.forEach(function(r) {
    html += '<tr><td class="inv-qc-c">' + r.sl + '</td><td>' + r.process + '</td>' +
      '<td>' + r.a + '</td><td class="inv-qc-c">' + r.aObs + '</td>' +
      '<td>' + r.b + '</td><td class="inv-qc-c">' + r.bObs + '</td></tr>';
  });
  html += '</tbody></table>';

  // Section 2 — product inspection
  html += '<div class="inv-qc-section">' + s2.heading + '</div>';
  html += '<table class="inv-qc-grid inv-qc-no-top inv-qc-inspect"><thead><tr>' +
    '<th>Sl. No.</th><th>Critical Parameters</th>' +
    '<th class="inv-qc-c">Observation (Min &amp; Max)</th>' +
    '<th class="inv-qc-c">Specification</th><th>Equipment / Gauge Used</th></tr></thead><tbody>';
  s2.rows.forEach(function(r) {
    html += '<tr><td class="inv-qc-c">' + r.sl + '</td><td>' + r.param + '</td>' +
      '<td class="inv-qc-c">' + r.obs + '</td><td class="inv-qc-c">' + r.spec + '</td>' +
      '<td>' + r.equip + '</td></tr>';
  });
  html += '</tbody></table>';

  // Section 3 — final coating
  html += '<div class="inv-qc-section">' + s3.heading + '</div>';
  html += '<table class="inv-qc-grid inv-qc-no-top inv-qc-final"><thead><tr>' +
    '<th>Sl. No.</th><th>Critical Parameter</th><th class="inv-qc-c">Observation</th>' +
    '<th>Specification</th><th class="inv-qc-c">% Defective</th>' +
    '<th>Equipment / Gauge Used</th></tr></thead><tbody>';
  s3.rows.forEach(function(r) {
    html += '<tr><td class="inv-qc-c">' + r.sl + '</td><td>' + r.param + '</td>' +
      '<td class="inv-qc-c">' + r.obs + '</td><td>' + r.spec + '</td>' +
      '<td class="inv-qc-c">' + r.defective + '</td><td>' + r.equip + '</td></tr>';
  });
  html += '</tbody></table>';

  html += '<div class="inv-qc-notes">' +
    QC_SHOP_DATA.notes.map(function(n) { return '<div>' + n + '</div>'; }).join('') +
    '</div>';

  html += '<table class="inv-qc-grid inv-qc-sampling"><thead><tr>' +
    '<th class="inv-qc-c">LOT SIZE</th><th class="inv-qc-c">SAMPLE SIZE</th>' +
    '<th class="inv-qc-c">LOT SIZE</th><th class="inv-qc-c">SAMPLE SIZE</th>' +
    '<th class="inv-qc-c">LOT SIZE</th><th class="inv-qc-c">SAMPLE SIZE</th>' +
    '</tr></thead><tbody>';
  QC_SHOP_DATA.samplingTable.forEach(function(row) {
    html += '<tr>' + row.map(function(cell) {
      return '<td class="inv-qc-c">' + cell + '</td>';
    }).join('') + '</tr>';
  });
  html += '</tbody></table>';

  html += '<div class="inv-qc-disclaimer">' + QC_SHOP_DATA.disclaimer + '</div>';
  html += _qcFooterHtml();

  return html;
}

/* Resolve a selection of invoice ids into printable certificates.
   Returns what was excluded as well as what was built — a certificate that
   silently goes missing from a stack of forty is not noticed until the customer
   asks for it. */
function qcGatherCerts(invIds) {
  var result = { certs: [], invoices: [], cancelled: 0, empty: 0, missing: 0 };

  var invoices = (invIds || []).map(function(id) {
    return S.invoices.find(function(i) { return i.id === id; });
  });

  invoices.forEach(function(inv) {
    if (!inv) { result.missing++; return; }
    // A cancelled tax invoice certifies nothing: the goods it names were never
    // billed. Certifying against it would put a quality declaration behind a
    // number that appears in GSTR-1 at zero.
    if (inv.status === 'cancelled') { result.cancelled++; return; }
    if (!(inv.items || []).length) { result.empty++; return; }
    result.invoices.push(inv);
  });

  // Book order, so a printed stack collates the way the register reads. Sorted
  // numerically rather than as text: app-issued numbers are zero-padded and
  // would sort the same either way, but an imported one need not be, and 9
  // after 10 in a stack of certificates is a filing error waiting to happen.
  result.invoices.sort(function(a, b) {
    var na = invNumInt(a.invoiceNumber);
    var nb = invNumInt(b.invoiceNumber);
    if (na == null || nb == null) {
      return String(a.displayNumber || '').localeCompare(String(b.displayNumber || ''));
    }
    return na - nb;
  });

  result.invoices.forEach(function(inv) {
    result.certs = result.certs.concat(qcCertsForInvoice(inv));
  });

  return result;
}

/* Render certificates into the shared print view, so Print / Save-as-PDF and
   the toolbar come from the same place the invoice preview uses. */
function showQualityCertificates(invIds) {
  var gathered = qcGatherCerts(invIds);

  if (gathered.certs.length === 0) {
    if (gathered.cancelled > 0) {
      showToast('Cancelled invoices cannot carry a quality certificate', 'error');
    } else if (gathered.empty > 0) {
      showToast('Nothing to certify — no line items on that invoice', 'warning');
    } else {
      showToast('Select an invoice to certify', 'warning');
    }
    return;
  }

  var body = document.getElementById('invPrintBody');
  if (!body) return;

  var html = _qcRunNoticeHtml(gathered) + '<div class="inv-qc-sheets">';
  gathered.certs.forEach(function(c, i) {
    html += '<div class="inv-qc-page' + (i < gathered.certs.length - 1 ? ' inv-qc-page-break' : '') + '">' +
      buildQualityCertHtml(c) + '</div>';
  });
  body.innerHTML = html + '</div>';

  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  document.body.style.overflow = 'hidden';

  // Drives the filename when the browser saves the preview as a PDF.
  document._savedTitle = document.title;
  var first = gathered.invoices[0];
  document.title = gathered.invoices.length === 1
    ? 'QC ' + (first.displayNumber || '') + ' - ' + (first.clientName || 'SEP')
    : 'Quality Certificates - ' + gathered.invoices.length + ' invoices';
}

/* What the run produced, and what it left out, stated at the top of the stack.
   Not a toast: the print view sits above the toast layer, so a toast raised
   here is painted underneath it and never seen — and a count that has to be
   read within three seconds is the wrong instrument anyway. This banner stays
   put while the stack is reviewed, and `@media print` drops it, so it cannot
   reach the customer. Same reasoning as the coverage note on the Stats cards:
   an exclusion is reported in place, never left to be inferred. */
function _qcRunNoticeHtml(gathered) {
  var msg = gathered.certs.length + ' certificate' + (gathered.certs.length !== 1 ? 's' : '') +
    ' for ' + gathered.invoices.length + ' invoice' + (gathered.invoices.length !== 1 ? 's' : '');

  var reasons = [];
  if (gathered.cancelled > 0) reasons.push(gathered.cancelled + ' cancelled');
  if (gathered.empty > 0) reasons.push(gathered.empty + ' with no line items');
  if (gathered.missing > 0) reasons.push(gathered.missing + ' no longer in the register');

  if (reasons.length === 0) {
    return '<div class="inv-qc-notice">' + escHtml(msg) + '</div>';
  }
  // A certificate missing from a stack of forty is not noticed until the
  // customer asks for it, so the shortfall is named rather than implied.
  return '<div class="inv-qc-notice inv-qc-notice-warn">' + escHtml(msg) +
    ' — skipped ' + escHtml(reasons.join(', ')) + '</div>';
}

/* How many of a selection would actually produce a certificate. Drives the
   count on the register's selection bar, so the button never promises pages it
   will not print. */
function qcEligibleCount(invIds) {
  return (invIds || []).filter(function(id) {
    var inv = S.invoices.find(function(i) { return i.id === id; });
    return inv && inv.status !== 'cancelled' && (inv.items || []).length > 0;
  }).length;
}
