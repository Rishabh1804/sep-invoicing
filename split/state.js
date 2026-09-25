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
    // accepted duplicate. One recorded block already needs it (W33 Tue 11
    // Aug): the rule does not reproduce it, and that has to be precedent in
    // the system rather than a line in a document. (W31 Mon 27 Jul was named
    // here too, and is struck — tagged in the raw relay, under-booked, and
    // under-booking is never an error.)
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
    // Rate matcher thresholds (option E): Check at ≥ pct% off OR ≥ ₹stake on the line.
    rateCheck: { pct: 10, stake: 100, weightTol: 3 },
    // Chemical stock: lines, the events that move them, and each pasted
    // message whole. Ships empty — the lines arrive with the first message.
    stock: { items: [], entries: [], pastes: [] },
    // Days of cover at which a line turns red / amber, and the cost model's
    // chemicals figure the measured one is reported against.
    stockCheck: { redDays: 3, amberDays: 7, chemModel: 1.57 },
    // The owner's to-do list: typed tasks (ticked, never deleted) and the
    // snoozes granted to app-raised ones, each against the figures it saw.
    todo: { tasks: [], snoozes: {} },
    // Every attendance roll pasted in, whole, with a fingerprint so the same
    // roll twice is refused (it would count every hour twice).
    relayPastes: [],
    // Payments and advances made to workers, voided with a reason, never deleted.
    staffPayments: [],
    // Which rules may raise a task, and their day thresholds.
    todoCheck: { stock: true, paste: true, cn: true, challan: true, dispatch: true, audit: true,
      backup: true, zinc: false, pasteDays: 2, challanDays: 5, dispatchDays: 2, backupDays: 7 },
    // Full cost per kg, rebuilt from owner-supplied inputs against Apr–Jul 2026
    // actuals. The old 5.46 predated that rebuild and flattered every margin
    // figure by roughly a rupee a kilo. Only ever the default for a fresh
    // install — an existing configured value is never overwritten.
    defaultCostPerKg: 8.55
  };
}

/* ===== STORAGE LAYER =====
   IndexedDB is the system of record. localStorage keeps only the small
   per-device entries — credentials, the sync position, view prefs.

   Why it moved: localStorage quota is per ORIGIN, and every GitHub Pages
   project under this account is served from rishabh1804.github.io. A phone
   running Chrome 152 refused 128K more characters beside a 1.67M state on an
   engine that takes 5.1M in a single value, because the sister apps held the
   rest of the pool. Nothing this app could do to its own key would fix that.
   IndexedDB has its own quota, sized from the disk, and it is not shared
   through a 5M-character keyhole.

   What is kept from the localStorage era, on purpose: the state is still ONE
   JSON string, written whole and READ BACK after every write. A phone held a
   12 Aug copy for four weeks while every import since reported "Data
   imported" — the save caught every browser error as "Storage full!", the
   import's own success toast replaced that toast in the same tick, and nothing
   read the value back. Three silences. A store that cannot prove a write
   landed is not a store.

   The legacy localStorage copy is migrated on the first boot that finds the
   new store empty, and REMOVED once a verified write has landed in IndexedDB —
   that removal is what hands the shared pool back to the other two apps. */
var IDB_NAME = 'sep-invoicing';
var IDB_STORE = 'state';
var IDB_KEY = 'current';
var _idb = null;
var _idbFailed = false;            // open refused: this browser gets the localStorage path
var _storeMode = 'unknown';        // 'idb' | 'localStorage', settled by loadState()
var _loadedFrom = 'none';          // 'idb' | 'legacy' | 'none'
var _legacyKeyPresent = false;
var _persistRequested = false;
var _storageHealth = { lastSaveOk: null, lastSaveAt: 0, lastSaveChars: 0, lastError: '', readError: '' };

function describeStorageError(e) {
  if (!e) return 'Error';
  if (e.name === 'NotPersisted') return e.message;
  var name = e.name || 'Error';
  return e.message ? name + ': ' + e.message : name;
}
function notPersisted(msg) { var e = new Error(msg); e.name = 'NotPersisted'; return e; }

