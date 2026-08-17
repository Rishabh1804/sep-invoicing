/* ===== PART AUTOCOMPLETE (Phase 3) ===== */
function searchParts(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  const matches = [];
  for (let i = 0; i < S.items.length && matches.length < 8; i++) {
    const item = S.items[i];
    if ((item.partNumber || '').toLowerCase().includes(q) ||
        (item.desc || '').toLowerCase().includes(q) ||
        (item.gauge || '').toLowerCase().includes(q)) {
      matches.push(item);
    }
  }
  return matches;
}

/* The printed line description for a catalogue part.
   Folds the gauge back in, because the gauge is what tells two rows of the same
   part apart and the line text is the only place a reader of the document sees
   it. Four clamp families exist in two gauges at different rates — CLAMP 165X83
   (NT) at 35X6 and 40X6, and three more — so a line reading just "Clamp 165x83"
   does not say which one was plated, on the invoice or afterwards.
   Shared by the invoice and challan paths: the challan path used to assign
   part.desc raw and drop the gauge, and since IM is the billing spine that
   omission flowed straight through to the invoice. */
function partLineDesc(part) {
  if (!part) return '';
  return part.desc && part.gauge ? part.desc + ' (' + part.gauge + ')'
       : (part.desc || part.gauge || '');
}

/* A part not yet in the master used to end data entry: the dropdown simply
   vanished, and the only way forward was to leave for the Items tab, add it,
   and come back to a form that no longer held what had been typed. The last
   row of the list now offers to create it in place. */
var AC_MIN_NEW = 2;

function renderAddPartOption(idx, idPrefix, query, kind) {
  return '<div class="inv-autocomplete-item inv-ac-add" role="option" id="' + idPrefix + idx + '_new"' +
    ' data-ac-new="1" data-action="invAddItemInline" data-kind="' + kind + '"' +
    ' data-idx="' + idx + '" data-q="' + escHtml(query) + '">' +
    '<svg class="inv-ac-add-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
    '<span class="inv-autocomplete-part">Add &ldquo;' + escHtml(query) + '&rdquo;</span>' +
    '<span class="inv-autocomplete-desc">new item in the master</span></div>';
}

/* Render the suggestion rows for one part input. Shared by the invoice form
   and the challan form, which differ only in the action and element ids. */
function renderPartOptions(acEl, matches, action, idx, idPrefix, query, kind) {
  // The gauge is shown as its own badge: several clamp part numbers exist in
  // more than one gauge, and it is the only thing telling those rows apart.
  var html = matches.map((m, i) =>
    '<div class="inv-autocomplete-item" role="option" id="' + idPrefix + idx + '_' + i + '"' +
    ' data-action="' + action + '" data-idx="' + idx + '" data-part-id="' + m.id + '">' +
    '<span class="inv-autocomplete-part">' + escHtml(m.partNumber) + '</span>' +
    (m.gauge ? '<span class="inv-gauge-badge">' + escHtml(m.gauge) + '</span>' : '') +
    '<span class="inv-autocomplete-desc">' + escHtml(m.desc || '') + '</span></div>'
  ).join('');
  // Offered even when there are matches: a new gauge of an existing clamp
  // matches the part number but is a different part, and that is precisely the
  // case where the registry needs a row it does not have.
  if (query && query.length >= AC_MIN_NEW) html += renderAddPartOption(idx, idPrefix, query, kind);
  acEl.innerHTML = html;
}

/* The list now stays open on zero matches, because that is exactly the moment
   the operator needs to create the part. It closes only when there is neither
   a match nor enough typed to name a new one. */
