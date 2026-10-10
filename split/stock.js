/* ===== STOCK =====
   Chemical stock, owned by soma-internal (owner's ruling, 24 Sep 2026): this
   tab is a VIEW and an INPUT, never the ledger. Everything captured here is
   copied into soma-internal at the next compile and stays on the device.

   The record is a list of EVENTS, not a table of levels: a count, a delivery,
   a use, a charge into a bath — each with the day it is about, when it was
   typed, who sent it and who typed it. The level on screen is replayed from
   them. That is what lets the app say "70 − 30 is not 70": the supervisor's
   own message carries its working, and a table of levels would throw it away.

   Nothing is committed: the lines themselves arrive through the first pasted
   message or the import door, the same rule the roster lives by. */

/* ---------- The message parser ----------
   Pure: reads text, returns what it found. It knows the shop's shorthand and
   nothing about S. Resolution against the app's lines is resolveStockParse().

   What a line looks like, from the supervisor's own messages:
     1) ZINK NIL 00
     6) MONICOL 4-2=2 KG                                 opening − used = left
     7) BRIGHTNER 80 LTR 6 day 5×6=30use available 50LTR
     8) 65 M add 60+3=63-9 =54 LTR available             received + opening …
    14) NITRIC ACID add 60+10=70 LTR use 6 day 30 LTR available 70 LTR
    15) HCL add 660 LTR
        use 21/09/26/ 300 LTR available 360 LTR          a line can wrap
    14) 70-10=60 LTR                                     and can lose its name  */

var STOCK_SPELLINGS = {
  SOLLT: 'SALT', SOLT: 'SALT', SALLT: 'SALT', SOLTT: 'SALT',
  ZINK: 'ZINC', CYNEDE: 'CYANIDE', CYNIDE: 'CYANIDE', CYANID: 'CYANIDE', CYNED: 'CYANIDE',
  BRIGHTNER: 'BRIGHTENER', BRIGHTER: 'BRIGHTENER', BRITENER: 'BRIGHTENER', BRIGHTNR: 'BRIGHTENER',
  CAMICAL: 'CHEMICAL', BERRAL: 'BARREL'
};
var STOCK_UNITS = { KG: 'kg', KGS: 'kg', LTR: 'L', LTRS: 'L', LT: 'L', L: 'L', LITRE: 'L', LITRES: 'L',
  LITER: 'L', NOS: 'nos', NO: 'nos', PCS: 'nos', PC: 'nos' };
var STOCK_KEYWORDS = { ADD: 'add', ADDED: 'add', RECD: 'add', RECEIVED: 'add', INCOMING: 'add',
  USE: 'use', USED: 'use', USES: 'use',
  AVAILABLE: 'avl', AVL: 'avl', AVAIL: 'avl', BAL: 'avl', BALANCE: 'avl', NIL: 'nil' };

// A part name reads the same however it was typed: case, punctuation and the
// shop's recurring spellings fall away, and "65M" is "65 M".
function stockKey(name) {
  return String(name || '').toUpperCase().replace(/[^A-Z0-9/ ]+/g, ' ').split(/\s+/)
    .filter(Boolean).map(function(w) {
      var m = w.match(/^(\d+)([A-Z])$/);
      if (m) w = m[1] + ' ' + m[2];
      return STOCK_SPELLINGS[w] || w;
    }).join(' ');
}

function stockDisplayName(key) {
  return key.split(' ').map(function(w) {
    if (/\d/.test(w) || w.length === 1 || !/[AEIOU]/.test(w)) return w;
    return w.charAt(0) + w.slice(1).toLowerCase();
  }).join(' ');
}

// dd/mm/yy as the shop writes it → yyyy-mm-dd.

function stockTokens(text) {
  var src = String(text).replace(/(\d)\s*[x×*X]\s*(\d)/g, '$1×$2');
  var re = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?|(\d+(?:\.\d+)?)\s*(days?)\b|(\d+(?:\.\d+)?)|([+\-=×])|([A-Za-z][A-Za-z0-9.]*)|(\S)/gi;
  var out = [], m;
  while ((m = re.exec(src))) {
    if (m[1]) out.push({ t: 'date', v: isoFromDmy(m[1], m[2], m[3]) });
    else if (m[4]) out.push({ t: 'days', v: +m[4] });
    else if (m[6]) out.push({ t: 'num', v: +m[6], s: m[6] });
    else if (m[7]) out.push({ t: 'op', v: m[7] });
    else if (m[8]) {
      var w = m[8].replace(/\.+$/, '').toUpperCase();
      if (STOCK_KEYWORDS[w]) out.push({ t: 'kw', v: STOCK_KEYWORDS[w] });
      else if (STOCK_UNITS[w]) out.push({ t: 'unit', v: STOCK_UNITS[w] });
      else out.push({ t: 'text', v: m[8].replace(/\.+$/, '') });
    }
    else out.push({ t: 'sym', v: m[9] });
  }
  return out;
}

function stockRound(v) { return Math.round(v * 1000) / 1000; }

/* An area written with its line's number apart ("VAT A 2", "V A 1", "VAT 1", "VAT-2") is read as one word, VAT A1 or
   VAT A2, before the line is: its digit is not a quantity. The 25–28 Sep message's zinc line ("use VAT A 2 / 25/09/26/
   150 kg VAT 1 / 28/09/26/ 175 kg berral use 75 kg") saved 2 kg charged, the 2 of "A 2", where it says 150 + 175 + 75.
   A figure with its unit after it ("VAT 2 kg") stays a figure, and "VAT A1", one word already, is left as written. The
   barrel is not numbered in the shop's messages (a quantity, a time or a part follows it), so it is left alone. */
var STOCK_UNIT_AFTER = '(?![\\s-]*(?:' + Object.keys(STOCK_UNITS).join('|') + ')\\b)';
/* After "use", an A with its number is the line too ("16 SOLLT use A 2 10-10=00"): A Salt is a name, and stands before it. */
var STOCK_AREA_RES = [[new RegExp('\\bV[\\s-]*A[\\s-]*([12])\\b' + STOCK_UNIT_AFTER, 'gi'), 'VAT A$1'],
  [new RegExp('\\bVAT(?:[\\s-]*A[\\s-]+|[\\s-]+)([12])\\b' + STOCK_UNIT_AFTER, 'gi'), 'VAT A$1'],
  [new RegExp('(\\bUSE[\\s.:/-]*)A[\\s-]*([12])\\b' + STOCK_UNIT_AFTER, 'gi'), '$1VAT A$2']];
function stockFoldAreas(text) {
  return STOCK_AREA_RES.reduce(function(t, re) { return t.replace(re[0], re[1]); }, String(text || ''));
}
/* The bath a word names, once the areas are folded: VAT A1, VAT A2 (A1 and A2 alone too) or the barrel, the three plating
   lines (PP3; owner, 9 Oct 2026: "Exactly", to reading the bath a stock line names). */
var STOCK_BATH_WORDS = { A1: 'vat-a1', VA1: 'vat-a1', VATA1: 'vat-a1', A2: 'vat-a2', VA2: 'vat-a2', VATA2: 'vat-a2' };
function stockBathOfWord(w) {
  var u = String(w || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (STOCK_BATH_WORDS[u]) return STOCK_BATH_WORDS[u];
  return /^B[AE]R+[AE]L+S?$/.test(u) ? 'barrel' : null;
}
/* The baths a text names, in order: an "Into" typed by hand, a use's note ("VAT A2 VAT A1 BARREL"). */
function stockBathsIn(text) {
  var out = [];
  stockTokens(stockFoldAreas(text)).forEach(function(t) { var b = t.t === 'text' ? stockBathOfWord(t.v) : null; if (b && out.indexOf(b) < 0) out.push(b); });
  return out;
}
/* The baths an entry went into: its lines, else the ones its note names (a use saved before the reader read them, an Into typed
   by hand before it was kept as lines). Only a use or a charge goes into a bath. */
function stockEntryLines(e) {
  if (!e || (e.kind !== 'used' && e.kind !== 'charged')) return [];
  if (Array.isArray(e.lines)) return e.lines.filter(function(l) { return typeof l === 'string'; });
  return e.note ? stockBathsIn(e.note) : [];
}
/* A use's note less the baths it names, which its entries carry as lines. */
function stockNoteSansBaths(text) {
  return stockKey(stockTokens(stockFoldAreas(text)).filter(function(t) { return t.t === 'text' && !stockBathOfWord(t.v) && !/^(VAT|AND)$/i.test(t.v); })
    .map(function(t) { return t.v; }).join(' '));
}
/* Whether the figure at s stands in a use clause: after "use", with only areas, dates and days between (and a minus
   straight before it, "-25kg =150"). */
function stockInUse(sig, s) {
  for (var b = s - 1; b >= 0; b--) {
    var t = sig[b];
    if (t.t === 'kw') return t.v === 'use';
    if (t.t === 'num' || (t.t === 'op' && !(b === s - 1 && t.v === '-'))) return false;
  }
  return false;
}

/* One numbered line → its name, and the four figures a take can state:
   O opening, A received, U used, C left. Anything it cannot place is reported,
   never dropped: a number the parser does not understand is a question. */
function parseStockLine(body) {
  var toks = stockTokens(stockFoldAreas(body));
  var r = { name: '', unit: '', O: null, A: null, U: null, C: null, addDate: null, useDate: null, useFrom: null,
    days: null, rate: null, note: '', useParts: null, issues: [], unread: [] };

  // The name runs until a keyword or a number that is doing arithmetic. Names
  // carry digits of their own (16 Salt, 65 M, Q558), so a digit alone is not
  // the end of one.
  var i = 0, nameParts = [];
  for (; i < toks.length; i++) {
    var tk = toks[i], nx = toks[i + 1];
    if (tk.t === 'kw' || tk.t === 'date' || tk.t === 'days' || tk.t === 'op') break;
    if (tk.t === 'num' && (!nx || nx.t === 'unit' || nx.t === 'op' || nx.t === 'kw' || nx.t === 'days' || nx.t === 'num')) break;
    if (tk.t === 'unit' && nameParts.length) break;
    nameParts.push(tk.s || tk.v);
  }
  r.name = nameParts.join(' ').trim();
  toks = toks.slice(i);

  // Collapse a×b(=c) into one number that remembers its rate and days.
  var t2 = [];
  for (var k = 0; k < toks.length; k++) {
    var a = toks[k];
    if (a.t === 'num' && toks[k + 1] && toks[k + 1].v === '×' && toks[k + 2] && toks[k + 2].t === 'num') {
      var prod = { t: 'num', v: stockRound(a.v * toks[k + 2].v), rate: a.v, days: toks[k + 2].v };
      k += 2;
      if (toks[k + 1] && toks[k + 1].v === '=' && toks[k + 2] && toks[k + 2].t === 'num') {
        if (stockRound(toks[k + 2].v) !== prod.v) {
          r.issues.push({ level: 'red', code: 'footing', text: a.v + ' × ' + prod.days + ' is ' + prod.v + ', not ' + toks[k + 2].v });
        }
        prod.v = toks[k + 2].v;
        k += 2;
      }
      t2.push(prod);
    } else t2.push(a);
  }
  toks = t2;
  toks.forEach(function(tk) { if (tk.t === 'unit' && !r.unit) r.unit = tk.v; });
  var sig = toks.filter(function(tk) { return tk.t !== 'unit' && tk.t !== 'sym'; });
  var claimed = [];

  // Chains: n (op n)+, where "=" states the running total. In a use clause a sum is what was used, and its total the use
  // ("54 LTR use 3+3+9=15": read as a chain, 3 was the opening, 3 + 9 a delivery and 54 the use). A use and the balance
  // after it ("75 kg=175", "-25kg =150") are the clause's own, below; "use 25/09/26/ 30-20" is still an opening less a use.
  var chainResult = null, minusU = false;
  for (var s = 0; s < sig.length; s++) {
    if (sig[s].t !== 'num' || claimed[s] || !(sig[s + 1] && sig[s + 1].t === 'op' && sig[s + 2] && sig[s + 2].t === 'num')) continue;
    if (stockInUse(sig, s)) {
      if (sig[s + 1].v === '=' || (sig[s - 1] && sig[s - 1].t === 'op')) continue;
      if (sig[s + 1].v === '+') {
        var sum = sig[s].v, js = s + 1;
        claimed[s] = true;
        while (sig[js] && (sig[js].v === '+' || sig[js].v === '=') && sig[js + 1] && sig[js + 1].t === 'num') {
          claimed[js + 1] = true;
          if (sig[js].v === '+') sum = stockRound(sum + sig[js + 1].v);
          else {
            if (stockRound(sig[js + 1].v) !== sum) r.issues.push({ level: 'red', code: 'footing', text: 'Works out to ' + sum + ', written as ' + sig[js + 1].v });
            sum = sig[js + 1].v;
          }
          js += 2;
        }
        if (!minusU) r.U = stockRound((r.U || 0) + sum);
        s = js - 1;
        continue;
      }
    }
    var prev = sig[s - 1];
    var startsWithAdd = prev && prev.t === 'kw' && prev.v === 'add';
    if (!startsWithAdd && prev && prev.t === 'date' && sig[s - 2] && sig[s - 2].v === 'add') startsWithAdd = true;
    var first = startsWithAdd ? 'A' : 'O';
    r[first] = sig[s].v; claimed[s] = true;
    var total = sig[s].v, j = s + 1;
    while (sig[j] && sig[j].t === 'op' && sig[j + 1] && sig[j + 1].t === 'num') {
      var op = sig[j].v, n = sig[j + 1];
      claimed[j + 1] = true;
      if (op === '+') { var role = first === 'A' ? 'O' : 'A'; r[role] = (r[role] || 0) + n.v; total = stockRound(total + n.v); }
      else if (op === '-') { r.U = stockRound((r.U || 0) + n.v); total = stockRound(total - n.v); minusU = true; if (n.days) { r.days = n.days; r.rate = n.rate; } }
      else if (op === '=') {
        if (stockRound(n.v) !== total) r.issues.push({ level: 'red', code: 'footing', text: 'Works out to ' + total + ', written as ' + n.v });
        total = n.v; chainResult = { v: n.v, idx: j + 1 };
      }
      j += 2;
    }
    s = j - 1;
  }

  function prevNum(from) {
    for (var q = from; q >= 0; q--) {
      var tq = sig[q];
      if (tq.t === 'num') return q;
      if (tq.t !== 'days' && tq.t !== 'date') return -1;
    }
    return -1;
  }

  var useDates = [], balance = null;
  // The baths a use went into, part by part: a bath, then a date, then what went in there ("use VAT A 2 / 25/09/26/ 150 kg
  // VAT 1 / 28/09/26/ 175 kg berral use 75 kg"). A bath stands for the parts after it until another is named; a date for the
  // part after it. A bath or a date straight before "use" is the use's ("berral use 75 kg", "70 kg 25/09/26 use V A 1 20 KG").
  var useParts = [], curBaths = [], curWords = [], bathsSpent = false, curDate = null, wholeBaths = null;
  // A word naming a bath, or the VAT before its number, starts a new bath once the last one's figure is taken; the words are kept
  // as written for the part's note.
  var bathWord = function(w, b) {
    if (bathsSpent) { curBaths = []; curWords = []; bathsSpent = false; }
    curWords.push(w);
    if (b && curBaths.indexOf(b) < 0) curBaths.push(b);
  };
  for (var p = 0; p < sig.length; p++) {
    var tp = sig[p];
    if (tp.t !== 'kw') continue;
    if (tp.v === 'use') {
      var bk = p - 1;
      while (bk >= 0 && sig[bk].t === 'text' && (stockBathOfWord(sig[bk].v) || /^VAT$/i.test(sig[bk].v))) bk--;
      if (bk >= 0 && sig[bk].t === 'date' && !(sig[bk - 1] && sig[bk - 1].t === 'kw' && sig[bk - 1].v === 'add')) { curDate = sig[bk].v; useDates.push(sig[bk].v); }
    }
    if (tp.v === 'nil') {
      r.C = 0;
      if (sig[p + 1] && sig[p + 1].t === 'num' && sig[p + 1].v === 0) claimed[p + 1] = true;
    } else if (tp.v === 'add') {
      var q0 = p + 1;
      if (sig[q0] && sig[q0].t === 'date') { r.addDate = sig[q0].v; q0++; }
      if (r.A == null && sig[q0] && sig[q0].t === 'num' && !claimed[q0]) { r.A = sig[q0].v; claimed[q0] = true; }
    } else if (tp.v === 'use') {
      // A use clause runs to the next keyword, a part at a time: an area and a date, then what was used there, and every
      // part counts. "n = m" is a use and the balance after it, and so is "-n = m". A figure straight after a quantity
      // is not a part ("use 12 KG 00 KG" is 12 used and none left), and a use already written as an opening less a use
      // ("55-25=30 KG use V A 1 15KG V A 2 10 KG") is not counted again.
      var notes = [], parts = 0;
      for (var q1 = p + 1; q1 < sig.length; q1++) {
        var tq1 = sig[q1];
        if (tq1.t === 'date') { useDates.push(tq1.v); curDate = tq1.v; continue; }
        if (tq1.t === 'days') { r.days = tq1.v; continue; }
        if (tq1.t === 'text') { notes.push(tq1.v); var bw = stockBathOfWord(tq1.v); if (bw || /^VAT$/i.test(tq1.v)) bathWord(tq1.v, bw); continue; }
        if (tq1.t === 'op' && tq1.v === '-' && sig[q1 + 1] && sig[q1 + 1].t === 'num' && !claimed[q1 + 1]) continue;
        if (tq1.t === 'num' && !claimed[q1] && sig[q1 - 1].t !== 'num') {
          claimed[q1] = true; parts++;
          if (!minusU) { r.U = stockRound((r.U || 0) + tq1.v); if (tq1.days) { r.days = tq1.days; r.rate = tq1.rate; } }
          useParts.push({ qty: tq1.v, date: curDate, baths: curBaths.slice(), words: curWords.slice() });
          bathsSpent = true; curDate = null;
          if (sig[q1 + 1] && sig[q1 + 1].v === '=' && sig[q1 + 2] && sig[q1 + 2].t === 'num') {
            claimed[q1 + 2] = true; balance = { v: sig[q1 + 2].v, idx: q1 + 2 }; q1 += 2;
          }
          continue;
        }
        break;
      }
      // A clause naming its bath and no figure of its own ("use V A 1 50-30= 20KG"): the whole use went into it.
      if (!parts && curBaths.length && !bathsSpent) wholeBaths = { baths: curBaths.slice(), words: curWords.slice(), date: curDate };
      if (notes.length) r.note = (r.note ? r.note + ' ' : '') + notes.join(' ');
      if (!parts) {
        var before = prevNum(p - 1);
        if (before >= 0 && !claimed[before] && r.U == null) {
          r.U = sig[before].v; claimed[before] = true;
          if (sig[before].days) { r.days = sig[before].days; r.rate = sig[before].rate; }
        }
      }
    } else if (tp.v === 'avl') {
      var nx2 = sig[p + 1] && sig[p + 1].t === 'num' ? p + 1 : -1;
      if (nx2 >= 0 && !claimed[nx2]) { r.C = sig[nx2].v; claimed[nx2] = true; }
      else {
        var pv = prevNum(p - 1);
        if (pv >= 0) { r.C = sig[pv].v; claimed[pv] = true; }
      }
    }
  }
  // Left: the last total the line states, a chain's or a use clause's balance.
  var stated = balance && (!chainResult || balance.idx > chainResult.idx) ? balance : chainResult;
  if (r.C == null && stated) r.C = stated.v;
  // Used on one day, or over the days its parts name (25 and 28 Sep: the use spans them).
  var ud = useDates.filter(Boolean).sort().filter(function(d, i, a) { return !i || d !== a[i - 1]; });
  if (ud.length) { r.useDate = ud[ud.length - 1]; if (ud.length > 1) r.useFrom = ud[0]; }

  var loose = [];
  sig.forEach(function(tk, idx) { if (tk.t === 'num' && !claimed[idx]) loose.push(idx); });
  if (r.C == null && loose.length) { r.C = sig[loose[loose.length - 1]].v; loose.pop(); }
  if (r.O == null && loose.length) { r.O = sig[loose[0]].v; loose.shift(); }
  loose.forEach(function(idx) { r.unread.push(String(sig[idx].v)); });

  if (r.U != null && r.days == null) {
    sig.forEach(function(tk) { if (tk.t === 'days' && r.days == null) r.days = tk.v; });
  }
  if (r.U != null && r.days && r.rate == null) r.rate = stockRound(r.U / r.days);
  // The use, bath by bath, where a bath is named: its parts add up to the use, or it stays one use and says why.
  if (r.U != null && !useParts.length && wholeBaths) useParts = [{ qty: r.U, date: wholeBaths.date, baths: wholeBaths.baths, words: wholeBaths.words }];
  if (r.U != null && useParts.some(function(x) { return x.baths.length; })) {
    var sumParts = stockRound(useParts.reduce(function(t, x) { return t + x.qty; }, 0));
    if (sumParts === stockRound(r.U)) r.useParts = useParts;
    else r.issues.push({ level: 'amber', code: 'baths', text: 'The baths’ figures add to ' + sumParts + '; the use is ' + r.U + '. Saved as one use.' });
  }
  if (r.C == null && r.A == null && r.U == null && r.O == null) {
    r.issues.push({ level: 'red', code: 'nofigure', text: 'No quantity found on this line' });
  }
  return r;
}

// "14) …" or "14. …"; a dot followed by a digit is a decimal, not a number's end ("80.5 LTR available", a wrapped
// line, read as item 80).
var STOCK_ITEM_RE = /^\s*(\d{1,2})\s*(?:\)|\.(?!\d))\s*(.*)$/;

