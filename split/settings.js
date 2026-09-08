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

    '<div class="inv-settings-section"><div class="inv-settings-title">Credit Note Series</div>' +
    '<div class="inv-text-muted inv-prefix-preview">Preview: ' + escHtml(cnDisplayNumber(S.cnNextNum || 1)) + '</div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Next Number</label><input type="number" min="1" class="inv-form-input inv-mono" id="setCnNextNum" value="' + (S.cnNextNum || 1) + '"></div>' +
    '<div class="inv-text-muted inv-storage-text">Credit notes run their own series, formatted off the invoice prefix\u2019s financial year. Notes raised before the app existed are not in here, so set this to the number after the last one issued by hand &mdash; the series must not restart.</div></div>' +

    '<div class="inv-settings-section"><div class="inv-settings-title">Cost of Goods</div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Default cost per KG (&#8377;)</label>' +
    '<input type="number" step="0.01" class="inv-form-input inv-mono" id="setDefaultCost" value="' + (S.defaultCostPerKg || 8.55) + '"></div>' +
    '<div class="inv-text-muted inv-storage-text">Full cost, not just materials. Everything in Stats measures against it &mdash; realisation, margin, and which clients are priced below cost. The Apr&ndash;Jul 2026 rebuild put it at &#8377;8.55/kg.</div></div>' +

    '<div class="inv-settings-section"><div class="inv-settings-title">Labour</div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">OT multiplier</label>' +
    '<input type="number" step="0.01" min="1" class="inv-form-input inv-mono" id="setOtMult" value="' + ((S.labour && S.labour.otMult) != null ? S.labour.otMult : 1.1) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Extra-hour rate (&#8377;/h)</label>' +
    '<input type="number" step="0.01" min="0" class="inv-form-input inv-mono" id="setExtraRate" value="' + ((S.labour && S.labour.extraRate) || 0) + '"></div></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">Daily rest credit at (days/week)</label>' +
    '<input type="number" step="1" min="0" max="7" class="inv-form-input inv-mono" id="setRestMin" value="' + ((S.labour && S.labour.restCreditMinDays) != null ? S.labour.restCreditMinDays : 6) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Extra per missing hand (h)</label>' +
    '<input type="number" step="0.5" min="0" class="inv-form-input inv-mono" id="setExtraPerHead" value="' + ((S.labour && S.labour.extraHoursPerHead) != null ? S.labour.extraHoursPerHead : 8) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Modelled labour (&#8377;/kg)</label>' +
    '<input type="number" step="0.01" min="0" class="inv-form-input inv-mono" id="setLabModel" value="' + ((S.labour && S.labour.modelPerKg) || 0) + '"></div></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">Rest gate &mdash; full at (%)</label>' +
    '<input type="number" step="1" min="0" max="100" class="inv-form-input inv-mono" id="setGateFull" value="' + Math.round(((S.labour && S.labour.gateFull) != null ? S.labour.gateFull : 0.9) * 100) + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Rest gate &mdash; half at (%)</label>' +
    '<input type="number" step="1" min="0" max="100" class="inv-form-input inv-mono" id="setGateHalf" value="' + Math.round(((S.labour && S.labour.gateHalf) != null ? S.labour.gateHalf : 0.8) * 100) + '"></div></div>' +
    '<div class="inv-text-muted inv-storage-text">The wage arithmetic behind the Staff tab, and it differs by tier. <strong>Monthly</strong>: day rate &times; days worked, plus the range&#8217;s rest days scaled by the attendance gate above (at or over the first figure pays them all, at or over the second pays half, below pays none), plus OT at day rate &divide; 8 &times; this multiplier. <strong>Hourly</strong>: every hour at one flat rate &mdash; no day rate, no multiplier. <strong>Daily</strong>: day rate &times; days, OT at the multiplier, with its own weekly rest credit. The extra-hour rate prices the area-booked hours; <strong>extra per missing hand</strong> is how many are booked to an area for each hand short of its complement, which is what the Areas view checks the booked hours against. The modelled &#8377;/kg is what the measured figure is reported against &mdash; the Apr&ndash;Jul 2026 rebuild put labour at &#8377;3.55 of an &#8377;8.55 cost.</div></div>' +

    '<div class="inv-settings-section"><div class="inv-settings-title">Zinc Rate</div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label">Market rate (&#8377;/kg)</label>' +
    '<input type="number" step="0.01" class="inv-form-input inv-mono" id="setZincRate" value="' + (getZinc().ratePerKg == null ? '' : getZinc().ratePerKg) + '" placeholder="400.00"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">Supplier premium (&#8377;/kg)</label>' +
    '<input type="number" step="0.01" class="inv-form-input inv-mono" id="setZincPremium" value="' + (getZinc().premiumPerKg || 0) + '"></div></div>' +
    '<div class="inv-form-group"><label class="inv-form-label">LME &rarr; MCX uplift (%)</label>' +
    '<input type="number" step="0.1" min="0" class="inv-form-input inv-mono" id="setZincUplift" value="' + getZinc().upliftPct + '"></div>' +
    '<div class="inv-text-muted inv-storage-text inv-mb-8">metals.dev publishes no MCX base metal, so a fetched rate is LME and is uplifted by this to estimate MCX. Recalibrate it whenever you see a real MCX quote: uplift = (MCX &divide; LME &minus; 1) &times; 100. A rate typed above is taken as MCX already and is not uplifted.</div>' +
    '<div class="inv-form-group"><label class="inv-form-label">metals.dev API Key</label>' +
    '<div class="inv-api-key-wrap"><input class="inv-form-input inv-mono" id="setMetalsKey" type="password" value="' + escHtml(getMetalsKey()) + '" placeholder="Paste key" autocomplete="off">' +
    '<button class="inv-api-key-toggle" data-action="invToggleMetalsKey" type="button">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>' +
    '<div class="inv-text-muted inv-storage-text">Free tier at metals.dev covers a daily refresh. Key stays on device and is never included in an export. Leave blank to keep entering the rate by hand.</div></div></div>' +

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

    renderGhSyncSettings() +

    '<div class="inv-settings-section"><div class="inv-settings-title">Data</div>' +
    '<div class="inv-form-row"><button class="inv-btn inv-btn-ghost inv-btn-block" data-action="invExportData">Export JSON</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-block" data-action="invImportData">Import JSON</button></div>' +
    '<input type="file" id="importFileInput" accept=".json" class="inv-hidden">' +
    '<div class="inv-storage-wrap"><div class="inv-text-muted inv-storage-text">Storage: ' + estimateStorage() + ' in memory &middot; ' + renderDiskSummary() + '</div>' +
    '<div class="inv-text-muted inv-storage-text">Last save: <span class="inv-save-status">' + renderLastSave() + '</span></div>' +
    '<div class="inv-text-muted inv-storage-text">Build <span class="inv-build-id">' + escHtml(APP_BUILD) + '</span> &middot; ' +
    '<button type="button" class="inv-link-btn" data-action="invCheckUpdate">Check for a newer version</button> &middot; ' +
    '<button type="button" class="inv-link-btn" data-action="invRunDiagnostics">Run storage diagnostics</button></div>' +
    '<div id="storageDiagOut"></div></div></div>' +

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
  var cnNextEl = document.getElementById('setCnNextNum');
  if (cnNextEl) {
    var cnNext = parseInt(cnNextEl.value, 10);
    // Never below a number already issued from the app: a credit note number
    // the customer holds may not be handed out twice.
    var issued = (S.creditNotes || []).reduce(function(mx, c) {
      var n = parseInt(c.cnNumber, 10);
      return isNaN(n) ? mx : Math.max(mx, n);
    }, 0);
    if (!isNaN(cnNext) && cnNext > 0) {
      if (cnNext <= issued) {
        showToast('Next credit note must be above ' + cnPadNum(issued) + ' — that one is issued', 'error');
      } else {
        S.cnNextNum = cnNext;
      }
    }
  }
  var costEl = document.getElementById('setDefaultCost');
  if (costEl) { var parsedCost = parseFloat(costEl.value); if (!isNaN(parsedCost) && parsedCost > 0) S.defaultCostPerKg = parsedCost; }
  if (!S.labour) S.labour = {};
  var otMultEl = document.getElementById('setOtMult');
  if (otMultEl) { var pm = parseFloat(otMultEl.value); if (!isNaN(pm) && pm >= 0) S.labour.otMult = pm; }
  var extraRateEl = document.getElementById('setExtraRate');
  if (extraRateEl) { var pe = parseFloat(extraRateEl.value); if (!isNaN(pe) && pe >= 0) S.labour.extraRate = pe; }
  var restMinEl = document.getElementById('setRestMin');
  if (restMinEl) { var pr = parseInt(restMinEl.value, 10); if (!isNaN(pr) && pr >= 0) S.labour.restCreditMinDays = pr; }
  var labModelEl = document.getElementById('setLabModel');
  if (labModelEl) { var pl = parseFloat(labModelEl.value); if (!isNaN(pl) && pl >= 0) S.labour.modelPerKg = pl; }
  var extraHeadEl = document.getElementById('setExtraPerHead');
  if (extraHeadEl) { var ph = parseFloat(extraHeadEl.value); if (!isNaN(ph) && ph >= 0) S.labour.extraHoursPerHead = ph; }
  var gateFullEl = document.getElementById('setGateFull');
  if (gateFullEl) { var gf = parseFloat(gateFullEl.value); if (!isNaN(gf) && gf >= 0 && gf <= 100) S.labour.gateFull = gf / 100; }
  var gateHalfEl = document.getElementById('setGateHalf');
  if (gateHalfEl) { var gh = parseFloat(gateHalfEl.value); if (!isNaN(gh) && gh >= 0 && gh <= 100) S.labour.gateHalf = gh / 100; }
  // A half threshold above the full one would make the middle band unreachable
  // and the gate silently binary. Swap rather than refuse: the intent is plain.
  if (S.labour.gateHalf > S.labour.gateFull) {
    var swap = S.labour.gateHalf; S.labour.gateHalf = S.labour.gateFull; S.labour.gateFull = swap;
  }
  var apiKeyEl = document.getElementById('setApiKey');
  if (apiKeyEl) setApiKey(apiKeyEl.value.trim());
  var metalsKeyEl = document.getElementById('setMetalsKey');
  if (metalsKeyEl) setMetalsKey(metalsKeyEl.value.trim());

  var z = getZinc();
  var zRateEl = document.getElementById('setZincRate');
  if (zRateEl) {
    var raw = zRateEl.value.trim();
    if (raw === '') {
      z.ratePerKg = null;
      z.updatedAt = null;
      z.source = '';
    } else {
      var parsedZinc = parseFloat(raw);
      // Only stamp the date when the figure actually moved, so an unrelated
      // settings save cannot make a stale rate look freshly checked.
      if (!isNaN(parsedZinc) && parsedZinc > 0 && parsedZinc !== z.ratePerKg) {
        z.ratePerKg = gstRound(parsedZinc);
        z.updatedAt = Date.now();
        z.source = 'manual';
        // A figure typed here is the MCX rate itself, so it must not also be
        // uplifted — that would compound an estimate onto a known number.
        z.basis = 'manual';
      }
    }
  }
  var zPremEl = document.getElementById('setZincPremium');
  if (zPremEl) {
    var parsedPrem = parseFloat(zPremEl.value);
    if (!isNaN(parsedPrem) && parsedPrem >= 0) z.premiumPerKg = gstRound(parsedPrem);
  }
  var zUpliftEl = document.getElementById('setZincUplift');
  if (zUpliftEl) {
    var parsedUplift = parseFloat(zUpliftEl.value);
    if (!isNaN(parsedUplift) && parsedUplift >= 0) z.upliftPct = parsedUplift;
  }

  saveGhSyncSettings();

  saveState();
  closeOverlay();
  renderZincCard();
  ghRenderCard();
  showToast('Settings saved');
}

/* ===== STORAGE DIAGNOSTICS =====
   The questions a lost import raises, answered from the device itself rather
   than guessed at from a laptop: what is on disk right now, when was it
   written, did the last save land, and how much more will this browser take.
   The report is plain text so it can be pasted into a message as-is. */
function readDiskState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return { chars: 0, raw: null };
    return { chars: raw.length, raw: raw };
  } catch (e) { return { chars: -1, error: describeStorageError(e) }; }
}

