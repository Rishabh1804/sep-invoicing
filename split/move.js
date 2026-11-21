/* ===== THE NEW ADDRESS (S0: docs/SERVER.md §9 step 0; docs/atlas/core/new-address.md) =====
   Concatenated before settings.js, whose Data & device group reads moveSecShown() as it loads (the addresses must be set by then).
   The owner, 15 Oct 2026: "I would like to move it to app.somaelectro.co.in", first, before any device registers with the
   server. The old address, rishabh1804.github.io, is an origin every GitHub Pages project of the account shares, and its
   storage with it: this device's GitHub token (which writes to the private codex), the Claude key and the metals.dev key
   sat there beside the sister apps. The app's own address is its own origin.

   A device crosses by a HANDOVER, never by hand, in the browser the app is installed in:
   - On the old address, Settings → Data & device → The new address → Move. The book is pushed to GitHub first (nothing is
     moved unpushed), then the new address opens in a second window, and the two talk by postMessage, each checking the
     other's exact origin and window: the old one posts only to MOVE_NEW_ORIGIN and only after that window said it is ready;
     the new one takes an offer only from MOVE_OLD_ORIGIN and only from the window that opened it.
   - The new address writes everything, reads every piece back, and only then answers; the old one compares the answer with
     what it sent before it says *Moved*. Then, and never before, this device's old address forwards to the new one.
   - Everything is: the book's store whole (the book, its revision, the merge's base), the knowledge base's photos, the
     entries in MOVE_CARRY_LS, and the three keys, each written through its own setter (the GitHub token is locked again
     under the new address's own device key: a key WebCrypto made non-extractable cannot leave). What is not carried, and
     why, is MOVE_NOT_CARRIED; P280 fails on any storage key the app uses that neither list names.
   - The new address starts empty and waits (*Waiting for the book*): the app does not start there, and so writes nothing,
     until the handover lands, or the owner chooses to start empty and pull from GitHub or import a backup.
   - checkin.html stays on the old address: each worker's phone keeps its card there (sep_ck_card), so the office QR made on
     the new address still points at the old one (moveCheckinBase). */

// The two addresses. tests/e2e/server.mjs replaces these three lines, and only these, when P280's header asks: the checks
// below are never loosened for a test. The waits below are shortened the same way, only on a request carrying P281's header.
var MOVE_OLD_ORIGIN = 'https://rishabh1804.github.io';
var MOVE_OLD_PATH = '/sep-invoicing/';
var MOVE_NEW_ORIGIN = 'https://app.somaelectro.co.in';

var MOVE_MARK_OLD = 'sep_inv_moved';     // the old address: {to, at, build}, this device has moved and the page forwards
var MOVE_MARK_NEW = 'sep_inv_move_in';   // the new address: {how: 'handover' | 'own', at}, the book came (or will come) another way
var MOVE_WAIT_READY_MS = 60000;
var MOVE_WAIT_DONE_MS = 180000;
/* The push before the move waits on a Web Lock that another window of the old address may hold (ghPushLocked), with no limit of
   its own: on the first real move (20 Nov 2026) it sat on "Pushing to GitHub". Past this, the move fails and nothing is moved. */
var MOVE_PUSH_MS = 90000;

/* What crosses as an entry, written as it was. Sync and this device; work not yet saved; the print station; the guard's
   own entries on this device (never a PIN: those are the book's); the appearance, Pulse's layout, the folds and the
   conveniences a person set. */
var MOVE_CARRY_LS = [
  'sep_inv_github_sync', 'sep_inv_device_id', 'sep_inv_device_name', 'sep_inv_device_cut',
  'sep_inv_face_page', 'sep_inv_prod_photo_read',
  'sep_inv_print_station', 'sep_inv_print_sent', 'sep_inv_print_log', 'sep_inv_prt_light', 'sep_inv_prt_ack',
  'sep_inv_guard_last', 'sep_inv_guard_fail', 'sep_inv_guard_seen',
  'sep_inv_theme', 'sep_inv_palette', 'sep_inv_density', 'sep_inv_layout', 'sep_inv_home', 'sep_inv_folds',
  'sep_inv_view_prefs', 'sep_inv_settings_ui', 'sep_inv_fin_tab', 'sep_inv_fin_range', 'sep_inv_power_tab', 'sep_inv_prod_tab',
  'sep_inv_stats_tab', 'sep_inv_stats_table', 'sep_inv_kb_tab', 'sep_inv_kb_recent', 'sep_inv_kb_desk', 'sep_inv_planner_view',
  'sep_inv_att_day_as', 'sep_inv_stock_by', 'sep_inv_search_recent', 'sep_inv_report', 'sep_inv_pointers', 'sep_inv_todo_seen',
  'sep_inv_last_export', 'sep_inv_tata_read', 'sep_inv_claude_spent', 'sep_inv_claude_nofallback', 'sep_inv_err_off'
];
// The keys cross in a field of their own and are written through their setters (the token locked again on arrival).
var MOVE_CARRY_KEYS = ['sep_inv_github_token', 'sep_inv_github_token_enc', 'sep_inv_claude_key', 'sep_inv_metals_key'];
var MOVE_NOT_CARRIED = {
  sep_invoicing_state: 'the book kept the old way (localStorage): it crosses as the book',
  sep_invoicing_rev: 'its revision: it crosses with the book',
  sep_inv_idb_used: 'the new address writes its own once the book has landed there',
  sep_inv_err_queue: 'error reports queued at the old address',
  sep_inv_err_kept: 'error messages kept, not sent, at the old address',
  sep_inv_feeds: 'a copy of the news and the weather, fetched again',
  sep_inv_probe: 'a scratch entry of the storage diagnostics',
  sep_inv_gemini_key: 'retired, removed at every start',
  sep_inv_gemini_model: 'retired, removed at every start',
  sep_inv_prod_photo_draft: 'retired, removed at every start',
  sep_inv_moved: 'the old address\'s own mark',
  sep_inv_move_in: 'the new address\'s own mark',
  sep_inv_borrowed: 'a device that loaded the book through an approval (approve.js); the old address never approves, so never lends',
  sep_inv_ap_register: 'the borrowed device registers after the approval\'s reload (sessionStorage)',
  sep_inv_session: 'this tab\'s sign-in (sessionStorage): a sign-in never crosses; sign in again',
  sep_inv_nav_trail: 'this tab\'s trail (sessionStorage)',
  sep_inv_ws_last: 'this tab\'s last views (sessionStorage)'
};
var MOVE_MEDIA_DB = 'sep-invoicing-media';
var MOVE_MEDIA_STORE = 'images';