/* The whole message → its window, its sender if the WhatsApp line came with
   it, and one entry per numbered line. */
function parseStockMessage(text) {
  var out = { from: null, to: null, sentBy: '', sentOn: null, header: [], lines: [], unread: [] };
  // The WhatsApp lines are read by the relay's reader, the one every paste box uses: day first, and month first in
  // the bracketed iPhone export. Stock read them day first always, so [9/10/26, …] was 9 October, not 10 September.
  var msgs = relaySplit(text), first = msgs.find(function(m) { return m.sentBy; });
  if (first) { out.sentBy = first.sentBy; out.sentOn = first.sentOn; }
  var lines = msgs.map(function(m) { return m.text; }).join('\n').split('\n');
  var cur = null, dates = [];
  lines.forEach(function(line) {
    if (!line.trim() || /^[\s.\-_*]+$/.test(line)) return;
    var im = line.match(STOCK_ITEM_RE);
    if (im) {
      cur = { n: +im[1], raw: im[2].trim() };
      out.lines.push(cur);
      return;
    }
    if (cur) { cur.raw += '\n' + line.trim(); return; }
    out.header.push(line.trim());
    var dre = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g, dm, found = false;
    while ((dm = dre.exec(line))) { var iso = isoFromDmy(dm[1], dm[2], dm[3]); if (iso) { dates.push(iso); found = true; } }
    var rest = line.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}\/?/g, '').replace(/[\s\-–\/]+/g, ' ').trim();
    if (!found && !/(STOCK|USE)/.test(stockKey(rest)) && rest) out.unread.push(line.trim());
  });
  dates.sort();
  if (dates.length) { out.from = dates[0]; out.to = dates[dates.length - 1]; }
  else if (out.sentOn) { out.from = out.to = out.sentOn; }
  out.lines.forEach(function(l) {
    var p = parseStockLine(l.raw.replace(/\n/g, ' '));
    for (var k in p) l[k] = p[k];
    l.key = stockKey(l.name);
  });
  return out;
}

/* ---------- The store and the replay ---------- */
function stockData() {
  if (!S.stock || typeof S.stock !== 'object' || Array.isArray(S.stock)) S.stock = {};
  ['items', 'entries', 'pastes'].forEach(function(k) { if (!Array.isArray(S.stock[k])) S.stock[k] = []; });
  return S.stock;
}
function stockCfg() {
  var c = S.stockCheck || {}, d = STOCK_CHECK_DEFAULTS;
  var red = c.redDays > 0 ? c.redDays : d.redDays, amber = c.amberDays > 0 ? c.amberDays : d.amberDays;
  return {
    redDays: red,
    // Never under the red line: red 10 with amber 7 drew an 8-day line red under the OK tile. Settings refuses it now;
    // a pair saved before reads amber at the red line.
    amberDays: Math.max(amber, red),
    chemModel: c.chemModel > 0 ? c.chemModel : d.chemModel
  };
}
function stockUid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function stockItem(id) { return stockData().items.find(function(i) { return i.id === id; }) || null; }
// Days in a window, Sundays out — the shop's own divisor (16–22 Sep is "6 day").
// The one counter is statsWorkingDays; a window here is never under a day.
function stockWorkingDays(from, to) {
  if (!from || !to || to < from) return 1;
  return Math.max(1, statsWorkingDays(from, to));
}
function stockFmtQty(v) {
  if (v == null || isNaN(v)) return '—';
  return String(Math.round(v * 100) / 100);
}
// A rate reads to the precision it deserves: 167 L/day, 5.3 L/day, 0.33 kg/day.
function stockFmtRate(v) {
  if (v == null || isNaN(v)) return '—';
  return String(v >= 10 ? Math.round(v) : v >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);
}
function stockShortDate(iso) {
  if (!iso) return '—';
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var p = iso.split('-');
  return (+p[2]) + ' ' + m[+p[1] - 1];
}
// A day with its year when the year is not this one: a message dated a year off must not read like this week's.
function stockDayLabel(iso) {
  return stockShortDate(iso) + (iso && iso.slice(0, 4) !== localDateStr().slice(0, 4) ? ' ' + iso.slice(0, 4) : '');
}
var STOCK_KIND_RANK = { count: 3, received: 1, used: 2, charged: 2, bill: 0 };
/* In the order they happened: by day, then when typed. A correction replays where the entry it corrects stood (its own
   `at` is when the correction was typed): after the day's closing count, opening 100, used 30, count 70 with the use
   corrected to 25 read 45 where the count says 70. */
function stockSortEntries(list) {
  var byId = {};
  stockData().entries.forEach(function(e) { byId[e.id] = e; });
  var at = function(e) {
    for (var n = 0; e.corrects && byId[e.corrects.id] && n < 50; n++) e = byId[e.corrects.id];
    return e.at || 0;
  };
  return list.slice().sort(function(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    var d = at(a) - at(b);
    if (d) return d;
    return (a.seq != null ? a.seq : STOCK_KIND_RANK[a.kind]) - (b.seq != null ? b.seq : STOCK_KIND_RANK[b.kind]);
  });
}
function stockItemEntries(itemId) {
  return stockSortEntries(stockData().entries.filter(function(e) { return e.itemId === itemId && !e.voided; }));
}
/* The level, replayed. A count sets it; a delivery adds; a use or a charge
   takes away. Each count also records what the app EXPECTED just before it,
   so a count that disagrees with the arithmetic carries its own gap. */
function stockReplay(itemId, beforeDate) {
  var level = null, rows = [];
  stockItemEntries(itemId).forEach(function(e) {
    if (beforeDate && e.date >= beforeDate) return;
    // A bill records what was paid, not what arrived: the delivery itself is a
    // Received entry or shows up in the next count, so a bill never moves stock.
    if (e.kind === 'bill') return;
    var before = level;
    if (e.kind === 'count') level = e.qty;
    else if (e.kind === 'received') level = (level || 0) + e.qty;
    // A use or a charge takes from a level the app knows. Before any count or delivery the level is unknown and stays
    // so: read from 0, a line with bills and a "used 0" typed by hand was Out, red on the To-do and first to reorder.
    else if (level != null) level = level - e.qty;
    if (level != null) level = stockRound(level);
    rows.push({ e: e, before: before, after: level });
  });
  return { level: level, rows: rows };
}
/* Daily rate: what was used over the last three weeks of record ÷ the days it
   covers. Fewer than three days is not a rate yet — the mark says so. */
/* Every draw counts, a charge into a bath as much as a use (a line drawn by Charged had no rate at all), and a day is
   counted once however many entries fall on it (two on one day read as two days and halved the rate). An entry
   covering several days covers its own day and the working days before it, Sundays out. */
function stockRate(item) {
  var list = stockItemEntries(item.id).filter(function(e) { return e.kind === 'used' || e.kind === 'charged'; });
  if (!list.length) return null;
  var last = list[list.length - 1].date, cut = isoAddDays(last, -20);
  var qty = 0, covered = {};
  list.forEach(function(e) {
    if (e.date < cut) return;
    qty += e.qty;
    covered[e.date] = true;
    for (var n = (e.days || 1) - 1, d = e.date, g = 0; n > 0 && g < 60; g++) {
      d = isoAddDays(d, -1);
      if (new Date(d + 'T00:00:00').getDay() !== 0) { covered[d] = true; n--; }
    }
  });
  var days = Object.keys(covered).length;
  if (!days) return null;
  return { rate: stockRound(qty / days), days: days, tentative: days < 3 };
}
function stockStatus(item) {
  var lv = stockReplay(item.id).level, cfg = stockCfg();
  var rate = stockRate(item);
  var st = { level: lv, rate: rate, daysLeft: null, group: 'none', tone: 'none' };
  if (item.basis === 'charge') { st.group = 'bath'; st.tone = 'bath'; return st; }
  if (lv == null) return st;
  if (lv <= 0) { st.group = 'out'; st.tone = 'red'; return st; }
  if (!rate || !rate.rate) return st;
  st.daysLeft = lv / rate.rate;
  st.group = st.daysLeft <= cfg.amberDays ? 'low' : 'ok';
  st.tone = st.daysLeft <= cfg.redDays ? 'red' : st.daysLeft <= cfg.amberDays ? 'amber' : 'ok';
  return st;
}
function stockOutCount() {
  if (!S || !S.stock) return 0;
  return stockData().items.filter(function(i) { return i.active !== false && stockStatus(i).group === 'out'; }).length;
}
/* The red counts on the bar's workspaces and the sidebar's heads (workspace.js): every red row, stock out or under the red
   line and your own tasks overdue, each on the workspace its jump lands in, all of them on Today. */
function updateStockBadge() {
  if (typeof wsUpdateCounts === 'function') wsUpdateCounts();
}

/* ---------- Resolving a parsed message against the app's lines ---------- */
/* The relay's fingerprint over the text without its WhatsApp lines, so the message copied with or without them is one
   message. Marked 'h' as every stock message saved before it was, and equal to those to the character. */
function stockHash(text) {
  var body = String(text || '').split('\n').map(function(l) { var m = l.match(RELAY_WA_RE); return m ? m[5] : l; }).join(' ');
  return 'h' + relayHash(body).slice(1);
}
/* A line's other spellings, whole names only: a string there (from a file) matched any fragment of itself. */
function stockAliases(item) {
  return Array.isArray(item && item.aliases) ? item.aliases.filter(function(a) { return typeof a === 'string' && a; }) : [];
}
function stockFindByKey(key) {
  if (!key) return null;
  return stockData().items.find(function(i) { return i.key === key || stockAliases(i).indexOf(key) >= 0; }) || null;
}
function stockFindByPos(n) {
  return stockData().items.find(function(i) { return i.lastPos === n; }) || null;
}
function stockGuessBasis(key) { return key === 'ZINC' ? 'charge' : 'draw'; }

