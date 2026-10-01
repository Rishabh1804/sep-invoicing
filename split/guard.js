/* ===== THE GUARD, STEP G1: THE GATE (owner, 1 Oct 2026; docs/GUARD.md) =====
   "Let's add a security feature that asks for the ID and PIN on reopening … Once the app is open, don't ask for PIN again
   until P1 items or settings are changed." Who is using the app, what they may open, what they may change:
   - Users and roles (S.users, S.guardCfg). No owner, no guard: until the owner's ID is created the app works as it always
     has, on every device and in every spec. Settings → Access → Users & access → Turn on the guard creates it.
   - The lock (#guardRoot): a layer over everything, never a page and never an address; at a fresh open, after
     lockMinutes in the background, and on Lock now (every window of the device). Nothing under it is drawn again or lost:
     a form typed before it is there after.
   - The re-ask (guardAsk): a P1 change asks the PIN again once askMinutes have passed since it was last given; a role that
     may not make the change is told so and never asked.
   - What a role opens (grdSees): a page it may not is refused with a word, and its doors are hidden (grdApplyDoors).
   A PIN is kept only as a salted PBKDF2-SHA256 hash (WebCrypto): never as itself, in the book, on the device or in a log.

   The API the other steps read (guard-common.md): grdOn, grdUser, grdUserId, grdIsOwner, grdCan, guardAsk, grdSees, and
   grdApplyDoors for the shell. A P1 call site is `if (!grdOk(group) && !(await guardAsk(group, what))) return;` in an async
   handler, or `if (!grdGate(group, what, again)) return;` in one that must stay synchronous (it asks, then runs `again`):
   with the guard off neither awaits anything, so every handler runs exactly as it did. */

var GRD_SESSION_KEY = 'sep_inv_session';     // this window's sign-in (sessionStorage): {userId, at, askAt, hiddenAt}
var GRD_LAST_KEY = 'sep_inv_guard_last';     // the user last signed in on this device (localStorage): the id only
var GRD_FAIL_KEY = 'sep_inv_guard_fail';     // wrong PINs on this device (localStorage): {n, until}
var GRD_ALG = 'PBKDF2-SHA256';
/* 210,000 iterations. Measured on the desktop project (P140, the sweep book): the hash an unlock runs takes about 70 ms at
   its quickest on the build sandbox's Chromium, and 250 ms median with the machine shared by nine test runs; 310,000 came
   to 351 ms at best under the same load, too near the 400 ms allowed. A phone is three to five times slower, a quarter to a
   third of a second. A stored secret carries its own count, so raising this later leaves every PIN already set working. */
var GRD_ITER = 210000;
var GRD_MIN_LEN = 4;
var GRD_FREE_TRIES = 5;                       // wrong PINs before the first lockout
var GRD_FAIL_FIRST_MS = 30000, GRD_FAIL_MAX_MS = 15 * 60000;
var GRD_GRACE_MS = 3000;                      // a PIN just given lets the change it was asked for go through
var GRD_CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L: read off paper without doubt
var GRD_ROLES = ['owner', 'office', 'supervisor', 'floor'];
var GRD_ROLE_NAMES = { owner: 'Owner', office: 'Office', supervisor: 'Supervisor', floor: 'Floor' };
/* What a role may change. `users` is the owner's alone and is not a switch. */
var GRD_GROUPS = [['billing', 'Invoices and credit notes'], ['rates', 'Rates and the client master'], ['voids', 'Voids and deletions'],
  ['payments', 'Payments and wages'], ['imports', 'Imports and pulls'], ['settings', 'Settings'], ['floor', 'Floor entries']];
/* Every page a role may be given, in the bar's order; a page this build does not have (Direction B's Pipeline and Floor
   day) is kept in a role's list and skipped on screen. */
var GRD_PAGE_IDS = ['pageHome', 'pageTodo', 'pageCreate', 'pageIM', 'pageRegister', 'pageClients', 'pagePipeline', 'pageFloor',
  'pageStaff', 'pageProduction', 'pageStock', 'pagePower', 'pageFinance', 'pageStats', 'pageReports', 'pageHistory'];
var GRD_PAGE_FALLBACK = { pagePipeline: 'Pipeline', pageFloor: 'Floor day' };
/* Pages that are money: opened only by a role that sees money, whatever its page switches say. */
var GRD_MONEY_PAGES = { pageFinance: 1, pageStats: 1, pageReports: 1 };

/* The roles' defaults (docs/GUARD.md): the owner everything; Office the billing desk; Supervisor and Floor the floor. */
function grdRoleDefaults() {
  return {
    owner: { pages: GRD_PAGE_IDS.slice(), may: GRD_GROUPS.map(function(g) { return g[0]; }).concat('users'), wages: true, finance: true },
    office: { pages: ['pageHome', 'pageTodo', 'pageCreate', 'pageIM', 'pageRegister', 'pageClients', 'pagePipeline'], may: ['billing'], wages: false, finance: false },
    supervisor: { pages: ['pageHome', 'pageTodo', 'pageFloor', 'pageStaff', 'pageProduction', 'pageStock', 'pagePower'], may: ['floor'], wages: false, finance: false },
    floor: { pages: ['pageHome', 'pageTodo', 'pageFloor', 'pageProduction', 'pageStock'], may: ['floor'], wages: false, finance: false }
  };
}
function grdCfgDefaults() { return { lockMinutes: 15, askMinutes: 5, roles: grdRoleDefaults(), recovery: null }; }
/* The book's shape (state.js): the users a container, the guard's settings a config filled key by key. */
if (typeof STATE_CONTAINERS !== 'undefined' && STATE_CONTAINERS.indexOf('users') < 0) STATE_CONTAINERS.push('users');
if (typeof STATE_CONFIGS !== 'undefined' && STATE_CONFIGS.indexOf('guardCfg') < 0) STATE_CONFIGS.push('guardCfg');

/* ---------- Who is here ---------- */
function grdUsers() { return S && Array.isArray(S.users) ? S.users : []; }
function grdUserById(id) { return grdUsers().find(function(u) { return u && u.id === id; }) || null; }
function grdActiveUsers() { return grdUsers().filter(function(u) { return u && u.active !== false && u.secret && u.secret.hash; }); }
/* The guard is on while an active owner exists. */
function grdOn() { return !!S && grdActiveUsers().some(function(u) { return u.role === 'owner'; }); }
function grdCfg() { return (S && S.guardCfg && typeof S.guardCfg === 'object') ? S.guardCfg : grdCfgDefaults(); }
function grdMinutes(k, dflt) { var v = parseFloat(grdCfg()[k]); return isFinite(v) && v >= 0 ? v : dflt; }
function grdLockMs() { return grdMinutes('lockMinutes', 15) * 60000; }
function grdAskMs() { return grdMinutes('askMinutes', 5) * 60000; }
/* A role's settings, key by key over its defaults; the owner's are always everything. */
function grdRole(role) {
  var d = grdRoleDefaults()[role] || grdRoleDefaults().floor;
  if (role === 'owner') return d;
  var c = ((grdCfg().roles || {})[role]) || {};
  return { pages: Array.isArray(c.pages) ? c.pages : d.pages, may: Array.isArray(c.may) ? c.may : d.may,
    wages: typeof c.wages === 'boolean' ? c.wages : d.wages, finance: typeof c.finance === 'boolean' ? c.finance : d.finance };
}
function grdRoleName(role) { return GRD_ROLE_NAMES[role] || role || ''; }

/* ---------- This window's session ---------- */
var _grdSess = null;          // kept in memory too: a browser that refuses sessionStorage still works until a reload
var _grdLocked = false;
var _grdGraceUntil = 0;
var _grdDrawnFor = null;      // the user the screens were last drawn for
function grdSessRead() {
  var raw;
  try { raw = sessionStorage.getItem(GRD_SESSION_KEY); } catch (e) { return _grdSess; }   // storage refused: the copy in memory
  if (raw == null) return _grdSess && _grdSess.mem ? _grdSess : (_grdSess = null);
  try { var s = JSON.parse(raw); _grdSess = s && s.userId ? s : null; } catch (e) { _grdSess = null; }
  return _grdSess;
}
function grdSessWrite(s) {
  _grdSess = s;
  try { sessionStorage.setItem(GRD_SESSION_KEY, JSON.stringify(s)); } catch (e) { s.mem = true; }
}
function grdSessClear() {
  _grdSess = null;
  try { sessionStorage.removeItem(GRD_SESSION_KEY); } catch (e) { /* nothing kept */ }
}

