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
  var hi = +S.cardSeq || 0;   // the highest ever given: a worker deleted or merged away takes no number back
  (S.staff || []).forEach(function(w) {
    hi = Math.max(hi, idcNum(w.card));
    (w.cardsRetired || []).forEach(function(r) { hi = Math.max(hi, idcNum(r.card)); });
  });
  return 'SEP-' + String(hi + 1).padStart(4, '0');
}
function idcEnsure(w) { if (!w.card) { w.card = idcNext(); S.cardSeq = Math.max(+S.cardSeq || 0, idcNum(w.card)); } return w.card; }
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
  var res = idcApply(r.w, r.card, at ? new Date(at) : new Date(), 'scan');
  if (res.ok) saveState();
  return res;
}
/* A card's time into the day, a scan's or an office check-in's (checkin.js), on the day the time belongs to (never the day it
   was read). The day's earliest time is the in, its latest the out, whatever order they arrive in, and a time already on the
   mark (a roll's 6 AM block, an out typed) is kept beside the scans: a scan widens the day, never narrows it. A time before noon
   for a hand whose day before has only an in from 4 PM on (an evening block, the night hold) is that day's out, past midnight
   (+1440, the Day screen's convention). Hours follow the Day screen's rule (attTimesApply). */
var IDC_NIGHT_IN = 960, IDC_NIGHT_OUT = 720, IDC_SPAN_MAX = 16 * 60;
function idcApply(w, card, now, via, extra) {
  var iso = isoOf(now), min = now.getHours() * 60 + now.getMinutes(), id = w.id;
  if (min < IDC_NIGHT_OUT) {
    var yIso = isoAddDays(iso, -1), yRec = typeof attDay === 'function' ? attDay(yIso, false) : null, yList = yRec && yRec.scans && yRec.scans[id];
    if (yList && yList.length === 1 && yList[0].min >= IDC_NIGHT_IN && min + 1440 - yList[0].min <= IDC_SPAN_MAX) { iso = yIso; min += 1440; }
  }
  var rec = attDay(iso, true);
  rec.scans = rec.scans || {};
  var list = rec.scans[id] || [];
  var near = list.find(function(x) { return Math.abs(now.getTime() - x.at) < IDC_SAME_MS; });
  if (near) return { ok: false, why: w.name + ' was scanned a moment ago.', w: w, same: true };
  var prev = rec.marks[id] ? JSON.parse(JSON.stringify(rec.marks[id])) : null, prevScans = list.slice();
  // A mark already on the day (a roll's, one typed) keeps its times; an absence or no mark becomes present.
  var had = rec.marks[id] && rec.marks[id].st !== 'A' ? rec.marks[id] : null;
  var m = had || { st: 'P', area: (rec.marks[id] && rec.marks[id].area) || w.area || 'flex' };
  var scan = Object.assign({ min: min, at: now.getTime(), card: card }, via && via !== 'scan' ? { via: via } : {}, extra || {});
  var all = list.concat([scan]).sort(function(a, b) { return a.min - b.min || a.at - b.at; });
  var times = all.map(function(x) { return x.min; });
  if (had && had.inMin != null && !list.length) times.push(had.inMin);
  if (had && had.outMin != null && (had.src === 'relay' ? had.outKnown : had.outKnown !== false)) times.push(had.outMin);
  var lo = Math.min.apply(null, times), hi = Math.max.apply(null, times);
  var kind = all[0] === scan && min === lo ? 'in' : 'out';
  m.inMin = lo;
  if (hi > lo) { m.outMin = hi; m.outKnown = true; } else delete m.outMin;
  attTimesApply(m, w);
  delete m.src;   // the hand's own: a roll never rewrites it
  rec.marks[id] = m;
  rec.scans[id] = all;
  _idcLog.unshift({ iso: iso, staffId: id, name: w.name, kind: kind, min: min, prev: prev, prevScans: prevScans });
  return { ok: true, w: w, kind: kind, min: min, iso: iso };
}
function idcUndo() {
  if (typeof attFloorOk === 'function' && !attFloorOk()) return;
  var x = _idcLog.shift();
  if (!x) return;
  var rec = attDay(x.iso, false);
  if (!rec) return;
  if (x.prev) rec.marks[x.staffId] = x.prev; else delete rec.marks[x.staffId];
  rec.scans = rec.scans || {};
  if (x.prevScans.length) rec.scans[x.staffId] = x.prevScans; else delete rec.scans[x.staffId];
  saveState();
  idcLogDraw('Undone: ' + x.name + ' ' + (x.kind === 'in' ? 'in' : 'out') + ' at ' + relayClockLabel(x.min));
  if (navPageOf() === 'pageStaff' && typeof renderAttendance === 'function') renderAttendance();
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
  var det;
  try { det = new window.BarcodeDetector({ formats: ['qr_code'] }); }
  catch (e) { idcSay('This browser cannot read QR codes with the camera: type the number on the card.', 'warning'); return; }
  idcCameraStop();
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function(stream) {
    var v = document.getElementById('idcVideo');
    if (!v || _idcStream) { stream.getTracks().forEach(function(t) { t.stop(); }); return; }
    _idcStream = stream; v.srcObject = stream;
    var pl = v.play(); if (pl && pl.catch) pl.catch(function() {});
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
/* A number typed carries no check characters, so a slip (17 for 7) would log the wrong hand: the name is said first, and the
   same number logged on the second tap. A full code typed or read is logged at once. */
var _idcTypedCard = null;
function idcTyped(t) {
  if (!t || !t.value.trim()) return;
  var raw = t.value.trim();
  if (!IDC_RE.test(raw.toUpperCase())) {
    var r = idcResolve(raw);
    if (r.w && _idcTypedCard !== r.card) { _idcTypedCard = r.card; idcSay(r.card + ' is ' + r.w.name + '. Log it again to log them.', 'info'); return; }
  }
  _idcTypedCard = null;
  idcFromScan(raw);
  t.value = '';
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
/* The dialog shut any way, or the app put in the background: the camera goes off with it. */
document.addEventListener('visibilitychange', function() {
  if (document.hidden) { if (_idcStream || _idcTimer) idcCameraStop(); }
  else if (document.getElementById('idcVideo') && !_idcStream) idcCameraStart();
});
new MutationObserver(function() { if ((_idcStream || _idcTimer) && !document.getElementById('idcVideo')) idcCameraStop(); }).observe(document.documentElement, { childList: true, subtree: true });

/* ---------- The cards, printed (the owner's) ---------- */
function idcOwnerOk(again) {
  if (typeof pplOwner === 'function' && !pplOwner()) { uiAlert({ title: 'The owner’s to print', body: 'ID cards are printed by the owner.' }); return false; }
  return typeof grdGate !== 'function' || grdGate('payments', 'Print ID cards', again);
}
/* The back of every card: the rules a zinc plating floor lives by, one a line. The owner may rewrite them on the print dialog
   (`S.idcCfg.rules`); these stand until then. Nothing of the shop is in them. */
var IDC_RULES = [
  'Wear gloves, goggles, apron and gumboots at the tanks; a face shield for acid or cyanide.',
  'Never let acid meet cyanide: together they give a poison gas. Rinse between tanks.',
  'Add acid to water, never water to acid.',
  'No eating, drinking, smoking or chewing in the plant. Wash before you eat.',
  'Splash on skin or in the eyes: wash in running water for 15 minutes, then tell the supervisor.',
  'Switch off a rectifier before touching a bar or a clamp. Keep hands and tools dry.',
  'Keep floors dry and drains clear. Report a spill, a leak or a smell at once.',
  'Know the eye-wash, the first-aid box and the way out. Never work alone at the tanks.'];
function idcRules() { var r = S.idcCfg && Array.isArray(S.idcCfg.rules) ? S.idcCfg.rules.filter(function(x) { return String(x).trim(); }) : null; return r && r.length ? r : IDC_RULES; }
var _idcPending = null;   // the numbers a preview shows for workers with no card yet: given only when the sheet is printed

function idcPrintOpen(onlyId) {
  if (!idcOwnerOk(function() { idcPrintOpen(onlyId); })) return;
  var list = (S.staff || []).filter(function(w) { return w.active !== false; }).sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); });
  if (!list.length) return uiAlert({ title: 'Nobody on the roster', body: 'Add the workers first; each gets a card.' });
  dialogOpen('<div class="inv-dialog" data-idc-print>' + dialogHeadHtml('ID cards') +
    '<div class="inv-note">Ten to an A4 sheet, credit-card size. A worker printed for the first time is given the next card number when the sheet is printed, not when it is previewed; it is theirs for good.</div>' +
    '<div class="inv-panel inv-panel-flush inv-mt-8">' + list.map(function(w) {
      return '<label class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(w.name) + '</span><span class="inv-row-meta">' + escHtml(w.card || 'no card yet') + '</span></span>' +
        '<span class="inv-row-end"><input type="checkbox" class="inv-check" data-idc-pick="' + escHtml(String(w.id)) + '"' + (onlyId == null || String(onlyId) === String(w.id) ? ' checked' : '') + '></span></label>';
    }).join('') + '</div>' +
    '<label class="inv-row inv-row-2 inv-mt-8"><span class="inv-row-main"><span class="inv-row-title">Print the back too</span><span class="inv-row-meta">a sheet of backs after each sheet of fronts: print on both sides, flipping on the long edge</span></span>' +
    '<span class="inv-row-end"><input type="checkbox" class="inv-check" id="idcBacks" checked></span></label>' +
    '<label class="inv-field inv-mt-8"><span class="inv-field-label">The back: safety rules, one a line</span><textarea class="inv-textarea" id="idcRules" rows="8">' + escHtml(idcRules().join('\n')) + '</textarea></label>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invIdcPreview">Preview</button></div></div>', { dismiss: true });
}
/* The plant's address as the invoice prints it. */
function idcAddress() { var c = S.company || {}; return [c.add1, c.add2, c.add3].filter(function(x) { return String(x || '').trim(); }).join(', '); }
function idcCardHtml(w, card) {
  var c = S.company || {}, co = c.name || c.companyName || '', p = w.profile || {}, em = p.emergency || {};
  var rows = [['Card', card], ['Blood group', p.bloodGroup], ['Joined', p.joined ? formatDate(p.joined) : ''], ['Emergency', em.phone ? (em.relation ? em.relation + ' ' : '') + em.phone : '']]
    .filter(function(r) { return r[1]; });
  return '<div class="inv-idc" data-idc-card="' + escHtml(card) + '">' +
    '<div class="inv-idc-band"><div class="inv-idc-co">' + escHtml(co) + '</div><div class="inv-idc-addr">' + escHtml(idcAddress()) + (c.phone ? ' · ' + escHtml(c.phone) : '') + '</div></div>' +
    '<div class="inv-idc-body"><div class="inv-idc-main"><div class="inv-idc-name">' + escHtml(w.name) + '</div>' +
    '<div class="inv-idc-desig">' + escHtml([p.designation, w.area && typeof areaLabel === 'function' && w.area !== 'flex' ? areaLabel(w.area) : ''].filter(Boolean).join(' · ') || 'Worker') + '</div>' +
    '<dl class="inv-idc-kv">' + rows.map(function(r) { return '<dt>' + escHtml(r[0]) + '</dt><dd>' + escHtml(r[1]) + '</dd>'; }).join('') + '</dl></div>' +
    '<div class="inv-idc-qr">' + qrSvg(idcPayload(card), 'Card ' + card) + '</div></div>' +
    '<div class="inv-idc-foot"><span>Identity card</span><span class="inv-idc-sign">Authorised signatory</span></div></div>';
}
function idcBackHtml() {
  var c = S.company || {};
  return '<div class="inv-idc inv-idc-back"><div class="inv-idc-btitle">Safety at the plant</div><ol class="inv-idc-rules">' +
    idcRules().map(function(r) { return '<li>' + escHtml(r) + '</li>'; }).join('') + '</ol>' +
    '<div class="inv-idc-bfoot">' + (c.phone ? 'Emergency: ' + escHtml(c.phone) + ' · ' : '') + 'If found, return to ' + escHtml(c.name || 'the plant') + ', ' + escHtml(idcAddress()) + '</div></div>';
}
/* Ten to a sheet; the backs on the next sheet, each row's two swapped, so a page printed on both sides (flipped on the long
   edge) puts every back behind its own front. */
