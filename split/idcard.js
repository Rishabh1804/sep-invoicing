/* ===== ID CARDS, and the scanner that reads them into the day =====
   Owner, 7 Oct 2026 (docs/WORKERS_AND_PLANT.md, W4): *"Every employee must also have an ID Card, which I can take a print out
   later, if needed. That becomes a tag that every worker gets, we will have a QR code scanner in it that should be linked and
   scannable to the attendance logger in the app."*

   - A card number per worker (`w.card`, SEP-0007), given the first time a card is printed and never given again: a worker who
     leaves keeps theirs, and a card replaced (lost, damaged) moves the old number to `w.cardsRetired` with a reason, so the
     old card is refused when scanned. The QR carries `SEP1:W:<card>:<check>`; the check is two characters worked from the
     card number, so a misread or a typed slip is caught. It identifies; the scanner's hand in front of the worker is the
     safeguard, as a signature on the roll is.
   - The cards print through the one print view: the company, the name, the designation, the card number, the blood group and
     the QR, credit-card size, ten to an A4 sheet. The owner's alone.
   - The scanner (Staff → Day → Scan cards): the camera reads a card where the browser can (BarcodeDetector), else the card
     number is typed. The first scan of a worker's day is the in-time, every later one the out-time; the mark is the hand's own
     (no `src: 'relay'`), so a roll never rewrites it, and hours follow the one rule (relayHoursOf). A scan within two minutes
     of the worker's last is the same scan. Each scan lands on the screen at once with Undo. A floor entry for the guard. */

var IDC_RE = /^SEP1:W:(SEP-\d{4,}):([0-9A-Z]{2})$/;
var IDC_SAME_MS = 2 * 60000;
var _idcLog = [];           // this sitting's scans, newest first: {iso, staffId, name, kind, min, prev, prevScans}
var _idcStream = null, _idcTimer = null, _idcBusy = false;

function idcCheck(card) {
  var s = String(card), n = 0;
  for (var i = 0; i < s.length; i++) n += s.charCodeAt(i) * (i + 1);
  return ('0' + (n % 1296).toString(36).toUpperCase()).slice(-2);
}
function idcPayload(card) { return 'SEP1:W:' + card + ':' + idcCheck(card); }
function idcNum(card) { var m = /^SEP-(\d+)$/.exec(String(card || '')); return m ? +m[1] : 0; }
/* The next number: past every card ever given, retired ones included. */
function idcNext() {
  var hi = 0;
  (S.staff || []).forEach(function(w) {
    hi = Math.max(hi, idcNum(w.card));
    (w.cardsRetired || []).forEach(function(r) { hi = Math.max(hi, idcNum(r.card)); });
  });
  return 'SEP-' + String(hi + 1).padStart(4, '0');
}
function idcEnsure(w) { if (!w.card) w.card = idcNext(); return w.card; }
/* Who a scan or a typed number names: {w} or {why}. */
function idcResolve(raw) {
  var s = String(raw || '').trim().toUpperCase(), card = null, m = IDC_RE.exec(s);
  if (m) { if (idcCheck(m[1]) !== m[2]) return { why: 'The code did not read cleanly: scan it again.' }; card = m[1]; }
  else if (/^(SEP-?)?\d{1,6}$/.test(s)) card = 'SEP-' + String(+s.replace(/\D/g, '')).padStart(4, '0');
  else return { why: 'Not one of this shop’s cards.' };
  var w = (S.staff || []).find(function(x) { return x.card === card; });
  if (w) return w.active === false ? { why: w.name + ' is not on the active roster.' } : { w: w, card: card };
  var old = (S.staff || []).find(function(x) { return (x.cardsRetired || []).some(function(r) { return r.card === card; }); });
  return { why: old ? 'Card ' + card + ' was replaced: ' + old.name + ' carries ' + (old.card || 'a new card') + ' now.' : 'No worker holds card ' + card + '.' };
}

