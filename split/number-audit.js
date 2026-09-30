/* ===== INVOICE NUMBER LEDGER ===== */

/*
 * Deleting an invoice used to remove the record outright, which made a
 * deliberately voided number indistinguishable from one never issued. On
 * 4 Aug inv 00666 was deleted for exactly the right reason — a duplicate of
 * inv 00657 — and the app immediately lost the reason along with the record.
 * Five earlier numbers are worse: cancelled and filed in GSTR-1 at zero, but
 * absent here, so the filing and the app disagree and every review re-raises
 * them.
 *
 * So a deletion now leaves a tombstone in S.voidedNumbers carrying the number,
 * the reason and what the invoice was, and the register can walk the whole
 * serial sequence and say of every number: live, cancelled, voided with a
 * reason, or unaccounted for. Unaccounted is the only state that needs work,
 * and a historical gap can be explained in place without inventing an invoice
 * to hang the explanation on.
 *
 * `reserved` is the distinction that matters for numbering. An invoice still
 * in `created` state never left the building, so its number is free to reuse —
 * that is the ordinary typo-and-redo flow. Once it is dispatched, delivered or
 * filed, the customer holds a document bearing that number: the number is
 * spent, invNextNum must never walk back over it, and rule 46's consecutive
 * series keeps a hole that this ledger explains.
 */

function getVoidedNumbers() {
  if (!S.voidedNumbers) S.voidedNumbers = [];
  return S.voidedNumbers;
}

function invNumInt(n) {
  var v = parseInt(n, 10);
  return isNaN(v) ? null : v;
}

function padInvNum(num) {
  return String(num).padStart(5, '0');
}

function displayForNumber(num) {
  return (S.invPrefix || '') + padInvNum(num);
}

/* The series a number belongs to: its display number less the number itself ('SEP/2026-27/' of
   'SEP/2026-27/00012'). Taken off by the number's own length, since a prefix may end in digits. */
function invSeriesOf(rec) {
  var d = String((rec && rec.displayNumber) || ''), n = String((rec && rec.invoiceNumber) || '');
  if (n && d.length >= n.length && d.slice(d.length - n.length) === n) return d.slice(0, d.length - n.length);
  return d.replace(/\d+$/, '');
}

/* The one serial order (the register, both CSVs, the printed register, a stack of certificates): the series first,
   so last financial year's run comes before this one's, then the number read as a number. A copy that sorted by the
   number alone put SEP/2026-27/00001 before SEP/2025-26/00950. */
function invSerialCompare(a, b) {
  var pa = invSeriesOf(a), pb = invSeriesOf(b);
  if (pa !== pb) return pa < pb ? -1 : 1;
  var na = invNumInt(a.invoiceNumber), nb = invNumInt(b.invoiceNumber);
  if (na == null || nb == null) return (na == null) - (nb == null);
  return na - nb;
}

/* invNextNum may only advance over what is held IN THE SERIES IN USE: live invoices and reserved voids under
   S.invPrefix. It read every number of every year, so after the prefix moved to a new financial year last year's
   00950 set this year's Next at 951. */
function recomputeNextInvoiceNumber() {
  S.invNextNum = invHighestIssued(S.invPrefix || '') + 1;
}

/* The highest number the customer holds under a prefix: a live invoice, or a
   deleted one whose number was spent. A new financial year's prefix has none. */
function invHighestIssued(prefix) {
  prefix = prefix || '';
  var hi = 0;
  var take = function(rec) {
    var n = invNumInt(rec.invoiceNumber);
    if (n != null && n > hi && invSeriesOf(rec) === prefix) hi = n;
  };
  S.invoices.forEach(take);
  getVoidedNumbers().forEach(function(v) { if (v.reserved) take(v); });
  return hi;
}

/* May this number be issued again? Never over a live invoice, and never once
   the invoice it belonged to was in a filed return: GSTR-1 already carries it.
   Before filing, a corrected invoice may take the number back (owner, 25 Sep
   2026: "If GST has not been filed this should be allowed"). */
function invReissueCheck(prefix, n) {
  var disp = prefix + padInvNum(n);
  var live = S.invoices.find(function(i) { return i.displayNumber === disp; });
  if (live) return { ok: false, why: disp + ' is held by a live invoice' + (live.clientName ? ' (' + live.clientName + ')' : '') };
  var filed = getVoidedNumbers().some(function(v) { return v.displayNumber === disp && v.lastState === 'filed'; });
  if (filed) return { ok: false, why: disp + ' was in a filed return, so it cannot be issued again' };
  return { ok: true, disp: disp };
}

