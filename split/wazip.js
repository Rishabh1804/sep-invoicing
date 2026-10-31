/* ===== The WhatsApp export read: the zip, its chat, the new messages (wz*) =====
   Built to the contract in msgstore.js. Owner, 31 Oct 2026: a WhatsApp zip read "like we do here on this chat", for the
   app's one group chat; the first import "from the last message of each kind the book already holds".

   wzUnzip(buf) → Promise<[{ name, bytes }]>: the zip's text entries, stored or deflated (xlsx.js's own directory reader and
     inflate). Media beside the chat is counted (wzZipList) and never read.
   wzParseChat(text) → { msgs, order, orderWhy, system, media, deleted, edited, lines }: the chat's messages in relaySplit's
     shape ({ sentBy, sentOn, sentAt: minute on sentOn, text, edited, wa }), the day-first or month-first order decided once
     for the whole file, and what was dropped (WhatsApp's own lines, media, deleted messages).
   wzImportFile(file) → Promise<record | null>: the guard, the file read, unzipped and parsed, the messages cut to the new
     ones (wzCut), taken in (msgIngest(…, 'zip', id)), the import recorded (S.msgImports) and saved, then the confirmation
     screen (mcOpen) where it is loaded, else a toast.

   Add → File routes a zip holding a chat here, and a bare WhatsApp .txt export (add.js addFileKind, addTextKind). */

