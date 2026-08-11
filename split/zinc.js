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