/* One scan into the day: the first the in-time, a later one the out-time. */
function idcScan(raw, at) {
  if (typeof attFloorOk === 'function' && !attFloorOk()) return { ok: false, why: 'Your ID does not enter attendance.' };
  var r = idcResolve(raw);
  if (!r.w) return { ok: false, why: r.why };
  var now = at ? new Date(at) : new Date(), iso = localDateStr(now), min = now.getHours() * 60 + now.getMinutes(), w = r.w;
  var rec = attDay(iso, true), id = w.id;
  rec.scans = rec.scans || {};
  var list = rec.scans[id] || [], last = list[list.length - 1];
  if (last && now.getTime() - last.at < IDC_SAME_MS) return { ok: false, why: w.name + ' was scanned a moment ago.', w: w, same: true };
  var prev = rec.marks[id] ? JSON.parse(JSON.stringify(rec.marks[id])) : null, prevScans = list.slice();
  // A mark already on the day (a roll's, one typed) takes the scanned time; an absence or no mark becomes present.
  var m = rec.marks[id] && rec.marks[id].st !== 'A' ? rec.marks[id] : { st: 'P', area: (rec.marks[id] && rec.marks[id].area) || w.area || 'flex' };
  var kind = list.length ? 'out' : 'in';
  if (kind === 'in') m.inMin = min; else m.outMin = min;
  var area = m.area, out = m.outMin != null ? m.outMin : (area === 'gate' ? 1140 : 1020);
  var hr = relayHoursOf(m.inMin, out > m.inMin ? out : null, w, area);
  m.hours = hr.hours; m.ot = hr.ot;
  delete m.src;   // the hand's own: a roll never rewrites it
  rec.marks[id] = m;
  rec.scans[id] = list.concat([{ min: min, at: now.getTime(), card: r.card }]);
  _idcLog.unshift({ iso: iso, staffId: id, name: w.name, kind: kind, min: min, prev: prev, prevScans: prevScans });
  saveState();
  return { ok: true, w: w, kind: kind, min: min };
}
function idcUndo() {
  var x = _idcLog.shift();
  if (!x) return;
  var rec = attDay(x.iso, false);
  if (!rec) return;
  if (x.prev) rec.marks[x.staffId] = x.prev; else delete rec.marks[x.staffId];
  rec.scans = rec.scans || {};
  if (x.prevScans.length) rec.scans[x.staffId] = x.prevScans; else delete rec.scans[x.staffId];
  saveState();
  idcLogDraw('Undone: ' + x.name + ' ' + (x.kind === 'in' ? 'in' : 'out') + ' at ' + relayClockLabel(x.min));
}