function _showPartAC(acElId, inputSel, idx, query, action, idPrefix, kind) {
  const acEl = document.getElementById(acElId);
  if (!acEl) return;
  const input = document.querySelector(inputSel);
  const matches = searchParts(query);
  const q = (query || '').trim();
  acReset();
  if (matches.length === 0 && q.length < AC_MIN_NEW) {
    acEl.classList.add('inv-hidden');
    if (input) input.setAttribute('aria-expanded', 'false');
    return;
  }
  acEl.classList.remove('inv-hidden');
  renderPartOptions(acEl, matches, action, idx, idPrefix, q, kind);
  if (input) input.setAttribute('aria-expanded', 'true');
}

function showPartAutocomplete(idx, query) {
  _showPartAC('invPartAC' + idx,
    '[data-action="invEditLinePart"][data-idx="' + idx + '"]',
    idx, query, 'invSelectPart', 'invPartOpt', 'invoice');
}

/* Same, for the IM challan form. */
function showChallanPartAutocomplete(idx, query) {
  _showPartAC('imPartAC' + idx,
    '[data-action="invEditChallanPart"][data-idx="' + idx + '"]',
    idx, query, 'invSelectChallanPart', 'imPartOpt', 'challan');
}

function dismissAllAutocomplete() {
  document.querySelectorAll('.inv-autocomplete-list').forEach(el => el.classList.add('inv-hidden'));
  document.querySelectorAll('[role="combobox"]').forEach(el => el.setAttribute('aria-expanded', 'false'));
  acReset();
}

/* ===== SUGGESTION LIST KEYBOARD NAVIGATION =====
   Both suggestion surfaces — the part autocomplete and the client search —
   were pointer-only: the list rendered, and the only way into it was a click.
   Only one list can be open at a time, so a single cursor covers both. It is
   held as an index rather than an element reference because the list is
   rebuilt on every keystroke. */
var _acCursor = -1;

function acReset() { _acCursor = -1; }

/* The open suggestion list belonging to an input, or null. */
function acListFor(input) {
  if (!input || !input.closest) return null;
  const wrap = input.closest('.inv-autocomplete-wrap');
  if (wrap) {
    const list = wrap.querySelector('.inv-autocomplete-list');
    return list && !list.classList.contains('inv-hidden') ? list : null;
  }
  const searchWrap = input.closest('.inv-search-wrap');
  if (searchWrap) {
    const results = searchWrap.querySelector('.inv-search-results');
    return results && !results.classList.contains('inv-hidden') ? results : null;
  }
  return null;
}

function acOptions(list) {
  if (!list) return [];
  return Array.prototype.slice.call(list.querySelectorAll('.inv-autocomplete-item, .inv-search-item'));
}