/* ===== SEQUENCE ANALYSIS ===== */

/*
 * Bounds are drawn from evidence, not from 1. A user who starts a series at
 * 500 has not skipped 499 numbers, and reporting them as gaps would bury the
 * real ones. The top extends to invNextNum - 1: numbers handed out and then
 * lost are exactly what this is looking for.
 */
function analyseInvoiceNumbers() {
  // Each financial year's series on its own: keyed by the number alone, last year's 00002 stood in for this year's
  // missing one and the gap was never shown.
  var series = {};
  var of = function(p) { return series[p] || (series[p] = { byNum: {}, voidByNum: {}, known: [] }); };
  S.invoices.forEach(function(inv) {
    var n = invNumInt(inv.invoiceNumber);
    if (n == null) return;
    var s = of(invSeriesOf(inv));
    s.byNum[n] = inv;
    s.known.push(n);
  });
  getVoidedNumbers().forEach(function(v) {
    var n = invNumInt(v.invoiceNumber);
    if (n == null) return;
    var s = of(invSeriesOf(v));
    s.voidByNum[n] = v;
    s.known.push(n);
  });

  var out = { entries: [], unaccounted: [], counts: { active: 0, cancelled: 0, voided: 0, reissued: 0, unaccounted: 0 }, from: null, to: null, series: [] };
  var cur = S.invPrefix || '', next = invNumInt(S.invNextNum);
  Object.keys(series).sort().forEach(function(p) {
    var s = series[p];
    var lo = Math.min.apply(null, s.known);
    var hi = Math.max.apply(null, s.known);
    // The series in use runs to the number before Next: one handed out and lost is what this looks for.
    if (p === cur && next != null && next - 1 > hi) hi = next - 1;
    for (var n = lo; n <= hi; n++) {
      var inv = s.byNum[n] || null;
      var voided = s.voidByNum[n] || null;
      var kind;
      if (inv && voided) kind = 'reissued';
      else if (inv) kind = inv.status === 'cancelled' ? 'cancelled' : 'active';
      else if (voided) kind = 'voided';
      else kind = 'unaccounted';

      out.counts[kind]++;
      var entry = { num: n, display: inv ? inv.displayNumber : voided ? voided.displayNumber : p + padInvNum(n), kind: kind, inv: inv, voided: voided };
      out.entries.push(entry);
      if (kind === 'unaccounted') out.unaccounted.push(entry);
    }
    out.series.push({ prefix: p, from: lo, to: hi });
    if (p === cur || out.from == null) { out.from = lo; out.to = hi; }
  });
  return out;
}

function unaccountedNumberCount() {
  return analyseInvoiceNumbers().unaccounted.length;
}

/* ===== VOID LEDGER WRITES ===== */

/* Called from confirmDeleteInvoice, after the invoice has been read but before
   it is spliced out. Returns the record so the caller can report on it. */
function recordVoidedNumber(inv, reason, reserved) {
  var rec = {
    invoiceNumber: inv.invoiceNumber,
    displayNumber: inv.displayNumber,
    date: inv.date || '',
    clientId: inv.clientId != null ? inv.clientId : null,
    clientName: inv.clientName || '',
    // The challan it billed, so a challan search finds the void as it found the invoice.
    challanNo: inv.challanNo || '',
    taxableValue: inv.taxableValue || 0,
    grandTotal: inv.grandTotal || 0,
    lastState: getInvState(inv),
    wasCancelled: inv.status === 'cancelled',
    reason: reason,
    reserved: !!reserved,
    source: 'deleted',
    voidedAt: Date.now()
  };
  getVoidedNumbers().push(rec);
  return rec;
}

/* ===== ACCOUNT FOR A HISTORICAL GAP ===== */

var _accountForNum = null;
var _accountForDisplay = '';

