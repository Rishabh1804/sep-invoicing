/* ===== STATE ===== */
const STORAGE_KEY = 'sep_invoicing_state';

function getDefaultState() {
  return {
    company: {name:"SOMA ELECTRO PRODUCTS",add1:"8-B, 1st Phase,  Industrial Area, Adityapur",add2:"Jamshedpur - 832 109",add3:"",phone:"9431523950",mobile:"8271063224,9386780003",email:"soma_electro123@rediffmail.com",gstin:"20AAPFS4718J2Z0",state:"JHARKHAND",stateCode:"20"},
    bankDetails: "Bank - Bank Of Baroda, Jamshedpur Main Branch\nA/c No - 00190200000222\nIFSC : BARB0JAMSHE\nPlease Pay by A/c Payee Cheque",
    companyLogo: "",
    invPrefix: "SEP/2026-27/",
    invNextNum: 1,
    clients: SEED_CLIENTS,
    items: ITEMS_MASTER.map(i => ({id:i.id,partNumber:i.p,desc:i.d,gauge:i.g||'',hsn:i.h,unit:i.u,rate:i.r,stdWeightKg:null})),
    partWeights: {},
    incomingMaterial: [],
    invoices: [],
    voidedNumbers: [],
    // Credit notes run their own series (CN/005/26-27), separate from the
    // invoice series, because they are a separate document under GST.
    creditNotes: [],
    // Starts at 6: CN/001–005 of 2026-27 were issued by hand before the app
    // existed. See the _cnSeriesStart1 migration in init.js.
    cnNextNum: 6,
    // Reconciliation exceptions. A disagreement the extra-check raised and a
    // human then examined becomes a RECORD carrying a required reason — the
    // same treatment `voidedNumbers` gives a number gap and `dupeAck` gives an
    // accepted duplicate. Two recorded blocks already need it (W31 Mon 27 Jul,
    // W33 Tue 11 Aug): the rule does not reproduce them, and that has to be
    // precedent in the system rather than a line in a document.
    extraExceptions: [],
    // Workforce. The roster ships empty: names and wages are payroll data and
    // this repo is public, so the owner enters them once on the device. Areas
    // and comp classes are structure, not data, and live in staff.js.
    staff: [],
    // Expected heads per work area. Empty by default: a complement nobody set
    // is not a complement of zero, and the Areas view says so rather than
    // reporting every area as overstaffed on day one.
    areaTargets: {},
    // Attendance, keyed by ISO date. One entry per day the plant was recorded;
    // a day with no key is a day nobody typed, which is not the same fact as a
    // day nobody worked — labour coverage is stated on that distinction.
    attendance: {},
    // Wage arithmetic. `(days worked + rest credit) × ₹/day + OT × 1.1` is the
    // ratified monthly-tier rule; gateFull / gateHalf are the three-layer
    // attendance gate on its rest days. restCreditMinDays is the daily tier's
    // own weekly gate. The hourly pool needs none of them — every hour at one
    // rate. extraRate prices the area-booked "extra hours", which carry no name.
    labour: { otMult: 1.1, restCreditMinDays: 6, extraRate: 47.5, modelPerKg: 3.55, gateFull: 0.9, gateHalf: 0.8, extraHoursPerHead: 8 },
    // Full cost per kg, rebuilt from owner-supplied inputs against Apr–Jul 2026
    // actuals. The old 5.46 predated that rebuild and flattered every margin
    // figure by roughly a rupee a kilo. Only ever the default for a fresh
    // install — an existing configured value is never overwritten.
    defaultCostPerKg: 8.55
  };
}

function loadJSON(key, fallback) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; }
  catch(e) { return fallback; }
}
function saveJSON(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) { showToast('Storage full! Export data.','error'); }
}

