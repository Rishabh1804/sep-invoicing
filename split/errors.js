/* ===== ERROR REPORTS =====
   Owner, 1 Oct 2026: "Yes, add Sentry error reporting". An error nobody caught already reaches the screen (state.js); a
   screen that cannot be drawn and a start-up step that fails say so too. Each is now also sent to the developer, so a
   crash on the owner's phone is seen before anybody has to describe it.

   What goes: the kind of error, where in the code it happened (function names and line numbers in the built page), the
   build stamp, the screen, the layout, the browser, and whether the device was online or the app installed. The error's
   own words do not go (the owner, 21 Nov 2026): the masking (errScrub) missed a name in single quotes, a single word in
   capitals and a name in title case, and no mask can know every name in a book. One case apart: an error with no place
   in the code cannot be diagnosed from its kind alone, so the owner, if he is the one signed in, is shown its masked
   words and asked whether they may go with it (errAskWords); anybody else is not asked and the words stay.
   The manual door (the owner, 21 Nov 2026): the masked words of the last five reports that went without them are kept
   on the device (errKeep, never on the book), and Settings lists them for the owner, each with Send this message, for
   when the developer says a report could not be read from its place in the code alone.
   What never goes: a record, a figure, the address's query, a user, or the breadcrumbs a
   Sentry SDK collects (their request URLs carry the metals.dev key). So there is no SDK: one POST to Sentry's
   envelope endpoint, from the live site only (never a test or a local copy), at most ten a session, each kind once,
   held while offline (twenty at most) and sent when the device is back online. Off per device in Settings → Data &
   device → Backup, storage & build. Nothing is sent until ERR_DSN names the project. */
var ERR_DSN = 'https://d617739ea88ba91290fa103fc43334ac@o4511273636855808.ingest.de.sentry.io/4512179552845904';
// The new address (S0, move.js) beside the old: Sentry's Allowed domains name both (docs/atlas/core/error-reports.md).
var ERR_HOSTS = ['rishabh1804.github.io', 'app.somaelectro.co.in'];
var ERR_OFF_KEY = 'sep_inv_err_off';
var ERR_QUEUE_KEY = 'sep_inv_err_queue';
var ERR_KEPT_KEY = 'sep_inv_err_kept';   // the messages that did not go, kept on the device for the owner to send (errKept)
var ERR_MAX_SESSION = 10, ERR_MAX_QUEUE = 20, ERR_MAX_KEPT = 5;
var _errSent = 0, _errSeen = {};

function errDsnParts(dsn) {
  var m = /^https:\/\/([0-9a-f]+)@([a-z0-9.-]+)\/(\d+)$/i.exec(String(dsn || '').trim());
  return m ? { key: m[1], host: m[2], project: m[3] } : null;
}
function errDeviceOff() { try { return localStorage.getItem(ERR_OFF_KEY) === '1'; } catch (e) { return false; } }
function errOn() {
  try {
    if (!errDsnParts(ERR_DSN) || ERR_HOSTS.indexOf(location.hostname) < 0) return false;
    if (navigator.webdriver) return false;   // a test browser: never reports
    return !errDeviceOff();
  } catch (e) { return false; }
}

/* The message, with what could be the book's data taken out. It is what the owner is shown when he is asked
   (errAskWords) and what tells two errors apart on this device (errReport); it is sent only on his yes. */
var ERR_NO_WORDS = '(message not sent)';
function errScrub(s) {
  return String(s == null ? '' : s)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/g, '[gstin]')
    .replace(/₹\s?[\d,]+(?:\.\d+)?/g, '[amount]')
    .replace(/"[^"]*"|“[^”]*”/g, '"[text]"')
    .replace(/\b[A-Z][A-Z.&]+(?:\s+[A-Z][A-Z.&]+)+\b/g, '[name]')
    .replace(/\d[\d,.:/-]{3,}/g, '[n]')
    .slice(0, 300);
}