function resolveStockParse(parsed, choices) {
  choices = choices || {};
  var from = parsed.from, to = parsed.to;
  var res = { from: from, to: to, lines: [], counts: { red: 0, amber: 0, clear: 0 } };
  parsed.lines.forEach(function(l, idx) {
    var r = { src: l, idx: idx, item: null, newItem: null, via: null, issues: l.issues.slice(), entries: [], skip: false };
    var mapChoice = choices['map' + idx];
    var byKey = stockFindByKey(l.key);
    // "key:<KEY>" names a line this same message is creating: the first message a
    // device ever sees has nothing saved yet, so its nameless line must be able
    // to point at a line that only exists once this message is saved.
    var mapKey = mapChoice && mapChoice.indexOf('key:') === 0 ? mapChoice.slice(4) : '';
    // A name typed by the operator wins over the menu: the 24 Sep message's
    // line 14 was nitric acid, and nitric is named nowhere else in it, so on a
    // device that never saw the 22 Sep message no menu could have offered it.
    var typed = String(choices['name' + idx] || '').trim();
    if (typed) mapKey = stockKey(typed);
    if (mapKey) {
      var already = stockFindByKey(mapKey);
      if (already) { r.item = already; r.via = 'chosen'; } else { r.via = 'new'; }
    }
    else if (mapChoice && mapChoice !== 'new') { r.item = stockItem(mapChoice); r.via = 'chosen'; }
    else if (mapChoice === 'new' && l.key) { r.via = 'new'; }
    else if (byKey) { r.item = byKey; r.via = 'name'; }
    else if (!l.key) {
      var byPos = stockFindByPos(l.n);
      if (byPos) {
        r.item = byPos; r.via = 'position';
        r.issues.push({ level: 'amber', code: 'position', text: 'No name on this line. Read as ' + byPos.name + ', which was number ' + l.n + ' last time.' });
      } else {
        r.skip = true;
        r.issues.push({ level: 'red', code: 'noname', text: 'No name on this line. Pick which line it is, or it is not saved.' });
      }
    } else { r.via = 'new'; }
    if (r.via === 'new') {
      var nk = mapKey || l.key;
      r.newItem = { name: stockDisplayName(nk), key: nk, unit: l.unit || '', basis: stockGuessBasis(nk) };
      r.issues.push({ level: 'info', code: 'new', text: 'New line: added as ' + r.newItem.name + (l.unit ? ' (' + l.unit + ')' : ', unit not stated') });
    }
    var item = r.item || r.newItem;
    if (item && r.item && l.unit && r.item.unit && l.unit !== r.item.unit) {
      r.issues.push({ level: 'amber', code: 'unit', text: 'Written in ' + l.unit + '; this line is kept in ' + r.item.unit + '. Saved as written, check the figure.' });
    }
    l.unread.forEach(function(u) { r.issues.push({ level: 'amber', code: 'unread', text: 'Could not place the number ' + u + '. Not saved.' }); });

    var prev = r.item ? stockReplay(r.item.id, from).level : null;
    r.prev = prev;
    var O = l.O, A = l.A, U = l.U, C = l.C;
    if (O != null && prev != null && stockRound(O) !== stockRound(prev)) {
      var dO = stockRound(O - prev);
      r.issues.push({ level: 'amber', code: 'opening', text: 'Opening ' + stockFmtQty(O) + '; the app had ' + stockFmtQty(prev) + ' (' + (dO > 0 ? '+' : '') + stockFmtQty(dO) + '). The opening is saved as a count, so the gap stays on record.' });
    }
    var Oeff = O != null ? O : prev;
    var balance = choices['bal' + idx] || 'unsettled';
    var closing = C, unsettled = false, expected = null;
    if (C != null && (A != null || U != null)) {
      if (Oeff != null) {
        expected = stockRound(Oeff + (A || 0) - (U || 0));
        if (expected !== stockRound(C)) {
          if (O != null) {
            r.issues.push({ level: 'red', code: 'balance', expected: expected, written: C,
              text: stockFmtQty(O) + (A != null ? ' + ' + stockFmtQty(A) : '') + (U != null ? ' − ' + stockFmtQty(U) : '') + ' is ' + stockFmtQty(expected) + '. The message says ' + stockFmtQty(C) + '.' });
            if (balance === 'working') closing = expected;
            else if (balance !== 'written') unsettled = true;
          } else {
            r.issues.push({ level: 'amber', code: 'balance-app', text: 'From the app\'s ' + stockFmtQty(prev) + ' this leaves ' + stockFmtQty(expected) + '; the message says ' + stockFmtQty(C) + '. Saved as ' + stockFmtQty(C) + '.' });
          }
        }
      } else {
        var inferred = stockRound(C - (A || 0) + (U || 0));
        if (inferred < 0) r.issues.push({ level: 'amber', code: 'negative', text: 'These figures need an opening of ' + stockFmtQty(inferred) + '.' });
      }
    } else if (C != null && O == null && A == null && U == null && prev != null && C > prev) {
      r.issues.push({ level: 'amber', code: 'gain', text: 'Up ' + stockFmtQty(stockRound(C - prev)) + ' ' + ((item && item.unit) || '') + ' from the app\'s ' + stockFmtQty(prev) + ', with no delivery recorded.' });
    }
    var addDate = l.addDate || l.useDate || to;
    // On a one- or two-day take the day hardly matters; on a week it moves the rate.
    if (A != null && !l.addDate && stockWorkingDays(from, to) > 2) {
      r.issues.push({ level: 'amber', code: 'adddate', text: 'Delivery date not stated; taken as ' + stockShortDate(addDate) + '.' });
    }
    r.O = O; r.A = A; r.U = U; r.C = C; r.closing = closing; r.expected = expected; r.unsettled = unsettled;
    r.addDate = addDate;

    if (!r.skip && item) {
      var basis = item.basis || 'draw';
      if (O != null && (prev == null || stockRound(O) !== stockRound(prev)) && (A != null || U != null || C == null || stockRound(O) !== stockRound(C))) {
        r.entries.push({ kind: 'count', qty: O, date: from, seq: 0, note: 'opening' });
      }
      if (A != null) r.entries.push({ kind: 'received', qty: A, date: addDate, seq: 1 });
      if (U != null) {
        // A use on one day is that day's; one whose parts name several days covers them (useFrom … useDate).
        var uFrom = l.useFrom || l.useDate || from, uDays = l.useFrom ? stockWorkingDays(l.useFrom, l.useDate) : l.useDate ? 1 : (l.days || stockWorkingDays(from, to));
        var uKind = basis === 'charge' ? 'charged' : 'used';
        if (l.useParts) {
          // One use a bath (PP3): each part on its own day where the message dates it, else over the use's days as before,
          // and the bath it went into as its line (two baths named together share the part: "berral & vat a1. 51 kg"). The note
          // is the bath as written, as it always was: a part's own words, or the whole line's where the use is one part.
          var note1 = l.note ? stockKey(l.note) : '', rest = l.note ? stockNoteSansBaths(l.note) : '';
          l.useParts.forEach(function(pt) {
            var pn = l.useParts.length === 1 ? note1 : [stockKey((pt.words || []).join(' ')), rest].filter(Boolean).join(' ');
            var pe = { kind: uKind, qty: pt.qty, date: pt.date || l.useDate || to, from: pt.date || uFrom, seq: 2, days: pt.date ? 1 : uDays, note: pn };
            if (pt.baths.length) pe.lines = pt.baths.slice();
            if (l.useParts.length === 1 && l.rate != null) pe.rate = l.rate;
            r.entries.push(pe);
          });
        } else {
          r.entries.push({ kind: uKind, qty: U, date: l.useDate || to, from: uFrom, seq: 2, days: uDays, rate: l.rate, note: l.note ? stockKey(l.note) : '' });
        }
      }
      if (closing != null) {
        var ce = { kind: 'count', qty: closing, date: to, seq: 3 };
        if (unsettled) ce.unsettled = true;
        if (balance === 'working' && closing !== C) ce.note = 'message said ' + stockFmtQty(C);
        r.entries.push(ce);
      }
    }
    var worst = r.issues.some(function(i) { return i.level === 'red' && !(i.code === 'balance' && choices['bal' + idx]); }) ? 'red'
      : r.issues.some(function(i) { return i.level === 'amber'; }) ? 'amber' : 'clear';
    r.tone = worst;
    res.counts[worst]++;
    res.lines.push(r);
  });
  // Saved before, unless every entry it made has since been voided: then it may be read again (Production's rule).
  var st0 = stockData(), h = stockHash(parsed.text || '');
  res.dup = st0.pastes.find(function(p) { return p.hash === h && st0.entries.some(function(e) { return e.pasteId === p.id && !e.voided; }); }) || null;
  return res;
}

/* Save a reviewed message. Every entry keeps the line it came from, and the
   message itself is kept whole, so the export can always show its source. */
function stockCommitPaste(parsed, res, meta) {
  var st = stockData(), at = Date.now(), pasteId = stockUid('SP');
  var made = 0, lines = 0, skipped = 0, ids = [];
  res.lines.forEach(function(r) {
    if (r.skip || !r.entries.length) { if (r.skip) skipped++; return; }
    var item = r.item;
    if (!item) {
      item = stockFindByKey(r.newItem.key);
      if (!item) {
        item = { id: stockUid('SI'), name: r.newItem.name, key: r.newItem.key, aliases: [], unit: r.newItem.unit,
          basis: r.newItem.basis, createdAt: at, active: true };
        st.items.push(item);
      }
    }
    if (r.via === 'chosen' && r.src.key && item.key !== r.src.key && stockAliases(item).indexOf(r.src.key) < 0) {
      item.aliases = stockAliases(item).concat([r.src.key]);
    }
    if (!item.unit && r.src.unit) item.unit = r.src.unit;
    st.items.forEach(function(i) { if (i.lastPos === r.src.n && i !== item) delete i.lastPos; });
    item.lastPos = r.src.n;
    lines++;
    r.entries.forEach(function(e) {
      var rec = { id: stockUid('SE'), itemId: item.id, kind: e.kind, qty: e.qty, date: e.date, seq: e.seq, at: at,
        source: 'paste', pasteId: pasteId, n: r.src.n, raw: r.src.raw, sentBy: meta.sentBy || '', by: meta.by || '' };
      ['from', 'days', 'rate', 'note', 'unsettled', 'lines'].forEach(function(k) { if (e[k] != null && e[k] !== '') rec[k] = e[k]; });
      if (e.kind === 'used' || e.kind === 'charged') { if (!rec.days) rec.days = 1; }
      st.entries.push(rec);
      ids.push(rec.id);
      made++;
    });
  });
  // A message that saved nothing is not recorded: its fingerprint would refuse
  // the corrected paste as a duplicate of something that never landed.
  if (made) {
    st.pastes.push({ id: pasteId, at: at, by: meta.by || '', sentBy: meta.sentBy || '', from: res.from, to: res.to,
      hash: stockHash(parsed.text || ''), text: parsed.text || '', choices: meta.choices || {} });
  }
  return { entries: made, lines: lines, skipped: skipped, ids: ids };
}

/* ---------- Screens ---------- */
var _stockView = 'list';
var _stockHome = 'list';   // where Back returns to: the list (Stock is one screen since the tab map, TM4d)
var _stockSpendOpen = false;   // the desktop's pane holds Spend and prices (no line open)
var _stockReview = null;   // { text, parsed, choices, sentBy }
var _stockManual = null;   // { mode, date, supplier, billNo, bath, vals: {itemId: {qty, price}} }
var _stockItemId = null;
var _stockVoidArm = null;
var _stockPasteDraft = '';
var STOCK_BY_KEY = 'sep_inv_stock_by';
var STOCK_KIND_LABEL = { count: 'Count', received: 'Received', used: 'Used', charged: 'Charged to bath', bill: 'Bill' };

function stockBy() { try { return localStorage.getItem(STOCK_BY_KEY) || ''; } catch (e) { return ''; } }
function setStockBy(v) { try { localStorage.setItem(STOCK_BY_KEY, v); } catch (e) { /* per-device convenience only */ } }

// The stock tones in the five status words of the design system (§3.3): a line
// charged into a bath is information, not a warning, and one with no rate yet is neutral.
var STOCK_TONE = { red: 'danger', amber: 'warning', ok: 'ok', bath: 'info', none: 'neutral' };
var _stockFilter = null;   // a Lines tile pressed: 'out' | 'low' | 'ok' | 'none' (none takes the bath lines too)
var STOCK_BACK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';

function stockQtyUnit(v, unit) {
  return '<span class="inv-num">' + escHtml(stockFmtQty(v)) + (unit ? '<span class="inv-unit">' + escHtml(unit) + '</span>' : '') + '</span>';
}
/* A sub-view (a form, the check, one line on the phone) leads with the way back and its own title. */
function stockBackBar(label, title) {
  return '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="invStockBack">' +
    STOCK_BACK_ICON + escHtml(label) + '</button><h2 class="inv-pagehead-title">' + escHtml(title) + '</h2></div>';
}
function stockDaysText(d, tentative) {
  // Below ten days the half day matters: 7.5 must not read as the amber line's 7.
  var n = d < 10 ? Math.floor(d * 10) / 10 : Math.floor(d);
  var t = d < 1 ? 'under 1 day' : n + (n === 1 ? ' day' : ' days');
  return t + (tentative ? '?' : '');
}
/* The word beside a line's dot: the same on the list, the table and the line's own page. */
function stockStatusWord(s, long) {
  if (s.group === 'bath') return s.level > 0 ? 'On shelf' : 'Shelf empty';
  if (s.group === 'out') return 'Out';
  if (s.daysLeft != null) return stockDaysText(s.daysLeft, s.rate.tentative) + (long ? ' left' : '');
  // Used, but never counted or delivered: the rate is known, the level is not.
  if (s.level == null && s.rate && s.rate.rate) return 'Not counted';
  return 'No rate';
}
function stockStatusDot(s, long) {
  return '<span class="inv-dot inv-dot-' + STOCK_TONE[s.tone] + '">' + escHtml(stockStatusWord(s, long)) + '</span>';
}
/* What a row says under the name: the rate and what it rests on, or the last charge or count. */
function stockRowSub(item, s) {
  var unit = item.unit || '';
  if (s.group === 'bath') {
    var lc = stockItemEntries(item.id).filter(function(e) { return e.kind === 'charged'; }).pop();
    return lc ? 'charged ' + stockFmtQty(lc.qty) + ' ' + unit + ' on ' + stockShortDate(lc.date) + (lc.note ? ' · ' + lc.note : '') : 'no charge recorded';
  }
  if (s.rate && s.rate.rate) return stockFmtRate(s.rate.rate) + ' ' + unit + '/day · over ' + s.rate.days + (s.rate.days === 1 ? ' day' : ' days');
  var lcnt = stockItemEntries(item.id).filter(function(e) { return e.kind === 'count'; }).pop();
  return lcnt ? 'counted ' + stockShortDate(lcnt.date) : 'not counted yet';
}
function stockUnsettled(item) {
  var last = stockItemEntries(item.id).filter(function(e) { return e.kind === 'count'; }).pop();
  return !!(last && last.unsettled);
}

/* The toolbar (§1a-12): Paste message the one primary, Enter by hand beside it, the rest behind More (the reorder list, the paper,
   the files). On the desktop Spend and prices opens in the pane beside the list; on the phone it is the fold at the list's foot. */
function stockToolbarHtml() {
  var phone = !_isDesktop;
  return '<div class="inv-toolbar" data-stock-toolbar><button class="inv-btn inv-btn-primary" data-action="invStockPaste">Paste message</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invStockManual">Enter by hand</button>' +
    (phone ? '' : '<button class="inv-btn inv-btn-secondary" data-action="invStockSpend" aria-pressed="' + (_stockSpendOpen && !(_stockView === 'item' && stockItem(_stockItemId))) + '">Spend and prices</button>') +
    // The paper route for the day (stocksheet.js), the reorder list and the files: behind More.
    uiToolbarMoreHtml([{ label: 'Reorder list', action: 'invStockReorder' }, { label: 'Print sheets', action: 'invStockSheetOpen' },
      { label: 'Export', action: 'invStockExport' }, { label: 'Import', action: 'invStockImport' }], { icon: phone }) +
    '<input type="file" accept=".json,application/json" id="stockFileInput" class="inv-hidden"></div>';
}