function idbOpen() {
  if (_idb) return Promise.resolve(_idb);
  if (_idbFailed || typeof indexedDB === 'undefined') { _idbFailed = true; return Promise.resolve(null); }
  return new Promise(function(resolve) {
    var req;
    try { req = indexedDB.open(IDB_NAME, 1); }
    catch (e) { _idbFailed = true; resolve(null); return; }
    req.onupgradeneeded = function() { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = function() {
      _idb = req.result;
      // Another tab deleting or upgrading the database asks us to let go.
      _idb.onversionchange = function() { try { _idb.close(); } catch (e) {} _idb = null; };
      resolve(_idb);
    };
    req.onerror = function() { _idbFailed = true; resolve(null); };
    req.onblocked = function() { _idbFailed = true; resolve(null); };
  });
}

function idbGetRaw() {
  return idbOpen().then(function(db) {
    if (!db) return null;
    return new Promise(function(resolve, reject) {
      try {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = function() { resolve(typeof req.result === 'string' ? req.result : null); };
        req.onerror = function() { reject(req.error); };
        tx.onabort = function() { reject(tx.error || new Error('read transaction aborted')); };
      } catch (e) { reject(e); }
    });
  });
}

function idbPutRaw(str) {
  return idbOpen().then(function(db) {
    if (!db) throw new DOMException('IndexedDB unavailable', 'InvalidStateError');
    return new Promise(function(resolve, reject) {
      try {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        var req = tx.objectStore(IDB_STORE).put(str, IDB_KEY);
        req.onerror = function() { reject(req.error); };
        tx.oncomplete = function() { resolve(); };
        tx.onabort = function() { reject(tx.error || req.error || new Error('write transaction aborted')); };
      } catch (e) { reject(e); }
    });
  });
}

// The small per-device keys stay in localStorage, verified the same way.
function lsPutVerified(key, str) {
  localStorage.setItem(key, str);
  var back = localStorage.getItem(key);
  if (back === null || back.length !== str.length) {
    throw notPersisted('write not persisted (read back ' + (back === null ? 'nothing' : back.length + ' of ' + str.length + ' chars') + ')');
  }
}

// The raw stored state, wherever this browser keeps it. Diagnostics and the
// test suite read through here rather than knowing which store is in use.
function readPersistedStateRaw() {
  if (_storeMode === 'localStorage') {
    return new Promise(function(resolve, reject) {
      try { resolve(localStorage.getItem(STORAGE_KEY)); } catch (e) { reject(e); }
    });
  }
  return idbGetRaw();
}

// Write and read back; resolves only when the stored copy is whole.
function writePersistedStateRaw(str) {
  if (_storeMode === 'localStorage') {
    return new Promise(function(resolve, reject) {
      try { lsPutVerified(STORAGE_KEY, str); resolve(); } catch (e) { reject(e); }
    });
  }
  return idbPutRaw(str).then(idbGetRaw).then(function(back) {
    if (back === null || back.length !== str.length) {
      throw notPersisted('write not persisted (read back ' + (back === null ? 'nothing' : back.length + ' of ' + str.length + ' chars') + ')');
    }
  });
}

function legacyRaw() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    _legacyKeyPresent = raw != null;
    return raw;
  } catch (e) {
    _storageHealth.readError = describeStorageError(e);
    return null;
  }
}

// Resolves to the parsed state or null. Sets _storeMode and _loadedFrom.
function loadState() {
  return idbGetRaw().then(function(raw) {
    if (_idbFailed) { _storeMode = 'localStorage'; var lr = legacyRaw(); _loadedFrom = lr != null ? 'legacy' : 'none'; return lr; }
    _storeMode = 'idb';
    // Note whether the pre-IndexedDB copy is still occupying the shared pool,
    // so a verified write can hand that space back.
    try { _legacyKeyPresent = localStorage.getItem(STORAGE_KEY) != null; } catch (e) {}
    if (raw != null) { _loadedFrom = 'idb'; return raw; }
    var legacy = legacyRaw();
    _loadedFrom = legacy != null ? 'legacy' : 'none';
    return legacy;
  }, function(e) {
    // The store exists but would not read. Nothing is written over it at boot.
    _storeMode = 'idb';
    _storageHealth.readError = describeStorageError(e);
    return null;
  }).then(function(raw) {
    if (raw == null) return null;
    try { return JSON.parse(raw); }
    catch (e) {
      _storageHealth.readError = 'stored copy does not parse (' + describeStorageError(e) + ')';
      return null;
    }
  });
}

