/* ===== ADD: ONE DOOR FOR EVERYTHING THAT COMES IN =====
   Direction B (owner, 1 Oct 2026): the phone bar's Add, and on the desktop the sidebar's Add and the key A, open one
   sheet for whatever comes in. Most of the day is entering things, and the doors were spread over Home's quick actions,
   the one paste box, the challan scanner, the register photo and import buttons on five screens.

   The sheet saves nothing itself. Every route ends in the review or the form that already exists, so what comes in is
   shown beside what was read and saved only when the owner says so (the stock paste's contract, unchanged):
   - Paste: the text goes to the one paste box exactly as Home → Paste message sends it (relayOpen, then its read), which
     routes rolls to Staff, pickling, production and power messages to Production, and stock to Stock.
   - The clipboard: read only when the owner taps (the browser needs the tap and may refuse; a refusal is said), and named
     with the paste box's own readers (relayKind, parseRelayRoll, parseStockMessage, parseProdPaste): its date and a count.
   - A photo: Production's register reader (prodPhotoFiles), which reads a register page or the power log, refuses
     anything else, and offers a customer's challan to the challan scanner.
   - A file: routed by what is in it, never by its name (addFileKind): the bank's Excel 97–2003 statement, or JSON by its
     format (sep-stock, sep-production, sep-power, sep-payroll-paid, sep-att-register), a roster, or a backup, which replaces the whole book
     and so asks first exactly as Settings → Import does. Anything else is named, never guessed at.
   - By hand: each form opened on the job, through the openers the screens already have.
   Leaving the sheet for a route asks first about what was typed in it (the dialog guard) and about unsaved work on the
   screen under it (the leave guard, nav.js). Add is a layer, not a place: it has no address, and back closes it. */

var _addClip = null;   // what the clipboard held when it was last checked: {text, desc}

function addSvg(paths) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
}
var ADD_ICON = {
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>',
  photo: '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>',
  file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6M9 15l3-3 3 3"/>'
};
/* By hand, in the order of the day's work: [go, label, icon]. Each opens its form already on the job (addHand). */
var ADD_HAND = [
  ['challan', 'Challan', '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M12 8v8M8 12h8"/>'],
  ['invoice', 'Invoice', '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6M9 15h6"/>'],
  ['quote', 'Quotation', '<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z"/><path d="M7 7h.01"/>'],
  ['stock', 'Stock entry', '<path d="M9 3h6"/><path d="M10 3v6L4.5 19a1.5 1.5 0 001.3 2h12.4a1.5 1.5 0 001.3-2L14 9V3"/><path d="M7 15h10"/>'],
  ['production', 'Production', '<path d="M3 20h18M5 20V10l4 3V10l4 3V6l6 4v10"/>'],
  ['power', 'Power cut', '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'],
  ['attendance', 'Attendance', '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M17 11l2 2 4-4"/>'],
  ['payment', 'Payment', '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'],
  ['cheque', 'Cheque', '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 10h7M6 14h4M15 15l2-2 3 1"/>'],
  ['bill', 'Bill', '<path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>'],
  ['task', 'Task', '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>']
];

/* ---------- WhatsApp, opened where its messages are pasted ----------
   Owner, 7 Oct 2026: "When connected to the internet let's have a webpage loader in the app where it can directly open
   the web.whatsapp.com page or the installed app for us." WhatsApp Web cannot be shown inside the app: it answers
   `frame-ancestors https://*.whatsapp.com`, so a browser refuses to draw it in any other site's frame. So it opens in a
   window of its own (one, named, so a second tap returns to it rather than opening another) or in the installed app,
   from beside each paste box: Add, Staff → Paste message, and Today's inputs. Online only: offline the links are hidden
   and a line says why, and the online and offline events switch them in place. */
var WA_WEB = 'https://web.whatsapp.com/';
var WA_WINDOW = 'sepWhatsApp';
/* The phone this is: Android opens the app by its package (Chrome goes to the Play Store when it is not installed), an
   iPhone by WhatsApp's own scheme; anything else is a computer, which has the web page and, on Windows or a Mac with
   the desktop app installed, the app by the same scheme. */
function waDevice() {
  var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}
