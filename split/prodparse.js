/* ===== PRODUCTION — reading the floor's messages (pure: nothing here reads S) =====
 * Three voices report production into the daily WhatsApp group (census of the real exports, 28 Sep 2026):
 *   - the pickling hand, one message per load: "SSS MEHTA / CLAMP133×83(35×6)-774 nos / PICKLING TIME 9:00AM";
 *     several clients under one time; incoming material under "Incoming material time"; since August over half
 *     the loads carry no quantity ("SSS MEHTA / CLAMP(40×6)"); a line is never named.
 *   - the supervisor: a daily "berral production" list, and short "----production----" blocks inside his in/out
 *     rolls, which report the overtime slot above them.
 *   - the register clerk: photos of the VAT register (read by Gemini, production.js).
 * Everything read here is shown beside the text it came from before anything is saved (Stock's contract). A line
 * that cannot be read is listed, never dropped. The client list and the roster are passed in, so the census can
 * replay the real exports through the same functions.
 */

/* The WhatsApp header, with the post time (RELAY_WA_RE drops it, and attendance depends on its groups). */
var PROD_WA_RE = /^\s*\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp]\.?[Mm]\.?)?\]?\s*(?:-\s*)?([^:]{1,40}):\s?(.*)$/;
var PROD_LIST_HEAD_RE = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/*\s*(?:ka\s+update\s+)?b[ae]r+[ae]*l+\.?\s*(?:production|update)/i;
var PROD_FIRM_RE = /\b(ENTERPRISES?|INDUSTR(Y|IES)|AUTO|PRESS|METALS?|ENGG|ENGINEER(S|ING)?|CORPORATION|PVT|LTD|CO\.)\b/i;
var PROD_UNIT_OF = { NO: 'NOS', NOS: 'NOS', MOS: 'NOS', PC: 'NOS', PCS: 'NOS', PIECE: 'NOS', PIECES: 'NOS', KG: 'KG', KGS: 'KG', K: 'KG', KY: 'KG', BAG: 'BAG', BAGS: 'BAG' };
var PROD_QTY_TOKEN_RE = /(\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)*)\s*(nos|no|mos|pcs|pc|pieces|piece|kgs|kg|ky|k|bags|bag)\b\.?/gi;
var PROD_LINES = ['vat-a1', 'vat-a2', 'barrel'];
var PROD_LINE_LABEL = { 'vat-a1': 'VAT A1', 'vat-a2': 'VAT A2', barrel: 'Barrel' };

function prodHhmm(min) { return min == null ? null : relayHhmm(min); }
/* A stored "HH:MM" in minutes is the relay's own reading (relayParseHhmm): one parser for a time the app wrote. */

/* One pasted text → messages, each with who sent it, the day and the minute it was posted. A paste of one message
   with no header is one message, dated by the caller (today, and said so). */
function prodSplit(text) {
  var msgs = [], cur = null;
  String(text || '').replace(/\r/g, '').replace(/‎|‏/g, '').split('\n').forEach(function(line) {
    var wa = line.match(PROD_WA_RE);
    if (wa) {
      var a = +wa[1], b = +wa[2], h = +wa[4] % 12, ap = /p/i.test(wa[6] || '') ? 12 : 0;
      var monthFirst = /^\s*\[/.test(line) ? a <= 12 : (a <= 12 && b > 12);
      var at = wa[6] ? (h + ap) * 60 + +wa[5] : +wa[4] * 60 + +wa[5];
      cur = { sentBy: wa[7].trim(), sentOn: monthFirst ? isoFromDmy(b, a, wa[3]) : isoFromDmy(a, b, wa[3]), sentAt: at, lines: [wa[8]] };
      msgs.push(cur);
      return;
    }
    // Pasted without its WhatsApp line, a roll or a barrel list still opens with its own dated head.
    var head = /^\s*\d{1,2}\/\d{1,2}\/\d{2,4}\/*\s*((in|out)\s*-*\s*time|c[ae]mical|chemical)/i.test(line) || PROD_LIST_HEAD_RE.test(line);
    if (!cur || (head && cur.lines.some(function(l) { return l.trim(); }))) {
      cur = { sentBy: cur && head ? cur.sentBy : '', sentOn: null, sentAt: null, lines: [] };
      msgs.push(cur);
    }
    cur.lines.push(line);
  });
  return msgs.map(function(m) {
    // The chat-export tool keeps a photo's caption after its marker; the Android export drops both.
    m.text = m.lines.join('\n').replace(/<This message was edited>/gi, '').replace(/^\s*<(image|media|video) omitted>\s*/i, '')
      .replace(/^\s*[\w.-]+\.(jpe?g|png|webp|heic|pdf|opus|mp4|3gp)\s*\(file attached\)\s*/i, '').trim();
    delete m.lines;
    m.kind = prodKind(m.text);
    return m;
  }).filter(function(m) { return m.text && !/omitted>$/i.test(m.text) && !/^this message was deleted$/i.test(m.text) && !/end-to-end encrypted/i.test(m.text); });
}