function renderStock() {
  var el = document.getElementById('stockContent');
  if (!el) return;
  stockData();
  if (_stockView === 'paste') el.innerHTML = renderStockPaste();
  else if (_stockView === 'review' && _stockReview) el.innerHTML = renderStockReview();
  else if (_stockView === 'manual' && _stockManual) el.innerHTML = renderStockManual();
  // On the desktop a line opens in the pane beside the table; on the phone it is a page of its own.
  else if (_stockView === 'item' && stockItem(_stockItemId)) el.innerHTML = _isDesktop ? renderStockList(stockItem(_stockItemId)) : renderStockItem(stockItem(_stockItemId));
  else if (_stockView === 'reorder' && _stockReorder) el.innerHTML = renderStockReorder();
  else if (_stockView === 'check') el.innerHTML = renderStockCheck();
  else { _stockView = _stockHome = 'list'; el.innerHTML = renderStockList(null); }
  updateStockBadge();
}

function stockSetView(v) {
  // Only a new view goes to the top: a Lines tile filtering the list it is on is a change inside the view (P79).
  // On the desktop a line opens in the pane beside the table, which stays put: that is not a new view either.
  var moved = v !== _stockView && !(_isDesktop && /^(list|item)$/.test(v) && /^(list|item)$/.test(_stockView));
  _stockView = v;
  _stockVoidArm = null;
  renderStock();
  if (moved) viewTop();
}

/* Stock (the tab map, TM4d): one screen. Its verdict card says what is out and what to order (the status tiles its factors, still
   filtering; the reorder's cash and, for a role that sees money with a statement, the forecast's low), one toolbar row, what needs
   a check, then the lines grouped by status (a table beside the open line on the desktop); Spend and prices folded at the foot on
   the phone, in the pane on the desktop. */
function renderStockList(open) {
  var st = stockData();
  var items = st.items.filter(function(i) { return i.active !== false; });
  var lastCount = null;
  st.entries.forEach(function(e) { if (!e.voided && e.kind === 'count' && (!lastCount || e.date > lastCount.date || (e.date === lastCount.date && e.at > lastCount.at))) lastCount = e; });
  var groups = { out: [], low: [], ok: [], bath: [], none: [] };
  items.forEach(function(i) { var s2 = stockStatus(i); groups[s2.group].push({ item: i, st: s2 }); });
  groups.low.sort(function(a, b) { return a.st.daysLeft - b.st.daysLeft; });
  groups.ok.sort(function(a, b) { return a.st.daysLeft - b.st.daysLeft; });
  ['out', 'bath', 'none'].forEach(function(g) { groups[g].sort(function(a, b) { return a.item.name < b.item.name ? -1 : 1; }); });
  var h = stockVerdictHtml(items, groups, lastCount) + stockToolbarHtml() + stockCheckCalloutHtml();
  // No line yet: the card says so and the toolbar takes the first message.
  if (!items.length) return h;
  var amber = stockCfg().amberDays;
  var titles = { out: 'Out', low: amber + ' days or less', ok: 'OK', bath: 'Charged to the bath', none: 'No daily rate yet' };
  var shown = ['out', 'low', 'ok', 'bath', 'none'].filter(function(g) {
    return groups[g].length && (!_stockFilter || _stockFilter === g || (_stockFilter === 'none' && g === 'bath'));
  });
  if (_isDesktop) return h + stockLinesTableHtml(groups, shown, titles, open);
  if (!shown.length) h += '<div class="inv-panel"><div class="inv-empty">No line in this group. Press its tile again to see every line.</div></div>';
  else {
    h += '<div class="inv-panel inv-panel-flush" id="stockLines">';
    shown.forEach(function(g) {
      h += '<div class="inv-row-group"><span>' + escHtml(titles[g]) + '</span><span class="inv-num">' + groups[g].length + '</span></div>';
      groups[g].forEach(function(x) { h += stockRowHtml(x.item, x.st); });
    });
    h += '</div>';
  }
  return h + uiFoldHtml('stock-spend', '<span class="inv-panel-title">Spend and prices</span>', stockSpendHtml(), false, ' id="stockSpend"');
}
/* The card (§3e): the lines out (else low) and the reorder's cash with GST, in the worst line's tone; the status tiles its factors,
   each filtering the list; the count's day its eyebrow; the forecast's low after the order, for a role that sees money (the order's
   cost is every role's that opens Stock, the forecast the bank's: the QA audit, QA4-4). */
function stockVerdictHtml(items, groups, lastCount) {
  if (!items.length) return uiVerdictHtml({ screen: 'Stock', verdict: 'No stock recorded yet', tone: 'neutral', attrs: ' id="stockVerdict"',
    facts: ['paste the supervisor’s stock message, or import a stock file'] });
  var amber = stockCfg().amberDays, out = groups.out.length, low = groups.low.length;
  var red = groups.low.some(function(x) { return x.st.tone === 'red'; });
  var L = stockReorderList(), need = gstRound(L.total * 1.18), fc = finSeen() ? finForecast(45) : null;
  var words = out ? todoPlural(out, 'line') + ' out' : low ? todoPlural(low, 'line') + ' at ' + amber + ' days or less' : 'Every line stocked';
  var tile = function(g, n, label, tone) {
    return { label: label, fig: String(n), tone: n && tone ? tone : null, action: 'invStockFilter', attrs: ' data-v="' + g + '"', pressed: _stockFilter === g };
  };
  return uiVerdictHtml({ screen: 'Stock · ' + todoPlural(items.length, 'line') + (lastCount ? ', last count ' + stockShortDate(lastCount.date) + (lastCount.sentBy ? ', ' + lastCount.sentBy : '') : ''),
    verdict: words + (need > 0 ? ', reorder ' + formatInrShort(need) + ' with GST' : ''),
    tone: out || red ? 'danger' : low ? 'warning' : 'ok',
    facts: [fc && need > 0 ? { text: 'after the order, the low is ' + formatInrShort(gstRound(fc.min.bal - need)) + ' on ' + stockShortDate(fc.min.date), tone: fc.min.bal - need < 0 ? 'danger' : 'ok', money: true } : '',
      L.unpriced ? todoPlural(L.unpriced, 'line') + ' to order with no price' : ''],
    factors: [tile('out', out, 'Out', 'danger'), tile('low', low, amber + ' days or less', 'warning'), tile('ok', groups.ok.length, 'OK', ''),
      tile('none', groups.none.length + groups.bath.length, 'No rate', '')],
    tilesAttrs: ' id="stockTiles"',
    links: ['<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invStockReorder">Open the reorder list</button>'], attrs: ' id="stockVerdict"' });
}

function stockRowHtml(item, s) {
  return '<button class="inv-row inv-row-2" data-action="invStockOpen" data-id="' + escHtml(item.id) + '" data-tone="' + s.tone + '">' +
    '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(item.name) + '</span>' +
    '<span class="inv-row-meta">' + escHtml(stockRowSub(item, s)) + (stockUnsettled(item) ? ' <span class="inv-badge inv-badge-warning">Count unsettled</span>' : '') + '</span></span>' +
    '<span class="inv-row-end inv-row-stack">' + stockQtyUnit(s.level, item.unit || '') + stockStatusDot(s) + '</span></button>';
}

/* The desktop: one table grouped by status, and the open line in the pane beside it. */
function stockLinesTableHtml(groups, shown, titles, open) {
  var h = '<div class="inv-pane-host' + (open || _stockSpendOpen ? ' inv-pane-open' : '') + '" id="stockMasterDetail"><div class="inv-pane-list" id="stockLines">' +
    '<table class="inv-table"><thead><tr><th class="inv-col-grow">Line</th><th class="inv-num">On hand</th><th class="inv-col-opt1">Record</th>' +
    '<th>Status</th></tr></thead><tbody>';
  shown.forEach(function(g) {
    h += '<tr class="inv-table-group"><td colspan="4">' + escHtml(titles[g]) + ' <span class="inv-panel-count">' + groups[g].length + '</span></td></tr>';
    groups[g].forEach(function(x) {
      var it = x.item, id = escHtml(it.id);
      h += '<tr data-action="invStockOpen" data-id="' + id + '" data-tone="' + x.st.tone + '"' + (open && open.id === it.id ? ' aria-current="true"' : '') + '>' +
        '<td class="inv-col-grow"><button class="inv-btn-link" data-action="invStockOpen" data-id="' + id + '">' + escHtml(it.name) + '</button></td>' +
        '<td class="inv-num">' + stockQtyUnit(x.st.level, it.unit || '') + '</td>' +
        '<td class="inv-col-opt1 inv-col-grow-sm" title="' + escHtml(stockRowSub(it, x.st)) + '">' + escHtml(stockRowSub(it, x.st)) + '</td>' +
        '<td>' + stockStatusDot(x.st) + (stockUnsettled(it) ? ' <span class="inv-badge inv-badge-warning">Count unsettled</span>' : '') + '</td></tr>';
    });
  });
  h += '</tbody></table></div><div class="inv-pane" id="stockDetail">';
  if (open) {
    h += paneHeadHtml('<span class="inv-panel-title">' + escHtml(open.name) + '</span>', 'invStockPaneClose') + stockItemBodyHtml(open);
  } else if (_stockSpendOpen) {
    // Spend and prices, with no line open: the list and the pane still fill the room under the toolbar (P80).
    h += paneHeadHtml('<span class="inv-panel-title">Spend and prices</span>', 'invStockPaneClose') + '<div class="inv-panel inv-panel-flush" id="stockSpend">' + stockSpendHtml() + '</div>';
  }
  return h + '</div></div>';
}

function renderStockPaste() {
  return stockBackBar('Stock', 'Paste message') +
    '<div class="inv-panel">' +
    '<div class="inv-field"><label class="inv-field-label" for="stockPasteText">The supervisor\'s message, as sent</label>' +
    '<textarea id="stockPasteText" class="inv-textarea inv-textarea-mono" rows="12" spellcheck="false" placeholder="Copy the stock message in WhatsApp and paste it here">' +
    escHtml(_stockPasteDraft) + '</textarea></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="stockBy">Entered by</label>' +
    '<input id="stockBy" class="inv-input" value="' + escHtml(stockBy()) + '" placeholder="Your name" autocomplete="off"></div>' +
    '<button class="inv-btn inv-btn-primary inv-btn-block" data-action="invStockRead">Read message</button>' +
    '<div class="inv-note inv-mt-8">Copy the WhatsApp time line with it and the sender is read from it. Nothing is saved until you check what was read.</div></div>';
}

function stockReadPaste() {
  var ta = document.getElementById('stockPasteText');
  var text = ta ? ta.value : _stockPasteDraft;
  _stockPasteDraft = text;
  if (!text.trim()) { showToast('Paste the message first', 'error'); return; }
  var parsed = parseStockMessage(text);
  parsed.text = text;
  if (!parsed.lines.length) { showToast('No numbered lines found — is this the stock message?', 'error'); return; }
  if (!parsed.to) { parsed.from = parsed.to = localDateStr(); parsed.noDate = true; }
  _stockReview = { text: text, parsed: parsed, choices: {}, sentBy: parsed.sentBy || '' };
  stockSetView('review');
}

function stockResultText(r, unit) {
  var parts = [];
  if (r.O != null) parts.push('opening ' + stockFmtQty(r.O));
  else if (r.prev != null && (r.A != null || r.U != null)) parts.push('app had ' + stockFmtQty(r.prev));
  if (r.A != null) parts.push('+' + stockFmtQty(r.A) + ' in');
  if (r.U != null) parts.push('−' + stockFmtQty(r.U) + ' used' + (r.src.useFrom ? ' (' + stockShortDate(r.src.useFrom) + ' – ' + stockShortDate(r.src.useDate) + ')' : r.src.days ? ' (' + r.src.days + ' days)' : ''));
  var end = r.closing != null ? stockFmtQty(r.closing) + (unit ? ' ' + unit : '') : '';
  if (!parts.length) return end ? 'Count ' + end : '';
  return parts.join(' · ') + (end ? ' → ' + end : '');
}

/* The check before saving (§7, Paste message): every line beside the text it came from and what was
   read, its verdict a badge, its questions callouts, its answers chips. */
function renderStockReview() {
  var rv = _stockReview, p = rv.parsed;
  var res = resolveStockParse(p, rv.choices);
  rv.res = res;
  var st = stockData();
  var h = stockBackBar('Edit text', 'Check before saving');
  if (res.dup) {
    h += '<div class="inv-callout inv-callout-danger inv-mb-8" id="stockDupNote">This message was already saved on ' +
      escHtml(new Date(res.dup.at).toLocaleDateString('en-IN')) + '. Saving it again would count every figure twice.</div>';
  }
  // A window far from the day the message was sent (or today, pasted without its WhatsApp line) is most likely a year
  // typed wrong in its first line: saved as read, every entry lands on those days (the QA audit, 30 Sep 2026).
  var ref = p.sentOn || localDateStr();
  var early = p.from < ref ? isoDaysBetween(p.from, ref) : 0, late = p.to > ref ? isoDaysBetween(ref, p.to) : 0;
  if (!p.noDate && Math.max(early, late) > 30) {
    h += '<div class="inv-callout inv-callout-warning inv-mb-8" id="stockWindowNote">' + escHtml((early >= late
      ? 'This message starts ' + stockDayLabel(p.from) + ', ' + early + ' days before '
      : 'This message ends ' + stockDayLabel(p.to) + ', ' + late + ' days after ') +
      (p.sentOn ? 'it was sent (' + stockDayLabel(p.sentOn) + ')' : 'today') + '. Check the dates in its first line: every entry is saved on the days it names.') + '</div>';
  }
  h += '<div class="inv-panel"><div class="inv-kv inv-mb-8">' +
    '<div><div class="inv-kv-k">Covers</div><div>' + escHtml(stockDayLabel(p.from)) + (p.to !== p.from ? ' – ' + escHtml(stockDayLabel(p.to)) : '') + '</div></div>' +
    '<div><div class="inv-kv-k">Count dated</div><div>' + escHtml(stockDayLabel(p.to)) + (p.noDate ? ' (no date in the message: today)' : '') + '</div></div></div>' +
    '<div class="inv-fields">' +
    '<div class="inv-field"><label class="inv-field-label" for="stockSentBy">Sent by</label><input id="stockSentBy" class="inv-input" value="' + escHtml(rv.sentBy) + '" placeholder="Who counted" autocomplete="off"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="stockBy">Entered by</label><input id="stockBy" class="inv-input" value="' + escHtml(stockBy()) + '" placeholder="Your name" autocomplete="off"></div></div></div>';
  h += '<div class="inv-tiles inv-tiles-3" id="stockReviewTiles">' +
    '<div class="inv-tile' + (res.counts.red ? ' inv-tile-danger' : '') + '"><div class="inv-tile-label">Needs you</div><div class="inv-tile-value">' + res.counts.red + '</div></div>' +
    '<div class="inv-tile' + (res.counts.amber ? ' inv-tile-warning' : '') + '"><div class="inv-tile-label">Check</div><div class="inv-tile-value">' + res.counts.amber + '</div></div>' +
    '<div class="inv-tile"><div class="inv-tile-label">Clear</div><div class="inv-tile-value">' + res.counts.clear + '</div></div></div>';
  if (p.unread.length) {
    h += '<div class="inv-callout inv-callout-warning inv-mb-8">Not read: ' + p.unread.map(escHtml).join(' / ') + '</div>';
  }
  var order = { red: 0, amber: 1, clear: 2 };
  var sorted = res.lines.slice().sort(function(a, b) { return order[a.tone] - order[b.tone] || a.idx - b.idx; });
  var nEntries = 0, nLines = 0, nSkip = 0;
  h += '<div class="inv-panel inv-panel-flush" id="stockReview"><div class="inv-panel-head"><span class="inv-panel-title">Lines read <span class="inv-panel-count">' + res.lines.length + '</span></span></div>';
  sorted.forEach(function(r) {
    if (r.skip) nSkip++; else if (r.entries.length) { nLines++; nEntries += r.entries.length; }
    h += stockReviewRowHtml(r, rv, res, st);
  });
  h += '</div>';
  h += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">Across ' + nLines + (nLines === 1 ? ' line' : ' lines') +
    (nSkip ? ' · <strong>' + nSkip + ' not saved</strong>' : '') + '</div><div class="inv-actionbar-value">' + nEntries + (nEntries === 1 ? ' entry' : ' entries') + '</div></div>' +
    '<button class="inv-btn inv-btn-primary" data-action="invStockSavePaste"' + (res.dup ? ' disabled' : '') + '>Save</button></div>';
  return h;
}

