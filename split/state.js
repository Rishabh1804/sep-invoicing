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
    shiftNeeds: {},
    // Attendance, keyed by ISO date. One entry per day the plant was recorded;
    // a day with no key is a day nobody typed, which is not the same fact as a
    // day nobody worked — labour coverage is stated on that distinction.
    attendance: {},
    // Wage arithmetic. `(days worked + rest credit) × ₹/day + OT × 1.1` is the
    // ratified monthly-tier rule; gateFull / gateHalf are the three-layer
    // attendance gate on its rest days. restCreditMinDays is the daily tier's
    // own weekly gate. The hourly pool needs none of them — every hour at one
    // rate. extraRate prices the area-booked "extra hours", which carry no name.
    labour: { otMult: 1.1, otCap: 68.2, otCapFrom: '2026-09-01', holidays: ['01-26', '08-15', '10-02'], restCreditMinDays: 6, extraRate: 47.5, modelPerKg: 3.55, gateFull: 0.9, gateHalf: 0.8, extraHoursPerHead: 8 },
    // Rate matcher thresholds (option E): Check at ≥ pct% off OR ≥ ₹stake on the line.
    rateCheck: { pct: 10, stake: 100, weightTol: 3 },
    invStateCheck: { createdAmber: 1, createdRed: 2, printedAmber: 1, printedRed: 2, dispatchedAmber: 3, dispatchedRed: 7, fileWarnDays: 3 },
    // Chemical stock: lines, the events that move them, and each pasted
    // message whole. Ships empty — the lines arrive with the first message.
    stock: { items: [], entries: [], pastes: [] },
    production: { entries: [], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } },
    // The bank statement as imported (bank.js): rows merged by id, and what the operator set.
    bank: { rows: [], imports: [], parties: {}, opening: {} },
    // Days of cover at which a line turns red / amber, and the cost model's
    // chemicals figure the measured one is reported against.
    stockCheck: { redDays: 3, amberDays: 7, chemModel: 1.57 },
    // The owner's to-do list: typed tasks (ticked, never deleted) and the
    // snoozes granted to app-raised ones, each against the figures it saw.
    todo: { tasks: [], snoozes: {} },
    // Every attendance roll pasted in, whole, with a fingerprint so the same
    // roll twice is refused (it would count every hour twice).
    relayPastes: [],
    relayLearn: { heads: {}, slots: {} },
    // Payments and advances made to workers, voided with a reason, never deleted.
    staffPayments: [],
    // Power and other monthly bills, for the live cost (voided, never deleted).
    costBills: [],
    payrollPaid: [],
    // Fallbacks the live cost uses only where nothing is recorded yet.
    costModel: { power: 0.81, other: 0.42, zincKgMonth: 425, zincPerKg: 2.21 },
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
// Set once this device's book has been read from or written to IndexedDB: a later open that fails is then a copy that
// would not read, never an empty device (loadState).
var IDB_USED_KEY = 'sep_inv_idb_used';
function idbHeldBook() { try { return localStorage.getItem(IDB_USED_KEY) === '1'; } catch (e) { return false; } }
function idbMarkHeld() { try { localStorage.setItem(IDB_USED_KEY, '1'); } catch (e) { /* a marker only */ } }
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

/* ===== THE VERSION GUARD (UX overhaul 2, step 2; owner, 28 Sep 2026: every screen opens in a new window, and
   windows may edit) =====
   Each window holds the whole book and saves it whole, so a second window used to overwrite the first one's save
   without a word: the installed app and a browser tab open side by side already did. So the saved copy carries a
   revision (`rev`, beside `current` in the same store), a window remembers the revision it last read or wrote
   (_diskRev), and a save is written only if the revision on disk is still that one: read and write happen in ONE
   IndexedDB transaction, which the browser runs one at a time across every window of the origin. A save from a
   window holding an older copy is refused (StaleCopy); the window loads the current copy and says so. After every
   save the other windows are told (BroadcastChannel) and load it at once, so a refusal is left for a true race or a
   window that slept through the message; one coming back into view checks the revision too. */
var IDB_REV_KEY = 'rev';
var LS_REV_KEY = 'sep_invoicing_rev';
var _diskRev = null;
function newRev() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
function staleCopy(rev) { var e = new Error('another window saved the book after this one loaded it'); e.name = 'StaleCopy'; e.rev = rev; return e; }

// The stored copy and its revision, read together: {raw, rev}.
function readStoredWithRev() {
  if (_storeMode === 'localStorage' || _idbFailed) {
    return new Promise(function(resolve, reject) {
      try { resolve({ raw: localStorage.getItem(STORAGE_KEY), rev: localStorage.getItem(LS_REV_KEY) }); } catch (e) { reject(e); }
    });
  }
  return idbOpen().then(function(db) {
    if (!db) return { raw: null, rev: null };
    return new Promise(function(resolve, reject) {
      try {
        var tx = db.transaction(IDB_STORE, 'readonly'), st = tx.objectStore(IDB_STORE), out = { raw: null, rev: null };
        st.get(IDB_KEY).onsuccess = function(ev) { out.raw = typeof ev.target.result === 'string' ? ev.target.result : null; };
        st.get(IDB_REV_KEY).onsuccess = function(ev) { out.rev = typeof ev.target.result === 'string' ? ev.target.result : null; };
        tx.oncomplete = function() { if (out.raw != null) idbMarkHeld(); resolve(out); };
        tx.onabort = function() { reject(tx.error || new Error('read transaction aborted')); };
        tx.onerror = function() { reject(tx.error); };
      } catch (e) { reject(e); }
    });
  });
}

// The revision on disk, without the book.
function readStoredRev() {
  if (_storeMode === 'localStorage' || _idbFailed) {
    return new Promise(function(resolve, reject) { try { resolve(localStorage.getItem(LS_REV_KEY)); } catch (e) { reject(e); } });
  }
  return idbOpen().then(function(db) {
    if (!db) return null;
    return new Promise(function(resolve, reject) {
      try {
        var req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_REV_KEY);
        req.onsuccess = function() { resolve(typeof req.result === 'string' ? req.result : null); };
        req.onerror = function() { reject(req.error); };
      } catch (e) { reject(e); }
    });
  });
}

