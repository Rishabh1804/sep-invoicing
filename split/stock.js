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
function stockIsoFromDmy(d, m, y) {
  d = +d; m = +m; y = +y;
  if (y < 100) y += 2000;
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return null;
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function stockTokens(text) {
  var src = String(text).replace(/(\d)\s*[x×*X]\s*(\d)/g, '$1×$2');
  var re = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?|(\d+(?:\.\d+)?)\s*(days?)\b|(\d+(?:\.\d+)?)|([+\-=×])|([A-Za-z][A-Za-z0-9.]*)|(\S)/gi;
  var out = [], m;
  while ((m = re.exec(src))) {
    if (m[1]) out.push({ t: 'date', v: stockIsoFromDmy(m[1], m[2], m[3]) });
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

/* One numbered line → its name, and the four figures a take can state:
   O opening, A received, U used, C left. Anything it cannot place is reported,
   never dropped: a number the parser does not understand is a question. */
function parseStockLine(body) {
  var toks = stockTokens(body);
  var r = { name: '', unit: '', O: null, A: null, U: null, C: null, addDate: null, useDate: null,
    days: null, rate: null, note: '', issues: [], unread: [] };

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

  // Chains: n (op n)+, where "=" states the running total.
  var chainResult = null;
  for (var s = 0; s < sig.length; s++) {
    if (sig[s].t !== 'num' || claimed[s] || !(sig[s + 1] && sig[s + 1].t === 'op' && sig[s + 2] && sig[s + 2].t === 'num')) continue;
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
      else if (op === '-') { r.U = stockRound((r.U || 0) + n.v); total = stockRound(total - n.v); if (n.days) { r.days = n.days; r.rate = n.rate; } }
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

  for (var p = 0; p < sig.length; p++) {
    var tp = sig[p];
    if (tp.t !== 'kw') continue;
    if (tp.v === 'nil') {
      r.C = 0;
      if (sig[p + 1] && sig[p + 1].t === 'num' && sig[p + 1].v === 0) claimed[p + 1] = true;
    } else if (tp.v === 'add') {
      var q0 = p + 1;
      if (sig[q0] && sig[q0].t === 'date') { r.addDate = sig[q0].v; q0++; }
      if (r.A == null && sig[q0] && sig[q0].t === 'num' && !claimed[q0]) { r.A = sig[q0].v; claimed[q0] = true; }
    } else if (tp.v === 'use') {
      var notes = [];
      for (var q1 = p + 1; q1 < sig.length; q1++) {
        var tq1 = sig[q1];
        if (tq1.t === 'date') { r.useDate = tq1.v; continue; }
        if (tq1.t === 'days') { r.days = tq1.v; continue; }
        if (tq1.t === 'text') { notes.push(tq1.v); continue; }
        break;
      }
      if (notes.length) r.note = notes.join(' ');
      var after = sig[q1] && sig[q1].t === 'num' ? q1 : -1;
      if (after >= 0 && !claimed[after]) {
        if (r.U == null) { r.U = sig[after].v; if (sig[after].days) { r.days = sig[after].days; r.rate = sig[after].rate; } }
        claimed[after] = true;
      } else {
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
  if (r.C == null && chainResult) r.C = chainResult.v;

  var loose = [];
  sig.forEach(function(tk, idx) { if (tk.t === 'num' && !claimed[idx]) loose.push(idx); });
  if (r.C == null && loose.length) { r.C = sig[loose[loose.length - 1]].v; loose.pop(); }
  if (r.O == null && loose.length) { r.O = sig[loose[0]].v; loose.shift(); }
  loose.forEach(function(idx) { r.unread.push(String(sig[idx].v)); });

  if (r.U != null && r.days == null) {
    sig.forEach(function(tk) { if (tk.t === 'days' && r.days == null) r.days = tk.v; });
  }
  if (r.U != null && r.days && r.rate == null) r.rate = stockRound(r.U / r.days);
  if (r.C == null && r.A == null && r.U == null && r.O == null) {
    r.issues.push({ level: 'red', code: 'nofigure', text: 'No quantity found on this line' });
  }
  return r;
}

var STOCK_ITEM_RE = /^\s*(\d{1,2})\s*[).]\s*(.*)$/;
var STOCK_WA_RE = /^\s*\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?\]?\s*(?:-\s*)?([^:]{1,40}):\s*(.*)$/;

/* The whole message → its window, its sender if the WhatsApp line came with
   it, and one entry per numbered line. */
function parseStockMessage(text) {
  var out = { from: null, to: null, sentBy: '', sentOn: null, header: [], lines: [], unread: [] };
  var lines = String(text || '').replace(/\r/g, '').split('\n');
  var cur = null, dates = [];
  lines.forEach(function(raw) {
    var line = raw;
    var wa = line.match(STOCK_WA_RE);
    if (wa) {
      if (!out.sentBy) {
        out.sentBy = wa[4].trim();
        // Copied timestamps follow the phone's locale; day-first unless impossible.
        var a = +wa[1], b = +wa[2];
        out.sentOn = a > 12 ? stockIsoFromDmy(a, b, wa[3]) : b > 12 ? stockIsoFromDmy(b, a, wa[3]) : stockIsoFromDmy(a, b, wa[3]);
      }
      line = wa[5];
    }
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
    while ((dm = dre.exec(line))) { var iso = stockIsoFromDmy(dm[1], dm[2], dm[3]); if (iso) { dates.push(iso); found = true; } }
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
  return {
    redDays: c.redDays > 0 ? c.redDays : d.redDays,
    amberDays: c.amberDays > 0 ? c.amberDays : d.amberDays,
    chemModel: c.chemModel > 0 ? c.chemModel : d.chemModel
  };
}
function stockUid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function stockItem(id) { return stockData().items.find(function(i) { return i.id === id; }) || null; }
function stockIsoAdd(iso, days) {
  var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
// Days in a window, Sundays out — the shop's own divisor (16–22 Sep is "6 day").
function stockWorkingDays(from, to) {
  if (!from || !to || to < from) return 1;
  var n = 0, d = from;
  for (var guard = 0; d <= to && guard < 400; guard++) {
    if (new Date(d + 'T00:00:00').getDay() !== 0) n++;
    d = stockIsoAdd(d, 1);
  }
  return Math.max(1, n);
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
var STOCK_KIND_RANK = { count: 3, received: 1, used: 2, charged: 2, bill: 0 };
function stockSortEntries(list) {
  return list.slice().sort(function(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if ((a.at || 0) !== (b.at || 0)) return (a.at || 0) - (b.at || 0);
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
    else level = (level || 0) - e.qty;
    level = stockRound(level);
    rows.push({ e: e, before: before, after: level });
  });
  return { level: level, rows: rows };
}
/* Daily rate: what was used over the last three weeks of record ÷ the days it
   covers. Fewer than three days is not a rate yet — the mark says so. */
function stockRate(item) {
  var kinds = item.basis === 'charge' ? ['charged', 'used'] : ['used'];
  var list = stockItemEntries(item.id).filter(function(e) { return kinds.indexOf(e.kind) >= 0; });
  if (!list.length) return null;
  var last = list[list.length - 1].date, cut = stockIsoAdd(last, -20);
  var qty = 0, days = 0;
  list.forEach(function(e) { if (e.date >= cut) { qty += e.qty; days += (e.days || 1); } });
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
function updateStockBadge() {
  var b = document.getElementById('moreBadge');
  if (!b) return;
  // Every red row: stock out or under the red line, and your own tasks overdue.
  var n = typeof todoRedCount === 'function' ? todoRedCount() : stockOutCount();
  b.textContent = n ? String(n) : '';
  b.classList.toggle('inv-hidden', !n);
  if (typeof updateSideCounts === 'function') updateSideCounts();
}

/* ---------- Resolving a parsed message against the app's lines ---------- */
function stockHash(text) {
  var src = String(text || '').split('\n').map(function(l) { var m = l.match(STOCK_WA_RE); return m ? m[5] : l; })
    .join(' ').toUpperCase().replace(/\s+/g, ' ').trim();
  var h = 5381;
  for (var i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36) + src.length;
}
function stockFindByKey(key) {
  if (!key) return null;
  return stockData().items.find(function(i) { return i.key === key || (i.aliases || []).indexOf(key) >= 0; }) || null;
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
        var uFrom = l.useDate || from;
        r.entries.push({ kind: basis === 'charge' ? 'charged' : 'used', qty: U, date: l.useDate || to, from: uFrom, seq: 2,
          days: l.useDate ? 1 : (l.days || stockWorkingDays(from, to)), rate: l.rate, note: l.note ? stockKey(l.note) : '' });
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
  res.dup = stockData().pastes.find(function(p) { return p.hash === stockHash(parsed.text || ''); }) || null;
  return res;
}

/* Save a reviewed message. Every entry keeps the line it came from, and the
   message itself is kept whole, so the export can always show its source. */
function stockCommitPaste(parsed, res, meta) {
  var st = stockData(), at = Date.now(), pasteId = stockUid('SP');
  var made = 0, lines = 0, skipped = 0;
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
    if (r.via === 'chosen' && r.src.key && item.key !== r.src.key && (item.aliases || []).indexOf(r.src.key) < 0) {
      item.aliases = (item.aliases || []).concat([r.src.key]);
    }
    if (!item.unit && r.src.unit) item.unit = r.src.unit;
    st.items.forEach(function(i) { if (i.lastPos === r.src.n && i !== item) delete i.lastPos; });
    item.lastPos = r.src.n;
    lines++;
    r.entries.forEach(function(e) {
      var rec = { id: stockUid('SE'), itemId: item.id, kind: e.kind, qty: e.qty, date: e.date, seq: e.seq, at: at,
        source: 'paste', pasteId: pasteId, n: r.src.n, raw: r.src.raw, sentBy: meta.sentBy || '', by: meta.by || '' };
      ['from', 'days', 'rate', 'note', 'unsettled'].forEach(function(k) { if (e[k] != null && e[k] !== '') rec[k] = e[k]; });
      if (e.kind === 'used' || e.kind === 'charged') { if (!rec.days) rec.days = 1; }
      st.entries.push(rec);
      made++;
    });
  });
  // A message that saved nothing is not recorded: its fingerprint would refuse
  // the corrected paste as a duplicate of something that never landed.
  if (made) {
    st.pastes.push({ id: pasteId, at: at, by: meta.by || '', sentBy: meta.sentBy || '', from: res.from, to: res.to,
      hash: stockHash(parsed.text || ''), text: parsed.text || '' });
  }
  return { entries: made, lines: lines, skipped: skipped };
}

/* ---------- Screens ---------- */
var _stockView = 'overview';
var _stockHome = 'overview';   // Overview or Lines, whichever was open last: where Back returns to
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

/* The view tabs, and the toolbar under them: Paste message is the page's one primary. */
function stockToolbarHtml() {
  var lines = _stockView !== 'overview';
  return '<div class="inv-toolbar"><button class="inv-btn inv-btn-primary" data-action="invStockPaste">Paste message</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invStockManual">Enter by hand</button>' +
    (lines ? '<button class="inv-btn inv-btn-ghost" data-action="invStockReorder">Reorder list</button>' +
      '<button class="inv-btn inv-btn-ghost" data-action="invStockExport">Export</button>' +
      '<button class="inv-btn inv-btn-ghost" data-action="invStockImport">Import</button>' +
      '<input type="file" accept=".json,application/json" id="stockFileInput" class="inv-hidden">' : '') + '</div>';
}

function renderStock() {
  var el = document.getElementById('stockContent');
  if (!el) return;
  stockData();
  if (_stockView === 'paste') el.innerHTML = renderStockPaste();
  else if (_stockView === 'review' && _stockReview) el.innerHTML = renderStockReview();
  else if (_stockView === 'manual' && _stockManual) el.innerHTML = renderStockManual();
  // On the desktop a line opens in the pane beside the table; on the phone it is a page of its own.
  else if (_stockView === 'item' && stockItem(_stockItemId)) el.innerHTML = _isDesktop ? stockViewTabsHtml() + renderStockList(stockItem(_stockItemId)) : renderStockItem(stockItem(_stockItemId));
  else if (_stockView === 'reorder' && _stockReorder) el.innerHTML = renderStockReorder();
  else if (_stockView === 'overview') { _stockHome = 'overview'; el.innerHTML = stockViewTabsHtml() + stockToolbarHtml() + stockOverviewHtml(); }
  else { _stockView = _stockHome = 'list'; el.innerHTML = stockViewTabsHtml() + renderStockList(null); }
  updateStockBadge();
}

function stockSetView(v) {
  _stockView = v;
  _stockVoidArm = null;
  renderStock();
  window.scrollTo(0, 0);
}

function renderStockList(open) {
  var st = stockData();
  var items = st.items.filter(function(i) { return i.active !== false; });
  var lastCount = null;
  st.entries.forEach(function(e) { if (!e.voided && e.kind === 'count' && (!lastCount || e.date > lastCount.date || (e.date === lastCount.date && e.at > lastCount.at))) lastCount = e; });
  var h = '<div class="inv-pagehead"><span class="inv-pagehead-meta">' + items.length + (items.length === 1 ? ' line' : ' lines') +
    (lastCount ? ' · last count ' + escHtml(stockShortDate(lastCount.date)) + (lastCount.sentBy ? ', ' + escHtml(lastCount.sentBy) : '') : '') + '</span></div>' +
    stockToolbarHtml();

  if (!items.length) {
    return h + '<div class="inv-panel"><div class="inv-empty">No stock recorded yet. Paste the supervisor\'s stock message: ' +
      'its lines become the list, and every figure keeps the text it came from. Or import a stock file.</div></div>';
  }
  var groups = { out: [], low: [], ok: [], bath: [], none: [] };
  items.forEach(function(i) { var s = stockStatus(i); groups[s.group].push({ item: i, st: s }); });
  groups.low.sort(function(a, b) { return a.st.daysLeft - b.st.daysLeft; });
  groups.ok.sort(function(a, b) { return a.st.daysLeft - b.st.daysLeft; });
  ['out', 'bath', 'none'].forEach(function(g) { groups[g].sort(function(a, b) { return a.item.name < b.item.name ? -1 : 1; }); });

  // Each tile filters the list to its lines; pressed again, it lets them all back.
  var amber = stockCfg().amberDays;
  var tile = function(g, n, label, tone) {
    return '<button class="inv-tile' + (n && tone ? ' inv-tile-' + tone : '') + '" data-action="invStockFilter" data-v="' + g + '" aria-pressed="' + (_stockFilter === g) + '">' +
      '<div class="inv-tile-label">' + label + '</div><div class="inv-tile-value">' + n + '</div></button>';
  };
  h += '<div class="inv-tiles inv-tiles-4" id="stockTiles">' + tile('out', groups.out.length, 'Out', 'danger') + tile('low', groups.low.length, amber + ' days or less', 'warning') +
    tile('ok', groups.ok.length, 'OK', '') + tile('none', groups.none.length + groups.bath.length, 'No rate', '') + '</div>';

  var titles = { out: 'Out', low: amber + ' days or less', ok: 'OK', bath: 'Charged to the bath', none: 'No daily rate yet' };
  var shown = ['out', 'low', 'ok', 'bath', 'none'].filter(function(g) {
    return groups[g].length && (!_stockFilter || _stockFilter === g || (_stockFilter === 'none' && g === 'bath'));
  });
  if (!shown.length) return h + '<div class="inv-panel"><div class="inv-empty">No line in this group. Press the tile again to see every line.</div></div>';
  if (_isDesktop) return h + stockLinesTableHtml(groups, shown, titles, open);
  h += '<div class="inv-panel inv-panel-flush" id="stockLines">';
  shown.forEach(function(g) {
    h += '<div class="inv-row-group"><span>' + escHtml(titles[g]) + '</span><span class="inv-num">' + groups[g].length + '</span></div>';
    groups[g].forEach(function(x) { h += stockRowHtml(x.item, x.st); });
  });
  return h + '</div>';
}

function stockRowHtml(item, s) {
  return '<button class="inv-row inv-row-2" data-action="invStockOpen" data-id="' + escHtml(item.id) + '" data-tone="' + s.tone + '">' +
    '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(item.name) + '</span>' +
    '<span class="inv-row-meta">' + escHtml(stockRowSub(item, s)) + (stockUnsettled(item) ? ' <span class="inv-badge inv-badge-warning">Count unsettled</span>' : '') + '</span></span>' +
    '<span class="inv-row-end inv-row-stack">' + stockQtyUnit(s.level, item.unit || '') + stockStatusDot(s) + '</span></button>';
}

/* The desktop: one table grouped by status, and the open line in the pane beside it. */
function stockLinesTableHtml(groups, shown, titles, open) {
  var h = '<div class="inv-pane-host' + (open ? ' inv-pane-open' : '') + '" id="stockMasterDetail"><div class="inv-pane-list" id="stockLines">' +
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
  if (r.U != null) parts.push('−' + stockFmtQty(r.U) + ' used' + (r.src.days ? ' (' + r.src.days + ' days)' : ''));
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
  h += '<div class="inv-panel"><div class="inv-kv inv-mb-8">' +
    '<div><div class="inv-kv-k">Covers</div><div>' + escHtml(stockShortDate(p.from)) + (p.to !== p.from ? ' – ' + escHtml(stockShortDate(p.to)) : '') + '</div></div>' +
    '<div><div class="inv-kv-k">Count dated</div><div>' + escHtml(stockShortDate(p.to)) + (p.noDate ? ' (no date in the message: today)' : '') + '</div></div></div>' +
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
  var res = resolveStockParse(rv.parsed, rv.choices);
  if (res.dup) { showToast('Already saved — nothing saved twice', 'error'); return; }
  var by = stockBy();
  var out = stockCommitPaste(rv.parsed, res, { sentBy: rv.sentBy, by: by });
  if (!out.entries) { showToast('Nothing to save: pick a line for each unnamed row', 'error'); return; }
  saveState();
  _stockReview = null; _stockPasteDraft = '';
  stockSetView('list');
  showToast(out.entries + ' entries saved from ' + out.lines + ' lines' + (out.skipped ? ' · ' + out.skipped + ' not saved' : ''));
}

function stockOpenManual() {
  _stockManual = { mode: 'count', date: localDateStr(), supplier: '', billNo: '', billDate: '', bath: '', vals: {} };
  stockSetView('manual');
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
  if (m.mode === 'charged') {
    h += field('stockManBath', 'Into', '<input id="stockManBath" class="inv-input" value="' + escHtml(m.bath) + '" placeholder="VAT A1, Barrel…" autocomplete="off">');
  }
  h += field('stockBy', 'Entered by', '<input id="stockBy" class="inv-input" value="' + escHtml(stockBy()) + '" autocomplete="off">') + '</div>';
  var hints = { count: 'What is on the shelf now. The app compares it with its own level.', received: 'A delivery, with its bill. The price per unit is what the live cost is worked out at.',
    used: 'Drawn from stock. Sets the daily rate.', charged: 'Put into a bath, e.g. zinc or salts.' };
  h += '<div class="inv-note">' + hints[m.mode] + ' Fill only the lines that changed.</div></div>';
  h += '<div class="inv-panel inv-panel-flush" id="stockManualList"><div class="inv-panel-head"><span class="inv-panel-title">Lines</span></div>';
  if (m.mode === 'received') h += '<div class="inv-row-group"><span>Line</span><span>Quantity · &#8377; per unit, before GST</span></div>';
  st.items.filter(function(i) { return i.active !== false; }).forEach(function(i) {
    var v = m.vals[i.id] || {}, lv = stockReplay(i.id).level;
    h += '<div class="inv-row inv-row-2 inv-row-flow"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(i.name) + '</span>' +
      '<span class="inv-row-meta">' + (m.mode === 'count' ? 'app has ' : 'now ') + escHtml(stockFmtQty(lv)) + ' ' + escHtml(i.unit || '') + '</span></span>' +
      '<span class="inv-row-end"><input type="number" inputmode="decimal" step="any" min="0" class="inv-input inv-input-sm inv-input-num" data-stock-qty="' + escHtml(i.id) + '" value="' + escHtml(v.qty != null ? v.qty : '') + '" aria-label="' + escHtml(i.name) + ' quantity">' +
      '<span class="inv-unit">' + escHtml(i.unit || '') + '</span>' +
      (m.mode === 'received' ? '<input type="number" inputmode="decimal" step="any" min="0" class="inv-input inv-input-sm inv-input-num" data-stock-price="' + escHtml(i.id) + '" value="' + escHtml(v.price != null ? v.price : '') + '" placeholder="₹/' + escHtml(i.unit || 'unit') + '" aria-label="' + escHtml(i.name) + ' price per unit">' : '') +
      '</span></div>';
  });
  h += '<div class="inv-panel-body"><div class="inv-field-label">Add a line</div><div class="inv-toolbar inv-toolbar-flush">' +
    '<input id="stockNewName" class="inv-input inv-toolbar-item" placeholder="Name, e.g. Chromic acid" aria-label="New line name" autocomplete="off">' +
    '<select id="stockNewUnit" class="inv-select inv-select-sm" aria-label="Unit"><option value="kg">kg</option><option value="L">L</option><option value="nos">nos</option></select>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invStockAddLine">Add</button></div></div></div>';
  h += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">' + escHtml(STOCK_KIND_LABEL[m.mode]) + ' on</div>' +
    '<div class="inv-actionbar-value">' + escHtml(stockShortDate(m.date)) + '</div></div>' +
    '<button class="inv-btn inv-btn-primary" data-action="invStockSaveManual">Save</button></div>';
  return h;
}

function stockSaveManual() {
  var m = _stockManual;
  if (!m) return;
  if (!m.date) { showToast('Pick a date', 'error'); return; }
  if (m.mode === 'received') {
    // A delivery is recorded with its bill: the company, the invoice and its
    // date are what the price and the purchase pattern are read from.
    if (!m.supplier) { showToast('Enter the company that billed it', 'error'); return; }
    if (!m.billNo) { showToast('Enter the invoice number', 'error'); return; }
  }
  var st = stockData(), at = Date.now(), by = stockBy(), n = 0, gaps = 0, unpriced = 0;
  Object.keys(m.vals).forEach(function(id) {
    var v = m.vals[id], q = parseFloat(v.qty);
    if (v.qty === '' || v.qty == null || isNaN(q) || q < 0) return;
    if (!stockItem(id)) return;
    var rec = { id: stockUid('SE'), itemId: id, kind: m.mode, qty: q, date: m.date, seq: STOCK_KIND_RANK[m.mode], at: at, source: 'manual', by: by, sentBy: '' };
    if (m.mode === 'received') {
      var pr = parseFloat(v.price);
      if (v.price !== '' && v.price != null && !isNaN(pr) && pr >= 0) rec.price = pr; else unpriced++;
      rec.supplier = m.supplier;
      rec.billNo = m.billNo;
      rec.billDate = m.billDate || m.date;
    }
    if (m.mode === 'used' || m.mode === 'charged') { rec.days = 1; rec.from = m.date; }
    if (m.mode === 'charged' && m.bath) rec.note = m.bath;
    if (m.mode === 'count') {
      var before = stockReplay(id, stockIsoAdd(m.date, 1)).level;
      if (before != null && stockRound(before) !== stockRound(q)) gaps++;
    }
    st.entries.push(rec);
    n++;
  });
  if (!n) { showToast('Nothing filled in', 'error'); return; }
  saveState();
  _stockManual = null;
  stockSetView('list');
  showToast(n + (n === 1 ? ' entry' : ' entries') + ' saved' + (gaps ? ' · ' + gaps + ' count' + (gaps === 1 ? ' differs' : 's differ') + ' from the app' : '') +
    (unpriced ? ' · ' + unpriced + ' without a price: add it on the line' : ''), gaps || unpriced ? 'warning' : 'success');
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
      '<div class="inv-tile-value">' + (lp ? escHtml(formatCurrency(lp.price)) + ' <span class="inv-tile-of">/' + escHtml(unit || 'unit') + '</span>' : '&mdash;') + '</div>' +
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
  h += stockPatternHtml(item) + stockEditHtml(item);

  var replay = stockReplay(item.id).rows;
  var byId = {};
  replay.forEach(function(r) { byId[r.e.id] = r; });
  var all = stockData().entries.filter(function(e) { return e.itemId === item.id; });
  all = stockSortEntries(all).reverse();
  h += '<div class="inv-panel inv-panel-flush" id="stockEntries"><div class="inv-panel-head"><span class="inv-panel-title">Entries <span class="inv-panel-count">' + all.length + '</span></span></div>';
  if (!all.length) h += '<div class="inv-empty">Nothing recorded on this line yet.</div>';
  all.forEach(function(e) { h += stockEntryRowHtml(e, byId[e.id], unit); });
  return h + '</div>';
}

function stockEntryRowHtml(e, r, unit) {
  var when = e.from && e.from !== e.date ? stockShortDate(e.from) + ' – ' + stockShortDate(e.date) : stockShortDate(e.date);
  var src = e.source === 'paste' ? 'pasted' + (e.sentBy ? ', sent by ' + e.sentBy : '') : e.source === 'import' ? 'imported' : 'by hand';
  if (e.by) src += ' · entered by ' + e.by;
  var extra = [];
  if (e.kind === 'received' || e.kind === 'bill') {
    if (e.price != null) extra.push(formatCurrency(e.price) + '/' + (unit || 'unit'));
    if (e.supplier) extra.push(e.supplier);
    if (e.billNo) extra.push('invoice ' + e.billNo + (e.billDate && e.billDate !== e.date ? ' of ' + stockShortDate(e.billDate) : ''));
  }
  if (e.note) extra.push(e.note);
  var gap = '';
  if (e.kind === 'count' && r && r.before != null && stockRound(r.before) !== stockRound(e.qty)) {
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
    (e.voided ? '' : '<div class="inv-row-end"><button class="inv-btn inv-btn-sm inv-btn-danger' + (armed ? ' inv-btn-solid' : '') + '" data-action="invStockVoid" data-id="' + escHtml(e.id) + '"' +
      (armed ? ' aria-pressed="true"' : '') + '>' + (armed ? 'Tap again to void' : 'Void') + '</button></div>') +
    '</div>';
}

/* A wrong entry is voided, never deleted: the export is the record's source,
   and an entry that vanished would leave soma-internal holding a figure the
   app no longer explains. */
function stockVoid(id) {
  if (_stockVoidArm !== id) { _stockVoidArm = id; renderStock(); return; }
  var e = stockData().entries.find(function(x) { return x.id === id; });
  _stockVoidArm = null;
  if (!e) return;
  e.voided = { at: Date.now(), by: stockBy() };
  saveState();
  renderStock();
  showToast('Entry voided');
}

/* ---------- Export and import ----------
   The export is always the whole record: every line, every entry, every
   message as pasted. soma-internal de-duplicates on the ids at each compile. */
function stockExport() {
  var st = stockData();
  var meta = document.querySelector('meta[name="app-build"]');
  var out = { format: 'sep-stock', version: 1, exportedAt: new Date().toISOString(), build: meta ? meta.content : '',
    items: st.items, entries: st.entries, pastes: st.pastes };
  var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sep-stock-' + localDateStr() + '.json';
  a.click();
  showToast('Stock exported: ' + st.entries.length + ' entries');
}

// Merges; never overwrites. A line matches by id, then by name.
function stockMergeImport(src) {
  if (!src || typeof src !== 'object') throw new Error('not a stock file');
  if (src.format !== 'sep-stock' && src.stock) src = src.stock;
  if (!Array.isArray(src.items) || !Array.isArray(src.entries)) throw new Error('not a stock file');
  var st = stockData(), idMap = {}, added = { items: 0, entries: 0, pastes: 0 };
  src.items.forEach(function(it) {
    if (!it || !it.id || typeof it.name !== 'string' || !it.name.trim()) return;
    var mine = stockItem(it.id) || stockFindByKey(it.key || stockKey(it.name));
    if (mine) { idMap[it.id] = mine.id; return; }
    var copy = JSON.parse(JSON.stringify(it));
    copy.key = copy.key || stockKey(copy.name);
    st.items.push(copy); idMap[it.id] = copy.id; added.items++;
  });
  var have = {};
  st.entries.forEach(function(e) { have[e.id] = true; });
  var num = function(v) { return typeof v === 'number' && isFinite(v); };
  src.entries.forEach(function(e) {
    if (!e || !e.id || have[e.id] || !idMap[e.itemId]) return;
    // A file is data from elsewhere: an entry must be a known kind with real
    // numbers, or it is dropped rather than left to break the screens.
    if (!STOCK_KIND_LABEL[e.kind] || !num(e.qty) || typeof e.date !== 'string') return;
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
  var inp = document.getElementById('stockFileInput');
  if (!inp) return;
  inp.onchange = function(ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function(e2) {
      try {
        var added = stockMergeImport(JSON.parse(e2.target.result));
        saveState();
        renderStock();
        showToast(added.entries || added.items || added.bills ? 'Imported ' + added.items + ' lines, ' + added.entries + ' entries' + (added.bills ? ', ' + added.bills + ' power/other bills' : '') : 'Nothing new in that file');
      } catch (err) { showToast('Not a stock file', 'error'); }
    };
    reader.readAsText(f);
  };
  inp.click();
}

/* ---------- The More sheet ---------- */
var MORE_TABS = ['pageTodo', 'pageFinance', 'pageStock', 'pageStaff', 'pageStats', 'pageHistory'];
function closeMoreSheet() {
  var el = document.getElementById('moreSheet');
  if (el) el.remove();
}
function openMoreSheet() {
  closeMoreSheet();
  var out = stockOutCount();
  var tdOpen = todoRanked().length, tdLate = todoRedCount();
  var items = [
    ['pageTodo', 'To-do', tdOpen ? tdOpen + ' open' + (tdLate ? ', ' + tdLate + ' late' : '') : 'Nothing due', '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>'],
    ['pageFinance', 'Finance', 'Bank, receivables, bills, GST', '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'],
    ['pageStock', 'Stock', out ? out + ' out' : 'Chemicals on the shelf', '<path d="M9 3h6"/><path d="M10 3v6L4.5 19a1.5 1.5 0 001.3 2h12.4a1.5 1.5 0 001.3-2L14 9V3"/><path d="M7 15h10"/>'],
    ['pageStaff', 'Staff', 'Attendance, labour, areas', '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>'],
    ['pageStats', 'Stats', 'Realisation, tonnage, cost', '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>'],
    ['pageHistory', 'History', 'The audit trail', '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>']
  ];
  var cur = (document.querySelector('.inv-page-active') || {}).id;
  // A sheet from the bottom (§6.16), its entries rows; the open one is the current page.
  var h = '<div class="inv-sheet" data-action="invMoreStay" role="dialog" aria-label="More"><div class="inv-sheet-grab"></div>';
  items.forEach(function(it) {
    h += '<button class="inv-row inv-row-2" data-action="invSwitchTab" data-tab="' + it[0] + '"' + (cur === it[0] ? ' aria-current="page"' : '') + '>' +
      '<span class="inv-row-lead"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + it[3] + '</svg></span>' +
      '<span class="inv-row-main"><span class="inv-row-title">' + it[1] + '</span><span class="inv-row-meta">' + escHtml(it[2]) + '</span></span>' +
      (it[0] === 'pageStock' && out ? '<span class="inv-row-end"><span class="inv-badge inv-badge-danger">' + out + ' out</span></span>' : '') +
      (it[0] === 'pageTodo' && tdLate ? '<span class="inv-row-end"><span class="inv-badge inv-badge-danger">' + tdLate + ' late</span></span>' : '') + '</button>';
  });
  h += '</div>';
  var scrim = document.createElement('div');
  scrim.id = 'moreSheet';
  scrim.className = 'inv-scrim';
  scrim.setAttribute('data-action', 'invCloseMore');
  scrim.innerHTML = h;
  document.body.appendChild(scrim);
  var first = scrim.querySelector('.inv-row');
  if (first) first.focus();
}

/* ---------- Actions ---------- */
function stockAction(action, btn) {
  switch (action) {
    case 'invStockPaste': stockSetView('paste'); break;
    case 'invStockRead': stockReadPaste(); break;
    case 'invStockManual': stockOpenManual(); break;
    case 'invStockBack':
      if (_stockView === 'review') { stockSetView('paste'); break; }
      _stockReview = null; _stockManual = null; _stockReorder = null; stockSetView(_stockHome); break;
    case 'invStockOpen': _stockItemId = btn.dataset.id; stockSetView('item'); break;
    case 'invStockPaneClose': stockSetView('list'); break;
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
    case 'invStockExport': stockExport(); break;
    case 'invStockBillOpen': stockBillOpen(btn.dataset.entry || ''); break;
    case 'invStockReorder': _stockReorder = { qty: {} }; stockSetView('reorder'); break;
    case 'invStockReorderCopy': stockReorderCopy(); break;
    case 'invStockBillSave': stockBillSave(); break;
    case 'invStockBillCancel': _stockBill = null; renderStock(); break;
    case 'invStockImport': stockImport(); break;
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
  if (t.id === 'stockManDate' && _stockManual) { _stockManual.date = t.value; return true; }
  if ((t.id === 'stockLeadDays' || t.id === 'stockCoverDays') && _stockReorder) { stockReorderOnInput(t); renderStock(); return true; }
  return false;
}
