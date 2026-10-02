/* ===== ATTENDANCE RELAY: the supervisor's in-time and out-time messages =====
   Staff → Day → Paste message (and Home → Paste message). The supervisor posts
   two rolls a day to the WhatsApp group: an IN-TIME roll (who stood where, from
   which slot, who is absent, and the EXTRA hours booked to each line) and an
   OUT-TIME roll (who left when: 5 pm, 8 pm, midnight, the night hold). This reads
   both into the day the Staff tab already keeps, and shows every line with what
   was read BEFORE anything is saved — the same contract as the stock paste.

   The house rules it applies are the ones the hand decode has used since August
   (soma-internal/analysis/sep-attendance-seed-*.json), and the parser was
   calibrated against those decoded days:
   - hours are the clock span FLOORED to the whole hour (8:30 → 5:00 pays 8;
     6:00 → 5:00 pays 11), no lunch deduction on a 6 AM start;
   - a monthly or daily hand's OT is hours over 8; an hourly hand is paid every
     hour and carries no OT;
   - the gate keeper stands 7 AM to 7 PM unless the roll says otherwise (BM);
   - a hand the out-time roll does not name left at 5 PM with the general shift;
   - an EXTRA tag on the 8:30 shift is coverage booked to that line; on any other
     slot it is a block, with the crew named under it and the slot's times;
   - absentees go to Flex (the area a missing hand stood in is nowhere).
   Nothing here reads `S`: the roster is passed in, so the parser is testable
   without the app and a replay over the real messages can run in Node. */

var RELAY_WA_RE = /^\s*\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?\]?\s*(?:-\s*)?([^:]{1,40}):\s?(.*)$/;
var RELAY_GENERAL = 510;   // 8:30 AM, the general shift's start
var RELAY_GENERAL_OUT = 1020;  // 5:00 PM
var RELAY_GATE = [420, 1140];  // 7 AM – 7 PM, the gate keeper's standing hours
var RELAY_MORNING = 360;   // 6:00 AM
var RELAY_NIGHT = 1200;    // 8:00 PM, the night hold's start (owner, 29 Sep 2026: "night hold here means night shift … 8 pm to 6 am")

/* ===== LEARNT FROM YOUR CORRECTIONS (owner, 29 Sep 2026: "The parser should learn from feedback and it generates
   feedback by reading if the data was changed after the paste or save") =====
   A row the roll made remembers the heading it came from and what was read (`srcHead`, `srcAreas`, `srcSlot`, `srcFrom`,
   `srcTo`). Changing its areas, or a block's in and out, on the Day view records the correction against that heading
   (relayLearnFromRow, staff.js), and the next roll with the same heading reads it that way and says so. Put back as
   read, the lesson is forgotten; the paste view lists every one with Forget. Times are learnt only for a heading with
   words in it ("night hold"): a bare "8:00 PM" is when the crew went home, and one day's exception must not move every
   day's block. `S.relayLearn = {heads: {KEY: {areas, was, text, at, day}}, slots: {KEY: {from, to, wasFrom, wasTo, …}}}`. */