// Writes the book only if the revision on disk is still `expect`; resolves once written, rejects StaleCopy if not.
function writeGuarded(str, expect, next) {
  if (_storeMode === 'localStorage') {
    return new Promise(function(resolve, reject) {
      try {
        var cur = localStorage.getItem(LS_REV_KEY);
        if ((cur || null) !== (expect || null)) { reject(staleCopy(cur)); return; }
        lsPutVerified(STORAGE_KEY, str);
        localStorage.setItem(LS_REV_KEY, next);
        resolve();
      } catch (e) { reject(e); }
    });
  }
  return idbOpen().then(function(db) {
    if (!db) throw new DOMException('IndexedDB unavailable', 'InvalidStateError');
    return new Promise(function(resolve, reject) {
      var stale = null, isStale = false, failed = null;
      try {
        var tx = db.transaction(IDB_STORE, 'readwrite'), st = tx.objectStore(IDB_STORE);
        var get = st.get(IDB_REV_KEY);
        get.onsuccess = function() {
          var cur = typeof get.result === 'string' ? get.result : null;
          if (cur !== (expect || null)) { isStale = true; stale = cur; tx.abort(); return; }
          // The browser's own error (QuotaExceededError …) is what the banner names, not the abort it causes.
          try {
            var put = st.put(str, IDB_KEY);
            put.onerror = function() { failed = failed || put.error; };
            st.put(next, IDB_REV_KEY);
          } catch (e) { failed = e; tx.abort(); }
        };
        tx.oncomplete = function() { idbMarkHeld(); resolve(); };
        tx.onabort = function() {
          reject(isStale ? staleCopy(stale) : (failed || tx.error || new Error('write transaction aborted')));
        };
      } catch (e) { reject(e); }
    });
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
  return readStoredWithRev().then(function(both) {
    _diskRev = both.rev;
    return both.raw;
  }).then(function(raw) {
    if (_idbFailed && idbHeldBook()) {
      // This device keeps its book in IndexedDB and the database would not open this time: a copy that would not read,
      // not an empty device. The localStorage path used to take over, showing no book (or the one from before the move)
      // and saving the session's work there, and the next start, with the database open again, lost it without a word
      // (the QA sweep, 29 Sep 2026). Nothing is written until it opens; the boot banner says so.
      _storeMode = 'idb';
      _storageHealth.readError = 'its database would not open; close the app in every other window and reload';
      return null;
    }
    if (_idbFailed) { _storeMode = 'localStorage'; try { _diskRev = localStorage.getItem(LS_REV_KEY); } catch (e) {} var lr = legacyRaw(); _loadedFrom = lr != null ? 'legacy' : 'none'; return lr; }
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
var _persistQueuedBoot = false;

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
  // A write asked for only while the window was starting (its migrations) changes nothing anybody did: a refusal of it
  // is taken quietly (bookStaleSave). Read when the save is asked for, not when the refusal comes back, which is always
  // after the start has finished (the QA sweep, 29 Sep 2026: the quiet branch never ran).
  var booting = !document.body.classList.contains('inv-booted');
  if (_persistQueued) { if (!booting) _persistQueuedBoot = false; return _persistQueued; }
  _persistQueuedBoot = booting;
  var queued = _persistChain.then(function() {
    var boot = _persistQueuedBoot;
    _persistQueued = null;
    return writeStateNow(boot);
  });
  _persistQueued = queued;
  _persistChain = queued.then(null, function() { return false; });
  return queued;
}

function writeStateNow(boot) {
  var str;
  try { str = JSON.stringify(S); }
  catch (e) { return Promise.resolve(noteSaveFailure(STORAGE_KEY, describeStorageError(e))); }
  var next = newRev(), expect = _diskRev;
  return writeGuarded(str, expect, next).then(function() {
    // Read back, so a store that drops a write without a word is caught.
    return readStoredWithRev().then(function(back) {
      // Still the old revision: the write never landed. Another revision: another window has saved since, which is
      // its copy to answer for.
      var ours = back.rev === next || back.rev === (expect || null);
      if (ours && (back.rev !== next || back.raw === null || back.raw.length !== str.length)) {
        throw notPersisted('write not persisted (read back ' + (back.raw === null ? 'nothing' : back.raw.length + ' of ' + str.length + ' chars') + ')');
      }
      _diskRev = next;
    });
  }).then(function() {
    bookAnnounce(next);
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
    if (e && e.name === 'StaleCopy') return bookStaleSave(boot);
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
  'voidedNumbers', 'creditNotes', 'extraExceptions', 'staff', 'attendance', 'areaTargets', 'shiftNeeds', 'stock', 'todo', 'relayPastes', 'relayLearn', 'staffPayments', 'costBills', 'payrollPaid', 'bank', 'production'];
// Config objects are the opposite: a missing one is filled from the defaults,
// and so is a missing KEY inside one. `labourCfg()` reads `extraRate || 0`, so
// a backup predating a constant would silently price the extra at nothing
// rather than at ₹47.50 — a wrong number, not a visible gap.
var STATE_CONFIGS = ['labour', 'rateCheck', 'stockCheck', 'todoCheck', 'invStateCheck'];

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
  // A record's lines are read as an array in some 150 places: an invoice or challan written without one (a
  // hand-edited backup, an older scanner) made the first screen to read it throw, Home at launch (the QA sweep,
  // 29 Sep 2026). An empty list is a shape, not invented business data.
  ['invoices', 'incomingMaterial'].forEach(function(k) {
    (s[k] || []).forEach(function(r) { if (r && !Array.isArray(r.items)) r.items = []; });
  });
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
  // What is worked out from the book is worked out again, as when another window's save is loaded (bookReload): the
  // two had drifted, and a pull or an import kept the old book's part usage (the QA sweep, 29 Sep 2026).
  if (typeof prodTouch === 'function') prodTouch();
  if (typeof _invalidateUsageCache === 'function') _invalidateUsageCache();
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
  bookChannel();
}

/* ===== LAYOUT MODE (Phase 8A) ===== */
var _isDesktop = false;
var _isTablet = false;
var _pendingModeSwitch = false;

/* ===== ARCHITECTURAL GLOBALS (Phase 3) ===== */
let _tabDirty = { home: true, register: true };
let _tabScroll = {};
let _navReturnTab = null;
let _regToolbarRendered = false;
let _regSearchTimer = null;
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

function focusFirstInteractive(container, opts) {
  if (!container) return;
  // opts.noText: a button or a choice, never a field (a screen opened on a touch screen, where a focused field raises
  // the keyboard). Never scrolls: the caller has put the page where it belongs.
  var el = container.querySelector(opts && opts.noText ? 'button, select, [tabindex]:not([tabindex="-1"])'
    : 'button, input:not([type="hidden"]):not([readonly]), select, textarea, [tabindex]:not([tabindex="-1"])');
  if (el) { try { el.focus({ preventScroll: true }); } catch(e) {} }
}
/* A touch screen, where focusing a field raises the keyboard over the screen. */
function touchScreen() { try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } }

/* ===== A CHANGE INSIDE A VIEW NEVER MOVES THE PAGE (P79) =====
   Owner, 27 Sep 2026: picking a client in Receivables sent the page back to the top. The re-render brought the open
   view tab into view with scrollIntoView, and with the tabs above the screen that scrolls the PAGE up to them.
   - viewTabReveal(row): brings the open tab of a view-tab row into sight by scrolling the row sideways, never the page.
   - viewTop(): the one way to send the page to the top, for a real navigation (a new page, a sub-page, a view tab).
   - keepScroll(fn): runs a re-render and puts the page, its scrolling panes and dialogs back where they were, and
     focus back on the control the re-render replaced (by id, else by its data- attributes). A viewTop() inside fn
     is a navigation, and wins. */
function viewTabReveal(row) {
  if (!row) return;
  var on = row.querySelector('.inv-viewtab[aria-selected="true"]');
  if (!on) return;
  var r = row.getBoundingClientRect(), t = on.getBoundingClientRect();
  if (t.left < r.left) row.scrollLeft -= r.left - t.left;
  else if (t.right > r.right) row.scrollLeft += t.right - r.right;
}

var _viewTopAt = 0;
function viewTop() {
  _viewTopAt++;
  _pageTyped = false;
  window.scrollTo(0, 0);
}

/* ===== HOW MUCH A SCREEN SHOWS (UX overhaul 2, step 6) =====
   Measured on the real book, the long screens were long because each put a finished or historical list at full length
   under the few rows that need the owner: a client's Materials ran 23 phone screens, the bank statement 18. Two tools,
   used by the four rules in docs/UX_OVERHAUL_2.md:
   - uiMoreHtml: a long list shows its first rows and one row saying how many more, which shows them in place (the rows
     are drawn and hidden, so it works the same on a page, in a pane or in a dialog). Totals always cover the whole.
     Shown lists stay shown until the page is reloaded.
   - uiFoldHtml: a card taller than a screen folds to its head, which says what is in it; open or shut is remembered on
     the device. */
var UI_MORE_ROWS = 30;
var UI_FOLDS_KEY = 'sep_inv_folds';
var _uiMoreShown = {};
var _uiFolds = (function() { try { return JSON.parse(localStorage.getItem(UI_FOLDS_KEY) || '{}') || {}; } catch (e) { return {}; } })();

/* rows: one entry per row, each an html string of top-level elements, or {parts: [html, …]} for a row drawn as several
   (a row and its open editor, a challan and its lines), or {parts, head: true} for a group heading, which does not
   count toward n and is held back with the row after it. Nothing is wrapped: a wrapper would make every row its
   container's last child and drop the rules between rows. opts: {n (UI_MORE_ROWS), noun, tr: colspan for <tr> rows}. */
function uiMoreHtml(key, rows, opts) {
  opts = opts || {};
  var n = opts.n != null ? opts.n : UI_MORE_ROWS;
  var items = rows.map(function(r) { return typeof r === 'string' ? { parts: [r] } : r; });
  var total = items.filter(function(r) { return !r.head; }).length;
  if (total <= n || _uiMoreShown[key]) return items.map(function(r) { return r.parts.join(''); }).join('');
  var hide = function(h) { return h.replace(/^(\s*<[a-z]+)(\s|>)/i, '$1 data-more-of="' + escHtml(key) + '" hidden$2'); };
  var seen = 0, out = '';
  items.forEach(function(r, i) {
    // A heading goes with the row after it.
    var counts = r.head ? (items.slice(i + 1).find(function(x) { return !x.head; }) ? seen : n) : seen++;
    out += counts < n ? r.parts.join('') : r.parts.map(hide).join('');
  });
  var btn = '<button type="button" class="inv-btn inv-btn-link inv-btn-sm" data-action="invShowMore" data-key="' + escHtml(key) + '">Show ' + (total - n) + ' more' +
    (opts.noun ? ' ' + opts.noun : '') + ' · ' + total + ' in all</button>';
  return out + (opts.tr ? '<tr data-more-btn="' + escHtml(key) + '"><td colspan="' + opts.tr + '">' + btn + '</td></tr>'
    : '<div class="inv-row" data-more-btn="' + escHtml(key) + '">' + btn + '</div>');
}
function uiShowMore(key) {
  _uiMoreShown[key] = true;
  document.querySelectorAll('[data-more-of="' + key + '"]').forEach(function(el) { el.hidden = false; });
  document.querySelectorAll('[data-more-btn="' + key + '"]').forEach(function(el) { el.remove(); });
}
/* Brings one row into sight, showing the rest of its list first when it is under "Show N more": a jump to a challan
   used to scroll to a row drawn hidden, and so to nowhere. */
function uiRevealEl(el) {
  if (!el) return;
  var hid = el.closest && el.closest('[data-more-of]');
  if (hid) uiShowMore(hid.getAttribute('data-more-of'));
  if (el.scrollIntoView) el.scrollIntoView({ block: 'center' });
}

/* A panel that folds to its head. head: the summary row's inner html; dflt: open when nothing is remembered. */
function uiFoldOpen(key, dflt) { return Object.prototype.hasOwnProperty.call(_uiFolds, key) ? !!_uiFolds[key] : !!dflt; }
function uiFoldHtml(key, headHtml, bodyHtml, dflt, attrs) {
  return '<details class="inv-panel inv-panel-flush inv-panel-fold" data-fold="' + escHtml(key) + '"' + (attrs || '') + (uiFoldOpen(key, dflt) ? ' open' : '') + '>' +
    '<summary class="inv-panel-head">' + headHtml + '</summary>' + bodyHtml + '</details>';
}
document.addEventListener('toggle', function(e) {
  var d = e.target;
  if (!d || !d.dataset || !d.dataset.fold) return;
  _uiFolds[d.dataset.fold] = d.open;
  try { localStorage.setItem(UI_FOLDS_KEY, JSON.stringify(_uiFolds)); } catch (err) { /* a per-device convenience only */ }
}, true);

var KEEP_SCROLLERS = '.inv-pane-list, .inv-pane, .inv-dialog, .inv-dialog-main, .inv-dialog-panes';
function _keepKey(el) {
  if (!el || !el.tagName || el === document.body) return null;
  if (el.id) return '#' + CSS.escape(el.id);
  var attrs = Array.prototype.filter.call(el.attributes, function(a) { return /^data-/.test(a.name); });
  if (!attrs.length) return null;
  return el.tagName.toLowerCase() + attrs.map(function(a) { return '[' + a.name + '="' + CSS.escape(a.value) + '"]'; }).join('');
}
function keepScroll(fn) {
  var y = window.scrollY, nav = _viewTopAt;
  var inner = Array.prototype.map.call(document.querySelectorAll(KEEP_SCROLLERS), function(el) { return el.scrollTop; });
  var act = document.activeElement, key = _keepKey(act);
  try { return fn(); } finally {
    if (_viewTopAt === nav) {
      var now = document.querySelectorAll(KEEP_SCROLLERS);
      if (now.length === inner.length) Array.prototype.forEach.call(now, function(el, i) { if (el.scrollTop !== inner[i]) el.scrollTop = inner[i]; });
      if (window.scrollY !== y) window.scrollTo(0, y);
      if (act && !act.isConnected && key) {
        var back = null;
        try { back = document.querySelector(key); } catch (e) { back = null; }
        if (back && typeof back.focus === 'function') { try { back.focus({ preventScroll: true }); } catch (e) {} }
      }
    }
  }
}

/* ===== DIALOG SHELL (design system §6.16) =====
   Every dialog is an inv-dialog in an inv-scrim-dialog: a sheet from the bottom on the phone, centred on the
   desktop. Its head is the title and a close button; its foot (inv-dialog-foot) the actions, primary last.
   The More sheet is an inv-scrim too but not a dialog, so closing dialogs never takes it (or its focus) along.
   `title` is HTML: the caller escapes what came from the user. */
function dialogHeadHtml(title, closeAction, closeLabel, actionsHtml) {
  var close = '<button class="inv-btn inv-btn-icon inv-dialog-close" data-action="' + (closeAction || 'invCloseOverlay') +
    '" aria-label="' + (closeLabel || 'Close') + '">&times;</button>';
  return '<div class="inv-dialog-head"><span class="inv-dialog-title">' + title + '</span>' +
    (actionsHtml ? '<span class="inv-toolbar inv-toolbar-tight">' + actionsHtml + close + '</span>' : close) + '</div>';
}

/* A two-faced dialog turns over in this many ms (--dur-2, §3.6). */
var FLIP_MS = 200;

/* The desktop detail pane's head (§6.14): what is open, and the button that closes the pane. */
function paneHeadHtml(titleHtml, closeAction) {
  return '<div class="inv-pane-head">' + titleHtml +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="' + closeAction + '" aria-label="Close">&times;</button></div>';
}

/* Opens `html` (the whole inv-dialog) over the page and moves focus into it; the focus it left returns on close.
   opts.dismiss: a tap on the scrim closes it (a view, never an act). opts.replace: redraw the top dialog in place
   when one is open (a form re-rendered as it is typed). Returns the scrim. */
function dialogOpen(html, opts) {
  opts = opts || {};
  if (opts.replace) {
    var open = document.querySelectorAll('.inv-scrim-dialog');
    if (open.length) { open[open.length - 1].innerHTML = html; return open[open.length - 1]; }
  }
  var scrim = document.createElement('div');
  scrim.className = 'inv-scrim inv-scrim-dialog';
  scrim.innerHTML = html;
  if (opts.dismiss) scrim.addEventListener('click', function(e) {
    if (e.target !== scrim) return;
    dialogLeaveOk(scrim).then(function(ok) { if (ok) dialogCloseScrim(scrim); });
  });
  pushFocus();
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  focusFirstInteractive(scrim.querySelector('.inv-dialog'));
  return scrim;
}

/* A dialog holding what somebody typed is never shut unasked (owner, 29 Sep 2026: "if I am entering something in
   that and I click outside the box, it just closes without a warning and all the info I entered is gone"). Any
   field changed in a dialog marks its scrim typed; a tap on the scrim or the head's × then asks before anything is
   thrown away, Keep editing first. Cancel is a discard somebody chose and asks nothing; a save closes it as before.
   Settings keeps its own per-section check (data-nodirty), and a question's own field (uiPrompt) is not a form. */
function _dialogMarkTyped(e) {
  var t = e.target;
  if (!t || !t.closest || !t.matches || !t.matches('input, textarea, select')) return;
  if (t.closest('.inv-search, [data-nodirty], [data-ui-ask]')) return;
  var scrim = t.closest('.inv-scrim-dialog');
  if (scrim) { scrim.dataset.typed = '1'; return; }
  // A field typed on the page itself (not a toolbar's filter or a segmented choice) makes the page a form in
  // progress: a book loaded from another window then waits to be drawn (bookRedraw).
  if (t.closest('.inv-page-active') && !t.closest('.inv-toolbar, .inv-seg')) _pageTyped = true;
}
var _pageTyped = false;
document.addEventListener('input', _dialogMarkTyped, true);
document.addEventListener('change', _dialogMarkTyped, true);

function dialogTyped(scrim) { return !!(scrim && scrim.isConnected && scrim.dataset.typed === '1'); }

/* Resolves true when the dialog may close: nothing typed, or the discard was confirmed. */
function dialogLeaveOk(scrim) {
  if (!dialogTyped(scrim)) return Promise.resolve(true);
  if (scrim._leaveAsk) return scrim._leaveAsk.then(function() { return false; });
  scrim._leaveAsk = uiConfirm({ title: 'Discard what you typed?',
    body: 'What you entered here has not been saved. Keep editing to finish and save it, or discard it.',
    okLabel: 'Discard', cancelLabel: 'Keep editing', danger: true });
  return scrim._leaveAsk.then(function(ok) { scrim._leaveAsk = null; return ok; });
}

/* Closes one dialog wherever it sits in the stack (normally the top one). */
function dialogCloseScrim(scrim) {
  if (!scrim || !scrim.isConnected) return;
  var all = document.querySelectorAll('.inv-scrim-dialog');
  if (all.length && all[all.length - 1] === scrim) { closeTopOverlay(); return; }
  scrim.remove();
  popFocus();
  if (!document.querySelector('.inv-scrim-dialog')) document.body.style.overflow = '';
}

/* ===== THE OTHER WINDOWS =====
   After a save, the other windows are told the new revision and load it at once; a window coming back into view
   checks the revision too (a frozen tab hears nothing). Loading replaces S whole and runs no migration, since a
   migration saves and the windows would then answer each other for ever; the next boot runs them. What is being
   typed is kept: with a dialog open, a field typed on the page, or a challan form in progress, the screen is not
   redrawn until that is saved or left, and the toast says so. */
var _bookChan = null;
var _bookReloading = null;
var _bookRedrawPending = false;
function bookChannel() {
  if (_bookChan === null) {
    try {
      _bookChan = new BroadcastChannel('sep-invoicing-book');
      _bookChan.onmessage = function(ev) { bookOnMessage(ev.data); };
    } catch (e) { _bookChan = false; }
  }
  return _bookChan;
}
function bookPost(msg) { var c = bookChannel(); if (c) { try { c.postMessage(msg); } catch (e) {} } }
function bookAnnounce(rev) { bookPost({ type: 'saved', rev: rev }); }
function bookOnMessage(m) {
  if (!m || !S) return;
  if (m.type === 'saved' && m.rev !== _diskRev) bookReload('saved');
  // Another window pushed this same book to GitHub: nothing is left for this one's pending push to send.
  if (m.type === 'pushed' && m.rev === _diskRev && typeof ghCancelPending === 'function') ghCancelPending();
}
// A window back in view: has another saved meanwhile?
function bookCheck() {
  if (!S || _storageHealth.readError) return Promise.resolve(false);
  // The revision alone: it read the whole book at every return to view only to compare this.
  return readStoredRev().then(function(rev) { return rev && rev !== _diskRev ? bookReload('saved') : false; }, function() { return false; });
}
function bookReload(why) {
  if (_bookReloading) return _bookReloading;
  _bookReloading = readStoredWithRev().then(function(b) {
    if (b.raw == null || b.rev === _diskRev) return false;
    var next = JSON.parse(b.raw);
    S = next;
    ensureStateShape(S);
    _diskRev = b.rev;
    if (typeof prodTouch === 'function') prodTouch();
    if (typeof _invalidateUsageCache === 'function') _invalidateUsageCache();
    bookRedraw(why);
    return true;
  }).then(null, function(e) {
    uiNotice('This window could not load the book another window saved (' + describeStorageError(e) + '). Close this window and reopen the app before editing here.', 'warning');
    return false;
  }).then(function(r) { _bookReloading = null; return r; });
  return _bookReloading;
}
function bookBusy() {
  return !!(document.querySelector('.inv-scrim-dialog') || _pageTyped || (typeof _challanForm !== 'undefined' && _challanForm));
}
function bookRedraw(why) {
  _tabDirty.home = true;
  _tabDirty.register = true;
  var seen = document.visibilityState !== 'hidden';
  if (bookBusy()) {
    _bookRedrawPending = true;
    if (seen && why === 'saved') showToast('Another window saved the book. What you are typing here is kept; this screen shows the changes once you save or move on.', 'info');
    return;
  }
  _bookRedrawPending = false;
  if (typeof tabRedrawActive === 'function') tabRedrawActive();
  if (seen && why === 'saved') showToast('Updated from another window', 'info');
}
// A save refused because another window saved first: this window takes the saved book and says what was lost.
function bookStaleSave(boot) {
  _storageHealth.lastSaveOk = false;
  _storageHealth.lastSaveAt = Date.now();
  _storageHealth.lastError = 'not written: another window had saved the book first';
  // A save asked for only while the window was starting (its migrations) lost nothing anybody did: taken quietly.
  return bookReload('stale').then(function() {
    if (boot) return false;
    uiNotice('Another window saved the book after this window loaded it, so the last change made here was not saved. ' +
      'This window now shows the saved book: make that change again.', 'warning');
    return false;
  });
}

/* ===== ASKING AND TELLING, IN THE APP (owner, 27 Sep 2026) =====
   "Make sure in case of browser pop-up failure there is another way that the message or error gets
   relayed — in all places in our app." The browser's own confirm, alert and prompt boxes are gone from
   every module: a browser can block them, an installed app can suppress them, a test harness
   dismisses them unseen, and each one reads nothing like the app. These three are dialogs in the
   one shell (§6.16), and each returns a Promise:
     uiConfirm({title, body, okLabel, cancelLabel, danger}) → true / false
     uiAlert({title, body, okLabel, tone})                  → undefined, once read
     uiPrompt({title, body, label, value, placeholder, okLabel, required}) → the text, or null
   Esc, the scrim, the close button and Cancel all answer "cancel". A dialog shut by anything else
   (closeOverlay() behind it) also answers "cancel", so no caller waits for ever.

   The fallback is the other half of the ruling: if the dialog cannot be drawn, the message still
   reaches the operator as a banner that stays until dismissed (uiNotice). A question that could not
   be asked is answered "cancel" — and the banner SAYS so — so nothing destructive happens unseen. */
var _uiAskSeq = 0;
var _uiAskOpen = {};

function uiNotice(text, tone) {
  try {
    var bar = document.querySelector('.inv-notice-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'inv-notice-bar';
      bar.setAttribute('role', 'alert');
      bar.innerHTML = '<div class="inv-notice-list"></div><span class="inv-update-actions">' +
        '<button class="inv-btn inv-btn-secondary inv-update-btn" data-action="invNoticeDismiss">Dismiss</button></span>';
      document.body.appendChild(bar);
    }
    var line = document.createElement('div');
    line.className = 'inv-notice-text';
    line.dataset.tone = tone || 'danger';
    line.textContent = text;
    bar.querySelector('.inv-notice-list').appendChild(line);
    bar.dataset.tone = bar.querySelector('[data-tone="danger"]') ? 'danger' : (tone || 'danger');
    return true;
  } catch (e) {
    // The page itself is failing. A toast is the last in-app path; the console only if that fails too.
    try { showToast(text, 'error'); return true; } catch (e2) { console.error(text); return false; }
  }
}
function uiNoticeDismiss() {
  document.querySelectorAll('.inv-notice-bar').forEach(function(b) { b.remove(); });
}

function _uiAskText(o) {
  var t = o.title || '';
  return (t ? t + (o.body ? (/[?.!:]$/.test(t) ? ' ' : ': ') : '') : '') + (o.body || '').replace(/\s*\n+\s*/g, ' ');
}

function _uiAsk(kind, o) {
  o = o || {};
  return new Promise(function(resolve) {
    var id = 'ask' + (++_uiAskSeq), scrim = null, done = false;
    var finish = function(ans) {
      if (done) return;
      done = true;
      delete _uiAskOpen[id];
      if (obs) obs.disconnect();
      if (scrim && scrim.isConnected) {
        var all = document.querySelectorAll('.inv-scrim-dialog');
        if (all.length && all[all.length - 1] === scrim) closeTopOverlay();
        else { scrim.remove(); if (!document.querySelector('.inv-scrim-dialog')) document.body.style.overflow = ''; }
      }
      resolve(ans);
    };
    var obs = null;
    try {
      var input = kind === 'prompt'
        ? '<div class="inv-field"><label class="inv-field-label" for="' + id + 'In">' + escHtml(o.label || 'Reason') + '</label>' +
          '<input class="inv-input" id="' + id + 'In" data-ui-ask-input value="' + escHtml(o.value || '') + '"' +
          (o.placeholder ? ' placeholder="' + escHtml(o.placeholder) + '"' : '') + ' autocomplete="off">' +
          '<div class="inv-field-error inv-hidden" data-ui-ask-err>' + escHtml(o.requiredText || 'This is needed to go on.') + '</div></div>'
        : '';
      var okCls = o.danger ? 'inv-btn inv-btn-danger inv-btn-solid' : 'inv-btn inv-btn-primary';
      var foot = '<div class="inv-dialog-foot">' +
        (kind === 'alert' ? '' : '<button type="button" class="inv-btn inv-btn-secondary" data-action="invUiAsk" data-ans="cancel">' + escHtml(o.cancelLabel || 'Cancel') + '</button>') +
        '<button type="button" class="' + okCls + '" data-action="invUiAsk" data-ans="ok">' + escHtml(o.okLabel || 'OK') + '</button></div>';
      var html = '<div class="inv-dialog" role="' + (kind === 'alert' ? 'alertdialog' : 'dialog') + '" aria-modal="true" aria-labelledby="' + id + 'T"' +
        ' data-ui-ask="' + id + '" data-ui-kind="' + kind + '">' +
        dialogHeadHtml('<span id="' + id + 'T">' + escHtml(o.title || (kind === 'alert' ? 'Note' : 'Are you sure?')) + '</span>', 'invUiAsk') +
        (o.body ? '<div class="inv-ask-body' + (o.tone ? ' inv-callout inv-callout-' + o.tone : '') + '">' + escHtml(o.body) + '</div>' : '') +
        input + foot + '</div>';
      scrim = dialogOpen(html);
      if (!scrim || !scrim.isConnected) throw new Error('the dialog did not open');
      _uiAskOpen[id] = { kind: kind, o: o, finish: finish, scrim: scrim };
      scrim.addEventListener('click', function(e) { if (e.target === scrim) finish(kind === 'prompt' ? null : kind === 'alert' ? undefined : false); });
      scrim.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); uiAskAnswer(id, 'cancel'); }
        else if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-ui-ask-input')) { e.preventDefault(); e.stopPropagation(); uiAskAnswer(id, 'ok'); }
      });
      // Shut by anything else (closeOverlay() closing every dialog): that is a cancel, never a hang.
      obs = new MutationObserver(function() { if (!scrim.isConnected) finish(kind === 'prompt' ? null : kind === 'alert' ? undefined : false); });
      obs.observe(document.body, { childList: true });
      // Where the answer starts: the text to type, Cancel before a destructive act, else the act.
      var focus = kind === 'prompt' ? scrim.querySelector('[data-ui-ask-input]')
        : scrim.querySelector('[data-ans="' + (o.danger ? 'cancel' : 'ok') + '"]');
      if (focus) { try { focus.focus(); if (focus.select) focus.select(); } catch (e) {} }
    } catch (err) {
      // The fallback: the message is still said, and a question not asked is not answered yes.
      if (scrim && scrim.isConnected) scrim.remove();
      var text = _uiAskText(o);
      if (kind === 'alert') uiNotice(text, o.tone === 'danger' || !o.tone ? 'danger' : o.tone);
      else uiNotice('Could not show this question, so nothing was done — ' + text, 'danger');
      done = true;
      resolve(kind === 'prompt' ? null : kind === 'alert' ? undefined : false);
    }
  });
}

