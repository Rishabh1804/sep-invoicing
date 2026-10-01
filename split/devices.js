/* ===== DEVICES (the guard, step G2) =====
   The owner, 1 Oct 2026: "Once the device is registered to be able to push, that setup requires the presence of the
   admin to register a device to be able to push and pull from GitHub, the only way they can view data is by importing
   if the device is not registered." And: "The condition for the device to be considered registered are that GitHub and
   device details must have been entered and gated by an ID PIN check and then the device is registered and a copy is
   sent to GitHub with the correct metadata and data."

   With the guard on (guard.js: an owner exists), a device pushes to and pulls from GitHub only once it is in S.devices:
   registered from Settings → Access → Devices with its GitHub details saved and the owner's ID and PIN checked, after
   which a copy goes to GitHub at once carrying `_device` beside the book. A device not on the list can only import. A
   device the owner removes stops syncing, and deletes its token and its key the next time it loads the book (a reload,
   a pull, another window's save, an import). With the guard off nothing here changes anything: sync works exactly as
   it did, registered or not.

   The token is locked to the device: AES-GCM under a key WebCrypto makes non-extractable, kept in a small database of
   its own, so a copy of the browser's storage is no use anywhere else. It is read once at the start, into memory (so
   getGhToken stays synchronous), and is never written into the book, an export or the console. A token kept on a device
   can still be used by anyone who can open the app on it: hence one token per device, so a lost phone is cut off on
   GitHub by deleting its token. */

var DEV_ID_KEY = 'sep_inv_device_id';
var DEV_NAME_KEY = 'sep_inv_device_name';
var DEV_TOKEN_ENC_KEY = 'sep_inv_github_token_enc';
// The removal this device has already acted on: a token entered again after it is kept until the device is registered.
var DEV_CUT_KEY = 'sep_inv_device_cut';
var DEV_KEYS_DB = 'sep-invoicing-keys';
var DEV_KEYS_STORE = 'keys';
var DEV_TOKEN_KEY_ID = 'github-token';
// The start waits this long at most for the token's key; past it the app starts and the token arrives once read.
var DEV_BOOT_WAIT_MS = 3000;
var DEV_UNREG_TEXT = 'This device isn\'t registered. Register it with the owner present, or import a backup (Settings → Import) to view the data.';
var DEV_LOST_TEXT = 'The GitHub token on this device could not be read: enter it again (Settings → Connections → GitHub sync).';
var DEV_TOKEN_ADVICE = 'A token kept on a device can be used by anyone who can open this app on it; make one fine-grained token per device, for this repository only, Contents read and write, so a lost phone is cut off on GitHub by deleting its token.';
var DEV_ROLE_WORDS = { owner: 'Owner', office: 'Office', supervisor: 'Supervisor', floor: 'Floor' };

function _devLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function _devLsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function _devLsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* nothing to remove */ } }