/* `display` is the number as its series writes it: a gap in last year's series is recorded under last year's prefix. */
function openAccountForNumber(num, display) {
  var n = invNumInt(num);
  if (n == null) return;
  _accountForNum = n;
  _accountForDisplay = display || displayForNumber(n);

  // An act, not a view: a tap on the scrim does nothing.
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('Account for ' + escHtml(_accountForDisplay), 'invCloseConfirm') +
    '<p class="inv-mb-8">This number is missing from the register. Record what happened to it — a cancelled invoice filed at zero, a spoiled number, one deleted before this ledger existed. No invoice is created.</p>' +
    '<div class="inv-field"><label class="inv-field-label" for="invGapReason">What happened to this number</label>' +
    '<input class="inv-input" id="invGapReason" placeholder="e.g. cancelled, filed in GSTR-1 at zero" autocomplete="off"></div>' +
    '<div class="inv-fields">' +
    '<div class="inv-field"><label class="inv-field-label" for="invGapDate">Date (optional)</label>' +
    '<input type="date" class="inv-input inv-id" id="invGapDate"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="invGapClient">Customer (optional)</label>' +
    '<input class="inv-input" id="invGapClient" autocomplete="off"></div></div>' +
    '<div class="inv-dialog-foot">' +
    '<button class="inv-btn inv-btn-secondary" data-action="invCloseConfirm">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invSaveGapReason">Record</button></div></div>');
}

function saveGapReason() {
  if (_accountForNum == null) return;
  var reasonEl = document.getElementById('invGapReason');
  var reason = reasonEl ? reasonEl.value.trim() : '';
  if (!reason) { showToast('Say what happened to this number', 'error'); return; }

  var dateEl = document.getElementById('invGapDate');
  var clientEl = document.getElementById('invGapClient');
  var n = _accountForNum, disp = _accountForDisplay || displayForNumber(n);

  getVoidedNumbers().push({
    invoiceNumber: padInvNum(n),
    displayNumber: disp,
    date: (dateEl && dateEl.value) || '',
    clientId: null,
    clientName: (clientEl && clientEl.value.trim()) || '',
    taxableValue: 0,
    grandTotal: 0,
    lastState: 'unknown',
    wasCancelled: false,
    reason: reason,
    // A number old enough to be a gap was issued. It is spent either way.
    reserved: true,
    source: 'reconciled',
    voidedAt: Date.now()
  });
  recomputeNextInvoiceNumber();
  saveState();
  _accountForNum = null;

  closeOverlay();
  _regToolbarRendered = false;
  renderRegisterToolbar();
  _regToolbarRendered = true;
  _renderRegView();
  showNumberAudit();
  showToast(disp + ' accounted for');
}

/* ===== AUDIT OVERLAY ===== */

var NUM_AUDIT_LABELS = {
  active: 'Live', cancelled: 'Cancelled', voided: 'Voided',
  reissued: 'Reissued', unaccounted: 'Unaccounted'
};
/* A number's class as a status tone (§6.13): unaccounted is the one to act on. */
var NUM_AUDIT_TONE = { active: 'ok', cancelled: 'neutral', voided: 'info', reissued: 'warning', unaccounted: 'danger' };

function _numAuditRowHtml(entry) {
  var detail;
  if (entry.kind === 'unaccounted') {
    detail = 'Nothing recorded against this number';
  } else if (entry.voided) {
    detail = escHtml(entry.voided.reason) +
      (entry.voided.clientName ? ' &middot; ' + escHtml(entry.voided.clientName) : '') +
      (entry.voided.date ? ' &middot; ' + escHtml(formatDate(entry.voided.date)) : '') +
      // A number once cancelled says so: it was declared at zero before it was deleted.
      (entry.voided.wasCancelled ? ' &middot; cancelled before it was deleted' : '');
  } else {
    detail = escHtml(entry.inv.clientName || '') +
      (entry.inv.date ? ' &middot; ' + escHtml(formatDate(entry.inv.date)) : '') +
      ' &middot; ' + formatCurrency(entry.inv.taxableValue || 0);
  }

  return '<div class="inv-row inv-row-2' + (entry.kind === 'unaccounted' ? ' inv-row-flow' : '') + '" data-num-kind="' + entry.kind + '">' +
    '<span class="inv-row-main"><span class="inv-row-title inv-id">' + escHtml(entry.display) + '</span>' +
    '<span class="inv-row-meta">' + detail + '</span></span>' +
    '<span class="inv-row-end"><span class="inv-dot inv-dot-' + NUM_AUDIT_TONE[entry.kind] + '">' + NUM_AUDIT_LABELS[entry.kind] + '</span>' +
    (entry.kind === 'unaccounted'
      ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAccountForNumber" data-num="' + entry.num + '" data-display="' + escHtml(entry.display) + '">Account for</button>'
      : '') +
    '</span></div>';
}

