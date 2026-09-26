/* ===== SETTINGS =====
   Six groups, and every section folds to one line that says what it is set to,
   so the whole of Settings reads at a glance and only the section being changed
   is open. Each section saves on its own: a Save that wrote every field on the
   sheet meant an edit to the bank details could carry a half-typed labour
   figure with it. A section with an unsaved edit is marked, on its own line and
   on its group, and closing Settings with one asks first.

   Phone: the groups stacked, each under its header. Desktop: the groups down
   the left and one group at a time on the right. Which group and which sections
   were open is remembered on the device, never on S. */

var SETTINGS_UI_KEY = 'sep_inv_settings_ui';

var SETTINGS_GROUPS = [
  { key: 'business', label: 'Business', secs: ['company', 'bank', 'invoice', 'cn'] },
  { key: 'checks', label: 'Checks & alerts', secs: ['rateCheck', 'stockAlerts', 'todo'] },
  { key: 'costing', label: 'Costing', secs: ['fullCost', 'fallbacks', 'zinc'] },
  { key: 'labour', label: 'Labour', secs: ['overtime', 'rest', 'extra', 'labModel'] },
  { key: 'connections', label: 'Connections', secs: ['metalsKey', 'geminiKey', 'sync'] },
  { key: 'data', label: 'Data & device', secs: ['appearance', 'data'] }
];

function _setUi() {
  var u = {};
  try { u = JSON.parse(localStorage.getItem(SETTINGS_UI_KEY) || '{}') || {}; } catch (e) { /* per-device only */ }
  var group = SETTINGS_GROUPS.some(function(g) { return g.key === u.group; }) ? u.group : 'business';
  return { group: group, open: Array.isArray(u.open) ? u.open : [] };
}
function _setUiSave(u) {
  try { localStorage.setItem(SETTINGS_UI_KEY, JSON.stringify(u)); } catch (e) { /* per-device only */ }
}
function _settingsGroupOf(sec) {
  var g = SETTINGS_GROUPS.find(function(x) { return x.secs.indexOf(sec) >= 0; });
  return g ? g.key : null;
}

/* ---- field helpers ---- */
function _sfg(label, id, input) {
  return '<div class="inv-form-group"><label class="inv-form-label" for="' + id + '">' + label + '</label>' + input + '</div>';
}
function _sNum(id, value, step, min, max) {
  return '<input type="number" step="' + step + '"' + (min != null ? ' min="' + min + '"' : '') + (max != null ? ' max="' + max + '"' : '') +
    ' class="inv-form-input inv-mono" id="' + id + '" value="' + escHtml(value == null ? '' : value) + '">';
}
function _sRow() { return '<div class="inv-form-row">' + Array.prototype.join.call(arguments, '') + '</div>'; }
var _EYE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
function _sKey(id, value, placeholder, action) {
  return '<div class="inv-api-key-wrap"><input class="inv-form-input inv-mono" id="' + id + '" type="password" value="' + escHtml(value) +
    '" placeholder="' + placeholder + '" autocomplete="off"><button class="inv-api-key-toggle" data-action="' + action + '" type="button" aria-label="Show key">' + _EYE_SVG + '</button></div>';
}
function _sVal(id) { var el = document.getElementById(id); return el ? el.value : null; }
function _sPos(id) { var v = parseFloat(_sVal(id)); return !isNaN(v) && v > 0 ? v : null; }
function _sNonNeg(id) { var v = parseFloat(_sVal(id)); return !isNaN(v) && v >= 0 ? v : null; }
function _sLab(k, dflt) { return (S.labour && S.labour[k]) != null ? S.labour[k] : dflt; }
function _sRs(v) { return '&#8377;' + escHtml(formatNum(v, 2)); }

/* ---- the sections ----
   summary() returns HTML (escaped); save() returns false to leave the section
   unsaved, anything else counts as saved. */
