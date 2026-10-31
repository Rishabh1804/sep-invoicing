/* ===== Messages: one record of every WhatsApp message, and one sorter =====
   (owner, 31 Oct 2026: "We need the pasted whatsapp message to be stored in the app, so that we can read the message in the
   app and make changes and the app can learn what it got wrong"; then a WhatsApp zip read like this chat, every new message
   sorted, and a final confirmation screen.) The readers that exist stay as they are: rolls (relay.js), production
   (prodparse.js), stock (stock.js), cash (cashout.js), check-ins (checkin.js), and so do the stores they save to. This
   module is the one record of every message pasted or imported, and the one place that says which reader takes it.

   THE CONTRACT the Messages screen (msgview.js), the zip reader (wazip.js), the profile (msgprofile.js) and the
   confirmation screen (msgconfirm.js) build to:

   S.messages: [{
     id: 'MSG-…', key: msgKey(m)                 the message once, however often it arrives
     sentBy, sentOn (iso or null), sentAt (the minute on sentOn as relaySplit and wazip give it, or epoch ms; or null), text, edited
     src: 'paste' | 'zip', importId (S.msgImports id or null)
     kind: MSG_KINDS id, conf: 0..1, why: words   what the sorter said (msgSort), kept as of the last read
     status: 'new' | 'saved' | 'skipped' | 'notread' | 'dup'
     saved: [{ store, id }]                        the records it made, where the reader's save says
     textWas: [{ text, at, by }]                   each edit of its text, the text before
     fix: { kind, at, by } | null                  the owner's word on its kind, which wins over the sorter
     at, by                                        when and by whom it was taken in
   }]
   S.msgImports: [{ id, at, by, file, chat, first, last, total, added, seen, skippedOld, inBook, media, system, order, kinds }]
     (wazip.js: what each import read, cut and took; see its head)
   S.msgProfile: kept by msgprofile.js (how each sender sends messages), never by this module.

   Names here are msg*; the four modules' own are mv* (msgview), wz* (wazip), mp* (msgprofile), mc* (msgconfirm). */

var MSG_KINDS = [
  { id: 'in', label: 'In-time roll', where: 'People' },
  { id: 'out', label: 'Out-time roll', where: 'People' },
  { id: 'pickling', label: 'Pickling loads', where: 'Production' },
  { id: 'production', label: 'Barrel production', where: 'Production' },
  { id: 'runs', label: 'Production by slot', where: 'Production' },
  { id: 'power', label: 'Power cut', where: 'Production' },
  { id: 'stock', label: 'Stock message', where: 'Stock' },
  { id: 'cash', label: 'Cash paid out', where: 'Pay' },
  { id: 'checkin', label: 'Office QR check-in', where: 'People' },
  { id: 'payment', label: 'Weekly payment', where: 'Pay' },
  { id: 'other', label: 'Not read', where: '' }
];
function msgKindLabel(id) { var k = MSG_KINDS.find(function(x) { return x.id === id; }); return k ? k.label : 'Not read'; }

function msgStore() { if (!Array.isArray(S.messages)) S.messages = []; return S.messages; }
function msgImports() { if (!Array.isArray(S.msgImports)) S.msgImports = []; return S.msgImports; }
/* The message once: its sender, the minute it was sent and its words. A repost later is another message (the readers
   refuse it as already read, as they always have); the same export imported twice is the same messages. */
function msgKey(m) {
  // `sentAt` is epoch ms from a zip, or the minute of the day from a paste (relaySplit's reading): a minute of the day is kept
  // with its day, or the same words sent on two days (the pickling hand's same load) read as one message and the second was lost.
  var minute = m.sentAt > 1e7 ? Math.floor(m.sentAt / 60000) : (m.sentOn || '') + (m.sentAt != null ? '@' + m.sentAt : '');
  return relayHash(String(m.sentBy || '').trim().toUpperCase() + '|' + minute + '|' + String(m.text || ''));
}

