/* ===== ZINC MARKET RATE =====

   Zinc is the largest bought-in input on the floor — ~26% of cost at ~425 kg
   a month. It is bought at the MCX rate plus a fixed supplier premium, so a
   stale or wrong figure quietly distorts every cost-per-kg number downstream.

   metals.dev does not publish MCX base metals. Its MCX coverage is precious
   metals only (mcx_gold, mcx_silver); `zinc` and `lme_zinc` are the same LME
   figure. LME runs below MCX by basic customs duty plus freight and local
   premium — about 10.5% when this was calibrated (LME 355.11 against an MCX
   quote near 392).

   So the fetched figure is LME, and MCX is DERIVED from it by an uplift the
   operator can recalibrate whenever they see a real MCX quote. LME tracks the
   world price daily; the wedge over it is structural and moves slowly. A rate
   entered by hand is treated as the MCX rate itself and takes no uplift.

   Nothing here is ever labelled MCX without saying it was estimated.

   The rate lives on S so it travels with export/import. The API key does not —
   it goes to localStorage under its own key, the same as the Gemini key the
   challan scanner uses, so a backup JSON never carries a credential. */

var ZINC_STALE_DAYS = 7;
var ZINC_DEFAULT_UPLIFT = 10.5;

function getZinc() {
  if (!S.zinc) {
    S.zinc = { ratePerKg: null, premiumPerKg: 15, upliftPct: ZINC_DEFAULT_UPLIFT,
               basis: 'manual', updatedAt: null, source: '' };
  }
  if (S.zinc.premiumPerKg == null) S.zinc.premiumPerKg = 15;
  if (S.zinc.upliftPct == null) S.zinc.upliftPct = ZINC_DEFAULT_UPLIFT;
  if (!S.zinc.basis) S.zinc.basis = 'manual';
  return S.zinc;
}

/* The MCX rate: taken as given when entered by hand, uplifted from LME when
   fetched. Returns null until a rate exists. */
function zincMcxRate() {
  var z = getZinc();
  if (z.ratePerKg == null) return null;
  if (z.basis !== 'lme') return gstRound(z.ratePerKg);
  return gstRound(z.ratePerKg * (1 + (z.upliftPct || 0) / 100));
}

/* What a kilo actually costs landed: MCX plus the supplier premium. */
function zincLandedRate() {
  var mcx = zincMcxRate();
  if (mcx == null) return null;
  return gstRound(mcx + (getZinc().premiumPerKg || 0));
}

function zincAgeDays() {
  var z = getZinc();
  if (!z.updatedAt) return null;
  return Math.floor((Date.now() - z.updatedAt) / 86400000);
}

function renderZincCard() {
  var el = document.getElementById('homeZincCard');
  if (!el) return;
  var z = getZinc();
  var landed = zincLandedRate();

  if (landed == null) {
    // Adding the key does not fetch anything by itself, so the empty state has
    // to carry the Refresh button too. Without it, setting a key left the card
    // still asking for a key and no way to act on it.
    var hasKey = !!getMetalsKey();
    el.innerHTML = '<div class="inv-card"><div class="inv-card-header">' +
      '<span class="inv-card-title">Zinc</span>' +
      (hasKey ? '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invRefreshZinc">Refresh</button>' : '') +
      '</div>' +
      '<div class="inv-text-muted inv-storage-text">' +
      (hasKey
        ? 'No rate recorded yet. Tap Refresh to pull the current market rate, or enter it by hand in Settings.'
        : 'No rate recorded. Set it in Settings, or add a metals.dev API key there to pull it from the market.') +
      '</div></div>';
    return;
  }

  var age = zincAgeDays();
  var stale = age == null || age > ZINC_STALE_DAYS;
  var ageText = age == null ? 'never updated'
    : age === 0 ? 'updated today'
    : 'updated ' + age + ' day' + (age !== 1 ? 's' : '') + ' ago';

  el.innerHTML = '<div class="inv-card"><div class="inv-card-header">' +
    '<span class="inv-card-title">Zinc</span>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invRefreshZinc">Refresh</button>' +
    '</div>' +
    '<div class="inv-flex-between inv-mb-8">' +
    '<div><div class="inv-text-muted inv-stat-label">Landed per kg</div>' +
    '<div class="inv-display inv-stat-value">' + formatCurrency(landed) + '</div></div>' +
    '<div class="inv-text-right"><div class="inv-text-muted inv-stat-label">' +
    (z.basis === 'lme' ? 'MCX est. + premium' : 'MCX + premium') + '</div>' +
    '<div class="inv-mono inv-zinc-breakdown">' + formatCurrency(zincMcxRate()) +
    ' + ' + formatCurrency(z.premiumPerKg || 0) + '</div></div></div>' +
    // Show the whole derivation when the figure was uplifted from LME, so an
    // estimate never reads as a quoted MCX price.
    (z.basis === 'lme'
      ? '<div class="inv-zinc-meta">LME ' + formatCurrency(z.ratePerKg) +
        ' + ' + formatNum(z.upliftPct, 1) + '% duty/freight = MCX est. ' +
        formatCurrency(zincMcxRate()) + '</div>'
      : '') +
    '<div class="inv-zinc-meta' + (stale ? ' inv-zinc-stale' : '') + '">' +
    escHtml(ageText) + (z.source ? ' · ' + escHtml(z.source) : '') +
    (stale ? ' · may be out of date' : '') + '</div></div>';
}