/* A button in an ask dialog (or its close button): the answer, read against its dialog. */
function uiAskAnswer(idOrBtn, ans) {
  var id = idOrBtn;
  if (typeof idOrBtn !== 'string') {
    var dlg = idOrBtn.closest('[data-ui-ask]');
    id = dlg ? dlg.dataset.uiAsk : null;
    ans = idOrBtn.dataset.ans || 'cancel';
  }
  var a = id && _uiAskOpen[id];
  if (!a) return;
  if (a.kind === 'alert') { a.finish(undefined); return; }
  if (a.kind === 'confirm') { a.finish(ans === 'ok'); return; }
  if (ans !== 'ok') { a.finish(null); return; }
  var inp = a.scrim.querySelector('[data-ui-ask-input]');
  var v = inp ? inp.value.trim() : '';
  if (a.o.required && !v) {
    var err = a.scrim.querySelector('[data-ui-ask-err]');
    if (err) err.classList.remove('inv-hidden');
    if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); }
    return;
  }
  a.finish(v);
}

function uiConfirm(o) { return _uiAsk('confirm', o); }
function uiAlert(o) { return _uiAsk('alert', o); }
function uiPrompt(o) { return _uiAsk('prompt', o); }

/* An error nobody caught still reaches the screen: before this it reached the console alone, and a
   handler that threw simply did nothing the operator could see. */
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('error', function(e) {
    var msg = (e && e.message) || '';
    if (!msg || /ResizeObserver|Script error/.test(msg)) return;
    uiNotice('Something went wrong: ' + msg + '. What was being done may not have finished — check it, and export a backup if in doubt.', 'danger');
  });
  window.addEventListener('unhandledrejection', function(e) {
    var r = e && e.reason, msg = r && r.message ? r.message : String(r || '');
    if (!msg) return;
    uiNotice('Something went wrong: ' + msg + '. What was being done may not have finished — check it.', 'danger');
  });
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
  // Only when it changes something: it rewrote the whole book at every start of an empty one.
  if (S.invoices.length === 0 && S.invNextNum !== 1 && !S.voidedNumbers.some(function(v) { return v.reserved; })) {
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

/* Rupees said short, the Indian way: \u20B9950, \u20B912.5K, \u20B98.4L, \u20B912.0Cr \u2014 thousands up to 99.9K, lakh up to 99.9L,
   then crore (a \u20B912 crore axis used to read \u20B91200.0L). For a chart's axis, keys, legend and centre only: a readout,
   a <title>, a table and a tile carry the exact formatCurrency() figure. The unit steps up where one decimal would
   round to 100, so 99,960 reads \u20B91.0L, never \u20B9100.0K. */
function formatInrShort(v) {
  v = Number(v) || 0;
  if (v < 0) return '\u2212' + formatInrShort(-v);
  if (v < 999.5) return '\u20B9' + Math.round(v);
  if (v < 99950) return '\u20B9' + (v / 1e3).toFixed(1) + 'K';
  if (v < 9995000) return '\u20B9' + (v / 1e5).toFixed(1) + 'L';
  return '\u20B9' + (v / 1e7).toFixed(1) + 'Cr';
}

/* ===== A FIGURE SAYS WHETHER IT IS GOOD (owner, 29 Sep 2026) =====
   "most numbers in our app don't convey any kind of meaning, as in is it a good number or is it something of an issue,
   all are in default black". The owner chose both: a figure the app can judge is coloured by the status tones (DR-1:
   colour means status, ok / warning / danger), and a headline figure carries a change line against its benchmark,
   coloured by whether the move is the good way. A plain fact (a count of invoices, a date) stays in the text colour.
   Every colour sits beside the words that give its reason (DR-8): the tile's sub-line, the row's meta, the column head.
   The judgements are here, in one place, so a threshold is one edit. */
var FIG_FLAT_PCT = 2;     // a change within this is level, not a move
var FIG_BAD_PCT = 10;     // a move the wrong way past this is danger, below it warning

/* A figure against the line it must clear: higher is better (realisation against cost, attendance against its gate)
   unless lowerBetter (labour ₹/kg against the model). ok at or past it; warning within warnPct of it; danger beyond. */
function figToneAgainst(v, ref, warnPct, lowerBetter) {
  if (v == null || ref == null || !isFinite(v) || !isFinite(ref) || ref === 0) return null;
  var gap = (lowerBetter ? ref - v : v - ref) / Math.abs(ref) * 100;
  return gap >= 0 ? 'ok' : gap >= -(warnPct || 5) ? 'warning' : 'danger';
}
/* Days since an invoice was raised, as a debt: past 90 danger, past 60 warning. */
function figToneAge(days) { return days == null ? null : days > 90 ? 'danger' : days > 60 ? 'warning' : null; }
/* How long a client takes to pay: a month is fine, two a warning, more danger. */
function figTonePaysIn(days) { return days == null ? null : days <= 30 ? 'ok' : days <= 60 ? 'warning' : 'danger'; }
/* A share that has a gate (attendance at the rest-day gate's 90 / 80): ok at or over okAt, warning over warnAt. */
function figTonePct(pct, okAt, warnAt) { return pct == null || !isFinite(pct) ? null : pct >= okAt ? 'ok' : pct >= warnAt ? 'warning' : 'danger'; }
/* Share of capacity used: the plant's cost is mostly fixed, so an idle shift is the problem. */
function figToneCapacity(pct) { return pct == null ? null : pct >= 80 ? 'ok' : pct >= 60 ? 'warning' : 'danger'; }

/* The figure's html in its tone's colour (or as it is, with no tone). */
function figHtml(html, tone) { return tone ? '<span class="inv-fig-' + tone + '">' + html + '</span>' : html; }

/* A change against the period before in words (§5.4), "+12.3% on Aug", coloured by whether it moved the good way:
   better 'up' (revenue, tonnage, realisation) or 'down' (cost, days to pay); null leaves it uncoloured (a count).
   Level within FIG_FLAT_PCT; the wrong way is warning up to FIG_BAD_PCT and danger past it. Against nothing it says so. */
function figDeltaHtml(cur, prev, label, better) {
  if (prev == null || !isFinite(prev) || prev === 0 || cur == null || !isFinite(cur)) return 'no figure for ' + escHtml(label);
  var pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) <= FIG_FLAT_PCT) return 'level with ' + escHtml(label);
  var text = (pct > 0 ? '+' : '&minus;') + formatNum(Math.abs(pct), 1) + '% on ' + escHtml(label);
  if (!better) return text;
  var good = better === 'up' ? pct > 0 : pct < 0;
  return figHtml(text, good ? 'ok' : Math.abs(pct) <= FIG_BAD_PCT ? 'warning' : 'danger');
}

