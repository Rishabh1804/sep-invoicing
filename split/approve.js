/* ===== A SIGN-IN APPROVED FROM A DEVICE OF THE OWNER'S, AND THE BORROWED DEVICE (the owner's sign-in, step 2) =====
   The owner, 21 Nov 2026: he signs in with a passkey on his own devices (guard.js grdPk*, step 1). On any other device the way in
   is a sign-in request approved from a known device of his, where he signs in with that passkey. The approval can also hand
   over the sync token, so a device that never held the book loads it: such a device is BORROWED, and clears itself (the book and
   the keys, after a push) on Sign out and clear this device, and when the app opens there after 12 hours unused. Never on a
   lock. docs/atlas/platform/guard.md.

   The request (device B: the lock with the owner chosen, the re-ask, and the new address's waiting screen when it holds no book):
   a random id (16 bytes), an ephemeral ECDH P-256 key pair whose private half cannot be exported and lives in memory only, and a
   32-byte challenge, shown as a QR of `<origin>/#approve=<base64url of {v, id, k, c, n, b}>` (k: B's public key, raw; n: its
   name; b: it holds no book) and as the link to copy, with a check code of six digits read off the request's SHA-256 that the
   approving device shows too. B asks the relay (/api/relay/<id>, the app's Worker: docs/atlas/core/new-address.md) every 2 s for
   up to 2 minutes, and stops when its view closes.
   The approval (device A, the app opened at that address, its owner signed in where his passkey is offered): his passkey signs
   SHA-256('sep-approve-v1|' + id + '|' + k + '|' + c), A checks its own answer (grdPkVerify), and sends the assertion, and when
   ticked the sync settings and the token, encrypted to B's key: A's own ephemeral ECDH key, the shared secret through HKDF-SHA-256
   (salt c, info 'sep-approve-v1') to an AES-GCM key, a fresh 12-byte IV, the request's id as associated data. The relay carries
   that once and can read none of it.
   Back on B: the answer opened, the assertion checked against the owner the book holds (by id) with the same challenge; on a
   book-less B the token is stored where GitHub sync keeps it, GitHub's copy fetched and the assertion checked against that copy's
   owner BEFORE anything lands; only then the book is written as the handover writes it, the session started and the page loaded
   onto it. Any check that fails signs nobody in, and a token just stored is removed again. The token never reaches the screen,
   a log, the change log or S. Only on a host of the app's own (grdPkHostOk): never github.io, never an IP address. */

var GRD_AP_INFO = 'sep-approve-v1';
var GRD_AP_PREFIX = '#approve=';
var GRD_AP_RELAY = '/api/relay/';
var GRD_AP_POLL_MS = 2000;
var GRD_AP_WAIT_MS = 120000;
var GRD_AP_QR_MAX = 20;                        // a request is about 320 bytes: past a card's version 10 (qr.js)
var GRD_AP_NAME_MAX = 40;
var GRD_AP_REG_KEY = 'sep_inv_ap_register';   // sessionStorage: register the borrowed device after the reload the approval made
var GRD_BW_KEY = 'sep_inv_borrowed';          // localStorage: {at, lastUsed, uid}, this device loaded the book through an approval
var GRD_BW_IDLE_MS = 12 * 3600000;
var GRD_BW_TOUCH_MS = 60000;
// What a cleared device keeps: how it looks, which tells nothing of the book.
var GRD_BW_KEEP = ['sep_inv_theme', 'sep_inv_palette', 'sep_inv_density'];