/* The signed-in user, or null (the guard off, or locked). */
function grdUser() {
  if (!grdOn() || _grdLocked) return null;
  var s = grdSessRead(), u = s && grdUserById(s.userId);
  return u && u.active !== false && u.secret ? u : null;
}
function grdUserId() { var u = grdUser(); return u ? u.id : null; }
/* With the guard off everyone is the owner, as the app has always been. */
function grdIsOwner() { if (!grdOn()) return true; var u = grdUser(); return !!u && u.role === 'owner'; }
/* The role may make this kind of change (a PIN may still be asked). */
function grdCan(group) {
  if (!grdOn()) return true;
  var u = grdUser();
  if (!u) return false;
  if (u.role === 'owner') return true;
  if (group === 'users') return false;
  return grdRole(u.role).may.indexOf(group) >= 0;
}
/* The change may go ahead now, with nothing asked: the guard off, or the role may and its PIN was given within the
   re-ask window. Floor entries are a permission, never re-asked. */
function grdOk(group) {
  if (!grdOn()) return true;
  if (!grdCan(group)) return false;
  if (group === 'floor') return true;
  var s = grdSessRead(), now = Date.now();
  if (now < _grdGraceUntil) return true;
  return !!(s && s.askAt && now - s.askAt >= 0 && now - s.askAt < grdAskMs());
}
/* The role opens this page. Home always; while locked nobody is signed in and the lock covers the screen, so the page
   under it is checked again at the unlock (grdAfterUser). */
function grdSees(tabId) {
  if (!grdOn() || tabId === 'pageHome') return true;
  var u = grdUser();
  if (!u || u.role === 'owner') return true;
  var r = grdRole(u.role);
  if (r.pages.indexOf(tabId) < 0) return false;
  return !(GRD_MONEY_PAGES[tabId] && !r.finance);
}
function grdSeesWages() { if (!grdOn()) return true; var u = grdUser(); return !u || u.role === 'owner' || grdRole(u.role).wages; }
function grdSeesMoney() { if (!grdOn()) return true; var u = grdUser(); return !u || u.role === 'owner' || grdRole(u.role).finance; }
function grdPageName(id) { return (typeof PAGE_TITLES !== 'undefined' && PAGE_TITLES[id]) || GRD_PAGE_FALLBACK[id] || id; }

/* ---------- The re-ask ---------- */
/* `what` is the change as a phrase ("cancel an invoice"): the refusal reads "Your ID can't cancel an invoice", the PIN
   dialog's title "Cancel an invoice". */
function grdWhatLower(what) { var w = String(what || 'make this change'); return /^[A-Z][a-z]+\b/.test(w) ? w.charAt(0).toLowerCase() + w.slice(1) : w; }
function grdWhatTitle(what) { var w = String(what || 'Make this change'); return w.charAt(0).toUpperCase() + w.slice(1); }
function grdRefuse(what) {
  return uiAlert({ title: grdWhatTitle(what), body: 'Your ID can’t ' + grdWhatLower(what) + '. Ask the owner.', tone: 'warning' }).then(function() { return false; });
}
function grdStampAsk() {
  var s = grdSessRead();
  if (s) { s.askAt = Date.now(); grdSessWrite(s); }
  _grdGraceUntil = Date.now() + GRD_GRACE_MS;
}
/* → Promise<boolean>. The guard off: yes at once. A role that may not: told so, no. Within the window (or a floor entry):
   yes. Otherwise the PIN, in the one dialog shell, under the device's lockout. */
function guardAsk(group, what) {
  if (!grdOn()) return Promise.resolve(true);
  var u = grdUser();
  if (!u) return Promise.resolve(false);
  if (!grdCan(group)) return grdRefuse(what);
  if (grdOk(group)) return Promise.resolve(true);
  return grdPinAsk(u, grdWhatTitle(what)).then(function(ok) { if (ok) grdStampAsk(); return ok; });
}
/* A synchronous handler's guard: true when it may go on now; else it asks, runs `again` on a yes, and returns false. */
function grdGate(group, what, again) {
  if (grdOk(group)) return true;
  guardAsk(group, what).then(function(ok) { if (ok && typeof again === 'function') again(); });
  return false;
}

