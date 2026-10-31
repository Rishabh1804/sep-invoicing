/* ===== The Messages screen: every message, its reading line by line, edited and read again, corrected (mv*) =====
   Built to the contract in msgstore.js. Owner, 31 Oct 2026: "We need the pasted whatsapp message to be stored in the app, so
   that we can read the message in the app and make changes and the app can learn what it got wrong"; and "Both" to editing a
   message's text and correcting its reading.

   - Every paste through the one paste box (relayRead: Add → Paste, People → Paste message, Home) is kept (mvKeepPaste), and a
     reader's save marks the messages it saved (mvSavedFrom: rolls, production, stock, cash paid out). Nothing a reader reads or
     saves is changed.
   - The screen (pageMessages): a top-bar tool beside History and Knowledge, in no workspace. Its verdict, one toolbar row (the
     search; Filter by kind, sender, status and day; More), the list by day; on the desktop the list beside the open message, on
     the phone the message as a sub-view. The address names the message: ?tab=pageMessages&id=MSG-….
   - One message (mvOpen): its text line by line beside what its reader read it as, its kind with the sorter's confidence and
     why, the records it made, its edits. Its text edited and read again shows what the reading would change before anything is
     saved; its kind corrected (`fix`, which wins over the sorter) or marked Not a report. A message a reader saved is handed to
     that reader's own review to read again: the book is never written from here.
   - What the app has learnt from the corrections: each kind set by hand and each heading lesson of the roll reader
     (S.relayLearn), with Forget. Read every message again sorts them all again and lists what moved; it writes no records. */

var _mvOpen = null;          // the message open (the address's id): the desktop's pane, the phone's sub-view
var _mvOpenLabel = '';       // what the back trail calls it
var _mvSearch = '', _mvKind = '', _mvSender = '', _mvStatus = '', _mvDay = '';
var _mvSearchTimer = null;
var _mvEdit = null;          // { id, text, diff: {text, before, after, d} | null } while the text is being edited
var _mvHandoff = null;       // { id, text }: a message handed to its reader; the paste box keeps it as the message it is
var _mvReadCache = { s: null, by: {} };
var _mvCtx = { key: null };   // the readers' contexts (Production's, the roster), worked out once a book write

var MV_STATUS = {
  'new': ['info', 'Not saved'], saved: ['ok', 'Saved'], skipped: ['neutral', 'Not a report'],
  notread: ['warning', 'Not read'], dup: ['neutral', 'Repeat']
};
function mvStatusOf(r) { var s = MV_STATUS[r && r.status] || MV_STATUS['new']; return { tone: s[0], word: s[1] }; }

/* ---------- Taken in, and marked saved ---------- */
/* The paste box's hook (relayRead): every message in the paste kept, whatever the reader does next. A message's own text handed
   to its reader from this screen is that message, not a new one. */
function mvKeepPaste(text) {
  if (!text || !String(text).trim() || typeof msgIngest !== 'function') return;
  if (_mvHandoff && _mvHandoff.text === text) return;
  try {
    var res = msgIngest(relaySplit(text), 'paste');
    if (res.added.length) saveState();
  } catch (e) { if (typeof errReport === 'function') errReport(e, 'msgview'); }
}
/* A message the book holds, found from a reader's copy of it: by its key, else by its words (and its day, where both say one). */
function mvFind(m) {
  if (!m || typeof msgStore !== 'function') return null;
  var all = msgStore(), key = msgKey(m), hit = all.find(function(r) { return r.key === key; });
  if (hit) return hit;
  var h = relayHash(m.text);
  var same = all.filter(function(r) { return relayHash(r.text) === h; });
  if (m.sentOn) { var day = same.filter(function(r) { return !r.sentOn || r.sentOn === m.sentOn; }); if (day.length) same = day; }
  if (m.sentBy) { var by = same.filter(function(r) { return !r.sentBy || String(r.sentBy).trim().toUpperCase() === String(m.sentBy).trim().toUpperCase(); }); if (by.length) same = by; }
  if (_mvHandoff) { var ho = same.find(function(r) { return r.id === _mvHandoff.id; }); if (ho) return ho; }
  return same.filter(function(r) { return r.status !== 'saved'; }).pop() || same.pop() || null;
}
/* A reader's save: `recs` the records it kept of the messages it read ({id, text, sentBy, sentOn, sentAt}). A record holding a
   paste whole (WhatsApp's lines in it) is each of its messages. Called before the save lands, so one save writes both. */
function mvSavedFrom(store, recs) {
  if (typeof msgMarkSaved !== 'function') return;
  (recs || []).forEach(function(rec) {
    if (!rec || !rec.text) return;
    var parts = relaySplit(rec.text);
    if (!parts.some(function(p) { return p.sentBy; })) parts = [rec];
    parts.forEach(function(p) {
      var r = mvFind(p);
      if (!r || (r.saved || []).some(function(s) { return s.store === store && s.id === rec.id; })) return;
      msgMarkSaved(r.id, store, rec.id || null);
    });
  });
}

/* ---------- When ---------- */
/* The minute in its day it was sent: a paste's minutes, or an export's ms. */
function mvMinutes(r) {
  if (!r || r.sentAt == null || r.sentAt === '') return null;
  var a = +r.sentAt;
  if (a < 1440) return a;
  var d = new Date(a);
  return d.getHours() * 60 + d.getMinutes();
}
function mvDayOf(r) {
  if (r.sentOn) return r.sentOn;
  if (r.sentAt != null && +r.sentAt >= 1440) return isoOf(new Date(+r.sentAt));
  return r.at ? isoOf(new Date(r.at)) : '';
}
function mvTimeText(r) { var m = mvMinutes(r); return m == null ? 'no time' : relayClockLabel(m); }
/* The message as WhatsApp's copy writes it, its line first, so a reader reads who sent it and when (the bracketed export: month
   first, read the same by relaySplit and prodSplit). */
function mvWaText(r, text) {
  var day = mvDayOf(r), min = mvMinutes(r), by = String(r.sentBy || '').replace(/:/g, ' ').trim();
  if (!r.sentOn && !(r.sentAt >= 1440)) return text;
  if (!day || !by) return text;
  var p = day.split('-'), m = min == null ? 0 : min, h = Math.floor(m / 60), ap = h >= 12 ? 'PM' : 'AM';
  return '[' + (+p[1]) + '/' + (+p[2]) + '/' + p[0].slice(2) + ', ' + (h % 12 || 12) + ':' + String(m % 60).padStart(2, '0') + ' ' + ap + '] ' + by + ': ' + text;
}
function mvFirstLine(t) { var l = String(t || '').split('\n').map(function(x) { return x.trim(); }).find(Boolean) || ''; return l.length > 90 ? l.slice(0, 89) + '…' : l; }