function waLinks() {
  var d = waDevice();
  if (d === 'android') return [['app', 'Open WhatsApp', 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.whatsapp;end']];
  if (d === 'ios') return [['app', 'Open WhatsApp', 'whatsapp://']];
  return [['web', 'WhatsApp Web', WA_WEB], ['app', 'Desktop app', 'whatsapp://']];
}
function waOnline() { return typeof navigator === 'undefined' || navigator.onLine !== false; }
function waLinksHtml(where) {
  var on = waOnline();
  return '<span class="inv-toolbar inv-toolbar-tight" data-wa="' + escHtml(where) + '">' + waLinks().map(function(l) {
    return '<a class="inv-btn inv-btn-secondary inv-btn-sm' + (on ? '' : ' inv-hidden') + '" data-wa-go="' + l[0] + '" href="' + escHtml(l[2]) + '"' +
      (l[0] === 'web' ? ' target="' + WA_WINDOW + '"' : '') + '>' + escHtml(l[1]) + '</a>';
  }).join('') + '<span class="inv-row-meta' + (on ? ' inv-hidden' : '') + '" data-wa-off>Offline: WhatsApp opens once you are online</span></span>';
}
function waSync() {
  var on = waOnline();
  document.querySelectorAll('[data-wa]').forEach(function(box) {
    box.querySelectorAll('[data-wa-go]').forEach(function(a) { a.classList.toggle('inv-hidden', !on); });
    var off = box.querySelector('[data-wa-off]');
    if (off) off.classList.toggle('inv-hidden', on);
  });
}
window.addEventListener('online', waSync);
window.addEventListener('offline', waSync);

/* ---------- The sheet ---------- */
function addOpen() {
  if (document.querySelector('[data-add-sheet]')) return;
  _addClip = null;
  var row = function(sec, action, icon, title, meta) {
    return '<button type="button" class="inv-row inv-row-2" data-action="' + action + '" data-add-sec="' + sec + '">' +
      '<span class="inv-row-lead">' + addSvg(icon) + '</span><span class="inv-row-main"><span class="inv-row-title">' + title + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + meta + '</span></span></button>';
  };
  var h = '<div class="inv-dialog" data-add-sheet role="dialog" aria-modal="true" aria-labelledby="addTitle">' +
    dialogHeadHtml('<span id="addTitle">Add</span>') +
    // 1. A WhatsApp message, for the one paste box.
    '<div class="inv-panel" data-add-sec="paste"><div class="inv-panel-head"><span class="inv-panel-title">Paste a WhatsApp message</span>' + waLinksHtml('add') + '</div>' +
    '<div class="inv-field inv-mt-8"><label class="inv-field-label" for="addPasteText">Rolls, stock, pickling loads, production, power cuts</label>' +
    '<textarea id="addPasteText" class="inv-textarea inv-textarea-mono" rows="4" spellcheck="false" placeholder="Copy the message in WhatsApp and paste it here. Several at once is fine."></textarea>' +
    '<div class="inv-field-error inv-hidden" id="addPasteErr">Paste the message first.</div></div>' +
    '<button type="button" class="inv-btn inv-btn-primary inv-btn-block" data-action="invAddRead">Read it</button></div>' +
    // 2–4. The clipboard (read only on a tap), a photo and a file. The pickers sit first and unseen, so the last row is
    // the panel's last child and draws no rule under it; picking a file is not typing (data-nodirty).
    '<div class="inv-panel inv-panel-flush">' +
    '<input type="file" id="addPhotoInput" class="inv-hidden" accept="image/*" multiple data-nodirty tabindex="-1" aria-hidden="true">' +
    '<input type="file" id="addFileInput" class="inv-hidden" accept=".xls,.xlsx,.json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json" data-nodirty tabindex="-1" aria-hidden="true">' +
    row('clipboard', 'invAddClip', ADD_ICON.clipboard, 'Check the clipboard', 'What you copied, read only when you tap here') +
    '<div class="inv-panel-body inv-hidden" id="addClipOut" aria-live="polite"></div>' +
    row('photo', 'invAddPhoto', ADD_ICON.photo, 'Photo', 'A challan or a register page: read by Gemini, checked by you') +
    row('file', 'invAddFile', ADD_ICON.file, 'File', 'A bank statement (.xls or .xlsx), a backup, or an export of stock, production, power, payroll or the roster') +
    '</div>' +
    // 5. By hand: every form, opened on the job.
    '<div class="inv-panel" data-add-sec="hand"><div class="inv-panel-head"><span class="inv-panel-title">By hand</span></div>' +
    '<div class="inv-btn-grid inv-mt-8" role="group" aria-label="By hand">' + ADD_HAND.map(function(x) {
      return '<button type="button" class="inv-btn inv-btn-secondary" data-action="invAddHand" data-go="' + x[0] + '">' + addSvg(x[2]) + '<span>' + x[1] + '</span></button>';
    }).join('') + '</div></div>' +
    '<div class="inv-note">Whatever comes in is read, shown to you beside what was read, and saved only when you say so.</div></div>';
  var scrim = dialogOpen(h, { dismiss: true });
  // On a keyboard the box is where a message is pasted (Ctrl+V, then Ctrl+Enter); a touch screen keeps its keyboard down
  // until the box is tapped, since the sheet is as often opened for a photo or a form.
  if (!touchScreen()) { var ta = scrim && scrim.querySelector('#addPasteText'); if (ta) ta.focus(); }
}

/* Leaving the sheet for a route. What is typed in it is asked about first, unless that text is what is being read
   (opts.own); then unsaved work on the screen under it, unless the route stays on that screen (opts.stay: Settings, a
   backup's own question). Only then does the sheet close and the route run. */
function addGo(fn, opts) {
  opts = opts || {};
  if (!opts.own && dialogsTypedAsk(function() { addGo(fn, opts); })) return;
  (opts.stay ? Promise.resolve(true) : navLeaveOk()).then(function(ok) {
    if (!ok) return;
    addClose();
    fn();
  });
}
function addClose() {
  var sheet = document.querySelector('[data-add-sheet]'), scrim = sheet && sheet.closest('.inv-scrim-dialog');
  if (!scrim) return;
  delete scrim.dataset.typed;
  dialogCloseScrim(scrim);
}

/* ---------- 1. Paste ---------- */
function addRead() {
  var ta = document.getElementById('addPasteText'), err = document.getElementById('addPasteErr');
  var text = ta ? ta.value : '';
  if (!text.trim()) {
    if (err) err.classList.remove('inv-hidden');
    if (ta) { ta.setAttribute('aria-invalid', 'true'); ta.focus(); }
    return;
  }
  addGo(function() { addPaste(text); }, { own: true });
}
/* The one paste box, as Home → Paste message reaches it: the box opened holding the text, then its own read, which
   routes, reviews and saves as it always has. */
function addPaste(text) {
  relayOpen(text);
  relayRead();
}

/* ---------- 2. The clipboard ---------- */
function addClipCheck() {
  var out = document.getElementById('addClipOut');
  if (!out) return;
  var show = function(html) { if (!out.isConnected) return; out.innerHTML = html; out.classList.remove('inv-hidden'); };
  var refused = function() {
    _addClip = null;
    show('<div class="inv-callout inv-callout-warning" data-add-clip="refused">The browser did not allow reading the clipboard: paste it in the box above.</div>');
  };
  var cb = navigator.clipboard, p = null;
  if (!cb || typeof cb.readText !== 'function') { refused(); return; }
  try { p = cb.readText(); } catch (e) { refused(); return; }
  Promise.resolve(p).then(function(text) {
    text = String(text == null ? '' : text);
    if (!text.trim()) {
      _addClip = null;
      show('<div class="inv-callout" data-add-clip="empty">The clipboard holds no text. Copy the message in WhatsApp, then check again.</div>');
      return;
    }
    // A reader failing on a shape it has never seen leaves the text unnamed rather than the check unanswered.
    var d;
    try { d = addDescribe(text); } catch (e) { d = { items: [], where: '', lines: text.split('\n').filter(function(l) { return l.trim(); }).length }; }
    _addClip = { text: text, desc: d };
    show(addClipHtml(d, text));
  }, refused);
}
function addClipHtml(d, text) {
  var quote = '<div class="inv-quote inv-mt-8">' + escHtml(addQuoteLines(text)) + '</div>';
  if (!d.items.length) {
    return '<div class="inv-callout" data-add-clip="other"><div>On the clipboard: ' + escHtml(todoPlural(d.lines, 'line')) +
      ' of text that is not a roll, a stock message or a production message. Paste it in the box above to read it anyway.</div>' + quote + '</div>';
  }
  return '<div class="inv-callout inv-callout-info" data-add-clip="ok"><div>On the clipboard' + (d.items.length > 1 ? ': ' + d.items.length + ' messages' : '') + '</div>' +
    d.items.map(function(it) {
      return '<div class="inv-row inv-row-2 inv-row-auto" data-add-clip-item="' + escHtml(it.kind) + '"><span class="inv-row-main">' +
        '<span class="inv-row-title">' + escHtml(it.title) + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(it.meta) + '</span></span></div>';
    }).join('') + quote +
    '<div class="inv-toolbar"><button type="button" class="inv-btn inv-btn-secondary" data-action="invAddClipRead">Read it</button>' +
    '<span class="inv-note" data-add-clip-where>Read in ' + escHtml(d.where) + ' and checked there before anything is saved' + escHtml(addAlsoText(d.also)) + '.</span></div></div>';
}
/* What a roll's check hands on (relay.js: Read in Production, Read in Stock), said after where the roll is read. */
var ADD_ALSO_WHAT = { Production: 'the production', Stock: 'the stock message' };
function addAlsoText(also) {
  if (!also || !also.length) return '';
  return '; ' + also.map(function(w) { return ADD_ALSO_WHAT[w]; }).join(' and ') + (also.length > 1 ? ' are' : ' is') + ' read in ' + also.join(' and ') + ' from there';
}
/* The first lines as copied, so what is on the clipboard can be told at a glance. */
function addQuoteLines(text) {
  var lines = String(text).split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
  var shown = lines.slice(0, 3).map(function(l) { return l.length > 80 ? l.slice(0, 79) + '…' : l; });
  return shown.join('\n') + (lines.length > 3 ? '\n… ' + todoPlural(lines.length - 3, 'more line') : '');
}

/* What a text is, named with the paste box's own readers and routed the way its read routes it (relayRead): rolls go to
   Staff; otherwise pickling, production and power messages go to Production, then a stock message to Stock. Pure but for
   the book's roster, clients and stock lines, which the readers take. */
var ADD_PROD_TITLE = { pickling: 'Pickling loads', production: 'Barrel production', runs: 'Production by slot', power: 'Power cuts' };
var ADD_PROD_ITEM = [['pickled', 'load'], ['arrived', 'incoming load'], ['plated', 'run'], ['downtime', 'power cut']];
function addDescribe(text) {
  var d = { items: [], where: '', also: [], lines: String(text).split('\n').filter(function(l) { return l.trim(); }).length };
  var rolls = 0, stock = 0, prod = 0, rollProd = 0, roster = null, groups = {}, msgs = relaySplit(text), cks = [];
  msgs.forEach(function(m) {
    var k = relayKind(m.text);
    if (k === 'checkin') { var c = ckParse(m.text); if (c) cks.push(c); return; }
    if (k === 'in' || k === 'out') {
      rolls++;
      roster = roster || relayRoster({});
      d.items.push(addDescRoll(parseRelayRoll(m.text, roster, m.sentOn)));
    }
  });
  // The stock as the paste box hands it to Stock: each stock message, and the stock written under a roll (relayStockParts).
  relayStockParts(msgs).forEach(function(t) {
    stock++;
    d.items.push(addDescStock(parseStockMessage(t)));
  });
  (typeof parseProdPaste === 'function' ? parseProdPaste(text, prodCtx()) : []).forEach(function(m) {
    if (!m.read || !m.read.items.length) return;
    if (m.kind === 'roll') { rollProd++; return; }
    prod++;
    var g = groups[m.kind] || (groups[m.kind] = { kind: m.kind, n: 0, dates: [], counts: {} });
    g.n++;
    if (m.read.date) g.dates.push(m.read.date);
    m.read.items.forEach(function(it) { g.counts[it.kind] = (g.counts[it.kind] || 0) + 1; });
  });
  Object.keys(ADD_PROD_TITLE).forEach(function(k) { if (groups[k]) d.items.push(addDescProd(groups[k])); });
  if (cks.length) d.items.push({ kind: 'checkin', title: 'Office QR check-ins', meta: addWhen(cks.map(function(c) { return c.iso; })) + ' · ' + todoPlural(cks.length, 'check-in') });
  d.where = rolls || cks.length ? 'Staff' : prod ? 'Production' : stock ? 'Stock' : '';
  // A roll's check offers what else came with it (Read in Production, Read in Stock): said here too. It said Staff alone,
  // and the stock beside a roll was never read (QA3-10).
  if (rolls) d.also = [prod || rollProd ? 'Production' : '', stock ? 'Stock' : ''].filter(Boolean);
  return d;
}
function addWhen(dates) {
  var s = dates.filter(Boolean).sort();
  if (!s.length) return 'no date';
  return stockShortDate(s[0]) + (s[s.length - 1] !== s[0] ? ' – ' + stockShortDate(s[s.length - 1]) : '');
}
function addDescRoll(r) {
  var people = {}, unknown = 0, blocks = 0, shift = 0;
  r.lines.forEach(function(ln) {
    if (ln.role === 'name' && ln.person != null) people[ln.person] = true;
    else if (ln.role === 'unknown') unknown++;
  });
  Object.keys(r.days).forEach(function(iso) { (r.days[iso].extra || []).forEach(function(x) { if (x.kind === 'block') blocks++; else shift++; }); });
  var bits = [todoPlural(Object.keys(people).length + unknown, 'name')];
  if (blocks) bits.push(todoPlural(blocks, 'EXTRA block'));
  if (shift) bits.push(shift + ' EXTRA on the general shift');
  return { kind: r.kind, title: r.kind === 'out' ? 'An out-time roll' : 'An in-time roll', meta: addWhen([r.date]) + ' · ' + bits.join(', ') };
}
function addDescStock(p) {
  return { kind: 'stock', title: 'A stock message', meta: addWhen([p.from, p.to]) + ' · ' + todoPlural(p.lines.length, 'line') };
}
function addDescProd(g) {
  var bits = ADD_PROD_ITEM.filter(function(x) { return g.counts[x[0]]; }).map(function(x) { return todoPlural(g.counts[x[0]], x[1]); });
  return { kind: g.kind, title: ADD_PROD_TITLE[g.kind], meta: addWhen(g.dates) + (g.n > 1 ? ' · ' + g.n + ' messages' : '') + (bits.length ? ' · ' + bits.join(', ') : '') };
}

/* ---------- 3. A photo ---------- */
function addPhotoPick() {
  // The key is checked before the picker opens: an awaited step before click() loses the picker on iOS (prodPhotoPick).
  if (!getApiKey()) { addNoKey(); return; }
  var inp = document.getElementById('addPhotoInput');
  if (!inp) return;
  inp.value = '';
  inp.click();
}
function addNoKey() {
  uiConfirm({ title: 'Gemini key needed', okLabel: 'Open Settings',
    body: 'Reading a photo uses the Gemini key in Settings → Connections (free from aistudio.google.com). A challan or the day’s production can be entered by hand without one.' })
    .then(function(ok) { if (ok) addGo(function() { openSettings('geminiKey'); }, { stay: true }); });
}
/* Production's photo flow, with the files picked: it reads a register page or the power log, and a customer's challan
   it refuses and offers to the challan scanner (invProdToScanner). */
function addPhotoFiles(files) {
  var list = Array.prototype.slice.call(files || []);
  if (!list.length) return;
  if (!getApiKey()) { addNoKey(); return; }
  addGo(function() { switchTab('pageProduction'); prodPhotoFiles(list); });
}

/* ---------- 4. A file ---------- */
function addFilePick() {
  var inp = document.getElementById('addFileInput');
  if (!inp) return;
  inp.value = '';
  inp.click();
}
function addFileGot(file) {
  if (!file) return;
  file.arrayBuffer().then(function(buf) { addFileRoute(file, buf); }, function(err) {
    uiAlert({ title: 'The file could not be read', body: (file.name || 'The file') + ': ' + ((err && err.message) || 'the browser could not read it') + '.' });
  });
}
/* What a file is, from its bytes: the name it was saved under says nothing (a statement renamed .json is still a
   statement, and a backup renamed .xls is still a backup). */
var ADD_OLE_SIG = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
function addFileKind(buf) {
  var u8 = new Uint8Array(buf, 0, Math.min(buf.byteLength, 16));
  var at = function(sig, from) { from = from || 0; return u8.length >= from + sig.length && sig.every(function(b, i) { return u8[from + i] === b; }); };
  if (at(ADD_OLE_SIG)) return { kind: 'xls' };
  // A zip is an .xlsx when it holds a workbook: a statement saved from Excel (owner, 8 Oct 2026), read as the .xls is.
  if (at([0x50, 0x4B, 0x03, 0x04])) return { kind: typeof xlsxIsWorkbook === 'function' && xlsxIsWorkbook(buf) ? 'xls' : 'zip' };
  if (at([0x25, 0x50, 0x44, 0x46])) return { kind: 'pdf' };
  if (at([0xFF, 0xD8, 0xFF]) || at([0x89, 0x50, 0x4E, 0x47]) || at([0x47, 0x49, 0x46, 0x38]) || (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) ||
    at([0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69], 4)) return { kind: 'image' };
  var text;
  try { text = new TextDecoder('utf-8').decode(buf); } catch (e) { return { kind: 'binary' }; }
  return addTextKind(text);
}
/* What a file read as text is: a screen's own Import reads it that way. */
function addTextKind(text) {
  var t = String(text == null ? '' : text).replace(/^\ufeff/, '').trim();
  if (/^[[{]/.test(t)) {
    try { return { kind: 'json', text: t, obj: JSON.parse(t) }; } catch (e) { return { kind: 'badjson', error: e.message }; }
  }
  if (/^</.test(t)) return { kind: 'html' };
  return { kind: t ? 'text' : 'empty' };
}
/* Which import a JSON file is for, by its format (the payroll file names it as its kind); a backup is the book itself. */
function addJsonWhat(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (Array.isArray(obj)) {
    return obj.length && obj.every(function(r) { return r && typeof r === 'object' && typeof r.name === 'string' && ('comp' in r || 'dayRate' in r || 'hourRate' in r || 'area' in r); }) ? 'roster' : '';
  }
  var f = obj.format || obj.kind;
  if (f === 'sep-stock') return 'stock';
  // A sep-production file carrying `power` is soma-internal's power history: its cuts and the bills, through Power's import.
  if (f === 'sep-production') return obj.power && typeof obj.power === 'object' ? 'power' : 'production';
  if (f === 'sep-power') return 'power';
  if (f === 'sep-payroll-paid') return 'payroll';
  if (f === 'sep-att-register') return 'register';
  if (f === 'sep-people') return 'people';
  if (f === 'sep-plant') return 'plant';
  if (f === 'sep-kb' || (!f && Array.isArray(obj.articles))) return 'kb';
  // This app's own bank export: its cheques received are taken from it (TM3b), never its statement rows.
  if (f === 'sep-bank') return 'bank';
  if (obj.company && obj.clients) return 'backup';
  if (Array.isArray(obj.staff)) return 'roster';
  return '';
}
/* What each file's import asks of the guard (guard.js), as its own screen's Import does: the permission and its words, and
   the page it lands on (a role that may not open the page is refused there too). A statement is Finance's, imported there
   with no re-ask; the floor's records are P1 imports, and the payroll as paid is a payment. A backup replaces the book
   and its IDs with it: the owner's alone (`users`, grdBookAsk), never the Imports switch's (the QA audit, QA4-9). */
var ADD_FILE_GUARD = {
  xls: { page: 'pageFinance' },
  stock: { grp: 'imports', what: 'import stock records', page: 'pageStock' },
  production: { grp: 'imports', what: 'import production history', page: 'pageProduction' },
  power: { grp: 'imports', what: 'import power history', page: 'pagePower' },
  payroll: { grp: 'payments', what: 'import the payroll as paid', page: 'pageStaff' },
  roster: { grp: 'imports', what: 'import a roster', page: 'pageStaff' },
  register: { grp: 'imports', what: 'import a register', page: 'pageStaff' },
  people: { grp: 'payments', what: 'import workers’ details', page: 'pageStaff' },
  plant: { grp: 'settings', what: 'import the plant register', page: 'pageProduction' },
  bank: { grp: 'payments', what: 'import cheques received', page: 'pageFinance' },
  // Knowledge's own Import is the owner's and asks the PIN again whatever the window (knowledge.js kbImport).
  kb: { grp: 'imports', what: 'import knowledge', page: 'pageKnow', owner: true, always: true },
  backup: { grp: 'users', what: 'import a backup' }
};
/* The guard's word on a file before anything is read into the book: true to go on. With the guard off, always. */
async function addFileGuardOk(key) {
  var gd = ADD_FILE_GUARD[key];
  if (!gd || typeof grdOn !== 'function' || !grdOn()) return true;
  if (gd.page && typeof grdSees === 'function' && !grdSees(gd.page)) {
    await uiAlert({ title: 'Not for this ID', body: 'Your ID does not open ' + (typeof wsPageName === 'function' ? wsPageName(gd.page) : 'that screen') + ', so this file cannot be imported here. Ask the owner.' });
    return false;
  }
  if (gd.owner && typeof grdIsOwner === 'function' && !grdIsOwner()) { grdRefuse(gd.what); return false; }
  if (!gd.grp) return true;
  return (!gd.always && grdOk(gd.grp)) || await guardAsk(gd.grp, gd.what);
}
async function addFileRoute(file, buf) {
  var name = file.name || '', k = addFileKind(buf);
  if (k.kind === 'image') { addPhotoFiles([file]); return; }
  if (k.kind === 'xls') {
    if (!(await addFileGuardOk('xls'))) return;
    addGo(function() { finSetTab('bank'); switchTab('pageFinance'); bankImportBuf(buf, name); });
    return;
  }
  var what = k.kind === 'json' ? addJsonWhat(k.obj) : '';
  if (what && !(await addFileGuardOk(what))) return;
  var go = what && addFileGo(what, k, name);
  if (go) { addGo(go, { stay: what === 'backup' }); return; }
  uiAlert({ title: 'Not a file the app imports', body: (name || 'The file') + ' is ' + addFileWords(k) +
    '. Add takes a bank statement (.xls or .xlsx), a backup, or an export of stock, production, power, the plant register, payroll, the roster, workers’ details, the attendance register, the knowledge base or the bank (its cheques received).' });
}
/* Where each kind of file is imported, opened on the screen and view that import it. */
function addFileGo(what, k, name) {
  return {
    stock: function() { _stockView = 'list'; switchTab('pageStock'); stockImportText(k.text, name); },
    production: function() { prodSetTab('entries'); _prodView = 'main'; switchTab('pageProduction'); prodImportText(k.text, name); },
    power: function() { powerSetTab('cuts'); switchTab('pagePower'); powerImportData(k.obj, name); },
    payroll: function() { _attView = 'pay'; switchTab('pageStaff'); payrollImportText(k.text, name); },
    roster: function() { _attView = 'roster'; switchTab('pageStaff'); importRosterText(k.text, name); },
    register: function() { _attView = 'register'; switchTab('pageStaff'); aregImportText(k.text, name); },
    people: function() { _attView = 'roster'; switchTab('pageStaff'); pplImportText(k.text); },
    plant: function() { prodSetTab('equipment'); _prodView = 'main'; switchTab('pageProduction'); pltImportText(k.text, name); },
    kb: function() { kbSetTab('library'); switchTab('pageKnow'); kbImportData(k.obj, name); },
    bank: function() { finSetTab('receipts'); switchTab('pageFinance'); bankChequesImport(k.obj, name); },
    // It replaces the whole book: Settings → Import's own question is the guard, and Cancel leaves everything as it was.
    backup: function() { importDataText(k.text, name); }
  }[what] || null;
}
/* What each kind of file is called, and the screen whose Import takes it. */
var ADD_FILE_KINDS = {
  stock: { title: 'A stock file', noun: 'a stock file (sep-stock)', page: 'pageStock' },
  production: { title: 'A production file', noun: 'a production file (sep-production)', page: 'pageProduction', view: 'Entries' },
  power: { title: 'A power history file', noun: 'a power history file (its cuts and bills)', page: 'pagePower', view: 'Cuts' },
  payroll: { title: 'A payroll file', noun: 'the payroll as paid (sep-payroll-paid)', page: 'pageStaff', view: 'Pay' },
  roster: { title: 'A roster', noun: 'a roster', page: 'pageStaff', view: 'Roster' },
  register: { title: 'An attendance register', noun: 'an attendance register (sep-att-register)', page: 'pageStaff', view: 'Register' },
  people: { title: 'Workers’ details', noun: 'a file of workers’ details (sep-people)', page: 'pageStaff', view: 'Roster' },
  plant: { title: 'A plant register file', noun: 'a plant register file (sep-plant)', page: 'pageProduction', view: 'Equipment' },
  kb: { title: 'A knowledge file', noun: 'a knowledge file (sep-kb)', page: 'pageKnow', view: 'Library' },
  bank: { title: 'A bank export', noun: 'this app’s bank export (sep-bank), whose cheques received are taken', page: 'pageFinance', view: 'Receivables' },
  backup: { title: 'A backup', noun: 'a backup of the whole book', where: 'Settings → Data & device' },
  xls: { noun: 'a bank statement' }
};
function addFileWhere(what) {
  var x = ADD_FILE_KINDS[what];
  return !x ? '' : x.where || (typeof wsPageName === 'function' ? wsPageName(x.page) : x.page) + (x.view ? ' → ' + x.view : '');
}
/* A file handed to one screen's Import that is another screen's (owner, 9 Oct 2026: the day's production file, imported on
   Production → Equipment, was refused as "Not a plant file", with no way on). Each screen's Import asks this before it
   refuses: the file is named for what it is and where it is imported, and Import it there takes it through Add → File's
   own route, the guard's question included. `src` is the file's text, its bytes, or what was read from it; `here` the
   kind or kinds this Import takes. True when the file is another screen's, and the caller stops: its refusal is not shown. */
function addFileElsewhere(src, name, here) {
  var k = src instanceof ArrayBuffer ? addFileKind(src) : typeof src === 'string' ? addTextKind(src)
    : src && typeof src === 'object' ? { kind: 'json', obj: src, text: JSON.stringify(src) } : null;
  var what = k && k.kind === 'json' ? addJsonWhat(k.obj) : '', mine = [].concat(here || []);
  if (!what || mine.indexOf(what) >= 0 || !addFileGo(what, k, name)) return false;
  var it = ADD_FILE_KINDS[what] || {}, at = ADD_FILE_KINDS[mine[0]];
  uiConfirm({ title: it.title || 'Another screen’s file',
    body: (name || 'This file') + ' is ' + (it.noun || 'another screen’s file') + (at ? ', not ' + at.noun : '') + '. It is imported on ' + addFileWhere(what) + '.',
    okLabel: 'Import it there' })
    .then(function(ok) { return ok && addFileGuardOk(what); })
    .then(function(ok) { if (ok) addGo(addFileGo(what, k, name), { stay: what === 'backup' }); });
  return true;
}
/* What arrived, in words, for a file no import takes. */
function addFileWords(k) {
  if (k.kind === 'json') {
    var o = k.obj, f = o && !Array.isArray(o) ? o.format || o.kind : '';
    if (Array.isArray(o)) return 'a JSON list of ' + todoPlural(o.length, 'entry', 'entries') + ', not one the app imports';
    var keys = o && typeof o === 'object' ? Object.keys(o) : [];
    return 'a JSON file' + (f ? ' marked ' + f : '') + (keys.length ? ' with keys ' + keys.slice(0, 8).join(', ') + (keys.length > 8 ? ' and ' + (keys.length - 8) + ' more' : '') : ', empty') + ', not one the app imports';
  }
  return {
    zip: 'a zip file with no Excel workbook in it; a bank statement is read from the .xls the bank exports, or the .xlsx it is saved as',
    pdf: 'a PDF; a photo of the page can be read with Photo',
    html: 'a web page (HTML), not the bank’s Excel 97–2003 statement',
    badjson: 'JSON that could not be read (' + (k.error || 'not valid') + ')',
    text: 'a text file; a WhatsApp message is pasted in the box at the top',
    empty: 'empty'
  }[k.kind] || 'a file the app cannot read';
}

/* ---------- 5. By hand ---------- */
function addHand(go) {
  var fn = {
    challan: function() { homeQuick('challan'); },
    invoice: function() { createNew(); },
    quote: function() { qtOpenForm(null); },
    stock: function() { homeQuick('stock'); },
    production: function() { switchTab('pageProduction'); prodOpenHand(null); },
    power: function() { powerAddCut(); },
    attendance: function() { homeQuick('attendance'); },
    payment: addPayment,
    // A cheque received (TM3b): its form is a dialog of its own, over the screen Add was opened on.
    cheque: function() { bankChequeFormOpen(null); },
    bill: addBill,
    task: function() { homeQuick('task'); }
  }[go];
  if (fn) addGo(fn);
}
/* Staff → Pay on this pay week, its payment form in sight with the worker to pick first. */
function addPayment() {
  _attDate = localDateStr();
  _attWeekStart = attWeekStartOf(_attDate);
  _attView = 'pay';
  switchTab('pageStaff');
  var form = document.getElementById('payForm'), who = document.getElementById('payWorker');
  if (form) uiRevealEl(form);
  if (who) { try { who.focus({ preventScroll: true }); } catch (e) { /* focus is a convenience */ } }
}
/* Money → Payments, the bill form open on the latest closed month with no electricity bill (else this month). Search's
   Add a bill opens it here too. A role that may not open Money is refused by todoGo, and nothing is focused. */
function addBill() {
  todoGo({ kind: 'bills', month: addBillMonth() });
  if (navPageOf() !== 'pageFinance') return;
  var amt = costBillRoot('finance').querySelector('#costBillAmount');
  if (amt) { uiRevealEl(amt); try { amt.focus({ preventScroll: true }); } catch (e) { /* focus is a convenience */ } }
}
function addBillMonth() {
  var have = {};
  costBills().forEach(function(b) { if (b.kind === 'power' && !b.voided) have[b.month] = true; });
  var free = billsPrevMonths(12).filter(function(m) { return !have[m]; });
  return free.length ? free[0] : localDateStr().slice(0, 7);
}

/* ---------- Doing ---------- */
function addAction(action, btn) {
  switch (action) {
    case 'invAddOpen': addOpen(); return true;
    case 'invAddRead': addRead(); return true;
    case 'invAddClip': addClipCheck(); return true;
    case 'invAddClipRead': {
      if (!_addClip) return true;
      var text = _addClip.text;
      addGo(function() { addPaste(text); });
      return true;
    }
    case 'invAddPhoto': addPhotoPick(); return true;
    case 'invAddFile': addFilePick(); return true;
    case 'invAddHand': addHand(btn.dataset.go); return true;
  }
  return false;
}
document.addEventListener('change', function(e) {
  var t = e.target;
  if (t && t.id === 'addPhotoInput') addPhotoFiles(t.files);
  else if (t && t.id === 'addFileInput') addFileGot(t.files && t.files[0]);
});
/* The key A opens Add on the desktop, never from a field and never over a layer (Backspace's guard, nav.js); Ctrl+Enter
   in the sheet's box reads it. */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target && e.target.id === 'addPasteText') { e.preventDefault(); addRead(); return; }
  if ((e.key !== 'a' && e.key !== 'A') || e.altKey || e.ctrlKey || e.metaKey || e.repeat || e.isComposing || e.defaultPrevented) return;
  var t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if (!_isDesktop || !S || !document.body.classList.contains('inv-booted') || navLayerOpen()) return;
  e.preventDefault();
  addOpen();
});
