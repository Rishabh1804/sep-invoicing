/* ===== IM DUPLICATE GUARD ===== */

/*
 * Seven duplicate receipt events went into the books across FY27 unchallenged:
 * 973.75 kg + 826 NOS of phantom receipts, four of which propagated into
 * customer invoices (Dilip ch 47, General ch 932, Khurana ch 202, Dorabji
 * ch 146). Nothing in the app said a word at either end.
 *
 * The obvious key — (client, challanNo, challanDate) — misses two of those
 * seven. One copy of Dorabji ch 146 carried a blank challanNo, and Dilip ch 47
 * carried the same 282.70 kg under an aliased part number. So the fingerprint
 * is content-based instead: client + challan date + the multiset of line
 * quantities. Part names and challan numbers are what the operator retypes;
 * the weights are what the material actually was.
 *
 * Warning, not hard block. Split challans against one consignment (702/703)
 * are legitimate and can look identical, so the judgement stays with the
 * operator — but the acknowledgement is stamped on the entry, so a later audit
 * can tell a duplicate somebody accepted from one nobody was ever shown.
 */

/* Multiset of line quantities, order-independent. */
function imQtySignature(items) {
  var parts = (items || []).map(function(it) {
    var qty = Math.round((Number(it.qty) || 0) * 1000) / 1000;
    var nos = Math.round(Number(it.nosQty) || 0);
    return (it.unit || 'KG') + ':' + qty + (nos > 0 ? '/' + nos : '');
  });
  parts.sort();
  return parts.join('|');
}

function imFingerprint(clientId, challanDate, items) {
  return clientId + '@' + (challanDate || '') + '#' + imQtySignature(items);
}

function imChallanFingerprint(im) {
  return imFingerprint(im.clientId, im.challanDate, im.items);
}

/* A challan of all-zero quantities fingerprints against every other empty one.
   Those matches carry no information, so they are not raised. */
function imHasQuantity(items) {
  return (items || []).some(function(it) {
    return (Number(it.qty) || 0) > 0 || (Number(it.nosQty) || 0) > 0;
  });
}

/*
 * Matches for one candidate challan against everything already stored.
 *   content — same client, same date, same quantity multiset
 *   number  — same client, same non-blank challan number (any date, so a
 *             re-entry with the date corrected still surfaces)
 *   blankNo — the candidate has no challan number of its own
 */
function findChallanDuplicates(candidate, excludeId) {
  var out = { content: [], number: [], blankNo: false, any: false };
  if (!candidate || !candidate.clientId) return out;

  var challanNo = (candidate.challanNo || '').trim();
  out.blankNo = challanNo === '';

  var fp = imFingerprint(candidate.clientId, candidate.challanDate, candidate.items);
  var scorable = imHasQuantity(candidate.items);
  var cnKey = challanNo.toLowerCase();

  (S.incomingMaterial || []).forEach(function(im) {
    if (im.id === excludeId) return;
    if (im.clientId !== candidate.clientId) return;
    if (scorable && imChallanFingerprint(im) === fp) {
      out.content.push(im);
      return;
    }
    if (cnKey && (im.challanNo || '').trim().toLowerCase() === cnKey) {
      out.number.push(im);
    }
  });

  out.any = out.content.length > 0 || out.number.length > 0 || out.blankNo;
  return out;
}

/* ===== BILLING VERDICT ===== */

/*
 * A duplicate receipt sometimes propagates to a bill and sometimes does not —
 * ch 248 and ch 110 collapsed into a single invoice and cost nothing, while
 * ch 47 and ch 932 became real output tax. The collection-level check cannot
 * tell those apart; following the line items into `invoices` can.
 */