/* A chemical delivery is Stock's, not incoming material: "Incoming spray 22/09/26", "incoming camical local". */
var PROD_CHEM_IN_RE = /c[ae]mical|chemical|spray|acid|sollt|salt|zink|zinc|nitric|hcl|brightner|cyn[ei]de|passivat/i;
/* What a message is. A roll goes to attendance (its production block comes here as well); chemicals go to Stock. */
function prodKind(text) {
  var t = String(text || ''), head = t.split('\n').slice(0, 2).join(' ');
  var rk = relayKind(t);
  // "28/5/26/ in time6:00 am morning ot": the roll's own dated head, even with no space before the time.
  if (rk === 'in' || rk === 'out' || /^\s*\d{1,2}\/\d{1,2}\/\d{2,4}\/*\s*(in|out)\s*-*\s*time/i.test(t)) return 'roll';
  if (rk === 'stock') return 'stock';
  if (/p\w{0,2}[ckx]{1,2}l\w*[ \t]*t\w*me|in[ \t]*c?o?ming[ \t]*ma|i+n?x?o?coming|incoming[ \t]*time/i.test(t) && !PROD_CHEM_IN_RE.test(head)) return 'pickling';
  if (PROD_LIST_HEAD_RE.test(head) || /^\s*b[ae]r+[ae]*l+\.?\s*production/im.test(t)) return 'production';
  // Before power: a slot log may carry a power cut among its slots, and read as power alone its slots were lost.
  if (prodIsRunLog(t)) return 'runs';
  if (/p[ao]w[ae]r\s*(cut|cat|cute|in|out|no)|pawar\s*cut|single\s*ph[ae]se/i.test(t)) return 'power';
  if (/^\s*-*\s*(production|work)\s*-*\s*$/im.test(t)) return 'production';
  return 'other';
}

/* A time as the floor writes it, in minutes. Three-digit hours ("109:00AM") are a slip, never read as 9:00; a
   time with no AM/PM takes the reading closest before the moment it was posted. */
function prodTimeOf(frag, sentAt) {
  var s = String(frag || '').replace(/\d{1,2}\/\d{1,2}\/\d{2,4}\/?/g, ' ');
  var m = /(\d{1,3})\s*(?:[:.;]\s*(\d{1,2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/i.exec(s);
  if (!m) return { min: null };
  var h = +m[1], mm = m[2] != null ? +m[2] : 0, ap = m[3] ? (/p/i.test(m[3]) ? 'pm' : 'am') : '';
  if (m[1].length === 3 || h > 23 || mm > 59) return { min: null, issue: { tone: 'amber', code: 'time', text: 'The time "' + m[0].trim() + '" could not be read; enter it by hand if it matters.' } };
  if (h > 12) return { min: h * 60 + mm };
  if (ap) {
    var min = (h % 12 + (ap === 'pm' ? 12 : 0)) * 60 + mm, other = ap === 'pm' ? min - 720 : min + 720;
    // A slipped AM/PM: "9:00pm" posted at 9:28 in the morning, "2:00am" posted at 3 in the afternoon (nothing is
    // pickled before the 6 AM start). The other reading is taken when it fits before the post, and said so.
    var slip = sentAt != null && other >= 360 && other <= sentAt + 30 && (min > sentAt + 30 || (ap === 'am' && h % 12 < 6));
    if (slip) return { min: other, issue: { tone: 'amber', code: 'meridiem', text: 'Written ' + relayClockLabel(min) + ', read as ' + relayClockLabel(other) + ' from when it was sent (' + relayClockLabel(sentAt) + ').' } };
    if (sentAt != null && min > sentAt + 30) return { min: min, issue: { tone: 'amber', code: 'later', text: relayClockLabel(min) + ' is later than the message was sent (' + relayClockLabel(sentAt) + ').' } };
    return { min: min };
  }
  var am = (h % 12) * 60 + mm, pm = am + 720;
  if (sentAt != null) {
    var pick = pm <= sentAt + 15 ? pm : am;
    return { min: pick, issue: { tone: 'info', code: 'meridiem', text: relayClockLabel(pick) + ': no AM or PM written, read from when it was sent.' } };
  }
  var guess = h >= 6 && h <= 11 ? am : pm;
  return { min: guess, issue: { tone: 'amber', code: 'meridiem', text: relayClockLabel(guess) + ': no AM or PM written.' } };
}

/* ---------- Clients ---------- */
var PROD_NAME_NOISE = { PVT: 1, LTD: 1, LIMITED: 1, P: 1, CO: 1, THE: 1, AND: 1, M: 1, S: 1 };
function prodClientIndex(clients, learnt) {
  var byKey = {}, byFold = {}, bySkel = {}, list = [];
  var put = function(map, k, c) { if (!k) return; if (!(k in map)) map[k] = c; else if (map[k] && map[k].id !== c.id) map[k] = null; };
  (clients || []).forEach(function(c) {
    var words = String(c.name || '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
    var clean = words.filter(function(w) { return !PROD_NAME_NOISE[w]; });
    var full = relayKey(c.name), v = [full, relayKey(clean.join(''))];
    for (var n = 1; n <= Math.min(3, clean.length); n++) v.push(relayKey(clean.slice(0, n).join('')));
    var rec = { id: c.id, name: c.name, full: full, keys: [] };
    v.forEach(function(k) { if (k && k.length >= 3 && rec.keys.indexOf(k) < 0) rec.keys.push(k); });
    rec.keys.forEach(function(k) { put(byKey, k, rec); });
    list.push(rec);
  });
  Object.keys(byKey).forEach(function(k) { if (byKey[k]) { put(byFold, relayFold(k), byKey[k]); if (k.length >= 5) put(bySkel, relaySkel(k), byKey[k]); } });
  var learn = {};
  Object.keys(learnt || {}).forEach(function(k) { learn[k] = learnt[k]; });
  return { byKey: byKey, byFold: byFold, bySkel: bySkel, list: list, learnt: learn };
}

/* A written name → {id, name, how: 'exact' | 'learnt' | 'read-as'} or null. "read-as" is shown on the review with
   a picker on the guess, and remembered once saved; a key two clients share matches neither. */
function prodMatchClient(written, idx) {
  var k = relayKey(written);
  if (!k || !idx) return null;
  if (k in idx.learnt) {
    var lid = idx.learnt[k], lrec = idx.list.find(function(c) { return String(c.id) === String(lid); });
    if (lrec) return { id: lrec.id, name: lrec.name, how: 'learnt' };
  }
  if (idx.byKey[k]) return { id: idx.byKey[k].id, name: idx.byKey[k].name, how: 'exact' };
  if (k.length < 4) return null;
  var hits = [];
  var add = function(rec) { if (rec && hits.indexOf(rec) < 0) hits.push(rec); };
  if (k.length >= 5) idx.list.forEach(function(c) { if (c.full.indexOf(k) >= 0) add(c); });
  if (hits.length === 1) return { id: hits[0].id, name: hits[0].name, how: 'read-as' };
  if (hits.length > 1) return null;
  add(idx.byFold[relayFold(k)]);
  if (!hits.length && k.length >= 5) add(idx.bySkel[relaySkel(k)]);
  if (!hits.length) {
    // One letter off only for a name of six letters or more ("SIYA" is not "SITA"), two from eight.
    var lim = k.length >= 8 ? 2 : k.length >= 6 ? 1 : 0;
    if (lim) Object.keys(idx.byKey).forEach(function(key) {
      var rec = idx.byKey[key];
      if (rec && key.length >= 6 && key[0] === k[0] && relayEdit(k, key) <= lim) add(rec);
    });
  }
  return hits.length === 1 ? { id: hits[0].id, name: hits[0].name, how: 'read-as' } : null;
}

/* ---------- One item line ---------- */
/* "Dorabji 0140- 300 nos", "CLAMP133×83(35×6)-774 nos", "188 CD--995 NOS ,96.970Kg", "Higco Nat ....",
   "80×81=297nos", "BOLT--1800+450 Nos", "Eye bolt--20.640kg" → {client, part, gauge, qty, unit, qty2, unit2}. */
function prodReadItem(line, idx) {
  var raw = String(line || '');
  var s = raw.replace(/[×✕]/g, 'X').replace(/(\d),(\d{3})\b/g, '$1$2').replace(/^[\s\-_=*•.]+/, '').trim();
  var out = { part: '', gauge: '', qty: null, unit: null, qty2: null, unit2: null, qtySrc: null, rework: false, dots: false };
  if (/\bre[-\s]*(work|pickl|plat)/i.test(s)) out.rework = true;
  var toks = [], m;
  PROD_QTY_TOKEN_RE.lastIndex = 0;
  while ((m = PROD_QTY_TOKEN_RE.exec(s))) {
    // "35X6" or "M 14X2" is a size, never a count; a token must not sit inside one.
    var before = s.slice(0, m.index);
    if (/X\s*$/i.test(before)) continue;
    toks.push({ at: m.index, end: m.index + m[0].length, num: m[1], unit: PROD_UNIT_OF[m[2].toUpperCase()] || null });
  }
  var partText = s;
  if (toks.length) {
    var t = toks[0];
    partText = s.slice(0, t.at);
    var nums = t.num.split('+').map(function(x) { return parseFloat(x); });
    out.qty = nums.reduce(function(a, b) { return a + b; }, 0);
    out.qtySrc = nums.length > 1 ? 'working' : 'written';
    out.unit = t.unit;
    if (toks[1]) { out.qty2 = parseFloat(toks[1].num); out.unit2 = toks[1].unit; }
  } else {
    var tail = /^(.*?[A-Za-z0-9)\]])\s*(?:-{1,3}|_{2}|=)\s*(\d+(?:\.\d+)?)\s*$/.exec(s);
    // No unit written: a figure with decimals is weighed ("188CD-45.240"), a whole one counted. Said on the review.
    if (tail) { partText = tail[1]; out.qty = parseFloat(tail[2]); out.qtySrc = 'written'; out.unit = /\.\d/.test(tail[2]) ? 'KG' : 'NOS'; out.unitGuess = true; }
    else if (/\.{3,}\s*$/.test(s)) { partText = s.replace(/\.{3,}\s*$/, ''); out.dots = true; }
  }
  partText = partText.replace(/\s*(?:-{1,3}|_{2}|=|,)\s*$/, '').replace(/\(\s*now\s*\)/i, '').trim();
  // A client written at the front: the longest run of up to three words that names one ("Dorabji--4206" is two).
  partText = partText.replace(/^([A-Za-z][A-Za-z.&]*)-{2,3}(?=[A-Za-z0-9])/, '$1 ');
  var words = partText.split(/\s+/).filter(Boolean), alpha = 0;
  while (alpha < words.length && alpha < 3 && /^[A-Za-z][A-Za-z.&]*$/.test(words[alpha])) alpha++;
  var peel = function(exact) {
    for (var n = alpha; n >= 1 && idx; n--) {
      var head = words.slice(0, n).join(' '), hit = prodMatchClient(head, idx);
      if (hit && (!exact || hit.how !== 'read-as')) return { n: n, head: head, hit: hit };
    }
    return null;
  };
  var got = peel(true) || peel(false);
  if (got) {
    out.client = got.head; out.clientId = got.hit.id; out.clientName = got.hit.name; out.clientHow = got.hit.how;
    var rest = words.slice(got.n);
    // "KHURANA INDUSTRY", "SIYA ENTERPRISES": what is left is the rest of the firm's name, not a part.
    while (rest.length && (PROD_FIRM_RE.test(rest[0]) || PROD_NAME_NOISE[rest[0].toUpperCase().replace(/[^A-Z]/g, '')]) && !/\d/.test(rest[0])) { out.client += ' ' + rest[0]; rest = rest.slice(1); }
    partText = rest.join(' ').replace(/^[\s\-_,]+/, '');
  }
  var g = lineGauge(partText);
  out.gauge = g;
  out.part = partText.trim();
  return out;
}
/* The part with its gauge text taken out, so a floor line and a challan line key alike: "CLAMP 165X83(40X6)" and
   "CLAMP165X83 (40×6)" are one part at one gauge. */
function prodPartBase(part) {
  return String(part || '').replace(/[×✕]/g, 'X').replace(/\(\s*\d{2}\s*X\s*\d\s*\)|(?:^|[^0-9A-Z])\d{2}\s*X\s*\d(?![0-9X])/gi, ' ')
    .replace(/\((NT|UT)\)/gi, ' ').trim();
}

/* ---------- The pickling hand's message ---------- */
function prodIsTimeLine(s) { return /p\w{0,2}[ckx]{1,2}l\w*[ \t]*t\w*me/i.test(s); }
function prodIsIncomingLine(s) { return /in\s*c?o?m\w*\s*(ma\w*\s*)?(t\w*me|rime)|i+n?x?o?coming|incoming\s*time|evening\s*incoming/i.test(s) && !PROD_CHEM_IN_RE.test(s); }
function prodIsPowerLine(s) { return /p[ao]w[ae]r|pawar|single\s*ph[ae]se/i.test(s) && /cut|cat|in\b|out|no\s*in|ph[ae]se/i.test(s); }

function parsePickling(msg, ctx) {
  var lines = String(msg.text || '').split('\n'), items = [], notes = [];
  var date = msg.sentOn || ctx.today, noDate = !msg.sentOn;
  var mode = 'pickled', reworkOn = false, group = null, lastGroup = null, carriedGroup = false, pendingParts = [], family = null, arrivedAt = null, power = {};
  // A line that is only a figure and its unit ("1000 NOS"): the quantity of the load written above it, never a part.
  var bareQty = function(l) { var r = prodReadItem(l || '', null); return !r.part && r.qty != null; };
  var flush = function(kind, t) {
    pendingParts.forEach(function(it) { it.kind = kind; if (t) { it.time = prodHhmm(t.min); if (t.issue) it.issues.push(t.issue); } items.push(it); });
    pendingParts = [];
  };
  // What is still listed when the message ends or a new incoming block begins: arrived at its own block's time, or
  // loads whose pickling time never came, and said so. An incoming head used to flush the block above it with no
  // time at all, so material that arrived at 8:45 read as arriving at no time once a second block followed.
  var flushOpen = function() {
    if (!pendingParts.length) return;
    pendingParts.forEach(function(it) { if (mode !== 'arrived' || !arrivedAt || arrivedAt.min == null) it.issues.push({ tone: 'amber', code: 'notime', text: mode === 'arrived' ? 'Arrived: no time written.' : 'No pickling time written under it.' }); });
    flush(mode, mode === 'arrived' ? arrivedAt : null);
  };
  lines.forEach(function(raw, i) {
    var line = raw.trim(), n = i + 1;
    if (!line) return;
    var dm = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?/);
    if (dm && isoFromDmy(dm[1], dm[2], dm[3])) { date = isoFromDmy(dm[1], dm[2], dm[3]); noDate = false; line = line.slice(dm[0].length).trim(); if (!line) return; }
    // A date written with dots or dashes ("22.09.26") is the date as well; one with no year ("16/9") names no day a load
    // can take, and is listed. Any other line of figures is a load ("8201/8202", "4206-1000", "0160--30"): those were
    // dropped unseen with the dates (P127).
    var dd = line.match(/^(\d{1,2})\s*[.\-\/]\s*(\d{1,2})(?:\s*[.\-\/]\s*(\d{2,4}))?\s*[.\-\/]?$/);
    if (dd && isoFromDmy(dd[1], dd[2], dd[3] || 2000)) {
      if (dd[3]) { date = isoFromDmy(dd[1], dd[2], dd[3]); noDate = false; }
      else notes.push({ n: n, raw: raw, text: 'A date with no year: the loads keep the message’s date' });
      return;
    }
    if (prodIsPowerLine(line)) { prodPowerStep(power, line, raw, n, date, msg.sentAt, items, notes); return; }
    if (prodIsIncomingLine(line)) {
      flushOpen();
      mode = 'arrived';
      var afterHead = line.replace(/^.*?(t\w*me|rime)/i, '');
      arrivedAt = prodTimeOf(afterHead, msg.sentAt);
      // "IncomingMaterial time 4:15 pm SUPPORT(3319)--1000 Nos": a part written on the head line itself.
      var tail = afterHead.replace(/^\s*\d{1,2}\s*(?:[:.]\s*\d{2})?\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)?/i, '').trim();
      if (/[A-Za-z]/.test(tail) && /\d/.test(tail)) pendingParts.push(prodItemRecord(prodReadItem(tail, ctx.clients), group || lastGroup, raw, n, date, noDate));
      return;
    }
    if (prodIsTimeLine(line)) {
      var t = prodTimeOf(line.replace(/^.*?t\w*me/i, ''), msg.sentAt);
      var re = /\bre[-\s]*p/i.test(line);
      if (mode === 'arrived') {
        // "Incoming … / parts / And Pickling Time 9:00" — the same material arrived and went in.
        var arrived = pendingParts.map(function(it) { return Object.assign({}, it, { issues: it.issues.slice() }); });
        pendingParts.forEach(function(it) { it.rework = it.rework || re; });
        flush('pickled', t);
        arrived.forEach(function(it) { it.kind = 'arrived'; it.time = prodHhmm(arrivedAt && arrivedAt.min); if (arrivedAt && arrivedAt.issue) it.issues.push(arrivedAt.issue); items.push(it); });
        mode = 'pickled';
      } else {
        if (re) pendingParts.forEach(function(it) { it.rework = true; });
        if (!pendingParts.length) notes.push({ n: n, raw: raw, text: 'A pickling time with nothing listed above it' });
        flush('pickled', t);
      }
      lastGroup = group || lastGroup; group = null; carriedGroup = false; family = null; reworkOn = false;
      return;
    }
    if (!/[A-Za-z0-9]/.test(line)) return;
    // "RE-PICKLING" on a line of its own marks the loads of this group as rework, above it and below it.
    if (/^\s*re[-\s]*(work|pickl\w*|plat\w*)\s*$/i.test(line)) { pendingParts.forEach(function(x) { x.rework = true; }); reworkOn = true; return; }
    if (/^\s*b[ae]r+[ae]*l+\.?\s*(production)?\s*$/i.test(line) || /unlo?a?d|lo?a?ding/i.test(line)) { notes.push({ n: n, raw: raw, text: 'A barrel note, not a pickling load; not read' }); return; }
    var it = prodReadItem(line, ctx.clients);
    var clientLine = !it.part && it.qty == null && it.clientId != null;
    var firmy = it.qty == null && !it.clientId && PROD_FIRM_RE.test(line) && !/\d/.test(line);
    // A name with lines under it heads them; one with nothing under it but its pickling time is the load itself
    // ("BIG LINER / Pickling time 10:30": no client written, no quantity), which was taken as a client and lost. So is one
    // with only its figure under it ("LINER / 1000 NOS"): the figure is the load's.
    var below = (lines.slice(i + 1).find(function(l) { return l.trim(); }) || '').trim();
    if (clientLine || firmy || (!group && it.qty == null && !it.clientId && /^[A-Za-z]/.test(line) && !/\d/.test(line) && below && !prodIsTimeLine(below) && !bareQty(below))) {
      group = { client: it.client || line, clientId: it.clientId != null ? it.clientId : null, clientName: it.clientName || '', how: it.clientHow || (firmy ? 'firm' : 'first') };
      carriedGroup = false; family = null;
      return;
    }
    if (it.clientId != null) { group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow }; carriedGroup = false; }
    // A part under a second pickling time with no client written again: the client above it, said so on every load it is
    // carried to (the check then takes a pick on such a load as that load's own, and never learns the name from it).
    if (!group && lastGroup) { group = lastGroup; carriedGroup = true; }
    if (!it.part && it.qty != null && pendingParts.length && pendingParts[pendingParts.length - 1].qty == null) {
      var last = pendingParts[pendingParts.length - 1];
      last.qty = it.qty; last.unit = it.unit; last.qtySrc = it.qtySrc; last.raw += '\n' + raw;
      return;
    }
    if (family && /^\d/.test(it.part)) it.part = family + ' ' + it.part;
    var rec = prodItemRecord(it, group, raw, n, date, noDate);
    if (reworkOn) rec.rework = true;
    if (carriedGroup) rec.issues.push({ tone: 'amber', code: 'carried', text: 'No client written for this load: ' + (group.clientName || group.client) + ', from the load above.' });
    // "CLAMP" over "165×83(35×6)--420 NOS": the lines below are its sizes. Over a line with only its figure ("LINER / 1000
    // NOS") it is the load itself: taken for a family, the 1000 was saved with no part.
    var next = /^\s*[\d(]/.test((lines[i + 1] || '').replace(/[×✕]/g, 'X')) ? prodReadItem(lines[i + 1], null) : null;
    if (it.qty == null && /^[A-Za-z][A-Za-z .]*$/.test(it.part) && next && next.qty != null && next.part) {
      family = it.part;
      return;
    }
    pendingParts.push(rec);
  });
  flushOpen();
  prodPowerEnd(power, date, items);
  return { items: items, notes: notes, date: date, noDate: noDate };
}

function prodDowntime(date, cut, inMin, open, raw, n, inIssue) {
  var it = { kind: 'downtime', date: date, time: prodHhmm(cut.min), to: prodHhmm(inMin), downtime: { cause: 'power', open: !!open || inMin == null }, raw: raw, n: n, issues: [] };
  // What the time reader said is kept (P127): a cut with no time read was saved as none, unsaid, and counted in no day.
  if (cut.min == null) it.issues.push({ tone: 'amber', code: 'time', text: 'No time read for this power cut: it is kept, but a cut with no time counts in no day’s power. Enter it by hand if it matters.' });
  else if (cut.issue) it.issues.push(cut.issue);
  if (inIssue) it.issues.push(inIssue);
  return it;
}
/* A power line, the same in every message that carries one. A cut opens one; the power back closes it; a second cut
   while one is open keeps the first as open rather than dropping it (or, in the barrel list, reading the second cut
   as the first one's return). The power back with no cut above it is a note that keeps its day and minute, so a cut
   in an earlier message of the same paste can take it (prodPairPower): the floor sends the two twenty minutes apart. */
function prodPowerStep(pw, line, raw, n, date, sentAt, items, notes) {
  var pt = prodTimeOf(line.replace(/^.*?(cut|cat|cute|in|out)\b/i, ''), sentAt);
  if (/cut|cat|out/i.test(line) && !/\bin\b/i.test(line.replace(/cut|cat/i, ''))) {
    prodPowerEnd(pw, date, items);
    pw.cutAt = { min: pt.min, issue: pt.issue || null, n: n, raw: raw, date: date };
  } else if (pw.cutAt) {
    var notBack = /no\s*in/i.test(line);
    var inIssue = !notBack && pt.min == null ? { tone: 'amber', code: 'time', text: 'No time read for the power back: the cut is kept with no time back.' } : pt.issue;
    items.push(prodDowntime(pw.cutAt.date, pw.cutAt, pt.min, notBack, pw.cutAt.raw + '\n' + raw, pw.cutAt.n, inIssue));
    pw.cutAt = null;
  } else notes.push({ n: n, raw: raw, text: 'The power back, with no cut above it in this message', powerIn: { date: date, min: pt.min, issue: pt.issue || null } });
}
function prodPowerEnd(pw, date, items) {
  if (pw.cutAt) items.push(prodDowntime(pw.cutAt.date || date, pw.cutAt, null, true, pw.cutAt.raw, pw.cutAt.n));
  pw.cutAt = null;
}

function prodItemRecord(it, group, raw, n, date, noDate) {
  var rec = { kind: 'pickled', date: date, time: null, client: group ? group.client : (it.client || ''), clientId: group ? group.clientId : (it.clientId != null ? it.clientId : null),
    clientName: group ? group.clientName : (it.clientName || ''), part: it.part, gauge: it.gauge, qty: it.qty, unit: it.unit, qty2: it.qty2, unit2: it.unit2, qtySrc: it.qtySrc,
    rework: it.rework, raw: raw, n: n, issues: [] };
  if (noDate) rec.issues.push({ tone: 'amber', code: 'nodate', text: 'No date in the message: read as ' + date + '.' });
  var how = group ? group.how : it.clientHow;
  // How the client was found, for the check alone (never saved): what may be learnt from the owner's pick turns on it.
  rec.clientHow = how || '';
  if (rec.clientId == null) rec.issues.push({ tone: 'red', code: 'client', text: rec.client ? '"' + rec.client + '" is not a client in the book. Pick the client, or keep it as written.' : 'No client written above this line. Pick the client.' });
  else if (how === 'read-as') rec.issues.push({ tone: 'amber', code: 'readas', text: '"' + rec.client + '" read as ' + rec.clientName + '.' });
  if (it.qty != null && (!it.unit || it.unitGuess)) rec.issues.push({ tone: 'amber', code: 'unit', text: 'No unit written: ' + it.qty + ' read as ' + (it.unit === 'KG' ? 'kg' : 'pieces') + '.' });
  if (it.dots) rec.issues.push({ tone: 'info', code: 'dots', text: 'Quantity left as dots in the message.' });
  if (!it.part) rec.issues.push({ tone: 'info', code: 'nopart', text: 'No part named: counted for the client, in no part\u2019s figures.' });
  return rec;
}

/* ---------- The supervisor's barrel list ---------- */
function parseProductionList(msg, ctx) {
  var lines = String(msg.text || '').split('\n'), items = [], notes = [];
  // Before 19 May the list was a timed log of unload and load cycles counted in barrels ("Unlod time 10:00am /
  // 90 CD ganral 120k ×4"): barrels, not pieces or kilograms. It is listed, not read. A count of barrels is a figure
  // before the word; the list's own date is not one ("22/09/26 berral production", with no slash after the date, was
  // taken for a count and the whole list thrown away).
  if (/unlo?a?d/i.test(msg.text) || /\d\s*b[ae]r+[ae]*l+\b/i.test(String(msg.text || '').replace(/\d{1,2}\/\d{1,2}\/\d{2,4}\/*/g, ' '))) {
    lines.forEach(function(raw, i) { if (raw.trim()) notes.push({ n: i + 1, raw: raw, text: 'An older timed barrel log, in barrels; not read' }); });
    return { items: [], notes: notes, date: msg.sentOn || ctx.today };
  }
  var date = msg.sentOn || ctx.today, noDate = !msg.sentOn, group = null, family = null, power = {};
  lines.forEach(function(raw, i) {
    var line = raw.trim(), n = i + 1;
    if (!line) return;
    var hm = line.match(PROD_LIST_HEAD_RE);
    if (hm) { if (isoFromDmy(hm[1], hm[2], hm[3])) { date = isoFromDmy(hm[1], hm[2], hm[3]); noDate = false; } line = line.slice(hm[0].length).trim(); if (!line) return; }
    else if (/^\s*b[ae]r+[ae]*l+\.?\s*production\s*$/i.test(line) || /^\s*-*\s*(production|work)\s*-*\s*$/i.test(line)) return;
    var dm = line.replace(/\s+/g, '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/*$/);
    if (dm) { date = isoFromDmy(dm[1], dm[2], dm[3]) || date; noDate = false; return; }
    if (prodIsPowerLine(line)) { prodPowerStep(power, line, raw, n, date, null, items, notes); return; }
    if (/unlo?a?d|lo?ding\s*time|^\s*\d{1,2}:\d{2}\s*[ap]m.*[}{]/i.test(line)) { notes.push({ n: n, raw: raw, text: 'An older timed barrel cycle; not read' }); return; }
    if (!/[A-Za-z0-9]/.test(line)) return;
    var cont = /^\s*-{3,}/.test(raw);
    var it = prodReadItem(line, ctx.clients);
    if (!it.part && it.qty == null && it.clientId != null) { group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow }; family = null; return; }
    if (!it.part && it.qty != null && items.length && items[items.length - 1].qty == null && items[items.length - 1].kind === 'plated') {
      var last = items[items.length - 1];
      last.qty = it.qty; last.unit = it.unit; last.qtySrc = it.qtySrc; last.raw += '\n' + raw;
      last.issues = last.issues.filter(function(x) { return x.code !== 'dots'; });
      return;
    }
    if (it.clientId != null) { group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow }; family = null; }
    else if (!cont && !group && /^[A-Za-z]/.test(line)) {
      // A first word that names nobody the book holds: the client or the part? Asked. It is taken for the client
      // only with a part written after it ("KUMAR 0140--300 NOS"); alone before its figure it is the part ("LINER
      // 1000 NOS"), which read as a client with no part. Either way a name read by its place alone is never learnt
      // (how 'unknown', prodSaveReview): the owner's pick says whose the load is, not that the word is their name.
      var w0 = line.split(/\s+/)[0];
      var rest = it.part.replace(new RegExp('^' + w0.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'), '');
      if (rest) { group = { client: w0, clientId: null, clientName: '', how: 'unknown' }; it.part = rest; }
    }
    if (family && /^\d/.test(it.part)) it.part = family + ' ' + it.part;
    if (it.qty == null && !it.dots && /^[A-Za-z][A-Za-z .-]*$/.test(it.part) && /^\s*\d/.test((lines[i + 1] || '').replace(/[×✕]/g, 'X')) && /=|nos|kg/i.test(lines[i + 1] || '')) {
      family = it.part; return;
    }
    var rec = prodItemRecord(it, group, raw, n, date, false);
    rec.kind = 'plated'; rec.line = 'barrel'; rec.lineSrc = 'written'; rec.slot = 'day'; rec.basis = 'relay';
    items.push(rec);
  });
  if (noDate) items.forEach(function(it) { it.issues.push({ tone: 'amber', code: 'nodate', text: 'No date on the list: read as ' + date + '.' }); });
  prodPowerEnd(power, date, items);
  return { items: items, notes: notes, date: date, noDate: noDate };
}

/* ---------- Production by slot: the register typed as text ---------- */
/* Owner, 9 Oct 2026: "the parser refuses to read it even when the data is available. Same for Barrel and VAT A2
   production pasted as text rather than uploaded as an image". A day's head, then one slot a line: its from and to,
   what was plated on it, the line it ran on:
     08/10/26 -
     5 pm - 8 pm - Mehta clamp 165x83(40x6) - 400 nos + Clamp 140/146x91(32x6) - 606 nos = 1006 nos VAT A1
     9 PM - 4 AM - General 188 CD - 300.4 KG VAT A1
   It is the register's page in words, so a slot is a run on its line, in the general shift or overtime by when it
   began (the photo's rule); a part after "+" with no client of its own is the slot's client; "= 1006 nos" is checked
   against the parts, never taken for one. A slot with no line written is asked, never guessed. */
var PROD_RUN_TIME = '\\d{1,2}(?:\\s*[:.]\\s*\\d{2})?\\s*(?:[ap]\\.?\\s?m\\.?)?';
var PROD_RUN_RE = new RegExp('^\\s*(' + PROD_RUN_TIME + ')\\s*(?:-+|–|—|\\bto\\b)\\s*(' + PROD_RUN_TIME + ')\\s*(?:-+|–|—|:)\\s*(.+)$', 'i');
var PROD_LINE_TOKEN = '(?:VAT[\\s.-]*A?[\\s.-]*[12]|V[\\s.]?A[\\s.]?[12]|B[AE]R+[AE]*L+)';
var PROD_LINE_END_RE = new RegExp('[\\s,–-]*\\(?\\b(' + PROD_LINE_TOKEN + ')\\)?\\s*\\.?\\s*$', 'i');
var PROD_LINE_LEAD_RE = new RegExp('^\\s*(' + PROD_LINE_TOKEN + ')\\b\\s*[-–:]+\\s*', 'i');
var PROD_LINE_ONLY_RE = new RegExp('^[\\s*–-]*(' + PROD_LINE_TOKEN + ')[\\s*:–-]*$', 'i');
var PROD_RUN_TOTAL_RE = /\s*=\s*(\d+(?:\.\d+)?)\s*(nos|no|pcs|pc|pieces|kgs|kg)?\.?\s*$/i;
/* A line's own name ("VAT A1", "VAT-A2", "V A 2", "Barrel", "berral") as its id; anything else, or two lines, null. */
function prodLineOfToken(token) {
  var a = relayHeaderAreas(token).filter(function(x) { return PROD_LINES.indexOf(x) >= 0; });
  return a.length === 1 ? a[0] : null;
}
/* A slot line, with any line name at its front taken off: {from, to, rest, lead}, or null. */
function prodRunMatch(line) {
  var lead = null, s = String(line || '');
  var lm = s.match(PROD_LINE_LEAD_RE);
  if (lm) { lead = prodLineOfToken(lm[1]); s = s.slice(lm[0].length); }
  var m = s.match(PROD_RUN_RE);
  return m ? { from: m[1], to: m[2], rest: m[3], lead: lead } : null;
}
/* A message is a slot log when a line reads as a slot with a figure or a line name on it. */
function prodIsRunLog(text) {
  return String(text || '').split('\n').some(function(l) {
    var m = prodRunMatch(l);
    if (!m) return false;
    PROD_QTY_TOKEN_RE.lastIndex = 0;
    return PROD_QTY_TOKEN_RE.test(m.rest) || PROD_LINE_END_RE.test(m.rest) || m.lead != null;
  });
}
/* The slot's two times in minutes. A time written without AM or PM takes the other's; when neither says, the shop's
   hours decide (6 to 11 is the morning) and it is said. A slot that runs past midnight ends before it began. */
function prodRunTimes(a, b) {
  var p = function(s) {
    var m = /^(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*([ap])?/i.exec(String(s || '').trim());
    return m ? { h: +m[1], mm: m[2] ? +m[2] : 0, ap: m[3] ? m[3].toLowerCase() : '' } : null;
  };
  var x = p(a), y = p(b), issues = [];
  if (!x || !y || x.h > 23 || y.h > 23 || x.mm > 59 || y.mm > 59) {
    return { from: null, to: null, issues: [{ tone: 'amber', code: 'time', text: 'The slot’s times could not be read; enter them by hand if they matter.' }] };
  }
  var at = function(t, ap) { return t.h > 12 ? t.h * 60 + t.mm : (t.h % 12 + (ap === 'p' ? 12 : 0)) * 60 + t.mm; };
  var flip = function(ap) { return ap === 'p' ? 'a' : 'p'; };
  var said = x.ap || y.ap || x.h > 12 || y.h > 12, from, to;
  if (x.ap || x.h > 12) {
    from = at(x, x.ap);
    to = y.ap || y.h > 12 ? at(y, y.ap) : at(y, x.ap);
    if (!y.ap && y.h <= 12 && to <= from) to = at(y, flip(x.ap || 'p'));
  } else if (y.ap || y.h > 12) {
    to = at(y, y.ap);
    from = at(x, y.ap);
    if (from > to && y.h <= 12) from = at(x, flip(y.ap));
  } else {
    var apx = x.h >= 6 && x.h <= 11 ? 'a' : 'p';
    from = at(x, apx);
    to = at(y, apx);
    if (to <= from) to = at(y, flip(apx));
  }
  if (!said) issues.push({ tone: 'amber', code: 'meridiem', text: 'No AM or PM written: read as ' + relayClockLabel(from) + ' to ' + relayClockLabel(to) + '.' });
  return { from: from, to: to, issues: issues };
}
/* The parts of one slot: split at a "+" that starts a new part ("400 nos + Clamp …"), never at one inside a figure
   ("1800+450 nos") or inside brackets. */
function prodRunPieces(s) {
  var out = [], depth = 0, cur = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === '+' && !depth && /^\s*[A-Za-z]/.test(s.slice(i + 1)) && /\S/.test(cur)) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (/\S/.test(cur)) out.push(cur);
  return out.map(function(x) { return x.trim(); });
}
function parseProductionRuns(msg, ctx) {
  var lines = String(msg.text || '').split('\n'), items = [], notes = [], power = {};
  var date = msg.sentOn || ctx.today, noDate = !msg.sentOn, curLine = null;
  lines.forEach(function(raw, i) {
    var line = raw.trim(), n = i + 1;
    if (!line) return;
    var dm = line.match(/^(?:date\s*[:-]?\s*)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[-–:,]*\s*$/i);
    if (dm) {
      var d = isoFromDmy(dm[1], dm[2], dm[3]);
      if (d) { prodPowerEnd(power, date, items); date = d; noDate = false; }
      return;
    }
    // "VAT A2" on a line of its own: the line of the slots under it.
    var lo = line.match(PROD_LINE_ONLY_RE);
    if (lo) { curLine = prodLineOfToken(lo[1]); return; }
    if (prodIsPowerLine(line)) { prodPowerStep(power, line, raw, n, date, null, items, notes); return; }
    var m = prodRunMatch(line);
    if (!m) { notes.push({ n: n, raw: raw, text: 'Not read as production' }); return; }
    var times = prodRunTimes(m.from, m.to), rest = m.rest, runLine = m.lead;
    var le = rest.match(PROD_LINE_END_RE);
    if (le && prodLineOfToken(le[1])) { runLine = runLine || prodLineOfToken(le[1]); rest = rest.slice(0, le.index); }
    if (!runLine) runLine = curLine;
    var total = null, tm = rest.match(PROD_RUN_TOTAL_RE);
    if (tm) { total = { qty: parseFloat(tm[1]), unit: tm[2] ? PROD_UNIT_OF[tm[2].toUpperCase()] || null : null }; rest = rest.slice(0, tm.index); }
    var group = null, recs = [];
    prodRunPieces(rest).forEach(function(piece) {
      // "500 nos + 300 nos": one part counted in two goes, the sum, as "500+300 nos" reads (two units are left apart).
      var sumRe = /(\d+(?:\.\d+)?)\s*(nos|no|pcs|pc|kgs|kg)\.?\s*\+\s*(\d+(?:\.\d+)?)\s*(nos|no|pcs|pc|kgs|kg)\b/i, sm;
      while ((sm = piece.match(sumRe)) && PROD_UNIT_OF[sm[2].toUpperCase()] === PROD_UNIT_OF[sm[4].toUpperCase()]) {
        piece = piece.slice(0, sm.index) + sm[1] + '+' + sm[3] + ' ' + sm[4] + piece.slice(sm.index + sm[0].length);
      }
      var it = prodReadItem(piece, ctx.clients);
      // After the slot's client, a part's first word is only another client when it names one exactly: "Clamp 140x91"
      // after "Mehta clamp …" is the clamp, not a client whose name holds the word (read-as would take it off the part).
      if (group && it.clientId != null && it.clientHow === 'read-as') it = prodReadItem(piece, null);
      // A client named alone ("Mehta + …"): the client of the parts after it.
      if (it.clientId != null && !it.part && it.qty == null) { group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow }; return; }
      if (it.clientId != null) group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow };
      else if (!group && /^[A-Za-z]/.test(piece)) {
        // A first word that names nobody the book holds, with a part after it, is asked as the client (the barrel
        // list's rule); alone before its figure it is the part.
        var w0 = piece.split(/\s+/)[0], restPart = it.part.replace(new RegExp('^' + w0.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'), '');
        if (restPart) { group = { client: w0, clientId: null, clientName: '', how: 'unknown' }; it.part = restPart; }
      }
      var rec = prodItemRecord(it, it.clientId == null ? group : null, raw, n, date, false);
      rec.kind = 'plated'; rec.line = runLine || null; rec.lineSrc = runLine ? 'written' : null; rec.basis = 'relay';
      rec.time = prodHhmm(times.from); rec.to = prodHhmm(times.to);
      rec.slot = times.from != null && (times.from < RELAY_GENERAL || times.from >= RELAY_GENERAL_OUT) ? 'ot' : 'general';
      times.issues.forEach(function(x) { rec.issues.push(x); });
      if (!runLine) rec.issues.push({ tone: 'amber', code: 'noline', text: 'No line written on this slot. Pick the line, or leave it unknown.' });
      recs.push(rec);
    });
    if (!recs.length) { notes.push({ n: n, raw: raw, text: 'Not read as production' }); return; }
    if (total) {
      var same = recs.filter(function(r) { return r.qty != null && (!total.unit || r.unit === total.unit); });
      var sum = Math.round(same.reduce(function(t, r) { return t + r.qty; }, 0) * 1000) / 1000;
      if (same.length !== recs.length || Math.abs(sum - total.qty) > 0.0005) {
        recs[recs.length - 1].issues.push({ tone: 'amber', code: 'total', text: 'The parts add up to ' + sum + (total.unit ? ' ' + total.unit.toLowerCase() : '') + '; the slot says ' + total.qty + '.' });
      }
    }
    recs.forEach(function(r) { items.push(r); });
  });
  prodPowerEnd(power, date, items);
  if (noDate) items.forEach(function(it) { if (it.kind !== 'downtime') it.issues.push({ tone: 'amber', code: 'nodate', text: 'No date in the message: read as ' + date + '.' }); });
  return { items: items, notes: notes, date: date, noDate: noDate };
}

/* ---------- The production block inside a roll ---------- */
/* The roll parser already knows which lines are names; the block is the lines it read as notes under a
   "----production----" head. The block reports the overtime slot above it, and its line is the nearest area
   header above: a guess, so it is amber on the review and saved only once confirmed. */
function prodFromRoll(msg, ctx) {
  var rr = parseRelayRoll(msg.text, ctx.roster || [], msg.sentOn);
  var rollDate = rr.date || msg.sentOn || ctx.today, date = rollDate, items = [], notes = [], power = {};
  // One pass down the roll. The supervisor writes a slot's work under the slot, sometimes under a "----production----"
  // or "----work----" head and sometimes straight under the line it ran on ("---hold night-6:00am--- / crew /
  // Dilip press material / VAT A 2 / 3301-600 nos"): a line with a quantity under a slot is that slot's production
  // either way, and a client named on a line of its own is the client of the lines under it.
  var from = null, to = null, hint = null, inProd = false, group = null, pending = null;
  rr.lines.forEach(function(ln) {
    if (ln.role !== 'note') pending = null;
    if (ln.role === 'head') {
      // A second day's heading inside the roll ("22/09/26/ Sunday", read by the relay as a new day): the work under it
      // is that day's. It was dated the roll's first day.
      var dd = ln.raw.replace(/^[\s\-_=*.•]+/, '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (dd && isoFromDmy(dd[1], dd[2], dd[3])) {
        prodPowerEnd(power, date, items);
        date = isoFromDmy(dd[1], dd[2], dd[3]); from = null; to = null; hint = null; inProd = false; group = null;
        return;
      }
      if (ln.read === 'Production notes') {
        inProd = true; group = null;
        var pa = relayHeaderAreas(ln.raw).filter(function(a) { return PROD_LINES.indexOf(a) >= 0; });
        if (pa.length) hint = pa[0];
        return;
      }
      if (/^Slot from|^Out at/.test(ln.read)) {
        var tt = relayTimes(ln.raw);
        from = null; to = null;
        // An out-time roll's head is when the slot ended; an in-time roll's, when it began.
        if (tt.length) { if (/^Out at/.test(ln.read)) to = tt[tt.length - 1].min; else { from = tt[0].min; to = tt.length > 1 ? tt[1].min : null; } }
        hint = null; inProd = false; group = null;
        return;
      }
      var areas = relayHeaderAreas(ln.raw).filter(function(a) { return PROD_LINES.indexOf(a) >= 0; });
      hint = areas.length ? areas[0] : null; inProd = false;
      return;
    }
    if (ln.role !== 'note') return;
    var line = ln.raw.trim();
    if (prodIsPowerLine(line)) { prodPowerStep(power, line, ln.raw, ln.n, date, null, items, notes); return; }
    if (/no\s*work/i.test(line)) { notes.push({ n: ln.n, raw: ln.raw, text: 'No work in this block' }); return; }
    var it = prodReadItem(line, ctx.clients);
    // "Dilip press material", "Mehta ka maal": the client of the lines below.
    if (it.clientId != null && it.qty == null && (!it.part || /^(material|maal|mal|ka\s*maal|others?|work|ka)$/i.test(it.part.trim()))) {
      group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow };
      return;
    }
    // "MEHTA CLAMP / 1360 NOS": the figure on the line below the part it counts.
    if (it.qty != null && !it.part && it.clientId == null && pending) {
      var joined = prodReadItem(pending.raw.trim() + ' ' + line, ctx.clients);
      if (joined.qty != null) {
        if (pending.rec) items.splice(items.indexOf(pending.rec), 1);   // the part line, saved empty inside a block, is this one
        it = joined; it.rawJoined = pending.raw + '\n' + ln.raw; pending = null;
      }
    }
    if (it.qty == null) {
      if (it.part || it.clientId != null) pending = { raw: ln.raw, n: ln.n };
      if (!(inProd && (it.part || it.clientId != null))) { notes.push({ n: ln.n, raw: ln.raw, text: 'Not read as production' }); return; }
    } else pending = null;
    var rec = prodItemRecord(it, it.clientId == null ? group : null, it.rawJoined || ln.raw, ln.n, date, !rr.date && !msg.sentOn);
    rec.kind = 'plated'; rec.slot = 'ot'; rec.basis = 'relay'; rec.line = null; rec.lineHint = hint;
    rec.time = prodHhmm(from); rec.to = prodHhmm(to);
    rec.issues.push(hint ? { tone: 'amber', code: 'linehint', text: 'Line read from the header above: ' + PROD_LINE_LABEL[hint] + '. Confirm it.' }
      : { tone: 'amber', code: 'noline', text: 'No line written above this work. Pick the line, or leave it unknown.' });
    items.push(rec);
    if (it.qty == null && pending) pending.rec = rec;
  });
  prodPowerEnd(power, date, items);
  // The roll's own day: the same roll reposted days later is still the one roll (parseProdPaste).
  return { items: items, notes: notes, date: rollDate, noDate: !rr.date };
}

/* ---------- A paste: every message read, none dropped ---------- */
/* A load with no client written, whose part only one client has ever sent: that client, read as, never silently. */
function prodOwnerFill(items, ctx) {
  if (!ctx.partOwners) return;
  items.forEach(function(it) {
    if (it.kind === 'downtime' || it.clientId != null || it.client || !it.part) return;
    var cid = ctx.partOwners[rateKey(prodPartBase(it.part))];
    var rec = cid != null && ctx.clients && ctx.clients.list.find(function(c) { return String(c.id) === String(cid); });
    if (!rec) return;
    it.clientId = rec.id; it.clientName = rec.name;
    it.issues = it.issues.filter(function(x) { return x.code !== 'client'; });
    it.issues.push({ tone: 'amber', code: 'readas', text: 'No client written: ' + it.part + ' has only ever come from ' + rec.name + '.' });
  });
}
function parseProdPaste(text, ctx) {
  var msgs = prodSplit(text).map(function(m) {
    var r;
    if (m.kind === 'pickling' || m.kind === 'power') r = parsePickling(m, ctx);
    else if (m.kind === 'production') r = parseProductionList(m, ctx);
    else if (m.kind === 'runs') r = parseProductionRuns(m, ctx);
    else if (m.kind === 'roll') r = prodFromRoll(m, ctx);
    else r = { items: [], notes: [], date: m.sentOn || ctx.today };
    prodOwnerFill(r.items, ctx);
    m.read = r;
    m.hash = prodMsgKey(r.date, m.text);
    return m;
  });
  prodPairPower(msgs);
  return msgs;
}
/* What makes two messages the same message: the day it reports and its words. The text alone refused the pickling
   hand's "NOVA CLAMPS / CLAMP(40×6) / Pickling time 9:00AM" on every day after the first it was sent, and the load was
   lost; a repost (the supervisor sends a roll again, days later) reports the same day in the same words, and is
   still read once. The post's own time and sender are left out for that reason: they are all a repost changes. */
function prodMsgKey(day, text) { return relayHash((day || '') + '\n' + String(text || '')); }

/* A cut and its return sent as two messages ("Power cut 10:55" now, "Power in 11:15" twenty minutes later): the open
   cut takes the first return after it on its day. The return stays listed in its own message, saying which cut it
   closed. Both used to be kept apart, the cut saved as open and its return a note that went nowhere. */
function prodPairPower(msgs) {
  var open = [];
  msgs.forEach(function(m, mi) {
    (m.read.notes || []).forEach(function(nt) {
      if (!nt.powerIn || nt.powerIn.min == null) return;
      var hit = open.filter(function(c) { var at = relayParseHhmm(c.it.time); return c.it.date === nt.powerIn.date && at != null && at <= nt.powerIn.min; }).pop();
      if (!hit) return;
      open.splice(open.indexOf(hit), 1);
      var cut = hit.it;
      cut.to = prodHhmm(nt.powerIn.min); cut.downtime.open = false; cut.raw += '\n' + nt.raw;
      if (nt.powerIn.issue) cut.issues.push(nt.powerIn.issue);
      // Which cut it closed: a cut whose message is left out (saved before, or sent twice) is closed where it is stored,
      // on save (P127). It used to be closed here only, and the cut stayed open in the book.
      nt.closes = { mi: hit.mi, ii: hit.ii };
      nt.text = 'The power back: the end of the cut at ' + relayClockLabel(relayParseHhmm(cut.time)) + ' in the message above';
    });
    m.read.items.forEach(function(it, ii) { if (it.kind === 'downtime' && it.to == null) open.push({ it: it, mi: mi, ii: ii }); });
  });
}

/* ---------- The VAT register, read from a photo by Gemini ---------- */
/* The prompt asks for a TRANSCRIPTION, never a reading: times as written, customers and parts as spelt, every row
   the clerk wrote, figures exactly as written ("72+10", "98×8+1"), struck rows and figures written over marked as such.
   No client list is sent (the model would "correct" the floor's spellings to legal names), and the workers' box is not
   asked for. Converting times, adding up a figure, the START and END rules, rack arithmetic and the day's total are
   this app's, in code, where they can be tested.

   Two page shapes, both seen on the real register (photos of 24–26 Sep 2026, owner):
   - ROUNDS (VAT A1): one row per round, "9:45 AM - 72", a START row first. A START counts as a round of the next
     round's figure (the owner's rule, 26 Jun).
   - START / END (VAT A2): a run opens on a START row and its END row carries the run's whole figure ("98×8+1"); an
     END with no START of its own starts where the one before ended. A START here is only the run's start: counting it
     as a round, as the first build did, doubled every A2 run.
   The register also keeps a POWER LOG ("25/09/26 Power cut - 10:26 AM / Power in - 10:36 AM"), read as power cuts. A
   photo of anything else (the weekly hours sheet) is said so and nothing is read. */
var PROD_REGISTER_PROMPT_VER = 'reg-v2';
var PROD_REGISTER_PROMPT = 'This is a photo of one page from the handwritten registers of a zinc electroplating plant in India.\n\n' +
  'TRANSCRIBE the page exactly as written. Do not correct spellings, do not convert times, do not add up figures, do not add rows that are not written, do not invent anything.\n' +
  '- page: "production" if it lists batches plated (customer, part, times, figures); "power" if it is a log of power cuts and power coming back; "challan" if it is a customer\'s printed delivery challan; "other" for anything else (a wages or hours sheet, a list of names).\n' +
  '- date: the date written at the top, exactly as written (e.g. "24/09/26"), or null. weekday: the day name written at the top (e.g. "Thursday"), or null.\n' +
  '- line: the line named at the top exactly as written (e.g. "VAT-A1", "VAT-A2", "BARREL"), or null.\n' +
  '- dayTotal: a day total written on the page, else null.\n' +
  '- rows: one per written row, top to bottom, skipping rows with nothing written but ditto marks. For each: time exactly as written without START or END (e.g. "9:45 AM", "3:00 PM"); ' +
  'mark: "START" or "END" if the row says so, else null; customer and part as written (when a column holds only ditto marks, leave it null and set ditto true); dim (a size such as "35x6") if written; ' +
  'qtyText: the figure written for the row, exactly as written with its signs (e.g. "72", "72+10", "98×8+1", "50+52+30", "3+4×156"), else null; when the only figure on the row is written in the part column (e.g. "(25 NOS) TINA"), put it in qtyText too; struck: true if the row or its figure is struck through; ' +
  'over: what a correction was written over, as written; bracket: true if the row is inside a bracket carrying one total for several rows; legible: false if you cannot read the figure.\n' +
  '- On a power page, each row: date as written on the row, event "power cut" or "power in" (also "power on"), and time as written.\n' +
  'Ignore any box of workers\' names. Return only the JSON.';
var PROD_REGISTER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    page: { type: 'STRING', nullable: true },
    date: { type: 'STRING', nullable: true },
    weekday: { type: 'STRING', nullable: true },
    line: { type: 'STRING', nullable: true },
    dayTotal: { type: 'NUMBER', nullable: true },
    rows: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      time: { type: 'STRING', nullable: true }, mark: { type: 'STRING', nullable: true }, customer: { type: 'STRING', nullable: true }, part: { type: 'STRING', nullable: true },
      dim: { type: 'STRING', nullable: true }, qtyText: { type: 'STRING', nullable: true }, struck: { type: 'BOOLEAN', nullable: true }, over: { type: 'STRING', nullable: true },
      bracket: { type: 'BOOLEAN', nullable: true }, ditto: { type: 'BOOLEAN', nullable: true }, legible: { type: 'BOOLEAN', nullable: true },
      event: { type: 'STRING', nullable: true }, date: { type: 'STRING', nullable: true } } } }
  },
  required: ['rows']
};

