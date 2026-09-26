/* ===== APPEARANCE: theme, palette, density (design system v2.0 §3.2, §3.5, §3.11) ===== */
/* Appearance is a fact about the device, never about the books: it lives in localStorage and an
   imported backup cannot repaint the phone. head.html applies theme and palette before first paint;
   this module owns everything after that — density, theme-color and the icon. Nothing sets a `.dark`
   class: colour-scheme alone decides every light-dark() token. */

var APPEARANCE_KEYS = { theme: 'sep_inv_theme', palette: 'sep_inv_palette', density: 'sep_inv_density' };
var APPEARANCE_OPTS = {
  theme: [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']],
  palette: [['teal', 'Teal'], ['zinc', 'Zinc & brass'], ['terracotta', 'Terracotta']],
  density: [['auto', 'Auto'], ['comfortable', 'Comfortable'], ['compact', 'Compact']]
};
var _darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function appearanceGet(k) {
  var def = APPEARANCE_OPTS[k][0][0], v = null;
  try { v = localStorage.getItem(APPEARANCE_KEYS[k]); } catch (e) { /* private window: defaults */ }
  return APPEARANCE_OPTS[k].some(function(o) { return o[0] === v; }) ? v : def;
}

function appearanceSet(k, v) {
  if (!APPEARANCE_OPTS[k] || !APPEARANCE_OPTS[k].some(function(o) { return o[0] === v; })) return;
  try {
    if (v === APPEARANCE_OPTS[k][0][0]) localStorage.removeItem(APPEARANCE_KEYS[k]);
    else localStorage.setItem(APPEARANCE_KEYS[k], v);
  } catch (e) { /* still applied for this session */ }
  applyAppearance(k === 'theme' ? v : null, k === 'palette' ? v : null, k === 'density' ? v : null);
}

function appearanceIsDark() {
  var t = document.documentElement.dataset.theme;
  return t === 'dark' || (!t && !!(_darkQuery && _darkQuery.matches));
}

/* Arguments override what storage says, so a device that refuses storage still switches. */
function applyAppearance(theme, palette, density) {
  var d = document.documentElement;
  var t = theme || appearanceGet('theme'), p = palette || appearanceGet('palette'), n = density || appearanceGet('density');
  if (t === 'system') delete d.dataset.theme; else d.dataset.theme = t;
  d.dataset.palette = p;
  var desk = !!(document.body && document.body.classList.contains('inv-desktop'));
  d.dataset.density = n === 'compact' || (n === 'auto' && desk) ? 'compact' : 'comfortable';
  var icon = document.getElementById('appIcon');
  if (icon) icon.setAttribute('href', 'icons/icon-' + p + '.svg');
  var touch = document.getElementById('appTouchIcon');
  if (touch) touch.setAttribute('href', 'icons/icon-' + p + '-192.png');
  // The system bar matches the top bar: read the resolved colour rather than restating the palette.
  var meta = document.querySelector('meta[name="theme-color"]');
  var bar = document.querySelector('.inv-topbar') || document.body;
  if (meta && bar) meta.setAttribute('content', _cssColorHex(getComputedStyle(bar).backgroundColor));
}

function _cssColorHex(c) {
  var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
  if (!m) return '#f8fafa';
  return '#' + [m[1], m[2], m[3]].map(function(n) { return ('0' + (+n).toString(16)).slice(-2); }).join('');
}

if (_darkQuery) {
  var _onScheme = function() { if (!document.documentElement.dataset.theme) applyAppearance(); };
  if (_darkQuery.addEventListener) _darkQuery.addEventListener('change', _onScheme);
  else if (_darkQuery.addListener) _darkQuery.addListener(_onScheme);
}

function appearanceSummary() {
  function label(k) { var v = appearanceGet(k); return APPEARANCE_OPTS[k].find(function(o) { return o[0] === v; })[1]; }
  var t = appearanceGet('theme'), n = appearanceGet('density');
  return escHtml(label('palette')) + ' &middot; ' + (t === 'system' ? 'follows the phone' : escHtml(label('theme')).toLowerCase()) +
    ' &middot; ' + (n === 'auto' ? 'compact on desktop' : escHtml(label('density')).toLowerCase());
}

function appearanceFieldsHtml() {
  function seg(k, title) {
    var cur = appearanceGet(k);
    return '<div class="inv-form-group"><span class="inv-form-label">' + title + '</span>' +
      '<div class="inv-seg" role="group" aria-label="' + title + '">' + APPEARANCE_OPTS[k].map(function(o) {
        return '<button type="button" class="inv-seg-btn" data-action="invAppearance" data-k="' + k + '" data-v="' + o[0] + '" aria-pressed="' + (o[0] === cur) + '">' + escHtml(o[1]) + '</button>';
      }).join('') + '</div></div>';
  }
  return seg('palette', 'Palette') + seg('theme', 'Theme') + seg('density', 'Density');
}

/* Settings → Appearance applies at once: appearance needs no Save. */
function appearancePick(k, v) {
  appearanceSet(k, v);
  document.querySelectorAll('.inv-seg-btn[data-k="' + k + '"]').forEach(function(b) {
    b.setAttribute('aria-pressed', String(b.dataset.v === v));
  });
  var sum = document.querySelector('[data-sum="appearance"]');
  if (sum) sum.innerHTML = appearanceSummary();
}

applyAppearance();
