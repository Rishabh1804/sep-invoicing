/* ===== How each sender sends messages, learnt from every message the book holds (mp*) =====
   Built to the contract in msgstore.js (owner, 31 Oct 2026: "analyse every bit of chat data from the zip that we have and profile
   how they send messages, so that the parser keeps evolving with future uploads of zip files"). Nobody is written in here: the
   profile is learnt from the book's own messages (msgStore()), and grows with every paste and every zip taken in.

   S.msgProfile = { v, n, lastId, sig, at, senders: { <SENDER KEY>: {
     name                      the sender as first written
     n, first, last            messages, and the first and last day sent
     kinds: { kind: n }        what they send (the owner's word on a kind wins over the sorter's)
     hours: { kind: { h: n } } at which hour of the day, kind by kind
     days:  { kind: { 0..6: n } } on which weekday (0 Sunday)
     shapes: { kind: { shape: n } } how the message opens (mpShape: "date · out time", "words", "chemical · date" …)
     lines: { kind: { min, max, sum, n } } how long, in lines
     spell: { word: { as written: n } } how the shop's words are spelt (in time, out time, chemical, pickling time, power cut …)
     split: { kind: n }        a report carried on in another message within 20 minutes, with no head of its own
     joined: { kind: n }       one message carrying another kind as well (a roll with its production block or its stock)
     fixed: { kind: n }        later corrected: its kind set by hand (r.fix) or its text edited (r.textWas)
     notread: n, media: n      no reader takes it; a photo, a document, a deleted message
   } } }

   mpLearn() builds it (a memo: nothing is read again until the book or the store changes; a message added is folded in, a
   correction read again from the start). mpConf(m, out) moves the sorter's confidence by how the sender usually writes the kind,
   in words. mpKindConf(kind, sender) is the share of a kind's messages of the last 60 days read with no correction, which the
   confirmation screen sets against 90%. mpSender(name) and mpSenderHtml(name) say how one sender sends messages. */

var MP_V = 1;
var MP_MIN = 8;                 // messages from a sender before the profile moves a confidence
var MP_SPLIT_MIN = 20;          // a report carried on within this many minutes is one report split over two messages
var MP_KIND_DAYS = 60;          // mpKindConf's window
var MP_SPELL = [
  ['in time', /\bin\s*-*\s*time(?![a-z])/gi],
  ['out time', /\bout\s*-*\s*time(?![a-z])/gi],
  ['chemical', /\b(?:c[ae]mi?c[ae]?l|chemicals?)\b/gi],
  ['pickling time', /\bp\w{0,2}[ckx]{1,2}l\w*\s*t\w*me\b/gi],
  ['power cut', /\bp[ao]\s?w[ae]r\s*-*\s*(?:cut|cat|cute)\b/gi],
  ['power back', /\bp[ao]\s?w[ae]r\s*-*\s*(?:in|back|on)\b/gi],
  ['barrel', /\bb[ae]r+[ae]*l+\b/gi],
  ['incoming', /\bin\s?c?o?ming\b/gi],
  ['production', /\bprod\w*ion\b/gi]
];
/* The words a first line is told by, in the order they are looked for. */
var MP_SHAPE_WORDS = [
  ['in time', /\bin\s*-*\s*time(?![a-z])/i], ['out time', /\bout\s*-*\s*time(?![a-z])/i], ['pickling time', /\bp\w{0,2}[ckx]{1,2}l\w*\s*t\w*me\b/i],
  ['chemical', /\b(?:c[ae]mi?c[ae]?l|chemicals?)\b/i], ['incoming', /\bin\s?c?o?ming\b/i], ['to the plant', /\bto\s+soma\b/i],
  ['power', /\bp[ao]\s?w[ae]r\b/i], ['barrel', /\bb[ae]r+[ae]*l+\b/i], ['production', /\bprod\w*ion\b/i], ['update', /\bupdated?\b/i],
  ['payment', /\bpayment\b/i], ['use', /\buse[ds]?\b/i], ['stock', /\bstocks?\b/i], ['night', /\bnight\b/i], ['morning', /\bmorning\b/i],
  ['sunday', /\bsunday\b/i], ['total', /\btotal\b/i]
];
var MP_MEDIA_RE = /^\s*(?:\[forwarded\]\s*)?(?:<(?:album message|image omitted|video omitted|gif omitted|sticker omitted|audio omitted|document omitted|contact card omitted)>|this message was deleted|you deleted this message)/i;
var _mpMemo = null;
var MP_PLURAL = { 'in': 'in-time rolls', out: 'out-time rolls', pickling: 'pickling loads', production: 'barrel lists', runs: 'production slot logs',
  power: 'power cut messages', stock: 'stock messages', cash: 'cash accounts', checkin: 'office QR check-ins', payment: 'weekly payment summaries', other: 'messages no reader takes' };