function _devRandomHex(bytes) {
  var a = new Uint8Array(bytes);
  try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256); }
  return Array.prototype.map.call(a, function(b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}

/* ===== THIS DEVICE ===== */
var _devIdMem = null;
/* This device's id, made on the first call. A device that already synced keeps the id its sync config gave it, so its
   GitHub copies and its row on the list name one device. */
function devId() {
  var id = _devLsGet(DEV_ID_KEY);
  if (id) return id;
  if (_devIdMem) return _devIdMem;
  var sync = null;
  try { sync = JSON.parse(_devLsGet(GH_SYNC_KEY) || 'null'); } catch (e) { sync = null; }
  id = sync && sync.deviceId ? String(sync.deviceId) : 'dev-' + _devRandomHex(6);
  _devIdMem = id;
  _devLsSet(DEV_ID_KEY, id);
  return id;
}

/* What kind of device this is, read from the browser: the name until one is given. */
function devUaLabel() {
  var ua = String((typeof navigator !== 'undefined' && navigator.userAgent) || '');
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android phone' : 'Android tablet';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/CrOS/i.test(ua)) return 'Chromebook';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux PC';
  return 'This device';
}

/* The name given at registration; before it, the one typed in GitHub sync, else what the browser says it is. */
function devName() {
  var n = _devLsGet(DEV_NAME_KEY);
  if (n) return n;
  var sync = loadJSON(GH_SYNC_KEY, null);
  if (sync && sync.deviceName) return String(sync.deviceName);
  return devUaLabel();
}

/* One name: kept for the device, and in the sync config that names each GitHub commit. */
function devSetName(name) {
  _devLsSet(DEV_NAME_KEY, name);
  var c = loadJSON(GH_SYNC_KEY, null) || {};
  c.deviceName = name;
  if (!c.deviceId) c.deviceId = devId();
  setGhConfig(c);
}

/* ===== THE GUARD, THROUGH ITS OWN NAMES (guard.js) =====
   Each read is guarded, so this step works on its own: with no guard.js, the guard is off. */
function devGuardOn() { try { return typeof grdOn === 'function' && !!grdOn(); } catch (e) { return false; } }
function devUserId() { try { return typeof grdUserId === 'function' ? (grdUserId() || null) : null; } catch (e) { return null; } }
function devIsOwner() { try { return typeof grdIsOwner === 'function' && !!grdIsOwner(); } catch (e) { return false; } }
// Registering or removing a device is the owner's: guard.js refuses another ID with a word, and asks the owner's PIN.
function devAsk(what) { return typeof guardAsk === 'function' ? Promise.resolve(guardAsk('users', what)) : Promise.resolve(true); }
function devUsers() { return S && Array.isArray(S.users) ? S.users : []; }
function devUserName(id, users) {
  if (id == null || id === '') return '';
  var u = (users || devUsers()).find(function(x) { return x && String(x.id) === String(id); });
  return u ? String(u.name || '') : '';
}

/* ===== THE LIST =====
   S.devices: [{id, name, user, registeredAt, registeredBy, build, ua, lastPushAt?, removedAt?, removedBy?, removeReason?}] */
function devRows() { return S && Array.isArray(S.devices) ? S.devices : []; }
function devRow(id) {
  var k = String(id == null ? devId() : id);
  return devRows().find(function(r) { return r && String(r.id) === k; }) || null;
}
/* Registered: the guard is on and this device is on the list, not removed. With the guard off, no device is, and none
   needs to be. */
function devRegistered() { if (!devGuardOn()) return false; var r = devRow(); return !!(r && !r.removedAt); }
function devRemovedRow() { if (!devGuardOn()) return null; var r = devRow(); return r && r.removedAt ? r : null; }
function devWhen(ts) { return ts ? formatDate(isoOf(new Date(ts))) : '—'; }
function devRemovedText(r) {
  return 'This device was removed by ' + (devUserName(r.removedBy) || 'the owner') + ' on ' + devWhen(r.removedAt) + ': ' +
    (String(r.removeReason || '').replace(/[.\s]+$/, '') || 'no reason recorded') + '.';
}
/* Why this device may not push or pull ('' when it may). The guard off: always ''. */
function devSyncBlocked() {
  if (!devGuardOn()) return '';
  var r = devRow();
  if (!r) return DEV_UNREG_TEXT;
  return r.removedAt ? devRemovedText(r) : '';
}
/* The same, in a few words for the Home card and the sync summary. */
function devSyncBlockedShort() {
  if (!devSyncBlocked()) return '';
  return devRemovedRow() ? 'stopped: this device was removed' : 'paused: this device isn\'t registered';
}

/* ===== THE TOKEN, LOCKED TO THE DEVICE ===== */
var _devToken = '';            // in memory, read once at the start
var _devTokenState = 'none';   // none | reading | locked | plain (this browser cannot lock it) | lost (could not be read)
var _devTokenSeq = 0;          // a newer set or read wins over one still in flight
var _devTokenBooted = false;

function _devB64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
function _devUnb64(b64) { var s = atob(String(b64)); var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }

/* The key database, opened for one task and closed after it, so nothing holds it open (a site-data clear, or another
   window, is never blocked). Resolves null where it cannot open: no IndexedDB, no WebCrypto, or too slow. */
function _devKeysOpen() {
  return new Promise(function(resolve) {
    var settled = false, timer = null;
    var done = function(db) {
      if (settled) { if (db) { try { db.close(); } catch (e) { /* closed */ } } return; }
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(db);
    };
    try {
      if (typeof indexedDB === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) { done(null); return; }
      var req = indexedDB.open(DEV_KEYS_DB, 1);
      req.onupgradeneeded = function() {
        try { if (!req.result.objectStoreNames.contains(DEV_KEYS_STORE)) req.result.createObjectStore(DEV_KEYS_STORE); } catch (e) { /* the open fails */ }
      };
      req.onsuccess = function() {
        var db = req.result;
        db.onversionchange = function() { try { db.close(); } catch (e) { /* closed */ } };
        done(db);
      };
      req.onerror = function() { done(null); };
      timer = setTimeout(function() { done(null); }, DEV_BOOT_WAIT_MS);
    } catch (e) { done(null); }
  });
}
function _devKeyTx(mode, fn) {
  return _devKeysOpen().then(function(db) {
    if (!db) return null;
    return new Promise(function(resolve) {
      var out = { v: null }, end = function(v) { try { db.close(); } catch (e) { /* closed */ } resolve(v); };
      try {
        var tx = db.transaction(DEV_KEYS_STORE, mode);
        fn(tx.objectStore(DEV_KEYS_STORE), out);
        tx.oncomplete = function() { end(out.v); };
        tx.onerror = tx.onabort = function() { end(null); };
      } catch (e) { end(null); }
    });
  });
}
function _devKeyRead() {
  return _devKeyTx('readonly', function(st, out) { var r = st.get(DEV_TOKEN_KEY_ID); r.onsuccess = function() { out.v = r.result || null; }; });
}
/* The device's key, made the first time a token is locked. Two windows locking at once keep ONE key: the read and the
   write are one transaction, so neither can keep a key of its own and leave a token nothing opens. */
function _devKeyEnsure() {
  return _devKeyRead().then(function(k) {
    if (k) return k;
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']).then(function(fresh) {
      return _devKeyTx('readwrite', function(st, out) {
        var r = st.get(DEV_TOKEN_KEY_ID);
        r.onsuccess = function() {
          if (r.result) { out.v = r.result; return; }
          st.put(fresh, DEV_TOKEN_KEY_ID);
          out.v = fresh;
        };
      });
    });
  }).then(null, function() { return null; });
}
function _devKeyDelete() {
  return _devKeyTx('readwrite', function(st, out) { st.delete(DEV_TOKEN_KEY_ID); out.v = true; }).then(null, function() { return null; });
}
function _devTokenEncrypt(t) {
  return _devKeyEnsure().then(function(key) {
    if (!key) return null;
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(t)).then(function(ct) {
      return JSON.stringify({ v: 1, iv: _devB64(iv), ct: _devB64(new Uint8Array(ct)) });
    });
  }).then(null, function() { return null; });
}
function _devTokenDecrypt(stored) {
  var o = null;
  try { o = JSON.parse(stored); } catch (e) { o = null; }
  if (!o || typeof o.iv !== 'string' || typeof o.ct !== 'string') return Promise.resolve(null);
  return _devKeyRead().then(function(key) {
    if (!key) return null;
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: _devUnb64(o.iv) }, key, _devUnb64(o.ct)).then(function(buf) {
      return new TextDecoder().decode(buf);
    });
  }).then(null, function() { return null; });
}

