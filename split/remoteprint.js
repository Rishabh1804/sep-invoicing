/* ===== REMOTE PRINT: THE OFFICE PRINTER =====
   Owner, 14 Oct 2026: "Let's add a remote print option for invoices and anything else that is printed", the office's Brother laser
   on the office Wi-Fi. A page served from github.io cannot reach a printer on the office network: a browser sends no job to a
   192.168… address from an https page, and has no raw socket for the printer's port. So printing at the office goes through the
   two things the app already has:
   - A JOB is the document exactly as previewed (the print view's body), its title and who sent it, written by any device with GitHub
     sync to the sync repository as one file under `print-queue/` (`prtSend`). The same token and the same registered-device rule as
     a push: a device that may not sync may not send.
   - THE PRINT STATION is one device in the office (a computer on the office Wi-Fi with the printer installed as its default), marked
     so on that device alone (`sep_inv_print_station`, never on the book). While the app is open there it reads the queue every
     few seconds, draws each job in the print view and prints it, oldest first, then deletes the job's file; the deletion is how the
     sender learns it printed. Started with Chrome's or Edge's --kiosk-printing, the browser prints to the default printer with no
     dialog; without it the station shows the print dialog for each job.
   The printer's own details (its name, its address on the Wi-Fi, the cartridge it takes) are the book's (`S.printer`), typed in
   Settings → Connections → Office printer: nothing about the shop is in this build. A job's HTML is the sender's own document and is
   cleaned before it is drawn (`prtClean`: no script, frame, form or handler survives). An invoice sent while Created is marked
   Printed on the sending device once the station has taken it, as Print marks it (print.js printMarkPrinted). */

var PRT_DIR = 'print-queue';
var PRT_STATION_KEY = 'sep_inv_print_station';
var PRT_SENT_KEY = 'sep_inv_print_sent';
var PRT_LOG_KEY = 'sep_inv_print_log';
var PRT_POLL_MS = 15000;          // the station's look at the queue while the app is in view
var PRT_SENT_POLL_MS = 20000;     // the sender's look while a job of its own waits
var PRT_LATE_MS = 3 * 60000;      // a job waiting longer than this says the station may be off
var PRT_MAX_HTML = 4 * 1024 * 1024;

function prtCfg() {
  var p = (S && S.printer) || {};
  return { on: !!p.on, name: p.name || '', address: p.address || '', cartridge: p.cartridge || '' };
}
function prtName() { var c = prtCfg(); return c.name || 'the office printer'; }
/* Whether this device can send a job, and if not, why (an empty string when it can). */
function prtSendBlocked() {
  if (!prtCfg().on) return 'Remote printing is off: Settings → Connections → Office printer.';
  if (typeof ghIsConfigured === 'function' && !ghIsConfigured()) return 'This device has no GitHub sync set up, which carries the job to the office: Settings → Connections → GitHub sync.';
  var b = typeof devSyncBlocked === 'function' ? devSyncBlocked() : '';
  return b || '';
}
function prtIsStation() { var s = loadJSON(PRT_STATION_KEY, null); return !!(s && s.on); }
function prtSetStation(on) { saveJSON(PRT_STATION_KEY, on ? { on: true, since: Date.now() } : { on: false }); }
function prtSent() { var l = loadJSON(PRT_SENT_KEY, []); return Array.isArray(l) ? l : []; }
function prtSentSave(l) { saveJSON(PRT_SENT_KEY, l.slice(0, 20)); }
function prtLog() { var l = loadJSON(PRT_LOG_KEY, []); return Array.isArray(l) ? l : []; }
function prtLogAdd(row) { var l = prtLog(); l.unshift(row); saveJSON(PRT_LOG_KEY, l.slice(0, 20)); }

/* The print view's Send button shows only where remote printing is on. */
function prtApply() {
  var b = document.getElementById('invPrintRemote');
  if (b) b.classList.toggle('inv-hidden', !prtCfg().on);
  prtStationArm();
}

