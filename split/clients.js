/* ===== CLIENT MASTER ===== */
function renderClientList(filter='') {
  const q = filter.toLowerCase();
  const sorted = [...S.clients].sort((a,b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const filtered = q ? sorted.filter(c => c.name.toLowerCase().includes(q) || (c.gstin||'').toLowerCase().includes(q)) : sorted;
  const el = document.getElementById('clientList');
  if (filtered.length === 0) { el.innerHTML = '<div class="inv-empty-state">No clients found</div>'; return; }
  el.innerHTML = filtered.map(c => {
    const sortedRates = (c.rates || []).slice().sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    const rateInfo = sortedRates.length > 0 ? sortedRates[0] : null;
    const rateStr = rateInfo ? '\u20B9' + rateInfo.ratePerKg + '/kg' : 'No rate';
    return '<div class="inv-client-item' + (c.isActive ? '' : ' inv-client-inactive') + '" data-action="invEditClient" data-id="' + c.id + '">' +
      '<div class="inv-client-content"><div class="inv-client-name">' + escHtml(c.name) + '</div>' +
      '<div class="inv-client-meta">' + escHtml(c.gstin || 'No GSTIN') + '</div>' +
      '<div class="inv-client-badges">' +
      '<span class="inv-client-badge inv-badge-mode">' + escHtml(c.billingMode) + '</span>' +
      '<span class="inv-client-badge inv-badge-rate">' + escHtml(rateStr) + '</span>' +
      (c.itemRates && c.itemRates.length ? '<span class="inv-override-badge">' + c.itemRates.length + ' override' + (c.itemRates.length>1?'s':'') + '</span>' : '') +
      (!c.isActive ? '<span class="inv-client-badge inv-badge-inactive">Inactive</span>' : '') +
      '</div></div>' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>';
  }).join('');
}

/* Client edit overlay */
function openClientEdit(clientId) {
  const c = S.clients.find(x => x.id === clientId);
  if (!c) return;
  const scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Edit Client</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Name</label><input class="inv-form-input" id="ceditName" value="' + escHtml(c.name) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">GSTIN</label><input class="inv-form-input inv-mono" id="ceditGstin" value="' + escHtml(c.gstin) + '" maxlength="15"></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">State</label><input class="inv-form-input" id="ceditState" value="' + escHtml(c.state) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">State Code</label><input class="inv-form-input inv-mono" id="ceditStateCode" value="' + escHtml(c.stateCode) + '" maxlength="2"></div></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Address 1</label><input class="inv-form-input" id="ceditAdd1" value="' + escHtml(c.add1) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Address 2</label><input class="inv-form-input" id="ceditAdd2" value="' + escHtml(c.add2) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Address 3</label><input class="inv-form-input" id="ceditAdd3" value="' + escHtml(c.add3) + '"></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">Billing Mode</label><select class="inv-form-select" id="ceditMode">' +
    '<option value="weight"' + (c.billingMode==='weight'?' selected':'') + '>Weight (KG)</option>' +
    '<option value="piece"' + (c.billingMode==='piece'?' selected':'') + '>Piece (Challan)</option>' +
    '<option value="nos_to_weight"' + (c.billingMode==='nos_to_weight'?' selected':'') + '>NOS to Weight</option></select></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">GST Type</label><select class="inv-form-select" id="ceditGstType">' +
    '<option value="intra"' + (c.gstType==='intra'?' selected':'') + '>Intra (CGST+SGST)</option>' +
    '<option value="inter"' + (c.gstType==='inter'?' selected':'') + '>Inter (IGST)</option></select></div></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Notes</label><textarea class="inv-form-input" id="ceditNotes" rows="2">' + escHtml(c.notes) + '</textarea></div>' +
    '<div class="inv-settings-title">Rate History</div>' +
    '<div id="ceditRates">' + (c.rates||[]).map((r,i) => '<div class="inv-rate-row"><span class="inv-mono">\u20B9' + escHtml(r.ratePerKg) + '/kg</span><span class="inv-text-muted inv-mono">' + escHtml(r.effectiveFrom) + '</span></div>').join('') + '</div>' +
    '<div class="inv-form-row inv-mb-8"><div class="inv-form-group"><label class="inv-form-label">New Rate/KG</label><input class="inv-form-input inv-mono" id="ceditNewRate" type="number" step="0.01" placeholder="14.25"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Effective From</label><input class="inv-form-input inv-mono" id="ceditNewRateDate" type="date" value="' + localDateStr() + '"></div></div>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm inv-mb-16" data-action="invAddRate" data-client="' + c.id + '">Add Rate</button>' +
    '<div class="inv-flex-between inv-mb-16"><label class="inv-checkbox-label">' +
    '<input type="checkbox" id="ceditActive"' + (c.isActive?' checked':'') + '> Active</label></div>' +
    '<div class="inv-btn-bar"><button class="inv-btn inv-btn-ghost" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invSaveClient" data-client="' + c.id + '">Save</button></div></div>';
  scrim.addEventListener('click', e => { if (e.target === scrim) { scrim.remove(); document.body.style.overflow = ''; popFocus(); } });
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

function saveClientEdit(clientId) {
  const c = S.clients.find(x => x.id === clientId);
  if (!c) return;
  c.name = document.getElementById('ceditName').value.trim();
  c.gstin = document.getElementById('ceditGstin').value.trim().toUpperCase();
  c.state = document.getElementById('ceditState').value.trim();
  c.stateCode = document.getElementById('ceditStateCode').value.trim();
  c.add1 = document.getElementById('ceditAdd1').value.trim();
  c.add2 = document.getElementById('ceditAdd2').value.trim();
  c.add3 = document.getElementById('ceditAdd3').value.trim();
  c.billingMode = document.getElementById('ceditMode').value;
  c.gstType = document.getElementById('ceditGstType').value;
  c.notes = document.getElementById('ceditNotes').value.trim();
  c.isActive = document.getElementById('ceditActive').checked;
  saveState();
  closeOverlay();
  renderClientList(document.getElementById('clientSearch').value);
  showToast('Client saved');
}

function addClientRate(clientId) {
  const c = S.clients.find(x => x.id === clientId);
  if (!c) return;
  const rate = parseFloat(document.getElementById('ceditNewRate').value);
  const date = document.getElementById('ceditNewRateDate').value;
  if (isNaN(rate) || !date) { showToast('Enter rate and date','error'); return; }
  if (!c.rates) c.rates = [];
  c.rates.push({ratePerKg: rate, ratePerPiece: null, effectiveFrom: date});
  saveState();
  showToast('Rate added');
  closeOverlay();
  openClientEdit(clientId);
}

function closeOverlay() {
  var count = document.querySelectorAll('.inv-overlay-scrim').length;
  document.querySelectorAll('.inv-overlay-scrim').forEach(s => s.remove());
  document.body.style.overflow = '';
  // Pop focus stack for each closed overlay
  for (var i = 0; i < count; i++) popFocus();
}

function closeTopOverlay() {
  const all = document.querySelectorAll('.inv-overlay-scrim');
  if (all.length > 0) {
    all[all.length - 1].remove();
    if (document.querySelectorAll('.inv-overlay-scrim').length === 0) {
      document.body.style.overflow = '';
    }
    popFocus();
  }
}