var SETTINGS_SECS = {
  company: {
    title: 'Company',
    summary: function() { return escHtml(S.company.name || 'Not set') + (S.company.gstin ? ' &middot; <span class="inv-mono">' + escHtml(S.company.gstin) + '</span>' : ''); },
    body: function() {
      return _sfg('Name', 'setCompName', '<input class="inv-form-input" id="setCompName" value="' + escHtml(S.company.name) + '">') +
        _sfg('GSTIN', 'setCompGstin', '<input class="inv-form-input inv-mono" id="setCompGstin" value="' + escHtml(S.company.gstin) + '">') +
        _sfg('Address 1', 'setCompAdd1', '<input class="inv-form-input" id="setCompAdd1" value="' + escHtml(S.company.add1) + '">') +
        _sfg('Address 2', 'setCompAdd2', '<input class="inv-form-input" id="setCompAdd2" value="' + escHtml(S.company.add2) + '">') +
        _sfg('Phone', 'setCompPhone', '<input class="inv-form-input" id="setCompPhone" value="' + escHtml(S.company.phone) + '">');
    },
    why: 'Printed on the tax invoice, the credit note and the test certificate. All three read it from here, so they can never disagree about who issued them.',
    save: function() {
      ['Name', 'Gstin', 'Add1', 'Add2', 'Phone'].forEach(function(f) {
        S.company[f.charAt(0).toLowerCase() + f.slice(1)] = _sVal('setComp' + f).trim();
      });
    }
  },
  bank: {
    title: 'Bank details',
    summary: function() { var l = (S.bankDetails || '').split('\n')[0].trim(); return l ? escHtml(l) : 'Not set'; },
    body: function() { return _sfg('Printed on the invoice', 'setBank', '<textarea class="inv-form-input" id="setBank" rows="3">' + escHtml(S.bankDetails) + '</textarea>'); },
    save: function() { S.bankDetails = _sVal('setBank').trim(); }
  },
  invoice: {
    title: 'Invoice series',
    summary: function() { return 'next <span class="inv-mono">' + escHtml(S.invPrefix + String(S.invNextNum).padStart(5, '0')) + '</span>'; },
    body: function() {
      return _sRow(_sfg('Prefix', 'setPrefix', '<input class="inv-form-input inv-mono" id="setPrefix" value="' + escHtml(S.invPrefix) + '">'),
        _sfg('Next number', 'setNextNum', _sNum('setNextNum', S.invNextNum, 1, 1)));
    },
    save: function() {
      var prefix = _sVal('setPrefix').trim(), next = parseInt(_sVal('setNextNum'), 10);
      if (isNaN(next) || next < 1) { showToast('Enter the next invoice number', 'error'); return false; }
      // Never back over a number the customer holds under this prefix: an
      // issued invoice, or a deleted one whose number was spent. A new
      // financial year's prefix has none, so it may start again at 1.
      // Below the highest issued is a reissue: allowed only onto a free number
      // whose invoice was never in a filed return, and said so first. The one
      // invoice after it takes that number; the series then carries on.
      var used = invHighestIssued(prefix);
      if (next <= used) {
        var chk = invReissueCheck(prefix, next);
        if (!chk.ok) { showToast(chk.why, 'error'); return false; }
        if (!confirm('The next invoice will be issued as ' + chk.disp + ', a number used before. After it the series carries on from ' +
          prefix + padInvNum(used + 1) + '. (Delete → "Delete and reissue" does this in one step.) Continue?')) return false;
      }
      S.invPrefix = prefix;
      S.invNextNum = next;
    }
  },
  cn: {
    title: 'Credit note series',
    summary: function() { return 'next <span class="inv-mono">' + escHtml(cnDisplayNumber(S.cnNextNum || 1)) + '</span>'; },
    body: function() { return _sfg('Next number', 'setCnNextNum', _sNum('setCnNextNum', S.cnNextNum || 1, 1, 1)); },
    why: 'Credit notes run their own series, formatted off the invoice prefix’s financial year. Notes raised before the app existed are not in here, so set this to the number after the last one issued by hand &mdash; the series must not restart.',
    save: function() {
      var cnNext = parseInt(_sVal('setCnNextNum'), 10);
      // Never below a number already issued from the app: a credit note number
      // the customer holds may not be handed out twice.
      var issued = (S.creditNotes || []).reduce(function(mx, c) {
        var n = parseInt(c.cnNumber, 10);
        return isNaN(n) ? mx : Math.max(mx, n);
      }, 0);
      if (isNaN(cnNext) || cnNext < 1) { showToast('Enter the next credit note number', 'error'); return false; }
      if (cnNext <= issued) { showToast('Next credit note must be above ' + cnPadNum(issued) + ' — that one is issued', 'error'); return false; }
      S.cnNextNum = cnNext;
    }
  },
  rateCheck: {
    title: 'Rate & weight check',
    summary: function() { var c = rateCheckCfg(); return escHtml(c.pct + '% · ') + _sRs(c.stake).replace('.00', '') + escHtml(' · ±' + c.weightTol + '%'); },
    body: function() {
      var c = rateCheckCfg();
      return _sRow(_sfg('Check at % off the rate', 'setRcPct', _sNum('setRcPct', c.pct, 0.5, 0.5)),
        _sfg('or at &#8377; on the line', 'setRcStake', _sNum('setRcStake', c.stake, 1, 1))) +
        _sfg('Weight within &plusmn;% counts as a match', 'setWtTol', _sNum('setWtTol', c.weightTol, 0.5, 0.5));
    },
    why: 'A line whose rate, or whose kilograms against pieces &times; the weight per piece, is this far off what is on record, or puts this much money at stake, is marked <strong>Check</strong>. Anything smaller is marked <strong>Differs</strong> with its difference shown. A scale is not exact, so a weight inside the &plusmn; band matches. Nothing here stops an invoice from being saved. Set 24 Sep 2026 at 10%, &#8377;100 and &plusmn;3%.',
    save: function() {
      if (!S.rateCheck) S.rateCheck = {};
      var p = _sPos('setRcPct'), s = _sPos('setRcStake'), w = _sPos('setWtTol');
      if (p) S.rateCheck.pct = p;
      if (s) S.rateCheck.stake = gstRound(s);
      if (w) S.rateCheck.weightTol = w;
    }
  },
  stockAlerts: {
    title: 'Stock alerts',
    summary: function() { var c = stockCfg(); return escHtml('red at ' + c.redDays + ' days left · amber at ' + c.amberDays); },
    body: function() {
      var c = stockCfg();
      return _sRow(_sfg('Red at days left or fewer', 'setStkRed', _sNum('setStkRed', c.redDays, 1, 1)),
        _sfg('Amber at days left or fewer', 'setStkAmber', _sNum('setStkAmber', c.amberDays, 1, 1)));
    },
    why: 'Days left is the level over the daily use on record. Set 24 Sep 2026 at 3 and 7 days.',
    save: function() {
      if (!S.stockCheck) S.stockCheck = {};
      var r = _sPos('setStkRed'), a = _sPos('setStkAmber');
      if (r) S.stockCheck.redDays = r;
      if (a) S.stockCheck.amberDays = a;
    }
  },
  todo: {
    title: 'To-do',
    summary: function() {
      var c = todoCfg(), on = TODO_RULES.filter(function(r) { return c[r[0]]; }).length;
      return escHtml(on + ' of ' + TODO_RULES.length + ' rules on');
    },
    body: function() { return todoSettingsFields(); },
    why: 'What the app raises from your data. Each task clears itself when the thing is fixed.',
    save: function() { todoSettingsSave(); todoRefreshViews(); }
  },
  fullCost: {
    title: 'Full cost',
    summary: function() { return _sRs(S.defaultCostPerKg || 8.55) + '/kg'; },
    body: function() { return _sfg('Default cost per kg (&#8377;)', 'setDefaultCost', _sNum('setDefaultCost', S.defaultCostPerKg || 8.55, 0.01, 0.01)); },
    why: 'Full cost, not just materials. Stats judges &ldquo;below cost&rdquo; against the period&rsquo;s live cost and uses this only where there is no tonnage to divide by; Items Master reads it for break-even. The Apr&ndash;Jul 2026 rebuild put it at &#8377;8.55/kg.',
    save: function() { var v = _sPos('setDefaultCost'); if (v) S.defaultCostPerKg = v; }
  },
  fallbacks: {
    title: 'Live cost fallbacks',
    summary: function() {
      var c = costModelCfg();
      return 'power ' + _sRs(c.power) + ' &middot; other ' + _sRs(c.other) + ' &middot; chemicals ' + _sRs(stockCfg().chemModel) + ' /kg';
    },
    body: function() {
      var c = costModelCfg();
      return _sRow(_sfg('Power (&#8377;/kg)', 'setCostPower', _sNum('setCostPower', c.power, 0.01, 0.01)),
          _sfg('Consumables, ETP (&#8377;/kg)', 'setCostOther', _sNum('setCostOther', c.other, 0.01, 0.01))) +
        _sRow(_sfg('Chemicals (&#8377;/kg)', 'setStkModel', _sNum('setStkModel', stockCfg().chemModel, 0.01, 0.01)),
          _sfg('Zinc (&#8377;/kg), when no zinc price exists', 'setCostZincKg', _sNum('setCostZincKg', c.zincPerKg, 0.01, 0.01))) +
        _sfg('Zinc used a month, when none is recorded (kg)', 'setCostZinc', _sNum('setCostZinc', c.zincKgMonth, 1, 1));
    },
    why: 'Used by Stats &rarr; Live cost only where nothing is recorded for the period, and marked <em>model</em> there. A bill or a stock entry replaces each one. The chemicals figure is also what the measured chemicals cost is reported against.',
    save: function() {
      if (!S.costModel || typeof S.costModel !== 'object') S.costModel = {};
      [['setCostPower', 'power'], ['setCostOther', 'other'], ['setCostZinc', 'zincKgMonth'], ['setCostZincKg', 'zincPerKg']].forEach(function(p) {
        var v = _sPos(p[0]);
        if (v) S.costModel[p[1]] = v;
      });
      if (!S.stockCheck) S.stockCheck = {};
      var m = _sPos('setStkModel');
      if (m) S.stockCheck.chemModel = m;
    }
  },
  zinc: {
    title: 'Zinc rate',
    summary: function() {
      var z = getZinc(), landed = zincLandedRate();
      var up = 'uplift ' + formatNum(z.upliftPct, 1) + '%';
      if (landed == null) return escHtml(up + ' · premium ') + _sRs(z.premiumPerKg || 0) + ' &middot; no rate yet';
      return escHtml(up + ' · ') + _sRs(landed) + '/kg landed';
    },
    body: function() {
      var z = getZinc();
      return _sRow(_sfg('Market rate (&#8377;/kg)', 'setZincRate', '<input type="number" step="0.01" class="inv-form-input inv-mono" id="setZincRate" value="' + (z.ratePerKg == null ? '' : z.ratePerKg) + '" placeholder="400.00">'),
          _sfg('Supplier premium (&#8377;/kg)', 'setZincPremium', _sNum('setZincPremium', z.premiumPerKg || 0, 0.01, 0))) +
        '<div class="inv-text-muted inv-storage-text inv-mb-8">' + (z.basis === 'lme'
          ? 'LME from ' + escHtml(z.source || 'metals.dev') + ' &mdash; Refresh on the Home zinc card updates it.'
          : 'Typed by hand, so it is taken as MCX already and not uplifted.') + '</div>' +
        _sfg('LME &rarr; MCX uplift (%)', 'setZincUplift', _sNum('setZincUplift', z.upliftPct, 0.1, 0)) +
        '<button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invZincDeriveUplift">Derive from zinc bills</button>' +
        '<div id="zincUpliftOut" class="inv-set-derive"></div>';
    },
    why: 'metals.dev publishes no MCX base metal, so a fetched rate is LME and is uplifted by this to estimate MCX: uplift = (MCX &divide; LME &minus; 1) &times; 100. No free service publishes MCX zinc either, so <strong>Derive from zinc bills</strong> measures it from what the shop actually paid: each bill&rsquo;s price before GST, less the supplier premium, against LME on the bill&rsquo;s date (from metals.dev, with the same key). A rate typed above is taken as MCX already and is not uplifted.',
    save: function() {
      var z = getZinc();
      var raw = _sVal('setZincRate').trim();
      if (raw === '') {
        z.ratePerKg = null; z.updatedAt = null; z.source = '';
      } else {
        var parsed = parseFloat(raw);
        // Only stamp the date when the figure actually moved, so an unrelated
        // save cannot make a stale rate look freshly checked.
        if (!isNaN(parsed) && parsed > 0 && gstRound(parsed) !== z.ratePerKg) {
          z.ratePerKg = gstRound(parsed);
          z.updatedAt = Date.now();
          z.source = 'manual';
          // A figure typed here is the MCX rate itself, so it must not also be
          // uplifted — that would compound an estimate onto a known number.
          z.basis = 'manual';
        }
      }
      var prem = _sNonNeg('setZincPremium');
      if (prem != null) z.premiumPerKg = gstRound(prem);
      var up = _sNonNeg('setZincUplift');
      if (up != null) z.upliftPct = up;
      renderZincCard();
    }
  },
  overtime: {
    title: 'Overtime',
    summary: function() {
      var c = labourCfg();
      return escHtml('×' + _sLab('otMult', 1.1) + ' · cap ') + _sRs(c.otCap) + '/h' + (c.otCapFrom ? escHtml(' from ' + formatDate(c.otCapFrom)) : '');
    },
    body: function() {
      var c = labourCfg();
      return _sRow(_sfg('OT multiplier', 'setOtMult', _sNum('setOtMult', _sLab('otMult', 1.1), 0.01, 1)),
          _sfg('Monthly tier cap (&#8377;/h, after the multiplier)', 'setOtCap', _sNum('setOtCap', c.otCap, 0.01, 0))) +
        _sfg('Cap applies to OT dated from', 'setOtCapFrom', '<input type="date" class="inv-form-input inv-mono" id="setOtCapFrom" value="' + escHtml(c.otCapFrom || '') + '">');
    },
    why: '<strong>Monthly</strong> OT is weekday hours over 8 at day rate &divide; 8 &times; the multiplier, capped per hour from the date above (owner, 25 Sep 2026: capped at &#8377;68.20 from September; July and August were paid uncapped). A Sunday&rsquo;s hours are that day, never OT. <strong>Daily</strong> OT is at the multiplier, uncapped. <strong>Hourly</strong> hands have no OT: every hour is paid at one rate.',
    save: function() {
      if (!S.labour) S.labour = {};
      var m = _sNonNeg('setOtMult'), cap = _sNonNeg('setOtCap');
      if (m != null) S.labour.otMult = m;
      if (cap != null) S.labour.otCap = cap;
      S.labour.otCapFrom = _sVal('setOtCapFrom') || '';
    }
  },
  rest: {
    title: 'Rest days & attendance',
    summary: function() {
      var c = labourCfg();
      return escHtml('full at ' + Math.round(_sLab('gateFull', 0.9) * 100) + '% · half at ' + Math.round(_sLab('gateHalf', 0.8) * 100) + '% · ' +
        c.holidays.length + ' paid holiday' + (c.holidays.length === 1 ? '' : 's'));
    },
    body: function() {
      return _sRow(_sfg('Rest gate &mdash; full at (%)', 'setGateFull', _sNum('setGateFull', Math.round(_sLab('gateFull', 0.9) * 100), 1, 0, 100)),
          _sfg('Rest gate &mdash; half at (%)', 'setGateHalf', _sNum('setGateHalf', Math.round(_sLab('gateHalf', 0.8) * 100), 1, 0, 100))) +
        _sfg('Paid holidays (MM-DD every year, or a full date)', 'setHolidays', '<input class="inv-form-input inv-mono" id="setHolidays" value="' + escHtml(labourCfg().holidays.join(', ')) + '">') +
        _sfg('Daily tier: rest credit at (days worked a week)', 'setRestMin', _sNum('setRestMin', _sLab('restCreditMinDays', 6), 1, 0, 7));
    },
    why: 'A monthly hand&rsquo;s Sundays are paid by the gate, judged per calendar month on weekdays worked &divide; the month&rsquo;s working days: at or over the first figure all of them, at or over the second half, below that none. Paid holidays are always paid (BM, 10 Sep 2026). A hand on a contracted monthly wage is not gated. The daily tier earns one rest day a week once it works this many days.',
    save: function() {
      if (!S.labour) S.labour = {};
      var gf = _sNonNeg('setGateFull'), gh = _sNonNeg('setGateHalf'), rm = parseInt(_sVal('setRestMin'), 10);
      if (gf != null && gf <= 100) S.labour.gateFull = gf / 100;
      if (gh != null && gh <= 100) S.labour.gateHalf = gh / 100;
      // A half threshold above the full one would make the middle band unreachable
      // and the gate silently binary. Swap rather than refuse: the intent is plain.
      if (S.labour.gateHalf > S.labour.gateFull) {
        var swap = S.labour.gateHalf; S.labour.gateHalf = S.labour.gateFull; S.labour.gateFull = swap;
      }
      if (!isNaN(rm) && rm >= 0) S.labour.restCreditMinDays = rm;
      S.labour.holidays = _sVal('setHolidays').split(/[,;\s]+/).map(function(x) { return x.trim(); }).filter(function(x) {
        return /^(\d{4}-)?\d{2}-\d{2}$/.test(x);
      });
    }
  },
  extra: {
    title: 'The extra',
    summary: function() { return _sRs(_sLab('extraRate', 0)) + '/h &middot; ' + escHtml(_sLab('extraHoursPerHead', 8) + ' h per missing hand'); },
    body: function() {
      return _sRow(_sfg('Extra-hour rate (&#8377;/h)', 'setExtraRate', _sNum('setExtraRate', _sLab('extraRate', 0), 0.01, 0)),
        _sfg('Extra per missing hand (h)', 'setExtraPerHead', _sNum('setExtraPerHead', _sLab('extraHoursPerHead', 8), 0.5, 0)));
    },
    why: 'The extra-hour rate prices the hours booked to an area with nobody named. <strong>Extra per missing hand</strong> is how many are booked for each hand an area is short of its complement, which is what the Areas view checks the booked hours against.',
    save: function() {
      if (!S.labour) S.labour = {};
      var r = _sNonNeg('setExtraRate'), h = _sNonNeg('setExtraPerHead');
      if (r != null) S.labour.extraRate = r;
      if (h != null) S.labour.extraHoursPerHead = h;
    }
  },
  labModel: {
    title: 'Modelled labour',
    summary: function() { return _sRs(_sLab('modelPerKg', 0)) + '/kg'; },
    body: function() { return _sfg('Modelled labour (&#8377;/kg)', 'setLabModel', _sNum('setLabModel', _sLab('modelPerKg', 0), 0.01, 0)); },
    why: 'What the measured labour figure is reported against. The Apr&ndash;Jul 2026 rebuild put labour at &#8377;3.55 of an &#8377;8.55 cost.',
    save: function() { var v = _sNonNeg('setLabModel'); if (v != null) { if (!S.labour) S.labour = {}; S.labour.modelPerKg = v; } }
  },
  metalsKey: {
    title: 'metals.dev (zinc rate)',
    summary: function() { return getMetalsKey() ? 'key saved on this device' : 'no key'; },
    body: function() { return _sfg('API key', 'setMetalsKey', _sKey('setMetalsKey', getMetalsKey(), 'Paste key', 'invToggleMetalsKey')); },
    why: 'Free tier at metals.dev covers a daily refresh. The key stays on this device and is never included in an export. Leave it blank to enter the zinc rate by hand.',
    save: function() { setMetalsKey(_sVal('setMetalsKey').trim()); renderZincCard(); }
  },
  geminiKey: {
    title: 'Challan scanner (Gemini)',
    summary: function() { return getApiKey() ? 'key saved on this device' : 'no key'; },
    body: function() { return _sfg('Google Gemini API key', 'setApiKey', _sKey('setApiKey', getApiKey(), 'AIza...', 'invToggleApiKey')); },
    why: 'Free from aistudio.google.com (Google account only, no card). The key stays on this device.',
    save: function() { setApiKey(_sVal('setApiKey').trim()); }
  },
  sync: {
    title: 'GitHub sync',
    summary: function() {
      var cfg = getGhConfig(), last = ghLastSyncAt();
      if (!cfg.owner || !cfg.repo) return 'not set up';
      return '<span class="inv-mono">' + escHtml(cfg.owner + '/' + cfg.repo) + '</span>' + escHtml(last ? ' · synced ' + ghRelTime(last) : ' · not synced yet');
    },
    body: function() { return renderGhSyncFields(); },
    save: function() { saveGhSyncSettings(); ghRenderCard(); }
  },
  appearance: {
    title: 'Appearance',
    summary: function() { return appearanceSummary(); },
    body: function() { return appearanceFieldsHtml(); },
    why: 'Kept on this device only, so each phone and computer can look its own way and a backup never changes it. ' +
      'Theme on System follows the phone&rsquo;s light or dark setting. Density Auto is compact on the desktop layout and comfortable on the phone. ' +
      'The installed app icon stays Teal: it comes from one file every device shares.'
  },
  data: {
    title: 'Backup, storage & build',
    summary: function() { return 'export, import &middot; build <span class="inv-mono">' + escHtml(APP_BUILD) + '</span>'; },
    body: function() {
      return '<div class="inv-form-row"><button class="inv-btn inv-btn-ghost inv-btn-block" data-action="invExportData">Export JSON</button>' +
        '<button class="inv-btn inv-btn-ghost inv-btn-block" data-action="invImportData">Import JSON</button></div>' +
        '<input type="file" id="importFileInput" accept=".json" class="inv-hidden">' +
        '<div class="inv-storage-wrap"><div class="inv-text-muted inv-storage-text">Storage: ' + estimateStorage() + ' in memory &middot; <span class="inv-disk-summary">on disk: checking&hellip;</span></div>' +
        '<div class="inv-text-muted inv-storage-text">Last save: <span class="inv-save-status">' + renderLastSave() + '</span></div>' +
        '<div class="inv-text-muted inv-storage-text">Build <span class="inv-build-id">' + escHtml(APP_BUILD) + '</span> &middot; ' +
        '<button type="button" class="inv-link-btn" data-action="invCheckUpdate">Check for a newer version</button> &middot; ' +
        '<button type="button" class="inv-link-btn" data-action="invRunDiagnostics">Run storage diagnostics</button></div>' +
        '<div id="storageDiagOut"></div></div>';
    },
    why: 'Import replaces the whole book with the file. Exporting also counts as a backup for the To-do reminder.'
  }
};