/* ---------- The reading ---------- */
function mvReaderOf(kind) {
  if (kind === 'in' || kind === 'out') return 'relay';
  if (/^(pickling|production|runs|power)$/.test(kind || '')) return 'prod';
  if (kind === 'stock') return 'stock';
  if (kind === 'cash') return 'cash';
  if (kind === 'checkin') return 'checkin';
  return null;
}
var MV_WHERE = { relay: 'People', prod: 'Production', stock: 'Stock', cash: 'Pay', checkin: 'People' };
function mvTone(t) { return t === 'red' || t === 'danger' ? 'danger' : t === 'amber' || t === 'warning' ? 'warning' : t === 'info' ? 'info' : ''; }
/* What its reader reads a text as: { reader, lines: [{raw, read, tone}], records: [{key, text}], issues: [{tone, text}] }, the
   reader's own output put one way. A reader that throws reads nothing, and says so. */
function mvCtx() {
  var key = (typeof _bookWrites !== 'undefined' ? _bookWrites : 0);
  if (_mvCtx.key !== key || _mvCtx.s !== S) _mvCtx = { key: key, s: S, prod: null, roster: {} };
  return _mvCtx;
}
function mvProdCtx() { var c = mvCtx(); return c.prod || (c.prod = prodCtx()); }
function mvRoster(day) { var c = mvCtx(); return c.roster[day || ''] || (c.roster[day || ''] = relayRoster({}, day)); }
function mvRead(r, text, kind) {
  var out = { reader: mvReaderOf(kind), lines: [], records: [], issues: [] };
  var push = function(raw, read, tone) { out.lines.push({ raw: String(raw || '').trim(), read: read || '', tone: tone || '' }); };
  try {
    if (out.reader === 'relay') {
      var rr = parseRelayRoll(text, mvRoster(mvDayOf(r)), r.sentOn || null, { sentAt: mvMinutes(r) });
      var byN = {};
      rr.issues.forEach(function(x) { if (x.n != null) (byN[x.n] = byN[x.n] || []).push(x); else out.issues.push({ tone: mvTone(x.tone) || 'info', text: x.text }); });
      push(String(text).split('\n')[0], rr.date ? 'The roll’s head: ' + formatDate(rr.date) : 'The roll’s head', '');
      rr.lines.forEach(function(ln) {
        var is = byN[ln.n] || [], worst = is.some(function(x) { return x.tone === 'red'; }) ? 'danger' : is.some(function(x) { return x.tone === 'amber'; }) ? 'warning' : ln.role === 'unknown' ? 'danger' : '';
        push(ln.raw, ln.read || (is[0] ? is[0].text : ''), worst);
        is.forEach(function(x) { out.issues.push({ tone: mvTone(x.tone) || 'info', text: 'Line ' + ln.n + ': ' + x.text }); });
      });
      Object.keys(rr.days).sort().forEach(function(iso) {
        var d = rr.days[iso];
        Object.keys(d.people).forEach(function(id) {
          var p = d.people[id], area = p.generalArea || (p.areas || [])[0];
          out.records.push({ key: formatDate(iso) + ' · ' + p.name, text: (p.st === 'A' ? 'Absent' : p.st === 'H' ? 'Half day' : 'Present') + (area ? ', ' + relayAreaName(area) : '') +
            (p.inExp != null ? ', in ' + relayClockLabel(p.inExp) : '') + (p.outExp != null ? ', out ' + relayClockLabel(p.outExp) : '') });
        });
        (d.extra || []).forEach(function(x) {
          var where = x.kind === 'coverage' ? relayAreaName(x.area) : extraAreas(x).map(relayAreaName).join(' + ') + (x.from ? ' from ' + x.from : '');
          out.records.push({ key: formatDate(iso) + ' · EXTRA ' + where, text: x.hours + ' h' + ((x.crew || []).length ? ', ' + todoPlural(x.crew.length, 'hand') : '') });
        });
      });
    } else if (out.reader === 'prod') {
      parseProdPaste(mvWaText(r, text), mvProdCtx()).forEach(function(m) {
        (m.read.items || []).forEach(function(it) {
          var worst = (it.issues || []).some(function(x) { return x.tone === 'red'; }) ? 'danger' : (it.issues || []).some(function(x) { return x.tone === 'amber'; }) ? 'warning' : '';
          var rd = mvProdItemText(it);
          push(it.raw, rd, worst);
          (it.issues || []).forEach(function(x) { out.issues.push({ tone: mvTone(x.tone) || 'info', text: x.text }); });
          out.records.push({ key: (it.date ? formatDate(it.date) + ' · ' : '') + String(it.raw || '').trim().split('\n')[0], text: rd });
        });
        (m.read.notes || []).forEach(function(nt) { push(nt.raw, nt.text, ''); });
      });
    } else if (out.reader === 'stock') {
      var parsed = parseStockMessage(mvWaText(r, text));
      parsed.text = text;
      if (!parsed.to) { parsed.from = parsed.to = r.sentOn || localDateStr(); parsed.noDate = true; }
      resolveStockParse(parsed, {}).lines.forEach(function(x) {
        var name = x.item ? x.item.name : x.src.key ? stockDisplayName(x.src.key) : 'no name', unit = x.item ? x.item.unit : x.src.unit;
        var rd = name + ': ' + (stockResultText(x, unit) || 'nothing read'), is = x.issues || [];
        var worst = is.some(function(y) { return y.tone === 'red'; }) ? 'danger' : is.some(function(y) { return y.tone === 'amber'; }) ? 'warning' : '';
        push(x.src.raw, rd, worst);
        is.forEach(function(y) { out.issues.push({ tone: mvTone(y.tone) || 'info', text: name + ': ' + y.text }); });
        out.records.push({ key: name, text: stockResultText(x, unit) || 'nothing read' });
      });
    } else if (out.reader === 'cash') {
      var c = parseCashMessage(text, r.sentOn || null);
      c.lines.forEach(function(ln) {
        var rd = formatCurrency(ln.amount) + (ln.what ? ' for ' + ln.what : '') + (ln.date ? ', ' + formatDate(ln.date) : '');
        push(ln.raw, rd, ln.what ? '' : 'warning');
        out.records.push({ key: (ln.what || 'no word') + (ln.date ? ' · ' + formatDate(ln.date) : ''), text: formatCurrency(ln.amount) });
      });
      c.issues.forEach(function(x) { out.issues.push({ tone: mvTone(x.tone) || 'warning', text: (x.n ? 'Line ' + x.n + ': ' : '') + x.text }); });
    }
  } catch (e) {
    out.issues.push({ tone: 'danger', text: 'Its reader could not read it: ' + (e && e.message ? e.message : 'an error') });
  }
  // Every line of the text, the ones no reading covers said as not read.
  if (out.reader && out.reader !== 'relay') {
    var covered = {};
    out.lines.forEach(function(l) { l.raw.split('\n').forEach(function(x) { covered[x.trim()] = true; }); });
    var extra = String(text).split('\n').map(function(x) { return x.trim(); }).filter(function(x) { return x && !covered[x]; });
    if (extra.length && out.lines.length) extra.forEach(function(x) { out.lines.push({ raw: x, read: '', tone: '' }); });
  }
  if (!out.reader || !out.lines.length) {
    out.lines = String(text).split('\n').map(function(x) { return x.trim(); }).filter(Boolean).map(function(x) { return { raw: x, read: '', tone: '' }; });
  }
  return out;
}
function mvProdItemText(it) {
  if (it.kind === 'downtime') return 'Power cut ' + (it.time || '?') + ' to ' + (it.to || 'not back');
  var word = { pickled: 'Pickled', plated: 'Plated', arrived: 'Arrived' }[it.kind] || 'Read';
  return word + (it.time ? ' ' + it.time : '') + ', ' + (it.clientId != null ? prodClientName(it.clientId) : it.client ? it.client + ' (as written)' : 'no client') +
    (it.part ? ', ' + it.part : '') + (it.gauge ? ' [' + it.gauge + ']' : '') + ', ' + prodQtyText(it.qty, it.unit) +
    (it.kind === 'plated' ? ', ' + (it.line ? prodLineName(it.line) : 'line unknown') : '');
}
/* A message's reading as it stands, kept until its text, its kind or the book it is read against changes. */
function mvReading(r) {
  if (_mvReadCache.s !== S) _mvReadCache = { s: S, by: {} };
  var sig = relayHash(r.text) + '|' + r.kind + '|' + (typeof _bookWrites !== 'undefined' ? _bookWrites : 0);
  var c = _mvReadCache.by[r.id];
  if (c && c.sig === sig) return c.reading;
  var reading = mvRead(r, r.text, r.kind);
  _mvReadCache.by[r.id] = { sig: sig, reading: reading };
  return reading;
}
/* Whether a message holds a question that stops its save (a red one), read as its reader reads it. Worked out lazily and kept with
   the reading: a message with no reader asks nothing here. */