/* A figure in a tile breaks only after a comma group, never inside its paise: \u20B910,46,48,655.51 wraps as
   "\u20B910,46,48," / "655.51". Every "d,dd" in the TEXT of an html string gets a <wbr> after its comma, and the last
   group with its decimals is kept whole (inv-nowrap); tags and their attributes (a title carrying the same figure)
   are left alone. The tile value keeps overflow-wrap: anywhere only as the last resort for a figure with no commas. */
function figWrapHtml(html) {
  return String(html == null ? '' : html).split(/(<[^>]*>)/).map(function(part) {
    if (part.charAt(0) === '<') return part;
    return part.replace(/\d{1,3}(?:,\d{2,3})+(?:\.\d+)?/g, function(m) {
      var groups = m.split(','), last = groups.pop();
      return groups.join(',<wbr>') + ',<wbr><span class="inv-nowrap">' + last + '</span>';
    });
  }).join('');
}

/* ===== OVERFLOW CUES =====
   What a screen cuts, it says (§5.3, §6.11; the polish pass's open items, 27 Sep 2026). Two cues, kept by one pass
   that runs after every render rather than in each of the fifty places that draw a name into a row or a cell:
   - an element the stylesheet ellipsises (a row's title, a meta line past its two lines on the phone, a growing table
     cell, a legend label) that is ACTUALLY cut carries a `title` with its full text. The title is marked
     data-auto-title so it is dropped again when the text fits; a title a template wrote is never touched.
   - a table wrapper that scrolls sideways (`inv-scroll-x`) carries data-more = start | end | both, which fades that
     edge, and while it overflows a note under it reads "Scroll for more". A grid with a sticky name column fades at
     its end only. The note stays while the table overflows: removing it on a scroll would move the page.
   The pass reads the stylesheet once for which selectors ellipsise, so a new one is covered without a list here. */
