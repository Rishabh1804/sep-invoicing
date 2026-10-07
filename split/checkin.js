/* ===== THE OFFICE QR: a worker checks in from their own phone =====
   Owner, 7 Oct 2026 (docs/WORKERS_AND_PLANT.md, W5): *"a universal QR Code that I can print and keep in the office which
   workers can scan via their camera and open a link and mark attendance, we would need safeguards for proxy"*; they chose
   the WhatsApp route with checks, since the app has no server to receive a check-in.

   - **The sheet** (Staff → Roster → Office QR, the owner's): one QR of a link to `checkin.html`, carrying in its fragment
     (never sent to any server) the office's WhatsApp number, the plant's location and radius, a key and the company's name.
     None of it is in the build: it is the book's (`S.checkinCfg`), drawn into the sheet when it is printed.
   - **The worker's phone** opens checkin.html: the card number (remembered on that phone), the time, the phone's location,
     and a code worked from the key, the card and the time (`ckCode`, the same arithmetic on both sides). One tap opens
     WhatsApp to the office number with the message written; the worker sends it.
   - **The office reads the chat** through the one paste box, like a roll: every check-in is shown with its checks before
     anything is saved (`ckReview`), and saved as a card scan is (`idcApply`, `via: 'checkin'`).
   - **The checks against a proxy**, each said on its row: the card is a live card; the code matches (a message typed or
     changed by hand does not); it came from the worker's own phone (the number on their record, or a contact named as
     them); the phone was inside the plant's radius; it was sent when it says it was made; the time is within the shop's
     hours; one phone checked in one worker that day. A row failing one is red and left unticked; the owner may still tick it.
     Warn, never block. **What it cannot stop**, and the sheet's note says so: a phone that fakes its location, and a key
     copied off the sheet. The office number and the plant check are the strong part; the code stops casual typing. */

var CK_HEAD_RE = /^\s*\*?sep\s*check-?\s*in\*?\s*$/i;
var CK_LATE_MIN = 10;          // sent this long after the time it carries: made earlier, sent later
var CK_ROUGH_M = 150;          // a location rougher than this is said
var CK_HOURS = [300, 1440 + 60];   // 5 AM to 1 AM: outside it a check-in is asked about

/* The code: FNV-1a over key|card|day|minute, four base-36 characters. checkin.html carries the same function. */
function ckCode(key, card, iso, min) {
  var s = String(key) + '|' + String(card) + '|' + String(iso) + '|' + String(min), h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('0000' + (h % 1679616).toString(36).toUpperCase()).slice(-4);
}
function ckCfg() { return S.checkinCfg || {}; }
function ckDigits(s) { return String(s || '').replace(/\D/g, ''); }
function ckMetres(la1, lo1, la2, lo2) {
  var r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2), b = Math.sin((lo2 - lo1) * r / 2);
  var h = a * a + Math.cos(la1 * r) * Math.cos(la2 * r) * b * b;
  return Math.round(2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h))));
}

/* A check-in message as checkin.html writes it, or null:
     SEP check-in / Card SEP-0007 / Time 07/10/2026 08:27 / Place 22.801230,86.150120 ±12 m / Code 4F7K */
function ckParse(text) {
  var lines = String(text || '').split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
  if (!lines.length || !CK_HEAD_RE.test(lines[0])) return null;
  var r = { card: null, iso: null, min: null, lat: null, lng: null, acc: null, place: '', code: '' };
  lines.slice(1).forEach(function(l) {
    var m;
    if ((m = /^card\s+(?:SEP-?)?(\d{1,6})\b/i.exec(l))) r.card = 'SEP-' + String(+m[1]).padStart(4, '0');
    else if ((m = /^time\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\b/i.exec(l))) { r.iso = isoFromDmy(m[1], m[2], m[3]); r.min = +m[4] * 60 + +m[5]; if (+m[4] > 23 || +m[5] > 59) r.min = null; }
    else if ((m = /^place\s+(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)(?:\s*±\s*(\d+)\s*m)?/i.exec(l))) { r.lat = +m[1]; r.lng = +m[2]; r.acc = m[3] != null ? +m[3] : null; }
    else if ((m = /^place\s+(.*)$/i.exec(l))) r.place = m[1];
    else if ((m = /^code\s+([0-9A-Z]{4})\b/i.exec(l))) r.code = m[1].toUpperCase();
  });
  return r;
}
/* The check-ins in a paste: its messages, each with what was read. */
function ckFromText(text) {
  return relaySplit(text).map(function(m) { return { msg: m, read: ckParse(m.text) }; }).filter(function(x) { return x.read; });
}