function moveRole() {
  try {
    if (location.origin === MOVE_NEW_ORIGIN) return 'new';
    if (location.origin === MOVE_OLD_ORIGIN && location.pathname.indexOf(MOVE_OLD_PATH) === 0) return 'old';
  } catch (e) { /* no location: neither */ }
  return '';
}
function moveNewHost() { return MOVE_NEW_ORIGIN.replace(/^https?:\/\//, ''); }
function moveOldHostPath() { return (MOVE_OLD_ORIGIN + MOVE_OLD_PATH).replace(/^https?:\/\//, '').replace(/\/$/, ''); }
function moveSearchKept() {
  var p;
  try { p = new URLSearchParams(location.search); } catch (e) { return ''; }
  p.delete('stay'); p.delete('move');
  var s = p.toString();
  return s ? '?' + s : '';
}
function moveNewUrl(search) { return MOVE_NEW_ORIGIN + '/' + (search || ''); }
function _moveLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function _moveJson(k) { try { var v = JSON.parse(_moveLsGet(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
function moveMarkOld() { return _moveJson(MOVE_MARK_OLD); }
function moveStay() { try { return new URLSearchParams(location.search).get('stay') === '1'; } catch (e) { return false; } }
function moveIsTarget() {
  try { return new URLSearchParams(location.search).get('move') === '1' && !!window.opener; } catch (e) { return false; }
}
/* The move's own marker on the new address (moveOpenNew), with or without the window that opened it. */
function moveMarked() {
  try { return new URLSearchParams(location.search).get('move') === '1'; } catch (e) { return false; }
}
function moveWhen(ts) { return ts ? formatDate(isoOf(new Date(ts))) : ''; }
/* The office QR (checkin.js) points at checkin.html on the old address, wherever it is made: the worker's card is kept there. */
function moveCheckinBase() { return moveRole() === 'new' ? MOVE_OLD_ORIGIN + MOVE_OLD_PATH : location.href; }

function _moveSha(text) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(_moveHex);
}
function _moveHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function(b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
function _moveBlobSha(blob) { return blob.arrayBuffer().then(function(b) { return crypto.subtle.digest('SHA-256', b); }).then(_moveHex); }
function _moveSame(a, b) { return typeof a === 'string' || typeof b === 'string' ? a === b : JSON.stringify(a) === JSON.stringify(b); }
function _moveErr(text) { return new Error(text); }

/* ===== NO INSTALL BEFORE THE BOOK (first use, 20 Nov 2026) =====
   Installed from the new address while it waited for the book, the phone then routed the move's window.open into that installed
   app: a window with no opener, which cannot take the handover. While the new address holds no book, the browser's install offer
   is held back (the screen says why); it is let go once the gate finds a book here. */
var _moveHoldInstall = moveRole() === 'new';
function moveOnInstallOffer(e) { if (_moveHoldInstall && e && typeof e.preventDefault === 'function') e.preventDefault(); }
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('beforeinstallprompt', moveOnInstallOffer);

/* ===== AT THE START (init.js, before the book is read) =====
   Resolves true when the app may start as usual. The old address with this device moved forwards (unless ?stay=1); the new
   address with no book draws Waiting for the book and does not start. */
function moveGate() {
  var role = moveRole();
  if (role === 'old') {
    if (moveMarkOld() && !moveStay()) { moveForward(); return Promise.resolve(false); }
    return Promise.resolve(true);
  }
  if (role !== 'new') return Promise.resolve(true);
  var target = moveIsTarget();
  return moveHoldsBook().then(function(has) {
    if (has) { _moveHoldInstall = false; if (target) _movePostOld({ type: 'sep-move-busy', v: 1 }); return true; }
    moveWaitDraw(target, !target && moveMarked());
    if (target) moveListen();
    return false;
  }, function() { _moveHoldInstall = false; return true; });
}
/* A book is here: one came by the handover or the owner chose another way, the database has held one, or it holds one now. */
function moveHoldsBook() {
  if (_moveLsGet(MOVE_MARK_NEW) || idbHeldBook() || _moveLsGet(STORAGE_KEY) != null) return Promise.resolve(true);
  return idbGetRaw().then(function(raw) { return raw != null; });
}

/* ===== THE SCREENS BEFORE THE START ===== */
function _moveScreen(html) {
  var el = document.getElementById('moveScreen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'moveScreen';
    el.className = 'inv-move-screen';
    document.body.appendChild(el);
  }
  el.innerHTML = '<div class="inv-move-card" data-move-screen>' + html + '</div>';
  return el;
}
function moveForward() {
  var to = moveNewUrl(moveSearchKept());
  _moveScreen('<h1 class="inv-move-title">SEP Invoicing has moved</h1>' +
    '<p class="inv-note">On this device the app opens at its own address now: <span class="inv-id">' + escHtml(moveNewHost()) + '</span>.</p>' +
    '<a class="inv-btn inv-btn-primary" href="' + escHtml(to) + '">Open the new address</a>');
  try { location.replace(to); } catch (e) { /* the link above */ }
}
/* orphan: the move's own window (?move=1) arrived without its opener, so the old address cannot reach it (first use, 20 Nov 2026). */
function moveWaitDraw(target, orphan) {
  var status = target ? 'The old address opened this window. Waiting for it to hand over.' :
    orphan ? 'This window opened without its link back to the old address, so the book cannot come to it. Most often the app is installed from this address and the phone opened it there. Uninstall the app installed from this address (it holds no book), close this window, and press Move again in the old address&rsquo;s tab.' : '';
  _moveScreen('<h1 class="inv-move-title">Waiting for the book</h1>' +
    '<p class="inv-note">This is SEP Invoicing&rsquo;s own address. On this device it holds no book yet, and nothing starts here until the book arrives.</p>' +
    '<div class="inv-callout inv-callout-warning" data-move-noinstall><strong>Do not install the app from here yet.</strong> Move first, from a browser tab in the browser the app is installed in. Install from here after the move.</div>' +
    '<ol class="inv-move-steps inv-note">' +
      '<li>In this browser, open the old address: <span class="inv-id">' + escHtml(moveOldHostPath()) + '</span>.</li>' +
      '<li>Settings &rarr; Data &amp; device &rarr; The new address &rarr; <strong>Move to the new address</strong>.</li>' +
      '<li>It pushes the book to GitHub, opens this address again and hands over the book, the photos and this device&rsquo;s keys.</li></ol>' +
    '<div class="inv-callout' + (orphan ? ' inv-callout-danger' : '') + '" data-move-status aria-live="polite">' + status + '</div>' +
    // A sign-in approved from a device of the owner's, which brings the book from GitHub (approve.js); and, opened to approve one
    // with no book here, why it cannot.
    (typeof grdApWaitNote === 'function' ? grdApWaitNote() : '') + (typeof grdApWaitHtml === 'function' ? grdApWaitHtml() : '') +
    '<details class="inv-move-other"><summary class="inv-btn-link inv-summary">Another way</summary>' +
      '<p class="inv-note inv-mt-8">Where the old address cannot hand over (a device that never had the app, or a copy that is gone): start here with an empty book, then pull from GitHub (Settings &rarr; Connections &rarr; GitHub sync, its token typed again) or import a backup (Settings &rarr; Data &amp; device). The handover is then closed on this device.</p>' +
      '<div class="inv-mt-8" data-move-own><button type="button" class="inv-btn inv-btn-secondary" data-action="invMoveOwn">Start with an empty book</button></div></details>');
}
function moveWaitStatus(text, tone) {
  var el = document.querySelector('[data-move-status]');
  if (!el) return;
  el.className = 'inv-callout' + (tone ? ' inv-callout-' + tone : '');
  el.textContent = text;
}
function moveOwnAsk() {
  var host = document.querySelector('[data-move-own]');
  if (!host) return;
  host.innerHTML = '<p class="inv-note">Start empty? The book then comes from GitHub or a backup, never from the old address.</p>' +
    '<div class="inv-toolbar inv-toolbar-flush inv-toolbar-tight inv-mt-8"><button type="button" class="inv-btn inv-btn-primary" data-action="invMoveOwnYes">Start empty</button></div>';
}
function moveOwnYes() {
  try { localStorage.setItem(MOVE_MARK_NEW, JSON.stringify({ how: 'own', at: Date.now() })); } catch (e) { moveWaitStatus('This browser would not keep the choice: ' + describeStorageError(e), 'danger'); return; }
  location.replace(moveNewUrl(moveSearchKept()));
}

/* ===== THE NEW ADDRESS: RECEIVING ===== */
var _moveInBusy = false;
var _moveRefusedNew = 0;
function _movePostOld(msg) { try { window.opener.postMessage(msg, MOVE_OLD_ORIGIN); } catch (e) { /* the old window is gone */ } }
function _moveOurs(d) { return !!(d && typeof d === 'object' && typeof d.type === 'string' && d.type.indexOf('sep-move-') === 0); }
function moveListen() {
  window.addEventListener('message', moveOnNew);
  _movePostOld({ type: 'sep-move-ready', v: 1 });
}
function moveOnNew(e) {
  // The old address, and only the window that opened this one: anything else is dropped unread.
  if (e.origin !== MOVE_OLD_ORIGIN || !window.opener || e.source !== window.opener) { if (_moveOurs(e.data)) _moveRefusedNew++; return; }
  var d = e.data;
  if (!_moveOurs(d) || d.type !== 'sep-move-offer' || d.v !== 1 || typeof d.nonce !== 'string' || _moveInBusy) return;
  _moveInBusy = true;
  moveWaitStatus('Receiving the book from the old address.');
  moveReceive(d).then(function(r) {
    _movePostOld({ type: 'sep-move-done', v: 1, nonce: d.nonce, ok: true, digest: r.digest, entries: r.entries, images: r.images, ls: r.ls, keys: r.keys });
    moveWaitStatus('The book is here, every piece read back. Opening it.', 'info');
    location.replace(moveNewUrl(moveSearchKept()));
  }, function(err) {
    _moveInBusy = false;
    var why = (err && err.message) || String(err);
    _movePostOld({ type: 'sep-move-done', v: 1, nonce: d.nonce, ok: false, why: why });
    moveWaitStatus('Nothing was kept here: ' + why + '. This address is still empty; the old one keeps everything.', 'danger');
  });
}

/* What an offer may hold: the book's store by its own keys, photos by their ids, the listed entries, three keys. */
function moveOfferCheck(d) {
  var st = d.store;
  if (!st || typeof st !== 'object' || typeof st.current !== 'string') throw _moveErr('the offer holds no book');
  var book;
  try { book = JSON.parse(st.current); } catch (e) { throw _moveErr('the book in the offer does not read'); }
  if (!book || typeof book !== 'object' || Array.isArray(book)) throw _moveErr('the book in the offer is not a book');
  Object.keys(st).forEach(function(k) {
    if (!/^(current|rev|synced|unreadable-\d+)$/.test(k)) throw _moveErr('the offer holds an unknown part of the book (' + k + ')');
  });
  if (!Array.isArray(d.media)) throw _moveErr('the offer holds no list of photos');
  d.media.forEach(function(m) {
    if (!m || typeof m.id !== 'string' || !(m.blob instanceof Blob) || typeof m.sha !== 'string') throw _moveErr('a photo in the offer is not one');
  });
  if (!d.ls || typeof d.ls !== 'object') throw _moveErr('the offer holds no entries');
  Object.keys(d.ls).forEach(function(k) {
    if (MOVE_CARRY_LS.indexOf(k) < 0 || typeof d.ls[k] !== 'string') throw _moveErr('the offer holds an entry the handover does not carry (' + k + ')');
  });
  var keys = d.keys || {};
  ['github', 'claude', 'metals'].forEach(function(k) { if (keys[k] != null && typeof keys[k] !== 'string') throw _moveErr('a key in the offer is not text'); });
  if (typeof d.digest !== 'string') throw _moveErr('the offer carries no digest');
}

function moveReceive(d) {
  var undo = [];   // run in reverse when anything fails: this address is left as empty as it was
  var rollback = function(err) {
    return undo.reverse().reduce(function(p, fn) { return p.then(function() { return fn(); }).then(null, function() {}); }, Promise.resolve())
      .then(function() { throw err; });
  };
  var out = { entries: 0, images: 0, ls: 0, keys: 0, digest: '' };
  return Promise.resolve().then(function() {
    moveOfferCheck(d);
    return moveHoldsBook();
  }).then(function(has) {
    if (has) throw _moveErr('this address already holds a book on this device');
    return _moveMediaWrite(d.media, undo);
  }).then(function(n) {
    out.images = n;
    out.ls = _moveLsWrite(d.ls, undo);
    return _moveKeysWrite(d.keys || {}, undo);
  }).then(function(n) {
    out.keys = n;
    return _moveStoreWrite(d.store, undo);
  }).then(function(r) {
    out.entries = r.entries;
    out.digest = r.digest;
    if (out.digest !== d.digest) throw _moveErr('the book read back here is not the book that was sent');
    idbMarkHeld();
    localStorage.setItem(MOVE_MARK_NEW, JSON.stringify({ how: 'handover', at: Date.now(), build: typeof APP_BUILD !== 'undefined' ? APP_BUILD : '' }));
    return out;
  }).then(null, rollback);
}

function _moveMediaOpen() {
  return new Promise(function(res, rej) {
    if (typeof indexedDB === 'undefined') { rej(_moveErr('this browser has no IndexedDB')); return; }
    var rq = indexedDB.open(MOVE_MEDIA_DB, 1);
    rq.onupgradeneeded = function() { if (!rq.result.objectStoreNames.contains(MOVE_MEDIA_STORE)) rq.result.createObjectStore(MOVE_MEDIA_STORE); };
    rq.onsuccess = function() { res(rq.result); };
    rq.onerror = function() { rej(rq.error || _moveErr('the photos\' database would not open')); };
  });
}
function _moveTx(db, store, mode, fn) {
  return new Promise(function(res, rej) {
    var out = {};
    var tx = db.transaction(store, mode);
    fn(tx.objectStore(store), out);
    tx.oncomplete = function() { res(out); };
    tx.onerror = tx.onabort = function() { rej(tx.error || _moveErr('a write did not complete')); };
  });
}
// Every photo, as kept: [{id, blob, sha}].
function _moveMediaRead() {
  return _moveMediaOpen().then(function(db) {
    return _moveTx(db, MOVE_MEDIA_STORE, 'readonly', function(st, out) {
      out.list = [];
      var c = st.openCursor();
      c.onsuccess = function() { var cur = c.result; if (!cur) return; out.list.push({ id: String(cur.key), blob: cur.value }); cur.continue(); };
    }).then(function(o) {
      db.close();
      var list = o.list.filter(function(m) { return m.blob instanceof Blob; });
      return Promise.all(list.map(function(m) { return _moveBlobSha(m.blob).then(function(s) { m.sha = s; return m; }); }));
    });
  });
}
function _moveMediaWrite(list, undo) {
  if (!list.length) return Promise.resolve(0);
  return _moveMediaOpen().then(function(db) {
    undo.push(function() {
      return _moveMediaOpen().then(function(d2) {
        return _moveTx(d2, MOVE_MEDIA_STORE, 'readwrite', function(st) { list.forEach(function(m) { st.delete(m.id); }); }).then(function() { d2.close(); });
      });
    });
    return _moveTx(db, MOVE_MEDIA_STORE, 'readwrite', function(st) { list.forEach(function(m) { st.put(m.blob, m.id); }); }).then(function() {
      return _moveTx(db, MOVE_MEDIA_STORE, 'readonly', function(st, out) {
        out.back = {};
        list.forEach(function(m) { var r = st.get(m.id); r.onsuccess = function() { out.back[m.id] = r.result; }; });
      });
    }).then(function(o) {
      db.close();
      return Promise.all(list.map(function(m) {
        var b = o.back[m.id];
        if (!(b instanceof Blob)) throw _moveErr('a photo did not read back (' + m.id + ')');
        return _moveBlobSha(b).then(function(s) { if (s !== m.sha) throw _moveErr('a photo read back differently (' + m.id + ')'); });
      })).then(function() { return list.length; });
    });
  });
}
function _moveLsWrite(ls, undo) {
  var n = 0;
  Object.keys(ls).forEach(function(k) {
    var prev = _moveLsGet(k);
    undo.push(function() { try { if (prev == null) localStorage.removeItem(k); else localStorage.setItem(k, prev); } catch (e) { /* left */ } });
    localStorage.setItem(k, ls[k]);
    if (_moveLsGet(k) !== ls[k]) throw _moveErr('an entry did not read back (' + k + ')');
    n++;
  });
  return n;
}
/* Each key through its own setter, then read back: the token is locked under this address's own device key (devices.js). */
function _moveKeysWrite(keys, undo) {
  var n = 0, work = Promise.resolve();
  if (keys.github) {
    undo.push(function() { return devForgetToken(); });
    work = work.then(function() { return setGhToken(keys.github); }).then(function(locked) {
      if (locked) return _devTokenDecrypt(_devLsGet(DEV_TOKEN_ENC_KEY));
      return _devLsGet(GH_TOKEN_KEY);
    }).then(function(back) {
      if (back !== keys.github) throw _moveErr('the GitHub token did not read back');
      n++;
    });
  }
  work = work.then(function() {
    if (keys.claude) {
      undo.push(function() { phKeySet(''); });
      phKeySet(keys.claude);
      if (phKey() !== keys.claude) throw _moveErr('the Claude key did not read back');
      n++;
    }
    if (keys.metals) {
      undo.push(function() { try { localStorage.removeItem(METALS_KEY_KEY); } catch (e) { /* left */ } });
      setMetalsKey(keys.metals);
      if (getMetalsKey() !== keys.metals) throw _moveErr('the metals.dev key did not read back');
      n++;
    }
    return n;
  });
  return work;
}
// The book's store whole, in one transaction, then read back whole.
function _moveStoreWrite(store, undo) {
  var keys = Object.keys(store);
  return idbOpen().then(function(db) {
    if (!db) throw _moveErr('this browser would not open the book\'s database');
    undo.push(function() { return _moveTx(db, IDB_STORE, 'readwrite', function(st) { keys.forEach(function(k) { st.delete(k); }); }); });
    return _moveTx(db, IDB_STORE, 'readwrite', function(st) { keys.forEach(function(k) { st.put(store[k], k); }); }).then(function() {
      return _moveTx(db, IDB_STORE, 'readonly', function(st, out) {
        out.back = {};
        keys.forEach(function(k) { var r = st.get(k); r.onsuccess = function() { out.back[k] = r.result; }; });
      });
    }).then(function(o) {
      keys.forEach(function(k) { if (!_moveSame(o.back[k], store[k])) throw _moveErr('the book did not read back whole (' + k + ')'); });
      return _moveSha(o.back.current).then(function(digest) { return { entries: keys.length, digest: digest }; });
    });
  });
}

/* ===== THE OLD ADDRESS: HANDING OVER ===== */
var _moveSess = null;   // the move under way: {stage, nonce, wipe, win, sent, refused, digest, expect}
var _moveLast = null;   // the last one, as it ended
function moveSecShown() { return moveRole() === 'old'; }
function moveInstalled() { try { return window.matchMedia('(display-mode: standalone)').matches; } catch (e) { return false; } }

/* Why the book cannot be pushed first ('' when it can). */
function moveCannotPush() {
  if (typeof bookStandIn === 'function' && bookStandIn()) return 'this window holds a stand-in, not this device\'s book: ' + bookStandInWords() + '.';
  if (typeof ghIsConfigured !== 'function' || !ghIsConfigured()) return 'GitHub sync is not set up on this device, so the book cannot be pushed first. Set it up and push (Settings → Connections → GitHub sync), or export a backup here and import it at the new address.';
  var held = typeof devSyncBlocked === 'function' ? devSyncBlocked() : '';
  return held ? held + ' The book is moved only once it is pushed.' : '';
}

function moveDialog(title, body, foot, tone) {
  var html = '<div class="inv-dialog" role="dialog" aria-modal="true" data-move-dialog>' + dialogHeadHtml(escHtml(title), 'invCloseConfirm') +
    '<div class="inv-dialog-body"><p class="inv-ask-body' + (tone ? ' inv-callout inv-callout-' + tone : '') + '" data-move-said>' + escHtml(body) + '</p></div>' +
    (foot ? '<div class="inv-dialog-foot">' + foot + '</div>' : '') + '</div>';
  var top = document.querySelectorAll('.inv-scrim-dialog');
  var open = top.length && top[top.length - 1].querySelector('[data-move-dialog]');
  dialogOpen(html, { replace: !!open });
}
function moveFail(why) {
  var s = _moveSess;
  if (s) { clearTimeout(s.timer); s.stage = 'failed'; s.why = why; _moveLast = s; }
  _moveSess = null;
  moveDialog('Nothing was moved', 'Nothing was moved: ' + why + ' This address keeps everything as it was.',
    '<button type="button" class="inv-btn inv-btn-primary" data-action="invCloseConfirm">Close</button>', 'danger');
}

function movePushedDialog() {
  moveDialog('Pushed. Now open the new address', 'The new address opens in a second window. Keep both open until this one says it has moved.',
    '<button type="button" class="inv-btn inv-btn-secondary" data-action="invMoveCancel">Cancel</button>' +
    '<button type="button" class="inv-btn inv-btn-primary" data-action="invMoveOpen">Open the new address</button>');
}
function moveHandingDialog() {
  moveDialog('Handing over', 'The new address is open. Keep both windows open: this one says Moved once the new address has read every piece back.', '');
}
function moveStart() {
  if (moveRole() !== 'old' || moveMarkOld()) return;
  // A move under way whose dialog was shut: shown again where it stands, never started twice.
  if (_moveSess) {
    if (_moveSess.stage === 'pushed') movePushedDialog();
    else if (_moveSess.stage !== 'pushing') moveHandingDialog();
    return;
  }
  if (typeof grdGate === 'function' && !grdGate('users', 'Move this device to the new address', moveStart)) return;
  var why = moveCannotPush();
  if (why) { uiAlert({ title: 'Nothing was moved', body: why }); return; }
  var wipeEl = document.getElementById('moveWipe');
  var s = _moveSess = { stage: 'pushing', nonce: _moveNonce(), wipe: !wipeEl || !!wipeEl.checked, win: null, sent: 0, refused: 0, timer: null };
  moveDialog('Pushing to GitHub', 'The book goes to GitHub first, so a copy is safe whatever happens next.', '');
  // The push waits its turn on a lock another window of this address may hold: past MOVE_PUSH_MS the move fails, and a push that
  // lands after that moves nothing (the stage is no longer 'pushing').
  s.timer = setTimeout(function() {
    if (_moveSess === s && s.stage === 'pushing') moveFail('the push to GitHub did not finish. Another window of the old address may be pushing or busy: close the other windows of the old address, then move again.');
  }, MOVE_PUSH_MS);
  ghPushLocked({}).then(function(ok) {
    if (_moveSess !== s || s.stage !== 'pushing') return;
    clearTimeout(s.timer);
    if (!ok) { moveFail('the book is not pushed to GitHub (' + (_ghStatusText || 'the push did not land') + '). Push it from Settings → Connections → GitHub sync, then move again.'); return; }
    // The push's own quiet save (the device's row) lands before the book is read for the handover.
    return _persistChain.then(function() {
      if (_moveSess !== s || s.stage !== 'pushing') return;
      s.stage = 'pushed';
      movePushedDialog();
    });
  }, function(e) { if (_moveSess === s && s.stage === 'pushing') moveFail('the push failed (' + ((e && e.message) || e) + ').'); });
}
function _moveNonce() { var a = new Uint8Array(16); crypto.getRandomValues(a); return _moveHex(a.buffer); }
function moveCancel() {
  if (_moveSess) { clearTimeout(_moveSess.timer); _moveSess.stage = 'cancelled'; _moveLast = _moveSess; _moveSess = null; }
  closeTopOverlay();
}

// From the button, so the window opens on the tap itself (a pop-up opened after the push's wait would be blocked).
function moveOpenNew() {
  var s = _moveSess;
  if (!s || s.stage !== 'pushed') return;
  var w = null;
  try { w = window.open(moveNewUrl('?move=1'), 'sep-move'); } catch (e) { w = null; }
  if (!w) { moveFail('the browser did not open the new address. Allow pop-ups for this address, then move again.'); return; }
  s.win = w;
  s.stage = 'opened';
  moveHandingDialog();
  s.timer = setTimeout(function() { if (_moveSess === s && s.stage === 'opened') moveFail('the new address did not answer. If the app is installed from the new address on this device, uninstall it (it holds no book): the phone may have opened the new address there instead of in this browser. Otherwise open the new address once in this browser while online. Then move again.'); }, MOVE_WAIT_READY_MS);
}

function moveOnOld(e) {
  var s = _moveSess;
  if (!s || !_moveOurs(e.data)) return;
  // The new address, and only the window this move opened.
  if (!s.win || e.origin !== MOVE_NEW_ORIGIN || e.source !== s.win) { s.refused++; return; }
  var d = e.data;
  if (d.type === 'sep-move-busy' && s.stage === 'opened') moveFail('the new address already holds a book on this device, so nothing was sent to it.');
  else if (d.type === 'sep-move-ready' && s.stage === 'opened') moveSend(s);
  else if (d.type === 'sep-move-done' && s.stage === 'offered' && d.nonce === s.nonce) moveLanded(s, d);
}
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('message', moveOnOld);

/* Everything this device holds that crosses, read from disk. */
function moveGather(s) {
  return Promise.all([_moveStoreRead(), _moveMediaRead()]).then(function(r) {
    var store = r[0], media = r[1];
    if (!store || typeof store.current !== 'string') throw _moveErr('the book could not be read from this device');
    var ls = {};
    MOVE_CARRY_LS.forEach(function(k) { var v = _moveLsGet(k); if (v != null) ls[k] = v; });
    var keys = { github: getGhToken() || '', claude: phKey() || '', metals: getMetalsKey() || '' };
    return _moveSha(store.current).then(function(digest) {
      s.digest = digest;
      s.expect = { entries: Object.keys(store).length, images: media.length, ls: Object.keys(ls).length,
        keys: ['github', 'claude', 'metals'].filter(function(k) { return !!keys[k]; }).length };
      return { type: 'sep-move-offer', v: 1, nonce: s.nonce, build: typeof APP_BUILD !== 'undefined' ? APP_BUILD : '', store: store, media: media, ls: ls, keys: keys, digest: digest };
    });
  });
}
// The book's store whole ({current, rev, synced, …}); the old localStorage way, the book and its revision.
function _moveStoreRead() {
  if (_storeMode === 'localStorage') {
    return Promise.resolve({ current: _moveLsGet(STORAGE_KEY), rev: _moveLsGet(LS_REV_KEY) }).then(function(o) { if (o.rev == null) delete o.rev; return o; });
  }
  return idbOpen().then(function(db) {
    if (!db) return null;
    return _moveTx(db, IDB_STORE, 'readonly', function(st, out) {
      out.all = {};
      var c = st.openCursor();
      c.onsuccess = function() { var cur = c.result; if (!cur) return; out.all[String(cur.key)] = cur.value; cur.continue(); };
    }).then(function(o) { return o.all; });
  });
}
function moveSend(s) {
  clearTimeout(s.timer);
  s.stage = 'gathering';
  moveGather(s).then(function(offer) {
    if (_moveSess !== s) return;
    s.stage = 'offered';
    s.win.postMessage(offer, MOVE_NEW_ORIGIN);
    s.sent++;
    s.timer = setTimeout(function() { if (_moveSess === s && s.stage === 'offered') moveFail('the new address did not say it had the book. Look at its window: it says what it kept.'); }, MOVE_WAIT_DONE_MS);
  }, function(e) { if (_moveSess === s) moveFail('this device could not read what it holds (' + ((e && e.message) || e) + ').'); });
}
function moveLanded(s, d) {
  clearTimeout(s.timer);
  if (!d.ok) { moveFail('the new address could not keep it (' + String(d.why || 'no reason given') + ').'); return; }
  var x = s.expect || {};
  if (d.digest !== s.digest || d.entries !== x.entries || d.images !== x.images || d.ls !== x.ls || d.keys !== x.keys) {
    moveFail('the new address answered with a copy that does not match this one. Do not use the new address on this device yet; ask for help.');
    return;
  }
  // Verified there: from now on this device's old address forwards. A print station stops being one here (its loop reads the mark
  // at every look, remoteprint.js), or this window and the new address would both print each job; Undo gives the mark back.
  var station = typeof prtIsStation === 'function' && prtIsStation();
  try { localStorage.setItem(MOVE_MARK_OLD, JSON.stringify({ to: MOVE_NEW_ORIGIN, at: Date.now(), build: typeof APP_BUILD !== 'undefined' ? APP_BUILD : '', station: station })); }
  catch (e) { moveFail('the new address has everything, but this address would not keep its mark (' + describeStorageError(e) + '). Use the new address; this one does not forward yet.'); return; }
  if (station) prtSetStation(false);
  s.stage = 'moved';
  _moveLast = s;
  _moveSess = null;
  if (typeof ghCancelPending === 'function') ghCancelPending();
  (s.wipe ? moveWipeKeys() : Promise.resolve()).then(function() {
    var to = moveNewUrl('');
    moveDialog('Moved', 'The new address holds the book, ' + todoPlural(x.images, 'photo') + ', ' + todoPlural(x.ls, 'setting') + ' and ' +
      todoPlural(x.keys, 'key') + ', each read back there. From now on this address forwards to it on this device.' +
      (s.wipe ? ' The keys are deleted from this address.' : ' The keys are still kept here as well.'),
      '<a class="inv-btn inv-btn-primary" href="' + escHtml(to) + '">Go to the new address</a>', 'info');
    // This window's copy is left behind: nothing more is done in it.
    _moveScreen('<h1 class="inv-move-title">Moved to the new address</h1>' +
      '<p class="inv-note">This device opens SEP Invoicing at <span class="inv-id">' + escHtml(moveNewHost()) + '</span> now.</p>' +
      '<a class="inv-btn inv-btn-primary" href="' + escHtml(to) + '">Open the new address</a>');
  });
}
/* The keys leave the shared address once the new one has them: the token (its entries and its device key), the Claude key and
   the metals.dev key. The book stays until the owner deletes it (moveDeleteOld). */
function moveWipeKeys() {
  phKeySet('');
  try { localStorage.removeItem(METALS_KEY_KEY); } catch (e) { /* none */ }
  return Promise.resolve(devForgetToken()).then(null, function() {});
}

/* ===== THE COPY LEFT BEHIND (the old address, opened with ?stay=1) ===== */
function moveAfterBoot() {
  if (moveRole() !== 'old') return;
  var m = moveMarkOld();
  if (m) uiNotice('This device moved to the new address on ' + moveWhen(m.at) + '. This is the copy left behind at the old address: what is changed here is not at the new one. Settings → Data & device → The new address.', 'warning');
}
function moveUndo() {
  if (!grdGate('users', 'Undo the move on this device', moveUndo)) return;
  uiConfirm({ title: 'Undo the move on this device?', body: 'This address stops forwarding and opens the copy left here (a print station is one again). Keys deleted at the move are typed again here (Settings → Connections), and a pull from GitHub brings what the new address pushed since. The new address keeps its copy: stop using it on this device.',
    okLabel: 'Undo the move' }).then(function(ok) {
    if (!ok) return;
    var m = moveMarkOld();
    if (m && m.station && typeof prtSetStation === 'function') prtSetStation(true);
    try { localStorage.removeItem(MOVE_MARK_OLD); } catch (e) { /* stays */ }
    location.replace(MOVE_OLD_ORIGIN + MOVE_OLD_PATH);
  });
}
function moveDeleteOld() {
  if (!grdGate('users', 'Delete the copy left at the old address', moveDeleteOld)) return;
  uiConfirm({ title: 'Delete the copy left here?', body: 'The book, its photos, its keys and its settings are deleted from the old address on this device. The new address and GitHub keep theirs. Close every other window of the old address first. The office QR\'s card on this phone is not touched.',
    okLabel: 'Delete the copy', danger: true }).then(function(ok) {
    if (!ok) return;
    if (typeof ghCancelPending === 'function') ghCancelPending();
    var drop = function(name) {
      return new Promise(function(res) { try { var q = indexedDB.deleteDatabase(name); q.onsuccess = q.onerror = q.onblocked = function() { res(); }; } catch (e) { res(); } });
    };
    try { if (_idb) { _idb.close(); _idb = null; } } catch (e) { /* closed */ }
    // Nothing more is saved from this window over what is deleted.
    _storageHealth.readError = 'the copy left at the old address was deleted';
    _storageHealth.readKind = 'gone';
    Promise.resolve(moveWipeKeys()).then(function() {
      // Every entry of this app's on the old address but its forwarding mark. Not another app's, and not checkin.html's (sep_ck_).
      var mine = [];
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^sep_inv(_|oicing_)/.test(k) && k !== MOVE_MARK_OLD) mine.push(k); } } catch (e) { /* none read */ }
      mine.forEach(function(k) { try { localStorage.removeItem(k); } catch (e) { /* left */ } });
      return Promise.all([drop(IDB_NAME), drop(MOVE_MEDIA_DB), drop('sep-invoicing-widget')]);
    }).then(function() { location.replace(MOVE_OLD_ORIGIN + MOVE_OLD_PATH); });
  });
}

/* ===== SETTINGS → DATA & DEVICE → THE NEW ADDRESS (the old address only: settings.js) ===== */
function moveSecSummary() {
  var m = moveMarkOld();
  return m ? 'Moved ' + escHtml(moveWhen(m.at)) : 'Not moved yet';
}
function moveSecBody() {
  var m = moveMarkOld(), host = '<span class="inv-id">' + escHtml(moveNewHost()) + '</span>';
  if (m) {
    return '<p class="inv-note">This device moved to ' + host + ' on ' + escHtml(moveWhen(m.at)) + '. This is the copy left behind here: the old address forwards to the new one unless it is opened with <span class="inv-id">?stay=1</span>.</p>' +
      '<div class="inv-toolbar inv-toolbar-flush inv-toolbar-tight inv-mt-8">' +
      '<a class="inv-btn inv-btn-primary inv-btn-sm" href="' + escHtml(moveNewUrl('')) + '">Open the new address</a>' +
      '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMoveUndo">Undo the move</button>' +
      '<button type="button" class="inv-btn inv-btn-danger inv-btn-sm" data-action="invMoveDeleteOld">Delete the copy left here</button></div>';
  }
  return '<p class="inv-note">SEP Invoicing has its own address, ' + host + ', so this device&rsquo;s keys no longer sit on an address every GitHub Pages project of the account shares.</p>' +
    '<p class="inv-note inv-mt-8"><strong>Move to the new address</strong> pushes the book to GitHub, opens the new address and hands over, in this browser: the book, the knowledge base&rsquo;s photos, register pages not yet saved, this device&rsquo;s registration and GitHub token, the Claude and metals.dev keys, the print station&rsquo;s mark, Pulse&rsquo;s layout, the appearance and the folds. You sign in there again. Nothing changes here until the new address has read every piece back.</p>' +
    (moveInstalled() ? '<div class="inv-callout inv-callout-warning inv-mt-8">This is the installed app&rsquo;s window. Move from a browser tab instead: open the same address in this browser and move there (the book is the same).</div>' : '') +
    '<div class="inv-field inv-mt-8"><label class="inv-field-check" for="moveWipe"><input type="checkbox" id="moveWipe" class="inv-check" checked>' +
      '<span>Delete the keys from this address once the new one has them</span></label>' +
      '<div class="inv-field-hint">The GitHub token, the Claude key and the metals.dev key. The book stays here until you delete it, so you can go back.</div></div>' +
    '<div class="inv-toolbar inv-toolbar-flush inv-toolbar-tight inv-mt-8"><button type="button" class="inv-btn inv-btn-primary inv-btn-sm" data-action="invMoveStart">Move to the new address</button></div>';
}

/* The delegated clicks (events.js). */
function moveAction(action) {
  switch (action) {
    case 'invMoveStart': moveStart(); return true;
    case 'invMoveOpen': moveOpenNew(); return true;
    case 'invMoveCancel': moveCancel(); return true;
    case 'invMoveUndo': moveUndo(); return true;
    case 'invMoveDeleteOld': moveDeleteOld(); return true;
    case 'invMoveOwn': moveOwnAsk(); return true;
    case 'invMoveOwnYes': moveOwnYes(); return true;
  }
  return false;
}