function imDuplicateVerdict(group) {
  var invoiceIds = {};
  var invoicedCopies = 0;
  group.forEach(function(im) {
    var hit = false;
    im.items.forEach(function(it) {
      if (it.invoiced && it.invoiceId) { invoiceIds[it.invoiceId] = true; hit = true; }
      else if (it.invoiced) { hit = true; }
    });
    if (hit) invoicedCopies++;
  });
  var distinct = Object.keys(invoiceIds).length;
  if (distinct > 1) return { key: 'billed', label: 'Billed twice', cls: 'inv-dupe-verdict-billed' };
  if (invoicedCopies === 0) return { key: 'open', label: 'Unbilled — still preventable', cls: 'inv-dupe-verdict-open' };
  return { key: 'collapsed', label: 'Collapsed into one invoice', cls: 'inv-dupe-verdict-clean' };
}

/* Value of the surplus copies: everything beyond the first. */
function imDuplicateExposure(group) {
  var totals = group.map(function(im) {
    return im.items.reduce(function(s, it) { return s + (Number(it.amount) || 0); }, 0);
  });
  var all = totals.reduce(function(s, t) { return s + t; }, 0);
  return gstRound(all - Math.max.apply(null, totals));
}

/* ===== WHOLE-COLLECTION SCAN ===== */

function imDuplicateGroups() {
  var buckets = {};
  (S.incomingMaterial || []).forEach(function(im) {
    if (!imHasQuantity(im.items)) return;
    var fp = imChallanFingerprint(im);
    if (!buckets[fp]) buckets[fp] = [];
    buckets[fp].push(im);
  });
  var groups = [];
  Object.keys(buckets).forEach(function(fp) {
    if (buckets[fp].length > 1) {
      groups.push(buckets[fp].slice().sort(function(a, b) {
        return (a.createdAt || 0) - (b.createdAt || 0);
      }));
    }
  });
  groups.sort(function(a, b) {
    return (b[0].challanDate || '').localeCompare(a[0].challanDate || '');
  });
  return groups;
}

function imBlankChallanRecords() {
  return (S.incomingMaterial || []).filter(function(im) {
    return !(im.challanNo || '').trim();
  }).sort(function(a, b) {
    return (b.challanDate || '').localeCompare(a.challanDate || '');
  });
}

function imDuplicateGroupCount() {
  return imDuplicateGroups().length;
}

/* ===== PRE-SAVE WARNING ===== */

function imChallanSummary(im) {
  var total = im.items.reduce(function(s, it) { return s + (Number(it.amount) || 0); }, 0);
  return im.items.length + ' item' + (im.items.length === 1 ? '' : 's') +
    ' · ' + formatCurrency(total);
}

function imChallanLabel(im) {
  return im.challanNo ? 'Ch. ' + im.challanNo : 'No challan no.';
}

function _dupeMatchRowHtml(im, showLocate) {
  var status = getIMStatus(im);
  return '<div class="inv-dupe-row">' +
    '<div class="inv-dupe-row-main">' +
    '<div class="inv-dupe-row-no">' + escHtml(imChallanLabel(im)) + '</div>' +
    '<div class="inv-dupe-row-detail">' + escHtml(formatDate(im.challanDate)) + ' · ' +
    escHtml(imChallanSummary(im)) + '</div></div>' +
    '<span class="inv-im-status inv-im-status-' + status + '">' + status + '</span>' +
    (showLocate ? '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invDupeLocate" data-id="' +
      escHtml(im.id) + '">Locate</button>' : '') +
    '</div>';
}

/*
 * Shown before a challan is written, from both entry paths — the manual form
 * and the scanner, which fills the same _challanForm and calls the same save.
 */
