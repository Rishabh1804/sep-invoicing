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
    items: ITEMS_MASTER.map(i => ({id:i.id,partNumber:i.p,desc:i.d,hsn:i.h,unit:i.u,rate:i.r,stdWeightKg:null})),
    partWeights: {},
    incomingMaterial: [],
    invoices: [],
    defaultCostPerKg: 5.46
  };
}

function loadJSON(key, fallback) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; }
  catch(e) { return fallback; }
}
function saveJSON(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) { showToast('Storage full! Export data.','error'); }
}

let S = loadJSON(STORAGE_KEY, null);
if (!S) { S = getDefaultState(); saveJSON(STORAGE_KEY, S); }
// Ensure arrays exist
if (!S.invoices) S.invoices = [];
if (!S.incomingMaterial) S.incomingMaterial = [];
if (!S.partWeights) S.partWeights = {};

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

// Phase 3: Reset invNextNum if no invoices exist
if (S.invoices.length === 0) {
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