/* Pull the live rate. Deliberately forgiving about the response shape: the
   payload is read for a zinc figure in several plausible places, and if none
   of them hold one the actual keys returned are surfaced rather than a bare
   failure, so the path can be corrected without guesswork. */
function refreshZincRate() {
  var key = getMetalsKey();
  if (!key) {
    showToast('Add a metals.dev API key in Settings first', 'error');
    return;
  }

  showToast('Fetching zinc rate…');
  fetch('https://api.metals.dev/v1/latest?api_key=' + encodeURIComponent(key) +
        '&currency=INR&unit=kg')
    .then(function(res) { return res.json(); })
    .then(function(json) {
      if (!json || json.status === 'failure') {
        showToast('metals.dev: ' + ((json && json.error_message) || 'request failed'), 'error');
        return;
      }
      var hit = _extractZincRate(json);
      if (!hit) {
        showToast('No zinc rate in response. Returned: ' + _describeShape(json), 'error');
        return;
      }
      var z = getZinc();
      z.ratePerKg = gstRound(hit.rate);
      z.updatedAt = Date.now();
      // metals.dev publishes no MCX base metal today, so in practice this is
      // LME and gets the uplift. Only an explicitly MCX-named field is taken as
      // the Indian price, which keeps this correct if that ever appears.
      z.basis = /mcx/i.test(hit.field) ? 'mcx' : 'lme';
      z.source = 'metals.dev · ' + hit.field;
      if (z.basis === 'lme') _zincRememberLme(localDateStr(), z.ratePerKg);
      saveState();
      renderZincCard();
      showToast(z.basis === 'lme'
        ? 'LME ' + formatCurrency(z.ratePerKg) + ' → MCX est. ' + formatCurrency(zincMcxRate()) +
          ' → ' + formatCurrency(zincLandedRate()) + '/kg landed'
        : 'MCX ' + formatCurrency(zincMcxRate()) + ' → ' +
          formatCurrency(zincLandedRate()) + '/kg landed');
    })
    .catch(function(err) {
      showToast('Could not reach metals.dev: ' + (err && err.message ? err.message : 'network error'), 'error');
    });
}

/* Returns {rate, field} or null. The matched field name comes back with the
   rate because it decides how the figure is treated: an MCX-named field is the
   Indian price and stands as-is, anything else is LME and gets the duty/freight
   uplift. It is shown in the UI too, so the provenance of the number on screen
   is never a guess. */
function _extractZincRate(json) {
  var buckets = [
    { obj: json.metals, path: 'metals' },
    { obj: json.rates, path: 'rates' },
    { obj: json.data, path: 'data' },
    { obj: json, path: '' }
  ];
  // MCX first in case the API ever carries it; then the explicitly-named LME
  // field, which is clearer provenance than the bare `zinc` alias for the same
  // number; bare aliases last.
  var names = ['mcx_zinc', 'zinc_mcx', 'lme_zinc', 'zinc_lme', 'zinc', 'Zinc', 'ZINC'];

  for (var n = 0; n < names.length; n++) {
    for (var b = 0; b < buckets.length; b++) {
      var bucket = buckets[b].obj;
      if (!bucket || typeof bucket !== 'object') continue;
      var v = bucket[names[n]];
      var rate = null;
      if (typeof v === 'number' && isFinite(v) && v > 0) rate = v;
      else if (v && typeof v === 'object' && typeof v.price === 'number' && v.price > 0) rate = v.price;
      if (rate != null) {
        return { rate: rate, field: (buckets[b].path ? buckets[b].path + '.' : '') + names[n] };
      }
    }
  }
  return null;
}