function grdApUtf8(s) { return new TextEncoder().encode(String(s)); }
function grdApRand(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
function grdApErr(say) { var e = new Error(say); e.say = say; return e; }
function grdApClock(sec) { return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
/* This page can make or answer a request: a secure context on a host of the app's own, with WebCrypto. */
function grdApHere() {
  try { return !!window.isSecureContext && grdCryptoOk() && grdPkHostOk(location.hostname) && typeof fetch === 'function'; } catch (e) { return false; }
}
/* One of the owner's passkeys was made on this device and the device offers it: he signs in with it here, no approval. */
function grdApOwnPk(u) {
  var here = typeof devId === 'function' ? devId() : '';
  return grdPkReady() && grdPkOf(u).some(function(p) { return here && p.dev === here; });
}
/* Approval offered for this user here: the owner, holding a passkey on some device of his, and none made on this one. */
function grdApOffer(u) {
  return grdApHere() && !!u && u.role === 'owner' && u.active !== false && grdPkOf(u).length > 0 && !grdApOwnPk(u);
}
function grdApName() { return String(typeof devName === 'function' ? devName() : 'A device').slice(0, GRD_AP_NAME_MAX); }
/* The check code both devices show: six digits off the SHA-256 of the request as it travels. */
function grdApCode(enc) {
  return crypto.subtle.digest('SHA-256', grdApUtf8(enc)).then(function(h) {
    var b = new Uint8Array(h), n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    var s = String(n % 1000000).padStart(6, '0');
    return s.slice(0, 3) + ' ' + s.slice(3);
  });
}
/* The challenge the passkey signs, bound to this request. */
function grdApChallenge(id, k, c) {
  return crypto.subtle.digest('SHA-256', grdApUtf8(GRD_AP_INFO + '|' + id + '|' + k + '|' + c)).then(function(h) { return new Uint8Array(h); });
}
/* The AES-GCM key two ephemeral ECDH keys share: the secret through HKDF-SHA-256, salt the request's challenge. */
function grdApAes(priv, peerRaw, salt, use) {
  var sub = crypto.subtle;
  return sub.importKey('raw', peerRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []).then(function(pub) {
    return sub.deriveBits({ name: 'ECDH', public: pub }, priv, 256);
  }).then(function(bits) { return sub.importKey('raw', bits, 'HKDF', false, ['deriveKey']); }).then(function(h) {
    return sub.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: grdApUtf8(GRD_AP_INFO) }, h, { name: 'AES-GCM', length: 256 }, false, [use]);
  });
}
function grdApAad(id) { return grdApUtf8(GRD_AP_INFO + '|' + id); }
/* A's answer, sealed to B's key: → the relay's body, {v, k (A's public key), iv, ct}. */
function grdApSeal(p, ans) {
  var sub = crypto.subtle, mine = null, iv = grdApRand(12);
  return sub.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']).then(function(kp) {
    mine = kp;
    return grdApAes(kp.privateKey, grdPkUnB64u(p.k), grdPkUnB64u(p.c), 'encrypt');
  }).then(function(key) {
    return Promise.all([sub.encrypt({ name: 'AES-GCM', iv: iv, additionalData: grdApAad(p.id) }, key, grdApUtf8(JSON.stringify(ans))), sub.exportKey('raw', mine.publicKey)]);
  }).then(function(r) {
    return JSON.stringify({ v: 1, k: grdPkB64u(new Uint8Array(r[1])), iv: grdPkB64u(iv), ct: grdPkB64u(new Uint8Array(r[0])) });
  });
}
/* B opens the answer with the private key it kept in memory. Rejects with a sentence to say. */
function grdApUnseal(req, text) {
  return Promise.resolve().then(function() {
    var o = JSON.parse(text);
    if (!o || o.v !== 1 || typeof o.k !== 'string' || typeof o.iv !== 'string' || typeof o.ct !== 'string') throw new Error('shape');
    return grdApAes(req.priv, grdPkUnB64u(o.k), grdPkUnB64u(req.c), 'decrypt').then(function(key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: grdPkUnB64u(o.iv), additionalData: grdApAad(req.id) }, key, grdPkUnB64u(o.ct));
    });
  }).then(function(buf) {
    var ans = JSON.parse(new TextDecoder().decode(buf));
    var a = ans && ans.a;
    if (!ans || ans.v !== 1 || typeof ans.uid !== 'string' || !a || ['id', 'clientDataJSON', 'authenticatorData', 'signature'].some(function(k) { return typeof a[k] !== 'string'; })) throw new Error('shape');
    return ans;
  }).then(null, function() {
    throw grdApErr('The answer did not open: it was not made for this request, or it was changed on the way. Nothing was signed in.');
  });
}
/* The assertion as grdPkVerify reads it. */
function grdApAssertion(a) {
  return { id: a.id, clientDataJSON: grdPkUnB64u(a.clientDataJSON), authenticatorData: grdPkUnB64u(a.authenticatorData), signature: grdPkUnB64u(a.signature) };
}