/* getGhToken() reads this: the token in memory once the start has read it, before that the entry as typed. */
function devTokenGet() {
  if (_devTokenBooted) return _devToken;
  return _devLsGet(GH_TOKEN_KEY) || '';
}

/* setGhToken() writes through this: in memory at once, then locked to the device. Resolves true once locked; false
   where this browser cannot lock it, in which case it is kept as typed, as every build before this one kept it. */
function devTokenSet(t) {
  t = String(t == null ? '' : t);
  if (_devTokenBooted && t === _devToken && (t ? _devTokenState === 'locked' : _devTokenState === 'none')) return Promise.resolve(true);
  var seq = ++_devTokenSeq;
  _devToken = t;
  _devTokenBooted = true;
  if (!t) {
    _devTokenState = 'none';
    _devLsDel(DEV_TOKEN_ENC_KEY);
    _devLsDel(GH_TOKEN_KEY);
    return Promise.resolve(true);
  }
  _devTokenState = 'plain';
  return _devTokenEncrypt(t).then(function(enc) {
    if (seq !== _devTokenSeq) return !!enc;
    if (enc && _devLsSet(DEV_TOKEN_ENC_KEY, enc)) {
      _devLsDel(GH_TOKEN_KEY);
      _devTokenState = 'locked';
      return true;
    }
    _devLsSet(GH_TOKEN_KEY, t);
    _devLsDel(DEV_TOKEN_ENC_KEY);
    _devTokenState = 'plain';
    return false;
  });
}

/* At the start, beside the book (init.js): the token into memory. A token kept as typed (a build before this one) is
   locked and its plain entry removed, whether or not the guard is on. Never rejects, and never holds the start longer
   than DEV_BOOT_WAIT_MS: a token read late arrives in memory when it is read. */
function devTokenBoot() {
  var seq = _devTokenSeq, work;
  var plain = _devLsGet(GH_TOKEN_KEY), enc = _devLsGet(DEV_TOKEN_ENC_KEY);
  if (plain) {
    _devToken = plain;
    _devTokenState = 'plain';
    work = _devTokenEncrypt(plain).then(function(s) {
      if (seq !== _devTokenSeq || !s) return;
      // Locked first, then the plain entry removed: another window reading between the two finds one or the other.
      if (_devLsSet(DEV_TOKEN_ENC_KEY, s)) { _devLsDel(GH_TOKEN_KEY); _devTokenState = 'locked'; }
    });
  } else if (enc) {
    _devTokenState = 'reading';
    work = _devTokenDecrypt(enc).then(function(t) {
      if (seq !== _devTokenSeq) return;
      _devToken = t || '';
      _devTokenState = t ? 'locked' : 'lost';
      if (_devTokenBooted) { try { ghRenderCard(); } catch (e) { /* drawn at the next render */ } }
    });
  } else {
    _devTokenState = 'none';
    work = Promise.resolve();
  }
  var wait = new Promise(function(resolve) { setTimeout(resolve, DEV_BOOT_WAIT_MS); });
  return Promise.race([work.then(null, function() {}), wait]).then(function() { _devTokenBooted = true; });
}
/* init.js's start waits on this; a throw here must not take the start with it. */
function devBootWait() {
  try { return devTokenBoot(); } catch (e) { _devTokenBooted = true; return null; }
}