/* Whose phone a sender is: the worker whose record holds its number, or who is named as the contact. {w} or {none} or {unknown}. */
function ckSender(sentBy) {
  var s = String(sentBy || '').trim();
  if (!s) return { unknown: true };
  var d = ckDigits(s);
  var staff = (S.staff || []).filter(function(w) { return w.active !== false; });
  if (d.length >= 10 && d.length >= s.replace(/[\s+()\-]/g, '').length - 1) {
    var tail = d.slice(-10);
    var hit = staff.filter(function(w) { return (String((w.profile || {}).phone || '').match(/\d[\d\s\-]{8,}\d/g) || []).some(function(p) { return ckDigits(p).slice(-10) === tail; }); });
    return hit.length === 1 ? { w: hit[0], by: 'number' } : hit.length ? { shared: hit } : { none: true, number: true };
  }
  var k = relayKey(s);
  var named = staff.filter(function(w) {
    return [w.name].concat(w.relayNames || [], w.aliases || []).some(function(n) { return relayKey(n) === k; }) || relayKey(String(w.name).split(/\s+/)[0]) === k;
  });
  return named.length === 1 ? { w: named[0], by: 'name' } : { none: true };
}

/* Every check-in with its checks: {x, w, card, at, tone, notes: [[tone, text]], tick, done}. Pure but for the book. */
function ckReview(items, cfg) {
  cfg = cfg || ckCfg();
  var out = items.map(function(x) {
    var r = x.read, m = x.msg, notes = [], red = function(t) { notes.push(['danger', t]); }, amber = function(t) { notes.push(['warning', t]); };
    var row = { x: x, notes: notes, w: null, card: r.card, iso: r.iso, min: r.min, sender: ckSender(m.sentBy), done: false };
    if (!r.card || !r.iso || r.min == null) { red('Not a whole check-in: the card or the time is missing.'); return row; }
    var who = idcResolve(r.card);
    if (!who.w) red(who.why); else row.w = who.w;
    var d = new Date(r.iso + 'T00:00:00'); d.setMinutes(r.min);
    row.at = d.getTime();
    // The code: what the office sheet's page worked out, or a message typed or changed by hand.
    if (!cfg.key) amber('The office QR has no key yet: the code cannot be checked.');
    else if (r.code !== ckCode(cfg.key, r.card, r.iso, r.min)) red('The code does not match: typed or changed by hand, or from an old sheet.');
    // Whose phone.
    var sd = row.sender;
    if (sd.unknown) amber('Who sent it is not shown: paste it with its WhatsApp line.');
    else if (sd.w && row.w && sd.w !== row.w) red('Sent from ' + sd.w.name + '’s phone.');
    else if (sd.shared) amber('Sent from a number two workers’ records share.');
    else if (sd.none) amber('Sent from ' + (sd.number ? 'a number' : 'a contact') + ' not on ' + (row.w ? row.w.name + '’s' : 'any worker’s') + ' record: ' + m.sentBy + '.');
    // Where.
    if (cfg.lat == null || cfg.lng == null) amber('The plant’s location is not set: Office QR.');
    else if (r.lat == null) amber('The phone did not share its location' + (r.place ? ' (' + r.place + ')' : '') + '.');
    else {
      var dist = ckMetres(cfg.lat, cfg.lng, r.lat, r.lng), rad = +cfg.radius || 150, acc = r.acc || 0;
      row.dist = dist;
      if (dist - Math.min(acc, CK_ROUGH_M) > rad) red(ckDistWords(dist) + ' from the plant.');
      else if (dist > rad) amber(ckDistWords(dist) + ' from the plant, inside how rough the phone’s fix was (±' + acc + ' m).');
      else if (acc > CK_ROUGH_M) amber('At the plant, on a rough fix (±' + acc + ' m).');
    }
    // When: sent as made, and within the shop's hours.
    if (m.sentOn && m.sentAt != null) {
      var late = isoDaysBetween(r.iso, m.sentOn) * 1440 + m.sentAt - r.min;
      if (late > CK_LATE_MIN) amber('Sent ' + ckLateWords(late) + ' after the time it carries.');
      else if (late < -2) red('Sent before the time it carries.');
    }
    if (r.min < CK_HOURS[0] && r.min + 1440 > CK_HOURS[1]) amber('At ' + relayClockLabel(r.min) + ', outside the shop’s hours.');
    // Already in the day.
    var rec = row.w && typeof attDay === 'function' ? attDay(r.iso, false) : null;
    var had = rec && rec.scans && rec.scans[row.w.id];
    if (had && had.some(function(s) { return Math.abs(s.at - row.at) < IDC_SAME_MS; })) { row.done = true; notes.push(['neutral', 'Already in the day.']); }
    return row;
  });
  // One phone, one worker a day: a sender who checked in more than one card. The phone's own worker stays; the others are red.
  var bySender = {};
  out.forEach(function(row) {
    if (!row.w || !row.x.msg.sentBy) return;
    var k = row.iso + '|' + (ckDigits(row.x.msg.sentBy).slice(-10) || relayKey(row.x.msg.sentBy));
    (bySender[k] = bySender[k] || []).push(row);
  });
  Object.keys(bySender).forEach(function(k) {
    var rows = bySender[k], ids = rows.map(function(r) { return r.w.id; }).filter(function(v, i, a) { return a.indexOf(v) === i; });
    if (ids.length < 2) return;
    var own = rows[0].sender.w ? rows[0].sender.w.id : rows[0].w.id;
    rows.forEach(function(r) { if (r.w.id !== own) r.notes.push(['danger', 'The same phone checked in ' + (staffById(own) || {}).name + ' that day.']); });
  });
  out.forEach(function(row) {
    row.tone = row.notes.some(function(n) { return n[0] === 'danger'; }) ? 'danger' : row.notes.some(function(n) { return n[0] === 'warning'; }) ? 'warning' : 'ok';
    row.tick = !!row.w && !row.done && row.tone !== 'danger';
  });
  return out.sort(function(a, b) { return (a.at || 0) - (b.at || 0); });
}
function ckDistWords(m) { return m >= 1000 ? (Math.round(m / 100) / 10) + ' km' : m + ' m'; }
function ckLateWords(min) { return min >= 120 ? Math.round(min / 60) + ' hours' : min + ' minutes'; }