var _ovEllipsisSel = '';
function _ovEllipsisSelector() {
  if (_ovEllipsisSel) return _ovEllipsisSel;
  var sels = [];
  var walk = function(rules) {
    Array.prototype.forEach.call(rules, function(r) {
      if (r.type === 4 && r.media && /print/.test(r.media.mediaText) && !/screen/.test(r.media.mediaText)) return;
      if (r.style && r.selectorText && r.style.textOverflow === 'ellipsis') sels.push(r.selectorText);
      if (r.cssRules) walk(r.cssRules);
    });
  };
  Array.prototype.forEach.call(document.styleSheets, function(sh) { try { walk(sh.cssRules); } catch (e) { /* cross-origin font CSS */ } });
  _ovEllipsisSel = sels.join(', ');
  return _ovEllipsisSel;
}

function _ovScrollCue(sc) {
  var w = sc.clientWidth;
  if (!w) return;
  var max = sc.scrollWidth - w, over = max > 1, more = '';
  if (over) {
    var l = sc.scrollLeft > 1 && !sc.querySelector('.inv-table-grid'), r = sc.scrollLeft < max - 1;
    more = l && r ? 'both' : l ? 'start' : r ? 'end' : '';
  }
  if (more) { if (sc.getAttribute('data-more') !== more) sc.setAttribute('data-more', more); }
  else if (sc.hasAttribute('data-more')) sc.removeAttribute('data-more');
  var next = sc.nextElementSibling, has = !!(next && next.classList.contains('inv-scroll-hint'));
  if (over && !has) sc.insertAdjacentHTML('afterend', '<p class="inv-note inv-scroll-hint">Scroll for more &rarr;</p>');
  else if (!over && has) next.remove();
}