function stockReviewRowHtml(r, rv, res, st) {
  var item = r.item || r.newItem;
  var name = item ? item.name : (r.src.name || 'No name');
  var unit = item ? item.unit : r.src.unit;
  var badge = r.tone === 'red' ? ['danger', 'Needs you'] : r.tone === 'amber' ? ['warning', 'Check'] : r.newItem ? ['info', 'New line'] : ['ok', 'Clear'];
  var h = '<div class="inv-row inv-row-auto inv-row-top" data-line="' + r.src.n + '" data-tone="' + r.tone + '"><div class="inv-row-main">' +
    '<div class="inv-row-title">' + r.src.n + ' &middot; ' + escHtml(name) + '</div>' +
    '<div class="inv-quote inv-mt-4">' + escHtml(r.src.raw) + '</div>' +
    (stockResultText(r, unit) ? '<div class="inv-verdict-text inv-mt-4">' + escHtml(stockResultText(r, unit)) + '</div>' : '');
  r.issues.forEach(function(is) {
    if (is.code === 'new' && r.tone !== 'clear') return;
    h += '<div class="inv-callout inv-callout-' + uiTone(is.level) + ' inv-mt-8">' + escHtml(is.text) + '</div>';
    if (is.code === 'balance') {
      var cur = rv.choices['bal' + r.idx] || 'unsettled';
      var opts = [['working', 'Use the working: ' + stockFmtQty(is.expected)], ['written', 'Use the figure written: ' + stockFmtQty(is.written)], ['unsettled', 'Save as unsettled, ask']];
      h += '<div class="inv-toolbar inv-mt-8" role="group" aria-label="Which figure">';
      opts.forEach(function(o) {
        h += '<button class="inv-chip" data-action="invStockBal" data-i="' + r.idx + '" data-v="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + escHtml(o[1]) + '</button>';
      });
      h += '</div>';
    }
  });
  // Nothing to pick from on the first message, so a new line needs no picker there.
  if ((r.via === 'new' && st.items.length) || !r.src.key || r.via === 'position' || r.via === 'chosen' || (r.skip && !r.item)) {
    var sel = rv.choices['name' + r.idx] ? '' : (rv.choices['map' + r.idx] || (r.item ? r.item.id : (r.src.key ? 'new' : '')));
    h += '<div class="inv-fields inv-mt-8"><div class="inv-field"><label class="inv-field-label" for="stockMap' + r.idx + '">This line is</label>' +
      '<select id="stockMap' + r.idx + '" class="inv-select" data-stock-map="' + r.idx + '">' +
      (r.src.key ? '' : '<option value=""' + (sel === '' ? ' selected' : '') + '>Pick a line</option>') +
      (r.src.key ? '<option value="new"' + (sel === 'new' ? ' selected' : '') + '>A new line: ' + escHtml(stockDisplayName(r.src.key)) + '</option>' : '');
    st.items.forEach(function(i) {
      h += '<option value="' + escHtml(i.id) + '"' + (sel === i.id ? ' selected' : '') + '>' + escHtml(i.name) + '</option>';
    });
    // Lines this message is adding, so the first message can map to them too.
    var seen = {};
    res.lines.forEach(function(o) {
      var k = o.src.key;
      if (!k || k === r.src.key || seen[k] || stockFindByKey(k)) return;
      seen[k] = true;
      h += '<option value="key:' + escHtml(k) + '"' + (sel === 'key:' + k ? ' selected' : '') + '>' + escHtml(stockDisplayName(k)) + ' (new in this message)</option>';
    });
    h += '</select></div>';
    if (!r.src.key) {
      h += '<div class="inv-field"><label class="inv-field-label" for="stockName' + r.idx + '">Or type its name</label>' +
        '<input id="stockName' + r.idx + '" class="inv-input" data-stock-name="' + r.idx + '" value="' +
        escHtml(rv.choices['name' + r.idx] || '') + '" placeholder="e.g. Nitric acid" autocomplete="off"></div>';
    }
    h += '</div>';
  }
  return h + '</div><div class="inv-row-end"><span class="inv-badge inv-badge-' + badge[0] + '">' + badge[1] + '</span></div></div>';
}

function stockSavePaste() {
  var rv = _stockReview;
  if (!rv) return;
  if (!grdGate('floor', 'save stock entries', stockSavePaste)) return;   // the guard (guard.js): a floor entry, never re-asked
  var res = resolveStockParse(rv.parsed, rv.choices);
  if (res.dup) { showToast('Already saved — nothing saved twice', 'error'); return; }
  var by = stockBy();
  var out = stockCommitPaste(rv.parsed, res, { sentBy: rv.sentBy, by: by, choices: rv.choices });
  if (!out.entries) { showToast('Nothing to save: pick a line for each unnamed row', 'error'); return; }
  saveState();
  _stockReview = null; _stockPasteDraft = '';
  stockSetView('list');
  var chk = stockChecksFor(out.ids || []);
  showToast(out.entries + ' entries saved from ' + out.lines + ' lines' + (out.skipped ? ' · ' + out.skipped + ' not saved' : '') +
    (chk.n ? ' · check ' + chk.n + ': ' + chk.first : ''), chk.n ? 'warning' : undefined);
}

// The hand form as it opens: its toolbar button, Home's Stock entry, and an address that names it (nav.js).
function stockManualNew() {
  return { mode: 'count', date: localDateStr(), supplier: '', billNo: '', billDate: '', bath: '', vals: {} };
}
function stockOpenManual() {
  _stockManual = stockManualNew();
  stockSetView('manual');
}
// A figure typed on the hand form and not yet saved (what repeats, the company and the invoice, is not work to lose).
function stockManualTyped() {
  var m = _stockManual;
  return !!m && Object.keys(m.vals).some(function(id) { var v = m.vals[id]; return (v.qty != null && v.qty !== '') || (v.price != null && v.price !== ''); });
}

function renderStockManual() {
  var m = _stockManual, st = stockData();
  var field = function(id, label, input) { return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' + input + '</div>'; };
  var h = stockBackBar('Stock', 'Enter by hand');
  h += '<div class="inv-seg inv-mb-8" role="group" aria-label="What is entered">';
  [['count', 'Count'], ['received', 'Received'], ['used', 'Used'], ['charged', 'Charged']].forEach(function(o) {
    h += '<button type="button" class="inv-seg-btn" data-action="invStockMode" data-mode="' + o[0] + '" aria-pressed="' + (m.mode === o[0]) + '">' + o[1] + '</button>';
  });
  h += '</div><div class="inv-panel"><div class="inv-fields">' +
    field('stockManDate', 'Date', '<input type="date" id="stockManDate" class="inv-input" value="' + escHtml(m.date) + '">');
  if (m.mode === 'received') {
    h += field('stockManSupplier', 'Company', '<input id="stockManSupplier" class="inv-input" list="stockSupplierList" value="' + escHtml(m.supplier) + '" placeholder="Who billed it" autocomplete="off">') +
      field('stockManBill', 'Invoice no.', '<input id="stockManBill" class="inv-input" value="' + escHtml(m.billNo) + '" autocomplete="off">') +
      field('stockManBillDate', 'Invoice date', '<input type="date" id="stockManBillDate" class="inv-input" value="' + escHtml(m.billDate || m.date) + '">') +
      stockSupplierDatalist();
  }
  if (m.mode === 'charged' || m.mode === 'used') {
    h += field('stockManBath', 'Into', '<input id="stockManBath" class="inv-input" value="' + escHtml(m.bath) + '" placeholder="VAT A1, Barrel…" autocomplete="off">');
  }
  h += field('stockBy', 'Entered by', '<input id="stockBy" class="inv-input" value="' + escHtml(stockBy()) + '" autocomplete="off">') + '</div>';
  var hints = { count: 'What is on the shelf now. The app compares it with its own level.', received: 'A delivery, with its bill. The price per unit is what the live cost is worked out at.',
    used: 'Drawn from stock. Sets the daily rate.', charged: 'Put into a bath, e.g. zinc or salts.' };
  h += '<div class="inv-note">' + hints[m.mode] + ' Fill only the lines that changed.</div></div>';
  h += '<div class="inv-panel inv-panel-flush" id="stockManualList"><div class="inv-panel-head"><span class="inv-panel-title">Lines</span></div>';
  if (m.mode === 'received') h += '<div class="inv-row-group"><span>Line</span><span>Quantity · &#8377; per unit, before GST</span></div>';
  // A count is set against the level at the end of its own day, the figure Save compares it with; it said today's level
  // whatever day was picked.
  var today = localDateStr(), past = m.mode === 'count' && m.date && m.date !== today;
  st.items.filter(function(i) { return i.active !== false; }).forEach(function(i) {
    var v = m.vals[i.id] || {}, lv = m.mode === 'count' && m.date ? stockReplay(i.id, isoAddDays(m.date, 1)).level : stockReplay(i.id).level;
    h += '<div class="inv-row inv-row-2 inv-row-flow"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(i.name) + '</span>' +
      '<span class="inv-row-meta">' + (m.mode === 'count' ? (past ? 'app had ' : 'app has ') : 'now ') + escHtml(stockFmtQty(lv)) + ' ' + escHtml(i.unit || '') +
      (past ? ' on ' + escHtml(stockDayLabel(m.date)) : '') + '</span></span>' +
      '<span class="inv-row-end"><input type="number" inputmode="decimal" step="any" min="0" class="inv-input inv-input-sm inv-input-num" data-stock-qty="' + escHtml(i.id) + '" value="' + escHtml(v.qty != null ? v.qty : '') + '" aria-label="' + escHtml(i.name) + ' quantity">' +
      '<span class="inv-unit">' + escHtml(i.unit || '') + '</span>' +
      (m.mode === 'received' ? '<input type="number" inputmode="decimal" step="any" min="0" class="inv-input inv-input-sm inv-input-num" data-stock-price="' + escHtml(i.id) + '" value="' + escHtml(v.price != null ? v.price : '') + '" placeholder="₹/' + escHtml(i.unit || 'unit') + '" aria-label="' + escHtml(i.name) + ' price per unit">' : '') +
      '</span></div>';
  });
  h += '<div class="inv-panel-body"><div class="inv-field-label">Add a line</div><div class="inv-toolbar inv-toolbar-flush">' +
    '<input id="stockNewName" class="inv-input inv-toolbar-item" placeholder="Name, e.g. Chromic acid" aria-label="New line name" autocomplete="off">' +
    '<select id="stockNewUnit" class="inv-select inv-select-sm" aria-label="Unit"><option value="kg">kg</option><option value="L">L</option><option value="nos">nos</option></select>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invStockAddLine">Add</button></div></div></div>';
  h += stockDayEntriesHtml(m.date);
  h += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">' + escHtml(STOCK_KIND_LABEL[m.mode]) + ' on</div>' +
    '<div class="inv-actionbar-value">' + escHtml(stockShortDate(m.date)) + '</div></div>' +
    '<button class="inv-btn inv-btn-primary" data-action="invStockSaveManual">Save</button></div>';
  return h;
}
/* What the book holds for one day, every line and kind, pasted or by hand (owner, 30 Sep 2026: after entering the use by
   hand "there is no way to see what we entered … without an option to edit, see or check anything"). Under the hand form,
   for the day it is on: each entry with the level it left, Correct and Void. */
function stockDayEntriesHtml(date) {
  var st = stockData(), names = {};
  st.items.forEach(function(i) { names[i.id] = i; });
  var list = st.entries.filter(function(e) { return e.date === date && e.kind !== 'bill'; })
    .sort(function(a, b) { return (a.voided ? 1 : 0) - (b.voided ? 1 : 0) || (STOCK_KIND_RANK[a.kind] || 0) - (STOCK_KIND_RANK[b.kind] || 0) || (a.at || 0) - (b.at || 0); });
  var live = list.filter(function(e) { return !e.voided; }).length;
  var h = '<div class="inv-panel inv-panel-flush inv-mt-8" id="stockDayEntries" data-card="stockDay"><div class="inv-panel-head"><span class="inv-panel-title">Entered for ' + escHtml(stockShortDate(date)) +
    ' <span class="inv-panel-count">' + live + '</span></span></div>';
  if (!list.length) return h + '<div class="inv-empty">Nothing entered for this day yet. Pick another date above to check it.</div></div>';
  var replayed = {};
  list.forEach(function(e) {
    var it = names[e.itemId];
    if (!replayed[e.itemId]) { replayed[e.itemId] = {}; stockReplay(e.itemId).rows.forEach(function(r) { replayed[e.itemId][r.e.id] = r; }); }
    var r = replayed[e.itemId][e.id];
    h += '<div class="inv-row-group"><span>' + escHtml(it ? it.name : 'A line since removed') + '</span>' +
      (r && r.after != null && !e.voided ? '<span class="inv-num">left ' + escHtml(stockFmtQty(r.after)) + ' ' + escHtml(it ? it.unit || '' : '') + '</span>' : '') + '</div>' +
      stockEntryRowHtml(e, r, it ? it.unit || '' : '');
    // "Add its bill" opens the bill here, under its delivery, and the hand form stays (it opened on the line's page
    // only, so the tap did nothing on this form). The action bar's Save stays the one primary.
    if (it && _stockBill && _stockBill.entryId === e.id && !e.voided) {
      h += stockBillFormHtml(it).replace('inv-btn inv-btn-primary" data-action="invStockBillSave"', 'inv-btn inv-btn-secondary" data-action="invStockBillSave"');
    }
  });
  return h + '</div>';
}

function stockSaveManual() {
  var m = _stockManual;
  if (!m) return;
  if (!grdGate('floor', 'save a stock entry', stockSaveManual)) return;   // the guard (guard.js): a floor entry, never re-asked
  if (!m.date) { showToast('Pick a date', 'error'); return; }
  if (m.mode === 'received') {
    // A delivery is recorded with its bill: the company, the invoice and its
    // date are what the price and the purchase pattern are read from.
    if (!m.supplier) { showToast('Enter the company that billed it', 'error'); return; }
    if (!m.billNo) { showToast('Enter the invoice number', 'error'); return; }
  }
  var st = stockData(), at = Date.now(), by = stockBy(), n = 0, gaps = 0, unpriced = 0, ids = [];
  Object.keys(m.vals).forEach(function(id) {
    var v = m.vals[id], q = parseFloat(v.qty);
    if (v.qty === '' || v.qty == null || isNaN(q) || q < 0) return;
    if (!stockItem(id)) return;
    var rec = { id: stockUid('SE'), itemId: id, kind: m.mode, qty: q, date: m.date, seq: STOCK_KIND_RANK[m.mode], at: at, source: 'manual', by: by, sentBy: '' };
    if (m.mode === 'received') {
      // A price is above 0, or there is none: a 0 became the line's last price and costed its use at nothing, as priced.
      // The amount is kept with it, as the bill form keeps it (Finance → Payments reads a supplier's bills by it).
      var pr = parseFloat(v.price);
      if (v.price !== '' && v.price != null && pr > 0) { rec.price = pr; rec.amount = gstRound(pr * q); } else unpriced++;
      rec.supplier = m.supplier;
      rec.billNo = m.billNo;
      rec.billDate = m.billDate || m.date;
    }
    if (m.mode === 'used' || m.mode === 'charged') { rec.days = 1; rec.from = m.date; }
    if ((m.mode === 'charged' || m.mode === 'used') && m.bath) {
      rec.note = m.bath;
      var mb = stockBathsIn(m.bath);
      if (mb.length) rec.lines = mb;
    }
    if (m.mode === 'count') {
      var before = stockReplay(id, isoAddDays(m.date, 1)).level;
      if (before != null && stockRound(before) !== stockRound(q)) gaps++;
    }
    st.entries.push(rec);
    ids.push(rec.id);
    n++;
  });
  if (!n) { showToast('Nothing filled in', 'error'); return; }
  saveState();
  // The form stays on the day, with what was saved listed under it: several entries go in at a sitting, and each is
  // checked where it was made (it went to the list of lines before, and nothing showed what had been entered).
  m.vals = {};
  _pageTyped = false;
  renderStock();
  var dayEl = document.getElementById('stockDayEntries');
  if (dayEl && dayEl.scrollIntoView) try { dayEl.scrollIntoView({ block: 'nearest' }); } catch (x) { /* a convenience */ }
  // Saved as typed, and said at once when it does not fit (an entry checked before it is believed).
  var chk = stockChecksFor(ids);
  showToast(n + (n === 1 ? ' entry' : ' entries') + ' saved' + (chk.n ? ' · check ' + (chk.n === 1 ? 'it' : chk.n + ' of them') + ': ' + chk.first :
    (gaps ? ' · ' + gaps + ' count' + (gaps === 1 ? ' differs' : 's differ') + ' from the app' : '')) +
    (unpriced ? ' · ' + unpriced + ' without a price: add it on the line' : ''), chk.n || gaps || unpriced ? 'warning' : 'success');
}

function stockAddLine() {
  var nameEl = document.getElementById('stockNewName'), unitEl = document.getElementById('stockNewUnit');
  var name = nameEl ? nameEl.value.trim() : '';
  if (!name) { showToast('Name the line', 'error'); return; }
  var key = stockKey(name);
  if (stockFindByKey(key)) { showToast('That line already exists', 'error'); return; }
  stockData().items.push({ id: stockUid('SI'), name: name, key: key, aliases: [], unit: unitEl ? unitEl.value : '',
    basis: stockGuessBasis(key), createdAt: Date.now(), active: true });
  saveState();
  renderStock();
  showToast('Line added: ' + name);
}

/* Every purchase with a price: a Received entry carrying its bill, or a Bill
   entered on its own. Dated by the invoice, which is when the price was set. */
function stockPurchases(itemId) {
  return stockItemEntries(itemId).filter(function(e) { return (e.kind === 'received' || e.kind === 'bill') && e.price != null; })
    .map(function(e) { return { e: e, date: e.billDate || e.date }; })
    // Two bills on one day (a drum from the regular supplier and a bottle bought
    // locally the same morning): the larger sets the price, so it sorts last.
    .sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : ((a.e.qty || 0) - (b.e.qty || 0)) || (a.e.at || 0) - (b.e.at || 0); });
}
function stockPriceAt(itemId, date) {
  var priced = stockPurchases(itemId);
  if (!priced.length) return null;
  var best = null;
  priced.forEach(function(p) { if (p.date <= date) best = p; });
  var hit = (best || priced[0]);
  return { price: hit.e.price, date: hit.date, supplier: hit.e.supplier || '', billNo: hit.e.billNo || '', entry: hit.e };
}

