/* ===== SETTINGS ===== */
function openSettings() {
  const scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.id = 'settingsScrim';
  scrim.innerHTML = '<div class="inv-overlay-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Settings</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div>' +

    '<div class="inv-settings-section"><div class="inv-settings-title">Company</div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Name</label><input class="inv-form-input" id="setCompName" value="' + escHtml(S.company.name) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">GSTIN</label><input class="inv-form-input inv-mono" id="setCompGstin" value="' + escHtml(S.company.gstin) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Address 1</label><input class="inv-form-input" id="setCompAdd1" value="' + escHtml(S.company.add1) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Address 2</label><input class="inv-form-input" id="setCompAdd2" value="' + escHtml(S.company.add2) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Phone</label><input class="inv-form-input" id="setCompPhone" value="' + escHtml(S.company.phone) + '"></div></div>' +

    '<div class="inv-settings-section"><div class="inv-settings-title">Bank Details</div>' +
    '<div class="inv-form-group"><textarea class="inv-form-input" id="setBank" rows="3">' + escHtml(S.bankDetails) + '</textarea></div></div>' +

    '<div class="inv-settings-section"><div class="inv-settings-title">Invoice Series</div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Prefix</label><input class="inv-form-input inv-mono" id="setPrefix" value="' + escHtml(S.invPrefix) + '"></div>' +
    '<div class="inv-text-muted inv-prefix-preview">Preview: ' + escHtml(S.invPrefix) + String(S.invNextNum).padStart(5,'0') + '</div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Next Number</label><input type="number" class="inv-form-input inv-mono" id="setNextNum" value="' + S.invNextNum + '"></div></div>' +

    '<div class="inv-settings-section"><div class="inv-settings-title">Cost of Goods</div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Default cost per KG (&#8377;)</label>' +
    '<input type="number" step="0.01" class="inv-form-input inv-mono" id="setDefaultCost" value="' + (S.defaultCostPerKg || 5.46) + '"></div>' +
    '<div class="inv-text-muted inv-storage-text">Used by margin dashboard to compute per-item profitability.</div></div>' +

    '<div class="inv-settings-section"><div class="inv-settings-title">Part Weights (NOS to KG)</div>' +
    '<div id="setPWList">' + renderPartWeightsList() + '</div>' +
    '<div class="inv-form-row inv-mb-8"><div class="inv-form-group"><label class="inv-form-label">Part Number</label><input class="inv-form-input inv-mono" id="setPWPart" placeholder="HINGE PIN"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Weight (KG)</label><input type="number" class="inv-form-input inv-mono" id="setPWWeight" step="0.001" placeholder="0.045"></div></div>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAddPartWeight">Add Weight</button></div>' +

    '<div class="inv-settings-section"><div class="inv-settings-title">Challan Scanner (AI)</div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Google Gemini API Key</label>' +
    '<div class="inv-api-key-wrap"><input class="inv-form-input inv-mono" id="setApiKey" type="password" value="' + escHtml(getApiKey()) + '" placeholder="AIza..." autocomplete="off">' +
    '<button class="inv-api-key-toggle" data-action="invToggleApiKey" type="button">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>' +
    '<div class="inv-text-muted inv-storage-text">Free from aistudio.google.com (Google account only, no card). Key stays on device.</div></div></div>' +

    '<div class="inv-settings-section"><div class="inv-settings-title">Data</div>' +
    '<div class="inv-form-row"><button class="inv-btn inv-btn-ghost inv-btn-block" data-action="invExportData">Export JSON</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-block" data-action="invImportData">Import JSON</button></div>' +
    '<input type="file" id="importFileInput" accept=".json" class="inv-hidden">' +
    '<div class="inv-storage-wrap"><div class="inv-text-muted inv-storage-text">Storage: ' + estimateStorage() + '</div></div></div>' +

    '<div class="inv-btn-bar"><button class="inv-btn inv-btn-ghost" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invSaveSettings">Save</button></div></div>';
  scrim.addEventListener('click', e => { if (e.target === scrim) { scrim.remove(); document.body.style.overflow = ''; popFocus(); } });
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

function saveSettings() {
  S.company.name = document.getElementById('setCompName').value.trim();
  S.company.gstin = document.getElementById('setCompGstin').value.trim();
  S.company.add1 = document.getElementById('setCompAdd1').value.trim();
  S.company.add2 = document.getElementById('setCompAdd2').value.trim();
  S.company.phone = document.getElementById('setCompPhone').value.trim();
  S.bankDetails = document.getElementById('setBank').value.trim();
  S.invPrefix = document.getElementById('setPrefix').value.trim();
  S.invNextNum = parseInt(document.getElementById('setNextNum').value) || S.invNextNum;
  var costEl = document.getElementById('setDefaultCost');
  if (costEl) { var parsedCost = parseFloat(costEl.value); if (!isNaN(parsedCost) && parsedCost > 0) S.defaultCostPerKg = parsedCost; }
  var apiKeyEl = document.getElementById('setApiKey');
  if (apiKeyEl) setApiKey(apiKeyEl.value.trim());
  saveState();
  closeOverlay();
  showToast('Settings saved');
}

function estimateStorage() {
  try {
    const s = JSON.stringify(S).length;
    if (s > 1048576) return (s / 1048576).toFixed(1) + ' MB';
    return (s / 1024).toFixed(0) + ' KB';
  } catch(e) { return 'Unknown'; }
}

function renderPartWeightsList() {
  const entries = Object.entries(S.partWeights || {});
  if (entries.length === 0) return '<div class="inv-text-muted inv-storage-text">No part weights defined yet</div>';
  return entries.map(([part, wt]) =>
    '<div class="inv-rate-row"><span class="inv-mono">' + escHtml(part) + '</span>' +
    '<span class="inv-flex-between"><span class="inv-mono inv-text-cost">' + escHtml(wt) + ' kg</span>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invDeletePartWeight" data-part="' + escHtml(part) + '">&times;</button></span></div>'
  ).join('');
}

function addPartWeight() {
  const partEl = document.getElementById('setPWPart');
  const wtEl = document.getElementById('setPWWeight');
  if (!partEl || !wtEl) return;
  const part = partEl.value.trim().toUpperCase();
  const wt = parseFloat(wtEl.value);
  if (!part || isNaN(wt) || wt <= 0) { showToast('Enter part name and weight', 'error'); return; }
  S.partWeights[part] = wt;
  saveState();
  const list = document.getElementById('setPWList');
  if (list) list.innerHTML = renderPartWeightsList();
  partEl.value = '';
  wtEl.value = '';
  showToast('Weight added: ' + part + ' = ' + wt + ' kg');
}

function deletePartWeight(part) {
  if (!confirm('Delete weight for ' + part + '?')) return;
  delete S.partWeights[part];
  saveState();
  const list = document.getElementById('setPWList');
  if (list) list.innerHTML = renderPartWeightsList();
  showToast('Weight removed');
}

function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sep-invoicing-backup-' + localDateStr() + '.json';
  a.click();
  showToast('Data exported');
}

function importData() {
  const inp = document.getElementById('importFileInput');
  inp.onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.company || !data.clients) throw new Error('Invalid format');
        if (!confirm('Import will replace ALL current data. Continue?')) return;
        S = data;
        saveState();
        closeOverlay();
        renderHome();
        showToast('Data imported');
      } catch(err) {
        showToast('Invalid file: ' + err.message, 'error');
      }
    };
    reader.readAsText(f);
  };
  inp.click();
}