/* Another window changed the token (entered, cleared, locked): this one reads it again. */
function devTokenReread() {
  var seq = ++_devTokenSeq;
  var plain = _devLsGet(GH_TOKEN_KEY), enc = _devLsGet(DEV_TOKEN_ENC_KEY);
  _devTokenBooted = true;
  if (plain) { _devToken = plain; _devTokenState = 'plain'; return Promise.resolve(); }
  if (!enc) { _devToken = ''; _devTokenState = 'none'; return Promise.resolve(); }
  return _devTokenDecrypt(enc).then(function(t) {
    if (seq !== _devTokenSeq) return;
    _devToken = t || '';
    _devTokenState = t ? 'locked' : 'lost';
    try { ghRenderCard(); } catch (e) { /* drawn at the next render */ }
  });
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', function(e) {
    if (e.key === null || e.key === DEV_TOKEN_ENC_KEY || e.key === GH_TOKEN_KEY) devTokenReread();
  });
}

function devTokenHeld() { return !!(_devToken || _devLsGet(DEV_TOKEN_ENC_KEY) || _devLsGet(GH_TOKEN_KEY)); }

/* A removed device forgets its token: in memory, both entries, and the key. Its sync position stays, so a device
   registered again pushes without asking when nothing has moved on GitHub since. */
function devForgetToken() {
  _devTokenSeq++;
  _devToken = '';
  _devTokenState = 'none';
  _devTokenBooted = true;
  _devLsDel(DEV_TOKEN_ENC_KEY);
  _devLsDel(GH_TOKEN_KEY);
  if (typeof ghCancelPending === 'function') ghCancelPending();
  return _devKeyDelete();
}

function devTokenStateHtml() {
  switch (_devTokenState) {
    case 'locked': return uiDot('ok', 'Locked to this device');
    case 'plain': return uiDot('warning', 'Kept as typed: this browser cannot lock it to the device');
    case 'lost': return uiDot('danger', 'Could not be read: enter it again');
    case 'reading': return uiDot('neutral', 'Being read');
    default: return uiDot('neutral', 'Not entered');
  }
}

/* ===== LOADING THE BOOK =====
   At the start (bootApp), after another window's save (bookReload), after a pull and after an import: a device the book
   says was removed forgets its token, once for each removal, and says so. */
function devAfterLoad(how) {
  try {
    if (how === 'reload') _devGuardSeen = devGuardOn();   // only the window that turned the guard on offers to register
    var gone = devRemovedRow();
    if (gone && devTokenHeld() && _devLsGet(DEV_CUT_KEY) !== String(gone.removedAt)) devCutOff(gone);
    if (how !== 'boot') ghRenderCard();
  } catch (e) { console.error(e); }
}
function devCutOff(row) {
  var t = devRemovedText(row);
  _devLsSet(DEV_CUT_KEY, String(row.removedAt));
  devForgetToken();
  uiNotice(t + ' It no longer pushes to or pulls from GitHub, and its GitHub token is deleted from it.', 'warning');
  ghSetStatus(t);
}

var _devGuardSeen = null;   // the guard as this window last saw it; null until the start has run
var _devOffered = false;

function devBoot() {
  _devGuardSeen = devGuardOn();
  devAfterLoad('boot');
  if (_devTokenState === 'lost') {
    uiNotice(DEV_LOST_TEXT, 'warning');
    ghSetStatus(DEV_LOST_TEXT);
  }
}

/* Every save (ghNotifyChange): the save that turns the guard on, on a device that already syncs, offers to register
   it at once. Until it is, its sync is paused and says why. */
function devOnSave() {
  if (_devGuardSeen === null) return;
  var on = devGuardOn();
  if (on && !_devGuardSeen && ghIsConfigured() && !devRow()) devOfferRegister();
  _devGuardSeen = on;
}
function devOfferRegister() {
  if (_devOffered) return;
  _devOffered = true;
  // Whatever turning the guard on still shows (the recovery code) is read first, and the lock, if any, is answered.
  devWhenClear(function() {
    if (!devGuardOn() || devRow() || !ghIsConfigured()) return;
    var who = devUserName(devUserId());
    uiConfirm({ title: 'Register this device?', body: 'This device pushes to and pulls from GitHub. With the guard on, only a registered device does: until this one is registered, its sync is paused.\n\nRegister it as ' +
      devName() + (who ? ', used by ' + who : '') + ', and send a copy to GitHub now?', okLabel: 'Register this device', cancelLabel: 'Not now' }).then(function(ok) {
      if (ok) devRegister({ name: devName(), user: devUserId() });
      else showToast('GitHub sync is paused until this device is registered: Settings → Access → Devices', 'warning');
    });
  });
}
function devWhenClear(fn) {
  var started = Date.now();
  var check = function() {
    var busy = document.body.classList.contains('inv-locked') || Array.prototype.some.call(document.querySelectorAll('.inv-scrim-dialog'),
      function(s) { return s.id !== 'settingsScrim'; });
    if (!busy) { fn(); return; }
    if (Date.now() - started < 30 * 60000) setTimeout(check, 500);
  };
  setTimeout(check, 600);
}

