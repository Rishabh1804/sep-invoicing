/* ===== PRODUCTION — reading the floor's messages (pure: nothing here reads S) =====
 * Three voices report production into the daily WhatsApp group (census of the real exports, 28 Sep 2026):
 *   - the pickling hand, one message per load: "SSS MEHTA / CLAMP133×83(35×6)-774 nos / PICKLING TIME 9:00AM";
 *     several clients under one time; incoming material under "Incoming material time"; since August over half
 *     the loads carry no quantity ("SSS MEHTA / CLAMP(40×6)"); a line is never named.
 *   - the supervisor: a daily "berral production" list, and short "----production----" blocks inside his in/out
 *     rolls, which report the overtime slot above them.
 *   - the register clerk: the VAT register's pages, typed as written on Mine (faces.js).
 * Everything read here is shown beside the text it came from before anything is saved (Stock's contract). A line
 * that cannot be read is listed, never dropped. The client list and the roster are passed in, so the census can
 * replay the real exports through the same functions.
 */

/* The WhatsApp header, with the post time (RELAY_WA_RE drops it, and attendance depends on its groups). */
var PROD_WA_RE = /^\s*\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp]\.?[Mm]\.?)?\]?\s*(?:-\s*)?([^:]{1,40}):\s?(.*)$/;
var PROD_LIST_HEAD_RE = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/*\s*(?:ka\s+update\s+)?b[ae]r+[ae]*l+\.?\s*(?:production|updated?)/i;
var PROD_FIRM_RE = /\b(ENTERPRISES?|INDUSTR(Y|IES)|AUTO|PRESS|METALS?|ENGG|ENGINEER(S|ING)?|CORPORATION|PVT|LTD|CO\.)\b/i;
var PROD_UNIT_OF = { NO: 'NOS', NOS: 'NOS', MOS: 'NOS', PC: 'NOS', PCS: 'NOS', PIECE: 'NOS', PIECES: 'NOS', KG: 'KG', KGS: 'KG', K: 'KG', KY: 'KG', BAG: 'BAG', BAGS: 'BAG' };
var PROD_QTY_TOKEN_RE = /(\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)*)\s*(nos|no|mos|pcs|pc|pieces|piece|kgs|kg|ky|k|bags|bag)\b\.?/gi;
var PROD_LINES = ['vat-a1', 'vat-a2', 'barrel'];
var PROD_LINE_LABEL = { 'vat-a1': 'VAT A1', 'vat-a2': 'VAT A2', barrel: 'Barrel' };

var PROD_REG_DAY_START = 360;   // a night page's clock starts at 6 AM, the shop's day (production.js PROD_DAY_START)
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
  // The supervisor's day on the lines (26 Nov 2026): "OPENING TIME 7:10 AM … VAT A 1", its work with counts; and the barrel's
  // "BERRAL OUT TIME 8:50 AM …" / "IN TIME 9:05 AM".
  if (relayIsLineDay(t)) return 'production';
  if (/p\w{0,2}[ckx]{1,2}l\w*[ \t]*t\w*me|in[ \t]*c?o?ming[ \t]*ma|i+n?x?o?coming|incoming[ \t]*time/i.test(t) && !PROD_CHEM_IN_RE.test(head)) return 'pickling';
  if (PROD_LIST_HEAD_RE.test(head) || /^\s*b[ae]r+[ae]*l+\.?\s*production/im.test(t)) return 'production';
  // Before power: a slot log may carry a power cut among its slots, and read as power alone its slots were lost.
  if (prodIsRunLog(t)) return 'runs';
  if (/p[ao]w[ae]r\s*(cut|cat|cute|in|out|no)|pawar\s*cut|single\s*ph[ae]se/i.test(t)) return 'power';
  if (/^\s*-*\s*(production|work)\s*-*\s*$/im.test(t)) return 'production';
  // "KESTREL / BOLT--800 NOS / FOR BARREL" (27 Nov 2026): loads and the line they go to with no pickling time written is the
  // pickling hand's, its time asked. It had been sorted as no report.
  if (/\d\s*(?:nos|no|pcs|kgs?)\b/i.test(t) && !PROD_CHEM_IN_RE.test(t) && t.split('\n').some(function(l) { return /^\s*[\-*]*\s*(?:for|to)\b/i.test(l) && prodDestOfLine(l); })) return 'pickling';
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
/* "Delta 0420- 280 nos", "CLAMP133×83(35×6)-774 nos", "210 CD--940 NOS ,91.180Kg", "Higco Nat ....",
   "80×81=297nos", "BOLT--1800+450 Nos", "Eye bolt--18.320kg" → {client, part, gauge, qty, unit, qty2, unit2}. */
function prodReadItem(line, idx) {
  var raw = String(line || '');
  var s = raw.replace(/[×✕]/g, 'X').replace(/(\d),(\d{3})\b/g, '$1$2').replace(/^[\s\-_=*•.]+/, '').trim();
  // "52×64=20×5=120 NOS", "48×57=20×5=75" (the supervisor's roll and the pickling hand, Nov 2026): the size, its gauge and the
  // figure joined by "=", read as "52×64(20×5)--120 NOS". The gauge had been read into the part and the count lost or misread.
  s = s.replace(/(\d{2,3}\s*X\s*\d{2,3})\s*=\s*(\d{2}\s*X\s*\d{1,2})\s*=\s*(\d+(?:\.\d+)?)/i, '$1($2)--$3');
  // "52+10×64=(20×5)=120 NOS", "48×57=(20×5)75 NOS" (28 Nov 2026): an "=" before the gauge's bracket is no part of the size.
  s = s.replace(/(\d)\s*=\s*\(/g, '$1(').replace(/\)\s*=\s*(?=\d)/g, ') ');
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
    // "47×53=20×5=90 VAT A 1": the line written after a figure with no unit is not the figure's (parsePickling takes it as the line).
    var tail = /^(.*?[A-Za-z0-9)\]])\s*(?:-{1,3}|_{2}|=)\s*(\d+(?:\.\d+)?)\s*$/.exec(s.replace(PROD_LINE_END_RE, ''));
    // No unit written: a figure with decimals is weighed ("188CD-45.240"), a whole one counted. Said on the review.
    if (tail) { partText = tail[1]; out.qty = parseFloat(tail[2]); out.qtySrc = 'written'; out.unit = /\.\d/.test(tail[2]) ? 'KG' : 'NOS'; out.unitGuess = true; }
    else if (/\.{3,}\s*$/.test(s)) { partText = s.replace(/\.{3,}\s*$/, ''); out.dots = true; }
  }
  partText = partText.replace(/\s*(?:-{1,3}|_{2}|=|,)\s*$/, '').replace(/\(\s*now\s*\)/i, '').trim();
  // A client written at the front: the longest run of up to three words that names one ("Delta--4242" is two).
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
  // "MEHTA CLAMP 2700 NOS 25×6": a gauge written after the count is the part's, as one written before it is.
  if (!g && toks.length) g = lineGauge(s.slice(toks[0].end));
  out.gauge = g;
  out.part = partText.trim();
  return out;
}
/* The part with its gauge text taken out, so a floor line and a challan line key alike: "CLAMP 165X83(40X6)" and
   "CLAMP165X83 (40×6)" are one part at one gauge. */
/* A list's own numbering at a line's head ("1) ", "01)", "07);", "(3) ", "2. " before a word): never a client, a part or a figure. */
function prodUnnumber(line) {
  return String(line || '').replace(/^\s*\(?\d{1,2}\s*\)\s*[;:.,]?\s*/, '').replace(/^\s*\d{1,2}\s*\.\s+(?=[A-Za-z])/, '');
}
function prodPartBase(part) {
  return String(part || '').replace(/[×✕]/g, 'X').replace(/\(\s*\d{2}\s*X\s*\d\s*\)|(?:^|[^0-9A-Z])\d{2}\s*X\s*\d(?![0-9X])/gi, ' ')
    .replace(/\((NT|UT)\)/gi, ' ').trim();
}

/* ---------- The pickling hand's message ---------- */
function prodIsTimeLine(s) { return /p\w{0,2}[ckx]{1,2}l\w*[ \t]*t\w*me/i.test(s); }
function prodIsIncomingLine(s) { return /in\s*c?o?m\w*\s*(ma\w*\s*)?(t\w*me|rime)|i+n?x?o?coming|incoming\s*time|evening\s*incoming/i.test(s) && !PROD_CHEM_IN_RE.test(s); }
function prodIsPowerLine(s) { return /p[ao]w[ae]r|pawar|single\s*ph[ae]se/i.test(s) && /cut|cat|in\b|out|no\s*in|ph[ae]se/i.test(s); }

/* The line a load is going to, as the pickling hand writes it (owner, 17 Nov 2026): on a line of its own ("FOR VAT A1", "VAT A2",
   "A1 ke liye", the face's own "FOR BARREL"), for the loads of its block; or after a load's figure ("…-774 NOS VAT A2"). A bare "BARREL"
   stays a barrel note, as it was read before: only "for" or "ke liye" makes the barrel a load's line. */
var _prodDestRe = null;   // built on first use: PROD_LINE_TOKEN is declared further down this file
function prodDestOfLine(line) {
  // "VAT A1 &A2", "FOR VAT A1& A2" (owner's export, 25 Nov 2026): a load going to two lines is going to the first written, and
  // the line is never a part. It had been saved as a part named "VAT A1 &A2", with no figure.
  if (!_prodDestRe) _prodDestRe = new RegExp('^[\\s\\-*]*(for|to|->|→)?\\s*(' + PROD_LINE_TOKEN + '|A\\s?[12])(?:\\s*(?:&|\\+|,|and)\\s*(?:' + PROD_LINE_TOKEN + '|A?\\s?[12]))?\\s*(ke\\s*liye|ka|me|mein|line)?[\\s.:*-]*$', 'i');
  var m = String(line || '').match(_prodDestRe);
  if (!m) return null;
  var l = prodLineOfToken(m[2]);
  // A bare BARREL, A1 or A2 is not enough on its own: only with "for" or "ke liye" is it where a load is going.
  if ((l === 'barrel' || /^A\s?[12]$/i.test(m[2].trim())) && !m[1] && !m[3]) return null;
  return l;
}
/* The pickling message's lines as the reader takes them (26 Nov 2026). A time with its clock on the line under it ("VAT 2 PICKLING
   TIME / 4:10 PM") is one line. A line holding several loads ("RING 52×64(20×5)=150 NOS 48×57(20×5)90 NOS PICKLING TIME …") is cut
   after each load's figure where a load or a pickling time follows: it had been read as one load, its parts run together. A figure
   after a figure ("240 NOS 12 KG") stays with its load, and a line after the figure ("180 NOS VAT A2") is where it goes. */