/* ---------- B: the request ---------- */
var _grdApReq = null;   // {where: 'lock' | 'ask' | 'wait', uid, id, k, c, url, code, priv, until, state, said, timer}
function grdApStop() {
  if (_grdApReq) clearTimeout(_grdApReq.timer);
  _grdApReq = null;
}
/* The view the request sits in, drawn again: the lock, the re-ask dialog, or the waiting screen. */
function grdApFrame(where) {
  if (where === 'lock') { if (_grdLocked) grdRenderLock(); }
  else if (where === 'ask') grdAskDraw();
  else if (where === 'wait') grdApWaitRedraw();
}
function grdApStart(where, uid) {
  grdApStop();
  if (!grdApHere()) return Promise.resolve(null);
  var req = { where: where, uid: uid || null, state: 'make', said: '', timer: null };
  _grdApReq = req;
  grdApFrame(where);
  var sub = crypto.subtle, enc = '';
  return Promise.resolve().then(function() {
    return sub.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  }).then(function(kp) {
    req.priv = kp.privateKey;
    return sub.exportKey('raw', kp.publicKey);
  }).then(function(raw) {
    req.id = grdPkB64u(grdApRand(16));
    req.k = grdPkB64u(new Uint8Array(raw));
    req.c = grdPkB64u(grdApRand(32));
    enc = grdPkB64u(grdApUtf8(JSON.stringify({ v: 1, id: req.id, k: req.k, c: req.c, n: grdApName(), b: where === 'wait' })));
    req.url = location.origin + '/' + GRD_AP_PREFIX + enc;
    return grdApCode(enc);
  }).then(function(code) {
    if (_grdApReq !== req) return null;
    req.code = code;
    req.until = Date.now() + GRD_AP_WAIT_MS;
    req.state = 'wait';
    grdApDraw();
    grdApPollSoon(req);
    return req;
  }, function() {
    if (_grdApReq === req) { req.state = 'fail'; req.said = 'This browser could not make a request here.'; grdApDraw(); }
    return null;
  });
}
function grdApHostHtml() { return '<div class="inv-ap-req" data-grd-ap-host>' + grdApReqHtml(_grdApReq) + '</div>'; }
function grdApReqHtml(req) {
  if (!req) return '';
  var cancel = '<button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invGuardApCancel">Cancel</button>';
  if (req.state === 'make') return '<p class="inv-note" data-grd-ap-state="make" role="status">Making a request&hellip;</p>';
  if (req.state === 'wait') {
    return '<p class="inv-note" data-grd-ap-state="wait">On your phone or laptop, where you sign in with your passkey: open this code with the camera, or open the link there, and approve.</p>' +
      '<div class="inv-ap-qr" data-grd-ap-qr>' + qrSvg(req.url, 'Sign-in request', GRD_AP_QR_MAX) + '</div>' +
      '<div class="inv-field"><span class="inv-field-label">Check code</span><div class="inv-guard-code" data-grd-ap-code>' + escHtml(req.code) + '</div>' +
      '<div class="inv-field-hint">The other device shows the same code. Approve there only if it does.</div></div>' +
      '<div class="inv-field"><label class="inv-field-label" for="grdApLink">The link</label><input class="inv-input inv-id" id="grdApLink" readonly value="' + escHtml(req.url) + '" data-grd-ap-link></div>' +
      '<div class="inv-toolbar inv-toolbar-flush inv-toolbar-tight"><button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invGuardApCopy">' + iconSvg('copy') + 'Copy the link</button>' + cancel + '</div>' +
      '<p class="inv-guard-line" data-grd-ap-left>' + grdApLeftText(req) + '</p>';
  }
  if (req.state === 'check') return '<p class="inv-note" data-grd-ap-state="check" role="status">' + escHtml(req.said || 'Approved there. Checking it here…') + '</p>';
  var over = req.state === 'over';
  return '<div class="inv-callout inv-callout-' + (over ? 'warning' : 'danger') + '" data-grd-ap-state="' + req.state + '" role="alert">' +
    escHtml(req.said || (over ? 'The request ran out before it was approved.' : 'The approval did not go through. Nothing was signed in.')) + '</div>' +
    '<div class="inv-toolbar inv-toolbar-flush inv-toolbar-tight"><button type="button" class="inv-btn inv-btn-primary inv-btn-sm" data-action="invGuardApAgain">Make a new request</button>' + cancel + '</div>';
}
function grdApLeftText(req) { return 'Waiting for the approval · runs out in ' + grdApClock(Math.max(0, Math.ceil((req.until - Date.now()) / 1000))); }
function grdApDraw() {
  var req = _grdApReq;
  document.querySelectorAll('[data-grd-ap-host]').forEach(function(h) { h.innerHTML = grdApReqHtml(req); });
}
function grdApLive(req) { return _grdApReq === req && !!document.querySelector('[data-grd-ap-host]'); }
function grdApPollSoon(req) { clearTimeout(req.timer); req.timer = setTimeout(function() { grdApPoll(req); }, GRD_AP_POLL_MS); }
/* Every 2 s while the view is open: 200 carries the answer (read once), 204 nothing yet, 410 the answer ran out unread. */
function grdApPoll(req) {
  if (!grdApLive(req)) { if (_grdApReq === req) grdApStop(); return; }
  if (req.state !== 'wait') return;
  if (Date.now() >= req.until) { grdApOver(req); return; }
  var again = function() {
    if (_grdApReq !== req || req.state !== 'wait') return;
    var left = document.querySelector('[data-grd-ap-left]');
    if (left) left.textContent = grdApLeftText(req);
    grdApPollSoon(req);
  };
  fetch(location.origin + GRD_AP_RELAY + req.id, { cache: 'no-store', credentials: 'omit' }).then(function(res) {
    if (_grdApReq !== req || req.state !== 'wait') return null;
    if (res.status === 200) return res.text().then(function(t) { return grdApGot(req, t); });
    if (res.status === 410) { grdApOver(req); return null; }
    again();
    return null;
  }, again);
}
function grdApOver(req) {
  clearTimeout(req.timer);
  req.state = 'over';
  req.said = 'The request ran out before it was approved. Make a new one, and approve it within two minutes.';
  grdApDraw();
}
function grdApFail(req, e) {
  if (_grdApReq !== req) return;
  req.state = 'fail';
  req.said = (e && e.say) || 'The approval did not check. Nothing was signed in.';
  grdApDraw();
}
function grdApGot(req, text) {
  req.state = 'check';
  req.said = '';
  grdApDraw();
  return grdApUnseal(req, text).then(function(ans) { return grdApUse(req, ans); }).then(null, function(e) { grdApFail(req, e); });
}
/* The answer opened: checked against the user it names, then the way in the view was for. */
function grdApUse(req, ans) {
  var a = grdApAssertion(ans.a);
  return grdApChallenge(req.id, req.k, req.c).then(function(chal) {
    if (req.where === 'wait') return grdApLoadBook(req, ans, a, chal);
    var ask = req.where === 'ask' ? _grdAsk : null;
    var u = ask ? ask.user : grdUserById(req.uid);
    if (!u || ans.uid !== u.id || u.role !== 'owner' || u.active === false) throw grdApErr('The approval was for another ID. Nothing was signed in.');
    return grdPkVerify(u, a, chal).then(function(ok) {
      if (!ok) { grdFailNote(u.id); throw grdApErr('The approval did not check. Nothing was signed in.'); }
      if (_grdApReq !== req) return;
      grdFailClear(u.id);
      grdApStop();
      if (ask) { if (!ask.done) ask.finish(true); return; }
      // Still on the lock, and the ID still the one chosen there: the path a right PIN takes.
      var now = grdUserById(u.id);
      if (_grdLocked && now && now.active !== false) grdSignIn(now);
    });
  });
}
/* A book-less B: the token and the settings stored as GitHub sync keeps them, GitHub's copy read, the approval checked against
   that copy's owner; only then the book lands (as the handover lands one), the session starts, and the page loads onto it. */