var _CHEVRON_SVG = '<svg class="inv-set-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

function _settingsSecHtml(key, open) {
  var s = SETTINGS_SECS[key];
  return '<details class="inv-set-sec" data-sec="' + key + '"' + (open ? ' open' : '') + '>' +
    '<summary class="inv-set-sec-head">' + _CHEVRON_SVG +
    '<span class="inv-set-sec-text"><span class="inv-set-sec-name">' + escHtml(s.title) + '</span>' +
    '<span class="inv-set-sec-sum" data-sum="' + key + '">' + s.summary() + '</span></span>' +
    '<span class="inv-set-dot" aria-label="Unsaved"></span></summary>' +
    '<div class="inv-set-sec-body">' + s.body() +
    (s.why ? '<details class="inv-set-why"><summary>How this is used</summary><div class="inv-text-muted inv-storage-text">' + s.why + '</div></details>' : '') +
    (s.save ? '<div class="inv-set-actions"><button type="button" class="inv-btn inv-btn-primary inv-btn-sm" data-action="invSaveSettingsSec" data-sec="' + key + '" disabled>Save</button></div>' : '') +
    '</div></details>';
}

/* Opens Settings; with a section key, on that section, open and in view. */
function openSettings(target) {
  var ui = _setUi();
  var tgtGroup = target && _settingsGroupOf(target);
  if (tgtGroup) {
    ui.group = tgtGroup;
    if (ui.open.indexOf(target) < 0) ui.open.push(target);
    _setUiSave(ui);
  }
  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.id = 'settingsScrim';
  scrim.innerHTML = '<div class="inv-overlay-card inv-set-card">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">Settings</span>' +
    '<button class="inv-overlay-close" data-action="invCloseSettings" aria-label="Close settings">&times;</button></div>' +
    '<div class="inv-set-layout">' +
    '<nav class="inv-set-nav" aria-label="Settings groups">' + SETTINGS_GROUPS.map(function(g) {
      return '<button type="button" class="inv-set-nav-btn' + (g.key === ui.group ? ' inv-set-nav-on' : '') + '" data-action="invSettingsGroup" data-group="' + g.key + '">' +
        '<span>' + escHtml(g.label) + '</span><span class="inv-set-dot" aria-label="Unsaved"></span></button>';
    }).join('') + '</nav>' +
    '<div class="inv-set-panes">' + SETTINGS_GROUPS.map(function(g) {
      return '<section class="inv-set-group' + (g.key === ui.group ? ' inv-set-group-on' : '') + '" data-group="' + g.key + '">' +
        '<h3 class="inv-set-group-title">' + escHtml(g.label) + '</h3>' +
        g.secs.map(function(k) { return _settingsSecHtml(k, ui.open.indexOf(k) >= 0); }).join('') + '</section>';
    }).join('') + '</div></div></div>';
  scrim.addEventListener('click', function(e) { if (e.target === scrim) closeSettings(); });
  scrim.addEventListener('input', _settingsOnEdit);
  scrim.addEventListener('change', _settingsOnEdit);
  // toggle does not bubble; capture sees every section's.
  scrim.addEventListener('toggle', function(e) {
    var d = e.target;
    if (!d.classList || !d.classList.contains('inv-set-sec')) return;
    var u = _setUi(), k = d.dataset.sec;
    u.open = u.open.filter(function(x) { return x !== k; });
    if (d.open) u.open.push(k);
    _setUiSave(u);
  }, true);
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  if (target) {
    var sec = scrim.querySelector('.inv-set-sec[data-sec="' + target + '"]');
    if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'start' });
  }
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
  refreshDiskSummary();
}