/* One line: on the phone a page with the way back; on the desktop the same body in the pane. */
function renderStockItem(item) {
  return stockBackBar('Stock', item.name) + stockItemBodyHtml(item);
}

function stockItemBodyHtml(item) {
  var s = stockStatus(item), unit = item.unit || '';
  var tone = STOCK_TONE[s.tone];
  var lp = stockPriceAt(item.id, '9999-12-31');
  var lcnt = stockItemEntries(item.id).filter(function(e) { return e.kind === 'count'; }).pop();
  var h = '<div class="inv-panel inv-panel-flush" id="stockSummary"><div class="inv-tiles inv-tiles-flush">' +
    '<div class="inv-tile"><div class="inv-tile-label">On hand</div>' +
      '<div class="inv-tile-value" id="stockLevel">' + escHtml(stockFmtQty(s.level)) + (unit ? ' <span class="inv-tile-of">' + escHtml(unit) + '</span>' : '') + '</div>' +
      '<div class="inv-tile-sub">' + (lcnt ? 'counted ' + escHtml(stockShortDate(lcnt.date)) : 'not counted yet') + '</div></div>' +
    '<div class="inv-tile' + (tone === 'danger' || tone === 'warning' ? ' inv-tile-' + tone : '') + '"><div class="inv-tile-label">' + (s.group === 'bath' ? 'Shelf' : 'Days left') + '</div>' +
      '<div class="inv-tile-value">' + (s.daysLeft != null ? escHtml(stockDaysText(s.daysLeft, s.rate.tentative)) : '&mdash;') + '</div>' +
      '<div class="inv-tile-sub"><span class="inv-dot inv-dot-' + tone + '">' + escHtml(s.group === 'low' ? stockCfg().amberDays + ' days or less' : s.group === 'ok' ? 'OK' : stockStatusWord(s)) + '</span></div></div>' +
    '<div class="inv-tile"><div class="inv-tile-label">Use a day</div>' +
      '<div class="inv-tile-value">' + (s.rate && s.rate.rate ? escHtml(stockFmtRate(s.rate.rate)) + (unit ? ' <span class="inv-tile-of">' + escHtml(unit) + '</span>' : '') : '&mdash;') + '</div>' +
      '<div class="inv-tile-sub">' + (s.rate && s.rate.rate ? 'over ' + s.rate.days + (s.rate.days === 1 ? ' day' : ' days') + (s.rate.tentative ? ', not firm' : '') : 'no use recorded') + '</div></div>' +
    '<div class="inv-tile"><div class="inv-tile-label">Last paid</div>' +
      '<div class="inv-tile-value">' + (lp ? figWrapHtml(escHtml(formatCurrency(lp.price))) + ' <span class="inv-tile-of">/' + escHtml(unit || 'unit') + '</span>' : '&mdash;') + '</div>' +
      '<div class="inv-tile-sub">' + (lp ? escHtml(stockShortDate(lp.date)) + (lp.supplier ? ' &middot; ' + escHtml(lp.supplier) : '') : 'No price yet') + '</div></div>' +
    '</div><div class="inv-panel-body"><div class="inv-note">';
  if (s.rate && s.rate.rate) {
    h += escHtml(stockFmtRate(s.rate.rate) + ' ' + unit + '/day, from what was ' + (item.basis === 'charge' ? 'charged' : 'used') + ' over ' + s.rate.days + ' days of record') +
      (s.rate.tentative ? '. Under three days: not a firm rate yet.' : '.');
  } else {
    h += 'No use recorded yet, so no daily rate.';
  }
  if (!lp) h += ' No price yet. Add a bill below and the live cost can use this line.';
  h += '</div></div></div>';
  h += stockPatternHtml(item) + stockByLineHtml(item) + stockEditHtml(item);

  var replay = stockReplay(item.id).rows;
  var byId = {};
  replay.forEach(function(r) { byId[r.e.id] = r; });
  var all = stockData().entries.filter(function(e) { return e.itemId === item.id; });
  all = stockSortEntries(all).reverse();
  h += '<div class="inv-panel inv-panel-flush" id="stockEntries"><div class="inv-panel-head"><span class="inv-panel-title">Entries <span class="inv-panel-count">' + all.length + '</span></span></div>';
  if (!all.length) h += '<div class="inv-empty">Nothing recorded on this line yet.</div>';
  var checks = stockEntryChecks(item.id);
  all.forEach(function(e) { h += stockEntryRowHtml(e, byId[e.id], unit, e.voided ? null : checks[e.id]); });
  return h + '</div>' + kbLinkedHtml('stock', item.id, item.name, 'Knowledge');
}

function stockEntryRowHtml(e, r, unit, checks) {
  var when = e.from && e.from !== e.date ? stockShortDate(e.from) + ' – ' + stockShortDate(e.date) : stockShortDate(e.date);
  var src = e.source === 'paste' ? 'pasted' + (e.sentBy ? ', sent by ' + e.sentBy : '') : e.source === 'import' ? 'imported' : 'by hand';
  if (e.by) src += ' · entered by ' + e.by;
  var extra = [];
  if (e.kind === 'received' || e.kind === 'bill') {
    if (e.price != null) extra.push(formatCurrency(e.price) + '/' + (unit || 'unit'));
    if (e.supplier) extra.push(e.supplier);
    if (e.billNo) extra.push('invoice ' + e.billNo + (e.billDate && e.billDate !== e.date ? ' of ' + stockShortDate(e.billDate) : ''));
  }
  var into = stockEntryLines(e);
  if (into.length) extra.push('into ' + into.map(prodLineName).join(' and '));
  if (e.note && !(into.length && !stockNoteSansBaths(e.note))) extra.push(e.note);
  var gap = '';
  if (checks && checks.length) {
    gap = checks.map(function(c) { return '<div class="inv-callout inv-callout-warning inv-mt-8" data-check="' + escHtml(c.k) + '">' + escHtml(c.text) + '</div>'; }).join('') +
      '<button class="inv-btn inv-btn-sm inv-btn-ghost inv-mt-8" data-action="invStockCheckOk" data-id="' + escHtml(e.id) + '">It is right</button>';
  } else if (e.checkOk && !e.voided) {
    gap = '<div class="inv-row-meta">Checked: kept as entered' + (e.checkOk.by ? ' by ' + escHtml(e.checkOk.by) : '') + '</div>';
  } else if (e.kind === 'count' && r && r.before != null && stockRound(r.before) !== stockRound(e.qty)) {
    var d = stockRound(e.qty - r.before);
    gap = '<div class="inv-callout inv-callout-warning inv-mt-8">The app expected ' + escHtml(stockFmtQty(r.before)) + ' (' + (d > 0 ? '+' : '') + escHtml(stockFmtQty(d)) + ' unexplained)</div>';
  }
  var armed = _stockVoidArm === e.id;
  return '<div class="inv-row inv-row-auto inv-row-top' + (e.voided ? ' inv-row-muted' : '') + '" data-entry="' + escHtml(e.id) + '"><div class="inv-row-main">' +
    '<div class="inv-row-title">' + escHtml(STOCK_KIND_LABEL[e.kind] || e.kind) + ' <strong class="inv-num">' + escHtml(stockFmtQty(e.qty)) + ' ' + escHtml(unit) + '</strong>' +
    (e.unsettled ? ' <span class="inv-badge inv-badge-warning">Unsettled</span>' : '') + (e.voided ? ' <span class="inv-badge inv-badge-neutral">Voided</span>' : '') + '</div>' +
    '<div class="inv-row-meta inv-row-wrap">' + escHtml(when + ' · ' + src) + '</div>' +
    (extra.length ? '<div class="inv-row-meta inv-row-wrap">' + escHtml(extra.join(' · ')) + '</div>' : '') + gap +
    (e.raw ? '<details class="inv-mt-4"><summary class="inv-btn-link inv-summary">Message text</summary><div class="inv-quote inv-mt-4">' + escHtml(e.raw) + '</div></details>' : '') +
    (e.kind === 'received' && e.price == null && !e.voided ? '<button class="inv-btn inv-btn-secondary inv-btn-sm inv-mt-8" data-action="invStockBillOpen" data-entry="' + escHtml(e.id) + '">Add its bill</button>' : '') +
    '</div>' +
    (e.corrects ? '<div class="inv-row-meta">Corrects an entry of ' + escHtml(stockFmtQty(e.corrects.qty)) + ' ' + escHtml(unit) + '</div>' : '') +
    (e.voided && e.voided.reason ? '<div class="inv-row-meta">' + escHtml(e.voided.reason) + '</div>' : '') +
    (e.voided ? '' : '<div class="inv-row-end"><button class="inv-btn inv-btn-sm inv-btn-ghost" data-action="invStockCorrect" data-id="' + escHtml(e.id) + '">Correct</button>' +
      '<button class="inv-btn inv-btn-sm inv-btn-danger' + (armed ? ' inv-btn-solid' : '') + '" data-action="invStockVoid" data-id="' + escHtml(e.id) + '"' +
      (armed ? ' aria-pressed="true"' : '') + '>' + (armed ? 'Tap again to void' : 'Void') + '</button></div>') +
    '</div>';
}

/* A wrong entry is voided, never deleted: the export is the record's source,
   and an entry that vanished would leave soma-internal holding a figure the
   app no longer explains. */
function stockVoid(id) {
  // P1 (guard.js): asked at the first tap, so a role that may not void is told before arming; and at the second, which
  // passes within the window (another user unlocked between the taps is asked, or told).
  if (!grdGate('voids', 'void a stock entry', function() { stockVoid(id); })) return;
  if (_stockVoidArm !== id) { _stockVoidArm = id; renderStock(); return; }
  var e = stockData().entries.find(function(x) { return x.id === id; });
  _stockVoidArm = null;
  if (!e) return;
  e.voided = { at: Date.now(), by: stockBy() };
  saveState();
  renderStock();
  showToast('Entry voided');
}

/* A figure entered wrong is corrected, never edited in place: the entry is voided, saying what it was corrected to, and a
   copy with the right quantity takes its place (`corrects`), so the export still explains every figure it ever held. */
async function stockCorrect(id) {
  var e = stockData().entries.find(function(x) { return x.id === id; });
  if (!e || e.voided) return;
  if (!grdOk('floor') && !(await guardAsk('floor', 'correct a stock entry'))) return;   // the guard (guard.js): a floor entry
  var it = stockItem(e.itemId), unit = it ? it.unit || '' : '';
  var v = await uiPrompt({ title: 'Correct this entry', body: (STOCK_KIND_LABEL[e.kind] || e.kind) + ' ' + stockFmtQty(e.qty) + ' ' + unit + (it ? ' of ' + it.name : '') + ' on ' + stockShortDate(e.date) + '.',
    label: 'The right quantity' + (unit ? ' (' + unit + ')' : ''), value: String(e.qty), okLabel: 'Correct', required: true, requiredText: 'Enter the quantity.' });
  if (v == null) return;
  var q = parseFloat(String(v).replace(/,/g, ''));
  if (isNaN(q) || q < 0) { showToast('Enter a quantity of 0 or more', 'error'); return; }
  e = stockData().entries.find(function(x) { return x.id === id; });
  if (!e || e.voided) return;
  if (stockRound(q) === stockRound(e.qty)) { showToast('Same quantity: nothing changed'); return; }
  var by = stockBy(), at = Date.now();
  var copy = JSON.parse(JSON.stringify(e));
  copy.id = stockUid('SE'); copy.qty = q; copy.at = at; copy.by = by; copy.source = 'manual';
  copy.corrects = { id: e.id, qty: e.qty };
  // A priced entry keeps its price and amount in step with the quantity: the price per unit typed stays and the amount
  // follows; a price past the paisa was worked out from a bill's amount, so that amount stays and the price follows.
  if (copy.price != null && isFinite(copy.price) && q > 0) {
    var derived = copy.amount > 0 && Math.abs(copy.price * 100 - Math.round(copy.price * 100)) > 1e-6;
    if (derived) copy.price = Math.round(copy.amount / q * 10000) / 10000;
    else copy.amount = gstRound(copy.price * q);
  }
  delete copy.raw; delete copy.pasteId; delete copy.unsettled; delete copy.checkOk;
  e.voided = { at: at, by: by, reason: 'Corrected to ' + stockFmtQty(q) + ' ' + unit, correctedBy: copy.id };
  stockData().entries.push(copy);
  saveState();
  renderStock();
  showToast('Corrected: ' + stockFmtQty(e.qty) + ' → ' + stockFmtQty(q) + ' ' + unit, 'success');
}

/* ---------- An entry is checked before it is believed (the intelligence's first step, 6 Oct 2026) ----------
   Owner, 6 Oct 2026: the reddest finding on the To-do rested on a stock record nobody had been asked about. A pasted
   message misread by an older reader ("VAT A 2" read as 2 kg), the same use typed by hand beside the message that
   already held it, a count that is really a use: each is read as fact by the live cost, the days left and every margin.
   So an entry that does not fit is said where it is, and on the To-do, until it is corrected, voided or confirmed. Warn,
   never block: a figure can look odd and be right (`checkOk`). */
var STOCK_TWICE_DAYS = 4, STOCK_LARGE_X = 4, STOCK_COUNT_JUMP = 0.3, STOCK_CHECK_DAYS = 60;
function stockIsDraw(e) { return e.kind === 'used' || e.kind === 'charged'; }
/* The days an entry speaks for: a use over several days covers its window. */
function stockEntryWindow(e) { return [e.from && e.from < e.date ? e.from : e.date, e.date]; }
/* What does not fit on one line, entry by entry: { id: [{ k, text }] }. Voided entries and those confirmed are left out. */
/* Read afresh only when the record changes, and only for the last STOCK_CHECK_DAYS days: the list, the line, the callout
   and two To-do rules all ask, and a check older than the To check page lists is one nobody could find. */