/* Move the highlight, wrapping at both ends. */
function acMoveCursor(list, delta) {
  const opts = acOptions(list);
  if (opts.length === 0) { _acCursor = -1; return; }
  let next = _acCursor + delta;
  if (next < 0) next = opts.length - 1;
  if (next >= opts.length) next = 0;
  _acCursor = next;
  opts.forEach((opt, i) => {
    if (i === next) {
      opt.classList.add('inv-ac-active');
      opt.setAttribute('aria-selected', 'true');
    } else {
      opt.classList.remove('inv-ac-active');
      opt.removeAttribute('aria-selected');
    }
  });
  const active = opts[next];
  if (active) {
    if (active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
    const input = list.closest('.inv-autocomplete-wrap, .inv-search-wrap');
    const combo = input ? input.querySelector('[role="combobox"]') : null;
    if (combo && active.id) combo.setAttribute('aria-activedescendant', active.id);
  }
}

/* The option Enter should commit: the highlighted one, or a lone match —
   a single suggestion is unambiguous, so requiring an arrow press first
   would just be an extra keystroke. */
function acPendingOption(list) {
  const opts = acOptions(list);
  if (_acCursor >= 0 && opts[_acCursor]) return opts[_acCursor];
  // The "add new" row is present on almost every list, so counting it would
  // have quietly ended the lone-match shortcut — one real suggestion plus the
  // add row is two options, and Enter would have stopped committing. It is
  // also never what an unaimed Enter should do: typing a part and pressing
  // Enter means "on to the quantity", not "open a dialog".
  const real = opts.filter(o => !o.dataset.acNew);
  return real.length === 1 ? real[0] : null;
}

function selectPartForLine(idx, partId) {
  const part = S.items.find(p => p.id === partId);
  if (!part) return;
  const item = invoiceForm.items[idx];
  if (!item) return;
  item.partNumber = part.partNumber;
  item.desc = partLineDesc(part);
  item.hsn = part.hsn || '998873';
  item.unit = part.unit || 'KG';

  const client = invoiceForm.clientId ? S.clients.find(c => c.id === invoiceForm.clientId) : null;
  if (client) {
    const rateInfo = getLineItemRate(client, invoiceForm.date, item.partNumber);
    if (rateInfo._override) {
      item.rate = rateInfo.rate;
      item._override = true;
      item._label = rateInfo._label;
    } else {
      item.rate = rateInfo.ratePerKg || 0;
      item._override = false;
      item._label = '';
    }
    recalcLineItem(item, client);
  }

  dismissAllAutocomplete();
  captureOptionalFields();
  renderCreateForm();
}


/* Commit a catalogue part into a challan line. Lifted out of the event switch
   so the inline add can reach the same code the dropdown does — two ways to
   choose a part, one place that knows what choosing one means. */
function selectChallanPartForLine(idx, partId) {
  if (!_challanForm) return;
  const part = S.items.find(p => p.id === partId);
  if (!part) return;
  const cItem = _challanForm.items[idx];
  if (!cItem) return;

  cItem.partNumber = part.partNumber;
  // Same folding as the invoice path: the gauge is what tells two rows of the
  // same clamp apart, and dropping it here carried the ambiguity into every
  // invoice raised off the challan.
  cItem.desc = partLineDesc(part);
  cItem.hsn = part.hsn || '998873';
  cItem.unit = part.unit || 'KG';

  const cClient = _challanForm.clientId ? S.clients.find(c => c.id === _challanForm.clientId) : null;
  if (cClient) {
    const cRateInfo = getLineItemRate(cClient, _challanForm.challanDate || localDateStr(), cItem.partNumber);
    cItem.rate = cRateInfo._override ? cRateInfo.rate : (cRateInfo.ratePerKg || 0);
    recalcChallanLine(cItem, cClient);
  }

  dismissAllAutocomplete();
  captureChallanFields();
  // The part is settled; weight is what gets typed next.
  _challanFocusNext = { k: 'qty-' + idx, sel: null };
  renderAddChallanForm();
}

/* ===== INLINE ITEM CREATION ===== */
/* Where to return once the item exists. Held here rather than threaded through
   the overlay because the overlay is shared with the Items tab, which has no
   line to return to. Cleared whenever that tab opens the same form, so a
   cancelled inline add can never redirect a later ordinary one. */
var _inlineItemReturn = null;

function openInlineItemAdd(kind, idx, query) {
  dismissAllAutocomplete();
  _inlineItemReturn = { kind: kind, idx: idx };
  // Prefilled from what was typed, so the operator is confirming rather than
  // retyping. Description mirrors the part number — the common shape in this
  // registry — and stays editable.
  _showItemOverlay({
    id: 0, partNumber: query, desc: query, gauge: '',
    hsn: '998873', unit: 'KG', rate: 0, stdWeightKg: null
  }, true);
}

/* Called by saveItem once the row exists. Returns true when it handled the
   return, so the Items tab refresh is skipped. */
function finishInlineItemAdd(newItem) {
  if (!_inlineItemReturn || !newItem) return false;
  const ret = _inlineItemReturn;
  _inlineItemReturn = null;
  closeOverlay();
  if (ret.kind === 'challan') selectChallanPartForLine(ret.idx, newItem.id);
  else selectPartForLine(ret.idx, newItem.id);
  return true;
}