function mvAsks(r) {
  if (!mvReaderOf(r.kind) || r.status === 'saved' || r.status === 'skipped' || r.status === 'dup') return false;
  return mvReading(r).issues.some(function(x) { return x.tone === 'danger'; });
}

/* ---------- What reading it again would change ---------- */
/* Lines by their words, matched in order (the longest common run); a line on both sides whose reading moved is changed. Records by
   what they are about. */
function mvDiff(a, b) {
  var A = a.lines, B = b.lines, n = A.length, m = B.length, L = [];
  for (var i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
  for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) L[i][j] = A[i].raw === B[j].raw ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  var lines = [];
  i = 0; j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i].raw === B[j].raw) {
      if (A[i].read !== B[j].read) lines.push({ how: 'changed', raw: B[j].raw, was: A[i].read, now: B[j].read });
      i++; j++;
    } else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { lines.push({ how: 'added', raw: B[j].raw, now: B[j].read }); j++; }
    else { lines.push({ how: 'removed', raw: A[i].raw, was: A[i].read }); i++; }
  }
  var ra = {}, rb = {}, records = [];
  a.records.forEach(function(x) { ra[x.key] = x.text; });
  b.records.forEach(function(x) { rb[x.key] = x.text; });
  b.records.forEach(function(x) {
    if (!(x.key in ra)) records.push({ how: 'added', key: x.key, now: x.text });
    else if (ra[x.key] !== x.text) records.push({ how: 'changed', key: x.key, was: ra[x.key], now: x.text });
  });
  a.records.forEach(function(x) { if (!(x.key in rb)) records.push({ how: 'removed', key: x.key, was: x.text }); });
  return { lines: lines, records: records, any: !!(lines.length || records.length) };
}
var MV_HOW = { added: ['ok', 'Added'], removed: ['danger', 'Removed'], changed: ['warning', 'Changed'] };
function mvDiffHtml(d, saved) {
  var row = function(x, title) {
    var h = MV_HOW[x.how], sub = x.how === 'changed' ? 'was ' + (x.was || 'not read') + ', now ' + (x.now || 'not read') : x.how === 'added' ? (x.now || 'not read') : (x.was || 'not read');
    return '<div class="inv-row inv-row-2" data-mv-diff="' + x.how + '"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(title) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(sub) + '</span></span>' + uiRowEndHtml('', { tone: h[0], word: h[1] }) + '</div>';
  };
  var h = '<div class="inv-panel inv-panel-flush" data-mv-diffpanel><div class="inv-panel-head"><span class="inv-panel-title">Read again: what changes</span></div>';
  if (!d.any) return h + '<div class="inv-panel-body inv-note">The reading is the same: nothing changes.</div></div>';
  if (d.records.length) h += '<div class="inv-row-group"><span>Records</span><span class="inv-num">' + d.records.length + '</span></div>' + d.records.map(function(x) { return row(x, x.key); }).join('');
  if (d.lines.length) h += '<div class="inv-row-group"><span>Lines</span><span class="inv-num">' + d.lines.length + '</span></div>' + d.lines.map(function(x) { return row(x, x.raw || '(blank)'); }).join('');
  if (saved) h += '<div class="inv-panel-body inv-note">Its reader saved this message already. Saving here keeps the new text; read it again in its reader to change what was saved.</div>';
  return h + '</div>';
}

/* ---------- Confidence ---------- */
/* How sure the app is of a kind: the profile's where it has one (msgprofile.js), else the share of the kind's messages saved with
   no correction, against those corrected (a kind set by hand on one it sorted there, or its text edited). Null: nothing decided. */