function settingsShowGroup(key) {
  var scrim = document.getElementById('settingsScrim');
  if (!scrim) return;
  scrim.querySelectorAll('.inv-set-nav-btn').forEach(function(b) { b.classList.toggle('inv-set-nav-on', b.dataset.group === key); });
  scrim.querySelectorAll('.inv-set-group').forEach(function(g) { g.classList.toggle('inv-set-group-on', g.dataset.group === key); });
  var panes = scrim.querySelector('.inv-set-panes');
  if (panes) panes.scrollTop = 0;
  var u = _setUi(); u.group = key; _setUiSave(u);
}

function _settingsOnEdit(e) {
  var t = e.target;
  if (!t || !t.closest || t.id === 'importFileInput') return;
  var d = t.closest('details.inv-set-sec');
  if (!d || !SETTINGS_SECS[d.dataset.sec] || !SETTINGS_SECS[d.dataset.sec].save) return;
  d.classList.add('inv-set-dirty');
  var b = d.querySelector('[data-action="invSaveSettingsSec"]');
  if (b) b.disabled = false;
  _settingsNavDots();
}

function _settingsNavDots() {
  var scrim = document.getElementById('settingsScrim');
  if (!scrim) return;
  scrim.querySelectorAll('.inv-set-nav-btn').forEach(function(b) {
    var g = scrim.querySelector('.inv-set-group[data-group="' + b.dataset.group + '"]');
    b.classList.toggle('inv-set-dirty', !!(g && g.querySelector('.inv-set-sec.inv-set-dirty')));
  });
}