/* Writes are coalesced and serialised. A call while a write is queued shares
   that write; a call while one is in flight queues exactly one more. The
   state is serialised when the write STARTS, so the last write always carries
   the latest S — which is what makes adoptState's rollback sound: after
   `S = prev`, the queued write is prev, whatever a half-migrated write in
   flight was carrying. */
var _persistChain = Promise.resolve(true);
var _persistQueued = null;

function persistState() {
  // A copy that exists but would not read is never written over: seeding a
  // default book on top of it would turn an unreadable copy into a lost one.
  // The boot banner says so; every save this session reports false.
  if (_storageHealth.readError) {
    _storageHealth.lastSaveOk = false;
    _storageHealth.lastSaveAt = Date.now();
    _storageHealth.lastError = 'not written: the stored copy could not be read (' + _storageHealth.readError + ')';
    return Promise.resolve(false);
  }
  if (_persistQueued) return _persistQueued;
  var queued = _persistChain.then(function() {
    _persistQueued = null;
    return writeStateNow();
  });
  _persistQueued = queued;
  _persistChain = queued.then(null, function() { return false; });
  return queued;
}

function writeStateNow() {
  var str;
  try { str = JSON.stringify(S); }
  catch (e) { return Promise.resolve(noteSaveFailure(STORAGE_KEY, describeStorageError(e))); }
  return writePersistedStateRaw(str).then(function() {
    _storageHealth.lastSaveOk = true;
    _storageHealth.lastSaveAt = Date.now();
    _storageHealth.lastSaveChars = str.length;
    _storageHealth.lastError = '';
    hideStorageBanner();
    if (_storeMode === 'idb' && _legacyKeyPresent) {
      // A verified copy is in the new store: hand the shared pool back.
      try { localStorage.removeItem(STORAGE_KEY); _legacyKeyPresent = false; } catch (e) {}
    }
    requestPersistentStorage();
    return true;
  }, function(e) {
    return noteSaveFailure(STORAGE_KEY, describeStorageError(e));
  });
}

// IndexedDB, unlike localStorage, can be evicted under storage pressure unless
// the origin holds persistent storage. Chrome grants it silently to an
// installed app or a site with engagement; asking costs nothing.
function requestPersistentStorage() {
  if (_persistRequested) return;
  _persistRequested = true;
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(null, function() {});
  } catch (e) {}
}

function loadJSON(key, fallback) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; }
  catch(e) { return fallback; }
}

// For STORAGE_KEY: a Promise<boolean> that resolves once the write is verified
// on disk (data is always S). For the small keys: a boolean, synchronously.
function saveJSON(key, data) {
  if (key === STORAGE_KEY) return persistState();
  try { lsPutVerified(key, JSON.stringify(data)); return true; }
  catch (e) { return noteSaveFailure(key, describeStorageError(e)); }
}

function noteSaveFailure(key, why) {
  if (key === STORAGE_KEY) {
    _storageHealth.lastSaveOk = false;
    _storageHealth.lastSaveAt = Date.now();
    _storageHealth.lastError = why;
    showStorageBanner('This browser did not keep the last save (' + why + '). ' +
      'Anything entered now is in memory only and will be lost on reload. Export a backup.');
  } else {
    showToast('Could not save ' + key + ' (' + why + ')', 'error');
  }
  return false;
}

// kind: 'save' (cleared by the next save that lands) or 'read' (a fact about
// this load; stays for the session).
function showStorageBanner(msg, kind) {
  kind = kind || 'save';
  hideStorageBanner(kind);
  var bar = document.createElement('div');
  bar.className = 'inv-storage-bar';
  bar.dataset.kind = kind;
  bar.setAttribute('role', 'alert');
  bar.innerHTML = '<span class="inv-update-text">' + escHtml(msg) + '</span>' +
    '<span class="inv-update-actions">' +
    '<button class="inv-btn inv-btn-primary inv-update-btn" data-action="invExportData">Export JSON</button></span>';
  document.body.appendChild(bar);
}
function hideStorageBanner(kind) {
  kind = kind || 'save';
  document.querySelectorAll('.inv-storage-bar').forEach(function(b) { if (b.dataset.kind === kind) b.remove(); });
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
  'voidedNumbers', 'creditNotes', 'extraExceptions', 'staff', 'attendance', 'areaTargets', 'stock', 'todo', 'relayPastes', 'staffPayments'];