/* A register time: the shift runs 8:30 to 5, so a bare 1–6 is the afternoon and 7–12 as written. */
function prodRegisterTime(s) {
  var m = /(\d{1,2})\s*(?:[:.;]\s*(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/i.exec(String(s || ''));
  if (!m || (m[2] == null && !m[3])) return null;
  var h = +m[1], mm = m[2] != null ? +m[2] : 0, ap = (m[3] || '').toLowerCase();
  if (h > 23 || mm > 59) return null;
  if (/p/.test(ap)) h = h % 12 + 12; else if (/a/.test(ap)) h = h % 12; else if (h >= 1 && h <= 6) h += 12;
  return h * 60 + mm;
}
/* "12:45 AM" between 11:30 AM and 1:05 PM, "Power cut 12:05 AM" with power back at 1 PM: the register is kept in the
   day, so twelve-something AM is noon, and said so. */
function prodRegisterNoonSlip(s) { return /\b12\s*[:.;]\s*\d{2}\s*a\.?\s?m/i.test(String(s || '')); }
function prodRegisterNoon(s) { var m = prodRegisterTime(s); return m != null && prodRegisterNoonSlip(s) ? m + 720 : m; }
function prodRegisterDate(s) {
  var m = /(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{2,4})/.exec(String(s || ''));
  return m ? isoFromDmy(m[1], m[2], m[3]) : null;
}
/* A figure as the clerk writes it: "72", "72+10", "98×8+1", "8x156+68", "50+52+30", "4×108−3". Sums of products, added
   up here. The first product's larger factor is the rack and the smaller the rounds ("98×8": 8 rounds of 98), which is
   what rack sizes are learnt from; a plain sum carries no rack. Anything else is null: unread, never guessed. */
/* "MEHTA+GENERAL", "(0106+3313)+188CD", "39+50": split on a + outside brackets. */
function prodSplitTop(s) {
  var out = [], d = 0, cur = '';
  String(s == null ? '' : s).split('').forEach(function(ch) {
    if (ch === '(') d++; else if (ch === ')') d = Math.max(0, d - 1);
    if (ch === '+' && !d) { out.push(cur.trim()); cur = ''; } else cur += ch;
  });
  out.push(cur.trim());
  return out;
}
function prodIsDitto(s) { return /^[\s"'`\u201C\u201D\u2018\u2019\u3003,.]*$/.test(String(s == null ? '' : s)); }
function prodRegisterQty(text) {
  var t = String(text == null ? '' : text).replace(/[×✕*X]/g, 'x').replace(/[–—−]/g, '-').replace(/\s+/g, '').replace(/,/g, '').replace(/^\+/, '');
  t = t.replace(/(nos|pcs|pc)\.?$/i, '').replace(/^\((\d+)\)$/, '$1');
  // "3+4×156": racks counted in two goes, then the rack. The clerk's arithmetic is (3 + 4) × 156, not 3 + 624; read
  // it that way and say so, with the other reading beside it. What follows the rack keeps its own sign: "3+4×156−3"
  // is 3 short of seven racks (the tail used to be read without its leading minus, and the figure left unread).
  var g = /^((?:\d+\+)+\d+)x(\d+(?:\.\d+)?)((?:[+-][\d.x]+)*)$/i.exec(t);
  if (g && g[1].split('+').every(function(v) { return +v <= 20; })) {
    var racks = g[1].split('+').reduce(function(a, v) { return a + +v; }, 0), rest = g[3] ? prodRegisterQty('0' + g[3]) : null;
    if (g[3] && !rest) return null;
    var tail = rest ? rest.qty : 0;
    return { qty: racks * +g[2] + tail, rackSize: +g[2], rounds: racks, working: true, grouped: true,
      arithmetic: g[1].split('+').slice(0, -1).reduce(function(a, v) { return a + +v; }, 0) + +g[1].split('+').pop() * +g[2] + tail };
  }
  if (!/^\d+(\.\d+)?(x\d+(\.\d+)?)*([+-]\d+(\.\d+)?(x\d+(\.\d+)?)*)*$/i.test(t)) return null;
  var total = 0, first = null;
  t.replace(/([+-]?)([\d.x]+)/gi, function(all, sign, term) {
    var f = term.split(/x/i).map(Number), v = f.reduce(function(a, b) { return a * b; }, 1);
    if (first == null) first = f;
    total += sign === '-' ? -v : v;
    return all;
  });
  var out = { qty: total };
  if (first && first.length === 2) { out.rackSize = Math.max(first[0], first[1]); out.rounds = Math.min(first[0], first[1]); }
  if (/[+-]/.test(t.replace(/^[\d.x]+/i, '')) || (first && first.length > 1)) out.working = true;
  return out;
}
var PROD_LINE_OF_READ = { 'VAT A1': 'vat-a1', 'VATA1': 'vat-a1', 'A1': 'vat-a1', 'VAT A2': 'vat-a2', 'VATA2': 'vat-a2', 'A2': 'vat-a2', BARREL: 'barrel' };
var PROD_WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/* The read → runs of one part (consecutive rows of one customer and part), each a plated entry with its rounds, and
   the power log's cuts. Nothing is decided that the owner has not seen: a struck row is red until counted or cancelled;
   the START rule, rack × rounds against the figure written, the rows against the day's total and the day name against
   the date are checked and a disagreement said. */
function prodFromRegisterRead(json, ctx, photoDate, choices) {
  choices = choices || {};
  var out = { date: null, line: null, dayTotal: null, runs: [], issues: [], rows: [], downtime: [], page: 'production', style: 'rounds' };
  if (!json || !Array.isArray(json.rows)) { out.issues.push({ tone: 'red', code: 'rows', text: 'Gemini did not return any rows for this photo.' }); return out; }
  var pg = String(json.page || '').toLowerCase();
  var events = json.rows.filter(function(r) { return r && r.event; }).length;
  out.page = /challan/.test(pg) ? 'challan' : /other/.test(pg) ? 'other' : /power/.test(pg) || (events && events === json.rows.filter(Boolean).length) ? 'power' : 'production';
  out.date = prodRegisterDate(json.date) || null;
  if (out.page === 'challan') {
    out.issues.push({ tone: 'red', code: 'challan', text: 'This photo is a customer\u2019s challan, not a page of the register. Read it in Challans instead.' });
    out.fp = 'challan';
    return out;
  }
  if (out.page === 'other') {
    out.issues.push({ tone: 'red', code: 'page', text: 'This photo is not a page of the production register or its power log (a wages or hours sheet, perhaps). Nothing is read from it.' });
    out.fp = 'other';
    return out;
  }
  if (!out.date && out.page === 'power') {
    var rowDate = json.rows.map(function(r) { return r && prodRegisterDate(r.date); }).filter(Boolean)[0];
    if (rowDate) out.date = rowDate;
  }
  if (!out.date) { out.date = photoDate || ctx.today; out.issues.push({ tone: 'amber', code: 'date', text: 'No date read on the page: taken as ' + out.date + '. Check it.' }); }
  else if (photoDate && Math.abs(isoDaysBetween(out.date, photoDate)) > 4) out.issues.push({ tone: 'amber', code: 'date', text: 'The page reads ' + out.date + ', ' + Math.abs(isoDaysBetween(out.date, photoDate)) + ' days from when the photo was taken. Check the date (day and month can swap).' });
  // The date the owner set on the check is the page's, and a power log's rows read on the page's date move with it
  // (prodRegisterPower). The power log's cuts were saved on the date read, whatever the check said.
  if (choices.date) {
    if (choices.date !== out.date) { out.readDate = out.date; out.date = choices.date; }
    out.issues = out.issues.filter(function(x) { return x.code !== 'date'; });
  }
  // The day name the clerk writes beside the date is a second reading of it.
  var wd = String(json.weekday || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  if (wd && PROD_WEEKDAYS.indexOf(wd) >= 0) {
    var actual = PROD_WEEKDAYS[new Date(out.date + 'T00:00:00').getDay()];
    if (actual !== wd) out.issues.push({ tone: 'amber', code: 'weekday', text: 'The page says ' + json.weekday + ', but ' + out.date + ' is a ' + new Date(out.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' }) + '. Check the date.' });
  }
  if (out.page === 'power') return prodRegisterPower(json, out);
  var ln = String(json.line || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // "VAT-A2", "VAT A 2", and the clerk's shorter "VAT-2" on 16 Sep.
  var readLine = ln ? (PROD_LINE_OF_READ[ln] || (/A1|VAT1$/.test(ln) ? 'vat-a1' : /A2|VAT2$/.test(ln) ? 'vat-a2' : /BAR|BER/.test(ln) ? 'barrel' : null)) : null;
  // The line picked on the check is the page's (P127): the part rules, the whose-round check and a code's round are read on
  // the line the page ran on. The line as read is kept apart, for the photo's fingerprint and to say a line was set.
  out.readLine = readLine;
  out.line = choices.line !== undefined ? (choices.line || null) : readLine;
  if (!out.line) out.issues.push({ tone: 'amber', code: 'line', text: 'The page does not name its line. Pick it below.' });
  out.dayTotal = json.dayTotal != null && isFinite(json.dayTotal) ? +json.dayTotal : null;
  var markOf = function(r) { var m = String(r.mark || '').toUpperCase(); return /END/.test(m) || /\bend\b/i.test(r.time || '') ? 'END' : /START/.test(m) || r.start || /start/i.test(r.time || '') ? 'START' : ''; };
  out.style = json.rows.some(function(r) { return r && markOf(r) === 'END'; }) ? 'startend' : 'rounds';
  // The round a START begins is the next one written: its size is the START's (the START rule's own reading).
  var nextRack = function(k) {
    for (var j = k + 1; j < json.rows.length; j++) {
      var nr = json.rows[j] || {};
      if (markOf(nr) === 'START') continue;
      var nq = nr.qtyText != null && String(nr.qtyText).trim() !== '' ? prodRegisterQty(String(nr.qtyText).trim()) : null;
      if (nq) return nq.rackSize || nq.qty;
      if (nr.qty != null && isFinite(nr.qty)) return +nr.qty;
    }
    return null;
  };
  var lastCust = '', lastPart = '', lastDim = '';
  json.rows.forEach(function(r0, i) {
    var r = r0 || {};
    var mark = markOf(r), written = r.qtyText != null && String(r.qtyText).trim() !== '' ? String(r.qtyText).trim() : null;
    // A row with nothing on it but ditto marks (the clerk's next line, begun and not used) is not a row.
    if (!r.time && !mark && written == null && r.qty == null && !r.customer && !r.part && !r.struck) return;
    var cust = (r.customer || '').trim(), part = (r.part || '').trim(), dim = String(r.dim || '').trim(), carried = false;
    // A ditto row carries the size above it too, so it stays in its run now that a run is one gauge.
    var ditto = r.ditto || (!cust && !part);
    if (ditto) { cust = cust || lastCust; part = part || lastPart; dim = dim || lastDim; }
    // A new part under ditto marks in the customer column is the same customer's (the clerk writes LINER under MEHTA's
    // ditto): it was read as no customer written, and asked for one on every change of part.
    else if (!cust && lastCust) { cust = lastCust; carried = true; }
    // A round shared by two clients is written with + in each column ("MEHTA+GENERAL / LINER+188CD / 39+50"), and a ditto
    // under one side of it carries that side ("〃 + DORABJI" under MEHTA+GENERAL is MEHTA and DORABJI).
    var tokenFill = function(now, last) {
      var t = prodSplitTop(now);
      if (t.length < 2) return t.length === 1 && prodIsDitto(t[0]) && now ? last : now;
      var l = prodSplitTop(last);
      return t.map(function(x, j) { return prodIsDitto(x) ? (l.length === t.length ? l[j] : l.length === 1 ? l[0] : l[j] || '') : x; }).join('+');
    };
    if (/\+/.test(cust) || (cust && prodIsDitto(cust))) cust = tokenFill(cust, lastCust);
    if (/\+/.test(part) || (part && prodIsDitto(part))) part = tokenFill(part, lastPart);
    lastCust = cust || lastCust; lastPart = part || lastPart; if (!ditto || dim) lastDim = dim;
    var row = { i: i, time: String(r.time || '').replace(/\s*-?\s*(start|end)\s*$/i, ''), min: prodRegisterNoon(r.time), cust: cust, part: part, dim: dim,
      mark: mark, start: mark === 'START', end: mark === 'END', rackSize: r.rackSize, rounds: r.rounds, short: r.short,
      qty: null, written: written, struck: !!r.struck, over: r.over || '', bracket: !!r.bracket, legible: r.legible !== false, issues: [] };
    if (written != null) {
      var q = prodRegisterQty(written);
      if (q) {
        row.qty = q.qty; if (q.working) row.qtySrc = 'working'; if (q.rackSize) { row.rackSize = row.rackSize || q.rackSize; row.rounds = row.rounds || q.rounds; }
        if (q.grouped) row.issues.push({ tone: 'info', code: 'grouped', text: '"' + written + '" read as ' + q.rounds + ' racks of ' + q.rackSize + ' = ' + q.qty + ' (racks counted in two goes, the owner\u2019s reading of 28 Sep 2026). Plain arithmetic would give ' + q.arithmetic + '.' });
      }
      else { row.legible = false; row.issues.push({ tone: 'amber', code: 'figure', text: '"' + written + '" could not be added up. Enter the figure by hand if it matters.' }); }
    } else if (r.qty != null && isFinite(r.qty)) row.qty = +r.qty;
    if (row.rackSize && row.rounds && written == null) {
      var calc = row.rackSize * row.rounds - (row.short || 0);
      if (row.qty == null) { row.qty = calc; row.qtySrc = 'working'; }
      else if (Math.abs(calc - row.qty) > 0.5) row.issues.push({ tone: 'amber', code: 'rack', text: row.rackSize + ' × ' + row.rounds + (row.short ? ' − ' + row.short : '') + ' = ' + calc + ', but ' + row.qty + ' is written. The written figure is used.' });
    }
    // A new part carried onto the customer above it, of a kind that customer has never sent (the clerk's labels a row out,
    // a CLAMP under SAMARTH's ditto): the customer whose rule covers that kind at this round, where exactly one does.
    if (carried && ctx.carryCheck) {
      var cit = prodReadItem(cust, ctx.clients), crack = row.rackSize || row.qty || (row.start ? nextRack(i) : null);
      var cc = cit.clientId != null ? ctx.carryCheck(cit.clientId, part, crack) : null;
      if (cc) {
        var who = cit.clientName || cust;
        if (cc.clientId != null) {
          row.issues.push({ tone: 'amber', code: 'carried', text: 'Written under ' + who + '’s ditto, but ' + who + ' has never sent a ' + cc.family + '; a round of ' + crack + ' is ' + cc.name + '’s by the owner’s rule, so read as ' + cc.name + '. Check the page.' });
          row.cust = cust = cc.name; lastCust = cc.name;
        } else row.issues.push({ tone: 'amber', code: 'carried', text: 'Written under ' + who + '’s ditto, but ' + who + ' has never sent a ' + cc.family + '. Check whose it is.' });
      }
    }
    row.raw = [row.time, cust, part, row.dim, written != null ? written : row.rackSize && row.rounds ? row.rackSize + '×' + row.rounds + (row.short ? '−' + row.short : '') : '',
      written == null && row.qty != null ? String(row.qty) : '', mark, row.struck ? '(struck)' : '', row.over ? '(over ' + row.over + ')' : ''].filter(Boolean).join(' · ');
    // A START row carries no figure on either shape; a batch row with none is checked against the photo.
    if ((!row.legible && !row.issues.length) || (row.qty == null && !row.start && !row.bracket && row.legible)) row.issues.push({ tone: 'amber', code: 'illegible', text: 'No figure read for this row. Check it against the photo.' });
    if (row.struck) {
      var pick = choices['struck' + i];
      if (!pick) row.issues.push({ tone: 'red', code: 'struck', text: 'Struck through on the register. Counted or cancelled?' });
      row.counted = pick === 'counted';
    } else row.counted = true;
    if (row.over) row.issues.push({ tone: 'info', code: 'over', text: 'Written over ' + row.over + '; ' + (row.qty != null ? row.qty : 'what is written now') + ' is used.' });
    if (prodRegisterNoonSlip(r.time)) row.issues.push({ tone: 'amber', code: 'meridiem', text: r.time + ' read as ' + relayClockLabel(row.min) + ': the register runs in the day.' });
    // Two clients in one round (owner, 30 Sep 2026: "sometimes two clients are done simultaneously"): each client's share
    // is a round of its own at the same time, in its own run. The figure splits on its + into as many shares as there are
    // clients or parts; a figure that does not is asked about and the row kept whole.
    var cT = prodSplitTop(cust), pT = prodSplitTop(part), nShare = Math.max(cT.length, pT.length);
    if (nShare > 1 && (cT.length === 1 || pT.length === 1 || cT.length === pT.length)) {
      var fT = written != null ? prodSplitTop(written) : null;
      if (fT && fT.length !== nShare) {
        row.issues.push({ tone: 'amber', code: 'shared', text: 'One round for ' + nShare + ' (' + cust + ' · ' + part + '), but "' + written + '" does not split into ' + nShare + ' figures. Enter each share by hand.' });
        out.rows.push(row);
        return;
      }
      var shares = [];
      for (var j = 0; j < nShare; j++) {
        var sub = {};
        Object.keys(row).forEach(function(k) { sub[k] = row[k]; });
        sub.cust = cT.length > 1 ? cT[j] : cT[0]; sub.part = pT.length > 1 ? pT[j] : pT[0]; sub.shared = i; sub.issues = j ? [] : row.issues.slice();
        if (fT) {
          var sq = prodRegisterQty(fT[j]);
          sub.written = fT[j]; sub.qty = sq ? sq.qty : null; sub.rackSize = sq && sq.rackSize ? sq.rackSize : null; sub.rounds = sq && sq.rounds ? sq.rounds : null;
          sub.qtySrc = null;
        }
        shares.push(sub);
      }
      shares[0].issues.push({ tone: 'info', code: 'shared', text: 'One round for ' + nShare + ': ' + shares.map(function(x) { return x.cust + ' ' + x.part + (x.qty != null ? ' ' + x.qty : ''); }).join(', ') + '. Each is counted in its own run.' });
      shares.forEach(function(x) { out.rows.push(x); });
      return;
    }
    out.rows.push(row);
  });
  if (out.style === 'rounds') {
    // START counts as a batch of the next round's figure.
    out.rows.forEach(function(row, k) {
      if (!row.start || row.qty != null) return;
      // A shared START takes the next figure of its own client and part.
      var nx = out.rows.slice(k + 1).find(function(x) { return x.qty != null && !x.start && (row.shared == null || (relayKey(x.cust) === relayKey(row.cust) && rateKey(x.part) === rateKey(row.part))); });
      if (nx) { row.qty = nx.qty; row.qtySrc = 'start-rule'; row.issues.push({ tone: 'info', code: 'start', text: 'START counted as a round of ' + nx.qty + ', the next round’s figure (the owner’s rule, 26 Jun).' }); }
    });
  } else {
    // START / END: the END carries the run's figure; a START is where it began and is never a round of its own.
    out.rows.forEach(function(row, k) {
      if (row.start) { row.qty = null; return; }
      if (row.end) row.batch = true;
      if (row.end && !out.rows.slice(0, k).some(function(x) { return x.start && x.cust === row.cust && x.part === row.part; }))
        row.issues.push({ tone: 'info', code: 'nostart', text: 'An END with no START of its own: taken as starting where the batch before it ended.' });
    });
  }
  // A part the register writes with no gauge takes the gauges its rack size means, by the owner's rule (prodGaugeRuleFor):
  // one gauge is written in as if the clerk had; two or three are kept as the choices, and the run says so.
  if (ctx.gaugeRule) {
    out.rows.forEach(function(row) {
      if (row.start || lineGauge(String(row.part + ' ' + row.dim).replace(/[×✕]/g, 'X'))) return;
      var rack = row.rackSize || (!row.batch && row.qty > 0 ? row.qty : null);
      var it = prodReadItem(row.cust, ctx.clients);
      var gs = it.clientId != null ? ctx.gaugeRule(it.clientId, row.part, rack) : null;
      // A round of a size no rule names, on a part a rule covers (the 108s, the 98s), is kept apart as gauge unknown: it
      // must not join a run whose gauge a rule read and take that gauge.
      if (!gs) { if (rack && it.clientId != null && ctx.gaugeHas && ctx.gaugeHas(it.clientId, row.part)) { row.gaugeSet = 'none'; row.gaugeRack = rack; } return; }
      if (gs.length === 1) row.dim = gs[0];
      else row.gaugeSet = gs.join('/');
      row.gaugeRack = rack;
    });
  }
  // A round whose size, on its line, names one of the client's parts by the owner's rule (prodPartRuleRead): Samarth's
  // cover plates and connector, all written TINA. A row of no size of its own (a START on a START/END page) continues.
  if (ctx.partRule) {
    out.rows.forEach(function(row) {
      var rack = row.rackSize || (!row.batch && row.qty > 0 ? row.qty : null);
      var it = rack ? prodReadItem(row.cust, ctx.clients) : null;
      var pr = it && it.clientId != null ? ctx.partRule(it.clientId, rack, out.line, row.part) : null;
      // A round whose gauge no rule of its own client reads, of a size another client's part is on this line: asked.
      if (!pr && row.gaugeSet === 'none' && ctx.partRuleOther) {
        var o = ctx.partRuleOther(it.clientId, rack, out.line);
        if (o) row.issues.push({ tone: 'amber', code: 'whose', text: 'A round of ' + rack + ' on ' + (typeof prodLineName === 'function' ? prodLineName(out.line) : out.line) + ' is ' + o.name + '’s ' + (o.partName || o.partNumber) + ' by the owner’s rule, not a size ' + (it.clientName || row.cust) + '’s rules name. Check whose round it is.' });
      }
      if (!pr) return;
      row.partRack = rack; row.partRule = pr;
      if (pr.partNumber) row.rulePn = pr.partNumber;
    });
  }
  // Runs: consecutive rows of one customer, part and gauge. Two gauges of one clamp are two parts at two rates, and the
  // gauge used to be taken out of the key, so a 35X6 run following a 40X6 one was added into it under the 40X6. A row
  // with no gauge of its own continues the run above it.
  // Rounds shared by two clients interleave their runs: a shared round, and the first round after them, continue the run
  // of their own client and part rather than the row above.
  // A run is also split at the shift's edges (8:30 AM, 5 PM), each round on the side it fell: the register's evening rounds
  // are overtime, and counted in the general shift they stood beside the relay's figure for the same block (P127). A row
  // with no figure (a START on a START / END page) takes the side of the rounds beside it.
  var sideOf = function(row) { return row.min == null || (row.qty == null && row.written == null) ? '' : row.min < RELAY_GENERAL ? 'am' : row.min >= RELAY_GENERAL_OUT ? 'pm' : 'gen'; };
  var cur = null, open = {}, inShared = false;
  out.rows.forEach(function(row) {
    var pd = row.part + ' ' + row.dim, ck = relayKey(row.cust) + '|' + rateKey(prodPartBase(pd)), g = lineGauge(pd.replace(/[×✕]/g, 'X'));
    var gs = row.gaugeSet || '', rp = row.rulePn || '', sd = sideOf(row);
    var run = row.shared != null || inShared ? open[ck] || null : cur;
    if (!run || run.ck !== ck || (g && run.g && g !== run.g) || (gs && run.gs && gs !== run.gs) || (gs && run.g) || (g && run.gs) || (rp && run.rp && rp !== run.rp) || (sd && run.sd && sd !== run.sd)) { run = { ck: ck, g: g, gs: gs, rp: rp, sd: sd, rows: [] }; out.runs.push(run); }
    else { if (g && !run.g) run.g = g; if (gs && !run.gs) run.gs = gs; if (rp && !run.rp) run.rp = rp; if (sd && !run.sd) run.sd = sd; }
    run.rows.push(row);
    if (row.shared != null) { open[ck] = run; inShared = true; }
    else { open = {}; open[ck] = run; inShared = false; }
    cur = run;
  });
  out.runs = out.runs.map(function(run) {
    var first = run.rows[0], it = prodReadItem(first.cust, ctx.clients), dimText = first.dim || run.g;
    var partText = (first.part + (dimText && !lineGauge(first.part.replace(/[×✕]/g, 'X')) ? ' (' + dimText + ')' : '')).trim();
    var counted = run.rows.filter(function(x) { return x.counted && x.qty != null; });
    var qty = counted.reduce(function(s, x) { return s + x.qty; }, 0);
    // A struck row cancelled does not stretch the run's hours (one not yet answered still does).
    var timed = run.rows.filter(function(x) { return !(x.struck && choices['struck' + x.i] === 'cancelled'); });
    var mins = (timed.length ? timed : run.rows).map(function(x) { return x.min; }).filter(function(x) { return x != null; });
    var e = { kind: 'plated', date: out.date, time: prodHhmm(mins.length ? Math.min.apply(null, mins) : null), to: prodHhmm(mins.length ? Math.max.apply(null, mins) : null),
      line: out.line, lineSrc: out.line ? (out.line === readLine ? 'written' : 'set') : null, client: first.cust, clientId: it.clientId != null ? it.clientId : null, clientName: it.clientName || '',
      part: partText, gauge: lineGauge(partText.replace(/[×✕]/g, 'X')), qty: counted.length ? qty : null, unit: 'NOS', basis: 'register', src: 'photo',
      rounds: run.rows.filter(function(x) { return !(out.style === 'startend' && x.start); }).map(function(x) {
        var o = { time: x.time || null, qty: x.qty };
        if (x.start) o.start = true; if (x.batch) o.batch = true; if (x.written != null) o.written = x.written;
        if (x.rackSize && x.rounds) { o.rack = x.rackSize; o.n = x.rounds; }
        if (x.struck) o.struck = !x.counted; if (x.over) o.over = x.over; return o; }),
      raw: run.rows.map(function(x) { return x.raw; }).join('\n'), n: first.i + 1, issues: [], rows: run.rows };
    e.slot = run.sd ? (run.sd === 'gen' ? 'general' : 'ot') : e.time && (relayParseHhmm(e.time) < RELAY_GENERAL || relayParseHhmm(e.time) >= RELAY_GENERAL_OUT) ? 'ot' : 'general';
    var racked = run.rows.find(function(x) { return x.gaugeRack; });
    if (run.gs === 'none') { e.gaugeUnknown = racked.gaugeRack; e.issues.push({ tone: 'amber', code: 'gauge', text: 'Gauge unknown: a round of ' + racked.gaugeRack + ' is in none of the owner’s rules for this part. Flagged on the entry until its gauge is picked.' }); }
    else if (run.gs) { e.gaugeOptions = run.gs.split('/'); e.gaugeSrc = 'rack'; e.issues.push({ tone: 'info', code: 'gauge', text: 'Gauge read from the round of ' + racked.gaugeRack + ': ' + run.gs.replace(/\//g, ' or ') + ' (the owner’s rule). The challans say which.' }); }
    else if (racked && e.gauge) { e.gaugeSrc = 'rack'; e.issues.push({ tone: 'info', code: 'gauge', text: 'Gauge ' + e.gauge + ' read from the round of ' + racked.gaugeRack + ' (the owner’s rule).' }); }
    var ruled = run.rows.find(function(x) { return x.partRule; });
    if (ruled) {
      var pr = ruled.partRule, where = ' a round of ' + ruled.partRack + ' on ' + (typeof prodLineName === 'function' ? prodLineName(out.line) : out.line);
      if (pr.partNumber) {
        e.partNumber = pr.partNumber; e.partSrc = 'rack'; e.partRack = ruled.partRack;
        e.issues.push(pr.written
          ? { tone: 'amber', code: 'part', text: 'The page writes ' + pr.written + ';' + where + ' is ' + pr.partNumber + (pr.name ? ' (' + pr.name + ')' : '') + ' by the owner’s rule. Read by the rule: check the page.' }
          : { tone: 'info', code: 'part', text: 'Read as ' + pr.partNumber + (pr.name ? ' (' + pr.name + ')' : '') + ':' + where + ' is that part (the owner’s rule).' });
      } else e.issues.push({ tone: 'amber', code: 'part', text: where.trim().replace(/^a/, 'A') + ' is ' + pr.rulePn + ' by the owner’s rule, but the page writes ' + pr.written + ': kept as written.' });
    }
    if (e.clientId == null) e.issues.push({ tone: 'red', code: 'client', text: first.cust ? '"' + first.cust + '" is not a client in the book. Pick the client, or keep it as written.' : 'No customer written. Pick the client.' });
    else if (it.clientHow === 'read-as') e.issues.push({ tone: 'amber', code: 'readas', text: '"' + first.cust + '" read as ' + it.clientName + '.' });
    // A code two of the client's parts end in, or a group of codes in one figure ("(0106+3313)"): matched with the client's
    // recent challans, then with the rounds each part has been plated at (owner, 30 Sep 2026).
    if (!e.partNumber && e.clientId != null && ctx.resolvePart) {
      var rack = Math.max.apply(null, [0].concat(run.rows.map(function(x) { return x.rackSize || (!x.batch && x.qty > 0 ? x.qty : 0); })));
      var rs = ctx.resolvePart(e, rack || null);
      if (rs && rs.partNumber) { e.partNumber = rs.partNumber; e.partSrc = rs.how; e.issues.push({ tone: 'info', code: 'part', text: 'Read as ' + rs.partNumber + ': ' + rs.why + '.' }); }
      else if (rs && rs.split) { e.split = rs.split; e.splitBy = rs.by; }
      else if (rs && rs.why) e.issues.push({ tone: 'amber', code: 'part', text: rs.why });
    }
    return e;
  });
  // A figure covering two parts is shared between them by their open challans: an estimate, and said so.
  out.runs = [].concat.apply([], out.runs.map(function(e) {
    if (!e.split) return [e];
    var parts = e.split, sum = parts.reduce(function(a, x) { return a + x.open; }, 0), left = e.qty || 0;
    var by = e.splitBy || 'the challans';
    delete e.split; delete e.splitBy;
    var text = (e.qty || 0) + ' of ' + e.part + ' shared by ' + by + ': ';
    var shares = parts.map(function(x, j) {
      var q = j === parts.length - 1 ? left : Math.round((e.qty || 0) * x.open / sum);
      left -= q;
      return q;
    });
    text += parts.map(function(x, j) { return shares[j] + ' of ' + x.partNumber; }).join(', ') + ' (an estimate).';
    return parts.map(function(x, j) {
      var o = {};
      Object.keys(e).forEach(function(k) { o[k] = e[k]; });
      o.partNumber = x.partNumber; o.partSrc = 'challan'; o.qty = shares[j]; o.qtySrc = 'split';
      o.rounds = (e.rounds || []).map(function(r) { var c = {}; Object.keys(r).forEach(function(k) { c[k] = r[k]; }); if (c.qty != null && e.qty) c.qty = Math.round(c.qty * shares[j] / e.qty); return c; });
      o.issues = e.issues.concat([{ tone: 'info', code: 'part', text: text }]);
      return o;
    });
  }));
  var counted = out.rows.filter(function(x) { return x.counted && x.qty != null; }).reduce(function(s, x) { return s + x.qty; }, 0);
  out.counted = counted;
  if (out.dayTotal != null && Math.abs(out.dayTotal - counted) > 0.5) out.issues.push({ tone: 'amber', code: 'total', text: 'The page’s day total is ' + out.dayTotal + '; the rows counted add to ' + counted + '. A row may be missed or misread.' });
  out.fp = out.date + '|' + (readLine || '-') + '|' + out.rows.map(function(x) { return (x.time || '') + ':' + (x.qty == null ? '' : x.qty); }).sort().join(',');
  return out;
}

/* The power log: each "power cut" paired with the next "power in" on its day. A cut with nothing after it is open;
   a "power in" with no cut before it is said, not invented into a cut. */
function prodRegisterPower(json, out) {
  var byDay = {};
  json.rows.forEach(function(r, i) {
    if (!r || !r.event) return;
    var rd = prodRegisterDate(r.date), d = !rd || rd === out.readDate ? out.date : rd, cut = /cut|off|gone/i.test(r.event), min = prodRegisterNoon(r.time);
    if (prodRegisterNoonSlip(r.time)) out.issues.push({ tone: 'amber', code: 'meridiem', text: 'Power ' + (cut ? 'cut' : 'in') + ' "' + r.time + '" on ' + d + ' read as ' + relayClockLabel(min) + ': the register runs in the day.' });
    (byDay[d] = byDay[d] || []).push({ i: i, cut: cut, min: min, raw: [r.date || '', r.event, r.time || ''].filter(Boolean).join(' · ') });
  });
  Object.keys(byDay).sort().forEach(function(d) {
    var open = null;
    byDay[d].forEach(function(x) {
      if (x.min == null) { out.issues.push({ tone: 'amber', code: 'time', text: 'A power row with no time read: ' + x.raw + '.' }); return; }
      if (x.cut) {
        if (open) out.downtime.push({ date: d, time: prodHhmm(open.min), to: null, open: true, raw: open.raw });
        open = x;
      } else if (open) { out.downtime.push({ date: d, time: prodHhmm(open.min), to: prodHhmm(x.min), open: false, raw: open.raw + '\n' + x.raw }); open = null; }
      else out.issues.push({ tone: 'info', code: 'powerin', text: 'Power in at ' + relayClockLabel(x.min) + ' with no cut before it on the page (the cut may be on the page before).' });
    });
    if (open) out.downtime.push({ date: d, time: prodHhmm(open.min), to: null, open: true, raw: open.raw });
  });
  if (!out.downtime.length) out.issues.push({ tone: 'red', code: 'rows', text: 'No power cut read on this page.' });
  out.fp = 'power|' + out.downtime.map(function(x) { return x.date + x.time + '-' + (x.to || ''); }).join(',');
  return out;
}