function mpPlural(k) { return MP_PLURAL[k] || String(k); }

function mpKey(name) { return String(name || '').replace(/\s+/g, ' ').trim().toUpperCase(); }
/* A message's kind as it stands: the owner's word, else the sorter's. */
function mpKindOf(r) { return r && r.fix && r.fix.kind ? r.fix.kind : (r && r.kind) || 'other'; }
/* The minute and hour a message was sent: `sentAt` is epoch ms from a zip, or the minute of the day from a paste
   (relaySplit's reading); null where neither is known. */
function mpHourOf(r) {
  if (!r || r.sentAt == null) return null;
  if (r.sentAt > 1e7) return new Date(r.sentAt).getHours();
  return r.sentAt >= 0 && r.sentAt < 1440 ? Math.floor(r.sentAt / 60) : null;
}
function mpMinuteOf(r) {
  if (!r || r.sentAt == null) return null;
  if (r.sentAt > 1e7) return Math.floor(r.sentAt / 60000);
  if (!r.sentOn) return null;
  return Math.round(new Date(r.sentOn + 'T00:00:00Z').getTime() / 60000) + r.sentAt;
}
function mpIsoOf(r) {
  if (!r) return null;
  if (r.sentOn) return r.sentOn;
  if (r.sentAt > 1e7) return isoOf(new Date(r.sentAt));
  return r.at ? isoOf(new Date(r.at)) : null;
}
function mpDowOf(iso) { return iso ? new Date(iso + 'T12:00:00').getDay() : null; }
function mpFirstLine(text) { return (String(text || '').split('\n').find(function(l) { return l.trim(); }) || '').trim(); }
function mpLineCount(text) { return String(text || '').split('\n').filter(function(l) { return l.trim(); }).length; }

/* How a message opens, in a few generic words: a date, a dashed rule, the shop's words in the order the first line has them,
   else a numbered line, words or figures. Never a name: "date · out time", "chemical · use · stock", "words". */
