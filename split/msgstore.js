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
     sentBy, sentOn (iso or null), sentAt (the minute on sentOn, 0..1439, as relaySplit gives it, or null), text, edited
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
  // The day and the minute on it: sentAt is relaySplit's minute of the day (an epoch ms, should one come, is read as its
  // minute). The minute alone made "OK" sent on two days by one sender one message, and a message at midnight had none.
  var at = m.sentAt == null || m.sentAt === '' ? '' : +m.sentAt > 100000 ? Math.floor(m.sentAt / 60000) : +m.sentAt;
  var minute = (m.sentOn || '') + '@' + at;
  return relayHash(String(m.sentBy || '').trim().toUpperCase() + '|' + minute + '|' + String(m.text || ''));
}

/* The sorter. Each reader is asked in the order the floor's messages are told apart today (relayRead, addDescribe), so the
   sorter and the paste box can never disagree: a check-in, a roll, cash, the weekly payment summary, production's kinds,
   stock. Pure but for the book's readers. Returns { kind, conf, why }. A message no reader takes is 'other' (Not read),
   never dropped. msgprofile.js tunes `conf` from how the sender usually writes (mpConf), when it is loaded. */
function msgSort(m) {
  var text = String(m && m.text || ''), out;
  if (m && m.fix && m.fix.kind) return { kind: m.fix.kind, conf: 1, why: 'set by hand' };
  var rk = relayKind(text);
  if (rk === 'checkin') out = { kind: 'checkin', conf: 0.95, why: 'the office QR’s head' };
  else if (rk === 'in' || rk === 'out') out = { kind: rk, conf: RELAY_ROLL_HEAD_RE.test(text) ? 0.95 : 0.8, why: RELAY_ROLL_HEAD_RE.test(text) ? 'a dated roll head' : 'an in/out time heading' };
  else if (typeof cashLooksLike === 'function' && cashLooksLike(text)) out = { kind: 'cash', conf: 0.9, why: 'amounts and the total they add up to' };
  else if (/\bweekly\s+payment\b/i.test(text)) out = { kind: 'payment', conf: 0.9, why: 'the weekly payment summary' };
  else {
    var pk = typeof prodKind === 'function' ? prodKind(text) : 'other';
    if (pk === 'stock' || rk === 'stock') out = { kind: 'stock', conf: 0.85, why: 'a stock head or a delivery to the plant' };
    else if (pk === 'pickling' || pk === 'production' || pk === 'runs' || pk === 'power') out = { kind: pk, conf: 0.8, why: 'production’s reader: ' + pk };
    else out = { kind: 'other', conf: 0, why: 'no reader takes it' };
  }
  if (typeof mpConf === 'function') { try { out = mpConf(m, out) || out; } catch (e) { /* a profile never stops a sort */ } }
  return out;
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