/* The sorter. Each reader is asked in the order the floor's messages are told apart today (relayRead, addDescribe), so the
   sorter and the paste box can never disagree: a check-in, a roll, cash, the weekly payment summary, production's kinds,
   stock. Pure but for the book's readers. Returns { kind, conf, why } and, for a message no reader takes, `like`: the kind it
   looks like, when it looks like one. A message no reader takes is 'other' (Not read), never dropped; its `conf` is how sure the
   sorter is that nothing in it is for a reader (a photo with no words, the chat's own notice), its `why` what it is.
   msgprofile.js tunes `conf` from how the sender usually writes (mpConf), when it is loaded.

   Tuned on the group's export of 16 Sep – 31 Oct 2026 (msgprofile.js, docs/MESSAGES.md M2): shapes only, never a name. A roll
   whose date is written with spaces or after a word ("Sunday duty DD/ MM/ YY/ in time") is a dated roll; a roll heading inside
   a sentence of a few lines is a note about a roll, not one; the rest of what no reader takes is said for what it is. */
var MSG_MEDIA = [
  [/^\s*(?:\[forwarded\]\s*)?<album message>\s*$/i, 'a photo album with no words'],
  [/^\s*(?:\[forwarded\]\s*)?<(?:image|video|gif|sticker) omitted>\s*$/i, 'a photo or video with no words'],
  [/^\s*(?:\[forwarded\]\s*)?<(?:audio omitted|voice omitted)>|^\s*\S+\.opus\b/i, 'a voice note'],
  [/^\s*(?:\[forwarded\]\s*)?<document omitted>/i, 'a document (a PDF or a file)'],
  [/^\s*(?:\[forwarded\]\s*)?<contact card omitted>/i, 'a contact card'],
  [/^\s*(?:this message was deleted|you deleted this message)\s*$/i, 'a deleted message'],
  [/^\s*messages and calls are end-to-end encrypted|^\s*(?:-\s*)?\S+ (?:created (?:the|this) group|changed (?:the|this) group)/i, 'the chat’s own notice']
];
var MSG_CAPTION_RE = /^\s*(?:\[forwarded\]\s*)?<(?:image|video|gif|document) omitted>\s*\S/i;
var MSG_DATED_ROLL_RE = /^\s*(?:[a-z]+\s+){0,3}\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}\s*\/*\s*(?:\S+\s+){0,2}?(?:in|out)\s*-*\s*time/i;
function msgSort(m) {
  var text = String(m && m.text || ''), out;
  if (m && m.fix && m.fix.kind) return { kind: m.fix.kind, conf: 1, why: 'set by hand' };
  var media = MSG_MEDIA.find(function(x) { return x[0].test(text); });
  if (media) out = { kind: 'other', conf: 0.95, why: media[1] };
  else {
    var rk = relayKind(text), first = (text.split('\n').find(function(l) { return l.trim(); }) || '').trim();
    if (rk === 'checkin') out = { kind: 'checkin', conf: 0.95, why: 'the office QR’s head' };
    else if (rk === 'in' || rk === 'out') out = msgRollSort(rk, text, first);
    else if (typeof cashLooksLike === 'function' && cashLooksLike(text)) out = { kind: 'cash', conf: 0.9, why: 'amounts and the total they add up to' };
    else if (/\bweekly\s+payment\b/i.test(text)) out = { kind: 'payment', conf: 0.9, why: 'the weekly payment summary' };
    else {
      var pk = typeof prodKind === 'function' ? prodKind(text) : 'other';
      if (pk === 'stock' || rk === 'stock') out = { kind: 'stock', conf: 0.85, why: !/c[ae]mical|chemical|stock|\bto\s+soma\b/i.test(text.split('\n').slice(0, 2).join(' ')) && relayIsChemList(text) ? 'chemicals in kilos and litres, with no head' : 'a stock head or a delivery to the plant' };
      else if (pk === 'pickling' || pk === 'production' || pk === 'runs' || pk === 'power') out = { kind: pk, conf: 0.8, why: 'production’s reader: ' + pk };
      else out = msgOtherSort(text, first);
    }
  }
  if (typeof mpConf === 'function') { try { out = mpConf(m, out) || out; } catch (e) { /* a profile never stops a sort */ } }
  return out;
}
/* A roll: its own dated head is surest; a heading with no date is a roll by its words; a roll heading inside a sentence of a few
   lines ("the date written yesterday was today's out time") is a note about a roll, and is kept as the kind the paste box
   reads it as, with little confidence, so the confirmation screen asks. */