function mpShape(text) {
  if (MP_MEDIA_RE.test(mpFirstLine(text)) && !mpFirstLine(text).replace(MP_MEDIA_RE, '').replace(/^\s*>?\s*/, '').trim()) return 'a photo or file';
  var l = mpFirstLine(text).replace(MP_MEDIA_RE, '').trim(), out = [];
  if (/^[\[(]?\s*\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/.test(l)) out.push('date');
  else if (/^\s*[a-z]+(?:\s+[a-z]+){0,2}\s+\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/i.test(l)) out.push('words · date');
  if (/^[\s\-_=*.•]{3,}/.test(l) || /-{3,}/.test(l)) out.push('rule');
  var found = [];
  MP_SHAPE_WORDS.forEach(function(w) { var m = w[1].exec(l); if (m) found.push([m.index, w[0]]); });
  found.sort(function(a, b) { return a[0] - b[0]; }).slice(0, 3).forEach(function(f) { out.push(f[1]); });
  if (out.indexOf('date') < 0 && found.length && /\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/.test(l)) out.push('date');
  if (!found.length && out.indexOf('date') < 0 && out.indexOf('words · date') < 0) {
    if (/^\(?\d{1,3}\s*[).]/.test(l)) out.push('numbered line');
    else if (/[a-z]/i.test(l)) out.push(/\d/.test(l) ? 'words and figures' : 'words');
    else if (/\d/.test(l)) out.push('figures');
  }
  return out.join(' · ') || 'blank';
}

function mpBlank(name) {
  return { name: String(name || '').trim(), n: 0, first: null, last: null, kinds: {}, hours: {}, days: {}, shapes: {}, lines: {},
    spell: {}, split: {}, joined: {}, fixed: {}, notread: 0, media: 0 };
}
function mpInc(map, k, by) { map[k] = (map[k] || 0) + (by || 1); }
function mpSub(map, k) { return map[k] || (map[k] = {}); }
/* What says the store has changed in a way that is not a message added: a kind set by hand, a text edited, a status. */
function mpSig(store, n) {
  var fix = 0, was = 0, nr = 0;
  for (var i = 0; i < n; i++) {
    var r = store[i];
    if (r.fix) fix++;
    was += (r.textWas || []).length;
    if (r.status === 'notread') nr++;
  }
  return n + ':' + fix + ':' + was + ':' + nr;
}
/* Fold one message into its sender's profile. `prev` is the sender's message before it (split habit). */
function mpFold(prof, r, prevOf) {
  var key = mpKey(r.sentBy);
  if (!key) return;
  var p = prof.senders[key] || (prof.senders[key] = mpBlank(r.sentBy));
  var kind = mpKindOf(r), text = String(r.text || ''), iso = mpIsoOf(r), h = mpHourOf(r);
  p.n++;
  if (iso) { if (!p.first || iso < p.first) p.first = iso; if (!p.last || iso > p.last) p.last = iso; }
  mpInc(p.kinds, kind);
  if (h != null) mpInc(mpSub(p.hours, kind), h);
  var dw = mpDowOf(iso);
  if (dw != null) mpInc(mpSub(p.days, kind), dw);
  var shape = mpShape(text);
  mpInc(mpSub(p.shapes, kind), shape);
  var L = mpLineCount(text), ln = p.lines[kind] || (p.lines[kind] = { min: L, max: L, sum: 0, n: 0 });
  ln.min = Math.min(ln.min, L); ln.max = Math.max(ln.max, L); ln.sum += L; ln.n++;
  MP_SPELL.forEach(function(sp) {
    var ms = text.match(sp[1]);
    if (ms) ms.forEach(function(w) { mpInc(mpSub(p.spell, sp[0]), w.replace(/\s+/g, ' ').trim()); });
  });
  if (MP_MEDIA_RE.test(text)) p.media++;
  if (kind === 'other') p.notread++;
  if (r.fix || (r.textWas || []).length) mpInc(p.fixed, kind);
  // One message carrying another kind too: a roll with its production block or the stock written under it.
  // The supervisor writes a slot's work straight under its line ("3301-600 nos"), so a figure in pieces or kilos is production.
  if ((kind === 'in' || kind === 'out') && ((typeof relayStockTail === 'function' && relayStockTail(text)) || /^\s*-*\s*(?:production|work)\s*-*\s*$/im.test(text) ||
      /\d+(?:\.\d+)?\s*(?:nos|pcs|kgs?)\b/i.test(text))) mpInc(p.joined, kind);
  // A report carried on in the next message: the same kind, within 20 minutes, and no head of its own (no date, none of the
  // shop's words on its first line).
  var prev = prevOf[key], at = mpMinuteOf(r);
  if (prev && kind !== 'other' && prev.kind === kind && at != null && prev.at != null && at >= prev.at && at - prev.at <= MP_SPLIT_MIN &&
      !/date|time|chemical|production|update|payment|stock|power|incoming|plant/.test(shape)) mpInc(p.split, kind);
  prevOf[key] = { kind: kind, at: at };
}
/* Build, or extend, the profile from the book's messages. Cheap: nothing is read again while the store and the book are as they
   were; messages added since are folded in; a correction (a kind set by hand, a text edited) reads the store again. Safe on an
   empty book. Returns S.msgProfile. */
function mpLearn() {
  if (!S) return null;
  var store = typeof msgStore === 'function' ? msgStore() : [];
  var writes = typeof _bookWrites !== 'undefined' ? _bookWrites : 0;
  if (_mpMemo && _mpMemo.store === store && _mpMemo.len === store.length && _mpMemo.writes === writes && _mpMemo.prof === S.msgProfile && S.msgProfile && S.msgProfile.v === MP_V) return S.msgProfile;
  var p = S.msgProfile, from = 0;
  var keep = p && p.v === MP_V && p.senders && p.n > 0 && p.n <= store.length && store[p.n - 1] && store[p.n - 1].id === p.lastId && p.sig === mpSig(store, p.n);
  if (keep) from = p.n;
  else p = S.msgProfile = { v: MP_V, n: 0, lastId: null, sig: '', at: 0, senders: {} };
  // The split habit needs each sender's message before: read again from the last few already folded.
  var prevOf = {};
  for (var j = Math.max(0, from - 50); j < from; j++) {
    var q = store[j], k = mpKey(q.sentBy);
    if (k) prevOf[k] = { kind: mpKindOf(q), at: mpMinuteOf(q) };
  }
  for (var i = from; i < store.length; i++) mpFold(p, store[i], prevOf);
  p.n = store.length;
  p.lastId = store.length ? store[store.length - 1].id : null;
  p.sig = mpSig(store, store.length);
  if (from < store.length) p.at = Date.now();
  _mpMemo = { store: store, len: store.length, writes: writes, prof: p };
  return p;
}

/* One sender's profile, with what it comes to: their kinds largest first, the hours each kind is usually sent, how each usually
   opens, its usual length, and the shares corrected and not read. null for a sender the book has no message from. */
function mpSender(name) {
  var prof = mpLearn(), p = prof && prof.senders[mpKey(name)];
  if (!p) return null;
  var kinds = Object.keys(p.kinds).map(function(k) {
    var hrs = p.hours[k] || {}, ln = p.lines[k], shapes = p.shapes[k] || {};
    var hk = Object.keys(hrs).map(Number).sort(function(a, b) { return a - b; });
    // The hours that hold four in five of the kind: its usual window.
    var tot = hk.reduce(function(s, h) { return s + hrs[h]; }, 0), byN = hk.slice().sort(function(a, b) { return hrs[b] - hrs[a]; }), acc = 0, win = [];
    byN.forEach(function(h) { if (acc < tot * 0.8) { win.push(h); acc += hrs[h]; } });
    win.sort(function(a, b) { return a - b; });
    var top = Object.keys(shapes).sort(function(a, b) { return shapes[b] - shapes[a]; });
    return { kind: k, label: typeof msgKindLabel === 'function' ? msgKindLabel(k) : k, n: p.kinds[k], share: p.kinds[k] / p.n,
      hourFrom: win.length ? win[0] : null, hourTo: win.length ? win[win.length - 1] : null, shape: top[0] || null, shapeN: top.length ? shapes[top[0]] : 0,
      lines: ln ? Math.round(ln.sum / ln.n) : null, fixed: p.fixed[k] || 0, joined: p.joined[k] || 0, split: p.split[k] || 0 };
  }).sort(function(a, b) { return b.n - a.n; });
  var fixed = Object.keys(p.fixed).reduce(function(s, k) { return s + p.fixed[k]; }, 0);
  return Object.assign({}, p, { key: mpKey(name), list: kinds, top: kinds.find(function(k) { return k.kind !== 'other'; }) || null,
    fixedShare: p.n ? fixed / p.n : 0, notreadShare: p.n ? p.notread / p.n : 0 });
}

/* The sorter's confidence moved by how the sender usually writes the kind, with the reason in plain words added to `why`. A
   sender with fewer than MP_MIN messages moves nothing; a kind set by hand is never moved. */
function mpConf(m, out) {
  if (!out || !m || out.why === 'set by hand' || !m.sentBy) return out;
  var p = mpSender(m.sentBy);
  if (!p || p.n < MP_MIN) return out;
  var k = out.kind, kn = p.kinds[k] || 0, nm = p.name || 'This sender', up = [], down = [], d = 0;
  if (k === 'other') {
    if (out.conf >= 0.9 || !p.top || p.top.share < 0.8) return out;
    // Not read, from somebody who nearly always sends one kind: less sure it is nothing, and it looks like their usual.
    return Object.assign({}, out, { conf: Math.max(0, Math.round((out.conf - 0.1) * 100) / 100), like: out.like || p.top.kind,
      why: out.why + '; ' + nm + ' mostly sends ' + mpPlural(p.top.kind) });
  }
  if (kn >= 5 && kn / p.n >= 0.2) { d += 0.04; up.push('usual for ' + nm); }
  else if (!kn && p.n >= 10) { d -= 0.15; down.push(nm + ' has not sent one before'); }
  if (kn >= 10) {
    var h = mpHourOf(m), hrs = p.hours[k] || {};
    if (h != null) {
      var near = (hrs[h - 1] || 0) + (hrs[h] || 0) + (hrs[h + 1] || 0);
      if (near / kn < 0.05) { d -= 0.05; down.push('an unusual hour for ' + nm); }
    }
    var shapes = p.shapes[k] || {}, sh = mpShape(m.text);
    if ((shapes[sh] || 0) >= 2) { d += 0.03; up.push('opens as ' + nm + ' usually opens it'); }
    else if (!shapes[sh]) { d -= 0.05; down.push('opens differently from ' + nm + '’s usual'); }
    var ln = p.lines[k], L = mpLineCount(m.text);
    if (ln && ln.n >= 5) {
      if (L < ln.min / 2) { d -= 0.05; down.push('shorter than ' + nm + '’s usual'); }
      else if (L > ln.max * 1.5) { d -= 0.05; down.push('longer than ' + nm + '’s usual'); }
    }
  }
  var fx = p.fixed[k] || 0;
  if (kn >= 4 && fx / kn >= 0.25) { d -= 0.1; down.push(nm + '’s ' + mpPlural(k) + ' are often corrected'); }
  if (!d && !up.length && !down.length) return out;
  var conf = Math.min(0.99, Math.max(0.05, Math.round((out.conf + d) * 100) / 100));
  var words = down.concat(up).slice(0, 2);
  return Object.assign({}, out, { conf: conf, why: out.why + '; ' + words.join('; ') });
}

/* The share of a kind's messages of the last 60 days read with no correction (no kind set by hand, no text edited, not left
   unread), for one sender or all; null when there are none. The confirmation screen sets it against 90%. */
function mpKindConf(kind, sender) {
  var since = isoAddDays(localDateStr(), -MP_KIND_DAYS), key = sender ? mpKey(sender) : null, n = 0, ok = 0;
  (typeof msgStore === 'function' ? msgStore() : []).forEach(function(r) {
    if (key && mpKey(r.sentBy) !== key) return;
    if (r.kind !== kind && !(r.fix && r.fix.kind === kind)) return;
    if (r.status === 'dup') return;
    var iso = mpIsoOf(r);
    if (iso && iso < since) return;
    n++;
    if (!r.fix && !(r.textWas || []).length && r.status !== 'notread') ok++;
  });
  return n ? ok / n : null;
}

function mpHourWords(a, b) {
  var f = function(h) { return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'); };
  if (a == null) return '';
  return a === b ? 'around ' + f(a) : f(a) + ' – ' + f(b + 1 > 23 ? 23 : b + 1);
}
/* A small card: how one sender sends messages, from the profile. */
function mpSenderHtml(name) {
  var p = mpSender(name);
  var head = '<div class="inv-panel-head"><span class="inv-panel-title">How ' + escHtml(String(name || '').trim() || 'this sender') + ' sends messages' +
    (p ? ' <span class="inv-panel-count">' + p.n + '</span>' : '') + '</span></div>';
  if (!p || p.n < MP_MIN) {
    return '<div class="inv-panel inv-panel-flush" data-mp-sender="' + escHtml(mpKey(name)) + '">' + head +
      uiBlankHtml({ kind: 'early', title: p ? 'Only ' + todoPlural(p.n, 'message') + ' so far' : 'No messages from them yet',
        body: 'Their habits are learnt from every message pasted or imported; from ' + MP_MIN + ' on they steady how sure the reading is.', small: !!p }) + '</div>';
  }
  var rows = p.list.filter(function(k) { return k.kind !== 'other'; }).slice(0, 4).map(function(k) {
    var sub = [mpHourWords(k.hourFrom, k.hourTo), k.shape ? 'opens “' + k.shape + '”' : '', k.lines ? 'about ' + todoPlural(k.lines, 'line') : '']
      .filter(Boolean).join(' · ');
    return uiFactRowHtml({ label: k.label, value: k.n, sub: sub, attrs: ' data-mp-kind="' + escHtml(k.kind) + '"' });
  });
  var joined = Object.keys(p.joined).reduce(function(s, k) { return s + p.joined[k]; }, 0);
  var split = Object.keys(p.split).reduce(function(s, k) { return s + p.split[k]; }, 0);
  if (joined) rows.push(uiFactRowHtml({ label: 'With another kind in it', value: joined, sub: 'a roll carrying its production or its stock' }));
  if (split) rows.push(uiFactRowHtml({ label: 'Carried on in the next message', value: split, sub: 'within ' + MP_SPLIT_MIN + ' minutes, with no head of its own' }));
  var fx = Math.round(p.fixedShare * 100);
  rows.push(uiFactRowHtml({ label: 'Corrected later', value: fx + '%', tone: fx >= 10 ? 'warning' : 'ok', sub: fx ? 'its kind set by hand or its text edited' : 'none corrected', attrs: ' data-mp-fixed' }));
  if (p.notread) rows.push(uiFactRowHtml({ label: 'Not read', value: p.notread, sub: p.media ? todoPlural(p.media, 'photo or document', 'photos or documents') + ' with no words among them' : 'no reader takes them', attrs: ' data-mp-notread' }));
  var sp = Object.keys(p.spell).filter(function(w) { return Object.keys(p.spell[w]).length > 1; }).slice(0, 3).map(function(w) {
    var forms = p.spell[w];
    return w + ': ' + Object.keys(forms).sort(function(a, b) { return forms[b] - forms[a]; }).slice(0, 3).join(', ');
  });
  if (sp.length) rows.push(uiFactRowHtml({ label: 'Spellings', value: '', sub: sp.join(' · '), wrap: true, attrs: ' data-mp-spell' }));
  return '<div class="inv-panel inv-panel-flush" data-mp-sender="' + escHtml(mpKey(name)) + '">' + head + rows.join('') + '</div>';
}

/* invMsgProfile (data-sender): the sender's card in a dialog, for the Messages screen and the confirmation screen. */
function mpAction(action, btn) {
  if (action !== 'invMsgProfile') return false;
  var name = btn && btn.dataset ? btn.dataset.sender || '' : '';
  dialogOpen('<div class="inv-dialog" role="dialog" aria-modal="true" aria-label="How they send messages" data-mp-dialog>' + dialogHeadHtml('How they send messages') +
    '<div class="inv-dialog-body">' + mpSenderHtml(name) + '</div></div>', { dismiss: true });
  return true;
}