function _settingsDirty() {
  return Array.prototype.map.call(document.querySelectorAll('#settingsScrim .inv-set-sec.inv-set-dirty'), function(d) {
    return SETTINGS_SECS[d.dataset.sec].title;
  });
}

function saveSettingsSection(key) {
  var s = SETTINGS_SECS[key];
  if (!s || !s.save) return;
  if (s.save() === false) return;
  saveState();
  var d = document.querySelector('#settingsScrim .inv-set-sec[data-sec="' + key + '"]');
  if (d) {
    d.classList.remove('inv-set-dirty');
    var b = d.querySelector('[data-action="invSaveSettingsSec"]');
    if (b) b.disabled = true;
  }
  _settingsNavDots();
  // Summaries share config (the zinc line reads the premium and the key), so
  // all of them are redrawn rather than only the one saved.
  document.querySelectorAll('#settingsScrim [data-sum]').forEach(function(el) {
    el.innerHTML = SETTINGS_SECS[el.dataset.sum].summary();
  });
  showToast(s.title + ' saved');
}

function closeSettings() {
  var dirty = _settingsDirty();
  if (dirty.length && !confirm('Not saved: ' + dirty.join(', ') + '. Close without saving?')) return;
  closeOverlay();
}

/* ===== STORAGE DIAGNOSTICS =====
   The questions a lost import raises, answered from the device itself rather
   than guessed at from a laptop: what is on disk right now, when was it
   written, did the last save land, and how much more will this browser take.
   The report is plain text so it can be pasted into a message as-is. */