function _numAuditPanelHtml(title, entries) {
  return '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">' + title +
    ' <span class="inv-panel-count">' + entries.length + '</span></span></div>' +
    '<div class="inv-scroll">' + entries.map(_numAuditRowHtml).join('') + '</div></div>';
}

function showNumberAudit() {
  var a = analyseInvoiceNumbers();
  var html = '<div class="inv-dialog">' + dialogHeadHtml('Number audit');

  if (a.entries.length === 0) {
    html += '<div class="inv-empty">No invoice numbers issued yet.</div>';
  } else {
    // Each financial year's series is its own run.
    html += '<p class="inv-note inv-mb-8">' + a.series.map(function(r) {
      return (a.series.length > 1 ? '<span class="inv-id">' + escHtml(r.prefix) + '</span> ' : '') + 'Serial <span class="inv-id">' +
        escHtml(padInvNum(r.from)) + '</span> to <span class="inv-id">' + escHtml(padInvNum(r.to)) + '</span>';
    }).join(' &middot; ') + ', every number accounted for or not. Rule 46 wants a consecutive series; a gap is fine, an <em>unexplained</em> gap is not.</p>';

    // The tally, each class a dot and a word in its tone.
    var tally = function(kind, n, word) { return '<span class="inv-dot inv-dot-' + NUM_AUDIT_TONE[kind] + '">' + n + ' ' + word + '</span>'; };
    html += '<div class="inv-toolbar" data-num-tally>' +
      tally('active', a.counts.active, 'live') + tally('cancelled', a.counts.cancelled, 'cancelled') + tally('voided', a.counts.voided, 'voided') +
      (a.counts.reissued > 0 ? tally('reissued', a.counts.reissued, 'reissued') : '') +
      tally('unaccounted', a.counts.unaccounted, 'unaccounted') + '</div>';

    if (a.unaccounted.length > 0) html += _numAuditPanelHtml('Unaccounted', a.unaccounted);

    var explained = a.entries.filter(function(e) { return e.kind === 'voided' || e.kind === 'reissued'; });
    if (explained.length > 0) html += _numAuditPanelHtml('Voided, with a reason', explained);

    if (a.unaccounted.length === 0 && explained.length === 0) {
      html += '<div class="inv-empty">Unbroken series. No gaps to explain.</div>';
    }
  }

  html += '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-primary" data-action="invCloseOverlay">Close</button></div></div>';
  dialogOpen(html);
}

/* ===== EXPORT ROWS ===== */

/*
 * A voided number the returns carry at zero: one whose document was spent (reserved — dispatched or later, or
 * cancelled first), or one the series has moved past. A created invoice deleted below the last issued number
 * never comes back (Next never walks back over a held number), so without its row GSTR-1's series showed a hole
 * the audit called explained. A void above the last issued number returns to the series: the next invoice takes it.
 */
function invVoidExported(v, hiOf) {
  if (v.reserved) return true;
  var n = invNumInt(v.invoiceNumber);
  return n != null && n < hiOf(invSeriesOf(v));
}

function getVoidedForExport() {
  // A number reissued to a live invoice is that invoice's now: its deleted
  // copies are history, not rows. Listing them put 00862 in the GSTR-1 file
  // three times (two at zero and the live one), and the portal takes each
  // number once. A number deleted twice and never reissued is listed once.
  var live = {}, hiBy = {};
  var hiOf = function(p) { return Object.prototype.hasOwnProperty.call(hiBy, p) ? hiBy[p] : (hiBy[p] = invHighestIssued(p)); };
  S.invoices.forEach(function(i) { live[i.displayNumber] = true; });
  var latest = {};
  getVoidedNumbers().forEach(function(v) {
    if (live[v.displayNumber] || !invVoidExported(v, hiOf)) return;
    var k = v.displayNumber || v.invoiceNumber;
    if (!latest[k] || (v.voidedAt || 0) > (latest[k].voidedAt || 0)) latest[k] = v;
  });
  // The register's own filter decides which voids ride along (regFilterMatch, invoice-ops.js): a copy of it here
  // ignored the State filter.
  return getVoidedNumbers().filter(function(v) {
    return latest[v.displayNumber || v.invoiceNumber] === v && regFilterMatch(v, true);
  }).sort(invSerialCompare);
}