var PROD_CLOCK_ONLY_RE = /^\s*(?:\d{1,2}\s*[:.]\s*\d{2}\s*(?:[ap]\.?\s?m\.?)?|\d{1,2}\s*[ap]\.?\s?m\.?)\s*$/i;
var PROD_FIG_UNIT_RE = /\d+(?:\.\d+)?\s*(?:nos|no|pcs|pc|kgs|kg)\b\.?/gi;
function prodPickSegments(text) {
  var out = [];
  String(text || '').split('\n').forEach(function(raw, i) {
    var prev = out[out.length - 1];
    if (prev && prev.n === i && prodIsTimeLine(prev.t) && !/\d/.test(prev.t.replace(/^.*?t\w*me/i, '')) && PROD_CLOCK_ONLY_RE.test(raw)) { prev.t += ' ' + raw.trim(); return; }
    var segs = prodIsIncomingLine(raw) || prodIsPowerLine(raw) ? [raw] : prodLoadCuts(raw);
    if (segs.length < 2) { out.push({ t: raw, n: i + 1 }); return; }
    segs.forEach(function(seg) { out.push({ t: seg, n: i + 1 }); });
  });
  return out;
}
/* A line of several loads cut after each load's figure, where another load or a pickling time follows (the pickling hand's lines
   and a roll's work, 26–28 Nov 2026). One load, or a line that is not one, is returned whole. */