/* Fill in every container a backup might predate.

   Three code paths replace the whole state — the loader below, ghPull, and
   Settings → Import — and each used to carry its own copy of this list. The
   loader's and ghPull's had already drifted apart once (four keys added to one
   and not the other, which is how a pull could land the app in a broken
   state), and Settings → Import carried NO repairs at all: a backup written
   before `staff` existed left it undefined and the Staff tab threw on open.

   So the list lives once, and it is read from `getDefaultState()` rather than
   restated, because a restated default is a default that will drift. Keys are
   only ever ADDED — an existing value, including a deliberate empty one, is
   never overwritten.

   `cnNextNum` is an existence guard only; init.js's `_cnSeriesStart1` lifts a
   series that has never issued anything to where it actually starts. */
// Containers hold the user's records, so a missing one is filled EMPTY — the
// app must never invent business data to repair a shape.
var STATE_CONTAINERS = ['clients', 'items', 'invoices', 'incomingMaterial', 'partWeights',
  'voidedNumbers', 'creditNotes', 'extraExceptions', 'staff', 'attendance', 'areaTargets'];
// Config objects are the opposite: a missing one is filled from the defaults,
// and so is a missing KEY inside one. `labourCfg()` reads `extraRate || 0`, so
// a backup predating a constant would silently price the extra at nothing
// rather than at ₹47.50 — a wrong number, not a visible gap.
var STATE_CONFIGS = ['labour'];

function ensureStateShape(s) {
  if (!s) return s;
  var d = getDefaultState();
  STATE_CONTAINERS.forEach(function(k) {
    if (!s[k]) s[k] = Array.isArray(d[k]) ? [] : {};
  });
  STATE_CONFIGS.forEach(function(k) {
    if (!s[k] || typeof s[k] !== 'object') { s[k] = d[k]; return; }
    Object.keys(d[k]).forEach(function(f) {
      if (s[k][f] == null) s[k][f] = d[k][f];
    });
  });
  if (!s.cnNextNum) s.cnNextNum = 1;
  return s;
}

/* Adopt a replacement state, or keep the one we have.

   `migrateState()` walks records written by another device, so it can throw on
   a shape nothing here anticipated — a challan with no `items`, say. Assigning
   `S` first and migrating after meant a throw left the app running on a
   half-migrated state that was never saved: the toast said "Invalid file" and
   the operator carried on, now looking at someone else's half-repaired books.

   So the swap is all-or-nothing. On a throw the previous state is restored and
   the error is re-raised for the caller to report. Nothing is persisted here —
   the caller saves once it knows the adoption held. */
function adoptState(next) {
  var prev = S;
  try {
    S = next;
    ensureStateShape(S);
    migrateState();
  } catch (e) {
    S = prev;
    throw e;
  }
  return S;
}

let S = loadJSON(STORAGE_KEY, null);
if (!S) { S = getDefaultState(); saveJSON(STORAGE_KEY, S); }
ensureStateShape(S);

/* ===== LAYOUT MODE (Phase 8A) ===== */
var _isDesktop = false;
var _isTablet = false;
var _pendingModeSwitch = false;
var _dragState = null;

/* ===== ARCHITECTURAL GLOBALS (Phase 3) ===== */
let _tabDirty = { home: true, register: true };
let _tabScroll = {};
let _navReturnTab = null;
let _regToolbarRendered = false;
let _regSearchTimer = null;
var _preselectedClientId = null;
const VIEW_PREFS_KEY = 'sep_inv_view_prefs';
const API_KEY_KEY = 'sep_inv_gemini_key';
const METALS_KEY_KEY = 'sep_inv_metals_key';

/* Phase 5: Focus stack (DP v0.2 Section 8 + Section 16) */
let _focusStack = [];

function pushFocus() {
  _focusStack.push(document.activeElement);
}

function popFocus() {
  if (_focusStack.length === 0) return;
  var el = _focusStack.pop();
  try { if (el && typeof el.focus === 'function') el.focus(); } catch(e) {}
}

function drainFocusStack() {
  _focusStack = [];
}

function focusFirstInteractive(container) {
  if (!container) return;
  var el = container.querySelector('button, input:not([type="hidden"]):not([readonly]), select, textarea, [tabindex]:not([tabindex="-1"])');
  if (el) { try { el.focus(); } catch(e) {} }
}

function getApiKey() { try { return localStorage.getItem(API_KEY_KEY) || ''; } catch(e) { return ''; } }
function setApiKey(key) { try { localStorage.setItem(API_KEY_KEY, key); } catch(e) {} }