function uiOverflowCues() {
  var sel = _ovEllipsisSelector();
  if (sel) document.querySelectorAll(sel).forEach(function(el) {
    var auto = el.hasAttribute('data-auto-title');
    if (!auto && el.hasAttribute('title')) return;
    var w = el.clientWidth;
    if (!w) return;
    var cut = el.scrollWidth > w + 1 || el.scrollHeight > el.clientHeight + 1;
    var owned = el.parentElement && el.parentElement.closest('[title]:not([data-auto-title])');
    var text = cut && !owned ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '';
    if (text) {
      if (el.getAttribute('title') !== text) el.setAttribute('title', text);
      if (!auto) el.setAttribute('data-auto-title', '');
    } else if (auto) { el.removeAttribute('title'); el.removeAttribute('data-auto-title'); }
  });
  document.querySelectorAll('.inv-scroll-x').forEach(_ovScrollCue);
}

var _ovObserver = null;
function uiOverflowCuesStart() {
  if (_ovObserver || typeof MutationObserver === 'undefined') return;
  var queued = false;
  var run = function() { queued = false; try { uiOverflowCues(); } catch (e) { /* a cue must never take a render with it */ } };
  var later = function() { if (!queued) { queued = true; requestAnimationFrame(run); } };
  // After a render, before it is painted: the observer's callback is a microtask. What the pass itself writes (a title,
  // data-more) is not watched; the note it inserts is, and the pass after it changes nothing.
  _ovObserver = new MutationObserver(run);
  _ovObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'open', 'hidden'] });
  window.addEventListener('resize', later);
  document.addEventListener('scroll', function(e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('inv-scroll-x')) _ovScrollCue(t);
  }, true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  run();
}

function localDateStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

/* ===== ONE SET OF DATE AND NUMBER HELPERS (the QA sweep, 29 Sep 2026) =====
   The sweep found four copies of "add days to a date", three of "days between", two day-month-year readers (one of
   which took 31/09 for a date) and five medians, each module with its own. They live here once. */
function isoOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function isoAddDays(iso, n) { var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); }
function isoDaysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
/* A date as written, day first; a two-digit year is this century. Null for a day the calendar has not got (31/09). */
function isoFromDmy(d, m, y) {
  d = +d; m = +m; y = +y;
  if (y < 100) y += 2000;
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return null;
  var t = new Date(y, m - 1, d);
  return t.getMonth() === m - 1 ? isoOf(t) : null;
}
/* The middle of a list of numbers; null for an empty one (a caller that wants 0 says so). */
function numMedian(nums) {
  if (!nums || !nums.length) return null;
  var s = nums.slice().sort(function(a, b) { return a - b; }), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
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
var INV_STATES = ['created', 'printed', 'dispatched', 'delivered', 'filed'];
var INV_STATE_LABELS = { created: 'Created', printed: 'Printed', dispatched: 'Dispatched', delivered: 'Delivered', filed: 'Filed' };
// Where each state's start is kept on the invoice.
var INV_STATE_AT = { created: 'createdAt', printed: 'printedAt', dispatched: 'dispatchedAt', delivered: 'deliveredAt', filed: 'filedAt' };

function getInvState(inv) {
  return inv.invoiceState || 'created';
}
function invStateIdx(st) { return INV_STATES.indexOf(st); }
// Moves an invoice to a state and stamps when (the one place a state is set).
function invSetState(inv, st, now) {
  inv.invoiceState = st;
  inv[INV_STATE_AT[st]] = now || Date.now();
}

/* A state's summary tone where invoices are counted by state (Stats' tiles): what each state is. On one invoice the
   dot is its age in that state instead (invStateTone). */
var INV_STATE_TONE = { created: 'neutral', printed: 'neutral', dispatched: 'warning', delivered: 'info', filed: 'ok', cancelled: 'danger' };
function invStateOf(inv) { return inv.status === 'cancelled' ? 'cancelled' : getInvState(inv); }
function invStateWord(inv) { var st = invStateOf(inv); return st === 'cancelled' ? 'Cancelled' : (INV_STATE_LABELS[st] || st); }

/* How long an invoice has sat in its state, and the colour that earns (owner, 29 Sep 2026: "changes severity colour
   for how long it has been on the same state, do the same for every state till they reach the final state of
   Filed"). Created, Printed and Dispatched turn amber, then red, at the days set in Settings → Checks & alerts →
   Invoice states. Delivered waits on the return, not on a clock: GSTR-1 for a month is due on the 11th of the next,
   so it turns amber that many days before the due date and red once it has passed. Filed is done. */
var INV_STATE_CHECK_DEFAULTS = { createdAmber: 1, createdRed: 2, printedAmber: 1, printedRed: 2, dispatchedAmber: 3, dispatchedRed: 7, fileWarnDays: 3 };
function invStateCheckCfg() {
  var c = (S && S.invStateCheck) || {}, out = {};
  Object.keys(INV_STATE_CHECK_DEFAULTS).forEach(function(k) {
    var v = parseFloat(c[k]);
    out[k] = v > 0 ? v : INV_STATE_CHECK_DEFAULTS[k];
  });
  return out;
}
// When the invoice entered its state: its own stamp, else the latest earlier one, else its date.
function invStateSince(inv) {
  var i = invStateIdx(getInvState(inv));
  for (var k = i; k >= 0; k--) { var t = inv[INV_STATE_AT[INV_STATES[k]]]; if (t) return t; }
  var d = inv.date ? new Date(inv.date + 'T00:00:00').getTime() : NaN;
  return isNaN(d) ? Date.now() : d;
}
function invStateDays(inv, now) { return Math.max(0, Math.floor(((now || Date.now()) - invStateSince(inv)) / 86400000)); }
// GSTR-1 for the invoice's month is due on the 11th of the month after.
function invFileDue(inv) {
  if (!inv.date) return null;
  var d = new Date(inv.date + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth() + 1, 11);
}
function invStateTone(inv, now) {
  var st = invStateOf(inv);
  if (st === 'cancelled') return 'danger';
  if (st === 'filed') return 'ok';
  if (invStateIdx(st) < 0) return 'neutral';   // a state this build does not know (an older or newer backup)
  var c = invStateCheckCfg();
  if (st === 'delivered') {
    var due = invFileDue(inv);
    if (!due) return 'neutral';
    var today = new Date(now || Date.now()); today.setHours(0, 0, 0, 0);
    var left = Math.round((due - today) / 86400000);
    return left < 0 ? 'danger' : left <= c.fileWarnDays ? 'warning' : 'neutral';
  }
  var days = invStateDays(inv, now);
  return days >= c[st + 'Red'] ? 'danger' : days >= c[st + 'Amber'] ? 'warning' : 'neutral';
}
// What the dot's colour is measuring, in words: "3 days" / "GSTR-1 due 11 Oct 2026".
function invStateAgeText(inv) {
  var st = invStateOf(inv);
  if (st === 'cancelled' || st === 'filed') return '';
  if (st === 'delivered') { var due = invFileDue(inv); return due ? 'GSTR-1 due ' + formatDate(due.getFullYear() + '-' + String(due.getMonth() + 1).padStart(2, '0') + '-11') : ''; }
  var d = invStateDays(inv);
  return d === 0 ? 'today' : d + (d === 1 ? ' day' : ' days');
}
function getStateBadgeHtml(inv) {
  return '<span class="inv-badge inv-badge-' + invStateTone(inv) + '">' + escHtml(invStateWord(inv)) + '</span>';
}
/* The default in rows and tables (DR-8): a dot and the word. */
function getStateDotHtml(inv) {
  var age = invStateAgeText(inv);
  return '<span class="inv-dot inv-dot-' + invStateTone(inv) + '"' + (age ? ' title="' + escHtml(invStateWord(inv) + ' · ' + age) + '"' : '') + '>' +
    escHtml(invStateWord(inv)) + '</span>';
}

/* The next state, or a named one further on: an invoice printed outside the app goes from Created straight to
   Dispatched. Never backwards, but for a print that never came out (invNotPrinted). */
function advanceInvoiceState(invId, target) {
  var inv = S.invoices.find(function(i) { return i.id === invId; });
  if (!inv || inv.status === 'cancelled') return;
  var idx = INV_STATES.indexOf(getInvState(inv));
  var nextState = target || INV_STATES[idx + 1];
  // A button drawn before the state moved on (a print, another window) names a step already reached: it only shows
  // where the invoice is. It used to fall through to the step after, so Mark printed on a printed invoice dispatched it.
  if (idx < 0 || !nextState || invStateIdx(nextState) <= idx) { invStateShown(invId); return; }
  invSetState(inv, nextState);
  saveState();
  invStateShown(invId);
  showToast(inv.displayNumber + ' marked as ' + INV_STATE_LABELS[nextState]);
}

/* Print marks a Created invoice Printed, but the print dialog cannot say whether the paper came out: a print cancelled
   or jammed is put back here, and its stamp goes with it (History logs a print from printedAt). */
function invNotPrinted(invId) {
  var inv = S.invoices.find(function(i) { return i.id === invId; });
  if (inv && inv.status !== 'cancelled' && getInvState(inv) === 'printed') {
    inv.invoiceState = 'created';
    delete inv.printedAt;
    saveState();
    showToast(inv.displayNumber + ' is back to Created');
  }
  invStateShown(invId);
}

async function bulkMarkFiled() {
  var filtered = getFilteredInvoices();
  var eligible = filtered.filter(function(inv) {
    return inv.status === 'active' && getInvState(inv) === 'delivered';
  });
  if (eligible.length === 0) {
    showToast('No delivered invoices to mark as filed', 'warning');
    return;
  }
  var ids = eligible.map(function(inv) { return inv.id; });
  if (!(await uiConfirm({ title: 'Mark ' + eligible.length + ' delivered invoice' + (eligible.length > 1 ? 's' : '') + ' as filed?',
    body: 'A filed invoice cannot be deleted and reissued: its number is in a return.', okLabel: 'Mark as filed' }))) return;
  // Found again by id after the question: another window's save can replace the book while it is open, and the objects
  // read before it would be filed in a book no longer on screen (the QA sweep, 29 Sep 2026). One place sets a state.
  var now = Date.now();
  eligible = S.invoices.filter(function(inv) { return ids.indexOf(inv.id) >= 0 && inv.status === 'active' && getInvState(inv) === 'delivered'; });
  eligible.forEach(function(inv) { invSetState(inv, 'filed', now); });
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
    // A piece line with no piece rate has no rate on record: a ₹/kg figure is not a price per piece (5.40 against a
    // ₹1.49 pad). Only a client billed by weight from pieces prices a NOS line at its ₹/kg, through the part's weight.
    return client && client.billingMode === 'nos_to_weight' ? (info.ratePerKg || 0) : 0;
  }
  return info.ratePerKg || 0;
}