// Config objects are the opposite: a missing one is filled from the defaults,
// and so is a missing KEY inside one. `labourCfg()` reads `extraRate || 0`, so
// a backup predating a constant would silently price the extra at nothing
// rather than at ₹47.50 — a wrong number, not a visible gap.
var STATE_CONFIGS = ['labour', 'rateCheck', 'stockCheck', 'todoCheck'];

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
  // The rollback has to cover STORAGE, not just memory. `migrateState()`
  // persists as it runs, and every one of those writes fires while `S` is the
  // incoming state — so a throw partway through used to leave a half-migrated
  // foreign state on disk with the old one restored in memory: the toast said
  // "Invalid file", the operator carried on, and the NEXT RELOAD opened someone
  // else's books. Writes are now serialised and read S when they START, so the
  // write queued after `S = prev` carries prev and is the last one to land.
  try {
    S = next;
    ensureStateShape(S);
    migrateState();
  } catch (e) {
    S = prev;
    persistState();
    throw e;
  }
  return S;
}

/* S is assigned by bootState() once loadState() resolves — see the end of
   init.js. Nothing between here and there may read it at load time. */
let S = null;

function bootState(loaded) {
  var stored = loaded != null;
  S = stored ? loaded : getDefaultState();
  ensureStateShape(S);
  resetSeriesIfEmpty();
  // A fresh device gets its default on disk; a legacy copy is migrated into
  // the new store. A copy that exists but would not read is never written
  // over at boot — the banner says so instead.
  if (_loadedFrom !== 'idb' && !_storageHealth.readError) persistState();
}

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
function resetSeriesIfEmpty() {
  if (S.invoices.length === 0 && !S.voidedNumbers.some(function(v) { return v.reserved; })) {
    S.invNextNum = 1;
    saveJSON(STORAGE_KEY, S);
  }
}