var _stockChecksMemo = null;
function stockEntryChecks(itemId) {
  var st = stockData(), parts = [localDateStr()];
  st.items.forEach(function(i) { parts.push(i.id + ':' + i.basis); });
  st.entries.forEach(function(e) { parts.push(e.id + ':' + e.qty + ':' + e.date + ':' + e.kind + ':' + (e.voided ? 1 : 0) + (e.checkOk ? 1 : 0)); });
  var key = parts.join('|');
  if (!_stockChecksMemo || _stockChecksMemo.st !== st || _stockChecksMemo.key !== key) _stockChecksMemo = { st: st, key: key, by: {} };
  if (!_stockChecksMemo.by[itemId]) _stockChecksMemo.by[itemId] = _stockEntryChecks(itemId);
  return _stockChecksMemo.by[itemId];
}
function _stockEntryChecks(itemId) {
  var since = isoAddDays(localDateStr(), -STOCK_CHECK_DAYS);
  var it = stockItem(itemId), unit = it ? it.unit || '' : '', q = function(v) { return stockFmtQty(v) + (unit ? ' ' + unit : ''); };
  var list = stockItemEntries(itemId), rows = stockReplay(itemId).rows, byId = {}, out = {};
  rows.forEach(function(r) { byId[r.e.id] = r; });
  var add = function(e, k, text) { (out[e.id] = out[e.id] || []).push({ k: k, text: text }); };
  var dayRate = function(e) { return e.qty / Math.max(1, e.days || 1); };
  list.forEach(function(e) {
    if (e.checkOk || e.date < since) return;
    if (stockIsDraw(e) && e.qty > 0) {
      var w = stockEntryWindow(e), seen = {};
      list.forEach(function(g) {
        // The other side of a pair the owner kept as right is settled too.
        if (g === e || !stockIsDraw(g) || !(g.qty > 0) || g.checkOk) return;
        var earlier = (g.at || 0) < (e.at || 0) || ((g.at || 0) === (e.at || 0) && g.date < e.date);
        // The same quantity from the other door within a few days: most often one use entered twice.
        if (earlier && g.source !== e.source && stockRound(g.qty) === stockRound(e.qty) && Math.abs(isoDaysBetween(g.date, e.date)) <= STOCK_TWICE_DAYS && !seen.same) {
          seen.same = true;
          add(e, 'twice', 'The same ' + q(e.qty) + ' is ' + (g.source === 'paste' ? 'in the message' : 'entered by hand') + ' for ' + stockShortDate(g.date) + ': entered twice?');
        }
        // A use typed by hand for days a pasted message also covers for this line.
        var gw = stockEntryWindow(g);
        if (e.source === 'manual' && g.source === 'paste' && e.date >= gw[0] && e.date <= gw[1] && stockRound(g.qty) !== stockRound(e.qty) && !seen.msg) {
          seen.msg = true;
          add(e, 'overlap', 'The message for ' + (gw[0] !== gw[1] ? stockShortDate(gw[0]) + ' – ' : '') + stockShortDate(gw[1]) + ' already records ' + q(g.qty) + ' used on this line: is this the same use?');
        }
      });
      // Pasted after uses were typed by hand for the days it covers.
      if (e.source === 'paste') {
        var typed = list.filter(function(g) { return g.source === 'manual' && !g.checkOk && stockIsDraw(g) && g.qty > 0 && (g.at || 0) < (e.at || 0) && g.date >= w[0] && g.date <= w[1]; });
        if (typed.length) add(e, 'typed', 'Uses were typed by hand for these days before this message was pasted (' + typed.map(function(g) { return q(g.qty); }).join(', ') + '): one of the two is a second record.');
      }
      var r = byId[e.id];
      if (r && r.after != null && r.after < -Math.max(0.01, Math.abs(r.before || 0) * 0.005)) {
        add(e, 'below', 'Takes the level below zero (' + q(r.after) + '): a figure misread, or a count or delivery not entered.');
      }
      // Far more than the line usually takes in a day. A bath line is charged in lumps after a delivery, so it is not judged.
      if (it && it.basis !== 'charge') {
        var prev = list.filter(function(g) { return stockIsDraw(g) && g.qty > 0 && g !== e && g.date < e.date && g.date >= isoAddDays(e.date, -STOCK_CHECK_DAYS); }).map(dayRate);
        if (prev.length >= 5) {
          var med = numMedian(prev);
          if (med > 0 && dayRate(e) > STOCK_LARGE_X * med) add(e, 'large', q(stockRound(dayRate(e))) + ' a day, ' + Math.round(dayRate(e) / med) + ' times the usual ' + q(stockRound(med)) + ': a figure misread?');
        }
      }
    }
    if (e.kind === 'count') {
      var c = byId[e.id];
      if (c && c.before != null && c.before > 0) {
        var gap = stockRound(e.qty - c.before);
        if (Math.abs(gap) > Math.max(STOCK_COUNT_JUMP * c.before, 1)) {
          add(e, 'count', 'Counted ' + q(e.qty) + ' where the app had ' + q(c.before) + (gap < 0 ? ': a use typed as a count, or a figure misread?' : ', with no delivery entered: a delivery missing, or a figure misread?'));
        }
      }
    }
  });
  return out;
}
/* Every entry to check in the last STOCK_CHECK_DAYS days, newest first: [{ item, e, checks }]. */
function stockChecksAll() {
  var since = isoAddDays(localDateStr(), -STOCK_CHECK_DAYS), out = [];
  stockData().items.forEach(function(it) {
    if (it.active === false) return;
    var ch = stockEntryChecks(it.id);
    stockItemEntries(it.id).forEach(function(e) { if (ch[e.id] && e.date >= since) out.push({ item: it, e: e, checks: ch[e.id] }); });
  });
  return out.sort(function(a, b) { return a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : 0; });
}
/* Confirmed as right: the entry keeps who said so and when, and is never asked about again. */
function stockCheckOk(id) {
  if (!grdGate('floor', 'confirm a stock entry', function() { stockCheckOk(id); })) return;
  var e = stockData().entries.find(function(x) { return x.id === id; });
  if (!e || e.voided) return;
  e.checkOk = { at: Date.now(), by: stockBy() };
  saveState();
  renderStock();
  showToast('Kept as entered');
}

/* The entries just saved that do not fit, for the save's own message: { n, first }. */
function stockChecksFor(ids) {
  var want = {}, n = 0, first = '';
  ids.forEach(function(id) { want[id] = true; });
  var items = {};
  stockData().entries.forEach(function(e) { if (want[e.id]) items[e.itemId] = true; });
  Object.keys(items).forEach(function(itemId) {
    var ch = stockEntryChecks(itemId), it = stockItem(itemId);
    Object.keys(ch).forEach(function(id) { if (want[id]) { n++; if (!first) first = (it ? it.name + ': ' : '') + ch[id][0].text; } });
  });
  return { n: n, first: first };
}

/* ---------- Reading the messages again ----------
   A message is kept whole, so what an older reader made of it can be set beside what the reader makes of it now. The 28 Sep
   message's "ZINK 444 KG use VAT A 2 / 25/09/26/ 150 kg …" was saved as 2 kg charged; "65 M 54 LTR use 3+3+9=15" as a count of
   3 and a use of 54. A message read differently now is listed with both readings, and Use the new reading voids what the old
   one saved and puts the new one in its place, at the message's own time, so the order of the day is kept. Nothing changes
   until it is pressed. A figure the owner voided by hand stays voided, and a line the new reading cannot place keeps its
   old entries. */
// A use and a charge are one thing to the level and the cost: a line whose basis was changed since reads the same message
// as the other kind, which is not a different reading.
// The bath is part of what was read (PP3), as the entry's lines or, saved before them, the baths its note names: a use the
// reader now splits by bath reads differently, one whose note already named its one bath does not.
function stockRereadKey(e) { return [e.itemId, stockIsDraw(e) ? 'draw' : e.kind, stockRound(e.qty), e.date, stockEntryLines(e).join('+')].join('|'); }
/* What a message holds now: its entries, a correction standing for the entry it corrected. */
function stockPasteHeld(p) {
  var all = stockData().entries, byId = {};
  all.forEach(function(e) { byId[e.id] = e; });
  var own = all.filter(function(e) { return e.pasteId === p.id; });
  return own.map(function(e) {
    var cur = e;
    for (var n = 0; cur.voided && cur.voided.correctedBy && byId[cur.voided.correctedBy] && n < 50; n++) cur = byId[cur.voided.correctedBy];
    return { orig: e, cur: cur, live: !cur.voided, voidedByHand: !!(cur.voided && !cur.voided.correctedBy) };
  });
}
function stockRereadDiff(p) {
  if (!p || !p.text) return null;
  var parsed;
  try { parsed = parseStockMessage(p.text); } catch (x) { return null; }
  if (!parsed.lines.length) return null;
  parsed.text = p.text;
  if (!parsed.to) { parsed.from = p.from || null; parsed.to = p.to || null; }
  if (!parsed.to) return null;
  // The choices made at the review are the message's own (a balance picked, a nameless line placed): kept on the paste
  // since 6 Oct 2026, and replayed. A message saved before carries none, so a line that needed one is left as it was.
  var choices = p.choices || {};
  var res = resolveStockParse(parsed, choices);
  var held = stockPasteHeld(p), fresh = [], items = {}, stated = {}, freshOpen = {};
  // A line the owner corrected by hand (a correction stands for the entry it replaced) is the owner's ruling: the whole
  // line is left as it is, never voided under them.
  var ruled = {};
  held.forEach(function(h) { if (h.cur !== h.orig) ruled[h.orig.itemId] = true; });
  res.lines.forEach(function(r) {
    if (r.skip || !r.item || ruled[r.item.id]) return;   // a line the new reading cannot place, or one it would add: the old entries stand
    var hasChoice = choices['map' + r.idx] || choices['name' + r.idx];
    if (r.via === 'position' && !hasChoice) return;   // placed by position, which moves with every later message
    if (r.issues.some(function(i) { return i.code === 'balance'; }) && !choices['bal' + r.idx] && !p.choices) return;   // a balance the owner picked, not recorded
    items[r.item.id] = true;
    stated[r.item.id] = r.O;
    r.entries.forEach(function(e) {
      // An opening is saved only where it differs from what the app held before the message, which moves when an earlier
      // message is read again; so openings are compared by the figure the message states, apart from the rest.
      var rec = { itemId: r.item.id, kind: e.kind, qty: e.qty, date: e.date, seq: e.seq, n: r.src.n, raw: r.src.raw };
      ['from', 'days', 'rate', 'note', 'unsettled', 'lines'].forEach(function(k) { if (e[k] != null && e[k] !== '') rec[k] = e[k]; });
      if ((e.kind === 'used' || e.kind === 'charged') && !rec.days) rec.days = 1;
      if (e.kind === 'count' && e.note === 'opening') freshOpen[r.item.id] = rec; else fresh.push(rec);
    });
  });
  var mine = held.filter(function(h) { return items[h.orig.itemId] && !(h.orig.kind === 'count' && h.orig.note === 'opening'); });
  var left = {};
  fresh.forEach(function(e) { var k = stockRereadKey(e); left[k] = (left[k] || 0) + 1; });
  // What the message held and still reads the same (live or voided by hand) is settled; what reads differently and is live
  // is voided; what the new reading holds and nothing settled matches is added.
  var drop = [];
  mine.forEach(function(h) {
    var k = stockRereadKey(h.orig);
    if (left[k]) { left[k]--; return; }
    if (h.live) drop.push(h);
  });
  var addList = [], need = Object.assign({}, left);
  fresh.forEach(function(e) { var k = stockRereadKey(e); if (need[k]) { need[k]--; addList.push(e); } });
  Object.keys(items).forEach(function(id) {
    var O = stated[id], opens = held.filter(function(h) { return h.orig.itemId === id && h.orig.kind === 'count' && h.orig.note === 'opening'; });
    var same = opens.filter(function(h) { return O != null && stockRound(h.orig.qty) === stockRound(O); });
    opens.forEach(function(h) { if (same.indexOf(h) < 0 && h.live) drop.push(h); });
    // Read 3 where the message states 54: the old opening goes, and the stated one is added where the app does not hold it.
    if (!same.length && freshOpen[id]) addList.push(freshOpen[id]);
  });
  if (!drop.length && !addList.length) return null;
  return { paste: p, drop: drop, add: addList };
}
/* Every message read differently now, newest first. Messages with no text (an import's) are left out. */
/* Read afresh only when the record changes: the To-do asks on every redraw, and a message a day is 300 by the year's end. */
var _stockRereadMemo = null;
function stockRereadAll() {
  var st = stockData(), voided = 0;
  st.entries.forEach(function(e) { if (e.voided) voided++; });
  var key = [st.entries.length, voided, st.pastes.length, st.items.map(function(i) { return i.id + ':' + i.key + ':' + stockAliases(i).join('/') + ':' + (i.lastPos || ''); }).join(',')].join('|');
  if (_stockRereadMemo && _stockRereadMemo.st === st && _stockRereadMemo.key === key) return _stockRereadMemo.val;
  var val = st.pastes.slice().sort(function(a, b) { return (b.at || 0) - (a.at || 0); }).map(stockRereadDiff).filter(Boolean);
  _stockRereadMemo = { st: st, key: key, val: val };
  return val;
}
function stockRereadEntryText(e) {
  var it = stockItem(e.itemId), unit = it ? it.unit || '' : '', into = stockEntryLines(e);
  return (it ? it.name + ': ' : '') + (STOCK_KIND_LABEL[e.kind] || e.kind).toLowerCase() + ' ' + stockFmtQty(e.qty) + (unit ? ' ' + unit : '') + ' on ' + stockShortDate(e.date) +
    (into.length ? ', into ' + into.map(prodLineName).join(' and ') : '');
}
async function stockRereadApply(pasteId) {
  if (!grdOk('floor') && !(await guardAsk('floor', 'read a stock message again'))) return;
  var p = stockData().pastes.find(function(x) { return x.id === pasteId; });
  var d = stockRereadDiff(p);
  if (!d) { showToast('Nothing to change: it reads the same now'); renderStock(); return; }
  var ok = await uiConfirm({ title: 'Use the new reading?', okLabel: 'Use the new reading',
    body: (d.drop.length ? d.drop.length + (d.drop.length === 1 ? ' entry is' : ' entries are') + ' voided: ' + d.drop.map(function(h) { return stockRereadEntryText(h.cur); }).join('; ') + '. ' : '') +
      (d.add.length ? d.add.length + (d.add.length === 1 ? ' entry is' : ' entries are') + ' added: ' + d.add.map(stockRereadEntryText).join('; ') + '.' : '') });
  if (!ok) return;
  d = stockRereadDiff(stockData().pastes.find(function(x) { return x.id === pasteId; }));
  if (!d) { renderStock(); return; }
  var at = Date.now(), by = stockBy(), when = new Date(at).toLocaleDateString('en-IN');
  d.drop.forEach(function(h) { h.cur.voided = { at: at, by: by, reason: 'Read again on ' + when + ': the reader now reads this message differently' }; });
  d.add.forEach(function(e) {
    var rec = Object.assign({ id: stockUid('SE'), at: p.at || at, source: 'paste', pasteId: p.id, sentBy: p.sentBy || '', by: by, reread: at }, e);
    stockData().entries.push(rec);
  });
  (p.reread = p.reread || []).push({ at: at, by: by, voided: d.drop.length, added: d.add.length });
  saveState();
  renderStock();
  showToast('Read again: ' + d.drop.length + ' voided, ' + d.add.length + ' added', 'success');
}