/* ---------- The review: every check-in beside its checks; Save puts the ticked ones into the day ---------- */
var _ckRows = null;
function ckReviewOpen(text) {
  if (typeof attFloorOk === 'function' && !attFloorOk()) return;
  var items = ckFromText(text);
  if (!items.length) { showToast('No check-in found in that text', 'error'); return; }
  _ckRows = ckReview(items);
  dialogOpen('<div class="inv-dialog" data-ck-review>' + dialogHeadHtml('Check-ins from the office QR') + '<div id="ckBody">' + ckReviewHtml() + '</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invCkSave" id="ckSaveBtn">' + ckSaveLabel() + '</button></div></div>', { dismiss: true });
}
function ckSaveLabel() { var n = (_ckRows || []).filter(function(r) { return r.tick; }).length; return n ? 'Save ' + todoPlural(n, 'check-in') : 'Nothing to save'; }
function ckReviewHtml() {
  var rows = _ckRows || [], red = rows.filter(function(r) { return r.tone === 'danger'; }).length;
  return '<div class="inv-note">Each check-in as the worker’s phone sent it, with what the office sheet can check. A red one is left unticked; tick it if you know why.</div>' +
    (red ? '<div class="inv-callout inv-callout-danger inv-mt-8" id="ckRedNote">' + todoPlural(red, 'check-in fails', 'check-ins fail') + ' a check against a proxy.</div>' : '') +
    '<div class="inv-panel inv-panel-flush inv-mt-8">' + rows.map(function(r, i) {
      var title = r.w ? r.w.name : (r.card || 'No card');
      var meta = (r.card || '') + (r.iso ? ' · ' + formatDate(r.iso) + ' ' + relayClockLabel(r.min) : '') + (r.x.msg.sentBy ? ' · from ' + r.x.msg.sentBy : '');
      return '<label class="inv-row inv-row-2" data-ck-row="' + i + '" data-tone="' + r.tone + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(title) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(meta) + '</span>' +
        (r.notes.length ? r.notes.map(function(n) { return '<span class="inv-note" data-ck-note>' + uiDot(n[0], escHtml(n[1])) + '</span>'; }).join('') : '<span class="inv-note" data-ck-note>' + uiDot('ok', 'Every check passes') + '</span>') +
        '</span><span class="inv-row-end">' + (r.w && !r.done ? '<input type="checkbox" class="inv-check" data-ck-pick="' + i + '"' + (r.tick ? ' checked' : '') + ' aria-label="Save this check-in">' : '') + '</span></label>';
    }).join('') + '</div>';
}
function ckSave() {
  if (!_ckRows) return;
  if (typeof attFloorOk === 'function' && !attFloorOk()) return;
  var saved = 0, said = [];
  _ckRows.filter(function(r) { return r.tick && r.w && !r.done; }).forEach(function(r) {
    var res = idcApply(r.w, r.card, new Date(r.at), 'checkin', { from: String(r.x.msg.sentBy || ''), checks: r.tone });
    if (res.ok) saved++; else said.push(res.why);
  });
  _ckRows = null;
  if (saved) saveState();
  closeOverlay();
  showToast(saved ? todoPlural(saved, 'check-in') + ' saved into the day' + (said.length ? '; ' + said.length + ' already there' : '') : 'Nothing saved');
  if (navPageOf() === 'pageStaff' && typeof renderAttendance === 'function') renderAttendance();
}