function _describeShape(json) {
  try {
    var top = Object.keys(json).join(', ');
    if (json.metals && typeof json.metals === 'object') {
      return top + ' | metals: ' + Object.keys(json.metals).slice(0, 12).join(', ');
    }
    return top;
  } catch (e) { return 'unreadable response'; }
}

/* ===== THE UPLIFT, MEASURED =====
   No free service publishes MCX zinc, but the shop's own zinc bills do: a bill
   is priced at MCX plus the supplier premium, so price before GST − premium is
   the MCX that was actually paid. Set against LME on the bill's date, each bill
   gives an uplift; the median of the last few is offered, never applied. The
   figure that matters is what the shop pays, which a market quote is not.

   LME on a past date: every rate Refresh fetched is kept by day
   (S.zinc.lmeHistory, INR/kg). A bill dated before that record began is looked
   up on metals.dev's timeseries with the same key, and what comes back is kept
   too, so asking twice costs one request. LME does not trade at weekends, so
   the last rate on or up to four days before the bill stands for it. */
var ZINC_DERIVE_BILLS = 6;
var ZINC_LME_LOOKBACK = 4;
var _zincDerived = null;

function _zincRememberLme(date, rate) {
  var z = getZinc();
  if (!z.lmeHistory || typeof z.lmeHistory !== 'object') z.lmeHistory = {};
  z.lmeHistory[date] = gstRound(rate);
  var keys = Object.keys(z.lmeHistory).sort();
  while (keys.length > 400) delete z.lmeHistory[keys.shift()];
}