/* Stock → To check: the entries that do not fit, and the messages read differently now. */
function stockCheckCounts() {
  var c = { entries: 0, messages: 0 };
  try { c.entries = stockChecksAll().length; c.messages = stockRereadAll().length; } catch (x) { /* a check never breaks the page */ }
  return c;
}
function stockCheckCalloutHtml() {
  var c = stockCheckCounts();
  if (!c.entries && !c.messages) return '';
  var parts = [];
  if (c.messages) parts.push(c.messages + (c.messages === 1 ? ' message reads' : ' messages read') + ' differently now');
  if (c.entries) parts.push(c.entries + (c.entries === 1 ? ' entry does' : ' entries do') + ' not fit the record');
  // What needs the owner is a row, never a callout (the tab map, §3e): what to check, and the one door to it.
  return '<div class="inv-panel inv-panel-flush" id="stockCheckNote"><div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">To check</span>' +
    '<span class="inv-row-meta">' + escHtml(parts.join(' · ') + ': until checked, they count as entered in the days left and the live cost') + '</span></span>' +
    uiRowEndHtml('', null, '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invStockCheckOpen">Check them</button>') + '</div></div>';
}
function renderStockCheck() {
  var h = stockBackBar('Stock', 'To check');
  var msgs = stockRereadAll(), list = stockChecksAll();
  h += '<div class="inv-panel inv-panel-flush" id="stockReread"><div class="inv-panel-head"><span class="inv-panel-title">Messages read differently now <span class="inv-panel-count">' + msgs.length + '</span></span></div>';
  if (!msgs.length) h += '<div class="inv-empty">Every saved message reads the same with the reader as it is now.</div>';
  msgs.forEach(function(d) {
    var p = d.paste;
    h += '<div class="inv-row inv-row-auto inv-row-top inv-row-flow" data-paste="' + escHtml(p.id) + '"><div class="inv-row-main">' +
      '<div class="inv-row-title">Message for ' + escHtml(p.from && p.from !== p.to ? stockShortDate(p.from) + ' – ' : '') + escHtml(p.to ? stockShortDate(p.to) : '') + '</div>' +
      '<div class="inv-row-meta inv-row-wrap">Pasted ' + escHtml(new Date(p.at).toLocaleDateString('en-IN')) + (p.sentBy ? ' · sent by ' + escHtml(p.sentBy) : '') + '</div>';
    if (d.drop.length) h += '<div class="inv-row-meta inv-row-wrap">Read then: ' + escHtml(d.drop.map(function(x) { return stockRereadEntryText(x.cur); }).join('; ')) + '</div>';
    if (d.add.length) h += '<div class="inv-row-meta inv-row-wrap">Read now: ' + escHtml(d.add.map(stockRereadEntryText).join('; ')) + '</div>';
    var raws = {};
    d.drop.forEach(function(x) { if (x.orig.raw) raws[x.orig.raw] = 1; });
    d.add.forEach(function(x) { if (x.raw) raws[x.raw] = 1; });
    Object.keys(raws).forEach(function(r) { h += '<div class="inv-quote inv-mt-4">' + escHtml(r) + '</div>'; });
    h += '</div><div class="inv-row-end inv-row-actions inv-toolbar inv-toolbar-tight"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invStockReread" data-id="' + escHtml(p.id) + '">Use the new reading</button></div></div>';
  });
  h += '</div>';
  h += '<div class="inv-panel inv-panel-flush" id="stockChecks"><div class="inv-panel-head"><span class="inv-panel-title">Entries that do not fit <span class="inv-panel-count">' + list.length + '</span></span></div>';
  if (!list.length) h += '<div class="inv-empty">No entry in the last ' + STOCK_CHECK_DAYS + ' days needs a second look.</div>';
  list.forEach(function(x) {
    var unit = x.item.unit || '';
    h += '<div class="inv-row inv-row-auto inv-row-top inv-row-flow" data-entry="' + escHtml(x.e.id) + '"><div class="inv-row-main">' +
      '<div class="inv-row-title">' + escHtml(x.item.name) + ' &middot; ' + escHtml(STOCK_KIND_LABEL[x.e.kind] || x.e.kind) + ' <strong class="inv-num">' + escHtml(stockFmtQty(x.e.qty) + (unit ? ' ' + unit : '')) + '</strong></div>' +
      '<div class="inv-row-meta inv-row-wrap">' + escHtml(stockShortDate(x.e.date) + ' · ' + (x.e.source === 'paste' ? 'pasted' : x.e.source === 'import' ? 'imported' : 'by hand') + (x.e.by ? ' · entered by ' + x.e.by : '')) + '</div>' +
      x.checks.map(function(c) { return '<div class="inv-callout inv-callout-warning inv-mt-8">' + escHtml(c.text) + '</div>'; }).join('') +
      (x.e.raw ? '<div class="inv-quote inv-mt-4">' + escHtml(x.e.raw) + '</div>' : '') +
      '</div><div class="inv-row-end inv-row-actions inv-toolbar inv-toolbar-tight"><button class="inv-btn inv-btn-sm inv-btn-secondary" data-action="invStockOpen" data-id="' + escHtml(x.item.id) + '">Open the line</button>' +
      '<button class="inv-btn inv-btn-sm inv-btn-ghost" data-action="invStockCheckOk" data-id="' + escHtml(x.e.id) + '">It is right</button></div></div>';
  });
  return h + '</div><div class="inv-note">Correct or void an entry on its line. A message read again keeps every entry typed by hand: an entry it made redundant shows here as entered twice.</div>';
}

/* ---------- Export and import ----------
   The export is always the whole record: every line, every entry, every
   message as pasted. soma-internal de-duplicates on the ids at each compile. */
function stockExport() {
  var st = stockData();
  var meta = document.querySelector('meta[name="app-build"]');
  var out = { format: 'sep-stock', version: 1, exportedAt: new Date().toISOString(), build: meta ? meta.content : '',
    items: st.items, entries: st.entries, pastes: st.pastes };
  downloadJson('sep-stock-' + localDateStr() + '.json', out, 2);
  showToast('Stock exported: ' + st.entries.length + ' entries');
}

/* A JSON file handed to the browser to save; its object URL is let go once the click has taken it. Stock's export and
   Production's share it (stock's never let its URL go). */
function downloadJson(name, obj, indent) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, indent)], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
}

// Merges; never overwrites. A line matches by id, then by name.
function stockMergeImport(src) {
  if (!src || typeof src !== 'object') throw new Error('not a stock file');
  if (src.format !== 'sep-stock' && src.stock) src = src.stock;
  if (!Array.isArray(src.items) || !Array.isArray(src.entries)) throw new Error('not a stock file');
  var st = stockData(), idMap = {}, added = { items: 0, entries: 0, pastes: 0, held: 0, differ: 0 };
  src.items.forEach(function(it) {
    if (!it || !it.id || typeof it.name !== 'string' || !it.name.trim()) return;
    var mine = stockItem(it.id) || stockFindByKey(it.key || stockKey(it.name));
    if (mine) { idMap[it.id] = mine.id; return; }
    var copy = JSON.parse(JSON.stringify(it));
    copy.key = copy.key || stockKey(copy.name);
    // A position is printed on the sheets and a spelling is matched as a whole name: anything else from a file is
    // dropped rather than left to reach the page as markup or match a fragment.
    if (!(Number.isInteger(copy.lastPos) && copy.lastPos > 0)) delete copy.lastPos;
    copy.aliases = stockAliases(copy);
    st.items.push(copy); idMap[it.id] = copy.id; added.items++;
  });
  var have = {};
  st.entries.forEach(function(e) { have[e.id] = e; });
  var num = function(v) { return typeof v === 'number' && isFinite(v); };
  var same = function(a, b) { var ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); return ka.join() === kb.join() && ka.every(function(k) { return JSON.stringify(a[k]) === JSON.stringify(b[k]); }); };
  src.entries.forEach(function(e) {
    if (!e || !e.id || !idMap[e.itemId]) return;
    // Held here: never overwritten, but counted, and one the file carries changed (voided or priced elsewhere) is said.
    if (have[e.id]) { added.held++; if (!same(have[e.id], Object.assign({}, e, { itemId: idMap[e.itemId] }))) added.differ++; return; }
    // A file is data from elsewhere: an entry must be a known kind with real
    // numbers and a real day, or it is dropped rather than left to break the screens.
    if (!STOCK_KIND_LABEL[e.kind] || !num(e.qty) || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return;
    var copy = JSON.parse(JSON.stringify(e));
    copy.itemId = idMap[e.itemId];
    ['price', 'amount', 'days', 'rate', 'at', 'seq'].forEach(function(k) { if (copy[k] != null && !num(copy[k])) delete copy[k]; });
    if (copy.billDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(copy.billDate)) delete copy.billDate;
    st.entries.push(copy); added.entries++;
  });
  // Power and other bills may travel in the same file (the purchases carried
  // over from soma-internal do). Merged by id, like everything else here.
  added.bills = 0;
  (Array.isArray(src.costBills) ? src.costBills : []).forEach(function(b) {
    if (!b || !b.id || (b.kind !== 'power' && b.kind !== 'other') || !/^\d{4}-\d{2}$/.test(b.month || '') || !num(b.amount)) return;
    if (costBills().some(function(x) { return x.id === b.id; })) return;
    costBills().push(JSON.parse(JSON.stringify(b))); added.bills++;
  });
  (src.pastes || []).forEach(function(p) {
    if (!p || !p.id || st.pastes.some(function(x) { return x.id === p.id; })) return;
    st.pastes.push(JSON.parse(JSON.stringify(p))); added.pastes++;
  });
  return added;
}

function stockImport() {
  if (!grdGate('imports', 'import stock records', stockImport)) return;   // P1 (guard.js)
  var inp = document.getElementById('stockFileInput');
  if (!inp) return;
  inp.onchange = function(ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function(e2) { stockImportText(e2.target.result, f.name); };
    reader.readAsText(f);
  };
  inp.click();
}
/* A sep-stock file's text, from Stock's Import or from Add → File (add.js). */
function stockImportText(text, name) {
  try {
    var added = stockMergeImport(JSON.parse(text));
    saveState();
    renderStock();
    var held = (added.held ? ' · ' + added.held + ' already held' : '') + (added.differ ? ' (' + added.differ + ' differ in the file, kept as held)' : '');
    showToast((added.entries || added.items || added.bills ? 'Imported ' + added.items + ' lines, ' + added.entries + ' entries' + (added.bills ? ', ' + added.bills + ' power/other bills' : '') : 'Nothing new in that file') + held, added.differ ? 'warning' : undefined);
  } catch (err) { if (!addFileElsewhere(text, name, 'stock')) showToast('Not a stock file', 'error'); }
}

/* ---------- Actions ---------- */
function stockAction(action, btn) {
  switch (action) {
    case 'invStockPaste': stockSetView('paste'); break;
    case 'invStockRead': stockReadPaste(); break;
    case 'invStockManual': stockOpenManual(); break;
    case 'invStockBack':
      if (_stockView === 'review') { stockSetView('paste'); break; }
      // A bill left open under a delivery on the hand form goes with it (it would reappear on the line's page).
      if (_stockView === 'manual') _stockBill = null;
      _stockReview = null; _stockManual = null; _stockReorder = null; stockSetView(_stockHome); break;
    case 'invStockOpen': _stockItemId = btn.dataset.id; _stockSpendOpen = false; stockSetView('item'); break;
    case 'invStockPaneClose': _stockSpendOpen = false; stockSetView('list'); break;
    // The desktop's Spend and prices: the pane beside the list, in place of an open line (a second press shuts it).
    case 'invStockSpend': _stockSpendOpen = !(_stockSpendOpen && _stockView !== 'item'); _stockView = 'list'; renderStock(); break;
    case 'invStockFilter': _stockFilter = _stockFilter === btn.dataset.v ? null : btn.dataset.v; stockSetView('list'); break;
    case 'invStockBal':
      if (_stockReview) { _stockReview.choices['bal' + btn.dataset.i] = btn.dataset.v; renderStock(); }
      break;
    case 'invStockSavePaste': stockSavePaste(); break;
    case 'invStockMode': if (_stockManual) { _stockManual.mode = btn.dataset.mode; renderStock(); } break;
    case 'invStockSaveManual': stockSaveManual(); break;
    case 'invStockAddLine': stockAddLine(); break;
    case 'invStockBasis': {
      var it = stockItem(_stockItemId);
      if (it) { it.basis = btn.dataset.v === 'charge' ? 'charge' : 'draw'; saveState(); renderStock(); }
      break;
    }
    case 'invStockVoid': stockVoid(btn.dataset.id); break;
    case 'invStockCorrect': stockCorrect(btn.dataset.id); break;
    case 'invStockExport': stockExport(); break;
    case 'invStockBillOpen': stockBillOpen(btn.dataset.entry || ''); break;
    case 'invStockReorder': _stockReorder = { qty: {} }; stockSetView('reorder'); break;
    case 'invStockReorderCopy': stockReorderCopy(); break;
    // On the hand form, a bill saved or cancelled leaves it typed only if a figure is still waiting in it.
    case 'invStockBillSave': stockBillSave(); if (!_stockBill && _stockView === 'manual') _pageTyped = stockManualTyped(); break;
    case 'invStockBillCancel': _stockBill = null; renderStock(); if (_stockView === 'manual') _pageTyped = stockManualTyped(); break;
    case 'invStockImport': stockImport(); break;
    case 'invStockCheckOpen': stockSetView('check'); break;
    case 'invStockCheckOk': stockCheckOk(btn.dataset.id); break;
    case 'invStockReread': stockRereadApply(btn.dataset.id); break;
  }
}

function stockOnInput(t) {
  if (t.id === 'stockPasteText') { _stockPasteDraft = t.value; return true; }
  if (t.id === 'stockBy') { setStockBy(t.value.trim()); return true; }
  if (t.id === 'stockSentBy') { if (_stockReview) _stockReview.sentBy = t.value.trim(); return true; }
  // Held as typed, so Save reads it even if the field never lost focus.
  var tn = t.getAttribute && t.getAttribute('data-stock-name');
  if (tn != null && _stockReview) { _stockReview.choices['name' + tn] = t.value.trim(); return true; }
  if (stockBillOnInput(t)) return true;
  if (stockReorderOnInput(t)) return true;
  if (!_stockManual) return false;
  if (t.id === 'stockManSupplier') { _stockManual.supplier = t.value.trim(); return true; }
  if (t.id === 'stockManBill') { _stockManual.billNo = t.value.trim(); return true; }
  if (t.id === 'stockManBillDate') { _stockManual.billDate = t.value; return true; }
  if (t.id === 'stockManBath') { _stockManual.bath = t.value.trim(); return true; }
  var q = t.getAttribute && t.getAttribute('data-stock-qty');
  if (q) { (_stockManual.vals[q] = _stockManual.vals[q] || {}).qty = t.value; return true; }
  var p = t.getAttribute && t.getAttribute('data-stock-price');
  if (p) { (_stockManual.vals[p] = _stockManual.vals[p] || {}).price = t.value; return true; }
  return false;
}

function stockCommitName(t, redraw) {
  var ni = t.getAttribute('data-stock-name');
  if (ni == null || !_stockReview) return;
  _stockReview.choices['name' + ni] = t.value.trim();
  if (t.value.trim()) delete _stockReview.choices['map' + ni];
  if (redraw) renderStock();
}

function stockOnChange(t) {
  var mi = t.getAttribute && t.getAttribute('data-stock-map');
  if (mi != null && _stockReview) {
    _stockReview.choices['map' + mi] = t.value;
    delete _stockReview.choices['name' + mi];
    renderStock(); return true;
  }
  // Leaving the field only keeps the name. It must not redraw: the blur that
  // fires this is usually the tap on Save, and redrawing replaces the button
  // under the finger, so the tap was lost. Enter redraws (stockCommitName).
  var ni = t.getAttribute && t.getAttribute('data-stock-name');
  if (ni != null && _stockReview) { stockCommitName(t, false); return true; }
  // Redrawn: the invoice date (until typed) and the action bar follow the day; they kept the old one on screen.
  if (t.id === 'stockManDate' && _stockManual) { _stockManual.date = t.value; renderStock(); return true; }
  if ((t.id === 'stockLeadDays' || t.id === 'stockCoverDays') && _stockReorder) { stockReorderOnInput(t); renderStock(); return true; }
  return false;
}