function relayHeadKey(t) { return String(t || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(); }
/* A time is not a word however it is written: "12:00AM", "8:00PM" and "6AM" carry their meridiem on the digits, where
   the word boundary the key's AM/PM strip needs is missing, and read as worded headings (the QA of 30 Sep 2026: a bare
   "12:00AM--OUT TIME" learnt a day's block times for every roll after it). Nor are the roll's own type words (IN, OUT,
   TIME: the roll's header says which roll it is) or a range's joining words (TO, FROM, TILL): what is left of
   "12:00AM--OUT TIME" or "5 PM to 12 AM" is still only when a crew came or went. */
function relayHeadHasWords(t) {
  var s = String(t || '').replace(/\d{1,2}(?:\s*[:.]\s*\d{2})?\s*[AaPp]\.?\s?[Mm]\.?(?![A-Za-z])/g, ' ');
  return /[A-Z]{2,}/.test(relayHeadKey(s).replace(/\b(AM|PM|OUT|TIME|IN|TO|FROM|TILL)\b/g, ''));
}
function relayLearnData() {
  if (!S.relayLearn || typeof S.relayLearn !== 'object' || Array.isArray(S.relayLearn)) S.relayLearn = {};
  if (!S.relayLearn.heads || typeof S.relayLearn.heads !== 'object') S.relayLearn.heads = {};
  if (!S.relayLearn.slots || typeof S.relayLearn.slots !== 'object') S.relayLearn.slots = {};
  return S.relayLearn;
}
/* The slot a heading sits in, as the roll wrote it: 'in 08:30' (an in-time slot by its start), 'out 06:00' (an out-time
   slot by when its crew went home). A heading's lesson is kept under the heading AND its slot (relayLearnKey). */
function relaySlotTag(mode, slot) {
  var t = !slot ? null : mode === 'out' ? slot.end : slot.start;
  return (mode === 'out' ? 'out ' : 'in ') + (t == null ? '?' : relayHhmm(t));
}
function relayLearnKey(head, tag) { return relayHeadKey(head) + ' @ ' + tag; }
function relaySlotLabel(tag) {
  var m = /^(in|out) (.*)$/.exec(String(tag || '')), t = m ? relayParseHhmm(m[2]) : null;
  if (!m) return 'any slot';
  return (m[1] === 'out' ? 'out at ' : 'slot from ') + (t == null ? '?' : relayClockLabel(t));
}
function _relayLearntNote(l) { return 'learnt from your correction' + (l && l.day ? ' on ' + formatDate(l.day) : ''); }

function relayKey(s) { return String(s || '').toUpperCase().replace(/[^A-Z]/g, ''); }
function relayHhmm(min) {
  if (min == null) return '';
  var m = ((min % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
function relayClockLabel(min) {
  if (min == null) return '—';
  var m = ((min % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = m % 60;
  var ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
  return h12 + (mm ? ':' + String(mm).padStart(2, '0') : '') + ' ' + ap + (min >= 1440 ? ' (next day)' : '');
}

/* Every time in a fragment, in minutes, with its meridiem if written. "8 :00 pm",
   "5: PM", "12 am", "6--2 PM", "8:30-5pm", "7:00-7:00PM", "5 PM 6 AM". */
var RELAY_TIME_RE = /(\d{1,2})\s*(?::\s*(\d{2})?)?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?(?![\d\/])/gi;
function relayTimes(frag) {
  var out = [], m;
  var s = String(frag || '').replace(/\d{1,2}\/\d{1,2}\/\d{2,4}\/?/g, ' ');
  RELAY_TIME_RE.lastIndex = 0;
  while ((m = RELAY_TIME_RE.exec(s))) {
    var h = +m[1], mm = m[2] ? +m[2] : 0;
    if (h > 12 || mm > 59) continue;
    var hasColon = /:/.test(m[0]);
    var ap = m[3] ? (/p/i.test(m[3]) ? 'pm' : 'am') : '';
    // A bare number is a time only where it cannot be a count: with a colon, or
    // a meridiem, or as the first half of a range ("6-8 PM", "6--2 PM").
    var rangeHead = !ap && !hasColon && /^\s*-{1,3}\s*\d/.test(s.slice(m.index + m[0].length));
    if (!ap && !hasColon && !rangeHead) continue;
    out.push({ h: h, mm: mm, ap: ap, at: m.index });
  }
  // A range's head borrows nothing; a head without a meridiem before a PM tail
  // is the morning ("6-8 PM" is 6 AM to 8 PM, "8:30-5 PM" is 8:30 to 5).
  return out.map(function(t) {
    var min;
    if (t.ap === 'pm') min = (t.h % 12 + 12) * 60 + t.mm;
    else if (t.ap === 'am') min = (t.h % 12) * 60 + t.mm;
    else min = (t.h >= 1 && t.h <= 5 ? t.h + 12 : t.h) * 60 + t.mm;  // bare 5:00 is the evening
    return { min: min, ap: t.ap, h: t.h };
  });
}

/* Which areas a header names. Ordered so the VAT row co-tagged with its
   pickling hands ("VAT A1 & pickling") stays a VAT row: the pickling fold is
   the reconciler's to apply, and reading it as the pickling unit would give it
   a complement of three it never had. */
function relayHeaderAreas(text) {
  var k = ' ' + String(text || '').toUpperCase().replace(/[^A-Z0-9&]+/g, ' ') + ' ';
  var barrel = /\bB[AE]R+[AE]L+\b|\bBERAL\b|\bBARREL\b/.test(k);
  var pick = /PICK/.test(k);
  var a1 = /\bA\s?1\b|\bVA\s?1\b/.test(k), a2 = /\bA\s?2\b|\bVA\s?2\b/.test(k);
  var vat = /\bVAT\b|\bV\s?A\b/.test(k) || a1 || a2;
  var out = [];
  // "pickling VA 1 & berral" is the VAT side's pickling that also serves the
  // barrel; "pickling & berral" is the barrel unit.
  if (pick && /PICK\w*\s+(VAT|V\s?A)\b/.test(k)) return ['pickling-vat'];
  // "pickling 2 SIDE": one pickling crew serving both sides, the barrel and whichever VAT line runs (owner, 29 Sep
  // 2026) — judged against both pickling areas, never a third area.
  if (pick && /\b(2|TWO|BOTH)\s*SIDE/.test(k)) return ['pickling-vat', 'pickling-barrel'];
  // "berral & V A 2": the barrel and a VAT line in one block (the night hold). It used to stop at the barrel and
  // judge the whole crew against the barrel's complement alone.
  if (barrel && !pick && (a1 || a2)) return ['barrel'].concat(a1 ? ['vat-a1'] : []).concat(a2 ? ['vat-a2'] : []);
  if (barrel) return pick ? ['barrel', 'pickling-barrel'] : ['barrel'];
  if (pick && vat) {
    var vatFirst = /^\s*(VAT|V\s?A)\b/.test(k) && k.indexOf('PICK') > k.search(/VAT|V\s?A/);
    if (vatFirst && !(a1 && a2)) return [a2 && !a1 ? 'vat-a2' : 'vat-a1'];
    return ['pickling-vat'];
  }
  if (pick) return ['pickling-vat'];
  if (a1) out.push('vat-a1');
  if (a2) out.push('vat-a2');
  if (!out.length && vat) out.push('vat-a1');
  if (/OFFICE/.test(k)) out.push('office');
  if (/GATE/.test(k)) out.push('gate');
  if (/CIVIL/.test(k)) out.push('civil');
  if (/COLOU?R/.test(k) && !out.length) out.push('vat-a1');
  return out;
}

/* The roster, indexed for the relay. A name is found three ways, surest first:
   - EXACT: the roster name (with or without a bracketed respelling,
     "Sarat Mahato (Mahto)"), a spelling the owner placed once (`relayNames`),
     or the FIRST WORD of a longer name when no other worker shares it — the
     roll writes "SARAT" for the roster's "Sarat Mahato".
   - FOLDED: the shop's spelling drift taken out (doubled letters, SH/S, BH/B,
     W/V, EE/I), then the consonants alone — SHARAT, BUDHESWER and MAHTO land
     on Sarat, Buddheswar and Mahato. Read as, flagged, remembered on Save.
   - One letter off (two on a long name), same first letter, no tie.
   A key two workers share matches neither: that is asked, never guessed.
   `roster.skip` holds the spellings the owner said to leave out this paste. */
function relayNameVariants(name) {
  var s = String(name || '').trim(), out = [s], firsts = [];
  var firstOf = function(x) { x = x.trim(); if (x.indexOf(' ') > 0) firsts.push(x.split(/\s+/)[0]); };
  // "Sarat Mahato (Mahto)": the name without the bracket, and with the bracket
  // standing in for the word before it; "Lal (Karmu Mahato)": the bracket alone.
  var base = s.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  out.push(base);
  firstOf(base);
  var m = s.match(/^(.*?)(\S+?)\s*\(([^)]+)\)\s*$/);
  if (m) out.push(m[1] + m[3]);
  (s.match(/\(([^)]+)\)/g) || []).forEach(function(b) { b = b.slice(1, -1); out.push(b); firstOf(b); });
  // "Bhanu - B.P. Sharma": either side of the dash.
  if (/\s[-–]\s/.test(base)) base.split(/\s+[-–]\s+/).forEach(function(part) { out.push(part); firstOf(part); });
  return { all: out, firsts: firsts };
}
function relayFold(k) {
  return String(k || '').replace(/EE/g, 'I').replace(/OO/g, 'U').replace(/([A-Z])\1+/g, '$1')
    .replace(/SH/g, 'S').replace(/([BCDGJKPT])H/g, '$1').replace(/W/g, 'V').replace(/Z/g, 'J').replace(/Y/g, 'I')
    .replace(/Q/g, 'K').replace(/([A-Z])\1+/g, '$1');
}
function relaySkel(k) {
  var f = relayFold(relayKey(k));
  return f ? f[0] + f.slice(1).replace(/[AEIOU]/g, '') : '';
}
function relayRosterIndex(roster) {
  var byKey = {}, byFold = {}, bySkel = {}, list = [], firsts = {}, byName = {}, byPlaced = {};
  var put = function(map, k, w) { if (!k) return; if (!(k in map)) map[k] = w; else if (map[k] && map[k] !== w) map[k] = null; };
  (roster || []).forEach(function(w) {
    var v = relayNameVariants(w.name);
    v.all.forEach(function(n) { put(byName, relayKey(n), w); });
    (w.relayNames || []).concat(w.aliases || []).forEach(function(n) { put(byPlaced, relayKey(n), w); });
    v.firsts.forEach(function(f) { put(firsts, relayKey(f), w); });
    list.push(w);
  });
  // A key two workers share matches neither: it used to go to whoever the roster listed first. A spelling the owner
  // placed on one worker is a decision, and it beats another worker's name that reads the same way.
  Object.keys(byName).forEach(function(k) { byKey[k] = byName[k]; });
  Object.keys(byPlaced).forEach(function(k) { byKey[k] = byPlaced[k]; });
  // A first name stands for the worker only when nobody else answers to it.
  Object.keys(firsts).forEach(function(k) { if (k.length >= 3 && firsts[k] && !(k in byKey)) byKey[k] = firsts[k]; });
  Object.keys(byKey).forEach(function(k) { put(byFold, relayFold(k), byKey[k]); put(bySkel, relaySkel(k), byKey[k]); });
  var skip = {};
  Object.keys((roster && roster.skip) || {}).forEach(function(k) { if (roster.skip[k]) skip[relayKey(k)] = true; });
  return { byKey: byKey, byFold: byFold, bySkel: bySkel, list: list, skip: skip };
}
function relayEdit(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  var prev = [], i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    var cur = [i];
    for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/* The leading words that can be a name, up to three: letters only ("SHYAM
   5 PM" is Shyam at 5), and a bracketed respelling of the word before it
   ("Mahato(mahto)") is part of the name, not the rest of the line. */
function relayNameWords(words) {
  var out = [], i = 0;
  while (i < words.length && out.length < 3) {
    var w = words[i], m = w.match(/^([A-Za-z.]+)\(([A-Za-z.]+)\)?$/);
    if (m && relaySkel(m[2]) === relaySkel(m[1])) { out.push({ w: m[1], used: ++i }); continue; }
    var pm = w.match(/^\(([A-Za-z.]+)\)$/);
    if (pm && out.length && relaySkel(pm[1]) === relaySkel(out[out.length - 1].w)) { out[out.length - 1].used = ++i; continue; }
    if (!/^[A-Za-z.]+$/.test(w)) break;
    out.push({ w: w, used: ++i });
  }
  return out;
}
/* The spelling as written, as the key a placement is remembered under. */
function relayWrittenKey(words) {
  return relayKey(relayNameWords(words).map(function(x) { return x.w; }).join(''));
}
/* A name as written → the worker, and how sure. Exact (or a remembered
   spelling, or a first name nobody else has) is sure; a folded spelling or
   one letter off is READ AS and flagged; anything else is not guessed. */
function relayMatchName(words, idx, loose) {
  var nw = relayNameWords(words);
  if (!nw.length) return null;
  var key = function(n) { return relayKey(nw.slice(0, n).map(function(x) { return x.w; }).join('')); };
  var written = key(nw.length);
  if (idx.skip[written]) return null;
  var n, k;
  for (n = nw.length; n >= 1; n--) {
    k = key(n);
    if (k && idx.byKey[k]) {
      // "SARAT MAHTO" for the roster's "Sarat Mahato": the first name found it,
      // and a following word that is a spelling of the worker's other names is
      // part of the name, not the rest of the line.
      var hitW = idx.byKey[k], used = nw[n - 1].used, own = {};
      relayNameVariants(hitW.name).all.join(' ').split(/[\s().-]+/).forEach(function(x) { var sk = relaySkel(x); if (sk.length >= 2) own[sk] = true; });
      for (var j = n; j < nw.length && own[relaySkel(nw[j].w)]; j++) used = nw[j].used;
      return { w: hitW, used: used, sure: true, key: written };
    }
  }
  for (n = nw.length; n >= 1; n--) {
    k = key(n);
    if (k.length < 4) continue;
    var f = idx.byFold[relayFold(k)];
    if (f) return { w: f, used: nw[n - 1].used, sure: false, key: k };
    // The consonants alone only on a numbered line, where a name is expected:
    // a note ("MEHTA CLAMP") must not become a person by its skeleton.
    var sk = loose ? relaySkel(k) : '';
    if (sk.length >= 3 && idx.bySkel[sk]) return { w: idx.bySkel[sk], used: nw[n - 1].used, sure: false, key: k };
  }
  var k1 = key(1);
  if (k1.length >= 4) {
    var best = null, bestD = 9, tie = false;
    Object.keys(idx.byKey).forEach(function(bk) {
      if (bk[0] !== k1[0]) return;
      var d = relayEdit(k1, bk), lim = k1.length >= 7 ? 2 : 1;
      if (d > lim) return;
      if (d < bestD) { best = idx.byKey[bk]; bestD = d; tie = false; }
      else if (d === bestD && idx.byKey[bk] !== best) tie = true;
    });
    if (best && !tie) return { w: best, used: nw[0].used, sure: false, key: k1 };
  }
  return null;
}

/* Split a paste into WhatsApp messages. A paste of the roll alone (no header)
   is one message. */
function relaySplit(text) {
  var msgs = [], cur = null;
  String(text || '').replace(/\r/g, '').replace(/‎|‏/g, '').split('\n').forEach(function(line) {
    var wa = line.match(RELAY_WA_RE);
    if (wa) {
      var a = +wa[1], b = +wa[2];
      // Copied timestamps follow the phone's locale: day-first unless impossible,
      // and the bracketed iOS export is month-first.
      var monthFirst = /^\s*\[/.test(line) ? a <= 12 : (a <= 12 && b > 12);
      cur = { sentBy: wa[4].trim(), sentOn: monthFirst ? isoFromDmy(b, a, wa[3]) : isoFromDmy(a, b, wa[3]), lines: [wa[5]] };
      msgs.push(cur);
      return;
    }
    // A roll pasted without its WhatsApp line still opens with its own dated
    // header ("24/09/26/ out time"); that line starts a new message.
    // A stock message carries the same kind of dated first line ("19/06/26//
    // camical use"), and pasted after a roll it is a message of its own too.
    var rollHead = /^\s*\d{1,2}\/\d{1,2}\/\d{2,4}\/*\s*((in|out)\s*-*\s*time|c[ae]mical|chemical)/i.test(line);
    if (!cur || (rollHead && cur.lines.some(function(l) { return l.trim(); }))) {
      cur = { sentBy: cur && rollHead ? cur.sentBy : '', sentOn: null, lines: [] };
      msgs.push(cur);
    }
    cur.lines.push(line);
  });
  return msgs.map(function(m) { m.text = m.lines.join('\n').replace(/<This message was edited>/gi, '').trim(); delete m.lines; return m; })
    .filter(function(m) { return m.text && !/^<Media omitted>$|omitted>$/i.test(m.text); });
}

/* What kind of message this is, from its first lines. */
function relayKind(text) {
  var head = String(text || '').split('\n').slice(0, 2).join(' ');
  if (/c[ae]mical|chemical/i.test(head)) return 'stock';
  var io = head.match(/\b(in|out)\s*-*\s*time\b/i);
  if (io && /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(head)) return io[1].toLowerCase();
  if (io && !/pickling\s*time/i.test(head)) return io[1].toLowerCase();
  if (/c[ae]mical|chemical|stock/i.test(head)) return 'stock';
  if (/pickling\s*time/i.test(text)) return 'material';
  return 'other';
}

/* One roll → per-day records. Each line keeps what it was read as, so the
   review can show the message beside the reading. */
function parseRelayRoll(text, roster, sentOn) {
  var idx = relayRosterIndex(roster);
  var learn = (roster && roster.learn) || { heads: {}, slots: {} };
  var lines = String(text || '').split('\n');
  var out = { kind: relayKind(text), date: null, days: {}, lines: [], issues: [] };
  var first = lines[0] || '';
  var dm = first.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  // A date the calendar lacks (31/09) reads as no date, and with no day it was sent either there is no day to put it
  // on: it is said, and nothing from it is saved (relayPlan leaves out a roll with no date).
  var dated = dm ? isoFromDmy(dm[1], dm[2], dm[3]) : null;
  out.date = dated || sentOn || null;
  if (!out.date) out.issues.push({ tone: 'red', text: (dm ? '"' + dm[0] + '" is not a date, and' : 'The roll carries no date, and') +
    ' the day it was sent is not known: nothing from it can be saved. Paste it with its WhatsApp line, or put the date on its first line.' });
  else if (!dm) out.issues.push({ tone: 'amber', text: 'The roll carries no date; read as the day it was sent.' });
  else if (!dated) out.issues.push({ tone: 'amber', text: '"' + dm[0] + '" is not a date; read as the day it was sent.' });
  var headTimes = relayTimes(first.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}\/?/, ''));
  var st = {
    mode: out.kind,
    iso: out.date,
    slot: out.kind === 'out' ? null : { start: headTimes.length && out.kind === 'in' ? headTimes[0].min : null, end: headTimes.length > 1 ? relayOutMin(headTimes[1]) : null, label: '' },
    sec: null,
    lastSec: null
  };
  if (out.kind === 'out') st.slot = { start: null, end: headTimes.length ? relayOutMin(headTimes[0]) : null, label: '', allOut: /\ball\b/i.test(first) };
  function day(iso) {
    if (!out.days[iso]) out.days[iso] = { iso: iso, people: {}, extra: [], notes: [], restOut: null, holiday: '' };
    return out.days[iso];
  }
  if (out.date) day(out.date);
  if (out.kind === 'out' && st.slot.allOut && st.slot.end != null) day(out.date).restOut = st.slot.end;

  function newSection(areas, extra) {
    st.sec = { areas: areas, absent: !!(extra && extra.absent), prod: !!(extra && extra.prod), crew: [], crewIds: [], extraLine: null };
    if (!st.sec.prod) st.lastSec = st.sec;
  }
  function slotAt() { return st.slot && st.slot.tag ? st.slot.tag : relaySlotTag(st.mode, st.slot); }

  lines.slice(1).forEach(function(raw, i) {
    var ln = { n: i + 2, raw: raw, role: '', read: '' };
    var line = raw.trim();
    var bare = line.replace(/^[\s\-_=*.•]+|[\s\-_=*.•]+$/g, '').trim();
    if (!bare || st.stop) return;
    out.lines.push(ln);

    // The chemical stock written into the same message, under its own heading
    // and no date ("camical use camical stock"): the roll ends there.
    if (/^c[ae]mical\s+(use|stock)\b|^chemical\s+(use|stock)\b/i.test(bare)) {
      st.stop = true; ln.role = 'note'; ln.read = 'The chemical stock starts here; paste it in More → Stock';
      out.issues.push({ tone: 'info', n: ln.n, text: 'The chemical stock in this message starts here and was not read with the roll. Paste it in More → Stock.' });
      return;
    }
    // A date inside the roll: a holiday, or a second day's block ("16/08/26/ Sunday").
    var dd = bare.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?\s*(.*)$/);
    if (dd) {
      var iso2 = isoFromDmy(dd[1], dd[2], dd[3]);
      if (iso2) {
        // Another message pasted on the end (the chemical stock, say): stop here.
        if (/c[ae]mical|chemical|stock|in\s*-*\s*time|out\s*-*\s*time/i.test(dd[4])) {
          st.stop = true; ln.role = 'note'; ln.read = 'Another message starts here; paste it on its own';
          out.issues.push({ tone: 'amber', n: ln.n, text: 'A second message starts at this line and was not read with this roll.' });
          return;
        }
        if (/holiday|puja|closed|band/i.test(dd[4])) {
          day(iso2).holiday = dd[4].trim();
          ln.role = 'note'; ln.read = 'Holiday on ' + iso2 + ': ' + dd[4].trim();
        } else {
          st.iso = iso2; day(iso2);
          st.slot = { start: null, end: null, label: dd[4].trim() }; st.sec = null;
          ln.role = 'head'; ln.read = 'Now ' + iso2 + (dd[4] ? ' (' + dd[4].trim() + ')' : '');
        }
        return;
      }
    }

    // EXTRA hours: booked to the section it sits in. A number that is a clock time is not hours: "EXTRA 5 PM TO 6 AM"
    // read as 5 hours (the QA of 30 Sep 2026, on a roll of 25 Sep). Such a tag writes a span and no hours, and is kept at
    // 0 h and asked about, never given hours the roll did not write.
    var ex = bare.match(/\bextra\b\W*(\d+(?:\.\d+)?)\s*(?:h|$)/i) || bare.match(/\bextra\b\W*(\d+(?:\.\d+)?)(?!\s*(?:[:.]\s*\d|[ap]\.?\s?m\b)|\d)/i);
    var exNoHours = false;
    if (!ex && /\bextra\b/i.test(bare) && relayTimes(bare).length) { ex = [bare.match(/\bextra\b/i)[0], '0']; exNoHours = true; }
    if (ex && !/^\d+\)/.test(bare)) {
      var hrs = +ex[1];
      var times = relayTimes(bare.replace(ex[0], ''));
      if (/evening|night/i.test(bare) && (!st.slot || st.slot.start === RELAY_GENERAL || st.slot.start == null)) {
        st.slot = { start: RELAY_GENERAL_OUT, end: times.length ? relayOutMin(times[0]) : null, label: 'evening' };
        newSection([], null);
      }
      var sec = st.sec && !st.sec.prod ? st.sec : st.lastSec;
      var flagged = !!(st.sec && st.sec.prod);
      if (!sec) { newSection([], null); sec = st.sec; }
      sec.extraLine = ln;
      var general = st.slot && st.slot.start === RELAY_GENERAL && st.mode === 'in';
      var row;
      // Where a row came from travels with it (relayLearnFromRow): the heading, its slot, and every area the heading read
      // before any lesson, so "put back as read" means as the roll reads with nothing learnt.
      var collapse = function(a) { return a.length === 2 && a[0] === 'barrel' && a[1] === 'pickling-barrel' ? ['pickling-barrel'] : a.slice(); };
      if (general && sec.areas.length) {
        row = { kind: 'coverage', area: sec.areas[0], hours: hrs };
        if (sec.srcHead) { row.srcHead = sec.srcHead; row.srcAt = sec.srcAt; row.srcAreas = (sec.rawAreas || sec.areas).slice(); }
        ln.read = 'EXTRA ' + hrs + ' h booked to ' + relayAreaName(sec.areas[0]);
      } else {
        var from = st.mode === 'out' ? (st.slot && st.slot.rangeStart != null ? st.slot.rangeStart : RELAY_GENERAL_OUT)
          // The night shift starts when it starts (8 PM); any other evening slot on an in-time roll is read from 5 PM.
          : (st.slot && st.slot.night && st.slot.start != null) ? st.slot.start
          : (st.slot && st.slot.start >= RELAY_GENERAL_OUT) ? RELAY_GENERAL_OUT : (st.slot && st.slot.start != null ? st.slot.start : RELAY_MORNING);
        var to = st.mode === 'out' ? (st.slot && st.slot.end) : (st.slot && st.slot.end != null && st.slot.end !== st.slot.start ? st.slot.end : (from === RELAY_MORNING ? RELAY_GENERAL : null));
        // Barrel and its pickling are one unit to the reconciler; the shop's own
        // decodes name a morning block there as the pickling side.
        // A crew that wrote its own out-time ("SAMBHU 6:00 am") ends the block there.
        // When the group's own times differ, the block is the ones who stayed
        // latest (the others went home before it started).
        var crewIds = sec.crewIds.filter(function(id, k) { return sec.crewIds.indexOf(id) === k; });
        if (st.mode === 'out' && crewIds.length) {
          var outs = crewIds.map(function(id) { var pp = day(st.iso).people[id]; return pp ? pp.outExp : null; });
          var known = outs.filter(function(o) { return o != null; });
          if (known.length === outs.length && known.length) {
            var latest = Math.max.apply(null, known);
            to = latest;
            crewIds = crewIds.filter(function(id, k) { return outs[k] === latest; });
          }
        }
        var crewNames = crewIds.map(function(id) { return day(st.iso).people[id].name; });
        var bAreas = sec.learnt ? sec.learnt.areas.slice() : collapse(sec.areas);
        row = { kind: 'block', areas: bAreas, crew: crewNames, hours: hrs, from: relayHhmm(from), to: to == null ? '' : relayHhmm(to) };
        if (sec.srcHead) { row.srcHead = sec.srcHead; row.srcAt = sec.srcAt; row.srcAreas = collapse(sec.rawAreas || sec.areas); }
        // The times as read, on every block: a roll pasted again finds its slot by them even after the owner corrected
        // the block's times (relayExtraSlot). Only a heading with words is also a lesson (srcSlot).
        row.srcFrom = row.from; row.srcTo = row.to;
        if (st.slot && st.slot.label && relayHeadHasWords(st.slot.label)) row.srcSlot = st.slot.label;
        ln.read = 'EXTRA ' + hrs + ' h, block ' + relayClockLabel(from) + ' – ' + (to == null ? '?' : relayClockLabel(to)) +
          (row.areas.length ? ', ' + row.areas.map(relayAreaName).join(' + ') : ', no line named') + ', crew ' + (row.crew.length ? row.crew.length : 'not named');
        if (!row.crew.length) out.issues.push({ tone: 'amber', n: ln.n, text: 'EXTRA ' + hrs + ' h has no crew named under it; it is kept, and reads Not checkable on the Areas card.' });
      }
      if (flagged) out.issues.push({ tone: 'amber', n: ln.n, text: 'EXTRA ' + hrs + ' h sits under the production notes; read against the last line above them.' });
      if (exNoHours) {
        ln.read += ' (no hours written)';
        out.issues.push({ tone: 'amber', n: ln.n, text: '"' + bare + '" writes times, not hours: no hours written, so it is kept at 0 h. Type the hours on the Day view.' });
      }
      ln.role = 'extra';
      day(st.iso).extra.push(row);
      // The tag closes its group: names after it are the next crew.
      var keep = sec.areas.slice(), was = sec.slotOnly, srcHead = sec.srcHead, lrn = sec.learnt, srcAt = sec.srcAt, raw = sec.rawAreas;
      newSection(keep, null); st.sec.slotOnly = was; st.sec.headText = ''; st.sec.srcHead = srcHead; st.sec.learnt = lrn;
      st.sec.srcAt = srcAt; st.sec.rawAreas = raw;
      return;
    }

    // An in-time roll that ends with its own out-times ("Out time" then names).
    if (/^out\s*-*\s*time\b/i.test(bare) && !/\d{1,2}\/\d{1,2}/.test(bare)) {
      var ot2 = relayTimes(bare);
      st.mode = 'out';
      st.slot = { start: null, end: ot2.length ? relayOutMin(ot2[0]) : null, label: bare };
      newSection([], null); st.sec.slotOnly = true;
      ln.role = 'head'; ln.read = 'Out-times from here';
      return;
    }

    // "All out" / "Baki sab 5 pm out": everyone not named leaves at that time.
    if (/^all\s*(out)?$|baki\s*sab|all\s+out/i.test(bare)) {
      var at = relayTimes(bare);
      var t = at.length ? relayOutMin(at[0]) : (st.slot && st.slot.end != null ? st.slot.end : RELAY_GENERAL_OUT);
      day(st.iso).restOut = t;
      ln.role = 'rest'; ln.read = 'Everyone not named left at ' + relayClockLabel(t);
      return;
    }

    var numbered = bare.match(/^0*(\d{1,2})\s*[)\].]\s*(.*)$/);
    var body = numbered ? numbered[2].replace(/^[.)\]:\s]+/, '').trim() : bare;
    var words = body.split(/[\s\-–,]+/).filter(Boolean);
    var hit = words.length && /^[A-Za-z]/.test(words[0]) ? relayMatchName(words, idx, !!numbered) : null;
    var isHeaderish = !numbered && !hit && relaySlotOrArea(bare);

    if (!hit && !numbered && isHeaderish) {
      var kindH = isHeaderish;
      if (kindH.slot) {
        // A heading that writes both ends ("night hold-8 pm to 6 am") gives its block both: the start is no longer
        // taken to be 5 PM. A single time is only when the crew under it went home.
        if (st.mode === 'out') {
          // A night heading that writes one time keeps the night hold's other end (8 PM to 6 AM): "night hold 6 am" still
          // starts at 8 PM, and "night hold 8 pm" still runs to 6 AM. It started at 5 PM, or ended at 8 PM.
          if (kindH.night && kindH.end == null && kindH.single != null) {
            if (kindH.single >= 1440) { kindH.start = RELAY_NIGHT; kindH.end = kindH.single; }
            else { kindH.start = kindH.single; kindH.end = 1440 + RELAY_MORNING; }
          }
          st.slot = { start: null, end: kindH.end != null ? kindH.end : (kindH.single != null ? kindH.single : null), label: bare,
            rangeStart: kindH.end != null || kindH.night ? kindH.start : null };
        } else {
          // The night hold is the night shift, 8 PM to 6 AM (owner, 30 Sep 2026: "night hold is night shift"), on an
          // in-time roll as on an out-time one: a heading with one time keeps the other end, and is never the morning.
          if (kindH.night && kindH.end == null && kindH.single != null) {
            if (kindH.single >= 1440) { kindH.start = RELAY_NIGHT; kindH.end = kindH.single; }
            else { kindH.start = kindH.single; kindH.end = 1440 + RELAY_MORNING; }
          }
          var sStart = kindH.start;
          // A slot ahead of the 8:30 shift on an in-time roll is the morning: the
          // relay has headed it "6:00 pm" before, and BM ruled that a mislabel.
          var pmSlot = !kindH.night && sStart != null && sStart >= 960 && sStart <= 1200 && !st.sawGeneral && out.kind === 'in' && st.mode === 'in';
          if (pmSlot && /8\s*:\s*30/.test(lines.slice(i + 2).join(' '))) {
            sStart -= 720;
            out.issues.push({ tone: 'amber', n: ln.n, text: '"' + bare + '" comes before the 8:30 shift, so it is read as ' + relayClockLabel(sStart) + '.' });
          } else if (pmSlot && relaySlotHoldsShift(lines, i + 2)) {
            // With no 8:30 heading at all, a PM heading over the day's lines and the absent lists IS the 8:30 shift, headed
            // wrong (the rolls of 22 and 23 Sep 2026 wrote "8:00 PM" there). Read as an evening start, every hand under it
            // came in at 8 PM and was out at 5 PM the next day: 21 hours, 13 of them OT (the QA of 30 Sep 2026).
            sStart = RELAY_GENERAL;
            out.issues.push({ tone: 'amber', n: ln.n, text: '"' + bare + '" holds the day\'s lines and the absent lists, and the roll has no 8:30 heading, so it is read as the 8:30 shift.' });
          }
          if (sStart === RELAY_GENERAL) st.sawGeneral = true;
          st.slot = { start: sStart, end: kindH.end, label: bare, night: !!kindH.night };
          kindH.start = sStart;
        }
        // Which slot this is, as the roll wrote it: taken before a learnt time moves it, so a heading's lesson keeps
        // finding its slot (slotAt).
        st.slot.tag = relaySlotTag(st.mode, st.slot);
        var ls = relayHeadHasWords(bare) ? learn.slots[relayHeadKey(bare)] : null;
        if (ls && relayParseHhmm(ls.from) != null && relayParseHhmm(ls.to) != null) {
          var lf = relayParseHhmm(ls.from), lt = relayParseHhmm(ls.to);
          if (lt <= lf) lt += 1440;
          if (st.mode === 'out') { st.slot.rangeStart = lf; st.slot.end = lt; } else { st.slot.start = lf; st.slot.end = lt; kindH.start = lf; }
          st.slot.learnt = ls;
          out.issues.push({ tone: 'info', n: ln.n, text: '"' + bare + '" read as ' + relayClockLabel(lf) + ' – ' + relayClockLabel(lt) + ', ' + _relayLearntNote(ls) + '.' });
        }
        newSection(kindH.areas || [], null);
        st.sec.slotOnly = !(kindH.areas && kindH.areas.length);
        ln.role = 'head';
        ln.read = st.mode === 'out' ? 'Out at ' + relayClockLabel(st.slot.end) + (kindH.start != null && kindH.end != null && kindH.start !== kindH.end ? ' (from ' + relayClockLabel(kindH.start) + ')' : '')
          : 'Slot from ' + relayClockLabel(kindH.start);
        if (kindH.areas && kindH.areas.length) ln.read += ', ' + kindH.areas.map(relayAreaName).join(' + ');
        return;
      }
      if (kindH.prod) { newSection([], { prod: true }); ln.role = 'head'; ln.read = 'Production notes'; return; }
      // Two header lines with nobody between them are one header
      // ("pickling & berral" over "Vat A1 A 2 pickling").
      if (st.sec && !st.sec.crew.length && !st.sec.absent && !st.sec.prod && !st.sec.slotOnly && st.sec.headText && !kindH.absent) {
        var joined = st.sec.headText + ' ' + bare;
        kindH = { areas: relayHeaderAreas(joined) };
        bare = joined;
      }
      // An area written just after a tag names the block the tag booked
      // ("EXTRA 9 hour" then "VAT A 1 & pickling").
      var prevLn = out.lines[out.lines.length - 2];
      var lastRow = day(st.iso).extra[day(st.iso).extra.length - 1];
      if (prevLn && prevLn.role === 'extra' && lastRow && lastRow.kind === 'block' && !lastRow.areas.length && (kindH.areas || []).length) {
        lastRow.areas = kindH.areas.length === 2 && kindH.areas[0] === 'barrel' && kindH.areas[1] === 'pickling-barrel' ? ['pickling-barrel'] : kindH.areas.slice();
        ln.role = 'head'; ln.read = 'The block above ran on ' + lastRow.areas.map(relayAreaName).join(' + ');
        return;
      }
      // A lesson is kept for the heading in its slot: the same "VAT A 1" under the 8:30 shift and under an evening block
      // are two readings, and a correction to one must not move the other (the 8:30 shift's decides where hands stood).
      var at = slotAt(), rawAreas = (kindH.areas || []).slice();
      var lh = !kindH.absent ? learn.heads[relayLearnKey(bare, at)] : null;
      if (lh && Array.isArray(lh.areas)) {
        kindH.areas = lh.areas.slice();
        out.issues.push({ tone: 'info', n: ln.n, text: '"' + bare + '" read as ' + (lh.areas.map(relayAreaName).join(' + ') || 'no line') + ', ' + _relayLearntNote(lh) + '.' });
      }
      newSection(kindH.areas || [], { absent: kindH.absent });
      st.sec.headText = bare;
      st.sec.srcHead = bare;
      st.sec.srcAt = at;
      st.sec.rawAreas = rawAreas;
      st.sec.learnt = lh || null;
      ln.role = 'head';
      ln.read = kindH.absent ? 'Absent' : (kindH.areas.length ? kindH.areas.map(relayAreaName).join(' + ') : 'Section');
      return;
    }

    if (!hit) {
      ln.role = numbered ? 'unknown' : 'note';
      ln.read = numbered ? 'Not on the roster: ' + words.slice(0, 2).join(' ') : 'Note (not a name)';
      if (numbered) {
        var ukey = relayWrittenKey(words) || relayKey(words[0]);
        out.issues.push(idx.skip[ukey]
          ? { tone: 'info', n: ln.n, text: '"' + words.slice(0, 2).join(' ') + '" left out, as you chose.', name: words.slice(0, 2).join(' '), key: ukey }
          : { tone: 'red', n: ln.n, text: '"' + words.slice(0, 2).join(' ') + '" is not on the roster. Pick who it is, or it is left out.', name: words.slice(0, 2).join(' '), key: ukey });
      }
      else day(st.iso).notes.push(bare);
      if (numbered) ln.unknown = words[0] || '';
      return;
    }

    // A person.
    var w = hit.w;
    var rest = words.slice(hit.used).join(' ');
    var p = day(st.iso).people[w.id] || (day(st.iso).people[w.id] = { id: w.id, name: w.name, st: 'P', areas: null, generalArea: null, inExp: null, inSlot: null, outExp: null, outSlot: null, lines: [], readAs: '' });
    p.lines.push(ln.n);
    if (!hit.sure) {
      var asWritten = words.slice(0, hit.used).join(' ');
      p.readAs = asWritten;
      out.issues.push({ tone: 'amber', n: ln.n, text: '"' + asWritten + '" read as ' + w.name + '.', name: asWritten, key: hit.key, id: w.id });
    }
    var absent = (st.sec && st.sec.absent) || /\babsent\b|^A+\b|\bA$/i.test(rest);
    var tms = relayTimes(rest);
    if (absent) {
      p.st = 'A';
    } else {
      if (!st.sec || st.sec.prod) { newSection([], null); st.sec.slotOnly = true; }
      st.sec.crew.push(w.name);
      st.sec.crewIds.push(w.id);
      var areas = st.sec ? st.sec.areas : [];
      if (areas.length) {
        var a = areas.indexOf(w.area) >= 0 ? w.area : areas[0];
        // The office and the gate share a header ("office & gate keeper"); a
        // hand whose post is one of them stands at his own.
        if ((a === 'office' || a === 'gate' || a === 'civil') && (w.area === 'office' || w.area === 'gate' || w.area === 'civil')) a = w.area;
        if (st.slot && st.slot.start === RELAY_GENERAL) p.generalArea = a;
        else if (!p.areas) p.areas = a;
      }
      // Times written beside the name are the hand's own; a slot's are the
      // crew's. The gate keeper reads only his own (his hours are standing).
      if (st.mode === 'out') {
        if (tms.length >= 2) { p.inExp = relayMin(p.inExp, tms[0].min); p.outExp = relayOutMin(tms[tms.length - 1]); }
        else if (tms.length === 1) p.outExp = relayOutMin(tms[0]);
        else if (st.slot && st.slot.end != null) p.outSlot = st.slot.end;
      } else {
        var slotIn = st.slot && st.slot.start != null ? st.slot.start : null;
        if (tms.length >= 2) { p.inExp = relayMin(p.inExp, tms[0].min); p.outExp = relayOutMin(tms[tms.length - 1]); }
        else if (tms.length === 1) {
          if (tms[0].ap === 'pm' || tms[0].min >= 720) p.outExp = relayOutMin(tms[0]);
          else p.inExp = relayMin(p.inExp, tms[0].min);
        }
        if (slotIn != null) p.inSlot = relayMin(p.inSlot, slotIn);
        // A slot that starts in the evening (the night hold, a block) and says when it ends: that is when its hands went
        // home. With no out taken from it, a hand who came at 8 PM was read as out at 5 PM, and so at 5 PM the NEXT day.
        // The morning and the 8:30 shift keep the 5 PM default: their hands stand the general shift after them.
        if (slotIn != null && slotIn >= RELAY_GENERAL_OUT && st.slot.end != null && st.slot.end > slotIn) {
          p.outSlot = p.outSlot == null ? st.slot.end : Math.max(p.outSlot, st.slot.end);
        }
      }
      p.st = 'P';
    }
    ln.role = 'name';
    ln.person = w.id;
    ln.read = w.name + (absent ? ': absent' : '') + (hit.sure ? '' : ' (read from "' + p.readAs + '")');
  });
  return out;
}
function relayMin(a, b) { return a == null ? b : b == null ? a : Math.min(a, b); }
/* An out-time: midnight and the small hours are the next day. */
function relayOutMin(t) {
  var m = t.min;
  if (t.ap === 'am' && t.h === 12) return 1440;
  if (t.ap === 'pm' && t.h === 12) return 1440;           // "12 pm" on an out roll means midnight
  if (t.ap === 'am' && m < 720) return m + 1440;         // "6 AM" out: the next morning
  if (!t.ap && m < 420) return m + 1440;
  return m;
}
function relayAreaName(id) {
  var a = (typeof STAFF_AREAS !== 'undefined' ? STAFF_AREAS : []).find(function(x) { return x.id === id; });
  return a ? a.label : id;
}
/* A header line: a slot ("----6:00 am---", "morning ot", "general shift",
   "HOLD NIGHT", "6:00 pm 6:00 am"), an area, absent, or production. */
function relaySlotOrArea(bare) {
  var up = bare.toUpperCase();
  if (/\b(WORK|PRODUCTION)\b/.test(up) && !/\d/.test(up)) return { prod: true };
  var times = relayTimes(bare);
  var words = up.replace(/\d{1,2}\s*:?\s*\d{0,2}\s*(AM|PM)?/g, ' ').replace(/[^A-Z&]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  var slotWords = ['OUT', 'TIME', 'IN', 'AM', 'PM', 'NIGHT', 'HOLD', 'TO', 'FROM', 'TILL', 'MORNING', 'OT', 'GENERAL', 'GANRAL', 'SHIFT', 'SHIPT', 'EVENING', 'M', 'P', 'A'];
  var areas = relayHeaderAreas(bare);
  var absent = /ABSENT/.test(up);
  if (times.length && !absent) {
    var start = times[0].min, end = times.length > 1 ? relayOutMin(times[1]) : null;
    if (words.every(function(w) { return slotWords.indexOf(w) >= 0; }) || areas.length) return { slot: true, start: start, end: end, single: relayOutMin(times[0]), areas: areas, night: /NIGHT/.test(up) };
  }
  if (/MORNING/.test(up)) return { slot: true, start: RELAY_MORNING, end: RELAY_GENERAL, areas: areas };
  if (/G[AE]N[AE]?RAL/.test(up)) return { slot: true, start: RELAY_GENERAL, end: RELAY_GENERAL_OUT, areas: areas };
  // The night hold runs 8 PM to 6 AM (owner, 29 Sep 2026); times written on the heading win over this.
  if (/NIGHT/.test(up)) return { slot: true, start: RELAY_NIGHT, end: 1440 + RELAY_MORNING, areas: areas, night: true };
  if (absent) return { absent: true, areas: [] };
  if (/\b(MONTHLY|WEEKLY)\b/.test(up) && words.length <= 2) return { areas: [] };
  if (areas.length) return { areas: areas };
  return null;
}

/* Whether the lines under a heading, up to the next slot heading, are the general shift's: an area section and the absent
   lists (the in-time roll's own shape). An evening block on an in-time roll has its line and its crew, never the absent. */
function relaySlotHoldsShift(lines, from) {
  var area = false, absent = false;
  for (var j = from; j < lines.length; j++) {
    var b = String(lines[j] || '').trim().replace(/^[\s\-_=*.•]+|[\s\-_=*.•]+$/g, '').trim();
    if (!b || /^0*\d{1,2}\s*[)\].]/.test(b)) continue;
    if (/^out\s*-*\s*time\b/i.test(b)) break;
    var k = relaySlotOrArea(b);
    if (!k) continue;
    if (k.slot) break;
    if (k.absent) absent = true;
    else if (k.areas && k.areas.length) area = true;
  }
  return area && absent;
}