/* Kept in localStorage rather than on S, so an exported backup never carries
   a credential. Same handling as the Gemini key above. */
function getMetalsKey() { try { return localStorage.getItem(METALS_KEY_KEY) || ''; } catch(e) { return ''; } }
function setMetalsKey(key) { try { localStorage.setItem(METALS_KEY_KEY, key); } catch(e) {} }

// Phase 3: Reset invNextNum if no invoices exist.
// A reserved number in the void ledger still holds its slot — the document
// left the building, so the number is spent even though no invoice remains.
if (S.invoices.length === 0 && !S.voidedNumbers.some(function(v) { return v.reserved; })) {
  S.invNextNum = 1;
  saveJSON(STORAGE_KEY, S);
}

// Phase 3: Load filter persistence
let regFilter = loadJSON(VIEW_PREFS_KEY, null);
if (!regFilter) {
  const now = new Date();
  regFilter = { clientId: '', month: now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0'), search: '', state: '' };
}
if (!regFilter.state) regFilter.state = regFilter.state || '';

function saveState() {
  saveJSON(STORAGE_KEY, S);
  _tabDirty.home = true;
  _tabDirty.register = true;
  // Opt-in GitHub backup. Debounced inside, so this fires far more often than
  // it pushes. Guarded because state.js loads before github-sync.js.
  if (typeof ghNotifyChange === 'function') ghNotifyChange();
}

function saveRegFilter() {
  saveJSON(VIEW_PREFS_KEY, regFilter);
}

/* ===== UTILITIES ===== */
function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatCurrency(n) {
  if (n == null || isNaN(n)) return '\u20B90';
  const neg = n < 0; n = Math.abs(n);
  const parts = n.toFixed(2).split('.');
  let int = parts[0], dec = parts[1];
  // Indian grouping
  if (int.length > 3) {
    const last3 = int.slice(-3);
    const rest = int.slice(0, -3);
    int = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return (neg ? '-' : '') + '\u20B9' + int + '.' + dec;
}

function localDateStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function gstRound(val) { return Math.round(val * 100) / 100; }

function formatNum(n, dec) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toFixed(dec != null ? dec : 2);
}

function formatDateExport(dateStr) {
  if (!dateStr) return '\u2014';
  const p = dateStr.split('-');
  if (p.length !== 3) return dateStr;
  return p[2] + '/' + p[1] + '/' + p[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  const p = dateStr.split('-');
  if (p.length !== 3) return dateStr;
  const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return p[2] + ' ' + (months[parseInt(p[1])] || '???') + ' ' + p[0];
}

function numberToWords(n) {
  if (n === 0) return 'Rupees Zero Only';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function convert(num) {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? ' ' + ones[num%10] : '');
    if (num < 1000) return ones[Math.floor(num/100)] + ' Hundred' + (num%100 ? ' ' + convert(num%100) : '');
    if (num < 100000) return convert(Math.floor(num/1000)) + ' Thousand' + (num%1000 ? ' ' + convert(num%1000) : '');
    if (num < 10000000) return convert(Math.floor(num/100000)) + ' Lakh' + (num%100000 ? ' ' + convert(num%100000) : '');
    return convert(Math.floor(num/10000000)) + ' Crore' + (num%10000000 ? ' ' + convert(num%10000000) : '');
  }
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  let result = '';
  if (rupees > 0) {
    result = 'Rupees ' + convert(rupees);
  } else if (paise > 0) {
    result = 'Rupees Zero';
  } else {
    return 'Rupees Zero Only';
  }
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
  return result + ' Only';
}

function showToast(msg, type='success') {
  // Single gateway: remove any existing toast first
  document.querySelectorAll('.inv-toast').forEach(t => t.remove());
  const dur = type === 'error' ? 4000 : type === 'warning' ? 3000 : 2000;
  const t = document.createElement('div');
  t.className = 'inv-toast inv-toast-' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), dur);
}