/* ---------- Secrets: PBKDF2-SHA256, a 16-byte salt, a 32-byte hash, compared in full ---------- */
function grdCryptoOk() { try { return !!(window.crypto && crypto.subtle && crypto.getRandomValues && window.isSecureContext !== false); } catch (e) { return false; } }
function grdB64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
function grdUnB64(str) { var bin = atob(str), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function grdNorm(pin) { return String(pin == null ? '' : pin).normalize('NFC').trim(); }
function grdHash(pin, saltB64, iter) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(grdNorm(pin)), 'PBKDF2', false, ['deriveBits']).then(function(key) {
    return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: grdUnB64(saltB64), iterations: iter }, key, 256);
  }).then(function(bits) { return grdB64(new Uint8Array(bits)); });
}
function grdMakeSecret(pin) {
  var salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  var s = grdB64(salt), p = grdNorm(pin);
  return grdHash(p, s, GRD_ITER).then(function(h) { return { alg: GRD_ALG, iter: GRD_ITER, salt: s, hash: h, digits: /^\d+$/.test(p) }; });
}
/* Every character compared, whatever the first difference. */
function grdSame(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  var d = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function grdVerify(secret, pin) {
  if (!secret || !secret.salt || !secret.hash || !grdCryptoOk()) return Promise.resolve(false);
  return grdHash(pin, secret.salt, secret.iter || GRD_ITER).then(function(h) { return grdSame(h, secret.hash); }, function() { return false; });
}
/* A PIN or password as typed: four characters or more, both entries alike. '' when it will do, else why not. */
function grdPinProblem(a, b) {
  var p = grdNorm(a);
  if (p.length < GRD_MIN_LEN) return 'A PIN needs ' + GRD_MIN_LEN + ' characters or more.';
  if (p.length > 64) return 'Keep it to 64 characters.';
  if (b != null && p !== grdNorm(b)) return 'The two entries differ: type the same PIN twice.';
  return '';
}
/* The recovery code: 12 characters from the crypto source, in groups of four. */
function grdNewCode() {
  var out = '', buf = new Uint8Array(1), n = GRD_CODE_ABC.length, cap = 256 - (256 % n);
  while (out.length < 12) { crypto.getRandomValues(buf); if (buf[0] < cap) out += GRD_CODE_ABC.charAt(buf[0] % n); }
  return out.slice(0, 4) + '-' + out.slice(4, 8) + '-' + out.slice(8);
}
function grdCodeNorm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function grdUid() { return 'U-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
function grdInitials(name) {
  var w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((w[0] || '?').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase();
}

/* ---------- The device's lockout: five wrong, then 30 s, doubling to 15 min; a right PIN clears it ---------- */
function grdFailRead() { try { var f = JSON.parse(localStorage.getItem(GRD_FAIL_KEY) || 'null'); return f && typeof f.n === 'number' ? f : { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } }
function grdFailWrite(f) { try { localStorage.setItem(GRD_FAIL_KEY, JSON.stringify(f)); } catch (e) { /* a lockout kept in memory is no lockout; nothing else to do */ } }
function grdFailClear() { try { localStorage.removeItem(GRD_FAIL_KEY); } catch (e) { /* nothing kept */ } }
function grdFailLeftMs() { return Math.max(0, grdFailRead().until - Date.now()); }
function grdFailNote() {
  var f = grdFailRead();
  f.n++;
  if (f.n >= GRD_FREE_TRIES) f.until = Date.now() + Math.min(GRD_FAIL_MAX_MS, GRD_FAIL_FIRST_MS * Math.pow(2, f.n - GRD_FREE_TRIES));
  grdFailWrite(f);
  return f;
}
function grdSecs(ms) {
  var s = Math.ceil(ms / 1000);
  return s < 120 ? s + ' second' + (s === 1 ? '' : 's') : Math.ceil(s / 60) + ' minutes';
}
/* What the field says after a wrong entry, or while the device is locked out. */
function grdFailWords(noun) {
  var left = grdFailLeftMs();
  if (left > 0) return 'Locked for ' + grdSecs(left) + '.';
  var f = grdFailRead();
  if (!f.n) return '';
  var tries = GRD_FREE_TRIES - f.n;
  return 'Wrong ' + (noun || 'PIN') + '. ' + (tries > 0 ? tries + ' tr' + (tries === 1 ? 'y' : 'ies') + ' left.' : 'Try again.');
}
/* Every guard field under a lockout counts down in place, and comes back when it ends. */
var _grdTick = null;
function grdTickStart() {
  if (_grdTick) return;
  _grdTick = setInterval(function() {
    var left = grdFailLeftMs();
    document.querySelectorAll('[data-grd-err]').forEach(function(el) {
      if (el.dataset.grdLockout || left > 0) { el.textContent = left > 0 ? 'Locked for ' + grdSecs(left) + '.' : ''; el.dataset.grdLockout = left > 0 ? '1' : ''; }
    });
    document.querySelectorAll('[data-grd-go]').forEach(function(b) { b.disabled = left > 0; });
    if (!left) { clearInterval(_grdTick); _grdTick = null; }
  }, 1000);
}
/* After a wrong entry: the words, and the countdown when the device is locked out. */
function grdShowFail(errEl, goEl, noun) {
  var left = grdFailLeftMs();
  if (errEl) { errEl.textContent = grdFailWords(noun); errEl.dataset.grdLockout = left > 0 ? '1' : ''; }
  if (goEl) goEl.disabled = left > 0;
  if (left > 0) grdTickStart();
}
/* A field drawn while the device is locked out says so at once and counts down; otherwise it starts blank. */
function grdShowLockout(errEl, goEl) {
  if (grdFailLeftMs() > 0) grdShowFail(errEl, goEl); else if (goEl) goEl.disabled = false;
}

/* ---------- The PIN, asked again in the one dialog shell ---------- */
var _grdAsk = null;
function grdPinAsk(u, title) {
  if (_grdAsk) return _grdAsk.promise;
  var ask = { user: u, done: false };
  ask.promise = new Promise(function(resolve) {
    var obs = null, scrim = null;
    ask.finish = function(ok) {
      if (ask.done) return;
      ask.done = true;
      _grdAsk = null;
      if (obs) obs.disconnect();
      var pin = scrim && scrim.querySelector('#grdAskPin');
      if (pin) pin.value = '';
      if (scrim && scrim.isConnected) dialogCloseScrim(scrim);
      resolve(ok);
    };
    var html = '<div class="inv-dialog" role="dialog" aria-modal="true" aria-labelledby="grdAskT" data-grd-ask data-nodirty>' +
      dialogHeadHtml('<span id="grdAskT">' + escHtml(title) + '</span>', 'invGuardAskCancel', 'Cancel') +
      '<p class="inv-note inv-mb-8">Enter your PIN to go on.</p>' +
      '<div class="inv-field"><label class="inv-field-label" for="grdAskPin">PIN for ' + escHtml(u.name) + '</label>' +
      grdPinInput('grdAskPin', u) + '<div class="inv-field-error" data-grd-err role="alert"></div></div>' +
      '<div class="inv-dialog-foot"><button type="button" class="inv-btn inv-btn-secondary" data-action="invGuardAskCancel">Cancel</button>' +
      '<button type="button" class="inv-btn inv-btn-primary" data-action="invGuardAskOk" data-grd-go>Go on</button></div></div>';
    try {
      scrim = dialogOpen(html);
      ask.scrim = scrim;
      _grdAsk = ask;
      scrim.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ask.finish(false); }
        else if (e.key === 'Enter' && e.target && e.target.id === 'grdAskPin') { e.preventDefault(); e.stopPropagation(); grdAskSubmit(); }
      });
      // Shut by anything else (a jump to another screen closes every dialog): a no, never a hang.
      obs = new MutationObserver(function() { if (!scrim.isConnected) ask.finish(false); });
      obs.observe(document.body, { childList: true });
      grdShowLockout(scrim.querySelector('[data-grd-err]'), scrim.querySelector('[data-grd-go]'));
      var inp = scrim.querySelector('#grdAskPin');
      if (inp) { try { inp.focus(); } catch (e) { /* focus is a convenience */ } }
    } catch (err) {
      // The shell could not draw: nothing is changed unseen, and the banner says so.
      uiNotice('Could not ask for the PIN, so nothing was done — ' + title + '.', 'danger');
      ask.done = true;
      _grdAsk = null;
      resolve(false);
    }
  });
  return ask.promise;
}
function grdAskSubmit() {
  var ask = _grdAsk;
  if (!ask || ask.busy) return;
  var scrim = ask.scrim, inp = scrim.querySelector('#grdAskPin'), err = scrim.querySelector('[data-grd-err]'), go = scrim.querySelector('[data-grd-go]');
  if (grdFailLeftMs() > 0) { grdShowFail(err, go); return; }
  var pin = inp ? inp.value : '';
  if (!grdNorm(pin)) { if (err) err.textContent = 'Enter your PIN.'; if (inp) inp.focus(); return; }
  ask.busy = true;
  if (go) go.disabled = true;
  grdVerify(ask.user.secret, pin).then(function(ok) {
    ask.busy = false;
    if (ask.done) return;
    if (ok) { grdFailClear(); ask.finish(true); return; }
    grdFailNote();
    if (inp) { inp.value = ''; inp.focus(); }
    if (go) go.disabled = false;
    grdShowFail(err, go);
  });
}

/* ---------- The lock ---------- */
var _grdPick = null;       // the user chosen on the lock
var _grdForgot = false;    // the lock shows the owner's recovery
var _grdBusy = false;
var _grdFocusBack = null;  // where focus was when the lock came down
var GRD_MARK_SVG = '<svg class="inv-side-mark" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="96"/>' +
  '<polygon points="256,106 385.9,181 385.9,331 256,406 126.1,331 126.1,181"/><polygon points="256,160 339.1,208 339.1,304 256,352 172.9,304 172.9,208"/><circle cx="256" cy="256" r="38"/></svg>';

function grdPinInput(id, u, extra) {
  return '<input class="inv-input" id="' + id + '" type="password" autocomplete="off"' + (u && u.secret && u.secret.digits ? ' inputmode="numeric"' : '') +
    ' maxlength="64"' + (extra || '') + '>';
}
function grdLockHtml() {
  var users = grdActiveUsers().slice().sort(function(a, b) { return GRD_ROLES.indexOf(a.role) - GRD_ROLES.indexOf(b.role) || String(a.name).localeCompare(String(b.name)); });
  if (!users.some(function(u) { return u.id === _grdPick; })) _grdPick = null;
  var u = _grdPick ? grdUserById(_grdPick) : null;
  var h = '<div class="inv-guard-card">' +
    '<div class="inv-guard-brand">' + GRD_MARK_SVG + '<span>' + escHtml((S && S.company && S.company.name) || 'SEP Invoicing') + '</span></div>' +
    '<h1 class="inv-guard-title" id="grdTitle">Who is using the app?</h1>' +
    '<div class="inv-guard-rows" role="radiogroup" aria-labelledby="grdTitle">' + users.map(function(x) {
      return '<button type="button" class="inv-row inv-row-2" role="radio" aria-checked="' + (x.id === _grdPick) + '" data-action="invGuardPick" data-id="' + escHtml(x.id) + '">' +
        '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(x.name) + '</span><span class="inv-row-meta">' + escHtml(grdRoleName(x.role)) + '</span></span></button>';
    }).join('') + '</div>';
  if (!u) return h + '<p class="inv-note">Choose your name to unlock.</p></div>';
  if (_grdForgot && u.role === 'owner') {
    var hasCode = !!(grdCfg().recovery && grdCfg().recovery.hash);
    return h + (hasCode
      ? '<p class="inv-note inv-mb-8">The recovery code was shown once, when the guard was turned on. It resets the owner&rsquo;s PIN.</p>' +
        '<div class="inv-field"><label class="inv-field-label" for="grdCode">Recovery code</label><input class="inv-input inv-id" id="grdCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX"></div>' +
        '<div class="inv-field"><label class="inv-field-label" for="grdNew1">New PIN</label>' + grdPinInput('grdNew1', null) + '</div>' +
        '<div class="inv-field"><label class="inv-field-label" for="grdNew2">New PIN again</label>' + grdPinInput('grdNew2', null) +
        '<div class="inv-field-error" data-grd-err role="alert"></div></div>' +
        '<button type="button" class="inv-btn inv-btn-primary inv-btn-block" data-action="invGuardRecover" data-grd-go>Reset the PIN</button>'
      : '<div class="inv-callout inv-callout-warning inv-mb-8">No recovery code is on record in this book, so a forgotten owner PIN cannot be reset here. If the owner is still signed in in another window of the app on this device, set a new PIN there: Settings &rarr; Access &rarr; Users &amp; access &rarr; Reset PIN.</div>') +
      '<button type="button" class="inv-btn inv-btn-link inv-btn-sm inv-mt-8" data-action="invGuardForgot" data-v="0">Back to the PIN</button></div>';
  }
  return h + '<div class="inv-field inv-mt-16"><label class="inv-field-label" for="grdPin">PIN for ' + escHtml(u.name) + '</label>' + grdPinInput('grdPin', u) +
    '<div class="inv-field-error" data-grd-err role="alert"></div></div>' +
    '<button type="button" class="inv-btn inv-btn-primary inv-btn-block" data-action="invGuardUnlock" data-grd-go>Unlock</button>' +
    (_grdForgot ? '<p class="inv-note inv-mt-8" data-grd-forgot>Ask the owner to reset it.</p>'
      : '<button type="button" class="inv-btn inv-btn-link inv-btn-sm inv-mt-8" data-action="invGuardForgot" data-v="1">Forgot your PIN?</button>') + '</div>';
}
function grdRenderLock() {
  var root = document.getElementById('guardRoot');
  if (!root) return;
  var had = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : '';
  root.innerHTML = grdLockHtml();
  grdShowLockout(root.querySelector('[data-grd-err]'), root.querySelector('[data-grd-go]'));
  var f = (had && document.getElementById(had)) || root.querySelector('#grdPin, #grdCode') || root.querySelector('[aria-checked="true"]') || root.querySelector('button');
  if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* focus is a convenience */ } }
}
/* The layer, made once and kept: the shell under it inert and hidden (body.inv-locked), nothing under it taking a tap or a
   key, and no figure showing through. */