/* ===== REGISTERING ===== */
function devRegisterClick() {
  var n = document.getElementById('devNameIn'), u = document.getElementById('devUserIn');
  return devRegister({ name: n ? n.value : '', user: u ? u.value : '' });
}

/* The device's name and who uses it, the GitHub details as GitHub sync holds them, then the owner's ID and PIN: the row
   goes on the list, the book is saved, and a copy goes to GitHub at once carrying who wrote it. */
async function devRegister(o) {
  o = o || {};
  if (!devGuardOn()) { showToast('Turn on the guard first (Access → Users): until then every device syncs as before', 'warning'); return false; }
  if (bookStandIn()) { showToast('This window holds a stand-in, not the book: import a backup first', 'error'); return false; }
  var name = String(o.name || '').trim().slice(0, 60);
  if (!name) { showToast('Name this device', 'error'); return false; }
  var user = devUsers().find(function(u) { return u && u.active !== false && String(u.id) === String(o.user); });
  if (!user) { showToast('Choose who mainly uses this device', 'error'); return false; }
  if (ghFieldsUnsaved()) return false;
  if (!ghIsConfigured()) { showToast('Enter the GitHub details first: Connections → GitHub sync (owner, repo, branch, file and token)', 'error'); return false; }
  if (!(await devAsk('Register this device'))) return false;

  // GitHub's copy, where the guard is on in it and this device has not seen it, is the book: the device is registered in
  // that copy, never pushes its own (older, or imported) book over it. One with the guard off there is not: this
  // device's book goes up, and the push asks before it replaces anything, as every push does.
  var taken = await devTakeRemote(user.id);
  if (taken === 'stop') return false;
  var took = taken === 'took';

  if (!Array.isArray(S.devices)) S.devices = [];
  var id = devId(), row = devRow(id);
  var fields = { id: id, name: name, user: user.id, registeredAt: Date.now(), registeredBy: devUserId(), build: APP_BUILD,
    ua: String((typeof navigator !== 'undefined' && navigator.userAgent) || '').slice(0, 200) };
  if (row) {
    Object.keys(fields).forEach(function(k) { row[k] = fields[k]; });
    delete row.removedAt; delete row.removedBy; delete row.removeReason;
  } else S.devices.push(fields);
  devSetName(name);
  _devLsDel(DEV_CUT_KEY);
  await devTokenSet(getGhToken());
  await saveState();
  // The save armed auto-push; the copy goes now.
  if (typeof ghCancelPending === 'function') ghCancelPending();
  devRefreshSettings();
  var pushed = await ghPushLocked({ register: true });
  // A book taken from GitHub is drawn on every screen, as after a pull.
  if (took) bookReplacedShow();
  devRefreshSettings();
  ghRenderCard();
  if (pushed) showToast(took ? 'This device is registered in GitHub\'s copy, and it went back to GitHub' : 'This device is registered, and a copy went to GitHub');
  else showToast('This device is registered. The copy did not reach GitHub: push again from Connections → GitHub sync', 'warning');
  return true;
}

/* Why GitHub's copy cannot be the book this device registers in ('' when it can). */
function devRemoteUnfit(env, userId) {
  if (!env || env.app !== 'sep-invoicing' || !env.state || !env.state.company || !env.state.clients) return 'GitHub\'s file is not a SEP Invoicing backup';
  if (env.schema > GH_SCHEMA) return 'GitHub\'s copy was written by a newer version of the app';
  var users = Array.isArray(env.state.users) ? env.state.users : [];
  if (!users.some(function(u) { return u && u.active !== false && String(u.id) === String(userId); })) {
    return 'who uses this device is not an ID on GitHub\'s copy: add the ID on the owner\'s device and push, then register this one';
  }
  return '';
}
function devGuardedBook(state) {
  return !!(state && Array.isArray(state.users) && state.users.some(function(u) { return u && u.role === 'owner' && u.active !== false; }));
}

/* Before registering: 'took' (GitHub's copy is now this device's book), 'own' (this device's book is the one to send),
   or 'stop' (said why). GitHub must be in reach: the copy goes there at once. */
async function devTakeRemote(userId) {
  var cfg = getGhConfig(), remote, full;
  try { remote = await ghGetRemote(cfg, { body: false }); }
  catch (err) { showToast('Not registered: ' + err.message, 'error'); return 'stop'; }
  if (!remote || !remote.sha || remote.sha === cfg.sha) return 'own';
  try { full = await ghGetRemote(cfg); }
  catch (err) { showToast('Not registered: ' + err.message, 'error'); return 'stop'; }
  var env = full && full.envelope;
  if (!env || !env.state || !devGuardedBook(env.state)) return 'own';
  var unfit = devRemoteUnfit(env, userId);
  if (unfit) { showToast('Not registered: ' + unfit, 'error'); return 'stop'; }
  if (!(await uiConfirm({ title: 'Register this device in GitHub’s copy?', body: 'GitHub holds a copy this device has not seen: ' + ghDescribeEnvelope(env) +
      '.\n\nThat copy is the book. It replaces this device\'s book (' + ghCountsText() + '), as a pull does; this device goes on its list, and the copy goes back to GitHub. Continue?',
      okLabel: 'Take it and register' }))) return 'stop';
  try { adoptState(env.state); }
  catch (err) { showToast('GitHub\'s copy could not be read: ' + err.message, 'error'); return 'stop'; }
  bookReleaseStandIn();
  // The SHA is this device's once the copy is on its disk: the push after it then sends without asking.
  if (await saveState()) ghRecord(cfg, { sha: full.sha, lastPullAt: Date.now() });
  return 'took';
}