/* The per-person reading → marks the Staff tab keeps. `comp` decides hours
   versus OT, so the roster is consulted here too. `outKnown` says whether an
   out-time roll has been read for the day: without one a present hand is
   provisionally out at 5 PM, and the review says so. */
function relayPersonMark(p, w, restOut) {
  if (p.st === 'A') return { st: 'A', ot: 0, hours: 0, area: 'flex', inMin: null, outMin: null };
  // No line written: a floor hand floats (Flex); the office and the gate are posts.
  var area = p.generalArea || p.areas || (w && (w.area === 'office' || w.area === 'gate' || w.area === 'civil') ? w.area : 'flex');
  var gate = area === 'gate';
  var inMin, outMin, said = true;
  if (gate) {
    inMin = p.inExp != null ? p.inExp : RELAY_GATE[0];
    if (p.outExp != null) outMin = p.outExp; else { outMin = RELAY_GATE[1]; said = false; }
  } else {
    inMin = relayMin(p.inExp, p.inSlot);
    if (inMin == null) inMin = RELAY_GENERAL;
    if (p.outExp != null) outMin = p.outExp;
    else if (p.outSlot != null) outMin = p.outSlot;
    else { outMin = restOut != null ? restOut : RELAY_GENERAL_OUT; said = false; }
  }
  // An out the roll wrote for the hand or their slot that is not after they came ran past midnight. One it did not write
  // for them (5 PM, the gate's 7 PM, "everyone else left at") is the others' time: before the hand came in, it is no
  // out-time of theirs at all, never the same hour the next day (21 hours off an 8 PM heading, the QA of 30 Sep 2026).
  if (outMin <= inMin) { if (said) outMin += 1440; else outMin = null; }
  var h = relayHoursOf(inMin, outMin, w, area);
  return { st: 'P', ot: h.ot, hours: h.hours, area: area, inMin: inMin, outMin: outMin };
}
/* Hours and OT from an in and an out, the one rule for a roll and for times typed on Staff → Day: the clock span floored
   to the whole hour (8:30 → 5:00 is 8); a monthly or daily hand's OT is the hours over 8; an hourly hand carries none, and
   the gate's twelve hours are its standing shift, not overtime. An out of null is not known: no hours. */