function mvConf(kind) {
  if (typeof mpKindConf === 'function') {
    try { var p = mpKindConf(kind); var v = p && typeof p === 'object' ? p.conf : p; if (v != null && !isNaN(v)) return { conf: +v, n: p && p.n != null ? p.n : null, from: 'profile' }; } catch (e) { /* the fallback */ }
  }
  var hits = 0, misses = 0;
  msgStore().forEach(function(r) {
    if (r.fix && r.fix.was === kind && r.fix.kind !== kind) misses++;
    if (r.kind !== kind) return;
    if ((r.textWas || []).length) misses++;
    else if (r.status === 'saved' && !(r.fix && r.fix.was && r.fix.was !== r.kind)) hits++;
  });
  return hits + misses ? { conf: hits / (hits + misses), n: hits + misses, misses: misses } : null;
}
function mvConfRowsHtml() {
  var facts = MSG_KINDS.filter(function(k) { return k.id !== 'other'; }).map(function(k) {
    var n = msgStore().filter(function(r) { return r.kind === k.id; }).length, c = mvConf(k.id);
    if (!n && !c) return null;
    var pct = c ? Math.round(c.conf * 100) : null;
    return { label: k.label, value: pct == null ? '' : pct + '%', tone: pct == null ? '' : pct >= 90 ? 'ok' : pct >= 70 ? 'warning' : 'danger',
      sub: todoPlural(n, 'message') + (c && c.from === 'profile' ? ', from how they are sent' : c && c.misses ? ', ' + todoPlural(c.misses, 'correction') : c ? ', none corrected' : ', none decided yet'),
      attrs: ' data-mv-conf="' + k.id + '"' };
  });
  return uiWorkingHtml('mv-conf', facts, 'How sure, by kind', ' data-mv-confs');
}