function showChallanDuplicateWarning(matches) {
  if (_challanForm) {
    _challanForm._dupeMatchedIds = matches.content.concat(matches.number).map(function(im) { return im.id; });
  }

  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';

  var html = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Possible duplicate challan</span>' +
    '<button class="inv-overlay-close" data-action="invCloseConfirm">&times;</button></div>';

  if (matches.content.length > 0) {
    html += '<div class="inv-confirm-warn">This client already has ' +
      (matches.content.length === 1 ? 'a challan' : matches.content.length + ' challans') +
      ' on the same date with exactly these quantities. Entering it twice inflates the receipt and can reach the customer\'s bill.</div>' +
      '<div class="inv-dupe-scroll">' +
      matches.content.map(function(im) { return _dupeMatchRowHtml(im, false); }).join('') +
      '</div>';
  }

  if (matches.number.length > 0) {
    html += '<div class="inv-dupe-section-label">Same challan number already recorded</div>' +
      '<div class="inv-dupe-scroll">' +
      matches.number.map(function(im) { return _dupeMatchRowHtml(im, false); }).join('') +
      '</div>';
  }

  if (matches.blankNo) {
    html += '<div class="inv-dupe-note">No challan number on this entry. A blank number is what let one copy of a duplicated challan hide the first time — worth filling in if the paper has one.</div>';
  }

  html += '<div class="inv-confirm-body">Split challans against one consignment are legitimate. If this is genuinely a separate receipt, save it — the acknowledgement is recorded against the entry.</div>' +
    '<div class="inv-btn-bar">' +
    '<button class="inv-btn inv-btn-ghost" data-action="invCloseConfirm">Go Back</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invDupeSaveAnyway">Save Anyway</button></div></div>';

  scrim.innerHTML = html;
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

function acceptChallanDuplicates() {
  closeTopOverlay();
  if (!_challanForm) return;
  _challanForm._dupeAcked = true;
  saveChallan();
}

/* ===== SCAN OVERLAY ===== */

function runIMDuplicateScan() {
  var groups = imDuplicateGroups();
  var blanks = imBlankChallanRecords();

  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';

  var html = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Duplicate Check</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div>';

  if (groups.length === 0 && blanks.length === 0) {
    html += '<div class="inv-empty-state">No duplicate challans and no blank challan numbers.</div>';
  } else {
    html += '<div class="inv-dupe-note">Challans matched on client, date and line quantities. Nothing here is deleted automatically — a duplicate record is the evidence of the pattern, and only you know which copy is the real one.</div>';
  }

  if (groups.length > 0) {
    html += '<div class="inv-dupe-section-label">' + groups.length + ' duplicate group' +
      (groups.length === 1 ? '' : 's') + '</div><div class="inv-dupe-scroll">';
    groups.forEach(function(group) {
      var verdict = imDuplicateVerdict(group);
      var exposure = imDuplicateExposure(group);
      html += '<div class="inv-dupe-group">' +
        '<div class="inv-dupe-group-head">' +
        '<span class="inv-dupe-group-title">' + escHtml(group[0].clientName || 'Unknown client') + '</span>' +
        '<span class="inv-dupe-verdict ' + verdict.cls + '">' + escHtml(verdict.label) + '</span></div>' +
        '<div class="inv-dupe-group-meta">' + escHtml(formatDate(group[0].challanDate)) +
        ' · ' + group.length + ' copies · surplus ' + formatCurrency(exposure) + '</div>' +
        group.map(function(im) { return _dupeMatchRowHtml(im, true); }).join('') +
        '</div>';
    });
    html += '</div>';
  }

  if (blanks.length > 0) {
    html += '<div class="inv-dupe-section-label">' + blanks.length + ' challan' +
      (blanks.length === 1 ? '' : 's') + ' with no challan number</div>' +
      '<div class="inv-dupe-scroll">' +
      blanks.map(function(im) { return _dupeMatchRowHtml(im, true); }).join('') +
      '</div>';
  }

  html += '<div class="inv-btn-bar"><button class="inv-btn inv-btn-primary" data-action="invCloseOverlay">Close</button></div></div>';

  scrim.innerHTML = html;
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

/* Close the scan, filter the list down to that client, and open the challan. */
function imLocateChallan(imId) {
  var im = (S.incomingMaterial || []).find(function(m) { return m.id === imId; });
  if (!im) { showToast('Challan not found', 'warning'); return; }
  closeOverlay();

  _imFilter.clientId = String(im.clientId);
  _imFilter.status = '';
  _imExpanded[imId] = true;
  _imActiveChallanId = imId;

  _imToolbarRendered = false;
  renderIMToolbar();
  _imToolbarRendered = true;
  _renderIMView();

  var target = document.querySelector('[data-id="' + imId + '"]');
  if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center' });
}