function relayHoursOf(inMin, outMin, w, area) {
  var hours = outMin == null || inMin == null ? 0 : Math.max(0, Math.floor((outMin - inMin) / 60));
  var hourly = w && w.comp === 'hourly';
  return { hours: hours, ot: hourly || area === 'gate' ? 0 : Math.max(0, hours - 8) };
}

/* ===== Screens: Staff → Paste message ===== */
var _relay = null;        // { text, msgs, choices: { KEY: workerId }, plan, other }
var _relayDraft = '';
var _relayView = 'paste';  // 'paste' | 'review'
var _relayShowLines = false;

/* The roster as the parser sees it, with this paste's choices laid over the
   remembered spellings: a key placed on one worker is taken off any other, and
   a key left out is skipped. The picker's value is a string and roster ids are
   numbers, so ids are always compared as strings. */
function relayRoster(choices, day) {
  var extra = {}, skip = {};
  choices = choices || {};
  Object.keys(choices).forEach(function(k) {
    if (choices[k]) (extra[String(choices[k])] = extra[String(choices[k])] || []).push(k);
    else skip[k] = true;
  });
  // A day's rolls read again (relayRereadOpen) are read against the roster of that day: a hand marked on it who has since
  // left is still on its rolls.
  var marked = day && S.attendance && S.attendance[day] ? S.attendance[day].marks || {} : {};
  var r = (S.staff || []).filter(function(w) { return w.active !== false || marked[w.id]; }).map(function(w) {
    return { id: w.id, name: w.name, comp: w.comp, area: w.area,
      relayNames: (w.relayNames || []).filter(function(n) { return !(relayKey(n) in choices); }).concat(extra[String(w.id)] || []) };
  });
  r.skip = skip;
  r.learn = relayLearnData();
  return r;
}
/* Remember a spelling on one worker (and on nobody else). An empty id forgets
   it. Returns true when the roster changed. */