/* ---------- The scanner ---------- */
function idcScanOpen() {
  if (typeof attFloorOk === 'function' && !attFloorOk()) return;
  _idcLog = [];
  var can = typeof window.BarcodeDetector === 'function' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  dialogOpen('<div class="inv-dialog" data-idc-scanner>' + dialogHeadHtml('Scan cards') +
    (can ? '<video id="idcVideo" class="inv-idc-video" playsinline muted aria-label="Camera"></video>' : '') +
    '<div class="inv-callout inv-callout-info" id="idcSay" aria-live="polite">' + (can ? 'Hold a card’s code in front of the camera. The first scan of the day is the in-time, the next the out-time.'
      : 'This browser cannot read codes with the camera: type the number on the card.') + '</div>' +
    '<div class="inv-toolbar inv-mt-8"><input class="inv-input" id="idcType" placeholder="Card number, SEP-0007" inputmode="text" autocomplete="off" aria-label="Card number">' +
    '<button class="inv-btn inv-btn-secondary" data-action="invIdcType">Log it</button></div>' +
    '<div class="inv-panel inv-panel-flush inv-mt-8" id="idcLog"></div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invIdcUndo">Undo the last</button><button class="inv-btn inv-btn-primary" data-action="invCloseOverlay">Done</button></div></div>', { dismiss: true });
  idcLogDraw();
  if (can) idcCameraStart();
  else { var t = document.getElementById('idcType'); if (t && !touchScreen()) t.focus(); }
}
function idcCameraStart() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function(stream) {
    var v = document.getElementById('idcVideo');
    if (!v) { stream.getTracks().forEach(function(t) { t.stop(); }); return; }
    _idcStream = stream; v.srcObject = stream; v.play();
    var det = new window.BarcodeDetector({ formats: ['qr_code'] });
    _idcTimer = setInterval(function() {
      var vv = document.getElementById('idcVideo');
      if (!vv) { idcCameraStop(); return; }
      if (_idcBusy || vv.readyState < 2) return;
      _idcBusy = true;
      det.detect(vv).then(function(codes) { _idcBusy = false; if (codes && codes.length) idcFromScan(codes[0].rawValue); }).catch(function() { _idcBusy = false; });
    }, 350);
  }).catch(function(e) {
    idcSay('The camera could not be opened (' + (e && e.name || 'refused') + '): type the number on the card.', 'warning');
  });
}
function idcCameraStop() {
  if (_idcTimer) { clearInterval(_idcTimer); _idcTimer = null; }
  if (_idcStream) { _idcStream.getTracks().forEach(function(t) { t.stop(); }); _idcStream = null; }
}
function idcSay(text, tone) {
  var el = document.getElementById('idcSay');
  if (!el) return;
  el.className = 'inv-callout inv-callout-' + (tone || 'info');
  el.textContent = text;
}
function idcFromScan(raw) {
  var r = idcScan(raw);
  if (r.ok) { idcSay((r.kind === 'in' ? 'In: ' : 'Out: ') + r.w.name + ' at ' + relayClockLabel(r.min), 'ok'); idcLogDraw(); if (navPageOf() === 'pageStaff' && typeof renderAttendance === 'function') renderAttendance(); }
  else if (!r.same) idcSay(r.why, 'warning');
}
function idcLogDraw(note) {
  var el = document.getElementById('idcLog');
  if (!el) return;
  if (note) idcSay(note, 'info');
  el.innerHTML = '<div class="inv-panel-head"><span class="inv-panel-title">Logged here <span class="inv-panel-count">' + _idcLog.length + '</span></span></div>' +
    (_idcLog.length ? _idcLog.map(function(x) {
      return '<div class="inv-row inv-row-2" data-idc-row><span class="inv-row-main"><span class="inv-row-title">' + escHtml(x.name) + '</span><span class="inv-row-meta">' + escHtml(formatDate(x.iso)) + '</span></span>' +
        '<span class="inv-row-end">' + uiDot(x.kind === 'in' ? 'ok' : 'info', (x.kind === 'in' ? 'In ' : 'Out ') + escHtml(relayClockLabel(x.min))) + '</span></div>';
    }).join('') : '<div class="inv-empty">Nothing scanned yet.</div>');
}
/* The dialog shut any way: the camera goes off with it. */
new MutationObserver(function() { if ((_idcStream || _idcTimer) && !document.getElementById('idcVideo')) idcCameraStop(); }).observe(document.documentElement, { childList: true, subtree: true });