function renderDiskSummary() {
  var d = readDiskState();
  if (d.chars < 0) return 'on disk: unreadable (' + escHtml(d.error) + ')';
  if (d.chars === 0) return 'on disk: nothing';
  var mem = 0;
  try { mem = JSON.stringify(S).length; } catch (e) {}
  return 'on disk: ' + fmtChars(d.chars) + (mem && mem !== d.chars ? ' (differs from memory)' : ' (matches memory)');
}

function renderLastSave() {
  var h = _storageHealth;
  if (h.lastSaveOk === null) return 'nothing saved since this page opened';
  var when = new Date(h.lastSaveAt).toLocaleTimeString();
  if (h.lastSaveOk) return 'ok at ' + when + ', ' + fmtChars(h.lastSaveChars);
  return 'FAILED at ' + when + ' \u2014 ' + escHtml(h.lastError);
}

function fmtChars(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(2) + 'M chars';
  return Math.round(n / 1024) + 'K chars';
}

// The newest thing a copy of the state knows about: the latest invoice date
// and the latest record timestamp. "It reset to 12 Aug" becomes a figure.
function newestIn(state) {
  var out = { invoiceDate: '', recordedAt: 0, invoices: 0, challans: 0 };
  if (!state) return out;
  (state.invoices || []).forEach(function(inv) {
    out.invoices++;
    if (inv.date && inv.date > out.invoiceDate) out.invoiceDate = inv.date;
    if (inv.createdAt > out.recordedAt) out.recordedAt = inv.createdAt;
  });
  (state.incomingMaterial || []).forEach(function(im) {
    out.challans++;
    if (im.createdAt > out.recordedAt) out.recordedAt = im.createdAt;
  });
  return out;
}