async function grdApLoadBook(req, ans, a, chal) {
  var s = ans.sync;
  if (!s || typeof s !== 'object' || typeof ans.token !== 'string' || !ans.token || !s.owner || !s.repo) {
    throw grdApErr('The approval came without the sync token, so the book cannot load here. On the other device, leave “Let it load the book” ticked.');
  }
  setGhConfig({ owner: String(s.owner), repo: String(s.repo), branch: String(s.branch || 'main'), path: String(s.path || 'sep-invoicing-data.json'),
    autoPush: !!s.autoPush, deviceId: devId(), deviceName: devName() });
  await setGhToken(ans.token);
  ans.token = '';
  var undo = async function(say) {
    await devForgetToken();
    try { localStorage.removeItem(GH_SYNC_KEY); } catch (e) { /* nothing kept */ }
    throw grdApErr(say);
  };
  req.said = 'Approved there. Loading the book from GitHub…';
  grdApDraw();
  var remote = null;
  try { remote = await ghGetRemote(getGhConfig()); }
  catch (e) { return undo('GitHub did not give the book (' + e.message + '). Nothing was signed in.'); }
  var env = remote && remote.envelope;
  if (!env || env.app !== 'sep-invoicing' || !env.state || !env.state.company || !env.state.clients) return undo('GitHub holds no book of the app at that place. Nothing was signed in.');
  if (env.schema > GH_SCHEMA) return undo('GitHub’s copy was written by a newer version of the app: reload this page, then make a new request.');
  var u = (Array.isArray(env.state.users) ? env.state.users : []).find(function(x) { return x && x.id === ans.uid; });
  if (!u || u.role !== 'owner' || u.active === false || !u.secret) return undo('The approval is not the owner’s of that book. Nothing was signed in.');
  if (!(await grdPkVerify(u, a, chal))) return undo('The approval did not check against the book. Nothing was signed in.');
  if (_grdApReq !== req) return undo('The request was closed. Nothing was signed in.');
  var str = JSON.stringify(env.state);
  try {
    await idbPutRaw(str);
    if ((await idbGetRaw()) !== str) throw new Error('read back');
  } catch (e) { return undo('This browser did not keep the book (' + describeStorageError(e) + '). Nothing was signed in.'); }
  await mrgBasePut(str, remote.sha);
  ghRecord(getGhConfig(), { sha: remote.sha, lastPullAt: Date.now() });
  idbMarkHeld();
  var now = Date.now();
  try {
    if (typeof MOVE_MARK_NEW !== 'undefined') localStorage.setItem(MOVE_MARK_NEW, JSON.stringify({ how: 'approve', at: now }));
    grdBwMark(u.id);
    localStorage.setItem(GRD_LAST_KEY, u.id);
    sessionStorage.setItem(GRD_AP_REG_KEY, '1');
  } catch (e) { /* the session below still signs in */ }
  grdSeenNote(u.id);
  grdSessWrite({ userId: u.id, at: now, askAt: now, hiddenAt: null });
  grdApStop();
  req.state = 'check';
  req.said = 'Signed in. Opening the book…';
  location.replace(location.origin + '/');
}

/* ---------- B: where the request is offered ---------- */
/* The lock and the re-ask: a link under the passkey or the PIN. */
function grdApLinkHtml(u) {
  if (!grdApOffer(u)) return '';
  return '<p class="inv-guard-forgot"><button type="button" class="inv-btn inv-btn-link inv-btn-sm" data-action="invGuardApStart">' + iconSvg('phone') + 'Approve from my phone or laptop</button></p>';
}
/* The lock's body while a request is under way for this ID ('' when none). */
function grdApLockOn(u) { return !!(_grdApReq && _grdApReq.where === 'lock' && u && _grdApReq.uid === u.id); }
/* The new address with no book (move.js moveWaitDraw): a way in of its own. */
function grdApWaitHtml() {
  if (!grdApHere()) return '';
  return '<div class="inv-ap-wait" data-grd-ap-wait>' + grdApWaitInner() + '</div>';
}
function grdApWaitInner() {
  if (_grdApReq && _grdApReq.where === 'wait') return '<h2 class="inv-ap-head">Sign in from a device of mine</h2>' + grdApHostHtml();
  return '<h2 class="inv-ap-head">Or sign in from a device of mine</h2>' +
    '<p class="inv-note">On a device that never had the app (a laptop you borrow, say): approve the sign-in from your phone or laptop with its passkey, and the book loads here from GitHub. ' +
    'This device is then borrowed: it clears itself when you sign out and clear it, and when it is opened after 12 hours unused.</p>' +
    '<div><button type="button" class="inv-btn inv-btn-secondary" data-action="invGuardApWait">' + iconSvg('phone') + 'Sign in from a device of mine</button></div>';
}
function grdApWaitRedraw() { var el = document.querySelector('[data-grd-ap-wait]'); if (el) el.innerHTML = grdApWaitInner(); }
/* A device opened at an approval's address with no book here cannot approve: the waiting screen says so. */
function grdApWaitNote() {
  if (!_grdApIn) return '';
  return '<div class="inv-callout inv-callout-warning" data-grd-ap-cannot>This device holds no book here, so it cannot approve the sign-in it was opened for. Open the link on your phone or laptop, where the book is and you sign in with your passkey.</div>';
}