/* ---------- The cards, printed (the owner's) ---------- */
function idcOwnerOk(again) {
  if (typeof pplOwner === 'function' && !pplOwner()) { uiAlert({ title: 'The owner’s to print', body: 'ID cards are printed by the owner.' }); return false; }
  return typeof grdGate !== 'function' || grdGate('payments', 'Print ID cards', again);
}
function idcPrintOpen(onlyId) {
  if (!idcOwnerOk(function() { idcPrintOpen(onlyId); })) return;
  var list = (S.staff || []).filter(function(w) { return w.active !== false; }).sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); });
  if (!list.length) return uiAlert({ title: 'Nobody on the roster', body: 'Add the workers first; each gets a card.' });
  dialogOpen('<div class="inv-dialog" data-idc-print>' + dialogHeadHtml('ID cards') +
    '<div class="inv-note">Ten to an A4 sheet, credit-card size. A worker printed for the first time is given the next card number; it is theirs for good.</div>' +
    '<div class="inv-panel inv-panel-flush inv-mt-8">' + list.map(function(w) {
      return '<label class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(w.name) + '</span><span class="inv-row-meta">' + escHtml(w.card || 'no card yet') + '</span></span>' +
        '<span class="inv-row-end"><input type="checkbox" class="inv-check" data-idc-pick="' + escHtml(String(w.id)) + '"' + (onlyId == null || String(onlyId) === String(w.id) ? ' checked' : '') + '></span></label>';
    }).join('') + '</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invIdcPreview">Preview</button></div></div>', { dismiss: true });
}
function idcCardHtml(w) {
  var co = (S.company && (S.company.name || S.company.companyName)) || '', p = w.profile || {};
  return '<div class="inv-idc" data-idc-card="' + escHtml(w.card) + '"><div class="inv-idc-main"><div class="inv-idc-co">' + escHtml(co) + '</div><div class="inv-idc-label">Identity card</div>' +
    '<div class="inv-idc-name">' + escHtml(w.name) + '</div>' + (p.designation ? '<div class="inv-idc-row">' + escHtml(p.designation) + '</div>' : '') +
    '<div class="inv-idc-row"><b>' + escHtml(w.card) + '</b>' + (p.bloodGroup ? ' · Blood ' + escHtml(p.bloodGroup) : '') + '</div>' +
    (p.joined ? '<div class="inv-idc-row">Since ' + escHtml(formatDate(p.joined)) + '</div>' : '') + '</div>' +
    '<div class="inv-idc-qr">' + qrSvg(idcPayload(w.card), 'Card ' + w.card) + '</div></div>';
}
function idcPreview() {
  if (!idcOwnerOk(idcPreview)) return;
  var ids = [];
  document.querySelectorAll('[data-idc-pick]').forEach(function(el) { if (el.checked) ids.push(el.dataset.idcPick); });
  var ws = ids.map(staffById).filter(Boolean);
  if (!ws.length) { showToast('Pick at least one worker', 'error'); return; }
  var given = 0;
  ws.forEach(function(w) { if (!w.card) { idcEnsure(w); given++; } });
  if (given) saveState();
  var h = '';
  for (var i = 0; i < ws.length; i += 10) h += '<div class="inv-idc-sheet">' + ws.slice(i, i + 10).map(idcCardHtml).join('') + '</div>';
  closeOverlay();
  document.getElementById('invPrintBody').innerHTML = h;
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = 'ID cards';
}
/* A card lost or damaged: a new number, the old one refused from now on. */
function idcReplace(id) {
  if (!idcOwnerOk(function() { idcReplace(id); })) return;
  var w = staffById(id);
  if (!w || !w.card) return;
  uiPrompt({ title: 'Replace ' + w.name + '’s card', label: 'Why (lost, damaged…): the old card is refused from now on', required: true }).then(function(why) {
    if (why == null || !String(why).trim()) return;
    w.cardsRetired = Array.isArray(w.cardsRetired) ? w.cardsRetired : [];
    w.cardsRetired.push({ card: w.card, on: localDateStr(), why: String(why).trim() });
    w.card = null;
    idcEnsure(w);
    saveState();
    closeOverlay();
    showToast(w.name + ' now carries ' + w.card + ': print the new card');
  });
}
/* On the worker's record: the card and its code, and for the owner print and replace. */
function idcRecordHtml(w) {
  var owner = typeof pplOwner !== 'function' || pplOwner();
  if (!w.card && !owner) return '';
  return '<div class="inv-panel inv-panel-flush" data-idc-record="' + escHtml(String(w.id)) + '"><div class="inv-panel-head"><span class="inv-panel-title">ID card</span>' +
    '<span class="inv-row-meta">' + escHtml(w.card || 'none yet') + '</span></div>' +
    (w.card ? '<div class="inv-panel-body inv-idc-small">' + qrSvg(idcPayload(w.card), 'Card ' + w.card) + '</div>' : '') +
    (owner ? '<div class="inv-toolbar inv-panel-body"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invIdcPrint" data-id="' + escHtml(String(w.id)) + '">' + (w.card ? 'Print the card' : 'Give a card') + '</button>' +
      (w.card ? '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invIdcReplace" data-id="' + escHtml(String(w.id)) + '">Replace the card</button>' : '') + '</div>' : '') + '</div>';
}

function idcAction(action, btn) {
  switch (action) {
    case 'invIdcScan': idcScanOpen(); return true;
    case 'invIdcType': {
      var t = document.getElementById('idcType');
      if (t && t.value.trim()) { idcFromScan(t.value); t.value = ''; }
      return true;
    }
    case 'invIdcUndo': idcUndo(); return true;
    case 'invIdcPrint': idcPrintOpen(btn.dataset.id != null ? btn.dataset.id : null); return true;
    case 'invIdcPreview': idcPreview(); return true;
    case 'invIdcReplace': idcReplace(btn.dataset.id); return true;
  }
  return false;
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && e.target && e.target.id === 'idcType') { e.preventDefault(); var t = e.target; if (t.value.trim()) { idcFromScan(t.value); t.value = ''; } }
});