/* ---------- The sheet (the owner's): the number, the place, the key, and the printed QR ---------- */
function ckOwnerOk(again) {
  if (typeof pplOwner === 'function' && !pplOwner()) { uiAlert({ title: 'The owner’s to set', body: 'The office QR is set up by the owner.' }); return false; }
  return typeof grdGate !== 'function' || grdGate('settings', 'Set up the office QR', again);
}
function ckNewKey() {
  var a = new Uint8Array(6);
  (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(a) : a.forEach(function(v, i) { a[i] = Math.floor(Math.random() * 256); });
  return Array.prototype.map.call(a, function(b) { return (b % 36).toString(36); }).join('').toUpperCase();
}
/* The link the QR carries: checkin.html beside the app, the settings in its fragment. */
function ckUrl(cfg, withName) {
  var base = new URL('checkin.html', location.href);
  var p = ['o=' + ckDigits(cfg.office), 'la=' + (+cfg.lat).toFixed(5), 'lo=' + (+cfg.lng).toFixed(5), 'r=' + (+cfg.radius || 150), 'k=' + encodeURIComponent(cfg.key || '')];
  var co = (S.company && (S.company.name || S.company.companyName)) || '';
  if (withName !== false && co) p.push('n=' + encodeURIComponent(co));
  return base.origin + base.pathname + '#' + p.join('&');
}
function ckReady(cfg) { return ckDigits(cfg.office).length >= 10 && cfg.lat != null && cfg.lng != null && cfg.key; }
function ckSetupOpen() {
  if (!ckOwnerOk(ckSetupOpen)) return;
  var c = ckCfg();
  dialogOpen('<div class="inv-dialog" data-ck-setup>' + dialogHeadHtml('Office QR') +
    '<div class="inv-note">One sheet in the office. A worker scans it with their own phone, and WhatsApp sends the office a check-in with their card, the time and where the phone was. Paste the chat in the paste box to read them, each with its checks.</div>' +
    '<label class="inv-field inv-mt-8"><span class="inv-field-label">The office’s WhatsApp number, with the country code</span><input class="inv-input" id="ckOffice" inputmode="tel" value="' + escHtml(c.office || '') + '" placeholder="91 98xxx xxxxx"></label>' +
    '<div class="inv-fields"><label class="inv-field"><span class="inv-field-label">Plant latitude</span><input class="inv-input" id="ckLat" inputmode="decimal" value="' + escHtml(c.lat != null ? String(c.lat) : '') + '"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Longitude</span><input class="inv-input" id="ckLng" inputmode="decimal" value="' + escHtml(c.lng != null ? String(c.lng) : '') + '"></label></div>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCkHere">Use where this device is now</button>' +
    '<label class="inv-field inv-mt-8"><span class="inv-field-label">Radius, metres: a check-in farther than this is red</span><input class="inv-input" id="ckRadius" inputmode="numeric" value="' + escHtml(String(c.radius || 150)) + '"></label>' +
    '<div class="inv-callout inv-callout-info inv-mt-8">What it checks: a live card, the code, the worker’s own phone (the number on their record), the place, the time, one phone one worker a day. What it cannot stop: a phone that fakes its location, or a sheet photographed and used elsewhere. A new key makes every sheet printed before it fail the code.</div>' +
    (c.key ? '<div class="inv-note inv-mt-8" id="ckKeyNote">Key ' + escHtml(c.key.slice(0, 2)) + '…, made ' + escHtml(c.keyOn ? formatDate(c.keyOn) : '') + '. <button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invCkRekey">New key</button></div>' : '') +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-secondary" data-action="invCkSaveCfg">Save</button><button class="inv-btn inv-btn-primary" data-action="invCkPrint">Save and print</button></div></div>', { dismiss: true });
}
function ckHere() {
  if (!navigator.geolocation) { showToast('This device cannot share its location', 'error'); return; }
  navigator.geolocation.getCurrentPosition(function(p) {
    var la = document.getElementById('ckLat'), lo = document.getElementById('ckLng');
    if (!la || !lo) return;
    la.value = p.coords.latitude.toFixed(6); lo.value = p.coords.longitude.toFixed(6);
    la.dispatchEvent(new Event('input', { bubbles: true }));
    showToast('Location taken, ±' + Math.round(p.coords.accuracy) + ' m');
  }, function(e) { showToast('Location refused: ' + (e && e.message || 'type it in'), 'error'); }, { enableHighAccuracy: true, timeout: 15000 });
}
/* The fields read and kept; false (and said) when one is not usable. */
function ckSaveCfg() {
  if (!ckOwnerOk(ckSaveCfg)) return false;
  var v = function(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  var office = ckDigits(v('ckOffice')), lat = parseFloat(v('ckLat')), lng = parseFloat(v('ckLng')), rad = parseInt(v('ckRadius'), 10);
  if (office.length < 10) { showToast('The office number needs its country code: 91 and ten digits', 'error'); return false; }
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { showToast('Set the plant’s latitude and longitude', 'error'); return false; }
  var c = S.checkinCfg = Object.assign({}, ckCfg(), { office: office, lat: lat, lng: lng, radius: isFinite(rad) && rad >= 20 ? rad : 150 });
  if (!c.key) { c.key = ckNewKey(); c.keyOn = localDateStr(); }
  saveState();
  return true;
}
function ckRekey() {
  if (!ckOwnerOk(ckRekey)) return;
  uiConfirm({ title: 'Make a new key?', body: 'Every office sheet printed before it will fail the code from now on: print the new sheet and take the old one down.', okLabel: 'New key', danger: true }).then(function(ok) {
    if (!ok) return;
    S.checkinCfg = Object.assign({}, ckCfg(), { key: ckNewKey(), keyOn: localDateStr() });
    saveState();
    closeOverlay();
    ckSetupOpen();
    showToast('New key made: print the sheet');
  });
}
function ckSheetHtml(cfg) {
  var url = ckUrl(cfg), svg = qrSvg(url, 'Office check-in');
  if (!svg) { url = ckUrl(cfg, false); svg = qrSvg(url, 'Office check-in'); }
  var co = (S.company && (S.company.name || S.company.companyName)) || '';
  return '<div class="inv-ck-sheet" data-ck-sheet><div class="inv-ck-co">' + escHtml(co) + '</div><div class="inv-ck-title">Mark your attendance</div>' +
    '<div class="inv-ck-qr">' + svg + '</div>' +
    '<ol class="inv-ck-steps"><li>Open your phone’s camera and point it at the code.</li><li>Open the link, type your card number the first time, tap <b>Check in</b> and allow the location.</li>' +
    '<li>Tap <b>Send on WhatsApp</b> and send the message as it is. Once as you arrive, once as you leave.</li></ol>' +
    '<div class="inv-ck-foot">From your own phone, at the plant. A check-in from someone else’s phone, from outside the plant or typed by hand is flagged. Sheet ' + escHtml(String(cfg.key || '').slice(0, 2)) + ' · ' + escHtml(formatDate(localDateStr())) + '</div></div>';
}
function ckPrint() {
  if (!ckSaveCfg()) return;
  var cfg = ckCfg();
  closeOverlay();
  document.getElementById('invPrintBody').innerHTML = ckSheetHtml(cfg);
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = 'Office QR';
}

function ckAction(action, btn) {
  switch (action) {
    case 'invCkSetup': ckSetupOpen(); return true;
    case 'invCkHere': ckHere(); return true;
    case 'invCkSaveCfg': if (ckSaveCfg()) { closeOverlay(); showToast('Office QR saved'); } return true;
    case 'invCkPrint': ckPrint(); return true;
    case 'invCkRekey': ckRekey(); return true;
    case 'invCkSave': ckSave(); return true;
    case 'invCkFromRelay': ckReviewOpen((typeof _relay !== 'undefined' && _relay && _relay.text) || ''); return true;
  }
  return false;
}
/* A tick changes what Save will do: the label follows. */
document.addEventListener('change', function(e) {
  var el = e.target && e.target.closest && e.target.closest('[data-ck-pick]');
  if (!el || !_ckRows) return;
  var r = _ckRows[+el.dataset.ckPick];
  if (r) r.tick = el.checked;
  var b = document.getElementById('ckSaveBtn');
  if (b) b.textContent = ckSaveLabel();
});