function prtDirUrl(cfg) {
  var dir = cfg.path.split('/').slice(0, -1).filter(Boolean).concat([PRT_DIR]);
  return 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/' +
    dir.map(encodeURIComponent).join('/');
}
function prtJobUrl(cfg, id) { return prtDirUrl(cfg) + '/' + encodeURIComponent(id + '.json'); }
/* The jobs waiting: [{id, sha, name}], oldest first (an id starts with its time). An empty or missing folder is no jobs. */
async function prtList(cfg) {
  var rows;
  try { rows = await ghRequest(prtDirUrl(cfg) + '?ref=' + encodeURIComponent(cfg.branch)); }
  catch (e) { if (e.status === 404) return []; throw e; }
  return (Array.isArray(rows) ? rows : []).filter(function(r) { return r && r.type === 'file' && /\.json$/.test(r.name); })
    .map(function(r) { return { id: r.name.replace(/\.json$/, ''), sha: r.sha, name: r.name }; })
    .sort(function(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
}
async function prtDelete(cfg, job, message) {
  await ghRequest(prtJobUrl(cfg, job.id), { method: 'DELETE', body: { message: message, sha: job.sha, branch: cfg.branch } });
}

/* ---- Sending ---- */
function prtSenderName() {
  var u = typeof grdUser === 'function' ? grdUser() : null;
  var dev = typeof devName === 'function' ? devName() : (getGhConfig().deviceName || '');
  return [u && u.name, dev].filter(Boolean).join(' · ') || 'a device';
}
async function prtSend() {
  var why = prtSendBlocked();
  // Said as a toast: a dialog would open under the preview it was asked from.
  if (why) { showToast('Can’t send to ' + prtName() + '. ' + why, 'error'); return; }
  var body = document.getElementById('invPrintBody');
  var html = body ? body.innerHTML : '';
  if (!html.trim()) { showToast('Nothing in the preview to send', 'error'); return; }
  if (html.length > PRT_MAX_HTML) { showToast('This document is too large to send (over 4 MB): print it here', 'error'); return; }
  var title = String(document.title || 'Document').slice(0, 120);
  var id = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 7);
  var invId = typeof _printInvId !== 'undefined' ? _printInvId : null;
  var job = { kind: 'sep-print', v: 1, id: id, title: title, html: html, sentAt: Date.now(), sentBy: prtSenderName(),
    build: typeof APP_BUILD !== 'undefined' ? APP_BUILD : '' };
  var cfg = getGhConfig();
  var btn = document.getElementById('invPrintRemote');
  if (btn) btn.disabled = true;
  try {
    await ghRequest(prtJobUrl(cfg, id), { method: 'PUT', body: { message: 'Print at the office: ' + title, content: ghEncode(JSON.stringify(job)), branch: cfg.branch } });
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Not sent, so nothing will print: ' + (e.message || e) + ' Print it here, or send it again.', 'error');
    return;
  }
  if (btn) btn.disabled = false;
  // ID cards take their numbers when their sheet goes to paper (idcard.js): a sheet sent is a sheet printed.
  if (typeof idcPrintCommit === 'function') idcPrintCommit();
  var l = prtSent();
  l.unshift({ id: id, title: title, at: job.sentAt, invId: invId, state: 'waiting' });
  prtSentSave(l);
  showToast('Sent to ' + prtName() + ': it prints when the print station takes it', 'success');
  prtSentArm();
}

/* The sender's look at its own waiting jobs: a job gone from the queue was printed (or cancelled here, which says so). */
var _prtSentTimer = null;
function prtSentArm() {
  clearTimeout(_prtSentTimer);
  if (!prtSent().some(function(j) { return j.state === 'waiting'; })) return;
  _prtSentTimer = setTimeout(function() { prtSentCheck().catch(function() {}).then(prtSentArm); }, PRT_SENT_POLL_MS);
}
async function prtSentCheck() {
  var l = prtSent(), waiting = l.filter(function(j) { return j.state === 'waiting'; });
  if (!waiting.length || prtSendBlocked() || document.hidden) return;
  var queue = await prtList(getGhConfig()), there = {};
  queue.forEach(function(j) { there[j.id] = 1; });
  var printed = [];
  waiting.forEach(function(j) { if (!there[j.id]) { j.state = 'printed'; j.doneAt = Date.now(); printed.push(j); } });
  if (!printed.length) { prtRefreshSection(); return; }
  prtSentSave(l);
  printed.forEach(function(j) {
    // As Print marks a Created invoice Printed (print.js), the job taken marks it, on the device that sent it.
    var inv = j.invId && S.invoices.find(function(i) { return i.id === j.invId; });
    if (inv && inv.status !== 'cancelled' && getInvState(inv) === 'created' && (typeof grdCan !== 'function' || grdCan('billing'))) {
      invSetState(inv, 'printed'); saveState(); if (typeof invStateShown === 'function') invStateShown(inv.id);
    }
  });
  showToast(printed.length === 1 ? 'Printed at the office: ' + printed[0].title : printed.length + ' documents printed at the office', 'success');
  prtRefreshSection();
}
async function prtCancel(id) {
  var cfg = getGhConfig(), job = (await prtList(cfg)).find(function(j) { return j.id === id; });
  var l = prtSent(), mine = l.find(function(j) { return j.id === id; });
  if (!job) { if (mine && mine.state === 'waiting') { mine.state = 'printed'; mine.doneAt = Date.now(); prtSentSave(l); } showToast('Already taken by the print station', 'warning'); prtRefreshSection(); return; }
  await prtDelete(cfg, job, 'Print cancelled: ' + (mine ? mine.title : id));
  if (mine) { mine.state = 'cancelled'; mine.doneAt = Date.now(); prtSentSave(l); }
  showToast('Cancelled: it will not print', 'success');
  prtRefreshSection();
}

/* ---- The print station ---- */
/* A job's document, cleaned: what a print needs (the markup and its classes) and nothing that runs. */
function prtClean(html) {
  var doc = new DOMParser().parseFromString('<!doctype html><body>' + String(html || '') + '</body>', 'text/html');
  doc.body.querySelectorAll('script, iframe, object, embed, link, meta, base, form, input, button, textarea, select, style').forEach(function(el) { el.remove(); });
  doc.body.querySelectorAll('*').forEach(function(el) {
    Array.prototype.slice.call(el.attributes).forEach(function(a) {
      var n = a.name.toLowerCase(), v = String(a.value || '').replace(/\s/g, '').toLowerCase();
      if (/^on/.test(n) || n === 'data-action' || n === 'style' || ((n === 'href' || n === 'src' || n === 'xlink:href' || n === 'action') && /^(javascript|vbscript|data:text)/.test(v))) el.removeAttribute(a.name);
    });
  });
  return doc.body.innerHTML;
}
var _prtTimer = null, _prtBusy = false, _prtLast = null;
function prtStationArm() {
  clearTimeout(_prtTimer);
  if (!prtIsStation() || !prtCfg().on) return;
  _prtTimer = setTimeout(function() { prtStationTick().catch(function(e) { _prtLast = { at: Date.now(), error: e.message || String(e) }; }).then(prtStationArm); }, PRT_POLL_MS);
}
/* One look: the oldest job is printed and taken off the queue; the next look takes the next. Nothing is printed over a preview
   somebody has open here, or while the app cannot reach GitHub. */
async function prtStationTick() {
  // One window of the station prints: two open would print every job twice (the GitHub push's lock, github-sync.js).
  if (navigator.locks && navigator.locks.request) {
    return navigator.locks.request('sep-print-station', { ifAvailable: true }, function(lock) { return lock ? prtStationTickLocked() : null; });
  }
  return prtStationTickLocked();
}
async function prtStationTickLocked() {
  if (_prtBusy || !prtIsStation() || !prtCfg().on || prtSendBlocked()) return;
  var view = document.getElementById('invPrintView');
  if (view && view.classList.contains('inv-print-view-active')) return;
  _prtBusy = true;
  try {
    var cfg = getGhConfig(), queue = await prtList(cfg);
    _prtLast = { at: Date.now(), waiting: queue.length };
    var job = queue[0];
    if (!job) return;
    // Printed here already and its file not yet gone (a delete that failed): taken off, never printed twice.
    if (prtLog().some(function(r) { return r.id === job.id && r.state === 'printed'; })) {
      await prtDelete(cfg, job, 'Printed at the office (removed again)');
      return;
    }
    var text = await ghRequest(prtJobUrl(cfg, job.id) + '?ref=' + encodeURIComponent(cfg.branch), { raw: true });
    var data = null;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    if (!data || data.kind !== 'sep-print' || typeof data.html !== 'string') {
      await prtDelete(cfg, job, 'Print job not readable, removed by the print station');
      prtLogAdd({ id: job.id, title: job.name, at: Date.now(), state: 'unreadable' });
      return;
    }
    prtPrintHere(data);
    prtLogAdd({ id: job.id, title: data.title || '', from: data.sentBy || '', sentAt: data.sentAt || null, at: Date.now(), state: 'printed' });
    await prtDelete(cfg, job, 'Printed at the office: ' + String(data.title || job.id).slice(0, 120));
    showToast('Printed: ' + (data.title || 'a document') + (data.sentBy ? ', sent from ' + data.sentBy : ''), 'success');
    prtRefreshSection();
  } finally { _prtBusy = false; }
}
/* The job drawn in the print view and printed: with --kiosk-printing straight to the default printer, else through the dialog. */
function prtPrintHere(data) {
  var body = document.getElementById('invPrintBody'), view = document.getElementById('invPrintView');
  body.innerHTML = prtClean(data.html);
  view.classList.add('inv-print-view-active');
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = String(data.title || 'Document');
  printFit();
  try { window.print(); } finally { closePrintPreview(); }
}

/* ---- Settings → Connections → Office printer ---- */
function prtWhen(ts) { return ts ? formatDate(isoOf(new Date(ts))) + ' ' + new Date(ts).toTimeString().slice(0, 5) : ''; }
function prtStatusHtml() {
  var h = '';
  if (prtIsStation()) {
    var last = _prtLast;
    h += '<div class="inv-callout inv-callout-' + (last && last.error ? 'warning' : 'info') + ' inv-mb-8" data-prt-station>This device is the print station. ' +
      (last ? (last.error ? 'The last look at the queue failed: ' + escHtml(last.error) : 'Last looked ' + escHtml(prtWhen(last.at)) + ': ' + todoPlural(last.waiting, 'job') + ' waiting.') : 'It looks at the queue every few seconds while the app is open.') + '</div>';
    var log = prtLog().slice(0, 5);
    if (log.length) h += '<div class="inv-field-label">Printed here</div>' + log.map(function(r) {
      return '<div class="inv-row" data-prt-log><span class="inv-row-main"><span class="inv-row-title">' + escHtml(r.title || r.id) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(prtWhen(r.at) + (r.from ? ' · from ' + r.from : '')) + '</span></span>' +
        '<span class="inv-row-end"><span class="inv-dot inv-dot-' + (r.state === 'printed' ? 'ok' : 'warning') + '">' + (r.state === 'printed' ? 'printed' : 'not readable') + '</span></span></div>';
    }).join('');
  }
  var sent = prtSent().slice(0, 6);
  if (sent.length) h += '<div class="inv-field-label inv-mt-8">Sent from this device</div>' + sent.map(function(j) {
    var late = j.state === 'waiting' && Date.now() - j.at > PRT_LATE_MS;
    var word = j.state === 'printed' ? 'printed' : j.state === 'cancelled' ? 'cancelled' : late ? 'waiting: is the station on?' : 'waiting';
    var tone = j.state === 'printed' ? 'ok' : j.state === 'cancelled' ? 'neutral' : late ? 'warning' : 'info';
    return '<div class="inv-row" data-prt-sent="' + escHtml(j.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(j.title) + '</span>' +
      '<span class="inv-row-meta">' + escHtml('sent ' + prtWhen(j.at) + (j.doneAt ? ' · ' + j.state + ' ' + prtWhen(j.doneAt) : '')) + '</span></span>' +
      '<span class="inv-row-end"><span class="inv-dot inv-dot-' + tone + '">' + word + '</span>' +
      (j.state === 'waiting' ? '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPrtCancel" data-id="' + escHtml(j.id) + '">Cancel</button>' : '') + '</span></div>';
  }).join('');
  return h;
}
function prtRefreshSection() {
  var host = document.querySelector('[data-prt-status]');
  if (host) host.innerHTML = prtStatusHtml();
}
function prtFieldsHtml() {
  var c = prtCfg(), blocked = c.on ? prtSendBlocked() : '';
  var inp = function(id, v, ph) { return '<input class="inv-input" id="' + id + '" value="' + escHtml(v) + '" placeholder="' + ph + '" autocomplete="off">'; };
  return (blocked ? '<div class="inv-callout inv-callout-warning inv-mb-8" data-prt-blocked>' + escHtml(blocked) + '</div>' : '') +
    '<div class="inv-field"><label class="inv-field-check" for="setPrtOn"><input type="checkbox" id="setPrtOn" class="inv-check"' + (c.on ? ' checked' : '') + '>' +
    '<span>Send prints to the office printer</span></label>' +
    '<div class="inv-field-hint">Every print preview gets <strong>Send to office</strong> beside Print, on every device with GitHub sync.</div></div>' +
    '<div class="inv-fields">' + _sfg('Printer', 'setPrtName', inp('setPrtName', c.name, 'Brother DCP-B7535DW')) +
      _sfg('Its address on the office Wi-Fi', 'setPrtAddr', inp('setPrtAddr', c.address, '192.168.1.5'), 'For setting it up on the station computer') + '</div>' +
    _sfg('Toner cartridge', 'setPrtCart', inp('setPrtCart', c.cartridge, 'TN-B021')) +
    '<div class="inv-field"><label class="inv-field-check" for="setPrtStation"><input type="checkbox" id="setPrtStation" class="inv-check"' + (prtIsStation() ? ' checked' : '') + '>' +
    '<span>This device is the print station</span></label>' +
    '<div class="inv-field-hint">Tick it on the office computer the printer is installed on, and on no other device. Kept on this device only.</div></div>' +
    '<div data-prt-status>' + prtStatusHtml() + '</div>';
}
function prtSave() {
  if (!S.printer) S.printer = {};
  var on = document.getElementById('setPrtOn'), st = document.getElementById('setPrtStation');
  S.printer.on = !!(on && on.checked);
  S.printer.name = (_sVal('setPrtName') || '').trim();
  S.printer.address = (_sVal('setPrtAddr') || '').trim();
  S.printer.cartridge = (_sVal('setPrtCart') || '').trim();
  if (st) prtSetStation(st.checked);
  prtApply();
}
var PRT_SETTINGS_SEC = {
  title: 'Office printer',
  summary: function() {
    var c = prtCfg();
    if (!c.on) return 'off';
    return escHtml((c.name || 'on') + (prtIsStation() ? ' · this device is the print station' : ''));
  },
  body: function() { return prtFieldsHtml(); },
  why: 'A page on the internet cannot reach a printer on the office Wi-Fi, so a print sent from anywhere goes to the GitHub sync repository as a job, and the print station prints it. ' +
    'To set the station up, once, on the office computer: add the printer in Windows by its address on the Wi-Fi and make it the default printer; ' +
    'give the app’s shortcut (Chrome or Edge) <span class="inv-id">--kiosk-printing</span> at the end of its target, so it prints to the default printer with no dialog; open the app, tick ' +
    '<strong>This device is the print station</strong> here, and leave the app open. A job waits on GitHub until the station is on; the device that sent it says when it has printed, and a ' +
    'Created invoice sent this way is marked Printed then. On the office Wi-Fi a phone can also print straight from Print, through Android’s print service (Mopria or Brother’s plug-in).',
  save: function() { prtSave(); }
};

function prtBoot() {
  prtApply();
  prtSentArm();
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) return;
    if (prtIsStation()) prtStationTick().catch(function() {});
    prtSentCheck().catch(function() {});
  });
}

(function() {
  if (typeof SETTINGS_SECS === 'undefined' || typeof SETTINGS_GROUPS === 'undefined') return;
  SETTINGS_SECS.printer = PRT_SETTINGS_SEC;
  var g = SETTINGS_GROUPS.find(function(x) { return x.key === 'connections'; });
  if (g && g.secs.indexOf('printer') < 0) g.secs.push('printer');
})();
