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
    // Quotations (quote.js): a draft holds no number; issue takes the next of its financial year's series.
    quotations: [],
    qtnCfg: { signatory: '', signTitle: '', footNote: '', outside: {} },
    // Reconciliation exceptions. A disagreement the extra-check raised and a
    // human then examined becomes a RECORD carrying a required reason — the
    // same treatment `voidedNumbers` gives a number gap and `dupeAck` gives an
    // accepted duplicate. One recorded block already needs it (W33 Tue 11
    // Aug): the rule does not reproduce it, and that has to be precedent in
    // the system rather than a line in a document. (W31 Mon 27 Jul was named
    // here too, and is struck — tagged in the raw relay, under-booked, and
    // under-booking is never an error.)
    extraExceptions: [],
    // A deleted attendance day, kept whole with its required reason (attDeleteDay): History lists it.
    attendanceDeletes: [],
    // Every save, record by record, with who made it and on which device (changelog.js): History → Changes.
    changeLog: [],
    mergeHeld: [],
    prospects: [],
    lineShifts: [],
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
    labour: { otMult: 1.1, otCap: 68.2, otCapFrom: '2026-09-01', holidays: ['01-26', '08-15', '10-02'], restCreditMinDays: 6, extraRate: 47.5, modelPerKg: 3.55, gateFull: 0.9, gateHalf: 0.8, extraHoursPerHead: 8, snackOt: 20, snackNight: 60 },
    // Rate matcher thresholds (option E): Check at ≥ pct% off OR ≥ ₹stake on the line.
    rateCheck: { pct: 10, stake: 100, weightTol: 3 },
    // Turnaround and terms (flow.js, the entry faces' T1): working days from a challan to its despatch, days to pay an invoice;
    // the days the plant is shut (MM-DD every year, or a full date) and why, which Home's Plant shut marks (floor.js).
    flowCfg: { turnDays: 1, termsDays: 45, holidays: [], shutWhy: {} },
    // The office printer (remoteprint.js): sent to over GitHub, printed by the print station.
    printer: { on: false, name: '', address: '', cartridge: '' },
    // The news and the weather (feeds.js, UI pass 3 §9): the owner's feeds Worker and the plant's place. No place ships: it is
    // typed on the device, else read from the Office QR's (S.checkinCfg) when asked.
    feedsCfg: { on: true, url: 'https://feeds.somaelectro.co.in', lat: null, lon: null, place: '' },
    // The world outside (feeds.js, §16): Tata Motors' months as typed from its release, the plant's calendar by day, the models
    // whose headlines are followed, and each day's forecast as it stood when the weather was fetched (kept quietly, 400 days).
    market: { tata: {}, calendar: {}, models: ['Prima', 'Signa', 'Ultra', 'Azura'], weather: {} },
    invStateCheck: { createdAmber: 1, createdRed: 2, printedAmber: 1, printedRed: 2, dispatchedAmber: 3, dispatchedRed: 7, fileWarnDays: 3 },
    // Chemical stock: lines, the events that move them, and each pasted
    // message whole. Ships empty — the lines arrive with the first message.
    stock: { items: [], entries: [], pastes: [] },
    production: { entries: [], pastes: [], photos: [], imports: [], pages: [], learn: { clients: {}, parts: {} } },
    power: { load: {}, cfg: {}, items: {} },
    // The bank statement as imported (bank.js): rows merged by id, and what the operator set.
    bank: { rows: [], imports: [], parties: {}, opening: {}, cheques: [] },
    // Days of cover at which a line turns red / amber, and the cost model's
    // chemicals figure the measured one is reported against.
    stockCheck: { redDays: 3, amberDays: 7, chemModel: 1.57 },
    // The owner's to-do list: typed tasks (ticked, never deleted) and the
    // snoozes granted to app-raised ones, each against the figures it saw.
    todo: { tasks: [], snoozes: {} },
    // The guard (guard.js): who may use the app, each PIN kept only as a salted hash, and what each role opens and may change.
    users: [],
    guardCfg: typeof grdCfgDefaults === 'function' ? grdCfgDefaults() : { lockMinutes: 15, askMinutes: 5, roles: {}, recovery: null },
    // Every attendance roll pasted in, whole, with a fingerprint so the same
    // roll twice is refused (it would count every hour twice).
    relayPastes: [],
    relayLearn: { heads: {}, slots: {} },
    attRegister: { months: {}, names: {} },
    // The planner (planner.js): its registers and scenarios. A scenario never writes the book.
    planner: { cfg: {}, machines: [], checklist: [], lenders: [], heard: [], heldBack: [], scenarios: [] },
    // The plant register (plant.js): every barrel and tank, its status, and each change of status with its day.
    plant: { units: [], log: [] },
    // The owner's monthly check-in on each worker (people.js): half the motivation index.
    peopleCheckins: [],
    // Payments and advances made to workers, voided with a reason, never deleted.
    staffPayments: [],
    cashOut: [],
    cashPastes: [],
    payCarryClears: [],
    // Power and other monthly bills, for the live cost (voided, never deleted).
    costBills: [],
    payrollPaid: [],
    // Suppliers (suppliers.js): what the owner set on each (its balance on a day, lead time, GST, spellings), and the payments
    // made to them recorded here (cash, a cheque handed over), voided with a reason, never deleted.
    suppliers: [],
    supplierPays: [],
    // Fallbacks the live cost uses only where nothing is recorded yet.
    costModel: { power: 0.81, other: 0.42, zincKgMonth: 425, zincPerKg: 2.21 },
    // Which rules may raise a task, and their day thresholds.
    todoCheck: { stock: true, paste: true, cn: true, challan: true, dispatch: true, audit: true,
      backup: true, zinc: false, pasteDays: 2, challanDays: 3, dispatchDays: 2, backupDays: 7 },
    // The devices registered to push to and pull from GitHub while the guard is on (devices.js), removed with a reason.
    devices: [],
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
// readKind says why a copy could not be used ('' when it could): 'closed' (the database would not open), 'threw' (reading
// the database failed), 'lsThrew' (reading the localStorage copy failed), 'unparsed' (read, but it is not JSON), 'gone'
// (the database opened empty on a device that kept its book there). lastErrorOwn: the last save was refused by this app's
// own rule, not by the browser.
var _storageHealth = { lastSaveOk: null, lastSaveAt: 0, lastSaveChars: 0, lastError: '', lastErrorOwn: false, readError: '', readKind: '' };
// A stored copy that was read but would not parse, as it was read: the read banner exports it, and an import or a pull sets
// it aside (bookReleaseStandIn) before anything is written where it lay.
var _unreadable = null;
var _setAside = null;              // { raw, key }: to be written beside the book by the next save (writeGuarded)

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
// A copy waiting to be set aside (_setAside) is written beside it first, in the same write: moved, never written over.
function writeGuarded(str, expect, next) {
  var aside = _setAside;
  if (_storeMode === 'localStorage') {
    return new Promise(function(resolve, reject) {
      try {
        var cur = localStorage.getItem(LS_REV_KEY);
        if ((cur || null) !== (expect || null)) { reject(staleCopy(cur)); return; }
        if (aside) lsPutVerified(STORAGE_KEY + '_' + aside.key, aside.raw);
        lsPutVerified(STORAGE_KEY, str);
        localStorage.setItem(LS_REV_KEY, next);
        if (_setAside === aside) _setAside = null;
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
            if (aside) st.put(aside.raw, aside.key);
            var put = st.put(str, IDB_KEY);
            put.onerror = function() { failed = failed || put.error; };
            st.put(next, IDB_REV_KEY);
          } catch (e) { failed = e; tx.abort(); }
        };
        tx.oncomplete = function() { if (aside && _setAside === aside) _setAside = null; idbMarkHeld(); resolve(); };
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
    _storageHealth.readKind = 'lsThrew';
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
      _storageHealth.readKind = 'closed';
      return null;
    }
    if (_idbFailed) { _storeMode = 'localStorage'; try { _diskRev = localStorage.getItem(LS_REV_KEY); } catch (e) {} var lr = legacyRaw(); _loadedFrom = lr != null ? 'legacy' : 'none'; return lr; }
    _storeMode = 'idb';
    // Note whether the pre-IndexedDB copy is still occupying the shared pool,
    // so a verified write can hand that space back.
    try { _legacyKeyPresent = localStorage.getItem(STORAGE_KEY) != null; } catch (e) {}
    if (raw != null) { _loadedFrom = 'idb'; return raw; }
    // Open, and empty, on a device that has kept its book here: the book is gone (the browser evicted the database under
    // storage pressure, or it was cleared on its own), not a new device. It was taken for one: the default book went on
    // disk and, with auto-push on, to GitHub under the old SHA (the QA audit of 30 Sep 2026). A stand-in until a backup
    // is imported or pulled; nothing is written meanwhile, or the next start would take the stand-in for the book.
    if (idbHeldBook()) {
      _storageHealth.readError = 'the book this device kept is gone: its database opened empty';
      _storageHealth.readKind = 'gone';
      return null;
    }
    var legacy = legacyRaw();
    _loadedFrom = legacy != null ? 'legacy' : 'none';
    return legacy;
  }, function(e) {
    // The store exists but would not read. Nothing is written over it at boot.
    _storeMode = 'idb';
    _storageHealth.readError = describeStorageError(e);
    _storageHealth.readKind = 'threw';
    return null;
  }).then(function(raw) {
    if (raw == null) return null;
    try { return JSON.parse(raw); }
    catch (e) {
      _storageHealth.readError = 'stored copy does not parse (' + describeStorageError(e) + ')';
      _storageHealth.readKind = 'unparsed';
      _unreadable = raw;
      return null;
    }
  });
}

/* ===== A STAND-IN BOOK =====
   While the stored copy could not be used (_storageHealth.readError: it would not read, or it is gone), the book in memory
   is the default the app starts on: a stand-in, not this device's book. Nothing is written over the stored copy
   (persistState), and nothing from the stand-in leaves the device as if it were the book: auto-push does not arm, a push by
   hand asks naming both sides (ghPush), the read banner exports the stored copy as it is and an export of the stand-in is
   no backup (exportData), and the Windows widget's ticks wait (todoApplyWidgetQueue). The SHA guard could not see any of
   it: GitHub's copy had not moved, so ~45 s after the start the stand-in went over it unasked (the QA audit of 30 Sep
   2026). The way out is an import or a pull the owner confirms: a copy read but not parseable is set aside first, under
   a key of its own that nothing reads or deletes, and the incoming book is written where it lay. */