/* A registered device's name, or who uses it. */
async function devSaveDetails() {
  var row = devRow();
  if (!row || row.removedAt || !devGuardOn()) return;
  var n = document.getElementById('devNameIn'), u = document.getElementById('devUserIn');
  var name = String(n ? n.value : '').trim().slice(0, 60);
  var user = devUsers().find(function(x) { return x && x.active !== false && String(x.id) === String(u ? u.value : ''); });
  if (!name) { showToast('Name this device', 'error'); return; }
  if (!user) { showToast('Choose who mainly uses this device', 'error'); return; }
  if (name === row.name && String(user.id) === String(row.user)) { showToast('Nothing changed', 'info'); return; }
  if (!(await devAsk('Change this device'))) return;
  row = devRow();
  if (!row || row.removedAt) return;
  row.name = name;
  row.user = user.id;
  devSetName(name);
  await saveState();
  devRefreshSettings();
  ghRenderCard();
  showToast('Device details saved');
}

/* ===== REMOVING =====
   The owner's, with a reason. The device finds out from the book, so the list goes to GitHub at once where this device
   can send it. A device does not remove itself: it is removed from another registered device. */
async function devRemove(id) {
  var row = devRow(id);
  if (!row || row.removedAt || !devGuardOn()) return;
  if (String(row.id) === String(devId())) {
    await uiAlert({ title: 'This is the device you are using', body: 'A device is removed from another registered device. To stop this one syncing now, clear its token in Connections → GitHub sync, and delete that token on GitHub.' });
    return;
  }
  if (!(await devAsk('Remove a device'))) return;
  var reason = await uiPrompt({ title: 'Remove ' + (row.name || row.id) + '?',
    body: 'It stops pushing to and pulling from GitHub, and deletes its GitHub token the next time it loads the book; the list goes to GitHub now so that it finds out. Delete its token on GitHub as well: that cuts it off at once.',
    label: 'Why is it removed?', required: true, okLabel: 'Remove device', danger: true });
  if (reason == null) return;
  row = devRow(id);
  if (!row || row.removedAt) return;
  row.removedAt = Date.now();
  row.removedBy = devUserId();
  row.removeReason = reason;
  var name = row.name || row.id;
  await saveState();
  devRefreshSettings();
  if (!devSyncBlocked() && ghIsConfigured()) {
    if (typeof ghCancelPending === 'function') ghCancelPending();
    var pushed = await ghPushLocked();
    devRefreshSettings();
    if (pushed) { showToast('Removed ' + name + ', and the list went to GitHub'); return; }
  }
  showToast('Removed ' + name + '. It finds out from GitHub\'s copy: push to GitHub', 'warning');
}

/* ===== PUSHING A REGISTERED DEVICE'S COPY =====
   ghPush asks this before it sends: a registered device's copy carries `_device` beside the book (who wrote it, on
   which build), its commit message names the device and the user, and its row's last push is the push being sent.
   The value is set only for the copy; it is kept on this device once GitHub has taken it (done). Null with the guard
   off or the device not registered: the copy and the message are then exactly as before. */
function devPushPrep(envelope, opts) {
  if (!devRegistered()) return null;
  var row = devRow(), at = Date.now(), by = devUserId();
  var had = Object.prototype.hasOwnProperty.call(row, 'lastPushAt'), prev = row.lastPushAt;
  var userName = devUserName(row.user), byName = devUserName(by);
  row.lastPushAt = at;
  envelope._device = { id: row.id, name: row.name, user: row.user != null ? row.user : null, userName: userName || null,
    by: by, byName: byName || null, build: APP_BUILD, at: at };
  var n = envelope.counts || {};
  var counts = n.invoices + ' invoices, ' + n.challans + ' challans';
  var message = opts && opts.register
    ? 'SEP Invoicing: ' + row.name + ' registered for ' + (userName || 'its user') + ' — ' + counts
    : 'SEP Invoicing backup — ' + counts + ' (' + row.name + ((byName || userName) ? ' · ' + (byName || userName) : '') + ')';
  return {
    message: message,
    restore: function() {
      var r = devRow(row.id);
      if (!r) return;
      if (had) r.lastPushAt = prev; else delete r.lastPushAt;
    },
    // Quietly, without arming auto-push: a push that saved and so armed the next push would push for ever. And only over
    // the book this window holds: where another window has saved since, its book is loaded here instead (the version
    // guard) and this push's time goes with the next one, rather than a refused write saying a change was lost.
    done: function() {
      var r = devRow(row.id);
      if (!r) return;
      r.lastPushAt = at;
      readStoredRev().then(function(rev) { if ((rev || null) === (_diskRev || null)) persistState(); }, function() {});
    }
  };
}