function readDiskState() {
  return readPersistedStateRaw().then(function(raw) {
    if (raw == null) return { chars: 0, raw: null };
    return { chars: raw.length, raw: raw };
  }, function(e) {
    return { chars: -1, error: describeStorageError(e) };
  });
}

function renderDiskSummary(d) {
  if (d.chars < 0) return 'on disk: unreadable (' + escHtml(d.error) + ')';
  if (d.chars === 0) return 'on disk: nothing';
  var mem = 0;
  try { mem = JSON.stringify(S).length; } catch (e) {}
  return 'on disk: ' + fmtChars(d.chars) + (mem && mem !== d.chars ? ' (differs from memory)' : ' (matches memory)');
}

function refreshDiskSummary() {
  readDiskState().then(function(d) {
    var el = document.querySelector('.inv-disk-summary');
    if (el) el.innerHTML = renderDiskSummary(d);
  });
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
function fmtBytes(n) {
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  return Math.round(n / 1024) + ' KB';
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

// How much MORE localStorage the origin will take. The state no longer lives
// there, so this is the pool the sister apps draw on — the figure that
// explained the phone, and the one that says whether they are next. Each probe
// is written to a scratch key, read back, and removed.
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
  var estimate = Promise.resolve(null);
  var persisted = Promise.resolve(null);
  try {
    if (navigator.storage && navigator.storage.estimate) estimate = navigator.storage.estimate().then(null, function() { return null; });
    if (navigator.storage && navigator.storage.persisted) persisted = navigator.storage.persisted().then(null, function() { return null; });
  } catch (e) {}
  return Promise.all([readDiskState(), estimate, persisted]).then(function(results) {
    var disk = results[0], est = results[1], isPersisted = results[2];
    var lines = [];
    var memNewest = newestIn(S);
    var diskNewest = null, diskParseError = '';
    if (disk.raw) {
      try { diskNewest = newestIn(JSON.parse(disk.raw)); } catch (e) { diskParseError = describeStorageError(e); }
    }
    var standalone = false;
    try { standalone = window.matchMedia('(display-mode: standalone)').matches; } catch (e) {}
    var swState = 'unsupported';
    if ('serviceWorker' in navigator) swState = navigator.serviceWorker.controller ? 'controlling' : 'none';
    var mem = 0;
    try { mem = JSON.stringify(S).length; } catch (e) {}

    // Every localStorage key on the origin, by size — names only, never
    // values. That pool is shared by every GitHub Pages project under the
    // account, which is why the state no longer lives in it.
    var keys = [], originTotal = 0, legacyChars = -1;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var v = localStorage.getItem(k);
        var n = k.length + (v ? v.length : 0);
        keys.push({ key: k, chars: n });
        originTotal += n;
        if (k === STORAGE_KEY) legacyChars = v ? v.length : 0;
      }
    } catch (e) {}
    keys.sort(function(a, b) { return b.chars - a.chars; });
    var probe = probeStorageHeadroom();

    lines.push('SEP Invoicing storage diagnostics');
    lines.push('Build: ' + APP_BUILD);
    lines.push('Time: ' + new Date().toString());
    lines.push('Browser: ' + navigator.userAgent);
    lines.push('Display: ' + (standalone ? 'installed app' : 'browser tab') + ' \u00b7 worker ' + swState);
    lines.push('URL: ' + location.href);
    lines.push('');
    lines.push('Store: ' + (_storeMode === 'idb' ? 'IndexedDB ' + IDB_NAME + '/' + IDB_STORE + ' (verified writes)' : 'localStorage (IndexedDB unavailable in this browser)') +
      ' \u00b7 loaded from ' + _loadedFrom);
    if (est) lines.push('Quota: using ' + fmtBytes(est.usage || 0) + ' of ' + fmtBytes(est.quota || 0) + ' available to this origin' +
      (isPersisted === null ? '' : ' \u00b7 persistent storage ' + (isPersisted ? 'granted' : 'not granted, best-effort')));
    else lines.push('Quota: navigator.storage.estimate unsupported');
    lines.push('In memory: ' + fmtChars(mem) + ' \u00b7 ' + memNewest.invoices + ' invoices, ' + memNewest.challans + ' challans');
    lines.push('  newest invoice date ' + (memNewest.invoiceDate || 'none') + ', last record ' + (memNewest.recordedAt ? new Date(memNewest.recordedAt).toISOString() : 'none'));
    if (disk.chars < 0) lines.push('On disk: UNREADABLE (' + disk.error + ')');
    else if (disk.chars === 0) lines.push('On disk: nothing stored');
    else {
      lines.push('On disk: ' + fmtChars(disk.chars) + (disk.chars === mem ? ' \u00b7 matches memory' : ' \u00b7 DIFFERS from memory'));
      if (diskNewest) lines.push('  newest invoice date ' + (diskNewest.invoiceDate || 'none') + ', last record ' + (diskNewest.recordedAt ? new Date(diskNewest.recordedAt).toISOString() : 'none') + ' \u00b7 ' + diskNewest.invoices + ' invoices, ' + diskNewest.challans + ' challans');
      if (diskParseError) lines.push('  stored copy does not parse: ' + diskParseError);
    }
    lines.push('Last save: ' + renderLastSave().replace(/<[^>]+>/g, ''));
    if (_storageHealth.readError) lines.push('Read error at load: ' + _storageHealth.readError);
    lines.push('Legacy localStorage copy: ' + (legacyChars < 0 ? 'removed' : 'still present, ' + fmtChars(legacyChars) + ' (removed after the next verified save)'));
    lines.push('localStorage on ' + location.origin + ': ' + fmtChars(originTotal) + ' across ' + keys.length + ' key' + (keys.length === 1 ? '' : 's') +
      ' (one pool for every app served from this origin)');
    keys.forEach(function(entry) { lines.push('  ' + entry.key + ': ' + fmtChars(entry.chars)); });
    lines.push('localStorage headroom: accepted an extra ' + fmtChars(probe.maxOk) + (probe.failedAt ? ', refused ' + fmtChars(probe.failedAt) + ' (' + probe.error + ')' : ', every probe accepted'));
    return lines.join('\n');
  });
}