function bookStandIn() { return !!_storageHealth.readError; }
function bookStandInWords() {
  return _storageHealth.readKind === 'gone' ? 'the book this device kept is gone, and this window holds a stand-in'
    : 'the stored copy could not be read (' + _storageHealth.readError + ')';
}
// Why an import or a pull cannot end the stand-in ('' when it can): where the stored copy cannot be set aside, writing
// the incoming book would go over it.
function bookStandInBlocker() {
  var k = _storageHealth.readKind;
  if (!bookStandIn() || k === 'gone' || (k === 'unparsed' && _unreadable != null)) return '';
  // The copy that would not read is the old localStorage one; the book goes to the database beside it, and it stays.
  if (k === 'lsThrew' && _storeMode === 'idb' && !_idbFailed) return '';
  if (k === 'closed') return 'nothing can be written on this device: ' + _storageHealth.readError;
  return 'nothing can be written on this device: the stored copy could not be read (' + _storageHealth.readError +
    '), so it cannot be set aside first. Reload the app; if this keeps happening, run the storage diagnostics in Settings';
}
// What replacing the book does to the stand-in, for the question an import or a pull asks.
function bookStandInReplaceText() {
  if (_storageHealth.readKind === 'gone') return 'The book this device kept is gone, and this window holds a stand-in: this becomes the book on this device.';
  return 'This device\'s stored copy could not be read (' + _storageHealth.readError + '). ' + (_unreadable != null
    ? 'It is set aside, kept whole and never deleted, and this becomes the book on this device.'
    : 'It is left where it is, and this becomes the book on this device.');
}
// After the owner confirmed an import or a pull, before its book is saved. Returns '' once over, else why it cannot be.
function bookReleaseStandIn() {
  var why = bookStandInBlocker();
  if (why || !bookStandIn()) return why;
  if (_unreadable != null) _setAside = { raw: _unreadable, key: 'unreadable-' + Date.now() };
  _unreadable = null;
  _storageHealth.readError = '';
  _storageHealth.readKind = '';
  hideStorageBanner('read');
  return '';
}
// Why the last save did not land: the app's own refusal in its own words, a browser's error named as the browser's.
function saveFailText() {
  var h = _storageHealth;
  return h.lastErrorOwn ? h.lastError : 'the browser refused to store it (' + h.lastError + ')';
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
// Every save asked for in this window, counted when it is asked: what is worked out from the book and kept (the search
// index, search.js) is worked out again once this moves. A book loaded whole (another window's, an import, a pull) is
// a new S, which says so by itself.
var _bookWrites = 0;

function persistState() {
  _bookWrites++;
  // A copy that exists but would not read is never written over: seeding a
  // default book on top of it would turn an unreadable copy into a lost one.
  // The boot banner says so; every save this session reports false.
  if (bookStandIn()) {
    _storageHealth.lastSaveOk = false;
    _storageHealth.lastSaveAt = Date.now();
    _storageHealth.lastError = 'not written: ' + bookStandInWords();
    _storageHealth.lastErrorOwn = true;
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
    _storageHealth.lastErrorOwn = false;
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
    _storageHealth.lastErrorOwn = false;
    showStorageBanner('This browser did not keep the last save (' + why + '). ' +
      'Anything entered now is in memory only and will be lost on reload. Export a backup.');
  } else {
    showToast('Could not save ' + key + ' (' + why + ')', 'error');
  }
  return false;
}

// kind: 'save' (cleared by the next save that lands) or 'read' (a fact about
// this load; stays for the session, or until an import or a pull ends it).
// actionsHtml: the bar's buttons; a failed save's is Export JSON, since what was typed lives only in memory.
function showStorageBanner(msg, kind, actionsHtml) {
  kind = kind || 'save';
  hideStorageBanner(kind);
  var bar = document.createElement('div');
  bar.className = 'inv-storage-bar';
  bar.dataset.kind = kind;
  bar.setAttribute('role', 'alert');
  bar.innerHTML = '<span class="inv-update-text">' + escHtml(msg) + '</span>' +
    '<span class="inv-update-actions">' + (actionsHtml != null ? actionsHtml :
    '<button class="inv-btn inv-btn-primary inv-update-btn" data-action="invExportData">Export JSON</button>') + '</span>';
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
  'voidedNumbers', 'creditNotes', 'extraExceptions', 'attendanceDeletes', 'staff', 'attendance', 'areaTargets', 'shiftNeeds', 'stock', 'todo', 'relayPastes', 'relayLearn', 'attRegister', 'planner', 'staffPayments', 'cashOut', 'cashPastes', 'payCarryClears', 'costBills', 'payrollPaid', 'suppliers', 'supplierPays', 'bank', 'production', 'quotations',
  'devices', 'market'];
// Config objects are the opposite: a missing one is filled from the defaults,
// and so is a missing KEY inside one. `labourCfg()` reads `extraRate || 0`, so
// a backup predating a constant would silently price the extra at nothing
// rather than at ₹47.50 — a wrong number, not a visible gap.
var STATE_CONFIGS = ['labour', 'rateCheck', 'stockCheck', 'todoCheck', 'invStateCheck', 'qtnCfg', 'flowCfg', 'printer', 'feedsCfg'];

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
  // The market's four stores (feeds.js): each its own shape, filled empty; the models followed take the default only where
  // there is no list at all (a list emptied by the owner stays empty).
  var mk = s.market && typeof s.market === 'object' && !Array.isArray(s.market) ? s.market : (s.market = {});
  ['tata', 'calendar', 'weather'].forEach(function(k) { if (!mk[k] || typeof mk[k] !== 'object' || Array.isArray(mk[k])) mk[k] = {}; });
  if (!Array.isArray(mk.models)) mk.models = d.market.models.slice();
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
  // Replacing the book takes its users and the guard's settings with it: the owner's alone (guard.js grdBookAsk), here
  // too, whatever door it came through. Nothing is touched before the refusal.
  if (typeof grdOn === 'function' && grdOn() && !grdIsOwner()) throw new Error('only the owner replaces the book: ask the owner');
  // Who is replacing it, read off this book: the one coming in may not hold them (the change log's line, QA4-10).
  var by = typeof chgBy === 'function' ? chgBy() : null;
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
  // A book adopted whole is one line in the change log and where it starts comparing from (changelog.js), under the
  // person who brought it in.
  if (typeof chgAdopted === 'function') { if (typeof chgAs === 'function') chgAs(by, chgAdopted); else chgAdopted(); }
  // The book's users may differ: a session whose user it does not hold is locked (guard.js).
  if (typeof grdRecheck === 'function') grdRecheck();
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
/* The cursor put in a field a moment after a screen opens (Create's client search, the challan form's), unless meanwhile a
   click or a tap went somewhere else, or another field took it: the late focus pulled the cursor back from where it had
   been put, and on a slow machine the next key meant for the app was typed into the field (P139 on CI, 5 Oct 2026).
   Typing meanwhile still lands in the field. */
function focusSoon(el, ms) {
  var pressed = false, mark = function() { pressed = true; };
  document.addEventListener('pointerdown', mark, true);
  setTimeout(function() {
    document.removeEventListener('pointerdown', mark, true);
    var a = document.activeElement;
    if (pressed || !el || !el.isConnected || (a && a !== el && a.matches && a.matches('input, textarea, select'))) return;
    el.focus();
  }, ms == null ? 100 : ms);
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
/* A deck (§6.22) showing its first n cards and the rest one tap away. The rest are drawn hidden inside the deck and the
   button sits under it, outside the grid, so it never holds a column open beside the cards. */
function uiMoreDeckHtml(key, cards, opts) {
  opts = opts || {};
  var n = opts.n != null ? opts.n : UI_MORE_ROWS, attrs = opts.attrs || '';
  if (cards.length <= n || _uiMoreShown[key]) return '<div class="inv-deck"' + attrs + '>' + cards.join('') + '</div>';
  var hide = function(h) { return h.replace(/^(\s*<[a-z]+)(\s|>)/i, '$1 data-more-of="' + escHtml(key) + '" hidden$2'); };
  return '<div class="inv-deck"' + attrs + '>' + cards.map(function(c, i) { return i < n ? c : hide(c); }).join('') + '</div>' +
    '<div class="inv-deck-more" data-more-btn="' + escHtml(key) + '"><button type="button" class="inv-btn inv-btn-link inv-btn-sm" data-action="invShowMore" data-key="' + escHtml(key) + '">Show ' +
    (cards.length - n) + ' more' + (opts.noun ? ' ' + opts.noun : '') + ' · ' + cards.length + ' in all</button></div>';
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
/* A card drawn as a panel, folded to its head: the same card, its head a summary. Only a card whose head holds no
   button or block of its own is folded (a tap on a button in a summary would open and shut the card too); any other
   is returned as it was. */
function uiFoldCard(key, card, dflt) {
  var m = /^(\s*)<div class="inv-panel inv-panel-flush([^"]*)"([^>]*)>\s*<div class="inv-panel-head">([\s\S]*?)<\/div>/.exec(card || '');
  if (!m || /<button|<div/.test(m[4]) || !/<\/div>\s*$/.test(card)) return card;
  var rest = card.slice(m[0].length).replace(/<\/div>\s*$/, '');
  return m[1] + '<details class="inv-panel inv-panel-flush inv-panel-fold' + m[2] + '"' + m[3] + ' data-fold="' + escHtml(key) + '"' + (uiFoldOpen(key, dflt) ? ' open' : '') + '>' +
    '<summary class="inv-panel-head">' + m[4] + '</summary>' + rest + '</details>';
}
/* An analysis on screen (§6.27; owner, 9 Oct 2026: "The times lost most reads like a block of text … not presented according to
   our benchmark", and "lots of new chaotic text data is entering due to the analysis"). The verdict leads; its factors are tiles;
   the working is folded under them, shut until opened and remembered on the device: one fact a row, a label of a few words, its
   figure at the end, at most a few words under the label, and where a figure comes from as a badge, never a clause. How the
   analysis works is the screen's guide (kbguides.js). Every field is plain text, escaped here.
   A fact: { label, value, sub, wrap (the sub wraps whole where its facts must all be read: who made a held version), src: [tone,
   word], tone (the figure's, §3c: whether it is good), attrs, actions (HTML: the caller escapes) }. A value null or '' is
   withheld: a dash. */
function _uiFactInner(f) {
  var v = f.value != null && f.value !== '' ? figHtml(escHtml(String(f.value)), /^(ok|warning|danger)$/.test(f.tone || '') ? f.tone : null) : '&mdash;';
  return '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(f.label) +
    (f.src ? ' <span class="inv-badge inv-badge-' + uiTone(f.src[0]) + '">' + escHtml(f.src[1]) + '</span>' : '') + '</span>' +
    (f.sub ? '<span class="inv-row-meta' + (f.wrap ? ' inv-row-wrap' : '') + '">' + escHtml(f.sub) + '</span>' : '') + '</span>' +
    // A fact's own move (a Change beside a default): the figure and its buttons, a line of their own under it on the phone.
    (f.actions ? '<span class="inv-row-end inv-row-actions"><span class="inv-num">' + v + '</span>' + f.actions + '</span>'
      : '<span class="inv-row-end ' + (f.count ? 'inv-panel-count' : 'inv-num') + '">' + v + '</span>');
}
function uiFactRowHtml(f) { return '<div class="inv-row' + (f.sub ? ' inv-row-2' : '') + (f.actions ? ' inv-row-flow' : '') + '"' + (f.attrs || '') + '>' + _uiFactInner(f) + '</div>'; }
/* A row that folds open to the facts it rests on: its head is a fact (`head`, the same shape; `count` draws its value as a
   count), its facts the rows under it. Shut until opened, remembered on the device under `key`. */
function uiFoldRowHtml(key, head, facts, attrs) {
  return '<details class="inv-row-fold" data-fold="' + escHtml(key) + '"' + (attrs || '') + (uiFoldOpen(key, false) ? ' open' : '') + '>' +
    '<summary class="inv-row' + (head.sub ? ' inv-row-2' : '') + '"' + (head.attrs || '') + '>' + _uiFactInner(head) + '</summary>' +
    '<div class="inv-row-children">' + (facts || []).filter(Boolean).map(uiFactRowHtml).join('') + '</div></details>';
}
/* The working under an analysis's factors: "How it's worked out", the count of facts at its end. */
function uiWorkingHtml(key, facts, title, attrs) {
  var list = (facts || []).filter(Boolean);
  if (!list.length) return '';
  return uiFoldRowHtml(key, { label: title || 'How it’s worked out', value: list.length, count: true }, list, attrs);
}
/* A hero card (§6.21): a <details> that folds open to its body, or a plain card where it has none. `o`: tone (a status tone
   word, else the theme's gradient), eyebrow / title / fig / sub / viz / body (HTML: the caller escapes what came from the
   user), open (its default), fold (the key its open or shut is remembered under on the device; none, it opens as drawn),
   vital (a question tile: one column, the figure first), foot (its own links and buttons, HTML), attrs (more attributes). */
function uiHeroHtml(o) {
  var tone = o.tone && /^(danger|warning|ok|info|neutral)$/.test(o.tone) ? ' inv-hero-' + o.tone : '';
  var cls = 'inv-hero' + tone + (o.vital ? ' inv-hero-vital' : '') + (o.cls ? ' ' + o.cls : '');
  var head = (o.eyebrow ? '<span class="inv-hero-eyebrow">' + o.eyebrow + '</span>' : '') +
    (o.vital ? (o.fig ? '<span class="inv-hero-fig">' + o.fig + '</span>' : '') + (o.title ? '<span class="inv-hero-title">' + o.title + '</span>' : '')
      : (o.title ? '<span class="inv-hero-title">' + o.title + '</span>' : '') + (o.fig ? '<span class="inv-hero-fig">' + o.fig + '</span>' : '')) +
    (o.sub ? '<span class="inv-hero-sub">' + o.sub + '</span>' : '') + (o.viz ? '<span class="inv-hero-viz">' + o.viz + '</span>' : '');
  // A hero's own links and buttons (`foot`): under its head, or under its body where it folds (shut, the head says enough).
  var foot = o.foot ? '<div class="inv-hero-foot">' + o.foot + '</div>' : '';
  if (o.body == null) return '<div class="' + cls + '"' + (o.attrs || '') + '><div class="inv-hero-head">' + head + '</div>' + foot + '</div>';
  var open = o.fold ? uiFoldOpen(o.fold, o.open) : !!o.open;
  return '<details class="' + cls + '"' + (o.fold ? ' data-fold="' + escHtml(o.fold) + '"' : '') + (o.attrs || '') + (open ? ' open' : '') + '>' +
    '<summary class="inv-hero-head">' + head + '</summary><div class="inv-hero-body">' + o.body + '</div>' + foot + '</details>';
}
/* One set of blank states (docs/UI_PASS_3.md §7c, §14b): what a widget, a list or a chart says when it has nothing to show, in one
   component. `o`: kind ('empty' nothing recorded yet, 'early' too little to say it surely, 'offline' no signal, 'notset' a setting
   needed, 'error' it could not be drawn, 'loading' it is being fetched), title and body (text, escaped here), action (HTML: a button
   or link its caller built), small (one line, for a Small widget or a chart's empty box). Never a zero standing for unknown. */
var UI_BLANK_ICON = { empty: 'box', early: 'clock', offline: 'rss', notset: 'settings', error: 'caution', loading: 'sync' };
function uiBlankHtml(o) {
  o = o || {};
  var kind = UI_BLANK_ICON[o.kind] ? o.kind : 'empty';
  var icon = typeof iconSvg === 'function' ? iconSvg(o.icon || UI_BLANK_ICON[kind]) : '';
  return '<div class="inv-blank' + (o.small ? ' inv-blank-sm' : '') + '" data-blank="' + kind + '"' + (kind === 'loading' ? ' aria-busy="true"' : '') + '>' +
    '<span class="inv-blank-icon">' + icon + '</span><div class="inv-blank-text">' +
    (o.title ? '<p class="inv-blank-title">' + escHtml(o.title) + '</p>' : '') +
    (o.body && !o.small ? '<p class="inv-blank-body">' + escHtml(o.body) + '</p>' : '') + '</div>' +
    (o.action ? '<div class="inv-blank-act">' + o.action + '</div>' : '') + '</div>';
}
/* ===== ONE LOOK'S PIECES (docs/TAB_MAP.md §3e; design §6.28, §6.6, §6.7) =====
   The owner, 9 Oct 2026: "UI still feels inconsistent to me". The components were alike everywhere; how each screen was put
   together was not: of 60 phone screens, 34 led with no summary and the rest five different ways. These are the pieces every
   screen is assembled from: a work screen leads with its verdict card, then one toolbar row (the filters behind Filter on the
   phone, everything else behind More), what needs the owner as rows, the list, the rest folded; a row ends in its figure and
   its status, or one action. */

/* The verdict card (§6.28): one hero saying how the screen stands. `o`: screen (the eyebrow: the screen and its period or
   count), verdict (a sentence of 60 characters at most, said in `tone`, the worst of what the card holds), fig (its key figure,
   HTML), facts (up to three short texts under it, each a string or {text, tone}), viz (a meter or sparkline, HTML), factors (up to
   four tiles, uiFactorTileHtml's shape; tilesAttrs on their strip), body (more of the card, HTML), links (up to two buttons or
   links for its foot, HTML), key (the device remembers the
   card open or shut under it). A verdict naming rupees carries money: true and its count in `plain`, which a role that does not
   see money reads instead (I4); a fact or a factor with money: true is left out for that role. Shut on the phone, where its line
   still answers the six-second test; open on the desktop; either until the owner moves it. Over its limits it says so to a test
   build (data-verdict-long, which P197 fails on) rather than throwing: a long client name must not take a screen down. */
var UI_VERDICT_MAX = 60;
function uiVerdictHtml(o) {
  var money = typeof grdSeesMoney !== 'function' || grdSeesMoney();
  var verdict = String((o.money && !money ? o.plain : o.verdict) || '');
  var keep = function(f) { return f && (typeof f === 'string' || !f.money || money); };
  // A fact is text, or {text, tone, money}: a toned fact is coloured in its tone (§3c), beside the words that give the reason.
  var facts = (o.facts || []).filter(keep).map(function(f) { return typeof f === 'string' ? { text: f } : f; }).filter(function(f) { return f && f.text; });
  var factors = (o.factors || []).filter(keep), links = (o.links || []).filter(Boolean);
  var long = verdict.length > UI_VERDICT_MAX || facts.length > 3 || factors.length > 4 || links.length > 2;
  if (long && typeof navigator !== 'undefined' && navigator.webdriver) console.error('uiVerdictHtml over its limits: ' + verdict);
  var n = Math.min(factors.length, 4);
  var tiles = n ? '<div class="inv-hero-sheet"><div class="inv-tiles' + (n === 4 ? ' inv-tiles-4' : n === 3 ? ' inv-tiles-3' : '') + '"' + (o.tilesAttrs || '') + '>' +
    factors.slice(0, 4).map(uiFactorTileHtml).join('') + '</div></div>' : '';
  var body = tiles + (o.body || '');
  var sub = facts.slice(0, 3).map(function(f) {
    return '<span class="inv-hero-fact' + (/^(ok|warning|danger)$/.test(f.tone || '') ? ' inv-fig-' + f.tone : '') + '">' + escHtml(f.text) + '</span>';
  }).join('');
  // A card of facts alone (no tiles, no body) is a plain card, its facts always shown. `foldFacts` folds them under its line on
  // the phone, so the card shut is the line alone (owner, 13 Oct 2026, of the cards Invoiced, Training and Troubleshoot gained).
  var foldFacts = !!(o.foldFacts && !_isDesktop && !body && sub);
  return uiHeroHtml({ tone: /^(danger|warning|ok|info|neutral)$/.test(o.tone) ? o.tone : 'neutral', eyebrow: escHtml(o.screen || ''),
    title: escHtml(verdict), fig: o.fig || '', viz: o.viz || '',
    sub: foldFacts ? '' : sub,
    body: foldFacts ? '<div class="inv-hero-sub">' + sub + '</div>' : body || null, fold: 'v-' + (o.key || uiVerdictKey()), open: !!_isDesktop, foot: links.slice(0, 2).join(''),
    attrs: ' data-verdict data-card="verdict"' + (long ? ' data-verdict-long' : '') + (o.attrs || '') });
}
/* A verdict naming something typed (a cause, a client): the name cut at a word so that it and its tail fit the card's 60
   characters, an ellipsis where it was cut. */
function uiVerdictFit(name, tail) {
  name = String(name || ''); tail = String(tail || '');
  var room = UI_VERDICT_MAX - tail.length;
  if (name.length <= room) return name + tail;
  var cut = name.slice(0, Math.max(1, room - 1)), sp = cut.lastIndexOf(' ');
  return (sp > room / 2 ? cut.slice(0, sp) : cut).replace(/[\s,.;:·-]+$/, '') + '\u2026' + tail;
}
/* The card's default key: the page and its view, so each view's card is remembered open or shut on its own. */
function uiVerdictKey() {
  var loc = typeof navLoc === 'function' ? navLoc() : { tab: navPageOf(), v: '' };
  var v = String(loc.v || '').split('/')[0];
  return loc.tab + (v ? '-' + v : '');
}
/* A factor: a coded tile (§6.26). `f`: label and sub (text), fig (HTML: a figure, already formatted), tone; `badge` [tone, word]
   says beside the label what the figure is not (measured, weighed: §3c's certainty as a badge); `delta` (HTML, figDeltaHtml's)
   is the figure's change line against its benchmark, under the sub as Home's tiles carry it; a factor that filters its list
   carries `action` (and `attrs`, `pressed`), drawn as a button keeping aria-pressed. A fig left out reads as a dash. */
function uiFactorTileHtml(f) {
  var tone = /^(danger|warning|ok|info|neutral)$/.test(f.tone) ? ' inv-tile-' + f.tone : '';
  var badge = f.badge ? ' <span class="inv-badge inv-badge-' + uiTone(f.badge[0]) + '">' + escHtml(f.badge[1]) + '</span>' : '';
  var inner = '<div class="inv-tile-label">' + escHtml(f.label || '') + badge + '</div><div class="inv-tile-value">' + (f.fig == null || f.fig === '' ? '&mdash;' : f.fig) + '</div>' +
    (f.sub ? '<div class="inv-tile-sub"' + (f.subTitle ? ' title="' + escHtml(f.subTitle) + '"' : '') + '>' + escHtml(f.sub) + '</div>' : '') +
    (f.delta ? '<div class="inv-tile-sub" data-tile-delta>' + f.delta + '</div>' : '');
  if (f.action) return '<button type="button" class="inv-tile' + tone + '" data-action="' + escHtml(f.action) + '"' + (f.attrs || '') +
    (f.pressed != null ? ' aria-pressed="' + !!f.pressed + '"' : '') + '>' + inner + '</button>';
  return '<div class="inv-tile' + tone + '"' + (f.attrs || '') + '>' + inner + '</div>';
}

/* A row's end (§1a-11): its figure and its status (a dot and a word), or one action. `fig` HTML (formatted), `status` {tone,
   word}, `action` the one button's HTML. A row with more to do than one action puts the rest in uiRowMoreHtml. */
function uiRowEndHtml(fig, status, action) {
  var dot = status && status.word ? '<span class="inv-dot inv-dot-' + uiTone(status.tone) + '">' + escHtml(status.word) + '</span>' : '';
  return '<span class="inv-row-end' + (fig && dot ? ' inv-row-end-stack' : '') + '">' + (fig ? '<span class="inv-num">' + fig + '</span>' : '') + dot + (action || '') + '</span>';
}
/* A row's second and third actions: in the row's fold on the phone (the caller draws them where the row opens), and nowhere on
   the desktop, where the pane beside the list draws them with the record. `actions`: the buttons' HTML. */
function uiRowMoreHtml(actions) {
  var list = (actions || []).filter(Boolean);
  if (_isDesktop || !list.length) return '';
  return '<div class="inv-row-actions" data-row-more>' + list.join('') + '</div>';
}

/* ---------- The icon set, v3 (docs/UI_PASS_3.md §4; owner, 15 Oct 2026: "We'll need an upgraded icon set") ----------
   One set for the whole app, on one 24-unit grid with one stroke (1.75, round ends and joins), each glyph inside 2–22 so none
   looks larger than its neighbour. Common shapes are Lucide's (lucide-static 0.460.0); the plant's own things (a VAT line, a
   barrel, the pickling beaker, a rack, zinc, a chemical drum, a part, overtime, a heavy truck, a cheque) are drawn to match, from
   the design canvas's board ("Icon set v3, second go").
   Two inks: the line is the text's colour, and a thing's main part carries one tint, a path stored with its data prefixed `d:`
   and drawn fill-only as .inv-ico-tint (the accent at a fifth; the tone in a toned place, so a tint never says a status by
   itself). A control (a chevron, a cross, a tick, an action) and a drawing of lines alone (history, sync, a trend) carry none.
   Every screen reads the set by name (iconSvg) or by its paths (iconPathSvg, ICONS.<name>); body.html's icons are slots filled
   from it at boot (iconFill), so the set has one source. Charts, the QR and a few of the plant's figures draw their own; the
   brand's mark is markSvg. HR-4: inline SVG, never an emoji.

   The shapes from Lucide carry its licence, and those Lucide took from Feather carry Feather's, in full as Lucide publishes
   them (github.com/lucide-icons/lucide, LICENSE). The app shows them at Settings → Data & device → Backup, storage & build →
   Licences (ICON_LICENCES).

   ISC License

   Copyright (c) 2026 Lucide Icons and Contributors

   Permission to use, copy, modify, and/or distribute this software for any
   purpose with or without fee is hereby granted, provided that the above
   copyright notice and this permission notice appear in all copies.

   THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

   ---

   The following Lucide icons are derived from the Feather project:

   airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left,
   arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle,
   arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right,
   chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns,
   command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down,
   corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign,
   download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy,
   link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus,
   monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle,
   percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar,
   smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle,
   x-octagon, x-square, x, zoom-in, zoom-out

   The MIT License (MIT) (for the icons listed above)

   Copyright (c) 2013-present Cole Bemis

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE. */
var ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
var ICONS = {
  // Moves and actions (Lucide): a control is its line alone
  back: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  filter: '<path d="M21 4H14"/><path d="M10 4H3"/><path d="M21 12H12"/><path d="M8 12H3"/><path d="M21 20H16"/><path d="M12 20H3"/><path d="M14 2V6"/><path d="M8 10V14"/><path d="M16 18V22"/>',
  search: '<path d="d:M3 11a8 8 0 1 0 16 0a8 8 0 1 0-16 0z"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  flip: '<path d="M16.5 3.5 20 7l-3.5 3.5"/><path d="M4 11.5V10a3 3 0 0 1 3-3h13"/><path d="M7.5 20.5 4 17l3.5-3.5"/><path d="M20 12.5V14a3 3 0 0 1-3 3H4"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  print: '<path d="d:M7 14h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11V17"/><path d="M14 11V17"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  sync: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  // Status (§3d): ok done, warning alert, danger cancel, info info. The shape is tinted, so in a toned place it fills in the tone
  done: '<path d="d:M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z"/><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  alert: '<path d="d:m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  cancel: '<path d="d:M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z"/><path d="m15 9-6 6"/><path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z"/><path d="m9 9 6 6"/>',
  info: '<path d="d:M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z"/><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  caution: '<path d="d:M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z"/><circle cx="12" cy="12" r="10"/><path d="M12 8V12"/><path d="M12 16H12.01"/>',
  clock: '<path d="d:M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z"/><circle cx="12" cy="12" r="10"/><path d="M12 6 12 12 16 14"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
  // Doors and tools
  home: '<path d="d:M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  today: '<path d="d:M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0z"/><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  office: '<path d="d:M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2z"/><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect x="2" y="6" width="20" height="14" rx="2"/>',
  floor: '<path d="d:M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>',
  money: '<path d="d:M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  add: '<path d="d:M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z"/><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
  mine: '<path d="d:M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z"/><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>',
  // The gear (Lucide settings); Filter is the sliders, so the two never look alike
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  // Lucide’s open book; the board tints its left page
  book: '<path d="d:M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3z"/><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  widgets: '<path d="d:M4 3h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"/><path d="d:M15 12h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"/><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  // Lucide scan-qr-code (the board drew qr-code; the spec names the scan)
  idscan: '<path d="d:M8 7h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/><path d="M17 12v4a1 1 0 0 1-1 1h-4"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M17 8V7"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M7 17h.01"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="5" height="5" rx="1"/>',
  // Office and money
  invoice: '<path d="d:M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M12 17.5 8 15h1a4 4 0 0 0 0-8"/><path d="M8 11h8"/>',
  challan: '<path d="d:M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  client: '<path d="d:M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  quote: '<path d="d:M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="m13 17-5-1h1a4 4 0 0 0 0-8"/>',
  creditNote: '<path d="d:M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/>',
  pipeline: '<path d="d:M5 3h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z"/><rect x="3" y="3" width="8" height="8" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  dispatch: '<path d="d:M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  prospect: '<path d="d:M6 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0z"/><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  bank: '<path d="d:M12 2 20 7 4 7z"/><path d="M3 22H21"/><path d="M6 18V11"/><path d="M10 18V11"/><path d="M14 18V11"/><path d="M18 18V11"/><path d="M12 2 20 7 4 7z"/>',
  // Drawn for SEP (the board)
  cheque: '<path d="d:M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h5M16 10h2M6 14.5c.8-1 1.6-1 2.4 0s1.6 1 2.4 0M15 14.5h3"/>',
  cash: '<path d="d:M2 8a6 6 0 1 0 12 0a6 6 0 1 0-12 0z"/><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  gst: '<path d="d:M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m15 9-6 6"/><path d="M9 9h.01"/><path d="M15 15h.01"/>',
  // The board tints the wallet’s body; Lucide’s clasp stands out of it
  wages: '<path d="d:M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  owed: '<path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/>',
  forecast: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7 22 7 22 13"/>',
  report: '<path d="d:M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 18v-1"/><path d="M12 18v-6"/><path d="M16 18v-3"/>',
  // Things: the main part tinted, as the board tints its own
  file: '<path d="d:M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  filePlus: '<path d="d:M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
  fileUp: '<path d="d:M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 12v6"/><path d="m15 15-3-3-3 3"/>',
  box: '<path d="d:M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
  boxPlus: '<path d="d:M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="M16 16h6"/><path d="M19 13v6"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><path d="M3.29 7 12 12 20.71 7"/><path d="M12 22V12"/>',
  flask: '<path d="d:M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M16 11 18 13 22 9"/>',
  message: '<path d="d:M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  task: '<path d="d:M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2z"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/>',
  clipboard: '<path d="d:M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  clipboardCheck: '<path d="d:M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  tag: '<path d="d:M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  note: '<path d="d:M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  shield: '<path d="d:M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  phone: '<path d="d:M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  compass: '<path d="d:M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/>',
  // The plant, drawn for SEP (the design canvas’s board: vat, barrel, pickling, rack, zinc, chemical, part, overtime), and its tools
  vat: '<path d="d:M3 10h18v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M3 4h18M8 4v7M16 4v7"/><path d="M3 10h18v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M6 14c1.5.8 3 .8 4.5 0s3-.8 4.5 0 3 .8 4.5 0"/>',
  // The axle’s ends stop at 2 and 22, the grid’s clear edge (the board drew them to 1.5 and 22.5)
  barrel: '<path d="d:M6.5 6h11l3.5 6-3.5 6h-11L3 12z"/><path d="M6.5 6h11l3.5 6-3.5 6h-11L3 12z"/><path d="M9 6v12M15 6v12M2 12h1M21 12h1"/>',
  pickling: '<path d="d:M6 12h12v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z"/><path d="M4.5 3h15M6 3v15a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V3"/><path d="M6 12h12v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z"/><circle cx="10" cy="16" r="1"/><circle cx="14.5" cy="14.5" r=".8"/>',
  rack: '<path d="d:M7 8.5h3v2H7zM7 12.5h3v2H7zM7 16.5h3v2H7zM14 8.5h3v2h-3zM14 12.5h3v2h-3zM14 16.5h3v2h-3z"/><path d="M12 2v3M5 5h14M7 5v15M17 5v15"/><path d="M7 8.5h3v2H7zM7 12.5h3v2H7zM7 16.5h3v2H7zM14 8.5h3v2h-3zM14 12.5h3v2h-3zM14 16.5h3v2h-3z"/>',
  zinc: '<path d="d:M2.5 20l2-5.5h15l2 5.5z"/><path d="d:M6.5 12.5l1.7-5h7.6l1.7 5z"/><path d="M2.5 20l2-5.5h15l2 5.5z"/><path d="M6.5 12.5l1.7-5h7.6l1.7 5z"/>',
  chemical: '<path d="d:M5 5v14c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5"/><path d="M5 5a7 2.5 0 1 0 14 0a7 2.5 0 1 0-14 0z"/><path d="M5 5v14c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5"/><path d="M5 10c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5M5 15c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
  part: '<path d="d:M6.25 3h3.5a.75 .75 0 0 1 .75 .75v1.5a.75 .75 0 0 1-.75 .75h-3.5a.75 .75 0 0 1-.75-.75v-1.5a.75 .75 0 0 1 .75-.75z"/><path d="d:M14.25 3h3.5a.75 .75 0 0 1 .75 .75v1.5a.75 .75 0 0 1-.75 .75h-3.5a.75 .75 0 0 1-.75-.75v-1.5a.75 .75 0 0 1 .75-.75z"/><path d="M8 6v6a4 4 0 0 0 8 0V6M3 9h18"/><rect x="5.5" y="3" width="5" height="3" rx=".75"/><rect x="13.5" y="3" width="5" height="3" rx=".75"/>',
  weight: '<path d="d:M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z"/><circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z"/>',
  worker: '<path d="d:M3 15h18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-18a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M14 6a6 6 0 0 1 6 6v3"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><rect x="2" y="15" width="20" height="4" rx="1"/>',
  idcard: '<path d="d:M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2z"/><path d="M16 10h2"/><path d="M16 14h2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="5" width="20" height="14" rx="2"/>',
  attendance: '<path d="d:M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2z"/><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  overtime: '<path d="M21 12a9 9 0 1 0-9 9"/><path d="M12 7v5l3 2M19 15v6M16 18h6"/>',
  zap: '<path d="d:M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  cut: '<path d="M10.513 4.856 13.12 2.17a.5.5 0 0 1 .86.46l-1.377 4.317"/><path d="M15.656 10H20a1 1 0 0 1 .78 1.63l-1.72 1.773"/><path d="M16.273 16.273 10.88 21.83a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14H4a1 1 0 0 1-.78-1.63l4.507-4.643"/><path d="m2 2 20 20"/>',
  efficiency: '<path d="d:M3.34 19a10 10 0 1 1 17.32 0"/><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  wrench: '<path d="d:M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  // Market and analysis. The heavy truck, drawn for SEP (dispatch is Lucide’s van)
  truck: '<path d="d:M9 5h12a1 1 0 0 1 1 1v11H9z"/><path d="M9 5h12a1 1 0 0 1 1 1v11H9z"/><path d="M9 17V9H5.2a1 1 0 0 0-.9.55L2.2 13.6a2 2 0 0 0-.2.9V17h2M8 17h5M17 17h.5"/><circle cx="6" cy="18" r="2"/><circle cx="15" cy="18" r="2"/><circle cx="19.5" cy="18" r="2"/>',
  export: '<path d="d:M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/>',
  calendar: '<path d="d:M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2z"/><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  turnaround: '<path d="d:M4 14a8 8 0 1 0 16 0a8 8 0 1 0-16 0z"/><path d="M10 2H14"/><path d="M12 14L15 11"/><circle cx="12" cy="14" r="8"/>',
  dtp: '<path d="d:M10 16a6 6 0 1 0 12 0a6 6 0 1 0-12 0z"/><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/>',
  correlation: '<circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="18.5" cy="5.5" r=".5" fill="currentColor"/><circle cx="11.5" cy="11.5" r=".5" fill="currentColor"/><circle cx="7.5" cy="16.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="14.5" r=".5" fill="currentColor"/><path d="M3 3v16a2 2 0 0 0 2 2h16"/>',
  // The board’s three filled cells, the corner one rounded to the frame
  heat: '<path d="d:M9 3h6v6H9zM3 9h6v6H3zM15 15h6v4a2 2 0 0 1-2 2h-4z"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
  storm: '<path d="d:M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/>',
  fair: '<path d="d:M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
  rain: '<path d="d:M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
  news: '<path d="d:M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>',
  planner: '<path d="d:M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  market: '<path d="d:M8 9h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"/><path d="d:M16 5h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z"/><path d="M9 5v4"/><rect x="7" y="9" width="4" height="6" rx="1"/><path d="M9 15v2"/><path d="M17 3v2"/><rect x="15" y="5" width="4" height="8" rx="1"/><path d="M17 13v3"/><path d="M3 3v16a2 2 0 0 0 2 2h16"/>',
  // The knowledge base’s kinds (nut and flip keep their own drawings)
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  nut: '<path d="M12 3 19.8 7.5v9L12 21l-7.8-4.5v-9z"/><circle cx="12" cy="12" r="3.25"/>',
  scale: '<path d="d:m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="d:m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  flag: '<path d="d:M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V15"/>',
  fork: '<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/>'
};
/* One shape under two names (§4): an alias is the same string, so the two can never drift apart. */
ICONS.power = ICONS.zap;
ICONS.upkeep = ICONS.wrench;
ICONS.stats = ICONS.chart;
ICONS.know = ICONS.info;
ICONS.warning = ICONS.alert;
ICONS.receipt = ICONS.invoice;
/* The licences above, as Settings → Data & device → Backup, storage & build → Licences shows them (settingsLicencesOpen): each
   notice whole, a paragraph a string. */
var ICON_LICENCES = [
  { name: 'Lucide', licence: 'ISC License', text: [
    'Copyright (c) 2026 Lucide Icons and Contributors',
    'Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.',
    'THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.'] },
  { name: 'Feather', licence: 'The MIT License (MIT)', text: [
    'The following Lucide icons are derived from the Feather project: airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out',
    'Copyright (c) 2013-present Cole Bemis',
    'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:',
    'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.'] }
];
/* An icon by its name; `cls` a class for the SVG where its box sets the size. */
function iconSvg(name, cls) { return iconPathSvg(ICONS[name] || '', cls); }
/* The SVG round an icon's paths. A tint (a path whose data starts `d:`) is drawn fill-only as .inv-ico-tint, under the lines that
   follow it. */
function iconPathSvg(paths, cls) {
  return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' ' + ICON_ATTRS + '>' + String(paths || '').replace(/<path d="d:/g, '<path class="inv-ico-tint" d="') + '</svg>';
}
/* body.html's icons are slots, <span data-icon="name">, so the set has one source (§4): each is replaced by its icon, carrying the
   slot's classes and any other attribute it held. Run once at the start, before the shell is drawn. A name the set does not hold
   leaves its slot as it is, where P228 finds it. */
function iconFill(root) {
  var slots = (root || document).querySelectorAll('span[data-icon]');
  Array.prototype.forEach.call(slots, function(sp) {
    var name = sp.getAttribute('data-icon');
    if (!ICONS[name]) return;
    var t = document.createElement('template');
    t.innerHTML = iconSvg(name, sp.getAttribute('class') || '');
    var svg = t.content.firstElementChild;
    Array.prototype.forEach.call(sp.attributes, function(a) { if (a.name !== 'data-icon' && a.name !== 'class') svg.setAttribute(a.name, a.value); });
    sp.replaceWith(svg);
  });
}
/* The brand's mark, the nut (§4, §15d): one builder for the rail's mark, the lock, the sign-in screen and the app's icon.
   `size`: 'sm' (2rem: the rail's, the lock's) or 'lg' (twice that: the sign-in tile's). `tone`: 'tile' (the nut's line in the
   accent's own ink on a tile of the accent: the rail and the lock, as the board's desktop draws it) or 'brass' (the nut cast in
   brass, its hole the colour behind it: the sign-in board's). The brass gradient is named afresh on every call, so two marks on
   the page at once (the rail under the lock) never hold one id. */
function markSvg(size, tone) {
  var hex = 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z';
  var cls = 'inv-ico-mark' + (size === 'lg' ? ' inv-ico-mark-lg' : '');
  if (tone === 'brass') {
    var id = 'invMark' + (markSvg.seq = (markSvg.seq || 0) + 1);
    return '<svg class="' + cls + ' inv-ico-mark-brass" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0"/><stop offset="1"/></linearGradient></defs>' +
      '<path fill="url(#' + id + ')" fill-rule="evenodd" d="' + hex + 'M15.4 12a3.4 3.4 0 1 0-6.8 0 3.4 3.4 0 1 0 6.8 0z"/><path d="M7 6.2l5-2.9"/></svg>';
  }
  return '<svg class="' + cls + ' inv-ico-mark-tile" viewBox="0 0 44 44" aria-hidden="true"><rect width="44" height="44" rx="14"/>' +
    '<g transform="translate(10 10)"><path d="' + hex + '"/><circle cx="12" cy="12" r="3"/></g></svg>';
}
var UI_ICON_MORE = iconSvg('more');
var UI_ICON_FILTER = iconSvg('filter');
var UI_TONE_RANK = { danger: 4, warning: 3, info: 2, ok: 1, neutral: 0 };
/* The toolbar's More (§6.7, §1a-2, §1a-10): one button holding everything the row has no room for, on both layouts (files
   always: Export, Import, Print sheets, the register's CSVs). `items`: {label, action, attrs, badge: {n, tone}}. Each opens as a
   row of a dialog carrying the action and the data it had in the toolbar, so events.js routes it unchanged; a pick shuts the
   dialog first, then acts. A badge an item carries is carried by More too, in the worst tone, so nothing waiting hides behind it;
   a neutral one (a plain count) stays on its row.
   The rows wait in a <template>: nothing hidden is drawn twice, and no id is held twice. `opts.icon`: the button is its mark alone
   (named for a screen reader), for a phone row that holds a stepper and a select beside its primary (the Planner's). */
function uiToolbarMoreHtml(items, opts) {
  var list = (items || []).filter(Boolean), icon = !!(opts && opts.icon), ghost = !!(opts && opts.ghost);
  if (!list.length) return '';
  var n = 0, worst = '';
  var rows = list.map(function(x) {
    var b = x.badge && x.badge.n ? x.badge : null;
    // A count that waits on nothing (a neutral tone: how many credit notes there are) stays on its row; More carries the rest.
    if (b && uiTone(b.tone) !== 'neutral') { n += b.n; if (!worst || (UI_TONE_RANK[uiTone(b.tone)] || 0) > (UI_TONE_RANK[worst] || 0)) worst = uiTone(b.tone); }
    return '<button type="button" class="inv-row" data-tb-pick data-action="' + escHtml(x.action) + '"' + (x.attrs || '') + '>' +
      '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(x.label) + '</span></span>' +
      (b ? '<span class="inv-row-end"><span class="inv-badge inv-badge-' + uiTone(b.tone) + '">' + b.n + '</span></span>' : '') + '</button>';
  }).join('');
  return '<span data-tb-more><button type="button" class="inv-btn ' + (ghost ? 'inv-btn-ghost' : 'inv-btn-secondary') + ' inv-btn-sm' + (icon ? ' inv-btn-icon' : '') + '" data-action="invTbMore" aria-haspopup="dialog"' + (icon ? ' aria-label="More"' : '') + '>' + UI_ICON_MORE + (icon ? '' : 'More') +
    (n ? ' <span class="inv-badge inv-badge-' + worst + '">' + n + '</span>' : '') + '</button><template>' + rows + '</template></span>';
}
/* The toolbar's filters (§6.6, §6.7): on the desktop the screen's own controls, inline; on the phone one Filter button (the count
   of filters applied, a plain count: DR-1) that opens them in a dialog with Done, the applied ones shown under the row as tokens
   (uiTokensHtml).
   `o`: controls (HTML: the screen's own selects, dates and chips, with their own ids and change handlers), count, key (the
   screen; UI_FILTER_DONE[key] redraws its row after Done, else the page is redrawn in place). */
var UI_FILTER_DONE = {};
function uiFilterHtml(o) {
  if (_isDesktop) return o.controls || '';
  return '<span data-tb-filter="' + escHtml(o.key || '') + '"><button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invTbFilter" aria-haspopup="dialog">' +
    UI_ICON_FILTER + 'Filter' + (o.count ? ' <span class="inv-badge inv-badge-neutral">' + o.count + '</span>' : '') + '</button><template>' + (o.controls || '') + '</template></span>';
}
/* The filters applied, under the toolbar on the phone: "Client SSS Mehta ×", each a button that clears its own (a sort other than
   the default is one too). `tokens`: {key, value (text), action, attrs}. The desktop shows its filters inline instead. */
function uiTokensHtml(tokens) {
  var list = (tokens || []).filter(function(t) { return t && t.value; });
  if (_isDesktop || !list.length) return '';
  return '<div class="inv-tokens">' + list.map(function(t) {
    return '<button type="button" class="inv-token" data-action="' + escHtml(t.action) + '"' + (t.attrs || '') + ' aria-label="Clear ' + escHtml(t.key) + ': ' + escHtml(t.value) + '">' +
      '<span class="inv-token-key">' + escHtml(t.key) + '</span>' + escHtml(t.value) + '<span aria-hidden="true">&times;</span></button>';
  }).join('') + '</div>';
}
function uiToolbarAction(action, btn) {
  if (action === 'invTbMore') {
    var tpl = btn.parentElement && btn.parentElement.querySelector('template');
    if (!tpl) return true;
    dialogOpen('<div class="inv-dialog" data-tb-more-dialog>' + dialogHeadHtml('More', 'invCloseConfirm') +
      '<div class="inv-panel inv-panel-flush">' + tpl.innerHTML + '</div></div>', { dismiss: true });
    return true;
  }
  if (action === 'invTbFilter') {
    var wrap = btn.closest('[data-tb-filter]'), t = wrap && wrap.querySelector('template'), key = wrap ? wrap.dataset.tbFilter || '' : '';
    if (!t) return true;
    var scrim = dialogOpen('<div class="inv-dialog" data-tb-filter-dialog="' + escHtml(key) + '">' + dialogHeadHtml('Filter', 'invTbFilterDone') +
      '<div class="inv-dialog-body inv-toolbar" data-nodirty>' + t.innerHTML + '</div>' +
      '<div class="inv-dialog-foot"><button type="button" class="inv-btn inv-btn-primary" data-action="invTbFilterDone">Done</button></div></div>', { dismiss: true });
    // However it shuts (Done, the ×, a tap outside, Back), the row is drawn again with the filters as they now stand: they apply as
    // they change, so nothing in it is ever discarded.
    scrim._onClose = function() { if (UI_FILTER_DONE[key]) keepScroll(UI_FILTER_DONE[key]); else tabRedrawActive(); };
    return true;
  }
  if (action === 'invTbFilterDone') {
    var open = btn.closest('.inv-scrim-dialog');
    if (open) dialogCloseScrim(open);
    return true;
  }
  return false;
}
// A pick in More shuts its dialog first, so whatever it opens is drawn after it (its step is passed over on Back: nav.js marks a
// layer shut by anything but Back). Capture, before events.js runs the action.
document.addEventListener('click', function(e) {
  var pick = e.target && e.target.closest ? e.target.closest('[data-tb-pick]') : null;
  var scrim = pick && pick.closest('.inv-scrim-dialog');
  if (scrim && scrim.querySelector('[data-tb-more-dialog]')) dialogCloseScrim(scrim);
}, true);

/* A grid packed with no gaps (§6.25): each child spans as many of the grid's small rows as its own height takes. Only where
   the grid has two columns or more; packed again whenever a child changes height (a fold opened, a chart drawn). */
var _masonryObs = typeof ResizeObserver === 'function' ? new ResizeObserver(function(entries) {
  var seen = [];
  entries.forEach(function(en) { var g = en.target.parentElement; if (g && seen.indexOf(g) < 0) seen.push(g); });
  seen.forEach(function(g) { if (g.classList.contains('inv-masonry-on')) uiMasonryPack(g); });
}) : null;
function uiMasonry(el) {
  if (!el) return;
  var cols = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
  if (cols < 2) {
    el.classList.remove('inv-masonry-on');
    Array.prototype.forEach.call(el.children, function(c) { c.style.removeProperty('--rows'); });
    return;
  }
  el.classList.add('inv-masonry-on');
  uiMasonryPack(el);
  if (_masonryObs) Array.prototype.forEach.call(el.children, function(c) { _masonryObs.observe(c); });
}
function uiMasonryPack(el) {
  // The rows are a few pixels each with no gap between them (styles.css), and a card spans its height and the gap under it: every
  // card sits a gap, near to the pixel, under the one above (rounding to a 16 px unit of row and gap had left 12 to 27).
  var cs = getComputedStyle(el), row = parseFloat(cs.gridAutoRows) || 4, gap = parseFloat(cs.columnGap) || 0;
  Array.prototype.forEach.call(el.children, function(c) {
    var h = c.getBoundingClientRect().height;
    var n = h > 0 ? Math.max(1, Math.ceil((h + gap) / row)) : 1;
    if (c.style.getPropertyValue('--rows') !== String(n)) c.style.setProperty('--rows', String(n));
  });
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
   (The More sheet, an inv-scrim that was not a dialog, went with Direction B's workspaces; Add is a dialog like the rest.)
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
/* A screen drawn whole with its list and pane in it keeps where both were scrolled (UX overhaul 2, step 7). The list and
   the pane scroll inside themselves, and a redraw replaced them, so a Void deep in Production's entries, History's Show more
   or a receipt placed put the list back at its top (the QA chain, 2 Oct 2026). The pane keeps its place only while the same
   record is open: the host says which (`data-open`). */
function paneScrollKeep(fn) {
  var kept = {};
  document.querySelectorAll('.inv-page-active .inv-pane-host[id]').forEach(function(h) {
    var l = h.querySelector(':scope > .inv-pane-list'), p = h.querySelector(':scope > .inv-pane');
    kept[h.id] = { l: l ? l.scrollTop : 0, p: p ? p.scrollTop : 0, open: h.getAttribute('data-open') || '' };
  });
  try { return fn(); } finally {
    Object.keys(kept).forEach(function(id) {
      var h = document.getElementById(id), k = kept[id];
      if (!h) return;
      var l = h.querySelector(':scope > .inv-pane-list'), p = h.querySelector(':scope > .inv-pane');
      if (l && k.l && l.scrollTop !== k.l) l.scrollTop = k.l;
      if (p && k.p && k.open && h.getAttribute('data-open') === k.open) p.scrollTop = k.p;
    });
  }
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

/* Before something shuts every dialog on its way (closeOverlay: a jump to another screen, a tap on the Windows widget), the
   top dialog holding typed work asks first, as its × does. Returns true when it asked: on Discard `again` runs with nothing
   typed left to ask about, on Keep editing nothing moves (the QA audit of 30 Sep 2026: the client's edit sheet carries
   "Open in Finance", and a typed GSTIN went with it). */
function dialogsTypedAsk(again) {
  var typed = Array.prototype.filter.call(document.querySelectorAll('.inv-scrim-dialog'), dialogTyped);
  if (!typed.length) return false;
  dialogLeaveOk(typed[typed.length - 1]).then(function(ok) {
    if (!ok) return;
    typed.forEach(function(s) { delete s.dataset.typed; });
    again();
  });
  return true;
}

/* Closes one dialog wherever it sits in the stack (normally the top one). */
function dialogCloseScrim(scrim) {
  if (!scrim || !scrim.isConnected) return;
  var all = document.querySelectorAll('.inv-scrim-dialog');
  if (all.length && all[all.length - 1] === scrim) { closeTopOverlay(); return; }
  scrim.remove();
  popFocus();
  if (!document.querySelector('.inv-scrim-dialog')) document.body.style.overflow = '';
  dialogClosed(scrim);
}
/* What a dialog asked to run once it is shut, however it was shut (the toolbar's Filter redraws its row). */
function dialogClosed(scrim) {
  var f = scrim && scrim._onClose;
  if (!f) return;
  scrim._onClose = null;
  try { f(); } catch (e) { console.error(e); }
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
    // The other window logged its own saves: this book is where the change log starts comparing from (changelog.js).
    if (typeof chgBaseline === 'function') chgBaseline();
    // Another window put a readable book on disk (it imported or pulled out of the same stand-in): this one holds it now.
    if (bookStandIn() && !_idbFailed) { _unreadable = null; _storageHealth.readError = ''; _storageHealth.readKind = ''; hideStorageBanner('read'); }
    if (typeof prodTouch === 'function') prodTouch();
    if (typeof _invalidateUsageCache === 'function') _invalidateUsageCache();
    // The book another window saved may say this device was removed: it forgets its GitHub token (devices.js).
    if (typeof devAfterLoad === 'function') devAfterLoad('reload');
    if (typeof prtApply === 'function') prtApply();
    bookRedraw(why);
    // Users or roles changed elsewhere: a deactivated user is locked, a role that lost the page on screen sent Home.
    if (typeof grdRecheck === 'function') grdRecheck();
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
  _storageHealth.lastErrorOwn = true;
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
      // A question with a second way on (`altLabel`: Send to office's "Send anyway" beside "Print here") draws it in Cancel's
      // place and answers 'alt'; the head's ×, Escape and the scrim still answer cancel.
      var foot = '<div class="inv-dialog-foot">' +
        (kind === 'alert' ? '' : kind === 'confirm' && o.altLabel
          ? '<button type="button" class="inv-btn inv-btn-secondary" data-action="invUiAsk" data-ans="alt">' + escHtml(o.altLabel) + '</button>'
          : '<button type="button" class="inv-btn inv-btn-secondary" data-action="invUiAsk" data-ans="cancel">' + escHtml(o.cancelLabel || 'Cancel') + '</button>') +
        '<button type="button" class="' + okCls + '" data-action="invUiAsk" data-ans="ok">' + escHtml(o.okLabel || 'OK') + '</button></div>';
      var html = '<div class="inv-dialog" role="' + (kind === 'alert' ? 'alertdialog' : 'dialog') + '" aria-modal="true" aria-labelledby="' + id + 'T"' +
        ' data-ui-ask="' + id + '" data-ui-kind="' + kind + '">' +
        dialogHeadHtml('<span id="' + id + 'T">' + escHtml(o.title || (kind === 'alert' ? 'Note' : 'Are you sure?')) + '</span>', 'invUiAsk') +
        (o.body ? '<div class="inv-ask-body' + (o.tone ? ' inv-callout inv-callout-' + o.tone : '') + '">' + escHtml(o.body) + '</div>' : '') +
        input + foot + '</div>';
      scrim = dialogOpen(html);
      if (!scrim || !scrim.isConnected) throw new Error('the dialog did not open');
      // Asked from a print preview (Send to office): drawn over it, as a toast raised there is.
      if (o.overPrint) scrim.dataset.overPrint = '1';
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
  if (a.kind === 'confirm') { a.finish(ans === 'ok' ? true : ans === 'alt' && a.o.altLabel ? 'alt' : false); return; }
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
    if (typeof errReport === 'function') errReport(e.error || { name: 'Error', message: msg }, 'uncaught');
  });
  window.addEventListener('unhandledrejection', function(e) {
    var r = e && e.reason, msg = r && r.message ? r.message : String(r || '');
    if (!msg) return;
    uiNotice('Something went wrong: ' + msg + '. What was being done may not have finished — check it.', 'danger');
    if (typeof errReport === 'function') errReport(r instanceof Error ? r : { name: 'UnhandledRejection', message: msg }, 'promise');
  });
}

/* The Gemini key, the model it last answered on and the last photo's read kept as a draft are forgotten (owner, 13 Oct 2026:
   the challan scan and the photo reading came out, *"it simply never works"*): nothing is left on the device that nothing reads. */
function forgetGeminiKey() {
  try { ['sep_inv_gemini_key', 'sep_inv_gemini_model', 'sep_inv_prod_photo_draft'].forEach(function(k) { localStorage.removeItem(k); }); } catch(e) {}
}

/* Kept in localStorage rather than on S, so an exported backup never carries
   a credential. */
function getMetalsKey() { try { return localStorage.getItem(METALS_KEY_KEY) || ''; } catch(e) { return ''; } }
function setMetalsKey(key) { try { localStorage.setItem(METALS_KEY_KEY, key); } catch(e) {} }

// Phase 3: Reset invNextNum if no invoices exist.
// It is the delete's old recycling rule (a book emptied of its invoices starts again at 1) run at every start; a delete
// now walks Next back itself (invNextAfterDelete). A reserved number in the void ledger still holds its slot — the
// document left the building, so the number is spent even though no invoice remains — and a Next the operator set in
// Settings is theirs (invNextSetAt): an empty book set to carry on a paper series at 500 went back to 1 at the next
// start (the QA audit, 30 Sep 2026). A book nobody set stays at 1.
function resetSeriesIfEmpty() {
  // Only when it changes something: it rewrote the whole book at every start of an empty one.
  if (S.invoices.length === 0 && S.invNextNum !== 1 && !S.invNextSetAt && !S.voidedNumbers.some(function(v) { return v.reserved; })) {
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
  // What this save changed, record by record, into the log it carries (changelog.js). It never stops the save.
  try { if (typeof chgOnSave === 'function') chgOnSave(); } catch (e) { /* counted inside; the save goes on */ }
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

// Per-device view prefs, written quietly like the folds and Settings' own layout: with the origin's shared localStorage
// pool full (a real condition, Persistence), every move between screens raised "Could not save sep_inv_view_prefs"
// (the QA audit of 30 Sep 2026). A pref that did not stick costs a filter on the next start, nothing more.
function saveRegFilter() {
  try { localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(regFilter)); } catch (e) { /* per-device only */ }
}

/* ===== UTILITIES ===== */
function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
/* A sentence's first letter lowered where it joins another ("Thu 22: next challan from …"), only for an ordinary word: a name
   written in capitals (OM SHEET METALS, VAT A2), one of two capitalised words (Tata Motors), a day or a month keeps its own. Lowering it whatever it was had printed "oM SHEET
   METALS" and "Made mon 19 Oct" (owner, 21 Oct 2026). */
function lcLead(s) {
  s = String(s == null ? '' : s);
  if (!/^[A-Z][a-z]/.test(s) || /^[A-Z][a-z]+\s+[A-Z]/.test(s) || /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
/* A client's name as a sentence or a card says it: its legal ending left off (PVT LTD, P. LTD., (P) LTD, LIMITED, LLP), the whole
   name the record's. "PAWAN AUTO P LTD" had lost only its LTD. */
function clientShortName(name) {
  var s = String(name || '').trim();
  var t = s.replace(/[\s,.]*(?:\(P\)|\bP\.?|\bPVT\.?|\bPRIVATE)?[\s.]*\b(?:LTD|LIMITED)\.?$/i, '').replace(/[\s,.]*\bLLP\.?$/i, '').trim();
  return t || s;
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
/* Money on a board (UI pass 3 \u00A724k, the owner's call 3): whole rupees under a lakh, lakhs to two places from a lakh, crores from a
   crore, each step through gstRound (HR-8): \u20B966,476 \u00B7 \u20B93.50 L \u00B7 \u20B91.24 Cr. `text` the whole, `num` and `unit` its parts (3.50,
   L), `neg` its sign (said \u2212, U+2212), `exact` the amount to the paisa (formatCurrency), which every short figure carries as its
   title. A rate is not an amount and keeps its paise (\u20B917.67 a kilo); a chart keeps formatInrShort; every other screen keeps the
   paise: the call is the boards'. */
function inrCard(v) {
  v = Number(v) || 0;
  var a = Math.abs(v), r = gstRound(a, 0), num, unit = '';
  if (r < 100000) num = r.toLocaleString('en-IN');
  else {
    var L = gstRound(a / 1e5, 2);
    if (L < 100) { num = L.toFixed(2); unit = 'L'; }
    else {
      var parts = gstRound(a / 1e7, 2).toFixed(2).split('.');
      num = Number(parts[0]).toLocaleString('en-IN') + '.' + parts[1];
      unit = 'Cr';
    }
  }
  var neg = v < 0 && (r > 0 || unit !== '');
  return { text: (neg ? '\u2212' : '') + '\u20B9' + num + (unit ? ' ' + unit : ''), num: num, unit: unit, neg: neg, exact: formatCurrency(v) };
}
/* An amount on a board as HTML, its exact figure its title: as a figure (its sign a step smaller, the rupee raised and small, the
   lakh or crore as a unit after it), or `inline` as the words of a sentence or a line. */
function inrFigHtml(v, o) {
  var c = inrCard(v), t = ' title="' + escHtml(c.exact) + '"', words = o && o.words ? escHtml(o.words) : '';
  if (o && o.inline) return '<span class="inv-nowrap"' + t + '>' + escHtml(c.text) + '</span>';
  // o.words: what the figure is, after its unit (the canvas's "₹8.42 L owed", "₹3.49 L in the bank").
  return '<span class="inv-nowrap"' + t + '>' + (c.neg ? '<span class="inv-widget-sign">\u2212</span>' : '') + '<span class="inv-cur">\u20B9</span>' + escHtml(c.num) +
    (c.unit || words ? '<span class="inv-unit">' + (c.unit || '') + (c.unit && words ? ' ' : '') + words + '</span>' : '') + '</span>';
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
/* What is owed, by the age of its oldest open invoice, one tone wherever it is drawn (the tab map, TM6a): figToneAge, but never
   red while a receipt is still unplaced (`loose`), since that money may be in already (the owed90 rule's reason): warning. */
function figToneOwed(days, loose) { var t = figToneAge(days); return t === 'danger' && loose ? 'warning' : t; }
/* An area's heads against the day's number, one tone wherever it is drawn (the tab map, TM6a: Floor's line cards, the attendance
   panel's By area, Day's board and its Needed today, Areas): short a warning, at the number ok, over it info. Half a head either
   way is the number (Areas reads an average over the days). Null with no number set. areaNeedWord says it in a word. */
function areaNeedTone(heads, need) {
  if (need == null || heads == null || !isFinite(heads)) return null;
  var v = heads - need;
  return v <= -0.5 ? 'warning' : v >= 0.5 ? 'info' : 'ok';
}
function areaNeedWord(heads, need) {
  var t = areaNeedTone(heads, need), n = function(x) { return Number.isInteger(x) ? String(x) : formatNum(x, 1); };
  return t === 'warning' ? 'Short ' + n(need - heads) : t === 'info' ? n(heads - need) + ' over' : t === 'ok' ? 'Met' : '';
}
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
/* The tone figDeltaHtml colours a change in: null where it says no figure or level, or where up and down are neither. */
function figDeltaTone(cur, prev, better) {
  if (!better || prev == null || !isFinite(prev) || prev === 0 || cur == null || !isFinite(cur)) return null;
  var pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) <= FIG_FLAT_PCT) return null;
  return (better === 'up' ? pct > 0 : pct < 0) ? 'ok' : Math.abs(pct) <= FIG_BAD_PCT ? 'warning' : 'danger';
}
/* The same change as plain text, for a fact row's sub or a title (escaped where it is drawn): "+12% on a usual day", whole
   percents; "level with …" within FIG_FLAT_PCT; '' against nothing. */
function figDeltaText(cur, prev, label) {
  if (prev == null || !isFinite(prev) || prev === 0 || cur == null || !isFinite(cur)) return '';
  var pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) <= FIG_FLAT_PCT) return 'level with ' + label;
  return (pct > 0 ? '+' : '\u2212') + Math.round(Math.abs(pct)) + '% on ' + label;
}
/* The change alone, for a figure's own place: "+12%", "\u22128%", "level"; '' against nothing. */
function figDeltaPct(cur, prev) {
  if (prev == null || !isFinite(prev) || prev === 0 || cur == null || !isFinite(cur)) return '';
  var pct = ((cur - prev) / Math.abs(prev)) * 100;
  return Math.abs(pct) <= FIG_FLAT_PCT ? 'level' : (pct > 0 ? '+' : '\u2212') + Math.round(Math.abs(pct)) + '%';
}
function figDeltaHtml(cur, prev, label, better) {
  if (prev == null || !isFinite(prev) || prev === 0 || cur == null || !isFinite(cur)) return 'no figure for ' + escHtml(label);
  var pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) <= FIG_FLAT_PCT) return 'level with ' + escHtml(label);
  var text = (pct > 0 ? '+' : '&minus;') + formatNum(Math.abs(pct), 1) + '% on ' + escHtml(label);
  if (!better) return text;
  var good = better === 'up' ? pct > 0 : pct < 0;
  return figHtml(text, good ? 'ok' : Math.abs(pct) <= FIG_BAD_PCT ? 'warning' : 'danger');
}

/* A name in running words (a sentence, a line naming several), never past `max` characters (28 by default): a long one loses its
   last words, said with "…". The whole name stays where the record itself is listed (a fold's members, a row's own title). */
function uiNameShort(name, max) {
  var s = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
  max = max > 0 ? max : 28;
  if (s.length <= max) return s;
  var cut = s.slice(0, max - 1), sp = cut.lastIndexOf(' ');
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-–—&]+$/, '') + '\u2026';
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
     its end only. The note stays while the table overflows: removing it on a scroll would move the page. A tab row
     (`inv-viewtabs`) carries the same data-more, with no note.
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

/* Which sides of a sideways scroller have more past them, as data-more = start | end | both (none: the attribute goes).
   Returns whether it overflows at all. */
function _ovMoreSet(sc) {
  var w = sc.clientWidth;
  if (!w) return null;
  var max = sc.scrollWidth - w, over = max > 1, more = '';
  if (over) {
    var l = sc.scrollLeft > 1 && !sc.querySelector('.inv-table-grid'), r = sc.scrollLeft < max - 1;
    more = l && r ? 'both' : l ? 'start' : r ? 'end' : '';
  }
  if (more) { if (sc.getAttribute('data-more') !== more) sc.setAttribute('data-more', more); }
  else if (sc.hasAttribute('data-more')) sc.removeAttribute('data-more');
  return over;
}
function _ovScrollCue(sc) {
  var over = _ovMoreSet(sc);
  if (over == null) return;
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
  // A tab row that runs past the screen: the side with more fades (§6.4), with no note under it (owner, 8 Oct 2026: a view
  // past the phone's edge read as missing).
  document.querySelectorAll('.inv-viewtabs').forEach(_ovMoreSet);
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
    else if (t && t.classList && t.classList.contains('inv-viewtabs')) _ovMoreSet(t);
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

/* Round to the paisa, half away from zero, on the decimal the figure is written in (owner, 30 Sep 2026: "change it").
   Math.round(val * 100) / 100 rounded on the binary copy: 1.005 is held as 1.00499999…, so it gave 1.00 where the paper
   says 1.01, and 0.1 + 0.2 carried its noise into the paise. The figure is read to 15 significant digits (what a double
   holds exactly), shifted two places in decimal, rounded, and shifted back. `dp` rounds to that many places the same
   way (0 for whole rupees, 4 for a price per unit); left out, it is the paisa. */
function gstRound(val, dp) {
  var p = dp == null ? 2 : dp, v = Number(val);
  if (!isFinite(v) || v === 0) return 0;
  var a = Math.abs(v), parts = a.toPrecision(15).split('e');
  var shifted = Number(parts[0] + 'e' + ((Number(parts[1]) || 0) + p));
  var r = Number(Math.round(shifted) + 'e-' + p);
  return v < 0 ? -r : r;
}

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

/* An invoice's state is a billing change (guard.js; the QA audit of 2 Oct 2026, QA4-6): a role without billing is told so,
   and the PIN is asked again outside the re-ask window, as an invoice saved, cancelled or deleted is. Printing marks a
   Created invoice Printed on the permission alone (print.js printMarkPrinted): it is part of printing an invoice the role
   opened, and the print dialog cannot wait for a PIN. Each mark asks only where grdOk says no, so with the guard off (or
   inside the window) nothing is awaited and the mark runs as it always did. → Promise<boolean>. */
function invStateAsk(what) { return guardAsk('billing', what); }
function invStateLower(st) { return String(INV_STATE_LABELS[st] || st).toLowerCase(); }

/* The next state, or a named one further on: an invoice printed outside the app goes from Created straight to
   Dispatched. Never backwards, but for a print that never came out (invNotPrinted). */
async function advanceInvoiceState(invId, target) {
  var inv = S.invoices.find(function(i) { return i.id === invId; });
  if (!inv || inv.status === 'cancelled') return;
  var idx = INV_STATES.indexOf(getInvState(inv));
  var nextState = target || INV_STATES[idx + 1];
  // A button drawn before the state moved on (a print, another window) names a step already reached: it only shows
  // where the invoice is. It used to fall through to the step after, so Mark printed on a printed invoice dispatched it.
  if (idx < 0 || !nextState || invStateIdx(nextState) <= idx) { invStateShown(invId); return; }
  if (typeof grdOk === 'function' && !grdOk('billing') && !(await invStateAsk('mark an invoice ' + invStateLower(nextState)))) return;
  // Found again after the question: another window's save can replace the book while it is open.
  inv = S.invoices.find(function(i) { return i.id === invId; });
  if (!inv || inv.status === 'cancelled' || invStateIdx(getInvState(inv)) >= invStateIdx(nextState)) { invStateShown(invId); return; }
  invSetState(inv, nextState);
  saveState();
  invStateShown(invId);
  showToast(inv.displayNumber + ' marked as ' + INV_STATE_LABELS[nextState]);
}

/* Print marks a Created invoice Printed, but the print dialog cannot say whether the paper came out: a print cancelled
   or jammed is put back here, and its stamp goes with it (History logs a print from printedAt). */
async function invNotPrinted(invId) {
  var inv = S.invoices.find(function(i) { return i.id === invId; });
  if (inv && inv.status !== 'cancelled' && getInvState(inv) === 'printed') {
    if (typeof grdOk === 'function' && !grdOk('billing') && !(await invStateAsk('mark an invoice not printed'))) return;
    inv = S.invoices.find(function(i) { return i.id === invId; });
    if (inv && inv.status !== 'cancelled' && getInvState(inv) === 'printed') {
      inv.invoiceState = 'created';
      delete inv.printedAt;
      saveState();
      showToast(inv.displayNumber + ' is back to Created');
    }
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
  if (typeof grdOk === 'function' && !grdOk('billing') && !(await invStateAsk('mark invoices filed'))) return;
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

   A KG-billed client's challan states pieces AND kilograms (many carry both
   columns), so a weight per piece on record checks the kilograms the way
   the rate card checks the rate. Replayed over the 11 Sep backup's 1,068 KG
   lines that carry a piece count: half sit within 0.4% of their own client's
   median, three quarters within 2.3% — and two are a power of ten out
   (00830 and 00086, a piece count keyed ten times out each way), ₹3,000
   between them.

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

/* ===== AN ITEM RATE OVERRIDE, IN THE UNIT IT WAS GIVEN (the QA chain of 2 Oct 2026, QA5-1) =====
   An itemRates row is a negotiated figure for a part, per piece unless it says kg (a per-kg rate posted from an
   accepted quotation, quote.js). Every path read its `rate` alone and put it on the line whatever the line's unit: a
   ₹16/kg override priced 600 pieces at 600 × 16 = ₹9,600 (600 × 0.2 kg × 16 is ₹1,920), a ₹3.83/pc one priced 150 kg
   at ₹3.83 a kilo, and the rate check, comparing the line with that same figure, said Matches. So an override is
   applied only in its own unit:
   - per kg: a KG line at the rate a kilo, and a NOS line of a client billed by weight from pieces (nos_to_weight) as
     pieces × the part's kg a piece × the rate, the way that client's ₹/kg ladder is used; only where the weight is known;
   - per piece: a NOS line at the rate a piece.
   Anything else does not fit the line: the line is priced at the client's own rate, and the check says the rate on
   record is in another unit. Every path that prices a line reads the override here, and nowhere else. */
function itemRateUnit(ir) { return ir && ir.unit === 'kg' ? 'kg' : 'piece'; }
/* How an override in `unit` prices a line in `lineUnit` (KG | NOS) of this client's part: 'kg', 'piece', 'weight'
   (pieces × kg/pc × rate), or null when it cannot. */
function itemRateHow(client, unit, lineUnit, partNumber) {
  if (unit === 'piece') return lineUnit === 'NOS' ? 'piece' : null;
  if (lineUnit !== 'NOS') return 'kg';
  return client && client.billingMode === 'nos_to_weight' && ((S.partWeights || {})[String(partNumber || '').toUpperCase()] || 0) > 0 ? 'weight' : null;
}
/* The override naming a line's part, or null: {rate, unit, label, how, fits, kgPc}. */
function itemRateFor(client, onDate, item) {
  if (!client || !item || !item.partNumber) return null;
  var info = getLineItemRate(client, onDate || localDateStr(), item.partNumber);
  if (!info._override) return null;
  var unit = info.unit === 'kg' ? 'kg' : 'piece', lineUnit = item.unit === 'NOS' ? 'NOS' : 'KG';
  var how = itemRateHow(client, unit, lineUnit, item.partNumber);
  return { rate: info.rate, unit: unit, label: info._label || '', how: how, fits: !!how,
    kgPc: how === 'weight' ? (S.partWeights || {})[String(item.partNumber).toUpperCase()] : 0 };
}
/* The client's own ₹/kg on a date, passing over any override (getLineItemRate with no part). */
function clientLadderRate(client, onDate) {
  return client ? (getLineItemRate(client, onDate || localDateStr(), '').ratePerKg || 0) : 0;
}

/* The one place a line's rate on record is read: override, then the client's
   piece rate for a NOS line, then the ₹/kg ladder. `unit` says which the figure
   is — comparing a piece rate against a ₹/kg one is the error the Items Master
   rows carrying 5.40 made, and a caller must be able to refuse it. */
function getRateOnRecord(client, onDate, item) {
  if (!client || !item) return null;
  var date = onDate || localDateStr();
  var info = getLineItemRate(client, date, item.partNumber);
  // An override is per piece unless it says kg. One that does not fit the line's unit is still the rate on record for
  // the part (`fits: false`): the check says so rather than comparing the line with the client's own rate.
  var ov = itemRateFor(client, date, item);
  if (ov) return ov.fits ? { rate: ov.rate, unit: ov.unit, source: 'override' } : { rate: ov.rate, unit: ov.unit, source: 'override', fits: false };
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
  // An override in the line's own unit; one in another unit leaves the line at the client's own rate (itemRateFor).
  var ov = itemRateFor(client, onDate, item);
  if (ov && ov.fits) return ov.rate;
  var info = getLineItemRate(client, onDate, '');
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
    var pw = (S.partWeights || {})[(item.partNumber || '').toUpperCase()] || 0;
    // An override in its own unit: per piece prices the pieces, per kg the pieces' weight, as the ladder does below.
    // One that does not fit (per kg with no weight on record) leaves the line to the client's own rate (itemRateFor).
    var ov = itemRateFor(client, onDate, item);
    if (ov && !ov.fits) ov = null;
    // A part with no weight on record cannot be converted; it is billed per piece off the client's card (Samarth's
    // brackets), or a per-piece override. Before this the line priced itself at weight 0 × ₹/kg = ₹0.
    var perPiece = ov ? (ov.how === 'piece' ? { rate: ov.rate } : null)
      : (pw ? null : getPieceRate(client, onDate, item.partNumber, item.desc));
    // A rate somebody typed is theirs (item._auto.rate false, while the line still carries the figure typed): the
    // record prices only an empty or a filled rate. It used to replace a typed rate silently.
    var typed = item.rate > 0 && item._auto && item._auto.rate === false && item._auto.rateTyped === item.rate;
    if (perPiece && perPiece.rate != null) {
      if (!typed) item.rate = perPiece.rate;
      item.amount = gstRound((item.qty || 0) * item.rate);
      return;
    }
    if (!typed) item.rate = ov ? ov.rate : clientLadderRate(client, onDate);
    item.amount = gstRound((item.qty || 0) * pw * item.rate);
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
  // The part's override is in another unit than the line: nothing to compare, and never "Matches". `need` is what
  // would let it price the line: the line in NOS, in KG, or (pieces of a nos_to_weight client) the part's weight.
  if (ref.fits === false) return { status: 'unit', ref: ref.rate, unit: ref.unit, source: ref.source,
    need: ref.unit === 'piece' ? 'NOS' : client.billingMode === 'nos_to_weight' && item.unit === 'NOS' ? 'weight' : 'KG' };
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
  else if (part && part.stdWeightKg > 0) item._kgPc = { kg: part.stdWeightKg, src: 'Parts' };
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
   "[A client] generally is despatched through only one way of transport … it's the same for every
   invoice, so let's make it so that the field is already filled out along with PO number, which is
   usually the same as their challan number with [their prefix]." A client SETTING, never a
   hard-code: `defaultTransport` (the vehicle) and `poFromChallan`, a pattern where `{challan}` is the
   challan number and `{challan:5}` the same padded to five digits — QX1/{challan:5} makes challan
   1372 read QX1/01372. The invoice form applies both (create.js, createApplyClientDefaults). */
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