function prodLoadCuts(line) {
  var cuts = [], m;
  PROD_FIG_UNIT_RE.lastIndex = 0;
  while ((m = PROD_FIG_UNIT_RE.exec(line))) {
    var rest = line.slice(m.index + m[0].length);
    if (!rest.trim() || /^\s*[-–=,(+\/&]*\s*\d+(?:\.\d+)?\s*(?:nos|no|pcs|pc|kgs?|k)\b/i.test(rest)) continue;
    if (!/\d\s*(?:nos|no|pcs|pc|kgs?)\b/i.test(rest) && !prodIsTimeLine(rest)) continue;
    // "RING 180 NOS VAT A2 HOOK 40 NOS": the line after a figure is that load's, and the cut falls after it.
    var tl = rest.match(new RegExp('^[\\s,(–-]*(' + PROD_LINE_TOKEN + ')\\)?[\\s.,]*(?=\\S)', 'i'));
    // Before a pickling time it is the time's: "… 300 NOS VAT A2 PICKLING TIME 9:05 AM".
    cuts.push(m.index + m[0].length + (tl && prodLineOfToken(tl[1]) && !prodIsTimeLine(rest.slice(tl[0].length)) ? tl[0].length : 0));
  }
  if (!cuts.length) return [line];
  var out = [], at = 0;
  cuts.concat([line.length]).forEach(function(c) { var seg = line.slice(at, c).replace(/^[\s,;&+\/]+/, '').trim(); at = c; if (seg) out.push(seg); });
  return out;
}
function parsePickling(msg, ctx) {
  var segs = prodPickSegments(msg.text), lines = segs.map(function(x) { return x.t; }), items = [], notes = [], blockDest = null;
  var date = msg.sentOn || ctx.today, noDate = !msg.sentOn;
  var mode = 'pickled', reworkOn = false, group = null, lastGroup = null, carriedGroup = false, pendingParts = [], family = null, arrivedAt = null, power = {};
  // The loads the last pickling time closed, and whether that time was the line just read: "PICKLING TIME 9:40 / For Barrel"
  // is where those loads are going (owner, 25 Nov 2026). It had gone to the next block's loads.
  var lastFlushed = [], afterTime = false, dateWritten = false;
  // A pickling time with nothing listed above it heads the loads under it (26 Nov 2026: "VAT 2 PICKLING TIME 4:10 PM / 52×64(20×5)
  // =150 NOS"; "NOVA PICKLING TIME 11:40 AM / 48×57…"): each takes it as its own time, until another time, an incoming block or a
  // line heading. Under a time that closed loads above it, the loads under it wait for the next time, as before.
  var headT = null, headNote = null;
  // A line that is only a figure and its unit ("1000 NOS"): the quantity of the load written above it, never a part.
  var bareQty = function(l) { var r = prodReadItem(l || '', null); return !r.part && r.qty != null; };
  // Sent after midnight with no date written, a load pickled in the evening is the evening before ("RING--240 nos /
  // Pickling time 7:15 pm", sent at 12:20 AM; owner, 25 Nov 2026): it had been dated the day it was sent.
  var dayOf = function(it, min, tt) {
    if (dateWritten || !msg.sentOn || msg.sentAt == null || msg.sentAt >= PROD_REG_DAY_START || min == null || min <= msg.sentAt + 30) return;
    // "Pickling time 10:45" with no AM or PM, sent at 12:20 AM: the evening's 10:45, as the day before is.
    if (tt && tt.issue && tt.issue.code === 'meridiem' && min < 720) { min += 720; it.time = prodHhmm(min); it.issues = it.issues.filter(function(x) { return x.code !== 'meridiem'; }); }
    it.date = isoAddDays(msg.sentOn, -1);
    it.issues = it.issues.filter(function(x) { return x.code !== 'later' && x.code !== 'nodate'; });
    it.issues.push({ tone: 'amber', code: 'evebefore', text: 'Sent at ' + relayClockLabel(msg.sentAt) + ' with no date: ' + relayClockLabel(min) + ' is read as the evening before, ' + it.date + '.' });
  };
  var flush = function(kind, t) {
    lastFlushed = [];
    pendingParts.forEach(function(it) {
      it.kind = kind;
      var tt = it.ownTime || t;
      delete it.ownTime; delete it._head; delete it._headDest;
      if (tt) { it.time = prodHhmm(tt.min); if (tt.issue) it.issues.push(tt.issue); dayOf(it, tt.min, tt); }
      if (kind === 'pickled' && !it.dest && blockDest) it.dest = blockDest;
      if (kind !== 'pickled') delete it.dest;
      items.push(it); lastFlushed.push(it);
    });
    pendingParts = [];
  };
  // What is still listed when the message ends or a new incoming block begins: arrived at its own block's time, or
  // loads whose pickling time never came, and said so. An incoming head used to flush the block above it with no
  // time at all, so material that arrived at 8:45 read as arriving at no time once a second block followed.
  var flushOpen = function() {
    if (!pendingParts.length) return;
    pendingParts.forEach(function(it) { if (!it.ownTime && (mode !== 'arrived' || !arrivedAt || arrivedAt.min == null)) it.issues.push({ tone: 'amber', code: 'notime', text: mode === 'arrived' ? 'Arrived: no time written.' : 'No pickling time written under it.' }); });
    flush(mode, mode === 'arrived' ? arrivedAt : null);
  };
  lines.forEach(function(raw, i) {
    var line = raw.trim(), n = segs[i].n;
    if (!line) return;
    var wasAfterTime = afterTime;
    afterTime = false;
    var dm = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?/);
    if (dm && isoFromDmy(dm[1], dm[2], dm[3])) { date = isoFromDmy(dm[1], dm[2], dm[3]); noDate = false; dateWritten = true; line = line.slice(dm[0].length).trim(); if (!line) return; }
    // A date written with dots or dashes ("22.09.26") is the date as well; one with no year ("16/9") names no day a load
    // can take, and is listed. Any other line of figures is a load ("8201/8202", "4706-615", "0760--45"): those were
    // dropped unseen with the dates (P127).
    var dd = line.match(/^(\d{1,2})\s*[.\-\/]\s*(\d{1,2})(?:\s*[.\-\/]\s*(\d{2,4}))?\s*[.\-\/]?$/);
    if (dd && isoFromDmy(dd[1], dd[2], dd[3] || 2000)) {
      if (dd[3]) { date = isoFromDmy(dd[1], dd[2], dd[3]); noDate = false; dateWritten = true; }
      else notes.push({ n: n, raw: raw, text: 'A date with no year: the loads keep the message’s date' });
      return;
    }
    if (prodIsPowerLine(line)) { prodPowerStep(power, line, raw, n, date, msg.sentAt, items, notes); return; }
    if (prodIsIncomingLine(line)) {
      flushOpen();
      headT = null; headNote = null;
      mode = 'arrived';
      var afterHead = line.replace(/^.*?(t\w*me|rime)/i, '');
      arrivedAt = prodTimeOf(afterHead, msg.sentAt);
      // "IncomingMaterial time 4:15 pm SUPPORT(3319)--1000 Nos": a part written on the head line itself.
      var tail = afterHead.replace(/^\s*\d{1,2}\s*(?:[:.]\s*\d{2})?\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)?/i, '').trim();
      if (/[A-Za-z]/.test(tail) && /\d/.test(tail)) pendingParts.push(prodItemRecord(prodReadItem(tail, ctx.clients), group || lastGroup, raw, n, date, noDate));
      return;
    }
    if (prodIsTimeLine(line)) {
      var tAfter = line.replace(/^.*?t\w*me(?:s\b)?/i, ''), tMid = '';
      // "PICKLING TIME NOVA CLAMP 3:00 PM 52×64(20×5)70 NOS" (26 Nov 2026): a name between the time's words and its clock is the
      // client of the loads under it, and a family their sizes take. It had been read into the part with the clock.
      var tck = PROD_CLOCK_RE.exec(tAfter);
      if (tck && /[A-Za-z]/.test(tAfter.slice(0, tck.index))) { tMid = tAfter.slice(0, tck.index).replace(/^[\s.:*-]+|[\s.:*-]+$/g, ''); tAfter = tAfter.slice(tck.index); }
      var t = prodTimeOf(tAfter, msg.sentAt);
      var re = /\bre[-\s]*p/i.test(line);
      // "VAT A 2 PICKLING TIME 2:40 PM 52×64=20×5=120" (owner, 25 Nov 2026): the line written before the time is where the loads
      // are going, and a load written after the time is one of them. The whole line had been a time with nothing above it.
      var tHead = (/^(.*?)p\w{0,2}[ckx]{1,2}l\w*[ \t]*t\w*me/i.exec(line) || [])[1] || '';
      var tLine = tHead.trim() ? prodDestOfLine(tHead) || prodLineOfToken(tHead.replace(/[\s:*-]+$/, '')) : null;
      if (tLine && mode !== 'arrived') blockDest = tLine;
      // "NOVA PICKLING TIME 11:40 AM": a client before the time heads the loads under it. "DURGA 77 CD PICKLING TIME 3:00 PM 400 NOS":
      // a load before the time is one of its loads, its figure the one after the clock (26 Nov 2026).
      var headGroup = null, headIt = null, midFamily = null, pushedAt = false;
      var mkGroup = function(r) { return { client: r.client, clientId: r.clientId, clientName: r.clientName, how: r.clientHow }; };
      if (!tLine && mode !== 'arrived' && /[A-Za-z]/.test(tHead)) {
        var hi = prodReadItem(tHead.replace(/[\s:*-]+$/, ''), ctx.clients);
        if (hi.clientId != null && !hi.part && hi.qty == null) headGroup = mkGroup(hi);
        else if (hi.part && /\d/.test(tHead)) headIt = hi;
      }
      // "PICKLING TIME VAT A1 10:05 AM …" (28 Nov 2026): a line between the time's words and its clock is where the loads go.
      var mlm = tMid.match(new RegExp('^[\\s:*-]*(' + PROD_LINE_TOKEN + ')\\b[\\s:*-]*', 'i'));
      if (mlm && prodLineOfToken(mlm[1]) && mode !== 'arrived') { blockDest = prodLineOfToken(mlm[1]); tMid = tMid.slice(mlm[0].length).trim(); }
      if (tMid && mode !== 'arrived') {
        var mi = prodReadItem(tMid, ctx.clients);
        if (mi.clientId != null) headGroup = mkGroup(mi);
        // A family only with its client ("NOVA RING"): "PICKLING TIME AT 9:40 AM" names none.
        if (mi.clientId != null && mi.part && mi.qty == null && /^[A-Za-z][A-Za-z .]*$/.test(mi.part)) midFamily = mi.part;
      }
      var tTail = tAfter.replace(/^[\s.:*-]*\d{1,2}\s*(?:[:.]\s*\d{2})?\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)?/i, '').trim();
      // "PICKLING TIME 7:50 AM VAT A 1 RING 52×64=20×5=120 NOS" (28 Nov 2026): a line after the clock is where the loads go, the load
      // after it one of them. The line had been read into the part, and the loads under it sent to the next line written.
      var alm = mode !== 'arrived' ? tTail.match(new RegExp('^[\\s:*-]*(?:(?:for|to)\\s+)?(' + PROD_LINE_TOKEN + ')\\b[\\s:*-]*', 'i')) : null;
      if (alm && prodLineOfToken(alm[1])) { blockDest = prodLineOfToken(alm[1]); tTail = tTail.slice(alm[0].length).trim(); }
      var tIt = mode !== 'arrived' && /[A-Za-z0-9]/.test(tTail) ? prodReadItem(tTail, ctx.clients) : null;
      // "… 52×64(20×5)=230 NOS NOVA": a client written after the load's count is its client.
      if (tIt && tIt.qty != null && tIt.clientId == null) {
        var ac = tTail.match(/\d+(?:\.\d+)?\s*(?:nos|no|pcs|kgs?)\b\.?\s*([A-Za-z][A-Za-z .&]*)$/i), acl = ac ? prodMatchClient(ac[1].trim(), ctx.clients) : null;
        if (acl && acl.how !== 'read-as') { tIt.client = ac[1].trim(); tIt.clientId = acl.id; tIt.clientName = acl.name; tIt.clientHow = acl.how; }
      }
      // "PICKLING TIME 3:40 PM VAT A 1 NOVA" (26 Nov 2026): after the clock with no figure, the line the loads go to and their client.
      if (tIt && tIt.qty == null) {
        var tRest = tTail, tlm = tRest.match(new RegExp('^[\\s:*-]*(' + PROD_LINE_TOKEN + ')\\b[\\s:*-]*', 'i'));
        if (tlm && prodLineOfToken(tlm[1])) { blockDest = prodLineOfToken(tlm[1]); tRest = tRest.slice(tlm[0].length); }
        var tri = /[A-Za-z]/.test(tRest) ? prodReadItem(tRest, ctx.clients) : null;
        if (tri && tri.clientId != null) headGroup = mkGroup(tri);
        if (tri && tri.clientId != null && tri.part && /^[A-Za-z][A-Za-z .]*$/.test(tri.part)) midFamily = tri.part;
        tIt = null;
      }
      // A time with no loads of its own, under loads a time above heads: those on its own line are its loads ("RING 140 nos HOOK 60 NOS
      // VAT A2 PICKLING TIME 9:05 AM"); with nothing written under it before the next time, all of them are ("PICKLING TIME 9:00 AM RING
      // 50 NOS / HOOK 40 NOS / PICKLING TIME 10:00 AM": HOOK at 10:00, as the loads above a time always were). They go where it says.
      if (!headIt && !headGroup && !midFamily && !(tIt && tIt.qty != null) && mode !== 'arrived') {
        var heads = pendingParts.filter(function(x) { return x._head; }), mine = heads.filter(function(x) { return x.n === n; }), follows = false;
        for (var j = i + 1; j < lines.length && !follows; j++) {
          var lj = lines[j].trim();
          if (prodIsTimeLine(lj) || prodIsIncomingLine(lj)) break;
          if (/[A-Za-z]/.test(lj) && !prodDestOfLine(lj) && !prodIsPowerLine(lj) || /\d\s*(?:nos|no|pcs|pc|kgs?)\b/i.test(lj)) follows = true;
        }
        var claim = mine.length ? mine : follows ? [] : heads;
        claim.forEach(function(x) {
          delete x._head; delete x.ownTime;
          if (x._headDest) { delete x.dest; delete x._headDest; }
        });
        if (claim.length && !tLine) blockDest = null;
      }
      var above = pendingParts.filter(function(x) { return !x._head; }).length;
      if (headIt) {
        if (tIt && tIt.qty != null && !tIt.part) { headIt.qty = tIt.qty; headIt.unit = tIt.unit; headIt.qtySrc = tIt.qtySrc; tIt = null; }
        var hRec = prodItemRecord(headIt, headIt.clientId != null ? null : headGroup || group || null, raw, n, date, noDate);
        if (blockDest) hRec.dest = blockDest;
        pendingParts.push(hRec); pushedAt = true;
      }
      if (tIt && tIt.qty != null) {
        if (midFamily && /^\d/.test(tIt.part)) tIt.part = midFamily + ' ' + tIt.part;
        if (tIt.clientId != null) group = mkGroup(tIt);
        pendingParts.push(prodItemRecord(tIt, tIt.clientId != null ? null : headGroup || group || null, raw, n, date, noDate)); pushedAt = true;
      }
      if (mode === 'arrived') {
        // "Incoming … / parts / And Pickling Time 9:00" — the same material arrived and went in.
        var arrived = pendingParts.map(function(it) { return Object.assign({}, it, { issues: it.issues.slice() }); });
        pendingParts.forEach(function(it) { it.rework = it.rework || re; });
        flush('pickled', t);
        arrived.forEach(function(it) { it.kind = 'arrived'; it.time = prodHhmm(arrivedAt && arrivedAt.min); if (arrivedAt && arrivedAt.issue) it.issues.push(arrivedAt.issue); items.push(it); });
        mode = 'pickled';
        above = 1;
      } else {
        if (re) pendingParts.forEach(function(it) { it.rework = true; });
        headNote = null;
        if (!above && !pushedAt) { headNote = { n: n, raw: raw, text: 'A pickling time with nothing listed above it', t: t, dest: blockDest || null }; notes.push(headNote); }
        flush('pickled', t);
      }
      var headClient = headIt && headIt.clientId != null ? mkGroup(headIt) : null;
      lastGroup = headClient || group || lastGroup; group = null; carriedGroup = false; family = null; reworkOn = false;
      if (!above && t && t.min != null) { headT = t; group = headGroup; family = midFamily; }
      else { headT = null; headNote = null; blockDest = null; }
      afterTime = true;
      return;
    }
    // "FOR VAT A1": where the loads of this block are going; written straight under a pickling time with nothing listed since,
    // where the loads that time closed are going.
    var dl = prodDestOfLine(line);
    if (dl) {
      var openDest = wasAfterTime && !pendingParts.length ? lastFlushed.filter(function(x) { return x.kind === 'pickled' && !x.dest; }) : [];
      // Loads that already have their line ("FOR VAT A1" above them) leave this one to the block under it.
      if (openDest.length) openDest.forEach(function(x) { x.dest = dl; });
      else {
        // "DURGA / 7313--40 kg / For VAT A2 / 7314--25 kg / For Barrel / Pickling time 9:40" (27 Nov 2026): a line written under loads
        // with none above them is theirs; each had gone to the last line written. Loads under a line written above them keep that
        // one, and the new line heads the loads below, as it always did.
        var open = pendingParts.filter(function(x) { return !x.dest; });
        open.forEach(function(x) { x.dest = blockDest || dl; });
        blockDest = open.length && !blockDest ? null : dl;
      }
      if (headNote) headNote.dest = dl;
      headT = null; headNote = null;
      return;
    }
    if (!/[A-Za-z0-9]/.test(line)) return;
    // "RE-PICKLING" on a line of its own marks the loads of this group as rework, above it and below it.
    if (/^\s*re[-\s]*(work|pickl\w*|plat\w*)\s*$/i.test(line)) { pendingParts.forEach(function(x) { x.rework = true; }); reworkOn = true; return; }
    if (/^\s*b[ae]r+[ae]*l+\.?\s*(production)?\s*$/i.test(line) || /unlo?a?d|lo?a?ding/i.test(line)) { notes.push({ n: n, raw: raw, text: 'A barrel note, not a pickling load; not read' }); return; }
    // "BIG RING--1:25PM": a time written after the part is the load's own pickling time, never part of its name.
    // "VAT A 2 NOVA RING 52×64=20×5=120 NOS": a line written before the load is where it is going (owner, 25 Nov 2026).
    var leadDest = null, lead = line.match(new RegExp('^\\s*(' + PROD_LINE_TOKEN + ')\\s*[-–:]*\\s+(?=[A-Za-z0-9])', 'i'));
    if (lead && prodLineOfToken(lead[1]) && /\d/.test(line.slice(lead[0].length))) { leadDest = prodLineOfToken(lead[1]); line = line.slice(lead[0].length).trim(); }
    // A time needs its colon or its AM/PM: "HOOK--12.50" is 12.5 kg, never 12:50.
    var ownTime = null, otm = /^(.*?[A-Za-z0-9)\]])\s*(?:-{1,3}|–|—|,)\s*(\d{1,2}\s*:\s*\d{2}\s*(?:[ap]\.?\s?m\.?)?|\d{1,2}\s*[:.]\s*\d{2}\s*[ap]\.?\s?m\.?|\d{1,2}\s*[ap]\.?\s?m\.?)\s*$/i.exec(line);
    if (otm && !/\d\s*(nos|no|pcs|pc|kgs?|k)\b/i.test(otm[1])) { ownTime = prodTimeOf(otm[2], msg.sentAt); line = otm[1].trim(); }
    var it = prodReadItem(line, ctx.clients);
    var clientLine = !it.part && it.qty == null && it.clientId != null;
    var firmy = it.qty == null && !it.clientId && PROD_FIRM_RE.test(line) && !/\d/.test(line);
    // A name with lines under it heads them; one with nothing under it but its pickling time is the load itself
    // ("BIG LINER / Pickling time 10:30": no client written, no quantity), which was taken as a client and lost. So is one
    // with only its figure under it ("LINER / 1000 NOS"): the figure is the load's.
    var below = (lines.slice(i + 1).find(function(l) { return l.trim(); }) || '').trim();
    // "DELTA / 7314--260 nos / KILO / HOOK--18 kg" (owner, 25 Nov 2026): a name with no figure, between a load with its figure
    // and another under it, heads a client's loads of its own, unless it is a part the client above has sent. It had been read
    // as the first client's part, and the 18 kg booked to that client.
    var lastLoad = pendingParts[pendingParts.length - 1];
    var midName = !!group && it.qty == null && !it.clientId && !ownTime && /^[A-Za-z][A-Za-z .&]*$/.test(line) && !!lastLoad && lastLoad.qty != null &&
      !!below && !prodIsTimeLine(below) && !bareQty(below) && /^[A-Za-z]/.test(below) && prodReadItem(below, null).qty != null &&
      !(ctx.partOwners && group.clientId != null && String(ctx.partOwners[rateKey(prodPartBase(line))]) === String(group.clientId));
    if (clientLine || firmy || midName || (!group && it.qty == null && !it.clientId && /^[A-Za-z]/.test(line) && !/\d/.test(line) && below && !prodIsTimeLine(below) && !bareQty(below))) {
      group = { client: it.client || line, clientId: it.clientId != null ? it.clientId : null, clientName: it.clientName || '', how: it.clientHow || (firmy ? 'firm' : 'first') };
      carriedGroup = false; family = null;
      return;
    }
    if (it.clientId != null) { group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow }; carriedGroup = false; }
    // A part under a second pickling time with no client written again: the client above it, said so on every load it is
    // carried to (the check then takes a pick on such a load as that load's own, and never learns the name from it).
    // Not where the part has only ever come from another client ("INCOMING MATERIAL TIME 3:20PM / 210 CD--41 KG" under another
    // client's block; owner, 25 Nov 2026): that load is left for prodOwnerFill to read as the part's own client, said so.
    var owner = !group && lastGroup && it.clientId == null && it.part && ctx.partOwners ? ctx.partOwners[rateKey(prodPartBase(it.part))] : null;
    if (!group && lastGroup && !(owner != null && String(owner) !== String(lastGroup.clientId))) { group = lastGroup; carriedGroup = true; }
    if (!it.part && it.qty != null && pendingParts.length && pendingParts[pendingParts.length - 1].qty == null) {
      var last = pendingParts[pendingParts.length - 1];
      last.qty = it.qty; last.unit = it.unit; last.qtySrc = it.qtySrc; last.raw += '\n' + raw;
      return;
    }
    if (family && /^\d/.test(it.part)) it.part = family + ' ' + it.part;
    var rec = prodItemRecord(it, group, raw, n, date, noDate);
    if (ownTime) rec.ownTime = ownTime;
    if (leadDest) rec.dest = leadDest;
    if (reworkOn) rec.rework = true;
    if (headT && !ownTime) {
      rec.ownTime = headT; rec._head = true;
      if (!rec.dest && blockDest) { rec.dest = blockDest; rec._headDest = true; }
      if (headNote) { notes.splice(notes.indexOf(headNote), 1); headNote = null; }
    }
    // "…-774 NOS VAT A2": the line written after the load's figure is where that load is going.
    if (it.qty != null) {
      var em = line.match(PROD_LINE_END_RE), el = em && /\d\s*(nos|no|pcs|pc|kgs?|k)\b|\d\s*$/i.test(line.slice(0, em.index)) ? prodLineOfToken(em[1]) : null;
      if (el) rec.dest = el;
    }
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
/* The list as the supervisor writes it from October 2026 (owner, 15 Oct 2026: "our parser cannot read this message"):
   a batch a block between dashed lines, each with what came out of the barrel and when it was unloaded, and at the
   end what went in for the night, unloaded the next morning and listed again on the next day's list:
     07/10/26/ BERRAL PRODUCTION
     OMEGA 110 KG 10:40 AM UNLOAD
     ----------------
     DELTA 7311-240 NOS +7313-410 NOS
     1:25 PM UNLOAD
     ----------------
     LOADING TIME 4:20 PM 210 CD 65 KG
     60 CD 45 KG GAMMA
     ------and------                      ("and" is the end of the message)
   The unload time is the batch's end, written before or after its figures, on its line or the next; it closes every
   batch above it in its block that has none. Two clients on one line ("BETA PRESS 9312-45 KG GAMMA I BOLLT 35 KG") are
   two batches. A barrel counted in barrels ("OMEGA 1 BERRAL") is the client's batch with no figure, asked; a part's
   code alone before the count ("0777-3 BERRAL") is the group's client's. After the count, a client's figure ("+ KESTREL
   65 KG") is that client's lot, a name that is no client's with a figure is asked, a part word with no figure ("NATBOLLT")
   is the counted barrels' part, and a bare figure their weight. What is loaded is not counted here: it is counted when it is unloaded. The older April log (loads under each time, counted
   "×4" in barrels) has no unload time beside a kilo or a count, and no dashed blocks, and is still listed, not read. */