/* ---------- A: the approval ---------- */
/* The request this page was opened with (#approve=…), taken off the address at once. {p, enc} or {bad: true}; null if none. */
function grdApTake() {
  var h = '';
  try { h = String(location.hash || ''); } catch (e) { return null; }
  if (h.indexOf(GRD_AP_PREFIX) !== 0) return null;
  try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* the address keeps it */ }
  return grdApParse(h.slice(GRD_AP_PREFIX.length));
}
function grdApParse(enc) {
  var p = null;
  try {
    if (!/^[A-Za-z0-9_-]{40,1200}$/.test(enc)) throw new Error('shape');
    p = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(grdPkUnB64u(enc)));
    if (!p || p.v !== 1 || !/^[A-Za-z0-9_-]{22,43}$/.test(p.id) || typeof p.k !== 'string' || typeof p.c !== 'string' || typeof p.b !== 'boolean') throw new Error('shape');
    var k = grdPkUnB64u(p.k), c = grdPkUnB64u(p.c);
    if (k.length !== 65 || k[0] !== 4 || c.length !== 32) throw new Error('shape');
    p.n = String(p.n == null ? '' : p.n).slice(0, GRD_AP_NAME_MAX) || 'a device';
  } catch (e) { return { bad: true }; }
  return { p: p, enc: enc };
}
var _grdApIn = null;     // a request this page was opened with, until it is shown
var _grdApGive = null;   // the approval on show: {it, user, code, busy}
function grdApBoot() {
  var it = _grdApIn;
  if (!it) return;
  _grdApIn = null;
  if (grdWhenIn(function() { grdApAsk(it); })) grdApAsk(it);
}
async function grdApAsk(it) {
  var no = function(title, body) { return uiAlert({ title: title, body: body, tone: 'warning' }); };
  if (!it || it.bad) return no('Not a sign-in request', 'This link is not a sign-in request of the app, or it was cut short. Make a new request on the other device.');
  if (!grdApHere()) return no('Cannot approve here', 'A sign-in is approved only at the app’s own address, with your passkey. Open the link in the app on your phone or laptop.');
  if (!grdOn()) return no('Cannot approve here', 'The guard is off on this device, so no owner signs in here to approve a sign-in.');
  var u = grdUser();
  if (!u || u.role !== 'owner') return no('Only the owner approves', 'A sign-in as the owner is approved by the owner. Sign in here as the owner, then open the link again.');
  await grdPkProbe();
  if (!grdPkOffer(u)) return no('No passkey here', 'This device offers no passkey of yours here. Approve from the phone or laptop where you added one (Settings → Access → Users & access).');
  var code = await grdApCode(it.enc), can = it.p.b && ghIsConfigured();
  _grdApGive = { it: it, user: u, code: code, busy: false };
  var book = !it.p.b ? '' : '<div class="inv-field"><label class="inv-field-check" for="grdApBook"><input type="checkbox" id="grdApBook" class="inv-check"' + (can ? ' checked' : ' disabled') + '>' +
    '<span>Let it load the book (gives it the sync token)</span></label><div class="inv-field-hint">' + (can
      ? 'It holds no book. With this it loads the book from GitHub and becomes a borrowed device: it clears itself when you sign out and clear it there, and when it is opened after 12 hours unused.'
      : 'GitHub sync is not set up on this device, so it has no token to give: the other device cannot load the book from here.') + '</div></div>';
  var scrim = dialogOpen('<div class="inv-dialog" role="dialog" aria-modal="true" aria-labelledby="grdApT" data-grd-ap-give data-nodirty>' +
    dialogHeadHtml('<span id="grdApT">Approve a sign-in</span>', 'invGuardApNo', 'Cancel') + '<div data-grd-ap-body>' +
    '<p class="inv-mb-8" data-grd-ap-ask>Sign in as <strong>' + escHtml(u.name) + '</strong> on <strong>' + escHtml(it.p.n) + '</strong>?</p>' +
    '<div class="inv-field"><span class="inv-field-label">Check code</span><div class="inv-guard-code" data-grd-ap-code>' + escHtml(code) + '</div>' +
    '<div class="inv-field-hint">Approve only if the other device shows the same code.</div></div>' + book +
    '<div class="inv-field-error" data-grd-err' + grdUidAttr(u.id) + ' role="alert"></div>' +
    '<div class="inv-dialog-foot"><button type="button" class="inv-btn inv-btn-secondary" data-action="invGuardApNo">Cancel</button>' +
    '<button type="button" class="inv-btn inv-btn-primary" data-action="invGuardApOk" data-grd-go>' + iconSvg('fingerprint') + 'Approve</button></div></div></div>');
  var mine = _grdApGive;
  if (scrim) new MutationObserver(function(m, obs) { if (!scrim.isConnected) { obs.disconnect(); if (_grdApGive === mine) _grdApGive = null; } }).observe(document.body, { childList: true });
}
/* Approve: the owner's passkey signs the request's challenge here, the answer is checked here first, sealed to B's key and put
   on the relay. The token is read only into the sealed answer. */