/* ===== INVOICE LIFECYCLE STATES (Phase 5) ===== */
var INV_STATES = ['created', 'dispatched', 'delivered', 'filed'];
var INV_STATE_LABELS = { created: 'Created', dispatched: 'Dispatched', delivered: 'Delivered', filed: 'Filed' };

function getInvState(inv) {
  return inv.invoiceState || 'created';
}

function getStateBadgeHtml(inv) {
  if (inv.status === 'cancelled') return '<span class="inv-cancelled-badge">Cancelled</span>';
  var state = getInvState(inv);
  return '<span class="inv-state-badge inv-state-' + state + '">' + escHtml(INV_STATE_LABELS[state] || state) + '</span>';
}

function advanceInvoiceState(invId) {
  var inv = S.invoices.find(function(i) { return i.id === invId; });
  if (!inv || inv.status === 'cancelled') return;
  var state = getInvState(inv);
  var idx = INV_STATES.indexOf(state);
  if (idx < 0 || idx >= INV_STATES.length - 1) return;
  var nextState = INV_STATES[idx + 1];
  inv.invoiceState = nextState;
  var now = Date.now();
  if (nextState === 'dispatched') inv.dispatchedAt = now;
  else if (nextState === 'delivered') inv.deliveredAt = now;
  else if (nextState === 'filed') inv.filedAt = now;
  saveState();
  closeOverlay();
  _renderRegView();
  showToast(inv.displayNumber + ' marked as ' + INV_STATE_LABELS[nextState]);
}

function bulkMarkFiled() {
  var filtered = getFilteredInvoices();
  var eligible = filtered.filter(function(inv) {
    return inv.status === 'active' && getInvState(inv) === 'delivered';
  });
  if (eligible.length === 0) {
    showToast('No delivered invoices to mark as filed', 'warning');
    return;
  }
  if (!confirm('Mark ' + eligible.length + ' delivered invoice' + (eligible.length > 1 ? 's' : '') + ' as filed?')) return;
  var now = Date.now();
  eligible.forEach(function(inv) {
    inv.invoiceState = 'filed';
    inv.filedAt = now;
  });
  saveState();
  _renderRegView();
  showToast(eligible.length + ' invoice' + (eligible.length > 1 ? 's' : '') + ' marked as filed');
}

function formatTimestamp(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return String(d.getDate()).padStart(2, '0') + ' ' + months[d.getMonth() + 1] + ' ' + d.getFullYear() +
    ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function getVehicleSuggestions(clientId) {
  if (!clientId) return '';
  var client = S.clients.find(function(c) { return c.id === clientId; });
  if (!client || !client.recentVehicles || client.recentVehicles.length === 0) return '';
  return client.recentVehicles.map(function(v) {
    return '<option value="' + escHtml(v) + '">';
  }).join('');
}

function saveVehicleToClient(clientId, vehicleNo) {
  if (!clientId || !vehicleNo) return;
  var v = vehicleNo.trim().toUpperCase();
  if (!v) return;
  var client = S.clients.find(function(c) { return c.id === clientId; });
  if (!client) return;
  if (!client.recentVehicles) client.recentVehicles = [];
  // Remove duplicate, push to front, cap at 10
  client.recentVehicles = client.recentVehicles.filter(function(x) { return x !== v; });
  client.recentVehicles.unshift(v);
  if (client.recentVehicles.length > 10) client.recentVehicles = client.recentVehicles.slice(0, 10);
}

/* ===== RATE LOOKUP ===== */
function getLineItemRate(client, invoiceDate, partNumber) {
  if (client.itemRates && client.itemRates.length > 0 && partNumber) {
    const override = client.itemRates.find(ir => partNumber.includes(ir.partPattern));
    if (override) return {rate: override.rate, unit: override.unit, _override: true, _label: override.label};
  }
  const applicable = (client.rates || [])
    .filter(r => r.effectiveFrom <= invoiceDate)
    .sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  if (applicable.length > 0) return applicable[0];
  const earliest = [...(client.rates || [])].sort((a,b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
  if (earliest) return {...earliest, _fallback: true};
  return {ratePerKg: 0, ratePerPiece: null, effectiveFrom: '2026-04-01'};
}