/* What a line comes to: the one place the invoice and the challan form price it (the QA sweep, 29 Sep 2026). The
   challan form had its own copy without the nos_to_weight branch, so a NOS line of a client billed by weight from
   pieces was priced pieces × ₹/kg and carried that into the invoice raised off it. `onDate` is the form's date, since
   the rate on record is dated. */
function linePrice(item, client, onDate) {
  if (!client) { item.amount = gstRound((item.qty || 0) * (item.rate || 0)); return; }
  if (client.billingMode === 'piece' && item.unit === 'NOS') {
    // Challan passthrough: the amount is entered as the challan says, and the rate is read back from it.
    if (item.qty > 0 && item.amount > 0) item.rate = gstRound(item.amount / item.qty);
  } else if (client.billingMode === 'nos_to_weight' && item.unit === 'NOS') {
    var pwKey = (item.partNumber || '').toUpperCase();
    var rateInfo = getLineItemRate(client, onDate, item.partNumber);
    // A part with no weight on record cannot be converted; it is billed per piece off the client's card (Samarth's
    // brackets), or an override. Before this the line priced itself at weight 0 × ₹/kg = ₹0.
    var perPiece = rateInfo._override ? { rate: rateInfo.rate }
      : (S.partWeights[pwKey] ? null : getPieceRate(client, onDate, item.partNumber, item.desc));
    // A rate somebody typed is theirs (item._auto.rate false, while the line still carries the figure typed): the
    // record prices only an empty or a filled rate. It used to replace a typed rate silently.
    var typed = item.rate > 0 && item._auto && item._auto.rate === false && item._auto.rateTyped === item.rate;
    if (perPiece && perPiece.rate != null) {
      if (!typed) item.rate = perPiece.rate;
      item.amount = gstRound((item.qty || 0) * item.rate);
      return;
    }
    var w = (item.qty || 0) * (S.partWeights[pwKey] || 0);
    if (!typed) item.rate = rateInfo.ratePerKg || 0;
    item.amount = gstRound(w * item.rate);
  } else {
    item.amount = gstRound((item.qty || 0) * (item.rate || 0));
  }
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

/* ===== A LINE FILLED FROM THE RECORD, AND A REASON FOR A RED FLAG =====
   Owner, 26 Sep 2026: "When I select C-Clamp 66x42(30x6) as we know all its value and std weight and
   rate, fill that out automatically so that me or anyone can click through it to verify and change if
   needed; if the change for the final amount is more than the conditions we have for matches which
   raises a red flag then ask for a reason." The fill never overwrites a figure somebody typed: each
   filled field is marked in item._auto until the operator types in it. */
function lineFillFromRecord(client, onDate, item, part) {
  if (!client || !item) return;
  item._auto = item._auto || {};
  if (!(item.rate > 0) || item._auto.rate) { item.rate = defaultLineRate(client, onDate, item); item._auto.rate = item.rate > 0; }
  // The weight per piece: the client's own card first (a part's weight is the customer's), else the
  // Items Master's standard weight, which is said to be the master's.
  var w = getPieceWeight(client, onDate, item.partNumber, item.desc);
  if (w && w.kg > 0) item._kgPc = { kg: w.kg, src: 'client card' };
  else if (part && part.stdWeightKg > 0) item._kgPc = { kg: part.stdWeightKg, src: 'Items Master' };
  else item._kgPc = null;
}
/* What the record fills into a counted line: pieces × rate is the amount on a piece line; pieces ×
   kg/pc is the kilograms on a weight line. Only into an empty field or one the record filled. */
function lineFillFromCount(client, item) {
  if (!client || !item) return;
  item._auto = item._auto || {};
  var piece = client.billingMode === 'piece' && item.unit === 'NOS';
  if (piece && item.qty > 0 && item.rate > 0 && (!(item.amount > 0) || item._auto.amount)) {
    item.amount = gstRound(item.qty * item.rate); item._auto.amount = true;
  }
  if (item.unit === 'KG' && item.nosQty > 0 && item._kgPc && (!(item.qty > 0) || item._auto.qty)) {
    item.qty = Math.round(item.nosQty * item._kgPc.kg * 1000) / 1000; item._auto.qty = true;
    item.amount = gstRound(item.qty * (item.rate || 0));
  }
}
/* ===== WHAT A CLIENT'S INVOICES ALWAYS CARRY (owner, 27 Sep 2026) =====
   "Dorabji Auto generally is despatched through only one way of transport … it's the same for every
   invoice, so let's make it so that the field is already filled out along with PO number, which is
   usually the same as their challan number with the suffix DA1/xxxxx." A client SETTING, never a
   hard-code: `defaultTransport` (the vehicle) and `poFromChallan`, a pattern where `{challan}` is the
   challan number and `{challan:5}` the same padded to five digits — DA1/{challan:5} makes challan
   1244 read DA1/01244. The invoice form applies both (create.js, createApplyClientDefaults). */
var PO_TPL_RE = /\{challan(?::(\d{1,2}))?\}/g;
function clientPoTemplateOk(tpl) { return !tpl || /\{challan(?::\d{1,2})?\}/.test(String(tpl)); }
/* The challan number a PO is made from: the first challan an invoice cites, its first run of digits
   ("0041/26-27" is 41), leading zeros off so the pattern pads it the one way. */
function poChallanDigits(challanNo) {
  var first = String(challanNo || '').split(/[,;]/)[0];
  var m = first.match(/\d+/);
  if (!m) return '';
  return m[0].replace(/^0+(?=\d)/, '');
}
function clientPoFromChallan(client, challanNo) {
  var tpl = client && String(client.poFromChallan || '').trim();
  var n = poChallanDigits(challanNo);
  if (!tpl || !n || !clientPoTemplateOk(tpl)) return '';
  return tpl.replace(PO_TPL_RE, function(_, w) { return w ? n.padStart(parseInt(w, 10), '0') : n; });
}

/* A challan-linked invoice line the challan cannot vouch for (create.js): billing more than is left
   on it, or billing it in another unit. The red flag's contract — a tap, a note recommended. */
var OVER_BILL_REASONS = [
  { id: 'dispatched', label: 'Customer dispatched more than the challan' },
  { id: 'challan', label: 'Challan quantity was wrong' },
  { id: 'other', label: 'Other' }
];
function unitChangeReasons(to) {
  return [
    { id: 'billing', label: to === 'KG' ? 'Customer bills this part by weight now' : 'Customer bills this part by pieces now' },
    { id: 'challan', label: 'Challan unit was wrong' },
    { id: 'other', label: 'Other' }
  ];
}
function challanAckReasonLabel(kind, ack) {
  if (!ack || !ack.reason) return '';
  var list = kind === 'over' ? OVER_BILL_REASONS : unitChangeReasons(ack.to);
  var r = list.find(function(x) { return x.id === ack.reason; });
  return r ? r.label : ack.reason;
}

var FLAG_REASONS = [
  { id: 'challan', label: 'Customer\'s challan says so' },
  { id: 'rate', label: 'Rate changed' },
  { id: 'weight', label: 'Weight differs this batch' },
  { id: 'other', label: 'Other' }
];
/* A red flag is the matcher's own Check or ×10 verdict, on the rate or on the weight. Differs asks nothing. */
function lineFlag(client, onDate, item) {
  var red = function(m) { return m && (m.status === 'check' || m.status === 'decimal'); };
  var rm = rateMatch(client, onDate, item);
  if (red(rm)) return { kind: 'rate', m: rm, value: item.rate };
  var wm = weightMatch(client, onDate, item);
  if (red(wm)) return { kind: 'weight', m: wm, value: item.qty };
  return null;
}
/* What a saved line carries about its flag: nothing when it is not flagged, so a line put right later
   drops a reason that no longer applies; the verdict it was given against when it is. */
function lineFlagFields(client, onDate, item) {
  var f = lineFlag(client, onDate, item);
  if (!f || !item.flagReason) return {};
  return { flagReason: item.flagReason, flagNote: item.flagNote || '', flagAt: { kind: f.kind, status: f.m.status, ref: f.m.ref, value: f.value } };
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
