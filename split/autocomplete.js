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

/* Render the suggestion rows for one part input. Shared by the invoice form
   and the challan form, which differ only in the action and element ids. */
function renderPartOptions(acEl, matches, action, idx, idPrefix) {
  // The gauge is shown as its own badge: several clamp part numbers exist in
  // more than one gauge, and it is the only thing telling those rows apart.
  acEl.innerHTML = matches.map((m, i) =>
    '<div class="inv-autocomplete-item" role="option" id="' + idPrefix + idx + '_' + i + '"' +
    ' data-action="' + action + '" data-idx="' + idx + '" data-part-id="' + m.id + '">' +
    '<span class="inv-autocomplete-part">' + escHtml(m.partNumber) + '</span>' +
    (m.gauge ? '<span class="inv-gauge-badge">' + escHtml(m.gauge) + '</span>' : '') +
    '<span class="inv-autocomplete-desc">' + escHtml(m.desc || '') + '</span></div>'
  ).join('');
}

function showPartAutocomplete(idx, query) {
  const acEl = document.getElementById('invPartAC' + idx);
  if (!acEl) return;
  const input = document.querySelector('[data-action="invEditLinePart"][data-idx="' + idx + '"]');
  const matches = searchParts(query);
  acReset();
  if (matches.length === 0) {
    acEl.classList.add('inv-hidden');
    if (input) input.setAttribute('aria-expanded', 'false');
    return;
  }
  acEl.classList.remove('inv-hidden');
  renderPartOptions(acEl, matches, 'invSelectPart', idx, 'invPartOpt');
  if (input) input.setAttribute('aria-expanded', 'true');
}

/* Same, for the IM challan form. */
function showChallanPartAutocomplete(idx, query) {
  const acEl = document.getElementById('imPartAC' + idx);
  if (!acEl) return;
  const input = document.querySelector('[data-action="invEditChallanPart"][data-idx="' + idx + '"]');
  const matches = searchParts(query);
  acReset();
  if (matches.length === 0) {
    acEl.classList.add('inv-hidden');
    if (input) input.setAttribute('aria-expanded', 'false');
    return;
  }
  acEl.classList.remove('inv-hidden');
  renderPartOptions(acEl, matches, 'invSelectChallanPart', idx, 'imPartOpt');
  if (input) input.setAttribute('aria-expanded', 'true');
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
  return opts.length === 1 ? opts[0] : null;
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