function relayRemember(key, id) {
  key = relayKey(key);
  if (!key) return false;
  var changed = false, w = staffById(id);
  (S.staff || []).forEach(function(x) {
    if (x === w || !Array.isArray(x.relayNames)) return;
    var keep = x.relayNames.filter(function(n) { return relayKey(n) !== key; });
    if (keep.length !== x.relayNames.length) { x.relayNames = keep; changed = true; }
  });
  if (w && relayKey(w.name) !== key && !(w.relayNames || []).some(function(n) { return relayKey(n) === key; })) {
    w.relayNames = (w.relayNames || []).concat([key]);
    changed = true;
  }
  return changed;
}
function relayHash(text) {
  var src = String(text || '').toUpperCase().replace(/\s+/g, ' ').trim(), h = 5381;
  for (var i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
  return 'r' + (h >>> 0).toString(36) + src.length;
}
function relayPastes() {
  if (!Array.isArray(S.relayPastes)) S.relayPastes = [];
  return S.relayPastes;
}

/* The day a roll saved to as the paste would build on it. Read again (rv.reread), the day starts from what was entered or
   corrected by hand: the rolls' own marks and rows (`src: 'relay'`) are what is being read afresh, so nothing of the old
   reading may carry into the new one (an out, an in or an area the bug wrote). A row the owner corrected by hand has lost
   its `src` (_attHandEdit) and is theirs: kept, and the rolls' rows for its slot are not added, as on any paste. */
function relayBaseDay(rv, iso) {
  var rec = S.attendance && S.attendance[iso];
  if (!rv.reread || !rec) return rec;
  var marks = {};
  Object.keys(rec.marks || {}).forEach(function(id) { if (rec.marks[id] && rec.marks[id].src !== 'relay') marks[id] = rec.marks[id]; });
  return { marks: marks, extra: (rec.extra || []).filter(function(e) { return e.src !== 'relay'; }), note: rec.note || '' };
}

/* Everything the paste would do, worked out without touching S. */
function relayPlan(rv) {
  var roster = relayRoster(rv.choices, rv.reread), byId = {};
  roster.forEach(function(w) { byId[w.id] = w; });
  var days = {}, issues = [], lines = [], dupes = 0, repeats = 0, seen = {};
  rv.msgs.forEach(function(m, mi) {
    var r = parseRelayRoll(m.text, roster, m.sentOn), h = relayHash(m.text);
    m.parsed = r;
    // Read again, the rolls are the ones saved for the day: the refusal of a roll already saved is not for them.
    m.dup = rv.reread ? null : relayPastes().find(function(p) { return p.hash === h; }) || null;
    // The same roll twice in ONE paste (a chat export carries a roll the supervisor posted again) is read once: read
    // twice, its EXTRA was booked twice and the paste recorded twice (the QA of 30 Sep 2026).
    m.repeat = !m.dup && !!seen[h];
    seen[h] = true;
    if (m.dup) { dupes++; return; }
    if (m.repeat) { repeats++; return; }
    r.issues.forEach(function(is) { is.mi = mi; issues.push(is); });
    r.lines.forEach(function(l) { l.mi = mi; lines.push(l); });
    Object.keys(r.days).forEach(function(iso) {
      // A roll with no date to put it on (parseRelayRoll says so, red) saves nothing.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
      // Read again, only the day asked about: another day a roll carries is not what the owner chose to read again.
      if (rv.reread && iso !== rv.reread) return;
      var d = r.days[iso];
      var t = days[iso] || (days[iso] = { iso: iso, people: {}, extra: [], restOut: null, holiday: '', notes: [], kinds: [] });
      if (t.kinds.indexOf(r.kind) < 0) t.kinds.push(r.kind);
      Object.keys(d.people).forEach(function(id) {
        var p = d.people[id], e = t.people[id];
        if (!e) { t.people[id] = JSON.parse(JSON.stringify(p)); return; }
        if (p.st === 'P') e.st = 'P';
        ['inExp', 'inSlot'].forEach(function(k) { if (p[k] != null) e[k] = e[k] == null ? p[k] : Math.min(e[k], p[k]); });
        ['outExp', 'outSlot'].forEach(function(k) { if (p[k] != null) e[k] = p[k]; });
        if (p.generalArea) e.generalArea = p.generalArea;
        if (!e.areas && p.areas) e.areas = p.areas;
      });
      if (d.restOut != null) t.restOut = d.restOut;
      t.extra = t.extra.concat(d.extra);
      if (d.holiday) t.holiday = d.holiday;
      t.notes = t.notes.concat(d.notes);
    });
  });
  var out = { days: [], issues: issues, lines: lines, dupes: dupes, repeats: repeats, counts: { red: 0, amber: 0, people: 0 } };
  Object.keys(days).sort().forEach(function(iso) {
    var t = days[iso], live = S.attendance && S.attendance[iso], rec = relayBaseDay(rv, iso);
    var rows = [];
    Object.keys(t.people).forEach(function(id) {
      var p = t.people[id], w = byId[id], prev = rec && rec.marks ? rec.marks[id] : null;
      if (prev && prev.src !== 'relay') { rows.push({ w: w, p: p, prev: prev, next: prev, change: 'kept' }); return; }
      var q = JSON.parse(JSON.stringify(p));
      if (prev && prev.st === 'P' && q.st === 'P') {
        if (prev.inMin != null) q.inExp = relayMin(q.inExp, prev.inMin);
        if (q.outExp == null && q.outSlot == null && prev.outKnown) q.outExp = prev.outMin;
        // Where the hand stood is the general shift's, which the in-time roll gave: an out-time roll pasted after it names
        // the evening block's line, and moved the day's mark there (pasted together, the general shift's area won). Only a
        // general-shift area in this paste moves it; a hand the day holds on no line (Flex) takes the block's.
        if (!q.generalArea && prev.area && (prev.area !== 'flex' || !q.areas)) q.areas = prev.area;
      }
      var next = relayPersonMark(q, w, t.restOut);
      next.outKnown = next.outMin != null && (q.outExp != null || q.outSlot != null || t.restOut != null || t.kinds.indexOf('out') >= 0);
      // Read again, the mark is set beside the one the rolls wrote before, which it replaces.
      var was = rv.reread ? (live && live.marks && live.marks[id] && live.marks[id].src === 'relay' ? live.marks[id] : null) : prev;
      var same = was && was.st === next.st && was.area === next.area && was.hours === next.hours && was.ot === next.ot;
      rows.push({ w: w, p: p, prev: was, next: next, change: !was ? 'new' : same ? 'same' : 'updated' });
    });
    // Present hands already on the day that this paste does not name: "everyone else left at X" (restOut) is theirs
    // too. The in-time roll saved them out at 5 PM on trust; this is when they went. A hand whose out an earlier
    // out-time roll already gave, or whose mark was entered or corrected by hand, is left as it is.
    if (t.restOut != null && rec && rec.marks) Object.keys(rec.marks).forEach(function(id) {
      var prev = rec.marks[id], w = byId[id] || staffById(id);
      if (t.people[id] || !w || !prev || prev.src !== 'relay' || prev.st !== 'P' || prev.outKnown) return;
      var q = { st: 'P', areas: prev.area || null, generalArea: null, inExp: prev.inMin, inSlot: null, outExp: null, outSlot: null };
      var next = relayPersonMark(q, w, t.restOut);
      next.outKnown = next.outMin != null;
      var same = prev.area === next.area && prev.hours === next.hours && prev.ot === next.ot;
      rows.push({ w: w, p: q, prev: prev, next: next, change: same ? 'same' : 'updated' });
    });
    // Read again, a mark the rolls wrote before and no longer read is taken off, and said so.
    var removed = [];
    if (rv.reread && live && live.marks) Object.keys(live.marks).forEach(function(id) {
      var m = live.marks[id];
      if (m && m.src === 'relay' && !t.people[id]) removed.push({ w: byId[id] || staffById(id) || { id: id, name: 'Removed worker' }, prev: m });
    });
    // A day no hand works in one stretch: over 16 hours is a time read wrong far more often than a day worked (21 hours
    // off an 8 PM heading, the QA of 30 Sep 2026), and an out nobody wrote for a hand who came in the evening is 0 hours
    // until the out-time roll says. Both are asked about, never saved unseen.
    rows.forEach(function(r) {
      var n = r.next, first = r.p && r.p.lines && r.p.lines.length ? r.p.lines[0] : null;
      if (r.change === 'kept' || n.st !== 'P' || !r.w) return;
      if (n.hours > 16) issues.push({ tone: 'amber', n: first, text:r.w.name + ' reads ' + n.hours + ' hours on ' + formatDate(iso) + ' (' +
        relayClockLabel(n.inMin) + ' – ' + relayClockLabel(n.outMin) + '): check the times on the roll, or correct the day after saving.' });
      else if (n.outMin == null) issues.push({ tone: 'amber', n: first, text: r.w.name + ' came in at ' + relayClockLabel(n.inMin) + ' on ' + formatDate(iso) +
        ' and nothing on the roll says when they left: 0 hours until the out-time roll is pasted.' });
    });
    rows.sort(function(a, b) {
      var o = { P: 0, H: 1, A: 2 };
      return (o[a.next.st] - o[b.next.st]) || String(a.next.area).localeCompare(String(b.next.area)) || String(a.w.name).localeCompare(String(b.w.name));
    });
    out.counts.people += rows.length;
    var extras = t.extra.map(function(x) {
      var row = x.kind === 'block'
        ? { kind: 'block', areas: x.areas, crew: x.crew.map(function(n) { var w = roster.find(function(r) { return r.name === n; }); return w ? w.id : null; }).filter(function(v) { return v != null; }),
            hours: x.hours, from: x.from, to: x.to, area: x.areas[0] || 'flex', src: 'relay' }
        : { kind: 'coverage', area: x.area, hours: x.hours, src: 'relay' };
      // Where the row came from travels with it, so a correction on the saved day can teach the next roll.
      ['srcHead', 'srcAt', 'srcAreas', 'srcSlot', 'srcFrom', 'srcTo'].forEach(function(k) { if (x[k] != null) row[k] = Array.isArray(x[k]) ? x[k].slice() : x[k]; });
      return { row: row, dup: false, kept: false };
    });
    // The day's rows, slot by slot (relayExtraSlot). A roll pasted again after an edit REPLACES what the relay wrote for
    // each slot it covers, rather than adding its EXTRA beside the old: a row it brings again unchanged is left as it is,
    // and one it no longer carries is taken off (and said so). A slot holding a row entered or corrected by hand is
    // the owner's, like a mark entered by hand: kept, and the roll's rows for it are not added.
    var slots = {}, replaced = [];
    extras.forEach(function(x) { var k = relayExtraSlot(x.row); (slots[k] || (slots[k] = { nw: [], od: [] })).nw.push(x); });
    ((rec && rec.extra) || []).forEach(function(e) { var sl = slots[relayExtraSlot(e)]; if (sl) sl.od.push(e); });
    Object.keys(slots).forEach(function(k) {
      var sl = slots[k];
      if (sl.od.some(function(e) { return e.src !== 'relay'; })) { sl.nw.forEach(function(x) { x.kept = true; }); return; }
      var left = sl.od.slice();
      sl.nw.forEach(function(x) {
        var j = left.findIndex(function(e) { return relayExtraSame(e, x.row); });
        if (j >= 0) { x.dup = true; left.splice(j, 1); }
      });
      replaced = replaced.concat(left);
    });
    // Read again, every row the rolls wrote before is replaced by what they read now (the base day holds none of them).
    if (rv.reread) replaced = ((live && live.extra) || []).filter(function(e) { return e.src === 'relay'; });
    var provisional = t.kinds.indexOf('out') < 0 && rows.some(function(r) { return r.next.st === 'P' && r.change !== 'kept'; });
    out.days.push({ iso: iso, rows: rows, removed: removed, extras: extras, replaced: replaced, holiday: t.holiday, notes: t.notes, kinds: t.kinds, provisional: provisional });
  });
  issues.forEach(function(is) { if (is.tone === 'red') out.counts.red++; else if (is.tone === 'amber') out.counts.amber++; });
  return out;
}
/* The slot an EXTRA row books in: a general-shift row by its area, a block by its times as the roll read them. A block
   corrected by hand kept a new key, so a roll pasted again neither kept nor replaced it and added the block a second
   time, its hours counted twice (the QA sweep's review, 30 Sep 2026). */
function relayExtraSlot(x) {
  if (!extraIsBlock(x)) return 'shift ' + (x.area || 'flex');
  var f = x.srcFrom != null ? x.srcFrom : x.from, t = x.srcTo != null ? x.srcTo : x.to;
  return 'block ' + (f || '?') + '-' + (t || '?');
}
function relayExtraSame(a, b) {
  if (a.kind !== b.kind || a.hours !== b.hours) return false;
  if (a.kind === 'coverage') return a.area === b.area;
  return a.from === b.from && a.to === b.to && extraAreas(a).sort().join() === extraAreas(b).sort().join() &&
    (a.crew || []).slice().sort().join() === (b.crew || []).slice().sort().join();
}

function relayOpen(text) {
  _relayView = 'paste';
  if (text != null) _relayDraft = text;
  _attView = 'paste';
  var page = document.querySelector('.inv-page-active');
  if (!page || page.id !== 'pageStaff') switchTab('pageStaff');
  else renderAttendance();
  var ta = document.getElementById('relayPasteText');
  if (ta) ta.focus();
}

/* A sub-view of Staff (§6.2): the way back to the view it was opened from, and its own title. */
function relayBackBar(action, label, title) {
  return '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="' + action + '"' +
    (action === 'invAttView' ? ' data-view="' + escHtml(_attPrevView || 'overview') + '"' : '') + '>' +
    STAFF_BACK_ICON + escHtml(label) + '</button><h2 class="inv-pagehead-title">' + escHtml(title) + '</h2></div>';
}

function relayRenderView() {
  if (_relayView === 'review' && _relay) return relayRenderReview();
  return relayBackBar('invAttView', 'Staff', 'Paste message') +
    '<div class="inv-panel">' +
    '<div class="inv-field"><label class="inv-field-label" for="relayPasteText">The message as sent: an in-time or out-time roll, a chemical stock message, or the pickling and barrel production</label>' +
    '<textarea id="relayPasteText" class="inv-textarea inv-textarea-mono" rows="12" spellcheck="false" placeholder="Copy the message in WhatsApp and paste it here. Several at once is fine.">' +
    escHtml(_relayDraft) + '</textarea></div>' +
    '<button class="inv-btn inv-btn-primary inv-btn-block" data-action="invRelayRead">Read message</button>' +
    '<div class="inv-note inv-mt-8">Nothing is saved until you check what was read. Names are matched to the roster; a name it cannot place is asked about once and remembered.</div></div>' +
    relayLearntHtml();
}

/* What the reader has learnt from your corrections, each with what it was read as before, and Forget. */
function relayLearntHtml() {
  var L = relayLearnData(), rows = '';
  Object.keys(L.heads).sort().forEach(function(k) {
    var l = L.heads[k];
    rows += '<div class="inv-row inv-row-2" data-learnt="head"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(l.text || k) + '</span>' +
      '<span class="inv-row-meta">' + escHtml((l.areas || []).map(relayAreaName).join(' + ') || 'no line') + ' · was ' + escHtml((l.was || []).map(relayAreaName).join(' + ') || 'no line') +
      // A lesson is read back on its own slot. One kept before that was known is not read: correct the row again.
      ' · ' + escHtml(l.slot ? relaySlotLabel(l.slot) : 'kept before lessons were per slot, not read; correct the row again') +
      (l.day ? ' · ' + escHtml(formatDate(l.day)) : '') + '</span></span>' +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invRelayForget" data-kind="heads" data-key="' + escHtml(k) + '">Forget</button></div>';
  });
  Object.keys(L.slots).sort().forEach(function(k) {
    var l = L.slots[k];
    rows += '<div class="inv-row inv-row-2" data-learnt="slot"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(l.text || k) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(l.from + ' – ' + l.to) + ' · was ' + escHtml((l.wasFrom || '?') + ' – ' + (l.wasTo || '?')) +
      (l.day ? ' · ' + escHtml(formatDate(l.day)) : '') + '</span></span>' +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invRelayForget" data-kind="slots" data-key="' + escHtml(k) + '">Forget</button></div>';
  });
  if (!rows) return '';
  return '<div class="inv-panel inv-panel-flush" id="relayLearnt"><div class="inv-panel-head"><span class="inv-panel-title">Learnt from your corrections</span></div>' +
    '<div class="inv-panel-body inv-note">A heading you corrected on the Day view is read your way on every roll after it. Forget one to go back to how it is read by default.</div>' + rows + '</div>';
}

function relayRead() {
  var ta = document.getElementById('relayPasteText');
  var text = ta ? ta.value : _relayDraft;
  _relayDraft = text;
  if (!text.trim()) { showToast('Paste the message first', 'error'); return; }
  var msgs = relaySplit(text);
  var rolls = [], stock = [], other = [];
  msgs.forEach(function(m) {
    var k = relayKind(m.text);
    if (k === 'in' || k === 'out') rolls.push(m);
    else if (k === 'stock') stock.push(m);
    else other.push(m);
  });
  // Production: the pickling hand's loads, the barrel list, a roll's production block (production.js reads them).
  var prod = typeof parseProdPaste === 'function' ? parseProdPaste(text, prodCtx()).filter(function(m) { return m.read.items.length; }) : [];
  var prodLoose = prod.filter(function(m) { return m.kind !== 'roll'; }).length;
  if (!rolls.length && prod.length) { prodOpenPaste(text); return; }
  if (!rolls.length && stock.length) {
    // A stock message belongs to Stock's own review.
    _stockPasteDraft = text;
    _stockView = 'paste';
    switchTab('pageStock');
    stockReadPaste();
    return;
  }
  if (!rolls.length) { showToast('No in-time or out-time roll found in that text', 'error'); return; }
  // Only a roll needs the roster: a stock message goes to Stock above whether or not anyone is on it yet.
  if (!(S.staff || []).length) { showToast('Add the roster first: Staff → Roster', 'error'); return; }
  _relay = { text: text, msgs: rolls, choices: {}, stock: stock.length, other: Math.max(0, other.length - prodLoose), prod: prod.length };
  _relayView = 'review';
  _relayShowLines = false;
  renderAttendance();
  viewTop();
}

function relayMarkText(m) {
  if (m.st === 'A') return 'Absent';
  if (m.st === 'H') return 'Half day';
  var t = (m.inMin != null ? relayClockLabel(m.inMin) + (m.outMin != null ? ' – ' + relayClockLabel(m.outMin) : ' in, out not known') + ' · ' : '') + m.hours + ' h';
  return t + (m.ot ? ' · OT ' + m.ot + ' h' : '');
}

/* The check before saving (§7, Paste message): the stock check's contract — every line beside what it was read
   as, the questions first as callouts with their pickers, each day's marks as rows with a badge for what changes,
   and Save in the action bar with what it will write. */
var RELAY_CHANGE = {
  kept: ['warning', 'Kept'], 'new': ['ok', 'New'], updated: ['info', 'Updated'], same: ['neutral', 'Same']
};
function relayRenderReview() {
  var rv = _relay, plan = relayPlan(rv);
  rv.plan = plan;
  var h = rv.reread ? relayBackBar('invRelayRereadBack', 'Day', 'Read the rolls again') : relayBackBar('invRelayBack', 'Edit text', 'Check before saving');
  if (rv.reread) h += '<div class="inv-callout inv-callout-info inv-mb-8" id="relayRereadNote">' + todoPlural(rv.msgs.length, 'roll') + ' saved for ' + escHtml(formatDate(rv.reread)) +
    ', read as the reader reads them now. On Save every mark and EXTRA row they wrote is replaced by what is read here; what was entered or corrected by hand is kept, and the day as it is now goes to the log.</div>';
  if (plan.dupes) h += '<div class="inv-callout inv-callout-danger inv-mb-8" id="relayDupNote">' + todoPlural(plan.dupes, 'message was', 'messages were') + ' already saved and ' + (plan.dupes === 1 ? 'is' : 'are') + ' left out: saving again would count every hour twice.</div>';
  if (plan.repeats) h += '<div class="inv-callout inv-callout-warning inv-mb-8" id="relayRepeatNote">' + todoPlural(plan.repeats, 'message repeats', 'messages repeat') +
    ' one earlier in ' + (rv.reread ? 'the day’s rolls' : 'this paste') + ' (a roll posted twice) and ' + (plan.repeats === 1 ? 'is' : 'are') + ' read once: read twice, its EXTRA would count twice.</div>';
  if (rv.stock) h += '<div class="inv-callout inv-callout-warning inv-mb-8">The stock message in this paste was not read here. Paste it in More → Stock.</div>';
  if (rv.prod) h += '<div class="inv-callout inv-callout-info inv-mb-8" id="relayProdNote"><div>' + todoPlural(rv.prod, 'message carries', 'messages carry') + ' production (pickling loads, the barrel list, a production block). Attendance is read here; the production is read in Production.</div>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm inv-mt-8" data-action="invRelayToProd">Read in Production</button></div>';
  if (rv.other) h += '<div class="inv-callout inv-callout-warning inv-mb-8">' + todoPlural(rv.other, 'other message') + ' (notes) not read.</div>';
  h += '<div class="inv-tiles inv-tiles-3" id="relayReviewTiles">' +
    '<div class="inv-tile' + (plan.counts.red ? ' inv-tile-danger' : '') + '" data-tile="red"><div class="inv-tile-label">Needs you</div><div class="inv-tile-value">' + plan.counts.red + '</div></div>' +
    '<div class="inv-tile' + (plan.counts.amber ? ' inv-tile-warning' : '') + '" data-tile="amber"><div class="inv-tile-label">Check</div><div class="inv-tile-value">' + plan.counts.amber + '</div></div>' +
    '<div class="inv-tile" data-tile="people"><div class="inv-tile-label">People</div><div class="inv-tile-value">' + plan.counts.people + '</div></div></div>';

  // What needs a decision, first.
  var staff = (S.staff || []).filter(function(w) { return w.active !== false; }).sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); });
  var askedNames = {};
  if (plan.issues.length) {
    h += '<div class="inv-panel inv-panel-flush" id="relayIssues"><div class="inv-panel-head"><span class="inv-panel-title">Questions ' +
      '<span class="inv-panel-count">' + plan.issues.length + '</span></span></div>';
    plan.issues.forEach(function(is) {
      h += '<div class="inv-row inv-row-auto inv-row-top"><div class="inv-row-main">' +
        '<div class="inv-callout inv-callout-' + uiTone(is.tone) + '" data-issue="' + escHtml(is.tone) + '">' + (is.n != null ? 'Line ' + is.n + ': ' : '') + escHtml(is.text) + '</div>';
      // A name not placed, one read as somebody, or one left out: each gets the
      // picker, so a wrong guess is put right here and remembered from then on.
      if (is.key && (is.tone === 'red' || is.tone === 'info' || is.id != null) && !askedNames[is.key]) {
        var key = is.key;
        askedNames[key] = true;
        var sel = key in rv.choices ? String(rv.choices[key]) : (is.id != null ? String(is.id) : '');
        h += '<div class="inv-field inv-mt-8"><label class="inv-field-label" for="relayMap' + escHtml(key) + '">"' + escHtml(is.name) + '" is</label>' +
          '<select id="relayMap' + escHtml(key) + '" class="inv-select" data-relay-map="' + escHtml(key) + '"><option value="">Nobody on the roster (leave out)</option>' +
          staff.map(function(w) { return '<option value="' + escHtml(w.id) + '"' + (sel === String(w.id) ? ' selected' : '') + '>' + escHtml(w.name) + '</option>'; }).join('') +
          '</select></div>';
      }
      h += '</div></div>';
    });
    h += '</div>';
  }

  var marks = 0, extras = 0;
  plan.days.forEach(function(d) {
    var rec = S.attendance && S.attendance[d.iso];
    h += '<div class="inv-panel inv-panel-flush" data-relay-day="' + escHtml(d.iso) + '"><div class="inv-panel-head"><span class="inv-panel-title">' +
      escHtml(attDayName(d.iso)) + ' ' + escHtml(stockShortDate(d.iso)) + '</span>' +
      '<span class="inv-panel-count">' + d.kinds.map(function(k) { return k === 'in' ? 'In-time roll' : 'Out-time roll'; }).join(' + ') +
      (rec ? ' · day already has entries' : '') + '</span></div>';
    if (d.holiday) h += '<div class="inv-panel-body"><div class="inv-callout inv-callout-warning">Holiday: ' + escHtml(d.holiday) + '</div></div>';
    if (d.provisional) h += '<div class="inv-panel-body"><div class="inv-callout inv-callout-info" data-issue="info">No out-time roll yet: present hands are read as out at 5 PM (the gate at 7 PM). Paste the out-time roll when it comes and the hours update.</div></div>';
    d.rows.forEach(function(r) {
      var ch = RELAY_CHANGE[r.change] || RELAY_CHANGE.same;
      var was = r.change === 'kept' ? 'Entered by hand as ' + relayMarkText(r.prev) + '; left as it is.'
        : r.change === 'updated' ? 'Was ' + relayMarkText(r.prev) : '';
      if (r.change === 'new' || r.change === 'updated') marks++;
      var absent = r.next.st === 'A';
      h += '<div class="inv-row inv-row-2" data-relay-row data-st="' + escHtml(r.next.st) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(r.w.name) + '</span>' +
        '<span class="inv-row-meta">' + (absent ? '<span class="inv-dot inv-dot-danger">Absent</span>' : escHtml(areaLabel(r.next.area))) + '</span>' +
        (was ? '<span class="inv-row-meta inv-row-wrap">' + escHtml(was) + '</span>' : '') + '</span>' +
        '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + escHtml(absent ? '—' : relayMarkText(r.next)) + '</span>' +
        '<span class="inv-badge inv-badge-' + ch[0] + '">' + ch[1] + '</span></span></span></div>';
    });
    // Read again: a mark the rolls wrote before and no longer read goes on Save.
    (d.removed || []).forEach(function(r) {
      h += '<div class="inv-row inv-row-2 inv-row-muted" data-relay-removed><span class="inv-row-main"><span class="inv-row-title">' + escHtml(r.w.name) + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">Written by the rolls before as ' + escHtml(relayMarkText(r.prev)) + '; the rolls do not read this hand now.</span></span>' +
        '<span class="inv-row-end"><span class="inv-badge inv-badge-warning">Taken off</span></span></div>';
    });
    var what = function(e) {
      return e.kind !== 'block' ? relayAreaName(e.area) + ', general shift'
        : 'Block ' + relayClockLabel(relayParseHhmm(e.from)) + ' – ' + (e.to ? relayClockLabel(relayParseHhmm(e.to)) : '?') +
          (extraAreas(e).length ? ', ' + extraAreas(e).map(relayAreaName).join(' + ') : '') + ', crew ' + ((e.crew || []).length ? e.crew.map(function(id) { var w = staffById(id); return w ? w.name : '?'; }).join(', ') : 'not named');
    };
    if (d.extras.length || d.replaced.length) {
      h += '<div class="inv-row-group">EXTRA hours</div>';
      d.extras.forEach(function(x) {
        var e = x.row, off = x.dup || x.kept;
        if (!off) extras++;
        h += '<div class="inv-row inv-row-auto' + (off ? ' inv-row-muted' : '') + '" data-relay-extra' + (x.kept ? ' data-kept' : '') + '><span class="inv-row-main inv-row-wrap">' + escHtml(what(e)) +
          (x.dup ? ' · already on the day, not added again' : x.kept ? ' · the day\'s row for this slot was entered or corrected by hand: kept, this is not added' : '') +
          '</span><span class="inv-row-end inv-num">' + e.hours + ' h</span></div>';
      });
      // What the roll wrote before for a slot it now covers, and no longer carries: taken off on Save, and said so.
      d.replaced.forEach(function(e) {
        h += '<div class="inv-row inv-row-auto inv-row-muted" data-relay-replaced><span class="inv-row-main inv-row-wrap">' + escHtml(what(e)) +
          (rv.reread ? ' · written by the rolls before: replaced by what they read now' : ' · on the day from an earlier paste of this roll: replaced') +
          '</span><span class="inv-row-end inv-num">' + e.hours + ' h</span></div>';
      });
    }
    if (d.notes.length) h += '<div class="inv-panel-body inv-note">Also in the roll (kept as the day\'s note): ' + escHtml(d.notes.slice(0, 8).join(' · ')) + (d.notes.length > 8 ? '…' : '') + '</div>';
    h += '</div>';
  });

  h += '<div class="inv-panel inv-panel-flush" id="relayLines"><div class="inv-panel-head"><span class="inv-panel-title">The message, line by line ' +
    '<span class="inv-panel-count">' + plan.lines.length + '</span></span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invRelayLines" aria-expanded="' + _relayShowLines + '">' + (_relayShowLines ? 'Hide' : 'Show') + '</button></div>';
  if (_relayShowLines) {
    h += plan.lines.map(function(l) {
      var tone = l.role === 'unknown' ? 'danger' : l.role === 'extra' ? 'info' : '';
      return '<div class="inv-row inv-row-auto" data-line-role="' + escHtml(l.role) + '"><div class="inv-row-main"><div class="inv-quote">' + escHtml(l.raw.trim()) + '</div>' +
        '<div class="inv-row-meta inv-row-wrap inv-mt-4">' + (tone ? '<span class="inv-dot inv-dot-' + tone + '">' + escHtml(l.read) + '</span>' : escHtml(l.read)) + '</div></div></div>';
    }).join('');
  }
  h += '</div>';

  var nothing = !plan.days.length;
  h += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">' + todoPlural(marks, 'mark') + ' · ' + todoPlural(extras, 'EXTRA row') + '</div>' +
    '<div class="inv-actionbar-value">' + todoPlural(plan.days.length, 'day') + '</div></div>' +
    '<button class="inv-btn inv-btn-primary" data-action="invRelaySave"' + (nothing ? ' disabled' : '') + '>Save ' + todoPlural(plan.days.length, 'day') + '</button></div>';
  return h;
}
function relayParseHhmm(s) {
  var m = String(s || '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? +m[1] * 60 + +m[2] : null;
}

function relaySave() {
  var rv = _relay;
  if (!rv) return;
  if (!grdGate('floor', 'save attendance', relaySave)) return;   // the guard (guard.js): a floor entry, never re-asked
  var plan = relayPlan(rv);
  if (!plan.days.length) { showToast('Nothing to save', 'error'); return; }
  // Placements were remembered as they were made. A spelling READ AS somebody
  // and saved without correction is the owner's confirmation: remember it too,
  // so the next roll matches it outright.
  plan.issues.forEach(function(is) {
    if (is.tone === 'amber' && is.key && is.id != null && !(is.key in rv.choices)) relayRemember(is.key, is.id);
  });
  var marks = 0, extras = 0;
  plan.days.forEach(function(d) {
    // Read again, the day is rebuilt: it goes to the log as it was, and starts over from what was entered by hand.
    var rec = rv.reread ? relayRereadBase(d.iso) : attDay(d.iso, true);
    d.rows.forEach(function(r) {
      if (r.change === 'kept' || (r.change === 'same' && !rv.reread)) return;
      var n = r.next;
      rec.marks[r.w.id] = { st: n.st, ot: n.ot, hours: n.hours, area: n.area, inMin: n.inMin, outMin: n.outMin, outKnown: !!n.outKnown, src: 'relay' };
      marks++;
    });
    if (d.replaced.length && !rv.reread) rec.extra = rec.extra.filter(function(e) { return d.replaced.indexOf(e) < 0; });
    d.extras.forEach(function(x) { if (!x.dup && !x.kept) { rec.extra.push(x.row); extras++; } });
    var add = [];
    if (d.holiday) add.push('Holiday: ' + d.holiday);
    if (d.notes.length) add.push(d.notes.join(' · '));
    add.forEach(function(a) { if (String(rec.note || '').indexOf(a) < 0) rec.note = (rec.note ? rec.note + '\n' : '') + a; });
    _attPrune(d.iso);
  });
  var at = Date.now();
  // Read again, the rolls are already on record. A roll that saved no day (no date to put it on) is not recorded: kept, it
  // refused the same roll pasted again with the date it lacked.
  if (!rv.reread) rv.msgs.forEach(function(m) {
    var ds = m.parsed ? Object.keys(m.parsed.days).filter(function(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }) : [];
    if (m.dup || m.repeat || !ds.length) return;
    // The days it saved (a roll can carry a second day's block): a day deleted by hand takes its rolls with it (attDeleteDay).
    relayPastes().push({ id: 'RP-' + at.toString(36) + Math.random().toString(36).slice(2, 5), at: at, hash: relayHash(m.text),
      sentBy: m.sentBy || '', sentOn: m.sentOn || '', kind: m.parsed ? m.parsed.kind : '', date: m.parsed ? m.parsed.date : '', days: ds, text: m.text });
  });
  saveState();
  var first = plan.days[0].iso, reread = !!rv.reread;
  _relay = null; _relayView = 'paste';
  if (!reread) _relayDraft = '';
  _attDate = first; _attView = 'day';
  renderAttendance();
  viewTop();
  showToast((reread ? 'Read again: ' : 'Saved ' + todoPlural(plan.days.length, 'day') + ': ') + todoPlural(marks, 'mark') + ', ' + todoPlural(extras, 'EXTRA row') +
    (reread ? '; the day as it was is in the log' : ''));
}

/* ===== Read the rolls again (Staff → Day) =====
   The rolls a day was saved from are kept whole (S.relayPastes). A reader fixed since they were pasted reads them right
   only if they are read again, and the owner's book held the wrong reading of three days (22, 23 and 25 Sep 2026: hands
   at 21–36 hours off an 8 PM heading, "EXTRA 5 PM TO 6 AM" as 5 hours). So the day's rolls go back through the same check,
   in the order they were saved, and Save replaces what they wrote: a mark or EXTRA row the rolls wrote (`src: 'relay'`)
   is read afresh, one entered or corrected by hand is kept, and the day as it was goes to the deletion log with the
   reason "read the rolls again". The refusal of a roll already saved is not for this. */
function relayRollsFor(iso) {
  var roster = null;
  return relayPastes().filter(function(p) {
    if (!p || (p.kind !== 'in' && p.kind !== 'out')) return false;
    if (p.date === iso || (Array.isArray(p.days) && p.days.indexOf(iso) >= 0)) return true;
    if (Array.isArray(p.days)) return false;
    // Saved before the days were kept on the roll: one dated another day that carries this day's block is read to see.
    roster = roster || relayRoster({}, iso);
    return !!parseRelayRoll(p.text, roster, p.sentOn || null).days[iso];
  }).map(function(p, i) { return { p: p, i: i }; }).sort(function(a, b) { return (a.p.at || 0) - (b.p.at || 0) || a.i - b.i; }).map(function(x) { return x.p; });
}
/* Whether Day shows the action: a cheap test, drawn on every render (a roll saved before its days were kept is found by
   its own date). */
function relayDayHasRolls(iso) {
  return relayPastes().some(function(p) { return p && (p.kind === 'in' || p.kind === 'out') && (p.date === iso || (Array.isArray(p.days) && p.days.indexOf(iso) >= 0)); });
}
async function relayRereadOpen(iso) {
  var rolls = relayRollsFor(iso);
  if (!rolls.length) { showToast('No roll is saved for ' + formatDate(iso), 'error'); return; }
  var ok = await uiConfirm({ title: 'Read the rolls again?', okLabel: 'Read again',
    body: 'The ' + todoPlural(rolls.length, 'roll') + ' saved for ' + formatDate(iso) + ' ' + (rolls.length === 1 ? 'is' : 'are') +
      ' read again as the reader reads them now. You check what is read before anything is saved. On Save, the marks and EXTRA rows the rolls wrote are replaced; ' +
      'what was entered or corrected by hand is kept, and the day as it is now goes to the log.' });
  if (!ok) return;
  _relay = { text: rolls.map(function(p) { return p.text; }).join('\n\n'), reread: iso, choices: {}, stock: 0, other: 0, prod: 0,
    msgs: rolls.map(function(p) { return { sentBy: p.sentBy || '', sentOn: p.sentOn || null, text: p.text }; }) };
  _relayView = 'review';
  _relayShowLines = false;
  _attView = 'paste';
  renderAttendance();
  viewTop();
}
/* The day as it was goes to the log whole; what comes back is only what was entered or corrected by hand. */
function relayRereadBase(iso) {
  if (!(S.attendance || {})[iso]) return attDay(iso, true);
  var was = attDeleteRecord(iso, 'read the rolls again', 'reread').day, rec = attDay(iso, true);
  var copy = function(o) { return JSON.parse(JSON.stringify(o)); };
  Object.keys(was).forEach(function(k) { if (k !== 'marks' && k !== 'extra') rec[k] = copy(was[k]); });
  Object.keys(was.marks || {}).forEach(function(id) { if (was.marks[id] && was.marks[id].src !== 'relay') rec.marks[id] = copy(was.marks[id]); });
  rec.extra = (was.extra || []).filter(function(x) { return x && x.src !== 'relay'; }).map(copy);
  return rec;
}

function relayAction(action, btn) {
  switch (action) {
    case 'invRelayRead': relayRead(); break;
    case 'invRelayToProd': prodOpenPaste(_relay ? _relay.text : _relayDraft); break;
    case 'invRelayBack': _relayView = 'paste'; renderAttendance(); break;
    case 'invRelaySave': relaySave(); break;
    case 'invRelayReread': relayRereadOpen(_attDate); break;
    // Back from a day's rolls read again is back to the day, and the reading is dropped: Paste message opens empty.
    case 'invRelayRereadBack': _relay = null; _relayView = 'paste'; _attView = 'day'; renderAttendance(); viewTop(); break;
    case 'invRelayLines': _relayShowLines = !_relayShowLines; renderAttendance(); break;
    case 'invRelayForget': {
      var L = relayLearnData();
      if (L[btn.dataset.kind]) { delete L[btn.dataset.kind][btn.dataset.key]; saveState(); showToast('Forgotten'); renderAttendance(); }
      break;
    }
  }
}
function relayOnChange(t) {
  if (!t || !t.hasAttribute || !t.hasAttribute('data-relay-map') || !_relay) return false;
  var key = t.getAttribute('data-relay-map');
  _relay.choices[key] = t.value;
  // Kept on the worker at once, not only on Save: a placement is a fact about
  // the name, whether or not this paste is ever saved.
  if (relayRemember(key, t.value)) saveState();
  renderAttendance();
  return true;
}
function relayOnInput(t) {
  if (!t || t.id !== 'relayPasteText') return false;
  _relayDraft = t.value;
  return true;
}