function idcSheetsHtml(cards, backs) {
  var h = '';
  for (var i = 0; i < cards.length; i += 10) {
    var page = cards.slice(i, i + 10);
    h += '<div class="inv-idc-sheet" data-idc-sheet="front">' + page.map(function(x) { return idcCardHtml(x.w, x.card); }).join('') + '</div>';
    if (backs) {
      var cells = [];
      for (var r = 0; r < page.length; r += 2) cells.push(page[r + 1] ? idcBackHtml() : '<div class="inv-idc-blank"></div>', idcBackHtml());
      h += '<div class="inv-idc-sheet" data-idc-sheet="back">' + cells.join('') + '</div>';
    }
  }
  return h;
}
function idcPreview() {
  if (!idcOwnerOk(idcPreview)) return;
  var ids = [];
  document.querySelectorAll('[data-idc-pick]').forEach(function(el) { if (el.checked) ids.push(el.dataset.idcPick); });
  var ws = ids.map(staffById).filter(Boolean);
  if (!ws.length) { showToast('Pick at least one worker', 'error'); return; }
  var backsEl = document.getElementById('idcBacks'), rulesEl = document.getElementById('idcRules'), backs = !backsEl || backsEl.checked;
  if (rulesEl) {
    var lines = rulesEl.value.split('\n').map(function(x) { return x.trim(); }).filter(Boolean);
    var same = lines.join('\n') === IDC_RULES.join('\n');
    var was = S.idcCfg && S.idcCfg.rules ? S.idcCfg.rules.join('\n') : '';
    if ((same ? '' : lines.join('\n')) !== was) { S.idcCfg = Object.assign({}, S.idcCfg || {}, { rules: same ? null : lines }); saveState(); }
  }
  // Numbers for the workers without one are shown, not given: the next numbers in turn, kept only if the sheet is printed.
  var next = idcNum(idcNext()), given = [];
  var cards = ws.map(function(w) {
    if (w.card) return { w: w, card: w.card };
    var c = 'SEP-' + String(next++).padStart(4, '0');
    given.push({ id: w.id, card: c });
    return { w: w, card: c };
  });
  _idcPending = given.length ? given : null;
  closeOverlay();
  document.getElementById('invPrintBody').innerHTML = idcSheetsHtml(cards, backs);
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = 'ID cards';
  if (given.length) showToast(todoPlural(given.length, 'new card number') + ' shown: kept only when you print');
}
/* Printed: the numbers the preview showed are given (unless a card was given meanwhile, when the number moves on). */
function idcPrintCommit() {
  if (!_idcPending) return;
  var any = false;
  _idcPending.forEach(function(x) {
    var w = staffById(x.id);
    if (!w || w.card) return;
    var taken = (S.staff || []).some(function(o) { return o.card === x.card || (o.cardsRetired || []).some(function(r) { return r.card === x.card; }); }) || idcNum(x.card) <= (+S.cardSeq || 0);
    w.card = taken ? idcNext() : x.card;
    S.cardSeq = Math.max(+S.cardSeq || 0, idcNum(w.card));
    any = true;
  });
  _idcPending = null;
  if (any) saveState();
}
function idcPrintDiscard() { _idcPending = null; }
window.addEventListener('beforeprint', function() { idcPrintCommit(); });
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
    (w.card && owner ? '<div class="inv-panel-body inv-idc-small">' + qrSvg(idcPayload(w.card), 'Card ' + w.card) + '</div>' : '') +
    (owner ? '<div class="inv-toolbar inv-panel-body"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invIdcPrint" data-id="' + escHtml(String(w.id)) + '">' + (w.card ? 'Print the card' : 'Give a card') + '</button>' +
      (w.card ? '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invIdcReplace" data-id="' + escHtml(String(w.id)) + '">Replace the card</button>' : '') + '</div>' : '') + '</div>';
}

function idcAction(action, btn) {
  switch (action) {
    case 'invIdcScan': idcScanOpen(); return true;
    case 'invIdcType': {
      idcTyped(document.getElementById('idcType'));
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
  if (e.key === 'Enter' && e.target && e.target.id === 'idcType') { e.preventDefault(); idcTyped(e.target); }
});