function grdShowLock(why) {
  var root = document.getElementById('guardRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'guardRoot';
    root.className = 'inv-guard';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'grdTitle');
    // Keys and touches on the lock stop here: the app's own (Back on Backspace, Escape closing the dialog under it, a
    // swipe to another screen) never see them. Taps go on to events.js, which routes the lock's actions here.
    ['keydown', 'keyup', 'input', 'change', 'touchstart', 'touchend'].forEach(function(t) {
      root.addEventListener(t, function(e) {
        if (t === 'keydown' && e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') { e.preventDefault(); grdLockSubmit(); }
        e.stopPropagation();
      });
    });
  }
  var a = document.activeElement;
  if (!_grdLocked) _grdFocusBack = a && a !== document.body && !root.contains(a) ? a : null;
  if (a && a.blur && !root.contains(a)) { try { a.blur(); } catch (e) { /* nothing focused */ } }
  _grdLocked = true;
  _grdForgot = false;
  if (why === 'switch') _grdPick = null;
  else if (!_grdPick) { try { _grdPick = localStorage.getItem(GRD_LAST_KEY) || null; } catch (e) { _grdPick = null; } }
  document.body.appendChild(root);
  grdInertAll(true);
  document.body.classList.add('inv-locked');
  grdRenderLock();
  grdUserBtnDraw();
}
function grdInertAll(on) {
  Array.prototype.forEach.call(document.body.children, function(el) {
    if (el.id === 'guardRoot') return;
    if (on && !el.inert) { el.inert = true; el.setAttribute('data-grd-inert', ''); }
    if (!on && el.hasAttribute('data-grd-inert')) { el.inert = false; el.removeAttribute('data-grd-inert'); }
  });
}
function grdHideLock() {
  _grdLocked = false;
  _grdForgot = false;
  document.body.classList.remove('inv-locked');
  grdInertAll(false);
  var root = document.getElementById('guardRoot');
  if (root) { root.innerHTML = ''; root.remove(); }
  var back = _grdFocusBack;
  _grdFocusBack = null;
  if (back && back.isConnected && typeof back.focus === 'function') { try { back.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
}
/* Locks this window: the session ends, the lock comes down over whatever is on screen. */
function grdLock(why) {
  if (!grdOn()) return;
  grdSessClear();
  _grdGraceUntil = 0;
  if (_grdAsk) _grdAsk.finish(false);
  grdShowLock(why);
}
/* Lock now and Switch user: every window of this device. */
var _grdChan = null;
function grdChannel() {
  if (_grdChan === null) {
    try {
      _grdChan = new BroadcastChannel('sep-invoicing-guard');
      _grdChan.onmessage = function(ev) { if (ev.data && ev.data.type === 'lock' && S) grdLock(ev.data.why === 'switch' ? 'switch' : 'elsewhere'); };
    } catch (e) { _grdChan = false; }
  }
  return _grdChan;
}
function grdLockAll(why) {
  var c = grdChannel();
  if (c) { try { c.postMessage({ type: 'lock', why: why }); } catch (e) { /* this window still locks */ } }
  grdLock(why);
}

/* Signed in: the session, the remembered user, and the screens made right for whoever it is. */
function grdSignIn(u) {
  var now = Date.now();
  grdSessWrite({ userId: u.id, at: now, askAt: now, hiddenAt: null });
  try { localStorage.setItem(GRD_LAST_KEY, u.id); } catch (e) { /* remembered on this window only */ }
  grdFailClear();
  _grdPick = u.id;
  if (_grdLocked) grdHideLock();
  grdAfterUser();
}
/* After a sign-in, or a book loaded from elsewhere: the doors for this role, the top bar's button, and the page on screen
   if this role may not open it (sent to Home with a word). A screen drawn for somebody else is drawn again, unless a form
   or a dialog is in progress (bookBusy): what was typed stays. */
function grdAfterUser() {
  var u = grdUser(), prev = _grdDrawnFor;
  grdUserBtnDraw();
  // The shell's doors are the role's views (workspace.js); then any door left over is marked.
  if (typeof wsRedraw === 'function') wsRedraw();
  grdApplyDoors();
  if (!u) return;
  _grdDrawnFor = u.id;
  // Somebody else signed in: a dialog the last person left open (a delete half-confirmed, a reason half-typed) is not
  // handed on. Every one is shut, and a question it was asking is answered cancel; the same person coming back keeps it.
  if (prev && prev !== u.id && document.querySelector('.inv-scrim-dialog') && typeof closeOverlay === 'function') closeOverlay();
  var page = (document.querySelector('.inv-page-active') || {}).id;
  if (!page) return;
  if (!grdSees(page)) { switchTab(page); return; }
  var busy = typeof bookBusy === 'function' && bookBusy();
  if (page === 'pageStaff' && !grdSeesWages() && !busy && typeof renderAttendance === 'function') { renderAttendance(); return; }
  if (prev && prev !== u.id && !busy && typeof tabRedrawActive === 'function') tabRedrawActive();
}
function grdLockSubmit() {
  if (_grdForgot) grdRecover(); else grdUnlock();
}
function grdUnlock() {
  var root = document.getElementById('guardRoot');
  var u = _grdPick ? grdUserById(_grdPick) : null;
  if (!root || !u || _grdBusy) return;
  var inp = root.querySelector('#grdPin'), err = root.querySelector('[data-grd-err]'), go = root.querySelector('[data-grd-go]');
  if (grdFailLeftMs() > 0) { grdShowFail(err, go); return; }
  var pin = inp ? inp.value : '';
  if (!grdNorm(pin)) { if (err) err.textContent = 'Enter your PIN.'; if (inp) inp.focus(); return; }
  if (!grdCryptoOk()) { if (err) err.textContent = 'This browser cannot check a PIN here: open the app from its https address.'; return; }
  _grdBusy = true;
  if (go) go.disabled = true;
  grdVerify(u.secret, pin).then(function(ok) {
    _grdBusy = false;
    if (inp) inp.value = '';
    if (!_grdLocked) return;
    // Still the user chosen, and still active: another window may have changed the book meanwhile.
    var now = grdUserById(u.id);
    if (ok && now && now.active !== false) { grdSignIn(now); return; }
    if (ok) { grdRenderLock(); return; }
    grdFailNote();
    if (go) go.disabled = false;
    grdShowFail(err, go);
    if (inp) inp.focus();
  });
}
/* The owner's forgotten PIN, reset with the recovery code. The code is spent: a new one is made and shown once. */
function grdRecover() {
  var root = document.getElementById('guardRoot');
  var u = _grdPick ? grdUserById(_grdPick) : null;
  var rec = grdCfg().recovery;
  if (!root || !u || u.role !== 'owner' || !rec || !rec.hash || _grdBusy) return;
  var err = root.querySelector('[data-grd-err]'), go = root.querySelector('[data-grd-go]');
  if (grdFailLeftMs() > 0) { grdShowFail(err, go, 'recovery code'); return; }
  var code = grdCodeNorm((root.querySelector('#grdCode') || {}).value);
  var p1 = (root.querySelector('#grdNew1') || {}).value || '', p2 = (root.querySelector('#grdNew2') || {}).value || '';
  var bad = code.length !== 12 ? 'Type the 12 characters of the recovery code.' : grdPinProblem(p1, p2);
  if (bad) { if (err) err.textContent = bad; return; }
  _grdBusy = true;
  if (go) go.disabled = true;
  grdVerify(rec, code).then(function(ok) {
    if (!ok) {
      _grdBusy = false;
      grdFailNote();
      if (go) go.disabled = false;
      grdShowFail(err, go, 'recovery code');
      return null;
    }
    var next = grdNewCode();
    return Promise.all([grdMakeSecret(p1), grdMakeSecret(grdCodeNorm(next))]).then(function(made) {
      _grdBusy = false;
      var owner = grdUserById(u.id);
      if (!owner) return;
      owner.secret = made[0];
      owner.updatedAt = Date.now();
      S.guardCfg.recovery = { alg: GRD_ALG, iter: made[1].iter, salt: made[1].salt, hash: made[1].hash };
      saveState();
      grdSignIn(owner);
      grdShowCode(next, 'reset');
    });
  });
}

/* ---------- The top bar's button and its menu ---------- */
function grdUserBtnDraw() {
  var b = document.getElementById('guardUserBtn');
  if (!b) return;
  var u = grdUser();
  if (!u) { b.hidden = true; return; }
  b.hidden = false;
  b.dataset.initials = grdInitials(u.name);
  b.setAttribute('aria-label', u.name + ', ' + grdRoleName(u.role) + ': change PIN, switch user or lock');
  b.title = u.name + ' · ' + grdRoleName(u.role);
}
function grdMenuOpen() {
  var u = grdUser();
  if (!u) return;
  var row = function(action, title, meta) {
    return '<button type="button" class="inv-row inv-row-2" data-action="' + action + '"><span class="inv-row-main"><span class="inv-row-title">' + title +
      '</span><span class="inv-row-meta">' + meta + '</span></span></button>';
  };
  dialogOpen('<div class="inv-dialog" data-grd-menu>' + dialogHeadHtml(escHtml(u.name) + ' &middot; ' + escHtml(grdRoleName(u.role)), 'invCloseConfirm') +
    '<div class="inv-guard-rows">' +
    row('invGuardChangePin', 'Change my PIN', 'Your current PIN, then the new one twice') +
    row('invGuardSwitch', 'Switch user', 'Locks every window of this device for the next person') +
    row('invGuardLockNow', 'Lock now', 'Every window of this device asks for a PIN') + '</div></div>', { dismiss: true });
}

/* ---------- What a role opens: its doors ---------- */
/* The bar, the sidebar, the workspace tabs, Add's forms and Home's quick actions show only the pages this role opens (G3:
   the shell draws a workspace's views from what the role sees, workspace.js wsViewsPresent, and a workspace with none
   loses its door). A door hidden here is refused anyway (switchTab), so a door missed is a word, not a hole. */
var GRD_QUICK_PAGE = { challan: 'pageIM', stock: 'pageStock', attendance: 'pageStaff', paste: 'pageStaff', task: 'pageTodo' };
// Add → By hand: the screen each form is on (add.js ADD_HAND); a payment is Staff → Pay, so it needs the wages too.
var GRD_ADD_PAGE = { challan: 'pageIM', invoice: 'pageCreate', quote: 'pageClients', stock: 'pageStock', production: 'pageProduction',
  power: 'pagePower', attendance: 'pageStaff', payment: 'pageStaff', bill: 'pageFinance', task: 'pageTodo' };
function grdApplyDoors() {
  document.querySelectorAll('[data-grd-off]').forEach(function(el) { el.removeAttribute('data-grd-off'); });
  if (!grdOn() || !grdUser()) return;
  var off = function(el) { el.setAttribute('data-grd-off', ''); };
  document.querySelectorAll('.inv-navbar [data-tab], #invSidebar [data-tab], #wsTabs [data-tab]').forEach(function(el) {
    if (!grdSees(el.dataset.tab) || (el.dataset.sub === 'pay' && !grdSeesWages())) off(el);
  });
  document.querySelectorAll('.inv-navbar [data-ws], #invSidebar [data-ws]').forEach(function(el) {
    if (typeof wsViewsPresent === 'function' && !wsViewsPresent(el.dataset.ws).length) off(el);
  });
  document.querySelectorAll('[data-add-sheet] [data-action="invAddHand"][data-go]').forEach(function(el) {
    var to = GRD_ADD_PAGE[el.dataset.go];
    if ((to && !grdSees(to)) || (el.dataset.go === 'payment' && !grdSeesWages())) off(el);
  });
  document.querySelectorAll('#pageHome [data-action="invHomeQuick"][data-go], #pageHome [data-action="invCreateNew"]').forEach(function(el) {
    var to = el.dataset.action === 'invCreateNew' ? 'pageCreate' : GRD_QUICK_PAGE[el.dataset.go];
    if (to && !grdSees(to)) off(el);
  });
  if (!grdCan('settings')) document.querySelectorAll('.inv-topbar [data-action="invOpenSettings"], #invSidebar [data-action="invOpenSettings"]').forEach(off);
}
var _grdDoorsQueued = false;
function grdApplyDoorsSoon() {
  if (_grdDoorsQueued) return;
  _grdDoorsQueued = true;
  setTimeout(function() { _grdDoorsQueued = false; if (S) grdApplyDoors(); }, 0);
}
/* A sidebar or a More sheet drawn later gets its doors; anything appended while locked goes under the lock, inert. */
if (typeof MutationObserver !== 'undefined' && document.body) {
  new MutationObserver(function() {
    if (_grdLocked) grdInertAll(true);
    if (S && grdOn()) grdApplyDoorsSoon();
  }).observe(document.body, { childList: true });
}

/* ---------- Boot, the background, other windows ---------- */
/* At the end of the start (init.js bootApp): a window with no session, or one away past lockMinutes, is locked. */
function grdBoot() {
  grdChannel();
  if (!grdOn()) { grdUserBtnDraw(); return; }
  var s = grdSessRead(), u = s && grdUserById(s.userId);
  var away = s && s.hiddenAt && Date.now() - s.hiddenAt >= grdLockMs();
  if (!u || u.active === false || !u.secret || away) { grdLock(away ? 'away' : 'boot'); return; }
  s.hiddenAt = null;
  grdSessWrite(s);
  _grdDrawnFor = u.id;
  grdUserBtnDraw();
  grdApplyDoors();
}
/* A book loaded from another window, an import or a pull: users or roles may have changed. A deactivated user is locked
   out, a role that lost the page on screen is sent Home, the guard turned off lifts the lock. */
function grdRecheck() {
  if (!S) return;
  if (!grdOn()) {
    if (_grdLocked) grdHideLock();
    grdUserBtnDraw();
    grdApplyDoors();
    return;
  }
  if (_grdLocked) { grdRenderLock(); return; }
  var s = grdSessRead(), u = s && grdUserById(s.userId);
  if (!u || u.active === false || !u.secret) { grdLock('changed'); return; }
  grdAfterUser();
}
document.addEventListener('visibilitychange', function() {
  if (!S || !grdOn()) return;
  var s = grdSessRead();
  if (document.visibilityState === 'hidden') {
    if (s) { s.hiddenAt = Date.now(); grdSessWrite(s); }
    return;
  }
  if (s && s.hiddenAt) {
    var away = Date.now() - s.hiddenAt;
    s.hiddenAt = null;
    grdSessWrite(s);
    if (away >= grdLockMs()) grdLock('away');
  }
});
window.addEventListener('pagehide', function() {
  var s = S && grdOn() ? grdSessRead() : null;
  if (s) { s.hiddenAt = Date.now(); grdSessWrite(s); }
});
/* While locked, nothing outside the lock takes a key (Backspace was Back, Escape shut the dialog under it), and Back does
   not pass it: the move is put back. Registered before nav.js's own, so its listener never hears it. */
window.addEventListener('keydown', function(e) {
  if (!_grdLocked) return;
  var root = document.getElementById('guardRoot');
  if (root && root.contains(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  var f = root && root.querySelector('#grdPin, #grdCode, button');
  if (f) { try { f.focus({ preventScroll: true }); } catch (err) { /* focus is a convenience */ } }
}, true);
var _grdPopRestore = 0;
window.addEventListener('popstate', function(e) {
  if (!_grdLocked && !_grdPopRestore) return;
  e.stopImmediatePropagation();
  if (_grdPopRestore) { _grdPopRestore--; return; }
  var st = e.state;
  if (st && st.sep && typeof _navIdx === 'number' && st.idx !== _navIdx) { _grdPopRestore++; history.go(_navIdx - st.idx); }
});

/* ---------- Settings → Access → Users & access ---------- */
var _grdForm = null;   // the user dialog: {mode: 'on' | 'add' | 'edit' | 'pin' | 'mine', id}
function grdFieldHtml(id, label, input, hint) {
  return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' + input + (hint ? '<div class="inv-field-hint">' + hint + '</div>' : '') + '</div>';
}
function grdVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function grdFormErr(text) {
  var el = document.querySelector('[data-grd-form] [data-grd-err]');
  if (el) { el.textContent = text; el.dataset.grdLockout = ''; }
  return false;
}
function grdFormScrim() { var f = document.querySelector('[data-grd-form]'); return f ? f.closest('.inv-scrim-dialog') : null; }
function grdFormOpen(mode, id) {
  var u = id ? grdUserById(id) : null;
  if ((mode === 'edit' || mode === 'pin') && !u) return;
  _grdForm = { mode: mode, id: id || null };
  var title = { on: 'Turn on the guard', add: 'Add a user', edit: 'Edit ' + escHtml(u ? u.name : ''), pin: 'Reset ' + escHtml(u ? u.name : '') + '’s PIN', mine: 'Change my PIN' }[mode];
  var pins = function(lbl) {
    return grdFieldHtml('grdP1', lbl, grdPinInput('grdP1', null), GRD_MIN_LEN + ' characters or more: digits only bring up a number pad.') +
      grdFieldHtml('grdP2', lbl + ' again', grdPinInput('grdP2', null));
  };
  var roleSel = function(sel) {
    return '<select class="inv-select" id="grdRole">' + GRD_ROLES.filter(function(r) { return r !== 'owner'; }).map(function(r) {
      return '<option value="' + r + '"' + (r === sel ? ' selected' : '') + '>' + escHtml(grdRoleName(r)) + '</option>';
    }).join('') + '</select>';
  };
  var staffSel = function(sel) {
    var list = typeof staffActive === 'function' ? staffActive() : [];
    return '<select class="inv-select" id="grdStaff"><option value="">None</option>' + list.map(function(w) {
      return '<option value="' + escHtml(w.id) + '"' + (String(w.id) === String(sel) ? ' selected' : '') + '>' + escHtml(w.name) + '</option>';
    }).join('') + '</select>';
  };
  var body = '';
  if (mode === 'on') {
    body = '<p class="inv-note inv-mb-8">The owner&rsquo;s ID: everything, and the only one who manages users. The app then asks for an ID and PIN when it is opened, and the PIN again before a P1 change or Settings.</p>' +
      grdFieldHtml('grdName', 'Your name', '<input class="inv-input" id="grdName" autocomplete="off" maxlength="60">') + pins('PIN');
  } else if (mode === 'add' || mode === 'edit') {
    var isOwner = u && u.role === 'owner';
    body = grdFieldHtml('grdName', 'Name', '<input class="inv-input" id="grdName" autocomplete="off" maxlength="60" value="' + escHtml(u ? u.name : '') + '">') +
      (isOwner ? '<p class="inv-note inv-mb-8">The owner&rsquo;s role is fixed: everything.</p>' : grdFieldHtml('grdRole', 'Role', roleSel(u ? u.role : 'office'), 'What it opens and may change is set under the roles, below the users.')) +
      grdFieldHtml('grdStaff', 'Worker on the roster', staffSel(u ? u.staffId : ''), 'For a floor hand: links the ID to the roster.') +
      (mode === 'add' ? pins('PIN') : '');
  } else if (mode === 'pin') {
    body = '<p class="inv-note inv-mb-8">' + escHtml(u.name) + '&rsquo;s old PIN stops working at once. Tell them the new one.</p>' + pins('New PIN');
  } else if (mode === 'mine') {
    var me = grdUser();
    body = grdFieldHtml('grdCur', 'Your PIN now', grdPinInput('grdCur', me)) + pins('New PIN');
  }
  var ok = { on: 'Turn on', add: 'Add user', edit: 'Save', pin: 'Set PIN', mine: 'Change PIN' }[mode];
  dialogOpen('<div class="inv-dialog" data-grd-form="' + mode + '">' + dialogHeadHtml(title, 'invCloseConfirm') + body +
    '<div class="inv-field-error" data-grd-err role="alert"></div>' +
    '<div class="inv-dialog-foot"><button type="button" class="inv-btn inv-btn-secondary" data-action="invCloseConfirm">Cancel</button>' +
    '<button type="button" class="inv-btn inv-btn-primary" data-action="invGuardFormSave" data-grd-go>' + ok + '</button></div></div>');
}
async function grdFormSave() {
  var f = _grdForm, scrim = grdFormScrim();
  if (!f || !scrim || f.busy) return;
  var name = grdVal('grdName').trim().replace(/\s+/g, ' '), p1 = grdVal('grdP1'), p2 = grdVal('grdP2');
  var u = f.id ? grdUserById(f.id) : null;
  if (f.mode === 'on' || f.mode === 'add' || f.mode === 'edit') {
    if (!name) return grdFormErr('Enter the name.');
    var twin = grdActiveUsers().find(function(x) { return x.id !== f.id && String(x.name).toLowerCase() === name.toLowerCase(); });
    if (twin) return grdFormErr(name + ' is already a user.');
  }
  if (f.mode !== 'edit') { var bad = grdPinProblem(p1, p2); if (bad) return grdFormErr(bad); }
  if (!grdCryptoOk()) return grdFormErr('This browser cannot keep a PIN here: open the app from its https address.');
  if (f.mode === 'mine') {
    var me = grdUser();
    if (!me) return false;
    if (grdFailLeftMs() > 0) { grdShowFail(scrim.querySelector('[data-grd-err]'), scrim.querySelector('[data-grd-go]')); return false; }
    f.busy = true;
    var right = await grdVerify(me.secret, grdVal('grdCur'));
    f.busy = false;
    if (!right) { grdFailNote(); grdShowFail(scrim.querySelector('[data-grd-err]'), scrim.querySelector('[data-grd-go]')); var c = document.getElementById('grdCur'); if (c) { c.value = ''; c.focus(); } return false; }
    grdFailClear();
    me = grdUser();
    if (!me) return false;
    me.secret = await grdMakeSecret(p1);
    me.updatedAt = Date.now();
    saveState();
    dialogCloseScrim(grdFormScrim());
    showToast('Your PIN is changed');
    return true;
  }
  var what = { on: 'turn on the guard', add: 'add a user', edit: 'edit a user', pin: 'reset a PIN' }[f.mode];
  if (!grdOk('users') && !(await guardAsk('users', what))) return false;
  f.busy = true;
  var go = scrim.querySelector('[data-grd-go]');
  if (go) go.disabled = true;
  var secret = f.mode === 'edit' ? null : await grdMakeSecret(p1);
  var code = f.mode === 'on' ? grdNewCode() : null;
  var rec = code ? await grdMakeSecret(grdCodeNorm(code)) : null;
  // Cancelled while the PIN was being hashed: nothing is written.
  if (!scrim.isConnected || _grdForm !== f) { f.busy = false; return false; }
  var now = Date.now(), me2 = grdUserId();
  if (!Array.isArray(S.users)) S.users = [];
  if (!S.guardCfg || typeof S.guardCfg !== 'object') S.guardCfg = grdCfgDefaults();
  if (f.mode === 'on') {
    // The owner's record is taken up again where there was one, so the change log names one owner throughout.
    var owner = S.users.find(function(x) { return x && x.role === 'owner'; });
    if (owner) { owner.name = name; owner.secret = secret; owner.active = true; owner.updatedAt = now; }
    else { owner = { id: grdUid(), name: name, role: 'owner', secret: secret, active: true, createdAt: now, createdBy: null }; S.users.push(owner); }
    S.guardCfg.recovery = { alg: GRD_ALG, iter: rec.iter, salt: rec.salt, hash: rec.hash };
    grdSessWrite({ userId: owner.id, at: now, askAt: now, hiddenAt: null });
    try { localStorage.setItem(GRD_LAST_KEY, owner.id); } catch (e) { /* remembered on this window only */ }
    _grdDrawnFor = owner.id;
  } else if (f.mode === 'add') {
    var role = GRD_ROLES.indexOf(grdVal('grdRole')) > 0 ? grdVal('grdRole') : 'office';
    var staffId = grdVal('grdStaff');
    var nu = { id: grdUid(), name: name, role: role, secret: secret, active: true, createdAt: now, createdBy: me2 };
    if (staffId !== '') nu.staffId = isNaN(+staffId) ? staffId : +staffId;
    S.users.push(nu);
  } else if (f.mode === 'edit') {
    u = grdUserById(f.id);
    if (!u) return false;
    u.name = name;
    if (u.role !== 'owner' && GRD_ROLES.indexOf(grdVal('grdRole')) > 0) u.role = grdVal('grdRole');
    var sid = grdVal('grdStaff');
    if (sid === '') delete u.staffId; else u.staffId = isNaN(+sid) ? sid : +sid;
    u.updatedAt = now;
  } else if (f.mode === 'pin') {
    u = grdUserById(f.id);
    if (!u) return false;
    u.secret = secret;
    u.updatedAt = now;
  }
  _grdForm = null;
  saveState();
  if (code) grdShowCode(code, 'first');
  else dialogCloseScrim(scrim);
  grdUsersRedraw(f.mode === 'on');
  grdUserBtnDraw();
  grdApplyDoors();
  if (f.mode !== 'on') showToast({ add: name + ' added', edit: name + ' saved', pin: (u && u.name) + '’s PIN is set' }[f.mode]);
  return true;
}
/* The recovery code, shown once: when the guard is turned on, after a reset with the old one, or made anew. */
function grdShowCode(code, why) {
  var lead = { first: 'The guard is on, and you are signed in as the owner.', reset: 'Your PIN is reset. The code you used is spent: this one replaces it.',
    anew: 'The old recovery code no longer works: this one replaces it.' }[why] || '';
  var html = '<div class="inv-dialog" data-grd-code>' + dialogHeadHtml('Your recovery code', 'invCloseConfirm') +
    '<p class="inv-mb-8">' + lead + '</p>' +
    '<div class="inv-guard-code" data-grd-recovery>' + escHtml(code) + '</div>' +
    '<div class="inv-callout inv-callout-warning inv-mt-8">Write this down and keep it off the device. It resets the owner&rsquo;s PIN if it is forgotten, and it is shown only this once.</div>' +
    '<div class="inv-dialog-foot"><button type="button" class="inv-btn inv-btn-primary" data-action="invCloseConfirm">I have written it down</button></div></div>';
  var form = document.querySelector('[data-grd-form="on"]');
  var scrim = form ? dialogOpen(html, { replace: true }) : dialogOpen(html);
  // What was typed in the form is in the hash now: the code shut by its × asks nothing.
  if (scrim && scrim.dataset) delete scrim.dataset.typed;
}
/* The users section drawn again: wholly when the guard turned on or off, else its list alone (a figure typed in the
   minutes or a role's switches stays as typed). */
function grdUsersRedraw(whole) {
  var d = document.querySelector('#settingsScrim details[data-sec="users"]');
  if (!d) return;
  if (whole) {
    var wrap = document.createElement('div');
    wrap.innerHTML = _settingsSecHtml('users', true);
    d.replaceWith(wrap.firstChild);
  } else {
    var list = d.querySelector('[data-grd-userlist]');
    if (list) list.innerHTML = grdUserRowsHtml();
    var sum = d.querySelector('[data-sum="users"]');
    if (sum) sum.innerHTML = SETTINGS_SECS.users.summary();
  }
  if (typeof _settingsNavDots === 'function') _settingsNavDots();
}
function grdUserRowsHtml() {
  var list = grdUsers().slice().sort(function(a, b) {
    return (a.active === false) - (b.active === false) || GRD_ROLES.indexOf(a.role) - GRD_ROLES.indexOf(b.role) || String(a.name).localeCompare(String(b.name));
  });
  var me = grdUserId();
  return list.map(function(u) {
    var w = u.staffId != null && typeof staffById === 'function' ? staffById(u.staffId) : null;
    var meta = [grdRoleName(u.role), w ? 'worker ' + w.name : '', u.id === me ? 'signed in here' : ''].filter(Boolean).join(' · ');
    var acts = '<button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invGuardEdit" data-id="' + escHtml(u.id) + '">Edit</button>';
    if (u.active !== false) {
      acts += '<button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invGuardResetPin" data-id="' + escHtml(u.id) + '">Reset PIN</button>';
      if (u.role !== 'owner') acts += '<button type="button" class="inv-btn inv-btn-danger inv-btn-sm" data-action="invGuardDeactivate" data-id="' + escHtml(u.id) + '">Deactivate</button>';
    } else if (u.role !== 'owner') acts += '<button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invGuardReactivate" data-id="' + escHtml(u.id) + '">Reactivate</button>';
    return '<div class="inv-row inv-row-2 inv-row-flow' + (u.active === false ? ' inv-row-muted' : '') + '" data-grd-user="' + escHtml(u.id) + '">' +
      '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(u.name) + '</span><span class="inv-row-meta">' + escHtml(meta) + '</span></span>' +
      '<span class="inv-row-end inv-row-actions">' + uiDot(u.active === false ? 'neutral' : 'ok', u.active === false ? 'Inactive' : 'Active') + acts + '</span></div>';
  }).join('');
}
/* The roles as a grid of switches: the pages each opens, what each may change, wages and money. Home is every role's. */
function grdRolesGridHtml() {
  var roles = ['office', 'supervisor', 'floor'];
  var cell = function(role, attr, on, label, locked) {
    return '<td><label class="inv-field-check"><input type="checkbox" class="inv-check" data-grd-role="' + role + '" ' + attr + (on ? ' checked' : '') + (locked ? ' disabled' : '') + '>' +
      '<span class="inv-visually-hidden">' + escHtml(grdRoleName(role) + ': ' + label) + '</span></label></td>';
  };
  var row = function(label, attr, test, locked) {
    return '<tr><td>' + escHtml(label) + '</td>' + roles.map(function(r) { return cell(r, attr, test(grdRole(r)), label, locked); }).join('') + '</tr>';
  };
  var h = '<div class="inv-scroll-x"><table class="inv-table" data-grd-roles><thead><tr><th>Opens, may change</th>' +
    roles.map(function(r) { return '<th>' + escHtml(grdRoleName(r)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    '<tr class="inv-table-group"><td colspan="4">Pages it opens</td></tr>';
  GRD_PAGE_IDS.forEach(function(p) {
    if (!document.getElementById(p)) return;
    h += row(grdPageName(p) + (GRD_MONEY_PAGES[p] ? ' (money)' : ''), 'data-grd-pg="' + p + '"', function(x) { return p === 'pageHome' || x.pages.indexOf(p) >= 0; }, p === 'pageHome');
  });
  h += '<tr class="inv-table-group"><td colspan="4">What it may change</td></tr>';
  GRD_GROUPS.forEach(function(g) { h += row(g[1], 'data-grd-may="' + g[0] + '"', function(x) { return x.may.indexOf(g[0]) >= 0; }); });
  h += '<tr class="inv-table-group"><td colspan="4">What it sees</td></tr>' +
    row('Wages (Staff → Pay)', 'data-grd-flag="wages"', function(x) { return x.wages; }) +
    row('Money (Finance, Stats, Reports)', 'data-grd-flag="finance"', function(x) { return x.finance; });
  return h + '</tbody></table></div>';
}
function grdUsersBody() {
  if (!grdOn()) {
    var inactive = grdUsers().filter(function(u) { return u && u.active === false; }).length;
    return '<p class="inv-note inv-mb-8">Off: the app opens without an ID or PIN, and anyone holding this device can change anything.' +
      (inactive ? ' ' + inactive + ' user' + (inactive === 1 ? ' is' : 's are') + ' kept from before, inactive.' : '') + '</p>' +
      '<div class="inv-toolbar inv-toolbar-flush"><button type="button" class="inv-btn inv-btn-secondary" data-action="invGuardOn">Turn on the guard</button></div>';
  }
  if (!grdIsOwner()) return '<p class="inv-note">On. Only the owner manages users and access.</p>';
  var cfg = grdCfg();
  return '<div class="inv-toolbar inv-toolbar-flush"><span class="inv-field-label">Users</span><button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invGuardAdd">Add user</button></div>' +
    '<div class="inv-guard-rows" data-grd-userlist>' + grdUserRowsHtml() + '</div>' +
    '<div class="inv-fields">' +
    grdFieldHtml('setGrdLock', 'Lock after this many minutes in the background', _sNum('setGrdLock', grdMinutes('lockMinutes', 15), 1, 0)) +
    grdFieldHtml('setGrdAsk', 'Ask the PIN again after (minutes)', _sNum('setGrdAsk', grdMinutes('askMinutes', 5), 1, 0)) + '</div>' +
    '<div class="inv-field-label inv-mt-8">What each role opens and may change</div>' + grdRolesGridHtml() +
    '<div class="inv-toolbar inv-toolbar-flush inv-mt-8"><button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invGuardNewCode">New recovery code</button>' +
    '<button type="button" class="inv-btn inv-btn-danger inv-btn-sm" data-action="invGuardOff">Turn off the guard</button></div>' +
    (cfg.recovery && cfg.recovery.hash ? '' : '<div class="inv-callout inv-callout-warning inv-mt-8">No recovery code is on record: make one, or a forgotten owner PIN locks the books.</div>');
}
/* The section's Save: the minutes and the roles. */
function grdUsersSave() {
  if (!grdOn() || !grdIsOwner()) return false;
  var cfg = S.guardCfg && typeof S.guardCfg === 'object' ? S.guardCfg : (S.guardCfg = grdCfgDefaults());
  var lock = parseFloat(_sVal('setGrdLock')), ask = parseFloat(_sVal('setGrdAsk'));
  if (isFinite(lock) && lock >= 0) cfg.lockMinutes = Math.round(lock);
  if (isFinite(ask) && ask >= 0) cfg.askMinutes = Math.round(ask);
  var roles = {};
  ['office', 'supervisor', 'floor'].forEach(function(r) {
    var was = grdRole(r), pages = was.pages.filter(function(p) { return !document.getElementById(p); });   // a page this build lacks is kept
    var may = [], flags = { wages: was.wages, finance: was.finance };
    document.querySelectorAll('#settingsScrim [data-grd-role="' + r + '"]').forEach(function(el) {
      if (el.dataset.grdPg && (el.checked || el.dataset.grdPg === 'pageHome')) pages.push(el.dataset.grdPg);
      if (el.dataset.grdMay && el.checked) may.push(el.dataset.grdMay);
      if (el.dataset.grdFlag) flags[el.dataset.grdFlag] = el.checked;
    });
    roles[r] = { pages: pages, may: may, wages: flags.wages, finance: flags.finance };
  });
  roles.owner = grdRoleDefaults().owner;
  cfg.roles = roles;
  grdApplyDoors();
}
async function grdSetActive(id, on) {
  var u = grdUserById(id);
  if (!u || u.role === 'owner') return;
  if (!grdOk('users') && !(await guardAsk('users', on ? 'reactivate a user' : 'deactivate a user'))) return;
  if (!on && !(await uiConfirm({ title: 'Deactivate ' + u.name + '?', body: u.name + ' can no longer unlock the app, on any device, from the next time it loads the book. ' +
    'Kept on the list, never deleted: what ' + u.name + ' changed still names them, and they can be reactivated.', okLabel: 'Deactivate', danger: true }))) return;
  u = grdUserById(id);
  if (!u) return;
  u.active = !!on;
  u.updatedAt = Date.now();
  saveState();
  grdUsersRedraw(false);
  showToast(u.name + (on ? ' is active again' : ' is deactivated'));
}
async function grdNewRecovery() {
  if (!grdOk('users') && !(await guardAsk('users', 'make a new recovery code'))) return;
  if (!grdCryptoOk()) return;
  var code = grdNewCode(), rec = await grdMakeSecret(grdCodeNorm(code));
  S.guardCfg.recovery = { alg: GRD_ALG, iter: rec.iter, salt: rec.salt, hash: rec.hash };
  saveState();
  grdUsersRedraw(false);
  grdShowCode(code, 'anew');
}
/* Turn off: the owner's PIN whatever the window, then a confirm. The users are kept, inactive; nothing else changes. */
async function grdTurnOff() {
  var u = grdUser();
  if (!u || u.role !== 'owner') { grdRefuse('turn off the guard'); return; }
  if (!(await grdPinAsk(u, 'Turn off the guard'))) return;
  if (!(await uiConfirm({ title: 'Turn off the guard?', body: 'The app opens without an ID or PIN on every device that loads this book, and nobody is asked before a P1 change. ' +
    'Every user is kept, inactive, so the guard can be turned on again.', okLabel: 'Turn off', danger: true }))) return;
  var now = Date.now();
  grdUsers().forEach(function(x) { if (x && x.active !== false) { x.active = false; x.updatedAt = now; } });
  grdSessClear();
  _grdDrawnFor = null;
  saveState();
  grdUsersRedraw(true);
  grdUserBtnDraw();
  grdApplyDoors();
  showToast('The guard is off');
}

/* Settings → Access → Users & access. settings.js registers it, and the Access group, which builder D's Devices joins (this
   module loads before settings.js). Its Save is guarded as `users`, the owner's alone: a section's `guard` names the group
   its Save asks under (default 'settings'), and `saveIf` whether it has a Save at all. */
var GRD_SETTINGS_SEC = {
  title: 'Users & access',
  guard: 'users',
  summary: function() {
    if (!grdOn()) return 'off &middot; no ID or PIN asked';
    var n = grdActiveUsers().length;
    return escHtml('on · ' + n + ' user' + (n === 1 ? '' : 's') + ' · lock after ' + grdMinutes('lockMinutes', 15) + ' min');
  },
  body: function() { return grdUsersBody(); },
  why: 'Who is using the app decides what it shows and what it may change. A PIN is kept only as a salted, slow hash, never as itself. ' +
    'The app asks for it when it is opened, after the minutes above in the background and on Lock now; then again before a P1 change ' +
    '(an invoice or credit note issued, edited, cancelled or deleted; rates and the client master; any void; payments and wages; an import or pull; Settings; users) ' +
    'once the second figure has passed since it was last given. Five wrong tries lock the device for 30 seconds, doubling to 15 minutes. ' +
    'A PIN of four digits stops someone at the screen, not someone holding a copy of the book: give the owner six or more, or a password.',
  saveIf: function() { return grdOn() && grdIsOwner(); },
  save: function() { return grdUsersSave(); }
};

/* ---------- Actions (events.js routes every invGuard… here) ---------- */
function guardAction(action, btn) {
  switch (action) {
    case 'invGuardPick': _grdPick = btn.dataset.id; _grdForgot = false; grdRenderLock(); return true;
    case 'invGuardUnlock': grdUnlock(); return true;
    case 'invGuardForgot': _grdForgot = btn.dataset.v === '1'; grdRenderLock(); return true;
    case 'invGuardRecover': grdRecover(); return true;
    case 'invGuardAskOk': grdAskSubmit(); return true;
    case 'invGuardAskCancel': if (_grdAsk) _grdAsk.finish(false); else closeTopOverlay(); return true;
    case 'invGuardMenu': grdMenuOpen(); return true;
    case 'invGuardChangePin': closeTopOverlay(); grdFormOpen('mine'); return true;
    case 'invGuardSwitch': closeTopOverlay(); grdLockAll('switch'); return true;
    case 'invGuardLockNow': closeTopOverlay(); grdLockAll('now'); return true;
    case 'invGuardOn':
      if (!grdCryptoOk()) { uiAlert({ title: 'This browser cannot keep a PIN', body: 'The guard needs the browser’s own cryptography (WebCrypto), which this page cannot reach here. Open the app from its https address.' }); return true; }
      grdFormOpen('on'); return true;
    case 'invGuardAdd': grdFormOpen('add'); return true;
    case 'invGuardEdit': grdFormOpen('edit', btn.dataset.id); return true;
    case 'invGuardResetPin': grdFormOpen('pin', btn.dataset.id); return true;
    case 'invGuardFormSave': grdFormSave(); return true;
    case 'invGuardDeactivate': grdSetActive(btn.dataset.id, false); return true;
    case 'invGuardReactivate': grdSetActive(btn.dataset.id, true); return true;
    case 'invGuardNewCode': grdNewRecovery(); return true;
    case 'invGuardOff': grdTurnOff(); return true;
  }
  return false;
}