function msgRollSort(rk, text, first) {
  if (RELAY_ROLL_HEAD_RE.test(text) || MSG_DATED_ROLL_RE.test(first)) return { kind: rk, conf: 0.95, why: 'a dated roll head' };
  var lines = text.split('\n').filter(function(l) { return l.trim(); }).length;
  var before = first.split(/\b(?:in|out)\s*-*\s*time/i)[0].trim().split(/\s+/).filter(function(w) { return /[a-z]/i.test(w); }).length;
  if (lines <= 3 && before >= 4) return { kind: rk, conf: 0.35, why: 'reads like a note about a roll, not a roll' };
  return { kind: rk, conf: 0.8, why: 'an in/out time heading' };
}
/* What a message no reader takes is, in words, and the kind it looks like where it looks like one. */
function msgOtherSort(text, first) {
  var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
  var qty = /\d+(?:\.\d+)?\s*(?:nos|no|pcs|kg|kgs)\b/i;
  if (MSG_CAPTION_RE.test(text)) return { kind: 'other', conf: 0.6, why: 'a photo’s caption: no reader takes it' };
  if (/^\s*\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}\/*\s*(?:sunday\s*of+|holiday|off\b|chhutti|closed)/i.test(first) && lines.length <= 3) return { kind: 'other', conf: 0.6, why: 'a dated notice that the plant is off' };
  if (/^\s*[a-z]*\s*production\b/i.test(first) && lines.slice(1).some(function(l) { return qty.test(l); })) return { kind: 'other', conf: 0.2, like: 'production', why: 'a production block sent apart from its roll: no reader takes it alone' };
  if (lines.length >= 2 && lines.length <= 6 && /-{1,}\s*\d{1,2}[:.]\d{2}\s*(?:a\.?m|p\.?m)?\.?\s*$/i.test(lines[lines.length - 1])) return { kind: 'other', conf: 0.2, like: 'pickling', why: 'a load and a time, with no “pickling time” written' };
  if (/\bin\s*c?o?ming\b/i.test(first) && typeof PROD_CHEM_IN_RE !== 'undefined' && PROD_CHEM_IN_RE.test(first)) return { kind: 'other', conf: 0.3, like: 'stock', why: 'a chemical delivery with no figures' };
  if (!/\d/.test(text) && lines.length <= 3) return { kind: 'other', conf: 0.6, why: 'words with no figures: a line of conversation' };
  return { kind: 'other', conf: 0, why: 'no reader takes it' };
}

/* Take messages in (relaySplit's shape: sentBy, sentOn, sentAt, text, edited). Each new one is sorted and kept; one the
   book holds already is counted, not added. Writes nothing to disk: the caller saves. Returns { added: [records], seen }. */
function msgIngest(list, src, importId) {
  var have = {}, out = { added: [], seen: 0 };
  msgStore().forEach(function(r) { have[r.key] = r; });
  var by = typeof grdUserId === 'function' ? grdUserId() : null, at = Date.now();
  (list || []).forEach(function(m) {
    if (!m || !String(m.text || '').trim()) return;
    var key = msgKey(m);
    if (have[key]) { out.seen++; return; }
    var r = { id: 'MSG-' + at.toString(36) + Math.random().toString(36).slice(2, 7), key: key, sentBy: m.sentBy || '', sentAt: m.sentAt != null ? m.sentAt : null,
      sentOn: m.sentOn || null, text: String(m.text), edited: !!m.edited, src: src || 'paste', importId: importId || null,
      status: 'new', saved: [], textWas: [], fix: null, at: at, by: by };
    var s = msgSort(r);
    r.kind = s.kind; r.conf = s.conf; r.why = s.why;
    if (r.kind === 'other') r.status = 'notread';
    have[key] = r;
    msgStore().push(r);
    out.added.push(r);
  });
  return out;
}
/* A message's record by id, and the records it made, once its reader has saved them. */
function msgById(id) { return msgStore().find(function(r) { return r.id === id; }) || null; }
function msgMarkSaved(id, store, recId) {
  var r = msgById(id);
  if (!r) return;
  r.status = 'saved';
  if (store) r.saved.push({ store: store, id: recId || null });
}

/* Every msg-screen action (invMsg…) comes here from events.js and goes to the module that owns it. */
function msgAction(action, btn) {
  var fns = [typeof mvAction === 'function' ? mvAction : null, typeof wzAction === 'function' ? wzAction : null,
    typeof mcAction === 'function' ? mcAction : null, typeof mpAction === 'function' ? mpAction : null];
  for (var i = 0; i < fns.length; i++) if (fns[i] && fns[i](action, btn)) return true;
  return false;
}
