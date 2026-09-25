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

function relayIso(d, m, y) {
  d = +d; m = +m; y = +y;
  if (y < 100) y += 2000;
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return null;
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
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
  if (/COLOU?R/.test(k) && !out.length) out.push('vat-a1');
  return out;
}

/* The roster, indexed for the relay: canonical key, every alias the owner has
   confirmed once, and the first word of a two-word name ("sunil mahto"). */
function relayRosterIndex(roster) {
  var byKey = {}, list = [];
  (roster || []).forEach(function(w) {
    var keys = [w.name].concat(w.relayNames || [], w.aliases || []);
    keys.forEach(function(n) {
      var k = relayKey(n);
      if (k && !byKey[k]) byKey[k] = w;
    });
    list.push(w);
  });
  return { byKey: byKey, list: list };
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
/* A name as written → the worker, and how sure. Exact (or a remembered
   spelling) is sure; one letter off on a name of five or more, same first
   letter, is READ AS and flagged; anything else is not guessed. */
function relayMatchName(words, idx) {
  // Only leading words of letters can be a name: "SHYAM 5 PM" is Shyam at 5.
  var alpha = 0;
  while (alpha < words.length && alpha < 3 && /^[A-Za-z.]+$/.test(words[alpha])) alpha++;
  for (var n = alpha; n >= 1; n--) {
    var k = relayKey(words.slice(0, n).join(''));
    if (k && idx.byKey[k]) return { w: idx.byKey[k], used: n, sure: true };
  }
  var k1 = relayKey(words[0]);
  if (k1.length >= 4) {
    var best = null, bestD = 9, tie = false;
    Object.keys(idx.byKey).forEach(function(key) {
      if (key[0] !== k1[0]) return;
      var d = relayEdit(k1, key), lim = k1.length >= 7 ? 2 : 1;
      if (d > lim) return;
      if (d < bestD) { best = idx.byKey[key]; bestD = d; tie = false; }
      else if (d === bestD && idx.byKey[key] !== best) tie = true;
    });
    if (best && !tie) return { w: best, used: 1, sure: false };
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
      cur = { sentBy: wa[4].trim(), sentOn: monthFirst ? relayIso(b, a, wa[3]) : relayIso(a, b, wa[3]), lines: [wa[5]] };
      msgs.push(cur);
      return;
    }
    // A roll pasted without its WhatsApp line still opens with its own dated
    // header ("24/09/26/ out time"); that line starts a new message.
    var rollHead = /^\s*\d{1,2}\/\d{1,2}\/\d{2,4}\/*\s*(in|out)\s*-*\s*time/i.test(line);
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
  var lines = String(text || '').split('\n');
  var out = { kind: relayKind(text), date: null, days: {}, lines: [], issues: [] };
  var first = lines[0] || '';
  var dm = first.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  out.date = dm ? relayIso(dm[1], dm[2], dm[3]) : (sentOn || null);
  if (!dm) out.issues.push({ tone: 'amber', text: 'The roll carries no date; read as the day it was sent.' });
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

  lines.slice(1).forEach(function(raw, i) {
    var ln = { n: i + 2, raw: raw, role: '', read: '' };
    var line = raw.trim();
    var bare = line.replace(/^[\s\-_=*.•]+|[\s\-_=*.•]+$/g, '').trim();
    if (!bare || st.stop) return;
    out.lines.push(ln);

    // A date inside the roll: a holiday, or a second day's block ("16/08/26/ Sunday").
    var dd = bare.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?\s*(.*)$/);
    if (dd) {
      var iso2 = relayIso(dd[1], dd[2], dd[3]);
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

    // EXTRA hours: booked to the section it sits in.
    var ex = bare.match(/\bextra\b\W*(\d+(?:\.\d+)?)\s*(?:h|$)/i) || bare.match(/\bextra\b\W*(\d+(?:\.\d+)?)/i);
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
      if (general && sec.areas.length) {
        row = { kind: 'coverage', area: sec.areas[0], hours: hrs };
        ln.read = 'EXTRA ' + hrs + ' h booked to ' + relayAreaName(sec.areas[0]);
      } else {
        var from = st.mode === 'out' || (st.slot && st.slot.start >= RELAY_GENERAL_OUT) ? RELAY_GENERAL_OUT : (st.slot && st.slot.start != null ? st.slot.start : RELAY_MORNING);
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
        var bAreas = sec.areas.length === 2 && sec.areas[0] === 'barrel' ? ['pickling-barrel'] : sec.areas.slice();
        row = { kind: 'block', areas: bAreas, crew: crewNames, hours: hrs, from: relayHhmm(from), to: to == null ? '' : relayHhmm(to) };
        ln.read = 'EXTRA ' + hrs + ' h, block ' + relayClockLabel(from) + ' – ' + (to == null ? '?' : relayClockLabel(to)) +
          (row.areas.length ? ', ' + row.areas.map(relayAreaName).join(' + ') : ', no line named') + ', crew ' + (row.crew.length ? row.crew.length : 'not named');
        if (!row.crew.length) out.issues.push({ tone: 'amber', n: ln.n, text: 'EXTRA ' + hrs + ' h has no crew named under it; it is kept, and reads Not checkable on the Areas card.' });
      }
      if (flagged) out.issues.push({ tone: 'amber', n: ln.n, text: 'EXTRA ' + hrs + ' h sits under the production notes; read against the last line above them.' });
      ln.role = 'extra';
      day(st.iso).extra.push(row);
      // The tag closes its group: names after it are the next crew.
      var keep = sec.areas.slice(), was = sec.slotOnly;
      newSection(keep, null); st.sec.slotOnly = was; st.sec.headText = '';
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
    var body = numbered ? numbered[2].trim() : bare;
    var words = body.split(/[\s\-–,]+/).filter(Boolean);
    var hit = words.length && /^[A-Za-z]/.test(words[0]) ? relayMatchName(words, idx) : null;
    var isHeaderish = !numbered && !hit && relaySlotOrArea(bare);

    if (!hit && !numbered && isHeaderish) {
      var kindH = isHeaderish;
      if (kindH.slot) {
        if (st.mode === 'out') st.slot = { start: null, end: kindH.end != null ? kindH.end : (kindH.single != null ? kindH.single : null), label: bare, rangeStart: kindH.start };
        else {
          var sStart = kindH.start;
          // A slot ahead of the 8:30 shift on an in-time roll is the morning: the
          // relay has headed it "6:00 pm" before, and BM ruled that a mislabel.
          if (sStart != null && sStart >= 960 && sStart <= 1200 && !st.sawGeneral && out.kind === 'in' && /8\s*:\s*30/.test(lines.slice(i + 2).join(' '))) {
            sStart -= 720;
            out.issues.push({ tone: 'amber', n: ln.n, text: '"' + bare + '" comes before the 8:30 shift, so it is read as ' + relayClockLabel(sStart) + '.' });
          }
          if (sStart === RELAY_GENERAL) st.sawGeneral = true;
          st.slot = { start: sStart, end: kindH.end, label: bare };
          kindH.start = sStart;
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
        lastRow.areas = kindH.areas.length === 2 && kindH.areas[0] === 'barrel' ? ['pickling-barrel'] : kindH.areas.slice();
        ln.role = 'head'; ln.read = 'The block above ran on ' + lastRow.areas.map(relayAreaName).join(' + ');
        return;
      }
      newSection(kindH.areas || [], { absent: kindH.absent });
      st.sec.headText = bare;
      ln.role = 'head';
      ln.read = kindH.absent ? 'Absent' : (kindH.areas.length ? kindH.areas.map(relayAreaName).join(' + ') : 'Section');
      return;
    }

    if (!hit) {
      ln.role = numbered ? 'unknown' : 'note';
      ln.read = numbered ? 'Not on the roster: ' + words.slice(0, 2).join(' ') : 'Note (not a name)';
      if (numbered) out.issues.push({ tone: 'red', n: ln.n, text: '"' + words.slice(0, 2).join(' ') + '" is not on the roster. Pick who it is, or it is left out.', name: words[0] || '' });
      else day(st.iso).notes.push(bare);
      if (numbered) ln.unknown = words[0] || '';
      return;
    }

    // A person.
    var w = hit.w;
    var rest = words.slice(hit.used).join(' ');
    var p = day(st.iso).people[w.id] || (day(st.iso).people[w.id] = { id: w.id, name: w.name, st: 'P', areas: null, generalArea: null, inExp: null, inSlot: null, outExp: null, outSlot: null, lines: [], readAs: '' });
    p.lines.push(ln.n);
    if (!hit.sure) { p.readAs = words[0]; out.issues.push({ tone: 'amber', n: ln.n, text: '"' + words[0] + '" read as ' + w.name + '.', name: words[0], id: w.id }); }
    var absent = (st.sec && st.sec.absent) || /\babsent\b|^A+\b|\bA$/i.test(rest);
    var tms = relayTimes(rest);
    if (absent) {
      p.st = 'A';
    } else {
      if (!st.sec || st.sec.prod) { newSection(st.sec && st.sec.prod ? [] : [], null); st.sec.slotOnly = true; }
      st.sec.crew.push(w.name);
      st.sec.crewIds.push(w.id);
      var areas = st.sec ? st.sec.areas : [];
      if (areas.length) {
        var a = areas.indexOf(w.area) >= 0 ? w.area : areas[0];
        // The office and the gate share a header ("office & gate keeper"); a
        // hand whose post is one of them stands at his own.
        if ((a === 'office' || a === 'gate') && (w.area === 'office' || w.area === 'gate')) a = w.area;
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
      }
      p.st = 'P';
    }
    ln.role = 'name';
    ln.person = w.id;
    ln.read = w.name + (absent ? ': absent' : '') + (hit.sure ? '' : ' (read from "' + words[0] + '")');
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
  var slotWords = ['OUT', 'TIME', 'IN', 'AM', 'PM', 'NIGHT', 'HOLD', 'MORNING', 'OT', 'GENERAL', 'GANRAL', 'SHIFT', 'SHIPT', 'EVENING', 'M', 'P', 'A'];
  var areas = relayHeaderAreas(bare);
  var absent = /ABSENT/.test(up);
  if (times.length && !absent) {
    var start = times[0].min, end = times.length > 1 ? relayOutMin(times[1]) : null;
    if (words.every(function(w) { return slotWords.indexOf(w) >= 0; }) || areas.length) return { slot: true, start: start, end: end, single: relayOutMin(times[0]), areas: areas };
  }
  if (/MORNING/.test(up)) return { slot: true, start: RELAY_MORNING, end: RELAY_GENERAL, areas: areas };
  if (/G[AE]N[AE]?RAL/.test(up)) return { slot: true, start: RELAY_GENERAL, end: RELAY_GENERAL_OUT, areas: areas };
  if (/NIGHT/.test(up)) return { slot: true, start: RELAY_GENERAL_OUT, end: 1440 + RELAY_MORNING, areas: areas };
  if (absent) return { absent: true, areas: [] };
  if (/\b(MONTHLY|WEEKLY)\b/.test(up) && words.length <= 2) return { areas: [] };
  if (areas.length) return { areas: areas };
  return null;
}

/* The per-person reading → marks the Staff tab keeps. `comp` decides hours
   versus OT, so the roster is consulted here too. `outKnown` says whether an
   out-time roll has been read for the day: without one a present hand is
   provisionally out at 5 PM, and the review says so. */
function relayPersonMark(p, w, restOut) {
  if (p.st === 'A') return { st: 'A', ot: 0, hours: 0, area: 'flex', inMin: null, outMin: null };
  // No line written: a floor hand floats (Flex); the office and the gate are posts.
  var area = p.generalArea || p.areas || (w && (w.area === 'office' || w.area === 'gate') ? w.area : 'flex');
  var gate = area === 'gate';
  var inMin, outMin;
  if (gate) {
    inMin = p.inExp != null ? p.inExp : RELAY_GATE[0];
    outMin = p.outExp != null ? p.outExp : RELAY_GATE[1];
  } else {
    inMin = relayMin(p.inExp, p.inSlot);
    if (inMin == null) inMin = RELAY_GENERAL;
    outMin = p.outExp != null ? p.outExp : p.outSlot != null ? p.outSlot : (restOut != null ? restOut : RELAY_GENERAL_OUT);
  }
  if (outMin <= inMin) outMin += 1440;
  var hours = Math.max(0, Math.floor((outMin - inMin) / 60));
  var hourly = w && w.comp === 'hourly';
  // The gate's twelve hours are its standing shift, not overtime.
  return { st: 'P', ot: hourly || gate ? 0 : Math.max(0, hours - 8), hours: hours, area: area, inMin: inMin, outMin: outMin };
}

/* ===== Screens: Staff → Paste message ===== */
var _relay = null;        // { text, msgs, choices: { KEY: workerId }, plan, other }
var _relayDraft = '';
var _relayView = 'paste';  // 'paste' | 'review'
var _relayShowLines = false;

function relayRoster(choices) {
  var extra = {};
  Object.keys(choices || {}).forEach(function(k) { if (choices[k]) (extra[choices[k]] = extra[choices[k]] || []).push(k); });
  return (S.staff || []).filter(function(w) { return w.active !== false; }).map(function(w) {
    return { id: w.id, name: w.name, comp: w.comp, area: w.area, relayNames: (w.relayNames || []).concat(extra[w.id] || []) };
  });
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

/* Everything the paste would do, worked out without touching S. */
function relayPlan(rv) {
  var roster = relayRoster(rv.choices), byId = {};
  roster.forEach(function(w) { byId[w.id] = w; });
  var days = {}, issues = [], lines = [], dupes = 0;
  rv.msgs.forEach(function(m, mi) {
    var r = parseRelayRoll(m.text, roster, m.sentOn);
    m.parsed = r;
    m.dup = relayPastes().find(function(p) { return p.hash === relayHash(m.text); }) || null;
    if (m.dup) { dupes++; return; }
    r.issues.forEach(function(is) { is.mi = mi; issues.push(is); });
    r.lines.forEach(function(l) { l.mi = mi; lines.push(l); });
    Object.keys(r.days).forEach(function(iso) {
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
  var out = { days: [], issues: issues, lines: lines, dupes: dupes, counts: { red: 0, amber: 0, people: 0 } };
  issues.forEach(function(is) { if (is.tone === 'red') out.counts.red++; else out.counts.amber++; });
  Object.keys(days).sort().forEach(function(iso) {
    var t = days[iso], rec = S.attendance && S.attendance[iso];
    var rows = [];
    Object.keys(t.people).forEach(function(id) {
      var p = t.people[id], w = byId[id], prev = rec && rec.marks ? rec.marks[id] : null;
      if (prev && prev.src !== 'relay') { rows.push({ w: w, p: p, prev: prev, next: prev, change: 'kept' }); return; }
      var q = JSON.parse(JSON.stringify(p));
      if (prev && prev.st === 'P' && q.st === 'P') {
        if (prev.inMin != null) q.inExp = relayMin(q.inExp, prev.inMin);
        if (q.outExp == null && q.outSlot == null && prev.outKnown) q.outExp = prev.outMin;
        if (!q.generalArea && !q.areas && prev.area) q.areas = prev.area;
      }
      var next = relayPersonMark(q, w, t.restOut);
      next.outKnown = q.outExp != null || q.outSlot != null || t.restOut != null || t.kinds.indexOf('out') >= 0;
      var same = prev && prev.st === next.st && prev.area === next.area && prev.hours === next.hours && prev.ot === next.ot;
      rows.push({ w: w, p: p, prev: prev, next: next, change: !prev ? 'new' : same ? 'same' : 'updated' });
    });
    // Present hands already on the day that this out-roll left unnamed: out with the shift.
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
      var dup = rec && (rec.extra || []).some(function(e) { return relayExtraSame(e, row); });
      return { row: row, dup: !!dup };
    });
    var provisional = t.kinds.indexOf('out') < 0 && rows.some(function(r) { return r.next.st === 'P' && r.change !== 'kept'; });
    out.days.push({ iso: iso, rows: rows, extras: extras, holiday: t.holiday, notes: t.notes, kinds: t.kinds, provisional: provisional });
  });
  return out;
}
function relayExtraSame(a, b) {
  if (a.kind !== b.kind || a.hours !== b.hours) return false;
  if (a.kind === 'coverage') return a.area === b.area;
  return a.from === b.from && a.to === b.to && (a.crew || []).slice().sort().join() === (b.crew || []).slice().sort().join();
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

function relayRenderView() {
  if (_relayView === 'review' && _relay) return relayRenderReview();
  return '<div class="inv-stk-bar"><div class="inv-stk-h2">Paste a WhatsApp message</div></div>' +
    '<label class="inv-stk-label" for="relayPasteText">The in-time or out-time roll, as sent (the stock message works here too)</label>' +
    '<textarea id="relayPasteText" class="inv-stk-paste" spellcheck="false" placeholder="Copy the message in WhatsApp and paste it here. Several at once is fine.">' +
    escHtml(_relayDraft) + '</textarea>' +
    '<button class="inv-stk-btn inv-stk-btn-pri inv-stk-btn-block" data-action="invRelayRead">Read message</button>' +
    '<div class="inv-stk-hint">Nothing is saved until you check what was read. Names are matched to the roster; a name it cannot place is asked about once and remembered.</div>';
}

function relayRead() {
  var ta = document.getElementById('relayPasteText');
  var text = ta ? ta.value : _relayDraft;
  _relayDraft = text;
  if (!text.trim()) { showToast('Paste the message first', 'error'); return; }
  if (!(S.staff || []).length) { showToast('Add the roster first: Staff → Roster', 'error'); return; }
  var msgs = relaySplit(text);
  var rolls = [], stock = [], other = [];
  msgs.forEach(function(m) {
    var k = relayKind(m.text);
    if (k === 'in' || k === 'out') rolls.push(m);
    else if (k === 'stock') stock.push(m);
    else other.push(m);
  });
  if (!rolls.length && stock.length) {
    // A stock message belongs to Stock's own review.
    _stockPasteDraft = text;
    _stockView = 'paste';
    switchTab('pageStock');
    stockReadPaste();
    return;
  }
  if (!rolls.length) { showToast('No in-time or out-time roll found in that text', 'error'); return; }
  _relay = { text: text, msgs: rolls, choices: {}, stock: stock.length, other: other.length };
  _relayView = 'review';
  _relayShowLines = false;
  renderAttendance();
  window.scrollTo(0, 0);
}

function relayMarkText(m) {
  if (m.st === 'A') return 'Absent';
  if (m.st === 'H') return 'Half day';
  var t = (m.inMin != null ? relayClockLabel(m.inMin) + ' – ' + relayClockLabel(m.outMin) + ' · ' : '') + m.hours + ' h';
  return t + (m.ot ? ' · OT ' + m.ot + ' h' : '');
}

function relayRenderReview() {
  var rv = _relay, plan = relayPlan(rv);
  rv.plan = plan;
  var h = '<div class="inv-stk-bar"><button class="inv-stk-back" data-action="invRelayBack">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>Edit text</button>' +
    '<div class="inv-stk-h2">Check before saving</div></div>';
  if (plan.dupes) h += '<div class="inv-stk-banner inv-stk-banner-red">' + todoPlural(plan.dupes, 'message was', 'messages were') + ' already saved and ' + (plan.dupes === 1 ? 'is' : 'are') + ' left out: saving again would count every hour twice.</div>';
  if (rv.stock) h += '<div class="inv-stk-banner">The stock message in this paste was not read here. Paste it in More → Stock.</div>';
  if (rv.other) h += '<div class="inv-stk-banner">' + todoPlural(rv.other, 'other message') + ' (pickling log, notes) not read.</div>';
  h += '<div class="inv-stk-sum inv-rl-sum">' +
    '<div class="inv-stk-tile inv-stk-tile-red"><span class="inv-stk-tile-n">' + plan.counts.red + '</span>Needs you</div>' +
    '<div class="inv-stk-tile inv-stk-tile-amber"><span class="inv-stk-tile-n">' + plan.counts.amber + '</span>Check</div>' +
    '<div class="inv-stk-tile"><span class="inv-stk-tile-n">' + plan.counts.people + '</span>People</div></div>';

  // What needs a decision, first.
  var staff = (S.staff || []).filter(function(w) { return w.active !== false; }).sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); });
  var askedNames = {};
  plan.issues.forEach(function(is) {
    h += '<div class="inv-stk-issue inv-stk-issue-' + is.tone + '">Line ' + is.n + ': ' + escHtml(is.text) + '</div>';
    if (is.tone === 'red' && is.name) {
      var key = relayKey(is.name);
      if (askedNames[key]) return;
      askedNames[key] = true;
      h += '<div class="inv-stk-map"><label class="inv-stk-label" for="relayMap' + escHtml(key) + '">"' + escHtml(is.name) + '" is</label>' +
        '<select id="relayMap' + escHtml(key) + '" class="inv-form-input" data-relay-map="' + escHtml(key) + '"><option value="">Nobody on the roster (leave out)</option>' +
        staff.map(function(w) { return '<option value="' + escHtml(w.id) + '"' + (String(rv.choices[key]) === String(w.id) ? ' selected' : '') + '>' + escHtml(w.name) + '</option>'; }).join('') +
        '</select></div>';
    }
  });

  plan.days.forEach(function(d) {
    var rec = S.attendance && S.attendance[d.iso];
    h += '<div class="inv-rl-day"><div class="inv-rl-dayhead"><span class="inv-stk-h2">' + escHtml(attDayName(d.iso)) + ' ' + escHtml(stockShortDate(d.iso)) + '</span>' +
      '<span class="inv-stk-meta">' + d.kinds.map(function(k) { return k === 'in' ? 'In-time roll' : 'Out-time roll'; }).join(' + ') +
      (rec ? ' · day already has entries' : '') + '</span></div>';
    if (d.holiday) h += '<div class="inv-stk-banner">Holiday: ' + escHtml(d.holiday) + '</div>';
    if (d.provisional) h += '<div class="inv-stk-issue inv-stk-issue-info">No out-time roll yet: present hands are read as out at 5 PM (the gate at 7 PM). Paste the out-time roll when it comes and the hours update.</div>';
    h += '<div class="inv-rl-rows">';
    d.rows.forEach(function(r) {
      var chip = r.change === 'kept' ? ['Kept', 'amber', 'Entered by hand as ' + relayMarkText(r.prev) + '; left as it is.']
        : r.change === 'new' ? ['New', 'ok', ''] : r.change === 'updated' ? ['Updated', 'bath', 'Was ' + relayMarkText(r.prev)] : ['Same', '', ''];
      h += '<div class="inv-rl-row inv-rl-row-' + r.next.st + '"><div class="inv-rl-row-main"><span class="inv-rl-name">' + escHtml(r.w.name) + '</span>' +
        '<span class="inv-rl-area">' + escHtml(r.next.st === 'A' ? 'Absent' : areaLabel(r.next.area)) + '</span></div>' +
        '<div class="inv-rl-row-side"><span class="inv-rl-hrs">' + escHtml(r.next.st === 'A' ? '—' : relayMarkText(r.next)) + '</span>' +
        '<span class="inv-stk-chip' + (chip[1] ? ' inv-stk-chip-' + chip[1] : '') + '">' + chip[0] + '</span></div>' +
        (chip[2] ? '<div class="inv-rl-was">' + escHtml(chip[2]) + '</div>' : '') + '</div>';
    });
    h += '</div>';
    if (d.extras.length) {
      h += '<div class="inv-stk-label inv-mt-8">EXTRA hours</div>';
      d.extras.forEach(function(x) {
        var e = x.row;
        var what = e.kind === 'coverage' ? relayAreaName(e.area) + ', general shift'
          : 'Block ' + relayClockLabel(relayParseHhmm(e.from)) + ' – ' + (e.to ? relayClockLabel(relayParseHhmm(e.to)) : '?') +
            (e.areas.length ? ', ' + e.areas.map(relayAreaName).join(' + ') : '') + ', crew ' + (e.crew.length ? e.crew.map(function(id) { var w = staffById(id); return w ? w.name : '?'; }).join(', ') : 'not named');
        h += '<div class="inv-rl-extra' + (x.dup ? ' inv-rl-extra-dup' : '') + '"><strong>' + e.hours + ' h</strong> ' + escHtml(what) + (x.dup ? ' · already on the day, not added again' : '') + '</div>';
      });
    }
    if (d.notes.length) h += '<div class="inv-stk-hint">Also in the roll (kept as the day\'s note): ' + escHtml(d.notes.slice(0, 8).join(' · ')) + (d.notes.length > 8 ? '…' : '') + '</div>';
    h += '</div>';
  });

  h += '<button class="inv-td-fold" data-action="invRelayLines" aria-expanded="' + _relayShowLines + '"><span>The message, line by line</span><span>' + (_relayShowLines ? 'Hide' : 'Show') + '</span></button>';
  if (_relayShowLines) {
    h += '<div class="inv-rl-lines">' + plan.lines.map(function(l) {
      return '<div class="inv-rl-line inv-rl-line-' + l.role + '"><span class="inv-rl-raw">' + escHtml(l.raw.trim()) + '</span><span class="inv-rl-read">' + escHtml(l.read) + '</span></div>';
    }).join('') + '</div>';
  }
  var nothing = !plan.days.length;
  h += '<button class="inv-stk-btn inv-stk-btn-pri inv-stk-btn-block" data-action="invRelaySave"' + (nothing ? ' disabled' : '') + '>Save ' + todoPlural(plan.days.length, 'day') + '</button>';
  return h;
}
function relayParseHhmm(s) {
  var m = String(s || '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? +m[1] * 60 + +m[2] : null;
}

function relaySave() {
  var rv = _relay;
  if (!rv) return;
  var plan = relayPlan(rv);
  if (!plan.days.length) { showToast('Nothing to save', 'error'); return; }
  // Remember the spellings the owner placed, on the worker, for next time.
  Object.keys(rv.choices).forEach(function(k) {
    var w = staffById(rv.choices[k]);
    if (!w || !k) return;
    w.relayNames = (w.relayNames || []).filter(function(n) { return relayKey(n) !== k; }).concat([k]);
  });
  var marks = 0, extras = 0;
  plan.days.forEach(function(d) {
    var rec = attDay(d.iso, true);
    d.rows.forEach(function(r) {
      if (r.change === 'kept' || r.change === 'same') return;
      var n = r.next;
      rec.marks[r.w.id] = { st: n.st, ot: n.ot, hours: n.hours, area: n.area, inMin: n.inMin, outMin: n.outMin, outKnown: !!n.outKnown, src: 'relay' };
      marks++;
    });
    d.extras.forEach(function(x) { if (!x.dup) { rec.extra.push(x.row); extras++; } });
    var add = [];
    if (d.holiday) add.push('Holiday: ' + d.holiday);
    if (d.notes.length) add.push(d.notes.join(' · '));
    add.forEach(function(a) { if (String(rec.note || '').indexOf(a) < 0) rec.note = (rec.note ? rec.note + '\n' : '') + a; });
  });
  var at = Date.now();
  rv.msgs.forEach(function(m) {
    if (m.dup) return;
    relayPastes().push({ id: 'RP-' + at.toString(36) + Math.random().toString(36).slice(2, 5), at: at, hash: relayHash(m.text),
      sentBy: m.sentBy || '', sentOn: m.sentOn || '', kind: m.parsed ? m.parsed.kind : '', date: m.parsed ? m.parsed.date : '', text: m.text });
  });
  saveState();
  var first = plan.days[0].iso;
  _relay = null; _relayDraft = ''; _relayView = 'paste';
  _attDate = first; _attView = 'day';
  renderAttendance();
  window.scrollTo(0, 0);
  showToast('Saved ' + todoPlural(plan.days.length, 'day') + ': ' + todoPlural(marks, 'mark') + ', ' + todoPlural(extras, 'EXTRA row'));
}

function relayAction(action, btn) {
  switch (action) {
    case 'invRelayRead': relayRead(); break;
    case 'invRelayBack': _relayView = 'paste'; renderAttendance(); break;
    case 'invRelaySave': relaySave(); break;
    case 'invRelayLines': _relayShowLines = !_relayShowLines; renderAttendance(); break;
    case 'invRelayOpen': relayOpen(); break;
  }
}
function relayOnChange(t) {
  if (!t || !t.hasAttribute || !t.hasAttribute('data-relay-map') || !_relay) return false;
  _relay.choices[t.getAttribute('data-relay-map')] = t.value;
  renderAttendance();
  return true;
}
function relayOnInput(t) {
  if (!t || t.id !== 'relayPasteText') return false;
  _relayDraft = t.value;
  return true;
}