async function grdApGiveGo() {
  var g = _grdApGive, box = document.querySelector('[data-grd-ap-give]');
  if (!g || g.busy || !box) return;
  var err = box.querySelector('[data-grd-err]'), go = box.querySelector('[data-grd-go]'), u = grdUser();
  if (!u || u.id !== g.user.id) { err.textContent = 'You are no longer signed in as the owner here. Nothing was sent.'; return; }
  if (grdFailLeftMs(u.id) > 0) { grdShowFail(err, go, null, u.id); return; }
  var tick = box.querySelector('#grdApBook'), give = !!(g.it.p.b && tick && tick.checked && !tick.disabled);
  g.busy = true;
  go.disabled = true;
  err.textContent = '';
  var out = {}, p = g.it.p;
  var r = await grdPkGet(u, await grdApChallenge(p.id, p.k, p.c), out);
  if (_grdApGive !== g) return;
  if (r !== 'ok' || !out.a) {
    g.busy = false;
    go.disabled = false;
    if (r === 'fail') grdFailNote(u.id);
    err.textContent = r === 'cancel' ? 'The passkey was cancelled. Nothing was sent.' : r === 'fail' ? 'The passkey did not check. Nothing was sent.' : 'This device could not use a passkey here. Nothing was sent.';
    return;
  }
  grdFailClear(u.id);
  var a = out.a, said;
  var ans = { v: 1, uid: u.id, a: { id: a.id, clientDataJSON: grdPkB64u(a.clientDataJSON), authenticatorData: grdPkB64u(a.authenticatorData), signature: grdPkB64u(a.signature) } };
  if (give) {
    var c = getGhConfig();
    ans.sync = { owner: c.owner, repo: c.repo, branch: c.branch, path: c.path, autoPush: !!c.autoPush };
    ans.token = getGhToken();
  }
  try {
    var body = await grdApSeal(p, ans);
    ans = null;
    var res = await fetch(location.origin + GRD_AP_RELAY + p.id, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: body, cache: 'no-store', credentials: 'omit' });
    said = res.ok ? 'ok' : res.status === 409 ? 'taken' : 'status ' + res.status;
  } catch (e) { ans = null; said = 'no connection'; }
  if (_grdApGive !== g) return;
  var host = box.querySelector('[data-grd-ap-body]');
  var foot = '<div class="inv-dialog-foot"><button type="button" class="inv-btn inv-btn-primary" data-action="invGuardApNo">Done</button></div>';
  if (said === 'ok') host.innerHTML = '<div class="inv-callout inv-callout-success" data-grd-ap-sent role="status">Approved. ' + escHtml(p.n) + ' signs in now' + (give ? ' and loads the book' : '') + '.</div>' + foot;
  else if (said === 'taken') host.innerHTML = '<div class="inv-callout inv-callout-danger" data-grd-ap-sent="taken" role="alert">This request was already answered, from somewhere else. If the other device does not sign in now, do not use it: make a new request there.</div>' + foot;
  else host.innerHTML = '<div class="inv-callout inv-callout-danger" data-grd-ap-sent="failed" role="alert">The approval did not reach the other device (' + escHtml(said) + '). Make a new request there and approve it again.</div>' + foot;
  _grdApGive = null;
}

/* ---------- The borrowed device ---------- */
var _grdBwHeld = false;   // opened after 12 h unused: locked until an approval, clearing itself once its work is pushed
var _grdBwBusy = false;
var _grdBwSaid = '';
function grdBwRead() {
  try { var m = JSON.parse(localStorage.getItem(GRD_BW_KEY) || 'null'); return m && typeof m === 'object' && m.at ? m : null; } catch (e) { return null; }
}
function grdBwOn() { return !!grdBwRead(); }
function grdBwMark(uid) { var now = Date.now(); localStorage.setItem(GRD_BW_KEY, JSON.stringify({ at: now, lastUsed: now, uid: uid })); }
function grdBwTouch(force) {
  var m = grdBwRead(), now = Date.now();
  if (!m || (!force && now - (+m.lastUsed || 0) < GRD_BW_TOUCH_MS)) return;
  m.lastUsed = now;
  try { localStorage.setItem(GRD_BW_KEY, JSON.stringify(m)); } catch (e) { /* the next touch tries again */ }
}
function grdBwStale(m) { m = m || grdBwRead(); return !!m && Date.now() - (+m.lastUsed || +m.at || 0) >= GRD_BW_IDLE_MS; }
function grdBwHeldNow() { return _grdBwHeld && grdBwOn(); }
/* The owner the approval signed in. */
function grdBwOwner() {
  var m = grdBwRead(), u = m && m.uid ? grdUserById(m.uid) : null;
  if (!u || u.role !== 'owner' || u.active === false) u = grdActiveUsers().find(function(x) { return x.role === 'owner'; }) || null;
  return u;
}
/* At the start (init.js bootApp, after the lock): 12 h unused holds it locked and clears it once pushed; else this is a use. */
function grdBwBoot() {
  var m = grdBwRead();
  if (!m) return;
  if (grdBwStale(m)) { grdBwHold(); return; }
  grdBwTouch(true);
  var reg = null;
  try { reg = sessionStorage.getItem(GRD_AP_REG_KEY); sessionStorage.removeItem(GRD_AP_REG_KEY); } catch (e) { reg = null; }
  if (reg) setTimeout(grdApRegister, 0);
}
/* The device the approval brought the book to registers at once (devices.js): only a registered device pushes, and a borrowed one
   must push before it clears. The owner's approval is the check, through the same gate (the owner signed in, inside the re-ask
   window the approval opened). */