var PROD_UNLOAD_RE = /\bun\s*(?:lo?a?d|old)(?:ing)?\b(?:\s*(?:timing|time|tim)\b)?/i;
var PROD_LOADING_RE = /(?:^|[^A-Za-z])(?:loading|lodinig|loding|load)\b(?:\s*(?:timing|time)\b)?/i;
var PROD_CLOCK_RE = /\b(\d{1,2}\s*[:.]\s*\d{2}\s*(?:[ap]\.?\s?m\.?)?|\d{1,2}\s*[ap]\.?\s?m\.?)(?![\d])/i;
function prodIsBatchList(lines) {
  var dashed = lines.some(function(l) { return /^\s*-{6,}\s*$/.test(l); });
  var unload = lines.some(function(l) { return PROD_UNLOAD_RE.test(l); });
  var withFigure = lines.some(function(l) { return PROD_UNLOAD_RE.test(l) && /\d\s*(kgs?|nos|no|pcs)\b/i.test(l); });
  return unload && (dashed || withFigure);
}
function parseBarrelBatches(msg, ctx, lines, opts) {
  var items = [], notes = [], date = msg.sentOn || ctx.today, noDate = !msg.sentOn, group = null, power = {};
  var pending = [], loading = null, skip = -1, headUn = null;
  // Times written over their batches, or under them: a numbered list writes them over, and so does one whose last unload
  // time alone on its line has a batch written under it. A list that writes them under ends on its last unload.
  var aloneUn = function(l) { var c = prodUnnumber(l).trim(); return PROD_UNLOAD_RE.test(c) && PROD_CLOCK_RE.test(c) && !/\d\s*(kg|kgs|nos|no|pcs)\b/i.test(c); };
  var timesFirst = lines.some(function(l) { return /^\s*\(?\d{1,2}\s*\)/.test(l) && PROD_UNLOAD_RE.test(l); });
  // The barrel's out and in ("BERRAL OUT TIME 8:50 AM DELTA 310 NOS", read through parseProductionList) write their times over.
  if (opts && opts.timesFirst) timesFirst = true;
  if (!timesFirst) {
    var lastAlone = -1;
    lines.forEach(function(l, k) { if (aloneUn(l)) lastAlone = k; });
    if (lastAlone >= 0) {
      var after = lines.slice(lastAlone + 1).map(function(l) { return l.trim(); }).filter(Boolean)[0] || '';
      timesFirst = !!after && !PROD_UNLOAD_RE.test(after) && !PROD_LOADING_RE.test(after) && /\d\s*(kg|kgs|nos|no|pcs)\b/i.test(after);
    }
  }
  var clockOf = function(s) {
    var m = PROD_CLOCK_RE.exec(s);
    if (!m) return null;
    // The list is often sent the next morning: when it was sent says nothing of a time on the day before.
    var t = prodTimeOf(m[1], date === msg.sentOn ? msg.sentAt : null);
    return { min: t.min, issue: t.issue || null, text: m[0] };
  };
  var close = function(recs, un) {
    recs.forEach(function(r) {
      r.to = prodHhmm(un.min);
      if (un.issue) r.issues.push(un.issue);
    });
  };
  var record = function(it, raw, n, noGroup) {
    var rec = prodItemRecord(it, it.clientId != null || noGroup ? null : group, raw, n, date, false);
    if (it.clientId == null && !noGroup && group) rec._carried = true;
    rec.kind = 'plated'; rec.line = 'barrel'; rec.lineSrc = 'written'; rec.slot = 'day'; rec.basis = 'relay';
    if (it.clientId != null) group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow };
    return rec;
  };
  lines.forEach(function(raw, i) {
    if (i <= skip) return;
    var n = i + 1, line = raw.trim();
    if (!line) return;
    var hm = line.match(PROD_LIST_HEAD_RE);
    if (hm) { if (isoFromDmy(hm[1], hm[2], hm[3])) { date = isoFromDmy(hm[1], hm[2], hm[3]); noDate = false; } line = line.slice(hm[0].length).trim(); }
    // "1) UNLOAD TIME 8:50 AM …", "4) 2:20 PM UNLOAD …" (owner, 25 Nov 2026): a batch's number is not its client or its part.
    var core = prodUnnumber(line).replace(/^[\s\-–—_=*.]+|[\s\-–—_=*.]+$/g, '');
    if (!core) { pending = []; loading = null; headUn = null; return; }
    if (/^(and|end)$/i.test(core) || /^b[ae]r+[ae]*l+\.?\s*production$/i.test(core)) return;
    var dm = core.replace(/\s+/g, '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/*$/);
    if (dm) { if (isoFromDmy(dm[1], dm[2], dm[3])) { date = isoFromDmy(dm[1], dm[2], dm[3]); noDate = false; } return; }
    if (prodIsPowerLine(core)) { prodPowerStep(power, core, raw, n, date, date === msg.sentOn ? msg.sentAt : null, items, notes); return; }
    if (!PROD_UNLOAD_RE.test(core) && PROD_LOADING_RE.test(core)) {
      var lt = clockOf(core);
      loading = lt && lt.min != null ? relayClockLabel(lt.min) : 'the end of the day';
      var rest = core.replace(PROD_LOADING_RE, ' ').replace(lt ? lt.text : '', ' ').trim();
      notes.push({ n: n, raw: raw, text: 'Loaded at ' + loading + (rest ? ': ' + rest : '') + '. Counted when it is unloaded' });
      return;
    }
    // A later out ("BERRAL OUT TIME …" after an IN) ends what was loaded: its batches are unloaded again.
    if (loading && PROD_UNLOAD_RE.test(core)) { loading = null; pending = []; }
    if (loading) { notes.push({ n: n, raw: raw, text: 'Loaded at ' + loading + ': counted when it is unloaded' }); return; }
    var un = null, text = core;
    if (PROD_UNLOAD_RE.test(core)) {
      text = core.replace(PROD_UNLOAD_RE, ' ');
      un = clockOf(text);
      if (un) text = text.replace(un.text, ' ');
      else {
        // "MEHTA LINEAR 600 NOS UNLOAD TIMING" / "4:00 PM": the time on the line under it.
        var nx = String(lines[i + 1] || '').trim();
        var nt = clockOf(nx);
        if (nt && !nx.replace(nt.text, '').replace(/[\s\-.]/g, '')) { un = nt; skip = i + 1; raw = raw + '\n' + lines[i + 1]; }
      }
      if (!un) un = { min: null, issue: { tone: 'amber', code: 'time', text: 'No unload time read for this batch.' } };
      text = text.replace(/\s+/g, ' ').trim();
    }
    var recs = [];
    if (text) {
      // Barrels counted in barrels: a count before the word is a batch with no figure, asked, for the client written
      // before it ("OMEGA 1 BERRAL+ GAMMA 1 BERRAL"), or for the group's client where a part's code alone leads it
      // ("0777-3 BERRAL": three barrels of the group's 0777). What follows the last count: a client's figure is that
      // client's lot ("0777-3 BERRAL+ KESTREL 65 KG", never the first's); a name no client's with a figure is asked, not
      // taken ("+ ZEPHYR 65 KG": a spelling the matcher cannot fold would otherwise land the lot on the first client under
      // a part named after the other firm); a part word with no figure is the counted barrels' part ("2 BERRAL NATBOLLT",
      // the shop's older habit), and a bare figure their weight. Read as one item, the whole line had been the group's at
      // the figure, under a part that was no part, and the barrels counted for nothing (owner, 26 Oct 2026). `barrels`
      // is the count; `barrel` on a face's batch (faces.js) is the unit it ran in.
      var bre = /(\d+)\s*b[ae]r+[ae]*l+s?\b/gi, bm, from = 0, lastBr = null;
      while ((bm = bre.exec(text))) {
        var head = text.slice(from, bm.index).replace(/^[\s+,&]+|[\s\-\u2013\u2014_,+&]+$/g, '');
        from = bm.index + bm[0].length;
        var bi = prodReadItem(head, ctx.clients);
        var br = record(bi, raw, n);
        br.barrels = +bm[1];
        if (bi.qty == null) br.issues.push({ tone: 'amber', code: 'barrels', text: bm[1] + ' barrel' + (+bm[1] === 1 ? '' : 's') + ', with no weight or count written. Enter its figure, or keep it with none.' });
        recs.push(br); lastBr = br;
      }
      var rest = lastBr ? text.slice(from) : text;
      if (rest.trim()) {
        // Two batches on one line split after a figure followed by a name or a "+": "9312-45 KG GAMMA I BOLLT 35 KG".
        var chunks = [], m;
        from = 0;
        PROD_QTY_TOKEN_RE.lastIndex = 0;
        var toks = [];
        while ((m = PROD_QTY_TOKEN_RE.exec(rest))) { if (!/X\s*$/i.test(rest.slice(0, m.index))) toks.push({ at: m.index, end: m.index + m[0].length }); }
        toks.forEach(function(t, k) {
          var nxt = toks[k + 1];
          if (!nxt) return;
          var between = rest.slice(t.end, nxt.at);
          if (/^\s*\+/.test(between) || /[A-Za-z]{3,}/.test(between)) { chunks.push(rest.slice(from, t.end)); from = t.end; }
        });
        chunks.push(rest.slice(from));
        var setQty = function(r, it) {
          r.qty = it.qty; r.unit = it.unit; r.qtySrc = it.qtySrc;
          r.issues = r.issues.filter(function(x) { return x.code !== 'barrels'; });
          if (!it.unit || it.unitGuess) r.issues.push({ tone: 'amber', code: 'unit', text: 'No unit written: ' + it.qty + ' read as ' + (it.unit === 'KG' ? 'kg' : 'pieces') + '.' });
        };
        chunks.forEach(function(c) {
          c = c.replace(/^[\s+,&-]+|[\s+,&-]+$/g, '');
          if (!c) return;
          var it = prodReadItem(c, ctx.clients);
          if (lastBr && it.clientId == null) {
            if (it.qty == null) {
              // "NOVA 2 BERRAL NATBOLLT": the word after the count is the counted barrels' part.
              if (it.part) { lastBr.part = [lastBr.part, it.part].filter(Boolean).join(' '); lastBr.gauge = lastBr.gauge || it.gauge; lastBr.issues = lastBr.issues.filter(function(x) { return x.code !== 'nopart'; }); }
              return;
            }
            if (!it.part || /^\d/.test(it.part)) {
              // "DURGA 2 BERRAL 48 KG", "2 BERRAL 4206 CLAMP 48 KG": the figure after the count is those barrels' weight.
              if (it.part) { lastBr.part = [lastBr.part, it.part].filter(Boolean).join(' '); lastBr.issues = lastBr.issues.filter(function(x) { return x.code !== 'nopart'; }); }
              setQty(lastBr, it);
              return;
            }
            // "+ ZEPHYR 65 KG": a name the book does not hold, with its own figure, is somebody's lot: asked, never the group's.
            var nm = /^([A-Za-z][A-Za-z.&]*(?:\s+[A-Za-z][A-Za-z.&]*){0,2})\s*(.*)$/.exec(it.part);
            it.client = nm[1]; it.part = nm[2].replace(/^[\s\-_,]+/, '');
            recs.push(record(it, raw, n, true));
            return;
          }
          if (!it.part && it.qty == null && it.clientId != null) {
            // A client alone with an unload time is a batch whose figure was not written ("KHURANA UNLOAD TIMING 2:30 PM").
            if (!un) { group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow }; return; }
            var nr = record(it, raw, n);
            nr.issues.push({ tone: 'amber', code: 'noqty', text: 'No figure written for this batch. Enter it, or keep it with none.' });
            recs.push(nr);
            return;
          }
          // "DELTA 310 NOS FLAT BKT": with nothing between the client and its count, a part written after the count is the part
          // (not a line, a rework or a barrel word).
          if (!it.part && it.clientId != null && it.qty != null) {
            var aq = /\d+(?:\.\d+)?\s*(?:nos|no|pcs|kgs?)\b\.?\s*(.*)$/i.exec(c), w = aq ? aq[1].replace(PROD_LINE_END_RE, '').replace(/\b(?:re[-\s]*\w+|done|b[ae]r+[ae]*l+s?)\b/gi, '').replace(/\s+/g, ' ').trim() : '';
            if (/^[A-Za-z]/.test(w) && !prodMatchClient(w, ctx.clients)) { it.part = w; it.gauge = it.gauge || lineGauge(w); }
          }
          recs.push(record(it, raw, n));
        });
      }
    }
    // "2) 11:10 AM UNLOAD" over "DELTA RING 85 NOS" (owner, 25 Nov 2026): an unload time alone on its line with nothing above
    // it waiting is the time of the batches written under it, up to the next unload. Those had taken the next batch's time.
    // "60 CD 27 KG 4 PIN 19 KG DELTA": a client written after the last figure is the client of the line's batches that name none.
    var tailC = text && /\d\s*(?:nos|no|pcs|kgs?)\b\.?\s+([A-Za-z][A-Za-z .&]{2,})$/i.exec(text), tailHit = tailC ? prodMatchClient(tailC[1].trim(), ctx.clients) : null;
    if (tailHit) recs.forEach(function(r) {
      if (r.clientId != null && !r._carried) return;
      r.clientId = tailHit.id; r.clientName = tailHit.name; r.client = tailC[1].trim(); r.clientHow = tailHit.how || '';
      r.issues = r.issues.filter(function(x) { return x.code !== 'client' && x.code !== 'readas'; });
      if (tailHit.how === 'read-as') r.issues.push({ tone: 'amber', code: 'readas', text: '"' + r.client + '" read as ' + tailHit.name + '.' });
      if (r.part && r.part.toUpperCase().endsWith(tailC[1].trim().toUpperCase())) r.part = r.part.slice(0, -tailC[1].trim().length).trim();
    });
    recs.forEach(function(r) { delete r._carried; });
    if (timesFirst && un && !recs.length && !pending.length && un.min != null) { headUn = un; return; }
    // In a list that writes its times over its batches, a time with batches on its own line heads the lines under it too.
    if (un) { headUn = timesFirst && un.min != null ? un : null; close(pending.concat(recs), un); pending = []; }
    else if (headUn) close(recs, headUn);
    else pending = pending.concat(recs);
    recs.forEach(function(r) { items.push(r); });
  });
  if (noDate) items.forEach(function(it) { it.issues.push({ tone: 'amber', code: 'nodate', text: 'No date on the list: read as ' + date + '.' }); });
  prodPowerEnd(power, date, items);
  return { items: items, notes: notes, date: date, noDate: noDate };
}
function parseProductionList(msg, ctx) {
  if (relayIsLineDay(msg.text) === 'opening') return parseVatOpening(msg, ctx);
  if (relayIsLineDay(msg.text) === 'night') return parseVatOpening(msg, ctx, { night: true });
  // "BERRAL OUT TIME 8:50 AM …" / "IN TIME 9:05 AM …" (the supervisor, 26 Nov 2026): out is the unload, in the load, read as
  // the batch list reads UNLOAD and LOADING.
  if (relayIsLineDay(msg.text) === 'barrel') {
    msg = Object.assign({}, msg, { text: String(msg.text).split('\n').map(function(l) {
      return l.replace(/^\s*-*\s*b[ae]r+[ae]*l+\.?[\s-]+(?=(?:out|in)\s*-*\s*time)/i, '').replace(/^\s*out\s*-*\s*time\b/i, 'UNLOAD TIME').replace(/^\s*in\s*-*\s*time\b/i, 'LOADING TIME');
    }).join('\n') });
    return parseBarrelBatches(msg, ctx, String(msg.text).split('\n'), { timesFirst: true });
  }
  var lines = String(msg.text || '').split('\n'), items = [], notes = [];
  // Before 19 May the list was a timed log of unload and load cycles counted in barrels ("Unlod time 10:00am /
  // 90 CD ganral 120k ×4"): barrels, not pieces or kilograms. It is listed, not read. A count of barrels is a figure
  // before the word; the list's own date is not one ("22/09/26 berral production", with no slash after the date, was
  // taken for a count and the whole list thrown away).
  if (prodIsBatchList(lines)) return parseBarrelBatches(msg, ctx, lines);
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
      // only with a part written after it ("KUMAR 0740--280 NOS"); alone before its figure it is the part ("LINER
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

/* ---------- The supervisor's day on the lines (26 Nov 2026) ----------
   "OPENING TIME 7:10 AM PICKLING VAT A 1" heads a line's work from when it opened; a client written alone ("NOVA RING") heads the
   lines under it, with its part's family; a line holds several loads, each a size and its count ("52×64(20×5)=120 NOS 48×57=(20×5)=75
   NOS"), a client written with its own load ("KILO L BKT TIMING 9:05 AM 140NOS") is that load's alone, with its own time, and a word
   after the last count is the family of that line's sizes. "1 ROUND 12 MINUTE" is how long a round takes: said, never counted. Every
   load is a run on its line, from the line's opening (or its own time), basis relay; a load with no line written is asked. */
function parseVatOpening(msg, ctx, opts) {
  opts = opts || {};
  var lines = String(msg.text || '').split('\n'), items = [], notes = [], date = msg.sentOn || ctx.today, noDate = !msg.sentOn;
  var line = null, start = null, group = null, family = null, power = {}, carry = null, night = !!opts.night;
  // "NOVA RING 300 NOS DURGA 77 CD / 2400 NOS" (27 Nov 2026): a load after the line's last count whose figure is the bare count on the
  // line under it. It had been dropped. It keeps the line and client it was written under.
  var push = function(it, raw, n, at, on) {
    on = on || { line: line, group: group };
    var rec = prodItemRecord(it, it.clientId != null ? null : on.group, raw, n, date, false);
    rec.kind = 'plated'; rec.line = on.line; rec.lineSrc = on.line ? 'written' : null; rec.slot = night ? 'ot' : 'day'; rec.basis = 'relay';
    rec.time = at && at.min != null ? prodHhmm(at.min) : null;
    if (at && at.issue) rec.issues.push(at.issue);
    if (night) rec.issues.push({ tone: 'info', code: 'night', text: 'Night work: the night of ' + date + ', overtime.' });
    if (!on.line) rec.issues.push({ tone: 'amber', code: 'noline', text: 'No line written above this work. Pick the line.' });
    items.push(rec);
  };
  var bareCountNext = function(i) {
    var nx = lines.slice(i + 1).find(function(l) { return l.trim(); }) || '';
    return /^[\s\-_=*.•]*\d+(?:\.\d+)?\s*(?:nos|no|pcs|kgs?)\b/i.test(nx);
  };
  var CLOCK = '(\\d{1,2}\\s*[:.]\\s*\\d{2}\\s*(?:[ap]\\.?\\s?m\\.?)?|\\d{1,2}\\s*[ap]\\.?\\s?m\\.?)';
  lines.forEach(function(raw, i) {
    var n = i + 1, bare = raw.trim().replace(/^[\s\-_=*.•]+|[\s\-_=*.•]+$/g, '');
    if (!bare) return;
    var dm = bare.replace(/\s+/g, '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/*$/);
    if (dm && isoFromDmy(dm[1], dm[2], dm[3])) { date = isoFromDmy(dm[1], dm[2], dm[3]); noDate = false; return; }
    var nh = bare.match(/^(?:(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/*\s*)?night\s*work$/i);
    // A night head, at the top or under a day's work: what follows is the night's.
    if (nh) { night = true; if (nh[1] && isoFromDmy(nh[1], nh[2], nh[3])) { date = isoFromDmy(nh[1], nh[2], nh[3]); noDate = false; } return; }
    if (prodIsPowerLine(bare)) { prodPowerStep(power, bare, raw, n, date, msg.sentAt, items, notes); return; }
    var lt = bare.match(new RegExp('\\b(' + PROD_LINE_TOKEN + ')\\b', 'i'));
    if (lt && prodLineOfToken(lt[1])) {
      var nl = prodLineOfToken(lt[1]);
      // Moving from one written line to the next starts afresh; the first line written keeps an opening time read above it.
      if (line && nl !== line) { group = null; family = null; start = null; }
      line = nl; bare = bare.replace(lt[0], ' ');
    }
    var om = bare.match(new RegExp('opening\\s*-*\\s*time\\s*[-:]*\\s*' + CLOCK, 'i'));
    if (om) { start = prodTimeOf(om[1], msg.sentAt); bare = bare.replace(om[0], ' '); }
    bare = bare.replace(/\bpickling\b/i, ' ');
    var rd = bare.match(/(\d+)\s*rounds?\b(?:\s*(\d+)\s*min\w*)?|\b(\d+)\s*min(?:ute)?s?\b/i);
    if (rd && (rd[2] || rd[3])) notes.push({ n: n, raw: raw, text: 'A round takes ' + (rd[2] || rd[3]) + ' minutes on ' + (line ? PROD_LINE_LABEL[line] : 'the line') + ': said, not counted' });
    if (rd) bare = bare.replace(rd[0], ' ');
    var own = null, tm = bare.match(new RegExp('\\btim(?:e|ing)\\s*[-:]*\\s*' + CLOCK, 'i'));
    if (tm) { own = prodTimeOf(tm[1], msg.sentAt); bare = bare.replace(tm[0], ' '); }
    bare = bare.replace(/[×✕]/g, 'X').replace(/(\d)\s*=\s*\(/g, '$1(').replace(/\)\s*=\s*(\d)/g, ') $1').replace(/\s+/g, ' ').trim();
    if (!bare) return;
    var re = /(\d+(?:\.\d+)?)\s*(nos|no|pcs|kgs?)\b\.?/gi, m, from = 0, chunks = [];
    while ((m = re.exec(bare))) { if (/X\s*$/i.test(bare.slice(0, m.index))) continue; chunks.push(bare.slice(from, m.index + m[0].length).trim()); from = m.index + m[0].length; }
    var tail = bare.slice(from).trim();
    if (carry && chunks.length && !prodReadItem(chunks[0], null).part) {
      var ci = prodReadItem(carry.text + ' ' + chunks.shift(), ctx.clients);
      push(ci, carry.raw + '\n' + raw, carry.n, carry.at, carry.on);
    }
    carry = null;
    if (!chunks.length) {
      var h = prodReadItem(bare, ctx.clients);
      if (h.clientId != null) { group = { client: h.client, clientId: h.clientId, clientName: h.clientName, how: h.clientHow }; family = h.part || null; }
      else if (/^[A-Za-z][A-Za-z.-]*$/.test(bare)) family = bare;
      // Two words or more naming nobody the book holds ("ZEPHYR CLAMP"): a client of its own, asked, never the client above.
      else if (/^[A-Za-z][A-Za-z .-]*$/.test(bare)) { var w0 = bare.split(/\s+/)[0]; group = { client: w0, clientId: null, clientName: '', how: 'unknown' }; family = bare.slice(w0.length).trim() || null; }
      else notes.push({ n: n, raw: raw, text: 'Not read' });
      return;
    }
    var lineFamily = /^[A-Za-z][A-Za-z .-]*$/.test(tail) && !prodMatchClient(tail, ctx.clients) ? tail : family;
    chunks.forEach(function(c) {
      var it = prodReadItem(c, ctx.clients);
      if (lineFamily && /^\d/.test(it.part || '')) it.part = lineFamily + ' ' + it.part;
      push(it, raw, n, own || start);
    });
    if (tail && /\d/.test(tail) && bareCountNext(i)) carry = { text: tail, raw: raw, n: n, at: own || start, on: { line: line, group: group } };
  });
  if (noDate) items.forEach(function(it) { if (it.kind !== 'downtime') it.issues.push({ tone: 'amber', code: 'nodate', text: 'No date on the message: read as ' + date + '.' }); });
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
  // Beta press material / VAT A 2 / 9301-540 nos"): a line with a quantity under a slot is that slot's production
  // either way, and a client named on a line of its own is the client of the lines under it.
  var from = null, to = null, hint = null, inProd = false, group = null, pending = null, family = null;
  rr.lines.forEach(function(ln, li) {
    if (ln.role !== 'note') pending = null;
    if (ln.role === 'head') {
      // A second day's heading inside the roll ("22/09/26/ Sunday", read by the relay as a new day): the work under it
      // is that day's. It was dated the roll's first day.
      var dd = ln.raw.replace(/^[\s\-_=*.•]+/, '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (dd && isoFromDmy(dd[1], dd[2], dd[3])) {
        prodPowerEnd(power, date, items);
        date = isoFromDmy(dd[1], dd[2], dd[3]); from = null; to = null; hint = null; inProd = false; group = null; family = null;
        return;
      }
      if (ln.read === 'Production notes') {
        inProd = true; group = null; family = null;
        var pa = relayHeaderAreas(ln.raw).filter(function(a) { return PROD_LINES.indexOf(a) >= 0; });
        if (pa.length) hint = pa[0];
        return;
      }
      if (/^Slot from|^Out at/.test(ln.read)) {
        var tt = relayTimes(ln.raw);
        from = null; to = null;
        // An out-time roll's head is when the slot ended; an in-time roll's, when it began.
        if (tt.length) { if (/^Out at/.test(ln.read)) to = tt[tt.length - 1].min; else { from = tt[0].min; to = tt.length > 1 ? tt[1].min : null; } }
        // The roll's own reading of the slot wins: a night heading names both its ends (8 PM to 6 AM), and a bare NIGHT is
        // the night hold. Read here from the out time alone, the night's work ran to 6 AM from nowhere, dated as a morning.
        if (ln.slotFrom != null) from = ln.slotFrom;
        if (ln.slotTo != null) to = ln.slotTo;
        hint = null; inProd = false; group = null; family = null;
        return;
      }
      var areas = relayHeaderAreas(ln.raw).filter(function(a) { return PROD_LINES.indexOf(a) >= 0; });
      hint = areas.length ? areas[0] : null; inProd = false;
      return;
    }
    if (ln.role !== 'note') return;
    // The chemical stock written into the roll is Stock's (relayStockTail): its lines had been read as fifteen loads (27 Nov 2026).
    if (/^(?:Chemical stock|The chemical stock starts)/.test(ln.read || '')) return;
    var whole = ln.raw.trim();
    if (prodIsPowerLine(whole)) { prodPowerStep(power, whole, ln.raw, ln.n, date, null, items, notes); return; }
    if (/no\s*work/i.test(whole)) { notes.push({ n: ln.n, raw: ln.raw, text: 'No work in this block' }); return; }
    // "NOVA RING / 52×64(20×5)=120 NOS 48×57(20×5)=75 NOS" (28 Nov 2026): a client and a family over sizes heads them, and a line of
    // several loads is each of them. The family had been saved as a load with no figure and the second load lost.
    var nextNote = (rr.lines.slice(li + 1).find(function(x) { return x.role === 'note'; }) || {}).raw || '';
    var segs = prodLoadCuts(whole), lineOwn = null;
    segs.forEach(function(line, si) { prodRollItem(line, si); });
    function prodRollItem(line, si) {
    // "VAT 2---NOVA RING 240 NOS", "BARREL-- KESTREL 77 CD 45 KG" (8 Oct 2026, found reading saved rolls again): the line written before
    // a load is its line, never part of its name.
    var lineOwnHint = null, llm = line.match(new RegExp('^\\s*(' + PROD_LINE_TOKEN + ')\\s*[-–:]+\\s*(?=\\S)', 'i'));
    if (llm && prodLineOfToken(llm[1])) { lineOwnHint = prodLineOfToken(llm[1]); line = line.slice(llm[0].length); }
    var it = prodReadItem(line, ctx.clients);
    // A family over sizes only when the line under it is a size ("52×64…", "84+10×94…"), never a figure ("1200+240 NOS").
    if (segs.length === 1 && it.clientId != null && it.qty == null && it.part && /^[A-Za-z][A-Za-z .]*$/.test(it.part) && /^\s*\(?\d+(?:\s*\+\s*\d+)?\s*X\s*\d/.test(nextNote.replace(/[×✕xX]/g, 'X'))) {
      group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow }; family = it.part;
      return;
    }
    // A load naming its own client leaves the family above; on a line of several loads, the first one's client and family are the
    // rest's ("NOVA RING 52×64(20×5)=120 NOS 48×57(20×5)=75 NOS").
    if (it.clientId != null) family = null;
    if (si === 0 && segs.length > 1 && it.qty != null) {
      var fw = (it.part || '').match(/^([A-Za-z][A-Za-z .]*?)\s+\d/);
      lineOwn = { group: it.clientId != null ? { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow } : null, family: fw ? fw[1] : null };
    } else if (si > 0 && lineOwn) {
      if (it.clientId == null && lineOwn.group) { it.client = lineOwn.group.client; it.clientId = lineOwn.group.clientId; it.clientName = lineOwn.group.clientName; it.clientHow = lineOwn.group.how; }
      if (lineOwn.family && /^\d/.test(it.part || '')) it.part = lineOwn.family + ' ' + it.part;
    }
    if (family && it.qty != null && /^\d/.test(it.part || '')) it.part = family + ' ' + it.part;
    // "Beta press material", "Nova ka maal": the client of the lines below.
    if (it.clientId != null && it.qty == null && (!it.part || /^(material|maal|mal|ka\s*maal|others?|work|ka)$/i.test(it.part.trim()))) {
      group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow }; family = null;
      return;
    }
    // "NOVA CLAMP / 1240 NOS": the figure on the line below the part it counts.
    if (it.qty != null && !it.part && it.clientId == null && pending) {
      var joined = prodReadItem((pending.text || pending.raw).trim() + ' ' + line, ctx.clients);
      if (joined.qty != null) {
        lineOwnHint = lineOwnHint || pending.hint || null;
        if (pending.rec) items.splice(items.indexOf(pending.rec), 1);   // the part line, saved empty inside a block, is this one
        it = joined; it.rawJoined = pending.raw + '\n' + ln.raw; pending = null;
      }
    }
    if (it.qty == null) {
      if (it.part || it.clientId != null) pending = { raw: ln.raw, n: ln.n, text: line, hint: lineOwnHint };
      if (!(inProd && (it.part || it.clientId != null))) { notes.push({ n: ln.n, raw: ln.raw, text: 'Not read as production' }); return; }
    } else pending = null;
    var rec = prodItemRecord(it, it.clientId == null ? group : null, it.rawJoined || ln.raw, ln.n, date, !rr.date && !msg.sentOn);
    rec.kind = 'plated'; rec.slot = 'ot'; rec.basis = 'relay'; rec.line = null; rec.lineHint = lineOwnHint || hint;
    rec.time = prodHhmm(from); rec.to = prodHhmm(to);
    rec.issues.push(lineOwnHint ? { tone: 'amber', code: 'linehint', text: 'Line written before the load: ' + PROD_LINE_LABEL[lineOwnHint] + '. Confirm it.' }
      : hint ? { tone: 'amber', code: 'linehint', text: 'Line read from the header above: ' + PROD_LINE_LABEL[hint] + '. Confirm it.' }
      : { tone: 'amber', code: 'noline', text: 'No line written above this work. Pick the line, or leave it unknown.' });
    items.push(rec);
    if (it.qty == null && pending) pending.rec = rec;
    }
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
/* ---------- A message no reader knows: entered by hand from its text, and its lines learnt ----------
   Owner, 17 Nov 2026: a paste refused ("No pickling or production lines found in that text") "should lead the app user to
   enter data manually, referencing the whatsapp text or pasted text - the parser should learn from it and read messages
   better next time". A message of no kind is read loosely (prodLooseRead): a date written at the head of a line is the day;
   a line header (VAT A 1, VAT A2, berral) is the line of the work under it; a line with no figure is the client of the lines
   under it, where it names one, or the name written there; a line with a figure is a run. That reading only fills the hand
   form (Enter it from the text). What the owner saves from it teaches each line's shape (`learn.lines`, prodTeachKey: the
   words as written, the figures masked, with the client line above it where it had one), and the next message no reader
   knows is read where one of its lines has that shape (prodTaughtRead), the taught lines as entered and said so on the
   review, the others asked. A message none of whose lines was taught is still not read: never a guess from chatter. */
var PROD_DATE_HEAD_RE = /^[\s\-_=*.•]*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/*\s*/;
function prodTeachKey(group, raw) {
  var norm = function(s) {
    return String(s || '').toUpperCase().replace(/[×✕]/g, 'X').replace(/\d+(?:[.,]\d+)?/g, '#').replace(/[^A-Z#]+/g, ' ').replace(/\s+/g, ' ').trim();
  };
  var l = norm(raw);
  if (!l || l.indexOf('#') < 0) return '';
  var g = norm(group);
  return g ? g + ' | ' + l : l;
}
function prodLooseRead(msg, ctx) {
  var lines = String(msg.text || '').split('\n'), items = [], notes = [];
  var date = msg.sentOn || ctx.today, noDate = !msg.sentOn, hint = null, group = null;
  lines.forEach(function(raw0, i) {
    var raw = raw0, line = raw.trim(), n = i + 1;
    if (!line) return;
    var dm = line.match(PROD_DATE_HEAD_RE);
    if (dm) {
      var d = isoFromDmy(dm[1], dm[2], dm[3]);
      if (d) { date = d; noDate = false; hint = null; group = null; }
      line = line.slice(dm[0].length).trim();
      if (!line) return;
    }
    if (!/[A-Za-z0-9]/.test(line)) { group = null; return; }
    var it = prodReadItem(line, ctx.clients);
    if (it.qty == null) {
      // A heading: the line the work under it ran on ("----VAT A 1----", "berral production"), or a word that only heads
      // ("----WORK----", "production"). Pickling headings are the pickling hand's, and say no line.
      var bare = line.replace(/[\s\-_=*.:]+/g, ' ').trim();
      var areas = relayHeaderAreas(bare), lineOf = prodLineOfToken(bare);
      if (lineOf && !/pick/i.test(bare) && bare.split(' ').length <= 4) { hint = lineOf; group = null; return; }
      if (/^(production|work|berral production|barrel production)$/i.test(bare) || (areas.length && bare.split(' ').length <= 4)) { if (areas.length === 1 && PROD_LINES.indexOf(areas[0]) >= 0) hint = areas[0]; group = null; return; }
      // A name on a line of its own: the client of the lines under it ("DURGA / T BKT 800 NOS").
      if (it.clientId != null && !it.part) group = { client: it.client, clientId: it.clientId, clientName: it.clientName, how: it.clientHow, raw: line };
      else group = { client: line, clientId: it.clientId != null ? it.clientId : null, clientName: it.clientName || '', how: it.clientId != null ? it.clientHow : 'unknown', raw: line };
      notes.push({ n: n, raw: raw, text: 'Read as the client of the lines under it' });
      return;
    }
    var rec = prodItemRecord(it, it.clientId == null && group ? group : null, raw, n, date, noDate);
    rec.kind = 'plated'; rec.basis = 'relay'; rec.slot = 'general'; rec.line = null; rec.lineHint = hint;
    rec.group = group ? group.raw : '';
    rec.teachKey = prodTeachKey(it.clientId == null && group ? group.raw : '', line);
    items.push(rec);
  });
  return { items: items, notes: notes, date: date, noDate: noDate };
}
/* The next message no reader knows, read by what the owner taught: only where at least one line has a shape entered by hand. */
function prodTaughtRead(msg, ctx) {
  var taught = ctx.taught || {}, r = prodLooseRead(msg, ctx), hit = 0;
  r.items.forEach(function(it) {
    var t = it.teachKey && taught[it.teachKey];
    if (!t || typeof t !== 'object') {
      it.issues.push({ tone: 'amber', code: 'untaught', text: 'Not a line entered by hand before: read loosely. Check the client, the part and the line.' });
      if (it.lineHint) it.issues.push({ tone: 'amber', code: 'linehint', text: 'Line read from the header above: ' + PROD_LINE_LABEL[it.lineHint] + '. Confirm it.' });
      else it.issues.push({ tone: 'amber', code: 'noline', text: 'No line written above this work. Pick the line, or leave it unknown.' });
      return;
    }
    hit++;
    var c = t.clientId != null && ctx.clients && ctx.clients.list.find(function(x) { return String(x.id) === String(t.clientId); });
    if (c) {
      it.clientId = c.id; it.clientName = c.name; it.clientHow = 'taught';
      it.issues = it.issues.filter(function(x) { return x.code !== 'client' && x.code !== 'readas'; });
    }
    if (t.part) { it.part = t.part; it.gauge = lineGauge(String(t.part).replace(/[×✕]/g, 'X')) || it.gauge; it.issues = it.issues.filter(function(x) { return x.code !== 'nopart'; }); }
    if (t.unit && it.issues.some(function(x) { return x.code === 'unit'; })) { it.unit = t.unit; it.issues = it.issues.filter(function(x) { return x.code !== 'unit'; }); }
    if (t.kind === 'plated' || t.kind === 'pickled') it.kind = t.kind;
    if (t.slot === 'ot' || t.slot === 'day' || t.slot === 'general') it.slot = t.slot;
    // The line: the header above it where one is written and agrees, else what was entered; a header that disagrees is asked.
    if (it.kind !== 'plated') { it.line = null; delete it.lineHint; }
    else if (!it.lineHint || it.lineHint === t.line) { it.line = it.lineHint || t.line || null; delete it.lineHint; }
    else it.issues.push({ tone: 'amber', code: 'linehint', text: 'Entered by hand on ' + (PROD_LINE_LABEL[t.line] || 'no line') + ' before; the header above says ' + PROD_LINE_LABEL[it.lineHint] + '. Pick the line.' });
    it.issues.push({ tone: 'amber', code: 'taught', text: 'Read as this line was entered by hand' + (t.at ? ' on ' + formatDate(isoOf(new Date(t.at))) : '') + ': ' + (c ? c.name : 'no client') + (t.part ? ' · ' + t.part : '') + '.' });
  });
  if (!hit) return { items: [], notes: [], date: r.date, noDate: r.noDate };
  r.taught = hit;
  return r;
}
function parseProdPaste(text, ctx) {
  var msgs = prodSplit(text).map(function(m) {
    var r;
    if (m.kind === 'pickling' || m.kind === 'power') r = parsePickling(m, ctx);
    else if (m.kind === 'production') r = parseProductionList(m, ctx);
    else if (m.kind === 'runs') r = parseProductionRuns(m, ctx);
    else if (m.kind === 'roll') r = prodFromRoll(m, ctx);
    else if (ctx.taught && Object.keys(ctx.taught).length && (r = prodTaughtRead(m, ctx)).taught) m.kind = 'taught';
    else r = { items: [], notes: [], date: m.sentOn || ctx.today };
    prodOwnerFill(r.items, ctx);
    m.read = r;
    m.hash = prodMsgKey(r.date, m.text);
    return m;
  });
  prodPairPower(msgs);
  prodPairTimeAlone(msgs);
  return msgs;
}
/* "Pickling time 9:15 am / For Vat A1" sent alone (27 Nov 2026) after "INCOMING MATERIAL TIME 8:50 AM / …" from the same hand that
   day: the loads that arrived and are pickled in no message here went in at that time, to that line, said amber for the owner to
   confirm. The message had been refused as one with nothing in it, and the loads were never pickled. */
function prodPairTimeAlone(msgs) {
  // By part and figure: a pickling message with no client written still pickles the load (the client is asked there).
  var key = function(it) { return [rateKey(prodPartBase(it.part || '')), it.qty].join('|'); };
  var stored = typeof prodData === 'function' && typeof S !== 'undefined' && S && S.production ? prodData().entries.filter(function(e) { return e.kind === 'pickled' && !e.voidedAt; }) : [];
  msgs.forEach(function(m, mi) {
    if (m.kind !== 'pickling' || m.read.items.length) return;
    var nt = (m.read.notes || []).find(function(x) { return x.t && x.t.min != null && x.text === 'A pickling time with nothing listed above it'; });
    if (!nt) return;
    for (var j = mi - 1; j >= 0; j--) {
      var pm = msgs[j];
      if (pm.sentOn !== m.sentOn || (pm.sentBy || '') !== (m.sentBy || '')) continue;
      var arrived = pm.read.items.filter(function(it) { return it.kind === 'arrived'; });
      if (!arrived.length) continue;
      var pickled = {};
      msgs.forEach(function(x) { x.read.items.forEach(function(it) { if (it.kind === 'pickled') pickled[key(it)] = true; }); });
      // And what is saved pickled that day already (a message saved in an earlier check).
      stored.forEach(function(e) { if (e.date === m.sentOn || e.date === m.read.date) pickled[key(e)] = true; });
      var take = arrived.filter(function(it) { return !pickled[key(it)]; });
      if (!take.length) return;
      m.read.items = take.map(function(it) {
        var c = Object.assign({}, it, { kind: 'pickled', time: prodHhmm(nt.t.min), dest: nt.dest || null, raw: nt.raw, n: nt.n });
        c.issues = it.issues.filter(function(x) { return ['later', 'meridiem', 'notime', 'time'].indexOf(x.code) < 0; });
        if (nt.t.issue) c.issues.push(nt.t.issue);
        c.issues.push({ tone: 'amber', code: 'fromabove', text: 'Arrived at ' + (it.time ? relayClockLabel(relayParseHhmm(it.time)) : 'a time not written') + ' (the message above): read as pickled at ' + relayClockLabel(nt.t.min) + '. Confirm it.' });
        return c;
      });
      m.read.notes = m.read.notes.filter(function(x) { return x !== nt; });
      return;
    }
  });
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

/* ---------- The VAT register, as the clerk wrote it ---------- */
/* A page is read from its rows as written (the clerk types them on Mine, faces.js): times as written, customers and parts
   as spelt, every row, figures exactly as written ("72+10", "96×7+5"), struck rows and figures written over marked as such.
   Converting times, adding up a figure, the START and END rules, rack arithmetic and the day's total are this app's, in
   code, where they can be tested. The rows came first from photos read by Gemini, which came out on 13 Oct 2026 (owner:
   *"it simply never works"*); the shape below is the one those reads took, kept so the runs saved from them still read.

   A page is { page, date, weekday, line, dayTotal, rows }, a row { time, mark (START / END), customer, part, dim, qtyText,
   struck, over, bracket, ditto, legible } or, on a power page, { date, event ("power cut" / "power in"), time }.

   Two page shapes, both seen on the real register (pages of 24–26 Sep 2026, owner):
   - ROUNDS (VAT A1): one row per round, "9:45 AM - 72", a START row first. A START counts as a round of the next
     round's figure (the owner's rule, 26 Jun).
   - START / END (VAT A2): a run opens on a START row and its END row carries the run's whole figure ("96×7+5"); an
     END with no START of its own starts where the one before ended. A START here is only the run's start: counting it
     as a round, as the first build did, doubled every A2 run.
   The register also keeps a POWER LOG ("25/09/26 Power cut - 10:26 AM / Power in - 10:36 AM"), read as power cuts. */
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
/* A figure as the clerk writes it: "72", "72+10", "96×7+5", "8x156+68", "46+48+34", "4×108−3". Sums of products, added
   up here. The first product's larger factor is the rack and the smaller the rounds ("96×7": 7 rounds of 96), which is
   what rack sizes are learnt from; a plain sum carries no rack. Anything else is null: unread, never guessed. */
/* "MEHTA+GENERAL", "(0706+3713)+188CD", "39+50": split on a + outside brackets. */
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
  if (!json || !Array.isArray(json.rows)) { out.issues.push({ tone: 'red', code: 'rows', text: 'No rows were read on this page.' }); return out; }
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
  // A row of the register clerk's page on Mine names the client picked (faces.js sends its id beside the name): that client,
  // whatever its name reads as ("M & M AUTO" read as no client by name). A photo's rows are read by name.
  var itemOf = function(row) { return row.cid != null ? { clientId: row.cid, clientName: row.cust, clientHow: 'picked' } : prodReadItem(row.cust, ctx.clients); };
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
    // under one side of it carries that side ("〃 + DELTA" under MEHTA+GENERAL is MEHTA and DELTA).
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
      cid: r.clientId != null && r.clientId !== '' && String(r.customer || '').trim() ? r.clientId : null, mark: mark, start: mark === 'START', end: mark === 'END', rackSize: r.rackSize, rounds: r.rounds, short: r.short,
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
    var cT = row.cid != null ? [cust] : prodSplitTop(cust), pT = prodSplitTop(part), nShare = Math.max(cT.length, pT.length);
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
  // A page of a line's scheduled night (shifts.js, ctx.night): once the page has passed 5 PM (a row written PM, or read at 5 PM or
  // later), its times run on past midnight, each read on the night's clock, the earliest reading not before the row above it (half
  // an hour's slack for a row written out of turn): "2:00" after "11:40 PM" is 2 AM, not 2 PM, and "12:20 AM" is past midnight, not
  // noon. Before that the page is the day's and keeps the day's reading (the noon fix included), except a bare time read nearer the
  // night than the day ("7:00" opening a night page is 7 PM). A time before the night's end (8:30 AM on a night to 8:30) is the
  // night's tail, past midnight.
  var night = ctx.night && out.line ? ctx.night(out.line, out.date) : null;
  if (night) {
    var edge = Math.max(PROD_REG_DAY_START, night.end - 1440), prev = null, passed = false;
    var dist = function(c) {
      var w = [[RELAY_GENERAL, RELAY_GENERAL_OUT], [night.start - 60, night.end]], best = Infinity;
      w.forEach(function(x) { best = Math.min(best, c < x[0] ? x[0] - c : c > x[1] ? c - x[1] : 0); });
      return best;
    };
    out.rows.forEach(function(row) {
      var t = /(\d{1,2})\s*(?:[:.;]\s*(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/i.exec(String(row.time || ''));
      if (!t || (t[2] == null && !t[3])) return;
      var h = +t[1], mm = t[2] != null ? +t[2] : 0, ap = (t[3] || '').toLowerCase();
      if (h > 23 || mm > 59) return;
      var bare = !ap && h >= 1 && h <= 12;
      var cands = /p/.test(ap) ? [(h % 12 + 12) * 60 + mm] : /a/.test(ap) ? [(h % 12) * 60 + mm] : bare ? [(h % 12) * 60 + mm, (h % 12 + 12) * 60 + mm] : [h * 60 + mm];
      cands = cands.map(function(c) { return c < edge ? c + 1440 : c; }).sort(function(a, b) { return a - b; });
      var old = row.min == null ? null : row.min < edge ? row.min + 1440 : row.min, pick;
      if (!passed) {
        pick = old != null ? old : cands[0];
        if (bare) { var near = cands.slice().sort(function(a, b) { return dist(a) - dist(b); })[0]; if (dist(near) < dist(pick)) pick = near; }
        if (/p/.test(ap) || pick >= RELAY_GENERAL_OUT) passed = true;
      } else {
        pick = cands.find(function(c) { return c >= prev - 30; });
        if (pick == null) pick = cands[cands.length - 1];
      }
      if (pick !== row.min) {
        if (passed) row.issues = row.issues.filter(function(x) { return x.code !== 'meridiem'; });
        if (row.min != null && (row.min % 1440) !== (pick % 1440)) row.issues.push({ tone: 'info', code: 'night', text: row.time + ' read as ' + relayClockLabel(pick) + ': the page is the night’s, which runs past midnight.' });
        row.min = pick;
      }
      prev = pick;
    });
  }
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
      if (!row.end) return;
      row.batch = true;
      // A batch began where the batch before it ended: the last END above it, earlier on the clock (two shares of one round end
      // together, and both began where the round before them ended). A run that opens on an END starts there (below), whether
      // no START is written for it or its gauge split it from its START's run. Until 9 Oct 2026 the review said so and the run
      // kept its END as its start: Samarth's batch of 10:30 to 11:45 read 11:45 to 11:45.
      var before = row.min == null ? null : out.rows.slice(0, k).filter(function(x) { return x.end && x.min != null && x.min < row.min; }).pop();
      if (before) row.fromMin = before.min;
      if (!out.rows.slice(0, k).some(function(x) { return x.start && x.cust === row.cust && x.part === row.part; }))
        row.issues.push(before ? { tone: 'info', code: 'nostart', text: 'An END with no START of its own: taken as starting at ' + relayClockLabel(before.min) + ', where the batch before it ended.' }
          : { tone: 'amber', code: 'nostart', text: 'An END with no START of its own, and no batch ends before it on the page: when it started is not known. Check the page.' });
    });
  }
  // A part the register writes with no gauge takes the gauges its rack size means, by the owner's rule (prodGaugeRuleFor):
  // one gauge is written in as if the clerk had; two or three are kept as the choices, and the run says so.
  if (ctx.gaugeRule) {
    out.rows.forEach(function(row) {
      if (row.start || lineGauge(String(row.part + ' ' + row.dim).replace(/[×✕]/g, 'X'))) return;
      var rack = row.rackSize || (!row.batch && row.qty > 0 ? row.qty : null);
      var it = itemOf(row);
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
      var it = rack ? itemOf(row) : null;
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
    var pd = row.part + ' ' + row.dim, ck = (row.cid != null ? '#' + row.cid : relayKey(row.cust)) + '|' + rateKey(prodPartBase(pd)), g = lineGauge(pd.replace(/[×✕]/g, 'X'));
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
    var first = run.rows[0], it = itemOf(first), dimText = first.dim || run.g;
    var partText = (first.part + (dimText && !lineGauge(first.part.replace(/[×✕]/g, 'X')) ? ' (' + dimText + ')' : '')).trim();
    var counted = run.rows.filter(function(x) { return x.counted && x.qty != null; });
    var qty = counted.reduce(function(s, x) { return s + x.qty; }, 0);
    // A struck row cancelled does not stretch the run's hours (one not yet answered still does).
    var timed = run.rows.filter(function(x) { return !(x.struck && choices['struck' + x.i] === 'cancelled'); });
    var mins = (timed.length ? timed : run.rows).map(function(x) { return x.min; }).filter(function(x) { return x != null; });
    // A run that opens on an END began where the batch before it ended.
    var lead = (timed.length ? timed : run.rows)[0];
    if (lead && lead.end && lead.fromMin != null) mins.push(lead.fromMin);
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
    // A code two of the client's parts end in, or a group of codes in one figure ("(0706+3713)"): matched with the client's
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