// Phase 3: Load filter persistence
let regFilter = loadJSON(VIEW_PREFS_KEY, null);
if (!regFilter) {
  const now = new Date();
  regFilter = { clientId: '', month: now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0'), search: '', state: '' };
}
if (!regFilter.state) regFilter.state = regFilter.state || '';

// Returns a Promise<boolean>: true once the write is verified on disk.
function saveState() {
  var landed = persistState();
  _tabDirty.home = true;
  _tabDirty.register = true;
  // Opt-in GitHub backup. Debounced inside, so this fires far more often than
  // it pushes. Guarded because state.js loads before github-sync.js.
  if (typeof ghNotifyChange === 'function') ghNotifyChange();
  // The Windows widget reads a payload of its own; refreshed behind the save.
  if (typeof todoWidgetSchedule === 'function') todoWidgetSchedule();
  return landed;
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


/* ===== PIECE RATES ON RECORD =====

   A piece-billed client's rate card lived nowhere the app could read it. The
   Items Master carries one `rate` per part with no client and no date, and the
   2026-09-11 replay found it disagreeing with 185 of SSS Mehta's billed lines —
   mostly because the customer's rate moved and the master did not (150X88X3:
   billed 1.67 on every line since April, master 1.64), and in three rows because
   the ₹/kg figure had been typed into the per-piece field.

   So the rate a piece line is checked against is the CLIENT's, dated, and keyed
   on part AND gauge: four clamp families (five, counting 154X81) are priced
   differently at different gauges under one part number, and a gauge-blind key
   reads a correct 40X6 line as wrong against the 35X6 rate.

   Deliberately NOT an `itemRates` override. An override is a negotiated
   per-piece figure with no weight basis, and Stats and weight derivation refuse
   to invert one — putting SSS Mehta's card there would wipe 61% of the plant's
   tonnage off the dashboard. These rates were built as weight × ₹/kg, and the
   tonnage paths keep reading the line the way they always have. */
function rateKey(s) {
  return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/* The strip gauge a line's description states — "CLAMP (40X6)", "35X6" — or ''.
   Two digits, X, one digit, standing alone: a gauge is the strip section, and
   the anchoring is what stops "L.C.Pad 150x80x3" (a part size) reading as one. */
function lineGauge(desc) {
  var m = /(?:^|[^0-9A-Z])(\d{2})\s*X\s*(\d)(?![0-9X])/i.exec(String(desc || ''));
  return m ? m[1] + 'X' + m[2] : '';
}

/* The per-piece rate on record for a line, or null when there is none.
   `{ambiguous: true}` when the part is priced by gauge and the line does not
   say which gauge it is — reported, never resolved by picking one. */
/* One lookup over a client's card — piece rates and piece weights share it:
   same part key, same gauge rule, same dating. Returns the row, `{ambiguous}`,
   or null. */
function cardLookup(list, onDate, partNumber, desc) {
  var pk = rateKey(partNumber);
  if (!pk || !list || list.length === 0) return null;
  var date = onDate || localDateStr();
  var rows = list.filter(function(r) {
    return rateKey(r.partNumber) === pk && (!r.effectiveFrom || r.effectiveFrom <= date);
  });
  if (rows.length === 0) return null;
  // The gauge is folded into the line's description (partLineDesc); some part
  // numbers carry it too ("CLAMP 165X83(40X6)").
  var lg = lineGauge(desc) || lineGauge(partNumber);
  var gauged = rows.filter(function(r) { return r.gauge && lg && rateKey(r.gauge) === lg; });
  var pool = gauged.length ? gauged : rows.filter(function(r) { return !r.gauge; });
  if (pool.length === 0) return { ambiguous: true };
  var gauges = {};
  pool.forEach(function(r) { gauges[rateKey(r.gauge)] = true; });
  if (Object.keys(gauges).length > 1) return { ambiguous: true };
  pool.sort(function(a, b) { return String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')); });
  return pool[0];
}

function getPieceRate(client, onDate, partNumber, desc) {
  var hit = client ? cardLookup(client.pieceRates, onDate, partNumber, desc) : null;
  if (!hit) return null;
  if (hit.ambiguous) return { ambiguous: true, rate: null };
  return { rate: hit.rate, effectiveFrom: hit.effectiveFrom || '', gauge: hit.gauge || '' };
}

/* ===== WEIGHT PER PIECE ON RECORD =====

   A KG-billed client's challan states pieces AND kilograms (Dorabji's carries
   both columns), so a weight per piece on record checks the kilograms the way
   the rate card checks the rate. Replayed over the 11 Sep backup's 1,068 KG
   lines that carry a piece count: half sit within 0.4% of their own client's
   median, three quarters within 2.3% — and two are a power of ten out
   (00830: 33 pcs billed as 150.27 kg against 0.448 kg/pc; 00086: 500 pcs as
   10.4 kg against 0.212), ₹3,000 between them.

   The CLIENT's figure, never the Items Master's. The master has one row per
   part name and no client: Khetan's BASE PLATE weighs ~0.70 kg a piece on every
   line and the master says 0.053, because General Engineering sends a part of
   the same name. Kept in kilograms to four places — a weight, not currency. */
function getPieceWeight(client, onDate, partNumber, desc) {
  var hit = client ? cardLookup(client.pieceWeights, onDate, partNumber, desc) : null;
  if (!hit) return null;
  if (hit.ambiguous) return { ambiguous: true, kg: null };
  return { kg: hit.kgPerPiece, effectiveFrom: hit.effectiveFrom || '', gauge: hit.gauge || '' };
}

/* The one place a line's rate on record is read: override, then the client's
   piece rate for a NOS line, then the ₹/kg ladder. `unit` says which the figure
   is — comparing a piece rate against a ₹/kg one is the error the Items Master
   rows carrying 5.40 made, and a caller must be able to refuse it. */
function getRateOnRecord(client, onDate, item) {
  if (!client || !item) return null;
  var date = onDate || localDateStr();
  var info = getLineItemRate(client, date, item.partNumber);
  if (info._override) return { rate: info.rate, unit: 'piece', source: 'override' };
  if (item.unit === 'NOS') {
    var pr = getPieceRate(client, date, item.partNumber, item.desc);
    if (pr && pr.ambiguous) return { rate: null, unit: 'piece', source: 'gauge-ambiguous' };
    if (pr) return { rate: pr.rate, unit: 'piece', source: 'pieceRate', effectiveFrom: pr.effectiveFrom };
    // Only a nos_to_weight line with a weight on record is priced per kg. Any
    // other NOS line carries a per-piece figure, and the ₹/kg ladder is not a
    // reference for it (Parakh's ROLLER at ₹1.10/pc is not "off" from ₹10/kg).
    var w = (S.partWeights || {})[(item.partNumber || '').toUpperCase()];
    if (client.billingMode !== 'nos_to_weight' || !w) return null;
  }
  return info.ratePerKg > 0 ? { rate: info.ratePerKg, unit: 'kg', source: 'ladder' } : null;
}

/* ===== BILLED AT ₹0 =====

   A line billed at nothing is a decision, not an absence of one, and the
   history carried 25 of them — 1,192.54 kg, ₹16,355.67 at the client's own
   rate — with nothing on any of them saying why. The owner ruled (24 Sep 2026)
   that they are replating: work returned for re-plating is not billed twice.
   From now a ₹0 line carries its reason. The note is recommended, never
   required — a picker the operator can clear in one tap gets filled in; a
   mandatory essay gets "ok". */
var ZERO_REASONS = [
  { id: 'replating', label: 'Replating' },
  { id: 'sample', label: 'Sample / trial' },
  { id: 'other', label: 'Other' }
];

function zeroReasonLabel(id) {
  var r = ZERO_REASONS.find(function(x) { return x.id === id; });
  return r ? r.label : '';
}

/* A line that is billing something and billing it at ₹0. A blank line still
   being typed (no quantity) is not one. */
function isZeroBilledLine(item) {
  return !!item && (item.qty || 0) > 0 && !((item.amount || 0) > 0);
}

/* The rate a line is PREFILLED with when its part or client is chosen. A NOS
   line used to be handed the ₹/kg figure (SSS Mehta's 5.40 against a ₹1.49
   pad; Samarth's 14.50 against a ₹3 bracket), which is exactly the unit error
   the replay found typed into the Items Master. */
function defaultLineRate(client, onDate, item) {
  var info = getLineItemRate(client, onDate, item.partNumber);
  if (info._override) return info.rate;
  if (item.unit === 'NOS') {
    var pr = getPieceRate(client, onDate, item.partNumber, item.desc);
    if (pr && pr.rate != null) return pr.rate;
  }
  return info.ratePerKg || 0;
}

/* How a line names its part on screen. `desc` used to win outright, and for a
   piece client desc is often only the gauge ("40X6") or a word ("CLAMP") — so
   the invoice detail and the challan list showed which strip, never which part.
   The part number leads; the description follows when it adds something. */
function lineLabel(item) {
  if (!item) return '';
  var pn = String(item.partNumber || '').trim();
  var d = String(item.desc || '').trim();
  if (!pn) return d;
  if (!d || rateKey(pn).indexOf(rateKey(d)) >= 0) return pn;
  if (rateKey(d).indexOf(rateKey(pn)) >= 0) return d;
  return pn + ' · ' + d;
}

/* ===== RATE MATCHER =====

   Every line's rate against the rate on record (getRateOnRecord). The rule was
   chosen by the owner (24 Sep 2026, option E) after five candidates were
   replayed over the 11 Sep backup's 2,835 lines:

     match    — equal to the paisa
     decimal  — off by a power of ten, within 2% (₹1.49 typed as ₹14.90);
                checked before any threshold, because it is a typing slip with
                its own obvious fix
     check    — ≥ 10% off, OR ≥ ₹100 at stake on this line. The percentage
                catches a wrong rate whatever the quantity; the rupee floor
                catches the small slip on a big line (00684: 8% low, ₹119.60
                short across 920 pieces), which a percentage alone let through
     differs  — anything less, shown with its difference; nothing that differs
                goes unmarked (the owner's flat ₹0.50 as first written left 10
                of the 18 differing lines with no mark at all)
     none     — nothing on record to compare against; grey, never red
     gauge    — priced by gauge and the line does not say which

   Warn, never block — the same stance as the duplicate-challan guard. A rate
   that differs can be right (a renegotiated price not yet on the card); the
   matcher's job is that nobody bills it without having seen it. A ₹0 line is
   not judged here: it has its own required reason. */
var RATE_CHECK_DEFAULTS = { pct: 10, stake: 100, weightTol: 3 };
var STOCK_CHECK_DEFAULTS = { redDays: 3, amberDays: 7, chemModel: 1.57 };

/* The two thresholds, from Settings. Read on every judgement so a change in
   Settings re-colours the next line typed. A missing or nonsensical value falls
   back to the owner's ruling rather than to 0, which would turn every
   difference red. */
function rateCheckCfg() {
  var c = (S && S.rateCheck) || {};
  var pct = parseFloat(c.pct), stake = parseFloat(c.stake), tol = parseFloat(c.weightTol);
  return {
    pct: pct > 0 ? pct : RATE_CHECK_DEFAULTS.pct,
    stake: stake > 0 ? stake : RATE_CHECK_DEFAULTS.stake,
    // Weighing is not exact: a weight within this band of pieces × kg/pc
    // matches. 3% holds three quarters of history's lines (the median line is
    // 0.4% off) without hiding a real slip.
    weightTol: tol > 0 ? tol : RATE_CHECK_DEFAULTS.weightTol
  };
}

function rateMatch(client, onDate, item) {
  if (!client || !item) return null;
  var qty = item.qty || 0;
  var rate = item.rate || 0;
  if (!(qty > 0) || !(rate > 0)) return null;
  var ref = getRateOnRecord(client, onDate, item);
  if (!ref) return { status: 'none' };
  if (ref.rate == null) return { status: 'gauge' };
  var diff = gstRound(rate - ref.rate);
  // Quantity in the reference's own unit: a nos_to_weight line priced per kg
  // stakes the kilograms, not the pieces.
  var units = qty;
  if (ref.unit === 'kg' && item.unit === 'NOS') {
    units = qty * ((S.partWeights || {})[(item.partNumber || '').toUpperCase()] || 0);
  }
  var out = { ref: ref.rate, unit: ref.unit, source: ref.source, diff: diff,
    pct: Math.abs(diff) / ref.rate, stake: gstRound(diff * units) };
  if (Math.abs(diff) < 0.005) { out.status = 'match'; return out; }
  var k = Math.round(Math.log10(rate / ref.rate));
  if (k !== 0 && Math.abs(rate / (ref.rate * Math.pow(10, k)) - 1) < 0.02) { out.status = 'decimal'; return out; }
  var cfg = rateCheckCfg();
  out.status = (out.pct >= cfg.pct / 100 - 1e-9 || Math.abs(out.stake) >= cfg.stake - 1e-9) ? 'check' : 'differs';
  return out;
}

/* The kilograms on a KG line against pieces × the weight per piece on record.
   Same verdicts and the same Check thresholds as the rate, with two
   differences a scale forces: a band of ±weightTol% counts as a match, and a
   power-of-ten slip is allowed ±5% (a weighed figure is never exact). The
   stake is the kilograms off × the line's own rate. */
function weightMatch(client, onDate, item) {
  if (!client || !item || item.unit !== 'KG') return null;
  var pcs = item.nosQty || 0, kg = item.qty || 0;
  if (!(pcs > 0) || !(kg > 0)) return null;
  var w = getPieceWeight(client, onDate, item.partNumber, item.desc);
  if (!w) return { status: 'none' };
  if (w.ambiguous) return { status: 'gauge' };
  var expected = pcs * w.kg;
  var ratio = kg / expected;
  var out = { ref: w.kg, pcs: pcs, expected: Math.round(expected * 1000) / 1000,
    diff: Math.round((kg - expected) * 1000) / 1000, pct: Math.abs(ratio - 1),
    stake: gstRound((kg - expected) * (item.rate || 0)) };
  var cfg = rateCheckCfg();
  if (out.pct < cfg.weightTol / 100) { out.status = 'match'; return out; }
  var k = Math.round(Math.log10(ratio));
  if (k !== 0 && Math.abs(ratio / Math.pow(10, k) - 1) < 0.05) { out.status = 'decimal'; return out; }
  out.status = (out.pct >= cfg.pct / 100 - 1e-9 || Math.abs(out.stake) >= cfg.stake - 1e-9) ? 'check' : 'differs';
  return out;
}