// How much MORE the browser will store alongside the current state. Each
// probe is written to a scratch key, read back, and removed. The answer is
// headroom rather than the browser's absolute ceiling, which is the figure
// that decides whether the next save will land.
function probeStorageHeadroom() {
  var sizes = [131072, 262144, 524288, 1048576, 2097152, 4194304];
  var key = 'sep_inv_probe';
  var maxOk = 0, failedAt = 0, error = '';
  for (var i = 0; i < sizes.length; i++) {
    var val = new Array(sizes[i] + 1).join('x');
    try {
      localStorage.setItem(key, val);
      var back = localStorage.getItem(key);
      if (!back || back.length !== val.length) { failedAt = sizes[i]; error = 'write not persisted'; break; }
      maxOk = sizes[i];
    } catch (e) { failedAt = sizes[i]; error = describeStorageError(e); break; }
  }
  try { localStorage.removeItem(key); } catch (e) {}
  return { maxOk: maxOk, failedAt: failedAt, error: error };
}

function buildDiagnosticsReport() {
  var lines = [];
  var disk = readDiskState();
  var memNewest = newestIn(S);
  var diskNewest = null, diskParseError = '';
  if (disk.raw) {
    try { diskNewest = newestIn(JSON.parse(disk.raw)); } catch (e) { diskParseError = describeStorageError(e); }
  }
  var standalone = false;
  try { standalone = window.matchMedia('(display-mode: standalone)').matches; } catch (e) {}
  var swState = 'unsupported';
  if ('serviceWorker' in navigator) swState = navigator.serviceWorker.controller ? 'controlling' : 'none';
  var probe = probeStorageHeadroom();
  var mem = 0;
  try { mem = JSON.stringify(S).length; } catch (e) {}

  lines.push('SEP Invoicing storage diagnostics');
  lines.push('Build: ' + APP_BUILD);
  lines.push('Time: ' + new Date().toString());
  lines.push('Browser: ' + navigator.userAgent);
  lines.push('Display: ' + (standalone ? 'installed app' : 'browser tab') + ' · worker ' + swState);
  lines.push('URL: ' + location.href);
  lines.push('');
  lines.push('In memory: ' + fmtChars(mem) + ' · ' + memNewest.invoices + ' invoices, ' + memNewest.challans + ' challans');
  lines.push('  newest invoice date ' + (memNewest.invoiceDate || 'none') + ', last record ' + (memNewest.recordedAt ? new Date(memNewest.recordedAt).toISOString() : 'none'));
  if (disk.chars < 0) lines.push('On disk: UNREADABLE (' + disk.error + ')');
  else if (disk.chars === 0) lines.push('On disk: nothing stored');
  else {
    lines.push('On disk: ' + fmtChars(disk.chars) + (disk.chars === mem ? ' · matches memory' : ' · DIFFERS from memory'));
    if (diskNewest) lines.push('  newest invoice date ' + (diskNewest.invoiceDate || 'none') + ', last record ' + (diskNewest.recordedAt ? new Date(diskNewest.recordedAt).toISOString() : 'none') + ' · ' + diskNewest.invoices + ' invoices, ' + diskNewest.challans + ' challans');
    if (diskParseError) lines.push('  stored copy does not parse: ' + diskParseError);
  }
  lines.push('Last save: ' + renderLastSave().replace(/<[^>]+>/g, ''));
  if (_storageHealth.readError) lines.push('Read error at load: ' + _storageHealth.readError);
  lines.push('Headroom: accepted an extra ' + fmtChars(probe.maxOk) + (probe.failedAt ? ', refused ' + fmtChars(probe.failedAt) + ' (' + probe.error + ')' : ', every probe accepted'));
  return lines.join('\n');
}