var WZ_MAX_BYTES = 50 * 1024 * 1024;
var WZ_BIDI_RE = /[‎‏‪-‮⁦-⁩﻿]/g;
// A message's own line: iPhone "[10/28/26, 11:32:38 AM] Name: text", Android "28/10/26, 11:32 am - Name: text", the clock
// 12- or 24-hour. Without the bracket, the dash is required: a floor message's own line "28/10/26 10:30 power cut" is text.
var WZ_HEAD_BR_RE = /^\s*\[(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([AaPp]\.?\s?[Mm]\.?)?\]\s?(?:-\s)?(.*)$/;
var WZ_HEAD_DASH_RE = /^\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([AaPp]\.?\s?[Mm]\.?)?\s+-\s(.*)$/;
// What WhatsApp writes in place of a message: media left out of the export, an attachment's own line, a deleted message.
var WZ_MEDIA_RE = /^(image|video|audio|sticker|gif|document|contact card) omitted$|^<attached:\s*[^>]*>$|^\S.{0,120}\.(jpe?g|png|webp|gif|heic|mp4|3gp|mov|opus|ogg|m4a|mp3|aac|pdf|docx?|xlsx?|vcf|webm)\s*\(file attached\)$/i;
// iPhone's marker opens the line, and what follows it is the caption ("<image omitted> 120 kg"), or a document's file name.
var WZ_MEDIA_HEAD_RE = /^<\s*(media|image|video|audio|sticker|gif|document|contact card|voice message|video note|album message)(\s+omitted)?\s*>\s*(.*)$/i;
var WZ_FILE_NAME_RE = /^\S.{0,160}\.(jpe?g|png|webp|gif|heic|mp4|3gp|mov|opus|ogg|m4a|mp3|aac|pdf|docx?|xlsx?|vcf|webm|zip|txt)$/i;
var WZ_DELETED_RE = /^(this message was deleted|you deleted this message|null|waiting for this message[.\s\S]*)$/i;
var WZ_SYSTEM_RE = /^(messages and calls are end-to-end encrypted|messages to this group are now secured|.{1,80}\s(created group|created this group|added|removed|left|joined using|changed the subject|changed this group|changed the group|changed their phone number|changed to|is now an admin|pinned a message|turned (on|off) disappearing)|you (created|were added|joined|left|added|removed)|missed (voice|video) call)/i;

/* ---------- 1. The zip ---------- */
/* The zip's entries from its own directory (xlsx.js _xlsxZipDir): the text ones, and the media counted, never read. */
function wzZipList(buf) {
  var dir;
  try { dir = _xlsxZipDir(buf); } catch (e) { throw new Error('The zip cannot be read: it is incomplete or damaged'); }
  var out = { texts: [], media: 0, xlsx: !!dir['xl/workbook.xml'] };
  Object.keys(dir).forEach(function(name) {
    var base = name.split('/').pop();
    if (!base || /\/$/.test(name) || /^__MACOSX\//.test(name) || /^\._/.test(base)) return;
    var e = dir[name];
    if (/\.(txt|md)$/i.test(base)) out.texts.push({ name: name, base: base, method: e.method, size: e.size, usize: e.usize, at: e.at });
    else out.media++;
  });
  return out;
}
/* Which text is the chat: _chat.txt (an iPhone's export), then "WhatsApp Chat….txt" (an Android's), then the largest .txt;
   a .md only where the zip has no .txt at all (the owner's export carries the chat as both). */
function wzChatEntry(texts) {
  var txt = texts.filter(function(t) { return /\.txt$/i.test(t.base); }), pool = txt.length ? txt : texts;
  var by = function(re) { return pool.filter(function(t) { return re.test(t.base); }); };
  var big = function(a) { return a.slice().sort(function(x, y) { return (y.usize || y.size) - (x.usize || x.size); })[0] || null; };
  return big(by(/^_chat\.txt$/i)) || big(by(/^WhatsApp Chat.*\.txt$/i)) || big(pool);
}
/* Whether a zip carries a chat, from its directory alone (Add → File asks before it reads): a text entry and no workbook. */
function wzHasChat(buf) {
  try { var l = wzZipList(buf); return !l.xlsx && !!wzChatEntry(l.texts); } catch (e) { return false; }
}
async function wzEntryBytes(buf, e) {
  var dv = new DataView(buf);
  if (e.at + 30 > buf.byteLength || dv.getUint32(e.at, true) !== 0x04034B50) throw new Error(e.name + ' cannot be found in the zip');
  var start = e.at + 30 + dv.getUint16(e.at + 26, true) + dv.getUint16(e.at + 28, true);
  if (start + e.size > buf.byteLength) throw new Error(e.name + ' runs past the end of the zip');
  var raw = new Uint8Array(buf, start, e.size);
  if (e.method === 0) return new Uint8Array(raw);
  if (e.method !== 8) throw new Error(e.name + ' is packed in a way the app does not read (method ' + e.method + ')');
  if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open a zip: export the chat as a .txt (Export chat → Without media)');
  return _xlsxInflate(raw);
}
/* The zip's text entries, each read (stored as is, deflated through the browser). `names`, when given, reads those alone. */
async function wzUnzip(buf, names) {
  var l = wzZipList(buf), out = [];
  for (var i = 0; i < l.texts.length; i++) {
    var e = l.texts[i];
    if (names && names.indexOf(e.name) < 0) continue;
    out.push({ name: e.name, bytes: await wzEntryBytes(buf, e) });
  }
  return out;
}

/* ---------- 2. The chat ---------- */
function wzHead(line) {
  var m = WZ_HEAD_BR_RE.exec(line), br = true;
  if (!m) { m = WZ_HEAD_DASH_RE.exec(line); br = false; }
  if (!m) return null;
  var h = +m[4], min = +m[5], ap = m[6] ? m[6].replace(/[\s.]/g, '').toLowerCase() : '';
  if (min > 59 || h > 23 || (ap && (h < 1 || h > 12))) return null;
  if (ap) h = h % 12 + (ap.charAt(0) === 'p' ? 12 : 0);
  return { a: +m[1], b: +m[2], y: +m[3], min: h * 60 + min, br: br, wa: line.slice(0, line.length - m[7].length), rest: m[7] };
}
/* Day-first or month-first, once for the whole file: a first figure over 12 is a day, a second over 12 a day; where the
   file says neither (or both, a broken line), the order its messages ran in. */
function wzDateOrder(heads) {
  var aHi = heads.some(function(h) { return h.a > 12; }), bHi = heads.some(function(h) { return h.b > 12; });
  if (aHi && !bHi) return { order: 'day-first', why: 'a day over 12 is written first' };
  if (bHi && !aHi) return { order: 'month-first', why: 'a day over 12 is written second' };
  var run = function(dayFirst) {
    var n = 0, prev = '';
    heads.forEach(function(h) {
      var iso = dayFirst ? isoFromDmy(h.a, h.b, h.y) : isoFromDmy(h.b, h.a, h.y);
      if (!iso) { n -= 2; return; }
      if (prev && iso >= prev) n++;
      prev = iso;
    });
    return n;
  };
  var d = run(true), m = run(false);
  if (m > d) return { order: 'month-first', why: 'the dates run in order read month first' };
  if (d > m) return { order: 'day-first', why: 'the dates run in order read day first' };
  return heads.length && heads[0].br && !aHi ? { order: 'month-first', why: 'nothing tells them apart: an iPhone’s bracketed export' }
    : { order: 'day-first', why: 'nothing tells them apart: day first, as the shop writes dates' };
}
function wzParseChat(text) {
  var lines = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n'), raw = [], cur = null;
  lines.forEach(function(line) {
    var h = wzHead(line);
    if (h) { cur = { h: h, lines: [h.rest] }; raw.push(cur); return; }
    if (cur) cur.lines.push(line);
    // A line before the first message (an export's own head, "Messages and calls are end-to-end encrypted…") is WhatsApp's.
  });
  var ord = wzDateOrder(raw.map(function(r) { return r.h; })), dayFirst = ord.order === 'day-first';
  var out = { msgs: [], order: ord.order, orderWhy: ord.why, system: 0, media: 0, deleted: 0, edited: 0, lines: lines.length };
  raw.forEach(function(r) {
    // "Name: text". A line with no sender is WhatsApp's own (the chat made, someone added or gone, the subject changed), and
    // so is one whose "sender" holds a quote (Android's "Alfa changed the subject from "a: b"").
    var sm = /^([^:\n]{1,60}?):[ \u00a0]?([\s\S]*)$/.exec(r.lines[0]);
    if (!sm || /["“”]/.test(sm[1]) || !sm[1].replace(WZ_BIDI_RE, '').trim()) { out.system++; return; }
    var sentBy = sm[1].replace(WZ_BIDI_RE, '').trim(), firstText = sm[2];
    // On an iPhone, WhatsApp's own lines come under the group's name, their text opening on an unseen mark (U+200E).
    if (/^\s*\u200e/.test(firstText) && WZ_SYSTEM_RE.test(firstText.replace(WZ_BIDI_RE, '').trim())) { out.system++; return; }
    var edited = false, media = 0;
    // A message forwarded from another chat says so first ("[Forwarded] …"); its words are what was sent, as a copy reads.
    var kept = [firstText.replace(/^(\s*\u200e)?\s*\[forwarded\]\s*/i, '')].concat(r.lines.slice(1)).map(function(l) {
      return l.replace(WZ_BIDI_RE, '').replace(/\s*<this message was edited>\s*$/i, function() { edited = true; return ''; });
    }).map(function(l) {
      var t = l.trim(), mh = WZ_MEDIA_HEAD_RE.exec(t);
      if (WZ_MEDIA_RE.test(t)) { media++; return null; }
      if (!mh) return l;
      media++;
      return mh[3] && !WZ_FILE_NAME_RE.test(mh[3].trim()) ? mh[3] : null;
    }).filter(function(l) { return l != null; });
    var body = kept.join('\n').trim();
    if (!body.trim()) { if (media) out.media++; else out.system++; return; }
    if (WZ_DELETED_RE.test(body.trim())) { out.deleted++; return; }
    if (edited) out.edited++;
    var sentOn = dayFirst ? isoFromDmy(r.h.a, r.h.b, r.h.y) : isoFromDmy(r.h.b, r.h.a, r.h.y);
    out.msgs.push({ sentBy: sentBy, sentOn: sentOn, sentAt: r.h.min, text: body, edited: edited, wa: r.h.wa + sentBy + ': ' });
  });
  return out;
}
/* Whether a text file is a WhatsApp export: its first message line comes among its first lines, and messages are read. */
function wzLooksLikeChat(text) {
  var head = String(text || '').replace(/^﻿/, '').split(/\r?\n/).slice(0, 8);
  if (!head.some(function(l) { return wzHead(l); })) return false;
  try { return wzParseChat(String(text).slice(0, 200000)).msgs.length > 0; } catch (e) { return false; }
}

/* ---------- 3. The new ones ---------- */
/* A moment as minutes since 1970 on the shop's calendar: the day, and the minute on it. */
function wzMoment(iso, min) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 60000 + (min != null && isFinite(min) ? +min : 0);
}
/* Where each kind's last message in the book is: the latest of the Messages record's own and of the kind's own store (rolls:
   the rolls pasted; production: its pastes and the entries they made; stock: its messages; cash: the cash messages). A
   record that keeps only its day counts from that day's start, so the whole day is read again: what a reader has read it
   refuses as read, and a message is never lost to a guess at its minute. */
var WZ_PROD_KINDS = ['pickling', 'production', 'runs', 'power'];
function wzAnchors() {
  var a = {};
  var put = function(kind, iso, min, src) {
    var t = wzMoment(iso, min);
    if (t == null || !kind) return;
    if (min == null) t -= 1;
    if (!a[kind] || t > a[kind].t) a[kind] = { t: t, iso: iso, min: min == null ? null : min, src: src };
  };
  msgStore().forEach(function(r) { put(r.fix && r.fix.kind || r.kind, r.sentOn, r.sentAt, 'messages'); });
  (Array.isArray(S.relayPastes) ? S.relayPastes : []).forEach(function(p) {
    if (p.kind === 'in' || p.kind === 'out') put(p.kind, p.sentOn || p.date, p.sentOn && p.sentAt != null ? p.sentAt : null, 'rolls');
  });
  var pr = S.production || {}, pk = {};
  (pr.pastes || []).forEach(function(p) {
    pk[p.id] = p.kind;
    if (WZ_PROD_KINDS.indexOf(p.kind) >= 0) put(p.kind, p.sentOn || p.day, null, 'production');
  });
  (pr.entries || []).forEach(function(e) {
    if (e.voidedAt) return;
    var k = e.pasteId && pk[e.pasteId] ? pk[e.pasteId] : e.basis === 'pickling' ? 'pickling'
      : e.basis === 'relay' ? (e.kind === 'downtime' ? 'power' : e.kind === 'plated' ? 'production' : '') : '';
    if (WZ_PROD_KINDS.indexOf(k) >= 0) put(k, e.date, null, 'production');
  });
  (S.stock && Array.isArray(S.stock.pastes) ? S.stock.pastes : []).forEach(function(p) { put('stock', p.sentOn || p.to || p.from, null, 'stock'); });
  (Array.isArray(S.cashPastes) ? S.cashPastes : []).forEach(function(p) { if (!p.voidedAt) put('cash', p.sentOn, null, 'cash'); });
  return a;
}
/* The texts the book's stores already hold, as their readers keep them: a message saying the same is read already. */
function wzBookTexts() {
  var seen = {}, add = function(t) { if (t && String(t).trim()) seen[relayHash(t)] = true; };
  (S.relayPastes || []).forEach(function(p) { add(p.text); });
  ((S.production || {}).pastes || []).forEach(function(p) { add(p.text); });
  ((S.stock || {}).pastes || []).forEach(function(p) { add(p.text); });
  (S.cashPastes || []).forEach(function(p) { add(p.text); });
  return seen;
}
/* The messages cut to the new ones: each sorted (msgSort), new when sent after the last of its kind the book holds. A kind the
   book holds none of is taken whole. Returns { fresh, skippedOld, inBook, kinds: { kind: { taken, skipped, from, src } }, none }. */
function wzCut(msgs) {
  var a = wzAnchors(), texts = wzBookTexts(), out = { fresh: [], skippedOld: 0, inBook: 0, kinds: {}, none: !Object.keys(a).length };
  msgs.forEach(function(m) {
    var kind = msgSort(m).kind, an = a[kind], t = wzMoment(m.sentOn, m.sentAt);
    var k = out.kinds[kind] || (out.kinds[kind] = { taken: 0, skipped: 0, from: an ? an.iso : null, src: an ? an.src : null });
    if (an && (t == null || t <= an.t)) { k.skipped++; out.skippedOld++; return; }
    if (texts[relayHash(m.text)]) { k.skipped++; out.inBook++; return; }
    k.taken++;
    out.fresh.push(m);
  });
  return out;
}

/* ---------- 4. The import ---------- */
function wzRefuse(title, body) {
  if (typeof uiAlert === 'function') uiAlert({ title: title, body: body });
  return null;
}
/* A file picked (Add → File, Messages' own Import): a zip or a bare .txt export. */
async function wzImportFile(file, opts) {
  if (!file) return null;
  if (file.size > WZ_MAX_BYTES) return wzRefuse('The export is too large', (file.name || 'The file') + ' is ' + (Math.round(file.size / 104857.6) / 10) + ' MB; the app reads up to 50 MB. In WhatsApp, export the chat again with Without media.');
  var buf;
  try { buf = await file.arrayBuffer(); } catch (e) { return wzRefuse('The file could not be read', (file.name || 'The file') + ': ' + ((e && e.message) || 'the browser could not read it') + '.'); }
  return wzImportBuf(buf, file.name || '', opts);
}
/* The file's bytes (or its text) read, cut and taken in. `opts.guarded` when the guard has already answered (Add → File). */
async function wzImportBuf(src, name, opts) {
  opts = opts || {};
  if (!opts.guarded && typeof addFileGuardOk === 'function' && !(await addFileGuardOk('whatsapp'))) return null;
  var text = '', chatName = '', media = 0;
  var bytes = typeof src === 'string' ? null : src instanceof ArrayBuffer ? src : src && src.buffer ? src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength) : null;
  if (bytes && bytes.byteLength > WZ_MAX_BYTES) return wzRefuse('The export is too large', (name || 'The file') + ' is over 50 MB, which the app reads at most. In WhatsApp, export the chat again with Without media.');
  if (bytes && new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength)).join(',') === '80,75,3,4') {
    var l;
    try { l = wzZipList(bytes); } catch (e) { return wzRefuse('Not a WhatsApp export', (name || 'The zip') + ': ' + e.message + '.'); }
    var ent = l.xlsx ? null : wzChatEntry(l.texts);
    if (!ent) return wzRefuse('No chat in the zip', (name || 'The zip') + ' holds ' + (l.xlsx ? 'an Excel workbook' : l.media ? todoPlural(l.media, 'file') + ' and no chat text' : 'nothing') + '. WhatsApp’s export holds the chat as a .txt (Export chat in the group’s menu).');
    if ((ent.usize || 0) > WZ_MAX_BYTES) return wzRefuse('The chat is too large', ent.base + ' is over 50 MB, which the app reads at most.');
    media = l.media;
    try { text = new TextDecoder('utf-8').decode((await wzUnzip(bytes, [ent.name]))[0].bytes); } catch (e) { return wzRefuse('The chat could not be read', ent.base + ': ' + ((e && e.message) || 'it could not be opened') + '.'); }
    chatName = ent.base;
  } else {
    text = typeof src === 'string' ? src : new TextDecoder('utf-8').decode(bytes || new ArrayBuffer(0));
    chatName = name || '';
  }
  var chat = wzParseChat(text);
  if (!chat.msgs.length) return wzRefuse('No WhatsApp messages in it', (chatName || name || 'The file') + ' has no line WhatsApp writes for a message (its date, time and sender). In WhatsApp, open the group, open its menu and pick Export chat.');
  var cut = wzCut(chat.msgs), id = 'WZ-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var got = msgIngest(cut.fresh, 'zip', id), on = chat.msgs.map(function(m) { return m.sentOn; }).filter(Boolean).sort();
  var rec = { id: id, at: Date.now(), by: typeof grdUserId === 'function' ? grdUserId() : null, file: name || '', chat: wzChatTitle(name, chatName),
    first: on[0] || null, last: on[on.length - 1] || null, total: chat.msgs.length, added: got.added.length, seen: got.seen,
    skippedOld: cut.skippedOld, inBook: cut.inBook, media: media + chat.media, system: chat.system, deleted: chat.deleted,
    order: chat.order, orderWhy: chat.orderWhy, none: cut.none, kinds: cut.kinds };
  msgImports().push(rec);
  var saved = typeof saveState === 'function' ? await saveState() : true;
  if (saved === false) return rec;
  if (typeof mcOpen === 'function' && rec.added) mcOpen({ importId: id });
  else if (rec.added) showToast(wzSaid(rec));
  else uiAlert({ title: 'Nothing new in the export', body: wzSaid(rec) });
  return rec;
}
/* The chat's name: the group in an Android export's file name ("WhatsApp Chat with <group>.txt"), else the zip's. */
function wzChatTitle(file, entry) {
  var m = /^WhatsApp Chat (?:with|-)\s*(.+?)\.(txt|zip)$/i.exec(entry || '') || /^WhatsApp Chat (?:with|-)\s*(.+?)\.(txt|zip)$/i.exec(file || '');
  return m ? m[1] : String(file || entry || '').replace(/\.(zip|txt)$/i, '');
}
/* What an import did, in a line. */
function wzSaid(rec) {
  var bits = [rec.added ? todoPlural(rec.added, 'new message') + ' taken in' : 'No new message'];
  var old = rec.skippedOld + rec.inBook + rec.seen;
  if (old) bits.push(todoPlural(old, 'older message') + ' skipped');
  if (rec.media) bits.push(todoPlural(rec.media, 'media file') + ' not read');
  return bits.join(' · ') + (rec.none ? ' · the book held no messages yet, so every one was taken' : '') + '.';
}

/* ---------- 5. Its own door ---------- */
/* An import started from a screen of its own (the Messages screen's Import): the file picker, then wzImportFile. */
function wzPick() {
  var inp = document.getElementById('wzFileInput');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file'; inp.id = 'wzFileInput'; inp.className = 'inv-hidden'; inp.accept = '.zip,.txt,application/zip,text/plain';
    inp.setAttribute('data-nodirty', ''); inp.tabIndex = -1; inp.setAttribute('aria-hidden', 'true');
    inp.addEventListener('change', function() { var f = inp.files && inp.files[0]; inp.value = ''; if (f) wzImportFile(f); });
    document.body.appendChild(inp);
  }
  inp.value = '';
  inp.click();
}
function wzAction(action) {
  if (action === 'invMsgZipPick') { wzPick(); return true; }
  return false;
}