function grdApRegister() {
  if (typeof devRegister !== 'function' || !grdOn() || !grdBwOn() || devRow()) return;
  var u = grdUser();
  if (!u || u.role !== 'owner') return;
  devRegister({ name: (devName() + ' (borrowed)').slice(0, 60), user: u.id });
}
function grdBwHold() {
  _grdBwHeld = true;
  _grdBwSaid = '';
  if (grdOn()) grdLock('borrowed');
  grdBwAutoClear();
}
function grdBwAutoClear() {
  if (!grdBwHeldNow() || _grdBwBusy) return;
  grdBwSay('Pushing its work to GitHub…');
  grdBwPushClear().then(function(r) { if (r !== true) grdBwSay('Not cleared yet: ' + r + ' It clears itself once its work reaches GitHub.'); });
}
function grdBwSay(text) {
  _grdBwSaid = text;
  var el = document.querySelector('#guardRoot [data-grd-bw-state]');
  if (el) el.textContent = text;
}
/* The push first (the existing push); only once it lands, the clear. → Promise<true | why not, in words>. */
function grdBwPushClear() {
  if (_grdBwBusy) return Promise.resolve('a push is already under way.');
  var why = (typeof devSyncBlocked === 'function' && devSyncBlocked()) || (!ghIsConfigured() ? 'GitHub sync is not set up on this device.' : '');
  if (why) return Promise.resolve(why);
  _grdBwBusy = true;
  if (typeof ghCancelPending === 'function') ghCancelPending();
  return Promise.resolve(ghPushLocked({ silent: true })).then(function(ok) {
    if (!ok) { _grdBwBusy = false; return _ghStatusText || 'the push did not go through.'; }
    return grdBwWipe().then(function() { return true; });
  }, function(e) { _grdBwBusy = false; return (e && e.message) || 'the push did not go through.'; });
}
/* Sign out and clear this device: asked, pushed, then cleared; a push that fails clears nothing and says why. */
function grdBwClear() {
  if (_grdBwBusy || !grdBwOn()) return;
  uiConfirm({ title: 'Sign out and clear this device?', body: 'The book goes to GitHub first. Once it is there, the book, its photos, this device’s keys and its settings are deleted from this device, and you are signed out. ' +
    'Reports already downloaded stay: they are files. If the push does not go through, nothing is cleared.', okLabel: 'Push, then clear', danger: true }).then(function(ok) {
    if (!ok) return;
    showToast('Pushing to GitHub before clearing…', 'info');
    grdBwPushClear().then(function(r) {
      if (r === true) return;
      uiAlert({ title: 'Nothing was cleared', body: 'The book did not reach GitHub first: ' + r + '\n\nNothing is cleared while work here is not on GitHub. Try again once it can reach GitHub.', tone: 'warning' });
    });
  });
}
/* The clear: the book's databases, the photos, the device key, the widget's copy, and every entry of this app's on this origin
   but how it looks (GRD_BW_KEEP); the session ended; then the start again, which finds no book (the new address's waiting
   screen). Other windows of the app on this device are told, and go the same way. */