/* Chrome writes "at fn (url:line:col)", Firefox and Safari "fn@url:line:col"; Sentry wants the oldest call first. */
function errFrames(stack) {
  var out = [];
  String(stack || '').split('\n').forEach(function(line) {
    var m = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line) || /^\s*([^@]*)@(.+?):(\d+):(\d+)\s*$/.exec(line);
    if (!m) return;
    var file = m[2].replace(/[?#].*$/, '').split('/').pop() || 'index.html';
    out.push({ 'function': (m[1] || '?').slice(0, 80), filename: file, lineno: +m[3], colno: +m[4], in_app: true });
  });
  return out.slice(0, 30).reverse();
}

function errBuild() {
  var m = document.querySelector('meta[name="app-build"]');
  return (m && m.getAttribute('content')) || 'dev';
}
function errId() {
  var b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.prototype.map.call(b, function(x) { return ('0' + x.toString(16)).slice(-2); }).join('');
}

function errEvent(err, where) {
  var type = (err && err.name) || 'Error', msg = err && err.message != null ? err.message : String(err);
  var frames = errFrames(err && err.stack);
  var page = document.querySelector('.inv-page-active');
  var installed = false;
  try { installed = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) { /* older browsers */ }
  var value = { type: errScrub(type).slice(0, 60), value: ERR_NO_WORDS };
  if (frames.length) value.stacktrace = { frames: frames };
  return {
    event_id: errId(), timestamp: Date.now() / 1000, platform: 'javascript', level: 'error', logger: 'sep-invoicing',
    release: 'sep-invoicing@' + errBuild(), environment: 'production',
    exception: { values: [value] },
    tags: { where: String(where || 'uncaught').slice(0, 60), screen: page ? page.id : 'none',
      layout: document.body && document.body.classList.contains('inv-desktop') ? 'desktop' : 'phone',
      installed: installed ? 'yes' : 'no', online: navigator.onLine === false ? 'no' : 'yes' },
    request: { url: location.origin + location.pathname, headers: { 'User-Agent': navigator.userAgent } }
  };
}

function errSend(ev) {
  var p = errDsnParts(ERR_DSN);
  if (!p) return Promise.resolve(false);
  var url = 'https://' + p.host + '/api/' + p.project + '/envelope/?sentry_key=' + p.key + '&sentry_version=7&sentry_client=sep-invoicing%2F1';
  var body = JSON.stringify({ event_id: ev.event_id, sent_at: new Date().toISOString() }) + '\n' + JSON.stringify({ type: 'event' }) + '\n' + JSON.stringify(ev);
  // text/plain keeps it a simple request (no preflight); keepalive lets it leave as the page closes.
  return fetch(url, { method: 'POST', body: body, keepalive: true, cache: 'no-store', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=UTF-8' } })
    .then(function(r) { if (!r.ok && r.status !== 429) throw new Error('HTTP ' + r.status); return true; });
}

function errQueue(ev) {
  try {
    var q = JSON.parse(localStorage.getItem(ERR_QUEUE_KEY) || '[]');
    if (!Array.isArray(q)) q = [];
    q.push(ev);
    while (q.length > ERR_MAX_QUEUE) q.shift();
    localStorage.setItem(ERR_QUEUE_KEY, JSON.stringify(q));
  } catch (e) { /* the shared pool may be full: the report is lost, the app is not */ }
}
function errFlush() {
  try {
    if (!errOn() || navigator.onLine === false) return;
    var q = JSON.parse(localStorage.getItem(ERR_QUEUE_KEY) || '[]');
    if (!Array.isArray(q) || !q.length) return;
    localStorage.removeItem(ERR_QUEUE_KEY);
    q.forEach(function(ev) { errSend(ev).catch(function() { errQueue(ev); }); });
  } catch (e) { /* never an error of its own */ }
}

/* The one door: an error and where it was caught ('uncaught', 'promise', 'boot: <step>', 'render: <page>'). */
function errReport(err, where) {
  try {
    if (!errOn()) return;
    var ev = errEvent(err, where), top = ev.exception.values[0];
    var fs = top.stacktrace ? top.stacktrace.frames : [], last = fs[fs.length - 1];
    var words = errScrub(err && err.message != null ? err.message : String(err));
    var sig = top.type + '|' + words + '|' + (last ? last['function'] + ':' + last.lineno : '');
    if (_errSeen[sig]) return;
    _errSeen[sig] = 1;
    if (_errSent >= ERR_MAX_SESSION) return;
    _errSent++;
    var go = function() {
      try {
        if (top.value === ERR_NO_WORDS && words) errKeep(ev, words);
        if (navigator.onLine === false) { errQueue(ev); return; }
        errSend(ev).catch(function() { errQueue(ev); });
      } catch (e) { /* as below */ }
    };
    // No place in the code: the owner is asked for the words; on a no, or with nobody to ask, the report goes without.
    if (!fs.length && words && errMayAsk()) {
      errAskWords(words).then(function(yes) { if (yes) top.value = words; go(); }, go);
      return;
    }
    go();
  } catch (e) { /* a report must never become an error of its own */ }
}
/* The owner signed in on a started app (with the guard off, whoever is using it): the only one asked. */
function errMayAsk() {
  try {
    return typeof uiConfirm === 'function' && typeof grdIsOwner === 'function' && grdIsOwner() &&
      !!document.body && document.body.classList.contains('inv-booted');
  } catch (e) { return false; }
}
/* → Promise<boolean>. The words are shown as they would go, masked. */
function errAskWords(words) {
  return uiConfirm({ title: 'Send this error’s message?',
    body: 'Something went wrong, and its report cannot say where in the code. The report goes to the developer without the error’s message unless you say it may go. The message, with figures and names masked as far as the app can tell them: “' + words + '”',
    okLabel: 'Send the message', cancelLabel: 'Send without it' }).then(function(a) { return a === true; });
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('online', errFlush);
  setTimeout(errFlush, 8000);
}

/* ---------- The manual door: the messages that did not go ---------- */
function errKept() {
  try { var q = JSON.parse(localStorage.getItem(ERR_KEPT_KEY) || '[]'); return Array.isArray(q) ? q : []; } catch (e) { return []; }
}
function errKeptWrite(q) {
  try { if (q.length) localStorage.setItem(ERR_KEPT_KEY, JSON.stringify(q)); else localStorage.removeItem(ERR_KEPT_KEY); } catch (e) { /* per device */ }
}
/* The report as it went, and the masked words it went without. The newest five. */
function errKeep(ev, words) {
  var q = errKept();
  q.push({ id: ev.event_id, at: Date.now(), type: ev.exception.values[0].type, where: ev.tags.where, words: words, ev: ev });
  while (q.length > ERR_MAX_KEPT) q.shift();
  errKeptWrite(q);
}
/* Settings' list, the owner's alone: each message as it would go, with its own Send. Empty for anybody else. */
function errKeptHtml() {
  var q = errKept();
  if (!q.length || (typeof grdIsOwner === 'function' && !grdIsOwner())) return '';
  return '<p class="inv-note inv-mt-8">Error messages kept on this device, not sent. If the developer says a report could not be read, send its message from here. Figures and names are masked as far as the app can tell them: read each before it goes.</p>' +
    q.slice().reverse().map(function(k) {
      return '<div class="inv-kv inv-mt-8" data-err-kept="' + escHtml(k.id) + '"><div><div class="inv-kv-k">' + escHtml(formatTimestamp(k.at)) + ' &middot; ' + escHtml(k.type) + ' &middot; ' + escHtml(k.where) + '</div><div>' + escHtml(k.words) + '</div></div>' +
        '<div><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invErrSendKept" data-id="' + escHtml(k.id) + '">Send this message</button></div></div>';
    }).join('') +
    '<div class="inv-toolbar inv-mt-8"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invErrClearKept">Clear these messages</button></div>';
}
function errKeptRedraw() {
  var box = document.getElementById('errKeptBox');
  if (box) box.innerHTML = errKeptHtml();
}
/* The owner sends one: asked first, with the words shown; it goes as a report of its own that names the first. */
function errSendKept(id) {
  if (typeof grdIsOwner === 'function' && !grdIsOwner()) { if (typeof grdRefuse === 'function') grdRefuse('send an error’s message'); return; }
  var k = errKept().find(function(x) { return x.id === id; });
  if (!k) return;
  uiConfirm({ title: 'Send this message to the developer?', body: '“' + k.words + '”', okLabel: 'Send the message', cancelLabel: 'Keep it here' }).then(function(yes) {
    if (yes !== true) return;
    var ev = k.ev;
    ev.tags.follows = k.id;
    ev.event_id = errId();
    ev.timestamp = Date.now() / 1000;
    ev.exception.values[0].value = k.words;
    errKeptWrite(errKept().filter(function(x) { return x.id !== id; }));
    errKeptRedraw();
    if (navigator.onLine === false) { errQueue(ev); showToast('Offline: the message goes when this device is back online', 'info'); return; }
    errSend(ev).then(function() { showToast('Message sent to the developer'); }, function() { errQueue(ev); showToast('Could not send now: it goes when the connection is back', 'warning'); });
  });
}
function errAction(action, btn) {
  if (action === 'invErrSendKept') { errSendKept(btn.dataset.id); return true; }
  if (action === 'invErrClearKept') { errKeptWrite([]); errKeptRedraw(); showToast('Kept error messages cleared', 'info'); return true; }
  return false;
}

/* Settings → Data & device: reports from this device, on or off (per device, never on the book). */
function errSettingsHtml() {
  var set = !!errDsnParts(ERR_DSN);
  return '<label class="inv-field-check inv-mt-8"><input type="checkbox" class="inv-check" id="setErrReports" data-nodirty' +
    (errDeviceOff() ? '' : ' checked') + (set ? '' : ' disabled') + '> Send error reports from this device</label>' +
    '<p class="inv-note">' + (set
      ? 'When something goes wrong, the developer gets the kind of error, where in the code, the build, the screen and the browser. Never a record, a name or a figure, and not the error’s own message: where a report cannot say where in the code, the owner is shown the message and asked before it goes. The last five messages that did not go are kept on this device for the owner to send from here.'
      : 'Not connected to an error service yet: nothing is sent.') + '</p>' +
    '<div id="errKeptBox">' + (set ? errKeptHtml() : '') + '</div>';
}
function errOnChange(el) {
  if (!el || el.id !== 'setErrReports') return false;
  try { if (el.checked) localStorage.removeItem(ERR_OFF_KEY); else localStorage.setItem(ERR_OFF_KEY, '1'); } catch (e) { /* per device */ }
  showToast(el.checked ? 'Error reports on for this device' : 'Error reports off for this device', 'info');
  return true;
}