/* ---------- The screen ---------- */
function mvFiltered() {
  var q = _mvSearch.toUpperCase();
  return msgStore().filter(function(r) {
    if (_mvKind && r.kind !== _mvKind) return false;
    if (_mvSender && String(r.sentBy || '') !== _mvSender) return false;
    if (_mvStatus && r.status !== _mvStatus) return false;
    if (_mvDay && mvDayOf(r) !== _mvDay) return false;
    if (q && String(r.text || '').toUpperCase().indexOf(q) < 0 && String(r.sentBy || '').toUpperCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function(a, b) {
    return String(mvDayOf(b)).localeCompare(String(mvDayOf(a))) || (mvMinutes(b) || 0) - (mvMinutes(a) || 0) || (b.at || 0) - (a.at || 0);
  });
}
function mvVerdictHtml(list, filtered) {
  var all = msgStore(), shown = filtered ? list : all;
  var notread = shown.filter(function(r) { return r.status === 'notread'; }).length;
  var saved = shown.filter(function(r) { return r.status === 'saved'; }).length;
  var asks = shown.filter(mvAsks).length;
  var fresh = shown.filter(function(r) { return r.status === 'new'; }).length;
  var screen = 'Messages · ' + todoPlural(shown.length, 'kept') + (filtered ? ' · filtered' : '');
  if (!all.length) return uiVerdictHtml({ screen: 'Messages', tone: 'neutral', verdict: 'No message kept yet', key: 'pageMessages',
    facts: ['every paste is kept from now on'] });
  var tone = asks ? 'danger' : notread ? 'warning' : fresh ? 'info' : 'ok';
  var verdict = asks ? todoPlural(asks, 'message asks', 'messages ask') + ' a question' : notread ? todoPlural(notread, 'message') + ' no reader takes'
    : fresh ? todoPlural(fresh, 'message') + ' read, not saved' : 'Every message read and settled';
  return uiVerdictHtml({ screen: screen, tone: tone, verdict: verdict, key: 'pageMessages',
    factors: [{ label: 'Messages', fig: String(shown.length) },
      { label: 'Not read', fig: String(notread), tone: notread ? 'warning' : 'ok' },
      { label: 'A red question', fig: String(asks), tone: asks ? 'danger' : 'ok' },
      { label: 'Saved', fig: String(saved), tone: saved ? 'ok' : 'neutral' }],
    body: mvConfRowsHtml(), attrs: ' data-mv-verdict data-mv-asks="' + asks + '"' });
}
function mvToolbarHtml() {
  var all = msgStore(), phone = !_isDesktop;
  var senders = [];
  all.forEach(function(r) { if (r.sentBy && senders.indexOf(r.sentBy) < 0) senders.push(r.sentBy); });
  senders.sort();
  var opt = function(v, label, cur) { return '<option value="' + escHtml(v) + '"' + (cur === v ? ' selected' : '') + '>' + escHtml(label) + '</option>'; };
  var controls = '<select class="inv-select inv-toolbar-item" id="mvKind" aria-label="Kind of message">' + opt('', 'Every kind', _mvKind) +
      MSG_KINDS.map(function(k) { return opt(k.id, k.label, _mvKind); }).join('') + '</select>' +
    '<select class="inv-select inv-toolbar-item" id="mvSender" aria-label="Sent by">' + opt('', 'Everyone', _mvSender) +
      senders.map(function(s) { return opt(s, s, _mvSender); }).join('') + '</select>' +
    '<select class="inv-select inv-toolbar-item" id="mvStatus" aria-label="Status">' + opt('', 'Every status', _mvStatus) +
      Object.keys(MV_STATUS).map(function(k) { return opt(k, MV_STATUS[k][1], _mvStatus); }).join('') + '</select>' +
    '<label class="inv-field inv-toolbar-item"><span class="inv-field-label">Day</span><input type="date" class="inv-input" id="mvDay" value="' + escHtml(_mvDay) + '"></label>';
  var count = (_mvKind ? 1 : 0) + (_mvSender ? 1 : 0) + (_mvStatus ? 1 : 0) + (_mvDay ? 1 : 0);
  return '<div class="inv-toolbar" data-mv-toolbar>' +
    '<label class="inv-search">' + ICON_SEARCH + '<input type="search" id="mvSearch" value="' + escHtml(_mvSearch) + '" placeholder="Search the messages" autocomplete="off" aria-label="Search the messages"></label>' +
    uiFilterHtml({ key: 'messages', count: count, controls: controls }) +
    uiToolbarMoreHtml([{ label: 'Read every message again', action: 'invMsgRereadAll' }], { icon: phone }) + '</div>' +
    uiTokensHtml([{ key: 'Kind', value: _mvKind ? msgKindLabel(_mvKind) : '', action: 'invMsgClear', attrs: ' data-clear="kind"' },
      { key: 'Sender', value: _mvSender, action: 'invMsgClear', attrs: ' data-clear="sender"' },
      { key: 'Status', value: _mvStatus ? MV_STATUS[_mvStatus][1] : '', action: 'invMsgClear', attrs: ' data-clear="status"' },
      { key: 'Day', value: _mvDay ? formatDate(_mvDay) : '', action: 'invMsgClear', attrs: ' data-clear="day"' }]);
}
/* The kind a message no reader takes looks like (msgSort's `like`, msgprofile.js), worked out where it was not kept. */
function mvLike(r) {
  if (!r || r.kind !== 'other') return '';
  if (r.like == null) { try { r.like = msgSort(r).like || ''; } catch (e) { r.like = ''; } }
  return r.like && r.like !== 'other' ? r.like : '';
}
function mvRowHtml(r) {
  var st = mvStatusOf(r), like = mvLike(r);
  return '<button class="inv-row inv-row-2 inv-row-top" data-action="invMsgOpen" data-id="' + escHtml(r.id) + '" data-mv-row="' + escHtml(r.id) + '"' +
    (_mvOpen === r.id ? ' aria-current="true"' : '') + '>' +
    '<span class="inv-row-main"><span class="inv-row-title">' + escHtml((r.sentBy || 'No sender') + ' · ' + mvTimeText(r)) + '</span>' +
    '<span class="inv-row-meta">' + escHtml((like ? 'Looks like ' + msgKindLabel(like).toLowerCase() + ': ' : '') + mvFirstLine(r.text)) + '</span></span>' +
    '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-badge inv-badge-neutral">' + escHtml(msgKindLabel(r.kind)) + '</span>' +
    '<span class="inv-dot inv-dot-' + uiTone(st.tone) + '">' + escHtml(st.word) + '</span></span></span></button>';
}
function mvListHtml(list) {
  if (!msgStore().length) return '<div class="inv-panel">' + uiBlankHtml({ kind: 'empty', title: 'No message kept yet',
    body: 'Every message pasted in the paste box (Add, People → Paste message) is kept here, beside what the app read it as.' }) + '</div>';
  if (!list.length) return '<div class="inv-panel">' + uiBlankHtml({ kind: 'empty', title: 'No message matches', body: 'Clear a filter or the search to see more.' }) + '</div>';
  var rows = [], count = {};
  list.forEach(function(r) { var d = mvDayOf(r); count[d] = (count[d] || 0) + 1; });
  var last = null;
  list.forEach(function(r) {
    var d = mvDayOf(r);
    if (d !== last) { rows.push({ head: true, parts: ['<div class="inv-row-group"><span>' + escHtml(d ? formatDate(d) : 'No day') + '</span><span class="inv-num">' + count[d] + '</span></div>'] }); last = d; }
    rows.push(mvRowHtml(r));
  });
  return '<div class="inv-panel inv-panel-flush" data-card="messages"><div class="inv-panel-head"><span class="inv-panel-title">Messages <span class="inv-panel-count">' + list.length + '</span></span></div>' +
    uiMoreHtml('mv-list', rows, { noun: 'messages' }) + '</div>';
}
/* What the app has learnt from your corrections: each kind set by hand, and the roll reader's heading lessons, each with Forget. */
function mvLessonsHtml() {
  var rows = '';
  msgStore().filter(function(r) { return r.fix && r.fix.kind; }).forEach(function(r) {
    rows += '<div class="inv-row inv-row-2" data-mv-lesson="kind"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(mvFirstLine(r.text)) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(msgKindLabel(r.fix.kind) + (r.fix.was ? ', not ' + msgKindLabel(r.fix.was) : '') + (r.sentBy ? ', from ' + r.sentBy : '')) + '</span></span>' +
      '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMsgForgetKind" data-id="' + escHtml(r.id) + '">Forget</button></span></div>';
  });
  var L = typeof relayLearnData === 'function' ? relayLearnData() : { heads: {}, slots: {} };
  Object.keys(L.heads || {}).sort().forEach(function(k) {
    var l = L.heads[k];
    rows += '<div class="inv-row inv-row-2" data-mv-lesson="head"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(l.text || k) + '</span>' +
      '<span class="inv-row-meta">' + escHtml('Read as ' + ((l.areas || []).map(relayAreaName).join(' + ') || 'no line') + ', was ' + ((l.was || []).map(relayAreaName).join(' + ') || 'no line')) + '</span></span>' +
      '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMsgForgetHead" data-kind="heads" data-key="' + escHtml(k) + '">Forget</button></span></div>';
  });
  Object.keys(L.slots || {}).sort().forEach(function(k) {
    var l = L.slots[k];
    rows += '<div class="inv-row inv-row-2" data-mv-lesson="slot"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(l.text || k) + '</span>' +
      '<span class="inv-row-meta">' + escHtml('Read as ' + l.from + ' – ' + l.to + ', was ' + (l.wasFrom || '?') + ' – ' + (l.wasTo || '?')) + '</span></span>' +
      '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMsgForgetHead" data-kind="slots" data-key="' + escHtml(k) + '">Forget</button></span></div>';
  });
  if (!rows) return '';
  return uiFoldHtml('mv-lessons', '<span class="inv-panel-title">What the app has learnt from your corrections</span>', rows, false, ' id="mvLessons"');
}
function renderMessages() {
  var area = document.getElementById('msgViewArea');
  if (!area || typeof msgStore !== 'function') return;
  if (_mvOpen && !msgById(_mvOpen)) _mvOpen = null;
  var open = _mvOpen ? msgById(_mvOpen) : null;
  _mvOpenLabel = open ? ((open.sentBy || 'No sender') + ' · ' + mvTimeText(open)) : '';
  // The phone opens a message as a sub-view, with its way back.
  if (open && !_isDesktop) { area.innerHTML = mvMessageHtml(open, true); return; }
  var list = mvFiltered(), filtered = !!(_mvSearch || _mvKind || _mvSender || _mvStatus || _mvDay);
  var head = '<div id="mvVerdict">' + mvVerdictHtml(list, filtered) + '</div>' + mvToolbarHtml();
  var body = mvListHtml(list) + mvLessonsHtml();
  var html = head + (_isDesktop ? '<div class="inv-pane-host' + (open ? ' inv-pane-open' : '') + '" id="mvHost" data-open="' + escHtml(_mvOpen || '') + '"><div class="inv-pane-list">' + body + '</div>' +
    '<div class="inv-pane" id="mvPane">' + (open ? mvMessageHtml(open, false) : '') + '</div></div>' : body);
  paneScrollKeep(function() { area.innerHTML = html; });
}
/* Opens the screen, and one message on it (a step of the trail). */
function mvShow() { navOpen({ tab: 'pageMessages', v: '', id: '' }); viewTop(); }
function mvOpen(id) {
  if (!msgById(id)) { showToast('That message is not kept here', 'warning'); return; }
  _mvEdit = null;
  navOpen({ tab: 'pageMessages', v: '', id: id });
  if (!_isDesktop) viewTop();
}

/* ---------- One message ---------- */
function mvMessageHtml(r, phone) {
  var st = mvStatusOf(r), reading = mvReading(r), reader = mvReaderOf(r.kind), where = reader ? MV_WHERE[reader] : '';
  var title = (r.sentBy || 'No sender') + ' · ' + mvTimeText(r);
  var h = phone
    ? '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="invMsgClose">' + iconSvg('back') + 'Messages</button>' +
      '<h2 class="inv-pagehead-title">' + escHtml(title) + '</h2></div>'
    : paneHeadHtml('<span class="inv-panel-title">' + escHtml(title) + '</span>', 'invMsgClose');
  var conf = r.conf != null ? Math.round(r.conf * 100) + '%' : '';
  var senderHtml = typeof mpSenderHtml === 'function' && r.sentBy ? (function() { try { return mpSenderHtml(r.sentBy) || ''; } catch (e) { return ''; } })() : '';
  h += '<div class="inv-panel inv-panel-flush" data-mv-message="' + escHtml(r.id) + '">' +
    uiFactRowHtml({ label: 'Sent', value: mvDayOf(r) ? formatDate(mvDayOf(r)) : '', sub: (r.sentBy || 'no sender') + ', ' + mvTimeText(r) + (r.edited ? ', edited in WhatsApp' : ''),
      // How the sender sends messages (msgprofile.js): their card, where the profile is loaded.
      actions: r.sentBy && typeof mpAction === 'function' ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invMsgProfile" data-sender="' + escHtml(r.sentBy) + '">Sender’s card</button>' : '' }) +
    uiFactRowHtml({ label: 'Kind', value: msgKindLabel(r.kind), sub: (r.fix ? 'set by hand' : (r.why || 'sorted')) + (conf && !r.fix ? ', ' + conf + ' sure' : '') + (mvLike(r) ? ', looks like ' + msgKindLabel(mvLike(r)).toLowerCase() : ''), attrs: ' data-mv-kind-now="' + escHtml(r.kind) + '"' }) +
    uiFactRowHtml({ label: 'Status', value: st.word, sub: r.src === 'zip' ? 'from a WhatsApp export' : 'pasted' + (r.at ? ' ' + formatTimestamp(r.at) : ''), attrs: ' data-mv-status="' + escHtml(r.status) + '"' }) +
    '</div>' + (senderHtml ? '<div data-mv-sender>' + senderHtml + '</div>' : '');
  // The kind corrected, or the message set aside as no report.
  h += '<div class="inv-panel" data-mv-correct><div class="inv-fields"><div class="inv-field"><label class="inv-field-label" for="mvFixKind">It is</label>' +
    '<select class="inv-select" id="mvFixKind" data-mv-fix="' + escHtml(r.id) + '">' + MSG_KINDS.map(function(k) {
      return '<option value="' + k.id + '"' + (k.id === r.kind ? ' selected' : '') + '>' + escHtml(k.label) + '</option>';
    }).join('') + '</select></div></div>' +
    '<div class="inv-toolbar inv-mt-8">' + (r.status === 'skipped'
      ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMsgReport" data-id="' + escHtml(r.id) + '">It is a report</button>'
      : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMsgSkip" data-id="' + escHtml(r.id) + '">Not a report</button>') +
    (_mvEdit && _mvEdit.id === r.id ? '' : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMsgEdit" data-id="' + escHtml(r.id) + '">Edit the text</button>') + '</div></div>';
  if (_mvEdit && _mvEdit.id === r.id) h += mvEditHtml(r);
  else if (reader && r.status !== 'skipped') {
    h += '<div class="inv-panel" data-mv-handoff><button class="inv-btn inv-btn-primary inv-btn-block" data-action="invMsgHandoff" data-id="' + escHtml(r.id) + '">' +
      (r.status === 'saved' ? 'Read again in ' : 'Read in ') + escHtml(where) + '</button>' +
      '<div class="inv-note inv-mt-8">' + (r.status === 'saved' ? 'Its reader’s own check shows what reading it again would change, and nothing changes until you save there.' : 'Its reader’s own check, where it is saved.') + '</div></div>';
  }
  // The questions its reader asks, then each line beside its reading.
  var qs = reading.issues.filter(function(x) { return x.tone === 'danger' || x.tone === 'warning'; });
  if (qs.length) h += '<div class="inv-panel inv-panel-flush" data-mv-issues><div class="inv-panel-head"><span class="inv-panel-title">Questions <span class="inv-panel-count">' + qs.length + '</span></span></div>' +
    uiMoreHtml('mv-q-' + r.id, qs.map(function(x) { return '<div class="inv-row inv-row-auto"><div class="inv-row-main"><div class="inv-callout inv-callout-' + x.tone + '" data-mv-issue="' + x.tone + '">' + escHtml(x.text) + '</div></div></div>'; }), { n: 10, noun: 'questions' }) + '</div>';
  h += '<div class="inv-panel inv-panel-flush" data-mv-lines><div class="inv-panel-head"><span class="inv-panel-title">The message, line by line <span class="inv-panel-count">' + reading.lines.length + '</span></span></div>' +
    uiMoreHtml('mv-l-' + r.id, reading.lines.map(function(l) {
      var rd = l.read ? (l.tone ? '<span class="inv-dot inv-dot-' + l.tone + '">' + escHtml(l.read) + '</span>' : escHtml(l.read)) : (reader ? 'Not read' : '');
      return '<div class="inv-row inv-row-auto" data-mv-line><div class="inv-row-main"><div class="inv-quote">' + escHtml(l.raw) + '</div>' +
        (rd ? '<div class="inv-row-meta inv-row-wrap inv-mt-4">' + rd + '</div>' : '') + '</div></div>';
    }), { noun: 'lines' }) + '</div>';
  h += mvMadeHtml(r) + mvEditsHtml(r);
  return h;
}
/* The records it made, each with the way to it where the app has one. */
function mvMadeHtml(r) {
  var saved = r.saved || [];
  if (!saved.length) return '';
  var rows = saved.map(function(s) {
    var label = '', go = '', btn = '';
    if (s.store === 'relayPastes') {
      var rp = relayPastes().find(function(p) { return p.id === s.id; });
      label = 'Attendance' + (rp && rp.days ? ': ' + rp.days.map(formatDate).join(', ') : '');
      if (rp && rp.days && rp.days[0] && (typeof grdSees !== 'function' || grdSees('pageStaff'))) btn = '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invHistoryJumpDay" data-id="' + escHtml(rp.days[0]) + '">Open the day</button>';
    } else if (s.store === 'production') { label = 'Production entries'; go = 'production'; }
    else if (s.store === 'stock') { label = 'Stock entries'; go = 'stock'; }
    else if (s.store === 'cashPastes') { label = 'Cash paid out'; go = 'pay'; }
    else label = String(s.store || 'A record');
    if (go) btn = '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invMsgGoRec" data-go="' + go + '">Open</button>';
    return '<div class="inv-row" data-mv-made="' + escHtml(s.store) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(label) + '</span></span>' +
      (btn ? '<span class="inv-row-end">' + btn + '</span>' : '') + '</div>';
  }).join('');
  return '<div class="inv-panel inv-panel-flush" data-mv-records><div class="inv-panel-head"><span class="inv-panel-title">What it made <span class="inv-panel-count">' + saved.length + '</span></span></div>' + rows + '</div>';
}
function mvEditsHtml(r) {
  var was = r.textWas || [];
  if (!was.length) return '';
  return '<div class="inv-panel inv-panel-flush" data-mv-edits><div class="inv-panel-head"><span class="inv-panel-title">Its edits <span class="inv-panel-count">' + was.length + '</span></span></div>' +
    was.slice().reverse().map(function(w) {
      return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml('Was: ' + mvFirstLine(w.text)) + '</span>' +
        '<span class="inv-row-meta">' + escHtml((w.at ? formatTimestamp(w.at) : '') + (w.by && typeof chgUserName === 'function' ? ', ' + chgUserName(w.by) : '')) + '</span></span></div>';
    }).join('') + '</div>';
}
function mvEditHtml(r) {
  var e = _mvEdit, fresh = e.diff && e.diff.text === e.text;
  var h = '<div class="inv-panel" data-mv-edit><div class="inv-field"><label class="inv-field-label" for="mvEditText">The message’s text</label>' +
    '<textarea id="mvEditText" class="inv-textarea inv-textarea-mono" rows="10" spellcheck="false">' + escHtml(e.text) + '</textarea></div>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-block" data-action="invMsgReadAgain" data-id="' + escHtml(r.id) + '">Read again</button>' +
    '<div class="inv-note inv-mt-8">Read again shows what the reading would change. Nothing is saved until you save.</div></div>';
  if (fresh) h += mvDiffHtml(e.diff.d, r.status === 'saved');
  h += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">Edited text</div><div class="inv-actionbar-value">' +
    (fresh ? (e.diff.d.any ? 'Read again' : 'Reads the same') : 'Read it again first') + '</div></div>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invMsgEditCancel">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invMsgEditSave" data-id="' + escHtml(r.id) + '"' + (fresh && e.text.trim() && e.text !== r.text ? '' : ' disabled') + '>Save the text</button></div>';
  return h;
}

/* ---------- Acts ---------- */
function mvRedraw() { if (navPageOf() === 'pageMessages') keepScroll(renderMessages); }
function mvResort(r) {
  var s = msgSort(r);
  r.kind = s.kind; r.conf = s.conf; r.why = s.why; r.like = s.like || '';
  if (r.status === 'new' || r.status === 'notread') r.status = r.kind === 'other' ? 'notread' : 'new';
}
function mvSetKind(id, kind) {
  var r = msgById(id);
  if (!r || !MSG_KINDS.some(function(k) { return k.id === kind; }) || kind === r.kind) return;
  var was = r.fix && r.fix.was ? r.fix.was : r.kind;
  r.fix = kind === was ? null : { kind: kind, at: Date.now(), by: typeof grdUserId === 'function' ? grdUserId() : null, was: was };
  mvResort(r);
  saveState();
  _pageTyped = false;
  mvRedraw();
  showToast('Kept as ' + msgKindLabel(r.kind) + (r.fix ? ': the app learns from it' : ''));
}
function mvHandoff(id) {
  var r = msgById(id), reader = r && mvReaderOf(r.kind);
  if (!reader) return;
  var text = mvWaText(r, r.text);
  _mvHandoff = { id: r.id, text: text };
  if (reader === 'relay') { relayOpen(text); relayRead(); }
  else if (reader === 'prod') prodOpenPaste(text);
  else if (reader === 'stock') relayOpenStock(text);
  else if (reader === 'cash') cashReviewOpen(r.text, r.sentOn || null);
  else if (reader === 'checkin' && typeof ckReviewOpen === 'function') ckReviewOpen(text, {});
}
function mvReadAgain(id) {
  var r = msgById(id), ta = document.getElementById('mvEditText');
  if (!r || !_mvEdit) return;
  if (ta) _mvEdit.text = ta.value;
  if (!_mvEdit.text.trim()) { showToast('The message needs its text', 'error'); return; }
  var next = { text: _mvEdit.text, sentBy: r.sentBy, sentOn: r.sentOn, sentAt: r.sentAt };
  var kind = r.fix ? r.fix.kind : msgSort(next).kind;
  var before = mvReading(r), after = mvRead(r, _mvEdit.text, kind);
  _mvEdit.diff = { text: _mvEdit.text, before: before, after: after, d: mvDiff(before, after) };
  if (kind !== r.kind) _mvEdit.diff.d.lines.unshift({ how: 'changed', raw: 'Its kind', was: msgKindLabel(r.kind), now: msgKindLabel(kind) });
  _mvEdit.diff.d.any = _mvEdit.diff.d.any || kind !== r.kind;
  mvRedraw();
}
function mvEditSave(id) {
  var r = msgById(id), e = _mvEdit;
  if (!r || !e || !e.diff || e.diff.text !== e.text || !e.text.trim() || e.text === r.text) return;
  if (!Array.isArray(r.textWas)) r.textWas = [];
  r.textWas.push({ text: r.text, at: Date.now(), by: typeof grdUserId === 'function' ? grdUserId() : null });
  r.text = e.text;
  mvResort(r);
  _mvEdit = null;
  _pageTyped = false;
  saveState();
  mvRedraw();
  showToast(r.status === 'saved' ? 'Text saved. Read it again in its reader to change what it saved' : 'Text saved and read again');
}
/* Every message sorted again by the sorter as it stands; what moved is listed. The messages' kinds move with it; no reader's
   record is written. */
function mvRereadAll() {
  var moved = [];
  msgStore().forEach(function(r) {
    var was = r.kind, s = msgSort(r);
    if (s.kind !== was) moved.push({ r: r, was: was, now: s.kind });
    r.kind = s.kind; r.conf = s.conf; r.why = s.why; r.like = s.like || '';
    if (r.status === 'new' || r.status === 'notread') r.status = r.kind === 'other' ? 'notread' : 'new';
  });
  _mvReadCache = { s: null, by: {} };
  if (moved.length) saveState();
  mvRedraw();
  var rows = moved.map(function(x) {
    return '<div class="inv-row inv-row-2" data-mv-moved><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(mvFirstLine(x.r.text)) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(msgKindLabel(x.was) + ' → ' + msgKindLabel(x.now)) + '</span></span></div>';
  });
  dialogOpen('<div class="inv-dialog" data-mv-reread>' + dialogHeadHtml('Read every message again') +
    '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(moved.length ? todoPlural(moved.length, 'message') + ' moved' : 'Nothing moved') + '</span></div>' +
    (rows.length ? uiMoreHtml('mv-moved', rows, { noun: 'messages' }) :
      '<div class="inv-panel-body inv-note">Every one of the ' + todoPlural(msgStore().length, 'message') + ' sorts as it did.</div>') +
    '<div class="inv-panel-body inv-note">No record was written: a reader saves only from its own check.</div></div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-primary" data-action="invCloseOverlay">Done</button></div></div>', { dismiss: true });
}

function mvAction(action, btn) {
  var d = btn && btn.dataset ? btn.dataset : {};
  switch (action) {
    case 'invMsgGo': mvShow(); return true;
    case 'invMsgOpen': if (_isDesktop && _mvOpen === d.id) { _mvOpen = null; _mvEdit = null; keepScroll(renderMessages); } else mvOpen(d.id); return true;
    case 'invMsgClose': _mvOpen = null; _mvEdit = null; _pageTyped = false; if (_isDesktop) keepScroll(renderMessages); else { renderMessages(); viewTop(); } return true;
    case 'invMsgClear':
      if (d.clear === 'kind') _mvKind = ''; else if (d.clear === 'sender') _mvSender = ''; else if (d.clear === 'status') _mvStatus = ''; else if (d.clear === 'day') _mvDay = '';
      renderMessages(); return true;
    case 'invMsgEdit': { var r = msgById(d.id); if (r) { _mvEdit = { id: r.id, text: r.text, diff: null }; mvRedraw(); } return true; }
    case 'invMsgEditCancel': _mvEdit = null; _pageTyped = false; mvRedraw(); return true;
    case 'invMsgReadAgain': mvReadAgain(d.id); return true;
    case 'invMsgEditSave': mvEditSave(d.id); return true;
    case 'invMsgHandoff': mvHandoff(d.id); return true;
    case 'invMsgSkip': case 'invMsgReport': {
      var m = msgById(d.id);
      if (!m) return true;
      m.status = action === 'invMsgSkip' ? 'skipped' : ((m.saved || []).length ? 'saved' : m.kind === 'other' ? 'notread' : 'new');
      saveState(); mvRedraw();
      showToast(action === 'invMsgSkip' ? 'Set aside: not a report' : 'Back among the reports');
      return true;
    }
    case 'invMsgForgetKind': { var f = msgById(d.id); if (f) { f.fix = null; mvResort(f); saveState(); mvRedraw(); showToast('Forgotten: it is sorted by the app again'); } return true; }
    case 'invMsgForgetHead': {
      var L = relayLearnData();
      if (L[d.kind] && d.key in L[d.kind]) { delete L[d.kind][d.key]; _mvReadCache = { s: null, by: {} }; saveState(); mvRedraw(); showToast('Forgotten'); }
      return true;
    }
    case 'invMsgRereadAll': mvRereadAll(); return true;
    case 'invMsgGoRec':
      if (d.go === 'production') navOpen({ tab: 'pageProduction', v: 'entries', id: '' });
      else if (d.go === 'stock') navOpen({ tab: 'pageStock', v: 'list', id: '' });
      else if (d.go === 'pay') navOpen({ tab: 'pageStaff', v: 'pay', id: '' });
      viewTop();
      return true;
  }
  return false;
}
/* The screen's own fields: a <select> and a date through change, the search and the text as typed. */
function mvOnChange(t) {
  if (!t || !t.id) return false;
  if (t.id === 'mvKind') _mvKind = t.value;
  else if (t.id === 'mvSender') _mvSender = t.value;
  else if (t.id === 'mvStatus') _mvStatus = t.value;
  else if (t.id === 'mvDay') _mvDay = t.value;
  else if (t.id === 'mvFixKind') { mvSetKind(t.getAttribute('data-mv-fix'), t.value); return true; }
  else return false;
  // Inside the phone's Filter dialog the row is drawn again when it shuts; on the desktop the list follows at once.
  if (!t.closest('.inv-scrim')) renderMessages();
  return true;
}
function mvOnInput(t) {
  if (!t) return false;
  if (t.id === 'mvEditText' && _mvEdit) { _mvEdit.text = t.value; return true; }
  if (t.id !== 'mvSearch') return false;
  _mvSearch = t.value.trim();
  clearTimeout(_mvSearchTimer);
  _mvSearchTimer = setTimeout(function() {
    var el = document.getElementById('mvSearch'), caret = null;
    if (el) { try { caret = el.selectionStart; } catch (e) { caret = null; } }
    renderMessages();
    var again = document.getElementById('mvSearch');
    if (again) { again.focus(); if (caret != null && again.setSelectionRange) again.setSelectionRange(caret, caret); }
  }, 250);
  return true;
}
document.addEventListener('change', function(e) { if (navPageOf() === 'pageMessages' || (e.target && e.target.closest && e.target.closest('[data-tb-filter-dialog="messages"]'))) keepScroll(function() { mvOnChange(e.target); }); });
document.addEventListener('input', function(e) { if (navPageOf() === 'pageMessages') mvOnInput(e.target); });
