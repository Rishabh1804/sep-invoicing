/* ===== ZINC MARKET RATE =====

   Zinc is the largest bought-in input on the floor — ~26% of cost at ~425 kg
   a month. It is bought at the MCX rate plus a fixed supplier premium, so the
   landed rate moves with the market and a stale figure quietly distorts every
   cost-per-kg number downstream.

   The rate lives on S so it travels with export/import. The API key does not —
   it goes to localStorage under its own key, the same as the Gemini key the
   challan scanner uses, so a backup JSON never carries a credential. */

var ZINC_STALE_DAYS = 7;

function getZinc() {
  if (!S.zinc) S.zinc = { ratePerKg: null, premiumPerKg: 15, updatedAt: null, source: '' };
  if (S.zinc.premiumPerKg == null) S.zinc.premiumPerKg = 15;
  return S.zinc;
}

/* What a kilo actually costs landed: market rate plus the supplier premium. */
function zincLandedRate() {
  var z = getZinc();
  if (z.ratePerKg == null) return null;
  return gstRound(z.ratePerKg + (z.premiumPerKg || 0));
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
    el.innerHTML = '<div class="inv-card"><div class="inv-card-header">' +
      '<span class="inv-card-title">Zinc</span></div>' +
      '<div class="inv-text-muted inv-storage-text">No rate recorded. Set it in Settings, ' +
      'or add a metals.dev API key there to pull it from the market.</div></div>';
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
    '<div class="inv-text-right"><div class="inv-text-muted inv-stat-label">Market + premium</div>' +
    '<div class="inv-mono inv-zinc-breakdown">' + formatCurrency(z.ratePerKg) +
    ' + ' + formatCurrency(z.premiumPerKg || 0) + '</div></div></div>' +
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
      var rate = _extractZincRate(json);
      if (rate == null) {
        showToast('No zinc rate in response. Returned: ' + _describeShape(json), 'error');
        return;
      }
      var z = getZinc();
      z.ratePerKg = gstRound(rate);
      z.updatedAt = Date.now();
      z.source = 'metals.dev';
      saveState();
      renderZincCard();
      showToast('Zinc ' + formatCurrency(zincLandedRate()) + '/kg landed');
    })
    .catch(function(err) {
      showToast('Could not reach metals.dev: ' + (err && err.message ? err.message : 'network error'), 'error');
    });
}

function _extractZincRate(json) {
  var buckets = [json.metals, json.rates, json.data, json];
  var names = ['zinc', 'Zinc', 'ZINC', 'lme_zinc', 'mcx_zinc'];
  for (var b = 0; b < buckets.length; b++) {
    var bucket = buckets[b];
    if (!bucket || typeof bucket !== 'object') continue;
    for (var n = 0; n < names.length; n++) {
      var v = bucket[names[n]];
      if (typeof v === 'number' && isFinite(v) && v > 0) return v;
      if (v && typeof v === 'object' && typeof v.price === 'number' && v.price > 0) return v.price;
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