/* ===== SETTINGS → ACCESS → DEVICES ===== */
function devKv(k, vHtml, wide) { return '<div' + (wide ? ' class="inv-kv-wide"' : '') + '><div class="inv-kv-k">' + escHtml(k) + '</div><div>' + vHtml + '</div></div>'; }

function devListHtml() {
  var me = String(devId());
  var rows = devRows().slice().sort(function(a, b) {
    return (a.removedAt ? 1 : 0) - (b.removedAt ? 1 : 0) || (b.registeredAt || 0) - (a.registeredAt || 0);
  });
  var live = rows.filter(function(r) { return !r.removedAt; }).length;
  var body = rows.map(function(r) {
    var mine = String(r.id) === me;
    // What matters leads, since a phone cuts the meta at two lines: the last push, and why a device was removed.
    var meta = r.removedAt
      ? 'Removed ' + devWhen(r.removedAt) + ': ' + (r.removeReason || 'no reason recorded') + ' · by ' + (devUserName(r.removedBy) || 'the owner')
      : 'Used by ' + (devUserName(r.user) || 'nobody named') + ' · ' + (r.lastPushAt ? 'last push ' + ghRelTime(r.lastPushAt) : 'no push seen') +
        ' · registered ' + devWhen(r.registeredAt) + ' by ' + (devUserName(r.registeredBy) || 'the owner');
    var end = (mine ? '<span class="inv-badge inv-badge-info">This device</span>' : '') +
      (r.removedAt ? uiDot('danger', 'Removed')
        : mine ? '' : '<button type="button" class="inv-btn inv-btn-danger inv-btn-sm" data-action="invDevRemove" data-id="' + escHtml(String(r.id)) + '">Remove</button>');
    return '<div class="inv-row inv-row-2 inv-row-flow' + (r.removedAt ? ' inv-row-muted' : '') + '" data-dev="' + escHtml(String(r.id)) + '">' +
      '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(r.name || r.id) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(meta) + '</span></span>' +
      (end ? '<span class="inv-row-end">' + end + '</span>' : '') + '</div>';
  }).join('');
  return '<div class="inv-panel inv-panel-flush inv-mt-16" data-card="devices"><div class="inv-panel-head"><span class="inv-panel-title">Devices ' +
    '<span class="inv-panel-count">' + live + '</span></span></div>' +
    (body || '<div class="inv-empty">No device is registered yet. Register this one above.</div>') + '</div>';
}

function devSettingsBody() {
  var id = devId();
  if (!devGuardOn()) {
    return '<p class="inv-note">The guard is off, so every device with the GitHub details pushes and pulls, as before. Once the owner turns it on ' +
      '(Access → Users), a device pushes and pulls only once it is registered here, with the owner present; any other can view the data by importing a backup.</p>' +
      '<div class="inv-kv inv-mt-8">' + devKv('This device', escHtml(devName())) + devKv('Its id', '<span class="inv-id">' + escHtml(id) + '</span>') + '</div>' +
      '<p class="inv-note inv-mt-8">' + escHtml(DEV_TOKEN_ADVICE) + '</p>';
  }
  var row = devRow(id), cfg = getGhConfig(), live = row && !row.removedAt, h = '';
  if (row && row.removedAt) h += '<div class="inv-callout inv-callout-danger" data-dev-status="removed">' + escHtml(devRemovedText(row) + ' Register it again, with the owner present, to sync.') + '</div>';
  else if (row) h += '<div class="inv-callout inv-callout-neutral" data-dev-status="registered">' + uiDot('ok', 'Registered') + ' ' +
    escHtml('on ' + devWhen(row.registeredAt) + ' by ' + (devUserName(row.registeredBy) || 'the owner') + ' · used by ' + (devUserName(row.user) || 'nobody named')) + '</div>';
  else h += '<div class="inv-callout inv-callout-warning" data-dev-status="unregistered">' + escHtml(DEV_UNREG_TEXT) + '</div>';

  var cur = live && row.user != null ? String(row.user) : String(devUserId() || '');
  var opts = devUsers().filter(function(u) { return u && u.active !== false; }).map(function(u) {
    return '<option value="' + escHtml(String(u.id)) + '"' + (String(u.id) === cur ? ' selected' : '') + '>' +
      escHtml((u.name || '') + ' · ' + (DEV_ROLE_WORDS[u.role] || u.role || '')) + '</option>';
  }).join('');
  h += '<div class="inv-fields inv-mt-8">' +
    _sfg('Name of this device', 'devNameIn', '<input class="inv-input" id="devNameIn" value="' + escHtml(live ? row.name : devName()) + '" maxlength="60" autocomplete="off">') +
    _sfg('Who mainly uses it', 'devUserIn', '<select class="inv-select" id="devUserIn">' + opts + '</select>') + '</div>';
  // The repo and the file as GitHub sync holds them, on a line of their own that wraps: a real repo name in a mono
  // half-width cell ran past the panel on a phone.
  h += '<div class="inv-kv">' +
    devKv('GitHub', cfg.owner && cfg.repo ? escHtml(cfg.owner + '/' + cfg.repo + ' · ' + cfg.branch + ' · ' + cfg.path) : 'not set: enter it in GitHub sync', true) +
    devKv('Token', devTokenStateHtml()) +
    devKv('This device’s id', '<span class="inv-id">' + escHtml(id) + '</span>') + '</div>';
  h += '<div class="inv-toolbar inv-toolbar-flush inv-mt-8">' +
    '<button type="button" class="inv-btn inv-btn-ghost" data-action="invDevGo" data-sec="sync">GitHub details</button>' +
    (live ? '<button type="button" class="inv-btn inv-btn-secondary" data-action="invDevSave">Save details</button>'
      : '<button type="button" class="inv-btn inv-btn-primary" data-action="invDevRegister">Register this device</button>') + '</div>';
  h += '<p class="inv-note inv-mt-8">' + escHtml(DEV_TOKEN_ADVICE) + '</p>';
  if (devIsOwner()) h += devListHtml();
  else h += '<p class="inv-note inv-mt-8">Registering, and the list of devices, are the owner’s: the owner signs in on this device to register it.</p>';
  return h;
}