function runStorageDiagnostics() {
  var out = document.getElementById('storageDiagOut');
  if (out) out.innerHTML = '<div class="inv-text-muted inv-storage-text">Reading the store&hellip;</div>';
  buildDiagnosticsReport().then(function(report) {
    if (out) {
      out.innerHTML = '<pre class="inv-diag-report">' + escHtml(report) + '</pre>' +
        '<div class="inv-text-muted inv-storage-text">Copied to the clipboard where the browser allows it; otherwise select the text above.</div>';
    }
    var status = document.querySelector('.inv-save-status');
    if (status) status.innerHTML = renderLastSave();
    refreshDiskSummary();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(report).then(function() { showToast('Diagnostics copied'); }, function() {});
      }
    } catch (e) {}
  });
}

function estimateStorage() {
  try {
    const s = JSON.stringify(S).length;
    if (s > 1048576) return (s / 1048576).toFixed(1) + ' MB';
    return (s / 1024).toFixed(0) + ' KB';
  } catch(e) { return 'Unknown'; }
}

function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sep-invoicing-backup-' + localDateStr() + '.json';
  a.click();
  todoNoteExport();
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
        closeOverlay();
        renderHome();
        saveState().then(function(saved) {
          if (saved) showToast('Data imported');
          else showToast('NOT saved: the browser refused to store it (' + _storageHealth.lastError + '). The data is in memory only and will be lost on reload.', 'error');
        });
      } catch(err) {
        showToast('Invalid file: ' + err.message, 'error');
      }
    };
    reader.readAsText(f);
  };
  inp.click();
}