function _zincIsoAdd(iso, n) {
  var d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* {rate, date} for the LME standing on `date`, or null. */
function _zincLmeOn(date) {
  var h = getZinc().lmeHistory || {};
  for (var i = 0; i <= ZINC_LME_LOOKBACK; i++) {
    var d = _zincIsoAdd(date, -i);
    if (h[d] > 0) return { rate: h[d], date: d };
  }
  return null;
}

function zincUpliftBills() {
  if (typeof stockData !== 'function') return [];
  var item = stockData().items.find(function(i) { return i.key === 'ZINC'; });
  if (!item) return [];
  return stockPurchases(item.id).filter(function(p) { return p.e.price > 0; }).slice(-ZINC_DERIVE_BILLS).map(function(p) {
    return { date: p.date, price: p.e.price, supplier: p.e.supplier || '', billNo: p.e.billNo || '' };
  });
}

/* A timeseries day's zinc in INR/kg, whatever currency and unit it came in.
   `currencies` quotes each currency in the response's own: USD per INR for a
   USD response, so INR/kg = (USD/kg) ÷ (USD per INR). */
function _zincDayInrKg(json, day) {
  var hit = _extractZincRate(day);
  if (!hit) return null;
  var perKg = { kg: 1, g: 1000, toz: 32.1507466, oz: 35.2739619, lb: 2.20462262, mt: 0.001, t: 0.001 }[String(json.unit || 'toz').toLowerCase()];
  if (!perKg) return null;
  var v = hit.rate * perKg;
  if (String(json.currency || 'USD').toUpperCase() === 'INR') return v;
  var inr = day.currencies && day.currencies.INR;
  return inr > 0 ? v / inr : null;
}

function _zincFetchLme(from, to) {
  var key = getMetalsKey();
  return fetch('https://api.metals.dev/v1/timeseries?api_key=' + encodeURIComponent(key) +
      '&start_date=' + from + '&end_date=' + to)
    .then(function(res) { return res.json(); })
    .then(function(json) {
      if (!json || json.status === 'failure') throw new Error((json && json.error_message) || 'request failed');
      var n = 0;
      Object.keys(json.rates || {}).forEach(function(d) {
        var v = _zincDayInrKg(json, json.rates[d]);
        if (v > 0) { _zincRememberLme(d, v); n++; }
      });
      return n;
    });
}

function zincDeriveUplift() {
  var out = document.getElementById('zincUpliftOut');
  var bills = zincUpliftBills();
  if (!bills.length) {
    if (out) out.innerHTML = '<div class="inv-text-muted inv-storage-text">No priced zinc bill on record. Add one under Stock &rarr; Zinc &rarr; Add its bill, or import past purchases.</div>';
    return Promise.resolve(null);
  }
  var missing = bills.filter(function(b) { return !_zincLmeOn(b.date); });
  var fetching = Promise.resolve();
  var note = '';
  if (missing.length) {
    if (!getMetalsKey()) {
      note = missing.length + ' bill' + (missing.length === 1 ? ' has' : 's have') + ' no LME on record, and there is no metals.dev key to look it up.';
    } else {
      if (out) out.innerHTML = '<div class="inv-text-muted inv-storage-text">Looking up LME on ' + missing.length + ' bill date' + (missing.length === 1 ? '' : 's') + '&hellip;</div>';
      // One request per bill window: a window is five days, well inside any
      // range limit, and each answer is kept.
      fetching = missing.reduce(function(chain, b) {
        return chain.then(function() { return _zincFetchLme(_zincIsoAdd(b.date, -ZINC_LME_LOOKBACK), b.date); });
      }, Promise.resolve()).then(function() { saveState(); }, function(err) {
        note = 'metals.dev: ' + (err && err.message ? err.message : 'could not be reached') + '.';
      });
    }
  }
  return fetching.then(function() {
    var premEl = document.getElementById('setZincPremium');
    var prem = premEl && premEl.value !== '' ? parseFloat(premEl.value) : (getZinc().premiumPerKg || 0);
    if (isNaN(prem)) prem = 0;
    var rows = bills.map(function(b) {
      var lme = _zincLmeOn(b.date), mcx = b.price - prem;
      return { b: b, lme: lme, mcx: mcx, pct: lme ? (mcx / lme.rate - 1) * 100 : null };
    });
    var pcts = rows.filter(function(r) { return r.pct != null; }).map(function(r) { return r.pct; }).sort(function(a, b) { return a - b; });
    var med = null;
    if (pcts.length) med = pcts.length % 2 ? pcts[(pcts.length - 1) / 2] : (pcts[pcts.length / 2 - 1] + pcts[pcts.length / 2]) / 2;
    _zincDerived = { rows: rows, median: med, premium: prem };
    if (out) out.innerHTML = _zincDerivedHtml(_zincDerived, note);
    return _zincDerived;
  });
}

function _zincDerivedHtml(d, note) {
  var h = '<div class="inv-set-derive-rows">' + d.rows.map(function(r) {
    return '<div class="inv-set-derive-row"><span>' + escHtml(formatDate(r.b.date)) + (r.b.supplier ? ' &middot; ' + escHtml(r.b.supplier) : '') + '</span>' +
      '<span class="inv-mono">' + formatCurrency(r.b.price) + ' &minus; ' + formatCurrency(d.premium) + ' = ' + formatCurrency(r.mcx) +
      (r.lme ? ' vs LME ' + formatCurrency(r.lme.rate) + (r.lme.date !== r.b.date ? ' (' + escHtml(formatDate(r.lme.date)) + ')' : '') +
        ' &rarr; <strong>' + escHtml(formatNum(r.pct, 1)) + '%</strong>' : ' &middot; no LME for this date') + '</span></div>';
  }).join('') + '</div>';
  if (note) h += '<div class="inv-text-muted inv-storage-text">' + escHtml(note) + '</div>';
  if (d.median == null) return h + '<div class="inv-text-muted inv-storage-text">No bill could be set against LME, so nothing to offer.</div>';
  var n = d.rows.filter(function(r) { return r.pct != null; }).length;
  var pct = Math.round(d.median * 10) / 10;
  return h + '<div class="inv-set-derive-foot"><span>Median of ' + n + ' bill' + (n === 1 ? '' : 's') + ': <strong class="inv-mono">' + escHtml(formatNum(pct, 1)) + '%</strong>' +
    ' against ' + escHtml(formatNum(getZinc().upliftPct, 1)) + '% set</span>' +
    '<button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invZincUseUplift" data-pct="' + pct + '">Use ' + escHtml(formatNum(pct, 1)) + '%</button></div>';
}

/* Puts the figure in the field and marks the section unsaved: offered, not applied. */
function zincUseUplift(pct) {
  var el = document.getElementById('setZincUplift');
  if (!el) return;
  el.value = pct;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