var DEV_SETTINGS_SEC = {
  title: 'Devices',
  guard: 'users',   // the owner's section (guard.js): registering and removing devices ask the owner's ID
  summary: function() {
    if (!devGuardOn()) return 'the guard is off: every device syncs';
    var live = devRows().filter(function(r) { return r && !r.removedAt; }).length, me = devRow();
    return escHtml((me && me.removedAt ? 'this device was removed' : me ? 'this device is registered' : 'this device isn\'t registered') +
      ' · ' + live + ' registered');
  },
  body: function() { return devSettingsBody(); },
  why: 'A device is registered once its GitHub details and its own are entered and the owner&rsquo;s ID and PIN are checked; a copy then goes to GitHub at once, ' +
    'carrying the device&rsquo;s name, its user and the build. With the guard on, a device that is not registered does not push or pull: it can view the data by ' +
    'importing a backup. A removed device stops syncing, and deletes its GitHub token and its key the next time it loads the book. The token is stored encrypted ' +
    'under a key this browser keeps and cannot hand out, so a copy of the browser&rsquo;s storage is no use on another device; on this one, anybody who can open the app can use it.'
};

/* The section joins the Access group, which the gate (guard.js) makes in settings.js with Users in it; where that group
   is not there (this step on its own), it is made here, before Data & device. */
(function() {
  if (typeof SETTINGS_SECS === 'undefined' || typeof SETTINGS_GROUPS === 'undefined') return;
  SETTINGS_SECS.devices = DEV_SETTINGS_SEC;
  var g = SETTINGS_GROUPS.find(function(x) { return x.key === 'access' || x.secs.indexOf('users') >= 0; });
  if (!g) {
    g = { key: 'access', label: 'Access', secs: [] };
    var at = SETTINGS_GROUPS.findIndex(function(x) { return x.key === 'data'; });
    SETTINGS_GROUPS.splice(at < 0 ? SETTINGS_GROUPS.length : at, 0, g);
  }
  if (g.secs.indexOf('devices') < 0) g.secs.push('devices');
})();

/* Redraws this section, and GitHub sync unless it holds an unsaved edit, in an open Settings; and every summary. */
function devRefreshSettings() {
  var scrim = document.getElementById('settingsScrim');
  if (!scrim) return;
  ['devices', 'sync'].forEach(function(k) {
    var d = scrim.querySelector('details[data-sec="' + k + '"]');
    if (!d || d.hasAttribute('data-dirty')) return;
    d.outerHTML = _settingsSecHtml(k, d.open);
  });
  scrim.querySelectorAll('[data-sum]').forEach(function(el) {
    var s = SETTINGS_SECS[el.dataset.sum];
    if (s) el.innerHTML = s.summary();
  });
}

/* A section of Settings, from inside it or from anywhere else. */
function devSettingsGo(sec) {
  var scrim = document.getElementById('settingsScrim');
  if (!scrim) { openSettings(sec); return; }
  var g = _settingsGroupOf(sec);
  if (g) settingsShowGroup(g);
  var d = scrim.querySelector('details[data-sec="' + sec + '"]');
  if (!d) return;
  d.open = true;
  if (d.scrollIntoView) d.scrollIntoView({ block: 'start' });
}

function devAction(action, btn) {
  switch (action) {
    case 'invDevRegister': devRegisterClick(); return true;
    case 'invDevSave': devSaveDetails(); return true;
    case 'invDevRemove': devRemove(btn.dataset.id); return true;
    case 'invDevGo': devSettingsGo(btn.dataset.sec); return true;
  }
  return false;
}