function runStorageDiagnostics() {
  var out = document.getElementById('storageDiagOut');
  var report = buildDiagnosticsReport();
  if (out) {
    out.innerHTML = '<pre class="inv-diag-report">' + escHtml(report) + '</pre>' +
      '<div class="inv-text-muted inv-storage-text">Copied to the clipboard where the browser allows it; otherwise select the text above.</div>';
  }
  var status = document.querySelector('.inv-save-status');
  if (status) status.innerHTML = renderLastSave();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(report).then(function() { showToast('Diagnostics copied'); }, function() {});
    }
  } catch (e) {}
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
        // This path carried NO repairs at all, which was the sharper half of
        // the same bug: a backup written before `staff` existed left it
        // undefined and the Staff tab threw the moment it was opened.
        // All-or-nothing: a migration that throws restores what was here.
        adoptState(data);
        // The success toast used to fire regardless, on top of — and therefore
        // instead of — the storage failure toast. A copy that only reached
        // memory is not imported, and the operator has to hear that.
        var saved = saveState();
        closeOverlay();
        renderHome();
        if (saved) showToast('Data imported');
        else showToast('NOT saved: the browser refused to store it (' + _storageHealth.lastError + '). The data is in memory only and will be lost on reload.', 'error');
      } catch(err) {
        showToast('Invalid file: ' + err.message, 'error');
      }
    };
    reader.readAsText(f);
  };
  inp.click();
}

