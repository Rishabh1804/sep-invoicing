/* ===== PART AUTOCOMPLETE (Phase 3) ===== */
function searchParts(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  const matches = [];
  for (let i = 0; i < S.items.length && matches.length < 8; i++) {
    const item = S.items[i];
    if ((item.partNumber || '').toLowerCase().includes(q) ||
        (item.desc || '').toLowerCase().includes(q)) {
      matches.push(item);
    }
  }
  return matches;
}

function showPartAutocomplete(idx, query) {
  const acEl = document.getElementById('invPartAC' + idx);
  if (!acEl) return;
  const matches = searchParts(query);
  if (matches.length === 0) {
    acEl.classList.add('inv-hidden');
    return;
  }
  acEl.classList.remove('inv-hidden');
  acEl.innerHTML = matches.map(m =>
    '<div class="inv-autocomplete-item" data-action="invSelectPart" data-idx="' + idx + '" data-part-id="' + m.id + '">' +
    '<span class="inv-autocomplete-part">' + escHtml(m.partNumber) + '</span>' +
    '<span class="inv-autocomplete-desc">' + escHtml(m.desc) + '</span></div>'
  ).join('');
}

function dismissAllAutocomplete() {
  document.querySelectorAll('.inv-autocomplete-list').forEach(el => el.classList.add('inv-hidden'));
}

function selectPartForLine(idx, partId) {
  const part = S.items.find(p => p.id === partId);
  if (!part) return;
  const item = invoiceForm.items[idx];
  if (!item) return;
  item.partNumber = part.partNumber;
  item.desc = part.desc;
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