function grdBwWipe() {
  if (typeof ghCancelPending === 'function') ghCancelPending();
  // Nothing more is saved from this window over what is deleted (persistState writes nothing over a stand-in).
  _storageHealth.readError = 'this device was cleared';
  _storageHealth.readKind = 'gone';
  var ch = grdChannel();
  if (ch) { try { ch.postMessage({ type: 'cleared' }); } catch (e) { /* this window still clears */ } }
  grdSessClear();
  var drop = function(name) {
    return new Promise(function(res) { try { var q = indexedDB.deleteDatabase(name); q.onsuccess = q.onerror = q.onblocked = function() { res(); }; } catch (e) { res(); } });
  };
  return Promise.resolve(typeof devForgetToken === 'function' ? devForgetToken() : null).then(null, function() { return null; }).then(function() {
    try { if (_idb) { _idb.close(); _idb = null; } } catch (e) { /* closed */ }
    return Promise.all([drop(IDB_NAME), drop('sep-invoicing-media'), drop(DEV_KEYS_DB), drop('sep-invoicing-widget')]);
  }).then(function() {
    var gone = [], ss = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^sep_inv(_|oicing_)/.test(k) && GRD_BW_KEEP.indexOf(k) < 0) gone.push(k); } } catch (e) { /* none read */ }
    gone.forEach(function(k) { try { localStorage.removeItem(k); } catch (e) { /* left */ } });
    try { for (var j = 0; j < sessionStorage.length; j++) { var s = sessionStorage.key(j); if (/^sep_inv/.test(s)) ss.push(s); } } catch (e) { /* none read */ }
    ss.forEach(function(k) { try { sessionStorage.removeItem(k); } catch (e) { /* left */ } });
    location.replace(location.origin + '/');
  });
}
/* Another window of this device cleared it: this one saves nothing more and starts again. */
function grdBwClearedElsewhere() {
  _storageHealth.readError = 'this device was cleared';
  _storageHealth.readKind = 'gone';
  grdSessClear();
  location.replace(location.origin + '/');
}
/* Signed in (guard.js grdSignIn): a held device is open again, and this is a use. */
function grdBwSignedIn() {
  _grdBwHeld = false;
  _grdBwSaid = '';
  if (grdBwOn()) grdBwTouch(true);
}
/* The lock while held: the owner, why, the push's state, and the approval (the only way in). */
function grdBwHeldHtml(u) {
  return '<div class="inv-callout inv-callout-warning" data-grd-bw-held>This device was lent, and has not been used for 12 hours. It opens again only with an approval from your phone or laptop, and clears itself once its work is on GitHub.</div>' +
    '<p class="inv-guard-line inv-mt-8" data-grd-bw-state aria-live="polite">' + escHtml(_grdBwSaid) + '</p>' +
    (grdApLockOn(u) ? grdApHostHtml() : u && grdApHere()
      ? '<button type="button" class="inv-btn inv-btn-primary inv-btn-block inv-mt-8" data-action="invGuardApStart">' + iconSvg('phone') + 'Approve from my phone or laptop</button>' : '');
}
/* Settings → Data & device, on a borrowed device only. */
function grdBwSecHtml() {
  var m = grdBwRead();
  if (!m) return '';
  return '<div class="inv-callout inv-callout-warning inv-mb-8" data-grd-bw-sec>This device is borrowed: the book came to it with an approval from a device of the owner’s, ' + escHtml(grdWhen(m.at)) +
    '. It clears itself when it is opened after 12 hours unused, once its work is on GitHub; a lock never clears it.</div>' +
    '<div class="inv-toolbar inv-toolbar-flush inv-mb-8"><button type="button" class="inv-btn inv-btn-danger inv-btn-sm" data-action="invGuardBwClear">Sign out and clear this device</button></div>';
}
function grdBwUse() { if (S && !_grdBwHeld && grdBwOn() && grdUser()) grdBwTouch(false); }
if (typeof window !== 'undefined' && window.addEventListener) {
  document.addEventListener('pointerdown', grdBwUse, true);
  document.addEventListener('keydown', grdBwUse, true);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState !== 'visible' || !S || !grdBwOn()) return;
    if (_grdBwHeld) grdBwAutoClear();
    else if (grdBwStale()) grdBwHold();
  });
  window.addEventListener('online', function() { if (S && _grdBwHeld) grdBwAutoClear(); });
  // A request opened in a window already running (an installed app takes the link): shown there.
  window.addEventListener('hashchange', function() {
    var it = grdApTake();
    if (!it) return;
    if (!S || !document.body.classList.contains('inv-booted')) { _grdApIn = it; return; }
    if (grdWhenIn(function() { grdApAsk(it); })) grdApAsk(it);
  });
}

/* ---------- The delegated clicks (guard.js guardAction routes invGuardAp… and invGuardBw… here) ---------- */
function grdApAction(action, btn) {
  switch (action) {
    case 'invGuardApStart': {
      if (_grdAsk && btn.closest('[data-grd-ask]')) { grdApStart('ask', _grdAsk.user.id); return true; }
      var u = grdBwHeldNow() ? grdBwOwner() : (_grdPick ? grdUserById(_grdPick) : null);
      if (!u) return true;
      if (grdFailLeftMs(u.id) > 0) { grdShowFail(document.querySelector('#guardRoot [data-grd-err]'), null, null, u.id); return true; }
      grdApStart('lock', u.id);
      return true;
    }
    case 'invGuardApWait': grdApStart('wait'); return true;
    case 'invGuardApAgain': { var r = _grdApReq; if (r) grdApStart(r.where, r.uid); return true; }
    case 'invGuardApCancel': { var w = _grdApReq ? _grdApReq.where : null; grdApStop(); grdApFrame(w); return true; }
    case 'invGuardApCopy': {
      var link = document.querySelector('[data-grd-ap-link]');
      if (!link) return true;
      var said = function(ok) { var l = document.querySelector('[data-grd-ap-left]'); if (l) l.textContent = ok ? 'The link is copied. ' + grdApLeftText(_grdApReq || { until: 0 }) : 'Select the link and copy it.'; };
      try { navigator.clipboard.writeText(link.value).then(function() { said(true); }, function() { link.select(); said(false); }); } catch (e) { link.select(); said(false); }
      return true;
    }
    case 'invGuardApOk': grdApGiveGo(); return true;
    case 'invGuardApNo': _grdApGive = null; closeTopOverlay(); return true;
    case 'invGuardBwClear': if (btn.closest('[data-grd-menu]')) closeTopOverlay(); grdBwClear(); return true;
  }
  return false;
}

_grdApIn = grdApTake();
